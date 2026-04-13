import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Users,
  Lock,
  ChevronDown,
  CheckCircle2,
  X,
  FileSpreadsheet,
  BookOpen,
  ArrowLeft,
  Search,
  Monitor,
  Square,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  Settings
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";
import pb from "../../lib/pocketbase";
import { useExamData } from "../../context/ExamDataContext";
import { useAuth } from "../../context/AuthContext";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";

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
  token_updated_at?: string;
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

// 🛡️ Fuzzy Match Helper for Short Answers
const isFuzzyMatch = (studentAns: any, correctKey: string) => {
  if (typeof studentAns !== "string" || !correctKey) return false;
  const sAns = studentAns.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const cKey = correctKey.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (sAns === cKey) return true;
  if (!sAns || !cKey) return false;
  if (cKey.length < 3) return sAns === cKey;
  const distance = (a: string, b: string) => {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + cost);
      }
    }
    return matrix[b.length][a.length];
  };
  const dist = distance(sAns, cKey);
  const maxAllowed = cKey.length > 8 ? 2 : (cKey.length >= 4 ? 1 : 0);
  return dist <= maxAllowed;
};

const MonitoringPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { classes: examClasses, students, subjects, teachers: masterTeachers, loading: dataLoading } = useExamData();

  const [loading, setLoading] = useState(true);
  const [monitorRoom, setMonitorRoom] = useState<ExamRoomData | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [monitorQuestions, setMonitorQuestions] = useState<any[]>([]);
  const [answersList, setAnswersList] = useState<Record<string, any>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedstudent, setExpandedstudent] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [monitorPage, setMonitorPage] = useState(1);
  const [monitorPageSize, setMonitorPageSize] = useState(25);
  const [monitorClassFilter, setMonitorClassFilter] = useState("all");
  const [monitorSortBy, setMonitorSortBy] = useState<"default" | "nama" | "nilai" | "login" | "status">("status");
  const [monitorTimeLeft, setMonitorTimeLeft] = useState(0);
  const [isMonitorRefreshing, setIsMonitorRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 📝 Real-time Live Score Calculator
  const getLiveScore = (sisAnswers: Record<string, any>, attOverrides: Record<string, boolean> = {}) => {
    if (!sisAnswers || monitorQuestions.length === 0) return 0;
    
    let correctCount = 0;
    monitorQuestions.forEach((q: any) => {
      let itemCorrect = false;
      
      // 1. Check for Manual Overrides (if teacher manually marked it)
      if (attOverrides[q.id] !== undefined) {
        itemCorrect = attOverrides[q.id];
      } else {
        const ansId = sisAnswers[q.id];
        if (ansId !== undefined && ansId !== null) {
          const type = q.type || "pilihan_ganda";
          
          if (type === "pilihan_ganda" || type === "benar_salah") {
            const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ansId).toLowerCase());
            itemCorrect = ck ? q.choices[ck].isCorrect === true : false;
          } else if (type === "pilihan_ganda_kompleks") {
            const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase());
            const studentKeys = Array.isArray(ansId) ? ansId.map(k => String(k).toLowerCase()) : [];
            itemCorrect = studentKeys.length === correctKeys.length && studentKeys.every(k => correctKeys.includes(k));
          } else if (type === "isian_singkat") {
            itemCorrect = isFuzzyMatch(ansId, q.answerKey);
          } else if (type === "urutkan" || type === "drag_drop") {
            const co = (q.items || []).map((it: any) => it.id);
            itemCorrect = Array.isArray(ansId) && ansId.length === co.length && ansId.every((v, i) => v === co[i]);
          } else if (type === "menjodohkan") {
            const pairs = q.pairs || [];
            itemCorrect = pairs.length > 0 && pairs.every((p: any) => ansId[p.id] === p.right);
          }
        }
      }
      
      if (itemCorrect) correctCount++;
    });

    const total = monitorQuestions.length;
    return total > 0 ? Math.round((correctCount / total) * 100) : 0;
  };

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

  const teacherId = user?.id;

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

  const handleManualRefreshMonitor = useCallback(async (targetRoomId?: string) => {
    const id = targetRoomId || roomId;
    if (!id) return;

    setIsMonitorRefreshing(true);
    try {
      // 1. Ambil Data Ruangan jika belum ada
      let currentRoom = monitorRoom;
      if (!currentRoom) {
        const roomRecord = await pb.collection('exam_rooms').getOne(id);
        const examObj = await pb.collection('exams').getOne(roomRecord.examId).catch(() => null);

        // Robust mapping similar to ExamRoomsPage
        const sId = roomRecord.examId || (roomRecord as any).examid || "";
        const roomName = roomRecord.room_name || (roomRecord as any).title || roomRecord.title || "Tanpa Nama";
        const isOff = roomRecord.isDisabled !== undefined ? roomRecord.isDisabled : (roomRecord as any).isActive === false;

        // Robust mapping for Class IDs
        const isAllClasses = roomRecord.allClasses || (roomRecord as any).all_classes || false;
        const clsData = roomRecord.classId || (roomRecord as any).classid || (roomRecord as any).classIds || (roomRecord as any).classids || "";
        let classList: string[] = [];

        if (!isAllClasses) {
          if (Array.isArray(clsData)) {
            classList = clsData;
          } else if (typeof clsData === 'string' && clsData.length > 0) {
            classList = clsData.split(",").map(id => id.trim()).filter(Boolean);
          }
        }

        currentRoom = {
          ...roomRecord,
          room_name: roomName,
          examId: sId,
          examTitle: examObj?.title || "...",
          examTeacherId: examObj?.teacherId,
          examType: (examObj as any)?.examType || (examObj as any)?.examtype || "UMUM",
          isDisabled: isOff,
          allClasses: isAllClasses,
          classId: classList.length > 0 ? classList : (roomRecord.classId || [])
        } as any;
        setMonitorRoom(currentRoom);
      }

      // 2. Ambil DAFTAR SOAL
      if (monitorQuestions.length === 0 && currentRoom) {
        const qList = await pb.collection('questions').getFullList({
          filter: `examId = "${currentRoom.examId}"`,
          sort: 'order,created'
        });

        const mappedQuestions = qList.map(q => {
          const rawType = q.field || q.type || "pilihan_ganda";
          const typeMapReverse: Record<string, string> = {
            multiple_choice: "pilihan_ganda",
            complex_multiple_choice: "pilihan_ganda_kompleks",
            matching: "menjodohkan",
            true_false: "benar_salah",
            short_answer: "isian_singkat",
            essay: "uraian",
            ordering: "urutkan",
            drag_drop: "drag_drop",
            pilihan_ganda: "pilihan_ganda",
            pilihan_ganda_kompleks: "pilihan_ganda_kompleks",
            isian_singkat: "isian_singkat",
            uraian: "uraian",
            menjodohkan: "menjodohkan",
            urutkan: "urutkan",
            benar_salah: "benar_salah"
          };
          const mappedType = typeMapReverse[rawType] || rawType;
          const options = q.options || {};
          return {
            ...q,
            type: mappedType,
            choices: options,
            pairs: mappedType === "menjodohkan" ? options.pairs : undefined,
            items: (mappedType === "urutkan" || mappedType === "drag_drop") ? options.items : undefined,
            answerKey: q.correctAnswer || q.answerKey
          };
        });
        setMonitorQuestions(mappedQuestions);
      }

      // 3. Ambil DATA PENGERJAAN
      const loadedAttempts = await pb.collection('attempts').getFullList({
        filter: `examRoomId = "${id}"`
      });

      const grouped: Record<string, any> = {};
      loadedAttempts.forEach(att => {
        const sId = att.studentId || att.student_id;
        if (sId && att.answers) grouped[sId] = att.answers;
      });

      setAnswersList(grouped);
      setAttempts(loadedAttempts);
    } catch (e) {
      console.error("Refresh Monitor Error:", e);
    } finally {
      setIsMonitorRefreshing(false);
      setLoading(false);
    }
  }, [roomId, monitorRoom, monitorQuestions.length]);

  // Initial Fetch
  useEffect(() => {
    handleManualRefreshMonitor();
  }, [roomId]);

  // Timer for Token-like effect/Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const bucket = Math.floor(now / 300000);
      setMonitorTimeLeft(Math.floor(((bucket + 1) * 300000 - now) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Subscription
  useEffect(() => {
    if (!roomId) return;

    let isSubscribed = true;
    let currentUnsub: (() => void) | null = null;

    const startSubscribe = async () => {
      try {
        const unsub = await pb.collection('attempts').subscribe("*", (e) => {
          if (!isSubscribed) return;
          const recRoomId = e.record.examRoomId || e.record.exam_room_id || "";
          if (recRoomId !== roomId) return;

          if (e.action === 'create' || e.action === 'update') {
            setAttempts(prev => {
              const idx = prev.findIndex(a => a.id === e.record.id);
              if (idx > -1) {
                const newArr = [...prev];
                newArr[idx] = { ...newArr[idx], ...e.record };
                return newArr;
              }
              return [e.record, ...prev];
            });
            const sId = e.record.studentId || e.record.student_id;
            if (sId && e.record.answers) {
              setAnswersList(prev => ({ ...prev, [sId]: e.record.answers }));
            }
          } else if (e.action === 'delete') {
            setAttempts(prev => prev.filter(a => a.id !== e.record.id));
          }
        });

        const unsubQuestions = await pb.collection('questions').subscribe("*", (e) => {
          if (!isSubscribed) return;
          if (e.record.examId === monitorRoom?.examId) {
            setMonitorQuestions([]);
          }
        });

        if (!isSubscribed) {
          unsub();
          unsubQuestions();
        } else {
          currentUnsub = () => { unsub(); unsubQuestions(); };
        }
      } catch (err) { }
    };

    startSubscribe();
    const polling = setInterval(() => {
      handleManualRefreshMonitor();
    }, 20000);

    return () => {
      isSubscribed = false;
      clearInterval(polling);
      if (currentUnsub) currentUnsub();
    };
  }, [roomId, monitorRoom?.examId]);

  const handleUnlockStudent = async (attId: string) => {
    try {
      await pb.collection('attempts').update(attId, {
        status: 'ongoing',
        cheatCount: 0
      });
      showAlert("Berhasil", "Siswa berhasil dibuka kuncinya.", "success");
    } catch (e) { showAlert("Gagal", "Gagal membuka kunci.", "danger"); }
  };

  const handleResetSession = (attId: string, sisId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Reset Sesi",
      description: "Hapus permanen progres siswa ini?",
      type: "danger",
      confirmLabel: "Reset",
      onConfirm: async () => {
        try {
          const related = await pb.collection('attempts').getFullList({
            filter: `studentId = "${sisId}" && examRoomId = "${roomId}"`
          });
          
          const chunkSize = 10;
          for (let i = 0; i < related.length; i += chunkSize) {
            const chunk = related.slice(i, i + chunkSize);
            await Promise.all(chunk.map(r => pb.collection('attempts').delete(r.id)));
          }
          
          showAlert("Berhasil", "Sesi direset.", "success");
        } catch (e) { showAlert("Gagal", "Error.", "danger"); }
      }
    });
  };

  const handleResetCheatCount = async (attId: string) => {
    try {
      await pb.collection('attempts').update(attId, {
        cheatCount: 0,
        status: "ongoing"
      });
      showAlert("Berhasil", "Pelanggaran telah di-reset.", "success");
    } catch (e) { showAlert("Gagal", "Error reset.", "danger"); }
  };

  const handleForceSubmitStudent = async (attId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Selesaikan Paksa",
      description: "Hentikan pengerjaan siswa ini sekarang?",
      type: "warning",
      confirmLabel: "Selesaikan",
      onConfirm: async () => {
        try {
          await pb.collection('attempts').update(attId, {
            status: "finished",
            submitTime: new Date().toISOString()
          });
          showAlert("Berhasil", "Siswa dipaksa selesai.", "success");
        } catch (e) { showAlert("Gagal", "Gagal.", "danger"); }
      }
    });
  };

  const handleManualGrade = async (studentId: string, qId: string, isForcedCorrect: boolean) => {
    try {
      const studentAttempts = attempts.filter(a => a.studentId === studentId || (a as any).student_id === studentId);
      const att = studentAttempts.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())[0];
      if (!att) return;

      let currentOverrides: any = {};
      try {
        if (typeof att.overrides === 'string') currentOverrides = JSON.parse(att.overrides);
        else if (typeof att.overrides === 'object') currentOverrides = { ...att.overrides };
      } catch (e) { currentOverrides = {}; }

      const newOverrides = { ...currentOverrides, [qId]: isForcedCorrect };
      const sisAnswers = att.answers || {};
      let correctCount = 0;

      monitorQuestions.forEach((q: any) => {
        let itemCorrect = false;
        if (newOverrides[q.id] !== undefined) {
          itemCorrect = newOverrides[q.id];
        } else {
          const ansId = sisAnswers[q.id];
          if (ansId) {
            const type = q.type || "pilihan_ganda";
            if (type === "pilihan_ganda" || type === "benar_salah") {
              const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ansId).toLowerCase());
              itemCorrect = ck ? q.choices[ck].isCorrect === true : false;
            } else if (type === "pilihan_ganda_kompleks") {
              const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase());
              const studentKeys = Array.isArray(ansId) ? ansId.map(k => String(k).toLowerCase()) : [];
              itemCorrect = studentKeys.length === correctKeys.length && studentKeys.every(k => correctKeys.includes(k));
            } else if (type === "isian_singkat") itemCorrect = isFuzzyMatch(ansId, q.answerKey);
            else if (type === "urutkan" || type === "drag_drop") {
              const co = (q.items || []).map((it: any) => it.id);
              itemCorrect = Array.isArray(ansId) && ansId.length === co.length && ansId.every((v, i) => v === co[i]);
            } else if (type === "menjodohkan") {
              const pairs = q.pairs || [];
              itemCorrect = pairs.length > 0 && pairs.every((p: any) => ansId[p.id] === p.right);
            }
          }
        }
        if (itemCorrect) correctCount++;
      });

      const total = monitorQuestions.length;
      const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

      await pb.collection('attempts').update(att.id, {
        overrides: newOverrides,
        correct: correctCount,
        score: score
      });
    } catch (error) { console.error(error); }
  };

  const handleExportExcel = () => {
    if (!monitorRoom) return;
    const workbook = XLSX.utils.book_new();

    // Helper for answer comparison
    const checkAns = (q: any, studentAns: any) => {
      if (!studentAns) return false;
      const key = q.answerKey || q.correctAnswer;
      const type = q.type || q.field || "pilihan_ganda";

      if (type === "pilihan_ganda" || type === "benar_salah") {
        return String(studentAns).toUpperCase() === String(key).toUpperCase();
      }
      if (type === "pilihan_ganda_kompleks") {
        const sArr = Array.isArray(studentAns) ? studentAns : [studentAns];
        const kArr = Array.isArray(key) ? key : [key];
        return sArr.length === kArr.length && sArr.every(v => kArr.includes(v));
      }
      if (type === "isian_singkat") {
        return isFuzzyMatch(studentAns, String(key));
      }
      return JSON.stringify(studentAns) === JSON.stringify(key);
    };

    // Prepare style tokens
    const STYLES = {
      header: {
        fill: { fgColor: { rgb: "4F46E5" } }, // Indigo 600
        font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      cell: {
        alignment: { vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      cellCenter: {
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      correct: {
        font: { color: { rgb: "16A34A" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      wrong: {
        font: { color: { rgb: "DC2626" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      neutral: {
        font: { color: { rgb: "64748B" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      }
    };

    const COL_WIDTHS = [
      { wch: 4 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, 
      { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 8 }
    ];
    monitorQuestions.forEach(() => COL_WIDTHS.push({ wch: 10 }));

    const filteredStudents = students
      .map(s => ({
        ...s,
        className: examClasses.find(c => c.id === s.classId)?.name || "N/A"
      }))
      .filter(s => {
        if (monitorRoom?.allClasses) {
          if (monitorClassFilter !== "all" && s.className !== monitorClassFilter) return false;
          return true;
        }
        const allowedIds = Array.isArray(monitorRoom?.classId) ? monitorRoom?.classId : String(monitorRoom?.classId || "").split(",");
        if (!allowedIds.includes(s.classId)) return false;
        if (monitorClassFilter !== "all" && s.className !== monitorClassFilter) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const classesArray = Array.from(new Set(filteredStudents.map(s => s.className))).sort();

    // Function to build a sheet for a set of students
    const buildSheet = (groupStudents: any[], sheetName: string) => {
      const headerRow = ["No", "NISN", "Nama", "Kelas", "Login", "Submit", "Cheat", "B", "S", "Nilai"];
      monitorQuestions.forEach((_, i) => headerRow.push(`Q${i + 1}`));

      const rows: any[][] = [headerRow.map(h => ({ v: h, s: STYLES.header }))];

      groupStudents.forEach((std, idx) => {
        const atts = attempts.filter(a => a.studentId === std.id || a.student_id === std.id);
        const att = atts.sort((ax, bx) => new Date(bx.created).getTime() - new Date(ax.created).getTime())[0];
        const answers = att?.answers || {};
        const score = att?.score || 0;

        const row = [
          { v: idx + 1, s: STYLES.cellCenter },
          { v: std.nisn, s: STYLES.cellCenter },
          { v: std.name, s: STYLES.cell },
          { v: std.className, s: STYLES.cellCenter },
          { v: att?.startTime ? new Date(att.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-", s: STYLES.cellCenter },
          { v: att?.submitTime ? new Date(att.submitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (att?.status === "finished" ? "Selesai" : (att ? "Proses" : "-")), s: STYLES.cellCenter },
          { v: att?.cheatCount || 0, s: STYLES.cellCenter },
          { v: att?.correct || 0, s: STYLES.correct },
          { v: monitorQuestions.length - (att?.correct || 0), s: STYLES.wrong },
          { v: Number(score.toFixed(1)), s: { ...STYLES.cellCenter, font: { bold: true } } }
        ];

        monitorQuestions.forEach(q => {
          const ans = answers[q.id];
          const isCorrect = checkAns(q, ans);
          const display = ans ? (Array.isArray(ans) ? ans.join(",") : String(ans).toUpperCase()) : "-";
          row.push({
            v: display,
            s: ans ? (isCorrect ? STYLES.correct : STYLES.wrong) : STYLES.neutral
          });
        });

        rows.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = COL_WIDTHS;
      XLSX.utils.book_append_sheet(workbook, ws, sheetName.substring(0, 31));
    };

    // Build Master Sheet if multiple classes
    if (classesArray.length > 1) {
      buildSheet(filteredStudents, "SEMUA KELAS");
    }

    // Build Per-Class Sheets
    classesArray.forEach(cls => {
      buildSheet(filteredStudents.filter(s => s.className === cls), cls);
    });

    XLSX.writeFile(workbook, `Rekap_${monitorRoom.room_name || "Monitoring"}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleForceSubmitAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Selesaikan Semua?",
      description: "Seluruh pengerjaan yang aktif di ruang ini akan dihentikan paksa.",
      type: "danger",
      confirmLabel: "Ya, Selesaikan Semua",
      onConfirm: async () => {
        try {
          const ongoing = attempts.filter(a => a.status === "ongoing" || a.status === "LOCKED");
          const chunkSize = 10;
          for (let i = 0; i < ongoing.length; i += chunkSize) {
            const chunk = ongoing.slice(i, i + chunkSize);
            await Promise.all(chunk.map(a => 
              pb.collection('attempts').update(a.id, { 
                status: "finished", 
                submitTime: new Date().toISOString() 
              })
            ));
          }
          showAlert("Berhasil", "Seluruh pengerjaan telah diselesaikan.", "success");
        } catch (e) { showAlert("Gagal", "Error.", "danger"); }
      }
    });
  };

  const isLoading = loading || dataLoading;

  const roomClassLabel = (() => {
    if (isLoading || !monitorRoom) return "...";
    if (monitorRoom.allClasses) return "Semua Kelas";
    const ids = Array.isArray(monitorRoom.classId) ? monitorRoom.classId : String(monitorRoom.classId || "").split(",");
    const names = ids.map(id => examClasses.find(c => c.id === id)?.name).filter(Boolean);
    return names.length > 0 ? names.join(", ") : (ids.length > 0 ? `ID: ${String(ids[0]).substring(0, 5)}...` : "N/A");
  })();

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* HEADER SECTION - Clean & Professional */}
      <div className="bg-card p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm transition-all duration-300">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/admin/ruang-ujian")} 
              className="h-10 w-10 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </Button>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
                  {isLoading ? <Skeleton className="h-7 w-48" /> : `Monitoring: ${monitorRoom?.room_name || "Tanpa Nama"}`}
                </h1>
                {!isLoading && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-md border border-emerald-100 dark:border-emerald-800/40">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Live</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                  <span className="font-medium truncate max-w-[200px] md:max-w-md">{isLoading ? <Skeleton className="h-3 w-32" /> : monitorRoom?.examTitle}</span>
                </div>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <div className="flex flex-wrap gap-1">
                   {(function () {
                      if (isLoading || !monitorRoom) return <Skeleton className="h-4 w-20 rounded-md" />;
                      
                      const ids = Array.isArray(monitorRoom.classId) ? monitorRoom.classId : String(monitorRoom.classId || "").split(",");
                      if (monitorRoom.allClasses) return <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Semua Kelas</span>;
                      
                      const names = ids.map(id => examClasses.find(c => c.id === id)?.name).filter(Boolean);
                      return names.length > 0 ? (
                        <span className="font-medium truncate max-w-[150px]">{names.join(", ")}</span>
                      ) : <span className="italic">Tidak ada kelas</span>;
                    })()}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 self-end md:self-center">
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60 px-3 py-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Penyegaran</span>
                <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 leading-none mt-1">
                   {isLoading ? "--:--" : `${Math.floor(monitorTimeLeft / 60).toString().padStart(2, '0')}:${(monitorTimeLeft % 60).toString().padStart(2, '0')}`}
                </span>
              </div>
              <Button
                onClick={() => handleManualRefreshMonitor()}
                size="icon"
                variant="ghost"
                className={`h-9 w-9 rounded-xl transition-all ${isMonitorRefreshing ? "text-blue-500" : "text-slate-400 hover:text-blue-500 hover:bg-white dark:hover:bg-slate-800"}`}
              >
                <RefreshCw className={`h-4.5 w-4.5 ${isMonitorRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* SIDEBAR - Enhanced & Integrated */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-6 h-fit sticky top-24">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4 pl-1 border-l-2 border-blue-500 ml-1">
                Ringkasan Sesi
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 group hover:border-blue-200 dark:hover:border-blue-800/40 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                      <Users className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Peserta</span>
                  </div>
                  <span className="text-lg font-semibold text-slate-800 dark:text-white leading-none">{isLoading ? <Skeleton className="h-5 w-8" /> : (function() {
                    const filteredArr = students.filter((s) => {
                      if (monitorRoom?.allClasses) return true;
                      const allowedIds = Array.isArray(monitorRoom?.classId) ? monitorRoom?.classId : String(monitorRoom?.classId || "").split(",");
                      return allowedIds.includes(s.classId);
                    });
                    return filteredArr.length;
                  })()}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/5 dark:bg-emerald-900/5 border border-emerald-50 dark:border-emerald-800/10 group hover:border-emerald-200 dark:hover:border-emerald-800/40 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                      <Monitor className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Sedang Ujian</span>
                  </div>
                  <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 leading-none">{isLoading ? <Skeleton className="h-5 w-6" /> : attempts.filter(a => a.status === 'ongoing').length}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-rose-50/5 dark:bg-rose-900/5 border border-rose-50 dark:border-rose-800/10 group hover:border-rose-200 dark:hover:border-rose-800/40 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                      <Lock className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Terkunci</span>
                  </div>
                  <span className="text-lg font-semibold text-rose-600 dark:text-rose-400 leading-none">{isLoading ? <Skeleton className="h-5 w-4" /> : attempts.filter(a => a.status === 'LOCKED').length}</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60 space-y-5">
              <div className="space-y-4">
                <div className="relative group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Cari siswa..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setMonitorPage(1); }}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">Filter Kelas</label>
                  <select
                    value={monitorClassFilter}
                    onChange={(e) => { setMonitorClassFilter(e.target.value); setMonitorPage(1); }}
                    className="w-full text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/10 appearance-none cursor-pointer text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">Semua Kelas</option>
                    {examClasses
                      .filter(c => {
                        if (monitorRoom?.allClasses) return true;
                        const ids = Array.isArray(monitorRoom?.classId) ? monitorRoom?.classId : String(monitorRoom?.classId || "").split(",");
                        return ids.includes(c.id);
                      })
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                    }
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">Urutan</label>
                  <select
                    value={monitorSortBy}
                    onChange={(e) => { setMonitorSortBy(e.target.value as any); setMonitorPage(1); }}
                    className="w-full text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/10 appearance-none cursor-pointer text-slate-700 dark:text-slate-200"
                  >
                    <option value="status">Status Ujian</option>
                    <option value="nama">Nama (A-Z)</option>
                    <option value="nilai">Nilai Tertinggi</option>
                    <option value="login">Login Terbaru</option>
                    <option value="default">Default</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <Button onClick={handleExportExcel} variant="secondary" className="w-full rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 dark:border-emerald-800/40 text-emerald-700 font-semibold shadow-sm transition-all h-10">
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
                </Button>
                <Button onClick={handleForceSubmitAll} variant="secondary" className="w-full rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border dark:border-rose-800/30 shadow-sm font-semibold h-10 transition-all">
                  <Users className="mr-2 h-4 w-4" /> Selesaikan Semua
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-card rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden min-h-[500px]">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-12 text-center">No</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:text-blue-600 transition-colors group"
                      onClick={() => setMonitorSortBy("nama")}
                    >
                      <div className="flex items-center gap-1.5">
                        Nama Siswa
                        <ChevronDown className={`h-3 w-3 transition-opacity ${monitorSortBy === 'nama' ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`} />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:text-blue-600 transition-colors group"
                      onClick={() => setMonitorSortBy("status")}
                    >
                      <div className="flex items-center gap-1.5">
                        Status
                        <ChevronDown className={`h-3 w-3 transition-opacity ${monitorSortBy === 'status' ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`} />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:text-blue-600 transition-colors group"
                      onClick={() => setMonitorSortBy("nilai")}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        Nilai
                        <ChevronDown className={`h-3 w-3 transition-opacity ${monitorSortBy === 'nilai' ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`} />
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Progres</TableHead>
                    <TableHead className="text-center">Cheat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={`skele-row-${i}`} className="h-16">
                        <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-48" /><Skeleton className="h-3 w-32 mt-1.5" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-6 w-8 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-5 w-12 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-5 w-6 mx-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-7 w-20 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : (() => {
                    const filtered = students
                      .map(s => ({
                        ...s,
                        className: examClasses.find(c => c.id === s.classId)?.name || "-"
                      }))
                      .filter((s) => {
                        // Search Filter
                        if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase()) && !s.nisn.includes(searchQuery)) return false;

                        // Class Filter
                        if (monitorRoom?.allClasses) {
                          if (monitorClassFilter !== "all" && s.className !== monitorClassFilter) return false;
                          return true;
                        }
                        const allowedIds = Array.isArray(monitorRoom?.classId) ? monitorRoom?.classId : String(monitorRoom?.classId || "").split(",");
                        if (!allowedIds.includes(s.classId)) return false;
                        if (monitorClassFilter !== "all" && s.className !== monitorClassFilter) return false;
                        return true;
                      })
                      .sort((a, b) => {
                        const attA = attempts.find(at => at.studentId === a.id);
                        const attB = attempts.find(at => at.studentId === b.id);
                        if (monitorSortBy === "nilai") return (attB?.score || 0) - (attA?.score || 0);
                        if (monitorSortBy === "login") return new Date(attB?.startTime || 0).getTime() - new Date(attA?.startTime || 0).getTime();
                        if (monitorSortBy === "status") {
                          const getStatusRank = (status?: string) => {
                            if (status === "LOCKED") return 3;
                            if (status === "ongoing") return 2;
                            if (status === "finished") return 1;
                            return 0; // Not started
                          };
                          const rankA = getStatusRank(attA?.status);
                          const rankB = getStatusRank(attB?.status);
                          if (rankA !== rankB) return rankB - rankA;
                          return a.name.localeCompare(b.name);
                        }
                        return a.name.localeCompare(b.name);
                      });

                    const startIndex = (monitorPage - 1) * monitorPageSize;
                    const currentData = filtered.slice(startIndex, startIndex + monitorPageSize);

                    if (currentData.length === 0 && monitorPage === 1) return <TableRow><TableCell colSpan={7} className="h-60 text-center text-slate-400">Siswa tidak ditemukan</TableCell></TableRow>;

                    const rows = currentData.map((student, localIdx) => {
                      const attempt = attempts.find(a => a.studentId === student.id || a.student_id === student.id);
                      const sisAnswers = attempt?.answers || {};
                      const answered = Object.keys(sisAnswers).length;
                      const isExpanded = expandedstudent === student.id;

                      return (
                        <React.Fragment key={student.id}>
                          <TableRow className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-16 ${isExpanded ? "bg-blue-50/30 dark:bg-blue-900/10" : ""}`}>
                            <TableCell className="text-center text-slate-400 text-xs">{startIndex + localIdx + 1}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 dark:text-slate-100">{student.name}</span>
                                <span className="text-[10px] text-slate-500 font-medium">{student.nisn} • {student.className}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {attempt ? (
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${attempt.status === "finished" ? "bg-green-50 text-green-700 border-green-200" :
                                    attempt.status === "LOCKED" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                      "bg-blue-50 text-blue-700 border-blue-200"
                                    }`}>
                                    {attempt.status?.toUpperCase() || "AKTIF"}
                                  </span>
                                </div>
                              ) : <span className="text-[10px] text-slate-400 italic">Belum Login</span>}
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {(() => {
                                if (!attempt) return "-";
                                if (attempt.status === "finished") return <span className="text-emerald-600">{attempt.score}</span>;
                                
                                const liveScore = getLiveScore(sisAnswers, attempt.overrides || {});
                                return <span className="text-indigo-600 animate-pulse-subtle">{liveScore}</span>;
                              })()}
                            </TableCell>
                            <TableCell className="text-center text-xs text-slate-500">
                              {answered} / {monitorQuestions.length}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`font-bold text-xs ${(attempt?.cheatCount || 0) > 0 ? "text-rose-500" : "text-slate-400"}`}>
                                {attempt?.cheatCount || 0}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                {attempt && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setExpandedstudent(isExpanded ? null : student.id)}
                                      className={`h-8 px-4 rounded-2xl font-bold text-[10px] transition-all shadow-sm ${isExpanded
                                        ? "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
                                        : "bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/40 dark:hover:bg-blue-900/50 dark:hover:text-blue-300"
                                        }`}
                                    >
                                      {isExpanded ? "Tutup" : "Detail"}
                                    </Button>
                                    <div className="relative">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setOpenMenuId(openMenuId === student.id ? null : student.id)}
                                        className="h-8 px-3 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 hover:text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/40 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-300 shadow-sm transition-all flex items-center gap-1.5 font-bold text-[10px]"
                                      >
                                        <Settings className="h-3.5 w-3.5" />
                                        Menu
                                      </Button>
                                      {openMenuId === student.id && (
                                        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-100" onMouseLeave={() => setOpenMenuId(null)}>
                                          <div className="px-3 py-1 mb-1 border-b border-slate-50 dark:border-slate-700/50">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Opsi Siswa</span>
                                          </div>
                                          <button
                                            onClick={() => { handleResetCheatCount(attempt.id); setOpenMenuId(null); }}
                                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-[10px] text-amber-600 dark:text-amber-500 font-bold transition-colors flex items-center gap-2"
                                          >
                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Reset Cheat
                                          </button>
                                          {attempt.status === "LOCKED" && (
                                            <button
                                              onClick={() => { handleUnlockStudent(attempt.id); setOpenMenuId(null); }}
                                              className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-[10px] text-emerald-600 dark:text-emerald-500 font-bold transition-colors flex items-center gap-2"
                                            >
                                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Buka Kunci
                                            </button>
                                          )}
                                          {attempt.status !== "finished" && (
                                            <button
                                              onClick={() => { handleForceSubmitStudent(attempt.id); setOpenMenuId(null); }}
                                              className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-[10px] text-blue-600 dark:text-blue-400 font-bold transition-colors flex items-center gap-2"
                                            >
                                              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Selesaikan
                                            </button>
                                          )}
                                          <button
                                            onClick={() => { handleResetSession(attempt.id, student.id); setOpenMenuId(null); }}
                                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-[10px] text-rose-600 dark:text-rose-500 font-bold transition-colors flex items-center gap-2"
                                          >
                                            <div className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Reset Sesi
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-slate-50/50 dark:bg-slate-900/40">
                              <TableCell colSpan={7} className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {monitorQuestions.map((q, qIdx) => {
                                    const ans = sisAnswers[q.id];
                                    const overrides = attempt?.overrides || {};
                                    const correct = overrides[q.id] !== undefined ? overrides[q.id] : (ans ? (q.type === "isian_singkat" ? isFuzzyMatch(ans, q.answerKey) : q.choices?.[ans]?.isCorrect) : false);
                                    return (
                                      <div key={q.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-2">
                                        <div className="flex gap-2">
                                          <span className="text-[10px] font-black text-slate-400 shrink-0">#{qIdx + 1}</span>
                                          <div className="text-[11px] font-medium leading-tight text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: q.text }} />
                                        </div>
                                        <div className={`mt-auto p-2 rounded-lg flex items-center justify-between ${correct ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                                          <span className="text-[10px] font-bold">Jawab: {ans ? String(ans).toUpperCase() : "-"}</span>
                                          <div className="flex gap-1">
                                            {(q.type === "isian_singkat" || q.type === "uraian") && (
                                              <>
                                                <button onClick={() => handleManualGrade(student.id, q.id, true)} className="p-1 hover:bg-white rounded"><CheckCircle2 className="h-3 w-3" /></button>
                                                <button onClick={() => handleManualGrade(student.id, q.id, false)} className="p-1 hover:bg-white rounded"><X className="h-3 w-3" /></button>
                                              </>
                                            )}
                                            <span className="text-[9px] font-black">{correct ? "✓" : "✗"}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      )
                    });

                    // Add empty rows if data < 10
                    const emptyRowsCount = Math.max(0, 10 - currentData.length);
                    const emptyRows = Array.from({ length: emptyRowsCount }).map((_, i) => (
                      <TableRow key={`empty-${i}`} className="h-16 border-slate-50 dark:border-slate-800/20">
                        <TableCell colSpan={7}>&nbsp;</TableCell>
                      </TableRow>
                    ));

                    return [...rows, ...emptyRows];
                  })()}
                </TableBody>
              </Table>
            </div>

            {/* PAGINATION */}
            {(() => {
              const { filtered } = (function () {
                const filteredArr = students
                  .map(s => ({
                    ...s,
                    className: examClasses.find(c => c.id === s.classId)?.name || "-"
                  }))
                  .filter((s) => {
                    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase()) && !s.nisn.includes(searchQuery)) return false;
                    if (monitorRoom?.allClasses) {
                      if (monitorClassFilter !== "all" && s.className !== monitorClassFilter) return false;
                      return true;
                    }
                    const allowedIds = Array.isArray(monitorRoom?.classId) ? monitorRoom?.classId : String(monitorRoom?.classId || "").split(",");
                    if (!allowedIds.includes(s.classId)) return false;
                    if (monitorClassFilter !== "all" && s.className !== monitorClassFilter) return false;
                    return true;
                  });
                return { filtered: filteredArr };
              })();

              const total = filtered.length;
              const startIndex = (monitorPage - 1) * monitorPageSize;
              const totalPages = Math.ceil(total / monitorPageSize);

              if (total === 0) return null;

              return (
                <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 dark:bg-slate-900/40 p-3 sm:p-4 rounded-b-3xl border-t border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left font-medium">
                    Menampilkan {total > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + monitorPageSize, total)} dari {total} data
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">Baris per halaman:</span>
                      <select
                        value={monitorPageSize}
                        onChange={(e) => { setMonitorPageSize(Number(e.target.value)); setMonitorPage(1); }}
                        className="h-8 sm:h-9 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {[10, 25, 50, 100].map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMonitorPage(1)}
                        disabled={monitorPage === 1}
                        className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                      >
                        <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="sr-only">First page</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMonitorPage(prev => Math.max(1, prev - 1))}
                        disabled={monitorPage === 1}
                        className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                      >
                        <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="sr-only">Previous page</span>
                      </Button>

                      <div className="flex items-center gap-1">
                        {(() => {
                          const pages = [];
                          const maxVisible = 5;
                          let start = Math.max(1, monitorPage - 2);
                          let end = Math.min(totalPages, start + maxVisible - 1);
                          if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

                          for (let i = start; i <= end; i++) {
                            pages.push(
                              <Button
                                key={i}
                                variant="ghost"
                                size="sm"
                                onClick={() => setMonitorPage(i)}
                                className={`h-8 w-8 sm:h-9 sm:w-9 p-0 text-xs sm:text-sm rounded-lg transition-colors border ${monitorPage === i
                                  ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800/40 font-bold"
                                  : "border-transparent bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                                  }`}
                              >
                                {i}
                              </Button>
                            );
                          }
                          return pages;
                        })()}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMonitorPage(prev => prev + 1)}
                        disabled={monitorPage === totalPages}
                        className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                      >
                        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="sr-only">Next page</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMonitorPage(totalPages)}
                        disabled={monitorPage === totalPages}
                        className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                      >
                        <ChevronsRight className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="sr-only">Last page</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={async () => { await confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, isOpen: false })); }}
        title={confirmDialog.title}
        description={confirmDialog.description}
        type={confirmDialog.type}
        confirmLabel={confirmDialog.confirmLabel}
      />

      {/* Zoom Image Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl bg-transparent border-none shadow-none">
          {previewImage && <img src={previewImage} className="w-full rounded-xl" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MonitoringPage;
