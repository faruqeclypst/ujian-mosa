import { useState, useEffect } from "react";
import { Plus, ShieldAlert, Trash2, UserCog, Edit2, Mail } from "lucide-react";
import pb from "../lib/pocketbase";
import { useAuth } from "../context/AuthContext";
import { useExamData } from "../context/ExamDataContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import FormField from "../components/forms/FormField";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "teacher";
  teacherId?: string;
}

const UsersPage = () => {
  const { user: currentUser, role: currentRole } = useAuth();
  const { teachers } = useExamData();
  
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "teacher" as "admin" | "teacher",
    teacherId: "",
  });

  const [error, setError] = useState("");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const records = await pb.collection("users").getFullList({
        sort: "-created",
      });
      setUsers(records.map(r => {
        const tid = r.teacherId || (r as any).teacherid || "";
        const roleVal = r.role || (r as any).role || "teacher";
        const emailVal = r.email || (r as any).email || (r as any).username || "";

        return {
          id: r.id,
          email: emailVal,
          name: r.name || (r as any).name || emailVal || "Tanpa Nama",
          role: roleVal as any,
          teacherId: tid
        };
      }));
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedUser(null);
    setFormData({ email: "", password: "", name: "", role: "teacher", teacherId: "" });
    setIsDialogOpen(true);
  };

  const handleEditClick = (user: AppUser) => {
    setDialogMode("edit");
    setSelectedUser(user);
    setFormData({
      email: user.email || "",
      password: "", 
      name: user.name || "",
      role: user.role || "teacher",
      teacherId: user.teacherId || "",
    });
    setIsDialogOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.email || (dialogMode === "create" && !formData.password) || !formData.name) {
      setError("Email dan Nama Lengkap wajib diisi!");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        email: formData.email,
        username: formData.email.split("@")[0] + "_" + Math.floor(Math.random()*1000), // PB butuh username unik
        name: formData.name,
        role: formData.role,
        teacherId: formData.role === "teacher" ? formData.teacherId : null,
      };

      if (formData.password) {
        payload.password = formData.password;
        payload.passwordConfirm = formData.password;
      }

      if (dialogMode === "edit" && selectedUser) {
        await pb.collection("users").update(selectedUser.id, payload);
      } else {
        await pb.collection("users").create({
          ...payload,
          emailVisibility: true,
        });
      }

      setIsDialogOpen(false);
      fetchUsers();
      alert(`Akun berhasil ${dialogMode === "edit" ? "diperbarui" : "dibuat"}!`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal menyimpan data akun.");
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
    
    try {
      await pb.collection("users").delete(id);
      fetchUsers();
    } catch (err) {
      alert("Gagal menghapus data pengguna.");
    }
  };

  const columns = [
    {
      key: "index",
      label: "No",
      render: (_: any, __: any, index?: number) => (index !== undefined ? index + 1 : 1),
    },
    {
      key: "name",
      label: "Pengguna",
      sortable: true,
      render: (v: string, item: AppUser) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800 dark:text-slate-100">{v}</span>
          <span className="text-[11px] text-blue-600 font-bold tracking-tight -mt-0.5 flex items-center gap-1">
            <Mail className="h-3 w-3" /> {item.email}
          </span>
        </div>
      )
    },
    {
      key: "role",
      label: "Hak Akses",
      sortable: true,
      render: (v: string) => (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
          v === "admin" 
            ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400" 
            : "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400"
        }`}>
          {v === "admin" ? "ADMINISTRATOR" : "GURU / PENGAWAS"}
        </span>
      )
    },
    {
      key: "teacherId",
      label: "Guru Terkait",
      render: (v: string) => {
        if (!v) return <span className="text-slate-400 text-xs">-</span>;
        const teacher = teachers.find(t => t.id === v);
        return <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{teacher?.name || "N/A"}</span>;
      }
    }
  ];

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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <UserCog className="h-5 w-5 text-indigo-500" />
            Manajemen Akun Berperan
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Atur otorisasi login Admin & Guru.</p>
        </div>

        {/* 🛡️ Info Akun Backup */}
        <div className="flex-1 max-w-sm bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30 p-3 rounded-xl flex items-start gap-3">
          <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <h4 className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400 tracking-widest mb-1">Info Backup/Restore</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Akun hasil <b>Impor Database</b> akan memiliki password default: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded text-blue-700 dark:text-blue-300 font-bold">username@mosa</code>. Guru disarankan segera mengganti password demi keamanan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={handleCreateClick} className="rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-semibold shadow-sm">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Tambah Akun (Email)
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-md bg-card">
              <DialogHeader>
                <DialogTitle>{dialogMode === "create" ? "Daftarkan Akun Baru" : "Edit Akun Pengguna"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveUser} className="space-y-4 pt-4">
                {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-800/40">{error}</p>}
                
                <FormField id="role" label="Role / Hak Akses" error={undefined}>
                  <select 
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any, teacherId: "", name: "" }))}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-card text-sm p-2"
                  >
                    <option value="teacher">Guru / Pengawas</option>
                    <option value="admin">Administrator</option>
                  </select>
                </FormField>

                {formData.role === "teacher" && (
                  <FormField id="teacherId" label="Pilih Guru Pengampu (Sinkronisasi)" error={undefined}>
                    <select
                      value={formData.teacherId}
                      onChange={(e) => {
                        const tid = e.target.value;
                        const tName = teachers.find(t => t.id === tid)?.name || "";
                        setFormData(prev => ({ ...prev, teacherId: tid, name: tName }));
                      }}
                      required
                      className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-card text-sm p-2"
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </FormField>
                )}

                <FormField id="name" label="Nama Lengkap" error={undefined}>
                  <Input 
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={formData.role === "admin" ? "Contoh: Administrator Utama" : "Pilih Guru Terlebih Dahulu"}
                    required
                    readOnly={formData.role === "teacher" && formData.teacherId !== ""}
                    className={formData.role === "teacher" ? "bg-slate-50 dark:bg-slate-900/40 font-semibold text-blue-600 dark:text-blue-400" : ""}
                  />
                </FormField>

                <FormField id="email" label="Email (Digunakan untuk login)" error={undefined}>
                  <Input 
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Contoh: novia@mosa.cbt"
                    required
                  />
                </FormField>

                <FormField id="password" label="Password" error={undefined}>
                  <Input 
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder={dialogMode === "edit" ? "Kosongkan jika tidak ingin diubah" : "Minimal 8 karakter"}
                    required={dialogMode === "create"}
                  />
                </FormField>

                <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800/60 mt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {isSubmitting ? "Menyimpan..." : (dialogMode === "create" ? "Buat Akun Email" : "Perbarui Akun Email")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Daftar Akun Login (Email)</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable 
            data={users} 
            columns={columns} 
            loading={loading}
            actions={(item: AppUser) => (
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditClick(item)}
                  className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  title="Edit Akun"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteUser(item.id, item.name)}
                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  title="Hapus Akun"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersPage;
