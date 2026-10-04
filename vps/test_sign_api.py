import urllib.request
import json

data = json.dumps({
    'school_name': 'SD NEGERI 1 PAGAR AIR',
    'slug': 'sd1pagarair',
    'valid_until': '2026-10-31',
    'max_students': 0
}).encode('utf-8')

req = urllib.request.Request(
    'http://127.0.0.1:8090/api/multi-vps/sign-offline-license',
    data=data,
    headers={'Content-Type': 'application/json'}
)

try:
    resp = urllib.request.urlopen(req)
    print("RESPONSE STATUS:", resp.status)
    print("RESPONSE BODY:", resp.read().decode('utf-8'))
except Exception as e:
    print("ERROR:", e)
    if hasattr(e, 'read'):
        print("ERROR BODY:", e.read().decode('utf-8'))
