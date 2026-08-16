import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useTenant } from "../context/TenantContext";
import { useExamData } from "../context/ExamDataContext";
import PinGate from "../components/ui/PinGate";
import {
  Trophy,
  RefreshCw,
  Award,
  Users,
  Monitor,
  CheckCircle2,
  Lock,
  ChevronDown,
  ArrowLeft,
  Timer,
  Sun,
  Moon
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const LIVESCORE_VIEW_PIN = (() => {
  const now = new Date();
  const dd = now.getDate().toString().padStart(2, "0");
  return `${dd}0426`;
})();

export interface ExamRoomOption {
  id: string;
  room_name: string;
  examTitle: string;
  examId: string;
  classId: string[];
  allClasses: boolean;
  duration: number;
  end_time: string;
  isDisabled?: boolean;
}

const LiveScoreViewPage = () => {
  const navigate = useNavigate();
  const { pb, school } = useTenant();
  const { classes: examClasses, students, loading: dataLoading } = useExamData();

  // Pin Gate
  const [pinUnlocked, setPinUnlocked] = useState(() => sessionStorage.getItem("livescore_view_unlocked") === "1");

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("livescore_theme");
    return saved ? saved === "dark" : true;
  });

  // Selection states
  const [rooms, setRooms] = useState<ExamRoomOption[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [roomsLoading, setRoomsLoading] = useState(true);

  // Active room data
  const [attempts, setAttempts] = useState<any[]>([]);
  const [monitorQuestions, setMonitorQuestions] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Toggle theme handler
  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newValue = !prev;
      localStorage.setItem("livescore_theme", newValue ? "dark" : "light");
      return newValue;
    });
  };

  // Fetch Rooms list
  useEffect(() => {
    if (!pb) return;
    const fetchRooms = async () => {
      try {
        const loaded = await pb.collection("exam_rooms").getFullList({
          filter: 'status != "archive"',
          sort: "-created",
        });

        // Fetch related exams to get titles
        const exams = await pb.collection("exams").getFullList({ fields: "id,title" });
        const examMap = Object.fromEntries(exams.map((e: any) => [e.id, e.title]));

        const mapped: ExamRoomOption[] = loaded.map((r: any) => {
          const clsData = r.classId || r.classid || r.classIds || r.classids || "";
          let classList: string[] = [];
          if (Array.isArray(clsData)) {
            classList = clsData;
          } else if (typeof clsData === "string" && clsData.length > 0) {
            classList = clsData.split(",").map(id => id.trim()).filter(Boolean);
          }

          return {
            id: r.id,
            room_name: r.room_name || r.title || "Tanpa Nama",
            examTitle: examMap[r.examId] || "...",
            examId: r.examId,
            classId: classList,
            allClasses: r.allClasses || r.all_classes || false,
            duration: r.duration || 0,
            end_time: r.end_time || r.endTime || "",
            isDisabled: r.isDisabled || false,
          };
        });

        setRooms(mapped);
        if (mapped.length > 0) {
          setSelectedRoomId(mapped[0].id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setRoomsLoading(false);
      }
    };

    fetchRooms();
  }, [pb]);

  // Live Score Calculator
  const isFuzzyMatch = (studentAns: any, correctKey: string) => {
    if (typeof studentAns !== "string" || !correctKey) return false;
    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "");
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

  const getLiveScore = useCallback((sisAnswers: Record<string, any>, attOverrides: Record<string, boolean> = {}) => {
    if (!sisAnswers || monitorQuestions.length === 0) return 0;
    const overrides = Object.keys(attOverrides).length > 0 ? attOverrides : ((sisAnswers as any)?.__overrides__ || {});
    const studentOrder = (sisAnswers as any)?.__order__ || (sisAnswers as any)?.__meta?.questionOrder;
    const targetQuestions = Array.isArray(studentOrder) && studentOrder.length > 0
      ? monitorQuestions.filter((q: any) => studentOrder.includes(q.id))
      : monitorQuestions;

    let objectiveCorrect = 0;
    let objectiveTotal = 0;
    let essayCorrect = 0;
    let essayTotal = 0;

    targetQuestions.forEach((q: any) => {
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

    if (essayTotal === 0) {
      return objectiveTotal > 0 ? Math.round((objectiveCorrect / objectiveTotal) * 100) : 0;
    }

    const objScore = objectiveTotal > 0 ? (objectiveCorrect / objectiveTotal) * 100 : 0;
    const essScore = essayTotal > 0 ? (essayCorrect / essayTotal) * 100 : 0;
    return Math.round(objScore * 0.6 + essScore * 0.4);
  }, [monitorQuestions]);

  const getAttemptScore = useCallback((attempt: any) => {
    if (!attempt) return 0;
    const sisAnswers = attempt.answers || {};
    const overrides = attempt.overrides || (sisAnswers as any)?.__overrides__ || {};
    const liveScore = getLiveScore(sisAnswers, overrides);
    return attempt.status === "finished"
      ? (attempt.score === 0 && liveScore > 0 ? liveScore : (attempt.score ?? liveScore))
      : liveScore;
  }, [getLiveScore]);

  // Fetch data for selected room
  const handleRefreshData = useCallback(async (roomId: string) => {
    if (!pb || !roomId) return;
    setIsRefreshing(true);
    try {
      const activeRoom = rooms.find(r => r.id === roomId);
      if (activeRoom) {
        const qList = await pb.collection("questions").getFullList({
          filter: `examId = "${activeRoom.examId}"`,
          sort: "order,created",
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
          Array.from(new Map(mappedQuestions.map((q: any) => [q.id, q])).values())
        );
      }

      const loadedAttempts = await pb.collection("attempts").getFullList({
        filter: `examRoomId = "${roomId}"`,
      });
      setAttempts(loadedAttempts);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  }, [pb]);

  // Handle room switch
  useEffect(() => {
    if (selectedRoomId) {
      handleRefreshData(selectedRoomId);
    }
  }, [selectedRoomId, handleRefreshData]);

  // Real-time Subscriptions
  useEffect(() => {
    if (!pb || !selectedRoomId) return;

    let isSubscribed = true;
    let currentUnsub: (() => void) | null = null;

    const startSubscribe = async () => {
      try {
        const unsub = await pb.collection("attempts").subscribe("*", (e) => {
          if (!isSubscribed) return;
          const recRoomId = e.record.examRoomId || e.record.exam_room_id || "";
          if (recRoomId !== selectedRoomId) return;

          if (e.action === "create" || e.action === "update") {
            setAttempts(prev => {
              const idx = prev.findIndex(a => a.id === e.record.id);
              if (idx > -1) {
                const newArr = [...prev];
                newArr[idx] = { ...newArr[idx], ...e.record };
                return newArr;
              }
              return [e.record, ...prev];
            });
          } else if (e.action === "delete") {
            setAttempts(prev => prev.filter(a => a.id !== e.record.id));
          }
        });

        if (!isSubscribed) {
          unsub();
        } else {
          currentUnsub = () => { unsub(); };
        }
      } catch (err) { }
    };

    startSubscribe();
    const polling = setInterval(() => {
      handleRefreshData(selectedRoomId);
    }, 45000);

    return () => {
      isSubscribed = false;
      clearInterval(polling);
      if (currentUnsub) currentUnsub();
    };
  }, [pb, selectedRoomId, handleRefreshData]);

  const activeRoom = useMemo(() => rooms.find(r => r.id === selectedRoomId), [rooms, selectedRoomId]);

  // Filter & Rank eligible students
  const rankedStudents = useMemo(() => {
    if (!activeRoom || dataLoading) return [];

    const eligibleStudents = students.filter(s => {
      if (activeRoom.allClasses) return true;
      return activeRoom.classId.includes(s.classId);
    });

    const mapped = eligibleStudents.map(s => {
      const attempt = attempts.find(a => (a.studentId || a.student_id) === s.id);
      const score = attempt ? getAttemptScore(attempt) : 0;
      const className = examClasses.find(c => c.id === s.classId)?.name || "-";

      const sisAnswers = attempt?.answers || {};
      const answeredCount = Object.keys(sisAnswers).filter(k =>
        k !== "__overrides__" &&
        monitorQuestions.some((q: any) => q.id === k)
      ).length;

      return {
        id: s.id,
        name: s.name,
        nisn: s.nisn,
        className,
        attempt,
        answeredCount,
        score,
      };
    });

    // Sort: score desc, name asc
    return mapped.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    });
  }, [activeRoom, students, attempts, examClasses, dataLoading, getAttemptScore, monitorQuestions]);

  // Auto Scroll state
  const [autoScroll, setAutoScroll] = useState(false);

  // Ref for table container to apply auto-scroll
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Auto Scroll logic (table only) - Loop mode: scroll to bottom, jump to top, repeat
  useEffect(() => {
    if (!autoScroll) return;
    const container = tableContainerRef.current;
    if (!container) return;

    let scrollInterval: NodeJS.Timeout;

    const scrollStep = () => {
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const currentScroll = container.scrollTop;
      const maxScroll = scrollHeight - clientHeight;

      // Check if reached the actual bottom
      if (currentScroll >= maxScroll - 2) {
        // Reached bottom - pause, then jump to top
        clearInterval(scrollInterval);
        setTimeout(() => {
          if (!autoScroll) return;
          // Jump to top instantly
          container.scrollTop = 0;
          // Pause at top, then start scrolling again
          setTimeout(() => {
            if (autoScroll) scrollInterval = setInterval(scrollStep, 40);
          }, 2000);
        }, 3000);
      } else {
        // Continue scrolling down smoothly
        container.scrollBy(0, 1);
      }
    };

    // Initial delay before starting
    const delayStart = setTimeout(() => {
      scrollInterval = setInterval(scrollStep, 40);
    }, 2000);

    return () => {
      clearTimeout(delayStart);
      clearInterval(scrollInterval);
    };
  }, [autoScroll, rankedStudents.length]);

  // Statistics
  const stats = useMemo(() => {
    const total = rankedStudents.length;
    const ongoing = rankedStudents.filter(s => s.attempt?.status === "ongoing").length;
    const finished = rankedStudents.filter(s => s.attempt?.status === "finished").length;
    const locked = rankedStudents.filter(s => s.attempt?.status === "LOCKED").length;

    const scores = rankedStudents.filter(s => s.attempt).map(s => s.score);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    return { total, ongoing, finished, locked, avgScore };
  }, [rankedStudents]);

  if (!pinUnlocked) {
    return (
      <PinGate
        correctPin={LIVESCORE_VIEW_PIN}
        onUnlocked={() => {
          sessionStorage.setItem("livescore_view_unlocked", "1");
          setPinUnlocked(true);
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen select-none overflow-x-hidden relative flex flex-col font-sans transition-colors duration-300 ${isDarkMode ? "bg-slate-950 text-slate-100" : "bg-gray-50 text-gray-900"
      }`}>
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-3xl ${isDarkMode ? "bg-indigo-500/5 animate-pulse" : "bg-indigo-500/10"
          }`} />
        <div className={`absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full blur-3xl ${isDarkMode ? "bg-blue-500/5" : "bg-blue-500/10"
          }`} />
      </div>

      {/* Header Bar */}
      <header className={`relative z-10 border-b backdrop-blur-xl px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all ${isDarkMode ? "border-slate-800/50 bg-slate-950/90" : "border-gray-200/80 bg-white/95 shadow-sm"
        }`}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin/monitoring")}
            className={`group p-2.5 rounded-xl border transition-all hover:scale-105 active:scale-95 ${isDarkMode ? "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700" : "bg-white border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 shadow-sm"
              }`}
            title="Kembali ke Monitoring Admin"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className={`text-[10px] font-black tracking-widest uppercase ${isDarkMode ? "text-indigo-400" : "text-indigo-600"
                }`}>
                {school?.name || "CBT EXAM"}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider animate-pulse ${isDarkMode ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-red-50 text-red-600 border border-red-200"
                }`}>
                ● LIVE
              </span>
            </div>
            <h1 className={`text-xl font-black tracking-tight ${isDarkMode ? "text-white" : "text-gray-900"
              }`}>
              Live Papan Skor & Progres Ujian
            </h1>
          </div>
        </div>

        {/* Room selector & actions */}
        <div className="flex items-center gap-3">
          {roomsLoading ? (
            <div className={`w-64 h-11 rounded-xl animate-pulse ${isDarkMode ? "bg-slate-900/50" : "bg-gray-100"
              }`} />
          ) : (
            <div className="relative">
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className={`w-64 border rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer pr-10 transition-all ${isDarkMode ? "bg-slate-900/80 border-slate-800 text-slate-100 hover:border-slate-700" : "bg-white border-gray-200 text-gray-900 hover:border-gray-300 shadow-sm"
                  }`}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_name} ({r.examTitle})
                  </option>
                ))}
              </select>
              <ChevronDown className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${isDarkMode ? "text-slate-500" : "text-gray-400"
                }`} />
            </div>
          )}

          <button
            onClick={() => selectedRoomId && handleRefreshData(selectedRoomId)}
            disabled={isRefreshing}
            className={`group p-2.5 rounded-xl border transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 ${isDarkMode ? "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700" : "bg-white border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 shadow-sm"
              }`}
            title="Segarkan data"
          >
            <RefreshCw className={`w-4.5 h-4.5 transition-all ${isRefreshing ? "animate-spin" : "group-hover:rotate-90"}`} />
          </button>

          <button
            onClick={() => setAutoScroll(prev => !prev)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm ${autoScroll
              ? "bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/25"
              : isDarkMode
                ? "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                : "bg-white border-gray-200 text-gray-700 hover:text-gray-900 hover:border-gray-300"
              }`}
            title="Gulir otomatis layar untuk tampilan TV/Proyektor"
          >
            <Timer className="w-4 h-4" />
            <span className="hidden sm:inline">Auto Scroll</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${autoScroll
              ? "bg-white/20"
              : isDarkMode ? "bg-slate-800" : "bg-gray-100"
              }`}>
              {autoScroll ? "ON" : "OFF"}
            </span>
          </button>

          <button
            onClick={toggleTheme}
            className={`group p-2.5 rounded-xl border transition-all hover:scale-105 active:scale-95 ${isDarkMode ? "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-amber-400 hover:border-slate-700" : "bg-white border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-gray-300 shadow-sm"
              }`}
            title={isDarkMode ? "Ganti ke Light Mode" : "Ganti ke Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-4.5 h-4.5 transition-transform group-hover:rotate-45" /> : <Moon className="w-4.5 h-4.5 transition-transform group-hover:-rotate-12" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 p-6 flex flex-col gap-6 max-w-7xl w-full mx-auto">
        {selectedRoomId ? (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className={`border rounded-2xl p-5 flex flex-col justify-center transition-all hover:scale-[1.02] ${isDarkMode ? "bg-slate-900/60 border-slate-800/50 hover:border-slate-700 shadow-lg shadow-slate-950/50" : "bg-white border-gray-200 hover:border-gray-300 shadow-lg shadow-gray-200/50"
                }`}>
                <span className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? "text-slate-500" : "text-gray-500"
                  }`}>Siswa Terdaftar</span>
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${isDarkMode ? "bg-indigo-500/10" : "bg-indigo-50"
                    }`}>
                    <Users className="w-4 h-4 text-indigo-500" />
                  </div>
                  <span className={`text-2xl font-black ${isDarkMode ? "text-white" : "text-gray-900"
                    }`}>{stats.total}</span>
                </div>
              </div>
              <div className={`border rounded-2xl p-5 flex flex-col justify-center transition-all hover:scale-[1.02] ${isDarkMode ? "bg-slate-900/60 border-slate-800/50 hover:border-slate-700 shadow-lg shadow-slate-950/50" : "bg-white border-gray-200 hover:border-gray-300 shadow-lg shadow-gray-200/50"
                }`}>
                <span className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? "text-slate-500" : "text-gray-500"
                  }`}>Sedang Mengerjakan</span>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Monitor className="w-4 h-4 text-blue-500 animate-pulse" />
                  </div>
                  <span className="text-2xl font-black text-blue-500">{stats.ongoing}</span>
                </div>
              </div>
              <div className={`border rounded-2xl p-5 flex flex-col justify-center transition-all hover:scale-[1.02] ${isDarkMode ? "bg-slate-900/60 border-slate-800/50 hover:border-slate-700 shadow-lg shadow-slate-950/50" : "bg-white border-gray-200 hover:border-gray-300 shadow-lg shadow-gray-200/50"
                }`}>
                <span className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? "text-slate-500" : "text-gray-500"
                  }`}>Selesai Ujian</span>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-2xl font-black text-emerald-500">{stats.finished}</span>
                </div>
              </div>
              <div className={`border rounded-2xl p-5 flex flex-col justify-center transition-all hover:scale-[1.02] ${isDarkMode ? "bg-slate-900/60 border-slate-800/50 hover:border-slate-700 shadow-lg shadow-slate-950/50" : "bg-white border-gray-200 hover:border-gray-300 shadow-lg shadow-gray-200/50"
                }`}>
                <span className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? "text-slate-500" : "text-gray-500"
                  }`}>Sesi Terkunci</span>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-rose-500/10">
                    <Lock className="w-4 h-4 text-rose-500" />
                  </div>
                  <span className="text-2xl font-black text-rose-500">{stats.locked}</span>
                </div>
              </div>
              <div className={`border rounded-2xl p-5 flex flex-col justify-center col-span-2 md:col-span-1 transition-all hover:scale-[1.02] ${isDarkMode ? "bg-slate-900/60 border-slate-800/50 hover:border-slate-700 shadow-lg shadow-slate-950/50" : "bg-white border-gray-200 hover:border-gray-300 shadow-lg shadow-gray-200/50"
                }`}>
                <span className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? "text-slate-500" : "text-gray-500"
                  }`}>Rata-rata Nilai</span>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Trophy className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-2xl font-black text-amber-500">{stats.avgScore}</span>
                </div>
              </div>
            </div>

            {/* Podium (Top 3) */}
            {rankedStudents.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 2nd Place */}
                {rankedStudents[1] && (
                  <div className={`border rounded-3xl p-6 flex items-center justify-between shadow-xl relative overflow-hidden group transition-all hover:scale-[1.02] ${isDarkMode ? "bg-gradient-to-br from-slate-900/80 to-slate-950 border-slate-800/50 hover:border-slate-700" : "bg-gradient-to-br from-gray-50 to-white border-gray-200 hover:border-gray-300 shadow-gray-200/50"
                    }`}>
                    <div className={`absolute right-0 top-0 w-32 h-32 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-all ${isDarkMode ? "bg-slate-700/20" : "bg-gray-300/30"
                      }`} />
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 font-black text-xl shadow-lg transition-all group-hover:scale-110 ${isDarkMode ? "bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 text-slate-300" : "bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300 text-gray-600"
                        }`}>
                        2
                      </div>
                      <div>
                        <h3 className={`font-bold text-base truncate max-w-[180px] ${isDarkMode ? "text-slate-100" : "text-gray-900"
                          }`}>{rankedStudents[1].name}</h3>
                        <p className={`text-[10px] font-semibold mt-0.5 ${isDarkMode ? "text-slate-500" : "text-gray-500"
                          }`}>{rankedStudents[1].className} • {rankedStudents[1].answeredCount}/{monitorQuestions.length} Soal</p>
                      </div>
                    </div>
                    <div className="text-right relative z-10">
                      <span className={`text-3xl font-black ${isDarkMode ? "text-slate-200" : "text-gray-700"
                        }`}>{rankedStudents[1].score}</span>
                      <p className={`text-[8px] font-bold tracking-widest uppercase mt-1 ${isDarkMode ? "text-slate-500" : "text-gray-400"
                        }`}>Live Score</p>
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {rankedStudents[0] && (
                  <div className={`border rounded-3xl p-6 flex items-center justify-between shadow-2xl relative overflow-hidden group transition-all hover:scale-[1.03] ${isDarkMode ? "bg-gradient-to-br from-indigo-950/60 to-slate-950 border-indigo-500/30 hover:border-indigo-500/50" : "bg-gradient-to-br from-indigo-50 to-white border-indigo-200 hover:border-indigo-300 shadow-indigo-200/50"
                    }`}>
                    <div className={`absolute right-0 top-0 w-40 h-40 rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition-all ${isDarkMode ? "bg-indigo-500/20" : "bg-indigo-400/30"
                      }`} />
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center border-2 border-amber-300 shadow-xl shadow-amber-500/50 transition-all group-hover:scale-110 group-hover:rotate-6">
                        <Award className="w-7 h-7 text-white animate-bounce" />
                      </div>
                      <div>
                        <h3 className={`font-black text-lg truncate max-w-[180px] ${isDarkMode ? "text-indigo-100" : "text-indigo-900"
                          }`}>{rankedStudents[0].name}</h3>
                        <p className={`text-[10px] font-semibold mt-0.5 ${isDarkMode ? "text-indigo-400" : "text-indigo-600"
                          }`}>{rankedStudents[0].className} • {rankedStudents[0].answeredCount}/{monitorQuestions.length} Soal</p>
                      </div>
                    </div>
                    <div className="text-right relative z-10">
                      <span className="text-4xl font-black text-amber-500">{rankedStudents[0].score}</span>
                      <p className="text-[8px] font-bold text-amber-500/60 tracking-widest uppercase mt-1">Live Score</p>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {rankedStudents[2] && (
                  <div className={`border rounded-3xl p-6 flex items-center justify-between shadow-xl relative overflow-hidden group transition-all hover:scale-[1.02] ${isDarkMode ? "bg-gradient-to-br from-slate-900/80 to-slate-950 border-slate-800/50 hover:border-slate-700" : "bg-gradient-to-br from-gray-50 to-white border-gray-200 hover:border-gray-300 shadow-gray-200/50"
                    }`}>
                    <div className={`absolute right-0 top-0 w-32 h-32 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-all ${isDarkMode ? "bg-amber-700/10" : "bg-amber-200/30"
                      }`} />
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 font-black text-xl shadow-lg transition-all group-hover:scale-110 ${isDarkMode ? "bg-gradient-to-br from-amber-900/40 to-slate-900 border-amber-800/50 text-amber-700" : "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 text-amber-700"
                        }`}>
                        3
                      </div>
                      <div>
                        <h3 className={`font-bold text-base truncate max-w-[180px] ${isDarkMode ? "text-slate-100" : "text-gray-900"
                          }`}>{rankedStudents[2].name}</h3>
                        <p className={`text-[10px] font-semibold mt-0.5 ${isDarkMode ? "text-slate-500" : "text-gray-500"
                          }`}>{rankedStudents[2].className} • {rankedStudents[2].answeredCount}/{monitorQuestions.length} Soal</p>
                      </div>
                    </div>
                    <div className="text-right relative z-10">
                      <span className="text-3xl font-black text-amber-600">{rankedStudents[2].score}</span>
                      <p className={`text-[8px] font-bold tracking-widest uppercase mt-1 ${isDarkMode ? "text-slate-500" : "text-gray-400"
                        }`}>Live Score</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Leaderboard Table */}
            <div className={`border rounded-3xl overflow-hidden shadow-2xl flex-1 flex flex-col transition-all ${isDarkMode ? "bg-slate-900/30 border-slate-800/50" : "bg-white border-gray-200 shadow-gray-200/50"
              }`}>
              <div className="overflow-x-auto overflow-y-auto min-h-[400px] max-h-[calc(100vh-400px)]" ref={tableContainerRef}>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className={`border-b text-[10px] font-black uppercase tracking-widest transition-colors sticky top-0 z-10 ${isDarkMode ? "border-slate-800/50 bg-slate-950/95 backdrop-blur-sm text-slate-400" : "border-gray-200 bg-white/95 backdrop-blur-sm text-gray-600"
                      }`}>
                      <th className="py-5 px-6 text-center w-20">Rank</th>
                      <th className="py-5 px-6">Siswa</th>
                      <th className="py-5 px-6 text-center w-36">Kelas</th>
                      <th className="py-5 px-6 text-center w-40">Status</th>
                      <th className="py-5 px-6 text-center w-36">Progres</th>
                      <th className="py-5 px-6 text-center w-32">Nilai</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y transition-colors ${isDarkMode ? "divide-slate-800/30" : "divide-gray-100"
                    }`}>
                    {rankedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Users className={`w-12 h-12 ${isDarkMode ? "text-slate-700" : "text-gray-300"
                              }`} />
                            <div>
                              <p className={`font-bold text-sm mb-1 ${isDarkMode ? "text-slate-400" : "text-gray-600"
                                }`}>
                                Tidak ada siswa untuk ditampilkan
                              </p>
                              <p className={`text-xs ${isDarkMode ? "text-slate-600" : "text-gray-500"
                                }`}>
                                Pastikan ruang ujian memiliki siswa yang terdaftar
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : rankedStudents.map((s, idx) => {
                      const isTop3 = idx < 3;
                      const status = s.attempt?.status || "offline";
                      const cheatCount = s.attempt?.cheatCount || 0;

                      return (
                        <tr
                          key={s.id}
                          className={`transition-all h-16 group ${isDarkMode
                            ? `hover:bg-slate-900/40 ${isTop3 ? "bg-indigo-500/[0.02]" : ""}`
                            : `hover:bg-gray-50 ${isTop3 ? "bg-indigo-50/40" : ""}`
                            }`}
                        >
                          <td className="py-4 px-6 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-sm font-black font-mono transition-all group-hover:scale-110 ${idx === 0
                                ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30"
                                : idx === 1
                                  ? isDarkMode ? "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900 shadow-lg" : "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-900 shadow-lg"
                                  : idx === 2
                                    ? "bg-gradient-to-br from-amber-700 to-amber-800 text-white shadow-lg shadow-amber-700/30"
                                    : isDarkMode
                                      ? "bg-slate-900/60 text-slate-400 border border-slate-800"
                                      : "bg-gray-100 text-gray-600 border border-gray-200"
                                }`}
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className={`font-bold text-sm ${isDarkMode ? "text-slate-100" : "text-gray-900"
                              }`}>{s.name}</div>
                            <div className={`text-[10px] font-mono mt-1 ${isDarkMode ? "text-slate-500" : "text-gray-500"
                              }`}>{s.nisn}</div>
                          </td>
                          <td className={`py-4 px-6 text-center text-sm font-semibold ${isDarkMode ? "text-slate-300" : "text-gray-700"
                            }`}>
                            {s.className}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              <span
                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm transition-all ${status === "finished"
                                  ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                                  : status === "LOCKED"
                                    ? "bg-red-500/15 text-red-500 border border-red-500/30"
                                    : status === "ongoing"
                                      ? "bg-blue-500/15 text-blue-500 border border-blue-500/30 animate-pulse"
                                      : isDarkMode
                                        ? "bg-slate-900/60 text-slate-500 border border-slate-800"
                                        : "bg-gray-100 text-gray-500 border border-gray-200"
                                  }`}
                              >
                                {status === "offline" ? "Belum Mulai" : status}
                              </span>
                              {cheatCount > 0 && (
                                <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest leading-none">
                                  ⚠ {cheatCount}x
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <span className={`text-xs font-mono font-bold ${isDarkMode ? "text-slate-300" : "text-gray-700"
                                }`}>
                                {s.answeredCount} <span className={isDarkMode ? "text-slate-600" : "text-gray-400"}>/ {monitorQuestions.length}</span>
                              </span>
                              <div className={`w-28 h-2 rounded-full overflow-hidden shadow-inner transition-all ${isDarkMode ? "bg-slate-900/60 border border-slate-800" : "bg-gray-100 border border-gray-200"
                                }`}>
                                <div
                                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
                                  style={{
                                    width: `${monitorQuestions.length > 0
                                      ? (s.answeredCount / monitorQuestions.length) * 100
                                      : 0
                                      }%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span
                              className={`text-xl font-black transition-all ${status === "finished"
                                ? "text-emerald-500"
                                : status === "ongoing"
                                  ? "text-blue-500"
                                  : isDarkMode
                                    ? "text-slate-600"
                                    : "text-gray-400"
                                }`}
                            >
                              {s.score}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className={`flex-1 flex flex-col items-center justify-center text-center p-12 border border-dashed rounded-3xl transition-colors ${isDarkMode ? "border-slate-900 bg-slate-950/40" : "border-gray-300 bg-gray-50/40"
            }`}>
            <Trophy className={`w-12 h-12 mb-3 ${isDarkMode ? "text-slate-800" : "text-gray-300"
              }`} />
            <p className={`font-bold uppercase tracking-wider text-sm ${isDarkMode ? "text-slate-600" : "text-gray-400"
              }`}>
              Tidak ada ruang ujian aktif saat ini
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default LiveScoreViewPage;
