import os
import re

filepath = r"d:\PROJECT\ujian\src\utils\invoicePdfHelper.ts"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("https://examku.my.id/logo-examku-cbt.png", "https://examku.my.id/logo-default.png")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated logo to logo-default.png in invoicePdfHelper.ts")
