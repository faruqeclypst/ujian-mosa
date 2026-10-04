import sqlite3

conn = sqlite3.connect('offline_package/pb_data/data.db')
c = conn.cursor()
c.execute("SELECT name FROM _collections WHERE name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name")
cols = [r[0] for r in c.fetchall()]
print(f"Total tabel di offline_package: {len(cols)}")
print(f"Daftar tabel: {', '.join(cols)}")
