import sqlite3
import os
import urllib.request
import json

db_paths = [
    r"C:\Users\Admin\Pictures\SD1\offline_package\pb_data\data.db",
    r"C:\Users\Admin\Music\exam aa sd\offline_package\pb_data\data.db"
]

# Hash untuk password "12345678" dari _superusers yang sudah terverifikasi:
# $2a$10$8h/hzdUjKkstBv7FDJnCC.NQIhQfXMbUjIz/KkSwxDeLKUVZVcLMq
PW_12345678_HASH = "$2a$10$8h/hzdUjKkstBv7FDJnCC.NQIhQfXMbUjIz/KkSwxDeLKUVZVcLMq"

for db_path in db_paths:
    if not os.path.exists(db_path):
        continue
    print(f"[+] Updating {db_path}...")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Update tabel users agar password menjadi 12345678
    cur.execute("UPDATE users SET password = ? WHERE email = 'admin@gmail.com' OR username = 'admin'", (PW_12345678_HASH,))
    print(f"    Rows updated in users: {cur.rowcount}")
    
    # Pastikan verified = 1
    cur.execute("UPDATE users SET verified = 1, role = 'admin' WHERE email = 'admin@gmail.com' OR username = 'admin'")
    
    # Pastikan _superusers juga punya password 12345678
    cur.execute("UPDATE _superusers SET password = ? WHERE email = 'admin@gmail.com'", (PW_12345678_HASH,))
    
    conn.commit()
    conn.close()

print("\n[+] Menguji autentikasi HTTP ke PocketBase port 8090...")
test_urls = [
    ("users by email", "http://127.0.0.1:8090/api/collections/users/auth-with-password", {"identity": "admin@gmail.com", "password": "12345678"}),
    ("users by username", "http://127.0.0.1:8090/api/collections/users/auth-with-password", {"identity": "admin", "password": "12345678"}),
    ("_superusers", "http://127.0.0.1:8090/api/collections/_superusers/auth-with-password", {"identity": "admin@gmail.com", "password": "12345678"})
]

for label, url, payload in test_urls:
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"  [SUCCESS] {label}: Token didapat (ID: {data.get('record', {}).get('id')})")
    except Exception as e:
        print(f"  [FAILED] {label}: {e}")
