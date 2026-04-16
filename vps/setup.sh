#!/bin/bash
# ============================================================
# E-Ujian SaaS VPS Setup Script (Caddy Version)
# Ubuntu 24.04 LTS
# Jalankan sebagai root: bash setup.sh
# ============================================================

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ============================================================
# KONFIGURASI — Sesuaikan sebelum menjalankan
# ============================================================
PB_VERSION="0.36.9"
PB_URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"

MASTER_DOMAIN="db.alfaruqasri.my.id"          # Master PocketBase (registry)
SCHOOL1_DOMAIN="db-sman.alfaruqasri.my.id"    # PocketBase SMAN Modal Bangsa
SCHOOL1_SLUG="sman-modalbangsa"

FRONTEND_DOMAIN="*.alfaruqasri.my.id"        # Wildcard untuk sekolah
LANDING_DOMAIN="ujian.alfaruqasri.my.id"     # Landing & super admin
ROOT_DOMAIN="alfaruqasri.my.id"              # Root domain

# KONFIGURASI TEMPLATE
TEMPLATE_DIR="/opt/pocketbase/schools/template"

EMAIL="admin@alfaruqasri.my.id"               # Email untuk SSL otomatis

MASTER_PORT=8090
SCHOOL1_PORT=8091
FRONTEND_PORT=3000

# ============================================================
echo ""
echo "=========================================="
echo "   E-Ujian SaaS VPS Setup (Caddy)"
echo "   IP: $(curl -s ifconfig.me)"
echo "=========================================="
echo ""

# ============================================================
# 1. UPDATE SISTEM & INSTALL CADDY
# ============================================================
info "Update sistem & install Caddy..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl wget unzip ufw debian-keyring debian-archive-keyring apt-transport-https

# Install Caddy
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install caddy -y

# Hapus Nginx jika terpasang
systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true

# ============================================================
# 2. BUAT FOLDER STRUKTUR
# ============================================================
info "Membuat struktur folder..."

mkdir -p /opt/pocketbase/master/pb_hooks
mkdir -p /opt/pocketbase/master/pb_data
mkdir -p "$TEMPLATE_DIR"
mkdir -p /opt/pocketbase/schools/${SCHOOL1_SLUG}
mkdir -p /opt/frontend/ujian/dist
mkdir -p /etc/caddy/conf.d

log "Folder struktur selesai"

# Download PocketBase
info "Download PocketBase v${PB_VERSION}..."
wget -q --show-progress -O /tmp/pb.zip "${PB_URL}"
systemctl stop pb-master 2>/dev/null || true
unzip -o /tmp/pb.zip -d /opt/pocketbase/master/ > /dev/null
chmod +x /opt/pocketbase/master/pocketbase
cp /opt/pocketbase/master/pocketbase "$TEMPLATE_DIR/pocketbase"
chmod +x "$TEMPLATE_DIR/pocketbase"
rm /tmp/pb.zip

# ============================================================
# 3. PB HOOKS — Master PB (Provisioning Automation)
# ============================================================
info "Memasang PB Hooks Master..."
cat > /opt/pocketbase/master/pb_hooks/provisioning.pb.js << 'EOF'
// ============================================================
// Master Provisioning Trigger
// ============================================================
const triggerProvisioning = (e) => {
    const isActive = e.record.get("is_active");
    const slug = e.record.get("slug");
    let port = e.record.get("port");

    if (!port || port === 0) {
        const schools = $app.findRecordsByFilter("schools", "port > 0", "-port", 1);
        let nextPort = 8091;
        if (schools.length > 0) nextPort = schools[0].get("port") + 1;
        e.record.set("port", nextPort);
        $app.save(e.record);
        port = nextPort;
    }

    if (isActive) {
        console.log("[Provisioning] Orchestrating:", slug, "on port:", port);
        try { 
            $os.cmd("bash", "-c", "/usr/local/bin/add-school.sh " + slug + " " + port).run(); 
        } catch (err) { console.log("[Provisioning] Error:", err); }
    }
    return e.next();
};

onRecordAfterCreateSuccess(triggerProvisioning, "schools");
onRecordAfterUpdateSuccess(triggerProvisioning, "schools");

onRecordAfterDeleteSuccess((e) => {
    const slug = e.record.get("slug");
    console.log("[Provisioning] Cleaning up:", slug);
    try { $os.cmd("bash", "-c", "/usr/local/bin/remove-school.sh " + slug).run(); } catch (err) {}
    return e.next();
}, "schools");
EOF

# ============================================================
# 4. HELPER SCRIPTS
# ============================================================
info "Membuat helper scripts (Caddy version)..."

cat > /usr/local/bin/add-school.sh << 'EOF'
#!/bin/bash
SLUG=$1
PORT=$2
DOMAIN="${SLUG}.alfaruqasri.my.id"

if [ -z "$SLUG" ] || [ -z "$PORT" ]; then exit 1; fi

TEMPLATE_DIR="/opt/pocketbase/schools/template"
TARGET_DIR="/opt/pocketbase/schools/$SLUG"

if [ ! -d "$TARGET_DIR" ]; then
    mkdir -p "$TARGET_DIR"
    cp -r "$TEMPLATE_DIR"/* "$TARGET_DIR/"
    chmod +x "$TARGET_DIR/pocketbase"
fi

# Systemd Service
cat > /etc/systemd/system/pb-${SLUG}.service << SERVICEOF
[Unit]
Description=PocketBase School - ${SLUG}
After=network.target

[Service]
Type=simple
Restart=always
RestartSec=5
User=root
WorkingDirectory=$TARGET_DIR
ExecStart=$TARGET_DIR/pocketbase serve --http="127.0.0.1:${PORT}" --dir=$TARGET_DIR/pb_data --hooksDir=$TARGET_DIR/pb_hooks

[Install]
WantedBy=multi-user.target
SERVICEOF

systemctl daemon-reload
systemctl enable "pb-${SLUG}.service"
systemctl restart "pb-${SLUG}.service"

# Caddy Config
cat > /etc/caddy/conf.d/${SLUG}.caddy << CADDYEOF
$DOMAIN {
    root * /opt/frontend/ujian/dist
    file_server
    handle /api/* {
        reverse_proxy localhost:$PORT
    }
    handle /_* {
        reverse_proxy localhost:$PORT
    }
    handle {
        try_files {path} /index.html
    }
}
CADDYEOF

systemctl reload caddy
EOF
chmod +x /usr/local/bin/add-school.sh

# Script Remove
cat > /usr/local/bin/remove-school.sh << 'EOF'
#!/bin/bash
SLUG=$1
if [ -z "$SLUG" ]; then exit 1; fi
systemctl stop "pb-${SLUG}.service" 2>/dev/null || true
systemctl disable "pb-${SLUG}.service" 2>/dev/null || true
rm -f "/etc/systemd/system/pb-${SLUG}.service"
rm -f "/etc/caddy/conf.d/${SLUG}.caddy"
systemctl daemon-reload
systemctl reload caddy
rm -rf "/opt/pocketbase/schools/${SLUG}"
EOF
chmod +x /usr/local/bin/remove-school.sh

# ============================================================
# 5. INITIALIZE MASTER PB & WILDCARD CADDY
# ============================================================
info "Konfigurasi pb-master..."
cat > /etc/systemd/system/pb-master.service << EOF
[Unit]
Description=PocketBase Master (Registry Sekolah)
After=network.target

[Service]
Type=simple
Restart=always
RestartSec=5
User=root
WorkingDirectory=/opt/pocketbase/master
ExecStart=/opt/pocketbase/master/pocketbase serve --http="127.0.0.1:${MASTER_PORT}" --dir=/opt/pocketbase/master/pb_data --hooksDir=/opt/pocketbase/master/pb_hooks

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pb-master && systemctl restart pb-master

# Konfigurasi Caddy Utama
cat > /etc/caddy/Caddyfile << EOF
{
    email ${EMAIL}
}

import /etc/caddy/conf.d/*.caddy

${MASTER_DOMAIN} {
    reverse_proxy localhost:${MASTER_PORT}
}

${LANDING_DOMAIN} {
    root * /opt/frontend/ujian/dist
    file_server
    try_files {path} /index.html
}

${ROOT_DOMAIN} {
    redir https://${LANDING_DOMAIN}{uri}
}
EOF

systemctl enable caddy && systemctl restart caddy

# Inisialisasi sekolah pertama
bash /usr/local/bin/add-school.sh "${SCHOOL1_SLUG}" "${SCHOOL1_PORT}"

# ============================================================
# 6. FIREWALL
# ============================================================
info "Konfigurasi firewall (UFW)..."
ufw --force reset
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "SETUP SELESAI!"
echo "Master PB: https://${MASTER_DOMAIN}"
echo "School 1:  https://${SCHOOL1_DOMAIN}"
echo "Landing:   https://${LANDING_DOMAIN}"
