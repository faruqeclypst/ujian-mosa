import sys

with open('src/components/admin/SuperAdminBankAccountsModal.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

banks_const = """
const POPULAR_BANKS = [
  { code: "BCA", name: "Bank BCA", logo: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg" },
  { code: "MANDIRI", name: "Bank Mandiri", logo: "https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_of_Bank_Mandiri.svg" },
  { code: "BNI", name: "Bank BNI", logo: "https://upload.wikimedia.org/wikipedia/id/5/55/BNI_logo.svg" },
  { code: "BRI", name: "Bank BRI", logo: "https://upload.wikimedia.org/wikipedia/commons/2/2e/BRI_2020.svg" },
  { code: "BSI", name: "Bank Syariah Indonesia", logo: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Bank_Syariah_Indonesia.svg" },
  { code: "CIMB", name: "CIMB Niaga", logo: "https://upload.wikimedia.org/wikipedia/commons/3/38/CIMB_Niaga_logo.svg" },
  { code: "PERMATA", name: "Permata Bank", logo: "https://upload.wikimedia.org/wikipedia/commons/3/38/PermataBank_logo.svg" },
  { code: "DANAMON", name: "Bank Danamon", logo: "https://upload.wikimedia.org/wikipedia/commons/f/f9/Bank_Danamon_logo.svg" },
  { code: "JAGO", name: "Bank Jago", logo: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Logo_Bank_Jago.png" },
  { code: "SEABANK", name: "SeaBank", logo: "https://upload.wikimedia.org/wikipedia/commons/f/f1/SeaBank_logo.png" },
];
"""

if "POPULAR_BANKS" not in code:
    code = code.replace("export const SuperAdminBankAccountsModal = ({ onClose }: { onClose: () => void }) => {", banks_const + "\nexport const SuperAdminBankAccountsModal = ({ onClose }: { onClose: () => void }) => {")

form_ui_old_1 = """                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Nama Bank</label>
                      <input type="text" className="w-full text-xs p-2 border rounded-lg" value={form.bank_name || ""} onChange={e => setForm({...form, bank_name: e.target.value})} placeholder="Contoh: BCA" />
                    </div>"""

form_ui_new_1 = """                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Pilih Bank</label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {POPULAR_BANKS.map(b => (
                          <button
                            key={b.code}
                            type="button"
                            onClick={() => setForm({...form, bank_code: b.code, bank_name: b.name})}
                            className={`p-2 border rounded-xl flex flex-col items-center justify-center gap-1.5 transition ${form.bank_code === b.code ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50'}`}
                          >
                            <div className="h-6 flex items-center justify-center">
                               <img src={b.logo} alt={b.name} className="max-h-full max-w-[50px] object-contain" onError={e => e.currentTarget.style.display = 'none'} />
                            </div>
                            <span className="text-[9px] font-bold text-slate-600 text-center">{b.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>"""

form_ui_old_2 = """                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Nama Bank</label>
                  <input type="text" className="w-full text-xs p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.bank_name || ""} onChange={e => setForm({...form, bank_name: e.target.value})} placeholder="Contoh: BCA" />
                </div>"""

code = code.replace(form_ui_old_1, form_ui_new_1)
code = code.replace(form_ui_old_2, form_ui_new_1)

render_bank_old = """                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs shrink-0">
                      {bank.bank_name.substring(0, 3).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 text-sm">{bank.bank_name} <span className="font-mono text-blue-600 ml-1">{bank.account_number}</span></h3>"""

render_bank_new = """                    <div className="w-12 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 p-1">
                      {POPULAR_BANKS.find(b => b.code === bank.bank_code) ? (
                         <img src={POPULAR_BANKS.find(b => b.code === bank.bank_code)?.logo} alt={bank.bank_name} className="max-h-full max-w-full object-contain" />
                      ) : (
                         <span className="text-xs font-black text-slate-400">{bank.bank_name.substring(0,3).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 text-sm">{bank.bank_name} <span className="font-mono text-blue-600 ml-1">{bank.account_number}</span></h3>"""

code = code.replace(render_bank_old, render_bank_new)

with open('src/components/admin/SuperAdminBankAccountsModal.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
