import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText, Upload, Eye, Printer, CheckCircle2, Clock,
  AlertTriangle, XCircle, Paperclip, ExternalLink, Trash2,
  RefreshCw, X, CreditCard, TrendingUp, QrCode, Sparkles,
  Send, Building2, Calendar, ShieldCheck, MessageCircle
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
import { printDigitalInvoice } from "../../utils/invoicePdfHelper";

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
  const baseUrl = masterPb.baseUrl.replace(/\/$/, "");
  return `${baseUrl}/api/files/invoices/${inv.id}/${inv.payment_proof}`;
};

const isImageProof = (proofUrl: string): boolean => {
  if (!proofUrl) return false;
  if (proofUrl.startsWith("data:image")) return true;
  return /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(proofUrl);
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
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const activeUnpaidInvoice = unpaidInvoices[0] || null;

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
    <div className="space-y-5">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600/10 dark:bg-blue-400/10 rounded-xl flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Tagihan & Langganan</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola faktur resmi, pembayaran QRIS, dan permohonan perpanjangan layanan sekolah
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              setRenewalSubmitted(false);
              setShowRenewalModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm"
            title="Minta pengajuan perpanjangan layanan ke Admin"
          >
            <Sparkles size={13} />
            <span>Minta Perpanjangan</span>
          </button>
          <button
            onClick={loadInvoices}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
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
      {activeUnpaidInvoice ? (
        <div className="bg-gradient-to-r from-blue-600/10 via-blue-600/5 to-indigo-600/10 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Tagihan Perpanjangan Resmi Siap Dibayar ({activeUnpaidInvoice.invoice_number})
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              SuperAdmin telah menerbitkan invoice perpanjangan untuk sekolah Anda sebesar <strong>{formatRupiah(activeUnpaidInvoice.amount)}</strong>. Silakan bayar via QRIS untuk mengaktifkan masa berlaku baru.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => printDigitalInvoice(activeUnpaidInvoice, school)}
              className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
            >
              <Printer size={13} />
              <span>Invoice PDF</span>
            </button>
            <button
              onClick={() => handlePayWithQris(activeUnpaidInvoice)}
              disabled={payingInvoiceId === activeUnpaidInvoice.id}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
            >
              <QrCode size={14} className={payingInvoiceId === activeUnpaidInvoice.id ? "animate-spin" : ""} />
              <span>Bayar QRIS</span>
            </button>
          </div>
        </div>
      ) : (school && (school.plan === "free" || (school.active_until && Math.ceil((new Date(school.active_until.replace(" ", "T")).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 30))) ? (
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
                ? "Untuk meng-upgrade ke kuota siswa penuh dan membuka fitur CBT tanpa batas, silakan kirim permohonan ke Tim Admin."
                : "Untuk menjaga kesinambungan ujian online dan sinkronisasi data tanpa jeda, silakan minta perpanjangan paket layanan ke Admin."}
            </p>
          </div>
          <button
            onClick={() => {
              setRenewalSubmitted(false);
              setShowRenewalModal(true);
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 flex-shrink-0"
          >
            <Sparkles size={14} />
            <span>Minta Perpanjangan ke Admin</span>
          </button>
        </div>
      ) : null}

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
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border", s.iconBg)}>
                <Icon size={22} className={s.iconColor} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{s.label}</p>
                <p className="text-lg font-black text-slate-900 dark:text-white tracking-tight mt-0.5 truncate">{s.value}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{s.note}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Invoices List ────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-card rounded-2xl border border-slate-200/60 dark:border-slate-800/40 p-12 text-center shadow-sm">
          <RefreshCw size={24} className="animate-spin mx-auto text-blue-600 dark:text-blue-400 mb-3" />
          <p className="text-xs font-semibold text-slate-500">Memuat data tagihan resmi...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-card rounded-2xl border border-slate-200/60 dark:border-slate-800/40 p-12 text-center shadow-sm space-y-3">
          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <FileText size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Belum Ada Tagihan</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
              Belum ada riwayat tagihan yang diterbitkan untuk sekolah Anda. Klik tombol di bawah jika Anda ingin meminta invoice perpanjangan ke Admin.
            </p>
          </div>
          <button
            onClick={() => {
              setRenewalSubmitted(false);
              setShowRenewalModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Sparkles size={13} />
            <span>Minta Perpanjangan ke Admin</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const effectiveStatus = getInvoiceStatus(inv);
            const cfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.unpaid;
            const StatusIcon = cfg.icon;
            const needsAction = effectiveStatus === "unpaid" || effectiveStatus === "overdue";
            const hasProof = Boolean(inv.payment_proof);

            return (
              <div
                key={inv.id}
                className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        {inv.invoice_number}
                      </span>
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                        cfg.color, cfg.bg, cfg.border
                      )}>
                        <StatusIcon size={11} />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
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
                      <button
                        onClick={() => printDigitalInvoice(inv, school)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition bg-white dark:bg-slate-900 shadow-sm"
                        title="Cetak atau Simpan Invoice Digital (PDF)"
                      >
                        <Printer size={12} />
                        Invoice PDF
                      </button>
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

      {/* ── Modal Pengajuan Perpanjangan ke Admin ─────────────────── */}
      {showRenewalModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/70 dark:border-slate-800">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center border border-blue-200/60">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Pengajuan Perpanjangan Layanan</h3>
                  <p className="text-xs text-slate-500">Kirim permintaan ke SuperAdmin untuk penerbitan invoice resmi</p>
                </div>
              </div>
              <button
                onClick={() => setShowRenewalModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!renewalSubmitted ? (
                <>
                  {/* Current School Info */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1">
                    <p className="font-bold text-slate-900 dark:text-white">{school.name}</p>
                    <p className="text-slate-500">Subdomain: <code className="font-mono text-blue-600 font-bold">{school.slug}.examku.my.id</code></p>
                    <p className="text-slate-500">Kuota Saat Ini: <strong>{school.student_quota || 50} Siswa</strong></p>
                  </div>

                  {/* Pilih Paket */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Pilih Paket Layanan</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: "basic", label: "Berkembang", note: "100-300 Siswa" },
                        { key: "pro", label: "Lanjutan", note: "300-600 Siswa" },
                        { key: "ultimate", label: "Premium", note: "600+ Siswa" },
                      ].map(p => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setSelectedPlan(p.key)}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all",
                            selectedPlan === p.key
                              ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold shadow-2xs"
                              : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300"
                          )}
                        >
                          <p className="text-xs font-bold">{p.label}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{p.note}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pilih Durasi */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Durasi Perpanjangan</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { months: 6, label: "6 Bulan", sub: "1 Semester" },
                        { months: 12, label: "12 Bulan", sub: "1 Tahun (Disarankan)" },
                        { months: 24, label: "24 Bulan", sub: "2 Tahun" },
                      ].map(d => (
                        <button
                          key={d.months}
                          type="button"
                          onClick={() => setSelectedDuration(d.months)}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all",
                            selectedDuration === d.months
                              ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold shadow-2xs"
                              : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300"
                          )}
                        >
                          <p className="text-xs font-bold">{d.label}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{d.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Catatan / Kebutuhan Khusus */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Catatan Tambahan (Opsional)
                    </label>
                    <textarea
                      value={renewalNotes}
                      onChange={e => setRenewalNotes(e.target.value)}
                      placeholder="Contoh: Kami ingin tambah kuota jadi 400 siswa untuk persiapan ujian PAS semester genap..."
                      rows={3}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={handleSubmitRenewalRequest}
                      disabled={submittingRenewal}
                      className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Send size={14} className={submittingRenewal ? "animate-spin" : ""} />
                      <span>{submittingRenewal ? "Mengirim..." : "Kirim Permohonan ke Admin"}</span>
                    </button>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle size={14} />
                      <span>Hubungi via WhatsApp</span>
                    </a>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">Pengajuan Berhasil Terkirim</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      SuperAdmin telah menerima permohonan perpanjangan layanan untuk <strong>{school.name}</strong>. Faktur resmi akan segera diterbitkan.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle size={14} />
                      <span>Konfirmasi Cepat via WhatsApp</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowRenewalModal(false)}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
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
                  <button
                    onClick={() => printDigitalInvoice(detailInvoice, school)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                    title="Cetak atau Simpan Invoice Digital Resmi (PDF)"
                  >
                    <Printer size={13} />
                    <span>Cetak Invoice (PDF)</span>
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
                      <div key={row.label} className="flex justify-between items-center px-4 py-2.5 text-xs">
                        <span className="text-slate-500 dark:text-slate-400">{row.label}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{row.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50 font-bold text-sm">
                      <span className="text-slate-900 dark:text-white">Total Tagihan</span>
                      <span className="text-blue-600 dark:text-blue-400">{formatRupiah(detailInvoice.amount)}</span>
                    </div>
                  </div>
                </div>

                {/* Status Lunas Info */}
                {detailInvoice.status === "paid" && (
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Pembayaran Terverifikasi</p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-500">
                          {detailInvoice.paid_date ? `Lunas pada ${formatDate(detailInvoice.paid_date)}` : "Selesai"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => printDigitalInvoice(detailInvoice, school)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                    >
                      <Printer size={12} />
                      <span>Invoice PDF</span>
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
                    onClick={() => printDigitalInvoice(paymentSession.invoice, school)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2"
                  >
                    <Printer size={14} />
                    <span>Cetak Invoice Digital Lunas (PDF)</span>
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
