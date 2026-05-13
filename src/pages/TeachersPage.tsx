import { useState, useMemo } from "react";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { 
  Plus, 
  Trash, 
  Loader2, 
  Users, 
  FileSpreadsheet, 
  Download, 
  ChevronDown,
  FileText,
  Upload
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "../components/ui/dropdown-menu";
import { useExamData } from "../context/ExamDataContext";
import { useTenant } from "../context/TenantContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { Progress } from "../components/ui/progress";
import { DeleteConfirmationDialog } from "../components/ui/delete-confirmation-dialog";
import TeacherForm, { TeacherSubmitPayload } from "../components/exam/TeacherForm";
import TeacherTable from "../components/tables/TeacherTable";
import { ImportButton } from "../components/ui/import-button";
import { ExportButton } from "../components/ui/export-button";
import { ConfirmationDialog } from "../components/ui/confirmation-dialog";
import { downloadTeacherImportTemplate, exportTeacherToExcel, parseTeacherImportExcel } from "../lib/teacherExcel";
import type { Teacher } from "../types/exam";

const TeachersPage = () => {
  const { teachers, loading, createTeacher, updateTeacher, deleteTeacher, resetUserPassword } = useExamData();
  const { pb, terminology } = useTenant();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: "success" | "danger" | "warning" | "info";
    onConfirm?: () => void;
    showCancel?: boolean;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: "",
    description: "",
    type: "info",
  });

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info", onConfirm?: () => void, showCancel: boolean = false, confirmLabel: string = "OK") => {
    setAlertDialog({ isOpen: true, title, description, type, onConfirm, showCancel, confirmLabel });
  };

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedTeacher(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (teacher: Teacher) => {
    setDialogMode("edit");
    setSelectedTeacher(teacher);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (teacher: Teacher) => {
    setTeacherToDelete(teacher);
    setDeleteDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedTeacher(null);
  };

  const handleSubmitTeacher = async (values: TeacherSubmitPayload) => {
    try {
      if (dialogMode === "edit" && selectedTeacher) {
        await updateTeacher(selectedTeacher.id, values);
      } else {
        await createTeacher(values);
      }
      closeDialog();
    } catch (error) {
      console.error(`Gagal menyimpan data ${terminology.teacher.toLowerCase()}`, error);
      showAlert("Gagal", `Gagal menyimpan data ${terminology.teacher.toLowerCase()}.`, "danger");
    }
  };

  const handleConfirmDelete = async () => {
    if (!teacherToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTeacher(teacherToDelete.id);
    } catch (error) {
      console.error(`Gagal menghapus ${terminology.teacher.toLowerCase()}`, error);
      showAlert("Gagal", `Gagal menghapus data ${terminology.teacher.toLowerCase()}.`, "danger");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setTeacherToDelete(null);
    }
  };

  const handleResetPassword = async (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    showAlert(
      `Reset Password ${terminology.teacher}`,
      `Apakah Anda yakin ingin mereset password untuk ${terminology.teacher.toLowerCase()} ${teacher.name}? Password akan dikembalikan ke default "12345678".`,
      "warning",
      async () => {
        if (!pb) return;
        try {
          // Find the corresponding user account
          let userRec = null;
          try {
            userRec = await pb.collection("users").getFirstListItem(`teacherId="${teacherId}"`);
          } catch (e: any) {
            if (e.status !== 404) throw e;
          }

          if (userRec) {
            await resetUserPassword(userRec.id);
            showAlert("Berhasil", `Password ${terminology.teacher.toLowerCase()} ${teacher.name} berhasil direset menjadi 12345678.`, "success");
          } else {
            // Re-create user account if missing (e.g. after data restore)
            const defaultPass = "12345678";
            const username = teacher.username || teacher.code || teacher.name.toLowerCase().replace(/\s+/g, "_") + "_" + Math.floor(Math.random() * 1000);
            
            await pb.collection("users").create({
              username: username,
              password: defaultPass,
              passwordConfirm: defaultPass,
              name: teacher.name,
              role: "teacher",
              teacherId: teacherId,
              hasChangedPassword: false,
            });
            
            showAlert("Berhasil Dipulihkan", `Akun login ${terminology.teacher.toLowerCase()} ${teacher.name} yang sempat hilang telah dibuat kembali dengan password default 12345678.`, "success");
          }
        } catch (error: any) {
          console.error("Gagal reset password", error);
          const errorMsg = error.data?.message || error.message || `Gagal mereset password ${terminology.teacher.toLowerCase()}.`;
          showAlert("Gagal", errorMsg, "danger");
        }
      },
      true,
      "Ya, Reset"
    );
  };

  const handleSyncAllUsers = async () => {
    showAlert(
      "Sinkronkan Semua Akun ${terminology.teacher}",
      `Sistem akan memeriksa semua ${terminology.teacher.toLowerCase()} dan membuatkan akun login (users) bagi ${terminology.teacher.toLowerCase()} yang belum memilikinya. Username akan diambil dari kode ${terminology.teacher.toLowerCase()}/nama, dan password default adalah 12345678.`,
      "info",
      async () => {
        setBatchProgress({
          isOpen: true,
          total: teachers.length,
          current: 0,
          message: "Memulai sinkronisasi...",
          title: `Sinkronisasi Akun ${terminology.teacher}`
        });

        let createdCount = 0;
        try {
          for (let i = 0; i < teachers.length; i++) {
            const teacher = teachers[i];
            setBatchProgress(prev => ({ ...prev, current: i, message: `Memeriksa ${teacher.name}...` }));
            
            if (!pb) continue;
            try {
              await pb.collection("users").getFirstListItem(`teacherId="${teacher.id}"`);
            } catch (e: any) {
              if (e.status === 404 && pb) {
                // User missing, create it
                const defaultPass = "12345678";
                const username = teacher.username || teacher.code || teacher.name.toLowerCase().replace(/\s+/g, "_") + "_" + Math.floor(Math.random() * 1000);
                
                await pb.collection("users").create({
                  username: username,
                  password: defaultPass,
                  passwordConfirm: defaultPass,
                  name: teacher.name,
                  role: "teacher",
                  teacherId: teacher.id,
                  hasChangedPassword: false,
                });
                createdCount++;
              }
            }
          }
          showAlert("Selesai", `${createdCount} akun ${terminology.teacher.toLowerCase()} baru berhasil dibuat/dipulihkan.`, "success");
        } catch (err: any) {
          console.error("Sync all err", err);
          showAlert("Gagal", "Terjadi kesalahan saat sinkronisasi massal.", "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
        }
      },
      true,
      "Mulai Sinkron"
    );
  };

  const handleImportTeachers = async (file: File) => {
    setIsImporting(true);
    try {
      const parsed = await parseTeacherImportExcel(file);
      if (parsed.length === 0) return showAlert("File Kosong", "File yang Anda upload kosong atau tidak valid.", "warning");
      
      setBatchProgress({
        isOpen: true,
        total: parsed.length,
        current: 0,
        message: "Memulai import data...",
        title: `Import Data ${terminology.teacher}`
      });

      const failures: string[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const row = parsed[i];
        try {
          // Logika Generate: Hapus gelar (setelah koma)
          const namePart = row.name.split(',')[0].trim();
          
          // 1. Generate Username: kecilkan, ganti spasi jadi _
          const generatedUsername = namePart.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          
          // 2. Generate Kode: Ambil inisial (Alfaruq Asri -> AA)
          const generatedCode = namePart
            .split(/\s+/)
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .replace(/[^A-Z]/g, '');

          await createTeacher({
            name: row.name,
            code: row.code || generatedCode,
            username: row.code || generatedUsername || `guru_${Math.floor(Math.random() * 1000)}`,
            subjects: row.subjects,
          });
          
          setBatchProgress(prev => ({
            ...prev,
            current: i + 1,
            message: `Mengimport ${terminology.teacher.toLowerCase()} (${i + 1}/${parsed.length})`
          }));
        } catch (err: any) {
          console.error(`Gagal import ${row.name}:`, err);
          failures.push(`${row.name} - ${err.message || "Error"}`);
        }
      }

      let message = `${parsed.length - failures.length} ${terminology.teacher} berhasil diimport.`;
      if (failures.length > 0) {
        message += `\n\n❌ ${failures.length} data gagal:\n- ${failures.slice(0, 5).join("\n- ")}`;
      }
      
      showAlert("Hasil Import", message, failures.length > 0 ? "warning" : "success");
    } catch (err: any) {
      showAlert("Gagal Import", err.message || `Gagal mengimport data ${terminology.teacher.toLowerCase()}.`, "danger");
    } finally {
      setIsImporting(false);
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleExportTeachers = () => {
    exportTeacherToExcel({ teachers, filename: `data-${terminology.teacher.toLowerCase()}.xlsx` });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    showAlert(
      `Hapus ${terminology.teacher} Massal`,
      `Apakah Anda yakin ingin menghapus ${selectedIds.length} ${terminology.teacher.toLowerCase()} terpilih?`,
      "danger",
      async () => {
        setBatchProgress({
          isOpen: true,
          total: selectedIds.length,
          current: 0,
          message: "Menyiapkan penghapusan...",
          title: `Hapus ${terminology.teacher} Massal`
        });
        
        try {
          const chunkSize = 10;
          for (let i = 0; i < selectedIds.length; i += chunkSize) {
            const chunk = selectedIds.slice(i, i + chunkSize);
            await Promise.all(chunk.map(id => deleteTeacher(id)));
            
            const currentProcessed = Math.min(i + chunkSize, selectedIds.length);
            setBatchProgress(prev => ({
              ...prev,
              current: currentProcessed,
              message: `Menghapus data ${terminology.teacher.toLowerCase()} (${currentProcessed}/${selectedIds.length})`
            }));
          }
          setSelectedIds([]);
        } catch (error) {
          console.error(`Gagal menghapus ${terminology.teacher.toLowerCase()} massal`, error);
          showAlert("Gagal", `Gagal menghapus data ${terminology.teacher.toLowerCase()} massal.`, "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
        }
      },
      true,
      "Ya, Hapus Semua"
    );
  };

  const defaultValues = useMemo(() => 
    selectedTeacher
      ? {
          name: selectedTeacher.name,
          code: selectedTeacher.code || "",
          username: selectedTeacher.username || "",
          subjects: selectedTeacher.subjects || [],
        }
      : { name: "", code: "", username: "", subjects: [] },
  [selectedTeacher]);

  return (
    <div className="space-y-5">
      <input
        id="teacher-import-input"
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImportTeachers(file);
          }
          e.target.value = "";
        }}
      />
      <div className="relative z-30 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-500" />
            Data {terminology.teacher}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola daftar {terminology.teacher.toLowerCase()} dan {terminology.subject.toLowerCase()} pengampu.</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
              <Trash className="mr-1 h-3.5 w-3.5" />
              Hapus ({selectedIds.length})
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 dark:border-emerald-800/40 text-emerald-700 font-bold shadow-sm transition-all h-9 px-4">
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                Opsi Data
                <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-[100]">
              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2 text-left">Kelola {terminology.teacher}</DropdownMenuLabel>
              <div 
                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group"
                onClick={() => {
                  const input = document.getElementById("teacher-import-input") as HTMLInputElement;
                  if (input) input.click();
                }}
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">
                    {isImporting ? "Mengimport..." : "Import dari Excel"}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">Unggah file data {terminology.teacher.toLowerCase()}</span>
                </div>
              </div>
              <DropdownMenuItem 
                onClick={handleExportTeachers} 
                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Download className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Export ke Excel</span>
                  <span className="text-[10px] text-slate-400 mt-1">Unduh daftar {terminology.teacher.toLowerCase()}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
              <DropdownMenuItem 
                onClick={() => downloadTeacherImportTemplate()} 
                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Unduh Template</span>
                  <span className="text-[10px] text-slate-400 mt-1">Format file import Excel {terminology.teacher.toLowerCase()}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
              <DropdownMenuItem 
                onClick={handleSyncAllUsers} 
                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Sinkronkan Akun</span>
                  <span className="text-[10px] text-slate-400 mt-1">Pulihkan akun login yang hilang</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setSelectedTeacher(null); setIsDialogOpen(true); }} size="sm" className="rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-bold shadow-sm h-9 px-4">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Tambah {terminology.teacher}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-card">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-slate-800 dark:text-white">{dialogMode === "edit" ? `Edit Data ${terminology.teacher}` : `Tambah Data ${terminology.teacher}`}</DialogTitle>
              </DialogHeader>
              <TeacherForm
                defaultValues={defaultValues}
                onSubmit={handleSubmitTeacher}
                submitLabel={dialogMode === "edit" ? "Perbarui" : "Simpan"}
                onCancel={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
            </>
          )}
        </div>
      </div>



      {loading ? (
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar {terminology.teacher}</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead className="w-16 text-center">No</TableHead>
                      <TableHead>Nama {terminology.teacher}</TableHead>
                      <TableHead>{terminology.subject} Utama</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
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
          </CardContent>
        </Card>
      ) : (
        <TeacherTable 
          teachers={teachers} 
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          onEdit={handleEditClick} 
          onDelete={handleDeleteClick} 
          onResetPassword={handleResetPassword}
        />
      )}

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title={`Hapus ${terminology.teacher}`}
        description={`Apakah Anda yakin ingin menghapus data ${terminology.teacher.toLowerCase()} ini? Data jadwal yang sudah dibuat menggunakan ${terminology.teacher.toLowerCase()} ini mungkin akan kehilangan referensi.`}
        itemName={`${terminology.teacher} ${teacherToDelete?.name || ""}`}
        isLoading={isDeleting}
      />

      <ConfirmationDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        onConfirm={() => {
          if (alertDialog.onConfirm) alertDialog.onConfirm();
          setAlertDialog({ ...alertDialog, isOpen: false });
        }}
        title={alertDialog.title}
        description={alertDialog.description}
        type={alertDialog.type}
        confirmLabel={alertDialog.confirmLabel || "OK"}
        showCancel={alertDialog.showCancel}
      />

      {/* Batch Progress Dialog */}
      <Dialog open={batchProgress.isOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md bg-card border-none shadow-2xl p-0 overflow-hidden rounded-3xl" hideClose>
          <div className="bg-indigo-600 p-6 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                 <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">{batchProgress.title}</DialogTitle>
                <DialogDescription className="text-indigo-100 text-xs text-left">Mohon tunggu hingga proses selesai.</DialogDescription>
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
    </div>
  );
};

export default TeachersPage;




