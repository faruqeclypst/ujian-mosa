import os

filepath = r"d:\PROJECT\ujian\src\utils\invoicePdfHelper.ts"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

new_html = r"""  const html = `
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
          font-size: 12px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .container {
          max-width: 210mm;
          margin: 0 auto;
          padding: 14mm 16mm;
          position: relative;
        }

        /* Watermark Lunas */
        ${isPaid ? `
        .watermark {
          position: absolute;
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          font-size: 120px;
          font-weight: 800;
          color: rgba(16, 185, 129, 0.04);
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
          margin-bottom: 30px;
          position: relative;
          z-index: 10;
        }
        
        .brand-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo-box {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #0284c7 0%, #1e40af 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 800;
          font-size: 22px;
          letter-spacing: -1px;
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
          font-size: 28px;
          font-weight: 800;
          color: #0284c7;
          letter-spacing: 1px;
          line-height: 1;
          margin-bottom: 4px;
        }
        .invoice-number {
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          font-weight: 700;
          color: #475569;
          background: #f1f5f9;
          padding: 4px 10px;
          border-radius: 6px;
          display: inline-block;
        }

        .billing-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 30px;
          position: relative;
          z-index: 10;
        }
        .billing-box {
          padding: 16px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .billing-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .billing-name {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .billing-detail {
          font-size: 11px;
          color: #475569;
          line-height: 1.6;
        }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 10px;
        }
        .status-paid { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
        .status-unpaid { background: #fffbeb; color: #d97706; border: 1px solid #fcd34d; }
        .status-overdue { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
          position: relative;
          z-index: 10;
        }
        .items-table th {
          background: #f1f5f9;
          color: #475569;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 12px 14px;
          text-align: left;
          border-bottom: 2px solid #cbd5e1;
        }
        .items-table td {
          padding: 14px;
          font-size: 12px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
        }
        .item-name {
          font-weight: 700;
          color: #0f172a;
          font-size: 13px;
          margin-bottom: 4px;
        }
        .item-desc {
          font-size: 10.5px;
          color: #64748b;
          line-height: 1.4;
        }

        .totals-container {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
          position: relative;
          z-index: 10;
        }
        .totals-box {
          width: 300px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 12px;
          color: #475569;
        }
        .total-row.grand-total {
          border-top: 2px solid #0f172a;
          padding-top: 12px;
          margin-top: 4px;
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
        }
        .terbilang-box {
          background: #f8fafc;
          padding: 12px 16px;
          border-radius: 8px;
          border-left: 4px solid #0284c7;
          font-size: 11px;
          color: #334155;
          margin-top: 20px;
          font-style: italic;
          font-weight: 600;
        }

        .footer-section {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          position: relative;
          z-index: 10;
        }
        .notes-area {
          flex: 1;
          padding-right: 40px;
        }
        .notes-title {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .notes-content {
          font-size: 10px;
          color: #475569;
          line-height: 1.5;
        }
        .signature-area {
          width: 200px;
          text-align: center;
        }
        .sig-date {
          font-size: 11px;
          color: #475569;
          margin-bottom: 8px;
        }
        .sig-stamp {
          width: 120px;
          height: 60px;
          margin: 0 auto;
          border: 2px solid ${isPaid ? '#059669' : '#dc2626'};
          color: ${isPaid ? '#059669' : '#dc2626'};
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          font-weight: 800;
          font-size: 16px;
          letter-spacing: 2px;
          transform: rotate(-5deg);
          background: ${isPaid ? 'rgba(5,150,105,0.05)' : 'rgba(220,38,38,0.05)'};
        }
        .sig-name {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 12px;
        }
        .sig-role {
          font-size: 10px;
          color: #64748b;
        }

        .print-footer {
          margin-top: 40px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
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
            <div class="logo-box">EX</div>
            <div class="company-info">
              <h1>EXAMKU CBT</h1>
              <p>Platform Ujian & Evaluasi Akademik Sekolah Terdistribusi</p>
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
              <table style="width:100%; font-size:11px;">
                <tr><td style="padding:2px 0; color:#64748b;">Tanggal Diterbitkan</td><td style="text-align:right; font-weight:600; color:#0f172a;">${createdDate}</td></tr>
                <tr><td style="padding:2px 0; color:#64748b;">Jatuh Tempo</td><td style="text-align:right; font-weight:600; color:#0f172a;">${dueDate}</td></tr>
                <tr><td style="padding:2px 0; color:#64748b;">Tanggal Lunas</td><td style="text-align:right; font-weight:600; color:#0f172a;">${isPaid ? paidDate : '-'}</td></tr>
              </table>
            </div>
            <div class="status-badge ${isPaid ? 'status-paid' : inv.status === 'overdue' ? 'status-overdue' : 'status-unpaid'}">
              ${isPaid ? '&#10003; LUNAS' : inv.status === 'overdue' ? '&#9888; OVERDUE' : '&#9202; MENUNGGU PEMBAYARAN'}
            </div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 50%;">Deskripsi Layanan</th>
              <th style="width: 15%; text-align: center;">Durasi</th>
              <th style="width: 15%; text-align: right;">Tarif</th>
              <th style="width: 20%; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="item-name">Lisensi Layanan EXAMKU CBT (${planLabel})</div>
                <div class="item-desc">
                  Mencakup Manajemen Bank Soal, Server Ujian Realtime, Aplikasi Mobile Exambro Anti-Curang, Pemantauan Proktor, dan Dukungan Penuh untuk ${quotaText}.
                </div>
              </td>
              <td style="text-align: center; font-weight: 600; color:#0f172a;">${inv.duration_months} Bulan</td>
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
          </tbody>
        </table>

        <div class="totals-container">
          <div class="totals-box">
            <div class="total-row">
              <span>Subtotal</span>
              <span>${formatRupiah(inv.amount)}</span>
            </div>
            <div class="total-row">
              <span>Pajak (0%)</span>
              <span>Rp 0</span>
            </div>
            <div class="total-row grand-total">
              <span>Total Keseluruhan</span>
              <span style="color:#0284c7;">${formatRupiah(inv.amount)}</span>
            </div>
          </div>
        </div>

        <div class="terbilang-box">
          Terbilang: ${terbilangText} Rupiah
        </div>

        ${inv.notes ? `
          <div style="background:#fefce8; border:1px solid #fef08a; border-radius:8px; padding:12px 16px; font-size:11px; color:#854d0e; margin-top:20px; font-weight:500;">
            <strong>Catatan Khusus:</strong> ${inv.notes}
          </div>
        ` : ""}

        <div class="footer-section">
          <div class="notes-area">
            <div class="notes-title">Ketentuan & Pembayaran</div>
            <div class="notes-content">
              <p>1. Invoice ini diterbitkan secara sah dan dienkripsi oleh sistem EXAMKU.</p>
              <p>2. Bukti pembayaran ini valid untuk pelaporan SPJ, Dana BOS, atau Komite Sekolah.</p>
              <p>3. Jika menggunakan QRIS / Virtual Account, aktivasi layanan akan otomatis diproses dalam 1-5 menit tanpa perlu konfirmasi manual.</p>
            </div>
          </div>
          <div class="signature-area">
            <div class="sig-date">Banda Aceh, ${createdDate}</div>
            <div class="sig-stamp">${isPaid ? 'PAID' : 'UNPAID'}</div>
            <div class="sig-name">Tim Keuangan EXAMKU</div>
            <div class="sig-role">Dokumen Divalidasi Sistem</div>
          </div>
        </div>

        <div class="print-footer">
          <div>ID: ${inv.id} &bull; Generated by EXAMKU</div>
          <div>Page 1 of 1</div>
        </div>
      </div>
    </body>
    </html>
  `;"""

idx_start = content.find("const html = `")
idx_end = content.find("const win = window.open", idx_start)

if idx_start != -1 and idx_end != -1:
    content = content[:idx_start] + new_html + "\n  " + content[idx_end:]
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated invoicePdfHelper.ts")
else:
    print("Could not find replacement boundaries")
