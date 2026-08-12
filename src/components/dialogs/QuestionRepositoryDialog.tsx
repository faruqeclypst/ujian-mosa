import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Search, Database, Globe, Check, Loader2, BookOpen, Layers, CheckSquare, Square, ExternalLink } from "lucide-react";
import { MathText } from "../ui/MathText";
import { Badge } from "../ui/badge";
import { fetchQuizizzQuiz, QuizizzQuizDetails, ExternalQuestionItem } from "../../lib/quizizzApi";
import { useTenant } from "../../context/TenantContext";

export interface QuestionImportItem {
  text: string;
  type: string;
  choices?: Record<string, string>;
  answerKey?: string;
  explanation?: string;
  score?: number;
  imageUrl?: string;
  source?: string;
}

interface QuestionRepositoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  exams: any[];
  pb: any;
  onImportQuestions: (questions: QuestionImportItem[]) => Promise<void>;
}

export const QuestionRepositoryDialog: React.FC<QuestionRepositoryDialogProps> = ({
  isOpen,
  onOpenChange,
  exams,
  pb,
  onImportQuestions
}) => {
  const { terminology } = useTenant();
  const [activeTab, setActiveTab] = useState<"internal" | "quizizz">("internal");

  // Tab 1: Internal States
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [internalQuestions, setInternalQuestions] = useState<any[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(false);

  // Tab 2: Quizizz States
  const [quizizzUrl, setQuizizzUrl] = useState("");
  const [loadingQuizizz, setLoadingQuizizz] = useState(false);
  const [quizizzDetails, setQuizizzDetails] = useState<QuizizzQuizDetails | null>(null);
  const [quizizzError, setQuizizzError] = useState("");

  // Shared Filters & Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setSearchQuery("");
      setQuizizzError("");
      if (exams.length > 0 && !selectedExamId) {
        setSelectedExamId(exams[0].id);
      }
    }
  }, [isOpen, exams]);

  // Load internal questions when selectedExamId changes
  useEffect(() => {
    if (!isOpen || activeTab !== "internal" || !selectedExamId || !pb) return;

    const fetchInternal = async () => {
      setLoadingInternal(true);
      try {
        const records = await pb.collection("questions").getFullList({
          filter: `examId = "${selectedExamId}"`,
          sort: "+created"
        });
        setInternalQuestions(records);
      } catch (err) {
        console.error("Error fetching internal questions:", err);
      } finally {
        setLoadingInternal(false);
      }
    };

    fetchInternal();
  }, [isOpen, activeTab, selectedExamId, pb]);

  // Fetch Quizizz Quiz
  const handleFetchQuizizz = async () => {
    if (!quizizzUrl.trim()) return;
    setLoadingQuizizz(true);
    setQuizizzError("");
    setQuizizzDetails(null);
    setSelectedIds(new Set());

    try {
      const data = await fetchQuizizzQuiz(quizizzUrl);
      setQuizizzDetails(data);
    } catch (err: any) {
      setQuizizzError(err?.message || "Gagal mengambil kuis dari Quizizz.");
    } finally {
      setLoadingQuizizz(false);
    }
  };

  // Determine current active question items for rendering
  const activeQuestions = useMemo(() => {
    if (activeTab === "internal") {
      return internalQuestions.map(q => ({
        rawId: q.id,
        text: q.text,
        type: q.type || "pilihan_ganda",
        choices: q.choices || q.options || {},
        answerKey: q.answerKey || q.correctAnswer || "A",
        score: q.score || 1,
        source: `Internal: ${exams.find(e => e.id === selectedExamId)?.title || "Bank Soal"}`
      }));
    } else {
      if (!quizizzDetails) return [];
      return quizizzDetails.questions.map(q => ({
        rawId: q.id,
        text: q.text,
        type: q.type,
        choices: q.choices,
        answerKey: q.answerKey,
        score: q.score || 1,
        source: `Quizizz: ${quizizzDetails.title}`
      }));
    }
  }, [activeTab, internalQuestions, selectedExamId, exams, quizizzDetails]);

  // Filtered by search query
  const filteredQuestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeQuestions;
    return activeQuestions.filter(item =>
      String(item.text || "").toLowerCase().includes(q) ||
      Object.values(item.choices || {}).some(v => String(v || "").toLowerCase().includes(q))
    );
  }, [activeQuestions, searchQuery]);

  // Checkbox handlers
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map(q => q.rawId)));
    }
  };

  // Import handler
  const handleExecuteImport = async () => {
    if (selectedIds.size === 0) return;
    setIsImporting(true);

    try {
      const itemsToImport: QuestionImportItem[] = activeQuestions
        .filter(q => selectedIds.has(q.rawId))
        .map(q => ({
          text: q.text,
          type: q.type,
          choices: q.choices,
          answerKey: q.answerKey,
          score: q.score || 1,
          source: q.source
        }));

      await onImportQuestions(itemsToImport);
      onOpenChange(false);
    } catch (err) {
      console.error("Import error:", err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-800 dark:text-white">
                  Ambil & Impor Butir Soal
                </DialogTitle>

                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pilih butir soal dari Bank Soal internal sekolah atau ambil kuis publik dari Quizizz.
                </DialogDescription>
              </div>
            </div>

            {/* Tab Selector */}
            <div className="flex bg-slate-200/70 dark:bg-slate-800/70 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setActiveTab("internal"); setSelectedIds(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === "internal"
                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Bank Sekolah
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("quizizz"); setSelectedIds(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === "quizizz"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-purple-600 dark:text-purple-400 hover:text-purple-800"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                Impor Quizizz
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: INTERNAL BANK SOAL */}
          {activeTab === "internal" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                    Pilih Bank Soal Sumber:
                  </label>
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.subjectName || "Mapel"})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                    Cari Teks Soal:
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Cari kata dalam soal..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 text-xs rounded-xl h-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: QUIZIZZ REST API */}
          {activeTab === "quizizz" && (
            <div className="space-y-3 bg-purple-50/50 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30">
              <label className="text-xs font-bold text-purple-900 dark:text-purple-300 block">
                Link atau ID Kuis Quizizz:
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste link Quizizz (misal: https://quizizz.com/admin/quiz/613eabc...)"
                  value={quizizzUrl}
                  onChange={(e) => setQuizizzUrl(e.target.value)}
                  className="text-xs rounded-xl bg-white dark:bg-slate-900 border-purple-200 dark:border-purple-800 h-10"
                />
                <Button
                  onClick={handleFetchQuizizz}
                  disabled={loadingQuizizz || !quizizzUrl.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold px-4 shrink-0 h-10"
                >
                  {loadingQuizizz ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Ambil Data...
                    </>
                  ) : (
                    <>
                      <Globe className="mr-1.5 h-4 w-4" /> Ambil Soal Quizizz
                    </>
                  )}
                </Button>
              </div>

              {quizizzError && (
                <div className="text-xs text-rose-600 font-semibold bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/40">
                  ⚠️ {quizizzError}
                </div>
              )}

              {quizizzDetails && (
                <div className="flex items-center justify-between text-xs text-purple-800 dark:text-purple-300 font-bold bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-purple-200 dark:border-purple-800">
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-purple-600" />
                    Kuis Ditemukan: {quizizzDetails.title}
                  </span>
                  <Badge variant="outline" className="border-purple-300 text-purple-700 dark:text-purple-300">
                    {quizizzDetails.questions.length} Soal
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* QUESTIONS LIST WITH PREVIEW & MULTI-SELECT */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  disabled={filteredQuestions.length === 0}
                  className="h-7 text-xs rounded-lg px-2.5 font-bold"
                >
                  {selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0 ? (
                    <>
                      <CheckSquare className="mr-1.5 h-3.5 w-3.5 text-blue-600" /> Batal Pilih Semua
                    </>
                  ) : (
                    <>
                      <Square className="mr-1.5 h-3.5 w-3.5 text-slate-400" /> Pilih Semua ({filteredQuestions.length})
                    </>
                  )}
                </Button>
              </div>

              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {selectedIds.size} Soal Terpilih
              </span>
            </div>

            {/* List Render */}
            {loadingInternal || loadingQuizizz ? (
              <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                Memuat daftar soal...
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                {activeTab === "quizizz" && !quizizzDetails
                  ? "Masukkan URL Kuis Quizizz lalu klik 'Ambil Soal Quizizz'."
                  : "Tidak ada butir soal ditemukan."}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {filteredQuestions.map((q, index) => {
                  const isSelected = selectedIds.has(q.rawId);
                  return (
                    <div
                      key={q.rawId}
                      onClick={() => toggleSelect(q.rawId)}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? "bg-blue-50/60 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700 shadow-sm"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5 shrink-0">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-300 dark:text-slate-700" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">
                              No. {index + 1} &bull; {q.type.replace("_", " ")}
                            </span>
                            <Badge variant="outline" className="text-[9px] py-0">
                              Kunci: {q.answerKey}
                            </Badge>
                          </div>

                          <MathText content={q.text} className="text-slate-800 dark:text-slate-200 font-medium line-clamp-3" />

                          {/* Choices Preview */}
                          {Object.keys(q.choices).length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                              {Object.entries(q.choices).map(([letter, text]) => {
                                const optText = typeof text === "string" ? text : (text as any)?.text || "";
                                return (
                                  <div key={letter} className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                                    <span className="font-bold">{letter}.</span> {optText}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs font-semibold"
          >
            Batal
          </Button>

          <Button
            type="button"
            disabled={selectedIds.size === 0 || isImporting}
            onClick={handleExecuteImport}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold px-5 shadow-lg shadow-blue-500/20"
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Menyimpan Soal...
              </>
            ) : (
              <>
                <Check className="mr-1.5 h-4 w-4" /> Impor {selectedIds.size} Soal Terpilih
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuestionRepositoryDialog;
