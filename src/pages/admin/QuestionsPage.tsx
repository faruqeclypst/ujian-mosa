import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, Edit, Trash, Check, Copy, Image, ChevronDown, FileText, Download, Eye, EyeOff, FolderOpen, Sparkles, Wand2, RefreshCw, BookOpen, Loader2, FileSpreadsheet, Search, X, Bookmark, Forward, Function, CheckCircle2, Menu, Maximize2, HelpCircle, FileJson, GripVertical, ChevronLeft, ChevronRight, Database, Globe, Key, Layers, Target, Info, MoreHorizontal, Filter, RotateCw, Users, Share2 } from "lucide-react";
import { Reorder } from "framer-motion";
import { MathText } from "../../components/ui/MathText";
import { SmartImage } from "../../components/ui/smart-image";
import { generateQuestionsAI, generateSingleQuestionAI, getTopicSuggestionsAI, parseQuestionsAI, generateFromMaterialAI, generateObjectivesAI, AI_MODELS } from "../../lib/ai";
import { Button } from "../../components/ui/button";
import { NeonButton } from "../../components/ui/NeonButton";
import { NeonBadge, type NeonBadgeVariant } from "../../components/ui/NeonBadge";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { NeonTable, type NeonTableColumn } from "../../components/ui/NeonTable";
import {
  NeonFilterPopover,
  NeonFilterField,
  NeonFilterSelect,
} from "../../components/ui/NeonFilterPopover";
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
  InspectorNav,
  InspectorToggle,
} from "../../components/ui/NeonInspector";
import { NeonTabs } from "../../components/ui/NeonTabs";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { getExamTypeColorClass } from "./ExamsPage";
import { cn } from "../../lib/utils";
import { ConfirmationDialog } from "../../components/dialogs/ConfirmationDialog";
import BatchProgressDialog from "../../components/dialogs/BatchProgressDialog";
import QuestionRepositoryDialog from "../../components/dialogs/QuestionRepositoryDialog";
import { AIChatQuestionDrawer } from "../../components/dialogs/AIChatQuestionDrawer";
import { Input } from "../../components/ui/input";
import { Separator } from "../../components/ui/separator";
import FormField from "../../components/forms/FormField";
import { uploadInventoryImage, deleteImageFromStorage, deleteImagesFromStorage, safeDeleteImage, safeDeleteImages, getR2WorkerUrl, getR2PublicBaseUrl } from "../../lib/storage";
import { compressImage } from "../../lib/imageCompression";
import { SharedGalleryModal } from "../../components/dialogs/SharedGalleryModal";
import { EquationStudioModal } from "../../components/dialogs/EquationStudioModal";
import { insertImageIntoQuestionText } from "../../lib/imageSearch";
import { ImportButton } from "../../components/ui/import-button";
import { parseQuestionsFromWord } from "../../lib/questionWordParser";
import { exportQuestionsToWord } from "./questions/utils/questionExportWord";
import { exportQuestionsToJson } from "./questions/utils/questionExportJson";
import {
  importQuestionsFromWord,
  importQuestionsFromExcel,
  importQuestionsFromJson,
} from "./questions/utils/questionImport";
import { Select } from "../../components/ui/select";
import { latexToOmml } from "../../lib/latexToWordMath";

import { downloadQuestionTemplate, parseQuestionImportExcel } from "../../lib/questionExcel";
import { MathGuideDialog } from "./questions/dialogs/MathGuideDialog";
import { LiterasiGuideDialog } from "./questions/dialogs/LiterasiGuideDialog";
import { QuestionPreviewDialog } from "./questions/dialogs/QuestionPreviewDialog";
import { AIGenerateDialog } from "./questions/dialogs/AIGenerateDialog";
import { AISmartImportDialog } from "./questions/dialogs/AISmartImportDialog";
import { QuestionBatchDialog } from "./questions/dialogs/QuestionBatchDialog";
import { jsonrepair } from "jsonrepair";
import mammoth from "mammoth";
import ReactQuill from "react-quill";
import Quill, {
  wrapTablesForQuill,
  unwrapTablesForStorage,
  quillFormats,
  quillFormatsChoice,
} from "../../lib/quillSetup";
import {
  getAbsoluteUrl,
  forceSmallImage,
  processHtmlInlineImages,
  convertToPngBase64,
} from "./questions/utils/imageProcessors";
import { sanitizeChoiceContent, cleanDeltaForChoice, sanitizeChoiceText } from "../../lib/sanitizeChoice";
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
import {
  type QuestionType,
  type QuestionData,
  detectRumpangIds,
  hasUnbalancedRumpang,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_BADGE,
  getQuestionTypeColor,
} from "./questions/types";

export type { QuestionType, QuestionData };
export {
  detectRumpangIds,
  hasUnbalancedRumpang,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_BADGE,
  getQuestionTypeColor,
};



interface QuestionCacheEntry {
  exam: any;
  questions: QuestionData[];
  timestamp: number;
}
const questionsPageCache = new Map<string, QuestionCacheEntry>();

const QuestionsPage = () => {
  const navigate = useNavigate();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [canDrag, setCanDrag] = useState(false);
  const [examId, setExamId] = useState<string | null>(() => sessionStorage.getItem("activeQuestionsExamId"));
  const cachedData = examId ? questionsPageCache.get(examId) : null;

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

  // Manage Allowed Question Types
  const [allowedTypes, setAllowedTypes] = useState<Record<string, boolean>>({
    pilihan_ganda: true,
    pilihan_ganda_kompleks: true,
    menjodohkan: true,
    benar_salah: true,
    isian_singkat: true,
    urutkan: true,
    drag_drop: true,
    uraian: true,
    klasifikasi: true,
    hotspot: true,
    isian_rumpang: true,
    matriks: true,
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
          if (types) setAllowedTypes(prev => ({ ...prev, ...types }));

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



  const [exam, setExam] = useState<any>(() => cachedData?.exam || null);
  const [questions, setQuestions] = useState<QuestionData[]>(() => cachedData?.questions || []);
  const [loading, setLoading] = useState(() => !cachedData);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isRepoDialogOpen, setIsRepoDialogOpen] = useState(false);
  const [repoDialogInitialTab, setRepoDialogInitialTab] = useState<"internal" | "wayground">("internal");

  const handleOpenBankSoalSelector = () => {
    setRepoDialogInitialTab("internal");
    setIsRepoDialogOpen(true);
  };

  const handleOpenWaygroundImporter = () => {
    setRepoDialogInitialTab("wayground");
    setIsRepoDialogOpen(true);
  };

  // NeonTable Search, Filters & Inspector States
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [inspectedQuestionId, setInspectedQuestionId] = useState<string | null>(null);
  const [showInspector, setShowInspector] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const groupsList = useMemo(() => {
    const set = new Set<string>();
    questions.forEach(q => {
      if (q.groupId) set.add(q.groupId);
    });
    return Array.from(set).sort();
  }, [questions]);

  const displayQuestions = useMemo(() => {
    return questions.filter((q) => {
      // 1. Filter Tipe Soal & Tab Cepat
      const qType = q.type || "pilihan_ganda";
      if (typeFilter === "complex") {
        if (qType === "pilihan_ganda") return false;
      } else if (typeFilter === "image") {
        if (!q.imageUrl && !q.text.includes("<img")) return false;
      } else if (typeFilter === "stimulus") {
        if (!q.groupId) return false;
      } else if (typeFilter !== "all" && qType !== typeFilter) {
        return false;
      }

      // 2. Filter Grup/Paket Stimulus
      if (groupFilter !== "all" && q.groupId !== groupFilter) return false;

      // 3. Pencarian Teks
      if (!searchQuery.trim()) return true;
      const qLower = searchQuery.toLowerCase();
      const plainText = (q.text || "").replace(/<[^>]*>/g, " ").toLowerCase();
      if (plainText.includes(qLower)) return true;
      if (q.groupId && q.groupId.toLowerCase().includes(qLower)) return true;
      if (q.groupText && q.groupText.replace(/<[^>]*>/g, " ").toLowerCase().includes(qLower)) return true;
      if (q.answerKey && q.answerKey.toLowerCase().includes(qLower)) return true;
      if (q.choices) {
        for (const key of Object.keys(q.choices)) {
          const choiceText = (q.choices[key]?.text || "").replace(/<[^>]*>/g, " ").toLowerCase();
          if (choiceText.includes(qLower)) return true;
        }
      }
      return false;
    });
  }, [questions, typeFilter, groupFilter, searchQuery]);

  const inspectedQuestion = useMemo(() => {
    if (inspectedQuestionId) {
      const found = questions.find(q => q.id === inspectedQuestionId);
      if (found) return found;
    }
    return displayQuestions[0] || questions[0] || null;
  }, [questions, inspectedQuestionId, displayQuestions]);

  const targetQuestionsList = useMemo(() => {
    return displayQuestions.length > 0 ? displayQuestions : questions;
  }, [displayQuestions, questions]);

  const currentInspectedIndex = useMemo(() => {
    if (!inspectedQuestion) return -1;
    return targetQuestionsList.findIndex(q => q.id === inspectedQuestion.id);
  }, [inspectedQuestion, targetQuestionsList]);

  const hasPreviousQuestion = currentInspectedIndex > 0;
  const hasNextQuestion = currentInspectedIndex >= 0 && currentInspectedIndex < targetQuestionsList.length - 1;

  const handlePreviousQuestion = useCallback(() => {
    if (currentInspectedIndex > 0) {
      setInspectedQuestionId(targetQuestionsList[currentInspectedIndex - 1].id);
    }
  }, [currentInspectedIndex, targetQuestionsList]);

  const handleNextQuestion = useCallback(() => {
    if (currentInspectedIndex >= 0 && currentInspectedIndex < targetQuestionsList.length - 1) {
      setInspectedQuestionId(targetQuestionsList[currentInspectedIndex + 1].id);
    }
  }, [currentInspectedIndex, targetQuestionsList]);

  // Keyboard navigation for inspector (Left/Right arrows when not typing in inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showInspector || !inspectedQuestion) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "ArrowLeft" && hasPreviousQuestion) {
        e.preventDefault();
        handlePreviousQuestion();
      } else if (e.key === "ArrowRight" && hasNextQuestion) {
        e.preventDefault();
        handleNextQuestion();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showInspector, inspectedQuestion, hasPreviousQuestion, hasNextQuestion, handlePreviousQuestion, handleNextQuestion]);

  const handleBatchImportQuestions = async (questionsToImport: Partial<QuestionData>[]) => {
    const targetId = examId || (exam && exam.id);
    if (!targetId || !pb || questionsToImport.length === 0) return;

    setIsImporting(true);
    try {
      setBatchProgress({
        isOpen: true,
        total: questionsToImport.length,
        current: 0,
        message: "Menyiapkan penyimpan soal...",
        title: "Impor Butir Soal"
      });

      const typeMap: Record<string, string> = {
        pilihan_ganda: "multiple_choice",
        pilihan_ganda_kompleks: "complex_choice",
        menjodohkan: "matching",
        benar_salah: "true_false",
        isian_singkat: "short_answer",
        uraian: "essay",
        urutkan: "sequence",
        drag_drop: "drag_drop",
        klasifikasi: "klasifikasi",
        hotspot: "hotspot",
        isian_rumpang: "isian_rumpang",
        matriks: "matriks"
      };

      const chunkSize = 10;
      for (let i = 0; i < questionsToImport.length; i += chunkSize) {
        const chunk = questionsToImport.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map((q, index) => {
            const qType = q.type || "pilihan_ganda";
            const fieldType = typeMap[qType] || "multiple_choice";

            let optionsToSave: any = {};
            let correctAnswer = q.answerKey || "";

            if ((qType === "benar_salah" || (qType as any) === "true_false") && q.statements && q.statements.length > 0) {
              optionsToSave = { statements: q.statements };
              if (!correctAnswer) {
                correctAnswer = q.statements.map((s: any) => `${s.id}:${s.answer || "benar"}`).join(",");
              }
            } else if (qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks" || qType === "benar_salah") {
              optionsToSave = q.choices || {};
              if (!correctAnswer && q.choices) {
                correctAnswer = Object.entries(q.choices)
                  .filter(([_, v]) => (v as any)?.isCorrect)
                  .map(([k]) => k)
                  .join(",");
              }
            } else if (qType === "menjodohkan") {
              optionsToSave = { pairs: q.pairs || [] };
            } else if (qType === "urutkan" || qType === "drag_drop") {
              optionsToSave = { items: q.items || [] };
            } else if (qType === "klasifikasi") {
              optionsToSave = {
                categories: q.categories || [],
                statements: q.statements || [],
                shuffleStatements: q.shuffleStatements !== false
              };
              if (!correctAnswer && q.statements) {
                correctAnswer = q.statements.map((s: any) => `${s.id}:${s.answer}`).join(",");
              }
            } else if (qType === "matriks") {
              optionsToSave = {
                columns: q.columns || [],
                statements: q.statements || []
              };
              if (!correctAnswer && q.statements) {
                correctAnswer = q.statements.map((s: any) => `${s.id}:${s.answer}`).join(",");
              }
            } else if (qType === "isian_rumpang") {
              optionsToSave = {
                text: q.text,
                blanks: q.blanks || []
              };
              if (!correctAnswer && q.blanks) {
                correctAnswer = q.blanks.map((b: any) => `${b.id}:${(b.answers || []).join("|")}`).join(";");
              }
            }

            let qText = q.text || "";
            if (q.imageUrl && !qText.includes(q.imageUrl)) {
              qText = `<p><img src="${q.imageUrl}" alt="Gambar Soal" style="max-height:320px;max-width:100%;border-radius:16px;margin-bottom:12px;" /></p>` + qText;
            }

            const payload = {
              examId: targetId,
              examid: targetId,
              type: qType,
              field: fieldType,
              text: qText,
              imageUrl: q.imageUrl || "",
              groupId: q.groupId || "",
              group_id: q.groupId || "",
              groupText: q.groupText || "",
              group_text: q.groupText || "",
              options: optionsToSave,
              choices: optionsToSave,
              pairs: q.pairs || [],
              items: q.items || [],
              categories: q.categories || [],
              columns: q.columns || [],
              blanks: q.blanks || [],
              answerKey: correctAnswer,
              answer: correctAnswer,
              correctAnswer: correctAnswer,
              correct_answer: correctAnswer,
              order: (questions.length || 0) + i + index + 1
            };
            return pb.collection("questions").create(payload);
          })
        );

        const currentProcessed = Math.min(i + chunkSize, questionsToImport.length);
        setBatchProgress(prev => ({
          ...prev,
          current: currentProcessed,
          message: `Menyimpan soal (${currentProcessed}/${questionsToImport.length})`
        }));
      }

      await loadQuestions();
      showAlert("Berhasil", `${questionsToImport.length} butir soal berhasil diimpor!`, "success");
    } catch (err) {
      console.error("Batch import error:", err);
      showAlert("Gagal", "Gagal menyimpan beberapa butir soal.", "danger");
    } finally {
      setIsImporting(false);
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

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

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionData | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

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
  const [galleryTarget, setGalleryTarget] = useState<{
    type: "cover" | "choice" | "batch" | "quill" | "hotspot";
    letter?: string;
    index?: number;
    quillInstance?: any;
    quillIndex?: number;
    field?: "text" | "groupText" | "choice";
  } | null>(null);

  // AI Import State
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
          } catch (e) { }
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
      } catch (e) { }
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

    if (galleryTarget.type === "batch" && galleryTarget.index !== undefined) {
      const currentItem = batchQuestions[galleryTarget.index];
      if (currentItem) {
        const updatedText = insertImageIntoQuestionText(currentItem.text, url);
        updateBatchItem(galleryTarget.index, "text", updatedText);
        updateBatchItem(galleryTarget.index, "imageUrl", "");
        updateBatchItem(galleryTarget.index, "imageFile", null);
      }
    }

    setIsGalleryOpen(false);
  };
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const globalFileInputRef = useRef<HTMLInputElement>(null);

  const handleGlobalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showAlert("Gagal", "Ukuran file gambar maksimal adalah 10MB.", "danger");
      return;
    }

    let fileToUpload = file;
    fileToUpload = await compressImage(file);

    if (galleryTarget && galleryTarget.type === "batch" && galleryTarget.index !== undefined) {
      updateBatchItem(galleryTarget.index, "imageFile", fileToUpload);
      updateBatchItem(galleryTarget.index, "imageUrl", "");
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
    return () => { };
  }, []);

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const isSavingQuestionRef = useRef(false);
  const isDuplicatingRef = useRef(false);
  const isDeletingRef = useRef(false);
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

  // AI States
  const [isAIChatDrawerOpen, setIsAIChatDrawerOpen] = useState(false);
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
  const [aiTaxonomy, setAiTaxonomy] = useState<string[]>(["C1", "C2", "C3", "C4", "C5", "C6"]); // multi-select C1-C6
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

  // Auto-generate Tujuan Pembelajaran berdasarkan topik + taksonomi (per-level C)
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

  // Auto-generate Topik dari AI berdasarkan jenjang + mapel + materi
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
          categories: q.categories || (qType === "klasifikasi" ? [] : undefined),
          statements: q.statements || (qType === "klasifikasi" || qType === "matriks" || qType === "benar_salah" ? [] : undefined),
          columns: q.columns || (qType === "matriks" ? [] : undefined),
          blanks: q.blanks || (qType === "isian_rumpang" ? [] : undefined),
          shuffleStatements: q.shuffleStatements,
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
          showAlert("Limit Harian Tercapai", `Kuota token harian habis.\n\n Limit: ${Number(limit).toLocaleString()} token/hari\n Terpakai: ${Number(used).toLocaleString()} token\n Sisa: ${Number(remaining).toLocaleString()} token\n Diminta: ${Number(requested).toLocaleString()} token\n\nSilakan tunggu reset harian atau upgrade plan Groq.`, "danger");
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
        type: regenerated.type || q.type,
        choices: choicesBatch,
        correctKey: correctKey,
        answerKey: regenerated.answerKey || "",
        pairs: regenerated.pairs || q.pairs,
        items: regenerated.items || q.items,
        categories: regenerated.categories || q.categories,
        statements: regenerated.statements || q.statements,
        columns: regenerated.columns || q.columns,
        blanks: regenerated.blanks || q.blanks,
        shuffleStatements: regenerated.shuffleStatements !== undefined ? regenerated.shuffleStatements : q.shuffleStatements,
        isFromAI: true
      };

      const updatedBatch = [...batchQuestions];
      updatedBatch[index] = updatedRow;
      setBatchQuestions(updatedBatch);
      addToast({
        type: "success",
        title: "Soal Diperbarui",
        description: `Soal #${index + 1} berhasil ditampilkan ulang.`,
        duration: 3000
      });
    } catch (err: any) {
      console.error("AI Single Regenerate Error:", err);
      if (err.message?.startsWith("AI_RATE_LIMIT")) {
        const parts = err.message.split("|");
        if (parts.length >= 5) {
          const [, limit, used, remaining, requested] = parts;
          showAlert("Limit Harian Tercapai", `Kuota token harian habis.\n Limit: ${Number(limit).toLocaleString()} token/hari\n Terpakai: ${Number(used).toLocaleString()}\n Sisa: ${Number(remaining).toLocaleString()}\n Diminta: ${Number(requested).toLocaleString()}\n\nTunggu reset harian atau upgrade plan.`, "danger");
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

        // Handle concatenated arrays: ][ merge into single array
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
            statements: q.statements || (q.options?.statements ? q.options.statements : undefined),
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
        drag_drop: "drag_drop",
        klasifikasi: "klasifikasi",
        hotspot: "hotspot",
        isian_rumpang: "isian_rumpang",
        matriks: "matriks"
      };

      setBatchProgress({
        isOpen: true,
        total: parsedResults.length,
        current: 0,
        message: "Menyiapkan penyimpanan soal AI...",
        title: "Simpan Soal AI"
      });

      let count = 0;
      // Ambil order tertinggi dari database (bukan state) agar akurat
      const dbQuestions = await pb.collection('questions').getFullList({ filter: `examId = "${examId}"`, fields: 'order' });
      const maxOrder = dbQuestions.reduce((max, q) => Math.max(max, q.order || 0), 0);

      // Build all payloads with localized images
      const payloads = [];
      for (let idx = 0; idx < parsedResults.length; idx++) {
        const q = parsedResults[idx];
        const type = q.type || "pilihan_ganda";
        const field = typeMap[type] || "multiple_choice";

        // Localize inline images
        let localizedQText = await localizeInlineImages(q.text || "Pertanyaan Tanpa Judul");
        const qImageUrl = q.imageUrl || q.image_url || "";
        if (qImageUrl && !localizedQText.includes(qImageUrl)) {
          const localizedImg = await localizeImage(qImageUrl, `ai_q_${idx}`);
          if (localizedImg) {
            localizedQText = `<p><img src="${localizedImg}" alt="Gambar Soal" style="max-height:320px;max-width:100%;border-radius:16px;margin-bottom:12px;" /></p>` + localizedQText;
          }
        }
        const rawGroupText = q.groupText || q.group_text || "";
        const localizedGroupText = rawGroupText ? await localizeInlineImages(rawGroupText) : "";

        // Localize options
        let options: any = {};
        if (type === "benar_salah" && q.statements && Array.isArray(q.statements) && q.statements.length > 0) {
          const validStatements = await Promise.all(q.statements.map(async (st: any) => ({
            id: String(st.id || Math.random()),
            text: await localizeInlineImages(st.text || ""),
            answer: (st.answer || "benar").toLowerCase() === "salah" ? "salah" : "benar"
          })));
          options = { statements: validStatements };
        } else if (type === "pilihan_ganda" || type === "pilihan_ganda_kompleks" || type === "benar_salah") {
          const rawChoices = q.choices || {};
          const opts: any = {};
          const keys = Object.keys(rawChoices);
          for (let kIdx = 0; kIdx < keys.length; kIdx++) {
            const k = keys[kIdx];
            const val = rawChoices[k];
            const choiceImg = val.imageUrl || val.image_url || "";
            const localizedChoiceImg = choiceImg ? await localizeImage(choiceImg, `ai_opt_${idx}_${k}`) : undefined;
            opts[k] = {
              text: val.text ? await localizeInlineImages(val.text) : "",
              imageUrl: localizedChoiceImg,
              isCorrect: !!val.isCorrect
            };
          }
          options = opts;
        } else if (type === "menjodohkan") {
          const pairs = q.pairs || [];
          const localizedPairs = [];
          for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
            const p = pairs[pIdx];
            localizedPairs.push({
              ...p,
              left: await localizeInlineImages(p.left || ""),
              right: await localizeInlineImages(p.right || "")
            });
          }
          options = { pairs: localizedPairs };
        } else if (type === "urutkan" || type === "drag_drop") {
          const items = q.items || [];
          const localizedItems = [];
          for (let itIdx = 0; itIdx < items.length; itIdx++) {
            const it = items[itIdx];
            const itemImg = it.imageUrl || it.image_url || "";
            const localizedItemImg = itemImg ? await localizeImage(itemImg, `ai_item_${idx}_${itIdx}`) : undefined;
            localizedItems.push({
              ...it,
              text: await localizeInlineImages(it.text || ""),
              imageUrl: localizedItemImg
            });
          }
          options = { items: localizedItems };
        } else if (type === "klasifikasi") {
          options = {
            categories: q.categories || (q.options?.categories ? q.options.categories : []),
            statements: q.statements || (q.options?.statements ? q.options.statements : []),
            shuffleStatements: q.shuffleStatements !== undefined ? q.shuffleStatements : true
          };
        } else if (type === "matriks") {
          options = {
            columns: q.columns || (q.options?.columns ? q.options.columns : []),
            statements: q.statements || (q.options?.statements ? q.options.statements : [])
          };
        } else if (type === "isian_rumpang") {
          options = {
            text: q.text,
            blanks: q.blanks || (q.options?.blanks ? q.options.blanks : [])
          };
        }

        let correctAnswer = "";
        if (type === "benar_salah" && options?.statements && Array.isArray(options.statements)) {
          correctAnswer = options.statements.map((s: any) => `${s.id}:${s.answer}`).join(",");
        } else if (type === "pilihan_ganda" || type === "pilihan_ganda_kompleks" || type === "benar_salah") {
          correctAnswer = q.correctAnswer || q.answerKey || "";
          if (!correctAnswer && options) {
            const correctKeys = Object.keys(options).filter(k => options[k].isCorrect);
            correctAnswer = correctKeys.join(",");
          }
        } else if (type === "isian_singkat" || type === "uraian") {
          correctAnswer = q.answerKey || "";
        }

        // Localize main question imageUrl
        const localizedQImageUrl = qImageUrl ? await localizeImage(qImageUrl, `ai_q_${idx}`) : "";

        const createPayload: any = {
          examId,
          type,
          text: localizedQText,
          field,
          options,
          correctAnswer,
          imageUrl: localizedQImageUrl,
          order: maxOrder + idx + 1
        };
        if (q.groupId) { createPayload.groupId = q.groupId; createPayload.group_id = q.groupId; }
        if (q.groupText) { createPayload.groupText = localizedGroupText; createPayload.group_text = localizedGroupText; }

        payloads.push(createPayload);
      }

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

      // NEW SYSTEM: Populate Batch Modal for Review instead of saving directly
      const questionsForReview = generated.map(q => {
        const choicesBatch: Record<string, { text: string }> = {};
        let correctKey = (q.answerKey || "").toLowerCase();

        if (q.choices) {
          const foundKeys: string[] = [];
          if (Array.isArray(q.choices)) {
            q.choices.forEach((c: any, i: number) => {
              const key = String.fromCharCode(97 + i);
              choicesBatch[key] = { text: typeof c === 'object' ? (c.text || String(c)) : String(c) };
              if (typeof c === 'object' && c.isCorrect) foundKeys.push(key);
            });
          } else {
            Object.keys(q.choices).forEach(key => {
              const lowerKey = key.toLowerCase();
              const val = (q.choices as any)[key];
              choicesBatch[lowerKey] = { text: typeof val === 'object' ? (val.text || String(val)) : String(val) };
              if (typeof val === 'object' && val.isCorrect) foundKeys.push(lowerKey);
            });
          }
          if (foundKeys.length > 0) {
            correctKey = foundKeys.join(",");
          }
        }

        return {
          text: q.text,
          type: q.type || aiType,
          choices: choicesBatch,
          correctKey: correctKey,
          answerKey: q.answerKey || "",
          pairs: q.pairs || (q.type === "menjodohkan" ? [] : undefined),
          items: q.items || (q.type === "urutkan" || q.type === "drag_drop" ? [] : undefined),
          categories: q.categories || (q.type === "klasifikasi" ? [] : undefined),
          statements: q.statements || (q.type === "klasifikasi" || q.type === "matriks" || q.type === "benar_salah" ? [] : undefined),
          columns: q.columns || (q.type === "matriks" ? [] : undefined),
          blanks: q.blanks || (q.type === "isian_rumpang" ? [] : undefined),
          shuffleStatements: q.shuffleStatements,
          groupId: q.groupId || "",
          groupText: q.groupText || "",
          isFromAI: true,
          imageUrl: q.imageUrl || ""
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
          showAlert("Limit Harian Tercapai", `Kuota token harian habis.\n Limit: ${Number(limit).toLocaleString()} token/hari\n Terpakai: ${Number(used).toLocaleString()}\n Sisa: ${Number(remaining).toLocaleString()}\n Diminta: ${Number(requested).toLocaleString()}\n\nTunggu reset harian atau upgrade plan.`, "danger");
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

  const handleApplyAIChatQuestions = (generated: any[]) => {
    const questionsForReview = generated.map(q => {
      const qType = q.type || "pilihan_ganda";
      const choicesBatch: Record<string, { text: string }> = {};
      let correctKey = (q.answerKey || "").toLowerCase();

      if (q.choices) {
        const foundKeys: string[] = [];
        if (Array.isArray(q.choices)) {
          q.choices.forEach((c: any, i: number) => {
            const key = String.fromCharCode(97 + i);
            choicesBatch[key] = { text: typeof c === 'object' ? (c.text || String(c)) : String(c) };
            if (typeof c === 'object' && c.isCorrect) foundKeys.push(key);
          });
        } else {
          Object.keys(q.choices).forEach(key => {
            const lowerKey = key.toLowerCase();
            const val = (q.choices as any)[key];
            choicesBatch[lowerKey] = { text: typeof val === 'object' ? (val.text || String(val)) : String(val) };
            if (typeof val === 'object' && val.isCorrect) foundKeys.push(lowerKey);
          });
        }
        if (foundKeys.length > 0) {
          correctKey = foundKeys.join(",");
        }
      }

      return {
        text: q.text,
        type: qType,
        choices: choicesBatch,
        correctKey: correctKey,
        answerKey: q.answerKey || "",
        pairs: q.pairs || (qType === "menjodohkan" ? [] : undefined),
        items: q.items || (qType === "urutkan" || qType === "drag_drop" ? [] : undefined),
        categories: q.categories || (qType === "klasifikasi" ? [] : undefined),
        statements: q.statements || (qType === "klasifikasi" || qType === "matriks" || qType === "benar_salah" ? [] : undefined),
        columns: q.columns || (qType === "matriks" ? [] : undefined),
        blanks: q.blanks || (qType === "isian_rumpang" ? [] : undefined),
        shuffleStatements: q.shuffleStatements,
        groupId: q.groupId || "",
        groupText: q.groupText || "",
        isFromAI: true,
        imageUrl: q.imageUrl || ""
      };
    });

    setBatchQuestions(questionsForReview);
    setIsBatchModalOpen(true);
    addToast({
      type: "success",
      title: "Soal Siap Ditinjau",
      description: `${generated.length} butir soal dari Asisten AI telah masuk ke peninjauan.`
    });
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
    const cleanVal = sanitizeChoiceText(value);
    setBatchQuestions(prev => {
      const updated = [...prev];
      const choices = { ...updated[index].choices };
      choices[letter] = { ...choices[letter], text: cleanVal };
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
      if (qType === "klasifikasi" || qType === "matriks" || qType === "isian_rumpang") return false;
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
      drag_drop: "drag_drop",
      klasifikasi: "klasifikasi",
      hotspot: "hotspot",
      isian_rumpang: "isian_rumpang",
      matriks: "matriks"
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
      // Get the actual max order from database to avoid conflicts
      const existingQuestions = await pb.collection('questions').getFullList({
        filter: `examId = "${examId}"`,
        fields: 'order',
        sort: '-order',
      });
      let currentOrder = (existingQuestions.length > 0 ? Math.max(...existingQuestions.map(q => q.order || 0)) : 0) + 1;
      let count = 0;

      for (const q of validQuestions) {
        let imageUrl = q.imageUrl || "";
        if (q.imageFile) {
          try {
            const fileToUpload = await compressImage(q.imageFile);
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
        } else if (qType === "klasifikasi") {
          optionsToSave = {
            categories: q.categories || [],
            statements: q.statements || [],
            shuffleStatements: q.shuffleStatements ?? true
          };
          correctAnswer = "";
        } else if (qType === "matriks") {
          optionsToSave = {
            columns: q.columns || [],
            statements: q.statements || []
          };
          correctAnswer = "";
        } else if (qType === "isian_rumpang") {
          optionsToSave = {
            text: q.text,
            blanks: q.blanks || []
          };
          correctAnswer = "";
        }

        const payload: any = {
          examId,
          text: await uploadInlineBase64Images(q.isFromAI ? q.text : `<p>${q.text}</p>`),
          type: qType,
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

    // Deteksi field target berdasarkan placeholder
    let field: "text" | "groupText" | "choice" = "text";
    let letter: string | undefined = undefined;

    const placeholder = (quill.root?.getAttribute("data-placeholder") || "").toLowerCase();
    if (placeholder.includes("stimulus") || placeholder.includes("literasi")) {
      field = "groupText";
    } else if (placeholder.includes("jawaban opsi")) {
      field = "choice";
      const match = placeholder.match(/jawaban opsi ([a-z])/i);
      if (match) letter = match[1].toLowerCase();
    } else {
      field = "text";
    }

    setGalleryTarget({
      type: "quill",
      quillInstance: quill,
      quillIndex: cursorIndex,
      field,
      letter
    });
    setIsPickerOpen(true);
  }, []);

  // ── Visual Equation Studio State & Handlers ──
  const [equationTarget, setEquationTarget] = useState<{
    quillInstance: any;
    quillIndex: number;
    selectionLength?: number;
  } | null>(null);
  const [isEquationModalOpen, setIsEquationModalOpen] = useState(false);
  const [initialEquationLatex, setInitialEquationLatex] = useState("");

  const formulaHandler = useCallback(function (this: any) {
    const quill = this.quill;
    const range = quill.getSelection();
    const cursorIndex = range ? range.index : quill.getLength();
    const selectionLength = range ? range.length : 0;

    let selectedText = "";
    if (range && range.length > 0) {
      selectedText = quill.getText(range.index, range.length).trim();
      selectedText = selectedText.replace(/^\$\$?/, "").replace(/\$\$?$/, "").trim();
    }

    setEquationTarget({
      quillInstance: quill,
      quillIndex: cursorIndex,
      selectionLength,
    });
    setInitialEquationLatex(selectedText);
    setIsEquationModalOpen(true);
  }, []);

  const handleInsertEquation = useCallback((latex: string, isBlock: boolean) => {
    if (!equationTarget?.quillInstance) return;
    const quill = equationTarget.quillInstance;
    const index = equationTarget.quillIndex;
    const selectionLength = equationTarget.selectionLength || 0;

    if (selectionLength > 0) {
      quill.deleteText(index, selectionLength, "user");
    }

    const wrapped = isBlock ? `\n$$ ${latex} $$\n` : `$ ${latex} $ `;
    quill.insertText(index, wrapped, "user");
    quill.setSelection(index + wrapped.length, 0);

    setIsEquationModalOpen(false);
    setEquationTarget(null);
  }, [equationTarget]);

  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'align': [] }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
        ['image', 'formula', 'code-block', 'clean']
      ],
      handlers: {
        image: imageHandler,
        formula: formulaHandler
      }
    },
    clipboard: {
      matchers: [
        ['table', function (_node: any, _delta: any) {
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
        [Node.ELEMENT_NODE, function (_node: any, delta: any) {
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
          handler: function (this: any, range: any) {
            // Insert non-breaking spaces (preserved by Quill on save/reload)
            this.quill.insertText(range.index, '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.quill.setSelection(range.index + 8);
            return false;
          }
        },
        shiftTab: {
          key: 9,
          shiftKey: true,
          handler: function (this: any, range: any) {
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
  }), [imageHandler, formulaHandler]);

  const quillModulesChoice = useMemo(() => ({
    toolbar: {
      container: [
        ['bold'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['formula', 'image', 'clean']
      ],
      handlers: {
        image: imageHandler,
        formula: formulaHandler
      }
    },
    clipboard: {
      matchers: [
        ['table', function (_node: any, _delta: any) {
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
        [Node.ELEMENT_NODE, function (node: any, delta: any) {
          return cleanDeltaForChoice(delta, node);
        }]
      ]
    },
    keyboard: {
      bindings: {
        tab: {
          key: 9,
          handler: function (this: any, range: any) {
            this.quill.insertText(range.index, ' ');
            this.quill.setSelection(range.index + 1);
            return false;
          }
        },
        shiftTab: {
          key: 9,
          shiftKey: true,
          handler: function (this: any, range: any) {
            const text = this.quill.getText(Math.max(0, range.index - 1), 1);
            if (text === ' ' || text === '\u00A0') {
              this.quill.deleteText(range.index - 1, 1);
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
  }), [imageHandler, formulaHandler]);




  //Load Questions dari PocketBase
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
          choices: (mappedType === "pilihan_ganda" || mappedType === "pilihan_ganda_kompleks")
            ? options : (mappedType === "benar_salah" && !options.statements ? options : undefined),
          pairs: mappedType === "menjodohkan" ? options.pairs : undefined,
          items: (mappedType === "urutkan" || mappedType === "drag_drop") ? options.items : undefined,
          statements: mappedType === "benar_salah" ? (options.statements || q.statements || (Array.isArray(options) ? options : undefined)) : undefined,
          options: options,
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
      if (examId) {
        const prev = questionsPageCache.get(examId);
        questionsPageCache.set(examId, {
          exam: prev?.exam || null,
          questions: grouped as any,
          timestamp: Date.now()
        });
      }
    } catch (e) {
      if (!questionsPageCache.has(examId)) {
        setQuestions([]);
      }
    } finally {
      setLoading(false);
    }
  }, [examId, pb]);

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
        // Dynamic Loader for PDF.js to avoid npm install wait if possible
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

        const examObj = {
          ...examData,
          subject: subjectObj ? subjectObj.name : "",
          teacherName: teacherObj ? teacherObj.name : "",
          teacherCode: teacherObj ? teacherObj.code || "" : ""
        };
        setExam(examObj);
        if (examId) {
          const entry = questionsPageCache.get(examId);
          if (entry) entry.exam = examObj;
        }

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
  }, [examId, pb, loadQuestions]);

  const currentTeacher = useMemo(() => {
    if (!teachers || teachers.length === 0) return null;
    return teachers.find((t: any) => t.id === teacherId || t.id === user?.id || (user?.email && t.email === user.email));
  }, [teachers, teacherId, user]);

  const mySubjectIds = useMemo(() => {
    const set = new Set<string>();
    if (currentTeacher?.subjects && Array.isArray(currentTeacher.subjects)) {
      currentTeacher.subjects.forEach((s: string) => {
        if (!s) return;
        const sTrim = String(s).trim();
        set.add(sTrim);
        const matched = subjects.find(
          (sub: any) => sub.id === sTrim || (sub.name && sub.name.toLowerCase() === sTrim.toLowerCase())
        );
        if (matched) {
          set.add(matched.id);
          if (matched.name) set.add(matched.name.toLowerCase());
        }
      });
    }
    return Array.from(set);
  }, [currentTeacher, subjects]);

  // Apakah bank soal ini benar-benar dibuat oleh guru login saat ini
  const isRealOwner = useMemo(() => {
    if (!exam || (!teacherId && !user?.id)) return false;
    const examTeacherId = exam.teacherId || exam.teacherid;
    return examTeacherId === teacherId || examTeacherId === user?.id;
  }, [exam, teacherId, user]);

  // Hak akses mengelola/mengedit
  const isOwner = useMemo(() => {
    if (role === "admin") return true;
    if (teacherFullAccess) return true;
    return isRealOwner;
  }, [role, teacherFullAccess, isRealOwner]);

  const isMgmpExam = useMemo(() => {
    if (!exam || !exam.subjectId || isRealOwner || role === "admin") return false;
    const subName = (exam.subjectName || exam.subject || subjects.find((s: any) => s.id === exam.subjectId)?.name || "").toLowerCase();
    return mySubjectIds.includes(exam.subjectId) || (Boolean(subName) && mySubjectIds.includes(subName));
  }, [exam, isRealOwner, role, mySubjectIds, subjects]);

  const canEdit = useMemo(() => {
    if (isOwner) return true;
    if (Boolean(exam?.is_mgmp_shared) && isMgmpExam) return true;
    return false;
  }, [isOwner, exam?.is_mgmp_shared, isMgmpExam]);

  const [isDuplicatingExam, setIsDuplicatingExam] = useState(false);

  const handleDuplicateCurrentExam = async () => {
    if (!exam || !pb || isDuplicatingRef.current) return;
    const isMine = isOwner;
    const targetTitle = isMine ? `(Salinan) ${exam.title}` : `${exam.title} (Salinan Saya)`;

    showAlert(
      isMine ? "Duplikat Bank Soal" : "Salin ke Bank Soal Saya",
      isMine
        ? `Apakah Anda yakin ingin menduplikasi bank soal "${exam.title}" beserta seluruh (${questions.length}) butir soalnya?`
        : `Salin bank soal "${exam.title}" karya ${exam.teacherName || "rekan guru"} ke koleksi Anda? Anda akan menjadi pemilik penuh salinan ini dan bebas mengedit serta menggunakannya di Ruang Ujian.`,
      "info",
      async () => {
        if (isDuplicatingRef.current) return;
        isDuplicatingRef.current = true;
        try {
          setIsDuplicatingExam(true);
          const newTeacherId = (role !== "admin" && (teacherId || user?.id)) ? (teacherId || user?.id) : exam.teacherId;
          const newExam = await pb.collection('exams').create({
            title: targetTitle,
            subjectId: exam.subjectId,
            teacherId: newTeacherId,
            examType: exam.examType || "Latihan",
            group_name: exam.group_name || "",
            is_mgmp_shared: false,
          });

          const CHUNK_SIZE = 5;
          for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
            const chunk = questions.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map((q) => {
              const { id, created, updated, collectionId, collectionName, ...rest } = q as any;
              return pb.collection('questions').create({
                ...rest,
                examId: newExam.id,
              });
            }));
          }

          addToast({
            type: "success",
            title: "Berhasil Menyalin Bank Soal",
            description: `Bank soal "${targetTitle}" berhasil disalin beserta ${questions.length} butir soal.`
          });

          sessionStorage.setItem("activeQuestionsExamId", newExam.id);
          window.location.href = `/admin/bank-soal/questions`;
        } catch (err: any) {
          showAlert("Gagal", err?.message || "Gagal menyalin bank soal.", "danger");
        } finally {
          isDuplicatingRef.current = false;
          setIsDuplicatingExam(false);
        }
      }
    );
  };

  const handleCreateClick = () => {
    if (examId) sessionStorage.setItem("activeQuestionsExamId", examId);
    navigate("/admin/bank-soal/questions/new");
  };

  const handleEditClick = (q: QuestionData) => {
    const targetExamId = examId || q.examId || (exam && exam.id);
    if (targetExamId) sessionStorage.setItem("activeQuestionsExamId", targetExamId);
    navigate(`/admin/bank-soal/questions/${q.id}/edit`);
  };

  const getQuestionImageUrls = (q: QuestionData): string[] => {
    const urls: string[] = [];

    const addUrl = (url: string) => {
      if (url && !url.startsWith("data:")) urls.push(url);
    };

    if (q.imageUrl) addUrl(q.imageUrl);

    if (q.text && q.text.includes("<img")) {
      const doc = new DOMParser().parseFromString(q.text, "text/html");
      doc.querySelectorAll("img").forEach(img => addUrl(img.getAttribute("src") || ""));
    }

    // Sertakan juga gambar dari stimulus/literasi (groupText)
    const gText = q.groupText || (q as any).group_text;
    if (gText && gText.includes("<img")) {
      const doc = new DOMParser().parseFromString(gText, "text/html");
      doc.querySelectorAll("img").forEach(img => addUrl(img.getAttribute("src") || ""));
    }

    if (q.choices) {
      Object.values(q.choices).forEach((c) => {
        if (c.imageUrl) addUrl(c.imageUrl);
        if (c.text && c.text.includes("<img")) {
          const doc = new DOMParser().parseFromString(c.text, "text/html");
          doc.querySelectorAll("img").forEach(img => addUrl(img.getAttribute("src") || ""));
        }
      });
    }

    return Array.from(new Set(urls));
  };

  const getQuestionImageKeys = (q: QuestionData): string[] => {
    return getQuestionImageUrls(q).map(url => {
      try { return new URL(url).pathname.replace(/^\//, ""); } catch { return ""; }
    }).filter(Boolean);
  };

  const cleanupQuestionImages = async (q: QuestionData) => {
    const urls = getQuestionImageUrls(q);
    if (urls.length > 0 && pb) {
      await safeDeleteImages(urls, pb, q.id);
    }
  };

  const uploadInlineBase64Images = async (html: string): Promise<string> => {
    if (!html || !html.includes("data:image")) return html;

    const isOffline = school?.plan === "offline" || school?.id === "local_server" || (typeof window !== "undefined" && (/^(localhost|127\.|0\.0\.0\.0$|\[::1\])/.test(window.location.hostname) || /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname)));

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

        // 🛑 MODE OFFLINE: Simpan sebagai WebP Data URL terkompresi langsung, jangan sentuh Cloudflare
        if (isOffline) {
          const reader = new FileReader();
          return new Promise<{ base64: string; url: string }>((resolve) => {
            reader.onloadend = () => {
              resolve({ base64: m.base64, url: reader.result as string });
            };
            reader.readAsDataURL(file);
          });
        }

        const schoolFolder = school?.slug || "unknown";
        const uploaded = await uploadInventoryImage(`schools/${schoolFolder}/exams/${examId}`, file);
        return { base64: m.base64, url: uploaded.url };
      } catch (err) {
        console.warn("Gagal upload inline image:", err);
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

  // Helper to localize a single image URL (remote or base64) to our Cloudflare R2 bucket
  const localizeImage = async (url: string, filenamePrefix: string): Promise<string> => {
    if (!url) return "";

    const isOffline = school?.plan === "offline" || school?.id === "local_server" || (typeof window !== "undefined" && (/^(localhost|127\.|0\.0\.0\.0$|\[::1\])/.test(window.location.hostname) || /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname)));
    if (isOffline) {
      return url; // Di mode offline, jangan kontak Cloudflare
    }

    // 1. If base64
    if (url.startsWith("data:image/")) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        let file = new File([blob], `${filenamePrefix}-${Date.now()}.webp`, { type: blob.type });
        // Compress if needed
        if (blob.type !== "image/webp" && blob.size > 30 * 1024) {
          try { file = await compressImage(file); } catch { /* keep original */ }
        }
        const schoolFolder = school?.slug || "unknown";
        const uploaded = await uploadInventoryImage(`schools/${schoolFolder}/exams/${examId}`, file);
        return uploaded.url;
      } catch (err) {
        console.warn("Gagal upload base64 image:", err);
        return url;
      }
    }

    // 2. If external remote URL
    const isRemote = url.startsWith("http") && !url.includes("assets.examku.my.id") && !url.includes("/api/files/");
    if (isRemote) {
      try {
        // Fetch the remote image safely without PocketBase auth headers (to avoid preflight CORS failure)
        const response = await fetch(url);
        if (!response.ok) return url;
        const blob = await response.blob();

        // Determine file extension from content-type or URL
        let ext = "png";
        if (blob.type === "image/jpeg") ext = "jpg";
        else if (blob.type === "image/webp") ext = "webp";
        else if (blob.type === "image/gif") ext = "gif";

        let file = new File([blob], `${filenamePrefix}-${Date.now()}.${ext}`, { type: blob.type });
        if (blob.type !== "image/webp" && blob.size > 30 * 1024) {
          try { file = await compressImage(file); } catch { /* keep original */ }
        }

        const schoolFolder = school?.slug || "unknown";
        const uploaded = await uploadInventoryImage(`schools/${schoolFolder}/exams/${examId}`, file);
        return uploaded.url;
      } catch (err) {
        console.warn("Gagal localize remote image:", url, err);
        return url;
      }
    }

    return url;
  };

  // Helper to localize all remote image URLs inside HTML content
  const localizeInlineImages = async (html: string): Promise<string> => {
    if (!html) return html;

    const isOffline = school?.plan === "offline" || school?.id === "local_server" || (typeof window !== "undefined" && (/^(localhost|127\.|0\.0\.0\.0$|\[::1\])/.test(window.location.hostname) || /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname)));
    if (isOffline) {
      return html; // Di mode offline, jangan kontak Cloudflare
    }

    // Find all <img src="..."> tags
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
    let result = html;
    let match;
    const matches: { full: string; src: string }[] = [];

    while ((match = imgRegex.exec(html)) !== null) {
      matches.push({ full: match[0], src: match[1] });
    }

    if (matches.length === 0) return html;

    // Localize each image URL in parallel
    const localized = await Promise.allSettled(matches.map(async (m, idx) => {
      const newUrl = await localizeImage(m.src, `inline-imported-${idx}`);
      return { src: m.src, newUrl };
    }));

    for (const r of localized) {
      if (r.status === "fulfilled" && r.value) {
        result = result.split(r.value.src).join(r.value.newUrl);
      }
    }

    return result;
  };



  const handleDeleteClick = (q: QuestionData) => {
    setQuestionToDelete(q);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!questionToDelete || !pb || isDeletingRef.current) return;
    isDeletingRef.current = true;
    setIsDeleting(true);
    try {
      // Hapus gambar di R2 (Non-blocking: jika gagal tetap hapus record DB)
      try {
        await cleanupQuestionImages(questionToDelete);
      } catch (storageError) {
        console.warn("Gagal membersihkan gambar dari R2 Storage. Ini mungkin karena masalah CORS setelah ganti domain.", storageError);
      }

      // Jika soal ini adalah "MAIN" literasi (punya groupText), transfer ke soal berikutnya dalam grup
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
      isDeletingRef.current = false;
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // Hapus Paket Literasi (hapus groupId & groupText dari semua soal dalam grup) 
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

  //  Rename Paket Literasi (update groupId di semua soal dalam grup) 
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

      // 1. Gather all image URLs across all questions
      const allUrls: string[] = [];
      allQ.forEach(q => {
        allUrls.push(...getQuestionImageUrls(q as any));
      });
      const uniqueUrls = Array.from(new Set(allUrls));

      // 2. Batch Safe Delete Images (cek referensi dulu)
      setBatchProgress(prev => ({ ...prev, message: `Menghapus ${uniqueUrls.length} gambar dari storage...` }));
      if (uniqueUrls.length > 0 && pb) {
        try {
          // Semua soal di exam ini dihapus, jadi cukup cek apakah URL masih dipakai di exam LAIN
          await Promise.allSettled(uniqueUrls.map(async url => {
            try {
              const escapedUrl = url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
              const examFilter = `examId != "${examId}"`;

              let isUsedElsewhere = false;
              try {
                const refByImageUrl = await pb.collection("questions").getList(1, 1, {
                  filter: `imageUrl = "${escapedUrl}" && ${examFilter}`,
                });
                if (refByImageUrl.totalItems > 0) isUsedElsewhere = true;
              } catch {
                isUsedElsewhere = true; // fail-safe: jika gagal query, jangan hapus
              }

              if (!isUsedElsewhere) {
                try {
                  const refByText = await pb.collection("questions").getList(1, 1, {
                    filter: `(text ~ "${escapedUrl}" || options ~ "${escapedUrl}" || groupText ~ "${escapedUrl}" || group_text ~ "${escapedUrl}") && ${examFilter}`,
                  });
                  if (refByText.totalItems > 0) isUsedElsewhere = true;
                } catch {
                  try {
                    const fallbackRef = await pb.collection("questions").getList(1, 1, {
                      filter: `(text ~ "${escapedUrl}" || options ~ "${escapedUrl}") && ${examFilter}`,
                    });
                    if (fallbackRef.totalItems > 0) isUsedElsewhere = true;
                  } catch {
                    isUsedElsewhere = true; // fail-safe
                  }
                }
              }

              if (!isUsedElsewhere) {
                const key = new URL(url).pathname.replace(/^\//, "");
                if (key) await deleteImageFromStorage(key);
              }
            } catch { }
          }));
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

      // Transfer groupText ke soal berikutnya jika "main" literasi dihapus
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

      // 1. Gather URLs
      const allUrls: string[] = [];
      selectedQuestions.forEach(q => allUrls.push(...getQuestionImageUrls(q)));
      const uniqueUrls = Array.from(new Set(allUrls));

      // 2. Safe Delete Images (cek referensi di soal lain dulu)
      setBatchProgress(prev => ({ ...prev, message: "Membersihkan gambar di storage..." }));
      if (uniqueUrls.length > 0 && pb) {
        try {
          const selectedIdSet = new Set(selectedQuestions.map(q => q.id));
          await Promise.allSettled(uniqueUrls.map(async url => {
            try {
              const escapedUrl = url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
              let isUsedElsewhere = false;

              // 1. Cek di imageUrl
              try {
                const checkImg = await pb.collection("questions").getList(1, 20, {
                  filter: `imageUrl = "${escapedUrl}"`,
                });
                if (checkImg.items.some(item => !selectedIdSet.has(item.id)) || checkImg.totalItems > checkImg.items.length) {
                  isUsedElsewhere = true;
                }
              } catch {
                isUsedElsewhere = true; // fail-safe: jika gagal query, jangan hapus
              }

              // 2. Cek di text, options, groupText
              if (!isUsedElsewhere) {
                try {
                  const checkContent = await pb.collection("questions").getList(1, 20, {
                    filter: `text ~ "${escapedUrl}" || options ~ "${escapedUrl}" || groupText ~ "${escapedUrl}" || group_text ~ "${escapedUrl}"`,
                  });
                  if (checkContent.items.some(item => !selectedIdSet.has(item.id)) || checkContent.totalItems > checkContent.items.length) {
                    isUsedElsewhere = true;
                  }
                } catch {
                  try {
                    const fallbackContent = await pb.collection("questions").getList(1, 20, {
                      filter: `text ~ "${escapedUrl}" || options ~ "${escapedUrl}"`,
                    });
                    if (fallbackContent.items.some(item => !selectedIdSet.has(item.id)) || fallbackContent.totalItems > fallbackContent.items.length) {
                      isUsedElsewhere = true;
                    }
                  } catch {
                    isUsedElsewhere = true; // fail-safe
                  }
                }
              }

              if (!isUsedElsewhere) {
                const key = new URL(url).pathname.replace(/^\//, "");
                if (key) await deleteImageFromStorage(key);
              }
            } catch { }
          }));
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

  const renderQuestionDetails = (item: QuestionData, showTypeBadge = true) => {
    const qType = item.type || "pilihan_ganda";
    const meta = QUESTION_TYPE_BADGE[qType] || { variant: "neutral" as const, label: qType };

    const renderKeyAndCount = () => {
      if (qType === "benar_salah") {
        const stList = item.statements || item.options?.statements || [];
        if (stList.length > 0) {
          return (
            <div className="flex flex-col items-start gap-1 min-w-0">
              <div
                className="flex items-center gap-0.5 flex-wrap cursor-help"
                title={stList.map((s: any, idx: number) => `${idx + 1}. ${s.text ? s.text.replace(/<[^>]*>/g, '').trim() : 'Pernyataan'}: ${(s.answer || 'benar').toUpperCase()}`).join("\n")}
              >
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold mr-0.5">Kunci:</span>
                {stList.slice(0, 5).map((s: any, idx: number) => {
                  const isBenar = (s.answer || "benar").toLowerCase() === "benar";
                  return (
                    <span
                      key={s.id || idx}
                      className={cn(
                        "inline-flex items-center justify-center px-1 py-0.2 rounded text-[10px] font-bold font-mono",
                        isBenar
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                      )}
                    >
                      {idx + 1}:{isBenar ? "B" : "S"}
                    </span>
                  );
                })}
                {stList.length > 5 && <span className="text-[9px] text-neutral-400 font-mono">+{stList.length - 5}</span>}
              </div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                {stList.length} Pernyataan
              </span>
            </div>
          );
        }

        const activeKeys = Object.keys(item.choices || {}).filter(k => (item.choices?.[k]?.text && item.choices?.[k]?.text.replace(/<[^>]*>/g, '').trim()) || item.choices?.[k]?.imageUrl);
        const keys = activeKeys.length > 0 ? activeKeys : Object.keys(item.choices || {});
        if (keys.length > 0) {
          const correctKeys = keys.filter(k => item.choices?.[k]?.isCorrect).map(k => k.toUpperCase()).join(", ");
          return (
            <div className="flex flex-col items-start gap-1 min-w-0">
              {correctKeys ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 truncate max-w-full shadow-2xs">
                  Kunci: {correctKeys}
                </span>
              ) : (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Belum ada kunci
                </span>
              )}
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                {keys.length} Opsi
              </span>
            </div>
          );
        }

        return (
          <span className="text-xs text-neutral-400 dark:text-neutral-500 italic">Belum ada pernyataan</span>
        );
      }

      if (qType === "matriks") {
        const cols = item.options?.columns || [];
        const stList = item.options?.statements || [];
        if (stList.length > 0 || cols.length > 0) {
          return (
            <div className="flex flex-col items-start gap-1 min-w-0">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                {stList.length} × {cols.length} Sel
              </span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                Tabel Matriks
              </span>
            </div>
          );
        }
        return <span className="text-xs text-neutral-400 italic">Belum ada matriks</span>;
      }

      if (qType === "klasifikasi") {
        const cats = item.options?.categories || [];
        const stList = item.options?.statements || [];
        if (stList.length > 0 || cats.length > 0) {
          return (
            <div className="flex flex-col items-start gap-1 min-w-0">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                {stList.length} Baris × {cats.length} Kat.
              </span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                Klasifikasi
              </span>
            </div>
          );
        }
        return <span className="text-xs text-neutral-400 italic">Belum ada data</span>;
      }

      if (qType === "isian_rumpang") {
        const blanks = item.options?.blanks || [];
        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              {blanks.length} Isian Rumpang
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
              Teks Rumpang
            </span>
          </div>
        );
      }

      if (qType === "hotspot") {
        const areas = item.options?.areas || [];
        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
              {areas.length} Area Hotspot
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
              Titik Gambar
            </span>
          </div>
        );
      }

      if (qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks") {
        const activeKeys = Object.keys(item.choices || {}).filter(k => (item.choices?.[k]?.text && item.choices?.[k]?.text.replace(/<[^>]*>/g, '').trim()) || item.choices?.[k]?.imageUrl);
        const keys = activeKeys.length > 0 ? activeKeys : Object.keys(item.choices || {});
        const correctKeys = keys.filter(k => item.choices?.[k]?.isCorrect).map(k => k.toUpperCase()).join(", ");

        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            {correctKeys ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 truncate max-w-full shadow-2xs">
                Kunci: {correctKeys}
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Belum ada kunci
              </span>
            )}
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
              {keys.length} Opsi
            </span>
          </div>
        );
      }

      if (qType === "menjodohkan") {
        const pairs = item.pairs || [];
        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
              {pairs.length} Pasangan
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
              Mencocokkan
            </span>
          </div>
        );
      }

      if (qType === "isian_singkat" || qType === "uraian") {
        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 truncate max-w-[130px]" title={item.answerKey || "-"}>
              {item.answerKey ? `Kunci: ${item.answerKey}` : "(Rubrik Esai)"}
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
              {qType === "uraian" ? "Jawaban Uraian" : "Isian Singkat"}
            </span>
          </div>
        );
      }

      if (qType === "urutkan" || qType === "drag_drop") {
        const items = item.items || [];
        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
              {items.length} Tahapan
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
              Urutan Kronologis
            </span>
          </div>
        );
      }

      return null;
    };

    return (
      <div className="flex flex-col items-start gap-1.5 min-w-0">
        {showTypeBadge && (
          <NeonBadge variant={meta.variant} size="xs" className="shrink-0 font-medium">
            {meta.label}
          </NeonBadge>
        )}
        {renderKeyAndCount()}
      </div>
    );
  };

  const neonColumns: NeonTableColumn<QuestionData>[] = useMemo(() => [
    {
      key: "no",
      header: "#",
      width: "36px",
      align: "center",
      className: "w-9 text-center shrink-0",
      headerClassName: "w-9 text-center shrink-0",
      render: (item, index) => {
        const isInspected = inspectedQuestion?.id === item.id;
        return (
          <div className="flex items-center justify-center">
            <span
              className={cn(
                "h-6 min-w-6 px-1.5 rounded-md font-mono text-xs font-bold flex items-center justify-center transition-all",
                isInspected
                  ? "bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.6)] scale-105"
                  : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-800 dark:group-hover:text-neutral-200"
              )}
            >
              {index + 1}
            </span>
          </div>
        );
      }
    },
    {
      key: "text",
      header: "Teks Pertanyaan & Stimulus",
      className: "min-w-0 max-w-full break-words",
      headerClassName: "min-w-0",
      render: (item) => (
        <div className="space-y-1.5 py-0.5 min-w-0 max-w-full overflow-hidden">
          {/* Question Text & Embedded Table/Image Wrapper (Max height capped to prevent giant rows) */}
          <div className="relative max-h-24 sm:max-h-28 overflow-hidden rounded-md group/math">
            <MathText
              content={item.text}
              className="text-xs sm:text-[13px] font-serif text-neutral-900 dark:text-neutral-100 leading-relaxed ql-editor !p-0 [&_p]:m-0 [&_figure]:m-0 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-4 [&_ul]:pl-4 [&_img]:!max-h-20 sm:[&_img]:!max-h-24 [&_img]:!max-w-[140px] sm:[&_img]:!max-w-[180px] [&_img]:!w-auto [&_img]:!h-auto [&_img]:object-contain [&_img]:rounded-md [&_img]:border [&_img]:border-neutral-200/80 [&_img]:dark:border-neutral-800 [&_img]:my-1 [&_img]:block [&_table]:!text-[10px] [&_table]:!leading-tight [&_table]:!my-1 [&_table]:!max-w-full [&_table]:!border-collapse [&_td]:!p-0.5 [&_td]:!px-2 [&_th]:!p-0.5 [&_th]:!px-2 [&_td]:!text-[10px] [&_th]:!text-[10px] [&_td]:!border [&_td]:!border-neutral-200 dark:[&_td]:!border-neutral-750 [&_th]:!border [&_th]:!border-neutral-200 dark:[&_th]:!border-neutral-750 [&_th]:!bg-neutral-50 dark:[&_th]:!bg-neutral-850 [&_.ql-table-embed]:!my-0.5 [&_.ql-table-embed]:!p-0 [&_.ql-table-embed]:!border-none [&_.ql-table-embed]:!bg-transparent shadow-2xs"
            />

          </div>

          {/* Standalone Image Thumbnail (if question has item.imageUrl not embedded in text) */}
          {item.imageUrl && !item.text?.includes("<img") && (
            <img
              src={item.imageUrl}
              alt="Gambar Soal"
              className="max-h-16 sm:max-h-20 max-w-[140px] sm:max-w-[180px] w-auto h-auto object-contain rounded-md border border-neutral-200/80 dark:border-neutral-800 my-1 block shadow-2xs"
            />
          )}

          {/* Badges Metadata Line */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {item.text?.includes("<table") && (
              <NeonBadge variant="neutral" size="xs" icon={FileSpreadsheet}>
                Tabel Data
              </NeonBadge>
            )}
            {(item.imageUrl || item.text.includes("<img")) && (
              <NeonBadge variant="sky" size="xs" icon={Image}>
                Bergambar
              </NeonBadge>
            )}
            {item.groupId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex min-w-0 shrink-0">
                    <NeonBadge
                      variant="amber"
                      size="xs"
                      icon={BookOpen}
                      className="max-w-[180px] xs:max-w-[240px] sm:max-w-[320px] md:max-w-[420px] min-w-0 shrink-0 cursor-pointer hover:bg-amber-500/20 transition-colors"
                    >
                      <span className="truncate min-w-0">Paket: {item.groupId}</span>
                      {questions.findIndex(q => q.groupId === item.groupId) === questions.indexOf(item) && (
                        <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[9px] font-bold shrink-0">
                          Wacana
                        </span>
                      )}
                    </NeonBadge>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-xs space-y-1">
                  <div className="font-bold text-amber-500 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>Paket Stimulus (AKM)</span>
                  </div>
                  <p className="font-mono text-neutral-100 font-semibold break-all">{item.groupId}</p>
                  {item.groupText && (
                    <p className="text-[11px] text-neutral-300 font-serif line-clamp-3 pt-1 border-t border-neutral-700/60 leading-relaxed">
                      {item.groupText.replace(/<[^>]*>/g, '')}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
            {/* Mobile Type Badge */}
            <span className="sm:hidden">
              <NeonBadge
                variant={(QUESTION_TYPE_BADGE[item.type || "pilihan_ganda"]?.variant) || "neutral"}
                size="xs"
              >
                {QUESTION_TYPE_LABELS[item.type || "pilihan_ganda"] || item.type}
              </NeonBadge>
            </span>
          </div>
        </div>
      )
    },
    {
      key: "details",
      header: "Detail",
      width: "145px",
      className: "hidden sm:table-cell w-[145px] shrink-0",
      headerClassName: "hidden sm:table-cell w-[145px] shrink-0",
      render: (item) => renderQuestionDetails(item, true)
    },
    {
      key: "actions",
      header: "Aksi",
      width: "92px",
      overflow: "visible",
      className: "w-[92px] text-right shrink-0 !px-2 overflow-visible",
      headerClassName: "w-[92px] text-right shrink-0 !px-2",
      align: "right",
      render: (item) => {
        const idx = questions.findIndex(q => q.id === item.id);
        return (
          <div className="flex justify-end items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Quick Action: Pratinjau */}
            <button
              type="button"
              className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors shadow-2xs cursor-pointer shrink-0"
              onClick={() => {
                setPreviewIndex(idx >= 0 ? idx : 0);
                setPreviewQuestion(item);
                setIsPreviewOpen(true);
              }}
              title="Pratinjau Soal"
            >
              <Search className="h-3.5 w-3.5" />
            </button>

            {/* Quick Action: Edit (sm+) */}
            {canEdit && (
              <button
                type="button"
                className="hidden sm:flex h-7 w-7 rounded-md items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors shadow-2xs cursor-pointer shrink-0"
                onClick={() => handleEditClick(item)}
                title="Edit Soal"
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Dropdown Menu Seragam */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors shadow-2xs cursor-pointer shrink-0"
                  title="Menu Lainnya"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-[100]">
                <DropdownMenuItem
                  onClick={() => {
                    setPreviewIndex(idx >= 0 ? idx : 0);
                    setPreviewQuestion(item);
                    setIsPreviewOpen(true);
                  }}
                  className="text-xs font-medium cursor-pointer flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-neutral-700 dark:text-neutral-300 focus:bg-neutral-100 dark:focus:bg-neutral-800"
                >
                  <Search className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
                  <span>Pratinjau</span>
                </DropdownMenuItem>
                {canEdit && (
                  <>
                    <DropdownMenuItem
                      onClick={() => handleEditClick(item)}
                      className="text-xs font-medium cursor-pointer flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-neutral-700 dark:text-neutral-300 focus:bg-neutral-100 dark:focus:bg-neutral-800"
                    >
                      <Edit className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
                      <span>Edit</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
                    <DropdownMenuItem
                      onClick={() => handleDeleteClick(item)}
                      className="text-xs font-medium cursor-pointer flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/40"
                    >
                      <Trash className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      <span>Hapus</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      }
    }
  ], [questions, isOwner, canEdit]);

  const columns = neonColumns;

  const handleImportWord = async (file: File) => {
    if (!pb) return;
    setIsImporting(true);
    setImportProgress(0);
    setBatchProgress({
      isOpen: true,
      total: 0,
      current: 0,
      message: "Menganalisis file Word...",
      title: "Import file Word",
    });

    try {
      const result = await importQuestionsFromWord({
        file,
        pb,
        examId: examId!,
        allowedTypes,
        onProgress: (p) => {
          if (p.percent !== undefined) setImportProgress(p.percent);
          setBatchProgress((prev) => ({ ...prev, ...p, isOpen: true }));
        },
        localizeImage,
        localizeInlineImages,
      });

      let message = `${result.importedCount} soal berhasil diimport.`;
      if (result.skippedCount && result.skippedCount > 0) message += ` ${result.skippedCount} soal duplikat dilewati.`;
      if (result.skippedByType && result.skippedByType > 0) message += ` ${result.skippedByType} soal dilewati (tipe belum diaktifkan).`;
      loadQuestions();
      showAlert("Berhasil", message, "success");
    } catch (err: any) {
      console.error("Import Word Error:", err);
      showAlert("Gagal Import", err.message || "Gagal mengimport Word.", "danger");
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setBatchProgress((prev) => ({ ...prev, isOpen: false }));
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
      title: "Import dari Excel",
    });

    try {
      const result = await importQuestionsFromExcel({
        file,
        pb,
        examId: examId!,
        onProgress: (p) => {
          if (p.percent !== undefined) setImportProgress(p.percent);
          setBatchProgress((prev) => ({ ...prev, ...p, isOpen: true }));
        },
        localizeImage,
        localizeInlineImages,
      });

      loadQuestions();
      showAlert("Berhasil", `${result.importedCount} soal berhasil diimport dari Excel.`, "success");
    } catch (err: any) {
      console.error("Import Excel Error:", err);
      showAlert("Gagal Import", err.message || "Gagal mengimport Excel.", "danger");
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setBatchProgress((prev) => ({ ...prev, isOpen: false }));
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
      title: "Import dari JSON",
    });

    try {
      const result = await importQuestionsFromJson({
        file,
        pb,
        examId: examId!,
        onProgress: (p) => {
          if (p.percent !== undefined) setImportProgress(p.percent);
          setBatchProgress((prev) => ({ ...prev, ...p, isOpen: true }));
        },
        localizeImage,
        localizeInlineImages,
      });

      loadQuestions();
      showAlert("Berhasil", `${result.importedCount} butir soal berhasil diimpor dari file JSON!`, "success");
    } catch (err: any) {
      console.error("Import JSON Error:", err);
      showAlert("Gagal", err.message || "Gagal mengimpor file JSON.", "danger");
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setBatchProgress((prev) => ({ ...prev, isOpen: false }));
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
    try {
      const result = await exportQuestionsToWord({
        questions,
        exam,
        pb,
        terminology: {
          student: (school as any)?.studentTerminology || "Siswa",
          teacher: (school as any)?.teacherTerminology || "Guru",
          class: (school as any)?.classTerminology || "Kelas",
        },
        onProgress: (p) => setBatchProgress({ isOpen: true, ...p }),
      });
      if (result.count > 0) {
        addToast({ title: "Export Sukses", description: `${result.count} butir soal berhasil diexport ke Word.`, type: "success" });
      }
    } catch (err) {
      console.error("Export Word Error:", err);
      addToast({ title: "Gagal", description: "Gagal export ke Word.", type: "error" });
    } finally {
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleExportToJson = () => {
    const result = exportQuestionsToJson({
      questions,
      examTitle: exam?.title || exam?.subject || "Ujian",
    });
    if (result.count > 0) {
      addToast({ title: "Export Sukses", description: "File JSON berhasil diunduh.", type: "success" });
    }
  };

  const handleExportSelectedToJson = () => {
    const result = exportQuestionsToJson({
      questions,
      examTitle: exam?.title || exam?.subject || "Ujian",
      selectedIds,
    });
    if (result.count > 0) {
      addToast({ title: "Export Sukses", description: `${result.count} soal berhasil diexport ke JSON.`, type: "success" });
    }
  };

  const handleExportSelectedToWord = async () => {
    const selectedQuestions = questions.filter(q => selectedIds.includes(q.id));
    if (selectedQuestions.length === 0) return;
    try {
      const result = await exportQuestionsToWord({
        questions,
        exam,
        pb,
        selectedIds,
        terminology: {
          student: (school as any)?.studentTerminology || "Siswa",
          teacher: (school as any)?.teacherTerminology || "Guru",
          class: (school as any)?.classTerminology || "Kelas",
        },
        onProgress: (p) => setBatchProgress({ isOpen: true, ...p }),
      });
      if (result.count > 0) {
        addToast({ title: "Export Sukses", description: `${result.count} soal berhasil diexport ke Word.`, type: "success" });
      }
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
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
      {/* Global Progress Bar */}
      {(isImporting || isSavingBatch || isParsing || isDeleting || isBulkDeleting) && (
        <div className="fixed top-0 left-0 w-full h-1.5 z-[100] bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            style={{ width: `${importProgress}%` }}
          />
        </div>
      )}

      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
        {/* ── 1. Top Bar: Back, Breadcrumbs, Title, Metadata Pills, Top Actions ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800 relative z-30 overflow-visible">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs cursor-pointer"
              onClick={() => navigate("/admin/bank-soal")}
              title="Kembali ke Bank Soal"
              aria-label="Kembali ke Bank Soal"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0 space-y-1">
              {/* Breadcrumb line */}
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                <Link to="/admin" className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                  Semua Modul
                </Link>
                <span>/</span>
                <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                  {school?.slug || "modalbangsa"}
                </span>
                <span>/</span>
                <Link to="/admin/bank-soal" className="flex items-center gap-1 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium transition-colors">
                  <BookOpen className="h-3.5 w-3.5 text-neutral-400" />
                  <span>bank-soal</span>
                </Link>
                <span>/</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]">
                  {exam?.title || "Daftar Butir Soal"}
                </span>
              </div>

              {/* Title & Primary Type Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                  Kelola Butir Soal
                </h1>

                {exam?.examType && (
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0", getExamTypeColorClass(exam.examType))}>
                    {exam.examType}
                  </span>
                )}
              </div>

              {/* Clean Subtitle Line: Mapel • Guru • Kepemilikan (Simpel & Rapi) */}
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                {exam?.subject && (
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    {exam.subject}
                  </span>
                )}

                {exam?.subject && (exam?.teacherName || isOwner || isMgmpExam) && (
                  <span className="text-neutral-300 dark:text-neutral-600">•</span>
                )}

                {exam?.teacherName && (
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {exam.teacherName}
                    {exam.teacherCode && (
                      <span className="text-neutral-400 font-mono text-[11px] ml-1">({exam.teacherCode})</span>
                    )}
                  </span>
                )}

                {/* Tampilkan badge HANYA jika soal milik rekan guru lain, untuk soal sendiri TIDAK perlu badge */}
                {!isRealOwner && role !== "admin" && (
                  <>
                    <span className="text-neutral-300 dark:text-neutral-600">•</span>
                    <span
                      className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium cursor-help"
                      title={`Soal milik ${exam?.teacherName || "rekan guru"}`}
                    >
                      <Users className="h-3 w-3" />
                      {isMgmpExam ? "Soal Rekan (MGMP)" : "Soal Rekan"}
                    </span>
                  </>
                )}

                {exam?.is_mgmp_shared && (
                  <>
                    <span className="text-neutral-300 dark:text-neutral-600">•</span>
                    <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium ml-1">
                      <Share2 className="h-3 w-3" />
                      Kolaborasi Aktif
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Top Right */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap overflow-visible relative z-30">
            {/* SALIN KE BANK SOAL SAYA (Khusus Guru yang bukan owner) */}
            {!isRealOwner && role !== "admin" && (
              <NeonButton
                variant="primary"
                color="brand"
                size="sm"
                onClick={handleDuplicateCurrentExam}
                loading={isDuplicatingExam}
                className="h-8 gap-1.5 shadow-sm"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Salin ke Bank Soal Saya</span>
              </NeonButton>
            )}

            {/* OPSI DATA DROPDOWN */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Opsi Data</span>
                  <ChevronDown className="h-3 w-3 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-2rem)] p-1.5 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-[100]">
                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-2 py-1">
                  Ambil & Salin Soal
                </DropdownMenuLabel>
                {canEdit && (
                  <>
                    <DropdownMenuItem
                      onClick={handleOpenBankSoalSelector}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                    >
                      <Database className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <div className="flex flex-col">
                        <span className="font-semibold">Pilih dari Bank Soal</span>
                        <span className="text-[10px] text-neutral-400">Salin dari bank soal sekolah / milik sendiri</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleOpenWaygroundImporter}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                    >
                      <Globe className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      <div className="flex flex-col">
                        <span className="font-semibold">Impor dari Wayground</span>
                        <span className="text-[10px] text-neutral-400">Ambil dari link Wayground / Quizizz</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => document.getElementById("unified-import-input")?.click()}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 rotate-180 text-blue-600 dark:text-blue-400" />
                      <div className="flex flex-col">
                        <span className="font-semibold">Import File Soal</span>
                        <span className="text-[10px] text-neutral-400">Excel (.xlsx), Word (.docx), JSON</span>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}
                {questions.length > 0 && (
                  <>
                    <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-2 py-1">
                      Export Soal
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={handleExportToWord}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Export ke Word (.docx)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleExportToJson}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                    >
                      <FileJson className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Export ke JSON</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-2 py-1">
                  Template Format
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => downloadQuestionTemplate()}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Template Excel Standard</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open("/templates/Template_Soal_Tabel.docx")}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  <span>Template Word Tabel & Literasi</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsLiterasiGuideOpen(true)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 cursor-pointer"
                >
                  <BookOpen className="h-3.5 w-3.5 text-sky-600" />
                  <span>Panduan Soal Literasi & AKM</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* LAINNYA DROPDOWN */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  <MoreHorizontal className="h-3.5 w-3.5 text-neutral-500" />
                  <span>Lainnya</span>
                  <ChevronDown className="h-3 w-3 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-w-[calc(100vw-2rem)] p-1.5 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-[100]">
                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-2 py-1">
                  Aksi Tambahan
                </DropdownMenuLabel>
                {examId && (
                  <DropdownMenuItem
                    onClick={() => navigate(`/admin/simulate/${examId}`)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Simulasi Tampilan Siswa</span>
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <>
                    <DropdownMenuItem
                      onClick={handleOpenBankSoalSelector}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                    >
                      <Database className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Pilih dari Bank Soal</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleOpenWaygroundImporter}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                    >
                      <Globe className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      <span>Impor dari Wayground</span>
                    </DropdownMenuItem>
                  </>
                )}
                {canEdit && questions.length > 0 && selectedIds.length === 0 && (
                  <>
                    <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
                    <DropdownMenuItem
                      onClick={() => setDeleteAllDialogOpen(true)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      <Trash className="h-3.5 w-3.5" />
                      <span>Hapus Semua Soal</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* ASISTEN AI CHAT BUTTON - Tersedia untuk SEMUA Guru & Admin */}
            {(role === "admin" || role === "teacher") && (
              <NeonButton
                variant="outline"
                color="brand"
                size="sm"
                onClick={() => setIsAIChatDrawerOpen(true)}
                className="h-8 gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Chat AI</span>
              </NeonButton>
            )}

            {/* TAMBAH SOAL BUTTON / DROPDOWN */}
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tambah Soal</span>
                    <ChevronDown className="h-3 w-3 text-white/60 dark:text-neutral-600" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-2rem)] p-1.5 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-[100]">
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-2 py-1">
                    Metode Pembuatan
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={handleCreateClick}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-blue-600" />
                    <div className="flex flex-col">
                      <span className="font-semibold">Input Manual</span>
                      <span className="text-[10px] text-neutral-400">Editor soal interaktif</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleOpenBankSoalSelector}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    <Database className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <div className="flex flex-col">
                      <span className="font-semibold">Pilih dari Bank Soal</span>
                      <span className="text-[10px] text-neutral-400">Salin butir soal dari bank lain / milik sendiri</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleOpenWaygroundImporter}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    <Globe className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    <div className="flex flex-col">
                      <span className="font-semibold">Impor dari Wayground</span>
                      <span className="text-[10px] text-neutral-400">Ambil dari link atau JSON Wayground</span>
                    </div>
                  </DropdownMenuItem>
                  {(role === "admin" || role === "teacher") && (
                    <>
                      <DropdownMenuSeparator className="my-1 border-neutral-100 dark:border-neutral-800" />
                      <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-2 py-1">
                        Bantuan AI
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => setIsAIChatDrawerOpen(true)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <div className="flex flex-col">
                          <span className="font-semibold flex items-center gap-1.5">
                            Asisten Chat AI
                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold">Chatbot</span>
                          </span>
                          <span className="text-[10px] text-neutral-400">Buat soal santai lewat chat prompt</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setIsAIModalOpen(true)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                      >
                        <Wand2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        <div className="flex flex-col">
                          <span className="font-semibold">Generator Form AI</span>
                          <span className="text-[10px] text-neutral-400">Pilih formulir parameter kustom</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setIsAIImportOpen(true)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <div className="flex flex-col">
                          <span className="font-semibold">Smart AI Import PDF</span>
                          <span className="text-[10px] text-neutral-400">Ekstrak soal otomatis dari PDF</span>
                        </div>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* ── MGMP Se-Mapel Info & Collaboration Banner ── */}
        {!isRealOwner && role !== "admin" && isMgmpExam && (
          <div className={cn(
            "p-3 sm:p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors shadow-2xs",
            exam?.is_mgmp_shared
              ? "bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-200/80 dark:border-indigo-800/60 text-indigo-950 dark:text-indigo-200"
              : "bg-sky-50/70 dark:bg-sky-950/20 border-sky-200/80 dark:border-sky-800/60 text-sky-950 dark:text-sky-200"
          )}>
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl shrink-0 border",
                exam?.is_mgmp_shared
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                  : "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 border-sky-200 dark:border-sky-800"
              )}>
                {exam?.is_mgmp_shared ? <Share2 className="h-4.5 w-4.5" /> : <Users className="h-4.5 w-4.5" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[13px]">
                    {exam?.is_mgmp_shared ? "Mode Kolaborasi MGMP Aktif" : "Bank Soal Rekan Guru Se-Mapel (Mode Pratinjau)"}
                  </span>
                  <span className={cn(
                    "px-2 py-0.2 rounded-full text-[10px] font-semibold border",
                    exam?.is_mgmp_shared
                      ? "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border-indigo-300/60 dark:border-indigo-700"
                      : "bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 border-sky-300/60 dark:border-sky-700"
                  )}>
                    {exam?.subject || "MGMP"}
                  </span>
                </div>
                <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">
                  {exam?.is_mgmp_shared
                    ? `Dibuat oleh ${exam?.teacherName || "rekan guru"}. Anda memiliki izin kolaborasi untuk mengedit dan menambah butir soal bersama.`
                    : `Dibuat oleh ${exam?.teacherName || "rekan guru"}. Anda dapat membaca butir soal ini atau menyalinnya ke koleksi Anda agar bebas diedit.`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <NeonButton
                variant="primary"
                color="brand"
                size="sm"
                onClick={handleDuplicateCurrentExam}
                loading={isDuplicatingExam}
                className="gap-1.5 shadow-xs"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Salin ke Bank Soal Saya</span>
              </NeonButton>
            </div>
          </div>
        )}

        {/* ── Signature Neon Horizontal Tabs: Kategori & Filter Cepat ── */}
        <NeonTabs
          activeTab={typeFilter}
          onChange={setTypeFilter}
          tabs={[
            {
              id: "all",
              label: <><span>Semua</span><span className="hidden sm:inline"> Butir Soal</span></>,
              icon: Layers,
              count: questions.length,
              countFormat: "badge",
            },
            {
              id: "pilihan_ganda",
              label: "Pilihan Ganda",
              indicator: true,
              count: questions.filter(q => (q.type || "pilihan_ganda") === "pilihan_ganda").length,
              countFormat: "badge",
            },
            {
              id: "complex",
              label: <><span>Variasi</span><span className="hidden sm:inline"> & Kompleks</span></>,
              icon: Sparkles,
              count: questions.filter(q => (q.type || "pilihan_ganda") !== "pilihan_ganda").length,
              countFormat: "badge",
            },
            {
              id: "image",
              label: "Soal Bergambar",
              icon: Image,
              count: questions.filter(q => q.imageUrl || q.text.includes("<img")).length,
              countFormat: "badge",
            },
            ...(groupsList.length > 0 ? [{
              id: "stimulus",
              label: "Paket Stimulus (AKM)",
              icon: BookOpen,
              count: `${groupsList.length} paket`,
              countFormat: "badge" as const,
            }] : []),
          ]}
        />

        {/* ── 2. Main Console: 2-Column Grid (Table + Inspector) ── */}
        <div className="flex flex-col xl:flex-row items-start gap-4">
          {/* Left: NeonTable */}
          <div className="w-full xl:flex-1 min-w-0">
            <NeonTable<QuestionData>
              tableLayout="fixed"
              rowVerticalAlign="top"
              data={displayQuestions}
              columns={neonColumns}
              keyExtractor={(q) => q.id}
              isLoading={loading}
              title="Daftar Butir Soal"
              subtitle="Klik baris soal untuk melihat pratinjau stimulus, gambar, dan kunci di panel detail."
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Cari pertanyaan, stimulus, kunci..."
              filterSlot={
                <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
                  <NeonFilterPopover
                    title="Filter Butir Soal"
                    activeCount={(typeFilter !== "all" ? 1 : 0) + (groupFilter !== "all" ? 1 : 0)}
                    onReset={() => {
                      setTypeFilter("all");
                      setGroupFilter("all");
                    }}
                  >
                    {/* Type Filter */}
                    <NeonFilterField label="Tipe Soal">
                      <NeonFilterSelect
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                      >
                        <option value="all">Semua Tipe Soal</option>
                        {Object.entries(QUESTION_TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </NeonFilterSelect>
                    </NeonFilterField>

                    {/* Stimulus / Group Filter */}
                    {groupsList.length > 0 && (
                      <NeonFilterField label="Paket Stimulus">
                        <NeonFilterSelect
                          value={groupFilter}
                          onChange={(e) => setGroupFilter(e.target.value)}
                        >
                          <option value="all">Semua Paket Stimulus</option>
                          {groupsList.map((gid) => (
                            <option key={gid} value={gid}>Paket {gid}</option>
                          ))}
                        </NeonFilterSelect>
                      </NeonFilterField>
                    )}
                  </NeonFilterPopover>

                  {/* Toggle Inspector Button */}
                  <InspectorToggle
                    active={showInspector}
                    onToggle={() => setShowInspector(!showInspector)}
                  />
                </div>
              }
              selectable={canEdit}
              selectedKeys={selectedIds}
              onSelectionChange={setSelectedIds}
              batchActions={
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    {selectedIds.length} terpilih:
                  </span>
                  <button
                    type="button"
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-rose-600 dark:text-rose-400 font-medium hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash className="h-3 w-3" />
                    <span>Hapus</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportSelectedToWord}
                    className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-750 text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <FileText className="h-3 w-3" />
                    <span>Word</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportSelectedToJson}
                    className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-750 text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <FileJson className="h-3 w-3" />
                    <span>JSON</span>
                  </button>
                </div>
              }
              activeKey={inspectedQuestion?.id}
              onRowClick={(q) => {
                setInspectedQuestionId(q.id);
                if (!showInspector) setShowInspector(true);
              }}
              pagination={true}
              pageSize={10}
              pageSizeOptions={[10, 25, 50, 100]}
              emptyTitle="Belum ada butir soal"
              emptySubtitle="Pilih salah satu metode di bawah ini untuk mulai mengisi butir soal ke dalam bank soal ini."
              emptyAction={
                canEdit ? (
                  <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                    <NeonButton
                      variant="primary"
                      color="brand"
                      size="sm"
                      onClick={handleCreateClick}
                      className="gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Input Manual</span>
                    </NeonButton>
                    <NeonButton
                      variant="secondary"
                      size="sm"
                      onClick={handleOpenBankSoalSelector}
                      className="gap-1.5"
                    >
                      <Database className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Pilih dari Bank Soal</span>
                    </NeonButton>
                    <NeonButton
                      variant="secondary"
                      size="sm"
                      onClick={handleOpenWaygroundImporter}
                      className="gap-1.5"
                    >
                      <Globe className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      <span>Impor Wayground</span>
                    </NeonButton>
                    <NeonButton
                      variant="ghost"
                      size="sm"
                      onClick={() => document.getElementById("unified-import-input")?.click()}
                      className="gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5 rotate-180 text-blue-600" />
                      <span>Import File</span>
                    </NeonButton>
                  </div>
                ) : isMgmpExam ? (
                  <div className="flex items-center justify-center pt-2">
                    <NeonButton
                      variant="primary"
                      color="brand"
                      size="sm"
                      onClick={handleDuplicateCurrentExam}
                      loading={isDuplicatingExam}
                      className="gap-1.5 shadow-xs"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Salin ke Bank Soal Saya</span>
                    </NeonButton>
                  </div>
                ) : undefined
              }
            />
          </div>

          {/* Right: Sticky Inspector Panel (Style Parity with ExamRoomsPage) */}
          {showInspector && (
            <NeonInspector
              scrollable
              widthClassName="w-full xl:w-[360px] 2xl:w-[380px]"
            >
              {/* 1. Detail Butir Soal Terpilih (Inspector) */}
              <InspectorSection>
                <InspectorHeader
                  title="Detail Butir Soal"
                  icon={FileText}
                  badge={
                    inspectedQuestion && currentInspectedIndex >= 0
                      ? `${currentInspectedIndex + 1} / ${targetQuestionsList.length}`
                      : "Ringkasan"
                  }
                  actions={
                    <div className="flex items-center gap-0.5 border-l border-neutral-200 dark:border-neutral-800 pl-1.5 ml-0.5">
                      <button
                        type="button"
                        onClick={handlePreviousQuestion}
                        disabled={!hasPreviousQuestion}
                        className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Soal Sebelumnya (←)"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextQuestion}
                        disabled={!hasNextQuestion}
                        className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Soal Selanjutnya (→)"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  }
                  onClose={() => setShowInspector(false)}
                />

                {inspectedQuestion ? (
                  <div className="space-y-2.5 text-xs">
                    {/* Tipe Soal & Stimulus */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <NeonBadge
                        variant={(QUESTION_TYPE_BADGE[inspectedQuestion.type || "pilihan_ganda"]?.variant) || "neutral"}
                        size="xs"
                      >
                        {QUESTION_TYPE_LABELS[inspectedQuestion.type || "pilihan_ganda"] || inspectedQuestion.type}
                      </NeonBadge>
                      {inspectedQuestion.groupId && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex min-w-0 shrink-0">
                              <NeonBadge
                                variant="amber"
                                size="xs"
                                icon={BookOpen}
                                className="max-w-[200px] min-w-0 shrink-0 cursor-pointer hover:bg-amber-500/20 transition-colors"
                              >
                                <span className="truncate min-w-0">Paket: {inspectedQuestion.groupId}</span>
                              </NeonBadge>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-xs space-y-1">
                            <div className="font-bold text-amber-500 flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 shrink-0" />
                              <span>Paket Stimulus (AKM)</span>
                            </div>
                            <p className="font-mono text-neutral-100 font-semibold break-all">{inspectedQuestion.groupId}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Stimulus Preview (if available) */}
                    {inspectedQuestion.groupText && (
                      <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 space-y-1.5 w-full min-w-0 max-w-full overflow-x-hidden break-words">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Teks Stimulus (AKM)</span>
                          </span>
                          <span className="font-normal lowercase text-amber-600/80 dark:text-amber-400/80">wacana terkait</span>
                        </div>
                        <div className="max-h-56 overflow-y-auto pr-1">
                          <MathText
                            content={inspectedQuestion.groupText}
                            className="text-xs text-neutral-800 dark:text-neutral-200 font-serif leading-relaxed [&_p:first-child]:!mt-0 [&_p]:!mt-0 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_figure]:my-2 [&_img]:!max-h-36 [&_img]:!max-w-full [&_img]:!w-auto [&_img]:!h-auto [&_img]:mx-auto [&_img]:object-contain [&_img]:rounded-md [&_img]:border [&_img]:border-neutral-200/80 [&_img]:dark:border-neutral-800 [&_img]:my-1.5 [&_img]:block [&_table]:!text-[11px] [&_table]:!my-2 [&_table]:!w-full [&_table]:!border-collapse [&_table]:!table [&_table]:clear-both [&_td]:!p-1.5 [&_td]:!px-2 [&_th]:!p-1.5 [&_th]:!px-2 [&_td]:!text-[11px] [&_th]:!text-[11px] [&_td]:!border [&_td]:!border-amber-300 dark:[&_td]:!border-amber-800/60 [&_th]:!border [&_th]:!border-amber-300 dark:[&_th]:!border-amber-800/60 [&_th]:!bg-amber-100/60 dark:[&_th]:!bg-amber-900/40"
                          />
                        </div>
                      </div>
                    )}

                    {/* Question Text */}
                    <div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Pertanyaan</div>
                      <div className="mt-1 p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-850/50 border border-neutral-200/60 dark:border-neutral-800 w-full min-w-0 max-w-full overflow-x-hidden break-words">
                        <MathText
                          content={inspectedQuestion.text}
                          className="text-xs sm:text-[13px] font-serif text-neutral-900 dark:text-neutral-100 leading-relaxed ql-editor !p-0 break-words w-full max-w-full overflow-x-hidden [&_p:first-child]:!mt-0 [&_p]:!mt-0 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_figure]:m-0 [&_p]:max-w-full [&_img]:!max-h-48 sm:[&_img]:!max-h-52 [&_img]:!max-w-full [&_img]:!h-auto [&_img]:mx-auto [&_img]:object-contain [&_img]:rounded-lg [&_img]:border [&_img]:border-neutral-200/80 [&_img]:dark:border-neutral-800 [&_img]:my-2 [&_img]:block [&_table]:!text-xs [&_table]:!my-2 [&_table]:!w-full [&_table]:!border-collapse [&_table]:!table [&_table]:clear-both [&_td]:!p-1.5 [&_td]:!px-2.5 [&_th]:!p-1.5 [&_th]:!px-2.5 [&_td]:!text-xs [&_th]:!text-xs [&_td]:!border [&_td]:!border-neutral-200 dark:[&_td]:!border-neutral-750 [&_th]:!border [&_th]:!border-neutral-200 dark:[&_th]:!border-neutral-750 [&_th]:!bg-neutral-50 dark:[&_th]:!bg-neutral-850 [&_.ql-table-embed]:!my-2 [&_.ql-table-embed]:!p-0 [&_.ql-table-embed]:!border-none [&_.ql-table-embed]:!bg-transparent shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Question Image (if available) */}
                    {inspectedQuestion.imageUrl && !inspectedQuestion.text?.includes("<img") && (
                      <div className="rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-2 flex justify-center mt-2">
                        <img
                          src={inspectedQuestion.imageUrl}
                          alt="Gambar Soal"
                          className="max-h-40 max-w-full object-contain rounded-lg"
                        />
                      </div>
                    )}

                    {/* Choices / Answers Preview */}
                    {(inspectedQuestion.type === "pilihan_ganda" || inspectedQuestion.type === "pilihan_ganda_kompleks") && inspectedQuestion.choices && (
                      <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                          <span>Pilihan Jawaban</span>
                          <span className="font-mono text-[10px] bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-600 dark:text-neutral-400 font-semibold">
                            {Object.keys(inspectedQuestion.choices).length} Opsi
                          </span>
                        </div>
                        <div className="space-y-2">
                          {Object.keys(inspectedQuestion.choices).sort().map((key, idx) => {
                            const choice = inspectedQuestion.choices![key];
                            const isCorrect = !!choice?.isCorrect;
                            const letter = /^[a-zA-Z]$/.test(key)
                              ? key.toUpperCase()
                              : String.fromCharCode(65 + idx);

                            return (
                              <div
                                key={key}
                                className={cn(
                                  "flex items-start gap-3 p-3 rounded-xl border transition-all text-xs",
                                  isCorrect
                                    ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/40 text-emerald-950 dark:text-emerald-100 shadow-2xs"
                                    : "bg-white dark:bg-neutral-850/60 border-neutral-200/80 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700"
                                )}
                              >
                                {/* Option Letter Badge (A, B, C, D, E) */}
                                <div
                                  className={cn(
                                    "w-6 h-6 min-w-[24px] rounded-lg flex items-center justify-center font-bold text-xs shrink-0 select-none transition-colors",
                                    isCorrect
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : "bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
                                  )}
                                >
                                  {letter}
                                </div>

                                {/* Option Content & Image */}
                                <div className="min-w-0 flex-1 pt-0.5">
                                  <MathText
                                    content={choice?.text || ""}
                                    disableJustify={true}
                                    className="text-xs text-neutral-800 dark:text-neutral-200 font-serif leading-relaxed ql-editor !p-0 [&_p]:m-0 [&_figure]:m-0 break-words [&_img]:!max-h-24 [&_img]:!max-w-full [&_img]:!w-auto [&_img]:!h-auto [&_img]:object-contain [&_img]:rounded-md [&_img]:border [&_img]:border-neutral-200/80 [&_img]:dark:border-neutral-800 [&_img]:my-1 [&_img]:block"
                                  />
                                  {choice?.imageUrl && (
                                    <div className="mt-2">
                                      <img
                                        src={choice.imageUrl}
                                        alt={`Opsi ${letter}`}
                                        className="max-h-24 object-contain rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1"
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* KUNCI Pill Indicator */}
                                {isCorrect && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 uppercase tracking-wider shrink-0 mt-0.5">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                    <span>KUNCI</span>
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Non-MCQ Answer Summary */}
                    {inspectedQuestion.type !== "pilihan_ganda" && inspectedQuestion.type !== "pilihan_ganda_kompleks" && (
                      <div className="pt-1 border-t border-neutral-100 dark:border-neutral-800 space-y-1">
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Konfigurasi Jawaban</div>
                        <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-850/50 border border-neutral-200/60 dark:border-neutral-800">
                          {renderQuestionDetails(inspectedQuestion, false)}
                        </div>
                      </div>
                    )}

                    {/* Next / Previous Quick Bar */}
                    <InspectorNav
                      onPrevious={handlePreviousQuestion}
                      onNext={handleNextQuestion}
                      hasPrevious={hasPreviousQuestion}
                      hasNext={hasNextQuestion}
                    />

                    {/* Action Buttons in ExamRoomsPage style */}
                    <InspectorActions>
                      <InspectorButton
                        variant="secondary"
                        icon={Search}
                        onClick={() => {
                          const idx = questions.findIndex(q => q.id === inspectedQuestion.id);
                          setPreviewIndex(idx >= 0 ? idx : 0);
                          setPreviewQuestion(inspectedQuestion);
                          setIsPreviewOpen(true);
                        }}
                      >
                        Pratinjau
                      </InspectorButton>

                      {canEdit ? (
                        <div className="flex items-center gap-1.5">
                          <InspectorButton
                            variant="primary"
                            icon={Edit}
                            onClick={() => handleEditClick(inspectedQuestion)}
                            className="flex-1"
                          >
                            Edit
                          </InspectorButton>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(inspectedQuestion)}
                            className="flex items-center justify-center p-1.5 rounded-md text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/20 transition-colors cursor-pointer shadow-2xs"
                            title="Hapus Soal"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : isMgmpExam ? (
                        <InspectorButton
                          variant="secondary"
                          icon={Copy}
                          onClick={handleDuplicateCurrentExam}
                          className="w-full"
                        >
                          Salin ke Bank Soal Saya
                        </InspectorButton>
                      ) : null}
                    </InspectorActions>
                  </div>
                ) : (
                  <InspectorEmpty message="Pilih atau arahkan kursor ke salah satu butir soal di tabel." />
                )}
              </InspectorSection>

              {/* 2. Format & Rumus KaTeX Helper Box */}
              <InspectorCard
                title="Panduan Format & Rumus"
                icon={BookOpen}
                description={
                  <>Ketik rumus matematika diapit tanda <code>\( ... \)</code>, misalnya <code>\( x^2 + y^2 = r^2 \)</code>.</>
                }
                actionSlot={
                  <button
                    type="button"
                    onClick={() => setIsGuideOpen(!isGuideOpen)}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 cursor-pointer"
                    title={isGuideOpen ? "Tutup panduan" : "Buka panduan"}
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isGuideOpen && "rotate-180")} />
                  </button>
                }
              >
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEquationTarget(null);
                      setInitialEquationLatex("");
                      setIsEquationModalOpen(true);
                    }}
                    className="w-full py-1.5 px-2.5 rounded-lg border border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 transition-colors text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Function className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Buka Equation Studio</span>
                  </button>
                </div>

                {isGuideOpen && (
                  <div className="pt-1 space-y-1.5 text-[11px] text-neutral-600 dark:text-neutral-400 border-t border-neutral-200/60 dark:border-neutral-800/60">
                    <p><strong className="text-neutral-800 dark:text-neutral-200">Stimulus AKM:</strong> Kelompokkan butir dengan GroupId sama agar berbagi narasi stimulus.</p>
                    <button
                      type="button"
                      onClick={() => setIsLiterasiGuideOpen(true)}
                      className="w-full mt-1 py-1 px-2 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <BookOpen className="h-3 w-3" />
                      <span>Buka Panduan Lengkap Literasi</span>
                    </button>
                  </div>
                )}
              </InspectorCard>

            </NeonInspector>
          )}
        </div>
      </div>

      {/* MODAL PANDUAN LITERASI */}
      <LiterasiGuideDialog
        open={isLiterasiGuideOpen}
        onOpenChange={setIsLiterasiGuideOpen}
        onDownloadTemplate={downloadWordTemplateLiterasi}
        onToast={addToast}
      />

      <div>

        {/* Dialog for Create/Edit Question */}
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
                  <span className="text-xs text-slate-400">File foto maksimal 2MB</span>
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
                  <span className="text-xs text-slate-400">Gunakan file yang sudah di-upload</span>
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


        {/* ASISTEN AI CHAT DRAWER */}
        <AIChatQuestionDrawer
          isOpen={isAIChatDrawerOpen}
          onClose={() => setIsAIChatDrawerOpen(false)}
          exam={exam ? { id: exam.id, name: exam.name, subject: exam.subject } : undefined}
          onApplyQuestions={handleApplyAIChatQuestions}
          onSavedQuestionsSuccess={loadQuestions}
        />

        {/* MODAL GENERASI AI (Neon Theme) */}
        <AIGenerateDialog
          open={isAIModalOpen}
          onOpenChange={setIsAIModalOpen}
          activeAIConfig={activeAIConfig}
          AI_MODELS={AI_MODELS}
          handleRandomFill={handleRandomFill}
          aiLevel={aiLevel}
          setAiLevel={setAiLevel}
          aiSubject={aiSubject}
          setAiSubject={setAiSubject}
          aiTopic={aiTopic}
          setAiTopic={setAiTopic}
          handleGenerateTopic={handleGenerateTopic}
          isGeneratingTopic={isGeneratingTopic}
          dynamicSuggestions={dynamicSuggestions}
          isFetchingSuggestions={isFetchingSuggestions}
          aiMaterialFileName={aiMaterialFileName}
          aiMaterialText={aiMaterialText}
          setAiMaterialFile={setAiMaterialFile}
          setAiMaterialText={setAiMaterialText}
          setAiMaterialFileName={setAiMaterialFileName}
          handleAIMaterialUpload={handleAIMaterialUpload}
          isExtractingMaterial={isExtractingMaterial}
          aiType={aiType}
          setAiType={setAiType}
          allowedTypes={allowedTypes}
          aiCount={aiCount}
          setAiCount={setAiCount}
          getTaxonomyPreset={getTaxonomyPreset}
          setTaxonomyPreset={setTaxonomyPreset}
          toggleTaxonomy={toggleTaxonomy}
          aiTaxonomy={aiTaxonomy}
          aiDifficulty={aiDifficulty}
          setAiDifficulty={setAiDifficulty}
          isAiLiteracy={isAiLiteracy}
          setIsAiLiteracy={setIsAiLiteracy}
          aiPassageLength={aiPassageLength}
          setAiPassageLength={setAiPassageLength}
          aiObjectives={aiObjectives}
          isFetchingObjectives={isFetchingObjectives}
          isAIGenerating={isAIGenerating}
          aiProgress={aiProgress}
          cancelAIGeneration={cancelAIGeneration}
          handleAIGenerate={handleAIGenerate}
        />

        {/* Smart AI Import Dialog */}
        <AISmartImportDialog
          open={isAIImportOpen}
          onOpenChange={setIsAIImportOpen}
          parsedResults={parsedResults}
          setParsedResults={setParsedResults}
          importMode={importMode}
          setImportMode={setImportMode}
          importCount={importCount}
          setImportCount={setImportCount}
          importType={importType}
          setImportType={setImportType}
          importText={importText}
          setImportText={setImportText}
          isParsing={isParsing}
          importProgress={importProgress}
          aiProgress={aiProgress}
          handleFileUpload={handleFileUpload}
          handleAIParse={handleAIParse}
          handleSaveAIImport={handleSaveAIImport}
          cancelAIGeneration={cancelAIGeneration}
        />

        <ConfirmationDialog
          isOpen={bulkDeleteDialogOpen}
          onClose={() => setBulkDeleteDialogOpen(false)}
          onConfirm={handleConfirmBulkDelete}
          type="danger"
          title="Hapus Soal Terpilih"
          description={`Apakah Anda yakin ingin menghapus ${selectedIds.length} soal yang dipilih? Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel="Hapus"
          isLoading={isBulkDeleting}
        />

        <ConfirmationDialog
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
          onConfirm={async () => {
            if (confirmModal.onConfirm) await confirmModal.onConfirm();
            setConfirmModal({ ...confirmModal, isOpen: false });
          }}
          title={confirmModal.title}
          description={confirmModal.description}
          type={confirmModal.type}
          confirmLabel={confirmModal.confirmLabel || "OK"}
          showCancel={confirmModal.showCancel}
        />

        <BatchProgressDialog progress={batchProgress} colorClass="bg-indigo-600" />
        {/* MODAL PUSAT BANTUAN PENULISAN STEM */}
        <MathGuideDialog open={isMathGuideOpen} onOpenChange={setIsMathGuideOpen} />
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
        <QuestionRepositoryDialog
          isOpen={isRepoDialogOpen}
          onOpenChange={setIsRepoDialogOpen}
          targetExamId={examId || (exam && exam.id) || ""}
          targetExamTitle={exam?.title || ""}
          onImportQuestions={handleBatchImportQuestions}
          initialTab={repoDialogInitialTab}
        />
      </div>
    </div>
  );
};

export default QuestionsPage;


