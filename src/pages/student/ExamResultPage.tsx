import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStudentAuth } from "../../context/StudentAuthContext";
import pb from "../../lib/pocketbase";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ClipboardCheck, FileText, LayoutDashboard, User, BookOpen, Clock } from "lucide-react";

interface ExamAttempt {
  status: string;
  score: number;
  correct: number;
  total: number;
  startedAt?: string;
  submittedAt?: string;
  usedTime?: number;
}

const ExamResultPage = () => {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const { student } = useStudentAuth();
  const navigate = useNavigate();

  // 🛡️ URL MASKING LOGIC
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (paramRoomId) {
      // 1. Jika ada di URL, simpan dan hilangkan dari URL
      sessionStorage.setItem("activeCBTRoomId", paramRoomId);
      setRoomId(paramRoomId);
      navigate("/cbt/result", { replace: true });
    } else {
      // 2. Jika tidak ada di URL, ambil dari storage
      const saved = sessionStorage.getItem("activeCBTRoomId");
      if (saved) {
        setRoomId(saved);
      } else {
        // 3. Jika benar-benar tidak ada, kembali ke dashboard
        navigate("/", { replace: true });
      }
    }
  }, [paramRoomId, navigate]);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [roomData, setRoomData] = useState<any>(null);
  const [showResult, setShowResult] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!student || !roomId) return;

    const loadResult = async () => {
      try {
        setLoading(true);
        const rData = await pb.collection("exam_rooms").getOne(roomId, {
          expand: "examId,examId.subjectId"
        });
        setRoomData(rData);
        setShowResult(rData.show_result !== false);

        const records = await pb.collection("attempts").getFullList({
          filter: `studentId = "${student.id}" && examRoomId = "${roomId}"`,
          sort: "-created",
          limit: 1
        });

        if (records.length > 0) {
          const a = records[0];
          setAttempt({
            status: a.status,
            score: a.score ?? a.scoreValue ?? 0,
            correct: a.correct ?? a.correctCount ?? 0,
            total: a.total ?? a.totalQuestions ?? 0,
            startedAt: a.startedAt,
            submittedAt: a.submittedAt,
            usedTime: a.usedTime
          });
        }
      } catch (err) {
        console.error("Gagal memuat hasil ujian:", err);
      } finally {
        setLoading(false);
      }
    };
    loadResult();
  }, [student, roomId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-slate-50">
        <FileText className="h-16 w-16 text-slate-300 mb-4" />
        <p className="text-slate-600 font-bold uppercase tracking-tight">Data hasil ujian tidak ditemukan.</p>
        <Button onClick={() => navigate("/")} variant="outline" className="mt-6">
           Kembali ke Dashboard
        </Button>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} menit ${secs} detik`;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 text-slate-900">
      <Card className="w-full max-w-2xl bg-white rounded-none border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-[#1e293b] w-full" />
        
        <CardHeader className="pt-10 pb-6 px-10 border-b border-slate-100">
          <div className="flex justify-between items-start text-left">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">LAPORAN HASIL UJIAN ONLINE</span>
              <CardTitle className="text-2xl font-bold text-[#0f172a]">{roomData?.room_name || "Detail Ujian"}</CardTitle>
              <div className="flex items-center gap-3 text-slate-500 text-xs">
                <span className="flex items-center gap-1 font-semibold"><BookOpen className="w-3.5 h-3.5 text-blue-600" /> {roomData?.expand?.examId?.expand?.subjectId?.name || "Mata Pelajaran"}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(attempt.submittedAt || "").toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
            <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-100">
               <ClipboardCheck className="text-blue-900 w-6 h-6" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-10 space-y-8">
          <div className="grid grid-cols-2 gap-6 pb-6 border-b border-slate-50">
             <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Nama Peserta</label>
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                   <User className="w-3.5 h-3.5 text-blue-400" />
                   <span className="text-sm">{student?.name}</span>
                </div>
             </div>
             <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Nomor Induk / NISN</label>
                <div className="text-slate-800 font-bold text-sm">
                   {student?.nisn}
                </div>
             </div>
          </div>

          {showResult ? (
            <div className="space-y-8">
              <div className="flex items-center justify-between p-8 bg-blue-50/30 border border-blue-100/50 rounded-lg">
                <div className="space-y-1 text-left">
                   <h3 className="text-sm font-bold text-[#1e293b] uppercase tracking-tight">Capaian Skor Akhir</h3>
                   <p className="text-xs text-slate-500 font-medium">Hasil rekapitulasi nilai otomatis.</p>
                </div>
                <div className="text-center">
                  <div className="text-5xl font-bold text-[#1e293b] leading-none tracking-tighter">{attempt.score}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-1">Poin / 100</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 text-left">
                 <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">Benar</span>
                    <div className="text-xl font-bold text-emerald-600">{attempt.correct}</div>
                    <div className="h-1 w-full bg-emerald-100 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500" style={{ width: `${(attempt.correct / (attempt.total || 1)) * 100}%` }} />
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">Salah</span>
                    <div className="text-xl font-bold text-rose-600">{(attempt.total || 0) - (attempt.correct || 0)}</div>
                    <div className="h-1 w-full bg-rose-100 rounded-full overflow-hidden">
                       <div className="h-full bg-rose-500" style={{ width: `${(((attempt.total || 0) - (attempt.correct || 0)) / (attempt.total || 1)) * 100}%` }} />
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">Durasi</span>
                    <div className="text-[13px] font-bold text-slate-700 leading-[1.75rem]">{attempt.usedTime ? formatTime(attempt.usedTime) : "-"}</div>
                 </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-4">
               <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto border border-blue-100">
                  <ClipboardCheck className="w-8 h-8 text-blue-400" />
               </div>
               <div className="space-y-2">
                  <h3 className="font-bold text-[#1e293b] text-lg uppercase tracking-tight">Jawaban Telah Terkirim</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed font-medium">
                    Terima kasih telah mengikuti ujian. Nilai Anda telah tercatat dengan aman di server kami.
                  </p>
               </div>
            </div>
          )}

          <div className="pt-8 border-t border-slate-100">
             <Button onClick={() => navigate("/")} className="w-full bg-[#1e293b] hover:bg-[#0f172a] text-white h-12 rounded-lg font-bold text-[11px] uppercase tracking-widest transition-all active:scale-[0.98] shadow-sm">
               Kembali ke Dashboard
             </Button>
          </div>
        </CardContent>
        <div className="bg-slate-50 px-10 py-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-bold italic">
           <span>Sistem Informasi Ujian Online</span>
           <span>Rekapitulasi Otomatis</span>
        </div>
      </Card>
    </div>
  );
};

export default ExamResultPage;
