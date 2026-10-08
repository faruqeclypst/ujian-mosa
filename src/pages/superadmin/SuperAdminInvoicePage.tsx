import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText, Plus, Search, Filter, Download, Eye,
  CheckCircle2, Clock, XCircle, Upload, X, ChevronDown,
  Building2, Calendar, CreditCard, Printer, RefreshCw,
  AlertTriangle, Paperclip, ExternalLink, Trash2, Edit,
  TrendingUp,
} from "lucide-react";
import { masterPb } from "../../lib/pocketbase";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { cn } from "../../lib/utils";
import {
  calculatePlanInvoice,
  normalizePlanKey,
  PLAN_PRICING,
  PlanKey,
} from "../../utils/pricingHelper";
import { upgradeSchoolFromInvoice, calculateTopup, isTopupInvoice } from "../../utils/subscriptionHelper";
import { printDigitalInvoice } from "../../utils/invoicePdfHelper";

// ─── Types ─────────────────────────────────────────────────────────────────

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

interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  contact_email?: string;
  active_until?: string;
  student_quota?: number;
}

const formatDateID = (yyyyMmDd: string): string => {
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  if (!y || !m || !d) return yyyyMmDd;
  return `${d} ${months[m - 1]} ${y}`;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  unpaid:    { label: "Belum Bayar", color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200",  icon: Clock },
  paid:      { label: "Lunas",       color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle2 },
  overdue:   { label: "Terlambat",   color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",    icon: AlertTriangle },
  cancelled: { label: "Dibatalkan",  color: "text-slate-500",   bg: "bg-slate-100",  border: "border-slate-200",  icon: XCircle },
};

const generateInvoiceNumber = (): string => {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `INV-${yy}${mm}-${seq}`;
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

// ─── Blank form ─────────────────────────────────────────────────────────────

const blankForm = (): Omit<Invoice, "id" | "created" | "updated"> => {
  const defaultPlan = calculatePlanInvoice("basic", 12);
  return {
    invoice_number: generateInvoiceNumber(),
    school_id: "",
    school_name: "",
    school_slug: "",
    contact_email: "",
    plan: "basic",
    duration_months: 12,
    amount: defaultPlan.amount,
    status: "unpaid",
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    notes: "",
    payment_proof: "",
    paid_date: "",
  };
};

// ─── Invoice Print Template ─────────────────────────────────────────────────

const printInvoice = (inv: Invoice) => {
  printDigitalInvoice(inv, { name: inv.school_name, slug: inv.school_slug });
};

// ─── Component ───────────────────────────────────────────────────────────────

const SuperAdminInvoicePage = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "all">("all");
  const [filterTime, setFilterTime] = useState<"all" | "today" | "week" | "month" | "year">("all");
  const [filterPackage, setFilterPackage] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [uploadingProof, setUploadingProof] = useState<string | null>(null);

  // ─── Top-Up Kuota (periode tetap) ───
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupSchoolId, setTopupSchoolId] = useState("");
  const [topupTargetPlan, setTopupTargetPlan] = useState<string>("pro");
  const [topupSaving, setTopupSaving] = useState(false);

  const topupSchool = schools.find(s => s.id === topupSchoolId) || null;
  const topupCalc = topupSchool ? calculateTopup(topupSchool, topupTargetPlan) : null;
  // Narrowing eksplisit agar TypeScript yakin (bukan { error })
  const topupData = topupCalc && !("error" in topupCalc) ? topupCalc : null;
  const topupCalcError = topupCalc && "error" in topupCalc ? topupCalc.error : null;

  // Sekolah yang layak top-up: masa aktif berbayar masih berjalan
  const topupEligibleSchools = schools.filter(s => {
    if (normalizePlanKey(s.plan || "free") === "free" || !s.active_until) return false;
    const m = s.active_until.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return false;
    return new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59).getTime() > Date.now();
  });

  // Paket tujuan: kuota harus lebih besar dari paket sekolah saat ini
  const topupTargetOptions = topupSchool
    ? (Object.keys(PLAN_PRICING) as PlanKey[]).filter(k =>
        k !== "free" && PLAN_PRICING[k].quota > (PLAN_PRICING[normalizePlanKey(topupSchool.plan || "basic")]?.quota || 0)
      )
    : [];

  const openTopup = () => {
    setTopupSchoolId("");
    setTopupTargetPlan("pro");
    setShowTopupModal(true);
  };

  const handleTopupSchoolChange = (id: string) => {
    setTopupSchoolId(id);
    const s = schools.find(x => x.id === id);
    if (s) {
      const curQuota = PLAN_PRICING[normalizePlanKey(s.plan || "basic")]?.quota || 0;
      const firstHigher = (Object.keys(PLAN_PRICING) as PlanKey[]).find(k =>
        k !== "free" && PLAN_PRICING[k].quota > curQuota
      );
      if (firstHigher) setTopupTargetPlan(firstHigher);
    }
  };

  const handleIssueTopup = async () => {
    if (!topupSchool || !topupData) return;
    setTopupSaving(true);
    try {
      const target = PLAN_PRICING[topupData.targetPlanKey];
      const current = PLAN_PRICING[topupData.currentPlanKey];
      const perDay = Math.round((target.monthlyRate - current.monthlyRate) / 30);
      const activeUntilFmt = formatDateID(topupData.activeUntil);
      const payload = {
        invoice_number: generateInvoiceNumber(),
        school_id: topupSchool.id,
        school_name: topupSchool.name,
        school_slug: topupSchool.slug,
        contact_email: topupSchool.contact_email || "",
        plan: topupData.targetPlanKey,
        plan_label: target.label,
        duration_months: 0,
        period_label: `Top-up s/d ${activeUntilFmt}`,
        amount: topupData.amount,
        status: "unpaid",
        due_date: topupData.activeUntil,
        notes: `[TOPUP] Top-up kuota ${topupData.currentLabel} (${topupData.currentQuota} siswa) → ${topupData.targetLabel} (${topupData.targetQuota} siswa). Periode tetap s/d ${activeUntilFmt} (${topupData.remainingDays} hari × Rp ${perDay.toLocaleString("id-ID")}/hari). Masa aktif TIDAK diperpanjang.`,
      };
      await masterPb.collection("invoices").create(payload);
      await loadInvoices();
      setShowTopupModal(false);
      setTopupSchoolId("");
      alert(`Invoice top-up Rp ${topupData.amount.toLocaleString("id-ID")} untuk ${topupSchool.name} berhasil diterbitkan. Kuota naik setelah pembayaran diverifikasi.`);
    } catch (err: any) {
      alert(err?.data?.message || err?.message || "Gagal menerbitkan invoice top-up.");
    } finally {
      setTopupSaving(false);
    }
  };

  const loadSchools = useCallback(async () => {
    try {
      const list = await masterPb.collection("schools").getFullList<SchoolRecord>({ sort: "name" });
      setSchools(list);
    } catch (err) {
      console.error("Gagal memuat daftar sekolah:", err);
      setSchools([]);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    setLoadError("");
    try {
      const result = await masterPb.collection("invoices").getList<Invoice>(1, 20);
      const mapped = result.items.map(r => ({
        ...r,
        invoice_number: r.invoice_number || "-",
        school_name: r.school_name || "Institusi tidak bernama",
        school_slug: r.school_slug || "-",
        plan: r.plan || (r.plan_label ? Object.keys(PLAN_PRICES).find(k => PLAN_PRICES[k].label === r.plan_label) : "basic") || "basic",
        duration_months: Number.isFinite(Number(r.duration_months)) ? Number(r.duration_months) : 1,
        amount: Number(r.amount) || 0,
      }));
      setInvoices(mapped);
    } catch (err: any) {
      console.error("Gagal memuat invoice dari PocketBase:", err);
      setLoadError(err?.data?.message || err?.message || "Gagal memuat data invoice.");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // One-time migration of any legacy localStorage invoices to master PocketBase
  const migrateLocalInvoices = useCallback(async () => {
    try {
      const raw = localStorage.getItem("sa_invoices_v1");
      if (!raw) return;
      const localList: Invoice[] = JSON.parse(raw);
      if (!Array.isArray(localList) || localList.length === 0) return;

      const existing = await masterPb.collection("invoices").getFullList<{ invoice_number: string }>({
        fields: "invoice_number",
      });
      const existingNumbers = new Set(existing.map(e => e.invoice_number));

      for (const item of localList) {
        if (item.invoice_number && !existingNumbers.has(item.invoice_number) && item.school_name) {
          try {
            await masterPb.collection("invoices").create({
              invoice_number: item.invoice_number,
              school_id: item.school_id || "",
              school_name: item.school_name,
              school_slug: item.school_slug || "",
              contact_email: item.contact_email || "",
              plan: item.plan || "basic",
              plan_label: PLAN_PRICES[item.plan]?.label || item.plan || "Berkembang",
              duration_months: Number.isFinite(Number(item.duration_months)) ? Number(item.duration_months) : 1,
              period_label: item.period_label || `${Number(item.duration_months) || 1} bulan`,
              amount: Number(item.amount) || 0,
              status: item.status || "unpaid",
              due_date: item.due_date || "",
              paid_date: item.paid_date || "",
              notes: item.notes || "",
            });
          } catch (e) {
            console.warn("Skip migrating local invoice:", item.invoice_number, e);
          }
        }
      }
      localStorage.removeItem("sa_invoices_v1");
    } catch (err) {
      console.warn("Migration check error:", err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (masterPb.authStore.isValid) {
          await masterPb.collection("super_admins").authRefresh();
        }
      } catch (err) {
        console.warn("Sesi superadmin belum bisa diperbarui:", err);
      }
      await loadSchools();
      await migrateLocalInvoices();
      await loadInvoices();
    };
    init();
  }, [loadSchools, migrateLocalInvoices, loadInvoices]);

  const filtered = invoices.filter(inv => {
    const effectiveStatus = getInvoiceStatus(inv);
    
    const matchSearch = inv.school_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase());
    
    const matchStatus = filterStatus === "all" || effectiveStatus === filterStatus;
    
    let matchPackage = true;
    if (filterPackage !== "all") {
      matchPackage = ((inv.plan_label || inv.plan) || "").toLowerCase().includes(filterPackage.toLowerCase());
    }

    let matchTime = true;
    if (filterTime !== "all") {
      const date = new Date(inv.created);
      const now = new Date();
      if (filterTime === "today") {
        matchTime = date.toDateString() === now.toDateString();
      } else if (filterTime === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchTime = date >= weekAgo;
      } else if (filterTime === "month") {
        matchTime = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      } else if (filterTime === "year") {
        matchTime = date.getFullYear() === now.getFullYear();
      }
    }

    return matchSearch && matchStatus && matchPackage && matchTime;
  });

  const openCreate = () => {
    setEditingInvoice(null);
    setForm(blankForm());
    setShowModal(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setForm({
      invoice_number: inv.invoice_number,
      school_id: inv.school_id,
      school_name: inv.school_name,
      school_slug: inv.school_slug,
      contact_email: inv.contact_email || "",
      plan: inv.plan,
      duration_months: inv.duration_months,
      amount: inv.amount,
      status: inv.status,
      due_date: inv.due_date?.slice(0, 10) || "",
      paid_date: inv.paid_date?.slice(0, 10) || "",
      notes: inv.notes || "",
      payment_proof: inv.payment_proof || "",
    });
    setShowModal(true);
  };

  const handleSchoolSelect = (id: string) => {
    if (!id) {
      setForm(f => ({
        ...f,
        school_id: "",
        school_name: "",
        school_slug: "",
        contact_email: "",
      }));
      return;
    }
    const school = schools.find(s => s.id === id);
    if (!school) return;
    const planKey = normalizePlanKey(school.plan || "basic");
    const planInfo = calculatePlanInvoice(planKey, form.duration_months);
    setForm(f => ({
      ...f,
      school_id: school.id,
      school_name: school.name,
      school_slug: school.slug,
      contact_email: school.contact_email || f.contact_email || "",
      plan: planKey,
      amount: planInfo.amount,
    }));
  };

  const handlePlanChange = (plan: string) => {
    const planInfo = calculatePlanInvoice(plan, form.duration_months);
    setForm(f => ({ ...f, plan: planInfo.planKey, amount: planInfo.amount }));
  };

  const handleDurationChange = (months: number) => {
    const planInfo = calculatePlanInvoice(form.plan, months);
    setForm(f => ({ ...f, duration_months: months, amount: planInfo.amount }));
  };

  const handleSave = async () => {
    const schoolId = form.school_id.trim();
    const schoolName = form.school_name.trim();
    if (!schoolId || !schoolName) {
      return alert("Pilih institusi terlebih dahulu.");
    }

    setSaving(true);
    try {
      const planInfo = calculatePlanInvoice(form.plan, Number(form.duration_months) || 1);
      const payload: Record<string, unknown> = {
        invoice_number: form.invoice_number.trim() || generateInvoiceNumber(),
        school_id: schoolId,
        school_name: schoolName,
        school_slug: form.school_slug.trim(),
        plan: planInfo.planKey,
        plan_label: planInfo.planLabel,
        duration_months: planInfo.durationMonths,
        period_label: planInfo.periodLabel,
        amount: Number(form.amount) || planInfo.amount,
        status: form.status,
        due_date: form.due_date || undefined,
        paid_date: form.status === "paid"
          ? (form.paid_date || new Date().toISOString().slice(0, 10))
          : undefined,
        notes: form.notes?.trim() || undefined,
      };

      const contactEmail = form.contact_email?.trim();
      if (contactEmail) payload.contact_email = contactEmail;

      let saved: any;
      if (editingInvoice) {
        saved = await masterPb.collection("invoices").update(editingInvoice.id, payload);
      } else {
        saved = await masterPb.collection("invoices").create(payload);
      }

      // Jika ditandai paid, otomatis upgrade paket dan masa aktif sekolah
      if (form.status === "paid") {
        await upgradeSchoolFromInvoice(saved);
      }

      await loadInvoices();
      setShowModal(false);
    } catch (err: any) {
      console.error("Gagal menyimpan invoice:", err);
      const fieldErrors = err?.data?.data as Record<string, { message?: string }> | undefined;
      const fieldMessage = fieldErrors
        ? Object.entries(fieldErrors)
          .map(([field, detail]) => `${field}: ${detail?.message || "nilai tidak valid"}`)
          .join("; ")
        : "";
      const msg = fieldMessage || err?.data?.message || err?.message || "Gagal menyimpan invoice ke database master.";
      alert(`Gagal menyimpan invoice: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus invoice ini? Tindakan tidak bisa dibatalkan.")) return;
    try {
      await masterPb.collection("invoices").delete(id);
      await loadInvoices();
      if (detailInvoice?.id === id) setDetailInvoice(null);
    } catch (err: any) {
      alert(err.message || "Gagal menghapus invoice.");
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const updated = await masterPb.collection("invoices").update<Invoice>(id, {
        status: "paid",
        paid_date: today,
      });
      // Otomatis upgrade paket dan masa aktif sekolah saat ditandai lunas
      await upgradeSchoolFromInvoice(updated);
      await loadInvoices();
      if (detailInvoice?.id === id) {
        setDetailInvoice(updated);
      }
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui status invoice.");
    }
  };

  // Upload payment proof via PocketBase file upload
  const handleProofUpload = async (invoiceId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) return alert("Ukuran file maksimal 5 MB.");
    setUploadingProof(invoiceId);
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
      setUploadingProof(null);
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

  // Stats
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidAmount = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
  const unpaidCount = invoices.filter(i => getInvoiceStatus(i) === "unpaid" || getInvoiceStatus(i) === "overdue").length;
  const overdueCount = invoices.filter(i => getInvoiceStatus(i) === "overdue").length;

  return (
    <SuperAdminLayout>
      <div className="space-y-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-none">Invoice</h1>
            <p className="text-sm text-slate-500 mt-1">Kelola tagihan dan bukti pembayaran institusi</p>
          </div>
          <button
            onClick={openTopup}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <TrendingUp size={15} />
            Top-Up Kuota
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus size={15} />
            Buat Invoice
          </button>
        </div>

        {/* Stats row — 4 numbers, all from real data */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Tagihan", value: formatRupiah(totalAmount), note: `${invoices.length} invoice`, color: "text-slate-900" },
            { label: "Sudah Lunas", value: formatRupiah(paidAmount), note: `${invoices.filter(i => i.status === "paid").length} invoice`, color: "text-emerald-700" },
            { label: "Belum Bayar", value: String(unpaidCount), note: "invoice aktif", color: "text-amber-700" },
            { label: "Terlambat", value: String(overdueCount), note: "melewati jatuh tempo", color: overdueCount > 0 ? "text-red-700" : "text-slate-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
              <p className={cn("text-xl font-bold mt-1 leading-none", stat.color)}>{stat.value}</p>
              <p className="text-xs text-slate-400 mt-1">{stat.note}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama institusi atau nomor invoice..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition shadow-sm"
                />
              </div>
              <button
                onClick={() => { loadSchools(); loadInvoices(); }}
                className="p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-500 transition shadow-sm shrink-0"
                title="Refresh"
              >
                <RefreshCw size={18} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as PaymentStatus | "all")}
                  className="w-full pl-10 pr-10 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition appearance-none cursor-pointer shadow-sm text-slate-700"
                >
                  <option value="all">Semua Status</option>
                  <option value="unpaid">Belum Bayar</option>
                  <option value="paid">Lunas</option>
                  <option value="overdue">Terlambat</option>
                  <option value="cancelled">Dibatalkan</option>
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={filterTime}
                  onChange={e => setFilterTime(e.target.value as any)}
                  className="w-full pl-4 pr-10 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition appearance-none cursor-pointer shadow-sm text-slate-700"
                >
                  <option value="all">Semua Waktu</option>
                  <option value="today">Hari Ini</option>
                  <option value="week">7 Hari Terakhir</option>
                  <option value="month">Bulan Ini</option>
                  <option value="year">Tahun Ini</option>
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={filterPackage}
                  onChange={e => setFilterPackage(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition appearance-none cursor-pointer shadow-sm text-slate-700"
                >
                  <option value="all">Semua Paket</option>
                  <option value="free">Paket Free / Trial</option>
                  <option value="berkembang">Paket Berkembang</option>
                  <option value="maju">Paket Maju</option>
                  <option value="unggul">Paket Unggul</option>
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

        {/* Invoice table */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
            <RefreshCw size={20} className="text-slate-400 mx-auto animate-spin" />
            <p className="text-sm text-slate-400 mt-3">Memuat data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
            <FileText size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">
              {search || filterStatus !== "all" ? "Tidak ada invoice yang cocok." : "Belum ada invoice."}
            </p>
            {!search && filterStatus === "all" && (
              <button onClick={openCreate} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
                Buat invoice pertama
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                    <th className="px-4 py-3 min-w-[140px]">Invoice</th>
                    <th className="px-4 py-3 min-w-[190px]">Institusi</th>
                    <th className="px-4 py-3 min-w-[140px]">Paket & Durasi</th>
                    <th className="px-4 py-3 min-w-[130px] text-right">Total Tagihan</th>
                    <th className="px-4 py-3 min-w-[140px]">Status & Bukti</th>
                    <th className="px-4 py-3 min-w-[140px]">Jatuh Tempo</th>
                    <th className="px-4 py-3 text-right min-w-[130px]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(inv => {
                    const effectiveStatus = getInvoiceStatus(inv);
                    const cfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.unpaid;
                    const StatusIcon = cfg.icon;
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-bold text-slate-800">{inv.invoice_number}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(inv.created)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 text-xs truncate max-w-[180px]">{inv.school_name}</p>
                          <p className="text-[10px] font-mono text-purple-600 mt-0.5">{inv.school_slug}.examku.my.id</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-700 font-semibold block">
                            {inv.plan_label || PLAN_PRICES[inv.plan]?.label || inv.plan}
                          </span>
                          <span className="text-[10px] text-slate-400">{inv.period_label || `${inv.duration_months} bulan`}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold font-mono text-slate-900 text-xs">{formatRupiah(inv.amount)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                              cfg.color, cfg.bg, cfg.border
                            )}>
                              <StatusIcon size={10} />
                              {cfg.label}
                            </span>
                            {inv.payment_proof && (
                              <a
                                href={getProofUrl(inv)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors"
                                title="Lihat bukti pembayaran transfer"
                              >
                                <Paperclip size={10} /> Bukti Transfer
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {inv.status === "paid" && inv.paid_date ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                              <CheckCircle2 size={11} /> Lunas ({formatDate(inv.paid_date)})
                            </span>
                          ) : (
                            <span className={cn(
                              "text-xs font-semibold",
                              effectiveStatus === "overdue" ? "text-rose-600 font-bold" : "text-slate-600"
                            )}>
                              {formatDate(inv.due_date)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end">
                            <div className="inline-flex items-center p-0.5 bg-slate-100/80 border border-slate-200/90 rounded-xl shadow-2xs">
                              <button
                                onClick={() => setDetailInvoice(inv)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-2xs transition-all"
                                title="Lihat Detail Invoice"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => printInvoice(inv)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-2xs transition-all"
                                title="Cetak Invoice Digital (PDF)"
                              >
                                <Printer size={13} />
                              </button>
                              <button
                                onClick={() => openEdit(inv)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-2xs transition-all"
                                title="Edit Data Invoice"
                              >
                                <Edit size={13} />
                              </button>
                              <button
                                onClick={() => handleDelete(inv.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-rose-600 hover:shadow-2xs transition-all"
                                title="Hapus Invoice"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map(inv => {
                const effectiveStatus = getInvoiceStatus(inv);
                const cfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.unpaid;
                const StatusIcon = cfg.icon;
                return (
                  <div key={inv.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-800 block">{inv.invoice_number}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">{formatDate(inv.created)}</span>
                      </div>
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border flex-shrink-0",
                        cfg.color, cfg.bg, cfg.border
                      )}>
                        <StatusIcon size={11} />
                        {cfg.label}
                      </span>
                    </div>

                    <div>
                      <p className="font-bold text-slate-900 text-sm">{inv.school_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{inv.school_slug}</p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-50">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Paket & Durasi</span>
                        <span className="text-xs font-semibold text-slate-700">
                          {inv.plan_label || PLAN_PRICES[inv.plan]?.label || inv.plan} • {inv.period_label || `${inv.duration_months} bulan`}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Tagihan</span>
                        <span className="text-sm font-extrabold text-blue-700">{formatRupiah(inv.amount)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 text-slate-500">
                      <span>
                        Jatuh Tempo:{" "}
                        <strong className="text-slate-700">
                          {inv.status === "paid" && inv.paid_date ? `Lunas (${formatDate(inv.paid_date)})` : formatDate(inv.due_date)}
                        </strong>
                      </span>
                      {inv.payment_proof && (
                        <a
                          href={getProofUrl(inv)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 font-bold hover:underline"
                        >
                          <Paperclip size={12} />
                          Bukti Bayar
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-1">
                      <button
                        onClick={() => setDetailInvoice(inv)}
                        className="min-h-[40px] col-span-1 border border-slate-200 bg-white hover:bg-blue-50 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all shadow-xs"
                      >
                        <Eye size={13} />
                        <span>Detail</span>
                      </button>
                      <button
                        onClick={() => printInvoice(inv)}
                        className="min-h-[40px] col-span-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all shadow-xs"
                      >
                        <Printer size={13} />
                        <span>PDF</span>
                      </button>
                      <button
                        onClick={() => openEdit(inv)}
                        className="min-h-[40px] col-span-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all shadow-xs"
                      >
                        <Edit size={13} />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="min-h-[40px] col-span-1 border border-red-200 bg-white hover:bg-red-50 text-red-500 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all shadow-xs"
                      >
                        <Trash2 size={13} />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Create/Edit Modal ─────────────────────────────────────────── */}
            {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-900">{editingInvoice ? "Edit Invoice" : "Buat Invoice Baru"}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{form.invoice_number}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Invoice Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nomor Invoice</label>
                <input
                  type="text"
                  value={form.invoice_number}
                  onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                  placeholder="INV-XXXX-XXXX"
                  required
                />
              </div>

              {/* School selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Institusi</label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={form.school_id}
                    onChange={e => handleSchoolSelect(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none transition"
                  >
                    <option value="">Pilih institusi...</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.slug})</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Contact Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Kontak (opsional)</label>
                <input
                  type="email"
                  value={form.contact_email || ""}
                  onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                  placeholder="admin@sekolah.sch.id"
                />
              </div>

              {/* Plan & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Plan</label>
                  <div className="relative">
                    <CreditCard size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={form.plan}
                      onChange={e => handlePlanChange(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none transition"
                    >
                      {Object.entries(PLAN_PRICES).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Durasi</label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={form.duration_months}
                      onChange={e => handleDurationChange(Number(e.target.value))}
                      className="w-full pl-8 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none transition"
                    >
                      {[1, 2, 3, 6, 12].map(m => (
                        <option key={m} value={m}>
                          {m === 12 ? "1 tahun (12 bulan)" : m === 6 ? "1 semester (6 bulan)" : `${m} bulan`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Amount (read + edit) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jumlah Tagihan (Rp)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                  min={0}
                />
                <p className="text-[11px] text-slate-400 mt-1">{formatRupiah(form.amount)}</p>
              </div>

              {/* Status & Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
                  <div className="relative">
                    <select
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value as PaymentStatus }))}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none transition"
                    >
                      <option value="unpaid">Belum Bayar</option>
                      <option value="paid">Lunas</option>
                      <option value="overdue">Terlambat</option>
                      <option value="cancelled">Dibatalkan</option>
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jatuh Tempo</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                  />
                </div>
              </div>

              {form.status === "paid" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tanggal Bayar</label>
                  <input
                    type="date"
                    value={form.paid_date}
                    onChange={e => setForm(f => ({ ...f, paid_date: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Catatan (opsional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Catatan tambahan untuk invoice ini..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : editingInvoice ? "Simpan Perubahan" : "Buat Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Top-Up Kuota Modal (periode tetap) ─────────────────────────── */}
      {showTopupModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-900">Top-Up Kuota (Periode Tetap)</h2>
                <p className="text-xs text-slate-400 mt-0.5">Naikkan kuota tanpa mengubah tanggal berakhir masa aktif</p>
              </div>
              <button onClick={() => setShowTopupModal(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Institusi</label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={topupSchoolId}
                    onChange={e => handleTopupSchoolChange(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 appearance-none transition"
                  >
                    <option value="">Pilih institusi...</option>
                    {topupEligibleSchools.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.slug})</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                {topupEligibleSchools.length === 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">Tidak ada sekolah dengan masa aktif berbayar yang berjalan.</p>
                )}
              </div>

              {topupSchool && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Paket Tujuan</label>
                  <div className="relative">
                    <CreditCard size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={topupTargetPlan}
                      onChange={e => setTopupTargetPlan(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 appearance-none transition"
                    >
                      {topupTargetOptions.map(k => (
                        <option key={k} value={k}>{PLAN_PRICING[k].label} ({PLAN_PRICING[k].quota} siswa)</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {topupCalcError && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{topupCalcError}</span>
                </div>
              )}

              {topupData && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Paket saat ini</span>
                    <span className="font-semibold text-slate-800">{topupData.currentLabel} ({topupData.currentQuota} siswa)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Paket tujuan</span>
                    <span className="font-semibold text-slate-800">{topupData.targetLabel} ({topupData.targetQuota} siswa)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sisa masa aktif</span>
                    <span className="font-semibold text-slate-800">{topupData.remainingDays} hari (s/d {formatDateID(topupData.activeUntil)})</span>
                  </div>
                  <div className="flex justify-between border-t border-amber-200 pt-1.5">
                    <span className="text-slate-500">Tagihan top-up</span>
                    <span className="font-bold text-amber-700">Rp {topupData.amount.toLocaleString("id-ID")}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1">
                    Selisih tarif prorata harian. Periode <strong>tidak</strong> diperpanjang — kuota naik segera setelah pembayaran diverifikasi.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button
                onClick={() => setShowTopupModal(false)}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handleIssueTopup}
                disabled={topupSaving || !topupData}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition disabled:opacity-50"
              >
                {topupSaving ? "Menerbitkan..." : "Terbitkan Invoice Top-Up"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detail/Proof Modal ─────────────────────────────────────────── */}
      {detailInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-900">{detailInvoice.invoice_number}</h2>
                  {(() => {
                    const cfg = STATUS_CONFIG[detailInvoice.status];
                    const Icon = cfg.icon;
                    return (
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border", cfg.color, cfg.bg, cfg.border)}>
                        <Icon size={11} />
                        {cfg.label}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Dibuat {formatDate(detailInvoice.created)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printInvoice(detailInvoice)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                  title="Cetak Invoice Digital Resmi (PDF)"
                >
                  <Printer size={13} />
                  <span>Cetak Invoice (PDF)</span>
                </button>
                <button onClick={() => setDetailInvoice(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Invoice info grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Institusi</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{detailInvoice.school_name}</p>
                    <p className="text-xs text-slate-400">{detailInvoice.school_slug}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Plan</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {PLAN_PRICES[detailInvoice.plan]?.label || detailInvoice.plan}
                    </p>
                    <p className="text-xs text-slate-400">{isTopupInvoice(detailInvoice) ? (detailInvoice.period_label || "Top-up kuota (periode tetap)") : `${detailInvoice.duration_months} bulan`}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Jumlah</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">{formatRupiah(detailInvoice.amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                      {detailInvoice.status === "paid" ? "Tanggal Bayar" : "Jatuh Tempo"}
                    </p>
                    <p className={cn("text-sm font-semibold mt-0.5",
                      detailInvoice.status === "paid" ? "text-emerald-700" :
                      detailInvoice.status === "overdue" ? "text-red-700" : "text-slate-800"
                    )}>
                      {detailInvoice.status === "paid" && detailInvoice.paid_date
                        ? formatDate(detailInvoice.paid_date)
                        : formatDate(detailInvoice.due_date)
                      }
                    </p>
                  </div>
                </div>
              </div>

              {detailInvoice.notes && (
                <div className="bg-slate-50 rounded-xl p-3.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Catatan</p>
                  <p className="text-sm text-slate-700">{detailInvoice.notes}</p>
                </div>
              )}

              {/* Payment proof section */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Paperclip size={14} className="text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Bukti Pembayaran</span>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition">
                    <Upload size={12} />
                    {uploadingProof === detailInvoice.id ? "Mengupload..." : "Upload"}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      disabled={uploadingProof === detailInvoice.id}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleProofUpload(detailInvoice.id, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                <div className="p-4">
                  {detailInvoice.payment_proof ? (
                    <div className="space-y-3">
                      {isImageProof(getProofUrl(detailInvoice)) ? (
                        <div className="relative group">
                          <img
                            src={getProofUrl(detailInvoice)}
                            alt="Bukti pembayaran"
                            className="w-full max-h-64 object-contain rounded-lg border border-slate-100 bg-slate-50"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition flex items-center justify-center">
                            <a
                              href={getProofUrl(detailInvoice)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg shadow text-xs font-semibold text-slate-700"
                            >
                              <ExternalLink size={12} />
                              Buka penuh
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <FileText size={24} className="text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700">Dokumen Lampiran</p>
                            <p className="text-xs text-slate-400">Klik untuk melihat file</p>
                          </div>
                          <a
                            href={getProofUrl(detailInvoice)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                          >
                            <ExternalLink size={12} />
                            Buka
                          </a>
                        </div>
                      )}
                      <button
                        onClick={() => removeProof(detailInvoice.id)}
                        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition"
                      >
                        <Trash2 size={12} />
                        Hapus bukti
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Upload size={24} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Belum ada bukti pembayaran.</p>
                      <p className="text-xs text-slate-400 mt-0.5">Upload gambar atau PDF (maks. 5 MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {(detailInvoice.status === "unpaid" || detailInvoice.status === "overdue") && (
                  <button
                    onClick={() => handleMarkPaid(detailInvoice.id)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition"
                  >
                    <CheckCircle2 size={15} />
                    Tandai Lunas
                  </button>
                )}
                <button
                  onClick={() => { setDetailInvoice(null); openEdit(detailInvoice); }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                >
                  <Edit size={15} />
                  Edit Invoice
                </button>
                <button
                  onClick={() => handleDelete(detailInvoice.id)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition ml-auto"
                >
                  <Trash2 size={15} />
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
};

export default SuperAdminInvoicePage;
