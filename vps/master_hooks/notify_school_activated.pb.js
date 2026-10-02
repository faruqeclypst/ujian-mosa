// ============================================================
// PB Hook: Kirim Email Notifikasi Aktivasi Layanan ke Pendaftar Tenant
// Dipicu saat: Record baru dibuat di koleksi "schools"
// ============================================================

onRecordAfterCreateSuccess((e) => {
    try {
        const contactEmail = String(e.record.get("contact_email") || "").trim();
        if (!contactEmail || !contactEmail.includes("@")) {
            console.log("[Activation Mail] Dilewati: contact_email kosong atau tidak valid.");
            return e.next();
        }

        const schoolName = e.record.get("name") || "Institusi Anda";
        const slug = e.record.get("slug") || "";
        const customDomain = String(e.record.get("custom_domain") || "").trim();
        const plan = String(e.record.get("plan") || "free");
        const quota = e.record.get("student_quota") || 50;
        const activeUntil = String(e.record.get("active_until") || "").trim();

        // Tentukan URL
        const primaryDomain = customDomain ? customDomain : (slug + ".examku.my.id");
        const adminUrl = "https://" + primaryDomain + "/admin";
        const studentUrl = "https://" + primaryDomain;
        const waNumber = "6285359907696";

        // Label Paket
        let planLabel = "Free Trial (50 Siswa)";
        if (plan === "basic") planLabel = "Paket Berkembang (250 Siswa)";
        else if (plan === "pro") planLabel = "Paket Lanjutan (500 Siswa)";
        else if (plan === "ultimate") planLabel = "Paket Premium (1000 Siswa)";

        // Format Masa Aktif
        let masaAktifStr = "Akses Permanen (Tanpa Batas)";
        if (activeUntil) {
            try {
                const match = activeUntil.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (match) {
                    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
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
            <div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 28px 24px; color: #ffffff;">
                    <div style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                        Layanan CBT Aktif
                    </div>
                    <h1 style="margin: 0; font-size: 22px; font-weight: bold; line-height: 1.3;">Selamat, Akun CBT Anda Siap Digunakan!</h1>
                    <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.95;">
                        Pendaftaran institusi <strong>${schoolName}</strong> telah disetujui dan sistem CBT Anda sudah aktif.
                    </p>
                </div>

                <div style="padding: 24px;">
                    <!-- Kotak Informasi Akses Admin -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 12px; font-size: 15px; color: #0f172a; font-weight: bold; display: flex; align-items: center;">
                            Kredensial Login Administrator
                        </h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <tr>
                                <td style="padding: 6px 0; color: #64748b; width: 140px;">URL Login Admin</td>
                                <td style="padding: 6px 0; font-weight: bold;">
                                    <a href="${adminUrl}" style="color: #2563eb; text-decoration: none;">${adminUrl}</a>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #64748b;">Username</td>
                                <td style="padding: 6px 0; font-weight: bold; font-family: monospace; font-size: 14px; color: #0f172a;">admin</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #64748b;">Password Default</td>
                                <td style="padding: 6px 0; font-weight: bold; font-family: monospace; font-size: 14px; color: #dc2626;">sudahlupa</td>
                            </tr>
                        </table>
                        <div style="margin-top: 10px; padding: 8px 12px; background-color: #fef2f2; border-left: 3px solid #ef4444; border-radius: 4px; font-size: 12px; color: #991b1b;">
                            <strong>Penting:</strong> Segera ubah password default ini setelah login pertama kali melalui menu <em>Pengaturan</em> demi keamanan akun Anda.
                        </div>
                    </div>

                    <!-- Kotak Akses Peserta Ujian / Siswa -->
                    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 8px; font-size: 14px; color: #166534; font-weight: bold;">
                            Portal Login Siswa / Peserta Ujian
                        </h4>
                        <p style="margin: 0 0 6px; font-size: 13px; color: #15803d;">
                            Bagikan tautan berikut kepada peserta ujian untuk mengakses sesi ujian:
                        </p>
                        <a href="${studentUrl}" style="color: #15803d; font-weight: bold; font-size: 14px; text-decoration: underline;">
                            ${studentUrl}
                        </a>
                    </div>

                    <!-- Ringkasan Paket & Masa Aktif -->
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                        <tr style="background-color: #f8fafc;">
                            <td colspan="2" style="padding: 10px 14px; font-weight: bold; color: #334155; border-bottom: 1px solid #e2e8f0;">
                                Rincian Paket Layanan
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #64748b; width: 140px;">Paket</td>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #0f172a;">${planLabel}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #64748b;">Kuota Peserta</td>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #0f172a;">${quota} Siswa</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 14px; color: #64748b;">Masa Aktif</td>
                            <td style="padding: 10px 14px; font-weight: bold; color: #2563eb;">${masaAktifStr}</td>
                        </tr>
                    </table>

                    <!-- Tombol Masuk Admin -->
                    <div style="text-align: center; margin: 24px 0;">
                        <a href="${adminUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
                            Buka Panel Admin CBT
                        </a>
                    </div>

                    <!-- Bagian Perpanjangan & Dukungan WhatsApp -->
                    <div style="background-color: #eff6ff; border: 1px dashed #93c5fd; border-radius: 10px; padding: 16px; text-align: center;">
                        <p style="margin: 0 0 10px; font-size: 13px; color: #1e40af; font-weight: 500;">
                            Butuh penambahan kuota siswa, perubahan paket, atau perpanjangan durasi layanan?
                        </p>
                        <a href="${waUrl}" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">
                            Chat WhatsApp Admin (0853-5990-7696)
                        </a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background-color: #f8fafc; padding: 16px 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5;">
                    Email ini dikirimkan secara otomatis oleh sistem <strong>Examku CBT Online</strong>.<br/>
                    Jika Anda tidak merasa mendaftarkan institusi ini, silakan abaikan email ini.
                </div>
            </div>
        `;

        const message = new MailerMessage({
            from: {
                address: $app.settings().meta.senderAddress || "noreply@examku.my.id",
                name: $app.settings().meta.senderName || "Exam AA System",
            },
            to: [{ address: contactEmail }],
            subject: subject,
            html: html,
        });

        $app.newMailClient().send(message);
        console.log("[Activation Mail] Berhasil mengirim email aktivasi ke:", contactEmail, "untuk sekolah:", schoolName);
    } catch (err) {
        console.log("[Activation Mail] Gagal mengirim email aktivasi:", err);
    }

    return e.next();
}, "schools");
