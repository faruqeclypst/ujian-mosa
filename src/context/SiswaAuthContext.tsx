import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { ref, get, update } from "firebase/database";
import { database } from "../lib/firebase";

interface SiswaUser {
  nisn: string;
  name: string;
  classId: string;
  className: string;
  hasChangedPassword?: boolean;
}

interface SiswaAuthContextValue {
  siswa: SiswaUser | null;
  loading: boolean;
  loginSiswa: (nisn: string, password: string) => Promise<void>;
  logoutSiswa: () => void;
  changePassword: (newPassword: string) => Promise<void>;
}

const SiswaAuthContext = createContext<SiswaAuthContextValue | undefined>(undefined);

const LOCAL_STORAGE_KEY = "siswa_auth_session";

export const SiswaAuthProvider = ({ children }: { children: ReactNode }) => {
  const [siswa, setSiswa] = useState<SiswaUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedSession = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedSession) {
      try {
        setSiswa(JSON.parse(savedSession));
      } catch (err) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const loginSiswa = useCallback(async (nisn: string, password: string) => {
    // 1. Cek di tabel Master Data Siswa
    const studentsRef = ref(database, "piket_students");
    const snapshot = await get(studentsRef);

    if (!snapshot.exists()) {
      throw new Error("Data siswa kosong di server!");
    }

    const studentsData = snapshot.val();
    const siswaHit = Object.values(studentsData).find((s: any) => s.nisn === nisn) as any;

    if (!siswaHit) {
      throw new Error("NISN tidak terdaftar di data siswa!");
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
        nisn: siswaHit.nisn,
        name: siswaHit.name,
        classId: siswaHit.classId,
        password: dbPassword,
        hasChangedPassword: false,
      });
    }

    // Ambil Nama Kelas secara statis jika memungkinkan, atau sekadar kosong
    let className = "";
    if (siswaHit.classId) {
      const classSnap = await get(ref(database, `piket_classes/${siswaHit.classId}`));
      if (classSnap.exists()) className = classSnap.val().name;
    }

    const siswaData: SiswaUser = {
      nisn: siswaHit.nisn,
      name: siswaHit.name,
      classId: siswaHit.classId,
      className: className,
      hasChangedPassword: hasChangedPassword,
    };

    setSiswa(siswaData);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(siswaData));
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    if (!siswa) throw new Error("Tidak ada siswa yang aktif.");

    const userRef = ref(database, `users/${siswa.nisn}`);
    await update(userRef, {
      password: newPassword,
      hasChangedPassword: true,
    });

    const updatedSiswa = { ...siswa, hasChangedPassword: true };
    setSiswa(updatedSiswa);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedSiswa));
  }, [siswa]);

  const logoutSiswa = useCallback(() => {
    setSiswa(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }, []);

  return (
    <SiswaAuthContext.Provider value={{ siswa, loading, loginSiswa, logoutSiswa, changePassword }}>
      {children}
    </SiswaAuthContext.Provider>
  );
};

export const useSiswaAuth = () => {
  const context = useContext(SiswaAuthContext);
  if (context === undefined) {
    throw new Error("useSiswaAuth must be used within SiswaAuthProvider");
  }
  return context;
};
