import { useState, useEffect } from "react";
import { Plus, Trash, Edit, RefreshCw, Users, Archive, RotateCw, FileSpreadsheet, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx-js-style";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { DeleteConfirmationDialog } from "../../components/ui/delete-confirmation-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ref, onValue, push, update, remove, get } from "firebase/database";
import { database } from "../../lib/firebase";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { usePiket } from "../../context/PiketContext";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";

import { DataTable } from "../../components/ui/data-table";

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
  token_updated_at?: number;
  status?: "archive" | null; // <--- Status Arsip
}

const ExamRoomsPage = () => {
  const navigate = useNavigate();
  const { classes: piketClasses, students } = usePiket();
  const [rooms, setRooms] = useState<ExamRoomData[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"aktif" | "arsip">("aktif"); // <--- Active tab filter
  const [showAdvanced, setShowAdvanced] = useState(false); // <--- Advanced settings dialog collapsible

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedRoom, setSelectedRoom] = useState<ExamRoomData | null>(null);

  const [formValues, setFormValues] = useState({
    examId: "",
    classId: "all", // "all" or specific classId
    allClasses: true,
    token: "",
    start_time: "",
    end_time: "",
    duration: 60,
    cheat_limit: 3,
    submit_window: 10, // Default 10 mnt
    room_code: "",
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
    onConfirm: () => {}
  });

  // Monitoring States
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [monitorRoom, setMonitorRoom] = useState<ExamRoomData | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [monitorQuestions, setMonitorQuestions] = useState<any[]>([]);
  const [expandedSiswa, setExpandedSiswa] = useState<string | null>(null); // NISN
  const [answersList, setAnswersList] = useState<Record<string, any>>({}); // { nisn: answers }
  const [monitorSortBy, setMonitorSortBy] = useState<"default" | "nilai" | "login" | "nama">("default");
  const [monitorClassFilter, setMonitorClassFilter] = useState<string>("all");

  const [universalToken, setUniversalToken] = useState("");

  useEffect(() => {
    return onValue(ref(database, "settings/universal_token"), (snap) => {
      setUniversalToken(snap.exists() ? snap.val() : "");
    });
  }, []);

  const handleRefreshToken = async () => {
    try {
      const newToken = generateNewToken();
      await update(ref(database, "settings"), {
        universal_token: newToken,
        universal_token_updated_at: Date.now()
      });
    } catch (e) {
      showAlert("Gagal", "Gagal memperbarui token universal.", "danger");
    }
  };

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info") => {
    setConfirmDialog({
      isOpen: true,
      title,
      description,
      type,
      confirmLabel: "OK",
      onConfirm: () => {}
    });
  };

  const columns = [
    {
      key: "index",
      label: "No",
      render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
    },
    {
      key: "examTitle",
      label: "Ujian",
      sortable: true,
      render: (v: string) => <span className="font-medium text-slate-800 dark:text-slate-100">{v}</span>
    },
    {
      key: "className",
      label: "Kelas",
      sortable: true,
    },
    {
      key: "duration",
      label: "Durasi",
      render: (v: number) => <span className="text-slate-500 font-medium">{v} Menit</span>
    },
    {
      key: "start_time",
      label: "Waktu Mulai - Selesai",
      render: (v: any, item: ExamRoomData) => (
        <span className="text-slate-500 text-xs">
           {new Date(item.start_time).toLocaleDateString("id-ID")} {new Date(item.start_time).toLocaleTimeString("id-ID", {hour:'2-digit', minute:'2-digit'})} 
           <span className="mx-1">-</span>
           {new Date(item.end_time).toLocaleTimeString("id-ID", {hour:'2-digit', minute:'2-digit'})}
        </span>
      )
    }
  ];

  const handleArchiveRoom = (room: ExamRoomData) => {
    setConfirmDialog({
      isOpen: true,
      title: "Arsipkan Ruang Ujian",
      description: `Apakah Anda yakin ingin mengarsipkan ruang ujian ${room.examTitle || ""}?`,
      type: "warning",
      confirmLabel: "Arsipkan",
      onConfirm: async () => {
        try {
          await update(ref(database, `exam_rooms/${room.id}`), { status: "archive" });
        } catch (error) { 
          showAlert("Gagal", "Gagal mengarsipkan ruang ujian.", "danger");
        }
      }
    });
  };

  const handleRestoreRoom = (room: ExamRoomData) => {
    setConfirmDialog({
      isOpen: true,
      title: "Buka Ruang Ujian",
      description: `Apakah Anda yakin ingin membuka/mengaktifkan kembali ruang ujian ${room.examTitle || ""}?`,
      type: "info",
      confirmLabel: "Buka Ruang",
      onConfirm: async () => {
        try {
          await update(ref(database, `exam_rooms/${room.id}`), { status: null });
        } catch (error) { 
          showAlert("Gagal", "Gagal membuka arsip ruang ujian.", "danger");
        }
      }
    });
  };

  const handleExportExcel = () => {
    if (!monitorRoom) return;

    const workbook = XLSX.utils.book_new();
    const header = ["No", "NISN", "Nama Siswa", "Kelas", "Jam Login", "Jam Submit", "Cheat Count", "Benar", "Salah", "Nilai"];
    monitorQuestions.forEach((q, idx) => header.push(`Soal ${idx + 1}`));

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "16A34A" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "E2E8F0" } },
        bottom: { style: "thin", color: { rgb: "E2E8F0" } }
      }
    };

    const colsWidths = [
      { wch: 4 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 7 }, { wch: 7 }, { wch: 7 }
    ];
    monitorQuestions.forEach(() => colsWidths.push({ wch: 8 }));

    const generateRowData = (att: any, idx: number) => {
      const siswa = students.find((s) => String(s.nisn).trim() === String(att.nisn).trim());
      const sisAnswers = answersList[att.nisn] || {};
      const kelasObj = piketClasses.find(c => c.id === (siswa ? siswa.classId : ""));
      const className = kelasObj ? kelasObj.name : "-";

      let correct = 0;
      let wrong = 0;
      monitorQuestions.forEach((q) => {
        const ans = sisAnswers[q.id];
        if (ans && q.choices[ans]?.isCorrect === true) correct++;
        else if (ans) wrong++;
      });
      const score = monitorQuestions.length > 0 ? (correct / monitorQuestions.length) * 100 : 0;

      const row = [
        idx + 1, att.nisn, siswa ? siswa.name : "N/A", className,
        att.startTime ? new Date(att.startTime).toLocaleTimeString("id-ID") : "-",
        att.submit_time ? new Date(att.submit_time).toLocaleTimeString("id-ID") : (att.status === "submitted" ? "Selesai" : "-"),
        att.cheatCount || 0, correct, wrong, score.toFixed(1)
      ];
      monitorQuestions.forEach((q) => {
        const ans = sisAnswers[q.id];
        row.push(ans ? ans.toUpperCase() : "-");
      });
      return row;
    };

    const applyStyles = (ws: XLSX.WorkSheet, rowsCount: number, atts: any[]) => {
      // Style header
      for (let c = 0; c < header.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c: c });
        if (ws[addr]) (ws[addr] as any).s = headerStyle;
      }
      // Style wrong answers
      atts.forEach((att: any, rIdx: number) => {
        const sisAnswers = answersList[att.nisn] || {};
        monitorQuestions.forEach((q, qIdx) => {
          const ans = sisAnswers[q.id];
          const isCorrect = ans && q.choices[ans]?.isCorrect === true;
          if (!isCorrect && ans) {
            const cellAddr = XLSX.utils.encode_cell({ r: rIdx + 1, c: 10 + qIdx });
            if (ws[cellAddr]) {
              (ws[cellAddr] as any).s = {
                fill: { patternType: "solid", fgColor: { rgb: "FCA5A5" } },
                font: { color: { rgb: "991B1B" } }
              };
            }
          }
        });
      });
      (ws as any)["!cols"] = colsWidths;
    };

    // 1. OVERALL SHEET
    const overallRows = attempts.map((att, idx) => generateRowData(att, idx));
    const wsOverall = XLSX.utils.aoa_to_sheet([header, ...overallRows]);
    applyStyles(wsOverall, overallRows.length, attempts);
    XLSX.utils.book_append_sheet(workbook, wsOverall, "Overall");

    // 2. PER-CLASS SHEETS
    // Get unique classes from attempts
    const classIdsInAttempts = Array.from(new Set(attempts.map(att => {
      const s = students.find(siswa => siswa.nisn === att.nisn);
      return s ? s.classId : null;
    }).filter(Boolean)));

    classIdsInAttempts.forEach(cId => {
      const classAttempts = attempts.filter(att => {
        const s = students.find(siswa => siswa.nisn === att.nisn);
        return s?.classId === cId;
      });
      const className = piketClasses.find(c => c.id === cId)?.name || "Lainnya";
      const classRows = classAttempts.map((att, idx) => generateRowData(att, idx));
      const wsClass = XLSX.utils.aoa_to_sheet([header, ...classRows]);
      applyStyles(wsClass, classRows.length, classAttempts);
      // Sheet name limit is 31 chars
      XLSX.utils.book_append_sheet(workbook, wsClass, className.substring(0, 31));
    });

    // 3. BELUM MENGERJAKAN SHEET
    const allowedIds = monitorRoom.allClasses ? [] : monitorRoom.classId ? monitorRoom.classId.split(",") : [];
    const classStudents = students.filter(s => monitorRoom.allClasses || allowedIds.includes(s.classId));
    const takenNisns = attempts.map(att => att.nisn);
    const notTakenStudents = classStudents.filter(s => !takenNisns.includes(s.nisn));

    const ntHeader = ["No", "NISN", "Nama Siswa", "Kelas", "Keterangan"];
    const ntRows = notTakenStudents.map((s, idx) => {
      const cObj = piketClasses.find(c => c.id === s.classId);
      return [idx + 1, s.nisn, s.name, cObj ? cObj.name : "-", "Belum Mengerjakan"];
    });
    const wsNT = XLSX.utils.aoa_to_sheet([ntHeader, ...ntRows]);
    for (let c = 0; c < ntHeader.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: c });
      if (wsNT[addr]) (wsNT[addr] as any).s = headerStyle;
    }
    (wsNT as any)["!cols"] = [{ wch: 4 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, wsNT, "Belum Mengerjakan");

    XLSX.writeFile(workbook, `Nilai_Ujian_${monitorRoom.examTitle || "Ruang"}.xlsx`);
  };



  const handleForceSubmitAll = () => {
    if (!monitorRoom) return;

    const ongoing = attempts.filter((att) => att.status === "ongoing");
    if (ongoing.length === 0) {
      setConfirmDialog({
        isOpen: true,
        title: "Sesi Aktif Kosong",
        description: "Tidak ada siswa yang sedang aktif mengerjakan ujian di ruangan ini saat ini.",
        type: "info",
        confirmLabel: "Ok",
        onConfirm: () => {}
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Selesaikan Paksa Sesi",
      description: `Tindakan ini akan mengakhiri paksa sesi ujian untuk ${ongoing.length} siswa yang sedang aktif. Anda yakin?`,
      type: "danger",
      confirmLabel: "Selesaikan",
      onConfirm: async () => {
        try {
          const updates: any = {};
          const now = Date.now();
          ongoing.forEach((att) => {
            updates[`attempts/${att.id}/status`] = "submitted";
            updates[`attempts/${att.id}/submit_time`] = now;
          });
          await update(ref(database), updates);
          showAlert("Berhasil", `${ongoing.length} siswa berhasil diselesaikan secara paksa.`, "success");
        } catch (error) {
          showAlert("Gagal", "Gagal menyelesaikan paksa ujian siswa.", "danger");
        }
      }
    });
  };

  const generateNewToken = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < 6; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  // 🔄 LOOP AUTO ROTATE TOKEN (Setiap 5 Menit)
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const globalTimeRef = ref(database, "settings/universal_token_updated_at");
        const snap = await get(globalTimeRef);
        const lastUpdated = snap.exists() ? snap.val() : Date.now();
        const now = Date.now();
        const diff = now - lastUpdated;

        if (diff > 5 * 60 * 1000) {
          const newToken = generateNewToken();
          await update(ref(database, "settings"), {
            universal_token: newToken,
            universal_token_updated_at: now
          });
          console.log(`[Universal Token rotated] -> ${newToken}`);
        }
      } catch (e) {
         console.error("Token rotate err", e);
      }
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!monitorRoom || !isMonitorOpen) return;
    
    // 1. Load Attempts (Throttled 5s)
    const attemptsRef = ref(database, "attempts");
    let attemptsThrottle = false;
    let latestAttempts: any = null;

    const processAttempts = (data: any) => {
      if (!data) { setAttempts([]); return; }
      const loaded = Object.keys(data)
        .filter((key) => key.includes(monitorRoom.id))
        .map((key) => {
           const [nisn] = key.split("_");
           return { id: key, nisn, ...data[key] };
        });
      setAttempts(loaded);
    };

    const unsubAttempts = onValue(attemptsRef, (snapshot) => {
      latestAttempts = snapshot.val();
      if (!attemptsThrottle) {
        processAttempts(latestAttempts);
        attemptsThrottle = true;
        setTimeout(() => {
          attemptsThrottle = false;
          if (latestAttempts) processAttempts(latestAttempts);
        }, 5000);
      }
    });

    // 2. Load Answers for details view (Throttled 5s)
    const answersRef = ref(database, "answers");
    let answersThrottle = false;
    let latestAnswers: any = null;

    const processAnswers = (data: any) => {
       if (!data) { setAnswersList({}); return; }
       const mapped: Record<string, any> = {};
       Object.keys(data).forEach((key) => {
          if (key.includes(monitorRoom.id)) {
             const nisn = key.split("_")[0];
             mapped[nisn] = data[key];
          }
       });
       setAnswersList(mapped);
    };

    const unsubAnswers = onValue(answersRef, (snapshot) => {
       latestAnswers = snapshot.val();
       if (!answersThrottle) {
         processAnswers(latestAnswers);
         answersThrottle = true;
         setTimeout(() => {
            answersThrottle = false;
            if (latestAnswers) processAnswers(latestAnswers);
         }, 5000);
       }
    });

    // 3. Load Questions of Exam
    get(ref(database, "questions")).then((snap) => {
       if (snap.exists()) {
          const data = snap.val();
          const loaded = Object.keys(data)
            .filter((id) => data[id].examId === monitorRoom.examId)
            .map((id) => ({ id, ...data[id] }));
          setMonitorQuestions(loaded);
       }
    });

    return () => {
      unsubAttempts();
      unsubAnswers();
    };
  }, [monitorRoom, isMonitorOpen]);

  useEffect(() => {
    // 1. Load Exams for Select
    get(ref(database, "exams")).then((snap) => {
      setExams(snap.exists() ? Object.keys(snap.val()).map((k) => ({ id: k, ...snap.val()[k] })) : []);
    });

    // 2. Load Rooms
    const roomsRef = ref(database, "exam_rooms");
    const unsubscribe = onValue(roomsRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loaded: ExamRoomData[] = [];
        
        for (const key of Object.keys(data)) {
          const room = data[key];
          
          // Get Exam Title
          const examSnap = await get(ref(database, `exams/${room.examId}`));
          const examTitle = examSnap.exists() ? examSnap.val().title : "Ujian Tidak Diketahui";

          // Get Class Name from usePiket
          let className = "Semua Kelas";
          if (room.classId && !room.allClasses) {
             const ids = room.classId.split(",");
             const names = ids.map((id: string) => piketClasses.find(c => c.id === id)?.name).filter(Boolean);
             if (names.length > 0) className = names.join(", ");
          }

          loaded.push({ id: key, ...room, examTitle, className });
        }
        setRooms(loaded);
      } else {
         setRooms([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [piketClasses]);

  const generateToken = () => {
    const token = generateNewToken();
    setFormValues((prev) => ({ ...prev, token }));
  };

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedRoom(null);
    setFormValues({
      examId: exams[0]?.id || "",
      classId: "all",
      allClasses: true,
      token: "",
      start_time: "",
      end_time: "",
      duration: 60,
      cheat_limit: 3,
      submit_window: 10,
      room_code: "",
    });
    generateToken();
    setIsDialogOpen(true);
  };

  const handleEditClick = (room: ExamRoomData) => {
    setDialogMode("edit");
    setSelectedRoom(room);
    setFormValues({
      examId: room.examId,
      classId: room.allClasses ? "all" : room.classId || "",
      allClasses: room.allClasses || false,
      token: room.token,
      start_time: room.start_time,
      end_time: room.end_time,
      duration: room.duration,
      cheat_limit: room.cheat_limit,
      submit_window: room.submit_window || 0,
      room_code: room.room_code || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        examId: formValues.examId,
        classId: formValues.classId === "all" ? null : formValues.classId,
        allClasses: formValues.classId === "all",
        token: formValues.token,
        start_time: formValues.start_time,
        end_time: formValues.end_time,
        duration: Number(formValues.duration),
        cheat_limit: Number(formValues.cheat_limit),
        submit_window: Number(formValues.submit_window),
        room_code: formValues.room_code.toUpperCase(),
        token_updated_at: Date.now(),
      };

      if (dialogMode === "edit" && selectedRoom) {
        await update(ref(database, `exam_rooms/${selectedRoom.id}`), payload);
      } else {
        await push(ref(database, "exam_rooms"), payload);
      }
      setIsDialogOpen(false);
    } catch (error) {
      showAlert("Gagal", "Gagal menyimpan ruang ujian.", "danger");
    }
  };

  const handleDeleteClick = (room: ExamRoomData) => {
    setRoomToDelete(room);
    setDeleteDialogOpen(true);
  };

  const handleMonitorClick = (room: ExamRoomData) => {
    setMonitorRoom(room);
    setIsMonitorOpen(true);
  };

  const handleUnlockStudent = async (nisn: string) => {
    if (!monitorRoom) return;
    try {
      const attemptId = `${nisn}_${monitorRoom.id}`;
      await update(ref(database, `attempts/${attemptId}`), {
        status: "ongoing",
        cheatCount: 0
      });
      showAlert("Berhasil", "Siswa berhasil diunlock.", "success");
    } catch (error) {
      showAlert("Gagal", "Gagal mengunlock siswa.", "danger");
    }
  };

  const handleResetCheatCount = async (nisn: string) => {
    if (!monitorRoom) return;
    try {
      const attemptId = `${nisn}_${monitorRoom.id}`;
      await update(ref(database, `attempts/${attemptId}`), {
        cheatCount: 0
      });
      showAlert("Berhasil", "Pelanggaran siswa berhasil direset.", "success");
    } catch (error) {
       showAlert("Gagal", "Gagal mereset cheat count.", "danger");
    }
  };

  const handleResetSession = async (nisn: string) => {
     if (!monitorRoom) return;
     if (!window.confirm("Apakah anda yakin ingin RESET TOTAL sesi siswa ini? Jawaban mereka akan hilang.")) return;
     try {
       const attemptId = `${nisn}_${monitorRoom.id}`;
       await remove(ref(database, `attempts/${attemptId}`));
       await remove(ref(database, `answers/${attemptId}`));
       showAlert("Berhasil", "Sesi siswa berhasil direset.", "success");
     } catch (error) {
        showAlert("Gagal", "Gagal mereset sesi.", "danger");
     }
  };

  const handleConfirmDelete = async () => {
    if (!roomToDelete) return;
    setIsDeleting(true);
    try {
      await remove(ref(database, `exam_rooms/${roomToDelete.id}`));
    } catch (error) {
      showAlert("Gagal", "Gagal menghapus ruang ujian.", "danger");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Ruang Ujian</h2>
          <p className="text-sm text-muted-foreground">Aktifkan sesi ujian untuk siswa.</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button 
              onClick={() => setActiveTab("aktif")} 
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === "aktif" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Aktif
            </button>
            <button 
              onClick={() => setActiveTab("arsip")} 
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === "arsip" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Arsip
            </button>
          </div>
          <div className="bg-white border text-sm font-semibold rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm border-slate-200/60 dark:bg-slate-800 dark:border-slate-700">
             <span className="text-slate-500 dark:text-slate-400 text-xs">Token Universal:</span>
             <code className="font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-2 py-0.5 rounded text-sm">{universalToken || "---"}</code>
             <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600 rounded-md p-0" onClick={handleRefreshToken}>
                <RefreshCw className="h-3 w-3" />
             </Button>
          </div>

          <Button onClick={handleCreateClick} size="lg" className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" /> Buka Ruang Ujian
          </Button>
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
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 dark:bg-blue-950 dark:text-blue-400" 
                    onClick={() => handleMonitorClick(room)}
                  >
                    <Users className="h-4 w-4 mr-1" /> Monitor
                  </Button>

                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200" 
                    onClick={() => navigate(`/admin/bank-soal/${room.examId}/questions`)}
                  >
                    <BookOpen className="h-4 w-4 mr-1" /> Soal
                  </Button>
                  
                  {activeTab === "aktif" ? (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 dark:bg-amber-950 dark:text-amber-400" 
                      onClick={() => handleArchiveRoom(room)}
                    >
                      <Archive className="h-4 w-4 mr-1" /> Arsip
                    </Button>
                  ) : (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400" 
                      onClick={() => handleRestoreRoom(room)}
                    >
                      <RotateCw className="h-4 w-4 mr-1" /> Buka
                    </Button>
                  )}

                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 dark:bg-green-950 dark:text-green-400" 
                    onClick={() => handleEditClick(room)}
                  >
                    Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200" 
                    onClick={() => handleDeleteClick(room)}
                  >
                    Hapus
                  </Button>
                </div>
              )}
            />
          </CardContent>
        </Card>
      )}

      {/* Dialog Create/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Edit Ruang Ujian" : "Buka Ruang Ujian"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <FormField id="examId" label="Pilih Ujian" error={undefined}>
              <select 
                value={formValues.examId} 
                onChange={(e) => setFormValues({ ...formValues, examId: e.target.value })} 
                required
                className="w-full rounded-md border text-sm p-2"
              >
                <option value="">-- Pilih Ujian --</option>
                {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </FormField>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Pilih Kelas</label>
              <div className="flex gap-2 mb-2">
                <button 
                  type="button" 
                  onClick={() => setFormValues({ ...formValues, allClasses: true, classId: "" })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${formValues.allClasses ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  Semua Kelas
                </button>
                <button 
                  type="button" 
                  onClick={() => setFormValues({ ...formValues, allClasses: false })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!formValues.allClasses ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  Pilih Parsial (Multiple)
                </button>
              </div>

              {!formValues.allClasses && (
                <div className="grid grid-cols-2 gap-2 border rounded-xl p-2 max-h-40 overflow-y-auto">
                    {piketClasses.map((c) => {
                       const isChecked = formValues.classId ? formValues.classId.split(",").includes(c.id) : false;
                       return (
                          <label key={c.id} className="flex items-center gap-2 text-xs p-1 hover:bg-slate-50 rounded cursor-pointer">
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
            <FormField id="room_code" label="Kode Ruang Ujian" error={undefined}>
                <Input type="text" placeholder="Contoh: MTK atau MTK-NISN" value={formValues.room_code || ""} onChange={(e) => setFormValues({ ...formValues, room_code: e.target.value.toUpperCase() })} required />
                <p className="text-slate-400 text-xs mt-1">Siswa akan mencari ruang ujian menggunakan kode ini.</p>
            </FormField>

            <div className="pt-2 border-t mt-4">
              <button 
                type="button" 
                onClick={() => setShowAdvanced(!showAdvanced)} 
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 focus:outline-none"
              >
                 {showAdvanced ? "Sembunyikan Pengaturan Lanjutan -" : "Tampilkan Pengaturan Lanjutan +"}
              </button>
            </div>

            {showAdvanced && (
               <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField id="duration" label="Durasi (Menit)" error={undefined}>
                      <Input type="number" value={formValues.duration} onChange={(e) => setFormValues({ ...formValues, duration: Number(e.target.value) })} required />
                    </FormField>
                    <FormField id="cheat_limit" label="Batas Cheat" error={undefined}>
                      <Input type="number" value={formValues.cheat_limit} onChange={(e) => setFormValues({ ...formValues, cheat_limit: Number(e.target.value) })} required />
                    </FormField>
                  </div>
                  <FormField id="submit_window" label="Kumpul Dibuka (Sisa Menit)" error={undefined}>
                      <Input type="number" placeholder="Contoh: 10 (Tombol kumpul aktif 10 menit sebelum berakhir)" value={formValues.submit_window || ""} onChange={(e) => setFormValues({ ...formValues, submit_window: Number(e.target.value) })} />
                      <p className="text-slate-400 text-xs mt-1">Isi 0 jika selalu diijinkan.</p>
                  </FormField>
               </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full">{dialogMode === "edit" ? "Perbarui" : "Simpan"}</Button>
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

      {/* Monitoring Dialog */}
      <Dialog open={isMonitorOpen} onOpenChange={setIsMonitorOpen}>
        <DialogContent className="max-w-4xl bg-white max-h-[85h] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Monitor Ujian: {monitorRoom?.examTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-slate-500">Kelas: {monitorRoom?.className}</p>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {(monitorRoom?.allClasses || (monitorRoom?.classId && monitorRoom.classId.includes(","))) && (
                <>
                  <span className="text-slate-600 font-medium">Filter Kelas:</span>
                  <select 
                    value={monitorClassFilter} 
                    onChange={(e) => setMonitorClassFilter(e.target.value)} 
                    className="p-1 border rounded bg-white"
                  >
                    <option value="all">Semua Terdaftar</option>
                    {piketClasses
                      .filter(c => monitorRoom?.allClasses || monitorRoom?.classId?.split(",").includes(c.id))
                      .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                    }
                  </select>
                </>
              )}
              <span className="text-slate-600 font-medium ml-2">Urutkan:</span>
              <select 
                value={monitorSortBy} 
                onChange={(e) => setMonitorSortBy(e.target.value as any)} 
                className="p-1 border rounded bg-white"
              >
                <option value="default">Default (Absen)</option>
                <option value="nama">Abjad Nama (A-Z)</option>
                <option value="nilai">Nilai Tertinggi</option>
                <option value="login">Waktu Login Terbaru</option>
              </select>
              <Button onClick={handleExportExcel} size="sm" variant="outline" className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50 flex items-center gap-1 rounded-lg shadow-sm">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
              </Button>
              <Button onClick={handleForceSubmitAll} size="sm" variant="outline" className="h-7 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 flex items-center gap-1 rounded-lg shadow-sm">
                <Users className="h-3.5 w-3.5" /> Selesaikan Semua
              </Button>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-3 text-left font-semibold w-12">No</th>
                  <th className="p-3 text-left font-semibold">NISN</th>
                  <th className="p-3 text-left font-semibold">Nama Siswa</th>
                  <th className="p-3 text-left font-semibold">Kelas</th>
                  <th className="p-3 text-left font-semibold">Waktu Login</th>
                  <th className="p-3 text-left font-semibold">Status</th>
                  <th className="p-3 text-left font-semibold">Nilai</th>
                  <th className="p-3 text-left font-semibold">Dikerjakan</th>
                  <th className="p-3 text-left font-semibold">Pelanggaran</th>
                  <th className="p-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {students
                  .filter((s) => {
                    if (monitorRoom?.allClasses) {
                      if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                      return true;
                    }
                    if (!monitorRoom?.classId) return false;
                    const allowedIds = monitorRoom.classId.split(",");
                    if (!allowedIds.includes(s.classId)) return false;
                    
                    if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                    return true;
                  })
                  .sort((a, b) => {
                    const attA = attempts.find((at) => at.id === `${a.nisn}_${monitorRoom?.id}`);
                    const attB = attempts.find((at) => at.id === `${b.nisn}_${monitorRoom?.id}`);

                    if (monitorSortBy === "nilai") {
                      const scoreA = attA?.score || 0;
                      const scoreB = attB?.score || 0;
                      return scoreB - scoreA;
                    }
                    if (monitorSortBy === "login") {
                      const timeA = attA?.startTime || 0;
                      const timeB = attB?.startTime || 0;
                      return timeB - timeA; // terbaru di atas
                    }
                    if (monitorSortBy === "nama") {
                      return a.name.localeCompare(b.name);
                    }
                    return 0; // default
                  })
                  .map((siswa, index) => {
                    const attempt = attempts.find((a) => a.id === `${siswa.nisn}_${monitorRoom?.id}`);
                    const sisAnswers = answersList[siswa.nisn] || {};
                    const answeredCount = Object.keys(sisAnswers).length;
                    
                    let statusLabel = <span className="text-slate-400">Belum Masuk</span>;
                    let actions = null;

                    if (attempt) {
                      if (attempt.status === "submitted") {
                        statusLabel = <span className="text-green-600 font-semibold">Selesai</span>;
                      } else if (attempt.status === "LOCKED") {
                        statusLabel = <span className="text-red-500 font-bold">TERKUNCI</span>;
                        actions = (
                            <Button size="sm" variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 dark:bg-green-950 dark:text-green-400" onClick={() => handleUnlockStudent(siswa.nisn)}>Buka Kunci</Button>
                        );
                      } else {
                        statusLabel = <span className="text-yellow-600 font-semibold">Mengerjakan</span>;
                      }
                    }

                    const loginTime = attempt?.startTime ? new Date(attempt.startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-";

                    return (
                      <>
                        <tr key={siswa.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-medium text-slate-500">{index + 1}</td>
                          <td className="p-3">{siswa.nisn}</td>
                          <td className="p-3 font-medium">{siswa.name}</td>
                          <td className="p-3 text-xs font-semibold text-slate-500 whitespace-nowrap">
                            {piketClasses.find(c => c.id === siswa.classId)?.name || "-"}
                          </td>
                          <td className="p-3 text-slate-500">{loginTime}</td>
                          <td className="p-3">{statusLabel}</td>
                          <td className="p-3 font-semibold text-blue-600">{attempt?.score !== undefined ? attempt.score : "-"}</td>
                          <td className="p-3 text-slate-500">{answeredCount} / {monitorQuestions.length}</td>
                          <td className="p-3 text-slate-500">{attempt?.cheatCount || 0} Kali</td>
                          <td className="p-3 text-right flex justify-end gap-1 items-center whitespace-nowrap">
                            {actions}
                            {attempt && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="secondary" 
                                  className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 dark:bg-amber-950 dark:text-amber-400 font-medium" 
                                  onClick={() => handleResetCheatCount(siswa.nisn)}
                                >
                                  Reset Cheat
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200 font-semibold" 
                                  onClick={() => handleResetSession(siswa.nisn)}
                                >
                                  Reset Sesi
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="secondary" 
                                  className="bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-200 font-medium" 
                                  onClick={() => setExpandedSiswa(expandedSiswa === siswa.nisn ? null : siswa.nisn)}
                                >
                                  {expandedSiswa === siswa.nisn ? "Tutup" : "Details"}
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                        {expandedSiswa === siswa.nisn && (
                          <tr>
                            <td colSpan={10} className="bg-slate-50 p-4 border-b">
                              <h4 className="text-xs font-bold text-slate-600 mb-2">Jawaban Siswa ({monitorQuestions.length} Soal)</h4>
                              <div className="max-h-80 overflow-y-auto pr-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {monitorQuestions.map((q, idx) => {
                                     const ansId = sisAnswers[q.id];
                                     const isCorrect = ansId && q.choices[ansId]?.isCorrect === true;
                                     const choiceText = ansId ? q.choices[ansId]?.text : <span className="text-slate-400 italic">Belum dijawab</span>;
                                     
                                     return (
                                        <div key={q.id} className="bg-white p-3 rounded-lg border text-xs shadow-sm flex flex-col gap-1">
                                           <div>
                                             <span className="font-bold text-slate-700">No {idx + 1}. </span>
                                             <span className="font-semibold text-slate-700 [&_p]:inline" dangerouslySetInnerHTML={{ __html: q.text }} />
                                           </div>
                                            {q.imageUrl && (
                                              <div className="my-1">
                                                <img 
                                                  src={q.imageUrl} 
                                                  alt="Gambar Soal" 
                                                  className="h-16 max-w-[120px] object-contain rounded border bg-slate-50 p-1 hover:h-40 hover:max-w-[240px] transition-all duration-200 cursor-zoom-in" 
                                                />
                                              </div>
                                            )}
                                           <div className={`p-2 rounded flex justify-between ${isCorrect ? "bg-green-50 text-green-700 border border-green-200" : ansId ? "bg-red-50 text-red-700 border border-red-200" : "bg-slate-50 text-slate-500"}`}>
                                              {ansId ? (
                                                 <span className="inline [&_p]:inline" dangerouslySetInnerHTML={{ __html: `<b>Pilihan (${ansId.toUpperCase()}):</b> ${q.choices[ansId]?.text || ""}` }} />
                                              ) : (
                                                 <span><b>Pilihan:</b> <span className="text-slate-400 italic">Belum dijawab</span></span>
                                              )}
                                              {ansId && (
                                                 <span className="font-bold shrink-0 ml-2">{isCorrect ? "Benar" : "Salah"}</span>
                                              )}
                                           </div>
                                        </div>
                                     );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
              </tbody>
            </table>
          </div>
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
