import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStudentAuth } from "../../context/StudentAuthContext";
import pb from "../../lib/pocketbase";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { CheckCircle2, XCircle, Award, LayoutDashboard } from "lucide-react";

interface ExamAttempt {
  status: string;
  score: number;
  correct: number;
  total: number;
}

const ExamResultPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { student } = useStudentAuth();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [showResult, setShowResult] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!student || !roomId) return;

    const loadResult = async () => {
      try {
        setLoading(true);
        
        // 1. Load Attempt dari PocketBase
        const records = await pb.collection("attempts").getFullList({
          filter: `studentId = "${student.id}" && examRoomId = "${roomId}"`,
          limit: 1
        });

        if (records.length > 0) {
          const aData = records[0];
          setAttempt({
            status: aData.status,
            score: aData.score || 0,
            correct: aData.correct || 0,
            total: aData.total || 0,
          });
        }

        // 2. Load Room Settings for show_result flag
        const roomData = await pb.collection("exam_rooms").getOne(roomId);
        setShowResult(roomData.show_result !== false);

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
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-slate-50 dark:bg-slate-950">
        <XCircle className="h-16 w-16 text-rose-500 mb-4" />
        <p className="text-slate-500 font-bold uppercase tracking-tight">Data hasil ujian tidak ditemukan.</p>
        <Button onClick={() => navigate("/")} className="mt-6 bg-slate-900 text-white rounded-xl px-10 h-12 font-black uppercase tracking-widest">
           Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white dark:bg-slate-950 rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
        <CardHeader className="text-center bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 text-white pb-8 pt-12 relative">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
          <Award className="h-20 w-20 mx-auto mb-4 text-white drop-shadow-lg" />
          <CardTitle className="text-3xl font-black uppercase tracking-tight">Ujian Selesai!</CardTitle>
          <p className="text-blue-100 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 opacity-80 text-center">Data Anda Berhasil Diarsipkan</p>
        </CardHeader>

        <CardContent className="p-8 pt-10">
          {showResult ? (
            <div className="space-y-8">
              <div className="flex flex-col items-center justify-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 text-[8px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">Score Card</div>
                <span className="text-6xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                  {attempt.score}
                </span>
                <span className="text-[10px] text-slate-400 mt-2 uppercase font-black tracking-[0.3em]">NILAI AKHIR</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4 flex flex-col items-center">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500 mb-2" />
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{attempt.correct}</div>
                  <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Benar</div>
                </div>

                <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-4 flex flex-col items-center">
                  <XCircle className="h-7 w-7 text-rose-500 mb-2" />
                  <div className="text-xl font-black text-rose-600 dark:text-rose-400">{(attempt.total || 0) - (attempt.correct || 0)}</div>
                  <div className="text-[10px] text-rose-500 font-black uppercase tracking-widest">Salah</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 px-4 text-center space-y-6">
               <div className="mx-auto w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] flex items-center justify-center border border-blue-100 dark:border-blue-800 shadow-sm">
                  <CheckCircle2 className="h-10 w-10 text-blue-600 dark:text-blue-400" />
               </div>
               <div className="space-y-2">
                  <h3 className="font-black text-slate-800 dark:text-white text-xl uppercase tracking-tight">Terima Kasih!</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Jawaban Anda telah tersimpan dengan aman di server kami. Silakan cek hasil pengumuman melalui dashboard.
                  </p>
               </div>
            </div>
          )}

          <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Button 
               onClick={() => navigate("/")} 
               className="w-full bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white flex items-center justify-center gap-3 h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-900/10 transition-all active:scale-95"
            >
              <LayoutDashboard className="h-5 w-5" />
              Ke Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExamResultPage;
