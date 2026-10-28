import { getOnlineFlag } from "../../lib/network";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  ShieldAlert,
  Download,
  SlidersHorizontal,
  CheckSquare,
  FileText,
  GitBranch
} from "lucide-react";
import { Sparkles, RotateCcw, Copy, Check, Pencil, ClipboardPaste, Zap, BarChart2, ExternalLink } from "lucide-react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { ExamRoomPicker, ExamRoomPickerItem } from "../../components/common/ExamRoomPicker";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "../../components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";
import { cn } from "../../lib/utils";
import { useTenant } from "../../context/TenantContext";
import { useExamData } from "../../context/ExamDataContext";
import { useAuth } from "../../context/AuthContext";
import { getStudentExamUrl } from "../../utils/domainHelper";
import { ConfirmationDialog } from "../../components/dialogs/ConfirmationDialog";
import { MathText } from "../../components/ui/MathText";
import { gradeEssayWithAI } from "../../lib/ai";
// Refactored imports
import { ExamRoomData, stripHtmlTags, isFuzzyMatch, getTargetQuestions, computeQuestionScore, checkAns, getQuestionDetailInfo, QuestionDetailInfo } from "./monitoring/utils/helpers";
import { exportRecapExcel, exportEssayExcel } from "./monitoring/utils/exportExcel";
import { StudentTimer } from "./monitoring/components/StudentTimer";
import { ReopenDialog, ReopenDialogState } from "./monitoring/components/ReopenDialog";
import { EditAnswerDialog, EditAnswerDialogState } from "./monitoring/components/EditAnswerDialog";
import { StudentTable } from "./monitoring/components/StudentTable";
import { QuickGradeDialog } from "./monitoring/components/QuickGradeDialog";
import { countUniqueOngoingStudents } from "../../lib/attemptStats";
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
import { NeonPageHeader } from "../../components/ui/NeonPageHeader";
import { NeonBadge } from "../../components/ui/NeonBadge";
import { NeonTabs } from "../../components/ui/NeonTabs";
import { NeonStatGrid, NeonStatCard } from "../../components/ui/NeonStats";


const MonitoringPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryRoomId = searchParams.get("roomId");

  const [roomId, setRoomId] = useState<string | null>(() => {
    return queryRoomId || sessionStorage.getItem("activeMonitoringRoomId");
  });

  // Sinkronisasi query param & sessionStorage jika URL berubah
  useEffect(() => {
    if (queryRoomId && queryRoomId !== roomId) {
      setRoomId(queryRoomId);
      sessionStorage.setItem("activeMonitoringRoomId", queryRoomId);
    }
  }, [queryRoomId, roomId]);

  // Handler memilih ruangan dari ExamRoomPicker
  const handleSelectRoom = (r: ExamRoomPickerItem) => {
    setRoomId(r.id);
    sessionStorage.setItem("activeMonitoringRoomId", r.id);
    setSearchParams({ roomId: r.id });
  };

  // Handler kembali ke daftar pemilihan ruangan
  const handleSwitchRoom = () => {
    setRoomId(null);
    setMonitorRoom(null);
    setAttempts([]);
    setMonitorQuestions([]);
    setDetailStats(null);
    sessionStorage.removeItem("activeMonitoringRoomId");
    setSearchParams({});
  };

  const { user, role } = useAuth();
  const { pb, terminology, school } = useTenant();
  const { classes: examClasses, students, subjects, teachers: masterTeachers, teacherFullAccess, universalToken, timeLeft, loading: dataLoading } = useExamData();

  const [loading, setLoading] = useState(true);
  const isLoading = loading || dataLoading;
  const [monitorRoom, setMonitorRoom] = useState<ExamRoomData | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [monitorQuestions, setMonitorQuestions] = useState<any[]>([]);
  const [answersList, setAnswersList] = useState<Record<string, any>>({});
  // Mode ringan untuk room besar: matikan realtime attempts + fetch daftar TANPA
  // field answers yang berat. Progres diambil dari `answeredCount` (dihitung
  // server-side), detail jawaban diambil on-demand saat baris siswa dibuka.
  // Tombol refresh tetap berfungsi (memakai fetch ringan yang sama).
  const LARGE_ROOM_THRESHOLD = 200;
  const [isLargeRoom, setIsLargeRoom] = useState(false);
  const largeRoomRef = useRef(false);
  const [detailAnswers, setDetailAnswers] = useState<Record<string, any>>({});
  // Kunci monitoring untuk non-admin saat ujian besar (>200 peserta)
  const [monitoringLocked, setMonitoringLocked] = useState(false);
  // Field ringan untuk daftar attempts (tanpa `answers` yang bisa puluhan KB/record)
  const ATTEMPT_LITE_FIELDS = "id,studentId,examRoomId,status,isOnline,lastHeartbeat,score,correct,total,cheatCount,submittedAt,submitTime,created,updated,startedAt,startTime,overrides,objectiveScore,objectiveCorrect,objectiveTotal,essayScore,essayCorrect,essayGraded,essayTotal,answeredCount";
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedstudent, setExpandedstudent] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Tabs, and Inspector State (Neon Console parity with ExamRoomsPage)
  const [statusTab, setStatusTab] = useState<"all" | "ongoing" | "finished" | "absent" | "locked">("all");
  const [inspectedStudentId, setInspectedStudentId] = useState<string | null>(null);
  const [copiedUniversalToken, setCopiedUniversalToken] = useState(false);

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
  const [monitorTimeLeft, setMonitorTimeLeft] = useState(30);
  const [isMonitorRefreshing, setIsMonitorRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const isRefreshingRef = useRef(false);
  const lastTickRef = useRef(Date.now());

  const [searchQuery, setSearchQuery] = useState("");
  // Statistik agregasi dari backend (/api/room-detail-stats): COUNT(DISTINCT)
  // di SQL dengan definisi kanonis (siswa unik, eligible terhadap kelas room).
  // Dipakai untuk kartu "Sedang Ujian"/"Selesai" tanpa menunggu fetch attempts.
  const [detailStats, setDetailStats] = useState<{ total: number; ongoing: number; finished: number } | null>(null);

  // 📝 Real-time Live Score Calculator (Weighted: objective + essay)
  const getLiveScore = (sisAnswers: Record<string, any>, attOverrides: Record<string, boolean> = {}) => {
    if (!sisAnswers || monitorQuestions.length === 0) return 0;

    // Fallback: read overrides from answers.__overrides__ if attOverrides is empty
    const overrides = Object.keys(attOverrides).length > 0 ? attOverrides : ((sisAnswers as any)?.__overrides__ || {});
    const targetQuestions = getTargetQuestions(monitorQuestions, sisAnswers, monitorRoom?.max_questions);

    let objectiveCorrect = 0;
    let objectiveTotal = 0;
    let essayCorrect = 0;
    let essayTotal = 0;

    targetQuestions.forEach((q: any) => {
      const type = q.type || "pilihan_ganda";
      const isEssay = type === "uraian";
      const itemScore = computeQuestionScore(q, sisAnswers[q.id], overrides);

      if (isEssay) {
        essayTotal++;
        essayCorrect += itemScore;
      } else {
        objectiveTotal++;
        objectiveCorrect += itemScore;
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
            const targetQuestions = getTargetQuestions(monitorQuestions, att.answers || {}, monitorRoom?.max_questions);

            let objCorrect = 0, objTotal = 0;
            targetQuestions.forEach((q: any) => {
              const type = q.type || q.field || "pilihan_ganda";
              const isEssay = type === "uraian";
              if (!isEssay) {
                objTotal++;
                const s = computeQuestionScore(q, (att.answers || {})[q.id], att.overrides || {});
                objCorrect += s;
              }
            });
            objCorrect = Math.min(objCorrect, objTotal);
            const savedObjCorrect = Number.isInteger(objCorrect) ? objCorrect : (Math.round(objCorrect * 10) / 10);
            await pb.collection('attempts').update(att.id, {
              score,
              objectiveScore: objTotal > 0 ? Math.round((objCorrect / objTotal) * 100) : 0,
              objectiveCorrect: savedObjCorrect,
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

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const [reopenDialog, setReopenDialog] = useState<ReopenDialogState>({
    isOpen: false,
    attemptIds: [],
    title: "",
    remainingMinutes: 0,
    timeOption: "extra",
    extraMinutes: 10,
  });
  const [isReopening, setIsReopening] = useState(false);

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
    isRefreshingRef.current = true;
    try {
      if (!pb) return;
      // 0. Statistik agregasi backend (ringan, 1 query SQL) — untuk kartu
      // "Sedang Ujian"/"Selesai". Tidak menunggu fetch attempts yang berat.
      try {
        const st: any = await pb.send(`/api/room-detail-stats?roomId=${id}`, { method: "GET" });
        if (st && typeof st.ongoing === "number") {
          setDetailStats({ total: Number(st.total) || 0, ongoing: Number(st.ongoing) || 0, finished: Number(st.finished) || 0 });
        }
      } catch (e) { /* endpoint belum tersedia: fallback ke hitungan lokal */ }
      // 1. Ambil Data Ruangan jika belum ada
      let currentRoom = monitorRoom;
      if (!currentRoom) {
        const roomRecord = await pb.collection('exam_rooms').getOne(id, {
          expand: 'examId,examId.teacherId,examId.subjectId'
        });
        const examObj = roomRecord.expand?.examId || await pb.collection('exams').getOne(roomRecord.examId).catch(() => null);

        // Robust mapping similar to ExamRoomsPage
        const sId = roomRecord.examId || (roomRecord as any).examid || "";
        const roomName = roomRecord.room_name || (roomRecord as any).title || roomRecord.title || "Tanpa Nama";
        const isOff = roomRecord.isDisabled !== undefined ? roomRecord.isDisabled : (roomRecord as any).isActive === false;
        const subjectObj = examObj?.expand?.subjectId || subjects.find((s: any) => s.id === (examObj?.subjectId || (examObj as any)?.subjectid));
        const teacherObj = examObj?.expand?.teacherId || masterTeachers.find((t: any) => t.id === (examObj?.teacherId || (examObj as any)?.teacherid));

        // Robust mapping for Class IDs
        // Field di DB: classIds (JSON array). classId bisa kosong atau tidak ada.
        // Prioritaskan classIds. Jika kosong → room terbuka untuk semua kelas.
        const isAllClasses = roomRecord.allClasses || (roomRecord as any).all_classes || false;
        const clsData = (roomRecord as any).classIds || (roomRecord as any).classids || roomRecord.classId || (roomRecord as any).classid || "";
        let classList: string[] = [];

        if (Array.isArray(clsData)) {
          classList = clsData.map((id: string) => String(id).trim()).filter(Boolean);
        } else if (typeof clsData === 'string' && clsData.length > 0) {
          try {
            const parsed = JSON.parse(clsData);
            classList = Array.isArray(parsed) ? parsed.map((id: string) => String(id).trim()).filter(Boolean) : clsData.split(",").map((id: string) => id.trim()).filter(Boolean);
          } catch {
            classList = clsData.split(",").map((id: string) => id.trim()).filter(Boolean);
          }
        }

        // classIds kosong di DB atau mencakup seluruh kelas = room terbuka semua kelas
        const effectiveAllClasses = isAllClasses || classList.length === 0 || (examClasses.length > 0 && classList.length >= examClasses.length);

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
          allClasses: effectiveAllClasses,
          classId: classList
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
            complex_choice: "pilihan_ganda_kompleks",
            matching: "menjodohkan",
            true_false: "benar_salah",
            short_answer: "isian_singkat",
            essay: "uraian",
            ordering: "urutkan",
            sequence: "urutkan",
            drag_drop: "drag_drop",
            pilihan_ganda: "pilihan_ganda",
            pilihan_ganda_kompleks: "pilihan_ganda_kompleks",
            isian_singkat: "isian_singkat",
            uraian: "uraian",
            menjodohkan: "menjodohkan",
            urutkan: "urutkan",
            benar_salah: "benar_salah",
            klasifikasi: "klasifikasi",
            hotspot: "hotspot",
            isian_rumpang: "isian_rumpang",
            matriks: "matriks"
          };
          const mappedType = typeMapReverse[rawType] || rawType;
          let rawOptions = q.options || {};
          if (typeof rawOptions === "string") {
            try { rawOptions = JSON.parse(rawOptions); } catch (e) { rawOptions = {}; }
          }
          return {
            ...q,
            type: mappedType,
            choices: rawOptions,
            statements: (["benar_salah", "klasifikasi", "matriks"].includes(mappedType) && Array.isArray(rawOptions.statements))
              ? rawOptions.statements
              : (Array.isArray(rawOptions) ? rawOptions : (q.statements || undefined)),
            pairs: mappedType === "menjodohkan" ? rawOptions.pairs : undefined,
            items: (mappedType === "urutkan" || mappedType === "drag_drop") ? rawOptions.items : undefined,
            categories: mappedType === "klasifikasi" ? rawOptions.categories : undefined,
            columns: mappedType === "matriks" ? rawOptions.columns : undefined,
            blanks: mappedType === "isian_rumpang" ? rawOptions.blanks : undefined,
            areas: mappedType === "hotspot" ? rawOptions.areas : undefined,
            imageUrl: mappedType === "hotspot" ? rawOptions.imageUrl : undefined,
            mode: mappedType === "hotspot" ? rawOptions.mode : undefined,
            answerKey: q.correctAnswer || q.answerKey
          };
        });
        setMonitorQuestions(
          // Deduplicate berdasarkan ID — cegah soal ganda dari DB
          Array.from(new Map(mappedQuestions.map((q: any) => [q.id, q])).values())
            .sort((a: any, b: any) => {
              const aIsEssay = a.type === "uraian";
              const bIsEssay = b.type === "uraian";
              if (aIsEssay && !bIsEssay) return 1;
              if (!aIsEssay && bIsEssay) return -1;
              return 0;
            })
        );
      }

      // 3. Ambil DATA PENGERJAAN — ringan dulu (tanpa answers yang berat).
      // Room kecil (<=200 attempt) di-upgrade ke data penuh agar live score
      // & realtime tetap kaya seperti sebelumnya.
      if (pb) {
        let loadedAttempts: any[] = await pb.collection('attempts').getFullList({
          filter: `examRoomId = "${id}"`,
          fields: ATTEMPT_LITE_FIELDS,
        });
        const large = loadedAttempts.length > LARGE_ROOM_THRESHOLD;
        largeRoomRef.current = large;
        setIsLargeRoom(large);
        // Kunci monitoring untuk non-admin saat ujian besar
        setMonitoringLocked(large && role !== "admin");
        if (!large) {
          loadedAttempts = await pb.collection('attempts').getFullList({
            filter: `examRoomId = "${id}"`
          });
        }

        const grouped: Record<string, any> = {};
        loadedAttempts.forEach(att => {
          const sId = att.studentId || att.student_id;
          if (sId && att.answers) grouped[sId] = att.answers;
        });

        setAnswersList(grouped);
        setAttempts(loadedAttempts);

        // Auto-sync out-of-sync finished attempts in background.
        // DILEWATI di mode ringan: tanpa answers, komputasi dari objek kosong
        // akan merusak skor/jawaban yang sudah benar.
        const finishedAttempts = loadedAttempts.filter(att => att.status === "finished");
        if (!largeRoomRef.current && finishedAttempts.length > 0 && monitorQuestions.length > 0) {
          const syncPromises = finishedAttempts.map(async (att) => {
            const answers = att.answers || {};
            const rawOverrides = typeof att.overrides === 'string' ? JSON.parse(att.overrides) : (att.overrides || {});
            const answersOverrides = answers.__overrides__ || {};
            const overrides = { ...answersOverrides, ...rawOverrides };

            const targetQuestions = getTargetQuestions(monitorQuestions, answers, monitorRoom?.max_questions);

            let objCorrect = 0, objTotal = 0, essCorrect = 0, essTotal = 0;
            targetQuestions.forEach((q: any) => {
              const type = q.type || "pilihan_ganda";
              const isEssay = type === "uraian";
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
              return q && (q.type === "uraian");
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
            }).catch(() => { });
          });
        }
      }
    } catch (e) {
      console.error("Refresh Monitor Error:", e);
    } finally {
      setIsMonitorRefreshing(false);
      isRefreshingRef.current = false;
      setLoading(false);
      setLastSyncTime(new Date());
    }
  }, [roomId, monitorRoom, monitorQuestions.length, pb, subjects, masterTeachers, examClasses]);

  // Pemicu penyegaran manual oleh pengawas / guru
  const handleTriggerManualRefresh = useCallback(() => {
    if (isRefreshingRef.current) return;
    lastTickRef.current = Date.now();
    setMonitorTimeLeft(isLargeRoom ? 45 : 30);
    handleManualRefreshMonitor();
  }, [isLargeRoom, handleManualRefreshMonitor]);

  // Initial Fetch
  useEffect(() => {
    handleManualRefreshMonitor();
  }, [roomId]);

  // Sinkronisasi otomatis berkala (30 dtk default / 45 dtk room besar)
  useEffect(() => {
    lastTickRef.current = Date.now();
    const intervalSec = isLargeRoom ? 45 : 30;
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - lastTickRef.current) / 1000);
      if (elapsed >= 1) {
        lastTickRef.current = now;
        setMonitorTimeLeft(prev => {
          const next = prev - elapsed;
          if (next <= 0) {
            if (!isRefreshingRef.current) {
              handleManualRefreshMonitor();
            }
            return intervalSec;
          }
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [handleManualRefreshMonitor, isLargeRoom]);

  // Real-time Subscription - DIMATIKAN untuk attempts di room besar agar tab tidak
  // dibanjiri puluhan event/detik berisi answers penuh. Penggantinya: polling
  // ringan (tanpa answers) tiap 30-45 detik + tombol refresh manual.
  useEffect(() => {
    if (!roomId) return;

    let isSubscribed = true;
    let currentUnsub: (() => void) | null = null;

    const startSubscribe = async () => {
      if (!pb) return;
      try {
        let unsub: (() => void) | null = null;
        if (!isLargeRoom) {
          unsub = await pb.collection('attempts').subscribe("*", (e) => {
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
        }

        const unsubQuestions = await pb.collection('questions').subscribe("*", (e) => {
          if (!isSubscribed) return;
          if (e.record.examId === monitorRoom?.examId) {
            setMonitorQuestions([]);
          }
        });

        if (!isSubscribed) {
          if (unsub) unsub();
          unsubQuestions();
        } else {
          currentUnsub = () => { if (unsub) unsub(); unsubQuestions(); };
        }
      } catch (err) { }
    };

    startSubscribe();

    return () => {
      isSubscribed = false;
      if (currentUnsub) currentUnsub();
    };
  }, [roomId, monitorRoom?.examId, isLargeRoom]);

  const handleUnlockStudent = async (attId: string) => {
    if (!pb) return;
    try {
      const targetAtt = attempts.find(a => a.id === attId);
      const roomDur = monitorRoom?.duration || 60;
      let newStartedAt = targetAtt?.startedAt;

      // Jika durasi siswa sudah habis saat terkunci, beri waktu tambahan 5 menit agar tidak langsung auto-finish
      if (targetAtt?.startedAt) {
        const targetEnd = new Date(targetAtt.startedAt).getTime() + roomDur * 60000;
        if (targetEnd <= Date.now()) {
          newStartedAt = new Date(Date.now() + 5 * 60000 - roomDur * 60000).toISOString();
        }
      }

      await pb.collection('attempts').update(attId, {
        status: 'ongoing',
        ...(newStartedAt ? { startedAt: newStartedAt } : {})
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
            score: score,
            forceFinished: true,
            forceFinishedAt: new Date().toISOString()
          });
          showAlert("Berhasil", `${terminology.student} dipaksa selesai.`, "success");
        } catch (e) { showAlert("Gagal", "Gagal.", "danger"); }
      }
    });
  };

  const handleOpenReopenDialog = (att: any, studentName: string) => {
    const roomDur = monitorRoom?.duration || 60;
    const startStr = att.startedAt || att.startTime || att.created;
    let remainingMins = 0;
    if (startStr) {
      const targetEnd = new Date(startStr).getTime() + roomDur * 60000;
      remainingMins = Math.max(0, Math.floor((targetEnd - Date.now()) / 60000));
    }

    setReopenDialog({
      isOpen: true,
      attemptIds: [att.id],
      title: studentName || "Siswa",
      remainingMinutes: remainingMins,
      timeOption: remainingMins > 0 ? "keep" : "extra",
      extraMinutes: 10,
    });
  };

  const handleOpenReopenAllFinishedDialog = () => {
    const finishedAtts = attempts.filter(a => a.status === "finished");
    if (finishedAtts.length === 0) return;

    setReopenDialog({
      isOpen: true,
      attemptIds: finishedAtts.map(a => a.id),
      title: `${finishedAtts.length} Siswa yang Sudah Selesai`,
      remainingMinutes: 0,
      timeOption: "extra",
      extraMinutes: 10,
    });
  };

  const handleOpenReopenSelectedDialog = () => {
    const selectedAtts = attempts.filter(a => selectedStudentIds.includes(a.studentId || (a as any).student_id) && a.status === "finished");
    if (selectedAtts.length === 0) {
      showAlert("Info", "Dari siswa yang dipilih, tidak ada yang berstatus 'finished' (selesai).", "warning");
      return;
    }

    setReopenDialog({
      isOpen: true,
      attemptIds: selectedAtts.map(a => a.id),
      title: `${selectedAtts.length} Siswa Terpilih (Selesai)`,
      remainingMinutes: 0,
      timeOption: "extra",
      extraMinutes: 10,
    });
  };

  const handleConfirmReopen = async () => {
    if (!pb || reopenDialog.attemptIds.length === 0) return;
    setIsReopening(true);
    try {
      const roomDur = monitorRoom?.duration || 60;
      const targetAtts = attempts.filter(a => reopenDialog.attemptIds.includes(a.id));

      // 🛡️ Jika jadwal batas waktu ruangan sudah terlewati (expired), otomatis perpanjang endTime ruangan
      // agar siswa tidak terblokir saat mencoba masuk kembali (terutama di APK lama)
      const rawEnd = monitorRoom?.endTime || monitorRoom?.end_time;
      if (monitorRoom?.id && rawEnd) {
        const roomEnd = new Date(rawEnd).getTime();
        if (roomEnd <= Date.now()) {
          const newRoomEndTime = new Date(Date.now() + 120 * 60000).toISOString();
          try {
            await pb.collection('exam_rooms').update(monitorRoom.id, {
              endTime: newRoomEndTime
            });
            console.log(`[REOPEN] Jadwal ruangan telah diperpanjang otomatis hingga 2 jam ke depan: ${newRoomEndTime}`);
          } catch (roomErr) {
            console.warn("[REOPEN] Gagal update endTime ruangan otomatis:", roomErr);
          }
        }
      }

      const chunkSize = 10;
      for (let i = 0; i < targetAtts.length; i += chunkSize) {
        const chunk = targetAtts.slice(i, i + chunkSize);
        await Promise.all(chunk.map(att => {
          let newStartedAt = att?.startedAt || att?.created || new Date().toISOString();

          if (reopenDialog.timeOption === "reset") {
            newStartedAt = new Date().toISOString();
          } else if (reopenDialog.timeOption === "extra") {
            const extraMs = (reopenDialog.extraMinutes || 10) * 60000;
            newStartedAt = new Date(Date.now() + extraMs - roomDur * 60000).toISOString();
          } else if (reopenDialog.timeOption === "keep") {
            const origEnd = new Date(newStartedAt).getTime() + roomDur * 60000;
            if (origEnd <= Date.now()) {
              newStartedAt = new Date(Date.now() + 5 * 60000 - roomDur * 60000).toISOString();
            }
          }

          return pb.collection('attempts').update(att.id, {
            status: "ongoing",
            submittedAt: "",
            startedAt: newStartedAt,
            isOnline: getOnlineFlag(),
            lastHeartbeat: new Date().toISOString()
          });
        }));
      }

      showAlert("Berhasil", `Berhasil membuka kembali ${reopenDialog.attemptIds.length} ujian siswa menjadi Ongoing.`, "success");
      setReopenDialog(prev => ({ ...prev, isOpen: false, attemptIds: [] }));
      setSelectedStudentIds([]);
      handleManualRefreshMonitor();
    } catch (err: any) {
      showAlert("Gagal", err.message || "Gagal membuka kembali ujian.", "danger");
    } finally {
      setIsReopening(false);
    }
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
      const targetQuestions = getTargetQuestions(monitorQuestions, sisAnswers, monitorRoom?.max_questions);

      // Weighted scoring: separate objective vs essay
      let objectiveCorrect = 0;
      let objectiveTotal = 0;
      let essayCorrect = 0;
      let essayTotal = 0;

      targetQuestions.forEach((q: any) => {
        const type = q.type || "pilihan_ganda";
        const isEssay = type === "uraian";
        const itemCorrect = checkAns(q, sisAnswers[q.id], newOverrides);

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
        return q && (q.type === "uraian");
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
      const targetQuestions = getTargetQuestions(monitorQuestions, sisAnswers, monitorRoom?.max_questions);
      let objCorrect = 0, objTotal = 0, essCorrect = 0, essTotal = 0;

      targetQuestions.forEach((q: any) => {
        const type = q.type || "pilihan_ganda";
        const isEssay = type === "uraian";
        const itemCorrect = checkAns(q, sisAnswers[q.id], newOverrides);
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
  const [editAnswerDialog, setEditAnswerDialog] = useState<EditAnswerDialogState | null>(null);

  // ⚡ Quick Grade (paste tabel dari Excel/Sheets)
  const [quickGradeOpen, setQuickGradeOpen] = useState(false);


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


  // 📥 Export Excel (extracted to utils/exportExcel.ts)
  const handleExportExcel = () => {
    exportRecapExcel({ monitorRoom, students, attempts, monitorQuestions, terminology, examClasses, monitorClassFilter, getLiveScore, showAlert });
  };

  const handleExportEssayExcel = () => {
    exportEssayExcel({ monitorRoom, students, attempts, monitorQuestions, terminology, examClasses, monitorClassFilter, getLiveScore, showAlert });
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

  // Filter and compute statistics
  const eligibleStudents = useMemo(() => {
    if (!monitorRoom) return students;
    return students.filter((s: any) => {
      if (monitorRoom?.allClasses) {
        if (monitorClassFilter !== "all" && examClasses.find((c: any) => c.id === s.classId)?.name !== monitorClassFilter) return false;
        return true;
      }
      const allowedIds = Array.isArray(monitorRoom?.classId) ? monitorRoom?.classId : String(monitorRoom?.classId || "").split(",");
      if (!allowedIds.includes(s.classId)) return false;
      if (monitorClassFilter !== "all" && examClasses.find((c: any) => c.id === s.classId)?.name !== monitorClassFilter) return false;
      return true;
    });
  }, [students, monitorRoom, monitorClassFilter, examClasses]);

  const eligibleIds = useMemo(() => new Set(eligibleStudents.map((s: any) => s.id)), [eligibleStudents]);

  const filteredAttempts = useMemo(() => attempts.filter((a: any) => eligibleIds.has(a.studentId || a.student_id)), [attempts, eligibleIds]);
  const ongoingCount = useMemo(() => countUniqueOngoingStudents(filteredAttempts), [filteredAttempts]);
  const finishedCount = useMemo(() => filteredAttempts.filter((a: any) => a.status === 'finished' || a.status === 'submitted' || a.status === 'graded').length, [filteredAttempts]);
  const lockedCount = useMemo(() => filteredAttempts.filter((a: any) => a.status === 'LOCKED').length, [filteredAttempts]);

  const useBackendStats = detailStats !== null && monitorClassFilter === "all";
  const dispOngoing = useBackendStats ? detailStats.ongoing : ongoingCount;
  const dispFinished = useBackendStats ? detailStats.finished : finishedCount;

  const absentList = useMemo(() => eligibleStudents
    .filter((s: any) => !filteredAttempts.find((a: any) => (a.studentId || a.student_id) === s.id))
    .sort((a: any, b: any) => {
      const ca = examClasses.find((c: any) => c.id === a.classId)?.name || "";
      const cb = examClasses.find((c: any) => c.id === b.classId)?.name || "";
      return ca.localeCompare(cb) || a.name.localeCompare(b.name);
    }), [eligibleStudents, filteredAttempts, examClasses]);
  const absentCount = absentList.length;

  const inspectedStudent = useMemo(() => {
    if (inspectedStudentId) {
      const found = students.find(s => s.id === inspectedStudentId);
      if (found) {
        return {
          ...found,
          className: examClasses.find(c => c.id === found.classId)?.name || found.className || "-"
        };
      }
    }
    const first = eligibleStudents[0];
    if (first) {
      return {
        ...first,
        className: examClasses.find(c => c.id === first.classId)?.name || first.className || "-"
      };
    }
    return null;
  }, [inspectedStudentId, students, eligibleStudents, examClasses]);

  const inspectedAttempt = useMemo(() => {
    if (!inspectedStudent) return null;
    return attempts.find(a => (a.studentId || a.student_id) === inspectedStudent.id) || null;
  }, [inspectedStudent, attempts]);

  // Auto-select first student when data loads
  useEffect(() => {
    if (!inspectedStudentId && eligibleStudents.length > 0) {
      setInspectedStudentId(eligibleStudents[0].id);
    }
  }, [eligibleStudents, inspectedStudentId]);

  // 1. Jika belum memilih ruang ujian, tampilkan ExamRoomPicker (daftar seluruh ruangan)
  if (!roomId) {
    return (
      <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
        <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <ExamRoomPicker
            title="Live Monitoring &amp; Pengawasan Ujian"
            subtitle="Pilih sesi ruang ujian aktif untuk memantau status pengerjaan peserta, sisa durasi ujian, reset sesi login, dan live score secara realtime."
            badgeText="Monitoring Live"
            actionText="Pantau Ruang Ujian"
            icon={Eye}
            onSelectRoom={handleSelectRoom}
          />
        </div>
      </div>
    );
  }

  // 2. Monitoring dikunci untuk non-admin saat ujian besar (>200 peserta)
  if (monitoringLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center">
          <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight text-center">
          Monitoring Dikunci
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md font-semibold">
          Halaman monitoring dikunci selama ujian besar berlangsung (&gt;200 peserta) untuk menjaga performa server.
          Hanya admin yang dapat mengakses. Anda tetap dapat mengelola bank soal dan fungsi lainnya.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">

        {/* ═══════════════════════════════════════════════════════════════
            1. TOP HEADER BAR (Simplified, Clean & Responsive)
           ═══════════════════════════════════════════════════════════════ */}
        <NeonPageHeader
          bordered
          onBack={handleSwitchRoom}
          backTitle="Pilih Ruang Lain"
          title={isLoading ? <Skeleton className="h-6 w-44 inline-block" /> : (monitorRoom?.room_name || "Monitoring Ujian")}
          badge={
            !isLoading ? (
              <NeonBadge variant="emerald" pulse>
                LIVE
              </NeonBadge>
            ) : null
          }
          breadcrumbs={
            <>
              <button
                type="button"
                onClick={handleSwitchRoom}
                className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors shrink-0 cursor-pointer text-left"
              >
                Pilih Ruangan
              </button>
              <span>/</span>
              <span className="font-medium text-neutral-700 dark:text-neutral-300 shrink-0">
                {isLoading ? "..." : (monitorRoom?.subjectName || "Mapel")}
              </span>
              <span>•</span>
              <span className="truncate max-w-[280px] sm:max-w-[400px]">{roomClassLabel}</span>
            </>
          }
          actions={
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {/* 0. Ganti Ruang Button */}
            <button
              type="button"
              onClick={handleSwitchRoom}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer"
              title="Ganti Ruangan yang Dimonitor"
            >
              <GitBranch className="h-3.5 w-3.5 text-neutral-500" />
              <span>Ganti Ruang</span>
            </button>

            {/* 1. Penilaian Button (Direct Access) */}
            <button
              type="button"
              onClick={() => navigate(`/admin/penilaian?roomId=${roomId || ""}`)}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer"
              title="Buka Lembar Penilaian & Koreksi Nilai Ruangan"
            >
              <CheckSquare className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Penilaian</span>
            </button>

            {/* 2. Analisis Butir Button (Direct Access) */}
            <button
              type="button"
              onClick={() => navigate(`/admin/analisis-butir-soal?roomId=${roomId || ""}&examId=${monitorRoom?.examId || ""}`)}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer"
              title="Buka Analisis Butir Soal & Rekap Nilai Ruangan"
            >
              <BarChart2 className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span>Analisis Butir</span>
            </button>

            {/* 2. Laporan Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Laporan</span>
                  <ChevronDown className="h-3 w-3 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                  <Download className="h-3.5 w-3.5 mr-2 text-emerald-600" /> Rekap Nilai Excel (.xlsx)
                </DropdownMenuItem>
                {monitorQuestions.some((q: any) => q.type === "uraian") && (
                  <DropdownMenuItem onClick={handleExportEssayExcel} className="cursor-pointer">
                    <BookOpen className="h-3.5 w-3.5 mr-2 text-blue-600" /> Jawaban Essay Excel (.xlsx)
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate(`/admin/analisis-butir-soal?roomId=${roomId || ""}&examId=${monitorRoom?.examId || ""}`)} className="cursor-pointer">
                  <BarChart2 className="h-3.5 w-3.5 mr-2 text-purple-600" /> Analisis Butir Soal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/admin/penilaian?roomId=${roomId || ""}`)} className="cursor-pointer">
                  <CheckSquare className="h-3.5 w-3.5 mr-2 text-indigo-600" /> Lembar Penilaian & Rekap
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCopyBelumUjian} className="cursor-pointer">
                  <Copy className="h-3.5 w-3.5 mr-2 text-neutral-500" /> Salin Siswa Belum Ujian
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 2. Aksi Massal Dropdown */}
            {(role === "admin" || (role === "teacher" && teacherFullAccess)) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Aksi Massal</span>
                    <ChevronDown className="h-3 w-3 text-neutral-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleOpenReopenAllFinishedDialog} className="cursor-pointer">
                    <RotateCcw className="h-3.5 w-3.5 mr-2 text-emerald-600" /> Buka Semua Selesai
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleForceSubmitAll} className="cursor-pointer text-rose-600 focus:text-rose-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-rose-500 mr-2" /> Force Submit Semua
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleResetAllSessions} className="cursor-pointer text-rose-600 focus:text-rose-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-rose-500 mr-2" /> Reset Sesi Semua
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* 3. Interactive Sync Pill (Click to Refresh) */}
            <button
              type="button"
              onClick={() => handleTriggerManualRefresh()}
              disabled={isMonitorRefreshing}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-mono rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Klik untuk segarkan data sekarang"
            >
              <RefreshCw className={cn("h-3 w-3", isMonitorRefreshing ? "animate-spin text-emerald-500" : "text-emerald-500")} />
              <span className="font-sans font-medium text-neutral-500">Sync</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {isLoading ? "--" : `${monitorTimeLeft}s`}
              </span>
            </button>
          </div>
        }
      />

        {/* ═══════════════════════════════════════════════════════════════
            2. TWO-COLUMN GRID (Content + Inspector)
           ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_320px] gap-6 xl:gap-8 items-start">

          {/* ── LEFT COLUMN: Horizontal Tabs, Metric Cards, Formula, NeonTable ── */}
          <div className="min-w-0 space-y-6">

            {/* 2. Signature Neon Horizontal Tabs: Status Peserta */}
            <NeonTabs
              activeTab={statusTab}
              onChange={setStatusTab}
              tabs={[
                {
                  id: "all",
                  label: <span>Semua <span className="hidden 2xl:inline">Peserta</span></span>,
                  count: eligibleStudents.length,
                },
                {
                  id: "ongoing",
                  label: <span><span className="hidden 2xl:inline">Sedang </span>Mengerjakan</span>,
                  indicator: true,
                  count: dispOngoing,
                },
                {
                  id: "finished",
                  label: <span>Selesai<span className="hidden 2xl:inline"> Ujian</span></span>,
                  count: dispFinished,
                },
                {
                  id: "absent",
                  label: "Belum Mulai",
                  count: absentCount,
                },
                {
                  id: "locked",
                  label: <span><span className="hidden 2xl:inline">Sesi </span>Terkunci</span>,
                  count: lockedCount,
                },
              ]}
            />

            {/* 3. Stats Strip (4 Kartu Ringkas, Elegan, Neon Style) */}
            <NeonStatGrid cols={4}>
              <NeonStatCard
                label="Total Peserta"
                value={isLoading ? <Skeleton className="h-7 w-12 inline-block" /> : eligibleStudents.length}
                unit="siswa"
              />

              <NeonStatCard
                label="Sedang Mengerjakan"
                indicator={true}
                value={
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {isLoading ? <Skeleton className="h-7 w-8 inline-block" /> : dispOngoing}
                  </span>
                }
                unit="siswa"
              />

              <NeonStatCard
                label="Selesai Ujian"
                actionSlot={
                  absentList.length > 0 ? (
                    <span className="text-[10px] font-mono text-neutral-400">
                      {absentList.length} belum
                    </span>
                  ) : null
                }
                value={
                  isLoading ? <Skeleton className="h-7 w-16 inline-block" /> : (
                    <>
                      {dispFinished}{" "}
                      <span className="text-xs font-normal font-sans text-neutral-400">
                        / {eligibleStudents.length}
                      </span>
                    </>
                  )
                }
              />

              <NeonStatCard
                label="Sesi Terkunci"
                value={
                  <span className={lockedCount > 0 ? "text-rose-600 dark:text-rose-400" : ""}>
                    {isLoading ? <Skeleton className="h-7 w-8 inline-block" /> : lockedCount}
                  </span>
                }
                unit="siswa"
              />
            </NeonStatGrid>

            {/* 4. Formula Info (jika ada soal essay) */}
            {monitorQuestions.some((q: any) => q.type === "uraian") && (
              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    Rumus Penilaian: <code className="font-mono font-bold text-neutral-900 dark:text-neutral-100">(Objektif × 60%) + (Subjektif × 40%)</code>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
                  <span>Objektif: {monitorQuestions.filter((q: any) => q.type !== "uraian").length} soal</span>
                  <span>•</span>
                  <span>Uraian: {monitorQuestions.filter((q: any) => q.type === "uraian").length} soal</span>
                </div>
              </div>
            )}

            {/* 5. Main Neon Table Section */}
            <StudentTable
              students={students}
              attempts={attempts}
              monitorQuestions={monitorQuestions}
              monitorRoom={monitorRoom}
              terminology={terminology}
              selectedStudentIds={selectedStudentIds}
              setSelectedStudentIds={setSelectedStudentIds}
              monitorSortBy={monitorSortBy}
              setMonitorSortBy={setMonitorSortBy}
              monitorSortOrder={monitorSortOrder}
              setMonitorSortOrder={setMonitorSortOrder}
              toggleSort={toggleSort}
              monitorPage={monitorPage}
              setMonitorPage={setMonitorPage}
              monitorPageSize={monitorPageSize}
              setMonitorPageSize={setMonitorPageSize}
              monitorClassFilter={monitorClassFilter}
              setMonitorClassFilter={setMonitorClassFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
              expandedstudent={expandedstudent}
              setExpandedstudent={setExpandedstudent}
              setPreviewImage={setPreviewImage}
              getAttemptScore={getAttemptScore}
              getLiveScore={getLiveScore}
              handleForceSubmitStudent={handleForceSubmitStudent}
              handleOpenReopenDialog={handleOpenReopenDialog}
              handleUnlockStudent={handleUnlockStudent}
              handleResetSession={handleResetSession}
              handleResetCheatCount={handleResetCheatCount}
              handleManualGrade={handleManualGrade}
              handleClearOverride={handleClearOverride}
              handleAIGrade={handleAIGrade}
              setEditAnswerDialog={setEditAnswerDialog}
              detailAnswers={detailAnswers}
              answersList={answersList}
              isLoading={isLoading}
              examClasses={examClasses}
              roomId={roomId}
              isLargeRoom={isLargeRoom}
              pb={pb}
              setDetailAnswers={setDetailAnswers}
              role={role}
              teacherFullAccess={teacherFullAccess}
              aiGradingId={aiGradingId}
              handleExportExcel={handleExportExcel}
              handleExportEssayExcel={handleExportEssayExcel}
              handleCopyBelumUjian={handleCopyBelumUjian}
              waCopied={waCopied}
              setQuickGradeOpen={setQuickGradeOpen}
              handleOpenReopenAllFinishedDialog={handleOpenReopenAllFinishedDialog}
              handleForceSubmitAll={handleForceSubmitAll}
              handleResetAllSessions={handleResetAllSessions}
              handleOpenReopenSelectedDialog={handleOpenReopenSelectedDialog}
              inspectedStudentId={inspectedStudent?.id}
              setInspectedStudentId={setInspectedStudentId}
              statusTab={statusTab}
            />

          </div>

          {/* ═══════════════════════════════════════════════════════════════
              RIGHT SIDEBAR / INSPECTOR PANEL (Neon Style Parity with ExamRoomsPage)
             ═══════════════════════════════════════════════════════════════ */}
          <NeonInspector>

            {/* 1. Detail Peserta Terpilih (Inspector) */}
            <InspectorSection>
              <InspectorHeader
                title="Detail Peserta Ujian"
                icon={Users}
                badge={inspectedStudent ? "Terpilih" : "Ringkasan"}
              />

              {inspectedStudent ? (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Nama Siswa</div>
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5 truncate" title={inspectedStudent.name}>
                      {inspectedStudent.name}
                    </div>
                    <div className="text-[11px] font-mono text-neutral-400 mt-0.2">
                      NISN: {inspectedStudent.nisn || "-"} • {inspectedStudent.className}
                    </div>
                  </div>

                  {/* Status & Timer */}
                  <InspectorGrid cols={2}>
                    <div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Status Pengerjaan</div>
                      <div className="mt-0.5">
                        {inspectedAttempt?.status === "ongoing" ? (
                          <NeonBadge variant="emerald" pulse>Mengerjakan</NeonBadge>
                        ) : (inspectedAttempt?.status === "finished" || inspectedAttempt?.status === "submitted" || inspectedAttempt?.status === "graded") ? (
                          <NeonBadge variant="neutral">Selesai</NeonBadge>
                        ) : inspectedAttempt?.status === "LOCKED" ? (
                          <NeonBadge variant="danger">Terkunci</NeonBadge>
                        ) : (
                          <NeonBadge variant="neutral">Belum Mulai</NeonBadge>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Sisa Waktu</div>
                      <div className="mt-0.5">
                        {inspectedAttempt?.status === "ongoing" ? (
                          <StudentTimer attempt={inspectedAttempt} room={monitorRoom} />
                        ) : (
                          <span className="text-neutral-400 font-mono text-[11px]">--:--</span>
                        )}
                      </div>
                    </div>
                  </InspectorGrid>

                  {/* Progress Soal */}
                  {(() => {
                    const sisAns = (inspectedAttempt && detailAnswers[inspectedAttempt.id]) || inspectedAttempt?.answers || {};
                    const ansCount = Object.keys(sisAns).length > 0
                      ? Object.keys(sisAns).filter(k => k !== "__overrides__" && monitorQuestions.some((q: any) => q.id === k)).length
                      : (inspectedAttempt?.answeredCount ?? 0);
                    const totalQ = (monitorRoom?.max_questions && monitorRoom.max_questions > 0)
                      ? monitorRoom.max_questions
                      : (monitorQuestions.length || 1);
                    const pct = Math.min(100, Math.round((ansCount / totalQ) * 100));

                    return (
                      <div className="pt-1 border-t border-neutral-100 dark:border-neutral-800 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-500 dark:text-neutral-400">Progres Soal Dijawab</span>
                          <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                            {ansCount}/{totalQ} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Nilai & Pelanggaran */}
                  <InspectorGrid cols={2}>
                    <div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Total Nilai</div>
                      <div className="text-base font-mono font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                        {inspectedAttempt ? getAttemptScore(inspectedAttempt) : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Pelanggaran</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {(inspectedAttempt?.cheatCount || 0) > 0 ? (
                          <>
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <ShieldAlert className="h-3 w-3" />
                              <span>{inspectedAttempt.cheatCount}x</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleResetCheatCount(inspectedAttempt.id)}
                              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                            >
                              Reset
                            </button>
                          </>
                        ) : (
                          <span className="text-neutral-400 font-mono text-[11px]">0x (Aman)</span>
                        )}
                      </div>
                    </div>
                  </InspectorGrid>

                  {/* Quick Actions */}
                  <InspectorActions>
                    {inspectedAttempt ? (
                      <>
                        <InspectorButton
                          variant="primary"
                          icon={expandedstudent === inspectedStudent.id ? EyeOff : Eye}
                          onClick={() => {
                            const next = expandedstudent === inspectedStudent.id ? null : inspectedStudent.id;
                            setExpandedstudent(next);
                            if (next && inspectedAttempt && pb) {
                              pb.collection('attempts').getOne(inspectedAttempt.id).then((rec: any) => {
                                if (rec?.answers) setDetailAnswers((prev: any) => ({ ...prev, [inspectedAttempt.id]: rec.answers }));
                              }).catch(() => {});
                            }
                          }}
                        >
                          {expandedstudent === inspectedStudent.id ? "Tutup Lembar Jawaban" : "Buka Lembar Jawaban"}
                        </InspectorButton>

                        <InspectorButton
                          variant="secondary"
                          icon={FileText}
                          onClick={() => navigate(`/admin/penilaian/${inspectedStudent.id}?roomId=${roomId || ""}`)}
                        >
                          Buka Detail Penilaian Siswa
                        </InspectorButton>

                        {inspectedAttempt?.status === "LOCKED" && (
                          <InspectorButton
                            variant="success"
                            onClick={() => handleUnlockStudent(inspectedAttempt.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                          >
                            Buka Kunci Sesi Siswa
                          </InspectorButton>
                        )}

                        {inspectedAttempt?.status === "ongoing" && (
                          <InspectorButton
                            variant="danger"
                            onClick={() => handleForceSubmitStudent(inspectedAttempt.id)}
                          >
                            Paksa Selesaikan (Force Submit)
                          </InspectorButton>
                        )}

                        {(inspectedAttempt?.status === "finished" || inspectedAttempt?.status === "submitted" || inspectedAttempt?.status === "graded") && (
                          <InspectorButton
                            variant="success"
                            icon={RotateCcw}
                            onClick={() => handleOpenReopenDialog(inspectedAttempt, inspectedStudent.name)}
                          >
                            Buka Kembali (Jadikan Ongoing)
                          </InspectorButton>
                        )}

                        <InspectorButton
                          variant="ghost"
                          onClick={() => handleResetSession(inspectedAttempt.id, inspectedStudent.id)}
                          className="py-1 text-[11px] font-medium text-neutral-500 hover:text-rose-600"
                        >
                          Reset Sesi Pengerjaan
                        </InspectorButton>
                      </>
                    ) : (
                      <div className="p-2.5 rounded-md bg-neutral-100/60 dark:bg-neutral-850/60 border border-neutral-200/60 dark:border-neutral-800 text-center text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                        Peserta belum login / memulai ujian
                      </div>
                    )}
                  </InspectorActions>
                </div>
              ) : (
                <InspectorEmpty message="Pilih salah satu siswa pada tabel untuk melihat inspeksi live." />
              )}
            </InspectorSection>

            {/* 2. Parameter Ruang Ujian */}
            <InspectorSection divided>
              <InspectorHeader
                title="Parameter Ruang Ujian"
                icon={Lock}
              />

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Token Ruang</span>
                  <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                    {monitorRoom?.token || universalToken || "------"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Durasi Pengerjaan</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300 font-medium">
                    {monitorRoom?.duration || 90} Menit
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Mode Proteksi</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {(monitorRoom as any)?.is_exambro ? "Kiosk Exambro Wajib" : "Browser Bebas"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Batas Pelanggaran</span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {monitorRoom?.cheat_limit ? `${monitorRoom.cheat_limit}x (Auto Lock)` : "Tidak Terbatas"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Total Butir Soal</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">
                    {monitorQuestions.length} Soal
                  </span>
                </div>
              </div>
            </InspectorSection>

            {/* 3. Link Cepat Portal Siswa */}
            <InspectorCard
              title="Portal Akses Siswa"
              icon={ExternalLink}
              description="Bagikan link portal ini kepada peserta ujian yang terkendala login:"
            >
              <div className="flex items-center justify-between gap-2 p-1.5 bg-white dark:bg-neutral-850 rounded border border-neutral-200 dark:border-neutral-750 overflow-hidden">
                <code className="text-[11px] font-mono text-neutral-600 dark:text-neutral-300 truncate select-all">
                  {getStudentExamUrl(school?.slug)}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    const studentUrl = getStudentExamUrl(school?.slug);
                    navigator.clipboard.writeText(studentUrl);
                    setCopiedUniversalToken(true);
                    setTimeout(() => setCopiedUniversalToken(false), 2000);
                  }}
                  className="h-6 w-6 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
                  title="Salin Link Portal"
                >
                  {copiedUniversalToken ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </InspectorCard>

          </NeonInspector>

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

      {/* 🔄 Dialog Buka Kembali Ujian (Jadikan Ongoing) */}
      <ReopenDialog
        dialog={reopenDialog}
        setDialog={setReopenDialog}
        monitorRoom={monitorRoom}
        onConfirm={handleConfirmReopen}
        isProcessing={isReopening}
      />

      {/* ⚡ Dialog Quick Grade */}
      <QuickGradeDialog
        open={quickGradeOpen}
        onOpenChange={setQuickGradeOpen}
        pb={pb}
        students={students}
        attempts={attempts}
        monitorQuestions={monitorQuestions}
        monitorRoom={monitorRoom}
        setAttempts={setAttempts}
        showAlert={showAlert}
      />


      {/* ✏️ Dialog Edit Jawaban Siswa */}
      <EditAnswerDialog
        dialog={editAnswerDialog}
        setDialog={setEditAnswerDialog}
        onSave={handleEditAnswer}
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
