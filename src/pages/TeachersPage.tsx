import { useState, useMemo } from "react";
import { Plus, Users } from "lucide-react";
import { useExamData } from "../context/ExamDataContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { DeleteConfirmationDialog } from "../components/ui/delete-confirmation-dialog";
import TeacherForm, { TeacherSubmitPayload } from "../components/exam/TeacherForm";
import TeacherTable from "../components/tables/TeacherTable";
import { ImportButton } from "../components/ui/import-button";
import { ExportButton } from "../components/ui/export-button";
import { ConfirmationDialog } from "../components/ui/confirmation-dialog";
import { downloadTeacherImportTemplate, exportTeacherToExcel, parseTeacherImportExcel } from "../lib/teacherExcel";
import type { Teacher } from "../types/exam";

const TeachersPage = () => {
  const { teachers, loading, createTeacher, updateTeacher, deleteTeacher } = useExamData();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
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
      console.error("Gagal menyimpan data guru", error);
      showAlert("Gagal", "Gagal menyimpan data guru.", "danger");
    }
  };

  const handleConfirmDelete = async () => {
    if (!teacherToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTeacher(teacherToDelete.id);
    } catch (error) {
      console.error("Gagal menghapus guru", error);
      showAlert("Gagal", "Gagal menghapus data guru.", "danger");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setTeacherToDelete(null);
    }
  };

  const handleImportGuru = async (file: File) => {
    setIsImporting(true);
    try {
      const parsed = await parseTeacherImportExcel(file);
      if (parsed.length === 0) return showAlert("File Kosong", "File yang Anda upload kosong atau tidak valid.", "warning");
      for (const row of parsed) {
        await createTeacher({
          name: row.name,
          code: row.code,
          subjects: row.subjects,
        });
      }
      showAlert("Import Berhasil", `${parsed.length} guru berhasil diimport.`, "success");
    } catch (err: any) {
      showAlert("Gagal Import", err.message || "Gagal mengimport data guru.", "danger");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportGuru = () => {
    exportTeacherToExcel({ teachers, filename: "data-guru.xlsx" });
  };

  const defaultValues = useMemo(() => 
    selectedTeacher
      ? {
          name: selectedTeacher.name,
          code: selectedTeacher.code || "",
          subjects: selectedTeacher.subjects || [],
        }
      : { name: "", code: "", subjects: [] },
  [selectedTeacher]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-500" />
            Data Guru
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola daftar guru dan mata pelajaran pengampu.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportButton onImport={handleImportGuru} isLoading={isImporting} />
          <ExportButton onExport={handleExportGuru} />
          <Button onClick={() => downloadTeacherImportTemplate()} variant="secondary" size="sm" className="rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:hover:bg-slate-900/50 dark:border-slate-800/40 text-slate-600 font-semibold shadow-sm">
            Template
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateClick} size="sm" className="rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-semibold shadow-sm">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Tambah Guru
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-card">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-slate-800 dark:text-white">{dialogMode === "edit" ? "Edit Data Guru" : "Tambah Data Guru"}</DialogTitle>
              </DialogHeader>
              <TeacherForm
                defaultValues={defaultValues}
                onSubmit={handleSubmitTeacher}
                submitLabel={dialogMode === "edit" ? "Perbarui" : "Simpan"}
                onCancel={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <TeacherTable teachers={teachers} onEdit={handleEditClick} onDelete={handleDeleteClick} />
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

export default TeachersPage;




