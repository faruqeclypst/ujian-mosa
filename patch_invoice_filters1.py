import sys
import re

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

states_old = r'const \[filterStatus, setFilterStatus\] = useState<PaymentStatus \| "all">\("all"\);\s*const \[editingInvoice, setEditingInvoice\] = useState<Invoice \| null>\(null\);'
states_new = """const [filterStatus, setFilterStatus] = useState<PaymentStatus | "all">("all");
  const [filterTime, setFilterTime] = useState<"all" | "today" | "week" | "month" | "year">("all");
  const [filterPackage, setFilterPackage] = useState<string>("all");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);"""
code = re.sub(states_old, states_new, code)

filtered_old = r'const filtered = invoices.filter\(inv => \{\s*const effectiveStatus = getInvoiceStatus\(inv\);\s*const matchSearch = inv.school_name.toLowerCase\(\)\.includes\(search\.toLowerCase\(\)\) \|\|\s*inv.invoice_number.toLowerCase\(\)\.includes\(search\.toLowerCase\(\)\);\s*const matchStatus = filterStatus === "all" \|\| effectiveStatus === filterStatus;\s*return matchSearch && matchStatus;\s*\}\);'
filtered_new = """const filtered = invoices.filter(inv => {
    const effectiveStatus = getInvoiceStatus(inv);
    
    const matchSearch = inv.school_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase());
    
    const matchStatus = filterStatus === "all" || effectiveStatus === filterStatus;
    
    let matchPackage = true;
    if (filterPackage !== "all") {
      matchPackage = (inv.package_name || "").toLowerCase().includes(filterPackage.toLowerCase());
    }

    let matchTime = true;
    if (filterTime !== "all") {
      const date = new Date(inv.created);
      const now = new Date();
      if (filterTime === "today") {
        matchTime = date.toDateString() === now.toDateString();
      } else if (filterTime === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchTime = date >= weekAgo;
      } else if (filterTime === "month") {
        matchTime = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      } else if (filterTime === "year") {
        matchTime = date.getFullYear() === now.getFullYear();
      }
    }

    return matchSearch && matchStatus && matchPackage && matchTime;
  });"""
code = re.sub(filtered_old, filtered_new, code)

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
