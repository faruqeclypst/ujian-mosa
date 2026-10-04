import sqlite3

db_path = 'offline_package/pb_data/data.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 1. Update settings: kosongkan logo dan kembalikan ke default
cur.execute('''
    UPDATE settings 
    SET logo = "",
        logoUrl = "",
        name = "EXAM AA - Server Lokal",
        groq_api_key = "",
        ai_gateway_key = "",
        offline_license = ""
''')
conn.commit()

# 2. Verifikasi isi tabel settings
cur.execute('SELECT id, name, logo, logoUrl, groq_api_key, offline_license FROM settings')
rows = cur.fetchall()
print("Hasil update settings:")
for r in rows:
    print(r)

conn.close()
