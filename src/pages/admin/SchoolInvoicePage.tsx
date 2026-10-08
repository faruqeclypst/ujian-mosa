import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText, Upload, Eye, Printer, CheckCircle2, Clock,
  AlertTriangle, XCircle, Paperclip, ExternalLink, Trash2,
  RefreshCw, X, CreditCard, TrendingUp, QrCode, Sparkles,
  Send, Building2, Calendar, ShieldCheck, MessageCircle,
  Copy, Check, ChevronRight, Info
} from "lucide-react";
import { Landmark } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";
import {
  calculatePlanInvoice,
  normalizePlanKey,
  PLAN_PRICING,
  PlanKey,
} from "../../utils/pricingHelper";
import { printDigitalInvoice } from "../../utils/invoicePdfHelper";
import { isTopupInvoice } from "../../utils/subscriptionHelper";
import { ProofLightbox, isImageProof } from "../../components/ProofLightbox";

// ─── Types ───────────────────────────────────────────────────

type PaymentStatus = "unpaid" | "paid" | "overdue" | "cancelled" | "pending";

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
  pending:   { label: "Menunggu Verifikasi", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: Clock },
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
  // Sudah upload bukti transfer tapi belum diverifikasi → menunggu verifikasi
  if (invoice.status === "unpaid" && invoice.payment_proof) {
    return "pending";
  }
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
  const baseUrl = masterPb.baseUrl.replace(/\/$/, "");
  return `${baseUrl}/api/files/invoices/${inv.id}/${inv.payment_proof}`;
};

// ─── Component ────────────────────────────────────────────────


const POPULAR_BANKS = [
  { code: "BCA", name: "Bank BCA", logo: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg" },
  { code: "BRI", name: "Bank BRI", logo: "https://upload.wikimedia.org/wikipedia/commons/2/2e/BRI_2020.svg" },
  { code: "JAGO", name: "Bank Jago", logo: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Logo_Bank_Jago.png" },
  { code: "SEABANK", name: "SeaBank", logo: "https://upload.wikimedia.org/wikipedia/commons/f/f1/SeaBank_logo.png" },
];

const SchoolInvoicePage = () => {
  const { school, refreshSchool } = useTenant();
  const [banks, setBanks] = useState<{bank_name: string, bank_code: string, account_number: string, account_name: string}[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofView, setProofView] = useState<Invoice | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{ type: "success" | "cancelled"; message: string } | null>(null);
  const [paymentSession, setPaymentSession] = useState<{
    invoice: Invoice;
    paymentUrl: string;
    isPaid: boolean;
  } | null>(null);

  // Modal pengajuan perpanjangan (tenant request ke admin)
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(12);
  const [selectedPlan, setSelectedPlan] = useState<string>(school?.plan || "basic");
  const [renewalNotes, setRenewalNotes] = useState<string>("");
  const [submittingRenewal, setSubmittingRenewal] = useState(false);
  const [renewalSubmitted, setRenewalSubmitted] = useState(false);

  const proofFileRef = useRef<HTMLInputElement>(null);

  const loadInvoices = useCallback(async () => {
    if (!school) { setLoading(false); return; }
    setLoading(true);
    try {
      try {
        const banksRes = await masterPb.collection("bank_accounts").getFullList({ filter: 'is_active = true' });
        setBanks(banksRes as any);
      } catch(e) {}
      const result = await masterPb.collection("invoices").getList<Invoice>(1, 30);
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
          duration_months: Number.isFinite(Number(r.duration_months)) ? Number(r.duration_months) : 1,
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

  // Kirim Permohonan Perpanjangan ke Admin (tidak langsung bikin invoice)
  const handleSubmitRenewalRequest = async () => {
    if (!school) return;
    setSubmittingRenewal(true);
    try {
      await masterPb.collection("school_requests").create({
        school_name: school.name,
        slug_request: school.slug,
        contact_email: school.contact_email || "",
        type: "renewal",
        plan: selectedPlan,
        duration: `${selectedDuration} bulan`,
        status: "pending",
        address: renewalNotes || `Pengajuan perpanjangan lisensi CBT ${school.name}`,
      });
      setRenewalSubmitted(true);
      setPaymentNotice({
        type: "success",
        message: "Permohonan perpanjangan berhasil dikirim ke SuperAdmin. Admin akan memeriksa dan menerbitkan invoice resmi untuk sekolah Anda.",
      });
    } catch (err: any) {
      console.error("Gagal kirim permohonan:", err);
      setRenewalSubmitted(true);
    } finally {
      setSubmittingRenewal(false);
    }
  };

  const unpaidInvoices = invoices.filter(i => getInvoiceStatus(i) === "unpaid" || getInvoiceStatus(i) === "overdue");
  const unpaidCount = unpaidInvoices.length;
  const pendingInvoices = invoices.filter(i => getInvoiceStatus(i) === "pending");
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const activeUnpaidInvoice = unpaidInvoices[0] || null;
  const activePendingInvoice = pendingInvoices[0] || null;

  if (!school) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-slate-500">Data institusi tidak ditemukan.</p>
      </div>
    );
  }

  const selectedPlanLabel = PLAN_PRICES[selectedPlan]?.label || selectedPlan;
  const waMessage = encodeURIComponent(
    `Halo Admin EXAMKU, kami dari *${school.name}* (ID: ${school.slug}) ingin mengajukan *perpanjangan layanan CBT*:\n- Paket: *${selectedPlanLabel}*\n- Durasi: *${selectedDuration} Bulan*\n- Kuota: *${school.student_quota || 0} Siswa*\n${renewalNotes ? `- Catatan: ${renewalNotes}\n` : ""}Mohon bantu terbitkan tagihan/invoice resmi. Terima kasih.`
  );
  const waUrl = `https://wa.me/6285359907696?text=${waMessage}`;

  // Sisa hari masa aktif (untuk pengingat H-7 / H-3 / H-1)
  const daysLeftActive = school?.active_until
    ? Math.ceil((new Date(school.active_until.replace(" ", "T")).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const stats = [
    {
      label: "Total Invoice",
      value: String(invoices.length),
      note: "semua periode",
      icon: FileText,
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
    <div className="mx-auto w-full max-w-3xl">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Tagihan
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            Faktur resmi, pembayaran QRIS &amp; transfer, dan perpanjangan layanan {school.name}.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadInvoices}
            disabled={loading}
            title="Muat ulang"
            aria-label="Muat ulang"
            className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => { setRenewalSubmitted(false); setShowRenewalModal(true); }}
            className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">Minta Perpanjangan</span>
            <span className="sm:hidden">Perpanjang</span>
          </button>
        </div>
      </div>

      {/* ── Notifikasi pembayaran ── */}
      {paymentNotice && (
        <div className={cn(
          "mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3",
          paymentNotice.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
            : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        )}>
          {paymentNotice.type === "success"
            ? <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            : <Clock size={18} className="text-slate-400 shrink-0" />}
          <p className="flex-1 text-[13px] font-medium leading-relaxed">{paymentNotice.message}</p>
          <button
            type="button"
            onClick={() => setPaymentNotice(null)}
            aria-label="Tutup notifikasi"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ══ TAGIHAN AKTIF ══ */}
      {activePendingInvoice ? (
        <section className="mb-6 overflow-hidden rounded-3xl border border-blue-200 dark:border-blue-900/50 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between gap-3 bg-blue-600 px-5 py-3.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white">
              <Clock size={13} /> Menunggu verifikasi
            </span>
            <span className="font-mono text-[11px] font-bold text-blue-100">{activePendingInvoice.invoice_number}</span>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Nominal yang ditransfer</p>
            <p className="mt-1 text-4xl font-black tracking-tight tabular-nums text-slate-900 dark:text-white">
              {formatRupiah(activePendingInvoice.amount)}
            </p>
            <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
              {PLAN_PRICES[activePendingInvoice.plan]?.label || activePendingInvoice.plan} ·{" "}
              {isTopupInvoice(activePendingInvoice) ? "top-up kuota" : `${activePendingInvoice.duration_months} bulan`}
            </p>

            <button
              type="button"
              onClick={() => setProofView(activePendingInvoice)}
              title="Ketuk untuk memperbesar"
              className="mt-5 block w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
            >
              {isImageProof(getProofUrl(activePendingInvoice)) ? (
                <img src={getProofUrl(activePendingInvoice)} alt="Bukti transfer" className="w-full max-h-60 object-contain" />
              ) : (
                <span className="flex items-center gap-3 p-4">
                  <FileText size={28} className="text-blue-500 shrink-0" />
                  <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">Dokumen PDF, ketuk untuk melihat</span>
                </span>
              )}
            </button>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setProofView(activePendingInvoice)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition"
              >
                <Eye size={15} /> Lihat Bukti
              </button>
              <label className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
                <Upload size={15} />
                {uploadingProof ? "Mengunggah..." : "Upload Ulang"}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  disabled={uploadingProof}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleProofUpload(activePendingInvoice.id, f); e.target.value = ""; }}
                />
              </label>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-slate-400">
              <Info size={13} className="shrink-0 mt-0.5" />
              Bukti transfer sudah terkirim dan sedang diverifikasi SuperAdmin. Layanan aktif otomatis setelah disetujui.
            </p>
          </div>
        </section>
      ) : activeUnpaidInvoice ? (
        <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between gap-3 bg-slate-900 dark:bg-blue-700 px-5 py-3.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Tagihan aktif
            </span>
            <span className="font-mono text-[11px] font-bold text-slate-300 dark:text-blue-100">{activeUnpaidInvoice.invoice_number}</span>
          </div>
          <div className="p-5 sm:p-6">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total tagihan</p>
                <p className="mt-1 text-4xl font-black tracking-tight tabular-nums text-slate-900 dark:text-white">
                  {formatRupiah(activeUnpaidInvoice.amount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
                  {PLAN_PRICES[activeUnpaidInvoice.plan]?.label || activeUnpaidInvoice.plan}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isTopupInvoice(activeUnpaidInvoice) ? "Top-up kuota" : `${activeUnpaidInvoice.duration_months} bulan`} · jatuh tempo {formatDate(activeUnpaidInvoice.due_date)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handlePayWithQris(activeUnpaidInvoice)}
                disabled={payingInvoiceId === activeUnpaidInvoice.id}
                className="inline-flex items-center justify-center gap-1.5 h-12 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold transition shadow-sm"
              >
                <QrCode size={16} className={payingInvoiceId === activeUnpaidInvoice.id ? "animate-spin" : ""} />
                {payingInvoiceId === activeUnpaidInvoice.id ? "Memproses..." : "Bayar via QRIS"}
              </button>
              {!activeUnpaidInvoice.payment_proof && (
                <label className="inline-flex items-center justify-center gap-1.5 h-12 px-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-bold hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer">
                  <Upload size={16} />
                  {uploadingProof ? "Mengunggah..." : "Upload Bukti Transfer"}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    disabled={uploadingProof}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleProofUpload(activeUnpaidInvoice.id, f); e.target.value = ""; }}
                  />
                </label>
              )}
            </div>

            {banks.length > 0 && (
              <div className="mt-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">
                  <Landmark size={14} className="text-slate-400" /> Transfer manual ke rekening:
                </p>
                <div className="space-y-2">
                  {banks.map((b, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 px-3.5 py-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">{b.bank_name} <span className="font-normal">a.n. {b.account_name}</span></p>
                        <p className="font-mono text-base font-extrabold tabular-nums tracking-wide text-slate-900 dark:text-white">{b.account_number}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(b.account_number).catch(() => {});
                          setCopiedIdx(i);
                          window.setTimeout(() => setCopiedIdx(null), 1500);
                        }}
                        className={cn(
                          "inline-flex items-center gap-1 px-3 h-9 rounded-lg text-xs font-bold transition shrink-0",
                          copiedIdx === i
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
                        )}
                      >
                        {copiedIdx === i ? <Check size={13} /> : <Copy size={13} />}
                        {copiedIdx === i ? "Tersalin" : "Salin"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setDetailInvoice(activeUnpaidInvoice)}
              className="mt-4 text-[13px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Lihat rincian tagihan
            </button>
          </div>
        </section>
      ) : (
        <section className="mb-6 rounded-3xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-6 sm:p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={26} />
          </div>
          <h2 className="mt-3 text-base font-extrabold text-slate-900 dark:text-white">Semua tagihan lunas</h2>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Tidak ada tagihan aktif saat ini. Riwayat pembayaran ada di bawah.</p>
        </section>
      )}

      {/* ── Pengingat masa aktif ── */}
      {!activePendingInvoice && !activeUnpaidInvoice && school && (school.plan === "free" || (daysLeftActive !== null && daysLeftActive <= 30)) && (
        <div className={cn(
          "mb-6 flex items-start gap-3 rounded-2xl border p-4",
          daysLeftActive !== null && daysLeftActive <= 3 && school.plan !== "free"
            ? "border-red-200 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/20"
            : "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20"
        )}>
          <Sparkles size={16} className={cn("mt-0.5 shrink-0", daysLeftActive !== null && daysLeftActive <= 3 && school.plan !== "free" ? "text-red-500" : "text-amber-500")} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900 dark:text-white">
              {school.plan === "free"
                ? "Akun Free Trial (50 siswa)"
                : daysLeftActive !== null && daysLeftActive <= 1
                  ? `Masa aktif berakhir ${daysLeftActive <= 0 ? "hari ini" : "besok"}`
                  : daysLeftActive !== null && daysLeftActive <= 7
                    ? `Sisa ${daysLeftActive} hari masa aktif`
                    : "Masa aktif segera berakhir"}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {school.plan === "free"
                ? "Upgrade ke paket berbayar untuk kuota penuh dan fitur CBT tanpa batas."
                : "Perpanjang layanan agar ujian dan sinkronisasi data tidak terhenti."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setRenewalSubmitted(false); setShowRenewalModal(true); }}
            className="shrink-0 h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
          >
            Perpanjang
          </button>
        </div>
      )}

      {/* ── Ringkasan ── */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                <Icon size={13} className={s.iconColor} />
                <span className="truncate">{s.label}</span>
              </p>
              <p className="mt-1 text-lg font-extrabold tabular-nums tracking-tight text-slate-900 dark:text-white truncate">{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* ── Riwayat ── */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-extrabold text-slate-900 dark:text-white">Riwayat Tagihan</h2>
        {loading ? (
          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
            <RefreshCw size={22} className="animate-spin mx-auto text-blue-600 mb-2" />
            <p className="text-xs font-semibold text-slate-500">Memuat tagihan...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
            <FileText size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-[13px] font-semibold text-slate-500">Belum ada tagihan.</p>
            <p className="text-xs text-slate-400 mt-0.5">Faktur resmi dari SuperAdmin akan muncul di sini.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {invoices.map((inv) => {
              const st = getInvoiceStatus(inv);
              const cfg = STATUS_CONFIG[st] || STATUS_CONFIG.unpaid;
              const RowIcon = cfg.icon;
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setDetailInvoice(inv)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">{inv.invoice_number}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                      {PLAN_PRICES[inv.plan]?.label || inv.plan} · {isTopupInvoice(inv) ? "top-up kuota" : `${inv.duration_months} bulan`} · {inv.status === "paid" && inv.paid_date ? `lunas ${formatDate(inv.paid_date)}` : `tempo ${formatDate(inv.due_date)}`}
                    </p>
                  </div>
                  <span className={cn("hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0", cfg.color, cfg.bg, cfg.border)}>
                    <RowIcon size={10} /> {cfg.label}
                  </span>
                  <p className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white shrink-0">{formatRupiah(inv.amount)}</p>
                  <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Modal Detail ── */}
      {detailInvoice && (() => {
        const effectiveStatus = getInvoiceStatus(detailInvoice);
        const modalCfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.unpaid;
        const ModalStatusIcon = modalCfg.icon;
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/70 p-0 sm:p-4"
            onClick={() => setDetailInvoice(null)}
          >
            <div
              className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-950 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[13px] font-bold text-slate-700 dark:text-slate-200">{detailInvoice.invoice_number}</span>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", modalCfg.color, modalCfg.bg, modalCfg.border)}>
                    <ModalStatusIcon size={10} /> {modalCfg.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailInvoice(null)}
                  aria-label="Tutup"
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <dl className="rounded-2xl border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden text-[13px]">
                  <div className="flex justify-between gap-3 px-4 py-3">
                    <dt className="text-slate-500">Layanan</dt>
                    <dd className="font-bold text-slate-900 dark:text-white text-right">{PLAN_PRICES[detailInvoice.plan]?.label || detailInvoice.plan} Plan</dd>
                  </div>
                  <div className="flex justify-between gap-3 px-4 py-3">
                    <dt className="text-slate-500">Durasi</dt>
                    <dd className="font-bold text-slate-900 dark:text-white text-right">{isTopupInvoice(detailInvoice) ? "Top-up kuota" : `${detailInvoice.duration_months} bulan`}</dd>
                  </div>
                  <div className="flex justify-between gap-3 px-4 py-3">
                    <dt className="text-slate-500">Jatuh tempo</dt>
                    <dd className="font-bold text-slate-900 dark:text-white text-right">{formatDate(detailInvoice.due_date)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-900/60">
                    <dt className="font-bold text-slate-700 dark:text-slate-200">Total</dt>
                    <dd className="font-extrabold tabular-nums text-blue-600 dark:text-blue-400 text-right">{formatRupiah(detailInvoice.amount)}</dd>
                  </div>
                </dl>

                {effectiveStatus === "pending" && detailInvoice.payment_proof && (
                  <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/20 p-4">
                    <p className="flex items-center gap-1.5 text-[13px] font-bold text-blue-800 dark:text-blue-200">
                      <Clock size={14} /> Menunggu verifikasi
                    </p>
                    <p className="mt-0.5 text-xs text-blue-600/80 dark:text-blue-300/80">Bukti transfer terkirim. Layanan aktif otomatis setelah disetujui.</p>
                    <button
                      type="button"
                      onClick={() => setProofView(detailInvoice)}
                      className="mt-3 block w-full overflow-hidden rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900"
                    >
                      {isImageProof(getProofUrl(detailInvoice)) ? (
                        <img src={getProofUrl(detailInvoice)} alt="Bukti transfer" className="w-full max-h-56 object-contain" />
                      ) : (
                        <span className="flex items-center gap-2.5 p-3.5">
                          <FileText size={24} className="text-blue-500 shrink-0" />
                          <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Dokumen PDF, ketuk untuk melihat</span>
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeProof(detailInvoice.id)}
                      className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      Hapus &amp; upload ulang
                    </button>
                  </div>
                )}

                {detailInvoice.status === "paid" && (
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
                    <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-[13px] font-bold text-emerald-800 dark:text-emerald-200">
                        Lunas{detailInvoice.paid_date ? ` · ${formatDate(detailInvoice.paid_date)}` : ""}
                      </p>
                      <p className="text-xs text-emerald-600/80 dark:text-emerald-300/70">Pembayaran terverifikasi.</p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => printDigitalInvoice(detailInvoice, school)}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <Printer size={15} /> Cetak Invoice (PDF)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Perpanjangan ── */}
      {showRenewalModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/70 p-0 sm:p-4"
          onClick={() => setShowRenewalModal(false)}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-950 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">Minta Perpanjangan</h3>
                <p className="text-xs text-slate-500 mt-0.5">Permohonan diteruskan ke SuperAdmin</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRenewalModal(false)}
                aria-label="Tutup"
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              {!renewalSubmitted ? (
                <div className="space-y-5">
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 p-4">
                    <p className="text-[13px] font-bold text-slate-900 dark:text-white">{school.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <code className="font-mono text-blue-600 font-bold">{school.slug}.examku.my.id</code>
                      {" · "}{school.student_quota || 50} siswa
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">Paket layanan</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: "basic", label: "Berkembang", note: "100–300 siswa" },
                        { key: "pro", label: "Lanjutan", note: "300–600 siswa" },
                        { key: "ultimate", label: "Premium", note: "600+ siswa" },
                      ].map(p => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setSelectedPlan(p.key)}
                          className={cn(
                            "rounded-2xl border p-3 text-left transition",
                            selectedPlan === p.key
                              ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/40"
                              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                          )}
                        >
                          <p className={cn("text-[13px] font-bold", selectedPlan === p.key ? "text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-slate-100")}>{p.label}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{p.note}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">Durasi</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4, 5, 6, 12].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedDuration(m)}
                          className={cn(
                            "rounded-xl border py-2.5 text-xs font-bold transition",
                            selectedDuration === m
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                          )}
                        >
                          {m} bln
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Catatan <span className="font-normal text-slate-400">(opsional)</span>
                    </label>
                    <textarea
                      value={renewalNotes}
                      onChange={e => setRenewalNotes(e.target.value)}
                      rows={3}
                      placeholder="Contoh: tambah kuota untuk persiapan PAS..."
                      className="mt-1.5 w-full text-[13px] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={handleSubmitRenewalRequest}
                      disabled={submittingRenewal}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold transition"
                    >
                      <Send size={14} className={submittingRenewal ? "animate-spin" : ""} />
                      {submittingRenewal ? "Mengirim..." : "Kirim Permohonan"}
                    </button>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={30} />
                  </div>
                  <h4 className="mt-4 text-[15px] font-extrabold text-slate-900 dark:text-white">Permohonan terkirim</h4>
                  <p className="mt-1 text-[13px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                    SuperAdmin akan memeriksa dan menerbitkan faktur resmi untuk <strong>{school.name}</strong>.
                  </p>
                  <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition"
                    >
                      <MessageCircle size={14} /> Konfirmasi via WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowRenewalModal(false)}
                      className="h-11 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold transition"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal QRIS ── */}
      {paymentSession && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/70 p-0 sm:p-4">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-950 shadow-2xl p-6 text-center">
            {!paymentSession.isPaid ? (
              <div className="space-y-5">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-600/10 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <QrCode size={30} />
                </div>
                <div>
                  <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <Clock size={11} className="animate-spin" /> Menunggu pembayaran
                  </p>
                  <p className="mt-2 text-3xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
                    {formatRupiah(paymentSession.invoice.amount)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-400">{paymentSession.invoice.invoice_number}</p>
                </div>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 p-3.5 text-left">
                  Tab pembayaran QRIS telah dibuka di tab baru. Pindai kodenya dengan mobile banking atau e-wallet. Halaman ini mendeteksi pelunasan otomatis.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(paymentSession.paymentUrl, "_blank")}
                    className="w-full h-11 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition"
                  >
                    <ExternalLink size={14} /> Buka Ulang Halaman QRIS
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentSession(null)}
                    className="w-full h-10 rounded-2xl text-[13px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Tutup (tetap diproses)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-600/10 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Pembayaran berhasil</h3>
                  <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">
                    Tagihan <strong className="font-mono">{paymentSession.invoice.invoice_number}</strong> lunas. Paket {school.name} kini aktif.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => printDigitalInvoice(paymentSession.invoice, school)}
                    className="w-full h-11 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition"
                  >
                    <Printer size={14} /> Cetak Invoice (PDF)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentSession(null);
                      if (detailInvoice?.id === paymentSession.invoice.id) setDetailInvoice(null);
                    }}
                    className="w-full h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold transition"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Lightbox Bukti ── */}
      {proofView && (
        <ProofLightbox
          url={getProofUrl(proofView)}
          title={`Bukti Pembayaran ${proofView.invoice_number}`}
          onClose={() => setProofView(null)}
        />
      )}
    </div>
  );
};

export default SchoolInvoicePage;
