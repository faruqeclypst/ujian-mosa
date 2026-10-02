// ============================================================
// Master PocketBase Cron Hook: Cek Masa Aktif & Tagihan Perpanjangan
// Berjalan otomatis setiap hari pukul 08:00 WIB ("0 8 * * *")
// Fungsi:
// 1. Scan seluruh tenant aktif yang memiliki active_until
// 2. Jika masa aktif tersisa <= 14 hari atau dalam masa tenggang (Grace Period):
//    a) Buat tagihan perpanjangan otomatis jika belum ada yang unpaid
//    b) Kirim email pengingat (H-14, H-7, H-3, H-1, Grace Period H+0 s/d H+3, atau Suspensi H+4)
// ============================================================

cronAdd("checkSubscriptionExpiry", "0 8 * * *", () => {
    try {
        console.log("[Subscription Expiry Cron] Memulai pengecekan masa aktif tenant...");
        const now = new Date();

        // Ambil semua sekolah aktif yang memiliki active_until
        const schools = $app.findRecordsByFilter("schools", "is_active = true && active_until != ''", "active_until", 500);
        console.log("[Subscription Expiry Cron] Ditemukan " + schools.length + " sekolah aktif berbatas waktu.");

        // Tabel tarif resmi sesuai landing page
        const planRates = {
            basic: {
                label: "Paket Berkembang (250 Siswa)",
                monthly: 380000,
                semester: 2100000,
                annual: 3840000,
            },
            pro: {
                label: "Paket Lanjutan (500 Siswa)",
                monthly: 760000,
                semester: 4200000,
                annual: 7680000,
            },
            ultimate: {
                label: "Paket Premium (1000 Siswa)",
                monthly: 1235000,
                semester: 6840000,
                annual: 12480000,
            }
        };

        for (let i = 0; i < schools.length; i++) {
            const school = schools[i];
            const activeUntilStr = (school.get("active_until") || "").trim();
            if (!activeUntilStr) continue;

            const match = activeUntilStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (!match) continue;

            const expDate = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10), 23, 59, 59);
            const diffMs = expDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            // Periksa jika dalam rentang penagihan: H-14 hingga H+7
            if (diffDays <= 14 && diffDays >= -7) {
                const schoolId = school.id;
                const schoolName = school.get("name") || "Institusi";
                const schoolSlug = school.get("slug") || "";
                const contactEmail = (school.get("contact_email") || "").trim();
                const currentPlan = (school.get("plan") || "basic").toLowerCase();

                console.log("[Subscription Expiry Cron] " + schoolName + " status diffDays: " + diffDays);

                // 1. Cek apakah sudah ada invoice unpaid untuk sekolah ini
                let existingInvoices = [];
                try {
                    existingInvoices = $app.findRecordsByFilter("invoices", "school_id = '" + schoolId + "' && status = 'unpaid'", "-created", 1);
                } catch (findErr) {}

                let invoiceRecord = null;
                if (existingInvoices.length > 0) {
                    invoiceRecord = existingInvoices[0];
                } else {
                    // Buat invoice perpanjangan otomatis (standar 1 tahun)
                    try {
                        const targetPlanKey = (currentPlan === "free") ? "basic" : currentPlan;
                        const planConfig = planRates[targetPlanKey] || planRates.basic;

                        const yy = now.getFullYear().toString().slice(2);
                        const mm = String(now.getMonth() + 1).padStart(2, "0");
                        const seq = String(Math.floor(Math.random() * 9000) + 1000);
                        const invNum = "INV-" + yy + mm + "-" + seq;

                        const invoiceCollection = $app.findCollectionByNameOrId("invoices");
                        invoiceRecord = new Record(invoiceCollection);
                        invoiceRecord.set("invoice_number", invNum);
                        invoiceRecord.set("school_id", schoolId);
                        invoiceRecord.set("school_name", schoolName);
                        invoiceRecord.set("school_slug", schoolSlug);
                        invoiceRecord.set("contact_email", contactEmail);
                        invoiceRecord.set("plan", targetPlanKey);
                        invoiceRecord.set("plan_label", planConfig.label);
                        invoiceRecord.set("duration_months", 12);
                        invoiceRecord.set("period_label", "1 tahun (12 bulan)");
                        invoiceRecord.set("amount", planConfig.annual);
                        invoiceRecord.set("status", "unpaid");
                        invoiceRecord.set("due_date", expDate.toISOString().slice(0, 10));
                        invoiceRecord.set("notes", "Tagihan Perpanjangan Layanan " + planConfig.label + " (1 Tahun)");

                        $app.save(invoiceRecord);
                        console.log("[Subscription Expiry Cron] Diterbitkan invoice perpanjangan otomatis:", invNum, "untuk:", schoolName);
                    } catch (createInvErr) {
                        console.log("[Subscription Expiry Cron] Gagal menerbitkan invoice perpanjangan:", createInvErr);
                    }
                }

                // 2. Logika Pengiriman Email Notifikasi
                let shouldSendEmail = false;
                let emailType = "warning"; // warning | grace | suspended

                if (diffDays === 14 || diffDays === 7 || diffDays === 3 || diffDays === 1) {
                    shouldSendEmail = true;
                    emailType = "warning";
                } else if (diffDays <= 0 && diffDays >= -3) {
                    // Selama masa tenggang (H+0, H+1, H+2, H+3): ingatkan setiap hari
                    shouldSendEmail = true;
                    emailType = "grace";
                } else if (diffDays === -4) {
                    // Hari pertama suspensi layanan
                    shouldSendEmail = true;
                    emailType = "suspended";
                }

                if (shouldSendEmail && contactEmail && contactEmail.includes("@")) {
                    try {
                        const customDomain = (school.get("custom_domain") || "").trim();
                        const primaryDomain = customDomain ? customDomain : (schoolSlug + ".examku.my.id");
                        const invoiceUrl = "https://" + primaryDomain + "/admin/invoice";
                        const waUrl = "https://wa.me/6285359907696?text=" + encodeURIComponent(
                            "Halo Admin Examku, saya dari " + schoolName + " (" + primaryDomain + ") ingin konfirmasi perpanjangan paket ujian."
                        );

                        const formattedAmount = invoiceRecord ? ("Rp " + Number(invoiceRecord.get("amount") || 0).toLocaleString("id-ID")) : "-";
                        const invoiceNum = invoiceRecord ? invoiceRecord.get("invoice_number") : "-";

                        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
                        const expFormatted = match[3] + " " + months[parseInt(match[2], 10) - 1] + " " + match[1];

                        let subject = "";
                        let headerBg = "linear-gradient(135deg, #b45309, #d97706)";
                        let badgeText = "Pengingat Masa Aktif";
                        let titleText = "Masa Aktif Layanan CBT Segera Berakhir";
                        let descText = `Masa operasional sistem ujian untuk <strong>${schoolName}</strong> tersisa <strong>${diffDays} hari lagi</strong> (berlaku hingga ${expFormatted}).`;
                        let messageBody = `Agar operasional ujian sekolah, bank soal, dan akses peserta ujian tetap berjalan tanpa gangguan, kami mengimbau Anda untuk segera menyelesaikan proses perpanjangan paket layanan sebelum tanggal jatuh tempo.`;

                        if (emailType === "grace") {
                            const graceRemaining = Math.max(0, 3 + diffDays);
                            subject = `[Masa Tenggang] Masa Aktif CBT ${schoolName} Berakhir (Tersisa ${graceRemaining} Hari Sebelum Pembekuan)`;
                            headerBg = "linear-gradient(135deg, #c2410c, #ea580c)";
                            badgeText = "Masa Tenggang Aktif";
                            titleText = "Layanan Memasuki Masa Tenggang";
                            descText = `Masa aktif telah berakhir pada ${expFormatted}. Anda memiliki sisa masa tenggang <strong>${graceRemaining} hari</strong> sebelum sistem dibekukan secara otomatis.`;
                            messageBody = `Saat ini siswa masih dapat mengakses ujian, namun seluruh akses sistem akan dialihkan ke mode penangguhan jika tagihan perpanjangan belum diselesaikan. Harap segera melakukan pembayaran via QRIS atau transfer bank.`;
                        } else if (emailType === "suspended") {
                            subject = `[Pemberitahuan] Layanan CBT ${schoolName} Ditangguhkan Sementara`;
                            headerBg = "linear-gradient(135deg, #991b1b, #dc2626)";
                            badgeText = "Layanan Ditangguhkan";
                            titleText = "Layanan CBT Ditangguhkan";
                            descText = `Masa tenggang perpanjangan untuk <strong>${schoolName}</strong> telah berakhir. Akses ujian untuk siswa saat ini dibekukan sementara.`;
                            messageBody = `Data institusi dan bank soal Anda tetap tersimpan dengan aman. Untuk membuka kuncian sistem dan mengaktifkan kembali portal ujian secara instan, administrator institusi dapat menyelesaikan tagihan perpanjangan berikut ini.`;
                        } else {
                            subject = `[Pemberitahuan] Masa Aktif Layanan CBT ${schoolName} Berakhir dalam ${diffDays} Hari`;
                        }

                        const html = `
                            <div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                                <!-- Header -->
                                <div style="background: ${headerBg}; padding: 26px 24px; color: #ffffff;">
                                    <div style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                                        ${badgeText}
                                    </div>
                                    <h1 style="margin: 0; font-size: 20px; font-weight: bold; line-height: 1.3;">${titleText}</h1>
                                    <p style="margin: 8px 0 0; font-size: 13px; opacity: 0.95;">
                                        ${descText}
                                    </p>
                                </div>

                                <div style="padding: 24px;">
                                    <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-top: 0;">
                                        Yth. Administrator <strong>${schoolName}</strong>,<br/><br/>
                                        ${messageBody}
                                    </p>

                                    <!-- Kotak Rincian Tagihan Perpanjangan -->
                                    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 18px; margin: 20px 0;">
                                        <h3 style="margin: 0 0 12px; font-size: 14px; color: #92400e; font-weight: bold;">
                                            Tagihan Perpanjangan Layanan
                                        </h3>
                                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                            <tr>
                                                <td style="padding: 6px 0; color: #78350f; width: 140px;">No. Tagihan</td>
                                                <td style="padding: 6px 0; font-weight: bold; font-family: monospace; color: #0f172a;">${invoiceNum}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; color: #78350f;">Total Tagihan</td>
                                                <td style="padding: 6px 0; font-weight: bold; font-size: 15px; color: #b45309;">${formattedAmount}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; color: #78350f;">Jatuh Tempo</td>
                                                <td style="padding: 6px 0; font-weight: bold; color: #dc2626;">${expFormatted}</td>
                                            </tr>
                                        </table>
                                    </div>

                                    <!-- Tombol Pembayaran -->
                                    <div style="text-align: center; margin: 24px 0;">
                                        <a href="${invoiceUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
                                            Lihat & Bayar Tagihan (QRIS / Transfer)
                                        </a>
                                    </div>

                                    <!-- Bantuan WhatsApp -->
                                    <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 16px; text-align: center;">
                                        <p style="margin: 0 0 10px; font-size: 12px; color: #475569;">
                                            Perlu bantuan penyesuaian kuota, pergantian paket, atau bantuan administrasi SPK sekolah?
                                        </p>
                                        <a href="${waUrl}" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">
                                            Hubungi Tim Support WhatsApp
                                        </a>
                                    </div>
                                </div>

                                <!-- Footer -->
                                <div style="background-color: #f8fafc; padding: 16px 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5;">
                                    Pemberitahuan otomatis dari sistem layanan <strong>EXAM AA CBT Platform</strong>.<br/>
                                    Jika Anda telah melakukan pembayaran perpanjangan, silakan abaikan pesan ini.
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
                        console.log("[Subscription Expiry Cron] Email (" + emailType + ") terkirim ke:", contactEmail, "untuk sekolah:", schoolName);
                    } catch (mailErr) {
                        console.log("[Subscription Expiry Cron] Gagal mengirim email pengingat:", mailErr);
                    }
                }
            }
        }
    } catch (err) {
        console.log("[Subscription Expiry Cron] Error umum:", err);
    }
});
