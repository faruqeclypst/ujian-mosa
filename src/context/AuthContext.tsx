import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTenant } from "./TenantContext";

interface UserData {
  id: string;
  email: string;
  name: string;
  role: "admin" | "teacher";
  teacherId?: string;
  avatar?: string;
  hasChangedPassword?: boolean;
  ai_api_key?: string;
  ai_provider?: string;
  ai_model?: string;
}

interface AuthContextValue {
  user: UserData | null;
  role: "admin" | "teacher" | null;
  teacherId?: string;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  registerWithUsername: (username: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  usernameFromEmail: (email?: string | null) => string;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { pb, loading: tenantLoading } = useTenant();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tunggu tenant PB selesai di-resolve sebelum cek auth
    if (tenantLoading || !pb) {
      if (!tenantLoading) setLoading(false);
      return;
    }

    const initAuth = () => {
      if (pb.authStore.isValid && pb.authStore.model) {
        const model = pb.authStore.model;
        if (model.collectionName === "users") {
          setUser({
            id: model.id,
            email: model.email,
            name: model.name || model.username,
            role: model.role || "teacher",
            teacherId: model.teacherId,
            avatar: model.avatar ? pb.files.getUrl(model, model.avatar) : "",
            hasChangedPassword: model.hasChangedPassword || false,
            ai_api_key: model.ai_api_key || "",
            ai_provider: model.ai_provider || "groq",
            ai_model: model.ai_model || "",
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    initAuth();

    return pb.authStore.onChange(() => {
      initAuth();
    });
  }, [pb, tenantLoading]);

  const signInWithUsername = useCallback(
    async (username: string, password: string) => {
      if (!pb) throw new Error("Koneksi ke sekolah belum tersedia.");
      try {
        await pb.collection("users").authWithPassword(username, password);
      } catch (err: any) {
        throw new Error(err.message || "Email atau Password Admin salah!");
      }
    },
    [pb]
  );

  const registerWithUsername = useCallback(
    async (username: string, password: string, displayName?: string) => {
      if (!pb) throw new Error("Koneksi ke sekolah belum tersedia.");
      try {
        await pb.collection("users").create({
          username,
          password,
          passwordConfirm: password,
          name: displayName,
          role: "teacher",
        });
      } catch (err: any) {
        throw new Error("Gagal registrasi: " + err.message);
      }
    },
    [pb]
  );

  const signOut = useCallback(async () => {
    pb?.authStore.clear();
    setUser(null);
    window.location.replace(`${window.location.origin}/admin`);
  }, [pb]);

  const changePassword = useCallback(async (newPassword: string) => {
    if (!user) throw new Error("Tidak ada user yang aktif.");
    if (!pb) throw new Error("Koneksi ke sekolah belum tersedia.");
    try {
      await pb.collection("users").update(user.id, {
        password: newPassword,
        passwordConfirm: newPassword,
        hasChangedPassword: true,
      });
      // Force logout setelah ganti password agar user login ulang dengan sesi bersih
      await signOut();
    } catch (err: any) {
      throw new Error("Gagal mengganti password: " + err.message);
    }
  }, [user, pb]);

  const [isKicked, setIsKicked] = useState(false);

  useEffect(() => {
    if (!user?.id || !pb) return;

    const unsubscribe = pb.collection("users").subscribe(user.id, (e) => {
      if (e.action === "update") {
        // Kick if password reset by SuperAdmin
        if (e.record.hasChangedPassword === false) {
           signOut();
        }
      }
    });

    return () => { unsubscribe.then(u => u()); };
  }, [user?.id, pb, signOut]);

  const refreshUser = useCallback(async () => {
    if (!pb) return;
    try {
      await pb.collection("users").authRefresh();
      // data user akan ter-update via pb.authStore.onChange di atas
    } catch (e) {
      console.error("Gagal menyegarkan data user", e);
    }
  }, [pb]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role || null,
      teacherId: user?.teacherId,
      loading,
      signInWithUsername,
      registerWithUsername,
      signOut,
      changePassword,
      refreshUser,
      usernameFromEmail: (email) => email?.split("@")[0] || "",
    }),
    [loading, user, signInWithUsername, registerWithUsername, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  }
  return context;
};
