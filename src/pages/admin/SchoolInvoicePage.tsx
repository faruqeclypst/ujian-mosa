import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText, Upload, Eye, Printer, CheckCircle2, Clock,
  AlertTriangle, XCircle, Paperclip, ExternalLink, Trash2,
  RefreshCw, X, Receipt, CreditCard, TrendingUp, QrCode, Sparkles,
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";
import {
  calculatePlanInvoice,
  normalizePlanKey,
  PLAN_PRICING,
  PlanKey,
} from "../../utils/pricingHelper";
import { ensureRenewalInvoice } from "../../utils/subscriptionHelper";
import { printOfficialReceipt } from "../../utils/receiptHelper";

// ─── Types ───────────────────────────────────────────────────

type PaymentStatus = "unpaid" | "paid" | "overdue" | "cancelled";

interface Invoice {
  id: string;
  invoice_number: string;
  school_id: string;
  school_name: string;
  school_slug: string;
  contact_email?: string;
  plan: string;
  plan_label?: string;
  duration_months: number;
  period_label?: string;
  amount: number;
  status: PaymentStatus;
  due_date: string;
  paid_date?: string;
  notes?: string;
  payment_proof?: string;
  created: string;
  updated: string;
}

// ─── Helpers ─────────────────────────────────────────────────

const PLAN_PRICES: Record<string, { label: string; monthly: number }> = {
  free:     { label: PLAN_PRICING.free.label,     monthly: PLAN_PRICING.free.monthlyRate },
  basic:    { label: PLAN_PRICING.basic.label,    monthly: PLAN_PRICING.basic.monthlyRate },
  pro:      { label: PLAN_PRICING.pro.label,      monthly: PLAN_PRICING.pro.monthlyRate },
  ultimate: { label: PLAN_PRICING.ultimate.label, monthly: PLAN_PRICING.ultimate.monthlyRate },
};

const STATUS_CONFIG: Record<PaymentStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: typeof CheckCircle2;
}> = {
  unpaid:    { label: "Belum Dibayar", color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",  icon: Clock },
  paid:      { label: "Lunas",          color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle2 },
  overdue:   { label: "Terlambat",      color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",    icon: AlertTriangle },
  cancelled: { label: "Dibatalkan",     color: "text-slate-500",   bg: "bg-slate-100",  border: "border-slate-200",  icon: XCircle },
};

const formatRupiah = (n: number): string =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const formatDate = (iso: string): string => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

const isOverdue = (invoice: Invoice): boolean => {
  if (invoice.status !== "unpaid") return false;
  if (!invoice.due_date) return false;
  return new Date(invoice.due_date) < new Date();
};

const getInvoiceStatus = (invoice: Invoice): PaymentStatus => {
  if (invoice.status === "unpaid" && isOverdue(invoice)) {
    return "overdue";
  }
  return invoice.status;
};

const getProofUrl = (inv: Invoice): string => {
  if (!inv.payment_proof) return "";
  if (inv.payment_proof.startsWith("data:") || inv.payment_proof.startsWith("http")) {
    return inv.payment_proof;
  }
  return `${masterPb.baseUrl}/api/files/invoices/${inv.id}/${inv.payment_proof}`;
};

const isImageProof = (proofUrl: string): boolean => {
  if (!proofUrl) return false;
  if (proofUrl.startsWith("data:image")) return true;
  return /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(proofUrl);
};

// ─── Print ────────────────────────────────────────────────────

const printInvoice = (inv: Invoice) => {
  const cfg = STATUS_CONFIG[inv.status];
  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8"/>
      <title>Invoice ${inv.invoice_number}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Segoe UI',sans-serif;color:#1e293b;background:#fff;padding:40px}
        .hdr{display:flex;justify-content:space-between;margin-bottom:36px}
        .brand{font-size:20px;font-weight:700;letter-spacing:-0.5px}
        .brand-sub{font-size:11px;color:#64748b;margin-top:2px}
        .inv-num{font-size:16px;font-weight:700;color:#2563eb;text-align:right}
        .inv-dt{font-size:12px;color:#64748b;text-align:right;margin-top:4px}
        hr{border:none;border-top:1px solid #e2e8f0;margin:20px 0}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}
        .lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:6px}
        .val{font-size:13px;font-weight:600;color:#1e293b}
        .sub{font-size:11px;color:#64748b;margin-top:2px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        th{background:#f8fafc;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;padding:9px 12px;text-align:left;border-bottom:2px solid #e2e8f0}
        td{padding:11px 12px;font-size:13px;border-bottom:1px solid #f1f5f9}
        .tot td{font-weight:700;font-size:14px;border-top:2px solid #e2e8f0;border-bottom:none;padding-top:12px}
        .badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:600}
        .badge-paid{background:#dcfce7;color:#15803d}
        .badge-unpaid{background:#fef3c7;color:#92400e}
        .badge-overdue{background:#fee2e2;color:#991b1b}
        .badge-cancelled{background:#f1f5f9;color:#64748b}
        .footer{margin-top:40px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between}
        .footer-note{font-size:10px;color:#94a3b8}
        @media print{body{padding:20px}}
      </style>
    </head>
    <body>
      <div class="hdr">
        <div>
          <div class="brand">EXAM AA</div>
          <div class="brand-sub">Platform CBT Online untuk Sekolah</div>
        </div>
        <div>
          <div class="inv-num">${inv.invoice_number}</div>
          <div class="inv-dt">Dibuat: ${formatDate(inv.created)}</div>
        </div>
      </div>
      <hr/>
      <div class="g2">
        <div>
          <div class="lbl">Ditagihkan Kepada</div>
          <div class="val">${inv.school_name}</div>
          <div class="sub">Kode: ${inv.school_slug}</div>
        </div>
        <div style="text-align:right">
          <div class="lbl">Status Pembayaran</div>
          <span class="badge badge-${inv.status}">${cfg.label}</span>
          <div class="sub" style="margin-top:6px">${inv.status === "paid" && inv.paid_date ? "Dibayar: " + formatDate(inv.paid_date) : "Jatuh tempo: " + formatDate(inv.due_date)}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Layanan</th><th style="text-align:center">Durasi</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>
          <tr>
            <td>
              <div style="font-weight:600">${PLAN_PRICES[inv.plan]?.label || inv.plan} Plan</div>
              <div style="font-size:11px;color:#64748b">Langganan platform ujian digital CBT EXAM AA</div>
            </td>
            <td style="text-align:center">${inv.duration_months} bulan</td>
            <td style="text-align:right;font-weight:600">${formatRupiah(inv.amount)}</td>
          </tr>
        </tbody>
        <tfoot><tr class="tot"><td colspan="2">Total</td><td style="text-align:right">${formatRupiah(inv.amount)}</td></tr></tfoot>
      </table>
      ${inv.notes ? `<div style="background:#f8fafc;border-radius:8px;padding:12px;font-size:12px;color:#64748b;margin-bottom:20px"><strong style="color:#475569">Catatan:</strong> ${inv.notes}</div>` : ""}
      <div class="footer">
        <div class="footer-note">Dokumen ini dibuat otomatis oleh sistem EXAM AA.</div>
        <div class="footer-note">Pertanyaan: admin@examaa.id</div>
      </div>
    </body>
    </html>
  `;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
};

// ─── Component ────────────────────────────────────────────────

const SchoolInvoicePage = () => {
  const { school, refreshSchool } = useTenant();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{ type: "success" | "cancelled"; message: string } | null>(null);
  const [paymentSession, setPaymentSession] = useState<{
    invoice: Invoice;
    paymentUrl: string;
    isPaid: boolean;
  } | null>(null);
  const [requestingRenewal, setRequestingRenewal] = useState(false);
  const proofFileRef = useRef<HTMLInputElement>(null);

  const handleRequestRenewal = async () => {
    if (!school) return;
    setRequestingRenewal(true);
    try {
      const res = await ensureRenewalInvoice(school, 12);
      await loadInvoices();
      if (res.isNew) {
        setPaymentNotice({
          type: "success",
          message: `Tagihan perpanjangan 1 tahun (${res.invoice.invoice_number}) berhasil disiapkan dengan tarif resmi. Anda dapat langsung membayar via QRIS di bawah.`,
        });
      } else {
        setPaymentNotice({
          type: "success",
          message: `Tagihan (${res.invoice.invoice_number}) sudah aktif dalam daftar belum bayar. Silakan klik 'Bayar QRIS'.`,
        });
      }
    } catch (err: any) {
      alert(err?.message || "Gagal memproses perpanjangan paket.");
    } finally {
      setRequestingRenewal(false);
    }
  };

  const loadInvoices = useCallback(async () => {
    if (!school) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await masterPb.collection("invoices").getList<Invoice>(1, 20);
      const records = result.items;
      const schoolId = String(school.id || "").trim();
      const schoolSlug = String(school.slug || "").trim().toLowerCase();
      const mapped = records
        .filter(r => {
          const recordSchoolId = String(r.school_id || "").trim();
          const recordSchoolSlug = String(r.school_slug || "").trim().toLowerCase();
          return recordSchoolId === schoolId || recordSchoolSlug === schoolSlug;
        })
        .map(r => ({
          ...r,
          plan: r.plan || normalizePlanKey(r.plan_label),
          duration_months: Number(r.duration_months) || 1,
          amount: Number(r.amount) || 0,
        }))
        .sort((a, b) => String(b.created || "").localeCompare(String(a.created || "")));
      setInvoices(mapped);
    } catch (err) {
      console.error("Gagal memuat invoice:", err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [school]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      setPaymentNotice({
        type: "success",
        message: "Pembayaran Anda berhasil diproses. Memperbarui status tagihan...",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
      loadInvoices();
    } else if (payment === "cancelled") {
      setPaymentNotice({
        type: "cancelled",
        message: "Pembayaran dibatalkan. Anda dapat mengulangi proses pembayaran kapan saja.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [loadInvoices]);

  const handlePayWithQris = async (inv: Invoice) => {
    try {
      setPayingInvoiceId(inv.id);
      const res = await fetch("https://examku.my.id/api/sumopod/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: inv.id,
          order_id: inv.invoice_number,
          amount: inv.amount,
          tenant_url: window.location.origin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Gagal membuat sesi pembayaran.");
      }

      if (data.payment_link_url) {
        window.open(data.payment_link_url, "_blank");
        setPaymentSession({
          invoice: inv,
          paymentUrl: data.payment_link_url,
          isPaid: false,
        });
      } else {
        throw new Error("Link pembayaran tidak ditemukan.");
      }
    } catch (err: any) {
      alert(err.message || "Gagal memproses pembayaran QRIS.");
    } finally {
      setPayingInvoiceId(null);
    }
  };

  // Deteksi Otomatis Realtime Status Pembayaran QRIS
  useEffect(() => {
    if (!paymentSession || paymentSession.isPaid) return;

    let isMounted = true;
    const invId = paymentSession.invoice.id;

    const checkStatus = async () => {
      try {
        const latest = await masterPb.collection("invoices").getOne<Invoice>(invId);
        if (latest && latest.status === "paid" && isMounted) {
          setPaymentSession(prev => prev ? { ...prev, invoice: latest, isPaid: true } : null);
          await loadInvoices();
          await refreshSchool();
        }
      } catch (err) {
        // Abaikan galat polling sementara
      }
    };

    const interval = setInterval(checkStatus, 3500);

    let unsub: (() => void) | null = null;
    masterPb.collection("invoices").subscribe(invId, async (e: any) => {
      if (e.action === "update" && e.record?.status === "paid" && isMounted) {
        setPaymentSession(prev => prev ? { ...prev, invoice: e.record, isPaid: true } : null);
        await loadInvoices();
        await refreshSchool();
      }
    }).then(fn => { unsub = fn; }).catch(() => {});

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (unsub) unsub();
      else masterPb.collection("invoices").unsubscribe(invId).catch(() => {});
    };
  }, [paymentSession?.invoice.id, paymentSession?.isPaid, loadInvoices, refreshSchool]);

  useEffect(() => {
    if (detailInvoice) {
      const updated = invoices.find(i => i.id === detailInvoice.id);
      if (updated) setDetailInvoice(updated);
    }
  }, [invoices]);

  const handleProofUpload = async (invoiceId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran file maksimal 5 MB.");
      return;
    }
    setUploadingProof(true);
    try {
      const fd = new FormData();
      fd.append("payment_proof", file);
      await masterPb.collection("invoices").update(invoiceId, fd);
      await loadInvoices();
      if (detailInvoice?.id === invoiceId) {
        const updated = await masterPb.collection("invoices").getOne<Invoice>(invoiceId);
        setDetailInvoice(updated);
      }
    } catch (err: any) {
      alert(err.message || "Gagal mengunggah bukti pembayaran.");
    } finally {
      setUploadingProof(false);
    }
  };

  const removeProof = async (invoiceId: string) => {
    try {
      await masterPb.collection("invoices").update(invoiceId, { payment_proof: null });
      await loadInvoices();
      if (detailInvoice?.id === invoiceId) {
        const updated = await masterPb.collection("invoices").getOne<Invoice>(invoiceId);
        setDetailInvoice(updated);
      }
    } catch (err: any) {
      alert(err.message || "Gagal menghapus bukti pembayaran.");
    }
  };

  const unpaidCount = invoices.filter(i => getInvoiceStatus(i) === "unpaid" || getInvoiceStatus(i) === "overdue").length;
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);

  if (!school) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-slate-500">Data institusi tidak ditemukan.</p>
      </div>
    );
  }

  const stats = [
    {
      label: "Total Invoice",
      value: String(invoices.length),
      note: "semua periode",
      icon: Receipt,
      iconColor: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-600/10 dark:bg-blue-400/10 border-blue-100 dark:border-blue-900/30",
      highlight: false,
    },
    {
      label: "Belum Lunas",
      value: String(unpaidCount),
      note: "perlu perhatian",
      icon: CreditCard,
      iconColor: unpaidCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400",
      iconBg: unpaidCount > 0 ? "bg-amber-500/10 dark:bg-amber-400/10 border-amber-100 dark:border-amber-900/30" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
      highlight: unpaidCount > 0,
    },
    {
      label: "Total Terbayar",
      value: formatRupiah(totalPaid),
      note: "riwayat lunas",
      icon: TrendingUp,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-600/10 dark:bg-emerald-400/10 border-emerald-100 dark:border-emerald-900/30",
      highlight: false,
    },
  ];

  return (
    <div className="space-y-5">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600/10 dark:bg-blue-400/10 rounded-xl flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
            <Receipt size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">
              Invoice & Pembayaran
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Riwayat tagihan langganan {school.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleRequestRenewal}
            disabled={requestingRenewal}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm disabled:opacity-50"
            title="Terbitkan tagihan perpanjangan 1 tahun"
          >
            <Sparkles size={13} className={requestingRenewal ? "animate-spin" : ""} />
            {requestingRenewal ? "Menyiapkan..." : "Perpanjang Paket"}
          </button>
          <button
            onClick={loadInvoices}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Payment Result Notification ─────────────────────────── */}
      {paymentNotice && (
        <div className={cn(
          "rounded-2xl border p-4 flex items-center justify-between shadow-sm transition-all",
          paymentNotice.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
            : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
        )}>
          <div className="flex items-center gap-3">
            {paymentNotice.type === "success" ? (
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            ) : (
              <Clock size={18} className="text-slate-500 dark:text-slate-400 flex-shrink-0" />
            )}
            <p className="text-xs sm:text-sm font-semibold">{paymentNotice.message}</p>
          </div>
          <button
            onClick={() => setPaymentNotice(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition"
            aria-label="Tutup notifikasi"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Expiry / Renewal Notification Banner ── */}
      {school && (school.plan === "free" || (school.active_until && Math.ceil((new Date(school.active_until.replace(" ", "T")).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 14)) && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-blue-500/10 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {school.plan === "free"
                  ? "Sekolah Menggunakan Akun Free Trial (50 Siswa)"
                  : "Masa Aktif Layanan Segera Berakhir"}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              {school.plan === "free"
                ? "Tagihan perdana atau perpanjangan dapat disiapkan secara instan. Sekolah akan otomatis di-upgrade ke kuota penuh setelah pembayaran QRIS diverifikasi."
                : "Untuk menjaga kesinambungan ujian online dan sinkronisasi data tanpa jeda, silakan perpanjang paket layanan Anda."}
            </p>
          </div>
          <button
            onClick={handleRequestRenewal}
            disabled={requestingRenewal}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
          >
            <CreditCard size={14} />
            {requestingRenewal ? "Menyiapkan Tagihan..." : "Perpanjang / Buat Tagihan"}
          </button>
        </div>
      )}

      {/* ── Stat Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={cn(
                "rounded-2xl border p-4 flex items-center gap-4 shadow-sm transition-colors",
                s.highlight
                  ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60"
                  : "bg-card border-slate-200/60 dark:border-slate-800/40"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border",
                s.iconBg
              )}>
                <Icon size={18} className={s.iconColor} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {s.label}
                </p>
                <p className={cn(
                  "text-xl font-black leading-tight mt-0.5 truncate",
                  s.highlight ? "text-amber-800 dark:text-amber-300" : "text-slate-900 dark:text-white"
                )}>
                  {s.value}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{s.note}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Invoice List ─────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-2xl p-16 text-center shadow-sm">
          <RefreshCw size={22} className="text-slate-400 mx-auto animate-spin" />
          <p className="text-sm text-slate-400 mt-3">Memuat invoice...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-2xl p-16 text-center shadow-sm">
          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Belum ada invoice</p>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
            Invoice akan muncul di sini setelah dikeluarkan oleh admin EXAM AA.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {invoices.map(inv => {
            const effectiveStatus = getInvoiceStatus(inv);
            const cfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.unpaid;
            const StatusIcon = cfg.icon;
            const hasProof = !!inv.payment_proof;
            const needsAction = effectiveStatus === "unpaid" || effectiveStatus === "overdue";

            return (
              <div
                key={inv.id}
                className={cn(
                  "bg-card border rounded-2xl p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-600 shadow-sm",
                  effectiveStatus === "overdue"
                    ? "border-red-200 dark:border-red-800/50 bg-red-50/40 dark:bg-red-950/10"
                    : "border-slate-200/60 dark:border-slate-800/40"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">

                  {/* Status icon strip */}
                  <div className={cn(
                    "hidden sm:flex w-10 h-10 rounded-xl items-center justify-center flex-shrink-0 border",
                    cfg.bg, cfg.border
                  )}>
                    <StatusIcon size={16} className={cfg.color} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                        {inv.invoice_number}
                      </span>
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                        cfg.color, cfg.bg, cfg.border
                      )}>
                        <StatusIcon size={10} />
                        {cfg.label}
                      </span>
                      {hasProof && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 px-2 py-0.5 rounded-full">
                          <Paperclip size={9} />
                          Bukti diunggah
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">
                      {PLAN_PRICES[inv.plan]?.label || inv.plan} Plan
                      <span className="font-normal text-slate-500 dark:text-slate-400"> · {inv.duration_months} bulan</span>
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {inv.status === "paid" && inv.paid_date
                        ? `Dibayar ${formatDate(inv.paid_date)}`
                        : `Jatuh tempo ${formatDate(inv.due_date)}`
                      }
                    </p>
                  </div>

                  {/* Amount + Actions */}
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                    <p className="font-black text-base text-slate-900 dark:text-white">{formatRupiah(inv.amount)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setDetailInvoice(inv)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition bg-white dark:bg-slate-900 shadow-sm"
                      >
                        <Eye size={12} />
                        Detail
                      </button>
                      {inv.status === "paid" && (
                        <button
                          onClick={() => printOfficialReceipt(inv, school)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition bg-emerald-50/60 dark:bg-emerald-950/20 shadow-sm"
                          title="Cetak Kwitansi Pembayaran Resmi (SPJ)"
                        >
                          <Receipt size={12} />
                          Kwitansi
                        </button>
                      )}
                      {needsAction && (
                        <>
                          <button
                            onClick={() => handlePayWithQris(inv)}
                            disabled={payingInvoiceId === inv.id}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition shadow-sm"
                          >
                            <QrCode size={13} className={payingInvoiceId === inv.id ? "animate-spin" : ""} />
                            {payingInvoiceId === inv.id ? "Memproses..." : "Bayar QRIS"}
                          </button>
                          {!hasProof && (
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition shadow-sm border border-slate-200/60 dark:border-slate-700">
                              <Upload size={12} />
                              Upload
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleProofUpload(inv.id, file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Info Box ─────────────────────────────────────────────── */}
      {invoices.length > 0 && (
        <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-2xl p-4 flex gap-3">
          <div className="w-8 h-8 bg-blue-600/10 dark:bg-blue-400/10 rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-100 dark:border-blue-900/30">
            <CreditCard size={14} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-0.5">Cara membayar</p>
            <p className="text-xs leading-relaxed text-blue-700 dark:text-blue-400">
              Lakukan transfer sesuai jumlah tagihan, kemudian upload bukti transfer di halaman detail invoice.
              Tim EXAM AA akan memverifikasi dan mengubah status menjadi Lunas.
            </p>
          </div>
        </div>
      )}

      {/* ─── Detail Modal ──────────────────────────────────────────── */}
      {detailInvoice && (() => {
        const effectiveStatus = getInvoiceStatus(detailInvoice);
        const modalCfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.unpaid;
        const ModalStatusIcon = modalCfg.icon;

        return (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200/60 dark:border-slate-800">

              {/* Modal Header */}
              <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                      {detailInvoice.invoice_number}
                    </span>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                      modalCfg.color, modalCfg.bg, modalCfg.border
                    )}>
                      <ModalStatusIcon size={11} />
                      {modalCfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                    Diterbitkan {formatDate(detailInvoice.created)}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  {detailInvoice.status === "paid" && (
                    <button
                      onClick={() => printOfficialReceipt(detailInvoice, school)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition bg-emerald-50/60 dark:bg-emerald-950/20 shadow-xs"
                      title="Cetak Kwitansi Resmi (SPJ)"
                    >
                      <Receipt size={12} />
                      Kwitansi (SPJ)
                    </button>
                  )}
                  <button
                    onClick={() => printInvoice(detailInvoice)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition bg-white dark:bg-slate-900"
                  >
                    <Printer size={12} />
                    Cetak Invoice
                  </button>
                  <button
                    onClick={() => setDetailInvoice(null)}
                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">

                {/* Invoice Breakdown */}
                <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Rincian Tagihan</p>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {[
                      { label: "Layanan", value: `${PLAN_PRICES[detailInvoice.plan]?.label || detailInvoice.plan} Plan` },
                      { label: "Durasi", value: `${detailInvoice.duration_months} bulan` },
                      { label: "Jatuh Tempo", value: formatDate(detailInvoice.due_date) },
                      ...(detailInvoice.paid_date ? [{ label: "Tanggal Bayar", value: formatDate(detailInvoice.paid_date) }] : []),
                    ].map(row => (
                      <div key={row.label} className="flex justify-between px-4 py-2.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{row.label}</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{row.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900">
                      <span className="text-sm font-black text-slate-700 dark:text-slate-200">Total</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">{formatRupiah(detailInvoice.amount)}</span>
                    </div>
                  </div>
                </div>

                {detailInvoice.notes && (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Catatan dari Admin</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{detailInvoice.notes}</p>
                  </div>
                )}

                {/* Instant QRIS Payment Box */}
                {(detailInvoice.status === "unpaid" || detailInvoice.status === "overdue") && (
                  <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
                    <div>
                      <p className="text-xs font-bold text-blue-900 dark:text-blue-200">Bayar Otomatis via QRIS</p>
                      <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                        Status langganan langsung lunas otomatis dalam hitungan detik tanpa perlu upload bukti.
                      </p>
                    </div>
                    <button
                      onClick={() => handlePayWithQris(detailInvoice)}
                      disabled={payingInvoiceId === detailInvoice.id}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition shadow-sm flex-shrink-0"
                    >
                      <QrCode size={14} className={payingInvoiceId === detailInvoice.id ? "animate-spin" : ""} />
                      {payingInvoiceId === detailInvoice.id ? "Menyiapkan QRIS..." : "Bayar Sekarang"}
                    </button>
                  </div>
                )}

                {/* Proof Upload Section */}
                <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Paperclip size={13} className="text-slate-500 dark:text-slate-400" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Bukti Pembayaran</span>
                    </div>
                    {(detailInvoice.status === "unpaid" || detailInvoice.status === "overdue") && (
                      <label className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition border",
                        uploadingProof
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-700"
                          : "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                      )}>
                        <Upload size={11} />
                        {uploadingProof ? "Mengupload..." : "Upload"}
                        <input
                          ref={proofFileRef}
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          disabled={uploadingProof}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleProofUpload(detailInvoice.id, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <div className="p-4">
                    {detailInvoice.payment_proof ? (
                      <div className="space-y-3">
                        {isImageProof(getProofUrl(detailInvoice)) ? (
                          <div className="relative group">
                            <img
                              src={getProofUrl(detailInvoice)}
                              alt="Bukti pembayaran"
                              className="w-full max-h-56 object-contain rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-xl transition flex items-center justify-center">
                              <a
                                href={getProofUrl(detailInvoice)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl shadow-md text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                              >
                                <ExternalLink size={12} />
                                Buka penuh
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                            <FileText size={22} className="text-blue-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Dokumen Lampiran</p>
                              <p className="text-xs text-slate-400">Klik untuk membuka</p>
                            </div>
                            <a
                              href={getProofUrl(detailInvoice)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-950/50 transition"
                            >
                              <ExternalLink size={12} />
                              Buka
                            </a>
                          </div>
                        )}
                        {(detailInvoice.status === "unpaid" || detailInvoice.status === "overdue") && (
                          <button
                            onClick={() => removeProof(detailInvoice.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-700 transition"
                          >
                            <Trash2 size={12} />
                            Hapus dan upload ulang
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Upload size={20} className="text-slate-400" />
                        </div>
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                          {detailInvoice.status === "paid"
                            ? "Tidak ada bukti yang diunggah."
                            : "Belum ada bukti pembayaran."}
                        </p>
                        {(detailInvoice.status === "unpaid" || detailInvoice.status === "overdue") && (
                          <p className="text-xs text-slate-400 mt-1">Upload gambar atau PDF (maks. 5 MB)</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Paid Confirmation */}
                {detailInvoice.status === "paid" && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-emerald-600/10 dark:bg-emerald-400/10 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                        <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Pembayaran dikonfirmasi</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
                          {detailInvoice.paid_date ? `Lunas pada ${formatDate(detailInvoice.paid_date)}` : "Sudah terverifikasi"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => printOfficialReceipt(detailInvoice, school)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 flex-shrink-0"
                    >
                      <Receipt size={13} />
                      <span>Cetak Kwitansi SPJ</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Realtime QRIS Payment Session ── */}
      {paymentSession && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200/80 dark:border-slate-800 overflow-hidden text-center p-6">
            {!paymentSession.isPaid ? (
              <div className="space-y-5">
                {/* Visual Radar / Pulse */}
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                  <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm relative z-10">
                    <QrCode size={32} />
                  </div>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 mb-2">
                    <Clock size={12} className="animate-spin" />
                    <span>Menunggu Pembayaran</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {formatRupiah(paymentSession.invoice.amount)}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                    Invoice: <span className="font-mono text-slate-700 dark:text-slate-200">{paymentSession.invoice.invoice_number}</span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-3.5 text-left text-xs space-y-1.5">
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    Petunjuk Pelunasan:
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                    Tab pembayaran QRIS telah dibuka. Silakan lakukan scan menggunakan aplikasi mobile banking atau e-wallet Anda. Sistem akan mendeteksi pelunasan secara otomatis tanpa perlu merefresh halaman ini.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => window.open(paymentSession.paymentUrl, "_blank")}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={14} />
                    <span>Buka Ulang Halaman QRIS</span>
                  </button>
                  <button
                    onClick={() => setPaymentSession(null)}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-xl text-xs transition"
                  >
                    Tutup Sementara (Tetap Diproses di Latar)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5 animate-in zoom-in-95 duration-300">
                {/* Visual Celebration */}
                <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 size={40} className="animate-in zoom-in-75 duration-300" />
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 mb-2">
                    <Sparkles size={12} />
                    <span>Transaksi Lunas Terverifikasi</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Pembayaran Berhasil!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    Tagihan <strong>{paymentSession.invoice.invoice_number}</strong> telah terbayar lunas. Paket institusi <strong>{school.name}</strong> kini aktif dengan kuota penuh.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => printOfficialReceipt(paymentSession.invoice, school)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2"
                  >
                    <Receipt size={14} />
                    <span>Cetak Kwitansi Pembayaran Resmi (SPJ)</span>
                  </button>
                  <button
                    onClick={() => {
                      setPaymentSession(null);
                      if (detailInvoice?.id === paymentSession.invoice.id) {
                        setDetailInvoice(null);
                      }
                    }}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolInvoicePage;
