import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { registerPlugin, Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { ShieldAlert, LogOut } from "lucide-react";
import { useTenant } from "./TenantContext";

const CheatAlert = registerPlugin<any>("CheatAlert");

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
  const { pb, loading: tenantLoading } = useTenant();
  const [student, setstudent] = useState<StudentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isKicked, setIsKicked] = useState(false);

  useEffect(() => {
    if (tenantLoading || !pb) {
      if (!tenantLoading) setLoading(false);
      return;
    }

    const initAuth = async () => {
      // Jika session tidak aktif di sessionStorage (aplikasi baru dibuka setelah ditutup/exit):
      // Wajibkan login ulang! Bersihkan sesi siswa lama.
      const isSessionActive = sessionStorage.getItem("student_session_active");
      if (!isSessionActive) {
        if (pb.authStore.isValid && pb.authStore.model && pb.authStore.model.collectionName === "students") {
          pb.authStore.clear();
          localStorage.removeItem("student_session_id");
          sessionStorage.removeItem("student_session_id");
        }
        setstudent(null);
        setLoading(false);
        return;
      }

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
            expand: studentFields.join(","),
            $autoCancel: false
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
              try { classObj = await pb.collection("classes").getOne(possibleId, { $autoCancel: false }); } catch(e){}
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

    // Generate unique session ID SEBELUM login
    const newSessionId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Set flag sesi aktif SEBELUM memanggil authWithPassword agar listener initAuth tidak menghapus auth
    sessionStorage.setItem("student_session_active", "true");
    sessionStorage.setItem("student_session_id", newSessionId);
    localStorage.setItem("student_session_id", newSessionId);

    try {
      const authData = await pb.collection("students").authWithPassword(nisn, password, {
        expand: 'classId'
      });

      const model = authData.record;
      const classId = model.classId || model.class_id || model.classid || "";
      const classObj = model.expand?.classId || (model.expand as any)?.class_id || (model.expand as any)?.classid;

      // Update activeSessionId di database agar perangkat lain yang sedang aktif terputus
      try {
        await pb.collection("students").update(model.id, { activeSessionId: newSessionId }, { $autoCancel: false });
      } catch (sessionErr) {
        console.error("GAGAL UPDATE SESSION ID:", sessionErr);
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
      sessionStorage.removeItem("student_session_active");
      sessionStorage.removeItem("student_session_id");
      localStorage.removeItem("student_session_id");
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
      }, { $autoCancel: false });
      logoutStudent();
    } catch (err: any) {
      throw new Error("Gagal mengganti password: " + err.message);
    }
  }, [student, pb]);

  const logoutStudent = useCallback(() => {
    sessionStorage.removeItem("student_session_active");
    sessionStorage.removeItem("student_session_id");
    localStorage.removeItem("student_session_id");
    pb?.authStore.clear();
    setstudent(null);
    sessionStorage.clear();
    window.location.replace(`${window.location.origin}/exam`);
  }, [pb]);

  // Aksi keluar dari aplikasi EXAM AA saat tombol OK pada dialog Kicked ditekan
  const handleKickedExit = async () => {
    try {
      sessionStorage.removeItem("student_session_active");
      sessionStorage.removeItem("student_session_id");
      localStorage.removeItem("student_session_id");
      pb?.authStore.clear();
      setstudent(null);
      sessionStorage.clear();
    } catch (_) {}

    if (Capacitor.isNativePlatform()) {
      try {
        await CheatAlert.stopAlarm();
        await CheatAlert.exitApp();
        return;
      } catch (_) {}
      try {
        await App.exitApp();
        return;
      } catch (_) {}
    }
    window.location.replace(`${window.location.origin}/exam`);
  };

  useEffect(() => {
    if (!student?.id || isKicked || !pb) return;

    const checkSessionMatch = (serverSid: string | undefined) => {
      const localSid = sessionStorage.getItem("student_session_id") || localStorage.getItem("student_session_id");
      // Jika di server ada session ID dan berbeda dari yang tersimpan di perangkat ini:
      // Berarti akun ini telah login di perangkat lain!
      if (serverSid && localSid && serverSid !== localSid) {
        setIsKicked(true);
        pb.authStore.clear();
        sessionStorage.removeItem("student_session_active");
        return true;
      }
      return false;
    };

    const checkInitialSession = async () => {
      try {
        const refreshed = await pb.collection("students").getOne(student.id, { $autoCancel: false });
        checkSessionMatch(refreshed.activeSessionId);
      } catch (err) {}
    };
    checkInitialSession();

    // 1. Realtime PocketBase Subscription
    const unsubscribe = pb.collection("students").subscribe(student.id, (e) => {
      if (e.action === "update") {
        const serverSid = e.record.activeSessionId;
        if (checkSessionMatch(serverSid)) {
          return;
        }

        // Check for Admin Reset
        if (e.record.hasChangedPassword === false || e.record.hasChangedPassword === "false" || e.record.hasChangedPassword === "0" || e.record.hasChangedPassword === 0) {
          logoutStudent();
        } else {
          setstudent(prev => prev ? { 
            ...prev, 
            name: e.record.name, 
            hasChangedPassword: e.record.hasChangedPassword 
          } : null);
        }
      }
    });

    // 2. Polling Heartbeat setiap 3 detik (backup jika koneksi SSE realtime putus di HP)
    const heartbeatTimer = setInterval(async () => {
      try {
        const refreshed = await pb.collection("students").getOne(student.id, { $autoCancel: false });
        checkSessionMatch(refreshed.activeSessionId);
      } catch (err) {}
    }, 3000);

    return () => { 
      unsubscribe.then(u => u());
      clearInterval(heartbeatTimer);
    };
  }, [student?.id, student?.hasChangedPassword, isKicked, pb]);

  return (
    <StudentAuthContext.Provider value={{ student, loading, loginStudent, logoutStudent, changePassword }}>
      {children}

      {isKicked && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-7 shadow-2xl border border-rose-200 dark:border-rose-900/50 text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500"></div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <ShieldAlert className="w-9 h-9 text-rose-600 dark:text-rose-400 animate-pulse" />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
                Akun Digunakan di HP Lain
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-xs font-medium leading-relaxed mb-6 px-1">
                Akun NISN ini baru saja login di perangkat lain. Demi keamanan ujian, akun pada perangkat ini dinonaktifkan.
              </p>
              <button
                type="button"
                onClick={handleKickedExit}
                className="w-full bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white h-12 rounded-xl font-black uppercase tracking-wider text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>OK, Keluar Aplikasi</span>
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
