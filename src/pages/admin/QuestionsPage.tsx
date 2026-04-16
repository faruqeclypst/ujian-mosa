import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Edit, Trash, Check, Image, ChevronDown, FileText, Download, Eye, FolderOpen, Sparkles, Wand2, RefreshCw, BookOpen, Loader2, FileSpreadsheet, Search } from "lucide-react";
import { MathText } from "../../components/MathText";
import { SmartImage } from "../../components/ui/smart-image";
import { generateQuestionsAI, generateSingleQuestionAI, getTopicSuggestionsAI, parseQuestionsAI, AI_MODELS } from "../../lib/ai";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { Progress } from "../../components/ui/progress";
import { DeleteConfirmationDialog } from "../../components/ui/delete-confirmation-dialog";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";
import pb from "../../lib/pocketbase";
import { Input } from "../../components/ui/input";
import { Separator } from "../../components/ui/separator";
import FormField from "../../components/forms/FormField";
import { uploadInventoryImage, deleteImageFromStorage, deleteImagesFromStorage } from "../../lib/storage";
import { ImportButton } from "../../components/ui/import-button";
import { parseQuestionsFromWord } from "../../lib/questionWordParser";
import { parseQuestionsSimple } from "../../lib/questionSimpleParser";
import { downloadQuestionTemplate, parseQuestionImportExcel } from "../../lib/questionExcel";
import mammoth from "mammoth";
import ReactQuill, { Quill } from "react-quill";
import ImageResize from "quill-image-resize-module-react";
import "react-quill/dist/quill.snow.css";

Quill.register("modules/imageResize", ImageResize);
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
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 1200; // Resolusi max agar tetap tajam tapi ringan
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
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error("Gagal mengompresi gambar"));
            }
          },
          "image/jpeg",
          0.75 // 75% kualitas sangat tinggi untuk visual tp hemat bytes
        );
      };
    };
    reader.onerror = (e) => reject(e);
  });
};



const QuestionsPage = () => {
  const navigate = useNavigate();
  const [examId, setExamId] = useState<string | null>(() => sessionStorage.getItem("activeQuestionsExamId"));

  useEffect(() => {
    if (!examId) {
      // Jika nyasar kesini tanpa ID, balikin ke daftar bank soal
      navigate("/admin/bank-soal", { replace: true });
    }
  }, [examId, navigate]);

  const { user, role, teacherId } = useAuth();
  const { school } = useTenant();
  const { addToast } = useToast();
  const { subjects, teachers } = useExamData();

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
  const [literasiMode, setLiterasiMode] = useState<"select" | "create">("select");

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
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryTarget, setGalleryTarget] = useState<{ type: "cover" | "choice" | "batch"; letter?: string; index?: number } | null>(null);

  // 🤖 AI Import State
  const [isAIImportOpen, setIsAIImportOpen] = useState(false);
  const [isQuickPasteOpen, setIsQuickPasteOpen] = useState(false);
  const [quickPasteText, setQuickPasteText] = useState("");
  const [importText, setImportText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResults, setParsedResults] = useState<any[]>([]);
  const [isLiterasiGuideOpen, setIsLiterasiGuideOpen] = useState(false);

  const loadGalleryImages = () => {
    const images = new Set<string>();
    questions.forEach((q) => {
      if (q.imageUrl) images.add(q.imageUrl);
      if (q.choices) {
        Object.values(q.choices).forEach((c) => {
          if (c.imageUrl) images.add(c.imageUrl);
        });
      }
    });
    setGalleryImages(Array.from(images));
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

    if (!galleryTarget) return;

    if (galleryTarget.type === "cover") {
      setQuestionFile(fileToUpload);
      setFormValues((prev) => ({ ...prev, imageUrl: "" }));
      setCoverSizeInfo(file.size > 200 * 1024 ? `${origSize} ➔ ${formatSize(fileToUpload.size)}` : `${origSize} (Hemat)`);
    } else if (galleryTarget.type === "choice" && galleryTarget.letter) {
      const letter = galleryTarget.letter;
      setChoiceFiles((prev) => ({ ...prev, [letter]: fileToUpload }));
      handleChoiceChange(letter, "imageUrl", "");
      setChoicesSizeInfo((prev) => ({ ...prev, [letter]: file.size > 100 * 1024 ? `${origSize} ➔ ${formatSize(fileToUpload.size)}` : `${origSize} (Hemat)` }));
    } else if (galleryTarget.type === "batch" && galleryTarget.index !== undefined) {
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
    return () => {};
  }, []);

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
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
  const [isRegeneratingIndex, setIsRegeneratingIndex] = useState<number | null>(null);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiLevel, setAiLevel] = useState("");
  const [aiSubject, setAiSubject] = useState("");
  const [aiType, setAiType] = useState<any>("pilihan_ganda");
  const [isAiLiteracy, setIsAiLiteracy] = useState(false);
  const [aiPassageLength, setAiPassageLength] = useState("sedang");
  const [aiDifficulty, setAiDifficulty] = useState("sedang"); 
  const [aiFocus, setAiFocus] = useState("umum");

  const focusDescriptions: Record<string, string> = {
    umum: "Soal sesuai materi kurikulum sekolah pada umumnya (K13/Merdeka).",
    akm: "Standar Asesmen Nasional. Fokus pada Literasi, Numerasi, & HOTS kontekstual.",
    pisa: "Standar Internasional (OECD). Menekankan penalaran tingkat tinggi & aplikasi dunia nyata."
  };

  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (aiLevel && aiSubject && aiSubject.length > 2) {
        setIsFetchingSuggestions(true);
        try {
          const suggestions = await getTopicSuggestionsAI(
            aiLevel, 
            aiSubject, 
            aiDifficulty, 
            aiType, 
            aiFocus, 
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

    const timer = setTimeout(fetchSuggestions, 800);
    return () => clearTimeout(timer);
  }, [aiLevel, aiSubject, aiDifficulty, aiType, aiFocus, isAiLiteracy]);


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

  const handleAIGenerateDirect = async () => {
    setIsAIGeneratingDirect(true);
    try {
      const generated = await generateQuestionsAI(
        aiTopic || (exam?.subject + " " + (exam?.name?.split(' ')[0] || "")) || "Umum", 
        aiCount, 
        aiLevel, 
        aiSubject || (exam?.subject || ""), 
        aiType, 
        isAiLiteracy,
        aiPassageLength,
        aiDifficulty,
        aiFocus
      );
      
      const questionsForReview = generated.map(q => {
        const choicesBatch: Record<string, { text: string }> = {};
        let correctKey = "a";
        if (q.choices) {
          Object.keys(q.choices).forEach(key => {
            choicesBatch[key] = { text: q.choices![key].text };
            if (q.choices![key].isCorrect) correctKey = key;
          });
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
      addToast({
        type: "success",
        title: "Generasi Selesai",
        description: `${generated.length} soal baru telah dibuat.`,
        duration: 3000
      });
    } catch (err: any) {
      console.error("AI Direct Generate Error:", err);
      if (err.message === "AI_RATE_LIMIT") {
        showAlert("Limit Tercapai", "Server AI sedang sibuk karena terlalu banyak permintaan. Silakan tunggu sekitar 1-2 menit sebelum mencoba lagi.", "danger");
      } else {
        addToast({
          type: "error",
          title: "Gagal Generasi",
          description: err.message || "Gagal meramu paket soal baru.",
        });
      }
    } finally {
      setIsAIGeneratingDirect(false);
    }
  };



  const handleAIRegenerateSingle = async (index: number) => {
    setIsRegeneratingIndex(index);
    try {
      const q = batchQuestions[index];
      const regenerated = await generateSingleQuestionAI(
        aiTopic || (exam?.subject + " " + (exam?.name?.split(' ')[0] || "")) || "Umum",
        q.type || aiType,
        aiLevel,
        aiSubject || (exam?.subject || ""),
        aiDifficulty,
        aiFocus,
        q.groupText || ""
      );

      const choicesBatch: Record<string, { text: string }> = {};
      let correctKey = "a";
      if (regenerated.choices) {
        Object.keys(regenerated.choices).forEach(key => {
          choicesBatch[key] = { text: regenerated.choices![key].text };
          if (regenerated.choices![key].isCorrect) correctKey = key;
        });
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
      if (err.message === "AI_RATE_LIMIT") {
        showAlert("Limit Tercapai", "Permintaan terlalu cepat. Silakan tunggu 1 menit agar AI siap kembali.", "danger");
      } else {
        addToast({
          type: "error",
          title: "Gagal Regenerasi",
          description: err.message || "AI gagal meramu soal baru.",
        });
      }
    } finally {
      setIsRegeneratingIndex(null);
    }
  };

  const handleAIParse = async () => {
    if (!importText.trim()) return;
    setIsParsing(true);
    try {
      const results = await parseQuestionsAI(importText, exam?.name || "", exam?.level || "");
      setParsedResults(results);
      addToast({
        title: "Ekstraksi Berhasil",
        description: `Ditemukan ${results.length} soal. Silakan tinjau sebelum menyimpan.`,
        type: "success"
      });
    } catch (err: any) {
      addToast({
        title: "Gagal Menarik Soal",
        description: err.message === "AI_RATE_LIMIT" ? "Terlalu banyak permintaan. Tunggu 60 detik." : (err.message || "Gagal memproses dokumen."),
        type: "error"
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleQuickPasteParse = () => {
    if (!quickPasteText.trim()) return;
    
    try {
      const results = parseQuestionsSimple(quickPasteText);
      if (results.length === 0) {
        addToast({
          title: "Format Tidak Dikenali",
          description: "Pastikan format soal sudah benar (Nomor soal, Opsi A-E, dan Jawaban).",
          type: "error"
        });
        return;
      }

      // Convert to batch review format
      const questionsForReview = results.map(q => {
        const choicesBatch: Record<string, { text: string }> = {};
        Object.keys(q.choices).forEach(key => {
          choicesBatch[key] = { text: q.choices[key].text };
        });

        return {
          text: q.text,
          type: "pilihan_ganda",
          choices: choicesBatch,
          correctKey: q.answerKey || "a",
          answerKey: "",
          groupId: "",
          groupText: "",
          isFromPaste: true
        };
      });

      setBatchQuestions(questionsForReview);
      setIsQuickPasteOpen(false);
      setQuickPasteText("");
      setIsBatchModalOpen(true);
      
      addToast({
        type: "success",
        title: "Berhasil Memproses",
        description: `${results.length} soal telah siap ditinjau.`,
        duration: 3000
      });
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Gagal Memproses",
        description: "Terjadi kesalahan saat memproses teks.",
      });
    }
  };

  const handleSaveAIImport = async () => {
    if (parsedResults.length === 0) return;
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
      for (const q of parsedResults) {
        await pb.collection("questions").create({
          examId,
          text: q.text || "Pertanyaan Tanpa Judul",
          field: typeMap[q.type || "pilihan_ganda"] || "multiple_choice",
          options: q.choices || {},
          answerKey: q.answerKey || "",
          groupId: q.groupId || "",
          groupText: q.groupText || "",
          order: (questions.length || 0) + count + 1
        });
        count++;
        const progress = Math.round((count / parsedResults.length) * 100);
        setImportProgress(progress);
        setBatchProgress(prev => ({
          ...prev,
          current: count,
          message: `Menyimpan soal AI (${count}/${parsedResults.length})`
        }));
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
      addToast({
        title: "Gagal Menyimpan",
        description: err.message || "Beberapa soal mungkin gagal diimpor.",
        type: "error"
      });
    } finally {
      setIsParsing(false);
      setImportProgress(0);
      setBatchProgress(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) {
      showAlert("Gagal", "Topik soal tidak boleh kosong.", "danger");
      return;
    }
    
    setIsAIGenerating(true);
    try {
      const generated = await generateQuestionsAI(
        aiTopic, 
        aiCount, 
        aiLevel, 
        aiSubject || (exam?.subject || ""), 
        aiType, 
        isAiLiteracy,
        aiPassageLength,
        aiDifficulty,
        aiFocus
      );
      
      if (!generated || generated.length === 0 || !Array.isArray(generated)) {
        throw new Error("AI tidak menghasilkan format soal yang valid.");
      }

      // 🪄 NEW SYSTEM: Populate Batch Modal for Review instead of saving directly
      const questionsForReview = generated.map(q => {
        const choicesBatch: Record<string, { text: string }> = {};
        let correctKey = "a";
        
        if (q.choices) {
          Object.keys(q.choices).forEach(key => {
            choicesBatch[key] = { text: q.choices![key].text };
            if (q.choices![key].isCorrect) correctKey = key;
          });
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
      if (err.message === "AI_RATE_LIMIT") {
        showAlert("Server Sedang Limit", "Terlalu banyak permintaan AI. Silakan jeda sejenak (1 menit) sebelum memulai generasi baru.", "danger");
      } else {
        addToast({
          type: "error",
          title: "Gagal Generasi AI",
          description: err.message || "Gagal meramu soal.",
        });
      }
    } finally {
      setIsAIGenerating(false);
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
    let validQuestions = batchQuestions.filter(q => q.text.trim() !== "");
    if (validQuestions.length === 0) {
      showAlert("Gagal", "Tidak ada soal yang diisi teks pertanyaannya.", "danger");
      return;
    }

    // Validate all must have key
    const hasEmptyKeys = validQuestions.some(q => {
      const correctChoice = q.choices[q.correctKey];
      return !correctChoice.text || correctChoice.text.trim() === "";
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

        const choicesToSave: any = {};
        Object.keys(q.choices).forEach((key) => {
          choicesToSave[key] = {
            text: q.choices[key].text,
            isCorrect: key === q.correctKey
          };
        });

        const payload: any = {
          examId,
          // If from AI, text is already formatted. If manual batch, wrap in <p>.
          text: q.isFromAI ? q.text : `<p>${q.text}</p>`, 
          field: typeMap[q.type || "pilihan_ganda"] || "multiple_choice", 
          options: choicesToSave,
          correctAnswer: q.correctKey,
          order: currentOrder++,
          groupId: q.groupId || "",
          group_id: q.groupId || "", // PocketBase alias
          groupText: q.groupText || "",
          group_text: q.groupText || "" // PocketBase alias
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

  const imageHandler = useCallback(function (this: any) {
    const quill = this.quill; // <--- Instance editor yang sedang diklik toolbar-nya
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        try {
          let fileToUpload = file;
          if (file.size > 200 * 1024) { // Compress jika > 200KB
            fileToUpload = await compressImage(file);
          }
          const reader = new FileReader();
          reader.readAsDataURL(fileToUpload);
          reader.onload = () => {
            const base64 = reader.result as string;
            if (quill) {
              const range = quill.getSelection() || { index: 0 };
              quill.insertEmbed(range.index, "image", base64);
              
              // ⚡ Set default size to 'Medium' (350px) & Center alignment
              setTimeout(() => {
                const img = quill.root.querySelector(`img[src="${base64}"]`);
                if (img) {
                  img.setAttribute('width', '350');
                  img.style.display = 'block';
                  img.style.margin = '10px auto';
                }
              }, 1);
              
              quill.setSelection(range.index + 1);
            }
          };
        } catch (e) {
          alert("Gagal mengunggah gambar ke editor.");
        }
      }
    };
  }, [examId]);

  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'align': [] }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['image', 'formula', 'clean']
      ],
      handlers: {
        image: imageHandler
      }
    },
    formula: true,
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar']
    }
  }), [imageHandler]);


  // 🔄 Load Questions dari PocketBase
  const loadQuestions = useCallback(async () => {
    if (!examId) return;
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

      setQuestions(mapped as any);
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

        // 3. Subscribe Realtime
        const unsubscribe = await pb.collection('questions').subscribe("*", (e) => {
          loadQuestions();
        });

        return () => {
          if (pb.authStore.isValid) {
            pb.collection('questions').unsubscribe("*");
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
    if (!exam || !teacherId) return false;
    // Cek ID Guru (baru) atau ID Akun (lama)
    return exam.teacherId === teacherId || exam.teacherId === user?.id;
  }, [role, exam, teacherId, user]);


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
      text: q.text,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validasi Teks Pertanyaan
    const isQuestionEmpty = !formValues.text || formValues.text.replace(/<[^>]*>/g, '').trim() === "";
    if (isQuestionEmpty) {
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
      const filledChoicesCount = Object.values(formValues.choices).filter(c => c.text && c.text.replace(/<[^>]*>/g, '').trim() !== "").length;
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

    try {
      const uploadBase64ToR2 = async (base64Data: string, prefix: string) => {
        try {
          const blob = await (await fetch(base64Data)).blob();
          const ext = blob.type.split("/")[1] || "png";
          const fileToUpload = new File([blob], `${prefix}_${Date.now()}.${ext}`, { type: blob.type });
          // 🛡️ Isolation: Kelompokkan gambar soal berdasarkan slug sekolah
          const schoolFolder = school?.slug || "unknown";
          const uploadSnap = await uploadInventoryImage(`schools/${schoolFolder}/exams/${examId}`, fileToUpload);
          return uploadSnap.url;
        } catch (e) {
          console.error(`Gagal upload base64 image (${prefix}) to R2`, e);
          return base64Data;
        }
      };

      let imageUrl = formValues.imageUrl || "";
      let textToSave = formValues.text;

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

      // 🖼️ 2. Scan teks Soal untuk base64
      if (textToSave.includes("data:image/")) {
        const doc = new DOMParser().parseFromString(textToSave, "text/html");
        const ims = doc.querySelectorAll("img[src^='data:image/']");
        for (let i = 0; i < ims.length; i++) {
          const base64 = ims[i].getAttribute("src")!;
          const url = await uploadBase64ToR2(base64, "text_manual");
          ims[i].setAttribute("src", url);
        }
        textToSave = doc.body.innerHTML;
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

      // 🖼️ 4. Scan teks Pilihan untuk base64 (terutama jika ada paste)
      for (const key in updatedChoices) {
        const choice = updatedChoices[key];
        // Cek properti imageUrl (jika ada data URL sisa)
        if (choice.imageUrl && choice.imageUrl.startsWith("data:image/")) {
          choice.imageUrl = await uploadBase64ToR2(choice.imageUrl, `choice_manual_${key}`);
        } else if (!choice.imageUrl) {
          delete choice.imageUrl;
        }

        // Cek teks pilihan
        if (choice.text && choice.text.includes("data:image/")) {
          const cDoc = new DOMParser().parseFromString(choice.text, "text/html");
          const cIms = cDoc.querySelectorAll("img[src^='data:image/']");
          for (let i = 0; i < cIms.length; i++) {
            const b64 = cIms[i].getAttribute("src")!;
            const url = await uploadBase64ToR2(b64, `choice_text_manual_${key}`);
            cIms[i].setAttribute("src", url);
          }
          choice.text = cDoc.body.innerHTML;
        }
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

      const payload: any = {
        examId,
        text: textToSave,
        field: typeMap[formValues.type] || "multiple_choice", 
        options: {}, 
        correctAnswer: "",
        order: selectedQuestion?.order || questions.length + 1
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
        const gtxt = formValues.groupText || "";
        
        payload.groupId = gid;
        payload.group_id = gid; // Snake case fallback
        payload.groupText = gtxt;
        payload.group_text = gtxt; // Snake case fallback
        
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
        await pb.collection('questions').update(selectedQuestion.id, payload);
      } else {
        await pb.collection('questions').create(payload);
      }
      setIsDialogOpen(false);
      showAlert("Berhasil", "Soal berhasil disimpan.", "success");
    } catch (error) {
      showAlert("Gagal", "Gagal menyimpan soal ke PocketBase.", "danger");
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
    if (!questionToDelete) return;
    setIsDeleting(true);
    try {
      // 🗑️ Hapus gambar di R2 (Non-blocking: jika gagal tetap hapus record DB)
      try {
        await cleanupQuestionImages(questionToDelete);
      } catch (storageError) {
        console.warn("Gagal membersihkan gambar dari R2 Storage. Ini mungkin karena masalah CORS setelah ganti domain.", storageError);
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

  const handleConfirmDeleteAll = async () => {
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

      if (pb.authStore.isValid) await pb.collection('questions').subscribe("*", () => loadQuestions());

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
        await Promise.all(chunk.map(q => pb.collection('questions').delete(q.id)));
        
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
          <MathText content={item.text} className="line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed ql-editor !p-0 [&_p]:m-0 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-4 [&_ul]:pl-4" />
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {(item.imageUrl || item.text.includes("<img")) && (
              <span className="p-1 px-1.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 flex items-center gap-1 font-bold text-[9px] border border-blue-200 dark:border-blue-800/40 uppercase tracking-tight">
                🖼️ Bergambar
              </span>
            )}
            {item.groupId && (
              <span className="p-1 px-1.5 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 flex items-center gap-1 font-bold text-[9px] border border-amber-200 dark:border-amber-800/40 uppercase tracking-tight">
                🔖 Paket: {item.groupId}
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
      if (parsed.length === 0) throw new Error("Tidak ada soal yang dikenali dalam file.");

      setBatchProgress(prev => ({ ...prev, total: parsed.length, message: `Menyiapkan import ${parsed.length} soal...` }));

      let importedCount = 0;
      const chunkSize = 5;
      
      for (let i = 0; i < parsed.length; i += chunkSize) {
        const chunk = parsed.slice(i, i + chunkSize);
        
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

          const payload = {
            examId,
            text: q.text,
            field: "multiple_choice",
            type: "pilihan_ganda",
            options: choices,
            answerKey: answerKey.toLowerCase(),
            groupId: q.groupId || "",
            groupText: q.groupText || "",
            order: (questions.length || 0) + actualIndex + 1,
            imageUrl: imageUrl
          };

          try {
            await pb.collection('questions').create(payload);
            importedCount++;
          } catch (createErr) {
            console.error("Gagal membuat soal Word pada index:", actualIndex, createErr);
          }
        }));

        const currentProcessed = Math.min(i + chunkSize, parsed.length);
        const progress = Math.round((currentProcessed / parsed.length) * 100);
        setImportProgress(progress);
        setBatchProgress(prev => ({
          ...prev,
          current: currentProcessed,
          message: `Mengimport soal (${currentProcessed}/${parsed.length})`
        }));
      }

      let message = `${importedCount} soal berhasil diimport.`;
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
          const payload = {
            examId,
            text: q.text,
            field: q.field || "multiple_choice",
            type: q.type,
            options: q.choices,
            answerKey: Object.entries(q.choices as any).find(([_, v]: any) => v.isCorrect)?.[0] || "a",
            groupId: q.groupId || "",
            groupText: q.groupText || "",
            order: (questions.length || 0) + actualIndex + 1,
            imageUrl: ""
          };

          try {
            await pb.collection('questions').create(payload);
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
      message: "Sync naskah & gambar... (Mohon Tunggu)",
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

    const getBase64 = async (url: string): Promise<string> => {
      if (!url) return "";
      const r2Domain = "pub-a1193e163fef41c9afc15d1334b8740b.r2.dev";
      let finalUrl = url;
      if (url.includes(r2Domain)) {
        finalUrl = url.replace(/^https?:\/\/pub-a1193e163fef41c9afc15d1334b8740b\.r2\.dev/, "/r2-proxy");
      } else if (!url.startsWith("http") && !url.startsWith("data:")) {
        finalUrl = window.location.origin + (url.startsWith("/") ? url : "/" + url);
      }

      try {
        const response = await fetch(finalUrl, { cache: 'no-cache' });
        if (!response.ok) return "";
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string || "");
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        return new Promise((resolve) => {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
             const canvas = document.createElement("canvas");
             canvas.width = img.width; canvas.height = img.height;
             const ctx = canvas.getContext("2d");
             ctx?.drawImage(img, 0, 0);
             resolve(canvas.toDataURL("image/jpeg", 0.7));
          };
          img.onerror = () => resolve("");
          img.src = finalUrl;
          setTimeout(() => resolve(""), 15000); // 15s timeout untuk gambar besar
        });
      }
    };

    const processHtmlLatexAndImages = async (htmlInput: string) => {
      if (!htmlInput) return "";
      
      // 1. Convert LaTeX to online images first
      let withLatexImages = htmlInput;
      
      // Handle display mode $$...$$ or \[...\]
      const displayRegex = /(\$\$|\\\[)([\s\S]*?)(\$\$|\\\])/g;
      withLatexImages = withLatexImages.replace(displayRegex, (_, _start, formula) => {
        const cleanFormula = formula.trim().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        return `<div style="text-align:center; margin: 10pt 0;"><img src="https://latex.codecogs.com/png.latex?\\dpi{150}\\bg_white ${encodeURIComponent(cleanFormula)}" alt="math" /></div>`;
      });

      // Handle inline mode $...$ or \(...\)
      const inlineRegex = /(\$|\\\()([\s\S]*?)(\$|\\\))/g;
      withLatexImages = withLatexImages.replace(inlineRegex, (_, _start, formula) => {
        // Skip if it is actually part of a display math that we already processed (unlikely but safe)
        const cleanFormula = formula.trim().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        return `<img src="https://latex.codecogs.com/png.latex?\\dpi{120}\\bg_white ${encodeURIComponent(cleanFormula)}" style="vertical-align:middle;" alt="math" />`;
      });
      
      const div = document.createElement('div');
      div.innerHTML = withLatexImages;
      
      // 2. Process all images (including the ones we just added) to Base64
      const imgs = div.getElementsByTagName('img');
      for (const imgTag of Array.from(imgs)) {
        const src = imgTag.getAttribute('src');
        if (src && !src.startsWith('data:')) {
          const b64 = await getBase64(src);
          if (b64) imgTag.setAttribute('src', b64);
          else imgTag.remove();
        }
      }
      return cleanForWord(div.innerHTML);
    };

    let html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
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
          <p style="font-size: 10pt; font-weight: normal;">Mata Pelajaran: ${exam?.subject || "-"} | Guru: ${exam?.teacherName || "-"}</p>
        </div>
        <table border="0" cellpadding="0" cellspacing="0" style="width:100%; font-size: 10pt; margin-bottom: 15pt; border: none; border-collapse: collapse;">
          <tr>
            <td width="15%" style="border:none; padding: 2px;">No. Peserta</td><td width="2%" style="border:none;">:</td><td width="33%" style="border:none; border-bottom: 0.5pt solid #000;"></td>
            <td width="15%" style="border:none; padding: 2px;">Kelas</td><td width="2%" style="border:none;">:</td><td style="border:none;">${exam?.level || "-"}</td>
          </tr>
          <tr>
            <td style="border:none; padding: 2px;">Nama Siswa</td><td>:</td><td style="border:none; border-bottom: 0.5pt solid #000;"></td>
            <td style="padding: 2px;">Hari/Tgl</td><td>:</td><td>..........................</td>
          </tr>
        </table>
    `;

    let currentGroupId = "";
    let keys = "";

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        setBatchProgress(prev => ({ ...prev, current: i + 1, message: `Memproses soal #${i + 1}...` }));

        if (q.groupId && q.groupId !== currentGroupId && q.groupText) {
            const cleanWacana = await processHtmlLatexAndImages(q.groupText || "");
            html += `<div class="wacana"><b>STIMULUS / BACAAN:</b><br/>${cleanWacana}</div>`;
            currentGroupId = q.groupId;
        }

        let qImg = "";
        if (q.imageUrl) {
          const b64 = await getBase64(q.imageUrl);
          if (b64) qImg = `<div style="margin: 5pt 0;"><img src="${b64}" /></div>`;
        }

        const processedQText = await processHtmlLatexAndImages(q.text || "");
        html += `<div class="hanging"><b>${i + 1}.</b> <span>${processedQText}</span>${qImg}</div>`;

        if (q.choices) {
            for (const letter of ['a', 'b', 'c', 'd', 'e']) {
                const c = (q.choices as any)[letter];
                if (c && c.text) {
                    let cImg = "";
                    if (c.imageUrl) {
                      const cb64 = await getBase64(c.imageUrl);
                      if (cb64) cImg = `<div style="margin: 3pt 0;"><img src="${cb64}" style="max-width: 150pt;" /></div>`;
                    }
                    const processedCText = await processHtmlLatexAndImages(c.text || "");
                    html += `<div class="choice">${letter.toUpperCase()}. <span>${processedCText}</span>${cImg}</div>`;
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
    const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const fileName = `${exam?.subject || "Ujian"} - ${exam?.teacherName || "Guru"} - ${dateStr}.doc`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();

    setBatchProgress(prev => ({ ...prev, isOpen: false }));
    addToast({ title: "Export Sukses", description: "Format sudah diperbaiki & Gambar diproses.", type: "success" });
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
              {(role === "admin" || exam?.teacherId === teacherId) && (
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
                              onClick={() => document.getElementById("excel-import-input")?.click()}
                            >
                              <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <FileSpreadsheet className="h-5 w-5" />
                              </div>
                              <div className="flex flex-col min-w-0 text-left">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Import dari Excel</span>
                                <span className="text-[10px] text-slate-400 mt-1">Gunakan template XLSX</span>
                              </div>
                            </DropdownMenuItem>

                            <DropdownMenuItem 
                              className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer group flex items-center gap-3"
                              onClick={() => document.getElementById("word-import-input")?.click()}
                            >
                              <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <FileText className="h-5 w-5" />
                              </div>
                              <div className="flex flex-col min-w-0 text-left">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Import dari Word</span>
                                <span className="text-[10px] text-slate-400 mt-1">Pilih file .docx standard</span>
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
                                onClick={downloadWordTemplateLiterasi} 
                                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                              >
                                <div className="h-10 w-10 shrink-0 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Template Word Literasi</span>
                                  <span className="text-[10px] text-slate-400 mt-1 text-left font-bold text-orange-600 dark:text-orange-400">BARU: Support Grup Soal</span>
                                </div>
                              </DropdownMenuItem>

                              <DropdownMenuItem 
                                onClick={() => window.open("/templates/Template_Soal_Tabel.docx")} 
                                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                              >
                                <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <FileSpreadsheet className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight tracking-tight">Template Word Tabel</span>
                                  <span className="text-[10px] text-slate-400 mt-1">Download format tabel standard</span>
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
                            <p className="text-sky-100 text-sm">Pelajari cara mengelompokkan soal berdasarkan wacana (AKM/Literasi).</p>
                          </div>
                          
                          <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-950">
                            <div className="space-y-4">
                              <h3 className="text-xl font-bold flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
                                <FileText className="h-6 w-6" />
                                1. Menggunakan Microsoft Word
                              </h3>
                              <div className="bg-emerald-50/50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 space-y-3">
                                <p className="text-sm text-slate-700 dark:text-slate-300">Tulis kata kunci <b className="text-emerald-600">LITERASI:</b> diikuti narasi Anda di luar tabel soal.</p>
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
                                  <span>Semua soal di bawah judul tsb akan otomatis menjadi satu grup literasi.</span>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                              <h3 className="text-xl font-bold flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
                                <FileSpreadsheet className="h-6 w-6" />
                                2. Menggunakan Excel
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
                            
                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/50 p-4 rounded-2xl">
                              <h4 className="text-xs font-bold text-orange-700 dark:text-orange-400 flex items-center gap-2 mb-1">
                                <Sparkles className="h-3.5 w-3.5" /> Tips Import Gambar
                              </h4>
                              <p className="text-[11px] text-orange-600 dark:text-orange-300 leading-normal">
                                Untuk Word, gambar di dalam wacana literasi harus diletakkan tepat di bawah judul LITERASI agar terbaca sempurna oleh sistem.
                              </p>
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
                        <Button
                          onClick={() => setBulkDeleteDialogOpen(true)}
                          variant="default"
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-950/40 dark:text-orange-400 dark:border dark:border-orange-800/40 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-2 h-9 px-4 text-xs"
                        >
                          <Trash className="h-3.5 w-3.5" />
                          Hapus ({selectedIds.length})
                        </Button>
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

                          <DropdownMenuItem 
                            onClick={handleBatchCreateClick}
                            className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                          >
                            <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Plus className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col min-w-0 text-left">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Tambah Batch</span>
                              <span className="text-[10px] text-slate-400 mt-1">Tambah banyak soal sekaligus</span>
                            </div>
                          </DropdownMenuItem>

                          <DropdownMenuItem 
                            onClick={() => setIsQuickPasteOpen(true)}
                            className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors group"
                          >
                            <div className="h-10 w-10 shrink-0 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Sparkles className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col min-w-0 text-left">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Paste dari Teks</span>
                              <span className="text-[10px] text-slate-400 mt-1">Copas soal dari web/dokumen</span>
                            </div>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
                          
                          {role === "admin" && (
                            <>
                              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-1.5 text-left">Kesejutan AI</DropdownMenuLabel>
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

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <FormField id="text" label="Pertanyaan" error={undefined}>
              <div className="bg-card rounded-md border flex flex-col">
                <ReactQuill
                  key={selectedQuestion ? `edit-${selectedQuestion.id}` : "create-main"}
                  ref={quillRef}
                  theme="snow"
                  value={formValues.text}
                  onChange={(content) => setFormValues({ ...formValues, text: content })}
                  placeholder="Tuliskan pertanyaan disini..."
                  modules={quillModules}
                  className="[&_.ql-editor]:min-h-[120px] [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b"
                />
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
                    Aktifkan Paket Wacana
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
                          setFormValues({ ...formValues, groupId: "", groupText: '<h2 style="text-align:center;">JUDUL WACANA</h2><p><br></p><p style="text-indent: 30px;">Tuliskan isi wacana di sini...</p>' });
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
                    
                    {/* 🔒 Pratinjau Terkunci (Read-Only) untuk Pilih Mode */}
                    {literasiMode === "select" && formValues.groupId && existingLiteracies[formValues.groupId] && (
                      <div className="mt-2 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          🔒 Wacana Terkunci (Hanya Edit di Soal #1 grup ini)
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

                      <FormField id="groupText" label="Teks Wacana / Cerita Literasi Baru" error={undefined}>
                        <div className="bg-card rounded-md border flex flex-col mt-1">
                          <ReactQuill
                            key={`group-create`}
                            theme="snow"
                            value={formValues.groupText || ""}
                            onChange={(content) => setFormValues({ ...formValues, groupText: content })}
                            placeholder="Ketikkan teks wacana literasi di sini..."
                            modules={quillModules}
                            className="[&_.ql-editor]:min-h-[100px] [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b"
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
                  {['a', 'b', 'c', 'd', 'e'].map((letter) => {
                    if (formValues.type === "benar_salah" && (letter !== 'a' && letter !== 'b')) return null;
                    
                    return (
                      <div key={letter} className={`p-3 border rounded-xl space-y-2 transition-all ${formValues.choices[letter].isCorrect ? "bg-green-50/30 border-green-200 dark:bg-green-950/10 dark:border-green-900/40" : "bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"}`}>
                        <div className="flex gap-3 items-center">
                          <div className="font-bold text-sm w-4">{letter.toUpperCase()}.</div>
                          <div className="bg-card rounded-md border flex-1">
                            <ReactQuill
                              key={selectedQuestion ? `edit-${selectedQuestion.id}-${letter}` : `create-${letter}`}
                              theme="snow"
                              value={formValues.choices[letter].text}
                              onChange={(content) => handleChoiceChange(letter, 'text', content)}
                              placeholder={`Jawaban ${letter.toUpperCase()} ...`}
                              modules={{
                                toolbar: [
                                  ['bold', 'italic', 'underline'],
                                  [{ 'color': [] }],
                                  ['clean']
                                ],
                              }}
                              className="[&_.ql-editor]:min-h-[42px] [&_.ql-editor]:py-2 [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:px-1 [&_.ql-toolbar]:py-0 [&_.ql-formats]:mr-1"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              className={`h-8 text-[10px] font-bold px-3 rounded-lg transition-all border flex items-center gap-1.5 focus-visible:ring-emerald-500/30 active:scale-95 ${
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
                          <div className="pl-7 pt-1 flex items-center gap-2">
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
                  {formValues.pairs.map((pair, idx) => (
                    <div key={pair.id} className="flex gap-2 items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800">
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
                  {formValues.items.map((item, idx) => (
                    <div key={item.id} className="flex gap-2 items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[10px]">
                        {idx + 1}
                      </div>
                      <Input
                        placeholder={`Item ke-${idx + 1}...`}
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
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="w-full text-xs h-8 border-dashed">
                    <Plus className="h-3 w-3 mr-1" /> Tambah Item
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl h-11 shadow-lg shadow-blue-500/20">{dialogMode === "edit" ? "Perbarui" : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Preview Soal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>

        <DialogContent className="max-w-3xl bg-card max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pratinjau Soal</DialogTitle>
          </DialogHeader>
          {previewQuestion && (
            <div className="mt-4 p-6 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm space-y-6 font-sans">
              <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                   <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-blue-200 dark:shadow-none">
                      {questions.findIndex(q => q.id === previewQuestion.id) + 1}
                   </div>
                   <span className="text-xs font-black uppercase tracking-widest text-slate-400">Pratinjau Lembar Ujian</span>
                </div>
                {previewQuestion.groupId && (
                  <span className="text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800/60 uppercase">
                    Paket: {previewQuestion.groupId}
                  </span>
                )}
              </div>

               {previewQuestion.groupId && (() => {
                const firstWithText = questions.find(q => q.groupId === previewQuestion.groupId && q.groupText);
                if (firstWithText) {
                  const textToShow = firstWithText.groupText || "";
                  const hasCover = firstWithText.imageUrl;

                  return (
                    <div className="bg-slate-50/50 dark:bg-slate-950/20 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 space-y-4 shadow-inner">
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                        <FileText className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Materi Literasi / Wacana</span>
                      </div>
                      
                      {hasCover && (
                        <div className="mb-4 group relative">
                          <SmartImage src={firstWithText.imageUrl} className="max-w-full md:max-w-lg h-auto mx-auto block rounded-xl border-4 border-white dark:border-slate-800 shadow-xl transition-transform group-hover:scale-[1.02]" alt="Cover Literasi" />
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                        </div>
                      )}
                      
                      <MathText 
                        content={textToShow}
                        className={`text-base sm:text-lg leading-relaxed text-slate-800 dark:text-slate-200 font-serif ql-editor !p-0 selection:bg-blue-100 dark:selection:bg-blue-900/40`} 
                      />
                    </div>
                  );
                }
                return null;
              })()}

              <div className="space-y-4">
                <MathText 
                  content={previewQuestion.text}
                  className={`ql-editor !p-0 font-medium text-lg text-slate-900 dark:text-white leading-relaxed break-words [&_strong]:text-blue-600 dark:[&_strong]:text-blue-400 [&_p]:mb-3 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-6 [&_ul]:pl-6 selection:bg-indigo-100 dark:selection:bg-indigo-900/40`} 
                />
                
                {previewQuestion.imageUrl && (
                  <div className="relative group">
                    <SmartImage src={previewQuestion.imageUrl} alt="Gambar Soal" className="max-w-full md:max-w-lg h-auto rounded-2xl border-4 border-white dark:border-slate-800 shadow-lg mx-auto" />
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/10 to-transparent pointer-events-none"></div>
                  </div>
                )}
              </div>
              
              <div className="pt-4 space-y-3">
                {(previewQuestion.type === "pilihan_ganda" || previewQuestion.type === "pilihan_ganda_kompleks" || previewQuestion.type === "benar_salah" || !previewQuestion.type) && Object.keys(previewQuestion.choices || {}).map((cKey, idx) => {
                  const choice = previewQuestion.choices![cKey];
                  if (!choice.text && !choice.imageUrl) return null;
                  
                  return (
                    <div 
                      key={cKey} 
                      className={`w-full text-left p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${
                        choice.isCorrect 
                          ? "bg-green-50/50 dark:bg-green-950/20 border-green-500/50 shadow-sm shadow-green-100 dark:shadow-none text-green-700 dark:text-green-400" 
                          : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className={`w-8 h-8 shrink-0 rounded-xl border-2 flex items-center justify-center font-bold text-sm ${
                        choice.isCorrect ? "bg-green-600 border-green-600 text-white shadow-lg shadow-green-200 dark:shadow-none" : "border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <div className="flex-1 text-sm md:text-base">
                        <MathText content={choice.text} className={`break-words ql-editor !p-0 [&_img]:max-w-[300px] [&_img]:h-auto [&_img]:rounded-xl [&_img]:mt-2 text-inherit ${choice.isCorrect ? "font-bold" : "font-normal"}`} />
                        {choice.imageUrl && (
                          <SmartImage src={choice.imageUrl} alt={`Pilihan ${cKey.toUpperCase()}`} className="max-h-[200px] w-auto rounded-xl mt-2 border shadow-sm" />
                        )}
                      </div>
                      {choice.isCorrect && (
                        <div className="bg-green-600 p-1 rounded-full shadow-lg">
                          <Check className="h-4 w-4 text-white shrink-0" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {previewQuestion.type === "menjodohkan" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-6 px-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> PERNYATAAN
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div> JAWABAN PASANGAN
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(previewQuestion.pairs || []).map(p => (
                        <div key={p.id} className="grid grid-cols-2 gap-4 items-center">
                          <div className="p-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                            {p.left}
                          </div>
                          <div className="p-3.5 rounded-2xl border-2 border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-950/20 text-sm font-black text-green-700 dark:text-green-400 shadow-sm flex items-center gap-2">
                            <ArrowLeft className="w-3 h-3 rotate-180 opacity-50" /> {p.right}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(previewQuestion.type === "isian_singkat" || previewQuestion.type === "uraian") && (
                  <div className="p-6 rounded-3xl border-2 border-dashed border-blue-200 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/10 space-y-3">
                    <div className="flex items-center gap-2">
                       <Check className="w-4 h-4 text-blue-600" />
                       <span className="text-[10px] font-black text-blue-600/70 dark:text-blue-400/70 uppercase tracking-widest">{previewQuestion.type === "isian_singkat" ? "Kunci Jawaban Otomatis" : "Pedoman Penilaian Guru"}</span>
                    </div>
                    <div className="text-lg font-black text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/40 shadow-sm">
                      {previewQuestion.answerKey || "(Belum diisi)"}
                    </div>
                  </div>
                )}

                {(previewQuestion.type === "urutkan" || previewQuestion.type === "drag_drop") && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Urutan Penyelesaian Benar</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {(previewQuestion.items || []).map((it, idx) => (
                        <div key={it.id} className="flex items-center gap-4 p-4 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm">
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-indigo-200 dark:shadow-none">{idx + 1}</div>
                          <span className="text-base font-bold text-indigo-700 dark:text-indigo-300">{it.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
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
                      <h3 className="text-sm font-black text-blue-900 dark:text-blue-100 uppercase tracking-tight">Wacana Stimulus Literasi</h3>
                      <p className="text-[10px] text-blue-700/60 dark:text-blue-400/60 font-bold uppercase tracking-widest">Wacana Induk untuk Paket Soal Ini</p>
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
                      // Update all questions in batch to share same wacana
                      const updatedBatch = batchQuestions.map(bq => ({ ...bq, groupText: content }));
                      setBatchQuestions(updatedBatch);
                    }}
                    placeholder="Tuliskan wacana literasi di sini..."
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
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pertanyaan Utama</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                    <ReactQuill
                      theme="snow"
                      value={q.text}
                      onChange={(content) => updateBatchItem(index, 'text', content)}
                      placeholder="Tuliskan pertanyaan disini..."
                      modules={{
                        toolbar: [
                          ['bold', 'italic', 'underline'],
                          [{ 'color': [] }],
                          ['clean']
                        ],
                      }}
                      className="[&_.ql-editor]:min-h-[80px] [&_.ql-editor]:py-3 [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:px-2 [&_.ql-toolbar]:py-1 [&_.ql-formats]:mr-1 text-sm"
                    />
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
                    <div className="flex flex-col gap-2.5">
                      {['a', 'b', 'c', 'd', 'e'].map(letter => {
                        if (!q.choices?.[letter]) return null;
                        const isCorrect = q.correctKey === letter;
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
                              onClick={() => updateBatchItem(index, 'correctKey', letter)}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all shadow-sm ${
                                isCorrect 
                                  ? "bg-emerald-600 text-white shadow-emerald-200" 
                                  : "bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                              }`}
                            >
                              {letter.toUpperCase()}
                            </button>
                            <div className="flex-1">
                              <input
                                type="text"
                                placeholder={`Teks Pilihan ${letter.toUpperCase()}...`}
                                value={q.choices[letter].text}
                                onChange={(e) => updateBatchChoice(index, letter, e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                              />
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
                  </div>
                )}

                {(q.type === "isian_singkat" || q.type === "uraian") && (
                  <div className="border-t pt-2">
                    <input
                      type="text"
                      placeholder={q.type === "isian_singkat" ? "Kunci Jawaban Singkat..." : "Pedoman Penilaian..."}
                      value={q.answerKey || ""}
                      onChange={(e) => updateBatchItem(index, 'answerKey', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-slate-800 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}
              </div>
            ))}

            <div className="flex justify-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={handleAddBatchRow} className="rounded-xl flex items-center gap-1 text-slate-600 dark:text-slate-400 text-xs h-9">
                <Plus className="h-3.5 w-3.5" /> Tambah Manual
              </Button>
              {role === "admin" && batchQuestions.some(q => q.isFromAI) && (
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
        <DialogContent className="max-w-3xl bg-card max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Galeri Media Ujian</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            {galleryImages.length === 0 ? (
              <div className="text-center p-8 text-slate-400 text-sm">Belum ada gambar yang bisa digunakan di ujian ini.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {galleryImages.map((src, idx) => (
                  <div
                    key={idx}
                    onClick={() => handlePickGallery(src)}
                    className="group relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-all bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-2 h-28"
                  >
                    <img src={src} alt="Media" className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <span className="text-white text-xs font-semibold bg-blue-600 px-2 py-1 rounded-md">Gunakan</span>
                    </div>
                  </div>
                ))}
              </div>
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
      {/* 📋 QUICK PASTE DIALOG */}
      <Dialog open={isQuickPasteOpen} onOpenChange={setIsQuickPasteOpen}>
        <DialogContent className="max-w-2xl bg-card border-none shadow-2xl p-0 overflow-hidden rounded-3xl">
          <div className="bg-orange-600 p-6 text-white flex items-center gap-4">
             <div className="bg-white/20 p-3 rounded-2xl">
               <Sparkles className="h-6 w-6 text-white" />
             </div>
             <div>
               <DialogTitle className="text-xl font-black uppercase tracking-tight text-white">Quick Paste Import</DialogTitle>
               <DialogDescription className="text-orange-100 text-xs font-bold uppercase tracking-wider">Tempel teks soal dari dokumen atau website Anda</DialogDescription>
             </div>
          </div>
          
          <div className="p-6 space-y-5 bg-white dark:bg-slate-900">
            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/40 p-4 rounded-2xl space-y-1.5">
               <p className="text-xs font-bold text-orange-700 dark:text-orange-300 flex items-center gap-1.5 uppercase tracking-widest">
                 <Check className="h-3.5 w-3.5" /> Panduan Format:
               </p>
               <p className="text-[10px] text-orange-600 dark:text-orange-400 font-medium leading-relaxed italic">
                 Pastikan soal memiliki nomor (1.), pilihan (A. B. C. D. E. atau A) B) C)), dan baris penutup kunci jawaban (misal: "Jawaban: A").
               </p>
            </div>

            <div className="relative group bg-slate-50 dark:bg-slate-800 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 overflow-hidden focus-within:ring-4 focus-within:ring-orange-500/10 focus-within:border-orange-500 transition-all">
              <ReactQuill
                theme="snow"
                value={quickPasteText}
                onChange={setQuickPasteText}
                placeholder={"Contoh:\n1. Siapa penemu lampu pijar?\nA. Thomas Alva Edison\nB. Isaac Newton\n...\nJawaban: A"}
                modules={{
                  toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'color': [] }],
                    ['clean']
                  ],
                }}
                className="quill-paste-area [&_.ql-editor]:min-h-[320px] [&_.ql-editor]:max-h-[500px] [&_.ql-editor]:overflow-y-auto [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:bg-orange-50/50 dark:[&_.ql-toolbar]:bg-slate-700/50"
              />
              {!quickPasteText.replace(/<[^>]*>/g, '').trim() && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 mt-10">
                   <div className="text-center">
                     <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Siap Menerima Teks Soal</p>
                   </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button variant="ghost" onClick={() => setIsQuickPasteOpen(false)} className="rounded-xl font-bold uppercase text-xs h-12">Batal</Button>
              <Button 
                onClick={handleQuickPasteParse} 
                disabled={!quickPasteText.trim()}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl h-12 font-black uppercase text-xs tracking-widest shadow-lg shadow-orange-200 dark:shadow-none transition-all active:scale-95"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Proses & Tinjau Sekarang
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🪄 MODAL GENERASI AI */}
      <Dialog open={isAIModalOpen} onOpenChange={setIsAIModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-none">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">AI Question Lab</DialogTitle>
                <div className="flex items-center gap-1.5 mt-1.5">
                   <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Mode:</p>
                   <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 text-[9px] font-black border border-indigo-100 dark:border-indigo-800 uppercase">
                      {AI_MODELS.find((m: any) => m.id === activeAIConfig.model)?.name || activeAIConfig.model} ({activeAIConfig.provider})
                   </span>
                </div>
              </div>
            </div>
            <Button 
              type="button"
              variant="outline" 
              size="sm" 
              onClick={handleRandomFill}
              className="rounded-xl flex items-center gap-2 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm h-10 px-4"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Acak</span>
            </Button>
          </div>

          <div className="p-6 space-y-5 bg-white dark:bg-slate-900 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField id="aiLevel" label="Jenjang / Kelas" error={undefined}>
                <Input
                  value={aiLevel}
                  onChange={(e) => setAiLevel(e.target.value)}
                  placeholder="Misal: Kelas 10 SMA"
                  className="rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 h-11 text-xs font-semibold"
                />
              </FormField>

              <FormField id="aiSubject" label="Mata Pelajaran" error={undefined}>
                <Input
                  value={aiSubject}
                  onChange={(e) => setAiSubject(e.target.value)}
                  placeholder="Misal: IPA"
                  className="rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 h-11 text-xs font-semibold"
                />
              </FormField>
            </div>

            <FormField id="aiTopic" label="Topik atau Materi Spesifik" error={undefined}>
              <textarea
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Misal: Dampak Pencemaran Plastik di Lautan..."
                className="w-full min-h-[100px] p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 text-xs resize-none font-medium text-slate-800 dark:text-white placeholder:text-slate-400"
              />
              {isFetchingSuggestions ? (
                <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest animate-pulse p-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <RefreshCw className="h-3 w-3 animate-spin text-indigo-500" /> Menganalisis kurikulum & materi...
                </div>
              ) : dynamicSuggestions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="flex items-center gap-2 w-full mb-1">
                    <Sparkles className="h-3 w-3 text-indigo-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block underline decoration-indigo-200 decoration-2 underline-offset-4">Rekomendasi Materi Berbasis AI :</span>
                  </div>
                  {dynamicSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAiTopic(String(suggestion))}
                      className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all font-sans shadow-sm hover:shadow"
                    >
                      {String(suggestion)}
                    </button>
                  ))}
                </div>
              )}
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField id="aiType" label="Tipe Soal" error={undefined}>
                <select
                  value={aiType}
                  onChange={(e) => setAiType(e.target.value)}
                  className="w-full h-11 px-3 rounded-2xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                >
                  {allowedTypes.pilihan_ganda && <option value="pilihan_ganda">Pilihan Ganda</option>}
                  {allowedTypes.pilihan_ganda_kompleks && <option value="pilihan_ganda_kompleks">PG Kompleks</option>}
                  {allowedTypes.benar_salah && <option value="benar_salah">Benar / Salah</option>}
                  {allowedTypes.isian_singkat && <option value="isian_singkat">Isian Singkat</option>}
                  {allowedTypes.uraian && <option value="uraian">Uraian / Essay</option>}
                </select>
              </FormField>

              <FormField id="aiCount" label="Jumlah Soal" error={undefined}>
                 <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-1 px-3 rounded-2xl h-11">
                    <button onClick={() => setAiCount(Math.max(1, aiCount - 1))} className="text-slate-400 hover:text-indigo-600 transition-colors font-bold text-lg">-</button>
                    <input 
                      type="number" 
                      value={aiCount} 
                      onChange={(e) => setAiCount(parseInt(e.target.value) || 1)}
                      className="w-full text-center bg-transparent font-black text-slate-800 dark:text-white outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button onClick={() => setAiCount(Math.min(20, aiCount + 1))} className="text-slate-400 hover:text-indigo-600 transition-colors font-bold text-lg">+</button>
                 </div>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField id="aiDifficulty" label="Tingkat Kesulitan" error={undefined}>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  {['mudah', 'sedang', 'sulit'].map((d) => (
                    <button
                      key={d}
                      onClick={() => setAiDifficulty(d)}
                      className={`py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${
                        aiDifficulty === d ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField id="aiFocus" label="Fokus Standar" error={undefined}>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  {['umum', 'akm', 'pisa'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setAiFocus(f)}
                      className={`py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${
                        aiFocus === f ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[9px] text-slate-500 italic font-medium leading-tight">
                  {focusDescriptions[aiFocus]}
                </p>
              </FormField>
            </div>
            <div className="flex flex-col gap-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/40">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Mode Literasi</p>
                  <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 leading-tight">AI akan membuatkan teks bacaan panjang sebelum soal.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={isAiLiteracy}
                    onChange={(e) => setIsAiLiteracy(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {isAiLiteracy && (
                <div className="pt-3 border-t border-indigo-100 dark:border-indigo-800/40 animate-in slide-in-from-top-2 duration-300">
                  <FormField id="aiPassageLength" label="Panjang Wacana" error={undefined}>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {['pendek', 'sedang', 'panjang'].map((len) => (
                        <button
                          key={len}
                          type="button"
                          onClick={() => setAiPassageLength(len)}
                          className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                            aiPassageLength === len 
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 dark:shadow-none' 
                              : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                          }`}
                        >
                          {len}
                        </button>
                      ))}
                    </div>
                  </FormField>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:gap-0 sm:flex-row p-0 pt-2 border-t border-slate-100 dark:border-slate-800">
               <Button
                variant="ghost"
                onClick={() => setIsAIModalOpen(false)}
                className="rounded-xl font-bold uppercase text-xs"
               >
                Batal
               </Button>
               <Button
                onClick={handleAIGenerate}
                disabled={isAIGenerating || !aiTopic.trim()}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-none font-bold uppercase text-xs group py-6"
               >
                {isAIGenerating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Menyusun naskah soal...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 group-hover:rotate-12 transition-transform" />
                    Mulai Generasi
                  </>
                )}
               </Button>
            </DialogFooter>
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
                <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">Smart AI Import</DialogTitle>
                <p className="text-xs text-slate-500 font-medium tracking-tight">Tempel teks dari PDF/Word, biarkan AI yang merapikannya.</p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6 scrollbar-thin">
            {parsedResults.length === 0 ? (
              <div className="space-y-5 animate-in fade-in duration-500">
                <div className="flex items-center gap-3">
                   <div className="relative flex-1">
                      <label className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-emerald-200 dark:border-emerald-800/40 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/10 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all group">
                        <Plus className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Pilih File PDF / Word</span>
                        <input type="file" className="hidden" accept=".pdf,.docx" onChange={handleFileUpload} disabled={isParsing} />
                      </label>
                   </div>
                   <div className="text-slate-400 text-xs font-bold">ATAU</div>
                   <div className="flex-1 text-[10px] text-slate-500 font-medium italic">
                     Tempel teks secara manual di kotak bawah ini
                   </div>
                </div>

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
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
                          <span>Buka PDF Anda, tekan <strong>Ctrl + A</strong> (Seleksi) lalu <strong>Ctrl + C</strong> (Salin).</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
                          <span>Tempelkan di kotak di bawah ini. AI akan mendeteksi soal & kunci jawaban.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                          <span>Teks wacana/stimulus pembuka akan otomatis dipisahkan (Mode Literasi).</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="relative group">
                  <textarea
                    className="w-full h-[400px] p-6 bg-slate-50/50 dark:bg-slate-900/40 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] text-xs font-mono focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none shadow-inner"
                    placeholder="Contoh: (1) PG : Siapakah proklamator Indonesia? a. Soeharto b. Soekarno* c. Habibie..."
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                  />
                  {!importText && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                      <div className="text-center">
                        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-400">Siap Menerima Teks Dokumen</p>
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
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2">
                             {q.choices && Object.entries(q.choices).map(([key, val]: [string, any]) => (
                               <div key={key} className={`p-2.5 rounded-xl border flex items-center gap-3 transition-all ${val.isCorrect ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                 <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black uppercase shrink-0 ${val.isCorrect ? 'bg-emerald-500 text-white shadow-md' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-800'}`}>
                                   {key}
                                 </div>
                                 <span className="text-[11px] font-semibold">{val.text}</span>
                                 {val.isCorrect && <Check className="w-3.5 h-3.5 ml-auto text-emerald-500 stroke-[3px]" />}
                               </div>
                             ))}
                           </div>
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
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-200/50 dark:shadow-none transition-all active:scale-95"
              >
                {isParsing ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Sedang Memilah Dokumen...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Analisis Dokumen Sekarang
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
      {/* Hidden inputs for imports moved here for reliability */}
      <input id="excel-import-input" type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleImportExcel(file);
        e.target.value = "";
      }} />
      <input id="word-import-input" type="file" className="hidden" accept=".docx" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleImportWord(file);
        e.target.value = "";
      }} />
    </div>
  </div>
);
};

export default QuestionsPage;


