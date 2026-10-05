import sys
import re

with open('src/pages/admin/SchoolInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

import_str = 'import { Banknote } from "lucide-react";'
if "Banknote" not in code:
    code = code.replace('import { useTenant } from "../../context/TenantContext";', import_str + '\nimport { useTenant } from "../../context/TenantContext";')

state_str = 'const [banks, setBanks] = useState<{bank_name: string, account_number: string, account_name: string}[]>([]);'
if state_str not in code:
    code = code.replace('const [invoices, setInvoices] = useState<Invoice[]>([]);', state_str + '\n  const [invoices, setInvoices] = useState<Invoice[]>([]);')

load_banks_str = """      try {
        const result = await masterPb.collection("invoices").getList<Invoice>(1, 50, {
"""
new_load_banks_str = """      try {
        try {
          const banksRes = await masterPb.collection("bank_accounts").getFullList({ filter: 'is_active = true' });
          setBanks(banksRes as any);
        } catch(e) {}
        const result = await masterPb.collection("invoices").getList<Invoice>(1, 50, {"""
if "setBanks(banksRes" not in code:
    code = code.replace(load_banks_str, new_load_banks_str)

banner_text_str = """<strong>{formatRupiah(activeUnpaidInvoice.amount)}</strong>. Silakan bayar via QRIS untuk mengaktifkan masa berlaku baru.
              </p>"""
new_banner_text_str = """<strong>{formatRupiah(activeUnpaidInvoice.amount)}</strong>. Silakan bayar via QRIS atau transfer manual untuk mengaktifkan masa berlaku baru.
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
                  <p className="mt-2 text-[10px] text-slate-500 italic">* Setelah transfer, silakan klik tombol Upload ?? di tabel Riwayat Transaksi di bawah.</p>
                </div>
              )}"""
code = code.replace(banner_text_str, new_banner_text_str)

with open('src/pages/admin/SchoolInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
