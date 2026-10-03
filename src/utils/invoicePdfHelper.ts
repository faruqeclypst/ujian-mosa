/**
 * invoicePdfHelper.ts
 * Generator Invoice Digital Resmi EXAM AA (Format Cetak / Simpan PDF)
 * Didesain khusus untuk keperluan akuntansi sekolah, pelaporan SPJ, dan dana BOS.
 */

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

const formatRupiah = (n: number): string =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const formatDateIndo = (iso?: string): string => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export function printDigitalInvoice(inv: InvoiceData, school?: SchoolMeta | null) {
  const isPaid = inv.status === "paid";
  const createdDate = formatDateIndo(inv.created || new Date().toISOString());
  const dueDate = formatDateIndo(inv.due_date);
  const paidDate = inv.paid_date ? formatDateIndo(inv.paid_date) : "-";
  const terbilangText = terbilang(inv.amount);
  const quotaText = school?.student_quota ? `${school.student_quota} Siswa` : "Kuota Terdaftar";
  const planLabel = inv.plan_label || (inv.plan ? inv.plan.toUpperCase() : "STANDARD");
  const schoolDomain = school?.custom_domain || `${inv.school_slug}.examku.my.id`;

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <title>Invoice Resmi ${inv.invoice_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page {
          size: A4 portrait;
          margin: 14mm 16mm;
        }
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          padding: 30px;
          line-height: 1.5;
          font-size: 13px;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
        }

        /* ── Header ── */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 24px;
          border-bottom: 2px solid #0284c7;
        }
        .brand-box {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .brand-logo {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #0284c7 0%, #1e40af 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 900;
          font-size: 20px;
          box-shadow: 0 4px 10px rgba(2, 132, 199, 0.25);
        }
        .brand-text h1 {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
        }
        .brand-text p {
          font-size: 11px;
          color: #64748b;
          margin-top: 1px;
        }
        .doc-meta {
          text-align: right;
        }
        .doc-type {
          font-size: 22px;
          font-weight: 900;
          color: #0369a1;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .inv-number {
          font-family: monospace;
          font-size: 14px;
          font-weight: 700;
          color: #334155;
          margin-top: 3px;
        }

        /* ── Status Banner ── */
        .status-strip {
          margin: 20px 0;
          padding: 10px 16px;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }
        .status-paid {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
        }
        .status-unpaid {
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
        }
        .status-overdue {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }
        .status-cancelled {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #475569;
        }
        .badge-pill {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 9999px;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .badge-paid-pill { background: #059669; color: #ffffff; }
        .badge-unpaid-pill { background: #d97706; color: #ffffff; }
        .badge-overdue-pill { background: #dc2626; color: #ffffff; }

        /* ── Grid 2 Kolom ── */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 18px 20px;
        }
        .info-col h3 {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #64748b;
          margin-bottom: 8px;
        }
        .info-col .primary-name {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
        }
        .info-col .meta-line {
          font-size: 12px;
          color: #475569;
          margin-top: 3px;
        }

        /* ── Table ── */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background: #f1f5f9;
          font-size: 11px;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 14px;
          text-align: left;
          border-top: 1px solid #cbd5e1;
          border-bottom: 2px solid #cbd5e1;
        }
        td {
          padding: 12px 14px;
          font-size: 12px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
        }
        .item-title {
          font-weight: 700;
          color: #0f172a;
          font-size: 13px;
        }
        .item-desc {
          font-size: 11px;
          color: #64748b;
          margin-top: 3px;
          line-height: 1.4;
        }
        .table-total {
          border-top: 2px solid #0284c7;
        }
        .table-total td {
          font-weight: 800;
          font-size: 15px;
          color: #0f172a;
          padding-top: 14px;
          border-bottom: none;
        }

        /* ── Terbilang Box ── */
        .terbilang-box {
          background: #eff6ff;
          border-left: 4px solid #0284c7;
          padding: 12px 16px;
          border-radius: 0 8px 8px 0;
          margin-bottom: 24px;
        }
        .terbilang-lbl {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #0284c7;
        }
        .terbilang-val {
          font-size: 13px;
          font-weight: 700;
          color: #1e3a8a;
          font-style: italic;
          margin-top: 2px;
        }

        /* ── Signatures & Stamp ── */
        .bottom-section {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 24px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px dashed #cbd5e1;
        }
        .terms-box {
          font-size: 11px;
          color: #64748b;
          line-height: 1.6;
        }
        .terms-box strong {
          color: #334155;
        }
        .signature-box {
          text-align: center;
          position: relative;
        }
        .signature-title {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 48px;
        }
        .stamp-mark {
          position: absolute;
          top: 22px;
          left: 50%;
          transform: translateX(-50%) rotate(-8deg);
          border: 2px solid ${isPaid ? "#059669" : "#d97706"};
          color: ${isPaid ? "#059669" : "#d97706"};
          font-weight: 800;
          font-size: 13px;
          padding: 4px 14px;
          border-radius: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
          opacity: 0.85;
          pointer-events: none;
        }
        .signature-name {
          font-weight: 700;
          color: #0f172a;
          font-size: 12px;
          border-bottom: 1px solid #334155;
          display: inline-block;
          padding-bottom: 2px;
        }
        .signature-role {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }

        /* ── Footer ── */
        .doc-footer {
          margin-top: 30px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #94a3b8;
        }

        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- ── Header ── -->
        <div class="header">
          <div class="brand-box">
            <div class="brand-logo">AA</div>
            <div class="brand-text">
              <h1>EXAM AA</h1>
              <p>Platform CBT & Evaluasi Akademik Sekolah Terdistribusi</p>
              <p style="font-size:10px; color:#94a3b8; margin-top:2px;">https://examku.my.id · billing@examku.my.id · WA: 0853-5990-7696</p>
            </div>
          </div>
          <div class="doc-meta">
            <div class="doc-type">INVOICE DIGITAL</div>
            <div class="inv-number">${inv.invoice_number}</div>
            <div style="font-size:11px; color:#64748b; margin-top:4px;">Tanggal: ${createdDate}</div>
          </div>
        </div>

        <!-- ── Status Strip ── -->
        <div class="status-strip ${isPaid ? "status-paid" : inv.status === "overdue" ? "status-overdue" : "status-unpaid"}">
          <div>
            <strong>Status Pembayaran:</strong> ${isPaid ? "LUNAS (Terverifikasi Otomatis)" : inv.status === "overdue" ? "TERLAMBAT (Jatuh Tempo Telah Lewat)" : "MENUNGGU PEMBAYARAN"}
            ${isPaid ? `<span style="margin-left:8px; font-size:11px; opacity:0.9;">· Dibayar pada: ${paidDate}</span>` : `<span style="margin-left:8px; font-size:11px; opacity:0.9;">· Jatuh tempo: ${dueDate}</span>`}
          </div>
          <div class="badge-pill ${isPaid ? "badge-paid-pill" : inv.status === "overdue" ? "badge-overdue-pill" : "badge-unpaid-pill"}">
            ${isPaid ? "LUNAS / PAID" : inv.status === "overdue" ? "OVERDUE" : "UNPAID"}
          </div>
        </div>

        <!-- ── Grid 2 Kolom ── -->
        <div class="info-grid">
          <div class="info-col">
            <h3>Ditagihkan Kepada (Bill To)</h3>
            <div class="primary-name">${inv.school_name}</div>
            <div class="meta-line">Portal CBT: <strong>https://${schoolDomain}</strong></div>
            <div class="meta-line">Email Kontak: ${inv.contact_email || school?.contact_email || "-"}</div>
            <div class="meta-line">Kapasitas Ujian: <strong>${quotaText}</strong></div>
          </div>
          <div class="info-col">
            <h3>Rincian Paket & Periode</h3>
            <div class="primary-name">Paket ${planLabel}</div>
            <div class="meta-line">Durasi Layanan: <strong>${inv.duration_months} Bulan (${Math.round(inv.duration_months / 12 * 10) / 10} Tahun)</strong></div>
            <div class="meta-line">Metode: <strong>QRIS Instan / Virtual Account / Transfer Bank</strong></div>
            <div class="meta-line">Tujuan Tagihan: <strong>Perpanjangan Lisensi Layanan CBT</strong></div>
          </div>
        </div>

        <!-- ── Tabel Item ── -->
        <table>
          <thead>
            <tr>
              <th style="width: 5%;">No</th>
              <th style="width: 50%;">Deskripsi Layanan CBT</th>
              <th style="width: 15%; text-align: center;">Durasi</th>
              <th style="width: 15%; text-align: right;">Tarif</th>
              <th style="width: 15%; text-align: right;">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>
                <div class="item-title">Lisensi Langganan Platform CBT EXAM AA (${planLabel})</div>
                <div class="item-desc">
                  Mencakup modul Bank Soal, Dukungan Rumus KaTeX, Jadwal Ruang Ujian, Sesi Token Dinamis, Aplikasi Android Exambro Anti-Curang, Pemantauan Proktor Realtime, dan Analisis Butir Soal untuk ${quotaText}.
                </div>
              </td>
              <td style="text-align: center; font-weight: 600;">${inv.duration_months} Bulan</td>
              <td style="text-align: right; color: #475569;">${formatRupiah(inv.amount)}</td>
              <td style="text-align: right; font-weight: 700;">${formatRupiah(inv.amount)}</td>
            </tr>
            <tr>
              <td>2</td>
              <td>
                <div class="item-title">Alokasi Resource Cloud & Backup Database SQLite Terisolasi</div>
                <div class="item-desc">
                  Isolasi komputasi RAM & CPU, penyimpanan media Cloudflare R2, dan garansi uptime selama masa aktif layanan.
                </div>
              </td>
              <td style="text-align: center; color: #64748b;">Termasuk</td>
              <td style="text-align: right; color: #64748b;">Rp 0</td>
              <td style="text-align: right; color: #64748b;">Rp 0</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="table-total">
              <td colspan="4" style="text-align: right;">TOTAL PEMBAYARAN:</td>
              <td style="text-align: right; color: #0284c7;">${formatRupiah(inv.amount)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- ── Terbilang ── -->
        <div class="terbilang-box">
          <div class="terbilang-lbl">Terbilang:</div>
          <div class="terbilang-val"># ${terbilangText} #</div>
        </div>

        ${inv.notes ? `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; font-size:11px; color:#475569; margin-bottom:20px;">
            <strong>Catatan Khusus:</strong> ${inv.notes}
          </div>
        ` : ""}

        <!-- ── Bottom Info & Stamp ── -->
        <div class="bottom-section">
          <div class="terms-box">
            <p><strong>Ketentuan & Keterangan Resmi:</strong></p>
            <p>1. Dokumen invoice digital ini sah dan diterbitkan secara elektronik oleh sistem EXAM AA.</p>
            <p>2. Invoice ini dapat dilampirkan sebagai dokumen tanda bukti tagihan dan pengeluaran keuangan sekolah (SPJ / Dana BOS / Komite Yayasan).</p>
            <p>3. Konfirmasi pelunasan tagihan diproses secara instan oleh sistem pembayaran QRIS & Virtual Account.</p>
          </div>
          <div class="signature-box">
            <div class="signature-title">Banda Aceh, ${createdDate}</div>
            ${isPaid ? `<div class="stamp-mark">✓ LUNAS VERIFIED</div>` : `<div class="stamp-mark">UNPAID TAGIHAN</div>`}
            <div style="height: 38px;"></div>
            <div class="signature-name">Tim Billing & Keuangan EXAM AA</div>
            <div class="signature-role">Tervalidasi Sistem Digital Resmi</div>
          </div>
        </div>

        <!-- ── Footer ── -->
        <div class="doc-footer">
          <div>ID Transaksi: ${inv.id} · Cetak Otomatis Sistem EXAM AA</div>
          <div>Halaman 1 dari 1 (Dokumen Sah Tanpa Tanda Tangan Basah)</div>
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
