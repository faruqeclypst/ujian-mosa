#!/bin/bash
# ============================================================
# EXAM AA — Full VPS Restore Script
# Jalankan sebagai root di VPS BARU:
#   1. Upload backup: scp examaa-backup-*.tar.gz root@NEW_IP:/tmp/
#   2. bash restore.sh /tmp/examaa-backup-2026-05-25.tar.gz
# ============================================================

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    err "Usage: bash restore.sh /path/to/examaa-backup-YYYY-MM-DD.tar.gz"
fi

echo ""
echo "=========================================="
echo "   EXAM AA — Restore VPS"
echo "   File: ${BACKUP_FILE}"
echo "=========================================="
echo ""

# ============================================================
# 1. INSTALL DEPENDENCIES (jika VPS baru)
# ============================================================
info "Memastikan dependencies terinstall..."
apt-get update -qq
apt-get install -y -qq curl wget unzip ufw

# Install Caddy jika belum ada
if ! command -v caddy &> /dev/null; then
    info "Installing Caddy..."
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update && apt-get install caddy -y
    log "Caddy installed"
else
    log "Caddy sudah terinstall"
fi

# ============================================================
# 2. EXTRACT BACKUP
# ============================================================
info "Mengekstrak backup..."
EXTRACT_DIR="/tmp/examaa-restore"
rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"
tar -xzf "$BACKUP_FILE" -C "$EXTRACT_DIR"

# Find the actual backup folder (might be nested)
BACKUP_DIR=$(find "$EXTRACT_DIR" -maxdepth 1 -type d -name "examaa-backup-*" | head -1)
if [ -z "$BACKUP_DIR" ]; then
    BACKUP_DIR="$EXTRACT_DIR"
fi
log "Extracted to: $BACKUP_DIR"

# ============================================================
# 3. STOP EXISTING SERVICES
# ============================================================
info "Menghentikan services yang ada..."
systemctl list-units --type=service --state=running | grep "pb-" | awk '{print $1}' | while read svc; do
    systemctl stop "$svc" 2>/dev/null || true
done
systemctl stop caddy 2>/dev/null || true

# ============================================================
# 4. RESTORE POCKETBASE
# ============================================================
info "Restore PocketBase data..."
rm -rf /opt/pocketbase
cp -a "$BACKUP_DIR/pocketbase" /opt/pocketbase
# Pastikan binary executable
find /opt/pocketbase -name "pocketbase" -type f -exec chmod +x {} \;
log "PocketBase restored: $(du -sh /opt/pocketbase | awk '{print $1}')"

# ============================================================
# 5. RESTORE FRONTEND
# ============================================================
info "Restore frontend..."
rm -rf /opt/frontend
cp -a "$BACKUP_DIR/frontend" /opt/frontend
log "Frontend restored"

# ============================================================
# 6. RESTORE CADDY CONFIG
# ============================================================
info "Restore Caddy config..."
cp "$BACKUP_DIR/caddy/Caddyfile" /etc/caddy/Caddyfile
mkdir -p /etc/caddy/conf.d
cp -a "$BACKUP_DIR/caddy/conf.d/"* /etc/caddy/conf.d/ 2>/dev/null || true
log "Caddy config restored"

# ============================================================
# 7. RESTORE SYSTEMD SERVICES
# ============================================================
info "Restore systemd services..."
cp "$BACKUP_DIR/systemd/"*.service /etc/systemd/system/ 2>/dev/null || true
systemctl daemon-reload
log "$(ls /etc/systemd/system/pb-*.service 2>/dev/null | wc -l) services restored"

# ============================================================
# 8. RESTORE HELPER SCRIPTS
# ============================================================
info "Restore helper scripts..."
cp "$BACKUP_DIR/scripts/add-school.sh" /usr/local/bin/ 2>/dev/null || true
cp "$BACKUP_DIR/scripts/remove-school.sh" /usr/local/bin/ 2>/dev/null || true
chmod +x /usr/local/bin/add-school.sh 2>/dev/null || true
chmod +x /usr/local/bin/remove-school.sh 2>/dev/null || true
log "Helper scripts restored"

# ============================================================
# 9. RESTORE KERNEL TUNING
# ============================================================
if [ -f "$BACKUP_DIR/99-exam-aa.conf" ]; then
    cp "$BACKUP_DIR/99-exam-aa.conf" /etc/sysctl.d/
    sysctl --system > /dev/null 2>&1
    log "Kernel tuning restored"
fi

# ============================================================
# 10. START ALL SERVICES
# ============================================================
info "Menjalankan semua services..."

# Enable dan start semua PocketBase services
for svc in /etc/systemd/system/pb-*.service; do
    [ -f "$svc" ] || continue
    SVC_NAME=$(basename "$svc")
    systemctl enable "$SVC_NAME" 2>/dev/null || true
    systemctl start "$SVC_NAME" 2>/dev/null || true
    echo "  Started: $SVC_NAME"
done

# Start Caddy
systemctl enable caddy
systemctl start caddy
log "Caddy started"

# ============================================================
# 11. FIREWALL
# ============================================================
info "Konfigurasi firewall..."
ufw --force reset > /dev/null 2>&1
ufw allow 22/tcp > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1
log "Firewall configured"

# ============================================================
# 12. VERIFY
# ============================================================
echo ""
info "Verifikasi services..."
echo ""
systemctl list-units --type=service --state=running | grep "pb-" | awk '{printf "  ✓ %s\n", $1}'
echo ""

# Cleanup
rm -rf "$EXTRACT_DIR"

log "RESTORE SELESAI!"
echo ""
echo "=========================================="
echo "   Langkah selanjutnya:"
echo "   1. Update DNS A record ke IP baru: $(curl -s ifconfig.me)"
echo "   2. Tunggu DNS propagasi (5-30 menit)"
echo "   3. Caddy akan auto-generate SSL"
echo "   4. Test akses: https://ujian.alfaruqasri.my.id"
echo "=========================================="
