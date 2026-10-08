import sys

with open('src/pages/admin/SchoolInvoicePage.tsx', 'r', encoding='utf-8') as f:
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
    code = code.replace("const SchoolInvoicePage = () => {", banks_const + "\nconst SchoolInvoicePage = () => {")

state_fix = "const [banks, setBanks] = useState<{bank_name: string, bank_code: string, account_number: string, account_name: string}[]>([]);"
code = code.replace("const [banks, setBanks] = useState<{bank_name: string, account_number: string, account_name: string}[]>([]);", state_fix)

render_bank_old = """                    {banks.map((b, i) => (
                      <div key={i} className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{b.bank_name} - <span className="font-mono text-blue-700 dark:text-blue-400">{b.account_number}</span></span>
                        <span className="text-[10px] text-slate-500">a.n. {b.account_name}</span>
                      </div>
                    ))}"""

render_bank_new = """                    {banks.map((b, i) => {
                      const logo = POPULAR_BANKS.find(p => p.code === b.bank_code)?.logo;
                      return (
                        <div key={i} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="w-10 h-8 flex items-center justify-center shrink-0 bg-white rounded p-1 border border-slate-100">
                            {logo ? <img src={logo} alt={b.bank_name} className="max-h-full max-w-full object-contain" onError={e => e.currentTarget.style.display = 'none'} /> : <Landmark size={14} className="text-slate-400" />}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">{b.bank_name} - <span className="font-mono text-blue-700 dark:text-blue-400">{b.account_number}</span></span>
                            <span className="text-[9px] text-slate-500 font-medium">a.n. {b.account_name}</span>
                          </div>
                        </div>
                      );
                    })}"""

code = code.replace(render_bank_old, render_bank_new)

with open('src/pages/admin/SchoolInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
