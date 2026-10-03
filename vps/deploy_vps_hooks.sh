#!/bin/bash
set -e

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

echo "Forwarding to Worker VPS (43.134.175.87)..."
scp -o StrictHostKeyChecking=no /tmp/vps_status.pb.js root@43.134.175.87:/tmp/vps_status.pb.js

ssh -o StrictHostKeyChecking=no root@43.134.175.87 '
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
