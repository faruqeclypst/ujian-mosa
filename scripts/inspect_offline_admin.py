import sqlite3
import os

db_paths = [
    r"C:\Users\Admin\Music\exam aa sd\offline_package\pb_data\data.db",
    os.path.abspath("offline_package/pb_data/data.db")
]

for db_path in db_paths:
    if not os.path.exists(db_path):
        print(f"[-] DB not found: {db_path}")
        continue
    
    print(f"\n==========================================")
    print(f"[+] Inspecting DB: {db_path}")
    print(f"==========================================")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # List tables
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    print("Tables:", tables)

    # Check _superusers or _admins
    for adm_tbl in ["_superusers", "_admins"]:
        if adm_tbl in tables:
            print(f"\n--- Table {adm_tbl} ---")
            cur.execute(f"PRAGMA table_info({adm_tbl})")
            cols = [c[1] for c in cur.fetchall()]
            print("Columns:", cols)
            cur.execute(f"SELECT * FROM {adm_tbl}")
            rows = cur.fetchall()
            for r in rows:
                print(r)

    # Check users table
    if "users" in tables:
        print(f"\n--- Table users ---")
        cur.execute("PRAGMA table_info(users)")
        cols = [c[1] for c in cur.fetchall()]
        print("Columns:", cols)
        cur.execute("SELECT id, email, username, verified, passwordHash FROM users")
        for r in cur.fetchall():
            print(f"User: id={r[0]}, email={r[1]}, username={r[2]}, verified={r[3]}, hash={r[4][:20]}...")

    conn.close()
