import sqlite3
import os

db_path = r"C:\Users\Admin\Pictures\SD1\offline_package\pb_data\data.db"
print("DB Exists:", os.path.exists(db_path))

conn = sqlite3.connect(db_path)
cur = conn.cursor()

print("\n--- _superusers ---")
try:
    cur.execute("SELECT id, email, password FROM _superusers")
    for r in cur.fetchall():
        print(f"Superuser: id={r[0]}, email={r[1]}, hash={r[2]}")
except Exception as e:
    print("Error superusers:", e)

print("\n--- users ---")
try:
    cur.execute("SELECT id, email, username, name, role, password FROM users")
    for r in cur.fetchall():
        print(f"User: id={r[0]}, email={r[1]}, username={r[2]}, name={r[3]}, role={r[4]}, hash={r[5]}")
except Exception as e:
    print("Error users:", e)

conn.close()
