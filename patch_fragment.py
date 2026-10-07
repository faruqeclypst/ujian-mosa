import sys

with open('src/components/admin/BankAccountsSettings.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

bad = """                  {POPULAR_BANKS.find(b => b.code === bank.bank_code) && bank.bank_code !== "OTHER" ? (
                     <img src={POPULAR_BANKS.find(b => b.code === bank.bank_code)?.logo} alt={bank.bank_name} className="relative z-10 max-h-full max-w-full object-contain bg-white" onError={e => e.currentTarget.style.display = 'none'} />
                     <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase leading-none">{bank.bank_name.substring(0,4)}</span>
                  ) : ("""

good = """                  {POPULAR_BANKS.find(b => b.code === bank.bank_code) && bank.bank_code !== "OTHER" ? (
                     <>
                       <img src={POPULAR_BANKS.find(b => b.code === bank.bank_code)?.logo} alt={bank.bank_name} className="relative z-10 max-h-full max-w-full object-contain bg-white" onError={e => e.currentTarget.style.display = 'none'} />
                       <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase leading-none">{bank.bank_name.substring(0,4)}</span>
                     </>
                  ) : ("""

code = code.replace(bad, good)

with open('src/components/admin/BankAccountsSettings.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
