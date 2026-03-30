import { useEffect, useState } from "react";
import { useSiswaAuth } from "../../context/SiswaAuthContext";
import { useAuth } from "../../context/AuthContext"; // wait, the prompt doesn't mix both but maybe just to safe check logout
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ref, onValue, get } from "firebase/database";
import { database } from "../../lib/firebase";
import { LogOut, KeyRound, Calendar, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { getExamTypeColorClass } from "../admin/ExamsPage";

interface ExamRoom {
  id: string;
  examId: string;
  examTitle: string;
  subject: string;
  start_time: string; // ISO 8601 or timestamp
  end_time: string;
  duration: number; // minutes
  status?: string;
}

const SiswaDashboardPage = () => {
  const { siswa, logoutSiswa } = useSiswaAuth();
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState("Computer Based Test");

  // For token dialog
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const [activeRooms, setActiveRooms] = useState<any[]>([]);

  useEffect(() => {
    if (!siswa?.classId) return;

    const examsRef = ref(database, "exams");
    const teachersRef = ref(database, "piket_teachers");
    const subjectsRef = ref(database, "piket_subjects");
    const schoolRef = ref(database, "settings/school");
    
    Promise.all([get(examsRef), get(teachersRef), get(subjectsRef), get(schoolRef)]).then(([examsSnap, teachersSnap, subjectsSnap, schoolSnap]) => {
      const examsData = examsSnap.exists() ? examsSnap.val() : {};
      const teachersData = teachersSnap.exists() ? teachersSnap.val() : {};
      const subjectsData = subjectsSnap.exists() ? subjectsSnap.val() : {};

      if (schoolSnap.exists()) {
        setSchoolName(schoolSnap.val().name || "Computer Based Test");
      }

      // 2. Monitoring Real-Time Ruang Ujian
      const roomsRef = ref(database, "exam_rooms");
      return onValue(roomsRef, (snapshot) => {
        setLoading(true);
        if (snapshot.exists()) {
          const roomsData = snapshot.val();
          const now = Date.now();
          const validRooms: any[] = [];

          Object.keys(roomsData).forEach((key) => {
            const room = roomsData[key];

            if (room.status === "archive" || room.isDisabled) return;

            // ✔️ Validasi Kelas Siswa
            const hasClassAccess = room.allClasses || 
              (room.classId && room.classId.split(",").includes(siswa.classId));
            
            if (!hasClassAccess) return;

            // ✔️ Validasi Jam / Periode Ujian
            const start = new Date(room.start_time).getTime();
            const end = new Date(room.end_time).getTime();
            if (now < start || now > end) return;

            const exam = examsData[room.examId];
            const teacher = exam?.teacherId ? teachersData[exam.teacherId] : null;
            const subject = exam?.subjectId ? subjectsData[exam.subjectId] : null;
            const examType = exam?.examType || "Latihan Biasa";
            validRooms.push({
              id: key,
              ...room,
              examTitle: room.room_name || exam?.title || "Ujian Tanpa Judul",
              subject: subject?.name || "Mata Pelajaran",
              teacherName: teacher?.name || "-",
              examType
            });
          });

          setActiveRooms(validRooms);
        } else {
          setActiveRooms([]);
        }
        setLoading(false);
      });
    });
  }, [siswa?.classId]);

  const handleValidateToken = async () => {
    if (!selectedRoom) return;

    setTokenError("");
    setIsValidating(true);

    try {
      const roomRef = ref(database, `exam_rooms/${selectedRoom.id}`);
      const snapshot = await get(roomRef);
      
      if (!snapshot.exists()) {
        throw new Error("Ruang ujian tidak ditemukan!");
      }

      const roomData = snapshot.val();
      
      // 🔒 Validasi Token dari Database (Hasil rotasi dari sisi Admin)
      const globalTokenRef = ref(database, "settings/universal_token");
      const globalTokenSnap = await get(globalTokenRef);
      const checkToken = globalTokenSnap.exists() ? globalTokenSnap.val() : roomData.token;

      const input = tokenInput.trim().toUpperCase();
      const isValid = checkToken && input === String(checkToken).toUpperCase();

      if (!isValid) {
        throw new Error("Token salah atau sudah kadaluarsa!");
      }
      // Validate Time
      const now = Date.now();
      const startTime = new Date(roomData.start_time).getTime();
      const endTime = new Date(roomData.end_time).getTime();

      if (now < startTime) {
        throw new Error("Ujian belum dimulai!");
      }

      if (now > endTime) {
        throw new Error("Waktu ujian telah berakhir!");
      }

      // Check if attempt exists and is locked
      const attemptRef = ref(database, `attempts/${siswa?.nisn}_${selectedRoom.id}`);
      const attemptSnap = await get(attemptRef);
      if (attemptSnap.exists() && attemptSnap.val().status === "LOCKED") {
        throw new Error("Akun Anda terkunci! Hubungi admin.");
      }

      // Proceed to exam page
      window.location.href = `/cbt/${selectedRoom.id}`;

    } catch (err: any) {
      setTokenError(err.message || "Gagal memverifikasi token.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 shadow-sm px-6 h-16 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="w-1.5 h-6 bg-slate-800 dark:bg-slate-400 rounded-full"></span>
            Computer Based Test - <span className="text-slate-500 font-medium">{schoolName}</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{siswa?.name}</p>
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{siswa?.className || "Siswa"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={logoutSiswa} className="text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-6 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-md bg-card dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-800 shadow-sm space-y-5">
           <div className="text-center space-y-2 pb-2">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full uppercase tracking-[0.2em] border border-emerald-200 dark:border-emerald-800/50">DASHBOARD</span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-5 tracking-[0.1em] italic">UJIAN BERLANGSUNG</h2>
                <div className="h-0.5 w-12 bg-slate-800 dark:bg-slate-400 rounded-full mt-1.5 mb-2 opacity-20"></div>
                <p className="text-xs text-slate-500 max-w-[240px] mx-auto text-center leading-relaxed">
                  Selamat datang <span className="text-slate-900 dark:text-white font-bold">{siswa?.name}</span>, silakan pilih ruang ujian aktif Anda di bawah ini.
                </p>
              </div>
           </div>

           {loading ? (
             <div className="text-center py-6 text-slate-400 text-sm">Memuat ruang ujian...</div>
           ) : activeRooms.length === 0 ? (
             <div className="bg-slate-50 dark:bg-slate-900/30 border border-dashed text-slate-400 text-xs px-3 py-6 rounded-xl text-center font-medium">
                Belum ada ujian aktif yang tersedia untuk kelas Anda saat ini.
             </div>
           ) : (
              <div className="space-y-4">
                {activeRooms.map((room) => (
                  <div key={room.id} className="group p-5 bg-white dark:bg-slate-800/40 rounded-[2rem] border border-slate-200/60 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900 transition-all">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-3 flex-1">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border tracking-wider ${getExamTypeColorClass(room.examType || "")}`}>
                              {room.examType}
                            </span>
                            <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800 uppercase tracking-wider">
                              {room.duration} Menit
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight group-hover:text-blue-600 transition-colors uppercase italic">{room.examTitle}</h3>
                          <p className="text-[11px] font-medium text-slate-500 mt-1 flex items-center gap-2">
                             <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-bold text-slate-700 dark:text-slate-300">{room.subject}</span>
                             <span>•</span>
                             <span>{room.teacherName}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit tabular-nums">
                          <div className="flex items-center gap-1.5 border-r border-slate-300 dark:border-slate-700 pr-2.5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-950 dark:text-white">
                              {new Date(room.start_time).toLocaleDateString("id-ID", { day: '2-digit', month: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              {new Date(room.start_time).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-slate-400 px-0.5">—</span>
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              {new Date(room.end_time).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button 
                        size="sm" 
                        onClick={() => {
                          setSelectedRoom(room);
                          setTokenInput("");
                          setTokenError("");
                        }}
                        className="w-full sm:w-auto bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold h-11 px-8 rounded-2xl shadow-lg shadow-slate-200 dark:shadow-none transition-all active:scale-95"
                      >
                        Mulai
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
           )}
        </div>
      </main>

      {/* Token Verification Dialog */}
      <Dialog open={selectedRoom !== null} onOpenChange={(open) => !open && setSelectedRoom(null)}>
        <DialogContent className="max-w-md bg-card rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" />
              Konfirmasi Mengikuti Ujian
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {tokenError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-lg">
                {tokenError}
              </div>
            )}

            <div className="border rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50 space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500 text-[11px] sm:text-xs">Nisn</span>
                <span className="col-span-2 font-medium text-slate-800 dark:text-slate-200 text-[11px] sm:text-xs">: {siswa?.nisn}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500 text-[11px] sm:text-xs">Nama Lengkap</span>
                <span className="col-span-2 font-medium text-slate-800 dark:text-slate-200 text-[11px] sm:text-xs">: {siswa?.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500 text-[11px] sm:text-xs">Guru/Mapel</span>
                <span className="col-span-2 font-medium text-slate-800 dark:text-slate-200 text-[11px] sm:text-xs">: {selectedRoom?.teacherName} / {selectedRoom?.subject}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500 text-[11px] sm:text-xs">Nama Ruang Ujian</span>
                <span className="col-span-2 font-medium text-slate-800 dark:text-slate-200 text-[11px] sm:text-xs">: {selectedRoom?.examTitle}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500 text-[11px] sm:text-xs">Waktu</span>
                <span className="col-span-2 font-medium text-slate-800 dark:text-slate-200 text-[11px] sm:text-xs">: {selectedRoom?.duration} Menit</span>
              </div>
              <div className="grid grid-cols-3 gap-1 items-center">
                <span className="text-slate-500 text-[11px] sm:text-xs">Token</span>
                <div className="col-span-2 flex items-center">
                  <span className="mr-1 text-[11px] sm:text-xs">:</span>
                  <Input 
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Isi tokennya"
                    className="h-8 text-[11px] sm:text-xs font-bold uppercase w-32 px-2"
                    maxLength={12}
                  />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400">
              Waktu mengerjakan ujian dimulai saat tombol mulai berwarna hijau diakses
            </p>
            <p className="text-[10px] text-red-500 font-medium">
              *Harap diperhatikan JADWAL UJIAN SERTA PEMILIHAN RUANG UJIAN
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRoom(null)}>Batal</Button>
            <Button 
              onClick={handleValidateToken} 
              className="bg-green-600 hover:bg-green-700 text-white" 
              disabled={isValidating || !tokenInput}
            >
              {isValidating ? "Memvalidasi..." : "Mulai"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SiswaDashboardPage;
