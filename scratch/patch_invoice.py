import sys
import re

with open('src/pages/admin/SchoolInvoicePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_block = """                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { months: 6, label: "6 Bulan", sub: "1 Semester" },
                          { months: 12, label: "12 Bulan", sub: "1 Tahun (Disarankan)" },
                          { months: 24, label: "24 Bulan", sub: "2 Tahun" },
                        ].map(d => ("""

new_block = """                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { months: 1, label: "1 Bulan", sub: "Fleksibel" },
                          { months: 3, label: "3 Bulan", sub: "Triwulan" },
                          { months: 6, label: "6 Bulan", sub: "1 Semester" },
                          { months: 12, label: "12 Bulan", sub: "1 Tahun (Disarankan)" },
                        ].map(d => ("""

code = code.replace(old_block, new_block)

with open('src/pages/admin/SchoolInvoicePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
