import os

filepath = r"d:\PROJECT\ujian\src\pages\student\StudentLoginPage.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

target_link = '<a href="/unduh" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">\n              Unduh di sini\n            </a>'
rep_link = '<Link to="/unduh" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">\n              Unduh di sini\n            </Link>'
if target_link in content:
    content = content.replace(target_link, rep_link)

if "react-router-dom" not in content:
    content = content.replace('import { useState, useEffect } from "react";', 'import { useState, useEffect } from "react";\nimport { Link } from "react-router-dom";')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated StudentLoginPage with react-router Link")
