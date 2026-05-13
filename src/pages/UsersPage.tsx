import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Plus, ShieldAlert, Trash2, UserCog, Edit2, Mail, Loader2, User as UserIcon } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/toast";
import { useExamData } from "../context/ExamDataContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Progress } from "../components/ui/progress";
import FormField from "../components/forms/FormField";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";
import { Badge } from "../components/ui/badge";

import { cn } from "../lib/utils";

interface AppUser {
  id: string;
  email: string;
  username: string;
  name: string;
  role: "admin" | "teacher" | "student";
}

const UsersPage = () => {
  const { pb, terminology } = useTenant();
  const { user: currentUser, role: currentRole } = useAuth();
  const { addToast } = useToast();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "admin" as "admin" | "teacher",
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const [batchProgress, setBatchProgress] = useState<{
    isOpen: boolean;
    current: number;
    total: number;
    message: string;
    title: string;
  }>({
    isOpen: false,
    current: 0,
    total: 0,
    message: "",
    title: "Proses Data",
  });

  const [error, setError] = useState("");

  const fetchUsers = async () => {
    if (!pb) return;
    try {
      setLoading(true);
      const records = await pb.collection("users").getFullList({
        sort: "-created",
      });
      setUsers(records.map(r => ({
        id: r.id,
        email: r.email || "",
        username: r.username || "",
        name: r.name || "Tanpa Nama",
        role: (r.role as any) || "student"
      })));
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateAdmin = () => {
    setDialogMode("create");
    setSelectedUser(null);
    setFormData({ email: "", password: "", name: "", role: "admin" });
    setIsDialogOpen(true);
  };

  const handleEditClick = (user: AppUser) => {
    setDialogMode("edit");
    setSelectedUser(user);
    setFormData({
      email: user.email || "",
      password: "",
      name: user.name || "",
      role: user.role as any || "admin",
    });
    setIsDialogOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if ((dialogMode === "create" && !formData.password) || !formData.name) {
      setError("Password dan Nama Lengkap wajib diisi!");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: formData.name,
        role: formData.role,
      };

      if (dialogMode === "edit" && selectedUser) {
        if (formData.password) {
          payload.password = formData.password;
          payload.passwordConfirm = formData.password;
        }
        if (formData.email !== selectedUser.email) {
          payload.email = formData.email;
        }
        if (!pb) return;
        await pb.collection("users").update(selectedUser.id, payload);
      } else {
        const defaultPass = formData.password || "12345678";
        payload.password = defaultPass;
        payload.passwordConfirm = defaultPass;
        if (formData.email) {
          payload.email = formData.email;
          payload.emailVisibility = true;
          const emailPrefix = formData.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
          payload.username = emailPrefix + Math.floor(Math.random() * 1000);
        } else {
          // Generate username from name if email is empty
          const namePrefix = formData.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
          payload.username = namePrefix + Math.floor(Math.random() * 9999);
        }
        payload.hasChangedPassword = false;

        if (!pb) return;
        await pb.collection("users").create(payload);
      }

      setIsDialogOpen(false);
      fetchUsers();
      addToast({
        type: "success",
        title: "Berhasil",
        description: `Akun berhasil ${dialogMode === "edit" ? "diperbarui" : "dibuat"}!`
      });
    } catch (err: any) {
      console.error("DETAIL ERROR DARI PB:", err.data);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (id === currentUser?.id) {
      alert("Anda tidak bisa menghapus akun Anda sendiri.");
      return;
    }
    if (!window.confirm(`Apakah Anda yakin ingin menghapus akun ${name}?`)) return;

    if (!pb) return;
    try {
      await pb.collection("users").delete(id);
      fetchUsers();
    } catch (err) {
      alert("Gagal menghapus data pengguna.");
    }
  };

  const handleBatchDelete = async () => {
    const toDelete = selectedIds.filter(id => id !== currentUser?.id);
    if (toDelete.length === 0) return;

    if (!window.confirm(`Apakah Anda yakin ingin menghapus ${toDelete.length} akun terpilih?`)) return;

    setBatchProgress({
      isOpen: true,
      total: toDelete.length,
      current: 0,
      message: "Menghapus akun...",
      title: "Hapus Akun Massal"
    });

    try {
      for (let i = 0; i < toDelete.length; i++) {
        if (!pb) break;
        await pb.collection("users").delete(toDelete[i]);
        setBatchProgress(prev => ({ ...prev, current: i + 1 }));
      }
      setSelectedIds([]);
      fetchUsers();
    } catch (err) {
      console.error(err);
    } finally {
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const filteredUsers = useMemo(() => {
    if (activeTab === "all") return users;
    return users.filter(u => u.role === activeTab);
  }, [users, activeTab]);

  const columns = useMemo(() => [
    {
      key: "index",
      label: "No",
      className: "w-12 text-center",
      render: (_: any, __: any, i?: number) => <span className="text-xs font-medium">{(i || 0) + 1}</span>
    },
    {
      key: "name",
      label: "Identitas / Role",
      render: (v: string, u: AppUser) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800 dark:text-white">{v || "Tanpa Nama"}</span>
            <Badge variant="outline" className={cn(
              "text-[9px] uppercase font-black tracking-widest px-1.5 py-0",
              u.role === 'admin' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
              u.role === 'teacher' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
              'bg-blue-50 text-blue-600 border-blue-200'
            )}>
              {u.role === 'admin' ? 'ADMIN' : u.role === 'teacher' ? terminology.teacher.toUpperCase() : terminology.student.toUpperCase()}
            </Badge>
          </div>
          <span className="text-[10px] font-bold text-slate-400">ID: {u.username}</span>
        </div>
      )
    },
    {
      key: "email",
      label: "Email Login",
      render: (v: string) => <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{v}</span>
    }
  ], [terminology]);

  if (currentRole !== "admin") {
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <UserIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Akun Pengguna</h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Kelola akses login Administrator, {terminology.teacher}, dan {terminology.student}.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-white/50 dark:bg-slate-900/50 text-[10px] font-bold px-3 py-1.5 border-slate-200 dark:border-slate-800 rounded-xl">
            {users.length} Total Akun
          </Badge>
          <Button onClick={handleCreateAdmin} size="sm" className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20 h-10 px-5">
            <Plus className="mr-2 h-4 w-4" /> Admin Baru
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 w-full sm:w-auto h-auto flex-wrap gap-1">
          {[
            { id: "all", label: "Semua" },
            { id: "admin", label: "Administrator" },
            { id: "teacher", label: terminology.teacher },
            { id: "student", label: terminology.student },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)} 
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-none text-center", 
                activeTab === tab.id 
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="flex-1 max-w-sm bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30 p-3 rounded-2xl flex items-start gap-3">
          <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <h4 className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400 tracking-widest mb-1">Info Keamanan</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Seluruh akun baru ({terminology.teacher}, {terminology.student}) memiliki password default: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded text-blue-700 dark:text-blue-300 font-bold">12345678</code>.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 border-b">
           <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar Akun Sistem</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredUsers}
            columns={columns}
            loading={loading}
            searchPlaceholder="Cari nama atau email..."
            actions={(u: AppUser) => (
              <div className="flex justify-end gap-1.5 items-center">
                <button
                  className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg dark:bg-sky-900/10 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40 transition-colors"
                  onClick={() => handleEditClick(u)}
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40 transition-colors"
                  onClick={() => handleDeleteUser(u.id, u.name)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "Daftarkan Akun Baru" : "Edit Akun Pengguna"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveUser} className="space-y-5 pt-4">
            {error && <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl">{error}</div>}

            <FormField id="role" label="Role / Hak Akses" error={undefined}>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="admin">Administrator</option>
                <option value="teacher">{terminology.teacher}</option>
              </select>
            </FormField>

            <FormField id="name" label="Nama Lengkap" error={undefined}>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={`Contoh: Nama ${formData.role === 'admin' ? 'Administrator' : terminology.teacher}`}
                required
                className="h-12 px-4 rounded-2xl"
              />
            </FormField>

            <FormField id="email" label="Email (Login - Opsional)" error={undefined}>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="user@sekolah.com"
                className="h-12 px-4 rounded-2xl"
              />
            </FormField>

            <FormField id="password" label={dialogMode === "edit" ? "Password Baru (Opsional)" : "Password"} error={undefined}>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder={dialogMode === "edit" ? "Kosongkan jika tidak ganti" : "Minimal 8 karakter"}
                className="h-12 px-4 rounded-2xl"
              />
            </FormField>

            <DialogFooter className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-4 gap-3">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-2xl">Batal</Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-8">
                {isSubmitting ? "Memproses..." : "Simpan Akun"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
