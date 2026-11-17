import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Image,
  FolderOpen,
  Sparkles,
  ChevronRight,
  Layers,
  BookOpen,
  User,
  Hash,
  Eye,
  EyeOff,
  Loader2,
  Check,
  ChevronDown,
  X,
  Edit,
  Trash,
  Plus,
  Lock,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { ConfirmationDialog } from "../../components/dialogs/ConfirmationDialog";
import { QuestionTypeDispatcher, type HotspotArea } from "../../components/question-editors";
import { Input } from "../../components/ui/input";
import FormField from "../../components/forms/FormField";
import { NeonButton } from "../../components/ui/NeonButton";
import {
  uploadInventoryImage,
  safeDeleteImage,
  safeDeleteImages,
} from "../../lib/storage";
import { compressImage } from "../../lib/imageCompression";
import { SharedGalleryModal } from "../../components/dialogs/SharedGalleryModal";
import { EquationStudioModal } from "../../components/dialogs/EquationStudioModal";
import { AIChatQuestionDrawer } from "../../components/dialogs/AIChatQuestionDrawer";
import { insertImageIntoQuestionText } from "../../lib/imageSearch";
import { Select } from "../../components/ui/select";
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
import {
  type QuestionType,
  type QuestionData,
  QUESTION_TYPE_LABELS,
  mapRawQuestionToQuestionData,
  detectRumpangIds,
  hasUnbalancedRumpang,
} from "./questions/types";
import { QuestionPreviewDialog } from "./questions/dialogs/QuestionPreviewDialog";
import { MathText } from "../../components/ui/MathText";
import { sanitizeChoiceContent, cleanDeltaForChoice } from "../../lib/sanitizeChoice";
import { useExamData } from "../../context/ExamDataContext";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { useToast } from "../../components/ui/toast";
import { Card, CardContent } from "../../components/ui/card";


const QuestionFormPage = () => {
  const navigate = useNavigate();
  const { questionId } = useParams<{ questionId: string }>();
  const isEditMode = !!questionId;
  const [examId, setExamId] = useState<string | null>(() => sessionStorage.getItem("activeQuestionsExamId"));

  useEffect(() => {
    // Hanya redirect jika bukan mode edit dan examId tidak ada
    if (!isEditMode && !examId) {
      navigate("/admin/bank-soal", { replace: true });
    }
  }, [examId, isEditMode, navigate]);

  // Load question data in edit mode
  const [formLoading, setFormLoading] = useState(isEditMode);
  const [formLoadError, setFormLoadError] = useState("");

  const { user, role, teacherId } = useAuth();
  const { school, pb, terminology } = useTenant();
  const { addToast } = useToast();
  const { subjects, teachers, teacherFullAccess } = useExamData();

  useEffect(() => {
    if (!isEditMode || !questionId || !pb) return;
    let cancelled = false;
    (async () => {
      setFormLoading(true);
      setFormLoadError("");
      try {
        const raw: any = await pb.collection("questions").getOne(questionId);
        if (cancelled) return;

        const targetExamId = raw.examId || raw.exam_id;
        if (targetExamId) {
          setExamId(targetExamId);
          sessionStorage.setItem("activeQuestionsExamId", targetExamId);
        }

        const mapped = mapRawQuestionToQuestionData(raw);
        setSelectedQuestion(mapped);
        handleEditClick(mapped);
      } catch (e: any) {
        if (!cancelled) setFormLoadError(e?.message || "Gagal memuat soal.");
      } finally {
        if (!cancelled) setFormLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEditMode, questionId, pb]);

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

  useEffect(() => {
    const fetchSettings = async () => {
      if (!pb) return;
      try {
        const records = await pb.collection("settings").getFullList({ limit: 1 });
        if (records.length > 0) {
          const data = records[0];
          const types = data.allowed_types || data.allowed_question_types;
          if (types) setAllowedTypes(prev => ({ ...prev, ...types }));
        }
      } catch (e) {
        console.warn("Failed to fetch allowed types from settings:", e);
      }
    };
    fetchSettings();
  }, [pb]);

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);

  const dialogMode = isEditMode ? "edit" : "create";
  const questionNumberBadge = useMemo(() => {
    if (isEditMode) return "Edit Butir Soal";
    return questions.length > 0 ? `Soal #${questions.length + 1} (Baru)` : "Soal Baru";
  }, [isEditMode, questions.length]);

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
    statements?: Array<{ id: string; text: string; answer: "benar" | "salah" }>;
    matrixColumns: Array<{ id: string; text: string }>;
    matrixStatements: Array<{ id: string; text: string; answer: string }>;
    klasifikasiCategories: Array<{ id: string; text: string }>;
    klasifikasiStatements: Array<{ id: string; text: string; answer: string }>;
    klasifikasiShuffle: boolean;
    isianRumpangText: string;
    isianRumpangBlanks: Array<{ id: string; answersText: string; caseSensitive: boolean }>;
    hotspotImageUrl: string;
    hotspotMode: "any" | "all";
    hotspotAreas: HotspotArea[];
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
    items: [{ id: "1", text: "" }],
    statements: [
      { id: "1", text: "", answer: "benar" },
      { id: "2", text: "", answer: "salah" },
      { id: "3", text: "", answer: "benar" }
    ],
    matrixColumns: [
      { id: "c1", text: "" },
      { id: "c2", text: "" }
    ],
    matrixStatements: [
      { id: "s1", text: "", answer: "c1" },
      { id: "s2", text: "", answer: "c2" }
    ],
    klasifikasiCategories: [
      { id: "k1", text: "" },
      { id: "k2", text: "" }
    ],
    klasifikasiStatements: [
      { id: "s1", text: "", answer: "k1" },
      { id: "s2", text: "", answer: "k2" }
    ],
    klasifikasiShuffle: true,
    isianRumpangText: "",
    isianRumpangBlanks: [],
    hotspotImageUrl: "",
    hotspotMode: "any",
    hotspotAreas: []
  });

  const [isLiterasiActive, setIsLiterasiActive] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
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
  const [hotspotFile, setHotspotFile] = useState<File | null>(null);
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

    if (galleryTarget.type === "cover") {
      setFormValues((prev) => ({
        ...prev,
        text: insertImageIntoQuestionText(prev.text, url),
        imageUrl: ""
      }));
      setQuestionFile(null); // Reset file picker
      setCoverSizeInfo("");
    } else if (galleryTarget.type === "choice" && galleryTarget.letter) {
      const letter = galleryTarget.letter;
      handleChoiceChange(letter, "imageUrl", url);
      setChoiceFiles((prev) => ({ ...prev, [letter]: null }));
      setChoicesSizeInfo((prev) => ({ ...prev, [letter]: "(Dari Galeri)" }));

    } else if (galleryTarget.type === "hotspot") {
      setFormValues((prev) => ({ ...prev, hotspotImageUrl: url }));
      setHotspotFile(null);
    } else if (galleryTarget.type === "quill") {
      const q = galleryTarget.quillInstance || (galleryTarget.field === "text" ? quillRef.current?.getEditor() : null);
      const field = galleryTarget.field || "text";
      const letter = galleryTarget.letter;

      if (q) {
        const qLength = q.getLength();
        const targetIndex = galleryTarget.quillIndex !== undefined
          ? Math.min(Math.max(0, galleryTarget.quillIndex), qLength)
          : (q.getSelection()?.index ?? qLength);

        q.insertEmbed(targetIndex, "image", url, "user");

        const imgs = q.root.querySelectorAll('img');
        imgs.forEach((img: any) => {
          if (img.getAttribute('src') === url) {
            img.setAttribute('width', '350');
            img.style.display = 'block';
            img.style.margin = '12px auto';
            img.style.borderRadius = '12px';
            img.style.maxHeight = '340px';
            img.style.maxWidth = '100%';
            img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
          }
        });
        q.setSelection(targetIndex + 1, 0, "user");

        let updatedHtml = q.root.innerHTML;
        if (!updatedHtml.includes(url)) {
          if (field === "text") {
            updatedHtml = insertImageIntoQuestionText(formValues.text, url);
          } else if (field === "groupText") {
            updatedHtml = insertImageIntoQuestionText(formValues.groupText || "", url);
          } else if (field === "choice" && letter && formValues.choices?.[letter]) {
            updatedHtml = insertImageIntoQuestionText(formValues.choices[letter].text || "", url);
          }
        }

        if (field === "groupText") {
          setFormValues((prev) => ({ ...prev, groupText: updatedHtml }));
        } else if (field === "choice" && letter) {
          handleChoiceChange(letter, "text", updatedHtml);
        } else {
          setFormValues((prev) => ({ ...prev, text: updatedHtml }));
        }
      } else {
        if (field === "groupText") {
          setFormValues((prev) => ({ ...prev, groupText: insertImageIntoQuestionText(prev.groupText || "", url) }));
        } else if (field === "choice" && letter) {
          handleChoiceChange(letter, "text", insertImageIntoQuestionText(formValues.choices?.[letter]?.text || "", url));
        } else {
          setFormValues((prev) => ({ ...prev, text: insertImageIntoQuestionText(prev.text, url) }));
        }
      }
    }

    setIsGalleryOpen(false);
  };

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const globalFileInputRef = useRef<HTMLInputElement>(null);

  const handleGlobalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showAlert("Gagal", "Ukuran file gambar maksimal adalah 10MB.", "danger");
      return;
    }

    let fileToUpload = file;
    const origSize = formatSize(file.size);

    fileToUpload = await compressImage(file);
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

    } else if (galleryTarget.type === "hotspot") {
      setHotspotFile(fileToUpload);
      setFormValues((prev) => ({ ...prev, hotspotImageUrl: "" }));
    } else if (galleryTarget.type === "quill") {
      const q = galleryTarget.quillInstance || (galleryTarget.field === "text" ? quillRef.current?.getEditor() : null);
      const field = galleryTarget.field || "text";
      const letter = galleryTarget.letter;

      const reader = new FileReader();
      reader.readAsDataURL(fileToUpload);
      reader.onload = () => {
        const base64 = reader.result as string;
        if (q) {
          const qLength = q.getLength();
          const targetIndex = galleryTarget.quillIndex !== undefined
            ? Math.min(Math.max(0, galleryTarget.quillIndex), qLength)
            : (q.getSelection()?.index ?? qLength);

          q.insertEmbed(targetIndex, "image", base64, "user");

          const imgs = q.root.querySelectorAll('img');
          imgs.forEach((img: any) => {
            if (img.getAttribute('src') === base64) {
              img.setAttribute('width', '350');
              img.style.display = 'block';
              img.style.margin = '12px auto';
              img.style.borderRadius = '12px';
              img.style.maxHeight = '340px';
              img.style.maxWidth = '100%';
              img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
            }
          });
          q.setSelection(targetIndex + 1, 0, "user");

          let updatedHtml = q.root.innerHTML;
          if (!updatedHtml.includes(base64)) {
            if (field === "text") {
              updatedHtml = insertImageIntoQuestionText(formValues.text, base64);
            } else if (field === "groupText") {
              updatedHtml = insertImageIntoQuestionText(formValues.groupText || "", base64);
            } else if (field === "choice" && letter && formValues.choices?.[letter]) {
              updatedHtml = insertImageIntoQuestionText(formValues.choices[letter].text || "", base64);
            }
          }

          if (field === "groupText") {
            setFormValues((prev) => ({ ...prev, groupText: updatedHtml }));
          } else if (field === "choice" && letter) {
            handleChoiceChange(letter, "text", updatedHtml);
          } else {
            setFormValues((prev) => ({ ...prev, text: updatedHtml }));
          }
        } else {
          if (field === "groupText") {
            setFormValues((prev) => ({ ...prev, groupText: insertImageIntoQuestionText(prev.groupText || "", base64) }));
          } else if (field === "choice" && letter) {
            handleChoiceChange(letter, "text", insertImageIntoQuestionText(formValues.choices?.[letter]?.text || "", base64));
          } else {
            setFormValues((prev) => ({ ...prev, text: insertImageIntoQuestionText(prev.text, base64) }));
          }
        }
      };
    }

    setIsPickerOpen(false);
    if (globalFileInputRef.current) globalFileInputRef.current.value = "";
  };


  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const isSavingQuestionRef = useRef(false);
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false, title: "", description: "", type: "danger", onConfirm: null, confirmLabel: "OK", showCancel: true });

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" = "danger", onConfirm: any = null, showCancel: boolean = false, confirmLabel: string = "OK") => {
    setConfirmModal({
      isOpen: true,
      title,
      description,
      type,
      onConfirm,
      showCancel,
      confirmLabel
    });
  };

  const [isAIChatDrawerOpen, setIsAIChatDrawerOpen] = useState(false);

  const handleApplyAIQuestions = (generated: any[]) => {
    if (!generated || generated.length === 0) return;
    const q = generated[0];
    setFormValues((prev) => ({
      ...prev,
      text: q.text || prev.text,
      type: (q.type as QuestionType) || prev.type,
      choices: q.choices || prev.choices,
      answerKey: q.answerKey || q.correctKey || prev.answerKey,
      groupId: q.groupId || prev.groupId,
      groupText: q.groupText || prev.groupText,
    }));
    addToast({
      type: "success",
      title: "Soal AI Diterapkan",
      description: "Konten butir soal dari Asisten Chat AI berhasil disalin ke formulir.",
    });
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

      const mapped = loaded.map(q => mapRawQuestionToQuestionData(q));

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

    }
  }, [examId]);

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

      }
    };

    init();
  }, [examId, subjects, teachers, loadQuestions]);

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

  const isOwner = useMemo(() => {
    if (role === "admin") return true;
    if (teacherFullAccess) return true;
    if (!exam || (!teacherId && !user?.id)) return false;
    // Cek ID Guru (baru) atau ID Akun (lama) dan handle casing
    const examTeacherId = exam.teacherId || exam.teacherid;
    return examTeacherId === teacherId || examTeacherId === user?.id;
  }, [role, exam, teacherId, user, teacherFullAccess]);

  const isMgmpExam = useMemo(() => {
    if (!exam || !exam.subjectId || isOwner) return false;
    const subName = (exam.subjectName || exam.subject || subjects.find((s: any) => s.id === exam.subjectId)?.name || "").toLowerCase();
    return mySubjectIds.includes(exam.subjectId) || (Boolean(subName) && mySubjectIds.includes(subName));
  }, [exam, isOwner, mySubjectIds, subjects]);

  const canEdit = useMemo(() => {
    if (isOwner) return true;
    if (Boolean(exam?.is_mgmp_shared) && isMgmpExam) return true;
    return false;
  }, [isOwner, exam?.is_mgmp_shared, isMgmpExam]);

  // Akses melihat / mengedit: Guru hanya bisa jika pemilik asli ATAU rekan MGMP se-mapel
  const hasAccess = useMemo(() => {
    if (role === "admin") return true;
    if (teacherFullAccess) return true;
    if (!exam) return true;
    return isOwner || isMgmpExam;
  }, [role, teacherFullAccess, exam, isOwner, isMgmpExam]);

  const handleCreateClick = () => {
    setSelectedQuestion(null);
    setQuestionFile(null);
    setHotspotFile(null);
    setChoiceFiles({});
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
      items: [{ id: "1", text: "" }],
      statements: [
        { id: "1", text: "", answer: "benar" },
        { id: "2", text: "", answer: "salah" },
        { id: "3", text: "", answer: "benar" }
      ],
      matrixColumns: [
        { id: "c1", text: "" },
        { id: "c2", text: "" }
      ],
      matrixStatements: [
        { id: "s1", text: "", answer: "c1" },
        { id: "s2", text: "", answer: "c2" }
      ],
      klasifikasiCategories: [
        { id: "k1", text: "" },
        { id: "k2", text: "" }
      ],
      klasifikasiStatements: [
        { id: "s1", text: "", answer: "k1" },
        { id: "s2", text: "", answer: "k2" }
      ],
      klasifikasiShuffle: true,
      isianRumpangText: "",
      isianRumpangBlanks: [],
      hotspotImageUrl: "",
      hotspotMode: "any",
      hotspotAreas: []
    });
    setIsLiterasiActive(false);
    setLiterasiMode("select");
    setShowPreview(false);
  };

  const handleEditClick = (rawQ: QuestionData | any) => {
    const q = mapRawQuestionToQuestionData(rawQ);
    setSelectedQuestion(q);
    setQuestionFile(null);
    setHotspotFile(null);
    setChoiceFiles({});
    let initialText = wrapTablesForQuill(q.text || "");
    if (q.imageUrl && !initialText.includes(q.imageUrl)) {
      initialText = insertImageIntoQuestionText(initialText, q.imageUrl);
    }
    setFormValues({
      text: initialText,
      type: q.type || "pilihan_ganda",
      imageUrl: "",
      groupId: q.groupId || "",
      groupText: q.groupText || "",
      choices: {
        a: { text: q.choices?.a?.text || "", imageUrl: q.choices?.a?.imageUrl, isCorrect: !!q.choices?.a?.isCorrect },
        b: { text: q.choices?.b?.text || "", imageUrl: q.choices?.b?.imageUrl, isCorrect: !!q.choices?.b?.isCorrect },
        c: { text: q.choices?.c?.text || "", imageUrl: q.choices?.c?.imageUrl, isCorrect: !!q.choices?.c?.isCorrect },
        d: { text: q.choices?.d?.text || "", imageUrl: q.choices?.d?.imageUrl, isCorrect: !!q.choices?.d?.isCorrect },
        e: { text: q.choices?.e?.text || "", imageUrl: q.choices?.e?.imageUrl, isCorrect: !!q.choices?.e?.isCorrect },
        ...(q.choices || {})
      },
      pairs: q.pairs || [{ id: "1", left: "", right: "" }],
      answerKey: q.answerKey || "",
      items: q.items || [{ id: "1", text: "" }],
      statements: (q.type === "matriks" || q.type === "klasifikasi" ? undefined : (q.statements || (q.options?.statements ? q.options.statements : undefined))) || [
        { id: "1", text: "", answer: "benar" },
        { id: "2", text: "", answer: "salah" },
        { id: "3", text: "", answer: "benar" }
      ],
      matrixColumns: q.type === "matriks" ? (q.options?.columns || [
        { id: "c1", text: "" },
        { id: "c2", text: "" }
      ]) : [
        { id: "c1", text: "" },
        { id: "c2", text: "" }
      ],
      matrixStatements: q.options?.statements && q.type === "matriks" ? q.options.statements : [
        { id: "s1", text: "", answer: "c1" },
        { id: "s2", text: "", answer: "c2" }
      ],
      klasifikasiCategories: q.type === "klasifikasi" ? (q.options?.categories || [
        { id: "k1", text: "" },
        { id: "k2", text: "" }
      ]) : [
        { id: "k1", text: "" },
        { id: "k2", text: "" }
      ],
      klasifikasiStatements: q.type === "klasifikasi" ? (q.options?.statements || [
        { id: "s1", text: "", answer: "k1" },
        { id: "s2", text: "", answer: "k2" }
      ]) : [
        { id: "s1", text: "", answer: "k1" },
        { id: "s2", text: "", answer: "k2" }
      ],
      klasifikasiShuffle: q.type === "klasifikasi" ? (q.options?.shuffleStatements !== false) : true,
      isianRumpangText: q.type === "isian_rumpang" ? (q.options?.text || "") : "",
      isianRumpangBlanks: q.type === "isian_rumpang" ? ((q.options?.blanks || []).map((b: any) => ({
        id: String(b.id),
        answersText: (b.answers || []).join(", "),
        caseSensitive: !!b.caseSensitive
      })) || []) : [],
      hotspotImageUrl: q.type === "hotspot" ? (q.options?.imageUrl || "") : "",
      hotspotMode: q.type === "hotspot" ? (q.options?.mode === "all" ? "all" : "any") : "any",
      hotspotAreas: q.type === "hotspot" ? ((q.options?.areas || []).map((a: any) => ({
        id: String(a.id),
        x: Number(a.x) || 0,
        y: Number(a.y) || 0,
        w: Number(a.w) || 0,
        h: Number(a.h) || 0,
        label: a.label || ""
      })) || []) : []
    });
    // Deteksi apakah ini soal pertama di grupnya agar hanya soal #1 yang bisa edit teks literasi
    // (di halaman form, questions list tidak dimuat - default true)
    const groupItems = (typeof questions !== 'undefined' ? questions : []).filter((item: any) => q.groupId && item.groupId === q.groupId);
    const isFirstInGroup = groupItems.length > 0
      ? groupItems[0].id === q.id
      : true;

    setIsLiterasiActive(!!q.groupId);
    setLiterasiMode(isFirstInGroup && q.groupText ? "create" : "select");
    setShowPreview(false);
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

  // Convert base64 images in HTML to R2 URLs (compressed to webp) before saving
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

  const handleSubmit = async (e: any, stayOpen: boolean = false) => {
    e.preventDefault();
    if (!pb) return;
    if (!canEdit) {
      showAlert("Akses Ditolak", "Anda tidak memiliki izin untuk mengedit atau menambahkan butir soal pada bank soal ini.", "danger");
      return;
    }
    if (isSavingQuestionRef.current || isSavingQuestion) return; // Prevent double-click

    // 1. Validasi Teks Pertanyaan (teks ATAU gambar harus ada)
    const hasQuestionText = formValues.text && formValues.text.replace(/<[^>]*>/g, '').trim() !== "";
    const hasQuestionImage = !!formValues.imageUrl || !!questionFile || (formValues.text && formValues.text.includes("<img"));
    if (!hasQuestionText && !hasQuestionImage) {
      showAlert("Gagal", "Teks pertanyaan tidak boleh kosong.", "danger");
      return;
    }

    // 2. Validasi Jawaban berdasarkan tipe
    if (formValues.type === "pilihan_ganda" || formValues.type === "pilihan_ganda_kompleks") {
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
    } else if (formValues.type === "benar_salah") {
      const statements = formValues.statements || [];
      if (statements.length < 1 || statements.some(s => !s.text.trim())) {
        showAlert("Gagal", "Semua pernyataan Benar / Salah harus memiliki teks.", "danger");
        return;
      }
    } else if (formValues.type === "matriks") {
      const cols = formValues.matrixColumns || [];
      const stmts = formValues.matrixStatements || [];
      if (cols.length < 2 || cols.some(c => !c.text.trim())) {
        showAlert("Gagal", "Matriks membutuhkan minimal 2 kolom dan semua kolom harus memiliki nama.", "danger");
        return;
      }
      if (stmts.length < 1 || stmts.some(s => !s.text.trim())) {
        showAlert("Gagal", "Semua pernyataan Matriks harus memiliki teks.", "danger");
        return;
      }
      if (stmts.some(s => !cols.some(c => c.id === s.answer))) {
        showAlert("Gagal", "Setiap pernyataan Matriks harus memiliki kolom jawaban yang valid.", "danger");
        return;
      }
    } else if (formValues.type === "klasifikasi") {
      const cats = formValues.klasifikasiCategories || [];
      const stmts = formValues.klasifikasiStatements || [];
      if (cats.length < 2 || cats.some(c => !c.text.trim())) {
        showAlert("Gagal", "Klasifikasi membutuhkan minimal 2 kategori dan semua kategori harus memiliki nama.", "danger");
        return;
      }
      if (stmts.length < 1 || stmts.some(s => !s.text.trim())) {
        showAlert("Gagal", "Semua pernyataan Klasifikasi harus memiliki teks.", "danger");
        return;
      }
      if (stmts.some(s => !cats.some(c => c.id === s.answer))) {
        showAlert("Gagal", "Setiap pernyataan Klasifikasi harus memiliki kategori jawaban yang valid.", "danger");
        return;
      }
    } else if (formValues.type === "isian_rumpang") {
      const passage = (formValues.isianRumpangText || "").trim();
      if (!passage) {
        showAlert("Gagal", "Teks bacaan Isian Rumpang tidak boleh kosong.", "danger");
        return;
      }
      if (hasUnbalancedRumpang(passage)) {
        showAlert("Gagal", "Ada tanda [[ tanpa pasangan ]]. Periksa kembali penulisan rumpang.", "danger");
        return;
      }
      const detectedIds = detectRumpangIds(passage);
      if (detectedIds.length < 1) {
        showAlert("Gagal", "Tidak ada rumpang terdeteksi. Gunakan format [[1]], [[2]], dst.", "danger");
        return;
      }
      const blanks = formValues.isianRumpangBlanks || [];
      for (const id of detectedIds) {
        const b = blanks.find(x => x.id === id);
        const answers = (b?.answersText || "").split(",").map(a => a.trim()).filter(Boolean);
        if (answers.length < 1) {
          showAlert("Gagal", `Rumpang [[${id}]] belum memiliki kunci jawaban.`, "danger");
          return;
        }
      }
    } else if (formValues.type === "hotspot") {
      const areas = formValues.hotspotAreas || [];
      if (areas.length < 1) {
        showAlert("Gagal", "Hotspot membutuhkan minimal 1 area target.", "danger");
        return;
      }
      if (areas.some(a => !a.label.trim())) {
        showAlert("Gagal", "Semua area Hotspot harus memiliki label.", "danger");
        return;
      }
      if (!formValues.hotspotImageUrl && !hotspotFile) {
        showAlert("Gagal", "Hotspot membutuhkan gambar. Silakan upload gambar terlebih dahulu.", "danger");
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

    isSavingQuestionRef.current = true;
    setIsSavingQuestion(true);
    try {
      let imageUrl = formValues.imageUrl || "";
      let textToSave = autoDetectLatex(unwrapTablesForStorage(formValues.text));

      // Jika edit dan user hapus gambar (imageUrl dikosongkan, tidak ada file baru)
      if (dialogMode === "edit" && selectedQuestion?.imageUrl && !imageUrl && !questionFile) {
        const oldUrl = selectedQuestion.imageUrl;
        if (oldUrl && !oldUrl.startsWith("data:")) {
          safeDeleteImage(oldUrl, pb!, selectedQuestion.id); // fire & forget
        }
      }

      // 1. Upload file Cover Soal (dari tombol input file)
      if (questionFile) {
        const fileToUpload = await compressImage(questionFile);
        if (dialogMode === "edit" && selectedQuestion?.imageUrl) {
          const oldUrl = selectedQuestion.imageUrl;
          if (oldUrl && !oldUrl.startsWith("data:")) {
            safeDeleteImage(oldUrl, pb!, selectedQuestion.id); // fire & forget
          }
        }

        const schoolFolder = school?.slug || "unknown";
        const res = await uploadInventoryImage(`schools/${schoolFolder}/exams/${examId}`, fileToUpload);
        imageUrl = res.url;
      } else if (imageUrl) {
        imageUrl = await localizeImage(imageUrl, "cover_manual");
      }

      // 1b. Upload file Gambar Hotspot (dari tombol input file / galeri)
      let hotspotImageUrl = formValues.hotspotImageUrl || "";
      if (formValues.type === "hotspot") {
        if (hotspotFile) {
          const fileToUpload = await compressImage(hotspotFile);
          const schoolFolder = school?.slug || "unknown";
          const res = await uploadInventoryImage(`schools/${schoolFolder}/exams/${examId}`, fileToUpload);
          hotspotImageUrl = res.url;
        } else if (hotspotImageUrl) {
          hotspotImageUrl = await localizeImage(hotspotImageUrl, "hotspot_manual");
        }
      }

      // 2. Hapus gambar R2 yang dihapus dari teks Quill (diff lama vs baru)
      if (dialogMode === "edit" && selectedQuestion?.text) {
        const extractR2Urls = (html: string) => {
          const doc = new DOMParser().parseFromString(html, "text/html");
          return Array.from(doc.querySelectorAll("img"))
            .map(img => img.getAttribute("src") || "")
            .filter(src => src && !src.startsWith("data:"));
        };
        const oldUrls = new Set(extractR2Urls(selectedQuestion.text));
        const newUrls = new Set(extractR2Urls(textToSave));
        const removedUrls = [...oldUrls].filter(url => !newUrls.has(url));
        if (removedUrls.length > 0) {
          safeDeleteImages(removedUrls, pb!, selectedQuestion.id); // fire & forget
        }
      }

      // 3. Scan teks Soal untuk remote & base64 inline images
      textToSave = await localizeInlineImages(textToSave);

      // 3. Upload file Pilihan Manual ke R2
      const updatedChoices = JSON.parse(JSON.stringify(formValues.choices));
      for (const key in choiceFiles) {
        const file = choiceFiles[key];
        if (file) {
          const fileToUpload = await compressImage(file);
          if (dialogMode === "edit" && selectedQuestion?.choices?.[key]?.imageUrl) {
            const oldUrl = selectedQuestion.choices[key].imageUrl!;
            if (oldUrl && !oldUrl.startsWith("data:")) {
              safeDeleteImage(oldUrl, pb!, selectedQuestion.id); // fire & forget
            }
          }
          const schoolFolder = school?.slug || "unknown";
          const res = await uploadInventoryImage(`schools/${schoolFolder}/exams/${examId}`, fileToUpload);
          updatedChoices[key].imageUrl = res.url;
        }
      }

      // 4. Scan teks Pilihan untuk remote & base64 images
      await Promise.allSettled(Object.keys(updatedChoices).map(async (key) => {
        const choice = updatedChoices[key];
        if (choice.imageUrl) {
          choice.imageUrl = await localizeImage(choice.imageUrl, `choice_manual_${key}`);
        } else if (!choice.imageUrl) {
          delete choice.imageUrl;
        }
        if (choice.text) {
          choice.text = sanitizeChoiceContent(choice.text);
          choice.text = await localizeInlineImages(choice.text);
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
        drag_drop: "drag_drop",
        klasifikasi: "klasifikasi",
        hotspot: "hotspot",
        isian_rumpang: "isian_rumpang",
        matriks: "matriks"
      };

      const payload: any = {
        examId: examId || selectedQuestion?.examId || (exam && exam.id) || "",
        text: textToSave,
        field: typeMap[formValues.type] || "multiple_choice",
        options: {},
        correctAnswer: "",
        order: selectedQuestion?.order || (questions.reduce((max, q) => Math.max(max, q.order || 0), 0) + 1)
      };

      if (formValues.type === "pilihan_ganda" || formValues.type === "pilihan_ganda_kompleks") {
        payload.options = updatedChoices;
        const correctOnes = Object.keys(updatedChoices).filter(k => updatedChoices[k].isCorrect);
        payload.correctAnswer = correctOnes.join(",");
      } else if (formValues.type === "benar_salah") {
        const validStatements = (formValues.statements || []).filter(s => s.text.trim());
        payload.options = { statements: validStatements };
        payload.correctAnswer = validStatements.map(s => `${s.id}:${s.answer}`).join(",");
      } else if (formValues.type === "isian_rumpang") {
        const passage = (formValues.isianRumpangText || "").trim();
        const detectedIds = detectRumpangIds(passage);
        const blanks = (formValues.isianRumpangBlanks || []).filter(b => detectedIds.includes(b.id));
        payload.options = {
          text: passage,
          blanks: blanks.map(b => ({
            id: b.id,
            answers: b.answersText.split(",").map(a => a.trim()).filter(Boolean),
            caseSensitive: !!b.caseSensitive
          }))
        };
        payload.correctAnswer = blanks.map(b => `${b.id}:${b.answersText.trim()}`).join(" | ");
      } else if (formValues.type === "hotspot") {
        const validAreas = (formValues.hotspotAreas || []).filter(a => a.label.trim()).map(a => ({
          id: a.id,
          x: a.x,
          y: a.y,
          w: a.w,
          h: a.h,
          label: a.label.trim()
        }));
        payload.options = {
          imageUrl: hotspotImageUrl,
          mode: formValues.hotspotMode || "any",
          areas: validAreas
        };
        payload.correctAnswer = validAreas.map(a => a.label).join(", ");
      } else if (formValues.type === "matriks") {
        const validColumns = (formValues.matrixColumns || []).filter(c => c.text.trim());
        const validStatements = (formValues.matrixStatements || []).filter(s => s.text.trim()).map(s => ({
          id: s.id,
          text: s.text.trim(),
          answer: validColumns.some(c => c.id === s.answer) ? s.answer : (validColumns[0]?.id || "")
        }));
        payload.options = { columns: validColumns, statements: validStatements };
        payload.correctAnswer = validStatements.map(s => `${s.id}:${s.answer}`).join(",");
      } else if (formValues.type === "klasifikasi") {
        const validCategories = (formValues.klasifikasiCategories || []).filter(c => c.text.trim());
        const validStatements = (formValues.klasifikasiStatements || []).filter(s => s.text.trim()).map(s => ({
          id: s.id,
          text: s.text.trim(),
          answer: validCategories.some(c => c.id === s.answer) ? s.answer : (validCategories[0]?.id || "")
        }));
        payload.options = {
          categories: validCategories,
          statements: validStatements,
          shuffleStatements: !!formValues.klasifikasiShuffle
        };
        payload.correctAnswer = validStatements.map(s => `${s.id}:${s.answer}`).join(",");
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

      // LITERASI (Fix Save Logic + Dual Convention)
      if (isLiterasiActive) {
        const gid = formValues.groupId || "";
        let gtxt = formValues.groupText || "";

        // Localize remote & base64 images in groupText
        gtxt = await localizeInlineImages(gtxt);

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

      console.log("Menempelkan Payload Soal (Dual Format):", payload);

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

        showAlert("Berhasil", "Soal berhasil diperbarui.", "success");
        navigate("/admin/bank-soal/questions");
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
          setHotspotFile(null);
          setChoiceFiles({});
        } else {
          navigate("/admin/bank-soal/questions");
        }
      }
    } catch (error: any) {
      console.error("Gagal menyimpan soal:", error);
      showAlert("Gagal", error?.message || "Gagal menyimpan soal ke PocketBase.", "danger");
    } finally {
      isSavingQuestionRef.current = false;
      setIsSavingQuestion(false);
    }
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
      addToast({ title: "Berhasil", description: `Paket literasi diubah dari "${oldGroupId}"  "${newGroupId.trim()}".`, type: "success" });
      setIsRenamingLiterasi(false);
      setFormValues(prev => ({ ...prev, groupId: newGroupId.trim() }));
      loadQuestions();
    } catch (e) {
      addToast({ title: "Gagal", description: "Gagal mengubah nama paket literasi.", type: "error" });
    }
  };

  // Proteksi Akses: Guru tidak bisa melihat/mengedit bank soal milik guru lain kecuali MGMP
  if (exam && !hasAccess) {
    return (
      <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] flex items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">Akses Terbatas</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Anda tidak memiliki izin untuk mengedit bank soal ini. Guru hanya dapat melihat atau mengedit bank soal miliknya sendiri atau rekan guru se-mapel (MGMP).
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin/bank-soal")}
            className="w-full cursor-pointer"
          >
            Kembali ke Bank Soal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-neutral-50/50 dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans pb-32">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
        {/* ── Top Bar: Back, Breadcrumbs, Title, Metadata Pills, Top Actions ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800 relative z-30">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs cursor-pointer"
              onClick={() => {
                if (examId) sessionStorage.setItem("activeQuestionsExamId", examId);
                navigate("/admin/bank-soal/questions");
              }}
              title="Kembali ke daftar butir soal"
              aria-label="Kembali ke daftar butir soal"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0 space-y-1">
              {/* Breadcrumbs Row */}
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => navigate("/admin/bank-soal")}
                  className="hover:text-neutral-800 dark:hover:text-neutral-200 font-medium transition-colors shrink-0 cursor-pointer"
                >
                  Bank Soal
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => {
                    if (examId) sessionStorage.setItem("activeQuestionsExamId", examId);
                    navigate("/admin/bank-soal/questions");
                  }}
                  className="hover:text-neutral-800 dark:hover:text-neutral-200 font-medium transition-colors truncate max-w-[200px] sm:max-w-xs shrink-0 cursor-pointer"
                  title={exam?.title || "Daftar Soal"}
                >
                  {exam?.title || "Daftar Soal"}
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 shrink-0">
                  {dialogMode === "edit" ? "Edit Butir Soal" : "Tambah Butir Soal"}
                </span>
              </nav>

              {/* Title + Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 truncate">
                  {dialogMode === "edit" ? "Edit Butir Soal" : "Tambah Butir Soal"}
                </h1>

                {/* Mode & Number Badge */}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${dialogMode === "edit"
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/50"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dialogMode === "edit" ? "bg-amber-500" : "bg-indigo-500"}`} />
                  {questionNumberBadge}
                </span>

                {/* Dynamic Question Type Pill */}
                {QUESTION_TYPE_LABELS[formValues.type] && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-700/80">
                    <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    {QUESTION_TYPE_LABELS[formValues.type]}
                  </span>
                )}

                {exam?.subject && (
                  <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                    <BookOpen className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate max-w-[160px]">{exam.subject}</span>
                  </span>
                )}

                {exam?.teacherName && (
                  <span className="hidden lg:inline-flex items-center gap-1 text-xs text-neutral-500">
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[140px]">{exam.teacherName}</span>
                  </span>
                )}

                {questions.length > 0 && (
                  <span className="hidden xl:inline-flex items-center gap-1 text-xs text-neutral-400">
                    <Hash className="w-3 h-3 shrink-0" />
                    Total {questions.length} soal
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions Toolbar */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {/* ASISTEN AI CHAT BUTTON - Tersedia untuk SEMUA Guru & Admin */}
            {(role === "admin" || role === "teacher") && (
              <NeonButton
                variant="outline"
                color="brand"
                size="sm"
                onClick={() => setIsAIChatDrawerOpen(true)}
                className="h-9 gap-1.5"
                title="Buka Asisten Chat AI untuk membuat atau memperbaiki butir soal"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Chat AI</span>
              </NeonButton>
            )}

            {/* Preview Toggle Button */}
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={`inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border transition-all shadow-2xs active:scale-95 cursor-pointer ${showPreview
                ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20"
                : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              title={showPreview ? "Matikan pratinjau tampilan ujian siswa" : "Aktifkan pratinjau tampilan ujian siswa"}
              aria-pressed={showPreview}
            >
              {showPreview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-neutral-400" />}
              <span>{showPreview ? "Pratinjau: ON" : "Pratinjau: OFF"}</span>
            </button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (examId) sessionStorage.setItem("activeQuestionsExamId", examId);
                navigate("/admin/bank-soal/questions");
              }}
              className="h-9 px-3.5 rounded-lg text-xs font-semibold border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            >
              Batal
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={(e) => handleSubmit(e, false)}
              disabled={isSavingQuestion}
              className="h-9 px-4 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs shadow-indigo-500/20 cursor-pointer"
              title="Simpan butir soal"
            >
              {isSavingQuestion ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  <span>{dialogMode === "edit" ? "Perbarui" : "Simpan"}</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── Form Content Card ── */}
        {formLoading ? (
          <div className="flex items-center justify-center py-24 bg-white dark:bg-[#0f1115] rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <span className="ml-3 text-sm text-neutral-500">Memuat data soal...</span>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0f1115] rounded-2xl border border-neutral-200/90 dark:border-neutral-800 shadow-xs overflow-hidden">
            <form onSubmit={(e) => handleSubmit(e, false)} className="flex flex-col">
              {/* Form Body with Natural Flow & Proper Gaps */}
              <div className="p-5 sm:p-7 space-y-6">
                {/* Row 1: Pengaturan Tipe Soal & Stimulus Literasi */}
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shadow-2xs overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-800">
                    {/* Kolom Kiri: Jenis / Tipe Soal */}
                    <div className="p-4 sm:p-5 space-y-2 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <label htmlFor="type" className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Jenis / Tipe Soal</span>
                        </label>
                        <span className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Format Jawaban</span>
                      </div>

                      <div className="relative">
                        <select
                          id="type"
                          value={formValues.type}
                          onChange={(e) => {
                            const newType = e.target.value as QuestionType;
                            setFormValues(prev => ({
                              ...prev,
                              type: newType,
                              statements: newType === "benar_salah" && (!prev.statements || prev.statements.length === 0) ? [
                                { id: "1", text: "", answer: "benar" },
                                { id: "2", text: "", answer: "salah" },
                                { id: "3", text: "", answer: "benar" }
                              ] : prev.statements,
                              matrixColumns: newType === "matriks" && (!prev.matrixColumns || prev.matrixColumns.length === 0) ? [
                                { id: "c1", text: "" },
                                { id: "c2", text: "" }
                              ] : prev.matrixColumns,
                              matrixStatements: newType === "matriks" && (!prev.matrixStatements || prev.matrixStatements.length === 0) ? [
                                { id: "s1", text: "", answer: "c1" },
                                { id: "s2", text: "", answer: "c2" }
                              ] : prev.matrixStatements,
                              klasifikasiCategories: newType === "klasifikasi" && (!prev.klasifikasiCategories || prev.klasifikasiCategories.length === 0) ? [
                                { id: "k1", text: "" },
                                { id: "k2", text: "" }
                              ] : prev.klasifikasiCategories,
                              klasifikasiStatements: newType === "klasifikasi" && (!prev.klasifikasiStatements || prev.klasifikasiStatements.length === 0) ? [
                                { id: "s1", text: "", answer: "k1" },
                                { id: "s2", text: "", answer: "k2" }
                              ] : prev.klasifikasiStatements,
                              isianRumpangText: newType === "isian_rumpang" && !prev.isianRumpangText ? "Ibu kota Indonesia adalah [[1]] dan mata uangnya [[2]]." : prev.isianRumpangText,
                              isianRumpangBlanks: newType === "isian_rumpang" && (!prev.isianRumpangBlanks || prev.isianRumpangBlanks.length === 0) ? [
                                { id: "1", answersText: "", caseSensitive: false },
                                { id: "2", answersText: "", caseSensitive: false }
                              ] : prev.isianRumpangBlanks
                            }));
                          }}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold h-10 px-3 pr-8 cursor-pointer text-slate-800 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                        >
                          {(allowedTypes.pilihan_ganda !== false || formValues.type === "pilihan_ganda") && <option value="pilihan_ganda">Pilihan Ganda (Single Choice)</option>}
                          {(allowedTypes.pilihan_ganda_kompleks !== false || formValues.type === "pilihan_ganda_kompleks") && <option value="pilihan_ganda_kompleks">Pilihan Ganda Kompleks (Multi Response)</option>}
                          {(allowedTypes.menjodohkan !== false || formValues.type === "menjodohkan") && <option value="menjodohkan">Menjodohkan (Matching)</option>}
                          {(allowedTypes.benar_salah !== false || formValues.type === "benar_salah") && <option value="benar_salah">Benar / Salah (Matriks ANBK)</option>}
                          {(allowedTypes.isian_singkat !== false || formValues.type === "isian_singkat") && <option value="isian_singkat">Isian Singkat</option>}
                          {(allowedTypes.uraian !== false || formValues.type === "uraian") && <option value="uraian">Uraian / Esai</option>}
                          {(allowedTypes.urutkan !== false || formValues.type === "urutkan") && <option value="urutkan">Urutkan (Ordering)</option>}
                          {(allowedTypes.drag_drop !== false || formValues.type === "drag_drop") && <option value="drag_drop">Drag and Drop</option>}
                          {(allowedTypes.klasifikasi !== false || formValues.type === "klasifikasi") && <option value="klasifikasi">Klasifikasi (Pengelompokan Kategori)</option>}
                          {(allowedTypes.matriks !== false || formValues.type === "matriks") && <option value="matriks">Matriks (Tabel Pilihan Ganda)</option>}
                          {(allowedTypes.isian_rumpang !== false || formValues.type === "isian_rumpang") && <option value="isian_rumpang">Isian Rumpang (Cloze)</option>}
                          {(allowedTypes.hotspot !== false || formValues.type === "hotspot") && <option value="hotspot">Hotspot (Klik Gambar)</option>}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                        Pilih format lembar jawaban siswa yang sesuai.
                      </p>
                    </div>

                    {/* Kolom Kanan: Paket Stimulus / Literasi */}
                    <div className="p-4 space-y-2 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Paket Stimulus / Literasi</span>
                        </label>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border transition-colors ${isLiterasiActive
                          ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                          : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                          }`}>
                          {isLiterasiActive ? "TERHUBUNG" : "MANDIRI"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const next = !isLiterasiActive;
                          setIsLiterasiActive(next);
                          if (!next) {
                            setFormValues({ ...formValues, groupId: "", groupText: "" });
                          }
                        }}
                        className={`w-full h-10 px-3 rounded-lg border text-left flex items-center justify-between transition-all shadow-xs ${isLiterasiActive
                          ? "bg-blue-50/90 border-blue-300 dark:bg-blue-950/50 dark:border-blue-800 text-blue-900 dark:text-blue-200"
                          : "bg-white hover:bg-slate-50 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                          }`}
                      >
                        <span className="text-xs font-semibold">
                          {isLiterasiActive ? "Stimulus Aktif (Literasi Bersama)" : "Nonaktif (Soal Mandiri)"}
                        </span>
                        <div className={`w-9 h-5 rounded-full transition-colors flex items-center p-0.5 shrink-0 ${isLiterasiActive ? "bg-blue-600 justify-end" : "bg-slate-300 dark:bg-slate-600 justify-start"
                          }`}>
                          <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                        </div>
                      </button>

                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                        Hubungkan soal dengan bahan bacaan atau literasi bersama.
                      </p>
                    </div>
                  </div>

                  {/* Sub-Card Stimulus / Literasi jika aktif */}
                  {isLiterasiActive && (
                    <div className="p-4 border-t border-blue-200/80 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/25 space-y-3.5">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-800 dark:text-blue-300 block">
                          Pilih / Hubungkan Paket Literasi
                        </label>
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
                          className="bg-white dark:bg-slate-800 w-full rounded-lg border border-slate-300 dark:border-slate-700 text-sm h-10 px-3 cursor-pointer text-slate-800 dark:text-slate-200 shadow-xs"
                        >
                          <option value="">-- Pilih Paket Literasi yang Sudah Ada --</option>
                          {Object.keys(existingLiteracies).map((key) => (
                            <option key={key} value={key}>{key}</option>
                          ))}
                          <option value="NEW_LITERASI" className="font-bold text-blue-600 dark:text-blue-400">+ Buat Literasi Baru</option>
                        </select>

                        {/* Tombol Rename & Hapus Literasi */}
                        {literasiMode === "select" && formValues.groupId && formValues.groupId !== "NEW_LITERASI" && existingLiteracies[formValues.groupId] && (
                          <div className="flex items-center gap-2 pt-1">
                            {isRenamingLiterasi ? (
                              <div className="flex items-center gap-1.5 flex-1">
                                <Input
                                  value={renameLiterasiValue}
                                  onChange={(e) => setRenameLiterasiValue(e.target.value)}
                                  placeholder="Nama baru..."
                                  className="h-8 text-xs rounded-lg flex-1"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRenameLiterasi(formValues.groupId || "", renameLiterasiValue);
                                    if (e.key === "Escape") setIsRenamingLiterasi(false);
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRenameLiterasi(formValues.groupId || "", renameLiterasiValue)}
                                  className="h-8 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-bold border border-emerald-200 dark:border-emerald-800/40 transition-colors"
                                >
                                  <Check size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsRenamingLiterasi(false)}
                                  className="h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                                >
                                  <X size={13} />
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
                                  className="h-7 px-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1 border border-amber-200/80 dark:border-amber-800/40 transition-colors"
                                >
                                  <Edit size={12} /> Ganti Nama
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLiterasi(formValues.groupId || "")}
                                  className="h-7 px-2.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1 border border-rose-200/80 dark:border-rose-800/40 transition-colors"
                                >
                                  <Trash size={12} /> Hapus Paket
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Pratinjau Terkunci */}
                        {literasiMode === "select" && formValues.groupId && existingLiteracies[formValues.groupId] && (
                          <div className="mt-2 bg-white dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 flex flex-col gap-1.5 shadow-xs">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              Pratinjau Literasi Terpilih (Read-Only)
                            </span>
                            <div className="max-h-36 overflow-y-auto pr-1">
                              <MathText
                                content={existingLiteracies[formValues.groupId]}
                                className="text-xs text-slate-700 dark:text-slate-300 [&_img]:max-w-[40px] leading-relaxed [&_table]:!w-full [&_table]:!table [&_table]:!text-[10px] [&_td]:!p-1 [&_th]:!p-1"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {literasiMode === "create" && (
                        <div className="space-y-3 pt-2 border-t border-blue-100 dark:border-blue-900/40">
                          <div>
                            <label className="text-xs font-bold text-blue-900 dark:text-blue-300 block mb-1">
                              Kode / Identitas Literasi Baru
                            </label>
                            <Input
                              placeholder="Contoh: literasi-gunung-merapi"
                              value={formValues.groupId === "NEW_LITERASI" ? "" : formValues.groupId}
                              onChange={(e) => setFormValues({ ...formValues, groupId: e.target.value })}
                              className="bg-card rounded-lg border text-sm h-10 shadow-xs"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-blue-900 dark:text-blue-300 block mb-1">
                              Isi Teks Stimulus / Literasi
                            </label>
                            <div className="bg-card rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                              <ReactQuill
                                key={`group-create`}
                                theme="snow"
                                value={formValues.groupText || ""}
                                onChange={(content, _delta, source) => {
                                  if (source !== 'user') return;
                                  setFormValues(prev => ({ ...prev, groupText: content }));
                                }}
                                placeholder="Ketikkan teks stimulus / literasi di sini..."
                                modules={quillModules}
                                formats={quillFormats}
                                className="[&_.ql-editor]:min-h-[180px] [&_.ql-editor_p]:leading-[1.8] [&_.ql-editor_p]:text-justify [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:overflow-x-auto"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Row 2: Editor Pertanyaan Utama */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="text" className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <span>Pertanyaan Utama</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500 hidden sm:inline">
                      Mendukung rumus LaTeX, teks kaya, dan tabel
                    </span>
                  </div>

                  <div className="bg-white dark:bg-[#0c0d0e] rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-2xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all flex flex-col">
                    <ReactQuill
                      key={selectedQuestion ? `edit-${selectedQuestion.id}` : "create-main"}
                      ref={quillRef}
                      theme="snow"
                      value={formValues.text}
                      onChange={(content, _delta, source) => {
                        if (source !== 'user') return;
                        setFormValues(prev => ({ ...prev, text: content }));
                      }}
                      placeholder="Tuliskan pertanyaan disini..."
                      modules={quillModules}
                      formats={quillFormats}
                      className="[&_.ql-editor]:min-h-[140px] [&_.ql-editor]:text-base [&_.ql-editor]:p-4 [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-neutral-200 dark:[&_.ql-toolbar]:border-neutral-800 [&_.ql-toolbar]:bg-neutral-50/70 dark:[&_.ql-toolbar]:bg-neutral-900/50 [&_.ql-toolbar]:px-3 [&_.ql-toolbar]:py-2 [&_.ql-toolbar]:overflow-x-auto"
                    />

                    {/* Pratinjau Tampilan (Sesuai Ujian) - Muncul jika showPreview === true */}
                    {showPreview && (
                      <div className="p-4 bg-indigo-50/30 dark:bg-slate-900/60 border-t border-indigo-100 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                            <p className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">
                              Pratinjau Tampilan Lembar Soal (Siswa)
                            </p>
                          </div>
                          <span className="text-xs text-slate-400 italic">Sesuai tampilan ujian siswa</span>
                        </div>
                        <div className="p-3.5 bg-white dark:bg-slate-950 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-visible">
                          <MathText
                            key={formValues.text}
                            content={formValues.text || '<p class="text-slate-400 italic">Pertanyaan masih kosong...</p>'}
                            className="text-sm font-serif ql-editor !p-0 !overflow-visible text-slate-800 dark:text-slate-200 leading-relaxed"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 4: Kunci Jawaban & Opsi */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
                        Jawaban & Kunci Penilaian
                      </span>
                    </div>
                    <span className="text-xs text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 px-2.5 py-0.5 rounded-full font-semibold">
                      MODE: {formValues.type.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>

                  <QuestionTypeDispatcher
                    formValues={formValues as any}
                    setFormValues={setFormValues}
                    choiceFiles={choiceFiles}
                    setChoiceFiles={setChoiceFiles}
                    hotspotFile={hotspotFile}
                    setHotspotFile={setHotspotFile}
                    onPickChoiceImage={(letter) => {
                      setGalleryTarget({ type: "choice", letter });
                      setIsPickerOpen(true);
                    }}
                    onPickHotspotImage={() => {
                      setGalleryTarget({ type: "hotspot" });
                      setIsGalleryOpen(true);
                    }}
                    onUploadHotspotImage={() => {
                      setGalleryTarget({ type: "hotspot" });
                      globalFileInputRef.current?.click();
                    }}
                    showPreview={showPreview}
                    quillModules={quillModulesChoice}
                    quillFormats={quillFormatsChoice}
                    selectedQuestionId={selectedQuestion?.id}
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="sticky bottom-0 z-20 px-5 sm:px-7 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-[#0f1115]/95 backdrop-blur-md flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0 rounded-b-2xl shadow-lg">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (examId) sessionStorage.setItem("activeQuestionsExamId", examId);
                    navigate("/admin/bank-soal/questions");
                  }}
                  className="w-full sm:w-auto px-5 h-10 rounded-xl text-neutral-600 dark:text-neutral-300 font-semibold border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  Batal
                </Button>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  {dialogMode === "create" && (
                    <Button
                      type="button"
                      onClick={(e) => handleSubmit(e, true)}
                      disabled={isSavingQuestion}
                      className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-10 px-4 shadow-sm shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                    >
                      {isSavingQuestion ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</>
                      ) : (
                        <><Plus className="mr-2 h-4 w-4" /> Simpan & Tambah Lagi</>
                      )}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isSavingQuestion}
                    className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-10 px-5 shadow-sm shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    {isSavingQuestion ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</>
                    ) : (
                      dialogMode === "edit" ? "Perbarui Soal" : "Simpan Soal"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Preview Dialog - kept */}


      {/* Dialog Preview Soal (CBT Look) */}
      <QuestionPreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        questions={questions}
        previewQuestion={previewQuestion}
        previewIndex={previewIndex}
        onNavigate={(newIdx) => {
          setPreviewIndex(newIdx);
          setPreviewQuestion(questions[newIdx]);
        }}
      />

      <SharedGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        onSelectImage={handlePickGallery}
        pb={pb!}
        school={school}
        currentUser={user}
        currentQuestionContext={{
          text: formValues.text,
          topic: exam?.title,
          subject: exam?.subject,
          options: Object.values(formValues.choices || {}).map((c: any) => c.text),
          correctAnswer: formValues.answerKey,
        }}
      />

      {/* 🧮 Visual Equation Studio Modal */}
      <EquationStudioModal
        isOpen={isEquationModalOpen}
        onClose={() => {
          setIsEquationModalOpen(false);
          setEquationTarget(null);
        }}
        onInsert={handleInsertEquation}
        initialLatex={initialEquationLatex}
      />

      {/* ASISTEN AI CHAT DRAWER */}
      <AIChatQuestionDrawer
        isOpen={isAIChatDrawerOpen}
        onClose={() => setIsAIChatDrawerOpen(false)}
        exam={{
          id: examId || "",
          name: exam?.title || "Ujian",
          subject: exam?.subject || "Umum"
        }}
        onApplyQuestions={handleApplyAIQuestions}
      />

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

      <ConfirmationDialog
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev: any) => ({ ...prev, isOpen: false }))}
        onConfirm={async () => {
          if (confirmModal.onConfirm) await confirmModal.onConfirm();
          setConfirmModal((prev: any) => ({ ...prev, isOpen: false }));
        }}
        title={confirmModal.title}
        description={confirmModal.description}
        type={confirmModal.type}
        confirmLabel={confirmModal.confirmLabel || "OK"}
        showCancel={confirmModal.showCancel}
      />

      <input
        type="file"
        ref={globalFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleGlobalFileSelect}
      />
    </div>
  );
};

export default QuestionFormPage;
