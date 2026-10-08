import sys

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_states = """  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "all">("all");
  const [showModal, setShowModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);"""

new_states = """  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "all">("all");
  const [filterTime, setFilterTime] = useState<"all" | "today" | "week" | "month" | "year">("all");
  const [filterPackage, setFilterPackage] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);"""

code = code.replace(old_states, new_states)

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
