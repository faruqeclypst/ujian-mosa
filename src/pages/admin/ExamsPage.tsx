import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, BookOpen, Trash, Edit, Archive, RotateCw, Copy, ClipboardList, Download, Loader2, X, ChevronDown } from "lucide-react";
import JSZip from "jszip";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Progress } from "../../components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { useNavigate } from "react-router-dom";
import { useExamData } from "../../context/ExamDataContext";
import { ConfirmationDialog } from "../../components/dialogs/ConfirmationDialog";
import { BatchProgressDialog, type BatchProgressState } from "../../components/dialogs/BatchProgressDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { DataTable } from "../../components/ui/data-table";
import { Skeleton } from "../../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { useToast } from "../../components/ui/toast";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";

export interface ExamData {
  id: string;
  title: string;
  subjectId: string;
  teacherId: string;
  createdAt: string; // PocketBase uses ISO strings
  examType?: string;
  status?: "archive" | null;
}

export const getExamTypeColorClass = (type: string) => {
  switch (type) {
    case "Latihan Biasa": return "bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800/60 dark:border-slate-700/60 dark:text-slate-300";
    case "Ulangan Harian": return "bg-emerald-50 border-emerald-200/60 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-400";
    case "Ujian Tengah Semester (PTS)": return "bg-amber-50 border-amber-200/60 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-500";
    case "Ujian Akhir Semester (PAS / PAT)": return "bg-rose-50 border-rose-200/60 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-400";
    case "Ujian Sekolah (US)": return "bg-indigo-50 border-indigo-200/60 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800/60 dark:text-indigo-400";
    case "Tryout": return "bg-fuchsia-50 border-fuchsia-200/60 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:border-fuchsia-800/60 dark:text-fuchsia-400";
    case "Tugas Terstruktur": return "bg-blue-50 border-blue-200/60 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-400";
    case "Ujian Praktik": return "bg-cyan-50 border-cyan-200/60 text-cyan-700 dark:bg-cyan-950/40 dark:border-cyan-800/60 dark:text-cyan-400";
    default: return "bg-indigo-50 border-indigo-200/60 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800/60 dark:text-indigo-400";
  }
};

const forceSmallImage = (imgTag: string, physW: number, physH: number): string => {
  let cleaned = imgTag
    .replace(/\bwidth\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\bheight\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  cleaned = cleaned.replace(/(style=["'])([^"']*)(["'])/gi, (_, prefix, styleContent, suffix) => {
    const cleanedStyle = styleContent
      .replace(/\bwidth\s*:\s*[^;]+;?/gi, '')
      .replace(/\bheight\s*:\s*[^;]+;?/gi, '');
    return prefix + cleanedStyle + suffix;
  });

  if (physW > 0 && physH > 0) {
    const maxDisplayW = 290;
    let displayW = physW;
    let displayH = physH;
    if (physW > maxDisplayW) {
      displayH = Math.round((physH * maxDisplayW) / physW);
      displayW = maxDisplayW;
    }
    cleaned = cleaned.replace(/\/?>$/, ` width="${displayW}" height="${displayH}"$&`);
  } else {
    cleaned = cleaned.replace(/\/?>$/, ' width="290"$&');
  }
  return cleaned;
};

const processLatex = (htmlInput: string) => {
  if (!htmlInput) return htmlInput;
  let result = htmlInput;
  const fixFormula = (f: string) => f.trim().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\u2026/g, '\\ldots').replace(/\.\.\./g, '\\ldots');
  
  result = result.replace(/(\$\$|\\\[)([\s\S]*?)(\$\$|\\\])/g, (_, _s, formula) => {
    const clean = fixFormula(formula);
    const url = `https://latex.codecogs.com/png.latex?\\dpi{200}\\bg_white ${encodeURIComponent(clean)}`;
    return `<br/><img src="${url}" class="latex-formula" /><br/>`;
  });
  result = result.replace(/(?<!\$)(\$)([^\$\n]+?)(\$)(?!\$)/g, (_, _s, formula) => {
    const clean = fixFormula(formula);
    if (!/[\\^_{}]/.test(clean)) return formula;
    const url = `https://latex.codecogs.com/png.latex?\\dpi{200}\\bg_white ${encodeURIComponent(clean)}`;
    return ` <img src="${url}" class="latex-formula" style="vertical-align: middle;" /> `;
  });
  result = result.replace(/(\\\()([\s\S]*?)(\\\))/g, (_, _s, formula) => {
    const clean = fixFormula(formula);
    const url = `https://latex.codecogs.com/png.latex?\\dpi{200}\\bg_white ${encodeURIComponent(clean)}`;
    return ` <img src="${url}" class="latex-formula" style="vertical-align: middle;" /> `;
  });
  return result;
};

const processHtmlInlineImages = (htmlText: string, getAbsoluteUrlFn: (url: string) => string, imageMapping?: Map<string, { mappedUrl: string, base64: string, width: number, height: number }>): string => {
  if (!htmlText) return "";
  let result = htmlText;
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  let match;
  const matches: { full: string; src: string }[] = [];
  while ((match = imgRegex.exec(htmlText)) !== null) {
    matches.push({ full: match[0], src: match[1] });
  }
  for (const m of matches) {
    let replacedUrl = "";
    let width = 0;
    let height = 0;
    if (imageMapping && imageMapping.has(m.src)) {
      const info = imageMapping.get(m.src)!;
      replacedUrl = info.mappedUrl;
      width = info.width;
      height = info.height;
    } else {
      replacedUrl = getAbsoluteUrlFn(m.src);
    }
    let replacedImg = m.full.replace(m.src, replacedUrl);
    
    const isLatex = m.src.includes("latex.codecogs.com");
    if (!isLatex) {
      replacedImg = forceSmallImage(replacedImg, width, height);
    }
    
    result = result.replace(m.full, replacedImg);
  }
  return result;
};

const convertToPngBase64 = async (url: string, pbToken?: string): Promise<{ base64: string, width: number, height: number }> => {
  try {
    const isPbFile = url.includes("/api/files/");
    const resp = await fetch(url, (isPbFile && pbToken) ? { headers: { "Authorization": pbToken } } : undefined);
    if (!resp.ok) return { base64: "", width: 0, height: 0 };
    const blob = await resp.blob();
    
    const isLatex = url.toLowerCase().includes("latex.codecogs.com");
    if (isLatex) {
      return await new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string || "";
            const base64Data = dataUrl.split(",")[1] || "";
            resolve({ base64: base64Data, width: img.width, height: img.height });
          };
          reader.readAsDataURL(blob);
        };
        img.onerror = () => {
          resolve({ base64: "", width: 0, height: 0 });
        };
        img.src = URL.createObjectURL(blob);
      });
    }
    
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    const objectUrl = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const w = img.width;
        const h = img.height;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
        try {
          const dataUrl = canvas.toDataURL("image/png");
          URL.revokeObjectURL(objectUrl);
          const base64Data = dataUrl.split(",")[1] || "";
          resolve({ base64: base64Data, width: w, height: h });
        } catch (canvasErr) {
          console.warn("Canvas export failed for image:", canvasErr);
          URL.revokeObjectURL(objectUrl);
          resolve({ base64: "", width: 0, height: 0 });
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ base64: "", width: 0, height: 0 });
      };
      img.src = objectUrl;
    });
  } catch (err) {
    console.error("Error converting image:", url, err);
    return { base64: "", width: 0, height: 0 };
  }
};

const ExamsPage = () => {
  const navigate = useNavigate();
  const { pb, terminology } = useTenant();
  const { user, role, teacherId } = useAuth();
  const { addToast } = useToast();
  const { subjects, teachers, teacherFullAccess, loading: dataLoading } = useExamData();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isLoading = loading || dataLoading;
  const [activeTab, setActiveTab] = useState<"aktif" | "arsip">("aktif");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedExam, setSelectedExam] = useState<ExamData | null>(null);
  const [activeExamIds, setActiveExamIds] = useState<string[]>([]);
  const [formValues, setFormValues] = useState({ title: "", subjectId: "", teacherId: "", examType: "Latihan" });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<ExamData | null>(null);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);

  // Batch Export State
  const [batchExportProgress, setBatchExportProgress] = useState<{
    isOpen: boolean;
    current: number;
    total: number;
    message: string;
  }>({
    isOpen: false,
    current: 0,
    total: 0,
    message: "",
  });

  // Batch Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgressState>({
    isOpen: false,
    current: 0,
    total: 0,
    message: "",
    title: ""
  });

  useEffect(() => {
    setSelectedIds([]);
    setLastSelectedIndex(null);
  }, [activeTab]);

  const fetchQuestionCounts = useCallback(async () => {
    if (!pb) return;
    try {
      // Kita hanya butuh examId untuk menghitung jumlah soal per exam
      const questions = await pb.collection('questions').getFullList({
        fields: 'examId',
        requestKey: 'question_counts_fetch' // Prevent cancellation issues
      });

      const counts: Record<string, number> = {};
      questions.forEach((q: any) => {
        const eId = q.examId || q.examid;
        if (eId) {
          counts[eId] = (counts[eId] || 0) + 1;
        }
      });
      setQuestionCounts(counts);
    } catch (e) {
      console.warn("Gagal load data jumlah soal:", e);
    }
  }, [pb]);

  useEffect(() => {
    fetchQuestionCounts();
    if (!pb) return;
    const unsub = pb.collection('questions').subscribe("*", fetchQuestionCounts);
    return () => {
      unsub.then(u => u()).catch(() => {});
    };
  }, [pb, fetchQuestionCounts]);

  const isOwner = useCallback((exam: any) => {
    if (role === "admin") return true;
    if (teacherFullAccess) return true;
    if (!teacherId) return false;
    // Dukung format lama (user?.id) dan baru (teacherId) serta case sensitivity
    const examTeacherId = exam.teacherId || exam.teacherid;
    return examTeacherId === teacherId || examTeacherId === user?.id;
  }, [role, teacherId, user, teacherFullAccess]);

  const filteredExams = useMemo(() => {
    return exams.filter(e => activeTab === "arsip" ? e.status === "archive" : e.status !== "archive");
  }, [exams, activeTab]);

  const selectableExams = useMemo(() => {
    return filteredExams.filter(e => isOwner(e));
  }, [filteredExams, isOwner]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(selectableExams.map(e => e.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean, index: number, event: any) => {
    let newSelectedIds = [...selectedIds];

    if (checked && event.nativeEvent.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const idsInRange = filteredExams.slice(start, end + 1).filter(e => isOwner(e)).map(e => e.id);
      newSelectedIds = Array.from(new Set([...newSelectedIds, ...idsInRange]));
    } else {
      if (checked) {
        if (!newSelectedIds.includes(id)) {
          newSelectedIds.push(id);
        }
      } else {
        newSelectedIds = newSelectedIds.filter((item) => item !== id);
      }
    }

    setSelectedIds(newSelectedIds);
    setLastSelectedIndex(index);
  };

  const columns = useMemo(() => [
    {
      key: "selection",
      label: (
        <input
          type="checkbox"
          checked={selectableExams.length > 0 && selectableExams.every(e => selectedIds.includes(e.id))}
          onChange={(e) => handleSelectAll(e.target.checked)}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer align-middle"
          title="Pilih Semua"
        />
      ),
      render: (_: any, item: any, index?: number) => {
        const canSelect = isOwner(item);
        if (!canSelect) return <div className="w-4 h-4 mx-auto" />;
        return (
          <input
            type="checkbox"
            checked={selectedIds.includes(item.id)}
            onChange={(e) => handleSelectOne(item.id, e.target.checked, index ?? 0, e)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer align-middle"
          />
        );
      },
      className: "w-[40px] text-center",
    },
    {
      key: "index",
      label: "No",
      render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
      className: "w-[60px]",
    },
    {
      key: "title",
      label: `Judul Bank Soal`,
      sortable: true,
      render: (v: string, item: any) => (
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{v}</span>
          {item.examType && (
            <div className="mt-1">
              <span className={cn("text-[9px] px-1.5 py-0 rounded font-black uppercase tracking-wider border", getExamTypeColorClass(item.examType))}>
                {item.examType}
              </span>
            </div>
          )}
        </div>
      )
    },
    {
      key: "subjectName",
      label: terminology.subject,
      sortable: true,
      render: (name: string) => (
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{name}</span>
      )
    },
    {
      key: "teacherName",
      label: `${terminology.teacher} Pengampu`,
      sortable: true,
      render: (name: string, exam: any) => {
        const teacher = teachers.find((t: any) => t.id === exam.teacherId);
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 border border-slate-200 dark:border-slate-800">
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-[10px] font-bold">
                {teacher?.code || (name || "U").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">{name}</span>
            </div>
          </div>
        );
      }
    }
  ], [teachers, selectableExams, selectedIds, terminology, isOwner, lastSelectedIndex, filteredExams]);

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

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info", onConfirm?: () => void) => {
    if (!onConfirm && (type === "success" || type === "info")) {
      addToast({ type, title, description });
      return;
    }
    setConfirmDialog({ isOpen: true, title, description, type, confirmLabel: "OK", onConfirm: onConfirm || (() => { }) });
  };

  const handleBatchArchive = () => {
    if (selectedIds.length === 0) return;
    const blockedExams = selectedIds.filter(id => activeExamIds.includes(id));
    const validExams = selectedIds.filter(id => !activeExamIds.includes(id));
    if (validExams.length === 0) {
      showAlert("Peringatan", "Semua Bank Soal yang dipilih sedang diujikan di Ruang Ujian aktif dan tidak dapat diarsipkan.", "warning");
      return;
    }
    const msg = blockedExams.length > 0
      ? `${validExams.length} bank soal akan diarsipkan (${blockedExams.length} bank soal dilewati karena sedang diujikan aktif). Lanjutkan?`
      : `Apakah Anda yakin ingin mengarsipkan ${validExams.length} bank soal terpilih?`;
    
    showAlert("Arsipkan Massal", msg, "warning", async () => {
      if (!pb) return;
      setBatchProgress({
        isOpen: true,
        total: validExams.length,
        current: 0,
        message: "Mengarsipkan bank soal...",
        title: "Arsipkan Bank Soal Massal"
      });
      try {
        for (let i = 0; i < validExams.length; i++) {
          await pb.collection('exams').update(validExams[i], { status: "archive" });
          setBatchProgress(prev => ({
            ...prev,
            current: i + 1,
            message: `Mengarsipkan (${i + 1}/${validExams.length})`
          }));
        }
        showAlert("Berhasil", `${validExams.length} bank soal berhasil diarsipkan.`, "success");
        setSelectedIds([]);
      } catch (e: any) {
        showAlert("Gagal", e.message || "Gagal mengarsipkan bank soal secara massal.", "danger");
      } finally {
        setBatchProgress(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBatchRestore = () => {
    if (selectedIds.length === 0) return;
    showAlert("Pulihkan Massal", `Apakah Anda yakin ingin memulihkan ${selectedIds.length} bank soal terpilih?`, "info", async () => {
      if (!pb) return;
      setBatchProgress({
        isOpen: true,
        total: selectedIds.length,
        current: 0,
        message: "Memulihkan bank soal...",
        title: "Pulihkan Bank Soal Massal"
      });
      try {
        for (let i = 0; i < selectedIds.length; i++) {
          await pb.collection('exams').update(selectedIds[i], { status: null });
          setBatchProgress(prev => ({
            ...prev,
            current: i + 1,
            message: `Memulihkan (${i + 1}/${selectedIds.length})`
          }));
        }
        showAlert("Berhasil", `${selectedIds.length} bank soal berhasil dipulihkan.`, "success");
        setSelectedIds([]);
      } catch (e: any) {
        showAlert("Gagal", e.message || "Gagal memulihkan bank soal secara massal.", "danger");
      } finally {
        setBatchProgress(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    const blockedExams = selectedIds.filter(id => activeExamIds.includes(id));
    const validExams = selectedIds.filter(id => !activeExamIds.includes(id));
    if (validExams.length === 0) {
      showAlert("Peringatan", "Semua Bank Soal yang dipilih sedang digunakan di Ruang Ujian aktif dan tidak dapat dihapus.", "warning");
      return;
    }
    const msg = blockedExams.length > 0
      ? `Hapus PERMANEN ${validExams.length} bank soal beserta seluruh soal di dalamnya? (${blockedExams.length} dilewati karena sedang aktif). Tindakan ini TIDAK DAPAT dikembalikan!`
      : `Hapus PERMANEN ${validExams.length} bank soal beserta seluruh soal di dalamnya? Tindakan ini TIDAK DAPAT dikembalikan!`;
    
    showAlert("Hapus Massal", msg, "danger", async () => {
      if (!pb) return;
      setBatchProgress({
        isOpen: true,
        total: validExams.length,
        current: 0,
        message: "Menghapus bank soal...",
        title: "Hapus Bank Soal Massal"
      });
      try {
        for (let i = 0; i < validExams.length; i++) {
          const examId = validExams[i];
          try {
            const questions = await pb.collection('questions').getFullList({
              filter: `examId = "${examId}"`
            });
            for (const q of questions) {
              await pb.collection('questions').delete(q.id);
            }
            await pb.collection('exams').delete(examId);
          } catch (err) {
            console.error(`Gagal menghapus exam ${examId}:`, err);
          }
          setBatchProgress(prev => ({
            ...prev,
            current: i + 1,
            message: `Menghapus (${i + 1}/${validExams.length})`
          }));
        }
        showAlert("Berhasil", `${validExams.length} bank soal berhasil dihapus permanen.`, "success");
        setSelectedIds([]);
      } catch (e: any) {
        showAlert("Gagal", e.message || "Gagal menghapus massal.", "danger");
      } finally {
        setBatchProgress(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleArchiveExam = (exam: any) => {
    if (activeExamIds.includes(exam.id)) {
      showAlert("Peringatan", "Batal mengarsipkan karena Bank Soal ini sedang diujikan di Ruang Ujian aktif.", "warning");
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Arsipkan Bank Soal",
      description: `Apakah Anda yakin ingin mengarsipkan bank soal "${exam.title}"?`,
      type: "warning",
      confirmLabel: "Arsipkan",
      onConfirm: async () => {
        if (!pb) return;
        try {
          await pb.collection('exams').update(exam.id, { status: "archive" });
        } catch (e) {
          showAlert("Gagal", "Gagal mengarsipkan bank soal.", "danger");
        }
      }
    });
  };

  const handleRestoreExam = (exam: any) => {
    setConfirmDialog({
      isOpen: true,
      title: "Pulihkan Bank Soal",
      description: `Apakah Anda yakin ingin memulihkan bank soal "${exam.title}"?`,
      type: "info",
      confirmLabel: "Pulihkan",
      onConfirm: async () => {
        if (!pb) return;
        try {
          await pb.collection('exams').update(exam.id, { status: null });
        } catch (e) {
          showAlert("Gagal", "Gagal memulihkan bank soal.", "danger");
        }
      }
    });
  };

  // Load active rooms to detect active exams
  useEffect(() => {
    const fetchActiveRooms = async () => {
      if (!pb) return;
      try {
        const rooms = await pb.collection('exam_rooms').getFullList({
          filter: 'isActive = true'
        });
        setActiveExamIds(rooms.map(r => r.examId));
      } catch (e) {
        console.error("Gagal load data ruang ujian:", e);
      }
    };

    fetchActiveRooms();
    if (!pb) return;
    const unsub = pb.collection('exam_rooms').subscribe("*", fetchActiveRooms);

    return () => {
      unsub.then(u => u()).catch(() => {});
    };
  }, [pb]);

  // Sync exams data
  useEffect(() => {
    const fetchExams = async () => {
      if (!pb) return;

      try {
        const loaded = await pb.collection('exams').getFullList({
          sort: '-created'
        });

        const mapped = loaded.map((exam) => {
          // Handle possible lowercase field names from PocketBase
          const sId = exam.subjectId || (exam as any).subjectid;
          const tId = exam.teacherId || (exam as any).teacherid;
          const type = exam.examType || (exam as any).examtype || "Latihan";

          const subjectObj = subjects.find((s: any) => s.id === sId);
          const teacherObj = teachers.find((t: any) => t.id === tId);

          const { id, ...rest } = exam;
          return {
            id,
            ...rest,
            subjectId: sId,
            teacherId: tId,
            examType: type,
            subjectName: subjectObj ? subjectObj.name : "Mapel Tidak Ditemukan",
            teacherName: teacherObj ? teacherObj.name : `${terminology.teacher} Tidak Ditemukan`,
          };
        });

        // Filter role jika bukan admin
        if (role !== "admin" && teacherId) {
          mapped.sort((a, b) => {
            const isAOwner = (a as any).teacherId === teacherId ? 1 : 0;
            const isBOwner = (b as any).teacherId === teacherId ? 1 : 0;
            return isBOwner - isAOwner;
          });
        }

        setExams(mapped);
        setLoading(false);
      } catch (e) {
        console.error("Gagal load data ujian:", e);
        setLoading(false);
      }
    };

    fetchExams();
    if (!pb) return;
    const unsub = pb.collection('exams').subscribe("*", fetchExams);

    return () => {
      unsub.then(u => u()).catch(() => {});
    };
  }, [subjects, teachers, role, user, pb]);

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedExam(null);
    setFormValues({
      title: "",
      subjectId: "",
      teacherId: role === "admin" ? "" : (teacherId || ""),
      examType: "Latihan"
    });
    setIsDialogOpen(true);
  };

  const handleDuplicateExam = (exam: ExamData) => {
    setConfirmDialog({
      isOpen: true,
      title: "Duplikat Bank Soal",
      description: `Apakah Anda yakin ingin menduplikasi "${exam.title}" beserta semua soalnya?`,
      type: "info",
      confirmLabel: "Duplikat",
      onConfirm: async () => {
        if (!pb) return;
        try {
          const newExam = await pb.collection('exams').create({
            title: `(Salinan) ${exam.title}`,
            subjectId: exam.subjectId,
            teacherId: exam.teacherId,
            examType: exam.examType || "Latihan",
          });

          const questions = await pb.collection('questions').getFullList({
            filter: `examId = "${exam.id}"`
          });

          for (const q of questions) {
            const { id, created, updated, collectionId, collectionName, ...rest } = q;
            await pb.collection('questions').create({
              ...rest,
              examId: newExam.id,
            });
          }

          addToast({ type: "success", title: "Berhasil", description: `Bank soal berhasil diduplikasi (${questions.length} soal).` });
        } catch (error) {
          addToast({ type: "error", title: "Gagal", description: "Gagal menduplikasi bank soal." });
        }
      }
    });
  };

  const handleEditClick = (exam: ExamData) => {
    setDialogMode("edit");
    setSelectedExam(exam);
    setFormValues({
      title: exam.title,
      subjectId: exam.subjectId,
      teacherId: exam.teacherId || "",
      examType: exam.examType || "Latihan"
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (exam: ExamData) => {
    if (activeExamIds.includes(exam.id)) {
      showAlert("Peringatan", "Batal menghapus karena Bank Soal ini sedang digunakan di Ruang Ujian aktif.", "warning");
      return;
    }
    setExamToDelete(exam);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pb) return;
    try {
      if (dialogMode === "edit" && selectedExam) {
        await pb.collection('exams').update(selectedExam.id, { ...formValues });
      } else {
        await pb.collection('exams').create({
          ...formValues,
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      showAlert("Gagal", "Gagal menyimpan data ujian. Periksa log browser.", "danger");
    }
  };

  const handleConfirmDelete = async () => {
    if (!examToDelete || !pb) return;
    setIsDeleting(true);
    try {
      // 1. Hapus soal terkait (opsional jika menggunakan Relasi cascade di PB)
      // Namun di PocketBase v0.23, penghapusan record yang di-relasi-kan tidak otomatis hapus record-nya
      // Kecuali diatur di API Rules. Mari kita hapus satu-satu untuk amannya:
      const questions = await pb.collection('questions').getFullList({
        filter: `examId = "${examToDelete.id}"`
      });

      for (const q of questions) {
        await pb.collection('questions').delete(q.id);
      }

      // 2. Hapus examnya
      await pb.collection('exams').delete(examToDelete.id);
    } catch (error) {
      showAlert("Gagal", "Gagal menghapus bank soal.", "danger");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // === LAPORAN PROGRESS GURU ===
  const reportData = useMemo(() => {
    const activeExams = exams.filter(e => e.status !== "archive");
    const teacherMap: Record<string, { name: string; exams: { title: string; subject: string; count: number; type: string }[]; totalQuestions: number }> = {};

    activeExams.forEach(exam => {
      const tId = exam.teacherId;
      const teacher = teachers.find((t: any) => t.id === tId);
      const subject = subjects.find((s: any) => s.id === exam.subjectId);
      const qCount = questionCounts[exam.id] || 0;

      if (!teacherMap[tId]) {
        teacherMap[tId] = { name: teacher?.name || "Tidak Diketahui", exams: [], totalQuestions: 0 };
      }
      teacherMap[tId].exams.push({ title: exam.title, subject: subject?.name || "-", count: qCount, type: exam.examType || "-" });
      teacherMap[tId].totalQuestions += qCount;
    });

    return Object.values(teacherMap).sort((a, b) => b.totalQuestions - a.totalQuestions);
  }, [exams, teachers, subjects, questionCounts]);

  const generateWAReport = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const activeExams = exams.filter(e => e.status !== "archive");
    const totalExams = activeExams.length;
    const activeExamIds = new Set(activeExams.map(e => e.id));
    const totalQuestions = Object.entries(questionCounts)
      .filter(([id]) => activeExamIds.has(id))
      .reduce((a, [, b]) => a + b, 0);

    let text = `*LAPORAN PROGRESS BANK SOAL*\n`;
    text += `${dateStr}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `*Ringkasan:*\n`;
    text += `- Total Bank Soal: *${totalExams}*\n`;
    text += `- Total Soal: *${totalQuestions}*\n`;
    text += `- Jumlah Guru: *${reportData.length}*\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Pisahkan guru yang sudah cukup (>=30) dan yang kurang (<30)
    const guruCukup = reportData.filter(t => t.exams.every(e => e.count >= 30));
    const guruKurang = reportData.filter(t => t.exams.some(e => e.count < 30));

    if (guruCukup.length > 0) {
      text += `*Sudah Memenuhi (>=30 soal):*\n\n`;
      guruCukup.forEach((t, idx) => {
        text += `*${idx + 1}. ${t.name}*\n`;
        text += `   ${t.exams.length} bank soal, ${t.totalQuestions} soal\n`;
        t.exams.forEach(e => {
          text += `   - ${e.title} (${e.subject}) — ${e.count} soal\n`;
        });
        text += `\n`;
      });
    }

    if (guruKurang.length > 0) {
      text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `*Belum Memenuhi (<30 soal):*\n\n`;
      guruKurang.forEach((t, idx) => {
        text += `*${idx + 1}. ${t.name}*\n`;
        t.exams.forEach(e => {
          if (e.count < 30) {
            text += `   - ${e.title} (${e.subject}) — ${e.count} soal, kurang ${30 - e.count}\n`;
          } else {
            text += `   - ${e.title} (${e.subject}) — ${e.count} soal\n`;
          }
        });
        text += `\n`;
      });
    }

    // Guru yang belum buat sama sekali
    const teachersWithExams = new Set(activeExams.map(e => e.teacherId));
    const teachersWithout = teachers.filter((t: any) => !teachersWithExams.has(t.id));
    if (teachersWithout.length > 0) {
      text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `*Guru Belum Membuat Bank Soal:*\n`;
      teachersWithout.forEach((t: any) => {
        text += `   - ${t.name}\n`;
      });
      text += `\n`;
    }

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `_Digenerate otomatis oleh sistem_`;
    return text;
  };

  const handleCopyReport = () => {
    const text = generateWAReport();
    navigator.clipboard.writeText(text);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2500);
  };

  const handleBatchExport = async (customExams?: ExamData[]) => {
    if (!pb) return;
    const targetExams = customExams || exams.filter(e => activeTab === "arsip" ? e.status === "archive" : e.status !== "archive");
    if (targetExams.length === 0) {
      addToast({ type: "warning", title: "Kosong", description: "Tidak ada bank soal untuk diexport." });
      return;
    }

    setBatchExportProgress({ isOpen: true, current: 0, total: targetExams.length, message: "Menyiapkan export..." });

    const getAbsoluteUrl = (url: string, rawRecord?: any): string => {
      if (!url) return "";
      if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
        return url;
      }
      const cleanUrl = url.startsWith("/") ? url.substring(1) : url;
      if (cleanUrl.startsWith("api/files/")) {
        return `${window.location.origin}/${cleanUrl}`;
      }
      if (cleanUrl.startsWith("schools/")) {
        const r2Base = import.meta.env.VITE_R2_PUBLIC_BASE_URL || "";
        if (r2Base) {
          const base = r2Base.replace(/\/$/, "");
          return `${base}/${cleanUrl}`;
        }
      }
      if (rawRecord && !url.includes("/")) {
        try {
          return pb.files.getUrl(rawRecord, url);
        } catch (e) {
          console.warn("Gagal getUrl dari pb:", e);
        }
      }
      return `${window.location.origin}/${cleanUrl}`;
    };

    const buildWordMhtml = async (examTitle: string, subjectName: string, teacherName: string, rawQuestions: any[]): Promise<string> => {
      const cleanForWord = (htmlText: string) => {
        if (!htmlText) return "";
        return htmlText
          .replace(/<p>/gi, "")
          .replace(/<\/p>/gi, "<br/>")
          .replace(/<div>/gi, "")
          .replace(/<\/div>/gi, "<br/>")
          .replace(/(<br\/>)+$/, "")
          .trim();
      };

      const stripTags = (html: string): string => {
        if (!html) return "";
        return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      };

      const urlsToConvert = new Set<string>();

      const addUrl = (url: string | undefined, rawRecord?: any) => {
        if (!url) return;
        const abs = getAbsoluteUrl(url, rawRecord);
        if (abs) {
          urlsToConvert.add(abs);
        }
      };

      const collectFromHtml = (htmlText: string | undefined, rawRecord?: any) => {
        if (!htmlText) return;
        const processed = processLatex(htmlText);
        const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
        let match;
        while ((match = imgRegex.exec(processed)) !== null) {
          addUrl(match[1], rawRecord);
        }
      };

      for (const q of rawQuestions) {
        const qType = q.type || "pilihan_ganda";
        const opts = q.options || q.choices || {};

        collectFromHtml(q.groupText, q);
        collectFromHtml(q.text, q);
        addUrl(q.imageUrl, q);

        if (qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks" || qType === "benar_salah") {
          ['a', 'b', 'c', 'd', 'e'].forEach(letter => {
            const c = opts[letter];
            if (c) {
              const cText = typeof c === 'string' ? c : (c.text || "");
              const cImg = typeof c === 'object' ? c.imageUrl : undefined;
              collectFromHtml(cText, q);
              addUrl(cImg, q);
            }
          });
        } else if (qType === "menjodohkan" && opts.pairs) {
          opts.pairs.forEach((p: any) => {
            collectFromHtml(p.left, q);
            collectFromHtml(p.right, q);
          });
        } else if ((qType === "urutkan" || qType === "drag_drop") && opts.items) {
          opts.items.forEach((item: any) => {
            collectFromHtml(item.text, q);
            addUrl(item.imageUrl, q);
          });
        }
      }

      const imageMapping = new Map<string, { mappedUrl: string, base64: string, width: number, height: number }>();
      const urlList = Array.from(urlsToConvert);
      const token = pb.authStore.token;

      for (let idx = 0; idx < urlList.length; idx++) {
        const originalUrl = urlList[idx];
        const result = await convertToPngBase64(originalUrl, token);
        if (result.base64) {
          const mappedUrl = `https://local-asset/img_${idx}.png`;
          const mappedObj = { mappedUrl, base64: result.base64, width: result.width, height: result.height };
          imageMapping.set(originalUrl, mappedObj);
          
          const abs = getAbsoluteUrl(originalUrl);
          if (abs !== originalUrl) {
            imageMapping.set(abs, mappedObj);
          }
        }
      }

      let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: 'Times New Roman', serif; color: #000; font-size: 11pt; }
  .kop { text-align: center; border-bottom: 2pt solid #000; margin-bottom: 15px; padding-bottom: 5px; }
  .hanging { margin-left: 0pt; padding-left: 0pt; text-indent: 0pt; margin-bottom: 3pt; text-align: left; }
  .choice { padding-left: 45pt; text-indent: -20pt; margin-bottom: 1pt; text-align: left; }
  img { display: block; margin: 5pt 0; border: none; }
  img.latex-formula { display: inline; margin: 0; width: auto; height: auto; vertical-align: middle; }
  .wacana { border: 1pt solid #000; padding: 10pt; margin-bottom: 15pt; background: #f5f5f5; font-style: italic; }
  .spacer { margin: 0; padding: 0; line-height: 12pt; font-size: 12pt; height: 12pt; }
  p, div, span { margin: 0; padding: 0; line-height: 1.3; text-align: left; }
</style>
</head>
<body>
  <div class="kop">
    <p style="font-size: 14pt; font-weight: bold;">NASKAH SOAL UJIAN</p>
    <p style="font-size: 12pt;">${examTitle}</p>
    <p style="font-size: 10pt; font-weight: normal;">Mata Pelajaran: ${subjectName} | ${terminology.teacher}: ${teacherName}</p>
  </div>
  <table border="0" cellpadding="0" cellspacing="0" style="width:100%; font-size: 10pt; margin-bottom: 15pt; border: none; border-collapse: collapse;">
    <tr>
      <td width="15%" style="border:none; padding: 2px;">No. Peserta</td><td width="2%" style="border:none;">:</td><td width="33%" style="border:none; border-bottom: 0.5pt solid #000;"></td>
      <td width="15%" style="border:none; padding: 2px;">${terminology.class}</td><td width="2%" style="border:none;">:</td><td style="border:none;">..........................</td>
    </tr>
    <tr>
      <td style="border:none; padding: 2px;">Nama ${terminology.student}</td><td>:</td><td style="border:none; border-bottom: 0.5pt solid #000;"></td>
      <td style="padding: 2px;">Hari/Tgl</td><td>:</td><td>..........................</td>
    </tr>
  </table>
`;

      let currentGroupId = "";
      let keysRows = "";

      for (let i = 0; i < rawQuestions.length; i++) {
        const q = rawQuestions[i];
        const num = i + 1;
        const qType = q.type || "pilihan_ganda";
        const opts = q.options || q.choices || {};
        const correctAnswer: string = (q.correctAnswer || q.correct_answer || "").toLowerCase();

        const qGroupId = q.groupId || q.group_id || "";
        const qGroupText = q.groupText || q.group_text || "";
        if (qGroupId && qGroupId !== currentGroupId && qGroupText) {
          const cleanWacana = cleanForWord(processHtmlInlineImages(processLatex(qGroupText), getAbsoluteUrl, imageMapping));
          html += `<div class="wacana"><b>STIMULUS / BACAAN:</b><br/>${cleanWacana}</div>`;
          currentGroupId = qGroupId;
        }

        const processedQText = cleanForWord(processHtmlInlineImages(processLatex(q.text || ""), getAbsoluteUrl, imageMapping));
        html += `
        <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 3pt; border: none; border-collapse: collapse;">
          <tr>
            <td valign="top" width="25" style="width: 25pt; border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3;"><b>${num}.</b></td>
            <td valign="top" style="border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3; text-align: left;"><span>${processedQText}</span></td>
          </tr>
        </table>`;

        if (q.imageUrl) {
          const absImg = getAbsoluteUrl(q.imageUrl, q);
          const info = imageMapping.get(absImg);
          if (info) {
            const displayW = Math.round(info.width > 290 ? 290 : info.width);
            const displayH = Math.round(info.width > 290 ? (info.height * 290) / info.width : info.height);
            html += `<div style="margin: 5pt 0 5pt 25pt;"><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Soal" /></div>`;
          } else {
            html += `<div style="margin: 5pt 0 5pt 25pt;"><img src="${absImg}" width="290" alt="Gambar Soal" /></div>`;
          }
        }

        if (qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks" || qType === "benar_salah") {
          const correctKeys = correctAnswer.split(/[,\s]+/).filter(Boolean);
          
          for (const letter of ['a', 'b', 'c', 'd', 'e']) {
            const c = opts[letter];
            if (c) {
              const cText = typeof c === 'string' ? c : (c.text || "");
              const cImg = typeof c === 'object' ? c.imageUrl : undefined;
              
              const processedCText = cleanForWord(processHtmlInlineImages(processLatex(cText), getAbsoluteUrl, imageMapping));
              let choiceHtml = `
              <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin-left: 25pt; margin-bottom: 1pt; border: none; border-collapse: collapse;">
                <tr>
                  <td valign="top" width="20" style="width: 20pt; border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3;">${letter.toUpperCase()}.</td>
                  <td valign="top" style="border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3; text-align: left;">
                    <span>${processedCText}</span>`;
              if (cImg) {
                const absChoiceImg = getAbsoluteUrl(cImg, q);
                const info = imageMapping.get(absChoiceImg);
                if (info) {
                  const displayW = Math.round(info.width > 181 ? 181 : info.width);
                  const displayH = Math.round(info.width > 181 ? (info.height * 181) / info.width : info.height);
                  choiceHtml += `<br/><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Pilihan" />`;
                } else {
                  choiceHtml += `<br/><img src="${absChoiceImg}" width="181" alt="Gambar Pilihan" />`;
                }
              }
              choiceHtml += `
                  </td>
                </tr>
              </table>`;
              html += choiceHtml;
            }
          }
          html += `<p class="spacer">&nbsp;</p>`;
          
          const ans = Object.entries(opts)
            .filter(([k, v]: any) => v.isCorrect === true || (typeof v === 'object' && v.isCorrect) || correctKeys.includes(k))
            .map(([k]) => k.toUpperCase())
            .sort()
            .join(", ");
          keysRows += `<tr><td align="center">${num}</td><td align="center"><b>${ans || stripTags(correctAnswer).toUpperCase() || "-"}</b></td></tr>`;
        } else if (qType === "menjodohkan" && opts.pairs) {
          html += `<div style="margin-left: 25pt; margin-bottom: 5pt;">`;
          html += `<table border="1" cellpadding="4" style="border-collapse: collapse; width: 80%;">`;
          html += `<tr style="background-color: #f3f4f6;"><th>Pernyataan 1</th><th>Pernyataan 2</th></tr>`;
          opts.pairs.forEach((p: any) => {
            html += `<tr><td>${cleanForWord(processHtmlInlineImages(processLatex(p.left || ""), getAbsoluteUrl, imageMapping))}</td><td>${cleanForWord(processHtmlInlineImages(processLatex(p.right || ""), getAbsoluteUrl, imageMapping))}</td></tr>`;
          });
          html += `</table></div>`;
          keysRows += `<tr><td align="center">${num}</td><td>Menjodohkan (Lihat Lembar Jawaban)</td></tr>`;
          html += `<p class="spacer">&nbsp;</p>`;
        } else if ((qType === "urutkan" || qType === "drag_drop") && opts.items) {
          html += `<div style="margin-left: 25pt; margin-bottom: 5pt;"><ol>`;
          opts.items.forEach((item: any) => {
            let itemHtml = `<li>${cleanForWord(processHtmlInlineImages(processLatex(item.text || ""), getAbsoluteUrl, imageMapping))}`;
            if (item.imageUrl) {
              const absItemImg = getAbsoluteUrl(item.imageUrl, q);
              const info = imageMapping.get(absItemImg);
              if (info) {
                const displayW = Math.round(info.width > 145 ? 145 : info.width);
                const displayH = Math.round(info.width > 145 ? (info.height * 145) / info.width : info.height);
                itemHtml += `<br/><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Item" />`;
              } else {
                itemHtml += `<br/><img src="${absItemImg}" width="145" alt="Gambar Item" />`;
              }
            }
            itemHtml += `</li>`;
            html += itemHtml;
          });
          html += `</ol></div>`;
          keysRows += `<tr><td align="center">${num}</td><td>${q.answerKey || correctAnswer || "-"}</td></tr>`;
          html += `<p class="spacer">&nbsp;</p>`;
        } else {
          if (qType === "uraian") {
            html += `\n  <div style="margin:4pt 0 4pt 28pt;font-size:11pt;color:#555;font-style:italic;">Jawaban:</div>
    <div style="margin:2pt 28pt 4pt 28pt;border-bottom:0.75pt solid #999;min-height:40pt;"></div>`;
          } else {
            html += `\n  <div style="margin:4pt 0 4pt 28pt;border-bottom:0.75pt solid #999;min-height:16pt;width:260pt;"></div>`;
          }
          const keyText = stripTags(q.answerKey || correctAnswer || "–");
          keysRows += `<tr><td align="center">${num}</td><td>${keyText || "–"}</td></tr>`;
          html += `<p class="spacer">&nbsp;</p>`;
        }
      }

      html += `
  <div style="page-break-before: always;"></div>
  <p align="center" style="font-weight:bold; font-size:14pt; border-bottom:1pt solid #000;">KUNCI JAWABAN</p>
  <table border="1" style="width:100%; border-collapse:collapse; margin-top:10px;">
    <tr style="background:#eee;"><th>No</th><th>Jawaban</th></tr>
    ${keysRows}
  </table>
</body></html>`;

      const boundary = "----=_NextPart_Boundary_Ujian_CBT";
      let mhtml = "";
      mhtml += "MIME-Version: 1.0\r\n";
      mhtml += `Content-Type: multipart/related; boundary="${boundary}"\r\n\r\n`;

      mhtml += `--${boundary}\r\n`;
      mhtml += "Content-Type: text/html; charset=\"utf-8\"\r\n";
      mhtml += "Content-Transfer-Encoding: 8bit\r\n\r\n";
      mhtml += html + "\r\n\r\n";

      const attachedUrls = new Set<string>();
      for (const [_, mapped] of imageMapping.entries()) {
        if (attachedUrls.has(mapped.mappedUrl)) continue;
        attachedUrls.add(mapped.mappedUrl);

        mhtml += `--${boundary}\r\n`;
        mhtml += "Content-Type: image/png\r\n";
        mhtml += "Content-Transfer-Encoding: base64\r\n";
        mhtml += `Content-Location: ${mapped.mappedUrl}\r\n\r\n`;

        const base64Formatted = mapped.base64.replace(/(.{76})/g, "$1\r\n");
        mhtml += base64Formatted + "\r\n\r\n";
      }

      mhtml += `--${boundary}--\r\n`;
      return mhtml;
    };

    try {
      const zip = new JSZip();

      for (let i = 0; i < targetExams.length; i++) {
        const exam = targetExams[i];
        const teacherName = (teachers.find((t: any) => t.id === exam.teacherId) as any)?.name || "Unknown";
        const subjectName = (subjects.find((s: any) => s.id === exam.subjectId) as any)?.name || "Unknown";

        setBatchExportProgress(prev => ({
          ...prev,
          current: i + 1,
          message: `Mengambil & memproses soal: ${exam.title} (${i + 1}/${targetExams.length})`,
        }));

        let questions: any[] = [];
        try {
          questions = await pb.collection("questions").getFullList({
            filter: `examId = "${exam.id}"`,
            sort: "order,created",
          });
        } catch (e) {
          console.warn(`Gagal fetch soal untuk exam ${exam.id}: `, e);
        }

        const wordMhtml = await buildWordMhtml(exam.title, subjectName, teacherName, questions);

        const safeName = `${teacherName} - ${exam.title}`
          .replace(/[<>:"/\\|?*]/g, "_")
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 100);

        zip.file(`${safeName}.doc`, "\ufeff" + wordMhtml);
      }

      const label = customExams ? `${customExams.length}_TERPILIH` : (activeTab === "arsip" ? "ARSIP" : "AKTIF");
      const dateStr = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `EXPORT_BANK_SOAL_${label}_${dateStr}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast({
        type: "success",
        title: "Export Berhasil",
        description: `${targetExams.length} bank soal berhasil diexport ke ZIP (format Word).`,
      });
    } catch (err) {
      console.error("Batch export error:", err);
      addToast({ type: "error", title: "Gagal", description: "Gagal export batch." });
    } finally {
      setBatchExportProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  return (
    <div className="space-y-5">
      <div className="relative z-30 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            Bank Soal (Ujian)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola master ujian dan rincian soal Bank Soal.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isLoading ? (
            <>
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-32 rounded-2xl" />
            </>
          ) : (
            <>
              <div className="flex bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 p-1 rounded-xl text-xs font-semibold">
                <button 
                  onClick={() => setActiveTab("aktif")} 
                  className={`px-3 py-1.5 rounded-lg transition-all ${ activeTab === "aktif" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200" }`}
                >
                  Aktif
                </button>
                <button 
                  onClick={() => setActiveTab("arsip")} 
                  className={`px-3 py-1.5 rounded-lg transition-all ${ activeTab === "arsip" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200" }`}
                >
                  Arsip
                </button>
              </div>
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-200">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm transition-all h-9 px-3.5 text-xs flex items-center gap-1.5"
                      >
                        <span>{selectedIds.length} - Aksi Masal</span>
                        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-2xl shadow-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-[100]">
                      <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 py-1">
                        Aksi ({selectedIds.length} Bank Soal)
                      </DropdownMenuLabel>
                      
                      {activeTab === "aktif" ? (
                        <>
                          {role === "admin" && (
                            <DropdownMenuItem
                              onClick={() => {
                                const chosen = exams.filter(e => selectedIds.includes(e.id));
                                handleBatchExport(chosen);
                              }}
                              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                            >
                              <Download className="h-4 w-4" />
                              <span>Export Terpilih (Word ZIP)</span>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            onClick={handleBatchArchive}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          >
                            <Archive className="h-4 w-4" />
                            <span>Arsipkan Bank Soal</span>
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem
                            onClick={handleBatchRestore}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                          >
                            <RotateCw className="h-4 w-4" />
                            <span>Pulihkan Bank Soal</span>
                          </DropdownMenuItem>

                          {role === "admin" && (
                            <DropdownMenuItem
                              onClick={() => {
                                const chosen = exams.filter(e => selectedIds.includes(e.id));
                                handleBatchExport(chosen);
                              }}
                              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                            >
                              <Download className="h-4 w-4" />
                              <span>Export Terpilih (Word ZIP)</span>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />

                          <DropdownMenuItem
                            onClick={handleBatchDelete}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash className="h-4 w-4" />
                            <span>Hapus Permanen</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              {role === "admin" && (
                <Button
                  onClick={() => handleBatchExport()}
                  size="sm"
                  className="rounded-2xl bg-violet-50 hover:bg-violet-100 active:bg-violet-50 border border-violet-100 dark:bg-violet-900/30 dark:text-violet-400 dark:hover:bg-violet-900/50 dark:active:bg-violet-900/30 dark:border-violet-800/40 text-violet-700 font-bold shadow-sm h-9 px-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  <Download className="mr-1 h-3.5 w-3.5" /> Export Batch
                </Button>
              )}
              <Button onClick={handleCreateClick} size="sm" className="rounded-2xl bg-blue-50 hover:bg-blue-100 active:bg-blue-50 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:active:bg-blue-900/30 dark:border-blue-800/40 text-blue-700 font-bold shadow-sm h-9 px-4 focus-visible:ring-0 focus-visible:ring-offset-0">
                <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Ujian
              </Button>
              {role === "admin" && (
                <Button onClick={() => setIsReportOpen(true)} size="sm" className="rounded-2xl bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 dark:active:bg-emerald-900/30 dark:border-emerald-800/40 text-emerald-700 font-bold shadow-sm h-9 px-4 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <ClipboardList className="mr-1 h-3.5 w-3.5" /> Laporan
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar Bank Soal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead className="w-16 text-center">No</TableHead>
                      <TableHead>Judul Ujian</TableHead>
                      <TableHead>Mata Pelajaran</TableHead>
                      <TableHead>{terminology.teacher} Pengampu</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                        <TableCell>
                           <div className="space-y-2">
                              <Skeleton className="h-4 w-48" />
                              <Skeleton className="h-3 w-24 rounded-full" />
                           </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                        <TableCell className="text-right">
                           <div className="flex justify-end gap-2">
                              <Skeleton className="h-8 w-8 rounded-lg" />
                              <Skeleton className="h-8 w-8 rounded-lg" />
                              <Skeleton className="h-8 w-8 rounded-lg" />
                           </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar Bank Soal</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={filteredExams}
              columns={columns}
              searchPlaceholder="Cari ujian..."
              emptyMessage={`Belum ada bank soal ${ activeTab }.`}
              actions={(exam: any) => (
                <div className="flex justify-end gap-1.5 items-center whitespace-nowrap">
                  <button 
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg dark:bg-purple-900/20 dark:text-purple-400 border border-purple-100 dark:border-purple-800/40 transition-all hover:shadow-sm" 
                    onClick={() => {
                      sessionStorage.setItem("activeQuestionsExamId", exam.id);
                      navigate("/admin/bank-soal/questions");
                    }}
                    title="Kelola Soal"
                  >
                    <span className="text-xs font-black">{questionCounts[exam.id] || 0}</span>
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>

                  {role === "admin" && (
                    <button 
                      className="p-1.5 bg-teal-50 text-teal-600 hover:bg-teal-100 rounded-lg dark:bg-teal-900/10 dark:text-teal-400 border border-teal-100 dark:border-teal-800/40 transition-all hover:shadow-sm" 
                      onClick={() => handleDuplicateExam(exam)}
                      title="Duplikat Bank Soal (Khusus Admin)"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                  
                  {isOwner(exam) && (
                    <>
                      {activeTab === "aktif" ? (
                        <button 
                          className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg dark:bg-amber-900/10 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40" 
                          onClick={() => handleArchiveExam(exam)}
                          title="Arsipkan"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      ) : (
                        <button 
                          className="p-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg dark:bg-indigo-900/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/40" 
                          onClick={() => handleRestoreExam(exam)}
                          title="Buka Arsip"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                      )}

                      <button 
                        className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg dark:bg-sky-900/10 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40" 
                        onClick={() => handleEditClick(exam)}
                        title="Edit Data"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {activeTab === "arsip" && (
                        <button 
                          className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg dark:bg-rose-900/10 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40" 
                          onClick={() => handleDeleteClick(exam)}
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
            <DialogTitle>{dialogMode === "edit" ? "Edit Data" : "Tambah Data"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField id="title" label="Judul" error={undefined}>
              <Input value={formValues.title} onChange={(e) => setFormValues({ ...formValues, title: e.target.value })} required />
            </FormField>

            <FormField id="examType" label="Jenis Bank Soal" error={undefined}>
              <select 
                value={formValues.examType} 
                onChange={(e) => setFormValues({ ...formValues, examType: e.target.value })} 
                required
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-card text-sm p-2"
              >
                <option value="Latihan">Latihan Biasa</option>
                <option value="Ulangan">Ulangan Harian</option>
                <option value="PTS">Ujian Tengah Semester (PTS)</option>
                <option value="PAS">Ujian Akhir Semester (PAS / PAT)</option>
                <option value="US">Ujian Sekolah (US)</option>
                <option value="Tryout">Tryout</option>
              </select>
            </FormField>

            <FormField id="subjectId" label={terminology.subject} error={undefined}>
              <select 
                value={formValues.subjectId} 
                onChange={(e) => setFormValues({ ...formValues, subjectId: e.target.value })} 
                required
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-card text-sm p-2"
              >
                <option value="">-- Pilih Mapel --</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>

            {role === "admin" && (
              <FormField id="teacherId" label={`${ terminology.teacher } Pengampu`} error={undefined}>
                <select 
                  value={formValues.teacherId} 
                  onChange={(e) => setFormValues({ ...formValues, teacherId: e.target.value })} 
                  required
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-card text-sm p-2"
                >
                  <option value="">-- Pilih {terminology.teacher} --</option>
                  {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </FormField>
            )}

            <Button type="submit" className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/20 text-blue-700 font-semibold">{dialogMode === "edit" ? "Perbarui" : "Simpan"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        type="danger"
        title="Hapus Data Bank Soal"
        description={`Apakah Anda yakin ingin menghapus "${examToDelete?.title || ""}"? Seluruh soal di dalamnya juga akan hilang.`}
        confirmLabel="Hapus"
        isLoading={isDeleting}
      />

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

      {/* Dialog Laporan Progress Guru */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="max-w-lg bg-card max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-emerald-500" />
              Laporan Progress Bank Soal
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Ringkasan */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-800">
                <p className="text-lg font-black text-slate-800 dark:text-white">{exams.filter(e => e.status !== "archive").length}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Bank Soal</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-800">
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{Object.values(questionCounts).reduce((a, b) => a + b, 0)}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Soal</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-800">
                <p className="text-lg font-black text-blue-600 dark:text-blue-400">{reportData.length}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Guru Aktif</p>
              </div>
            </div>

            {/* Detail per Guru */}
            <div className="space-y-2">
              {reportData.map((t, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{idx + 1}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-800 dark:text-white">{t.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
                      {t.totalQuestions} soal
                    </Badge>
                  </div>
                  <div className="space-y-1 ml-9">
                    {t.exams.map((e, eIdx) => (
                      <div key={eIdx} className="flex items-center gap-2 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full ${ e.count > 0 ? "bg-emerald-500" : "bg-amber-400" }`}></span>
                        <span className="text-slate-600 dark:text-slate-400 truncate flex-1">{e.title}</span>
                        <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold">{e.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Guru belum buat */}
              {(() => {
                const teachersWithExams = new Set(exams.filter(e => e.status !== "archive").map(e => e.teacherId));
                const teachersWithout = teachers.filter((t: any) => !teachersWithExams.has(t.id));
                if (teachersWithout.length === 0) return null;
                return (
                  <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800/40">
                    <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2">Belum Membuat Bank Soal</p>
                    <div className="space-y-1">
                      {teachersWithout.map((t: any) => (
                        <div key={t.id} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          <span>{t.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Tombol Copy untuk WA */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              onClick={handleCopyReport}
              className={`w-full h-11 rounded-xl font-bold text-sm transition-all ${
  reportCopied
    ? "bg-emerald-600 hover:bg-emerald-600 text-white"
    : "bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 dark:active:bg-emerald-900/30 dark:border-emerald-800/40 text-emerald-700"
}`}
            >
              {reportCopied ? (
                <><Copy className="mr-2 h-4 w-4" /> Tersalin! Tinggal Paste ke WA</>
              ) : (
                <><Copy className="mr-2 h-4 w-4" /> Salin Laporan untuk WhatsApp</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Export Progress Dialog */}
      <Dialog open={batchExportProgress.isOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm bg-card" hideClose>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />
              Export Batch Arsip
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <Progress
              value={batchExportProgress.total > 0 ? Math.round((batchExportProgress.current / batchExportProgress.total) * 100) : 0}
              className="h-2"
            />
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="truncate max-w-[220px]">{batchExportProgress.message}</span>
              <span className="font-bold ml-2 shrink-0">{batchExportProgress.current}/{batchExportProgress.total}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Operation Progress Dialog */}
      <BatchProgressDialog progress={batchProgress} colorClass="bg-indigo-600" />
    </div>
  );
};

export default ExamsPage;
