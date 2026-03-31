import React, { useState, useEffect } from "react";
import { Plus, Trash, Edit, RefreshCw, Users, Archive, RotateCw, FileSpreadsheet, BookOpen, ClipboardList, Lock, ChevronDown, Power, PowerOff, Square } from "lucide-react";
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
  token_updated_at?: number;
  status?: "archive" | null; // <--- Status Arsip
  room_name?: string;
  examTeacherId?: string;
  examType?: string;
  isDisabled?: boolean;
  subjectName?: string;
  teacherName?: string;
  show_result?: boolean;
}

const ExamRoomsPage = () => {
  const navigate = useNavigate();
  const { role, teacherId } = useAuth();
  const { classes: examClasses, students, subjects } = useExamData();
  const [rooms, setRooms] = useState<ExamRoomData[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"aktif" | "arsip">("aktif"); // <--- Active tab filter
  const [showAdvanced, setShowAdvanced] = useState(false); // <--- Advanced settings dialog collapsible

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedRoom, setSelectedRoom] = useState<ExamRoomData | null>(null);

  const [formValues, setFormValues] = useState({
    room_name: "",
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
    show_result: true, // <--- Menampilkan skor ke student
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
  const [expandedstudent, setExpandedstudent] = useState<string | null>(null); // NISN
  const [answersList, setAnswersList] = useState<Record<string, any>>({}); // { nisn: answers }
  const [monitorSortBy, setMonitorSortBy] = useState<"default" | "nilai" | "login" | "nama">("default");
  const [monitorClassFilter, setMonitorClassFilter] = useState<string>("all");
  const [monitorPage, setMonitorPage] = useState(1);
  const [monitorPageSize, setMonitorPageSize] = useState(10);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null); // <--- Kontrol Dropdown Aksis

  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [limitNisn, setLimitNisn] = useState("");
  const [limitValue, setLimitValue] = useState("1");
  const [previewImage, setPreviewImage] = useState<string | null>(null); // <--- Pratinjau Zoom Gambar Logs

  const [universalToken, setUniversalToken] = useState("");
  const [tokenUpdatedAt, setTokenUpdatedAt] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<string>("--:--");
  
  const [liveBreakdown, setLiveBreakdown] = useState<Record<string, number>>({});
  const [totalOngoing, setTotalOngoing] = useState(0);

  // 🖱️ Menarik/Menutup Dropdown Menu otomatis saat Klik di Luar kontainer
  useEffect(() => {
    const handleGlobalClick = () => setOpenMenuId(null);
    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, []);

  useEffect(() => {
    return onValue(ref(database, "settings"), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setUniversalToken(data.universal_token || "");
        setTokenUpdatedAt(data.universal_token_updated_at || Date.now());
      }
    });
  }, []);

  useEffect(() => {
    const attemptsRef = ref(database, "attempts");
    return onValue(attemptsRef, (snap) => {
      if (!snap.exists()) {
        setLiveBreakdown({});
        setTotalOngoing(0);
        return;
      }
      const data = snap.val();
      const stats: Record<string, number> = {};
      let total = 0;
      
      // data is { roomId: { nisn: attempt } }
      // data is { roomId: { nisn: attempt } }
      Object.keys(data).forEach(rid => {
        // filter: only count if room is not archived (exists in current active rooms list)
        // Note: we'll check against rooms state or just calculate later.
        // For simplicity and speed, we check if the roomId exists in our local record and is not archive.
        const roomInfo = rooms.find(r => r.id === rid);
        if (roomInfo && roomInfo.status === "archive") return;

        const roomAttempts = data[rid];
        Object.keys(roomAttempts).forEach(nisn => {
           if (roomAttempts[nisn].status === "ongoing") {
              stats[rid] = (stats[rid] || 0) + 1;
              total++;
           }
        });
      });
      setLiveBreakdown(stats);
      setTotalOngoing(total);
    });
  }, [rooms]); // Added rooms as dependency to ensure archive filtering works

  useEffect(() => {
    if (!tokenUpdatedAt) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const nextUpdate = tokenUpdatedAt + 5 * 60 * 1000;
      const diff = nextUpdate - now;

      if (diff <= 0) {
        setTimeLeft("00:00");
        const rotateToken = async () => {
          try {
            const snap = await get(ref(database, "settings/universal_token_updated_at"));
            const lastFirebaseUpdate = snap.exists() ? snap.val() : 0;
            const nowCheck = Date.now();

            if (nowCheck - lastFirebaseUpdate >= 5 * 60 * 1000) {
              const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
              let token = "";
              for (let i = 0; i < 6; i++) {
                token += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              await update(ref(database, "settings"), {
                universal_token: token,
                universal_token_updated_at: nowCheck
              });
            }
          } catch (e) { }
        };
        rotateToken();
      } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [tokenUpdatedAt]);

  const [monitorTimeLeft, setMonitorTimeLeft] = useState(0);
  const [isMonitorRefreshing, setIsMonitorRefreshing] = useState(false);

  const handleManualRefreshMonitor = () => {
    setMonitorTimeLeft(300);
    // Trigger reload manual
    if (monitorRoom && isMonitorOpen) {
      const attemptsRef = ref(database, "attempts");
      get(attemptsRef).then((snap) => {
        const data = snap.val();
        if (data) {
          const loaded = Object.keys(data)
            .filter((key) => key.includes(monitorRoom.id))
            .map((key) => {
              const [nisn] = key.split("_");
              return { id: key, nisn, ...data[key] };
            });
          setAttempts(loaded);
        }
      });
      const answersRef = ref(database, "answers");
      get(answersRef).then((snap) => {
        const data = snap.val();
        if (data) {
          const mapped: Record<string, any> = {};
          Object.keys(data).forEach((key) => {
            if (key.includes(monitorRoom.id)) {
              const nisn = key.split("_")[0];
              mapped[nisn] = data[key];
            }
          });
          setAnswersList(mapped);
        }
      });
    }
  };

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

  // 🔄 Automated refresh saat bucket (5-menit) berganti
  useEffect(() => {
    if (isMonitorOpen && monitorRoom) {
      handleManualRefreshMonitor();
    }
  }, [currentBucket]);

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
      render: (v: number) => <span className="text-slate-500 font-medium">{v} Menit</span>
    },
    {
      key: "start_time",
      label: "Waktu",
      render: (v: any, item: ExamRoomData) => (
        <div className="flex flex-col gap-0.5 text-xs text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
          <div className="flex items-center">
            <span className="w-14">Mulai</span>
            <span className="mr-1.5">:</span>
            <span>{new Date(item.start_time).toLocaleDateString("id-ID", { day: '2-digit', month: '2-digit' })} {new Date(item.start_time).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex items-center">
            <span className="w-14">Selesai</span>
            <span className="mr-1.5">:</span>
            <span>{new Date(item.end_time).toLocaleDateString("id-ID", { day: '2-digit', month: '2-digit' })} {new Date(item.end_time).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      )
    },
    {
      key: "status_label",
      label: "Status",
      render: (_: any, item: ExamRoomData) => {
        const now = Date.now();
        const start = new Date(item.start_time).getTime();
        const end = new Date(item.end_time).getTime();

        if (item.status === "archive") {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide bg-slate-100 text-slate-600 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-800">
              Arsip
            </span>
          );
        }

        if (item.isDisabled) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-900 dark:text-slate-600 dark:border-slate-800">
              Nonaktif
            </span>
          );
        }

        if (now < start) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide bg-slate-50 text-slate-500 border border-slate-200/80 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-800/40">
              Belum Dimulai
            </span>
          );
        } else if (now > end) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/40">
              Selesai
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 animate-pulse-slow">
              Berjalan
            </span>
          );
        }
      }
    }
  ];

  const handleArchiveRoom = (room: ExamRoomData) => {
    // 🛡️ Cek apakah ada student yang sedang aktif pengerjaan
    if (liveBreakdown[room.id] > 0) {
      showAlert("Aksi Ditolak", `Terdapat ${liveBreakdown[room.id]} student yang sedang aktif ujian di ruang ini. Harap selesaikan ujian terlebih dahulu sebelum mengarsipkan.`, "warning");
      return;
    }

    const now = Date.now();
    const start = new Date(room.start_time).getTime();
    const end = new Date(room.end_time).getTime();
    if (now >= start && now <= end) {
      showAlert("Peringatan", "Tidak dapat di arsipkan karena Ruang Ujian sedang dalam periode waktu aktif (Berjalan).", "warning");
      return;
    }

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

  const handleForceEndRoom = (room: ExamRoomData) => {
    setConfirmDialog({
      isOpen: true,
      title: "Selesaikan Ujian Sekarang",
      description: `Apakah Anda yakin ingin mengakhiri sesi ujian ${room.room_name || room.examTitle || ""} saat ini juga? Semua student yang sedang mengerjakan tidak akan bisa melanjutkan lagi.`,
      type: "danger",
      confirmLabel: "Selesaikan Paksa",
      onConfirm: async () => {
        try {
          // Format current time properly for input datetime-local
          const now = new Date();
          const offsetHours = now.getTimezoneOffset() / -60;
          now.setHours(now.getHours() + offsetHours);
          const nowFormatted = now.toISOString().slice(0, 16); 

          await update(ref(database, `exam_rooms/${room.id}`), { end_time: nowFormatted });
          showAlert("Berhasil", "Ujian telah dinyatakan SELESAI sekarang juga.", "success");
        } catch (error) {
          showAlert("Gagal", "Gagal mengakhiri ruang ujian.", "danger");
        }
      }
    });
  };

  const handleToggleDisabled = (room: ExamRoomData) => {
    const newState = !room.isDisabled;
    setConfirmDialog({
      isOpen: true,
      title: newState ? "Nonaktifkan Ujian" : "Aktifkan Ujian",
      description: `Apakah Anda yakin ingin ${newState ? "menonaktifkan" : "mengaktifkan kembali"} ruang ujian ${room.room_name || room.examTitle || ""}? ${newState ? "student tidak akan bisa masuk ke ruang ini." : ""}`,
      type: newState ? "warning" : "info",
      confirmLabel: newState ? "Ya, Nonaktifkan" : "Ya, Aktifkan",
      onConfirm: async () => {
        try {
          await update(ref(database, `exam_rooms/${room.id}`), { isDisabled: newState });
          showAlert(
            "Berhasil", 
            `Ruang ujian telah ${newState ? "dinonaktifkan" : "diaktifkan kembali"}.`, 
            newState ? "warning" : "success"
          );
        } catch (error) {
          showAlert("Gagal", "Gagal mengubah status ruang ujian.", "danger");
        }
      }
    });
  };

  const handleExportExcel = () => {
    if (!monitorRoom) return;

    const workbook = XLSX.utils.book_new();
    const header = ["No", "NISN", "Nama student", "Kelas", "Jam Login", "Jam Submit", "Cheat Count", "Benar", "Salah", "Nilai"];
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
      const student = students.find((s) => String(s.nisn).trim() === String(att.nisn).trim());
      const sisAnswers = answersList[att.nisn] || {};
      const kelasObj = examClasses.find(c => c.id === (student ? student.classId : ""));
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
        idx + 1, att.nisn, student ? student.name : "N/A", className,
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
      const s = students.find(student => student.nisn === att.nisn);
      return s ? s.classId : null;
    }).filter(Boolean)));

    classIdsInAttempts.forEach(cId => {
      const classAttempts = attempts.filter(att => {
        const s = students.find(student => student.nisn === att.nisn);
        return s?.classId === cId;
      });
      const className = examClasses.find(c => c.id === cId)?.name || "Lainnya";
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

    const ntHeader = ["No", "NISN", "Nama student", "Kelas", "Keterangan"];
    const ntRows = notTakenStudents.map((s, idx) => {
      const cObj = examClasses.find(c => c.id === s.classId);
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
        description: "Tidak ada student yang sedang aktif mengerjakan ujian di ruangan ini saat ini.",
        type: "info",
        confirmLabel: "Ok",
        onConfirm: () => { }
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Selesaikan Paksa Sesi",
      description: `Tindakan ini akan mengakhiri paksa sesi ujian untuk ${ongoing.length} student yang sedang aktif. Anda yakin?`,
      type: "danger",
      confirmLabel: "Selesaikan",
      onConfirm: async () => {
        try {
          const updates: any = {};
          const now = Date.now();
          
          ongoing.forEach((att) => {
            const sisAnswers = answersList[att.nisn] || {};
            let correct = 0;
            monitorQuestions.forEach((q) => {
              const ans = sisAnswers[q.id];
              if (ans && q.choices[ans]?.isCorrect === true) correct++;
            });
            const score = monitorQuestions.length > 0 ? Math.round((correct / monitorQuestions.length) * 100) : 0;

            updates[`attempts/${monitorRoom.id}/${att.nisn}/status`] = "submitted";
            updates[`attempts/${monitorRoom.id}/${att.nisn}/submit_time`] = now;
            updates[`attempts/${monitorRoom.id}/${att.nisn}/score`] = score;
            updates[`attempts/${monitorRoom.id}/${att.nisn}/correct`] = correct;
            updates[`attempts/${monitorRoom.id}/${att.nisn}/total`] = monitorQuestions.length;
          });
          
          await update(ref(database), updates);
          
          // Update local state agar UI langsung berubah
          setAttempts(prev => prev.map(a => {
             const ongoingItem = ongoing.find(o => o.id === a.id);
             if (ongoingItem) {
                const sisAnswers = answersList[a.nisn] || {};
                let correct = 0;
                monitorQuestions.forEach((q) => {
                   const ans = sisAnswers[q.id];
                   if (ans && q.choices[ans]?.isCorrect === true) correct++;
                });
                const score = monitorQuestions.length > 0 ? Math.round((correct / monitorQuestions.length) * 100) : 0;
                return { ...a, status: "submitted", submit_time: now, score, correct, total: monitorQuestions.length };
             }
             return a;
          }));

          showAlert("Berhasil", `${ongoing.length} student berhasil diselesaikan secara paksa.`, "success");
        } catch (error) {
          showAlert("Gagal", "Gagal menyelesaikan paksa ujian student.", "danger");
        }
      }
    });
  };

  const handleForceSubmitStudent = (nisn: string) => {
    if (!monitorRoom) return;
    const attempt = attempts.find(at => at.id === `${nisn}_${monitorRoom.id}`);
    if (!attempt) return;

    setConfirmDialog({
      isOpen: true,
      title: "Selesaikan Ujian student",
      description: `Apakah Anda yakin ingin mengakhiri sesi ujian student ini secara paksa?`,
      type: "danger",
      confirmLabel: "Ya, Selesaikan",
      onConfirm: async () => {
        try {
          const now = Date.now();
          const attemptId = `${nisn}_${monitorRoom.id}`;

          // 🏹 Hitung Skor On-the-fly
          const sisAnswers = answersList[nisn] || {};
          let correct = 0;
          monitorQuestions.forEach((q) => {
            const ans = sisAnswers[q.id];
            if (ans && q.choices[ans]?.isCorrect === true) correct++;
          });
          const score = monitorQuestions.length > 0 ? Math.round((correct / monitorQuestions.length) * 100) : 0;

          await update(ref(database, `attempts/${monitorRoom.id}/${nisn}`), {
            status: "submitted",
            submit_time: now,
            score: score,
            correct: correct,
            total: monitorQuestions.length
          });

          setAttempts(prev => prev.map(a => a.id === attemptId ? { ...a, status: "submitted", submit_time: now, score, correct, total: monitorQuestions.length } : a));
          showAlert("Berhasil", "Sesi student telah diselesaikan.", "success");
        } catch (error) {
          showAlert("Gagal", "Gagal menyelesaikan sesi student.", "danger");
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

  // 🔄 Loop auto rotate dipindahkan ke countdown ticker utama untuk rotasi instan.

  useEffect(() => {
    if (!monitorRoom || !isMonitorOpen) return;

    // 1. Load Attempts (Throttled 5s)
    const attemptsRef = ref(database, "attempts");
    let attemptsThrottle = false;
    let latestAttempts: any = null;

    const processAttempts = (data: any) => {
      if (!data) { setAttempts([]); return; }
      const loaded = Object.keys(data)
        .map((nisn) => {
          return { id: nisn, nisn, ...data[nisn] };
        });
      setAttempts(loaded);
    };

    const unsubAttempts = onValue(ref(database, `attempts/${monitorRoom.id}`), (snapshot) => {
      latestAttempts = snapshot.val();
      if (!attemptsThrottle) {
        processAttempts(latestAttempts);
        attemptsThrottle = true;
        setTimeout(() => {
          attemptsThrottle = false;
          if (latestAttempts) processAttempts(latestAttempts);
        }, 2000);
      }
    });

    // 2. Load Answers for details view (Throttled 5s)
    const answersRef = ref(database, "answers");
    let answersThrottle = false;
    let latestAnswers: any = null;

    const processAnswers = (data: any) => {
      if (!data) { setAnswersList({}); return; }
      setAnswersList(data);
    };

    const unsubAnswers = onValue(ref(database, `answers/${monitorRoom.id}`), (snapshot) => {
      latestAnswers = snapshot.val();
      if (!answersThrottle) {
        processAnswers(latestAnswers);
        answersThrottle = true;
        setTimeout(() => {
          answersThrottle = false;
          if (latestAnswers) processAnswers(latestAnswers);
        }, 2000);
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

  // 1. Load Reference Data (Exams & Teachers)
  useEffect(() => {
    // 1a. Load Exams for Select
    get(ref(database, "exams")).then((snap) => {
      let loadedExams = snap.exists() ? Object.keys(snap.val()).map((k) => ({ id: k, ...snap.val()[k] })) : [];
      setExams(loadedExams);
    });

    // 1b. Load Teachers
    get(ref(database, "teachers")).then(snap => {
      if(snap.exists()) setTeachers(snap.val());
    });
  }, []);

  // 2. Load Rooms & Merge Labels (Real-time)
  useEffect(() => {
    const roomsRef = ref(database, "exam_rooms");
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loaded: ExamRoomData[] = [];

        Object.keys(data).forEach((key) => {
          const room = data[key];

          // 🏹 Cari Data Exam dari State (Cepat)
          const examData = exams.find(e => e.id === room.examId);
          const examTeacherId = examData ? examData.teacherId : null;
          const examType = examData?.examType || "Latihan Biasa";
          const examTitle = examData ? examData.title : "Ujian Tidak Diketahui";
          
          // 🏹 Cari Nama Mapel & Guru dari State (Cepat)
          const subjectName = subjects.find(m => m.id === examData?.subjectId)?.name || "Mapel Tidak Ada";
          const teacherName = teachers[examTeacherId || ""]?.name || "Guru Tidak Ada";

          // Get Class Name from useExamData
          let className = "Semua Kelas";
          if (room.classId && !room.allClasses) {
            const ids = room.classId.split(",");
            const names = ids.map((id: string) => examClasses.find(c => c.id === id)?.name).filter(Boolean);
            if (names.length > 0) className = names.join(", ");
          }

          loaded.push({ id: key, ...room, examTitle, className, examTeacherId, examType, subjectName, teacherName });
        });

        if (role !== "admin" && teacherId) {
          loaded.sort((a, b) => {
            const isAOwner = a.examTeacherId === teacherId ? 1 : 0;
            const isBOwner = b.examTeacherId === teacherId ? 1 : 0;
            return isBOwner - isAOwner;
          });
        }

        setRooms(loaded);
      } else {
        setRooms([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [examClasses, role, teacherId, exams, teachers, subjects]);

  const generateToken = () => {
    const token = generateNewToken();
    setFormValues((prev) => ({ ...prev, token }));
  };

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedRoom(null);
    const availableExams = exams.filter(e => role === "admin" || e.teacherId === teacherId);
    setFormValues({
      room_name: "",
      examId: availableExams[0]?.id || "",
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
    generateToken();
    setIsDialogOpen(true);
  };

  const handleEditClick = (room: ExamRoomData) => {
    setDialogMode("edit");
    setSelectedRoom(room);
    setFormValues({
      room_name: room.room_name || "",
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
      show_result: room.show_result !== false,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        room_name: formValues.room_name,
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
        show_result: formValues.show_result,
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
    // 🛡️ Cek apakah ada student yang sedang aktif pengerjaan
    if (liveBreakdown[room.id] > 0) {
      showAlert("Aksi Ditolak", `Ruang ini tidak bisa dihapus karena masih ada ${liveBreakdown[room.id]} student yang aktif di dalamnya.`, "danger");
      return;
    }
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
      await update(ref(database, `attempts/${monitorRoom.id}/${nisn}`), {
        status: "ongoing",
        cheatCount: 0
      });
      setAttempts(prev => prev.map(a => a.nisn === nisn ? { ...a, status: "ongoing", cheatCount: 0 } : a));
      showAlert("Berhasil", "student berhasil diunlock.", "success");
    } catch (error) {
      showAlert("Gagal", "Gagal mengunlock student.", "danger");
    }
  };

  const handleResetSession = (nisn: string) => {
    if (!monitorRoom) return;
    setConfirmDialog({
      isOpen: true,
      title: "Reset Total Sesi",
      description: "Apakah anda yakin ingin RESET TOTAL sesi student ini? Seluruh jawaban dan progres mereka akan DIHAPUS PERMANEN.",
      type: "danger",
      confirmLabel: "Ya, Reset Total",
      onConfirm: async () => {
        try {
          await remove(ref(database, `attempts/${monitorRoom.id}/${nisn}`));
          await remove(ref(database, `answers/${monitorRoom.id}/${nisn}`));
          setAttempts(prev => prev.filter(att => att.nisn !== nisn));
          showAlert("Berhasil", "Sesi student berhasil direset total.", "success");
        } catch (error) {
          showAlert("Gagal", "Gagal mereset sesi.", "danger");
        }
      }
    });
  };

  const openLimitDialog = (nisn: string) => {
    setLimitNisn(nisn);
    setLimitValue("1");
    setLimitDialogOpen(true);
  };

  const handleConfirmAddLimit = async () => {
    if (!monitorRoom || !limitNisn) return;
    const added = parseInt(limitValue);
    if (isNaN(added) || added <= 0) return alert("Masukkan angka yang valid.");

    setLimitDialogOpen(false);
    try {
      const attemptRef = ref(database, `attempts/${monitorRoom.id}/${limitNisn}`);
      const snap = await get(attemptRef);
      const currentExtra = snap.exists() ? (snap.val().extraCheatLimit || 0) : 0;
      const currentStatus = snap.exists() ? snap.val().status : "ongoing";

      await update(attemptRef, {
        extraCheatLimit: currentExtra + added,
        status: currentStatus === "LOCKED" ? "ongoing" : currentStatus, // Auto Unlock
      });

      setAttempts(prev => prev.map(a => a.nisn === limitNisn ? { ...a, extraCheatLimit: (currentExtra + added), status: (currentStatus === "LOCKED" ? "ongoing" : currentStatus) } : a));

      showAlert("Berhasil", `Berhasil menambah +${added} batas pelanggaran untuk student.`, "success");
    } catch {
      showAlert("Gagal", "Gagal memperbarui batas.", "danger");
    }
  };

  const handleResetCheatCount = (nisn: string) => {
    if (!monitorRoom) return;
    setConfirmDialog({
      isOpen: true,
      title: "Reset Pelanggaran",
      description: "Hapus catatan deteksi kecurangan untuk student ini?",
      type: "warning",
      confirmLabel: "Ya, Reset",
      onConfirm: async () => {
        try {
          await update(ref(database, `attempts/${monitorRoom.id}/${nisn}`), {
            cheatCount: 0
          });
          setAttempts(prev => prev.map(a => a.nisn === nisn ? { ...a, cheatCount: 0 } : a));
          showAlert("Berhasil", "Pelanggaran student berhasil direset.", "success");
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
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
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
                <span>Ujian sedang berlangsung. Demi keamanan data, Anda hanya diperbolehkan mengubah <b>Nama Ruang</b>, <b>Waktu Selesai</b>, <b>Kumpul Dibuka</b>, dan <b>Batas Cheat</b>.</span>
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
                  <div><span className="font-semibold text-slate-700 dark:text-slate-300">Guru:</span> {teachers[exams.find(e => e.id === formValues.examId)?.teacherId]?.name || "-"}</div>
                </div>
              )}
            </FormField>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Pilih Kelas</label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  disabled={isEditRestricted}
                  onClick={() => setFormValues({ ...formValues, allClasses: true, classId: "" })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${isEditRestricted ? "opacity-50 cursor-not-allowed" : ""} ${formValues.allClasses ? "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800/40" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}
                >
                  Semua Kelas
                </button>
                <button
                  type="button"
                  disabled={isEditRestricted}
                  onClick={() => setFormValues({ ...formValues, allClasses: false })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${isEditRestricted ? "opacity-50 cursor-not-allowed" : ""} ${!formValues.allClasses ? "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800/40" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}
                >
                  Pilih Parsial (Multiple)
                </button>
              </div>

              {!formValues.allClasses && (
                <div className="grid grid-cols-2 gap-2 border border-slate-200 dark:border-slate-800 rounded-xl p-2 max-h-40 overflow-y-auto bg-card">
                  {examClasses.map((c) => {
                    const isChecked = formValues.classId ? formValues.classId.split(",").includes(c.id) : false;
                    return (
                      <label key={c.id} className={`flex items-center gap-2 text-xs p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer text-slate-700 dark:text-slate-200 ${isEditRestricted ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isEditRestricted}
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
                <Input type="datetime-local" value={formValues.start_time} onChange={(e) => setFormValues({ ...formValues, start_time: e.target.value })} required disabled={isEditRestricted} />
              </FormField>
              <FormField id="end_time" label="Waktu Berakhir" error={undefined}>
                <Input type="datetime-local" value={formValues.end_time} onChange={(e) => setFormValues({ ...formValues, end_time: e.target.value })} required />
              </FormField>
            </div>


            <div className="space-y-4 pt-1 border-t mt-4">
              <div className="grid grid-cols-2 gap-3 mt-2">
                <FormField id="duration" label="Durasi (Menit)" error={undefined}>
                  <Input type="number" value={formValues.duration} onChange={(e) => setFormValues({ ...formValues, duration: Number(e.target.value) })} required disabled={isEditRestricted} />
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
                  <p className="text-[10px] text-slate-400 leading-tight">student dapat melihat skor, jumlah benar & salah setelah selesai mengumpulkan.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={formValues.show_result} 
                    onChange={(e) => setFormValues({...formValues, show_result: e.target.checked})}
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
              Tambahkan extra toleransi pelanggaran/kecurangan untuk student ini (dalam angka):
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
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100 truncate">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-slow shrink-0"></span>
              <span className="truncate">Monitor Ujian: {monitorRoom?.room_name || "Ruang Tanpa Nama"} — <span className="text-slate-500 font-normal">{monitorRoom?.examTitle}</span></span>
            </DialogTitle>
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
                <RefreshCw className={`h-3 w-3 ${isMonitorRefreshing ? "animate-spin" : ""}`} />
              </Button>
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
                      .filter(c => monitorRoom?.allClasses || monitorRoom?.classId?.split(",").includes(c.id))
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
              }).length} student
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
                    <TableHead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-20">Nama student</TableHead>
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
                        const allowedIds = monitorRoom.classId.split(",");
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

                    if (currentData.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={10} className="h-24 text-center text-slate-400">
                            Tidak ada student ditemukan.
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return currentData.map((student, localIndex) => {
                      const index = startIndex + localIndex;
                      const attempt = attempts.find((a) => a.id === student.nisn);
                      const sisAnswers = answersList[student.nisn] || {};
                      const answeredCount = Object.keys(sisAnswers).length;

                      let statusLabel = <span className="text-slate-400">Belum Masuk</span>;
                      if (attempt) {
                        if (attempt.status === "submitted") {
                          statusLabel = <span className="text-green-600 font-semibold px-2 py-0.5 bg-green-50 dark:bg-green-950/40 rounded-full border border-green-100 dark:border-green-900">Selesai</span>;
                        } else if (attempt.status === "LOCKED") {
                          statusLabel = <span className="text-red-500 font-bold px-2 py-0.5 bg-red-50 dark:bg-red-950/40 rounded-full border border-red-100 dark:border-red-900 italic">TERKUNCI</span>;
                        } else {
                          const isOnline = attempt.isOnline === true;
                          statusLabel = (
                            <span className={`font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${isOnline ? "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900 animate-pulse" : "text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700"}`}>
                              Ujian ({isOnline ? "Online" : "Offline"})
                            </span>
                          );
                        }
                      }

                      const loginTime = attempt?.startTime ? new Date(attempt.startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-";

                      return (
                        <React.Fragment key={student.id}>
                          <TableRow className="group transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/40">
                            <TableCell className="text-center text-slate-400 font-medium">{index + 1}</TableCell>
                            <TableCell className="font-mono text-[11px] text-slate-500">{student.nisn}</TableCell>
                            <TableCell className="font-semibold text-slate-700 dark:text-slate-200">{student.name}</TableCell>
                            <TableCell className="text-xs font-semibold text-slate-500">{examClasses.find(c => c.id === student.classId)?.name || "-"}</TableCell>
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
                                {attempt && (
                                  <>
                                  {/* 1. Logs & Reset Cheat tetap Standalone */}
                                    {(role === "admin" || monitorRoom?.examTeacherId === teacherId) && (
                                      <Button size="sm" variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 dark:border-amber-800/40 h-7 text-[10px]" onClick={() => handleResetCheatCount(student.nisn)}>Reset Cheat</Button>
                                    )}

                                    <Button size="sm" variant="secondary" className="bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100 dark:bg-sky-900/30 dark:text-sky-400 dark:hover:bg-sky-900/50 dark:border-sky-800/40 h-7 text-[10px]" onClick={() => setExpandedstudent(expandedstudent === student.nisn ? null : student.nisn)}>
                                      {expandedstudent === student.nisn ? "Tutup" : "Logs"}
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
                                            setOpenMenuId(openMenuId === student.nisn ? null : student.nisn);
                                          }}
                                        >
                                          Menu
                                          <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                                        </Button>

                                        {openMenuId === student.nisn && (
                                          <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 py-1 overflow-hidden">
                                            {attempt?.status === "LOCKED" && (
                                              <button onClick={(e) => { e.stopPropagation(); handleUnlockStudent(student.nisn); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-700/60">
                                                <Lock className="w-3.5 h-3.5 opacity-80" /> Buka Kunci
                                              </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); openLimitDialog(student.nisn); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                              <Plus className="w-3.5 h-3.5 opacity-70 text-slate-400" /> + Limit
                                            </button>
                                            {attempt?.status !== "submitted" && (
                                              <button onClick={(e) => { e.stopPropagation(); handleForceSubmitStudent(student.nisn); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-700/60">
                                                <Square className="w-3.5 h-3.5 opacity-70 fill-current" /> Selesaikan
                                              </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); handleResetSession(student.nisn); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
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
                          {expandedstudent === student.nisn && (
                            <TableRow className="bg-slate-50/30 dark:bg-slate-800/30 border-l-2 border-l-indigo-500">
                              <TableCell colSpan={10} className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="h-1 w-1 rounded-full bg-indigo-500"></div>
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Detail Jawaban & Sesi</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                                  {monitorQuestions.map((q, qIdx) => {
                                    const ansId = sisAnswers[q.id];
                                    const isCorrect = ansId && q.choices[ansId]?.isCorrect === true;

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
                                            <span className="text-xs font-bold leading-none">{ansId ? ansId.toUpperCase() : "Kosong"}</span>
                                          </div>
                                          {ansId && (
                                            <div className={`px-2 py-1 rounded-md text-[10px] font-bold ${isCorrect ? "bg-emerald-100/30 dark:bg-emerald-800/20 text-emerald-700 dark:text-emerald-400" : "bg-rose-100/30 dark:bg-rose-800/20 text-rose-700 dark:text-rose-400"}`}>
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
            <div className="md:hidden space-y-4 p-4 bg-slate-50/30 dark:bg-slate-900/30 overflow-y-auto max-h-[65vh]">
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
                    const attA = attempts.find((at) => at.id === a.nisn);
                    const attB = attempts.find((at) => at.id === b.nisn);
                    if (monitorSortBy === "nilai") return (attB?.score || 0) - (attA?.score || 0);
                    if (monitorSortBy === "login") return (attB?.startTime || 0) - (attA?.startTime || 0);
                    if (monitorSortBy === "nama") return a.name.localeCompare(b.name);
                    return 0;
                  });

                const startIndex = (monitorPage - 1) * monitorPageSize;
                const currentData = filtered.slice(startIndex, startIndex + monitorPageSize);

                if (currentData.length === 0) return <div className="text-center p-8 text-slate-400 text-sm">Tidak ada student ditemukan.</div>;

                return currentData.map((student, localIndex) => {
                  const attempt = attempts.find((a) => a.id === student.nisn);
                  const sisAnswers = answersList[student.nisn] || {};
                  const isOnline = attempt?.isOnline === true;
                  const status = attempt ? (attempt.status === "submitted" ? "Selesai" : attempt.status === "LOCKED" ? "Terkunci" : `Ujian (${isOnline ? "Online" : "Offline"})`) : "Belum Masuk";
                  const statusColor = attempt ? (attempt.status === "submitted" ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900" : attempt.status === "LOCKED" ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900" : isOnline ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900 animate-pulse" : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700") : "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700";

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

                      <div className="flex justify-end gap-2 pt-1">
                        {attempt?.status === "LOCKED" && (
                          <Button size="sm" variant="outline" className="h-8 text-[11px] font-bold border-green-200 text-green-700 hover:bg-green-50 rounded-xl px-4" onClick={() => handleUnlockStudent(student.nisn)}>Unlock</Button>
                        )}
                        <Button size="sm" variant="secondary" className="h-8 text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl px-4" onClick={() => setExpandedstudent(expandedstudent === student.nisn ? null : student.nisn)}>
                          {expandedstudent === student.nisn ? "Tutup" : "Details"}
                        </Button>
                      </div>

                      {expandedstudent === student.nisn && (
                        <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl space-y-2 p-2">
                          {monitorQuestions.map((q, qIdx) => {
                            const ansId = sisAnswers[q.id];
                            const isCorrect = ansId && q.choices[ansId]?.isCorrect === true;
                            return (
                              <div key={q.id} className="bg-card p-3 rounded-xl border border-slate-200 text-[11px] shadow-sm">
                                <div className="flex gap-2 mb-2">
                                  <span className="font-bold text-slate-400 shrink-0">#{qIdx + 1}</span>
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
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-6 bg-slate-100/30 dark:bg-slate-800/50 p-3 sm:p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-card px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
                  Menampilkan {Math.min((monitorPage - 1) * monitorPageSize + 1, filtered.length)} - {Math.min(monitorPage * monitorPageSize, filtered.length)} dari {filtered.length} student
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


