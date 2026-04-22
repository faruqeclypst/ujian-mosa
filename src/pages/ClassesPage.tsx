import { useState, useMemo } from "react";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { 
  Plus, 
  Trash, 
  Loader2, 
  LayoutGrid, 
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
import ClassForm, { ClassFormValues } from "../components/exam/ClassForm";
import ClassTable from "../components/tables/ClassTable";
import { ImportButton } from "../components/ui/import-button";
import { ExportButton } from "../components/ui/export-button";
import { ConfirmationDialog } from "../components/ui/confirmation-dialog";
import { downloadClassImportTemplate, exportClassToExcel, parseClassImportExcel } from "../lib/classExcel";
import type { ClassData } from "../types/exam";

const ClassesPage = () => {
  const { classes, loading, createClass, updateClass, deleteClass } = useExamData();
  const { terminology } = useTenant();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassData | null>(null);
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
    setSelectedClass(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (cls: ClassData) => {
    setDialogMode("edit");
    setSelectedClass(cls);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (cls: ClassData) => {
    setClassToDelete(cls);
    setDeleteDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedClass(null);
  };

  const handleSubmitClass = async (values: ClassFormValues) => {
    try {
      if (dialogMode === "edit" && selectedClass) {
        await updateClass(selectedClass.id, values);
      } else {
        await createClass(values);
      }
      closeDialog();
    } catch (error) {
      console.error(`Gagal menyimpan data ${terminology.class.toLowerCase()}`, error);
      showAlert("Gagal", `Gagal menyimpan data ${terminology.class.toLowerCase()}.`, "danger");
    }
  };

  const handleConfirmDelete = async () => {
    if (!classToDelete) return;
    setIsDeleting(true);
    try {
      await deleteClass(classToDelete.id);
    } catch (error) {
      console.error(`Gagal menghapus ${terminology.class.toLowerCase()}`, error);
      showAlert("Gagal", `Gagal menghapus data ${terminology.class.toLowerCase()}.`, "danger");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setClassToDelete(null);
    }
  };

  const handleImportClasses = async (file: File) => {
    setIsImporting(true);
    try {
      const parsed = await parseClassImportExcel(file);
      if (parsed.length === 0) return showAlert("File Kosong", "File yang Anda upload kosong atau tidak valid.", "warning");
      for (const row of parsed) {
        await createClass({ name: row.name });
      }
      showAlert("Import Berhasil", `${parsed.length} ${terminology.class.toLowerCase()} berhasil diimport.`, "success");
    } catch (err: any) {
      showAlert("Gagal Import", err.message || `Gagal mengimport data ${terminology.class.toLowerCase()}.`, "danger");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportClasses = () => {
    exportClassToExcel({ classes, filename: `data-${terminology.class.toLowerCase()}.xlsx` });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    showAlert(
      `Hapus ${terminology.class} Massal`,
      `Apakah Anda yakin ingin menghapus ${selectedIds.length} ${terminology.class.toLowerCase()} terpilih?`,
      "danger",
      async () => {
        setBatchProgress({
          isOpen: true,
          total: selectedIds.length,
          current: 0,
          message: "Menyiapkan penghapusan...",
          title: `Hapus ${terminology.class} Massal`
        });
        
        try {
          const chunkSize = 10;
          for (let i = 0; i < selectedIds.length; i += chunkSize) {
            const chunk = selectedIds.slice(i, i + chunkSize);
            await Promise.all(chunk.map(id => deleteClass(id)));
            
            const currentProcessed = Math.min(i + chunkSize, selectedIds.length);
            setBatchProgress(prev => ({
              ...prev,
              current: currentProcessed,
              message: `Menghapus data ${terminology.class.toLowerCase()} (${currentProcessed}/${selectedIds.length})`
            }));
          }
          setSelectedIds([]);
        } catch (error) {
          console.error(`Gagal menghapus ${terminology.class.toLowerCase()} massal`, error);
          showAlert("Gagal", `Gagal menghapus ${terminology.class.toLowerCase()} massal.`, "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
        }
      },
      true,
      "Ya, Hapus Semua"
    );
  };

  const defaultValues = useMemo(() => 
    selectedClass ? { name: selectedClass.name } : { name: "" }, 
  [selectedClass]);

  return (
    <div className="space-y-5">
      <div className="relative z-30 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-indigo-500" />
            Daftar {terminology.class}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola daftar {terminology.class.toLowerCase()} untuk pengelompokan {terminology.student.toLowerCase()}.</p>
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
              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2 text-left">Kelola {terminology.class}</DropdownMenuLabel>
              <DropdownMenuItem 
                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                onClick={() => {
                  const input = document.getElementById("class-import-input") as HTMLInputElement;
                  if (input) input.click();
                }}
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">
                    {isImporting ? "Mengimport..." : "Import dari Excel"}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">Unggah file data {terminology.class.toLowerCase()}</span>
                </div>
                <input
                  id="class-import-input"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportClasses(file);
                    e.target.value = "";
                  }}
                />
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleExportClasses} 
                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Download className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Export ke Excel</span>
                  <span className="text-[10px] text-slate-400 mt-1">Unduh daftar {terminology.class.toLowerCase()}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
              <DropdownMenuItem 
                onClick={() => downloadClassImportTemplate()} 
                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Unduh Template</span>
                  <span className="text-[10px] text-slate-400 mt-1">Format file import Excel {terminology.class.toLowerCase()}</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setSelectedClass(null); setIsDialogOpen(true); }} size="sm" className="rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-bold shadow-sm h-9 px-4">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Tambah {terminology.class}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-card">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-slate-800 dark:text-white">{dialogMode === "edit" ? `Edit Data ${terminology.class}` : `Tambah Data ${terminology.class}`}</DialogTitle>
              </DialogHeader>
              <ClassForm
                defaultValues={defaultValues}
                onSubmit={handleSubmitClass}
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
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar {terminology.class}</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead className="w-16 text-center">No</TableHead>
                      <TableHead>Nama {terminology.class}</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
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
        <ClassTable 
          classes={classes} 
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          onEdit={handleEditClick} 
          onDelete={handleDeleteClick} 
        />
      )}

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title={`Hapus ${terminology.class}`}
        description={`Apakah Anda yakin ingin menghapus data ${terminology.class.toLowerCase()} ini?`}
        itemName={`${terminology.class} ${classToDelete?.name || ""}`}
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

export default ClassesPage;


