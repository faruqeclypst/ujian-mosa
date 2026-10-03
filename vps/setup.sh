#!/bin/bash
# ============================================================
# EXAM AA SaaS VPS Setup Script (Caddy Version)
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

MASTER_DOMAIN="examku.my.id"                 # Master PocketBase (registry)
SCHOOL1_DOMAIN="modalbangsa.examku.my.id"     # PocketBase SMAN Modal Bangsa
SCHOOL1_SLUG="modalbangsa"

FRONTEND_DOMAIN="*.examku.my.id"              # Wildcard untuk sekolah
LANDING_DOMAIN="examku.my.id"                 # Landing & super admin
ROOT_DOMAIN="examku.my.id"                    # Root domain

# KONFIGURASI TEMPLATE
TEMPLATE_DIR="/opt/pocketbase/schools/template"

EMAIL="admin@examku.my.id"                    # Email untuk SSL otomatis

MASTER_PORT=8090
SCHOOL1_PORT=8091
FRONTEND_PORT=3000

# ============================================================
echo ""
echo "=========================================="
echo "   EXAM AA SaaS VPS Setup (Caddy)"
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

# Kernel Tuning for High Load
info "Tuning kernel for high load..."
cat > /etc/sysctl.d/99-exam-aa.conf << EOF
fs.file-max = 2097152
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535
EOF
sysctl --system

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

    const customDomain = (e.record.get("custom_domain") || "").trim();

    if (isActive) {
        console.log("[Provisioning] Orchestrating:", slug, "on port:", port, "customDomain:", customDomain);
        try { 
            const cmd = customDomain 
                ? "/usr/local/bin/add-school.sh " + slug + " " + port + " " + customDomain
                : "/usr/local/bin/add-school.sh " + slug + " " + port;
            $os.cmd("bash", "-c", cmd).run(); 
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

cat > /opt/pocketbase/master/pb_hooks/notify_new_school_request.pb.js << 'EOF'
// Kirim notifikasi email ke faruq.blogger@gmail.com saat ada pendaftaran institusi baru di school_requests.
onRecordAfterCreateSuccess((e) => {
    try {
        const schoolName = e.record.get("school_name") || "-";
        const slug = e.record.get("slug_request") || "-";
        const email = e.record.get("contact_email") || "-";
        const phone = e.record.get("contact_phone") || "-";
        const address = e.record.get("address") || "-";
        const plan = (e.record.get("plan") || "").trim();
        const duration = e.record.get("duration") || "-";
        const isTrial = plan === "free" || plan.toLowerCase().includes("trial") || plan.toLowerCase().includes("demo");
        const institutionType = e.record.get("type") === "campus" ? "Universitas / Kampus" : "Sekolah";
        const createdDate = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

        let planLabel = "Free Trial (50 Siswa)";
        if (plan === "basic" || plan.toLowerCase().includes("berkembang")) planLabel = "Paket Berkembang (250 Siswa)";
        else if (plan === "pro" || plan.toLowerCase().includes("lanjutan")) planLabel = "Paket Lanjutan (500 Siswa)";
        else if (plan === "ultimate" || plan.toLowerCase().includes("premium")) planLabel = "Paket Premium (1000 Siswa)";
        else if (plan) planLabel = plan;

        const adminUrl = "https://examku.my.id/super_admin";
        const schoolUrl = "https://" + slug + ".examku.my.id";

        const subject = isTrial
            ? "[Examku] Permintaan Free Trial: " + schoolName
            : "[Examku] Pendaftaran Institusi Baru: " + schoolName + " (" + planLabel + " (" + duration + "))";

        const html = `
            <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: ${isTrial ? '#059669' : '#2563eb'}; padding: 20px; color: #ffffff;">
                    <h2 style="margin: 0; font-size: 20px;">${isTrial ? 'Permintaan Free Trial CBT' : 'Pendaftaran Institusi Baru'}</h2>
                    <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">${isTrial ? 'Ada permintaan akun Free Trial CBT baru melalui examku.my.id' : 'Ada permohonan pendaftaran tenant baru melalui examku.my.id'}</p>
                </div>
                
                <div style="padding: 24px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 160px; background-color: #f8fafc;">Jenis Permohonan</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                                <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; background-color: ${isTrial ? '#dcfce7; color: #15803d;' : '#dbeafe; color: #1d4ed8;'}">
                                    ${isTrial ? 'Uji Coba Free Trial (14 Hari)' : 'Langganan Baru'}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Nama Institusi</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${schoolName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Tipe Institusi</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${institutionType}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Subdomain Permintaan</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><a href="${schoolUrl}" style="color: #2563eb; text-decoration: none; font-weight: bold;">${slug}.examku.my.id</a></td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Paket Dipilih</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${planLabel}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Durasi Layanan</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${duration}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Email Kontak</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${email}" style="color: #2563eb;">${email}</a></td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">No. Telepon / WA</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${phone}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Alamat</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${address}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Waktu Registrasi</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${createdDate}</td>
                        </tr>
                    </table>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${adminUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
                            Buka Super Admin Dashboard
                        </a>
                    </div>

                    <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
                        Silakan login ke Super Admin Dashboard untuk meninjau dan menyetujui pendaftaran ini.
                    </p>
                </div>

                <div style="background-color: #f8fafc; padding: 14px 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
                    Notifikasi otomatis dari platform SaaS Examku.
                </div>
            </div>
        `;

        const message = new MailerMessage({
            from: {
                address: $app.settings().meta.senderAddress || "noreply@examku.my.id",
                name: $app.settings().meta.senderName || "Examku System",
            },
            to: [{ address: "faruq.blogger@gmail.com" }],
            subject: subject,
            html: html,
        });

        $app.newMailClient().send(message);
        console.log("[Notification] Email pendaftaran sekolah berhasil dikirim ke faruq.blogger@gmail.com untuk:", schoolName);
    } catch (err) {
        console.log("[Notification] Gagal mengirim notifikasi email:", err);
    }

    return e.next();
}, "school_requests");
EOF

cat > /opt/pocketbase/master/pb_hooks/notify_school_activated.pb.js << 'EOF'
// ============================================================
// PB Hook: Kirim Email Notifikasi Aktivasi Layanan ke Pendaftar Tenant
// Dipicu saat: Record baru dibuat di koleksi "schools"
// ============================================================

onRecordAfterCreateSuccess((e) => {
    try {
        const contactEmail = (e.record.get("contact_email") || "").trim();
        if (!contactEmail || !contactEmail.includes("@")) {
            console.log("[Activation Mail] Dilewati: contact_email kosong atau tidak valid.");
            return e.next();
        }

        const schoolName = e.record.get("name") || "Institusi Anda";
        const slug = e.record.get("slug") || "";
        const customDomain = (e.record.get("custom_domain") || "").trim();
        const plan = e.record.get("plan") || "free";
        const quota = e.record.get("student_quota") || 50;
        const activeUntil = (e.record.get("active_until") || "").trim();

        const primaryDomain = customDomain ? customDomain : (slug + ".examku.my.id");
        const adminUrl = "https://" + primaryDomain + "/admin";
        const studentUrl = "https://" + primaryDomain;
        const waNumber = "6285359907696";

        let planLabel = "Free Trial (50 Siswa)";
        if (plan === "basic") planLabel = "Paket Berkembang (250 Siswa)";
        else if (plan === "pro") planLabel = "Paket Lanjutan (500 Siswa)";
        else if (plan === "ultimate") planLabel = "Paket Premium (1000 Siswa)";

        let masaAktifStr = "Akses Permanen (Tanpa Batas)";
        if (activeUntil) {
            try {
                const match = activeUntil.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (match) {
                    const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
                    const y = match[1];
                    const m = months[parseInt(match[2], 10) - 1];
                    const d = parseInt(match[3], 10);
                    masaAktifStr = d + " " + m + " " + y;
                }
            } catch (err) {}
        }

        const waText = encodeURIComponent(
            "Halo Admin Examku, saya dari " + schoolName + " (" + slug + ".examku.my.id) ingin konsultasi perpanjangan / upgrade paket ujian."
        );
        const waUrl = "https://wa.me/" + waNumber + "?text=" + waText;
        const subject = "[Examku] Layanan CBT Aktif: " + schoolName;

        const html = `
            <div style="font-family:Arial,sans-serif;color:#1e293b;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff">
                <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:28px 24px;color:#ffffff">
                    <div style="display:inline-block;background:rgba(255,255,255,0.2);padding:4px 12px;border-radius:20px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Layanan CBT Aktif</div>
                    <h1 style="margin:0;font-size:22px;font-weight:bold;line-height:1.3">Selamat, Akun CBT Anda Siap Digunakan!</h1>
                    <p style="margin:8px 0 0;font-size:14px;opacity:.95">Pendaftaran institusi <strong>${schoolName}</strong> telah disetujui dan sistem CBT Anda sudah aktif.</p>
                </div>
                <div style="padding:24px">
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:20px">
                        <h3 style="margin:0 0 12px;font-size:15px;color:#0f172a;font-weight:bold">Kredensial Login Administrator</h3>
                        <table style="width:100%;border-collapse:collapse;font-size:13px">
                            <tr><td style="padding:6px 0;color:#64748b;width:140px">URL Login Admin</td><td style="padding:6px 0;font-weight:bold"><a href="${adminUrl}" style="color:#2563eb;text-decoration:none">${adminUrl}</a></td></tr>
                            <tr><td style="padding:6px 0;color:#64748b">Username</td><td style="padding:6px 0;font-weight:bold;font-family:monospace;font-size:14px;color:#0f172a">admin</td></tr>
                            <tr><td style="padding:6px 0;color:#64748b">Password Default</td><td style="padding:6px 0;font-weight:bold;font-family:monospace;font-size:14px;color:#dc2626">sudahlupa</td></tr>
                        </table>
                        <div style="margin-top:10px;padding:8px 12px;background:#fef2f2;border-left:3px solid #ef4444;border-radius:4px;font-size:12px;color:#991b1b"><strong>Penting:</strong> Segera ubah password default ini setelah login pertama kali melalui menu <em>Pengaturan</em>.</div>
                    </div>
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:20px">
                        <h4 style="margin:0 0 8px;font-size:14px;color:#166534;font-weight:bold">Portal Login Siswa / Peserta Ujian</h4>
                        <p style="margin:0 0 6px;font-size:13px;color:#15803d">Bagikan tautan ini kepada peserta ujian:</p>
                        <a href="${studentUrl}" style="color:#15803d;font-weight:bold;font-size:14px;text-decoration:underline">${studentUrl}</a>
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
                        <tr style="background:#f8fafc"><td colspan="2" style="padding:10px 14px;font-weight:bold;color:#334155;border-bottom:1px solid #e2e8f0">Rincian Paket Layanan</td></tr>
                        <tr><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;width:140px">Paket</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-weight:bold;color:#0f172a">${planLabel}</td></tr>
                        <tr><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b">Kuota Peserta</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-weight:bold;color:#0f172a">${quota} Siswa</td></tr>
                        <tr><td style="padding:10px 14px;color:#64748b">Masa Aktif</td><td style="padding:10px 14px;font-weight:bold;color:#2563eb">${masaAktifStr}</td></tr>
                    </table>
                    <div style="text-align:center;margin:24px 0">
                        <a href="${adminUrl}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block">Buka Panel Admin CBT</a>
                    </div>
                    <div style="background:#eff6ff;border:1px dashed #93c5fd;border-radius:10px;padding:16px;text-align:center">
                        <p style="margin:0 0 10px;font-size:13px;color:#1e40af;font-weight:500">Butuh penambahan kuota, perubahan paket, atau perpanjangan layanan?</p>
                        <a href="${waUrl}" style="background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;font-size:13px;display:inline-block">Chat WhatsApp Admin (0853-5990-7696)</a>
                    </div>
                </div>
                <div style="background:#f8fafc;padding:16px 20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">
                    Email ini dikirimkan secara otomatis oleh sistem <strong>Examku CBT Online</strong>.<br/>Jika tidak merasa mendaftar, abaikan email ini.
                </div>
            </div>
        `;

        const message = new MailerMessage({
            from: {
                address: $app.settings().meta.senderAddress || "noreply@examku.my.id",
                name: $app.settings().meta.senderName || "Examku System",
            },
            to: [{ address: contactEmail }],
            subject: subject,
            html: html,
        });

        $app.newMailClient().send(message);
        console.log("[Activation Mail] Email aktivasi terkirim ke:", contactEmail, "untuk:", schoolName);
    } catch (err) {
        console.log("[Activation Mail] Gagal kirim email aktivasi:", err);
    }

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
CUSTOM_DOMAIN=$3

if [ -z "$SLUG" ] || [ -z "$PORT" ]; then exit 1; fi

# Clean custom domain (remove protocols, trailing slashes, whitespace)
CUSTOM_DOMAIN=$(echo "$CUSTOM_DOMAIN" | sed -e 's|^[^/]*//||' -e 's|/.*$||' | tr -d '[:space:]')

if [ -n "$CUSTOM_DOMAIN" ]; then
    DOMAINS="${SLUG}.examku.my.id, ${CUSTOM_DOMAIN}"
else
    DOMAINS="${SLUG}.examku.my.id"
fi

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
LimitNOFILE=65535
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
$DOMAINS {
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
LimitNOFILE=65535
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
    # Performance Tuning
    servers {
        max_header_size 16kb
    }
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
