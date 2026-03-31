import { useState, useEffect } from "react";
import { Plus, BookOpen, Trash, Edit, Archive, RotateCw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { DeleteConfirmationDialog } from "../../components/ui/delete-confirmation-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ref, onValue, push, update, remove, get } from "firebase/database";
import { database } from "../../lib/firebase";
import { deleteImageFromStorage } from "../../lib/storage";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useExamData } from "../../context/ExamDataContext";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";

import { DataTable } from "../../components/ui/data-table";

export interface ExamData {
  id: string;
  title: string;
  subjectId: string;
  teacherId: string;
  createdAt: number;
  examType?: string;
}

export const getExamTypeColorClass = (type: string) => {
  switch (type) {
    case "Latihan Biasa": return "bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800/60 dark:border-slate-700/60 dark:text-slate-300";
    case "Ulangan Harian": return "bg-emerald-50 border-emerald-200/60 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-400";
    case "Ujian Tengah Semester (PTS)": return "bg-amber-50 border-amber-200/60 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-500";
    case "Ujian Akhir Semester (PAS / PAT)": return "bg-rose-50 border-rose-200/60 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-400";
    case "Ujian Sekolah (US)": return "bg-indigo-50 border-indigo-200/60 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800/60 dark:text-indigo-400";
    case "Tryout": return "bg-fuchsia-50 border-fuchsia-200/60 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:border-fuchsia-800/60 dark:text-fuchsia-400";
    case "Tugas Terstruktur": return "bg-blue-50 border-blue-200/60 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-400";
    case "Ujian Praktik": return "bg-cyan-50 border-cyan-200/60 text-cyan-700 dark:bg-cyan-950/40 dark:border-cyan-800/60 dark:text-cyan-400";
    default: return "bg-indigo-50 border-indigo-200/60 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800/60 dark:text-indigo-400";
  }
};

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
    render: (v: string, item: any) => (
      <div className="flex flex-col items-start gap-1">
        <span className="font-medium text-slate-800 dark:text-slate-100">{v}</span>
        {item.examType && (
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${getExamTypeColorClass(item.examType)}`}>
            {item.examType}
          </span>
        )}
      </div>
    )
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
  const { role, teacherId } = useAuth();
  const { subjects, teachers } = useExamData();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"aktif" | "arsip">("aktif");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedExam, setSelectedExam] = useState<ExamData | null>(null);
  const [activeExamIds, setActiveExamIds] = useState<string[]>([]);
  const [formValues, setFormValues] = useState({ title: "", subjectId: "", teacherId: "", examType: "Latihan Biasa" });

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
    if (activeExamIds.includes(exam.id)) {
       showAlert("Peringatan", "Batal mengarsipkan karena Bank Soal ini sedang diujikan di Ruang Ujian aktif.", "warning");
       return;
    }

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
    const roomsRef = ref(database, "exam_rooms");
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const ids: string[] = [];
      if (snapshot.exists()) {
         const data = snapshot.val();
         const now = Date.now();
         Object.values(data).forEach((room: any) => {
             const start = new Date(room.start_time).getTime();
             const end = new Date(room.end_time).getTime();
             if (now >= start && now <= end && room.status !== "archive") {
                 if (room.examId) ids.push(room.examId);
             }
         });
      }
      setActiveExamIds(ids);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const examsRef = ref(database, "exams");
    const unsubscribe = onValue(examsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loaded = Object.keys(data).map((key) => {
          const exam = data[key];
          const subjectObj = subjects.find((s: any) => s.id === exam.subjectId);
          const teacherObj = teachers.find((t: any) => t.id === exam.teacherId);
          return {
            id: key,
            ...exam,
            examType: exam.examType || "Latihan Biasa",
            subjectName: subjectObj ? subjectObj.name : "Mapel Tidak Ditemukan",
            teacherName: teacherObj ? teacherObj.name : "Guru Tidak Ditemukan",
          };
        });

        if (role !== "admin" && teacherId) {
          loaded.sort((a, b) => {
            const isAOwner = a.teacherId === teacherId ? 1 : 0;
            const isBOwner = b.teacherId === teacherId ? 1 : 0;
            return isBOwner - isAOwner;
          });
        }

        setExams(loaded);
      } else {
        setExams([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [subjects, teachers]);

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedExam(null);
    setFormValues({ title: "", subjectId: "", teacherId: role === "admin" ? "" : (teacherId || ""), examType: "Latihan Biasa" });
    setIsDialogOpen(true);
  };

  const handleEditClick = (exam: ExamData) => {
    setDialogMode("edit");
    setSelectedExam(exam);
    setFormValues({ title: exam.title, subjectId: exam.subjectId, teacherId: exam.teacherId || "", examType: exam.examType || "Latihan Biasa" });
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

  const cleanupQuestionImages = async (q: any) => {
    const keysToDelete: string[] = [];
    const extractKey = (url: string) => {
      if (url.includes("/questions/")) return "questions/" + url.split("/questions/")[1].split("?")[0];
      return "";
    };

    if (q.imageUrl) keysToDelete.push(extractKey(q.imageUrl));
    if (q.choices) {
      Object.values(q.choices).forEach((c: any) => {
        if (c.imageUrl) keysToDelete.push(extractKey(c.imageUrl));
        if (c.text && c.text.includes("/questions/")) {
          const doc = new DOMParser().parseFromString(c.text, "text/html");
          doc.querySelectorAll("img").forEach((img) => {
            const src = img.getAttribute("src") || "";
            if (src) keysToDelete.push(extractKey(src));
          });
        }
      });
    }
    if (q.text && q.text.includes("/questions/")) {
      const doc = new DOMParser().parseFromString(q.text, "text/html");
      doc.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src") || "";
        if (src) keysToDelete.push(extractKey(src));
      });
    }

    for (const k of keysToDelete) {
      if (k) {
        try {
          await deleteImageFromStorage(k);
        } catch (e) {
          console.error("Gagal menghapus gambar dari storage:", k, e);
        }
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!examToDelete) return;
    setIsDeleting(true);
    try {
      const qRef = ref(database, "questions");
      const snapshot = await get(qRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const keysToDelete = Object.keys(data).filter((k) => data[k].examId === examToDelete.id);
        
        for (const key of keysToDelete) {
          await cleanupQuestionImages({ ...data[key], id: key });
          await remove(ref(database, `questions/${key}`)); // Hapus record soal
        }
      }
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            Bank Soal (Ujian)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola master ujian dan rincian soal Bank Soal.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 p-1 rounded-xl text-xs font-semibold">
            <button 
              onClick={() => setActiveTab("aktif")} 
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === "aktif" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
            >
              Aktif
            </button>
            <button 
              onClick={() => setActiveTab("arsip")} 
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === "arsip" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
            >
              Arsip
            </button>
          </div>
          <Button onClick={handleCreateClick} size="sm" className="rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-semibold shadow-sm">
            <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Ujian
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
                  <button 
                    className="p-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg dark:bg-purple-900/10 dark:text-purple-400 border border-purple-100 dark:border-purple-800/40" 
                    onClick={() => navigate(`/admin/bank-soal/${exam.id}/questions`)}
                    title="Kelola Soal"
                  >
                    <BookOpen className="h-4 w-4" />
                  </button>
                  
                  {(role === "admin" || exam.teacherId === teacherId) && (
                    <>
                      {activeTab === "aktif" ? (
                        <button 
                          className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg dark:bg-amber-900/10 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40" 
                          onClick={() => handleArchiveExam(exam)}
                          title="Arsipkan"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      ) : (
                        <button 
                          className="p-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg dark:bg-indigo-900/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/40" 
                          onClick={() => handleRestoreExam(exam)}
                          title="Buka Arsip"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                      )}

                      <button 
                        className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg dark:bg-sky-900/10 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40" 
                        onClick={() => handleEditClick(exam)}
                        title="Edit Ujian"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {activeTab === "arsip" && (
                        <button 
                          className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg dark:bg-rose-900/10 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40" 
                          onClick={() => handleDeleteClick(exam)}
                          title="Hapus Permanen"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            />
          </CardContent>
        </Card>
      )}

      {/* Dialog Create/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Edit Ujian" : "Tambah Ujian"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField id="title" label="Judul Ujian" error={undefined}>
              <Input value={formValues.title} onChange={(e) => setFormValues({ ...formValues, title: e.target.value })} required />
            </FormField>

            <FormField id="examType" label="Jenis Bank Soal" error={undefined}>
              <select 
                value={formValues.examType} 
                onChange={(e) => setFormValues({ ...formValues, examType: e.target.value })} 
                required
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-card text-sm p-2"
              >
                <option value="Latihan Biasa">Latihan Biasa</option>
                <option value="Ulangan Harian">Ulangan Harian</option>
                <option value="Ujian Tengah Semester (PTS)">Ujian Tengah Semester (PTS)</option>
                <option value="Ujian Akhir Semester (PAS / PAT)">Ujian Akhir Semester (PAS / PAT)</option>
                <option value="Ujian Sekolah (US)">Ujian Sekolah (US)</option>
                <option value="Tryout">Tryout</option>
                <option value="Tugas Terstruktur">Tugas Terstruktur</option>
                <option value="Ujian Praktik">Ujian Praktik</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </FormField>

            <FormField id="subjectId" label="Mata Pelajaran" error={undefined}>
              <select 
                value={formValues.subjectId} 
                onChange={(e) => setFormValues({ ...formValues, subjectId: e.target.value })} 
                required
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-card text-sm p-2"
              >
                <option value="">-- Pilih Mapel --</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>

            {role === "admin" && (
              <FormField id="teacherId" label="Guru Pengampu" error={undefined}>
                <select 
                  value={formValues.teacherId} 
                  onChange={(e) => setFormValues({ ...formValues, teacherId: e.target.value })} 
                  required
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-card text-sm p-2"
                >
                  <option value="">-- Pilih Guru --</option>
                  {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </FormField>
            )}

            <Button type="submit" className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/20 text-blue-700 font-semibold">{dialogMode === "edit" ? "Perbarui" : "Simpan"}</Button>
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
