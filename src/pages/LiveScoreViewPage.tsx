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
  max_questions?: number;
}

const LiveScoreViewPage = () => {
  const navigate = useNavigate();
  const { pb, school } = useTenant();
  const { classes: examClasses, students } = useExamData();

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

  // Leaderboard dari backend (/api/leaderboard): skor + ranking dihitung di
  // server (SQL), paginasi server-side. Frontend tidak lagi fetch attempts
  // atau questions penuh, dan tidak menghitung skor sendiri.
  const LEADERBOARD_PAGE_SIZE = 50;
  const [lbItems, setLbItems] = useState<any[]>([]);
  const [lbTotalItems, setLbTotalItems] = useState(0);
  const [lbTotalPages, setLbTotalPages] = useState(1);
  const [lbStats, setLbStats] = useState({ total: 0, ongoing: 0, finished: 0, locked: 0, avgScore: 0 });
  const [topItems, setTopItems] = useState<any[]>([]);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
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
            max_questions: Number(r.max_questions) || 0,
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

  // Fetch leaderboard dari backend (/api/leaderboard).
  // Skor + ranking dihitung di server (SQL), sudah ter-sort desc global,
  // lalu dipaginasi server-side. Satu request juga membawa `stats`
  // (ongoing/finished/locked/avgScore) untuk kartu statistik.
  const handleRefreshData = useCallback(async (roomId: string, page: number) => {
    if (!pb || !roomId) return;
    setIsRefreshing(true);
    try {
      const lb: any = await pb.send(
        `/api/leaderboard?roomId=${encodeURIComponent(roomId)}&page=${page}&perPage=${LEADERBOARD_PAGE_SIZE}`,
        { method: "GET" }
      );
      if (lb && Array.isArray(lb.items)) {
        setLbItems(lb.items);
        setLbTotalItems(Number(lb.totalItems) || 0);
        setLbTotalPages(Math.max(1, Number(lb.totalPages) || 1));
        if (lb.stats) {
          setLbStats({
            total: Number(lb.stats.total) || 0,
            ongoing: Number(lb.stats.ongoing) || 0,
            finished: Number(lb.stats.finished) || 0,
            locked: Number(lb.stats.locked) || 0,
            avgScore: Number(lb.stats.avgScore) || 0,
          });
        }
        // Podium selalu dari 3 teratas global (halaman 1).
        if (page === 1) setTopItems(lb.items.slice(0, 3));
      }
    } catch (e) {
      console.error("Gagal memuat leaderboard:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [pb]);

  // Handle room switch / page change: fetch halaman dari backend.
  useEffect(() => {
    if (selectedRoomId) {
      handleRefreshData(selectedRoomId, leaderboardPage);
    }
  }, [selectedRoomId, leaderboardPage, handleRefreshData]);

  // Reset ke halaman 1 saat ganti room.
  useEffect(() => { setLeaderboardPage(1); }, [selectedRoomId]);

  // Leaderboard on-demand via backend: TANPA realtime subscription per-event
  // dan TANPA hitung skor di frontend.
  // Alasan: subscribe("*") ke 10k attempts = ribuan event/detik -> browser freeze.
  // Ranking akurat: backend menghitung skor SEMUA attempts, sort desc global,
  // lalu memotong per halaman. Siswa nilai tertinggi selalu di halaman 1.

  const activeRoom = useMemo(() => rooms.find(r => r.id === selectedRoomId), [rooms, selectedRoomId]);

  // Meta siswa (nisn, nama kelas) dari context — untuk melengkapi item backend.
  const studentMeta = useMemo(() => {
    const map: Record<string, { nisn: string; className: string }> = {};
    for (const s of students || []) {
      if (!s?.id) continue;
      map[s.id] = {
        nisn: s.nisn || "",
        className: examClasses.find((c: any) => c.id === s.classId)?.name || "-",
      };
    }
    return map;
  }, [students, examClasses]);

  // Jumlah siswa eligible (terdaftar) untuk kartu "Siswa Terdaftar".
  const eligibleCount = useMemo(() => {
    if (!activeRoom) return 0;
    return (students || []).filter((s: any) =>
      activeRoom.allClasses ? true : activeRoom.classId.includes(s.classId)
    ).length;
  }, [activeRoom, students]);

  // Auto Scroll state
  const [autoScroll, setAutoScroll] = useState(false);

  // Paginasi server-side: halaman diminta ke backend via handleRefreshData.
  const leaderboardTotalPages = lbTotalPages;

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
  }, [autoScroll, lbItems.length]);

  // Statistics: "Siswa Terdaftar" dari context (eligible), sisanya dari backend.
  const stats = useMemo(() => ({
    total: eligibleCount,
    ongoing: lbStats.ongoing,
    finished: lbStats.finished,
    locked: lbStats.locked,
    avgScore: lbStats.avgScore,
  }), [eligibleCount, lbStats]);

  // Podium: 3 teratas global dari backend, dilengkapi className/nisn.
  const podium = useMemo(() => topItems.map((it: any) => {
    const meta = studentMeta[it.studentId] || { nisn: "", className: "-" };
    return { ...it, className: meta.className, nisn: meta.nisn, answeredCount: it.answered };
  }), [topItems, studentMeta]);

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
            onClick={() => selectedRoomId && handleRefreshData(selectedRoomId, leaderboardPage)}
            disabled={isRefreshing}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 ${
              isDarkMode
                ? "bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
                : "bg-white border-gray-200 text-gray-700 hover:text-gray-900 hover:border-gray-300 shadow-sm"
            }`}
            title="Segarkan data nilai dan status pengerjaan sekarang"
            aria-label="Segarkan data"
          >
            <RefreshCw className={`w-3.5 h-3.5 transition-all ${isRefreshing ? "animate-spin text-indigo-500" : ""}`} />
            <span>{isRefreshing ? "Memuat..." : "Segarkan"}</span>
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
            {podium.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 2nd Place */}
                {podium[1] && (
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
                          }`}>{podium[1].name}</h3>
                        <p className={`text-[10px] font-semibold mt-0.5 ${isDarkMode ? "text-slate-500" : "text-gray-500"
                          }`}>{podium[1].className} • {podium[1].answeredCount}/{podium[1].totalQuestions} Soal</p>
                      </div>
                    </div>
                    <div className="text-right relative z-10">
                      <span className={`text-3xl font-black ${isDarkMode ? "text-slate-200" : "text-gray-700"
                        }`}>{podium[1].score}</span>
                      <p className={`text-[8px] font-bold tracking-widest uppercase mt-1 ${isDarkMode ? "text-slate-500" : "text-gray-400"
                        }`}>Live Score</p>
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {podium[0] && (
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
                          }`}>{podium[0].name}</h3>
                        <p className={`text-[10px] font-semibold mt-0.5 ${isDarkMode ? "text-indigo-400" : "text-indigo-600"
                          }`}>{podium[0].className} • {podium[0].answeredCount}/{podium[0].totalQuestions} Soal</p>
                      </div>
                    </div>
                    <div className="text-right relative z-10">
                      <span className="text-4xl font-black text-amber-500">{podium[0].score}</span>
                      <p className="text-[8px] font-bold text-amber-500/60 tracking-widest uppercase mt-1">Live Score</p>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {podium[2] && (
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
                          }`}>{podium[2].name}</h3>
                        <p className={`text-[10px] font-semibold mt-0.5 ${isDarkMode ? "text-slate-500" : "text-gray-500"
                          }`}>{podium[2].className} • {podium[2].answeredCount}/{podium[2].totalQuestions} Soal</p>
                      </div>
                    </div>
                    <div className="text-right relative z-10">
                      <span className="text-3xl font-black text-amber-600">{podium[2].score}</span>
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
                    {lbItems.length === 0 ? (
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
                    ) : lbItems.map((s: any) => {
                      const meta = studentMeta[s.studentId] || { nisn: "", className: "-" };
                      const globalRank = (s.rank || 0) - 1; // rank backend 1-based -> 0-based
                      const isTop3 = globalRank < 3;
                      const status = s.status || "offline";
                      const cheatCount = s.cheatCount || 0;
                      const totalQ = s.totalQuestions || 0;
                      const answered = s.answered || 0;

                      return (
                        <tr
                          key={s.attemptId || s.studentId}
                          className={`transition-all h-16 group ${isDarkMode
                            ? `hover:bg-slate-900/40 ${isTop3 ? "bg-indigo-500/[0.02]" : ""}`
                            : `hover:bg-gray-50 ${isTop3 ? "bg-indigo-50/40" : ""}`
                            }`}
                        >
                          <td className="py-4 px-6 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-sm font-black font-mono transition-all group-hover:scale-110 ${globalRank === 0
                                ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30"
                                : globalRank === 1
                                  ? isDarkMode ? "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900 shadow-lg" : "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-900 shadow-lg"
                                  : globalRank === 2
                                    ? "bg-gradient-to-br from-amber-700 to-amber-800 text-white shadow-lg shadow-amber-700/30"
                                    : isDarkMode
                                      ? "bg-slate-900/60 text-slate-400 border border-slate-800"
                                      : "bg-gray-100 text-gray-600 border border-gray-200"
                                }`}
                            >
                              {globalRank + 1}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className={`font-bold text-sm ${isDarkMode ? "text-slate-100" : "text-gray-900"
                              }`}>{s.name}</div>
                            <div className={`text-[10px] font-mono mt-1 ${isDarkMode ? "text-slate-500" : "text-gray-500"
                              }`}>{meta.nisn}</div>
                          </td>
                          <td className={`py-4 px-6 text-center text-sm font-semibold ${isDarkMode ? "text-slate-300" : "text-gray-700"
                            }`}>
                            {meta.className}
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
                                {answered} <span className={isDarkMode ? "text-slate-600" : "text-gray-400"}>/ {totalQ}</span>
                              </span>
                              <div className={`w-28 h-2 rounded-full overflow-hidden shadow-inner transition-all ${isDarkMode ? "bg-slate-900/60 border border-slate-800" : "bg-gray-100 border border-gray-200"
                                }`}>
                                <div
                                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
                                  style={{
                                    width: `${totalQ > 0
                                      ? Math.min(100, Math.round((answered / totalQ) * 100))
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
              {/* Paginasi leaderboard: 50 per halaman */}
              {leaderboardTotalPages > 1 && (
                <div className={`flex items-center justify-between px-6 py-4 border-t ${isDarkMode ? "border-slate-800/30" : "border-gray-100"}`}>
                  <span className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                    Halaman {leaderboardPage} dari {leaderboardTotalPages} • {lbTotalItems} siswa
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setLeaderboardPage(p => Math.max(1, p - 1))}
                      disabled={leaderboardPage <= 1}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${leaderboardPage <= 1
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:scale-105 active:scale-95"
                        } ${isDarkMode ? "bg-slate-800 text-slate-200" : "bg-gray-100 text-gray-700"}`}
                    >
                      ← Prev
                    </button>
                    <span className={`text-xs font-mono font-bold ${isDarkMode ? "text-slate-300" : "text-gray-600"}`}>
                      {leaderboardPage} / {leaderboardTotalPages}
                    </span>
                    <button
                      onClick={() => setLeaderboardPage(p => Math.min(leaderboardTotalPages, p + 1))}
                      disabled={leaderboardPage >= leaderboardTotalPages}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${leaderboardPage >= leaderboardTotalPages
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:scale-105 active:scale-95"
                        } ${isDarkMode ? "bg-slate-800 text-slate-200" : "bg-gray-100 text-gray-700"}`}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
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
