import sys

with open('src/pages/landing/SelectSchoolPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_block = """              <span>Local Server</span>
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                  activeTab === "local"
                    ? "bg-emerald-500/40 text-white"
                    : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                }`}
              >
                LAN / Lab
              </span>
            </button>"""

new_block = """              <span>Local Server</span>
            </button>"""

code = code.replace(old_block, new_block)

# Also remove "Mode Local Server (Lab)" in the modal to just "Mode Local Server"
code = code.replace(">Mode Local Server (Lab)<", ">Mode Local Server<")

with open('src/pages/landing/SelectSchoolPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
