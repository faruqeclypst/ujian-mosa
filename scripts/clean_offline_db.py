import sqlite3
conn = sqlite3.connect('offline_package/pb_data/data.db')
cur = conn.cursor()

for t in ['attempts', 'questions', 'exam_rooms', 'exams', 'students', 'teachers', 'student_interests', 'leaderboards', 'classes', 'subjects']:
    cur.execute(f'DELETE FROM {t}')

cur.execute("DELETE FROM users WHERE role = 'teacher'")
cur.execute("UPDATE settings SET name = 'EXAM AA - Server Lokal'")

conn.commit()
cur.execute('VACUUM')
conn.close()
print('Database cleaned back to pristine state.')
