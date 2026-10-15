import { getOnlineFlag } from "../../lib/network";
import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { Sparkles, RotateCcw, Copy, Check, Pencil, Trophy, ClipboardPaste, Zap, BarChart2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";
import { cn } from "../../lib/utils";
import { useTenant } from "../../context/TenantContext";
import { useExamData } from "../../context/ExamDataContext";
import { useAuth } from "../../context/AuthContext";
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
            benar_salah: "benar_salah"
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
            statements: (mappedType === "benar_salah" && Array.isArray(rawOptions.statements))
              ? rawOptions.statements
              : (Array.isArray(rawOptions) ? rawOptions : (q.statements || undefined)),
            pairs: mappedType === "menjodohkan" ? rawOptions.pairs : undefined,
            items: (mappedType === "urutkan" || mappedType === "drag_drop") ? rawOptions.items : undefined,
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
  }, [roomId, monitorRoom, monitorQuestions.length, pb, subjects, masterTeachers]);

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

  // Monitoring dikunci untuk non-admin saat ujian besar (>200 peserta)
  if (monitoringLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center">
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

          <div className="flex items-center gap-2.5 self-stretch sm:self-end md:self-center">
            <div className="flex items-center justify-between sm:justify-start gap-3 bg-slate-50 dark:bg-slate-900/60 pl-3.5 pr-1.5 py-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 w-full sm:w-auto">
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    Auto-Sync
                  </span>
                  <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                    {isLoading ? "--" : `${monitorTimeLeft}s`}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none mt-1">
                  {lastSyncTime ? `Diperbarui ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : "Menghubungkan..."}
                </span>
              </div>

              <Button
                onClick={() => handleTriggerManualRefresh()}
                disabled={isMonitorRefreshing}
                size="sm"
                variant="ghost"
                title="Segarkan data pengerjaan, skor, dan status siswa sekarang"
                aria-label="Segarkan data monitoring"
                className={`h-8 px-2.5 rounded-xl font-medium text-xs transition-all flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 shadow-xs ${
                  isMonitorRefreshing
                    ? "text-blue-600 dark:text-blue-400 cursor-not-allowed"
                    : "text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-700"
                }`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isMonitorRefreshing ? "animate-spin text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"}`} />
                <span>{isMonitorRefreshing ? "Memuat..." : "Segarkan"}</span>
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
          <div className="bg-card p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-6 h-fit sticky top-6">
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

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 space-y-4">
                {/* 📊 Kelompok: Navigasi & Live */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Link & Analisis</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { sessionStorage.setItem("activeGradingRoomId", roomId || ""); navigate("/admin/penilaian"); }}
                      className="w-full rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 dark:border-indigo-800/40 text-indigo-700 font-bold text-[10px] py-2 px-1 shadow-sm transition-all flex items-center justify-center gap-1 whitespace-nowrap tracking-tight"
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-indigo-500" /> Penilaian
                    </button>
                    <button
                      onClick={() => navigate("/livescore-view")}
                      className="w-full rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 dark:border-indigo-800/40 text-indigo-700 font-bold text-[10px] py-2 px-1 shadow-sm transition-all flex items-center justify-center gap-1 whitespace-nowrap tracking-tight"
                    >
                      <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" /> Live Score
                    </button>
                    <button
                      onClick={() => navigate(`/admin/analisis-butir-soal?roomId=${roomId || ""}&examId=${monitorRoom?.examId || ""}`)}
                      className="w-full col-span-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 dark:border-blue-800/40 text-blue-700 font-bold text-[10px] py-2 px-2 shadow-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap tracking-tight"
                    >
                      <BarChart2 className="h-3.5 w-3.5 text-blue-600 shrink-0" /> Analisis Butir Soal (Item Analysis)
                    </button>
                  </div>
                </div>

                {/* 📥 Kelompok: Export Laporan */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Unduh Laporan</span>
                  {monitorQuestions.some((q: any) => q.type === "uraian") ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleExportExcel}
                        className="w-full rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 dark:border-emerald-800/40 text-emerald-700 font-bold text-[10px] py-2 px-1 shadow-sm transition-all flex items-center justify-center gap-1 whitespace-nowrap tracking-tight"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Excel
                      </button>
                      <button
                        onClick={handleExportEssayExcel}
                        className="w-full rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-100 dark:bg-teal-900/20 dark:text-teal-400 dark:hover:bg-teal-900/40 dark:border-teal-800/40 text-teal-700 font-bold text-[10px] py-2 px-1 shadow-sm transition-all flex items-center justify-center gap-1 whitespace-nowrap tracking-tight"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600 shrink-0" /> Essay
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleExportExcel}
                      className="w-full rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 dark:border-emerald-800/40 text-emerald-700 font-bold text-[10px] py-2 px-1.5 shadow-sm transition-all flex items-center justify-center gap-1 whitespace-nowrap tracking-tight"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Export Excel
                    </button>
                  )}
                </div>

                {/* 📝 Kelompok: Grading & Data */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Penilaian & Siswa</span>
                  {(role === "admin" || (role === "teacher" && teacherFullAccess)) && monitorQuestions.some((q: any) => q.type === "uraian") ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { setQuickGradeOpen(true); }}
                        className="w-full rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-100 dark:bg-violet-900/20 dark:text-violet-400 dark:hover:bg-violet-900/40 dark:border-violet-800/40 text-violet-700 font-bold text-[10px] py-2 px-1 shadow-sm transition-all flex items-center justify-center gap-1 whitespace-nowrap tracking-tight"
                      >
                        <Zap className="h-3.5 w-3.5 text-violet-500 shrink-0" /> Quick Grade
                      </button>
                      <button
                        onClick={handleCopyBelumUjian}
                        className={`w-full rounded-xl border font-bold text-[10px] py-2 px-1 shadow-sm transition-all flex items-center justify-center gap-1 whitespace-nowrap tracking-tight ${waCopied
                          ? "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400"
                          : "bg-amber-50 hover:bg-amber-100 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 dark:border-amber-800/40 text-amber-700"
                          }`}
                      >
                        {waCopied ? <><Check className="h-3.5 w-3.5 shrink-0" /> Tersalin</> : <><Copy className="h-3.5 w-3.5 shrink-0" /> Belum Ujian</>}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleCopyBelumUjian}
                      className={`w-full rounded-xl border font-bold text-[10px] py-2 px-2 shadow-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap tracking-tight ${waCopied
                        ? "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400"
                        : "bg-amber-50 hover:bg-amber-100 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 dark:border-amber-800/40 text-amber-700"
                        }`}
                    >
                      {waCopied ? <><Check className="h-3.5 w-3.5 shrink-0" /> Tersalin!</> : <><Copy className="h-3.5 w-3.5 shrink-0" /> Salin Siswa Belum Ujian</>}
                    </button>
                  )}
                </div>

                {/* ⚠ Kelompok: Tindakan Massal (Admin/Full Teacher Only) */}
                {(role === "admin" || (role === "teacher" && teacherFullAccess)) && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-rose-500/80 dark:text-rose-400/80 uppercase tracking-widest pl-1">Zona Bahaya (Aksi Massal)</span>
                    <button
                      onClick={handleOpenReopenAllFinishedDialog}
                      disabled={attempts.filter(a => a.status === "finished").length === 0}
                      className="w-full rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/40 font-bold text-[10px] py-2.5 px-2 shadow-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap tracking-tight disabled:opacity-40 disabled:cursor-not-allowed mb-2"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      Buka Semua yang Selesai ({attempts.filter(a => a.status === "finished").length})
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleForceSubmitAll}
                        className="w-full rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/30 font-bold text-[10px] py-2.5 px-1 shadow-sm transition-all flex items-center justify-center gap-1 whitespace-nowrap tracking-tight"
                      >
                        <Users className="h-3.5 w-3.5 text-rose-500 shrink-0" /> Selesai Semua
                      </button>
                      <button
                        onClick={handleResetAllSessions}
                        className="w-full rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-850/30 font-bold text-[10px] py-2.5 px-1 shadow-sm transition-all flex items-center justify-center gap-1 whitespace-nowrap tracking-tight"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-orange-500 shrink-0" /> Reset Sesi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {/* Formula Info (jika ada soal essay) */}
          {monitorQuestions.some((q: any) => q.type === "uraian") && (
            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800/40 rounded-2xl p-4 flex items-center gap-4 text-xs">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-black text-indigo-700 dark:text-indigo-300 text-[10px] uppercase tracking-widest mb-1">Rumus Penilaian (Bobot 60:40)</p>
                <p className="text-indigo-600/80 dark:text-indigo-400/80 font-medium leading-relaxed">
                  <span className="font-bold">Nilai Final</span> = (Skor Objektif × <span className="font-black">60%</span>) + (Skor Subjektif × <span className="font-black">40%</span>)
                  <span className="mx-2 text-indigo-300">•</span>
                  <span className="text-blue-600 dark:text-blue-400">O:{monitorQuestions.filter((q: any) => q.type !== "uraian").length} soal</span>
                  <span className="mx-1 text-indigo-300">|</span>
                  <span className="text-purple-600 dark:text-purple-400">S:{monitorQuestions.filter((q: any) => q.type === "uraian").length} soal</span>
                </p>
              </div>
            </div>
          )}

          <div className="bg-card rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden min-h-[500px]">
            <div className="overflow-x-auto">
              <StudentTable
                students={students}
                attempts={attempts}
                monitorQuestions={monitorQuestions}
                monitorRoom={monitorRoom}
                terminology={terminology}
                selectedStudentIds={selectedStudentIds}
                setSelectedStudentIds={setSelectedStudentIds}
                monitorSortBy={monitorSortBy}
                monitorSortOrder={monitorSortOrder}
                toggleSort={toggleSort}
                monitorPage={monitorPage}
                monitorPageSize={monitorPageSize}
                monitorClassFilter={monitorClassFilter}
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
                searchQuery={searchQuery}
                roomId={roomId}
                isLargeRoom={isLargeRoom}
                pb={pb}
                setDetailAnswers={setDetailAnswers}
                role={role}
                teacherFullAccess={teacherFullAccess}
                aiGradingId={aiGradingId}
              />
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

      {/* 📋 Floating Batch Action Bar */}
      {selectedStudentIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white dark:bg-slate-800 px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3.5 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <span className="text-xs font-black tracking-wide text-slate-200 whitespace-nowrap">
            <span className="text-indigo-400 font-black mr-1">{selectedStudentIds.length}</span> Siswa Dipilih
          </span>
          <div className="h-4 w-px bg-slate-700" />
          <button
            onClick={handleOpenReopenSelectedDialog}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-indigo-900/50 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Buka Kembali (Ongoing)
          </button>
          <button
            onClick={() => setSelectedStudentIds([])}
            className="text-xs font-semibold text-slate-400 hover:text-white px-2 py-1 transition-colors whitespace-nowrap"
          >
            Batal
          </button>
        </div>
      )}

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
