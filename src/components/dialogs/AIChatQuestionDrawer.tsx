import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Bot,
  Sparkles,
  RefreshCw,
  Trash2,
  CheckCircle2,
  FileText,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  EyeOff,
  Plus,
  Save,
  Check,
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Image,
  Upload,
  Bookmark,
  Copy
} from "lucide-react";
import { cn } from "../../lib/utils";
import { NeonButton } from "../ui/NeonButton";
import { MathText } from "../ui/MathText";
import { useTenant } from "../../context/TenantContext";
import { useToast } from "../ui/toast";
import {
  chatQuestionAssistantAI,
  type AIGeneratedQuestion,
  type AIChatMessage
} from "../../lib/ai";
import { overlayTransition } from "../../lib/motion";
import { SharedGalleryModal } from "./SharedGalleryModal";
import { compressImage } from "../../lib/imageCompression";
import { uploadInventoryImage } from "../../lib/storage";

export interface DraftQuestionItem {
  id: string;
  text: string;
  type: string;
  imageUrl?: string;
  choices: Record<string, { text: string; isCorrect: boolean }>;
  correctKey: string;
  answerKey?: string;
  pairs?: Array<{ id: string; left: string; right: string }>;
  statements?: Array<{ id: string; text: string; answer?: "benar" | "salah" }>;
  items?: Array<{ id: string; text: string }>;
}

export interface AIChatQuestionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  exam?: {
    id: string;
    name: string;
    subject?: string;
  };
  onApplyQuestions?: (questions: AIGeneratedQuestion[]) => void;
  onSavedQuestionsSuccess?: () => void;
}

const QUICK_PROMPT_PRESETS = [
  "Buat 5 soal pilihan ganda tingkat sedang",
  "Buat 5 soal HOTS berbasis studi kasus",
  "Buat 3 soal pilihan ganda dan 2 uraian",
  "Buat paket soal literasi dengan wacana"
];

const FOLLOW_UP_SUGGESTIONS = [
  "Buat tingkat kesulitan lebih menantang (HOTS)",
  "Tambahkan 2 soal uraian / essay",
  "Ganti salah satu soal dengan soal cerita",
  "Periksa dan pastikan opsi pengecoh tidak multitafsir"
];

const TYPE_MAP: Record<string, string> = {
  pilihan_ganda: "multiple_choice",
  pilihan_ganda_kompleks: "complex_choice",
  menjodohkan: "matching",
  benar_salah: "true_false",
  isian_singkat: "short_answer",
  uraian: "essay"
};

/**
 * ChatMessageMarkdown:
 * Merender respon obrolan asisten AI dengan tata letak yang sangat rapi,
 * elegan, dan terstruktur ala ChatGPT / Claude (header, bullet points, numbered lists,
 * kode program, dan teks cetak tebal).
 */
const ChatMessageMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  const normalized = React.useMemo(() => {
    if (!content) return "";
    let res = content;
    res = res.replace(/(\*\*\s*[\p{Emoji}\u200d\p{Punctuation}\w\s]+?\*\*)/gu, "\n\n$1\n");
    res = res.replace(/\s+-\s+([A-Z0-9\p{Emoji}])/gu, "\n• $1");
    res = res.replace(/\n{3,}/g, "\n\n").trim();
    return res;
  }, [content]);

  const blocks = React.useMemo(() => {
    const lines = normalized.split("\n");
    const result: Array<
      | { type: "header"; level: number; text: string }
      | { type: "bullet"; items: string[] }
      | { type: "numbered"; items: string[] }
      | { type: "paragraph"; text: string }
      | { type: "code"; lang: string; code: string }
    > = [];

    let currentList: { type: "bullet" | "numbered"; items: string[] } | null = null;
    let inCodeBlock = false;
    let codeLang = "";
    let codeLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          result.push({ type: "code", lang: codeLang, code: codeLines.join("\n") });
          inCodeBlock = false;
          codeLang = "";
          codeLines = [];
        } else {
          if (currentList) {
            result.push(currentList);
            currentList = null;
          }
          inCodeBlock = true;
          codeLang = line.trim().replace(/^```/, "").trim();
          codeLines = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      const headerMatch = line.match(/^(#{1,3})\s+(.*)$/);
      if (headerMatch) {
        if (currentList) {
          result.push(currentList);
          currentList = null;
        }
        result.push({ type: "header", level: headerMatch[1].length, text: headerMatch[2] });
        continue;
      }

      const bulletMatch = line.match(/^[\*\-•]\s+(.*)$/);
      if (bulletMatch) {
        if (!currentList || currentList.type !== "bullet") {
          if (currentList) result.push(currentList);
          currentList = { type: "bullet", items: [] };
        }
        currentList.items.push(bulletMatch[1]);
        continue;
      }

      const numMatch = line.match(/^(\d+)[\.\)]\s+(.*)$/);
      if (numMatch) {
        if (!currentList || currentList.type !== "numbered") {
          if (currentList) result.push(currentList);
          currentList = { type: "numbered", items: [] };
        }
        currentList.items.push(numMatch[2]);
        continue;
      }

      if (!line.trim()) {
        if (currentList) {
          result.push(currentList);
          currentList = null;
        }
        continue;
      }

      if (currentList) {
        result.push(currentList);
        currentList = null;
      }
      result.push({ type: "paragraph", text: line });
    }

    if (currentList) result.push(currentList);
    if (inCodeBlock) {
      result.push({ type: "code", lang: codeLang, code: codeLines.join("\n") });
    }

    return result;
  }, [normalized]);

  const renderInlineFormatted = (str: string) => {
    const codeParts = str.split(/(`[^`]+`)/g);
    return codeParts.map((part, pIdx) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code
            key={pIdx}
            className="px-1.5 py-0.5 mx-0.5 rounded-md bg-neutral-200/70 dark:bg-neutral-800 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-semibold border border-neutral-300/60 dark:border-neutral-700/60"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, bIdx) => {
        if (bPart.startsWith("**") && bPart.endsWith("**") && bPart.length > 4) {
          return (
            <strong key={bIdx} className="font-bold text-neutral-900 dark:text-neutral-100">
              {bPart.slice(2, -2)}
            </strong>
          );
        }

        const italicParts = bPart.split(/(\*[^*]+\*)/g);
        return italicParts.map((iPart, iIdx) => {
          if (iPart.startsWith("*") && iPart.endsWith("*") && iPart.length > 2) {
            return (
              <em key={iIdx} className="italic text-neutral-700 dark:text-neutral-300">
                {iPart.slice(1, -1)}
              </em>
            );
          }
          return <MathText key={iIdx} content={iPart} disableJustify />;
        });
      });
    });
  };

  return (
    <div className="space-y-2 text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans">
      {blocks.map((block, bIdx) => {
        if (block.type === "header") {
          return (
            <h4
              key={bIdx}
              className="font-bold text-neutral-900 dark:text-neutral-100 pt-2.5 pb-1 tracking-tight flex items-center gap-1.5 text-xs sm:text-sm border-b border-neutral-200/60 dark:border-neutral-800/80"
            >
              {renderInlineFormatted(block.text)}
            </h4>
          );
        }

        if (block.type === "bullet") {
          return (
            <ul key={bIdx} className="space-y-1.5 my-2 pl-0.5">
              {block.items.map((item, iIdx) => (
                <li key={iIdx} className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-2" />
                  <span className="flex-1">{renderInlineFormatted(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "numbered") {
          return (
            <ol key={bIdx} className="space-y-1.5 my-2 pl-0.5">
              {block.items.map((item, iIdx) => (
                <li key={iIdx} className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed">
                  <span className="font-mono font-bold text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                    {iIdx + 1}.
                  </span>
                  <span className="flex-1">{renderInlineFormatted(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "code") {
          return (
            <div
              key={bIdx}
              className="my-2.5 rounded-xl bg-neutral-900 text-neutral-100 overflow-hidden shadow-xs border border-neutral-800"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-950/80 border-b border-neutral-800 text-[10px] text-neutral-400">
                <span className="font-mono uppercase font-bold text-emerald-400">
                  {block.lang || "code"}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(block.code, bIdx)}
                  className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedCodeIdx === bIdx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed text-neutral-200">
                {block.code}
              </pre>
            </div>
          );
        }

        return (
          <p key={bIdx} className="leading-relaxed">
            {renderInlineFormatted(block.text)}
          </p>
        );
      })}
    </div>
  );
};

export const AIChatQuestionDrawer: React.FC<AIChatQuestionDrawerProps> = ({
  isOpen,
  onClose,
  exam,
  onApplyQuestions,
  onSavedQuestionsSuccess
}) => {
  const { pb } = useTenant();
  const { addToast } = useToast();

  const chatStorageKey = exam?.id
    ? `examku_ai_chat_exam_${exam.id}`
    : "examku_ai_chat_general";

  const reviewStorageKey = exam?.id
    ? `examku_ai_review_exam_${exam.id}`
    : "examku_ai_review_general";

  const [activeTab, setActiveTab] = useState<"chat" | "review">(() => {
    if (typeof window === "undefined") return "chat";
    try {
      const savedReview = localStorage.getItem(exam?.id ? `examku_ai_review_exam_${exam.id}` : "examku_ai_review_general");
      if (savedReview) {
        const parsed = JSON.parse(savedReview);
        if (Array.isArray(parsed) && parsed.length > 0) return "review";
      }
    } catch { }
    return "chat";
  });

  const [speedMode, setSpeedMode] = useState<"fast" | "accurate">(() => {
    if (typeof window === "undefined") return "fast";
    return (localStorage.getItem("examku_ai_speed_mode") as "fast" | "accurate") || "fast";
  });

  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [tabBadgePulse, setTabBadgePulse] = useState(false);

  useEffect(() => {
    let timer: any;
    if (isLoading) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds(s => s + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isLoading]);

  // Chat Messages State
  const [messages, setMessages] = useState<AIChatMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const key = exam?.id ? `examku_ai_chat_exam_${exam.id}` : "examku_ai_chat_general";
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("[AIChatDrawer] Gagal membaca riwayat chat:", e);
    }
    return [];
  });

  // Draft Questions State for Review & Edit Mode
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestionItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const key = exam?.id ? `examku_ai_review_exam_${exam.id}` : "examku_ai_review_general";
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("[AIChatDrawer] Gagal membaca draft review:", e);
    }
    return [];
  });

  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number | null>(null);
  const [targetFileIndex, setTargetFileIndex] = useState<number | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Simpan speedMode preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("examku_ai_speed_mode", speedMode);
    }
  }, [speedMode]);

  // Sinkronisasi riwayat chat saat exam berubah
  useEffect(() => {
    if (typeof window === "undefined" || !chatStorageKey) return;
    try {
      const saved = localStorage.getItem(chatStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
          const latestWithQ = [...parsed].reverse().find(m => m.questions && m.questions.length > 0);
          if (latestWithQ) {
            setExpandedCards(prev => ({ ...prev, [latestWithQ.id]: true }));
          }
          return;
        }
      }
      setMessages([]);
    } catch (e) {
      setMessages([]);
    }
  }, [chatStorageKey]);

  // Simpan riwayat chat ke localStorage (hemat DB)
  useEffect(() => {
    if (typeof window === "undefined" || !chatStorageKey) return;
    try {
      if (messages.length > 0) {
        const truncated = messages.slice(-30);
        localStorage.setItem(chatStorageKey, JSON.stringify(truncated));
      } else {
        localStorage.removeItem(chatStorageKey);
      }
    } catch (e) {
      console.warn("[AIChatDrawer] Gagal simpan chat ke localStorage:", e);
    }
  }, [messages, chatStorageKey]);

  // Simpan draft review ke localStorage saat diedit
  useEffect(() => {
    if (typeof window === "undefined" || !reviewStorageKey) return;
    try {
      if (draftQuestions.length > 0) {
        localStorage.setItem(reviewStorageKey, JSON.stringify(draftQuestions));
      } else {
        localStorage.removeItem(reviewStorageKey);
      }
    } catch (e) {
      console.warn("[AIChatDrawer] Gagal simpan review ke localStorage:", e);
    }
  }, [draftQuestions, reviewStorageKey]);

  // Auto scroll chat
  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, activeTab]);

  // Fokus input saat drawer terbuka di tab chat
  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      setTimeout(() => textareaRef.current?.focus(), 250);
    }
  }, [isOpen, activeTab]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputPrompt).trim();
    if (!text || isLoading || !pb) return;

    setInputPrompt("");
    const userMsgId = `u-${Date.now()}`;
    const newHistory: AIChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        role: "user",
        content: text,
        timestamp: Date.now()
      }
    ];
    setMessages(newHistory);
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const lastAssistantQuestions = [...newHistory]
        .reverse()
        .find(m => m.role === "assistant" && m.questions && m.questions.length > 0)
        ?.questions || [];

      // Flash Mode mengoptimasi parameter prompt & token pada model yang dikonfigurasi admin
      const result = await chatQuestionAssistantAI({
        pb,
        messages: newHistory.map(m => {
          if (m.role === "assistant" && m.questions && m.questions.length > 0) {
            // Gunakan JSON terstruktur agar model tidak meniru format teks bebas pada giliran berikutnya
            return {
              role: m.role,
              content: JSON.stringify({
                reply: m.content || "Siap.",
                questions: m.questions
              })
            };
          }
          return { role: m.role, content: m.content };
        }),
        currentQuestions: lastAssistantQuestions,
        context: {
          subject: exam?.subject,
          examName: exam?.name
        },
        speedMode,
        signal: abortControllerRef.current.signal
      });

      const assistantMsgId = `a-${Date.now()}`;
      setMessages(prev => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: result.replyText,
          questions: result.questions,
          timestamp: Date.now()
        }
      ]);

      if (result.questions && result.questions.length > 0) {
        setExpandedCards(prev => ({ ...prev, [assistantMsgId]: true }));
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setMessages(prev => [
          ...prev,
          {
            id: `abort-${Date.now()}`,
            role: "assistant",
            content: "Pembuatan soal dihentikan.",
            timestamp: Date.now()
          }
        ]);
        return;
      }
      console.error("[AIChatDrawer] Error:", err);
      const isRateLimit = err?.message?.includes("AI_RATE_LIMIT");
      addToast({
        type: "error",
        title: isRateLimit ? "Batas Kuota AI Tercapai" : "Gagal Memproses Pesan",
        description: isRateLimit
          ? "Kuota token tercapai. Ganti model atau tunggu beberapa saat."
          : (err?.message || "Kendala jaringan saat menghubungi AI.")
      });

      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Maaf, terjadi kendala saat memproses permintaan tersebut. Silakan coba kembali atau gunakan instruksi yang lebih spesifik.",
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    if (messages.length > 0) {
      const confirmReset = window.confirm("Mulai obrolan baru dan bersihkan riwayat chat untuk ujian ini?");
      if (!confirmReset) return;
    }
    setMessages([]);
    setInputPrompt("");
    setExpandedCards({});
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(chatStorageKey);
      }
    } catch { }
    addToast({
      type: "info",
      title: "Riwayat Dibersihkan",
      description: "Riwayat obrolan lokal telah dikosongkan."
    });
  };

  // Helper: Konversi butir soal hasil generate AI ke format draf editor
  const buildDraftItemsFromGenerated = (questions: AIGeneratedQuestion[]): DraftQuestionItem[] => {
    return questions.map((q, idx) => {
      const qType = q.type || "pilihan_ganda";
      const choicesObj: Record<string, { text: string; isCorrect: boolean }> = {};
      let correctKey = (q.answerKey || "").toLowerCase();

      if (q.choices) {
        if (Array.isArray(q.choices)) {
          q.choices.forEach((c: any, i: number) => {
            const letter = String.fromCharCode(97 + i);
            const isCorrect = typeof c === "object" ? !!c.isCorrect : letter === correctKey;
            choicesObj[letter] = {
              text: typeof c === "object" ? (c.text || String(c)) : String(c),
              isCorrect
            };
            if (isCorrect && !correctKey) correctKey = letter;
          });
        } else {
          Object.keys(q.choices).forEach(key => {
            const lowerKey = key.toLowerCase();
            const val = (q.choices as any)[key];
            const isCorrect = typeof val === "object" ? !!val.isCorrect : lowerKey === correctKey;
            choicesObj[lowerKey] = {
              text: typeof val === "object" ? (val.text || String(val)) : String(val),
              isCorrect
            };
            if (isCorrect && !correctKey) correctKey = lowerKey;
          });
        }
        // Pastikan pilihan ganda selalu memiliki 5 opsi lengkap A-E
        if (qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks") {
          ["a", "b", "c", "d", "e"].forEach(letter => {
            if (!choicesObj[letter]) {
              choicesObj[letter] = { text: "", isCorrect: false };
            }
          });
        }
      } else if (qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks") {
        ["a", "b", "c", "d", "e"].forEach(letter => {
          choicesObj[letter] = { text: "", isCorrect: letter === "a" };
        });
        if (!correctKey) correctKey = "a";
      }

      let cleanText = q.text || "";
      let pairs = q.pairs && Array.isArray(q.pairs) && q.pairs.length > 0
        ? q.pairs.map((p, pI) => ({ id: p.id || String(pI + 1), left: p.left || "", right: p.right || "" }))
        : [];

      // Auto-salvage Menjodohkan jika AI meletakkan definisi di dalam teks pertanyaan
      if (qType === "menjodohkan") {
        const textLines = cleanText.split("\n").map(l => l.trim()).filter(Boolean);
        const listItemsFromText: string[] = [];
        const mainTextLines: string[] = [];
        for (const line of textLines) {
          const match = line.match(/^([a-zA-Z0-9][.)\-:]\s*)(.+)$/);
          if (match) {
            listItemsFromText.push(match[2].trim());
          } else {
            mainTextLines.push(line);
          }
        }

        const choiceTexts = Object.values(choicesObj || {}).map(c => c.text?.trim()).filter(Boolean);
        const isPairsIncomplete = pairs.length === 0 || pairs.every(p => !p.right?.trim());

        if (isPairsIncomplete && listItemsFromText.length >= 2) {
          const count = Math.max(listItemsFromText.length, choiceTexts.length);
          const oldPairs = [...pairs];
          pairs = [];
          for (let i = 0; i < count; i++) {
            const rawLeft = oldPairs[i]?.left?.trim() || "";
            const isDigitOnly = /^\d+[.)\-:]?\s*$/.test(rawLeft);
            pairs.push({
              id: String(i + 1),
              left: (!isDigitOnly && rawLeft) ? rawLeft : (choiceTexts[i] || `Premis ${i + 1}`),
              right: listItemsFromText[i] || ""
            });
          }
          if (mainTextLines.length > 0) {
            cleanText = mainTextLines.join("\n").replace(/Definisi:?\s*$/i, "").trim() || "Jodohkan setiap istilah berikut dengan definisinya yang tepat:";
          }
        } else if (pairs.length === 0) {
          pairs = [
            { id: "1", left: "", right: "" },
            { id: "2", left: "", right: "" },
            { id: "3", left: "", right: "" }
          ];
        }
      }

      let statements = q.statements && Array.isArray(q.statements) && q.statements.length > 0
        ? q.statements.map((s, sI) => ({
            id: s.id || String(sI + 1),
            text: s.text || "",
            answer: (s.answer || "benar").toString().toLowerCase().includes("salah") ? ("salah" as const) : ("benar" as const)
          }))
        : [];

      let items = q.items && Array.isArray(q.items) && q.items.length > 0
        ? q.items.map((it, itI) => ({ id: it.id || String(itI + 1), text: it.text || "" }))
        : ((qType === "urutkan" || qType === "drag_drop") ? [
            { id: "1", text: "" },
            { id: "2", text: "" },
            { id: "3", text: "" }
          ] : []);

      if (qType === "benar_salah" && statements.length === 0) {
        if (!choicesObj["a"] && !choicesObj["b"]) {
          choicesObj["a"] = { text: "Benar", isCorrect: correctKey !== "b" };
          choicesObj["b"] = { text: "Salah", isCorrect: correctKey === "b" };
          if (!correctKey) correctKey = "a";
        }
      }

      return {
        id: `draft-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        text: cleanText,
        type: qType,
        imageUrl: q.imageUrl || "",
        choices: choicesObj,
        correctKey: correctKey || "a",
        answerKey: q.answerKey || "",
        pairs,
        statements,
        items
      };
    });
  };

  // 1. Simpan soal ke tab Kelola & Tinjau (tetap di chat, visual feedback informatif)
  const handleSaveQuestionsToReview = (msgId: string, questions: AIGeneratedQuestion[]) => {
    if (!questions || questions.length === 0) return;
    const newDrafts = buildDraftItemsFromGenerated(questions);

    setDraftQuestions(prev => {
      const updated = [...prev, ...newDrafts];
      try {
        localStorage.setItem(reviewStorageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setSavedMessageIds(prev => new Set(prev).add(msgId));

    // Animasi visual pada tab Kelola & Tinjau di header
    setTabBadgePulse(true);
    setTimeout(() => setTabBadgePulse(false), 3000);
  };

  // 2. Buat Ulang (Regenerate) batch soal
  const handleRegenerate = (msgId: string) => {
    if (isLoading) return;
    const msgIndex = messages.findIndex(m => m.id === msgId);
    const prevUserMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === "user");
    const promptToRun = prevUserMsg?.content;
    if (!promptToRun) {
      addToast({
        type: "warning",
        title: "Gagal Buat Ulang",
        description: "Tidak menemukan instruksi sebelumnya untuk dibuat ulang."
      });
      return;
    }
    handleSendMessage(`Buat ulang butir soal baru dengan topik yang sama: ${promptToRun}`);
  };

  // 3. Transisi langsung dari Chat ke Mode Review di dalam Drawer
  const handleTransitionToReview = (questions: AIGeneratedQuestion[]) => {
    if (!questions || questions.length === 0) return;
    const drafts = buildDraftItemsFromGenerated(questions);
    setDraftQuestions(drafts);
    setActiveTab("review");
  };

  // Editor Actions untuk Mode Review
  const updateDraftQuestionImage = (index: number, imageUrl?: string) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], imageUrl };
      return copy;
    });
  };

  const handleManualImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || targetFileIndex === null) return;

    try {
      addToast({
        type: "info",
        title: "Mengunggah Gambar...",
        description: `Sedang memproses dan mengunggah ${file.name}.`
      });

      const compressed = await compressImage(file);
      const targetFolder = exam?.id ? `questions/${exam.id}` : "questions/general";
      const uploaded = await uploadInventoryImage(targetFolder, compressed);

      updateDraftQuestionImage(targetFileIndex, uploaded.url);

      addToast({
        type: "success",
        title: "Gambar Berhasil Dilampirkan",
        description: "Gambar telah siap pada butir soal."
      });
    } catch (err: any) {
      console.error("[AIChatDrawer] Gagal unggah gambar manual:", err);
      addToast({
        type: "error",
        title: "Gagal Mengunggah",
        description: err?.message || "Terjadi kesalahan saat mengunggah gambar."
      });
    } finally {
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
      setTargetFileIndex(null);
    }
  };
  const updateDraftQuestionText = (index: number, text: string) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], text };
      return copy;
    });
  };

  const updateDraftChoiceText = (qIndex: number, choiceKey: string, text: string) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const choices = { ...copy[qIndex].choices };
      if (choices[choiceKey]) {
        choices[choiceKey] = { ...choices[choiceKey], text };
        copy[qIndex] = { ...copy[qIndex], choices };
      }
      return copy;
    });
  };

  const setDraftChoiceCorrect = (qIndex: number, choiceKey: string) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const q = copy[qIndex];
      const isComplex = q.type === "pilihan_ganda_kompleks";

      const choices = { ...q.choices };
      if (isComplex) {
        choices[choiceKey] = { ...choices[choiceKey], isCorrect: !choices[choiceKey].isCorrect };
        const keys = Object.keys(choices).filter(k => choices[k].isCorrect);
        copy[qIndex] = { ...q, choices, correctKey: keys.join(",") };
      } else {
        Object.keys(choices).forEach(k => {
          choices[k] = { ...choices[k], isCorrect: k === choiceKey };
        });
        copy[qIndex] = { ...q, choices, correctKey: choiceKey };
      }
      return copy;
    });
  };

  const addDraftChoice = (qIndex: number) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const choices = { ...copy[qIndex].choices };
      const currentKeys = Object.keys(choices);
      if (currentKeys.length >= 8) return prev;
      const nextLetter = String.fromCharCode(97 + currentKeys.length);
      choices[nextLetter] = { text: "", isCorrect: false };
      copy[qIndex] = { ...copy[qIndex], choices };
      return copy;
    });
  };

  const removeDraftChoice = (qIndex: number, choiceKey: string) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const choices = { ...copy[qIndex].choices };
      delete choices[choiceKey];
      copy[qIndex] = { ...copy[qIndex], choices };
      return copy;
    });
  };

  const updateDraftQuestionType = (index: number, newType: string) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const q = copy[index];
      if (q.type === newType) return copy;

      let cleanText = q.text;
      let pairs = q.pairs;
      if (newType === "menjodohkan") {
        const textLines = (q.text || "").split("\n").map(l => l.trim()).filter(Boolean);
        const listItemsFromText: string[] = [];
        const mainTextLines: string[] = [];
        for (const line of textLines) {
          const match = line.match(/^([a-zA-Z0-9][.)\-:]\s*)(.+)$/);
          if (match) {
            listItemsFromText.push(match[2].trim());
          } else {
            mainTextLines.push(line);
          }
        }

        const rawChoiceTexts = q.choices
          ? Object.values(q.choices).map((c: any) => (typeof c === "object" ? (c.text || "") : String(c)).trim()).filter(Boolean)
          : [];

        if (listItemsFromText.length >= 2) {
          const count = Math.max(listItemsFromText.length, rawChoiceTexts.length);
          pairs = [];
          for (let i = 0; i < count; i++) {
            pairs.push({
              id: String(i + 1),
              left: rawChoiceTexts[i] || `Item ${i + 1}`,
              right: listItemsFromText[i] || ""
            });
          }
          if (mainTextLines.length > 0) {
            cleanText = mainTextLines.join("\n").replace(/Definisi:\s*$/i, "").trim() || "Jodohkan item berikut dengan pasangannya yang tepat:";
          }
        } else if (!pairs || pairs.length === 0) {
          pairs = [
            { id: "1", left: "", right: "" },
            { id: "2", left: "", right: "" },
            { id: "3", left: "", right: "" }
          ];
        }
      }

      let items = q.items;
      if ((newType === "urutkan" || newType === "drag_drop") && (!items || items.length === 0)) {
        items = [
          { id: "1", text: "" },
          { id: "2", text: "" },
          { id: "3", text: "" }
        ];
      }

      let statements = q.statements;
      let choices = { ...q.choices };
      let correctKey = q.correctKey || "a";

      if (newType === "benar_salah") {
        if (!statements || statements.length === 0) {
          choices = {
            a: { text: "Benar", isCorrect: true },
            b: { text: "Salah", isCorrect: false }
          };
          correctKey = "a";
        }
      } else if (newType === "pilihan_ganda" || newType === "pilihan_ganda_kompleks") {
        if (!choices || Object.keys(choices).length < 2) {
          choices = {
            a: { text: "", isCorrect: true },
            b: { text: "", isCorrect: false },
            c: { text: "", isCorrect: false },
            d: { text: "", isCorrect: false },
            e: { text: "", isCorrect: false }
          };
          correctKey = "a";
        }
      }

      copy[index] = {
        ...q,
        text: cleanText,
        type: newType,
        pairs,
        items,
        statements,
        choices,
        correctKey
      };
      return copy;
    });
  };

  const handleExtractPairsFromText = (qIndex: number) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const q = copy[qIndex];
      const textLines = (q.text || "").split("\n").map(l => l.trim()).filter(Boolean);
      const listItems: string[] = [];
      const mainLines: string[] = [];

      for (const line of textLines) {
        const match = line.match(/^([a-zA-Z0-9][.)\-:]\s*)(.+)$/);
        if (match) {
          listItems.push(match[2].trim());
        } else {
          mainLines.push(line);
        }
      }

      if (listItems.length === 0) {
        addToast({ type: "warning", title: "Format Tidak Ditemukan", description: "Tidak ditemukan baris berformat 'a. ...' atau '1. ...' di teks soal." });
        return copy;
      }

      const existingPairs = copy[qIndex].pairs || [];
      const updatedPairs = listItems.map((item, idx) => ({
        id: String(idx + 1),
        left: existingPairs[idx]?.left && !/^\d+[.)]?\s*$/.test(existingPairs[idx].left)
          ? existingPairs[idx].left
          : `Item ${idx + 1}`,
        right: item
      }));

      copy[qIndex] = {
        ...q,
        text: mainLines.join("\n").replace(/Definisi:\s*$/i, "").trim() || "Jodohkan item berikut dengan pasangannya yang tepat:",
        pairs: updatedPairs
      };
      addToast({ type: "success", title: "Pasangan Berhasil Diekstrak!", description: `${updatedPairs.length} pasangan dimasukkan ke kolom kanan.` });
      return copy;
    });
  };

  const updateDraftPair = (qIndex: number, pairIndex: number, field: "left" | "right", value: string) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const pairs = [...(copy[qIndex].pairs || [])];
      if (pairs[pairIndex]) {
        pairs[pairIndex] = { ...pairs[pairIndex], [field]: value };
      }
      copy[qIndex] = { ...copy[qIndex], pairs };
      return copy;
    });
  };

  const addDraftPair = (qIndex: number) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const pairs = [...(copy[qIndex].pairs || [])];
      const newId = String(pairs.length + 1);
      pairs.push({ id: newId, left: "", right: "" });
      copy[qIndex] = { ...copy[qIndex], pairs };
      return copy;
    });
  };

  const removeDraftPair = (qIndex: number, pairIndex: number) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const pairs = [...(copy[qIndex].pairs || [])];
      if (pairs.length > 2) {
        pairs.splice(pairIndex, 1);
        copy[qIndex] = { ...copy[qIndex], pairs };
      }
      return copy;
    });
  };

  const updateDraftStatement = (qIndex: number, stIndex: number, field: "text" | "answer", value: string) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const statements = [...(copy[qIndex].statements || [])];
      if (statements[stIndex]) {
        statements[stIndex] = { ...statements[stIndex], [field]: value };
      }
      copy[qIndex] = { ...copy[qIndex], statements };
      return copy;
    });
  };

  const addDraftStatement = (qIndex: number) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const statements = [...(copy[qIndex].statements || [])];
      const newId = String(statements.length + 1);
      statements.push({ id: newId, text: "", answer: "benar" });
      copy[qIndex] = { ...copy[qIndex], statements };
      return copy;
    });
  };

  const removeDraftStatement = (qIndex: number, stIndex: number) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const statements = [...(copy[qIndex].statements || [])];
      if (statements.length > 1) {
        statements.splice(stIndex, 1);
        copy[qIndex] = { ...copy[qIndex], statements };
      }
      return copy;
    });
  };

  const convertToStatementMatrix = (qIndex: number) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      copy[qIndex] = {
        ...copy[qIndex],
        statements: [
          { id: "1", text: copy[qIndex].text ? "Pernyataan relevan 1" : "Pernyataan 1", answer: "benar" },
          { id: "2", text: "Pernyataan relevan 2", answer: "salah" },
          { id: "3", text: "Pernyataan relevan 3", answer: "benar" }
        ],
        choices: {}
      };
      return copy;
    });
  };

  const updateDraftItem = (qIndex: number, itemIndex: number, text: string) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const items = [...(copy[qIndex].items || [])];
      if (items[itemIndex]) {
        items[itemIndex] = { ...items[itemIndex], text };
      }
      copy[qIndex] = { ...copy[qIndex], items };
      return copy;
    });
  };

  const addDraftItem = (qIndex: number) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const items = [...(copy[qIndex].items || [])];
      const newId = String(items.length + 1);
      items.push({ id: newId, text: "" });
      copy[qIndex] = { ...copy[qIndex], items };
      return copy;
    });
  };

  const removeDraftItem = (qIndex: number, itemIndex: number) => {
    setDraftQuestions(prev => {
      const copy = [...prev];
      const items = [...(copy[qIndex].items || [])];
      if (items.length > 2) {
        items.splice(itemIndex, 1);
        copy[qIndex] = { ...copy[qIndex], items };
      }
      return copy;
    });
  };

  const removeDraftQuestion = (index: number) => {
    setDraftQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const addEmptyDraftQuestion = () => {
    const newDraft: DraftQuestionItem = {
      id: `draft-${Date.now()}-${draftQuestions.length}`,
      text: "",
      type: "pilihan_ganda",
      choices: {
        a: { text: "", isCorrect: true },
        b: { text: "", isCorrect: false },
        c: { text: "", isCorrect: false },
        d: { text: "", isCorrect: false },
        e: { text: "", isCorrect: false }
      },
      correctKey: "a",
      pairs: [],
      statements: [],
      items: []
    };
    setDraftQuestions(prev => [...prev, newDraft]);
  };

  const handleSaveDraftsToDatabase = async () => {
    if (!pb || !exam?.id) {
      addToast({ type: "error", title: "Gagal", description: "ID Ujian tidak ditemukan." });
      return;
    }

    const validDrafts = draftQuestions.filter(q => q.text.trim() !== "");
    if (validDrafts.length === 0) {
      addToast({
        type: "warning",
        title: "Soal Belum Lengkap",
        description: "Tidak ada butir soal yang memiliki teks pertanyaan."
      });
      return;
    }

    setIsSaving(true);
    try {
      const existing = await pb.collection("questions").getFullList({
        filter: `examId = "${exam.id}"`,
        fields: "order",
        sort: "-order"
      });
      let currentOrder = (existing.length > 0 ? Math.max(...existing.map(q => q.order || 0)) : 0) + 1;

      for (const q of validDrafts) {
        const qType = q.type || "pilihan_ganda";
        let optionsToSave: any = {};
        let correctAnswer = q.correctKey || "";

        if ((qType === "benar_salah" || (qType as any) === "true_false") && q.statements && q.statements.length > 0) {
          optionsToSave = { statements: q.statements };
          correctAnswer = q.statements.map((s: any) => `${s.id}:${s.answer || "benar"}`).join(",");
        } else if (qType === "pilihan_ganda" || qType === "pilihan_ganda_kompleks" || qType === "benar_salah") {
          Object.keys(q.choices || {}).forEach(k => {
            const c = q.choices[k];
            if (!c?.text?.trim() && qType !== "benar_salah") return;
            optionsToSave[k] = {
              text: c.text,
              isCorrect: !!c.isCorrect
            };
          });
          if (qType === "pilihan_ganda_kompleks") {
            correctAnswer = Object.entries(q.choices || {})
              .filter(([_, c]) => c.isCorrect)
              .map(([k]) => k)
              .join(",");
          } else if (qType === "pilihan_ganda" || qType === "benar_salah") {
            const foundKey = Object.entries(q.choices || {}).find(([_, c]) => c.isCorrect)?.[0];
            correctAnswer = foundKey || q.correctKey || "a";
          }
        } else if (qType === "menjodohkan") {
          optionsToSave = { pairs: q.pairs || [] };
          correctAnswer = "";
        } else if (qType === "urutkan" || qType === "drag_drop") {
          optionsToSave = { items: q.items || [] };
          correctAnswer = "";
        } else if (qType === "isian_singkat" || qType === "uraian") {
          optionsToSave = {};
          correctAnswer = q.answerKey || "";
        }

        let qText = q.text;
        if (q.imageUrl && !qText.includes(q.imageUrl)) {
          qText = `<p><img src="${q.imageUrl}" alt="Gambar Soal" style="max-height:320px;max-width:100%;border-radius:16px;margin-bottom:12px;" /></p>` + qText;
        }

        const payload: any = {
          examId: exam.id,
          text: qText.startsWith("<p>") ? qText : `<p>${qText}</p>`,
          imageUrl: q.imageUrl || "",
          type: qType,
          field: TYPE_MAP[qType] || "multiple_choice",
          options: optionsToSave,
          choices: optionsToSave,
          pairs: q.pairs || [],
          items: q.items || [],
          correctAnswer,
          answerKey: correctAnswer,
          order: currentOrder++
        };

        await pb.collection("questions").create(payload);
      }

      addToast({
        type: "success",
        title: "Berhasil Disimpan!",
        description: `${validDrafts.length} butir soal telah berhasil ditambahkan ke bank soal ujian.`
      });

      setDraftQuestions([]);
      try {
        localStorage.removeItem(reviewStorageKey);
      } catch { }

      onSavedQuestionsSuccess?.();
      setActiveTab("chat");
    } catch (err: any) {
      console.error("[AIChatDrawer] Gagal simpan soal:", err);
      addToast({
        type: "error",
        title: "Gagal Menyimpan",
        description: err?.message || "Terjadi kesalahan saat menyimpan butir soal."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const latestAssistantQuestions = [...messages]
    .reverse()
    .find(m => m.role === "assistant" && m.questions && m.questions.length > 0)
    ?.questions;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] pointer-events-none flex justify-end">
          {/* Backdrop transparan di desktop agar tabel bank soal di kiri tetap terlihat */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-950/20 sm:bg-transparent pointer-events-auto cursor-pointer"
            aria-hidden="true"
          />

          {/* Drawer Slide-over Panel */}
          <motion.aside
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={overlayTransition}
            role="dialog"
            aria-label="Asisten AI Pembuat Soal"
            className="relative pointer-events-auto w-full sm:w-[580px] md:w-[680px] lg:w-[720px] bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col h-full z-[100000] overflow-hidden"
          >
            {/* Header Drawer dengan Tab Switcher & Aksi */}
            <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Bot className="w-4 h-4" />
                </div>

                {/* Tab Switcher: Obrolan vs Tinjauan */}
                <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab("chat")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === "chat"
                      ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                      }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Obrolan AI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("review")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer relative",
                      activeTab === "review"
                        ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs"
                        : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
                      tabBadgePulse && "ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shadow-sm"
                    )}
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Kelola & Tinjau</span>
                    {draftQuestions.length > 0 && (
                      <span className={cn(
                        "px-1.5 py-0.2 rounded-full text-[10px] font-bold transition-all min-w-[18px] text-center",
                        tabBadgePulse
                          ? "bg-emerald-500 text-white scale-110 shadow-sm ring-2 ring-emerald-400"
                          : "bg-emerald-600 text-white"
                      )}>
                        {draftQuestions.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons: Sembunyikan & Tutup */}
              <div className="flex items-center gap-1.5">
                {activeTab === "chat" && messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetChat}
                    className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Mulai Percakapan Baru"
                    aria-label="Mulai Percakapan Baru"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Tombol Sembunyikan Panel */}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2.5 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1 border border-neutral-200 dark:border-neutral-700 shadow-2xs cursor-pointer"
                  title="Sembunyikan panel (draf tetap aman tersimpan)"
                  aria-label="Sembunyikan Panel"
                >
                  <EyeOff className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="hidden sm:inline">Sembunyikan</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TAB 1: OBROLAN AI (CHAT MODE) */}
            {activeTab === "chat" && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Chat Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col justify-center items-center text-center px-4 py-8">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                        Buat Soal Semudah Mengobrol
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mb-6 leading-relaxed">
                        Tulis materi atau topik yang diinginkan. Soal yang terbuat dapat langsung ditinjau dan diedit di panel ini.
                      </p>

                      {/* Preset Quick Chips */}
                      <div className="w-full space-y-2 text-left">
                        <p className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">
                          Inspirasi Perintah Cepat
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {QUICK_PROMPT_PRESETS.map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSendMessage(preset)}
                              className="w-full text-left p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/40 bg-neutral-50/50 dark:bg-neutral-850 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-xs text-neutral-700 dark:text-neutral-300 transition-all cursor-pointer"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                      >
                        {msg.role === "user" ? (
                          <div className="max-w-[85%] bg-emerald-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-xs text-xs sm:text-sm leading-relaxed shadow-xs">
                            {msg.content}
                          </div>
                        ) : (
                          <div className="max-w-[96%] w-full bg-neutral-100/90 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 rounded-2xl rounded-tl-xs p-3.5 sm:p-4 text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 space-y-3">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <Bot className="w-3.5 h-3.5" />
                              <span>Asisten AI</span>
                            </div>

                            <ChatMessageMarkdown content={msg.content} />

                            {/* Kartu Pratinjau Soal */}
                            {msg.questions && msg.questions.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-neutral-200/70 dark:border-neutral-800 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                    {msg.questions.length} Butir Soal Terbentuk
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(msg.id)}
                                    className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    {expandedCards[msg.id] ? (
                                      <>Sembunyikan <ChevronUp className="w-3 h-3" /></>
                                    ) : (
                                      <>Lihat Butir Soal <ChevronDown className="w-3 h-3" /></>
                                    )}
                                  </button>
                                </div>

                                {expandedCards[msg.id] && (
                                  <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                                    {msg.questions.map((q, qIdx) => (
                                      <div
                                        key={qIdx}
                                        className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-xs space-y-2"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-5 h-5 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-bold text-[10px] text-neutral-700 dark:text-neutral-300">
                                            {qIdx + 1}
                                          </span>
                                          <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
                                            {q.type.replace(/_/g, " ")}
                                          </span>
                                        </div>

                                        <div className="text-neutral-800 dark:text-neutral-200 leading-relaxed font-normal">
                                          <MathText content={q.text} />
                                        </div>

                                        {q.choices && Object.keys(q.choices).length > 0 && (
                                          <div className="space-y-1 pt-1.5 border-t border-neutral-100 dark:border-neutral-800/60">
                                            {Object.entries(q.choices).map(([key, c]: [string, any]) => {
                                              const isKeyMatch = q.answerKey?.toLowerCase() === key.toLowerCase() || c.isCorrect;
                                              return (
                                                <div
                                                  key={key}
                                                  className={`flex items-start gap-2 p-1.5 rounded-lg transition-colors ${isKeyMatch
                                                    ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-medium"
                                                    : "text-neutral-600 dark:text-neutral-400"
                                                    }`}
                                                >
                                                  <span className="w-4 text-center font-bold uppercase shrink-0">
                                                    {key}.
                                                  </span>
                                                  <div className="flex-1">
                                                    <MathText content={c.text || String(c)} />
                                                  </div>
                                                  {isKeyMatch && (
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                        {/* Menjodohkan Pairs Preview */}
                                        {q.pairs && q.pairs.length > 0 && (
                                          <div className="space-y-1.5 pt-1.5 border-t border-neutral-100 dark:border-neutral-800/60">
                                            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Pasangan Menjodohkan:</p>
                                            {q.pairs.map((p, pIdx) => (
                                              <div key={p.id || pIdx} className="flex items-center gap-2 p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-[11px]">
                                                <span className="font-semibold text-neutral-700 dark:text-neutral-300">{p.left}</span>
                                                <ArrowLeftRight className="w-3 h-3 text-neutral-400 shrink-0" />
                                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{p.right}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* Statements (Benar/Salah) Preview */}
                                        {q.statements && q.statements.length > 0 && (
                                          <div className="space-y-1 pt-1.5 border-t border-neutral-100 dark:border-neutral-800/60">
                                            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Pernyataan:</p>
                                            {q.statements.map((st, stIdx) => (
                                              <div key={st.id || stIdx} className="flex items-center justify-between p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-[11px]">
                                                <span>{st.text}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${st.answer === "benar" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                                                  {st.answer === "benar" ? "BENAR" : "SALAH"}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* Urutan Items Preview */}
                                        {q.items && q.items.length > 0 && (
                                          <div className="space-y-1 pt-1.5 border-t border-neutral-100 dark:border-neutral-800/60">
                                            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Urutan Benar:</p>
                                            {q.items.map((it, itIdx) => (
                                              <div key={it.id || itIdx} className="flex items-center gap-2 p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-[11px]">
                                                <span className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-700 font-bold text-[10px] flex items-center justify-center shrink-0">{itIdx + 1}</span>
                                                <span>{it.text}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* Isian Singkat / Uraian Rubrik Preview */}
                                        {(q.type === "isian_singkat" || q.type === "uraian") && q.answerKey && (
                                          <div className="p-2 rounded-lg bg-emerald-500/10 text-[11px] text-emerald-800 dark:text-emerald-200 font-medium border border-emerald-500/20">
                                            <span className="font-bold">Kunci / Rubrik:</span> {q.answerKey}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Dua Tombol Aksi: Buat Ulang (Regenerate) & Simpan ke Kelola */}
                                <div className="pt-2.5 space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    {/* Tombol 1: Buat Ulang (Regenerate) */}
                                    <NeonButton
                                      type="button"
                                      variant="outline"
                                      color="brand"
                                      size="sm"
                                      onClick={() => handleRegenerate(msg.id)}
                                      disabled={isLoading}
                                      className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 cursor-pointer"
                                      title="Buat ulang variasi soal baru untuk topik ini"
                                    >
                                      <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                                      <span>Buat Ulang</span>
                                    </NeonButton>

                                    {/* Tombol 2: Simpan ke Kelola */}
                                    <NeonButton
                                      type="button"
                                      variant={savedMessageIds.has(msg.id) ? "soft" : "primary"}
                                      color="brand"
                                      size="sm"
                                      onClick={() => handleSaveQuestionsToReview(msg.id, msg.questions!)}
                                      disabled={savedMessageIds.has(msg.id)}
                                      className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 cursor-pointer"
                                    >
                                      {savedMessageIds.has(msg.id) ? (
                                        <>
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                          <span>Tersimpan di Kelola</span>
                                        </>
                                      ) : (
                                        <>
                                          <Bookmark className="w-3.5 h-3.5" />
                                          <span>Simpan ({msg.questions.length} Soal)</span>
                                        </>
                                      )}
                                    </NeonButton>
                                  </div>

                                  {/* Info Banner kalau soal sudah masuk ke tab kelola */}
                                  {savedMessageIds.has(msg.id) && (
                                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-between gap-2.5 text-xs shadow-2xs">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                        <span className="text-[11px] font-medium text-emerald-900 dark:text-emerald-200">
                                          <strong>{msg.questions.length} butir soal</strong> telah masuk ke tab <strong>Kelola & Tinjau</strong>.
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setActiveTab("review")}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs transition-colors"
                                      >
                                        <span>Buka Kelola</span>
                                        <ArrowRight className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {isLoading && (
                    <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 max-w-[90%] text-xs text-neutral-600 dark:text-neutral-400 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">
                            thinking... ({elapsedSeconds}s)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                      {elapsedSeconds >= 8 && elapsedSeconds < 16 && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400">
                          ⚡ Sedang memproses butir soal di server upstream AI... Mohon tunggu sebentar.
                        </p>
                      )}
                      {elapsedSeconds >= 16 && (
                        <p className="text-[10px] text-rose-600 dark:text-rose-400">
                          ⚠️ Respon upstream AI membutuhkan waktu lebih lama ({elapsedSeconds}s). Tekan tombol <strong>Batal</strong> jika ingin membatalkan, atau periksa kuota / API key di Pengaturan.
                        </p>
                      )}
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom Section: Saran Follow-up & Input Bar */}
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2.5">
                  {/* Mode Speed Selector (Solusi AI Lambat) */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
                      <button
                        type="button"
                        onClick={() => setSpeedMode("fast")}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${speedMode === "fast"
                          ? "bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                          : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                          }`}
                        title="Mode Kilat — parameter ringkas & respon cepat pada model pilihan Anda"
                      >
                        <Zap className="w-3 h-3 text-amber-500" />
                        <span>Mode Kilat</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpeedMode("accurate")}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${speedMode === "accurate"
                          ? "bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold"
                          : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                          }`}
                        title="Standar Akurat — butir soal komprehensif & mendalam"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-500" />
                        <span>Standar Akurat</span>
                      </button>
                    </div>

                    <span className="flex items-center gap-1 text-[10px] text-neutral-400 dark:text-neutral-500">
                      <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Riwayat lokal</span>
                    </span>
                  </div>

                  {/* Rekomendasi Instruksi Lanjutan */}
                  {latestAssistantQuestions && latestAssistantQuestions.length > 0 && !isLoading && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                      {FOLLOW_UP_SUGGESTIONS.map((sug, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSendMessage(sug)}
                          className="shrink-0 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 bg-neutral-50 dark:bg-neutral-850 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-neutral-600 dark:text-neutral-400 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Textarea Input */}
                  <div className="flex items-end gap-2 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-1.5 focus-within:border-emerald-500 dark:focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all">
                    <textarea
                      ref={textareaRef}
                      value={inputPrompt}
                      onChange={e => setInputPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ketik instruksi (contoh: 'Buat 5 soal trigonometri sudut istimewa')..."
                      rows={1}
                      disabled={isLoading}
                      className="flex-1 bg-transparent border-0 resize-none py-2 px-3 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none max-h-32 min-h-[40px]"
                    />
                    <NeonButton
                      variant="primary"
                      color="brand"
                      size="sm"
                      disabled={!inputPrompt.trim() || isLoading}
                      onClick={() => handleSendMessage()}
                      aria-label="Kirim Pesan"
                      className="rounded-xl h-9 w-9 p-0 flex items-center justify-center shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </NeonButton>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: KELOLA, TINJAUAN & EDIT MODE (IN-DRAWER) */}
            {activeTab === "review" && (
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-50/50 dark:bg-neutral-950/40">
                {/* List Butir Soal yang Sedang Ditinjau */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {draftQuestions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                        Belum Ada Soal di Peninjauan
                      </h4>
                      <p className="text-xs text-neutral-500 max-w-xs mb-4">
                        Buat butir soal lewat tab Obrolan AI lalu klik tombol "Kelola & Tinjau", atau buat soal manual di sini.
                      </p>
                      <div className="flex gap-2">
                        <NeonButton
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("chat")}
                          className="gap-1.5"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Ke Obrolan AI</span>
                        </NeonButton>
                        <NeonButton
                          variant="secondary"
                          size="sm"
                          onClick={addEmptyDraftQuestion}
                          className="gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah Manual</span>
                        </NeonButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          Daftar Butir Soal ({draftQuestions.length})
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          Klik huruf opsi untuk menentukan kunci jawaban
                        </span>
                      </div>

                      {draftQuestions.map((q, idx) => (
                        <div
                          key={q.id || idx}
                          className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3.5 shadow-xs transition-all"
                        >
                          {/* Header Kartu Soal */}
                          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                {idx + 1}
                              </span>
                              <select
                                value={q.type}
                                onChange={e => updateDraftQuestionType(idx, e.target.value)}
                                className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-0.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                              >
                                <option value="pilihan_ganda">Pilihan Ganda (Single)</option>
                                <option value="pilihan_ganda_kompleks">Pilihan Ganda Kompleks</option>
                                <option value="benar_salah">Benar / Salah</option>
                                <option value="menjodohkan">Menjodohkan</option>
                                <option value="urutkan">Urutkan / Drag & Drop</option>
                                <option value="isian_singkat">Isian Singkat</option>
                                <option value="uraian">Uraian / Essay</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeDraftQuestion(idx)}
                              className="text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Hapus butir soal ini"
                              aria-label="Hapus butir soal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Pertanyaan Utama */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                              Pertanyaan Utama:
                            </label>
                            <textarea
                              value={q.text}
                              onChange={e => updateDraftQuestionText(idx, e.target.value)}
                              rows={3}
                              placeholder="Ketik pertanyaan soal di sini..."
                              className="w-full text-xs sm:text-sm p-3 rounded-xl border border-neutral-200 dark:border-neutral-750 bg-neutral-50/40 dark:bg-neutral-850/40 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-normal leading-relaxed"
                            />
                          </div>

                          {/* Lampiran Gambar Soal (Manual / Galeri / AI) */}
                          <div className="space-y-1.5 pt-0.5">
                            <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Image className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Gambar Stimulus / Ilustrasi:</span>
                            </label>

                            {q.imageUrl ? (
                              <div className="relative rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 p-2.5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <img
                                    src={q.imageUrl}
                                    alt="Gambar Soal"
                                    className="h-14 w-20 object-contain rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                                      Gambar Terlampir
                                    </p>
                                    <p className="text-[10px] text-neutral-400 truncate max-w-[200px] sm:max-w-xs">
                                      {q.imageUrl}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTargetFileIndex(idx);
                                      imageFileInputRef.current?.click();
                                    }}
                                    className="px-2 py-1 rounded-md text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                                  >
                                    Ganti File
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActiveGalleryIndex(idx)}
                                    className="px-2 py-1 rounded-md text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                                  >
                                    Galeri
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateDraftQuestionImage(idx, undefined)}
                                    className="p-1 text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer"
                                    title="Hapus gambar"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetFileIndex(idx);
                                    imageFileInputRef.current?.click();
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-750 hover:border-emerald-500/50 bg-neutral-50/70 dark:bg-neutral-850/70 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-xs font-semibold text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                                >
                                  <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>Upload Gambar Manual</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setActiveGalleryIndex(idx)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-750 hover:border-emerald-500/50 bg-neutral-50/70 dark:bg-neutral-850/70 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-xs font-semibold text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>Pilih dari Galeri / Web AI</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 1. PILIHAN GANDA (SINGLE CHOICE) */}
                          {q.type === "pilihan_ganda" && (
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                  Pilihan Jawaban & Kunci (1 Pilihan Benar):
                                </label>
                                <span className="text-[10px] text-neutral-400">
                                  Pilih 1 kunci jawaban benar (radio)
                                </span>
                              </div>

                              <div className="space-y-2">
                                {Object.entries(q.choices || {}).map(([key, c]) => (
                                  <div key={key} className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setDraftChoiceCorrect(idx, key)}
                                      className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 transition-all cursor-pointer border ${c.isCorrect
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20"
                                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-emerald-500/50"
                                        }`}
                                      title={c.isCorrect ? "Kunci Jawaban Benar" : "Klik untuk jadikan Kunci Jawaban"}
                                    >
                                      {c.isCorrect ? <Check className="w-3.5 h-3.5" /> : key.toUpperCase()}
                                    </button>

                                    <input
                                      type="text"
                                      value={c.text}
                                      onChange={e => updateDraftChoiceText(idx, key, e.target.value)}
                                      placeholder={`Teks pilihan ${key.toUpperCase()}...`}
                                      className={`flex-1 text-xs sm:text-sm px-3 py-1.5 rounded-lg border transition-all ${c.isCorrect
                                        ? "border-emerald-500/60 bg-emerald-500/5 font-medium text-emerald-950 dark:text-emerald-100"
                                        : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200"
                                        } focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                                    />

                                    {Object.keys(q.choices).length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => removeDraftChoice(idx, key)}
                                        className="text-neutral-400 hover:text-rose-500 p-1.5 transition-colors cursor-pointer"
                                        title="Hapus pilihan ini"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => addDraftChoice(idx)}
                                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Tambah Pilihan Opsi</span>
                              </button>
                            </div>
                          )}

                          {/* 2. PILIHAN GANDA KOMPLEKS (MULTI-CORRECT CHOICE) */}
                          {q.type === "pilihan_ganda_kompleks" && (
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                                  Pilihan Ganda Kompleks (Multi-Jawaban Benar):
                                </label>
                                <span className="text-[10px] text-neutral-400">
                                  Centang satu atau lebih kunci jawaban benar
                                </span>
                              </div>

                              <div className="space-y-2">
                                {Object.entries(q.choices || {}).map(([key, c]) => (
                                  <div key={key} className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setDraftChoiceCorrect(idx, key)}
                                      className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 transition-all cursor-pointer border ${c.isCorrect
                                        ? "bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-500/20"
                                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-sky-500/50"
                                        }`}
                                      title={c.isCorrect ? "Centang: Benar (Klik untuk batal)" : "Klik untuk centang sebagai jawaban benar"}
                                    >
                                      {c.isCorrect ? <Check className="w-3.5 h-3.5" /> : key.toUpperCase()}
                                    </button>

                                    <input
                                      type="text"
                                      value={c.text}
                                      onChange={e => updateDraftChoiceText(idx, key, e.target.value)}
                                      placeholder={`Teks pilihan ${key.toUpperCase()}...`}
                                      className={`flex-1 text-xs sm:text-sm px-3 py-1.5 rounded-lg border transition-all ${c.isCorrect
                                        ? "border-sky-500/60 bg-sky-500/5 font-medium text-sky-950 dark:text-sky-100"
                                        : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200"
                                        } focus:outline-none focus:ring-1 focus:ring-sky-500`}
                                    />

                                    {Object.keys(q.choices).length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => removeDraftChoice(idx, key)}
                                        className="text-neutral-400 hover:text-rose-500 p-1.5 transition-colors cursor-pointer"
                                        title="Hapus pilihan ini"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => addDraftChoice(idx)}
                                className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Tambah Pilihan Opsi</span>
                              </button>
                            </div>
                          )}

                          {/* 3. BENAR / SALAH (TABEL PERNYATAAN ATAU BINARY) */}
                          {q.type === "benar_salah" && (
                            <div className="space-y-2 pt-1">
                              {q.statements && q.statements.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                      Daftar Pernyataan (Benar / Salah):
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDraftQuestions(prev => {
                                          const copy = [...prev];
                                          copy[idx] = {
                                            ...copy[idx],
                                            statements: [],
                                            choices: {
                                              a: { text: "Benar", isCorrect: true },
                                              b: { text: "Salah", isCorrect: false }
                                            },
                                            correctKey: "a"
                                          };
                                          return copy;
                                        });
                                      }}
                                      className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 underline cursor-pointer"
                                    >
                                      Ganti ke 2 Opsi Benar/Salah Sederhana
                                    </button>
                                  </div>

                                  <div className="space-y-2">
                                    {q.statements.map((st, stIdx) => (
                                      <div key={st.id || stIdx} className="flex items-center gap-2 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
                                        <span className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                          {stIdx + 1}
                                        </span>
                                        <input
                                          type="text"
                                          value={st.text}
                                          onChange={e => updateDraftStatement(idx, stIdx, "text", e.target.value)}
                                          placeholder={`Teks pernyataan ke-${stIdx + 1}...`}
                                          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        />
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => updateDraftStatement(idx, stIdx, "answer", "benar")}
                                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                              st.answer === "benar"
                                                ? "bg-emerald-600 text-white shadow-xs"
                                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                            }`}
                                          >
                                            Benar
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => updateDraftStatement(idx, stIdx, "answer", "salah")}
                                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                              st.answer === "salah"
                                                ? "bg-rose-600 text-white shadow-xs"
                                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                            }`}
                                          >
                                            Salah
                                          </button>
                                        </div>
                                        {q.statements && q.statements.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => removeDraftStatement(idx, stIdx)}
                                            className="text-neutral-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                                            title="Hapus pernyataan"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => addDraftStatement(idx)}
                                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Tambah Pernyataan</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                      Kunci Jawaban Benar / Salah:
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => convertToStatementMatrix(idx)}
                                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                                    >
                                      + Ubah ke Tabel Pernyataan Multi-Baris
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    {(["a", "b"] as const).map(key => {
                                      const label = key === "a" ? "Benar" : "Salah";
                                      const isSelected = q.correctKey === key || q.choices?.[key]?.isCorrect;
                                      return (
                                        <button
                                          key={key}
                                          type="button"
                                          onClick={() => setDraftChoiceCorrect(idx, key)}
                                          className={`p-3 rounded-xl border text-center font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                            isSelected
                                              ? (key === "a"
                                                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20"
                                                  : "border-rose-600 bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/20")
                                              : "border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-850 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300"
                                          }`}
                                        >
                                          {isSelected && <Check className="w-4 h-4" />}
                                          <span>{label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 4. MENJODOHKAN (MATCHING PAIRS) */}
                          {q.type === "menjodohkan" && (
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                  Pasangan Menjodohkan (Premis Kiri ↔ Pasangan Kanan):
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleExtractPairsFromText(idx)}
                                  className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                                  title="Ekstrak otomatis daftar definisi/premis dari teks soal ke kolom pasangan kanan"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>Ekstrak dari Teks Soal</span>
                                </button>
                              </div>

                              {/(?:Definisi:|^[a-zA-Z0-9][.)\-:]\s*.+)/m.test(q.text || "") && (
                                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 shadow-2xs">
                                  <span>💡 Terdeteksi butir definisi di dalam teks pertanyaan.</span>
                                  <button
                                    type="button"
                                    onClick={() => handleExtractPairsFromText(idx)}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shrink-0 transition-colors"
                                  >
                                    Pindahkan ke Pasangan Kanan
                                  </button>
                                </div>
                              )}

                              <div className="space-y-2">
                                {(q.pairs || []).map((pair, pIdx) => (
                                  <div key={pair.id || pIdx} className="flex items-center gap-2 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
                                    <span className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                      {pIdx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={pair.left || ""}
                                      onChange={e => updateDraftPair(idx, pIdx, "left", e.target.value)}
                                      placeholder={`Premis/Pertanyaan Kiri ${pIdx + 1}...`}
                                      className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    />
                                    <ArrowLeftRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                    <input
                                      type="text"
                                      value={pair.right || ""}
                                      onChange={e => updateDraftPair(idx, pIdx, "right", e.target.value)}
                                      placeholder={`Kunci Jawaban Kanan ${pIdx + 1}...`}
                                      className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    />
                                    {(q.pairs || []).length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => removeDraftPair(idx, pIdx)}
                                        className="text-neutral-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                                        title="Hapus pasangan ini"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => addDraftPair(idx)}
                                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Tambah Pasangan Jodoh</span>
                              </button>
                            </div>
                          )}

                          {/* 5. URUTKAN / DRAG & DROP */}
                          {(q.type === "urutkan" || q.type === "drag_drop") && (
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                  Urutan Item yang Benar (Atas ke Bawah):
                                </label>
                                <span className="text-[10px] text-neutral-400">
                                  Tuliskan urutan kronologis/tahapan yang benar
                                </span>
                              </div>

                              <div className="space-y-2">
                                {(q.items || []).map((item, itIdx) => (
                                  <div key={item.id || itIdx} className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-bold flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700">
                                      {itIdx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={item.text || ""}
                                      onChange={e => updateDraftItem(idx, itIdx, e.target.value)}
                                      placeholder={`Item tahapan urutan ke-${itIdx + 1}...`}
                                      className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    />
                                    {(q.items || []).length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => removeDraftItem(idx, itIdx)}
                                        className="text-neutral-400 hover:text-rose-500 p-1.5 transition-colors cursor-pointer"
                                        title="Hapus item ini"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => addDraftItem(idx)}
                                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Tambah Item Urutan</span>
                              </button>
                            </div>
                          )}

                          {/* 6. ISIAN SINGKAT */}
                          {q.type === "isian_singkat" && (
                            <div className="space-y-1.5 pt-1">
                              <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                Kunci Jawaban Singkat (Kata / Frasa):
                              </label>
                              <input
                                type="text"
                                value={q.answerKey || ""}
                                onChange={e => {
                                  const text = e.target.value;
                                  setDraftQuestions(prev => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], answerKey: text };
                                    return copy;
                                  });
                                }}
                                placeholder="Contoh: Fotosintesis, Processor, Jakarta..."
                                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                              />
                              <p className="text-[10px] text-neutral-400">
                                Jawaban pasti yang dicocokkan otomatis saat siswa menjawab.
                              </p>
                            </div>
                          )}

                          {/* 7. URAIAN / ESSAY */}
                          {q.type === "uraian" && (
                            <div className="space-y-1.5 pt-1">
                              <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                Pedoman Penilaian / Rubrik Jawaban Esai:
                              </label>
                              <textarea
                                rows={3}
                                value={q.answerKey || ""}
                                onChange={e => {
                                  const text = e.target.value;
                                  setDraftQuestions(prev => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], answerKey: text };
                                    return copy;
                                  });
                                }}
                                placeholder="Tuliskan pedoman penilaian atau poin-poin rubrik jawaban di sini..."
                                className="w-full text-xs sm:text-sm p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
                              />
                              <p className="text-[10px] text-neutral-400">
                                Sebagai panduan guru saat memeriksa atau untuk penilaian analitis otomatis AI.
                              </p>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Tombol Tambah Soal Manual di Bawah */}
                      <button
                        type="button"
                        onClick={addEmptyDraftQuestion}
                        className="w-full py-2.5 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer bg-white/50 dark:bg-neutral-900/50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Butir Soal Baru</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Sticky Footer: Aksi Simpan ke Bank Soal */}
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <NeonButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab("chat")}
                      className="gap-1 text-xs"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Ke Obrolan</span>
                    </NeonButton>
                    <span className="text-xs text-neutral-500 hidden sm:inline">
                      {draftQuestions.length} butir siap disimpan
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Sembunyikan panel (draf tetap tersimpan di browser)"
                    >
                      Sembunyikan
                    </button>

                    <NeonButton
                      variant="primary"
                      color="brand"
                      size="sm"
                      disabled={draftQuestions.length === 0 || isSaving}
                      onClick={handleSaveDraftsToDatabase}
                      className="gap-1.5 min-w-[140px] justify-center"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Simpan {draftQuestions.length} Soal</span>
                        </>
                      )}
                    </NeonButton>
                  </div>
                </div>
              </div>
            )}
          </motion.aside>

          {/* Hidden File Input for Question Image Upload */}
          <input
            type="file"
            ref={imageFileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleManualImageUpload}
          />

          {/* Modal Galeri Media & Pencarian Online (Tema Neon) */}
          {activeGalleryIndex !== null && pb && (
            <SharedGalleryModal
              isOpen={activeGalleryIndex !== null}
              onClose={() => setActiveGalleryIndex(null)}
              onSelectImage={(url) => {
                updateDraftQuestionImage(activeGalleryIndex, url);
                setActiveGalleryIndex(null);
              }}
              pb={pb}
              school={pb.authStore.model}
              currentQuestionContext={{
                text: draftQuestions[activeGalleryIndex]?.text,
                topic: exam?.name,
                subject: exam?.subject
              }}
              currentUser={pb.authStore.model as any}
            />
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
