#!/bin/bash
# ============================================================
# EXAMKU BACKUP WORKER — snapshot harian database tenant worker
# Dijalankan via cron harian di VPS MASTER (disarankan 02:00).
#
# Untuk setiap tenant di Worker VPS: buat snapshot konsisten via
# `sqlite3 .backup` di sisi worker (TANPA hentikan layanan),
# lalu rsync ke master. Retensi 7 hari.
# Lapisan pertahanan kedua bila VPS worker mati mendadak di luar
# siklus billing (auto-fallback H-3 menangani siklus billing).
# ============================================================
set -u

DB_PATH="/opt/pocketbase/master/pb_data/data.db"
SNAP_BASE="/opt/pocketbase/worker-snapshots"
LOG_FILE="/var/log/examku-backup-workers.log"
RETENTION_DAYS=7
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no"
RSYNC_RSH="ssh $SSH_OPTS"

log() {
  echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE"
}

if [ ! -f "$DB_PATH" ]; then
  log "ERROR: database master tidak ditemukan: $DB_PATH"
  exit 1
fi

mkdir -p "$SNAP_BASE"

WORKERS=$(sqlite3 "$DB_PATH" \
  "SELECT DISTINCT server_host FROM schools \
   WHERE server_host IS NOT NULL AND server_host NOT IN ('127.0.0.1','localhost','');" 2>/dev/null)

if [ -z "$WORKERS" ]; then
  log "OK: tidak ada worker VPS terdaftar."
  exit 0
fi

ok=0
fail=0

for worker in $WORKERS; do
  slugs=$(sqlite3 -separator ' ' "$DB_PATH" \
    "SELECT slug FROM schools WHERE server_host='$worker';" 2>/dev/null)
  for slug in $slugs; do
    [ -z "$slug" ] && continue
    day=$(date +%F)
    dest_dir="$SNAP_BASE/$slug"
    mkdir -p "$dest_dir"
    dest="$dest_dir/$day.db"

    # 1. Snapshot konsisten di sisi worker
    if ! ssh $SSH_OPTS "root@$worker" \
      "sqlite3 '/opt/pocketbase/schools/$slug/pb_data/data.db' \".backup '/tmp/${slug}-snap.db'\" 2>/dev/null && test -s '/tmp/${slug}-snap.db'" 2>/dev/null; then
      log "FAIL $slug@$worker: gagal buat snapshot (worker tidak terjangkau / db bermasalah)"
      fail=$((fail+1))
      continue
    fi
    # 2. Tarik ke master + verifikasi integritas
    if rsync -az -e "$RSYNC_RSH" "root@$worker:/tmp/${slug}-snap.db" "$dest" 2>/dev/null \
       && [ -s "$dest" ] \
       && [ "$(sqlite3 "$dest" 'PRAGMA integrity_check;' 2>/dev/null)" = "ok" ]; then
      size=$(du -h "$dest" | cut -f1)
      log "OK $slug@$worker: snapshot $day ($size)"
      ok=$((ok+1))
    else
      log "FAIL $slug@$worker: rsync / integrity_check gagal"
      rm -f "$dest"
      fail=$((fail+1))
    fi
    # 3. Bersihkan file sementara di worker
    ssh $SSH_OPTS "root@$worker" "rm -f '/tmp/${slug}-snap.db'" 2>/dev/null || true
  done
done

# Rotasi: hapus snapshot > 7 hari
find "$SNAP_BASE" -name '*.db' -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

log "SELESAI: ok=$ok fail=$fail (retensi ${RETENTION_DAYS} hari di $SNAP_BASE)"
[ "$fail" -gt 0 ] && exit 2
exit 0
