import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { useExamData } from "../context/ExamDataContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { DeleteConfirmationDialog } from "../components/ui/delete-confirmation-dialog";
import StudentForm, { StudentFormValues } from "../components/exam/StudentForm";
import StudentTable from "../components/tables/StudentTable";
import { ImportButton } from "../components/ui/import-button";
import { ExportButton } from "../components/ui/export-button";
import { ConfirmationDialog } from "../components/ui/confirmation-dialog";
import { downloadStudentImportTemplate, exportStudentToExcel, parseStudentImportExcel } from "../lib/studentExcel";
import type { StudentData } from "../types/exam";

const StudentsPage = () => {
  const { students, classes, loading, createStudent, updateStudent, deleteStudent } = useExamData();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
      const parsed = await parseStudentImportExcel(file, classes);
      if (parsed.length === 0) return showAlert("File Kosong", "File yang Anda upload kosong atau tidak valid.", "warning");
      
      // Validasi NISN Duplikat
      const existingNisns = students.map(s => s.nisn);
      const newEntries = parsed.filter((p: any) => !existingNisns.includes(String(p.nisn)));
      
      if (newEntries.length === 0) {
        return showAlert("Batal", "Semua NISN di file sudah terdaftar.", "warning");
      }

      for (const row of newEntries) {
        await createStudent({
          nisn: String(row.nisn),
          name: row.name,
          classId: row.classId,
        });
      }
      showAlert("Import Berhasil", `${newEntries.length} Siswa berhasil diimport.`, "success");
    } catch (err: any) {
      showAlert("Gagal Import", err.message || "Gagal mengimport data Siswa.", "danger");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportStudents = () => {
    exportStudentToExcel({ students, classes, filename: "data-siswa.xlsx" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Data Siswa
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola daftar Siswa aktif dan penempatan kelas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportButton onImport={handleImportStudents} isLoading={isImporting} />
          <ExportButton onExport={handleExportStudents} />
          <Button onClick={() => downloadStudentImportTemplate()} variant="secondary" size="sm" className="rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:hover:bg-slate-900/50 dark:border-slate-800/40 text-slate-600 font-semibold shadow-sm">
            Template
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateClick} size="sm" className="rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-semibold shadow-sm">
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
                defaultValues={selectedStudent ? {
                  nisn: selectedStudent.nisn,
                  name: selectedStudent.name,
                  classId: selectedStudent.classId
                } : undefined}
                onSubmit={handleSubmitStudent}
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
        <StudentTable 
          students={students} 
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
        title="Hapus Siswa"
        description="Apakah Anda yakin ingin menghapus data Siswa ini? Riwayat ujian Siswa ini juga mungkin tidak akan terbaca dengan benar."
        itemName={`Siswa ${studentToDelete?.name || ""}`}
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

export default StudentsPage;

