import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import pb from "../lib/pocketbase";

interface StudentUser {
  id: string;
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

export const StudentAuthProvider = ({ children }: { children: ReactNode }) => {
  const [student, setstudent] = useState<StudentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync state dengan PocketBase AuthStore
  useEffect(() => {
    const initAuth = async () => {
      // 1. Ambil data SECARA INSTAN dari AuthStore (No Blink)
      if (pb.authStore.isValid && pb.authStore.model && pb.authStore.model.collectionName === "students") {
        const model = pb.authStore.model;
        
        // Langsung pasang data dasar yang ada di memori kounter
        setstudent({
          id: model.id,
          nisn: model.username,
          name: model.name || "-",
          classId: model.classId || model.classid || (model as any).class_id || (model as any).class || "", 
          className: (model as any).className || (model as any).class_name || "-",
          hasChangedPassword: true
        });

        // 2. Jalankan pembaruan data secara ASYNC di latar belakang
        try {
          const studentFields = ["classId", "classid", "class_id", "class", "id_kelas", "kode_kelas"];
          const refreshed = await pb.collection("students").getOne(model.id, { 
            expand: studentFields.join(",") 
          });

          // Detect classObj dari rujukan (expand)
          let classObj = null;
          if (refreshed.expand) {
            const keys = Object.keys(refreshed.expand);
            for (const key of keys) {
              const obj = refreshed.expand[key];
              if (obj && (obj.name || obj.nama || (obj as any).classname)) {
                classObj = obj; break;
              }
            }
          }

          // Fallback manual jika expand gagal
          if (!classObj) {
            const possibleId = refreshed.classId || refreshed.classid || (refreshed as any).class_id || (refreshed as any).class;
            if (possibleId && possibleId.length > 5) {
              try { classObj = await pb.collection("classes").getOne(possibleId); } catch(e){}
            }
          }

          // Final update (Lengkap dengan Nama Kelas)
          setstudent({
            id: refreshed.id,
            nisn: refreshed.username,
            name: refreshed.name,
            classId: refreshed.classId || refreshed.classid || (refreshed as any).class_id || "", 
            className: classObj?.name || classObj?.nama || (classObj as any)?.classname || "-",
            hasChangedPassword: refreshed.hasChangedPassword,
          });
        } catch (e) {
          console.warn("Background sync failed:", e);
        }
      }
      setLoading(false);
    };

    initAuth();

    // Listen perubahan auth (misal logout dari tab lain)
    return pb.authStore.onChange(() => {
      initAuth();
    });
  }, []);

  const loginStudent = useCallback(async (nisn: string, password: string) => {
    try {
      // 1. Authenticate ke koleksi 'students'
      const authData = await pb.collection("students").authWithPassword(nisn, password, {
        expand: 'classId'
      });
      
      const model = authData.record;
      const classId = model.classId || model.class_id || model.classid || "";
      const classObj = model.expand?.classId || (model.expand as any)?.class_id || (model.expand as any)?.classid;

      const studentData: StudentUser = {
        id: model.id,
        nisn: model.username,
        name: model.name,
        classId: classId,
        className: classObj?.name || model.className || model.class_name || "-",
        hasChangedPassword: model.hasChangedPassword,
      };

      setstudent(studentData);
    } catch (err: any) {
      if (err.status === 400 || err.status === 404) {
        throw new Error("NISN atau Password salah!");
      }
      throw new Error(err.message || "Terjadi kesalahan saat login");
    }
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    if (!student) throw new Error("Tidak ada student yang aktif.");

    try {
      await pb.collection("students").update(student.id, {
        password: newPassword,
        passwordConfirm: newPassword,
        hasChangedPassword: true,
      });

      // Update state lokal
      setstudent((prev) => prev ? { ...prev, hasChangedPassword: true } : null);
    } catch (err: any) {
      throw new Error("Gagal mengganti password: " + err.message);
    }
  }, [student]);

  const logoutStudent = useCallback(() => {
    pb.authStore.clear();
    setstudent(null);
    sessionStorage.clear(); 
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


