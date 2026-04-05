import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import pb from "../../lib/pocketbase";
import { LogOut, KeyRound, Calendar, Clock, ChevronRight, User, BookOpen, AlertCircle, ClipboardCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { motion } from "framer-motion";

const getExamTypeColorClass = (type: string) => {
  switch (type?.toLowerCase()) {
    case "uh": case "ulangan harian": return "bg-blue-50 text-blue-700 border-blue-100";
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
        return { ...room, examTitle: room.room_name || exam?.title || "Ujian", subject: exam?.expand?.subjectId?.name || "Mapel", teacherName: exam?.expand?.teacherId?.name || "-", examType: exam?.examType || "Latihan", timeStatus, startTimeDate: start, endTimeDate: end };
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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-1 sm:p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shrink-0">
            {schoolLogo ? <img src={schoolLogo} className="h-6 w-6 sm:h-8 sm:w-8 object-contain" alt="Logo" /> : <div className="h-6 w-6 sm:h-8 sm:w-8 bg-slate-200 dark:bg-slate-700 rounded" />}
          </div>
          <div className="flex flex-col -space-y-0.5 sm:-space-y-1">
             <h1 className="text-[13px] sm:text-lg font-extrabold text-[#0f172a] dark:text-white uppercase tracking-tight whitespace-nowrap">
               {schoolName}
             </h1>
             <span className="text-[8px] sm:text-[11px] font-bold text-blue-600/70 dark:text-blue-400/70 uppercase tracking-[0.1em] sm:tracking-[0.2em]">
               Computer Based Test
             </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
           <div className="flex items-center gap-2 sm:gap-3.5 pr-2 sm:pr-3 border-r border-slate-100 dark:border-slate-800">
              <div className="text-right min-w-0 hidden sm:block">
                <p className="text-sm font-semibold text-[#0f172a] dark:text-slate-200 leading-none truncate max-w-[150px]">{student?.name}</p>
                <div className="inline-block px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500 mt-1.5 leading-none">
                  {student?.className}
                </div>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center border border-blue-100 dark:border-blue-800 shadow-sm shrink-0">
                 <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left min-w-0 block sm:hidden">
                <p className="text-[13px] font-bold text-[#0f172a] dark:text-slate-200 leading-none truncate max-w-[100px]">{student?.name}</p>
                <p className="text-[10px] font-semibold text-blue-500 mt-0.5 leading-none">{student?.className}</p>
              </div>
           </div>
           <button onClick={logoutStudent} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full transition-all active:scale-90" title="Keluar">
              <LogOut className="h-5 w-5" />
           </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-6 sm:space-y-10">
           {/* Welcome Banner Formal - Compact on Mobile */}
           <div className="pb-4 sm:pb-8 border-b border-slate-200/60 dark:border-slate-800">
              <div className="flex flex-col gap-1 sm:gap-2 text-left">
                 <span className="text-[10px] sm:text-[11px] font-bold text-blue-600 dark:text-blue-400 tracking-wide uppercase">Dashboard Siswa</span>
                 <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white tracking-tight leading-tight">
                    Selamat Mengerjakan, <span className="text-blue-600">{student?.name}</span>
                 </h2>
                 <p className="text-[13px] sm:text-base text-slate-500 font-medium leading-normal">Semoga sukses dengan ujian Anda hari ini.</p>
              </div>
           </div>

           <div className="space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 mb-2 sm:mb-4 uppercase tracking-wider">Jadwal Ujian Aktif</h3>
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
                  
                  // Variasi acak berbasis index agar tiap kartu unik
                  const rotation = (idx * 37) % 45;
                  const offsetX = (idx * 59) % 150;
                  const offsetY = (idx * 83) % 100;
                  const scale = 1.2 + ((idx * 13) % 5) * 0.1;

                  return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={room.id} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                       {/* Aksen Status (Samping) */}
                       <div className={`absolute top-0 left-0 w-1 h-full z-20 ${
                         isFinished ? 'bg-slate-300' : (room.timeStatus === 'ongoing' ? 'bg-blue-600' : 'bg-slate-200')
                       }`} />

                       {/* Background Pattern Doodle (Bergerak & Acak tiap kartu) */}
                       <motion.div 
                          initial={{ rotate: rotation }}
                          animate={{ 
                            x: [offsetX, offsetX - 20, offsetX],
                            y: [offsetY, offsetY - 20, offsetY] 
                          }}
                          transition={{ 
                            duration: 20 + (idx % 10), 
                            repeat: Infinity, 
                            ease: "linear" 
                          }}
                          className="absolute inset-0 z-0 opacity-[0.06] dark:opacity-[0.02] pointer-events-none overflow-hidden select-none"
                       >
                          <svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" 
                             style={{ transform: `scale(${scale})` }}
                             className="absolute top-0 left-0 w-[250%] h-[250%] origin-center"
                          >
                            <path d="M40 40h20v20H40V40zm60 60h20v20h-20v-20zM20 140h10v10H20v-10zm140-100h15v15h-15V40zM80 20h10v10H80V20zm80 140h10v10h-10v-10z" fill="currentColor" fillRule="evenodd" />
                            <rect x="20" y="80" width="10" height="15" rx="1" fill="currentColor" transform="rotate(-15 20 80)" />
                            <rect x="150" y="100" width="12" height="18" rx="1" fill="currentColor" transform="rotate(25 150 100)" />
                            <circle cx="100" cy="40" r="4" fill="currentColor" />
                            <path d="M120 160l10-5 5 10-10 5z" fill="currentColor" />
                            <rect x="50" y="150" width="20" height="4" rx="2" fill="currentColor" transform="rotate(45 50 150)" />
                            <path d="M240 240h20v20h-20v-20zM220 340h10v10h-10v-10z" fill="currentColor" />
                            <circle cx="300" cy="240" r="4" fill="currentColor" />
                          </svg>
                       </motion.div>

                       <div className="p-5 sm:p-7 text-left relative z-10">
                          <div className="flex flex-col gap-5 sm:gap-6">
                             <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1 sm:space-y-1.5 flex-1 min-w-0">
                                   <span className="text-[11px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">{room.subject}</span>
                                   <h3 className="text-lg sm:text-xl font-bold text-[#0f172a] dark:text-white uppercase tracking-tight leading-tight truncate">
                                      {room.examTitle}
                                   </h3>
                                </div>
                                <div className="flex items-center sm:flex-col sm:items-end gap-2 shrink-0">
                                   <div className={`text-[10px] sm:text-xs font-bold uppercase px-2 py-0.5 rounded border ${getExamTypeColorClass(room.examType)}`}>
                                      {room.examType}
                                   </div>
                                   <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                                      {room.duration}M
                                   </div>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                   <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Guru:</label>
                                   <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                      <User className="w-3.5 h-3.5 text-slate-400" />
                                      <span className="text-sm sm:text-base font-semibold">{room.teacherName}</span>
                                   </div>
                                </div>
                                <div className="space-y-1">
                                   <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Jadwal:</label>
                                   <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                                      <div className="flex items-center gap-1.5 font-bold text-[11px] sm:text-sm tabular-nums">
                                         <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                         {new Date(room.startTimeDate).toLocaleDateString("id-ID", { day: '2-digit', month: 'short' })}
                                      </div>
                                      <div className="flex items-center gap-1.5 font-bold text-[11px] sm:text-sm tabular-nums">
                                         <Clock className="w-3.5 h-3.5 text-slate-400" />
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
                                     <button onClick={() => { sessionStorage.setItem("activeCBTRoomId", room.id); navigate(`/cbt/result`); }} className="text-[11px] sm:text-xs font-bold text-blue-600 hover:underline uppercase tracking-wider whitespace-nowrap ml-2">Detail Hasil</button>
                                  </div>
                                ) : room.timeStatus === "ongoing" ? (
                                  <Button 
                                    onClick={() => setSelectedRoom(room)}
                                    className="w-full bg-[#1e293b] hover:bg-[#0f172a] dark:bg-blue-600 dark:hover:bg-blue-500 text-white h-11 sm:h-12 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm"
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
           <div className="bg-slate-900 px-6 py-8 text-white relative">
              <div className="absolute top-0 right-0 p-4 opacity-10"><KeyRound className="w-16 h-16" /></div>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold uppercase tracking-tight">Verifikasi Akses</DialogTitle>
                <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest mt-1">Masukkan Token Ruangan</p>
              </DialogHeader>
           </div>
           <div className="p-8 space-y-6">
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Token Ujian</label>
                    <Input value={tokenInput} onChange={(e) => setTokenInput(e.target.value.toUpperCase())} placeholder="AB123" className="h-12 text-center text-xl font-black tracking-[0.3em] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg" disabled={isValidating} />
                    {tokenError && <p className="text-rose-500 text-[9px] font-bold mt-2 flex items-center gap-1 uppercase"><AlertCircle className="w-3 h-3" /> {tokenError}</p>}
                 </div>
                 <div className="bg-blue-50/50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800"><p className="text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed font-medium">⚠️ Pastikan koneksi internet stabil sebelum mulai. Pengerjaan Anda akan tercatat secara otomatis.</p></div>
              </div>
              <DialogFooter>
                <Button onClick={handleValidateToken} disabled={!tokenInput || isValidating} className="w-full h-12 bg-slate-900 dark:bg-blue-600 text-white rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95">{isValidating ? "Memverifikasi..." : "Konfirmasi & Masuk"}</Button>
              </DialogFooter>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentDashboardPage;
