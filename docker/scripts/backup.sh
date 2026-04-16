#!/bin/bash

# ==========================================================================
# E-UJIAN DOCKER BACKUP SCRIPT
# ==========================================================================

BACKUP_DIR="/opt/backups/schools"
DATE=$(date +%Y-%m-%d)
mkdir -p "$BACKUP_DIR"

echo "Starting Nightly Backup: $DATE"

# 1. Backup Databases (Volumes)
VOLUMES=$(docker volume ls -q --filter "name=pb_data_")

for VOL in $VOLUMES; do
    echo "Backing up volume: $VOL..."
    
    # We use a temporary container to tar the volume
    docker run --rm \
        -v "$VOL:/data" \
        -v "$BACKUP_DIR:/backup" \
        alpine tar czf "/backup/${VOL}_${DATE}.tar.gz" -C /data .
        
    echo "Compressed $VOL to ${VOL}_${DATE}.tar.gz"
done

# 2. Cleanup old backups (optional - keep last 7 days)
find "$BACKUP_DIR" -type f -name "*.tar.gz" -mtime +7 -delete

# 3. Upload to Cloud (Placeholder for Rclone / AWS CLI / R2)
# Example with rclone:
# rclone copy "$BACKUP_DIR" remote:ujian-backups/daily/ -P

echo "Backup process completed."
