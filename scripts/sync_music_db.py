import sqlite3

sd1_db = r'C:\Users\Admin\Pictures\SD1\offline_package\pb_data\data.db'
music_db = r'C:\Users\Admin\Music\exam aa sd\offline_package\pb_data\data.db'

conn1 = sqlite3.connect(sd1_db)
cur1 = conn1.cursor()
cur1.execute("SELECT password FROM users WHERE email='admin@gmail.com'")
pw_hash = cur1.fetchone()[0]
conn1.close()

conn2 = sqlite3.connect(music_db)
cur2 = conn2.cursor()
cur2.execute("UPDATE users SET password = ?, hasChangedPassword = 1, verified = 1 WHERE email='admin@gmail.com' OR username='admin'", (pw_hash,))
print("Rows updated in music db:", cur2.rowcount)
conn2.commit()
conn2.close()

print("Sinkronisasi database berhasil!")
