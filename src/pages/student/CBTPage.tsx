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
  GripVertical,
  ShieldAlert,
  User,
  FileText
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
  status: "ongoing" | "submitted" | "LOCKED" | "finished";
  cheatCount: number;
  score?: number;
  correct?: number;
  total?: number;
  extraCheatLimit?: number;
  startTime?: string | number;
  start_time?: string | number;
  created?: string;
  isOnline?: boolean;
  overrides?: Record<string, boolean>;
  answers?: Record<string, any>;
  lastHeartbeat?: string;
  startedAt?: string;
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

const formatStudentName = (name?: string) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts[0];
};

const CBTPage = () => {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { student, logoutStudent } = useStudentAuth();

  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (paramRoomId) {
      sessionStorage.setItem("activeCBTRoomId", paramRoomId);
      setRoomId(paramRoomId);
      navigate("/cbt", { replace: true });
    } else {
      const saved = sessionStorage.getItem("activeCBTRoomId");
      if (saved) {
        setRoomId(saved);
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [paramRoomId, navigate]);

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
  const [gimmickTimer, setGimmickTimer] = useState<number>(0);
  const [isSkipNoticeOpen, setIsSkipNoticeOpen] = useState(false); 
  const [targetIndex, setTargetIndex] = useState<number | null>(null); 

  const saveTimeoutRef = useRef<any>(null);
  const cheatTimerRef = useRef<any>(null);
  const isIndexRestored = useRef(false);
  const isCreatingRef = useRef(false);

  const [choicesOrder, setChoicesOrder] = useState<Record<string, string[]>>({});
  const [itemsOrder, setItemsOrder] = useState<Record<string, string[]>>({});
  const [matchingOptions, setMatchingOptions] = useState<Record<string, string[]>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});

  const parseSafeDate = (d: any) => {
    if (!d) return null;
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date;
  };

  const toggleFlag = (qId: string) => {
    const p = `${student?.nisn}_${roomId}`;
    setFlaggedQuestions(prev => {
      const u = { ...prev, [qId]: !prev[qId] };
      sessionStorage.setItem(`flags_${p}`, JSON.stringify(u));
      return u;
    });
  };

  const safeUpdateAttempt = async (attId: string, data: any) => {
    try {
      const payload = { ...data };
      return await pb.collection("attempts").update(attId, payload);
    } catch (err: any) {
      if (err.status === 400) {
        try {
          const fallbackData = { ...data };
          if (fallbackData.isOnline !== undefined) { fallbackData.is_online = fallbackData.isOnline; delete fallbackData.isOnline; }
          if (fallbackData.lastHeartbeat !== undefined) { fallbackData.last_heartbeat = fallbackData.lastHeartbeat; delete fallbackData.lastHeartbeat; }
          if (fallbackData.cheatCount !== undefined) { fallbackData.cheat_count = fallbackData.cheatCount; delete fallbackData.cheatCount; }
          if (fallbackData.startTime !== undefined) { fallbackData.startedAt = fallbackData.startTime; delete fallbackData.startTime; }
          if (fallbackData.submittedAt === undefined && fallbackData.submitTime !== undefined) { fallbackData.submittedAt = fallbackData.submitTime; delete fallbackData.submitTime; }
          if (fallbackData.score !== undefined) { fallbackData.scoreValue = fallbackData.score; }
          if (fallbackData.correct !== undefined) { fallbackData.correctCount = fallbackData.correct; }
          if (fallbackData.total !== undefined) { fallbackData.totalQuestions = fallbackData.total; }
          return await pb.collection("attempts").update(attId, fallbackData);
        } catch (err2) {
          const minimalData: any = {};
          if (data.answers) minimalData.answers = data.answers;
          if (data.status) minimalData.status = data.status;
          if (Object.keys(minimalData).length > 0) {
            return await pb.collection("attempts").update(attId, minimalData);
          }
          throw err2;
        }
      }
      throw err;
    }
  };

  const handleAnswerSelect = (questionId: string, value: any) => {
    if (isExamOver || isLocked || !attempt) return;
    setAnswers(p => {
      const u = { ...p, [questionId]: value };
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        safeUpdateAttempt(attempt.id, { 
          answers: u, 
          isOnline: true, 
          lastHeartbeat: new Date().toISOString() 
        });
      }, 500);
      return u;
    });
  };

  const goToQuestion = (index: number) => {
    if (index === currentQuestionIndex) return;
    setTargetIndex(null); setCurrentQuestionIndex(index);
    sessionStorage.setItem(`currentIndex_${student?.nisn}_${roomId}`, index.toString());
  };

  const handleNextClick = () => {
    const q = questions[currentQuestionIndex];
    if (!q) return;
    const isA = answers[q.id] !== undefined;
    if (!isA && !(!q.type || q.type.startsWith("pilihan_ganda"))) { 
      setTargetIndex(currentQuestionIndex + 1); setIsSkipNoticeOpen(true); return; 
    }
    if (currentQuestionIndex < questions.length - 1) goToQuestion(currentQuestionIndex + 1);
  };

  const handleNavClick = (idx: number) => {
    const q = questions[currentQuestionIndex];
    if (!q) return;
    const isA = answers[q.id] !== undefined;
    if (!isA && idx !== currentQuestionIndex && !(!q.type || q.type.startsWith("pilihan_ganda"))) { 
      setTargetIndex(idx); setIsSkipNoticeOpen(true); return; 
    }
    goToQuestion(idx); setIsNavModalOpen(false);
  };

  const loadExamData = useCallback(async () => {
    if (!student || !roomId) return;
    try {
      setLoading(true);
      const rData = await pb.collection("exam_rooms").getOne(roomId, { expand: "examId,examId.subjectId,examId.teacherId" });
      if (rData.status === "archive" || rData.isActive === false) throw new Error("Nonaktif/Arsip");

      const ex = rData.expand?.examId;
      setRoomData({ ...rData, examTitle: rData.room_name || ex?.title || "CBT", subject: ex?.expand?.subjectId?.name || "Ujian", teacherName: ex?.expand?.teacherId?.name || "-" });

      const qRecord = await pb.collection("questions").getFullList({ filter: `examId = "${rData.examId}"`, sort: "order,created" });
      const loaded: Question[] = qRecord.map(q => {
        const tM: any = { "multiple_choice": "pilihan_ganda", "complex_multiple_choice": "pilihan_ganda_kompleks", "short_answer": "isian_singkat", "essay": "uraian", "matching": "menjodohkan", "ordering": "urutkan", "true_false": "benar_salah", "pilihan_ganda": "pilihan_ganda", "pilihan_ganda_kompleks": "pilihan_ganda_kompleks", "isian_singkat": "isian_singkat", "uraian": "uraian", "menjodohkan": "menjodohkan", "urutkan": "urutkan", "benar_salah": "benar_salah" };
        return { id: q.id, type: (tM[q.field || q.type] || "pilihan_ganda"), text: q.text, imageUrl: q.imageUrl, groupId: q.groupId, groupText: q.groupText, choices: q.options, pairs: q.options?.pairs, items: q.options?.items, answerKey: q.answerKey };
      });

      const existingAttempts = await pb.collection("attempts").getFullList({ filter: `studentId = "${student.id}" && examRoomId = "${roomId}"`, sort: "-created" });
      let att: any = null;
      if (existingAttempts.length > 0) {
        att = existingAttempts[0];
        if (att.status === "finished") { navigate("/cbt/" + roomId + "/result"); return; }
        if (att.status === "LOCKED") setIsLocked(true);
        setAnswers(att.answers || {});
        safeUpdateAttempt(att.id, { isOnline: true, lastHeartbeat: new Date().toISOString() });
      } else {
        if (isCreatingRef.current) return;
        isCreatingRef.current = true;
        try {
          const secondCheck = await pb.collection("attempts").getFullList({ filter: `studentId = "${student.id}" && examRoomId = "${roomId}"` });
          if (secondCheck.length > 0) { att = secondCheck[0]; }
          else {
            att = await pb.collection("attempts").create({ studentId: student.id, examRoomId: roomId, status: "ongoing", cheatCount: 0, startedAt: new Date().toISOString(), isOnline: true, lastHeartbeat: new Date().toISOString(), answers: {} });
          }
        } finally { isCreatingRef.current = false; }
      }
      setAttempt(att);

      const clusterShuffle = (list: string[]): string[] => {
        const g: Record<string, string[]> = {}; const s: string[] = [];
        list.forEach(id => { const q = loaded.find(x => x.id === id); if (q?.groupId) { if(!g[q.groupId]) g[q.groupId] = []; g[q.groupId].push(id); } else s.push(id); });
        const nC: Record<string, string[]> = {}; const nI: Record<string, string[]> = {}; const nM: Record<string, string[]> = {};
        loaded.forEach((q: any) => {
          if (q.choices) { const k = Object.keys(q.choices); for (let i = k.length-1; i>0; i--) { const j = Math.floor(Math.random()*(i+1)); [k[i], k[j]] = [k[j], k[i]]; } nC[q.id] = k; }
          if (q.items && (q.type === "urutkan" || q.type === "drag_drop")) { const ids = q.items.map((it:any)=>it.id); for(let i=ids.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [ids[i],ids[j]]=[ids[j],ids[i]]; } nI[q.id] = ids; }
          if (q.pairs && q.type === "menjodohkan") { const rO = Array.from(new Set((q.pairs as any[]).map(p=>p.right))); for(let i=rO.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [rO[i],rO[j]]=[rO[j],rO[i]]; } nM[q.id] = rO as string[]; }
        });
        const pr = `${student.nisn}_${roomId}`;
        const sC = sessionStorage.getItem(`choices_${pr}`); if(sC) try{Object.assign(nC, JSON.parse(sC));}catch(e){}
        const sI = sessionStorage.getItem(`items_${pr}`); if(sI) try{Object.assign(nI, JSON.parse(sI));}catch(e){}
        const sM = sessionStorage.getItem(`match_${pr}`); if(sM) try{Object.assign(nM, JSON.parse(sM));}catch(e){}
        sessionStorage.setItem(`choices_${pr}`, JSON.stringify(nC));
        sessionStorage.setItem(`items_${pr}`, JSON.stringify(nI));
        sessionStorage.setItem(`match_${pr}`, JSON.stringify(nM));
        setChoicesOrder(nC); setItemsOrder(nI); setMatchingOptions(nM);
        const col: (string | string[])[] = [...s, ...Object.values(g)];
        for (let i=col.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [col[i],col[j]]=[col[j],col[i]]; }
        return col.flat();
      };

      const pr = `${student.nisn}_${roomId}`;
      let sO = sessionStorage.getItem(`order_${pr}`);
      let order: string[] = [];
      const curIds = loaded.map(q => q.id);
      if (sO) { try { order = JSON.parse(sO).filter((id:string)=>curIds.includes(id)); const n = curIds.filter(id => !order.includes(id)); if(n.length>0) order = [...order, ...clusterShuffle(n)]; sessionStorage.setItem(`order_${pr}`, JSON.stringify(order)); } catch(e){} }
      if (order.length === 0) {
        const pg = curIds.filter(id => { const q = loaded.find(x => x.id===id); return !q?.type || q.type.startsWith("pilihan_ganda"); });
        const es = curIds.filter(id => { const q = loaded.find(x => x.id===id); return q?.type === "isian_singkat" || q?.type === "uraian"; });
        const it = curIds.filter(id => !pg.includes(id) && !es.includes(id));
        order = [...clusterShuffle(pg), ...clusterShuffle(it), ...clusterShuffle(es)];
        sessionStorage.setItem(`order_${pr}`, JSON.stringify(order));
      }

      setQuestions(order.map(id => loaded.find(x => x.id === id)).filter(x => !!x) as Question[]);
      const sIndexStored = sessionStorage.getItem(`currentIndex_${pr}`);
      if (sIndexStored && !isIndexRestored.current) { const idx = parseInt(sIndexStored, 10); if(idx >= 0 && idx < order.length) setCurrentQuestionIndex(idx); }
      isIndexRestored.current = true;

      const stD = parseSafeDate(att.startTime) || new Date();
      const dur = (rData.duration || 60) * 60000;
      const targetEnd = new Date(stD.getTime() + dur);
      const roomEnd = parseSafeDate(rData.end_time);
      const actualEnd = roomEnd && roomEnd.getTime() < targetEnd.getTime() ? roomEnd : targetEnd;
      const diff = Math.floor((actualEnd.getTime() - Date.now()) / 1000);
      if (diff <= 0) setIsExamOver(true); setTimeLeft(Math.max(0, diff));
      const sFlagStored = sessionStorage.getItem(`flags_${pr}`); if(sFlagStored) try{ setFlaggedQuestions(JSON.parse(sFlagStored)); }catch(e){}
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [student, roomId, navigate]);

  useEffect(() => { loadExamData(); }, [loadExamData]);

  useEffect(() => {
    if (!roomData?.examId || !roomId || !attempt?.id) return;
    const rId = roomId;
    const unsubQuestions = pb.collection("questions").subscribe("*", (e) => { if (e.record.examId === roomData.examId) loadExamData(); });
    const unsubRoom = pb.collection("exam_rooms").subscribe(rId, (e) => {
      if (e.action === "update") {
        setRoomData((prev: any) => ({ ...prev, ...e.record }));
        const isOff = e.record.isDisabled === true || e.record.status === "archive";
        if (isOff) navigate("/dashboard");
      }
    });
    const unsubAttempt = pb.collection("attempts").subscribe(attempt.id, (e) => {
      if (e.action === "delete") navigate("/dashboard");
      else if (e.action === "update") { 
        const oldS = attempt.status;
        const newS = (e.record as any).status;
        setAttempt(e.record as any); 
        
        if (newS === "LOCKED") {
          setIsLocked(true);
        } else if (newS === "ongoing") {
           setIsLocked(false);
           if (oldS === "LOCKED") {
              // Jika baru saja dibuka kuncinya oleh admin
              localStorage.removeItem(`lock_time_${attempt.id}`);
              navigate("/dashboard"); // Wajib masukin token ulang
           }
        }
      }
    });
    return () => { unsubQuestions.then(u => u()); unsubRoom.then(u => u()); unsubAttempt.then(u => u()); };
  }, [roomData, roomId, attempt, navigate, loadExamData]);

  useEffect(() => {
    if (loading || isLocked || isExamOver || !roomData || !attempt) return;
    const timer = setInterval(() => {
      const st = parseSafeDate(attempt.startTime || attempt.start_time || attempt.created) || new Date();
      const dur = (roomData.duration || 60) * 60000;
      const targetEnd = new Date(st.getTime() + dur);
      const roomEnd = parseSafeDate(roomData.end_time);
      const actualEnd = roomEnd && roomEnd.getTime() < targetEnd.getTime() ? roomEnd : targetEnd;
      const d = Math.floor((actualEnd.getTime() - Date.now()) / 1000);
      if (d <= 0) { clearInterval(timer); setTimeLeft(0); setIsExamOver(true); } 
      else setTimeLeft(d);
    }, 1000);
    const heartbeat = setInterval(() => { if(attempt?.id) safeUpdateAttempt(attempt.id, { isOnline: true, lastHeartbeat: new Date().toISOString() }); }, 30000);
    return () => { clearInterval(timer); clearInterval(heartbeat); };
  }, [loading, isLocked, isExamOver, roomData, attempt]);

  useEffect(() => {
    if (!attempt?.id || isLocked || isExamOver) return;
    const triggerPenalty = async () => {
      const newCount = (attempt.cheatCount || 0) + 1;
      const limit = (roomData?.cheat_limit || 3) + (attempt.extraCheatLimit || 0);
      try {
        await safeUpdateAttempt(attempt.id, { cheatCount: newCount, status: newCount >= limit ? "LOCKED" : "ongoing" });
        if (newCount >= limit) setIsLocked(true); else setIsCheatWarningOpen(true);
      } catch (err) { }
    };
    const handleCheatDetection = (e: Event) => {
      if (document.visibilityState === "hidden" || e.type === "blur") { if (!cheatTimerRef.current) cheatTimerRef.current = setTimeout(triggerPenalty, 5000); }
      else { if (cheatTimerRef.current) { clearTimeout(cheatTimerRef.current); cheatTimerRef.current = null; } }
    };
    window.addEventListener("visibilitychange", handleCheatDetection);
    window.addEventListener("blur", handleCheatDetection);
    window.addEventListener("focus", handleCheatDetection);
    return () => { window.removeEventListener("visibilitychange", handleCheatDetection); window.removeEventListener("blur", handleCheatDetection); window.removeEventListener("focus", handleCheatDetection); if(cheatTimerRef.current) clearTimeout(cheatTimerRef.current); };
  }, [attempt, roomData, isLocked, isExamOver]);

  useEffect(() => {
    const p = (e: Event) => { e.preventDefault(); return false; };
    const k = (e: KeyboardEvent) => { if (e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key === "I") || (e.ctrlKey && e.key === "u") || (e.ctrlKey && e.key === "s") || (e.ctrlKey && e.key === "p")) { e.preventDefault(); return false; } };
    window.addEventListener("contextmenu", p); window.addEventListener("copy", p); window.addEventListener("cut", p); window.addEventListener("paste", p); window.addEventListener("keydown", k);
    return () => { window.removeEventListener("contextmenu", p); window.removeEventListener("copy", p); window.removeEventListener("cut", p); window.removeEventListener("paste", p); window.removeEventListener("keydown", k); };
  }, []);

  const handleSubmitExam = useCallback(async () => {
    if (!student || !roomId || !attempt || attempt.status !== "ongoing") return;
    setLoading(true);
    try {
      let c = 0;
      const ovr = attempt.overrides || {};
      questions.forEach((q: any) => {
        if (ovr[q.id] !== undefined) { if (ovr[q.id] === true) c++; return; }
        const sa = answers[q.id]; if (!sa) return;
        const t = q.type || "pilihan_ganda";
        if (t === "pilihan_ganda" || t === "benar_salah") { if (q.choices?.[sa]?.isCorrect === true) c++; }
        else if (t === "pilihan_ganda_kompleks") { const ck = Object.keys(q.choices).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase()); const sk = Array.isArray(sa) ? sa.map(k => String(k).toLowerCase()) : []; if (sk.length === ck.length && sk.every(k => ck.includes(k))) c++; }
        else if (t === "menjodohkan") { let cp = 0; (q.pairs || []).forEach((p:any) => { if(sa[p.id] === p.right) cp++; }); if (q.pairs?.length > 0) c += (cp / q.pairs.length); }
        else if (t === "isian_singkat") { if (q.answerKey && isFuzzyMatch(sa, q.answerKey)) c++; }
        else if (t === "urutkan") { const co = (q.items || []).map((it:any) => it.id); if (Array.isArray(sa) && sa.length === co.length && sa.every((v, index) => v === co[index])) c++; }
      });
      const score = Math.round((c / questions.length) * 100) || 0;
      const st = attempt.startedAt || attempt.startTime || attempt.created || Date.now();
      const usedTime = Math.floor((Date.now() - new Date(st as any).getTime()) / 1000);
      await safeUpdateAttempt(attempt.id, { score, correct: Math.floor(c), total: questions.length, usedTime: Math.max(0, usedTime), status: "finished", submittedAt: new Date().toISOString() });
      const pr = `${student.nisn}_${roomId}`; sessionStorage.removeItem(`order_${pr}`); sessionStorage.removeItem(`currentIndex_${pr}`);
      navigate(`/cbt/${roomId}/result`);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [student, roomId, attempt, questions, answers, navigate]);

  useEffect(() => {
    if (!isLocked || !attempt?.id) { setGimmickTimer(0); return; }
    const lockKey = `lock_time_${attempt.id}`;
    let startTime = parseInt(localStorage.getItem(lockKey) || "0");
    if (!startTime) {
      startTime = Date.now();
      localStorage.setItem(lockKey, startTime.toString());
    }
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, 600 - elapsed);
      setGimmickTimer(remaining);
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [isLocked, attempt?.id]);

  useEffect(() => {
    if (!isLocked) return;
    const handlePopState = () => { window.history.pushState(null, "", window.location.href); };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isLocked]);

  useEffect(() => { if (isExamOver && !loading && attempt?.status === "ongoing") handleSubmitExam(); }, [isExamOver, loading, attempt?.status, handleSubmitExam]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-600 border-t-transparent shadow-lg shadow-emerald-100"></div></div>;
   if (isLocked) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-center max-w-sm border border-red-100 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-2 bg-red-600"></div>
        <div className="relative z-10">
          <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6"><ShieldAlert className="w-10 h-10 text-red-600 animate-pulse" /></div>
          <h2 className="text-2xl font-black text-red-600 mb-3 uppercase tracking-tighter">Ujian Terkunci!</h2>
          <p className="text-slate-600 text-[13px] font-bold leading-relaxed mb-6">
             Anda sudah melewati batas yang diizinkan. Mohon jangan curang ya! <br/>
             <span className="text-red-600">Jika alasan tidak terbukti / tidak jelas / berbohong, maka tidak ada akses untuk melanjutkan ujian ini.</span>
          </p>
          
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 mb-8">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Penalti Waktu Keamanan</p>
             <div className="text-4xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter mb-2">
                {gimmickTimer > 0 ? (
                  `${Math.floor(gimmickTimer / 60).toString().padStart(2, '0')}:${(gimmickTimer % 60).toString().padStart(2, '0')}`
                ) : "00:00"}
             </div>
             <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-1000 ${gimmickTimer > 0 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: gimmickTimer > 0 ? `${(gimmickTimer / 600) * 100}%` : "100%" }}></div>
             </div>
             {gimmickTimer > 0 ? (
               <p className="text-[9px] font-bold text-red-500 uppercase mt-4 tracking-widest animate-pulse">Sesi Anda Dibekukan Sementara</p>
             ) : (
               <div className="mt-4 space-y-1">
                 <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Penalti Gimmick Selesai</p>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Silakan Melapor ke Pengawas</p>
               </div>
             )}
          </div>


        </div>
      </div>
    </div>
  );

  const currentQuestion = questions[currentQuestionIndex];
  const unansweredCount = questions.filter((q) => answers[q.id] === undefined).length;
  const isAllAnswered = unansweredCount === 0;

  return (
    <div className="h-screen h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden select-none font-sans">
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl border-b border-slate-100 dark:border-slate-800 h-16 sm:h-20 px-4 sm:px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4">
           <div className="flex items-center gap-2 sm:gap-3 bg-slate-100 dark:bg-slate-800 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <Clock className={`h-4 w-4 sm:h-5 sm:w-5 ${timeLeft < 300 ? "text-rose-500 animate-pulse" : "text-slate-600 dark:text-slate-400"}`} />
             <span className={`font-mono font-black text-sm sm:text-lg tracking-wider ${timeLeft < 300 ? "text-rose-600" : "text-slate-800 dark:text-slate-100"}`}>
               {Math.floor(timeLeft/60).toString().padStart(2,"0")}:{(timeLeft%60).toString().padStart(2,"0")}
             </span>
           </div>
        </div>
        
        <div className="flex-1 text-center min-w-0 px-2 sm:px-4">
          <p className="font-black text-slate-800 dark:text-white uppercase tracking-tight truncate text-[10px] sm:text-base leading-tight">{roomData?.subject}</p>
          <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-0.5 sm:mt-1">{roomData?.room_name}</p>
        </div>

        <div className="flex items-center gap-3 text-right">
           <div className="text-right min-w-0">
              <p className="font-black text-emerald-800 dark:text-emerald-200 text-[10px] sm:text-xs md:text-sm uppercase tracking-tight leading-snug truncate max-w-[80px] sm:max-w-none">
                {formatStudentName(student?.name)}
              </p>
              <p className="text-[8px] sm:text-[9px] font-bold text-emerald-400 uppercase tracking-[0.2em] mt-0.5 sm:mt-1 leading-none">
                {student?.className}
              </p>
           </div>
           <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl sm:rounded-[30%] flex items-center justify-center border border-emerald-100 dark:border-emerald-800 shadow-sm">
              <User className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
           </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 text-slate-800">
          {currentQuestion && (
            <Card className="rounded-[25px] sm:rounded-[35px] border border-slate-100 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
              <CardHeader className="p-5 sm:p-8 pb-3 sm:pb-4">
                <div className="relative flex items-center justify-between gap-4 mb-4 sm:mb-6 min-h-[48px] sm:min-h-[56px]">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 bg-emerald-600 text-white rounded-2xl sm:rounded-[35%] flex items-center justify-center font-black text-xl sm:text-2xl shrink-0">{currentQuestionIndex + 1}</div>
                    <div className="flex flex-col">
                       <span className="text-[9px] sm:text-[10px] font-black text-emerald-400 tracking-[0.2em] uppercase">Pertanyaan</span>
                       <span className="text-base sm:text-xl font-black text-emerald-800 dark:text-white uppercase tracking-tight leading-tight">Soal Nomor {currentQuestionIndex + 1}</span>
                    </div>
                  </div>
                  
                  {/* Bookmark Button - Pindah ke Kanan */}
                  <button 
                    onClick={() => toggleFlag(currentQuestion.id)} 
                    className={`h-11 w-11 sm:h-14 sm:w-14 flex items-center justify-center rounded-2xl sm:rounded-3xl transition-all active:scale-90 ${flaggedQuestions[currentQuestion.id] ? "bg-amber-500 text-white" : "bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700"}`}
                  >
                     <Bookmark className={`w-5 h-5 sm:w-6 sm:h-6 ${flaggedQuestions[currentQuestion.id] ? "fill-white" : ""}`} />
                  </button>
                </div>

                {currentQuestion.imageUrl && (
                  <div className="relative group cursor-zoom-in" onClick={() => setPreviewImage(currentQuestion.imageUrl!)}>
                    <img src={currentQuestion.imageUrl} className="max-w-full h-auto mx-auto block rounded-2xl border border-slate-100 mb-4 sm:mb-6 transition-transform hover:scale-[1.01]" alt="Soal" />
                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                       <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                    </div>
                  </div>
                )}
                {currentQuestion.groupId && (() => {
                  const f = questions.find(x => x.groupId === currentQuestion.groupId);
                  if (f && (f.groupText || f.text)) return (
                    <div className="bg-slate-50 dark:bg-slate-950 p-5 sm:p-8 rounded-[30px] border border-slate-200 dark:border-slate-800 mb-4 sm:mb-6 space-y-4 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                         <FileText className="w-12 h-12 sm:w-20 sm:h-20 text-emerald-800" />
                      </div>
                      
                      <div className="flex items-center gap-3 mb-4 relative z-10">
                        <div className="h-5 sm:h-6 w-1 sm:w-1.5 rounded-full bg-emerald-600"></div>
                        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500 dark:text-emerald-400">Literacy Reference</span>
                      </div>
                      
                      <div 
                        className="text-[15px] sm:text-[16px] leading-relaxed text-slate-800 dark:text-slate-200 font-serif ql-editor !p-0 [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-center [&_h2]:mb-6 [&_h2]:text-slate-900 dark:[&_h2]:text-white [&_p]:mb-4 [&_p]:text-justify [&_img]:rounded-2xl [&_img]:mx-auto [&_img]:block [&_img]:shadow-2xl selection:bg-blue-100 overflow-x-hidden break-words [overflow-wrap:anywhere] [white-space:normal!important] [&_*]:break-words [&_*]:whitespace-normal" 
                        dangerouslySetInnerHTML={{ __html: f.groupText || f.text }} 
                      />
                      
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end opacity-50">
                         <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">Bacalah teks dengan seksama sebelum memberikan jawaban.</span>
                      </div>
                    </div>
                  );
                })()}
                <div className="text-[16px] sm:text-[18px] font-medium leading-relaxed text-[#0f172a] dark:text-slate-200 ql-editor p-0 mb-4 sm:mb-6 overflow-x-hidden break-words [overflow-wrap:anywhere] [&_*]:whitespace-normal [&_*]:break-words" dangerouslySetInnerHTML={{ __html: currentQuestion.text }} />
              </CardHeader>
              <CardContent className="px-5 sm:px-8 pb-6 sm:pb-8 space-y-3">
                {(currentQuestion.type === "pilihan_ganda" || currentQuestion.type === "pilihan_ganda_kompleks" || currentQuestion.type === "benar_salah") && (
                  <div className="space-y-2">
                    {(choicesOrder[currentQuestion.id] || Object.keys(currentQuestion.choices || {})).map((choiceId, idx) => {
                      const c = currentQuestion.choices![choiceId]; const isM = currentQuestion.type === "pilihan_ganda_kompleks"; const isS = isM ? (answers[currentQuestion.id] || []).includes(choiceId) : answers[currentQuestion.id] === choiceId;
                      return (
                        <button key={choiceId} onClick={() => { if(isM){ const a = answers[currentQuestion.id] || []; handleAnswerSelect(currentQuestion.id, a.includes(choiceId) ? a.filter((i:any)=>i!==choiceId) : [...a, choiceId]); } else handleAnswerSelect(currentQuestion.id, choiceId); }} className={`w-full text-left p-2 sm:p-3 rounded-xl sm:rounded-2xl border-2 flex items-center gap-2.5 sm:gap-4 transition-all outline-none group active:scale-[0.99] ${isS ? "bg-emerald-50 border-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-700"}`}>
                           <div className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg sm:rounded-xl border flex items-center justify-center font-black text-xs sm:text-sm transition-colors ${isS ? "bg-emerald-600 border-emerald-600 text-white" : "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800 group-hover:bg-emerald-50 group-hover:text-emerald-900"}`}>{String.fromCharCode(65 + idx)}</div>
                           <div className="flex-1 overflow-hidden">
                              <div className="ql-editor !p-0 text-[14px] sm:text-[15px] font-medium text-slate-800 dark:text-slate-200 leading-snug break-words [overflow-wrap:anywhere] [&_p]:m-0" dangerouslySetInnerHTML={{ __html: c.text }} />
                              {c.imageUrl && (
                                <div className="relative inline-block cursor-zoom-in group mt-4" onClick={(e) => { e.stopPropagation(); setPreviewImage(c.imageUrl!); }}>
                                  <img src={c.imageUrl} className="max-h-[200px] rounded-2xl border border-slate-100 group-hover:brightness-90 transition-all" alt="Choice" />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                     <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                                  </div>
                                </div>
                              )}
                           </div>
                           {isM && <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isS ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-200 dark:border-slate-700"}`}>{isS && <CheckCircle2 className="w-4 h-4" />}</div>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {currentQuestion.type === "benar_salah" && (
                   <div className="grid grid-cols-2 gap-5 px-2">
                     {Object.keys(currentQuestion.choices || {}).slice(0, 2).map((choiceId, idx) => {
                       const isS = answers[currentQuestion.id] === choiceId; const isB = currentQuestion.choices![choiceId].text.toLowerCase().includes("benar") || idx === 0;
                       return (
                         <button key={choiceId} onClick={() => handleAnswerSelect(currentQuestion.id, choiceId)} className={`group relative flex flex-col items-center justify-center gap-4 py-8 px-6 rounded-[2.5rem] border-2 transition-all duration-300 active:scale-95 ${isS ? (isB ? "bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-400 text-white shadow-xl" : "bg-gradient-to-br from-rose-500 to-rose-600 border-rose-400 text-white shadow-xl") : "bg-white border-slate-100 text-slate-400"}`}><div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center ${isS ? "bg-white/20 text-white" : (isB ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500")}`}>{isB ? <CheckCircle2 className="w-9 h-9" strokeWidth={2.5} /> : <X className="w-9 h-9" strokeWidth={2.5} />}</div><span className={`font-black text-sm uppercase tracking-widest ${isS ? "text-white" : "text-slate-700"}`}>{currentQuestion.choices![choiceId].text}</span></button>
                       );
                     })}
                   </div>
                )}
                {currentQuestion.type === "menjodohkan" && (
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 space-y-3">
                      {(currentQuestion.pairs || []).map(p => {
                        const sA = answers[currentQuestion.id] || {}; const v = sA[p.id];
                        return (
                          <div key={p.id} className="flex items-stretch gap-2">
                            <div className="flex-1 p-3 bg-white border rounded-xl text-sm font-semibold">{p.left}</div>
                            <div className="flex items-center opacity-20"><ArrowRight className="w-4 h-4" /></div>
                            <div onClick={() => { const n = {...sA}; delete n[p.id]; handleAnswerSelect(currentQuestion.id, n); }} className={`flex-1 p-1 rounded-xl border-2 border-dashed flex items-center justify-center min-h-[50px] ${v ? "bg-emerald-50/20 border-emerald-400/50" : "bg-slate-50/30 border-slate-200"}`}>{v ? <div className="w-full h-full flex items-center justify-center bg-emerald-600 text-white rounded-lg p-2 text-xs font-bold">{v}</div> : <span className="text-[10px] font-bold text-slate-300 uppercase">Drop Disini</span>}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="lg:w-1/3 p-4 bg-slate-50 border rounded-2xl flex flex-wrap gap-2 content-start min-h-[100px]">
                      {(matchingOptions[currentQuestion.id] || []).filter(o => !Object.values(answers[currentQuestion.id] || {}).includes(o)).map(o => (
                        <button key={o} onClick={() => { const p = (currentQuestion.pairs || []).find(x => !(answers[currentQuestion.id] || {})[x.id]); if (p) handleAnswerSelect(currentQuestion.id, { ...(answers[currentQuestion.id] || {}), [p.id]: o }); }} className="px-3 py-2 bg-white border rounded-xl text-[12px] font-bold text-emerald-600">{o}</button>
                      ))}
                    </div>
                  </div>
                )}
                {(currentQuestion.type === "isian_singkat" || currentQuestion.type === "uraian") && <textarea value={answers[currentQuestion.id] || ""} onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)} placeholder="Tuliskan jawaban Anda di sini secara lengkap..." rows={currentQuestion.type === "uraian" ? 10 : 3} className="w-full p-6 sm:p-8 rounded-[30px] border-2 border-slate-100 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 font-bold text-sm sm:text-base resize-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all outline-none" />}
                {(currentQuestion.type === "urutkan" || currentQuestion.type === "drag_drop") && (
                   <Reorder.Group axis="y" values={answers[currentQuestion.id] || itemsOrder[currentQuestion.id] || (currentQuestion.items || []).map(it => it.id)} onReorder={(o:string[]) => handleAnswerSelect(currentQuestion.id, o)} className="space-y-2">
                    {(answers[currentQuestion.id] || itemsOrder[currentQuestion.id] || (currentQuestion.items || []).map(it => it.id)).map((id:string, i:number) => {
                       const it = currentQuestion.items?.find(x => x.id === id); return <Reorder.Item key={id} value={id} className="flex items-center gap-4 sm:gap-6 p-4 sm:p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm cursor-grab active:cursor-grabbing group relative overflow-hidden"><div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 flex items-center justify-center font-black text-xs sm:text-sm">{String.fromCharCode(65 + i)}</div><div className="flex-1 text-[14px] sm:text-[15px] font-medium text-slate-800 dark:text-slate-200">{it?.text}</div><div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg"><GripVertical className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" /></div></Reorder.Item>;
                    })}
                   </Reorder.Group>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        <aside className="hidden lg:flex w-[320px] bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 p-8 flex-col space-y-8 shadow-sm relative z-10 overflow-y-auto">
          <div className="flex items-center gap-3 mb-2 px-1">
             <div className="w-3 h-3 bg-emerald-600 rounded-full animate-pulse" />
             <h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.3em]">Navigasi Soal</h3>
          </div>
          
          <div className="flex flex-wrap gap-2.5 sm:gap-3.5 content-start">
            {questions.map((q, i) => (
              <button key={q.id} onClick={() => handleNavClick(i)} className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-lg border-2 transition-all active:scale-[0.85] ${i === currentQuestionIndex ? "bg-emerald-600 border-emerald-600 text-white" : answers[q.id] !== undefined ? "bg-emerald-50 border-emerald-100 text-emerald-600" : flaggedQuestions[q.id] ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400"}`}>{i + 1}</button>
            ))}
          </div>

          <div className="mt-auto space-y-4 pt-8 border-t border-slate-100 dark:border-slate-800">
             <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex(prev => prev - 1)} className="h-16 rounded-2xl font-black uppercase tracking-widest text-[12px] border-2 border-emerald-50 text-emerald-600 bg-white hover:bg-emerald-50 transition-colors">Back</Button>
                <Button onClick={() => currentQuestionIndex === questions.length - 1 ? setIsSubmitModalOpen(true) : handleNextClick()} className={`h-16 text-white font-black uppercase tracking-widest text-[12px] rounded-2xl transition-transform active:scale-95 ${currentQuestionIndex === questions.length - 1 ? "bg-emerald-500 hover:bg-emerald-600" : "bg-emerald-600 hover:bg-emerald-700"}`}>{currentQuestionIndex === questions.length - 1 ? "Finish" : "Next"}</Button>
             </div>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-100 dark:border-slate-800 p-4 sm:p-6 lg:hidden flex justify-between items-center z-40">
        <Button variant="outline" size="sm" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex(p => p - 1)} className="rounded-2xl h-14 px-8 font-black uppercase text-[12px] tracking-[0.2em] border-2 border-emerald-50 bg-white text-emerald-600 active:scale-90 transition-all">Back</Button>
        <Button variant="ghost" className="font-black text-emerald-800 dark:text-emerald-100 uppercase tracking-[0.3em] text-[16px]" onClick={() => setIsNavModalOpen(true)}>{currentQuestionIndex + 1} / {questions.length}</Button>
        <Button onClick={() => currentQuestionIndex === questions.length - 1 ? setIsSubmitModalOpen(true) : handleNextClick()} size="sm" className="rounded-2xl h-14 px-8 text-white font-black uppercase text-[12px] tracking-[0.2em] bg-emerald-600 active:scale-90 transition-all">{currentQuestionIndex === questions.length - 1 ? "End" : "Nxt"}</Button>
      </div>

      <Dialog open={isNavModalOpen} onOpenChange={setIsNavModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-3xl p-8 pointer-events-auto border-none">
          <DialogTitle className="text-xl font-black mb-6 text-emerald-800 uppercase tracking-tighter">Navigasi Soal</DialogTitle>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 sm:gap-4 overflow-y-auto max-h-[60vh] pr-2">
            {questions.map((q, i) => (
              <button key={q.id} onClick={() => { setCurrentQuestionIndex(i); setIsNavModalOpen(false); }} className={`aspect-square rounded-2xl flex items-center justify-center font-black text-xl border-3 transition-all active:scale-90 ${i === currentQuestionIndex ? "bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-100" : answers[q.id] !== undefined ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-400"}`}>{i + 1}</button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isResetModalOpen} onOpenChange={() => {}}><DialogContent className="max-w-md rounded-2xl p-6 text-center pointer-events-auto shadow-2xl"><AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-2 animate-bounce" /><DialogTitle className="text-lg font-bold">Sesi Ujian Di-Reset</DialogTitle><p className="text-slate-500 text-sm mt-1">Sesi Anda telah di-reset oleh Pengawas. Silakan login kembali.</p><Button onClick={() => logoutStudent()} className="w-full bg-red-600 text-white rounded-xl h-11 mt-4"><LogOut className="w-4 h-4 mr-2" /> Keluar & Login Ulang</Button></DialogContent></Dialog>
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}><DialogContent className="max-w-3xl bg-transparent border-none p-0 flex items-center justify-center pointer-events-auto">{previewImage && <img src={previewImage} className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl" alt="Preview" />}</DialogContent></Dialog>
      <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}><DialogContent className="max-w-md rounded-2xl p-6 pointer-events-auto text-center">{isAllAnswered ? (<><CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" /><DialogTitle className="text-lg font-bold">Kumpulkan Ujian?</DialogTitle><p className="text-slate-500 text-sm mt-1">Yakin ingin mengakhiri sekarang?</p><div className="mt-6 flex gap-2"><Button variant="outline" onClick={() => setIsSubmitModalOpen(false)} className="flex-1 rounded-xl">Batal</Button><Button onClick={() => { setIsSubmitModalOpen(false); handleSubmitExam(); }} className="flex-1 bg-green-600 text-white rounded-xl">Kumpulkan</Button></div></>) : (<><AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-2" /><DialogTitle className="text-lg font-bold">Belum Selesai</DialogTitle><p className="text-slate-500 text-sm mt-1">Ada {unansweredCount} soal belum dijawab. Yakin?</p><div className="mt-6"><Button onClick={() => setIsSubmitModalOpen(false)} className="w-full bg-amber-600 text-white rounded-xl">Kembali Mengerjakan</Button></div></>)}</DialogContent></Dialog>
      <Dialog open={isSkipNoticeOpen} onOpenChange={setIsSkipNoticeOpen}><DialogContent className="max-w-xs rounded-[2rem] p-6 pointer-events-auto border-none shadow-2xl text-center"><HelpCircle className="w-14 h-14 text-amber-600 mx-auto mb-4" /><DialogTitle className="text-base font-black uppercase tracking-tight">Soal Belum Dijawab</DialogTitle><p className="text-slate-500 text-[11px] font-medium leading-relaxed">Anda belum memberikan jawaban. Yakin ingin melewati?</p><div className="grid grid-cols-2 gap-3 mt-6"><Button variant="outline" onClick={() => setIsSkipNoticeOpen(false)} className="rounded-xl text-[10px] font-black uppercase tracking-widest border-emerald-100 text-emerald-600">Kembali</Button><Button onClick={() => { if (targetIndex !== null) goToQuestion(targetIndex); setIsSkipNoticeOpen(false); }} className="bg-emerald-600 text-white font-black text-[10px] rounded-xl uppercase tracking-widest">Lompati</Button></div></DialogContent></Dialog>
      <Dialog open={isCheatWarningOpen} onOpenChange={setIsCheatWarningOpen}>
        <DialogContent className="max-w-xs rounded-[2rem] p-6 text-center border-none shadow-2xl pointer-events-auto">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4 animate-pulse" />
          <DialogTitle className="text-xl font-black text-red-600 uppercase tracking-tighter">⚠️ Pelanggaran!</DialogTitle>
          <div className="space-y-3 mt-2">
            <p className="text-slate-500 text-xs font-bold leading-relaxed">DILARANG pindah aplikasi atau membuka tab lain selama ujian!</p>
            <div className="bg-red-50 p-3 rounded-2xl border border-red-100">
               <span className="text-[10px] uppercase font-black text-red-700 tracking-widest block mb-1">Pelanggaran Anda</span>
               <span className="text-2xl font-black text-red-600">{(attempt?.cheatCount || 0) + 1} / {(roomData?.cheat_limit || 3) + (attempt?.extraCheatLimit || 0)}</span>
            </div>
          </div>
          <Button onClick={() => setIsCheatWarningOpen(false)} className="w-full bg-emerald-600 text-white font-black uppercase tracking-widest h-12 rounded-2xl mt-6">SAYA MENGERTI</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CBTPage;
