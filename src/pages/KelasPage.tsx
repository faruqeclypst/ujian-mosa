import { useState, useMemo } from "react";
import { Plus, LayoutTemplate } from "lucide-react";
import { usePiket } from "../context/PiketContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { DeleteConfirmationDialog } from "../components/ui/delete-confirmation-dialog";
import KelasForm, { KelasFormValues } from "../components/piket/KelasForm";
import KelasTable from "../components/tables/KelasTable";
import { ImportButton } from "../components/ui/import-button";
import { ExportButton } from "../components/ui/export-button";
import { ConfirmationDialog } from "../components/ui/confirmation-dialog";
import { downloadKelasImportTemplate, exportKelasToExcel, parseKelasImportExcel } from "../lib/kelasExcel";
import type { ClassData } from "../types/piket";

const KelasPage = () => {
  const { classes, loading, createClass, updateClass, deleteClass } = usePiket();
  
  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: "success" | "danger" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    description: "",
    type: "info",
  });

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info") => {
    setAlertDialog({ isOpen: true, title, description, type });
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

  const handleSubmitClass = async (values: KelasFormValues) => {
    try {
      if (dialogMode === "edit" && selectedClass) {
        await updateClass(selectedClass.id, values);
      } else {
        await createClass(values);
      }
      closeDialog();
    } catch (error) {
      console.error("Gagal menyimpan data kelas", error);
      showAlert("Gagal", "Gagal menyimpan data kelas.", "danger");
    }
  };

  const handleConfirmDelete = async () => {
    if (!classToDelete) return;
    setIsDeleting(true);
    try {
      await deleteClass(classToDelete.id);
    } catch (error) {
      console.error("Gagal menghapus kelas", error);
      showAlert("Gagal", "Gagal menghapus data kelas.", "danger");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setClassToDelete(null);
    }
  };

  const handleImportKelas = async (file: File) => {
    setIsImporting(true);
    try {
      const parsed = await parseKelasImportExcel(file);
      if (parsed.length === 0) return showAlert("File Kosong", "File yang Anda upload kosong atau tidak valid.", "warning");
      for (const row of parsed) {
        await createClass({ name: row.name });
      }
      showAlert("Import Berhasil", `${parsed.length} kelas berhasil diimport.`, "success");
    } catch (err: any) {
      showAlert("Gagal Import", err.message || "Gagal mengimport kelas.", "danger");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportKelas = () => {
    exportKelasToExcel({ classes, filename: "data-kelas.xlsx" });
  };

  const defaultValues = selectedClass ? { name: selectedClass.name } : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-blue-500" />
            Data Kelas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola daftar kelas untuk perizinan dan jadwal ujian.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateClick} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white shadow-md shadow-blue-500/10 rounded-xl" size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Tambah Kelas
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-card">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-slate-800 dark:text-white">{dialogMode === "edit" ? "Edit Data Kelas" : "Tambah Data Kelas"}</DialogTitle>
              </DialogHeader>
              <KelasForm
                defaultValues={defaultValues}
                onSubmit={handleSubmitClass}
                submitLabel={dialogMode === "edit" ? "Perbarui" : "Simpan"}
                onCancel={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <ImportButton onImport={handleImportKelas} isLoading={isImporting} />
          <ExportButton onExport={handleExportKelas} />
          <Button onClick={() => downloadKelasImportTemplate()} variant="outline" size="sm" className="rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
            Template
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <KelasTable classes={sortedClasses} onEdit={handleEditClick} onDelete={handleDeleteClick} />
      )}

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Kelas"
        description="Apakah Anda yakin ingin menghapus data kelas ini?"
        itemName={`Kelas ${classToDelete?.name || ""}`}
        isLoading={isDeleting}
      />

      <ConfirmationDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        onConfirm={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        title={alertDialog.title}
        description={alertDialog.description}
        type={alertDialog.type}
        confirmLabel="OK"
        showCancel={false}
      />
    </div>
  );
};

export default KelasPage;
