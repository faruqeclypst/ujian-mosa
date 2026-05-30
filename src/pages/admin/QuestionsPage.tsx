import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Edit, Trash, Check, Copy, Image, ChevronDown, FileText, Download, Eye, FolderOpen, Sparkles, Wand2, RefreshCw, BookOpen, Loader2, FileSpreadsheet, Search, X, Bookmark, Forward, CheckCircle2, Menu, Maximize2, HelpCircle, FileJson, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { Reorder } from "framer-motion";
import { MathText } from "../../components/MathText";
import { SmartImage } from "../../components/ui/smart-image";
import { generateQuestionsAI, generateSingleQuestionAI, getTopicSuggestionsAI, parseQuestionsAI, generateFromMaterialAI, generateObjectivesAI, AI_MODELS } from "../../lib/ai";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { Progress } from "../../components/ui/progress";
import { DeleteConfirmationDialog } from "../../components/ui/delete-confirmation-dialog";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";
import { Input } from "../../components/ui/input";
import { Separator } from "../../components/ui/separator";
import FormField from "../../components/forms/FormField";
import { uploadInventoryImage, deleteImageFromStorage, deleteImagesFromStorage } from "../../lib/storage";
import { ImportButton } from "../../components/ui/import-button";
import { parseQuestionsFromWord } from "../../lib/questionWordParser";
import { Select } from "../../components/ui/select";

import { downloadQuestionTemplate, parseQuestionImportExcel } from "../../lib/questionExcel";
import { jsonrepair } from "jsonrepair";
import mammoth from "mammoth";
import ReactQuill, { Quill } from "react-quill";
import ImageResize from "quill-image-resize-module-react";
import "react-quill/dist/quill.snow.css";

Quill.register("modules/imageResize", ImageResize);

// 🏗️ REGISTER TABLE EMBED (preserve tables from Word copy-paste as non-editable blocks)
const BlockEmbed = Quill.import('blots/block/embed');

class TableEmbed extends BlockEmbed {
  static blotName = 'tableEmbed';
  static tagName = 'div';
  static className = 'ql-table-embed';

  static create(value: string) {
    const node = super.create() as HTMLElement;
    node.innerHTML = value;
    node.setAttribute('contenteditable', 'false');
    node.style.margin = '0.75rem 0';
    node.style.overflowX = 'auto';
    return node;
  }

  static value(node: HTMLElement) {
    return node.innerHTML;
  }
}
Quill.register(TableEmbed);

/**
 * Wrap raw <table> tags in the ql-table-embed div so Quill can handle them.
 * Also handles the reverse: when saving, unwrap back to raw <table> for clean storage.
 */
const wrapTablesForQuill = (html: string): string => {
  if (!html || !html.includes('<table')) return html;
  // If already wrapped, don't double-wrap
  if (html.includes('ql-table-embed')) return html;
  // Strip all inline style/width/height from table elements for auto-fit
  let cleaned = html;
  // Remove style, width, height attributes from table-related tags
  cleaned = cleaned.replace(/<(table|tr|td|th|thead|tbody|col|colgroup)([^>]*?)\s+(style|width|height)="[^"]*"/gi, '<$1$2');
  cleaned = cleaned.replace(/<(table|tr|td|th|thead|tbody|col|colgroup)([^>]*?)\s+(style|width|height)="[^"]*"/gi, '<$1$2');
  cleaned = cleaned.replace(/<(table|tr|td|th|thead|tbody|col|colgroup)([^>]*?)\s+(style|width|height)="[^"]*"/gi, '<$1$2');
  // Remove colgroup elements
  cleaned = cleaned.replace(/<colgroup[\s\S]*?<\/colgroup>/gi, '');
  // Wrap all <table>...</table> blocks
  return cleaned.replace(/(<table[\s\S]*?<\/table>)/gi, '<div class="ql-table-embed" contenteditable="false">$1</div>');
};

const unwrapTablesForStorage = (html: string): string => {
  if (!html || !html.includes('ql-table-embed')) return html;
  return html.replace(/<div class="ql-table-embed"[^>]*>([\s\S]*?)<\/div>/gi, '$1');
};

// 🛠️ REGISTER CUSTOM FORMATS (only line-height, NOT margin-left/text-indent which trap indentation)
const Parchment = Quill.import('parchment');
const LineHeightStyle = new Parchment.Attributor.Style('line-height', 'line-height', {
  scope: Parchment.Scope.BLOCK
});

Quill.register(LineHeightStyle, true);
Quill.register(LineHeightStyle, true);

// 📜 FORMATS WHITELIST (Penting agar Quill tidak menghapus tag/style kustom)
const quillFormats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike', 'blockquote',
  'script',
  'list', 'bullet', 'indent',
  'link', 'image', 'video', 'formula',
  'color', 'background',
  'align', 'code-block',
  'line-height',
  'tableEmbed'
];

// Allow standard CSS styles that might come from Word/Mammoth
const AlignStyle = Quill.import('attributors/style/align');
Quill.register(AlignStyle, true);
const BackgroundStyle = Quill.import('attributors/style/background');
Quill.register(BackgroundStyle, true);
const ColorStyle = Quill.import('attributors/style/color');
Quill.register(ColorStyle, true);

import { useExamData } from "../../context/ExamDataContext";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { DataTable } from "../../components/ui/data-table";
import { useToast } from "../../components/ui/toast";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "../../components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
export type QuestionType = "pilihan_ganda" | "pilihan_ganda_kompleks" | "menjodohkan" | "benar_salah" | "isian_singkat" | "uraian" | "urutkan" | "drag_drop";

export interface QuestionData {
  id: string;
  examId: string;
  type?: QuestionType; // Default is pilihan_ganda if undefined
  text: string;
  imageUrl?: string;
  groupId?: string; // ID Kelompok/Literasi (Opsional)
  groupText?: string; // Teks khusus Literasi (Opsional)
  choices?: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }>;
  // Menjodohkan
  pairs?: Array<{ id: string; left: string; right: string }>;
  // Isian Singkat / Uraian
  answerKey?: string;
  // Urutkan / Drag & Drop
  items?: Array<{ id: string; text: string; imageUrl?: string }>;
  order?: number;
}

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    // Timeout: if compression takes > 8s, return original file
    const timeout = setTimeout(() => resolve(file), 8000);
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            clearTimeout(timeout);
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                type: "image/webp",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file); // fallback to original instead of rejecting
            }
          },
          "image/webp",
          0.80
        );
      };
      img.onerror = () => { clearTimeout(timeout); resolve(file); };
    };
    reader.onerror = () => { clearTimeout(timeout); resolve(file); };
  });
};



const QuestionsPage = () => {
  const navigate = useNavigate();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [canDrag, setCanDrag] = useState(false);
  const [examId, setExamId] = useState<string | null>(() => sessionStorage.getItem("activeQuestionsExamId"));

  useEffect(() => {
    if (!examId) {
      // Jika nyasar kesini tanpa ID, balikin ke daftar bank soal
      navigate("/admin/bank-soal", { replace: true });
    }
  }, [examId, navigate]);

  const { user, role, teacherId } = useAuth();
  const { school, pb, terminology } = useTenant();
  const { addToast } = useToast();
  const { subjects, teachers, teacherFullAccess, teacherAIAccess } = useExamData();

  // 📝 Manage Allowed Question Types
  const [allowedTypes, setAllowedTypes] = useState<Record<string, boolean>>({
    pilihan_ganda: true,
    pilihan_ganda_kompleks: true,
    menjodohkan: true,
    benar_salah: true,
    isian_singkat: true,
    urutkan: true,
    drag_drop: true,
    uraian: true,
  });

  const [activeAIConfig, setActiveAIConfig] = useState<{ model: string; provider: string }>({ model: "Unknown", provider: "groq" });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!pb) return;
      try {
        const records = await pb.collection("settings").getFullList({ limit: 1 });
        if (records.length > 0) {
          const data = records[0];
          const types = data.allowed_types || data.allowed_question_types;
          if (types) setAllowedTypes(types);
          
          setActiveAIConfig({
             model: data.ai_model || "llama-3.3-70b-versatile",
             provider: data.ai_provider || "groq"
          });
        }
      } catch (e) {
        console.warn("Failed to fetch allowed types from settings:", e);
      }
    };
    fetchSettings();
  }, []);



  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const [batchProgress, setBatchProgress] = useState<{
    isOpen: boolean;
    current: number;
    total: number;
    message: string;
    title: string;
  }>({
    isOpen: false,
    current: 0,
    total: 0,
    message: "",
    title: "Proses Data",
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionData | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const [formValues, setFormValues] = useState<{
    text: string;
    type: QuestionType;
    imageUrl?: string;
    groupId?: string;
    groupText?: string;
    choices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }>;
    pairs: Array<{ id: string; left: string; right: string }>;
    answerKey: string;
    items: Array<{ id: string; text: string; imageUrl?: string }>;
  }>({
    text: "",
    type: "pilihan_ganda",
    groupId: "",
    groupText: "",
    choices: {
      a: { text: "", isCorrect: false },
      b: { text: "", isCorrect: false },
      c: { text: "", isCorrect: false },
      d: { text: "", isCorrect: false },
      e: { text: "", isCorrect: false },
    },
    pairs: [{ id: "1", left: "", right: "" }],
    answerKey: "",
    items: [{ id: "1", text: "" }]
  });

  const [isLiterasiActive, setIsLiterasiActive] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [literasiMode, setLiterasiMode] = useState<"select" | "create">("select");
  const [isRenamingLiterasi, setIsRenamingLiterasi] = useState(false);
  const [renameLiterasiValue, setRenameLiterasiValue] = useState("");

  const existingLiteracies = useMemo(() => {
    const map: Record<string, string> = {};
    questions.forEach((q) => {
      if (q.groupId && q.groupText) {
        map[q.groupId] = q.groupText;
      }
    });
    return map;
  }, [questions]);

  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [choiceFiles, setChoiceFiles] = useState<Record<string, File | null>>({});

  const [coverSizeInfo, setCoverSizeInfo] = useState<string>("");
  const [choicesSizeInfo, setChoicesSizeInfo] = useState<Record<string, string>>({});

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<QuestionData | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryGroups, setGalleryGroups] = useState<{ title: string; images: string[] }[]>([]);
  const [galleryTarget, setGalleryTarget] = useState<{ type: "cover" | "choice" | "batch" | "quill"; letter?: string; index?: number; quillInstance?: any; quillIndex?: number } | null>(null);

  // 🤖 AI Import State
  const [isAIImportOpen, setIsAIImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<'extract' | 'generate' | 'json'>('extract');
  const [importCount, setImportCount] = useState(5);
  const [importType, setImportType] = useState('pilihan_ganda');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResults, setParsedResults] = useState<any[]>([]);
  const [isLiterasiGuideOpen, setIsLiterasiGuideOpen] = useState(false);
  const [isMathGuideOpen, setIsMathGuideOpen] = useState(false);

  const loadGalleryImages = async () => {
    const userGroups: Record<string, Set<string>> = {
      "Gambar Admin / Sistem": new Set(),
      "Soal Saya Saat Ini": new Set(),
    };

    try {
      if (pb) {
        // Fetch exams di try-catch terpisah agar tidak membatalkan fetch soal jika teacher tidak punya akses
        const examToTeacher: Record<string, string> = {};
        try {
          const examsData = await pb.collection("exams").getFullList();
          examsData.forEach(ex => {
              examToTeacher[ex.id] = ex.teacherId || ex.teacherid;
          });
        } catch (e) {
          console.warn("Gagal fetch exams list (mungkin karena pembatasan hak akses). Mapping uploader akan terbatas.");
        }

        // Fetch questions dengan getList yang lebih stabil untuk menggunakan limit (HAPUS image != "" karena error PB 400 Bad Request)
        const pRes = await pb.collection("questions").getList(1, 100, {
          filter: 'imageUrl != ""',
          sort: '-created'
        });
        const qRecords = pRes.items || [];

        const extractHtmlImages = (html: string, uploadName: string) => {
          if (!html || !html.includes("<img")) return;
          try {
            const doc = new DOMParser().parseFromString(html, "text/html");
            doc.querySelectorAll("img").forEach(img => {
              const src = img.getAttribute("src");
              if (src && !src.startsWith("data:")) userGroups[uploadName].add(src);
            });
          } catch(e) {}
        };

        qRecords.forEach((q: any) => {
          let uploaderName = "Gambar Admin / Sistem";
          
          if (q.examId) {
             const tId = examToTeacher[q.examId];
             if (tId === teacherId && tId) {
                 uploaderName = "Arsip Soal Saya";
             } else if (tId) {
                 // Cari dari list teachers
                 const foundTeacher = teachers.find((t: any) => t.id === tId);
                 if (foundTeacher) {
                    uploaderName = `Dari: ${foundTeacher.name}`;
                 }
             }
          }

          if (!userGroups[uploaderName]) userGroups[uploaderName] = new Set();
          if (q.imageUrl) userGroups[uploaderName].add(q.imageUrl);
          extractHtmlImages(q.text, uploaderName);

          if (q.options) {
            Object.values(q.options).forEach((c: any) => {
              if (c.imageUrl) userGroups[uploaderName].add(c.imageUrl);
              extractHtmlImages(c.text, uploaderName);
            });
          }
          if (q.choices) {
            Object.values(q.choices).forEach((c: any) => {
              if (c.imageUrl) userGroups[uploaderName].add(c.imageUrl);
              extractHtmlImages(c.text, uploaderName);
            });
          }
        });
      }
    } catch (e) {
      console.warn("Gagal mengambil galeri server:", e);
    }

    // Tambahkan juga dari state lokal (soal ujian yang sedang di-edit)
    const extractHtmlImagesLocal = (html: string, uploadName: string) => {
      if (!html || !html.includes("<img")) return;
      try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        doc.querySelectorAll("img").forEach(img => {
          const src = img.getAttribute("src");
          if (src && !src.startsWith("data:")) userGroups[uploadName].add(src);
        });
      } catch(e) {}
    };

    questions.forEach((q) => {
      let uploaderName = "Soal Saya Saat Ini";
      if (!userGroups[uploaderName]) userGroups[uploaderName] = new Set();
      if (q.imageUrl) userGroups[uploaderName].add(q.imageUrl);
      extractHtmlImagesLocal(q.text, uploaderName);
      if (q.choices) {
        Object.values(q.choices).forEach((c) => {
          if (c.imageUrl) userGroups[uploaderName].add(c.imageUrl);
          extractHtmlImagesLocal(c.text || "", uploaderName);
        });
      }
    });

    const arr: { title: string; images: string[] }[] = Object.keys(userGroups)
        .map(key => ({ title: key, images: Array.from(userGroups[key]) }))
        .filter(g => g.images.length > 0);

    setGalleryGroups(arr);
  };

  const handlePickGallery = (url: string) => {
    if (!galleryTarget) return;

    if (galleryTarget.type === "cover") {
      setFormValues((prev) => ({ ...prev, imageUrl: url }));
      setQuestionFile(null); // Reset file picker
      setCoverSizeInfo("(Dari Galeri)");
    } else if (galleryTarget.type === "choice" && galleryTarget.letter) {
      const letter = galleryTarget.letter;
      handleChoiceChange(letter, "imageUrl", url);
      setChoiceFiles((prev) => ({ ...prev, [letter]: null }));
      setChoicesSizeInfo((prev) => ({ ...prev, [letter]: "(Dari Galeri)" }));
    } else if (galleryTarget.type === "batch" && galleryTarget.index !== undefined) {
      updateBatchItem(galleryTarget.index, "imageUrl", url);
      updateBatchItem(galleryTarget.index, "imageFile", null); // Reset file jika ada
    } else if (galleryTarget.type === "quill" && galleryTarget.quillInstance) {
      const q = galleryTarget.quillInstance;
      const targetIndex = galleryTarget.quillIndex !== undefined ? galleryTarget.quillIndex : (q.getSelection()?.index || 0);
      q.insertEmbed(targetIndex, "image", url);
      setTimeout(() => {
        const imgs = q.root.querySelectorAll('img');
        imgs.forEach((img: any) => {
          if (img.getAttribute('src') === url) {
             img.setAttribute('width', '350');
             img.style.display = 'block';
             img.style.margin = '10px auto';
          }
        });
      }, 10);
      q.setSelection(targetIndex + 1);
    }

    setIsGalleryOpen(false);
  };

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const globalFileInputRef = useRef<HTMLInputElement>(null);

  const handleGlobalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      showAlert("Gagal", "Ukuran file gambar maksimal adalah 2MB.", "danger");
      return;
    }

    let fileToUpload = file;
    const origSize = formatSize(file.size);

    if (file.size > 200 * 1024) {
      fileToUpload = await compressImage(file);
    }
    const finalSize = formatSize(fileToUpload.size);

    if (!galleryTarget) return;

    if (galleryTarget.type === "cover") {
      setFormValues((prev) => ({ ...prev, imageUrl: "" }));
      setQuestionFile(fileToUpload);
      setCoverSizeInfo(`${origSize} -> ${finalSize}`);
    } else if (galleryTarget.type === "choice" && galleryTarget.letter) {
      const letter = galleryTarget.letter;
      setChoiceFiles((prev) => ({ ...prev, [letter]: fileToUpload }));
      handleChoiceChange(letter, "imageUrl", "");
      setChoicesSizeInfo((prev) => ({ ...prev, [letter]: `${origSize} -> ${finalSize}` }));
    } else if (galleryTarget.type === "batch" && galleryTarget.index !== undefined) {
      updateBatchItem(galleryTarget.index, "imageFile", fileToUpload);
      updateBatchItem(galleryTarget.index, "imageUrl", ""); 
    } else if (galleryTarget.type === "quill" && galleryTarget.quillInstance) {
       const reader = new FileReader();
       reader.readAsDataURL(fileToUpload);
       reader.onload = () => {
         const base64 = reader.result as string;
         const q = galleryTarget.quillInstance;
         const targetIndex = galleryTarget.quillIndex !== undefined ? galleryTarget.quillIndex : (q.getSelection()?.index || 0);
         q.insertEmbed(targetIndex, "image", base64);
         
         setTimeout(() => {
           const imgs = q.root.querySelectorAll('img');
           imgs.forEach((img: any) => {
             if (img.getAttribute('src') === base64) {
               img.setAttribute('width', '350');
               img.style.display = 'block';
               img.style.margin = '10px auto';
             }
           });
         }, 10);
         q.setSelection(targetIndex + 1);
       };
    }

    setIsPickerOpen(false);
    if (globalFileInputRef.current) globalFileInputRef.current.value = "";
  };

  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false); // <--- Delete All State

  const tambahRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // isTambahMenuOpen logic removed as it's now a DropdownMenu
    };
    return () => {};
  }, []);

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [batchDragState, setBatchDragState] = useState<{ questionIndex: number; itemIndex: number } | null>(null);
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false, title: "", description: "", type: "info", confirmLabel: "Ok", onConfirm: () => { } });

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info", onConfirm?: () => void, showCancel: boolean = false, confirmLabel: string = "OK") => {
    if (!onConfirm && !showCancel && (type === "success" || type === "info")) {
      addToast({ type, title, description, duration: 3000 });
      return;
    }
    setConfirmModal({
      isOpen: true,
      title,
      description,
      type: type === "danger" ? "danger" : (type === "warning" ? "warning" : "info"),
      confirmLabel,
      onConfirm: onConfirm || (() => { }),
      showCancel
    });
  };

  // 🪄 AI States
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isAIGeneratingDirect, setIsAIGeneratingDirect] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const aiAbortRef = useRef<AbortController | null>(null);
  const aiProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAIProgress = () => {
    setAiProgress(0);
    if (aiProgressRef.current) clearInterval(aiProgressRef.current);
    let progress = 0;
    aiProgressRef.current = setInterval(() => {
      // Simulate progress: fast at start, slow near end
      const increment = progress < 30 ? 3 : progress < 60 ? 2 : progress < 85 ? 0.5 : 0.1;
      progress = Math.min(progress + increment, 95);
      setAiProgress(Math.round(progress));
    }, 300);
  };

  const stopAIProgress = (success: boolean) => {
    if (aiProgressRef.current) { clearInterval(aiProgressRef.current); aiProgressRef.current = null; }
    setAiProgress(success ? 100 : 0);
    if (success) setTimeout(() => setAiProgress(0), 1000);
  };

  const cancelAIGeneration = () => {
    if (aiAbortRef.current) { aiAbortRef.current.abort(); aiAbortRef.current = null; }
    stopAIProgress(false);
    setIsAIGenerating(false);
    setIsAIGeneratingDirect(false);
    setIsParsing(false);
    addToast({ title: "Dibatalkan", description: "Generasi AI dibatalkan.", type: "info" });
  };
  const [isRegeneratingIndex, setIsRegeneratingIndex] = useState<number | null>(null);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiLevel, setAiLevel] = useState("");
  const [aiSubject, setAiSubject] = useState("");
  const [aiType, setAiType] = useState<any>("pilihan_ganda");
  const [isAiLiteracy, setIsAiLiteracy] = useState(false);
  const [aiPassageLength, setAiPassageLength] = useState("sedang");
  const [aiDifficulty, setAiDifficulty] = useState("sedang"); 
  const [aiTaxonomy, setAiTaxonomy] = useState<string[]>(["C1","C2","C3","C4","C5","C6"]); // multi-select C1-C6
  const [aiMaterialFile, setAiMaterialFile] = useState<File | null>(null);
  const [aiMaterialText, setAiMaterialText] = useState("");
  const [aiMaterialFileName, setAiMaterialFileName] = useState("");
  const [isExtractingMaterial, setIsExtractingMaterial] = useState(false);
  const [aiObjectives, setAiObjectives] = useState<string[]>([]); // tujuan pembelajaran dari AI
  const [isFetchingObjectives, setIsFetchingObjectives] = useState(false);

  const toggleTaxonomy = (level: string) => {
    setAiTaxonomy(prev => {
      if (prev.includes(level)) {
        const next = prev.filter(l => l !== level);
        return next.length === 0 ? [level] : next; // minimal 1 harus dipilih
      }
      return [...prev, level];
    });
  };

  const setTaxonomyPreset = (preset: "lots" | "hots" | "campuran") => {
    if (preset === "lots") setAiTaxonomy(["C1", "C2", "C3"]);
    else if (preset === "hots") setAiTaxonomy(["C4", "C5", "C6"]);
    else setAiTaxonomy(["C1", "C2", "C3", "C4", "C5", "C6"]);
  };

  const getTaxonomyPreset = (): string => {
    const sorted = [...aiTaxonomy].sort();
    if (sorted.join(",") === "C1,C2,C3") return "lots";
    if (sorted.join(",") === "C4,C5,C6") return "hots";
    if (sorted.join(",") === "C1,C2,C3,C4,C5,C6") return "campuran";
    return "";
  };

  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (aiLevel && aiSubject && aiSubject.length > 2) {
        setIsFetchingSuggestions(true);
        try {
          if (!pb) return;
          const suggestions = await getTopicSuggestionsAI(
            pb,
            aiLevel, 
            aiSubject, 
            aiDifficulty, 
            aiType, 
            "umum", 
            isAiLiteracy
          );
          if (suggestions && suggestions[0] === "AI_RATE_LIMIT") {
            setDynamicSuggestions([]);
          } else {
            setDynamicSuggestions(suggestions);
          }
        } catch (err) {
          console.error("Failed to fetch suggestions:", err);
        } finally {
          setIsFetchingSuggestions(false);
        }
      } else {
        setDynamicSuggestions([]);
      }
    };

    const timer = setTimeout(fetchSuggestions, 1500);
    return () => clearTimeout(timer);
  }, [aiLevel, aiSubject, aiTaxonomy, isAiLiteracy]);

  // 🎯 Auto-generate Tujuan Pembelajaran berdasarkan topik + taksonomi (per-level C)
  useEffect(() => {
    const fetchObjectives = async () => {
      if ((aiTopic.trim().length > 3 || aiMaterialText.trim().length > 20) && aiTaxonomy.length > 0 && pb) {
        setIsFetchingObjectives(true);
        try {
          const objectives = await generateObjectivesAI(
            pb,
            aiTopic || "(dari bahan materi)",
            aiTaxonomy,
            aiLevel,
            aiSubject,
            aiMaterialText
          );
          if (objectives && objectives.length > 0) {
            setAiObjectives(objectives);
          }
        } catch (err) {
          console.error("Failed to fetch objectives:", err);
        } finally {
          setIsFetchingObjectives(false);
        }
      } else {
        setAiObjectives([]);
      }
    };

    const timer = setTimeout(fetchObjectives, 2000);
    return () => clearTimeout(timer);
  }, [aiTopic, aiTaxonomy, aiLevel, aiSubject, aiMaterialText]);

  // 🪄 Auto-generate Topik dari AI berdasarkan jenjang + mapel + materi
  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);
  const handleGenerateTopic = async () => {
    if (!pb) return;
    if (!aiSubject && !aiMaterialText) {
      addToast({ type: "warning", title: "Isi dulu", description: "Isi Mata Pelajaran atau upload bahan materi terlebih dahulu.", duration: 2500 });
      return;
    }
    setIsGeneratingTopic(true);
    try {
      const suggestions = await getTopicSuggestionsAI(
        pb, aiLevel || "Umum", aiSubject || "Umum", aiDifficulty, aiType, "umum", isAiLiteracy
      );
      if (suggestions && suggestions.length > 0 && suggestions[0] !== "AI_RATE_LIMIT") {
        // Pick a random one
        const picked = suggestions[Math.floor(Math.random() * suggestions.length)];
        setAiTopic(String(picked));
        addToast({ type: "success", title: "Topik Digenerate", description: String(picked), duration: 2000 });
      }
    } catch (err) {
      console.error("Generate topic error:", err);
    } finally {
      setIsGeneratingTopic(false);
    }
  };


  const handleRandomFill = () => {
    const presets = [
      { level: "SD Kelas 4", subject: "IPA", topic: "Daur Hidup Kupu-kupu & Metamorfosis" },
      { level: "SMP Kelas 8", subject: "Matematika", topic: "Teorema Pythagoras & Segitiga Siku-siku" },
      { level: "SMA Kelas 11", subject: "Sejarah Indonesia", topic: "Dampak Penjajahan Belanda di Indonesia" },
      { level: "SD Kelas 6", subject: "Bahasa Indonesia", topic: "Cara Membuat Laporan Hasil Pengamatan" },
      { level: "SMA Kelas 12", subject: "Informatika", topic: "Dampak Sosial Informatika & Keamanan Data" },
      { level: "SMP Kelas 9", subject: "Bahasa Inggris", topic: "Narrative Text: The Legend of Malin Kundang" }
    ];
    const random = presets[Math.floor(Math.random() * presets.length)];
    setAiLevel(random.level);
    setAiSubject(random.subject);
    setAiTopic(random.topic);
    addToast({
      type: "info",
      title: "Form Terisi Otomatis",
      description: `Preset ${random.subject} Kelas ${random.level} telah dimuat.`,
      duration: 2000
    });
  };

  const handleAIMaterialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingMaterial(true);
    try {
      let extractedText = "";
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === "docx" || extension === "docm") {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (extension === "pdf") {
        let pdfjs = (window as any).pdfjsLib;
        if (!pdfjs) {
          await new Promise<void>((resolve) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
            script.onload = () => {
              (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
              resolve();
            };
            document.head.appendChild(script);
          });
          pdfjs = (window as any).pdfjsLib;
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          fullText += pageText + "\n";
        }
        extractedText = fullText;
      } else if (extension === "pptx" || extension === "ppt") {
        // Basic PPTX text extraction via JSZip
        const JSZip = (await import("jszip")).default;
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        let fullText = "";
        const slideFiles = Object.keys(zip.files).filter(f => f.match(/ppt\/slides\/slide\d+\.xml/)).sort();
        for (const slideFile of slideFiles) {
          const content = await zip.files[slideFile].async("text");
          const textMatches = content.match(/<a:t>([^<]*)<\/a:t>/g);
          if (textMatches) {
            const slideText = textMatches.map(m => m.replace(/<\/?a:t>/g, "")).join(" ");
            fullText += slideText + "\n";
          }
        }
        extractedText = fullText;
      } else if (extension === "png" || extension === "jpg" || extension === "jpeg") {
        // For images, we store the file and let AI handle it via description
        setAiMaterialFile(file);
        setAiMaterialFileName(file.name);
        setAiMaterialText(`[Gambar: ${file.name}] - AI akan menganalisis gambar ini sebagai referensi materi.`);
        addToast({ title: "Gambar Dimuat", description: `${file.name} siap digunakan sebagai referensi.`, type: "success", duration: 2000 });
        setIsExtractingMaterial(false);
        if (e.target) e.target.value = "";
        return;
      }

      if (extractedText.trim()) {
        // Limit to ~4000 chars to fit in prompt context
        const trimmed = extractedText.trim().substring(0, 4000);
        setAiMaterialText(trimmed);
        setAiMaterialFileName(file.name);
        setAiMaterialFile(file);
        addToast({ title: "Materi Berhasil Diekstrak", description: `${file.name} (${Math.round(trimmed.length / 1000)}k karakter)`, type: "success", duration: 2000 });
      } else {
        throw new Error("Gagal mengekstrak teks dari file.");
      }
    } catch (err: any) {
      addToast({ title: "Gagal Membaca File", description: err.message || "Pastikan file tidak rusak.", type: "error" });
    } finally {
      setIsExtractingMaterial(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleAIGenerateDirect = async () => {
    if (!pb) return;
    setIsAIGeneratingDirect(true);
    startAIProgress();
    aiAbortRef.current = new AbortController();
    try {
      const generated = await generateQuestionsAI(
        pb,
        aiTopic || (exam?.subject + " " + (exam?.name?.split(' ')[0] || "")) || "Umum", 
        aiCount, 
        aiLevel, 
        aiSubject || (exam?.subject || ""), 
        aiType, 
        isAiLiteracy,
        aiPassageLength,
        aiDifficulty,
        "umum",
        aiTaxonomy.join(","),
        aiMaterialText,
        aiObjectives
      );
      
      const questionsForReview = generated.map(q => {
        const qType = q.type || aiType;
        const choicesBatch: Record<string, { text: string }> = {};
        let correctKey = "";
        
        // For choice-based types
        if (q.choices && (qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks" || qType === "benar_salah")) {
          const correctKeys: string[] = [];
          Object.keys(q.choices).forEach(key => {
            choicesBatch[key] = { text: q.choices![key].text };
            if (q.choices![key].isCorrect) {
              correctKeys.push(key);
            }
          });
          correctKey = correctKeys.length > 0 ? correctKeys.join(",") : (q.answerKey || "").toLowerCase();
        }
        
        return {
          text: q.text,
          type: qType,
          choices: Object.keys(choicesBatch).length > 0 ? choicesBatch : undefined,
          correctKey: correctKey,
          answerKey: q.answerKey || "",
          pairs: q.pairs || (qType === "menjodohkan" ? [] : undefined),
          items: q.items || (qType === "urutkan" || qType === "drag_drop" ? [] : undefined),
          groupId: q.groupId || "",
          groupText: q.groupText || "",
          isFromAI: true
        };
      });

      setBatchQuestions(questionsForReview);
      addToast({
        type: "success",
        title: "Generasi Selesai",
        description: `${generated.length} soal baru telah dibuat.`,
        duration: 3000
      });
    } catch (err: any) {
      console.error("AI Direct Generate Error:", err);
      if (err.message?.startsWith("AI_RATE_LIMIT")) {
        const parts = err.message.split("|");
        if (parts.length >= 5) {
          const [, limit, used, remaining, requested] = parts;
          showAlert("Limit Harian Tercapai", `Kuota token harian habis.\n\n• Limit: ${Number(limit).toLocaleString()} token/hari\n• Terpakai: ${Number(used).toLocaleString()} token\n• Sisa: ${Number(remaining).toLocaleString()} token\n• Diminta: ${Number(requested).toLocaleString()} token\n\nSilakan tunggu reset harian atau upgrade plan Groq.`, "danger");
        } else {
          showAlert("Limit Tercapai", "Server AI sedang sibuk karena terlalu banyak permintaan. Silakan tunggu sekitar 1-2 menit sebelum mencoba lagi.", "danger");
        }
      } else {
        addToast({ type: "error", title: "Gagal", description: "Generasi gagal setelah beberapa percobaan. Coba lagi." });
      }
    } finally {
      stopAIProgress(true);
      setIsAIGeneratingDirect(false);
      aiAbortRef.current = null;
    }
  };



  const handleAIRegenerateSingle = async (index: number) => {
    if (!pb) return;
    setIsRegeneratingIndex(index);
    try {
      const q = batchQuestions[index];
      const topicFallback = [aiTopic, exam?.subject, exam?.name?.split(' ')[0]].filter(Boolean).join(' ') || "Umum";
      const regenerated = await generateSingleQuestionAI(
        pb,
        topicFallback,
        q.type || aiType || "pilihan_ganda",
        aiLevel || exam?.level || "Umum",
        aiSubject || exam?.subject || "Umum",
        aiDifficulty || "sedang",
        "umum",
        q.groupText || ""
      );

      if (!regenerated || !regenerated.text) {
        throw new Error("AI tidak menghasilkan soal yang valid.");
      }

      const choicesBatch: Record<string, { text: string }> = {};
      let correctKey = (regenerated.answerKey || "").toLowerCase();
      
      if (regenerated.choices) {
        if (Array.isArray(regenerated.choices)) {
          regenerated.choices.forEach((c: any, i: number) => {
            const key = String.fromCharCode(97 + i);
            choicesBatch[key] = { text: typeof c === 'object' ? (c.text || String(c)) : String(c) };
            if (typeof c === 'object' && c.isCorrect) correctKey = key;
          });
        } else {
          Object.keys(regenerated.choices).forEach(key => {
            const lowerKey = key.toLowerCase();
            const val = (regenerated.choices as any)[key];
            choicesBatch[lowerKey] = { text: typeof val === 'object' ? (val.text || String(val)) : String(val) };
            if (typeof val === 'object' && val.isCorrect) correctKey = lowerKey;
          });
        }
      }

      const updatedRow = {
        ...q,
        text: regenerated.text,
        choices: choicesBatch,
        correctKey: correctKey,
        answerKey: regenerated.answerKey || "",
        isFromAI: true
      };

      const updatedBatch = [...batchQuestions];
      updatedBatch[index] = updatedRow;
      setBatchQuestions(updatedBatch);
      addToast({
        type: "success",
        title: "Soal Diperbarui",
        description: `Soal #${index+1} berhasil ditampilkan ulang.`,
        duration: 3000
      });
    } catch (err: any) {
      console.error("AI Single Regenerate Error:", err);
      if (err.message?.startsWith("AI_RATE_LIMIT")) {
        const parts = err.message.split("|");
        if (parts.length >= 5) {
          const [, limit, used, remaining, requested] = parts;
          showAlert("Limit Harian Tercapai", `Kuota token harian habis.\n• Limit: ${Number(limit).toLocaleString()} token/hari\n• Terpakai: ${Number(used).toLocaleString()}\n• Sisa: ${Number(remaining).toLocaleString()}\n• Diminta: ${Number(requested).toLocaleString()}\n\nTunggu reset harian atau upgrade plan.`, "danger");
        } else {
          showAlert("Limit Tercapai", "Permintaan terlalu cepat. Silakan tunggu 1 menit agar AI siap kembali.", "danger");
        }
      } else {
        addToast({ type: "error", title: "Gagal", description: "Regenerasi gagal setelah beberapa percobaan. Coba lagi." });
      }
    } finally {
      setIsRegeneratingIndex(null);
    }
  };

  const handleAIParse = async () => {
    if (!importText.trim() || !pb) return;
    
    // JSON mode: parse directly without AI
    if (importMode === 'json') {
      try {
        let parsed: any;
        let trimmed = importText.trim();
        
        // Handle concatenated arrays: ][  → merge into single array
        if (trimmed.includes('][')) {
          trimmed = trimmed.replace(/\]\s*\[/g, ',');
        }
        
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          // Fallback: repair JSON (handles trailing commas, missing quotes, etc.)
          try {
            parsed = JSON.parse(jsonrepair(trimmed));
          } catch {
            throw new Error("JSON tidak valid. Periksa format data Anda.");
          }
        }
        const questionsArr: any[] = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.soal || parsed.data || []);
        
        if (questionsArr.length === 0) {
          addToast({ title: "Gagal", description: "JSON tidak berisi soal yang valid.", type: "error" });
          return;
        }

        const results = questionsArr.map((q: any) => {
          const choices = q.choices || q.options || {};
          let correctKey = q.answerKey || q.answer_key || q.correctAnswer || q.correct_answer || "";
          
          // Normalize choices
          const normalizedChoices: any = {};
          if (choices && typeof choices === 'object') {
            Object.keys(choices).forEach(k => {
              const val = choices[k];
              if (typeof val === 'string') {
                normalizedChoices[k] = { text: val, isCorrect: correctKey.includes(k) };
              } else if (typeof val === 'object' && val) {
                normalizedChoices[k] = { text: val.text || "", imageUrl: val.imageUrl || val.image_url || undefined, isCorrect: !!val.isCorrect };
                if (val.isCorrect && !correctKey) correctKey = k;
              }
            });
          }
          
          if (!correctKey && normalizedChoices) {
            const correctKeys = Object.keys(normalizedChoices).filter(k => normalizedChoices[k].isCorrect);
            correctKey = correctKeys.join(",");
          }

          return {
            text: q.text || q.question || "",
            type: q.type || "pilihan_ganda",
            choices: normalizedChoices,
            answerKey: correctKey,
            imageUrl: q.imageUrl || q.image_url || "",
            groupId: q.groupId || q.group_id || "",
            groupText: q.groupText || q.group_text || "",
            pairs: q.pairs || undefined,
            items: q.items || undefined,
          };
        }).filter((q: any) => q.text);

        setParsedResults(results);
        addToast({
          title: "Parsing Berhasil",
          description: `Ditemukan ${results.length} soal dari JSON. Silakan tinjau sebelum menyimpan.`,
          type: "success"
        });
      } catch (err: any) {
        addToast({
          title: "Format JSON Salah",
          description: err.message || "Pastikan JSON valid dan sesuai format.",
          type: "error"
        });
      }
      return;
    }

    setIsParsing(true);
    startAIProgress();
    aiAbortRef.current = new AbortController();
    try {
      let results = [];
      if (importMode === 'extract') {
        results = await parseQuestionsAI(pb, importText, exam?.name || "", exam?.level || "");
      } else {
        results = await generateFromMaterialAI(
          pb, 
          importText, 
          importCount, 
          aiDifficulty, 
          exam?.subject || "", 
          exam?.level || "", 
          importType
        );
      }
      setParsedResults(results);
      addToast({
        title: importMode === 'extract' ? "Ekstraksi Berhasil" : "Generasi Berhasil",
        description: `Ditemukan ${results.length} soal. Silakan tinjau sebelum menyimpan.`,
        type: "success"
      });
    } catch (err: any) {
      addToast({
        title: "Gagal Menarik Soal",
        description: err.message?.startsWith("AI_RATE_LIMIT") 
          ? "Kuota token harian habis. Tunggu reset atau upgrade plan." 
          : `${err.message || "Gagal memproses dokumen."} Silakan coba ganti model AI di Pengaturan.`,
        type: "error"
      });
    } finally {
      stopAIProgress(parsedResults.length > 0);
      setIsParsing(false);
      aiAbortRef.current = null;
    }
  };



  const handleSaveAIImport = async () => {
    if (parsedResults.length === 0 || !pb) return;
    setIsParsing(true);
    try {
      const typeMap: Record<string, string> = {
        pilihan_ganda: "multiple_choice",
        pilihan_ganda_kompleks: "complex_choice",
        menjodohkan: "matching",
        benar_salah: "true_false",
        isian_singkat: "short_answer",
        uraian: "essay",
        urutkan: "sequence",
        drag_drop: "drag_drop"
      };

      setBatchProgress({
        isOpen: true,
        total: parsedResults.length,
        current: 0,
        message: "Menyiapkan penyimpanan soal AI...",
        title: "Simpan Soal AI"
      });

      let count = 0;
      // Ambil order tertinggi dari soal yang sudah ada
      const maxOrder = questions.reduce((max, q) => Math.max(max, q.order || 0), 0);
      
      // Build all payloads first
      const payloads = parsedResults.map((q, idx) => {
        const type = q.type || "pilihan_ganda";
        const field = typeMap[type] || "multiple_choice";
        
        let options: any = {};
        if (type === "pilihan_ganda" || type === "pilihan_ganda_kompleks" || type === "benar_salah") {
          options = q.choices || {};
        } else if (type === "menjodohkan") {
          options = { pairs: q.pairs || [] };
        } else if (type === "urutkan" || type === "drag_drop") {
          options = { items: q.items || [] };
        }

        let correctAnswer = "";
        if (type === "pilihan_ganda" || type === "pilihan_ganda_kompleks" || type === "benar_salah") {
          correctAnswer = q.correctAnswer || q.answerKey || "";
          if (!correctAnswer && q.choices) {
            const correctKeys = Object.keys(q.choices).filter(k => q.choices[k].isCorrect);
            correctAnswer = correctKeys.join(",");
          }
        } else if (type === "isian_singkat" || type === "uraian") {
          correctAnswer = q.answerKey || "";
        }

        const createPayload: any = {
          examId,
          text: q.text || "Pertanyaan Tanpa Judul",
          field,
          options,
          correctAnswer,
          order: maxOrder + idx + 1
        };
        if (q.groupId) { createPayload.groupId = q.groupId; createPayload.group_id = q.groupId; }
        if (q.groupText) { createPayload.groupText = q.groupText; createPayload.group_text = q.groupText; }
        return createPayload;
      });

      // Save in parallel chunks of 10
      const chunkSize = 10;
      for (let i = 0; i < payloads.length; i += chunkSize) {
        const chunk = payloads.slice(i, i + chunkSize);
        await Promise.all(chunk.map(p => pb.collection("questions").create(p)));
        count = Math.min(i + chunkSize, payloads.length);
        setImportProgress(Math.round((count / payloads.length) * 100));
        setBatchProgress(prev => ({ ...prev, current: count, message: `Menyimpan soal (${count}/${payloads.length})` }));
      }
      setIsAIImportOpen(false);
      addToast({
        title: "Import Berhasil",
        description: `${parsedResults.length} soal berhasil disimpan ke bank soal.`,
        type: "success"
      });
      setParsedResults([]);
      loadQuestions();
    } catch (err: any) {
      console.error("Save AI Import Error:", err, err?.data);
      addToast({
        title: "Gagal Menyimpan",
        description: (err?.data ? JSON.stringify(err.data) : err.message) || "Beberapa soal mungkin gagal diimpor.",
        type: "error"
      });
    } finally {
      setIsParsing(false);
      setImportProgress(0);
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleAIGenerate = async () => {
    if (!aiTopic.trim() || !pb) {
      showAlert("Gagal", "Topik soal tidak boleh kosong.", "danger");
      return;
    }
    
    setIsAIGenerating(true);
    startAIProgress();
    aiAbortRef.current = new AbortController();
    try {
      const generated = await generateQuestionsAI(
        pb,
        aiTopic, 
        aiCount, 
        aiLevel, 
        aiSubject || (exam?.subject || ""), 
        aiType, 
        isAiLiteracy,
        aiPassageLength,
        aiDifficulty,
        "umum",
        aiTaxonomy.join(","),
        aiMaterialText,
        aiObjectives
      );
      
      if (!generated || generated.length === 0 || !Array.isArray(generated)) {
        throw new Error("AI tidak menghasilkan format soal yang valid.");
      }

      // 🪄 NEW SYSTEM: Populate Batch Modal for Review instead of saving directly
      const questionsForReview = generated.map(q => {
        const choicesBatch: Record<string, { text: string }> = {};
        let correctKey = (q.answerKey || "").toLowerCase();
        
        if (q.choices) {
          if (Array.isArray(q.choices)) {
            q.choices.forEach((c: any, i: number) => {
              const key = String.fromCharCode(97 + i);
              choicesBatch[key] = { text: typeof c === 'object' ? (c.text || String(c)) : String(c) };
              if (typeof c === 'object' && c.isCorrect) correctKey = key;
            });
          } else {
            Object.keys(q.choices).forEach(key => {
              const lowerKey = key.toLowerCase();
              const val = (q.choices as any)[key];
              choicesBatch[lowerKey] = { text: typeof val === 'object' ? (val.text || String(val)) : String(val) };
              if (typeof val === 'object' && val.isCorrect) correctKey = lowerKey;
            });
          }
        }

        return {
          text: q.text,
          type: q.type || aiType,
          choices: choicesBatch,
          correctKey: correctKey,
          answerKey: q.answerKey || "",
          groupId: q.groupId || "",
          groupText: q.groupText || "",
          isFromAI: true
        };
      });

      setBatchQuestions(questionsForReview);
      setIsAIModalOpen(false);
      setIsBatchModalOpen(true);
      
      addToast({
        type: "success",
        title: "Generasi Selesai",
        description: `${generated.length} soal telah siap ditinjau.`,
        duration: 3000
      });
    } catch (err: any) {
      console.error("AI Generate Error:", err);
      if (err.message?.startsWith("AI_RATE_LIMIT")) {
        const parts = err.message.split("|");
        if (parts.length >= 5) {
          const [, limit, used, remaining, requested] = parts;
          showAlert("Limit Harian Tercapai", `Kuota token harian habis.\n• Limit: ${Number(limit).toLocaleString()} token/hari\n• Terpakai: ${Number(used).toLocaleString()}\n• Sisa: ${Number(remaining).toLocaleString()}\n• Diminta: ${Number(requested).toLocaleString()}\n\nTunggu reset harian atau upgrade plan.`, "danger");
        } else {
          showAlert("Server Sedang Limit", "Terlalu banyak permintaan AI. Silakan jeda sejenak (1 menit) sebelum memulai generasi baru.", "danger");
        }
      } else {
        addToast({ type: "error", title: "Gagal", description: "Generasi gagal setelah beberapa percobaan. Coba lagi." });
      }
    } finally {
      stopAIProgress(!isAIGenerating);
      setIsAIGenerating(false);
      aiAbortRef.current = null;
    }
  };
  const [batchQuestions, setBatchQuestions] = useState<any[]>([
    { text: "", choices: { a: { text: "" }, b: { text: "" }, c: { text: "" }, d: { text: "" }, e: { text: "" } }, correctKey: "a", imageFile: null }
  ]);

  const handleBatchCreateClick = () => {
    setBatchQuestions([
      { text: "", choices: { a: { text: "" }, b: { text: "" }, c: { text: "" }, d: { text: "" }, e: { text: "" } }, correctKey: "a", imageFile: null }
    ]);
    setIsBatchModalOpen(true);
  };

  const handleAddBatchRow = () => {
    setBatchQuestions(prev => [
      ...prev,
      { text: "", choices: { a: { text: "" }, b: { text: "" }, c: { text: "" }, d: { text: "" }, e: { text: "" } }, correctKey: "a", imageFile: null }
    ]);
  };

  const handleRemoveBatchRow = (index: number) => {
    if (batchQuestions.length <= 1) return;
    setBatchQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const updateBatchItem = (index: number, field: string, value: any) => {
    setBatchQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateBatchChoice = (index: number, letter: string, value: string) => {
    setBatchQuestions(prev => {
      const updated = [...prev];
      const choices = { ...updated[index].choices };
      choices[letter] = { ...choices[letter], text: value };
      updated[index] = { ...updated[index], choices };
      return updated;
    });
  };

  const handleSaveBatch = async () => {
    if (!pb) return;
    let validQuestions = batchQuestions.filter(q => q.text.trim() !== "");
    if (validQuestions.length === 0) {
      showAlert("Gagal", "Tidak ada soal yang diisi teks pertanyaannya.", "danger");
      return;
    }

    // Validate all must have key
    const hasEmptyKeys = validQuestions.some(q => {
      const qType = q.type || "pilihan_ganda";
      // Skip key validation for non-choice types
      if (qType === "menjodohkan") return false; // pairs can be edited in batch modal
      if (qType === "urutkan" || qType === "drag_drop") return false; // items can be edited in batch modal
      if (qType === "isian_singkat" || qType === "uraian") return false;
      if (!q.correctKey) return true;
      
      // For pilihan_ganda_kompleks, correctKey is comma-separated
      if (qType === "pilihan_ganda_kompleks") {
        const keys = q.correctKey.split(",").map((k: string) => k.trim()).filter(Boolean);
        return keys.length === 0 || keys.some((k: string) => !q.choices?.[k]?.text?.trim());
      }
      
      const correctChoice = q.choices?.[q.correctKey];
      return !correctChoice || !correctChoice.text || correctChoice.text.trim() === "";
    });

    if (hasEmptyKeys) {
      showAlert("Gagal", "Kunci jawaban dari soal yang Anda ketik tidak boleh kosong teksnya.", "danger");
      return;
    }

    const typeMap: Record<string, string> = {
      pilihan_ganda: "multiple_choice",
      pilihan_ganda_kompleks: "complex_choice",
      menjodohkan: "matching",
      benar_salah: "true_false",
      isian_singkat: "short_answer",
      uraian: "essay",
      urutkan: "sequence",
      drag_drop: "drag_drop"
    };

    setIsSavingBatch(true);
    setImportProgress(0);
    setBatchProgress({
      isOpen: true,
      total: validQuestions.length,
      current: 0,
      message: "Menyiapkan penyimpanan batch soal...",
      title: "Simpan Batch Soal"
    });
    // Menutup modal batch agar progress dialog terlihat jelas
    setIsBatchModalOpen(false);

    try {
      let currentOrder = questions.length + 1;
      let count = 0;
      
      for (const q of validQuestions) {
        let imageUrl = q.imageUrl || "";
        if (q.imageFile) {
          try {
            let fileToUpload = q.imageFile;
            if (q.imageFile.size > 200 * 1024) {
              fileToUpload = await compressImage(q.imageFile);
            }
            const uploadSnap = await uploadInventoryImage(`questions/${examId}`, fileToUpload);
            imageUrl = uploadSnap.url;
          } catch (e) {
            console.error("Gagal mengunggah gambar batch", e);
          }
        }

        const qType = q.type || "pilihan_ganda";
        
        // Build options based on question type
        let optionsToSave: any = {};
        let correctAnswer = q.correctKey || "";
        
        if (qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks" || qType === "benar_salah") {
          // Choice-based: options = {a: {text, isCorrect}, b: {...}, ...}
          Object.keys(q.choices || {}).forEach((key) => {
            const choiceText = q.choices[key]?.text || "";
            // Skip empty choices (but keep benar_salah choices even if text seems empty)
            if (!choiceText.trim() && qType !== "benar_salah") return;
            optionsToSave[key] = {
              text: choiceText,
              isCorrect: qType === "pilihan_ganda_kompleks" 
                ? (q.correctKey || "").split(",").map((k: string) => k.trim()).includes(key)
                : key === q.correctKey
            };
          });
          correctAnswer = q.correctKey || "";
        } else if (qType === "menjodohkan") {
          // Matching: options = { pairs: [{id, left, right}, ...] }
          optionsToSave = { pairs: q.pairs || [] };
          correctAnswer = ""; // Answer is embedded in pairs structure
        } else if (qType === "urutkan" || qType === "drag_drop") {
          // Sequence/DragDrop: options = { items: [{id, text}, ...] }
          optionsToSave = { items: q.items || [] };
          correctAnswer = ""; // Correct order is the items array order
        } else if (qType === "isian_singkat" || qType === "uraian") {
          // Essay/Short answer: no options, just answerKey
          optionsToSave = {};
          correctAnswer = q.answerKey || "";
        }

        const payload: any = {
          examId,
          text: await uploadInlineBase64Images(q.isFromAI ? q.text : `<p>${q.text}</p>`), 
          field: typeMap[qType] || "multiple_choice", 
          options: optionsToSave,
          correctAnswer: correctAnswer,
          order: currentOrder++,
          groupId: q.groupId || "",
          group_id: q.groupId || "",
          groupText: q.groupText ? await uploadInlineBase64Images(q.groupText) : "",
          group_text: q.groupText ? await uploadInlineBase64Images(q.groupText) : ""
        };

        if (imageUrl) {
          payload.imageUrl = imageUrl;
        }

        await pb.collection('questions').create(payload);
        count++;
        const progress = Math.round((count / validQuestions.length) * 100);
        setImportProgress(progress);
        setBatchProgress(prev => ({
          ...prev,
          current: count,
          message: `Menyimpan soal manual (${count}/${validQuestions.length})`
        }));
      }
      showAlert("Berhasil!", `${validQuestions.length} Soal manual berhasil disimpan.`, "success");
      loadQuestions();
    } catch (e) {
      showAlert("Gagal Menyimpan", "Terjadi kesalahan saat menyimpan batch soal.", "danger");
    } finally {
      setIsSavingBatch(false);
      setImportProgress(0);
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const quillRef = useRef<any>(null); // <--- Reference to Question Quill

  // Auto-detect LaTeX in plain text and wrap with $...$
  const autoDetectLatex = (html: string): string => {
    if (!html || !html.includes('\\')) return html;
    // Don't process if already has $ delimiters or \( \) delimiters
    if (html.includes('$') || html.includes('\\(') || html.includes('\\[')) return html;
    
    // Common LaTeX commands that indicate math content
    const latexCommands = /\\(frac|dfrac|sqrt|int|sum|prod|lim|log|ln|sin|cos|tan|vec|text|left|right|cdot|times|div|pm|mp|leq|geq|neq|approx|infty|alpha|beta|gamma|theta|sigma|delta|Delta|Omega|pi|circ|rightarrow|leftarrow|rightleftharpoons)\b/;
    
    if (!latexCommands.test(html)) return html;
    
    // Strategy: find LaTeX expressions within text and wrap them individually
    // A LaTeX expression starts with \ command and may include {}, ^, _, etc.
    const processed = html.replace(
      /(<p[^>]*>)((?:(?!<\/p>).)*)(<\/p>)/gi,
      (match, open, content, close) => {
        if (content.includes('$') || content.includes('\\(')) return match;
        if (!latexCommands.test(content)) return match;
        
        const stripped = content.replace(/<[^>]*>/g, '').trim();
        
        // If entire paragraph looks like pure math expression
        if (latexCommands.test(stripped) && stripped.length < 500) {
          // Check if it's mixed text + math or pure math
          const textBeforeMath = stripped.match(/^([^\\]*?)(\\(?:frac|dfrac|sqrt|int|sum|prod|lim|log|ln|sin|cos|tan|vec|left|right|cdot|times|div|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|theta|sigma|delta|Delta|Omega|pi|circ|rightarrow|leftarrow|rightleftharpoons))/);
          if (textBeforeMath && textBeforeMath[1].length > 5) {
            // Mixed: wrap only the math part (from first \ command to end)
            const mathStart = stripped.indexOf(textBeforeMath[2]);
            const textPart = stripped.substring(0, mathStart);
            const mathPart = stripped.substring(mathStart);
            return open + textPart + '$ ' + mathPart + ' $' + close;
          }
          // Pure math paragraph
          return open + '$ ' + content + ' $' + close;
        }
        return match;
      }
    );
    
    // Handle bare text (not wrapped in <p>)
    if (processed === html && !html.includes('<p')) {
      const stripped = html.replace(/<[^>]*>/g, '').trim();
      if (latexCommands.test(stripped) && stripped.length < 500) {
        const textBeforeMath = stripped.match(/^([^\\]*?)(\\(?:frac|dfrac|sqrt|int|sum|lim|log|ln|sin|cos|tan|vec|cdot|times|alpha|beta|gamma|theta|pi))/);
        if (textBeforeMath && textBeforeMath[1].length > 5) {
          const mathStart = stripped.indexOf(textBeforeMath[2]);
          return stripped.substring(0, mathStart) + '$ ' + stripped.substring(mathStart) + ' $';
        }
        return '$ ' + html + ' $';
      }
    }
    
    return processed;
  };

  const imageHandler = useCallback(function (this: any) {
    const quill = this.quill; // <--- Instance editor yang sedang diklik toolbar-nya
    
    // Alih-alih pakai native browser <input>, kita pakai Custom Gallery UI kita
    const range = quill.getSelection();
    const cursorIndex = range ? range.index : quill.getLength();
    setGalleryTarget({ type: "quill", quillInstance: quill, quillIndex: cursorIndex });
    setIsPickerOpen(true);
  }, []);

  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'align': [] }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
        ['image', 'formula', 'code-block', 'clean']
      ],
      handlers: {
        image: imageHandler
      }
    },
    clipboard: {
      matchers: [
        ['table', function(_node: any, _delta: any) {
          const Delta = Quill.import('delta');
          const tableEl = _node as HTMLElement;
          tableEl.removeAttribute('style');
          tableEl.removeAttribute('width');
          tableEl.removeAttribute('height');
          tableEl.querySelectorAll('tr, td, th, thead, tbody, colgroup, col').forEach((el: Element) => {
            (el as HTMLElement).removeAttribute('style');
            (el as HTMLElement).removeAttribute('width');
            (el as HTMLElement).removeAttribute('height');
          });
          tableEl.querySelectorAll('colgroup').forEach((el: Element) => el.remove());
          return new Delta().insert({ tableEmbed: tableEl.outerHTML });
        }],
        [Node.ELEMENT_NODE, function(_node: any, delta: any) {
          // Strip background color AND text color from pasted content
          // This prevents Word/website styling from breaking dark mode
          if (delta && delta.ops) {
            delta.ops = delta.ops.map((op: any) => {
              if (op.attributes) {
                delete op.attributes.background;
                // Remove black/dark colors that won't show in dark mode
                if (op.attributes.color) {
                  const c = op.attributes.color.toLowerCase();
                  if (c === '#000000' || c === '#000' || c === 'black' || c === '#333333' || c === '#333' || c === '#444444' || c === '#444' || c === 'rgb(0, 0, 0)' || c === 'rgb(0,0,0)' || c === '#1e1e1e' || c === 'windowtext') {
                    delete op.attributes.color;
                  }
                }
              }
              return op;
            });
          }
          return delta;
        }]
      ]
    },
    keyboard: {
      bindings: {
        tab: {
          key: 9,
          handler: function(this: any, range: any) {
            // Insert non-breaking spaces (preserved by Quill on save/reload)
            this.quill.insertText(range.index, '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.quill.setSelection(range.index + 8);
            return false;
          }
        },
        shiftTab: {
          key: 9,
          shiftKey: true,
          handler: function(this: any, range: any) {
            // Remove nbsp before cursor if present
            const text = this.quill.getText(Math.max(0, range.index - 8), 8);
            const nbspCount = (text.match(/\u00A0/g) || []).length;
            if (nbspCount > 0) {
              const deleteCount = Math.min(nbspCount, 8);
              this.quill.deleteText(range.index - deleteCount, deleteCount);
            }
            return false;
          }
        }
      }
    },
    formula: true,
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar']
    }
  }), [imageHandler]);

  const quillModulesChoice = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'color': [] }],
      [{ 'indent': '-1' }, { 'indent': '+1' }],
      ['code-block', 'clean']
    ],
    clipboard: {
      matchers: [
        ['table', function(_node: any, _delta: any) {
          const Delta = Quill.import('delta');
          const tableEl = _node as HTMLElement;
          tableEl.removeAttribute('style');
          tableEl.removeAttribute('width');
          tableEl.removeAttribute('height');
          tableEl.querySelectorAll('tr, td, th, thead, tbody, colgroup, col').forEach((el: Element) => {
            (el as HTMLElement).removeAttribute('style');
            (el as HTMLElement).removeAttribute('width');
            (el as HTMLElement).removeAttribute('height');
          });
          tableEl.querySelectorAll('colgroup').forEach((el: Element) => el.remove());
          return new Delta().insert({ tableEmbed: tableEl.outerHTML });
        }],
        [Node.ELEMENT_NODE, function(_node: any, delta: any) {
          if (delta && delta.ops) {
            delta.ops = delta.ops.map((op: any) => {
              if (op.attributes) {
                delete op.attributes.background;
                if (op.attributes.color) {
                  const c = op.attributes.color.toLowerCase();
                  if (c === '#000000' || c === '#000' || c === 'black' || c === '#333333' || c === '#333' || c === '#444444' || c === '#444' || c === 'rgb(0, 0, 0)' || c === 'rgb(0,0,0)' || c === '#1e1e1e' || c === 'windowtext') {
                    delete op.attributes.color;
                  }
                }
              }
              return op;
            });
          }
          return delta;
        }]
      ]
    },
    keyboard: {
      bindings: {
        tab: {
          key: 9,
          handler: function(this: any, range: any) {
            this.quill.insertText(range.index, '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.quill.setSelection(range.index + 8);
            return false;
          }
        }
      }
    }
  }), []);




  // 🔄 Load Questions dari PocketBase
  const loadQuestions = useCallback(async () => {
    if (!examId || !pb) return;
    try {
      const loaded = await pb.collection('questions').getFullList({
        filter: `examId = "${examId}"`,
        sort: 'order,created'
      });

      const typeMapReverse: Record<string, string> = {
        multiple_choice: "pilihan_ganda",
        complex_choice: "pilihan_ganda_kompleks",
        matching: "menjodohkan",
        true_false: "benar_salah",
        short_answer: "isian_singkat",
        essay: "uraian",
        sequence: "urutkan",
        drag_drop: "drag_drop"
      };

      const mapped = loaded.map(q => {
        const rawType = q.field || q.type || "pilihan_ganda";
        const mappedType = (typeMapReverse[rawType] || rawType) as any;
        const options = q.options || {};

        return {
          ...q,
          id: q.id,
          type: mappedType,
          text: q.text,
          imageUrl: q.imageUrl,
          // Harmonize snake_case to camelCase
          groupId: q.groupId || q.group_id || "", 
          groupText: q.groupText || q.group_text || "",
          // Ensure choices, pairs, items are identified correctly
          choices: (mappedType === "pilihan_ganda" || mappedType === "pilihan_ganda_kompleks" || mappedType === "benar_salah") 
            ? options : undefined,
          pairs: mappedType === "menjodohkan" ? options.pairs : undefined,
          items: (mappedType === "urutkan" || mappedType === "drag_drop") ? options.items : undefined,
          answerKey: q.correctAnswer || q.answerKey
        };
      });

      // Group-aware sorting: keep questions with same groupId together
      const grouped: any[] = [];
      const seen = new Set<string>();
      
      mapped.forEach((q: any) => {
        if (seen.has(q.id)) return;
        if (q.groupId) {
          if (!seen.has('group_' + q.groupId)) {
            seen.add('group_' + q.groupId);
            // Add all questions in this group together
            const groupQuestions = mapped.filter((gq: any) => gq.groupId === q.groupId);
            groupQuestions.forEach((gq: any) => {
              if (!seen.has(gq.id)) {
                seen.add(gq.id);
                grouped.push(gq);
              }
            });
          }
        } else {
          seen.add(q.id);
          grouped.push(q);
        }
      });

      setQuestions(grouped as any);
    } catch (e) {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      let extractedText = "";
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === "docx") {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (extension === "pdf") {
        // 📄 Dynamic Loader for PDF.js to avoid npm install wait if possible
        let pdfjs = (window as any).pdfjsLib;
        if (!pdfjs) {
          addToast({ title: "Menyiapkan PDF Reader", description: "Sedang memuat library PDF, mohon tunggu sebentar...", type: "info" });
          await new Promise<void>((resolve) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
            script.onload = () => {
              (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
              resolve();
            };
            document.head.appendChild(script);
          });
          pdfjs = (window as any).pdfjsLib;
        }
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          fullText += pageText + "\n";
        }
        extractedText = fullText;
      }

      if (extractedText) {
        setImportText(extractedText);
        addToast({ title: "File Berhasil Dibaca", description: `Ekstraksi teks dari ${file.name} selesai.`, type: "success" });
      } else {
        throw new Error("Gagal mengekstrak teks dari file.");
      }
    } catch (err: any) {
      addToast({ title: "Gagal Membaca File", description: err.message || "Pastikan file tidak terkunci atau rusak.", type: "error" });
    } finally {
      setIsParsing(false);
      if (e.target) e.target.value = "";
    }
  };



  useEffect(() => {
    if (!examId) return;

    const init = async () => {
      if (!pb) return;
      try {
        // 1. Load Exam Info dari PocketBase
        const examData = await pb.collection('exams').getOne(examId);
        const subjectObj = subjects.find((s: any) => s.id === examData.subjectId);
        const teacherObj = teachers.find((t: any) => t.id === examData.teacherId);

        setExam({
          ...examData,
          subject: subjectObj ? subjectObj.name : "",
          teacherName: teacherObj ? teacherObj.name : "",
          teacherCode: teacherObj ? teacherObj.code || "" : ""
        });

        // 2. Load Questions
        await loadQuestions();

        // 3. Subscribe Realtime (debounced to prevent rapid re-renders during batch operations)
        let realtimeTimer: ReturnType<typeof setTimeout> | null = null;
        const unsubscribe = await pb!.collection('questions').subscribe("*", (e) => {
          if (realtimeTimer) clearTimeout(realtimeTimer);
          realtimeTimer = setTimeout(() => { loadQuestions(); }, 800);
        });

        return () => {
          if (realtimeTimer) clearTimeout(realtimeTimer);
          if (pb!.authStore.isValid) {
            pb!.collection('questions').unsubscribe("*");
          }
        };

      } catch (error) {
        setLoading(false);
      }
    };

    init();
  }, [examId, subjects, teachers, loadQuestions]);

  const isOwner = useMemo(() => {
    if (role === "admin") return true;
    if (teacherFullAccess) return true;
    if (!exam || !teacherId) return false;
    // Cek ID Guru (baru) atau ID Akun (lama) dan handle casing
    const examTeacherId = exam.teacherId || exam.teacherid;
    return examTeacherId === teacherId || examTeacherId === user?.id;
  }, [role, exam, teacherId, user, teacherFullAccess]);


  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedQuestion(null);
    setFormValues({
      text: "",
      type: "pilihan_ganda",
      groupId: "",
      groupText: "",
      choices: {
        a: { text: "", isCorrect: false },
        b: { text: "", isCorrect: false },
        c: { text: "", isCorrect: false },
        d: { text: "", isCorrect: false },
        e: { text: "", isCorrect: false },
      },
      pairs: [{ id: "1", left: "", right: "" }],
      answerKey: "",
      items: [{ id: "1", text: "" }]
    });
    setIsLiterasiActive(false);
    setLiterasiMode("select");
    setIsDialogOpen(true);
  };

  const handleEditClick = (q: QuestionData) => {
    setDialogMode("edit");
    setSelectedQuestion(q);
    setQuestionFile(null);
    setChoiceFiles({});
    setFormValues({
      text: wrapTablesForQuill(q.text),
      type: q.type || "pilihan_ganda",
      imageUrl: q.imageUrl,
      groupId: q.groupId || "",
      groupText: q.groupText || "",
      choices: {
        a: { text: q.choices?.a?.text || "", imageUrl: q.choices?.a?.imageUrl, isCorrect: !!q.choices?.a?.isCorrect },
        b: { text: q.choices?.b?.text || "", imageUrl: q.choices?.b?.imageUrl, isCorrect: !!q.choices?.b?.isCorrect },
        c: { text: q.choices?.c?.text || "", imageUrl: q.choices?.c?.imageUrl, isCorrect: !!q.choices?.c?.isCorrect },
        d: { text: q.choices?.d?.text || "", imageUrl: q.choices?.d?.imageUrl, isCorrect: !!q.choices?.d?.isCorrect },
        e: { text: q.choices?.e?.text || "", imageUrl: q.choices?.e?.imageUrl, isCorrect: !!q.choices?.e?.isCorrect },
      },
      pairs: q.pairs || [{ id: "1", left: "", right: "" }],
      answerKey: q.answerKey || "",
      items: q.items || [{ id: "1", text: "" }]
    });
    // 🔒 Deteksi apakah ini soal pertama di grupnya agar hanya soal #1 yang bisa edit teks wacana
    const groupItems = questions.filter(item => q.groupId && item.groupId === q.groupId);
    const isFirstInGroup = groupItems.length > 0 
      ? groupItems[0].id === q.id 
      : true;

    setIsLiterasiActive(!!q.groupId);
    setLiterasiMode(isFirstInGroup && q.groupText ? "create" : "select");
    setIsDialogOpen(true);
  };

  const handleChoiceChange = (key: string, field: string, value: any) => {
    setFormValues((prev) => {
      const updatedChoices = { ...prev.choices };
      updatedChoices[key] = { ...updatedChoices[key], [field]: value };

      // If setting isCorrect: true and current type is choices (single choice), set others to false
      if (prev.type === "pilihan_ganda" && field === "isCorrect" && value === true) {
        Object.keys(updatedChoices).forEach((k) => {
          if (k !== key) updatedChoices[k].isCorrect = false;
        });
      }

      return { ...prev, choices: updatedChoices };
    });
  };

  const handleAddPair = () => {
    setFormValues(prev => ({
      ...prev,
      pairs: [...prev.pairs, { id: Date.now().toString(), left: "", right: "" }]
    }));
  };

  const handleRemovePair = (id: string) => {
    setFormValues(prev => ({
      ...prev,
      pairs: prev.pairs.filter(p => p.id !== id)
    }));
  };

  const handlePairChange = (id: string, field: "left" | "right", value: string) => {
    setFormValues(prev => ({
      ...prev,
      pairs: prev.pairs.map(p => p.id === id ? { ...p, [field]: value } : p)
    }));
  };

  const handleAddItem = () => {
    setFormValues(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now().toString(), text: "" }]
    }));
  };

  const handleRemoveItem = (id: string) => {
    setFormValues(prev => ({
      ...prev,
      items: prev.items.filter(it => it.id !== id)
    }));
  };

  const handleItemChange = (id: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      items: prev.items.map(it => it.id === id ? { ...it, text: value } : it)
    }));
  };

  // 🖼️ Convert base64 images in HTML to R2 URLs (compressed to webp) before saving
  const uploadInlineBase64Images = async (html: string): Promise<string> => {
    if (!html || !html.includes("data:image")) return html;
    
    const imgRegex = /<img[^>]+src="(data:image\/[^;]+;base64,[^"]+)"[^>]*>/g;
    let result = html;
    let match;
    const matches: { full: string; base64: string }[] = [];
    
    while ((match = imgRegex.exec(html)) !== null) {
      matches.push({ full: match[0], base64: match[1] });
    }
    
    // Upload all images in parallel for speed
    const uploads = await Promise.allSettled(matches.map(async (m) => {
      try {
        const response = await fetch(m.base64);
        const blob = await response.blob();
        let file = new File([blob], `inline-${Date.now()}-${Math.random().toString(36).substr(2, 5)}.webp`, { type: blob.type });
        
        // Only compress if not already webp or if large
        if (blob.type !== "image/webp" && blob.size > 30 * 1024) {
          try { file = await compressImage(file); } catch { /* keep original */ }
        }
        
        const schoolFolder = school?.slug || "unknown";
        const uploaded = await uploadInventoryImage(`schools/${schoolFolder}/exams/${examId}`, file);
        return { base64: m.base64, url: uploaded.url };
      } catch (err) {
        console.warn("Gagal upload inline image ke R2:", err);
        return null;
      }
    }));
    
    for (const r of uploads) {
      if (r.status === "fulfilled" && r.value) {
        result = result.replace(r.value.base64, r.value.url);
      }
    }
    
    return result;
  };

  const handleSubmit = async (e: any, stayOpen: boolean = false) => {
    e.preventDefault();
    if (!pb) return;
    if (isSavingQuestion) return; // Prevent double-click

    // 1. Validasi Teks Pertanyaan (teks ATAU gambar harus ada)
    const hasQuestionText = formValues.text && formValues.text.replace(/<[^>]*>/g, '').trim() !== "";
    const hasQuestionImage = !!formValues.imageUrl || !!questionFile || (formValues.text && formValues.text.includes("<img"));
    if (!hasQuestionText && !hasQuestionImage) {
      showAlert("Gagal", "Teks pertanyaan tidak boleh kosong.", "danger");
      return;
    }

    // 2. Validasi Jawaban berdasarkan tipe
    if (formValues.type === "pilihan_ganda" || formValues.type === "pilihan_ganda_kompleks" || formValues.type === "benar_salah") {
      const hasCorrectAnswer = Object.values(formValues.choices).some((c) => c.isCorrect);
      if (!hasCorrectAnswer) {
        showAlert("Gagal", "Soal wajib memiliki minimal satu kunci jawaban.", "danger");
        return;
      }
      const filledChoicesCount = Object.entries(formValues.choices).filter(([key, c]) => {
        const hasText = c.text && c.text.replace(/<[^>]*>/g, '').trim() !== "";
        const hasImage = !!c.imageUrl || !!(choiceFiles as any)[key] || (c.text && c.text.includes("<img"));
        return hasText || hasImage;
      }).length;
      if (filledChoicesCount < 2) {
        showAlert("Gagal", "Minimal harus mengisi atau membuat 2 pilihan jawaban.", "danger");
        return;
      }
    } else if (formValues.type === "menjodohkan") {
      if (formValues.pairs.length < 1 || formValues.pairs.some(p => !p.left.trim() || !p.right.trim())) {
        showAlert("Gagal", "Semua pasangan menjodohkan harus diisi.", "danger");
        return;
      }
    } else if (formValues.type === "isian_singkat") {
      if (!formValues.answerKey?.trim()) {
        showAlert("Gagal", "Kunci jawaban isian singkat tidak boleh kosong.", "danger");
        return;
      }
    } else if (formValues.type === "urutkan" || formValues.type === "drag_drop") {
      if (formValues.items.length < 2 || formValues.items.some(it => !it.text.trim())) {
        showAlert("Gagal", "Minimal 2 item dan semuanya harus diisi.", "danger");
        return;
      }
    }

    setIsSavingQuestion(true);
    try {
      const uploadBase64ToR2 = async (base64Data: string, prefix: string) => {
        try {
          const blob = await (await fetch(base64Data)).blob();
          let fileToUpload = new File([blob], `${prefix}_${Date.now()}.webp`, { type: blob.type });
          // Only compress if not already webp or if large
          if (blob.type !== "image/webp" && blob.size > 30 * 1024) {
            try { fileToUpload = await compressImage(fileToUpload); } catch { /* keep original */ }
          }
          const schoolFolder = school?.slug || "unknown";
          const uploadSnap = await uploadInventoryImage(`schools/${schoolFolder}/exams/${examId}`, fileToUpload);
          return uploadSnap.url;
        } catch (e) {
          console.error(`Gagal upload base64 image (${prefix}) to R2`, e);
          return base64Data;
        }
      };

      let imageUrl = formValues.imageUrl || "";
      let textToSave = autoDetectLatex(unwrapTablesForStorage(formValues.text));

      // 🖼️ 1. Upload file Cover Soal (dari tombol input file)
      if (questionFile) {
        let fileToUpload = questionFile;
        if (questionFile.size > 200 * 1024) { // kompress > 200KB
          fileToUpload = await compressImage(questionFile);
        }
        if (dialogMode === "edit" && selectedQuestion?.imageUrl) {
          const extractKey = (url: string) => url.includes("/questions/") ? "questions/" + url.split("/questions/")[1].split("?")[0] : "";
          const oldKey = extractKey(selectedQuestion.imageUrl);
          if (oldKey) await deleteImageFromStorage(oldKey);
        }
        
        const schoolFolder = school?.slug || "unknown";
        const res = await uploadInventoryImage(`schools/${schoolFolder}/exams/${examId}`, fileToUpload);
        imageUrl = res.url;
      } else if (imageUrl.startsWith("data:image/")) {
        // Jika dari pratinjau tapi belum diupload
        imageUrl = await uploadBase64ToR2(imageUrl, "cover_manual");
      }

      // 🖼️ 2. Scan teks Soal untuk base64 (parallel upload)
      if (textToSave.includes("data:image/")) {
        const doc = new DOMParser().parseFromString(textToSave, "text/html");
        const ims = Array.from(doc.querySelectorAll("img[src^='data:image/']"));
        if (ims.length > 0) {
          const results = await Promise.allSettled(ims.map(async (img) => {
            const base64 = img.getAttribute("src")!;
            return { img, url: await uploadBase64ToR2(base64, "text_manual") };
          }));
          results.forEach(r => { if (r.status === "fulfilled" && r.value.url !== r.value.img.getAttribute("src")) r.value.img.setAttribute("src", r.value.url); });
          textToSave = doc.body.innerHTML;
        }
      }

      // 🖼️ 3. Upload file Pilihan Manual ke R2
      const updatedChoices = JSON.parse(JSON.stringify(formValues.choices));
      for (const key in choiceFiles) {
        const file = choiceFiles[key];
        if (file) {
          let fileToUpload = file;
          if (file.size > 200 * 1024) {
            fileToUpload = await compressImage(file);
          }
          if (dialogMode === "edit" && selectedQuestion?.choices?.[key]?.imageUrl) {
            const extractKey = (url: string) => url.includes("/questions/") ? "questions/" + url.split("/questions/")[1].split("?")[0] : "";
            const oldKey = extractKey(selectedQuestion.choices[key].imageUrl);
            if (oldKey) await deleteImageFromStorage(oldKey);
          }
          const schoolFolder = school?.slug || "unknown";
          const res = await uploadInventoryImage(`schools/${schoolFolder}/exams/${examId}`, fileToUpload);
          updatedChoices[key].imageUrl = res.url;
        }
      }

      // 🖼️ 4. Scan teks Pilihan untuk base64 (parallel)
      await Promise.allSettled(Object.keys(updatedChoices).map(async (key) => {
        const choice = updatedChoices[key];
        if (choice.imageUrl && choice.imageUrl.startsWith("data:image/")) {
          choice.imageUrl = await uploadBase64ToR2(choice.imageUrl, `choice_manual_${key}`);
        } else if (!choice.imageUrl) {
          delete choice.imageUrl;
        }
        if (choice.text && choice.text.includes("data:image/")) {
          const cDoc = new DOMParser().parseFromString(choice.text, "text/html");
          const cIms = Array.from(cDoc.querySelectorAll("img[src^='data:image/']"));
          if (cIms.length > 0) {
            await Promise.allSettled(cIms.map(async (img) => {
              const b64 = img.getAttribute("src")!;
              const url = await uploadBase64ToR2(b64, `choice_text_manual_${key}`);
              img.setAttribute("src", url);
            }));
            choice.text = cDoc.body.innerHTML;
          }
        }
      }));

      const typeMap: Record<string, string> = {
        pilihan_ganda: "multiple_choice",
        pilihan_ganda_kompleks: "complex_choice",
        menjodohkan: "matching",
        benar_salah: "true_false",
        isian_singkat: "short_answer",
        uraian: "essay",
        urutkan: "sequence",
        drag_drop: "drag_drop"
      };

      const payload: any = {
        examId,
        text: textToSave,
        field: typeMap[formValues.type] || "multiple_choice", 
        options: {}, 
        correctAnswer: "",
        order: selectedQuestion?.order || (questions.reduce((max, q) => Math.max(max, q.order || 0), 0) + 1)
      };

      if (formValues.type === "pilihan_ganda" || formValues.type === "pilihan_ganda_kompleks" || formValues.type === "benar_salah") {
        payload.options = updatedChoices;
        const correctOnes = Object.keys(updatedChoices).filter(k => updatedChoices[k].isCorrect);
        payload.correctAnswer = correctOnes.join(",");
      } else if (formValues.type === "menjodohkan") {
        payload.options = { pairs: formValues.pairs };
      } else if (formValues.type === "isian_singkat" || formValues.type === "uraian") {
        payload.correctAnswer = formValues.answerKey;
      } else if (formValues.type === "urutkan" || formValues.type === "drag_drop") {
        payload.options = { items: formValues.items };
      }

      if (imageUrl) {
        payload.imageUrl = imageUrl;
      }

      // 🛡️ LITERALISASI / WACANA (Fix Save Logic + Dual Convention)
      if (isLiterasiActive) {
        const gid = formValues.groupId || "";
        let gtxt = formValues.groupText || "";
        
        // Upload base64 images in groupText to R2
        if (gtxt.includes("data:image/")) {
          gtxt = await uploadInlineBase64Images(gtxt);
        }
        
        payload.groupId = gid;
        payload.group_id = gid;
        payload.groupText = gtxt;
        payload.group_text = gtxt;
        
        // Validasi: Wajib ada kode grup jika literasi aktif
        if (!gid.trim()) {
           showAlert("Gagal", "Harap isi Kode/Nama Literasi atau pilih literasi yang sudah ada.", "danger");
           return;
        }
      } else {
        // Jika tidak aktif, pastikan dihapus dari database (khusus Edit)
        payload.groupId = "";
        payload.group_id = "";
        payload.groupText = "";
        payload.group_text = "";
      }
      
      console.log("💾 Menempelkan Payload Soal (Dual Format):", payload);

      if (dialogMode === "edit" && selectedQuestion) {
        // Jika ini soal utama literasi dan groupId/groupText berubah, propagate ke semua soal sepaket
        const oldGroupId = selectedQuestion.groupId || "";
        const newGroupId = payload.groupId || "";
        const newGroupText = payload.groupText || "";
        const isGroupChanged = oldGroupId && newGroupId && (oldGroupId !== newGroupId || (selectedQuestion.groupText || "") !== newGroupText);
        
        await pb.collection('questions').update(selectedQuestion.id, payload);
        
        if (isGroupChanged) {
          // Update semua soal lain dalam grup lama
          const siblingQuestions = questions.filter(q => q.id !== selectedQuestion.id && q.groupId === oldGroupId);
          for (const sibling of siblingQuestions) {
            await pb.collection('questions').update(sibling.id, {
              groupId: newGroupId, group_id: newGroupId,
              groupText: newGroupText, group_text: newGroupText
            });
          }
        }
        
        setIsDialogOpen(false);
        showAlert("Berhasil", "Soal berhasil diperbarui.", "success");
      } else {
        await pb.collection('questions').create(payload);
        showAlert("Berhasil", "Soal berhasil ditambahkan.", "success");
        if (stayOpen) {
          // Reset form fields to add another question but keep type and literasi settings
          setFormValues(prev => ({
            ...prev,
            text: "",
            imageUrl: "",
            choices: {
              a: { text: "", isCorrect: false },
              b: { text: "", isCorrect: false },
              c: { text: "", isCorrect: false },
              d: { text: "", isCorrect: false },
              e: { text: "", isCorrect: false },
            },
            pairs: [{ id: "1", left: "", right: "" }],
            answerKey: "",
            items: [{ id: "1", text: "" }]
          }));
          setQuestionFile(null);
          setChoiceFiles({});
        } else {
          setIsDialogOpen(false);
        }
      }
    } catch (error) {
      showAlert("Gagal", "Gagal menyimpan soal ke PocketBase.", "danger");
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const getQuestionImageKeys = (q: QuestionData): string[] => {
    const keys: string[] = [];
    const extractKey = (url: string) => {
      if (url && url.includes("/questions/")) return "questions/" + url.split("/questions/")[1].split("?")[0];
      return "";
    };

    if (q.imageUrl) {
      const k = extractKey(q.imageUrl);
      if (k) keys.push(k);
    }
    
    if (q.choices) {
      Object.values(q.choices).forEach((c) => {
        if (c.imageUrl) {
          const k = extractKey(c.imageUrl);
          if (k) keys.push(k);
        }
        if (c.text && c.text.includes("/questions/")) {
          const doc = new DOMParser().parseFromString(c.text, "text/html");
          doc.querySelectorAll("img").forEach((img) => {
            const src = img.getAttribute("src") || "";
            const k = extractKey(src);
            if (k) keys.push(k);
          });
        }
      });
    }
    if (q.text && q.text.includes("/questions/")) {
      const doc = new DOMParser().parseFromString(q.text, "text/html");
      doc.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src") || "";
        const k = extractKey(src);
        if (k) keys.push(k);
      });
    }

    return Array.from(new Set(keys)); // Unique keys only
  };

  const cleanupQuestionImages = async (q: QuestionData) => {
    const keys = getQuestionImageKeys(q);
    if (keys.length > 0) {
      await deleteImagesFromStorage(keys);
    }
  };

  const handleDeleteClick = (q: QuestionData) => {
    setQuestionToDelete(q);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!questionToDelete || !pb) return;
    setIsDeleting(true);
    try {
      // 🗑️ Hapus gambar di R2 (Non-blocking: jika gagal tetap hapus record DB)
      try {
        await cleanupQuestionImages(questionToDelete);
      } catch (storageError) {
        console.warn("Gagal membersihkan gambar dari R2 Storage. Ini mungkin karena masalah CORS setelah ganti domain.", storageError);
      }

      // 📚 Jika soal ini adalah "MAIN" literasi (punya groupText), transfer ke soal berikutnya dalam grup
      if (questionToDelete.groupId && questionToDelete.groupText) {
        const groupSiblings = questions.filter(q => q.groupId === questionToDelete.groupId && q.id !== questionToDelete.id);
        if (groupSiblings.length > 0) {
          // Pastikan soal berikutnya punya groupText (transfer stimulus)
          const nextMain = groupSiblings[0];
          if (!nextMain.groupText) {
            try {
              await pb.collection('questions').update(nextMain.id, {
                groupText: questionToDelete.groupText,
                group_text: questionToDelete.groupText
              });
            } catch (e) {
              console.warn("Gagal transfer groupText ke soal berikutnya:", e);
            }
          }
        }
      }

      await pb.collection('questions').delete(questionToDelete.id);
      showAlert("Berhasil", "Soal berhasil dihapus.", "success");
    } catch (error) {
      console.error("Delete Question Error:", error);
      showAlert("Gagal", "Gagal menghapus data soal dari database.", "danger");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // ═══ Hapus Paket Literasi (hapus groupId & groupText dari semua soal dalam grup) ═══
  const handleDeleteLiterasi = async (groupId: string) => {
    if (!pb || !groupId) return;
    showAlert(
      "Hapus Paket Literasi",
      `Yakin ingin menghapus paket literasi "${groupId}"? Semua soal dalam paket ini akan dilepas dari grup (soal TIDAK dihapus, hanya dilepas dari literasi).`,
      "warning",
      async () => {
        try {
          const groupQuestions = questions.filter(q => q.groupId === groupId);
          for (const q of groupQuestions) {
            await pb.collection('questions').update(q.id, {
              groupId: "", group_id: "", groupText: "", group_text: ""
            });
          }
          addToast({ title: "Berhasil", description: `Paket literasi "${groupId}" berhasil dihapus.`, type: "success" });
          loadQuestions();
        } catch (e) {
          addToast({ title: "Gagal", description: "Gagal menghapus paket literasi.", type: "error" });
        }
      },
      true,
      "Hapus"
    );
  };

  // ═══ Rename Paket Literasi (update groupId di semua soal dalam grup) ═══
  const handleRenameLiterasi = async (oldGroupId: string, newGroupId: string) => {
    if (!pb || !oldGroupId || !newGroupId.trim()) return;
    if (oldGroupId === newGroupId.trim()) {
      setIsRenamingLiterasi(false);
      return;
    }
    try {
      const groupQuestions = questions.filter(q => q.groupId === oldGroupId);
      for (const q of groupQuestions) {
        await pb.collection('questions').update(q.id, {
          groupId: newGroupId.trim(), group_id: newGroupId.trim()
        });
      }
      addToast({ title: "Berhasil", description: `Paket literasi diubah dari "${oldGroupId}" → "${newGroupId.trim()}".`, type: "success" });
      setIsRenamingLiterasi(false);
      setFormValues(prev => ({ ...prev, groupId: newGroupId.trim() }));
      loadQuestions();
    } catch (e) {
      addToast({ title: "Gagal", description: "Gagal mengubah nama paket literasi.", type: "error" });
    }
  };

  const handleConfirmDeleteAll = async () => {
    if (!pb) return;
    setDeleteAllDialogOpen(false); // Close confirmation immediately
    setIsDeleting(true);
    setImportProgress(0);
    setBatchProgress({
      isOpen: true,
      total: 1, 
      current: 0,
      message: "Menyiapkan pembersihan soal...",
      title: "Hapus Semua Soal"
    });

    try {
      if (pb.authStore.isValid) pb.collection('questions').unsubscribe("*");

      const allQ = await pb.collection('questions').getFullList({
        filter: `examId = "${examId}"`
      });

      if (allQ.length === 0) {
         setBatchProgress(prev => ({ ...prev, isOpen: false }));
         return;
      }

      setBatchProgress(prev => ({ ...prev, total: allQ.length, message: "Mengumpulkan kunci gambar..." }));

      // 1. Gather all image keys across all questions
      const allKeys: string[] = [];
      allQ.forEach(q => {
        allKeys.push(...getQuestionImageKeys(q as any));
      });
      const uniqueKeys = Array.from(new Set(allKeys));

      // 2. Batch Delete Images (Non-blocking)
      setBatchProgress(prev => ({ ...prev, message: `Menghapus ${uniqueKeys.length} gambar dari storage...` }));
      if (uniqueKeys.length > 0) {
        try {
          await deleteImagesFromStorage(uniqueKeys);
        } catch (storageError) {
          console.warn("R2 Bulk Cleanup failed:", storageError);
        }
      }

      // 3. Delete Questions in Parallel Chunks
      setBatchProgress(prev => ({ ...prev, message: "Menghapus data soal dari database..." }));
      const chunkSize = 10;
      for (let i = 0; i < allQ.length; i += chunkSize) {
        const chunk = allQ.slice(i, i + chunkSize);
        await Promise.all(chunk.map(q => pb.collection('questions').delete(q.id)));
        
        const currentProcessed = Math.min(i + chunkSize, allQ.length);
        const progress = Math.round((currentProcessed / allQ.length) * 100);
        setImportProgress(progress);
        setBatchProgress(prev => ({
          ...prev,
          current: currentProcessed,
          message: `Menghapus soal (${currentProcessed}/${allQ.length})`
        }));
      }

      if (pb.authStore.isValid) {
        let rt: ReturnType<typeof setTimeout> | null = null;
        await pb.collection('questions').subscribe("*", () => { if (rt) clearTimeout(rt); rt = setTimeout(() => loadQuestions(), 800); });
      }

      loadQuestions();
      showAlert("Berhasil", "Semua soal berhasil dikosongkan.", "success");
    } catch (e) {
      console.error("Delete All Error:", e);
      showAlert("Gagal", "Terjadi kesalahan saat mengosongkan soal.", "danger");
    } finally {
      setIsDeleting(false);
      setImportProgress(0);
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (!pb) return;
    setBulkDeleteDialogOpen(false); // Close confirmation immediately
    setIsBulkDeleting(true);
    setImportProgress(0);
    setBatchProgress({
      isOpen: true,
      total: selectedIds.length,
      current: 0,
      message: "Menyiapkan penghapusan terpilih...",
      title: "Hapus Soal Terpilih"
    });

    try {
      const selectedQuestions = questions.filter(q => selectedIds.includes(q.id));
      if (selectedQuestions.length === 0) {
        setBatchProgress(prev => ({ ...prev, isOpen: false }));
        return;
      }

      // 📚 Transfer groupText ke soal berikutnya jika "main" literasi dihapus
      const groupsToTransfer = new Map<string, string>();
      selectedQuestions.forEach(q => {
        if (q.groupId && q.groupText && !groupsToTransfer.has(q.groupId)) {
          groupsToTransfer.set(q.groupId, q.groupText);
        }
      });
      for (const [groupId, groupText] of groupsToTransfer) {
        const survivingSiblings = questions.filter(q => q.groupId === groupId && !selectedIds.includes(q.id));
        if (survivingSiblings.length > 0 && !survivingSiblings[0].groupText) {
          try {
            await pb.collection('questions').update(survivingSiblings[0].id, { groupText, group_text: groupText });
          } catch (e) { console.warn("Transfer groupText gagal:", e); }
        }
      }

      // 1. Gather keys
      const allKeys: string[] = [];
      selectedQuestions.forEach(q => allKeys.push(...getQuestionImageKeys(q)));
      const uniqueKeys = Array.from(new Set(allKeys));

      // 2. Batch Delete Images (Non-blocking)
      setBatchProgress(prev => ({ ...prev, message: "Membersihkan gambar di storage..." }));
      if (uniqueKeys.length > 0) {
        try {
          await deleteImagesFromStorage(uniqueKeys);
        } catch (storageError) {
          console.warn("R2 Selection Cleanup failed:", storageError);
        }
      }

      // 3. Parallel Delete Records
      const chunkSize = 10;
      for (let i = 0; i < selectedQuestions.length; i += chunkSize) {
        const chunk = selectedQuestions.slice(i, i + chunkSize);
        await Promise.all(chunk.map(q => pb!.collection('questions').delete(q.id)));
        
        const currentProcessed = Math.min(i + chunkSize, selectedQuestions.length);
        const progress = Math.round((currentProcessed / selectedQuestions.length) * 100);
        setImportProgress(progress);
        setBatchProgress(prev => ({
          ...prev,
          current: currentProcessed,
          message: `Menghapus soal (${currentProcessed}/${selectedQuestions.length})`
        }));
      }

      setSelectedIds([]);
      loadQuestions();
      showAlert("Berhasil", `${selectedQuestions.length} soal berhasil dihapus.`, "success");
    } catch (error) {
      console.error("Bulk Delete Error:", error);
      showAlert("Gagal", "Gagal menghapus beberapa soal.", "danger");
    } finally {
      setIsBulkDeleting(false);
      setImportProgress(0);
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const columns = useMemo(() => [
    {
      key: "selection",
      label: (
        <div className="flex items-center px-1">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 transition-all cursor-pointer accent-indigo-600"
            checked={questions.length > 0 && selectedIds.length === questions.length}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedIds(questions.map((q) => q.id));
              } else {
                setSelectedIds([]);
              }
            }}
          />
        </div>
      ),
      className: "w-[40px]",
      render: (_: any, item: QuestionData, index?: number) => (
        <div className="flex items-center px-1">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 transition-all cursor-pointer accent-indigo-600"
            checked={selectedIds.includes(item.id)}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => handleCheckboxChange(item.id, e.target.checked, index ?? 0, e)}
          />
        </div>
      )
    },
    {
      key: "index",
      label: "No",
      className: "w-[50px]",
      render: (v: any, item: any, index?: number) => (index !== undefined ? index + 1 : 1),
    },
    {
      key: "text",
      label: "Teks Pertanyaan",
      sortable: true,
      render: (v: string, item: QuestionData) => (
        <div className="max-w-lg min-w-[250px]">
          <MathText content={item.text} className="line-clamp-2 text-sm font-serif text-slate-800 dark:text-slate-200 leading-relaxed ql-editor !p-0 [&_p]:m-0 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-4 [&_ul]:pl-4" />
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {(item.imageUrl || item.text.includes("<img")) && (
              <span className="p-1 px-1.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 flex items-center gap-1 font-bold text-[9px] border border-blue-200 dark:border-blue-800/40 uppercase tracking-tight">
                🖼️ Bergambar
              </span>
            )}
            {item.groupId && (
              <span className="p-1 px-1.5 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 flex items-center gap-1 font-bold text-[9px] border border-amber-200 dark:border-amber-800/40 uppercase tracking-tight">
                🔖 Paket: {item.groupId}
                {questions.findIndex(q => q.groupId === item.groupId) === questions.indexOf(item) && <span className="ml-1 px-1 py-0.5 rounded bg-amber-500 text-white text-[7px] font-black">MAIN</span>}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      label: "Tipe Soal",
      className: "min-w-[120px]",
      render: (v: string, item: QuestionData) => {
        const typeLabels: Record<string, string> = {
          pilihan_ganda: "Pilihan Ganda",
          pilihan_ganda_kompleks: "PG Kompleks",
          menjodohkan: "Menjodohkan",
          benar_salah: "Benar / Salah",
          isian_singkat: "Isian Singkat",
          uraian: "Uraian / Esai",
          urutkan: "Urutkan",
          drag_drop: "Drag and Drop"
        };
        return (
          <span className="p-1 px-2 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800/40 uppercase whitespace-nowrap">
            {typeLabels[item.type || "pilihan_ganda"]}
          </span>
        );
      }
    },
    {
      key: "details",
      label: "Detil Jawaban",
      className: "min-w-[150px]",
      render: (v: any, item: QuestionData) => {
        const type = item.type || "pilihan_ganda";
        if (type === "pilihan_ganda" || type === "pilihan_ganda_kompleks" || type === "benar_salah") {
          const keys = Object.keys(item.choices || {});
          const correctCount = keys.filter(k => item.choices?.[k].isCorrect).length;
          const correctKeys = keys.filter(k => item.choices?.[k].isCorrect).map(k => k.toUpperCase()).join(", ");
          
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="p-1 px-2 rounded-md bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-800 whitespace-nowrap">{keys.length} Opsi</span>
              {correctCount > 0 && (
                <span className="p-1 px-2 text-[11px] font-bold rounded-md bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800/40 whitespace-nowrap">
                  Kunci: {correctKeys}
                </span>
              )}
            </div>
          );
        }
        
        if (type === "menjodohkan") {
          return <span className="text-xs text-slate-500 whitespace-nowrap">{(item.pairs || []).length} Pasangan</span>;
        }
        
        if (type === "isian_singkat" || type === "uraian") {
          return <div className="text-xs text-slate-500 line-clamp-1 max-w-[150px]">{item.answerKey || "-"}</div>;
        }
        
        if (type === "urutkan" || type === "drag_drop") {
          return <span className="text-xs text-slate-500 whitespace-nowrap">{(item.items || []).length} Item</span>;
        }
        
        return null;
      }
    }
  ], [questions, selectedIds]);

  const handleImportWord = async (file: File) => {
    if (!pb) return;
    setIsImporting(true);
    setImportProgress(0);
    setBatchProgress({
      isOpen: true,
      total: 0,
      current: 0,
      message: "Menganalisis file Word...",
      title: "Import file Word"
    });

    try {
      const parsed = await parseQuestionsFromWord(file);
      console.log("📋 Word Parser Results:", parsed.length, "soal ditemukan", parsed.map((q, i) => `[${i+1}] type=${q.type} groupId=${q.groupId} text=${(q.text||"").substring(0,50)}`));
      if (parsed.length === 0) throw new Error("Tidak ada soal yang dikenali dalam file.");

      // ─── FILTER BY ALLOWED TYPES ──────────────────────────────────────
      // Only import question types that are enabled by admin
      const filteredByType = parsed.filter(q => {
        const qType = q.type || "pilihan_ganda";
        return allowedTypes[qType] !== false; // default true if not set
      });
      
      const skippedByType = parsed.length - filteredByType.length;
      if (filteredByType.length === 0) {
        setBatchProgress(prev => ({ ...prev, isOpen: false }));
        const disabledTypes = parsed.map(q => q.type).filter((v, i, a) => a.indexOf(v) === i && allowedTypes[v || "pilihan_ganda"] === false);
        throw new Error(`Semua soal bertipe ${disabledTypes.join(", ")} yang belum diaktifkan admin. Aktifkan tipe soal tersebut di Pengaturan terlebih dahulu.`);
      }

      // ─── DUPLICATE DETECTION & UNIQUE GROUP ID ─────────────────────────
      // Fetch existing questions for this exam to check duplicates
      const existingQuestions = await pb!.collection('questions').getFullList({ filter: `examId = "${examId}"` });
      const existingTexts = new Set(existingQuestions.map(q => (q.text || "").replace(/<[^>]*>/g, '').trim().toLowerCase().substring(0, 80)));
      const existingGroupIds = new Set(existingQuestions.map(q => q.groupId || q.group_id || "").filter(Boolean));

      // Filter out duplicates (same question text already exists)
      const uniqueParsed = filteredByType.filter(q => {
        const cleanText = (q.text || "").replace(/<[^>]*>/g, '').trim().toLowerCase().substring(0, 80);
        return cleanText.length > 0 && !existingTexts.has(cleanText);
      });

      // Make groupIds unique if they already exist in DB
      const groupIdRemap = new Map<string, string>();
      uniqueParsed.forEach(q => {
        if (q.groupId && !groupIdRemap.has(q.groupId)) {
          let newId = q.groupId;
          if (existingGroupIds.has(newId)) {
            // Add unique suffix
            const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
            newId = `${q.groupId}-${suffix}`;
          }
          groupIdRemap.set(q.groupId, newId);
          existingGroupIds.add(newId); // prevent collision within same import
        }
      });
      // Apply remapped groupIds
      uniqueParsed.forEach(q => {
        if (q.groupId && groupIdRemap.has(q.groupId)) {
          q.groupId = groupIdRemap.get(q.groupId)!;
        }
      });

      const skippedCount = filteredByType.length - uniqueParsed.length;

      setBatchProgress(prev => ({ ...prev, total: uniqueParsed.length, message: `Menyiapkan import ${uniqueParsed.length} soal${skippedCount > 0 ? ` (${skippedCount} duplikat dilewati)` : ''}${skippedByType > 0 ? ` (${skippedByType} tipe tidak aktif)` : ''}...` }));

      let importedCount = 0;
      const chunkSize = 5;
      
      for (let i = 0; i < uniqueParsed.length; i += chunkSize) {
        const chunk = uniqueParsed.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (q, index) => {
          const actualIndex = i + index;
          let imageUrl = q.imageUrl || "";

          // Upload Question Image if Base64
          if (imageUrl.startsWith("data:image/")) {
            try {
              const blob = await (await fetch(imageUrl)).blob();
              const file = new File([blob], `word_q_${actualIndex}.png`, { type: blob.type });
              const { url } = await uploadInventoryImage("questions", file);
              imageUrl = url;
            } catch (err) {
              console.error("Gagal upload gambar soal:", err);
              imageUrl = ""; 
            }
          }

          // Upload Choice Images and Map them
          const choices: Record<string, any> = {};
          await Promise.all(Object.entries(q.choices).map(async ([key, val]: [string, any]) => {
            let choiceImgUrl = val.imageUrl || "";
            if (choiceImgUrl.startsWith("data:image/")) {
              try {
                const blob = await (await fetch(choiceImgUrl)).blob();
                const file = new File([blob], `word_opt_${actualIndex}_${key}.png`, { type: blob.type });
                const { url } = await uploadInventoryImage("questions", file);
                choiceImgUrl = url;
              } catch (err) {
                console.error(`Gagal upload gambar opsi ${key}:`, err);
                choiceImgUrl = "";
              }
            }

            choices[key.toLowerCase()] = {
              text: val.text,
              isCorrect: val.isCorrect || false,
              imageUrl: choiceImgUrl
            };
          }));

          const answerKey = Object.entries(choices).find(([_, v]) => v.isCorrect)?.[0] || "";

          // Determine field type based on parsed question type
          const typeMap: Record<string, string> = {
            pilihan_ganda: "multiple_choice",
            isian_singkat: "short_answer",
            uraian: "essay"
          };
          const questionType = q.type || "pilihan_ganda";
          const fieldType = typeMap[questionType] || "multiple_choice";

          const payload: any = {
            examId,
            text: q.text,
            field: fieldType,
            type: questionType,
            options: questionType === "pilihan_ganda" ? choices : {},
            correctAnswer: questionType === "pilihan_ganda" ? answerKey.toLowerCase() : (q.answerKey || ""),
            answerKey: questionType === "pilihan_ganda" ? answerKey.toLowerCase() : (q.answerKey || ""),
            groupId: q.groupId || "",
            groupText: q.groupText || "",
            order: (questions.length || 0) + actualIndex + 1,
            imageUrl: imageUrl
          };

          try {
            await pb!.collection('questions').create(payload);
            importedCount++;
          } catch (createErr) {
            console.error("Gagal membuat soal Word pada index:", actualIndex, createErr);
          }
        }));

        const currentProcessed = Math.min(i + chunkSize, uniqueParsed.length);
        const progress = Math.round((currentProcessed / uniqueParsed.length) * 100);
        setImportProgress(progress);
        setBatchProgress(prev => ({
          ...prev,
          current: currentProcessed,
          message: `Mengimport soal (${currentProcessed}/${uniqueParsed.length})`
        }));
      }

      let message = `${importedCount} soal berhasil diimport.`;
      if (skippedCount > 0) message += ` ${skippedCount} soal duplikat dilewati.`;
      if (skippedByType > 0) message += ` ${skippedByType} soal dilewati (tipe belum diaktifkan).`;
      loadQuestions();
      showAlert("Berhasil", message, "success");
    } catch (err: any) {
      console.error("Import Word Error:", err);
      showAlert("Gagal Import", err.message || "Gagal mengimport Word.", "danger");
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleImportExcel = async (file: File) => {
    if (!pb) return;
    setIsImporting(true);
    setBatchProgress({
      isOpen: true,
      total: 0,
      current: 0,
      message: "Membaca file Excel...",
      title: "Import dari Excel"
    });

    try {
      const parsed = await parseQuestionImportExcel(file);
      if (parsed.length === 0) {
        setBatchProgress(prev => ({ ...prev, isOpen: false }));
        return showAlert("File Kosong", "Tidak ada soal yang ditemukan dalam file Excel tersebut.", "warning");
      }

      setBatchProgress(prev => ({ ...prev, total: parsed.length, message: "Memulai import..." }));

      let importedCount = 0;
      const chunkSize = 10;
      for (let i = 0; i < parsed.length; i += chunkSize) {
        const chunk = parsed.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (q, index) => {
          const actualIndex = i + index;
          
          // Determine correct answer based on question type
          let answerKey = "";
          if (q.type === "isian_singkat" || q.type === "uraian") {
            answerKey = q.answerKey || "";
          } else {
            answerKey = Object.entries(q.choices as any).find(([_, v]: any) => v.isCorrect)?.[0] || q.answerKey || "";
          }
          
          const payload = {
            examId,
            text: q.text,
            field: q.field || "multiple_choice",
            type: q.type,
            options: q.choices,
            correctAnswer: answerKey,
            answerKey: answerKey,
            groupId: q.groupId || "",
            groupText: q.groupText || "",
            order: (questions.length || 0) + actualIndex + 1,
            imageUrl: ""
          };

          try {
            await pb!.collection('questions').create(payload);
            importedCount++;
          } catch (createErr) {
            console.error("Gagal membuat soal pada index:", actualIndex, createErr);
          }
        }));

        const currentProcessed = Math.min(i + chunkSize, parsed.length);
        setBatchProgress(prev => ({
          ...prev,
          current: currentProcessed,
          message: `Mengimport soal (${currentProcessed}/${parsed.length})`
        }));
      }

      loadQuestions();
      showAlert("Import Berhasil", `${importedCount} soal berhasil diimport dari Excel.`, "success");
    } catch (err: any) {
      console.error("Import Excel Error:", err);
      showAlert("Gagal Import", err.message || "Gagal mengimport Excel.", "danger");
    } finally {
      setIsImporting(false);
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleImportJson = async (file: File) => {
    if (!pb) return;
    setIsImporting(true);
    setBatchProgress({
      isOpen: true,
      current: 0,
      total: 0,
      message: "Membaca file JSON...",
      title: "Import dari JSON"
    });

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Support both array format and {questions: [...]} format
      const questionsArr: any[] = Array.isArray(data) ? data : (data.questions || data.soal || data.data || []);
      
      if (questionsArr.length === 0) {
        setBatchProgress(prev => ({ ...prev, isOpen: false }));
        showAlert("Gagal", "File JSON tidak berisi soal yang valid.", "danger");
        return;
      }

      setBatchProgress(prev => ({ ...prev, total: questionsArr.length, message: `Mengimport ${questionsArr.length} soal...` }));

      const typeMap: Record<string, string> = {
        pilihan_ganda: "multiple_choice",
        pilihan_ganda_kompleks: "complex_choice",
        menjodohkan: "matching",
        benar_salah: "true_false",
        isian_singkat: "short_answer",
        uraian: "essay",
        urutkan: "sequence",
        drag_drop: "drag_drop",
        multiple_choice: "multiple_choice",
        complex_choice: "complex_choice",
        matching: "matching",
        true_false: "true_false",
        short_answer: "short_answer",
        essay: "essay",
        sequence: "sequence",
      };

      let importedCount = 0;
      for (let i = 0; i < questionsArr.length; i++) {
        const q = questionsArr[i];
        if (!q.text && !q.question) continue;

        const qType = q.type || "pilihan_ganda";
        const choices = q.choices || q.options || {};
        
        // Determine correct answer
        let correctAnswer = q.answerKey || q.answer_key || q.correctAnswer || q.correct_answer || "";
        if (!correctAnswer && choices) {
          const correctKeys = Object.keys(choices).filter(k => {
            const c = choices[k];
            return typeof c === 'object' && c.isCorrect;
          });
          correctAnswer = correctKeys.join(",");
        }

        const payload: any = {
          examId,
          text: q.text || q.question || "",
          field: typeMap[qType] || "multiple_choice",
          options: {},
          correctAnswer: correctAnswer,
          imageUrl: q.imageUrl || q.image_url || "",
          order: q.order || (questions.length + i + 1),
          groupId: q.groupId || q.group_id || "",
          group_id: q.groupId || q.group_id || "",
          groupText: q.groupText || q.group_text || "",
          group_text: q.groupText || q.group_text || "",
        };

        // Build options based on type
        if (qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks" || qType === "benar_salah" || qType === "multiple_choice" || qType === "complex_choice" || qType === "true_false") {
          const opts: any = {};
          Object.keys(choices).forEach(k => {
            const val = choices[k];
            if (typeof val === 'string') {
              opts[k] = { text: val, isCorrect: correctAnswer.includes(k) };
            } else if (typeof val === 'object') {
              opts[k] = { text: val.text || "", imageUrl: val.imageUrl || val.image_url || undefined, isCorrect: !!val.isCorrect };
            }
          });
          payload.options = opts;
        } else if (qType === "menjodohkan" || qType === "matching") {
          payload.options = { pairs: q.pairs || [] };
        } else if (qType === "urutkan" || qType === "drag_drop" || qType === "sequence") {
          payload.options = { items: q.items || [] };
        }

        await pb.collection('questions').create(payload);
        importedCount++;
        setBatchProgress(prev => ({ ...prev, current: importedCount, message: `${importedCount}/${questionsArr.length} soal diimport...` }));
      }

      loadQuestions();
      showAlert("Import Berhasil", `${importedCount} soal berhasil diimport dari JSON.`, "success");
    } catch (err: any) {
      console.error("Import JSON Error:", err);
      showAlert("Gagal Import", err.message || "Gagal mengimport JSON. Pastikan format file benar.", "danger");
    } finally {
      setIsImporting(false);
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const downloadWordTemplateLiterasi = () => {
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Template Literasi</title>
      <style>
        body { font-family: 'Times New Roman', serif; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        td { border: 1px solid #000; padding: 8px; vertical-align: top; }
        .label { width: 40px; font-weight: bold; text-align: center; background-color: #f3f4f6; }
        .stimulus-box { border: 2px solid #059669; padding: 15px; margin-bottom: 20px; background-color: #f0fdf4; }
        .header { font-weight: bold; color: #059669; font-size: 16px; margin-bottom: 5px; }
      </style>
      </head>
      <body>
        <div class="stimulus-box">
          <div class="header text-emerald-600">LITERASI: Mengenal Habitat Gajah</div>
          <p>Gajah adalah mamalia besar yang hidup di hutan-hutan Asia dan Afrika. Gajah merupakan hewan herbivora yang memakan dedaunan dan rumput. Keberadaan gajah sangat penting bagi ekosistem hutan karena mereka membantu penyebaran biji-bijian melalui kotorannya.</p>
        </div>

        <table>
          <tr><td class="label">1</td><td>Apa makanan utama gajah berdasarkan teks di atas?</td></tr>
          <tr><td class="label">A</td><td>Daging Segar</td></tr>
          <tr><td class="label">B</td><td>Tumbuhan (Dedaunan dan Rumput)</td></tr>
          <tr><td class="label">C</td><td>Ikan di Sungai</td></tr>
          <tr><td class="label">D</td><td>Buah-buahan saja</td></tr>
          <tr><td class="label">E</td><td>Serangga Kecil</td></tr>
          <tr><td colspan="2" style="background-color: #f8fafc;"><b>Kunci Jawaban: B</b></td></tr>
        </table>

        <table>
          <tr><td class="label">2</td><td>Mengapa keberadaan gajah sangat penting bagi ekosistem?</td></tr>
          <tr><td class="label">A</td><td>Karena gajah hewan yang sangat besar</td></tr>
          <tr><td class="label">B</td><td>Karena gajah membantu penyebaran biji-bijian</td></tr>
          <tr><td class="label">C</td><td>Karena gajah hidup di Asia dan Afrika</td></tr>
          <tr><td class="label">D</td><td>Karena gajah memakan banyak rumput</td></tr>
          <tr><td class="label">E</td><td>Karena gajah adalah hewan mamalia</td></tr>
          <tr><td colspan="2" style="background-color: #f8fafc;"><b>Kunci Jawaban: B</b></td></tr>
        </table>

        <div class="stimulus-box" style="border-color: #2563eb; background-color: #eff6ff;">
          <div class="header" style="color: #2563eb;">LITERASI: Operasi Hitung Dasar</div>
          <p>Budi memiliki 10 butir kelereng. Kemudian ayahnya memberikan lagi 5 butir kelereng. Keesokan harinya, Budi memberikan 3 butir kelereng kepada adiknya.</p>
        </div>

        <table>
          <tr><td class="label">3</td><td>Berapa total kelereng Budi setelah diberi oleh ayahnya?</td></tr>
          <tr><td class="label">A</td><td>10</td></tr>
          <tr><td class="label">B</td><td>15</td></tr>
          <tr><td class="label">C</td><td>18</td></tr>
          <tr><td class="label">D</td><td>12</td></tr>
          <tr><td class="label">E</td><td>7</td></tr>
          <tr><td colspan="2" style="background-color: #f8fafc;"><b>Kunci Jawaban: B</b></td></tr>
        </table>
      </body>
      </html>
    `;
    
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Template_Soal_Literasi_New.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportToWord = async () => {
    if (questions.length === 0) return;

    setBatchProgress({
      isOpen: true,
      total: questions.length,
      current: 0,
      message: "Menyiapkan export...",
      title: "Export ke Word"
    });

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

    // Convert LaTeX to base64 images (fetched from codecogs in parallel)
    const latexCache = new Map<string, string>();
    
    const fetchLatexImage = async (formula: string, dpi: number): Promise<string> => {
      const cacheKey = `${dpi}_${formula}`;
      if (latexCache.has(cacheKey)) return latexCache.get(cacheKey)!;
      
      const url = `https://latex.codecogs.com/png.latex?\\dpi{${dpi}}\\bg_white ${encodeURIComponent(formula)}`;
      try {
        const resp = await fetch(url);
        if (!resp.ok) return "";
        const blob = await resp.blob();
        // Get actual image dimensions
        const imgBitmap = await createImageBitmap(blob);
        const naturalW = imgBitmap.width;
        const naturalH = imgBitmap.height;
        imgBitmap.close();
        
        const b64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string || "");
          reader.readAsDataURL(blob);
        });
        // Store with dimensions: b64|width|height
        const scaleFactor = dpi / 96; // scale down to ~96dpi display size
        const displayW = Math.round(naturalW / scaleFactor);
        const displayH = Math.round(naturalH / scaleFactor);
        latexCache.set(cacheKey, `${b64}|${displayW}|${displayH}`);
        return `${b64}|${displayW}|${displayH}`;
      } catch { return ""; }
    };

    // Pre-collect all LaTeX formulas from all questions
    const allFormulas: Array<{ formula: string; dpi: number }> = [];
    const extractFormulas = (text: string) => {
      if (!text) return;
      const displayRegex = /(\$\$|\\\[)([\s\S]*?)(\$\$|\\\])/g;
      let m;
      while ((m = displayRegex.exec(text)) !== null) {
        const f = m[2].trim().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/…/g, '\\ldots').replace(/\.\.\./g, '\\ldots');
        if (f.length > 2) allFormulas.push({ formula: f, dpi: 200 });
      }
      const inlineRegex = /(?<!\$)\$([^\$\n]+?)\$(?!\$)/g;
      while ((m = inlineRegex.exec(text)) !== null) {
        const f = m[1].trim().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/…/g, '\\ldots').replace(/\.\.\./g, '\\ldots');
        if (f.length > 1 && /[\\^_{}]/.test(f)) allFormulas.push({ formula: f, dpi: 200 });
      }
      const parenRegex = /\\\(([\s\S]*?)\\\)/g;
      while ((m = parenRegex.exec(text)) !== null) {
        const f = m[1].trim().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/…/g, '\\ldots').replace(/\.\.\./g, '\\ldots');
        if (f.length > 1) allFormulas.push({ formula: f, dpi: 200 });
      }
    };

    // Collect all formulas first
    for (const q of questions) {
      extractFormulas(q.text || "");
      extractFormulas(q.groupText || "");
      if (q.choices) {
        Object.values(q.choices).forEach((c: any) => extractFormulas(c.text || ""));
      }
    }

    // Fetch all formulas in parallel (batches of 10)
    if (allFormulas.length > 0) {
      const uniqueFormulas = [...new Map(allFormulas.map(f => [`${f.dpi}_${f.formula}`, f])).values()];
      for (let i = 0; i < uniqueFormulas.length; i += 10) {
        const batch = uniqueFormulas.slice(i, i + 10);
        setBatchProgress(prev => ({ ...prev, current: Math.min(i + 10, uniqueFormulas.length), total: uniqueFormulas.length, message: `Mengunduh rumus ${Math.min(i + 10, uniqueFormulas.length)}/${uniqueFormulas.length}...` }));
        await Promise.all(batch.map(f => fetchLatexImage(f.formula, f.dpi)));
      }
    }

    // Replace LaTeX in text with base64 images
    const processLatex = (htmlInput: string) => {
      if (!htmlInput) return htmlInput;
      let result = htmlInput;
      const fixFormula = (f: string) => f.trim().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/…/g, '\\ldots').replace(/\.\.\./g, '\\ldots');
      
      result = result.replace(/(\$\$|\\\[)([\s\S]*?)(\$\$|\\\])/g, (_, _s, formula) => {
        const clean = fixFormula(formula);
        const cached = latexCache.get(`200_${clean}`) || "";
        if (!cached) return `[${clean}]`;
        const [b64, w, h] = cached.split('|');
        return `<br/><img src="${b64}" width="${w}" height="${h}" /><br/>`;
      });
      result = result.replace(/(?<!\$)(\$)([^\$\n]+?)(\$)(?!\$)/g, (_, _s, formula) => {
        const clean = fixFormula(formula);
        if (!/[\\^_{}]/.test(clean)) return formula; // plain number/text, keep as-is without $
        const cached = latexCache.get(`200_${clean}`) || "";
        if (!cached) return clean;
        const [b64, w, h] = cached.split('|');
        return ` <img src="${b64}" width="${w}" height="${h}" /> `;
      });
      result = result.replace(/(\\\()([\s\S]*?)(\\\))/g, (_, _s, formula) => {
        const clean = fixFormula(formula);
        const cached = latexCache.get(`200_${clean}`) || "";
        if (!cached) return clean;
        const [b64, w, h] = cached.split('|');
        return ` <img src="${b64}" width="${w}" height="${h}" /> `;
      });
      return result;
    };

    const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

    let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: 'Times New Roman', serif; color: #000; font-size: 11pt; }
  .kop { text-align: center; border-bottom: 2pt solid #000; margin-bottom: 15px; padding-bottom: 5px; }
  .hanging { padding-left: 25pt; text-indent: -25pt; margin-bottom: 3pt; text-align: left; }
  .choice { padding-left: 45pt; text-indent: -20pt; margin-bottom: 1pt; text-align: left; }
  img { display: block; margin: 5pt 0; max-width: 280pt; height: auto; border: none; }
  .wacana { border: 1pt solid #000; padding: 10pt; margin-bottom: 15pt; background: #f5f5f5; font-style: italic; }
  .spacer { margin: 0; padding: 0; line-height: 12pt; font-size: 12pt; height: 12pt; }
  p, div, span { margin: 0; padding: 0; line-height: 1.3; text-align: left; }
</style>
</head>
<body>
  <div class="kop">
    <p style="font-size: 14pt; font-weight: bold;">NASKAH SOAL UJIAN</p>
    <p style="font-size: 12pt;">${exam?.title || "UJIAN CBT"}</p>
    <p style="font-size: 10pt; font-weight: normal;">Mata Pelajaran: ${exam?.subject || "-"} | ${terminology.teacher}: ${exam?.teacherName || "-"}</p>
  </div>
  <table border="0" cellpadding="0" cellspacing="0" style="width:100%; font-size: 10pt; margin-bottom: 15pt; border: none; border-collapse: collapse;">
    <tr>
      <td width="15%" style="border:none; padding: 2px;">No. Peserta</td><td width="2%" style="border:none;">:</td><td width="33%" style="border:none; border-bottom: 0.5pt solid #000;"></td>
      <td width="15%" style="border:none; padding: 2px;">${terminology.class}</td><td width="2%" style="border:none;">:</td><td style="border:none;">${exam?.level || "-"}</td>
    </tr>
    <tr>
      <td style="border:none; padding: 2px;">Nama ${terminology.student}</td><td>:</td><td style="border:none; border-bottom: 0.5pt solid #000;"></td>
      <td style="padding: 2px;">Hari/Tgl</td><td>:</td><td>..........................</td>
    </tr>
  </table>
`;

    let currentGroupId = "";
    let keys = "";

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (i % 5 === 0) {
        setBatchProgress(prev => ({ ...prev, current: i + 1, message: `Memproses soal #${i + 1}...` }));
      }

      if (q.groupId && q.groupId !== currentGroupId && q.groupText) {
        const cleanWacana = cleanForWord(processLatex(q.groupText || ""));
        html += `<div class="wacana"><b>STIMULUS / BACAAN:</b><br/>${cleanWacana}</div>`;
        currentGroupId = q.groupId;
      }

      const processedQText = cleanForWord(processLatex(q.text || ""));
      html += `<div class="hanging"><b>${i + 1}.</b> <span>${processedQText}</span></div>`;

      if (q.choices) {
        for (const letter of ['a', 'b', 'c', 'd', 'e']) {
          const c = (q.choices as any)[letter];
          if (c && c.text) {
            const processedCText = cleanForWord(processLatex(c.text || ""));
            html += `<div class="choice">${letter.toUpperCase()}. <span>${processedCText}</span></div>`;
          }
        }
        html += `<p class="spacer">&nbsp;</p>`;
        const ans = Object.entries(q.choices).filter(([_, v]) => (v as any).isCorrect).map(([k]) => k.toUpperCase()).join(", ");
        keys += `<tr><td align="center">${i + 1}</td><td align="center"><b>${ans || "-"}</b></td></tr>`;
      } else {
        keys += `<tr><td align="center">${i + 1}</td><td>${q.answerKey || "-"}</td></tr>`;
        html += `<p class="spacer">&nbsp;</p>`;
      }
    }

    html += `
  <div style="page-break-before: always;"></div>
  <p align="center" style="font-weight:bold; font-size:14pt; border-bottom:1pt solid #000;">KUNCI JAWABAN</p>
  <table border="1" style="width:100%; border-collapse:collapse; margin-top:10px;">
    <tr style="background:#eee;"><th>No</th><th>Jawaban</th></tr>
    ${keys}
  </table>
</body></html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const fileName = `${exam?.subject || "Ujian"} - ${exam?.teacherName || "Guru"} - ${dateStr}.doc`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();

    setBatchProgress(prev => ({ ...prev, isOpen: false }));
    addToast({ title: "Export Sukses", description: "Naskah soal berhasil diexport.", type: "success" });
  };

  const handleExportToJson = () => {
    if (questions.length === 0) return;
    
    // Create a clean version of questions for export (remove undefined/null fields)
    const exportData = questions.map(q => {
      const clean: any = { text: q.text || "", type: q.type || "pilihan_ganda" };
      if (q.imageUrl) clean.imageUrl = q.imageUrl;
      if (q.groupId) clean.groupId = q.groupId;
      if (q.groupText) clean.groupText = q.groupText;
      if (q.choices && Object.keys(q.choices).length > 0) clean.choices = q.choices;
      if (q.pairs && q.pairs.length > 0) clean.pairs = q.pairs;
      if (q.items && q.items.length > 0) clean.items = q.items;
      if (q.answerKey) clean.answerKey = q.answerKey;
      if (q.order) clean.order = q.order;
      return clean;
    });

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const fileName = `BANK_SOAL_${exam?.subject || "Ujian"}_${dateStr}.json`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addToast({ title: "Export Sukses", description: "File JSON berhasil diunduh.", type: "success" });
  };

  // 📤 Export Selected Questions to JSON
  const handleExportSelectedToJson = () => {
    const selectedQuestions = questions.filter(q => selectedIds.includes(q.id));
    if (selectedQuestions.length === 0) return;

    const exportData = selectedQuestions.map(q => {
      const clean: any = { text: q.text || "", type: q.type || "pilihan_ganda" };
      if (q.imageUrl) clean.imageUrl = q.imageUrl;
      if (q.groupId) clean.groupId = q.groupId;
      if (q.groupText) clean.groupText = q.groupText;
      if (q.choices && Object.keys(q.choices).length > 0) clean.choices = q.choices;
      if (q.pairs && q.pairs.length > 0) clean.pairs = q.pairs;
      if (q.items && q.items.length > 0) clean.items = q.items;
      if (q.answerKey) clean.answerKey = q.answerKey;
      if (q.order) clean.order = q.order;
      return clean;
    });

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const fileName = `SOAL_TERPILIH_${selectedQuestions.length}_${dateStr}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast({ title: "Export Sukses", description: `${selectedQuestions.length} soal berhasil diexport ke JSON.`, type: "success" });
  };

  // 📤 Export Selected Questions to Word
  const handleExportSelectedToWord = async () => {
    const selectedQuestions = questions.filter(q => selectedIds.includes(q.id));
    if (selectedQuestions.length === 0) return;

    // Reuse the existing Word export logic but with selected questions only
    setBatchProgress({ isOpen: true, total: selectedQuestions.length, current: 0, message: "Menyiapkan export...", title: "Export Terpilih ke Word" });

    try {
      const processLatex = (text: string): string => {
        if (!text) return "";
        return text
          .replace(/\$\$([^$]+)\$\$/g, '\\[$1\\]')
          .replace(/\$([^$]+)\$/g, '\\($1\\)');
      };

      const cleanForWord = (html: string): string => {
        if (!html) return "";
        let clean = html;
        clean = clean.replace(/<pre[^>]*class="ql-syntax"[^>]*>([\s\S]*?)<\/pre>/gi, '<p style="font-family:Consolas,monospace;background:#f3f4f6;padding:8px;border:1px solid #e5e7eb;white-space:pre-wrap;">$1</p>');
        return clean;
      };

      let html = `<html><head><meta charset="utf-8"><style>
        body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; margin: 2cm; }
        table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        td, th { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 11pt; }
        .soal { margin-bottom: 16px; }
        .opsi { margin-left: 20px; }
        .kunci { color: #059669; font-weight: bold; }
        .stimulus { border: 1px solid #059669; padding: 12px; margin-bottom: 12px; background: #f0fdf4; }
      </style></head><body>`;

      html += `<h2 style="text-align:center;">EXPORT SOAL TERPILIH</h2>`;
      html += `<p style="text-align:center;font-size:10pt;color:#666;">${exam?.subject || ""} — ${selectedQuestions.length} soal — ${new Date().toLocaleDateString('id-ID')}</p><hr/>`;

      let currentGroupId = "";
      selectedQuestions.forEach((q, idx) => {
        // Show stimulus if new group
        if (q.groupId && q.groupId !== currentGroupId && q.groupText) {
          html += `<div class="stimulus"><b>STIMULUS:</b><br/>${cleanForWord(processLatex(q.groupText))}</div>`;
          currentGroupId = q.groupId;
        }

        html += `<div class="soal"><b>${idx + 1}.</b> ${cleanForWord(processLatex(q.text || ""))}`;

        if (q.choices && (q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks" || q.type === "benar_salah")) {
          html += `<div class="opsi">`;
          Object.keys(q.choices).sort().forEach(key => {
            const choice = q.choices![key];
            const isCorrect = choice.isCorrect;
            html += `<p>${isCorrect ? '<span class="kunci">' : ''}${key.toUpperCase()}. ${cleanForWord(processLatex(choice.text || ""))}${isCorrect ? ' ✓</span>' : ''}</p>`;
          });
          html += `</div>`;
        } else if (q.type === "menjodohkan" && q.pairs) {
          html += `<table><tr><th>Kiri</th><th>Kanan</th></tr>`;
          q.pairs.forEach(p => { html += `<tr><td>${p.left}</td><td>${p.right}</td></tr>`; });
          html += `</table>`;
        } else if ((q.type === "urutkan" || q.type === "drag_drop") && q.items) {
          html += `<ol>`;
          q.items.forEach(item => { html += `<li>${item.text}</li>`; });
          html += `</ol>`;
        }

        if (q.answerKey) {
          html += `<p class="kunci">Kunci: ${q.answerKey.toUpperCase()}</p>`;
        }
        html += `</div>`;

        setBatchProgress(prev => ({ ...prev, current: idx + 1, message: `Memproses soal ${idx + 1}/${selectedQuestions.length}` }));
      });

      html += `</body></html>`;

      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const fileName = `SOAL_TERPILIH_${selectedQuestions.length}_${dateStr}.doc`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast({ title: "Export Sukses", description: `${selectedQuestions.length} soal berhasil diexport ke Word.`, type: "success" });
    } catch (err) {
      console.error("Export Selected Word Error:", err);
      addToast({ title: "Gagal", description: "Gagal export ke Word.", type: "error" });
    } finally {
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const copyToClipboard = (text: string, id?: string) => {
    navigator.clipboard.writeText(text);
    const key = id || text;
    setCopiedId(key);
    
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleCheckboxChange = (id: string, checked: boolean, index: number, event: any) => {
    let newSelectedIds = [...selectedIds];

    if (checked && event.nativeEvent.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const idsInRange = questions.slice(start, end + 1).map(s => s.id);
      
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

  return (
    <div className="space-y-5 relative">
      {/* Global Progress Bar */}
      {(isImporting || isSavingBatch || isParsing || isDeleting || isBulkDeleting) && (
        <div className="fixed top-0 left-0 w-full h-1.5 z-[100] bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-300 shadow-[0_0_10px_rgba(79,70,229,0.5)]" 
            style={{ width: `${importProgress}%` }}
          />
        </div>
      )}

      <div className="relative z-20 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/bank-soal")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-foreground">Daftar Soal</h2>
            <div className="text-sm text-muted-foreground">
              {loading ? (
                <Skeleton className="h-4 w-64 mt-1" />
              ) : (
                <>
                  {exam?.title || "Ujian"}
                  {exam?.subject ? ` - ${exam?.subject}` : ""}
                  {exam?.teacherName ? ` - ${exam?.teacherName}` : ""}
                  {exam?.teacherCode ? ` (${exam?.teacherCode})` : ""}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {loading ? (
            <>
              <Skeleton className="h-9 w-28 rounded-2xl" />
              <Skeleton className="h-9 w-28 rounded-2xl" />
              <Skeleton className="h-9 w-28 rounded-2xl" />
            </>
          ) : (
            <>
              {/* Tombol Import hanya untuk owner atau admin */}
              {isOwner && (
                <div className="relative">
                  {loading ? (
                    <div className="flex gap-2">
                       <Skeleton className="h-9 w-24 rounded-2xl" />
                       <Skeleton className="h-9 w-28 rounded-2xl" />
                       <Skeleton className="h-9 w-24 rounded-2xl" />
                    </div>
                  ) : (
                      <div className="flex items-center gap-2">
                        {/* ⚙️ OPSI DATA DROPDOWN (Combined Import/Export) */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="secondary" size="sm" className="rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 dark:border-emerald-800/40 text-emerald-700 font-bold shadow-sm transition-all h-9 px-4">
                              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                              Opsi Data
                              <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-72 p-2 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-[100]">
                            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2 text-left">Kelola Soal</DropdownMenuLabel>
                            
                            <DropdownMenuItem 
                              className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer group flex items-center gap-3"
                              onClick={() => document.getElementById("unified-import-input")?.click()}
                            >
                              <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Download className="h-5 w-5 rotate-180" />
                              </div>
                              <div className="flex flex-col min-w-0 text-left">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Import Soal</span>
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[8px] font-black uppercase">.xlsx</span>
                                  <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[8px] font-black uppercase">.docx</span>
                                  <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-[8px] font-black uppercase">.json</span>
                                </div>
                              </div>
                            </DropdownMenuItem>

                            {questions.length > 0 && (
                              <DropdownMenuItem 
                                onClick={handleExportToWord} 
                                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                              >
                                <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight tracking-tight">Export ke Word</span>
                                  <span className="text-[10px] text-slate-400 mt-1">Simpan naskah & kunci</span>
                                </div>
                              </DropdownMenuItem>
                            )}

                            {questions.length > 0 && (
                              <DropdownMenuItem 
                                onClick={handleExportToJson} 
                                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                              >
                                <div className="h-10 w-10 shrink-0 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <FileJson className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight tracking-tight">Export ke JSON</span>
                                  <span className="text-[10px] text-slate-400 mt-1">Format data mentah</span>
                                </div>
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
                            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-1.5 text-left">Template Format</DropdownMenuLabel>
                            
                            <DropdownMenuItem 
                              onClick={() => downloadQuestionTemplate()} 
                              className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                            >
                              <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Download className="h-5 w-5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Template Excel</span>
                                  <span className="text-[10px] text-slate-400 mt-1">Download format standard</span>
                                </div>
                              </DropdownMenuItem>

                              <DropdownMenuItem 
                                onClick={() => window.open("/templates/Template_Soal_Tabel.docx")} 
                                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                              >
                                <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight tracking-tight">Template Word</span>
                                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold">★</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 mt-0.5">Format tabel + literasi + rumus</span>
                                </div>
                              </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setIsLiterasiGuideOpen(true)} 
                              className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group border border-dashed border-sky-200 bg-sky-50/30 mt-2"
                            >
                              <div className="h-10 w-10 shrink-0 rounded-lg bg-sky-100 dark:bg-sky-900/30 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <BookOpen className="h-5 w-5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold text-sky-700 dark:text-sky-300 leading-tight">Panduan Literasi</span>
                                <span className="text-[10px] text-sky-500 mt-1">WAJIB BACA: Cara buat soal AKM</span>
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      

                      {/* 📘 MODAL PANDUAN LITERASI */}
                      <Dialog open={isLiterasiGuideOpen} onOpenChange={setIsLiterasiGuideOpen}>
                        <DialogContent className="max-w-2xl rounded-3xl overflow-hidden p-0 border-none shadow-2xl">
                          <div className="bg-gradient-to-br from-sky-600 to-indigo-700 p-8 text-white relative">
                            <BookOpen className="h-16 w-16 opacity-10 absolute right-8 top-8" />
                            <h2 className="text-2xl font-bold mb-2">Panduan Soal Literasi</h2>
                            <p className="text-sky-100 text-sm">Pelajari cara mengelompokkan soal berdasarkan stimulus (AKM/Literasi).</p>
                          </div>
                          
                          <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-950">
                            <div className="space-y-4">
                              <h3 className="text-xl font-bold flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
                                <FileText className="h-6 w-6" />
                                1. Import dari Word (.docx)
                              </h3>
                              <div className="bg-emerald-50/50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 space-y-3">
                                <p className="text-sm text-slate-700 dark:text-slate-300">Tulis kata kunci <b className="text-emerald-600">LITERASI:</b> diikuti narasi Anda di luar tabel soal. Tabel data di dalam soal akan otomatis dipreservasi.</p>
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 font-mono text-xs shadow-sm leading-relaxed">
                                  <div className="text-emerald-600 font-bold mb-1 underline">LITERASI: Mengenal Ekosistem Hutan</div>
                                  <div className="text-slate-400 mb-4 italic">Hutan adalah paruparu dunia yang harus kita jaga...</div>
                                  
                                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 p-2 rounded mb-1 text-slate-600">
                                    [Tabel Soal Nomor 1]
                                  </div>
                                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 p-2 rounded text-slate-600">
                                    [Tabel Soal Nomor 2]
                                  </div>
                                </div>
                                <div className="flex items-start gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded-lg italic">
                                  <Check className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span>Semua soal di bawah judul tsb akan otomatis menjadi satu grup literasi. Tabel data dari Word juga akan ditampilkan dengan rapi.</span>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                              <h3 className="text-xl font-bold flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
                                <FileSpreadsheet className="h-6 w-6" />
                                2. Import dari Excel
                              </h3>
                              <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 space-y-4">
                                <p className="text-sm text-slate-700 dark:text-slate-300">Gunakan kolom <b className="text-indigo-600">GroupId</b> untuk mengelompokkan soal.</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kolom GroupId</div>
                                    <div className="text-indigo-600 font-bold text-sm">GAJAH-01</div>
                                  </div>
                                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Teks Literasi</div>
                                    <div className="text-slate-600 dark:text-slate-300 text-[10px] line-clamp-2">Gajah adalah mamalia...</div>
                                  </div>
                                </div>
                                <p className="text-[11px] text-slate-500 italic">Cukup tuliskan Teks Literasi pada baris pertama dalam satu grup ID.</p>
                              </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                              <h3 className="text-xl font-bold flex items-center gap-3 text-orange-700 dark:text-orange-400">
                                <FileJson className="h-6 w-6" />
                                3. Import dari JSON
                              </h3>
                              <div className="bg-orange-50/50 dark:bg-orange-900/20 p-5 rounded-2xl border border-orange-100 dark:border-orange-800/50 space-y-3">
                                <p className="text-sm text-slate-700 dark:text-slate-300">Gunakan field <b className="text-orange-600">groupId</b> dan <b className="text-orange-600">groupText</b> untuk literasi. Bisa juga minta ChatGPT buatkan soal dengan format ini.</p>
                                
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Template Prompt untuk ChatGPT (Klik untuk Salin):</p>
                                  <div 
                                    onClick={() => {
                                      const prompt = `Buatkan 10 soal pilihan ganda untuk mata pelajaran [ISI MAPEL] kelas [ISI KELAS] dengan format JSON berikut. Gunakan format KaTeX \\(...\\) untuk rumus matematika. Untuk soal literasi, isi groupId dan groupText.

Format JSON:
[{"text": "<p>Teks pertanyaan \\\\(rumus\\\\) ...</p>","type": "pilihan_ganda","groupId": "","groupText": "","choices": {"a": {"isCorrect": false,"text": "Pilihan A"},"b": {"isCorrect": false,"text": "Pilihan B"},"c": {"isCorrect": true,"text": "Pilihan C"},"d": {"isCorrect": false,"text": "Pilihan D"},"e": {"isCorrect": false,"text": "Pilihan E"}},"answerKey": "c","order": 1}]

Aturan:
- type: pilihan_ganda (wajib 5 opsi a-e, 1 isCorrect: true)
- Untuk literasi: isi groupId (misal "LIT-1") dan groupText (teks bacaan HTML)
- Soal dengan groupId sama akan berbagi stimulus yang sama
- Untuk rumus: gunakan \\\\(...\\\\) sebagai delimiter
- answerKey: huruf kecil dari jawaban benar
- Output HANYA JSON array, tanpa penjelasan`;
                                      navigator.clipboard.writeText(prompt);
                                      addToast({ title: "Tersalin!", description: "Prompt template sudah di-copy. Paste ke ChatGPT.", type: "success", duration: 3000 });
                                    }}
                                    className="p-3 bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-800 rounded-xl cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-all group"
                                  >
                                    <code className="text-[10px] font-mono text-slate-600 dark:text-slate-400 leading-relaxed block">
                                      Buatkan 10 soal pilihan ganda untuk mata pelajaran [MAPEL] kelas [KELAS] dengan format JSON... (klik untuk salin prompt lengkap)
                                    </code>
                                    <div className="flex items-center gap-1.5 mt-2 text-[9px] font-bold text-orange-500 group-hover:text-orange-700">
                                      <Copy className="w-3 h-3" /> Klik untuk salin prompt ke ChatGPT
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Contoh Hasil JSON (Klik untuk Salin):</p>
                                  <div 
                                    onClick={() => {
                                      const sample = JSON.stringify([{"text":"<p>Perangkat keras komputer yang berfungsi menampilkan hasil proses adalah ...</p>","type":"pilihan_ganda","groupId":"","groupText":"","choices":{"a":{"isCorrect":false,"text":"Keyboard"},"b":{"isCorrect":false,"text":"Mouse"},"c":{"isCorrect":true,"text":"Monitor"},"d":{"isCorrect":false,"text":"Scanner"},"e":{"isCorrect":false,"text":"Microphone"}},"answerKey":"c","order":1}], null, 2);
                                      navigator.clipboard.writeText(sample);
                                      addToast({ title: "Tersalin!", description: "Contoh JSON sudah di-copy.", type: "success", duration: 3000 });
                                    }}
                                    className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50 transition-all group max-h-24 overflow-hidden"
                                  >
                                    <code className="text-[9px] font-mono text-slate-500 leading-relaxed block">
                                      {'[{"text":"<p>Perangkat keras...</p>","type":"pilihan_ganda","choices":{"a":{"isCorrect":false,"text":"Keyboard"},...},"answerKey":"c"}]'}
                                    </code>
                                    <div className="flex items-center gap-1.5 mt-2 text-[9px] font-bold text-slate-400 group-hover:text-indigo-600">
                                      <Copy className="w-3 h-3" /> Klik untuk salin contoh JSON
                                    </div>
                                  </div>
                                </div>

                                <p className="text-[11px] text-orange-600/80 italic">Paste hasil dari ChatGPT ke tab "Import JSON" di Smart AI Import. Tidak perlu API key.</p>
                              </div>
                            </div>
                          </div>

                          <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between gap-3 items-center">
                            <div className="text-[10px] text-slate-400 italic">Pastikan format file sesuai panduan.</div>
                            <div className="flex gap-2">
                              <Button onClick={() => setIsLiterasiGuideOpen(false)} variant="ghost" className="rounded-xl px-6 font-bold text-slate-500 hover:text-slate-700">Tutup</Button>
                              <Button onClick={() => { setIsLiterasiGuideOpen(false); downloadWordTemplateLiterasi(); }} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2">
                                <Download className="h-4 w-4" />
                                Download Word
                              </Button>
                            </div>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {questions.length > 0 && selectedIds.length > 0 && isOwner && (
                        <>
                        <Button
                          onClick={() => setBulkDeleteDialogOpen(true)}
                          variant="default"
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-950/40 dark:text-orange-400 dark:border dark:border-orange-800/40 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-2 h-9 px-4 text-xs"
                        >
                          <Trash className="h-3.5 w-3.5" />
                          Hapus ({selectedIds.length})
                        </Button>
                        <Button
                          onClick={handleExportSelectedToWord}
                          variant="secondary"
                          size="sm"
                          className="rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/30 font-bold h-9 px-4 text-xs"
                        >
                          <Download className="h-3.5 w-3.5 mr-1.5" />
                          Word
                        </Button>
                        <Button
                          onClick={handleExportSelectedToJson}
                          variant="secondary"
                          size="sm"
                          className="rounded-2xl bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-bold h-9 px-4 text-xs"
                        >
                          <FileJson className="h-3.5 w-3.5 mr-1.5" />
                          JSON
                        </Button>
                        </>
                      )}

                      {questions.length > 0 && selectedIds.length === 0 && isOwner && (
                        <Button
                          onClick={() => setDeleteAllDialogOpen(true)}
                          variant="secondary"
                          size="sm"
                          className="rounded-2xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border dark:border-rose-800/30 shadow-sm font-bold h-9 px-4 transition-all text-xs"
                        >
                          <Trash className="mr-2 h-3.5 w-3.5" /> Hapus Semua
                        </Button>
                      )}

                      {isOwner && (
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800/40 text-blue-700 font-bold shadow-sm transition-all h-9 px-4"
                          >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Tambah
                            <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72 p-2 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-[100]">
                          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2 text-left">Opsi Pembuatan</DropdownMenuLabel>
                          
                          <DropdownMenuItem 
                            onClick={handleCreateClick}
                            className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                          >
                            <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Plus className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col min-w-0 text-left">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Tambah Soal</span>
                              <span className="text-[10px] text-slate-400 mt-1">Input manual satu per satu</span>
                            </div>
                          </DropdownMenuItem>




                          <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
                          
                          {(role === "admin" || (role === "teacher" && (user?.ai_api_key || teacherAIAccess))) && (
                            <>
                              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-1.5 text-left">Fitur Cerdas AI</DropdownMenuLabel>
                              <DropdownMenuItem 
                                onClick={() => setIsAIModalOpen(true)}
                                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                              >
                                <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                  <Sparkles className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col min-w-0 text-left">
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Generasi AI</span>
                                  <span className="text-[10px] text-slate-400 mt-1">Buat soal otomatis dari materi</span>
                                </div>
                              </DropdownMenuItem>

                              <DropdownMenuItem 
                                onClick={() => setIsAIImportOpen(true)}
                                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                              >
                                <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col min-w-0 text-left">
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Smart AI Import (PDF)</span>
                                  <span className="text-[10px] text-slate-400 mt-1">Ekstrak soal otomatis dari PDF</span>
                                </div>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar Soal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-card border rounded-xl shadow-sm border-slate-200/60 dark:border-slate-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-[40px] px-4">
                      <Skeleton className="h-4 w-4" />
                    </TableHead>
                    <TableHead className="w-[50px]">No</TableHead>
                    <TableHead>Teks Pertanyaan</TableHead>
                    <TableHead className="min-w-[120px]">Tipe Soal</TableHead>
                    <TableHead className="min-w-[150px]">Detil Jawaban</TableHead>
                    <TableHead className="text-right pr-6">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="px-4"><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell>
                        <div className="space-y-2 max-w-lg min-w-[250px]">
                          <Skeleton className="h-4 w-full" />
                          <div className="flex gap-1.5">
                            <Skeleton className="h-3 w-20 rounded-md" />
                            <Skeleton className="h-3 w-24 rounded-md" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-24 rounded-md" />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          <Skeleton className="h-5 w-16 rounded-md" />
                          <Skeleton className="h-5 w-20 rounded-md" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1.5">
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
        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="text-center p-12 border bg-card rounded-xl text-slate-400">Belum ada soal untuk ujian ini.</div>
          ) : (
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">Daftar Soal</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={questions}
                  columns={columns}
                  searchPlaceholder="Cari soal..."
                  emptyMessage="Tidak ada soal ditemukan."
                  actions={(q: QuestionData) => (
                    <div className="flex justify-end items-center gap-1.5 whitespace-nowrap">
                      <button
                        className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-xl dark:bg-sky-900/10 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40 transition-all hover:scale-110"
                        onClick={() => {
                          const idx = questions.findIndex(item => item.id === q.id);
                          setPreviewIndex(idx >= 0 ? idx : 0);
                          setPreviewQuestion(q);
                          setIsPreviewOpen(true);
                        }}
                        title="Pratinjau Soal"
                      >
                        <Search className="h-4 w-4" />
                      </button>
                      {isOwner && (
                        <>
                          <button
                            className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl dark:bg-indigo-900/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/40 transition-all hover:scale-110"
                            onClick={() => handleEditClick(q)}
                            title="Edit Soal"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl dark:bg-rose-900/10 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40 transition-all hover:scale-110"
                            onClick={() => handleDeleteClick(q)}
                            title="Hapus Soal"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Dialog for Create/Edit Question */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-card max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Edit Soal" : "Tambah Soal"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4 pt-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-500">Pertanyaan Utama</label>
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all shadow-sm border ${
                    showPreview 
                    ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40 hover:bg-indigo-100" 
                    : "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  {showPreview ? "Pratinjau ON" : "Pratinjau OFF"}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsMathGuideOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 text-[10px] font-bold hover:bg-amber-100 transition-all shadow-sm"
                >
                  <Sparkles className="w-3 h-3" />
                  Panduan Rumus
                </button>
              </div>
            </div>
            <FormField id="text" label="" error={undefined}>
              <div className="bg-card rounded-md border flex flex-col">
                <ReactQuill
                  key={selectedQuestion ? `edit-${selectedQuestion.id}` : "create-main"}
                  ref={quillRef}
                  theme="snow"
                  value={formValues.text}
                  onChange={(content) => setFormValues({ ...formValues, text: content })}
                  placeholder="Tuliskan pertanyaan disini..."
                  modules={quillModules}
                  formats={quillFormats}
                  className="[&_.ql-editor]:min-h-[120px] [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b"
                />
                {/* Pratinjau Tampilan */}
                {showPreview && (
                <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-800 rounded-b-md">
                   <div className="flex items-center gap-2 mb-2.5 opacity-60">
                      <div className="w-1.5 h-3 bg-indigo-500 rounded-full"></div>
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Pratinjau Tampilan (Sesuai Ujian)</p>
                   </div>
                   <MathText 
                     key={formValues.text} 
                     content={formValues.text || ''} 
                     className="text-sm font-serif ql-editor !p-0 text-slate-800 dark:text-slate-200 leading-relaxed" 
                   />
                </div>
                )}
              </div>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField id="type" label="Jenis / Tipe Soal" error={undefined}>
                <select
                  value={formValues.type}
                  onChange={(e) => {
                    const newType = e.target.value as QuestionType;
                    setFormValues(prev => ({
                      ...prev,
                      type: newType,
                      // Reset choices if switching to True/False
                      choices: newType === "benar_salah" ? {
                        a: { text: "Benar", isCorrect: true },
                        b: { text: "Salah", isCorrect: false },
                        c: { text: "", isCorrect: false },
                        d: { text: "", isCorrect: false },
                        e: { text: "", isCorrect: false },
                      } : prev.choices
                    }));
                  }}
                  className="bg-card w-full rounded-md border text-sm h-10 px-3 cursor-pointer text-slate-700 dark:text-slate-200"
                >
                  {(allowedTypes.pilihan_ganda !== false || formValues.type === "pilihan_ganda") && <option value="pilihan_ganda">Pilihan Ganda (Single Choice)</option>}
                  {(allowedTypes.pilihan_ganda_kompleks || formValues.type === "pilihan_ganda_kompleks") && <option value="pilihan_ganda_kompleks">Pilihan Ganda Kompleks (Multi Response)</option>}
                  {(allowedTypes.menjodohkan || formValues.type === "menjodohkan") && <option value="menjodohkan">Menjodohkan (Matching)</option>}
                  {(allowedTypes.benar_salah || formValues.type === "benar_salah") && <option value="benar_salah">Benar / Salah</option>}
                  {(allowedTypes.isian_singkat || formValues.type === "isian_singkat") && <option value="isian_singkat">Isian Singkat</option>}
                  {(allowedTypes.uraian || formValues.type === "uraian") && <option value="uraian">Uraian / Esai</option>}
                  {(allowedTypes.urutkan || formValues.type === "urutkan") && <option value="urutkan">Urutkan (Ordering)</option>}
                  {(allowedTypes.drag_drop || formValues.type === "drag_drop") && <option value="drag_drop">Drag and Drop</option>}
                </select>
              </FormField>

              <FormField id="literasi-active" label="Soal Literasi?" error={undefined}>
                <div className="flex items-center space-x-2 h-10 bg-blue-50/40 dark:bg-blue-950/20 px-3 rounded-md border border-blue-100 dark:border-blue-900/40">
                  <input 
                    type="checkbox" 
                    id="literasi-active" 
                    checked={isLiterasiActive} 
                    onChange={(e) => {
                      setIsLiterasiActive(e.target.checked);
                      if (!e.target.checked) {
                        setFormValues({ ...formValues, groupId: "", groupText: "" });
                      }
                    }} 
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="literasi-active" className="text-sm font-semibold text-blue-700 dark:text-blue-400 cursor-pointer">
                    Aktifkan Paket Stimulus / Literasi
                  </label>
                </div>
              </FormField>
            </div>

            {isLiterasiActive && (
              <div className="bg-blue-50/40 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 space-y-3">
                <div className="space-y-2.5">
                  <FormField id="groupId" label="Pilih / Hubungkan Literasi" error={undefined}>
                    <select
                      value={formValues.groupId === "NEW_LITERASI" ? "NEW_LITERASI" : (literasiMode === "create" ? "NEW_LITERASI" : formValues.groupId)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "NEW_LITERASI") {
                          setLiterasiMode("create");
                          setFormValues({ ...formValues, groupId: "", groupText: '<h2 style="text-align:center;">JUDUL STIMULUS</h2><p><br></p><p>Tuliskan isi stimulus / literasi di sini...</p>' });
                        } else {
                          setLiterasiMode("select");
                          setFormValues({ 
                            ...formValues, 
                            groupId: val, 
                            groupText: existingLiteracies[val] || "" 
                          });
                        }
                      }}
                      className="bg-card w-full rounded-md border text-sm h-9 px-2 cursor-pointer text-slate-700 dark:text-slate-200"
                    >
                      <option value="">-- Pilih Paket Literasi --</option>
                      {Object.keys(existingLiteracies).map((key) => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                      <option value="NEW_LITERASI" className="font-bold text-blue-600">+ Buat Literasi Baru</option>
                    </select>

                    {/* Tombol Rename & Hapus Literasi */}
                    {literasiMode === "select" && formValues.groupId && formValues.groupId !== "NEW_LITERASI" && existingLiteracies[formValues.groupId] && (
                      <div className="flex items-center gap-1.5 mt-2">
                        {isRenamingLiterasi ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <Input
                              value={renameLiterasiValue}
                              onChange={(e) => setRenameLiterasiValue(e.target.value)}
                              placeholder="Nama baru..."
                              className="h-7 text-xs rounded-lg flex-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameLiterasi(formValues.groupId || "", renameLiterasiValue);
                                if (e.key === "Escape") setIsRenamingLiterasi(false);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRenameLiterasi(formValues.groupId || "", renameLiterasiValue)}
                              className="h-7 px-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/40 transition-colors"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsRenamingLiterasi(false)}
                              className="h-7 px-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setRenameLiterasiValue(formValues.groupId || "");
                                setIsRenamingLiterasi(true);
                              }}
                              className="h-7 px-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-[10px] font-bold flex items-center gap-1 border border-amber-200 dark:border-amber-800/40 transition-colors"
                            >
                              <Edit size={11} /> Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLiterasi(formValues.groupId || "")}
                              className="h-7 px-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-[10px] font-bold flex items-center gap-1 border border-red-200 dark:border-red-800/40 transition-colors"
                            >
                              <Trash size={11} /> Hapus
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    
                    {/* 🔒 Pratinjau Terkunci (Read-Only) untuk Pilih Mode */}
                    {literasiMode === "select" && formValues.groupId && existingLiteracies[formValues.groupId] && (
                      <div className="mt-2 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          🔒 Stimulus / Literasi Terkunci (Hanya Edit di Soal #1 grup ini)
                        </span>
                        <MathText 
                          content={existingLiteracies[formValues.groupId]}
                          className="text-[11px] text-slate-600 dark:text-slate-400 [&_img]:max-w-[30px] line-clamp-2 leading-relaxed" 
                        />
                      </div>
                    )}
                  </FormField>

                  {literasiMode === "create" && (
                    <div className="space-y-2 mt-2">
                      <FormField id="newGroupId" label="Kode / Nama Literasi Baru" error={undefined}>
                        <Input
                          placeholder="Contoh: literasi1"
                          value={formValues.groupId === "NEW_LITERASI" ? "" : formValues.groupId}
                          onChange={(e) => setFormValues({ ...formValues, groupId: e.target.value })}
                          className="bg-card rounded-md border text-sm h-9"
                        />
                      </FormField>

                      <FormField id="groupText" label="Teks Stimulus / Literasi Baru" error={undefined}>
                        <div className="bg-card rounded-md border flex flex-col mt-1">
                          <ReactQuill
                            key={`group-create`}
                            theme="snow"
                            value={formValues.groupText || ""}
                            onChange={(content) => setFormValues({ ...formValues, groupText: content })}
                            placeholder="Ketikkan teks stimulus / literasi di sini..."
                            modules={quillModules}
                            formats={quillFormats}
                            className="[&_.ql-editor]:min-h-[200px] [&_.ql-editor_p]:leading-[1.8] [&_.ql-editor_p]:text-justify [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b"
                          />
                        </div>
                      </FormField>
                    </div>
                  )}
                </div>
              </div>
            )}

            <FormField id="image" label="Gambar Cover Soal (Opsional)" error={undefined}>
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-slate-400 -mt-1 mb-1">Gambar ini akan ditampilkan tepat di atas teks pertanyaan utama pada lembar ujian Siswa.</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1.5 cursor-pointer bg-card hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg h-9 text-xs px-3 border border-slate-200 dark:border-slate-800 transition-all font-medium w-fit shadow-sm"
                    onClick={() => {
                      setGalleryTarget({ type: "cover" });
                      setIsPickerOpen(true);
                    }}
                  >
                    <Image className="w-4 h-4 text-slate-400" />
                    <span>{questionFile || formValues.imageUrl ? "Ganti Gambar" : "Tambah Gambar"}</span>
                  </button>
                  {(questionFile || formValues.imageUrl) && (
                    <div className="flex flex-col items-center gap-1">
                      <img
                        src={questionFile ? URL.createObjectURL(questionFile) : formValues.imageUrl}
                        alt="Pratinjau Soal"
                        className="max-h-16 w-auto rounded-lg border border-slate-200/80 shadow-sm"
                      />
                      {coverSizeInfo && (
                        <span className="text-[9px] text-green-600 font-semibold bg-green-50/80 px-1 py-0.5 rounded border border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800/40 shadow-sm">
                          ⚡ {coverSizeInfo}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </FormField>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500 block">Jawab & Penyelesaian</label>
                <span className="text-[10px] text-indigo-500 border border-indigo-100 bg-indigo-50/50 dark:bg-indigo-900/20 dark:border-indigo-800 px-2 rounded-full font-bold">MODE: {formValues.type.replace("_", " ").toUpperCase()}</span>
              </div>

              {/* RENDER BASED ON TYPE */}
              {(formValues.type === "pilihan_ganda" || formValues.type === "pilihan_ganda_kompleks" || formValues.type === "benar_salah") && (
                <div className="space-y-3">
                  {Object.keys(formValues.choices)
                    .filter(k => formValues.type !== "benar_salah" || (k === 'a' || k === 'b'))
                    .map((letter, index) => {
                      return (
                        <div 
                          key={letter} 
                          draggable={canDrag}
                          onDragStart={() => setDraggedIndex(index)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (draggedIndex === null || draggedIndex === index) return;
                            
                            const letters = ['a', 'b', 'c', 'd', 'e'];
                            const oldLetter = letters[draggedIndex];
                            const newLetter = letters[index];
                            
                            const updatedChoices = { ...formValues.choices };
                            const temp = updatedChoices[oldLetter];
                            updatedChoices[oldLetter] = updatedChoices[newLetter];
                            updatedChoices[newLetter] = temp;
                            
                            setFormValues(prev => ({ ...prev, choices: updatedChoices }));
                            setDraggedIndex(null);
                          }}
                          className={`p-3 border rounded-xl space-y-2 transition-all relative group/choice cursor-default ${formValues.choices[letter].isCorrect ? "bg-green-50/30 border-green-200 dark:bg-green-950/10 dark:border-green-900/40" : "bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"}`}
                        >
                          <div className="flex gap-3 items-center">
                            {/* Drag Handle (Visual Only for HTML5) */}
                            <div 
                              onMouseEnter={() => setCanDrag(true)}
                              onMouseLeave={() => setCanDrag(false)}
                              className="cursor-move p-1 -ml-1 text-slate-300 hover:text-slate-500 transition-colors"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            
                            <div className="font-bold text-sm w-4">{letter.toUpperCase()}.</div>
                            <div className="bg-card rounded-md border flex-1">
                              <ReactQuill
                                key={selectedQuestion ? `edit-${selectedQuestion.id}-${letter}` : `create-${letter}`}
                                theme="snow"
                                value={formValues.choices[letter].text}
                                onChange={(content) => handleChoiceChange(letter, 'text', content)}
                                placeholder={`Jawaban ${letter.toUpperCase()} ...`}
                                 modules={quillModulesChoice}
                                 formats={quillFormats}
                                className="[&_.ql-editor]:min-h-[42px] [&_.ql-editor]:py-2 [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:px-1 [&_.ql-toolbar]:py-0 [&_.ql-formats]:mr-1"
                              />
                              {/* Pratinjau Opsi */}
                              {showPreview && formValues.choices[letter].text && (
                                <div className="p-2 bg-slate-50/50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 rounded-b-md">
                                  <MathText content={autoDetectLatex(formValues.choices[letter].text)} className="text-[11px] font-serif ql-editor !p-0 text-slate-600 dark:text-slate-400" />
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1.5 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                className={`h-8 text-[10px] font-bold w-24 justify-center rounded-lg transition-all border flex items-center gap-1.5 focus-visible:ring-emerald-500/30 active:scale-95 ${
                                  formValues.choices[letter].isCorrect 
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40 shadow-sm hover:bg-emerald-100/80 hover:text-emerald-700 active:bg-emerald-200" 
                                    : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-900/40 dark:text-slate-600 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-500 active:bg-slate-200"
                                 }`}
                                size="sm"
                                onClick={() => handleChoiceChange(letter, 'isCorrect', !formValues.choices[letter].isCorrect)}
                              >
                                {formValues.choices[letter].isCorrect ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" />
                                    <span>KUNCI</span>
                                  </>
                                ) : (
                                  "SET KUNCI"
                                )}
                              </Button>
                              <button
                                type="button"
                                className="flex items-center justify-center gap-1 cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md h-8 text-[11px] px-2 border border-slate-200 dark:border-slate-800 transition-all font-medium"
                                onClick={() => {
                                  setGalleryTarget({ type: "choice", letter });
                                  setIsPickerOpen(true);
                                }}
                              >
                                <Image className="w-3.5 h-3.5 text-slate-400" />
                                <span>{choiceFiles[letter] || formValues.choices[letter].imageUrl ? "Ubah" : "Img"}</span>
                              </button>
                            </div>
                          </div>
                          {(choiceFiles[letter] || formValues.choices[letter].imageUrl) && (
                            <div className="pl-14 pt-1 flex items-center gap-2">
                              <img
                                src={choiceFiles[letter] ? URL.createObjectURL(choiceFiles[letter]!) : formValues.choices[letter].imageUrl}
                                alt={`Pratinjau ${letter}`}
                                className="max-h-16 w-auto rounded-lg border border-slate-200/80 shadow-sm"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {formValues.type === "menjodohkan" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 px-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Pernyataan (Kiri)</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Pasangan (Kanan)</span>
                  </div>
                  <div className="space-y-3">
                    {formValues.pairs.map((pair, index) => (
                      <div 
                        key={pair.id} 
                        draggable={canDrag}
                        onDragStart={() => setDraggedIndex(index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedIndex === null || draggedIndex === index) return;
                          const newPairs = [...formValues.pairs];
                          const temp = newPairs[draggedIndex];
                          newPairs[draggedIndex] = newPairs[index];
                          newPairs[index] = temp;
                          setFormValues(prev => ({ ...prev, pairs: newPairs }));
                          setDraggedIndex(null);
                        }}
                        onDragEnd={() => { setDraggedIndex(null); setCanDrag(false); }}
                        className={`flex gap-2 items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 transition-opacity`}
                      >
                        <div 
                          onMouseEnter={() => setCanDrag(true)}
                          onMouseLeave={() => setCanDrag(false)}
                          className="cursor-move p-1 text-slate-300 hover:text-slate-500"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <Input
                          placeholder="Kiri..."
                          value={pair.left}
                          onChange={(e) => handlePairChange(pair.id, "left", e.target.value)}
                          className="h-9 text-xs"
                        />
                        <span className="text-slate-300">➔</span>
                        <Input
                          placeholder="Kanan..."
                          value={pair.right}
                          onChange={(e) => handlePairChange(pair.id, "right", e.target.value)}
                          className="h-9 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemovePair(pair.id)}
                          className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                          disabled={formValues.pairs.length <= 1}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddPair} className="w-full text-xs h-8 border-dashed">
                    <Plus className="h-3 w-3 mr-1" /> Tambah Pasangan
                  </Button>
                </div>
              )}

              {(formValues.type === "isian_singkat" || formValues.type === "uraian") && (
                <div className="space-y-3">
                  <FormField id="answerKey" label={formValues.type === "isian_singkat" ? "Kunci Jawaban" : "Pedoman / Contoh Jawaban"} error={undefined}>
                    <Input
                      placeholder={formValues.type === "isian_singkat" ? "Jawaban benar..." : "Tulis contoh jawaban/pedoman disini..."}
                      value={formValues.answerKey}
                      onChange={(e) => setFormValues(prev => ({ ...prev, answerKey: e.target.value }))}
                      className="bg-card"
                    />
                    {formValues.type === "isian_singkat" && (
                      <p className="text-[10px] text-slate-400 mt-1 italic">* Siswa harus menjawab identik dengan teks di atas untuk poin otomatis.</p>
                    )}
                    {formValues.type === "uraian" && (
                      <p className="text-[10px] text-amber-500 mt-1 italic">* Jenis soal ini akan selalu butuh koreksi manual oleh Guru di dashboard.</p>
                    )}
                  </FormField>
                </div>
              )}

              {(formValues.type === "urutkan" || formValues.type === "drag_drop") && (
                <div className="space-y-3">
                  <p className="text-[10px] text-indigo-500 p-2 bg-indigo-50/50 rounded-lg border border-indigo-100">
                    Ketik item di bawah ini dalam <strong>URUTAN YANG BENAR</strong>. Sistem akan mengacak urutannya saat ujian dimulai.
                  </p>
                  <div className="space-y-3">
                    {formValues.items.map((item, index) => (
                      <div 
                        key={item.id} 
                        draggable={canDrag}
                        onDragStart={() => setDraggedIndex(index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedIndex === null || draggedIndex === index) return;
                          const newItems = [...formValues.items];
                          const temp = newItems[draggedIndex];
                          newItems[draggedIndex] = newItems[index];
                          newItems[index] = temp;
                          setFormValues(prev => ({ ...prev, items: newItems }));
                          setDraggedIndex(null);
                        }}
                        onDragEnd={() => { setDraggedIndex(null); setCanDrag(false); }}
                        className={`flex gap-2 items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 transition-opacity`}
                      >
                        <div 
                          onMouseEnter={() => setCanDrag(true)}
                          onMouseLeave={() => setCanDrag(false)}
                          className="cursor-move p-1 text-slate-300 hover:text-slate-500"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-indigo-600 text-white font-bold text-[10px]">
                          {index + 1}
                        </div>
                        <Input
                          placeholder={`Item ke-${index + 1}...`}
                          value={item.text}
                          onChange={(e) => handleItemChange(item.id, e.target.value)}
                          className="h-9 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.id)}
                          className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                          disabled={formValues.items.length <= 1}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="w-full text-xs h-8 border-dashed">
                    <Plus className="h-3 w-3 mr-1" /> Tambah Item
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-3">
              {dialogMode === "create" && (
                <Button 
                  type="button" 
                  onClick={(e) => handleSubmit(e, true)} 
                  disabled={isSavingQuestion}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl h-11 shadow-lg shadow-emerald-500/20"
                >
                  {isSavingQuestion ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : <><Plus className="mr-2 h-4 w-4" /> Simpan & Tambah Lagi</>}
                </Button>
              )}
              <Button 
                type="submit" 
                disabled={isSavingQuestion}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl h-11 shadow-lg shadow-blue-500/20"
              >
                {isSavingQuestion ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : (dialogMode === "edit" ? "Perbarui" : "Simpan & Tutup")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Preview Soal (CBT Look) */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl p-0 h-[92vh] sm:h-[95vh] w-[95vw] sm:w-full bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[40px] shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-300" hideClose>
          {previewQuestion && (
            <>
               {/* CBT Header Replica - FIXED TOP */}
               <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 sm:px-10 py-5 sm:py-6 flex items-center justify-between z-20 backdrop-blur-md bg-white/90 dark:bg-slate-900/90">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl sm:text-2xl shadow-xl shadow-emerald-200 dark:shadow-none">
                      {questions.findIndex(q => q.id === previewQuestion.id) + 1}
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-[0.2em] leading-tight mb-1">Soal Ujian</h3>
                      <div className="flex items-center gap-2">
                         <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Pratinjau Siswa</span>
                         {previewQuestion.groupId && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 text-[9px] font-black uppercase tracking-widest">Grup: {previewQuestion.groupId}</span>
                         )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">{previewIndex + 1}/{questions.length}</span>
                    <button
                      onClick={() => {
                        if (previewIndex > 0) {
                          const newIdx = previewIndex - 1;
                          setPreviewIndex(newIdx);
                          setPreviewQuestion(questions[newIdx]);
                        }
                      }}
                      disabled={previewIndex <= 0}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (previewIndex < questions.length - 1) {
                          const newIdx = previewIndex + 1;
                          setPreviewIndex(newIdx);
                          setPreviewQuestion(questions[newIdx]);
                        }
                      }}
                      disabled={previewIndex >= questions.length - 1}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsPreviewOpen(false)} className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-500 flex items-center justify-center border border-rose-100 dark:border-rose-800/40 hover:bg-rose-100 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
               </div>

               {/* INTERNAL SCROLLABLE CONTENT - HIDDEN SCROLLBAR */}
               <div className="flex-1 overflow-y-auto scrollbar-hidden p-6 sm:p-10 space-y-8">
                  {/* Literacy Stimulus (If Any) */}
                  {previewQuestion.groupId && (() => {
                    const firstWithText = questions.find(q => q.groupId === previewQuestion.groupId && q.groupText);
                    if (firstWithText) {
                      return (
                        <div className="bg-slate-50 dark:bg-slate-950 p-6 sm:p-8 rounded-[30px] border border-slate-200 dark:border-slate-800 mb-10 space-y-4 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                             <FileText className="w-16 h-16 sm:w-20 sm:h-20 text-emerald-800" />
                           </div>

                           <div className="flex items-center gap-3 mb-4 relative z-10">
                             <div className="h-5 sm:h-6 w-1 sm:w-1.5 rounded-full bg-emerald-600"></div>
                             <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500 dark:text-emerald-400">Bacaan / Stimulus</span>
                           </div>

                           <MathText 
                             content={firstWithText.groupText || ""}
                             className={`leading-relaxed text-slate-800 dark:text-slate-200 font-serif ql-editor !p-0 !overflow-visible selection:bg-blue-100 dark:selection:bg-blue-900/40`} 
                           />

                           <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end opacity-50 dark:opacity-100 text-right">
                             <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest italic">Bacalah teks dengan seksama sebelum memberikan jawaban.</span>
                           </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="space-y-6">
                    {/* Main Question Image */}
                    {previewQuestion.imageUrl && (
                      <div className="relative inline-block group">
                        <SmartImage 
                          src={previewQuestion.imageUrl} 
                          className="max-h-[300px] sm:max-h-[450px] rounded-[30px] border-4 border-white dark:border-slate-800 shadow-2xl transition-all group-hover:brightness-95" 
                          alt="Question" 
                        />
                        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[30px] flex items-center justify-center">
                          <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                        </div>
                      </div>
                    )}

                    {/* Question Text */}
                    <MathText 
                      content={previewQuestion.text}
                      className={`ql-editor !p-0 !overflow-visible font-serif text-lg sm:text-xl text-slate-800 dark:text-slate-100 leading-relaxed break-words [&_strong]:text-blue-600 dark:[&_strong]:text-blue-400 [&_p]:mb-3 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-10 [&_ul]:pl-10 selection:bg-indigo-100 dark:selection:bg-indigo-900/40`} 
                    />

                    {/* Special Type Badge */}
                    {(previewQuestion.type === "pilihan_ganda_kompleks" || previewQuestion.type === "menjodohkan" || previewQuestion.type === "urutkan") && (
                      <div className="flex items-center gap-2 mb-6 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl w-fit">
                        <HelpCircle className="w-4 h-4 text-blue-500" />
                        <span className="text-[10px] sm:text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                          {previewQuestion.type === "pilihan_ganda_kompleks" ? "Pilih semua jawaban yang benar" :
                            previewQuestion.type === "menjodohkan" ? "Pasangkan pernyataan di bawah ini" :
                              "Urutkan pernyataan dengan benar"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Choices Container */}
                  <div className="space-y-3 pt-4">
                    {(previewQuestion.type === "pilihan_ganda" || previewQuestion.type === "pilihan_ganda_kompleks" || previewQuestion.type === "benar_salah" || !previewQuestion.type) && (
                      <div className="space-y-3">
                        {Object.keys(previewQuestion.choices || {}).map((cKey, idx) => {
                          const choice = previewQuestion.choices![cKey];
                          if (!choice.text && !choice.imageUrl) return null;
                          const isCorrect = choice.isCorrect;
                          
                          return (
                            <div key={cKey} className={`w-full text-left p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl border-2 flex items-center gap-3 sm:gap-5 transition-all outline-none group ${isCorrect ? "bg-emerald-50 border-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500 shadow-lg shadow-emerald-500/10" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"}`}>
                              <div className={`w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-xl sm:rounded-2xl border flex items-center justify-center font-black text-sm sm:text-lg transition-colors ${isCorrect ? "bg-emerald-600 border-emerald-600 text-white" : "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800"}`}>
                                {String.fromCharCode(65 + idx)}
                              </div>
                              <div className="flex-1 py-1 sm:py-2">
                                <MathText 
                                  content={choice.text} 
                                  className={`break-words font-serif ql-editor !p-0 !overflow-visible [&_img]:max-w-[300px] [&_img]:h-auto [&_img]:rounded-xl [&_img]:mt-2 text-inherit ${isCorrect ? "font-bold" : "font-normal"}`} 
                                />
                                {choice.imageUrl && (
                                  <div className="mt-4">
                                    <SmartImage src={choice.imageUrl} alt="Choice" className="max-h-[200px] rounded-2xl border border-slate-100" />
                                  </div>
                                )}
                              </div>
                              {isCorrect && <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg"><Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[4px]" /></div>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {previewQuestion.type === "menjodohkan" && (
                      <div className="space-y-4 pt-2">
                        {(previewQuestion.pairs || []).map(p => (
                          <div key={p.id} className="flex flex-col sm:flex-row items-stretch gap-4">
                            <div className="flex-1 p-5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl font-serif text-slate-800 dark:text-slate-200 shadow-sm">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pernyataan</div>
                              {p.left}
                            </div>
                            <div className="hidden sm:flex items-center justify-center text-emerald-500">
                              <Forward className="w-8 h-8" />
                            </div>
                            <div className="flex-1 p-5 bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-dashed border-emerald-400/50 rounded-3xl font-serif text-emerald-800 dark:text-emerald-400 shadow-inner flex flex-col justify-center">
                              <div className="text-[10px] font-black text-emerald-600/50 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Pasangan Benar
                              </div>
                              <div className="text-lg font-black">{p.right}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(previewQuestion.type === "isian_singkat" || previewQuestion.type === "uraian") && (
                      <div className="p-8 sm:p-10 rounded-[40px] border-2 border-dashed border-blue-200 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/20 space-y-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg">
                             <Check className="w-6 h-6 stroke-[3px]" />
                           </div>
                           <div>
                             <span className="text-xs font-black text-blue-600/70 dark:text-blue-400/70 uppercase tracking-widest block">Kunci Jawaban / Pedoman</span>
                             <span className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">Hanya terlihat oleh Administrator</span>
                           </div>
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-blue-100 dark:border-blue-800/40 shadow-xl">
                          {previewQuestion.answerKey || "(Belum diisi)"}
                        </div>
                      </div>
                    )}

                    {(previewQuestion.type === "urutkan" || previewQuestion.type === "drag_drop") && (
                      <div className="space-y-4 pt-2">
                        {(previewQuestion.items || []).map((it, idx) => (
                          <div key={it.id} className="flex items-center gap-5 p-5 rounded-3xl border-2 border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm group">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xl shadow-indigo-200 dark:shadow-none transition-transform group-hover:rotate-6">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                               <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Urutan Benar</div>
                               <span className="text-xl font-serif font-black text-indigo-800 dark:text-indigo-300 leading-tight">{it.text}</span>
                            </div>
                            <div className="opacity-20"><Menu className="w-6 h-6" /></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
               </div>

            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog for Batch Create Questions */}
      <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
        <DialogContent className="max-w-4xl bg-slate-50 dark:bg-slate-900 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kelola & Tinjau Paket Soal</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-3">
            {/* 📖 BATCH LITERACY STIMULUS DISPLAY */}
            {batchQuestions.length > 0 && batchQuestions[0].groupText && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800/40 rounded-3xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-blue-900 dark:text-blue-100 uppercase tracking-tight">Stimulus / Literasi</h3>
                      <p className="text-[10px] text-blue-700/60 dark:text-blue-400/60 font-bold uppercase tracking-widest">Stimulus / Literasi Induk untuk Paket Soal Ini</p>
                    </div>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/80 px-4 py-1.5 rounded-full border border-blue-100 dark:border-blue-800/40 shadow-sm">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">ID: {batchQuestions[0].groupId || 'LIT-NEW'}</span>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-blue-800/40 shadow-inner overflow-hidden">
                  <ReactQuill
                    theme="snow"
                    value={batchQuestions[0].groupText}
                    onChange={(content) => {
                      // Update all questions in batch to share same stimulus
                      const updatedBatch = batchQuestions.map(bq => ({ ...bq, groupText: content }));
                      setBatchQuestions(updatedBatch);
                    }}
                    placeholder="Tuliskan stimulus / literasi di sini..."
                    className="[&_.ql-editor]:min-h-[250px] [&_.ql-editor_p]:text-indent-[48px] [&_.ql-editor_p]:mb-[1.5rem] [&_.ql-editor_p]:leading-[1.8] [&_.ql-editor_p]:text-justify [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:bg-slate-50 dark:[&_.ql-toolbar]:bg-slate-800/50"
                  />
                </div>
              </div>
            )}

            {batchQuestions.map((q, index) => (
              <div key={index} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl shadow-slate-200/20 dark:shadow-none relative space-y-4 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all duration-300">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 -mx-5 -mt-5 p-4 py-3 rounded-t-3xl border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-black text-sm shadow-lg shadow-slate-200 dark:shadow-none">
                      {index + 1}
                    </div>
                    <span className="font-black text-slate-800 dark:text-slate-100 text-[10px] uppercase tracking-widest">Unit Soal</span>
                    {q.type && q.type !== "pilihan_ganda" && (
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${
                        q.type === "pilihan_ganda_kompleks" ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40" :
                        q.type === "benar_salah" ? "bg-green-50 text-green-600 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/40" :
                        q.type === "menjodohkan" ? "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/40" :
                        q.type === "isian_singkat" ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40" :
                        q.type === "uraian" ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40" :
                        q.type === "urutkan" ? "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40" :
                        "bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800/40"
                      }`}>
                        {q.type === "pilihan_ganda_kompleks" ? "PG Kompleks" :
                         q.type === "benar_salah" ? "Benar/Salah" :
                         q.type === "menjodohkan" ? "Menjodohkan" :
                         q.type === "isian_singkat" ? "Isian Singkat" :
                         q.type === "uraian" ? "Uraian" :
                         q.type === "urutkan" ? "Urutkan" :
                         q.type === "drag_drop" ? "Drag & Drop" : q.type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {q.isFromAI && role === "admin" && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleAIRegenerateSingle(index)} 
                        disabled={isRegeneratingIndex === index}
                        className={`h-8 w-8 rounded-xl transition-all ${isRegeneratingIndex === index ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600" : "text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600"}`}
                        title="Regenerasi butir soal ini saja"
                      >
                        <Sparkles className={`h-4 w-4 ${isRegeneratingIndex === index ? "animate-spin" : ""}`} />
                      </Button>
                    )}
                    {batchQuestions.length > 1 && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveBatchRow(index)} 
                        className="h-8 w-8 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 rounded-xl transition-all"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pertanyaan Utama</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setIsMathGuideOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 text-[10px] font-bold hover:bg-amber-100 transition-all shadow-sm"
                    >
                      <Sparkles className="w-3 h-3" />
                      Panduan Rumus
                    </button>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                    <ReactQuill
                      theme="snow"
                      value={q.text}
                      onChange={(content) => updateBatchItem(index, 'text', content)}
                      placeholder="Tuliskan pertanyaan disini..."
                      modules={quillModulesChoice}
                      formats={quillFormats}
                      className="font-serif [&_.ql-editor]:min-h-[80px] [&_.ql-editor]:py-3 [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:px-2 [&_.ql-toolbar]:py-1 [&_.ql-formats]:mr-1 text-sm"
                    />
                    <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/20 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl">
                       <div className="flex items-center gap-2 mb-2 opacity-60">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                          <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Pratinjau Live Render</p>
                       </div>
                       <MathText content={q.text} className="font-serif ql-editor !p-0 text-base text-slate-800 dark:text-slate-200 leading-relaxed [&_p]:mb-3" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 px-1">
                    <button
                      type="button"
                      className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl py-2 px-4 border border-slate-200 dark:border-slate-700 font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm"
                      onClick={() => {
                        setGalleryTarget({ type: "batch", index });
                        setIsPickerOpen(true);
                      }}
                    >
                      <Image className="h-3.5 w-3.5 text-indigo-500" />
                      <span>{q.imageFile || q.imageUrl ? "Ubah Gambar" : "Sisipkan Gambar"}</span>
                    </button>
                    {(q.imageFile || q.imageUrl) && (
                      <div className="flex items-center gap-2 animate-in zoom-in-95 duration-300">
                        <div className="relative group">
                          <img src={q.imageFile ? URL.createObjectURL(q.imageFile) : q.imageUrl} className="h-10 w-auto rounded-xl border-2 border-indigo-100 object-cover shadow-md" alt="Preview" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-xl transition-all flex items-center justify-center">
                            <span className="text-[8px] text-white font-bold uppercase">Gambar</span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => { updateBatchItem(index, 'imageFile', null); updateBatchItem(index, 'imageUrl', ''); }} 
                          className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 p-0 rounded-xl"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {(q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks" || q.type === "benar_salah") && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilihan Jawaban & Kunci</p>
                    </div>
                    {/* Fallback: if benar_salah has no choices, create default */}
                    {q.type === "benar_salah" && (!q.choices || (!q.choices.a && !q.choices.b)) && (
                      <div className="flex flex-col gap-2.5">
                        {[{letter: "a", text: "Benar"}, {letter: "b", text: "Salah"}].map(({letter, text}) => {
                          const isCorrect = q.correctKey === letter;
                          return (
                            <div key={letter} className={`group relative flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300 ${isCorrect ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400" : "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800"}`}>
                              <button type="button" onClick={() => updateBatchItem(index, 'correctKey', letter)} className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all shadow-sm ${isCorrect ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-700 text-slate-400"}`}>{letter.toUpperCase()}</button>
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{text}</span>
                              {isCorrect && <div className="bg-emerald-600 text-white p-1 rounded-lg ml-auto"><Check className="w-3 h-3" /></div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Normal choices rendering */}
                    {(q.choices && (q.choices.a || q.choices.b)) && (
                    <div className="flex flex-col gap-2.5">
                      {['a', 'b', 'c', 'd', 'e'].map(letter => {
                        if (!q.choices?.[letter]) return null;
                        const isCorrect = q.type === "pilihan_ganda_kompleks" 
                          ? (q.correctKey || "").split(",").map((k: string) => k.trim()).includes(letter)
                          : q.correctKey === letter;
                        return (
                          <div 
                            key={letter} 
                            className={`group relative flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300 ${
                              isCorrect 
                                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400 shadow-md shadow-emerald-100 dark:shadow-none" 
                                : "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (q.type === "pilihan_ganda_kompleks") {
                                  // Toggle: add/remove from comma-separated list
                                  const current = (q.correctKey || "").split(",").map((k: string) => k.trim()).filter(Boolean);
                                  const idx = current.indexOf(letter);
                                  if (idx >= 0) current.splice(idx, 1);
                                  else current.push(letter);
                                  updateBatchItem(index, 'correctKey', current.join(","));
                                } else {
                                  updateBatchItem(index, 'correctKey', letter);
                                }
                              }}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all shadow-sm ${
                                isCorrect 
                                  ? "bg-emerald-600 text-white shadow-emerald-200" 
                                  : "bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                              }`}
                            >
                              {letter.toUpperCase()}
                            </button>
                            <div className="flex-1">
                              <div className="w-full flex flex-col gap-1.5">
                                <input
                                  type="text"
                                  placeholder={`Teks Pilihan ${letter.toUpperCase()}...`}
                                  value={q.choices[letter].text}
                                  onChange={(e) => updateBatchChoice(index, letter, e.target.value)}
                                  className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600 p-0"
                                />
                                {q.choices[letter].text && (
                                  <div className="mt-1.5 p-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 animate-in fade-in slide-in-from-top-1 duration-300">
                                    <div className="flex items-center gap-1.5 mb-1 opacity-50">
                                      <Sparkles className="w-3 h-3 text-indigo-500" />
                                      <p className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Preview Math</p>
                                    </div>
                                    <MathText 
                                      key={q.choices[letter].text} 
                                      content={q.choices[letter].text} 
                                      className="text-base font-serif ql-editor !p-0 text-slate-800 dark:text-slate-200" 
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            {isCorrect && (
                              <div className="bg-emerald-600 text-white p-1 rounded-lg animate-in zoom-in-50 duration-300">
                                <Check className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                )}

                {(q.type === "isian_singkat" || q.type === "uraian") && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {q.type === "isian_singkat" ? "Kunci Jawaban" : "Pedoman Penilaian"}
                      </p>
                    </div>
                    <input
                      type="text"
                      placeholder={q.type === "isian_singkat" ? "Kunci Jawaban Singkat..." : "Pedoman Penilaian..."}
                      value={q.answerKey || ""}
                      onChange={(e) => updateBatchItem(index, 'answerKey', e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  </div>
                )}

                {q.type === "menjodohkan" && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-purple-500 rounded-full"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pasangan (Kiri → Kanan)</p>
                    </div>
                    {(!q.pairs || q.pairs.length === 0) ? (
                      <div className="text-center py-4 text-xs text-slate-400 italic">
                        AI tidak menghasilkan pasangan. Tambahkan manual atau regenerasi.
                        <Button variant="outline" size="sm" className="mt-2 text-[10px]" onClick={() => {
                          updateBatchItem(index, 'pairs', [
                            { id: "1", left: "", right: "" },
                            { id: "2", left: "", right: "" },
                            { id: "3", left: "", right: "" },
                            { id: "4", left: "", right: "" }
                          ]);
                        }}>+ Tambah 4 Pasangan</Button>
                      </div>
                    ) : (
                    <div className="space-y-2">
                      {q.pairs.map((pair: any, pIdx: number) => (
                        <div 
                          key={pair.id || pIdx} 
                          draggable
                          onDragStart={() => setBatchDragState({ questionIndex: index, itemIndex: pIdx })}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (!batchDragState || batchDragState.questionIndex !== index || batchDragState.itemIndex === pIdx) return;
                            const newPairs = [...q.pairs];
                            const temp = newPairs[batchDragState.itemIndex];
                            newPairs[batchDragState.itemIndex] = newPairs[pIdx];
                            newPairs[pIdx] = temp;
                            updateBatchItem(index, 'pairs', newPairs);
                            setBatchDragState(null);
                          }}
                          onDragEnd={() => setBatchDragState(null)}
                          className={`flex items-center gap-2 p-2 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-800/40 cursor-grab active:cursor-grabbing transition-opacity ${batchDragState?.questionIndex === index && batchDragState?.itemIndex === pIdx ? "opacity-50" : ""}`}
                        >
                          <GripVertical className="w-4 h-4 text-purple-300 flex-shrink-0" />
                          <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-[10px] font-black flex-shrink-0">{pIdx + 1}</span>
                          <input
                            type="text"
                            value={pair.left}
                            onChange={(e) => {
                              const updatedPairs = [...q.pairs];
                              updatedPairs[pIdx] = { ...updatedPairs[pIdx], left: e.target.value };
                              updateBatchItem(index, 'pairs', updatedPairs);
                            }}
                            className="flex-1 text-xs p-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-purple-500 outline-none"
                            placeholder="Item kiri..."
                          />
                          <Forward className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          <input
                            type="text"
                            value={pair.right}
                            onChange={(e) => {
                              const updatedPairs = [...q.pairs];
                              updatedPairs[pIdx] = { ...updatedPairs[pIdx], right: e.target.value };
                              updateBatchItem(index, 'pairs', updatedPairs);
                            }}
                            className="flex-1 text-xs p-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-purple-500 outline-none"
                            placeholder="Pasangan kanan..."
                          />
                          <button type="button" onClick={() => {
                            const newPairs = q.pairs.filter((_: any, i: number) => i !== pIdx);
                            updateBatchItem(index, 'pairs', newPairs);
                          }} className="text-red-300 hover:text-red-500 transition-colors flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className="text-[10px] text-purple-500" onClick={() => {
                        const newPairs = [...(q.pairs || []), { id: String((q.pairs?.length || 0) + 1), left: "", right: "" }];
                        updateBatchItem(index, 'pairs', newPairs);
                      }}>+ Tambah Pasangan</Button>
                    </div>
                    )}
                  </div>
                )}

                {(q.type === "urutkan" || q.type === "drag_drop") && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-6 ${q.type === "urutkan" ? "bg-orange-500" : "bg-cyan-500"} rounded-full`}></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {q.type === "urutkan" ? "Urutan Benar (atas → bawah)" : "Item (urutan benar)"}
                      </p>
                    </div>
                    {(!q.items || q.items.length === 0) ? (
                      <div className="text-center py-4 text-xs text-slate-400 italic">
                        AI tidak menghasilkan item. Tambahkan manual atau regenerasi.
                        <Button variant="outline" size="sm" className="mt-2 text-[10px]" onClick={() => {
                          updateBatchItem(index, 'items', [
                            { id: "1", text: "" },
                            { id: "2", text: "" },
                            { id: "3", text: "" },
                            { id: "4", text: "" }
                          ]);
                        }}>+ Tambah 4 Item</Button>
                      </div>
                    ) : (
                    <div className="space-y-2">
                      {q.items.map((item: any, iIdx: number) => (
                        <div 
                          key={item.id || iIdx} 
                          draggable
                          onDragStart={() => setBatchDragState({ questionIndex: index, itemIndex: iIdx })}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (!batchDragState || batchDragState.questionIndex !== index || batchDragState.itemIndex === iIdx) return;
                            const newItems = [...q.items];
                            const temp = newItems[batchDragState.itemIndex];
                            newItems[batchDragState.itemIndex] = newItems[iIdx];
                            newItems[iIdx] = temp;
                            updateBatchItem(index, 'items', newItems);
                            setBatchDragState(null);
                          }}
                          onDragEnd={() => setBatchDragState(null)}
                          className={`flex items-center gap-2 p-2 rounded-xl cursor-grab active:cursor-grabbing transition-opacity ${q.type === "urutkan" ? "bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-800/40" : "bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-800/40"} ${batchDragState?.questionIndex === index && batchDragState?.itemIndex === iIdx ? "opacity-50" : ""}`}
                        >
                          <GripVertical className={`w-4 h-4 flex-shrink-0 ${q.type === "urutkan" ? "text-orange-300" : "text-cyan-300"}`} />
                          <span className={`w-6 h-6 rounded-lg ${q.type === "urutkan" ? "bg-orange-600" : "bg-cyan-600"} text-white flex items-center justify-center text-[10px] font-black flex-shrink-0`}>{iIdx + 1}</span>
                          <input
                            type="text"
                            value={item.text}
                            onChange={(e) => {
                              const updatedItems = [...q.items];
                              updatedItems[iIdx] = { ...updatedItems[iIdx], text: e.target.value };
                              updateBatchItem(index, 'items', updatedItems);
                            }}
                            className={`flex-1 text-xs p-1.5 rounded-lg border ${q.type === "urutkan" ? "border-orange-200 dark:border-orange-800" : "border-cyan-200 dark:border-cyan-800"} bg-white dark:bg-slate-800 focus:ring-1 ${q.type === "urutkan" ? "focus:ring-orange-500" : "focus:ring-cyan-500"} outline-none`}
                            placeholder={`Item ${iIdx + 1}...`}
                          />
                          <button type="button" onClick={() => {
                            const newItems = q.items.filter((_: any, i: number) => i !== iIdx);
                            updateBatchItem(index, 'items', newItems);
                          }} className="text-red-300 hover:text-red-500 transition-colors flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className={`text-[10px] ${q.type === "urutkan" ? "text-orange-500" : "text-cyan-500"}`} onClick={() => {
                        const newItems = [...(q.items || []), { id: String((q.items?.length || 0) + 1), text: "" }];
                        updateBatchItem(index, 'items', newItems);
                      }}>+ Tambah Item</Button>
                    </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            <div className="flex justify-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={handleAddBatchRow} className="rounded-xl flex items-center gap-1 text-slate-600 dark:text-slate-400 text-xs h-9">
                <Plus className="h-3.5 w-3.5" /> Tambah Manual
              </Button>
              {(role === "admin" || (role === "teacher" && (user?.ai_api_key || teacherAIAccess))) && batchQuestions.some(q => q.isFromAI) && (
                <>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsAIModalOpen(true)} 
                    className="rounded-xl flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-xs h-9"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Ubah Pengaturan
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAIGenerateDirect} 
                    disabled={isAIGeneratingDirect}
                    className="rounded-xl flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs h-9"
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${isAIGeneratingDirect ? "animate-spin" : ""}`} /> 
                    {isAIGeneratingDirect ? "Generasi..." : "Regenerasi Langsung"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsBatchModalOpen(false)} className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</Button>
            <Button onClick={handleSaveBatch} disabled={isSavingBatch} className="bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/20 text-blue-700 font-semibold">
              {isSavingBatch ? (importProgress > 0 ? `Menyimpan ${importProgress}%` : "Menyimpan...") : `Simpan ${batchQuestions.length} Soal`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Soal"
        description="Apakah Anda yakin ingin menghapus soal ini?"
        itemName="Satu item soal ujian"
        isLoading={isDeleting}
      />

      <DeleteConfirmationDialog
        isOpen={deleteAllDialogOpen}
        onClose={() => setDeleteAllDialogOpen(false)}
        onConfirm={handleConfirmDeleteAll}
        title="Hapus Semua Soal"
        description="Apakah Anda yakin ingin menghapus seluruh soal dalam ujian ini? Tindakan ini tidak dapat dibatalkan."
        itemName={`Total ${questions.length} soal ujian`}
        isLoading={isDeleting}
      />

      <ConfirmationDialog
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={async () => {
          if (confirmModal.onConfirm) confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        title={confirmModal.title}
        description={confirmModal.description}
        type={confirmModal.type}
        confirmLabel={confirmModal.confirmLabel}
        showCancel={confirmModal.showCancel}
      />
      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent className="max-w-4xl bg-card max-h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle>Galeri Media Bersama</DialogTitle>
            <p className="text-xs text-slate-500">Pilih gambar yang pernah diunggah oleh Anda atau rekan guru lainnya.</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
            {galleryGroups.length === 0 ? (
              <div className="text-center p-12 text-slate-400 text-sm">Belum ada gambar yang bisa digunakan di server ini.</div>
            ) : (
              galleryGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-indigo-500 tracking-widest pl-2 border-l-2 border-indigo-500 flex items-center gap-2">
                    {group.title} <span className="text-slate-400 font-medium ml-1">({group.images.length} gambar)</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {group.images.map((src, idx) => (
                      <div
                        key={idx}
                        onClick={() => handlePickGallery(src)}
                        className="group relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-all bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-2 h-24 shadow-sm"
                      >
                        <img src={src} alt="Media" className="max-h-full max-w-full object-contain transition-transform group-hover:scale-110" />
                        <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <span className="text-white text-[10px] font-bold bg-indigo-600 px-3 py-1.5 rounded-lg shadow-sm tracking-widest uppercase">Pilih</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <DialogContent className="max-w-sm bg-card p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Pilih Sumber Gambar</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              className="flex items-center gap-2.5 justify-start p-3 w-full rounded-xl bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 transition-all text-slate-700 dark:text-slate-200"
              onClick={() => globalFileInputRef.current?.click()}
            >
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/40 text-purple-600 dark:text-purple-400">
                <Image className="h-4 w-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-semibold text-xs">Unggah Dari Komputer</span>
                <span className="text-[10px] text-slate-400">File foto maksimal 2MB</span>
              </div>
            </button>
            <button
              type="button"
              className="flex items-center gap-2.5 justify-start p-3 w-full rounded-xl bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 transition-all text-slate-700 dark:text-slate-200"
              onClick={() => { setIsPickerOpen(false); setIsGalleryOpen(true); loadGalleryImages(); }}
            >
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/40 text-blue-600 dark:text-blue-400">
                <FolderOpen className="h-4 w-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-semibold text-xs">Ambil Dari Galeri</span>
                <span className="text-[10px] text-slate-400">Gunakan file yang sudah di-upload</span>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <input
        type="file"
        ref={globalFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleGlobalFileSelect}
      />


      {/* 🪄 MODAL GENERASI AI */}
      <Dialog open={isAIModalOpen} onOpenChange={setIsAIModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <DialogTitle className="text-sm font-bold text-slate-900 dark:text-white">Generate Soal</DialogTitle>
              <p className="text-[10px] text-slate-400 mt-0.5">{AI_MODELS.find((m: any) => m.id === activeAIConfig.model)?.name || activeAIConfig.model}</p>
            </div>
            <button type="button" onClick={handleRandomFill} className="text-[10px] font-medium text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
              <RefreshCw className="w-3 h-3" /> Isi Contoh
            </button>
          </div>

          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Jenjang / Kelas</label>
                <Input value={aiLevel} onChange={(e) => setAiLevel(e.target.value)} placeholder="SMA Kelas 11" className="h-10 rounded-lg text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Mata Pelajaran</label>
                <Input value={aiSubject} onChange={(e) => setAiSubject(e.target.value)} placeholder="Informatika" className="h-10 rounded-lg text-xs" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Topik</label>
              <div className="flex gap-2">
                <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="Jaringan Komputer, Fotosintesis..." className="flex-1 h-10 rounded-lg text-xs" />
                <button type="button" onClick={handleGenerateTopic} disabled={isGeneratingTopic} className="shrink-0 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all disabled:opacity-50" title="Generate topik otomatis">
                  {isGeneratingTopic ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                </button>
              </div>
              {dynamicSuggestions.length > 0 && !isFetchingSuggestions && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {dynamicSuggestions.map((s, i) => (
                    <button key={i} type="button" onClick={() => setAiTopic(String(s))} className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">{String(s)}</button>
                  ))}
                </div>
              )}
            </div>

            {/* 📚 Bahan Materi (upload/paste) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Bahan Materi <span className="font-normal text-slate-400">(opsional)</span></label>
                {aiMaterialFileName && (
                  <button 
                    onClick={() => { setAiMaterialFile(null); setAiMaterialText(""); setAiMaterialFileName(""); }}
                    className="text-[10px] text-rose-500 hover:text-rose-600 font-medium"
                  >
                    Hapus
                  </button>
                )}
              </div>

              {aiMaterialFileName ? (
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-[10px] font-medium text-slate-600 truncate flex-1">{aiMaterialFileName}</span>
                  <span className="text-[9px] text-slate-400">{Math.round(aiMaterialText.length / 1000)}k</span>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 cursor-pointer hover:border-indigo-300 hover:bg-slate-50 transition-all">
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] text-slate-500">{isExtractingMaterial ? "Mengekstrak..." : "Upload Word, PDF, PPT, atau Gambar"}</span>
                  <input type="file" className="hidden" accept=".pdf,.docx,.docm,.pptx,.ppt,.png,.jpg,.jpeg" onChange={handleAIMaterialUpload} disabled={isExtractingMaterial} />
                </label>
              )}

              <textarea value={aiMaterialText} onChange={(e) => setAiMaterialText(e.target.value.substring(0, 4000))} placeholder="Atau paste materi di sini (dari buku, artikel, modul)..." className="w-full min-h-[56px] p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-[11px] resize-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400" />
              {aiMaterialText && <p className="text-[9px] text-slate-400 text-right">{aiMaterialText.length}/4000</p>}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Tipe Soal</label>
                <select value={aiType} onChange={(e) => setAiType(e.target.value)} className="w-full h-10 px-3 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500 outline-none">
                  {allowedTypes.pilihan_ganda && <option value="pilihan_ganda">Pilihan Ganda</option>}
                  {allowedTypes.pilihan_ganda_kompleks && <option value="pilihan_ganda_kompleks">PG Kompleks</option>}
                  {allowedTypes.benar_salah && <option value="benar_salah">Benar / Salah</option>}
                  {allowedTypes.menjodohkan && <option value="menjodohkan">Menjodohkan</option>}
                  {allowedTypes.isian_singkat && <option value="isian_singkat">Isian Singkat</option>}
                  {allowedTypes.urutkan && <option value="urutkan">Mengurutkan</option>}
                  {allowedTypes.drag_drop && <option value="drag_drop">Drag & Drop</option>}
                  {allowedTypes.uraian && <option value="uraian">Uraian / Essay</option>}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Jumlah Soal</label>
                <div className="flex items-center h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3">
                  <button onClick={() => setAiCount(Math.max(1, aiCount - 1))} className="text-slate-400 hover:text-slate-700 font-bold text-sm">−</button>
                  <input type="number" value={aiCount} onChange={(e) => setAiCount(parseInt(e.target.value) || 1)} className="flex-1 text-center bg-transparent font-bold text-slate-800 dark:text-white outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button onClick={() => setAiCount(Math.min(10, aiCount + 1))} className="text-slate-400 hover:text-slate-700 font-bold text-sm">+</button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Kesulitan</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {['mudah', 'sedang', 'sulit'].map((d) => (
                  <button key={d} onClick={() => setAiDifficulty(d)} className={`py-2 rounded-md text-[10px] font-semibold capitalize transition-all ${aiDifficulty === d ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400'}`}>{d}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Taksonomi Bloom</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {([['lots', 'LOTS (C1-C3)'], ['campuran', 'Campuran'], ['hots', 'HOTS (C4-C6)']] as [string, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setTaxonomyPreset(key as "lots" | "hots" | "campuran")} className={`py-2 rounded-md text-[10px] font-semibold transition-all ${getTaxonomyPreset() === key ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400'}`}>{label}</button>
                ))}
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {(['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] as string[]).map((c) => (
                  <button key={c} onClick={() => toggleTaxonomy(c)} className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${aiTaxonomy.includes(c) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}>{c}</button>
                ))}
              </div>
              <p className="text-[9px] text-slate-400">{aiTaxonomy.sort().map(c => { const l: Record<string,string> = {C1:"Mengingat",C2:"Memahami",C3:"Menerapkan",C4:"Menganalisis",C5:"Mengevaluasi",C6:"Mencipta"}; return `${c}: ${l[c]}`; }).join(" · ")}</p>
            </div>

            {(aiObjectives.length > 0 || isFetchingObjectives) && (
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Indikator Soal</p>
                  {isFetchingObjectives && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
                </div>
                {aiObjectives.length > 0 && (
                  <ul className="space-y-1.5">
                    {aiObjectives.map((obj, idx) => {
                      const cMatch = obj.match(/^(C[1-6])\s*[:\-]/);
                      const cLevel = cMatch ? cMatch[1] : "";
                      const text = cMatch ? obj.replace(/^C[1-6]\s*[:\-]\s*/, "") : obj;
                      return (
                        <li key={idx} className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                          {cLevel && <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[8px] font-bold mt-0.5">{cLevel}</span>}
                          <span>{text}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Mode Literasi</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{aiMaterialText ? "Buat stimulus dari materi, lalu soal." : "Buat teks bacaan sebelum soal."}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={isAiLiteracy} onChange={(e) => setIsAiLiteracy(e.target.checked)} />
                <div className="w-9 h-5 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {isAiLiteracy && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Panjang Stimulus</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  {['pendek', 'sedang', 'panjang'].map((len) => (
                    <button key={len} type="button" onClick={() => setAiPassageLength(len)} className={`py-2 rounded-md text-[10px] font-semibold capitalize transition-all ${aiPassageLength === len ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400'}`}>{len}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
            {(isAIGenerating && aiProgress > 0) ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-600">Generating... {aiProgress}%</span>
                  <button onClick={cancelAIGeneration} className="text-[10px] font-medium text-rose-500 hover:text-rose-600">Batalkan</button>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${aiProgress}%` }} />
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setIsAIModalOpen(false)} className="rounded-lg text-xs font-medium">Batal</Button>
                <Button onClick={handleAIGenerate} disabled={isAIGenerating || !aiTopic.trim()} className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold h-10">Generate {aiCount} Soal</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 🤖 Smart AI Import Dialog */}
      <Dialog open={isAIImportOpen} onOpenChange={setIsAIImportOpen}>
        <DialogContent className="max-w-4xl bg-card max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/40 shadow-sm">
                <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">{importMode === 'json' ? 'Import JSON' : 'Smart AI Import'}</DialogTitle>
                <p className="text-xs text-slate-500 font-medium tracking-tight">{importMode === 'json' ? 'Tempel data JSON, langsung diproses tanpa AI.' : 'Tempel teks dari PDF/Word, biarkan AI yang merapikannya.'}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6 scrollbar-thin">
            {parsedResults.length === 0 ? (
              <div className="space-y-6 animate-in fade-in duration-500">
                {/* 🏷️ Mode Selection */}
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-fit">
                  <button
                    onClick={() => setImportMode('extract')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                      importMode === 'extract' 
                      ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Ekstraksi Soal (Detect)
                  </button>
                  <button
                    onClick={() => setImportMode('generate')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                      importMode === 'generate' 
                      ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Buat dari Materi (Gen)
                  </button>
                  <button
                    onClick={() => setImportMode('json')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                      importMode === 'json' 
                      ? "bg-white dark:bg-slate-700 text-orange-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Import JSON
                  </button>
                </div>

                {importMode === 'generate' && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400">Jumlah Soal</label>
                      <Select value={importCount.toString()} onChange={(e) => setImportCount(parseInt(e.target.value))}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <option key={n} value={n.toString()}>{n} Soal</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400">Tipe Soal</label>
                      <Select value={importType} onChange={(e) => setImportType(e.target.value)}>
                        <option value="pilihan_ganda">Pilihan Ganda</option>
                        <option value="pilihan_ganda_kompleks">Ganda Kompleks</option>
                        <option value="benar_salah">Benar / Salah</option>
                        <option value="menjodohkan">Menjodohkan</option>
                        <option value="isian_singkat">Isian Singkat</option>
                        <option value="urutkan">Mengurutkan</option>
                        <option value="drag_drop">Drag & Drop</option>
                        <option value="uraian">Uraian / Essay</option>
                      </Select>
                    </div>
                  </div>
                )}

                {importMode !== 'json' && (
                <div className="flex items-center gap-3">
                   <div className="relative flex-1">
                      <label className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-emerald-200 dark:border-emerald-800/40 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/10 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all group">
                        <Plus className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Pilih File PDF / Word</span>
                        <input type="file" className="hidden" accept=".pdf,.docx,.docm" onChange={handleFileUpload} disabled={isParsing} />
                      </label>
                   </div>
                   <div className="text-slate-400 text-xs font-bold">ATAU</div>
                   <div className="flex-1 text-[10px] text-slate-500 font-medium italic">
                     {importMode === 'extract' ? "Tempel soal-soal mentah di bawah ini" : "Tempel materi bacaan/artikel di bawah ini"}
                   </div>
                </div>
                )}

                <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100/50 dark:border-blue-800/40 rounded-3xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-24 h-24 text-blue-600" />
                  </div>
                  <div className="flex gap-4 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-800 dark:text-blue-300">Cara Menggunakan:</p>
                      <ul className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-1.5 space-y-1.5 list-none">
                        {importMode === 'extract' ? (
                          <>
                            <li className="flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
                              <span>Salin seluruh naskah soal dari Word/PDF (Ctrl+A {'->'} Ctrl+C).</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
                              <span>Tempel di kotak bawah. AI akan mendeteksi puluhan soal sekaligus secara otomatis.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                              <span>Tinjau hasil deteksi, lalu klik "Simpan" untuk memasukkannya ke sistem.</span>
                            </li>
                          </>
                        ) : importMode === 'json' ? (
                          <>
                            <li className="flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
                              <span>Tempel data JSON hasil export atau buat manual sesuai format.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
                              <span>Klik "Parse JSON" — tidak memerlukan AI, langsung diproses.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                              <span>Format: {`[{"text":"...","choices":{"a":{"text":"...","isCorrect":true},...},"answerKey":"a"}]`}</span>
                            </li>
                          </>
                        ) : (
                          <>
                            <li className="flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
                              <span>Tempelkan materi pelajaran, artikel, atau bacaan apa saja.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
                              <span>Tentukan jumlah soal, lalu klik tombol "Buat Soal" di bawah.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                              <span>Soal-soal baru akan muncul dan siap disimpan ke bank soal.</span>
                            </li>
                          </>
                        )}
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                          <span>Teks stimulus / literasi pembuka akan otomatis dipisahkan (Mode Literasi).</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">4</span>
                          <span>Mendukung rumus Matematika (LaTeX), potongan kode program, soal Isian & Uraian.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="relative group">
                  <textarea
                    className="w-full h-[400px] p-6 bg-slate-50/50 dark:bg-slate-900/40 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] text-xs font-mono focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none shadow-inner"
                    placeholder={importMode === 'json' ? '[{"text":"Pertanyaan...","choices":{"a":{"text":"Jawaban A","isCorrect":true},"b":{"text":"Jawaban B","isCorrect":false}},"answerKey":"a"}]' : "Contoh: Buatkan 5 soal literasi tentang ekosistem laut... atau tempelkan naskah soal Anda di sini."}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                  />
                  {!importText && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                      <div className="text-center">
                        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-400">Isi perintah anda / masukkan materi / soal yang sudah jadi untuk dimasukkan ke aplikasi secara cepat</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between sticky top-0 bg-card/80 backdrop-blur-md py-3 z-10 border-b border-slate-100 dark:border-slate-800 -mx-6 px-6">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Hasil Ekstraksi Cerdas</h3>
                    <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">{parsedResults.length} Butir</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setParsedResults([])} className="h-8 text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 transition-colors">Ulangi Proses</Button>
                </div>
                <div className="space-y-4 pb-6 mt-4">
                  {parsedResults.map((q, idx) => (
                    <div key={idx} className="p-5 border border-slate-200/60 dark:border-slate-800 rounded-3xl bg-card hover:border-indigo-200 dark:hover:border-indigo-900/40 transition-colors shadow-sm">
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-400 shrink-0">
                          {idx + 1}
                        </div>
                        <div className="space-y-4 flex-1">
                           {q.groupText && (
                             <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/20 border-l-4 border-indigo-500 rounded-r-2xl mb-2">
                               <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                 <Plus className="w-3 h-3" /> Literasi / Stimulus Khusus
                               </p>
                               <MathText content={q.groupText} className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium line-clamp-4 italic" />
                             </div>
                           )}
                           <MathText content={q.text} className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-normal" />
                           {/* Type badge */}
                           {q.type && q.type !== "pilihan_ganda" && (
                             <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                               q.type === "pilihan_ganda_kompleks" ? "bg-blue-50 text-blue-600 border-blue-200" :
                               q.type === "benar_salah" ? "bg-green-50 text-green-600 border-green-200" :
                               q.type === "menjodohkan" ? "bg-purple-50 text-purple-600 border-purple-200" :
                               q.type === "isian_singkat" ? "bg-amber-50 text-amber-600 border-amber-200" :
                               q.type === "uraian" ? "bg-rose-50 text-rose-600 border-rose-200" :
                               q.type === "urutkan" ? "bg-orange-50 text-orange-600 border-orange-200" :
                               "bg-cyan-50 text-cyan-600 border-cyan-200"
                             }`}>
                               {q.type === "pilihan_ganda_kompleks" ? "PG Kompleks" :
                                q.type === "benar_salah" ? "Benar/Salah" :
                                q.type === "menjodohkan" ? "Menjodohkan" :
                                q.type === "isian_singkat" ? "Isian Singkat" :
                                q.type === "uraian" ? "Uraian" :
                                q.type === "urutkan" ? "Urutkan" :
                                q.type === "drag_drop" ? "Drag & Drop" : q.type}
                             </span>
                           )}
                           {/* Choices (pilihan ganda, benar/salah) */}
                           {q.choices && Object.keys(q.choices).length > 0 && (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2">
                             {Object.entries(q.choices).map(([key, val]: [string, any]) => (
                               <div key={key} className={`p-2.5 rounded-xl border flex items-center gap-3 transition-all ${val.isCorrect ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                 <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black uppercase shrink-0 ${val.isCorrect ? 'bg-emerald-500 text-white shadow-md' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-800'}`}>
                                   {key}
                                 </div>
                                 <MathText content={val.text} className="text-[11px] font-semibold" />
                                 {val.isCorrect && <Check className="w-3.5 h-3.5 ml-auto text-emerald-500 stroke-[3px]" />}
                               </div>
                             ))}
                           </div>
                           )}
                           {/* Pairs (menjodohkan) */}
                           {q.pairs && q.pairs.length > 0 && (
                             <div className="space-y-2 mt-2">
                               {q.pairs.map((p: any, pIdx: number) => (
                                 <div key={p.id || pIdx} className="flex items-center gap-2 p-2 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-800/40">
                                   <span className="w-5 h-5 rounded bg-purple-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">{pIdx + 1}</span>
                                   <span className="flex-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">{p.left}</span>
                                   <Forward className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                   <span className="flex-1 text-[11px] font-bold text-purple-600 dark:text-purple-400">{p.right}</span>
                                 </div>
                               ))}
                             </div>
                           )}
                           {/* Items (urutkan / drag_drop) */}
                           {q.items && q.items.length > 0 && (
                             <div className="space-y-1.5 mt-2">
                               {q.items.map((item: any, iIdx: number) => (
                                 <div key={item.id || iIdx} className={`flex items-center gap-2 p-2 rounded-xl ${q.type === "urutkan" ? "bg-orange-50/50 border border-orange-100" : "bg-cyan-50/50 border border-cyan-100"}`}>
                                   <span className={`w-5 h-5 rounded ${q.type === "urutkan" ? "bg-orange-600" : "bg-cyan-600"} text-white flex items-center justify-center text-[9px] font-black shrink-0`}>{iIdx + 1}</span>
                                   <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{item.text}</span>
                                 </div>
                               ))}
                             </div>
                           )}
                           {/* Answer key (isian singkat / uraian) */}
                           {(q.type === "isian_singkat" || q.type === "uraian") && q.answerKey && (
                             <div className="mt-2 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                               <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">{q.type === "isian_singkat" ? "Kunci Jawaban" : "Pedoman Penilaian"}</p>
                               <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">{q.answerKey}</p>
                             </div>
                           )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 border-t bg-slate-50/50 dark:bg-slate-900/40 gap-3">
            {parsedResults.length === 0 ? (
              <Button
                onClick={handleAIParse}
                disabled={isParsing || !importText.trim()}
                className={`w-full h-14 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 ${
                  importMode === 'json'
                  ? "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200/50"
                  : importMode === 'extract'
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200/50"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200/50"
                }`}
              >
                {isParsing ? (
                  <div className="flex flex-col items-center gap-2 w-full py-1">
                    <div className="flex items-center justify-between w-full px-2">
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {importMode === 'extract' ? "Memilah..." : "Membangun..."} {aiProgress}%
                      </span>
                      <button onClick={cancelAIGeneration} className="px-3 py-1 rounded-lg bg-white/20 text-[10px] font-bold border border-white/30 hover:bg-white/30 transition-colors">
                        Batalkan
                      </button>
                    </div>
                    <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full transition-all duration-300 ease-out" style={{ width: `${aiProgress}%` }} />
                    </div>
                  </div>
                ) : (
                  <>
                    {importMode === 'json' ? <FileJson className="mr-2 h-5 w-5" /> : <Sparkles className="mr-2 h-5 w-5" />}
                    {importMode === 'json' ? "Parse JSON Sekarang" : importMode === 'extract' ? "Analisis Dokumen Sekarang" : "Buat Soal dari Materi Sekarang"}
                  </>
                )}
              </Button>
            ) : (
              <div className="flex gap-4 w-full">
                <Button
                  variant="outline"
                  onClick={() => setIsAIImportOpen(false)}
                  className="flex-1 h-14 rounded-[1.5rem] font-bold uppercase text-xs tracking-widest border-2 border-slate-200 dark:border-slate-800 hover:bg-slate-100 transition-all font-black"
                >
                  Batal
                </Button>
                <Button
                  onClick={handleSaveAIImport}
                  disabled={isParsing}
                  className="flex-[2] h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-200/50 dark:shadow-none transition-all active:scale-95"
                >
                   {isParsing ? (
                    importProgress > 0 ? `Menyimpan ${importProgress}%` : "Sedang Menyimpan..."
                  ) : (
                    <>
                      <Check className="mr-2 h-5 w-5" />
                      Simpan Semuanya ke Bank Soal
                    </>
                  )}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirmationDialog
        isOpen={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        title="Hapus Soal Terpilih"
        description={`Apakah Anda yakin ingin menghapus ${selectedIds.length} soal yang dipilih? Tindakan ini tidak dapat dibatalkan.`}
        isLoading={isBulkDeleting}
        itemName={`${selectedIds.length} soal`}
      />

      <ConfirmationDialog
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={() => {
          if (confirmModal.onConfirm) confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        title={confirmModal.title}
        description={confirmModal.description}
        type={confirmModal.type}
        confirmLabel={confirmModal.confirmLabel || "OK"}
        showCancel={confirmModal.showCancel}
      />

      {/* Batch Progress Dialog */}
      <Dialog open={batchProgress.isOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md bg-card border-none shadow-2xl p-0 overflow-hidden rounded-3xl" hideClose>
          <div className="bg-indigo-600 p-6 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                 <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">{batchProgress.title}</DialogTitle>
                <DialogDescription className="text-indigo-100 text-xs">Mohon tunggu hingga proses selesai.</DialogDescription>
              </div>
            </div>
            <div className="text-right">
               <span className="text-2xl font-black text-white/40">{Math.round((batchProgress.current / batchProgress.total) * 100) || 0}%</span>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
               <div className="flex justify-between items-end mb-1">
                 <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{batchProgress.message}</span>
                 <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                   {batchProgress.current} / {batchProgress.total}
                 </span>
               </div>
               <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-3 bg-slate-100 dark:bg-slate-800" />
            </div>
            
            <p className="text-[10px] text-center text-slate-400 font-medium italic">
              * Jangan menutup atau merefresh halaman ini selama proses berlangsung.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      {/* 📘 MODAL PUSAT BANTUAN PENULISAN STEM */}
      <Dialog open={isMathGuideOpen} onOpenChange={setIsMathGuideOpen}>
        <DialogContent className="max-w-3xl rounded-[1.5rem] overflow-hidden p-0 border-none shadow-2xl bg-white dark:bg-slate-950">
          <div className="bg-slate-900 p-8 text-white relative">
            <BookOpen className="h-16 w-16 opacity-5 absolute right-8 top-8" />
            <h2 className="text-2xl font-bold mb-1 tracking-tight">Panduan Penulisan Rumus</h2>
            <p className="text-slate-400 text-sm font-medium">Cara menulis rumus Matematika, Fisika, dan Kimia agar tampil sempurna di soal ujian.</p>
          </div>
          
          <div className="p-8 space-y-8 max-h-[65vh] overflow-y-auto custom-scrollbar">
            
            {/* ATURAN UTAMA */}
            <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-900/10 border-2 border-rose-200 dark:border-rose-800/40 space-y-3">
              <h4 className="text-sm font-black text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-black">!</span>
                ATURAN PENTING
              </h4>
              <p className="text-sm text-rose-800/80 dark:text-rose-300 leading-relaxed">
                Semua rumus <strong>WAJIB</strong> dibungkus dengan tanda dollar (<code className="bg-rose-100 dark:bg-rose-900/30 px-1.5 py-0.5 rounded font-mono text-rose-700">$...$</code>). Tanpa tanda dollar, rumus akan tampil sebagai teks biasa.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-800">
                  <div className="text-[10px] font-black text-rose-500 mb-1.5">❌ SALAH</div>
                  <code className="text-xs font-mono text-slate-600">{"\\frac{a}{b}"}</code>
                  <div className="mt-2 text-[10px] text-slate-400 italic">Tampil sebagai teks biasa</div>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <div className="text-[10px] font-black text-emerald-500 mb-1.5">✓ BENAR</div>
                  <code className="text-xs font-mono text-indigo-600">{"$ \\frac{a}{b} $"}</code>
                  <div className="mt-2"><MathText content="$ \frac{a}{b} $" className="text-sm" /></div>
                </div>
              </div>
            </div>

            {/* KAMUS SIMBOL LENGKAP */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Kamus Simbol (Klik baris untuk menyalin)</h4>
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="text-left p-3 font-bold text-slate-500 text-[10px] uppercase">Nama</th>
                      <th className="text-left p-3 font-bold text-slate-500 text-[10px] uppercase">Kode (tulis di antara $...$)</th>
                      <th className="text-left p-3 font-bold text-slate-500 text-[10px] uppercase">Hasil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[
                      { name: "Pecahan", code: "\\frac{a}{b}", full: "$ \\frac{a}{b} $" },
                      { name: "Pecahan Besar", code: "\\dfrac{a}{b}", full: "$ \\dfrac{a}{b} $" },
                      { name: "Akar Kuadrat", code: "\\sqrt{x}", full: "$ \\sqrt{x} $" },
                      { name: "Akar Pangkat n", code: "\\sqrt[3]{x}", full: "$ \\sqrt[3]{x} $" },
                      { name: "Pangkat", code: "x^{2}", full: "$ x^{2} $" },
                      { name: "Indeks/Subscript", code: "x_{1}", full: "$ x_{1} $" },
                      { name: "Log basis a", code: "{}^{a}\\!\\log b", full: "$ {}^{a}\\!\\log b $" },
                      { name: "Log natural", code: "\\ln x", full: "$ \\ln x $" },
                      { name: "Derajat", code: "90^\\circ", full: "$ 90^\\circ $" },
                      { name: "Perkalian (dot)", code: "a \\cdot b", full: "$ a \\cdot b $" },
                      { name: "Perkalian (cross)", code: "a \\times b", full: "$ a \\times b $" },
                      { name: "Tidak Sama Dengan", code: "\\neq", full: "$ \\neq $" },
                      { name: "Kurang/Lebih sama", code: "\\leq \\geq", full: "$ \\leq \\geq $" },
                      { name: "Integral", code: "\\int_{a}^{b} f(x)\\,dx", full: "$ \\int_{a}^{b} f(x)\\,dx $" },
                      { name: "Sigma/Jumlah", code: "\\sum_{i=1}^{n} x_i", full: "$ \\sum_{i=1}^{n} x_i $" },
                      { name: "Limit", code: "\\lim_{x \\to \\infty}", full: "$ \\lim_{x \\to \\infty} $" },
                      { name: "Vektor", code: "\\vec{F}", full: "$ \\vec{F} $" },
                      { name: "Teks dalam rumus", code: "5\\text{ kg}", full: "$ 5\\text{ kg} $" },
                      { name: "Kurung besar", code: "\\left( \\frac{a}{b} \\right)", full: "$ \\left( \\frac{a}{b} \\right) $" },
                      { name: "Panah reaksi", code: "\\rightarrow", full: "$ \\rightarrow $" },
                      { name: "Panah kesetimbangan", code: "\\rightleftharpoons", full: "$ \\rightleftharpoons $" },
                      { name: "Delta (perubahan)", code: "\\Delta H", full: "$ \\Delta H $" },
                      { name: "Omega (ohm)", code: "\\Omega", full: "$ \\Omega $" },
                      { name: "Theta (sudut)", code: "\\theta", full: "$ \\theta $" },
                      { name: "Alpha/Beta/Gamma", code: "\\alpha \\beta \\gamma", full: "$ \\alpha \\beta \\gamma $" },
                      { name: "Koma desimal", code: "9{,}8", full: "$ 9{,}8 $" },
                      { name: "Kimia (H₂O)", code: "\\text{H}_2\\text{O}", full: "$ \\text{H}_2\\text{O} $" },
                      { name: "Ion (Na⁺)", code: "\\text{Na}^+", full: "$ \\text{Na}^+ $" },
                      { name: "Keadaan (gas)", code: "\\text{CO}_2(g)", full: "$ \\text{CO}_2(g) $" },
                      { name: "Satuan (m/s²)", code: "\\text{m/s}^2", full: "$ \\text{m/s}^2 $" },
                    ].map((item) => (
                      <tr key={item.name} className="group hover:bg-indigo-50 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors" onClick={() => copyToClipboard(item.full, item.name)}>
                        <td className="p-2.5 font-medium text-slate-700 dark:text-slate-300">{item.name}</td>
                        <td className="p-2.5 font-mono text-indigo-600 dark:text-indigo-400 text-[10px]">{item.code}</td>
                        <td className="p-2.5"><MathText content={item.full} className="text-sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CONTOH SOAL LENGKAP */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Contoh Soal per Mata Pelajaran (Klik untuk Salin)</h4>
              <div className="space-y-3">
                {[
                  { label: "MATEMATIKA — Logaritma", code: "Nilai dari $ \\dfrac{{}^{2}\\!\\log \\sqrt{5} + 2 \\cdot {}^{4}\\!\\log 5}{{}^{2}\\!\\log 3 \\cdot {}^{3}\\!\\log 5} $ = ..." },
                  { label: "MATEMATIKA — Integral", code: "Hitunglah $ \\int_{0}^{2} (3x^2 + 2x) \\, dx $ = ..." },
                  { label: "MATEMATIKA — Limit", code: "Nilai $ \\lim_{x \\to 2} \\dfrac{x^2 - 4}{x - 2} $ = ..." },
                  { label: "MATEMATIKA — Trigonometri", code: "Jika $ \\sin \\alpha = \\dfrac{3}{5} $ dan $ \\alpha $ di kuadran I, tentukan nilai $ \\cos 2\\alpha $ = ..." },
                  { label: "MATEMATIKA — Barisan & Deret", code: "Jumlah $ n $ suku pertama deret geometri $ S_n = \\dfrac{a(1 - r^n)}{1 - r} $. Jika $ a = 3 $, $ r = 2 $, dan $ n = 5 $, maka $ S_5 $ = ..." },
                  { label: "MATEMATIKA — Matriks", code: "Diketahui matriks $ A = \\begin{pmatrix} 2 & 1 \\\\ 3 & 4 \\end{pmatrix} $. Tentukan $ \\det(A) $ = ..." },
                  { label: "MATEMATIKA — Turunan", code: "Jika $ f(x) = 3x^4 - 2x^3 + x - 5 $, maka $ f'(x) $ = ..." },
                  { label: "MATEMATIKA — Peluang", code: "Dari 52 kartu bridge, peluang terambil kartu As atau kartu berwarna merah $ P(A \\cup B) = P(A) + P(B) - P(A \\cap B) $ = ..." },
                  { label: "FISIKA — Hukum Newton", code: "Benda bermassa $ m = 5 \\text{ kg} $ di atas bidang miring $ \\theta = 30^\\circ $. Jika $ g = 10 \\text{ m/s}^2 $ dan $ \\mu_k = 0{,}2 $, percepatan benda $ a $ = ..." },
                  { label: "FISIKA — Listrik", code: "Hambatan total rangkaian seri $ R_1 = 4 \\, \\Omega $ dan $ R_2 = 6 \\, \\Omega $ dengan tegangan $ V = 20 \\text{ V} $. Arus listrik $ I = \\dfrac{V}{R_{total}} $ = ..." },
                  { label: "FISIKA — Gelombang", code: "Gelombang berjalan $ y = 0{,}2 \\sin(4\\pi t - 2\\pi x) $ m. Tentukan amplitudo $ A $, frekuensi $ f $, dan panjang gelombang $ \\lambda $." },
                  { label: "FISIKA — Termodinamika", code: "Gas ideal mengalami proses isobarik. Usaha yang dilakukan gas $ W = P \\cdot \\Delta V $. Jika $ P = 2 \\times 10^5 \\text{ Pa} $ dan $ \\Delta V = 0{,}01 \\text{ m}^3 $, maka $ W $ = ..." },
                  { label: "FISIKA — Relativitas", code: "Energi total partikel bermassa $ m $ bergerak dengan kecepatan $ v $: $ E = \\dfrac{m_0 c^2}{\\sqrt{1 - \\dfrac{v^2}{c^2}}} $" },
                  { label: "FISIKA — Optik", code: "Lensa cembung dengan jarak fokus $ f = 20 \\text{ cm} $. Benda diletakkan $ s = 30 \\text{ cm} $. Jarak bayangan $ \\dfrac{1}{s'} = \\dfrac{1}{f} - \\dfrac{1}{s} $ = ..." },
                  { label: "KIMIA — Reaksi", code: "Reaksi: $ 2\\text{H}_2 + \\text{O}_2 \\rightarrow 2\\text{H}_2\\text{O} $. Jika 4 mol $ \\text{H}_2 $ bereaksi sempurna, berapa mol $ \\text{H}_2\\text{O} $ yang dihasilkan?" },
                  { label: "KIMIA — pH", code: "Larutan $ \\text{CH}_3\\text{COOH} $ 0,1 M dengan $ K_a = 10^{-5} $. Tentukan pH! ($ [\\text{H}^+] = \\sqrt{K_a \\cdot C} $)" },
                  { label: "KIMIA — Termokimia", code: "Diketahui: $ \\text{C}(s) + \\text{O}_2(g) \\rightarrow \\text{CO}_2(g) \\quad \\Delta H = -393{,}5 \\text{ kJ/mol} $. Hitunglah kalor jika 24 g karbon dibakar! ($ A_r \\text{ C} = 12 $)" },
                  { label: "KIMIA — Kesetimbangan", code: "Reaksi: $ \\text{N}_2(g) + 3\\text{H}_2(g) \\rightleftharpoons 2\\text{NH}_3(g) $. Tentukan $ K_c $ jika $ [\\text{NH}_3] = 0{,}4 $ M, $ [\\text{N}_2] = 0{,}2 $ M, $ [\\text{H}_2] = 0{,}1 $ M." },
                  { label: "KIMIA — Elektrokimia", code: "Sel volta: $ \\text{Zn}(s) | \\text{Zn}^{2+}(aq) || \\text{Cu}^{2+}(aq) | \\text{Cu}(s) $. Jika $ E^\\circ_{\\text{Zn}} = -0{,}76 $ V dan $ E^\\circ_{\\text{Cu}} = +0{,}34 $ V, maka $ E^\\circ_{sel} $ = ..." },
                  { label: "BIOLOGI — Genetika", code: "Persilangan $ \\text{Aa} \\times \\text{Aa} $ menghasilkan rasio genotip $ 1\\text{AA} : 2\\text{Aa} : 1\\text{aa} $. Berapa probabilitas fenotip dominan?" },
                  { label: "BIOLOGI — Pertumbuhan", code: "Populasi bakteri: $ N_t = N_0 \\cdot 2^{t/g} $, dengan $ N_0 = 100 $, waktu generasi $ g = 20 $ menit. Jumlah bakteri setelah $ t = 60 $ menit = ..." },
                  { label: "BIOLOGI — Enzim", code: "Laju reaksi enzim mengikuti persamaan Michaelis-Menten: $ v = \\dfrac{V_{max} \\cdot [S]}{K_m + [S]} $. Jika $ V_{max} = 100 $, $ K_m = 5 $, dan $ [S] = 10 $, maka $ v $ = ..." },
                  { label: "EKONOMI — Keseimbangan", code: "Fungsi permintaan $ Q_d = 100 - 2P $ dan penawaran $ Q_s = -20 + 3P $. Harga keseimbangan $ P_e $ dan kuantitas $ Q_e $ = ..." },
                  { label: "EKONOMI — Elastisitas", code: "Elastisitas permintaan $ E_d = \\dfrac{\\Delta Q / Q}{\\Delta P / P} $. Jika harga naik dari $ P_1 = 5000 $ ke $ P_2 = 6000 $ dan $ Q $ turun dari 100 ke 80, maka $ E_d $ = ..." },
                  { label: "INFORMATIKA — Konversi Bilangan", code: "Konversikan $ (1011{,}01)_2 $ ke desimal: $ 1 \\cdot 2^3 + 0 \\cdot 2^2 + 1 \\cdot 2^1 + 1 \\cdot 2^0 + 0 \\cdot 2^{-1} + 1 \\cdot 2^{-2} $ = ..." },
                ].map((ex) => (
                  <div key={ex.label} onClick={() => copyToClipboard(ex.code, ex.label)} className={`group p-4 rounded-2xl border cursor-pointer transition-all ${copiedId === ex.label ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300" : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-indigo-300"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase">{ex.label}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${copiedId === ex.label ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500 opacity-0 group-hover:opacity-100"}`}>{copiedId === ex.label ? "TERSALIN!" : "KLIK SALIN"}</span>
                    </div>
                    <MathText content={ex.code} className="text-sm font-serif leading-relaxed" />
                    <code className="block mt-2 text-[9px] font-mono text-slate-400 break-all">{ex.code}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* TIPS */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 space-y-2">
              <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Tips Penting</h4>
              <ul className="text-[11px] text-amber-800/80 dark:text-amber-300 space-y-1.5">
                <li>• Gunakan <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">{"\\dfrac"}</code> untuk pecahan besar yang lebih mudah dibaca</li>
                <li>• Untuk teks biasa di dalam rumus, bungkus dengan <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">{"\\text{...}"}</code></li>
                <li>• Import dari Word otomatis mengkonversi equation ke LaTeX</li>
                <li>• Copy-paste pecahan HTML dari Word juga otomatis dikonversi</li>
                <li>• AI Generator sudah otomatis menggunakan format LaTeX yang benar</li>
                <li>• Format KaTeX <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">{"\\(...\\)"}</code> juga didukung sebagai alternatif <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">{"$...$"}</code></li>
              </ul>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
            <Button onClick={() => setIsMathGuideOpen(false)} className="w-full h-12 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition-all shadow-xl shadow-slate-200 dark:shadow-none">
              Tutup Dokumentasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Hidden inputs for imports moved here for reliability */}
      <input id="unified-import-input" type="file" className="hidden" accept=".xlsx,.xls,.docx,.docm,.json" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (ext === 'xlsx' || ext === 'xls') handleImportExcel(file);
          else if (ext === 'docx' || ext === 'docm') handleImportWord(file);
          else if (ext === 'json') handleImportJson(file);
          else addToast({ title: "Format Tidak Didukung", description: "Gunakan file .xlsx, .docx, atau .json", type: "error" });
        }
        e.target.value = "";
      }} />
      <input id="excel-import-input" type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleImportExcel(file);
        e.target.value = "";
      }} />
      <input id="word-import-input" type="file" className="hidden" accept=".docx,.docm" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleImportWord(file);
        e.target.value = "";
      }} />
      <input id="json-import-input" type="file" className="hidden" accept=".json" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleImportJson(file);
        e.target.value = "";
      }} />
    </div>
  </div>
);
};

export default QuestionsPage;


