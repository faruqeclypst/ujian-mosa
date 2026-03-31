import { useState, useMemo } from "react";
import { useExamData } from "../context/ExamDataContext";
import { Button } from "../components/ui/button";
import { DeleteConfirmationDialog } from "../components/ui/delete-confirmation-dialog";
import { ConfirmationDialog } from "../components/ui/confirmation-dialog";
import StudentTable from "../components/tables/StudentTable";
import { ExportButton } from "../components/ui/export-button";
import { exportStudentToExcel } from "../lib/studentExcel";
import { ArrowLeftRight, Check, X, RotateCw, Trash, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import FormField from "../components/forms/FormField";
import { Select } from "../components/ui/select";
import type { StudentData } from "../types/exam";

const AlumniPage = () => {
  const { students, classes, loading, deleteStudent, updateStudent, updateStudentClassBatch } = useExamData();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState<string>("");

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

  const mappedStudents = useMemo(() => {
    return students
      .filter((s) => s.classId === "ALUMNI")
      .map((s) => ({ ...s, className: "Alumni / Lulus" }));
  }, [students]);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);

  const handleDeleteClick = (std: StudentData) => {
    setStudentToDelete(std);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      await deleteStudent(studentToDelete.id);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
    }
  };

  const handleRestore = async (id: string) => {
    showAlert(
      "Pulihkan student",
      "Kembalikan student ini ke status Aktif (Tanpa Kelas)?",
      "warning",
      async () => {
        try {
          await updateStudent(id, { classId: "" });
        } catch (err) {
          console.error(err);
          showAlert("Gagal", "Gagal memulihkan student.", "danger");
        }
      },
      true,
      "Ya, Pulihkan"
    );
  };

  const handleBatchUpdateClass = async () => {
    if (!targetClassId || selectedIds.length === 0) return;
    try {
      await updateStudentClassBatch(selectedIds, targetClassId);
      setIsBatchOpen(false);
      setSelectedIds([]);
      setTargetClassId("");
    } catch (error) {
      console.error("Gagal memindahkan alumni", error);
      showAlert("Gagal", "Gagal memindahkan alumni.", "danger");
    }
  };

  const handleBatchRestore = async () => {
    if (selectedIds.length === 0) return;
    showAlert(
      "Pulihkan Alumni Massal",
      `Kembalikan ${selectedIds.length} alumni ini ke status Aktif (Tanpa Kelas)?`,
      "warning",
      async () => {
        try {
          await updateStudentClassBatch(selectedIds, "");
          setSelectedIds([]);
        } catch (error) {
          console.error("Gagal memulihkan alumni", error);
          showAlert("Gagal", "Gagal memulihkan alumni.", "danger");
        }
      },
      true,
      "Ya, Pulihkan"
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Data Alumni
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Daftar Siswa yang sudah lulus atau menyelesaikan pendidikan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton onExport={() => exportStudentToExcel({ students: mappedStudents, classes, filename: "data-alumni.xlsx" })} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {selectedIds.length > 0 && (
            <>
              <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
                <DialogTrigger asChild>
                  <Button variant="default" className="bg-orange-600 hover:bg-orange-700 h-9 text-xs">
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Pindah/Kembalikan ke Kelas ({selectedIds.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Kembalikan ke Kelas</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Pindahkan {selectedIds.length} alumni terpilih ke kelas tujuan.
                  </p>
                  
                  <div className="space-y-4 pt-4">
                    <FormField id="batch-class" label="Kelas Tujuan">
                      <Select value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)}>
                        <option value="">Pilih Kelas Tujuan</option>
                        {sortedClasses.map((cls) => (
                          <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                      </Select>
                    </FormField>
                    
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setIsBatchOpen(false)}>Batal</Button>
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleBatchUpdateClass} disabled={!targetClassId}>
                        Proses
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button 
                variant="outline" 
                size="sm" 
                className="hover:bg-green-50 hover:text-green-600 h-9 text-xs border-dashed border-green-200"
                onClick={handleBatchRestore}
              >
                <Check className="mr-1 w-4 h-4" /> Pulihkan Tanpa Kelas
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <StudentTable 
          students={mappedStudents} 
          classes={classes}
          selectedIds={selectedIds} 
          onSelectChange={setSelectedIds} 
          onEdit={() => {}} 
          onDelete={handleDeleteClick} 
          customActions={(student) => (
            <div className="flex justify-end gap-2">
              <button 
                className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg dark:bg-emerald-900/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40"
                onClick={() => handleRestore(student.id)}
                title="Pulihkan student"
              >
                <RotateCw className="h-4 w-4" />
              </button>
              <button 
                className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg dark:bg-rose-900/10 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40"
                onClick={() => handleDeleteClick(student)}
                title="Hapus student"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
          )}
        />
      )}

      <DeleteConfirmationDialog 
        isOpen={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)} 
        onConfirm={handleConfirmDelete} 
        title="Hapus Alumni" 
        description="Apakah Anda yakin ingin menghapus data alumni ini?" 
        itemName={studentToDelete?.name || ""} 
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
    </div>
  );
};

export default AlumniPage;





