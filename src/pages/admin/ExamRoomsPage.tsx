import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash, Edit, Users, Archive, RotateCw, BookOpen, ClipboardList, Lock, Clock, ChevronDown, ChevronRight, Power, PowerOff, Search, ShieldAlert, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { useExamData } from "../../context/ExamDataContext";
import { useAuth } from "../../context/AuthContext";
import { getExamTypeColorClass } from "./ExamsPage";
import { useTenant } from "../../context/TenantContext";
import { ConfirmationDialog } from "../../components/dialogs/ConfirmationDialog";
import { useToast } from "../../components/ui/toast";
import { cn } from "../../lib/utils";
import { exportActiveRoomsToZip } from "../../lib/roomExcelExport";

import { DataTable } from "../../components/ui/data-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

import { Skeleton } from "../../components/ui/skeleton";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";

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
  is_exambro?: boolean;
}

const ExamRoomsPage = () => {
  const navigate = useNavigate();
  const { pb, terminology } = useTenant();
  const { user, role, teacherId } = useAuth();
  const { addToast } = useToast();
  const [rooms, setRooms] = useState<ExamRoomData[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"aktif" | "arsip">("aktif");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedRoom, setSelectedRoom] = useState<ExamRoomData | null>(null);

  const [examSearch, setExamSearch] = useState("");
  const [lastSelectedClassIndex, setLastSelectedClassIndex] = useState<number | null>(null);

  const [formValues, setFormValues] = useState({
    room_name: "",
    examId: "",
    classId: "all",
    allClasses: true,
    token: "",
    start_time: "",
    end_time: "",
    duration: 90,
    cheat_limit: 2,
    submit_window: 50,
    room_code: "",
    show_result: true,
    is_exambro: false,
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<ExamRoomData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showClassesRoom, setShowClassesRoom] = useState<ExamRoomData | null>(null);

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
    universalToken, timeLeft, teacherFullAccess, loading: dataLoading,
    students
  } = useExamData();

  const isLoading = loading || dataLoading || examsLoading;

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info") => {
    if (type === "success" || type === "info") {
      addToast({ type, title, description, duration: 3000 });
      return;
    }
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

  const isOwner = useCallback((room: ExamRoomData) => {
    const is_admin = role === "admin";
    const is_teacher_full = role === "teacher" && teacherFullAccess;
    const room_teacher_id = room.examTeacherId;
    const my_teacher_id = teacherId || user?.id;

    const owner_match = room_teacher_id === my_teacher_id;

    console.log(`DEBUG: Access check -> role: ${role}, fullAccess: ${teacherFullAccess}, isOwner: ${owner_match}, myID: ${my_teacher_id}, roomOwnerID: ${room_teacher_id}`);

    if (is_admin) return true;
    if (is_teacher_full) {
      return owner_match;
    }
    return false;
  }, [role, teacherFullAccess, teacherId, user?.id]);

  const canCreate = role === "admin" || (role === "teacher" && teacherFullAccess);

  // Columns definition (matching ExamsPage style)
  const columns = useMemo(() => [
    {
      key: "index",
      label: "No",
      render: (_: any, __: any, i?: number) => <div className="text-center font-medium">{(i || 0) + 1}</div>,
      className: "w-12",
    },
    {
      key: "room_name",
      label: "Ruangan & Pengampu",
      sortable: true,
      render: (v: string, room: ExamRoomData) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-white text-sm tracking-tight">{v || "Tanpa Nama"}</span>
            {room.is_exambro && <ShieldAlert className="h-3 w-3 text-orange-500" />}
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-none">{room.teacherName}</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                {room.subjectName || "N/A"}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleQuestionsClick(room);
              }}
              className="text-[10px] font-black text-slate-500 hover:text-blue-600 hover:underline dark:text-slate-400 dark:hover:text-blue-400 truncate text-left"
              title="Buka bank soal"
            >
              Bank Soal: {room.examTitle || "Tanpa Nama"}
            </button>
          </div>
        </div>
      )
    },
    {
      key: "schedule",
      label: "Jadwal & Status",
      render: (_: any, room: ExamRoomData) => {
        const now = Date.now();
        const start = new Date(room.start_time).getTime();
        const end = new Date(room.end_time).getTime();

        let statusLabel = "Berjalan";
        let statusStyle = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40 animate-pulse";

        if (room.status === "archive") {
          statusLabel = "Arsip";
          statusStyle = "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700";
        } else if (room.isDisabled) {
          statusLabel = "Nonaktif";
          statusStyle = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40";
        } else if (now < start) {
          statusLabel = "Menunggu";
          statusStyle = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/40";
        } else if (now > end) {
          statusLabel = "Selesai";
          statusStyle = "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700";
        }

        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className={cn("inline-flex text-[9px] px-1.5 py-0 rounded font-black uppercase tracking-wider border whitespace-nowrap", statusStyle)}>
                {statusLabel}
              </span>
              <span className={cn("text-[9px] px-1 py-0 rounded font-black uppercase tracking-widest border bg-slate-50 dark:bg-slate-900", getExamTypeColorClass(room.examType || "UMUM"))}>
                {room.examType || "UMUM"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 text-slate-500 dark:text-slate-400 font-bold text-[10px]">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span>
                  {(() => {
                    const s = new Date(room.start_time);
                    const e = new Date(room.end_time);
                    if (isNaN(s.getTime()) || isNaN(e.getTime())) return "--:-- - --:--";
                    const sDate = s.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                    const eDate = e.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                    const sTime = `${s.getHours().toString().padStart(2, '0')}:${s.getMinutes().toString().padStart(2, '0')}`;
                    const eTime = `${e.getHours().toString().padStart(2, '0')}:${e.getMinutes().toString().padStart(2, '0')}`;
                    return sDate === eDate ? `${sDate}, ${sTime} - ${eTime}` : `${sDate} ${sTime} - ${eDate} ${eTime}`;
                  })()}
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-blue-600 dark:text-blue-400">{room.duration}m</span>
              </div>
              {liveBreakdown[room.id] > 0 && (
                <div className="text-emerald-600 font-black animate-pulse opacity-80">
                  {liveBreakdown[room.id]} {terminology.student.toUpperCase()} SEDANG MENGERJAKAN
                </div>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: "className",
      label: terminology.class,
      className: "w-40",
      render: (v: string, room: ExamRoomData) => {
        if (room.allClasses) {
          return <Badge variant="outline" className="text-[9px] font-black uppercase bg-blue-50/50 text-blue-600 border-blue-100">Semua {terminology.class}</Badge>;
        }

        const classList = (v || "").split(", ").filter(Boolean);
        if (classList.length === 0) return <span className="text-slate-400 text-[10px]">N/A</span>;

        if (classList.length <= 2) {
          return (
            <div className="flex flex-wrap gap-1">
              {classList.map((cls, idx) => (
                <Badge key={idx} variant="secondary" className="px-1.5 py-0 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border-transparent">{cls}</Badge>
              ))}
            </div>
          );
        }

        return (
          <div className="relative group">
            <button
              onClick={() => setShowClassesRoom(room)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50/50 hover:bg-indigo-100 border border-indigo-100/50 transition-all active:scale-95"
            >
              <Users className="h-3 w-3 text-indigo-500" />
              <span className="text-[10px] font-bold text-indigo-600 whitespace-nowrap">{classList.length} {terminology.class}</span>
            </button>
            {/* Hover tooltip - desktop only */}
            <div className="hidden group-hover:block absolute z-50 top-full left-0 mt-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-max max-w-xs">
              <div className="grid grid-cols-3 gap-1">
                {classList.map((cls, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-full text-[10px] font-bold text-center bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800">{cls}</span>
                ))}
              </div>
            </div>
          </div>
        );
      }
    }
  ], [masterTeachers, liveBreakdown, rooms]);

  // Sync Live Monitoring Progres
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
      if (!pb) return;
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

    if (!pb) return;
    const unsub = pb.collection('attempts').subscribe("*", (e) => {
      if (e.action === 'delete') {
        delete attemptsCache[e.record.id];
      } else {
        // Hanya cache yang statusnya ongoing
        if (e.record.status === "ongoing") {
          attemptsCache[e.record.id] = e.record;
        } else {
          delete attemptsCache[e.record.id];
        }
      }
      updateOverviewStats(attemptsCache);
    });

    return () => { unsub.then(u => u()); };
  }, [pb]);

  // Sync Master Exams for Room creation selection
  useEffect(() => {
    const fetchExams = async () => {
      if (!pb) return;
      try {
        setExamsLoading(true);
        const loaded = await pb.collection('exams').getFullList({ sort: '-created' });
        setExams(loaded);
      } catch (e) { } finally {
        setExamsLoading(false);
      }
    };
    fetchExams();
  }, [pb]);

  // Sync Exam Rooms listing
  const fetchRooms = useCallback(async () => {
    if (!pb) return;
    try {
      const loaded = await pb.collection('exam_rooms').getFullList({ sort: '-created' });

      const mapped = loaded.map(room => {
        const sId = room.examId || (room as any).examid || "";
        const examObj = exams.find(e => e.id === sId);
        const eTeacherId = examObj?.teacherId || (examObj as any)?.teacherid || "";

        const startTime = room.start_time || (room as any).startTime || "";
        const endTime = room.end_time || (room as any).endTime || "";
        const roomName = room.room_name || (room as any).title || room.title || "";
        const clsId = room.classId || (room as any).classIds || "";
        const isOff = room.isDisabled !== undefined ? room.isDisabled : (room as any).isActive === false;

        const subjectObj = subjects.find(s => s.id === (examObj?.subjectId || (examObj as any)?.subjectid));
        const teacherObj = masterTeachers.find(t => t.id === eTeacherId);

        let className = `Semua ${terminology.class}`;
        if (!room.allClasses) {
          const clsData = room.classId || (room as any).classid || (room as any).classIds || (room as any).classids || "";
          let classList: string[] = [];
          if (Array.isArray(clsData)) classList = clsData;
          else if (typeof clsData === 'string' && clsData.length > 0) classList = clsData.split(",").map(id => id.trim()).filter(id => id && id !== "all");

          const foundNames = classList.map(id => {
            const c = (examClasses || []).find(cl => cl.id === id);
            return c ? c.name : null;
          }).filter(Boolean);

          if (foundNames.length > 0) className = foundNames.join(", ");
          else className = classList.length > 0 ? `ID: ${classList[0].substring(0, 5)}...` : "N/A";
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
          examTeacherId: eTeacherId,
          className: className,
          is_exambro: room.is_exambro || (room as any).isExambro || false
        } as any as ExamRoomData;
      });

      setRooms(mapped);
    } catch (e) {
      console.error("Error fetching rooms:", e);
    } finally {
      setLoading(false);
    }
  }, [subjects, masterTeachers, exams, examClasses, pb, terminology.class]);

  useEffect(() => {
    fetchRooms();

    if (!pb) return;
    const unsubscribe = pb.collection('exam_rooms').subscribe("*", (e) => {
      if (e.action === "create" || e.action === "update") {
        fetchRooms();
      } else if (e.action === "delete") {
        setRooms(prev => prev.filter(r => r.id !== e.record.id));
      }
    });
    return () => {
      unsubscribe.then(unsub => unsub());
    };
  }, [pb, fetchRooms]);


  const formatLocalDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const calculateEndTime = (start: string, durationMin: number) => {
    if (!start) return "";
    const startDate = new Date(start);
    if (isNaN(startDate.getTime())) return "";
    const endDate = new Date(startDate.getTime() + durationMin * 60000);
    return formatLocalDateTime(endDate);
  };

  const handleStartTimeChange = (val: string) => {
    setFormValues(prev => ({ ...prev, start_time: val }));
  };

  const handleDurationChange = (dur: number) => {
    setFormValues(prev => ({ ...prev, duration: dur }));
  };

  const handleSetNow = () => {
    const now = new Date();
    const end = new Date(now.getTime() + formValues.duration * 60 * 1000);
    setFormValues(prev => ({ ...prev, start_time: formatLocalDateTime(now), end_time: formatLocalDateTime(end) }));
  };

  const handleCreateClick = () => {
    setExamSearch("");
    setLastSelectedClassIndex(null);
    setDialogMode("create");
    setSelectedRoom(null);
    setFormValues({
      room_name: "",
      examId: "",
      classId: "all",
      allClasses: true,
      token: "",
      start_time: "",
      end_time: "",
      duration: 90,
      cheat_limit: 2,
      submit_window: 50,
      room_code: "",
      show_result: true,
      is_exambro: false,
    });
    setIsDialogOpen(true);
  };

  const handleEditClick = (room: ExamRoomData) => {
    setExamSearch("");
    setLastSelectedClassIndex(null);
    setDialogMode("edit");
    setSelectedRoom(room);
    setFormValues({
      room_name: room.room_name || "",
      examId: room.examId,
      classId: room.allClasses ? "" : (Array.isArray(room.classId) ? room.classId.join(",") : (room.classId || "")),
      allClasses: room.allClasses || false,
      token: room.token || "",
      start_time: room.start_time && !isNaN(new Date(room.start_time).getTime()) ? formatLocalDateTime(new Date(room.start_time)) : "",
      end_time: room.end_time && !isNaN(new Date(room.end_time).getTime()) ? formatLocalDateTime(new Date(room.end_time)) : "",
      duration: room.duration,
      cheat_limit: room.cheat_limit,
      submit_window: room.submit_window || 0,
      room_code: room.room_code || "",
      show_result: room.show_result !== false,
      is_exambro: room.is_exambro || false,
    });
    setIsDialogOpen(true);
  };

  const handleToggleDisabled = (room: ExamRoomData) => {
    const isCurrentlyActive = room.isActive !== false;
    setConfirmDialog({
      isOpen: true,
      title: isCurrentlyActive ? "Nonaktifkan Ruangan" : "Aktifkan Ruangan",
      description: isCurrentlyActive
        ? `Apakah Anda yakin ingin menonaktifkan "${room.room_name}"? ${terminology.student} tidak akan bisa masuk atau lanjut mengerjakan.`
        : `Aktifkan "${room.room_name}" sekarang agar ${terminology.student.toLowerCase()} bisa mulai mengerjakan?`,
      type: isCurrentlyActive ? "warning" : "info",
      confirmLabel: isCurrentlyActive ? "Nonaktifkan" : "Aktifkan",
      onConfirm: async () => {
        if (!pb) return;
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
    setConfirmDialog({
      isOpen: true,
      title: "Arsipkan Ruangan",
      description: `Apakah Anda yakin ingin mengarsipkan ruang ujian "${room.room_name || room.examTitle}"?`,
      type: "warning",
      confirmLabel: "Arsipkan",
      onConfirm: async () => {
        if (!pb) return;
        try {
          await pb.collection('exam_rooms').update(room.id, { status: "archive" });
          showAlert("Berhasil", "Ruang diarsipkan.", "success");
        } catch (e) {
          showAlert("Gagal", "Gagal mengarsipkan.", "danger");
        }
      }
    });
  };

  const handleRestoreRoom = async (room: ExamRoomData) => {
    setConfirmDialog({
      isOpen: true,
      title: "Pulihkan Ruangan",
      description: `Apakah Anda yakin ingin memulihkan ruang ujian "${room.room_name || room.examTitle}"?`,
      type: "info",
      confirmLabel: "Pulihkan",
      onConfirm: async () => {
        if (!pb) return;
        try {
          await pb.collection('exam_rooms').update(room.id, { status: null });
          showAlert("Berhasil", "Ruang dipulihkan.", "success");
        } catch (e) {
          showAlert("Gagal", "Gagal memulihkan.", "danger");
        }
      }
    });
  };

  const handleDeleteClick = (room: ExamRoomData) => {
    setRoomToDelete(room);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roomToDelete || !pb) return;
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
      if (!formValues.examId) {
        showAlert("Gagal", "Pilih bank soal terlebih dahulu.", "danger");
        return;
      }

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
        is_exambro: formValues.is_exambro,
        isActive: true,
        status: "active",
        isDisabled: false
      };

      if (!pb) return;

      if (dialogMode === "edit" && selectedRoom) {
        await pb.collection('exam_rooms').update(selectedRoom.id, data);
      } else {
        await pb.collection('exam_rooms').create(data);
      }
      setIsDialogOpen(false);
      await fetchRooms();
      showAlert("Berhasil", "Data berhasil disimpan.", "success");
    } catch (e) {
      console.error("Save error:", e);
      showAlert("Gagal", "Gagal simpan.", "danger");
    }
  };

  const handleQuestionsClick = (room: ExamRoomData) => {
    if (!room.examId) return;
    sessionStorage.setItem("activeQuestionsExamId", room.examId);
    navigate(`/admin/bank-soal/questions`);
  };

  const handleMonitorClick = (room: ExamRoomData) => {
    sessionStorage.setItem("activeMonitoringRoomId", room.id);
    navigate(`/admin/monitoring`);
  };

  const isRoomActive = selectedRoom ? (
    (liveBreakdown[selectedRoom.id] || 0) > 0 ||
    (Date.now() >= new Date(selectedRoom.start_time).getTime() && Date.now() <= new Date(selectedRoom.end_time).getTime())
  ) : false;
  const isEditRestricted = dialogMode === "edit" && isRoomActive;
  const filteredExams = useMemo(() => {
    const q = examSearch.trim().toLowerCase();
    return exams
      .filter((e) => e.status !== "archive") // Sembunyikan bank soal yang diarsipkan
      .filter((e) => role === "admin" || e.teacherId === teacherId || e.id === formValues.examId)
      .filter((e) => {
        if (!q) return true;
        const subjectName = subjects.find((s: any) => s.id === (e.subjectId || e.subjectid))?.name || "";
        const teacherName = masterTeachers.find((t: any) => t.id === (e.teacherId || e.teacherid))?.name || "";
        return [e.title, subjectName, teacherName].some((v) => String(v || "").toLowerCase().includes(q));
      });
  }, [examSearch, exams, role, teacherId, subjects, masterTeachers, formValues.examId]);

  const visibleExamOptions = useMemo(() => {
    const selected = exams.find((e) => e.id === formValues.examId);
    const list = [...filteredExams];
    if (selected && !list.some((e) => e.id === selected.id)) list.unshift(selected);
    // Move selected to top
    if (selected) {
      const idx = list.findIndex((e) => e.id === selected.id);
      if (idx > 0) {
        list.splice(idx, 1);
        list.unshift(selected);
      }
    }
    return list;
  }, [filteredExams, exams, formValues.examId]);

  const sortedClasses = useMemo(() => [...examClasses].sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true })), [examClasses]);

  const handleClassToggle = (classId: string, checked: boolean, shiftKey: boolean) => {
    const idx = sortedClasses.findIndex((c: any) => c.id === classId);
    let current = formValues.classId ? formValues.classId.split(",").filter(Boolean) : [];

    if (shiftKey && lastSelectedClassIndex !== null && idx !== -1) {
      const [start, end] = [lastSelectedClassIndex, idx].sort((a, b) => a - b);
      const rangeIds = sortedClasses.slice(start, end + 1).map((c: any) => c.id);
      current = checked
        ? Array.from(new Set([...current, ...rangeIds]))
        : current.filter((id) => !rangeIds.includes(id));
    } else if (checked) {
      current = Array.from(new Set([...current, classId]));
    } else {
      current = current.filter((id) => id !== classId);
    }

    setLastSelectedClassIndex(idx === -1 ? null : idx);
    setFormValues({ ...formValues, classId: current.join(",") });
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter(r => {
      const isCorrectTab = activeTab === "arsip" ? r.status === "archive" : r.status !== "archive";
      if (!isCorrectTab) return false;

      // Jika Guru, hanya tampilkan yang miliknya
      if (role === "teacher") {
        return r.examTeacherId === teacherId;
      }

      // Admin tampilkan semua
      return true;
    });
  }, [rooms, activeTab, role, teacherId]);

  const [isExporting, setIsExporting] = useState(false);
  const handleExportZip = async () => {
    const isArchive = activeTab === "arsip";
    if (filteredRooms.length === 0) {
      showAlert("Info", `Tidak ada ruang ujian ${isArchive ? "arsip" : "aktif"} untuk diexport.`, "info");
      return;
    }
    setIsExporting(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const customFilename = isArchive 
        ? `Rekap_Semua_Ruang_Arsip_${dateStr}.zip`
        : `Rekap_Semua_Ruang_Aktif_${dateStr}.zip`;

      await exportActiveRoomsToZip({
        rooms: filteredRooms,
        students,
        examClasses,
        pb,
        terminology,
        filename: customFilename
      });
      addToast({ title: "Ekspor Berhasil", description: `File ZIP berisi rekap ujian ${isArchive ? "arsip" : "aktif"} berhasil diunduh.`, type: "success" });
    } catch (e) {
      console.error(e);
      showAlert("Gagal", "Gagal mengekspor data ke ZIP.", "danger");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-500" />
            Ruang Ujian
          </h2>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Aktifkan dan kelola sesi ujian untuk {terminology.student.toLowerCase()}.</div>
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
              {canCreate && (
                <Button onClick={handleCreateClick} size="sm" className="rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-bold shadow-sm h-9 px-4">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Buka Ruang
                </Button>
              )}
              {filteredRooms.length > 0 && (
                <Button
                  onClick={handleExportZip}
                  disabled={isExporting}
                  size="sm"
                  className="rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 dark:border-emerald-800/40 text-emerald-700 font-bold shadow-sm h-9 px-4 transition-all"
                >
                  <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                  {isExporting ? "Mengekspor..." : activeTab === "aktif" ? "Export Semua Aktif (ZIP)" : "Export Semua Arsip (ZIP)"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
            <p className="text-xs text-slate-500 dark:text-slate-400">{terminology.student} Aktif</p>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5 leading-none">
              {isLoading ? <Skeleton className="h-5 w-8" /> : totalOngoing}
            </div>
          </div>
          {/* Hover Breakdown Card */}
          <div className="absolute top-full left-0 right-0 mt-2 z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 min-w-[200px] max-h-60 overflow-y-auto">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1 flex justify-between">
                <span>Detail Ruangan Live</span>
                <span className="text-emerald-500">{totalOngoing} Total</span>
              </div>
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
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {isLoading ? <Skeleton className="h-7 w-8" /> : rooms.length}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Section (Matching ExamsPage structure) */}
      {isLoading ? (
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar Ruang Ujian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-16 text-center">No</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ruangan / Bank Soal</TableHead>
                    <TableHead>{terminology.class}</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 rounded-md" /></TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
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
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar Ruang Ujian</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={filteredRooms}
              columns={columns}
              searchPlaceholder="Cari ruang ujian..."
              emptyMessage={`Belum ada ruang ujian ${activeTab}.`}
              actions={(room: ExamRoomData) => (
                <div className="flex justify-end gap-1.5 items-center whitespace-nowrap">
                  <button
                    className="p-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg dark:bg-indigo-900/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/40 transition-colors"
                    onClick={() => handleMonitorClick(room)}
                    title="Monitor Ujian"
                  >
                    <Search className="h-4 w-4" />
                  </button>

                  {isOwner(room) && (
                    <button
                      className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg dark:bg-sky-900/10 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40 transition-colors"
                      onClick={() => handleEditClick(room)}
                      title="Edit Ruangan"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}

                  {isOwner(room) && (
                    <>
                      <button
                        className={cn(
                          "p-1.5 rounded-lg border transition-colors",
                          room.isDisabled
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/40"
                            : "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-100 dark:bg-rose-900/10 dark:text-rose-400 dark:border-rose-800/40"
                        )}
                        onClick={() => handleToggleDisabled(room)}
                        title={room.isDisabled ? "Aktifkan" : "Nonaktifkan"}
                      >
                        {room.isDisabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                      </button>

                      {activeTab === "aktif" ? (
                        <button
                          className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg dark:bg-amber-900/10 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40 transition-colors"
                          onClick={() => handleArchiveRoom(room)}
                          title="Arsipkan"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      ) : (
                        <>
                          <button
                            className="p-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg dark:bg-indigo-900/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/40 transition-colors"
                            onClick={() => handleRestoreRoom(room)}
                            title="Pulihkan"
                          >
                            <RotateCw className="h-4 w-4" />
                          </button>
                          <button
                            className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg dark:bg-rose-900/10 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40 transition-colors"
                            onClick={() => handleDeleteClick(room)}
                            title="Hapus Permanen"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card p-0 rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-2xl">

          {/* Header dengan tombol simpan di kanan */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-card z-10">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                {dialogMode === "edit" ? "Edit Ruang Ujian" : "Buka Ruang Ujian"}
              </h2>
              <p className="text-[11px] text-slate-400">Bank soal · jadwal · kelas · aturan</p>
            </div>
            <Button type="submit" form="room-form" className="h-8 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md">
              {dialogMode === "edit" ? "Perbarui" : "Simpan"}
            </Button>
          </div>

          {isEditRestricted && (
            <div className="mx-4 mt-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 px-3 py-2 rounded-lg text-[11px]">
              <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Ujian berlangsung. Hanya <b>Nama Ruang, Kelas, Waktu, Durasi, Kumpul Dibuka</b>, dan <b>Batas Cheat</b> yang bisa diubah.</span>
            </div>
          )}

          <form id="room-form" onSubmit={handleSubmit} className="px-5 pb-5 pt-3 space-y-3">

            {/* Row 1: Search + Nama Ruang */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Cari Bank Soal</p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input placeholder="Nama soal / mapel / guru" value={examSearch} onChange={(e) => setExamSearch(e.target.value)} disabled={isEditRestricted} className="pl-8 h-8 text-sm" />
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Nama Ruang</p>
                <Input placeholder="Contoh: Gelombang 1 / Kelas X" value={formValues.room_name} onChange={(e) => setFormValues({ ...formValues, room_name: e.target.value })} required className="h-8 text-sm" />
              </div>
            </div>

            {/* Row 2: Bank Soal | Jadwal & Aturan */}
            <div className="grid grid-cols-2 gap-3 items-start">

              {/* Kiri: Bank Soal */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Bank Soal <span className="font-normal normal-case text-slate-300">({filteredExams.length})</span></p>
                <div className={`space-y-1 max-h-[260px] overflow-y-auto ${isEditRestricted ? "opacity-60 pointer-events-none" : ""}`}>
                  {filteredExams.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 py-8 text-center text-xs text-slate-400">Tidak ditemukan</div>
                  ) : visibleExamOptions.map((e) => {
                    const subjectName = subjects.find((m: any) => m.id === (e.subjectId || e.subjectid))?.name || "-";
                    const teacherName = masterTeachers.find((t: any) => t.id === (e.teacherId || e.teacherid))?.name || "-";
                    const selected = formValues.examId === e.id;
                    return (
                      <button key={e.id} type="button" onClick={() => setFormValues({ ...formValues, examId: e.id })}
                        className={cn("w-full text-left rounded-lg border px-2.5 py-2 transition-all",
                          selected ? "border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-300 hover:bg-blue-50/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("text-xs font-semibold truncate", selected ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-200")}>{e.title}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">{e.examType || "PAS"}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">{subjectName} · {teacherName}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Kanan: Jadwal + Aturan */}
              <div className="space-y-3">

                {/* Jadwal */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Jadwal</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Waktu Mulai</p>
                      <Input type="datetime-local" value={formValues.start_time} onChange={(e) => handleStartTimeChange(e.target.value)} required className="h-8 text-xs" />
                      <div className="flex flex-wrap gap-1 mt-1">
                        {[
                          { label: "Skrg", handler: handleSetNow },
                          { label: "07:45", h: 7, m: 45 },
                          { label: "09:40", h: 9, m: 40 },
                          { label: "10:10", h: 10, m: 10 },
                          { label: "11:40", h: 11, m: 40 },
                        ].map((p) => (
                          <button key={p.label} type="button"
                            onClick={p.handler ?? (() => {
                              const s = new Date(); s.setHours(p.h!, p.m!, 0, 0);
                              setFormValues(prev => ({ ...prev, start_time: formatLocalDateTime(s), end_time: formatLocalDateTime(new Date(s.getTime() + prev.duration * 60000)) }));
                            })}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-blue-100 hover:text-blue-700 border border-slate-200 dark:border-slate-700 transition-colors"
                          >{p.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Waktu Berakhir</p>
                      <Input type="datetime-local" value={formValues.end_time} onChange={(e) => setFormValues({ ...formValues, end_time: e.target.value })} required className="h-8 text-xs" />
                      <p className="text-[10px] text-amber-500 mt-1">Batas akhir akses</p>
                    </div>
                  </div>
                </div>

                {/* Aturan */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Aturan</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Durasi (mnt)</p>
                      <Input type="number" value={formValues.duration || ""} onChange={(e) => handleDurationChange(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)} required className="h-8 text-sm" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Batas Cheat</p>
                      <Input type="number" value={formValues.cheat_limit || ""} onChange={(e) => setFormValues({ ...formValues, cheat_limit: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })} required className="h-8 text-sm" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Kumpul Dibuka</p>
                      <Input type="number" value={formValues.submit_window || ""} onChange={(e) => setFormValues({ ...formValues, submit_window: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })} className="h-8 text-sm" />
                      <p className="text-[10px] text-slate-400 mt-1">Kosongkan = kapan saja</p>
                    </div>
                  </div>
                </div>

                {/* Toggle */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                  <div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200">Tampilkan Hasil Ujian</p>
                    <p className="text-[10px] text-slate-400">{terminology.student} bisa lihat skor setelah selesai</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                    <input type="checkbox" className="sr-only peer" checked={formValues.show_result} onChange={(e) => setFormValues({ ...formValues, show_result: e.target.checked })} />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:border after:border-slate-200" />
                  </label>
                </div>

              </div>
            </div>

            {/* Row 3: Target Kelas — full width */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Target Kelas</p>
                <div className="flex rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                  <button type="button" onClick={() => setFormValues({ ...formValues, allClasses: true, classId: "" })}
                    className={`px-3 py-1 transition-colors ${formValues.allClasses ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                    Semua Kelas
                  </button>
                  <button type="button" onClick={() => setFormValues({ ...formValues, allClasses: false })}
                    className={`px-3 py-1 border-l border-slate-200 dark:border-slate-700 transition-colors ${!formValues.allClasses ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                    Pilih Parsial
                  </button>
                </div>
              </div>
              {formValues.allClasses ? (
                <p className="text-xs text-slate-400">Semua {examClasses.length} kelas aktif mengikuti ujian ini.</p>
              ) : (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-900">
                  <div className="flex flex-wrap gap-1.5">
                    {[...examClasses].sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true })).map((c: any) => {
                      const isChecked = formValues.classId ? formValues.classId.split(",").includes(c.id) : false;
                      return (
                        <button key={c.id} type="button" onClick={(e) => handleClassToggle(c.id, !isChecked, e.shiftKey)}
                          className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border transition-all active:scale-95 select-none",
                            isChecked ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                          )}
                        >{c.name}</button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Shift+klik untuk rentang</p>
                </div>
              )}
            </div>

          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        type="danger"
        title="Hapus Ruang Ujian"
        description={`Apakah Anda yakin ingin menghapus ruang ujian ini? Data pengerjaan ${terminology.student} akan hilang.`}
        confirmLabel="Hapus"
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

      {/* Modal Daftar Kelas (Jika banyak) */}
      <Dialog open={!!showClassesRoom} onOpenChange={(open) => !open && setShowClassesRoom(null)}>
        <DialogContent className="max-w-sm bg-card rounded-3xl overflow-hidden p-0 border-none shadow-2xl">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 text-white relative">
            <Users className="h-12 w-12 opacity-10 absolute right-4 top-4" />
            <h3 className="text-lg font-bold mb-1">Daftar {terminology.class}</h3>
            <p className="text-indigo-100 text-xs opacity-80">Ruangan: {showClassesRoom?.room_name || showClassesRoom?.examTitle}</p>
          </div>
          <div className="p-6 max-h-[60vh] overflow-y-auto bg-white dark:bg-slate-950">
            <div className="flex flex-wrap gap-2">
              {(showClassesRoom?.className || "").split(", ").map((cls, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{cls}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900/50">
            <Button onClick={() => setShowClassesRoom(null)} className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-bold">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExamRoomsPage;
