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
      alert("Gagal menyimpan data kelas.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!classToDelete) return;
    setIsDeleting(true);
    try {
      await deleteClass(classToDelete.id);
    } catch (error) {
      console.error("Gagal menghapus kelas", error);
      alert("Gagal menghapus kelas.");
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
      if (parsed.length === 0) return alert("File kosong!");
      for (const row of parsed) {
        await createClass({ name: row.name });
      }
      alert(`${parsed.length} kelas berhasil diimport.`);
    } catch (err: any) {
      alert(err.message || "Gagal mengimport kelas.");
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
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Data Kelas</h2>
          <p className="text-sm text-muted-foreground">Kelola daftar kelas untuk perizinan dan jadwal piket.</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateClick} className="w-full sm:w-auto" size="lg">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Kelas
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{dialogMode === "edit" ? "Edit Data Kelas" : "Tambah Data Kelas"}</DialogTitle>
              </DialogHeader>
              <KelasForm
                defaultValues={defaultValues}
                onSubmit={handleSubmitClass}
                submitLabel={dialogMode === "edit" ? "Perbarui" : "Simpan"}
              />
            </DialogContent>
          </Dialog>
          <ImportButton onImport={handleImportKelas} isLoading={isImporting} />
          <ExportButton onExport={handleExportKelas} />
          <Button onClick={() => downloadKelasImportTemplate()} variant="outline">
            Download Template
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
    </div>
  );
};

export default KelasPage;
