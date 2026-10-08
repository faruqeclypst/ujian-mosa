import sys
import json

with open('package.json', 'r', encoding='utf-8') as f:
    pkg = json.load(f)

pkg['scripts']['switch:local'] = 'node scripts/switch-app.js local'

with open('package.json', 'w', encoding='utf-8') as f:
    json.dump(pkg, f, indent=2)
