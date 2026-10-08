import sys
import re

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove import
code = code.replace('import { SuperAdminBankAccountsModal } from "../../components/admin/SuperAdminBankAccountsModal";\n', '')

# Remove state
code = code.replace('const [showBankModal, setShowBankModal] = useState(false);\n', '')

# Remove modal render
code = code.replace('{showBankModal && <SuperAdminBankAccountsModal onClose={() => setShowBankModal(false)} />}\n\n', '')

# Remove button
button_regex = r'<button\s*onClick=\{\(\) => setShowBankModal\(true\)\}\s*className="[^"]*"\s*>\s*<CreditCard size=\{14\} \/>\s*Rekening Bank\s*<\/button>'
code = re.sub(button_regex, '', code)

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
