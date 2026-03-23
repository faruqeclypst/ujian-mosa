import { useEffect, useState } from "react";
import { useSiswaAuth } from "../../context/SiswaAuthContext";
import { useAuth } from "../../context/AuthContext"; // wait, the prompt doesn't mix both but maybe just to safe check logout
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ref, onValue, get } from "firebase/database";
import { database } from "../../lib/firebase";
import { LogOut, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";

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
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [loading, setLoading] = useState(true);

  // For token dialog
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  // Search Room Code States
  const [searchCode, setSearchCode] = useState("");
  const [searchError, setSearchError] = useState("");
  const [activeRoom, setActiveRoom] = useState<any>(null);

  const handleSearchRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError("");
    setActiveRoom(null);

    const code = searchCode.trim().toUpperCase();
    if (!code) return;

    try {
      const roomsRef = ref(database, "exam_rooms");
      const snapshot = await get(roomsRef);
      
      if (snapshot.exists()) {
        const roomsData = snapshot.val();
        const matchedKey = Object.keys(roomsData).find(
          (k) => roomsData[k].room_code && roomsData[k].room_code.toUpperCase() === code
        );

        if (!matchedKey) {
          throw new Error("Kode ruang ujian tidak terdaftar!");
        }

        const room = roomsData[matchedKey];

        // Validasi Kelas Siswa
        if (!room.allClasses && (!room.classId || !room.classId.split(",").includes(siswa?.classId))) {
          throw new Error("Ruang ujian ini bukan diperuntukkan kelas Anda!");
        }

        // Load Exam Title
        let examTitle = "Ujian Tanpa Judul";
        let subject = "Mapel";
        if (room.examId) {
          const examSnap = await get(ref(database, `exams/${room.examId}`));
          if (examSnap.exists()) {
            examTitle = examSnap.val().title || examTitle;
            subject = examSnap.val().subject || subject;
          }
        }

        setActiveRoom({ id: matchedKey, ...room, examTitle, subject });
        setSelectedRoom({ id: matchedKey, ...room, examTitle }); // Buka dialog token auto
        setTokenInput("");
        setTokenError("");
      } else {
        throw new Error("Belum ada ruang ujian aktif.");
      }
    } catch (err: any) {
      setSearchError(err.message || "Gagal memuat ruang ujian.");
    }
  };

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
      
      const globalTokenRef = ref(database, "settings/universal_token");
      const globalTokenSnap = await get(globalTokenRef);
      const checkToken = globalTokenSnap.exists() ? globalTokenSnap.val() : roomData.token; // fallback

      if (String(checkToken).toUpperCase() !== tokenInput.trim().toUpperCase()) {
        throw new Error("Token salah atau sudah kadaluarsa (token berganti tiap 5 menit)!");
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
      <header className="sticky top-0 z-10 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-800 shadow-sm px-6 h-16 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Computer Based Test</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{siswa?.name}</p>
            <p className="text-xs text-slate-500">{siswa?.className || "Siswa"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={logoutSiswa} className="text-red-500 hover:text-red-600 hover:bg-red-50">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-6 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-800 shadow-sm space-y-5">
           <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Cari Ruang Ujian</h2>
              <p className="text-xs text-slate-500">Masukkan Kode Ruang untuk memulai pengerjaan.</p>
           </div>

           {searchError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2.5 rounded-xl text-center font-medium">
                 {searchError}
              </div>
           )}

           <form onSubmit={handleSearchRoom} className="space-y-4">
              <Input 
                 value={searchCode}
                 onChange={(e) => setSearchCode(e.target.value)}
                 placeholder="Kode Ruang (Contoh: MTK)"
                 className="text-center font-bold text-lg h-12 uppercase tracking-wide rounded-xl"
                 maxLength={20}
              />
              <Button type="submit" className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 font-bold rounded-xl text-white shadow-md">
                 Masuk Ruangan
              </Button>
           </form>
           
           {activeRoom && (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-dashed flex justify-between items-center text-xs">
                 <div>
                    <p className="font-semibold text-slate-700">{activeRoom.examTitle}</p>
                    <p className="text-slate-500">{activeRoom.subject}</p>
                 </div>
                 <Button size="sm" onClick={() => setSelectedRoom(activeRoom)}>Validasi Token</Button>
              </div>
           )}
        </div>
      </main>

      {/* Token Verification Dialog */}
      <Dialog open={selectedRoom !== null} onOpenChange={(open) => !open && setSelectedRoom(null)}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" />
              Masukkan Token Ujian
            </DialogTitle>
            <CardDescription>
              Ujian: {selectedRoom?.examTitle}
            </CardDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {tokenError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-lg">
                {tokenError}
              </div>
            )}

            <Input 
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Masukkan Token dari Pengawas"
              className="text-center font-bold text-lg tracking-widest uppercase h-12"
              maxLength={12}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRoom(null)}>Batal</Button>
            <Button 
              onClick={handleValidateToken} 
              className="bg-blue-600 hover:bg-blue-700" 
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
