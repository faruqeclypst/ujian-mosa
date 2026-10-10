#!/bin/bash
# ============================================================
# SYNC ALL TENANTS — 1-CLICK HOOKS & SCHEMA SYNC
# Menyelaraskan seluruh tenant di Master VPS dan Worker VPS
# ============================================================
set -u

TEMPLATE_DIR="/opt/pocketbase/schools/template"
MASTER_SCHOOLS_DIR="/opt/pocketbase/schools"

# Baca IP dari infra.conf (disalin ke /opt/pocketbase/infra.conf saat setup)
INFRA_CONF="/opt/pocketbase/infra.conf"
WORKER_IP="43.134.175.87"
WORKER_USER="root"
if [ -f "$INFRA_CONF" ]; then
  # shellcheck disable=SC1090
  . "$INFRA_CONF"
fi
WORKER_HOST="${WORKER_USER}@${WORKER_IP}"

# Pastikan folder template ada
if [ ! -d "$TEMPLATE_DIR" ]; then
  echo '{"success": false, "error": "Folder template di /opt/pocketbase/schools/template tidak ditemukan."}'
  exit 1
fi

MASTER_UPDATED=()
WORKER_UPDATED=()

# 1. Jalankan migrasi schema dan sinkronkan Hooks ke seluruh tenant di Master VPS
python3 /usr/local/bin/migrate-tenant-schema.py 2>/dev/null || true

for dir in "$MASTER_SCHOOLS_DIR"/*; do
  if [ -d "$dir/pb_hooks" ] && [ "$dir" != "$TEMPLATE_DIR" ]; then
    slug=$(basename "$dir")
    cp -r "$TEMPLATE_DIR/pb_hooks"/* "$dir/pb_hooks/" 2>/dev/null || true
    chown -R ubuntu:ubuntu "$dir/pb_hooks" 2>/dev/null || true
    systemctl restart "pb-${slug}" 2>/dev/null || true
    MASTER_UPDATED+=("$slug")
  fi
done

# 2. Sinkronkan template & hooks ke Worker VPS jika SSH aktif secara dinamis
WORKER_SUCCESS=false
if ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$WORKER_HOST" "true" 2>/dev/null; then
  # Rsync template ke Worker
  rsync -avz --delete "$TEMPLATE_DIR/" "$WORKER_HOST":"$TEMPLATE_DIR/" >/dev/null 2>&1

  # Eksekusi migrasi schema, sinkronisasi hooks & restart service di Worker VPS secara dinamis
  ssh -o BatchMode=yes -o ConnectTimeout=5 "$WORKER_HOST" '
    python3 /usr/local/bin/migrate-tenant-schema.py 2>/dev/null || true
    for dir in /opt/pocketbase/schools/*; do
      if [ -d "$dir/pb_hooks" ] && [ "$dir" != "/opt/pocketbase/schools/template" ]; then
        slug=$(basename "$dir")
        cp -r /opt/pocketbase/schools/template/pb_hooks/* "$dir/pb_hooks/" 2>/dev/null || true
        chown -R ubuntu:ubuntu "$dir/pb_hooks" 2>/dev/null || true
        systemctl restart "pb-${slug}" 2>/dev/null || true
      fi
    done
  ' >/dev/null 2>&1
  WORKER_SUCCESS=true
fi

# Format output JSON
MASTER_JSON=$(printf '"%s",' "${MASTER_UPDATED[@]}" | sed 's/,$//')
echo "{\"success\": true, \"message\": \"Seluruh tenant di Master VPS & Worker Node berhasil disinkronkan secara dinamis!\", \"worker_synced\": $WORKER_SUCCESS, \"master_tenants\": [${MASTER_JSON}]}"
exit 0
