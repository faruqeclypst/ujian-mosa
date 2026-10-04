import sqlite3

conn = sqlite3.connect('offline_package/pb_data/data.db')
c = conn.cursor()
c.execute("PRAGMA table_info(_collections)")
print("Columns in _collections:")
for col in c.fetchall():
    print(" ", col)

c.execute("SELECT * FROM _collections WHERE name='settings'")
row = c.fetchone()
col_names = [d[0] for d in c.description]
for name, val in zip(col_names, row):
    print(f"{name}: {repr(val)}")

c.execute("SELECT * FROM settings LIMIT 1")
s_row = c.fetchone()
if s_row:
    s_col_names = [d[0] for d in c.description]
    print("\nSettings row:")
    for name, val in zip(s_col_names, s_row):
        print(f"  {name}: {repr(val)}")
else:
    print("\nNo settings row!")
