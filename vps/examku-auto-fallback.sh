#!/bin/bash
# ============================================================
# EXAMKU AUTO-FALLBACK — penarik otomatis tenant Worker -> Master
# Dijalankan via cron harian di VPS MASTER (disarankan 03:00).
#
# Logika: tenant yang masih di Worker VPS dan masa aktifnya
# tinggal <= 3 hari (atau sudah lewat <= 90 hari) otomatis
# ditarik kembali ke Master VPS agar data aman — tanpa menunggu
# operator klik manual. Mencegah kehilangan data saat VPS worker
# (sewa bulanan dari reseller) mati sewaktu-waktu.
#
# Aman diulang (idempotent): tenant yang sudah di master dilewati.
# ============================================================
set -u

# Kunci anti-overlap (cron vs trigger manual vs klik ganda)
LOCK_FILE="/tmp/examku-auto-fallback.lock"
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "[$(date '+%F %T')] SKIP: job sudah berjalan."
  exit 0
fi

DB_PATH="/opt/pocketbase/master/pb_data/data.db"
MIGRATE_BIN="/usr/local/bin/migrate-tenant.sh"
LOG_FILE="/var/log/examku-auto-fallback.log"
FALLBACK_DAYS=3        # H-3: tarik saat sisa masa aktif <= 3 hari
MAX_EXPIRED_DAYS=90    # tetap tarik yang sudah lewat (maks 90 hari)

log() {
  echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE"
}

if [ ! -f "$DB_PATH" ]; then
  log "ERROR: database master tidak ditemukan: $DB_PATH"
  exit 1
fi
if [ ! -x "$MIGRATE_BIN" ]; then
  log "ERROR: $MIGRATE_BIN tidak ditemukan / tidak executable"
  exit 1
fi

NOW_TS=$(date +%s)
CANDIDATES=$(sqlite3 -separator '|' "$DB_PATH" \
  "SELECT slug, active_until, server_host, name FROM schools \
   WHERE server_host IS NOT NULL AND server_host NOT IN ('127.0.0.1','localhost','') \
   AND active_until IS NOT NULL AND active_until != '';" 2>/dev/null)

if [ -z "$CANDIDATES" ]; then
  log "OK: tidak ada tenant di worker VPS."
  exit 0
fi

migrated=0
skipped=0
failed=0

while IFS='|' read -r slug active_until server_host name; do
  [ -z "$slug" ] && continue
  # active_until format: "2026-11-02 23:59:59.000Z" atau "2026-11-02"
  exp_date=$(echo "$active_until" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
  if [ -z "$exp_date" ]; then
    log "SKIP $slug: format active_until tidak dikenali ($active_until)"
    skipped=$((skipped+1))
    continue
  fi
  exp_ts=$(date -d "$exp_date 23:59:59" +%s 2>/dev/null || echo 0)
  if [ "$exp_ts" = "0" ]; then
    log "SKIP $slug: gagal parse tanggal $exp_date"
    skipped=$((skipped+1))
    continue
  fi
  days_left=$(( (exp_ts - NOW_TS) / 86400 ))

  if [ "$days_left" -gt "$FALLBACK_DAYS" ]; then
    log "SKIP $slug ($name): sisa $days_left hari (> $FALLBACK_DAYS), masih aman di worker $server_host"
    skipped=$((skipped+1))
    continue
  fi
  if [ "$days_left" -lt "-$MAX_EXPIRED_DAYS" ]; then
    log "SKIP $slug ($name): sudah lewat $(( -days_left )) hari, di luar jangkauan auto-fallback (cek manual)"
    skipped=$((skipped+1))
    continue
  fi

  log "MIGRATE $slug ($name): sisa ${days_left} hari, menarik dari $server_host ke master..."
  out=$("$MIGRATE_BIN" "$slug" "127.0.0.1" "to_master" 2>&1)
  rc=$?

  if [ $rc -eq 0 ] && echo "$out" | grep -q '"success": true'; then
    # Verifikasi: service lokal jalan & server_host terupdate
    svc=$(systemctl is-active "pb-${slug}.service" 2>/dev/null || echo "unknown")
    host_now=$(sqlite3 "$DB_PATH" "SELECT server_host FROM schools WHERE slug='$slug';" 2>/dev/null)
    caddy_ok="no"
    grep -q "reverse_proxy localhost:" "/etc/caddy/conf.d/${slug}.caddy" 2>/dev/null && caddy_ok="yes"
    if [ "$host_now" = "127.0.0.1" ] && [ "$caddy_ok" = "yes" ]; then
      log "OK $slug: migrasi terverifikasi (service=$svc, caddy=localhost)"
      migrated=$((migrated+1))
    else
      log "WARN $slug: migrate sukses tapi verifikasi gagal (service=$svc host=$host_now caddy=$caddy_ok) — CEK MANUAL"
      failed=$((failed+1))
    fi
  else
    log "FAIL $slug: $out"
    failed=$((failed+1))
  fi
done <<< "$CANDIDATES"

log "SELESAI: migrated=$migrated skipped=$skipped failed=$failed"
[ "$failed" -gt 0 ] && exit 2
exit 0
