import React, { useEffect, useState, useCallback, useRef } from "react";
import { registerPlugin } from "@capacitor/core";
import { useParams, useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";

const CheatAlert = registerPlugin<any>("CheatAlert");
import { MathText } from "../../components/MathText";
import { SmartImage } from "../../components/ui/smart-image";
import { useStudentAuth } from "../../context/StudentAuthContext";
import { useTenant } from "../../context/TenantContext";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { ThemeToggle } from "../../components/ui/theme-toggle";
import { useTheme } from "../../context/ThemeContext";
import { Sun, Moon, Monitor } from "lucide-react";
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
  FileText,
  Cloud,
  CloudOff,
  RefreshCcw,
  Wifi,
  WifiOff,
  ZoomIn,
  ZoomOut,
  Check,
  Square,
  Zap,
  Activity,
  Lock
} from "lucide-react";
import { useNetworkStatus } from "../../lib/network";
import { syncPendingData } from "../../lib/syncManager";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "../../components/ui/dropdown-menu";
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

// Image Zoom Overlay with pinch-to-zoom and button controls
const ImageZoomOverlay = ({ src, onClose }: { src: string; onClose: () => void }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPinchDist, setLastPinchDist] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(prev => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  };

  // Mouse drag for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch events for pinch-to-zoom and drag
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastPinchDist(dist);
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDist !== null) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist - lastPinchDist;
      setScale(prev => Math.min(Math.max(prev + delta * 0.01, 1), 5));
      setLastPinchDist(dist);
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) setLastPinchDist(null);
    setIsDragging(false);
    if (scale <= 1) setPosition({ x: 0, y: 0 });
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale(prev => {
      const newScale = Math.min(Math.max(prev + delta, 1), 5);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Zoom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-2">
        <button
          onClick={handleZoomOut}
          disabled={scale <= 1}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="px-2 py-1 text-xs font-bold text-white/80 hover:text-white transition-colors min-w-[3rem] text-center"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={handleZoomIn}
          disabled={scale >= 5}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Hint text */}
      {scale === 1 && (
        <p className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white/50 text-xs font-medium">
          Double-tap atau scroll untuk zoom
        </p>
      )}

      {/* Image */}
      <div
        className="relative flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default', touchAction: 'none', overflow: 'visible' }}
      >
        <img
          src={src}
          className="max-w-[95vw] max-h-[95vh] object-contain rounded-2xl shadow-2xl border border-white/10 select-none"
          alt="Preview"
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            userSelect: 'none',
            WebkitUserDrag: 'none',
          } as React.CSSProperties}
        />
      </div>
    </div>
  );
};

const formatStudentName = (name?: string) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts[0];
};

const CBTPage = () => {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { pb, terminology } = useTenant();
  const { student, logoutStudent } = useStudentAuth();
  const { theme, setTheme } = useTheme();

  const [roomId, setRoomId] = useState<string | null>(null);
  const isOnline = useNetworkStatus();

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
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [canFullscreen] = useState(() => !!document.documentElement.requestFullscreen);
  const [isExamBrowser] = useState(() => /exambrowser|exambro/i.test(navigator.userAgent));

  const [isNavModalOpen, setIsNavModalOpen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isCheatWarningOpen, setIsCheatWarningOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [gimmickTimer, setGimmickTimer] = useState<number>(0);
  const [isSkipNoticeOpen, setIsSkipNoticeOpen] = useState(false);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [isAdminFinishedModalOpen, setIsAdminFinishedModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const saveTimeoutRef = useRef<any>(null);
  const cheatTimerRef = useRef<any>(null);
  const lastLeftTimeRef = useRef<number | null>(null);
  const orientationChangeRef = useRef<boolean>(false);
  const isIndexRestored = useRef(false);
  const isCreatingRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const lastWriteTimeRef = useRef<number>(0);
  const answersRef = useRef<Record<string, any>>({});

  // 🛡️ Enhanced Screen Wake Lock (WakeLock API + Video Hack)
  useEffect(() => {
    let wakeLock: any = null;
    let videoEl: HTMLVideoElement | null = null;
    
    const requestWakeLock = async () => {
      // 1. Try modern WakeLock API
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (err: any) {}
      }

      // 2. Video Hack Fallback (Works on many mobile browsers)
      if (!videoEl) {
        videoEl = document.createElement('video');
        videoEl.setAttribute('playsinline', '');
        videoEl.setAttribute('muted', '');
        videoEl.loop = true;
        videoEl.style.position = 'fixed';
        videoEl.style.top = '0';
        videoEl.style.width = '1px';
        videoEl.style.height = '1px';
        videoEl.style.opacity = '0.01';
        videoEl.style.pointerEvents = 'none';
        videoEl.src = 'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAZptb292AAAAbG12aGQAAAAA36Yl/N+mJf8AAAPoAAAAUAAEAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAABidHJhazAAAAZcdGtoZAAAAAPfpiX836Yl/AAAAAEAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAGBtZGlhAAAAIG1kaGQAAAAA36Yl/N+mJf8AAAPoAAAAUABVWEHAAAAAAAtWhuZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAAVxtaW5mAAAAEHZtbmhkAAAAAQAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAURzdGJsAAAAL3N0c2QAAAAAAAAAAQAAAB9hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAgACAAAAAkAAABidm9jYwAAAABhdmNDAVQAKv/hABhnVEAq/4C0YIu6u6uX9AAAAAMAAQAAAwAeDBlYm6u7u7urq7u7ur6AAAQAIAAAIAAAAEhzdHRzAAAAAAAAAAEAAAABAAAfQAAAADRzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAcc3RzegAAAAAAAAAAAAAAAQAAABAAAAAUc3RjbwAAAAAAAAABAAAAUAAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXIAAAAAAAAAAAAAAAAAAAAAAAAALWlsc3QAAAAjqXRvbwAAABtkYXRhAAAAAQAAAABMYXZmNTkuMjcuMTAw';
        document.body.appendChild(videoEl);
      }
      
      videoEl.play().catch(() => {});
    };

    if (!loading && !isExamOver) {
      requestWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) wakeLock.release().catch(() => {});
      if (videoEl) {
        videoEl.pause();
        videoEl.parentNode?.removeChild(videoEl);
      }
    };
  }, [loading, isExamOver]);

  const [choicesOrder, setChoicesOrder] = useState<Record<string, string[]>>({});
  const [itemsOrder, setItemsOrder] = useState<Record<string, string[]>>({});
  const [matchingOptions, setMatchingOptions] = useState<Record<string, string[]>>({});
  const [draggingOption, setDraggingOption] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('cbt_font_size');
    return saved ? parseFloat(saved) : 1.0;
  });

  // Save fontSize to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cbt_font_size', fontSize.toString());
  }, [fontSize]);

  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 0.1, 1.5)); // Max 1.5x
  };

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 0.1, 0.8)); // Min 0.8x
  };

  const resetFontSize = () => {
    setFontSize(1.0);
  };

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
    setIsSyncing(true);
    setSyncError(false);
    
    // Backup locally
    if (student && roomId) {
      if (data.answers) {
        localStorage.setItem(`offline_answers_${student.id}_${roomId}`, JSON.stringify(data.answers));
      }
      const currentLocal = localStorage.getItem(`local_attempt_${student.id}_${roomId}`);
      let updatedAtt = attempt || (currentLocal ? JSON.parse(currentLocal) : {});
      updatedAtt = { ...updatedAtt, ...data };
      localStorage.setItem(`local_attempt_${student.id}_${roomId}`, JSON.stringify(updatedAtt));
    }

    if (!isOnline) {
      setSyncError(true);
      setIsSyncing(false);
      localStorage.setItem(`pending_sync_${student?.id}_${roomId}`, "true");
      return null;
    }

    const startTime = Date.now();
    if (!pb) return null;
    try {
      const res = await pb.collection("attempts").update(attId, data);
      localStorage.removeItem(`pending_sync_${student?.id}_${roomId}`);
      lastWriteTimeRef.current = Date.now();
      return res;
    } catch (err: any) {
      setSyncError(true);
      localStorage.setItem(`pending_sync_${student?.id}_${roomId}`, "true");
      throw err;
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));
      setIsSyncing(false);
    }
  };

  const syncAllLocalData = useCallback(async () => {
    if (!isOnline || !student?.id) return;
    try {
      await syncPendingData(pb!, student.id);
      setSyncError(false);
    } catch (e) {
      setSyncError(true);
    }
  }, [isOnline, student?.id]);

  useEffect(() => {
    if (isOnline) syncAllLocalData();
  }, [isOnline, syncAllLocalData]);

  const handleAnswerSelect = (questionId: string, value: any) => {
    if (isExamOver || isLocked || !attempt) return;
    setAnswers(p => {
      const u = { ...p, [questionId]: value };
      answersRef.current = u;
      
      // 1. SIMPAN KE HP INSTAN (0 DETIK)
      if (student && roomId) {
        localStorage.setItem(`offline_answers_${student.id}_${roomId}`, JSON.stringify(u));
      }

      // 2. BACKUP KE SERVER (TUNGGU 2 DETIK)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setIsSyncing(true);
        safeUpdateAttempt(attempt.id, {
          answers: u,
          isOnline: true,
          lastHeartbeat: new Date().toISOString()
        }).catch((err: any) => {
          // Jika attempt sudah dihapus/reset oleh admin
          if (err?.status === 404 || err?.status === 403) {
            sessionStorage.removeItem("activeCBTRoomId");
            setIsSubmitModalOpen(false);
            setIsResetModalOpen(true);
          }
        });
      }, 2000);
      return u;
    });
  };

  const isEssayQuestion = (q: Question | undefined) => {
    const t = q?.type || "pilihan_ganda";
    return t === "isian_singkat" || t === "uraian";
  };

  const goToQuestion = (index: number) => {
    if (index === currentQuestionIndex) return;
    // Blokir navigasi ke soal essay jika objektif belum semua dijawab
    const targetQ = questions[index];
    if (isEssayQuestion(targetQ)) {
      const objQs = questions.filter(q => !isEssayQuestion(q));
      const allObjDone = objQs.every(q => answers[q.id] !== undefined);
      if (!allObjDone) return; // diam saja — tombol essay sudah disembunyikan di UI
    }
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
    if (currentQuestionIndex < questions.length - 1) {
      const nextQ = questions[currentQuestionIndex + 1];
      // Jika soal berikutnya essay tapi objektif belum selesai, skip diam
      if (isEssayQuestion(nextQ)) {
        const objQs = questions.filter(q2 => !isEssayQuestion(q2));
        const allObjDone = objQs.every(q2 => answers[q2.id] !== undefined);
        if (!allObjDone) return;
      }
      goToQuestion(currentQuestionIndex + 1);
    }
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

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const goFullscreen = () => {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => { });
      }
    } catch (e) { }
  };

  const loadExamData = useCallback(async () => {
    if (!student || !roomId || !pb) return;
    try {
      setLoading(true);
      const rData = await pb.collection("exam_rooms").getOne(roomId, { expand: "examId,examId.subjectId,examId.teacherId" });
      if (rData.status === "archive" || rData.isActive === false) throw new Error("Nonaktif/Arsip");

      const ex = rData.expand?.examId;
      setRoomData({ ...rData, examTitle: rData.room_name || ex?.title || "CBT", subject: ex?.expand?.subjectId?.name || "Ujian", teacherName: ex?.expand?.teacherId?.name || "-" });

      const qRecord = await pb.collection("questions").getFullList({ filter: `examId = "${rData.examId}"`, sort: "order,created" });
      const loaded: Question[] = qRecord.map(q => {
        const tM: any = { "multiple_choice": "pilihan_ganda", "complex_multiple_choice": "pilihan_ganda_kompleks", "complex_choice": "pilihan_ganda_kompleks", "short_answer": "isian_singkat", "essay": "uraian", "matching": "menjodohkan", "ordering": "urutkan", "sequence": "urutkan", "true_false": "benar_salah", "drag_drop": "drag_drop", "pilihan_ganda": "pilihan_ganda", "pilihan_ganda_kompleks": "pilihan_ganda_kompleks", "isian_singkat": "isian_singkat", "uraian": "uraian", "menjodohkan": "menjodohkan", "urutkan": "urutkan", "benar_salah": "benar_salah" };

        let qImg = q.imageUrl || "";
        if (qImg && !qImg.startsWith('http') && !qImg.startsWith('data:')) {
          qImg = pb.files.getUrl(q, qImg);
        }

        // Parse options (might be string from PocketBase)
        let rawOptions = q.options || {};
        if (typeof rawOptions === 'string') {
          try { rawOptions = JSON.parse(rawOptions); } catch (e) { rawOptions = {}; }
        }

        const mappedType = tM[q.field || q.type] || "pilihan_ganda";
        
        // For choice-based types, options IS the choices object {a:{...}, b:{...}}
        // For menjodohkan, options = {pairs: [...]}
        // For urutkan/drag_drop, options = {items: [...]}
        let choices: any = {};
        let pairs: any = undefined;
        let items: any = undefined;

        if (mappedType === "menjodohkan") {
          pairs = rawOptions.pairs || [];
        } else if (mappedType === "urutkan" || mappedType === "drag_drop") {
          items = rawOptions.items || [];
        } else {
          // Choice-based types: options = {a: {text, isCorrect, imageUrl}, b: {...}, ...}
          choices = { ...rawOptions };
          Object.keys(choices).forEach(id => {
            if (choices[id] && typeof choices[id] === 'object' && choices[id].imageUrl && !choices[id].imageUrl.startsWith('http') && !choices[id].imageUrl.startsWith('data:')) {
              choices[id].imageUrl = pb.files.getUrl(q, choices[id].imageUrl);
            }
          });
        }

        return { id: q.id, type: mappedType, text: q.text, imageUrl: qImg, groupId: q.groupId, groupText: q.groupText, choices, pairs, items, answerKey: q.answerKey || q.correctAnswer };
      });

      const localAnswers = localStorage.getItem(`offline_answers_${student.id}_${roomId}`);
      const localAttData = localStorage.getItem(`local_attempt_${student.id}_${roomId}`);

      let att: any = null;
      try {
        const existingAttempts = await pb.collection("attempts").getFullList({ filter: `studentId = "${student.id}" && examRoomId = "${roomId}"`, sort: "-created" });
        if (existingAttempts.length > 0) {
          att = existingAttempts[0];
          const status = att.status || (att as any).status;
          if (status === "finished") { navigate("/cbt/" + roomId + "/result"); return; }
          if (status === "LOCKED") {
            setIsLocked(true);
            sessionStorage.removeItem("activeCBTRoomId");
          }
          
          let mergedAnswers = att.answers || {};
          if (localAnswers) {
            try {
              const parsedLocal = JSON.parse(localAnswers);
              mergedAnswers = { ...mergedAnswers, ...parsedLocal };
            } catch (e) {}
          }
          setAnswers(mergedAnswers);
          answersRef.current = mergedAnswers;
          safeUpdateAttempt(att.id, { answers: mergedAnswers, isOnline: true, lastHeartbeat: new Date().toISOString() });
        } else {
          if (isCreatingRef.current) return;
          isCreatingRef.current = true;
          try {
            const secondCheck = await pb.collection("attempts").getFullList({ filter: `studentId = "${student.id}" && examRoomId = "${roomId}"` });
            if (secondCheck.length > 0) { att = secondCheck[0]; }
            else {
              // Clear old session data for fresh start
              const pr = `${student.nisn}_${roomId}`;
              sessionStorage.removeItem(`flags_${pr}`);
              sessionStorage.removeItem(`order_${pr}`);
              sessionStorage.removeItem(`choices_${pr}`);
              sessionStorage.removeItem(`items_${pr}`);
              sessionStorage.removeItem(`match_${pr}`);
              sessionStorage.removeItem(`currentIndex_${pr}`);
              sessionStorage.removeItem(`confirmed_${pr}`);
              localStorage.removeItem(`offline_answers_${student.id}_${roomId}`);
              
              att = await pb.collection("attempts").create({
                examRoomId: roomId,
                studentId: student.id,
                status: "ongoing",
                cheatCount: 0,
                answers: {},
                startedAt: new Date().toISOString(),
                isOnline: true,
                lastHeartbeat: new Date().toISOString()
              });
            }
          } finally { isCreatingRef.current = false; }
        }
      } catch (err) {
        if (!isOnline && localAttData) {
          try {
            att = JSON.parse(localAttData);
            setAnswers(att.answers || {});
            answersRef.current = att.answers || {};
          } catch (e) { throw err; }
        } else {
          throw err;
        }
      }
      
      if (att) {
        localStorage.setItem(`local_attempt_${student.id}_${roomId}`, JSON.stringify(att));
      }
      setAttempt(att);

      const clusterShuffle = (list: string[]): string[] => {
        const g: Record<string, string[]> = {}; const s: string[] = [];
        list.forEach(id => { const q = loaded.find(x => x.id === id); if (q?.groupId) { if (!g[q.groupId]) g[q.groupId] = []; g[q.groupId].push(id); } else s.push(id); });
        const nC: Record<string, string[]> = {}; const nI: Record<string, string[]> = {}; const nM: Record<string, string[]> = {};
        loaded.forEach((q: any) => {
          if (q.choices) { const k = Object.keys(q.choices); for (let i = k.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[k[i], k[j]] = [k[j], k[i]]; } nC[q.id] = k; }
          if (q.items && (q.type === "urutkan" || q.type === "drag_drop")) { const ids = q.items.map((it: any) => it.id); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[ids[i], ids[j]] = [ids[j], ids[i]]; } nI[q.id] = ids; }
          if (q.pairs && q.type === "menjodohkan") { const rO = Array.from(new Set((q.pairs as any[]).map(p => p.right))); for (let i = rO.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[rO[i], rO[j]] = [rO[j], rO[i]]; } nM[q.id] = rO as string[]; }
        });
        const pr = `${student.nisn}_${roomId}`;
        const sC = sessionStorage.getItem(`choices_${pr}`); if (sC) try { Object.assign(nC, JSON.parse(sC)); } catch (e) { }
        const sI = sessionStorage.getItem(`items_${pr}`); if (sI) try { Object.assign(nI, JSON.parse(sI)); } catch (e) { }
        const sM = sessionStorage.getItem(`match_${pr}`); if (sM) try { Object.assign(nM, JSON.parse(sM)); } catch (e) { }
        sessionStorage.setItem(`choices_${pr}`, JSON.stringify(nC));
        sessionStorage.setItem(`items_${pr}`, JSON.stringify(nI));
        sessionStorage.setItem(`match_${pr}`, JSON.stringify(nM));
        setChoicesOrder(nC); setItemsOrder(nI); setMatchingOptions(nM);
        const col: (string | string[])[] = [...s, ...Object.values(g)];
        for (let i = col.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[col[i], col[j]] = [col[j], col[i]]; }
        return col.flat();
      };

      const pr = `${student.nisn}_${roomId}`;
      let sO = sessionStorage.getItem(`order_${pr}`);
      let order: string[] = [];
      const curIds = loaded.map(q => q.id);
      if (sO) { 
        try { 
          order = JSON.parse(sO).filter((id: string) => curIds.includes(id)); 
          // Deduplicate dari sessionStorage yang mungkin korup
          order = Array.from(new Set(order));
          const n = curIds.filter(id => !order.includes(id)); 
          if (n.length > 0) order = [...order, ...clusterShuffle(n)]; 
          
          // Always ensure essay questions are at the end (fix old orders)
          const objOrder = order.filter(id => { const q = loaded.find(x => x.id === id); const t = q?.type || "pilihan_ganda"; return t !== "isian_singkat" && t !== "uraian"; });
          const essOrder = order.filter(id => { const q = loaded.find(x => x.id === id); const t = q?.type || "pilihan_ganda"; return t === "isian_singkat" || t === "uraian"; });
          order = [...objOrder, ...essOrder];
          // Final dedup
          order = Array.from(new Set(order));
          
          sessionStorage.setItem(`order_${pr}`, JSON.stringify(order)); 
        } catch (e) { } 
      }
      if (order.length === 0) {
        const pg = curIds.filter(id => { const q = loaded.find(x => x.id === id); return !q?.type || q.type.startsWith("pilihan_ganda"); });
        const es = curIds.filter(id => { const q = loaded.find(x => x.id === id); return q?.type === "isian_singkat" || q?.type === "uraian"; });
        const it = curIds.filter(id => !pg.includes(id) && !es.includes(id));
        // Essay/isian singkat TIDAK diacak — tetap urutan original (sesuai nomor soal di kertas)
        order = [...clusterShuffle(pg), ...clusterShuffle(it), ...es];
        // Deduplicate — cegah soal muncul 2x
        order = Array.from(new Set(order));
        sessionStorage.setItem(`order_${pr}`, JSON.stringify(order));
      } else {
        // Restore choices/items/matching orders from sessionStorage even when question order already exists
        const sC = sessionStorage.getItem(`choices_${pr}`); if (sC) try { setChoicesOrder(JSON.parse(sC)); } catch (e) { }
        const sI = sessionStorage.getItem(`items_${pr}`); if (sI) try { setItemsOrder(JSON.parse(sI)); } catch (e) { }
        const sM = sessionStorage.getItem(`match_${pr}`); if (sM) try { setMatchingOptions(JSON.parse(sM)); } catch (e) { }
      }

      // Deduplicate order sebelum set state — cegah soal muncul 2x di questions
      const uniqueOrder = Array.from(new Set(order));
      setQuestions(uniqueOrder.map(id => loaded.find(x => x.id === id)).filter(x => !!x) as Question[]);
      const sIndexStored = sessionStorage.getItem(`currentIndex_${pr}`);
      if (sIndexStored && !isIndexRestored.current) { const idx = parseInt(sIndexStored, 10); if (idx >= 0 && idx < order.length) setCurrentQuestionIndex(idx); }
      isIndexRestored.current = true;

      const stD = parseSafeDate(att.startTime || att.startedAt) || new Date();
      const dur = (rData.duration || 60) * 60000;
      const targetEnd = new Date(stD.getTime() + dur);
      const roomEnd = parseSafeDate(rData.end_time);
      const actualEnd = roomEnd && roomEnd.getTime() < targetEnd.getTime() ? roomEnd : targetEnd;
      const diff = Math.floor((actualEnd.getTime() - Date.now()) / 1000);
      if (diff <= 0) setIsExamOver(true); setTimeLeft(Math.max(0, diff));
      const sFlagStored = sessionStorage.getItem(`flags_${pr}`); if (sFlagStored) try { setFlaggedQuestions(JSON.parse(sFlagStored)); } catch (e) { }
      const sConfirmed = sessionStorage.getItem(`confirmed_${pr}`); if (sConfirmed === "true") setIsConfirmed(true);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [student, roomId, navigate, refreshTrigger]);

  useEffect(() => { loadExamData(); }, [loadExamData]);

  useEffect(() => {
    if (!roomData?.examId || !roomId || !attempt?.id || !pb) return;
    const rId = roomId;
    const sId = student?.id || "";

    // 1. Subscribe ke Room saja (Questions tidak perlu disubscribe during exam)
    const unsubRoom = pb!.collection("exam_rooms").subscribe(rId, (e) => {
      if (e.action === "update") {
        setRoomData((prev: any) => ({ ...prev, ...e.record }));
        const isOff = e.record.isDisabled === true || e.record.status === "archive";
        if (isOff) navigate("/dashboard");
      }
    });

    // 2. Subscribe ke Attempt
    const unsubAttempt = pb!.collection("attempts").subscribe(attempt.id, (e) => {
      if (e.action === "delete") {
        sessionStorage.removeItem("activeCBTRoomId");
        setIsSubmitModalOpen(false);
        setIsResetModalOpen(true);
        setTimeout(() => { window.location.href = "/"; }, 2500);
      }
      else if (e.action === "update") {
        const oldS = attempt.status;
        const newS = (e.record as any).status;
        setAttempt(e.record as any);

        if (newS === "LOCKED") {
          setIsLocked(true);
          sessionStorage.removeItem("activeCBTRoomId");
        } else if (newS === "ongoing") {
          setIsLocked(false);
          localStorage.removeItem(`lock_time_${attempt?.id}`);
          if (oldS === "LOCKED") {
            sessionStorage.removeItem("activeCBTRoomId");
            window.location.href = "/";
          }
        } else if ((newS === "finished" || newS === "submitted") && !isSubmittingRef.current) {
          setIsAdminFinishedModalOpen(true);
        }
      }
    });

    return () => {
      unsubRoom.then(u => u());
      unsubAttempt.then(u => u());
    };
  }, [roomData, roomId, attempt, navigate, loadExamData]);

  useEffect(() => {
    if (loading || isExamOver || !roomData || !attempt) return;
    const timer = setInterval(() => {
      const st = parseSafeDate(attempt.startTime || attempt.startedAt || attempt.created) || new Date();
      const dur = (roomData.duration || 60) * 60000;
      const targetEnd = new Date(st.getTime() + dur);
      const roomEnd = parseSafeDate(roomData.end_time);
      const actualEnd = roomEnd && roomEnd.getTime() < targetEnd.getTime() ? roomEnd : targetEnd;
      const d = Math.floor((actualEnd.getTime() - Date.now()) / 1000);
      if (d <= 0) { clearInterval(timer); setTimeLeft(0); setIsExamOver(true); }
      else setTimeLeft(d);
    }, 1000);
    const heartbeat = setInterval(async () => { 
      if (attempt?.id && pb) {
        // Skip jika ada write sukses (seperti simpan jawaban) dalam 60 detik terakhir
        if (Date.now() - lastWriteTimeRef.current < 60000) {
          return;
        }
        try {
          await safeUpdateAttempt(attempt.id, { isOnline: true, lastHeartbeat: new Date().toISOString() });
        } catch (err: any) {
          // Jika 404/403 berarti sesi sudah dihapus/reset oleh admin
          if (err?.status === 404 || err?.status === 403) {
            clearInterval(heartbeat);
            clearInterval(timer);
            sessionStorage.removeItem("activeCBTRoomId");
            if (student && roomId) {
              localStorage.removeItem(`offline_answers_${student.id}_${roomId}`);
              localStorage.removeItem(`local_attempt_${student.id}_${roomId}`);
              localStorage.removeItem(`pending_sync_${student.id}_${roomId}`);
            }
            setIsSubmitModalOpen(false);
            setIsResetModalOpen(true);
          }
        }
      } 
    }, 30000); // Heartbeat setiap 30 detik
    return () => { clearInterval(timer); clearInterval(heartbeat); };
  }, [loading, isExamOver, roomData, attempt]);

  useEffect(() => {
    if (!attempt?.id || isLocked || isExamOver) return;
    const triggerPenalty = async () => {
      if (isCheatWarningOpen || isLocked || isExamOver) return;
      
      // Clear timers and state immediately to prevent race conditions
      if (cheatTimerRef.current) clearTimeout(cheatTimerRef.current);
      cheatTimerRef.current = null;
      lastLeftTimeRef.current = null;

      const currentCheat = attempt?.cheatCount || 0;
      const newCount = currentCheat + 1;
      const limit = roomData?.cheat_limit || 3;

      try {
        const res = await safeUpdateAttempt(attempt!.id, {
          cheatCount: newCount,
          status: newCount > limit ? "LOCKED" : "ongoing"
        });
        if (res) setAttempt(res as any);
        if (newCount > limit) setIsLocked(true); else setIsCheatWarningOpen(true);
      } catch (e) { }
    };


    const handleCheatDetection = (e: Event) => {
      if (document.visibilityState === "hidden" || e.type === "blur") {
        if (isCheatWarningOpen || isLocked) return;

        // Ignore blur caused by screen rotation on mobile/tablet
        if (e.type === "blur" && window.screen?.orientation) {
          orientationChangeRef.current = true;
          setTimeout(() => { orientationChangeRef.current = false; }, 1500);
        }
        if (orientationChangeRef.current) return;

        // Record departure time for mobile (where JS might pause)
        if (!lastLeftTimeRef.current) {
          lastLeftTimeRef.current = Date.now();
        }

        if (!cheatTimerRef.current) {
          cheatTimerRef.current = setTimeout(triggerPenalty, 5000);
          try { CheatAlert.startAlarm(); } catch (err) { }
        }
      } else {
        // Returned to app
        if (lastLeftTimeRef.current) {
          const elapsed = Date.now() - lastLeftTimeRef.current;
          // If they were gone for more than 5 seconds while JS was paused
          if (elapsed >= 5000) {
            triggerPenalty();
          }
          lastLeftTimeRef.current = null;
        }

        if (cheatTimerRef.current) {
          clearTimeout(cheatTimerRef.current);
          cheatTimerRef.current = null;
        }

        try { CheatAlert.stopAlarm(); } catch (err) { }
      }
    };

    const handleOrientationChange = () => {
      // Mark orientation is changing so blur events are ignored
      orientationChangeRef.current = true;
      // Cancel any pending cheat timer triggered by orientation blur
      if (cheatTimerRef.current) {
        clearTimeout(cheatTimerRef.current);
        cheatTimerRef.current = null;
        try { CheatAlert.stopAlarm(); } catch (err) { }
      }
      lastLeftTimeRef.current = null;
      setTimeout(() => { orientationChangeRef.current = false; }, 1500);
    };

    // 3. Native Capacitor App State Listener (More reliable for Android/iOS)
    const unsubApp = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        if (isCheatWarningOpen || isLocked) return;

        // App went to background
        if (!lastLeftTimeRef.current) {
          lastLeftTimeRef.current = Date.now();
        }
        if (!cheatTimerRef.current) {
          cheatTimerRef.current = setTimeout(triggerPenalty, 5000);
          try { CheatAlert.startAlarm(); } catch (err) { }
        }
      } else {
        // App returned to foreground
        if (lastLeftTimeRef.current) {
          const elapsed = Date.now() - lastLeftTimeRef.current;
          if (elapsed >= 5000) {
            triggerPenalty();
          }
          lastLeftTimeRef.current = null;
        }
        if (cheatTimerRef.current) {
          clearTimeout(cheatTimerRef.current);
          cheatTimerRef.current = null;
        }
        try { CheatAlert.stopAlarm(); } catch (err) { }
      }
    });

    const graceTimer = setTimeout(() => {
      document.addEventListener("visibilitychange", handleCheatDetection);
      window.addEventListener("blur", handleCheatDetection);
      window.addEventListener("focus", handleCheatDetection);
      window.addEventListener("orientationchange", handleOrientationChange);
      if (window.screen?.orientation) {
        window.screen.orientation.addEventListener("change", handleOrientationChange);
      }
    }, 2000);

    return () => {
      clearTimeout(graceTimer);
      unsubApp.then(h => h.remove());
      document.removeEventListener("visibilitychange", handleCheatDetection);
      window.removeEventListener("blur", handleCheatDetection);
      window.removeEventListener("focus", handleCheatDetection);
      window.removeEventListener("orientationchange", handleOrientationChange);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener("change", handleOrientationChange);
      }
      if (cheatTimerRef.current) {
        clearTimeout(cheatTimerRef.current);
        cheatTimerRef.current = null;
      }
    };
  }, [attempt, roomData, isLocked, isExamOver, isCheatWarningOpen]);

  useEffect(() => {
    const p = (e: Event) => { e.preventDefault(); return false; };
    const k = (e: KeyboardEvent) => { if (e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key === "I") || (e.ctrlKey && e.key === "u") || (e.ctrlKey && e.key === "s") || (e.ctrlKey && e.key === "p")) { e.preventDefault(); return false; } };
    window.addEventListener("contextmenu", p); window.addEventListener("copy", p); window.addEventListener("cut", p); window.addEventListener("paste", p); window.addEventListener("keydown", k);
    return () => { window.removeEventListener("contextmenu", p); window.removeEventListener("copy", p); window.removeEventListener("cut", p); window.removeEventListener("paste", p); window.removeEventListener("keydown", k); };
  }, []);

  const handleSubmitExam = useCallback(async (isAuto = false) => {
    if (!student || !roomId || !attempt || (attempt.status !== "ongoing" && attempt.status !== "LOCKED") || isSubmitting) return;

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      // Flush pending debounced save ke server secara instan
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        try {
          await safeUpdateAttempt(attempt.id, {
            answers: answersRef.current,
            isOnline: true,
            lastHeartbeat: new Date().toISOString()
          });
        } catch (flushErr) {
          console.warn("Gagal flush jawaban terakhir ke server, tetap melanjutkan submit:", flushErr);
        }
      }

      let objectiveCorrect = 0;
      let objectiveTotal = 0;
      let essayTotal = 0;
      const ovr = attempt.overrides || {};
      
      questions.forEach((q: any) => {
        const t = q.type || "pilihan_ganda";
        if (t === "isian_singkat" || t === "uraian") { essayTotal++; return; }
        objectiveTotal++;
        if (ovr[q.id] !== undefined) { if (ovr[q.id] === true) objectiveCorrect++; return; }
        const sa = answersRef.current[q.id]; if (!sa) return;
        if (t === "pilihan_ganda" || t === "benar_salah") { if (q.choices?.[sa]?.isCorrect === true) objectiveCorrect++; }
        else if (t === "pilihan_ganda_kompleks") { const ck = Object.keys(q.choices).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase()); const sk = Array.isArray(sa) ? sa.map(k => String(k).toLowerCase()) : []; if (sk.length === ck.length && sk.every(k => ck.includes(k))) objectiveCorrect++; }
        else if (t === "menjodohkan") { const pairs = q.pairs || []; if (pairs.length > 0 && pairs.every((p: any) => sa[p.id] === p.right)) objectiveCorrect++; }
        else if (t === "urutkan" || t === "drag_drop") { const co = (q.items || []).map((it: any) => it.id); if (Array.isArray(sa) && sa.length === co.length && sa.every((v, index) => v === co[index])) objectiveCorrect++; }
      });

      const totalQuestions = objectiveTotal + essayTotal;
      // score yang disimpan = murni nilai objektif (100%), essay dinilai terpisah oleh guru
      const objectiveScore = objectiveTotal > 0 ? Math.round((objectiveCorrect / objectiveTotal) * 100) : 0;
      const score = objectiveScore;
      const st = attempt.startedAt || attempt.startTime || attempt.start_time || attempt.created;
      const startDate = parseSafeDate(st);
      const usedTime = startDate ? Math.max(0, Math.floor((Date.now() - startDate.getTime()) / 1000)) : 0;
      const submittedAt = new Date().toISOString();

      // Gabungkan answers + status finished dalam SATU request — atomic, tidak bisa setengah-setengah
      // Simpan objectiveScore & essayTotal sebagai metadata di dalam answers (tidak perlu field baru)
      const answersWithMeta = {
        ...answersRef.current,
        __meta: {
          objectiveScore,
          objectiveCorrect: Math.floor(objectiveCorrect),
          objectiveTotal,
          essayTotal,
        }
      };

      const finalPayload = {
        answers: answersWithMeta,
        isOnline: true,
        lastHeartbeat: submittedAt,
        score,
        totalQuestions,
        correct: Math.floor(objectiveCorrect),
        total: totalQuestions,
        usedTime: usedTime > 0 ? usedTime : undefined,
        status: "finished",
        submittedAt,
        objectiveScore,
        objectiveCorrect: Math.floor(objectiveCorrect),
        objectiveTotal,
        essayTotal,
      };

      // Simpan ke localStorage sebagai fallback SEBELUM kirim ke server
      if (student && roomId) {
        localStorage.setItem(`offline_answers_${student.id}_${roomId}`, JSON.stringify(answersRef.current));
        const localAtt = { ...(attempt || {}), ...finalPayload, id: attempt.id };
        localStorage.setItem(`local_attempt_${student.id}_${roomId}`, JSON.stringify(localAtt));
      }
      // Thundering Herd mitigation
      if (isAuto) {
        // Delay random antara 100ms s.d 8000ms (1 - 8 detik) untuk auto-submit
        const jitter = Math.floor(Math.random() * 8000) + 100;
        await new Promise(resolve => setTimeout(resolve, jitter));
      } else {
        // Delay acak kecil antara 100ms s.d 2000ms (0.1 - 2 detik) untuk manual submit
        // guna mencegah penulisan database bersamaan jika diinstruksikan oleh guru
        const jitter = Math.floor(Math.random() * 1900) + 100;
        await new Promise(resolve => setTimeout(resolve, jitter));
      }

      try {
        await pb!.collection("attempts").update(attempt.id, finalPayload);
        // Berhasil — hapus pending sync flag
        if (student && roomId) {
          localStorage.removeItem(`pending_sync_${student.id}_${roomId}`);
        }
      } catch (serverErr: any) {
        // Gagal kirim ke server — tandai pending sync agar di-retry saat online
        if (student && roomId) {
          localStorage.setItem(`pending_sync_${student.id}_${roomId}`, "true");
        }
        // Jika 404 (attempt dihapus admin), jangan tampilkan error submit biasa
        if (serverErr?.status === 404 || serverErr?.status === 403) {
          setIsSubmitModalOpen(false);
          setIsResetModalOpen(true);
          return;
        }
        
        // Gagal karena jaringan/koneksi lambat -> tampilkan info error, jangan navigate agar bisa kumpulkan kembali
        setIsSubmitting(false);
        isSubmittingRef.current = false;
        setLoading(false);
        setErrorMessage("Koneksi internet lambat atau terputus. Ujian gagal dikirim ke server. Silakan periksa jaringan Anda dan kumpulkan kembali.");
        setIsErrorModalOpen(true);
        return;
      }

      const pr = `${student.nisn}_${roomId}`;
      sessionStorage.removeItem(`order_${pr}`);
      sessionStorage.removeItem(`currentIndex_${pr}`);
      navigate(`/`);
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setLoading(false);
    }
  }, [student, roomId, attempt, questions, answers, navigate, isSubmitting]);

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

  useEffect(() => { if (isExamOver && !loading && (attempt?.status === "ongoing" || attempt?.status === "LOCKED")) handleSubmitExam(true); }, [isExamOver, loading, attempt?.status, handleSubmitExam]);

  if (loading) {
    return (
      <div className="h-screen h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl border-b border-slate-100 dark:border-slate-800 h-16 sm:h-20 px-4 sm:px-8 flex items-center justify-between shadow-sm">
          <Skeleton className="h-10 w-24 sm:w-32 rounded-2xl" />
          <Skeleton className="hidden sm:block h-10 w-40 rounded-2xl" />
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2 w-12" />
            </div>
            <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl" />
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-[25px] sm:rounded-[40px] border border-slate-100 dark:border-slate-800 p-6 sm:p-10 space-y-8 shadow-sm">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 sm:h-16 sm:w-16 rounded-[1.5rem] sm:rounded-[2rem]" />
                <Skeleton className="h-5 w-32 sm:w-48" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-[90%]" />
                <Skeleton className="h-5 w-[40%]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 sm:pt-8 border-t border-slate-50 dark:border-slate-800">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 sm:h-20 rounded-2xl" />
                ))}
              </div>
            </div>
          </div>

          <div className="lg:w-[320px] xl:w-[380px] bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 flex flex-col p-6 gap-6 shadow-2xl relative z-20">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {Array.from({ length: 40 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg sm:rounded-xl" />
              ))}
            </div>
            <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
              <Skeleton className="h-12 sm:h-14 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (isLocked) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-center max-w-sm border border-red-100 dark:border-red-900/30 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-2 bg-red-600"></div>
        <div className="relative z-10">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-950/30 rounded-3xl flex items-center justify-center mx-auto mb-6"><ShieldAlert className="w-10 h-10 text-red-600 animate-pulse" /></div>
          <h2 className="text-2xl font-black text-red-600 mb-3 uppercase tracking-tighter">Ujian Terkunci!</h2>
          <p className="text-slate-600 dark:text-slate-400 text-[13px] font-bold leading-relaxed mb-6">
            Anda sudah melewati batas yang diizinkan. Mohon jangan curang ya! <br />
            <span className="text-red-600 dark:text-red-400">Jika alasan tidak terbukti / tidak jelas / berbohong, maka tidak ada akses untuk melanjutkan ujian ini.</span>
          </p>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 mb-8">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Penalti Waktu Keamanan</p>
            <div className="font-extrabold text-[#f33a3a] text-6xl sm:text-7xl mb-2 sm:mb-4 animate-pulse tabular-nums -tracking-widest">
              {(() => {
                const currentCheat = attempt?.cheatCount || 0;
                const baseLimit = roomData?.cheat_limit || 3;
                return `${currentCheat} / ${baseLimit}`;
              })()}
            </div>
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
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Penalti Waktu Selesai</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Silakan Melapor ke Pengawas</p>
              </div>
            )}
          </div>


        </div>
      </div>
    </div>
  );

  const currentQuestion = questions[currentQuestionIndex];
  
  const isQuestionAnswered = (qId: string) => {
    const ans = answers[qId];
    if (ans === undefined || ans === null) return false;
    if (typeof ans === "string") return ans.trim().length > 0;
    if (Array.isArray(ans)) return ans.length > 0;
    if (typeof ans === "object") return Object.keys(ans).length > 0;
    return true;
  };

  // Check if all objective questions are answered (gate for essay)
  const objectiveQuestions = questions.filter(q => { const t = q.type || "pilihan_ganda"; return t !== "isian_singkat" && t !== "uraian"; });
  const allObjectiveAnswered = objectiveQuestions.every(q => isQuestionAnswered(q.id));
  const isCurrentEssay = currentQuestion && (currentQuestion.type === "isian_singkat" || currentQuestion.type === "uraian");
  const isEssayLocked = isCurrentEssay && !allObjectiveAnswered;

  const unansweredCount = questions.filter((q) => !isQuestionAnswered(q.id)).length;
  const isAllAnswered = unansweredCount === 0;

  // ═══ Halaman Konfirmasi Sebelum Mulai ═══
  if (!isConfirmed) {
    const choiceCount = questions.filter(q => {
      const t = q.type || "pilihan_ganda";
      return t !== "isian_singkat" && t !== "uraian";
    }).length;
    const essayCount = questions.length - choiceCount;
    const duration = roomData?.duration || 60;
    const cheatLimit = roomData?.cheat_limit || 3;

    return (
      <div className="h-screen h-[100dvh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full max-w-lg max-h-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-y-auto">
          {/* Header */}
          <div className="bg-emerald-600 p-6 sm:p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)]"></div>
            <div className="relative z-10">
              <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">{roomData?.examTitle || "Ujian"}</h1>
              <p className="text-emerald-100 text-xs font-bold mt-1">{roomData?.subject || ""} {roomData?.teacherName ? `• ${roomData.teacherName}` : ""}</p>
            </div>
          </div>

          {/* Info Ujian */}
          <div className="p-6 sm:p-8 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-100 dark:border-slate-800">
                <Clock className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
                <p className="text-lg font-black text-slate-800 dark:text-white">{duration} menit</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Durasi</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-100 dark:border-slate-800">
                <HelpCircle className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
                <p className="text-lg font-black text-slate-800 dark:text-white">{questions.length} soal</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
              </div>
              {essayCount > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-4 text-center border border-amber-100 dark:border-amber-800/40">
                  <FileText className="w-5 h-5 text-amber-600 mx-auto mb-1.5" />
                  <p className="text-lg font-black text-amber-700 dark:text-amber-400">{essayCount}</p>
                  <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Uraian/Isian</p>
                </div>
              )}
              <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-4 text-center border border-red-100 dark:border-red-800/40">
                <ShieldAlert className="w-5 h-5 text-red-500 mx-auto mb-1.5" />
                <p className="text-lg font-black text-red-600 dark:text-red-400">{cheatLimit}x</p>
                <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest">Batas Pelanggaran</p>
              </div>
            </div>

            {/* Syarat & Ketentuan */}
            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Syarat & Ketentuan</h3>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>Ujian harus dikerjakan dalam <strong>mode layar penuh</strong> (fullscreen).</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>Dilarang berpindah aplikasi/tab. Pelanggaran akan tercatat otomatis.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>Jawaban tersimpan otomatis. Jika koneksi terputus, jawaban tetap aman di perangkat.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>Waktu berjalan sejak ujian dimulai dan tidak bisa di-pause.</span>
                </li>
                {essayCount > 0 && (
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span>Soal uraian/isian muncul setelah soal pilihan selesai dan dinilai terpisah oleh guru.</span>
                  </li>
                )}
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>Jika melebihi <strong>{cheatLimit}x pelanggaran</strong>, sesi akan <strong>terkunci</strong> dan memerlukan izin pengawas.</span>
                </li>
              </ul>
            </div>

            {/* Tombol Mulai */}
            <Button
              onClick={() => {
                const pr = `${student?.nisn}_${roomId}`;
                sessionStorage.setItem(`confirmed_${pr}`, "true");
                setIsConfirmed(true);
              }}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <Zap className="w-4 h-4 mr-2" />
              Saya Mengerti, Mulai Ujian
            </Button>

            <button
              onClick={() => navigate("/")}
              className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest transition-colors py-2"
            >
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden select-none font-sans">
      {canFullscreen && !isExamBrowser && !isFullscreen && !loading && !isLocked && (
        <div className="fixed inset-0 z-[45] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-amber-100/20 rounded-3xl flex items-center justify-center mb-6 border border-amber-500/30">
            <Maximize2 className="w-10 h-10 text-amber-500 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter">Mode Fokus Diperlukan</h2>
          <p className="text-slate-300 text-sm font-medium max-w-xs mb-8 leading-relaxed">
            Untuk menjaga integritas ujian, Anda harus berada dalam mode layar penuh (Full Screen).
          </p>
          <Button
            onClick={goFullscreen}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-900/20"
          >
            Masuk Mode Full Screen
          </Button>
        </div>
      )}

      {/* Per-Room Exambro Enforcement */}
      {roomData?.is_exambro && !isExamBrowser && !loading && !isLocked && (
        <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-500">
           <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-gradient-x"></div>
           <div className="w-24 h-24 bg-red-100/10 rounded-[35%] flex items-center justify-center mb-8 border border-red-500/30 shadow-2xl shadow-red-500/20">
             <ShieldAlert className="w-12 h-12 text-red-500 animate-bounce" />
           </div>
           <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Akses Ruangan Terkunci</h2>
           <p className="text-slate-400 text-sm font-bold max-w-sm mb-10 leading-relaxed">
             Ruangan <span className="text-white">"{roomData?.room_name}"</span> membutuhkan aplikasi <span className="text-red-500">EXAMBRO</span> resmi untuk dapat diakses.
           </p>
           
           <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-10 w-full max-w-sm text-left">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Info Perangkat:</p>
             <div className="text-[10px] text-slate-300 font-mono break-all opacity-60 leading-normal">
               {navigator.userAgent}
             </div>
           </div>

           <div className="flex flex-col gap-4 w-full max-w-xs">
             <Button
               onClick={() => window.location.reload()}
               className="bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl"
             >
               Muat Ulang Halaman
             </Button>
             <button
                onClick={() => navigate("/")}
                className="text-slate-500 hover:text-white text-[11px] font-bold uppercase tracking-widest transition-colors"
             >
                Kembali ke Dashboard
             </button>
           </div>
        </div>
      )}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl border-b border-slate-100 dark:border-slate-800 h-16 sm:h-20 px-4 sm:px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 bg-slate-100 dark:bg-slate-800 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            {/* Mobile: sync icon replaces clock when syncing */}
            {isSyncing ? (
              <Cloud className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 animate-pulse sm:hidden" />
            ) : !isOnline ? (
              <WifiOff className="h-4 w-4 sm:h-5 sm:w-5 text-rose-500 sm:hidden" />
            ) : (
              <Clock className={`h-4 w-4 sm:hidden ${timeLeft < 300 ? "text-rose-500 animate-pulse" : "text-emerald-500 dark:text-emerald-400"}`} />
            )}
            {/* Desktop: always show clock */}
            <Clock className={`hidden sm:block h-5 w-5 ${timeLeft < 300 ? "text-rose-500 animate-pulse" : "text-emerald-500 dark:text-emerald-400"}`} />
            <span className={`font-mono font-black text-sm sm:text-lg tracking-wider ${timeLeft < 300 ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"}`}>
              {Math.floor(timeLeft / 60).toString().padStart(2, "0")}:{(timeLeft % 60).toString().padStart(2, "0")}
            </span>
          </div>
          {/* Sync status — hidden on mobile, visible on desktop */}
          <div className="hidden sm:flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 sm:py-2 rounded-2xl bg-white/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 min-w-[40px] sm:min-w-[110px] shrink-0 overflow-hidden">
            {!isOnline ? (
              <div className="flex items-center gap-1.5">
                <WifiOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 shrink-0" />
                <span className="hidden sm:inline text-[9px] font-black text-rose-600 uppercase tracking-widest">Offline</span>
              </div>
            ) : isSyncing ? (
              <div className="flex items-center gap-1.5">
                <RefreshCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 animate-spin shrink-0" />
                <span className="hidden sm:inline text-[9px] font-black text-blue-600 uppercase tracking-widest">Syncing</span>
              </div>
            ) : syncError || localStorage.getItem(`pending_sync_${student?.id}_${roomId}`) ? (
              <div className="flex items-center gap-1.5 animate-pulse">
                <CloudOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                <span className="hidden sm:inline text-[9px] font-black text-amber-600 uppercase tracking-widest">Pending</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
                <span className="hidden sm:inline text-[9px] font-black text-emerald-600 uppercase tracking-widest">Connected</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 text-center min-w-0 px-2 sm:px-4">
          <p className="font-black text-slate-800 dark:text-white uppercase tracking-tight truncate text-[10px] sm:text-base leading-tight">{roomData?.subject}</p>
          <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-0.5 sm:mt-1">{roomData?.room_name}</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 ml-auto relative z-10">
          {/* Refresh Button (PC only) — soft refresh without leaving fullscreen */}
          <button onClick={() => { setLoading(true); setRefreshTrigger(p => p + 1); }} className="hidden sm:flex w-8 h-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-600 border border-slate-200 dark:border-slate-700 transition-colors" title="Refresh data">
            <RefreshCcw className="w-4 h-4" />
          </button>

          {/* Desktop Zoom Controls — next to name */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button onClick={() => setFontSize(p => Math.max(0.8, p - 0.1))} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors shadow-sm disabled:opacity-30" disabled={fontSize <= 0.8}><ZoomOut className="w-3.5 h-3.5" /></button>
            <div className="px-1 text-[9px] font-black text-slate-500 dark:text-slate-400 w-[32px] text-center">{Math.round(fontSize * 100)}%</div>
            <button onClick={() => setFontSize(p => Math.min(1.5, p + 0.1))} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors shadow-sm disabled:opacity-30" disabled={fontSize >= 1.5}><ZoomIn className="w-3.5 h-3.5" /></button>
          </div>

          <div className="flex items-center gap-x-2 sm:gap-4 ml-1 sm:ml-4 border-l border-slate-100 dark:border-slate-800 pl-2 sm:pl-4">
            {/* Nama & Kelas */}
            <div className="text-right min-w-0">
              <p className="font-black text-slate-800 dark:text-white text-[10px] sm:text-sm uppercase tracking-tight leading-tight truncate max-w-[70px] sm:max-w-none">
                {student?.name?.split(" ")[0]}
              </p>
              <p className="text-[8px] sm:text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-0.5 leading-none">
                {student?.className}
              </p>
            </div>

            {/* Icon Profil (Dropdown) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="w-9 h-9 sm:w-11 sm:h-11 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl sm:rounded-2xl flex items-center justify-center border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm group cursor-pointer hover:bg-emerald-100 transition-all outline-none">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl border-slate-100 dark:border-slate-800 shadow-2xl z-[100]">
                <DropdownMenuLabel className="px-3 py-2 flex flex-col gap-0.5">
                  <span className="text-xs font-black text-slate-800 dark:text-white uppercase truncate">{student?.name}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{terminology.student.toUpperCase()} • {student?.className} • {terminology.id} {student?.nisn}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-2 bg-slate-50 dark:bg-slate-800" />
                <div className="px-3 py-2 flex flex-col gap-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Personalisasi Tema</span>
                  <div className="flex items-center justify-between p-1 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <button onClick={() => setTheme("light")} className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all ${theme === 'light' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      <Sun className="h-4 w-4" />
                    </button>
                    <button onClick={() => setTheme("dark")} className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      <Moon className="h-4 w-4" />
                    </button>
                    <button onClick={() => setTheme("system")} className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all ${theme === 'system' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      <Monitor className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <DropdownMenuSeparator className="my-2 bg-slate-50 dark:bg-slate-800" />
                <DropdownMenuItem onClick={logoutStudent} className="px-3 py-2.5 rounded-xl text-rose-500 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30 flex items-center gap-3 cursor-pointer transition-colors group">
                  <div className="p-1.5 bg-rose-50 dark:bg-rose-900/30 rounded-lg group-focus:bg-rose-100/50 transition-colors">
                    <LogOut className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Keluar Ujian / Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div 
          className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 text-slate-800"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            // Only handle clicks on images inside MathText/rich-text content (not SmartImage which has its own handler)
            if (target.tagName === 'IMG' && target.closest('.html-segment, .math-content') && !target.closest('[data-smart-image]')) {
              e.stopPropagation();
              const src = (target as HTMLImageElement).src;
              if (src) setPreviewImage(src);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
          }}
          style={{ 
            fontSize: `${fontSize === 1 ? 'inherit' : `${fontSize * 100}%`}`,
            WebkitUserSelect: 'none',
            userSelect: 'none'
          }}
        >
          {!loading && questions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 bg-slate-50 dark:bg-slate-900 rounded-[35%] flex items-center justify-center border border-slate-100 dark:border-slate-800 shadow-inner">
                <FileText className="w-12 h-12 text-slate-300" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Daftar Soal Kosong</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Tidak ditemukan pertanyaan dalam paket soal ini. Silakan hubungi proktor.</p>
              </div>
              <Button onClick={() => navigate("/")} variant="outline" className="rounded-2xl h-12 px-8 font-black uppercase text-[10px] tracking-widest border-2 dark:border-slate-700 dark:text-slate-300">Kembali ke Dashboard</Button>
            </div>
          )}

          {!loading && questions.length > 0 && isExamOver && (
             <div className="flex flex-col items-center justify-center h-full space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 bg-rose-50 dark:bg-rose-950/20 rounded-[35%] flex items-center justify-center border border-rose-100 dark:border-rose-900/30 shadow-inner">
                <Clock className="w-12 h-12 text-rose-500 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 uppercase tracking-tight">Waktu Ujian Berakhir</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Sesi Anda telah selesai karena batas waktu pengerjaan telah habis.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => handleSubmitExam()} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-12 px-8 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20">Selesaikan Ujian</Button>
                <Button onClick={() => navigate("/")} variant="outline" className="rounded-2xl h-12 px-8 font-black uppercase text-[10px] tracking-widest border-2 dark:border-slate-700 dark:text-slate-300">Ke Dashboard</Button>
              </div>
            </div>
          )}

          {currentQuestion && !isExamOver && (
            <Card className="rounded-[25px] sm:rounded-[35px] border border-slate-100 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition-all duration-300">
              <CardHeader className="p-5 sm:p-8 pb-0 sm:pb-2">
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
                  <div className="relative group cursor-zoom-in select-none" onClick={() => setPreviewImage(currentQuestion.imageUrl!)}>
                    <SmartImage
                      src={currentQuestion.imageUrl}
                      className="max-w-full h-auto mx-auto block rounded-2xl border border-slate-100 dark:border-slate-800 mb-4 sm:mb-6 transition-transform hover:scale-[1.01] select-none"
                      containerClassName="min-h-[120px] rounded-2xl"
                      alt="Soal"
                      draggable={false}
                      style={{ userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties}
                    />
                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center pointer-events-none">
                      <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                    </div>
                  </div>
                )}
                {currentQuestion.groupId && (() => {
                  const f = questions.find(x => x.groupId === currentQuestion.groupId);
                  if (f && (f.groupText || f.text)) return (
                    <div className="bg-slate-50 dark:bg-slate-950 p-5 sm:p-8 rounded-[30px] border border-slate-200 dark:border-slate-800 mb-10 sm:mb-14 space-y-4 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                        <FileText className="w-12 h-12 sm:w-20 sm:h-20 text-emerald-800" />
                      </div>

                      <div className="flex items-center gap-3 mb-4 relative z-10">
                        <div className="h-5 sm:h-6 w-1 sm:w-1.5 rounded-full bg-emerald-600"></div>
                        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500 dark:text-emerald-400">Bacaan</span>
                      </div>

                      <MathText 
                        content={f.groupText || f.text}
                        className={`leading-relaxed text-slate-800 dark:text-slate-200 font-serif ql-editor !p-0 selection:bg-blue-100 dark:selection:bg-blue-900/40`} 
                      />

                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end opacity-50 dark:opacity-100">
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest italic">Bacalah teks dengan seksama sebelum memberikan jawaban.</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="h-3 sm:h-4" />

                <MathText 
                  content={currentQuestion.text}
                  className={`ql-editor !p-0 font-serif text-slate-800 dark:text-slate-200 leading-relaxed break-words [&_strong]:text-blue-600 dark:[&_strong]:text-blue-400 [&_p]:mb-3 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-6 [&_ul]:pl-6 selection:bg-indigo-100 dark:selection:bg-indigo-900/40`} 
                />

                {(currentQuestion.type === "pilihan_ganda_kompleks" || currentQuestion.type === "menjodohkan" || currentQuestion.type === "urutkan") && (
                  <div className="flex items-center gap-2 mb-6 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl">
                    <HelpCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-[10px] sm:text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                      {currentQuestion.type === "pilihan_ganda_kompleks" ? "Pilih semua jawaban yang benar" :
                        currentQuestion.type === "menjodohkan" ? "Pasangkan pernyataan di bawah ini" :
                          "Urutkan pernyataan dengan benar"}
                    </span>
                  </div>
                )}
                <div className="h-4 sm:h-2" />
              </CardHeader>
              <CardContent className="px-5 sm:px-8 pb-6 sm:pb-8 space-y-3">
                {(currentQuestion.type === "pilihan_ganda" || currentQuestion.type === "pilihan_ganda_kompleks") && (
                  <div className="space-y-2">
                    {(choicesOrder[currentQuestion.id] || Object.keys(currentQuestion.choices || {})).map((choiceId, idx) => {
                      const c = currentQuestion.choices![choiceId]; const isM = currentQuestion.type === "pilihan_ganda_kompleks"; const isS = isM ? (answers[currentQuestion.id] || []).includes(choiceId) : answers[currentQuestion.id] === choiceId;
                      return (
                        <button key={`${currentQuestion.id}-${choiceId}`} onClick={() => { if (isM) { const a = answers[currentQuestion.id] || []; handleAnswerSelect(currentQuestion.id, a.includes(choiceId) ? a.filter((i: any) => i !== choiceId) : [...a, choiceId]); } else handleAnswerSelect(currentQuestion.id, choiceId); }} className={`w-full text-left p-2 sm:p-3 rounded-xl sm:rounded-2xl border-2 flex items-center gap-2.5 sm:gap-4 outline-none group active:scale-[0.99] ${isS ? "bg-emerald-50 border-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-700"}`}>
                          <div className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg sm:rounded-xl border flex items-center justify-center font-black text-xs sm:text-sm ${isS ? "bg-emerald-600 border-emerald-600 text-white" : "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800 group-hover:bg-emerald-50 group-hover:text-emerald-900"}`}>{String.fromCharCode(65 + idx)}</div>
                          <div className="flex-1 overflow-hidden">
                            <MathText content={c.text} className={`break-words font-serif ql-editor !p-0 [&_img]:max-w-[300px] [&_img]:h-auto [&_img]:rounded-xl [&_img]:mt-2 text-inherit ${isS ? "font-bold" : "font-normal"}`} />
                            {c.imageUrl && (
                              <div className="relative inline-block cursor-zoom-in group mt-4 select-none" onClick={(e) => { e.stopPropagation(); setPreviewImage(c.imageUrl!); }}>
                                <SmartImage
                                  src={c.imageUrl}
                                  className="max-h-[200px] rounded-2xl border border-slate-100 dark:border-slate-800 group-hover:brightness-90 transition-all select-none"
                                  containerClassName="min-h-[80px] rounded-2xl"
                                  alt="Choice"
                                  draggable={false}
                                  style={{ userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties}
                                />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
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
                        <button key={choiceId} onClick={() => handleAnswerSelect(currentQuestion.id, choiceId)} className={`group relative flex flex-col items-center justify-center gap-4 py-8 px-6 rounded-[2.5rem] border-2 transition-all duration-300 active:scale-95 ${isS ? (isB ? "bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-400 text-white shadow-xl shadow-emerald-500/20" : "bg-gradient-to-br from-rose-500 to-rose-600 border-rose-400 text-white shadow-xl shadow-rose-500/20") : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600 hover:border-emerald-200 dark:hover:border-emerald-800"}`}><div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-colors ${isS ? "bg-white/20 text-white" : (isB ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500" : "bg-rose-50 dark:bg-rose-950/30 text-rose-500")}`}>{isB ? <CheckCircle2 className="w-9 h-9" strokeWidth={2.5} /> : <X className="w-9 h-9" strokeWidth={2.5} />}</div><span className={`font-black text-sm uppercase tracking-widest ${isS ? "text-white" : "text-slate-700 dark:text-slate-300"}`}>{currentQuestion.choices![choiceId].text}</span></button>
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
                            <div
                              className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-serif text-slate-800 dark:text-slate-200"
                              style={{ fontSize: `${15 * fontSize}px` }}
                            >{p.left}</div>
                            <div className="flex items-center opacity-20"><ArrowRight className="w-4 h-4" /></div>
                            <div 
                              onDragOver={(e) => { e.preventDefault(); setDragOverSlot(p.id); }}
                              onDragLeave={() => setDragOverSlot(null)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDragOverSlot(null);
                                if (draggingOption) {
                                  handleAnswerSelect(currentQuestion.id, { ...(answers[currentQuestion.id] || {}), [p.id]: draggingOption });
                                  setDraggingOption(null);
                                }
                              }}
                              onClick={() => { if (v) { const n = { ...sA }; delete n[p.id]; handleAnswerSelect(currentQuestion.id, n); } }}
                              className={`flex-1 p-1 rounded-xl border-2 border-dashed flex items-center justify-center min-h-[50px] transition-all ${
                                dragOverSlot === p.id && !v ? "bg-emerald-100/50 dark:bg-emerald-900/30 border-emerald-500 scale-[1.02]" :
                                v ? "bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-400/50 cursor-pointer" : 
                                "bg-slate-50/30 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"
                              }`}
                            >
                              {v ? <div className="w-full h-full flex items-center justify-center bg-emerald-600 text-white rounded-lg p-2 font-serif shadow-sm" style={{ fontSize: `${14 * fontSize}px` }}>{v}</div> : <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase">Drop Disini</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="lg:w-1/3 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-wrap gap-2 content-start min-h-[100px]">
                      {(matchingOptions[currentQuestion.id] || []).filter(o => !Object.values(answers[currentQuestion.id] || {}).includes(o)).map(o => (
                        <div 
                          key={o} 
                          draggable
                          onDragStart={() => setDraggingOption(o)}
                          onDragEnd={() => { setDraggingOption(null); setDragOverSlot(null); }}
                          onClick={() => { const p = (currentQuestion.pairs || []).find(x => !(answers[currentQuestion.id] || {})[x.id]); if (p) handleAnswerSelect(currentQuestion.id, { ...(answers[currentQuestion.id] || {}), [p.id]: o }); }}
                          className={`px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-serif text-emerald-600 dark:text-emerald-400 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-grab active:cursor-grabbing select-none ${draggingOption === o ? "opacity-50 scale-95" : ""}`} 
                          style={{ fontSize: `${14 * fontSize}px` }}
                        >{o}</div>
                      ))}
                    </div>
                  </div>
                )}
                {(currentQuestion.type === "isian_singkat" || currentQuestion.type === "uraian") && (
                  isEssayLocked ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-amber-50/50 dark:bg-amber-950/20 rounded-[30px] border-2 border-dashed border-amber-200 dark:border-amber-800/40">
                      <Lock className="w-12 h-12 text-amber-400 mb-4" />
                      <h3 className="text-lg font-black text-amber-700 dark:text-amber-400 uppercase tracking-tight mb-2">Soal Terkunci</h3>
                      <p className="text-sm text-amber-600/80 dark:text-amber-400/60 font-medium max-w-sm">
                        Selesaikan semua soal objektif terlebih dahulu sebelum mengerjakan soal uraian/isian singkat.
                      </p>
                      <p className="text-xs text-amber-500 mt-3 font-bold">
                        Sisa {objectiveQuestions.filter(q => !isQuestionAnswered(q.id)).length} soal objektif belum dijawab
                      </p>
                    </div>
                  ) : (
                    <textarea value={answers[currentQuestion.id] || ""} onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)} placeholder={currentQuestion.type === "uraian" ? 'Tuliskan jawaban Anda di sini secara lengkap...\n\n(Isi "lembar ujian" jika Anda mengerjakan di lembar ujian kertas)' : 'Tuliskan jawaban Anda...\n(Isi "lembar ujian" jika Anda mengerjakan di lembar ujian)'} rows={currentQuestion.type === "uraian" ? 10 : 3} className="w-full p-6 sm:p-8 rounded-[30px] border-2 border-slate-100 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 font-bold text-sm sm:text-base resize-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all outline-none" />
                  )
                )}
                {(currentQuestion.type === "urutkan" || currentQuestion.type === "drag_drop") && (() => {
                  const savedOrder = Array.isArray(answers[currentQuestion.id]) ? answers[currentQuestion.id] : null;
                  const shuffledOrder = Array.isArray(itemsOrder[currentQuestion.id]) ? itemsOrder[currentQuestion.id] : null;
                  const defaultOrder = (currentQuestion.items || []).map(it => it.id);
                  const displayOrder = savedOrder || shuffledOrder || defaultOrder;
                  const hasBeenTouched = !!savedOrder; // Siswa sudah pernah geser
                  if (!displayOrder || displayOrder.length === 0) return null;
                  return (
                  <Reorder.Group axis="y" values={displayOrder} onReorder={(o: string[]) => handleAnswerSelect(currentQuestion.id, o)} className="space-y-2">
                    {displayOrder.map((id: string, i: number) => {
                      const it = currentQuestion.items?.find(x => x.id === id); return <Reorder.Item key={id} value={id} className={`flex items-center gap-4 sm:gap-6 p-4 sm:p-5 border rounded-2xl shadow-sm cursor-grab active:cursor-grabbing group relative overflow-hidden transition-colors ${hasBeenTouched ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40" : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700"}`}><div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm ${hasBeenTouched ? "bg-emerald-600 text-white" : "bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400"}`}>{String.fromCharCode(65 + i)}</div><div className="flex-1 font-serif text-slate-800 dark:text-slate-200" style={{ fontSize: `${15 * fontSize}px` }}>{it?.text || ""}</div><div className={`p-2 rounded-lg ${hasBeenTouched ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-slate-50 dark:bg-slate-900"}`}><GripVertical className={`w-4 h-4 sm:w-5 sm:h-5 ${hasBeenTouched ? "text-emerald-400" : "text-slate-300"}`} /></div></Reorder.Item>;
                    })}
                  </Reorder.Group>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
        <aside className="hidden lg:flex w-[320px] bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 flex-col shadow-sm relative z-10 overflow-hidden">
          {/* Header Navigasi */}
          <div className="p-5 pb-4">
            <div className="flex items-center gap-3 mb-2 px-1">
              <div className="w-3 h-3 bg-emerald-600 rounded-full animate-pulse" />
              <h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.3em]">Navigasi Soal</h3>
            </div>
          </div>

          {/* List Nomor Soal (Scrollable) */}
          <div className="flex-1 overflow-y-auto px-5 py-2 custom-scrollbar">
            <div className="grid grid-cols-5 gap-2 content-start">
              {(() => {
                let separatorShown = false;
                return questions.map((q, i) => {
                  const t = q.type || "pilihan_ganda";
                  const isEssay = t === "isian_singkat" || t === "uraian";
                  const showSeparator = isEssay && !separatorShown;
                  if (isEssay) separatorShown = true;
                  
                  // Hide essay questions entirely if objectives not done
                  if (isEssay && !allObjectiveAnswered) {
                    if (showSeparator) {
                      return (
                        <React.Fragment key={q.id}>
                          <div className="col-span-5 flex items-center gap-2 py-2 my-1">
                            <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800/40"></div>
                            <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest whitespace-nowrap flex items-center gap-1"><Lock className="w-3 h-3" /> Terkunci</span>
                            <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800/40"></div>
                          </div>
                        </React.Fragment>
                      );
                    }
                    return null; // Hide essay buttons
                  }
                  
                  return (
                    <React.Fragment key={q.id}>
                      {showSeparator && (
                        <div className="col-span-5 flex items-center gap-2 py-2 my-1">
                          <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800/40"></div>
                          <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest whitespace-nowrap">Uraian / Isian</span>
                          <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800/40"></div>
                        </div>
                      )}
                      <button 
                        onClick={() => handleNavClick(i)} 
                        className={`aspect-square rounded-xl flex items-center justify-center font-black text-xl border-2 transition-all active:scale-[0.85] outline-none focus:outline-none ${i === currentQuestionIndex
                          ? "bg-emerald-700 border-emerald-700 text-white shadow-lg shadow-emerald-700/30"
                          : flaggedQuestions[q.id]
                            ? "bg-amber-500 border-amber-600 text-white shadow-lg shadow-amber-500/20"
                            : isQuestionAnswered(q.id)
                              ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20"
                              : isEssay
                                ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40 text-amber-500 dark:text-amber-400"
                                : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                          }`}
                      >
                        {i + 1}
                      </button>
                    </React.Fragment>
                  );
                });
              })()}
            </div>
          </div>

          {/* Footer Tombol (Fixed at Bottom) */}
          <div className="p-5 pt-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex(prev => prev - 1)} className="h-16 rounded-2xl font-black uppercase tracking-widest text-[12px] border-2 border-emerald-50 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors">Back</Button>
              <Button onClick={() => currentQuestionIndex === questions.length - 1 ? setIsSubmitModalOpen(true) : handleNextClick()} className={`h-16 text-white font-black uppercase tracking-widest text-[12px] rounded-2xl transition-transform active:scale-95 shadow-lg ${currentQuestionIndex === questions.length - 1 ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"}`}>{currentQuestionIndex === questions.length - 1 ? "Submit" : "Next"}</Button>
            </div>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-100 dark:border-slate-800 p-4 sm:p-6 lg:hidden flex justify-between items-center z-40">
        <Button variant="outline" size="sm" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex(p => p - 1)} className="rounded-2xl h-14 px-8 font-black uppercase text-[12px] tracking-[0.2em] border-2 border-emerald-50 dark:border-emerald-900/40 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 active:scale-90 transition-all">Back</Button>
        <Button variant="ghost" className="font-black text-emerald-800 dark:text-emerald-100 uppercase tracking-[0.3em] text-[16px]" onClick={() => setIsNavModalOpen(true)}>{currentQuestionIndex + 1} / {questions.length}</Button>
        <Button onClick={() => currentQuestionIndex === questions.length - 1 ? setIsSubmitModalOpen(true) : handleNextClick()} size="sm" className="rounded-2xl h-14 px-8 text-white font-black uppercase text-[12px] tracking-[0.2em] bg-emerald-600 dark:bg-emerald-500 active:scale-90 transition-all shadow-lg shadow-emerald-600/20">{currentQuestionIndex === questions.length - 1 ? "End" : "Next"}</Button>
      </div>

      <Dialog open={isNavModalOpen} onOpenChange={setIsNavModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-3xl p-8 pointer-events-auto border-none bg-white dark:bg-slate-950 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <DialogTitle className="text-xl font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tighter">Navigasi Soal</DialogTitle>

            {/* Mobile Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 sm:hidden">
              <button onClick={() => setFontSize(p => Math.max(0.5, p - 0.1))} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 active:bg-emerald-50 dark:active:bg-emerald-950 shadow-sm disabled:opacity-30" disabled={fontSize <= 0.5}><ZoomOut className="w-4 h-4" /></button>
              <div className="px-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase w-[35px] text-center">{Math.round(fontSize * 100)}%</div>
              <button onClick={() => setFontSize(p => Math.min(1.5, p + 0.1))} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 active:bg-emerald-50 dark:active:bg-emerald-950 shadow-sm disabled:opacity-30" disabled={fontSize >= 1.5}><ZoomIn className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3 sm:gap-4 overflow-y-auto max-h-[60vh] pr-2">
            {(() => {
              let separatorShown = false;
              return questions.map((q, i) => {
                const t = q.type || "pilihan_ganda";
                const isEssay = t === "isian_singkat" || t === "uraian";
                const showSeparator = isEssay && !separatorShown;
                if (isEssay) separatorShown = true;
                const isQuestionAnswered = (id: string) => {
                  const ans = answers[id];
                  if (ans === undefined || ans === null) return false;
                  if (typeof ans === 'string') return ans.trim().length > 0;
                  if (Array.isArray(ans)) return ans.length > 0;
                  if (typeof ans === 'object') return Object.keys(ans).length > 0;
                  return true;
                };
                
                // Hide essay if objectives not done
                if (isEssay && !allObjectiveAnswered) {
                  if (showSeparator) {
                    return (
                      <React.Fragment key={q.id}>
                        <div className="col-span-5 flex items-center gap-2 py-2 my-1">
                          <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800/40"></div>
                          <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest whitespace-nowrap flex items-center gap-1"><Lock className="w-3 h-3" /> Terkunci</span>
                          <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800/40"></div>
                        </div>
                      </React.Fragment>
                    );
                  }
                  return null;
                }
                return (
                  <React.Fragment key={q.id}>
                    {showSeparator && (
                      <div className="col-span-5 flex items-center gap-2 py-2 my-1">
                        <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800/40"></div>
                        <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest whitespace-nowrap">Uraian / Isian</span>
                        <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800/40"></div>
                      </div>
                    )}
                    <button onClick={() => { setCurrentQuestionIndex(i); setIsNavModalOpen(false); }} className={`aspect-square rounded-2xl flex items-center justify-center font-black text-xl border-3 transition-all active:scale-90 outline-none focus:outline-none ${i === currentQuestionIndex
                      ? "bg-emerald-700 border-emerald-700 text-white shadow-2xl"
                      : flaggedQuestions[q.id]
                        ? "bg-amber-500 border-amber-600 text-white shadow-xl shadow-amber-500/20"
                        : isQuestionAnswered(q.id)
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20"
                          : isEssay
                            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40 text-amber-500 dark:text-amber-400"
                            : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                      }`}>{i + 1}</button>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isResetModalOpen} onOpenChange={() => { }}><DialogContent className="max-w-md rounded-2xl p-6 text-center pointer-events-auto bg-white dark:bg-slate-950 border-none shadow-2xl"><AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-2 animate-bounce" /><DialogTitle className="text-lg font-bold dark:text-white">Sesi Ujian Di-Reset</DialogTitle><p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Sesi Anda telah di-reset oleh Pengawas. Silakan login kembali.</p><Button onClick={() => logoutStudent()} className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl h-11 mt-4"><LogOut className="w-4 h-4 mr-2" /> Keluar & Login Ulang</Button></DialogContent></Dialog>
      
      <Dialog open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 text-center pointer-events-auto bg-white dark:bg-slate-950 border-none shadow-2xl">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-2 animate-pulse" />
          <DialogTitle className="text-lg font-bold dark:text-white">Gagal Mengumpulkan Ujian</DialogTitle>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">{errorMessage}</p>
          <div className="mt-6 flex flex-col gap-2">
            <Button 
              onClick={() => {
                setIsErrorModalOpen(false);
                handleSubmitExam();
              }} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-bold"
            >
              Coba Kumpulkan Lagi
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setIsErrorModalOpen(false);
                logoutStudent();
              }} 
              className="w-full border-red-200 hover:bg-red-50 text-red-600 dark:border-red-900/30 dark:hover:bg-red-950/30 rounded-xl h-11 font-bold"
            >
              Keluar Ujian / Logout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Custom Preview Image Overlay - Full Screen with Zoom */}
      {previewImage && (
        <ImageZoomOverlay src={previewImage} onClose={() => setPreviewImage(null)} />
      )}
      
      <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 pointer-events-auto text-center bg-white dark:bg-slate-950 border-none shadow-2xl">
          {(() => {
            // Calculate flagged questions
            const flaggedQuestionNumbers = questions
              .map((q, idx) => ({ id: q.id, number: idx + 1 }))
              .filter(q => flaggedQuestions[q.id])
              .map(q => q.number);
            const flaggedCount = flaggedQuestionNumbers.length;

            if (!isAllAnswered) {
              // Has unanswered questions
              return (
                <>
                  <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-2" />
                  <DialogTitle className="text-lg font-bold dark:text-white">Belum Selesai</DialogTitle>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    Ada {unansweredCount} soal belum dijawab. Yakin?
                  </p>
                  <div className="mt-6">
                    <Button 
                      onClick={() => setIsSubmitModalOpen(false)} 
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
                    >
                      Kembali Mengerjakan
                    </Button>
                  </div>
                </>
              );
            } else if (flaggedCount > 0) {
              // All answered but has flagged questions
              return (
                <>
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                  <DialogTitle className="text-lg font-bold dark:text-white">Soal Ditandai</DialogTitle>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    Ada {flaggedCount} soal yang masih ditandai:
                  </p>
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 mt-3 max-h-[120px] overflow-y-auto">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {flaggedQuestionNumbers.map((num) => (
                        <span 
                          key={num}
                          className="inline-flex items-center justify-center w-8 h-8 bg-amber-500 text-white font-bold text-sm rounded-lg"
                        >
                          {num}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs mt-3">
                    Ingin cek ulang atau tetap kumpulkan?
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsSubmitModalOpen(false)} 
                      className="flex-1 rounded-xl dark:border-slate-800 dark:text-slate-300"
                    >
                      Cek Ulang
                    </Button>
                    <Button 
                      disabled={isSyncing}
                      onClick={() => { 
                        setIsSubmitModalOpen(false); 
                        handleSubmitExam(); 
                      }} 
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                    >
                      {isSyncing ? "Menyimpan..." : "Tetap Kumpulkan"}
                    </Button>
                  </div>
                </>
              );
            } else {
              // All answered and no flagged questions
              return (
                <>
                  <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
                  <DialogTitle className="text-lg font-bold dark:text-white">Kumpulkan Ujian?</DialogTitle>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    Yakin ingin mengakhiri sekarang?
                  </p>
                  <div className="mt-6 flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsSubmitModalOpen(false)} 
                      className="flex-1 rounded-xl dark:border-slate-800 dark:text-slate-300"
                    >
                      Batal
                    </Button>
                    <Button 
                      disabled={isSyncing}
                      onClick={() => { 
                        setIsSubmitModalOpen(false); 
                        handleSubmitExam(); 
                      }} 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl"
                    >
                      {isSyncing ? "Menyimpan..." : "Kumpulkan"}
                    </Button>
                  </div>
                </>
              );
            }
          })()}
        </DialogContent>
      </Dialog>
      <Dialog open={isSkipNoticeOpen} onOpenChange={setIsSkipNoticeOpen}><DialogContent className="max-w-xs rounded-[2rem] p-6 pointer-events-auto border-none bg-white dark:bg-slate-950 shadow-2xl text-center"><HelpCircle className="w-14 h-14 text-amber-600 mx-auto mb-4" /><DialogTitle className="text-base font-black uppercase tracking-tight dark:text-white">Soal Belum Dijawab</DialogTitle><p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-relaxed">Anda belum memberikan jawaban. Yakin ingin melewati?</p><div className="grid grid-cols-2 gap-3 mt-6"><Button variant="outline" onClick={() => setIsSkipNoticeOpen(false)} className="rounded-xl text-[10px] font-black uppercase tracking-widest border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400">Kembali</Button><Button onClick={() => { if (targetIndex !== null) goToQuestion(targetIndex); setIsSkipNoticeOpen(false); }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-xl uppercase tracking-widest shadow-lg shadow-emerald-600/20">Lompati</Button></div></DialogContent></Dialog>
      <Dialog open={isAdminFinishedModalOpen} onOpenChange={() => { }}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8 text-center pointer-events-auto bg-white dark:bg-slate-950 border-none shadow-2xl">
          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-10 h-10 text-amber-600 animate-pulse" />
          </div>
          <DialogTitle className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter mb-4">Ujian Selesai!</DialogTitle>
          <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 mb-6">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-bold leading-relaxed">
              Sesi ujian Anda telah diselesaikan oleh <span className="text-emerald-600">Admin/Pengawas</span>. 
              <br /><br />
              Semua jawaban Anda telah tersimpan dengan aman ke sistem.
            </p>
          </div>
          <Button 
            onClick={() => {
              setIsAdminFinishedModalOpen(false);
              handleSubmitExam();
            }} 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-14 font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            Selesai & Lihat Hasil
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isCheatWarningOpen} onOpenChange={setIsCheatWarningOpen}>
        <DialogContent className="max-w-xs rounded-[2rem] p-6 text-center border-none shadow-2xl pointer-events-auto bg-white dark:bg-slate-950">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4 animate-pulse" />
          <DialogTitle className="text-xl font-black text-red-600 uppercase tracking-tighter">Pelanggaran!</DialogTitle>
          <div className="space-y-3 mt-2">
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold leading-relaxed">DILARANG pindah aplikasi atau membuka tab lain selama ujian!</p>
            <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-2xl border border-red-100 dark:border-red-900/30">
              <span className="text-[10px] uppercase font-black text-red-700 dark:text-red-400 tracking-widest block mb-1">Pelanggaran Anda</span>
              <span className="text-2xl font-black text-red-600 dark:text-red-500">
                {(() => {
                  const currentCheat = attempt?.cheatCount || 0;
                  const baseLimit = roomData?.cheat_limit || 3;
                  return `${currentCheat} / ${baseLimit}`;
                })()}
              </span>
            </div>
          </div>
          <Button onClick={() => { 
            setIsCheatWarningOpen(false);
            try { CheatAlert.stopAlarm(); } catch (err) { }
          }} className="w-full bg-emerald-600 text-white font-black uppercase tracking-widest h-12 rounded-2xl mt-6">SAYA MENGERTI</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CBTPage;
