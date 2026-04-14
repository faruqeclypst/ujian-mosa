import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import pb from "../../lib/pocketbase";
import {
  Calendar, Clock, ChevronRight, User, AlertCircle,
  Award, LogOut as LogoutIcon, Sun, Moon, Monitor, KeyRound, ClipboardCheck, Sparkles
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "../../components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "../../components/ui/skeleton";
import { useTheme } from "../../context/ThemeContext";
import { Card, CardHeader, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";
import { syncPendingData } from "../../lib/syncManager";

const getExamTypeColorClass = (type: string) => {
  switch (type?.toLowerCase()) {
    case "uh": case "ulangan harian": return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "pts": case "tengah semester": return "bg-amber-50 text-amber-700 border-amber-100";
    case "pas": case "akhir semester": return "bg-emerald-50 text-emerald-700 border-emerald-100";
    default: return "bg-slate-50 text-slate-700 border-slate-100";
  }
};

const StudentDashboardPage = () => {
  const navigate = useNavigate();
  const { student, logoutStudent } = useStudentAuth();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [hasInterests, setHasInterests] = useState(false);
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState("CBT System");
  const [schoolLogo, setSchoolLogo] = useState("");

  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [userAttempts, setUserAttempts] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [isSyncingData, setIsSyncingData] = useState(false);
  const [isFirstLoadState, setIsFirstLoadState] = useState(true);
  const [displayedName, setDisplayedName] = useState("");

  // ✨ TYPING EFFECT UNTUK NAMA SISWA
  useEffect(() => {
    if (!student?.name) return;
    let i = 0;
    const fullName = student.name;
    const timer = setInterval(() => {
      setDisplayedName(fullName.substring(0, i));
      i++;
      if (i > fullName.length) clearInterval(timer);
    }, 50); // Kecepatan mengetik: 50ms per karakter
    return () => clearInterval(timer);
  }, [student?.name]);

  const handleManualSync = async () => {
    if (!student || isSyncingData || !navigator.onLine) return;
    setIsSyncingData(true);
    try {
      await syncPendingData(student.id);
      setHasPendingSync(false);
    } catch (e) {
      setHasPendingSync(true);
    } finally {
      setIsSyncingData(false);
    }
  };

  // 🔄 BACKGROUND AUTO-SYNC (TANPA DISADARI SISWA)
  useEffect(() => {
    if (!student) return;

    const checkAndSync = async () => {
      const keys = Object.keys(localStorage);
      const pendingKeys = keys.filter(k => k.startsWith(`pending_sync_${student.id}_`));
      const hasPending = pendingKeys.length > 0;
      
      setHasPendingSync(hasPending);

      if (hasPending && navigator.onLine && !isSyncingData) {
        handleManualSync();
      }
    };

    checkAndSync();
    const interval = setInterval(checkAndSync, 10000);
    return () => clearInterval(interval);
  }, [student, isSyncingData]);

  const fetchData = async (isSilent = false) => {
    try {
      // Only show full loading on initial mount
      if (loading && !isSilent) setLoading(true);
      
      // Fetch settings (Skip if already have school info)
      if (!schoolLogo || schoolName === "CBT System") {
        const settingsRecords = await pb.collection("settings").getFullList({ limit: 1, requestKey: "dashboard_settings" });
        if (settingsRecords.length > 0) {
          setSchoolName(settingsRecords[0].name || "CBT System");
          setSchoolLogo(settingsRecords[0].logoUrl || settingsRecords[0].logo || "");
        }
      }

      if (!student) return;

      // 1. Fetch Rooms and Attempts in Parallel (Faster)
      const [roomsRecords, attemptsRecords] = await Promise.all([
        pb.collection("exam_rooms").getFullList({
          expand: "examId,examId.subjectId,examId.teacherId",
          sort: "-created",
          requestKey: "dashboard_rooms"
        }),
        pb.collection("attempts").getFullList({ 
          filter: `studentId = "${student.id}"`,
          requestKey: "dashboard_attempts"
        })
      ]);

      // 2. Map Attempts for lookup
      const myStatus: Record<string, any> = {};
      let lockedRoomId = "";
      attemptsRecords.forEach(att => {
        myStatus[att.examRoomId] = att;
        if (att.status === "LOCKED") lockedRoomId = att.examRoomId;
      });

      // 3. Process Rooms
      const allRooms = roomsRecords.filter(room => {
        if (room.isActive === false || room.status === "archive") return false;
        if (room.allClasses) return true;
        const clsData = room.classId || (room as any).classIds || "";
        const allowedClasses = Array.isArray(clsData) ? clsData : String(clsData).split(",").map(id => id.trim());
        return allowedClasses.includes(student.classId);
      }).map(room => {
        const exam = room.expand?.examId;
        const now = new Date();
        const start = new Date(room.start_time || room.startTime);
        const end = new Date(room.end_time || room.endTime);
        let timeStatus = "upcoming";
        if (now >= start && now <= end) timeStatus = "ongoing";
        else if (now > end) timeStatus = "expired";
        const normalizedRoomName = room.room_name || (room as any).roomName || (room as any).title || (room as any).room_code || "Ruang Utama";
        return {
          ...room,
          room_name: normalizedRoomName,
          examTitle: normalizedRoomName,
          examDescription: exam?.title || "Paket Soal",
          subject: exam?.expand?.subjectId?.name || "Mapel",
          teacherName: exam?.expand?.teacherId?.name || "-",
          examType: exam?.examType || "Latihan",
          timeStatus,
          startTimeDate: start,
          endTimeDate: end
        };
      }).sort((a, b) => {
        const order: any = { "ongoing": 0, "upcoming": 1, "expired": 2 };
        return order[a.timeStatus] - order[b.timeStatus];
      });

      setUserAttempts(myStatus);
      setActiveRooms(allRooms);

      // 4. Handle Redirection if locked
      if (lockedRoomId && !window.location.pathname.includes('/cbt')) {
        sessionStorage.setItem("activeCBTRoomId", lockedRoomId);
        navigate(`/cbt`, { replace: true });
        return;
      }
    } catch (err) { 
      console.error("Dashboard fetch error:", err); 
    } finally { 
      setLoading(false);
      // Tunggu sebentar agar animasi pertama selesai baru matikan state first load
      setTimeout(() => setIsFirstLoadState(false), 1000);
    }
  };

  useEffect(() => {
    if (!student) return;
    fetchData();

    // Subscribe to room changes (Global)
    const unsubR = pb.collection("exam_rooms").subscribe("*", (e) => {
      console.log("Room Change Detected, updating UI silently...");
      fetchData(true);
    });

    // Subscribe ONLY to this student's attempts to prevent massive load
    const unsubA = pb.collection("attempts").subscribe("*", (e) => {
      if (e.record.studentId === student.id) {
        console.log("My Attempt Change Detected, updating UI silently...");
        fetchData(true);
      }
    });

    return () => {
      unsubR.then(u => u()).catch(() => { });
      unsubA.then(u => u()).catch(() => { });
    };
  }, [student?.id]);

  useEffect(() => {
    if (student?.id && navigator.onLine) {
      syncPendingData(student.id).then((synced) => {
        if (synced && synced.length > 0) fetchData(true);
      });
    }
  }, [student?.id]);

  const handleValidateToken = async () => {
    if (!selectedRoom || !student) return;
    setTokenError("");
    setIsValidating(true);
    try {
      // 🛡️ Ambil data terbaru langsung dari server dengan penanganan lebih kuat (Mempertimbangkan API Rules List vs View)
      let freshRoom;
      try {
        const checkList = await pb.collection("exam_rooms").getFullList({
          filter: `id = "${selectedRoom.id}"`,
          limit: 1,
          requestKey: null
        });

        if (checkList.length === 0) {
          fetchData(true);
          throw new Error("Ruangan ini sudah tidak aktif, sedang di-arsip, atau Anda tidak memiliki akses ke kelas ini lagi.");
        }
        freshRoom = checkList[0];
      } catch (err: any) {
        if (err.status === 404 || err.message.includes("tidak aktif")) {
          throw new Error(err.message || "Ruangan tidak ditemukan.");
        }
        throw err;
      }

      const settingsRecords = await pb.collection("settings").getFullList({ limit: 1 });
      const globalToken = (settingsRecords[0]?.universal_token || settingsRecords[0]?.global_token || settingsRecords[0]?.globalToken || "").toString().trim().toUpperCase();
      const roomToken = (freshRoom.token || "").toString().trim().toUpperCase();

      const input = tokenInput.trim().toUpperCase();

      if (input !== globalToken && input !== roomToken) {
        throw new Error("Token yang Anda masukkan belum tepat. Silakan cek kembali.");
      }

      sessionStorage.setItem("activeCBTRoomId", selectedRoom.id);

      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        }
      } catch (err) {
        console.warn("Gagal otomatis masuk full screen:", err);
      }

      navigate(`/cbt`);
    } catch (err: any) { 
      setTokenError(err.message || "Terjadi kesalahan saat verifikasi."); 
    } finally { 
      setIsValidating(false); 
    }
  };

  const totalActive = activeRooms.filter(r => {
    const att = userAttempts[r.id];
    const finished = att && (att.status === "finished" || att.status === "submitted" || att.status === "graded");
    const expired = r.timeStatus === "expired";
    return !finished && !expired;
  }).length;

  const totalFinished = activeRooms.filter(r => {
    const att = userAttempts[r.id];
    const finished = att && (att.status === "finished" || att.status === "submitted" || att.status === "graded");
    const expired = r.timeStatus === "expired";
    return finished || expired;
  }).length;

  const [messageIndex, setMessageIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setMessageIndex(p => (p + 1) % 2), 4000);
    return () => clearInterval(timer);
  }, []);

  const bannerMessages = [
    { text: "Anda memiliki", highlight: `${totalActive} agenda ujian aktif`, suffix: "hari ini." },
    { text: "Tercatat sebanyak", highlight: `${totalFinished} agenda ujian`, suffix: "telah selesai." }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-20 sm:pb-0">
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl border-b border-slate-100 dark:border-slate-800 h-16 sm:h-20 px-3 sm:px-10 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1 sm:p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl sm:rounded-2xl border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm shrink-0">
            {schoolLogo ? (
              <img src={schoolLogo} className="h-6 w-6 sm:h-9 sm:w-9 object-contain" alt="Logo" />
            ) : (
              <img src="/logo-default.png" className="h-6 w-6 sm:h-9 sm:w-9 object-contain opacity-50" alt="Default Logo" />
            )}
          </div>
          <div className="flex flex-col -space-y-0.5 sm:-space-y-1 sm:max-w-none justify-center">
            <h1 className="text-sm sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight whitespace-nowrap">
              {schoolName}
            </h1>
            <span className="text-[9px] sm:text-[10px] font-black text-emerald-600 dark:text-emerald-400/80 uppercase tracking-widest sm:tracking-[0.3em] whitespace-nowrap">
              Computer Based Test
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-4 border-slate-100 dark:border-slate-800">
            <div className="text-right min-w-0 hidden sm:block">
              <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-snug uppercase">{student?.name?.split(" ")[0]}</p>
              <div className="inline-block px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-md text-[9px] font-black text-emerald-600 dark:text-emerald-400 mt-2 leading-none uppercase tracking-widest border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm">
                Class {student?.className}
              </div>
            </div>

            <div className="text-right min-w-0 flex flex-col justify-center sm:hidden mr-1">
              <p className="text-[11px] font-black text-slate-800 dark:text-white leading-tight uppercase truncate max-w-[80px]">{student?.name?.split(" ")[0]}</p>
              <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 uppercase tracking-widest leading-none">{student?.className}</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl sm:rounded-2xl flex items-center justify-center border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm group cursor-pointer hover:bg-emerald-100 transition-all outline-none">
                  <User className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl border-slate-100 dark:border-slate-800 shadow-2xl">
                <DropdownMenuLabel className="px-3 py-2 flex flex-col gap-0.5">
                  <span className="text-xs font-black text-slate-800 dark:text-white uppercase truncate">{student?.name}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SISWA • {student?.className} • NISN {student?.nisn}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-2 bg-slate-50 dark:bg-slate-800" />
                <div className="px-3 py-2 flex flex-col gap-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Personalisasi Tema</span>
                  <div className="flex items-center justify-between p-1 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <button onClick={() => setTheme("light")} className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all ${theme === 'light' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      <Sun className="h-4 w-4" />
                    </button>
                    <button onClick={() => setTheme("dark")} className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      <Moon className="h-4 w-4" />
                    </button>
                    <button onClick={() => setTheme("system")} className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all ${theme === 'system' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      <Monitor className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <DropdownMenuSeparator className="my-2 bg-slate-50 dark:bg-slate-800" />
                <DropdownMenuItem onClick={logoutStudent} className="px-3 py-2.5 rounded-xl text-rose-500 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30 flex items-center gap-3 cursor-pointer transition-colors group">
                  <div className="p-1.5 bg-rose-50 dark:bg-rose-900/30 rounded-lg group-focus:bg-rose-100/50 transition-colors">
                    <LogoutIcon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Exams */}
          <div className="lg:col-span-8 space-y-8">
            {/* Desktop Banner */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              className="relative bg-emerald-600 rounded-[30px] p-8 sm:p-10 overflow-hidden shadow-2xl shadow-emerald-100 dark:shadow-none hidden lg:block"
            >
              <div className="absolute top-0 right-0 w-1/2 h-full bg-emerald-500/50 skew-x-[-20deg] translate-x-1/2" />
              
              <div className="relative z-10 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black text-slate-200 uppercase tracking-widest border border-white/5">
                  Verified Student Account
                </div>
                
                {/* 👻 GHOST WRAPPER FOR STABILITY */}
                <div className="relative">
                  {/* Invisible Full Name (Reserves Space) */}
                  <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-white/0 tracking-tight leading-[1.1] uppercase select-none pointer-events-none">
                    Selamat Datang Kembali, <br />
                    <span>{student?.name}</span>
                  </h2>
                  
                  {/* Visible Typing Name (Layered on top) */}
                  <h2 className="absolute top-0 left-0 w-full text-2xl sm:text-3xl md:text-5xl font-black text-white tracking-tight leading-[1.1] uppercase">
                    Selamat Datang Kembali, <br />
                    <span className="inline text-emerald-100">
                      {displayedName.slice(0, -1)}
                      <span className="relative inline">
                        {displayedName.slice(-1)}
                        {displayedName.length > 0 && (
                          <span className="absolute left-0 -bottom-1 w-full h-1 bg-emerald-200 animate-pulse rounded-full" />
                        )}
                      </span>
                      {displayedName.length === 0 && (
                        <span className="inline-block w-4 h-1 bg-emerald-200 animate-pulse align-baseline shadow-sm rounded-full" />
                      )}
                    </span>
                  </h2>
                </div>

                <div className="relative z-10 h-6 overflow-hidden mt-4">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={messageIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.5, ease: "anticipate" }}
                      className="text-[10px] sm:text-xs text-slate-100/70 font-bold uppercase tracking-widest leading-none flex items-center gap-1.5"
                    >
                      {bannerMessages[messageIndex].text}
                      <span className="text-white px-2 py-0.5 bg-white/10 rounded-lg">{bannerMessages[messageIndex].highlight}</span>
                      {bannerMessages[messageIndex].suffix}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* Mobile Banner */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative bg-emerald-600 rounded-[30px] p-6 overflow-hidden shadow-2xl shadow-emerald-100 dark:shadow-none lg:hidden">
              <div className="absolute top-0 right-0 w-1/2 h-full bg-emerald-500/50 skew-x-[-20deg] translate-x-1/2" />
              <div className="relative z-10 text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[8px] font-black text-slate-200 uppercase tracking-widest border border-white/5 mx-auto">
                  Verified Student Account
                </div>
                <h2 className="text-xl font-black text-white tracking-tight leading-tight uppercase">
                  Halo, {student?.name?.split(" ")[0]}
                </h2>
                <div className="h-4 overflow-hidden flex justify-center">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={messageIndex}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-[9px] text-slate-100/70 font-bold uppercase tracking-widest leading-none"
                    >
                      {bannerMessages[messageIndex].highlight} {bannerMessages[messageIndex].suffix}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
            
            {/* Mobile Feature Link */}
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               onClick={() => navigate("/minat-bakat")}
               className="lg:hidden p-5 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] text-white overflow-hidden relative group shadow-xl active:scale-95 transition-all text-left"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles className="h-10 w-10 rotate-12" /></div>
              <div className="flex items-center gap-2 mb-1">
                 <Sparkles className="h-3 w-3 text-yellow-300" />
                 <p className="text-[8px] font-black text-indigo-100 uppercase tracking-widest">{hasInterests ? "Teranalisis" : "Self Discovery"}</p>
              </div>
              <p className="text-sm font-black leading-tight">{hasInterests ? "Lihat Hasil Minat" : "Cek Minat & Bakat"}</p>
              <p className="text-[9px] font-medium text-indigo-100/70 mt-1">{hasInterests ? "Tinjau kembali potensi karirmu." : "Temukan potensi terbaikmu di sini."}</p>
            </motion.div>

            <div className="space-y-6 text-left">
              <AnimatePresence>
        {hasPendingSync && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-500 animate-pulse" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-black text-amber-600 uppercase tracking-widest">Sinkronisasi Diperlukan</span>
                  <p className="text-[11px] font-bold text-amber-700/70">Waduh! Ada jawaban ujianmu yang belum terkirim ke server karena internet mati tadi.</p>
                </div>
              </div>
              <Button
                onClick={handleManualSync}
                disabled={isSyncingData}
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-9 px-4 font-black uppercase tracking-widest text-[10px] shadow-sm w-full sm:w-auto"
              >
                {isSyncingData ? (
                   <>
                    <Sparkles className="w-3 h-3 mr-2 animate-spin" />
                    Mengirim...
                   </>
                ) : "Kirim Jawaban Sekarang"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-emerald-600 rounded-full shadow-lg shadow-emerald-200 animate-pulse" />
                  <h3 className="text-sm sm:text-base font-black text-emerald-900 dark:text-slate-300 uppercase tracking-[0.3em]">Agenda Ujian</h3>
                </div>

                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                  <button onClick={() => setActiveTab("active")} className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", activeTab === "active" ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300")}>
                    Aktif ({activeRooms.filter(r => {
                      const att = userAttempts[r.id];
                      const finished = att && (att.status === "finished" || att.status === "submitted" || att.status === "graded");
                      const expired = r.timeStatus === "expired";
                      return !finished && !expired;
                    }).length})
                  </button>
                  <button onClick={() => setActiveTab("history")} className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", activeTab === "history" ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300")}>
                    Selesai ({activeRooms.filter(r => {
                      const att = userAttempts[r.id];
                      const finished = att && (att.status === "finished" || att.status === "submitted" || att.status === "graded");
                      const expired = r.timeStatus === "expired";
                      return finished || expired;
                    }).length})
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-48 rounded-2xl" />
                    ))}
                  </div>
                ) : activeRooms.filter(r => {
                  const att = userAttempts[r.id];
                  const finished = att && (att.status === "finished" || att.status === "submitted" || att.status === "graded");
                  const expired = r.timeStatus === "expired";
                  const isHistory = finished || expired;
                  return activeTab === "active" ? !isHistory : isHistory;
                }).length === 0 ? (
                  <div className="py-20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center bg-white dark:bg-slate-900/50">
                    <Calendar className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">
                      {activeTab === "active" ? "Tidak ada jadwal aktif" : "Belum ada riwayat ujian"}
                    </h3>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                    {activeRooms
                      .filter(r => {
                        const att = userAttempts[r.id];
                        const finished = att && (att.status === "finished" || att.status === "submitted" || att.status === "graded");
                        const expired = r.timeStatus === "expired";
                        const isHistory = finished || expired;
                        return activeTab === "active" ? !isHistory : isHistory;
                      })
                      .map((room, idx) => {
                        const attempt = userAttempts[room.id];
                        const isFinished = attempt && (attempt.status === "finished" || attempt.status === "submitted" || attempt.status === "graded");
                        const isLocked = attempt && attempt.status === "LOCKED";

                        return (
                          <motion.div 
                            initial={isFirstLoadState ? { opacity: 0, scale: 0.95 } : false} 
                            animate={{ opacity: 1, scale: 1 }} 
                            transition={{ delay: isFirstLoadState ? idx * 0.05 : 0 }} 
                            key={room.id} 
                            className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-all overflow-hidden flex flex-col h-full text-left"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-950/20 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
                            <div className="p-6 flex-1 flex flex-col relative z-10">
                              <div className="flex justify-between items-start gap-4 mb-2">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{room.subject}</span>
                                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase leading-tight group-hover:text-emerald-600 transition-colors">
                                    {room.room_name || "Ruang Ujian"}
                                  </h3>
                                </div>
                                <Badge className={cn("text-[8px] font-black uppercase shrink-0 py-1 px-3 rounded-full border-none shadow-sm", getExamTypeColorClass(room.examType))}>{room.examType}</Badge>
                              </div>

                              <div className="mt-1 space-y-3 flex-1">
                                {/* Paket Soal - High Visibility */}
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group-hover:border-emerald-100 dark:group-hover:border-emerald-900/40 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm">
                                      <ClipboardCheck className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest leading-none">Paket Soal</span>
                                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase mt-1 leading-tight line-clamp-1">{room.examDescription}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center justify-center border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm">
                                      <User className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest leading-none">Pengampu</span>
                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{room.teacherName}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center justify-center border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm">
                                      <Calendar className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest leading-none">Hari & Tanggal</span>
                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {new Date(room.startTimeDate).toLocaleDateString("id-ID", { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center justify-center border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm">
                                      <Clock className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest leading-none">Durasi</span>
                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{room.duration} Menit</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center justify-center border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm">
                                      <Clock className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest leading-none">Waktu Mulai</span>
                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Pkl {new Date(room.startTimeDate).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} WIB</span>
                                    </div>
                                  </div>
                                </div>
                                                <div className="mt-auto pt-4 border-t border-slate-50 dark:border-slate-800/50">
                                  {isFinished ? (
                                    <div className="flex flex-col gap-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex gap-2">
                                          <div className="flex flex-col items-center bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/50 py-2 px-3 rounded-xl min-w-[50px]">
                                            <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none mb-1">Benar</span>
                                            <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">{attempt?.correct || 0}</span>
                                          </div>
                                          <div className="flex flex-col items-center bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-800/50 py-2 px-3 rounded-xl min-w-[50px]">
                                            <span className="text-[8px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest leading-none mb-1">Salah</span>
                                            <span className="text-sm font-black text-rose-700 dark:text-rose-300">{(room.total_questions || room.totalQuestions || 0) - (attempt?.correct || 0)}</span>
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nilai Akhir</span>
                                          <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                                              {Number(attempt?.score || 0).toFixed(1)}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400">/ 100</span>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="-mx-6 -mb-6 mt-2 px-6 py-3 bg-emerald-500 text-white flex items-center justify-between shadow-inner">
                                        <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                          <ClipboardCheck className="w-3.5 h-3.5" />
                                          Ujian Selesai
                                        </span>
                                        <div className="h-4 w-px bg-white/20" />
                                        <span className="text-[9px] font-black opacity-80 uppercase tracking-widest">Tersimpan di Server</span>
                                      </div>
                                    </div>
                                  ) : isLocked ? (
                                    <div className="h-12 px-4 bg-rose-50 dark:bg-rose-950/20 rounded-2xl flex items-center justify-center gap-3 border border-rose-100 dark:border-rose-900/40">
                                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">Akun Terkunci</span>
                                    </div>
                                  ) : room.timeStatus === "ongoing" ? (
                                    <Button 
                                      onClick={() => setSelectedRoom(room)} 
                                      className="w-full h-12 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-200 dark:shadow-none transition-all active:scale-95 group-hover:bg-emerald-700"
                                    > 
                                      {attempt ? "Lanjutkan Ujian" : "Mulai Pengerjaan"}
                                    </Button>
                                  ) : (
                                    <div className="h-12 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-800">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        {room.timeStatus === "expired" ? "Waktu Telah Habis" : "Menunggu Jadwal Mulai"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6 sticky top-28 hidden lg:block text-left">
            <Card className="rounded-[2.5rem] border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none bg-white dark:bg-slate-900 overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center border border-emerald-100 dark:border-emerald-800 shadow-sm">
                    <User className="h-7 w-7 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-widest leading-none">Status Siswa</p>
                    <h4 className="text-base font-black text-slate-800 dark:text-white mt-1 leading-tight">{student?.name}</h4>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-emerald-600/70 dark:text-emerald-400/70 uppercase">Kelas Terdaftar</span>
                    <span className="text-slate-700 dark:text-slate-200 uppercase">{student?.className}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-emerald-600/70 dark:text-emerald-400/70 uppercase">Username / NISN</span>
                    <span className="text-slate-700 dark:text-slate-200">{student?.nisn}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-2 space-y-6">
                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest flex items-center gap-2">
                    <Award className="h-3 w-3 text-emerald-500" /> Pencapaian & Statistik
                  </h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-[1.5rem] bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/50 text-center">
                      <p className="text-xl font-black text-indigo-700 dark:text-indigo-400 leading-none">{Object.values(userAttempts).filter(a => a.status !== "ongoing" && a.status !== "LOCKED").length}</p>
                      <p className="text-[8px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter mt-1">Selesai</p>
                    </div>
                    <div className="p-4 rounded-[1.5rem] bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/50 text-center">
                      <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 leading-none">{totalActive}</p>
                      <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter mt-1">Pending</p>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-50 dark:border-slate-800/60">
                   <motion.div 
                     whileHover={{ scale: 1.02 }}
                     whileTap={{ scale: 0.98 }}
                     onClick={() => navigate("/minat-bakat")}
                     className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-700 dark:from-indigo-800 dark:to-indigo-950 rounded-[2rem] text-white overflow-hidden relative group cursor-pointer shadow-xl shadow-indigo-500/10 mb-4"
                   >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform"><Sparkles className="h-12 w-12" /></div>
                    <div className="flex items-center gap-2 mb-1">
                       <Sparkles className="h-3 w-3 text-yellow-300" />
                       <p className="text-[9px] font-black text-indigo-100/60 uppercase tracking-widest">{hasInterests ? "Teranalisis" : "Self Discovery"}</p>
                    </div>
                    <p className="text-sm font-black leading-tight mb-1">{hasInterests ? "Lihat Hasil Minat & Bakat" : "Tes Minat & Bakat"}</p>
                    <p className="text-[10px] font-medium text-indigo-100/70 leading-relaxed">{hasInterests ? "Analisis potensimu sudah siap untuk dipelajari kembali." : "Temukan jurusan dan karier impianmu melalui survey kepribadian."}</p>
                  </motion.div>

                  <div className="p-5 bg-gradient-to-br from-emerald-600 to-emerald-700 dark:from-emerald-800 dark:to-emerald-950 rounded-[2rem] text-white overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform"><AlertCircle className="h-12 w-12" /></div>
                    <p className="text-[9px] font-black text-emerald-100/60 uppercase tracking-widest mb-1">Pusat Bantuan</p>
                    <p className="text-xs font-bold leading-relaxed">Ada kendala teknis? Silahkan hubungi pengawas atau proktor ruangan.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={!!selectedRoom} onOpenChange={() => { if (!isValidating) setSelectedRoom(null); setTokenInput(""); setTokenError(""); }}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 rounded-xl border-none shadow-2xl p-0">
          <div className="bg-emerald-600 px-6 py-8 text-white relative">
            <div className="absolute top-0 right-0 p-4 opacity-10"><KeyRound className="w-16 h-16" /></div>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold uppercase tracking-tight">Verifikasi Akses</DialogTitle>
              <p className="text-emerald-50/80 text-[10px] font-bold uppercase tracking-widest mt-1.5 opacity-90">Masukkan Token Ruangan</p>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Token Ujian</label>
                <Input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="AB123" className="h-12 text-center text-xl font-black tracking-[0.3em] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg uppercase" disabled={isValidating} />
                {tokenError && <p className="text-rose-500 text-[9px] font-bold mt-2 flex items-center gap-1 uppercase text-left"><AlertCircle className="w-3 h-3" /> {tokenError}</p>}
              </div>
              <div className="bg-emerald-50/50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800 text-left"><p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-relaxed font-medium">⚠️ Pastikan koneksi internet stabil sebelum mulai. Pengerjaan Anda akan tercatat secara otomatis.</p></div>
            </div>
            <DialogFooter>
              <Button onClick={handleValidateToken} disabled={!tokenInput || isValidating} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 text-white rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95">{isValidating ? "Memverifikasi..." : "Konfirmasi & Masuk"}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentDashboardPage;
