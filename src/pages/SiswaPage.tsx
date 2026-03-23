import { useState, useMemo } from "react";
import { Plus, Users, ArrowLeftRight, SlidersHorizontal, ChevronDown } from "lucide-react";
import { usePiket } from "../context/PiketContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { DeleteConfirmationDialog } from "../components/ui/delete-confirmation-dialog";
import SiswaForm, { SiswaFormValues } from "../components/piket/SiswaForm";
import SiswaTable from "../components/tables/SiswaTable";
import { ImportButton } from "../components/ui/import-button";
import { ExportButton } from "../components/ui/export-button";
import { downloadSiswaImportTemplate, exportSiswaToExcel, parseSiswaImportExcel } from "../lib/siswaExcel";
import type { StudentData } from "../types/piket";
import { Select } from "../components/ui/select";
import FormField from "../components/forms/FormField";

const SiswaPage = () => {
  const { 
    students, 
    classes, 
    loading, 
    createStudent, 
    updateStudent, 
    deleteStudent, 
    updateStudentClassBatch 
  } = usePiket();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Batch Operations State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [filterClassId, setFilterClassId] = useState<string>("");

  const [isImporting, setIsImporting] = useState(false);

  const mappedStudents = useMemo(() => {
    const filtered = filterClassId 
      ? students.filter(s => s.classId === filterClassId) 
      : students.filter(s => s.classId !== "ALUMNI");

    return filtered.map((s) => {
      if (s.classId === "ALUMNI") {
        return { ...s, className: "Alumni / Lulus" };
      }
      const cls = classes.find((c) => c.id === s.classId);
      return {
        ...s,
        className: cls ? cls.name : "Tanpa Kelas",
      };
    });
  }, [students, classes, filterClassId]);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedStudent(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (std: StudentData) => {
    setDialogMode("edit");
    setSelectedStudent(std);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (std: StudentData) => {
    setStudentToDelete(std);
    setDeleteDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedStudent(null);
  };

  const handleSubmitStudent = async (values: SiswaFormValues) => {
    try {
      if (dialogMode === "edit" && selectedStudent) {
        await updateStudent(selectedStudent.id, values);
      } else {
        await createStudent(values);
      }
      closeDialog();
    } catch (error) {
      console.error("Gagal menyimpan data siswa", error);
      alert("Gagal menyimpan data siswa.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      await deleteStudent(studentToDelete.id);
    } catch (error) {
      console.error("Gagal menghapus siswa", error);
      alert("Gagal menghapus siswa.");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
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
      console.error("Gagal melakukan pemindahan siswa", error);
      alert("Gagal melakukan pemindahan siswa.");
    }
  };

  const handleImportSiswa = async (file: File) => {
    setIsImporting(true);
    try {
      const parsed = await parseSiswaImportExcel(file, classes);
      if (parsed.length === 0) return alert("File kosong atau format kelas tidak sesuai!");
      
      const fileNisns = parsed.map((p) => p.nisn);
      const hasDuplicateInFile = fileNisns.some((n, i) => fileNisns.indexOf(n) !== i);
      if (hasDuplicateInFile) {
        return alert("Import Gagal: Terdapat NISN ganda di dalam file Excel!");
      }

      const existingNisns = students.map((s) => s.nisn);
      const duplicateWithDB = parsed.filter((p) => existingNisns.includes(p.nisn));
      if (duplicateWithDB.length > 0) {
        return alert(`Import Gagal: NISN berikut sudah terdaftar di sistem:\n${duplicateWithDB.map((d) => d.nisn).join(", ")}`);
      }

      for (const row of parsed) {
        await createStudent({
          nisn: row.nisn,
          name: row.name,
          gender: row.gender,
          classId: row.classId,
        });
      }
      alert(`${parsed.length} siswa berhasil diimport.`);
    } catch (err: any) {
      alert(err.message || "Gagal mengimport siswa.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportSiswa = () => {
    exportSiswaToExcel({ students: mappedStudents, filename: "data-siswa.xlsx" });
  };

  const defaultValues = selectedStudent 
    ? { 
        nisn: selectedStudent.nisn, 
        name: selectedStudent.name, 
        gender: selectedStudent.gender, 
        classId: selectedStudent.classId 
      } 
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Data Siswa</h2>
          <p className="text-sm text-muted-foreground">Kelola daftar siswa pada sekolah untuk perizinan.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateClick} className="w-full sm:w-auto" size="lg">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Siswa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{dialogMode === "edit" ? "Edit Data Siswa" : "Tambah Data Siswa"}</DialogTitle>
              </DialogHeader>
              <SiswaForm
                classes={classes}
                defaultValues={defaultValues}
                onSubmit={handleSubmitStudent}
                submitLabel={dialogMode === "edit" ? "Perbarui" : "Simpan"}
              />
            </DialogContent>
          </Dialog>

          <ImportButton onImport={handleImportSiswa} isLoading={isImporting} />
          <ExportButton onExport={handleExportSiswa} />
          <Button onClick={() => downloadSiswaImportTemplate()} variant="outline">
            Download Template
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {selectedIds.length > 0 && (
            <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
              <DialogTrigger asChild>
                <Button variant="default" className="bg-orange-600 hover:bg-orange-700">
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Pindah / Naik Kelas ({selectedIds.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Pindah / Naik Kelas Massal</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Pindahkan {selectedIds.length} siswa terpilih ke kelas tujuan.
                </p>
                
                <div className="space-y-4 pt-4">
                  <FormField id="batch-class" label="Kelas Tujuan">
                    <Select value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)}>
                      <option value="">Pilih Kelas Tujuan</option>
                      <option value="ALUMNI">🎓 Alumni / Lulus</option>
                      {sortedClasses.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
                    onClick={handleBatchUpdateClass}
                    disabled={!targetClassId}
                  >
                    Terapkan Pemindahan
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
          onEdit={handleEditClick} 
          onDelete={handleDeleteClick} 
          filterActions={
            <div className="relative">
              <select 
                value={filterClassId} 
                onChange={(e) => setFilterClassId(e.target.value)} 
                className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
              >
                <option value="">Semua Rombel</option>
                {sortedClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" className="shrink-0 flex items-center gap-1 h-8 sm:h-9">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs sm:text-sm font-medium">
                  {filterClassId ? sortedClasses.find(c => c.id === filterClassId)?.name : "Rombel"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50 ml-0.5" />
              </Button>
            </div>
          }
        />
      )}

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Siswa"
        description="Apakah Anda yakin ingin menghapus data siswa ini?"
        itemName={`Siswa ${studentToDelete?.name || ""}`}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default SiswaPage;
