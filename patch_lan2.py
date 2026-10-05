import sys
import re

with open('src/pages/landing/SelectSchoolPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Pattern to remove the span containing LAN / Lab
pattern = r'<span[^>]*>\s*LAN / Lab\s*</span>'
code = re.sub(pattern, '', code)

# Remove (Offline / Lab)
code = code.replace('LOCAL SERVER (OFFLINE / LAB)', 'LOCAL SERVER')
code = code.replace('Mode Local Server (Lab)', 'Mode Local Server')
code = code.replace('LAN / Lab', '')

with open('src/pages/landing/SelectSchoolPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
