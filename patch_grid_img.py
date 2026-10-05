import sys

with open('src/components/admin/SuperAdminBankAccountsModal.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_grid_img = """                            <div className="h-6 flex items-center justify-center">
                               <img src={b.logo} alt={b.name} className="max-h-full max-w-[50px] object-contain" onError={e => e.currentTarget.style.display = 'none'} />
                            </div>"""

new_grid_img = """                            <div className="h-6 flex items-center justify-center w-full">
                               <img src={b.logo} alt={b.name} className="max-h-full max-w-[50px] object-contain" onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = `<span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">${b.code.replace('_', ' ')}</span>`; }} />
                            </div>"""

code = code.replace(old_grid_img, new_grid_img)

with open('src/components/admin/SuperAdminBankAccountsModal.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
