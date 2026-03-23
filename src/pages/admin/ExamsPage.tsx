import { useState, useEffect } from "react";
import { Plus, BookOpen, Trash, Edit, Archive, RotateCw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { DeleteConfirmationDialog } from "../../components/ui/delete-confirmation-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ref, onValue, push, update, remove } from "firebase/database";
import { database } from "../../lib/firebase";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { useNavigate } from "react-router-dom";
import { usePiket } from "../../context/PiketContext";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";

import { DataTable } from "../../components/ui/data-table";

export interface ExamData {
  id: string;
  title: string;
  subjectId: string;
  teacherId: string;
  createdAt: number;
}

const columns = [
  {
    key: "index",
    label: "No",
    render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
  },
  {
    key: "title",
    label: "Judul Ujian",
    sortable: true,
    render: (v: string) => <span className="font-medium text-slate-800 dark:text-slate-100">{v}</span>
  },
  {
    key: "subjectName",
    label: "Mata Pelajaran",
    sortable: true,
  },
  {
    key: "teacherName",
    label: "Guru Pengampu",
    sortable: true,
  }
];

const ExamsPage = () => {
  const navigate = useNavigate();
  const { mapels, teachers } = usePiket();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"aktif" | "arsip">("aktif");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedExam, setSelectedExam] = useState<ExamData | null>(null);

  const [formValues, setFormValues] = useState({ title: "", subjectId: "", teacherId: "" });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<ExamData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: "info" | "warning" | "danger" | "success";
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    type: "info",
    confirmLabel: "Konfirmasi",
    onConfirm: () => {}
  });

  const handleArchiveExam = (exam: any) => {
    setConfirmDialog({
      isOpen: true,
      title: "Arsipkan Bank Soal",
      description: `Apakah Anda yakin ingin mengarsipkan bank soal "${exam.title}"?`,
      type: "warning",
      confirmLabel: "Arsipkan",
      onConfirm: async () => {
        try {
          await update(ref(database, `exams/${exam.id}`), { status: "archive" });
        } catch (e) { 
          showAlert("Gagal", "Gagal mengarsipkan bank soal.", "danger");
        }
      }
    });
  };

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info") => {
    setConfirmDialog({
      isOpen: true,
      title,
      description,
      type,
      confirmLabel: "OK",
      onConfirm: () => {}
    });
  };

  const handleRestoreExam = (exam: any) => {
    setConfirmDialog({
      isOpen: true,
      title: "Pulihkan Bank Soal",
      description: `Apakah Anda yakin ingin memulihkan bank soal "${exam.title}"?`,
      type: "info",
      confirmLabel: "Pulihkan",
      onConfirm: async () => {
        try {
          await update(ref(database, `exams/${exam.id}`), { status: null });
        } catch (e) { 
          showAlert("Gagal", "Gagal memulihkan bank soal.", "danger");
        }
      }
    });
  };

  useEffect(() => {
    const examsRef = ref(database, "exams");
    const unsubscribe = onValue(examsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loaded = Object.keys(data).map((key) => {
          const exam = data[key];
          const mapelObj = mapels.find((m) => m.id === exam.subjectId);
          const teacherObj = teachers.find((t) => t.id === exam.teacherId);
          return {
            id: key,
            ...exam,
            subjectName: mapelObj ? mapelObj.name : "Mapel Tidak Ditemukan",
            teacherName: teacherObj ? teacherObj.name : "Guru Tidak Ditemukan",
          };
        });
        setExams(loaded);
      } else {
        setExams([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [mapels, teachers]);

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedExam(null);
    setFormValues({ title: "", subjectId: "", teacherId: "" });
    setIsDialogOpen(true);
  };

  const handleEditClick = (exam: ExamData) => {
    setDialogMode("edit");
    setSelectedExam(exam);
    setFormValues({ title: exam.title, subjectId: exam.subjectId, teacherId: exam.teacherId || "" });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (exam: ExamData) => {
    setExamToDelete(exam);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (dialogMode === "edit" && selectedExam) {
        const examRef = ref(database, `exams/${selectedExam.id}`);
        await update(examRef, { ...formValues });
      } else {
        const examsRef = ref(database, "exams");
        await push(examsRef, {
          ...formValues,
          createdAt: Date.now(),
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      showAlert("Gagal", "Gagal menyimpan data ujian.", "danger");
    }
  };

  const handleConfirmDelete = async () => {
    if (!examToDelete) return;
    setIsDeleting(true);
    try {
      await remove(ref(database, `exams/${examToDelete.id}`));
    } catch (error) {
      showAlert("Gagal", "Gagal menghapus bank soal.", "danger");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Bank Soal (Ujian)</h2>
          <p className="text-sm text-muted-foreground">Kelola master ujian dan rincian soal.</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button 
              onClick={() => setActiveTab("aktif")} 
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === "aktif" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Aktif
            </button>
            <button 
              onClick={() => setActiveTab("arsip")} 
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === "arsip" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Arsip
            </button>
          </div>
          <Button onClick={handleCreateClick} size="lg" className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" /> Tambah Ujian
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Data Bank Soal</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={exams.filter(e => activeTab === "arsip" ? e.status === "archive" : e.status !== "archive")}
              columns={columns}
              searchPlaceholder="Cari ujian..."
              emptyMessage={`Belum ada bank soal ${activeTab}.`}
              actions={(exam: any) => (
                <div className="flex justify-end gap-1.5 items-center whitespace-nowrap">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" 
                    onClick={() => navigate(`/admin/bank-soal/${exam.id}/questions`)}
                  >
                    <BookOpen className="h-4 w-4 mr-1" /> Soal
                  </Button>
                  
                  {activeTab === "aktif" ? (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 dark:bg-amber-950 dark:text-amber-400" 
                      onClick={() => handleArchiveExam(exam)}
                    >
                          <Archive className="h-4 w-4 mr-1" /> Arsip
                    </Button>
                  ) : (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400" 
                      onClick={() => handleRestoreExam(exam)}
                    >
                          <RotateCw className="h-4 w-4 mr-1" /> Buka
                    </Button>
                  )}

                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 dark:bg-green-950 dark:text-green-400" 
                    onClick={() => handleEditClick(exam)}
                  >
                    Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200" 
                    onClick={() => handleDeleteClick(exam)}
                  >
                    Hapus
                  </Button>
                </div>
              )}
            />
          </CardContent>
        </Card>
      )}

      {/* Dialog Create/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Edit Ujian" : "Tambah Ujian"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField id="title" label="Judul Ujian" error={undefined}>
              <Input value={formValues.title} onChange={(e) => setFormValues({ ...formValues, title: e.target.value })} required />
            </FormField>

            <FormField id="subjectId" label="Mata Pelajaran" error={undefined}>
              <select 
                value={formValues.subjectId} 
                onChange={(e) => setFormValues({ ...formValues, subjectId: e.target.value })} 
                required
                className="w-full rounded-md border text-sm p-2"
              >
                <option value="">-- Pilih Mapel --</option>
                {mapels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </FormField>

            <FormField id="teacherId" label="Guru Pengampu" error={undefined}>
              <select 
                value={formValues.teacherId} 
                onChange={(e) => setFormValues({ ...formValues, teacherId: e.target.value })} 
                required
                className="w-full rounded-md border text-sm p-2"
              >
                <option value="">-- Pilih Guru --</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </FormField>

            <Button type="submit" className="w-full">{dialogMode === "edit" ? "Perbarui" : "Simpan"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Ujian"
        description="Apakah Anda yakin ingin menghapus ujian ini? Seluruh soal di dalamnya juga akan hilang."
        itemName={examToDelete?.title || ""}
        isLoading={isDeleting}
      />

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={async () => {
          await confirmDialog.onConfirm();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }}
        title={confirmDialog.title}
        description={confirmDialog.description}
        type={confirmDialog.type}
        confirmLabel={confirmDialog.confirmLabel}
      />
    </div>
  );
};

export default ExamsPage;
