import sys

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Add states
states_old = """  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "all">("all");
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);"""

states_new = """  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "all">("all");
  const [filterTime, setFilterTime] = useState<"all" | "today" | "week" | "month" | "year">("all");
  const [filterPackage, setFilterPackage] = useState<string>("all");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);"""

code = code.replace(states_old, states_new)

# Update filtered logic
filtered_old = """  const filtered = invoices.filter(inv => {
    const effectiveStatus = getInvoiceStatus(inv);
    if (filterStatus !== "all" && effectiveStatus !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const schoolName = inv.expand?.school_id?.name?.toLowerCase() || "";
      if (!inv.invoice_number.toLowerCase().includes(q) && !schoolName.includes(q)) return false;
    }
    return true;
  });"""

filtered_new = """  const filtered = invoices.filter(inv => {
    const effectiveStatus = getInvoiceStatus(inv);
    if (filterStatus !== "all" && effectiveStatus !== filterStatus) return false;
    
    if (filterPackage !== "all") {
      const pkg = inv.package_name.toLowerCase();
      if (!pkg.includes(filterPackage.toLowerCase())) return false;
    }

    if (filterTime !== "all") {
      const date = new Date(inv.created);
      const now = new Date();
      if (filterTime === "today") {
        if (date.toDateString() !== now.toDateString()) return false;
      } else if (filterTime === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (date < weekAgo) return false;
      } else if (filterTime === "month") {
        if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return false;
      } else if (filterTime === "year") {
        if (date.getFullYear() !== now.getFullYear()) return false;
      }
    }

    if (search) {
      const q = search.toLowerCase();
      const schoolName = inv.expand?.school_id?.name?.toLowerCase() || "";
      if (!inv.invoice_number.toLowerCase().includes(q) && !schoolName.includes(q)) return false;
    }
    return true;
  });"""

code = code.replace(filtered_old, filtered_new)

# Update UI for filters
ui_old = """          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nomor invoice atau institusi..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition shadow-sm"
              />
            </div>
            <div className="relative">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as PaymentStatus | "all")}
                className="pl-8 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition appearance-none cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="unpaid">Belum Bayar</option>
                <option value="paid">Lunas</option>
                <option value="overdue">Terlambat</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          
            <button
            onClick={() => { loadSchools(); loadInvoices(); }}"""

ui_new = """          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nomor invoice atau institusi..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition shadow-sm"
                />
              </div>
              <button
                onClick={() => { loadSchools(); loadInvoices(); }}
                className="p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-500 transition shrink-0"
                title="Refresh"
              >
                <RefreshCw size={15} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as PaymentStatus | "all")}
                  className="w-full pl-8 pr-8 py-2 text-xs font-medium border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition appearance-none cursor-pointer"
                >
                  <option value="all">Semua Status</option>
                  <option value="unpaid">Belum Bayar</option>
                  <option value="paid">Lunas</option>
                  <option value="overdue">Terlambat</option>
                  <option value="cancelled">Dibatalkan</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={filterTime}
                  onChange={e => setFilterTime(e.target.value as any)}
                  className="w-full pl-3 pr-8 py-2 text-xs font-medium border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition appearance-none cursor-pointer"
                >
                  <option value="all">Semua Waktu</option>
                  <option value="today">Hari Ini</option>
                  <option value="week">7 Hari Terakhir</option>
                  <option value="month">Bulan Ini</option>
                  <option value="year">Tahun Ini</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={filterPackage}
                  onChange={e => setFilterPackage(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 text-xs font-medium border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition appearance-none cursor-pointer"
                >
                  <option value="all">Semua Paket</option>
                  <option value="free">Paket Free / Trial</option>
                  <option value="berkembang">Paket Berkembang</option>
                  <option value="maju">Paket Maju / Pro</option>
                  <option value="unggul">Paket Unggul</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>"""

code = code.replace(ui_old, ui_new)

# Update import of Calendar? not needed, using standard select

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
