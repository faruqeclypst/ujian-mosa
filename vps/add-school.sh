#!/bin/bash
# add-school.sh — provisioning tenant PocketBase (Lokal Master VPS atau Worker Node)
# Dipanggil oleh: master/pb_hooks/provisioning.pb.js
# Pemakaian: add-school.sh <slug> <port> [custom_domain] [quota_siswa] [server_host]
set -u

SLUG="${1:-}"
PORT="${2:-}"
CUSTOM_DOMAIN="${3:-}"
QUOTA="${4:-300}"
SERVER_HOST="${5:-127.0.0.1}"

if [ -z "$SLUG" ] || [ -z "$PORT" ]; then
  echo "[add-school] ERROR: butuh <slug> <port>" >&2
  exit 1
fi
case "$QUOTA" in (*[!0-9]*|"") QUOTA=300 ;; esac

# Normalisasi domain
CUSTOM_DOMAIN=$(echo "$CUSTOM_DOMAIN" | sed -e 's|^[^/]*//||' -e 's|/.*$||' | tr -d '[:space:]')
if [ "$CUSTOM_DOMAIN" = "_" ] || [ "$CUSTOM_DOMAIN" = "-" ]; then
  CUSTOM_DOMAIN=""
fi

if [ -n "$CUSTOM_DOMAIN" ]; then
  DOMAINS="${SLUG}.examku.my.id, ${CUSTOM_DOMAIN}"
else
  DOMAINS="${SLUG}.examku.my.id"
fi

# Normalisasi server_host
SERVER_HOST=$(echo "$SERVER_HOST" | tr -d '[:space:]')
if [ -z "$SERVER_HOST" ] || [ "$SERVER_HOST" = "_" ] || [ "$SERVER_HOST" = "-" ]; then
  SERVER_HOST="127.0.0.1"
fi

TEMPLATE_DIR="/opt/pocketbase/schools/template"
TARGET_DIR="/opt/pocketbase/schools/$SLUG"
QUOTA_REGISTRY="/etc/examku-tenant-quota.json"

# ============================================================
# CABANG 1: WORKER NODE EKSTERNAL (IP terpisah)
# ============================================================
if [ "$SERVER_HOST" != "127.0.0.1" ] && [ "$SERVER_HOST" != "localhost" ]; then
  echo "[add-school] Provisioning $SLUG pada Worker Node ($SERVER_HOST:$PORT)..."

  # Matikan service lokal jika sebelumnya pernah jalan di Master VPS (migrasi)
  systemctl stop "pb-${SLUG}.service" 2>/dev/null || true
  systemctl disable "pb-${SLUG}.service" 2>/dev/null || true
  rm -f "/etc/systemd/system/pb-${SLUG}.service"
  systemctl daemon-reload

  # Pasang Caddy Reverse Proxy ke Worker Node
  cat > "/etc/caddy/conf.d/${SLUG}.caddy" << CADDY
$DOMAINS {
    root * /opt/frontend/ujian/dist
    file_server
    handle /api/* {
        reverse_proxy $SERVER_HOST:$PORT
    }
    handle /_* {
        reverse_proxy $SERVER_HOST:$PORT
    }
    handle {
        try_files {path} /index.html
    }
}
CADDY
  systemctl reload caddy

  # Otomasi via SSH jika key sudah terpasang
  if ssh -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=no root@"$SERVER_HOST" "true" 2>/dev/null; then
    echo "[add-school] SSH aktif ke $SERVER_HOST, sinkronisasi master template..."
    scp -o StrictHostKeyChecking=no /usr/local/bin/vps-health.py root@"$SERVER_HOST":/usr/local/bin/vps-health.py 2>/dev/null || true
    ssh -o BatchMode=yes root@"$SERVER_HOST" "chmod +x /usr/local/bin/vps-health.py 2>/dev/null || true"
    rsync -az --delete /opt/pocketbase/schools/template/ root@"$SERVER_HOST":/opt/pocketbase/schools/template/ 2>/dev/null || true
    
    # Jika data sekolah sudah ada di Master VPS (misal edit atau migrasi), salin ke Worker
    if [ -d "$TARGET_DIR" ]; then
      echo "[add-school] Menyinkronkan data sekolah yang ada ke $SERVER_HOST..."
      rsync -az "$TARGET_DIR/" root@"$SERVER_HOST":"$TARGET_DIR/" 2>/dev/null || true
    fi

    echo "[add-school] Menjalankan remote auto-provisioning di $SERVER_HOST..."
    ssh -o BatchMode=yes -o ConnectTimeout=5 root@"$SERVER_HOST" "/usr/local/bin/add-school.sh $SLUG $PORT '${CUSTOM_DOMAIN}' $QUOTA" 2>&1 || true
  else
    echo "[add-school] Info: Remote SSH belum dikonfigurasi, pastikan PocketBase pada $SERVER_HOST:$PORT sudah aktif."
  fi

  echo "[add-school] OK: $SLUG berhasil diarahkan ke Worker Node $SERVER_HOST:$PORT"
  exit 0
fi

# ============================================================
# CABANG 2: LOKAL MASTER VPS (127.0.0.1)
# ============================================================
echo "[add-school] Provisioning $SLUG lokal (port=$PORT, kuota=${QUOTA})"

# ---------- 1. Direktori dari template ----------
if [ ! -d "$TARGET_DIR" ]; then
  mkdir -p "$TARGET_DIR"
  cp -r "$TEMPLATE_DIR"/* "$TARGET_DIR/"
  chmod +x "$TARGET_DIR/pocketbase"
  echo "[add-school] direktori dibuat dari template"
fi

# ---------- 2. Hook PRAGMA (busy_timeout) ----------
HOOKS="$TARGET_DIR/pb_hooks"
mkdir -p "$HOOKS"
if [ ! -f "$HOOKS/zz_pragma.pb.js" ]; then
  cat > "$HOOKS/zz_pragma.pb.js" << 'HOOKEOF'
/// <reference path="../pb_data/types.d.ts" />
onBootstrap((e) => {
  e.next();
  try {
    $app.db().newQuery("PRAGMA busy_timeout=5000").execute();
    $app.db().newQuery("PRAGMA journal_size_limit=200000000").execute();
    console.log("[pragma] busy_timeout=5000, journal_size_limit=200MB applied");
  } catch (err) {
    console.error("[pragma] gagal:", err);
  }
});
HOOKEOF
  echo "[add-school] hook zz_pragma.pb.js dipasang"
fi

# ---------- 3. Hitung alokasi awal (sebelum balancer) ----------
BUDGET_MB=$(awk -v q="$QUOTA" 'BEGIN{pb=120+(q*1.3*0.55); pb=pb*1.45; n=pb*1.5; if(n<512)n=512; printf "%d", n}')
MEM_MAX="${BUDGET_MB}M"
MEM_HIGH=$(awk -v b="$BUDGET_MB" 'BEGIN{printf "%dM", b*0.85}')

# ---------- 4. Systemd service (pengaman memori terpasang) ----------
cat > "/etc/systemd/system/pb-${SLUG}.service" << SVC
[Unit]
StartLimitIntervalSec=300
StartLimitBurst=5
Description=PocketBase School - ${SLUG}
After=network.target

[Service]
Type=simple
Restart=always
RestartSec=3
User=root
LimitNOFILE=65535
MemoryMax=${MEM_MAX}
MemoryHigh=${MEM_HIGH}
MemorySwapMax=0
OOMScoreAdjust=-100
TasksMax=4096
WorkingDirectory=$TARGET_DIR
ExecStart=$TARGET_DIR/pocketbase serve --http="127.0.0.1:${PORT}" --dir=$TARGET_DIR/pb_data --hooksDir=$TARGET_DIR/pb_hooks

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
systemctl enable "pb-${SLUG}.service" >/dev/null 2>&1
systemctl restart "pb-${SLUG}.service"

# ---------- 5. Caddy ----------
cat > "/etc/caddy/conf.d/${SLUG}.caddy" << CADDY
$DOMAINS {
    root * /opt/frontend/ujian/dist
    file_server
    handle /api/* {
        reverse_proxy localhost:$PORT
    }
    handle /_* {
        reverse_proxy localhost:$PORT
    }
    handle {
        try_files {path} /index.html
    }
}
CADDY
systemctl reload caddy

# ---------- 6. Daftarkan kuota -> alokasi DINAMIS untuk SEMUA tenant ----------
python3 - "$SLUG" "$QUOTA" "$QUOTA_REGISTRY" << 'PYREG'
import json, sys, os
slug, quota, path = sys.argv[1], int(sys.argv[2]), sys.argv[3]
data = {}
if os.path.exists(path):
    try:
        data = json.load(open(path))
    except Exception:
        data = {}
data[slug] = {"quota": quota, "role": "primary" if quota >= 500 else "secondary"}
json.dump(data, open(path, "w"), indent=2, ensure_ascii=False)
print("[add-school] registry kuota: %d tenant terdaftar" % len(data))
PYREG

if [ -x /usr/local/bin/rambalancer.py ]; then
  python3 /usr/local/bin/rambalancer.py --apply | grep -E "TENANT|----|modalbangsa|${SLUG}|✅|⏭" || true
  echo "[add-school] alokasi RAM dinamis diterapkan ke SEMUA tenant"
fi

echo "[add-school] OK $SLUG siap: https://${SLUG}.examku.my.id"
