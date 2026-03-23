import React, { useState, useEffect } from "react";
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
  const [monitorPage, setMonitorPage] = useState(1);
  const [monitorPageSize, setMonitorPageSize] = useState(10);

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
    setMonitorPage(1);
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

  const handleResetSession = (nisn: string) => {
     if (!monitorRoom) return;
     setConfirmDialog({
       isOpen: true,
       title: "Reset Total Sesi",
       description: "Apakah anda yakin ingin RESET TOTAL sesi siswa ini? Seluruh jawaban dan progres mereka akan DIHAPUS PERMANEN.",
       type: "danger",
       confirmLabel: "Ya, Reset Total",
       onConfirm: async () => {
         try {
           const attemptId = `${nisn}_${monitorRoom.id}`;
           await remove(ref(database, `attempts/${attemptId}`));
           await remove(ref(database, `answers/${attemptId}`));
           showAlert("Berhasil", "Sesi siswa berhasil direset total.", "success");
         } catch (error) {
           showAlert("Gagal", "Gagal mereset sesi.", "danger");
         }
       }
     });
  };

  const handleAddCheatLimit = async (nisn: string) => {
    if (!monitorRoom) return;
    const value = window.prompt("Tambahkan batas toleransi pelanggaran (angka) untuk siswa ini berapa kali?:", "1");
    if (!value) return;
    const added = parseInt(value);
    if (isNaN(added) || added <= 0) return alert("Masukkan angka yang valid.");

    try {
      const attemptId = `${nisn}_${monitorRoom.id}`;
      const attemptRef = ref(database, `attempts/${attemptId}`);
      const snap = await get(attemptRef);
      const currentExtra = snap.exists() ? (snap.val().extraCheatLimit || 0) : 0;
      const currentStatus = snap.exists() ? snap.val().status : "ongoing";

      await update(attemptRef, {
        extraCheatLimit: currentExtra + added,
        status: currentStatus === "LOCKED" ? "ongoing" : currentStatus, // Auto Unlock
      });
      
      showAlert("Berhasil", `Berhasil menambah +${added} batas pelanggaran untuk siswa.`, "success");
    } catch {
      showAlert("Gagal", "Gagal memperbarui batas.", "danger");
    }
  };

  const handleResetCheatCount = (nisn: string) => {
    if (!monitorRoom) return;
    setConfirmDialog({
      isOpen: true,
      title: "Reset Pelanggaran",
      description: "Hapus catatan deteksi kecurangan untuk siswa ini?",
      type: "warning",
      confirmLabel: "Ya, Reset",
      onConfirm: async () => {
       try {
         const attemptId = `${nisn}_${monitorRoom.id}`;
         await update(ref(database, `attempts/${attemptId}`), {
           cheatCount: 0
         });
         showAlert("Berhasil", "Pelanggaran siswa berhasil direset.", "success");
       } catch (error) {
          showAlert("Gagal", "Gagal mereset cheat count.", "danger");
       }
      }
    });
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
        <DialogContent className="max-w-[95vw] lg:max-w-6xl w-full bg-white max-h-[95vh] flex flex-col p-4 sm:p-6 overflow-hidden">
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
                    onChange={(e) => {
                      setMonitorClassFilter(e.target.value);
                      setMonitorPage(1);
                    }} 
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
                onChange={(e) => {
                  setMonitorSortBy(e.target.value as any);
                  setMonitorPage(1);
                }} 
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

          <div className="flex justify-between items-center mb-2 px-1">
             <div className="text-[11px] text-slate-500">
                Menampilkan {Math.min((monitorPage - 1) * monitorPageSize + 1, students.filter(s => {
                    if (monitorRoom?.allClasses) {
                      if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                      return true;
                    }
                    if (!monitorRoom?.classId) return false;
                    const allowedIds = monitorRoom.classId.split(",");
                    if (!allowedIds.includes(s.classId)) return false;
                    if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                    return true;
                  }).length)} - {Math.min(monitorPage * monitorPageSize, students.filter(s => {
                    if (monitorRoom?.allClasses) {
                      if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                      return true;
                    }
                    if (!monitorRoom?.classId) return false;
                    const allowedIds = monitorRoom.classId.split(",");
                    if (!allowedIds.includes(s.classId)) return false;
                    if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                    return true;
                  }).length)} dari {students.filter(s => {
                    if (monitorRoom?.allClasses) {
                      if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                      return true;
                    }
                    if (!monitorRoom?.classId) return false;
                    const allowedIds = monitorRoom.classId.split(",");
                    if (!allowedIds.includes(s.classId)) return false;
                    if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                    return true;
                  }).length} Siswa
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Baris:</span>
                <select 
                  value={monitorPageSize} 
                  onChange={(e) => {
                    setMonitorPageSize(Number(e.target.value));
                    setMonitorPage(1);
                  }}
                  className="p-1 text-[11px] border rounded bg-white"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
             </div>
          </div>

          <div className="rounded-md border bg-white shadow-sm flex flex-col overflow-hidden">
            {/* Desktop View */}
            <div className="hidden md:block overflow-auto max-h-[65vh] scrollbar-thin">
              <Table>
                <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                  <TableRow className="hover:bg-transparent border-b bg-slate-50">
                    <TableHead className="w-12 text-center sticky top-0 bg-slate-50 z-20">No</TableHead>
                    <TableHead className="sticky top-0 bg-slate-50 z-20">NISN</TableHead>
                    <TableHead className="sticky top-0 bg-slate-50 z-20">Nama Siswa</TableHead>
                    <TableHead className="sticky top-0 bg-slate-50 z-20">Kelas</TableHead>
                    <TableHead className="sticky top-0 bg-slate-50 z-20">Login</TableHead>
                    <TableHead className="sticky top-0 bg-slate-50 z-20">Status</TableHead>
                    <TableHead className="text-center sticky top-0 bg-slate-50 z-20">Nilai</TableHead>
                    <TableHead className="text-center sticky top-0 bg-slate-50 z-20">Prog.</TableHead>
                    <TableHead className="text-center sticky top-0 bg-slate-50 z-20">Warn</TableHead>
                    <TableHead className="text-right sticky top-0 bg-slate-50 z-20">Aksi</TableHead>
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
                        const allowedIds = monitorRoom.classId.split(",");
                        if (!allowedIds.includes(s.classId)) return false;
                        if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                        return true;
                      })
                      .sort((a, b) => {
                        const attA = attempts.find((at) => at.id === `${a.nisn}_${monitorRoom?.id}`);
                        const attB = attempts.find((at) => at.id === `${b.nisn}_${monitorRoom?.id}`);
                        if (monitorSortBy === "nilai") return (attB?.score || 0) - (attA?.score || 0);
                        if (monitorSortBy === "login") return (attB?.startTime || 0) - (attA?.startTime || 0);
                        if (monitorSortBy === "nama") return a.name.localeCompare(b.name);
                        return 0;
                      });

                    const startIndex = (monitorPage - 1) * monitorPageSize;
                    const currentData = filtered.slice(startIndex, startIndex + monitorPageSize);

                    if (currentData.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={10} className="h-24 text-center text-slate-400">
                             Tidak ada siswa ditemukan.
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return currentData.map((siswa, localIndex) => {
                      const index = startIndex + localIndex;
                      const attempt = attempts.find((a) => a.id === `${siswa.nisn}_${monitorRoom?.id}`);
                      const sisAnswers = answersList[siswa.nisn] || {};
                      const answeredCount = Object.keys(sisAnswers).length;
                      
                      let statusLabel = <span className="text-slate-400">Belum Masuk</span>;
                      if (attempt) {
                        if (attempt.status === "submitted") {
                          statusLabel = <span className="text-green-600 font-semibold px-2 py-0.5 bg-green-50 rounded-full border border-green-100">Selesai</span>;
                        } else if (attempt.status === "LOCKED") {
                          statusLabel = <span className="text-red-500 font-bold px-2 py-0.5 bg-red-50 rounded-full border border-red-100 italic">TERKUNCI</span>;
                        } else {
                          const isOnline = attempt.isOnline === true;
                          statusLabel = (
                            <span className={`font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${isOnline ? "text-amber-600 bg-amber-50 border-amber-100 animate-pulse" : "text-slate-500 bg-slate-50 border-slate-100"}`}>
                              Ujian ({isOnline ? "Online" : "Offline"})
                            </span>
                          );
                        }
                      }

                      const loginTime = attempt?.startTime ? new Date(attempt.startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-";

                      return (
                        <React.Fragment key={siswa.id}>
                          <TableRow className="group transition-colors hover:bg-slate-50/50">
                            <TableCell className="text-center text-slate-400 font-medium">{index + 1}</TableCell>
                            <TableCell className="font-mono text-[11px] text-slate-500">{siswa.nisn}</TableCell>
                            <TableCell className="font-semibold text-slate-700">{siswa.name}</TableCell>
                            <TableCell className="text-xs font-semibold text-slate-500">{piketClasses.find(c => c.id === siswa.classId)?.name || "-"}</TableCell>
                            <TableCell className="text-slate-500 tabular-nums">{loginTime}</TableCell>
                            <TableCell>{statusLabel}</TableCell>
                            <TableCell className="text-center font-bold text-indigo-600 tabular-nums">{attempt?.score !== undefined ? attempt.score : "-"}</TableCell>
                            <TableCell className="text-center text-xs text-slate-500 font-medium tabular-nums">{answeredCount}/{monitorQuestions.length}</TableCell>
                             <TableCell className="text-center">
                                {(() => {
                                  const totalAllowed = (monitorRoom?.cheat_limit || 3) + (attempt?.extraCheatLimit || 0);
                                  const currentCount = attempt?.cheatCount || 0;
                                  return (
                                     <span className={`font-bold tabular-nums ${currentCount > 0 ? "text-red-500" : "text-slate-400"}`}>
                                        {currentCount} / {totalAllowed}
                                     </span>
                                  )
                                })()}
                             </TableCell>
                            <TableCell className="text-right">
                               <div className="flex justify-end gap-1.5 items-center whitespace-nowrap">
                                  {attempt?.status === "LOCKED" && (
                                    <Button size="sm" variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 h-7 text-[10px]" onClick={() => handleUnlockStudent(siswa.nisn)}>Buka Kunci</Button>
                                  )}
                                  {attempt && (
                                    <>
                                      <Button size="sm" variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 h-7 text-[10px]" onClick={() => handleAddCheatLimit(siswa.nisn)}>+ Limit</Button>
                                      <Button size="sm" variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200 h-7 text-[10px]" onClick={() => handleResetCheatCount(siswa.nisn)}>Reset Cheat</Button>
                                      <Button size="sm" variant="destructive" className="bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200 h-7 text-[10px]" onClick={() => handleResetSession(siswa.nisn)}>Reset Sesi</Button>
                                      <Button size="sm" variant="secondary" className="bg-sky-100 text-sky-700 hover:bg-sky-200 border-sky-200 h-7 text-[10px]" onClick={() => setExpandedSiswa(expandedSiswa === siswa.nisn ? null : siswa.nisn)}>
                                        {expandedSiswa === siswa.nisn ? "Tutup" : "Logs"}
                                      </Button>
                                    </>
                                  )}
                               </div>
                            </TableCell>
                          </TableRow>
                          {expandedSiswa === siswa.nisn && (
                            <TableRow className="bg-slate-50/30 border-l-2 border-l-indigo-500">
                              <TableCell colSpan={10} className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                   <div className="h-1 w-1 rounded-full bg-indigo-500"></div>
                                   <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Detail Jawaban & Sesi</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                                  {monitorQuestions.map((q, qIdx) => {
                                     const ansId = sisAnswers[q.id];
                                     const isCorrect = ansId && q.choices[ansId]?.isCorrect === true;
                                     return (
                                        <div key={q.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)] flex flex-col gap-2">
                                           <div className="flex gap-2">
                                             <span className="text-slate-400 font-bold shrink-0">#{qIdx + 1}</span>
                                             <div className="text-xs font-medium text-slate-700 leading-relaxed truncate-3-lines" dangerouslySetInnerHTML={{ __html: q.text }} />
                                           </div>
                                           <div className={`mt-auto p-2 rounded-lg flex items-center justify-between transition-colors ${isCorrect ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : ansId ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-slate-50 text-slate-400 border border-slate-100"}`}>
                                              <div className="flex flex-col">
                                                 <span className="text-[10px] uppercase font-bold opacity-70">Jawaban</span>
                                                 <span className="text-xs font-bold leading-none">{ansId ? ansId.toUpperCase() : "Kosong"}</span>
                                              </div>
                                              {ansId && (
                                                <div className={`px-2 py-1 rounded-md text-[10px] font-bold ${isCorrect ? "bg-emerald-100/50" : "bg-rose-100/50"}`}>
                                                   {isCorrect ? "BENAR" : "SALAH"}
                                                </div>
                                              )}
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
                  })()}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4 p-4 bg-slate-50/30 overflow-y-auto max-h-[65vh]">
               {(() => {
                    const filtered = students
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
                        if (monitorSortBy === "nilai") return (attB?.score || 0) - (attA?.score || 0);
                        if (monitorSortBy === "login") return (attB?.startTime || 0) - (attA?.startTime || 0);
                        if (monitorSortBy === "nama") return a.name.localeCompare(b.name);
                        return 0;
                      });

                    const startIndex = (monitorPage - 1) * monitorPageSize;
                    const currentData = filtered.slice(startIndex, startIndex + monitorPageSize);

                    if (currentData.length === 0) return <div className="text-center p-8 text-slate-400 text-sm">Tidak ada siswa ditemukan.</div>;

                    return currentData.map((siswa, localIndex) => {
                      const attempt = attempts.find((a) => a.id === `${siswa.nisn}_${monitorRoom?.id}`);
                      const sisAnswers = answersList[siswa.nisn] || {};
                      const isOnline = attempt?.isOnline === true;
                      const status = attempt ? (attempt.status === "submitted" ? "Selesai" : attempt.status === "LOCKED" ? "Terkunci" : `Ujian (${isOnline ? "Online" : "Offline"})`) : "Belum Masuk";
                      const statusColor = attempt ? (attempt.status === "submitted" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : attempt.status === "LOCKED" ? "bg-rose-100 text-rose-700 border-rose-200" : isOnline ? "bg-amber-100 text-amber-700 border-amber-200 animate-pulse" : "bg-slate-100 text-slate-500 border-slate-200") : "bg-slate-100 text-slate-400 border-slate-200";

                      return (
                        <div key={siswa.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm relative overflow-hidden">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-vibrant">#{startIndex + localIndex + 1} • {siswa.nisn}</p>
                               <h4 className="font-bold text-slate-800 leading-tight">{siswa.name}</h4>
                               <p className="text-xs font-semibold text-slate-500 bg-slate-100 inline-block px-2 py-0.5 rounded-md">{piketClasses.find(c => c.id === siswa.classId)?.name}</p>
                            </div>
                             <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${statusColor}`}>{status.toUpperCase()}</span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100">
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

                          <div className="flex justify-end gap-2 pt-1">
                             {attempt?.status === "LOCKED" && (
                               <Button size="sm" variant="outline" className="h-8 text-[11px] font-bold border-green-200 text-green-700 hover:bg-green-50 rounded-xl px-4" onClick={() => handleUnlockStudent(siswa.nisn)}>Unlock</Button>
                             )}
                             <Button size="sm" variant="secondary" className="h-8 text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl px-4" onClick={() => setExpandedSiswa(expandedSiswa === siswa.nisn ? null : siswa.nisn)}>
                                {expandedSiswa === siswa.nisn ? "Tutup" : "Details"}
                             </Button>
                          </div>

                          {expandedSiswa === siswa.nisn && (
                             <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl space-y-2 p-2">
                               {monitorQuestions.map((q, qIdx) => {
                                  const ansId = sisAnswers[q.id];
                                  const isCorrect = ansId && q.choices[ansId]?.isCorrect === true;
                                  return (
                                     <div key={q.id} className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] shadow-sm">
                                        <div className="flex gap-2 mb-2">
                                           <span className="font-bold text-slate-400 shrink-0">#{qIdx+1}</span>
                                           <div className="text-slate-700 leading-snug font-medium" dangerouslySetInnerHTML={{ __html: q.text }} />
                                        </div>
                                        <div className={`p-2 rounded-lg flex justify-between items-center ${isCorrect ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : ansId ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-slate-50 text-slate-400"}`}>
                                           <span className="font-bold">Jawaban: {ansId ? ansId.toUpperCase() : "KOSONG"}</span>
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
                const allowedIds = monitorRoom.classId.split(",");
                if (!allowedIds.includes(s.classId)) return false;
                if (monitorClassFilter !== "all" && s.classId !== monitorClassFilter) return false;
                return true;
              });
             const totalPages = Math.ceil(filtered.length / monitorPageSize);
             if (totalPages <= 1) return null;

             return (
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-6 bg-slate-100/50 p-3 sm:p-4 rounded-2xl border border-slate-200/60">
                   <div className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                      Menampilkan {Math.min((monitorPage - 1) * monitorPageSize + 1, filtered.length)} - {Math.min(monitorPage * monitorPageSize, filtered.length)} dari {filtered.length} Siswa
                   </div>
                   <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                      <Button variant="ghost" size="sm" onClick={() => setMonitorPage(1)} disabled={monitorPage === 1} className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 disabled:opacity-30">
                         <span className="sr-only">First</span>
                         {"<<"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setMonitorPage(prev => Math.max(1, prev - 1))} disabled={monitorPage === 1} className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 disabled:opacity-30">
                         <span className="sr-only">Previous</span>
                         {"<"}
                      </Button>
                      
                      <div className="flex items-center gap-2 px-3 h-8 bg-slate-50 rounded-lg border border-inner shadow-inner">
                         <span className="text-[10px] uppercase font-black text-slate-400">Hal</span>
                         <input 
                            type="number" 
                            className="w-8 text-center text-xs font-black bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-slate-800" 
                            value={monitorPage}
                            onChange={(e) => {
                               const v = parseInt(e.target.value);
                               if (v >= 1 && v <= totalPages) setMonitorPage(v);
                            }}
                         />
                         <span className="text-[10px] font-bold text-slate-300">/ {totalPages}</span>
                      </div>

                      <Button variant="ghost" size="sm" onClick={() => setMonitorPage(prev => Math.min(totalPages, prev + 1))} disabled={monitorPage === totalPages} className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 disabled:opacity-30">
                         <span className="sr-only">Next</span>
                         {">"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setMonitorPage(totalPages)} disabled={monitorPage === totalPages} className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 disabled:opacity-30">
                         <span className="sr-only">Last</span>
                         {">>"}
                      </Button>
                   </div>
                </div>
             );
          })()}
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
