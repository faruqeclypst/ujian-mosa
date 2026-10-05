// PB Hook: Notifikasi Email ke Tenant saat Invoice Baru Diterbitkan oleh Admin
// Hook ini hanya akan dieksekusi jika invoice dibuat via HTTP request (oleh SuperAdmin dari Dashboard)
// dan bukan dari cron job (yang memiliki httpContext == null).

onRecordAfterCreateSuccess((e) => {
    try {
        // Abaikan jika tidak ada httpContext (misalnya dari cron job)
        if (!e.httpContext) {
            return e.next();
        }

        const contactEmail = String(e.record.get("contact_email") || "").trim();
        if (!contactEmail || !contactEmail.includes("@")) {
            return e.next();
        }

        const schoolName = String(e.record.get("school_name") || "Institusi Anda");
        const schoolSlug = String(e.record.get("school_slug") || "");
        const invoiceNum = String(e.record.get("invoice_number") || "-");
        const amount = Number(e.record.get("amount") || 0);
        const notes = String(e.record.get("notes") || "Tagihan Perpanjangan Layanan CBT");
        const planLabel = String(e.record.get("plan_label") || "Paket Layanan");
        const dueDateStr = String(e.record.get("due_date") || "");

        const formattedAmount = "Rp " + amount.toLocaleString("id-ID");
        const invoiceUrl = "https://" + schoolSlug + ".examku.my.id/admin/invoice";

        let formattedDate = dueDateStr;
        if (dueDateStr) {
            const match = dueDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) {
                const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
                formattedDate = parseInt(match[3], 10) + " " + months[parseInt(match[2], 10) - 1] + " " + match[1];
            }
        }

        const subject = "[Examku] Invoice Tagihan Resmi Diterbitkan: " + schoolName;

        const html = `
            <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
                <div style="background-color: #2563eb; padding: 20px; color: #ffffff;">
                    <div style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                        Invoice Diterbitkan
                    </div>
                    <h2 style="margin: 0; font-size: 20px; font-weight: bold;">Tagihan Layanan CBT Anda Siap</h2>
                    <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Admin pusat telah menerbitkan invoice permohonan layanan CBT Anda.</p>
                </div>
                
                <div style="padding: 24px;">
                    <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: #334155;">
                        Yth. Administrator <strong>${schoolName}</strong>,<br><br>
                        Pengajuan atau perpanjangan layanan CBT Anda telah kami proses. Berikut adalah rincian tagihan resmi yang perlu diselesaikan agar paket layanan dapat langsung aktif.
                    </p>

                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <tr>
                                <td style="padding: 6px 0; color: #64748b; width: 120px;">No. Invoice</td>
                                <td style="padding: 6px 0; font-weight: bold; font-family: monospace; color: #0f172a;">${invoiceNum}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #64748b;">Paket Layanan</td>
                                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${planLabel}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #64748b;">Keterangan</td>
                                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${notes}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #64748b;">Jatuh Tempo</td>
                                <td style="padding: 6px 0; font-weight: bold; color: #dc2626;">${formattedDate}</td>
                            </tr>
                            <tr>
                                <td colspan="2" style="border-bottom: 1px dashed #cbd5e1; padding-top: 8px; margin-bottom: 8px;"></td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0 0; color: #64748b; font-size: 14px;">Total Tagihan</td>
                                <td style="padding: 10px 0 0; font-weight: black; color: #2563eb; font-size: 18px;">${formattedAmount}</td>
                            </tr>
                        </table>
                    </div>

                    <div style="text-align: center;">
                        <a href="${invoiceUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
                            Lihat & Bayar Tagihan (QRIS)
                        </a>
                        <p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">
                            Pembayaran akan terkonfirmasi secara otomatis dan paket Anda langsung aktif.
                        </p>
                    </div>
                </div>

                <div style="background-color: #f8fafc; padding: 16px 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5;">
                    Pemberitahuan otomatis dari sistem layanan <strong>EXAM AA CBT Platform</strong>.<br>
                    Harap segera menyelesaikan pembayaran agar layanan ujian berjalan optimal.
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
        console.log("[Invoice Mail] Notifikasi invoice baru terkirim ke:", contactEmail, "untuk:", schoolName);
    } catch (err) {
        console.log("[Invoice Mail] Gagal kirim notifikasi invoice:", err);
    }

    return e.next();
}, "invoices");
