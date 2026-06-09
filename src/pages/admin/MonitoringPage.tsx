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
  Settings,
  Timer,
  Clock,
  ShieldAlert
} from "lucide-react";
import { Sparkles, RotateCcw, Copy, Check, Pencil, Trophy } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx-js-style";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";
import { cn } from "../../lib/utils";
import { useTenant } from "../../context/TenantContext";
import { useExamData } from "../../context/ExamDataContext";
import { useAuth } from "../../context/AuthContext";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";
import { MathText } from "../../components/MathText";
import { gradeEssayWithAI } from "../../lib/ai";

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

// 🕒 Real-time Student Timer Component
const StudentTimer = ({ attempt, room }: { attempt: any, room: any }) => {
  const [timeLeft, setTimeLeft] = useState<string>("--:--");

  useEffect(() => {
    if (!attempt || attempt.status !== "ongoing") {
      if (attempt?.status === "finished") {
        const start = new Date(attempt.startedAt || attempt.startTime || attempt.created).getTime();
        const end = new Date(attempt.submittedAt || attempt.updated || Date.now()).getTime();
        const diff = Math.max(0, end - start);

        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        const timeStr = hrs > 0
          ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
          : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        setTimeLeft(`Selesai (${timeStr})`);
      } else if (attempt?.status === "LOCKED") setTimeLeft("TERKUNCI");
      else setTimeLeft("--:--");
      return;
    }

    const calculateTime = () => {
      const start = new Date(attempt.startedAt || attempt.startTime || attempt.created).getTime();
      const durationMs = (room?.duration || 0) * 60 * 1000;
      const endByDuration = start + durationMs;

      // Also respect room end_time if it's earlier than duration expiry
      let finalEnd = endByDuration;
      if (room?.end_time) {
        const roomEnd = new Date(room.end_time).getTime();
        if (roomEnd < finalEnd) finalEnd = roomEnd;
      }

      const now = Date.now();
      const diff = finalEnd - now;

      if (diff <= 0) {
        setTimeLeft("HABIS");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      } else {
        setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [attempt, room]);

  const iconColor = timeLeft === "HABIS" || timeLeft === "TERKUNCI" ? "text-rose-400" :
    timeLeft.startsWith("Selesai") ? "text-emerald-400" :
      "text-blue-400";

  return (
    <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 transition-all ${timeLeft === "HABIS" || timeLeft === "TERKUNCI" ? "text-rose-600 border-rose-100 bg-rose-50" :
      timeLeft.startsWith("Selesai") ? "text-emerald-600 border-emerald-100 bg-emerald-50" :
        "text-blue-600 border-blue-50 bg-blue-50/30"
      }`}>
      <Timer className={`h-3 w-3 ${iconColor} ${attempt?.status === "ongoing" ? "animate-pulse" : ""}`} />
      <span className="font-mono font-bold text-[9px] tracking-tight whitespace-nowrap">
        {timeLeft}
      </span>
    </div>
  );
};

// Strip HTML tags from rich text content for display
const stripHtmlTags = (html: string): string => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
};

// 🛡️ Fuzzy Match Helper for Short Answers
const isFuzzyMatch = (studentAns: any, correctKey: string) => {
  if (typeof studentAns !== "string" || !correctKey) return false;
  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '');
  const sAns = stripHtml(studentAns).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const cKey = stripHtml(correctKey).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (sAns === cKey) return true;
  if (!sAns || !cKey) return false;
  if (sAns.includes(cKey) || cKey.includes(sAns)) return true;
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
  const maxLen = Math.max(sAns.length, cKey.length);
  const maxAllowed = maxLen > 10 ? 3 : (maxLen > 6 ? 2 : (maxLen >= 4 ? 1 : 0));
  return dist <= maxAllowed;
};

// Helper for answer comparison (all types)
const checkAns = (q: any, studentAns: any, overrides?: Record<string, boolean>) => {
  if (overrides && overrides[q.id] !== undefined) return overrides[q.id];
  if (!studentAns) return false;
  const type = q.type || q.field || "pilihan_ganda";

  if (type === "pilihan_ganda" || type === "benar_salah") {
    const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(studentAns).toLowerCase());
    return ck ? q.choices[ck].isCorrect === true : false;
  }
  if (type === "pilihan_ganda_kompleks") {
    const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase());
    const studentKeys = Array.isArray(studentAns) ? studentAns.map((k: any) => String(k).toLowerCase()) : [];
    return studentKeys.length === correctKeys.length && studentKeys.every((k: string) => correctKeys.includes(k));
  }
  if (type === "isian_singkat") {
    return isFuzzyMatch(studentAns, q.answerKey);
  }
  if (type === "urutkan" || type === "drag_drop") {
    const co = (q.items || []).map((it: any) => it.id);
    return Array.isArray(studentAns) && studentAns.length === co.length && studentAns.every((v: any, i: number) => v === co[i]);
  }
  if (type === "menjodohkan") {
    const pairs = q.pairs || [];
    return pairs.length > 0 && pairs.every((p: any) => studentAns[p.id] === p.right);
  }
  return false;
};

const MonitoringPage = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState<string | null>(() => sessionStorage.getItem("activeMonitoringRoomId"));

  useEffect(() => {
    if (!roomId) {
      // Jika nyasar kesini tanpa ID, balikin ke daftar ruangan
      navigate("/admin/ruang-ujian", { replace: true });
    }
  }, [roomId, navigate]);

  const { user, role } = useAuth();
  const { pb, terminology } = useTenant();
  const { classes: examClasses, students, subjects, teachers: masterTeachers, teacherFullAccess, loading: dataLoading } = useExamData();

  const [loading, setLoading] = useState(true);
  const isLoading = loading || dataLoading;
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
  const [monitorSortBy, setMonitorSortBy] = useState<"default" | "nama" | "nilai" | "login" | "status" | "monitoring">("status");
  const [monitorSortOrder, setMonitorSortOrder] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: typeof monitorSortBy) => {
    if (monitorSortBy === key) {
      setMonitorSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setMonitorSortBy(key);
      setMonitorSortOrder(key === "nama" ? "asc" : "desc");
    }
    setMonitorPage(1);
  };
  const [monitorTimeLeft, setMonitorTimeLeft] = useState(0);
  const [isMonitorRefreshing, setIsMonitorRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  // 📝 Real-time Live Score Calculator (Weighted: objective + essay)
  const getLiveScore = (sisAnswers: Record<string, any>, attOverrides: Record<string, boolean> = {}) => {
    if (!sisAnswers || monitorQuestions.length === 0) return 0;

    // Fallback: read overrides from answers.__overrides__ if attOverrides is empty
    const overrides = Object.keys(attOverrides).length > 0 ? attOverrides : ((sisAnswers as any)?.__overrides__ || {});

    let objectiveCorrect = 0;
    let objectiveTotal = 0;
    let essayCorrect = 0;
    let essayTotal = 0;

    monitorQuestions.forEach((q: any) => {
      const type = q.type || "pilihan_ganda";
      const isEssay = type === "isian_singkat" || type === "uraian";
      let itemCorrect = false;

      if (overrides[q.id] !== undefined) {
        itemCorrect = overrides[q.id];
      } else {
        const ansId = sisAnswers[q.id];
        if (ansId !== undefined && ansId !== null) {
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

      if (isEssay) {
        essayTotal++;
        if (itemCorrect) essayCorrect++;
      } else {
        objectiveTotal++;
        if (itemCorrect) objectiveCorrect++;
      }
    });

    // Weighted final score: 60% objektif, 40% essay (jika ada essay)
    if (essayTotal === 0) {
      // Tidak ada essay → 100% objektif
      return objectiveTotal > 0 ? Math.round((objectiveCorrect / objectiveTotal) * 100) : 0;
    }

    const objScore = objectiveTotal > 0 ? (objectiveCorrect / objectiveTotal) * 100 : 0;
    const essScore = essayTotal > 0 ? (essayCorrect / essayTotal) * 100 : 0;
    return Math.round(objScore * 0.6 + essScore * 0.4);
  };

  const getAttemptScore = (attempt: any) => {
    if (!attempt) return 0;
    const sisAnswers = attempt.answers || {};
    const overrides = attempt.overrides || (sisAnswers as any)?.__overrides__ || {};
    const liveScore = getLiveScore(sisAnswers, overrides);
    return attempt.status === "finished"
      ? (attempt.score === 0 && liveScore > 0 ? liveScore : (attempt.score ?? liveScore))
      : liveScore;
  };

  // 🛡️ Self-Healing Logic: Automatically fix 0 scores for FINISHED attempts
  useEffect(() => {
    if (isLoading || attempts.length === 0 || monitorQuestions.length === 0) return;

    const fixScores = async () => {
      const candidates = attempts.filter(a =>
        a.status === "finished" &&
        (
          (a.score === 0 || a.score === undefined || a.score === null) ||
          // Fix objectiveCorrect > objectiveTotal (data lama dari partial credit bug)
          (a.objectiveCorrect !== undefined && a.objectiveTotal !== undefined && a.objectiveCorrect > a.objectiveTotal)
        ) &&
        Object.keys(a.answers || {}).length > 0
      );

      if (candidates.length === 0) return;

      // Only fix 5 at a time to prevent rate limiting
      const chunk = candidates.slice(0, 5);
      for (const att of chunk) {
        const score = getLiveScore(att.answers, att.overrides || {});
        if (score > 0 && pb) {
          try {
            // Recalculate objectiveCorrect/objectiveTotal dari scratch
            let objCorrect = 0, objTotal = 0;
            monitorQuestions.forEach((q: any) => {
              const type = q.type || "pilihan_ganda";
              const isEssay = type === "isian_singkat" || type === "uraian";
              if (!isEssay) {
                objTotal++;
                const a = (att.answers || {})[q.id];
                let ic = (att.overrides || {})[q.id];
                if (ic === undefined && a) {
                  if (type === "pilihan_ganda" || type === "benar_salah") { const ck = Object.keys(q.choices || {}).find((k: string) => k.toLowerCase() === String(a).toLowerCase()); ic = ck ? q.choices[ck].isCorrect === true : false; }
                  else if (type === "pilihan_ganda_kompleks") { const ck = Object.keys(q.choices || {}).filter((k: string) => q.choices[k].isCorrect).map((k: string) => k.toLowerCase()); const sk = Array.isArray(a) ? a.map((k: any) => String(k).toLowerCase()) : []; ic = sk.length === ck.length && sk.every((k: string) => ck.includes(k)); }
                  else if (type === "menjodohkan") { const pairs = q.pairs || []; ic = pairs.length > 0 && pairs.every((p: any) => a[p.id] === p.right); }
                  else if (type === "urutkan" || type === "drag_drop") { const co = (q.items || []).map((it: any) => it.id); ic = Array.isArray(a) && a.length === co.length && a.every((v: any, i: number) => v === co[i]); }
                }
                if (ic) objCorrect++;
              }
            });
            objCorrect = Math.min(objCorrect, objTotal);
            await pb.collection('attempts').update(att.id, {
              score,
              objectiveScore: objTotal > 0 ? Math.round((objCorrect / objTotal) * 100) : 0,
              objectiveCorrect: objCorrect,
              objectiveTotal: objTotal,
            });
            console.log(`Self-healed score for ${att.id}: ${score}, obj: ${objCorrect}/${objTotal}`);
          } catch (e) {
            console.error("Failed to self-heal score", e);
          }
        }
      }
    };

    const timer = setTimeout(fixScores, 2000);
    return () => clearTimeout(timer);
  }, [attempts, monitorQuestions, isLoading]);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: "info" | "warning" | "danger" | "success";
    confirmLabel: string;
    onConfirm: () => void;
    requireWord?: string;
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
      if (!pb) return;
      // 1. Ambil Data Ruangan jika belum ada
      let currentRoom = monitorRoom;
      if (!currentRoom) {
        const roomRecord = await pb.collection('exam_rooms').getOne(id);
        const examObj = await pb.collection('exams').getOne(roomRecord.examId).catch(() => null);

        // Robust mapping similar to ExamRoomsPage
        const sId = roomRecord.examId || (roomRecord as any).examid || "";
        const roomName = roomRecord.room_name || (roomRecord as any).title || roomRecord.title || "Tanpa Nama";
        const isOff = roomRecord.isDisabled !== undefined ? roomRecord.isDisabled : (roomRecord as any).isActive === false;
        const subjectObj = subjects.find((s: any) => s.id === (examObj?.subjectId || (examObj as any)?.subjectid));
        const teacherObj = masterTeachers.find((t: any) => t.id === (examObj?.teacherId || (examObj as any)?.teacherid));

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
          subjectName: subjectObj?.name || "N/A",
          teacherName: teacherObj?.name || "N/A",
          isDisabled: isOff,
          allClasses: isAllClasses,
          classId: classList.length > 0 ? classList : (roomRecord.classId || [])
        } as any;
        setMonitorRoom(currentRoom);
      }

      // 2. Ambil DAFTAR SOAL
      if (monitorQuestions.length === 0 && currentRoom && pb) {
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
        setMonitorQuestions(
          // Deduplicate berdasarkan ID — cegah soal ganda dari DB
          Array.from(new Map(mappedQuestions.map((q: any) => [q.id, q])).values())
            .sort((a: any, b: any) => {
              const aIsEssay = a.type === "isian_singkat" || a.type === "uraian";
              const bIsEssay = b.type === "isian_singkat" || b.type === "uraian";
              if (aIsEssay && !bIsEssay) return 1;
              if (!aIsEssay && bIsEssay) return -1;
              return 0;
            })
        );
      }

      // 3. Ambil DATA PENGERJAAN
      if (pb) {
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

        // Auto-sync out-of-sync finished attempts in background
        const finishedAttempts = loadedAttempts.filter(att => att.status === "finished");
        if (finishedAttempts.length > 0 && monitorQuestions.length > 0) {
          const syncPromises = finishedAttempts.map(async (att) => {
            const answers = att.answers || {};
            const rawOverrides = typeof att.overrides === 'string' ? JSON.parse(att.overrides) : (att.overrides || {});
            const answersOverrides = answers.__overrides__ || {};
            const overrides = { ...answersOverrides, ...rawOverrides };

            let objCorrect = 0, objTotal = 0, essCorrect = 0, essTotal = 0;
            monitorQuestions.forEach((q: any) => {
              const type = q.type || "pilihan_ganda";
              const isEssay = type === "isian_singkat" || type === "uraian";
              const ic = checkAns(q, answers[q.id], overrides);
              if (isEssay) { essTotal++; if (ic) essCorrect++; }
              else { objTotal++; if (ic) objCorrect++; }
            });

            const objScore = objTotal > 0 ? Math.round((objCorrect / objTotal) * 100) : 0;
            const essScore = essTotal > 0 ? Math.round((essCorrect / essTotal) * 100) : 0;
            let finalScore = att.score || 0;
            if (finalScore === 0) {
              finalScore = getLiveScore(answers, overrides);
            }
            if (!finalScore) {
              finalScore = essTotal === 0 ? objScore : Math.round(objScore * 0.6 + essScore * 0.4);
            }

            const essGraded = Object.keys(overrides).filter(k => {
              const q = monitorQuestions.find((x: any) => x.id === k);
              return q && (q.type === "isian_singkat" || q.type === "uraian");
            }).length;

            const meta = answers.__meta || {};
            const needsSync =
              att.essayTotal !== essTotal ||
              att.essayGraded !== essGraded ||
              att.essayCorrect !== essCorrect ||
              att.essayScore !== essScore ||
              att.objectiveCorrect !== objCorrect ||
              att.objectiveTotal !== objTotal ||
              att.objectiveScore !== objScore ||
              att.score !== finalScore ||
              meta.essayGraded !== essGraded ||
              meta.essayCorrect !== essCorrect;

            if (needsSync) {
              const updatedAnswers = {
                ...answers,
                __meta: {
                  ...meta,
                  objectiveScore: objScore,
                  objectiveCorrect: objCorrect,
                  objectiveTotal: objTotal,
                  essayTotal: essTotal,
                  essayCorrect: essCorrect,
                  essayScore: essScore,
                  essayGraded: essGraded
                }
              };
              try {
                await pb.collection('attempts').update(att.id, {
                  answers: updatedAnswers,
                  correct: Math.floor(objCorrect + essCorrect),
                  objectiveCorrect: Math.floor(objCorrect),
                  objectiveTotal: objTotal,
                  objectiveScore: objScore,
                  essayCorrect: essCorrect,
                  essayTotal: essTotal,
                  essayScore: essScore,
                  essayGraded: essGraded,
                  score: finalScore
                });
                console.log(`Auto-synchronized scores for student attempt ${att.id}`);
              } catch (err) {
                console.error(`Error auto-syncing attempt ${att.id}:`, err);
              }
            }
          });
          // Run sync in background without blocking
          Promise.all(syncPromises).then(() => {
            // Re-fetch loaded attempts to update local state if anything changed
            pb.collection('attempts').getFullList({ filter: `examRoomId = "${id}"` }).then(res => {
              setAttempts(res);
            }).catch(() => {});
          });
        }
      }
    } catch (e) {
      console.error("Refresh Monitor Error:", e);
    } finally {
      setIsMonitorRefreshing(false);
      setLoading(false);
    }
  }, [roomId, monitorRoom, monitorQuestions.length, pb, subjects, masterTeachers]);

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
      if (!pb) return;
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
    }, 60000);

    return () => {
      isSubscribed = false;
      clearInterval(polling);
      if (currentUnsub) currentUnsub();
    };
  }, [roomId, monitorRoom?.examId]);

  const handleUnlockStudent = async (attId: string) => {
    if (!pb) return;
    try {
      await pb.collection('attempts').update(attId, {
        status: 'ongoing',
        cheatCount: 0
      });
      showAlert("Berhasil", `${terminology.student} berhasil dibuka kuncinya.`, "success");
    } catch (e) { showAlert("Gagal", "Gagal membuka kunci.", "danger"); }
  };

  const handleResetSession = (attId: string, sisId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Reset Sesi",
      description: `Hapus permanen progres pengerjaan ${terminology.student.toLowerCase()} ini?`,
      type: "danger",
      confirmLabel: "Reset",
      onConfirm: async () => {
        if (!pb) return;
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

  const handleResetAllSessions = () => {
    setConfirmDialog({
      isOpen: true,
      title: "RESET SEMUA SESI",
      description: `Hapus secara PERMANEN semua data progres ${terminology.student.toLowerCase()} di ruangan ini? Tindakan ini tidak dapat dibatalkan.`,
      type: "danger",
      confirmLabel: "RESET SEMUA",
      requireWord: "RESET",
      onConfirm: async () => {
        if (!pb) return;
        try {
          const related = await pb.collection('attempts').getFullList({
            filter: `examRoomId = "${roomId}"`
          });

          const chunkSize = 10;
          for (let i = 0; i < related.length; i += chunkSize) {
            const chunk = related.slice(i, i + chunkSize);
            await Promise.all(chunk.map(r => pb.collection('attempts').delete(r.id)));
          }

          handleManualRefreshMonitor();
          showAlert("Berhasil", "Seluruh sesi di ruangan ini telah di-reset.", "success");
        } catch (e) { showAlert("Gagal", "Gagal me-reset sesi.", "danger"); }
      }
    });
  };

  const handleResetCheatCount = async (attId: string) => {
    if (!pb) return;
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
      description: `Hentikan pengerjaan ${terminology.student.toLowerCase()} ini sekarang?`,
      type: "warning",
      confirmLabel: "Selesaikan",
      onConfirm: async () => {
        if (!pb) return;
        try {
          const att = attempts.find(a => a.id === attId);
          const score = getLiveScore(att?.answers || {}, att?.overrides || {});

          await pb.collection('attempts').update(attId, {
            status: "finished",
            submitTime: new Date().toISOString(),
            score: score
          });
          showAlert("Berhasil", `${terminology.student} dipaksa selesai.`, "success");
        } catch (e) { showAlert("Gagal", "Gagal.", "danger"); }
      }
    });
  };

  const handleManualGrade = async (studentId: string, qId: string, isForcedCorrect: boolean) => {
    try {
      const studentAttempts = attempts.filter(a => a.studentId === studentId || (a as any).student_id === studentId);
      const att = studentAttempts.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())[0];
      if (!att) return;

      // Read overrides from multiple sources and merge (prevent race condition)
      let currentOverrides: any = {};
      try {
        const fromField = typeof att.overrides === 'string' ? JSON.parse(att.overrides) : (att.overrides || {});
        const fromAnswers = (att.answers as any)?.__overrides__ || {};
        currentOverrides = { ...fromField, ...fromAnswers }; // Merge both sources
      } catch (e) { currentOverrides = {}; }

      const newOverrides = { ...currentOverrides, [qId]: isForcedCorrect };
      const sisAnswers = att.answers || {};

      // Weighted scoring: separate objective vs essay
      let objectiveCorrect = 0;
      let objectiveTotal = 0;
      let essayCorrect = 0;
      let essayTotal = 0;

      monitorQuestions.forEach((q: any) => {
        const type = q.type || "pilihan_ganda";
        const isEssay = type === "isian_singkat" || type === "uraian";

        let itemCorrect = false;
        if (newOverrides[q.id] !== undefined) {
          itemCorrect = newOverrides[q.id];
        } else {
          const ansId = sisAnswers[q.id];
          if (ansId) {
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

        if (isEssay) {
          essayTotal++;
          if (itemCorrect) essayCorrect++;
        } else {
          objectiveTotal++;
          if (itemCorrect) objectiveCorrect++;
        }
      });

      // Weighted final score: 60% objektif, 40% essay (jika ada essay)
      let finalScore: number;
      if (essayTotal === 0) {
        finalScore = objectiveTotal > 0 ? Math.round((objectiveCorrect / objectiveTotal) * 100) : 0;
      } else {
        const objScore = objectiveTotal > 0 ? (objectiveCorrect / objectiveTotal) * 100 : 0;
        const essScore = essayTotal > 0 ? (essayCorrect / essayTotal) * 100 : 0;
        finalScore = Math.round(objScore * 0.6 + essScore * 0.4);
      }

      if (!pb) return;
      
      const essGradedVal = Object.keys(newOverrides).filter(k => {
        const q = monitorQuestions.find((x: any) => x.id === k);
        return q && (q.type === "isian_singkat" || q.type === "uraian");
      }).length;

      // Simpan overrides juga di dalam field answers sebagai backup (key: __overrides__)
      const updatedAnswers = { 
        ...(att.answers || {}), 
        __overrides__: newOverrides,
        __meta: {
          ...((att.answers || {}).__meta || {}),
          objectiveScore: objectiveTotal > 0 ? Math.round((objectiveCorrect / objectiveTotal) * 100) : 0,
          objectiveCorrect: Math.floor(objectiveCorrect),
          objectiveTotal,
          essayTotal,
          essayCorrect,
          essayScore: essayTotal > 0 ? Math.round((essayCorrect / essayTotal) * 100) : 0,
          essayGraded: essGradedVal
        }
      };

      await pb.collection('attempts').update(att.id, {
        overrides: newOverrides,
        answers: updatedAnswers,
        correct: Math.floor(objectiveCorrect + essayCorrect),
        objectiveCorrect: Math.floor(objectiveCorrect),
        objectiveTotal,
        objectiveScore: objectiveTotal > 0 ? Math.round((objectiveCorrect / objectiveTotal) * 100) : 0,
        essayCorrect,
        essayTotal,
        essayScore: essayTotal > 0 ? Math.round((essayCorrect / essayTotal) * 100) : 0,
        essayGraded: essGradedVal,
        score: finalScore
      });

      // Update local state immediately to prevent race condition on next grade
      setAttempts(prev => prev.map(a => a.id === att.id ? { ...a, overrides: newOverrides, answers: updatedAnswers, score: finalScore } : a));
    } catch (error) { console.error(error); }
  };

  const handleClearOverride = async (studentId: string, qId: string) => {
    try {
      const studentAttempts = attempts.filter(a => a.studentId === studentId || (a as any).student_id === studentId);
      const att = studentAttempts.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())[0];
      if (!att) return;

      // Get current overrides and remove the specific question
      let currentOverrides: Record<string, boolean> = {};
      try {
        const fromField = typeof att.overrides === 'string' ? JSON.parse(att.overrides) : (att.overrides || {});
        const fromAnswers = (att.answers as any)?.__overrides__ || {};
        currentOverrides = { ...fromField, ...fromAnswers };
      } catch (e) { currentOverrides = {}; }

      const newOverrides = { ...currentOverrides };
      delete newOverrides[qId];

      // Recalculate score without the override
      const sisAnswers = att.answers || {};
      let objCorrect = 0, objTotal = 0, essCorrect = 0, essTotal = 0;
      monitorQuestions.forEach((q: any) => {
        const type = q.type || "pilihan_ganda";
        const isEssay = type === "isian_singkat" || type === "uraian";
        let itemCorrect = false;
        if (newOverrides[q.id] !== undefined) {
          itemCorrect = newOverrides[q.id];
        } else {
          const ansId = sisAnswers[q.id];
          if (ansId) {
            if (type === "pilihan_ganda" || type === "benar_salah") { const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ansId).toLowerCase()); itemCorrect = ck ? q.choices[ck].isCorrect === true : false; }
            else if (type === "pilihan_ganda_kompleks") { const ck = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase()); const sk = Array.isArray(ansId) ? ansId.map((k: any) => String(k).toLowerCase()) : []; itemCorrect = sk.length === ck.length && sk.every((k: string) => ck.includes(k)); }
            else if (type === "isian_singkat") itemCorrect = isFuzzyMatch(ansId, q.answerKey);
            else if (type === "urutkan" || type === "drag_drop") { const co = (q.items || []).map((it: any) => it.id); itemCorrect = Array.isArray(ansId) && ansId.length === co.length && ansId.every((v: any, i: number) => v === co[i]); }
            else if (type === "menjodohkan") { const pairs = q.pairs || []; itemCorrect = pairs.length > 0 && pairs.every((p: any) => ansId[p.id] === p.right); }
          }
        }
        if (isEssay) { essTotal++; if (itemCorrect) essCorrect++; }
        else { objTotal++; if (itemCorrect) objCorrect++; }
      });

      let finalScore: number;
      if (essTotal === 0) {
        finalScore = objTotal > 0 ? Math.round((objCorrect / objTotal) * 100) : 0;
      } else {
        const objScore = objTotal > 0 ? (objCorrect / objTotal) * 100 : 0;
        const essScore = essTotal > 0 ? (essCorrect / essTotal) * 100 : 0;
        finalScore = Math.round(objScore * 0.6 + essScore * 0.4);
      }

      if (!pb) return;
      const updatedAnswers = { ...(att.answers || {}), __overrides__: newOverrides };
      await pb.collection('attempts').update(att.id, {
        overrides: newOverrides,
        answers: updatedAnswers,
        score: finalScore
      });

      setAttempts(prev => prev.map(a => a.id === att.id ? { ...a, overrides: newOverrides, answers: updatedAnswers, score: finalScore } : a));
    } catch (error) { console.error(error); }
  };

  const [aiGradingId, setAiGradingId] = useState<string | null>(null);
  const [waCopied, setWaCopied] = useState(false);

  // ✏️ Edit Jawaban Siswa
  const [editAnswerDialog, setEditAnswerDialog] = useState<{
    open: boolean;
    studentId: string;
    studentName: string;
    question: any;
    currentAnswer: string;
    qIdx: number;
  } | null>(null);

  const handleEditAnswer = async (newAnswer: string) => {
    if (!editAnswerDialog || !pb) return;
    const { studentId, question } = editAnswerDialog;
    const att = attempts.find(a => a.studentId === studentId || (a as any).student_id === studentId);
    if (!att) return;

    try {
      const updatedAnswers = { ...(att.answers || {}), [question.id]: newAnswer };
      // Hapus override untuk soal ini agar penilaian otomatis berlaku
      const currentOverrides = typeof att.overrides === 'string' ? JSON.parse(att.overrides) : (att.overrides || {});
      const newOverrides = { ...currentOverrides };
      delete newOverrides[question.id];
      // Juga hapus dari __overrides__ backup
      if (updatedAnswers.__overrides__) {
        const backup = { ...(updatedAnswers.__overrides__ as any) };
        delete backup[question.id];
        updatedAnswers.__overrides__ = backup;
      }
      const newScore = getLiveScore(updatedAnswers, newOverrides);
      await pb.collection('attempts').update(att.id, {
        answers: updatedAnswers,
        overrides: newOverrides,
        score: newScore,
      });
      setAttempts(prev => prev.map(a =>
        a.id === att.id ? { ...a, answers: updatedAnswers, overrides: newOverrides, score: newScore } : a
      ));
      setEditAnswerDialog(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyBelumUjian = () => {
    const absentStudents = students
      .map(s => ({
        ...s,
        className: examClasses.find(c => c.id === s.classId)?.name || "N/A"
      }))
      .filter(s => {
        if (monitorRoom?.allClasses) {
          if (monitorClassFilter !== "all" && examClasses.find(c => c.id === s.classId)?.name !== monitorClassFilter) return false;
          return true;
        }
        const allowedIds = Array.isArray(monitorRoom?.classId) ? monitorRoom?.classId : String(monitorRoom?.classId || "").split(",");
        if (!allowedIds.includes(s.classId)) return false;
        if (monitorClassFilter !== "all" && examClasses.find(c => c.id === s.classId)?.name !== monitorClassFilter) return false;
        return true;
      })
      .filter(s => !attempts.find(a => a.studentId === s.id || a.student_id === s.id))
      .sort((a, b) => {
        const ca = examClasses.find(c => c.id === a.classId)?.name || "N/A";
        const cb = examClasses.find(c => c.id === b.classId)?.name || "N/A";
        return ca.localeCompare(cb) || a.name.localeCompare(b.name);
      });

    if (absentStudents.length === 0) {
      showAlert("Info", "Semua siswa sudah ikut ujian.", "info");
      return;
    }

    // Group per kelas
    const grouped: Record<string, typeof absentStudents> = {};
    absentStudents.forEach(s => {
      const cls = examClasses.find(c => c.id === s.classId)?.name || "N/A";
      if (!grouped[cls]) grouped[cls] = [];
      grouped[cls].push(s);
    });

    const now = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    let text = `*SISWA BELUM UJIAN*\n`;
    text += `${monitorRoom?.room_name || monitorRoom?.examTitle || "Ujian"} — ${now}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `Total: *${absentStudents.length} siswa* belum mengerjakan\n\n`;

    Object.keys(grouped).sort().forEach(cls => {
      text += `*Kelas ${cls}* (${grouped[cls].length} siswa):\n`;
      grouped[cls].forEach((s, i) => {
        text += `${i + 1}. ${s.name}\n`;
      });
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    setWaCopied(true);
    setTimeout(() => setWaCopied(false), 2500);
  };

  const handleAIGrade = async (studentId: string, qId: string) => {
    const q = monitorQuestions.find((x: any) => x.id === qId);
    if (!q || !pb) return;

    const studentAttempts = attempts.filter(a => a.studentId === studentId || (a as any).student_id === studentId);
    const att = studentAttempts.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())[0];
    if (!att) return;

    const studentAnswer = att.answers?.[qId];
    if (!studentAnswer || (typeof studentAnswer === 'string' && !studentAnswer.trim())) {
      handleManualGrade(studentId, qId, false);
      return;
    }

    setAiGradingId(`${studentId}_${qId}`);
    try {
      // Better text extraction: preserve meaningful content
      const questionText = (q.text || "").replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const answerKey = q.answerKey || q.correctAnswer || "";

      const result = await gradeEssayWithAI(
        pb,
        questionText,
        String(studentAnswer).trim(),
        answerKey,
        q.type === "isian_singkat" ? "isian_singkat" : "uraian"
      );

      await handleManualGrade(studentId, qId, result.isCorrect);

      showAlert(
        result.isCorrect ? "✓ Benar" : "✗ Salah",
        `Skor: ${result.score}/100. ${result.feedback}`,
        result.isCorrect ? "success" : "warning"
      );
    } catch (err: any) {
      showAlert("Gagal", err.message || "AI tidak bisa menilai.", "danger");
    } finally {
      setAiGradingId(null);
    }
  };

  const handleExportExcel = () => {
    if (!monitorRoom) return;
    const workbook = XLSX.utils.book_new();

    // Helper: format answer for display in Excel

    // Helper: format answer for display in Excel
    const formatAnswer = (q: any, studentAns: any) => {
      if (!studentAns) return "-";
      const type = q.type || "pilihan_ganda";

      if (type === "pilihan_ganda" || type === "benar_salah") {
        return String(studentAns).toUpperCase();
      }
      if (type === "pilihan_ganda_kompleks") {
        return Array.isArray(studentAns) ? studentAns.map((k: any) => String(k).toUpperCase()).join(",") : String(studentAns).toUpperCase();
      }
      if (type === "isian_singkat" || type === "uraian") {
        const text = String(studentAns).replace(/<[^>]*>/g, '').trim();
        return text.length > 100 ? text.substring(0, 100) + "..." : text;
      }
      if (type === "urutkan" || type === "drag_drop") {
        return Array.isArray(studentAns) ? studentAns.join(" → ") : String(studentAns);
      }
      if (type === "menjodohkan") {
        if (typeof studentAns === "object" && !Array.isArray(studentAns)) {
          return Object.entries(studentAns).map(([k, v]) => `${k}=${v}`).join(", ");
        }
        return String(studentAns);
      }
      return String(studentAns);
    };

    // Type label for header
    const typeLabel = (type: string) => {
      switch (type) {
        case "pilihan_ganda": return "PG";
        case "pilihan_ganda_kompleks": return "PGK";
        case "benar_salah": return "BS";
        case "menjodohkan": return "JDH";
        case "urutkan": return "URU";
        case "drag_drop": return "DD";
        case "isian_singkat": return "IS";
        case "uraian": return "UR";
        default: return "PG";
      }
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
        fill: { patternType: "solid", fgColor: { rgb: "DCFCE7" } },
        font: { color: { rgb: "16A34A" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      wrong: {
        fill: { patternType: "solid", fgColor: { rgb: "FEE2E2" } },
        font: { color: { rgb: "DC2626" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      neutral: {
        font: { color: { rgb: "64748B" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      finalGreen: {
        fill: { patternType: "solid", fgColor: { rgb: "D1FAE5" } },
        font: { color: { rgb: "065F46" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      finalYellow: {
        fill: { patternType: "solid", fgColor: { rgb: "FEF9C3" } },
        font: { color: { rgb: "854D0E" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      finalRed: {
        fill: { patternType: "solid", fgColor: { rgb: "FEE2E2" } },
        font: { color: { rgb: "991B1B" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      }
    };

    const getFinalScoreStyle = (score: number) => {
      if (score >= 75) return STYLES.finalGreen;
      if (score >= 50) return STYLES.finalYellow;
      return STYLES.finalRed;
    };

    const COL_WIDTHS = [
      { wch: 4 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 22 },
      { wch: 10 }, { wch: 8 },
      { wch: 14 }, { wch: 8 }, { wch: 8 }, // Objektif: Jumlah Benar, 100%, 60%
      { wch: 14 }, { wch: 8 }, // Subjektif: Jumlah Benar, 40%
      { wch: 8 } // Nilai
    ];
    monitorQuestions.forEach((q) => {
      const type = q.type || "pilihan_ganda";
      const isEssay = type === "isian_singkat" || type === "uraian";
      COL_WIDTHS.push({ wch: isEssay ? 30 : 10 });
    });

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
    const buildSheet = (groupStudents: any[], sheetName: string) => {
      const headerRow1 = [
        "No", terminology.id, "Nama", terminology.class, "Login", "Durasi", "Submit",
        "Objektif", "", "", "Subjektif", "", "Nilai"
      ];
      const headerRow2 = [
        "", "", "", "", "", "", "",
        "Jumlah Benar", "100%", "60%", "Jumlah Benar", "40%", ""
      ];

      monitorQuestions.forEach((q, i) => {
        const type = q.type || "pilihan_ganda";
        headerRow1.push(`Q${i + 1} (${typeLabel(type)})`);
        headerRow2.push("");
      });

      const rows: any[][] = [
        headerRow1.map(h => ({ v: h, s: STYLES.header })),
        headerRow2.map(h => ({ v: h, s: STYLES.header }))
      ];

      const merges: any[] = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
        { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
        { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },
        { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },
        { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } },
        { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } },
        { s: { r: 0, c: 7 }, e: { r: 0, c: 9 } },
        { s: { r: 0, c: 10 }, e: { r: 0, c: 11 } },
        { s: { r: 0, c: 12 }, e: { r: 1, c: 12 } }
      ];

      monitorQuestions.forEach((_, i) => {
        merges.push({ s: { r: 0, c: 13 + i }, e: { r: 1, c: 13 + i } });
      });

      groupStudents.forEach((std, idx) => {
        const atts = attempts.filter(a => a.studentId === std.id || a.student_id === std.id);
        const att = atts.sort((ax, bx) => new Date(bx.created).getTime() - new Date(ax.created).getTime())[0];
        const answers = att?.answers || {};
        // Merge overrides from both field and answers.__overrides__ backup
        const rawOverrides = typeof att?.overrides === 'string' ? JSON.parse(att.overrides) : (att?.overrides || {});
        const answersOverrides = (answers as any)?.__overrides__ || {};
        const overrides: Record<string, boolean> = { ...answersOverrides, ...rawOverrides };

        // Calculate scores per category
        let objCorrect = 0, objTotal = 0, essCorrect = 0, essTotal = 0;
        monitorQuestions.forEach((q: any) => {
          const type = q.type || "pilihan_ganda";
          const isEssay = type === "isian_singkat" || type === "uraian";
          const ic = checkAns(q, answers[q.id], overrides);
          if (isEssay) { essTotal++; if (ic) essCorrect++; }
          else { objTotal++; if (ic) objCorrect++; }
        });

        const objScore = objTotal > 0 ? Math.round((objCorrect / objTotal) * 100) : 0;
        const essScore = essTotal > 0 ? Math.round((essCorrect / essTotal) * 100) : 0;
        let finalScore = att?.score || 0;
        if (att?.status === "finished" && finalScore === 0) {
          finalScore = getLiveScore(answers, overrides);
        }
        if (!finalScore) {
          finalScore = essTotal === 0 ? objScore : Math.round(objScore * 0.6 + essScore * 0.4);
        }

        // Calculate duration
        let durationStr = "-";
        const loginTime = att?.startedAt || att?.startTime || att?.created;
        if (loginTime) {
          const startMs = new Date(loginTime).getTime();
          const endMs = att?.submitTime ? new Date(att.submitTime).getTime() :
            (att?.submittedAt ? new Date(att.submittedAt).getTime() :
              (att?.status === "finished" ? new Date(att.updated || att.created).getTime() : Date.now()));
          const diffMs = Math.max(0, endMs - startMs);
          const dHrs = Math.floor(diffMs / (1000 * 60 * 60));
          const dMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          const dSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
          durationStr = dHrs > 0
            ? `${dHrs}j ${dMins}m ${dSecs}d`
            : `${dMins}m ${dSecs}d`;
        }

        const essGraded = Object.keys(overrides).filter(k => { const q = monitorQuestions.find((x: any) => x.id === k); return q && (q.type === "isian_singkat" || q.type === "uraian"); }).length;

        const finalVal = Math.round(finalScore) || 0;
        const ri = idx + 3;

        const row = [
          { v: idx + 1, s: STYLES.cellCenter },
          { v: std.nisn, s: STYLES.cellCenter },
          { v: std.name, s: STYLES.cell },
          { v: std.className, s: STYLES.cellCenter },
          { v: loginTime ? new Date(loginTime).toLocaleString("id-ID", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "-", s: STYLES.cellCenter },
          { v: durationStr, s: STYLES.cellCenter },
          { v: att?.submitTime ? new Date(att.submitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (att?.submittedAt ? new Date(att.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (att?.status === "finished" ? "Selesai" : (att ? "Proses" : "-"))), s: STYLES.cellCenter },
          { t: "s", v: `${objCorrect}/${objTotal}`, z: "@", s: STYLES.cellCenter },
          { t: "n", v: Number(objScore), s: getFinalScoreStyle(objScore) },
          { t: "n", v: Math.round(objScore * 0.6), f: `ROUND(I${ri}*0.6,0)`, s: STYLES.cellCenter },
          essTotal > 0 ? (
            essGraded < essTotal ?
              { t: "s", v: `${essGraded}/${essTotal} dinilai`, s: STYLES.cellCenter } :
              { t: "s", v: `${essCorrect}/${essTotal}`, z: "@", s: STYLES.cellCenter }
          ) : { t: "s", v: "-", s: STYLES.cellCenter },
          { t: "n", v: essTotal > 0 ? Math.round(essScore * 0.4) : 0, s: STYLES.cellCenter },
          { t: "n", v: finalVal, f: essTotal > 0 ? `ROUND(J${ri}+L${ri},0)` : `I${ri}`, s: getFinalScoreStyle(finalVal) }
        ];

        monitorQuestions.forEach(q => {
          const ans = answers[q.id];
          const isOverridden = overrides[q.id] !== undefined;
          const isCorrect = checkAns(q, ans, overrides);
          const display = isOverridden ? `${formatAnswer(q, ans)} ✓` : formatAnswer(q, ans);

          let cellStyle = STYLES.neutral;
          if (q.type === "uraian" && !isOverridden) {
            cellStyle = STYLES.neutral;
          } else if (ans || isOverridden) {
            cellStyle = isCorrect ? STYLES.correct : STYLES.wrong;
          }

          row.push({
            v: display,
            s: cellStyle
          });
        });

        rows.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = COL_WIDTHS;
      ws["!merges"] = merges;
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

    // Sheet: Siswa Belum Ujian
    const absentStudents = filteredStudents.filter(s => {
      const att = attempts.filter(a => a.studentId === s.id || a.student_id === s.id)[0];
      return !att;
    }).sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));

    if (absentStudents.length > 0) {
      const absentHeader = ["No", terminology.id, "Nama", terminology.class].map(h => ({
        v: h,
        s: {
          fill: { fgColor: { rgb: "DC2626" } },
          font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 },
          alignment: { horizontal: "center", vertical: "center" },
          border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
        }
      }));
      const absentRows: any[][] = [absentHeader];
      absentStudents.forEach((s, idx) => {
        absentRows.push([
          { v: idx + 1, s: STYLES.cellCenter },
          { v: s.nisn, s: STYLES.cellCenter },
          { v: s.name, s: STYLES.cell },
          { v: s.className, s: STYLES.cellCenter },
        ]);
      });
      const wsAbsent = XLSX.utils.aoa_to_sheet(absentRows);
      wsAbsent["!cols"] = [{ wch: 4 }, { wch: 15 }, { wch: 30 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, wsAbsent, "Belum Ujian");
    }

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
        if (!pb) return;
        try {
          const ongoing = attempts.filter(a => a.status === "ongoing" || a.status === "LOCKED");
          const chunkSize = 10;
          for (let i = 0; i < ongoing.length; i += chunkSize) {
            const chunk = ongoing.slice(i, i + chunkSize);
            await Promise.all(chunk.map(a => {
              const score = getLiveScore(a.answers || {}, a.overrides || {});
              return pb!.collection('attempts').update(a.id, {
                status: "finished",
                submitTime: new Date().toISOString(),
                score: score
              });
            }));
          }
          showAlert("Berhasil", "Seluruh pengerjaan telah diselesaikan.", "success");
        } catch (e) { showAlert("Gagal", "Error.", "danger"); }
      }
    });
  };



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
                <div className="flex items-center gap-1.5 min-w-0">
                  <BookOpen className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span className="font-medium truncate max-w-[140px] md:max-w-xs">{isLoading ? <Skeleton className="h-3 w-32" /> : monitorRoom?.subjectName}</span>
                </div>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="font-bold truncate max-w-[180px] md:max-w-md">{isLoading ? <Skeleton className="h-3 w-36" /> : `Bank Soal: ${monitorRoom?.examTitle || "Tanpa Nama"}`}</span>
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

      {/* 📊 Session Summary Cards - Now at the Top */}
      {(() => {
        // Helper: siswa eligible berdasarkan room + filter kelas aktif
        const eligibleStudents = students.filter(s => {
          if (monitorRoom?.allClasses) {
            if (monitorClassFilter !== "all" && examClasses.find(c => c.id === s.classId)?.name !== monitorClassFilter) return false;
            return true;
          }
          const allowedIds = Array.isArray(monitorRoom?.classId) ? monitorRoom?.classId : String(monitorRoom?.classId || "").split(",");
          if (!allowedIds.includes(s.classId)) return false;
          if (monitorClassFilter !== "all" && examClasses.find(c => c.id === s.classId)?.name !== monitorClassFilter) return false;
          return true;
        });
        const eligibleIds = new Set(eligibleStudents.map(s => s.id));

        // Filter attempts hanya untuk siswa eligible
        const filteredAttempts = attempts.filter(a => eligibleIds.has(a.studentId || a.student_id));

        const ongoingCount = filteredAttempts.filter(a => a.status === 'ongoing').length;
        const finishedCount = filteredAttempts.filter(a => a.status === 'finished' || a.status === 'submitted' || a.status === 'graded').length;
        const lockedCount = filteredAttempts.filter(a => a.status === 'LOCKED').length;

        const absentList = eligibleStudents
          .filter(s => !filteredAttempts.find(a => (a.studentId || a.student_id) === s.id))
          .sort((a, b) => {
            const ca = examClasses.find(c => c.id === a.classId)?.name || "";
            const cb = examClasses.find(c => c.id === b.classId)?.name || "";
            return ca.localeCompare(cb) || a.name.localeCompare(b.name);
          });

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {/* Total Peserta */}
            <div className="group bg-card p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm hover:border-blue-500/30 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Total Peserta</p>
                  <h4 className="text-xl font-black text-slate-800 dark:text-white leading-none">
                    {isLoading ? <Skeleton className="h-6 w-12" /> : eligibleStudents.length}
                  </h4>
                </div>
              </div>
            </div>

            {/* Sedang Ujian */}
            <div className="group bg-card p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm hover:border-emerald-500/30 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                  <Monitor className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Sedang Ujian</p>
                  <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                    {isLoading ? <Skeleton className="h-6 w-8" /> : ongoingCount}
                  </h4>
                </div>
              </div>
            </div>

            {/* Selesai */}
            <div className="group relative bg-card p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm hover:border-blue-500/30 transition-all flex items-center justify-between cursor-default">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Selesai</p>
                  {isLoading ? <Skeleton className="h-6 w-16" /> : (
                    <h4 className="text-xl font-black text-blue-600 dark:text-blue-400 leading-none">
                      {finishedCount}<span className="text-sm font-bold text-slate-400">/{eligibleStudents.length}</span>
                    </h4>
                  )}
                </div>
              </div>

              {/* Hover popup — siswa belum ujian */}
              {!isLoading && absentList.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-3 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover:translate-y-0">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">
                    Belum Ujian ({absentList.length} siswa)
                  </p>
                  <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                    {absentList.map(s => {
                      const cls = examClasses.find(c => c.id === s.classId)?.name || "-";
                      return (
                        <div key={s.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[160px]">{s.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 shrink-0 ml-2">{cls}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Terkunci */}
            <div className="group bg-card p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm hover:border-rose-500/30 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Terkunci</p>
                  <h4 className="text-xl font-black text-rose-600 dark:text-rose-400 leading-none">
                    {isLoading ? <Skeleton className="h-6 w-6" /> : lockedCount}
                  </h4>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* SIDEBAR - Enhanced & Integrated */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-6 h-fit sticky top-24">
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-2 mb-4 uppercase tracking-widest pl-1 border-l-2 border-blue-500 ml-1">
                Panel Filter & Aksi
              </h3>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60 space-y-5">
              <div className="space-y-4">
                <div className="relative group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    placeholder={`Cari ${terminology.student.toLowerCase()}...`}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setMonitorPage(1); }}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">Filter {terminology.class}</label>
                  <select
                    value={monitorClassFilter}
                    onChange={(e) => { setMonitorClassFilter(e.target.value); setMonitorPage(1); }}
                    className="w-full text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/10 appearance-none cursor-pointer text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">Semua {terminology.class}</option>
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
                    <option value="nama">Nama</option>
                    <option value="nilai">Nilai</option>
                    <option value="login">Login</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="default">Default</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <Button onClick={() => { sessionStorage.setItem("activeGradingRoomId", roomId || ""); navigate("/admin/penilaian"); }} variant="secondary" className="w-full rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 dark:border-indigo-800/40 text-indigo-700 font-semibold shadow-sm transition-all h-10">
                  <BookOpen className="mr-2 h-4 w-4" /> Detail Penilaian
                </Button>
                <Button onClick={() => navigate("/livescore-view")} variant="secondary" className="w-full rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 dark:border-indigo-800/40 text-indigo-700 font-semibold shadow-sm transition-all h-10">
                  <Trophy className="mr-2 h-4 w-4 text-amber-500" /> Papan Live Score
                </Button>
                <Button onClick={handleExportExcel} variant="secondary" className="w-full rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 dark:border-emerald-800/40 text-emerald-700 font-semibold shadow-sm transition-all h-10">
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
                </Button>
                <Button onClick={handleCopyBelumUjian} variant="secondary" className={`w-full rounded-xl border font-semibold shadow-sm transition-all h-10 ${waCopied ? "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400" : "bg-amber-50 hover:bg-amber-100 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 dark:border-amber-800/40 text-amber-700"}`}>
                  {waCopied ? <><Check className="mr-2 h-4 w-4" /> Tersalin!</> : <><Copy className="mr-2 h-4 w-4" /> Belum Ujian</>}
                </Button>
                {(role === "admin" || (role === "teacher" && teacherFullAccess)) && (
                  <>
                    <Button onClick={handleForceSubmitAll} variant="secondary" className="w-full rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border dark:border-rose-800/30 shadow-sm font-semibold h-10 transition-all">
                      <Users className="mr-2 h-4 w-4" /> Selesaikan Semua
                    </Button>
                    <Button onClick={handleResetAllSessions} variant="secondary" className="w-full rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border dark:border-orange-800/30 shadow-sm font-semibold h-10 transition-all">
                      <Users className="mr-2 h-4 w-4" /> Reset Semua Sesi
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {/* Formula Info (jika ada soal essay) */}
          {monitorQuestions.some((q: any) => q.type === "isian_singkat" || q.type === "uraian") && (
            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800/40 rounded-2xl p-4 flex items-center gap-4 text-xs">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-black text-indigo-700 dark:text-indigo-300 text-[10px] uppercase tracking-widest mb-1">Rumus Penilaian (Bobot 60:40)</p>
                <p className="text-indigo-600/80 dark:text-indigo-400/80 font-medium leading-relaxed">
                  <span className="font-bold">Nilai Final</span> = (Skor Objektif × <span className="font-black">60%</span>) + (Skor Subjektif × <span className="font-black">40%</span>)
                  <span className="mx-2 text-indigo-300">•</span>
                  <span className="text-blue-600 dark:text-blue-400">O:{monitorQuestions.filter((q: any) => q.type !== "isian_singkat" && q.type !== "uraian").length} soal</span>
                  <span className="mx-1 text-indigo-300">|</span>
                  <span className="text-purple-600 dark:text-purple-400">S:{monitorQuestions.filter((q: any) => q.type === "isian_singkat" || q.type === "uraian").length} soal</span>
                </p>
              </div>
            </div>
          )}

          <div className="bg-card rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden min-h-[500px]">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-10 text-center text-[10px]">No</TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-blue-600 transition-colors group select-none"
                      onClick={() => toggleSort("nama")}
                    >
                      <div className="flex items-center gap-1.5">
                        Nama {terminology.student}
                        {monitorSortBy === 'nama' ? (
                          monitorSortOrder === 'asc' ? <ChevronDown className="h-3 w-3 text-blue-600" /> : <ChevronDown className="h-3 w-3 text-blue-600 rotate-180" />
                        ) : <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />}
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-32 text-center cursor-pointer hover:text-blue-600 transition-colors group select-none"
                      onClick={() => toggleSort("status")}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        Status
                        {monitorSortBy === 'status' ? (
                          monitorSortOrder === 'asc' ? <ChevronDown className="h-3 w-3 text-blue-600" /> : <ChevronDown className="h-3 w-3 text-blue-600 rotate-180" />
                        ) : <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />}
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-20 text-center cursor-pointer hover:text-blue-600 transition-colors group select-none"
                      onClick={() => toggleSort("nilai")}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        Objektif
                        {monitorSortBy === 'nilai' ? (
                          monitorSortOrder === 'asc' ? <ChevronDown className="h-3 w-3 text-blue-600" /> : <ChevronDown className="h-3 w-3 text-blue-600 rotate-180" />
                        ) : <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />}
                      </div>
                    </TableHead>
                    {monitorQuestions.some((q: any) => q.type === "isian_singkat" || q.type === "uraian") && (
                      <TableHead className="w-20 text-center">Subjektif</TableHead>
                    )}
                    {monitorQuestions.some((q: any) => q.type === "isian_singkat" || q.type === "uraian") && (
                      <TableHead className="w-20 text-center">Nilai</TableHead>
                    )}
                    <TableHead
                      className="text-center w-32 cursor-pointer hover:text-blue-600 transition-colors group select-none text-[10px]"
                      onClick={() => toggleSort("monitoring")}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        Monitoring
                        {monitorSortBy === 'monitoring' ? (
                          monitorSortOrder === 'asc' ? <ChevronDown className="h-3 w-3 text-blue-600" /> : <ChevronDown className="h-3 w-3 text-blue-600 rotate-180" />
                        ) : <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={`skele-row-${i}`} className="h-16">
                        <TableCell className="text-center"><Skeleton className="h-3 w-3 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-48" /><Skeleton className="h-3 w-32 mt-1.5" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-6 w-8 mx-auto" /></TableCell>
                        <TableCell className="text-center px-1"><Skeleton className="h-6 w-12 mx-auto" /></TableCell>
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
                        const attA = attempts.find(at => at.studentId === a.id || at.student_id === a.id);
                        const attB = attempts.find(at => at.studentId === b.id || at.student_id === b.id);

                        let comparison = 0;
                        if (monitorSortBy === "nilai") {
                          comparison = getAttemptScore(attA) - getAttemptScore(attB);
                        } else if (monitorSortBy === "login") {
                          comparison = new Date(attA?.startTime || 0).getTime() - new Date(attB?.startTime || 0).getTime();
                        } else if (monitorSortBy === "status") {
                          const getStatusRank = (status?: string) => {
                            if (status === "LOCKED") return 3;
                            if (status === "ongoing") return 2;
                            if (status === "finished") return 1;
                            return 0;
                          };
                          comparison = getStatusRank(attA?.status) - getStatusRank(attB?.status);
                        } else if (monitorSortBy === "monitoring") {
                          const cheatA = attA?.cheatCount || 0;
                          const cheatB = attB?.cheatCount || 0;
                          if (cheatA !== cheatB) {
                            comparison = cheatA - cheatB;
                          } else {
                            const ansA = Object.keys(attA?.answers || {}).filter(k => k !== "__overrides__" && monitorQuestions.some((q: any) => q.id === k)).length;
                            const ansB = Object.keys(attB?.answers || {}).filter(k => k !== "__overrides__" && monitorQuestions.some((q: any) => q.id === k)).length;
                            comparison = ansA - ansB;
                          }
                        } else if (monitorSortBy === "nama") {
                          comparison = a.name.localeCompare(b.name);
                        }

                        if (comparison === 0) comparison = a.name.localeCompare(b.name);
                        return monitorSortOrder === "asc" ? comparison : -comparison;
                      });

                    const startIndex = (monitorPage - 1) * monitorPageSize;
                    const currentData = filtered.slice(startIndex, startIndex + monitorPageSize);

                    if (currentData.length === 0 && monitorPage === 1) return <TableRow><TableCell colSpan={7} className="h-60 text-center text-slate-400">{terminology.student} tidak ditemukan</TableCell></TableRow>;

                    const rows = currentData.map((student, localIdx) => {
                      const attempt = attempts.find(a => a.studentId === student.id || a.student_id === student.id);
                      const sisAnswers = attempt?.answers || {};
                      const answered = Object.keys(sisAnswers).filter(k =>
                        k !== "__overrides__" &&
                        monitorQuestions.some((q: any) => q.id === k)
                      ).length;
                      const isExpanded = expandedstudent === student.id;

                      return (
                        <React.Fragment key={student.id}>
                          <TableRow className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-16 ${isExpanded ? "bg-blue-50/30 dark:bg-blue-900/10" : ""}`}>
                            <TableCell className="text-center text-slate-400 text-[10px] px-1">{startIndex + localIdx + 1}</TableCell>
                            <TableCell>
                              <div className="flex flex-col cursor-pointer" onClick={() => { sessionStorage.setItem("activeGradingRoomId", roomId || ""); navigate(`/admin/penilaian/${student.id}`); }}>                                <span className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">{student.name}</span>
                                <span className="text-[10px] text-slate-500 font-medium">{student.nisn} • {student.className}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {attempt ? (
                                <div className="flex flex-col items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight border shadow-sm ${attempt.status === "finished" ? "bg-emerald-500 text-white border-emerald-400" :
                                    attempt.status === "LOCKED" ? "bg-rose-500 text-white border-rose-400" :
                                      "bg-blue-600 text-white border-blue-500"
                                    }`}>
                                    {attempt.status?.toUpperCase() || "AKTIF"}
                                  </span>
                                  <StudentTimer attempt={attempt} room={monitorRoom} />
                                </div>
                              ) : <span className="text-[10px] text-slate-400 font-bold italic">OFFLINE</span>}
                            </TableCell>
                            <TableCell className="text-center text-[11px] font-bold">
                              {(() => {
                                if (!attempt) return "-";
                                const overrides = attempt.overrides || (sisAnswers as any)?.__overrides__ || {};

                                // Calculate objective breakdown
                                let objCorrect = 0, objTotal = 0;
                                monitorQuestions.forEach((q: any) => {
                                  const type = q.type || "pilihan_ganda";
                                  const isEssay = type === "isian_singkat" || type === "uraian";
                                  if (!isEssay) {
                                    objTotal++;
                                    let ic = false;
                                    if (overrides[q.id] !== undefined) ic = overrides[q.id];
                                    else {
                                      const a = sisAnswers[q.id];
                                      if (a) {
                                        if (type === "pilihan_ganda" || type === "benar_salah") { const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(a).toLowerCase()); ic = ck ? q.choices[ck].isCorrect === true : false; }
                                        else if (type === "pilihan_ganda_kompleks") { const ck = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase()); const sk = Array.isArray(a) ? a.map(k => String(k).toLowerCase()) : []; ic = sk.length === ck.length && sk.every(k => ck.includes(k)); }
                                        else if (type === "menjodohkan") { const pairs = q.pairs || []; ic = pairs.length > 0 && pairs.every((p: any) => a[p.id] === p.right); }
                                        else if (type === "urutkan" || type === "drag_drop") { const co = (q.items || []).map((it: any) => it.id); ic = Array.isArray(a) && a.length === co.length && a.every((v: any, i: number) => v === co[i]); }
                                      }
                                    }
                                    if (ic) objCorrect++;
                                  }
                                });
                                objCorrect = Math.min(objCorrect, objTotal); // safety cap
                                const objScore = objTotal > 0 ? Math.round((objCorrect / objTotal) * 100) : 0;

                                return (
                                  <div className="flex flex-col items-center">
                                    <span className="text-blue-600 dark:text-blue-400 font-black text-sm">{objScore}</span>
                                    <span className="text-[9px] text-slate-400">{objCorrect}/{objTotal}</span>
                                  </div>
                                );
                              })()}
                            </TableCell>
                            {monitorQuestions.some((q: any) => q.type === "isian_singkat" || q.type === "uraian") && (
                              <TableCell className="text-center text-[11px] font-bold">
                                {(() => {
                                  if (!attempt) return "-";
                                  const overrides = attempt.overrides || (sisAnswers as any)?.__overrides__ || {};

                                  let essCorrect = 0, essTotal = 0;
                                  monitorQuestions.forEach((q: any) => {
                                    const type = q.type || "pilihan_ganda";
                                    if (type === "isian_singkat" || type === "uraian") {
                                      essTotal++;
                                      if (overrides[q.id]) essCorrect++;
                                    }
                                  });
                                  const essGraded = Object.keys(overrides).filter(k => { const q = monitorQuestions.find((x: any) => x.id === k); return q && (q.type === "isian_singkat" || q.type === "uraian"); }).length;
                                  const essScore = essTotal > 0 ? Math.round((essCorrect / essTotal) * 100) : 0;

                                  if (essGraded < essTotal) {
                                    return (
                                      <div className="flex flex-col items-center">
                                        <span className="text-amber-500 font-bold text-[10px]">{essGraded}/{essTotal}</span>
                                        <span className="text-[9px] text-amber-400">dinilai</span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="flex flex-col items-center">
                                      <span className="text-purple-600 dark:text-purple-400 font-black text-sm">{essScore}</span>
                                      <span className="text-[9px] text-slate-400">{essCorrect}/{essTotal}</span>
                                    </div>
                                  );
                                })()}
                              </TableCell>
                            )}
                            {monitorQuestions.some((q: any) => q.type === "isian_singkat" || q.type === "uraian") && (
                              <TableCell className="text-center text-[11px] font-bold">
                                {(() => {
                                  if (!attempt) return "-";
                                  const displayScore = getAttemptScore(attempt);

                                  return (
                                    <span className={`text-sm font-black ${attempt.status === "finished" ? "text-emerald-600" : "text-indigo-600 animate-pulse"}`}>{displayScore}</span>
                                  );
                                })()}
                              </TableCell>
                            )}
                            <TableCell className="text-center px-1">
                              <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold">
                                <span className="text-slate-600 font-bold">{answered}/{monitorQuestions.length}</span>
                                <span className="text-slate-200">|</span>
                                <span className={cn((attempt?.cheatCount || 0) > 0 ? "text-rose-600" : "text-slate-400")}>
                                  C: {attempt?.cheatCount || 0}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                {attempt && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setExpandedstudent(isExpanded ? null : student.id)}
                                      className={`h-8 w-8 rounded-xl transition-all shadow-sm ${isExpanded
                                        ? "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
                                        : "bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/40 dark:hover:bg-blue-900/50 dark:hover:text-blue-300"
                                        }`}
                                      title={isExpanded ? "Tutup" : "Detail"}
                                    >
                                      {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    <div className="relative">
                                      {(role === "admin" || (role === "teacher" && teacherFullAccess)) && (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => setOpenMenuId(openMenuId === student.id ? null : student.id)}
                                          className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 hover:text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/40 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-300 shadow-sm transition-all"
                                          title="Menu Opsi"
                                        >
                                          <Settings className="h-4 w-4" />
                                        </Button>
                                      )}
                                      {(role === "admin" || (role === "teacher" && teacherFullAccess)) && openMenuId === student.id && (
                                        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-100" onMouseLeave={() => setOpenMenuId(null)}>
                                          <div className="px-3 py-1 mb-1 border-b border-slate-50 dark:border-slate-700/50">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Opsi {terminology.student}</span>
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
                                    const overrides = attempt?.overrides || (sisAnswers as any)?.__overrides__ || {};
                                    const correct = overrides[q.id] !== undefined ? overrides[q.id] : (ans ? (q.type === "isian_singkat" ? isFuzzyMatch(ans, q.answerKey) : q.choices?.[ans]?.isCorrect) : false);
                                    return (
                                      <div key={q.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-2">
                                        <div className="flex gap-2">
                                          <span className="text-[10px] font-black text-slate-400 shrink-0">#{qIdx + 1}</span>
                                          <MathText content={q.text} className="text-[9px] font-medium leading-tight text-slate-700 dark:text-slate-300 line-clamp-3" />
                                        </div>
                                        {/* Kunci Jawaban */}
                                        <div className="px-2 py-1.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800/30">
                                          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Kunci: </span>
                                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                            {(() => {
                                              const t = q.type || "pilihan_ganda";
                                              if (t === "pilihan_ganda" || t === "benar_salah") {
                                                const ck = Object.keys(q.choices || {}).find(k => q.choices[k]?.isCorrect);
                                                if (!ck) return stripHtmlTags(q.answerKey || "-");
                                                const choiceText = q.choices[ck]?.text || "";
                                                return <span className="inline-flex items-baseline gap-0.5"><span>{ck.toUpperCase()}.</span> <MathText content={choiceText} className="inline text-[10px] [&_p]:inline [&_p]:m-0 [&_img]:hidden" /></span>;
                                              }
                                              if (t === "pilihan_ganda_kompleks") {
                                                const cks = Object.keys(q.choices || {}).filter(k => q.choices[k]?.isCorrect);
                                                return cks.map(k => k.toUpperCase()).join(", ") || "-";
                                              }
                                              if (t === "isian_singkat" || t === "uraian") return <MathText content={q.answerKey || "-"} className="inline text-[10px] [&_p]:inline [&_p]:m-0 [&_img]:hidden" />;
                                              if (t === "menjodohkan") return `${(q.pairs || []).length} pasangan`;
                                              if (t === "urutkan" || t === "drag_drop") return (q.items || []).map((it: any) => stripHtmlTags(it.text || "").substring(0, 10)).join(" → ");
                                              return stripHtmlTags(q.answerKey || "-");
                                            })()}
                                          </span>
                                        </div>
                                        <div className={`mt-auto p-2 rounded-lg flex items-center justify-between ${correct ? "bg-emerald-50 text-emerald-700" : ans ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-500"}`}>
                                          <span className="text-[10px] font-bold truncate max-w-[60%]">Jawab: {ans ? (typeof ans === 'object' ? JSON.stringify(ans).substring(0, 30) : stripHtmlTags(String(ans)).substring(0, 30)) : "-"}</span>
                                          <div className="flex gap-1">
                                            {(role === "admin" || (role === "teacher" && teacherFullAccess)) && (
                                              <>
                                                {(q.type === "isian_singkat" || q.type === "uraian") && (
                                                  <button onClick={() => handleAIGrade(student.id, q.id)} disabled={aiGradingId === `${student.id}_${q.id}`} className="p-1 hover:bg-indigo-50 rounded text-indigo-500" title="Periksa dengan AI">
                                                    <Sparkles className={`h-3 w-3 ${aiGradingId === `${student.id}_${q.id}` ? "animate-spin" : ""}`} />
                                                  </button>
                                                )}
                                                {/* Edit jawaban — hanya pilihan ganda */}
                                                {(q.type === "pilihan_ganda" || q.type === "benar_salah" || !q.type) && (
                                                  <button
                                                    onClick={() => setEditAnswerDialog({
                                                      open: true,
                                                      studentId: student.id,
                                                      studentName: student.name,
                                                      question: q,
                                                      currentAnswer: ans || "",
                                                      qIdx,
                                                    })}
                                                    className="p-1 rounded hover:bg-amber-50 text-amber-500"
                                                    title="Edit jawaban siswa"
                                                  >
                                                    <Pencil className="h-3 w-3" />
                                                  </button>
                                                )}
                                                <button onClick={() => handleManualGrade(student.id, q.id, true)} className={`p-1 rounded ${overrides[q.id] === true ? "bg-emerald-200 text-emerald-700" : "hover:bg-white text-emerald-500"}`} title="Tandai Benar"><CheckCircle2 className="h-3 w-3" /></button>
                                                <button onClick={() => handleManualGrade(student.id, q.id, false)} className={`p-1 rounded ${overrides[q.id] === false ? "bg-rose-200 text-rose-700" : "hover:bg-white text-rose-500"}`} title="Tandai Salah"><X className="h-3 w-3" /></button>
                                                {overrides[q.id] !== undefined && (
                                                  <button onClick={() => handleClearOverride(student.id, q.id)} className="p-1 rounded hover:bg-amber-50 text-amber-500" title="Netralkan (hapus override)"><RotateCcw className="h-3 w-3" /></button>
                                                )}
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
        onConfirm={async () => {
          await confirmDialog.onConfirm();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }}
        title={confirmDialog.title}
        description={confirmDialog.description}
        type={confirmDialog.type}
        confirmLabel={confirmDialog.confirmLabel}
        requireWord={confirmDialog.requireWord}
      />

      {/* ✏️ Dialog Edit Jawaban Siswa */}
      <Dialog open={!!editAnswerDialog?.open} onOpenChange={(open) => { if (!open) setEditAnswerDialog(null); }}>
        <DialogContent className="max-w-lg bg-white dark:bg-slate-950 rounded-2xl border-none shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
          {editAnswerDialog && (() => {
            const q = editAnswerDialog.question;
            const choices: Record<string, { text: string; isCorrect: boolean }> = q.choices || {};
            const choiceKeys = Object.keys(choices).sort();
            const currentAns = editAnswerDialog.currentAnswer;

            return (
              <>
                <div className="bg-amber-500 px-6 py-5 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <Pencil className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Edit Jawaban Siswa</p>
                      <DialogTitle className="text-base font-black leading-tight">
                        Soal #{editAnswerDialog.qIdx + 1} — {editAnswerDialog.studentName}
                      </DialogTitle>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                  {/* Teks Soal */}
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Soal</p>
                    <MathText content={q.text} className="text-sm leading-relaxed text-slate-800 dark:text-slate-200" />
                    {q.image && (
                      <img src={q.image} className="mt-3 rounded-lg max-h-48 object-contain" alt="gambar soal" />
                    )}
                  </div>

                  {/* Pilihan Jawaban */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Jawaban</p>
                    {choiceKeys.length > 0 ? (
                      choiceKeys.map(key => {
                        const choice = choices[key];
                        const isSelected = currentAns === key;
                        const isCorrectKey = choice.isCorrect;
                        return (
                          <button
                            key={key}
                            onClick={() => setEditAnswerDialog(prev => prev ? { ...prev, currentAnswer: key } : prev)}
                            className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${isSelected
                                ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-900"
                              }`}
                          >
                            <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black border-2 ${isSelected
                                ? "bg-amber-500 border-amber-500 text-white"
                                : "border-slate-300 dark:border-slate-600 text-slate-500"
                              }`}>
                              {key.toUpperCase()}
                            </span>
                            <div className="flex-1 min-w-0">
                              <MathText content={choice.text} className="text-sm text-slate-700 dark:text-slate-300 leading-snug" />
                            </div>
                            {isCorrectKey && (
                              <span className="shrink-0 text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                KUNCI
                              </span>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 italic">Soal ini tidak memiliki pilihan ganda.</p>
                    )}
                  </div>

                  {/* Jawaban saat ini */}
                  <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-800">
                    <span>Jawaban dipilih:</span>
                    <span className="font-black text-amber-600 text-sm">
                      {editAnswerDialog.currentAnswer ? editAnswerDialog.currentAnswer.toUpperCase() : "— (belum dipilih)"}
                    </span>
                  </div>

                  {/* Tombol aksi */}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setEditAnswerDialog(null)}
                      className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => handleEditAnswer(editAnswerDialog.currentAnswer)}
                      disabled={!editAnswerDialog.currentAnswer}
                      className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-black uppercase tracking-widest transition-colors"
                    >
                      Simpan Jawaban
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

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
