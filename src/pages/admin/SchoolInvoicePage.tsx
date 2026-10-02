import { useState, useEffect, useRef } from "react";
import {
  FileText, Upload, Eye, Printer, CheckCircle2, Clock,
  AlertTriangle, XCircle, Paperclip, ExternalLink, Trash2,
  RefreshCw, ChevronDown, X,
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";

// ─── Types ───────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────

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
  unpaid:    { label: "Belum Dibayar", color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",  icon: Clock },
  paid:      { label: "Lunas",          color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle2 },
  overdue:   { label: "Terlambat",      color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",    icon: AlertTriangle },
  cancelled: { label: "Dibatalkan",     color: "text-slate-500",   bg: "bg-slate-100",  border: "border-slate-200",  icon: XCircle },
};

const STORAGE_KEY = "sa_invoices_v1";

const loadInvoices = (): Invoice[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
};

const saveInvoices = (list: Invoice[]) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
};

const formatRupiah = (n: number): string =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const formatDate = (iso: string): string => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

// ─── Print (school-facing, same source of truth) ─────────────

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
  const { school } = useTenant();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const proofFileRef = useRef<HTMLInputElement>(null);

  // Only show invoices for this school
  useEffect(() => {
    if (!school) { setLoading(false); return; }
    const all = loadInvoices();
    const mine = all.filter(inv =>
      inv.school_slug === school.slug || inv.school_id === school.id
    );
    setInvoices(mine);
    setLoading(false);
  }, [school]);

  // Sync detail view if invoices update
  useEffect(() => {
    if (detailInvoice) {
      const updated = invoices.find(i => i.id === detailInvoice.id);
      if (updated) setDetailInvoice(updated);
    }
  }, [invoices]);

  const handleProofUpload = (invoiceId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert("Ukuran file maksimal 5 MB."); return; }
    setUploadingProof(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      // Update shared localStorage so superadmin sees the proof too
      const all = loadInvoices();
      const updated = all.map(inv =>
        inv.id === invoiceId
          ? { ...inv, payment_proof: dataUrl, updated: new Date().toISOString() }
          : inv
      );
      saveInvoices(updated);

      const mine = updated.filter(inv =>
        inv.school_slug === school?.slug || inv.school_id === school?.id
      );
      setInvoices(mine);
      setUploadingProof(false);
    };
    reader.onerror = () => setUploadingProof(false);
    reader.readAsDataURL(file);
  };

  const removeProof = (invoiceId: string) => {
    const all = loadInvoices();
    const updated = all.map(inv =>
      inv.id === invoiceId ? { ...inv, payment_proof: "", updated: new Date().toISOString() } : inv
    );
    saveInvoices(updated);
    const mine = updated.filter(inv =>
      inv.school_slug === school?.slug || inv.school_id === school?.id
    );
    setInvoices(mine);
  };

  const unpaidCount = invoices.filter(i => i.status === "unpaid" || i.status === "overdue").length;
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);

  if (!school) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-slate-500">Data institusi tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 leading-none">Invoice & Pembayaran</h1>
        <p className="text-sm text-slate-500 mt-1">Riwayat tagihan langganan {school.name}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Invoice", value: String(invoices.length), note: "semua periode" },
          { label: "Belum Lunas", value: String(unpaidCount), note: "perlu perhatian", highlight: unpaidCount > 0 },
          { label: "Total Terbayar", value: formatRupiah(totalPaid), note: "riwayat lunas" },
        ].map((s) => (
          <div key={s.label} className={cn(
            "rounded-xl border p-4",
            s.highlight ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"
          )}>
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={cn("text-xl font-bold mt-1 leading-none", s.highlight ? "text-amber-800" : "text-slate-900")}>
              {s.value}
            </p>
            <p className="text-xs text-slate-400 mt-1">{s.note}</p>
          </div>
        ))}
      </div>

      {/* Invoice list */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <RefreshCw size={20} className="text-slate-400 mx-auto animate-spin" />
          <p className="text-sm text-slate-400 mt-3">Memuat invoice...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <FileText size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Belum ada invoice.</p>
          <p className="text-xs text-slate-400 mt-1">Invoice akan muncul di sini setelah dikeluarkan oleh admin EXAM AA.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => {
            const cfg = STATUS_CONFIG[inv.status];
            const StatusIcon = cfg.icon;
            const hasProof = !!inv.payment_proof;
            const needsAction = inv.status === "unpaid" || inv.status === "overdue";

            return (
              <div
                key={inv.id}
                className={cn(
                  "bg-white border rounded-xl p-4 transition-colors hover:border-slate-300",
                  inv.status === "overdue" ? "border-red-200 bg-red-50/30" : "border-slate-200"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Left */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-700">{inv.invoice_number}</span>
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                        cfg.color, cfg.bg, cfg.border
                      )}>
                        <StatusIcon size={10} />
                        {cfg.label}
                      </span>
                      {hasProof && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                          <Paperclip size={10} />
                          Bukti diunggah
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      {PLAN_PRICES[inv.plan]?.label || inv.plan} &middot; {inv.duration_months} bulan
                    </p>
                    <p className="text-xs text-slate-400">
                      {inv.status === "paid" && inv.paid_date
                        ? `Dibayar ${formatDate(inv.paid_date)}`
                        : `Jatuh tempo ${formatDate(inv.due_date)}`
                      }
                    </p>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <p className="font-bold text-slate-900">{formatRupiah(inv.amount)}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDetailInvoice(inv)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                      >
                        <Eye size={12} />
                        Detail
                      </button>
                      {needsAction && !hasProof && (
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition">
                          <Upload size={12} />
                          Upload Bukti
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
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      {invoices.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">Cara membayar</p>
          <p className="text-xs leading-relaxed text-blue-700">
            Lakukan transfer sesuai jumlah tagihan, kemudian upload bukti transfer di halaman detail invoice.
            Tim EXAM AA akan memverifikasi dan mengubah status menjadi Lunas.
          </p>
        </div>
      )}

      {/* ─── Detail Modal ──────────────────────────────────────────── */}
      {detailInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-slate-900 text-sm">{detailInvoice.invoice_number}</h2>
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
                <p className="text-xs text-slate-400 mt-0.5">Diterbitkan {formatDate(detailInvoice.created)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printInvoice(detailInvoice)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                >
                  <Printer size={12} />
                  Cetak
                </button>
                <button onClick={() => setDetailInvoice(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Invoice breakdown */}
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-500">Rincian Tagihan</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {[
                    { label: "Layanan", value: `${PLAN_PRICES[detailInvoice.plan]?.label || detailInvoice.plan} Plan` },
                    { label: "Durasi", value: `${detailInvoice.duration_months} bulan` },
                    { label: "Jatuh Tempo", value: formatDate(detailInvoice.due_date) },
                    ...(detailInvoice.paid_date ? [{ label: "Tanggal Bayar", value: formatDate(detailInvoice.paid_date) }] : []),
                  ].map(row => (
                    <div key={row.label} className="flex justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">{row.label}</span>
                      <span className="text-xs font-semibold text-slate-800">{row.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-3 bg-slate-50">
                    <span className="text-sm font-bold text-slate-800">Total</span>
                    <span className="text-sm font-bold text-slate-900">{formatRupiah(detailInvoice.amount)}</span>
                  </div>
                </div>
              </div>

              {detailInvoice.notes && (
                <div className="bg-slate-50 rounded-xl p-3.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Catatan dari Admin</p>
                  <p className="text-sm text-slate-700">{detailInvoice.notes}</p>
                </div>
              )}

              {/* Upload proof section */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Paperclip size={14} className="text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Bukti Pembayaran</span>
                  </div>
                  {(detailInvoice.status === "unpaid" || detailInvoice.status === "overdue") && (
                    <label className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition",
                      uploadingProof
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100"
                    )}>
                      <Upload size={12} />
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
                      {detailInvoice.payment_proof.startsWith("data:image") ? (
                        <div className="relative group">
                          <img
                            src={detailInvoice.payment_proof}
                            alt="Bukti pembayaran"
                            className="w-full max-h-56 object-contain rounded-lg border border-slate-100 bg-slate-50"
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
                          <FileText size={22} className="text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700">Dokumen PDF</p>
                            <p className="text-xs text-slate-400">Klik untuk membuka</p>
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
                      {(detailInvoice.status === "unpaid" || detailInvoice.status === "overdue") && (
                        <button
                          onClick={() => removeProof(detailInvoice.id)}
                          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition"
                        >
                          <Trash2 size={12} />
                          Hapus dan upload ulang
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-7">
                      <Upload size={24} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">
                        {detailInvoice.status === "paid"
                          ? "Tidak ada bukti yang diunggah."
                          : "Belum ada bukti pembayaran."}
                      </p>
                      {(detailInvoice.status === "unpaid" || detailInvoice.status === "overdue") && (
                        <p className="text-xs text-slate-400 mt-0.5">Upload gambar atau PDF (maks. 5 MB)</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {detailInvoice.status === "paid" && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                  <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Pembayaran dikonfirmasi</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      {detailInvoice.paid_date ? `Lunas pada ${formatDate(detailInvoice.paid_date)}` : "Sudah terverifikasi"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolInvoicePage;
