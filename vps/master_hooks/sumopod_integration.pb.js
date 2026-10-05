// vps/master_hooks/sumopod_integration.pb.js

// 1. Endpoint untuk membuat payment link SumoPod dari frontend
routerAdd("POST", "/api/sumopod/create-payment", (c) => {
    const rawBody = readerToString(c.request().body);
    const body = JSON.parse(rawBody);

    const invoiceId = body.invoice_id;
    const orderId = body.order_id;
    const amount = body.amount;
    const tenantUrl = body.tenant_url || "https://examku.my.id";

    try {
        const res = $http.send({
            url: "https://api-pay.sumopod.com/api/v1/payments",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Api-Key": "fb08af0c38ed79911c5c74d49f7ff838b51df0d272294b2727410bf4302f440b"
            },
            body: JSON.stringify({
                order_id: orderId,
                amount: amount,
                currency: "IDR",
                success_return_url: tenantUrl + "/admin/invoice",
                cancel_return_url: tenantUrl + "/admin/invoice",
                payment_method_type_code: "QRIS"
            })
        });

        if (res.statusCode >= 200 && res.statusCode < 300) {
            return c.json(200, res.json);
        } else {
            console.log("[SumoPod] Create payment failed:", res.raw);
            return c.json(400, { message: "Gagal memproses pembayaran ke provider.", detail: res.json });
        }
    } catch (err) {
        console.log("[SumoPod] API Error:", err);
        return c.json(500, { message: "Internal server error" });
    }
});

// 2. Webhook untuk menerima notifikasi pembayaran sukses dari SumoPod
routerAdd("POST", "/api/sumopod/webhook", (c) => {
    // [PENTING] Untuk keamanan produksi, uncomment pengecekan webhook token di bawah ini,
    // dan isikan token rahasia dari Dashboard SumoPod -> Settings -> Webhook Token
    /*
    const expectedToken = "ISI_DENGAN_WEBHOOK_TOKEN_ANDA";
    const receivedToken = c.request().header.get("X-Webhook-Token");
    if (expectedToken !== receivedToken) {
        return c.json(401, { message: "Invalid webhook token" });
    }
    */

    const rawBody = readerToString(c.request().body);
    const event = JSON.parse(rawBody);

    console.log("[SumoPod] Webhook received:", event.event_type);

    if (event.event_type === "payment.completed") {
        const paymentData = event.data;
        const orderId = paymentData.order_id; // e.g. INV-2026-001

        if (orderId) {
            try {
                // Cari invoice di database
                const invoice = $app.findFirstRecordByData("invoices", "invoice_number", orderId);
                
                if (invoice.get("status") !== "paid") {
                    console.log("[SumoPod] Marking invoice as paid:", orderId);
                    
                    // 1. Update status invoice
                    invoice.set("status", "paid");
                    invoice.set("payment_method", paymentData.payment_method || "sumopod");
                    $app.save(invoice);

                    // 2. Eksekusi logika upgrade paket sekolah (Backend equivalent of upgradeSchoolFromInvoice)
                    const schoolId = invoice.get("school_id");
                    if (schoolId) {
                        const school = $app.findRecordById("schools", schoolId);
                        
                        const newPlan = invoice.get("plan") || school.get("plan") || "basic";
                        const months = invoice.get("duration_months") || 1;
                        
                        // Hitung kuota (Asumsi plan basic=150, berkembang=300, premium=600, ultimate=9999)
                        let targetQuota = 150;
                        if (newPlan === "berkembang") targetQuota = 300;
                        if (newPlan === "premium") targetQuota = 600;
                        if (newPlan === "ultimate") targetQuota = 9999;
                        
                        const now = new Date();
                        let baseDate = new Date();
                        
                        const activeUntilRaw = school.get("active_until");
                        if (activeUntilRaw) {
                            const curDate = new Date(activeUntilRaw.replace(" ", "T"));
                            const isPlanUnchanged = school.get("plan") === newPlan;
                            
                            // Perpanjang dari tanggal sisa JIKA paket tidak berubah
                            if (curDate.getTime() > now.getTime() && school.get("plan") !== "free" && isPlanUnchanged) {
                                baseDate = curDate;
                            }
                        }
                        
                        baseDate.setMonth(baseDate.getMonth() + months);
                        const finalActiveUntil = baseDate.toISOString().replace('T', ' ').substring(0, 19) + 'Z';
                        
                        console.log("[SumoPod] Upgrading school:", school.get("name"), "to plan:", newPlan, "until:", finalActiveUntil);
                        
                        school.set("plan", newPlan);
                        school.set("student_quota", targetQuota);
                        school.set("active_until", finalActiveUntil);
                        
                        $app.save(school);
                    }
                }
            } catch (err) {
                console.log("[SumoPod] Error processing webhook invoice:", err);
                return c.json(500, { message: "Error updating database" });
            }
        }
    }

    return c.json(200, { status: "success" });
});
