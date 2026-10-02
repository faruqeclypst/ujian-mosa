import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText, Plus, Search, Filter, Download, Eye,
  CheckCircle2, Clock, XCircle, Upload, X, ChevronDown,
  Building2, Calendar, CreditCard, Printer, RefreshCw,
  AlertTriangle, Paperclip, ExternalLink, Trash2, Edit,
} from "lucide-react";
import { masterPb } from "../../lib/pocketbase";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { cn } from "../../lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

type PaymentStatus = "unpaid" | "paid" | "overdue" | "cancelled";

interface Invoice {
  id: string;
  invoice_number: string;
  school_id: string;
  school_name: string;
  school_slug: string;
  plan: string;
  duration_months: number;
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
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PLAN_PRICES: Record<string, { label: string; monthly: number }> = {
  free:     { label: "Free Trial",  monthly: 0 },
  basic:    { label: "Berkembang",  monthly: 149000 },
  pro:      { label: "Lanjutan",    monthly: 299000 },
  ultimate: { label: "Premium",     monthly: 499000 },
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

const STORAGE_KEY = "sa_invoices_v1";

const loadInvoices = (): Invoice[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
};

const saveInvoices = (list: Invoice[]) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
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
  return new Date(invoice.due_date) < new Date();
};

// ─── Blank form ─────────────────────────────────────────────────────────────

const blankForm = (): Omit<Invoice, "id" | "created" | "updated"> => ({
  invoice_number: generateInvoiceNumber(),
  school_id: "",
  school_name: "",
  school_slug: "",
  plan: "basic",
  duration_months: 12,
  amount: PLAN_PRICES.basic.monthly * 12,
  status: "unpaid",
  due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  notes: "",
  payment_proof: "",
  paid_date: "",
});

// ─── Invoice Print Template ─────────────────────────────────────────────────

const printInvoice = (inv: Invoice) => {
  const statusCfg = STATUS_CONFIG[inv.status];
  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8"/>
      <title>Invoice ${inv.invoice_number}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Segoe UI', sans-serif; color:#1e293b; background:#fff; padding:40px; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; }
        .brand { display:flex; flex-direction:column; }
        .brand-name { font-size:22px; font-weight:700; color:#1e293b; letter-spacing:-0.5px; }
        .brand-sub { font-size:11px; color:#64748b; margin-top:2px; }
        .invoice-meta { text-align:right; }
        .invoice-label { font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; }
        .invoice-number { font-size:18px; font-weight:700; color:#2563eb; margin-top:2px; }
        .divider { height:1px; background:#e2e8f0; margin:24px 0; }
        .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:32px; }
        .section-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; margin-bottom:8px; }
        .value-main { font-size:14px; font-weight:600; color:#1e293b; }
        .value-sub { font-size:12px; color:#64748b; margin-top:2px; }
        table { width:100%; border-collapse:collapse; margin-bottom:24px; }
        th { background:#f8fafc; font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; padding:10px 12px; text-align:left; border-bottom:2px solid #e2e8f0; }
        td { padding:12px; font-size:13px; border-bottom:1px solid #f1f5f9; }
        .total-row td { font-weight:700; font-size:15px; color:#1e293b; border-top:2px solid #e2e8f0; border-bottom:none; padding-top:14px; }
        .status-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:100px; font-size:12px; font-weight:600; }
        .status-paid { background:#dcfce7; color:#15803d; }
        .status-unpaid { background:#fef3c7; color:#92400e; }
        .status-overdue { background:#fee2e2; color:#991b1b; }
        .status-cancelled { background:#f1f5f9; color:#64748b; }
        .footer { margin-top:48px; padding-top:16px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; }
        .footer-note { font-size:11px; color:#94a3b8; }
        @media print { body { padding:20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">
          <span class="brand-name">EXAM AA</span>
          <span class="brand-sub">Platform CBT Online untuk Sekolah</span>
        </div>
        <div class="invoice-meta">
          <div class="invoice-label">Nomor Invoice</div>
          <div class="invoice-number">${inv.invoice_number}</div>
          <div style="margin-top:6px; font-size:12px; color:#64748b;">Dibuat: ${formatDate(inv.created)}</div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="grid-2">
        <div>
          <div class="section-label">Ditagihkan Kepada</div>
          <div class="value-main">${inv.school_name}</div>
          <div class="value-sub">Kode: ${inv.school_slug}</div>
        </div>
        <div style="text-align:right">
          <div class="section-label">Status</div>
          <div>
            <span class="status-badge status-${inv.status}">${statusCfg.label}</span>
          </div>
          ${inv.paid_date ? `<div style="font-size:11px;color:#64748b;margin-top:6px;">Dibayar: ${formatDate(inv.paid_date)}</div>` : `<div style="font-size:11px;color:#64748b;margin-top:6px;">Jatuh tempo: ${formatDate(inv.due_date)}</div>`}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Deskripsi</th>
            <th style="text-align:center">Durasi</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div style="font-weight:600">${PLAN_PRICES[inv.plan]?.label || inv.plan} Plan</div>
              <div style="font-size:12px;color:#64748b;">Langganan platform ujian digital CBT EXAM AA</div>
            </td>
            <td style="text-align:center">${inv.duration_months} bulan</td>
            <td style="text-align:right;font-weight:600">${formatRupiah(inv.amount)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="2">Total Pembayaran</td>
            <td style="text-align:right">${formatRupiah(inv.amount)}</td>
          </tr>
        </tfoot>
      </table>

      ${inv.notes ? `<div style="background:#f8fafc;border-radius:8px;padding:14px;font-size:12px;color:#64748b;margin-bottom:24px;"><strong style="color:#475569">Catatan:</strong> ${inv.notes}</div>` : ""}

      <div class="footer">
        <div class="footer-note">Dokumen ini dibuat secara otomatis oleh sistem EXAM AA.</div>
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

// ─── Component ───────────────────────────────────────────────────────────────

const SuperAdminInvoicePage = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "all">("all");
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [uploadingProof, setUploadingProof] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const proofFileRef = useRef<HTMLInputElement>(null);

  // Load schools from PocketBase
  const loadSchools = useCallback(async () => {
    try {
      const list = await masterPb.collection("schools").getFullList<SchoolRecord>({ sort: "name" });
      setSchools(list);
    } catch {
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchools();
    setInvoices(loadInvoices());
  }, [loadSchools]);

  // Auto-mark overdue
  useEffect(() => {
    const updated = invoices.map(inv =>
      isOverdue(inv) && inv.status === "unpaid" ? { ...inv, status: "overdue" as PaymentStatus } : inv
    );
    if (updated.some((u, i) => u.status !== invoices[i]?.status)) {
      setInvoices(updated);
      saveInvoices(updated);
    }
  }, [invoices]);

  const filtered = invoices.filter(inv => {
    const matchSearch = inv.school_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || inv.status === filterStatus;
    return matchSearch && matchStatus;
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
    const school = schools.find(s => s.id === id);
    if (!school) return;
    const price = PLAN_PRICES[school.plan || "basic"]?.monthly || PLAN_PRICES.basic.monthly;
    setForm(f => ({
      ...f,
      school_id: school.id,
      school_name: school.name,
      school_slug: school.slug,
      plan: school.plan || "basic",
      amount: price * f.duration_months,
    }));
  };

  const handlePlanChange = (plan: string) => {
    const price = PLAN_PRICES[plan]?.monthly || 0;
    setForm(f => ({ ...f, plan, amount: price * f.duration_months }));
  };

  const handleDurationChange = (months: number) => {
    const price = PLAN_PRICES[form.plan]?.monthly || 0;
    setForm(f => ({ ...f, duration_months: months, amount: price * months }));
  };

  const handleSave = async () => {
    if (!form.school_name.trim()) return alert("Pilih institusi terlebih dahulu.");
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (editingInvoice) {
        const updated: Invoice = {
          ...editingInvoice,
          ...form,
          updated: now,
        };
        const list = invoices.map(inv => inv.id === editingInvoice.id ? updated : inv);
        setInvoices(list);
        saveInvoices(list);
      } else {
        const newInv: Invoice = {
          id: Date.now().toString(),
          ...form,
          created: now,
          updated: now,
        };
        const list = [newInv, ...invoices];
        setInvoices(list);
        saveInvoices(list);
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Hapus invoice ini? Tindakan tidak bisa dibatalkan.")) return;
    const list = invoices.filter(inv => inv.id !== id);
    setInvoices(list);
    saveInvoices(list);
    if (detailInvoice?.id === id) setDetailInvoice(null);
  };

  const handleMarkPaid = (id: string) => {
    const list = invoices.map(inv =>
      inv.id === id
        ? { ...inv, status: "paid" as PaymentStatus, paid_date: new Date().toISOString().slice(0, 10), updated: new Date().toISOString() }
        : inv
    );
    setInvoices(list);
    saveInvoices(list);
    if (detailInvoice?.id === id) {
      setDetailInvoice(list.find(i => i.id === id) || null);
    }
  };

  // Upload payment proof as base64
  const handleProofUpload = async (invoiceId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) return alert("Ukuran file maksimal 5 MB.");
    setUploadingProof(invoiceId);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const list = invoices.map(inv =>
          inv.id === invoiceId
            ? { ...inv, payment_proof: dataUrl, updated: new Date().toISOString() }
            : inv
        );
        setInvoices(list);
        saveInvoices(list);
        if (detailInvoice?.id === invoiceId) {
          setDetailInvoice(list.find(i => i.id === invoiceId) || null);
        }
        setUploadingProof(null);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingProof(null);
    }
  };

  const removeProof = (invoiceId: string) => {
    const list = invoices.map(inv =>
      inv.id === invoiceId ? { ...inv, payment_proof: "", updated: new Date().toISOString() } : inv
    );
    setInvoices(list);
    saveInvoices(list);
    if (detailInvoice?.id === invoiceId) {
      setDetailInvoice(list.find(i => i.id === invoiceId) || null);
    }
  };

  // Stats
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidAmount = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
  const unpaidCount = invoices.filter(i => i.status === "unpaid" || i.status === "overdue").length;
  const overdueCount = invoices.filter(i => i.status === "overdue").length;

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
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama institusi atau nomor invoice..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            />
          </div>
          <div className="relative">
            <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as PaymentStatus | "all")}
              className="pl-8 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition appearance-none cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="unpaid">Belum Bayar</option>
              <option value="paid">Lunas</option>
              <option value="overdue">Terlambat</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <button
            onClick={() => { loadSchools(); setInvoices(loadInvoices()); }}
            className="p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-500 transition"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
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
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Institusi</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Jumlah</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Jatuh Tempo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bukti</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(inv => {
                    const cfg = STATUS_CONFIG[inv.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-semibold text-slate-700">{inv.invoice_number}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(inv.created)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800 text-xs">{inv.school_name}</p>
                          <p className="text-[10px] text-slate-400">{inv.school_slug}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600 font-medium">
                            {PLAN_PRICES[inv.plan]?.label || inv.plan}
                          </span>
                          <p className="text-[10px] text-slate-400">{inv.duration_months} bulan</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-slate-900 text-xs">{formatRupiah(inv.amount)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                            cfg.color, cfg.bg, cfg.border
                          )}>
                            <StatusIcon size={11} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {inv.status === "paid" && inv.paid_date
                            ? <span className="text-emerald-600">Dibayar {formatDate(inv.paid_date)}</span>
                            : formatDate(inv.due_date)
                          }
                        </td>
                        <td className="px-4 py-3">
                          {inv.payment_proof ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                              <Paperclip size={11} />
                              Ada
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setDetailInvoice(inv)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition"
                              title="Detail"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => printInvoice(inv)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                              title="Cetak"
                            >
                              <Printer size={14} />
                            </button>
                            <button
                              onClick={() => openEdit(inv)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                      {[1, 3, 6, 12].map(m => (
                        <option key={m} value={m}>{m} bulan</option>
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
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                >
                  <Printer size={13} />
                  Cetak
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
                    <p className="text-xs text-slate-400">{detailInvoice.duration_months} bulan</p>
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
                      ref={proofFileRef}
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
                      {detailInvoice.payment_proof.startsWith("data:image") ? (
                        <div className="relative group">
                          <img
                            src={detailInvoice.payment_proof}
                            alt="Bukti pembayaran"
                            className="w-full max-h-64 object-contain rounded-lg border border-slate-100 bg-slate-50"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition flex items-center justify-center">
                            <a
                              href={detailInvoice.payment_proof}
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
                            <p className="text-sm font-medium text-slate-700">Dokumen PDF</p>
                            <p className="text-xs text-slate-400">Klik untuk melihat</p>
                          </div>
                          <a
                            href={detailInvoice.payment_proof}
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
