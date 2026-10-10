#!/usr/bin/env python3
"""
Update app_settings di Master PocketBase dengan versi APK terbaru.
Dipanggil oleh release-all.js setelah build APK.

Usage: python3 update-app-settings.py <versionCode> <versionName>
Contoh: python3 update-app-settings.py 21 1.1.19

- Update min_version_code & min_version_name
- TIDAK mengubah is_force_update (keputusan user via dashboard)
- Buat record baru jika belum ada
"""

import sqlite3
import json
import sys
import os

MASTER_DB = "/opt/pocketbase/master/pb_data/data.db"

def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <versionCode> <versionName>")
        sys.exit(1)

    version_code = int(sys.argv[1])
    version_name = sys.argv[2]

    if not os.path.exists(MASTER_DB):
        print(f"[ERROR] Master DB tidak ditemukan: {MASTER_DB}", file=sys.stderr)
        sys.exit(1)

    db = sqlite3.connect(MASTER_DB)
    cur = db.cursor()

    # Cek apakah collection app_settings ada
    row = cur.execute(
        "SELECT id FROM _collections WHERE name = 'app_settings'"
    ).fetchone()
    if not row:
        print("[ERROR] Collection app_settings tidak ada di master", file=sys.stderr)
        sys.exit(1)

    collection_id = row[0]

    # Ambil record terbaru (atau buat baru)
    rec = cur.execute(
        "SELECT id, is_force_update FROM app_settings ORDER BY created DESC LIMIT 1"
    ).fetchone()

    if rec:
        record_id, is_force = rec
        cur.execute(
            """UPDATE app_settings
               SET min_version_code = ?, min_version_name = ?, updated = datetime('now')
               WHERE id = ?""",
            (version_code, version_name, record_id)
        )
        print(f"[OK] app_settings diupdate: code={version_code}, name={version_name} "
              f"(force_update tetap: {is_force})")
    else:
        # Buat record baru dengan default tidak force update
        import random, string
        new_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=15))
        cur.execute(
            """INSERT INTO app_settings
               (id, collectionId, app_name, min_version_code, min_version_name,
                apk_url, update_notes, is_force_update, created, updated)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))""",
            (new_id, collection_id, "EXAM AA", version_code, version_name,
             "http://examku.my.id/exam-aa-latest.apk",
             "Pembaruan wajib untuk fitur ujian terbaru dan keamanan anti-cheat.",
             False)
        )
        print(f"[OK] app_settings dibuat: code={version_code}, name={version_name}")

    db.commit()
    db.close()

if __name__ == "__main__":
    main()
