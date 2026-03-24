import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSiswaAuth } from "../../context/SiswaAuthContext";
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
  const { siswa } = useSiswaAuth();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siswa || !roomId) return;

    const loadResult = async () => {
      try {
        const attemptRef = ref(database, `attempts/${siswa.nisn}_${roomId}`);
        const snapshot = await get(attemptRef);

        if (snapshot.exists()) {
          setAttempt(snapshot.val());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadResult();
  }, [siswa, roomId]);

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
        <Button onClick={() => navigate("/siswa/dashboard")} className="mt-4">
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
          <CardTitle className="text-2xl font-bold">Hasil Ujian Selesai</CardTitle>
          <p className="text-blue-100 text-xs mt-1">Nilai Anda telah tercatat di sistem.</p>
        </CardHeader>

        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
            <span className="text-4xl font-extrabold text-blue-600">
              {attempt.score}
            </span>
            <span className="text-xs text-slate-400 mt-1">NILAI AKHIR</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50/50 border border-green-100 rounded-xl p-3 flex flex-col items-center">
              <CheckCircle2 className="h-6 w-6 text-green-600 mb-1" />
              <div className="text-lg font-bold text-green-700">{attempt.correct}</div>
              <div className="text-xs text-green-600 font-medium">Benar</div>
            </div>

            <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 flex flex-col items-center">
              <XCircle className="h-6 w-6 text-red-500 mb-1" />
              <div className="text-lg font-bold text-red-700">{(attempt.total || 0) - (attempt.correct || 0)}</div>
              <div className="text-xs text-red-600 font-medium">Salah</div>
            </div>
          </div>

          <div className="mt-6 border-t pt-4">
              <Button onClick={() => window.location.href = "/siswa/dashboard"} className="w-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 h-11 rounded-xl">
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
