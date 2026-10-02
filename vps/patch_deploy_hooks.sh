#!/bin/bash
# ============================================================
# PATCH: Deploy Hook notify_school_activated ke Master PB
# Jalankan di VPS sebagai root: bash patch_deploy_hooks.sh
# ============================================================

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[OK]${NC} $1"; }
info() { echo -e "${CYAN}[->]${NC} $1"; }

HOOKS_DIR="/opt/pocketbase/master/pb_hooks"

info "Menulis hook notify_school_activated.pb.js ke $HOOKS_DIR ..."

cat > "$HOOKS_DIR/notify_school_activated.pb.js" << 'HOOKEOF'
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

        const html = '<div style="font-family:Arial,sans-serif;color:#1e293b;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff">'
            + '<div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:28px 24px;color:#ffffff">'
            + '<h1 style="margin:0;font-size:22px;font-weight:bold">Selamat, Akun CBT Anda Siap Digunakan!</h1>'
            + '<p style="margin:8px 0 0;font-size:14px;opacity:.95">Pendaftaran institusi <strong>' + schoolName + '</strong> telah disetujui.</p>'
            + '</div>'
            + '<div style="padding:24px">'
            + '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:20px">'
            + '<h3 style="margin:0 0 12px;font-size:15px;color:#0f172a;font-weight:bold">Kredensial Login Administrator</h3>'
            + '<table style="width:100%;border-collapse:collapse;font-size:13px">'
            + '<tr><td style="padding:6px 0;color:#64748b;width:140px">URL Login Admin</td><td style="padding:6px 0;font-weight:bold"><a href="' + adminUrl + '" style="color:#2563eb">' + adminUrl + '</a></td></tr>'
            + '<tr><td style="padding:6px 0;color:#64748b">Username</td><td style="padding:6px 0;font-weight:bold;font-family:monospace">admin</td></tr>'
            + '<tr><td style="padding:6px 0;color:#64748b">Password Default</td><td style="padding:6px 0;font-weight:bold;font-family:monospace;color:#dc2626">sudahlupa</td></tr>'
            + '</table>'
            + '<div style="margin-top:10px;padding:8px 12px;background:#fef2f2;border-left:3px solid #ef4444;border-radius:4px;font-size:12px;color:#991b1b"><strong>Penting:</strong> Segera ubah password default ini setelah login pertama.</div>'
            + '</div>'
            + '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:20px">'
            + '<h4 style="margin:0 0 8px;font-size:14px;color:#166534;font-weight:bold">Portal Login Siswa / Peserta Ujian</h4>'
            + '<a href="' + studentUrl + '" style="color:#15803d;font-weight:bold;font-size:14px">' + studentUrl + '</a>'
            + '</div>'
            + '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;border:1px solid #e2e8f0">'
            + '<tr style="background:#f8fafc"><td colspan="2" style="padding:10px 14px;font-weight:bold;color:#334155;border-bottom:1px solid #e2e8f0">Rincian Paket Layanan</td></tr>'
            + '<tr><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;width:140px">Paket</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-weight:bold">' + planLabel + '</td></tr>'
            + '<tr><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b">Kuota Peserta</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-weight:bold">' + quota + ' Siswa</td></tr>'
            + '<tr><td style="padding:10px 14px;color:#64748b">Masa Aktif</td><td style="padding:10px 14px;font-weight:bold;color:#2563eb">' + masaAktifStr + '</td></tr>'
            + '</table>'
            + '<div style="text-align:center;margin:24px 0">'
            + '<a href="' + adminUrl + '" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block">Buka Panel Admin CBT</a>'
            + '</div>'
            + '<div style="background:#eff6ff;border:1px dashed #93c5fd;border-radius:10px;padding:16px;text-align:center">'
            + '<p style="margin:0 0 10px;font-size:13px;color:#1e40af">Butuh penambahan kuota, perubahan paket, atau perpanjangan layanan?</p>'
            + '<a href="' + waUrl + '" style="background:#16a34a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;font-size:13px;display:inline-block">Chat WhatsApp Admin (0853-5990-7696)</a>'
            + '</div>'
            + '</div>'
            + '<div style="background:#f8fafc;padding:16px 20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">'
            + 'Email otomatis dari sistem <strong>Examku CBT Online</strong>. Jika tidak merasa mendaftar, abaikan.'
            + '</div>'
            + '</div>';

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
HOOKEOF

log "Hook berhasil ditulis."

info "Restart pb-master service..."
systemctl restart pb-master
sleep 2

systemctl is-active --quiet pb-master \
    && log "pb-master berjalan normal." \
    || echo "GAGAL: pb-master tidak aktif. Cek: journalctl -u pb-master -n 50"

echo ""
echo "=========================================="
echo "PATCH SELESAI"
echo "Cek log real-time: journalctl -u pb-master -f"
echo "=========================================="

