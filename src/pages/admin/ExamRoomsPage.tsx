import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Trash, Edit, Users, Archive, RotateCw, BookOpen, ClipboardList, Lock, Clock, Calendar, ChevronDown, ChevronRight, Power, PowerOff, Search, ShieldAlert, FileSpreadsheet, BarChart2, X, GitBranch, ExternalLink, Copy, Check, Filter, KeyRound, Activity, CheckSquare, MoreVertical, MoreHorizontal, Folder, Layers } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
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
import { BatchProgressDialog, type BatchProgressState } from "../../components/dialogs/BatchProgressDialog";
import { useToast } from "../../components/ui/toast";
import { cn } from "../../lib/utils";
import { exportActiveRoomsToZip } from "../../lib/roomExcelExport";
import { getStudentExamUrl } from "../../utils/domainHelper";

import { NeonTable, type NeonTableColumn } from "../../components/ui/NeonTable";
import {
  NeonInspector,
  InspectorSection,
  InspectorHeader,
  InspectorField,
  InspectorGrid,
  InspectorActions,
  InspectorButton,
  InspectorCard,
  InspectorEmpty,
} from "../../components/ui/NeonInspector";
import { NeonTabs } from "../../components/ui/NeonTabs";
import { NeonStatGrid, NeonStatCard } from "../../components/ui/NeonStats";
import { NeonBadge } from "../../components/ui/NeonBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

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
  max_questions?: number;
  randomize_questions?: boolean;
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
  group_name?: string;
}

// Sub-komponen terisolasi untuk countdown sisa waktu token agar tidak memicu re-render seluruh halaman tiap detik
const TokenTimeLeftBadge = () => {
  const { timeLeft } = useExamData();
  if (!timeLeft) return null;
  return (
    <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-medium">
      ({timeLeft})
    </span>
  );
};

const TokenTimeLeftText = () => {
  const { timeLeft } = useExamData();
  return (
    <span className="font-mono text-neutral-700 dark:text-neutral-300 font-medium">
      {timeLeft || "Tidak Terbatas"}
    </span>
  );
};

const ExamRoomsPage = () => {
  const navigate = useNavigate();
  const { pb, terminology, school } = useTenant();
  const { user, role, teacherId } = useAuth();
  const { addToast } = useToast();
  const [rooms, setRooms] = useState<ExamRoomData[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [examQuestionCounts, setExamQuestionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"aktif" | "arsip">("aktif");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedRoom, setSelectedRoom] = useState<ExamRoomData | null>(null);

  const [examSearch, setExamSearch] = useState("");
  const [lastSelectedClassIndex, setLastSelectedClassIndex] = useState<number | null>(null);
  const [inspectedRoomId, setInspectedRoomId] = useState<string | null>(null);

  // Batch Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ongoing" | "waiting" | "finished" | "disabled">("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [batchGroupDialogOpen, setBatchGroupDialogOpen] = useState(false);
  const [batchGroupInput, setBatchGroupInput] = useState("");
  const [copiedToken, setCopiedToken] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgressState>({
    isOpen: false,
    current: 0,
    total: 0,
    message: "",
    title: ""
  });

  useEffect(() => {
    setSelectedIds([]);
    setLastSelectedIndex(null);
    setTableSearch("");
    setStatusFilter("all");
    setGroupFilter("all");
  }, [activeTab]);

  const [formValues, setFormValues] = useState({
    room_name: "",
    group_name: "",
    examId: "",
    classId: "all",
    allClasses: true,
    token: "",
    start_time: "",
    end_time: "",
    duration: 90,
    cheat_limit: 2,
    submit_window: 50,
    max_questions: 0,
    randomize_questions: true,
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
    universalToken, teacherFullAccess, loading: dataLoading,
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

  const [attempts, setAttempts] = useState<any[]>([]);
  const [liveBreakdown, setLiveBreakdown] = useState<Record<string, number>>({});
  const [totalOngoing, setTotalOngoing] = useState(0);

  const isOwner = useCallback((room: ExamRoomData) => {
    const is_admin = role === "admin";
    const is_teacher_full = role === "teacher" && teacherFullAccess;
    const room_teacher_id = room.examTeacherId;
    const my_teacher_id = teacherId || user?.id;

    const owner_match = room_teacher_id === my_teacher_id;

    if (is_admin) return true;
    if (is_teacher_full) {
      return owner_match;
    }
    return false;
  }, [role, teacherFullAccess, teacherId, user?.id]);

  const canCreate = role === "admin" || (role === "teacher" && teacherFullAccess);

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

  const inspectedRoom = useMemo(() => {
    if (inspectedRoomId) {
      const found = rooms.find(r => r.id === inspectedRoomId);
      if (found) return found;
    }
    return filteredRooms[0] || null;
  }, [inspectedRoomId, rooms, filteredRooms]);

  const selectableRooms = useMemo(() => {
    return filteredRooms.filter(r => isOwner(r));
  }, [filteredRooms, isOwner]);

  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach(r => {
      if (r.group_name && r.group_name.trim()) {
        set.add(r.group_name.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rooms]);

  // ── Realtime Active Students Engine (Parity with Dashboard) ──
  // Menghitung jumlah siswa aktif secara real-time via query & SSE subscription
  // ke koleksi 'attempts' untuk seluruh ruang ujian aktif.
  const activeRoomsList = useMemo(() => {
    return rooms.filter((r) => r.status !== "archive");
  }, [rooms]);

  const activeRoomIdsStr = useMemo(() => {
    return activeRoomsList.map((r) => r.id).sort().join(",");
  }, [activeRoomsList]);

  const activeRoomIdsRef = useRef<string[]>([]);
  useEffect(() => {
    activeRoomIdsRef.current = activeRoomIdsStr ? activeRoomIdsStr.split(",").filter(Boolean) : [];
  }, [activeRoomIdsStr]);

  // Recalculate liveBreakdown & totalOngoing dynamically from attempts state
  useEffect(() => {
    const allowedRoomIds = new Set(
      (role === "teacher"
        ? rooms.filter(r => r.examTeacherId === teacherId && r.status !== "archive")
        : rooms.filter(r => r.status !== "archive")
      ).map(r => r.id)
    );

    const ongoingUnique = new Set<string>();
    const roomSets: Record<string, Set<string>> = {};

    attempts.forEach((a: any) => {
      const rId = a.examRoomId || a.exam_room_id;
      const sId = a.studentId || a.student_id;
      if (!rId || !sId || !allowedRoomIds.has(rId)) return;

      if (a.status === "ongoing" || a.status === "LOCKED") {
        ongoingUnique.add(sId);
        if (!roomSets[rId]) roomSets[rId] = new Set<string>();
        roomSets[rId].add(sId);
      }
    });

    const breakdown: Record<string, number> = {};
    for (const [rId, set] of Object.entries(roomSets)) {
      if (set.size > 0) {
        breakdown[rId] = set.size;
      }
    }

    setLiveBreakdown(breakdown);
    setTotalOngoing(ongoingUnique.size);
  }, [attempts, rooms, role, teacherId]);

  // Fetch attempts for active rooms
  const fetchLiveAttempts = useCallback(async () => {
    if (!pb || !activeRoomIdsStr) {
      setAttempts([]);
      return;
    }
    const activeIds = activeRoomIdsStr.split(",").filter(Boolean);
    if (activeIds.length === 0) {
      setAttempts([]);
      return;
    }

    try {
      const filterStr = activeIds.map((id) => `examRoomId = "${id}"`).join(" || ");
      const attemptsData = await pb.collection("attempts").getFullList({
        filter: filterStr,
        sort: "-updated",
        fields: "id,status,studentId,student_id,examRoomId,exam_room_id,updated",
      });
      setAttempts(attemptsData);
    } catch (e) {
      console.warn("Attempts direct fetch fallback in ExamRoomsPage:", e);
      // Fallback backend agregasi jika query attempts terkendala
      try {
        const res: any = await pb.send("/api/room-stats", { method: "GET" });
        if (res && typeof res === "object") {
          const bd: Record<string, number> = {};
          let total = 0;
          for (const [rid, v] of Object.entries(res)) {
            const n = Number((v as any)?.ongoing) || 0;
            if (n > 0) bd[rid] = n;
            total += n;
          }
          setLiveBreakdown(bd);
          setTotalOngoing(total);
        }
      } catch (err) { }
    }
  }, [pb, activeRoomIdsStr]);

  // Initial fetch and Real-time SSE subscription
  useEffect(() => {
    fetchLiveAttempts();
  }, [fetchLiveAttempts]);

  useEffect(() => {
    if (!pb) return;
    let isSubscribed = true;
    let currentUnsub: (() => void) | null = null;

    const startSubscribe = async () => {
      try {
        const unsub = await pb.collection("attempts").subscribe("*", (e) => {
          if (!isSubscribed) return;

          const recRoomId = e.record.examRoomId || e.record.exam_room_id || "";
          if (!activeRoomIdsRef.current.includes(recRoomId)) return;

          if (e.action === "create" || e.action === "update") {
            setAttempts((prev) => {
              const idx = prev.findIndex((a) => a.id === e.record.id);
              const cleanRecord = {
                id: e.record.id,
                status: e.record.status,
                studentId: e.record.studentId || e.record.student_id,
                student_id: e.record.student_id || e.record.studentId,
                examRoomId: e.record.examRoomId || e.record.exam_room_id,
                exam_room_id: e.record.exam_room_id || e.record.examRoomId,
                updated: e.record.updated,
              };

              if (idx > -1) {
                const newArr = [...prev];
                newArr[idx] = { ...newArr[idx], ...cleanRecord };
                return newArr;
              }
              return [cleanRecord, ...prev];
            });
          } else if (e.action === "delete") {
            setAttempts((prev) => prev.filter((a) => a.id !== e.record.id));
          }
        });

        if (!isSubscribed) {
          unsub();
        } else {
          currentUnsub = () => { unsub(); };
        }
      } catch (err) {
        console.error("Attempts realtime subscription error in ExamRoomsPage:", err);
      }
    };

    startSubscribe();

    // Background interval check (every 15s when tab is active) & on tab focus
    const handleVisibility = () => {
      if (!document.hidden) fetchLiveAttempts();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const pollTimer = setInterval(() => {
      if (!document.hidden) fetchLiveAttempts();
    }, 15000);

    return () => {
      isSubscribed = false;
      if (currentUnsub) currentUnsub();
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(pollTimer);
    };
  }, [pb, fetchLiveAttempts]);

  // Sync Master Exams for Room creation selection
  useEffect(() => {
    const fetchExams = async () => {
      if (!pb) return;
      try {
        setExamsLoading(true);
        const [loaded, fastCounts] = await Promise.all([
          pb.collection('exams').getFullList({ sort: '-created' }),
          pb.send("/api/exam-question-counts", {}).catch(() => null)
        ]);
        setExams(loaded);

        if (fastCounts && typeof fastCounts === 'object') {
          setExamQuestionCounts(fastCounts);
        } else {
          try {
            const qList = await pb.collection('questions').getFullList({ fields: 'id,examId' });
            const counts: Record<string, number> = {};
            qList.forEach((q: any) => {
              const exId = q.examId || (q as any).examid;
              if (exId) counts[exId] = (counts[exId] || 0) + 1;
            });
            setExamQuestionCounts(counts);
          } catch (qErr) { }
        }
      } catch (e) { } finally {
        setExamsLoading(false);
      }
    };
    fetchExams();
  }, [pb]);

  // Sync Exam Rooms listing with single-request relation expansion
  const fetchRooms = useCallback(async () => {
    if (!pb) return;
    try {
      const loaded = await pb.collection('exam_rooms').getFullList({
        sort: '-created',
        expand: 'examId,examId.teacherId,examId.subjectId',
      });

      const mapped = loaded.map(room => {
        const sId = room.examId || (room as any).examid || (room.expand?.examId as any)?.id || "";
        const examObj = room.expand?.examId || exams.find(e => e.id === sId);
        const eTeacherId = examObj?.teacherId || (examObj as any)?.teacherid || examObj?.expand?.teacherId?.id || "";

        const startTime = room.start_time || (room as any).startTime || "";
        const endTime = room.end_time || (room as any).endTime || "";
        const roomName = room.room_name || (room as any).title || room.title || "";
        const clsId = room.classId || (room as any).classIds || "";
        const isOff = room.isDisabled !== undefined ? room.isDisabled : (room as any).isActive === false;

        const subjectObj = examObj?.expand?.subjectId || subjects.find(s => s.id === (examObj?.subjectId || (examObj as any)?.subjectid));
        const teacherObj = examObj?.expand?.teacherId || masterTeachers.find(t => t.id === eTeacherId);

        const isAll = Boolean(room.allClasses || (room as any).all_classes);
        let className = `Semua ${terminology.class}`;
        if (!isAll) {
          const clsData = room.classId || (room as any).classid || (room as any).classIds || (room as any).classids || "";
          let classList: string[] = [];
          if (Array.isArray(clsData)) {
            classList = clsData.map(id => String(id).trim()).filter(id => id && id.toLowerCase() !== "all");
          } else if (typeof clsData === 'string' && clsData.length > 0) {
            classList = clsData.split(",").map(id => id.trim()).filter(id => id && id.toLowerCase() !== "all");
          }

          if (classList.length === 0 || (examClasses.length > 0 && classList.length >= examClasses.length)) {
            className = `Semua ${terminology.class}`;
          } else {
            const foundNames = classList.map(id => {
              const c = (examClasses || []).find(cl => cl.id === id);
              return c ? c.name : null;
            }).filter(Boolean);

            if (foundNames.length > 0) className = foundNames.join(", ");
            else className = classList.length > 0 ? `ID: ${classList[0].substring(0, 5)}...` : `Semua ${terminology.class}`;
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
          examTeacherId: eTeacherId,
          className: className,
          max_questions: Number(room.max_questions) || 0,
          randomize_questions: room.randomize_questions !== false,
          is_exambro: room.is_exambro || (room as any).isExambro || false,
          group_name: (room as any).group_name || ""
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
      group_name: "",
      examId: "",
      classId: "all",
      allClasses: true,
      token: "",
      start_time: "",
      end_time: "",
      duration: 90,
      cheat_limit: 2,
      submit_window: 50,
      max_questions: 0,
      randomize_questions: true,
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
      group_name: room.group_name || "",
      examId: room.examId,
      classId: room.allClasses ? "" : (Array.isArray(room.classId) ? room.classId.join(",") : (room.classId || "")),
      allClasses: room.allClasses || false,
      token: room.token || "",
      start_time: room.start_time && !isNaN(new Date(room.start_time).getTime()) ? formatLocalDateTime(new Date(room.start_time)) : "",
      end_time: room.end_time && !isNaN(new Date(room.end_time).getTime()) ? formatLocalDateTime(new Date(room.end_time)) : "",
      duration: room.duration,
      cheat_limit: room.cheat_limit,
      submit_window: room.submit_window || 0,
      max_questions: room.max_questions || 0,
      randomize_questions: room.randomize_questions !== false,
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
          await pb.collection('exam_rooms').update(room.id, {
            status: "archive",
            isActive: false,
            isDisabled: true
          });
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
          await pb.collection('exam_rooms').update(room.id, {
            status: null,
            isActive: true,
            isDisabled: false
          });
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

  const handleBatchToggleStatus = (enable: boolean) => {
    if (selectedIds.length === 0) return;
    const actionLabel = enable ? "Aktifkan" : "Nonaktifkan";
    const confirmTitle = `${actionLabel} Ruang Ujian Massal`;
    const confirmDesc = enable
      ? `Aktifkan ${selectedIds.length} ruang ujian terpilih agar ${terminology.student.toLowerCase()} bisa mulai mengerjakan?`
      : `Nonaktifkan ${selectedIds.length} ruang ujian terpilih? ${terminology.student} tidak akan bisa masuk atau lanjut mengerjakan.`;

    setConfirmDialog({
      isOpen: true,
      title: confirmTitle,
      description: confirmDesc,
      type: enable ? "info" : "warning",
      confirmLabel: actionLabel,
      onConfirm: async () => {
        if (!pb) return;
        setBatchProgress({
          isOpen: true,
          total: selectedIds.length,
          current: 0,
          message: `${actionLabel} ruang ujian...`,
          title: `${actionLabel} Ruang Ujian Massal`
        });
        try {
          for (let i = 0; i < selectedIds.length; i++) {
            await pb.collection('exam_rooms').update(selectedIds[i], {
              isActive: enable,
              isDisabled: !enable
            });
            setBatchProgress(prev => ({
              ...prev,
              current: i + 1,
              message: `Memproses (${i + 1}/${selectedIds.length})`
            }));
          }
          showAlert("Berhasil", `${selectedIds.length} ruang ujian berhasil ${enable ? "diaktifkan" : "dinonaktifkan"}.`, "success");
          setSelectedIds([]);
        } catch (e: any) {
          showAlert("Gagal", e.message || `Gagal mengubah status ruang ujian massal.`, "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleBatchArchive = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: "Arsipkan Ruangan Massal",
      description: `Apakah Anda yakin ingin mengarsipkan ${selectedIds.length} ruang ujian terpilih?`,
      type: "warning",
      confirmLabel: "Arsipkan",
      onConfirm: async () => {
        if (!pb) return;
        setBatchProgress({
          isOpen: true,
          total: selectedIds.length,
          current: 0,
          message: "Mengarsipkan ruang ujian...",
          title: "Arsipkan Ruang Ujian Massal"
        });
        try {
          for (let i = 0; i < selectedIds.length; i++) {
            await pb.collection('exam_rooms').update(selectedIds[i], {
              status: "archive",
              isActive: false,
              isDisabled: true
            });
            setBatchProgress(prev => ({
              ...prev,
              current: i + 1,
              message: `Mengarsipkan (${i + 1}/${selectedIds.length})`
            }));
          }
          showAlert("Berhasil", `${selectedIds.length} ruang ujian berhasil diarsipkan.`, "success");
          setSelectedIds([]);
        } catch (e: any) {
          showAlert("Gagal", e.message || "Gagal mengarsipkan massal.", "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleBatchRestore = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: "Pulihkan Ruangan Massal",
      description: `Apakah Anda yakin ingin memulihkan ${selectedIds.length} ruang ujian terpilih?`,
      type: "info",
      confirmLabel: "Pulihkan",
      onConfirm: async () => {
        if (!pb) return;
        setBatchProgress({
          isOpen: true,
          total: selectedIds.length,
          current: 0,
          message: "Memulihkan ruang ujian...",
          title: "Pulihkan Ruang Ujian Massal"
        });
        try {
          for (let i = 0; i < selectedIds.length; i++) {
            await pb.collection('exam_rooms').update(selectedIds[i], {
              status: null,
              isActive: true,
              isDisabled: false
            });
            setBatchProgress(prev => ({
              ...prev,
              current: i + 1,
              message: `Memulihkan (${i + 1}/${selectedIds.length})`
            }));
          }
          showAlert("Berhasil", `${selectedIds.length} ruang ujian berhasil dipulihkan.`, "success");
          setSelectedIds([]);
        } catch (e: any) {
          showAlert("Gagal", e.message || "Gagal memulihkan massal.", "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: "Hapus Ruangan Massal",
      description: `Hapus PERMANEN ${selectedIds.length} ruang ujian terpilih? Tindakan ini TIDAK DAPAT dikembalikan!`,
      type: "danger",
      confirmLabel: "Hapus",
      onConfirm: async () => {
        if (!pb) return;
        setBatchProgress({
          isOpen: true,
          total: selectedIds.length,
          current: 0,
          message: "Menghapus ruang ujian...",
          title: "Hapus Ruang Ujian Massal"
        });
        try {
          for (let i = 0; i < selectedIds.length; i++) {
            try {
              await pb.collection('exam_rooms').delete(selectedIds[i]);
            } catch (err) {
              console.error(`Gagal menghapus ruang ujian ${selectedIds[i]}:`, err);
            }
            setBatchProgress(prev => ({
              ...prev,
              current: i + 1,
              message: `Menghapus (${i + 1}/${selectedIds.length})`
            }));
          }
          showAlert("Berhasil", `${selectedIds.length} ruang ujian berhasil dihapus permanen.`, "success");
          setSelectedIds([]);
        } catch (e: any) {
          showAlert("Gagal", e.message || "Gagal menghapus massal.", "danger");
        } finally {
          setBatchProgress(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleApplyBatchGroup = async (targetGroupName: string) => {
    if (selectedIds.length === 0 || !pb) return;
    setBatchGroupDialogOpen(false);
    const cleanedGroup = targetGroupName.trim();

    setBatchProgress({
      isOpen: true,
      total: selectedIds.length,
      current: 0,
      message: `Mengatur group ${cleanedGroup ? `"${cleanedGroup}"` : "kosong"}...`,
      title: "Atur Group Ruang Ujian"
    });

    try {
      for (let i = 0; i < selectedIds.length; i++) {
        await pb.collection('exam_rooms').update(selectedIds[i], {
          group_name: cleanedGroup
        });
        setBatchProgress(prev => ({
          ...prev,
          current: i + 1,
          message: `Memperbarui ruang ujian (${i + 1}/${selectedIds.length})`
        }));
      }

      setRooms(prev => prev.map(r => selectedIds.includes(r.id) ? { ...r, group_name: cleanedGroup } : r));
      showAlert(
        "Berhasil",
        cleanedGroup
          ? `${selectedIds.length} ruang ujian berhasil dimasukkan ke group "${cleanedGroup}".`
          : `${selectedIds.length} ruang ujian berhasil dikeluarkan dari group.`,
        "success"
      );
      setSelectedIds([]);
      setBatchGroupInput("");
    } catch (e: any) {
      showAlert("Gagal", e.message || "Gagal mengatur group massal.", "danger");
    } finally {
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
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
        group_name: (formValues.group_name || "").trim(),
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
        max_questions: Number(formValues.max_questions) || 0,
        randomize_questions: formValues.randomize_questions !== false,
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
    navigate(`/admin/monitoring?roomId=${room.id}`);
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

  const [isExporting, setIsExporting] = useState(false);
  const handleExportZip = async (customRooms?: ExamRoomData[]) => {
    const isArchive = activeTab === "arsip";
    const targetRooms = customRooms || filteredRooms;
    if (targetRooms.length === 0) {
      showAlert("Info", `Tidak ada ruang ujian ${isArchive ? "arsip" : "aktif"} untuk diexport.`, "info");
      return;
    }
    setIsExporting(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const customFilename = customRooms
        ? `Rekap_${customRooms.length}_Ruang_Terpilih_${dateStr}.zip`
        : isArchive
          ? `Rekap_Semua_Ruang_Arsip_${dateStr}.zip`
          : `Rekap_Semua_Ruang_Aktif_${dateStr}.zip`;

      await exportActiveRoomsToZip({
        rooms: targetRooms,
        students,
        examClasses,
        pb,
        terminology,
        filename: customFilename
      });
      addToast({ title: "Ekspor Berhasil", description: `File ZIP berisi rekap ujian berhasil diunduh.`, type: "success" });
    } catch (e) {
      console.error(e);
      showAlert("Gagal", "Gagal mengekspor data ke ZIP.", "danger");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Status Filter Counts & Dynamic Display Data ──
  const statusCounts = useMemo(() => {
    const counts = { all: filteredRooms.length, ongoing: 0, waiting: 0, finished: 0, disabled: 0 };
    const now = Date.now();
    filteredRooms.forEach(r => {
      if (r.isDisabled) {
        counts.disabled++;
        return;
      }
      const start = new Date(r.start_time).getTime();
      const end = new Date(r.end_time).getTime();
      if (now >= start && now <= end) {
        counts.ongoing++;
      } else if (now < start) {
        counts.waiting++;
      } else {
        counts.finished++;
      }
    });
    return counts;
  }, [filteredRooms]);

  const displayRooms = useMemo(() => {
    let list = filteredRooms;

    if (statusFilter !== "all") {
      const now = Date.now();
      list = list.filter(r => {
        if (statusFilter === "disabled") return r.isDisabled;
        if (r.isDisabled) return false;
        const start = new Date(r.start_time).getTime();
        const end = new Date(r.end_time).getTime();
        if (statusFilter === "ongoing") return now >= start && now <= end;
        if (statusFilter === "waiting") return now < start;
        if (statusFilter === "finished") return now > end;
        return true;
      });
    }

    if (groupFilter !== "all") {
      if (groupFilter === "__none__") {
        list = list.filter(r => !r.group_name || !r.group_name.trim());
      } else {
        const target = groupFilter.trim().toLowerCase();
        list = list.filter(r => (r.group_name || "").trim().toLowerCase() === target);
      }
    }

    const q = tableSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(r => {
        const roomName = String(r.room_name || r.examTitle || "").toLowerCase();
        const teacherName = String(r.teacherName || "").toLowerCase();
        const subjectName = String(r.subjectName || "").toLowerCase();
        const className = String(r.className || "").toLowerCase();
        const roomCode = String(r.room_code || "").toLowerCase();
        const token = String(r.token || "").toLowerCase();
        const examTitle = String(r.examTitle || "").toLowerCase();
        const groupName = String(r.group_name || "").toLowerCase();
        return (
          roomName.includes(q) ||
          teacherName.includes(q) ||
          subjectName.includes(q) ||
          className.includes(q) ||
          roomCode.includes(q) ||
          token.includes(q) ||
          examTitle.includes(q) ||
          groupName.includes(q)
        );
      });
    }

    return list;
  }, [filteredRooms, statusFilter, groupFilter, tableSearch]);

  // ── Helper: Hitung status, jadwal & kelas ruang ujian ──
  const getRoomScheduleMeta = (room: ExamRoomData) => {
    const s = new Date(room.start_time);
    const e = new Date(room.end_time);
    const valid = !isNaN(s.getTime()) && !isNaN(e.getTime());
    const sDate = valid ? s.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "--";
    const eDate = valid ? e.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "--";
    const sTime = valid ? `${s.getHours().toString().padStart(2, "0")}:${s.getMinutes().toString().padStart(2, "0")}` : "--:--";
    const eTime = valid ? `${e.getHours().toString().padStart(2, "0")}:${e.getMinutes().toString().padStart(2, "0")}` : "--:--";

    const dateText = sDate === eDate ? `${sDate}, ${sTime}–${eTime}` : `${sDate} ${sTime}–${eDate} ${eTime}`;
    const activeStudents = liveBreakdown[room.id] || 0;

    const now = Date.now();
    const start = s.getTime();
    const end = e.getTime();

    let label = "Berjalan";
    let badgeStyle = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    let dot: React.ReactNode = <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />;

    if (room.status === "archive") {
      label = "Arsip";
      badgeStyle = "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700";
      dot = null;
    } else if (room.isDisabled) {
      label = "Nonaktif";
      badgeStyle = "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
      dot = null;
    } else if (now < start) {
      label = "Menunggu";
      badgeStyle = "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20";
      dot = null;
    } else if (now > end) {
      label = "Selesai";
      badgeStyle = "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700";
      dot = null;
    }

    const classList = (room.className || "").split(", ").filter(Boolean);
    const classLabel = room.allClasses
      ? `Semua ${terminology.class}`
      : classList.length > 0
        ? `${classList.length} ${terminology.class}`
        : `Tanpa ${terminology.class}`;

    return {
      dateText,
      activeStudents,
      label,
      badgeStyle,
      dot,
      classList,
      classLabel,
    };
  };

  // ── Neon Table Columns Definition ──
  const neonColumns: NeonTableColumn<ExamRoomData>[] = useMemo(() => [
    {
      key: "room_name",
      header: "Ruang Ujian & Pengampu",
      className: "min-w-0 max-w-[340px]",
      render: (room) => {
        const meta = getRoomScheduleMeta(room);

        return (
          <div className="flex flex-col gap-1 min-w-0">
            {/* Header: Nama Ruang + Status (Mobile) + Kiosk + Live */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="text-[13px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors"
                title={room.room_name || room.examTitle || "Tanpa Nama"}
              >
                {room.room_name || room.examTitle || "Tanpa Nama"}
              </span>

              {room.group_name && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 shrink-0 max-w-[150px] truncate"
                  title={`Group: ${room.group_name}`}
                >
                  <Folder className="h-2.5 w-2.5 shrink-0 text-purple-500" />
                  <span className="truncate">{room.group_name}</span>
                </span>
              )}

              {/* Status Pill on Mobile */}
              <span
                className={cn(
                  "md:hidden inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-semibold border shrink-0",
                  meta.badgeStyle
                )}
              >
                {meta.dot}
                {meta.label}
              </span>

              {room.is_exambro && (
                <span
                  className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0"
                  title="Wajib Kiosk Exambro"
                >
                  <ShieldAlert className="h-2.5 w-2.5" />
                  <span>Kiosk</span>
                </span>
              )}

              {/* Live Badge on Mobile */}
              {meta.activeStudents > 0 && (
                <span className="md:hidden inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 animate-pulse shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {meta.activeStudents} live
                </span>
              )}
            </div>

            {/* Nama Guru & Mapel */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 min-w-0">
              <span
                className="font-medium text-neutral-700 dark:text-neutral-300 truncate"
                title={room.teacherName}
              >
                {room.teacherName || "Pengampu N/A"}
              </span>
              <span className="text-neutral-300 dark:text-neutral-700 shrink-0">•</span>
              <span
                className="truncate"
                title={room.subjectName}
              >
                {room.subjectName || "Mapel N/A"}
              </span>

              {/* Kelas on Mobile */}
              <span
                className={cn(
                  "md:hidden inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium border shrink-0",
                  room.allClasses
                    ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-900/40"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                )}
              >
                <Users className="h-2.5 w-2.5 opacity-70" />
                <span>{meta.classLabel}</span>
              </span>
            </div>

            {/* Jadwal on Mobile */}
            <div className="md:hidden flex items-center gap-1.5 text-[11px] font-mono text-neutral-500 dark:text-neutral-400 flex-wrap">
              <Clock className="h-3 w-3 text-neutral-400 shrink-0" />
              <span>{meta.dateText}</span>
              <span className="px-1 py-0.2 rounded text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border border-neutral-200/60 dark:border-neutral-750 shrink-0">
                {room.duration}m
              </span>
            </div>

            {/* Bank Soal */}
            {room.examTitle && (
              <div className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500 min-w-0">
                <BookOpen className="h-3 w-3 shrink-0 opacity-70" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuestionsClick(room);
                  }}
                  className="truncate hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left cursor-pointer"
                  title={`Buka Bank Soal: ${room.examTitle}`}
                >
                  Bank: {room.examTitle}
                </button>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "schedule",
      header: "Jadwal & Kelas",
      className: "hidden md:table-cell min-w-0 w-[240px] xl:w-[260px]",
      headerClassName: "hidden md:table-cell w-[240px] xl:w-[260px]",
      render: (room) => {
        const meta = getRoomScheduleMeta(room);
        const classList = meta.classList;

        return (
          <div className="flex flex-col gap-1 min-w-0">
            {/* Baris 1: Status Pill + Kelas Pill + Live Status */}
            <div className="flex items-center gap-1.5 flex-nowrap overflow-hidden">
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0",
                  meta.badgeStyle
                )}
              >
                {meta.dot}
                {meta.label}
              </span>

              {/* Kelas dengan Hover Popover / Tooltip */}
              <div
                className="relative group/cls inline-flex items-center shrink-0"
                onClick={(e) => {
                  if (!room.allClasses && classList.length > 2) {
                    e.stopPropagation();
                    setShowClassesRoom(room);
                  }
                }}
              >
                <span className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer",
                  room.allClasses
                    ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-900/40"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600"
                )}>
                  <Users className="h-2.5 w-2.5 opacity-70" />
                  <span>{meta.classLabel}</span>
                </span>

                {/* Floating Hover Tooltip: Tampil otomatis saat di-hover */}
                <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/cls:flex flex-col z-50 w-max max-w-xs p-2 rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-[11px] shadow-xl border border-neutral-700 dark:border-neutral-300 pointer-events-none transition-all">
                  <div className="font-semibold pb-1 border-b border-neutral-700/60 dark:border-neutral-300/60 text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-600">
                    Daftar {terminology.class} Terdaftar ({room.allClasses ? "Semua" : classList.length}):
                  </div>
                  <div className="pt-1 flex flex-wrap gap-1 leading-snug max-h-36 overflow-y-auto">
                    {room.allClasses ? (
                      <span className="text-[10px]">Semua {examClasses.length} kelas aktif</span>
                    ) : classList.length > 0 ? (
                      classList.map((c, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-white/10 dark:bg-black/10 text-[10px] font-medium">
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] opacity-70">Belum ada kelas dipilih</span>
                    )}
                  </div>
                </div>
              </div>

              {meta.activeStudents > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 animate-pulse shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {meta.activeStudents} live
                </span>
              )}
            </div>

            {/* Baris 2: Waktu Compact & Durasi */}
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
              <Clock className="h-3 w-3 text-neutral-400 shrink-0" />
              <span>{meta.dateText}</span>
              <span className="px-1 py-0.2 rounded text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border border-neutral-200/60 dark:border-neutral-750 shrink-0">
                {room.duration}m
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: "rules",
      header: "Aturan & Soal",
      className: "hidden lg:table-cell min-w-0 w-[190px] xl:w-[210px]",
      headerClassName: "hidden lg:table-cell w-[190px] xl:w-[210px]",
      render: (room) => {
        return (
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-nowrap">
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0",
                  getExamTypeColorClass(room.examType || "UMUM")
                )}
              >
                {room.examType || "UMUM"}
              </span>

              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 shrink-0">
                {room.max_questions && room.max_questions > 0
                  ? `${room.max_questions} Soal`
                  : "Semua Soal"}
              </span>
            </div>

            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
              {room.randomize_questions !== false ? "Acak Soal" : "Urut Standar"}
              {room.cheat_limit > 0 && ` • Cheat ${room.cheat_limit}x`}
            </div>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Aksi",
      className: "w-24 sm:w-28 text-right shrink-0",
      headerClassName: "w-24 sm:w-28 text-right shrink-0",
      align: "right",
      render: (room) => {
        const owner = isOwner(room);
        return (
          <div
            className="flex justify-end items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Quick Action Utama: Monitor Live CBT */}
            <button
              type="button"
              className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
              onClick={() => handleMonitorClick(room)}
              title="Monitor Realtime CBT"
            >
              <Search className="h-3.5 w-3.5" />
            </button>

            {/* 2. Quick Action Kedua: Penilaian & Rekap Nilai (Tampil di sm+) */}
            <button
              type="button"
              className="hidden sm:flex h-7 w-7 rounded-md items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
              onClick={() => navigate(`/admin/penilaian?roomId=${room.id}`)}
              title="Penilaian & Rekap Nilai"
            >
              <CheckSquare className="h-3.5 w-3.5" />
            </button>

            {/* 3. Dropdown Menu Seragam (Aksi lainnya terpadu di dalam dropdown) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
                  title="Menu Aksi Lainnya"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 p-1 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-[100]">
                <DropdownMenuItem
                  onClick={() => handleMonitorClick(room)}
                  className="text-xs cursor-pointer gap-2 py-1.5 sm:hidden"
                >
                  <Search className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Monitor Live CBT</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate(`/admin/penilaian?roomId=${room.id}`)}
                  className="text-xs cursor-pointer gap-2 py-1.5"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-neutral-500" />
                  <span>Penilaian & Nilai</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate(`/admin/analisis-butir-soal?roomId=${room.id}&examId=${room.examId || ""}`)}
                  className="text-xs cursor-pointer gap-2 py-1.5"
                >
                  <BarChart2 className="h-3.5 w-3.5 text-neutral-500" />
                  <span>Analisis Butir Soal</span>
                </DropdownMenuItem>
                {owner && (
                  <DropdownMenuItem
                    onClick={() => handleEditClick(room)}
                    className="text-xs cursor-pointer gap-2 py-1.5"
                  >
                    <Edit className="h-3.5 w-3.5 text-neutral-500" />
                    <span>Edit Parameter Ruang</span>
                  </DropdownMenuItem>
                )}
                {owner && (
                  <DropdownMenuItem
                    onClick={() => handleToggleDisabled(room)}
                    className="text-xs cursor-pointer gap-2 py-1.5"
                  >
                    {room.isDisabled ? (
                      <>
                        <Power className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Aktifkan Ruangan</span>
                      </>
                    ) : (
                      <>
                        <PowerOff className="h-3.5 w-3.5 text-rose-600" />
                        <span className="text-rose-600">Nonaktifkan Ruangan</span>
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {owner && (
                  <>
                    <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
                    {activeTab === "aktif" ? (
                      <DropdownMenuItem
                        onClick={() => handleArchiveRoom(room)}
                        className="text-xs cursor-pointer gap-2 py-1.5 text-amber-600 dark:text-amber-400 focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-950/40"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        <span>Arsipkan Ruangan</span>
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem
                          onClick={() => handleRestoreRoom(room)}
                          className="text-xs cursor-pointer gap-2 py-1.5 text-emerald-600 dark:text-emerald-400 focus:text-emerald-600 focus:bg-emerald-50 dark:focus:bg-emerald-950/40"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                          <span>Pulihkan Ruang</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(room)}
                          className="text-xs cursor-pointer gap-2 py-1.5 text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/40"
                        >
                          <Trash className="h-3.5 w-3.5" />
                          <span>Hapus Permanen</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ], [inspectedRoom, liveBreakdown, terminology, isOwner, handleQuestionsClick, handleMonitorClick, navigate, handleEditClick, handleToggleDisabled, handleArchiveRoom, handleRestoreRoom, handleDeleteClick, activeTab]);

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans overflow-x-hidden">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_320px] gap-6 items-start">

          {/* ═══════════════════════════════════════════════════════════════
              CENTER / MAIN CONTENT
             ═══════════════════════════════════════════════════════════════ */}
          <div className="min-w-0 space-y-6">

            {/* 1. Header Bar: Title & Primary Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                  Ruang Ujian &amp; Sesi CBT
                </h1>
                {/* Breadcrumb line */}
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <Link to="/admin" className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                    Semua Modul
                  </Link>
                  <span>/</span>
                  <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                    {school?.slug || "modalbangsa"}
                  </span>
                  <span>/</span>
                  <div className="flex items-center gap-1 text-neutral-800 dark:text-neutral-200 font-medium">
                    <GitBranch className="h-3.5 w-3.5 text-neutral-500" />
                    <span>ruang-ujian</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Top Right: Bersih & Tidak Semak */}
              <div className="flex items-center gap-2 shrink-0">
                {filteredRooms.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleExportZip()}
                    disabled={isExporting}
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    title="Export seluruh rekap hasil ujian ke ZIP"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{isExporting ? "Mengekspor..." : "Export ZIP"}</span>
                  </button>
                )}

                {canCreate && (
                  <button
                    type="button"
                    onClick={handleCreateClick}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Buka Ruang</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. Clean Horizontal Tabs: Ruang Aktif vs Ruang Diarsipkan */}
            <NeonTabs
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                {
                  id: "aktif",
                  label: "Ruang Aktif",
                  count: rooms.filter(r => r.status !== "archive").length,
                  indicator: true,
                },
                {
                  id: "arsip",
                  label: "Ruang Diarsipkan",
                  count: rooms.filter(r => r.status === "archive").length,
                },
              ]}
            />

            {/* 3. Stats Strip (4 Kartu Ringkas, Elegan, Sama Ukuran dengan Bank Soal) */}
            <NeonStatGrid cols={4}>
              <NeonStatCard
                label="Total Ruang Ujian"
                value={rooms.length}
                unit="ruang"
                isLoading={isLoading}
              />

              <NeonStatCard
                label="Ruang Ujian Aktif"
                indicator={true}
                value={rooms.filter(r => r.status !== "archive").length}
                unit="ruang"
                isLoading={isLoading}
              />

              <NeonStatCard
                label={`${terminology.student} Aktif`}
                indicator={true}
                value={totalOngoing}
                unit="siswa"
                isLoading={isLoading}
              />

              <NeonStatCard
                label={<span className="whitespace-nowrap">Token Universal</span>}
                indicator={<TokenTimeLeftBadge />}
                value={
                  <code className="tracking-wider">
                    {universalToken || "------"}
                  </code>
                }
                actionSlot={
                  universalToken ? (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(universalToken);
                        setCopiedToken(true);
                        addToast({
                          type: "success",
                          title: "Token Disalin",
                          description: `Token Universal ${universalToken} disalin ke clipboard.`
                        });
                        setTimeout(() => setCopiedToken(false), 2000);
                      }}
                      className="h-7 w-7 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Salin Token Universal"
                    >
                      {copiedToken ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : null
                }
              />
            </NeonStatGrid>

            {/* 3. Main Neon Table Section */}
            <NeonTable
              data={displayRooms}
              columns={neonColumns}
              keyExtractor={(r) => r.id}
              isLoading={isLoading}
              title="Daftar Ruang Ujian & Sesi CBT"
              subtitle="Klik baris ruangan untuk melihat inspeksi parameter & status live di panel sebelah kanan."
              searchValue={tableSearch}
              onSearchChange={setTableSearch}
              searchPlaceholder="Cari ruang ujian, pengampu, mapel, kelas, token..."
              filterSlot={
                <div className="flex flex-wrap items-center gap-2 max-w-full">
                  {/* Status Pills */}
                  {activeTab === "aktif" && (
                    <div className="flex flex-wrap items-center gap-1 bg-neutral-100 dark:bg-neutral-850 p-0.5 rounded-md text-[11px] font-medium border border-neutral-200/60 dark:border-neutral-800 max-w-full">
                      <button
                        type="button"
                        onClick={() => setStatusFilter("all")}
                        className={cn(
                          "px-2 py-1 rounded transition-colors cursor-pointer",
                          statusFilter === "all"
                            ? "bg-white dark:bg-neutral-750 text-neutral-900 dark:text-white font-semibold shadow-2xs"
                            : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
                        )}
                      >
                        Semua ({statusCounts.all})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("ongoing")}
                        className={cn(
                          "px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1",
                          statusFilter === "ongoing"
                            ? "bg-white dark:bg-neutral-750 text-emerald-700 dark:text-emerald-400 font-semibold shadow-2xs"
                            : "text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Berjalan ({statusCounts.ongoing})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("waiting")}
                        className={cn(
                          "px-2 py-1 rounded transition-colors cursor-pointer",
                          statusFilter === "waiting"
                            ? "bg-white dark:bg-neutral-750 text-sky-700 dark:text-sky-400 font-semibold shadow-2xs"
                            : "text-neutral-500 hover:text-sky-600 dark:hover:text-sky-400"
                        )}
                      >
                        Menunggu ({statusCounts.waiting})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("finished")}
                        className={cn(
                          "px-2 py-1 rounded transition-colors cursor-pointer",
                          statusFilter === "finished"
                            ? "bg-white dark:bg-neutral-750 text-neutral-800 dark:text-white font-semibold shadow-2xs"
                            : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
                        )}
                      >
                        Selesai ({statusCounts.finished})
                      </button>
                      {statusCounts.disabled > 0 && (
                        <button
                          type="button"
                          onClick={() => setStatusFilter("disabled")}
                          className={cn(
                            "px-2 py-1 rounded transition-colors cursor-pointer",
                            statusFilter === "disabled"
                              ? "bg-white dark:bg-neutral-750 text-rose-700 dark:text-rose-400 font-semibold shadow-2xs"
                              : "text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400"
                          )}
                        >
                          Nonaktif ({statusCounts.disabled})
                        </button>
                      )}
                    </div>
                  )}

                  {/* Group Filter Dropdown */}
                  {availableGroups.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "h-7 px-2.5 rounded-md text-[11px] font-medium border flex items-center gap-1.5 transition-colors cursor-pointer",
                            groupFilter !== "all"
                              ? "bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-semibold"
                              : "bg-white dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          <Folder className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                          <span className="max-w-[130px] truncate">
                            {groupFilter === "all"
                              ? "Semua Group"
                              : groupFilter === "__none__"
                              ? "Tanpa Group"
                              : groupFilter}
                          </span>
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 text-xs">
                        <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                          Filter Group Ruangan
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setGroupFilter("all")} className="cursor-pointer">
                          Semua Group ({filteredRooms.length})
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {availableGroups.map((grp) => {
                          const count = filteredRooms.filter(r => (r.group_name || "").trim().toLowerCase() === grp.toLowerCase()).length;
                          return (
                            <DropdownMenuItem
                              key={grp}
                              onClick={() => setGroupFilter(grp)}
                              className="cursor-pointer flex items-center justify-between"
                            >
                              <span className="truncate">{grp}</span>
                              <span className="text-[10px] font-mono text-neutral-400">{count}</span>
                            </DropdownMenuItem>
                          );
                        })}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setGroupFilter("__none__")} className="cursor-pointer flex items-center justify-between text-neutral-500">
                          <span>Tanpa Group</span>
                          <span className="text-[10px] font-mono text-neutral-400">
                            {filteredRooms.filter(r => !r.group_name || !r.group_name.trim()).length}
                          </span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              }
              selectable={true}
              selectedKeys={selectedIds}
              onSelectionChange={setSelectedIds}
              isItemSelectable={isOwner}
              batchActions={
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setBatchGroupInput("");
                      setBatchGroupDialogOpen(true);
                    }}
                    className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-purple-600 dark:text-purple-400 font-medium hover:bg-purple-50 dark:hover:bg-purple-950/40 text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Folder className="h-3 w-3" />
                    <span>Set Group</span>
                  </button>
                  {activeTab === "aktif" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleBatchToggleStatus(true)}
                        className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[11px] transition-colors cursor-pointer"
                      >
                        Aktifkan
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBatchToggleStatus(false)}
                        className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-rose-600 dark:text-rose-400 font-medium hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] transition-colors cursor-pointer"
                      >
                        Nonaktifkan
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const chosen = rooms.filter(r => selectedIds.includes(r.id));
                          handleExportZip(chosen);
                        }}
                        className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[11px] transition-colors cursor-pointer"
                      >
                        Export Rekap
                      </button>
                      <button
                        type="button"
                        onClick={handleBatchArchive}
                        className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-amber-600 dark:text-amber-400 font-medium hover:bg-amber-50 dark:hover:bg-amber-950/40 text-[11px] transition-colors cursor-pointer"
                      >
                        Arsipkan
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleBatchRestore}
                        className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-indigo-600 dark:text-indigo-400 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-[11px] transition-colors cursor-pointer"
                      >
                        Pulihkan
                      </button>
                      <button
                        type="button"
                        onClick={handleBatchDelete}
                        className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-rose-600 dark:text-rose-400 font-medium hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] transition-colors cursor-pointer"
                      >
                        Hapus Permanen
                      </button>
                    </>
                  )}
                </div>
              }
              activeKey={inspectedRoom?.id}
              onRowClick={(room) => setInspectedRoomId(room.id)}
              emptyTitle={activeTab === "aktif" ? "Belum Ada Ruang Ujian Aktif" : "Belum Ada Ruang Ujian Arsip"}
              emptySubtitle={
                tableSearch
                  ? "Tidak ada ruang ujian yang sesuai dengan kriteria filter atau pencarian Anda."
                  : "Jadwalkan ruang ujian CBT baru untuk memulai sesi pengerjaan ujian."
              }
              emptyAction={
                canCreate && activeTab === "aktif" ? (
                  <button
                    type="button"
                    onClick={handleCreateClick}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Buka Ruang Ujian Baru</span>
                  </button>
                ) : null
              }
            />

          </div>

          {/* ═══════════════════════════════════════════════════════════════
              RIGHT SIDEBAR / INSPECTOR PANEL (Neon Style Reusable Component)
             ═══════════════════════════════════════════════════════════════ */}
          <NeonInspector>

            {/* 1. Detail Ruang Terpilih (Inspector) */}
            <InspectorSection>
              <InspectorHeader
                title="Detail Ruang Ujian"
                icon={GitBranch}
                badge={inspectedRoom ? "Terpilih" : "Ringkasan"}
              />

              {inspectedRoom ? (
                <div className="space-y-2.5 text-xs">
                  <InspectorField
                    label="Nama Ruangan"
                    value={inspectedRoom.room_name || inspectedRoom.examTitle || "Tanpa Nama"}
                  />

                  <InspectorField
                    label="Pengampu & Mata Pelajaran"
                    value={`${inspectedRoom.teacherName} • ${inspectedRoom.subjectName}`}
                  />

                  <InspectorField
                    label="Paket Bank Soal"
                    value={inspectedRoom.examTitle}
                  />

                  <InspectorGrid>
                    <InspectorField
                      label="Group Sesi"
                      value={inspectedRoom.group_name || "Tanpa Group"}
                    />
                    <InspectorField
                      label="Alokasi Siswa"
                      value={inspectedRoom.className || "Semua Kelas"}
                    />
                  </InspectorGrid>

                  <InspectorField
                    label="Durasi Pengerjaan"
                    value={`${inspectedRoom.duration} Menit`}
                  />

                  <InspectorGrid>
                    <InspectorField label="Siswa Sedang Aktif">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{liveBreakdown[inspectedRoom.id] || 0} Siswa</span>
                      </div>
                    </InspectorField>
                    <InspectorField
                      label="Status Ruangan"
                      value={inspectedRoom.isDisabled ? "Nonaktif" : "Aktif / Siap"}
                    />
                  </InspectorGrid>

                  <InspectorActions>
                    <InspectorButton
                      variant="primary"
                      icon={Search}
                      onClick={() => handleMonitorClick(inspectedRoom)}
                    >
                      Buka Live Monitoring Ruang
                    </InspectorButton>
                    <InspectorButton
                      variant="secondary"
                      icon={CheckSquare}
                      onClick={() => navigate(`/admin/penilaian?roomId=${inspectedRoom.id}`)}
                    >
                      Buka Lembar Penilaian
                    </InspectorButton>
                  </InspectorActions>
                </div>
              ) : (
                <InspectorEmpty message="Pilih atau arahkan kursor ke salah satu ruang ujian." />
              )}
            </InspectorSection>

            {/* 2. Token Sesi & Parameter Global */}
            <InspectorSection divided>
              <InspectorHeader
                title="Token & Akses Peserta"
                icon={Lock}
              />

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Token Universal</span>
                  <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                    {universalToken || "------"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Sisa Waktu Token</span>
                  <TokenTimeLeftText />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Mode Proteksi</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Kiosk Exambro Wajib
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Batas Pelanggaran</span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    Otomatis Kunci
                  </span>
                </div>
              </div>
            </InspectorSection>

            {/* 3. Link Cepat Portal Siswa */}
            <InspectorCard
              title="Portal Akses Peserta"
              icon={ExternalLink}
              description="Siswa dapat langsung membuka portal login ujian menggunakan domain sekolah atau Exambro."
            >
              <InspectorButton
                variant="secondary"
                icon={Copy}
                onClick={() => {
                  const url = getStudentExamUrl(school?.slug);
                  navigator.clipboard.writeText(url);
                  addToast({ title: "Tautan Disalin", description: `${url} disalin ke clipboard.`, type: "success" });
                }}
              >
                Salin Link Ujian Siswa
              </InspectorButton>
            </InspectorCard>

          </NeonInspector>
        </div>
      </div>

      {/* Dialog Create/Edit (Neon Console Split Pane) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[88vh] max-h-[820px] overflow-hidden p-0 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0c0d0e] shadow-2xl flex flex-col">

          {/* 1. Header Dialog */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0c0d0e] shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <BookOpen className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {dialogMode === "edit" ? "Edit Ruang Ujian" : "Buka Ruang Ujian Baru"}
                  </h2>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-700/60">
                    {dialogMode === "edit" ? "Edit Mode" : "Sesi Ujian"}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Konfigurasikan bank soal, jadwal pelaksanaan, aturan anti-cheat, dan distribusi peserta.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Main Content: 2-Pane Split (Kiri: Bank Soal, Kanan: Form Konfigurasi) */}
          <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-hidden">

            {/* Pane Kiri: Pemilihan Bank Soal (col-span-5) */}
            <div className="md:col-span-5 border-r border-neutral-200 dark:border-neutral-800 flex flex-col bg-neutral-50/40 dark:bg-neutral-900/20 min-h-0">

              {/* Header List Bank Soal */}
              <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  1. Pilih Bank Soal
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  {filteredExams.length} bank
                </span>
              </div>

              {/* Search Box Terintegrasi */}
              <div className="p-2.5 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                  <Input
                    placeholder="Cari judul / mapel / guru..."
                    value={examSearch}
                    onChange={(e) => setExamSearch(e.target.value)}
                    disabled={isEditRestricted}
                    className="pl-8 pr-2.5 h-8 text-xs rounded-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus-visible:ring-1 focus-visible:ring-emerald-500"
                  />
                </div>
              </div>

              {/* List Bank Soal yang Sleek */}
              <div className={`flex-1 overflow-y-auto p-2 space-y-1.5 ${isEditRestricted ? "opacity-60 pointer-events-none" : ""}`}>
                {filteredExams.length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-400">
                    <Search className="h-6 w-6 mx-auto mb-2 text-neutral-300 dark:text-neutral-600" />
                    Tidak ada bank soal yang cocok
                  </div>
                ) : (
                  visibleExamOptions.map((e) => {
                    const subjectName = subjects.find((m: any) => m.id === (e.subjectId || e.subjectid))?.name || "-";
                    const teacherName = masterTeachers.find((t: any) => t.id === (e.teacherId || e.teacherid))?.name || "-";
                    const qCount = examQuestionCounts[e.id];
                    const selected = formValues.examId === e.id;

                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setFormValues({ ...formValues, examId: e.id })}
                        className={cn(
                          "w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer select-none relative group",
                          selected
                            ? "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12] border-emerald-500/50 text-neutral-900 dark:text-neutral-100 shadow-2xs"
                            : "bg-white dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-100/50 dark:hover:bg-neutral-850/50 text-neutral-700 dark:text-neutral-300"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn("text-xs font-semibold leading-snug line-clamp-2", selected ? "text-emerald-700 dark:text-emerald-400" : "text-neutral-800 dark:text-neutral-200")}>
                            {e.title}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-700/60 shrink-0">
                            {e.examType || "PAS"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                          <span className="font-medium text-neutral-700 dark:text-neutral-300">{subjectName}</span>
                          <span>•</span>
                          <span className="truncate">{teacherName}</span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 dark:text-neutral-500 mt-1.5 pt-1.5 border-t border-neutral-100 dark:border-neutral-850">
                          <span>{qCount !== undefined ? `${qCount} Butir Soal` : "Soal termuat"}</span>
                          {selected && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                              <Check className="h-3 w-3" />
                              Terpilih
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Status Pemilihan di Bottom Pane Kiri */}
              <div className="p-2.5 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0c0d0e] shrink-0 text-xs">
                {formValues.examId ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-neutral-500 truncate max-w-[200px]">
                      Terpilih: <b className="text-neutral-800 dark:text-neutral-200">{exams.find((x: any) => x.id === formValues.examId)?.title || "Soal"}</b>
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      Siap
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-rose-500 font-medium">
                    ⚠️ Silakan klik salah satu bank soal di atas.
                  </span>
                )}
              </div>

            </div>

            {/* Pane Kanan: Konfigurasi Ruang & Jadwal (col-span-7) */}
            <div className="md:col-span-7 flex flex-col min-h-0 bg-white dark:bg-[#0c0d0e]">

              {/* Header Pane Kanan */}
              <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  2. Konfigurasi Ruangan & Aturan
                </span>
                <span className="text-[10px] text-neutral-400">
                  Sesuaikan parameter ujian
                </span>
              </div>

              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {isEditRestricted && (
                  <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 p-2.5 rounded-md text-xs">
                    <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>Ujian berlangsung. Beberapa konfigurasi bank soal dikunci agar tidak merusak data siswa.</span>
                  </div>
                )}

                <form id="room-form" onSubmit={handleSubmit} className="space-y-5">

                  {/* 1. Nama Ruangan & Group */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Nama Ruang Ujian <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        placeholder="Contoh: Ruang 01 / Gelombang 1"
                        value={formValues.room_name}
                        onChange={(e) => setFormValues({ ...formValues, room_name: e.target.value })}
                        required
                        className="h-8.5 text-xs rounded-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus-visible:ring-1 focus-visible:ring-emerald-500"
                      />
                      <p className="text-[10px] text-neutral-400 mt-1">Muncul pada kartu tes &amp; login siswa.</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          Group Ujian
                        </label>
                        <span className="text-[10px] text-neutral-400">Opsional</span>
                      </div>
                      <Input
                        list="room-group-form-suggestions"
                        placeholder="Contoh: Ujian Semester 2 2026"
                        value={formValues.group_name}
                        onChange={(e) => setFormValues({ ...formValues, group_name: e.target.value })}
                        className="h-8.5 text-xs rounded-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus-visible:ring-1 focus-visible:ring-emerald-500"
                      />
                      <datalist id="room-group-form-suggestions">
                        {availableGroups.map((grp) => (
                          <option key={grp} value={grp} />
                        ))}
                      </datalist>
                      {availableGroups.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {availableGroups.slice(0, 3).map((grp) => (
                            <button
                              key={grp}
                              type="button"
                              onClick={() => setFormValues({ ...formValues, group_name: grp })}
                              className="px-1.5 py-0.2 rounded text-[9px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 transition-colors cursor-pointer"
                            >
                              +{grp}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Jadwal Pelaksanaan */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-850">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-2.5">
                      <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Jadwal Pelaksanaan</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                          Waktu Mulai
                        </label>
                        <Input
                          type="datetime-local"
                          value={formValues.start_time}
                          onChange={(e) => handleStartTimeChange(e.target.value)}
                          required
                          className="h-8 text-xs font-mono rounded-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus-visible:ring-1 focus-visible:ring-emerald-500"
                        />
                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          <span className="text-[10px] text-neutral-400 mr-0.5">Preset:</span>
                          {[
                            { label: "Skrg", handler: handleSetNow },
                            { label: "07:45", h: 7, m: 45 },
                            { label: "09:40", h: 9, m: 40 },
                            { label: "10:10", h: 10, m: 10 },
                            { label: "11:40", h: 11, m: 40 },
                          ].map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              onClick={p.handler ?? (() => {
                                const s = new Date(); s.setHours(p.h!, p.m!, 0, 0);
                                setFormValues(prev => ({ ...prev, start_time: formatLocalDateTime(s), end_time: formatLocalDateTime(new Date(s.getTime() + prev.duration * 60000)) }));
                              })}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 transition-colors cursor-pointer"
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                          Waktu Berakhir
                        </label>
                        <Input
                          type="datetime-local"
                          value={formValues.end_time}
                          onChange={(e) => setFormValues({ ...formValues, end_time: e.target.value })}
                          required
                          className="h-8 text-xs font-mono rounded-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus-visible:ring-1 focus-visible:ring-emerald-500"
                        />
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Batas akhir akses token sesi pengerjaan.</p>
                      </div>
                    </div>
                  </div>

                  {/* 3. Durasi, Integritas & Parameter */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-850">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-2.5">
                      <Clock className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Durasi & Integritas Ujian</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                          Durasi (Menit)
                        </label>
                        <Input
                          type="number"
                          value={formValues.duration || ""}
                          onChange={(e) => handleDurationChange(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                          required
                          className="h-8 text-xs font-mono rounded-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus-visible:ring-1 focus-visible:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                          Toleransi Cheat
                        </label>
                        <Input
                          type="number"
                          value={formValues.cheat_limit || ""}
                          onChange={(e) => setFormValues({ ...formValues, cheat_limit: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                          required
                          className="h-8 text-xs font-mono rounded-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus-visible:ring-1 focus-visible:ring-emerald-500"
                        />
                        <p className="text-[10px] text-neutral-400 mt-0.5">x keluar aplikasi</p>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                          Kumpul Dibuka
                        </label>
                        <Input
                          type="number"
                          placeholder="0 = Kapan saja"
                          value={formValues.submit_window || ""}
                          onChange={(e) => setFormValues({ ...formValues, submit_window: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                          className="h-8 text-xs font-mono rounded-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus-visible:ring-1 focus-visible:ring-emerald-500"
                        />
                        <p className="text-[10px] text-neutral-400 mt-0.5">Menit ke-</p>
                      </div>
                    </div>
                  </div>

                  {/* 4. Distribusi Soal & Pengacakan */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-850">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                            Jumlah Butir Soal
                          </label>
                          {formValues.examId && examQuestionCounts[formValues.examId] !== undefined && (
                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                              Max {examQuestionCounts[formValues.examId]}
                            </span>
                          )}
                        </div>
                        <Input
                          type="number"
                          placeholder="0 = Semua"
                          value={formValues.max_questions || ""}
                          onChange={(e) => setFormValues({ ...formValues, max_questions: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                          className="h-8 text-xs font-mono rounded-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus-visible:ring-1 focus-visible:ring-emerald-500"
                        />
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          {formValues.max_questions && formValues.max_questions > 0
                            ? `Ambil acak ${formValues.max_questions} soal`
                            : "Semua soal diujikan"}
                        </p>
                      </div>

                      {/* Acak Soal Toggle */}
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                          Pengacakan Soal
                        </label>
                        <label className="flex items-center justify-between h-8 px-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer transition-colors select-none">
                          <span className="text-xs text-neutral-700 dark:text-neutral-300">Acak Butir & Opsi</span>
                          <div className="relative inline-flex items-center shrink-0">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={formValues.randomize_questions !== false}
                              onChange={(e) => setFormValues({ ...formValues, randomize_questions: e.target.checked })}
                            />
                            <div className="w-7 h-4 bg-neutral-300 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all shadow-2xs" />
                          </div>
                        </label>
                        <p className="text-[10px] text-neutral-400 mt-0.5">Acak urutan A–E & butir</p>
                      </div>

                      {/* Hasil Ujian Toggle */}
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                          Hasil ke Peserta
                        </label>
                        <label className="flex items-center justify-between h-8 px-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer transition-colors select-none">
                          <span className="text-xs text-neutral-700 dark:text-neutral-300">Tampilkan Nilai</span>
                          <div className="relative inline-flex items-center shrink-0">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={formValues.show_result !== false}
                              onChange={(e) => setFormValues({ ...formValues, show_result: e.target.checked })}
                            />
                            <div className="w-7 h-4 bg-neutral-300 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all shadow-2xs" />
                          </div>
                        </label>
                        <p className="text-[10px] text-neutral-400 mt-0.5">Siswa dapat melihat skor</p>
                      </div>
                    </div>
                  </div>

                  {/* 5. Target Kelas */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-850">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                          Target {terminology.class}
                        </span>
                        <p className="text-[11px] text-neutral-400">
                          {formValues.allClasses
                            ? `Seluruh ${examClasses.length} kelas aktif diikutsertakan ke ruangan ini.`
                            : "Pilih kelas spesifik yang dapat mengakses ruangan."}
                        </p>
                      </div>

                      <div className="inline-flex p-0.5 rounded-md bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 text-xs">
                        <button
                          type="button"
                          onClick={() => setFormValues({ ...formValues, allClasses: true, classId: "" })}
                          className={cn(
                            "px-2.5 py-1 rounded text-xs transition-colors cursor-pointer",
                            formValues.allClasses
                              ? "bg-white dark:bg-neutral-900 font-semibold text-neutral-900 dark:text-neutral-100 shadow-2xs"
                              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          Semua Kelas
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormValues({ ...formValues, allClasses: false })}
                          className={cn(
                            "px-2.5 py-1 rounded text-xs transition-colors cursor-pointer",
                            !formValues.allClasses
                              ? "bg-white dark:bg-neutral-900 font-semibold text-neutral-900 dark:text-neutral-100 shadow-2xs"
                              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          Pilih Parsial
                        </button>
                      </div>
                    </div>

                    {!formValues.allClasses && (
                      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-2.5 bg-neutral-50/50 dark:bg-neutral-900/40">
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          {[...examClasses]
                            .sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true }))
                            .map((c: any) => {
                              const isChecked = formValues.classId ? formValues.classId.split(",").includes(c.id) : false;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={(e) => handleClassToggle(c.id, !isChecked, e.shiftKey)}
                                  className={cn(
                                    "px-2 py-0.5 rounded text-xs font-medium border transition-colors select-none cursor-pointer",
                                    isChecked
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 font-semibold"
                                      : "bg-white dark:bg-neutral-850 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                                  )}
                                >
                                  {c.name}
                                </button>
                              );
                            })}
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-2">
                          💡 Tahan <kbd className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-[9px]">Shift</kbd> + klik untuk rentang kelas.
                        </p>
                      </div>
                    )}
                  </div>

                </form>
              </div>

            </div>

          </div>

          {/* 3. Footer Sticky */}
          <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/90 dark:bg-neutral-900/60 backdrop-blur-xs flex items-center justify-between shrink-0">
            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-md hidden sm:block">
              {formValues.examId ? (
                <span>Siap meluncurkan ujian dengan bank soal terpilih.</span>
              ) : (
                <span className="text-rose-500">Pilih bank soal di kolom kiri untuk melanjutkan.</span>
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="h-8 px-3.5 rounded-md text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                form="room-form"
                disabled={!formValues.examId}
                className="h-8 px-4 rounded-md font-semibold text-xs bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white transition-colors shadow-xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {dialogMode === "edit" ? "Perbarui Ruangan" : "Buka Ruangan"}
              </button>
            </div>
          </div>

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
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] bg-white dark:bg-[#0c0d0e] rounded-2xl overflow-hidden p-0 border border-neutral-200/90 dark:border-neutral-800 shadow-2xl dark:shadow-[0_0_50px_rgba(16,185,129,0.08)]">
          <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-[#111214] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <Users className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] shrink-0" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight truncate">
                  Daftar {terminology.class} Terdaftar
                </h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                Ruang: {showClassesRoom?.room_name || showClassesRoom?.examTitle}
              </p>
            </div>
          </div>
          <div className="p-5 max-h-[55vh] overflow-y-auto bg-white dark:bg-[#0c0d0e]">
            <div className="flex flex-wrap gap-1.5">
              {(showClassesRoom?.className || "").split(", ").map((cls, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"></span>
                  <span>{cls}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="p-3.5 bg-neutral-50/70 dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-neutral-800">
            <Button onClick={() => setShowClassesRoom(null)} variant="outline" className="w-full h-8.5 text-xs font-semibold rounded-xl border-neutral-200 dark:border-neutral-800">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Atur Group Massal */}
      <Dialog open={batchGroupDialogOpen} onOpenChange={setBatchGroupDialogOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] bg-white dark:bg-[#0c0d0e] rounded-2xl overflow-hidden p-0 border border-neutral-200/90 dark:border-neutral-800 shadow-2xl dark:shadow-[0_0_50px_rgba(16,185,129,0.08)]">
          <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-[#111214] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <Folder className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] shrink-0" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight truncate">
                  Atur Group Ruang Ujian
                </h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                Terapkan group untuk <span className="font-semibold text-neutral-800 dark:text-neutral-200">{selectedIds.length} ruang ujian</span> terpilih.
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4 bg-white dark:bg-[#0c0d0e]">
            <div>
              <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                Nama Group Ujian
              </label>
              <Input
                list="batch-group-suggestions-er"
                placeholder="Contoh: Ujian Semester 2 2026 / Try Out 1"
                value={batchGroupInput}
                onChange={(e) => setBatchGroupInput(e.target.value)}
                className="h-10 text-xs rounded-xl bg-neutral-50/70 dark:bg-neutral-900/80 border-neutral-200 dark:border-neutral-800 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                autoFocus
              />
              <datalist id="batch-group-suggestions-er">
                {availableGroups.map((grp) => (
                  <option key={grp} value={grp} />
                ))}
              </datalist>
            </div>

            {availableGroups.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block mb-1.5">
                  Atau klik group yang sudah ada:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/70 dark:border-neutral-800">
                  {availableGroups.map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setBatchGroupInput(grp)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border select-none",
                        batchGroupInput.trim() === grp
                          ? "bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs"
                          : "bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-emerald-500"
                      )}
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-3.5 bg-neutral-50/70 dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleApplyBatchGroup("")}
              className="h-8.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 rounded-xl"
            >
              Kosongkan Group
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBatchGroupDialogOpen(false)}
                className="h-8.5 text-xs rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleApplyBatchGroup(batchGroupInput)}
                disabled={!batchGroupInput.trim()}
                className="h-8.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/25 disabled:opacity-40"
              >
                Terapkan Group
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Operation Progress Dialog */}
      <BatchProgressDialog progress={batchProgress} />
    </div>
  );
};

export default ExamRoomsPage;
