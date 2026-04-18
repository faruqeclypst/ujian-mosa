import { useState, useEffect } from "react";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Plus, ShieldAlert, Trash2, UserCog, Edit2, Mail, Loader2 } from "lucide-react";
import pb from "../lib/pocketbase";
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

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "teacher";
  teacherId?: string;
}

const UsersPage = () => {
  const { user: currentUser, role: currentRole } = useAuth();
  const { addToast } = useToast();
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
    try {
      setLoading(true);
      const records = await pb.collection("users").getFullList({
        sort: "-created",
        filter: 'role="admin"',
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
      role: user.role || "admin",
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
        await pb.collection("users").update(selectedUser.id, payload);
      } else {
        // Untuk create baru
        const defaultPass = "12345678";
        payload.password = formData.password || defaultPass;
        payload.passwordConfirm = formData.password || defaultPass;
        payload.email = formData.email;
        payload.emailVisibility = true;
        payload.hasChangedPassword = false;
        payload.role = "admin";

        // Ambil bagian depan email sebagai username dasar
        const emailPrefix = formData.email.split("@")[0].replace(/[^a-zA-Z0-0]/g, "");
        // Tambahkan suffix acak pendek untuk menjamin keunikan
        payload.username = emailPrefix + Math.floor(Math.random() * 1000);

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
      const detailError = err.data?.data ? JSON.stringify(err.data.data) : "";
      setError(err.message + " " + detailError);
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

  const handleBatchDelete = async () => {
    const toDelete = selectedIds.filter(id => id !== currentUser?.id);
    if (toDelete.length === 0) {
      alert("Tidak ada akun yang bisa dihapus (Anda tidak bisa menghapus akun sendiri).");
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin menghapus ${toDelete.length} akun terpilih?`)) return;

    setBatchProgress({
      isOpen: true,
      total: toDelete.length,
      current: 0,
      message: "Menghapus akun...",
      title: "Hapus Akun Massal"
    });

    try {
      const chunkSize = 5;
      for (let i = 0; i < toDelete.length; i += chunkSize) {
        const chunk = toDelete.slice(i, i + chunkSize);
        await Promise.all(chunk.map(id => pb.collection("users").delete(id)));

        const currentProcessed = Math.min(i + chunkSize, toDelete.length);
        setBatchProgress(prev => ({
          ...prev,
          current: currentProcessed,
          message: `Menghapus data akun (${currentProcessed}/${toDelete.length})`
        }));
      }
      setSelectedIds([]);
      fetchUsers();
    } catch (err) {
      console.error("Gagal menghapus akun massal", err);
      alert("Terjadi kesalahan saat menghapus akun secara massal.");
    } finally {
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(users.map(u => u.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean, index: number, event: any) => {
    let newSelectedIds = [...selectedIds];

    if (checked && event.nativeEvent.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const idsInRange = users.slice(start, end + 1).map(u => u.id);

      newSelectedIds = Array.from(new Set([...newSelectedIds, ...idsInRange]));
    } else {
      if (checked) {
        if (!newSelectedIds.includes(id)) {
          newSelectedIds.push(id);
        }
      } else {
        newSelectedIds = newSelectedIds.filter((item) => item !== id);
      }
    }

    setSelectedIds(newSelectedIds);
    setLastSelectedIndex(index);
  };

  const isAllSelected = users.length > 0 && users.every(u => selectedIds.includes(u.id));

  const columns = [
    {
      key: "selection",
      label: (
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={(e) => handleSelectAll(e.target.checked)}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
        />
      ),
      render: (_: any, item: AppUser, index?: number) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(item.id)}
          onChange={(e) => handleSelectOne(item.id, e.target.checked, index ?? 0, e)}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
        />
      ),
      className: "w-[40px] text-center",
    },
    {
      key: "index",
      label: "No",
      render: (_: any, __: any, index?: number) => (index !== undefined ? index + 1 : 1),
      className: "w-[60px]",
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
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${v === "admin"
            ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400"
            : "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400"
          }`}>
          {v === "admin" ? "ADMINISTRATOR" : "GURU / PENGAWAS"}
        </span>
      )
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
              Seluruh akun baru (Admin, Guru, Siswa) maupun hasil <b>Impor Database</b> memiliki password default: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded text-blue-700 dark:text-blue-300 font-bold">12345678</code>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {loading ? (
            <>
              <Skeleton className="h-9 w-28 rounded-2xl" />
              <Skeleton className="h-9 w-28 rounded-2xl" />
            </>
          ) : (
            <>
              {selectedIds.length > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 dark:bg-rose-950/40 dark:text-rose-400 dark:border dark:border-rose-800/40 text-white rounded-xl font-bold shadow-lg shadow-rose-500/20 animate-in fade-in zoom-in duration-200 transition-all active:scale-95"
                  onClick={handleBatchDelete}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Hapus ({selectedIds.length})
                </Button>
              )}

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setSelectedUser(null); setIsDialogOpen(true); }} size="sm" className="rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-bold shadow-sm h-9 px-4">
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Tambah Pengguna
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md bg-card">
                  <DialogHeader>
                    <DialogTitle>{dialogMode === "create" ? "Daftarkan Akun Baru" : "Edit Akun Pengguna"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSaveUser} className="space-y-5 pt-4">
                    {error && (
                      <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        {error}
                      </div>
                    )}

                    <FormField id="role" label="Role / Hak Akses" error={undefined}>
                      <div className="relative group">
                        <select
                          value={formData.role}
                          onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any, name: "" }))}
                          className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer group-hover:bg-white dark:group-hover:bg-slate-900"
                        >
                          <option value="admin">Administrator</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <UserCog size={16} />
                        </div>
                      </div>
                    </FormField>

                    <FormField id="name" label="Nama Lengkap" error={undefined}>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Contoh: Administrator Utama"
                        required
                        className="h-12 px-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium"
                      />
                    </FormField>

                    <FormField id="email" label="Email (Digunakan untuk login)" error={undefined}>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Contoh: alfaruqasri98@gmail.com"
                        required
                        className="h-12 px-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium"
                      />
                    </FormField>

                    <DialogFooter className="pt-6 border-t border-slate-100 dark:border-slate-800/60 mt-6 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                        className="h-12 px-6 rounded-2xl border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
                      >
                        Batal
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-12 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex-1 md:flex-none"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Memproses...</span>
                          </div>
                        ) : (
                          dialogMode === "create" ? "Buat Akun Email" : "Perbarui Akun Email"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4 mb-2">
          <CardTitle className="text-base font-semibold">Daftar Akun Login (Email)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-16 text-center">No</TableHead>
                    <TableHead>Pengguna</TableHead>
                    <TableHead>Hak Akses</TableHead>
                    <TableHead>Guru Terkait</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-8 rounded-lg" />
                          <Skeleton className="h-8 w-8 rounded-lg" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
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
          )}

          {/* Batch Progress Dialog */}
          <Dialog open={batchProgress.isOpen} onOpenChange={() => { }}>
            <DialogContent className="max-w-md bg-card border-none shadow-2xl p-0 overflow-hidden rounded-3xl" hideClose>
              <div className="bg-indigo-600 p-6 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-white tracking-tight">{batchProgress.title}</DialogTitle>
                    <DialogDescription className="text-indigo-100 text-[10px] text-left">Mohon tunggu hingga proses selesai.</DialogDescription>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-white/40">{Math.round((batchProgress.current / batchProgress.total) * 100) || 0}%</span>
                </div>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{batchProgress.message}</span>
                    <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                      {batchProgress.current} / {batchProgress.total}
                    </span>
                  </div>
                  <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-3 bg-slate-100 dark:bg-slate-800" />
                </div>

                <p className="text-[10px] text-center text-slate-400 font-medium italic">
                  * Jangan menutup atau merefresh halaman ini selama proses berlangsung.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersPage;
