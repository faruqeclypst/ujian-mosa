import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Edit, Trash, Check, Copy, Image, ChevronDown, FileText, Download, Eye, EyeOff, FolderOpen, Sparkles, Wand2, RefreshCw, BookOpen, Loader2, FileSpreadsheet, Search, X, Bookmark, Forward, CheckCircle2, Menu, Maximize2, HelpCircle, FileJson, GripVertical, ChevronLeft, ChevronRight, Database, Key, Layers, Target, Info, User, Hash } from "lucide-react";
import { Reorder } from "framer-motion";
import { MathText } from "../../components/ui/MathText";
import { SmartImage } from "../../components/ui/smart-image";
import { generateQuestionsAI, generateSingleQuestionAI, getTopicSuggestionsAI, parseQuestionsAI, generateFromMaterialAI, generateObjectivesAI, AI_MODELS } from "../../lib/ai";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { ConfirmationDialog } from "../../components/dialogs/ConfirmationDialog";
import BatchProgressDialog from "../../components/dialogs/BatchProgressDialog";
import QuestionRepositoryDialog from "../../components/dialogs/QuestionRepositoryDialog";
import HotspotAreaEditor, { type HotspotArea } from "../../components/question-editors/HotspotAreaEditor";
import { Input } from "../../components/ui/input";
import { Separator } from "../../components/ui/separator";
import FormField from "../../components/forms/FormField";
import { uploadInventoryImage, deleteImageFromStorage, deleteImagesFromStorage, safeDeleteImage, safeDeleteImages, getR2WorkerUrl, getR2PublicBaseUrl } from "../../lib/storage";
import { compressImage } from "../../lib/imageCompression";
import { ImportButton } from "../../components/ui/import-button";
import { parseQuestionsFromWord } from "../../lib/questionWordParser";
import { Select } from "../../components/ui/select";
import { latexToOmml } from "../../lib/latexToWordMath";

import { downloadQuestionTemplate, parseQuestionImportExcel } from "../../lib/questionExcel";
import { jsonrepair } from "jsonrepair";
import mammoth from "mammoth";
import ReactQuill, { Quill } from "react-quill";
import ImageResize from "quill-image-resize-module-react";
import "react-quill/dist/quill.snow.css";

Quill.register("modules/imageResize", ImageResize);

// Allow width/height attributes on images (untuk ImageResize module)
const ImageBlot = Quill.import('formats/image') as any;
ImageBlot.sanitize = (url: string) => url; // allow all URLs
const BaseImageFormat = Quill.import('formats/image') as any;
const ImageFormatAttributesList = ['alt', 'height', 'width', 'style', 'class'];
class CustomImageFormat extends BaseImageFormat {
  static formats(domNode: HTMLElement) {
    return ImageFormatAttributesList.reduce((formats: any, attribute) => {
      if (domNode.hasAttribute(attribute)) {
        formats[attribute] = domNode.getAttribute(attribute);
      }
      return formats;
    }, {});
  }
  format(name: string, value: string) {
    if (ImageFormatAttributesList.indexOf(name) > -1) {
      if (value) {
        this.domNode.setAttribute(name, value);
      } else {
        this.domNode.removeAttribute(name);
      }
    } else {
      super.format(name, value);
    }
  }
}
Quill.register(CustomImageFormat, true);

// REGISTER TABLE EMBED (preserve tables from Word copy-paste as non-editable blocks)
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

const getAbsoluteUrl = (url: string): string => {
  if (!url) return "";
  if (url.startsWith("file://")) return "";
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
  return `${window.location.origin}/${cleanUrl}`;
};

const forceSmallImage = (imgTag: string, physW: number, physH: number): string => {
  // 1. Remove existing width/height HTML attributes from the tag (supports quoted and unquoted values)
  let cleaned = imgTag
    .replace(/\bwidth\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\bheight\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 2. Remove width/height from inline style attribute if present
  cleaned = cleaned.replace(/(style=["'])([^"']*)(["'])/gi, (_, prefix, styleContent, suffix) => {
    const cleanedStyle = styleContent
      .replace(/\bwidth\s*:\s*[^;]+;?/gi, '')
      .replace(/\bheight\s*:\s*[^;]+;?/gi, '');
    return prefix + cleanedStyle + suffix;
  });

  // 3. Add explicit proportional width and height HTML attributes to prevent Word layout stretching
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

const processHtmlInlineImages = (
  htmlText: string,
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
    const absSrc = getAbsoluteUrl(m.src);
    const info = imageMapping ? (imageMapping.get(m.src) || (absSrc ? imageMapping.get(absSrc) : undefined)) : undefined;

    if (info) {
      replacedUrl = info.mappedUrl;
      width = info.width;
      height = info.height;
      let replacedImg = m.full.replace(m.src, replacedUrl);

      // For Word export compatibility, strictly force standard images to be small and proportional
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
  const pbToken = pb?.authStore?.token;

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

// REGISTER CUSTOM FORMATS (only line-height, NOT margin-left/text-indent which trap indentation)
const Parchment = Quill.import('parchment');
const LineHeightStyle = new Parchment.Attributor.Style('line-height', 'line-height', {
  scope: Parchment.Scope.BLOCK
});

Quill.register(LineHeightStyle, true);
Quill.register(LineHeightStyle, true);

// FORMATS WHITELIST (Penting agar Quill tidak menghapus tag/style kustom)
const quillFormats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike', 'blockquote',
  'script',
  'list', 'bullet', 'indent',
  'link', 'image', 'video', 'formula',
  'color', 'background',
  'align', 'code-block',
  'line-height',
  'tableEmbed',
  'width', 'height', 'style', 'alt', 'class'
];

// FORMATS WHITELIST KHUSUS PILIHAN JAWABAN (Opsi A, B, C, D, E)
// Hanya BOLD, LIST (sub-pernyataan), formula, dan gambar yang diizinkan agar pilihan selalu rata kiri dan teks normal
const quillFormatsChoice = [
  'bold',
  'list',
  'formula',
  'image',
  'tableEmbed',
  'width', 'height', 'style', 'alt', 'class'
];

// Allow standard CSS styles that might come from Word/Mammoth
const AlignStyle = Quill.import('attributors/style/align');
Quill.register(AlignStyle, true);
const BackgroundStyle = Quill.import('attributors/style/background');
Quill.register(BackgroundStyle, true);
const ColorStyle = Quill.import('attributors/style/color');
Quill.register(ColorStyle, true);

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
export type QuestionType = "pilihan_ganda" | "pilihan_ganda_kompleks" | "menjodohkan" | "benar_salah" | "isian_singkat" | "uraian" | "urutkan" | "drag_drop" | "klasifikasi" | "hotspot" | "isian_rumpang" | "matriks";

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
  // Benar / Salah Statement Matrix
  statements?: Array<{ id: string; text: string; answer?: "benar" | "salah" }>;
  options?: any;
  order?: number;
}

// Helper: deteksi ID rumpang [[n]] dari teks isian_rumpang
const detectRumpangIds = (text: string): string[] => {
  const ids: string[] = [];
  const re = /\[\[(\d+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
};

// Helper: cek apakah ada [[ tanpa pasangan ]]
const hasUnbalancedRumpang = (text: string): boolean => {
  const openCount = (text.match(/\[\[/g) || []).length;
  const closeCount = (text.match(/\]\]/g) || []).length;
  return openCount !== closeCount;
};



// Reverse mapping dari format database ke QuestionType frontend
export const typeMapReverse: Record<string, QuestionType> = {
  multiple_choice: "pilihan_ganda",
  complex_choice: "pilihan_ganda_kompleks",
  matching: "menjodohkan",
  true_false: "benar_salah",
  short_answer: "isian_singkat",
  essay: "uraian",
  sequence: "urutkan",
  drag_drop: "drag_drop",
  matriks: "matriks",
  klasifikasi: "klasifikasi",
  hotspot: "hotspot",
  isian_rumpang: "isian_rumpang"
};

// Helper untuk menormalisasi record mentah PocketBase menjadi QuestionData yang lengkap
export const mapRawQuestionToQuestionData = (q: any): QuestionData => {
  if (!q) return q;
  const rawType = q.field || q.type || "multiple_choice";
  const mappedType = (typeMapReverse[rawType] || rawType || "pilihan_ganda") as QuestionType;
  const options = q.options || {};

  const correctAnswersList = (q.correctAnswer || q.answerKey || "")
    .toString()
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);

  const rawChoices = (mappedType === "pilihan_ganda" || mappedType === "pilihan_ganda_kompleks" || (mappedType === "benar_salah" && !options.statements))
    ? (q.choices || options || {})
    : (q.choices || {});

  const defaultKeys = ["a", "b", "c", "d", "e"];
  const allChoiceKeys = Array.from(new Set([...defaultKeys, ...Object.keys(rawChoices || {})]));

  const mappedChoices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }> = {};
  allChoiceKeys.forEach((k) => {
    const lowerKey = k.toLowerCase();
    const val = rawChoices[k] ?? rawChoices[lowerKey] ?? rawChoices[k.toUpperCase()];
    if (!val && !defaultKeys.includes(lowerKey)) return;

    let textVal = "";
    let imgVal: string | undefined = undefined;
    let isCorrectVal = false;

    if (typeof val === "string") {
      textVal = val;
    } else if (val && typeof val === "object") {
      textVal = val.text || "";
      imgVal = val.imageUrl;
      isCorrectVal = typeof val.isCorrect === "boolean" ? val.isCorrect : false;
    }

    if (!isCorrectVal && correctAnswersList.includes(lowerKey)) {
      isCorrectVal = true;
    }

    mappedChoices[lowerKey] = {
      text: textVal,
      imageUrl: imgVal,
      isCorrect: isCorrectVal
    };
  });

  return {
    ...q,
    id: q.id,
    examId: q.examId || q.exam_id || "",
    type: mappedType,
    text: q.text || "",
    imageUrl: q.imageUrl || "",
    groupId: q.groupId || q.group_id || "",
    groupText: q.groupText || q.group_text || "",
    choices: mappedChoices,
    pairs: q.pairs || options.pairs || (mappedType === "menjodohkan" ? [{ id: "1", left: "", right: "" }] : undefined),
    items: q.items || options.items || (mappedType === "urutkan" || mappedType === "drag_drop" ? [{ id: "1", text: "" }] : undefined),
    statements: mappedType === "benar_salah"
      ? (q.statements || options.statements || (Array.isArray(options) ? options : undefined) || [
        { id: "1", text: "", answer: "benar" },
        { id: "2", text: "", answer: "salah" },
        { id: "3", text: "", answer: "benar" }
      ])
      : undefined,
    options: options,
    answerKey: q.correctAnswer || q.answerKey || "",
    order: q.order
  };
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  pilihan_ganda: "Pilihan Ganda",
  pilihan_ganda_kompleks: "PG Kompleks",
  menjodohkan: "Menjodohkan",
  benar_salah: "Benar / Salah",
  isian_singkat: "Isian Singkat",
  uraian: "Uraian / Esai",
  urutkan: "Urutkan",
  drag_drop: "Drag & Drop",
  matriks: "Matriks",
  isian_rumpang: "Isian Rumpang",
  hotspot: "Hotspot",
};

const QuestionFormPage = () => {
  const navigate = useNavigate();
  const { questionId } = useParams<{ questionId: string }>();
  const isEditMode = !!questionId;
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [canDrag, setCanDrag] = useState(false);
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
  const { subjects, teachers, teacherFullAccess, teacherAIAccess } = useExamData();

  useEffect(() => {
    if (!isEditMode || !questionId || !pb) return;
    let cancelled = false;
    (async () => {
      setFormLoading(true);
      setFormLoadError("");
      try {
        const raw: any = await pb.collection("questions").getOne(questionId);
        if (cancelled) return;

        // Pastikan examId tersimpan
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [isRepoDialogOpen, setIsRepoDialogOpen] = useState(false);

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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const dialogMode = isEditMode ? "edit" : "create";
  const currentQuestionIndex = useMemo(() => {
    if (!isEditMode || !questionId) return -1;
    return questions.findIndex(q => q.id === questionId);
  }, [isEditMode, questionId, questions]);

  const questionNumberBadge = useMemo(() => {
    if (dialogMode === "edit") {
      if (currentQuestionIndex !== -1 && questions.length > 0) {
        return `Soal #${currentQuestionIndex + 1} dari ${questions.length}`;
      }
      return "Mode Edit";
    }
    return questions.length > 0 ? `Soal #${questions.length + 1} (Baru)` : "Soal Baru";
  }, [dialogMode, currentQuestionIndex, questions.length]);
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

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<QuestionData | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryGroups, setGalleryGroups] = useState<{ title: string; images: string[] }[]>([]);
  const [galleryTarget, setGalleryTarget] = useState<{ type: "cover" | "choice" | "batch" | "quill" | "hotspot"; letter?: string; index?: number; quillInstance?: any; quillIndex?: number } | null>(null);

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
    } else if (galleryTarget.type === "hotspot") {
      setFormValues((prev) => ({ ...prev, hotspotImageUrl: url }));
      setHotspotFile(null);
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
    } else if (galleryTarget.type === "batch" && galleryTarget.index !== undefined) {
      updateBatchItem(galleryTarget.index, "imageFile", fileToUpload);
      updateBatchItem(galleryTarget.index, "imageUrl", "");
    } else if (galleryTarget.type === "hotspot") {
      setHotspotFile(fileToUpload);
      setFormValues((prev) => ({ ...prev, hotspotImageUrl: "" }));
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
    return () => { };
  }, []);

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [batchDragState, setBatchDragState] = useState<{ questionIndex: number; itemIndex: number } | null>(null);
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false, title: "", description: "", type: "info", confirmLabel: "Ok", onConfirm: () => { } });

  const showAlert = (title: string, description: string, type: "success" | "danger" | "warning" | "info" = "info", onConfirm?: () => void, showCancel: boolean = false, confirmLabel: string = "OK") => {
    if (!onConfirm && !showCancel) {
      addToast({
        type: type === "danger" ? "error" : type,
        title,
        description,
        duration: 4000
      });
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
        [{ 'header': [1, 2, 3, false] }],
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
  }), [imageHandler]);

  const quillModulesChoice = useMemo(() => ({
    toolbar: {
      container: [
        ['bold'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['formula', 'image', 'clean']
      ],
      handlers: {
        image: imageHandler
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
  }), [imageHandler]);




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
    if (isSavingQuestion) return; // Prevent double-click

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

  const handleDeleteClick = (q: QuestionData) => {
    setQuestionToDelete(q);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!questionToDelete || !pb) return;
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
              <span className="p-1 px-1.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 flex items-center gap-1 font-bold text-xs border border-blue-200 dark:border-blue-800/40 uppercase tracking-tight">
                Bergambar
              </span>
            )}
            {item.groupId && (
              <span className="p-1 px-1.5 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 flex items-center gap-1 font-bold text-xs border border-amber-200 dark:border-amber-800/40 uppercase tracking-tight">
                Paket: {item.groupId}
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
          drag_drop: "Drag and Drop",
          matriks: "Matriks",
          klasifikasi: "Klasifikasi",
          isian_rumpang: "Isian Rumpang",
          hotspot: "Hotspot"
        };
        return (
          <span className="p-1 px-2 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-800/40 uppercase whitespace-nowrap">
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

        if (type === "benar_salah") {
          const stList = item.statements || item.options?.statements || [];
          if (stList.length > 0) {
            return (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="p-1 px-2 rounded-md bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 text-xs font-semibold border border-cyan-200 dark:border-cyan-800/40 whitespace-nowrap">
                  {stList.length} Pernyataan
                </span>
                <div
                  className="flex items-center gap-1 p-1 px-1.5 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 whitespace-nowrap cursor-help"
                  title={stList.map((s: any, idx: number) => `${idx + 1}. ${s.text ? s.text.replace(/<[^>]*>/g, '').trim() : 'Pernyataan'}: ${(s.answer || 'benar').toUpperCase()}`).join("\n")}
                >
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold mr-0.5">Kunci:</span>
                  {stList.map((s: any, idx: number) => {
                    const isBenar = (s.answer || "benar").toLowerCase() === "benar";
                    return (
                      <span
                        key={s.id || idx}
                        className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded text-xs font-black font-mono shadow-xs ${isBenar
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700/50"
                          }`}
                        title={`${idx + 1}. ${s.text ? s.text.replace(/<[^>]*>/g, '').trim() : 'Pernyataan'}: ${isBenar ? 'BENAR' : 'SALAH'}`}
                      >
                        {idx + 1}:{isBenar ? "B" : "S"}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          }

          // Fallback untuk tipe benar_salah format lama (pilihan biasa)
          const activeKeys = Object.keys(item.choices || {}).filter(k => (item.choices?.[k]?.text && item.choices?.[k]?.text.replace(/<[^>]*>/g, '').trim()) || item.choices?.[k]?.imageUrl);
          const keys = activeKeys.length > 0 ? activeKeys : Object.keys(item.choices || {});
          if (keys.length > 0) {
            const correctCount = keys.filter(k => item.choices?.[k]?.isCorrect).length;
            const correctKeys = keys.filter(k => item.choices?.[k]?.isCorrect).map(k => k.toUpperCase()).join(", ");
            return (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="p-1 px-2 rounded-md bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  {keys.length} Opsi
                </span>
                {correctCount > 0 && (
                  <span className="p-1 px-2 text-xs font-bold rounded-md bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800/40 whitespace-nowrap">
                    Kunci: {correctKeys}
                  </span>
                )}
              </div>
            );
          }

          return (
            <span className="p-1 px-2 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-semibold border border-amber-200 dark:border-amber-800/40 whitespace-nowrap">
              Belum ada pernyataan
            </span>
          );
        }

        if (type === "matriks") {
          const cols = item.options?.columns || [];
          const stList = item.options?.statements || [];
          if (stList.length > 0 || cols.length > 0) {
            return (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="p-1 px-2 rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 text-xs font-semibold border border-teal-200 dark:border-teal-800/40 whitespace-nowrap">
                  {stList.length} Pernyataan × {cols.length} Kolom
                </span>
                {cols.length > 0 && (
                  <span
                    className="p-1 px-2 rounded-md bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-800 whitespace-nowrap cursor-help"
                    title={cols.map((c: any) => c.text).join(" | ")}
                  >
                    {cols.map((c: any) => c.text).join(" / ").slice(0, 30)}
                  </span>
                )}
              </div>
            );
          }
          return (
            <span className="p-1 px-2 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-semibold border border-amber-200 dark:border-amber-800/40 whitespace-nowrap">
              Belum ada data matriks
            </span>
          );
        }

        if (type === "klasifikasi") {
          const cats = item.options?.categories || [];
          const stList = item.options?.statements || [];
          if (stList.length > 0 || cats.length > 0) {
            return (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="p-1 px-2 rounded-md bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 text-xs font-semibold border border-violet-200 dark:border-violet-800/40 whitespace-nowrap">
                  {stList.length} Pernyataan × {cats.length} Kategori
                </span>
                {cats.length > 0 && (
                  <span
                    className="p-1 px-2 rounded-md bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-800 whitespace-nowrap cursor-help"
                    title={cats.map((c: any) => c.text).join(" | ")}
                  >
                    {cats.map((c: any) => c.text).join(" / ").slice(0, 30)}
                  </span>
                )}
              </div>
            );
          }
          return (
            <span className="p-1 px-2 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-semibold border border-amber-200 dark:border-amber-800/40 whitespace-nowrap">
              Belum ada data klasifikasi
            </span>
          );
        }

        if (type === "isian_rumpang") {
          const blanks = item.options?.blanks || [];
          const passage = item.options?.text || "";
          if (blanks.length > 0 || passage) {
            return (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="p-1 px-2 rounded-md bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300 text-xs font-semibold border border-lime-200 dark:border-lime-800/40 whitespace-nowrap">
                  {blanks.length} Rumpang
                </span>
                {blanks.length > 0 && (
                  <span
                    className="p-1 px-2 rounded-md bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-800 whitespace-nowrap cursor-help"
                    title={blanks.map((b: any) => `[[${b.id}]]: ${(b.answers || []).join(" / ")}`).join("\n")}
                  >
                    {blanks.map((b: any) => `[[${b.id}]]`).join(" ").slice(0, 30)}
                  </span>
                )}
              </div>
            );
          }
          return (
            <span className="p-1 px-2 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-semibold border border-amber-200 dark:border-amber-800/40 whitespace-nowrap">
              Belum ada rumpang
            </span>
          );
        }

        if (type === "hotspot") {
          const areas = item.options?.areas || [];
          const mode = item.options?.mode || "any";
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="p-1 px-2 rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 text-xs font-semibold border border-sky-200 dark:border-sky-800/40 whitespace-nowrap">
                {areas.length} Area
              </span>
              <span className="p-1 px-2 rounded-md bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-800 whitespace-nowrap">
                {mode === "all" ? "Semua area" : "Satu saja"}
              </span>
            </div>
          );
        }

        if (type === "pilihan_ganda" || type === "pilihan_ganda_kompleks") {
          const activeKeys = Object.keys(item.choices || {}).filter(k => (item.choices?.[k]?.text && item.choices?.[k]?.text.replace(/<[^>]*>/g, '').trim()) || item.choices?.[k]?.imageUrl);
          const keys = activeKeys.length > 0 ? activeKeys : Object.keys(item.choices || {});
          const correctCount = keys.filter(k => item.choices?.[k]?.isCorrect).length;
          const correctKeys = keys.filter(k => item.choices?.[k]?.isCorrect).map(k => k.toUpperCase()).join(", ");

          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="p-1 px-2 rounded-md bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-800 whitespace-nowrap">{keys.length} Opsi</span>
              {correctCount > 0 && (
                <span className="p-1 px-2 text-xs font-bold rounded-md bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800/40 whitespace-nowrap">
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
      console.log("Word Parser Results:", parsed.length, "soal ditemukan", parsed.map((q, i) => `[${i + 1}] type=${q.type} groupId=${q.groupId} text=${(q.text || "").substring(0, 50)}`));
      if (parsed.length === 0) throw new Error("Tidak ada soal yang dikenali dalam file.");

      //  FILTER BY ALLOWED TYPES
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

      //  DUPLICATE DETECTION & UNIQUE GROUP ID
      // Fetch existing questions for this exam to check duplicates
      const existingQuestions = await pb!.collection('questions').getFullList({ filter: `examId = "${examId}"` });
      const existingTexts = new Set(existingQuestions.map(q => (q.text || "").replace(/<[^>]*>/g, '').trim().toLowerCase().substring(0, 80)));
      const existingGroupIds = new Set(existingQuestions.map(q => q.groupId || q.group_id || "").filter(Boolean));
      const maxExistingOrder = existingQuestions.reduce((max, q) => Math.max(max, q.order || 0), 0);

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

          // Localize Question Image (handles base64 and remote URLs)
          const imageUrl = q.imageUrl ? await localizeImage(q.imageUrl, `word_q_${actualIndex}`) : "";

          // Localize Choice Images and Map them
          const choices: Record<string, any> = {};
          await Promise.all(Object.entries(q.choices).map(async ([key, val]: [string, any]) => {
            const choiceImgUrl = val.imageUrl ? await localizeImage(val.imageUrl, `word_opt_${actualIndex}_${key}`) : "";
            const choiceText = val.text ? await localizeInlineImages(val.text) : "";

            choices[key.toLowerCase()] = {
              text: choiceText,
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

          // Localize question text and group text HTML
          const localizedQText = await localizeInlineImages(q.text || "");
          const localizedGroupText = q.groupText ? await localizeInlineImages(q.groupText) : "";

          const payload: any = {
            examId,
            text: localizedQText,
            field: fieldType,
            type: questionType,
            options: questionType === "pilihan_ganda" ? choices : {},
            correctAnswer: questionType === "pilihan_ganda" ? answerKey.toLowerCase() : (q.answerKey || ""),
            answerKey: questionType === "pilihan_ganda" ? answerKey.toLowerCase() : (q.answerKey || ""),
            groupId: q.groupId || "",
            groupText: localizedGroupText,
            order: maxExistingOrder + actualIndex + 1,
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

      // Get max order from database
      const excelExisting = await pb.collection('questions').getFullList({ filter: `examId = "${examId}"`, fields: 'order' });
      const maxExistingOrder = excelExisting.reduce((max, q) => Math.max(max, q.order || 0), 0);

      let importedCount = 0;
      const chunkSize = 10;
      for (let i = 0; i < parsed.length; i += chunkSize) {
        const chunk = parsed.slice(i, i + chunkSize);

        await Promise.all(chunk.map(async (q, index) => {
          const actualIndex = i + index;

          // Localize inline images in question and group text
          const localizedQText = await localizeInlineImages(q.text || "");
          const localizedGroupText = q.groupText ? await localizeInlineImages(q.groupText) : "";

          // Localize choices
          const choices: Record<string, any> = {};
          if (q.choices) {
            await Promise.all(Object.entries(q.choices).map(async ([key, val]: [string, any]) => {
              const choiceImgUrl = val.imageUrl ? await localizeImage(val.imageUrl, `excel_opt_${actualIndex}_${key}`) : "";
              const choiceText = val.text ? await localizeInlineImages(val.text) : "";

              choices[key.toLowerCase()] = {
                text: choiceText,
                isCorrect: val.isCorrect || false,
                imageUrl: choiceImgUrl
              };
            }));
          }

          // Determine correct answer based on question type
          let answerKey = "";
          if (q.type === "isian_singkat" || q.type === "uraian") {
            answerKey = q.answerKey || "";
          } else {
            answerKey = Object.entries(choices).find(([_, v]: any) => v.isCorrect)?.[0] || q.answerKey || "";
          }

          const payload = {
            examId,
            text: localizedQText,
            field: q.field || "multiple_choice",
            type: q.type,
            options: q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks" || q.type === "benar_salah" ? choices : q.choices,
            correctAnswer: answerKey,
            answerKey: answerKey,
            groupId: q.groupId || "",
            groupText: localizedGroupText,
            order: maxExistingOrder + actualIndex + 1,
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

      // Get max order from database
      const existingForOrder = await pb.collection('questions').getFullList({ filter: `examId = "${examId}"`, fields: 'order' });
      const jsonMaxOrder = existingForOrder.reduce((max, q) => Math.max(max, q.order || 0), 0);

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
        matriks: "matriks",
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

        // Localize remote image and inline images
        const qImageUrl = q.imageUrl || q.image_url || "";
        const localizedQImageUrl = qImageUrl ? await localizeImage(qImageUrl, `json_q_${i}`) : "";
        const finalQImageUrl = localizedQImageUrl || qImageUrl;
        let localizedQText = await localizeInlineImages(q.text || q.question || "");
        if (finalQImageUrl && !localizedQText.includes(finalQImageUrl)) {
          localizedQText = `<p><img src="${finalQImageUrl}" alt="Gambar Soal" style="max-height:320px;max-width:100%;border-radius:16px;margin-bottom:12px;" /></p>` + localizedQText;
        }
        const rawGroupText = q.groupText || q.group_text || "";
        const localizedGroupText = rawGroupText ? await localizeInlineImages(rawGroupText) : "";

        const payload: any = {
          examId,
          text: localizedQText,
          field: typeMap[qType] || "multiple_choice",
          options: {},
          correctAnswer: correctAnswer,
          imageUrl: localizedQImageUrl,
          order: q.order || (jsonMaxOrder + i + 1),
          groupId: q.groupId || q.group_id || "",
          group_id: q.groupId || q.group_id || "",
          groupText: localizedGroupText,
          group_text: localizedGroupText,
        };

        // Build options based on type with image localization
        if ((qType === "benar_salah" || qType === "true_false") && q.statements && Array.isArray(q.statements) && q.statements.length > 0) {
          const validStatements = await Promise.all(q.statements.map(async (st: any) => ({
            id: String(st.id || Math.random()),
            text: await localizeInlineImages(st.text || ""),
            answer: (st.answer || "benar").toLowerCase() === "salah" ? "salah" : "benar"
          })));
          payload.options = { statements: validStatements };
          payload.correctAnswer = validStatements.map((s: any) => `${s.id}:${s.answer}`).join(",");
        } else if (qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks" || qType === "benar_salah" || qType === "multiple_choice" || qType === "complex_choice" || qType === "true_false") {
          const opts: any = {};
          const keys = Object.keys(choices);
          for (let kIdx = 0; kIdx < keys.length; kIdx++) {
            const k = keys[kIdx];
            const val = choices[k];
            if (typeof val === 'string') {
              opts[k] = { text: await localizeInlineImages(val), isCorrect: correctAnswer.includes(k) };
            } else if (typeof val === 'object') {
              const choiceImg = val.imageUrl || val.image_url || "";
              const localizedChoiceImg = choiceImg ? await localizeImage(choiceImg, `json_opt_${i}_${k}`) : undefined;
              opts[k] = {
                text: await localizeInlineImages(val.text || ""),
                imageUrl: localizedChoiceImg,
                isCorrect: !!val.isCorrect
              };
            }
          }
          payload.options = opts;
        } else if (qType === "menjodohkan" || qType === "matching") {
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
          payload.options = { pairs: localizedPairs };
        } else if (qType === "urutkan" || qType === "drag_drop" || qType === "sequence") {
          const items = q.items || [];
          const localizedItems = [];
          for (let itIdx = 0; itIdx < items.length; itIdx++) {
            const it = items[itIdx];
            const itemImg = it.imageUrl || it.image_url || "";
            const localizedItemImg = itemImg ? await localizeImage(itemImg, `json_item_${i}_${itIdx}`) : undefined;
            localizedItems.push({
              ...it,
              text: await localizeInlineImages(it.text || ""),
              imageUrl: localizedItemImg
            });
          }
          payload.options = { items: localizedItems };
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

    // Replace LaTeX in text with native Word OMML equations (or CodeCogs image fallback)
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

    // 1. Pre-collect all image URLs
    const urlsToConvert = new Set<string>();

    const addUrl = (url: string | undefined) => {
      if (!url) return;
      const abs = getAbsoluteUrl(url);
      if (abs) {
        urlsToConvert.add(abs);
      }
      urlsToConvert.add(url);
    };

    const collectFromHtml = (htmlText: string | undefined) => {
      if (!htmlText) return;
      const processed = processLatex(htmlText);
      const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
      let match;
      while ((match = imgRegex.exec(processed)) !== null) {
        addUrl(match[1]);
      }
    };

    for (const q of questions) {
      collectFromHtml(q.groupText);
      collectFromHtml(q.text);
      addUrl(q.imageUrl);

      if (q.choices && (q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks" || q.type === "benar_salah")) {
        for (const letter of ['a', 'b', 'c', 'd', 'e']) {
          const c = (q.choices as any)[letter];
          if (c) {
            collectFromHtml(c.text);
            addUrl(c.imageUrl);
          }
        }
      } else if (q.type === "menjodohkan" && q.pairs) {
        for (const p of q.pairs) {
          collectFromHtml(p.left);
          collectFromHtml(p.right);
        }
      } else if ((q.type === "urutkan" || q.type === "drag_drop") && q.items) {
        for (const item of q.items) {
          collectFromHtml(item.text);
          addUrl(item.imageUrl);
        }
      }
    }

    // 2. Download and convert all collected images to standard PNGs
    const imageMapping = new Map<string, { mappedUrl: string, base64: string, width: number, height: number }>();
    const urlList = Array.from(urlsToConvert);

    setBatchProgress(prev => ({
      ...prev,
      total: urlList.length + questions.length,
      current: 0,
      message: `Mengunduh & mengonversi gambar (0/${urlList.length})...`
    }));

    for (let idx = 0; idx < urlList.length; idx++) {
      const originalUrl = urlList[idx];
      setBatchProgress(prev => ({
        ...prev,
        current: idx,
        message: `Mengunduh & mengonversi gambar (${idx + 1}/${urlList.length})...`
      }));

      const result = await convertToPngBase64(originalUrl, pb);
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

    const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

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
      setBatchProgress(prev => ({ ...prev, current: urlList.length + i + 1, message: `Memproses soal #${i + 1}...` }));

      if (q.groupId && q.groupId !== currentGroupId && q.groupText) {
        const cleanLiterasi = cleanForWord(processHtmlInlineImages(processLatex(q.groupText || ""), imageMapping));
        html += `<div class="wacana"><b>STIMULUS / LITERASI:</b><br/>${cleanLiterasi}</div>`;
        currentGroupId = q.groupId;
      }

      const processedQText = cleanForWord(processHtmlInlineImages(processLatex(q.text || ""), imageMapping));
      html += `
      <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 3pt; border: none; border-collapse: collapse;">
        <tr>
          <td valign="top" width="25" style="width: 25pt; border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3;"><b>${i + 1}.</b></td>
          <td valign="top" style="border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3; text-align: left;"><span>${processedQText}</span></td>
        </tr>
      </table>`;

      // Render main question imageUrl if present
      if (q.imageUrl) {
        const absImg = getAbsoluteUrl(q.imageUrl);
        const info = imageMapping.get(q.imageUrl) || (absImg ? imageMapping.get(absImg) : undefined);
        if (info) {
          const displayW = Math.round(info.width > 290 ? 290 : info.width);
          const displayH = Math.round(info.width > 290 ? (info.height * 290) / info.width : info.height);
          html += `<div style="margin: 5pt 0 5pt 25pt;"><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Soal" /></div>`;
        }
      }

      if (q.choices && (q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks" || q.type === "benar_salah")) {
        for (const letter of ['a', 'b', 'c', 'd', 'e']) {
          const c = (q.choices as any)[letter];
          if (c && (c.text || c.imageUrl)) {
            const processedCText = cleanForWord(processHtmlInlineImages(processLatex(c.text || ""), imageMapping));
            let choiceHtml = `
            <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin-left: 25pt; margin-bottom: 1pt; border: none; border-collapse: collapse;">
              <tr>
                <td valign="top" width="20" style="width: 20pt; border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3;">${letter.toUpperCase()}.</td>
                <td valign="top" style="border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3; text-align: left;">
                  <span>${processedCText}</span>`;
            if (c.imageUrl) {
              const absChoiceImg = getAbsoluteUrl(c.imageUrl);
              const info = imageMapping.get(c.imageUrl) || (absChoiceImg ? imageMapping.get(absChoiceImg) : undefined);
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
        const ans = Object.entries(q.choices).filter(([_, v]) => (v as any).isCorrect).map(([k]) => k.toUpperCase()).join(", ");
        keys += `<tr><td align="center">${i + 1}</td><td align="center"><b>${ans || "-"}</b></td></tr>`;
      } else if (q.type === "menjodohkan" && q.pairs) {
        html += `<div style="margin-left: 25pt; margin-bottom: 5pt;">`;
        html += `<table border="1" cellpadding="4" style="border-collapse: collapse; width: 80%;">`;
        html += `<tr style="background-color: #f3f4f6;"><th>Pernyataan 1</th><th>Pernyataan 2</th></tr>`;
        for (const p of q.pairs) {
          html += `<tr><td>${cleanForWord(processHtmlInlineImages(processLatex(p.left || ""), imageMapping))}</td><td>${cleanForWord(processHtmlInlineImages(processLatex(p.right || ""), imageMapping))}</td></tr>`;
        }
        html += `</table></div>`;
        keys += `<tr><td align="center">${i + 1}</td><td>Menjodohkan (Lihat Lembar Jawaban)</td></tr>`;
        html += `<p class="spacer">&nbsp;</p>`;
      } else if ((q.type === "urutkan" || q.type === "drag_drop") && q.items) {
        html += `<div style="margin-left: 25pt; margin-bottom: 5pt;"><ol>`;
        for (const item of q.items) {
          let itemHtml = `<li>${cleanForWord(processHtmlInlineImages(processLatex(item.text || ""), imageMapping))}`;
          if (item.imageUrl) {
            const absItemImg = getAbsoluteUrl(item.imageUrl);
            const info = imageMapping.get(item.imageUrl) || (absItemImg ? imageMapping.get(absItemImg) : undefined);
            if (info) {
              const displayW = Math.round(info.width > 145 ? 145 : info.width);
              const displayH = Math.round(info.width > 145 ? (info.height * 145) / info.width : info.height);
              itemHtml += `<br/><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Item" />`;
            }
          }
          itemHtml += `</li>`;
          html += itemHtml;
        }
        html += `</ol></div>`;
        keys += `<tr><td align="center">${i + 1}</td><td>${q.answerKey || "-"}</td></tr>`;
        html += `<p class="spacer">&nbsp;</p>`;
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

    // 3. Assemble as MHTML
    const boundary = "----=_NextPart_Boundary_Ujian_CBT";

    let mhtml = "";
    mhtml += "MIME-Version: 1.0\r\n";
    mhtml += `Content-Type: multipart/related; type="text/html"; boundary="${boundary}"\r\n\r\n`;

    // HTML Part
    mhtml += `--${boundary}\r\n`;
    mhtml += "Content-Type: text/html; charset=\"utf-8\"\r\n";
    mhtml += "Content-Transfer-Encoding: 8bit\r\n";
    mhtml += "Content-Location: https://local-asset/document.html\r\n\r\n";
    mhtml += html + "\r\n\r\n";

    // Attached image parts
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

    const blob = new Blob([mhtml], { type: 'application/msword' });
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

  // Export Selected Questions to JSON
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

  // Export Selected Questions to Word
  const handleExportSelectedToWord = async () => {
    const selectedQuestions = questions.filter(q => selectedIds.includes(q.id));
    if (selectedQuestions.length === 0) return;

    setBatchProgress({ isOpen: true, total: selectedQuestions.length, current: 0, message: "Menyiapkan export...", title: "Export Terpilih ke Word" });

    try {
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

      const cleanForWord = (htmlText: string): string => {
        if (!htmlText) return "";
        let clean = htmlText;
        clean = clean.replace(/<pre[^>]*class="ql-syntax"[^>]*>([\s\S]*?)<\/pre>/gi, '<p style="font-family:Consolas,monospace;background:#f3f4f6;padding:8px;border:1px solid #e5e7eb;white-space:pre-wrap;">$1</p>');
        return clean;
      };

      // 1. Pre-collect all image URLs
      const urlsToConvert = new Set<string>();

      const addUrl = (url: string | undefined) => {
        if (!url) return;
        const abs = getAbsoluteUrl(url);
        if (abs) {
          urlsToConvert.add(abs);
        }
        urlsToConvert.add(url);
      };

      const collectFromHtml = (htmlText: string | undefined) => {
        if (!htmlText) return;
        const processed = processLatex(htmlText);
        const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
        let match;
        while ((match = imgRegex.exec(processed)) !== null) {
          addUrl(match[1]);
        }
      };

      for (const q of selectedQuestions) {
        collectFromHtml(q.groupText);
        collectFromHtml(q.text);
        addUrl(q.imageUrl);

        if (q.choices && (q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks" || q.type === "benar_salah")) {
          const keys = Object.keys(q.choices);
          for (const key of keys) {
            const choice = q.choices[key];
            if (choice) {
              collectFromHtml(choice.text);
              addUrl(choice.imageUrl);
            }
          }
        } else if (q.type === "menjodohkan" && q.pairs) {
          for (const p of q.pairs) {
            collectFromHtml(p.left);
            collectFromHtml(p.right);
          }
        } else if ((q.type === "urutkan" || q.type === "drag_drop") && q.items) {
          for (const item of q.items) {
            collectFromHtml(item.text);
            addUrl(item.imageUrl);
          }
        }
      }

      // 2. Download and convert all collected images to standard PNGs
      const imageMapping = new Map<string, { mappedUrl: string, base64: string, width: number, height: number }>();
      const urlList = Array.from(urlsToConvert);

      setBatchProgress(prev => ({
        ...prev,
        total: urlList.length + selectedQuestions.length,
        current: 0,
        message: `Mengunduh & mengonversi gambar (0/${urlList.length})...`
      }));

      for (let idx = 0; idx < urlList.length; idx++) {
        const originalUrl = urlList[idx];
        setBatchProgress(prev => ({
          ...prev,
          current: idx,
          message: `Mengunduh & mengonversi gambar (${idx + 1}/${urlList.length})...`
        }));

        const result = await convertToPngBase64(originalUrl, pb);
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

      let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns:m='http://schemas.microsoft.com/office/2004/12/omml' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="utf-8"><style>
        body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; margin: 2cm; }
        table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        td, th { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 11pt; }
        .soal { margin-bottom: 16px; }
        .opsi { margin-left: 20px; }
        .kunci { color: #059669; font-weight: bold; }
        .stimulus { border: 1px solid #059669; padding: 12px; margin-bottom: 12px; background: #f0fdf4; }
        img { display: block; margin: 5pt 0; border: none; }
        img.latex-formula { display: inline; margin: 0; width: auto; height: auto; vertical-align: middle; }
      </style></head><body>`;

      html += `<h2 style="text-align:center;">EXPORT SOAL TERPILIH</h2>`;
      html += `<p style="text-align:center;font-size:10pt;color:#666;">${exam?.subject || ""} - ${selectedQuestions.length} soal - ${new Date().toLocaleDateString('id-ID')}</p><hr/>`;

      let currentGroupId = "";
      for (let idx = 0; idx < selectedQuestions.length; idx++) {
        const q = selectedQuestions[idx];
        setBatchProgress(prev => ({ ...prev, current: urlList.length + idx + 1, message: `Memproses soal ${idx + 1}/${selectedQuestions.length}` }));

        // Show stimulus if new group
        if (q.groupId && q.groupId !== currentGroupId && q.groupText) {
          html += `<div class="stimulus"><b>STIMULUS:</b><br/>${cleanForWord(processHtmlInlineImages(processLatex(q.groupText), imageMapping))}</div>`;
          currentGroupId = q.groupId;
        }

        const processedQText = cleanForWord(processHtmlInlineImages(processLatex(q.text || ""), imageMapping));
        html += `
        <div class="soal">
          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 3pt; border: none; border-collapse: collapse;">
            <tr>
              <td valign="top" width="25" style="width: 25pt; border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.5;"><b>${idx + 1}.</b></td>
              <td valign="top" style="border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; text-align: left;"><span>${processedQText}</span></td>
            </tr>
          </table>`;

        // Render main question image
        if (q.imageUrl) {
          const absImg = getAbsoluteUrl(q.imageUrl);
          const info = imageMapping.get(q.imageUrl) || (absImg ? imageMapping.get(absImg) : undefined);
          if (info) {
            const displayW = Math.round(info.width > 290 ? 290 : info.width);
            const displayH = Math.round(info.width > 290 ? (info.height * 290) / info.width : info.height);
            html += `<br/><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Soal" /><br/>`;
          }
        }

        if (q.choices && (q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks" || q.type === "benar_salah")) {
          html += `<div class="opsi">`;
          const keys = Object.keys(q.choices).sort();
          for (const key of keys) {
            const choice = q.choices[key];
            const isCorrect = choice.isCorrect;
            const processedCText = cleanForWord(processHtmlInlineImages(processLatex(choice.text || ""), imageMapping));
            let choiceHtml = `
            <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 1pt; border: none; border-collapse: collapse;">
              <tr>
                <td valign="top" width="20" style="width: 20pt; border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.5;">${isCorrect ? '<span class="kunci">' : ''}${key.toUpperCase()}.${isCorrect ? '</span>' : ''}</td>
                <td valign="top" style="border: none; padding: 0; font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; text-align: left;">
                  ${isCorrect ? '<span class="kunci">' : ''}${processedCText}`;
            if (choice.imageUrl) {
              const absChoiceImg = getAbsoluteUrl(choice.imageUrl);
              const info = imageMapping.get(choice.imageUrl) || (absChoiceImg ? imageMapping.get(absChoiceImg) : undefined);
              if (info) {
                const displayW = Math.round(info.width > 181 ? 181 : info.width);
                const displayH = Math.round(info.width > 181 ? (info.height * 181) / info.width : info.height);
                choiceHtml += `<br/><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Pilihan" />`;
              }
            }
            choiceHtml += `${isCorrect ? '</span>' : ''}
                </td>
              </tr>
            </table>`;
            html += choiceHtml;
          }
          html += `</div>`;
        } else if (q.type === "menjodohkan" && q.pairs) {
          html += `<table><tr><th>Kiri</th><th>Kanan</th></tr>`;
          for (const p of q.pairs) {
            html += `<tr><td>${cleanForWord(processHtmlInlineImages(processLatex(p.left || ""), imageMapping))}</td><td>${cleanForWord(processHtmlInlineImages(processLatex(p.right || ""), imageMapping))}</td></tr>`;
          }
          html += `</table>`;
        } else if ((q.type === "urutkan" || q.type === "drag_drop") && q.items) {
          html += `<ol>`;
          for (const item of q.items) {
            let itemHtml = `<li>${cleanForWord(processHtmlInlineImages(processLatex(item.text || ""), imageMapping))}`;
            if (item.imageUrl) {
              const absItemImg = getAbsoluteUrl(item.imageUrl);
              const info = imageMapping.get(item.imageUrl) || (absItemImg ? imageMapping.get(absItemImg) : undefined);
              if (info) {
                const displayW = Math.round(info.width > 145 ? 145 : info.width);
                const displayH = Math.round(info.width > 145 ? (info.height * 145) / info.width : info.height);
                itemHtml += `<br/><img src="${info.mappedUrl}" width="${displayW}" height="${displayH}" alt="Gambar Item" />`;
              }
            }
            itemHtml += `</li>`;
            html += itemHtml;
          }
          html += `</ol>`;
        }

        if (q.answerKey) {
          html += `<p class="kunci">Kunci: ${q.answerKey.toUpperCase()}</p>`;
        }
        html += `</div>`;
      }

      html += `</body></html>`;

      // 3. Assemble as MHTML
      const boundary = "----=_NextPart_Boundary_Ujian_CBT";

      let mhtml = "";
      mhtml += "MIME-Version: 1.0\r\n";
      mhtml += `Content-Type: multipart/related; type="text/html"; boundary="${boundary}"\r\n\r\n`;

      // HTML Part
      mhtml += `--${boundary}\r\n`;
      mhtml += "Content-Type: text/html; charset=\"utf-8\"\r\n";
      mhtml += "Content-Transfer-Encoding: 8bit\r\n";
      mhtml += "Content-Location: https://local-asset/document.html\r\n\r\n";
      mhtml += html + "\r\n\r\n";

      // Attached image parts
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

      const blob = new Blob([mhtml], { type: 'application/msword' });
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
    <div className="space-y-4 sm:space-y-5 relative w-full pb-16">
      {/* Header Card (Mirip dengan kartu soal & fluid w-full) */}
      <div className="relative z-20 flex flex-col gap-3 bg-card p-4 sm:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm transition-colors w-full">
        {/* Breadcrumbs Row */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => navigate("/admin/bank-soal")}
            className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors shrink-0"
          >
            Bank Soal
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          <button
            type="button"
            onClick={() => {
              if (examId) sessionStorage.setItem("activeQuestionsExamId", examId);
              navigate("/admin/bank-soal/questions");
            }}
            className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors truncate max-w-[200px] sm:max-w-xs shrink-0"
            title={exam?.title || "Daftar Soal"}
          >
            {exam?.title || "Daftar Soal"}
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          <span className="font-semibold text-foreground shrink-0">
            {dialogMode === "edit" ? "Edit Butir Soal" : "Tambah Butir Soal"}
          </span>
        </nav>

        {/* Main Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          {/* Left: Back Button + Title Block */}
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                if (examId) sessionStorage.setItem("activeQuestionsExamId", examId);
                navigate("/admin/bank-soal/questions");
              }}
              className="shrink-0 w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 active:scale-95"
              title="Kembali ke daftar soal"
              aria-label="Kembali ke daftar soal"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              {/* Title + Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">
                  {dialogMode === "edit" ? "Edit Butir Soal" : "Tambah Butir Soal"}
                </h1>

                {/* Mode & Number Badge */}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${
                  dialogMode === "edit"
                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/50"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dialogMode === "edit" ? "bg-amber-500" : "bg-indigo-500"}`} />
                  {questionNumberBadge}
                </span>

                {/* Dynamic Question Type Pill */}
                {QUESTION_TYPE_LABELS[formValues.type] && (
                  <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80">
                    <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    {QUESTION_TYPE_LABELS[formValues.type]}
                  </span>
                )}
              </div>

              {/* Meta context: Subject, Teacher, Questions Count */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                {exam?.subject && (
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                    <span className="truncate max-w-[180px]">{exam.subject}</span>
                  </span>
                )}
                {exam?.teacherName && (
                  <span className="inline-flex items-center gap-1 hidden sm:inline-flex">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[160px]">{exam.teacherName}</span>
                  </span>
                )}
                {questions.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground hidden md:inline-flex">
                    <Hash className="w-3 h-3 shrink-0" />
                    Total {questions.length} soal tersimpan
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions Toolbar */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {/* Preview Toggle Button */}
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border shadow-xs active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                showPreview
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-indigo-500/20"
                  : "bg-background hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground border-slate-200 dark:border-slate-700"
              }`}
              title={showPreview ? "Matikan pratinjau tampilan ujian siswa" : "Aktifkan pratinjau tampilan ujian siswa"}
              aria-pressed={showPreview}
            >
              {showPreview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
              <span>{showPreview ? "Pratinjau: ON" : "Pratinjau: OFF"}</span>
            </button>

            {/* Quick Save Header Button */}
            <button
              type="button"
              onClick={(e) => handleSubmit(e, false)}
              disabled={isSavingQuestion}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-xs shadow-indigo-500/20 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
              title="Simpan soal"
            >
              {isSavingQuestion ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{dialogMode === "edit" ? "Perbarui" : "Simpan"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Form Content (Fluid Width matching Header Card) */}
      {formLoading ? (
        <div className="flex items-center justify-center py-20 bg-card rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="ml-3 text-muted-foreground">Memuat soal...</span>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm overflow-hidden w-full">
        {/* Form - converted from dialog to page */}
          <div className="p-0 gap-0 flex flex-col">

            <form onSubmit={(e) => handleSubmit(e, false)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 bg-white dark:bg-slate-950">
                {/* Row 1: Pengaturan Tipe Soal & Stimulus Literasi (Menyatu, Rapi & Tidak Mengambang) */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 shadow-xs overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
                    {/* Kolom Kiri: Jenis / Tipe Soal */}
                    <div className="p-4 space-y-2 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <label htmlFor="type" className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Jenis / Tipe Soal</span>
                        </label>
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Format Jawaban</span>
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
                          {(allowedTypes.pilihan_ganda_kompleks || formValues.type === "pilihan_ganda_kompleks") && <option value="pilihan_ganda_kompleks">Pilihan Ganda Kompleks (Multi Response)</option>}
                          {(allowedTypes.menjodohkan || formValues.type === "menjodohkan") && <option value="menjodohkan">Menjodohkan (Matching)</option>}
                          {(allowedTypes.benar_salah || formValues.type === "benar_salah") && <option value="benar_salah">Benar / Salah (Matriks ANBK)</option>}
                          {(allowedTypes.isian_singkat || formValues.type === "isian_singkat") && <option value="isian_singkat">Isian Singkat</option>}
                          {(allowedTypes.uraian || formValues.type === "uraian") && <option value="uraian">Uraian / Esai</option>}
                          {(allowedTypes.urutkan || formValues.type === "urutkan") && <option value="urutkan">Urutkan (Ordering)</option>}
                          {(allowedTypes.drag_drop || formValues.type === "drag_drop") && <option value="drag_drop">Drag and Drop</option>}
                          {(allowedTypes.matriks || formValues.type === "matriks") && <option value="matriks">Matriks (Tabel Pilihan Ganda)</option>}
                          {(allowedTypes.isian_rumpang || formValues.type === "isian_rumpang") && <option value="isian_rumpang">Isian Rumpang (Cloze)</option>}
                          {(allowedTypes.hotspot || formValues.type === "hotspot") && <option value="hotspot">Hotspot (Klik Gambar)</option>}
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
                            <MathText
                              content={existingLiteracies[formValues.groupId]}
                              className="text-xs text-slate-700 dark:text-slate-300 [&_img]:max-w-[40px] line-clamp-3 leading-relaxed"
                            />
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="text" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Pertanyaan Utama
                    </label>
                    <span className="text-xs text-slate-400">
                      Mendukung rumus LaTeX, teks kaya, dan tabel
                    </span>
                  </div>

                  <div className="bg-card rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all flex flex-col">
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
                      className="[&_.ql-editor]:min-h-[130px] [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:bg-slate-50/50 dark:[&_.ql-toolbar]:bg-slate-900/30 [&_.ql-toolbar]:overflow-x-auto"
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
                        <div className="p-3.5 bg-white dark:bg-slate-950 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-xs">
                          <MathText
                            key={formValues.text}
                            content={formValues.text || '<p class="text-slate-400 italic">Pertanyaan masih kosong...</p>'}
                            className="text-sm font-serif ql-editor !p-0 text-slate-800 dark:text-slate-200 leading-relaxed"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 3: Gambar Cover Soal */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20 space-y-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
                      Gambar Cover / Ilustrasi Soal (Opsional)
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Gambar ini tampil tepat di atas teks pertanyaan utama pada lembar ujian siswa.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl h-11 text-xs px-4 border border-slate-200 dark:border-slate-700 transition-all font-semibold shadow-xs"
                      onClick={() => {
                        setGalleryTarget({ type: "cover" });
                        setIsPickerOpen(true);
                      }}
                    >
                      <Image className="w-4 h-4 text-slate-400" />
                      <span>{questionFile || formValues.imageUrl ? "Ganti Gambar Cover" : "Tambah Gambar Cover"}</span>
                    </button>

                    {(questionFile || formValues.imageUrl) && (
                      <div className="flex items-center gap-2.5 bg-white dark:bg-slate-900 p-1.5 pr-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
                        <div className="relative">
                          <img
                            src={questionFile ? URL.createObjectURL(questionFile) : formValues.imageUrl}
                            alt="Pratinjau Cover Soal"
                            className="h-12 w-auto max-w-[120px] object-cover rounded-md border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Gambar Terlampir</span>
                          {coverSizeInfo && (
                            <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40">
                              {coverSizeInfo}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormValues((prev) => ({ ...prev, imageUrl: "" }));
                            setQuestionFile(null);
                            setCoverSizeInfo("");
                          }}
                          className="ml-auto w-6 h-6 rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-colors"
                          title="Hapus gambar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 4: Kunci Jawaban & Opsi */}
                <div className="space-y-3.5 pt-1">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Jawaban & Kunci Penilaian
                      </span>
                    </div>
                    <span className="text-xs text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 px-2.5 py-1 rounded-full font-semibold">
                      MODE: {formValues.type.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>

                  {/* RENDER PILIHAN GANDA / PILIHAN GANDA KOMPLEKS */}
                  {(formValues.type === "pilihan_ganda" || formValues.type === "pilihan_ganda_kompleks") && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formValues.type === "pilihan_ganda"
                          ? "Pilih tepat satu opsi sebagai KUNCI jawaban benar."
                          : "Pilihan Ganda Kompleks: Anda dapat mencentang lebih dari satu opsi sebagai KUNCI jawaban benar."}
                      </p>

                      {Object.keys(formValues.choices).map((letter, index) => {
                        const isCorrect = !!formValues.choices[letter].isCorrect;
                        const hasImage = !!choiceFiles[letter] || !!formValues.choices[letter].imageUrl;
                        const imageUrl = choiceFiles[letter] ? URL.createObjectURL(choiceFiles[letter]!) : formValues.choices[letter].imageUrl;

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
                            className={`p-3 sm:p-3.5 border rounded-xl transition-all relative ${isCorrect
                                ? "bg-emerald-50/40 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800/60 shadow-xs"
                                : "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                              }`}
                          >
                            <div className="flex items-start gap-2.5 sm:gap-3">
                              {/* Drag handle & Letter badge */}
                              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pt-1.5">
                                <div
                                  onMouseEnter={() => setCanDrag(true)}
                                  onMouseLeave={() => setCanDrag(false)}
                                  className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                                  title="Tahan dan geser untuk ubah urutan opsi"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>

                                <div className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center transition-colors ${isCorrect
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                  }`}>
                                  {letter.toUpperCase()}
                                </div>
                              </div>

                              {/* ReactQuill Editor Opsi */}
                              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex-1 min-w-0 overflow-hidden shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10">
                                <ReactQuill
                                  key={selectedQuestion ? `edit-${selectedQuestion.id}-${letter}` : `create-${letter}`}
                                  theme="snow"
                                  value={formValues.choices[letter].text}
                                  onChange={(content, _delta, source) => {
                                    if (source !== 'user') return;
                                    handleChoiceChange(letter, 'text', content);
                                  }}
                                  placeholder={`Jawaban opsi ${letter.toUpperCase()} ...`}
                                  modules={quillModulesChoice}
                                  formats={quillFormatsChoice}
                                  className="[&_.ql-editor]:min-h-[52px] [&_.ql-editor]:py-2 [&_.ql-editor]:text-left [&_.ql-editor_p]:!text-left [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:px-2 [&_.ql-toolbar]:py-0.5 [&_.ql-toolbar]:bg-slate-50/70 dark:[&_.ql-toolbar]:bg-slate-800/60 [&_.ql-toolbar]:overflow-x-auto"
                                />

                                {/* Pratinjau Opsi jika showPreview aktif */}
                                {showPreview && formValues.choices[letter].text && (
                                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800">
                                    <MathText
                                      content={autoDetectLatex(formValues.choices[letter].text)}
                                      disableJustify={true}
                                      className="text-xs font-serif ql-editor !p-0 cbt-choice-text text-left text-slate-700 dark:text-slate-300"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* 1 Kolom 2 Baris: Kunci di atas, Gambar di bawah (Compact, hemat space) */}
                              <div className="flex flex-col gap-1.5 shrink-0 w-20 sm:w-22 pt-0.5">
                                {/* Baris 1: KUNCI */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className={`h-8 w-full text-xs font-bold rounded-lg transition-all border flex items-center justify-center gap-1 select-none active:scale-95 shadow-xs ${isCorrect
                                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:border-emerald-500 shadow-emerald-500/20"
                                      : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700"
                                    }`}
                                  size="sm"
                                  onClick={() => handleChoiceChange(letter, 'isCorrect', !isCorrect)}
                                  title="Jadikan sebagai kunci jawaban benar"
                                >
                                  {isCorrect ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                      <span>Kunci</span>
                                    </>
                                  ) : (
                                    <>
                                      <Key className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                      <span>Kunci</span>
                                    </>
                                  )}
                                </Button>

                                {/* Baris 2: GAMBAR */}
                                <button
                                  type="button"
                                  className={`h-8 w-full text-xs font-semibold rounded-lg transition-all border flex items-center justify-center gap-1 select-none active:scale-95 shadow-xs ${hasImage
                                      ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 dark:hover:bg-blue-900/40"
                                      : "bg-white hover:bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700"
                                    }`}
                                  onClick={() => {
                                    setGalleryTarget({ type: "choice", letter });
                                    setIsPickerOpen(true);
                                  }}
                                  title="Tambah atau ubah gambar opsi"
                                >
                                  <Image className="w-3.5 h-3.5" />
                                  <span>{hasImage ? "Ganti" : "Gambar"}</span>
                                </button>
                              </div>
                            </div>

                            {/* Image Thumbnail if attached */}
                            {hasImage && (
                              <div className="mt-2.5 pl-11 sm:pl-12 flex items-center gap-2.5">
                                <div className="relative group">
                                  <img
                                    src={imageUrl}
                                    alt={`Pratinjau ${letter}`}
                                    className="h-14 w-auto max-w-[130px] object-cover rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleChoiceChange(letter, "imageUrl", "");
                                      setChoiceFiles(prev => ({ ...prev, [letter]: null }));
                                    }}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-xs transition-colors"
                                    title="Hapus gambar opsi"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <span className="text-xs text-slate-400">Gambar opsi {letter.toUpperCase()}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* RENDER BENAR / SALAH (MATRIKS) */}
                  {formValues.type === "benar_salah" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Daftar Pernyataan & Kunci Jawaban
                        </span>
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                          Tabel Matriks ANBK
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {(formValues.statements || []).map((st, index) => (
                          <div
                            key={st.id || index}
                            className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center p-3 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-xs"
                          >
                            <div className="flex items-center gap-2.5 w-full sm:w-auto sm:flex-1">
                              <span className="w-7 h-7 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                {index + 1}
                              </span>
                              <Input
                                placeholder={`Tuliskan pernyataan ke-${index + 1}...`}
                                value={st.text}
                                onChange={(e) => {
                                  const updated = [...(formValues.statements || [])];
                                  updated[index] = { ...updated[index], text: e.target.value };
                                  setFormValues(prev => ({ ...prev, statements: updated }));
                                }}
                                className="h-10 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                              />
                            </div>

                            {/* Kunci Jawaban Benar / Salah (Segmented Pills) */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...(formValues.statements || [])];
                                  updated[index] = { ...updated[index], answer: "benar" };
                                  setFormValues(prev => ({ ...prev, statements: updated }));
                                }}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-xs active:scale-95 flex items-center gap-1.5 ${st.answer === "benar"
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:border-emerald-500 shadow-emerald-500/20"
                                    : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500"
                                  }`}
                              >
                                <Check className={`w-3.5 h-3.5 stroke-[2.5] ${st.answer === "benar" ? "text-white" : "text-slate-400 dark:text-slate-500"}`} />
                                <span>Benar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...(formValues.statements || [])];
                                  updated[index] = { ...updated[index], answer: "salah" };
                                  setFormValues(prev => ({ ...prev, statements: updated }));
                                }}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-xs active:scale-95 flex items-center gap-1.5 ${st.answer === "salah"
                                    ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500 dark:border-rose-500 shadow-rose-500/20"
                                    : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500"
                                  }`}
                              >
                                <X className={`w-3.5 h-3.5 stroke-[2.5] ${st.answer === "salah" ? "text-white" : "text-slate-400 dark:text-slate-500"}`} />
                                <span>Salah</span>
                              </button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const updated = (formValues.statements || []).filter((_, i) => i !== index);
                                  setFormValues(prev => ({ ...prev, statements: updated }));
                                }}
                                className="h-11 w-11 shrink-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 ml-1 rounded-xl"
                                disabled={(formValues.statements || []).length <= 1}
                                title="Hapus Pernyataan"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormValues(prev => {
                            const list = prev.statements || [];
                            const maxId = list.reduce((max: number, s: any) => {
                              const n = parseInt(s.id, 10);
                              return !isNaN(n) && n < 1000 && n > max ? n : max;
                            }, 0);
                            const newId = String(maxId + 1);
                            return {
                              ...prev,
                              statements: [...list, { id: newId, text: "", answer: "benar" }]
                            };
                          });
                        }}
                        className="w-full text-xs h-9 border-dashed rounded-xl font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Baris Pernyataan
                      </Button>
                    </div>
                  )}

                  {/* RENDER MATRIKS */}
                  {formValues.type === "matriks" && (
                    <div className="space-y-4">
                      {/* Editor Kolom */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Kolom Pilihan
                          </span>
                          <span className="text-xs text-teal-700 dark:text-teal-400 font-semibold bg-teal-50 dark:bg-teal-950/40 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800">
                            Min. 2 Kolom
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
                          Isi nama setiap kolom, mis. <span className="font-semibold text-slate-600 dark:text-slate-300">Setuju / Tidak Setuju</span> atau <span className="font-semibold text-slate-600 dark:text-slate-300">Ya / Tidak / Ragu</span>.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(formValues.matrixColumns || []).map((col, cIdx) => (
                            <div
                              key={col.id}
                              className="flex items-center gap-1.5 p-1.5 pl-2.5 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-xs"
                            >
                              <Input
                                value={col.text}
                                onChange={(e) => {
                                  const updated = [...(formValues.matrixColumns || [])];
                                  updated[cIdx] = { ...updated[cIdx], text: e.target.value };
                                  setFormValues(prev => ({ ...prev, matrixColumns: updated }));
                                }}
                                placeholder={`Nama kolom ${cIdx + 1}...`}
                                className="h-11 text-sm w-32 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const updated = (formValues.matrixColumns || []).filter((_, i) => i !== cIdx);
                                  setFormValues(prev => ({ ...prev, matrixColumns: updated }));
                                }}
                                disabled={(formValues.matrixColumns || []).length <= 2}
                                className="h-11 w-11 shrink-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                                title="Hapus Kolom"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFormValues(prev => {
                                const list = prev.matrixColumns || [];
                                const newId = `c${Date.now().toString(36)}`;
                                return { ...prev, matrixColumns: [...list, { id: newId, text: "" }] };
                              });
                            }}
                            className="h-11 text-xs border-dashed rounded-xl font-semibold text-teal-600 hover:text-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 px-4"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Kolom
                          </Button>
                        </div>
                      </div>

                      {/* Editor Pernyataan */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Daftar Pernyataan & Kunci Jawaban
                          </span>
                        </div>
                        <div className="space-y-2.5">
                          {(formValues.matrixStatements || []).map((st, index) => (
                            <div
                              key={st.id || index}
                              className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center p-3 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-xs"
                            >
                              <div className="flex items-center gap-2.5 w-full sm:w-auto sm:flex-1">
                                <span className="w-7 h-7 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                  {index + 1}
                                </span>
                                <Input
                                  placeholder={`Tuliskan pernyataan ke-${index + 1}...`}
                                  value={st.text}
                                  onChange={(e) => {
                                    const updated = [...(formValues.matrixStatements || [])];
                                    updated[index] = { ...updated[index], text: e.target.value };
                                    setFormValues(prev => ({ ...prev, matrixStatements: updated }));
                                  }}
                                  className="h-10 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                                />
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                <select
                                  value={st.answer}
                                  onChange={(e) => {
                                    const updated = [...(formValues.matrixStatements || [])];
                                    updated[index] = { ...updated[index], answer: e.target.value };
                                    setFormValues(prev => ({ ...prev, matrixStatements: updated }));
                                  }}
                                  className="h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold px-2.5 cursor-pointer text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                >
                                  {(formValues.matrixColumns || []).map((col) => (
                                    <option key={col.id} value={col.id}>
                                      {col.text || `(Kolom ${col.id})`}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const updated = (formValues.matrixStatements || []).filter((_, i) => i !== index);
                                    setFormValues(prev => ({ ...prev, matrixStatements: updated }));
                                  }}
                                  className="h-11 w-11 shrink-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl"
                                  disabled={(formValues.matrixStatements || []).length <= 1}
                                  title="Hapus Pernyataan"
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFormValues(prev => {
                              const list = prev.matrixStatements || [];
                              const newId = `s${Date.now().toString(36)}`;
                              const firstColId = (prev.matrixColumns || [])[0]?.id || "";
                              return {
                                ...prev,
                                matrixStatements: [...list, { id: newId, text: "", answer: firstColId }]
                              };
                            });
                          }}
                          className="w-full text-xs h-9 border-dashed rounded-xl font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Baris Pernyataan
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* RENDER KLASIFIKASI */}
                  {formValues.type === "klasifikasi" && (
                    <div className="space-y-4">
                      {/* Editor Kategori */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Kategori (boleh dipakai berulang)
                          </span>
                          <span className="text-xs text-violet-700 dark:text-violet-400 font-semibold bg-violet-50 dark:bg-violet-950/40 px-2.5 py-1 rounded-full border border-violet-200 dark:border-violet-800">
                            Min. 2 Kategori
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(formValues.klasifikasiCategories || []).map((cat, cIdx) => (
                            <div
                              key={cat.id}
                              className="flex items-center gap-1.5 p-1.5 pl-2.5 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-xs"
                            >
                              <Input
                                value={cat.text}
                                onChange={(e) => {
                                  const updated = [...(formValues.klasifikasiCategories || [])];
                                  updated[cIdx] = { ...updated[cIdx], text: e.target.value };
                                  setFormValues(prev => ({ ...prev, klasifikasiCategories: updated }));
                                }}
                                placeholder={`Kategori ${cIdx + 1}`}
                                className="h-8 text-xs w-28 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const updated = (formValues.klasifikasiCategories || []).filter((_, i) => i !== cIdx);
                                  setFormValues(prev => ({ ...prev, klasifikasiCategories: updated }));
                                }}
                                disabled={(formValues.klasifikasiCategories || []).length <= 2}
                                className="h-11 w-11 shrink-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                                title="Hapus Kategori"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFormValues(prev => {
                                const list = prev.klasifikasiCategories || [];
                                const newId = `k${Date.now().toString(36)}`;
                                return { ...prev, klasifikasiCategories: [...list, { id: newId, text: "" }] };
                              });
                            }}
                            className="h-11 text-xs border-dashed rounded-xl font-semibold text-violet-600 hover:text-violet-700 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 px-4"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Kategori
                          </Button>
                        </div>
                      </div>

                      {/* Toggle Acak */}
                      <label className="flex items-center gap-2.5 px-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!formValues.klasifikasiShuffle}
                          onChange={(e) => setFormValues(prev => ({ ...prev, klasifikasiShuffle: e.target.checked }))}
                          className="w-4 h-4 rounded accent-violet-600"
                        />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Acak urutan pernyataan saat ujian
                        </span>
                      </label>

                      {/* Editor Pernyataan */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Daftar Pernyataan & Kategori Benar
                          </span>
                        </div>
                        <div className="space-y-2.5">
                          {(formValues.klasifikasiStatements || []).map((st, index) => (
                            <div
                              key={st.id || index}
                              className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center p-3 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-xs"
                            >
                              <div className="flex items-center gap-2.5 w-full sm:w-auto sm:flex-1">
                                <span className="w-7 h-7 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                  {index + 1}
                                </span>
                                <Input
                                  placeholder={`Tuliskan pernyataan ke-${index + 1}...`}
                                  value={st.text}
                                  onChange={(e) => {
                                    const updated = [...(formValues.klasifikasiStatements || [])];
                                    updated[index] = { ...updated[index], text: e.target.value };
                                    setFormValues(prev => ({ ...prev, klasifikasiStatements: updated }));
                                  }}
                                  className="h-10 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                                />
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                <select
                                  value={st.answer}
                                  onChange={(e) => {
                                    const updated = [...(formValues.klasifikasiStatements || [])];
                                    updated[index] = { ...updated[index], answer: e.target.value };
                                    setFormValues(prev => ({ ...prev, klasifikasiStatements: updated }));
                                  }}
                                  className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold px-2.5 cursor-pointer text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 max-w-[160px]"
                                >
                                  {(formValues.klasifikasiCategories || []).map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.text || `(Kategori ${cat.id})`}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const updated = (formValues.klasifikasiStatements || []).filter((_, i) => i !== index);
                                    setFormValues(prev => ({ ...prev, klasifikasiStatements: updated }));
                                  }}
                                  className="h-11 w-11 shrink-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl"
                                  disabled={(formValues.klasifikasiStatements || []).length <= 1}
                                  title="Hapus Pernyataan"
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFormValues(prev => {
                              const list = prev.klasifikasiStatements || [];
                              const newId = `s${Date.now().toString(36)}`;
                              const firstCatId = (prev.klasifikasiCategories || [])[0]?.id || "";
                              return {
                                ...prev,
                                klasifikasiStatements: [...list, { id: newId, text: "", answer: firstCatId }]
                              };
                            });
                          }}
                          className="w-full text-xs h-9 border-dashed rounded-xl font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Baris Pernyataan
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* RENDER ISIAN RUMPANG */}
                  {formValues.type === "isian_rumpang" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1 flex-wrap gap-1.5">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Teks Bacaan
                          </span>
                          <span className="text-xs text-lime-700 dark:text-lime-400 font-semibold bg-lime-50 dark:bg-lime-950/40 px-2.5 py-1 rounded-full border border-lime-200 dark:border-lime-800">
                            Tulis [[1]], [[2]] untuk rumpang
                          </span>
                        </div>
                        <textarea
                          value={formValues.isianRumpangText}
                          onChange={(e) => {
                            const newText = e.target.value;
                            const detectedIds = detectRumpangIds(newText);
                            setFormValues(prev => {
                              const existing = prev.isianRumpangBlanks || [];
                              const synced = detectedIds.map(id => {
                                const found = existing.find(b => b.id === id);
                                return found || { id, answersText: "", caseSensitive: false };
                              });
                              return { ...prev, isianRumpangText: newText, isianRumpangBlanks: synced };
                            });
                          }}
                          placeholder="Contoh: Ibu kota Indonesia adalah [[1]] dan mata uangnya [[2]]."
                          rows={5}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm p-3 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-lime-500/20 focus:border-lime-500 resize-y"
                        />
                        {hasUnbalancedRumpang(formValues.isianRumpangText || "") && (
                          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-lg px-3 py-2">
                            ⚠️ Ada tanda [[ tanpa pasangan ]]. Periksa kembali penulisan rumpang.
                          </p>
                        )}
                        {detectRumpangIds(formValues.isianRumpangText || "").length > 0 && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
                            Terdeteksi <span className="font-bold text-lime-700 dark:text-lime-400">{detectRumpangIds(formValues.isianRumpangText || "").length} rumpang</span>: {detectRumpangIds(formValues.isianRumpangText || "").map(id => `[[${id}]]`).join(", ")}
                          </p>
                        )}
                      </div>

                      {(formValues.isianRumpangBlanks || []).length > 0 && (
                        <div className="space-y-2.5">
                          <div className="px-1">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                              Kunci Jawaban per Rumpang
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Pisahkan dengan koma jika ada beberapa jawaban yang diterima (mis. "Rupiah, IDR").
                            </p>
                          </div>
                          <div className="space-y-2.5">
                            {(formValues.isianRumpangBlanks || []).map((b, bIdx) => (
                              <div
                                key={b.id}
                                className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center p-3 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-xs"
                              >
                                <span className="shrink-0 px-2.5 py-1 rounded-lg bg-lime-100 dark:bg-lime-950/40 text-lime-800 dark:text-lime-300 text-xs font-black border border-lime-200 dark:border-lime-800/40 font-mono">
                                  [[{b.id}]]
                                </span>
                                <Input
                                  placeholder={`Jawaban benar untuk [[${b.id}]]...`}
                                  value={b.answersText}
                                  onChange={(e) => {
                                    const updated = [...(formValues.isianRumpangBlanks || [])];
                                    updated[bIdx] = { ...updated[bIdx], answersText: e.target.value };
                                    setFormValues(prev => ({ ...prev, isianRumpangBlanks: updated }));
                                  }}
                                  className="h-10 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                                />
                                <label className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none px-1">
                                  <input
                                    type="checkbox"
                                    checked={!!b.caseSensitive}
                                    onChange={(e) => {
                                      const updated = [...(formValues.isianRumpangBlanks || [])];
                                      updated[bIdx] = { ...updated[bIdx], caseSensitive: e.target.checked };
                                      setFormValues(prev => ({ ...prev, isianRumpangBlanks: updated }));
                                    }}
                                    className="w-4 h-4 rounded accent-lime-600"
                                  />
                                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap" title="Bedakan huruf besar/kecil">
                                    Case-sensitive
                                  </span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* RENDER HOTSPOT */}
                  {formValues.type === "hotspot" && (
                    <div className="space-y-4">
                      {/* Upload Gambar */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Gambar Hotspot <span className="text-rose-500">*</span>
                          </span>
                          <span className="text-xs text-sky-700 dark:text-sky-400 font-semibold bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-full border border-sky-200 dark:border-sky-800">
                            Wajib ada
                          </span>
                        </div>
                        {(hotspotFile || formValues.hotspotImageUrl) ? (
                          <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                            <img
                              src={hotspotFile ? URL.createObjectURL(hotspotFile) : formValues.hotspotImageUrl}
                              alt="Gambar hotspot"
                              className="w-full h-auto max-h-64 object-contain"
                            />
                            <div className="absolute top-2 right-2 flex gap-1.5">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => { setGalleryTarget({ type: "hotspot" }); setIsGalleryOpen(true); }}
                                className="text-xs h-8 shadow-md"
                              >
                                Ganti
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={() => {
                                  setHotspotFile(null);
                                  setFormValues(prev => ({ ...prev, hotspotImageUrl: "" }));
                                }}
                                className="h-11 w-11 shrink-0 shadow-md"
                                title="Hapus gambar"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => { setGalleryTarget({ type: "hotspot" }); globalFileInputRef.current?.click(); }}
                              className="text-xs h-10 px-4 rounded-xl font-semibold"
                            >
                              <Image className="w-4 h-4 mr-1.5" /> Upload Gambar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => { setGalleryTarget({ type: "hotspot" }); setIsGalleryOpen(true); }}
                              className="text-xs h-10 px-4 rounded-xl font-semibold"
                            >
                              <FolderOpen className="w-4 h-4 mr-1.5" /> Dari Galeri
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Mode */}
                      <div className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 px-1">
                          Mode Penilaian
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setFormValues(prev => ({ ...prev, hotspotMode: "any" }))}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-xs active:scale-95 ${formValues.hotspotMode === "any"
                              ? "bg-sky-600 text-white border-sky-600 dark:bg-sky-600"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-sky-400"
                              }`}
                          >
                            Satu saja
                            <span className="block text-xs font-normal opacity-80 mt-0.5">
                              Cukup klik salah satu area benar
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormValues(prev => ({ ...prev, hotspotMode: "all" }))}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-xs active:scale-95 ${formValues.hotspotMode === "all"
                              ? "bg-sky-600 text-white border-sky-600 dark:bg-sky-600"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-sky-400"
                              }`}
                          >
                            Semua area
                            <span className="block text-xs font-normal opacity-80 mt-0.5">
                              Harus klik semua area (skor parsial)
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Editor Area */}
                      {(hotspotFile || formValues.hotspotImageUrl) && (
                        <div className="space-y-2">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 px-1">
                            Area Target
                          </span>
                          <HotspotAreaEditor
                            imageUrl={hotspotFile ? URL.createObjectURL(hotspotFile) : formValues.hotspotImageUrl}
                            areas={formValues.hotspotAreas}
                            onChange={(areas) => setFormValues(prev => ({ ...prev, hotspotAreas: areas }))}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* RENDER MENJODOHKAN */}
                  {formValues.type === "menjodohkan" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 px-2">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pernyataan (Kiri)</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pasangan (Kanan)</span>
                      </div>
                      <div className="space-y-2.5">
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
                            className="flex gap-2.5 items-center p-3 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-xs"
                          >
                            <div
                              onMouseEnter={() => setCanDrag(true)}
                              onMouseLeave={() => setCanDrag(false)}
                              className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500"
                              title="Tahan dan geser untuk ubah urutan"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <Input
                              placeholder="Teks pernyataan kiri..."
                              value={pair.left}
                              onChange={(e) => handlePairChange(pair.id, "left", e.target.value)}
                              className="h-10 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                            />
                            <ArrowLeft className="w-4 h-4 rotate-180 text-slate-400 shrink-0" />
                            <Input
                              placeholder="Teks pasangan kanan..."
                              value={pair.right}
                              onChange={(e) => handlePairChange(pair.id, "right", e.target.value)}
                              className="h-10 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemovePair(pair.id)}
                              className="h-11 w-11 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl shrink-0"
                              disabled={formValues.pairs.length <= 1}
                              title="Hapus pasangan"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddPair}
                        className="w-full text-xs h-9 border-dashed rounded-xl font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Pasangan
                      </Button>
                    </div>
                  )}

                  {/* RENDER ISIAN SINGKAT / URAIAN */}
                  {(formValues.type === "isian_singkat" || formValues.type === "uraian") && (
                    <div className="space-y-2 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                      <label htmlFor="answerKey" className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
                        {formValues.type === "isian_singkat" ? "Kunci Jawaban Tepat" : "Pedoman / Contoh Jawaban Benar"}
                      </label>
                      <Input
                        id="answerKey"
                        placeholder={formValues.type === "isian_singkat" ? "Ketikkan kunci jawaban tepat..." : "Tulis contoh jawaban/pedoman penilaian di sini..."}
                        value={formValues.answerKey}
                        onChange={(e) => setFormValues(prev => ({ ...prev, answerKey: e.target.value }))}
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm h-10 shadow-xs"
                      />
                      {formValues.type === "isian_singkat" && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                          * Siswa harus menjawab identik dengan teks di atas untuk memperoleh nilai otomatis.
                        </p>
                      )}
                      {formValues.type === "uraian" && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                          * Jenis soal uraian / esai memerlukan koreksi dan penilaian manual oleh Guru di lembar penilaian.
                        </p>
                      )}
                    </div>
                  )}

                  {/* RENDER URUTKAN / DRAG AND DROP */}
                  {(formValues.type === "urutkan" || formValues.type === "drag_drop") && (
                    <div className="space-y-3">
                      <p className="text-xs text-indigo-700 dark:text-indigo-300 p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                        Ketik item di bawah ini dalam <strong>URUTAN YANG BENAR</strong>. Sistem akan mengacak urutannya saat lembar ujian dibuka oleh siswa.
                      </p>
                      <div className="space-y-2.5">
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
                            className="flex gap-2.5 items-center p-3 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-xs"
                          >
                            <div
                              onMouseEnter={() => setCanDrag(true)}
                              onMouseLeave={() => setCanDrag(false)}
                              className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500"
                              title="Tahan dan geser untuk ubah urutan"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <div className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs">
                              {index + 1}
                            </div>
                            <Input
                              placeholder={`Item ke-${index + 1}...`}
                              value={item.text}
                              onChange={(e) => handleItemChange(item.id, e.target.value)}
                              className="h-10 text-xs flex-1 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(item.id)}
                              className="h-11 w-11 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl shrink-0"
                              disabled={formValues.items.length <= 1}
                              title="Hapus item"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddItem}
                        className="w-full text-xs h-9 border-dashed rounded-xl font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Item
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/admin/bank-soal/questions")}
                  className="w-full sm:w-auto px-5 h-10 rounded-xl text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Batal
                </Button>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  {dialogMode === "create" && (
                    <Button
                      type="button"
                      onClick={(e) => handleSubmit(e, true)}
                      disabled={isSavingQuestion}
                      className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-10 px-4 shadow-sm shadow-emerald-500/20 active:scale-95 transition-all"
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
                    className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-10 px-5 shadow-sm shadow-indigo-500/20 active:scale-95 transition-all"
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
          </div>
        )}

      {/* Preview Dialog - kept */}
      {/* Dialog Preview Soal (CBT Look) */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl p-0 h-[92vh] sm:h-[95vh] w-[95vw] sm:w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-300" hideClose>
            {previewQuestion && (
              <>
                {/* CBT Header Replica - FIXED TOP */}
                <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 sm:px-10 py-5 sm:py-6 flex items-center justify-between z-20 backdrop-blur-md bg-white/90 dark:bg-slate-900/90">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl sm:text-2xl shadow-sm shadow-emerald-200 dark:shadow-none">
                      {questions.findIndex(q => q.id === previewQuestion.id) + 1}
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-[0.2em] leading-tight mb-1">Soal Ujian</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Pratinjau Siswa</span>
                        {previewQuestion.groupId && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 text-xs font-black uppercase tracking-widest">Grup: {previewQuestion.groupId}</span>
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
                        <div className="bg-slate-50 dark:bg-slate-950 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 mb-10 space-y-4 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                            <FileText className="w-16 h-16 sm:w-20 sm:h-20 text-emerald-800" />
                          </div>

                          <div className="flex items-center gap-3 mb-4 relative z-10">
                            <div className="h-5 sm:h-6 w-1 sm:w-1.5 rounded-full bg-emerald-600"></div>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500 dark:text-emerald-400">Bacaan / Stimulus</span>
                          </div>

                          <MathText
                            content={firstWithText.groupText || ""}
                            className={`leading-relaxed text-slate-800 dark:text-slate-200 font-serif ql-editor !p-0 !overflow-visible selection:bg-blue-100 dark:selection:bg-blue-900/40`}
                          />

                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end opacity-50 dark:opacity-100 text-right">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest italic">Bacalah teks dengan seksama sebelum memberikan jawaban.</span>
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
                          className="max-h-[300px] sm:max-h-[450px] rounded-2xl border-4 border-white dark:border-slate-800 shadow-sm transition-all group-hover:brightness-95"
                          alt="Question"
                        />
                        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                          <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                        </div>
                      </div>
                    )}

                    {/* Question Text */}
                    <MathText
                      content={previewQuestion.text}
                      className={`ql-editor !p-0 !overflow-visible font-serif text-lg sm:text-xl text-slate-800 dark:text-slate-100 leading-relaxed break-words [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_b]:text-slate-900 dark:[&_b]:text-white [&_p]:mb-3 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-10 [&_ul]:pl-10 selection:bg-emerald-100 dark:selection:bg-emerald-900/40`}
                    />

                    {/* Special Type Badge */}
                    {(previewQuestion.type === "pilihan_ganda_kompleks" || previewQuestion.type === "menjodohkan" || previewQuestion.type === "urutkan") && (
                      <div className="flex items-center gap-2 mb-6 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl w-fit">
                        <HelpCircle className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                          {previewQuestion.type === "pilihan_ganda_kompleks" ? "Pilih semua jawaban yang benar" :
                            previewQuestion.type === "menjodohkan" ? "Pasangkan pernyataan di bawah ini" :
                              "Urutkan pernyataan dengan benar"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Choices / Statements Container */}
                  <div className="space-y-3 pt-4">
                    {previewQuestion.type === "benar_salah" && previewQuestion.statements && previewQuestion.statements.length > 0 ? (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                              <th className="p-3.5 text-xs font-bold text-slate-700 dark:text-slate-300">Pernyataan</th>
                              <th className="w-28 p-3.5 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase">Kunci</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {previewQuestion.statements.map((s: any, idx: number) => (
                              <tr key={s.id || idx}>
                                <td className="p-3.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                                  <span className="font-bold mr-2 text-slate-400">{idx + 1}.</span>
                                  <MathText content={s.text} disableJustify={true} className="inline !p-0 [&_p]:inline" />
                                </td>
                                <td className="p-3.5 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${s.answer === "benar" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                    }`}>
                                    {s.answer || "benar"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : previewQuestion.type === "matriks" && (previewQuestion as any).options?.columns ? (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                        <table className="w-full text-left border-collapse min-w-[320px]">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                              <th className="p-3.5 text-xs font-bold text-slate-700 dark:text-slate-300">Pernyataan</th>
                              {((previewQuestion as any).options.columns || []).map((col: any) => (
                                <th key={col.id} className="p-3.5 text-center text-xs font-black text-teal-600 dark:text-teal-400 uppercase whitespace-nowrap">
                                  {col.text}
                                </th>
                              ))}
                              <th className="w-24 p-3.5 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase">Kunci</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {((previewQuestion as any).options.statements || []).map((s: any, idx: number) => {
                              const kunciCol = ((previewQuestion as any).options.columns || []).find((c: any) => c.id === s.answer);
                              return (
                                <tr key={s.id || idx}>
                                  <td className="p-3.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                                    <span className="font-bold mr-2 text-slate-400">{idx + 1}.</span>
                                    <MathText content={s.text} disableJustify={true} className="inline !p-0 [&_p]:inline" />
                                  </td>
                                  {((previewQuestion as any).options.columns || []).map((col: any) => (
                                    <td key={col.id} className="p-3.5 text-center">
                                      <span className={`inline-block w-4 h-4 rounded-full border-2 ${col.id === s.answer ? "bg-teal-500 border-teal-600" : "border-slate-300 dark:border-slate-600"}`} />
                                    </td>
                                  ))}
                                  <td className="p-3.5 text-center">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400">
                                      {kunciCol?.text || "-"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : previewQuestion.type === "klasifikasi" && (previewQuestion as any).options?.categories ? (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                              <th className="p-3.5 text-xs font-bold text-slate-700 dark:text-slate-300">Pernyataan</th>
                              <th className="w-36 p-3.5 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase">Kategori Benar</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {((previewQuestion as any).options.statements || []).map((s: any, idx: number) => {
                              const kunciCat = ((previewQuestion as any).options.categories || []).find((c: any) => c.id === s.answer);
                              return (
                                <tr key={s.id || idx}>
                                  <td className="p-3.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                                    <span className="font-bold mr-2 text-slate-400">{idx + 1}.</span>
                                    <MathText content={s.text} disableJustify={true} className="inline !p-0 [&_p]:inline" />
                                  </td>
                                  <td className="p-3.5 text-center">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400">
                                      {kunciCat?.text || "-"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Kategori tersedia: {((previewQuestion as any).options.categories || []).map((c: any) => c.text).join(", ")}
                            {(previewQuestion as any).options.shuffleStatements !== false && " • Urutan pernyataan diacak saat ujian"}
                          </p>
                        </div>
                      </div>
                    ) : previewQuestion.type === "isian_rumpang" && (previewQuestion as any).options?.text ? (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 sm:p-5">
                        <p className="text-xs font-black text-lime-700 dark:text-lime-400 uppercase tracking-widest mb-3">
                          Pratinjau Isian Rumpang
                        </p>
                        <div className="text-sm sm:text-base text-slate-800 dark:text-slate-200 leading-loose">
                          {(previewQuestion as any).options.text.split(/(\[\[\d+\]\])/g).map((part: string, idx: number) => {
                            const m = part.match(/\[\[(\d+)\]\]/);
                            if (m) {
                              const blank = ((previewQuestion as any).options.blanks || []).find((b: any) => String(b.id) === m[1]);
                              return (
                                <span key={idx} className="inline-flex flex-col items-center mx-1 align-middle">
                                  <input
                                    disabled
                                    placeholder={`[[${m[1]}]]`}
                                    className="h-9 min-w-[100px] text-sm text-center rounded-lg border-2 border-dashed border-lime-300 dark:border-lime-700 bg-lime-50/50 dark:bg-lime-950/20 px-2"
                                  />
                                  {blank && (
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                      {(blank.answers || []).join(" / ")}
                                    </span>
                                  )}
                                </span>
                              );
                            }
                            return <span key={idx}>{part}</span>;
                          })}
                        </div>
                      </div>
                    ) : previewQuestion.type === "hotspot" && (previewQuestion as any).options?.imageUrl ? (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 sm:p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-sky-700 dark:text-sky-400 uppercase tracking-widest">
                            Pratinjau Hotspot
                          </p>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            {(previewQuestion as any).options.mode === "all" ? "Mode: Semua area" : "Mode: Satu saja"} • {((previewQuestion as any).options.areas || []).length} area
                          </span>
                        </div>
                        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                          <img
                            src={(previewQuestion as any).options.imageUrl}
                            alt="Gambar hotspot"
                            className="w-full h-auto block"
                          />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Area target: {((previewQuestion as any).options.areas || []).map((a: any) => a.label).join(", ") || "-"}
                          <span className="italic"> (tidak ditampilkan ke siswa)</span>
                        </p>
                      </div>
                    ) : (previewQuestion.type === "pilihan_ganda" || previewQuestion.type === "pilihan_ganda_kompleks" || previewQuestion.type === "benar_salah" || !previewQuestion.type) && (
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
                              <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Pernyataan</div>
                              {p.left}
                            </div>
                            <div className="hidden sm:flex items-center justify-center text-emerald-500">
                              <Forward className="w-8 h-8" />
                            </div>
                            <div className="flex-1 p-5 bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-dashed border-emerald-400/50 rounded-3xl font-serif text-emerald-800 dark:text-emerald-400 shadow-inner flex flex-col justify-center">
                              <div className="text-xs font-black text-emerald-600/50 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Pasangan Benar
                              </div>
                              <div className="text-lg font-black">{p.right}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(previewQuestion.type === "isian_singkat" || previewQuestion.type === "uraian") && (
                      <div className="p-8 sm:p-10 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/20 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg">
                            <Check className="w-6 h-6 stroke-[3px]" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-blue-600/70 dark:text-blue-400/70 uppercase tracking-widest block">Kunci Jawaban / Pedoman</span>
                            <span className="text-xs text-blue-400 font-bold uppercase tracking-tighter">Hanya terlihat oleh Administrator</span>
                          </div>
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-blue-100 dark:border-blue-800/40 shadow-sm">
                          {previewQuestion.answerKey || "(Belum diisi)"}
                        </div>
                      </div>
                    )}

                    {(previewQuestion.type === "urutkan" || previewQuestion.type === "drag_drop") && (
                      <div className="space-y-4 pt-2">
                        {(previewQuestion.items || []).map((it, idx) => (
                          <div key={it.id} className="flex items-center gap-5 p-5 rounded-3xl border-2 border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm group">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-sm shadow-indigo-200 dark:shadow-none transition-transform group-hover:rotate-6">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-0.5">Urutan Benar</div>
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
                            <span className="text-white text-xs font-bold bg-indigo-600 px-3 py-1.5 rounded-lg shadow-sm tracking-widest uppercase">Pilih</span>
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
          onConfirm={() => {
            if (confirmModal.onConfirm) confirmModal.onConfirm();
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
