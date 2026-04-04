import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { ref, get, set, update, onValue, onDisconnect } from "firebase/database";
import { database } from "../../lib/firebase";
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
  choices?: Record<string, { text: string; imageUrl?: string }>;
  pairs?: Array<{ id: string; left: string; right: string }>;
  answerKey?: string;
  items?: Array<{ id: string; text: string; imageUrl?: string }>;
}

interface ExamAttempt {
  status: "ongoing" | "submitted" | "LOCKED";
  cheatCount: number;
  score?: number;
  correct?: number;
  total?: number;
  extraCheatLimit?: number;
  startTime?: number;
}

// 🛡️ Fuzzy Match Helper for Short Answers
const isFuzzyMatch = (studentAns: any, correctKey: string) => {
  if (typeof studentAns !== "string" || !correctKey) return false;
  
  // Standardize: lowecase & remove punctuation & double spaces
  const sAns = studentAns.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const cKey = correctKey.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  
  if (sAns === cKey) return true;
  if (!sAns || !cKey) return false;
  
  // No tolerance for very short words
  if (cKey.length < 3) return sAns === cKey; 

  // Levenshtein Distance Calculation
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
  // Tolerance: 1 typo for 4-8 chars, 2 typos for > 8 chars
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
  const [answers, setAnswers] = useState<Record<string, any>>({}); // { questionId: value }
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);

  const [roomData, setRoomData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0); // seconds
  const [isExamOver, setIsExamOver] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false); // <--- modal state untuk reset sesi
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false); // <--- modal state kumpul ujian
  const [previewImage, setPreviewImage] = useState<string | null>(null); // <--- Preview gambar student zoom clicks
  const [isNavModalOpen, setIsNavModalOpen] = useState(false); // <--- Modal navigasi soal mobile
  const [isCheatWarningOpen, setIsCheatWarningOpen] = useState(false); // <--- Modal peringatan cheat
  // Anti-Cheat State
  const [isLocked, setIsLocked] = useState(false);
  const [isSkipNoticeOpen, setIsSkipNoticeOpen] = useState(false); // <--- Modal peringatan skip
  const [targetIndex, setTargetIndex] = useState<number | null>(null); // <--- Target soal saat transisi skip

  // For debounce saving
  const saveTimeoutRef = useRef<Record<string, any>>({});
  const lastCheatTimeRef = useRef<number>(0); // <--- Jeda deteksi cheat
  const isIndexRestored = useRef(false);

  // Fix order randomizer on reload
  const [questionOrder, setQuestionOrder] = useState<string[]>([]);
  const [choicesOrder, setChoicesOrder] = useState<Record<string, string[]>>({});
  const [itemsOrder, setItemsOrder] = useState<Record<string, string[]>>({});
  const [matchingOptions, setMatchingOptions] = useState<Record<string, string[]>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!student || !roomId) return;

    const loadExamData = async () => {
      try {
        // 1. Load Room
        const roomRef = ref(database, `exam_rooms/${roomId}`);
        const roomSnap = await get(roomRef);
        if (!roomSnap.exists()) throw new Error("Ruang ujian tidak ditemukan");
        const rData = roomSnap.val();

        if (rData.status === "archive") {
          throw new Error("Ruang ujian ini sudah diarsipkan dan tidak lagi aktif.");
        }

        let examTitle = "CBT";
        let subject = "Ujian";
        let teacherName = "-";
        if (rData.examId) {
          const examSnap = await get(ref(database, `exams/${rData.examId}`));
          if (examSnap.exists()) {
            const eData = examSnap.val();
            examTitle = eData.title || "CBT";
            subject = eData.subject || "Ujian";
            if (eData.subjectId) {
              const subjectSnap = await get(ref(database, `subjects/${eData.subjectId}`));
              if (subjectSnap.exists()) {
                subject = subjectSnap.val().name || subject;
              }
            }
            if (eData.teacherId) {
              const teacherSnap = await get(ref(database, `teachers/${eData.teacherId}`));
              if (teacherSnap.exists()) {
                teacherName = teacherSnap.val().name || "-";
              }
            }
          }
        }
        setRoomData({ ...rData, examTitle, subject, teacherName });

        // 2. Load Attempt
        const attemptRef = ref(database, `attempts/${roomId}/${student.nisn}`);
        const attemptSnap = await get(attemptRef);
        
        let initialCheatCount = 0;
        let startTime = Date.now();
        let currentStatus = "ongoing";
        let attemptDataToStore: any = { status: "ongoing", cheatCount: 0 };

        if (attemptSnap.exists()) {
          const aData = attemptSnap.val();
          
          // 🛡️ Backfill startTime jika absen di database (mencegah reset saat refresh)
          if (!aData.startTime) {
            aData.startTime = Date.now();
            await update(attemptRef, { startTime: aData.startTime });
          }

          attemptDataToStore = { ...aData, startTime: aData.startTime }; 
          if (aData.status === "LOCKED") {
            setIsLocked(true);
          }
          if (aData.status === "submitted") {
              navigate(`/cbt/${roomId}/result`);
              return;
          }
          initialCheatCount = aData.cheatCount || 0;
          startTime = aData.startTime;
          currentStatus = aData.status;
        } else {
          // Create initial attempt
          const initialData = {
            nisn: student.nisn,
            roomId: roomId,
            status: "ongoing",
            cheatCount: 0,
            startTime: startTime,
            extraCheatLimit: 0,
          };
          await set(attemptRef, initialData);
          attemptDataToStore = initialData;
        }

        // Calculate Time Left based on personal START TIME
        const now = Date.now();
        const roomEndTime = new Date(rData.end_time).getTime();
        const personalEndTime = startTime + (rData.duration * 60 * 1000);
        
        // Final end time is the EARLIEST of personal duration vs room global end time
        const finalEndTime = Math.min(personalEndTime, roomEndTime);
        const diff = Math.floor((finalEndTime - now) / 1000);
        
        if (diff <= 0) {
          setIsExamOver(true);
          // Auto-submit if time's up and it wasn't already
          if (currentStatus === "ongoing") {
             // we can't call handleSubmit here because questions aren't loaded yet
             // but setIsExamOver will trigger auto-submit via useEffect once loading is false
          }
        }
        
        setTimeLeft(Math.max(0, diff));
        setAttempt(attemptDataToStore);

        // 3. Load Answers
        let initialAnswers = {};
        const answersRef = ref(database, `answers/${roomId}/${student.nisn}`);
        const answersSnap = await get(answersRef);
        if (answersSnap.exists()) {
          initialAnswers = answersSnap.val();
          setAnswers(initialAnswers);
        }

        const flagKey = `flags_${student.nisn}_${roomId}`;
        const savedFlags = sessionStorage.getItem(flagKey);
        if (savedFlags) {
          try {
            setFlaggedQuestions(JSON.parse(savedFlags));
          } catch (e) {}
        }

        // 4. Load Questions
        const questionsRef = ref(database, `questions`);
        const questionsSnap = await get(questionsRef);
        if (questionsSnap.exists()) {
          const qData = questionsSnap.val();
          const loadedQuestions: Question[] = [];
          
          Object.keys(qData).forEach((key) => {
            if (qData[key].examId === rData.examId) {
              loadedQuestions.push({ id: key, ...qData[key] });
            }
          });

          // 🛡️ Urutkan loadedQuestions berdasarkan createdAt & ID agar stabil di cluster
          loadedQuestions.sort((a: any, b: any) => {
            const timeA = a.createdAt || 0;
            const timeB = b.createdAt || 0;
            if (timeA !== timeB) return timeA - timeB;
            return a.id.localeCompare(b.id);
          });

          // ⚡ Helper Acak Soal Berkelompok (Literasi)
          const clusterShuffleIds = (list: string[]): string[] => {
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
            const collection: (string | string[])[] = [...standalone, ...Object.values(grouped)];
            
            // Shuffle choices/items/matching options once during initialization
            const newChoicesOrder: Record<string, string[] | any> = {};
            const newItemsOrder: Record<string, string[]> = {};
            const newMatchingOptions: Record<string, string[]> = {};

            loadedQuestions.forEach((q: any) => {
              if (q.choices) {
                const keys = Object.keys(q.choices);
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

            // Restore from SessionStorage if exists
            const savedChoices = sessionStorage.getItem(`choices_${student.nisn}_${roomId}`);
            if (savedChoices) {
              try { Object.assign(newChoicesOrder, JSON.parse(savedChoices)); } catch (e) {}
            }
            const savedItems = sessionStorage.getItem(`items_${student.nisn}_${roomId}`);
            if (savedItems) {
              try { Object.assign(newItemsOrder, JSON.parse(savedItems)); } catch (e) {}
            }
            const savedMatch = sessionStorage.getItem(`match_${student.nisn}_${roomId}`);
            if (savedMatch) {
              try { Object.assign(newMatchingOptions, JSON.parse(savedMatch)); } catch (e) {}
            }

            sessionStorage.setItem(`choices_${student.nisn}_${roomId}`, JSON.stringify(newChoicesOrder));
            sessionStorage.setItem(`items_${student.nisn}_${roomId}`, JSON.stringify(newItemsOrder));
            sessionStorage.setItem(`match_${student.nisn}_${roomId}`, JSON.stringify(newMatchingOptions));

            setChoicesOrder(newChoicesOrder);
            setItemsOrder(newItemsOrder);
            setMatchingOptions(newMatchingOptions);

            // 🛡️ Gunakan Fisher-Yates Shuffle agar stabil & adil
            for (let i = collection.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [collection[i], collection[j]] = [collection[j], collection[i]];
            }
            return collection.flat();
          };

          const orderKey = `order_${student.nisn}_${roomId}`;
          let savedOrder = sessionStorage.getItem(orderKey);
          let order: string[] = [];

          const currentIds = loadedQuestions.map((q) => q.id);

          if (savedOrder) {
            try {
              order = JSON.parse(savedOrder);
              order = order.filter((id) => currentIds.includes(id));
              const newIds = currentIds.filter((id) => !order.includes(id));
              if (newIds.length > 0) {
                 // acak soal baru dengan metode cluster, gabung di belakang
                 order = [...order, ...clusterShuffleIds(newIds)];
              }
              sessionStorage.setItem(orderKey, JSON.stringify(order));
            } catch (e) { order = []; }
          } 
          
          if (order.length === 0) {
            // 🏷️ Category Grouping Logic
            const pgIds = currentIds.filter(id => {
              const q = loadedQuestions.find(it => it.id === id);
              return !q?.type || q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks";
            });
            const essayIds = currentIds.filter(id => {
              const q = loadedQuestions.find(it => it.id === id);
              return q?.type === "isian_singkat" || q?.type === "uraian";
            });
            const intermediateIds = currentIds.filter(id => !pgIds.includes(id) && !essayIds.includes(id));

            // 🎲 Shuffle each category independently
            order = [
               ...clusterShuffleIds(pgIds),
               ...clusterShuffleIds(intermediateIds),
               ...clusterShuffleIds(essayIds)
            ];

            sessionStorage.setItem(orderKey, JSON.stringify(order));
          }

          setQuestionOrder(order);
          // Sort loadedQuestions based on order SAFELY
          const sorted = order.map((id) => loadedQuestions.find((q) => q.id === id)).filter((q): q is Question => !!q);
          setQuestions(sorted);

          // 🛡️ Load currentQuestionIndex dari sessionStorage
          const indexKey = `currentIndex_${student?.nisn}_${roomId}`;
          const savedIndex = sessionStorage.getItem(indexKey);
          if (savedIndex) {
            const idx = parseInt(savedIndex, 10);
            if (idx >= 0 && idx < sorted.length) {
              setCurrentQuestionIndex(idx);
            }
          }
          isIndexRestored.current = true; // <--- Tandai sudah dipulihkan
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadExamData();

    // Setup realtime unlock/reset listener from Admin
    const attemptRefLocal = ref(database, `attempts/${roomId}/${student.nisn}`);
    let isInitialFetch = true;

    const unsubscribeStatus = onValue(attemptRefLocal, (snapshot) => {
      if (!snapshot.exists()) {
        if (isInitialFetch) {
          isInitialFetch = false;
          return; // Abaikan null pada load pertama (racing condition)
        }
        // Berarti node attempt telah DIHAPUS (Reset Sesi) oleh Admin
        setIsResetModalOpen(true); // <--- Buka Dialog visual
        return;
      }

      isInitialFetch = false; // Setel ke false setelah data pertama terbaca ada
      const aData = snapshot.val();

      if (aData?.status === "ongoing") {
        // Jika sebelumnya terkunci, tendang kembali ke dashboard untuk validasi ulang
        if (isLocked) {
          navigate("/"); 
        } else {
          setIsLocked(false);
        }
      }
    });

    return () => unsubscribeStatus();
  }, [student, roomId, isLocked]);

  // Timer Countdown Logic
  useEffect(() => {
    if (loading || isLocked || isExamOver || !roomData || !attempt) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const roomEndTime = new Date(roomData.end_time).getTime();
      const personalEndTime = (attempt.startTime || now) + (roomData.duration * 60 * 1000);
      
      const finalEndTime = Math.min(personalEndTime, roomEndTime);
      const diff = Math.floor((finalEndTime - now) / 1000);

      if (diff <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
        handleAutoSubmit();
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, isLocked, isExamOver, roomData, attempt]);

  // Anti-Cheat (Visibility Change)
  useEffect(() => {
    if (loading || isLocked || isExamOver) return;

    let isLeaving = false;
    const handleBeforeUnload = () => {
      isLeaving = true;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    const handleVisibilityChange = async () => {
      if (isLeaving) return; // Mengabaikan jika halaman sedang direfresh/ditutup
      
      if (document.visibilityState === "hidden") {
        if (!attempt) return;

        const now = Date.now();
        if (now - lastCheatTimeRef.current < 30000) {
          return; // Abaikan jika belum lewat 30 detik dari deteksi terakhir
        }
        lastCheatTimeRef.current = now;
        
        const newCheatCount = (attempt.cheatCount || 0) + 1;
        setAttempt((prev) => prev ? { ...prev, cheatCount: newCheatCount } : null);

        const attemptRef = ref(database, `attempts/${roomId}/${student?.nisn}`);
        
        const extraLimit = attempt?.extraCheatLimit || 0;
        const totalAllowed = (roomData?.cheat_limit || 3) + extraLimit;
        
        if (newCheatCount > totalAllowed) {
          setIsLocked(true);
          await update(attemptRef, { status: "LOCKED", cheatCount: newCheatCount });
        } else {
          await update(attemptRef, { cheatCount: newCheatCount });
          setIsCheatWarningOpen(true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [loading, isLocked, isExamOver, attempt, roomData]);

  // Auto-submit effect when time is up on load OR timer ends
  useEffect(() => {
    if (!loading && isExamOver && attempt?.status === "ongoing") {
      handleSubmitExam();
    }
  }, [loading, isExamOver, attempt?.status]);

  // Online / Offline Presence Tracking using onDisconnect
  useEffect(() => {
    if (!student || !roomId || loading) return;

    const attemptId = `${student.nisn}`; // path simplified in local but keeps nisin reference
    const attemptRefLocal = ref(database, `attempts/${roomId}/${student.nisn}`);
    
    // Set online
    update(attemptRefLocal, { isOnline: true });

    // Set offline on break/close/disconnect
    const disconnection = onDisconnect(attemptRefLocal);
    disconnection.update({ isOnline: false });

    return () => {
      // Clear onDisconnect when manually unmounting, and set to offline
      disconnection.cancel();
      update(attemptRefLocal, { isOnline: false });
    };
  }, [student, roomId, loading]);

  // Disable Copy, Paste, Cut, Right-Click, and Selection
  useEffect(() => {
    const preventAction = (e: Event) => e.preventDefault();

    window.addEventListener("contextmenu", preventAction); // Klik kanan
    window.addEventListener("copy", preventAction);        // Salin
    window.addEventListener("paste", preventAction);       // Tempel
    window.addEventListener("cut", preventAction);        // Potong
    window.addEventListener("selectstart", preventAction); // Seleksi Teks

    return () => {
      window.removeEventListener("contextmenu", preventAction);
      window.removeEventListener("copy", preventAction);
      window.removeEventListener("paste", preventAction);
      window.removeEventListener("cut", preventAction);
      window.removeEventListener("selectstart", preventAction);
    };
  }, []);

  // 🛡️ Simpan currentQuestionIndex ke sessionStorage setiap kali berganti soal
  useEffect(() => {
    if (student && roomId && isIndexRestored.current) {
      const indexKey = `currentIndex_${student.nisn}_${roomId}`;
      sessionStorage.setItem(indexKey, currentQuestionIndex.toString());
    }
  }, [currentQuestionIndex, student, roomId]);

  const toggleFlag = (qId: string) => {
    const flagKey = `flags_${student?.nisn}_${roomId}`;
    setFlaggedQuestions((prev) => {
      const updated = { ...prev, [qId]: !prev[qId] };
      sessionStorage.setItem(flagKey, JSON.stringify(updated));
      return updated;
    });
  };

  const logInteraction = async (qId: string, action: "visit" | "answer" | "skip") => {
    if (!student || !roomId) return;
    try {
      const logRef = ref(database, `activity_logs/${roomId}/${student.nisn}/${qId}`);
      await update(logRef, {
        [action]: Date.now(),
        last_action: action
      });
    } catch (e) {}
  };

  const goToQuestion = (index: number) => {
    if (index === currentQuestionIndex) return;
    
    const currentQId = questions[currentQuestionIndex]?.id;
    const isAnswered = answers[currentQId] !== undefined;

    // Log skip if moving away without answer
    if (!isAnswered) {
      logInteraction(currentQId, "skip");
    }

    setTargetIndex(null);
    setCurrentQuestionIndex(index);
    // Log visit to new question
    const newQId = questions[index]?.id;
    if (newQId) logInteraction(newQId, "visit");
  };

  const handleNextClick = () => {
    const currentQId = questions[currentQuestionIndex]?.id;
    const isAnswered = answers[currentQId] !== undefined;
    const currentQ = questions[currentQuestionIndex];
    const isPG = !currentQ.type || currentQ.type === "pilihan_ganda" || currentQ.type === "pilihan_ganda_kompleks";

    if (!isAnswered && !isPG) {
      setTargetIndex(currentQuestionIndex + 1);
      setIsSkipNoticeOpen(true);
      return;
    }

    goToQuestion(currentQuestionIndex + 1);
  };

  const handleNavClick = (index: number) => {
    const currentQId = questions[currentQuestionIndex]?.id;
    const isAnswered = answers[currentQId] !== undefined;
    const currentQ = questions[currentQuestionIndex];
    const isPG = !currentQ.type || currentQ.type === "pilihan_ganda" || currentQ.type === "pilihan_ganda_kompleks";

    if (!isAnswered && index !== currentQuestionIndex && !isPG) {
      setTargetIndex(index);
      setIsSkipNoticeOpen(true);
      return;
    }

    goToQuestion(index);
    setIsNavModalOpen(false);
  };

  const handleAnswerSelect = (questionId: string, value: any) => {
    if (isExamOver || isLocked) return;

    setAnswers((prev) => {
      const updated = { ...prev, [questionId]: value };
      
      // Log as answer
      logInteraction(questionId, "answer");

      // Debounced Save to Firebase Answers List
      if (saveTimeoutRef.current[questionId]) {
        clearTimeout(saveTimeoutRef.current[questionId]);
      }

      saveTimeoutRef.current[questionId] = setTimeout(async () => {
        const answersRef = ref(database, `answers/${roomId}/${student?.nisn}`);
        await update(answersRef, { [questionId]: value });
        // Backup to SessionStorage
        sessionStorage.setItem(`ans_${student?.nisn}_${roomId}`, JSON.stringify(updated));
      }, 300);

      return updated;
    });
  };

  const handleAutoSubmit = useCallback(async () => {
    setIsExamOver(true);
    await handleSubmitExam();
  }, [questions, answers, roomData]);

  const handleSubmitExam = async () => {
    if (!student || !roomId || !roomData) return;

    setLoading(true);
    try {
      let correctCount = 0;
      let totalQuestions = questions.length;

      questions.forEach((q: any) => {
        const studentAnswer = answers[q.id];
        const type = q.type || "pilihan_ganda";

        if (!studentAnswer) return;

        if (type === "pilihan_ganda" || type === "benar_salah") {
          if (studentAnswer && q.choices[studentAnswer]?.isCorrect === true) {
            correctCount++;
          }
        } 
        else if (type === "pilihan_ganda_kompleks") {
          // Check if all correct keys are in studentAnswer AND no extra keys
          const correctKeys = Object.keys(q.choices).filter(k => q.choices[k].isCorrect);
          const isAllCorrect = Array.isArray(studentAnswer) && 
            studentAnswer.length === correctKeys.length && 
            studentAnswer.every(k => correctKeys.includes(k));
          if (isAllCorrect) correctCount++;
        }
        else if (type === "menjodohkan") {
          // Each pair is correct
          const totalPairs = (q.pairs || []).length;
          let correctPairs = 0;
          (q.pairs || []).forEach((p: any) => {
            if (studentAnswer[p.id] === p.right) correctPairs++;
          });
          if (totalPairs > 0) correctCount += (correctPairs / totalPairs);
        }
        else if (type === "isian_singkat") {
          if (q.answerKey && isFuzzyMatch(studentAnswer, q.answerKey)) {
            correctCount++;
          }
        }
        else if (type === "urutkan" || type === "drag_drop") {
          const items = q.items || [];
          const correctOrder = items.map((it: any) => it.id);
          const isAllCorrect = Array.isArray(studentAnswer) && 
            studentAnswer.length === correctOrder.length && 
            studentAnswer.every((val, idx) => val === correctOrder[idx]);
          if (isAllCorrect) correctCount++;
        }
        // Uraian is not auto-scored
      });

      const score = Math.round((correctCount / totalQuestions) * 100) || 0;

      const attemptRef = ref(database, `attempts/${roomId}/${student.nisn}`);
      await update(attemptRef, {
        status: "submitted",
        score: score,
        correct: correctCount,
        total: totalQuestions,
        submittedAt: Date.now(),
        isOnline: false,
      });

      // Clear layout triggers
      sessionStorage.removeItem(`order_${student.nisn}_${roomId}`);
      sessionStorage.removeItem(`ans_${student.nisn}_${roomId}`);
      sessionStorage.removeItem(`currentIndex_${student.nisn}_${roomId}`);

      navigate(`/cbt/${roomId}/result`);
    } catch (err) {
      console.error(err);
      alert("Gagal mengumpulkan!");
    } finally {
      setLoading(false);
    }
  };

  const getProxiedUrl = (url?: string) => {
    return url || "";
  };

  const proxifyHtml = (html?: string) => {
    return html || "";
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}:` : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="bg-card p-6 rounded-2xl shadow-md max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-red-600 mb-2">Ujian Terkunci!</h2>
          <p className="text-slate-600 text-sm mb-4">
            Anda terindikasi melakukan pelanggaran anti-cheat melebihi batas yang diizinkan. Silakan hubungi pengawas atau admin untuk membuka kunci navigasi Anda.
          </p>
          <div className="text-slate-400 text-xs">Cheat count: {attempt?.cheatCount}</div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const submitWindowSeconds = (roomData?.submit_window || 0) * 60;
  const isSubmitAllowed = submitWindowSeconds === 0 || timeLeft <= submitWindowSeconds;

  const unansweredCount = questions.filter((q) => answers[q.id] === undefined).length;
  const isAllAnswered = unansweredCount === 0;

  return (
    <div className="h-screen h-[100dvh] bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden select-none">
      {/* Top Header Panel (Ultra Compact) */}
      <header className="sticky top-0 z-10 bg-card/95 dark:bg-slate-900/95 border-b shadow-sm h-12 px-4 flex items-center justify-between text-xs sm:text-sm">
        {/* Left: Timer */}
        <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          <span className={`font-mono font-bold ${timeLeft < 300 ? "text-red-500 animate-pulse" : "text-amber-800 dark:text-amber-200"}`}>
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Center: Subject & Exam */}
        <div className="flex flex-col items-center text-center">
          <p className="font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{roomData?.subject || "Ujian"} - {roomData?.teacherName || "-"}</p>
          <p className="text-[10px] text-slate-500 font-medium">{roomData?.room_name || roomData?.examTitle || "CBT"}</p>
        </div>

        {/* Right: Student Info */}
        <div className="flex flex-col items-end text-right">
          <p className="font-semibold text-slate-700 dark:text-slate-200 line-clamp-1">{student?.name}</p>
          <p className="text-[10px] text-slate-400">{student?.className || "Siswa"}</p>
        </div>
      </header>

      {/* Main Grid: Question View & Nav Panel */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Questions View */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 space-y-4">
          {currentQuestion && (
            <Card className="rounded-xl border shadow-sm">
              <CardHeader className="p-4 pb-2">
                <div className="relative bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/20 shrink-0">
                      {currentQuestionIndex + 1}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Soal Nomor {currentQuestionIndex + 1}</span>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md text-[9px] font-black uppercase tracking-wider border border-blue-200/60 dark:border-blue-800/60">
                           {(() => {
                              switch(currentQuestion.type) {
                                 case "pilihan_ganda": return "Pilihan Ganda";
                                 case "pilihan_ganda_kompleks": return "PG Kompleks";
                                 case "menjodohkan": return "Menjodohkan";
                                 case "benar_salah": return "Benar / Salah";
                                 case "isian_singkat": return "Isian Singkat";
                                 case "uraian": return "Essay / Uraian";
                                 case "urutkan": return "Mengurutkan";
                                 case "drag_drop": return "Drag & Drop";
                                 default: return "Pilihan Ganda";
                              }
                           })()}
                        </span>
                        {currentQuestion.groupId && (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-md text-[9px] font-black uppercase tracking-wider border border-amber-200/60 dark:border-amber-800/60">
                             {currentQuestion.groupId}
                          </span>
                        )}
                        {answers[currentQuestion.id] !== undefined && (
                          <motion.span 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-md text-[9px] font-black uppercase tracking-wider border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1 shadow-sm"
                          >
                             <CheckCircle2 className="w-2.5 h-2.5" />
                             Terjawab
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </div>

                  {currentQuestion && (
                    <div className="absolute top-4 right-4">
                      <button 
                        onClick={() => toggleFlag(currentQuestion.id)} 
                        className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition-all duration-500 shadow-lg ${
                           flaggedQuestions[currentQuestion.id] 
                             ? "bg-amber-500 text-white shadow-amber-500/40 ring-4 ring-amber-500/10 scale-110" 
                             : "bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:border-amber-200 border border-slate-100 dark:border-slate-700 shadow-slate-200/50"
                        }`}
                        title={flaggedQuestions[currentQuestion.id] ? "Hapus Tanda Ragu" : "Tandai Ragu-ragu"}
                      >
                         <Bookmark className={`w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-500 ${flaggedQuestions[currentQuestion.id] ? "fill-white scale-110" : "group-hover:scale-110"}`} />
                         {flaggedQuestions[currentQuestion.id] && (
                           <motion.span 
                              layoutId="badgeRagu"
                              className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white dark:border-slate-800 rounded-full"
                           />
                         )}
                      </button>
                    </div>
                  )}
                </div>
                {currentQuestion.imageUrl && (
                  <div className="mt-2">
                    <img 
                      src={getProxiedUrl(currentQuestion.imageUrl)} 
                      alt="Gambar Soal" 
                      className="max-w-full md:max-w-xl h-auto mx-auto block rounded-xl border border-slate-200 shadow-sm cursor-zoom-in hover:opacity-90 transition-opacity" 
                      onClick={() => setPreviewImage(getProxiedUrl(currentQuestion.imageUrl))}
                    />
                  </div>
                )}

                {/* 🔖 Render Literasi dari Soal Pertama di Grup ini */}
                {currentQuestion.groupId && (() => {
                  const firstInGroup = questions.find(q => q.groupId === currentQuestion.groupId);
                  if (firstInGroup) {
                    // Prioritaskan groupText (Wacana Terpisah)
                    const textToShow = firstInGroup.groupText || firstInGroup.text;
                    if (!textToShow) return null;

                    const hasCover = firstInGroup.imageUrl;
                    return (
                      <div className="bg-blue-50/20 dark:bg-blue-950/10 p-4 rounded-xl border border-dashed border-blue-200 dark:border-blue-800/40 mb-3 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/20 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/40 w-fit block">Wacana Literasi</span>
                        {hasCover && (
                          <div className="mt-2">
                            <img src={getProxiedUrl(firstInGroup.imageUrl)} className="max-w-sm h-auto mx-auto block rounded-lg border shadow-sm" alt="Cover Literasi" />
                          </div>
                        )}
                        <div 
                          className={`text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300 [&_img]:max-w-sm [&_img]:mx-auto [&_img]:block font-medium p-0 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 [&_ol]:my-2 [&_ul]:my-2 ql-editor ${hasCover ? "[&_img]:hidden" : ""}`} 
                          dangerouslySetInnerHTML={{ __html: proxifyHtml(textToShow) }} 
                        />
                      </div>
                    );
                  }
                  return null;
                })()}

                <div 
                  className="text-base sm:text-lg font-normal leading-relaxed text-slate-800 dark:text-white mt-2 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:mt-2 [&_img]:border [&_img]:shadow-sm break-words [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 [&_ol]:my-2 [&_ul]:my-2 ql-editor p-0" 
                  dangerouslySetInnerHTML={{ __html: proxifyHtml(currentQuestion.text) }}
                />
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                {/* RENDER FOR CHOICE TYPES (SINGLE/MULTIPLE) */}
                {(currentQuestion.type === "pilihan_ganda" || currentQuestion.type === "pilihan_ganda_kompleks" || !currentQuestion.type) && (
                  <div className="space-y-2.5">
                    {(() => {
                      const order = choicesOrder[currentQuestion.id] || Object.keys(currentQuestion.choices || {});
                      return order.map((choiceId, idx) => {
                        const choice = currentQuestion.choices?.[choiceId];
                        if (!choice) return null;
                        
                        const isMultiple = currentQuestion.type === "pilihan_ganda_kompleks";
                        const isSelected = isMultiple 
                          ? (answers[currentQuestion.id] || []).includes(choiceId)
                          : answers[currentQuestion.id] === choiceId;

                        const onSelect = () => {
                          if (isMultiple) {
                            const currentAnswers = Array.isArray(answers[currentQuestion.id]) ? answers[currentQuestion.id] : [];
                            const newAnswers = currentAnswers.includes(choiceId) 
                              ? currentAnswers.filter((id: string) => id !== choiceId) 
                              : [...currentAnswers, choiceId];
                            handleAnswerSelect(currentQuestion.id, newAnswers);
                          } else {
                            handleAnswerSelect(currentQuestion.id, choiceId);
                          }
                        };

                        return (
                          <button
                            key={choiceId}
                            onClick={onSelect}
                            className={`w-full text-left p-3.5 rounded-2xl border flex items-center gap-3.5 transition-all outline-none ring-offset-2 focus:ring-2 focus:ring-blue-500/20 active:scale-[0.99] ${
                              isSelected 
                                ? "bg-blue-50/80 border-blue-500 shadow-sm text-blue-700 dark:bg-blue-900/20 dark:border-blue-400 dark:text-blue-300" 
                                : "bg-card border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            <div className={`w-7 h-7 shrink-0 rounded-full border flex items-center justify-center font-bold text-sm transition-colors ${
                              isSelected ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/30" : "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-slate-500"
                            }`}>
                              {String.fromCharCode(65 + idx)}
                            </div>
                            <div className="flex-1 text-sm font-medium">
                              <div className="break-words ql-editor p-0 [&_img]:max-w-[200px] [&_img]:h-auto [&_img]:rounded-lg [&_img]:mt-1" dangerouslySetInnerHTML={{ __html: proxifyHtml(choice.text) }} />
                              {choice.imageUrl && (
                                <img 
                                  src={getProxiedUrl(choice.imageUrl)} 
                                  alt={`Pilihan ${String.fromCharCode(65 + idx)}`} 
                                  className="max-h-[150px] w-auto rounded-lg mt-2 border cursor-zoom-in hover:opacity-90 transition-opacity shadow-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewImage(getProxiedUrl(choice.imageUrl));
                                  }}
                                />
                              )}
                            </div>
                            {isMultiple && (
                              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 dark:border-slate-700"}`}>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                              </div>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* RENDER FOR TRUE/FALSE */}
                {currentQuestion.type === "benar_salah" && (
                  <div className="grid grid-cols-2 gap-5 px-2">
                    {(() => {
                      const keys = Object.keys(currentQuestion.choices || {}).slice(0, 2);
                      return keys.map((choiceId, idx) => {
                        const choice = currentQuestion.choices![choiceId];
                        const isSelected = answers[currentQuestion.id] === choiceId;
                        const isBenar = choice.text.toLowerCase().includes("benar") || idx === 0;

                        return (
                          <button
                            key={choiceId}
                            onClick={() => handleAnswerSelect(currentQuestion.id, choiceId)}
                            className={`group relative flex flex-col items-center justify-center gap-4 py-8 px-6 rounded-[2.5rem] border-2 transition-all duration-300 active:scale-95 ${
                              isSelected 
                                ? (isBenar 
                                   ? "bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-400 text-white shadow-xl shadow-emerald-500/30 ring-4 ring-emerald-500/10" 
                                   : "bg-gradient-to-br from-rose-500 to-rose-600 border-rose-400 text-white shadow-xl shadow-rose-500/30 ring-4 ring-rose-500/10")
                                : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 shadow-sm"
                            }`}
                          >
                            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-300 ${
                              isSelected 
                                ? "bg-white/20 text-white backdrop-blur-md"
                                : (isBenar 
                                   ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 dark:text-emerald-400" 
                                   : "bg-rose-50 dark:bg-rose-950/20 text-rose-500 dark:text-rose-400")
                            }`}>
                              {isBenar 
                                ? <CheckCircle2 className="w-9 h-9" strokeWidth={2.5} /> 
                                : <X className="w-9 h-9" strokeWidth={2.5} />}
                            </div>

                            <span 
                              className={`font-black text-sm uppercase tracking-widest text-center transition-colors duration-300 ${
                                isSelected ? "text-white" : "text-slate-700 dark:text-slate-200"
                              }`} 
                              dangerouslySetInnerHTML={{ __html: proxifyHtml(choice.text) }} 
                            />
                            
                            {/* Inner Shine Effect */}
                            {isSelected && (
                              <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-[2.5rem] pointer-events-none" />
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* RENDER MATCHING (Visual Drag & Drop / Click-to-Pair) */}
                {currentQuestion.type === "menjodohkan" && (
                  <div className="space-y-6">
                    {/* INFO HEADER */}
                    <div className="flex items-center gap-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/40 text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">
                      <HelpCircle className="w-4 h-4" />
                      <span>Pasangkan pernyataan kiri dengan jawaban yang tepat di kanan</span>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* LEFT SIDE: TARGET SLOTS (STATEMENTS) */}
                      <div className="flex-1 space-y-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Pernyataan & Pasangan</span>
                        {(currentQuestion.pairs || []).map((pair) => {
                          const studentAns = answers[currentQuestion.id] || {};
                          const assignedValue = studentAns[pair.id];

                          return (
                            <div key={pair.id} className="group flex items-stretch gap-2 min-h-[50px]">
                              <div className="flex-1 p-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm">
                                {pair.left}
                              </div>
                              <div className="w-1.5 flex items-center justify-center opacity-20"><ArrowRight className="w-4 h-4" /></div>
                              <div 
                                className={`flex-1 p-1 rounded-xl border-2 border-dashed flex items-center justify-center min-h-[50px] transition-all relative overflow-hidden ${
                                  assignedValue 
                                    ? "bg-blue-50/20 border-blue-400/50 dark:bg-blue-900/10 dark:border-blue-800/80" 
                                    : "bg-slate-50/30 border-slate-200 dark:bg-slate-900/20 dark:border-slate-800/60"
                                }`}
                              >
                                {assignedValue ? (
                                  <motion.div 
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="w-full h-full flex items-center justify-center bg-blue-600 text-white rounded-lg shadow-sm p-2 text-xs font-bold relative group cursor-pointer"
                                    onClick={() => {
                                      // Return to bank: Remove from answers
                                      const newAns = { ...studentAns };
                                      delete newAns[pair.id];
                                      handleAnswerSelect(currentQuestion.id, newAns);
                                    }}
                                  >
                                    <span className="text-center">{assignedValue}</span>
                                    <div className="absolute top-0 right-0 p-0.5 bg-rose-500 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                       <X className="w-2.5 h-2.5" />
                                    </div>
                                  </motion.div>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-300 dark:text-slate-700 uppercase">Drop Disini</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* RIGHT SIDE: ANSWER BANK */}
                      <div className="lg:w-1/3 flex flex-col gap-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Pilihan Jawaban</span>
                        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap gap-2 min-h-[100px] content-start">
                          {(() => {
                            const studentAns = answers[currentQuestion.id] || {};
                            const assignedValues = Object.values(studentAns);
                            const allOptions = matchingOptions[currentQuestion.id] || Array.from(new Set((currentQuestion.pairs || []).map(p => p.right)));

                            // Filter out options that are already assigned (menjodohkan hanya bisa sekali)
                            const availableOptions = allOptions.filter(opt => !assignedValues.includes(opt));

                            if (availableOptions.length === 0 && assignedValues.length < (currentQuestion.pairs || []).length) {
                               // This scenario should only happen if options reuse is allowed, but here we restrict it.
                            }

                            return (
                              <>
                                {availableOptions.map((opt, i) => (
                                  <motion.div
                                    key={`${i}-${opt}`}
                                    layoutId={`${currentQuestion.id}-${opt}`}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-[12px] font-bold text-blue-600 dark:text-blue-400 shadow-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors border-b-2 border-b-slate-200 dark:border-b-indigo-900/40"
                                    onClick={() => {
                                      // Click-to-assign logic for mobile and convenience
                                      // Find first empty target slot
                                      const firstEmptyPair = (currentQuestion.pairs || []).find(p => !studentAns[p.id]);
                                      if (firstEmptyPair) {
                                        const newAns = { ...studentAns, [firstEmptyPair.id]: opt };
                                        handleAnswerSelect(currentQuestion.id, newAns);
                                      }
                                    }}
                                  >
                                    {opt}
                                  </motion.div>
                                ))}
                                {availableOptions.length === 0 && (
                                  <div className="w-full py-8 text-center text-slate-400 text-[10px] font-medium uppercase italic">Semua jawaban telah dipasangkan</div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <p className="text-[10px] text-slate-400 italic px-2">
                          * Klik jawaban untuk memasangkan secara otomatis, klik tombol (X) pada pasangan untuk membatalkan.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* RENDER ISIAN SINGKAT / URAIAN */}
                {(currentQuestion.type === "isian_singkat" || currentQuestion.type === "uraian") && (
                  <div className="space-y-4">
                    <div className="relative">
                      <textarea
                        value={answers[currentQuestion.id] || ""}
                        onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)}
                        placeholder="Tuliskan jawaban Anda di sini..."
                        rows={currentQuestion.type === "uraian" ? 6 : 2}
                        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm focus:ring-2 focus:ring-blue-500/20 text-slate-800 dark:text-white font-medium resize-none transition-all placeholder:text-slate-400"
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200/50 text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                        <AlertCircle className="w-3 h-3" />
                        {currentQuestion.type === "uraian" ? "Koreksi Guru" : "Auto Koreksi"}
                      </div>
                    </div>
                  </div>
                )}

                {/* RENDER ORDERING / DRAG & DROP (Visual Reorder) */}
                {(currentQuestion.type === "urutkan" || currentQuestion.type === "drag_drop") && (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 p-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-2xl border border-blue-100/50 dark:border-blue-900/40 shadow-sm">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Tarik dan pindahkan kartu untuk menyusun urutan yang menurut Anda benar. Kartu akan otomatis bergeser jika Anda menyeretnya. Urutan dari atas ke bawah (A ke B, dst).</p>
                    </div>

                    <div className="flex gap-4">
                      {/* Drop Indicator List */}
                      <div className="w-12 space-y-3 pt-2">
                        {(() => {
                           const items = currentQuestion.items || [];
                           return items.map((_, i) => (
                             <div key={i} className="h-[74px] flex flex-col items-center justify-center">
                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white dark:border-slate-700 flex items-center justify-center font-black text-[10px] text-slate-400 relative">
                                  {i + 1}
                                  {i < items.length - 1 && <div className="absolute top-full w-0.5 h-10 bg-slate-100 dark:bg-slate-800/50" />}
                                </div>
                             </div>
                           ));
                        })()}
                      </div>

                    <Reorder.Group 
                      axis="y" 
                      onReorder={(newOrder: string[]) => handleAnswerSelect(currentQuestion.id, newOrder)}
                      values={answers[currentQuestion.id] || itemsOrder[currentQuestion.id] || (currentQuestion.items || []).map(it => it.id)}
                      className="space-y-3 relative flex-1"
                    >
                      {(() => {
                        const items = currentQuestion.items || [];
                        const currentOrder: string[] = answers[currentQuestion.id] || itemsOrder[currentQuestion.id] || items.map(it => it.id);
                        
                        return (
                          <AnimatePresence mode="popLayout" initial={false}>
                            {currentOrder.map((itemId, idx) => {
                              const item = items.find(it => it.id === itemId);
                              if (!item) return null;
                              return (
                                <Reorder.Item 
                                  key={itemId} 
                                  value={itemId}
                                  transition={{ type: "spring", stiffness: 600, damping: 50 }}
                                  whileDrag={{ 
                                    scale: 1.01, 
                                    boxShadow: "0 8px 20px rgba(0,0,0,0.1)", 
                                    zIndex: 50,
                                  }}
                                  className="flex items-center gap-4 p-4 bg-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm cursor-grab active:cursor-grabbing group select-none transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 active:border-indigo-500 overflow-hidden relative"
                                >
                                  {/* NOMOR URUT KECIL DI POJOK */}
                                  <div className="absolute top-0 right-0 p-1">
                                    <div className="text-[8px] font-black text-slate-300 dark:text-slate-700 bg-slate-50/50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded-bl-lg border-l border-b border-slate-100 dark:border-slate-800">
                                      {idx + 1}
                                    </div>
                                  </div>

                                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-base shrink-0 border border-blue-100 dark:border-blue-800/60 shadow-inner group-hover:scale-105 transition-transform">
                                    {String.fromCharCode(65 + idx)}
                                  </div>
                                  <div className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">
                                    {item.text}
                                  </div>
                                  <div className="px-1 text-slate-300 dark:text-slate-700 group-hover:text-blue-500 transition-colors">
                                    <GripVertical className="w-5 h-5" />
                                  </div>
                                </Reorder.Item>
                              );
                            })}
                          </AnimatePresence>
                        );
                      })()}
                    </Reorder.Group>
                    </div>
                    
                    <div className="flex items-center gap-2 justify-center py-2 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                       <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Sistem Urutan Interaktif Aktif</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Navs buttons moved to sidebar */}
        </div>

        {/* Right: Sidebar Navigation boxes */}
        <div className="hidden md:flex w-full md:w-72 bg-card dark:bg-slate-800 border-l p-4 flex-col space-y-4">
          <h3 className="text-sm font-semibold text-slate-500">Navigasi Soal</h3>
          <div className="grid grid-cols-5 md:flex md:flex-wrap gap-1 overflow-y-auto max-h-72 md:max-h-none flex-1">
            {questions.map((q, index) => {
              const isAnswered = answers[q.id] !== undefined;
              const isActive = index === currentQuestionIndex;
              const isFlagged = flaggedQuestions[q.id] === true;

              return (
                <button
                  key={q.id}
                  onClick={() => handleNavClick(index)}
                  className={`w-full aspect-square md:w-9 md:h-9 shrink-0 rounded-xl flex items-center justify-center font-bold text-xs border transition-all ${
                    isActive
                      ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/30"
                      : isAnswered
                      ? "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : isFlagged
                      ? "bg-amber-100 border-amber-200 text-amber-700 font-bold"
                      : "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-700 dark:border-slate-600"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t grid grid-cols-2 gap-2">
            <Button 
                variant="outline" 
                disabled={currentQuestionIndex === 0} 
                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                className="w-full text-slate-700 font-semibold rounded-xl"
            >
              Sebelumnya
            </Button>
            {currentQuestionIndex === questions.length - 1 ? (
              <Button 
                disabled={!isSubmitAllowed}
                onClick={() => setIsSubmitModalOpen(true)} 
                className={`w-full text-white font-semibold rounded-xl ${
                  !isSubmitAllowed ? "bg-slate-300 pointer-events-none" : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {isSubmitAllowed ? "Kumpulkan" : `Kumpul (${formatTime(timeLeft - submitWindowSeconds)})`}
              </Button>
            ) : (
            <Button 
                onClick={handleNextClick}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
              > 
                Selanjutnya 
              </Button>
            )}
          </div>

          <div className="pt-2 border-t flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 bg-blue-600 rounded"></div> Posisi Aktif
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 bg-amber-100 border border-amber-200 rounded"></div> Tandai Soal
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div> Terjawab
              </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="sticky bottom-0 left-0 right-0 bg-card dark:bg-slate-900 border-t p-3 md:hidden flex justify-between items-center z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Button 
            variant="outline" 
            disabled={currentQuestionIndex === 0} 
            onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
            size="sm"
            className="rounded-xl font-semibold"
        >
           Sebelumnya
        </Button>
        
        <Button variant="ghost" className="flex items-center gap-2 hover:bg-slate-50" onClick={() => setIsNavModalOpen(true)}>
           <span className="font-bold text-slate-700 dark:text-slate-200">{currentQuestionIndex + 1} / {questions.length}</span>
        </Button>

        {currentQuestionIndex === questions.length - 1 ? (
          <Button 
              disabled={!isSubmitAllowed}
              onClick={() => setIsSubmitModalOpen(true)} 
              className={`text-white font-semibold rounded-xl ${
                !isSubmitAllowed ? "bg-slate-300 pointer-events-none" : "bg-green-600 hover:bg-green-700"
              }`}
              size="sm"
          >
            {isSubmitAllowed ? "Kumpulkan" : `Kumpul`}
          </Button>
        ) : (
          <Button 
              onClick={handleNextClick}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
              size="sm"
          > 
              Selanjutnya 
          </Button>
        )}
      </div>

      {/* Mobile Nav Numbers Modal */}
      <Dialog open={isNavModalOpen} onOpenChange={setIsNavModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md bg-card rounded-2xl p-6 pointer-events-auto">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-bold text-slate-800">Navigasi Soal</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-5 gap-1 overflow-y-auto max-h-60 mt-2">
            {questions.map((q, index) => {
               const isAnswered = answers[q.id] !== undefined;
               const isActive = index === currentQuestionIndex;
               const isFlagged = flaggedQuestions[q.id] === true;

               return (
                 <button
                   key={q.id}
                   onClick={() => {
                     setCurrentQuestionIndex(index);
                     setIsNavModalOpen(false); 
                   }}
                   className={`w-full aspect-square rounded-xl flex items-center justify-center font-bold text-xs border transition-all ${
                     isActive
                       ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/30"
                       : isAnswered
                       ? "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                       : isFlagged
                       ? "bg-amber-100 border-amber-200 text-amber-700 font-bold"
                       : "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-700 dark:border-slate-600"
                   }`}
                 >
                   {index + 1}
                 </button>
               );
             })}
          </div>

          <div className="pt-2 border-t flex flex-col gap-1 mt-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 bg-blue-600 rounded"></div> Posisi Aktif
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 bg-amber-100 border border-amber-200 rounded"></div> Tandai Soal
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div> Terjawab
              </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Sesi Di-Reset */}
      <Dialog open={isResetModalOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md bg-card rounded-2xl p-6 pointer-events-auto">
          <DialogHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-2 animate-bounce">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-800">Sesi Ujian Di-Reset</DialogTitle>
            <DialogDescription className="text-slate-500 text-sm mt-1">
              Sesi pengerjaan Anda telah di-reset oleh Pengawas / Admin. Anda diharuskan login kembali menggunakan NISN.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
             <Button onClick={() => logoutStudent()} className="w-full bg-red-600 hover:bg-red-700 font-bold text-white rounded-xl h-11 flex items-center justify-center gap-2">
                <LogOut className="w-4 h-4" /> Keluar & Login Ulang
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Preview Gambar Zoom */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl bg-transparent border-none p-0 flex items-center justify-center pointer-events-auto">
          {previewImage && (
            <img 
              src={previewImage} 
              alt="Pratinjau Lanjutan" 
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-slate-800/20" 
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Dialog Konfirmasi Kumpul Ujian */}
      <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
        <DialogContent className="max-w-md bg-card rounded-2xl p-6 pointer-events-auto">
          {isAllAnswered ? (
            <>
              <DialogHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <DialogTitle className="text-lg font-bold text-slate-800">Kumpulkan Ujian?</DialogTitle>
                <DialogDescription className="text-slate-500 text-sm mt-1">
                  Apakah Anda yakin ingin mengakhiri sesi ujian dan mengumpulkan jawaban sekarang?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4 flex flex-row gap-2 sm:justify-center">
                 <Button variant="outline" onClick={() => setIsSubmitModalOpen(false)} className="rounded-xl flex-1">
                    Batal
                 </Button>
                 <Button onClick={() => { setIsSubmitModalOpen(false); handleSubmitExam(); }} className="flex-1 bg-green-600 hover:bg-green-700 font-bold text-white rounded-xl">
                    Kumpulkan
                 </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-2">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <DialogTitle className="text-lg font-bold text-slate-800">Belum Selesai</DialogTitle>
                <DialogDescription className="text-slate-500 text-sm mt-1">
                  Anda belum menjawab semua soal. Ada <span className="font-bold text-amber-600">{unansweredCount}</span> soal yang belum dijawab. Semua soal wajib dijawab sebelum mengumpulkan.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4 flex flex-row gap-2 sm:justify-center">
                 <Button onClick={() => setIsSubmitModalOpen(false)} className="flex-1 bg-amber-600 hover:bg-amber-700 font-bold text-white rounded-xl">
                    Kembali Mengerjakan
                 </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Peringatan Anti-Cheat */}
      <Dialog open={isCheatWarningOpen} onOpenChange={setIsCheatWarningOpen}>
        <DialogContent className="max-w-md bg-card rounded-2xl p-6 pointer-events-auto">
          <DialogHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-2 animate-bounce">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-800">Peringatan Anti-Cheat!</DialogTitle>
            <DialogDescription className="text-slate-500 text-sm mt-1">
              Dilarang keras meninggalkan halaman ujian ini. Segala bentuk kecurangan atau aktivitas mencurigakan akan dicatat oleh sistem.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-center justify-between text-amber-800 text-sm font-semibold mt-4">
             <span>Jumlah Pelanggaran Anda:</span>
             <span className="font-bold text-lg">{attempt ? (attempt.cheatCount || 0) : 0}</span>
          </div>
          <DialogFooter className="mt-4">
             <Button onClick={() => setIsCheatWarningOpen(false)} className="w-full bg-amber-600 hover:bg-amber-700 font-bold text-white rounded-xl h-11">
                Saya Mengerti
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Peringatan Skip Soal */}
      <Dialog open={isSkipNoticeOpen} onOpenChange={setIsSkipNoticeOpen}>
        <DialogContent className="max-w-xs bg-white dark:bg-slate-900 rounded-[2rem] p-6 pointer-events-auto border-none shadow-2xl">
          <DialogHeader className="text-center">
            <div className="mx-auto w-14 h-14 bg-amber-50 dark:bg-amber-950/20 rounded-2xl flex items-center justify-center mb-4 border border-amber-100 dark:border-amber-900/30">
              <HelpCircle className="w-7 h-7 text-amber-600 dark:text-amber-500" />
            </div>
            <DialogTitle className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Soal Belum Dijawab</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed font-medium">
              Anda belum memberikan jawaban pada soal ini. Apakah Anda yakin ingin melewati soal ini?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-6">
             <Button variant="outline" onClick={() => setIsSkipNoticeOpen(false)} className="rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-200 h-10">
                Kembali
             </Button>
             <Button 
                onClick={() => {
                   if (targetIndex !== null) goToQuestion(targetIndex);
                   setIsSkipNoticeOpen(false);
                }} 
                className="bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-black text-[10px] rounded-xl uppercase tracking-widest h-10"
             >
                Lompati Saja
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CBTPage;


