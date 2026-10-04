import sqlite3, json

conn = sqlite3.connect('offline_package/pb_data/data.db')
c = conn.cursor()
c.execute("SELECT fields FROM _collections WHERE name='settings'")
fields = json.loads(c.fetchone()[0])
for f in fields:
    print(f.get('name'), '->', f.get('type'))
conn.close()
