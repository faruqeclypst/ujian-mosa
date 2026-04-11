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

import { ShieldAlert, LogOut } from "lucide-react";

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

      // --- LOGIKA SESSION LOCKING (DEVICE AWARE) ---
      // Kita gabungkan UUID dengan Fingerprint Perangkat (User Agent)
      const fingerprint = btoa(navigator.userAgent).substring(0, 16);
      const newSessionId = `${crypto.randomUUID()}:${fingerprint}`;
      
      localStorage.setItem("student_session_id", newSessionId);
      
      try {
        // Update activeSessionId di database
        await pb.collection("students").update(model.id, {
          activeSessionId: newSessionId
        });
        console.log("Session ID updated successfully:", newSessionId);
      } catch (sessionErr) {
        console.error("GAGAL UPDATE SESSION ID:", sessionErr);
      }
      // --------------------------------------------

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
    localStorage.removeItem("student_session_id"); 
    sessionStorage.clear(); 
  }, []);

  const [isKicked, setIsKicked] = useState(false);

  // --- PEMANTAU SESI GLOBAL (DEVICE-AWARE SINGLE SESSION) ---
  useEffect(() => {
    if (!student?.id || isKicked) return;

    const currentFingerprint = btoa(navigator.userAgent).substring(0, 16);

    const handleSessionConflict = (serverSessionId: string, localSessionId: string | null) => {
      if (!serverSessionId) return false;

      // 1. Jika Local ID kosong (Cache terhapus), tapi Hardware Fingerprint cocok
      // Maka kita "Adopsi" sesi dari server tersebut.
      if (!localSessionId) {
        const [_, serverFingerprint] = serverSessionId.split(":");
        if (serverFingerprint === currentFingerprint) {
          localStorage.setItem("student_session_id", serverSessionId);
          console.log("Session restored from server due to matching fingerprint");
          return false;
        }
      }

      // 2. Jika Local ID ada tapi tidak sama
      if (localSessionId && serverSessionId !== localSessionId) {
        const [_, serverFingerprint] = serverSessionId.split(":");
        
        // JIKA Fingerprint sama tapi ID berbeda (berarti login baru di tab/jendela lain pada DEVICE YANG SAMA)
        // Kita lakukan silent-update agar tab ini tidak tertutup.
        if (serverFingerprint === currentFingerprint) {
          localStorage.setItem("student_session_id", serverSessionId);
          console.log("Session updated to match newer tab on same device");
          return false;
        }

        // JIKA Fingerprint berbeda (Berarti benar-benar di HP/Laptop lain)
        return true;
      }

      return false;
    };

    // 1. Pengecekan Awal
    const checkInitialSession = async () => {
      try {
        const refreshed = await pb.collection("students").getOne(student.id);
        const serverSid = refreshed.activeSessionId;
        const localSid = localStorage.getItem("student_session_id");

        if (handleSessionConflict(serverSid, localSid)) {
          setIsKicked(true);
        }
      } catch (err) {}
    };
    checkInitialSession();

    // 2. Real-time Monitor
    const unsubscribe = pb.collection("students").subscribe(student.id, (e) => {
      if (e.action === "update") {
        const serverSid = e.record.activeSessionId;
        const localSid = localStorage.getItem("student_session_id");
        if (handleSessionConflict(serverSid, localSid)) {
          setIsKicked(true);
        }
      }
    });

    return () => {
      unsubscribe.then(u => u());
    };
  }, [student?.id, isKicked]);
  // -----------------------------------------------------

  // --- AUTO LOGOUT ON INACTIVITY (5 MINUTES) ---
  useEffect(() => {
    if (!student) return;

    const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 Menit dalam milidetik

    const checkInactivity = () => {
      const lastActive = localStorage.getItem("last_active_time");
      if (lastActive) {
        const diff = Date.now() - parseInt(lastActive, 10);
        if (diff > INACTIVITY_LIMIT) {
          console.log("Sesi berakhir karena inaktivitas > 5 menit.");
          logoutStudent();
          window.location.href = "/";
          return true;
        }
      }
      return false;
    };

    // 1. Cek langsung saat aplikasi dimuat/fokus kembali
    checkInactivity();

    // 2. Pantau ketika aplikasi pindah ke Background atau Foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Simpan waktu saat aplikasi ditinggalkan
        localStorage.setItem("last_active_time", Date.now().toString());
      } else {
        // Cek selisih waktu saat aplikasi dibuka kembali
        checkInactivity();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [student, logoutStudent]);
  // -----------------------------------------------------

  return (
    <StudentAuthContext.Provider value={{ student, loading, loginStudent, logoutStudent, changePassword }}>
      {children}

      {/* MODAL KICKED (SESSION LOCKING) */}
      {isKicked && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-emerald-100 dark:border-emerald-900/30 text-center relative overflow-hidden group slide-in-from-bottom-10 animate-in duration-700">
            {/* Dekorasi Background */}
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
                onClick={() => {
                  setIsKicked(false);
                  logoutStudent();
                  window.location.href = "/";
                }}
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


