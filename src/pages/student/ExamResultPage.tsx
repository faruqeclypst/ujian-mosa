import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { ref, get } from "firebase/database";
import { database } from "../../lib/firebase";
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
        // 1. Load Attempt
        const attemptRef = ref(database, `attempts/${roomId}/${student.nisn}`);
        const snapshot = await get(attemptRef);

        if (snapshot.exists()) {
          setAttempt(snapshot.val());
        }

        // 2. Load Room Settings for show_result flag
        const roomRef = ref(database, `exam_rooms/${roomId}`);
        const roomSnap = await get(roomRef);
        if (roomSnap.exists()) {
          const roomData = roomSnap.val();
          setShowResult(roomData.show_result !== false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadResult();
  }, [student, roomId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <p className="text-slate-500">Data hasil ujian tidak ditemukan.</p>
        <Button onClick={() => navigate("/student/dashboard")} className="mt-4">
          Kembali ke Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card rounded-2xl border shadow-md overflow-hidden">
        <CardHeader className="text-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white pb-6 pt-10">
          <Award className="h-16 w-16 mx-auto mb-2 text-white/90 drop-shadow" />
          <CardTitle className="text-2xl font-bold">Ujian Selesai</CardTitle>
          <p className="text-blue-100 text-xs mt-1">Jawaban Anda berhasil terkirim ke server.</p>
        </CardHeader>

        <CardContent className="p-6">
          {showResult ? (
            <>
              <div className="flex flex-col items-center justify-center py-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 mb-6">
                <span className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">
                  {attempt.score}
                </span>
                <span className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">NILAI AKHIR</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/40 rounded-xl p-3 flex flex-col items-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 mb-1" />
                  <div className="text-lg font-bold text-green-700 dark:text-green-300">{attempt.correct}</div>
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium">Benar</div>
                </div>

                <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-xl p-3 flex flex-col items-center">
                  <XCircle className="h-6 w-6 text-red-500 dark:text-red-400 mb-1" />
                  <div className="text-lg font-bold text-red-700 dark:text-red-300">{(attempt.total || 0) - (attempt.correct || 0)}</div>
                  <div className="text-xs text-red-600 dark:text-red-400 font-medium">Salah</div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 px-4 text-center space-y-4">
               <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
               </div>
               <div className="space-y-1">
                  <h3 className="font-bold text-slate-800 dark:text-white text-lg">Terima Kasih!</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Nilai tidak ditampilkan karena kebijakan pengawas. Silakan menunggu informasi selanjutnya.
                  </p>
               </div>
            </div>
          )}

          <div className="mt-6 border-t pt-4">
            <Button onClick={() => navigate("/student/dashboard")} className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 h-11 rounded-xl font-bold">
              <LayoutDashboard className="h-4 w-4" />
              Kembali ke Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExamResultPage;

