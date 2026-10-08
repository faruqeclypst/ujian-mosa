import sys

with open('src/pages/admin/SchoolInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_render_school = """                          <div className="w-10 h-8 flex items-center justify-center shrink-0 bg-white rounded p-1 border border-slate-100">
                            {logo ? <img src={logo} alt={b.bank_name} className="max-h-full max-w-full object-contain" onError={e => e.currentTarget.style.display = 'none'} /> : <Landmark size={14} className="text-slate-400" />}
                          </div>"""

new_render_school = """                          <div className="w-10 h-8 flex items-center justify-center shrink-0 bg-white rounded p-1 border border-slate-100 overflow-hidden text-center">
                            {logo && b.bank_code !== "OTHER" ? <img src={logo} alt={b.bank_name} className="max-h-full max-w-full object-contain" onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = `<span class="text-[8px] font-black text-slate-400 uppercase leading-none">${b.bank_name.substring(0,3)}</span>` }} /> : <span className="text-[9px] font-black text-slate-400 uppercase leading-none">{b.bank_name.substring(0,3)}</span>}
                          </div>"""

code = code.replace(old_render_school, new_render_school)

with open('src/pages/admin/SchoolInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
