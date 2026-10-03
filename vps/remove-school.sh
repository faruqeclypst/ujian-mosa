#!/bin/bash
# ============================================================
# REMOVE SCHOOL TENANT (Support Master VPS & Worker Node)
# Pemakaian: remove-school.sh <slug> [server_host]
# ============================================================
SLUG="${1:-}"
SERVER_HOST="${2:-}"

if [ -z "$SLUG" ]; then
  echo "[remove-school] ERROR: Butuh parameter <slug>" >&2
  exit 1
fi

# Jika SERVER_HOST tidak dioper, coba deteksi dari Caddy config sebelum file dihapus
if [ -z "$SERVER_HOST" ] || [ "$SERVER_HOST" = "127.0.0.1" ] || [ "$SERVER_HOST" = "localhost" ]; then
  CADDY_FILE="/etc/caddy/conf.d/${SLUG}.caddy"
  if [ -f "$CADDY_FILE" ]; then
    DETECTED_HOST=$(grep -oE 'reverse_proxy [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' "$CADDY_FILE" | awk '{print $2}' | head -n 1)
    if [ -n "$DETECTED_HOST" ] && [ "$DETECTED_HOST" != "127.0.0.1" ]; then
      SERVER_HOST="$DETECTED_HOST"
      echo "[remove-school] Auto-detected worker host dari Caddy: $SERVER_HOST"
    fi
  fi
fi

# Normalisasi SERVER_HOST
SERVER_HOST=$(echo "$SERVER_HOST" | tr -d '[:space:]')
if [ -z "$SERVER_HOST" ] || [ "$SERVER_HOST" = "_" ] || [ "$SERVER_HOST" = "-" ]; then
  SERVER_HOST="127.0.0.1"
fi

# 1. Hapus Caddy config di Master VPS
if [ -f "/etc/caddy/conf.d/${SLUG}.caddy" ]; then
  rm -f "/etc/caddy/conf.d/${SLUG}.caddy"
  systemctl reload caddy 2>/dev/null || true
  echo "[remove-school] Caddy reverse proxy untuk $SLUG dihapus"
fi

# 2. Hapus local service & folder jika ada di Master VPS
systemctl stop "pb-${SLUG}.service" 2>/dev/null || true
systemctl disable "pb-${SLUG}.service" 2>/dev/null || true
rm -f "/etc/systemd/system/pb-${SLUG}.service"
systemctl daemon-reload 2>/dev/null || true
rm -rf "/opt/pocketbase/schools/${SLUG}"
# Hapus dari alokasi RAM Balancer jika ada
if [ -f "/usr/local/bin/rambalancer.py" ]; then
  python3 /usr/local/bin/rambalancer.py --remove "$SLUG" >/dev/null 2>&1 || true
fi
echo "[remove-school] Local files & service untuk $SLUG dibersihkan"

# 3. Jika tenant berada di Worker Node, jalankan remove-school di Worker via SSH
if [ "$SERVER_HOST" != "127.0.0.1" ] && [ "$SERVER_HOST" != "localhost" ]; then
  echo "[remove-school] Menghubungi Worker Node ($SERVER_HOST) via SSH..."
  if ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@"$SERVER_HOST" "true" 2>/dev/null; then
    ssh -o BatchMode=yes -o ConnectTimeout=5 root@"$SERVER_HOST" "/usr/local/bin/remove-school.sh '$SLUG'" 2>&1 || true
    echo "[remove-school] OK: Tenant $SLUG berhasil dihapus dari Worker Node $SERVER_HOST"
  else
    echo "[remove-school] Warning: Gagal SSH ke Worker Node $SERVER_HOST, tenant di worker mungkin perlu dihapus manual."
  fi
fi

exit 0
