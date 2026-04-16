#!/bin/bash

# ==========================================================================
# E-UJIAN DOCKER DEPLOYMENT SCRIPT
# ==========================================================================

# Configuration
IMAGE_NAME="pb-school-base"
NETWORK_NAME="pb_network"
INFRA_DIR="./docker/infrastructure"
SCHOOLS_CADDY="${INFRA_DIR}/schools.caddy"

# Check dependencies
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed."
    exit 1
fi

# Input
read -p "School ID (e.g. sman1): " SCHOOL_ID
read -p "Full Domain (e.g. sman1.mosa.id): " DOMAIN

if [[ -z "$SCHOOL_ID" || -z "$DOMAIN" ]]; then
    echo "Error: School ID and Domain are required."
    exit 1
fi

CONTAINER_NAME="pb-${SCHOOL_ID}"
VOLUME_NAME="pb_data_${SCHOOL_ID}"

echo "----------------------------------------------------"
echo "Deploying School: $SCHOOL_ID ($DOMAIN)"
echo "----------------------------------------------------"

# 1. Create Volume if not exists
echo "[1/4] Creating volume: $VOLUME_NAME..."
docker volume create "$VOLUME_NAME"

# 2. Run Container
echo "[2/4] Starting container: $CONTAINER_NAME..."
# We use --restart always to ensure it comes up after VPS reboot
# We expose internal port 8080 and map to nothing directly (rely on Caddy network)
docker run -d \
    --name "$CONTAINER_NAME" \
    --network "$NETWORK_NAME" \
    --restart always \
    -v "$VOLUME_NAME:/pb/pb_data" \
    -e SCHOOL_ID="$SCHOOL_ID" \
    "$IMAGE_NAME"

# 3. Update Caddy Configuration
echo "[3/4] Adding entry to $SCHOOLS_CADDY..."

# Check if entry already exists
if grep -q "$DOMAIN" "$SCHOOLS_CADDY"; then
    echo "Warning: Domain $DOMAIN already exists in Caddy configuration."
else
    cat <<EOF >> "$SCHOOLS_CADDY"

$DOMAIN {
    reverse_proxy $CONTAINER_NAME:8080 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }
    handle_errors {
        rewrite * /error.html
        file_server
    }
}
EOF
fi

# 4. Initialize Database
echo "[4/5] Initializing database (migrations & admin)..."
# We run these commands inside the newly started container
docker exec "$CONTAINER_NAME" /pb/pocketbase migrate up
docker exec "$CONTAINER_NAME" /pb/pocketbase superuser create "admin@mosa.com" "password123456" || echo "Admin already exists."

# 5. Reload Caddy
echo "[5/5] Reloading Caddy..."
docker exec caddy-proxy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

echo "----------------------------------------------------"
echo "SUCCESS! $DOMAIN is now live."
echo "Container: $CONTAINER_NAME"
echo "Data Volume: $VOLUME_NAME"
echo "----------------------------------------------------"
