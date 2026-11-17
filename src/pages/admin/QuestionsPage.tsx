import { getQuestionColumns } from "./questions/components/questionColumns";
import { QuestionDetailsView } from "./questions/components/QuestionDetailsView";
import { useQuestionAI } from "./questions/hooks/useQuestionAI";
import { localizeImage as localizeImageHelper, localizeInlineImages as localizeInlineImagesHelper } from "./questions/utils/imageLocalizer";
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

  // AI Import State managed by useQuestionAI
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

  const [batchQuestions, setBatchQuestions] = useState<any[]>([
    { text: "", choices: { a: { text: "" }, b: { text: "" }, c: { text: "" }, d: { text: "" }, e: { text: "" } }, correctKey: "a", imageFile: null }
  ]);

  const {
    isAIChatDrawerOpen,
    setIsAIChatDrawerOpen,
    isAIModalOpen,
    setIsAIModalOpen,
    isAIImportOpen,
    setIsAIImportOpen,
    isAIGenerating,
    isAIGeneratingDirect,
    aiProgress,
    isRegeneratingIndex,
    aiTopic,
    setAiTopic,
    aiCount,
    setAiCount,
    aiLevel,
    setAiLevel,
    aiSubject,
    setAiSubject,
    aiType,
    setAiType,
    isAiLiteracy,
    setIsAiLiteracy,
    aiPassageLength,
    setAiPassageLength,
    aiDifficulty,
    setAiDifficulty,
    aiTaxonomy,
    toggleTaxonomy,
    setTaxonomyPreset,
    getTaxonomyPreset,
    aiMaterialFile,
    setAiMaterialFile,
    aiMaterialText,
    setAiMaterialText,
    aiMaterialFileName,
    setAiMaterialFileName,
    isExtractingMaterial,
    aiObjectives,
    isFetchingObjectives,
    dynamicSuggestions,
    isFetchingSuggestions,
    isGeneratingTopic,
    importText,
    setImportText,
    importMode,
    setImportMode,
    importCount,
    setImportCount,
    importType,
    setImportType,
    isParsing,
    setIsParsing,
    parsedResults,
    setParsedResults,
    cancelAIGeneration,
    handleGenerateTopic,
    handleRandomFill,
    handleAIMaterialUpload,
    handleAIGenerateDirect,
    handleAIRegenerateSingle,
    handleAIParse,
    handleSaveAIImport,
    handleAIGenerate,
    handleApplyAIChatQuestions
  } = useQuestionAI({
    pb,
    exam,
    examId,
    school,
    addToast,
    showAlert,
    loadQuestions,
    batchQuestions,
    setBatchQuestions,
    setIsBatchModalOpen,
    setBatchProgress,
    setImportProgress
  });

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

  // Helper to localize images bound to current school and examId
  const localizeImage = (url: string, filenamePrefix: string) =>
    localizeImageHelper(url, filenamePrefix, { school, examId });
  const localizeInlineImages = (html: string) =>
    localizeInlineImagesHelper(html, { school, examId });



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

  const neonColumns: NeonTableColumn<QuestionData>[] = useMemo(
    () =>
      getQuestionColumns({
        questions,
        inspectedQuestion,
        canEdit,
        onPreview: (item, index) => {
          setPreviewIndex(index);
          setPreviewQuestion(item);
          setIsPreviewOpen(true);
        },
        onEdit: handleEditClick,
        onDelete: handleDeleteClick,
      }),
    [questions, inspectedQuestion, canEdit, handleEditClick, handleDeleteClick]
  );

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
                          <QuestionDetailsView item={inspectedQuestion} showTypeBadge={false} />
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


