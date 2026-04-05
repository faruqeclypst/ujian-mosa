import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash, Edit, RefreshCw, Users, Archive, RotateCw, FileSpreadsheet, BookOpen, ClipboardList, Lock, Clock, ChevronDown, Power, PowerOff, Square, CheckCircle2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx-js-style";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { DeleteConfirmationDialog } from "../../components/ui/delete-confirmation-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import pb from "../../lib/pocketbase";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { useExamData } from "../../context/ExamDataContext";
import { useAuth } from "../../context/AuthContext";
import { getExamTypeColorClass } from "./ExamsPage";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";

import { DataTable } from "../../components/ui/data-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

export interface ExamRoomData {
  id: string;
  examId: string;
  classId: string | null;
  allClasses: boolean;
  token: string;
  start_time: string;
  end_time: string;
  duration: number;
  cheat_limit: number;
  submit_window?: number;
  examTitle?: string;
  className?: string;
  room_code?: string;
  token_updated_at?: string; // ISO string from PB
  status?: "archive" | null;
  room_name?: string;
  examTeacherId?: string;
  examType?: string;
  isDisabled?: boolean;
  subjectName?: string;
  teacherName?: string;
  show_result?: boolean;
  isActive?: boolean;
}

// 🛡️ Fuzzy Match Helper for Short Answers
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

const ExamRoomsPage = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [rooms, setRooms] = useState<ExamRoomData[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"aktif" | "arsip">("aktif");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedRoom, setSelectedRoom] = useState<ExamRoomData | null>(null);

  const [formValues, setFormValues] = useState({
    room_name: "",
    examId: "",
    classId: "all",
    allClasses: true,
    token: "",
    start_time: "",
    end_time: "",
    duration: 60,
    cheat_limit: 3,
    submit_window: 10,
    room_code: "",
    show_result: true,
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<ExamRoomData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: "info" | "warning" | "danger" | "success";
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    type: "info",
    confirmLabel: "Konfirmasi",
    onConfirm: () => { }
  });

  // Monitoring States
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [monitorRoom, setMonitorRoom] = useState<ExamRoomData | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [monitorQuestions, setMonitorQuestions] = useState<any[]>([]);
  const [answersList, setAnswersList] = useState<Record<string, any>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedstudent, setExpandedstudent] = useState<string | null>(null);

  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [limitNisn, setLimitNisn] = useState("");
  const [limitValue, setLimitValue] = useState("1");
  const [previewImage, setPreviewImage] = useState<string | null>(null); // <--- Pratinjau Zoom Gambar Logs

  const {
    classes: examClasses, students, subjects, teachers: masterTeachers,
    universalToken, timeLeft
  } = useExamData();

  const [liveBreakdown, setLiveBreakdown] = useState<Record<string, number>>({});
  const [totalOngoing, setTotalOngoing] = useState(0);

  const [monitorPage, setMonitorPage] = useState(1);
  const [monitorPageSize, setMonitorPageSize] = useState(25);
  const [monitorClassFilter, setMonitorClassFilter] = useState("all");
  const [monitorSortBy, setMonitorSortBy] = useState<"default" | "nama" | "nilai" | "login">("default");

  const teacherId = user?.id; // PocketBase user id

  // 🖱️ Menarik/Menutup Dropdown Menu otomatis saat Klik di Luar kontainer
  useEffect(() => {
    const handleGlobalClick = () => setOpenMenuId(null);
    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, []);

  // Sync Live Monitoring Progres (Efficient One-time fetch + Event-based update)
  useEffect(() => {
    let attemptsCache: Record<string, any> = {};

    const updateOverviewStats = (cache: Record<string, any>) => {
      const stats: Record<string, number> = {};
      const uniqueStudentsGlobal = new Set();
      const uniqueStudentsPerRoom: Record<string, Set<string>> = {};

      Object.values(cache).forEach(att => {
        const sId = att.studentId || att.student_id;
        if (!sId || att.status !== "ongoing") return;

        uniqueStudentsGlobal.add(sId);
        if (!uniqueStudentsPerRoom[att.examRoomId]) {
          uniqueStudentsPerRoom[att.examRoomId] = new Set();
        }
        uniqueStudentsPerRoom[att.examRoomId].add(sId);
      });

      Object.keys(uniqueStudentsPerRoom).forEach(rid => {
        stats[rid] = uniqueStudentsPerRoom[rid].size;
      });

      setLiveBreakdown(stats);
      setTotalOngoing(uniqueStudentsGlobal.size);
    };

    const initStats = async () => {
      try {
        const allAttempts = await pb.collection('attempts').getFullList({
          filter: 'status = "ongoing"'
        });
        const initialCache: Record<string, any> = {};
        allAttempts.forEach(a => initialCache[a.id] = a);
        attemptsCache = initialCache;
        updateOverviewStats(initialCache);
      } catch (e) { }
    };

    initStats();

    const unsub = pb.collection('attempts').subscribe("*", (e) => {
      if (e.action === 'delete') {
        delete attemptsCache[e.record.id];
      } else {
        attemptsCache[e.record.id] = e.record;
      }
      updateOverviewStats(attemptsCache);
    });

    return () => { unsub.then(u => u()); };
  }, []);

  // Sync Master Exams for Room creation selection
  useEffect(() => {
    const fetchExams = async () => {
      try {
        const loaded = await pb.collection('exams').getFullList({ sort: '-created' });
        setExams(loaded);
      } catch (e) { }
    };
    fetchExams();
  }, []);

  // Sync Exam Rooms listing
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const loaded = await pb.collection('exam_rooms').getFullList({ sort: '-created' });
        const mapped = loaded.map(room => {
          // Robust field mapping for CamelCase and snake_case
          const sId = room.examId || (room as any).examid || "";
          const startTime = room.start_time || (room as any).startTime || "";
          const endTime = room.end_time || (room as any).endTime || "";
          const roomName = room.room_name || (room as any).title || room.title || "";
          const clsId = room.classId || (room as any).classIds || "";
          const isOff = room.isDisabled !== undefined ? room.isDisabled : (room as any).isActive === false;

          const examObj = exams.find(e => e.id === sId);
          const subjectObj = subjects.find(s => s.id === (examObj?.subjectId || (examObj as any)?.subjectid));
          const teacherObj = masterTeachers.find(t => t.id === (examObj?.teacherId || (examObj as any)?.teacherid));

          let className = "Semua Kelas";
          if (!room.allClasses) {
            // Kita coba ambil dari berbagai kemungkinan field (classId atau classIds)
            const clsData = room.classId || (room as any).classid || (room as any).classIds || (room as any).classids || "";

            // Konversi ke Array ID yang bersih
            let classList: string[] = [];
            if (Array.isArray(clsData)) {
              classList = clsData;
            } else if (typeof clsData === 'string' && clsData.length > 0) {
              const rawCls = clsData;
              classList = Array.isArray(rawCls)
                ? rawCls
                : String(rawCls || "").split(",").map(id => id.trim()).filter(id => id && id !== "all");
            }

            // Cari nama-nama kelasnya
            const foundNames = classList.map(id => {
              const c = (examClasses || []).find(cl => cl.id === id);
              return c ? c.name : null;
            }).filter(Boolean);

            if (foundNames.length > 0) {
              className = foundNames.join(", ");
            } else {
              // Jika ID tidak ditemukan namanya, tapi ada ID-nya, tampilkan ID-nya saja sebagai cadangan
              className = classList.length > 0 ? `ID: ${classList[0].substring(0, 5)}...` : "N/A";
            }
          }

          const { id, ...rest } = room;
          return {
            id,
            ...rest,
            examId: sId,
            room_name: roomName,
            start_time: startTime,
            end_time: endTime,
            classId: clsId,
            isDisabled: isOff,
            examTitle: examObj?.title || "Draft Ujian",
            examType: (examObj as any)?.examType || (examObj as any)?.examtype || "UMUM",
            subjectName: subjectObj?.name || "N/A",
            teacherName: teacherObj?.name || "N/A",
            className: className
          } as any as ExamRoomData;
        });

        setRooms(mapped);
      } catch (e) {
        console.error("Error fetching rooms:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
    const unsubscribe = pb.collection('exam_rooms').subscribe("*", () => {
      fetchRooms();
    });
    return () => {
      unsubscribe.then(unsub => unsub());
    };
  }, [subjects, masterTeachers, exams, examClasses]);

  const [monitorTimeLeft, setMonitorTimeLeft] = useState(0);
  const [isMonitorRefreshing, setIsMonitorRefreshing] = useState(false);

  const handleManualRefreshMonitor = useCallback(async (currRoom?: ExamRoomData) => {
    const targetRoom = currRoom || monitorRoom;
    if (!targetRoom?.id) return;
    
    setIsMonitorRefreshing(true);
    try {
      // 1. Ambil DAFTAR SOAL (Hanya jika belum ada)
      if (monitorQuestions.length === 0) {
        const qList = await pb.collection('questions').getFullList({
          filter: `examId = "${targetRoom.examId}"`,
          sort: 'order,created'
        });

        // 🛠️ Mapping agar UI Monitoring mengenali Type, Choices, dan AnswerKey
        const mappedQuestions = qList.map(q => {
          const rawType = q.field || q.type || "pilihan_ganda";
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
          const mappedType = typeMapReverse[rawType] || rawType;
          const options = q.options || {};

          return {
            ...q,
            type: mappedType,
            choices: options,
            pairs: mappedType === "menjodohkan" ? options.pairs : undefined,
            items: (mappedType === "urutkan" || mappedType === "drag_drop") ? options.items : undefined,
            answerKey: q.correctAnswer || q.answerKey
          };
        });
        setMonitorQuestions(mappedQuestions);
      }

      // 2. Ambil DATA PENGERJAAN (Selalu ambil yang terbaru)
      const loadedAttempts = await pb.collection('attempts').getFullList({
        filter: `examRoomId = "${targetRoom.id}"`
      });

      const grouped: Record<string, any> = {};
      loadedAttempts.forEach(att => {
        const sId = att.studentId || att.student_id;
        if (sId && att.answers) grouped[sId] = att.answers;
      });

      setAnswersList(grouped);
      setAttempts(loadedAttempts);
    } catch (e) {
      console.error("Refresh Monitor Error:", e);
    } finally {
      setIsMonitorRefreshing(false);
    }
  }, [monitorRoom, monitorQuestions.length]);

  // 🔒 Algoritma Token Otomatis Matematikal (Sama dengan student)
  const generateTimeToken = (timestamp: number) => {
    const coeff = 5 * 60 * 1000;
    const bucket = Math.floor(timestamp / coeff);
    const seed = bucket * 3317 + 51233; // Harus Sama persis dengan student
    const hash = Math.abs(seed % 233280);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let t = "";
    let val = hash;
    for (let i = 0; i < 5; i++) {
      t += chars[val % chars.length];
      val = Math.floor(val / chars.length);
    }
    return t;
  };



  const [currentBucket, setCurrentBucket] = useState<number>(Math.floor(Date.now() / 300000));

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const bucket = Math.floor(now / 300000);
      setCurrentBucket(bucket);
      setMonitorTimeLeft(Math.floor(((bucket + 1) * 300000 - now) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 📡 Real-time Subscription khusus untuk Ruangan yang sedang di-Monitor
  useEffect(() => {
    if (!isMonitorOpen || !monitorRoom?.id) return;

    let isSubscribed = true;
    let currentUnsub: (() => void) | null = null;

    const startSubscribe = async () => {
      try {
        // SUBSKRIPSI PENGERJAAN (UNTUK LIVE PROGRES)
        const unsub = await pb.collection('attempts').subscribe("*", (e) => {
          if (!isSubscribed) return;

          // Pencocokan ID Ruangan (Robust)
          const recRoomId = e.record.examRoomId || e.record.exam_room_id || "";
          if (recRoomId !== monitorRoom.id) return;

          if (e.action === 'create' || e.action === 'update') {
            setAttempts(prev => {
              const idx = prev.findIndex(a => a.id === e.record.id);
              const updatedRecord = { ...e.record };
              if (idx > -1) {
                const newArr = [...prev];
                newArr[idx] = { ...newArr[idx], ...updatedRecord };
                return newArr;
              }
              // PREPEND (taruh di atas) agar data terbaru diprioritaskan oleh .find()
              return [updatedRecord, ...prev];
            });

            const sId = e.record.studentId || e.record.student_id;
            if (sId && e.record.answers) {
              setAnswersList(prev => ({ ...prev, [sId]: e.record.answers }));
            }
          } else if (e.action === 'delete') {
            setAttempts(prev => prev.filter(a => a.id !== e.record.id));
          }
        });

        // 🛡️ SUBSKRIPSI SOAL (JIKA ADA UPDATE ERROR SAAT UJIAN)
        const unsubQuestions = await pb.collection('questions').subscribe("*", (e) => {
           if (!isSubscribed) return;
           if (e.record.examId === monitorRoom.examId) {
              console.log("📝 Pertanyaan diperbarui oleh Admin lain, Sinkronisasi Monitoring...");
              // Kosongkan cache pertanyaan lokal agar handleManualRefreshMonitor mengambil yang terbaru
              setMonitorQuestions([]);
           }
        });

        if (!isSubscribed) {
          unsub();
          unsubQuestions();
        } else {
          currentUnsub = () => { unsub(); unsubQuestions(); };
        }
      } catch (err) { }
    };

    startSubscribe();

    // 🛡️ Backup: Re-fetch manual setiap 10 detik jika real-time terganggu
    const polling = setInterval(() => {
      if (isMonitorOpen) handleManualRefreshMonitor();
    }, 10000);

    return () => {
      isSubscribed = false;
      clearInterval(polling);
      if (currentUnsub) currentUnsub();
    };
  }, [isMonitorOpen, monitorRoom?.id]);

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info") => {
    setConfirmDialog({
      isOpen: true,
      title,
      description,
      type,
      confirmLabel: "OK",
      onConfirm: () => { }
    });
  };

  const handleManualGrade = async (studentId: string, qId: string, isForcedCorrect: boolean) => {
    if (!monitorRoom?.id) return;
    try {
      // 1. Cari pengerjaan terbaru siswa ini
      const studentAttempts = attempts.filter(a => a.studentId === studentId || (a as any).student_id === studentId);
      const att = studentAttempts.sort((a, b) => {
        const diff = new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime();
        return diff !== 0 ? diff : b.id.localeCompare(a.id);
      })[0];
      
      if (!att) {
        showAlert("Peringatan", "Data pengerjaan tidak ditemukan.", "danger");
        return;
      }

      // Pastikan overrides adalah object
      let currentOverrides: any = {};
      try {
        if (typeof att.overrides === 'string') currentOverrides = JSON.parse(att.overrides);
        else if (typeof att.overrides === 'object') currentOverrides = { ...att.overrides };
      } catch (e) { currentOverrides = {}; }
      
      const newOverrides = { ...currentOverrides, [qId]: isForcedCorrect };
      const sisAnswers = (att.answers !== undefined ? att.answers : (att as any).answers) || {};
      let correctCount = 0;

      // Hitung ulang benar & skor
      monitorQuestions.forEach((q: any) => {
        let itemCorrect = false;
        if (newOverrides[q.id] !== undefined) {
          itemCorrect = newOverrides[q.id];
        } else {
          const ansId = sisAnswers[q.id];
          if (ansId) {
            const type = q.type || "pilihan_ganda";
            if (type === "pilihan_ganda" || type === "benar_salah") {
              const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ansId).toLowerCase());
              itemCorrect = ck ? q.choices[ck].isCorrect === true : false;
            } else if (type === "pilihan_ganda_kompleks") {
              const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase());
              const studentKeys = Array.isArray(ansId) ? ansId.map(k => String(k).toLowerCase()) : [];
              itemCorrect = studentKeys.length === correctKeys.length && studentKeys.every(k => correctKeys.includes(k));
            } else if (type === "isian_singkat") itemCorrect = isFuzzyMatch(ansId, q.answerKey);
            else if (type === "urutkan" || type === "drag_drop") {
              const co = (q.items || []).map((it: any) => it.id);
              itemCorrect = Array.isArray(ansId) && ansId.length === co.length && ansId.every((v, i) => v === co[i]);
            } else if (type === "menjodohkan") {
              const pairs = q.pairs || [];
              itemCorrect = pairs.length > 0 && pairs.every((p: any) => ansId[p.id] === p.right);
            }
          }
        }
        if (itemCorrect) correctCount++;
      });

      const total = monitorQuestions.length;
      const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

      // 🔄 Optimistic Update
      setAttempts(prev => prev.map(a => a.id === att.id ? { ...a, overrides: newOverrides, correct: correctCount, score: score } : a));

      // 2. Simpan ke Database
      const updateData = {
        overrides: newOverrides,
        correct: correctCount,
        score: score
      };
      
      console.log("Saving to DB:", updateData);
      await pb.collection('attempts').update(att.id, updateData);
    } catch (error: any) {
      console.error("Manual Grade Error:", error);
      const msg = error.data?.message || error.message || "Gagal";
      showAlert("Gagal", `Tidak dapat menyimpan (${msg}). Pastikan database terhubung.`, "danger");
      handleManualRefreshMonitor();
    }
  };

  const handleExportExcel = () => {
    if (!monitorRoom) return;
    const workbook = XLSX.utils.book_new();

    // 1. Filter Siswa Identik dengan Tabel Monitoring (Agar semua siswa tampil di Excel)
    const filteredStudents = students.filter(s => {
      if (monitorRoom?.allClasses) {
        if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
        return true;
      }
      if (!monitorRoom?.classId) return false;
      const rawIds = monitorRoom.classId;
      const allowedIds = Array.isArray(rawIds)
        ? rawIds
        : String(rawIds || "").split(",").map(id => id.trim()).filter(Boolean);
      if (!allowedIds.includes(s.classId)) return false;
      if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));

    // 2. Definisi Header
    const header = ["No", "NISN", "Nama Siswa", "Kelas", "Jam Login", "Jam Submit", "Cheat Count", "Benar", "Salah", "Nilai"];
    monitorQuestions.forEach((q, idx) => header.push(`Soal ${idx + 1}`));

    // 3. Olah Data Siswa (Live Calculation)
    const exportRows = filteredStudents.map((student, idx) => {
      // Ambil pengerjaan TERBARU (Latest) milik siswa ini
      const studentAttempts = attempts.filter((a) => (a.studentId === student.id) || (a.student_id === student.id));
      const att = studentAttempts.sort((a, b) => {
        const dateA = new Date(a.created || 0).getTime();
        const dateB = new Date(b.created || 0).getTime();
        return dateB - dateA;
      })[0];

      const sisAnswers = att?.answers || {};
      const monitorOverrides = att?.overrides || {};
      const kelasObj = examClasses.find(c => c.id === student.classId);
      const className = kelasObj ? kelasObj.name : "-";

      let correct = 0;
      if (att) {
        monitorQuestions.forEach(q => {
          const ansId = sisAnswers[q.id];
          if (monitorOverrides[q.id] === true) {
            correct++;
          } else if (monitorOverrides[q.id] === false) {
            // Skrip Salah
          } else if (ansId) {
            const type = q.type || "pilihan_ganda";
            if (type === "pilihan_ganda" || type === "benar_salah") {
              const choiceKey = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ansId).toLowerCase());
              if (choiceKey && q.choices[choiceKey].isCorrect === true) correct++;
            } else if (type === "pilihan_ganda_kompleks") {
              const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect);
              const studentKeys = Array.isArray(ansId) ? ansId.map(k => String(k).toLowerCase()) : [];
              const lowerCorrect = correctKeys.map(k => k.toLowerCase());
              if (studentKeys.length === lowerCorrect.length && studentKeys.every(k => lowerCorrect.includes(k))) correct++;
            } else if (type === "isian_singkat") {
              if (isFuzzyMatch(ansId, q.answerKey)) correct++;
            } else if (type === "urutkan" || type === "drag_drop") {
              const correctOrder = (q.items || []).map((it: any) => it.id);
              if (Array.isArray(ansId) && ansId.length === correctOrder.length && ansId.every((val, idx) => val === correctOrder[idx])) correct++;
            } else if (type === "menjodohkan") {
              const pairs = q.pairs || [];
              if (pairs.length > 0 && pairs.every((p: any) => ansId[p.id] === p.right)) correct++;
            }
          }
        });
      }

      const scoreValue = monitorQuestions.length > 0 ? (correct / monitorQuestions.length) * 100 : 0;
      const finalScore = att?.status === "finished" ? (att.score ?? scoreValue) : scoreValue;

      const row = [
        idx + 1,
        student.nisn,
        student.name,
        className,
        att?.startTime || (att as any)?.start_time ? new Date(att?.startTime || (att as any)?.start_time).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }) : "-",
        att?.submittedAt || att?.submitTime ? new Date(att?.submittedAt || att?.submitTime).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }) : (att?.status === "finished" ? "Selesai" : (att ? "Ongoing" : "-")),
        att?.cheatCount || (att as any)?.cheat_count || 0,
        correct,
        monitorQuestions.length - correct,
        finalScore.toFixed(1)
      ];

      // Tambahkan Jawaban per Soal
      monitorQuestions.forEach((q) => {
        const ans = sisAnswers[q.id];
        row.push(ans ? (Array.isArray(ans) ? (Array.isArray(ans) ? ans.join(",") : JSON.stringify(ans)) : String(ans).toUpperCase()) : "-");
      });

      return row;
    });

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "16A34A" } },
      alignment: { horizontal: "center", vertical: "center" }
    };

    const correctStyle = {
      fill: { patternType: "solid", fgColor: { rgb: "DCFCE7" } }, // Hijau muda lembut
      font: { color: { rgb: "15803D" }, bold: true },           // Teks hijau tua tebal
      alignment: { horizontal: "center" }
    };

    const wrongStyle = {
      fill: { patternType: "solid", fgColor: { rgb: "FEE2E2" } }, // Merah muda lembut
      font: { color: { rgb: "B91C1C" }, bold: true },           // Teks merah tua tebal
      alignment: { horizontal: "center" }
    };

    const wsOverall = XLSX.utils.aoa_to_sheet([header, ...exportRows]);

    // 🎨 Apply Styling ke Lembar Kerja Excel
    // Baris 0: Header
    for (let c = 0; c < header.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: c });
      if (wsOverall[addr]) (wsOverall[addr] as any).s = headerStyle;
    }

    // Baris 1+: Data Siswa
    exportRows.forEach((row, rowIndex) => {
      const student = filteredStudents[rowIndex];
      const studentAttempts = attempts.filter((a) => (a.studentId === student.id) || (a.student_id === student.id));
      const att = studentAttempts.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())[0];
      const sisAnswers = att?.answers || {};
      const monitorOverrides = att?.overrides || {};

      row.forEach((cellValue, colIndex) => {
        const r = rowIndex + 1; // Index 0 adalah header
        const addr = XLSX.utils.encode_cell({ r: r, c: colIndex });
        if (!wsOverall[addr]) return;

        // Terapkan Warna mulai dari Kolom "Soal 1" (Indeks 10)
        if (colIndex >= 10 && att && cellValue !== "-") {
          const qIdx = colIndex - 10;
          const q = monitorQuestions[qIdx];
          const ansId = sisAnswers[q.id];

          let isCorrect = false;
          if (monitorOverrides[q.id] === true) {
            isCorrect = true;
          } else if (monitorOverrides[q.id] === false) {
            isCorrect = false;
          } else if (ansId) {
            const type = q.type || "pilihan_ganda";
            if (type === "pilihan_ganda" || type === "benar_salah") {
              const choiceKey = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ansId).toLowerCase());
              if (choiceKey && q.choices[choiceKey].isCorrect === true) isCorrect = true;
            } else if (type === "pilihan_ganda_kompleks") {
              const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect);
              const studentKeys = Array.isArray(ansId) ? ansId.map(k => String(k).toLowerCase()) : [];
              const lowerCorrect = correctKeys.map(k => k.toLowerCase());
              if (studentKeys.length === lowerCorrect.length && studentKeys.every(k => lowerCorrect.includes(k))) isCorrect = true;
            }
          }

          (wsOverall[addr] as any).s = isCorrect ? correctStyle : wrongStyle;
        }
      });
    });

    XLSX.utils.book_append_sheet(workbook, wsOverall, "Laporan Nilai");
    XLSX.writeFile(workbook, `Nilai_Ujian_${monitorRoom.room_name || monitorRoom.examTitle}.xlsx`);
  };

  const columns = [
    {
      key: "index",
      label: "No",
      render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
    },
    {
      key: "examTitle",
      label: "Ruang / Bank Soal",
      sortable: true,
      render: (v: string, item: ExamRoomData) => (
        <div className="flex flex-col gap-1 items-start">
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
            <span className="text-slate-400 font-medium mr-1 select-none">NR:</span>
            {item.room_name || "Tanpa Nama"}
          </span>
          <div className="flex flex-col items-start gap-1 mt-0.5">
            <span className="text-[10px] text-slate-500 font-medium tracking-wide">
              <span className="text-slate-400/70 mr-1 select-none font-bold italic">BS:</span>
              {v}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium italic">
              <span>{item.subjectName}</span>
              <span>•</span>
              <span>{item.teacherName}</span>
            </div>
            {item.examType && (
              <span className={`text-[9px] mt-1 px-1.5 py-0.5 rounded-md font-semibold border ${getExamTypeColorClass(item.examType)}`}>
                {item.examType}
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      key: "className",
      label: "Kelas",
      sortable: true,
      render: (v: string, item: ExamRoomData) => {
        if (item.allClasses) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/40 shadow-sm">
              Semua Kelas
            </span>
          );
        }
        if (!v) return <span className="text-slate-400 text-xs">-</span>;
        return (
          <div className="flex flex-wrap gap-1 max-w-[120px]">
            {v.split(", ").map((cls, idx) => (
              <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700">
                {cls}
              </span>
            ))}
          </div>
        );
      }
    },
    {
      key: "duration",
      label: "Durasi",
      render: (v: any) => <span className="text-slate-500 font-medium">{(v || "0")} Menit</span>
    },
    {
      key: "start_time",
      label: "Waktu",
      render: (v: any, item: ExamRoomData) => {
        const start = item.start_time ? new Date(item.start_time) : null;
        const end = item.end_time ? new Date(item.end_time) : null;

        const isValidStart = start && !isNaN(start.getTime());
        const isValidEnd = end && !isNaN(end.getTime());

        return (
          <div className="flex flex-col gap-0.5 text-xs text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
            <div className="flex items-center">
              <span className="w-14">Mulai</span>
              <span className="mr-1.5">:</span>
              <span>{isValidStart ? `${start.toLocaleDateString("id-ID", { day: '2-digit', month: '2-digit' })} ${start.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}` : "-"}</span>
            </div>
            <div className="flex items-center">
              <span className="w-14">Selesai</span>
              <span className="mr-1.5">:</span>
              <span>{isValidEnd ? `${end.toLocaleDateString("id-ID", { day: '2-digit', month: '2-digit' })} ${end.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}` : "-"}</span>
            </div>
          </div>
        );
      }
    },
    {
      key: "actions",
      label: "Status",
      render: (_: any, item: ExamRoomData) => {
        const now = Date.now();
        const start = new Date(item.start_time).getTime();
        const end = new Date(item.end_time).getTime();
        if (item.status === "archive") return <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Arsip</span>;
        if (item.isDisabled) return <span className="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded">Nonaktif</span>;
        if (now < start) return <span className="text-[10px] bg-blue-100 text-blue-500 px-1.5 py-0.5 rounded">Menunggu</span>;
        if (now > end) return <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Selesai</span>;
        return <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded animate-pulse">Berjalan</span>;
      }
    }
  ];

  const generateNewToken = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let token = "";
    for (let i = 0; i < 6; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    return token;
  };

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedRoom(null);
    setFormValues({
      room_name: "",
      examId: exams[0]?.id || "",
      classId: "all",
      allClasses: true,
      token: generateNewToken(),
      start_time: "",
      end_time: "",
      duration: 60,
      cheat_limit: 3,
      submit_window: 10,
      room_code: "",
      show_result: true,
    });
    setIsDialogOpen(true);
  };

  const handleEditClick = (room: ExamRoomData) => {
    setDialogMode("edit");
    setSelectedRoom(room);
    setFormValues({
      room_name: room.room_name || "",
      examId: room.examId,
      classId: room.allClasses ? "" : (Array.isArray(room.classId) ? room.classId.join(",") : (room.classId || "")),
      allClasses: room.allClasses || false,
      token: room.token,
      start_time: room.start_time && !isNaN(new Date(room.start_time).getTime()) ? new Date(room.start_time).toISOString().slice(0, 16) : "",
      end_time: room.end_time && !isNaN(new Date(room.end_time).getTime()) ? new Date(room.end_time).toISOString().slice(0, 16) : "",
      duration: room.duration,
      cheat_limit: room.cheat_limit,
      submit_window: room.submit_window || 0,
      room_code: room.room_code || "",
      show_result: room.show_result !== false,
    });
    setIsDialogOpen(true);
  };

  const handleForceEndRoom = async (room: ExamRoomData) => {
    setConfirmDialog({
      isOpen: true,
      title: "Selesaikan Paksa",
      description: "Akhiri pengerjaan ruang ujian ini untuk semua siswa sekarang?",
      type: "danger",
      confirmLabel: "Akhiri",
      onConfirm: async () => {
        try {
          await pb.collection('exam_rooms').update(room.id, { end_time: new Date().toISOString() });
          showAlert("Berhasil", "Ruang ujian telah diakhiri.", "success");
        } catch (e) {
          showAlert("Gagal", "Gagal mengakhiri ruang.", "danger");
        }
      }
    });
  };

  const handleToggleDisabled = (room: ExamRoomData) => {
    const isCurrentlyActive = room.isActive !== false;
    setConfirmDialog({
      isOpen: true,
      title: isCurrentlyActive ? "Nonaktifkan Ruangan" : "Aktifkan Ruangan",
      description: isCurrentlyActive 
        ? `Apakah Anda yakin ingin menonaktifkan "${room.room_name}"? Siswa tidak akan bisa masuk atau lanjut mengerjakan.` 
        : `Aktifkan "${room.room_name}" sekarang agar siswa bisa mulai mengerjakan?`,
      type: isCurrentlyActive ? "warning" : "info",
      confirmLabel: isCurrentlyActive ? "Nonaktifkan" : "Aktifkan",
      onConfirm: async () => {
        try {
          const newIsActive = !isCurrentlyActive;
          await pb.collection('exam_rooms').update(room.id, {
            isActive: newIsActive,
            isDisabled: !newIsActive
          });
          showAlert("Berhasil", `Ruang berhasil ${newIsActive ? "diaktifkan" : "dinonaktifkan"}.`, "success");
        } catch (e) {
          showAlert("Gagal", "Gagal mengubah status.", "danger");
        }
      }
    });
  };

  const handleArchiveRoom = async (room: ExamRoomData) => {
    try {
      await pb.collection('exam_rooms').update(room.id, { status: "archive" });
      showAlert("Berhasil", "Ruang diarsipkan.", "success");
    } catch (e) {
      showAlert("Gagal", "Gagal mengarsipkan.", "danger");
    }
  };

  const handleRestoreRoom = async (room: ExamRoomData) => {
    try {
      await pb.collection('exam_rooms').update(room.id, { status: null });
      showAlert("Berhasil", "Ruang dipulihkan.", "success");
    } catch (e) {
      showAlert("Gagal", "Gagal memulihkan.", "danger");
    }
  };

  const handleForceSubmitAll = () => {
    const ongoing = attempts.filter(a => a.status === 'ongoing');
    if (ongoing.length === 0) return showAlert("Info", "Tidak ada siswa aktif.", "info");
    setConfirmDialog({
      isOpen: true,
      title: "Submit Semua",
      description: `Submit paksa ${ongoing.length} siswa sekarang?`,
      type: "danger",
      confirmLabel: "Submit",
      onConfirm: async () => {
        try {
          for (const a of ongoing) {
            await pb.collection('attempts').update(a.id, {
              status: 'finished',
              submittedAt: new Date().toISOString()
            });
          }
          showAlert("Berhasil", "Semua siswa telah disubmit.", "success");
          handleManualRefreshMonitor();
        } catch (e) { showAlert("Gagal", "Error submitting all.", "danger"); }
      }
    });
  };

  const handleForceSubmitStudent = (attId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Submit Paksa",
      description: "Selesaikan pengerjaan siswa ini?",
      type: "danger",
      confirmLabel: "Submit",
      onConfirm: async () => {
        try {
          await pb.collection('attempts').update(attId, { status: 'finished', submittedAt: new Date().toISOString() });
          handleManualRefreshMonitor();
          showAlert("Berhasil", "Siswa disubmit.", "success");
        } catch (e) { showAlert("Gagal", "Error.", "danger"); }
      }
    });
  };

  const handleDeleteClick = (room: ExamRoomData) => {
    setRoomToDelete(room);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roomToDelete) return;
    setIsDeleting(true);
    try {
      await pb.collection('exam_rooms').delete(roomToDelete.id);
      showAlert("Berhasil", "Ruang dihapus.", "success");
    } catch (e) { showAlert("Gagal", "Gagal hapus.", "danger"); }
    finally { setIsDeleting(false); setDeleteDialogOpen(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Jika Semua Kelas dipilih, kita masukkan seluruh daftar ID kelas yang ada
      const finalClassIds = formValues.allClasses
        ? (examClasses || []).map(c => c.id)
        : formValues.classId.split(",").filter(Boolean);

      const data = {
        title: formValues.room_name,
        room_name: formValues.room_name,
        examId: formValues.examId,
        startTime: new Date(formValues.start_time).toISOString(),
        start_time: new Date(formValues.start_time).toISOString(),
        endTime: new Date(formValues.end_time).toISOString(),
        end_time: new Date(formValues.end_time).toISOString(),

        classIds: finalClassIds,
        classId: finalClassIds,
        allClasses: formValues.allClasses,
        all_classes: formValues.allClasses,

        duration: Number(formValues.duration),
        cheat_limit: Number(formValues.cheat_limit),
        submit_window: Number(formValues.submit_window),
        room_code: formValues.room_code,
        show_result: formValues.show_result,
        isActive: true,
        status: "active",
        isDisabled: false
      };

      if (dialogMode === "edit" && selectedRoom) {
        await pb.collection('exam_rooms').update(selectedRoom.id, data);
      } else {
        await pb.collection('exam_rooms').create(data);
      }
      setIsDialogOpen(false);
      showAlert("Berhasil", "Data berhasil disimpan.", "success");
    } catch (e) {
      console.error("Save error:", e);
      showAlert("Gagal", "Gagal simpan.", "danger");
    }
  };

  const handleMonitorClick = (room: ExamRoomData) => {
    setMonitorRoom(room);
    setMonitorPage(1);
    setIsMonitorOpen(true);
    handleManualRefreshMonitor(room);
  };

  const handleUnlockStudent = async (attId: string) => {
    try {
      await pb.collection('attempts').update(attId, {
        status: 'ongoing',
        cheatCount: 0,
        cheat_count: 0
      });
      handleManualRefreshMonitor();
      showAlert("Berhasil", "Siswa berhasil dibuka kuncinya.", "success");
    } catch (e) { showAlert("Gagal", "Gagal membuka kunci.", "danger"); }
  };

  const handleResetSession = (attId: string, sisId: string, rid: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Reset Sesi",
      description: "Hapus permanen progres siswa ini?",
      type: "danger",
      confirmLabel: "Reset",
      onConfirm: async () => {
        try {
          // 🔥 Hapus SEMUA pengerjaan siswa ini di ruang ini untuk membersihkan sisa data atau duplikat
          const related = await pb.collection('attempts').getFullList({
             filter: `studentId = "${sisId}" && examRoomId = "${rid}"`
          });
          
          for (const r of related) {
            await pb.collection('attempts').delete(r.id);
          }
          
          handleManualRefreshMonitor();
          showAlert("Berhasil", "Sesi direset.", "success");
        } catch (e) { showAlert("Gagal", "Error.", "danger"); }
      }
    });
  };

  const openLimitDialog = (nisn: string) => { setLimitNisn(nisn); setLimitValue("1"); setLimitDialogOpen(true); };

  const handleConfirmAddLimit = async () => {
    // 🔍 Mencari pengerjaan siswa yang sesuai (Mendukung studentId & student_id)
    const studentAttempts = attempts.filter(a => (a.studentId === limitNisn) || (a.student_id === limitNisn));

    // 💡 Selalu pilih pengerjaan TERBARU (Latest) agar sesuai dengan tampilan di tabel monitoring
    const att = studentAttempts.sort((a, b) => {
      const diff = new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime();
      return diff !== 0 ? diff : b.id.localeCompare(a.id);
    })[0];

    if (!att) return;
    try {
      const currentLimit = (att.extraCheatLimit !== undefined ? att.extraCheatLimit : (att as any).extra_cheat_limit) || 0;
      const addedValue = parseInt(limitValue) || 1;

      // Update dengan dual naming untuk kompatibilitas schema
      await pb.collection('attempts').update(att.id, {
        extraCheatLimit: currentLimit + addedValue,
        extra_cheat_limit: currentLimit + addedValue
      });

      handleManualRefreshMonitor();
      setLimitDialogOpen(false);
      showAlert("Berhasil", "Batas toleransi berhasil ditambahkan.", "success");
    } catch (e) { showAlert("Gagal", "Terjadi kesalahan saat menambah batas.", "danger"); }
  };

  const handleResetCheatCount = async (attId: string) => {
    try {
      const existing = attempts.find(a => a.id === attId);
      const curExtra = (existing?.extraCheatLimit !== undefined ? existing.extraCheatLimit : (existing as any)?.extra_cheat_limit) || 0;

      await pb.collection('attempts').update(attId, {
        cheatCount: 0,
        cheat_count: 0,
        status: "ongoing",
        extraCheatLimit: curExtra + 1,
        extra_cheat_limit: curExtra + 1
      });
      handleManualRefreshMonitor();
      showAlert("Berhasil", "Pelanggaran telah di-reset.", "success");
    } catch (e) { showAlert("Gagal", "Error reset.", "danger"); }
  };

  const isRoomActive = selectedRoom ? (
    (liveBreakdown[selectedRoom.id] || 0) > 0 ||
    (Date.now() >= new Date(selectedRoom.start_time).getTime() && Date.now() <= new Date(selectedRoom.end_time).getTime())
  ) : false;
  const isEditRestricted = dialogMode === "edit" && isRoomActive;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-500" />
            Ruang Ujian
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Aktifkan dan kelola sesi ujian untuk Siswa.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab("aktif")}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === "aktif" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
            >
              Aktif
            </button>
            <button
              onClick={() => setActiveTab("arsip")}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === "arsip" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
            >
              Arsip
            </button>
          </div>
          <Button onClick={handleCreateClick} size="sm" className="rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-semibold shadow-sm">
            <Plus className="mr-1 h-3.5 w-3.5" /> Buka Ruang
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Token Universal</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <code className="text-lg font-mono font-bold text-slate-800 dark:text-slate-100">{universalToken || "---"}</code>
                <span className="text-[11px] text-amber-500 dark:text-amber-400 font-medium tracking-wide">({timeLeft})</span>
              </div>
            </div>
          </div>
        </div>

        <div className="group relative bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm flex items-center gap-3 backdrop-blur-sm cursor-help hover:border-emerald-300 dark:hover:border-emerald-800 transition-all">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:emerald-400 group-hover:scale-110 transition-transform">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Siswa Aktif</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5 leading-none">{totalOngoing}</p>
          </div>

          {/* Hover Breakdown Card */}
          <div className="absolute top-full left-0 right-0 mt-2 z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 min-w-[200px] max-h-60 overflow-y-auto">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1 flex justify-between">
                <span>Detail Ruangan Live</span>
                <span className="text-emerald-500">{totalOngoing} Total</span>
              </p>
              {Object.keys(liveBreakdown).length === 0 ? (
                <p className="text-center py-2 text-[10px] text-slate-500">Tidak ada aktifitas</p>
              ) : (
                <div className="space-y-1.5">
                  {Object.keys(liveBreakdown).map(rid => {
                    const room = rooms.find(r => r.id === rid);
                    return (
                      <div key={rid} className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-600 dark:text-slate-300 font-medium truncate pr-2">
                          {room ? (room.room_name || room.examTitle) : "ID: " + rid}
                        </span>
                        <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 px-1.5 py-0.5 rounded font-bold min-w-[20px] text-center">
                          {liveBreakdown[rid]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm flex items-center gap-3 backdrop-blur-sm">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Ruang</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">{rooms.length}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Data Ruang Ujian</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={rooms.filter(r => activeTab === "arsip" ? r.status === "archive" : r.status !== "archive")}
              columns={columns}
              searchPlaceholder="Cari ruang..."
              emptyMessage={`Belum ada ruang ujian ${activeTab}.`}
              actions={(room: ExamRoomData) => (
                <div className="flex justify-end gap-1.5 items-center whitespace-nowrap">
                  <button
                    className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg dark:bg-blue-900/10 dark:text-blue-400 border border-blue-100 dark:border-blue-800/40"
                    onClick={() => handleMonitorClick(room)}
                    title="Monitoring Ujian"
                  >
                    <Users className="h-4 w-4" />
                  </button>

                  <button
                    className="p-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg dark:bg-purple-900/10 dark:text-purple-400 border border-purple-100 dark:border-purple-800/40"
                    onClick={() => navigate(`/admin/bank-soal/${room.examId}/questions`)}
                    title="Bank Soal"
                  >
                    <BookOpen className="h-4 w-4" />
                  </button>

                  {(role === "admin" || room.examTeacherId === teacherId) && (
                    <>
                      <button
                        className={`p-1.5 rounded-lg border ${room.isDisabled
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40"
                          : "bg-red-50 text-red-700 hover:bg-red-100 border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/40"}`}
                        onClick={() => handleToggleDisabled(room)}
                        title={room.isDisabled ? "Aktifkan Ruangan" : "Non-aktifkan"}
                      >
                        {room.isDisabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                      </button>

                      <button
                        className="p-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg dark:bg-sky-900/10 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40"
                        onClick={() => handleEditClick(room)}
                        title="Edit Ruangan"
                      >
                        <Edit className="h-4 w-4" />
                      </button>

                      {activeTab === "aktif" ? (
                        <button
                          className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg dark:bg-amber-900/10 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40"
                          onClick={() => handleArchiveRoom(room)}
                          title="Arsipkan"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          className="p-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg dark:bg-indigo-900/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/40"
                          onClick={() => handleRestoreRoom(room)}
                          title="Pulihkan"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                      )}

                      {activeTab === "arsip" && (
                        <button
                          className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg dark:bg-rose-900/10 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40"
                          onClick={() => handleDeleteClick(room)}
                          title="Hapus Permanen"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            />
          </CardContent>
        </Card>
      )}

      {/* Dialog Create/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Edit Ruang Ujian" : "Buka Ruang Ujian"}</DialogTitle>
            {isEditRestricted && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 p-2.5 rounded-xl text-[10px] mt-2 font-medium flex items-start gap-2 animate-pulse-slow dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400">
                <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Ujian sedang berlangsung. Anda diperbolehkan mengubah <b>Nama Ruang</b>, <b>Kelas</b>, <b>Waktu (Mulai/Selesai)</b>, <b>Durasi</b>, <b>Kumpul Dibuka</b>, dan <b>Batas Cheat</b>.</span>
              </div>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <FormField id="room_name" label="Nama Ruang Ujian" error={undefined}>
              <Input
                placeholder="Contoh: Tryout UTBK - Gelombang 1"
                value={formValues.room_name}
                onChange={(e) => setFormValues({ ...formValues, room_name: e.target.value })}
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">Nama ini yang akan ditampilkan di layar dashboard dashboard Siswa Anda.</p>
            </FormField>

            <FormField id="examId" label="Pilih Bank Soal" error={undefined}>
              <select
                value={formValues.examId}
                onChange={(e) => setFormValues({ ...formValues, examId: e.target.value })}
                required
                disabled={isEditRestricted}
                className={`w-full rounded-md border border-slate-200 dark:border-slate-800 bg-card text-sm p-2 ${isEditRestricted ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <option value="">-- Pilih Bank Soal --</option>
                {exams
                  .filter((e) => role === "admin" || e.teacherId === teacherId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
              </select>
              {formValues.examId && exams.find(e => e.id === formValues.examId) && (
                <div className="mt-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col gap-1">
                  <div><span className="font-semibold text-slate-700 dark:text-slate-300">Jenis:</span> {exams.find(e => e.id === formValues.examId)?.examType || "Latihan Biasa"}</div>
                  <div><span className="font-semibold text-slate-700 dark:text-slate-300">Mapel:</span> {subjects.find(m => m.id === exams.find(e => e.id === formValues.examId)?.subjectId)?.name || "-"}</div>
                  <div><span className="font-semibold text-slate-700 dark:text-slate-300">Guru:</span> {masterTeachers.find(t => t.id === exams.find(e => e.id === formValues.examId)?.teacherId)?.name || "-"}</div>
                </div>
              )}
            </FormField>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Pilih Kelas</label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setFormValues({ ...formValues, allClasses: true, classId: "" })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${formValues.allClasses ? "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800/40" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}
                >
                  Semua Kelas
                </button>
                <button
                  type="button"
                  onClick={() => setFormValues({ ...formValues, allClasses: false })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!formValues.allClasses ? "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800/40" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}
                >
                  Pilih Parsial (Multiple)
                </button>
              </div>

              {!formValues.allClasses && (
                <div className="grid grid-cols-2 gap-2 border border-slate-200 dark:border-slate-800 rounded-xl p-2 max-h-40 overflow-y-auto bg-card">
                  {examClasses.map((c) => {
                    const isChecked = formValues.classId ? formValues.classId.split(",").includes(c.id) : false;
                    return (
                      <label key={c.id} className={`flex items-center gap-2 text-xs p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer text-slate-700 dark:text-slate-200`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let current = formValues.classId ? formValues.classId.split(",") : [];
                            if (e.target.checked) {
                              current.push(c.id);
                            } else {
                              current = current.filter(id => id !== c.id);
                            }
                            current = current.filter(Boolean);
                            setFormValues({ ...formValues, classId: current.join(",") });
                          }}
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>


            <div className="grid grid-cols-2 gap-3">
              <FormField id="start_time" label="Waktu Mulai" error={undefined}>
                <Input type="datetime-local" value={formValues.start_time} onChange={(e) => setFormValues({ ...formValues, start_time: e.target.value })} required />
              </FormField>
              <FormField id="end_time" label="Waktu Berakhir" error={undefined}>
                <Input type="datetime-local" value={formValues.end_time} onChange={(e) => setFormValues({ ...formValues, end_time: e.target.value })} required />
              </FormField>
            </div>


            <div className="space-y-4 pt-1 border-t mt-4">
              <div className="grid grid-cols-2 gap-3 mt-2">
                <FormField id="duration" label="Durasi (Menit)" error={undefined}>
                  <Input type="number" value={formValues.duration} onChange={(e) => setFormValues({ ...formValues, duration: Number(e.target.value) })} required />
                </FormField>
                <FormField id="cheat_limit" label="Batas Cheat" error={undefined}>
                  <Input type="number" value={formValues.cheat_limit} onChange={(e) => setFormValues({ ...formValues, cheat_limit: Number(e.target.value) })} required />
                </FormField>
              </div>
              <FormField id="submit_window" label="Kumpul Dibuka (Sisa Menit)" error={undefined}>
                <Input type="number" placeholder="Contoh: 10 (Tombol kumpul aktif 10 menit sebelum berakhir)" value={formValues.submit_window || ""} onChange={(e) => setFormValues({ ...formValues, submit_window: Number(e.target.value) })} />
                <p className="text-slate-400 text-xs mt-1">biarkan kosong agar Siswa dapat mengumpulkan selama ujian berjalan</p>
              </FormField>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/60 mt-2">
                <div className="space-y-0.5 pr-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Menampilkan Hasil Ujian</label>
                  <p className="text-[10px] text-slate-400 leading-tight">Siswa dapat melihat skor, jumlah benar & salah setelah selesai mengumpulkan.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formValues.show_result}
                    onChange={(e) => setFormValues({ ...formValues, show_result: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/40 text-blue-700">{dialogMode === "edit" ? "Perbarui" : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Ruang Ujian"
        description="Apakah Anda yakin ingin menghapus ruang ujian ini? Data absensi/attempts akan hilang."
        itemName="Ruang ujian ini"
        isLoading={isDeleting}
      />

      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent className="max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle>Tambah Batas Toleransi</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tambahkan extra toleransi pelanggaran/kecurangan untuk Siswa ini (dalam angka):
            </p>
            <Input
              type="number"
              value={limitValue}
              onChange={(e) => setLimitValue(e.target.value)}
              min="1"
              placeholder="Contoh: 1"
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>
          <DialogFooter className="flex w-full gap-2">
            <Button variant="outline" className="flex-1 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setLimitDialogOpen(false)}>Batal</Button>
            <Button className="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/20 font-semibold" onClick={handleConfirmAddLimit}>Tambahkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monitoring Dialog */}
      <Dialog open={isMonitorOpen} onOpenChange={setIsMonitorOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-6xl w-full bg-card max-h-[95vh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 border-slate-200/50 dark:border-slate-800/40">
            <div className="flex flex-col gap-1">
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-slow shrink-0"></span>
                <span className="truncate">Monitor Ujian: {monitorRoom?.room_name || "Ruang Tanpa Nama"} — <span className="text-slate-500 font-normal">{monitorRoom?.examTitle}</span></span>
              </DialogTitle>
              <div className="flex items-center gap-1.5 pl-4">
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/50 dark:border-emerald-800/50">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">Live Sync Connected</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/60 px-2 py-1 rounded-xl border border-slate-200/60 dark:border-slate-800/40">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-mono font-bold">
                  {Math.floor(monitorTimeLeft / 60).toString().padStart(2, '0')}:{(monitorTimeLeft % 60).toString().padStart(2, '0')}
                </span>
                <Button
                  onClick={() => {
                    setIsMonitorRefreshing(true);
                    handleManualRefreshMonitor();
                    setTimeout(() => setIsMonitorRefreshing(false), 600);
                  }}
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 p-0 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100"
                >
                  <RefreshCw className={`h-3 w-3 ${isMonitorRefreshing ? "animate-spin text-blue-500" : ""}`} />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-slate-500">Kelas: {monitorRoom?.className}</p>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {(monitorRoom?.allClasses || (monitorRoom?.classId && monitorRoom.classId.includes(","))) && (
                <>
                  <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs">Filter Kelas:</span>
                  <select
                    value={monitorClassFilter}
                    onChange={(e) => {
                      setMonitorClassFilter(e.target.value);
                      setMonitorPage(1);
                    }}
                    className="h-8 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-card px-2 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700"
                  >
                    <option value="all">Semua Terdaftar</option>
                    {examClasses
                      .filter(c => {
                        if (monitorRoom?.allClasses) return true;
                        if (!monitorRoom?.classId) return false;
                        const rawIds = monitorRoom.classId;
                        const ids = Array.isArray(rawIds) ? rawIds : String(rawIds || "").split(",").map(id => id.trim()).filter(Boolean);
                        return ids.includes(c.id);
                      })
                      .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                    }
                  </select>
                </>
              )}
              <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs ml-2">Urutkan:</span>
              <select
                value={monitorSortBy}
                onChange={(e) => {
                  setMonitorSortBy(e.target.value as any);
                  setMonitorPage(1);
                }}
                className="h-8 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-card px-2 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700"
              >
                <option value="default">Default (Absen)</option>
                <option value="nama">Abjad Nama (A-Z)</option>
                <option value="nilai">Nilai Tertinggi</option>
                <option value="login">Waktu Login Terbaru</option>
              </select>


              <Button onClick={handleExportExcel} size="sm" variant="outline" className="h-7 text-xs border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/50 flex items-center gap-1 rounded-lg shadow-sm">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
              </Button>
              {(role === "admin" || monitorRoom?.examTeacherId === teacherId) && (
                <Button onClick={handleForceSubmitAll} size="sm" variant="outline" className="h-7 text-xs border-orange-200 dark:border-orange-800/40 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/50 flex items-center gap-1 rounded-lg shadow-sm">
                  <Users className="h-3.5 w-3.5" /> Selesaikan Semua
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mb-2 px-1">
            <div className="text-[11px] text-slate-500">
              {(() => {
                const filtered = students.filter(s => {
                  if (monitorRoom?.allClasses) {
                    if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                    return true;
                  }
                  if (!monitorRoom?.classId) return false;

                  const rawIds = monitorRoom.classId;
                  const allowedIds = Array.isArray(rawIds)
                    ? rawIds
                    : String(rawIds || "").split(",").map(id => id.trim()).filter(Boolean);

                  if (!allowedIds.includes(s.classId)) return false;
                  if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                  return true;
                });

                const count = filtered.length;
                const start = Math.min((monitorPage - 1) * monitorPageSize + 1, count);
                const end = Math.min(monitorPage * monitorPageSize, count);

                return `Menampilkan ${start} - ${end} dari ${count} Siswa`;
              })()}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Baris:</span>
              <select
                value={monitorPageSize}
                onChange={(e) => {
                  setMonitorPageSize(Number(e.target.value));
                  setMonitorPage(1);
                }}
                className="p-1 text-[11px] border rounded bg-card"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="rounded-md border bg-card shadow-sm flex flex-col overflow-hidden">
            {/* Desktop View */}
            <div className="hidden md:block overflow-auto max-h-[65vh] scrollbar-thin">
              <Table>
                <TableHeader className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-sm">
                  <TableRow className="hover:bg-transparent border-b bg-slate-50 dark:bg-slate-900 dark:border-slate-800">
                    <TableHead className="w-12 text-center sticky top-0 bg-slate-50 dark:bg-slate-900 z-20">No</TableHead>
                    <TableHead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-20">NISN</TableHead>
                    <TableHead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-20">Nama Siswa</TableHead>
                    <TableHead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-20">Kelas</TableHead>
                    <TableHead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-20">Login</TableHead>
                    <TableHead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-20">Status</TableHead>
                    <TableHead className="text-center sticky top-0 bg-slate-50 dark:bg-slate-900 z-20">Nilai</TableHead>
                    <TableHead className="text-center sticky top-0 bg-slate-50 dark:bg-slate-900 z-20">Prog.</TableHead>
                    <TableHead className="text-center sticky top-0 bg-slate-50 dark:bg-slate-900 z-20">Warn</TableHead>
                    <TableHead className="text-right sticky top-0 bg-slate-50 dark:bg-slate-900 z-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const filtered = students
                      .filter((s) => {
                        if (monitorRoom?.allClasses) {
                          if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                          return true;
                        }
                        if (!monitorRoom?.classId) return false;

                        const rawIds = monitorRoom.classId;
                        const allowedIds = Array.isArray(rawIds)
                          ? rawIds
                          : String(rawIds || "").split(",").map(id => id.trim()).filter(Boolean);

                        if (!allowedIds.includes(s.classId)) return false;
                        if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                        return true;
                      })
                      .sort((a, b) => {
                        const attA = attempts.find((at) => at.studentId === a.id);
                        const attB = attempts.find((at) => at.studentId === b.id);
                        if (monitorSortBy === "nilai") return (attB?.score || 0) - (attA?.score || 0);
                        if (monitorSortBy === "login") {
                          const timeA = attA?.startTime ? new Date(attA.startTime).getTime() : 0;
                          const timeB = attB?.startTime ? new Date(attB.startTime).getTime() : 0;
                          return timeB - timeA;
                        }
                        if (monitorSortBy === "nama") return a.name.localeCompare(b.name);
                        return 0;
                      });

                    const startIndex = (monitorPage - 1) * monitorPageSize;
                    const currentData = filtered.slice(startIndex, startIndex + monitorPageSize);

                    if (currentData.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={10} className="h-24 text-center text-slate-400">
                            Tidak ada Siswa ditemukan.
                          </TableCell>
                        </TableRow>
                      );
                    }

                    const dataRows = currentData.map((student, localIndex) => {
                      const index = startIndex + localIndex;
                      // Ambil pengerjaan TERBARU (terakhir dibuat) jika ada duplikat
                      const studentAttempts = attempts.filter((a) => (a.studentId === student.id) || (a.student_id === student.id));
                      const attempt = studentAttempts.sort((ax, bx) => {
                        const diff = new Date(bx.created || 0).getTime() - new Date(ax.created || 0).getTime();
                        return diff !== 0 ? diff : bx.id.localeCompare(ax.id);
                      })[0];
                      const sisAnswers = answersList[student.id] || {};
                      const answeredCount = Object.keys(sisAnswers).length;
                      
                      if (attempt && attempt.overrides) {
                        console.log(`Overrides for ${student.name}:`, attempt.overrides);
                      }

                      let statusLabel = <span className="text-slate-400 italic text-[10px]">Belum Masuk</span>;
                      if (attempt) {
                        const status = attempt.status || (attempt as any).status;
                        if (status === "finished") {
                          statusLabel = <span className="text-green-600 font-semibold px-2 py-0.5 bg-green-50 rounded-full border border-green-100">Selesai</span>;
                        } else if (status === "LOCKED") {
                          statusLabel = <span className="text-red-500 font-bold px-2 py-0.5 bg-red-50 rounded-full border border-red-100 italic text-[10px]">TERKUNCI</span>;
                        } else {
                          const lastHeartbeat = attempt.lastHeartbeat || (attempt as any).last_heartbeat || null;
                          const lastH = lastHeartbeat ? new Date(lastHeartbeat).getTime() : 0;
                          const isOnline = (attempt.isOnline || (attempt as any).is_online) === true;
                          const isTrulyOnline = isOnline && (Date.now() - lastH < 120000);

                          statusLabel = (
                            <span className={`font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap text-[10px] ${isTrulyOnline ? "text-amber-600 bg-amber-50 border-amber-100 animate-pulse" : "text-slate-500 bg-slate-50 border-slate-100"}`}>
                              Ujian ({isTrulyOnline ? "Online" : "Offline"})
                            </span>
                          );
                        }
                      }

                      const sTime = attempt?.startTime || (attempt as any)?.start_time || attempt?.created || null;
                      const loginTime = sTime ? new Date(sTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-";

                      return (
                        <React.Fragment key={student.id}>
                          <TableRow className="group transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/40">
                            <TableCell className="text-center text-slate-400 font-medium">{index + 1}</TableCell>
                            <TableCell className="font-mono text-[11px] text-slate-500">{student.nisn}</TableCell>
                            <TableCell className="font-semibold text-slate-700 dark:text-slate-200">{student.name}</TableCell>
                            <TableCell className="text-xs font-semibold text-slate-500">{examClasses.find(c => c.id === student.classId)?.name || "-"}</TableCell>
                            <TableCell className="text-slate-500 tabular-nums">{loginTime}</TableCell>
                            <TableCell>{statusLabel}</TableCell>
                            <TableCell className="text-center font-bold text-indigo-600 tabular-nums">
                              {(() => {
                                if (!attempt) return "-";
                                if (attempt.status === "finished") return attempt.score ?? 0;

                                // Live Calculate
                                let corrects = 0;
                                const monitorOverrides = attempt?.overrides || {};
                                monitorQuestions.forEach(q => {
                                  const ansId = sisAnswers[q.id];
                                  if (monitorOverrides[q.id] === true) {
                                    corrects++;
                                  } else if (ansId) {
                                    const type = q.type || "pilihan_ganda";
                                    if (type === "pilihan_ganda" || type === "benar_salah") {
                                      const choiceKey = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ansId).toLowerCase());
                                      if (choiceKey && q.choices[choiceKey].isCorrect === true) corrects++;
                                    }
                                  }
                                });
                                return monitorQuestions.length > 0 ? Math.round((corrects / monitorQuestions.length) * 100) : 0;
                              })()}
                            </TableCell>

                            <TableCell className="text-center text-xs text-slate-500 font-medium tabular-nums">{answeredCount}/{monitorQuestions.length}</TableCell>
                            <TableCell className="text-center">
                              {(() => {
                                const totalAllowed = (monitorRoom?.cheat_limit || 3) + (attempt?.extraCheatLimit || (attempt as any)?.extra_cheat_limit || 0);
                                const currentCount = attempt?.cheatCount !== undefined ? attempt.cheatCount : (attempt as any)?.cheat_count || 0;
                                return (
                                  <span className={`font-bold tabular-nums text-[11px] ${currentCount > 0 ? "text-red-500" : "text-slate-400"}`}>
                                    {currentCount} / {totalAllowed}
                                  </span>
                                )
                              })()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5 items-center whitespace-nowrap">
                                {attempt && (
                                  <>
                                    {/* 1. Logs & Reset Cheat tetap Standalone */}
                                    {(role === "admin" || monitorRoom?.examTeacherId === teacherId) && (
                                      <Button size="sm" variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 dark:border-amber-800/40 h-7 text-[10px]" onClick={() => handleResetCheatCount(attempt.id)}>Reset Cheat</Button>
                                    )}

                                    <Button size="sm" variant="secondary" className="bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100 dark:bg-sky-900/30 dark:text-sky-400 dark:hover:bg-sky-900/50 dark:border-sky-800/40 h-7 text-[10px]" onClick={() => setExpandedstudent(expandedstudent === student.id ? null : student.id)}>
                                      {expandedstudent === student.id ? "Tutup" : "Logs"}
                                    </Button>

                                    {/* 2. Tombol Lainnya masuk ke Dropdown Menu */}
                                    {(role === "admin" || monitorRoom?.examTeacherId === teacherId) && (
                                      <div className="relative">
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          className="h-7 px-2 text-[10px] bg-slate-100/80 text-slate-700 hover:bg-slate-200 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/80 dark:border-slate-700/60 font-medium flex items-center gap-1 rounded-md shadow-sm transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuId(openMenuId === student.id ? null : student.id);
                                          }}
                                        >
                                          Menu
                                          <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                                        </Button>

                                        {openMenuId === student.id && (
                                          <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 py-1 overflow-hidden">
                                            {attempt?.status === "LOCKED" && (
                                              <button onClick={(e) => { e.stopPropagation(); handleUnlockStudent(attempt.id); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-700/60">
                                                <Lock className="w-3.5 h-3.5 opacity-80" /> Buka Kunci
                                              </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); openLimitDialog(student.id); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                              <Plus className="w-3.5 h-3.5 opacity-70 text-slate-400" /> + Limit
                                            </button>
                                            {attempt?.status !== "finished" && (
                                              <button onClick={(e) => { e.stopPropagation(); handleForceSubmitStudent(attempt.id); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-700/60">
                                                <Square className="w-3.5 h-3.5 opacity-70 fill-current" /> Selesaikan
                                              </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); handleResetSession(attempt.id, student.id, monitorRoom?.id || ""); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                              <RefreshCw className="w-3.5 h-3.5 opacity-70 text-rose-400" /> Reset Sesi
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedstudent === student.id && (
                            <TableRow className="bg-slate-50/30 dark:bg-slate-800/30 border-l-2 border-l-indigo-500">
                              <TableCell colSpan={10} className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="h-1 w-1 rounded-full bg-indigo-500"></div>
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Detail Jawaban & Sesi</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                                  {monitorQuestions.map((q, qIdx) => {
                                    const ansId = sisAnswers[q.id];
                                    const monitorOverrides = attempt?.overrides || {};

                                    const isCorrect = (() => {
                                      if (monitorOverrides[q.id] !== undefined) return monitorOverrides[q.id];

                                      if (!ansId) return false;
                                      const type = q.type || "pilihan_ganda";

                                      if (type === "pilihan_ganda" || type === "benar_salah") {
                                        const choiceKey = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ansId).toLowerCase());
                                        return choiceKey ? q.choices[choiceKey].isCorrect === true : false;
                                      } else if (type === "pilihan_ganda_kompleks") {
                                        const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect);
                                        const studentKeys = Array.isArray(ansId) ? ansId.map(k => String(k).toLowerCase()) : [];
                                        const lowerCorrect = correctKeys.map(k => k.toLowerCase());
                                        return studentKeys.length === lowerCorrect.length && studentKeys.every(k => lowerCorrect.includes(k));
                                      } else if (type === "isian_singkat") {
                                        return isFuzzyMatch(ansId, q.answerKey);
                                      } else if (type === "urutkan" || type === "drag_drop") {
                                        const correctOrder = (q.items || []).map((it: any) => it.id);
                                        return Array.isArray(ansId) && ansId.length === correctOrder.length && ansId.every((val, idx) => val === correctOrder[idx]);
                                      } else if (type === "menjodohkan") {
                                        const pairs = q.pairs || [];
                                        return pairs.length > 0 && pairs.every((p: any) => ansId[p.id] === p.right);
                                      }
                                      return false;
                                    })();

                                    // 📸 Ekstrak Semua Gambar dari Teks & Cover (untuk ditaruh di bawah)
                                    const extractedImages: string[] = [];
                                    if (q.imageUrl) extractedImages.push(q.imageUrl);
                                    if (q.text && q.text.includes("<img")) {
                                      const doc = new DOMParser().parseFromString(q.text, "text/html");
                                      doc.querySelectorAll("img").forEach(img => {
                                        const src = img.getAttribute("src");
                                        if (src) extractedImages.push(src);
                                      });
                                    }

                                    return (
                                      <div key={q.id} className="bg-card p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-[0_2px_4px_rgba(0,0,0,0.02)] flex flex-col gap-2">
                                        <div className="flex flex-col gap-1.5 flex-1">
                                          <div className="flex gap-2">
                                            <span className="text-slate-400 font-bold shrink-0 text-xs">#{qIdx + 1}</span>
                                            <div
                                              className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed [&_img]:hidden"
                                              dangerouslySetInnerHTML={{ __html: q.text }}
                                            />
                                          </div>

                                          {extractedImages.length > 0 && (
                                            <div className="flex items-center gap-1 mt-1 flex-wrap pl-6">
                                              {extractedImages.map((src, idx) => (
                                                <img
                                                  key={idx}
                                                  src={src}
                                                  className="max-w-[45px] max-h-[45px] object-cover rounded-md cursor-pointer hover:opacity-80 border border-slate-200 dark:border-slate-700 shadow-sm"
                                                  onClick={() => setPreviewImage(src)}
                                                />
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <div className={`mt-auto p-2 rounded-lg flex items-center justify-between transition-colors ${isCorrect ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/40" : ansId ? "bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800/40" : "bg-slate-50 text-slate-400 border border-slate-100 dark:bg-slate-800/60 dark:text-slate-500 dark:border-slate-700"}`}>
                                          <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold opacity-70">Jawaban</span>
                                            <span className="text-xs font-bold leading-none">
                                              {(() => {
                                                if (!ansId) return "Kosong";
                                                const type = q.type || "pilihan_ganda";
                                                if (typeof ansId === 'string' && (type === "pilihan_ganda" || type === "benar_salah")) {
                                                  const choiceKey = Object.keys(q.choices || {}).find(k => k.toLowerCase() === ansId.toLowerCase());
                                                  const choice = choiceKey ? q.choices[choiceKey] : null;
                                                  if (choice) {
                                                    const plainText = choice.text.replace(/<[^>]*>/g, '');
                                                    return `${ansId.toUpperCase()}. ${plainText}`;
                                                  }
                                                }
                                                if (type === "pilihan_ganda_kompleks" && Array.isArray(ansId)) {
                                                  return ansId.map(id => id.toUpperCase()).join(", ");
                                                }
                                                return typeof ansId === 'string' ? ansId.toUpperCase() : "DIJAWAB";
                                              })()}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            {ansId && (
                                              <>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className={`h-7 w-7 rounded-lg transition-all ${isCorrect && monitorOverrides[q.id] === true ? "bg-emerald-500 text-white shadow-md" : "hover:bg-emerald-50 text-slate-300 hover:text-emerald-600"}`}
                                                  onClick={() => handleManualGrade(student.id, q.id, true)}
                                                  title="Paksa Benar"
                                                >
                                                  <CheckCircle2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className={`h-7 w-7 rounded-lg transition-all ${!isCorrect && monitorOverrides[q.id] === false ? "bg-rose-500 text-white shadow-md" : "hover:bg-rose-50 text-slate-300 hover:text-rose-600"}`}
                                                  onClick={() => handleManualGrade(student.id, q.id, false)}
                                                  title="Paksa Salah"
                                                >
                                                  <X className="w-4 h-4" />
                                                </Button>
                                              </>
                                            )}
                                            {ansId && (
                                              <div className={`px-2 py-1 rounded-md text-[10px] font-bold shadow-sm border ${isCorrect ? "bg-emerald-100/50 border-emerald-200/50 text-emerald-700" : "bg-rose-100/50 border-rose-200/50 text-rose-700"}`}>
                                                {isCorrect ? "BENAR" : "SALAH"}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    });

                    // 💡 Tambah Baris Kosong agar tampilan tetap rapi (selalu 10 baris/sesuai PageSize)
                    const emptyRowsCount = Math.max(0, monitorPageSize - currentData.length);
                    const emptyRows = Array.from({ length: emptyRowsCount }).map((_, i) => (
                      <TableRow key={`empty-${i}`} className="h-14 border-b border-slate-50/50 dark:border-slate-800/10">
                        <TableCell colSpan={10} />
                      </TableRow>
                    ));

                    return [...dataRows, ...emptyRows];
                  })()}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4 p-4 bg-slate-50/30 dark:bg-slate-900/30 overflow-y-auto max-h-[65vh]">
              {(() => {
                const filtered = students
                  .filter((s) => {
                    if (monitorRoom?.allClasses) {
                      if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                      return true;
                    }
                    if (!monitorRoom?.classId) return false;

                    const rawIds = monitorRoom.classId;
                    const allowedIds = Array.isArray(rawIds)
                      ? rawIds
                      : String(rawIds || "").split(",").map(id => id.trim()).filter(Boolean);

                    if (!allowedIds.includes(s.classId)) return false;
                    if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                    return true;
                  })
                  .sort((a, b) => {
                    const attA = attempts.find((at) => at.id === a.nisn);
                    const attB = attempts.find((at) => at.id === b.nisn);
                    if (monitorSortBy === "nilai") return (attB?.score || 0) - (attA?.score || 0);
                    if (monitorSortBy === "login") return (attB?.startTime || 0) - (attA?.startTime || 0);
                    if (monitorSortBy === "nama") return a.name.localeCompare(b.name);
                    return 0;
                  });

                const startIndex = (monitorPage - 1) * monitorPageSize;
                const currentData = filtered.slice(startIndex, startIndex + monitorPageSize);

                if (currentData.length === 0) return <div className="text-center p-8 text-slate-400 text-sm">Tidak ada Siswa ditemukan.</div>;

                return currentData.map((student, localIndex) => {
                  const studentAttempts = attempts.filter((a) => (a.studentId === student.id) || ((a as any).student_id === student.id));
                  const attempt = studentAttempts.sort((ax, bx) => {
                    const diff = new Date(bx.created || 0).getTime() - new Date(ax.created || 0).getTime();
                    return diff !== 0 ? diff : bx.id.localeCompare(ax.id);
                  })[0];
                  const sisAnswers = answersList[student.id] || {};

                  const lastH = attempt?.lastHeartbeat ? new Date(attempt.lastHeartbeat).getTime() : 0;
                  const isTrulyOnline = attempt?.isOnline && (Date.now() - lastH < 60000);

                  const status = attempt ? (attempt.status === "submitted" ? "Selesai" : attempt.status === "LOCKED" ? "Terkunci" : `Ujian (${isTrulyOnline ? "Online" : "Offline"})`) : "Belum Masuk";
                  const statusColor = attempt ? (attempt.status === "submitted" ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900" : attempt.status === "LOCKED" ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900" : isTrulyOnline ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900 animate-pulse" : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700") : "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700";

                  return (
                    <div key={student.id} className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm relative overflow-hidden">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-vibrant">#{startIndex + localIndex + 1} • {student.nisn}</p>
                          <h4 className="font-bold text-slate-800 leading-tight">{student.name}</h4>
                          <p className="text-xs font-semibold text-slate-500 bg-slate-100 inline-block px-2 py-0.5 rounded-md">{examClasses.find(c => c.id === student.classId)?.name}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${statusColor}`}>{status.toUpperCase()}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 dark:border-slate-800">
                        <div className="text-center">
                          <p className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Nilai</p>
                          <p className="text-sm font-bold text-indigo-600 tabular-nums">{attempt?.score ?? "-"}</p>
                        </div>
                        <div className="text-center border-x border-slate-100">
                          <p className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Prog.</p>
                          <p className="text-sm font-bold text-slate-700 tabular-nums">{Object.keys(sisAnswers).length}/{monitorQuestions.length}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Warn</p>
                          <p className="text-sm font-bold text-rose-500 tabular-nums">
                            {attempt?.cheatCount || 0} / {(monitorRoom?.cheat_limit || 3) + (attempt?.extraCheatLimit || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2 pt-1">
                        {attempt && (role === "admin" || monitorRoom?.examTeacherId === teacherId) && (
                          <>
                            {attempt.status === "LOCKED" && (
                              <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-green-200 text-green-700 hover:bg-green-50 rounded-xl px-3" onClick={() => handleUnlockStudent(attempt.id)}>Unlock</Button>
                            )}
                            <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl px-3" onClick={() => handleResetSession(attempt.id, student.id, monitorRoom?.id || "")}>Reset</Button>
                            {attempt.status !== "submitted" && (
                              <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-amber-200 text-amber-700 hover:bg-amber-50 rounded-xl px-3" onClick={() => handleForceSubmitStudent(attempt.id)}>Submit</Button>
                            )}
                            <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl px-3" onClick={() => openLimitDialog(student.id)}>+ Limit</Button>
                          </>
                        )}
                        <Button size="sm" variant="secondary" className="h-8 text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl px-3" onClick={() => setExpandedstudent(expandedstudent === student.id ? null : student.id)}>
                          {expandedstudent === student.id ? "Tutup" : "Details"}
                        </Button>
                      </div>

                      {expandedstudent === student.id && (
                        <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl space-y-2 p-2">
                          {monitorQuestions.map((q, qIdx) => {
                            const ansId = sisAnswers[q.id];
                            const monitorOverrides = attempt?.overrides || {};

                            const isCorrect = (() => {
                              // 🛡️ OVERRIDE DULU
                              if (monitorOverrides[q.id] !== undefined) return monitorOverrides[q.id];

                              if (!ansId) return false;
                              const type = q.type || "pilihan_ganda";

                              if (type === "pilihan_ganda" || type === "benar_salah") {
                                return q.choices?.[ansId]?.isCorrect === true;
                              } else if (type === "pilihan_ganda_kompleks") {
                                const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect);
                                return Array.isArray(ansId) && ansId.length === correctKeys.length && ansId.every(k => correctKeys.includes(k));
                              } else if (type === "isian_singkat") {
                                return isFuzzyMatch(ansId, q.answerKey);
                              } else if (type === "urutkan" || type === "drag_drop") {
                                const correctOrder = (q.items || []).map((it: any) => it.id);
                                return Array.isArray(ansId) && ansId.length === correctOrder.length && ansId.every((val, idx) => val === correctOrder[idx]);
                              } else if (type === "menjodohkan") {
                                const pairs = q.pairs || [];
                                return pairs.length > 0 && pairs.every((p: any) => ansId[p.id] === p.right);
                              }
                              return false;
                            })();
                            return (
                              <div key={q.id} className="bg-card p-3 rounded-xl border border-slate-200 text-[11px] shadow-sm">
                                <div className="flex gap-2 mb-2">
                                  <span className="font-bold text-slate-400 shrink-0">#{qIdx + 1}</span>
                                  <div className="text-slate-700 leading-snug font-medium" dangerouslySetInnerHTML={{ __html: q.text }} />
                                </div>
                                <div className={`p-2 rounded-lg flex justify-between items-center ${isCorrect ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : ansId ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-slate-50 text-slate-400"}`}>
                                  <div className="flex flex-col">
                                    <span className="font-bold">
                                      Jawaban: {(() => {
                                        if (!ansId) return "KOSONG";
                                        const type = q.type || "pilihan_ganda";
                                        if (typeof ansId === 'string' && (type === "pilihan_ganda" || type === "benar_salah")) {
                                          const choice = q.choices?.[ansId];
                                          if (choice) {
                                            const plainText = choice.text.replace(/<[^>]*>/g, '');
                                            return `${ansId.toUpperCase()}. ${plainText}`;
                                          }
                                        }
                                        if (type === "pilihan_ganda_kompleks" && Array.isArray(ansId)) {
                                          return ansId.map(id => id.toUpperCase()).join(", ");
                                        }
                                        return typeof ansId === 'string' ? ansId.toUpperCase() : "DIJAWAB";
                                      })()}
                                    </span>
                                    <div className="flex gap-2 mt-1">
                                      <button onClick={() => handleManualGrade(student.id, q.id, true)} className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${isCorrect && monitorOverrides[q.id] === true ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"}`}>Jadi Benar</button>
                                      <button onClick={() => handleManualGrade(student.id, q.id, false)} className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${!isCorrect && monitorOverrides[q.id] === false ? "bg-rose-600 text-white border-rose-600" : "bg-white text-rose-600 border-rose-200 hover:bg-rose-50"}`}>Jadi Salah</button>
                                    </div>
                                  </div>
                                  {ansId && <span className="text-[10px] font-black">{isCorrect ? "✓ BENAR" : "✗ SALAH"}</span>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* Pagination Controls */}
          {(() => {
            const filtered = students.filter((s) => {
              if (monitorRoom?.allClasses) {
                if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                return true;
              }
              if (!monitorRoom?.classId) return false;
              const rawIds = monitorRoom.classId;
              const allowedIds = Array.isArray(rawIds)
                ? rawIds
                : String(rawIds || "").split(",").map(id => id.trim()).filter(Boolean);
              if (!allowedIds.includes(s.classId)) return false;
              if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
              return true;
            });
            const totalPages = Math.ceil(filtered.length / monitorPageSize);
            if (totalPages <= 1) return null;

            return (
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-6 bg-slate-100/30 dark:bg-slate-800/50 p-3 sm:p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-card px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
                  Menampilkan {Math.min((monitorPage - 1) * monitorPageSize + 1, filtered.length)} - {Math.min(monitorPage * monitorPageSize, filtered.length)} dari {filtered.length} Siswa
                </div>
                <div className="flex items-center gap-1.5 bg-card p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <Button variant="ghost" size="sm" onClick={() => setMonitorPage(1)} disabled={monitorPage === 1} className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30">
                    <span className="sr-only">First</span>
                    {"<<"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setMonitorPage(prev => Math.max(1, prev - 1))} disabled={monitorPage === 1} className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30">
                    <span className="sr-only">Previous</span>
                    {"<"}
                  </Button>

                  <div className="flex items-center gap-2 px-3 h-8 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-inner dark:border-slate-700 shadow-inner">
                    <span className="text-[10px] uppercase font-black text-slate-400">Hal</span>
                    <input
                      type="number"
                      className="w-8 text-center text-xs font-black bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-slate-800 dark:text-slate-100"
                      value={monitorPage}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        if (v >= 1 && v <= totalPages) setMonitorPage(v);
                      }}
                    />
                    <span className="text-[10px] font-bold text-slate-300">/ {totalPages}</span>
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => setMonitorPage(prev => Math.min(totalPages, prev + 1))} disabled={monitorPage === totalPages} className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30">
                    <span className="sr-only">Next</span>
                    {">"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setMonitorPage(totalPages)} disabled={monitorPage === totalPages} className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30">
                    <span className="sr-only">Last</span>
                    {">>"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog Preview Gambar Zoom Logs */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-xl bg-transparent border-none p-0 flex items-center justify-center pointer-events-auto z-50">
          {previewImage && (
            <img
              src={previewImage}
              alt="Pratinjau Zoom"
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-slate-800/20"
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={async () => {
          await confirmDialog.onConfirm();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }}
        title={confirmDialog.title}
        description={confirmDialog.description}
        type={confirmDialog.type}
        confirmLabel={confirmDialog.confirmLabel}
      />
    </div>
  );
};

export default ExamRoomsPage;


