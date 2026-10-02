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

  # Matikan service di Worker agar file SQLite konsisten saat disalin
  ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@"$SOURCE_HOST" "systemctl stop pb-${SLUG}.service 2>/dev/null || true"

  # Tarik database terbaru dan jawaban siswa kembali ke Master VPS
  mkdir -p "/opt/pocketbase/schools/${SLUG}"
  rsync -avz --delete root@"${SOURCE_HOST}":"/opt/pocketbase/schools/${SLUG}/" "/opt/pocketbase/schools/${SLUG}/" >/dev/null 2>&1

  # Jalankan tenant secara lokal di Master VPS (systemd + rambalancer)
  /usr/local/bin/add-school.sh "${SLUG}" "${PORT}" "${CUSTOM_DOMAIN}" "${QUOTA}" "127.0.0.1" >/dev/null 2>&1

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
