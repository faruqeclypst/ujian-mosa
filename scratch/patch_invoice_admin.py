import sys
import re

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

import_str = 'import { SuperAdminBankAccountsModal } from "../../components/admin/SuperAdminBankAccountsModal";'
if import_str not in code:
    code = code.replace('import { printDigitalInvoice } from "../../utils/invoicePdfHelper";', 'import { printDigitalInvoice } from "../../utils/invoicePdfHelper";\n' + import_str)

state_str = 'const [showBankModal, setShowBankModal] = useState(false);'
if state_str not in code:
    code = code.replace('const [showModal, setShowModal] = useState(false);', 'const [showModal, setShowModal] = useState(false);\n  ' + state_str)

button_str = """            <button
              onClick={() => { loadSchools(); loadInvoices(); }}"""
new_button_str = """            <button
              onClick={() => setShowBankModal(true)}
              className="px-3.5 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition shadow-sm flex items-center gap-1.5"
            >
              <CreditCard size={14} />
              Rekening Bank
            </button>
            <button
              onClick={() => { loadSchools(); loadInvoices(); }}"""
code = code.replace(button_str, new_button_str)

modal_str = "{showModal && ("
new_modal_str = "{showBankModal && <SuperAdminBankAccountsModal onClose={() => setShowBankModal(false)} />}\n\n      {showModal && ("
if "showBankModal &&" not in code:
    code = code.replace(modal_str, new_modal_str)

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
