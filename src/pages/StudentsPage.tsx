import { useState, useMemo } from "react";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { 
  Plus, 
  Trash2, 
  ArrowLeftRight, 
  Check, 
  Filter, 
  ChevronDown,
  Loader2,
  Users2,
  FileSpreadsheet,
  Download,
  Upload,
  FileText,
  Sparkles
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "../components/ui/dropdown-menu";
import { useAuth } from "../context/AuthContext";
import { useExamData } from "../context/ExamDataContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "../components/ui/dialog";
import { Progress } from "../components/ui/progress";
import { DeleteConfirmationDialog } from "../components/ui/delete-confirmation-dialog";
import StudentForm, { StudentFormValues } from "../components/exam/StudentForm";
import StudentTable from "../components/tables/StudentTable";
import { ImportButton } from "../components/ui/import-button";
import { ExportButton } from "../components/ui/export-button";
import { ConfirmationDialog } from "../components/ui/confirmation-dialog";
import { downloadStudentImportTemplate, exportStudentToExcel, parseStudentImportExcel } from "../lib/studentExcel";
import FormField from "../components/forms/FormField";
import { Select } from "../components/ui/select";
import type { StudentData } from "../types/exam";
import StudentInterestDialog from "../components/exam/StudentInterestDialog";

const StudentsPage = () => {
  const { role } = useAuth();
  const { students, classes, loading, createStudent, updateStudent, deleteStudent } = useExamData();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [interestDialogOpen, setInterestDialogOpen] = useState(false);
  const [studentForInterest, setStudentForInterest] = useState<StudentData | null>(null);

  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [filterClassId, setFilterClassId] = useState<string>("ALL");

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

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info", onConfirm?: () => void, showCancel: boolean = false, confirmLabel: string = "OK") => {
    setAlertDialog({ isOpen: true, title, description, type, onConfirm, showCancel, confirmLabel });
  };

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedStudent(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (student: StudentData) => {
    setDialogMode("edit");
    setSelectedStudent(student);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (student: StudentData) => {
    setStudentToDelete(student);
    setDeleteDialogOpen(true);
  };

  const handleViewInterest = (student: StudentData) => {
    setStudentForInterest(student);
    setInterestDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedStudent(null);
  };

  const handleSubmitStudent = async (values: StudentFormValues) => {
    try {
      if (dialogMode === "edit" && selectedStudent) {
        await updateStudent(selectedStudent.id, values);
      } else {
        await createStudent(values);
      }
      closeDialog();
    } catch (error) {
      console.error("Gagal menyimpan data Siswa", error);
      showAlert("Gagal", "Gagal menyimpan data Siswa.", "danger");
    }
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      await deleteStudent(studentToDelete.id);
    } catch (error) {
      console.error("Gagal menghapus Siswa", error);
      showAlert("Gagal", "Gagal menghapus data Siswa.", "danger");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
    }
  };

  const handleImportStudents = async (file: File) => {
    setIsImporting(true);
    try {
      const { results, skipped } = await parseStudentImportExcel(file, classes);
      
      if (results.length === 0 && skipped.length === 0) {
        return showAlert("File Kosong", "File yang Anda upload kosong atau tidak valid.", "warning");
      }
      
      // Validasi NISN Duplikat
      const existingNisns = students.map(s => s.nisn);
      const newEntries = results.filter((p: any) => !existingNisns.includes(String(p.nisn)));
      const duplicatesCount = results.length - newEntries.length;
      
      if (newEntries.length === 0 && skipped.length === 0) {
        return showAlert("Batal", `Semua NISN di file (${results.length}) sudah terdaftar.`, "warning");
      }

      setBatchProgress({
        isOpen: true,
        total: newEntries.length,
        current: 0,
        message: "Memulai import data...",
        title: "Import Data Siswa"
      });

      const failures: string[] = [];
      const chunkSize = 10;
      for (let i = 0; i < newEntries.length; i += chunkSize) {
        const chunk = newEntries.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (row) => {
          try {
            await createStudent({
              nisn: String(row.nisn),
              name: row.name,
              gender: row.gender,
              classId: row.classId,
            });
          } catch (err: any) {
            console.error(`Gagal import siswa ${row.nisn}:`, err);
            failures.push(`${row.name} (${row.nisn}) - ${err.message || "Error Database"}`);
          }
        }));
        
        const currentProcessed = Math.min(i + chunkSize, newEntries.length);
        setBatchProgress(prev => ({
          ...prev,
          current: currentProcessed,
          message: `Mengimport data (${currentProcessed}/${newEntries.length})`
        }));
      }

      let message = `${newEntries.length - failures.length} Siswa berhasil diimport.`;
      if (duplicatesCount > 0) message += ` ${duplicatesCount} data dilewati karena NISN duplikat.`;
      
      if (skipped.length > 0) {
        const uniqueSkipped = Array.from(new Set(skipped.map(s => s.className)));
        message += `\n\n⚠️ ${skipped.length} data gagal karena Kelas [${uniqueSkipped.join(", ")}] tidak ditemukan.`;
      }
      
      if (failures.length > 0) {
        message += `\n\n❌ ${failures.length} data gagal disimpan ke database:\n- ${failures.slice(0, 5).join("\n- ")}${failures.length > 5 ? "\n...dan " + (failures.length - 5) + " lainnya" : ""}`;
      }
      
      showAlert("Hasil Import", message, (skipped.length > 0 || failures.length > 0) ? "warning" : "success");
    } catch (err: any) {
      showAlert("Gagal Import", err.message || "Gagal mengimport data Siswa.", "danger");
    } finally {
      setIsImporting(false);
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleExportStudents = () => {
    exportStudentToExcel({ students, classes, filename: "data-siswa.xlsx" });
  };

  const defaultValues = useMemo(() => 
    selectedStudent ? {
      nisn: selectedStudent.nisn,
      name: selectedStudent.name,
      gender: selectedStudent.gender,
      classId: selectedStudent.classId
    } : { nisn: "", name: "", gender: "L" as const, classId: "" }, 
  [selectedStudent]);

  const filteredStudents = useMemo(() => {
    let result = students;
    if (filterClassId === "NONE") {
       const validClassIds = classes.map(c => c.id);
       result = students.filter(s => !s.classId || !validClassIds.includes(s.classId));
    } else if (filterClassId !== "ALL") {
      result = students.filter(s => s.classId === filterClassId);
    }
    
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [students, filterClassId, classes]);

  const { updateStudentClassBatch, deleteStudentsBatch } = useExamData();

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);

  const handleBatchUpdateClass = async () => {
    if (!targetClassId || selectedIds.length === 0) return;
    setIsBatchOpen(false);
    
    setBatchProgress({
      isOpen: true,
      total: selectedIds.length,
      current: 0,
      message: "Menyiapkan pemindahan kelas...",
      title: "Pindah Kelas Massal"
    });

    try {
      const chunkSize = 10;
      for (let i = 0; i < selectedIds.length; i += chunkSize) {
        const chunk = selectedIds.slice(i, i + chunkSize);
        await Promise.all(chunk.map(id => updateStudent(id, { classId: targetClassId })));
        
        const currentProcessed = Math.min(i + chunkSize, selectedIds.length);
        setBatchProgress(prev => ({
          ...prev,
          current: currentProcessed,
          message: `Memindahkan siswa (${currentProcessed}/${selectedIds.length})`
        }));
      }
      setSelectedIds([]);
      setTargetClassId("");
    } catch (error) {
      console.error("Gagal memindahkan siswa", error);
      showAlert("Gagal", "Gagal memindahkan siswa.", "danger");
    } finally {
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    showAlert(
      "Hapus Siswa Massal",
      `Apakah Anda yakin ingin menghapus ${selectedIds.length} siswa terpilih? Tindakan ini tidak dapat dibatalkan.`,
      "danger",
      async () => {
        setBatchProgress({
          isOpen: true,
          total: selectedIds.length,
          current: 0,
          message: "Menyiapkan penghapusan...",
          title: "Hapus Siswa Massal"
        });
        
        try {
          const chunkSize = 10;
          for (let i = 0; i < selectedIds.length; i += chunkSize) {
            const chunk = selectedIds.slice(i, i + chunkSize);
            await Promise.all(chunk.map(id => deleteStudent(id)));
            
            const currentProcessed = Math.min(i + chunkSize, selectedIds.length);
            setBatchProgress(prev => ({
              ...prev,
              current: currentProcessed,
              message: `Menghapus data siswa (${currentProcessed}/${selectedIds.length})`
            }));
          }
          setSelectedIds([]);
        } catch (error) {
          console.error("Gagal menghapus siswa massal", error);
          showAlert("Gagal", "Gagal menghapus siswa massal.", "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
        }
      },
      true,
      "Ya, Hapus Semua"
    );
  };

  const handleMoveToAlumni = async () => {
    if (selectedIds.length === 0) return;
    showAlert(
      "Pindahkan ke Alumni",
      `Pindahkan ${selectedIds.length} siswa terpilih ke daftar Alumni (Lulus)?`,
      "warning",
      async () => {
        setBatchProgress({
          isOpen: true,
          total: selectedIds.length,
          current: 0,
          message: "Memproses kelulusan...",
          title: "Luluskan Siswa"
        });

        try {
          const chunkSize = 10;
          for (let i = 0; i < selectedIds.length; i += chunkSize) {
            const chunk = selectedIds.slice(i, i + chunkSize);
            await Promise.all(chunk.map(id => updateStudent(id, { classId: "ALUMNI" })));
            
            const currentProcessed = Math.min(i + chunkSize, selectedIds.length);
            setBatchProgress(prev => ({
              ...prev,
              current: currentProcessed,
              message: `Memproses siswa (${currentProcessed}/${selectedIds.length})`
            }));
          }
          setSelectedIds([]);
        } catch (error) {
          console.error("Gagal memindahkan ke alumni", error);
          showAlert("Gagal", "Gagal memindahkan ke alumni.", "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
        }
      },
      true,
      "Ya, Pindahkan"
    );
  };

  return (
    <div className="space-y-5">
      <input
        id="student-import-input"
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImportStudents(file);
          }
          e.target.value = "";
        }}
      />
      <div className="relative z-30 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users2 className="h-5 w-5 text-indigo-500" />
            Manajemen Siswa Aktif
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola daftar Siswa aktif dan penempatan kelas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {loading ? (
            <>
              <Skeleton className="h-9 w-28 rounded-2xl" />
              <Skeleton className="h-9 w-28 rounded-2xl" />
            </>
          ) : (
            <>
              {selectedIds.length > 0 && role === "admin" && (
                <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-200">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="default" size="sm" className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border dark:border-indigo-800/40 text-white h-8 text-xs rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                        <Users2 className="mr-1.5 h-3.5 w-3.5" />
                        Aksi ({selectedIds.length})
                        <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-[100]">
                      <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2">Opsi Massal</DropdownMenuLabel>
                      <DropdownMenuItem 
                        onClick={() => setTimeout(() => setIsBatchOpen(true), 150)}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <ArrowLeftRight className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Pindah Kelas</span>
                          <span className="text-[10px] text-slate-400 mt-1">Pindahkan ke kelas lain</span>
                        </div>
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem 
                        onClick={() => setTimeout(handleMoveToAlumni, 150)}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Check className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Luluskan (Alumni)</span>
                          <span className="text-[10px] text-slate-400 mt-1">Pindahkan ke daftar alumni</span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
 
                  <Button 
                    variant="default"
                    size="sm"
                    className="bg-rose-600 hover:bg-rose-700 dark:bg-rose-950/40 dark:text-rose-400 dark:border dark:border-rose-800/40 text-white h-8 text-xs rounded-xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all"
                    onClick={handleBatchDelete}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Hapus ({selectedIds.length})
                  </Button>
                </div>
              )}
 
              {role === "admin" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm" className="rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 dark:border-emerald-800/40 text-emerald-700 font-bold shadow-sm transition-all h-9 px-4">
                      <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                      Opsi Data
                      <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-[100]">
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2 text-left">Kelola Siswa</DropdownMenuLabel>
                    <div 
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group"
                      onClick={() => {
                        const input = document.getElementById("student-import-input") as HTMLInputElement;
                        if (input) {
                          input.click();
                        }
                      }}
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">
                          {isImporting ? "Mengimport..." : "Import dari Excel"}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">Unggah file data siswa aktif</span>
                      </div>
                    </div>
                    <DropdownMenuItem 
                      onClick={handleExportStudents} 
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Download className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Export ke Excel</span>
                        <span className="text-[10px] text-slate-400 mt-1">Unduh data siswa aktif</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
                    <DropdownMenuItem 
                      onClick={() => downloadStudentImportTemplate()} 
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Unduh Template</span>
                        <span className="text-[10px] text-slate-400 mt-1">Format file import Excel</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
 
              {role === "admin" && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={handleCreateClick} size="sm" className="rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-bold shadow-sm h-9 px-4">
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Tambah Siswa
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md bg-card">
                    <DialogHeader>
                      <DialogTitle className="text-base font-bold text-slate-800 dark:text-white">{dialogMode === "edit" ? "Edit Data Siswa" : "Tambah Data Siswa"}</DialogTitle>
                    </DialogHeader>
                    <StudentForm
                      classes={classes}
                      defaultValues={defaultValues}
                      onSubmit={handleSubmitStudent}
                      submitLabel={dialogMode === "edit" ? "Perbarui" : "Simpan"}
                      onCancel={() => setIsDialogOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}
        </div>
      </div>



      {loading ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">Daftar Siswa</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead className="w-[40px] text-center">
                         <div className="h-4 w-4 border border-slate-300 rounded mx-auto" />
                      </TableHead>
                      <TableHead className="w-[60px] text-center">No</TableHead>
                      <TableHead>NISN</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead className="w-[60px] text-center">L/P</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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
        <StudentTable 
          students={filteredStudents} 
          classes={classes} 
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          onEdit={handleEditClick} 
          onDelete={handleDeleteClick} 
          onViewInterest={handleViewInterest}
          filterActions={
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">Kelas:</span>
              <select
                value={filterClassId}
                onChange={(e) => setFilterClassId(e.target.value)}
                className="h-9 min-w-[140px] rounded-xl border border-slate-200 bg-card px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer dark:border-slate-800"
              >
                <option value="ALL">Semua Kelas</option>
                <option value="NONE">Tanpa Kelas</option>
                <optgroup label="Daftar Kelas">
                  {sortedClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          }
        />
      )}

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Siswa"
        description="Apakah Anda yakin ingin menghapus data Siswa ini? Riwayat ujian Siswa ini juga mungkin tidak akan terbaca dengan benar."
        itemName={`Siswa ${studentToDelete?.name || ""}`}
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

      {/* Dialog Pindah Kelas Massal */}
      <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-orange-500" />
              Pindah Kelas ({selectedIds.length} Siswa)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pilih kelas baru untuk siswa-siswa yang terpilih.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Kelas Tujuan:</label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all cursor-pointer dark:bg-slate-900/50 dark:border-slate-800"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {sortedClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
             </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsBatchOpen(false)} className="rounded-xl border-slate-200 dark:border-slate-800">Batal</Button>
            <Button 
              disabled={!targetClassId}
              onClick={handleBatchUpdateClass}
              className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-500/20"
            >
              Proses Pindah Kelas
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Progress Dialog */}
      <Dialog open={batchProgress.isOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md bg-card border-none shadow-2xl p-0 overflow-hidden rounded-3xl" hideClose>
          <div className="bg-blue-600 p-6 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                 <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">{batchProgress.title}</DialogTitle>
                <DialogDescription className="text-blue-100 text-xs">Mohon tunggu hingga proses selesai.</DialogDescription>
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

      <StudentInterestDialog
        isOpen={interestDialogOpen}
        onClose={() => {
          setInterestDialogOpen(false);
          setStudentForInterest(null);
        }}
        studentId={studentForInterest?.id || ""}
        studentName={studentForInterest?.name || ""}
      />
    </div>
  );
};

export default StudentsPage;

