import sqlite3
import json

db_path = 'offline_package/pb_data/data.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 1. Tambah kolom offline_license di tabel settings jika belum ada
cols = [c[1] for c in cur.execute('pragma table_info(settings)').fetchall()]
print('Existing cols:', cols)
if 'offline_license' not in cols:
    cur.execute('ALTER TABLE settings ADD COLUMN offline_license TEXT DEFAULT ""')
    conn.commit()
    print('Added offline_license column to settings table!')

# 2. Update schema koleksi di _collections
cur.execute('select fields from _collections where name = ?', ('settings',))
row = cur.fetchone()
if row:
    fields = json.loads(row[0])
    field_names = [f['name'] for f in fields]
    if 'offline_license' not in field_names:
        fields.append({
            'autogeneratePattern': '',
            'hidden': False,
            'id': 'text_offline_lic',
            'max': 0,
            'min': 0,
            'name': 'offline_license',
            'pattern': '',
            'presentable': False,
            'primaryKey': False,
            'required': False,
            'system': False,
            'type': 'text'
        })
        cur.execute('UPDATE _collections SET fields = ?, updateRule = "" WHERE name = ?', (json.dumps(fields), 'settings'))
        conn.commit()
        print('Updated _collections for settings!')
    else:
        cur.execute('UPDATE _collections SET updateRule = "" WHERE name = ?', ('settings',))
        conn.commit()
        print('Ensured updateRule = "" for settings!')

# 3. Cek hasil
cur.execute('pragma table_info(settings)')
print('Settings cols now:', [c[1] for c in cur.fetchall()])
conn.close()
