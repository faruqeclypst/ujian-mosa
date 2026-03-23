import { useState, useEffect } from "react";
import { Plus, BookOpen, Trash, Edit, Archive, RotateCw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { DeleteConfirmationDialog } from "../../components/ui/delete-confirmation-dialog";
import { ref, onValue, push, update, remove } from "firebase/database";
import { database } from "../../lib/firebase";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { useNavigate } from "react-router-dom";
import { usePiket } from "../../context/PiketContext";

export interface ExamData {
  id: string;
  title: string;
  subjectId: string;
  teacherId: string;
  createdAt: number;
}

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

  const handleArchiveExam = async (exam: any) => {
    if (!window.confirm("Apakah Anda yakin ingin mengarsipkan bank soal ini?")) return;
    try {
      await update(ref(database, `exams/${exam.id}`), { status: "archive" });
    } catch (e) { alert("Gagal mengarsipkan."); }
  };

  const handleRestoreExam = async (exam: any) => {
    try {
      await update(ref(database, `exams/${exam.id}`), { status: null });
    } catch (e) { alert("Gagal memulihkan."); }
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
      alert("Gagal menyimpan data ujian.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!examToDelete) return;
    setIsDeleting(true);
    try {
      await remove(ref(database, `exams/${examToDelete.id}`));
    } catch (error) {
      alert("Gagal menghapus ujian.");
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
        <div className="border rounded-lg bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 text-center font-semibold w-12">No</th>
                <th className="p-4 text-left font-semibold">Judul Ujian</th>
                <th className="p-4 text-left font-semibold">Mata Pelajaran</th>
                <th className="p-4 text-left font-semibold">Guru Pengampu</th>
                <th className="p-4 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {exams.filter(e => activeTab === "arsip" ? e.status === "archive" : e.status !== "archive").length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">Belum ada bank soal {activeTab}.</td>
                </tr>
              ) : (
                exams
                  .filter(e => activeTab === "arsip" ? e.status === "archive" : e.status !== "archive")
                  .map((exam, index) => (
                  <tr key={exam.id} className="border-b hover:bg-slate-50">
                    <td className="p-4 text-center font-medium text-slate-400">{index + 1}</td>
                    <td className="p-4 font-medium">{exam.title}</td>
                    <td className="p-4 text-slate-500">{exam.subjectName}</td>
                    <td className="p-4 text-slate-500">{exam.teacherName}</td>
                    <td className="p-4 text-right flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/bank-soal/${exam.id}/questions`)}>
                          <BookOpen className="h-4 w-4 mr-1" /> Soal
                        </Button>
                        
                        {activeTab === "aktif" ? (
                          <Button variant="outline" size="sm" className="text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => handleArchiveExam(exam)}>
                              <Archive className="h-4 w-4 mr-1" /> Arsipkan
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => handleRestoreExam(exam)}>
                              <RotateCw className="h-4 w-4 mr-1" /> Buka
                          </Button>
                        )}

                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(exam)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteClick(exam)}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
    </div>
  );
};

export default ExamsPage;
