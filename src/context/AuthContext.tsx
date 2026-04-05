import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import pb from "../lib/pocketbase";

interface UserData {
  id: string;
  email: string;
  name: string;
  role: "admin" | "teacher";
  teacherId?: string;
  avatar?: string;
}

interface AuthContextValue {
  user: UserData | null;
  role: "admin" | "teacher" | null;
  teacherId?: string;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  registerWithUsername: (username: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  usernameFromEmail: (email?: string | null) => string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync state dengan PocketBase AuthStore
  useEffect(() => {
    const initAuth = () => {
      if (pb.authStore.isValid && pb.authStore.model) {
        const model = pb.authStore.model;
        // Cek apakah ini login Admin/Guru (dari koleksi 'users')
        if (model.collectionName === "users") {
          setUser({
            id: model.id,
            email: model.email,
            name: model.name || model.username,
            role: model.role || "teacher",
            teacherId: model.teacherId,
            avatar: model.avatar ? pb.files.getUrl(model, model.avatar) : "",
          });
        }
      }
      setLoading(false);
    };

    initAuth();

    return pb.authStore.onChange(() => {
      initAuth();
    });
  }, []);

  const signInWithUsername = useCallback(async (username: string, password: string) => {
    try {
      // Di PocketBase 'users', login bisa pakai email atau username
      await pb.collection("users").authWithPassword(username, password);
    } catch (err: any) {
      throw new Error(err.message || "Email atau Password Admin salah!");
    }
  }, []);

  const registerWithUsername = useCallback(
    async (username: string, password: string, displayName?: string) => {
      try {
        await pb.collection("users").create({
          username,
          password,
          passwordConfirm: password,
          name: displayName,
          role: "teacher", // Default role untuk registrasi baru
        });
      } catch (err: any) {
        throw new Error("Gagal registrasi: " + err.message);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    pb.authStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role || null,
      teacherId: user?.teacherId,
      loading,
      signInWithUsername,
      registerWithUsername,
      signOut,
      usernameFromEmail: (email) => email?.split("@")[0] || "",
    }),
    [loading, user, signInWithUsername, registerWithUsername, signOut]
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
