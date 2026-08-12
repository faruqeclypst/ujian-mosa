import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useTenant } from "../../context/TenantContext";
import { useExamData } from "../../context/ExamDataContext";
import { Loader2, BookOpen, Trophy, Clock, ChevronRight, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { MathText } from "../ui/MathText";

interface StudentScoresDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
}

interface AttemptData {
  id: string;
  examRoomId: string;
  studentId: string;
  status: string;
  score?: number;
  correct?: number;
  startedAt?: string;
  startTime?: string;
  submitTime?: string;
  submittedAt?: string;
  created: string;
  updated?: string;
  answers?: Record<string, any>;
  overrides?: Record<string, boolean>;
}

interface ExamRoomInfo {
  id: string;
  examId: string;
  room_name?: string;
  duration: number;
  start_time: string;
}

interface ExamInfo {
  id: string;
  title: string;
  subjectId?: string;
  subjectid?: string;
  teacherId?: string;
  teacherid?: string;
}

interface RoomScore {
  roomId: string;
  roomName: string;
  examId: string;
  examTitle: string;
  score: number | null;
  status: string;
  startedAt: string | null;
  duration: string;
  answers: Record<string, any>;
  overrides: Record<string, boolean>;
}

interface SubjectScore {
  subjectId: string;
  subjectName: string;
  rooms: RoomScore[];
}

interface QuestionData {
  id: string;
  text: string;
  type: string;
  choices?: Record<string, { text: string; isCorrect: boolean }>;
  answerKey?: string;
  items?: { id: string; text: string }[];
  pairs?: { id: string; left: string; right: string }[];
}

const StudentScoresDialog = ({ isOpen, onClose, studentId, studentName }: StudentScoresDialogProps) => {
  const { pb, terminology } = useTenant();
  const { subjects } = useExamData();
  const [loading, setLoading] = useState(false);
  const [subjectScores, setSubjectScores] = useState<SubjectScore[]>([]);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  // Detail view state
  const [detailView, setDetailView] = useState<RoomScore | null>(null);
  const [detailQuestions, setDetailQuestions] = useState<QuestionData[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (isOpen && studentId) {
      fetchScores();
    } else {
      setSubjectScores([]);
      setExpandedSubject(null);
      setDetailView(null);
      setDetailQuestions([]);
    }
  }, [isOpen, studentId]);

  const fetchScores = async () => {
    if (!pb || !studentId) return;
    setLoading(true);

    try {
      const attempts: AttemptData[] = await pb.collection("attempts").getFullList({
        filter: `studentId = "${studentId}"`,
        sort: "-created"
      });

      if (attempts.length === 0) {
        setSubjectScores([]);
        setLoading(false);
        return;
      }

      const roomIds = [...new Set(attempts.map(a => a.examRoomId))];
      const rooms: ExamRoomInfo[] = [];
      const chunkSize = 20;
      for (let i = 0; i < roomIds.length; i += chunkSize) {
        const chunk = roomIds.slice(i, i + chunkSize);
        const filter = chunk.map(id => `id = "${id}"`).join(" || ");
        const roomData = await pb.collection("exam_rooms").getFullList({ filter });
        rooms.push(...roomData as any[]);
      }

      const examIds = [...new Set(rooms.map(r => r.examId))];
      const exams: ExamInfo[] = [];
      for (let i = 0; i < examIds.length; i += chunkSize) {
        const chunk = examIds.slice(i, i + chunkSize);
        const filter = chunk.map(id => `id = "${id}"`).join(" || ");
        const examData = await pb.collection("exams").getFullList({ filter });
        exams.push(...examData as any[]);
      }

      const subjectMap: Record<string, SubjectScore> = {};

      for (const attempt of attempts) {
        const room = rooms.find(r => r.id === attempt.examRoomId);
        if (!room) continue;

        const exam = exams.find(e => e.id === room.examId);
        if (!exam) continue;

        const subjectId = exam.subjectId || exam.subjectid || "unknown";
        const subject = subjects.find(s => s.id === subjectId);
        const subjectName = subject?.name || "Tanpa Mapel";

        if (!subjectMap[subjectId]) {
          subjectMap[subjectId] = { subjectId, subjectName, rooms: [] };
        }

        const loginTime = attempt.startedAt || attempt.startTime || attempt.created;
        let durationStr = "-";
        if (loginTime) {
          const startMs = new Date(loginTime).getTime();
          const endMs = attempt.submitTime
            ? new Date(attempt.submitTime).getTime()
            : attempt.submittedAt
              ? new Date(attempt.submittedAt).getTime()
              : attempt.status === "finished"
                ? new Date(attempt.updated || attempt.created).getTime()
                : 0;
          if (endMs > 0) {
            const diffMs = Math.max(0, endMs - startMs);
            const dHrs = Math.floor(diffMs / (1000 * 60 * 60));
            const dMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            durationStr = dHrs > 0 ? `${dHrs}j ${dMins}m` : `${dMins} menit`;
          }
        }

        subjectMap[subjectId].rooms.push({
          roomId: room.id,
          roomName: room.room_name || exam.title,
          examId: room.examId,
          examTitle: exam.title,
          score: attempt.status === "finished" ? (attempt.score ?? 0) : null,
          status: attempt.status,
          startedAt: loginTime || null,
          duration: durationStr,
          answers: attempt.answers || {},
          overrides: attempt.overrides || {}
        });
      }

      const sorted = Object.values(subjectMap).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
      setSubjectScores(sorted);
    } catch (err) {
      console.error("Failed to fetch student scores:", err);
      setSubjectScores([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (room: RoomScore) => {
    if (!pb) return;
    setDetailView(room);
    setDetailLoading(true);
    setDetailQuestions([]);

    try {
      const rawQuestions = await pb.collection("questions").getFullList({
        filter: `examId = "${room.examId}"`,
        sort: "order,created"
      });

      // Map PocketBase fields to internal format (same as MonitoringPage)
      const typeMapReverse: Record<string, string> = {
        multiple_choice: "pilihan_ganda",
        complex_multiple_choice: "pilihan_ganda_kompleks",
        matching: "menjodohkan",
        true_false: "benar_salah",
        short_answer: "isian_singkat",
        essay: "uraian",
        ordering: "urutkan",
        drag_drop: "drag_drop",
        pilihan_ganda: "pilihan_ganda",
        pilihan_ganda_kompleks: "pilihan_ganda_kompleks",
        isian_singkat: "isian_singkat",
        uraian: "uraian",
        menjodohkan: "menjodohkan",
        urutkan: "urutkan",
        benar_salah: "benar_salah"
      };

      const mappedQuestions = rawQuestions.map((q: any) => {
        const rawType = q.field || q.type || "pilihan_ganda";
        const mappedType = typeMapReverse[rawType] || rawType;
        const options = q.options || {};
        return {
          ...q,
          type: mappedType,
          choices: mappedType === "menjodohkan" ? undefined : options,
          pairs: mappedType === "menjodohkan" ? options.pairs : undefined,
          items: (mappedType === "urutkan" || mappedType === "drag_drop") ? options.items : undefined,
          answerKey: q.correctAnswer || q.answerKey
        };
      });

      setDetailQuestions(mappedQuestions as any[]);
    } catch (err) {
      console.error("Failed to fetch questions:", err);
      setDetailQuestions([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const isFuzzyMatch = (studentAns: any, correctKey: string) => {
    if (typeof studentAns !== "string" || !correctKey) return false;
    const sAns = studentAns.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const cKey = correctKey.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (sAns === cKey) return true;
    if (!sAns || !cKey) return false;
    if (cKey.length < 3) return sAns === cKey;
    const distance = (a: string, b: string) => {
      const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
      for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
      for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
      for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + cost);
        }
      }
      return matrix[b.length][a.length];
    };
    const dist = distance(sAns, cKey);
    const maxAllowed = cKey.length > 8 ? 2 : (cKey.length >= 4 ? 1 : 0);
    return dist <= maxAllowed;
  };

  const checkAnswer = (q: QuestionData, ans: any, overrides: Record<string, boolean>) => {
    if (overrides[q.id] !== undefined) return overrides[q.id];
    if (!ans) return false;

    const type = q.type || "pilihan_ganda";
    if (type === "pilihan_ganda" || type === "benar_salah") {
      const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ans).toLowerCase());
      return ck ? q.choices![ck].isCorrect === true : false;
    }
    if (type === "pilihan_ganda_kompleks") {
      const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices![k].isCorrect).map(k => k.toLowerCase());
      const studentKeys = Array.isArray(ans) ? ans.map((k: string) => String(k).toLowerCase()) : [];
      return studentKeys.length === correctKeys.length && studentKeys.every((k: string) => correctKeys.includes(k));
    }
    if (type === "isian_singkat") {
      return isFuzzyMatch(ans, q.answerKey || "");
    }
    if (type === "urutkan" || type === "drag_drop") {
      const co = (q.items || []).map((it) => it.id);
      return Array.isArray(ans) && ans.length === co.length && ans.every((v: string, i: number) => v === co[i]);
    }
    if (type === "menjodohkan") {
      const pairs = q.pairs || [];
      return pairs.length > 0 && pairs.every((p) => ans[p.id] === p.right);
    }
    return false;
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-slate-400";
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-amber-600";
    return "text-rose-600";
  };

  const getScoreBg = (score: number | null) => {
    if (score === null) return "bg-slate-50 border-slate-200";
    if (score >= 80) return "bg-emerald-50 border-emerald-200";
    if (score >= 60) return "bg-amber-50 border-amber-200";
    return "bg-rose-50 border-rose-200";
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "finished": return "Selesai";
      case "ongoing": return "Mengerjakan";
      case "LOCKED": return "Terkunci";
      default: return status;
    }
  };

  // Detail View - shows questions and answers like monitoring page
  const renderDetailView = () => {
    if (!detailView) return null;

    const correctCount = detailQuestions.filter(q => checkAnswer(q, detailView.answers[q.id], detailView.overrides)).length;

    return (
      <div className="flex flex-col h-full">
        {/* Detail Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
          <button
            onClick={() => { setDetailView(null); setDetailQuestions([]); }}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500" />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{detailView.roomName}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {detailView.startedAt && (
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {new Date(detailView.startedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              )}
              {detailView.duration !== "-" && (
                <span className="text-[10px] text-slate-400">• {detailView.duration}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!detailLoading && detailQuestions.length > 0 && (
              <span className="text-[10px] text-slate-400 font-bold">
                {correctCount}/{detailQuestions.length}
              </span>
            )}
            <div className={cn("px-2.5 py-1 rounded-lg border font-bold text-sm", getScoreBg(detailView.score), getScoreColor(detailView.score))}>
              {detailView.score !== null ? detailView.score : "-"}
            </div>
          </div>
        </div>

        {/* Questions Grid */}
        {detailLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="text-xs text-slate-500">Memuat soal...</span>
          </div>
        ) : detailQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <BookOpen className="h-8 w-8 text-slate-300" />
            <span className="text-xs text-slate-400">Tidak ada data soal.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 overflow-y-auto flex-1">
            {detailQuestions.map((q, qIdx) => {
              const ans = detailView.answers[q.id];
              const isCorrect = checkAnswer(q, ans, detailView.overrides);
              const displayAns = ans
                ? (Array.isArray(ans) ? ans.join(", ") : String(ans).toUpperCase())
                : "-";

              return (
                <div key={q.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-2">
                  <div className="flex gap-2">
                    <span className="text-[10px] font-black text-slate-400 shrink-0">#{qIdx + 1}</span>
                    <MathText content={q.text} className="text-[11px] font-medium leading-tight text-slate-700 dark:text-slate-300 line-clamp-3" />
                  </div>
                  <div className={cn(
                    "mt-auto p-2 rounded-lg flex items-center justify-between",
                    isCorrect ? "bg-emerald-50 dark:bg-emerald-900/20" : (ans ? "bg-rose-50 dark:bg-rose-900/20" : "bg-slate-50 dark:bg-slate-800")
                  )}>
                    <span className={cn("text-[10px] font-bold truncate", isCorrect ? "text-emerald-700 dark:text-emerald-400" : (ans ? "text-rose-700 dark:text-rose-400" : "text-slate-400"))}>
                      Jawab: {displayAns}
                    </span>
                    {ans ? (
                      isCorrect
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        : <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    ) : (
                      <span className="text-[9px] text-slate-400">-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Subject List View
  const renderSubjectList = () => (
    <div className="space-y-2">
      {subjectScores.map((subject) => {
        const hasMultipleRooms = subject.rooms.length > 1;
        const isExpanded = expandedSubject === subject.subjectId;
        const bestScore = subject.rooms
          .filter(r => r.score !== null)
          .reduce((max, r) => Math.max(max, r.score ?? 0), 0);
        const hasFinished = subject.rooms.some(r => r.status === "finished");

        return (
          <div key={subject.subjectId} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Subject Header */}
            <button
              className={cn(
                "w-full flex items-center justify-between p-3 transition-colors text-left",
                "hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer",
                isExpanded && "bg-slate-50 dark:bg-slate-900/50"
              )}
              onClick={() => {
                if (hasMultipleRooms) {
                  setExpandedSubject(isExpanded ? null : subject.subjectId);
                } else {
                  // Single room - go directly to detail
                  handleViewDetail(subject.rooms[0]);
                }
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{subject.subjectName}</span>
                  {hasMultipleRooms && (
                    <span className="text-[10px] text-slate-400">{subject.rooms.length} ujian — pilih ruang ujian</span>
                  )}
                  {!hasMultipleRooms && subject.rooms[0] && (
                    <span className="text-[10px] text-slate-400 truncate">{subject.rooms[0].roomName}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!hasMultipleRooms && subject.rooms[0] ? (
                  <div className="flex items-center gap-2">
                    {subject.rooms[0].status !== "finished" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-200 text-blue-600 bg-blue-50">
                        {getStatusLabel(subject.rooms[0].status)}
                      </Badge>
                    )}
                    <div className={cn("px-2.5 py-1 rounded-lg border font-bold text-sm", getScoreBg(subject.rooms[0].score), getScoreColor(subject.rooms[0].score))}>
                      {subject.rooms[0].score !== null ? subject.rooms[0].score : "-"}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {hasFinished && (
                      <div className={cn("px-2.5 py-1 rounded-lg border font-bold text-sm", getScoreBg(bestScore), getScoreColor(bestScore))}>
                        {bestScore}
                      </div>
                    )}
                    <ChevronRight className={cn("h-4 w-4 text-slate-400 transition-transform", isExpanded && "rotate-90")} />
                  </div>
                )}
              </div>
            </button>

            {/* Expanded Room List - for multiple rooms */}
            {hasMultipleRooms && isExpanded && (
              <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                {subject.rooms.map((room, idx) => (
                  <button
                    key={`${room.roomId}-${idx}`}
                    className="w-full flex items-center justify-between px-4 py-2.5 border-b last:border-b-0 border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800/50 transition-colors text-left"
                    onClick={() => handleViewDetail(room)}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">{room.roomName}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {room.startedAt && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {new Date(room.startedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                          </span>
                        )}
                        {room.duration !== "-" && (
                          <span className="text-[10px] text-slate-400">• {room.duration}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {room.status !== "finished" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-200 text-blue-600 bg-blue-50">
                          {getStatusLabel(room.status)}
                        </Badge>
                      )}
                      <div className={cn("px-2 py-0.5 rounded-lg border font-bold text-xs", getScoreBg(room.score), getScoreColor(room.score))}>
                        {room.score !== null ? room.score : "-"}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("bg-card max-h-[80vh] overflow-hidden flex flex-col", detailView ? "max-w-2xl" : "max-w-lg")}>
        {!detailView && (
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Nilai {terminology.student}: {studentName}
            </DialogTitle>
          </DialogHeader>
        )}

        <div className="flex-1 overflow-y-auto -mx-6 px-6 pb-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="text-sm text-slate-500">Memuat data nilai...</span>
            </div>
          ) : detailView ? (
            renderDetailView()
          ) : subjectScores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <BookOpen className="h-10 w-10 text-slate-300" />
              <span className="text-sm text-slate-400">{terminology.student} belum mengikuti ujian apapun.</span>
            </div>
          ) : (
            renderSubjectList()
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentScoresDialog;
