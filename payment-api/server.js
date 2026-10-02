import crypto from "node:crypto";
import express from "express";
import PocketBase from "pocketbase";

const app = express();
const port = Number(process.env.PORT || 8787);
const providerUrl = process.env.SUMOPOD_API_URL || "https://api-pay-sandbox.sumopod.com/api/v1";
const publicAppUrl = process.env.PUBLIC_APP_URL || "https://examku.my.id";
const masterPb = new PocketBase(process.env.MASTER_PB_URL || "http://127.0.0.1:8090");
masterPb.autoCancellation(false);

async function authMaster() {
  await masterPb.collection("super_admins").authWithPassword(process.env.MASTER_PB_ADMIN_EMAIL, process.env.MASTER_PB_ADMIN_PASSWORD);
}
function validWebhook(req, body) {
  const tokenOk = process.env.SUMOPOD_WEBHOOK_TOKEN && req.get("x-webhook-token") === process.env.SUMOPOD_WEBHOOK_TOKEN;
  if (tokenOk) return true;
  const secret = process.env.SUMOPOD_WEBHOOK_SECRET?.replace(/^whsec_/, "");
  if (!secret) return false;
  const id = req.get("svix-id");
  const timestamp = req.get("svix-timestamp");
  const signature = req.get("svix-signature");
  if (!id || !timestamp || !signature) return false;
  const expected = crypto.createHmac("sha256", Buffer.from(secret, "base64")).update(`${id}.${timestamp}.${body}`).digest("base64");
  return signature.split(" ").some(part => part.split(",")[1] === expected);
}

// CORS for tenant subdomains and main domain
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.hostname === "examku.my.id" || parsed.hostname.endsWith(".examku.my.id") || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
      }
    } catch (_) {}
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, environment: "sandbox" }));
app.post("/api/sumopod/create-payment", express.json(), async (req, res) => {
  const { invoice_id, order_id, amount, tenant_url } = req.body || {};
  if (!invoice_id || !order_id || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ message: "invoice_id, order_id, and positive amount are required" });
  let returnBaseUrl = publicAppUrl;
  if (tenant_url) {
    try {
      const parsedTenantUrl = new URL(tenant_url);
      if (parsedTenantUrl.protocol !== "https:" || !(parsedTenantUrl.hostname === "examku.my.id" || parsedTenantUrl.hostname.endsWith(".examku.my.id"))) return res.status(400).json({ message: "tenant_url must use an HTTPS examku.my.id host" });
      returnBaseUrl = parsedTenantUrl.origin;
    } catch {
      return res.status(400).json({ message: "tenant_url is invalid" });
    }
  }

  const payload = {
    order_id,
    amount: Number(amount),
    currency: "IDR",
    expires_in_hours: 24,
    payment_method_type_code: "QRIS",
    success_return_url: `${returnBaseUrl}/admin/invoice?payment=success&invoice=${encodeURIComponent(invoice_id)}`,
    cancel_return_url: `${returnBaseUrl}/admin/invoice?payment=cancelled&invoice=${encodeURIComponent(invoice_id)}`
  };

  try {
    let provider = await fetch(`${providerUrl}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": process.env.SUMOPOD_API_KEY },
      body: JSON.stringify(payload),
    });
    let data = await provider.json();

    if (provider.status === 409) {
      const retryOrderId = `${order_id}-RETRY-${Date.now().toString(36)}`;
      provider = await fetch(`${providerUrl}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": process.env.SUMOPOD_API_KEY },
        body: JSON.stringify({ ...payload, order_id: retryOrderId }),
      });
      data = await provider.json();
    }

    if (!provider.ok) return res.status(provider.status).json(data);
    return res.json({ payment_id: data.payment_id, payment_link_url: data.payment_link_url });
  } catch (error) {
    console.error("SumoPod create payment failed", error);
    return res.status(502).json({ message: "Payment provider request failed" });
  }
});
app.post("/api/sumopod/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const raw = req.body.toString("utf8");
  if (!validWebhook(req, raw)) return res.status(401).send("Invalid webhook authentication");
  try {
    const event = JSON.parse(raw);
    const data = event.data || {};
    if (!data.order_id) {
      console.warn("SumoPod webhook verification received without order_id");
      return res.sendStatus(204);
    }
    await authMaster();
    const order = String(data.order_id).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
    let invoice;
    try {
      invoice = await masterPb.collection("invoices").getFirstListItem(`invoice_number = "${order}"`);
    } catch (lookupError) {
      const retryMatch = String(data.order_id).match(/^(.*)-RETRY-[A-Za-z0-9-]+$/);
      if (!retryMatch) throw lookupError;
      const baseOrder = retryMatch[1].replaceAll("\\", "\\\\").replaceAll('"', '\\"');
      invoice = await masterPb.collection("invoices").getFirstListItem(`invoice_number = "${baseOrder}"`);
    }

    // 1. Cek idempotensi: jika invoice sudah pernah berstatus lunas, abaikan webhook replay
    if (invoice.status === "paid") {
      console.log(`[SumoPod Webhook] Invoice ${invoice.invoice_number} sudah berstatus lunas sebelumnya. Melewati duplikasi pemrosesan.`);
      return res.sendStatus(204);
    }

    const update = {};
    if (event.event_type === "payment.completed" || data.status === "completed") {
      update.status = "paid";
      update.paid_date = data.paid_at || new Date().toISOString();
      if (data.payment_id) {
        update.notes = (invoice.notes ? `${invoice.notes} | ` : "") + `SumoPod Pay ID: ${data.payment_id}`;
      }
    }
    if (event.event_type === "payment.expired") update.status = "overdue";
    if (Object.keys(update).length) await masterPb.collection("invoices").update(invoice.id, update);

    if (update.status === "paid") {
      try {
        let school;
        if (invoice.school_id) {
          try { school = await masterPb.collection("schools").getOne(invoice.school_id); } catch (_) {}
        }
        if (!school && invoice.school_slug) {
          try { school = await masterPb.collection("schools").getFirstListItem(`slug = "${invoice.school_slug}"`); } catch (_) {}
        }
        if (school) {
          const rawPlan = (invoice.plan || school.plan || "basic").toLowerCase();
          let targetQuota = 250;
          let cleanPlan = "basic";

          if (rawPlan.includes("ultimate") || rawPlan.includes("premium")) {
            targetQuota = 1000;
            cleanPlan = "ultimate";
          } else if (rawPlan.includes("pro") || rawPlan.includes("lanjutan")) {
            targetQuota = 500;
            cleanPlan = "pro";
          }

          const months = Number(invoice.duration_months) || 1;
          const now = new Date();
          const currentActive = school.active_until ? new Date(school.active_until) : now;
          const baseDate = (currentActive > now && school.plan !== "free") ? currentActive : new Date();
          baseDate.setMonth(baseDate.getMonth() + months);
          baseDate.setHours(23, 59, 59, 999);

          await masterPb.collection("schools").update(school.id, {
            plan: cleanPlan,
            student_quota: Math.max(school.student_quota || 0, targetQuota),
            active_until: baseDate.toISOString(),
            is_active: true
          });

          console.log(`[SumoPod Auto Upgrade] Berhasil mengaktifkan paket ${cleanPlan} (${targetQuota} siswa) untuk ${school.name} hingga ${baseDate.toISOString()}`);
        }
      } catch (schoolUpgradeErr) {
        console.error("Auto upgrade school quota failed:", schoolUpgradeErr);
      }
    }
    return res.sendStatus(204);
  } catch (error) {
    console.error("SumoPod webhook failed", error);
    return res.status(500).send("Webhook processing failed");
  }
});
app.listen(port, "127.0.0.1", () => console.log(`Payment API listening on 127.0.0.1:${port}`));
