import sys

# 1. Update POPULAR_BANKS in SchoolInvoicePage.tsx and SuperAdminBankAccountsModal.tsx
with open('src/pages/admin/SchoolInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code_school = f.read()

with open('src/components/admin/SuperAdminBankAccountsModal.tsx', 'r', encoding='utf-8') as f:
    code_admin = f.read()

old_banks = """  { code: "JAGO", name: "Bank Jago", logo: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Logo_Bank_Jago.png" },
  { code: "SEABANK", name: "SeaBank", logo: "https://upload.wikimedia.org/wikipedia/commons/f/f1/SeaBank_logo.png" },
];"""

new_banks = """  { code: "JAGO", name: "Bank Jago", logo: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Logo_Bank_Jago.png" },
  { code: "SEABANK", name: "SeaBank", logo: "https://upload.wikimedia.org/wikipedia/commons/f/f1/SeaBank_logo.png" },
  { code: "BPD_ACEH", name: "Bank Aceh", logo: "https://upload.wikimedia.org/wikipedia/id/3/3f/Logo_Bank_Aceh_Syariah.png" },
  { code: "BJB", name: "Bank BJB", logo: "https://upload.wikimedia.org/wikipedia/commons/7/77/Logo_Bank_BJB.svg" },
  { code: "DKI", name: "Bank DKI", logo: "https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_Bank_DKI.svg" },
  { code: "JATIM", name: "Bank Jatim", logo: "https://upload.wikimedia.org/wikipedia/commons/4/41/Logo_Bank_Jatim.svg" },
  { code: "SUMUT", name: "Bank Sumut", logo: "https://upload.wikimedia.org/wikipedia/commons/8/87/Logo_Bank_Sumut.svg" },
  { code: "NAGARI", name: "Bank Nagari", logo: "https://upload.wikimedia.org/wikipedia/commons/7/74/Logo_Bank_Nagari.svg" },
];"""

code_school = code_school.replace(old_banks, new_banks)
code_admin = code_admin.replace(old_banks, new_banks)

# 2. Add text input to SuperAdminBankAccountsModal.tsx
old_admin_grid = """                      </div>
                    </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Atas Nama</label>"""

new_admin_grid = """                      </div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1 mt-3">Atau Ketik Manual Nama Bank (Jika tidak ada di atas)</label>
                      <input type="text" className="w-full text-xs p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.bank_name || ""} onChange={e => setForm({...form, bank_code: "OTHER", bank_name: e.target.value})} placeholder="Contoh: Bank BPD Aceh" />
                    </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Atas Nama</label>"""

code_admin = code_admin.replace(old_admin_grid, new_admin_grid)

# Fallback text rendering if logo fails or is OTHER
old_render_admin = """                    <div className="w-12 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 p-1">
                      {POPULAR_BANKS.find(b => b.code === bank.bank_code) ? (
                         <img src={POPULAR_BANKS.find(b => b.code === bank.bank_code)?.logo} alt={bank.bank_name} className="max-h-full max-w-full object-contain" />
                      ) : (
                         <span className="text-xs font-black text-slate-400">{bank.bank_name.substring(0,3).toUpperCase()}</span>
                      )}
                    </div>"""

new_render_admin = """                    <div className="w-12 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 p-1 overflow-hidden text-center">
                      {POPULAR_BANKS.find(b => b.code === bank.bank_code) && bank.bank_code !== "OTHER" ? (
                         <img src={POPULAR_BANKS.find(b => b.code === bank.bank_code)?.logo} alt={bank.bank_name} className="max-h-full max-w-full object-contain" onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = `<span class="text-[9px] font-black text-slate-400 uppercase leading-none">${bank.bank_name.substring(0,3)}</span>` }} />
                      ) : (
                         <span className="text-[10px] font-black text-slate-400 uppercase leading-none">{bank.bank_name.substring(0,4)}</span>
                      )}
                    </div>"""

code_admin = code_admin.replace(old_render_admin, new_render_admin)

with open('src/pages/admin/SchoolInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code_school)

with open('src/components/admin/SuperAdminBankAccountsModal.tsx', 'w', encoding='utf-8') as f:
    f.write(code_admin)
