import { useState, useMemo } from "react";
import { usePiket } from "../context/PiketContext";
import { Button } from "../components/ui/button";
import { DeleteConfirmationDialog } from "../components/ui/delete-confirmation-dialog";
import SiswaTable from "../components/tables/SiswaTable";
import { ExportButton } from "../components/ui/export-button";
import { exportSiswaToExcel } from "../lib/siswaExcel";
import { ArrowLeftRight, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import FormField from "../components/forms/FormField";
import { Select } from "../components/ui/select";
import type { StudentData } from "../types/piket";

const AlumniPage = () => {
  const { students, classes, loading, deleteStudent, updateStudent, updateStudentClassBatch } = usePiket();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState<string>("");

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
    if (!window.confirm("Kembalikan siswa ini ke status Aktif (Tanpa Kelas)?")) return;
    try {
      await updateStudent(id, { classId: "" });
    } catch (err) {
      console.error(err);
    }
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
      alert("Gagal memindahkan alumni.");
    }
  };

  const handleBatchRestore = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Kembalikan ${selectedIds.length} alumni ini ke status Aktif (Tanpa Kelas)?`)) return;
    try {
      await updateStudentClassBatch(selectedIds, "");
      setSelectedIds([]);
    } catch (error) {
      console.error("Gagal memulihkan alumni", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Data Alumni</h2>
          <p className="text-sm text-muted-foreground">Daftar siswa yang sudah lulus atau menyelesaikan pendidikan.</p>
        </div>
        <div>
          <ExportButton onExport={() => exportSiswaToExcel({ students: mappedStudents, filename: "data-alumni.xlsx" })} />
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
        <SiswaTable 
          students={mappedStudents} 
          selectedIds={selectedIds} 
          onSelectChange={setSelectedIds} 
          onEdit={() => {}} 
          onDelete={handleDeleteClick} 
          customActions={(student) => (
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="hover:bg-green-50 hover:text-green-600 h-8 text-xs font-medium"
                onClick={() => handleRestore(student.id)}
              >
                Pulihkan
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200 h-8 text-xs font-medium"
                onClick={() => handleDeleteClick(student)}
              >
                Hapus
              </Button>
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
    </div>
  );
};

export default AlumniPage;
