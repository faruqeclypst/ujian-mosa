import sys
import re

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_block = """            <button
              onClick={() => { loadSchools(); loadInvoices(); }}
              className="p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-500 transition"
              title="Refresh"
            >"""

new_block = """            <button
              onClick={() => setShowBankModal(true)}
              className="px-3.5 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition shadow-sm flex items-center gap-1.5"
            >
              <CreditCard size={14} />
              Rekening Bank
            </button>
            <button
              onClick={() => { loadSchools(); loadInvoices(); }}
              className="p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-500 transition"
              title="Refresh"
            >"""

code = code.replace(old_block, new_block)

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
