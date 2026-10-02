#!/bin/bash
# ============================================================
# SETUP WORKER NODE — EXAMKU CBT MULTI-VPS
# Jalankan script ini pada VPS Worker baru (Ubuntu 22.04 / 24.04)
# Perintah: bash setup_worker_node.sh
# ============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
info() { echo -e "${CYAN}[->]${NC} $1"; }

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR]${NC} Jalankan script ini sebagai root!"
  exit 1
fi

MASTER_PUBKEY="${1:-ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICmezFyH8hAAToSr4Aw3f0dtTcGVxp8fTkatn1ZdS0w3 root@alfaruqasr-sg}"

info "Memulai persiapan Worker Node..."

# 1. Update paket sistem & tool dasar
apt-get update && apt-get install -y curl wget unzip ufw rsync

# 2. Otomasi pairing SSH Master VPS
if [ -n "$MASTER_PUBKEY" ]; then
  info "Memasang kunci SSH Master VPS untuk otomasi 1-klik..."
  mkdir -p /root/.ssh
  chmod 700 /root/.ssh
  touch /root/.ssh/authorized_keys
  if ! grep -qF "$MASTER_PUBKEY" /root/.ssh/authorized_keys 2>/dev/null; then
    echo "$MASTER_PUBKEY" >> /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
    log "Kunci SSH Master berhasil didaftarkan ke /root/.ssh/authorized_keys"
  else
    log "Kunci SSH Master sudah aktif di /root/.ssh/authorized_keys"
  fi
fi

# 3. Buka port firewall jika UFW aktif
if command -v ufw >/dev/null 2>&1; then
  ufw allow proto tcp from 64.235.41.108 to any port 8091:8150 >/dev/null 2>&1 || true
fi

# 2. Siapkan folder PocketBase template
mkdir -p /opt/pocketbase/schools/template/pb_hooks
mkdir -p /opt/pocketbase/schools/template/pb_data

# 3. Download PocketBase binary
PB_VERSION="0.22.20"
if [ ! -f /opt/pocketbase/schools/template/pocketbase ]; then
  info "Mengunduh PocketBase v${PB_VERSION}..."
  wget -qO /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
  unzip -o /tmp/pb.zip -d /opt/pocketbase/schools/template/
  chmod +x /opt/pocketbase/schools/template/pocketbase
  rm -f /tmp/pb.zip
  log "PocketBase binary siap di /opt/pocketbase/schools/template/pocketbase"
fi

# 4. Pasang script add-school lokal pada Worker Node
cat > /usr/local/bin/add-school.sh << 'EOF'
#!/bin/bash
# add-school.sh pada Worker Node
set -u

SLUG="${1:-}"
PORT="${2:-}"
CUSTOM_DOMAIN="${3:-}"
QUOTA="${4:-300}"

if [ -z "$SLUG" ] || [ -z "$PORT" ]; then
  echo "[worker-add-school] ERROR: butuh <slug> <port>" >&2
  exit 1
fi

TEMPLATE_DIR="/opt/pocketbase/schools/template"
TARGET_DIR="/opt/pocketbase/schools/$SLUG"

if [ ! -d "$TARGET_DIR" ]; then
  mkdir -p "$TARGET_DIR"
  cp -r "$TEMPLATE_DIR"/* "$TARGET_DIR/"
  chmod +x "$TARGET_DIR/pocketbase"
fi

# Hook busy_timeout SQLite
HOOKS="$TARGET_DIR/pb_hooks"
mkdir -p "$HOOKS"
if [ ! -f "$HOOKS/zz_pragma.pb.js" ]; then
  cat > "$HOOKS/zz_pragma.pb.js" << 'HOOKEOF'
onBootstrap((e) => {
  e.next();
  try {
    $app.db().newQuery("PRAGMA busy_timeout=5000").execute();
    $app.db().newQuery("PRAGMA journal_size_limit=200000000").execute();
  } catch (err) {}
});
HOOKEOF
fi

# Buat Systemd Service
cat > "/etc/systemd/system/pb-${SLUG}.service" << SVC
[Unit]
Description=PocketBase Worker School - ${SLUG}
After=network.target

[Service]
Type=simple
Restart=always
RestartSec=3
User=root
LimitNOFILE=65535
WorkingDirectory=$TARGET_DIR
ExecStart=$TARGET_DIR/pocketbase serve --http="0.0.0.0:${PORT}" --dir=$TARGET_DIR/pb_data --hooksDir=$TARGET_DIR/pb_hooks

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
systemctl enable "pb-${SLUG}.service" >/dev/null 2>&1
systemctl restart "pb-${SLUG}.service"

echo "[worker-add-school] Tenant $SLUG aktif di port $PORT!"
EOF
chmod +x /usr/local/bin/add-school.sh

# 5. Pasang script remove-school pada Worker Node
cat > /usr/local/bin/remove-school.sh << 'EOF'
#!/bin/bash
SLUG="${1:-}"
if [ -z "$SLUG" ]; then exit 1; fi
systemctl stop "pb-${SLUG}.service" 2>/dev/null || true
systemctl disable "pb-${SLUG}.service" 2>/dev/null || true
rm -f "/etc/systemd/system/pb-${SLUG}.service"
systemctl daemon-reload
rm -rf "/opt/pocketbase/schools/${SLUG}"
echo "[worker-remove-school] Tenant $SLUG berhasil dihapus dari Worker Node."
EOF
chmod +x /usr/local/bin/remove-school.sh

log "Worker Node berhasil disiapkan!"
echo ""
echo "============================================================"
echo "LANGKAH BERIKUTNYA:"
echo "1. Pastikan port (misal 8091-8150) dapat diakses dari Master VPS (64.235.41.108)."
echo "2. Jika ingin otomatisasi penuh via SSH tanpa password:"
echo "   Tempelkan isi '/root/.ssh/id_ed25519.pub' dari Master VPS ke file:"
echo "   /root/.ssh/authorized_keys pada Worker Node ini."
echo "============================================================"
