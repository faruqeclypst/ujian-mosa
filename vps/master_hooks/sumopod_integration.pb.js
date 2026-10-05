// vps/master_hooks/sumopod_integration.pb.js

// 1. Endpoint untuk membuat payment link SumoPod dari frontend
routerAdd("POST", "/api/sumopod/create-payment", (c) => {
    try {
        const body = new DynamicModel({
            invoice_id: "",
            order_id: "",
            amount: 0,
            tenant_url: ""
        });
        c.bind(body);

        const invoiceId = body.invoice_id;
        const orderId = body.order_id;
        const amount = body.amount;
        const tenantUrl = body.tenant_url || "https://examku.my.id";

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
    // [PENTING] Untuk keamanan produksi, uncomment pengecekan webhook token di bawah ini
    /*
    const expectedToken = "ISI_DENGAN_WEBHOOK_TOKEN_ANDA";
    const receivedToken = c.request().header.get("X-Webhook-Token");
    if (expectedToken !== receivedToken) {
        return c.json(401, { message: "Invalid webhook token" });
    }
    */

    try {
        const payload = new DynamicModel({
            event_type: "",
            data: {
                order_id: "",
                payment_method: ""
            }
        });
        c.bind(payload);

        console.log("[SumoPod] Webhook received:", payload.event_type);

        if (payload.event_type === "payment.completed") {
            const paymentData = payload.data;
            const orderId = paymentData.order_id; 

            if (orderId) {
                const invoice = $app.findFirstRecordByData("invoices", "invoice_number", orderId);
                
                if (invoice.get("status") !== "paid") {
                    console.log("[SumoPod] Marking invoice as paid:", orderId);
                    
                    invoice.set("status", "paid");
                    invoice.set("payment_method", paymentData.payment_method || "sumopod");
                    $app.save(invoice);

                    const schoolId = invoice.get("school_id");
                    if (schoolId) {
                        const school = $app.findRecordById("schools", schoolId);
                        
                        const newPlan = invoice.get("plan") || school.get("plan") || "basic";
                        const months = invoice.get("duration_months") || 1;
                        
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
            }
        }

        return c.json(200, { status: "success" });
    } catch (err) {
        console.log("[SumoPod] Error processing webhook:", err);
        // Return 200 so SumoPod doesn't retry infinitely on non-invoice related test payloads
        return c.json(200, { status: "error", message: err.toString() });
    }
});
