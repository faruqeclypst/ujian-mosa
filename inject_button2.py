import sys
import re

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

pattern = r'(<button\s*onClick=\{\(\) => \{ loadSchools\(\); loadInvoices\(\); \}\}\s*className="p-2\.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-500 transition"\s*title="Refresh"\s*>\s*<RefreshCw size=\{15\} \/>\s*<\/button>)'

replacement = r'''<button
              onClick={() => setShowBankModal(true)}
              className="px-3.5 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition shadow-sm flex items-center gap-1.5"
            >
              <CreditCard size={14} />
              Rekening Bank
            </button>
            \1'''

code = re.sub(pattern, replacement, code)

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
