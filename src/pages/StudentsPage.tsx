import { useState, useMemo } from "react";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Plus, Users, ArrowLeftRight, Trash2, Check } from "lucide-react";
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
import FormField from "../components/forms/FormField";
import { Select } from "../components/ui/select";
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

  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [filterClassId, setFilterClassId] = useState<string>("ALL");

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
      const { results, skipped } = await parseStudentImportExcel(file, classes);
      
      if (results.length === 0 && skipped.length === 0) {
        return showAlert("File Kosong", "File yang Anda upload kosong atau tidak valid.", "warning");
      }
      
      // Validasi NISN Duplikat
      const existingNisns = students.map(s => s.nisn);
      const newEntries = results.filter((p: any) => !existingNisns.includes(String(p.nisn)));
      const duplicatesCount = results.length - newEntries.length;
      
      if (newEntries.length === 0 && skipped.length === 0) {
        return showAlert("Batal", `Semua NISN di file (${results.length}) sudah terdaftar.`, "warning");
      }

      for (const row of newEntries) {
        await createStudent({
          nisn: String(row.nisn),
          name: row.name,
          gender: row.gender,
          classId: row.classId,
        });
      }

      let message = `${newEntries.length} Siswa berhasil diimport.`;
      if (duplicatesCount > 0) message += ` ${duplicatesCount} data dilewati karena NISN duplikat.`;
      if (skipped.length > 0) {
        message += ` ${skipped.length} data gagal karena Nama Kelas tidak ditemukan di sistem.`;
      }
      
      showAlert("Import Selesai", message, skipped.length > 0 ? "warning" : "success");
    } catch (err: any) {
      showAlert("Gagal Import", err.message || "Gagal mengimport data Siswa.", "danger");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportStudents = () => {
    exportStudentToExcel({ students, classes, filename: "data-siswa.xlsx" });
  };

  const defaultValues = useMemo(() => 
    selectedStudent ? {
      nisn: selectedStudent.nisn,
      name: selectedStudent.name,
      gender: selectedStudent.gender,
      classId: selectedStudent.classId
    } : { nisn: "", name: "", gender: "L" as const, classId: "" }, 
  [selectedStudent]);

  const filteredStudents = useMemo(() => {
    if (filterClassId === "ALL") return students;
    if (filterClassId === "NONE") return students.filter(s => !s.classId);
    return students.filter(s => s.classId === filterClassId);
  }, [students, filterClassId]);

  const { updateStudentClassBatch, deleteStudentsBatch } = useExamData();

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);

  const handleBatchUpdateClass = async () => {
    if (!targetClassId || selectedIds.length === 0) return;
    try {
      await updateStudentClassBatch(selectedIds, targetClassId);
      setIsBatchOpen(false);
      setSelectedIds([]);
      setTargetClassId("");
    } catch (error) {
      console.error("Gagal memindahkan siswa", error);
      showAlert("Gagal", "Gagal memindahkan siswa.", "danger");
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    showAlert(
      "Hapus Siswa Massal",
      `Apakah Anda yakin ingin menghapus ${selectedIds.length} siswa terpilih? Tindakan ini tidak dapat dibatalkan.`,
      "danger",
      async () => {
        try {
          await deleteStudentsBatch(selectedIds);
          setSelectedIds([]);
        } catch (error) {
          console.error("Gagal menghapus siswa massal", error);
          showAlert("Gagal", "Gagal menghapus siswa massal.", "danger");
        }
      },
      true,
      "Ya, Hapus Semua"
    );
  };

  const handleMoveToAlumni = async () => {
    if (selectedIds.length === 0) return;
    showAlert(
      "Pindahkan ke Alumni",
      `Pindahkan ${selectedIds.length} siswa terpilih ke daftar Alumni (Lulus)?`,
      "warning",
      async () => {
        try {
          await updateStudentClassBatch(selectedIds, "ALUMNI");
          setSelectedIds([]);
        } catch (error) {
          console.error("Gagal memindahkan ke alumni", error);
          showAlert("Gagal", "Gagal memindahkan ke alumni.", "danger");
        }
      },
      true,
      "Ya, Pindahkan"
    );
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
                defaultValues={defaultValues}
                onSubmit={handleSubmitStudent}
                submitLabel={dialogMode === "edit" ? "Perbarui" : "Simpan"}
                onCancel={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
            <DialogTrigger asChild>
              <Button variant="default" className="bg-orange-600 hover:bg-orange-700 h-9 text-xs">
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Pindah Kelas ({selectedIds.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Pindah Kelas Masal</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Pindahkan {selectedIds.length} siswa terpilih ke kelas tujuan.
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
            className="bg-emerald-600 hover:bg-emerald-700 h-9 text-xs"
            onClick={handleMoveToAlumni}
          >
            <Check className="mr-2 h-4 w-4" />
            Luluskan / Ke Alumni
          </Button>

          <Button 
            variant="ghost" 
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-9 text-xs"
            onClick={handleBatchDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Hapus ({selectedIds.length})
          </Button>
        </div>
      )}

      {loading ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b mb-4">
            <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Daftar Siswa</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead className="w-[40px] text-center">
                         <div className="h-4 w-4 border border-slate-300 rounded mx-auto" />
                      </TableHead>
                      <TableHead className="w-[60px] text-center">No</TableHead>
                      <TableHead>NISN</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead className="w-[60px] text-center">L/P</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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
        <StudentTable 
          students={filteredStudents} 
          classes={classes} 
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          onEdit={handleEditClick} 
          onDelete={handleDeleteClick} 
          filterActions={
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">Kelas:</span>
              <select
                value={filterClassId}
                onChange={(e) => setFilterClassId(e.target.value)}
                className="h-9 min-w-[140px] rounded-xl border border-slate-200 bg-card px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer dark:border-slate-800"
              >
                <option value="ALL">Semua Kelas</option>
                <option value="NONE">Tanpa Kelas</option>
                <optgroup label="Daftar Kelas">
                  {sortedClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          }
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

export default StudentsPage;

