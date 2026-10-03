#!/bin/bash
set -e

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

echo "Forwarding to Worker VPS (43.134.175.87)..."
scp -o StrictHostKeyChecking=no /tmp/fast_restore.pb.js root@43.134.175.87:/tmp/fast_restore.pb.js

ssh -o StrictHostKeyChecking=no root@43.134.175.87 '
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
