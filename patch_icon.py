with open('src/components/admin/SuperAdminBankAccountsModal.tsx', 'r', encoding='utf-8') as f:
    code = f.read()
code = code.replace("Banknote", "Landmark")
with open('src/components/admin/SuperAdminBankAccountsModal.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

with open('src/pages/admin/SchoolInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()
code = code.replace("Banknote", "Landmark")
with open('src/pages/admin/SchoolInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
