import os
import re

filepath = r"d:\PROJECT\ujian\src\utils\invoicePdfHelper.ts"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

css_pattern = r"\.logo-box\s*\{[^}]+\}"
css_repl = r".logo-box {\n          height: 48px;\n          width: auto;\n          max-width: 160px;\n          object-fit: contain;\n        }"
content = re.sub(css_pattern, css_repl, content)

html_pattern = r'<div class="logo-box">EX</div>'
html_repl = r'<img class="logo-box" src="https://examku.my.id/logo-examku-cbt.png" alt="EXAMKU Logo" />'
content = content.replace(html_pattern, html_repl)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated logo in invoicePdfHelper.ts")
