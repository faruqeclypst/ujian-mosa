#!/usr/bin/env python3
import sqlite3
import json
import glob
import os

def fix_db(db_path):
    if not os.path.exists(db_path):
        return False

    try:
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
                    pass

        # 2. Ambil fields dari _collections untuk users
        cur.execute("SELECT id, fields FROM _collections WHERE name='users'")
        row = cur.fetchone()
        if row:
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
                    print(f"[+] Appended {nf['name']} to _collections.fields (users) in {db_path}")

            if modified:
                cur.execute("UPDATE _collections SET fields=? WHERE name='users'", (json.dumps(fields),))
                conn.commit()
                print(f"[OK] Successfully updated _collections for users in {db_path}")

        # 3. Pastikan kolom di tabel students ada
        cur.execute("PRAGMA table_info(students)")
        student_cols = [r[1] for r in cur.fetchall()]
        for col in ["examUsername", "examPassword"]:
            if col not in student_cols:
                try:
                    cur.execute(f"ALTER TABLE students ADD COLUMN {col} TEXT DEFAULT '' NOT NULL")
                    print(f"[+] Added column {col} to students table in {db_path}")
                except Exception as e:
                    pass

        try:
            cur.execute("CREATE INDEX IF NOT EXISTS idx_students_examUsername ON students(examUsername)")
        except Exception:
            pass

        # 4. Ambil fields dari _collections untuk students
        cur.execute("SELECT id, fields FROM _collections WHERE name='students'")
        s_row = cur.fetchone()
        if s_row:
            s_col_id, s_fields_json = s_row
            s_fields = json.loads(s_fields_json) if s_fields_json else []
            existing_s_field_names = [f.get("name") for f in s_fields]
            s_modified = False

            new_student_fields = [
                {
                    "autogeneratePattern": "",
                    "hidden": False,
                    "id": "text_examUsername",
                    "max": 100,
                    "min": 0,
                    "name": "examUsername",
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
                    "id": "text_examPassword",
                    "max": 100,
                    "min": 0,
                    "name": "examPassword",
                    "pattern": "",
                    "presentable": False,
                    "primaryKey": False,
                    "required": False,
                    "system": False,
                    "type": "text"
                }
            ]

            for nf in new_student_fields:
                if nf["name"] not in existing_s_field_names:
                    s_fields.append(nf)
                    existing_s_field_names.append(nf["name"])
                    s_modified = True
                    print(f"[+] Appended {nf['name']} to _collections.fields (students) in {db_path}")

            if s_modified:
                cur.execute("UPDATE _collections SET fields=? WHERE name='students'", (json.dumps(s_fields),))
                conn.commit()
                print(f"[OK] Successfully updated _collections for students in {db_path}")

        conn.close()
        return True
    except Exception as e:
        print(f"[-] Error migrating {db_path}: {e}")
        return False

if __name__ == "__main__":
    targets = [
        "/opt/pocketbase/schools/template/pb_data/data.db",
    ]
    for p in glob.glob("/opt/pocketbase/schools/*/pb_data/data.db"):
        if p not in targets:
            targets.append(p)

    for t in targets:
        fix_db(t)
