import sqlite3
import json

db_path = r"C:\Users\Admin\Pictures\SD1\offline_package\pb_data\data.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT listRule, viewRule, createRule, updateRule, deleteRule, fields FROM _collections WHERE name='users'")
row = cur.fetchone()
print("Rules:", row[:5])
fields = json.loads(row[5])
for f in fields:
    print(f" - field: {f.get('name')}, type: {f.get('type')}, hidden: {f.get('hidden')}")

cur.execute("SELECT * FROM users WHERE email='admin@gmail.com'")
user_row = cur.fetchone()
cur.execute("PRAGMA table_info(users)")
cols = [c[1] for c in cur.fetchall()]
print("\nUser row:", dict(zip(cols, user_row)))

conn.close()
