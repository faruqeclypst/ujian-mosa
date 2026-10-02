// ============================================================
// PB Hook: Notifikasi Email ke Tenant saat Admin Update Paket/Masa Aktif
// Dipicu saat: Record di koleksi "schools" diupdate
// Hanya kirim email jika plan, student_quota, atau active_until berubah
// ============================================================

onRecordAfterUpdateSuccess((e) => {
    try {
        const contactEmail = String(e.record.get("contact_email") || "").trim();
        if (!contactEmail || !contactEmail.includes("@")) {
            return e.next();
        }

        // Cek apakah ada perubahan yang relevan (plan, quota, masa aktif)
        const oldPlan = String(e.record.original().get("plan") || "");
        const newPlan = String(e.record.get("plan") || "");
        const oldQuota = e.record.original().get("student_quota");
        const newQuota = e.record.get("student_quota");
        const oldUntil = String(e.record.original().get("active_until") || "");
        const newUntil = String(e.record.get("active_until") || "");

        const planChanged  = oldPlan  !== newPlan;
        const quotaChanged = String(oldQuota) !== String(newQuota);
        const dateChanged  = oldUntil.substring(0, 10) !== newUntil.substring(0, 10);

        if (!planChanged && !quotaChanged && !dateChanged) {
            return e.next();
        }

        const schoolName  = String(e.record.get("name") || "Institusi Anda");
        const slug        = String(e.record.get("slug") || "");
        const customDomain = String(e.record.get("custom_domain") || "").trim();
        const waNumber    = "6285359907696";

        const primaryDomain = customDomain ? customDomain : (slug + ".examku.my.id");
        const adminUrl      = "https://" + primaryDomain + "/admin";

        const planLabels = {
            free:    "Free Trial (50 Siswa)",
            basic:   "Paket Berkembang (250 Siswa)",
            pro:     "Paket Lanjutan (500 Siswa)",
            ultimate:"Paket Premium (1000 Siswa)",
        };
        const planLabel = planLabels[newPlan] || newPlan;

        let masaAktifStr = "Akses Permanen (Tanpa Batas)";
        if (newUntil) {
            const match = newUntil.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) {
                const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
                masaAktifStr = parseInt(match[3], 10) + " " + months[parseInt(match[2], 10) - 1] + " " + match[1];
            }
        }

        const waText = encodeURIComponent(
            "Halo Admin Examku, saya dari " + schoolName + " (" + slug + ".examku.my.id) ingin konsultasi paket ujian."
        );
        const waUrl = "https://wa.me/" + waNumber + "?text=" + waText;

        // Buat list perubahan
        let changeRows = "";
        if (planChanged) {
            const oldLabel = planLabels[oldPlan] || oldPlan;
            changeRows += '<tr>'
                + '<td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;width:140px">Paket</td>'
                + '<td style="padding:10px 14px;border-bottom:1px solid #f1f5f9">'
                + '<span style="text-decoration:line-through;color:#94a3b8;font-size:12px">' + oldLabel + '</span>'
                + ' &rarr; <strong style="color:#0f172a">' + planLabel + '</strong>'
                + '</td>'
                + '</tr>';
        }
        if (quotaChanged) {
            changeRows += '<tr>'
                + '<td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b">Kuota Peserta</td>'
                + '<td style="padding:10px 14px;border-bottom:1px solid #f1f5f9">'
                + '<span style="text-decoration:line-through;color:#94a3b8;font-size:12px">' + oldQuota + ' Siswa</span>'
                + ' &rarr; <strong style="color:#0f172a">' + newQuota + ' Siswa</strong>'
                + '</td>'
                + '</tr>';
        }
        if (dateChanged) {
            let oldDateStr = "Permanen";
            if (oldUntil) {
                const om = oldUntil.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (om) {
                    const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
                    oldDateStr = parseInt(om[3], 10) + " " + months[parseInt(om[2], 10) - 1] + " " + om[1];
                }
            }
            changeRows += '<tr>'
                + '<td style="padding:10px 14px;color:#64748b">Masa Aktif</td>'
                + '<td style="padding:10px 14px">'
                + '<span style="text-decoration:line-through;color:#94a3b8;font-size:12px">' + oldDateStr + '</span>'
                + ' &rarr; <strong style="color:#2563eb">' + masaAktifStr + '</strong>'
                + '</td>'
                + '</tr>';
        }

        const subject = "[Examku] Paket Layanan CBT Diperbarui: " + schoolName;

        const html = '<div style="font-family:Arial,sans-serif;color:#1e293b;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff">'
            + '<div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:28px 24px;color:#ffffff">'
            + '<div style="display:inline-block;background:rgba(255,255,255,0.2);padding:4px 12px;border-radius:20px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Pembaruan Paket</div>'
            + '<h1 style="margin:0;font-size:22px;font-weight:bold;line-height:1.3">Paket Layanan CBT Anda Diperbarui</h1>'
            + '<p style="margin:8px 0 0;font-size:14px;opacity:.95">Admin telah memperbarui konfigurasi layanan untuk <strong>' + schoolName + '</strong>.</p>'
            + '</div>'
            + '<div style="padding:24px">'
            + '<p style="margin:0 0 16px;font-size:13px;color:#475569">Berikut adalah perubahan yang telah diterapkan pada akun CBT Anda:</p>'
            + '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">'
            + '<tr style="background:#f8fafc"><td colspan="2" style="padding:10px 14px;font-weight:bold;color:#334155;border-bottom:1px solid #e2e8f0">Rincian Perubahan</td></tr>'
            + changeRows
            + '</table>'
            + '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:20px">'
            + '<p style="margin:0 0 4px;font-size:13px;color:#166534;font-weight:bold">Akses Admin Anda</p>'
            + '<a href="' + adminUrl + '" style="color:#15803d;font-size:13px">' + adminUrl + '</a>'
            + '</div>'
            + '<div style="background:#eff6ff;border:1px dashed #93c5fd;border-radius:10px;padding:16px;text-align:center">'
            + '<p style="margin:0 0 10px;font-size:13px;color:#1e40af">Ada pertanyaan tentang paket atau ingin upgrade/perpanjang?</p>'
            + '<a href="' + waUrl + '" style="background:#16a34a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;font-size:13px;display:inline-block">Chat WhatsApp Admin (0853-5990-7696)</a>'
            + '</div>'
            + '</div>'
            + '<div style="background:#f8fafc;padding:16px 20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">'
            + 'Email otomatis dari sistem <strong>Examku CBT Online</strong>. Jika tidak mengenali akun ini, abaikan.'
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
        console.log("[Update Mail] Notifikasi perubahan paket terkirim ke:", contactEmail, "untuk:", schoolName);
    } catch (err) {
        console.log("[Update Mail] Gagal kirim notifikasi perubahan:", err);
    }

    return e.next();
}, "schools");
