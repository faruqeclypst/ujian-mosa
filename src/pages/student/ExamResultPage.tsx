import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStudentAuth } from "../../context/StudentAuthContext";
import pb from "../../lib/pocketbase";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ClipboardCheck, FileText, LayoutDashboard, User, BookOpen, Clock, CheckCircle2, XCircle, Timer, Award, Landmark, CalendarDays, Trophy, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (paramRoomId) {
      sessionStorage.setItem("activeCBTRoomId", paramRoomId);
      setRoomId(paramRoomId);
      navigate("/cbt/result", { replace: true });
    } else {
      const saved = sessionStorage.getItem("activeCBTRoomId");
      if (saved) {
        setRoomId(saved);
      } else {
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
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-3xl shadow-xl flex items-center justify-center mb-2 animate-bounce border border-slate-100 dark:border-slate-800">
            <ClipboardCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Menghitung Skor Anda...</p>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-slate-50 dark:bg-slate-950">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-12 bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl shadow-emerald-100 flex flex-col items-center border border-slate-100 dark:border-slate-800 max-w-sm w-full">
          <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-8 border border-rose-100">
            <Landmark className="h-10 w-10 text-rose-300" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3 uppercase tracking-tight">DATA KOSONG</h2>
          <p className="text-slate-400 text-xs font-bold mb-10 uppercase tracking-widest leading-relaxed">Hasil pengerjaan Anda tidak ditemukan di sistem.</p>
          <Button onClick={() => navigate("/")} className="w-full bg-emerald-600 hover:bg-emerald-700 h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-200 text-white">
            Kembali Ke Dashboard
          </Button>
        </motion.div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}dtk`;
    return `${mins}m ${secs}dtk`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans p-4 sm:p-6 flex flex-col items-center justify-center py-6 sm:py-10 relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-5 dark:opacity-20">
        <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[40%] bg-emerald-300 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[40%] h-[40%] bg-blue-300 rounded-full blur-[100px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl relative z-10">
        <Card className="rounded-[30px] sm:rounded-[40px] shadow-2xl shadow-emerald-100 dark:shadow-none overflow-hidden border-none relative bg-white dark:bg-slate-900 mx-auto">
          <div className="absolute top-0 left-0 w-full h-[6px] bg-emerald-600" />

          <div className="p-6 sm:p-8 flex flex-col items-center text-center">
            <div className="relative group mb-6">
              <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full shadow-2xl" />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-emerald-600 rounded-[20px] sm:rounded-[25px] flex items-center justify-center shadow-xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
                <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
            </div>

            <div className="space-y-1 mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 rounded-full text-[9px] sm:text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.3em] border border-emerald-100/50 dark:border-emerald-800/50 mb-1">Official Result</div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-tight italic">Ujian Selesai!</h1>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] max-w-sm mx-auto opacity-70">Seluruh rangkaian ujian berhasil diselesaikan.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full mb-8">
              <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2 transition-all hover:bg-white dark:hover:bg-slate-800 group">
                <div className="p-2 sm:p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 text-emerald-600 group-hover:scale-110 transition-transform"><User className="w-4 h-4 sm:w-5 sm:h-5" /></div>
                <div className="text-center">
                  <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Siswa</p>
                  <p className="text-[11px] sm:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight leading-snug">{student?.name}</p>
                </div>
              </div>
              <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2 transition-all hover:bg-white dark:hover:bg-slate-800 group">
                <div className="p-2 sm:p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 text-emerald-600 group-hover:scale-110 transition-transform"><BookOpen className="w-4 h-4 sm:w-5 sm:h-5" /></div>
                <div className="text-center">
                  <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Mata Pelajaran</p>
                  <p className="text-[11px] sm:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight leading-tight">{roomData?.expand?.examId?.expand?.subjectId?.name || "General Course"}</p>
                </div>
              </div>
            </div>

            {showResult && (
              <div className="w-full bg-emerald-50/30 dark:bg-emerald-950/10 p-5 sm:p-10 rounded-[30px] border border-emerald-100/50 dark:border-emerald-800/50 mb-8">
                <div className="grid grid-cols-3 gap-2 sm:gap-6 mb-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold"><CheckCircle2 className="w-5 h-5" /></div>
                    <div className="flex flex-col">
                      <span className="text-[8px] sm:text-[9px] font-black text-emerald-600 uppercase tracking-widest">Benar</span>
                      <span className="text-base sm:text-2xl font-black text-slate-800 dark:text-white tabular-nums">{attempt.correct}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2 border-x border-emerald-100/50 dark:border-emerald-800/50">
                    <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-rose-100 flex items-center justify-center text-rose-600 font-bold"><XCircle className="w-5 h-5" /></div>
                    <div className="flex flex-col">
                      <span className="text-[8px] sm:text-[9px] font-black text-rose-600 uppercase tracking-widest">Salah</span>
                      <span className="text-base sm:text-2xl font-black text-slate-800 dark:text-white tabular-nums">{(attempt.total || 0) - (attempt.correct || 0)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 font-bold"><Timer className="w-5 h-5" /></div>
                    <div className="flex flex-col">
                      <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Durasi</span>
                      <span className="text-[11px] sm:text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter tabular-nums leading-none">{attempt.usedTime ? formatTime(attempt.usedTime) : "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-emerald-100/50 dark:border-emerald-800/50">
                  <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2">SCORE AKHIR</p>
                  <h2 className="text-6xl sm:text-[84px] font-black text-emerald-600 leading-none tracking-tighter tabular-nums italic">
                    {attempt.score.toFixed(0)}
                  </h2>
                </div>
              </div>
            )}

            <div className="w-full max-w-[200px] sm:max-w-[260px]">
              <Button
                onClick={() => navigate('/')}
                className="w-full h-12 sm:h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[12px] uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-emerald-100 dark:shadow-none transition-all active:scale-95 group flex items-center justify-center"
              >
                <ArrowLeft className="mr-3 w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Dashboard
              </Button>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/30 py-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.5em]">
              Official Mosa CBT System
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default ExamResultPage;
