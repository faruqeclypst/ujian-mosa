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
        const isRenewal = e.record.get("type") === "renewal";
        const institutionType = e.record.get("type") === "campus" ? "Universitas / Kampus" : (isRenewal ? "Perpanjangan/Upgrade" : "Sekolah");
        const createdDate = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

        let planLabel = "Free Trial (50 Siswa)";
        if (plan === "basic" || plan.toLowerCase().includes("berkembang")) planLabel = "Paket Berkembang (250 Siswa)";
        else if (plan === "pro" || plan.toLowerCase().includes("lanjutan")) planLabel = "Paket Lanjutan (500 Siswa)";
        else if (plan === "ultimate" || plan.toLowerCase().includes("premium")) planLabel = "Paket Premium (1000 Siswa)";
        else if (plan) planLabel = plan;

        const adminUrl = "https://examku.my.id/super_admin";
        const schoolUrl = "https://" + slug + ".examku.my.id";

        let subject = "";
        let title = "";
        let desc = "";
        let badgeText = "";
        let badgeStyle = "";
        let headerColor = "";

        if (isTrial) {
            subject = "[Examku] Permintaan Free Trial: " + schoolName;
            title = "Permintaan Free Trial CBT";
            desc = "Ada permintaan akun Free Trial CBT baru melalui examku.my.id";
            badgeText = "Uji Coba Free Trial (14 Hari)";
            badgeStyle = "background-color: #dcfce7; color: #15803d;";
            headerColor = "#059669";
        } else if (isRenewal) {
            subject = "[Examku] Permohonan Upgrade/Perpanjangan: " + schoolName + " (" + planLabel + ")";
            title = "Permohonan Upgrade / Perpanjangan";
            desc = "Ada permohonan upgrade paket atau perpanjangan lisensi dari tenant.";
            badgeText = "Upgrade / Perpanjangan";
            badgeStyle = "background-color: #fef08a; color: #854d0e;";
            headerColor = "#eab308";
        } else {
            subject = "[Examku] Pendaftaran Institusi Baru: " + schoolName + " (" + planLabel + " (" + duration + "))";
            title = "Pendaftaran Institusi Baru";
            desc = "Ada permohonan pendaftaran tenant baru melalui examku.my.id";
            badgeText = "Langganan Baru";
            badgeStyle = "background-color: #dbeafe; color: #1d4ed8;";
            headerColor = "#2563eb";
        }

        const html = `
            <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: ${headerColor}; padding: 20px; color: #ffffff;">
                    <h2 style="margin: 0; font-size: 20px;">${title}</h2>
                    <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">${desc}</p>
                </div>
                
                <div style="padding: 24px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 160px; background-color: #f8fafc;">Jenis Permohonan</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                                <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; ${badgeStyle}">
                                    ${badgeText}
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
