#!/bin/bash

# ==========================================================================
# E-UJIAN DOCKER DEPLOYMENT SCRIPT (MODIFIED FOR AUTOMATION)
# ==========================================================================

# Configuration
IMAGE_NAME="pb-school-base"
NETWORK_NAME="pb_network"
INFRA_DIR="/pb/infrastructure" # Path inside container
# If running outside container, fallback to local path
if [ ! -d "$INFRA_DIR" ]; then
    INFRA_DIR="./docker/infrastructure"
fi
SCHOOLS_CADDY="${INFRA_DIR}/schools.caddy"

# Input via Arguments or Prompts
SCHOOL_ID=${1:-""}
DOMAIN=${2:-""}

if [[ -z "$SCHOOL_ID" ]]; then
    read -p "School ID (e.g. sman1): " SCHOOL_ID
fi

if [[ -z "$DOMAIN" ]]; then
    read -p "Full Domain (e.g. sman1.mosa.id): " DOMAIN
fi

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
docker volume create "$VOLUME_NAME"

# 2. Run Container
# Remove existing if exists
docker rm -f "$CONTAINER_NAME" 2>/dev/null

docker run -d \
    --name "$CONTAINER_NAME" \
    --network "$NETWORK_NAME" \
    --restart always \
    -v "$VOLUME_NAME:/pb/pb_data" \
    -e SCHOOL_ID="$SCHOOL_ID" \
    "$IMAGE_NAME"

# 3. Update Caddy Configuration
if grep -q "$DOMAIN" "$SCHOOLS_CADDY"; then
    echo "Warning: Domain $DOMAIN already exists."
else
    cat <<EOF >> "$SCHOOLS_CADDY"

$DOMAIN {
    reverse_proxy $CONTAINER_NAME:8080 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }
}
EOF
fi

# 4. Initialize Database
docker exec "$CONTAINER_NAME" /pb/pocketbase migrate up
# Default admin for new schools
docker exec "$CONTAINER_NAME" /pb/pocketbase superuser create "admin@mosa.com" "password123456" 2>/dev/null

# 5. Reload Caddy
docker exec caddy-proxy caddy reload --config /etc/caddy/Caddyfile

echo "SUCCESS: $DOMAIN is live."
