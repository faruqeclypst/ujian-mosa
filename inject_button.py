import sys
import re

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

pattern = r'<ChevronDown size=\{13\} className="absolute right-3 top-1/2 -translate-y-1/2 \ntext-slate-400 pointer-events-none" />\n            </div>'
# actually it's easier to replace `<RefreshCw size={15} />\n            </button>\n          </div>`
old = """            <button
              onClick={() => { loadSchools(); loadInvoices(); }}
              className="p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-500 transition"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>"""

new = """            <button
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
            >
              <RefreshCw size={15} />
            </button>
          </div>"""

code = code.replace(old, new)

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
