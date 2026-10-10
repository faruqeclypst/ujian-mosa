#!/bin/bash
set -e

# IP terpusat — edit vps/infra.conf (disalin ke /opt/pocketbase/infra.conf)
INFRA_CONF="/opt/pocketbase/infra.conf"
WORKER_IP="43.134.175.87"
WORKER_USER="root"
[ -f "$INFRA_CONF" ] && . "$INFRA_CONF"
WORKER_HOST="${WORKER_USER}@${WORKER_IP}"

echo "Deploying master_infra.pb.js..."
cp /tmp/master_infra.pb.js /opt/pocketbase/master/pb_hooks/master_infra.pb.js
systemctl restart pb-master

echo "Deploying vps_status.pb.js to schools on Master VPS..."
for dir in /opt/pocketbase/schools/*; do
  if [ -d "$dir/pb_hooks" ]; then
    cp /tmp/vps_status.pb.js "$dir/pb_hooks/vps_status.pb.js"
    chown -R ubuntu:ubuntu "$dir/pb_hooks" 2>/dev/null || true
    echo "  Updated $dir/pb_hooks/vps_status.pb.js"
  fi
done

echo "Restarting Master PB school services..."
systemctl restart pb-modalbangsa pb-sman1-ungar 2>/dev/null || true

echo "Forwarding to Worker VPS ($WORKER_IP)..."
scp -o StrictHostKeyChecking=no /tmp/vps_status.pb.js $WORKER_HOST:/tmp/vps_status.pb.js

ssh -o StrictHostKeyChecking=no $WORKER_HOST '
for dir in /opt/pocketbase/schools/*; do
  if [ -d "$dir/pb_hooks" ]; then
    cp /tmp/vps_status.pb.js "$dir/pb_hooks/vps_status.pb.js"
    chown -R ubuntu:ubuntu "$dir/pb_hooks" 2>/dev/null || true
    echo "  Worker updated $dir/pb_hooks/vps_status.pb.js"
  fi
done
systemctl restart pb-uinsya 2>/dev/null || true
'

echo "=== DEPLOY VPS HOOKS DONE ==="
