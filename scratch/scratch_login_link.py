import os

filepath = r"d:\PROJECT\ujian\src\pages\student\StudentLoginPage.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

target = """        <div className="mt-8 flex flex-col items-center gap-1 text-slate-400 text-sm font-medium">
          <p>Â© {new Date().getFullYear()} CBT {schoolName}.</p>
        </div>"""

replacement = """        <div className="mt-8 flex flex-col items-center gap-1.5 text-slate-500 text-[13px] font-medium">
          <div className="bg-white/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-full backdrop-blur-sm flex items-center gap-2 shadow-sm">
            <Monitor size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Belum punya aplikasi ujian?</span>
            <a href="/unduh" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
              Unduh di sini
            </a>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 text-xs font-medium">
          <p>Â© {new Date().getFullYear()} CBT {schoolName}.</p>
        </div>"""

if target in content:
    content = content.replace(target, replacement)
    # Ensure Monitor is imported if missing (I'll just add it to the lucide-react imports)
    if "Monitor" not in content[:500]:
        content = content.replace("import { GraduationCap, Lock, School, Sun, Moon, Eye, EyeOff } from \"lucide-react\";", 
                                  "import { GraduationCap, Lock, School, Sun, Moon, Eye, EyeOff, Monitor } from \"lucide-react\";")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("StudentLoginPage.tsx updated")
else:
    print("Target not found in StudentLoginPage.tsx")
