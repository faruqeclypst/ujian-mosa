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
        <div className="flex flex-col items-center gap-3">
           <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-800 border-t-transparent shadow-lg shadow-slate-200"></div>
           <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] animate-pulse">Calculating Score...</p>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-slate-50 dark:bg-slate-950">
        <div className="p-12 bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl shadow-slate-200 dark:shadow-none flex flex-col items-center border border-slate-100 dark:border-slate-800">
          <Landmark className="h-20 w-20 text-slate-300 mb-8" />
          <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3 uppercase tracking-tight">DATA KOSONG</h2>
          <p className="text-slate-400 text-sm font-bold max-w-[200px] mb-10 uppercase tracking-widest leading-relaxed">Hasil pengerjaan Anda tidak ditemukan di sistem.</p>
          <Button onClick={() => navigate("/")} className="w-full bg-slate-800 hover:bg-slate-900 h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-slate-200">
             Back To Dashboard
          </Button>
        </div>
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans p-4 sm:p-10 flex flex-col items-center justify-start py-12 sm:py-20">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl">
        <Card className="rounded-[40px] sm:rounded-[60px] shadow-2xl shadow-slate-200 dark:shadow-none overflow-hidden border-none relative bg-white dark:bg-slate-900">
          <div className="absolute top-0 right-0 w-full h-[6px] bg-slate-800" />
          
          <div className="p-8 sm:p-20 flex flex-col items-center text-center space-y-8 sm:space-y-12">
              <div className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-800 rounded-[30px] sm:rounded-[40px] flex items-center justify-center shadow-2xl shadow-slate-200 dark:shadow-none animate-bounce">
                 <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
              </div>
              
              <div className="space-y-4">
                 <div className="inline-block px-4 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-full text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-[0.3em] border border-slate-100 dark:border-slate-700">Official Exam Result</div>
                 <h1 className="text-3xl sm:text-5xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-tight">Ujian Selesai!</h1>
                 <p className="text-sm sm:text-lg font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest max-w-md mx-auto leading-relaxed">Selamat! Anda telah menyelesaikan seluruh rangkaian ujian ini dengan baik.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-2xl">
                 <div className="bg-slate-50 dark:bg-slate-800/50 p-6 sm:p-8 rounded-[30px] sm:rounded-[40px] border border-slate-100 dark:border-slate-800 flex flex-col items-center space-y-4 shadow-sm">
                    <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-800 text-slate-300"><User className="w-6 h-6 sm:w-8 sm:h-8" /></div>
                    <div className="text-center">
                      <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Nama Lengkap</p>
                      <p className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{student?.name}</p>
                    </div>
                 </div>
                 <div className="bg-slate-50 dark:bg-slate-800/50 p-6 sm:p-8 rounded-[30px] sm:rounded-[40px] border border-slate-100 dark:border-slate-800 flex flex-col items-center space-y-4 shadow-sm">
                    <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-800 text-slate-300"><BookOpen className="w-6 h-6 sm:w-8 sm:h-8" /></div>
                    <div className="text-center">
                      <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Mata Pelajaran</p>
                      <p className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{roomData?.expand?.examId?.expand?.subjectId?.name || "General Course"}</p>
                    </div>
                 </div>
              </div>

              {showResult && (
                <div className="grid grid-cols-3 gap-3 sm:gap-6 w-full max-w-2xl">
                   <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-7 rounded-[25px] border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      <span className="text-xl font-black text-slate-800 dark:text-white tabular-nums">{attempt.correct}</span>
                   </div>
                   <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-7 rounded-[25px] border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2">
                      <XCircle className="w-6 h-6 text-rose-600" />
                      <span className="text-xl font-black text-slate-800 dark:text-white tabular-nums">{(attempt.total || 0) - (attempt.correct || 0)}</span>
                   </div>
                   <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-7 rounded-[25px] border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2">
                      <Timer className="w-6 h-6 text-slate-500" />
                      <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{attempt.usedTime ? formatTime(attempt.usedTime) : "-"}</span>
                   </div>
                </div>
              )}

              <div className="pt-8 w-full max-w-sm">
                <Button 
                   onClick={() => navigate('/')} 
                   className="w-full h-16 sm:h-18 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-black text-xs sm:text-sm uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-slate-200 dark:shadow-none transition-all active:scale-95 group flex items-center justify-center"
                >
                   <ArrowLeft className="mr-3 w-5 h-5 group-hover:-translate-x-2 transition-transform" />
                   Back to Dashboard
                </Button>
              </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-950/50 p-6 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.4em] opacity-50">
                 Official E-Exam Portal • Mosa Digital
              </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default ExamResultPage;
