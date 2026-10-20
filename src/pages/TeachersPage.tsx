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
  Upload, 
  KeyRound, 
  MoreHorizontal,
  Edit,
  Info,
  Mail,
  Phone,
  GraduationCap
} from "lucide-react";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { 
  NeonInspector,
  InspectorSection,
  InspectorHeader,
  InspectorField,
  InspectorGrid,
  InspectorActions,
  InspectorButton,
  InspectorEmpty,
} from "../components/ui/NeonInspector";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "../components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { useExamData } from "../context/ExamDataContext";
import { useTenant } from "../context/TenantContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { TeacherForm, TeacherSubmitPayload } from "../components/forms/TeacherForm";
import { TeacherTable } from "../components/tables/TeacherTable";
import BatchProgressDialog from "../components/dialogs/BatchProgressDialog";
import { ImportButton } from "../components/ui/import-button";
import { ExportButton } from "../components/ui/export-button";
import { ConfirmationDialog } from "../components/dialogs/ConfirmationDialog";
import { downloadTeacherImportTemplate, exportTeacherToExcel, parseTeacherImportExcel } from "../lib/teacherExcel";
import type { Teacher } from "../types/exam";
import { NeonStatGrid, NeonStatCard } from "../components/ui/NeonStats";

const TeachersPage = () => {
  const { teachers, subjects, loading, createTeacher, updateTeacher, deleteTeacher, resetUserPassword } = useExamData();
  const { pb, terminology, school } = useTenant();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [inspectedTeacherId, setInspectedTeacherId] = useState<string | null>(null);

  const inspectedTeacher = useMemo(() => {
    return teachers.find(t => t.id === inspectedTeacherId) || teachers[0] || null;
  }, [teachers, inspectedTeacherId]);
  
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
            let username = (teacher.username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
            if (!username || username.length < 3) {
              const safeName = teacher.name.split(',')[0].trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
              username = safeName;
            }
            if (!username || username.length < 3) {
              const safeCode = (teacher.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              username = safeCode ? `guru_${safeCode}` : `guru_${Math.floor(100 + Math.random() * 900)}`;
            }
            
            await pb.collection("users").create({
              username: username,
              password: defaultPass,
              passwordConfirm: defaultPass,
              name: teacher.name,
              role: "teacher",
              teacherId: teacherId,
              hasChangedPassword: false,
            });

            if (!teacher.username || teacher.username !== username) {
              await pb.collection("teachers").update(teacherId, { username });
            }
            
            showAlert("Berhasil Dipulihkan", `Akun login ${terminology.teacher.toLowerCase()} ${teacher.name} yang sempat hilang telah dibuat kembali dengan username "${username}" dan password default 12345678.`, "success");
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
      `Sinkronkan Semua Akun ${terminology.teacher}`,
      `Sistem akan memeriksa semua ${terminology.teacher.toLowerCase()} dan membuatkan akun login (users) bagi ${terminology.teacher.toLowerCase()} yang belum memilikinya. Username akan dibuat minimal 3 karakter, dan password default adalah 12345678.`,
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
                let username = (teacher.username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
                if (!username || username.length < 3) {
                  const safeName = teacher.name.split(',')[0].trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                  username = safeName;
                }
                if (!username || username.length < 3) {
                  const safeCode = (teacher.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                  username = safeCode ? `guru_${safeCode}` : `guru_${Math.floor(100 + Math.random() * 900)}`;
                }
                
                await pb.collection("users").create({
                  username: username,
                  password: defaultPass,
                  passwordConfirm: defaultPass,
                  name: teacher.name,
                  role: "teacher",
                  teacherId: teacher.id,
                  hasChangedPassword: false,
                });

                if (!teacher.username || teacher.username !== username) {
                  await pb.collection("teachers").update(teacher.id, { username });
                }
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

          let finalUsername = row.username ? row.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') : '';
          if (!finalUsername || finalUsername.length < 3) {
            finalUsername = generatedUsername;
          }
          if (!finalUsername || finalUsername.length < 3) {
            const safeCode = (row.code || generatedCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            finalUsername = safeCode ? `guru_${safeCode}` : `guru_${Math.floor(100 + Math.random() * 900)}`;
          }

          await createTeacher({
            name: row.name,
            code: row.code || generatedCode,
            username: finalUsername,
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

  const handleBatchResetPassword = async () => {
    if (selectedIds.length === 0) return;
    const targetTeachers = teachers.filter(t => selectedIds.includes(t.id));
    if (targetTeachers.length === 0) return;

    showAlert(
      `Reset Password ${terminology.teacher} Massal`,
      `Apakah Anda yakin ingin mereset password ${targetTeachers.length} ${terminology.teacher.toLowerCase()} terpilih menjadi default "12345678"?`,
      "warning",
      async () => {
        if (!pb) return;
        setBatchProgress({
          isOpen: true,
          total: targetTeachers.length,
          current: 0,
          message: "Menyiapkan reset password...",
          title: `Reset Password ${terminology.teacher} Massal`
        });

        const defaultPass = "12345678";
        let successCount = 0;
        let failCount = 0;

        try {
          let userList: any[] = [];
          try {
            userList = await pb.collection("users").getFullList({ filter: 'role = "teacher"' });
          } catch (e) {
            console.warn("Could not batch-fetch users:", e);
          }
          const userMap = new Map(userList.map(u => [u.teacherId, u]));

          const chunkSize = 5;
          for (let i = 0; i < targetTeachers.length; i += chunkSize) {
            const chunk = targetTeachers.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (teacher) => {
              try {
                const userRec = userMap.get(teacher.id);
                if (userRec) {
                  await resetUserPassword(userRec.id);
                } else {
                  let fallbackUser = null;
                  try {
                    fallbackUser = await pb.collection("users").getFirstListItem(`teacherId="${teacher.id}"`);
                  } catch (err: any) {
                    if (err.status !== 404) throw err;
                  }

                  if (fallbackUser) {
                    await resetUserPassword(fallbackUser.id);
                  } else {
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
                  }
                }
                successCount++;
              } catch (err) {
                console.error(`Gagal reset password ${teacher.name}:`, err);
                failCount++;
              }
            }));

            const processed = Math.min(i + chunkSize, targetTeachers.length);
            setBatchProgress(prev => ({
              ...prev,
              current: processed,
              message: `Mereset password ${terminology.teacher.toLowerCase()} (${processed}/${targetTeachers.length})`
            }));
          }

          if (failCount === 0) {
            showAlert("Berhasil", `Password ${successCount} ${terminology.teacher.toLowerCase()} berhasil direset menjadi 12345678.`, "success");
          } else {
            showAlert("Selesai dengan Catatan", `${successCount} akun berhasil direset, ${failCount} gagal diproses.`, "warning");
          }
          setSelectedIds([]);
        } catch (error: any) {
          console.error("Gagal reset password massal guru", error);
          showAlert("Gagal", error.message || `Gagal mereset password ${terminology.teacher.toLowerCase()} massal.`, "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
        }
      },
      true,
      "Ya, Reset Password"
    );
  };

  const defaultValues = useMemo(() => 
    selectedTeacher
      ? {
          name: selectedTeacher.name,
          code: selectedTeacher.code || "",
          username: selectedTeacher.username || "",
          email: selectedTeacher.email || "",
          phone: selectedTeacher.phone || "",
          subjects: selectedTeacher.subjects || [],
        }
      : { name: "", code: "", username: "", email: "", phone: "", subjects: [] },
  [selectedTeacher]);

  const schoolSlug = school?.slug || school?.name?.toLowerCase().replace(/\s+/g, "-") || "modalbangsa";
  const linkedAccountsCount = teachers.filter(t => t.username).length;

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
      <input
        id="teacher-import-input"
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImportTeachers(file);
          }
          e.target.value = "";
        }}
      />
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
        {/* ── Page Header Bar (Title, Breadcrumb & Primary Actions) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              Data {terminology.teacher}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <Link to="/admin" className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                Semua Modul
              </Link>
              <span>/</span>
              <span className="text-neutral-700 dark:text-neutral-300 font-medium">{schoolSlug}</span>
              <span>/</span>
              <span className="text-neutral-500 dark:text-neutral-400">master-data</span>
              <span>/</span>
              <span className="text-neutral-900 dark:text-neutral-100 font-semibold">teachers</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {loading ? (
              <>
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </>
            ) : (
              <>
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-1.5 animate-in fade-in">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 px-3 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <span>{selectedIds.length} - Aksi Masal</span>
                          <ChevronDown className="h-3 w-3 opacity-70" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60 p-1.5 rounded-xl shadow-xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0f1115] z-[100]">
                        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-2.5 py-1">
                          Aksi ({selectedIds.length} {terminology.teacher})
                        </DropdownMenuLabel>
                        
                        <DropdownMenuItem
                          onClick={handleBatchResetPassword}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                        >
                          <KeyRound className="h-4 w-4" />
                          <span>Reset Password (12345678)</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />

                        <DropdownMenuItem
                          onClick={handleBatchDelete}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash className="h-4 w-4" />
                          <span>Hapus Data {terminology.teacher}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs font-semibold border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>Opsi Data</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0f1115] z-[100]">
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-2.5 py-1">
                      Kelola {terminology.teacher}
                    </DropdownMenuLabel>
                    <DropdownMenuItem 
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      onClick={() => {
                        const input = document.getElementById("teacher-import-input") as HTMLInputElement;
                        if (input) input.click();
                      }}
                    >
                      <Upload className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                          {isImporting ? "Mengimport..." : "Import dari Excel"}
                        </span>
                        <span className="text-[10px] text-neutral-400">Unggah file data {terminology.teacher.toLowerCase()}</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleExportTeachers} 
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Export ke Excel</span>
                        <span className="text-[10px] text-neutral-400">Unduh daftar {terminology.teacher.toLowerCase()}</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
                    <DropdownMenuItem 
                      onClick={() => downloadTeacherImportTemplate()} 
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-neutral-500" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Unduh Template</span>
                        <span className="text-[10px] text-neutral-400">Format file import Excel</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
                    <DropdownMenuItem 
                      onClick={handleSyncAllUsers} 
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Sinkronkan Akun</span>
                        <span className="text-[10px] text-neutral-400">Pulihkan akun login yang hilang</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => { setSelectedTeacher(null); setIsDialogOpen(true); }}
                      size="sm"
                      className="h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Tambah {terminology.teacher}</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-neutral-800">
                    <DialogHeader>
                      <DialogTitle className="text-sm font-bold text-neutral-900 dark:text-white">
                        {dialogMode === "edit" ? `Edit Data ${terminology.teacher}` : `Tambah Data ${terminology.teacher}`}
                      </DialogTitle>
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

        {/* ── Top Stats Strip (3 Kartu Ringkas) ── */}
        <NeonStatGrid cols={3}>
          <NeonStatCard
            label={`Total ${terminology.teacher}`}
            value={String(teachers.length)}
            unit="guru"
            subText="Tenaga pendidik terdaftar"
            isLoading={loading}
          />
          <NeonStatCard
            label="Akun Login Aktif"
            value={String(linkedAccountsCount)}
            unit="akun"
            indicator={true}
            subText="Dapat login ke panel guru"
            isLoading={loading}
          />
          <NeonStatCard
            label="Total Mata Pelajaran"
            value={String(subjects.length)}
            unit="mapel"
            subText="Mapel pengampu tersedia"
            isLoading={loading}
          />
        </NeonStatGrid>

        {/* ── Main Content Grid: Table + Right Inspector ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="min-w-0 space-y-6">
            <TeacherTable 
              teachers={teachers} 
              selectedIds={selectedIds}
              onSelectChange={setSelectedIds}
              onEdit={handleEditClick} 
              onDelete={handleDeleteClick} 
              onResetPassword={handleResetPassword}
              isLoading={loading}
              activeKey={inspectedTeacher?.id}
              onRowClick={(t) => setInspectedTeacherId(t.id)}
            />
          </div>

          {/* ── Right Sidebar / Inspector Panel ── */}
          <NeonInspector>
            <InspectorSection>
              <InspectorHeader
                title={`Detail ${terminology.teacher}`}
                icon={GraduationCap}
                badge={inspectedTeacher ? "Terpilih" : "Ringkasan"}
              />

              {inspectedTeacher ? (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200/80 dark:border-neutral-800">
                    <Avatar className="h-9 w-9 border border-neutral-200 dark:border-neutral-800 shrink-0">
                      <AvatarFallback className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold font-mono text-xs">
                        {inspectedTeacher.code || (inspectedTeacher.name || "G").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-neutral-900 dark:text-neutral-100 text-xs truncate">
                        {inspectedTeacher.name}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                        @{inspectedTeacher.username || inspectedTeacher.code || "guru"}
                      </span>
                    </div>
                  </div>

                  <InspectorGrid>
                    <InspectorField
                      label="Kode Guru"
                      value={
                        <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                          {inspectedTeacher.code || "-"}
                        </span>
                      }
                    />
                    <InspectorField
                      label="Akun Login"
                      value={
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          Aktif
                        </span>
                      }
                    />
                  </InspectorGrid>

                  <InspectorField label="Kontak">
                    <div className="space-y-1 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                      {inspectedTeacher.email && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="h-3 w-3 shrink-0 text-neutral-400" />
                          <span className="truncate">{inspectedTeacher.email}</span>
                        </div>
                      )}
                      {inspectedTeacher.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 shrink-0 text-neutral-400" />
                          <span>{inspectedTeacher.phone}</span>
                        </div>
                      )}
                      {!inspectedTeacher.email && !inspectedTeacher.phone && (
                        <span className="text-neutral-400 italic">-</span>
                      )}
                    </div>
                  </InspectorField>

                  <InspectorField label={`Mata Pelajaran Pengampu (${inspectedTeacher.subjects?.length || 0})`}>
                    {inspectedTeacher.subjects && inspectedTeacher.subjects.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {inspectedTeacher.subjects.map((sub, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-750 text-neutral-700 dark:text-neutral-300"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-neutral-400 italic text-[11px]">Belum ada mapel diatur</span>
                    )}
                  </InspectorField>

                  <InspectorActions>
                    <InspectorButton
                      variant="primary"
                      icon={Edit}
                      onClick={() => handleEditClick(inspectedTeacher)}
                    >
                      Edit Data {terminology.teacher}
                    </InspectorButton>
                    <InspectorButton
                      variant="secondary"
                      icon={KeyRound}
                      onClick={() => handleResetPassword(inspectedTeacher.id)}
                    >
                      Reset Password (12345678)
                    </InspectorButton>
                    <InspectorButton
                      variant="danger"
                      icon={Trash}
                      onClick={() => handleDeleteClick(inspectedTeacher)}
                    >
                      Hapus {terminology.teacher}
                    </InspectorButton>
                  </InspectorActions>
                </div>
              ) : (
                <InspectorEmpty
                  title={`Belum ada ${terminology.teacher.toLowerCase()}`}
                  description={`Klik salah satu baris ${terminology.teacher.toLowerCase()} pada tabel untuk menginspeksi rincian.`}
                />
              )}
            </InspectorSection>

            <InspectorSection divided>
              <InspectorHeader title="Hak Akses Panel Guru" icon={Info} />
              <div className="space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
                <p>
                  Guru dapat login ke portal CBT untuk mengunggah Bank Soal, menyusun butir soal LaTeX, dan mengawasi jalannya ujian.
                </p>
                <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 text-[11px]">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 block mb-0.5">🔑 Password Default:</span>
                  Password awal guru adalah <code className="bg-neutral-200/70 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono font-bold">12345678</code>.
                </div>
              </div>
            </InspectorSection>
          </NeonInspector>
        </div>

        <ConfirmationDialog
          isOpen={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleConfirmDelete}
          type="danger"
          title={`Hapus ${terminology.teacher}`}
          description={`Apakah Anda yakin ingin menghapus data ${terminology.teacher.toLowerCase()} "${teacherToDelete?.name || ""}"? Data jadwal yang sudah dibuat menggunakan ${terminology.teacher.toLowerCase()} ini mungkin akan kehilangan referensi.`}
          confirmLabel="Hapus"
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

        <BatchProgressDialog progress={batchProgress} colorClass="bg-indigo-600" />
      </div>
    </div>
  );
};

export default TeachersPage;




