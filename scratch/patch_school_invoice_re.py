import sys
import re

with open('src/pages/admin/SchoolInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace getList<Invoice>
pattern_list = r'(try\s*\{\s*)(const result = await masterPb\.collection\("invoices"\)\.getList<Invoice>\(1, \d+\);)'
def replacer_list(m):
    return f"""try {{
      try {{
        const banksRes = await masterPb.collection("bank_accounts").getFullList({{ filter: 'is_active = true' }});
        setBanks(banksRes as any);
      }} catch(e) {{}}
      {m.group(2)}"""

code = re.sub(pattern_list, replacer_list, code, count=1)

# Replace banner
pattern_banner = r'(<strong>\{formatRupiah\(activeUnpaidInvoice\.amount\)\}<\/strong>\.\s*Silakan bayar via QRIS untuk mengaktifkan masa berlaku baru\.\s*<\/p>)'
def replacer_banner(m):
    return """<strong>{formatRupiah(activeUnpaidInvoice.amount)}</strong>. Silakan bayar via QRIS atau transfer manual untuk mengaktifkan masa berlaku baru.
              </p>
              {banks.length > 0 && (
                <div className="mt-3 p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl border border-blue-100 dark:border-blue-900/30 text-xs">
                  <p className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5"><Banknote size={14}/> Opsi Transfer Manual:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {banks.map((b, i) => (
                      <div key={i} className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{b.bank_name} - <span className="font-mono text-blue-700 dark:text-blue-400">{b.account_number}</span></span>
                        <span className="text-[10px] text-slate-500">a.n. {b.account_name}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500 italic">* Setelah transfer, silakan klik tombol ?? Upload di tabel Riwayat Transaksi di bawah.</p>
                </div>
              )}"""

code = re.sub(pattern_banner, replacer_banner, code, count=1)

with open('src/pages/admin/SchoolInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
