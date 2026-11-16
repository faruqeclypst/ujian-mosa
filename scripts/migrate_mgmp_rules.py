import sqlite3
import json
import sys
import glob
import os

def migrate_database(db_path):
    print(f"Migrating database: {db_path}...")
    if not os.path.exists(db_path):
        print(f"  [SKIP] File not found: {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # 1. Pastikan kolom SQLite is_mgmp_shared ada di tabel exams
    try:
        c.execute("ALTER TABLE exams ADD COLUMN is_mgmp_shared BOOLEAN DEFAULT 0")
        print("  [OK] Added column is_mgmp_shared to table exams")
    except Exception as e:
        # Kolom sudah ada
        pass

    # 2. Update koleksi exams
    c.execute("SELECT fields, listRule, viewRule, updateRule, createRule FROM _collections WHERE name = 'exams'")
    row = c.fetchone()
    if row:
        fields = json.loads(row[0]) if row[0] else []
        field_names = [f.get("name") for f in fields]
        if "is_mgmp_shared" not in field_names:
            fields.append({
                "hidden": False,
                "id": "bool_is_mgmp_shared",
                "name": "is_mgmp_shared",
                "presentable": False,
                "required": False,
                "system": False,
                "type": "bool"
            })
            print("  [OK] Added is_mgmp_shared to exams fields schema")

        target_list = '@request.auth.role = "admin" || @request.auth.role = "teacher" || teacherId = @request.auth.teacherId || @request.auth.collectionName = "students"'
        target_view = '@request.auth.role = "admin" || @request.auth.role = "teacher" || teacherId = @request.auth.teacherId || @request.auth.collectionName = "students"'
        target_update = '@request.auth.role = "admin" || teacherId = @request.auth.teacherId || (is_mgmp_shared = true && @request.auth.role = "teacher")'

        c.execute("""
            UPDATE _collections 
            SET fields = ?, listRule = ?, viewRule = ?, updateRule = ?
            WHERE name = 'exams'
        """, (json.dumps(fields), target_list, target_view, target_update))
        print("  [OK] Updated exams collection rules (list, view, update for MGMP)")

    # 3. Update koleksi questions
    c.execute("SELECT listRule, viewRule, createRule, updateRule, deleteRule FROM _collections WHERE name = 'questions'")
    q_row = c.fetchone()
    if q_row:
        target_q_list = '@request.auth.collectionName = "students" || @request.auth.role = "admin" || @request.auth.role = "teacher" || examId.teacherId = @request.auth.teacherId'
        target_q_view = '@request.auth.collectionName = "students" || @request.auth.role = "admin" || @request.auth.role = "teacher" || examId.teacherId = @request.auth.teacherId'
        target_q_create = '@request.auth.role = "admin" || examId.teacherId = @request.auth.teacherId || (examId.is_mgmp_shared = true && @request.auth.role = "teacher")'
        target_q_update = '@request.auth.role = "admin" || examId.teacherId = @request.auth.teacherId || (examId.is_mgmp_shared = true && @request.auth.role = "teacher")'
        target_q_delete = '@request.auth.role = "admin" || examId.teacherId = @request.auth.teacherId || (examId.is_mgmp_shared = true && @request.auth.role = "teacher")'

        c.execute("""
            UPDATE _collections 
            SET listRule = ?, viewRule = ?, createRule = ?, updateRule = ?, deleteRule = ?
            WHERE name = 'questions'
        """, (target_q_list, target_q_view, target_q_create, target_q_update, target_q_delete))
        print("  [OK] Updated questions collection rules (list, view, create, update, delete for MGMP)")

    conn.commit()
    conn.close()
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1:
        for p in sys.argv[1:]:
            for path in glob.glob(p):
                migrate_database(path)
    else:
        # Default local
        migrate_database("vps/template_school/pb_data/data.db")
