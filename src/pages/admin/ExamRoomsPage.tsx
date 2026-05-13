import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash, Edit, Users, Archive, RotateCw, BookOpen, ClipboardList, Lock, Clock, ChevronDown, ChevronRight, Power, PowerOff, Search, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { DeleteConfirmationDialog } from "../../components/ui/delete-confirmation-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { useExamData } from "../../context/ExamDataContext";
import { useAuth } from "../../context/AuthContext";
import { getExamTypeColorClass } from "./ExamsPage";
import { useTenant } from "../../context/TenantContext";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";
import { useToast } from "../../components/ui/toast";
import { cn } from "../../lib/utils";

import { DataTable }  from "../../components/ui/data-table";
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
    universalToken, timeLeft, teacherFullAccess, loading: dataLoading
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
          <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
             <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-none">{room.teacherName}</span>
             <span className="text-slate-300 dark:text-slate-700">|</span>
             <span className="text-[10px] font-bold text-slate-400 truncate" title={room.examTitle}>{room.examTitle}</span>
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
      className: "w-32",
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
          <button 
            onClick={() => setShowClassesRoom(room)}
            className="group flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50/50 hover:bg-indigo-100 border border-indigo-100/50 transition-all active:scale-95"
            title="Klik untuk lihat semua kelas"
          >
            <Users className="h-3 w-3 text-indigo-500" />
            <span className="text-[10px] font-bold text-indigo-600 whitespace-nowrap">{classList.length} {terminology.class}</span>
            <div className="flex -space-x-2 ml-1 opacity-60 group-hover:opacity-100 transition-opacity">
               <div className="w-4 h-4 rounded-full bg-indigo-200 border border-white flex items-center justify-center text-[8px] text-indigo-700 font-bold">1</div>
               <div className="w-4 h-4 rounded-full bg-indigo-300 border border-white flex items-center justify-center text-[8px] text-indigo-700 font-bold">2</div>
            </div>
          </button>
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
    const newEndTime = calculateEndTime(val, formValues.duration);
    setFormValues(prev => ({ ...prev, start_time: val, end_time: newEndTime }));
  };

  const handleDurationChange = (dur: number) => {
    const newEndTime = calculateEndTime(formValues.start_time, dur);
    setFormValues(prev => ({ ...prev, duration: dur, end_time: newEndTime }));
  };

  const handleSetNow = () => {
    handleStartTimeChange(formatLocalDateTime(new Date()));
  };

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedRoom(null);
    setFormValues({
      room_name: "",
      examId: exams[0]?.id || "",
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
      is_exambro: false,
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
      token: room.token || "",
      start_time: room.start_time && !isNaN(new Date(room.start_time).getTime()) ? new Date(room.start_time).toISOString().slice(0, 16) : "",
      end_time: room.end_time && !isNaN(new Date(room.end_time).getTime()) ? new Date(room.end_time).toISOString().slice(0, 16) : "",
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

  const handleMonitorClick = (room: ExamRoomData) => {
    sessionStorage.setItem("activeMonitoringRoomId", room.id);
    navigate(`/admin/monitoring`);
  };

  const isRoomActive = selectedRoom ? (
    (liveBreakdown[selectedRoom.id] || 0) > 0 ||
    (Date.now() >= new Date(selectedRoom.start_time).getTime() && Date.now() <= new Date(selectedRoom.end_time).getTime())
  ) : false;
  const isEditRestricted = dialogMode === "edit" && isRoomActive;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-500" />
            Ruang Ujian
          </h2>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Aktifkan dan kelola sesi ujian untuk ${terminology.student.toLowerCase()}.</div>
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
              data={rooms.filter(r => {
                const isCorrectTab = activeTab === "arsip" ? r.status === "archive" : r.status !== "archive";
                if (!isCorrectTab) return false;
                
                // Jika Guru, hanya tampilkan yang miliknya
                if (role === "teacher") {
                  return r.examTeacherId === teacherId;
                }
                
                // Admin tampilkan semua
                return true;
              })}
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
              <p className="text-[10px] text-slate-400 mt-1">Nama ini yang akan ditampilkan di layar dashboard dashboard {terminology.student} Anda.</p>
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
                <div className="space-y-1.5">
                  <Input type="datetime-local" value={formValues.start_time} onChange={(e) => handleStartTimeChange(e.target.value)} required />
                  <div className="flex flex-wrap gap-1">
                    <button 
                      type="button" 
                      onClick={handleSetNow}
                      className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-bold border border-blue-100 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                    >
                      Mulai Sekarang
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        const now = new Date();
                        now.setHours(7, 30, 0, 0);
                        handleStartTimeChange(formatLocalDateTime(now));
                      }}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      07:30
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        const now = new Date();
                        now.setHours(8, 0, 0, 0);
                        handleStartTimeChange(formatLocalDateTime(now));
                      }}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      08:00
                    </button>
                  </div>
                </div>
              </FormField>
              <FormField id="end_time" label="Waktu Berakhir" error={undefined}>
                <div className="space-y-1.5">
                  <Input type="datetime-local" value={formValues.end_time} onChange={(e) => setFormValues({ ...formValues, end_time: e.target.value })} required />
                  <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium italic">* Otomatis dari Mulai + Durasi</p>
                </div>
              </FormField>
            </div>

            <div className="space-y-4 pt-1 border-t mt-4">
              <div className="grid grid-cols-2 gap-3 mt-2">
                <FormField id="duration" label="Durasi (Menit)" error={undefined}>
                  <Input type="number" value={formValues.duration} onChange={(e) => handleDurationChange(Number(e.target.value))} required />
                </FormField>
                <FormField id="cheat_limit" label="Batas Cheat" error={undefined}>
                  <Input type="number" value={formValues.cheat_limit} onChange={(e) => setFormValues({ ...formValues, cheat_limit: Number(e.target.value) })} required />
                </FormField>
              </div>
              <FormField id="submit_window" label="Kumpul Dibuka (Sisa Menit)" error={undefined}>
                <Input type="number" placeholder="Contoh: 10 (Tombol kumpul aktif 10 menit sebelum berakhir)" value={formValues.submit_window || ""} onChange={(e) => setFormValues({ ...formValues, submit_window: Number(e.target.value) })} />
                <p className="text-slate-400 text-xs mt-1">biarkan kosong agar {terminology.student.toLowerCase()} dapat mengumpulkan selama ujian berjalan</p>
              </FormField>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/60 mt-2">
                <div className="space-y-0.5 pr-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Menampilkan Hasil Ujian</label>
                  <p className="text-[10px] text-slate-400 leading-tight">{terminology.student} dapat melihat skor, jumlah benar & salah setelah selesai mengumpulkan.</p>
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
        description={`Apakah Anda yakin ingin menghapus ruang ujian ini? Data pengerjaan ${terminology.student} akan hilang.`}
        itemName="Ruang ujian ini"
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
            <div className="grid grid-cols-2 gap-2">
              {(showClassesRoom?.className || "").split(", ").map((cls, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:border-indigo-200 dark:hover:border-indigo-900">
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
