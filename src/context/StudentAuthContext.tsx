import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useTenant } from "./TenantContext";

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

import { ShieldAlert, LogOut, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const StudentAuthContext = createContext<StudentAuthContextValue | undefined>(undefined);

export const StudentAuthProvider = ({ children }: { children: ReactNode }) => {
  const { pb, loading: tenantLoading } = useTenant();
  const [student, setstudent] = useState<StudentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // States for mandatory password change
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passError, setPassError] = useState("");
  const [isChangingPass, setIsChangingPass] = useState(false);

  useEffect(() => {
    if (tenantLoading || !pb) {
      if (!tenantLoading) setLoading(false);
      return;
    }

    const initAuth = async () => {
      if (pb.authStore.isValid && pb.authStore.model && pb.authStore.model.collectionName === "students") {
        const model = pb.authStore.model;

        setstudent({
          id: model.id,
          nisn: model.username,
          name: model.name || "-",
          classId: model.classId || model.classid || (model as any).class_id || (model as any).class || "",
          className: (model as any).className || (model as any).class_name || "-",
          hasChangedPassword: model.hasChangedPassword !== false && model.hasChangedPassword !== "false" && model.hasChangedPassword !== "0" && model.hasChangedPassword !== 0
        });

        try {
          const studentFields = ["classId", "classid", "class_id", "class", "id_kelas", "kode_kelas"];
          const refreshed = await pb.collection("students").getOne(model.id, {
            expand: studentFields.join(",")
          });

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

          if (!classObj) {
            const possibleId = refreshed.classId || refreshed.classid || (refreshed as any).class_id || (refreshed as any).class;
            if (possibleId && possibleId.length > 5) {
              try { classObj = await pb.collection("classes").getOne(possibleId); } catch(e){}
            }
          }

          setstudent({
            id: refreshed.id,
            nisn: refreshed.username,
            name: refreshed.name,
            classId: refreshed.classId || refreshed.classid || (refreshed as any).class_id || "",
            className: classObj?.name || classObj?.nama || (classObj as any)?.classname || "-",
            hasChangedPassword: refreshed.hasChangedPassword,
          });
        } catch (err: any) {
          if (err.status === 404) {
             logoutStudent();
          }
          console.warn("Background sync failed:", err);
        }
      }
      setLoading(false);
    };

    initAuth();

    return pb.authStore.onChange(() => {
      initAuth();
    });
  }, [pb, tenantLoading]);

  const loginStudent = useCallback(async (nisn: string, password: string) => {
    if (!pb) throw new Error("Koneksi ke sekolah belum tersedia.");
    try {
      const authData = await pb.collection("students").authWithPassword(nisn, password, {
        expand: 'classId'
      });

      const model = authData.record;
      const classId = model.classId || model.class_id || model.classid || "";
      const classObj = model.expand?.classId || (model.expand as any)?.class_id || (model.expand as any)?.classid;

      const fingerprint = btoa(navigator.userAgent).substring(0, 16);
      // Fallback for non-secure (HTTP) environments where crypto.randomUUID might be undefined
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 15);
      
      const newSessionId = `${uuid}:${fingerprint}`;
      localStorage.setItem("student_session_id", newSessionId);

      try {
        console.log("Attempting to sync session to server:", newSessionId);
        await pb.collection("students").update(model.id, { activeSessionId: newSessionId });
        console.log("Session sync successful!");
      } catch (sessionErr) {
        console.error("GAGAL UPDATE SESSION ID (Cek API Rules/Field Name):", sessionErr);
      }

      setstudent({
        id: model.id,
        nisn: model.username,
        name: model.name,
        classId: classId,
        className: classObj?.name || model.className || model.class_name || "-",
        hasChangedPassword: model.hasChangedPassword !== false && model.hasChangedPassword !== "false" && model.hasChangedPassword !== "0" && model.hasChangedPassword !== 0,
      });
    } catch (err: any) {
      if (err.status === 400 || err.status === 404) {
        throw new Error("NISN atau Password salah!");
      }
      throw new Error(err.message || "Terjadi kesalahan saat login");
    }
  }, [pb]);

  const changePassword = useCallback(async (newPassword: string) => {
    if (!student) throw new Error("Tidak ada student yang aktif.");
    if (!pb) throw new Error("Koneksi ke sekolah belum tersedia.");
    try {
      await pb.collection("students").update(student.id, {
        password: newPassword,
        passwordConfirm: newPassword,
        hasChangedPassword: true,
      });
      // Force logout setelah ganti password agar user login ulang dengan sesi bersih
      logoutStudent();
    } catch (err: any) {
      throw new Error("Gagal mengganti password: " + err.message);
    }
  }, [student, pb]);

  const logoutStudent = useCallback(() => {
    pb?.authStore.clear();
    setstudent(null);
    localStorage.removeItem("student_session_id");
    sessionStorage.clear();
    window.location.replace(`${window.location.origin}/exam`);
  }, [pb]);

  const [isKicked, setIsKicked] = useState(false);

  useEffect(() => {
    if (!student?.id || isKicked || !pb) return;

    const currentFingerprint = btoa(navigator.userAgent).substring(0, 16);

    const handleSessionConflict = (serverSessionId: string, localSessionId: string | null) => {
      if (!serverSessionId) return false;
      
      const [_, serverFingerprint] = serverSessionId.split(":");
      const [localUuid, localFingerprint] = localSessionId ? localSessionId.split(":") : [null, null];

      // Jika sid server ada tapi lokal belum ada
      if (!localSessionId) {
        if (serverFingerprint === currentFingerprint) {
          localStorage.setItem("student_session_id", serverSessionId);
          return false;
        }
        return true; // Perangkat berbeda
      }

      // Jika sid server berbeda dengan lokal
      if (serverSessionId !== localSessionId) {
        // Jika sid server berasal dari perangkat yang SAMA (fingerprint cocok)
        // Kita izinkan sinkronisasi ulang alih-alih kick (penting setelah restore database)
        if (serverFingerprint === currentFingerprint) {
          localStorage.setItem("student_session_id", serverSessionId);
          return false;
        }
        
        // Cek apakah localSid kita sebenarnya lebih baru (jika UUID ada dalam urutan tertentu, 
        // tapi paling aman adalah cek apakah update kita ke server belum sampai)
        return true;
      }
      return false;
    };

    const checkInitialSession = async () => {
      try {
        const refreshed = await pb.collection("students").getOne(student.id);
        const serverSid = refreshed.activeSessionId;
        const localSid = localStorage.getItem("student_session_id");
        if (handleSessionConflict(serverSid, localSid)) setIsKicked(true);
      } catch (err) {}
    };
    checkInitialSession();

    const unsubscribe = pb.collection("students").subscribe(student.id, (e) => {
      if (e.action === "update") {
        // 1. Check for session conflict (existing)
        const serverSid = e.record.activeSessionId;
        const localSid = localStorage.getItem("student_session_id");
        if (handleSessionConflict(serverSid, localSid)) setIsKicked(true);

        // 2. Check for Admin Reset (Kicked)
        if (e.record.hasChangedPassword === false || e.record.hasChangedPassword === "false" || e.record.hasChangedPassword === "0" || e.record.hasChangedPassword === 0) {
          logoutStudent();
        } else {
          // Sync data if changed (prevent UI from lagging)
          setstudent(prev => prev ? { 
            ...prev, 
            name: e.record.name, 
            hasChangedPassword: e.record.hasChangedPassword 
          } : null);
        }
      }
    });

    return () => { unsubscribe.then(u => u()); };
  }, [student?.id, student?.hasChangedPassword, isKicked, pb]);

  return (
    <StudentAuthContext.Provider value={{ student, loading, loginStudent, logoutStudent, changePassword }}>
      {children}

      {isKicked && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-emerald-100 dark:border-emerald-900/30 text-center relative overflow-hidden group slide-in-from-bottom-10 animate-in duration-700">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500"></div>
            <div className="relative z-10">
              <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 rotate-3 group-hover:rotate-0 transition-transform">
                <ShieldAlert className="w-10 h-10 text-emerald-600 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-3">
                Sesi Berakhir!
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-[13px] font-medium leading-relaxed mb-8 px-2">
                Akun Anda baru saja terdeteksi login di perangkat lain. <br />
                <span className="text-emerald-600 font-bold">Demi keamanan, sesi di browser ini telah dimatikan.</span>
              </p>
              <button
                onClick={() => { setIsKicked(false); logoutStudent(); }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-emerald-200 dark:shadow-none hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <LogOut className="w-4 h-4" />
                Masuk Kembali
              </button>
            </div>
          </div>
        </div>
      )}

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
