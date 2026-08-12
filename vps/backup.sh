#!/bin/bash
# ============================================================
# EXAM AA — Full VPS Backup Script
# Jalankan sebagai root: bash backup.sh
# Output      : /tmp/examaa-backup-YYYY-MM-DD.tar.gz
# Auto Upload : Google Drive
# ============================================================

set -e

# ============================================================
# COLOR
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

# ============================================================
# VARIABLE
# ============================================================

DATE=$(date +%F)
START_TIME=$(date +"%H:%M:%S")

BACKUP_DIR="/tmp/examaa-backup-${DATE}"
BACKUP_FILE="/tmp/examaa-backup-${DATE}.tar.gz"

TOTAL_STEPS=10
CURRENT_STEP=0

# ============================================================
# PROGRESS BAR
# ============================================================

progress() {
    CURRENT_STEP=$((CURRENT_STEP + 1))

    PCT=$((CURRENT_STEP * 100 / TOTAL_STEPS))

    BAR_LEN=30
    FILLED=$((PCT * BAR_LEN / 100))
    EMPTY=$((BAR_LEN - FILLED))

    BAR=$(printf "%${FILLED}s" | tr ' ' '█')$(printf "%${EMPTY}s" | tr ' ' '░')

    echo -e "\n${CYAN}[${BAR}] ${PCT}%${NC} — $1\n"
}

# ============================================================
# HEADER
# ============================================================

clear

echo ""
echo "=========================================="
echo "        EXAM AA — Backup VPS"
echo "------------------------------------------"
echo "Tanggal Mulai : ${DATE}"
echo "Jam Mulai     : ${START_TIME}"
echo "=========================================="
echo ""

# ============================================================
# PREPARE
# ============================================================

rm -rf "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# ============================================================
# STOP SERVICES
# ============================================================

progress "Menghentikan services..."

systemctl list-units --type=service --state=running | grep "pb-" | awk '{print $1}' | while read svc; do
    systemctl stop "$svc" 2>/dev/null || true
done

sleep 2

log "Services dihentikan"

# ============================================================
# BACKUP POCKETBASE
# ============================================================

progress "Backup PocketBase..."

cp -a /opt/pocketbase "$BACKUP_DIR/pocketbase"

log "PocketBase: $(du -sh /opt/pocketbase | awk '{print $1}')"

# ============================================================
# BACKUP FRONTEND
# ============================================================

progress "Backup frontend..."

cp -a /opt/frontend "$BACKUP_DIR/frontend"

log "Frontend: $(du -sh /opt/frontend | awk '{print $1}')"

# ============================================================
# BACKUP CADDY
# ============================================================

progress "Backup Caddy config..."

mkdir -p "$BACKUP_DIR/caddy"

cp /etc/caddy/Caddyfile "$BACKUP_DIR/caddy/"
cp -a /etc/caddy/conf.d "$BACKUP_DIR/caddy/" 2>/dev/null || true

log "Caddy config OK"

# ============================================================
# BACKUP SYSTEMD
# ============================================================

progress "Backup systemd services..."

mkdir -p "$BACKUP_DIR/systemd"

cp /etc/systemd/system/pb-*.service "$BACKUP_DIR/systemd/" 2>/dev/null || true
cp -a /etc/systemd/system/caddy.service.d "$BACKUP_DIR/systemd/" 2>/dev/null || true

log "$(ls "$BACKUP_DIR/systemd/" 2>/dev/null | wc -l) service files"

# ============================================================
# BACKUP HELPER SCRIPTS
# ============================================================

progress "Backup helper scripts..."

mkdir -p "$BACKUP_DIR/scripts"

cp /usr/local/bin/add-school.sh "$BACKUP_DIR/scripts/" 2>/dev/null || true
cp /usr/local/bin/remove-school.sh "$BACKUP_DIR/scripts/" 2>/dev/null || true
cp /etc/sysctl.d/99-exam-aa.conf "$BACKUP_DIR/" 2>/dev/null || true

log "Scripts & config OK"

# ============================================================
# START SERVICES
# ============================================================

progress "Menjalankan kembali services..."

systemctl list-unit-files --type=service | grep "pb-" | grep enabled | awk '{print $1}' | while read svc; do
    systemctl start "$svc" 2>/dev/null || true
done

systemctl restart caddy

log "Semua services aktif"

# ============================================================
# COMPRESS BACKUP
# ============================================================

progress "Mengompres backup..."

cd /tmp

tar -czf "$BACKUP_FILE" "examaa-backup-${DATE}"

rm -rf "$BACKUP_DIR"

log "Compressed"

# ============================================================
# FILE SIZE
# ============================================================

SIZE=$(du -sh "$BACKUP_FILE" | awk '{print $1}')

# ============================================================
# UPLOAD GOOGLE DRIVE
# ============================================================

progress "Upload ke Google Drive..."

rclone copy "$BACKUP_FILE" gdrive:backup-vps --stats=5s

log "Upload Google Drive selesai"

# ============================================================
# FINISH
# ============================================================

END_TIME=$(date +"%H:%M:%S")

progress "Selesai!"

echo ""
echo -e "${GREEN}=========================================="
echo "           BACKUP SELESAI"
echo "------------------------------------------"
echo "Tanggal      : ${DATE}"
echo "Jam Mulai    : ${START_TIME}"
echo "Jam Selesai  : ${END_TIME}"
echo "File Backup  : ${BACKUP_FILE}"
echo "Ukuran File  : ${SIZE}"
echo "Upload       : Google Drive"
echo "Folder Drive : gdrive:backup-vps"
echo "==========================================${NC}"

echo ""
