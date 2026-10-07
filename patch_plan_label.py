import sys

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace('inv.package_name', '(inv.plan_label || inv.plan)')

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
