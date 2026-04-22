import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, BookOpen, Trash, Edit, Archive, RotateCw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { DeleteConfirmationDialog } from "../../components/ui/delete-confirmation-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { useNavigate } from "react-router-dom";
import { useExamData } from "../../context/ExamDataContext";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";
import { DataTable } from "../../components/ui/data-table";
import { Skeleton } from "../../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { useToast } from "../../components/ui/toast";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";

export interface ExamData {
  id: string;
  title: string;
  subjectId: string;
  teacherId: string;
  createdAt: string; // PocketBase uses ISO strings
  examType?: string;
  status? : "archive" | null;
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


const ExamsPage = () => {
  const navigate = useNavigate();
  const { pb, terminology } = useTenant();
  const { user, role, teacherId } = useAuth();
  const { addToast } = useToast();
  const { subjects, teachers, teacherFullAccess, loading: dataLoading } = useExamData();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isLoading = loading || dataLoading;
  const [activeTab, setActiveTab] = useState<"aktif" | "arsip">("aktif");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedExam, setSelectedExam] = useState<ExamData | null>(null);
  const [activeExamIds, setActiveExamIds] = useState<string[]>([]);
  const [formValues, setFormValues] = useState({ title: "", subjectId: "", teacherId: "", examType: "Latihan" });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<ExamData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useMemo(() => [
    {
      key: "index",
      label: "No",
      render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
      className: "w-[60px]",
    },
    {
      key: "title",
      label: `Judul Bank Soal`,
      sortable: true,
      render: (v: string, item: any) => (
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{v}</span>
          {item.examType && (
            <div className="mt-1">
              <span className={cn("text-[9px] px-1.5 py-0 rounded font-black uppercase tracking-wider border", getExamTypeColorClass(item.examType))}>
                {item.examType}
              </span>
            </div>
          )}
        </div>
      )
    },
    {
      key: "subjectName",
      label: terminology.subject,
      sortable: true,
      render: (name: string) => (
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{name}</span>
      )
    },
    {
      key: "teacherName",
      label: `${terminology.teacher} Pengampu`,
      sortable: true,
      render: (name: string, exam: any) => {
        const teacher = teachers.find((t: any) => t.id === exam.teacherId);
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 border border-slate-200 dark:border-slate-800">
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-[10px] font-bold">
              {(name || "U").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
               <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">{name}</span>
               <span className="text-[10px] text-slate-400 font-medium">{teacher?.code || "No Code"}</span>
            </div>
          </div>
        );
      }
    }
  ], [teachers]);

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



  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info", onConfirm?: () => void) => {
    if (!onConfirm && (type === "success" || type === "info")) {
      addToast({ type, title, description });
      return;
    }
    setConfirmDialog({ isOpen: true, title, description, type, confirmLabel: "OK", onConfirm: onConfirm || (() => { }) });
  };

  const isOwner = useCallback((exam: any) => {
    if (role === "admin") return true;
    if (teacherFullAccess) return true;
    if (!teacherId) return false;
    // Dukung format lama (user?.id) dan baru (teacherId) serta case sensitivity
    const examTeacherId = exam.teacherId || exam.teacherid;
    return examTeacherId === teacherId || examTeacherId === user?.id;
  }, [role, teacherId, user, teacherFullAccess]);

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
        if(!pb) return;
        try {
          await pb.collection('exams').update(exam.id, { status: "archive" });
        } catch (e) { 
          showAlert("Gagal", "Gagal mengarsipkan bank soal.", "danger");
        }
      }
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
        if (!pb) return;
        try {
          await pb.collection('exams').update(exam.id, { status: null });
        } catch (e) { 
          showAlert("Gagal", "Gagal memulihkan bank soal.", "danger");
        }
      }
    });
  };

  // Load active rooms to detect active exams
  useEffect(() => {
    const fetchActiveRooms = async () => {
      if (!pb) return;
      try {
        const rooms = await pb.collection('exam_rooms').getFullList({
          filter: 'isActive = true'
        });
        setActiveExamIds(rooms.map(r => r.examId));
      } catch (e) {
        console.error("Gagal load data ruang ujian:", e);
      }
    };

    fetchActiveRooms();
    // Subscribe ke perubahan ruang ujian
    pb?.collection('exam_rooms').subscribe("*", fetchActiveRooms);

    return () => {
      pb?.collection('exam_rooms').unsubscribe("*");
    };
  }, [pb]);

  // Sync exams data
  useEffect(() => {
    const fetchExams = async () => {
      if (!pb) return;
      
      try {
        const loaded = await pb.collection('exams').getFullList({
          sort: '-created'
        });

        const mapped = loaded.map((exam) => {
          // Handle possible lowercase field names from PocketBase
          const sId = exam.subjectId || (exam as any).subjectid;
          const tId = exam.teacherId || (exam as any).teacherid;
          const type = exam.examType || (exam as any).examtype || "Latihan";
          
          const subjectObj = subjects.find((s: any) => s.id === sId);
          const teacherObj = teachers.find((t: any) => t.id === tId);
          
          const { id, ...rest } = exam;
          return {
            id,
            ...rest,
            subjectId: sId,
            teacherId: tId,
            examType: type,
            subjectName: subjectObj ? subjectObj.name : "Mapel Tidak Ditemukan",
            teacherName: teacherObj ? teacherObj.name : `${terminology.teacher} Tidak Ditemukan`,
          };
        });

        // Filter role jika bukan admin
        if (role !== "admin" && teacherId) {
          mapped.sort((a, b) => {
            const isAOwner = (a as any).teacherId === teacherId ? 1 : 0;
            const isBOwner = (b as any).teacherId === teacherId ? 1 : 0;
            return isBOwner - isAOwner;
          });
        }

        setExams(mapped);
        setLoading(false);
      } catch (e) {
        console.error("Gagal load data ujian:", e);
        setLoading(false);
      }
    };

    fetchExams();
    pb?.collection('exams').subscribe("*", fetchExams);

    return () => {
      pb?.collection('exams').unsubscribe("*");
    };
  }, [subjects, teachers, role, user, pb]);

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedExam(null);
    setFormValues({ 
      title: "", 
      subjectId: "", 
      teacherId: role === "admin" ? "" : (teacherId || ""), 
      examType: "Latihan" 
    });
    setIsDialogOpen(true);
  };

  const handleEditClick = (exam: ExamData) => {
    setDialogMode("edit");
    setSelectedExam(exam);
    setFormValues({ 
      title: exam.title, 
      subjectId: exam.subjectId, 
      teacherId: exam.teacherId || "", 
      examType: exam.examType || "Latihan" 
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (exam: ExamData) => {
    if (activeExamIds.includes(exam.id)) {
      showAlert("Peringatan", "Batal menghapus karena Bank Soal ini sedang digunakan di Ruang Ujian aktif.", "warning");
      return;
    }
    setExamToDelete(exam);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pb) return;
    try {
      if (dialogMode === "edit" && selectedExam) {
        await pb.collection('exams').update(selectedExam.id, { ...formValues });
      } else {
        await pb.collection('exams').create({
          ...formValues,
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      showAlert("Gagal", "Gagal menyimpan data ujian. Periksa log browser.", "danger");
    }
  };

  const handleConfirmDelete = async () => {
    if (!examToDelete || !pb) return;
    setIsDeleting(true);
    try {
      // 1. Hapus soal terkait (opsional jika menggunakan Relasi cascade di PB)
      // Namun di PocketBase v0.23, penghapusan record yang di-relasi-kan tidak otomatis hapus record-nya
      // Kecuali diatur di API Rules. Mari kita hapus satu-satu untuk amannya:
      const questions = await pb.collection('questions').getFullList({
        filter: `examId = "${examToDelete.id}"`
      });
      
      for (const q of questions) {
        await pb.collection('questions').delete(q.id);
      }

      // 2. Hapus examnya
      await pb.collection('exams').delete(examToDelete.id);
    } catch (error) {
      showAlert("Gagal", "Gagal menghapus bank soal.", "danger");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            Bank Soal (Ujian)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola master ujian dan rincian soal Bank Soal.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isLoading ? (
            <>
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-32 rounded-2xl" />
            </>
          ) : (
            <>
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
              <Button onClick={handleCreateClick} size="sm" className="rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-bold shadow-sm h-9 px-4">
                <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Ujian
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar Bank Soal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead className="w-16 text-center">No</TableHead>
                      <TableHead>Judul Ujian</TableHead>
                      <TableHead>Mata Pelajaran</TableHead>
                      <TableHead>{terminology.teacher} Pengampu</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                        <TableCell>
                           <div className="space-y-2">
                              <Skeleton className="h-4 w-48" />
                              <Skeleton className="h-3 w-24 rounded-full" />
                           </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                        <TableCell className="text-right">
                           <div className="flex justify-end gap-2">
                              <Skeleton className="h-8 w-8 rounded-lg" />
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
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar Bank Soal</CardTitle>
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
                    onClick={() => {
                      sessionStorage.setItem("activeQuestionsExamId", exam.id);
                      navigate(`/admin/bank-soal/questions`);
                    }}
                    title="Kelola Soal"
                  >
                    <BookOpen className="h-4 w-4" />
                  </button>
                  
                  {isOwner(exam) && (
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
                        title="Edit Data"
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
            <DialogTitle>{dialogMode === "edit" ? "Edit Data" : "Tambah Data"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField id="title" label="Judul" error={undefined}>
              <Input value={formValues.title} onChange={(e) => setFormValues({ ...formValues, title: e.target.value })} required />
            </FormField>

            <FormField id="examType" label="Jenis Bank Soal" error={undefined}>
              <select 
                value={formValues.examType} 
                onChange={(e) => setFormValues({ ...formValues, examType: e.target.value })} 
                required
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-card text-sm p-2"
              >
                <option value="Latihan">Latihan Biasa</option>
                <option value="Ulangan">Ulangan Harian</option>
                <option value="PTS">Ujian Tengah Semester (PTS)</option>
                <option value="PAS">Ujian Akhir Semester (PAS / PAT)</option>
                <option value="US">Ujian Sekolah (US)</option>
                <option value="Tryout">Tryout</option>
              </select>
            </FormField>

            <FormField id="subjectId" label={terminology.subject} error={undefined}>
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
              <FormField id="teacherId" label={`${terminology.teacher} Pengampu`} error={undefined}>
                <select 
                  value={formValues.teacherId} 
                  onChange={(e) => setFormValues({ ...formValues, teacherId: e.target.value })} 
                  required
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-card text-sm p-2"
                >
                  <option value="">-- Pilih {terminology.teacher} --</option>
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
        title="Hapus Data"
        description="Apakah Anda yakin ingin menghapus data ini? Seluruh soal di dalamnya juga akan hilang."
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
