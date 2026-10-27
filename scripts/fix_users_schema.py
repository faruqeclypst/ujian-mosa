import sqlite3
import json
import glob
import sys
import os

def fix_db(db_path):
    if not os.path.exists(db_path):
        print(f"[-] Not found: {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # 1. Pastikan kolom di tabel users ada
    cur.execute("PRAGMA table_info(users)")
    cols = [r[1] for r in cur.fetchall()]
    for col in ["google_id", "google_email", "avatar_url"]:
        if col not in cols:
            try:
                cur.execute(f"ALTER TABLE users ADD COLUMN {col} TEXT DEFAULT '' NOT NULL")
                print(f"[+] Added column {col} to users table in {db_path}")
            except Exception as e:
                print(f"[-] Error adding {col} column: {e}")

    # 2. Ambil fields dari _collections untuk users
    cur.execute("SELECT id, fields FROM _collections WHERE name='users'")
    row = cur.fetchone()
    if not row:
        print(f"[-] Collection users not found in _collections for {db_path}")
        conn.close()
        return False

    col_id, fields_json = row
    fields = json.loads(fields_json) if fields_json else []

    existing_field_names = [f.get("name") for f in fields]
    modified = False

    new_fields = [
        {
            "autogeneratePattern": "",
            "hidden": False,
            "id": "text_google_id",
            "max": 0,
            "min": 0,
            "name": "google_id",
            "pattern": "",
            "presentable": False,
            "primaryKey": False,
            "required": False,
            "system": False,
            "type": "text"
        },
        {
            "autogeneratePattern": "",
            "hidden": False,
            "id": "text_google_email",
            "max": 0,
            "min": 0,
            "name": "google_email",
            "pattern": "",
            "presentable": False,
            "primaryKey": False,
            "required": False,
            "system": False,
            "type": "text"
        },
        {
            "autogeneratePattern": "",
            "hidden": False,
            "id": "text_avatar_url",
            "max": 3000000,
            "min": 0,
            "name": "avatar_url",
            "pattern": "",
            "presentable": False,
            "primaryKey": False,
            "required": False,
            "system": False,
            "type": "text"
        }
    ]

    for nf in new_fields:
        if nf["name"] not in existing_field_names:
            fields.append(nf)
            existing_field_names.append(nf["name"])
            modified = True
            print(f"[+] Appended {nf['name']} to _collections.fields in {db_path}")

    if modified:
        cur.execute("UPDATE _collections SET fields=? WHERE name='users'", (json.dumps(fields),))
        conn.commit()
        print(f"[OK] Successfully updated _collections for users in {db_path}")
    else:
        print(f"[*] All fields already present in _collections for {db_path}")

    conn.close()
    return True

if __name__ == "__main__":
    targets = [
        "/opt/pocketbase/schools/template/pb_data/data.db",
        "/opt/pocketbase/schools/modalbangsa/pb_data/data.db",
    ]
    # Scan all schools on VPS
    for p in glob.glob("/opt/pocketbase/schools/*/pb_data/data.db"):
        if p not in targets:
            targets.append(p)

    for t in targets:
        fix_db(t)
