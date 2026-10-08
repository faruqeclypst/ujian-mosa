#!/bin/bash
# ============================================================
# EXAMKU RESTORE SNAPSHOT — pulihkan data tenant dari snapshot
# harian worker ke VPS master.
#
# Dipakai pada kasus darurat: VPS worker mati mendadak SEBELUM
# auto-fallback H-3 sempat menarik data. Setelah restore, tenant
# jalan di master dan siap dimigrasi 1-klik ke worker baru.
#
# Pemakaian:
#   examku-restore-snapshot.sh <slug> [YYYY-MM-DD] [--force]
# Tanpa tanggal -> pakai snapshot terbaru. --force -> timpa walau
# data live lebih baru dari snapshot (default: ditolak demi aman).
# ============================================================
set -u

SLUG="${1:-}"
DATE_ARG="${2:-}"
FORCE="no"
[ "${3:-}" = "--force" ] || [ "${2:-}" = "--force" ] && FORCE="yes"

DB_PATH="/opt/pocketbase/master/pb_data/data.db"
SNAP_BASE="/opt/pocketbase/worker-snapshots"
LIVE_BASE="/opt/pocketbase/schools"
TEMPLATE_HOOKS="/opt/pocketbase/schools/template/pb_hooks"

if [ -z "$SLUG" ]; then
  echo "Pemakaian: $0 <slug> [YYYY-MM-DD] [--force]"
  exit 1
fi

SNAP_DIR="$SNAP_BASE/$SLUG"
if [ ! -d "$SNAP_DIR" ]; then
  echo "ERROR: tidak ada snapshot untuk slug '$SLUG' di $SNAP_BASE"
  exit 1
fi

if [ -n "$DATE_ARG" ] && [ "$DATE_ARG" != "--force" ]; then
  SNAP="$SNAP_DIR/$DATE_ARG.db"
  [ -f "$SNAP" ] || { echo "ERROR: snapshot $DATE_ARG tidak ditemukan."; exit 1; }
else
  SNAP=$(ls -t "$SNAP_DIR"/*.db 2>/dev/null | head -1)
  [ -n "$SNAP" ] || { echo "ERROR: tidak ada file snapshot."; exit 1; }
fi

echo "[restore] Snapshot: $SNAP"
if [ "$(sqlite3 "$SNAP" 'PRAGMA integrity_check;' 2>/dev/null)" != "ok" ]; then
  echo "ERROR: snapshot korup (integrity_check gagal). Batal."
  exit 1
fi
echo "[restore] integrity_check: ok"

LIVE_DB="$LIVE_BASE/$SLUG/pb_data/data.db"
if [ -f "$LIVE_DB" ] && [ "$LIVE_DB" -nt "$SNAP" ] && [ "$FORCE" != "yes" ]; then
  echo "ERROR: data live LEBIH BARU dari snapshot. Pakai --force untuk memaksa timpa."
  exit 1
fi

# Backup data live yang ada (jika ada)
if [ -f "$LIVE_DB" ]; then
  BAK="$LIVE_DB.bak-$(date +%F-%H%M%S)"
  cp -a "$LIVE_DB" "$BAK" && echo "[restore] backup live: $BAK"
fi

# Siapkan struktur direktori + hooks standar bila belum ada
mkdir -p "$LIVE_BASE/$SLUG/pb_data"
if [ ! -d "$LIVE_BASE/$SLUG/pb_hooks" ] && [ -d "$TEMPLATE_HOOKS" ]; then
  cp -r "$TEMPLATE_HOOKS" "$LIVE_BASE/$SLUG/pb_hooks"
  echo "[restore] pb_hooks disalin dari template"
fi

cp -a "$SNAP" "$LIVE_DB" && echo "[restore] data.db dipulihkan dari snapshot"

# Daftarkan/jalankan tenant di master
INFO=$(sqlite3 -separator '|' "$DB_PATH" \
  "SELECT port, custom_domain, student_quota FROM schools WHERE slug='$SLUG';" 2>/dev/null)
PORT=$(echo "$INFO" | cut -d'|' -f1); [ -z "$PORT" ] && PORT=8091
CDOM=$(echo "$INFO" | cut -d'|' -f2)
QUOTA=$(echo "$INFO" | cut -d'|' -f3); [ -z "$QUOTA" ] && QUOTA=250

/usr/local/bin/add-school.sh "$SLUG" "$PORT" "$CDOM" "$QUOTA" "127.0.0.1" >/dev/null 2>&1
sqlite3 "$DB_PATH" "UPDATE schools SET server_host='127.0.0.1' WHERE slug='$SLUG';" 2>/dev/null
systemctl start "pb-${SLUG}.service" 2>/dev/null || true

SVC=$(systemctl is-active "pb-${SLUG}.service" 2>/dev/null || echo "unknown")
echo "[restore] SELESAI: $SLUG jalan di master (service=$SVC). Siap dimigrasi 1-klik ke worker baru."
