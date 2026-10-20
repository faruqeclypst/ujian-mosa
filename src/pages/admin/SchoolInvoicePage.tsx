import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import {
  FileText, Upload, Eye, Printer, CheckCircle2, Clock,
  AlertTriangle, XCircle, ExternalLink, Trash2,
  RefreshCw, X, TrendingUp, Sparkles,
  Send, Building2, Calendar, ShieldCheck, MessageCircle,
  Landmark, QrCode, CreditCard
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { NeonStatGrid, NeonStatCard } from "../../components/ui/NeonStats";
import { NeonCard, NeonCardHeader, NeonCardBody } from "../../components/ui/NeonCard";
import { NeonBadge } from "../../components/ui/NeonBadge";
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

/** Status yang tersimpan di database. Tidak pernah "pending". */
type StoredStatus = "unpaid" | "paid" | "overdue" | "cancelled";
/** Status tampilan: StoredStatus + "pending" yang di-derive dari (unpaid + payment_proof). */
type PaymentStatus = StoredStatus | "pending";

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
  status: StoredStatus;
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
  variant: "amber" | "sky" | "emerald" | "rose" | "neutral";
  icon: typeof CheckCircle2;
}> = {
  unpaid:    { label: "Belum Dibayar", variant: "amber", icon: Clock },
  pending:   { label: "Menunggu Verifikasi", variant: "sky", icon: Clock },
  paid:      { label: "Lunas", variant: "emerald", icon: CheckCircle2 },
  overdue:   { label: "Terlambat", variant: "rose", icon: AlertTriangle },
  cancelled: { label: "Dibatalkan", variant: "neutral", icon: XCircle },
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
  const paidInvoices = invoices.filter(i => i.status === "paid");
  const totalPaid = paidInvoices.reduce((s, i) => s + i.amount, 0);
  const activeUnpaidInvoice = unpaidInvoices[0] || null;
  const activePendingInvoice = pendingInvoices[0] || null;

  if (!school) {
    return (
      <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] flex items-center justify-center p-8">
        <p className="text-xs text-neutral-500 font-medium">Data institusi tidak ditemukan.</p>
      </div>
    );
  }

  const selectedPlanLabel = PLAN_PRICES[selectedPlan]?.label || selectedPlan;
  const renewalEstimate = calculatePlanInvoice(selectedPlan, selectedDuration).amount;
  const waMessage = encodeURIComponent(
    `Halo Admin EXAMKU, kami dari *${school.name}* (ID: ${school.slug}) ingin mengajukan *perpanjangan layanan CBT*:\n- Paket: *${selectedPlanLabel}*\n- Durasi: *${selectedDuration} Bulan*\n- Estimasi: *${formatRupiah(renewalEstimate)}*\n- Kuota: *${school.student_quota || 0} Siswa*\n${renewalNotes ? `- Catatan: ${renewalNotes}\n` : ""}Mohon bantu terbitkan tagihan/invoice resmi. Terima kasih.`
  );
  const waUrl = `https://wa.me/6285359907696?text=${waMessage}`;

  const daysLeftActive = school?.active_until
    ? Math.ceil((new Date(school.active_until.replace(" ", "T")).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">

        {/* ── 1. Page Header Bar (Title, Breadcrumb & Primary Actions) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              Tagihan &amp; Langganan
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <Link to="/admin" className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                Semua Modul
              </Link>
              <span>/</span>
              <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                {school?.slug || "modalbangsa"}
              </span>
              <span>/</span>
              <span className="text-neutral-900 dark:text-neutral-100 font-semibold">
                invoice
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={loadInvoices}
              disabled={loading}
              className="h-8 px-3 text-xs font-semibold border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span>Refresh</span>
            </Button>

            <Button
              type="button"
              onClick={() => {
                setRenewalSubmitted(false);
                setShowRenewalModal(true);
              }}
              className="h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Minta Perpanjangan</span>
            </Button>
          </div>
        </div>

        {/* ── 2. Top Stats Strip (4 Kartu Ringkas, Elegan, Presisi Sama dengan Ruang Ujian, Bank Soal, & Status Server) ── */}
        <NeonStatGrid cols={4}>
          <NeonStatCard
            label="Total Invoice"
            value={String(invoices.length)}
            unit="faktur"
            subText="Semua riwayat periode"
            isLoading={loading}
          />

          <NeonStatCard
            label="Menunggu Pembayaran"
            indicator={
              unpaidCount > 0 ? (
                <NeonBadge variant="amber" size="xs">
                  {unpaidCount} Tagihan
                </NeonBadge>
              ) : undefined
            }
            value={String(unpaidCount)}
            unit="faktur"
            subText={unpaidCount > 0 ? "Perlu segera diselesaikan" : "Semua tagihan lunas"}
            isLoading={loading}
          />

          <NeonStatCard
            label="Invoice Lunas"
            indicator={true}
            value={String(paidInvoices.length)}
            unit="faktur"
            subText="Terverifikasi sistem"
            isLoading={loading}
          />

          <NeonStatCard
            label="Total Terbayar"
            value={formatRupiah(totalPaid)}
            valueClassName="text-base sm:text-lg font-bold"
            subText="Akumulasi pembayaran"
            isLoading={loading}
          />
        </NeonStatGrid>

        {/* ── Payment Result Notification ── */}
        {paymentNotice && (
          <div className={cn(
            "rounded-xl border p-4 flex items-center justify-between shadow-2xs transition-all",
            paymentNotice.type === "success"
              ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
              : "bg-neutral-100 dark:bg-neutral-850 border-neutral-200 dark:border-neutral-750 text-neutral-800 dark:text-neutral-200"
          )}>
            <div className="flex items-center gap-3">
              {paymentNotice.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Clock className="h-5 w-5 text-neutral-500 dark:text-neutral-400 shrink-0" />
              )}
              <p className="text-xs sm:text-sm font-semibold">{paymentNotice.message}</p>
            </div>
            <button
              onClick={() => setPaymentNotice(null)}
              className="p-1 hover:bg-neutral-200/50 dark:hover:bg-neutral-750 rounded-lg transition-colors cursor-pointer text-neutral-500"
              aria-label="Tutup notifikasi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Active Invoice Attention Banners ── */}
        {activePendingInvoice ? (
          <NeonCard className="border-sky-500/30 bg-sky-500/5 dark:bg-sky-500/10">
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Menunggu Verifikasi Pembayaran ({activePendingInvoice.invoice_number})
                  </h3>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-xl">
                  Bukti transfer sebesar <strong className="font-semibold text-neutral-900 dark:text-neutral-100">{formatRupiah(activePendingInvoice.amount)}</strong> sudah terkirim dan sedang diverifikasi SuperAdmin. Layanan aktif otomatis setelah disetujui.
                </p>
                {banks.length > 0 && (
                  <div className="pt-2">
                    <p className="font-bold text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5 text-[11px]">
                      <Landmark className="h-3.5 w-3.5" /> Rekening transfer:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {banks.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-750 text-xs">
                          <strong className="text-neutral-900 dark:text-neutral-100 font-semibold">{b.bank_name}</strong>
                          <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">{b.account_number}</span>
                          <span className="text-neutral-400 text-[11px]">a.n. {b.account_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setProofView(activePendingInvoice)}
                title="Klik untuk memperbesar bukti"
                className="shrink-0 group relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-900 shadow-2xs cursor-pointer"
              >
                {isImageProof(getProofUrl(activePendingInvoice)) ? (
                  <img src={getProofUrl(activePendingInvoice)} alt="Bukti transfer" className="h-20 w-32 object-cover" />
                ) : (
                  <span className="flex h-20 w-32 items-center justify-center gap-1.5 text-sky-600 dark:text-sky-400">
                    <FileText className="h-5 w-5" />
                    <span className="text-xs font-bold">PDF</span>
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-neutral-900/0 group-hover:bg-neutral-900/30 transition-colors">
                  <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              </button>
            </div>
          </NeonCard>
        ) : activeUnpaidInvoice ? (
          <NeonCard className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10">
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Tagihan Perpanjangan Resmi Siap Dibayar ({activeUnpaidInvoice.invoice_number})
                  </h3>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-xl">
                  SuperAdmin telah menerbitkan invoice perpanjangan untuk sekolah Anda sebesar <strong className="font-semibold text-neutral-900 dark:text-neutral-100">{formatRupiah(activeUnpaidInvoice.amount)}</strong>. Silakan bayar via QRIS instan atau transfer manual.
                </p>

                {banks.length > 0 && (
                  <div className="mt-2.5 p-3 bg-white dark:bg-neutral-850 rounded-xl border border-neutral-200 dark:border-neutral-750 text-xs">
                    <p className="font-bold text-neutral-800 dark:text-neutral-200 mb-2 flex items-center gap-1.5">
                      <Landmark className="h-3.5 w-3.5 text-neutral-500" /> Rekening Transfer Resmi:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {banks.map((b, i) => (
                        <div key={i} className="flex items-center gap-2.5 p-2 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200/70 dark:border-neutral-800">
                          <div className="w-8 h-8 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-750 flex items-center justify-center font-bold text-[10px] text-neutral-600 shrink-0">
                            {b.bank_name.substring(0, 3)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-neutral-800 dark:text-neutral-200 text-xs block truncate">
                              {b.bank_name} - <span className="font-mono text-emerald-600 dark:text-emerald-400">{b.account_number}</span>
                            </span>
                            <span className="text-[11px] text-neutral-400 block truncate">a.n. {b.account_name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => printDigitalInvoice(activeUnpaidInvoice, school)}
                  className="h-8 px-3 text-xs font-semibold border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Invoice PDF</span>
                </Button>

                <Button
                  type="button"
                  onClick={() => handlePayWithQris(activeUnpaidInvoice)}
                  disabled={payingInvoiceId === activeUnpaidInvoice.id}
                  className="h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <QrCode className={cn("h-3.5 w-3.5", payingInvoiceId === activeUnpaidInvoice.id && "animate-spin")} />
                  <span>Bayar QRIS</span>
                </Button>
              </div>
            </div>
          </NeonCard>
        ) : (school && (school.plan === "free" || (daysLeftActive !== null && daysLeftActive <= 30))) ? (
          <NeonCard className={cn(
            daysLeftActive !== null && daysLeftActive <= 3 && school.plan !== "free"
              ? "border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10"
              : "border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10"
          )}>
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className={cn(
                    "h-4 w-4 shrink-0",
                    daysLeftActive !== null && daysLeftActive <= 3 && school.plan !== "free" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                  )} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    {school.plan === "free"
                      ? "Akun Free Trial CBT (Maks. 50 Siswa)"
                      : daysLeftActive !== null && daysLeftActive <= 1
                        ? `Masa Aktif Berakhir ${daysLeftActive <= 0 ? "Hari Ini" : "Besok"} — Segera Perpanjang!`
                        : daysLeftActive !== null && daysLeftActive <= 3
                          ? `Masa Aktif Tersisa ${daysLeftActive} Hari — Segera Perpanjang!`
                          : daysLeftActive !== null && daysLeftActive <= 7
                            ? `Masa Aktif Tersisa ${daysLeftActive} Hari`
                            : "Masa Aktif Layanan Segera Berakhir"}
                  </h3>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-xl">
                  {school.plan === "free"
                    ? "Untuk meng-upgrade ke kuota siswa penuh dan membuka seluruh fitur CBT tanpa batas, silakan kirim permohonan ke Tim Admin."
                    : daysLeftActive !== null && daysLeftActive <= 3
                      ? `Layanan akan berhenti total pada ${formatDate(school.active_until || "")}. Hubungi Admin untuk memastikan server ujian tetap aktif.`
                      : "Untuk menjaga kesinambungan ujian online dan sinkronisasi data tanpa jeda, silakan ajukan perpanjangan lisensi."}
                </p>
              </div>

              <Button
                type="button"
                onClick={() => {
                  setRenewalSubmitted(false);
                  setShowRenewalModal(true);
                }}
                className="h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Minta Perpanjangan ke Admin</span>
              </Button>
            </div>
          </NeonCard>
        ) : null}

        {/* ── 3. Main Invoices Section ── */}
        <NeonCard>
          <NeonCardHeader
            icon={FileText}
            title="Riwayat Tagihan &amp; Faktur"
            subtitle="Daftar tagihan resmi, status pembayaran, dan invoice PDF institusi"
            badge={
              <NeonBadge variant="neutral" size="xs">
                {invoices.length} Faktur
              </NeonBadge>
            }
          />

          <NeonCardBody className="p-0">
            {loading ? (
              <div className="p-12 text-center space-y-3">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs font-semibold text-neutral-500">Memuat data tagihan resmi...</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center mx-auto text-neutral-400">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Belum Ada Tagihan</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    Belum ada riwayat tagihan yang diterbitkan untuk sekolah Anda. Klik tombol di bawah jika ingin meminta invoice perpanjangan resmi.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    setRenewalSubmitted(false);
                    setShowRenewalModal(true);
                  }}
                  className="h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Minta Perpanjangan ke Admin</span>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                {invoices.map((inv) => {
                  const effectiveStatus = getInvoiceStatus(inv);
                  const cfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.unpaid;
                  const StatusIcon = cfg.icon;
                  const needsAction = effectiveStatus === "unpaid" || effectiveStatus === "overdue";
                  const hasProof = Boolean(inv.payment_proof);

                  return (
                    <div
                      key={inv.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-850/40 transition-colors"
                    >
                      {/* Left Information */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
                            {inv.invoice_number}
                          </span>
                          <NeonBadge variant={cfg.variant} size="xs" icon={StatusIcon}>
                            {cfg.label}
                          </NeonBadge>
                        </div>
                        <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                          {PLAN_PRICES[inv.plan]?.label || inv.plan} Plan
                          <span className="font-normal text-neutral-500 dark:text-neutral-400">
                            {" "}· {isTopupInvoice(inv) ? "Top-up kuota" : `${inv.duration_months} bulan`}
                          </span>
                        </p>
                        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                          {inv.status === "paid" && inv.paid_date
                            ? `Dibayar pada ${formatDate(inv.paid_date)}`
                            : `Jatuh tempo: ${formatDate(inv.due_date)}`
                          }
                        </p>
                      </div>

                      {/* Right Amount & Actions */}
                      <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 shrink-0">
                        <p className="font-mono font-bold text-base text-neutral-900 dark:text-neutral-100">
                          {formatRupiah(inv.amount)}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDetailInvoice(inv)}
                            className="h-7.5 px-2.5 text-xs font-semibold border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Detail</span>
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => printDigitalInvoice(inv, school)}
                            className="h-7.5 px-2.5 text-xs font-semibold border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            title="Cetak atau Simpan Invoice Digital (PDF)"
                          >
                            <Printer className="h-3 w-3" />
                            <span>Invoice PDF</span>
                          </Button>

                          {needsAction && (
                            <>
                              <Button
                                type="button"
                                onClick={() => handlePayWithQris(inv)}
                                disabled={payingInvoiceId === inv.id}
                                className="h-7.5 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <QrCode className={cn("h-3 w-3", payingInvoiceId === inv.id && "animate-spin")} />
                                <span>{payingInvoiceId === inv.id ? "Memproses..." : "Bayar QRIS"}</span>
                              </Button>

                              {!hasProof && (
                                <label className="h-7.5 px-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 rounded-lg cursor-pointer transition-colors shadow-2xs border border-neutral-200 dark:border-neutral-750 inline-flex items-center gap-1.5 select-none">
                                  <Upload className="h-3 w-3" />
                                  <span>Upload</span>
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

                          {effectiveStatus === "pending" && (
                            <>
                              <button
                                type="button"
                                onClick={() => setProofView(inv)}
                                title="Klik untuk memperbesar bukti"
                                className="group relative overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-900 shadow-2xs shrink-0 cursor-pointer"
                              >
                                {isImageProof(getProofUrl(inv)) ? (
                                  <img src={getProofUrl(inv)} alt="Bukti transfer" className="h-7.5 w-12 object-cover" />
                                ) : (
                                  <span className="flex h-7.5 w-12 items-center justify-center gap-1 text-sky-600 dark:text-sky-400">
                                    <FileText className="h-3 w-3" />
                                    <span className="text-[10px] font-bold">PDF</span>
                                  </span>
                                )}
                                <span className="absolute inset-0 flex items-center justify-center bg-neutral-900/0 group-hover:bg-neutral-900/30 transition-colors">
                                  <Eye className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </span>
                              </button>

                              <label className="h-7.5 px-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 rounded-lg cursor-pointer transition-colors shadow-2xs border border-neutral-200 dark:border-neutral-750 inline-flex items-center gap-1.5 select-none">
                                <Upload className="h-3 w-3" />
                                <span>{uploadingProof ? "Mengunggah..." : "Upload Ulang"}</span>
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  className="hidden"
                                  disabled={uploadingProof}
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) handleProofUpload(inv.id, file);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </NeonCardBody>
        </NeonCard>

        {/* ── Modal Pengajuan Perpanjangan ke Admin ── */}
        <Dialog open={showRenewalModal} onOpenChange={setShowRenewalModal}>
          <DialogContent className="max-w-lg bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-neutral-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Pengajuan Perpanjangan Layanan
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                Kirim permintaan ke SuperAdmin untuk penerbitan faktur invoice resmi
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {!renewalSubmitted ? (
                <>
                  {/* Current School Info */}
                  <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-xs space-y-1">
                    <p className="font-bold text-neutral-900 dark:text-neutral-100">{school.name}</p>
                    <p className="text-neutral-500">Subdomain: <code className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{school.slug}.examku.my.id</code></p>
                    <p className="text-neutral-500">Kuota Siswa Aktif: <strong>{school.student_quota || 50} Siswa</strong></p>
                  </div>

                  {/* Pilih Paket */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Pilih Paket Layanan</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["basic", "pro", "ultimate"] as const).map(planKey => {
                        const detail = PLAN_PRICING[planKey];
                        const p = { key: planKey, label: detail.label.replace("Paket ", ""), note: `Maks. ${detail.quota} Siswa` };
                        const monthly = detail.monthlyRate;
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => setSelectedPlan(p.key)}
                            className={cn(
                              "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                              selectedPlan === p.key
                                ? "border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs"
                                : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-neutral-700 dark:text-neutral-300"
                            )}
                          >
                            <p className="text-xs font-bold">{p.label}</p>
                            <p className="text-[11px] text-neutral-400 mt-0.5">{p.note}</p>
                            <p className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                              {formatRupiah(monthly)}<span className="font-normal text-neutral-400">/bln</span>
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pilih Durasi */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Durasi Perpanjangan</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { months: 1, label: "1 Bulan" },
                        { months: 2, label: "2 Bulan" },
                        { months: 3, label: "3 Bulan" },
                        { months: 4, label: "4 Bulan" },
                        { months: 5, label: "5 Bulan" },
                        { months: 6, label: "6 Bulan" },
                        { months: 12, label: "12 Bulan" },
                      ].map(d => (
                        <button
                          key={d.months}
                          type="button"
                          onClick={() => setSelectedDuration(d.months)}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                            selectedDuration === d.months
                              ? "border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs"
                              : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-neutral-700 dark:text-neutral-300"
                          )}
                        >
                          <p className="text-xs font-bold">{d.label}</p>
                          <p className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {formatRupiah(calculatePlanInvoice(selectedPlan, d.months).amount)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Catatan / Kebutuhan Khusus */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      Catatan Tambahan (Opsional)
                    </label>
                    <textarea
                      value={renewalNotes}
                      onChange={e => setRenewalNotes(e.target.value)}
                      placeholder="Contoh: Kami ingin penyesuaian kuota 400 siswa untuk persiapan ujian semester genap..."
                      rows={3}
                      className="w-full text-xs p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {/* Estimasi total */}
                  <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Estimasi Tagihan</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
                        {PLAN_PRICING[selectedPlan as keyof typeof PLAN_PRICING]?.label || selectedPlan} · {selectedDuration} bulan
                      </p>
                    </div>
                    <p className="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(calculatePlanInvoice(selectedPlan, selectedDuration).amount)}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      onClick={handleSubmitRenewalRequest}
                      disabled={submittingRenewal}
                      className="flex-1 h-8.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Send className={cn("h-3.5 w-3.5", submittingRenewal && "animate-spin")} />
                      <span>{submittingRenewal ? "Mengirim..." : "Kirim Permohonan ke Admin"}</span>
                    </Button>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8.5 px-3.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs inline-flex items-center justify-center gap-1.5 border border-neutral-200 dark:border-neutral-750"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>WhatsApp Admin</span>
                    </a>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">Pengajuan Berhasil Terkirim</h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto leading-relaxed">
                      SuperAdmin telah menerima permohonan perpanjangan layanan untuk <strong>{school.name}</strong>. Faktur resmi akan segera diterbitkan.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow-xs inline-flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>Konfirmasi Cepat via WhatsApp</span>
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRenewalModal(false)}
                      className="h-8.5 px-4 text-xs font-semibold rounded-lg"
                    >
                      Tutup
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Detail Modal ── */}
        {detailInvoice && (() => {
          const effectiveStatus = getInvoiceStatus(detailInvoice);
          const modalCfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.unpaid;
          const ModalStatusIcon = modalCfg.icon;

          return (
            <Dialog open onOpenChange={(open) => { if (!open) setDetailInvoice(null); }}>
              <DialogContent className="max-w-lg bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-neutral-800">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-md">
                      {detailInvoice.invoice_number}
                    </span>
                    <NeonBadge variant={modalCfg.variant} size="xs" icon={ModalStatusIcon}>
                      {modalCfg.label}
                    </NeonBadge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                    Diterbitkan pada {formatDate(detailInvoice.created)}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="border border-neutral-200/80 dark:border-neutral-800 rounded-xl overflow-hidden">
                    <div className="bg-neutral-50/50 dark:bg-neutral-900/40 px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Rincian Faktur</p>
                    </div>
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                      {[
                        { label: "Layanan", value: `${PLAN_PRICES[detailInvoice.plan]?.label || detailInvoice.plan} Plan` },
                        { label: "Durasi", value: isTopupInvoice(detailInvoice) ? "Top-up kuota (periode tetap)" : `${detailInvoice.duration_months} bulan` },
                        { label: "Jatuh Tempo", value: formatDate(detailInvoice.due_date) },
                        ...(detailInvoice.paid_date ? [{ label: "Tanggal Bayar", value: formatDate(detailInvoice.paid_date) }] : []),
                      ].map(row => (
                        <div key={row.label} className="flex justify-between items-center px-4 py-2.5 text-xs">
                          <span className="text-neutral-500 dark:text-neutral-400">{row.label}</span>
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">{row.value}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center px-4 py-3 bg-neutral-50/60 dark:bg-neutral-900/60 font-bold text-sm">
                        <span className="text-neutral-900 dark:text-neutral-100">Total Tagihan</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatRupiah(detailInvoice.amount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pending Info */}
                  {effectiveStatus === "pending" && detailInvoice.payment_proof && (
                    <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">Menunggu Verifikasi Admin</p>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            Bukti transfer sudah terkirim. Layanan aktif otomatis setelah disetujui.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setProofView(detailInvoice)}
                          className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-750 text-neutral-800 dark:text-neutral-200 cursor-pointer shadow-2xs"
                        >
                          Lihat Bukti Transfer
                        </button>
                        <button
                          type="button"
                          onClick={() => removeProof(detailInvoice.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                        >
                          Hapus &amp; Upload Ulang
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Status Lunas Info */}
                  {detailInvoice.status === "paid" && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">Pembayaran Terverifikasi</p>
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            {detailInvoice.paid_date ? `Lunas pada ${formatDate(detailInvoice.paid_date)}` : "Selesai"}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={() => printDigitalInvoice(detailInvoice, school)}
                        className="h-7.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs inline-flex items-center gap-1.5"
                      >
                        <Printer className="h-3 w-3" />
                        <span>Invoice PDF</span>
                      </Button>
                    </div>
                  )}
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    onClick={() => printDigitalInvoice(detailInvoice, school)}
                    className="h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Cetak Invoice (PDF)</span>
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })()}

        {/* ── Lightbox Bukti Pembayaran ── */}
        {proofView && (
          <ProofLightbox
            url={getProofUrl(proofView)}
            title={`Bukti Pembayaran ${proofView.invoice_number}`}
            onClose={() => setProofView(null)}
          />
        )}

        {/* ── Modal Realtime QRIS Payment Session ── */}
        {paymentSession && (
          <Dialog open onOpenChange={(open) => { if (!open) setPaymentSession(null); }}>
            <DialogContent className="max-w-md text-center bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-neutral-800">
              {!paymentSession.isPaid ? (
                <div className="space-y-4 py-2">
                  <div className="w-14 h-14 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs">
                    <QrCode className="h-7 w-7" />
                  </div>

                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 mb-2">
                      <Clock className="h-3 w-3 animate-spin" />
                      <span>Menunggu Pembayaran</span>
                    </div>
                    <h3 className="text-xl font-mono font-bold text-neutral-900 dark:text-white">
                      {formatRupiah(paymentSession.invoice.amount)}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      Invoice: <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200">{paymentSession.invoice.invoice_number}</span>
                    </p>
                  </div>

                  <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3 text-left text-xs space-y-1">
                    <p className="font-bold text-neutral-800 dark:text-neutral-200">
                      Petunjuk Pelunasan:
                    </p>
                    <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed text-[11px]">
                      Tab pembayaran QRIS telah dibuka. Silakan lakukan scan menggunakan aplikasi mobile banking atau e-wallet Anda. Sistem akan mendeteksi pelunasan secara instan tanpa perlu merefresh halaman ini.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <Button
                      type="button"
                      onClick={() => window.open(paymentSession.paymentUrl, "_blank")}
                      className="w-full h-8.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shadow-xs inline-flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Buka Ulang Halaman QRIS</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPaymentSession(null)}
                      className="w-full h-8 text-xs font-semibold rounded-lg border-neutral-200 dark:border-neutral-750 text-neutral-600 dark:text-neutral-400"
                    >
                      Tutup Sementara (Tetap Diproses di Latar)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="w-14 h-14 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>

                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 mb-2">
                      <Sparkles className="h-3 w-3" />
                      <span>Transaksi Lunas Terverifikasi</span>
                    </div>
                    <h3 className="text-xl font-mono font-bold text-neutral-900 dark:text-white">
                      Pembayaran Berhasil!
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xs mx-auto leading-relaxed">
                      Tagihan <strong>{paymentSession.invoice.invoice_number}</strong> telah terbayar lunas. Paket CBT institusi <strong>{school.name}</strong> kini aktif dengan kuota penuh.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <Button
                      type="button"
                      onClick={() => printDigitalInvoice(paymentSession.invoice, school)}
                      className="w-full h-8.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shadow-xs inline-flex items-center justify-center gap-1.5"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Cetak Invoice Digital Lunas (PDF)</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPaymentSession(null);
                        if (detailInvoice?.id === paymentSession.invoice.id) {
                          setDetailInvoice(null);
                        }
                      }}
                      className="w-full h-8 text-xs font-semibold rounded-lg border-neutral-200 dark:border-neutral-750 text-neutral-700 dark:text-neutral-300"
                    >
                      Selesai
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}

      </div>
    </div>
  );
};

export default SchoolInvoicePage;
