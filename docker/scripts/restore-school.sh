#!/bin/bash

# ==========================================================================
# E-UJIAN DOCKER RESTORE SCRIPT
# ==========================================================================

BACKUP_DIR="/opt/backups/schools"

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.tar.gz>"
    echo "Example: $0 pb_data_sman1_2026-04-16.tar.gz"
    exit 1
fi

FILE="$1"
# Extract School ID from filename (assuming format: pb_data_ID_DATE.tar.gz)
SCHOOL_ID=$(echo "$FILE" | sed -n 's/pb_data_\(.*\)_.*.tar.gz/\1/p')
VOLUME_NAME="pb_data_${SCHOOL_ID}"

if [[ -z "$SCHOOL_ID" ]]; then
    echo "Error: Could not determine School ID from filename."
    exit 1
fi

echo "Restoring $SCHOOL_ID to volume $VOLUME_NAME..."

# 1. Create Volume
docker volume create "$VOLUME_NAME"

# 2. Restore data
docker run --rm \
    -v "$VOLUME_NAME:/data" \
    -v "$BACKUP_DIR:/backup" \
    alpine sh -c "tar xzf /backup/$FILE -C /data"

echo "Restore complete for $SCHOOL_ID."
