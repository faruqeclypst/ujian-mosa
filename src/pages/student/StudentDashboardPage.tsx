import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import pb from "../../lib/pocketbase";
import { LogOut, KeyRound, Calendar, Clock, ChevronRight, User, BookOpen, AlertCircle, ClipboardCheck, Award } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
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
        attempts.forEach(att => { myStatus[att.examRoomId] = att; });
        setUserAttempts(myStatus);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const unsubR = pb.collection("exam_rooms").subscribe("*", () => fetchData());
    const unsubA = pb.collection("attempts").subscribe("*", () => fetchData());
    return () => { pb.collection("exam_rooms").unsubscribe(); pb.collection("attempts").unsubscribe(); };
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-20 sm:pb-0">
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl border-b border-slate-100 dark:border-slate-800 h-16 sm:h-20 px-4 sm:px-10 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
           <div className="p-1 sm:p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm shrink-0">
            {schoolLogo ? <img src={schoolLogo} className="h-6 w-6 sm:h-9 sm:w-9 object-contain" alt="Logo" /> : <div className="h-6 w-6 sm:h-9 sm:w-9 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />}
          </div>
          <div className="flex flex-col -space-y-0.5 sm:-space-y-1">
             <h1 className="text-sm sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight whitespace-nowrap">
               {schoolName}
             </h1>
             <span className="text-[8px] sm:text-[10px] font-black text-emerald-600 dark:text-emerald-400/80 uppercase tracking-[0.2em] sm:tracking-[0.3em]">
               Digital Examination
             </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
           <div className="flex items-center gap-2 sm:gap-4 pr-3 sm:pr-5 border-r border-slate-100 dark:border-slate-800">
              <div className="text-right min-w-0 hidden sm:block">
                <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-snug uppercase">{student?.name?.split(" ")[0]}</p>
                <div className="inline-block px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-md text-[9px] font-black text-emerald-600 dark:text-emerald-400 mt-2 leading-none uppercase tracking-widest border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm">
                   Class {student?.className}
                </div>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl sm:rounded-2xl flex items-center justify-center border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm group">
                 <User className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-left min-w-0 block sm:hidden">
                <p className="text-[12px] font-black text-slate-800 dark:text-white leading-tight uppercase">{student?.name?.split(" ")[0]}</p>
                <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 uppercase tracking-widest">{student?.className}</p>
              </div>
           </div>
           <button onClick={logoutStudent} className="p-2.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-2xl transition-all active:scale-90" title="Sign Out">
              <LogOut className="h-5 w-5" />
           </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-10">
        <div className="space-y-8 sm:space-y-12">
           <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative bg-emerald-600 rounded-[35px] sm:rounded-[50px] p-8 sm:p-16 overflow-hidden shadow-2xl shadow-emerald-100">
                  <div className="absolute top-0 right-0 w-1/2 h-full bg-emerald-500/50 skew-x-[-20deg] translate-x-1/2" />
                  <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/30 rounded-full blur-3xl" />
                  <div className="relative z-10 flex flex-col sm:flex-row items-center sm:justify-between gap-6">
                    <div className="relative z-10 max-w-2xl space-y-4 sm:space-y-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black text-slate-200 uppercase tracking-widest border border-white/5">
                         Verified Student Account
                      </div>
                      <h2 className="text-2xl sm:text-[32px] font-black text-white tracking-tight leading-tight uppercase">
                         Halo 👋, <span className="text-slate-300">{student?.name?.split(" ")[0]}</span>
                      </h2>
                      <p className="text-[12px] sm:text-sm text-slate-100/70 font-bold uppercase tracking-widest leading-relaxed">Selamat datang di gerbang ujian digital Anda hari ini.</p>
                    </div>
                    <div className="w-20 h-20 sm:w-28 sm:h-28 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl shrink-0 group-hover:scale-110 transition-transform">
                        <ClipboardCheck className="w-10 h-10 sm:w-14 sm:h-14 text-white" />
                    </div>
                  </div>
           </motion.div>

           <div className="space-y-2">
              <div className="flex items-center gap-3 mb-6 px-1">
                 <div className="w-4 h-4 bg-emerald-600 rounded-full shadow-lg shadow-emerald-200 animate-pulse" />
                 <h3 className="text-sm sm:text-base font-black text-emerald-900 dark:text-slate-300 uppercase tracking-[0.3em]">Jadwal Ujian Aktif</h3>
              </div>
           </div>

           {loading ? (
             <div className="py-20 text-center text-slate-400 text-xs animate-pulse font-bold uppercase tracking-widest">Memuat Data...</div>
           ) : activeRooms.length === 0 ? (
             <div className="py-20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center bg-white dark:bg-slate-900/50">
                <Calendar className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Tidak ada jadwal aktif</h3>
             </div>
           ) : (
             <div className="space-y-4">
                {activeRooms.map((room, idx) => {
                  const attempt = userAttempts[room.id];
                  const isFinished = attempt && (attempt.status === "finished" || attempt.status === "submitted" || attempt.status === "graded");
                  
                  const scale = 1.2 + ((idx * 13) % 5) * 0.1;
                  
                  // Palette warna dinamis untuk garis vertikal (Emerald, Teal, Lime, Amber, Rose)
                  const lineColors = ['bg-emerald-600', 'bg-teal-600', 'bg-lime-600', 'bg-amber-600', 'bg-rose-600'];
                  const myColor = lineColors[idx % lineColors.length];

                  return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={room.id} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                       {/* Aksen Status (Samping) */}
                       <div className={`absolute top-0 left-0 w-1.5 h-full z-20 ${
                         isFinished ? 'bg-slate-300' : myColor
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

                             <div className="grid grid-cols-1 gap-2 sm:gap-4 sm:grid-cols-2">
                                 <div className="bg-slate-50/50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100/50 dark:border-slate-800/50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <div className="flex items-center gap-2 mb-1">
                                       <User className="w-3 h-3 text-emerald-500/70" />
                                       <label className="text-[8px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">GURU PENGAMPU</label>
                                    </div>
                                    <span className="text-xs sm:text-base font-bold text-slate-700 dark:text-slate-300 ml-5 block leading-tight">{room.teacherName}</span>
                                 </div>
                                 <div className="bg-slate-50/50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100/50 dark:border-slate-800/50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <div className="flex items-center gap-2 mb-1">
                                       <Calendar className="w-3 h-3 text-emerald-500/70" />
                                       <label className="text-[8px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">JADWAL PELAKSANAAN</label>
                                    </div>
                                    <div className="ml-5 space-y-1">
                                       <div className="font-bold text-[10px] sm:text-sm tabular-nums text-slate-700 dark:text-slate-300">
                                          {new Date(room.startTimeDate).toLocaleDateString("id-ID", { weekday: 'long', day: '2-digit', month: 'short' })}
                                       </div>
                                       <div className="flex items-center gap-1.5 font-bold text-[10px] sm:text-sm tabular-nums text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md w-fit">
                                          <Clock className="w-3 h-3" />
                                          {new Date(room.startTimeDate).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} — {new Date(room.endTimeDate).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                                       </div>
                                    </div>
                                 </div>
                             </div>

                             <div className="w-full pt-4 border-t border-slate-50 dark:border-slate-800/50">
                                {isFinished ? (
                                  <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 p-3 rounded-lg flex items-center justify-between">
                                     <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase flex items-center gap-2 min-w-0">
                                        <ClipboardCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span className="truncate">Selesai Dikirim</span>
                                     </div>
                                     <button onClick={() => { sessionStorage.setItem("activeCBTRoomId", room.id); navigate(`/cbt/result`); }} className="text-[11px] sm:text-xs font-bold text-emerald-600 hover:underline uppercase tracking-wider whitespace-nowrap ml-2">Detail Hasil</button>
                                  </div>
                                ) : room.timeStatus === "ongoing" ? (
                                  <Button 
                                    onClick={() => setSelectedRoom(room)}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white h-11 sm:h-12 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm"
                                  >
                                    Mulai Ujian <ChevronRight className="w-3.5 h-3.5" />
                                  </Button>
                                ) : room.timeStatus === "expired" ? (
                                  <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 py-3 rounded-lg text-center">
                                     <span className="text-[10px] sm:text-xs font-bold text-rose-600 uppercase tracking-widest">WAKTU BERAKHIR</span>
                                  </div>
                                ) : (
                                  <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 py-3 rounded-lg text-center">
                                     <span className="text-[10px] sm:text-xs font-bold text-amber-600 uppercase tracking-widest">BELUM DIMULAI</span>
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
