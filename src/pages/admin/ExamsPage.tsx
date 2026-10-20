import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  BookOpen,
  Trash,
  Edit,
  Archive,
  RotateCw,
  Copy,
  ClipboardList,
  Download,
  Loader2,
  X,
  ChevronDown,
  Eye,
  MoreHorizontal,
  Check,
  Search,
  FileText,
  Users,
  CheckSquare,
  GitBranch,
} from "lucide-react";
import JSZip from "jszip";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Progress } from "../../components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { getR2WorkerUrl, getR2PublicBaseUrl } from "../../lib/storage";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { useNavigate, Link } from "react-router-dom";
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
import { NeonTable, type NeonTableColumn } from "../../components/ui/NeonTable";
import {
  NeonInspector,
  InspectorSection,
  InspectorHeader,
  InspectorField,
  InspectorGrid,
  InspectorActions,
  InspectorButton,
  InspectorCard,
  InspectorEmpty,
} from "../../components/ui/NeonInspector";
import { NeonTabs } from "../../components/ui/NeonTabs";
import { NeonStatGrid, NeonStatCard } from "../../components/ui/NeonStats";
import { NeonBadge } from "../../components/ui/NeonBadge";
import { Skeleton } from "../../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { useToast } from "../../components/ui/toast";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";
import { latexToOmml } from "../../lib/latexToWordMath";

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
    case "Latihan":
    case "Latihan Biasa":
      return "bg-neutral-100 border-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300";
    case "Ulangan":
    case "Ulangan Harian":
      return "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400";
    case "PTS":
    case "Ujian Tengah Semester (PTS)":
      return "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400";
    case "PAS":
    case "Ujian Akhir Semester (PAS / PAT)":
      return "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400";
    case "US":
    case "Ujian Sekolah (US)":
      return "bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-400";
    case "Tryout":
      return "bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400";
    case "Tugas Terstruktur":
      return "bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-400";
    case "Ujian Praktik":
      return "bg-teal-500/10 border-teal-500/20 text-teal-700 dark:text-teal-400";
    default:
      return "bg-neutral-100 border-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300";
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
    const omml = latexToOmml(clean);
    if (omml) return `<br/>${omml}<br/>`;
    const url = `https://latex.codecogs.com/png.latex?\\dpi{110}\\bg_white ${encodeURIComponent(clean)}`;
    return `<br/><img src="${url}" class="latex-formula" /><br/>`;
  });
  result = result.replace(/(?<!\$)(\$)([^\$\n]+?)(\$)(?!\$)/g, (_, _s, formula) => {
    const clean = fixFormula(formula);
    if (!/[\\^_{}]/.test(clean)) return formula;
    const omml = latexToOmml(clean);
    if (omml) return ` ${omml} `;
    const url = `https://latex.codecogs.com/png.latex?\\dpi{110}\\bg_white ${encodeURIComponent(clean)}`;
    return `&nbsp;<img src="${url}" class="latex-formula" style="vertical-align: -2px; margin: 0 1pt;" />&nbsp;`;
  });
  result = result.replace(/(\\\()([\s\S]*?)(\\\))/g, (_, _s, formula) => {
    const clean = fixFormula(formula);
    const omml = latexToOmml(clean);
    if (omml) return ` ${omml} `;
    const url = `https://latex.codecogs.com/png.latex?\\dpi{110}\\bg_white ${encodeURIComponent(clean)}`;
    return `&nbsp;<img src="${url}" class="latex-formula" style="vertical-align: -2px; margin: 0 1pt;" />&nbsp;`;
  });
  return result;
};

const processHtmlInlineImages = (
  htmlText: string,
  getAbsoluteUrlFn: (url: string) => string,
  imageMapping?: Map<string, { mappedUrl: string, base64: string, width: number, height: number }>
): string => {
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
    const absSrc = getAbsoluteUrlFn(m.src);
    const info = imageMapping ? (imageMapping.get(m.src) || (absSrc ? imageMapping.get(absSrc) : undefined)) : undefined;

    if (info) {
      replacedUrl = info.mappedUrl;
      width = info.width;
      height = info.height;
      let replacedImg = m.full.replace(m.src, replacedUrl);

      const isLatex = m.src.includes("latex.codecogs.com");
      if (!isLatex) {
        replacedImg = forceSmallImage(replacedImg, width, height);
      } else if (width > 480) {
        const scaledH = Math.round((height * 480) / width);
        replacedImg = replacedImg.replace(/\/?>$/, ` width="480" height="${scaledH}"$&`);
      }

      result = result.replace(m.full, replacedImg);
    } else {
      replacedUrl = absSrc || m.src;
      let replacedImg = m.full.replace(m.src, replacedUrl);
      const isLatex = m.src.includes("latex.codecogs.com");
      if (!isLatex) {
        replacedImg = forceSmallImage(replacedImg, width, height);
      }
      result = result.replace(m.full, replacedImg);
    }
  }
  return result;
};

const convertToPngBase64 = async (
  url: string,
  pbToken?: string,
  pb?: any
): Promise<{ base64: string, width: number, height: number }> => {
  if (!url) return { base64: "", width: 0, height: 0 };

  const processDataUriWithCanvas = (dataUri: string): Promise<{ base64: string, width: number, height: number }> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, w, h);
          const outDataUrl = canvas.toDataURL("image/png");
          const base64Data = outDataUrl.split(",")[1] || "";
          resolve({ base64: base64Data, width: w, height: h });
        } catch (canvasErr) {
          console.warn("Canvas export failed for image:", canvasErr);
          const rawBase64 = dataUri.split(",")[1] || "";
          resolve({ base64: rawBase64, width: img.naturalWidth || 290, height: img.naturalHeight || 200 });
        }
      };
      img.onerror = () => {
        resolve({ base64: "", width: 0, height: 0 });
      };
      img.src = dataUri;
    });
  };

  // 1. Data URI directly
  if (url.startsWith("data:")) {
    return processDataUriWithCanvas(url);
  }

  // 2. Direct fetch with optional PocketBase authorization header
  let blob: Blob | null = null;
  const isPbFile = url.includes("/api/files/");

  try {
    const resp = await fetch(url, (isPbFile && pbToken) ? { headers: { "Authorization": pbToken } } : undefined);
    if (resp.ok) {
      blob = await resp.blob();
    }
  } catch (err) {
    // Expected when browser CORS blocks cross-origin requests
    blob = null;
  }

  // 2b. Cloudflare Worker fallback (with open CORS headers)
  const workerUrl = getR2WorkerUrl();
  const publicBaseUrl = getR2PublicBaseUrl();

  if (!blob && workerUrl) {
    try {
      let workerFetchUrl = "";
      if (publicBaseUrl && url.startsWith(publicBaseUrl)) {
        const key = url.replace(publicBaseUrl, "").replace(/^\/+/, "");
        workerFetchUrl = `${workerUrl}/${encodeURI(key)}`;
      } else if (!isPbFile) {
        workerFetchUrl = `${workerUrl}/proxy?url=${encodeURIComponent(url)}`;
      }
      if (workerFetchUrl) {
        const wResp = await fetch(workerFetchUrl);
        if (wResp.ok) {
          blob = await wResp.blob();
        }
      }
    } catch {
      // Proceed to PocketBase fallback
    }
  }

  // 3. Fallback to PocketBase image proxy if direct and worker fetch failed
  if (!blob && pb) {
    try {
      const pbBase = (pb.baseUrl || window.location.origin).replace(/\/$/, "");
      const proxyUrl = `${pbBase}/api/image-proxy?url=${encodeURIComponent(url)}`;
      const proxyResp = await fetch(proxyUrl);
      if (proxyResp.ok) {
        const json = await proxyResp.json();
        if (json.base64) {
          const mime = json.contentType || "image/png";
          const dataUri = `data:${mime};base64,${json.base64}`;
          return processDataUriWithCanvas(dataUri);
        }
      }
    } catch (proxyErr) {
      console.warn("PocketBase image proxy fallback failed for:", url, proxyErr);
    }
  }

  if (!blob) {
    return { base64: "", width: 0, height: 0 };
  }

  // 4. Codecogs LaTeX: already standard small PNG, avoid re-rendering through canvas
  const isLatex = url.toLowerCase().includes("latex.codecogs.com");
  if (isLatex) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = (reader.result as string) || "";
        const base64Data = dataUrl.split(",")[1] || "";
        const img = new window.Image();
        img.onload = () => resolve({ base64: base64Data, width: img.width, height: img.height });
        img.onerror = () => resolve({ base64: base64Data, width: 0, height: 0 });
        img.src = dataUrl;
      };
      reader.readAsDataURL(blob);
    });
  }

  // 5. All other images (WebP, JPG, PNG): load via FileReader and canvas to convert to PNG
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      if (!dataUrl) {
        resolve({ base64: "", width: 0, height: 0 });
        return;
      }
      processDataUriWithCanvas(dataUrl).then(resolve);
    };
    reader.onerror = () => resolve({ base64: "", width: 0, height: 0 });
    reader.readAsDataURL(blob);
  });
};

interface ExamsCacheData {
  exams: any[];
  questionCounts: Record<string, number>;
  activeExamIds: string[];
}
let examsCache: ExamsCacheData | null = null;

const ExamsPage = () => {
  const navigate = useNavigate();
  const { pb, terminology, school } = useTenant();
  const { user, role, teacherId } = useAuth();
  const { addToast } = useToast();
  const { subjects, teachers, teacherFullAccess, loading: dataLoading } = useExamData();
  const [exams, setExams] = useState<any[]>(() => examsCache?.exams || []);
  const [loading, setLoading] = useState(() => !examsCache);
  const isLoading = loading || (dataLoading && !examsCache);
  const [activeTab, setActiveTab] = useState<"aktif" | "arsip">("aktif");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedExam, setSelectedExam] = useState<ExamData | null>(null);
  const [activeExamIds, setActiveExamIds] = useState<string[]>(() => examsCache?.activeExamIds || []);
  const [formValues, setFormValues] = useState({ title: "", subjectId: "", teacherId: "", examType: "Latihan" });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<ExamData | null>(null);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>(() => examsCache?.questionCounts || {});
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [inspectedExamId, setInspectedExamId] = useState<string | null>(null);

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
    setSearchQuery("");
    setSubjectFilter("all");
    setTypeFilter("all");
  }, [activeTab]);

  const fetchQuestionCounts = useCallback(async () => {
    if (!pb) return;
    try {
      const counts = await pb.send("/api/exam-question-counts", {}).catch(() => null);
      if (counts && typeof counts === 'object') {
        setQuestionCounts(counts);
        return;
      }

      const questions = await pb.collection('questions').getFullList({
        fields: 'examId',
        requestKey: 'question_counts_fetch'
      });

      const countsFallback: Record<string, number> = {};
      questions.forEach((q: any) => {
        const eId = q.examId || q.examid;
        if (eId) {
          countsFallback[eId] = (countsFallback[eId] || 0) + 1;
        }
      });
      setQuestionCounts(countsFallback);
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

  const tabExams = useMemo(() => {
    return exams.filter(e => activeTab === "arsip" ? e.status === "archive" : e.status !== "archive");
  }, [exams, activeTab]);

  const displayExams = useMemo(() => {
    return tabExams.filter(exam => {
      if (subjectFilter !== "all" && exam.subjectId !== subjectFilter) {
        return false;
      }
      if (typeFilter !== "all") {
        const t = exam.examType || "Latihan";
        if (t !== typeFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const subject = subjects.find((s: any) => s.id === exam.subjectId)?.name?.toLowerCase() || "";
        const teacher = teachers.find((t: any) => t.id === exam.teacherId)?.name?.toLowerCase() || "";
        const title = (exam.title || "").toLowerCase();
        const examType = (exam.examType || "").toLowerCase();
        if (!title.includes(q) && !subject.includes(q) && !teacher.includes(q) && !examType.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [tabExams, subjectFilter, typeFilter, searchQuery, subjects, teachers]);

  const filteredExams = displayExams;

  const inspectedExam = useMemo(() => {
    if (inspectedExamId) {
      const found = displayExams.find(e => e.id === inspectedExamId);
      if (found) return found;
    }
    return displayExams[0] || null;
  }, [displayExams, inspectedExamId]);

  const selectableExams = useMemo(() => {
    return displayExams.filter(e => isOwner(e));
  }, [displayExams, isOwner]);

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
      const idsInRange = displayExams.slice(start, end + 1).filter(e => isOwner(e)).map(e => e.id);
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

  const handleBatchArchive = async () => {
    if (selectedIds.length === 0) return;
    if (!pb) return;

    let currentActiveExamIds = activeExamIds;
    try {
      const allRooms = await pb.collection('exam_rooms').getFullList({ requestKey: null });
      const activeRooms = allRooms.filter(r => r.status !== "archive" && r.isActive !== false && !r.isDisabled);
      currentActiveExamIds = activeRooms.map(r => r.examId).filter(Boolean);
      setActiveExamIds(currentActiveExamIds);
    } catch (err) {
      console.warn("Gagal refresh ruang ujian:", err);
    }

    const blockedExams = selectedIds.filter(id => currentActiveExamIds.includes(id));
    const validExams = selectedIds.filter(id => !currentActiveExamIds.includes(id));
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

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!pb) return;

    let currentActiveExamIds = activeExamIds;
    try {
      const allRooms = await pb.collection('exam_rooms').getFullList({ requestKey: null });
      const activeRooms = allRooms.filter(r => r.status !== "archive" && r.isActive !== false && !r.isDisabled);
      currentActiveExamIds = activeRooms.map(r => r.examId).filter(Boolean);
      setActiveExamIds(currentActiveExamIds);
    } catch (err) {
      console.warn("Gagal refresh ruang ujian:", err);
    }

    const blockedExams = selectedIds.filter(id => currentActiveExamIds.includes(id));
    const validExams = selectedIds.filter(id => !currentActiveExamIds.includes(id));
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

  const handleArchiveExam = async (exam: any) => {
    if (!pb) return;

    let isCurrentlyActive = activeExamIds.includes(exam.id);
    try {
      const rooms = await pb.collection('exam_rooms').getFullList({
        filter: `examId = "${exam.id}"`,
        requestKey: null
      });
      isCurrentlyActive = rooms.some(r => r.status !== "archive" && r.isActive !== false && !r.isDisabled);
    } catch (err) {
      console.warn("Gagal cek ruang ujian aktif:", err);
    }

    if (isCurrentlyActive) {
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
          requestKey: null
        });
        const activeRooms = rooms.filter(r => r.status !== "archive" && r.isActive !== false && !r.isDisabled);
        const ids = activeRooms.map(r => r.examId).filter(Boolean);
        setActiveExamIds(ids);
        if (examsCache) examsCache.activeExamIds = ids;
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
        const [loaded, counts] = await Promise.all([
          pb.collection('exams').getFullList({
            sort: '-created',
            expand: 'teacherId,subjectId'
          }),
          pb.send("/api/exam-question-counts", {}).catch(() => null)
        ]);

        if (counts && typeof counts === 'object') {
          setQuestionCounts(counts);
        }

        const mapped = loaded.map((exam) => {
          // Handle possible lowercase field names from PocketBase
          const sId = exam.subjectId || (exam as any).subjectid;
          const tId = exam.teacherId || (exam as any).teacherid;
          const type = exam.examType || (exam as any).examtype || "Latihan";

          const subjectObj = exam.expand?.subjectId || subjects.find((s: any) => s.id === sId);
          const teacherObj = exam.expand?.teacherId || teachers.find((t: any) => t.id === tId);

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
        examsCache = {
          exams: mapped,
          questionCounts: counts && typeof counts === 'object' ? counts : (examsCache?.questionCounts || {}),
          activeExamIds: examsCache?.activeExamIds || [],
        };
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
  }, [subjects, teachers, role, user, pb, teacherId, terminology.teacher]);

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

  const handleDeleteClick = async (exam: ExamData) => {
    if (!pb) return;

    let isCurrentlyActive = activeExamIds.includes(exam.id);
    try {
      const rooms = await pb.collection('exam_rooms').getFullList({
        filter: `examId = "${exam.id}"`,
        requestKey: null
      });
      isCurrentlyActive = rooms.some(r => r.status !== "archive" && r.isActive !== false && !r.isDisabled);
    } catch (err) {
      console.warn("Gagal cek ruang ujian aktif:", err);
    }

    if (isCurrentlyActive) {
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
        const r2Base = getR2PublicBaseUrl();
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
        urlsToConvert.add(url);
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
        } else if ((qType === "klasifikasi" || qType === "matriks") && opts.statements) {
          opts.statements.forEach((s: any) => {
            collectFromHtml(s.text, q);
          });
        } else if (qType === "isian_rumpang" && opts.text) {
          collectFromHtml(opts.text, q);
        } else if (qType === "hotspot") {
          if (opts.imageUrl) addUrl(opts.imageUrl, q);
        }
      }

      const imageMapping = new Map<string, { mappedUrl: string, base64: string, width: number, height: number }>();
      const urlList = Array.from(urlsToConvert);
      const token = pb.authStore.token;

      for (let idx = 0; idx < urlList.length; idx++) {
        const originalUrl = urlList[idx];
        const result = await convertToPngBase64(originalUrl, token, pb);
        if (result.base64) {
          const mappedUrl = `https://local-asset/img_${idx}.png`;
          const mappedObj = { mappedUrl, base64: result.base64, width: result.width, height: result.height };
          imageMapping.set(originalUrl, mappedObj);
          
          const abs = getAbsoluteUrl(originalUrl);
          if (abs) {
            imageMapping.set(abs, mappedObj);
          }
        }
      }

      let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns:m='http://schemas.microsoft.com/office/2004/12/omml' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: 'Times New Roman', serif; color: #000; font-size: 11pt; }
  .kop { text-align: center; border-bottom: 2pt solid #000; margin-bottom: 15px; padding-bottom: 5px; }
  .hanging { margin-left: 0pt; padding-left: 0pt; text-indent: 0pt; margin-bottom: 3pt; text-align: left; }
  .choice { padding-left: 45pt; text-indent: -20pt; margin-bottom: 1pt; text-align: left; }
  img { display: block; margin: 5pt 0; border: none; }
  img.latex-formula { display: inline; margin: 0 1pt; vertical-align: -2px; }
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
          const cleanLiterasi = cleanForWord(processHtmlInlineImages(processLatex(qGroupText), getAbsoluteUrl, imageMapping));
          html += `<div class="wacana"><b>STIMULUS / LITERASI:</b><br/>${cleanLiterasi}</div>`;
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
          const info = imageMapping.get(q.imageUrl) || (absImg ? imageMapping.get(absImg) : undefined);
          if (info) {
            const displayW = Math.round(info.width > 290 ? 290 : info.width);
            const displayH = Math.round(info.width > 290 ? (info.height * 290) / info.width : info.height);
            html += `<div style="margin: 5pt 0 5pt 25pt;"><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Soal" /></div>`;
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
                const info = imageMapping.get(cImg) || (absChoiceImg ? imageMapping.get(absChoiceImg) : undefined);
                if (info) {
                  const displayW = Math.round(info.width > 181 ? 181 : info.width);
                  const displayH = Math.round(info.width > 181 ? (info.height * 181) / info.width : info.height);
                  choiceHtml += `<br/><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Pilihan" />`;
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
              const info = imageMapping.get(item.imageUrl) || (absItemImg ? imageMapping.get(absItemImg) : undefined);
              if (info) {
                const displayW = Math.round(info.width > 145 ? 145 : info.width);
                const displayH = Math.round(info.width > 145 ? (info.height * 145) / info.width : info.height);
                itemHtml += `<br/><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Item" />`;
              }
            }
            itemHtml += `</li>`;
            html += itemHtml;
          });
          html += `</ol></div>`;
          keysRows += `<tr><td align="center">${num}</td><td>${q.answerKey || correctAnswer || "-"}</td></tr>`;
          html += `<p class="spacer">&nbsp;</p>`;
        } else if (qType === "klasifikasi" && opts.categories && opts.statements) {
          html += `<div style="margin-left: 25pt; margin-bottom: 5pt;">`;
          html += `<p style="font-size:10pt;color:#555;">Kategori: ${opts.categories.map((c: any) => cleanForWord(c.text || "")).join(" | ")}</p>`;
          html += `<ol>`;
          opts.statements.forEach((s: any) => {
            const catText = (opts.categories.find((c: any) => String(c.id) === String(s.answer)) || {}).text || s.answer;
            html += `<li>${cleanForWord(processHtmlInlineImages(processLatex(s.text || ""), getAbsoluteUrl, imageMapping))} <span style="color:#555;">(....)</span></li>`;
            keysRows += ``; // kunci digabung di bawah
          });
          html += `</ol></div>`;
          const keyStr = opts.statements.map((s: any, i: number) => {
            const catText = (opts.categories.find((c: any) => String(c.id) === String(s.answer)) || {}).text || s.answer;
            return `${i + 1}. ${catText}`;
          }).join("; ");
          keysRows += `<tr><td align="center">${num}</td><td>Klasifikasi: ${cleanForWord(keyStr)}</td></tr>`;
          html += `<p class="spacer">&nbsp;</p>`;
        } else if (qType === "matriks" && opts.columns && opts.statements) {
          html += `<div style="margin-left: 25pt; margin-bottom: 5pt;">`;
          html += `<table border="1" cellpadding="4" style="border-collapse: collapse; width: 80%;">`;
          html += `<tr style="background-color: #f3f4f6;"><th>Pernyataan</th>${opts.columns.map((c: any) => `<th>${cleanForWord(c.text || "")}</th>`).join("")}</tr>`;
          opts.statements.forEach((s: any) => {
            html += `<tr><td>${cleanForWord(processHtmlInlineImages(processLatex(s.text || ""), getAbsoluteUrl, imageMapping))}</td>${opts.columns.map(() => `<td align="center">○</td>`).join("")}</tr>`;
          });
          html += `</table></div>`;
          const keyStr = opts.statements.map((s: any, i: number) => {
            const colText = (opts.columns.find((c: any) => String(c.id) === String(s.answer)) || {}).text || s.answer;
            return `${i + 1}. ${colText}`;
          }).join("; ");
          keysRows += `<tr><td align="center">${num}</td><td>Matriks: ${cleanForWord(keyStr)}</td></tr>`;
          html += `<p class="spacer">&nbsp;</p>`;
        } else if (qType === "isian_rumpang" && opts.text) {
          const textWithBlanks = String(opts.text).replace(/\[\[(\d+)\]\]/g, " (....) ");
          html += `<div style="margin-left: 25pt; margin-bottom: 5pt;"><p>${cleanForWord(processHtmlInlineImages(processLatex(textWithBlanks), getAbsoluteUrl, imageMapping))}</p></div>`;
          const keyStr = (opts.blanks || []).map((b: any) => `[[${b.id}]]: ${(b.answers || []).join("/")}`).join("; ");
          keysRows += `<tr><td align="center">${num}</td><td>Isian Rumpang: ${cleanForWord(keyStr) || "-"}</td></tr>`;
          html += `<p class="spacer">&nbsp;</p>`;
        } else if (qType === "hotspot") {
          html += `<div style="margin-left: 25pt; margin-bottom: 5pt;"><p style="color:#555;font-style:italic;">[Soal Hotspot — klik pada gambar. Lihat versi digital.]</p></div>`;
          keysRows += `<tr><td align="center">${num}</td><td>Hotspot (Lihat Digital)</td></tr>`;
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
      mhtml += `Content-Type: multipart/related; type="text/html"; boundary="${boundary}"\r\n\r\n`;

      mhtml += `--${boundary}\r\n`;
      mhtml += "Content-Type: text/html; charset=\"utf-8\"\r\n";
      mhtml += "Content-Transfer-Encoding: 8bit\r\n";
      mhtml += "Content-Location: https://local-asset/document.html\r\n\r\n";
      mhtml += html + "\r\n\r\n";

      const attachedUrls = new Set<string>();
      for (const [_, mapped] of imageMapping.entries()) {
        if (attachedUrls.has(mapped.mappedUrl)) continue;
        attachedUrls.add(mapped.mappedUrl);

        const filename = mapped.mappedUrl.split('/').pop() || 'image.png';

        mhtml += `--${boundary}\r\n`;
        mhtml += "Content-Type: image/png\r\n";
        mhtml += "Content-Transfer-Encoding: base64\r\n";
        mhtml += `Content-ID: <${filename}>\r\n`;
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

        zip.file(`${safeName}.doc`, wordMhtml);
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

  const neonColumns: NeonTableColumn<ExamData>[] = useMemo(() => [
    {
      key: "index",
      header: "#",
      width: "40px",
      align: "center",
      render: (_, index) => (
        <span className="font-mono text-xs text-neutral-400">
          {index + 1}
        </span>
      ),
    },
    {
      key: "title",
      header: "Judul Bank Soal & Tipe",
      className: "min-w-[170px]",
      render: (exam) => {
        const qCount = questionCounts[exam.id] || 0;
        const subject = subjects.find((s: any) => s.id === exam.subjectId)?.name || (exam as any).subjectName || "-";

        return (
          <div className="flex flex-col gap-1 py-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm leading-tight hover:underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  sessionStorage.setItem("activeQuestionsExamId", exam.id);
                  navigate("/admin/bank-soal/questions");
                }}
              >
                {exam.title}
              </span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0", getExamTypeColorClass(exam.examType || "Latihan"))}>
                {exam.examType || "Latihan"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {qCount} soal
              </span>
              <span className="md:hidden text-neutral-600 dark:text-neutral-300 font-sans">
                • {subject}
              </span>
              {exam.createdAt && (
                <>
                  <span>•</span>
                  <span>{new Date(exam.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                </>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "subject",
      header: terminology.subject,
      className: "hidden md:table-cell w-32",
      headerClassName: "hidden md:table-cell w-32",
      render: (exam) => {
        const subject = subjects.find((s: any) => s.id === exam.subjectId)?.name || (exam as any).subjectName || "-";
        return (
          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            {subject}
          </span>
        );
      },
    },
    {
      key: "teacher",
      header: `${terminology.teacher} Pengampu`,
      className: "hidden lg:table-cell w-40",
      headerClassName: "hidden lg:table-cell w-40",
      render: (exam) => {
        const teacher = teachers.find((t: any) => t.id === exam.teacherId);
        const name = teacher?.name || (exam as any).teacherName || "-";
        const initials = teacher?.code || name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6 border border-neutral-200 dark:border-neutral-800 shrink-0">
              <AvatarFallback className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-[10px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[130px]">
              {name}
            </span>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Aksi",
      width: "100px",
      align: "right",
      render: (exam) => {
        const owner = isOwner(exam);
        return (
          <div className="flex justify-end items-center gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
            {/* Coba Simulasi CBT */}
            <button
              type="button"
              className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
              onClick={() => navigate(`/admin/simulate/${exam.id}`)}
              title="Coba Simulasi Tampilan Siswa"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>

            {/* Kelola Soal */}
            <button
              type="button"
              className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
              onClick={() => {
                sessionStorage.setItem("activeQuestionsExamId", exam.id);
                navigate("/admin/bank-soal/questions");
              }}
              title="Kelola Butir Soal"
            >
              <BookOpen className="h-3.5 w-3.5" />
            </button>

            {/* Menu Aksi Tambahan */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
                  title="Menu Lainnya"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-[100]">
                {owner && (
                  <DropdownMenuItem
                    onClick={() => handleEditClick(exam)}
                    className="text-xs cursor-pointer gap-2 py-1.5"
                  >
                    <Edit className="h-3.5 w-3.5 text-neutral-500" />
                    <span>Edit Data Bank Soal</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={() => handleBatchExport([exam])}
                  className="text-xs cursor-pointer gap-2 py-1.5"
                >
                  <Download className="h-3.5 w-3.5 text-neutral-500" />
                  <span>Export Word (.doc)</span>
                </DropdownMenuItem>

                {role === "admin" && (
                  <DropdownMenuItem
                    onClick={() => handleDuplicateExam(exam)}
                    className="text-xs cursor-pointer gap-2 py-1.5"
                  >
                    <Copy className="h-3.5 w-3.5 text-neutral-500" />
                    <span>Duplikat Bank Soal</span>
                  </DropdownMenuItem>
                )}

                {owner && (
                  <>
                    <DropdownMenuSeparator className="my-1 border-neutral-150 dark:border-neutral-800" />
                    {activeTab === "aktif" ? (
                      <DropdownMenuItem
                        onClick={() => handleArchiveExam(exam)}
                        className="text-xs cursor-pointer gap-2 py-1.5 text-amber-600 dark:text-amber-400"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        <span>Arsipkan</span>
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem
                          onClick={() => handleRestoreExam(exam)}
                          className="text-xs cursor-pointer gap-2 py-1.5 text-emerald-600 dark:text-emerald-400"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                          <span>Pulihkan Bank Soal</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(exam)}
                          className="text-xs cursor-pointer gap-2 py-1.5 text-rose-600 dark:text-rose-400"
                        >
                          <Trash className="h-3.5 w-3.5" />
                          <span>Hapus Permanen</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ], [questionCounts, subjects, teachers, terminology, isOwner, navigate, handleBatchExport, role, handleDuplicateExam, handleEditClick, activeTab, handleArchiveExam, handleRestoreExam, handleDeleteClick]);

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_320px] gap-6 items-start">

          {/* ═══════════════════════════════════════════════════════════════
              CENTER / MAIN CONTENT
             ═══════════════════════════════════════════════════════════════ */}
          <div className="min-w-0 space-y-6">

            {/* 1. Header Bar: Title, Breadcrumbs & Primary Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                  Bank Soal &amp; Master Ujian
                </h1>
                {/* Breadcrumb line */}
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <Link to="/admin" className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                    Semua Modul
                  </Link>
                  <span>/</span>
                  <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                    {school?.slug || "modalbangsa"}
                  </span>
                  <span>/</span>
                  <div className="flex items-center gap-1 text-neutral-800 dark:text-neutral-200 font-medium">
                    <BookOpen className="h-3.5 w-3.5 text-neutral-500" />
                    <span>bank-soal</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Top Right */}
              <div className="flex items-center gap-2 shrink-0">
                {role === "admin" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5 text-neutral-500" />
                        <span>Lainnya</span>
                        <ChevronDown className="h-3 w-3 text-neutral-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-[100]">
                      <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-2 py-1">
                        Aksi Tambahan
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => handleBatchExport()}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 text-neutral-500" />
                        <span>Export Semua ke Word ZIP</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setIsReportOpen(true)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                      >
                        <ClipboardList className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Laporan Progress Guru</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <button
                  type="button"
                  onClick={handleCreateClick}
                  className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-md shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Bank Soal</span>
                </button>
              </div>
            </div>

            {/* 2. Clean Horizontal Tabs: Bank Soal Aktif vs Bank Soal Diarsipkan */}
            <NeonTabs
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                {
                  id: "aktif",
                  label: "Bank Soal Aktif",
                  count: exams.filter(e => e.status !== "archive").length,
                  indicator: true,
                },
                {
                  id: "arsip",
                  label: "Bank Soal Diarsipkan",
                  count: exams.filter(e => e.status === "archive").length,
                },
              ]}
            />

            {/* 3. Stats Strip (4 Kartu Ringkas, Elegan, Sama Ukuran dengan Ruang Ujian) */}
            <NeonStatGrid cols={4}>
              <NeonStatCard
                label="Total Bank Soal"
                value={exams.length}
                unit="paket"
                isLoading={isLoading}
              />

              <NeonStatCard
                label="Bank Soal Aktif"
                indicator={true}
                value={exams.filter(e => e.status !== "archive").length}
                unit="paket"
                isLoading={isLoading}
              />

              <NeonStatCard
                label="Diarsipkan"
                value={exams.filter(e => e.status === "archive").length}
                unit="paket"
                isLoading={isLoading}
              />

              <NeonStatCard
                label="Total Butir Soal"
                value={Object.values(questionCounts).reduce((a, b) => a + b, 0)}
                unit="butir"
                isLoading={isLoading}
              />
            </NeonStatGrid>

            {/* 4. Main Neon Table */}
            <NeonTable
              data={displayExams}
              columns={neonColumns}
              keyExtractor={(e) => e.id}
              compact
              isLoading={isLoading}
              title="Daftar Master Bank Soal"
              subtitle="Klik baris bank soal untuk melihat inspeksi parameter & aksi cepat di panel sebelah kanan."
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Cari judul ujian, pengampu, mapel, tipe..."
              filterSlot={
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Subject filter */}
                  <select
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="h-8 text-xs rounded-md bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 px-2.5 text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                  >
                    <option value="all">Semua {terminology.subject}</option>
                    {subjects.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>

                  {/* Type filter */}
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="h-8 text-xs rounded-md bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 px-2.5 text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                  >
                    <option value="all">Semua Jenis Ujian</option>
                    <option value="Latihan">Latihan Biasa</option>
                    <option value="Ulangan">Ulangan Harian</option>
                    <option value="PTS">Ujian Tengah Semester (PTS)</option>
                    <option value="PAS">Ujian Akhir Semester (PAS / PAT)</option>
                    <option value="US">Ujian Sekolah (US)</option>
                    <option value="Tryout">Tryout</option>
                  </select>
                </div>
              }
              selectable={true}
              selectedKeys={selectedIds}
              onSelectionChange={setSelectedIds}
              isItemSelectable={isOwner}
              batchActions={
                <div className="flex items-center gap-1.5">
                  {activeTab === "aktif" ? (
                    <>
                      {role === "admin" && (
                        <button
                          type="button"
                          onClick={() => {
                            const chosen = exams.filter(e => selectedIds.includes(e.id));
                            handleBatchExport(chosen);
                          }}
                          className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-750 text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />
                          <span>Export Word ZIP</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleBatchArchive}
                        className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-amber-600 dark:text-amber-400 font-medium hover:bg-amber-50 dark:hover:bg-amber-950/40 text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Archive className="h-3 w-3" />
                        <span>Arsipkan</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleBatchRestore}
                        className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <RotateCw className="h-3 w-3" />
                        <span>Pulihkan</span>
                      </button>
                      {role === "admin" && (
                        <button
                          type="button"
                          onClick={() => {
                            const chosen = exams.filter(e => selectedIds.includes(e.id));
                            handleBatchExport(chosen);
                          }}
                          className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-750 text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />
                          <span>Export Word ZIP</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleBatchDelete}
                        className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-rose-600 dark:text-rose-400 font-medium hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Trash className="h-3 w-3" />
                        <span>Hapus Permanen</span>
                      </button>
                    </>
                  )}
                </div>
              }
              activeKey={inspectedExam?.id}
              onRowClick={(exam) => setInspectedExamId(exam.id)}
              pagination={true}
              pageSize={10}
              pageSizeOptions={[10, 25, 50]}
              emptyTitle={`Belum ada bank soal ${activeTab}`}
              emptySubtitle="Mulai dengan membuat paket bank soal baru menggunakan tombol di atas."
            />
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              RIGHT SIDEBAR / INSPECTOR PANEL (Neon Style Reusable Component)
             ═══════════════════════════════════════════════════════════════ */}
          <NeonInspector>

            {/* 1. Detail Bank Soal Terpilih (Inspector) */}
            <InspectorSection>
              <InspectorHeader
                title="Detail Bank Soal"
                icon={BookOpen}
                badge={inspectedExam ? "Terpilih" : "Ringkasan"}
              />

              {inspectedExam ? (
                <div className="space-y-2.5 text-xs">
                  <InspectorField label="Judul Paket Soal">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100 leading-snug">
                      {inspectedExam.title}
                    </div>
                    {inspectedExam.examType && (
                      <div className="mt-1">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border", getExamTypeColorClass(inspectedExam.examType))}>
                          {inspectedExam.examType}
                        </span>
                      </div>
                    )}
                  </InspectorField>

                  <InspectorGrid>
                    <InspectorField
                      label={terminology.subject}
                      value={subjects.find((s: any) => s.id === inspectedExam.subjectId)?.name || (inspectedExam as any).subjectName || "-"}
                    />
                    <InspectorField
                      label={terminology.teacher}
                      value={teachers.find((t: any) => t.id === inspectedExam.teacherId)?.name || (inspectedExam as any).teacherName || "-"}
                    />
                  </InspectorGrid>

                  <div className="pt-1 border-t border-neutral-100 dark:border-neutral-800">
                    <InspectorField
                      label="Total Butir Soal"
                      value={
                        <span className="text-base font-mono font-bold text-neutral-900 dark:text-neutral-100 mt-0.5 block">
                          {questionCounts[inspectedExam.id] || 0} Soal
                        </span>
                      }
                    />
                  </div>

                  <InspectorActions>
                    <InspectorButton
                      variant="primary"
                      icon={BookOpen}
                      onClick={() => {
                        sessionStorage.setItem("activeQuestionsExamId", inspectedExam.id);
                        navigate("/admin/bank-soal/questions");
                      }}
                    >
                      Kelola Butir Soal
                    </InspectorButton>

                    <InspectorButton
                      variant="secondary"
                      icon={Eye}
                      onClick={() => navigate(`/admin/simulate/${inspectedExam.id}`)}
                    >
                      Simulasi Tampilan Siswa
                    </InspectorButton>

                    <InspectorButton
                      variant="secondary"
                      icon={Download}
                      onClick={() => handleBatchExport([inspectedExam])}
                    >
                      Export Format Word (.doc)
                    </InspectorButton>

                    {isOwner(inspectedExam) && (
                      <InspectorButton
                        variant="secondary"
                        icon={Edit}
                        onClick={() => handleEditClick(inspectedExam)}
                      >
                        Edit Data Bank Soal
                      </InspectorButton>
                    )}

                    {role === "admin" && (
                      <InspectorButton
                        variant="secondary"
                        icon={Copy}
                        onClick={() => handleDuplicateExam(inspectedExam)}
                      >
                        Duplikat Bank Soal
                      </InspectorButton>
                    )}
                  </InspectorActions>
                </div>
              ) : (
                <InspectorEmpty message="Pilih salah satu bank soal untuk melihat inspeksi." />
              )}
            </InspectorSection>

            {/* 2. Pedoman Bank Soal */}
            <InspectorCard
              title="Pedoman Bank Soal"
              icon={FileText}
              description="Bank Soal dapat dihubungkan ke banyak Ruang Ujian. Perubahan butir soal tersinkronisasi otomatis ke seluruh ruangan yang aktif."
            >
              <div className="pt-1 flex flex-wrap gap-1 text-[10px] text-neutral-400">
                <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">LaTeX Math</span>
                <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">Listening Audio</span>
                <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">PG Kompleks</span>
                <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">Menjodohkan</span>
              </div>
            </InspectorCard>

          </NeonInspector>

        </div>
      </div>

      {/* Dialog Create/Edit (Neon Console Style) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg w-[95vw] overflow-hidden p-0 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0c0d0e] shadow-2xl flex flex-col gap-0">
          {/* Header Dialog */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 shrink-0 pr-12">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs shrink-0">
                <BookOpen className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                    {dialogMode === "edit" ? "Edit Data Bank Soal" : "Tambah Bank Soal Baru"}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                    {dialogMode === "edit" ? "Mode Edit" : "Paket Baru"}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {dialogMode === "edit"
                    ? "Perbarui metadata, tipe evaluasi, atau penugasan guru pengampu."
                    : "Buat master ujian baru untuk menampung butir soal dan jadwal CBT."}
                </p>
              </div>
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Field 1: Judul Bank Soal */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="exam-title-input" className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    Judul Bank Soal
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-neutral-400">Contoh: TO 1 TKA FISIKA</span>
                </div>
                <Input
                  id="exam-title-input"
                  value={formValues.title}
                  onChange={(e) => setFormValues({ ...formValues, title: e.target.value })}
                  required
                  placeholder="Masukkan judul bank soal..."
                  className="h-10 px-3.5 rounded-lg border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/60 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-1 focus-visible:ring-emerald-500 placeholder:text-neutral-400 transition-all"
                />
              </div>

              {/* Grid 2 Kolom: Jenis Evaluasi & Mata Pelajaran */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Jenis Bank Soal */}
                <div className="space-y-1.5">
                  <label htmlFor="exam-type-select" className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    Jenis Evaluasi
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <select 
                      id="exam-type-select"
                      value={formValues.examType} 
                      onChange={(e) => setFormValues({ ...formValues, examType: e.target.value })} 
                      required
                      className="w-full h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/60 text-xs px-3.5 pr-8 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer transition-all"
                    >
                      <option value="Latihan">Latihan Biasa</option>
                      <option value="Ulangan">Ulangan Harian</option>
                      <option value="PTS">PTS (Tengah Semester)</option>
                      <option value="PAS">PAS / PAT (Akhir Semester)</option>
                      <option value="US">Ujian Sekolah (US)</option>
                      <option value="Tryout">Tryout CBT</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                  </div>
                </div>

                {/* Mata Pelajaran */}
                <div className="space-y-1.5">
                  <label htmlFor="exam-subject-select" className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    {terminology.subject}
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <select 
                      id="exam-subject-select"
                      value={formValues.subjectId} 
                      onChange={(e) => setFormValues({ ...formValues, subjectId: e.target.value })} 
                      required
                      className="w-full h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/60 text-xs px-3.5 pr-8 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer transition-all"
                    >
                      <option value="">-- Pilih {terminology.subject} --</option>
                      {subjects.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Guru Pengampu (Khusus Admin) */}
              {role === "admin" && (
                <div className="space-y-1.5">
                  <label htmlFor="exam-teacher-select" className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    {terminology.teacher} Pengampu
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <select 
                      id="exam-teacher-select"
                      value={formValues.teacherId} 
                      onChange={(e) => setFormValues({ ...formValues, teacherId: e.target.value })} 
                      required
                      className="w-full h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/60 text-xs px-3.5 pr-8 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer transition-all"
                    >
                      <option value="">-- Pilih {terminology.teacher} Pengampu --</option>
                      {teachers.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Tips Callout */}
              <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 p-3.5 flex items-start gap-2.5 text-xs text-neutral-600 dark:text-neutral-400">
                <span className="h-5 w-5 rounded-md bg-neutral-200/60 dark:bg-neutral-800 flex items-center justify-center shrink-0 text-neutral-500 mt-0.5">
                  <FileText className="h-3 w-3" />
                </span>
                <div className="leading-relaxed text-[11px]">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">Tips:</span> Bank Soal berfungsi sebagai master induk soal CBT. Setelah disimpan, Anda dapat langsung mengimpor dari Word, mengetik manual butir soal, atau menghubungkannya ke Ruang Ujian.
                </div>
              </div>
            </div>

            {/* Footer Bar */}
            <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 flex items-center justify-between shrink-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDialogOpen(false)}
                className="h-8.5 px-3.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="h-8.5 px-4 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{dialogMode === "edit" ? "Perbarui Bank Soal" : "Simpan Bank Soal"}</span>
              </Button>
            </div>
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
        <DialogContent className="max-w-lg w-[95vw] bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-neutral-800 rounded-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 shrink-0 pr-12">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs shrink-0">
                <ClipboardList className="h-4.5 w-4.5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                  Laporan Progress Bank Soal
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Rekapitulasi kesiapan butir soal guru pengampu untuk format pesan WhatsApp.
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 p-5 sm:p-6">
            {/* Ringkasan */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-neutral-50/80 dark:bg-neutral-900/60 rounded-xl p-3 text-center border border-neutral-200/60 dark:border-neutral-800">
                <p className="text-lg font-mono font-bold text-neutral-900 dark:text-white">{exams.filter(e => e.status !== "archive").length}</p>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Bank Soal</p>
              </div>
              <div className="bg-neutral-50/80 dark:bg-neutral-900/60 rounded-xl p-3 text-center border border-neutral-200/60 dark:border-neutral-800">
                <p className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">{Object.values(questionCounts).reduce((a, b) => a + b, 0)}</p>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Total Soal</p>
              </div>
              <div className="bg-neutral-50/80 dark:bg-neutral-900/60 rounded-xl p-3 text-center border border-neutral-200/60 dark:border-neutral-800">
                <p className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">{reportData.length}</p>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Guru Aktif</p>
              </div>
            </div>

            {/* Detail per Guru */}
            <div className="space-y-2">
              {reportData.map((t, idx) => (
                <div key={idx} className="bg-neutral-50/60 dark:bg-neutral-900/50 rounded-xl p-3.5 border border-neutral-200/70 dark:border-neutral-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 bg-neutral-200 dark:bg-neutral-800 rounded-lg flex items-center justify-center font-mono text-xs font-bold text-neutral-700 dark:text-neutral-300">
                        {idx + 1}
                      </div>
                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{t.name}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                      {t.totalQuestions} soal
                    </span>
                  </div>
                  <div className="space-y-1.5 ml-8.5">
                    {t.exams.map((e, eIdx) => (
                      <div key={eIdx} className="flex items-center gap-2 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full ${ e.count > 0 ? "bg-emerald-500" : "bg-amber-400" }`}></span>
                        <span className="text-neutral-600 dark:text-neutral-400 truncate flex-1">{e.title}</span>
                        <span className="text-neutral-500 font-mono text-[11px]">{e.count}</span>
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
                  <div className="bg-amber-500/10 rounded-xl p-3.5 border border-amber-500/20">
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">Belum Membuat Bank Soal</p>
                    <div className="space-y-1">
                      {teachersWithout.map((t: any) => (
                        <div key={t.id} className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
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
          <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 flex items-center justify-between shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsReportOpen(false)}
              className="h-8.5 px-3.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 cursor-pointer"
            >
              Tutup
            </Button>
            <Button
              type="button"
              onClick={handleCopyReport}
              className={`h-8.5 px-4 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                reportCopied
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs"
              }`}
            >
              {reportCopied ? (
                <><Check className="h-3.5 w-3.5 text-white" /> <span>Tersalin ke Clipboard</span></>
              ) : (
                <><Copy className="h-3.5 w-3.5" /> <span>Salin Teks untuk WhatsApp</span></>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Export Progress Dialog */}
      <Dialog open={batchExportProgress.isOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6" hideClose>
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-neutral-500 animate-spin" />
              <span>Export Batch Arsip</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Progress
              value={batchExportProgress.total > 0 ? Math.round((batchExportProgress.current / batchExportProgress.total) * 100) : 0}
              className="h-1.5"
            />
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span className="truncate max-w-[220px]">{batchExportProgress.message}</span>
              <span className="font-mono font-bold ml-2 shrink-0">{batchExportProgress.current}/{batchExportProgress.total}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Operation Progress Dialog */}
      <BatchProgressDialog progress={batchProgress} colorClass="bg-neutral-900 dark:bg-neutral-100" />
    </div>
  );
};

export default ExamsPage;
