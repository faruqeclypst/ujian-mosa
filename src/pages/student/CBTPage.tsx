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

const CBTPage = () => {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { student, logoutStudent } = useStudentAuth();

  // 🛡️ URL MASKING LOGIC
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (paramRoomId) {
      // 1. Jika ada di URL, simpan dan hilangkan dari URL
      sessionStorage.setItem("activeCBTRoomId", paramRoomId);
      setRoomId(paramRoomId);
      navigate("/cbt", { replace: true });
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

  const saveTimeoutRef = useRef<any>(null);
  const lastCheatTimeRef = useRef<number>(0); 
  const cheatTimerRef = useRef<any>(null); // Perekam Masa Tenggang
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

  // 🚀 Fungsi Pintar: Mencoba update ke PocketBase dengan berbagai variasi nama kolom
  const safeUpdateAttempt = async (attId: string, data: any) => {
    try {
      // 1. Siapkan data dengan format CamelCase (Default)
      const payload = { ...data };
      
      // 2. Coba kirim. Jika gagal 400, kemungkinan nama kolom beda.
      return await pb.collection("attempts").update(attId, payload);
    } catch (err: any) {
      if (err.status === 400) {
        try {
          // 3. Fallback: Transformasi ke snake_case untuk kolom-kolom kritis
          const fallbackData = { ...data };
          // Pemetaan ke nama kolom asli di screenshot user
          if (fallbackData.isOnline !== undefined) { fallbackData.is_online = fallbackData.isOnline; delete fallbackData.isOnline; }
          if (fallbackData.lastHeartbeat !== undefined) { fallbackData.last_heartbeat = fallbackData.lastHeartbeat; delete fallbackData.lastHeartbeat; }
          if (fallbackData.cheatCount !== undefined) { fallbackData.cheat_count = fallbackData.cheatCount; delete fallbackData.cheatCount; }
          if (fallbackData.startTime !== undefined) { fallbackData.startedAt = fallbackData.startTime; delete fallbackData.startTime; }
          if (fallbackData.submittedAt === undefined && fallbackData.submitTime !== undefined) { fallbackData.submittedAt = fallbackData.submitTime; delete fallbackData.submitTime; }
          
          // Nilai & Skor Fallback
          if (fallbackData.score !== undefined) { fallbackData.scoreValue = fallbackData.score; }
          if (fallbackData.correct !== undefined) { fallbackData.correctCount = fallbackData.correct; }
          if (fallbackData.total !== undefined) { fallbackData.totalQuestions = fallbackData.total; }
          
          return await pb.collection("attempts").update(attId, fallbackData);
        } catch (err2) {
          // 4. Upaya Terakhir: Hanya kirim data yang paling aman (answers/status saja)
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

      const existingAttempts = await pb.collection("attempts").getFullList({ 
        filter: `studentId = "${student.id}" && examRoomId = "${roomId}"`, 
        sort: "-created" 
      });

      let att: any = null;
      if (existingAttempts.length > 0) {
        att = existingAttempts[0];
        if (att.status === "finished") { navigate("/result/" + att.id); return; }
        if (att.status === "LOCKED") setIsLocked(true);
        setAnswers(att.answers || {});
        
        // Update online status
        safeUpdateAttempt(att.id, { isOnline: true, lastHeartbeat: new Date().toISOString() });
      } else {
        // 🔒 Race condition lock
        if (isCreatingRef.current) return;
        isCreatingRef.current = true;
        
        try {
          // Double check right before create
          const secondCheck = await pb.collection("attempts").getFullList({ 
            filter: `studentId = "${student.id}" && examRoomId = "${roomId}"` 
          });
          
          if (secondCheck.length > 0) {
            att = secondCheck[0];
          } else {
            att = await pb.collection("attempts").create({ 
              studentId: student.id, 
              examRoomId: roomId, 
              status: "ongoing", 
              cheatCount: 0, 
              startedAt: new Date().toISOString(),
              isOnline: true, 
              lastHeartbeat: new Date().toISOString(),
              answers: {} 
            });
          }
        } finally {
          isCreatingRef.current = false;
        }
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
      const sI = sessionStorage.getItem(`currentIndex_${pr}`);
      if (sI && !isIndexRestored.current) { const idx = parseInt(sI, 10); if(idx >= 0 && idx < order.length) setCurrentQuestionIndex(idx); }
      isIndexRestored.current = true;

      const stD = parseSafeDate(att.startTime) || new Date();
      const enD = parseSafeDate(rData.end_time) || new Date(stD.getTime() + (rData.duration * 60000));
      const diff = Math.floor((Math.min(stD.getTime() + (rData.duration * 60000), enD.getTime()) - Date.now()) / 1000);
      if (diff <= 0) setIsExamOver(true); setTimeLeft(Math.max(0, diff));
      const sF = sessionStorage.getItem(`flags_${pr}`); if(sF) try{ setFlaggedQuestions(JSON.parse(sF)); }catch(e){}
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [student, roomId, navigate]);

  useEffect(() => { loadExamData(); }, [loadExamData]);

  useEffect(() => {
    if (!roomData?.examId || !roomId || !attempt?.id) return;
    const rId = roomId as string;

    const uQ = pb.collection("questions").subscribe("*", (e) => {
      if (e.record.examId === roomData.examId) {
        console.log("📝 Update soal terdeteksi, memuat ulang...");
        loadExamData();
      }
    });

    const uRoom = pb.collection("exam_rooms").subscribe(rId, (e) => {
      if (e.action === "update") {
        // 1. Sync data ruang terbaru (termasuk cheat_limit)
        setRoomData((prev: any) => ({ ...prev, ...e.record }));

        // 2. Cek apakah ruang dinonaktifkan
        const isOff = e.record.isDisabled === true || e.record.isdisabled === true || e.record.status === "archive";
        if (isOff) {
          console.log("🚫 Ruang Ujian dinonaktifkan oleh Admin. Mengeluarkan siswa...");
          navigate("/dashboard");
        }
      }
    });

    const uAtt = pb.collection("attempts").subscribe(attempt.id, (e) => {
      if (e.action === "delete") {
        navigate("/dashboard");
      } else if (e.action === "update") {
        setAttempt(e.record as any);
        if (e.record.status === "LOCKED") setIsLocked(true);
        else if (e.record.status === "ongoing") setIsLocked(false);
      }
    });

    return () => {
      uQ.then(unsub => unsub()).catch(() => {});
      uRoom.then(unsub => unsub()).catch(() => {});
      uAtt.then(unsub => unsub()).catch(() => {});
    };
  }, [roomData, roomId, attempt, navigate, loadExamData]);

  useEffect(() => {
    if (loading || isLocked || isExamOver || !roomData || !attempt) return;
    const t = setInterval(() => {
      const sT = attempt.startTime || attempt.start_time || attempt.created;
      const eT = roomData.end_time || roomData.endTime || (roomData as any).end_time__id; 
      
      const sD = parseSafeDate(sT) || new Date();
      const dur = (roomData.duration || 60) * 60000;
      
      const targetEnd = new Date(sD.getTime() + dur);
      const roomEnd = parseSafeDate(eT);
      
      // Pilih waktu berakhir yang paling awal antara durasi habis atau jadwal ruang habis
      const actualEnd = roomEnd && roomEnd.getTime() < targetEnd.getTime() ? roomEnd : targetEnd;
      const d = Math.floor((actualEnd.getTime() - Date.now()) / 1000);
      
      if (d <= 0) { 
        clearInterval(t); 
        setTimeLeft(0); 
        if (!isExamOver) setIsExamOver(true); 
      } else {
        setTimeLeft(d);
      }
    }, 1000);
    const h = setInterval(() => { 
      if(attempt?.id) {
        safeUpdateAttempt(attempt.id, { 
          isOnline: true, 
          lastHeartbeat: new Date().toISOString() 
        });
      }
    }, 30000);
    return () => { clearInterval(t); clearInterval(h); };
  }, [loading, isLocked, isExamOver, roomData, attempt]);

  // 🛡️ Anti-Cheat: Deteksi pindah tab / minimize dengan Masa Tenggang 5 detik
  useEffect(() => {
    if (!attempt?.id || isLocked || isExamOver) return;
    
    const triggerPenalty = async () => {
      if (!attempt?.id) return;
      const newCount = (attempt.cheatCount || 0) + 1;
      const limit = (roomData?.cheat_limit || 3) + (attempt.extraCheatLimit || 0);

      console.log(`❌ Pelanggaran dicatat! (${newCount}/${limit})`);
      
      try {
        await safeUpdateAttempt(attempt.id, { 
          cheatCount: newCount, 
          status: newCount >= limit ? "LOCKED" : "ongoing" 
        });

        if (newCount >= limit) {
          setIsLocked(true);
          setIsCheatWarningOpen(false);
        } else {
          setIsCheatWarningOpen(true);
        }
      } catch (err) { }
      
      cheatTimerRef.current = null;
    };

    const handleCheatDetection = (event: Event) => {
      // 1. SISWA KELUAR TAB ATAU JENDELA KEHILANGAN FOKUS
      if (document.visibilityState === "hidden" || event.type === "blur") {
        console.log("⚠️ Deteksi keluar! Masa tenggang 5 detik dimulai...");
        
        if (!cheatTimerRef.current) {
          cheatTimerRef.current = setTimeout(triggerPenalty, 5000); // ⏱️ SEKARANG 5 DETIK
        }
      } 
      // 2. SISWA KEMBALI SEBELUM MASA TENGGANG HABIS
      else if (document.visibilityState === "visible" || event.type === "focus") {
        if (cheatTimerRef.current) {
          console.log("✅ Kembali tepat waktu. Masa tenggang dibatalkan.");
          clearTimeout(cheatTimerRef.current);
          cheatTimerRef.current = null;
        }
      }
    };
    
    window.addEventListener("visibilitychange", handleCheatDetection);
    window.addEventListener("blur", handleCheatDetection);
    window.addEventListener("focus", handleCheatDetection);

    return () => {
      window.removeEventListener("visibilitychange", handleCheatDetection);
      window.removeEventListener("blur", handleCheatDetection);
      window.removeEventListener("focus", handleCheatDetection);
      if (cheatTimerRef.current) clearTimeout(cheatTimerRef.current);
    };
  }, [attempt, roomData, isLocked, isExamOver]);

  // 🛡️ Properti Proteksi: Anti Klik Kanan, Salin, Tempel (Copy/Paste) dan DevTools
  useEffect(() => {
    const preventAction = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const handleKeys = (e: KeyboardEvent) => {
      // Disable F12 (DevTools), Ctrl+U (View Source), Ctrl+S (Save), Ctrl+Shift+I (Inspect)
      if (
        e.key === "F12" || 
        (e.ctrlKey && e.shiftKey && e.key === "I") || 
        (e.ctrlKey && e.key === "u") || 
        (e.ctrlKey && e.key === "s") ||
        (e.ctrlKey && e.key === "p") // Print
      ) {
        e.preventDefault();
        return false;
      }
    };

    window.addEventListener("contextmenu", preventAction); // Klik Kanan
    window.addEventListener("copy", preventAction);        // Salin
    window.addEventListener("cut", preventAction);         // Potong
    window.addEventListener("paste", preventAction);       // Tempel
    window.addEventListener("keydown", handleKeys);        // Shortcut Keyboard

    return () => {
      window.removeEventListener("contextmenu", preventAction);
      window.removeEventListener("copy", preventAction);
      window.removeEventListener("cut", preventAction);
      window.removeEventListener("paste", preventAction);
      window.removeEventListener("keydown", handleKeys);
    };
  }, []);

  const handleSubmitExam = useCallback(async () => {
    if (!student || !roomId || !roomData || !attempt || attempt.status !== "ongoing") return;
    setLoading(true);
    try {
      let c = 0;
      const ovr = attempt.overrides || {};
      
      questions.forEach((q: any) => {
        // 1. Cek Override dari Admin (Prioritas Utama)
        if (ovr[q.id] !== undefined) {
          if (ovr[q.id] === true) c++;
          return;
        }

        // 2. Kalkulasi Otomatis (Jika tidak ada override)
        const sa = answers[q.id]; if (!sa) return;
        const t = q.type || "pilihan_ganda";
        if (t === "pilihan_ganda" || t === "benar_salah") { if (q.choices?.[sa]?.isCorrect === true) c++; }
        else if (t === "pilihan_ganda_kompleks") {
          const ck = Object.keys(q.choices).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase());
          const sk = Array.isArray(sa) ? sa.map(k => String(k).toLowerCase()) : [];
          if (sk.length === ck.length && sk.every(k => ck.includes(k))) c++;
        } else if (t === "menjodohkan") {
          let cp = 0; (q.pairs || []).forEach((p:any) => { if(sa[p.id] === p.right) cp++; });
          if (q.pairs?.length > 0) c += (cp / q.pairs.length);
        } else if (t === "isian_singkat") { if (q.answerKey && isFuzzyMatch(sa, q.answerKey)) c++; }
        else if (t === "urutkan" || t === "drag_drop") {
          const co = (q.items || []).map((it:any) => it.id);
          if (Array.isArray(sa) && sa.length === co.length && sa.every((v, i) => v === co[i])) c++;
        }
      });
      const sc = Math.round((c / questions.length) * 100) || 0;
      
      // ⏱️ Hitung Durasi Pengerjaan (usedTime dalam detik)
      const st = attempt.startedAt || attempt.startTime || attempt.created || Date.now();
      const startMs = new Date(st as any).getTime();
      const usedTimeSec = Math.floor((Date.now() - startMs) / 1000);

      // Step 1: Simpan Metadata Skor & Waktu
      await safeUpdateAttempt(attempt.id, { 
        score: sc, 
        correct: Math.floor(c),
        total: questions.length,
        usedTime: usedTimeSec >= 0 ? usedTimeSec : 0
      }).catch(err => console.warn("⚠️ Metadata skip:", err));

      // Step 2: Update Status (Critical) - Menggunakan 'finished' sesuai screenshot
      try {
        await safeUpdateAttempt(attempt.id, { 
          status: "finished",
          submittedAt: new Date().toISOString()
        });
        
        const pr = `${student.nisn}_${roomId}`; 
        sessionStorage.removeItem(`order_${pr}`); 
        sessionStorage.removeItem(`currentIndex_${pr}`);
        navigate(`/cbt/${roomId}/result`);
      } catch (err: any) {
        console.error("❌ GAGAL TOTAL UPDATE STATUS:", err);
        alert("Gagal mengumpulkan: Aturan sistem (API Rules) atau Nama Kolom salah.");
      }
    } catch (e) { 
      console.error(e); 
      alert("Gagal!"); 
    } finally { 
      setLoading(false); 
    }
  }, [student, roomId, roomData, attempt, questions, answers, navigate]);

  // ⏱️ Auto Submit when time is over
  useEffect(() => {
    if (isExamOver && !loading && attempt?.status === "ongoing") {
      console.log("⏰ Waktu habis! Mengumpulkan otomatis...");
      handleSubmitExam();
    }
  }, [isExamOver, loading, attempt?.status, handleSubmitExam]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  if (isLocked) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-center max-w-sm border border-red-100 dark:border-red-900/30 relative overflow-hidden group">
        {/* Decorative Background Element */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-rose-500 to-red-600"></div>
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-500/5 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mx-auto mb-6 ring-8 ring-red-50 dark:ring-red-900/10">
            <ShieldAlert className="w-10 h-10 text-red-600 animate-pulse" />
          </div>
          
          <h2 className="text-2xl font-semibold text-red-600 mb-3">Ujian Terkunci!</h2>
          
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-relaxed">
              Sistem mendeteksi <span className="text-red-600 font-semibold">Pelanggaran Berulang</span> atau aktivitas mencurigakan selama ujian berlangsung.
            </p>
            
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Instruksi Selanjutnya:</p>
              <p className="text-sm font-medium text-slate-800 dark:text-white leading-snug">
                Harap hubungi Admin / Tim IT / Pengawas untuk membuka kunci akses ujian Anda.
              </p>
            </div>
            
            <button 
              onClick={() => logoutStudent()}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest mt-4"
            >
              <LogOut className="w-3.5 h-3.5" /> Kembali ke Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const currentQuestion = questions[currentQuestionIndex];
  const unansweredCount = questions.filter((q) => answers[q.id] === undefined).length;
  const isAllAnswered = unansweredCount === 0;

  return (
    <div className="h-screen h-[100dvh] bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden select-none">
      <header className="sticky top-0 z-10 bg-card border-b shadow-sm h-12 px-4 flex items-center justify-between text-xs sm:text-sm">
        <div className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/50">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          <span className={`font-mono font-bold ${timeLeft < 300 ? "text-red-500 animate-pulse" : "text-amber-800"}`}>{Math.floor(timeLeft/60).toString().padStart(2,"0")}:{(timeLeft%60).toString().padStart(2,"0")}</span>
        </div>
        <div className="text-center">
          <p className="font-bold text-slate-800 line-clamp-1">{roomData?.subject} - {roomData?.teacherName}</p>
          <p className="text-[10px] text-slate-500">{roomData?.examTitle} - {roomData?.room_name}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-slate-700 line-clamp-1">{student?.name}</p>
          <p className="text-[10px] text-slate-400">{student?.className}</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 space-y-4">
          {currentQuestion && (
            <Card className="rounded-xl border shadow-sm">
              <CardHeader className="p-4 pb-2">
                <div className="relative bg-slate-50 p-4 rounded-2xl border mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl">{currentQuestionIndex + 1}</div>
                    <div className="flex flex-col"><span className="text-xs font-black text-slate-800 tracking-tight uppercase">Soal Nomor {currentQuestionIndex + 1}</span></div>
                  </div>
                  <div className="absolute top-4 right-4">
                    <button onClick={() => toggleFlag(currentQuestion.id)} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all shadow-lg ${flaggedQuestions[currentQuestion.id] ? "bg-amber-500 text-white" : "bg-white text-slate-400 border"}`}><Bookmark className={`w-5 h-5 ${flaggedQuestions[currentQuestion.id] ? "fill-white" : ""}`} /></button>
                  </div>
                </div>
                {currentQuestion.imageUrl && <img src={currentQuestion.imageUrl} className="max-w-full md:max-w-xl h-auto mx-auto block rounded-xl border mb-4 shadow-sm" alt="Soal" />}
                {currentQuestion.groupId && (() => {
                  const f = questions.find(x => x.groupId === currentQuestion.groupId);
                  if (f && (f.groupText || f.text)) return (
                    <div className="bg-white dark:bg-slate-950 p-6 md:p-8 rounded-[2rem] border-2 border-dashed border-blue-200 dark:border-blue-900/40 mb-6 space-y-4 shadow-inner relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                         <FileText className="w-12 h-12 text-blue-600 rotate-12" />
                      </div>
                      
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-6 w-1 rounded-full bg-blue-600"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Materi Literasi / Wacana</span>
                      </div>
                      
                      <div 
                        className="text-base sm:text-lg leading-relaxed text-slate-800 dark:text-slate-200 font-serif ql-editor !p-0 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-center [&_h2]:mb-8 [&_h2]:text-blue-900 dark:[&_h2]:text-blue-400 [&_p]:mb-4 [&_p]:text-justify [&_img]:rounded-2xl [&_img]:mx-auto [&_img]:block [&_img]:shadow-xl selection:bg-blue-100" 
                        dangerouslySetInnerHTML={{ __html: f.groupText || f.text }} 
                      />
                      
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                         <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter italic">Bacalah teks di atas dengan teliti sebelum menjawab.</span>
                      </div>
                    </div>
                  );
                })()}
                <div className="text-base sm:text-lg font-normal leading-relaxed text-slate-800 ql-editor p-0" dangerouslySetInnerHTML={{ __html: currentQuestion.text }} />
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                {(currentQuestion.type === "pilihan_ganda" || currentQuestion.type === "pilihan_ganda_kompleks") && (
                  <div className="space-y-2.5">
                    {(choicesOrder[currentQuestion.id] || Object.keys(currentQuestion.choices || {})).map((choiceId, idx) => {
                      const c = currentQuestion.choices![choiceId]; const isM = currentQuestion.type === "pilihan_ganda_kompleks"; const isS = isM ? (answers[currentQuestion.id] || []).includes(choiceId) : answers[currentQuestion.id] === choiceId;
                      return (
                        <button key={choiceId} onClick={() => { if(isM){ const a = answers[currentQuestion.id] || []; handleAnswerSelect(currentQuestion.id, a.includes(choiceId) ? a.filter((i:any)=>i!==choiceId) : [...a, choiceId]); } else handleAnswerSelect(currentQuestion.id, choiceId); }} className={`w-full text-left p-3.5 rounded-2xl border flex items-center gap-3.5 transition-all outline-none ${isS ? "bg-blue-50 border-blue-500 text-blue-700 font-bold" : "bg-card border-slate-200 text-slate-700"}`}><div className={`w-7 h-7 shrink-0 rounded-full border flex items-center justify-center font-bold text-sm ${isS ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-500"}`}>{String.fromCharCode(65 + idx)}</div><div className="flex-1 text-sm"><div className="ql-editor p-0" dangerouslySetInnerHTML={{ __html: c.text }} />{c.imageUrl && <img src={c.imageUrl} className="max-h-[150px] rounded-lg mt-2 border shadow-sm" alt="Choice" />}</div>{isM && <div className={`w-5 h-5 rounded border flex items-center justify-center ${isS ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"}`}>{isS && <CheckCircle2 className="w-3.5 h-3.5" />}</div>}</button>
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
                            <div onClick={() => { const n = {...sA}; delete n[p.id]; handleAnswerSelect(currentQuestion.id, n); }} className={`flex-1 p-1 rounded-xl border-2 border-dashed flex items-center justify-center min-h-[50px] ${v ? "bg-blue-50/20 border-blue-400/50" : "bg-slate-50/30 border-slate-200"}`}>{v ? <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white rounded-lg p-2 text-xs font-bold">{v}</div> : <span className="text-[10px] font-bold text-slate-300 uppercase">Drop Disini</span>}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="lg:w-1/3 p-4 bg-slate-50 border rounded-2xl flex flex-wrap gap-2 content-start min-h-[100px]">
                      {(matchingOptions[currentQuestion.id] || []).filter(o => !Object.values(answers[currentQuestion.id] || {}).includes(o)).map(o => (
                        <button key={o} onClick={() => { const p = (currentQuestion.pairs || []).find(x => !(answers[currentQuestion.id] || {})[x.id]); if (p) handleAnswerSelect(currentQuestion.id, { ...(answers[currentQuestion.id] || {}), [p.id]: o }); }} className="px-3 py-2 bg-white border rounded-xl text-[12px] font-bold text-blue-600 shadow-sm">{o}</button>
                      ))}
                    </div>
                  </div>
                )}
                {(currentQuestion.type === "isian_singkat" || currentQuestion.type === "uraian") && <textarea value={answers[currentQuestion.id] || ""} onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)} placeholder="Tuliskan jawaban Anda..." rows={currentQuestion.type === "uraian" ? 6 : 2} className="w-full p-4 rounded-2xl border shadow-sm font-medium resize-none" />}
                {(currentQuestion.type === "urutkan" || currentQuestion.type === "drag_drop") && (
                  <Reorder.Group axis="y" values={answers[currentQuestion.id] || itemsOrder[currentQuestion.id] || (currentQuestion.items || []).map(it => it.id)} onReorder={(o:string[]) => handleAnswerSelect(currentQuestion.id, o)} className="space-y-3">
                    {(answers[currentQuestion.id] || itemsOrder[currentQuestion.id] || (currentQuestion.items || []).map(it => it.id)).map((id:string, i:number) => {
                      const it = currentQuestion.items?.find(x => x.id === id); return <Reorder.Item key={id} value={id} className="flex items-center gap-4 p-4 bg-card border rounded-2xl shadow-sm cursor-grab active:cursor-grabbing group relative overflow-hidden"><div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">{String.fromCharCode(65 + i)}</div><div className="flex-1 text-sm font-bold text-slate-700">{it?.text}</div><GripVertical className="w-5 h-5 text-slate-300" /></Reorder.Item>;
                    })}
                  </Reorder.Group>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        <aside className="hidden md:flex w-full md:w-72 bg-card border-l p-4 flex-col space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500">Navigasi Soal</h3>
          <div className="grid grid-cols-5 md:flex md:flex-wrap gap-1 overflow-y-auto flex-1">
            {questions.map((q, i) => (
              <button key={q.id} onClick={() => handleNavClick(i)} className={`w-full aspect-square md:w-9 md:h-9 rounded-xl flex items-center justify-center font-bold text-xs border transition-all ${i === currentQuestionIndex ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/30" : answers[q.id] !== undefined ? "bg-green-100 border-green-200 text-green-700" : flaggedQuestions[q.id] ? "bg-amber-100 border-amber-200 text-amber-700" : "bg-slate-100 border-slate-200 text-slate-600"}`}>{i + 1}</button>
            ))}
          </div>
          <div className="pt-3 border-t grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex(prev => prev - 1)} className="rounded-xl font-semibold">Sebelumnya</Button>
            <Button onClick={() => currentQuestionIndex === questions.length - 1 ? setIsSubmitModalOpen(true) : handleNextClick()} className={`text-white font-semibold rounded-xl ${currentQuestionIndex === questions.length - 1 ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}>{currentQuestionIndex === questions.length - 1 ? "Kumpulkan" : "Selanjutnya"}</Button>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 bg-white border-t p-3 md:hidden flex justify-between items-center z-20 shadow-lg">
        <Button variant="outline" size="sm" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex(p => p - 1)} className="rounded-xl">Prev</Button>
        <Button variant="ghost" className="font-bold" onClick={() => setIsNavModalOpen(true)}>{currentQuestionIndex + 1} / {questions.length}</Button>
        <Button onClick={() => currentQuestionIndex === questions.length - 1 ? setIsSubmitModalOpen(true) : handleNextClick()} size="sm" className={`rounded-xl text-white ${currentQuestionIndex === questions.length - 1 ? "bg-green-600" : "bg-blue-600"}`}>{currentQuestionIndex === questions.length - 1 ? "Finish" : "Next"}</Button>
      </div>

      <Dialog open={isNavModalOpen} onOpenChange={setIsNavModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl p-6 pointer-events-auto">
          <DialogTitle className="text-base font-bold mb-2 text-slate-800">Navigasi Soal</DialogTitle>
          <div className="grid grid-cols-5 gap-1 overflow-y-auto max-h-60">
            {questions.map((q, i) => (
              <button key={q.id} onClick={() => { setCurrentQuestionIndex(i); setIsNavModalOpen(false); }} className={`w-full aspect-square rounded-xl flex items-center justify-center font-bold text-xs border ${i === currentQuestionIndex ? "bg-blue-600 text-white" : answers[q.id] !== undefined ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{i + 1}</button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isResetModalOpen} onOpenChange={() => {}}><DialogContent className="max-w-md rounded-2xl p-6 text-center pointer-events-auto shadow-2xl"><AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-2 animate-bounce" /><DialogTitle className="text-lg font-bold">Sesi Ujian Di-Reset</DialogTitle><p className="text-slate-500 text-sm mt-1">Sesi Anda telah di-reset oleh Pengawas. Silakan login kembali.</p><Button onClick={() => logoutStudent()} className="w-full bg-red-600 text-white rounded-xl h-11 mt-4"><LogOut className="w-4 h-4 mr-2" /> Keluar & Login Ulang</Button></DialogContent></Dialog>
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}><DialogContent className="max-w-3xl bg-transparent border-none p-0 flex items-center justify-center pointer-events-auto">{previewImage && <img src={previewImage} className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl" alt="Preview" />}</DialogContent></Dialog>
      <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}><DialogContent className="max-w-md rounded-2xl p-6 pointer-events-auto text-center">{isAllAnswered ? (<><CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" /><DialogTitle className="text-lg font-bold">Kumpulkan Ujian?</DialogTitle><p className="text-slate-500 text-sm mt-1">Yakin ingin mengakhiri sekarang?</p><div className="mt-6 flex gap-2"><Button variant="outline" onClick={() => setIsSubmitModalOpen(false)} className="flex-1 rounded-xl">Batal</Button><Button onClick={() => { setIsSubmitModalOpen(false); handleSubmitExam(); }} className="flex-1 bg-green-600 text-white rounded-xl">Kumpulkan</Button></div></>) : (<><AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-2" /><DialogTitle className="text-lg font-bold">Belum Selesai</DialogTitle><p className="text-slate-500 text-sm mt-1">Ada {unansweredCount} soal belum dijawab. Yakin?</p><div className="mt-6"><Button onClick={() => setIsSubmitModalOpen(false)} className="w-full bg-amber-600 text-white rounded-xl">Kembali Mengerjakan</Button></div></>)}</DialogContent></Dialog>
      <Dialog open={isSkipNoticeOpen} onOpenChange={setIsSkipNoticeOpen}><DialogContent className="max-w-xs rounded-[2rem] p-6 pointer-events-auto border-none shadow-2xl text-center"><HelpCircle className="w-14 h-14 text-amber-600 mx-auto mb-4" /><DialogTitle className="text-base font-black uppercase tracking-tight">Soal Belum Dijawab</DialogTitle><p className="text-slate-500 text-[11px] font-medium leading-relaxed">Anda belum memberikan jawaban. Yakin ingin melewati?</p><div className="grid grid-cols-2 gap-3 mt-6"><Button variant="outline" onClick={() => setIsSkipNoticeOpen(false)} className="rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-200">Kembali</Button><Button onClick={() => { if (targetIndex !== null) goToQuestion(targetIndex); setIsSkipNoticeOpen(false); }} className="bg-slate-900 text-white font-black text-[10px] rounded-xl uppercase tracking-widest">Lompati</Button></div></DialogContent></Dialog>
      
      {/* 🛡️ Anti-Cheat Violation Warning */}
      <Dialog open={isCheatWarningOpen} onOpenChange={setIsCheatWarningOpen}>
        <DialogContent className="max-w-xs rounded-[2rem] p-6 text-center border-none shadow-2xl pointer-events-auto">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4 animate-pulse" />
          <DialogTitle className="text-xl font-black text-red-600 uppercase tracking-tighter">⚠️ Pelanggaran!</DialogTitle>
          <div className="space-y-3 mt-2">
            <p className="text-slate-500 text-xs font-bold leading-relaxed">
              DILARANG pindah aplikasi atau membuka tab lain selama ujian!
            </p>
            <div className="bg-red-50 p-3 rounded-2xl border border-red-100">
               <span className="text-[10px] uppercase font-black text-red-700 tracking-widest block mb-1">Pelanggaran Anda</span>
               <span className="text-2xl font-black text-red-600">{(attempt?.cheatCount || 0) + 1} / {(roomData?.cheat_limit || 3) + (attempt?.extraCheatLimit || 0)}</span>
            </div>
          </div>
          <Button onClick={() => setIsCheatWarningOpen(false)} className="w-full bg-slate-900 text-white font-black uppercase tracking-widest h-12 rounded-2xl mt-6 shadow-xl active:scale-95 transition-all">SAYA MENGERTI</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CBTPage;
