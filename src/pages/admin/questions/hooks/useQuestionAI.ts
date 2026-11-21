import React, { useState, useRef, useEffect } from "react";
import * as mammoth from "mammoth";
import { jsonrepair } from "jsonrepair";
import {
  generateQuestionsAI,
  generateSingleQuestionAI,
  getTopicSuggestionsAI,
  parseQuestionsAI,
  generateObjectivesAI,
  generateFromMaterialAI
} from "../../../../lib/ai";
import {
  localizeImage as localizeImageHelper,
  localizeInlineImages as localizeInlineImagesHelper
} from "../utils/imageLocalizer";
import {
  normalizeImportedQuestion,
  buildQuestionSavePayload
} from "../utils/questionNormalize";

export interface UseQuestionAIOptions {
  pb: any;
  exam: any;
  examId?: string | null;
  school?: any;
  addToast: (toast: any) => void;
  showAlert: (title: string, desc: string, variant?: "danger" | "warning" | "info" | "success") => void;
  loadQuestions: () => Promise<void>;
  batchQuestions?: any[];
  setBatchQuestions: React.Dispatch<React.SetStateAction<any[]>>;
  setIsBatchModalOpen: (open: boolean) => void;
  setBatchProgress: React.Dispatch<React.SetStateAction<any>>;
  setImportProgress: React.Dispatch<React.SetStateAction<number>>;
}

export function useQuestionAI({
  pb,
  exam,
  examId,
  school,
  addToast,
  showAlert,
  loadQuestions,
  batchQuestions = [],
  setBatchQuestions,
  setIsBatchModalOpen,
  setBatchProgress,
  setImportProgress
}: UseQuestionAIOptions) {
  // Localized image helpers bound to context
  const localizeImage = (url: string, prefix: string) =>
    localizeImageHelper(url, prefix, { school, examId });
  const localizeInlineImages = (html: string) =>
    localizeInlineImagesHelper(html, { school, examId });

  // AI Import State
  const [isAIImportOpen, setIsAIImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<'extract' | 'generate' | 'json'>('extract');
  const [importCount, setImportCount] = useState(5);
  const [importType, setImportType] = useState('pilihan_ganda');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResults, setParsedResults] = useState<any[]>([]);

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

        const results = questionsArr
          .map((q: any, i: number) => normalizeImportedQuestion(q, i))
          .filter((q: any) => q && q.text);

        const skippedHotspot = questionsArr.length - results.length;
        setParsedResults(results);
        addToast({
          title: "Parsing Berhasil",
          description: `Ditemukan ${results.length} soal dari JSON.${skippedHotspot > 0 ? ` (${skippedHotspot} soal hotspot dilewati)` : ""} Silakan tinjau sebelum menyimpan.`,
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
    if (parsedResults.length === 0 || !pb || !examId) return;
    setIsParsing(true);
    try {

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
      const maxOrder = dbQuestions.reduce((max: number, q: any) => Math.max(max, q.order || 0), 0);

      // Build all payloads with localized images
      const payloads = [];
      for (let idx = 0; idx < parsedResults.length; idx++) {
        const q = parsedResults[idx];
        const createPayload = await buildQuestionSavePayload(q, examId, maxOrder + idx + 1, {
          localizeImage,
          localizeInlineImages,
        });
        payloads.push(createPayload);
      }

      // Save in parallel chunks of 10
      const chunkSize = 10;
      for (let i = 0; i < payloads.length; i += chunkSize) {
        const chunk = payloads.slice(i, i + chunkSize);
        await Promise.all(chunk.map(p => pb.collection("questions").create(p)));
        count = Math.min(i + chunkSize, payloads.length);
        setImportProgress(Math.round((count / payloads.length) * 100));
        setBatchProgress((prev: any) => ({ ...prev, current: count, message: `Menyimpan soal (${count}/${payloads.length})` }));
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
      setBatchProgress((prev: any) => ({ ...prev, isOpen: false }));
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


  return {
    // Dialog / Drawer states
    isAIChatDrawerOpen,
    setIsAIChatDrawerOpen,
    isAIModalOpen,
    setIsAIModalOpen,
    isAIImportOpen,
    setIsAIImportOpen,

    // Generation states & progress
    isAIGenerating,
    setIsAIGenerating,
    isAIGeneratingDirect,
    setIsAIGeneratingDirect,
    aiProgress,
    setAiProgress,
    isRegeneratingIndex,
    setIsRegeneratingIndex,

    // AI Form fields
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
    setAiTaxonomy,
    aiMaterialFile,
    setAiMaterialFile,
    aiMaterialText,
    setAiMaterialText,
    aiMaterialFileName,
    setAiMaterialFileName,
    isExtractingMaterial,
    aiObjectives,
    setAiObjectives,
    isFetchingObjectives,
    dynamicSuggestions,
    setDynamicSuggestions,
    isFetchingSuggestions,
    isGeneratingTopic,

    // Import states
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

    // Taxonomy helpers
    toggleTaxonomy,
    setTaxonomyPreset,
    getTaxonomyPreset,

    // Handlers
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
  };
}
