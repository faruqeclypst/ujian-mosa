import sys
import re

with open('src/pages/admin/SchoolInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# find grid-cols-3 and the array for durations
pattern = r'<div className="grid grid-cols-3 gap-2">\s*\{\[\s*\{\s*months:\s*6.*?\]\.map'

replacement = '''<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { months: 1, label: "1 Bulan", sub: "Fleksibel" },
                          { months: 3, label: "3 Bulan", sub: "Triwulan" },
                          { months: 6, label: "6 Bulan", sub: "1 Semester" },
                          { months: 12, label: "12 Bulan", sub: "1 Tahun" },
                        ].map'''

code = re.sub(pattern, replacement, code, flags=re.DOTALL)

with open('src/pages/admin/SchoolInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
