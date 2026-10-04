import sqlite3
import json
import time

conn = sqlite3.connect('/opt/pocketbase/master/pb_data/data.db')
c = conn.cursor()

c.execute("SELECT id FROM _collections WHERE name='offline_licenses'")
row = c.fetchone()

if row:
    print("Collection offline_licenses already exists with id:", row[0])
else:
    col_id = "pbc_offlinelic"
    name = "offline_licenses"
    fields = [
        {"autogeneratePattern": "[a-z0-9]{15}", "hidden": False, "id": "text_id", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": False, "primaryKey": True, "required": True, "system": True, "type": "text"},
        {"autogeneratePattern": "", "hidden": False, "id": "text_school", "max": 0, "min": 0, "name": "school_name", "pattern": "", "presentable": True, "primaryKey": False, "required": True, "system": False, "type": "text"},
        {"autogeneratePattern": "", "hidden": False, "id": "text_slug", "max": 0, "min": 0, "name": "slug", "pattern": "", "presentable": False, "primaryKey": False, "required": True, "system": False, "type": "text"},
        {"autogeneratePattern": "", "hidden": False, "id": "text_npsn", "max": 0, "min": 0, "name": "npsn", "pattern": "", "presentable": False, "primaryKey": False, "required": False, "system": False, "type": "text"},
        {"autogeneratePattern": "", "hidden": False, "id": "text_code", "max": 0, "min": 0, "name": "license_code", "pattern": "", "presentable": False, "primaryKey": False, "required": True, "system": False, "type": "text"},
        {"autogeneratePattern": "", "hidden": False, "id": "text_ver", "max": 0, "min": 0, "name": "version", "pattern": "", "presentable": False, "primaryKey": False, "required": False, "system": False, "type": "text"},
        {"autogeneratePattern": "", "hidden": False, "id": "text_until", "max": 0, "min": 0, "name": "valid_until", "pattern": "", "presentable": False, "primaryKey": False, "required": True, "system": False, "type": "text"},
        {"hidden": False, "id": "num_max_st", "max": None, "min": None, "name": "max_students", "noDecimal": True, "presentable": False, "primaryKey": False, "required": False, "system": False, "type": "number"},
        {"autogeneratePattern": "", "hidden": False, "id": "text_issued", "max": 0, "min": 0, "name": "issued_at", "pattern": "", "presentable": False, "primaryKey": False, "required": False, "system": False, "type": "text"},
        {"autogeneratePattern": "", "hidden": False, "id": "text_notes", "max": 0, "min": 0, "name": "notes", "pattern": "", "presentable": False, "primaryKey": False, "required": False, "system": False, "type": "text"},
        {"autogeneratePattern": "", "hidden": False, "id": "text_status", "max": 0, "min": 0, "name": "status", "pattern": "", "presentable": False, "primaryKey": False, "required": False, "system": False, "type": "text"},
        {"autogeneratePattern": "", "hidden": False, "id": "text_contact", "max": 0, "min": 0, "name": "contact_person", "pattern": "", "presentable": False, "primaryKey": False, "required": False, "system": False, "type": "text"},
        {"autogeneratePattern": "", "hidden": False, "id": "text_phone", "max": 0, "min": 0, "name": "contact_phone", "pattern": "", "presentable": False, "primaryKey": False, "required": False, "system": False, "type": "text"},
        {"hidden": False, "id": "autodate_created", "name": "created", "onCreate": True, "onUpdate": False, "presentable": False, "system": False, "type": "autodate"},
        {"hidden": False, "id": "autodate_updated", "name": "updated", "onCreate": True, "onUpdate": True, "presentable": False, "system": False, "type": "autodate"}
    ]
    
    # Allow super_admins full access (list, view, create, update, delete = "")
    list_rule = ""
    view_rule = ""
    create_rule = ""
    update_rule = ""
    delete_rule = ""

    now = time.strftime('%Y-%m-%d %H:%M:%S.000Z')
    c.execute(
        "INSERT INTO _collections (id, system, type, name, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options, created, updated) VALUES (?, 0, 'base', ?, ?, '[]', ?, ?, ?, ?, ?, '{}', ?, ?)",
        (col_id, name, json.dumps(fields), list_rule, view_rule, create_rule, update_rule, delete_rule, now, now)
    )

    # Create the physical table
    c.execute("""
        CREATE TABLE IF NOT EXISTS offline_licenses (
            id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
            school_name TEXT DEFAULT '' NOT NULL,
            slug TEXT DEFAULT '' NOT NULL,
            npsn TEXT DEFAULT '',
            license_code TEXT DEFAULT '' NOT NULL,
            version TEXT DEFAULT 'v2',
            valid_until TEXT DEFAULT '' NOT NULL,
            max_students INTEGER DEFAULT 0,
            issued_at TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            contact_person TEXT DEFAULT '',
            contact_phone TEXT DEFAULT '',
            created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
            updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
        )
    """)

    conn.commit()
    print("Collection offline_licenses created successfully with id:", col_id)

conn.close()
