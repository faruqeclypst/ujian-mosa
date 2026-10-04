import sqlite3
import json
import shutil
import os

TEMPLATE_DB = 'vps/template_school/pb_data/data.db'
OFFLINE_DB = 'offline_package/pb_data/data.db'
OFFLINE_DB_BAK = 'offline_package/pb_data/data.db.bak'

def clean_template_db():
    print(f"Cleaning template DB: {TEMPLATE_DB}...")
    conn = sqlite3.connect(TEMPLATE_DB)
    cur = conn.cursor()
    # Clean old leftover test data from template
    cur.execute("DELETE FROM leaderboards")
    cur.execute("DELETE FROM _authOrigins")
    cur.execute("DELETE FROM _externalAuths")
    cur.execute("DELETE FROM _mfas")
    cur.execute("DELETE FROM _otps")
    conn.commit()
    cur.execute("VACUUM")
    conn.close()
    print("Template DB cleaned successfully.")

def build_offline_db():
    print(f"Building offline DB from {TEMPLATE_DB}...")
    # Copy fresh template to offline DB
    shutil.copyfile(TEMPLATE_DB, OFFLINE_DB)
    
    conn = sqlite3.connect(OFFLINE_DB)
    cur = conn.cursor()

    # 1. Update _collections for 'settings' to add offline_license field
    cur.execute("SELECT id, fields FROM _collections WHERE name='settings'")
    row = cur.fetchone()
    if row:
        col_id, fields_json = row[0], row[1]
        fields = json.loads(fields_json)
        field_names = [f['name'] for f in fields]
        if 'offline_license' not in field_names:
            new_field = {
                "autogeneratePattern": "",
                "hidden": False,
                "id": "text_offline_license",
                "max": 0,
                "min": 0,
                "name": "offline_license",
                "pattern": "",
                "presentable": False,
                "primaryKey": False,
                "required": False,
                "system": False,
                "type": "text"
            }
            fields.append(new_field)
            cur.execute("UPDATE _collections SET fields=? WHERE id=?", (json.dumps(fields), col_id))
        if 'offline_license_status' not in field_names:
            status_field = {
                "autogeneratePattern": "",
                "hidden": False,
                "id": "text_offline_license_status",
                "max": 0,
                "min": 0,
                "name": "offline_license_status",
                "pattern": "",
                "presentable": False,
                "primaryKey": False,
                "required": False,
                "system": False,
                "type": "text"
            }
            fields.append(status_field)
            cur.execute("UPDATE _collections SET fields=? WHERE id=?", (json.dumps(fields), col_id))
        if 'locked_device_id' not in field_names:
            dev_field = {
                "autogeneratePattern": "",
                "hidden": False,
                "id": "text_locked_device_id",
                "max": 0,
                "min": 0,
                "name": "locked_device_id",
                "pattern": "",
                "presentable": False,
                "primaryKey": False,
                "required": False,
                "system": False,
                "type": "text"
            }
            fields.append(dev_field)
            cur.execute("UPDATE _collections SET fields=? WHERE id=?", (json.dumps(fields), col_id))
            print("Added 'locked_device_id' to _collections for settings.")
        if 'locked_device_name' not in field_names:
            dev_name_field = {
                "autogeneratePattern": "",
                "hidden": False,
                "id": "text_locked_device_name",
                "max": 0,
                "min": 0,
                "name": "locked_device_name",
                "pattern": "",
                "presentable": False,
                "primaryKey": False,
                "required": False,
                "system": False,
                "type": "text"
            }
            fields.append(dev_name_field)
            cur.execute("UPDATE _collections SET fields=? WHERE id=?", (json.dumps(fields), col_id))
            print("Added 'locked_device_name' to _collections for settings.")

    # 2. Add offline_license, offline_license_status, locked_device_id, locked_device_name columns to settings table if missing
    cur.execute("PRAGMA table_info(settings)")
    table_cols = [c[1] for c in cur.fetchall()]
    if 'offline_license' not in table_cols:
        cur.execute("ALTER TABLE settings ADD COLUMN offline_license TEXT DEFAULT ''")
        print("Added column 'offline_license' to table settings.")
    if 'offline_license_status' not in table_cols:
        cur.execute("ALTER TABLE settings ADD COLUMN offline_license_status TEXT DEFAULT 'active'")
        print("Added column 'offline_license_status' to table settings.")
    if 'locked_device_id' not in table_cols:
        cur.execute("ALTER TABLE settings ADD COLUMN locked_device_id TEXT DEFAULT ''")
        print("Added column 'locked_device_id' to table settings.")
    if 'locked_device_name' not in table_cols:
        cur.execute("ALTER TABLE settings ADD COLUMN locked_device_name TEXT DEFAULT ''")
        print("Added column 'locked_device_name' to table settings.")

    # 3. Configure credentials
    import secrets
    import string
    def gen_token_key(length=50):
        chars = string.ascii_letters + string.digits
        return ''.join(secrets.choice(chars) for _ in range(length))

    superuser_token = gen_token_key(50)
    admin_token = gen_token_key(50)

    # Superuser: admin@gmail.com / 12345678
    cur.execute("DELETE FROM _superusers")
    cur.execute("""
        INSERT INTO _superusers (id, email, password, tokenKey, emailVisibility, verified, created, updated)
        VALUES ('mh9elu20thevwry', 'admin@gmail.com', '$2a$10$XXPF0wKyCoINcHBkVOFr2OfuQk76m7w/NcmXUZKhD8w7ZOH3Vwera', ?, 1, 1, strftime('%Y-%m-%d %H:%M:%fZ'), strftime('%Y-%m-%d %H:%M:%fZ'))
    """, (superuser_token,))
    print("Configured _superusers: admin@gmail.com (pass: 12345678)")

    # Web Admin User: admin@gmail.com / sudahlupa (hasChangedPassword = 1 so no mandatory loop)
    cur.execute("DELETE FROM users")
    cur.execute("""
        INSERT INTO users (id, email, password, role, name, tokenKey, emailVisibility, verified, hasChangedPassword, created, updated)
        VALUES ('v1luvctwa25oyhh', 'admin@gmail.com', '$2a$10$t4uz4hBo2jtRa9YMm0YNt.F4f8dZlyMyQypX6.VGCu5c4GNuBX/SW', 'admin', 'Administrator', ?, 1, 1, 1, strftime('%Y-%m-%d %H:%M:%fZ'), strftime('%Y-%m-%d %H:%M:%fZ'))
    """, (admin_token,))
    print("Configured users: admin@gmail.com (pass: sudahlupa, hasChangedPassword: 1)")

    # 4. Configure clean settings
    cur.execute("""
        UPDATE settings 
        SET name='EXAM AA - Server Lokal',
            logo='',
            logoUrl='',
            offline_license='',
            groq_api_key='',
            ai_gateway_key=''
    """)
    print("Configured generic settings: 'EXAM AA - Server Lokal'")

    # 5. Clean operational tables
    tables_to_clear = [
        'attempts', 'classes', 'exam_rooms', 'exams', 'leaderboards',
        'questions', 'student_interests', 'students', 'subjects', 'teachers',
        '_authOrigins', '_externalAuths', '_mfas', '_otps'
    ]
    for tbl in tables_to_clear:
        cur.execute(f"DELETE FROM {tbl}")
    print("Cleared all operational tables.")

    conn.commit()
    cur.execute("VACUUM")
    conn.close()

    # Copy to backup
    shutil.copyfile(OFFLINE_DB, OFFLINE_DB_BAK)
    print(f"Created backup at {OFFLINE_DB_BAK}")

if __name__ == '__main__':
    clean_template_db()
    build_offline_db()
