import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import pb from "../../lib/pocketbase";
import { LogOut, KeyRound, Calendar, Clock, ChevronRight, User, BookOpen, AlertCircle, ClipboardCheck, Award, LogOut as LogoutIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "../../components/ui/dropdown-menu";
import { motion } from "framer-motion";

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
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState("CBT System");
  const [schoolLogo, setSchoolLogo] = useState("");

  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [userAttempts, setUserAttempts] = useState<Record<string, any>>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const settingsRecords = await pb.collection("settings").getFullList({ limit: 1 });
      if (settingsRecords.length > 0) {
        setSchoolName(settingsRecords[0].name || "CBT System");
        setSchoolLogo(settingsRecords[0].logoUrl || settingsRecords[0].logo || "");
      }

      if (!student) return;

      const roomsRecords = await pb.collection("exam_rooms").getFullList({
        expand: "examId,examId.subjectId,examId.teacherId",
        sort: "-created"
      });

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
        return { ...room, examTitle: room.room_name || "Ruang Ujian", examDescription: exam?.title || "Mata Pelajaran", subject: exam?.expand?.subjectId?.name || "Mapel", teacherName: exam?.expand?.teacherId?.name || "-", examType: exam?.examType || "Latihan", timeStatus, startTimeDate: start, endTimeDate: end };
      }).sort((a, b) => {
        const order: any = { "ongoing": 0, "upcoming": 1, "expired": 2 };
        return order[a.timeStatus] - order[b.timeStatus];
      });

      setActiveRooms(allRooms);

      if (allRooms.length > 0) {
        const attempts = await pb.collection("attempts").getFullList({ filter: `studentId = "${student.id}"` });
        const myStatus: Record<string, any> = {};
        let lockedRoomId = "";

        attempts.forEach(att => {
          myStatus[att.examRoomId] = att;
          if (att.status === "LOCKED") lockedRoomId = att.examRoomId;
        });

        setUserAttempts(myStatus);

        // 🔥 Jika ada ujian yang TERKUNCI, paksa arahkan kembali ke ruang tersebut
        if (lockedRoomId) {
          sessionStorage.setItem("activeCBTRoomId", lockedRoomId);
          navigate(`/cbt/${lockedRoomId}`, { replace: true });
          return;
        }
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!student) return;
    fetchData();
    const unsubR = pb.collection("exam_rooms").subscribe("*", () => fetchData());
    const unsubA = pb.collection("attempts").subscribe("*", () => fetchData());
    return () => {
      unsubR.then(u => u()).catch(() => { });
      unsubA.then(u => u()).catch(() => { });
    };
  }, [student]);

  const handleValidateToken = async () => {
    if (!selectedRoom || !student) return;
    setTokenError("");
    setIsValidating(true);
    try {
      const settings = await pb.collection("settings").getFullList({ limit: 1 });
      const globalToken = settings[0]?.universal_token || settings[0]?.global_token || settings[0]?.globalToken;
      const roomToken = selectedRoom.token;

      const input = tokenInput.trim().toUpperCase();

      if (input !== globalToken && input !== roomToken) {
        throw new Error("Token tidak valid");
      }

      sessionStorage.setItem("activeCBTRoomId", selectedRoom.id);
      navigate(`/cbt`);
    } catch (err: any) { setTokenError(err.message); } finally { setIsValidating(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-3xl shadow-xl flex items-center justify-center mb-6 animate-bounce border border-slate-100 dark:border-slate-800">
          <ClipboardCheck className="w-8 h-8 text-emerald-600" />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Menyiapkan Sesi Anda...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-20 sm:pb-0">
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl border-b border-slate-100 dark:border-slate-800 h-16 sm:h-20 px-3 sm:px-10 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1 sm:p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl sm:rounded-2xl border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm shrink-0">
            {schoolLogo ? <img src={schoolLogo} className="h-6 w-6 sm:h-9 sm:w-9 object-contain" alt="Logo" /> : <div className="h-6 w-6 sm:h-9 sm:w-9 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />}
          </div>
          <div className="flex flex-col -space-y-0.5 sm:-space-y-1 min-[320px]:max-w-[150px] sm:max-w-none">
            <h1 className="text-xs sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight">
              {schoolName}
            </h1>
            <span className="text-[7px] sm:text-[10px] font-black text-emerald-600 dark:text-emerald-400/80 uppercase tracking-widest sm:tracking-[0.3em] whitespace-nowrap">
              Computer Based Test
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-4 border-slate-100 dark:border-slate-800">
            {/* Nama & Kelas (Desktop) */}
            <div className="text-right min-w-0 hidden sm:block">
              <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-snug uppercase">{student?.name?.split(" ")[0]}</p>
              <div className="inline-block px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-md text-[9px] font-black text-emerald-600 dark:text-emerald-400 mt-2 leading-none uppercase tracking-widest border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm">
                Class {student?.className}
              </div>
            </div>

            {/* Nama & Kelas (Mobile) */}
            <div className="text-right min-w-0 flex flex-col justify-center sm:hidden mr-1">
              <p className="text-[11px] font-black text-slate-800 dark:text-white leading-tight uppercase truncate max-w-[80px]">{student?.name?.split(" ")[0]}</p>
              <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 uppercase tracking-widest leading-none">{student?.className}</p>
            </div>

            {/* Icon Profil (Kanan) */}
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

      <main className="max-w-4xl mx-auto p-4 sm:p-10">
        <div className="space-y-8 sm:space-y-12">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative bg-emerald-600 rounded-[30px] sm:rounded-[50px] p-6 sm:p-16 overflow-hidden shadow-2xl shadow-emerald-100 dark:shadow-none">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-emerald-500/50 skew-x-[-20deg] translate-x-1/2" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/30 rounded-full blur-3xl" />
            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:justify-between gap-6">
              <div className="relative z-10 max-w-2xl space-y-3 sm:space-y-6 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[8px] sm:text-[10px] font-black text-slate-200 uppercase tracking-widest border border-white/5">
                  Verified Student Account
                </div>
                <h2 className="text-xl sm:text-[32px] font-black text-white tracking-tight leading-tight uppercase">
                  Halo, <span className="text-slate-50 font-medium opacity-100">{student?.name?.split(" ")[0]}</span>
                </h2>
                <p className="text-[10px] sm:text-sm text-slate-100/70 font-bold uppercase tracking-widest leading-relaxed">Selamat datang di gerbang ujian digital Anda hari ini.</p>
              </div>
            </div>
          </motion.div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-6 px-1">
              <div className="w-4 h-4 bg-emerald-600 rounded-full shadow-lg shadow-emerald-200 animate-pulse" />
              <h3 className="text-sm sm:text-base font-black text-emerald-900 dark:text-slate-300 uppercase tracking-[0.3em]">Jadwal Ujian Aktif</h3>
            </div>
          </div>

          {activeRooms.length === 0 ? (
            <div className="py-20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center bg-white dark:bg-slate-900/50">
              <Calendar className="h-10 w-10 text-slate-200 mx-auto mb-4" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Tidak ada jadwal aktif</h3>
            </div>
          ) : (
            <div className="space-y-4">
              {activeRooms.map((room, idx) => {
                const attempt = userAttempts[room.id];
                const isFinished = attempt && (attempt.status === "finished" || attempt.status === "submitted" || attempt.status === "graded");
                const isLocked = attempt && attempt.status === "LOCKED";

                const scale = 1.2 + ((idx * 13) % 5) * 0.1;

                // Palette warna dinamis untuk garis vertikal (Emerald, Teal, Lime, Amber, Rose)
                const lineColors = ['bg-emerald-600', 'bg-teal-600', 'bg-lime-600', 'bg-amber-600', 'bg-rose-600'];
                const myColor = lineColors[idx % lineColors.length];

                return (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={room.id} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                    {/* Aksen Status (Samping) */}
                    <div className={`absolute top-0 left-0 w-1.5 h-full z-20 ${isFinished ? 'bg-slate-300' : myColor
                      }`} />

                    <div className="p-4 sm:p-7 text-left relative z-10">
                      <div className="flex flex-col gap-4 sm:gap-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-2.5">
                          <div className="space-y-0.5 sm:space-y-1.5 flex-1 min-w-0">
                            <span className="text-[9px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] block opacity-80">{room.subject} • {room.examDescription}</span>
                            <h3 className="text-sm sm:text-xl font-extrabold text-[#0f172a] dark:text-white uppercase tracking-tight leading-tight break-words">
                              {room.room_name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                            <div className={`text-[8px] sm:text-xs font-bold uppercase px-2 py-0.5 rounded-md border shadow-sm ${getExamTypeColorClass(room.examType)}`}>
                              {room.examType}
                            </div>
                            <div className="text-[9px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-widest bg-emerald-50/80 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600" />
                              {room.duration}M • {student?.className}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:gap-4 md:grid-cols-2">
                          <div className="bg-slate-50/50 dark:bg-slate-800/40 p-3 sm:p-4 rounded-xl border border-slate-100/50 dark:border-slate-800/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <User className="w-3 h-3 text-emerald-500/70" />
                              <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block">GURU PENGAMPU</label>
                            </div>
                            <span className="text-xs sm:text-base font-bold text-slate-700 dark:text-slate-200 block leading-tight truncate px-5 sm:px-0">{room.teacherName}</span>
                          </div>
                          <div className="bg-slate-50/50 dark:bg-slate-800/40 p-3 sm:p-4 rounded-xl border border-slate-100/50 dark:border-slate-800/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="w-3 h-3 text-emerald-500/70" />
                              <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block">JADWAL PELAKSANAAN</label>
                            </div>
                            <div className="px-5 sm:px-0 space-y-1">
                              <div className="font-bold text-[11px] sm:text-sm tabular-nums text-slate-700 dark:text-slate-200">
                                {new Date(room.startTimeDate).toLocaleDateString("id-ID", { weekday: 'long', day: '2-digit', month: 'short' })}
                              </div>
                              <div className="flex items-center gap-1.5 font-bold text-[9px] sm:text-xs tabular-nums text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md w-fit">
                                <Clock className="w-3 h-3" />
                                {new Date(room.startTimeDate).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} — {new Date(room.endTimeDate).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="w-full pt-4 border-t border-slate-50 dark:border-slate-800/50">
                          {isFinished ? (
                            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-3 rounded-xl flex items-center justify-between">
                              <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase flex items-center gap-2 min-w-0">
                                <ClipboardCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span className="truncate italic opacity-70">Ujian Telah Terkirim</span>
                              </div>
                              <button onClick={() => { sessionStorage.setItem("activeCBTRoomId", room.id); navigate(`/cbt/result`); }} className="text-[10px] sm:text-xs font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest whitespace-nowrap ml-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm transition-all active:scale-95">Detail Hasil</button>
                            </div>
                          ) : isLocked ? (
                            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                              <div className="text-xs font-black text-rose-600 uppercase flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 animate-pulse" />
                                UJIAN TERKUNCI
                              </div>
                              <span className="text-[9px] font-bold text-rose-500/70 uppercase tracking-[0.2em] px-3 py-1 bg-white/50 rounded-full">Harap Lapor Ke Pengawas</span>
                            </div>
                          ) : room.timeStatus === "ongoing" ? (
                            <Button
                              onClick={() => setSelectedRoom(room)}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white h-12 sm:h-14 rounded-xl font-black text-xs sm:text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 dark:shadow-none transition-all active:scale-[0.98]"
                            >
                              {attempt ? "Lanjut Mengerjakan" : "Mulai Ujian"} <ChevronRight className="w-4 h-4" />
                            </Button>
                          ) : room.timeStatus === "expired" ? (
                            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 py-4 rounded-xl text-center">
                              <span className="text-[10px] sm:text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-[0.3em]">WAKTU PELAKSANAAN HABIS</span>
                            </div>
                          ) : (
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 py-4 rounded-xl text-center">
                              <span className="text-[10px] sm:text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.3em]">UJIAN BELUM DIMULAI</span>
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
                <Input value={tokenInput} onChange={(e) => setTokenInput(e.target.value.toUpperCase())} placeholder="AB123" className="h-12 text-center text-xl font-black tracking-[0.3em] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg" disabled={isValidating} />
                {tokenError && <p className="text-rose-500 text-[9px] font-bold mt-2 flex items-center gap-1 uppercase"><AlertCircle className="w-3 h-3" /> {tokenError}</p>}
              </div>
              <div className="bg-emerald-50/50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800"><p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-relaxed font-medium">⚠️ Pastikan koneksi internet stabil sebelum mulai. Pengerjaan Anda akan tercatat secara otomatis.</p></div>
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
