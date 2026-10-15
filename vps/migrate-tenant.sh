#!/bin/bash
# ============================================================
# MIGRATE TENANT — 1-CLICK AUTOMATION (BURST MODE)
# Pemakaian: migrate-tenant.sh <slug> <target_host> <direction>
# direction: "to_worker" | "to_master"
# ============================================================
set -u

SLUG="${1:-}"
TARGET_HOST="${2:-}"
DIRECTION="${3:-to_worker}"

if [ -z "$SLUG" ]; then
  echo '{"success": false, "error": "Parameter slug wajib diisi."}'
  exit 1
fi

DB_PATH="/opt/pocketbase/master/pb_data/data.db"
if [ ! -f "$DB_PATH" ]; then
  echo '{"success": false, "error": "Database master PocketBase tidak ditemukan."}'
  exit 1
fi

# 1. Ambil detail tenant dari database Master
INFO=$(python3 - "$SLUG" "$DB_PATH" << 'PYEOF'
import sqlite3, sys, json
slug, path = sys.argv[1], sys.argv[2]
conn = sqlite3.connect(path)
cur = conn.cursor()
cur.execute("SELECT port, custom_domain, student_quota, server_host, name FROM schools WHERE slug = ?", (slug,))
row = cur.fetchone()
if not row:
    print(json.dumps({"found": False}))
else:
    print(json.dumps({
        "found": True,
        "port": row[0] or 8091,
        "custom_domain": row[1] or "",
        "student_quota": row[2] or 300,
        "server_host": (row[3] or "127.0.0.1").strip(),
        "name": row[4] or slug
    }))
PYEOF
)

FOUND=$(echo "$INFO" | grep -o '"found": true' || true)
if [ -z "$FOUND" ]; then
  echo "{\"success\": false, \"error\": \"Tenant dengan slug '$SLUG' tidak ditemukan di database master.\"}"
  exit 1
fi

PORT=$(python3 -c "import json; print(json.loads('''$INFO''')['port'])")
CUSTOM_DOMAIN=$(python3 -c "import json; print(json.loads('''$INFO''')['custom_domain'])")
QUOTA=$(python3 -c "import json; print(json.loads('''$INFO''')['student_quota'])")
CURRENT_HOST=$(python3 -c "import json; print(json.loads('''$INFO''')['server_host'])")
SCHOOL_NAME=$(python3 -c "import json; print(json.loads('''$INFO''')['name'])")

# ============================================================
# PEPPER MIGRATION — FAST_LOGIN_PEPPER wajib ikut pindah
# Tanpa ini, fastHash di DB tidak valid di target -> login
# fallback ke bcrypt -> overload saat ujian massal.
# (Insiden 2026-10-15: migrasi agugu Worker->Master tanpa pepper,
#  5000 user gagal login massal sampai pepper disamakan manual.)
# Catatan: add-school.sh SELALU generate pepper BARU di target,
# jadi fungsi di bawah menimpanya dengan pepper dari source
# via drop-in systemd (override inline Environment di service file).
# ============================================================
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no"

# Ambil pepper dari sebuah host. host kosong = lokal, selain itu via ssh root@host.
# Coba 3 lokasi berurutan, kembalikan string kosong jika tidak ketemu/tidak valid.
read_pepper() {
  local host="$1" slug="$2" pepper="" get_cmd=""
  if [ -n "$host" ]; then
    get_cmd="ssh $SSH_OPTS root@${host}"
  fi
  pepper=$($get_cmd sh -c '
    slug="$1"
    p=$(grep -h -o "FAST_LOGIN_PEPPER=[0-9a-fA-F]*" "/etc/systemd/system/pb-${slug}.service.d/pepper.conf" 2>/dev/null | head -1 | cut -d= -f2)
    [ -z "$p" ] && p=$(grep -h -o "FAST_LOGIN_PEPPER=[0-9a-fA-F]*" "/etc/systemd/system/pb-${slug}.service" 2>/dev/null | head -1 | cut -d= -f2)
    [ -z "$p" ] && p=$(tr -d " \n\r" < "/opt/pocketbase/schools/${slug}/fastlogin_pepper.key" 2>/dev/null)
    printf "%s" "$p"
  ' sh "$slug" 2>/dev/null)
  # Validasi: harus tepat 64 hex chars (openssl rand -hex 32)
  if [[ "$pepper" =~ ^[0-9a-fA-F]{64}$ ]]; then
    printf "%s" "$pepper"
  else
    printf ""
  fi
}

# Tulis pepper ke target sebagai drop-in systemd, lalu daemon-reload + restart
# agar langsung aktif. Drop-in meng-override Environment inline dari add-school.sh.
write_pepper() {
  local host="$1" slug="$2" pepper="$3" get_cmd=""
  if [ -n "$host" ]; then
    get_cmd="ssh $SSH_OPTS root@${host}"
  fi
  $get_cmd sh -c '
    slug="$1"; pepper="$2"
    mkdir -p "/etc/systemd/system/pb-${slug}.service.d"
    printf "Environment=FAST_LOGIN_PEPPER=%s\n" "$pepper" > "/etc/systemd/system/pb-${slug}.service.d/pepper.conf"
    chmod 600 "/etc/systemd/system/pb-${slug}.service.d/pepper.conf"
    systemctl daemon-reload
    systemctl restart "pb-${slug}.service"
  ' sh "$slug" "$pepper"
}

pepper_missing_warning() {
  local slug="$1"
  echo "=================================================================" >&2
  echo "PERINGATAN KERAS: FAST_LOGIN_PEPPER tidak ditemukan di source" >&2
  echo "untuk tenant '$slug'!" >&2
  echo "Target akan memakai pepper BARU dari add-school.sh." >&2
  echo "Ini WAJAR hanya untuk tenant BARU (belum ada siswa)." >&2
  echo "Untuk MIGRASI tenant existing: fastHash di DB tidak akan valid," >&2
  echo "login akan fallback ke bcrypt (LAMBAT) dan bisa overload." >&2
  echo "Batalkan dan periksa source jika ini migrasi data existing!" >&2
  echo "=================================================================" >&2
}

# ============================================================
# KASUS A: PINDAH KE WORKER VPS (Mulai Ujian / Burst Mode)
# ============================================================
if [ "$DIRECTION" = "to_worker" ]; then
  if [ -z "$TARGET_HOST" ] || [ "$TARGET_HOST" = "127.0.0.1" ] || [ "$TARGET_HOST" = "localhost" ]; then
    echo '{"success": false, "error": "IP Worker VPS tujuan tidak valid."}'
    exit 1
  fi

  # Tes koneksi SSH ke Worker
  if ! ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@"$TARGET_HOST" "true" 2>/dev/null; then
    echo "{\"success\": false, \"error\": \"Gagal terhubung ke Worker $TARGET_HOST via SSH. Pastikan worker sudah menjalankan script setup_worker_node.sh.\"}"
    exit 1
  fi

  # Bawa FAST_LOGIN_PEPPER dari Master (baca SEBELUM service lokal dimatikan/dihapus)
  SRC_PEPPER=$(read_pepper "" "$SLUG")
  if [ -z "$SRC_PEPPER" ]; then
    pepper_missing_warning "$SLUG"
  fi

  # Matikan service lokal di Master agar SQLite aman disalin
  systemctl stop "pb-${SLUG}.service" 2>/dev/null || true

  # Siapkan folder di Worker VPS
  ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@"$TARGET_HOST" "mkdir -p /opt/pocketbase/schools/${SLUG}"

  # Sinkronisasi file database dan data sekolah via rsync
  if [ -d "/opt/pocketbase/schools/${SLUG}" ]; then
    rsync -avz --delete "/opt/pocketbase/schools/${SLUG}/" root@"${TARGET_HOST}":"/opt/pocketbase/schools/${SLUG}/" >/dev/null 2>&1
  else
    # Jika belum ada folder lokal, buat dari template di Worker
    ssh root@"$TARGET_HOST" "mkdir -p /opt/pocketbase/schools/${SLUG} && cp -r /opt/pocketbase/schools/template/* /opt/pocketbase/schools/${SLUG}/" >/dev/null 2>&1
  fi

  # Pasang dan jalankan systemd service pada Worker VPS
  ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@"$TARGET_HOST" "/usr/local/bin/add-school.sh '${SLUG}' ${PORT} '${CUSTOM_DOMAIN}' ${QUOTA}" >/dev/null 2>&1

  # Timpa pepper Worker (add-school.sh selalu generate baru) dengan pepper Master
  # agar fastHash di DB yang baru disalin tetap valid.
  if [ -n "$SRC_PEPPER" ]; then
    write_pepper "$TARGET_HOST" "$SLUG" "$SRC_PEPPER"
  fi

  # Perbarui Caddy di Master VPS (arah reverse proxy ke Worker IP)
  /usr/local/bin/add-school.sh "${SLUG}" "${PORT}" "${CUSTOM_DOMAIN}" "${QUOTA}" "${TARGET_HOST}" >/dev/null 2>&1

  # Nonaktifkan systemd lokal di Master untuk menghemat RAM
  systemctl disable "pb-${SLUG}.service" 2>/dev/null || true
  rm -f "/etc/systemd/system/pb-${SLUG}.service"
  systemctl daemon-reload

  # Update database Master
  sqlite3 "$DB_PATH" "UPDATE schools SET server_host = '$TARGET_HOST' WHERE slug = '$SLUG';"

  echo "{\"success\": true, \"message\": \"Tenant ${SCHOOL_NAME} (${SLUG}) berhasil dimigrasikan ke Worker Node ${TARGET_HOST}:${PORT}!\", \"server_host\": \"${TARGET_HOST}\"}"
  exit 0

# ============================================================
# KASUS B: TARIK BALIK KE MASTER VPS (Ujian Selesai / Hemat Biaya)
# ============================================================
elif [ "$DIRECTION" = "to_master" ]; then
  SOURCE_HOST="$CURRENT_HOST"
  if [ -z "$SOURCE_HOST" ] || [ "$SOURCE_HOST" = "127.0.0.1" ] || [ "$SOURCE_HOST" = "localhost" ]; then
    echo "{\"success\": false, \"error\": \"Tenant ${SLUG} saat ini sudah berada di Master VPS.\"}"
    exit 1
  fi

  # Tes koneksi SSH ke Worker sumber
  if ! ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@"$SOURCE_HOST" "true" 2>/dev/null; then
    echo "{\"success\": false, \"error\": \"Gagal terhubung ke Worker sumber $SOURCE_HOST via SSH. Pastikan server worker masih menyala.\"}"
    exit 1
  fi

  # Bawa FAST_LOGIN_PEPPER dari Worker (baca SEBELUM cleanup remove-school.sh)
  SRC_PEPPER=$(read_pepper "$SOURCE_HOST" "$SLUG")
  if [ -z "$SRC_PEPPER" ]; then
    pepper_missing_warning "$SLUG"
  fi

  # Matikan service di Worker agar file SQLite konsisten saat disalin
  ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@"$SOURCE_HOST" "systemctl stop pb-${SLUG}.service 2>/dev/null || true"

  # Tarik database terbaru dan jawaban siswa kembali ke Master VPS
  mkdir -p "/opt/pocketbase/schools/${SLUG}"
  rsync -avz --delete root@"${SOURCE_HOST}":"/opt/pocketbase/schools/${SLUG}/" "/opt/pocketbase/schools/${SLUG}/" >/dev/null 2>&1

  # Jalankan tenant secara lokal di Master VPS (systemd + rambalancer)
  /usr/local/bin/add-school.sh "${SLUG}" "${PORT}" "${CUSTOM_DOMAIN}" "${QUOTA}" "127.0.0.1" >/dev/null 2>&1

  # Timpa pepper Master (add-school.sh selalu generate baru) dengan pepper Worker
  # agar fastHash di DB yang baru ditarik tetap valid.
  if [ -n "$SRC_PEPPER" ]; then
    write_pepper "" "$SLUG" "$SRC_PEPPER"
  fi

  # Bersihkan service di Worker Node
  ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@"$SOURCE_HOST" "/usr/local/bin/remove-school.sh '${SLUG}' 2>/dev/null || true"

  # Update database Master
  sqlite3 "$DB_PATH" "UPDATE schools SET server_host = '127.0.0.1' WHERE slug = '$SLUG';"

  echo "{\"success\": true, \"message\": \"Database & hasil ujian ${SCHOOL_NAME} (${SLUG}) berhasil ditarik 100% kembali ke Master VPS! Worker VPS kini aman untuk dimatikan.\", \"server_host\": \"127.0.0.1\"}"
  exit 0

else
  echo "{\"success\": false, \"error\": \"Arah migrasi tidak valid (hanya to_worker atau to_master).\"}"
  exit 1
fi
