import sqlite3
import json

db_path = '/opt/pocketbase/master/pb_data/data.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

# 1. Update Physical SQLite Table
cols = [col[1] for col in c.execute("PRAGMA table_info(offline_licenses)").fetchall()]
print("Current columns:", cols)

if "is_used" not in cols:
    c.execute("ALTER TABLE offline_licenses ADD COLUMN is_used INTEGER DEFAULT 0")
    print("Added is_used column")

if "used_at" not in cols:
    c.execute("ALTER TABLE offline_licenses ADD COLUMN used_at TEXT DEFAULT ''")
    print("Added used_at column")

if "activation_count" not in cols:
    c.execute("ALTER TABLE offline_licenses ADD COLUMN activation_count INTEGER DEFAULT 0")
    print("Added activation_count column")

if "activated_device" not in cols:
    c.execute("ALTER TABLE offline_licenses ADD COLUMN activated_device TEXT DEFAULT ''")
    print("Added activated_device column")

# 2. Update _collections fields schema
c.execute("SELECT id, fields FROM _collections WHERE name='offline_licenses'")
row = c.fetchone()
if row:
    col_id, fields_raw = row[0], row[1]
    fields = json.loads(fields_raw)
    field_names = [f.get("name") for f in fields]
    
    modified = False
    if "is_used" not in field_names:
        fields.append({
            "hidden": False,
            "id": "bool_is_used",
            "name": "is_used",
            "presentable": False,
            "required": False,
            "system": False,
            "type": "bool"
        })
        modified = True
        print("Appended is_used to _collections")
        
    if "used_at" not in field_names:
        fields.append({
            "autogeneratePattern": "",
            "hidden": False,
            "id": "text_used_at",
            "max": 0,
            "min": 0,
            "name": "used_at",
            "pattern": "",
            "presentable": False,
            "primaryKey": False,
            "required": False,
            "system": False,
            "type": "text"
        })
        modified = True
        print("Appended used_at to _collections")
        
    if "activation_count" not in field_names:
        fields.append({
            "hidden": False,
            "id": "num_act_cnt",
            "max": None,
            "min": None,
            "name": "activation_count",
            "noDecimal": True,
            "presentable": False,
            "primaryKey": False,
            "required": False,
            "system": False,
            "type": "number"
        })
        modified = True
        print("Appended activation_count to _collections")
        
    if "activated_device" not in field_names:
        fields.append({
            "autogeneratePattern": "",
            "hidden": False,
            "id": "text_act_dev",
            "max": 0,
            "min": 0,
            "name": "activated_device",
            "pattern": "",
            "presentable": False,
            "primaryKey": False,
            "required": False,
            "system": False,
            "type": "text"
        })
        modified = True
        print("Appended activated_device to _collections")
        
    if modified:
        c.execute("UPDATE _collections SET fields = ? WHERE id = ?", (json.dumps(fields), col_id))
        print("Updated _collections table successfully")

conn.commit()
conn.close()
print("Migration completed successfully!")
