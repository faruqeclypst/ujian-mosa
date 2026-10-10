#!/bin/bash
set -e

# IP terpusat — edit vps/infra.conf (disalin ke /opt/pocketbase/infra.conf)
INFRA_CONF="/opt/pocketbase/infra.conf"
WORKER_IP="43.134.175.87"
WORKER_USER="root"
[ -f "$INFRA_CONF" ] && . "$INFRA_CONF"
WORKER_HOST="${WORKER_USER}@${WORKER_IP}"

echo "Deploying fast_restore.pb.js to schools on Master VPS..."
for dir in /opt/pocketbase/schools/*; do
  if [ -d "$dir/pb_hooks" ]; then
    cp /tmp/fast_restore.pb.js "$dir/pb_hooks/fast_restore.pb.js"
    chown -R ubuntu:ubuntu "$dir/pb_hooks" 2>/dev/null || true
    echo "  Updated $dir/pb_hooks/fast_restore.pb.js"
  fi
done

echo "Restarting Master pb services..."
systemctl restart pb-modalbangsa pb-sman1-ungar 2>/dev/null || true

echo "Forwarding to Worker VPS ($WORKER_IP)..."
scp -o StrictHostKeyChecking=no /tmp/fast_restore.pb.js $WORKER_HOST:/tmp/fast_restore.pb.js

ssh -o StrictHostKeyChecking=no $WORKER_HOST '
for dir in /opt/pocketbase/schools/*; do
  if [ -d "$dir/pb_hooks" ]; then
    cp /tmp/fast_restore.pb.js "$dir/pb_hooks/fast_restore.pb.js"
    chown -R ubuntu:ubuntu "$dir/pb_hooks" 2>/dev/null || true
    echo "  Worker updated $dir/pb_hooks/fast_restore.pb.js"
  fi
done
systemctl restart pb-uinsya 2>/dev/null || true
'

echo "=== DEPLOY FAST HOOKS DONE ==="
