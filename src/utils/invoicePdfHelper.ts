/**
 * invoicePdfHelper.ts
 * Generator Invoice Digital & Kuitansi Resmi EXAMKU (Format Cetak / Simpan PDF)
 * Didesain khusus untuk akuntansi umum, pelaporan SPJ, RKAS/ARKAS, dan Dana BOS/BOSP.
 */

import { PLAN_PRICING, normalizePlanKey } from "./pricingHelper";

export function terbilang(nominal: number): string {
  const n = Math.floor(Math.abs(nominal));
  if (n === 0) return "Nol Rupiah";

  const angka = [
    "",
    "Satu",
    "Dua",
    "Tiga",
    "Empat",
    "Lima",
    "Enam",
    "Tujuh",
    "Delapan",
    "Sembilan",
    "Sepuluh",
    "Sebelas",
  ];

  function toWords(num: number): string {
    if (num < 12) return angka[num];
    if (num < 20) return `${toWords(num - 10)} Belas`;
    if (num < 100) return `${toWords(Math.floor(num / 10))} Puluh ${toWords(num % 10)}`.trim();
    if (num < 200) return `Seratus ${toWords(num - 100)}`.trim();
    if (num < 1000) return `${toWords(Math.floor(num / 100))} Ratus ${toWords(num % 100)}`.trim();
    if (num < 2000) return `Seribu ${toWords(num - 1000)}`.trim();
    if (num < 1000000) return `${toWords(Math.floor(num / 1000))} Ribu ${toWords(num % 1000)}`.trim();
    if (num < 1000000000) return `${toWords(Math.floor(num / 1000000))} Juta ${toWords(num % 1000000)}`.trim();
    if (num < 1000000000000) return `${toWords(Math.floor(num / 1000000000))} Miliar ${toWords(num % 1000000000)}`.trim();
    return `${toWords(Math.floor(num / 1000000000000))} Triliun ${toWords(num % 1000000000000)}`.trim();
  }

  const result = toWords(n);
  return `${result} Rupiah`;
}

export interface InvoiceLineItem {
  id?: string;
  description: string;
  qty: number;
  unit?: string;
  price: number;
  total: number;
}

export interface RkasMetadata {
  enabled?: boolean;
  budget_code?: string;       // Kode Rekening Belanja ARKAS (contoh: 5.1.02.02.01.0061)
  activity_name?: string;     // Uraian Kegiatan RKAS (contoh: Pelaksanaan Asesmen Sumatif Jenjang SMA)
  fiscal_year?: string;       // Tahun Anggaran (contoh: 2026 / 2027)
  funding_source?: string;    // Sumber Dana (contoh: BOS Reguler, BOS Kinerja, Komite)
  headmaster_name?: string;   // Nama Kepala Sekolah
  headmaster_nip?: string;    // NIP Kepala Sekolah
  treasurer_name?: string;    // Nama Bendahara BOS
  treasurer_nip?: string;     // NIP Bendahara BOS
  supplier_npwp?: string;     // NPWP Penyedia
}

export interface InvoiceTaxConfig {
  enabled?: boolean;
  rate_percent?: number;      // Persentase PPN (default: 11)
  tax_name?: string;          // e.g. "PPN 11%"
  tax_amount?: number;        // Nilai nominal PPN
  subtotal?: number;          // Subtotal sebelum PPN (Hak bersih penyedia)
}

export interface InvoiceCustomData {
  is_custom?: boolean;
  items?: InvoiceLineItem[];
  rkas?: RkasMetadata;
  tax?: InvoiceTaxConfig;
}

export interface InvoiceData {
  id: string;
  invoice_number: string;
  school_id?: string;
  school_name: string;
  school_slug: string;
  contact_email?: string;
  plan: string;
  plan_label?: string;
  duration_months: number;
  period_label?: string;
  amount: number;
  status: "paid" | "unpaid" | "overdue" | "cancelled";
  due_date: string;
  paid_date?: string;
  notes?: string;
  custom_data?: InvoiceCustomData | string | null;
  created: string;
  updated?: string;
}

export interface SchoolMeta {
  name?: string;
  slug?: string;
  contact_email?: string;
  student_quota?: number;
  plan?: string;
  custom_domain?: string;
}

export const formatRupiah = (n: number): string =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export const formatDateIndo = (iso?: string): string => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export function parseCustomData(raw: unknown): InvoiceCustomData | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as InvoiceCustomData;
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      return JSON.parse(raw) as InvoiceCustomData;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Cetak Invoice Digital Resmi (A4)
 * Mendukung format paket SaaS standar maupun rincian item kustom & RKAS.
 */
export function printDigitalInvoice(inv: InvoiceData, school?: SchoolMeta | null) {
  const isPaid = inv.status === "paid";
  const createdDate = formatDateIndo(inv.created || new Date().toISOString());
  const dueDate = formatDateIndo(inv.due_date);
  const paidDate = inv.paid_date ? formatDateIndo(inv.paid_date) : "-";

  const customData = parseCustomData(inv.custom_data);
  const hasCustomItems = Boolean(customData?.items && customData.items.length > 0);
  const rkas = customData?.rkas?.enabled ? customData.rkas : null;
  const tax = customData?.tax?.enabled ? customData.tax : null;

  const customItemsSum = hasCustomItems && customData?.items
    ? customData.items.reduce((acc, it) => acc + (it.total || (it.qty * it.price)), 0)
    : 0;

  let subtotalAmount = 0;
  let taxAmount = 0;
  let finalGrandTotal = 0;

  if (tax && tax.enabled) {
    const rate = tax.rate_percent ?? 11;
    subtotalAmount = hasCustomItems && customItemsSum > 0 ? customItemsSum : (tax.subtotal || inv.amount);
    taxAmount = tax.tax_amount ?? Math.round(subtotalAmount * (rate / 100));
    finalGrandTotal = subtotalAmount + taxAmount;
  } else {
    subtotalAmount = hasCustomItems && customItemsSum > 0 ? customItemsSum : inv.amount;
    taxAmount = 0;
    finalGrandTotal = subtotalAmount;
  }

  const terbilangText = terbilang(finalGrandTotal);

  const planQuota = PLAN_PRICING[normalizePlanKey(inv.plan)]?.quota;
  const quotaText = planQuota
    ? `${planQuota} Siswa`
    : school?.student_quota
      ? `${school.student_quota} Siswa`
      : "Kuota Terdaftar";
  const planLabel = inv.plan_label || (inv.plan ? inv.plan.toUpperCase() : "STANDARD");
  const schoolDomain = school?.custom_domain || `${inv.school_slug}.examku.my.id`;

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <title>Invoice Resmi ${inv.invoice_number}</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page {
          size: A4 portrait;
          margin: 0;
        }
        body {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #0f172a;
          background: #ffffff;
          line-height: 1.5;
          font-size: 11.5px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .container {
          max-width: 210mm;
          margin: 0 auto;
          padding: 12mm 15mm;
          position: relative;
        }

        ${isPaid ? `
        .watermark {
          position: absolute;
          top: 38%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          font-size: 110px;
          font-weight: 800;
          color: rgba(16, 185, 129, 0.05);
          z-index: 0;
          pointer-events: none;
          text-transform: uppercase;
          white-space: nowrap;
        }
        ` : ''}

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          position: relative;
          z-index: 10;
        }
        
        .brand-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo-box {
          height: 48px;
          width: auto;
          max-width: 160px;
          object-fit: contain;
        }
        .company-info h1 {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
          line-height: 1.2;
        }
        .company-info p {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }

        .invoice-title-wrapper {
          text-align: right;
        }
        .invoice-title {
          font-size: 26px;
          font-weight: 800;
          color: #0284c7;
          letter-spacing: 1px;
          line-height: 1;
          margin-bottom: 4px;
        }
        .invoice-number {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          background: #f1f5f9;
          padding: 3px 8px;
          border-radius: 6px;
          display: inline-block;
        }

        .billing-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
          position: relative;
          z-index: 10;
        }
        .billing-box {
          padding: 14px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .billing-label {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .billing-name {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .billing-detail {
          font-size: 10.5px;
          color: #475569;
          line-height: 1.5;
        }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 8px;
        }
        .status-paid { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
        .status-unpaid { background: #fffbeb; color: #d97706; border: 1px solid #fcd34d; }
        .status-overdue { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

        /* Box RKAS / Dokumen Pengadaan */
        .rkas-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 10px 14px;
          margin-bottom: 20px;
          position: relative;
          z-index: 10;
        }
        .rkas-title {
          font-size: 9.5px;
          font-weight: 800;
          color: #15803d;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .rkas-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 14px;
          font-size: 10.5px;
          color: #166534;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          position: relative;
          z-index: 10;
        }
        .items-table th {
          background: #f1f5f9;
          color: #475569;
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 12px;
          text-align: left;
          border-bottom: 2px solid #cbd5e1;
        }
        .items-table td {
          padding: 10px 12px;
          font-size: 11px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
        }
        .item-name {
          font-weight: 700;
          color: #0f172a;
          font-size: 12px;
          margin-bottom: 2px;
        }
        .item-desc {
          font-size: 10px;
          color: #64748b;
          line-height: 1.4;
        }

        .totals-container {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 20px;
          position: relative;
          z-index: 10;
        }
        .totals-box {
          width: 280px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          font-size: 11px;
          color: #475569;
        }
        .total-row.grand-total {
          border-top: 2px solid #0f172a;
          padding-top: 10px;
          margin-top: 4px;
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
        }
        .terbilang-box {
          background: #f8fafc;
          padding: 10px 14px;
          border-radius: 8px;
          border-left: 4px solid #0284c7;
          font-size: 10.5px;
          color: #334155;
          margin-top: 14px;
          font-style: italic;
          font-weight: 600;
        }

        .footer-section {
          margin-top: 30px;
          position: relative;
          z-index: 10;
        }

        .signatures-grid {
          display: grid;
          grid-template-columns: ${rkas ? "1fr 1fr 1fr" : "1.5fr 1fr"};
          gap: 20px;
          align-items: flex-end;
          margin-top: 20px;
        }
        .sig-col {
          text-align: center;
        }
        .sig-label {
          font-size: 9.5px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }
        .sig-role {
          font-size: 10.5px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 2px;
        }
        .sig-space {
          height: 50px;
        }
        .sig-name {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
          text-decoration: underline;
        }
        .sig-nip {
          font-size: 9.5px;
          color: #64748b;
          margin-top: 2px;
        }
        .sig-stamp {
          width: 100px;
          height: 45px;
          margin: 4px auto;
          border: 2px solid ${isPaid ? '#059669' : '#dc2626'};
          color: ${isPaid ? '#059669' : '#dc2626'};
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          font-weight: 800;
          font-size: 13px;
          letter-spacing: 1.5px;
          transform: rotate(-4deg);
          background: ${isPaid ? 'rgba(5,150,105,0.05)' : 'rgba(220,38,38,0.05)'};
        }

        .print-footer {
          margin-top: 30px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 8.5px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${isPaid ? '<div class="watermark">LUNAS</div>' : ''}

        <div class="header">
          <div class="brand-section">
            <img class="logo-box" src="https://examku.my.id/logo-default.png" alt="EXAMKU Logo" />
            <div class="company-info">
              <h1>EXAMKU CBT</h1>
              <p>Platform Ujian & Evaluasi Akademik Sekolah Mandiri Terdistribusi</p>
              <p>https://examku.my.id &bull; billing@examku.my.id &bull; 0853-5990-7696</p>
            </div>
          </div>
          <div class="invoice-title-wrapper">
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-number">#${inv.invoice_number}</div>
          </div>
        </div>

        <div class="billing-grid">
          <div class="billing-box">
            <div class="billing-label">Ditagihkan Kepada:</div>
            <div class="billing-name">${inv.school_name}</div>
            <div class="billing-detail">
              Subdomain: <strong style="color:#0f172a;">${schoolDomain}</strong><br/>
              Email: ${inv.contact_email || school?.contact_email || "-"}<br/>
              Kapasitas: ${quotaText}
            </div>
          </div>
          <div class="billing-box">
            <div class="billing-label">Detail Transaksi:</div>
            <div class="billing-detail">
              <table style="width:100%; font-size:10.5px;">
                <tr><td style="padding:1.5px 0; color:#64748b;">Tanggal Diterbitkan</td><td style="text-align:right; font-weight:600; color:#0f172a;">${createdDate}</td></tr>
                <tr><td style="padding:1.5px 0; color:#64748b;">Jatuh Tempo</td><td style="text-align:right; font-weight:600; color:#0f172a;">${dueDate}</td></tr>
                <tr><td style="padding:1.5px 0; color:#64748b;">Tanggal Lunas</td><td style="text-align:right; font-weight:600; color:#0f172a;">${isPaid ? paidDate : '-'}</td></tr>
              </table>
            </div>
            <div class="status-badge ${isPaid ? 'status-paid' : inv.status === 'overdue' ? 'status-overdue' : 'status-unpaid'}">
              ${isPaid ? '&#10003; LUNAS' : inv.status === 'overdue' ? '&#9888; OVERDUE' : '&#9202; MENUNGGU PEMBAYARAN'}
            </div>
          </div>
        </div>

        ${rkas ? `
        <div class="rkas-box">
          <div class="rkas-title">
            <span>Lampiran Dokumen Anggaran Sekolah (RKAS / ARKAS)</span>
            <span>Tahun Anggaran: ${rkas.fiscal_year || "2026"}</span>
          </div>
          <div class="rkas-grid">
            <div><strong>Kode Rekening Belanja:</strong> <span style="font-family:monospace; font-weight:700;">${rkas.budget_code || "-"}</span></div>
            <div><strong>Sumber Dana:</strong> ${rkas.funding_source || "BOS Reguler"}</div>
            <div style="grid-column: span 2;"><strong>Uraian Kegiatan:</strong> ${rkas.activity_name || "Pelaksanaan Ujian / Asesmen Sumatif Berbasis Komputer"}</div>
          </div>
        </div>
        ` : ""}

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 50%;">Deskripsi Layanan / Item</th>
              <th style="width: 15%; text-align: center;">Kuantitas</th>
              <th style="width: 15%; text-align: right;">Tarif Satuan</th>
              <th style="width: 20%; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${hasCustomItems && customData?.items ? customData.items.map(it => `
              <tr>
                <td>
                  <div class="item-name">${it.description}</div>
                </td>
                <td style="text-align: center; font-weight: 600; color:#0f172a;">${it.qty} ${it.unit || "Paket"}</td>
                <td style="text-align: right; color: #475569;">${formatRupiah(it.price)}</td>
                <td style="text-align: right; font-weight: 700; color:#0f172a;">${formatRupiah(it.total || (it.qty * it.price))}</td>
              </tr>
            `).join("") : `
              <tr>
                <td>
                  <div class="item-name">Biaya Layanan EXAMKU CBT (${planLabel})</div>
                  <div class="item-desc">
                    Mencakup Manajemen Bank Soal, Server Ujian Realtime, Aplikasi Mobile Exambro Anti-Curang, Pemantauan Proktor, dan Dukungan Penuh untuk ${quotaText}.
                  </div>
                </td>
                <td style="text-align: center; font-weight: 600; color:#0f172a;">${Number(inv.duration_months) === 0 ? "Top-up" : `${inv.duration_months} Bulan`}</td>
                <td style="text-align: right; color: #475569;">${formatRupiah(inv.amount)}</td>
                <td style="text-align: right; font-weight: 700; color:#0f172a;">${formatRupiah(inv.amount)}</td>
              </tr>
              <tr>
                <td>
                  <div class="item-name">Infrastruktur Server & Backup Tersertifikasi</div>
                  <div class="item-desc">
                    Alokasi penyimpanan media (Cloudflare R2), Database terisolasi per sekolah, dan jaminan Uptime 99.9%.
                  </div>
                </td>
                <td style="text-align: center; color: #64748b;">Termasuk</td>
                <td style="text-align: right; color: #64748b;">Rp 0</td>
                <td style="text-align: right; color: #64748b;">Rp 0</td>
              </tr>
            `}
          </tbody>
        </table>

        <div class="totals-container">
          <div class="totals-box">
            <div class="total-row">
              <span>Subtotal</span>
              <span>${formatRupiah(subtotalAmount)}</span>
            </div>
            <div class="total-row">
              <span>${tax?.enabled ? `PPN (${tax.rate_percent ?? 11}%)` : 'Pajak (0% / Non-PKP)'}</span>
              <span style="${tax?.enabled ? 'font-weight:700; color:#0f172a;' : ''}">${formatRupiah(taxAmount)}</span>
            </div>
            <div class="total-row grand-total">
              <span>Total Keseluruhan</span>
              <span style="color:#0284c7;">${formatRupiah(finalGrandTotal)}</span>
            </div>
          </div>
        </div>

        <div class="terbilang-box">
          Terbilang: ${terbilangText}
        </div>

        ${inv.notes ? `
          <div style="background:#fefce8; border:1px solid #fef08a; border-radius:8px; padding:10px 14px; font-size:10.5px; color:#854d0e; margin-top:14px; font-weight:500;">
            <strong>Catatan Khusus:</strong> ${inv.notes}
          </div>
        ` : ""}

        <div class="footer-section">
          ${rkas ? `
            <div class="signatures-grid">
              <div class="sig-col">
                <div class="sig-label">Menyetujui,</div>
                <div class="sig-role">Kepala Sekolah</div>
                <div class="sig-space"></div>
                <div class="sig-name">${rkas.headmaster_name || "Kepala Sekolah"}</div>
                <div class="sig-nip">NIP. ${rkas.headmaster_nip || "...................................."}</div>
              </div>
              <div class="sig-col">
                <div class="sig-label">Lunas Dibayar,</div>
                <div class="sig-role">Bendahara BOS / Sekolah</div>
                <div class="sig-space"></div>
                <div class="sig-name">${rkas.treasurer_name || "Bendahara BOS"}</div>
                <div class="sig-nip">NIP. ${rkas.treasurer_nip || "...................................."}</div>
              </div>
              <div class="sig-col">
                <div class="sig-label">Penerima Pembayaran,</div>
                <div class="sig-role">Tim Keuangan EXAMKU</div>
                <div class="sig-stamp">${isPaid ? 'PAID' : 'UNPAID'}</div>
                <div class="sig-name">EXAMKU Billing Dept.</div>
                <div class="sig-nip">Dokumen Divalidasi Sistem</div>
              </div>
            </div>
          ` : `
            <div class="signatures-grid">
              <div style="font-size:10px; color:#64748b; line-height:1.5;">
                <div style="font-weight:700; color:#475569; text-transform:uppercase; margin-bottom:4px;">Ketentuan & Validasi</div>
                <p>1. Invoice ini diterbitkan secara sah dan dienkripsi oleh sistem EXAMKU.</p>
                <p>2. Bukti pembayaran ini valid untuk pelaporan SPJ, Dana BOS, atau Komite Sekolah.</p>
                <p>3. Hubungi billing@examku.my.id untuk konfirmasi atau bantuan faktur pajak.</p>
              </div>
              <div class="sig-col">
                <div style="font-size:10.5px; color:#475569; margin-bottom:6px;">Banda Aceh, ${createdDate}</div>
                <div class="sig-stamp">${isPaid ? 'PAID' : 'UNPAID'}</div>
                <div class="sig-name" style="margin-top:8px;">Tim Keuangan EXAMKU</div>
                <div class="sig-nip">Dokumen Resmi Terverifikasi</div>
              </div>
            </div>
          `}
        </div>

        <div class="print-footer">
          <div>ID: ${inv.id} &bull; Generated by EXAMKU SaaS</div>
          <div>Page 1 of 1</div>
        </div>
      </div>
    </body>
    </html>
  `;
  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup browser diblokir. Izinkan popup untuk mencetak / menyimpan invoice PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

/**
 * Cetak Kuitansi Resmi SPJ Dana BOS (A4 Landscape / Portrait)
 * Format standar pengeluaran kas pelaporan SPJ sekolah negeri & madrasah.
 */
export function printOfficialReceiptSpj(inv: InvoiceData, school?: SchoolMeta | null) {
  const createdDate = formatDateIndo(inv.paid_date || inv.created || new Date().toISOString());
  const customData = parseCustomData(inv.custom_data);
  const rkas = customData?.rkas?.enabled ? customData.rkas : null;
  const tax = customData?.tax?.enabled ? customData.tax : null;
  const hasCustomItems = Boolean(customData?.items && customData.items.length > 0);

  const customItemsSum = hasCustomItems && customData?.items
    ? customData.items.reduce((acc, it) => acc + (it.total || (it.qty * it.price)), 0)
    : 0;

  let subtotalAmount = 0;
  let taxAmount = 0;
  let finalGrandTotal = 0;

  if (tax && tax.enabled) {
    const rate = tax.rate_percent ?? 11;
    subtotalAmount = hasCustomItems && customItemsSum > 0 ? customItemsSum : (tax.subtotal || inv.amount);
    taxAmount = tax.tax_amount ?? Math.round(subtotalAmount * (rate / 100));
    finalGrandTotal = subtotalAmount + taxAmount;
  } else {
    subtotalAmount = hasCustomItems && customItemsSum > 0 ? customItemsSum : inv.amount;
    taxAmount = 0;
    finalGrandTotal = subtotalAmount;
  }

  const terbilangText = terbilang(finalGrandTotal);
  const planLabel = inv.plan_label || (inv.plan ? inv.plan.toUpperCase() : "STANDARD");

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <title>Kuitansi SPJ ${inv.invoice_number}</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page {
          size: A4 portrait;
          margin: 0;
        }
        body {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #0f172a;
          background: #ffffff;
          line-height: 1.6;
          font-size: 11.5px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .container {
          max-width: 210mm;
          margin: 0 auto;
          padding: 15mm 18mm;
          border: 1px solid #cbd5e1;
        }

        .kopsurat {
          text-align: center;
          border-bottom: 3px double #0f172a;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .kopsurat h2 {
          font-size: 18px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .kopsurat p {
          font-size: 10px;
          color: #475569;
        }

        .title-box {
          text-align: center;
          margin-bottom: 24px;
        }
        .kuitansi-title {
          font-size: 20px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 2px;
          text-decoration: underline;
        }
        .kuitansi-no {
          font-size: 11px;
          color: #475569;
          margin-top: 2px;
          font-family: monospace;
        }

        .meta-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        .meta-table td {
          padding: 7px 4px;
          vertical-align: top;
        }
        .meta-table .label {
          width: 180px;
          color: #475569;
          font-weight: 600;
        }
        .meta-table .sep {
          width: 15px;
          text-align: center;
        }
        .meta-table .val {
          color: #0f172a;
          font-weight: 600;
        }

        .nominal-badge {
          display: inline-block;
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          background: #f1f5f9;
          padding: 6px 16px;
          border-radius: 8px;
          border: 1px dashed #94a3b8;
        }
        .terbilang-quote {
          font-style: italic;
          background: #f8fafc;
          padding: 8px 12px;
          border-radius: 6px;
          display: inline-block;
          color: #1e293b;
        }

        .rkas-details-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 24px;
          font-size: 11px;
        }
        .rkas-details-box table {
          width: 100%;
        }
        .rkas-details-box td {
          padding: 3px 0;
        }

        .signatures-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 15px;
          text-align: center;
          margin-top: 35px;
        }
        .sig-box {
          font-size: 10.5px;
        }
        .sig-role {
          font-weight: 700;
          color: #0f172a;
        }
        .sig-space {
          height: 60px;
        }
        .sig-name {
          font-weight: 700;
          text-decoration: underline;
        }
        .sig-nip {
          font-size: 9.5px;
          color: #64748b;
        }

        .materai-box {
          width: 85px;
          height: 45px;
          border: 1px dashed #94a3b8;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8.5px;
          margin: 6px auto;
          text-transform: uppercase;
        }

        .print-footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          color: #94a3b8;
          text-transform: uppercase;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="kopsurat">
          <h2>KUITANSI BUKTI PEMBAYARAN</h2>
          <p>Pelaporan Surat Pertanggungjawaban (SPJ) Dana BOS / BOSP Satuan Pendidikan</p>
        </div>

        <div class="title-box">
          <div class="kuitansi-no">Nomor Kuitansi: KWT/BOS/${inv.invoice_number}</div>
        </div>

        <table class="meta-table">
          <tr>
            <td class="label">Telah Diterima Dari</td>
            <td class="sep">:</td>
            <td class="val">Bendahara BOS ${inv.school_name}</td>
          </tr>
          <tr>
            <td class="label">Uang Sejumlah</td>
            <td class="sep">:</td>
            <td class="val">
              <div class="nominal-badge">${formatRupiah(finalGrandTotal)}</div>
            </td>
          </tr>
          <tr>
            <td class="label">Terbilang</td>
            <td class="sep">:</td>
            <td class="val">
              <div class="terbilang-quote">*** ${terbilangText} ***</div>
            </td>
          </tr>
          <tr>
            <td class="label">Untuk Pembayaran</td>
            <td class="sep">:</td>
            <td class="val" style="font-weight: 500;">
              <div>${rkas?.activity_name || "Pelaksanaan Evaluasi / Asesmen Pembelajaran Berbasis Komputer CBT"}</div>
              <div style="font-size: 10.5px; color: #475569; margin-top: 3px; font-weight: 400;">
                Biaya Layanan Aplikasi EXAMKU CBT (${planLabel}) &bull; ${Number(inv.duration_months) === 0 ? "Top-up Kuota" : `Durasi ${inv.duration_months} Bulan`}
              </div>
            </td>
          </tr>
          ${tax?.enabled ? `
          <tr>
            <td class="label">Keterangan Pajak</td>
            <td class="sep">:</td>
            <td class="val" style="font-weight: 600; color: #0f172a;">
              Termasuk PPN ${tax.rate_percent ?? 11}% (${formatRupiah(taxAmount)}) &bull; Subtotal Hak Layanan: ${formatRupiah(subtotalAmount)}
              <div style="font-size: 9.5px; color: #64748b; font-weight: 400; margin-top: 2px;">
                * PPN dipungut dan disetorkan ke Kas Negara oleh Bendahara BOS selaku WAPU
              </div>
            </td>
          </tr>
          ` : ""}
        </table>

        ${hasCustomItems && customData?.items && customData.items.length > 0 ? `
        <div style="margin-bottom: 20px;">
          <div style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 0.5px;">Rincian Pengeluaran Belanja (Line Items):</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; color: #334155;">
                <th style="padding: 5px 8px; text-align: left;">Uraian Pekerjaan / Belanja</th>
                <th style="padding: 5px 8px; text-align: center; width: 85px;">Volume</th>
                <th style="padding: 5px 8px; text-align: right; width: 105px;">Harga Satuan</th>
                <th style="padding: 5px 8px; text-align: right; width: 115px;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${customData.items.map(it => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 5px 8px;">${it.description}</td>
                  <td style="padding: 5px 8px; text-align: center; font-weight: 600;">${it.qty} ${it.unit || "Paket"}</td>
                  <td style="padding: 5px 8px; text-align: right;">${formatRupiah(it.price)}</td>
                  <td style="padding: 5px 8px; text-align: right; font-weight: 700;">${formatRupiah(it.total || (it.qty * it.price))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        ` : ""}

        ${rkas ? `
        <div class="rkas-details-box">
          <table>
            <tr>
              <td style="width: 25%; font-weight: 600; color: #15803d;">Kode Rekening Belanja</td>
              <td style="width: 25%; font-family: monospace; font-weight: 700;">${rkas.budget_code || "-"}</td>
              <td style="width: 25%; font-weight: 600; color: #15803d;">Tahun Anggaran / Sumber</td>
              <td style="width: 25%; font-weight: 700;">${rkas.fiscal_year || "2026"} &bull; ${rkas.funding_source || "BOS Reguler"}</td>
            </tr>
          </table>
        </div>
        ` : ""}

        <div style="text-align: right; font-size: 11px; margin-bottom: 10px; color: #475569;">
          Banda Aceh, ${createdDate}
        </div>

        <div class="signatures-grid">
          <div class="sig-box">
            <div>Setuju Dibayar,</div>
            <div class="sig-role">Kepala Sekolah (KPA)</div>
            <div class="sig-space"></div>
            <div class="sig-name">${rkas?.headmaster_name || "Kepala Sekolah"}</div>
            <div class="sig-nip">NIP. ${rkas?.headmaster_nip || "...................................."}</div>
          </div>
          <div class="sig-box">
            <div>Lunas Dibayar,</div>
            <div class="sig-role">Bendahara BOS</div>
            <div class="sig-space"></div>
            <div class="sig-name">${rkas?.treasurer_name || "Bendahara BOS"}</div>
            <div class="sig-nip">NIP. ${rkas?.treasurer_nip || "...................................."}</div>
          </div>
          <div class="sig-box">
            <div>Yang Menerima,</div>
            <div class="sig-role">Penyedia (EXAMKU CBT)</div>
            ${inv.amount >= 5000000 ? '<div class="materai-box">Materai Rp 10.000</div>' : '<div style="height:25px;"></div>'}
            <div class="sig-name">Tim Keuangan EXAMKU</div>
            <div class="sig-nip">Lunas & Divalidasi</div>
          </div>
        </div>

        <div class="print-footer">
          <div>Ref Invoice: #${inv.invoice_number} &bull; Generated by EXAMKU</div>
          <div>Sah untuk Berkas SPJ BOS</div>
        </div>
      </div>
    </body>
    </html>
  `;
  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup browser diblokir. Izinkan popup untuk mencetak kuitansi SPJ.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}
