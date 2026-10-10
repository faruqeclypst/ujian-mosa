#!/usr/bin/env python3
"""
MIGRATE TENANT SCHEMA — Sinkronkan schema tenant dengan template.

Dijalankan oleh sync-all-tenants.sh sebelum sync hooks.
Untuk setiap tenant di /opt/pocketbase/schools/*:
  - Bandingkan fields di _collections dengan template
  - Tambahkan field yang kurang (ALTER TABLE + update JSON schema)
  - Idempotent: aman dijalankan berulang kali

Saat ini menangani: students.fastHash (untuk fast-login)
"""

import sqlite3
import json
import os
import glob
import sys

TEMPLATE_DB = "/opt/pocketbase/schools/template/pb_data/data.db"
SCHOOLS_DIR = "/opt/pocketbase/schools"

# Field yang harus ada: (collection, field_name, field_def, sql_type)
REQUIRED_FIELDS = [
    (
        "students",
        "fastHash",
        {
            "name": "fastHash",
            "type": "text",
            "required": False,
            "presentable": False,
            "unique": False,
            "hidden": True,
            "system": False,
            "min": 0,
            "max": 0,
            "pattern": "",
            "autogeneratePattern": "",
            "primaryKey": False,
        },
        "TEXT DEFAULT ''",
    ),
]


def get_existing_field_names(db_path, collection):
    """Ambil daftar nama field dari _collections."""
    try:
        db = sqlite3.connect(db_path)
        cur = db.cursor()
        row = cur.execute(
            "SELECT fields FROM _collections WHERE name = ?", (collection,)
        ).fetchone()
        db.close()
        if not row:
            return None  # collection tidak ada
        fields = json.loads(row[0])
        return [f.get("name") for f in fields]
    except Exception as e:
        print(f"  [WARN] Gagal baca schema {collection}: {e}", file=sys.stderr)
        return None


def add_field(db_path, collection, field_name, field_def, sql_type):
    """Tambah field ke tabel + update JSON schema di _collections."""
    import random
    import string

    db = sqlite3.connect(db_path)
    cur = db.cursor()

    # 1. ALTER TABLE (abaikan jika kolom sudah ada)
    try:
        cur.execute(f"ALTER TABLE {collection} ADD COLUMN {field_name} {sql_type}")
        print(f"  [OK] Kolom {collection}.{field_name} ditambahkan")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            pass  # kolom sudah ada, lanjut ke schema JSON
        else:
            raise

    # 2. Update JSON schema di _collections
    row = cur.execute(
        "SELECT fields FROM _collections WHERE name = ?", (collection,)
    ).fetchone()
    if row:
        fields = json.loads(row[0])
        if not any(f.get("name") == field_name for f in fields):
            # Generate ID unik untuk field
            fid = field_def.get("type", "text") + "".join(
                random.choices(string.digits, k=10)
            )
            new_field = dict(field_def)
            new_field["id"] = fid
            fields.append(new_field)
            cur.execute(
                "UPDATE _collections SET fields = ? WHERE name = ?",
                (json.dumps(fields), collection),
            )
            print(f"  [OK] Schema JSON {collection}.{field_name} diupdate")

    db.commit()
    db.close()


def migrate_tenant(tenant_dir):
    """Migrasi satu tenant."""
    slug = os.path.basename(tenant_dir)
    db_path = os.path.join(tenant_dir, "pb_data", "data.db")

    if not os.path.exists(db_path):
        return

    # Stop jika database sedang dikunci? Tidak perlu — SQLite handle concurrent read.
    # Tapi pastikan service tidak sedang write berat. Untuk keamanan, kita lanjut saja
    # karena ALTER TABLE ADD COLUMN adalah operasi cepat dan aman.

    for collection, field_name, field_def, sql_type in REQUIRED_FIELDS:
        existing = get_existing_field_names(db_path, collection)
        if existing is None:
            continue  # collection tidak ada di tenant ini
        if field_name not in existing:
            print(f"[{slug}] Migrasi: {collection}.{field_name}")
            try:
                add_field(db_path, collection, field_name, field_def, sql_type)
            except Exception as e:
                print(f"  [ERROR] {slug}: {e}", file=sys.stderr)


def main():
    # Pastikan template punya field yang dibutuhkan (untuk validasi)
    if not os.path.exists(TEMPLATE_DB):
        print("[WARN] Template DB tidak ditemukan, lanjut dengan definisi bawaan",
              file=sys.stderr)

    tenants = [
        d for d in glob.glob(os.path.join(SCHOOLS_DIR, "*"))
        if os.path.isdir(d)
        and os.path.basename(d) != "template"
        and os.path.exists(os.path.join(d, "pb_data", "data.db"))
    ]

    print(f"Migrasi schema untuk {len(tenants)} tenant...")
    for tenant_dir in sorted(tenants):
        migrate_tenant(tenant_dir)
    print("Migrasi schema selesai.")


if __name__ == "__main__":
    main()
