import React, { useState, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  FileText,
  Loader2,
  Save,
  Layers,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Info
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { MathText } from "../ui/MathText";
import { useTenant } from "../../context/TenantContext";
import { useToast } from "../ui/toast";
import {
  reviseQuestionOptionsAI,
  type AIReviseOptionsResult,
  type AIReviseOptionsChoice
} from "../../lib/ai";
import type { QuestionAnalysis } from "../../lib/itemAnalysisEvaluator";
import { cn } from "../../lib/utils";

export interface AIQuestionRevisionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  question: QuestionAnalysis | null;
  onSaveToQuestionBank: (
    questionId: string,
    updatedChoices: Record<string, { text: string; isCorrect: boolean; imageUrl?: string }>,
    updatedAnswerKey: string
  ) => Promise<void>;
}

export const AIQuestionRevisionDialog: React.FC<AIQuestionRevisionDialogProps> = ({
  isOpen,
  onClose,
  question,
  onSaveToQuestionBank
}) => {
  const { pb } = useTenant();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [revisionResult, setRevisionResult] = useState<AIReviseOptionsResult | null>(null);
  const [editableChoices, setEditableChoices] = useState<Record<string, AIReviseOptionsChoice>>({});
  const [teacherNote, setTeacherNote] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [showStimulus, setShowStimulus] = useState(true);

  // Reset state when a new question is opened
  useEffect(() => {
    if (isOpen && question) {
      setRevisionResult(null);
      setError(null);
      setTeacherNote("");

      // Initialize choices from current question
      const initial: Record<string, AIReviseOptionsChoice> = {};
      const answerKeys = (question.answerKey || "")
        .toLowerCase()
        .split(/[,|; ]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (question.choices && typeof question.choices === "object") {
        Object.entries(question.choices).forEach(([k, c]) => {
          const lowerKey = k.toLowerCase();
          const isCorr = answerKeys.length > 0 ? answerKeys.includes(lowerKey) : Boolean(c.isCorrect);
          initial[lowerKey] = {
            text: c.text || "",
            isCorrect: isCorr,
            originalText: c.text || "",
            status: "kept",
            rationale: isCorr ? "Kunci jawaban resmi" : "Pilihan jawaban asli"
          };
        });
      }
      setEditableChoices(initial);
    }
  }, [isOpen, question]);

  if (!question) return null;

  const isComplex = question.type === "pilihan_ganda_kompleks";

  // Quick guidance prompt suggestions for teacher
  const quickSuggestions = [
    "Tingkatkan Daya Beda (D)",
    "Ganti pengecoh pasif (<5%) dengan miskonsepsi umum",
    "Perbaiki pengecoh yang ambigu/menyesatkan",
    "Seimbangkan panjang & struktur tata bahasa semua opsi"
  ];

  const handleApplySuggestion = (text: string) => {
    if (teacherNote.includes(text)) return;
    setTeacherNote((prev) => (prev ? `${prev}. ${text}` : text));
  };

  const handleRunAIRevision = async () => {
    if (!pb) {
      setError("Koneksi ke sistem tidak tersedia.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setLoadingStep("Menganalisis profil empiris & kelemahan pengecoh...");

    try {
      setLoadingStep("Menyusun opsi pengecoh berbasis miskonsepsi & CTT...");

      const result = await reviseQuestionOptionsAI({
        pb,
        questionId: question.id,
        questionIndex: question.index,
        questionText: question.text,
        literasiText: question.groupText,
        type: question.type,
        answerKey: question.answerKey || "",
        currentChoices: question.choices || {},
        distractorAnalysis: question.distractors,
        difficultyIndex: question.difficultyIndex,
        discriminationIndex: question.discriminationIndex,
        pointBiserial: question.pointBiserial,
        teacherNote: teacherNote.trim() || undefined
      });

      setRevisionResult(result);
      setEditableChoices(result.choices);
    } catch (err: any) {
      console.error("AI Revision Error:", err);
      setError(err?.message || "Gagal melakukan analisis revisi pilihan jawaban dengan AI.");
    } finally {
      setIsLoading(false);
      setLoadingStep("");
    }
  };

  const handleChoiceTextChange = (key: string, newText: string) => {
    setEditableChoices((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        text: newText
      }
    }));
  };

  const handleToggleCorrectKey = (key: string) => {
    if (isComplex) {
      // Multi-select for complex choice
      setEditableChoices((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          isCorrect: !prev[key].isCorrect
        }
      }));
    } else {
      // Single select: only one option is correct
      setEditableChoices((prev) => {
        const next: Record<string, AIReviseOptionsChoice> = {};
        Object.entries(prev).forEach(([k, c]) => {
          next[k] = {
            ...c,
            isCorrect: k === key
          };
        });
        return next;
      });
    }
  };

  const handleSave = async () => {
    // Validate that at least one option is chosen as correct
    const correctCount = Object.values(editableChoices).filter((c) => c.isCorrect).length;
    if (correctCount === 0) {
      addToast({
        title: "Kunci Jawaban Kosong",
        description: "Pilih minimal 1 opsi sebagai kunci jawaban yang benar.",
        type: "error"
      });
      return;
    }

    setIsApplying(true);
    try {
      const updatedChoicesObj: Record<string, { text: string; isCorrect: boolean; imageUrl?: string }> = {};
      const origChoices = question.choices || {};

      Object.entries(editableChoices).forEach(([k, c]) => {
        updatedChoicesObj[k] = {
          text: c.text,
          isCorrect: c.isCorrect,
          imageUrl: origChoices[k]?.imageUrl || origChoices[k.toUpperCase()]?.imageUrl || ""
        };
      });

      const updatedKeys = Object.entries(editableChoices)
        .filter(([_, c]) => c.isCorrect)
        .map(([k]) => k)
        .join(",");

      await onSaveToQuestionBank(question.id, updatedChoicesObj, updatedKeys);

      addToast({
        title: "Revisi Berhasil Diterapkan!",
        description: `Pilihan jawaban butir soal #${question.index} telah diperbarui di Bank Soal.`,
        type: "success"
      });
      onClose();
    } catch (err: any) {
      console.error("Save Error:", err);
      addToast({
        title: "Gagal Menyimpan",
        description: err?.message || "Terjadi kesalahan saat menyimpan perubahan ke Bank Soal.",
        type: "error"
      });
    } finally {
      setIsApplying(false);
    }
  };

  // Find distractor info for original option
  const getOriginalDistractorInfo = (key: string) => {
    if (!question.distractors) return null;
    return question.distractors.find((d) => d.key.toLowerCase() === key.toLowerCase());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] max-w-4xl max-h-[92vh] sm:max-h-[88vh] h-[92vh] sm:h-[88vh] flex flex-col p-0 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden gap-0">
        {/* MODAL HEADER */}
        <DialogHeader className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 pr-12 sm:pr-14">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <Sparkles className="h-4 w-4" />
                </span>
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Revisi Pilihan Jawaban dengan AI
                </DialogTitle>
                <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-xs">
                  Butir #{question.index}
                </Badge>
                <Badge className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50 font-bold text-xs">
                  {isComplex ? "Pilihan Ganda Kompleks" : "Pilihan Ganda Tunggal"}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                Optimasi efektivitas pengecoh (DE) dan daya pembeda (D) butir soal berbasis kaidah Classical Test Theory (CTT).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* MODAL BODY (SCROLLABLE WITH GENEROUS BREATHING ROOM) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 bg-slate-50/50 dark:bg-slate-950/30">
          {/* 1. METRIK EMPIRIS & DIAGNOSIS ANOMALI BUTIR */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Diagnosis Masalah Psikometri Butir
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Kunci Jawaban Asli: <strong className="text-emerald-600 dark:text-emerald-400 font-black uppercase">{question.answerKey || "-"}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Kesukaran (P)</span>
                <span className="font-black text-slate-800 dark:text-slate-200">
                  {question.difficultyIndex.toFixed(2)}{" "}
                  <span className="text-[11px] font-normal text-slate-500">({question.difficultyCategory})</span>
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Daya Pembeda (D)</span>
                <span className={cn(
                  "font-black",
                  question.discriminationIndex >= 0.30 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                )}>
                  {question.discriminationIndex >= 0 ? `+${question.discriminationIndex.toFixed(2)}` : question.discriminationIndex.toFixed(2)}{" "}
                  <span className="text-[11px] font-normal text-slate-500">({question.discriminationCategory})</span>
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Point-Biserial</span>
                <span className="font-black text-slate-800 dark:text-slate-200">
                  {question.pointBiserial >= 0 ? `+${question.pointBiserial.toFixed(2)}` : question.pointBiserial.toFixed(2)}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Efektivitas Pengecoh</span>
                <span className="font-black text-slate-800 dark:text-slate-200">
                  {question.distractorEfficiency}%{" "}
                  <span className="text-[11px] font-normal text-slate-500">({question.effectiveDistractorCount}/{question.totalDistractorCount} Efektif)</span>
                </span>
              </div>
            </div>

            {/* Diagnostic Flags */}
            {question.flags && question.flags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {question.flags.map((flag, idx) => (
                  <Badge
                    key={idx}
                    className="bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 text-[10px] font-bold"
                  >
                    ⚠️ {flag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 2. TEKS SOAL & STIMULUS (COLLAPSIBLE) */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowStimulus(!showStimulus)}
              className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
            >
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                Teks Soal &amp; Wacana Stimulus
              </span>
              {showStimulus ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {showStimulus && (
              <div className="p-3.5 space-y-3 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-800">
                {question.groupText && (
                  <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400 tracking-wider block">
                      Wacana Literasi / Stimulus Pendukung:
                    </span>
                    <MathText content={question.groupText} />
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                    Pertanyaan Butir:
                  </span>
                  <MathText content={question.text} />
                </div>
              </div>
            )}
          </div>

          {/* 3. ARAHAN KHUSUS GURU & GENERATE ACTION */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label htmlFor="teacher-guidance" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span>Catatan / Arahan Tambahan untuk AI (Opsional)</span>
              </label>
              <span className="text-[11px] text-slate-400">Klik rekomendasi cepat di bawah untuk menambahkan</span>
            </div>

            <textarea
              id="teacher-guidance"
              value={teacherNote}
              onChange={(e) => setTeacherNote(e.target.value)}
              placeholder="Contoh: Buat pilihan pengecoh lebih menantang terkait miskonsepsi ide pokok di kalimat penjelas, atau seimbangkan panjang kalimat opsi..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-slate-400 min-h-[64px]"
              disabled={isLoading || isApplying}
            />

            <div className="flex items-center gap-1.5 flex-wrap">
              {quickSuggestions.map((sug, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => handleApplySuggestion(sug)}
                  disabled={isLoading || isApplying}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
                >
                  + {sug}
                </button>
              ))}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-[11px] text-slate-400">
                AI akan mempertahankan kunci substansi benar dan merombak pengecoh yang tidak efektif.
              </span>
              <Button
                size="sm"
                onClick={handleRunAIRevision}
                disabled={isLoading || isApplying}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 h-9 px-4 shadow-sm cursor-pointer shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{loadingStep || "Sedang Memproses..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>{revisionResult ? "Generate Ulang Revisi" : "Mulai Analisis & Revisi Opsi AI"}</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* ERROR ALERT */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-1">
                <span className="font-bold block">Gagal Melakukan Revisi AI</span>
                <p className="leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* 4. HASIL ANALISIS STRATEGIS AI */}
          {revisionResult && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-linear-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-900/60 space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    Strategi Perbaikan Opsi Pengecoh (AI Insight)
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  {revisionResult.analysis}
                </p>
                {revisionResult.pedagogicalTip && (
                  <p className="text-[11px] text-blue-800 dark:text-blue-300 font-semibold pt-1 border-t border-blue-200/60 dark:border-blue-900/40 flex items-center gap-1.5">
                    <span>💡 Tips Pedagogis:</span> {revisionResult.pedagogicalTip}
                  </p>
                )}
              </div>

              {/* 5. TABEL INTERAKTIF PERBANDINGAN OPSI LAMA VS REVISI */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-emerald-600" />
                    Peninjauan Opsi Jawaban (Dapat Diedit Manual)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {isComplex ? "Centang semua opsi yang benar" : "Pilih 1 opsi kunci yang benar"}
                  </span>
                </div>

                <div className="space-y-3">
                  {Object.entries(editableChoices).map(([key, choice]) => {
                    const disInfo = getOriginalDistractorInfo(key);
                    const isKey = choice.isCorrect;

                    let statusBadgeClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
                    if (disInfo?.status === "Kunci") statusBadgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-black";
                    else if (disInfo?.status === "Menyesatkan") statusBadgeClass = "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-black";
                    else if (disInfo?.status === "Tidak Efektif") statusBadgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";

                    return (
                      <div
                        key={key}
                        className={cn(
                          "rounded-xl border p-3.5 space-y-2.5 transition-all",
                          isKey
                            ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        )}
                      >
                        {/* Option Card Header */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "inline-flex items-center justify-center h-6 w-6 rounded-lg text-xs font-black uppercase",
                              isKey
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                            )}>
                              {key.toUpperCase()}
                            </span>

                            {/* Toggle Kunci Jawaban */}
                            <button
                              type="button"
                              onClick={() => handleToggleCorrectKey(key)}
                              className={cn(
                                "text-xs font-bold px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1",
                                isKey
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                              )}
                            >
                              <CheckCircle2 className={cn("h-3.5 w-3.5", isKey ? "text-white" : "text-slate-400")} />
                              <span>{isKey ? "Kunci Jawaban Benar" : "Jadikan Kunci"}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Old status badge */}
                            {disInfo && (
                              <Badge className={cn("text-[10px] font-bold px-2 py-0.5", statusBadgeClass)}>
                                Semula: {disInfo.status} ({disInfo.totalPercent}% pemilih)
                              </Badge>
                            )}

                            {/* Revision status tag */}
                            <Badge className={cn(
                              "text-[10px] font-bold px-2 py-0.5 border",
                              choice.status === "revised"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200"
                                : choice.status === "refined"
                                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200"
                                : "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200"
                            )}>
                              {choice.status === "revised" ? "✨ Pengecoh Baru" : choice.status === "refined" ? "🛠️ Disempurnakan" : "Dipertahankan"}
                            </Badge>
                          </div>
                        </div>

                        {/* Comparison Grid: Old vs Revised */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {/* Left: Original Text */}
                          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Teks Asli Sebelum Revisi:
                            </span>
                            <div className="text-slate-600 dark:text-slate-300 font-medium">
                              <MathText content={choice.originalText || "(Kosong)"} />
                            </div>
                          </div>

                          {/* Right: Revised Text (Editable) */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                              Teks Revisi Baru (Dapat Diedit Langsung):
                            </span>
                            <textarea
                              value={choice.text}
                              onChange={(e) => handleChoiceTextChange(key, e.target.value)}
                              rows={2}
                              className="w-full text-xs p-2.5 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                              placeholder={`Teks pilihan ${key.toUpperCase()} yang baru...`}
                            />
                          </div>
                        </div>

                        {/* AI Rationale / Misconception Note */}
                        {choice.rationale && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                            <Info className="h-3 w-3 shrink-0 text-slate-400 mt-0.5" />
                            <span><strong>Target Pengecoh:</strong> {choice.rationale}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <DialogFooter className="px-4 sm:px-6 py-3.5 sm:py-4.5 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 m-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isApplying}
            className="w-full sm:w-auto text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
          >
            Batal
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {revisionResult && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRunAIRevision}
                disabled={isLoading || isApplying}
                className="flex-1 sm:flex-initial text-xs border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center gap-1.5 h-9"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                <span>Buat Ulang</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isLoading || isApplying || Object.keys(editableChoices).length === 0}
              className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 h-9 px-4 shadow-sm cursor-pointer"
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Menyimpan ke Bank Soal...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Terapkan ke Bank Soal</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AIQuestionRevisionDialog;
