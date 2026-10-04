import sqlite3

sd1_db = r"C:\Users\Admin\Pictures\SD1\offline_package\pb_data\data.db"
conn = sqlite3.connect(sd1_db)
cur = conn.cursor()
cur.execute("SELECT password FROM users WHERE email='admin@gmail.com'")
hash_val = cur.fetchone()[0]
print("Hash sudahlupa:", hash_val)
conn.close()

# Update D:\PROJECT\ujian\offline_package\pb_data\data.db
target_db = r"D:\PROJECT\ujian\offline_package\pb_data\data.db"
conn2 = sqlite3.connect(target_db)
cur2 = conn2.cursor()

# Update tabel users dengan password "sudahlupa"
cur2.execute("UPDATE users SET password = ?, hasChangedPassword = 1, verified = 1 WHERE email='admin@gmail.com' OR username='admin'", (hash_val,))
print("Updated users in D:\\PROJECT\\ujian\\offline_package:", cur2.rowcount)

# Kita juga perbarui _superusers dengan password "sudahlupa" agar di http://localhost:8090/_/ user bisa login dengan "sudahlupa"
cur2.execute("UPDATE _superusers SET password = ? WHERE email='admin@gmail.com'", (hash_val,))
print("Updated _superusers in D:\\PROJECT\\ujian\\offline_package:", cur2.rowcount)

conn2.commit()
conn2.close()

print("Berhasil update database offline_package!")
