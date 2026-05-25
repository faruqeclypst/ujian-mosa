#!/bin/bash
# ============================================================
# EXAM AA — Full VPS Backup Script
# Jalankan sebagai root: bash backup.sh
# Output: /tmp/examaa-backup-YYYY-MM-DD.tar.gz
# ============================================================

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

DATE=$(date +%F)
BACKUP_DIR="/tmp/examaa-backup-${DATE}"
BACKUP_FILE="/tmp/examaa-backup-${DATE}.tar.gz"

echo ""
echo "=========================================="
echo "   EXAM AA — Backup VPS"
echo "   Tanggal: ${DATE}"
echo "=========================================="
echo ""

# Bersihkan backup lama
rm -rf "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# ============================================================
# 1. STOP SERVICES (opsional, untuk konsistensi data)
# ============================================================
info "Menghentikan services sementara untuk konsistensi data..."
# Hentikan semua PocketBase agar database tidak corrupt saat di-copy
systemctl list-units --type=service --state=running | grep "pb-" | awk '{print $1}' | while read svc; do
    systemctl stop "$svc" 2>/dev/null || true
done
sleep 2
log "Services dihentikan"

# ============================================================
# 2. BACKUP POCKETBASE DATA
# ============================================================
info "Backup PocketBase (master + semua sekolah)..."
cp -a /opt/pocketbase "$BACKUP_DIR/pocketbase"
log "PocketBase data: $(du -sh /opt/pocketbase | awk '{print $1}')"

# ============================================================
# 3. BACKUP FRONTEND
# ============================================================
info "Backup frontend dist..."
cp -a /opt/frontend "$BACKUP_DIR/frontend"
log "Frontend: $(du -sh /opt/frontend | awk '{print $1}')"

# ============================================================
# 4. BACKUP CADDY CONFIG
# ============================================================
info "Backup Caddy config..."
mkdir -p "$BACKUP_DIR/caddy"
cp /etc/caddy/Caddyfile "$BACKUP_DIR/caddy/"
cp -a /etc/caddy/conf.d "$BACKUP_DIR/caddy/" 2>/dev/null || true
log "Caddy config backed up"

# ============================================================
# 5. BACKUP SYSTEMD SERVICES
# ============================================================
info "Backup systemd services..."
mkdir -p "$BACKUP_DIR/systemd"
cp /etc/systemd/system/pb-*.service "$BACKUP_DIR/systemd/" 2>/dev/null || true
log "$(ls "$BACKUP_DIR/systemd/" | wc -l) service files"

# ============================================================
# 6. BACKUP HELPER SCRIPTS
# ============================================================
info "Backup helper scripts..."
mkdir -p "$BACKUP_DIR/scripts"
cp /usr/local/bin/add-school.sh "$BACKUP_DIR/scripts/" 2>/dev/null || true
cp /usr/local/bin/remove-school.sh "$BACKUP_DIR/scripts/" 2>/dev/null || true
log "Helper scripts backed up"

# ============================================================
# 7. BACKUP KERNEL TUNING
# ============================================================
cp /etc/sysctl.d/99-exam-aa.conf "$BACKUP_DIR/" 2>/dev/null || true

# ============================================================
# 8. RESTART SERVICES
# ============================================================
info "Menjalankan kembali services..."
systemctl list-unit-files --type=service | grep "pb-" | grep enabled | awk '{print $1}' | while read svc; do
    systemctl start "$svc" 2>/dev/null || true
done
systemctl restart caddy
log "Semua services kembali aktif"

# ============================================================
# 9. COMPRESS
# ============================================================
info "Mengompres backup..."
cd /tmp && tar -czf "$BACKUP_FILE" "examaa-backup-${DATE}"
rm -rf "$BACKUP_DIR"

SIZE=$(du -sh "$BACKUP_FILE" | awk '{print $1}')
log "Backup selesai: $BACKUP_FILE ($SIZE)"
echo ""
echo "=========================================="
echo "   Download dengan:"
echo "   scp root@IP:${BACKUP_FILE} ."
echo "=========================================="
