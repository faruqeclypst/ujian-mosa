/**
 * Helper Kwitansi Resmi & Terbilang Bahasa Indonesia
 * Digunakan untuk mencetak tanda bukti pembayaran resmi / SPJ BOS sekolah.
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

export interface ReceiptInvoiceData {
  id: string;
  invoice_number: string;
  school_id?: string;
  school_name: string;
  school_slug: string;
  contact_email?: string;
  plan: string;
  plan_label?: string;
  duration_months: number;
  amount: number;
  status: string;
  paid_date?: string;
  created?: string;
  notes?: string;
}

export interface ReceiptSchoolData {
  name: string;
  slug: string;
  contact_email?: string;
  student_quota?: number;
  plan?: string;
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

export function printOfficialReceipt(inv: ReceiptInvoiceData, school?: ReceiptSchoolData | null) {
  const receiptNumber = inv.invoice_number.replace(/^INV-/, "KW-");
  const paidDateFormatted = formatDateIndo(inv.paid_date || inv.created || new Date().toISOString());
  const terbilangText = terbilang(inv.amount);
  const planName = inv.plan_label || inv.plan.toUpperCase();
  const quotaText = school?.student_quota ? `${school.student_quota} Siswa` : "Sesuai Paket";

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <title>Kwitansi Pembayaran ${receiptNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          padding: 30px;
          line-height: 1.5;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          border: 2px solid #0f172a;
          padding: 32px 36px;
          position: relative;
          background: #ffffff;
        }
        .corner-accent {
          position: absolute;
          width: 14px;
          height: 14px;
          border-color: #0f172a;
        }
        .tl { top: 4px; left: 4px; border-top: 2px solid #0f172a; border-left: 2px solid #0f172a; }
        .tr { top: 4px; right: 4px; border-top: 2px solid #0f172a; border-right: 2px solid #0f172a; }
        .bl { bottom: 4px; left: 4px; border-bottom: 2px solid #0f172a; border-left: 2px solid #0f172a; }
        .br { bottom: 4px; right: 4px; border-bottom: 2px solid #0f172a; border-right: 2px solid #0f172a; }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 18px;
          margin-bottom: 24px;
        }
        .brand-logo {
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.5px;
          color: #1e3a8a;
        }
        .brand-desc {
          font-size: 11px;
          color: #475569;
          font-weight: 500;
          margin-top: 2px;
        }
        .brand-meta {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }
        .doc-title-block {
          text-align: right;
        }
        .doc-title {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 1px;
          color: #0f172a;
          text-transform: uppercase;
        }
        .doc-num {
          font-size: 12px;
          font-family: 'Courier New', monospace;
          font-weight: 700;
          color: #2563eb;
          margin-top: 4px;
        }

        .receipt-body {
          margin-bottom: 28px;
        }
        .field-row {
          display: flex;
          align-items: flex-start;
          padding: 8px 0;
          border-bottom: 1px dotted #cbd5e1;
        }
        .field-label {
          width: 170px;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          flex-shrink: 0;
        }
        .field-colon {
          width: 16px;
          font-weight: 700;
          color: #334155;
          flex-shrink: 0;
        }
        .field-value {
          flex: 1;
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
        }

        .terbilang-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 12px;
          font-style: italic;
          font-weight: 600;
          color: #1e293b;
          font-size: 12px;
        }

        .amount-highlight {
          display: inline-block;
          background: #eff6ff;
          border: 2px solid #2563eb;
          color: #1d4ed8;
          font-size: 18px;
          font-weight: 900;
          padding: 6px 16px;
          border-radius: 6px;
          letter-spacing: 0.5px;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 32px;
          padding-top: 16px;
        }
        .footer-note {
          max-width: 400px;
          font-size: 10px;
          color: #64748b;
          line-height: 1.4;
        }
        .signature-block {
          text-align: center;
          width: 220px;
          position: relative;
        }
        .sig-date {
          font-size: 11px;
          color: #334155;
          margin-bottom: 8px;
        }
        .sig-role {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 50px;
        }
        .sig-name {
          font-size: 12px;
          font-weight: 800;
          color: #0f172a;
          border-top: 1px solid #0f172a;
          padding-top: 4px;
        }

        /* Stempel Digital Lunas */
        .digital-stamp {
          position: absolute;
          top: 30px;
          left: 10px;
          width: 110px;
          height: 110px;
          border: 3px double #15803d;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #15803d;
          transform: rotate(-12deg);
          background: rgba(220, 252, 231, 0.25);
          pointer-events: none;
          box-shadow: 0 0 0 2px rgba(21, 128, 61, 0.2);
        }
        .stamp-top {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .stamp-center {
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 2px;
          border-top: 1px solid #15803d;
          border-bottom: 1px solid #15803d;
          padding: 1px 6px;
          margin: 2px 0;
        }
        .stamp-bottom {
          font-size: 7px;
          font-weight: 700;
        }

        @media print {
          body { padding: 0; background: #fff; }
          .container { border: 2px solid #000; box-shadow: none; }
          @page { size: A4 portrait; margin: 15mm; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="corner-accent tl"></div>
        <div class="corner-accent tr"></div>
        <div class="corner-accent bl"></div>
        <div class="corner-accent br"></div>

        <div class="header">
          <div>
            <div class="brand-logo">EXAM AA</div>
            <div class="brand-desc">Platform Sistem Ujian Berbasis Komputer (CBT Online)</div>
            <div class="brand-meta">Layanan Operasional & Lisensi Institusi Pendidikan Indonesia</div>
          </div>
          <div class="doc-title-block">
            <div class="doc-title">Kwitansi Pembayaran</div>
            <div class="doc-num">NO: ${receiptNumber}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Ref. Invoice: ${inv.invoice_number}</div>
          </div>
        </div>

        <div class="receipt-body">
          <div class="field-row">
            <div class="field-label">Telah Diterima Dari</div>
            <div class="field-colon">:</div>
            <div class="field-value">
              <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${inv.school_name}</div>
              <div style="font-size: 11px; color: #475569; font-weight: normal; margin-top: 2px;">
                Kode Institusi: <span style="font-family: monospace; font-weight: bold;">${inv.school_slug}</span>
                ${inv.contact_email ? ` · Email: ${inv.contact_email}` : ""}
              </div>
            </div>
          </div>

          <div class="field-row">
            <div class="field-label">Uang Sejumlah</div>
            <div class="field-colon">:</div>
            <div class="field-value">
              <div class="terbilang-box">
                # ${terbilangText} #
              </div>
            </div>
          </div>

          <div class="field-row">
            <div class="field-label">Untuk Pembayaran</div>
            <div class="field-colon">:</div>
            <div class="field-value">
              <div>Biaya Langganan Platform CBT Ujian Online EXAM AA</div>
              <div style="font-size: 11px; color: #475569; font-weight: normal; margin-top: 3px;">
                • Paket Layanan: <strong>${planName}</strong> (Kapasitas: ${quotaText})<br/>
                • Durasi Aktif: <strong>${inv.duration_months} Bulan</strong><br/>
                • Status Transaksi: <strong style="color: #15803d;">LUNAS / VERIFIED</strong> (Dibayar pada ${paidDateFormatted})
              </div>
            </div>
          </div>

          <div class="field-row" style="border-bottom: none; margin-top: 12px; align-items: center;">
            <div class="field-label">Jumlah Pembayaran</div>
            <div class="field-colon">:</div>
            <div class="field-value">
              <span class="amount-highlight">${formatRupiah(inv.amount)}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <div class="footer-note">
            <strong>Catatan Pertanggungjawaban (SPJ):</strong><br/>
            Kwitansi ini merupakan bukti pembayaran elektronik yang sah atas pemanfaatan lisensi perangkat lunak CBT EXAM AA. Dokumen ini dapat dilampirkan sebagai tanda bukti pengeluaran dana BOS / komite yayasan sekolah.
          </div>

          <div class="signature-block">
            <div class="sig-date">Diterbitkan: ${paidDateFormatted}</div>
            <div class="sig-role">Bagian Keuangan & Administrasi</div>

            <!-- Stempel Digital -->
            <div class="digital-stamp">
              <div class="stamp-top">EXAM AA CBT</div>
              <div class="stamp-center">LUNAS</div>
              <div class="stamp-bottom">${paidDateFormatted}</div>
            </div>

            <div class="sig-name">TIM KEUANGAN EXAM AA</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Gagal membuka jendela cetak. Mohon izinkan popup di peramban Anda.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}
