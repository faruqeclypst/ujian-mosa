import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { usePiket } from "../context/PiketContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { DeleteConfirmationDialog } from "../components/ui/delete-confirmation-dialog";
import GuruForm, { GuruSubmitPayload } from "../components/piket/GuruForm";
import GuruTable from "../components/tables/GuruTable";
import { ImportButton } from "../components/ui/import-button";
import { ExportButton } from "../components/ui/export-button";
import { downloadGuruImportTemplate, exportGuruToExcel, parseGuruImportExcel } from "../lib/guruExcel";
import type { Teacher } from "../types/piket";

const GuruPage = () => {
  const { teachers, loading, createTeacher, updateTeacher, deleteTeacher } = usePiket();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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

  const handleSubmitTeacher = async (values: GuruSubmitPayload) => {
    try {
      if (dialogMode === "edit" && selectedTeacher) {
        await updateTeacher(selectedTeacher.id, values);
      } else {
        await createTeacher(values);
      }
      closeDialog();
    } catch (error) {
      console.error("Gagal menyimpan data guru", error);
      alert("Gagal menyimpan data guru.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!teacherToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTeacher(teacherToDelete.id);
    } catch (error) {
      console.error("Gagal menghapus guru", error);
      alert("Gagal menghapus guru.");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setTeacherToDelete(null);
    }
  };

  const handleImportGuru = async (file: File) => {
    setIsImporting(true);
    try {
      const parsed = await parseGuruImportExcel(file);
      if (parsed.length === 0) return alert("File kosong!");
      for (const row of parsed) {
        await createTeacher({
          name: row.name,
          code: row.code,
          subjects: row.subjects,
        });
      }
      alert(`${parsed.length} guru berhasil diimport.`);
    } catch (err: any) {
      alert(err.message || "Gagal mengimport data guru.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportGuru = () => {
    exportGuruToExcel({ teachers, filename: "data-guru.xlsx" });
  };

  const defaultValues = selectedTeacher
    ? {
        name: selectedTeacher.name,
        code: selectedTeacher.code || "",
        subjects: selectedTeacher.subjects || [],
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Data Guru</h2>
          <p className="text-sm text-muted-foreground">Kelola daftar guru dan mata pelajaran utama.</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateClick} className="w-full sm:w-auto" size="lg">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Guru
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{dialogMode === "edit" ? "Edit Data Guru" : "Tambah Data Guru"}</DialogTitle>
              </DialogHeader>
              <GuruForm
                defaultValues={defaultValues}
                onSubmit={handleSubmitTeacher}
                submitLabel={dialogMode === "edit" ? "Perbarui" : "Simpan"}
              />
            </DialogContent>
          </Dialog>
          <ImportButton onImport={handleImportGuru} isLoading={isImporting} />
          <ExportButton onExport={handleExportGuru} />
          <Button onClick={() => downloadGuruImportTemplate()} variant="outline">
            Download Template
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <GuruTable teachers={teachers} onEdit={handleEditClick} onDelete={handleDeleteClick} />
      )}

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Guru"
        description="Apakah Anda yakin ingin menghapus data guru ini? Data jadwal yang sudah dibuat menggunakan guru ini mungkin akan kehilangan referensi."
        itemName={`Guru ${teacherToDelete?.name || ""}`}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default GuruPage;
