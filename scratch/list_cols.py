import sqlite3
import json

conn = sqlite3.connect('vps/template_school/pb_data/data.db')
c = conn.cursor()
c.execute("SELECT name FROM _collections")
for row in c.fetchall():
    print(row[0])
conn.close()
