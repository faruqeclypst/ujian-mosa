import sqlite3
import json

db_path = '/opt/pocketbase/master/pb_data/data.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 1. Update SQLite table if needed
cur.execute("PRAGMA table_info(schools)")
columns = [row[1] for row in cur.fetchall()]
if 'server_host' not in columns:
    print("Adding server_host column to schools table...")
    cur.execute("ALTER TABLE schools ADD COLUMN server_host TEXT DEFAULT '127.0.0.1' NOT NULL")
    conn.commit()
    print("Column server_host added successfully.")
else:
    print("Column server_host already exists in schools table.")

# 2. Update _collections schema if needed
cur.execute("SELECT fields FROM _collections WHERE name='schools'")
row = cur.fetchone()
if row:
    fields = json.loads(row[0])
    field_names = [f.get("name") for f in fields]
    if 'server_host' not in field_names:
        print("Adding server_host field to _collections schema...")
        new_field = {
            "autogeneratePattern": "",
            "hidden": False,
            "id": "text_server_host",
            "max": 0,
            "min": 0,
            "name": "server_host",
            "pattern": "",
            "presentable": False,
            "primaryKey": False,
            "required": False,
            "system": False,
            "type": "text"
        }
        fields.append(new_field)
        cur.execute("UPDATE _collections SET fields=? WHERE name='schools'", (json.dumps(fields),))
        conn.commit()
        print("Field server_host added to _collections schema.")
    else:
        print("Field server_host already exists in _collections schema.")

conn.close()
print("Migration completed.")
