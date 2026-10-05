import sys

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_ui = """          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama institusi atau nomor invoice..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
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
              onClick={() => { loadSchools(); loadInvoices(); }}
              className="p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-500 transition"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>"""

new_ui = """          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama institusi atau nomor invoice..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition shadow-sm"
                />
              </div>
              <button
                onClick={() => { loadSchools(); loadInvoices(); }}
                className="p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-500 transition shadow-sm shrink-0"
                title="Refresh"
              >
                <RefreshCw size={18} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as PaymentStatus | "all")}
                  className="w-full pl-10 pr-10 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition appearance-none cursor-pointer shadow-sm text-slate-700"
                >
                  <option value="all">Semua Status</option>
                  <option value="unpaid">Belum Bayar</option>
                  <option value="paid">Lunas</option>
                  <option value="overdue">Terlambat</option>
                  <option value="cancelled">Dibatalkan</option>
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={filterTime}
                  onChange={e => setFilterTime(e.target.value as any)}
                  className="w-full pl-4 pr-10 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition appearance-none cursor-pointer shadow-sm text-slate-700"
                >
                  <option value="all">Semua Waktu</option>
                  <option value="today">Hari Ini</option>
                  <option value="week">7 Hari Terakhir</option>
                  <option value="month">Bulan Ini</option>
                  <option value="year">Tahun Ini</option>
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={filterPackage}
                  onChange={e => setFilterPackage(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition appearance-none cursor-pointer shadow-sm text-slate-700"
                >
                  <option value="all">Semua Paket</option>
                  <option value="free">Paket Free / Trial</option>
                  <option value="berkembang">Paket Berkembang</option>
                  <option value="maju">Paket Maju</option>
                  <option value="unggul">Paket Unggul</option>
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>"""

code = code.replace(old_ui, new_ui)

with open('src/pages/superadmin/SuperAdminInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
