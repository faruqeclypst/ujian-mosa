#!/bin/bash
# ============================================================
# EXAM AA — Full VPS Restore Script
# Jalankan sebagai root di VPS BARU:
#   bash restore.sh /tmp/examaa-backup-2026-05-25.tar.gz
# ============================================================

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

BACKUP_FILE="$1"
TOTAL_STEPS=11
CURRENT_STEP=0

progress() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    PCT=$((CURRENT_STEP * 100 / TOTAL_STEPS))
    BAR_LEN=30
    FILLED=$((PCT * BAR_LEN / 100))
    EMPTY=$((BAR_LEN - FILLED))
    BAR=$(printf "%${FILLED}s" | tr ' ' '█')$(printf "%${EMPTY}s" | tr ' ' '░')
    echo -e "\n${CYAN}[${BAR}] ${PCT}%${NC} — $1\n"
}

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    err "Usage: bash restore.sh /path/to/examaa-backup-YYYY-MM-DD.tar.gz"
fi

echo ""
echo "=========================================="
echo "   EXAM AA — Restore VPS"
echo "   File: $(basename ${BACKUP_FILE})"
echo "   Size: $(du -sh ${BACKUP_FILE} | awk '{print $1}')"
echo "=========================================="
echo ""

# ============================================================
progress "Install dependencies..."
apt-get update -qq
apt-get install -y -qq curl wget unzip ufw > /dev/null 2>&1

if ! command -v caddy &> /dev/null; then
    info "Installing Caddy..."
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
    apt-get update -qq && apt-get install caddy -y -qq > /dev/null 2>&1
fi
log "Dependencies OK"

# ============================================================
progress "Mengekstrak backup..."
EXTRACT_DIR="/tmp/examaa-restore"
rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"
tar -xzf "$BACKUP_FILE" -C "$EXTRACT_DIR"
BACKUP_DIR=$(find "$EXTRACT_DIR" -maxdepth 1 -type d -name "examaa-backup-*" | head -1)
[ -z "$BACKUP_DIR" ] && BACKUP_DIR="$EXTRACT_DIR"
log "Extracted"

# ============================================================
progress "Stop existing services..."
systemctl list-units --type=service --state=running | grep "pb-" | awk '{print $1}' | while read svc; do
    systemctl stop "$svc" 2>/dev/null || true
done
systemctl stop caddy 2>/dev/null || true
log "Stopped"

# ============================================================
progress "Restore PocketBase..."
rm -rf /opt/pocketbase
cp -a "$BACKUP_DIR/pocketbase" /opt/pocketbase
find /opt/pocketbase -name "pocketbase" -type f -exec chmod +x {} \;
log "PocketBase: $(du -sh /opt/pocketbase | awk '{print $1}')"

# ============================================================
progress "Restore frontend..."
rm -rf /opt/frontend
cp -a "$BACKUP_DIR/frontend" /opt/frontend
log "Frontend OK"

# ============================================================
progress "Restore Caddy config..."
cp "$BACKUP_DIR/caddy/Caddyfile" /etc/caddy/Caddyfile
mkdir -p /etc/caddy/conf.d
cp -a "$BACKUP_DIR/caddy/conf.d/"* /etc/caddy/conf.d/ 2>/dev/null || true
log "Caddy config OK"

# ============================================================
progress "Restore systemd services..."
cp "$BACKUP_DIR/systemd/"*.service /etc/systemd/system/ 2>/dev/null || true
if [ -d "$BACKUP_DIR/systemd/caddy.service.d" ]; then
    mkdir -p /etc/systemd/system/caddy.service.d
    cp -a "$BACKUP_DIR/systemd/caddy.service.d/"* /etc/systemd/system/caddy.service.d/ 2>/dev/null || true
fi
systemctl daemon-reload
log "$(ls /etc/systemd/system/pb-*.service 2>/dev/null | wc -l) services"

# ============================================================
progress "Restore scripts & config..."
cp "$BACKUP_DIR/scripts/add-school.sh" /usr/local/bin/ 2>/dev/null || true
cp "$BACKUP_DIR/scripts/remove-school.sh" /usr/local/bin/ 2>/dev/null || true
chmod +x /usr/local/bin/add-school.sh /usr/local/bin/remove-school.sh 2>/dev/null || true
[ -f "$BACKUP_DIR/99-exam-aa.conf" ] && cp "$BACKUP_DIR/99-exam-aa.conf" /etc/sysctl.d/ && sysctl --system > /dev/null 2>&1
log "Scripts OK"

# ============================================================
progress "Start all services..."
for svc in /etc/systemd/system/pb-*.service; do
    [ -f "$svc" ] || continue
    SVC_NAME=$(basename "$svc")
    systemctl enable "$SVC_NAME" 2>/dev/null || true
    systemctl start "$SVC_NAME" 2>/dev/null || true
done
systemctl enable caddy && systemctl start caddy
log "All services running"

# ============================================================
progress "Firewall & cleanup..."
ufw --force reset > /dev/null 2>&1
ufw allow 22/tcp > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1
rm -rf "$EXTRACT_DIR"
log "Firewall OK"

# ============================================================
echo ""
echo -e "${GREEN}=========================================="
echo "   RESTORE SELESAI!"
echo ""
echo "   Services aktif:"
systemctl list-units --type=service --state=running | grep "pb-" | awk '{printf "     ✓ %s\n", $1}'
echo ""
echo "   Langkah selanjutnya:"
echo "   1. Update DNS A record → $(curl -s ifconfig.me 2>/dev/null || echo 'IP_BARU')"
echo "   2. Tunggu DNS propagasi (5-30 menit)"
echo "   3. Caddy auto-generate SSL"
echo "   4. Test: https://ujian.alfaruqasri.my.id"
echo -e "==========================================${NC}"
