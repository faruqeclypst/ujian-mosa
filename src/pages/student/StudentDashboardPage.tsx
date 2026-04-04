import { useEffect, useState } from "react";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ref, onValue, get } from "firebase/database";
import { database } from "../../lib/firebase";
import { LogOut, KeyRound, Calendar, Clock, ChevronRight, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { getExamTypeColorClass } from "../admin/ExamsPage";
import { motion } from "framer-motion";

const StudentDashboardPage = () => {
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

  useEffect(() => {
    if (!student?.classId) return;

    let unsubRooms: (() => void) | null = null;

    const init = async () => {
      try {
        const [examsSnap, teachersSnap, subjectsSnap, schoolSnap] = await Promise.all([
          get(ref(database, "exams")),
          get(ref(database, "teachers")),
          get(ref(database, "subjects")),
          get(ref(database, "settings/school"))
        ]);

        const examsData = examsSnap.exists() ? examsSnap.val() : {};
        const teachersData = teachersSnap.exists() ? teachersSnap.val() : {};
        const subjectsData = subjectsSnap.exists() ? subjectsSnap.val() : {};

        if (schoolSnap.exists()) {
          const sData = schoolSnap.val();
          setSchoolName(sData.name || "CBT System");
          setSchoolLogo(sData.logoUrl || "");
        }

        unsubRooms = onValue(ref(database, "exam_rooms"), (snapshot) => {
          if (snapshot.exists()) {
            const roomsData = snapshot.val();
            const now = Date.now();
            const validRooms: any[] = [];

            Object.keys(roomsData).forEach((key) => {
              const room = roomsData[key];
              if (room.status === "archive" || room.isDisabled) return;

              const hasClassAccess = room.allClasses ||
                (room.classId && room.classId.split(",").includes(student.classId));

              if (!hasClassAccess) return;

              const start = new Date(room.start_time).getTime();
              const end = new Date(room.end_time).getTime();
              if (now < start || now > end) return;

              const exam = examsData[room.examId];
              const teacher = exam?.teacherId ? teachersData[exam.teacherId] : null;
              const subject = exam?.subjectId ? subjectsData[exam.subjectId] : null;

              validRooms.push({
                id: key,
                ...room,
                examTitle: room.room_name || exam?.title || "Ujian",
                subject: subject?.name || "Mapel",
                teacherName: teacher?.name || "-",
                examType: exam?.examType || "Latihan"
              });
            });

            setActiveRooms(validRooms);
          } else {
            setActiveRooms([]);
          }
          setLoading(false);
        });
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    init();
    return () => {
      if (unsubRooms) unsubRooms();
    };
  }, [student?.classId]);

  useEffect(() => {
    if (!student || activeRooms.length === 0) return;
    const unsubAttempts = onValue(ref(database, "attempts"), (snap) => {
      if (snap.exists()) {
        const all = snap.val();
        const myStatus: Record<string, any> = {};
        activeRooms.forEach(r => {
          if (all[r.id] && all[r.id][student.nisn]) myStatus[r.id] = all[r.id][student.nisn].status;
        });
        setUserAttempts(myStatus);
      }
    });
    return () => unsubAttempts();
  }, [student, activeRooms]);

  const handleValidateToken = async () => {
    if (!selectedRoom) return;
    setTokenError("");
    setIsValidating(true);
    try {
      const roomRef = ref(database, `exam_rooms/${selectedRoom.id}`);
      const snapshot = await get(roomRef);
      const roomData = snapshot.val();
      const globalTokenSnap = await get(ref(database, "settings/universal_token"));
      const checkToken = globalTokenSnap.exists() ? globalTokenSnap.val() : roomData.token;

      if (tokenInput.trim().toUpperCase() !== String(checkToken).toUpperCase()) {
        throw new Error("Token salah!");
      }

      const attemptSnap = await get(ref(database, `attempts/${selectedRoom.id}/${student?.nisn}`));
      if (attemptSnap.exists() && attemptSnap.val().status === "LOCKED") throw new Error("Akun Terkunci!");

      window.location.href = `/cbt/${selectedRoom.id}`;
    } catch (err: any) {
      setTokenError(err.message);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200/50 dark:border-slate-800/50 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
           <div className="p-1.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
             {schoolLogo ? (
               <img src={schoolLogo} className="h-6 w-6 object-contain" alt="Logo" />
              ) : (
                <div className="h-6 w-6 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
              )}
           </div>
           <h1 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-2">
             CBT <span className="w-px h-3 bg-slate-300 dark:bg-slate-700 mx-1"></span> 
             <span className="text-slate-500 font-medium normal-case tracking-normal truncate max-w-[150px] sm:max-w-none">{schoolName}</span>
           </h1>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
             <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center border border-white dark:border-slate-700 shadow-sm overflow-hidden">
                <User className="h-4 w-4 text-slate-500" />
             </div>
             <div className="text-left hidden sm:block">
               <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-none">{student?.name}</p>
               <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{student?.className}</p>
             </div>
           </div>
           <button 
             onClick={logoutStudent} 
             className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all active:scale-90"
             title="Log Out"
           >
              <LogOut className="h-4 w-4" />
           </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-6 sm:py-12">
        <div className="space-y-6">
          <div className="text-center space-y-1.5 mb-8">
             <h2 className="text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">Ujian Berlangsung</h2>
             <p className="text-[12px] text-slate-500 font-medium">Pilih ruang ujian aktif Anda di bawah ini</p>
          </div>

          {loading ? (
             <div className="text-center py-12 text-slate-300 text-xs animate-pulse">Menghubungkan ke server...</div>
          ) : activeRooms.length === 0 ? (
             <div className="py-20 px-10 border border-slate-200/50 dark:border-slate-800/50 rounded-[3rem] text-center bg-white/50 dark:bg-slate-900/50 shadow-sm backdrop-blur-sm">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                  <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Tidak Ada Ujian</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Belum ada ruang ujian aktif yang ditujukan untuk kelas Anda saat ini.</p>
             </div>
          ) : (
            <div className="space-y-4">
              {activeRooms.map((room) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={room.id} 
                  className="p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div className="space-y-4 flex-1 min-w-0">
                      <div>
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                           <span className={`text-[10px] font-black px-3 py-1 rounded-full border shadow-sm ${getExamTypeColorClass(room.examType)}`}>
                             {room.examType}
                           </span>
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] bg-slate-50 dark:bg-slate-800/50 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-800">
                             {room.duration} MENIT
                           </span>
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white truncate uppercase tracking-tight leading-none mb-1.5">
                          {room.examTitle}
                        </h3>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase">
                           <span className="text-indigo-600 dark:text-indigo-400 tracking-wider bg-indigo-50/50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-lg border border-indigo-100/50 dark:border-indigo-900/30">{room.subject}</span>
                           <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                           <span className="tracking-tight">{room.teacherName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] font-black tracking-tight tabular-nums">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-sm">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(room.start_time).toLocaleDateString("id-ID", { day: '2-digit', month: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100/80 dark:border-slate-800 shadow-sm">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-emerald-600 dark:text-emerald-400">{new Date(room.start_time).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-slate-300 mx-0.5">—</span>
                          <span className="text-rose-600 dark:text-rose-400">{new Date(room.end_time).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 w-full sm:w-auto">
                      {userAttempts[room.id] === "submitted" ? (
                        <div className="h-14 px-8 flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-black text-xs rounded-2xl border border-emerald-100 dark:border-emerald-900/40 w-full sm:w-auto uppercase tracking-widest shadow-inner">
                           Sudah Terkirim
                        </div>
                      ) : (
                        <Button 
                          onClick={() => { setSelectedRoom(room); setTokenInput(""); setTokenError(""); }}
                          className="h-14 px-10 rounded-2xl bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-950 text-white font-black text-xs uppercase tracking-[0.2em] w-full sm:w-auto transition-all active:scale-95 shadow-xl shadow-slate-900/10 dark:shadow-white/5 flex items-center justify-center group"
                        >
                          Mulai <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={selectedRoom !== null} onOpenChange={(o) => !o && setSelectedRoom(null)}>
        <DialogContent className="max-w-sm bg-white dark:bg-slate-950 rounded-[2.5rem] p-0 border-none shadow-[0_20px_70px_rgba(0,0,0,0.2)] overflow-hidden">
          <div className="p-8">
            <DialogHeader className="relative">
              <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center mb-6 mx-auto border border-slate-100 dark:border-slate-800 shadow-sm relative">
                <KeyRound className="h-7 w-7 text-slate-800 dark:text-slate-200" />
                <div className="absolute -inset-1 bg-indigo-500/10 blur-xl rounded-full" />
              </div>
              <DialogTitle className="text-lg font-extrabold text-center text-slate-900 dark:text-white uppercase tracking-tight">
                Konfirmasi Akses
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 pt-6">
              <div className="space-y-0.5 p-1 bg-slate-50/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm overflow-hidden">
                 <div className="flex justify-between items-center p-3 px-4">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Siswa</span>
                   <span className="text-[11px] text-slate-800 dark:text-white font-black uppercase text-right leading-none">{student?.name}</span>
                 </div>
                 <div className="h-px bg-slate-200/50 dark:bg-slate-800/50 mx-4" />
                 <div className="flex justify-between items-center p-3 px-4">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Ruangan</span>
                   <span className="text-[11px] text-slate-800 dark:text-white font-black uppercase text-right truncate ml-6 leading-none">{selectedRoom?.examTitle}</span>
                 </div>
              </div>

              <div className="space-y-2.5">
                 <div className="flex items-center justify-between px-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">TOKEN</label>
                   {tokenError && <span className="text-[9px] text-rose-500 font-bold uppercase tracking-tighter px-2 py-0.5 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-100 dark:border-rose-900/30">{tokenError}</span>}
                 </div>
                 <Input
                   value={tokenInput}
                   onChange={(e) => { 
                     setTokenInput(e.target.value.toUpperCase()); 
                     if (tokenError) setTokenError("");
                   }}
                   placeholder="KETIK TOKEN"
                   className={`h-14 bg-white dark:bg-slate-900 border-[2.5px] ${tokenError ? 'border-rose-500/50 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-900 dark:focus:border-white'} rounded-2xl text-center font-extrabold tracking-[0.3em] uppercase text-slate-950 dark:text-white transition-all text-lg shadow-inner focus:ring-0`}
                   maxLength={12}
                   autoFocus
                 />
              </div>

              <DialogFooter className="flex flex-col gap-3 pt-2">
                <Button 
                  onClick={handleValidateToken} 
                  disabled={isValidating || !tokenInput} 
                  className={`w-full h-12 ${isValidating ? 'bg-slate-200 dark:bg-slate-800' : 'bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-500'} text-white font-extrabold text-[11px] rounded-xl uppercase tracking-[0.15em] shadow-lg shadow-slate-900/5 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center`}
                >
                  {isValidating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>MEMVERIFIKASI...</span>
                    </div>
                  ) : "MULAI UJIAN"}
                </Button>
                <button 
                  onClick={() => setSelectedRoom(null)} 
                  className="w-full py-2 text-[10px] font-black text-slate-400 hover:text-slate-900 dark:hover:text-white uppercase tracking-widest transition-colors active:scale-95"
                >
                  BATAL
                </button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentDashboardPage;
