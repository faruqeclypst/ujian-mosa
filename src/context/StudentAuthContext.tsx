import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { ref, get, update } from "firebase/database";
import { database } from "../lib/firebase";

interface StudentUser {
  nisn: string;
  name: string;
  classId: string;
  className: string;
  hasChangedPassword?: boolean;
}

interface StudentAuthContextValue {
  student: StudentUser | null;
  loading: boolean;
  loginStudent: (nisn: string, password: string) => Promise<void>;
  logoutStudent: () => void;
  changePassword: (newPassword: string) => Promise<void>;
}

const StudentAuthContext = createContext<StudentAuthContextValue | undefined>(undefined);

const SESSION_STORAGE_KEY = "student_auth_session";

export const StudentAuthProvider = ({ children }: { children: ReactNode }) => {
  const [student, setstudent] = useState<StudentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        setstudent(JSON.parse(savedSession));
      } catch (err) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const loginStudent = useCallback(async (nisn: string, password: string) => {
    // 1. Cek di tabel Master Data student
    const studentsRef = ref(database, "students");
    const snapshot = await get(studentsRef);

    if (!snapshot.exists()) {
      throw new Error("Data student kosong di server!");
    }

    const studentsData = snapshot.val();
    const studentHit = Object.values(studentsData).find((s: any) => s.nisn === nisn) as any;

    if (!studentHit) {
      throw new Error("NISN tidak terdaftar di data student!");
    }

    // 2. Cek Kredensial di tabel `users/${nisn}`
    const credRef = ref(database, `users/${nisn}`);
    const credSnapshot = await get(credRef);
    
    let dbPassword = "12345678"; // Default
    let hasChangedPassword = false;

    if (credSnapshot.exists()) {
      const credData = credSnapshot.val();
      dbPassword = credData.password;
      hasChangedPassword = credData.hasChangedPassword || false;
    }

    if (dbPassword !== password) {
      throw new Error("Password salah!");
    }

    // 3. Simpan Kredensial jika belum ada di node users/
    if (!credSnapshot.exists()) {
      await update(credRef, {
        nisn: studentHit.nisn,
        name: studentHit.name,
        classId: studentHit.classId,
        password: dbPassword,
        hasChangedPassword: false,
      });
    }

    // Ambil Nama Kelas secara statis jika memungkinkan, atau sekadar kosong
    let className = "";
    if (studentHit.classId) {
      const classSnap = await get(ref(database, `classes/${studentHit.classId}`));
      if (classSnap.exists()) className = classSnap.val().name;
    }

    const studentData: StudentUser = {
      nisn: studentHit.nisn,
      name: studentHit.name,
      classId: studentHit.classId,
      className: className,
      hasChangedPassword: hasChangedPassword,
    };

    setstudent(studentData);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(studentData));
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    if (!student) throw new Error("Tidak ada student yang aktif.");

    const userRef = ref(database, `users/${student.nisn}`);
    await update(userRef, {
      password: newPassword,
      hasChangedPassword: true,
    });

    const updatedstudent = { ...student, hasChangedPassword: true };
    setstudent(updatedstudent);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedstudent));
  }, [student]);

  const logoutStudent = useCallback(() => {
    setstudent(null);
    sessionStorage.clear(); // 🧹 Membersihkan seluruh sesi termasuk urutan soal agar 'fresh' saat masuk kembali
  }, []);

  return (
    <StudentAuthContext.Provider value={{ student, loading, loginStudent, logoutStudent, changePassword }}>
      {children}
    </StudentAuthContext.Provider>
  );
};

export const useStudentAuth = () => {
  const context = useContext(StudentAuthContext);
  if (context === undefined) {
    throw new Error("useStudentAuth must be used within StudentAuthProvider");
  }
  return context;
};


