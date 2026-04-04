import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStudentAuth } from "../../context/StudentAuthContext";
import pb from "../../lib/pocketbase";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Flag, 
  Bookmark, 
  LogOut,
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  X, 
  Maximize2, 
  ArrowRight,
  HelpCircle,
  GripVertical 
} from "lucide-react";
import { motion, AnimatePresence, Reorder } from "framer-motion";

interface Question {
  id: string;
  type?: "pilihan_ganda" | "pilihan_ganda_kompleks" | "menjodohkan" | "benar_salah" | "isian_singkat" | "uraian" | "urutkan" | "drag_drop";
  text: string;
  imageUrl?: string;
  groupId?: string;
  groupText?: string;
  choices?: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }>;
  pairs?: Array<{ id: string; left: string; right: string }>;
  answerKey?: string;
  items?: Array<{ id: string; text: string; imageUrl?: string }>;
}

interface ExamAttempt {
  id: string;
  status: "ongoing" | "submitted" | "LOCKED";
  cheatCount: number;
  score?: number;
  correct?: number;
  total?: number;
  extraCheatLimit?: number;
  startTime?: string | number;
  isOnline?: boolean;
  lastHeartbeat?: string;
}

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

const CBTPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { student, logoutStudent } = useStudentAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({}); 
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);

  const [roomData, setRoomData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0); 
  const [isExamOver, setIsExamOver] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false); 
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false); 
  const [previewImage, setPreviewImage] = useState<string | null>(null); 
  const [isNavModalOpen, setIsNavModalOpen] = useState(false); 
  const [isCheatWarningOpen, setIsCheatWarningOpen] = useState(false); 
  const [isLocked, setIsLocked] = useState(false);
  const [isSkipNoticeOpen, setIsSkipNoticeOpen] = useState(false); 
  const [targetIndex, setTargetIndex] = useState<number | null>(null); 
  const [error, setError] = useState<string | null>(null);

  const saveTimeoutRef = useRef<any>(null);
  const lastCheatTimeRef = useRef<number>(0); 
  const isIndexRestored = useRef(false);

  const [choicesOrder, setChoicesOrder] = useState<Record<string, string[]>>({});
  const [itemsOrder, setItemsOrder] = useState<Record<string, string[]>>({});
  const [matchingOptions, setMatchingOptions] = useState<Record<string, string[]>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [questionOrder, setQuestionOrder] = useState<string[]>([]);

  const parseSafeDate = (dateStr: any) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const clusterShuffleIds = useCallback((list: string[], loadedQuestions: Question[]): string[] => {
    const grouped: Record<string, string[]> = {};
    const standalone: string[] = [];
    list.forEach((id) => {
      const q = loadedQuestions.find((item) => item.id === id);
      if (q?.groupId) {
        if (!grouped[q.groupId]) grouped[q.groupId] = [];
        grouped[q.groupId].push(id);
      } else {
        standalone.push(id);
      }
    });

    const newChoicesOrder: Record<string, string[]> = {};
    const newItemsOrder: Record<string, string[]> = {};
    const newMatchingOptions: Record<string, string[]> = {};

    loadedQuestions.forEach((q: any) => {
      const choices = q.choices || (q.options && !q.options.pairs && !q.options.items ? q.options : null);
      if (choices) {
        const keys = Object.keys(choices);
        for (let i = keys.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [keys[i], keys[j]] = [keys[j], keys[i]];
        }
        newChoicesOrder[q.id] = keys;
      }
      if (q.items && (q.type === "urutkan" || q.type === "drag_drop")) {
        const ids = q.items.map((it: any) => it.id);
        for (let i = ids.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        newItemsOrder[q.id] = ids;
      }
      if (q.pairs && q.type === "menjodohkan") {
        const rightOptions = Array.from(new Set((q.pairs as any[]).map((p: any) => p.right as string))) as string[];
        for (let i = rightOptions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [rightOptions[i], rightOptions[j]] = [rightOptions[j], rightOptions[i]];
        }
        newMatchingOptions[q.id] = rightOptions;
      }
    });

    const storagePrefix = `${student?.nisn}_${roomId}`;
    sessionStorage.setItem(`choices_${storagePrefix}`, JSON.stringify(newChoicesOrder));
    sessionStorage.setItem(`items_${storagePrefix}`, JSON.stringify(newItemsOrder));
    sessionStorage.setItem(`match_${storagePrefix}`, JSON.stringify(newMatchingOptions));

    setChoicesOrder(newChoicesOrder);
    setItemsOrder(newItemsOrder);
    setMatchingOptions(newMatchingOptions);

    const collection: (string | string[])[] = [...standalone, ...Object.values(grouped)];
    for (let i = collection.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [collection[i], collection[j]] = [collection[j], collection[i]];
    }
    return collection.flat();
  }, [student, roomId]);

  const mergeNewQuestions = useCallback((currentIds: string[], savedOrder: string[], loadedQuestions: Question[]): string[] => {
    const validExisting = savedOrder.filter(id => currentIds.includes(id));
    const newIds = currentIds.filter(id => !validExisting.includes(id));
    if (newIds.length === 0) return validExisting;
    const shuffledNew = clusterShuffleIds(newIds, loadedQuestions);
    return [...validExisting, ...shuffledNew];
  }, [clusterShuffleIds]);

  const loadExamData = useCallback(async () => {
    if (!student || !roomId) return;
    try {
      setLoading(true);
      const rData = await pb.collection("exam_rooms").getOne(roomId, {
        expand: "examId,examId.subjectId,examId.teacherId"
      });

      if (rData.status === "archive") throw new Error("Ruang ujian sudah diarsipkan.");

      const exam = rData.expand?.examId;
      setRoomData({
        ...rData,
        examTitle: rData.room_name || exam?.title || "CBT",
        subject: exam?.expand?.subjectId?.name || "Ujian",
        teacherName: exam?.expand?.teacherId?.name || "-"
      });

      const qRecords = await pb.collection("questions").getFullList({
        filter: `examId = "${rData.examId}"`,
        sort: "order,created"
      });
      
      const loadedQuestions: Question[] = qRecords.map(q => {
        const rawType = q.field || q.type || "pilihan_ganda";
        const typeMap: Record<string, string> = {
          "multiple_choice": "pilihan_ganda", "complex_multiple_choice": "pilihan_ganda_kompleks", "short_answer": "isian_singkat", "essay": "uraian", "matching": "menjodohkan", "ordering": "urutkan", "true_false": "benar_salah", "pilihan_ganda": "pilihan_ganda", "pilihan_ganda_kompleks": "pilihan_ganda_kompleks", "isian_singkat": "isian_singkat", "uraian": "uraian", "menjodohkan": "menjodohkan", "urutkan": "urutkan", "benar_salah": "benar_salah"
        };
        return {
          id: q.id, type: (typeMap[rawType] || "pilihan_ganda") as any, text: q.text, imageUrl: q.imageUrl, groupId: q.groupId, groupText: q.groupText, choices: q.options, pairs: q.options?.pairs, items: q.options?.items, answerKey: q.answerKey
        };
      });

      const attempts = await pb.collection("attempts").getFullList({
        filter: `studentId = "${student.id}" && examRoomId = "${roomId}"`, sort: "-created"
      });
      
      let currentAttempt: any = null;
      if (attempts.length > 0) {
        currentAttempt = attempts[0];
        if (currentAttempt.status === "submitted") { navigate("/result/" + currentAttempt.id); return; }
        if (currentAttempt.status === "LOCKED") setIsLocked(true);
        setAnswers(currentAttempt.answers || {});
      } else {
        currentAttempt = await pb.collection("attempts").create({
          studentId: student.id, examRoomId: roomId, status: "ongoing", cheatCount: 0, startTime: new Date().toISOString(), isOnline: true, lastHeartbeat: new Date().toISOString(), answers: {}
        });
      }
      setAttempt(currentAttempt);

      const currentIds = loadedQuestions.map(q => q.id);
      const storagePrefix = `${student.nisn}_${roomId}`;
      const savedOrder = sessionStorage.getItem(`order_${storagePrefix}`);
      let order: string[] = [];
      if (savedOrder) {
        try {
          const parsedOrder = JSON.parse(savedOrder);
          order = mergeNewQuestions(currentIds, parsedOrder, loadedQuestions);
          sessionStorage.setItem(`order_${storagePrefix}`, JSON.stringify(order));
        } catch (e) {}
      }
      if (order.length === 0) {
        order = clusterShuffleIds(currentIds, loadedQuestions);
        sessionStorage.setItem(`order_${storagePrefix}`, JSON.stringify(order));
      }
      setQuestionOrder(order);
      const sorted = order.map(id => loadedQuestions.find(q => q.id === id)).filter(q => !!q) as Question[];
      setQuestions(sorted);

      const savedIndex = sessionStorage.getItem(`currentIndex_${storagePrefix}`);
      if (savedIndex && isIndexRestored.current === false) {
        const idx = parseInt(savedIndex, 10);
        if (idx >= 0 && idx < sorted.length) setCurrentQuestionIndex(idx);
      }
      isIndexRestored.current = true;

      const rawStart = currentAttempt.startTime || (currentAttempt as any).start_time;
      const rawEnd = rData.end_time || (rData as any).endTime;
      const startD = parseSafeDate(rawStart) || new Date();
      const endD = parseSafeDate(rawEnd) || new Date(startD.getTime() + (rData.duration * 60 * 1000));
      
      const now = Date.now();
      const personalEndTime = startD.getTime() + (rData.duration * 60 * 1000);
      const finalEndTime = Math.min(personalEndTime, endD.getTime());
      const diff = Math.floor((finalEndTime - now) / 1000);
      if (diff <= 0) setIsExamOver(true);
      setTimeLeft(Math.max(0, diff));
    } catch (err: any) {
      console.error("Load CBT Error:", err);
      setError(err.message || "Gagal memuat ujian.");
    } finally {
      setLoading(false);
    }
  }, [student, roomId, clusterShuffleIds, mergeNewQuestions, navigate]);

  useEffect(() => { loadExamData(); }, [loadExamData]);

  useEffect(() => {
    if (!attempt?.id) return;
    const unsub = pb.collection("attempts").subscribe(attempt.id, (e) => {
        if (e.action === "delete") { setIsResetModalOpen(true); } 
        else if (e.action === "update") {
            if (e.record.status === "ongoing" && isLocked) setIsLocked(false);
            else if (e.record.status === "LOCKED") setIsLocked(true);
        }
    });
    return () => { unsub.then(u => u()); };
  }, [attempt?.id, isLocked]);

  useEffect(() => {
    if (loading || !roomData?.examId) return;
    const startSub = async () => {
      try {
        const unsub = await pb.collection('questions').subscribe("*", (e) => {
           if (e.record.examId === roomData.examId) { loadExamData(); }
        });
        return unsub;
      } catch (e) { return null; }
    };
    const unsubPromise = startSub();
    return () => { unsubPromise.then(u => u && u()); };
  }, [loading, roomData?.examId, loadExamData]);

  useEffect(() => {
    if (loading || isLocked || isExamOver || !roomData || !attempt) return;
    const timer = setInterval(() => {
      const rawStart = attempt.startTime || (attempt as any).start_time;
      const rawEnd = roomData.end_time || (roomData as any).endTime;
      const startD = parseSafeDate(rawStart) || new Date();
      const endD = parseSafeDate(rawEnd) || new Date(startD.getTime() + (roomData.duration * 60 * 1000));
      
      const now = Date.now();
      const personalEndTime = startD.getTime() + (roomData.duration * 60 * 1000);
      const finalEndTime = Math.min(personalEndTime, endD.getTime());
      const diff = Math.floor((finalEndTime - now) / 1000);
      if (diff <= 0) { clearInterval(timer); setTimeLeft(0); setIsExamOver(true); } 
      else setTimeLeft(diff);
    }, 1000);

    const heartbeat = setInterval(async () => {
        try { await pb.collection("attempts").update(attempt.id, { isOnline: true, lastHeartbeat: new Date().toISOString() }); } catch(e) {}
    }, 30000);

    return () => { clearInterval(timer); clearInterval(heartbeat); };
  }, [loading, isLocked, isExamOver, roomData, attempt]);

  const handleAnswerSelect = (questionId: string, value: any) => {
    if (isExamOver || isLocked || !attempt) return;
    setAnswers((prev) => {
      const updated = { ...prev, [questionId]: value };
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try { await pb.collection("attempts").update(attempt.id, { answers: updated }); } 
        catch (e) { console.error("Auto-save failed", e); }
      }, 500);
      return updated;
    });
  };

  const handleSubmitExam = async () => {
    if (!student || !roomId || !roomData || !attempt) return;
    setLoading(true);
    try {
      let correctCount = 0;
      questions.forEach((q: any) => {
        const studentAnswer = answers[q.id];
        if (!studentAnswer) return;
        const type = q.type || "pilihan_ganda";
        if (type === "pilihan_ganda" || type === "benar_salah") { if (q.choices?.[studentAnswer]?.isCorrect === true) correctCount++; } 
        else if (type === "pilihan_ganda_kompleks") {
          const correctKeys = Object.keys(q.choices).filter(k => q.choices[k].isCorrect);
          if (Array.isArray(studentAnswer) && studentAnswer.length === correctKeys.length && studentAnswer.every(k => correctKeys.includes(k))) correctCount++;
        } else if (type === "menjodohkan") {
          const totalPairs = (q.pairs || []).length;
          let correctPairs = 0;
          (q.pairs || []).forEach((p: any) => { if (studentAnswer[p.id] === p.right) correctPairs++; });
          if (totalPairs > 0) correctCount += (correctPairs / totalPairs);
        } else if (type === "isian_singkat") { if (q.answerKey && isFuzzyMatch(studentAnswer, q.answerKey)) correctCount++; } 
        else if (type === "urutkan" || type === "drag_drop") {
          const items = q.items || [];
          const correctOrder = items.map((it: any) => it.id);
          if (Array.isArray(studentAnswer) && studentAnswer.length === correctOrder.length && studentAnswer.every((val, idx) => val === correctOrder[idx])) correctCount++;
        }
      });
      const score = Math.round((correctCount / questions.length) * 100) || 0;
      await pb.collection("attempts").update(attempt.id, { status: "submitted", score: score, correct: correctCount, total: questions.length, isOnline: false });
      const storagePrefix = `${student.nisn}_${roomId}`;
      sessionStorage.removeItem(`order_${storagePrefix}`);
      sessionStorage.removeItem(`currentIndex_${storagePrefix}`);
      navigate("/result/" + attempt.id);
    } catch (err) { console.error(err); alert("Gagal mengumpulkan!"); } 
    finally { setLoading(false); }
  };

  const toggleFlag = (qId: string) => {
    const storagePrefix = `${student?.nisn}_${roomId}`;
    setFlaggedQuestions((prev) => {
      const updated = { ...prev, [qId]: !prev[qId] };
      sessionStorage.setItem(`flags_${storagePrefix}`, JSON.stringify(updated));
      return updated;
    });
  };

  const goToQuestion = (index: number) => {
    if (index === currentQuestionIndex) return;
    setTargetIndex(null);
    setCurrentQuestionIndex(index);
    const storagePrefix = `${student?.nisn}_${roomId}`;
    sessionStorage.setItem(`currentIndex_${storagePrefix}`, index.toString());
  };

  const handleNextClick = () => {
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ) return;
    const isAnswered = answers[currentQ.id] !== undefined;
    const isPG = !currentQ.type || currentQ.type === "pilihan_ganda" || currentQ.type === "pilihan_ganda_kompleks";
    if (!isAnswered && !isPG) { setTargetIndex(currentQuestionIndex + 1); setIsSkipNoticeOpen(true); return; }
    if (currentQuestionIndex < questions.length - 1) goToQuestion(currentQuestionIndex + 1);
  };

  const handleNavClick = (index: number) => {
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ) return;
    const isAnswered = answers[currentQ.id] !== undefined;
    const isPG = !currentQ.type || currentQ.type === "pilihan_ganda" || currentQ.type === "pilihan_ganda_kompleks";
    if (!isAnswered && index !== currentQuestionIndex && !isPG) { setTargetIndex(index); setIsSkipNoticeOpen(true); return; }
    goToQuestion(index); setIsNavModalOpen(false);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}:` : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (isLocked) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 absolute inset-0 z-[100] p-6">
      <div className="bg-white rounded-3xl p-8 max-w-sm text-center shadow-2xl">
        <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4 animate-pulse" />
        <h1 className="text-2xl font-black text-slate-900 mb-2 uppercase">Ujian Terkunci!</h1>
        <p className="text-slate-500 mb-6 font-medium">Anda terdeteksi melakukan pelanggaran. Silakan lapor ke pengawas untuk membuka kunci ini.</p>
        <Button onClick={() => window.location.reload()} className="w-full bg-slate-900 hover:bg-black text-white rounded-2xl h-12 font-bold uppercase tracking-widest text-xs">Coba Cek Ulang</Button>
      </div>
    </div>
  );

  const currentQuestion = questions[currentQuestionIndex];
  const unansweredCount = questions.filter((q) => answers[q.id] === undefined).length;
  const isAllAnswered = unansweredCount === 0;

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden select-none font-sans">
      {/* 🏙️ Optimized Header */}
      <header className="h-14 px-6 bg-white dark:bg-slate-800 border-b flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-4">
           <div className={`px-4 py-1.5 rounded-2xl font-mono font-black text-base shadow-sm border-2 ${timeLeft < 300 ? "bg-red-50 border-red-200 text-red-600 animate-pulse" : "bg-blue-50 border-blue-100 text-blue-700"}`}>
             {formatTime(timeLeft)}
           </div>
        </div>
        <div className="hidden lg:flex flex-col items-center flex-1">
           <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{roomData?.subject} — {roomData?.teacherName}</h2>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{roomData?.examTitle} · {roomData?.room_name}</p>
        </div>
        <div className="flex items-center gap-3 text-right">
           <div className="flex flex-col">
             <span className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase">{student?.name}</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-100 dark:bg-slate-700 px-1.5 rounded w-fit ml-auto">{student?.className}</span>
           </div>
        </div>
      </header>

      {/* 🚀 Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* 📑 Question Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-100/40">
          <div className="max-w-4xl mx-auto space-y-4 pb-20">
            {currentQuestion && (
              <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/60 dark:shadow-none overflow-hidden bg-white ring-1 ring-slate-200/50">
                <CardHeader className="bg-slate-50/80 border-b border-slate-100 px-8 py-5 flex-row items-center justify-between">
                   <div className="flex items-center gap-4">
                     <span className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/30">
                        {currentQuestionIndex + 1}
                     </span>
                     <div className="flex flex-col">
                       <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-0.5">Pertanyaan</span>
                       <span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">Soal Nomor {currentQuestionIndex + 1}</span>
                     </div>
                   </div>
                   <button onClick={() => toggleFlag(currentQuestion.id)} className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all ${flaggedQuestions[currentQuestion.id] ? "bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20 rotate-12 scale-110" : "bg-white border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-200"}`}>
                      <Bookmark className={`w-6 h-6 ${flaggedQuestions[currentQuestion.id] ? "fill-current" : ""}`} />
                   </button>
                </CardHeader>
                
                <CardContent className="p-8 pt-6 space-y-6">
                  {/* WACANA LITERASI */}
                  {currentQuestion.groupId && (() => {
                    const firstInGroup = questions.find(q => q.groupId === currentQuestion.groupId);
                    if (firstInGroup) {
                      const textToShow = firstInGroup.groupText || firstInGroup.text;
                      if (!textToShow) return null;
                      return (
                        <div className="bg-blue-50/40 border-2 border-dashed border-blue-200/50 p-6 rounded-3xl mb-6 relative group overflow-hidden">
                          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                             <HelpCircle className="w-20 h-20 text-blue-600" />
                          </div>
                          <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-100/50 px-3 py-1 rounded-full mb-3 block w-fit">Informasi Wacana</span>
                          <div className="text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed ql-editor p-0 italic" dangerouslySetInnerHTML={{ __html: textToShow }} />
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* TEKS SOAL */}
                  <div className="text-lg sm:text-xl font-medium leading-relaxed text-slate-800 dark:text-white ql-editor p-0" 
                    dangerouslySetInnerHTML={{ __html: currentQuestion.text }}
                  />

                  {currentQuestion.imageUrl && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-2 bg-slate-50 border rounded-3xl w-fit max-w-full">
                       <img src={currentQuestion.imageUrl} alt="Stimulus" className="max-h-80 w-auto rounded-2xl shadow-sm cursor-zoom-in" onClick={() => setPreviewImage(currentQuestion.imageUrl || null)} />
                    </motion.div>
                  )}

                  <hr className="border-slate-100 my-6" />

                  {/* ✏️ Answer Interface Types */}
                  <div className="space-y-4">
                    {/* PG / PG KOMPLEKS */}
                    {(currentQuestion.type === "pilihan_ganda" || currentQuestion.type === "pilihan_ganda_kompleks") && (
                      <div className="grid gap-3">
                        {(() => {
                           const order = choicesOrder[currentQuestion.id] || Object.keys(currentQuestion.choices || {});
                           return order.map((choiceId, idx) => {
                             const choice = currentQuestion.choices![choiceId];
                             const isMultiple = currentQuestion.type === "pilihan_ganda_kompleks";
                             const isSelected = isMultiple ? (answers[currentQuestion.id] || []).includes(choiceId) : (answers[currentQuestion.id] === choiceId);
                             return (
                               <button key={choiceId} onClick={() => {
                                 if (isMultiple) {
                                   const cur = answers[currentQuestion.id] || [];
                                   handleAnswerSelect(currentQuestion.id, cur.includes(choiceId) ? cur.filter((i:any) => i !== choiceId) : [...cur, choiceId]);
                                 } else handleAnswerSelect(currentQuestion.id, choiceId);
                               }} className={`group w-full p-5 rounded-[1.5rem] border-2 text-left flex items-start gap-4 transition-all active:scale-[0.98] ${isSelected ? "bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/20" : "bg-white border-slate-100 hover:border-blue-200 hover:bg-blue-50/30"}`}>
                                  <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-black text-sm transition-all ${isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600"}`}>
                                    {String.fromCharCode(65 + idx)}
                                  </div>
                                  <div className="flex-1 pt-1.5 font-bold text-sm sm:text-base leading-snug">
                                     <div dangerouslySetInnerHTML={{ __html: choice.text }} />
                                     {choice.imageUrl && <img src={choice.imageUrl} alt="Option" className="max-h-32 rounded-lg mt-3 border shadow-sm" />}
                                  </div>
                                  {isMultiple && <div className={`w-6 h-6 rounded-lg border-2 mt-1.5 flex items-center justify-center ${isSelected ? "bg-white border-white text-blue-600" : "border-slate-200"}`}>{isSelected && <CheckCircle2 className="w-4 h-4" />}</div>}
                               </button>
                             );
                           });
                        })()}
                      </div>
                    )}

                    {/* BENAR / SALAH */}
                    {currentQuestion.type === "benar_salah" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                        {Object.keys(currentQuestion.choices || {}).map((choiceId, idx) => {
                           const isSelected = answers[currentQuestion.id] === choiceId;
                           const isBenar = currentQuestion.choices![choiceId].text.toLowerCase().includes("benar") || idx === 0;
                           return (
                             <button key={choiceId} onClick={() => handleAnswerSelect(currentQuestion.id, choiceId)} className={`relative overflow-hidden py-10 rounded-[2.5rem] border-4 transition-all active:scale-95 flex flex-col items-center gap-4 ${isSelected ? (isBenar ? "bg-emerald-600 border-emerald-500 text-white" : "bg-red-600 border-red-500 text-white") : "bg-white border-slate-100 text-slate-400"}`}>
                                <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center transition-all ${isSelected ? "bg-white/20" : "bg-slate-50"}`}>
                                   {isBenar ? <CheckCircle2 className={`w-10 h-10 ${isSelected ? "text-white" : "text-emerald-500"}`} /> : <X className={`w-10 h-10 ${isSelected ? "text-white" : "text-red-500"}`} />}
                                </div>
                                <span className="font-black text-lg uppercase tracking-[0.2em]">{currentQuestion.choices![choiceId].text}</span>
                             </button>
                           );
                        })}
                      </div>
                    )}

                    {/* MENJODOHKAN */}
                    {currentQuestion.type === "menjodohkan" && (
                      <div className="space-y-4">
                        <div className="flex flex-col lg:flex-row gap-8">
                          <div className="flex-1 space-y-3">
                             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 w-fit px-3 py-1 rounded-full mb-2">Pernyataan</div>
                             {(currentQuestion.pairs || []).map(p => {
                               const val = (answers[currentQuestion.id] || {})[p.id];
                               return (
                                 <div key={p.id} className="flex items-center gap-3 group">
                                    <div className="flex-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-sm text-slate-800 shadow-sm transition-all group-hover:border-blue-100 group-hover:bg-blue-50/30 line-clamp-2">{p.left}</div>
                                    <div className="w-10 h-10 flex items-center justify-center text-slate-200"><ArrowRight className="w-5 h-5" /></div>
                                    <div onClick={() => {
                                      const newAns = { ...answers[currentQuestion.id] }; delete newAns[p.id]; handleAnswerSelect(currentQuestion.id, newAns);
                                    }} className={`flex-1 p-4 rounded-3xl border-4 border-dashed flex items-center justify-center text-xs font-black transition-all cursor-pointer min-h-[60px] ${val ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20" : "bg-white border-slate-100 text-slate-300 hover:border-slate-300 italic"}`}>
                                       {val || "Pasangkan—"}
                                    </div>
                                 </div>
                               );
                             })}
                          </div>
                          <div className="lg:w-[280px] space-y-4">
                             <div className="p-6 bg-slate-100/50 rounded-[2rem] border-2 border-slate-100 h-full flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase mb-4 block tracking-widest text-center">Box Pilihan</span>
                                <div className="flex flex-wrap gap-2 content-start flex-1">
                                   {(matchingOptions[currentQuestion.id] || []).filter(o => !Object.values(answers[currentQuestion.id] || {}).includes(o)).map(o => (
                                     <button key={o} onClick={() => {
                                        const pair = (currentQuestion.pairs || []).find(p => !(answers[currentQuestion.id] || {})[p.id]);
                                        if (pair) handleAnswerSelect(currentQuestion.id, { ...(answers[currentQuestion.id] || {}), [pair.id]: o });
                                     }} className="px-4 py-2 bg-white border-2 border-slate-100 rounded-2xl text-[11px] font-black text-blue-600 shadow-sm hover:border-blue-400 hover:scale-105 transition-all">
                                        {o}
                                     </button>
                                   ))}
                                </div>
                             </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ISIAN / URUTKAN */}
                    {(currentQuestion.type === "isian_singkat" || currentQuestion.type === "uraian") && (
                      <textarea value={answers[currentQuestion.id] || ""} onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)} placeholder="Tuliskan jawaban Anda secara lengkap disini..." rows={currentQuestion.type === "uraian" ? 10 : 3} className="w-full p-6 rounded-[2rem] border-2 border-slate-100 bg-white ring-offset-2 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 text-base font-black text-slate-800 placeholder:text-slate-300 transition-all resize-none shadow-inner" />
                    )}

                    {/* ORDERING */}
                    {(currentQuestion.type === "urutkan" || currentQuestion.type === "drag_drop") && (
                      <Reorder.Group axis="y" values={answers[currentQuestion.id] || itemsOrder[currentQuestion.id] || (currentQuestion.items || []).map(it => it.id)} onReorder={(o:string[]) => handleAnswerSelect(currentQuestion.id, o)} className="space-y-2.5">
                         {(answers[currentQuestion.id] || itemsOrder[currentQuestion.id] || (currentQuestion.items || []).map(it => it.id)).map((id:string) => {
                            const item = currentQuestion.items?.find(it => it.id === id);
                            return (
                              <Reorder.Item key={id} value={id} className="p-4 bg-white border-2 border-slate-100 rounded-2xl flex items-center gap-4 cursor-grab active:cursor-grabbing shadow-sm hover:border-blue-300 transition-colors">
                                 <GripVertical className="w-5 h-5 text-slate-300" />
                                 <span className="text-sm font-black text-slate-700">{item?.text}</span>
                              </Reorder.Item>
                            );
                         })}
                      </Reorder.Group>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>

        {/* 🧭 Optimized Sidebar */}
        <aside className="hidden lg:flex w-80 bg-white border-l flex-col shadow-inner overflow-hidden">
           <div className="p-6 border-b">
              <div className="flex items-center gap-2 mb-4">
                 <Menu className="w-4 h-4 text-slate-400" />
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Navigasi Soal</h3>
              </div>
              <div className="grid grid-cols-5 gap-2">
                 {questions.map((q, i) => {
                    const isA = answers[q.id] !== undefined;
                    const isC = i === currentQuestionIndex;
                    const isF = flaggedQuestions[q.id];
                    return (
                      <button key={q.id} onClick={() => handleNavClick(i)} className={`w-full aspect-square rounded-2xl border-2 flex items-center justify-center font-black text-xs transition-all ${isC ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/40 -translate-y-1" : isA ? "bg-emerald-500 border-emerald-400 text-white" : isF ? "bg-amber-400 border-amber-300 text-white shadow-lg shadow-amber-400/20" : "bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200"}`}>
                         {i + 1}
                      </button>
                    );
                 })}
              </div>
           </div>
           
           <div className="p-6 mt-auto bg-slate-50/50 border-t space-y-3">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentQuestionIndex(p => p - 1)} disabled={currentQuestionIndex === 0} className="flex-1 rounded-[1.2rem] h-12 font-black uppercase text-[10px] tracking-widest border-2">Sebelumnya</Button>
                <Button onClick={() => currentQuestionIndex === questions.length - 1 ? setIsSubmitModalOpen(true) : handleNextClick()} className={`flex-1 rounded-[1.2rem] h-12 font-black uppercase text-[10px] tracking-widest text-shadow-sm ${currentQuestionIndex === questions.length - 1 ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"}`}>
                   {currentQuestionIndex === questions.length - 1 ? "Selesai" : "Lanjut"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 px-2">
                 <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aktif</span></div>
                 <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Terjawab</span></div>
                 <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-amber-400 rounded-full"></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ragu-ragu</span></div>
              </div>
           </div>
        </aside>
      </div>

      {/* 📱 Mobile Optimized Controls */}
      <div className="lg:hidden sticky bottom-0 left-0 right-0 bg-white border-t p-4 flex items-center justify-between z-30 shadow-2xl">
         <Button variant="outline" onClick={() => setCurrentQuestionIndex(p => p - 1)} disabled={currentQuestionIndex === 0} className="rounded-2xl h-12 px-4 border-2"><ChevronLeft className="w-6 h-6" /></Button>
         <button onClick={() => setIsNavModalOpen(true)} className="flex flex-col items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</span>
            <span className="text-sm font-black text-blue-600">{currentQuestionIndex + 1} / {questions.length}</span>
         </button>
         {currentQuestionIndex === questions.length - 1 ? (
           <Button onClick={() => setIsSubmitModalOpen(true)} className="bg-emerald-600 rounded-2xl h-12 px-6 font-black uppercase text-[10px]">Finish</Button>
         ) : (
           <Button onClick={handleNextClick} className="bg-blue-600 rounded-2xl h-12 px-4"><ChevronRight className="w-6 h-6" /></Button>
         )}
      </div>

      <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
        <DialogContent className="max-w-md rounded-[3rem] p-8 pointer-events-auto border-none shadow-2xl">
           <DialogHeader className="text-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                 <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <DialogTitle className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Kumpulkan Ujian?</DialogTitle>
              <DialogDescription className="text-slate-500 font-medium px-4">
                {isAllAnswered ? "Hebat! Semua soal sudah terjawab. Apakah Anda yakin ingin menyelesaikan ujian sekarang?" : `Peringatan! Masih ada ${unansweredCount} soal yang terlewat. Yakin ingin mengakhiri sekarang?`}
              </DialogDescription>
           </DialogHeader>
           <div className="grid grid-cols-2 gap-4 mt-8">
              <Button variant="outline" onClick={() => setIsSubmitModalOpen(false)} className="rounded-2xl h-14 font-black uppercase text-xs">Batal</Button>
              <Button onClick={() => { setIsSubmitModalOpen(false); handleSubmitExam(); }} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-14 font-black uppercase text-xs shadow-lg shadow-emerald-500/20">Kumpulkan</Button>
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetModalOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm text-center rounded-[3rem] p-8 pointer-events-auto border-none shadow-2xl">
           <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-6 animate-bounce" />
           <DialogTitle className="text-xl font-black text-slate-800 uppercase">Sesi Di-Reset!</DialogTitle>
           <p className="text-sm text-slate-500 font-medium mb-8">Pengawas telah me-reset sesi ujian Anda. Anda harus kembali ke halaman login.</p>
           <Button onClick={() => logoutStudent()} className="bg-red-600 hover:bg-red-700 w-full rounded-2xl h-14 font-black uppercase text-xs shadow-lg shadow-red-500/20">Oke, Keluar</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isSkipNoticeOpen} onOpenChange={setIsSkipNoticeOpen}>
        <DialogContent className="max-w-xs rounded-[2rem] p-8 border-none text-center pointer-events-auto shadow-2xl">
           <HelpCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
           <DialogTitle className="text-lg font-black uppercase">Belum Dijawab</DialogTitle>
           <p className="text-xs text-slate-500 font-medium mb-8">Soal ini wajib diisi sebelum lanjut. Yakin ingin mengosongkannya?</p>
           <div className="flex flex-col gap-3">
              <Button onClick={() => { if(targetIndex !== null) goToQuestion(targetIndex); setIsSkipNoticeOpen(false); }} className="bg-slate-900 w-full rounded-xl h-12 font-black uppercase text-[10px]">Ya, Lewati</Button>
              <Button variant="outline" onClick={() => setIsSkipNoticeOpen(false)} className="w-full rounded-xl h-12 font-black uppercase text-[10px]">Tulis Jawaban</Button>
           </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {previewImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreviewImage(null)} className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
             <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} src={previewImage} className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" alt="Preview" />
             <Button className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white rounded-full w-12 h-12"><X className="w-6 h-6" /></Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CBTPage;
