import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSiswaAuth } from "../../context/SiswaAuthContext";
import { ref, get, set, update, onValue, onDisconnect } from "firebase/database";
import { database } from "../../lib/firebase";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { AlertCircle, Clock, CheckCircle2, Flag, Bookmark, LogOut } from "lucide-react";

interface Question {
  id: string;
  text: string;
  imageUrl?: string;
  choices: Record<string, { text: string; imageUrl?: string }>;
}

interface ExamAttempt {
  status: "ongoing" | "submitted" | "LOCKED";
  cheatCount: number;
  score?: number;
  correct?: number;
  total?: number;
  extraCheatLimit?: number;
}

const CBTPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { siswa, logoutSiswa } = useSiswaAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // { questionId: choiceId }
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);

  const [roomData, setRoomData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0); // seconds
  const [isExamOver, setIsExamOver] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false); // <--- modal state untuk reset sesi
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false); // <--- modal state kumpul ujian
  const [previewImage, setPreviewImage] = useState<string | null>(null); // <--- Preview gambar siswa zoom clicks
  const [isNavModalOpen, setIsNavModalOpen] = useState(false); // <--- Modal navigasi soal mobile
  const [isCheatWarningOpen, setIsCheatWarningOpen] = useState(false); // <--- Modal peringatan cheat
  // Anti-Cheat State
  const [isLocked, setIsLocked] = useState(false);

  // For debounce saving
  const saveTimeoutRef = useRef<Record<string, any>>({});
  const lastCheatTimeRef = useRef<number>(0); // <--- Jeda deteksi cheat

  // Fix order randomizer on reload
  const [questionOrder, setQuestionOrder] = useState<string[]>([]);
  const [choicesOrder, setChoicesOrder] = useState<Record<string, string[]>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!siswa || !roomId) return;

    const loadExamData = async () => {
      try {
        // 1. Load Room
        const roomRef = ref(database, `exam_rooms/${roomId}`);
        const roomSnap = await get(roomRef);
        if (!roomSnap.exists()) throw new Error("Ruang ujian tidak ditemukan");
        const rData = roomSnap.val();

        let examTitle = "CBT";
        let subject = "Ujian";
        if (rData.examId) {
          const examSnap = await get(ref(database, `exams/${rData.examId}`));
          if (examSnap.exists()) {
            const eData = examSnap.val();
            examTitle = eData.title || "CBT";
            subject = eData.subject || "Ujian";
          }
        }
        setRoomData({ ...rData, examTitle, subject });

        // 2. Load Attempt
        const attemptRef = ref(database, `attempts/${siswa.nisn}_${roomId}`);
        const attemptSnap = await get(attemptRef);
        
        let initialCheatCount = 0;
        let startTime = Date.now();
        let currentStatus = "ongoing";
        let attemptDataToStore: any = { status: "ongoing", cheatCount: 0 };

        if (attemptSnap.exists()) {
          const aData = attemptSnap.val();
          attemptDataToStore = aData; // <--- maintain full state (including extraCheatLimit)
          if (aData.status === "LOCKED") {
            setIsLocked(true);
          }
          if (aData.status === "submitted") {
              navigate(`/cbt/${roomId}/result`);
              return;
          }
          initialCheatCount = aData.cheatCount || 0;
          startTime = aData.startTime || Date.now();
          currentStatus = aData.status;
        } else {
          // Create initial attempt
          const initialData = {
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
        const answersRef = ref(database, `answers/${siswa.nisn}_${roomId}`);
        const answersSnap = await get(answersRef);
        if (answersSnap.exists()) {
          initialAnswers = answersSnap.val();
          setAnswers(initialAnswers);
        }

        const flagKey = `flags_${siswa.nisn}_${roomId}`;
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

          // Handle Shuffling/Saves
          const orderKey = `order_${siswa.nisn}_${roomId}`;
          let savedOrder = sessionStorage.getItem(orderKey);
          let order: string[] = [];

          const currentIds = loadedQuestions.map((q) => q.id);

          if (savedOrder) {
            try {
              order = JSON.parse(savedOrder);
              // 🧹 Bersihkan ID yang sudah dihapus oleh Admin
              order = order.filter((id) => currentIds.includes(id));
              
              // ➕ Tambahkan ID baru (jika Admin baru menambahkan soal) agar tidak hilang
              const newIds = currentIds.filter((id) => !order.includes(id));
              if (newIds.length > 0) {
                // acak soal baru lalu gabung di belakang
                order = [...order, ...newIds.sort(() => Math.random() - 0.5)];
              }

              sessionStorage.setItem(orderKey, JSON.stringify(order));
            } catch (e) {
              order = [];
            }
          } 
          
          if (order.length === 0) {
            // Shuffle
            order = currentIds.sort(() => Math.random() - 0.5);
            sessionStorage.setItem(orderKey, JSON.stringify(order));
          }

          // Handle Choices Randomizing 
          const choiceOrderKey = `choices_${siswa.nisn}_${roomId}`;
          const savedChoices = sessionStorage.getItem(choiceOrderKey);
          let cOrder: Record<string, string[]> = {};
          if (savedChoices) {
             try {
               cOrder = JSON.parse(savedChoices);
             } catch (e) {
               cOrder = {};
             }
          }
          
          loadedQuestions.forEach((q) => {
             const keys = Object.keys(q.choices || {});
             if (!cOrder[q.id] || cOrder[q.id].length !== keys.length) {
                cOrder[q.id] = [...keys].sort(() => Math.random() - 0.5);
             }
          });
          sessionStorage.setItem(choiceOrderKey, JSON.stringify(cOrder));
          setChoicesOrder(cOrder);

          setQuestionOrder(order);
          // Sort loadedQuestions based on order SAFELY
          const sorted = order.map((id) => loadedQuestions.find((q) => q.id === id)).filter((q): q is Question => !!q);
          setQuestions(sorted);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadExamData();

    // Setup realtime unlock/reset listener from Admin
    const attemptRefLocal = ref(database, `attempts/${siswa.nisn}_${roomId}`);
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
  }, [siswa, roomId, isLocked]);

  // Timer Countdown Logic
  useEffect(() => {
    if (loading || isLocked || isExamOver || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, isLocked, isExamOver, timeLeft]);

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

        const attemptRef = ref(database, `attempts/${siswa?.nisn}_${roomId}`);
        
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
    if (!siswa || !roomId || loading) return;

    const attemptId = `${siswa.nisn}_${roomId}`;
    const attemptRefLocal = ref(database, `attempts/${attemptId}`);
    
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
  }, [siswa, roomId, loading]);

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

  const toggleFlag = (qId: string) => {
    const flagKey = `flags_${siswa?.nisn}_${roomId}`;
    setFlaggedQuestions((prev) => {
      const updated = { ...prev, [qId]: !prev[qId] };
      sessionStorage.setItem(flagKey, JSON.stringify(updated));
      return updated;
    });
  };

  const handleAnswerSelect = (questionId: string, choiceId: string) => {
    if (isExamOver || isLocked) return;

    setAnswers((prev) => {
      const updated = { ...prev, [questionId]: choiceId };
      
      // Debounced Save to Firebase Answers List
      if (saveTimeoutRef.current[questionId]) {
        clearTimeout(saveTimeoutRef.current[questionId]);
      }

      saveTimeoutRef.current[questionId] = setTimeout(async () => {
        const answersRef = ref(database, `answers/${siswa?.nisn}_${roomId}`);
        await update(answersRef, { [questionId]: choiceId });
        // Backup to SessionStorage
        sessionStorage.setItem(`ans_${siswa?.nisn}_${roomId}`, JSON.stringify(updated));
      }, 300);

      return updated;
    });
  };

  const handleAutoSubmit = useCallback(async () => {
    setIsExamOver(true);
    await handleSubmitExam();
  }, [questions, answers, roomData]);

  const handleSubmitExam = async () => {
    if (!siswa || !roomId || !roomData) return;

    setLoading(true);
    try {
      let correctCount = 0;
      let totalQuestions = questions.length;

      questions.forEach((q: any) => {
        const studentAnswer = answers[q.id];
        if (studentAnswer && q.choices[studentAnswer]?.isCorrect === true) {
          correctCount++;
        }
      });

      const score = Math.round((correctCount / totalQuestions) * 100) || 0;

      const attemptRef = ref(database, `attempts/${siswa.nisn}_${roomId}`);
      await update(attemptRef, {
        status: "submitted",
        score: score,
        correct: correctCount,
        total: totalQuestions,
        submittedAt: Date.now(),
        isOnline: false,
      });

      // Clear layout triggers
      sessionStorage.removeItem(`order_${siswa.nisn}_${roomId}`);
      sessionStorage.removeItem(`ans_${siswa.nisn}_${roomId}`);

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
        <div className="bg-white p-6 rounded-2xl shadow-md max-w-md text-center">
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

  return (
    <div className="h-screen h-[100dvh] bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden select-none">
      {/* Top Header Panel (Ultra Compact) */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 border-b shadow-sm h-12 px-4 flex items-center justify-between text-xs sm:text-sm">
        {/* Left: Timer */}
        <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          <span className={`font-mono font-bold ${timeLeft < 300 ? "text-red-500 animate-pulse" : "text-amber-800 dark:text-amber-200"}`}>
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Center: Subject & Exam */}
        <div className="flex flex-col items-center text-center">
          <p className="font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{roomData?.subject || "Ujian"}</p>
          <p className="text-[10px] text-slate-500 font-medium">{roomData?.examTitle || "CBT"}</p>
        </div>

        {/* Right: Student Info */}
        <div className="flex flex-col items-end text-right">
          <p className="font-semibold text-slate-700 dark:text-slate-200 line-clamp-1">{siswa?.name}</p>
          <p className="text-[10px] text-slate-400">{siswa?.className || "Siswa"}</p>
        </div>
      </header>

      {/* Main Grid: Question View & Nav Panel */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Questions View */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 space-y-4">
          {currentQuestion && (
            <Card className="rounded-xl border shadow-sm">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-400">Soal No. {currentQuestionIndex + 1} / {questions.length}</span>
                  {currentQuestion && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleFlag(currentQuestion.id)} 
                      className={`flex items-center gap-1.5 h-7 text-xs rounded-lg transition-colors ${flaggedQuestions[currentQuestion.id] ? "bg-amber-100 text-amber-700 border border-amber-200/60 hover:bg-amber-200" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
                    >
                       <Bookmark className={`w-3.5 h-3.5 ${flaggedQuestions[currentQuestion.id] ? "fill-amber-600 text-amber-600" : ""}`} />
                       {flaggedQuestions[currentQuestion.id] ? "Tersimpan" : "Tandai Soal"}
                    </Button>
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
                <div 
                  className="text-base sm:text-lg font-semibold leading-relaxed text-slate-800 dark:text-white mt-2 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:mt-2 [&_img]:border [&_img]:shadow-sm break-words" 
                  dangerouslySetInnerHTML={{ __html: proxifyHtml(currentQuestion.text) }}
                />
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2.5">
                {(() => {
                  const order = choicesOrder[currentQuestion.id] || Object.keys(currentQuestion.choices || {});
                  return order.map((choiceId, idx) => {
                    const choice = currentQuestion.choices[choiceId];
                    const isSelected = answers[currentQuestion.id] === choiceId;

                    return (
                      <button
                        key={choiceId}
                        onClick={() => handleAnswerSelect(currentQuestion.id, choiceId)}
                        className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-all ${
                          isSelected 
                            ? "bg-blue-50 border-blue-500 shadow-sm text-blue-700" 
                            : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-sm ${
                          isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 text-slate-500"
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <div className="flex-1 text-sm font-medium">
                          <div className="break-words [&_img]:max-w-[200px] [&_img]:h-auto [&_img]:rounded-lg [&_img]:mt-1" dangerouslySetInnerHTML={{ __html: proxifyHtml(choice.text) }} />
                          {choice.imageUrl && (
                            <img 
                              src={getProxiedUrl(choice.imageUrl)} 
                              alt={`Pilihan ${String.fromCharCode(65 + idx)}`} 
                              className="max-h-[150px] w-auto rounded-lg mt-1 border cursor-zoom-in hover:opacity-90 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImage(getProxiedUrl(choice.imageUrl));
                              }}
                            />
                          )}
                        </div>
                      </button>
                    );
                  });
                })()}
              </CardContent>
            </Card>
          )}

          {/* Navs buttons moved to sidebar */}
        </div>

        {/* Right: Sidebar Navigation boxes */}
        <div className="hidden md:flex w-full md:w-72 bg-white dark:bg-slate-800 border-l p-4 flex-col space-y-4">
          <h3 className="text-sm font-semibold text-slate-500">Navigasi Soal</h3>
          <div className="grid grid-cols-5 md:flex md:flex-wrap gap-1 overflow-y-auto max-h-72 md:max-h-none flex-1">
            {questions.map((q, index) => {
              const isAnswered = answers[q.id] !== undefined;
              const isActive = index === currentQuestionIndex;
              const isFlagged = flaggedQuestions[q.id] === true;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`w-full aspect-square md:w-9 md:h-9 shrink-0 rounded-xl flex items-center justify-center font-bold text-xs border transition-all ${
                    isActive
                      ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/30"
                      : isFlagged
                      ? "bg-amber-100 border-amber-200 text-amber-700 font-bold"
                      : isAnswered
                      ? "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:text-green-300"
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
                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
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
      <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t p-3 md:hidden flex justify-between items-center z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
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
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
              size="sm"
          > 
              Selanjutnya 
          </Button>
        )}
      </div>

      {/* Mobile Nav Numbers Modal */}
      <Dialog open={isNavModalOpen} onOpenChange={setIsNavModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md bg-white rounded-2xl p-6 pointer-events-auto">
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
                       : isFlagged
                       ? "bg-amber-100 border-amber-200 text-amber-700 font-bold"
                       : isAnswered
                       ? "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:text-green-300"
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
                  <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div> Terjawab
              </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Sesi Di-Reset */}
      <Dialog open={isResetModalOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 pointer-events-auto">
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
             <Button onClick={() => logoutSiswa()} className="w-full bg-red-600 hover:bg-red-700 font-bold text-white rounded-xl h-11 flex items-center justify-center gap-2">
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
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 pointer-events-auto">
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
        </DialogContent>
      </Dialog>

      {/* Dialog Peringatan Anti-Cheat */}
      <Dialog open={isCheatWarningOpen} onOpenChange={setIsCheatWarningOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 pointer-events-auto">
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
    </div>
  );
};

export default CBTPage;
