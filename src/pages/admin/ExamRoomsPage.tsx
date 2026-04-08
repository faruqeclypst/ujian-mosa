import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash, Edit, Users, Archive, RotateCw, BookOpen, ClipboardList, Lock, Clock, ChevronDown, Power, PowerOff, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { DeleteConfirmationDialog } from "../../components/ui/delete-confirmation-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import pb from "../../lib/pocketbase";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { useExamData } from "../../context/ExamDataContext";
import { useAuth } from "../../context/AuthContext";
import { getExamTypeColorClass } from "./ExamsPage";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";

import { DataTable } from "../../components/ui/data-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";

export interface ExamRoomData {
  id: string;
  examId: string;
  classId: string | null;
  allClasses: boolean;
  token: string;
  start_time: string;
  end_time: string;
  duration: number;
  cheat_limit: number;
  submit_window?: number;
  examTitle?: string;
  className?: string;
  room_code?: string;
  token_updated_at?: string; // ISO string from PB
  status?: "archive" | null;
  room_name?: string;
  examTeacherId?: string;
  examType?: string;
  isDisabled?: boolean;
  subjectName?: string;
  teacherName?: string;
  show_result?: boolean;
  isActive?: boolean;
}



const ExamRoomsPage = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [rooms, setRooms] = useState<ExamRoomData[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"aktif" | "arsip">("aktif");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedRoom, setSelectedRoom] = useState<ExamRoomData | null>(null);

  const [formValues, setFormValues] = useState({
    room_name: "",
    examId: "",
    classId: "all",
    allClasses: true,
    token: "",
    start_time: "",
    end_time: "",
    duration: 60,
    cheat_limit: 3,
    submit_window: 10,
    room_code: "",
    show_result: true,
  });

  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<ExamRoomData | null>(null);
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
    onConfirm: () => { }
  });

  const {
    classes: examClasses, subjects, teachers: masterTeachers,
    universalToken, timeLeft, loading: dataLoading
  } = useExamData();

  const isLoading = loading || dataLoading || examsLoading;

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info") => {
    setConfirmDialog({
      isOpen: true,
      title,
      description,
      type,
      confirmLabel: "OK",
      onConfirm: () => { }
    });
  };

  const [liveBreakdown, setLiveBreakdown] = useState<Record<string, number>>({});
  const [totalOngoing, setTotalOngoing] = useState(0);

  const teacherId = user?.id; // PocketBase user id

  // Global click handler removed with openMenuId

  // Sync Live Monitoring Progres (Efficient One-time fetch + Event-based update)
  useEffect(() => {
    let attemptsCache: Record<string, any> = {};

    const updateOverviewStats = (cache: Record<string, any>) => {
      const stats: Record<string, number> = {};
      const uniqueStudentsGlobal = new Set();
      const uniqueStudentsPerRoom: Record<string, Set<string>> = {};

      Object.values(cache).forEach(att => {
        const sId = att.studentId || att.student_id;
        if (!sId || att.status !== "ongoing") return;

        uniqueStudentsGlobal.add(sId);
        if (!uniqueStudentsPerRoom[att.examRoomId]) {
          uniqueStudentsPerRoom[att.examRoomId] = new Set();
        }
        uniqueStudentsPerRoom[att.examRoomId].add(sId);
      });

      Object.keys(uniqueStudentsPerRoom).forEach(rid => {
        stats[rid] = uniqueStudentsPerRoom[rid].size;
      });

      setLiveBreakdown(stats);
      setTotalOngoing(uniqueStudentsGlobal.size);
    };

    const initStats = async () => {
      try {
        const allAttempts = await pb.collection('attempts').getFullList({
          filter: 'status = "ongoing"'
        });
        const initialCache: Record<string, any> = {};
        allAttempts.forEach(a => initialCache[a.id] = a);
        attemptsCache = initialCache;
        updateOverviewStats(initialCache);
      } catch (e) { }
    };

    initStats();

    const unsub = pb.collection('attempts').subscribe("*", (e) => {
      if (e.action === 'delete') {
        delete attemptsCache[e.record.id];
      } else {
        attemptsCache[e.record.id] = e.record;
      }
      updateOverviewStats(attemptsCache);
    });

    return () => { unsub.then(u => u()); };
  }, []);

  // Sync Master Exams for Room creation selection
  useEffect(() => {
    const fetchExams = async () => {
      try {
        setExamsLoading(true);
        const loaded = await pb.collection('exams').getFullList({ sort: '-created' });
        setExams(loaded);
      } catch (e) { } finally {
        setExamsLoading(false);
      }
    };
    fetchExams();
  }, []);

  // Sync Exam Rooms listing
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const loaded = await pb.collection('exam_rooms').getFullList({ sort: '-created' });
        const mapped = loaded.map(room => {
          // Robust field mapping for CamelCase and snake_case
          const sId = room.examId || (room as any).examid || "";
          const startTime = room.start_time || (room as any).startTime || "";
          const endTime = room.end_time || (room as any).endTime || "";
          const roomName = room.room_name || (room as any).title || room.title || "";
          const clsId = room.classId || (room as any).classIds || "";
          const isOff = room.isDisabled !== undefined ? room.isDisabled : (room as any).isActive === false;

          const examObj = exams.find(e => e.id === sId);
          const subjectObj = subjects.find(s => s.id === (examObj?.subjectId || (examObj as any)?.subjectid));
          const teacherObj = masterTeachers.find(t => t.id === (examObj?.teacherId || (examObj as any)?.teacherid));

          let className = "Semua Kelas";
          if (!room.allClasses) {
            // Kita coba ambil dari berbagai kemungkinan field (classId atau classIds)
            const clsData = room.classId || (room as any).classid || (room as any).classIds || (room as any).classids || "";

            // Konversi ke Array ID yang bersih
            let classList: string[] = [];
            if (Array.isArray(clsData)) {
              classList = clsData;
            } else if (typeof clsData === 'string' && clsData.length > 0) {
              const rawCls = clsData;
              classList = Array.isArray(rawCls)
                ? rawCls
                : String(rawCls || "").split(",").map(id => id.trim()).filter(id => id && id !== "all");
            }

            // Cari nama-nama kelasnya
            const foundNames = classList.map(id => {
              const c = (examClasses || []).find(cl => cl.id === id);
              return c ? c.name : null;
            }).filter(Boolean);

            if (foundNames.length > 0) {
              className = foundNames.join(", ");
            } else {
              // Jika ID tidak ditemukan namanya, tapi ada ID-nya, tampilkan ID-nya saja sebagai cadangan
              className = classList.length > 0 ? `ID: ${classList[0].substring(0, 5)}...` : "N/A";
            }
          }

          const { id, ...rest } = room;
          return {
            id,
            ...rest,
            examId: sId,
            room_name: roomName,
            start_time: startTime,
            end_time: endTime,
            classId: clsId,
            isDisabled: isOff,
            examTitle: examObj?.title || "...",
            examType: (examObj as any)?.examType || (examObj as any)?.examtype || "UMUM",
            subjectName: subjectObj?.name || "N/A",
            teacherName: teacherObj?.name || "N/A",
            className: className
          } as any as ExamRoomData;
        });

        setRooms(mapped);
      } catch (e) {
        console.error("Error fetching rooms:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
    const unsubscribe = pb.collection('exam_rooms').subscribe("*", () => {
      fetchRooms();
    });
    return () => {
      unsubscribe.then(unsub => unsub());
    };
  }, [subjects, masterTeachers, exams, examClasses]);

  // Monitoring functions removed - moved to MonitoringPage.tsx

  const columns = [
    {
      key: "index",
      label: "No",
      render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
    },
    {
      key: "examTitle",
      label: "Ruang / Bank Soal",
      sortable: true,
      render: (v: string, item: ExamRoomData) => (
        <div className="flex flex-col gap-1 items-start">
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
            <span className="text-slate-400 font-medium mr-1 select-none">NR:</span>
            {item.room_name || "Tanpa Nama"}
          </span>
          <div className="flex flex-col items-start gap-1 mt-0.5">
            <span className="text-[10px] text-slate-500 font-medium tracking-wide">
              <span className="text-slate-400/70 mr-1 select-none font-bold italic">BS:</span>
              {v}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium italic">
              <span>{item.subjectName}</span>
              <span>•</span>
              <span>{item.teacherName}</span>
            </div>
            {item.examType && (
              <span className={`text-[9px] mt-1 px-1.5 py-0.5 rounded-md font-semibold border ${getExamTypeColorClass(item.examType)}`}>
                {item.examType}
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      key: "className",
      label: "Kelas",
      sortable: true,
      render: (v: string, item: ExamRoomData) => {
        if (item.allClasses) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/40 shadow-sm">
              Semua Kelas
            </span>
          );
        }
        if (!v) return <span className="text-slate-400 text-xs">-</span>;
        return (
          <div className="flex flex-wrap gap-1 max-w-[120px]">
            {v.split(", ").map((cls, idx) => (
              <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700">
                {cls}
              </span>
            ))}
          </div>
        );
      }
    },
    {
      key: "duration",
      label: "Durasi",
      render: (v: any) => <span className="text-slate-500 font-medium">{(v || "0")} Menit</span>
    },
    {
      key: "start_time",
      label: "Waktu",
      render: (v: any, item: ExamRoomData) => {
        const start = item.start_time ? new Date(item.start_time) : null;
        const end = item.end_time ? new Date(item.end_time) : null;

        const isValidStart = start && !isNaN(start.getTime());
        const isValidEnd = end && !isNaN(end.getTime());

        return (
          <div className="flex flex-col gap-0.5 text-xs text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
            <div className="flex items-center">
              <span className="w-14">Mulai</span>
              <span className="mr-1.5">:</span>
              <span>{isValidStart ? `${start.toLocaleDateString("id-ID", { day: '2-digit', month: '2-digit' })} ${start.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}` : "-"}</span>
            </div>
            <div className="flex items-center">
              <span className="w-14">Selesai</span>
              <span className="mr-1.5">:</span>
              <span>{isValidEnd ? `${end.toLocaleDateString("id-ID", { day: '2-digit', month: '2-digit' })} ${end.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}` : "-"}</span>
            </div>
          </div>
        );
      }
    },
    {
      key: "actions",
      label: "Status",
      render: (_: any, item: ExamRoomData) => {
        const now = Date.now();
        const start = new Date(item.start_time).getTime();
        const end = new Date(item.end_time).getTime();
        if (item.status === "archive") return <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Arsip</span>;
        if (item.isDisabled) return <span className="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded">Nonaktif</span>;
        if (now < start) return <span className="text-[10px] bg-blue-100 text-blue-500 px-1.5 py-0.5 rounded">Menunggu</span>;
        if (now > end) return <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Selesai</span>;
        return <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded animate-pulse">Berjalan</span>;
      }
    }
  ];

  const generateNewToken = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let token = "";
    for (let i = 0; i < 6; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    return token;
  };

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedRoom(null);
    setFormValues({
      room_name: "",
      examId: exams[0]?.id || "",
      classId: "all",
      allClasses: true,
      token: generateNewToken(),
      start_time: "",
      end_time: "",
      duration: 60,
      cheat_limit: 3,
      submit_window: 10,
      room_code: "",
      show_result: true,
    });
    setIsDialogOpen(true);
  };

  const handleEditClick = (room: ExamRoomData) => {
    setDialogMode("edit");
    setSelectedRoom(room);
    setFormValues({
      room_name: room.room_name || "",
      examId: room.examId,
      classId: room.allClasses ? "" : (Array.isArray(room.classId) ? room.classId.join(",") : (room.classId || "")),
      allClasses: room.allClasses || false,
      token: room.token,
      start_time: room.start_time && !isNaN(new Date(room.start_time).getTime()) ? new Date(room.start_time).toISOString().slice(0, 16) : "",
      end_time: room.end_time && !isNaN(new Date(room.end_time).getTime()) ? new Date(room.end_time).toISOString().slice(0, 16) : "",
      duration: room.duration,
      cheat_limit: room.cheat_limit,
      submit_window: room.submit_window || 0,
      room_code: room.room_code || "",
      show_result: room.show_result !== false,
    });
    setIsDialogOpen(true);
  };

  const handleForceEndRoom = async (room: ExamRoomData) => {
    setConfirmDialog({
      isOpen: true,
      title: "Selesaikan Paksa",
      description: "Akhiri pengerjaan ruang ujian ini untuk semua siswa sekarang?",
      type: "danger",
      confirmLabel: "Akhiri",
      onConfirm: async () => {
        try {
          await pb.collection('exam_rooms').update(room.id, { end_time: new Date().toISOString() });
          showAlert("Berhasil", "Ruang ujian telah diakhiri.", "success");
        } catch (e) {
          showAlert("Gagal", "Gagal mengakhiri ruang.", "danger");
        }
      }
    });
  };

  const handleToggleDisabled = (room: ExamRoomData) => {
    const isCurrentlyActive = room.isActive !== false;
    setConfirmDialog({
      isOpen: true,
      title: isCurrentlyActive ? "Nonaktifkan Ruangan" : "Aktifkan Ruangan",
      description: isCurrentlyActive 
        ? `Apakah Anda yakin ingin menonaktifkan "${room.room_name}"? Siswa tidak akan bisa masuk atau lanjut mengerjakan.` 
        : `Aktifkan "${room.room_name}" sekarang agar siswa bisa mulai mengerjakan?`,
      type: isCurrentlyActive ? "warning" : "info",
      confirmLabel: isCurrentlyActive ? "Nonaktifkan" : "Aktifkan",
      onConfirm: async () => {
        try {
          const newIsActive = !isCurrentlyActive;
          await pb.collection('exam_rooms').update(room.id, {
            isActive: newIsActive,
            isDisabled: !newIsActive
          });
          showAlert("Berhasil", `Ruang berhasil ${newIsActive ? "diaktifkan" : "dinonaktifkan"}.`, "success");
        } catch (e) {
          showAlert("Gagal", "Gagal mengubah status.", "danger");
        }
      }
    });
  };

  const handleArchiveRoom = async (room: ExamRoomData) => {
    try {
      await pb.collection('exam_rooms').update(room.id, { status: "archive" });
      showAlert("Berhasil", "Ruang diarsipkan.", "success");
    } catch (e) {
      showAlert("Gagal", "Gagal mengarsipkan.", "danger");
    }
  };

  const handleRestoreRoom = async (room: ExamRoomData) => {
    try {
      await pb.collection('exam_rooms').update(room.id, { status: null });
      showAlert("Berhasil", "Ruang dipulihkan.", "success");
    } catch (e) {
      showAlert("Gagal", "Gagal memulihkan.", "danger");
    }
  };

  const handleDeleteClick = (room: ExamRoomData) => {
    setRoomToDelete(room);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roomToDelete) return;
    setIsDeleting(true);
    try {
      await pb.collection('exam_rooms').delete(roomToDelete.id);
      showAlert("Berhasil", "Ruang dihapus.", "success");
    } catch (e) { showAlert("Gagal", "Gagal hapus.", "danger"); }
    finally { setIsDeleting(false); setDeleteDialogOpen(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Jika Semua Kelas dipilih, kita masukkan seluruh daftar ID kelas yang ada
      const finalClassIds = formValues.allClasses
        ? (examClasses || []).map(c => c.id)
        : formValues.classId.split(",").filter(Boolean);

      const data = {
        title: formValues.room_name,
        room_name: formValues.room_name,
        examId: formValues.examId,
        startTime: new Date(formValues.start_time).toISOString(),
        start_time: new Date(formValues.start_time).toISOString(),
        endTime: new Date(formValues.end_time).toISOString(),
        end_time: new Date(formValues.end_time).toISOString(),

        classIds: finalClassIds,
        classId: finalClassIds,
        allClasses: formValues.allClasses,
        all_classes: formValues.allClasses,

        duration: Number(formValues.duration),
        cheat_limit: Number(formValues.cheat_limit),
        submit_window: Number(formValues.submit_window),
        room_code: formValues.room_code,
        show_result: formValues.show_result,
        isActive: true,
        status: "active",
        isDisabled: false
      };

      if (dialogMode === "edit" && selectedRoom) {
        await pb.collection('exam_rooms').update(selectedRoom.id, data);
      } else {
        await pb.collection('exam_rooms').create(data);
      }
      setIsDialogOpen(false);
      showAlert("Berhasil", "Data berhasil disimpan.", "success");
    } catch (e) {
      console.error("Save error:", e);
      showAlert("Gagal", "Gagal simpan.", "danger");
    }
  };

  const handleMonitorClick = (room: ExamRoomData) => {
    navigate(`/admin/monitoring/${room.id}`);
  };

  const isRoomActive = selectedRoom ? (
    (liveBreakdown[selectedRoom.id] || 0) > 0 ||
    (Date.now() >= new Date(selectedRoom.start_time).getTime() && Date.now() <= new Date(selectedRoom.end_time).getTime())
  ) : false;
  const isEditRestricted = dialogMode === "edit" && isRoomActive;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-500" />
            Ruang Ujian
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Aktifkan dan kelola sesi ujian untuk Siswa.</p>
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
            <Plus className="mr-1 h-3.5 w-3.5" /> Buka Ruang
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Token Universal</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                {isLoading ? <Skeleton className="h-6 w-24" /> : (
                  <>
                    <code className="text-lg font-mono font-bold text-slate-800 dark:text-slate-100">{universalToken || "---"}</code>
                    <span className="text-[11px] text-amber-500 dark:text-amber-400 font-medium tracking-wide">({timeLeft})</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="group relative bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm flex items-center gap-3 backdrop-blur-sm cursor-help hover:border-emerald-300 dark:hover:border-emerald-800 transition-all">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:emerald-400 group-hover:scale-110 transition-transform">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Siswa Aktif</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5 leading-none">
              {isLoading ? <Skeleton className="h-5 w-8" /> : totalOngoing}
            </p>
          </div>

          {/* Hover Breakdown Card */}
          <div className="absolute top-full left-0 right-0 mt-2 z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 min-w-[200px] max-h-60 overflow-y-auto">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1 flex justify-between">
                <span>Detail Ruangan Live</span>
                <span className="text-emerald-500">{totalOngoing} Total</span>
              </p>
              {Object.keys(liveBreakdown).length === 0 ? (
                <p className="text-center py-2 text-[10px] text-slate-500">Tidak ada aktifitas</p>
              ) : (
                <div className="space-y-1.5">
                  {Object.keys(liveBreakdown).map(rid => {
                    const room = rooms.find(r => r.id === rid);
                    return (
                      <div key={rid} className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-600 dark:text-slate-300 font-medium truncate pr-2">
                          {room ? (room.room_name || room.examTitle) : "ID: " + rid}
                        </span>
                        <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 px-1.5 py-0.5 rounded font-bold min-w-[20px] text-center">
                          {liveBreakdown[rid]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm flex items-center gap-3 backdrop-blur-sm">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Ruang</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {isLoading ? <Skeleton className="h-7 w-8" /> : rooms.length}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cari ruang ujian..."
            className="pl-9 rounded-xl bg-card border-slate-200/60 dark:border-slate-800 focus:ring-blue-500/20"
            value={roomSearchQuery}
            onChange={(e) => setRoomSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-slate-200/60 dark:border-slate-800 p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-16 rounded-lg" />
              </div>
              <div className="space-y-2 py-4 border-y border-slate-100 dark:border-slate-800/50">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-8 w-24 rounded-xl" />
                <div className="flex gap-2">
                   <Skeleton className="h-8 w-8 rounded-lg" />
                   <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
          {rooms
            .filter(r => activeTab === "arsip" ? r.status === "archive" : r.status !== "archive")
            .filter(r => {
              const q = roomSearchQuery.toLowerCase();
              return (r.room_name || "").toLowerCase().includes(q) || 
                     (r.examTitle || "").toLowerCase().includes(q) || 
                     (r.subjectName || "").toLowerCase().includes(q);
            })
            .map((room) => {
              const now = Date.now();
              const start = new Date(room.start_time).getTime();
              const end = new Date(room.end_time).getTime();
              
              let statusLabel = "Berjalan";
              let statusColor = "bg-emerald-100 text-emerald-600 border-emerald-200 animate-pulse";
              
              if (room.status === "archive") {
                statusLabel = "Arsip";
                statusColor = "bg-slate-100 text-slate-500 border-slate-200";
              } else if (room.isDisabled) {
                statusLabel = "Nonaktif";
                statusColor = "bg-red-100 text-red-500 border-red-200";
              } else if (now < start) {
                statusLabel = "Menunggu";
                statusColor = "bg-blue-100 text-blue-500 border-blue-200";
              } else if (now > end) {
                statusLabel = "Selesai";
                statusColor = "bg-slate-200 text-slate-600 border-slate-300";
              }
              
              const isValidStart = room.start_time && !isNaN(new Date(room.start_time).getTime());
              const isValidEnd = room.end_time && !isNaN(new Date(room.end_time).getTime());

              return (
                <div key={room.id} className="group bg-card rounded-2xl border border-slate-200/60 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-800 transition-all duration-300 shadow-sm hover:shadow-md overflow-hidden flex flex-col">
                   <div className="p-5 flex-1 space-y-4">
                      <div className="flex justify-between items-start gap-3">
                         <div className="space-y-1 min-w-0">
                            <h3 className="font-bold text-slate-800 dark:text-white truncate" title={room.room_name}>{room.room_name || "Tanpa Nama"}</h3>
                            <p className="text-[11px] text-slate-500 font-medium truncate" title={room.examTitle}>{room.examTitle}</p>
                         </div>
                         <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold border ${statusColor}`}>
                            {statusLabel}
                         </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                         <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${getExamTypeColorClass(room.examType || "UMUM")}`}>
                            {room.examType || "UMUM"}
                         </span>
                         <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                            {room.subjectName || "Mapel -"}
                         </span>
                         {room.allClasses ? (
                           <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold border border-blue-100 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/40">
                             Semua Kelas
                           </span>
                         ) : room.className && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold border border-slate-200 bg-slate-50 text-slate-600 truncate max-w-[120px]">
                              {room.className}
                            </span>
                         )}
                      </div>

                      <div className="py-3 border-y border-slate-100 dark:border-slate-800/50 space-y-2">
                         <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 flex items-center gap-1.5"><Clock className="h-3 w-3" /> Pelaksanaan</span>
                            <span className="font-mono text-slate-600 dark:text-slate-300">
                               {isValidStart ? new Date(room.start_time).toLocaleDateString("id-ID", {day:'2-digit', month:'short'}) : "-"} • {room.duration}m
                            </span>
                         </div>
                         <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 flex items-center gap-1.5"><Users className="h-3 w-3" /> Siswa Aktif</span>
                            <span className="font-bold text-emerald-600">{liveBreakdown[room.id] || 0} Ujian</span>
                         </div>
                      </div>
                   </div>

                   <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900/40 flex justify-between items-center gap-2">
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         onClick={() => handleMonitorClick(room)}
                         className="h-8 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl"
                       >
                         Lihat Monitoring
                       </Button>
                       
                       <div className="flex items-center gap-1">
                          <button
                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                            onClick={() => navigate(`/admin/bank-soal/${room.examId}/questions`)}
                            title="Bank Soal"
                          >
                            <BookOpen className="h-4 w-4" />
                          </button>

                          {(role === "admin" || room.examTeacherId === teacherId) && (
                            <>
                              <button
                                className={`p-1.5 rounded-lg transition-colors ${room.isDisabled
                                  ? "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                  : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"}`}
                                onClick={() => handleToggleDisabled(room)}
                                title={room.isDisabled ? "Aktifkan Ruangan" : "Non-aktifkan"}
                              >
                                {room.isDisabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                              </button>

                              <button
                                className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-colors"
                                onClick={() => handleEditClick(room)}
                                title="Edit Ruangan"
                              >
                                <Edit className="h-4 w-4" />
                              </button>

                              {activeTab === "aktif" ? (
                                <button
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                  onClick={() => handleArchiveRoom(room)}
                                  title="Arsipkan"
                                >
                                  <Archive className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                  onClick={() => handleRestoreRoom(room)}
                                  title="Pulihkan"
                                >
                                  <RotateCw className="h-4 w-4" />
                                </button>
                              )}

                              {activeTab === "arsip" && (
                                <button
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                  onClick={() => handleDeleteClick(room)}
                                  title="Hapus Permanen"
                                >
                                  <Trash className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                       </div>
                   </div>
                </div>
              );
            })}
          {rooms.filter(r => activeTab === "arsip" ? r.status === "archive" : r.status !== "archive").length === 0 && (
            <div className="col-span-full py-20 text-center bg-slate-50 dark:bg-slate-900/20 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800/50">
               <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
               <p className="text-slate-500 font-medium">Belum ada ruang ujian {activeTab}.</p>
            </div>
          )}
        </div>
      )}

      {/* Dialog Create/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Edit Ruang Ujian" : "Buka Ruang Ujian"}</DialogTitle>
            {isEditRestricted && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 p-2.5 rounded-xl text-[10px] mt-2 font-medium flex items-start gap-2 animate-pulse-slow dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400">
                <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Ujian sedang berlangsung. Anda diperbolehkan mengubah <b>Nama Ruang</b>, <b>Kelas</b>, <b>Waktu (Mulai/Selesai)</b>, <b>Durasi</b>, <b>Kumpul Dibuka</b>, dan <b>Batas Cheat</b>.</span>
              </div>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <FormField id="room_name" label="Nama Ruang Ujian" error={undefined}>
              <Input
                placeholder="Contoh: Tryout UTBK - Gelombang 1"
                value={formValues.room_name}
                onChange={(e) => setFormValues({ ...formValues, room_name: e.target.value })}
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">Nama ini yang akan ditampilkan di layar dashboard dashboard Siswa Anda.</p>
            </FormField>

            <FormField id="examId" label="Pilih Bank Soal" error={undefined}>
              <select
                value={formValues.examId}
                onChange={(e) => setFormValues({ ...formValues, examId: e.target.value })}
                required
                disabled={isEditRestricted}
                className={`w-full rounded-md border border-slate-200 dark:border-slate-800 bg-card text-sm p-2 ${isEditRestricted ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <option value="">-- Pilih Bank Soal --</option>
                {exams
                  .filter((e) => role === "admin" || e.teacherId === teacherId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
              </select>
              {formValues.examId && exams.find(e => e.id === formValues.examId) && (
                <div className="mt-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col gap-1">
                  <div><span className="font-semibold text-slate-700 dark:text-slate-300">Jenis:</span> {exams.find(e => e.id === formValues.examId)?.examType || "Latihan Biasa"}</div>
                  <div><span className="font-semibold text-slate-700 dark:text-slate-300">Mapel:</span> {subjects.find(m => m.id === exams.find(e => e.id === formValues.examId)?.subjectId)?.name || "-"}</div>
                  <div><span className="font-semibold text-slate-700 dark:text-slate-300">Guru:</span> {masterTeachers.find(t => t.id === exams.find(e => e.id === formValues.examId)?.teacherId)?.name || "-"}</div>
                </div>
              )}
            </FormField>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Pilih Kelas</label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setFormValues({ ...formValues, allClasses: true, classId: "" })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${formValues.allClasses ? "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800/40" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}
                >
                  Semua Kelas
                </button>
                <button
                  type="button"
                  onClick={() => setFormValues({ ...formValues, allClasses: false })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!formValues.allClasses ? "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800/40" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}
                >
                  Pilih Parsial (Multiple)
                </button>
              </div>

              {!formValues.allClasses && (
                <div className="grid grid-cols-2 gap-2 border border-slate-200 dark:border-slate-800 rounded-xl p-2 max-h-40 overflow-y-auto bg-card">
                  {examClasses.map((c) => {
                    const isChecked = formValues.classId ? formValues.classId.split(",").includes(c.id) : false;
                    return (
                      <label key={c.id} className={`flex items-center gap-2 text-xs p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer text-slate-700 dark:text-slate-200`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let current = formValues.classId ? formValues.classId.split(",") : [];
                            if (e.target.checked) {
                              current.push(c.id);
                            } else {
                              current = current.filter(id => id !== c.id);
                            }
                            current = current.filter(Boolean);
                            setFormValues({ ...formValues, classId: current.join(",") });
                          }}
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>


            <div className="grid grid-cols-2 gap-3">
              <FormField id="start_time" label="Waktu Mulai" error={undefined}>
                <Input type="datetime-local" value={formValues.start_time} onChange={(e) => setFormValues({ ...formValues, start_time: e.target.value })} required />
              </FormField>
              <FormField id="end_time" label="Waktu Berakhir" error={undefined}>
                <Input type="datetime-local" value={formValues.end_time} onChange={(e) => setFormValues({ ...formValues, end_time: e.target.value })} required />
              </FormField>
            </div>


            <div className="space-y-4 pt-1 border-t mt-4">
              <div className="grid grid-cols-2 gap-3 mt-2">
                <FormField id="duration" label="Durasi (Menit)" error={undefined}>
                  <Input type="number" value={formValues.duration} onChange={(e) => setFormValues({ ...formValues, duration: Number(e.target.value) })} required />
                </FormField>
                <FormField id="cheat_limit" label="Batas Cheat" error={undefined}>
                  <Input type="number" value={formValues.cheat_limit} onChange={(e) => setFormValues({ ...formValues, cheat_limit: Number(e.target.value) })} required />
                </FormField>
              </div>
              <FormField id="submit_window" label="Kumpul Dibuka (Sisa Menit)" error={undefined}>
                <Input type="number" placeholder="Contoh: 10 (Tombol kumpul aktif 10 menit sebelum berakhir)" value={formValues.submit_window || ""} onChange={(e) => setFormValues({ ...formValues, submit_window: Number(e.target.value) })} />
                <p className="text-slate-400 text-xs mt-1">biarkan kosong agar Siswa dapat mengumpulkan selama ujian berjalan</p>
              </FormField>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/60 mt-2">
                <div className="space-y-0.5 pr-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Menampilkan Hasil Ujian</label>
                  <p className="text-[10px] text-slate-400 leading-tight">Siswa dapat melihat skor, jumlah benar & salah setelah selesai mengumpulkan.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formValues.show_result}
                    onChange={(e) => setFormValues({ ...formValues, show_result: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/40 text-blue-700">{dialogMode === "edit" ? "Perbarui" : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Ruang Ujian"
        description="Apakah Anda yakin ingin menghapus ruang ujian ini? Data absensi/attempts akan hilang."
        itemName="Ruang ujian ini"
        isLoading={isDeleting}
      />

      {/* Monitoring Dialogs removed - moved to MonitoringPage.tsx */}


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

export default ExamRoomsPage;


