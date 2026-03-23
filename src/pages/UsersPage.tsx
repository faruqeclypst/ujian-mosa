import { useState, useEffect } from "react";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { ref, onValue, set, remove } from "firebase/database";

import { useAuth } from "../context/AuthContext";
import { database, firebaseConfig } from "../lib/firebase";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import FormField from "../components/forms/FormField";
import UsersTable from "../components/tables/UsersTable"; // <--- added

interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "gurupiket";
  createdAt: number;
}

const UsersPage = () => {
  const { role, usernameToEmail } = useAuth();
  
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    displayName: "",
    role: "gurupiket" as "admin" | "gurupiket",
  });

  const [error, setError] = useState("");

  // Load users from RTDB
  useEffect(() => {
    const usersRef = ref(database, "piket_users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loaded: AppUser[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setUsers(loaded);
      } else {
        setUsers([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.username || !formData.password || !formData.displayName) {
      setError("Semua kolom (kecuali role) wajib diisi!");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create secondary auth instance to prevent logging out current admin
      const secondaryAppName = `secondary-${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const email = usernameToEmail(formData.username);

      // 2. Create Auth User
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        formData.password
      );

      const uid = credential.user.uid;

      // 3. Save role & mapping in RTDB using PRIMARY Database instance
      const userRef = ref(database, `piket_users/${uid}`);
      await set(userRef, {
        username: formData.username,
        displayName: formData.displayName,
        role: formData.role,
        createdAt: Date.now(),
      });

      // Reset form
      setFormData({ username: "", password: "", displayName: "", role: "gurupiket" });
      setIsDialogOpen(false);
      alert("Akun berhasil dibuat!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal membuat akun.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus peran akses ${name}? Anda juga perlu menghapusnya manual di tab Authentication Firebase jika ingin me-reset email.`)) return;
    
    try {
      await remove(ref(database, `piket_users/${id}`));
    } catch (err) {
      alert("Gagal menghapus data pengguna.");
    }
  };

  if (role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-500">
        <ShieldAlert className="w-12 h-12 mb-2 text-amber-500" />
        <p className="font-medium text-lg">Akses Ditolak</p>
        <p className="text-sm">Anda tidak memiliki izin untuk mengedit konfigurasi akun.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Manajemen Akun Berperan</h2>
          <p className="text-sm text-muted-foreground">Atur otorisasi Admin & Guru Piket.</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto" size="lg">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Akun
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Daftarkan Akun Baru</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                {error && <p className="text-xs text-red-500 bg-red-50 p-2 rounded">{error}</p>}
                
                <FormField id="username" label="Username (Digunakan untuk login)" error={undefined}>
                  <Input 
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value.replace(/\s+/g, '') }))}
                    placeholder="Contoh: toni_piket"
                  />
                </FormField>

                <FormField id="password" label="Password" error={undefined}>
                  <Input 
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  />
                </FormField>

                <FormField id="displayName" label="Nama Lengkap" error={undefined}>
                  <Input 
                    value={formData.displayName}
                    onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="Contoh: Pak Toni Syafi'i"
                  />
                </FormField>

                <FormField id="role" label="Role / Hak Akses" error={undefined}>
                  <Select 
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                  >
                    <option value="gurupiket">Guru Piket</option>
                    <option value="admin">Administrator</option>
                  </Select>
                </FormField>

                <div className="pt-4 border-t">
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isSubmitting}>
                    {isSubmitting ? "Mendaftarkan..." : "Buat Akun"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <UsersTable users={users} onDelete={handleDeleteUser} />
      )}
    </div>
  );
};

export default UsersPage;
