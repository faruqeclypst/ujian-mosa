import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { MathText } from "../ui/MathText";
import { 
  Search, 
  Database, 
  Globe, 
  Check, 
  Loader2, 
  BookOpen, 
  CheckSquare, 
  Square, 
  HelpCircle,
  ExternalLink,
  Sparkles,
  FileJson,
  Code2
} from "lucide-react";
import { useExamData } from "../../context/ExamDataContext";
import { useTenant } from "../../context/TenantContext";
import { fetchWaygroundQuiz, parseWaygroundQuizData, ParsedExternalQuestion } from "../../lib/waygroundApi";
import type { QuestionData, QuestionType } from "../../pages/admin/QuestionsPage";

interface QuestionRepositoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  targetExamId: string;
  targetExamTitle?: string;
  onImportQuestions: (questionsToImport: Partial<QuestionData>[]) => Promise<void>;
}

export const QuestionRepositoryDialog: React.FC<QuestionRepositoryDialogProps> = ({
  isOpen,
  onOpenChange,
  targetExamId,
  targetExamTitle,
  onImportQuestions
}) => {
  const { pb } = useTenant();
  const { subjects } = useExamData();

  const [activeTab, setActiveTab] = useState<"internal" | "wayground">("internal");
  
  // State Tab Internal
  const [examsList, setExamsList] = useState<any[]>([]);
  const [selectedSourceExamId, setSelectedSourceExamId] = useState<string>("");
  const [internalQuestions, setInternalQuestions] = useState<QuestionData[]>([]);
  const [loadingInternalExams, setLoadingInternalExams] = useState(false);
  const [loadingInternalQuestions, setLoadingInternalQuestions] = useState(false);

  // State Tab Wayground
  const [waygroundUrl, setWaygroundUrl] = useState("");
  const [loadingWayground, setLoadingWayground] = useState(false);
  const [waygroundMeta, setWaygroundMeta] = useState<{ title: string; subject?: string } | null>(null);
  const [waygroundQuestions, setWaygroundQuestions] = useState<ParsedExternalQuestion[]>([]);
  const [waygroundError, setWaygroundError] = useState("");
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [rawJsonText, setRawJsonText] = useState("");

  const handleParseRawJson = () => {
    if (!rawJsonText.trim()) return;
    setWaygroundError("");
    try {
      const parsedObj = JSON.parse(rawJsonText.trim());
      const meta = parseWaygroundQuizData(parsedObj, "manual-json");
      setWaygroundMeta({ title: meta.title, subject: meta.subject });
      setWaygroundQuestions(meta.questions);
      setSelectedQuestionIds(new Set());
      setShowJsonInput(false);
    } catch (e: any) {
      setWaygroundError("Format JSON tidak valid. Pastikan Anda menyalin seluruh teks respons JSON kuis.");
    }
  };

  // Shared state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);

  // Fetch daftar Bank Soal Internal saat modal dibuka
  useEffect(() => {
    if (!isOpen || !pb) return;
    
    const fetchInternalExams = async () => {
      setLoadingInternalExams(true);
      try {
        const records = await pb.collection("exams").getFullList({
          filter: `id != "${targetExamId}" && status != "archive"`,
          sort: "-created"
        });
        setExamsList(records);
        if (records.length > 0) {
          setSelectedSourceExamId(records[0].id);
        }
      } catch (e) {
        console.error("Gagal load daftar exam:", e);
      } finally {
        setLoadingInternalExams(false);
      }
    };

    fetchInternalExams();
  }, [isOpen, pb, targetExamId]);

  // Fetch butir soal dari Paket Internal terpilih
  useEffect(() => {
    if (!isOpen || !pb || !selectedSourceExamId) return;

    const fetchQuestionsOfExam = async () => {
      setLoadingInternalQuestions(true);
      setSelectedQuestionIds(new Set());
      try {
        const records = await pb.collection("questions").getFullList({
          filter: `examId = "${selectedSourceExamId}"`,
          sort: "created"
        });
        setInternalQuestions(records as any);
      } catch (e) {
        console.error("Gagal load questions internal:", e);
      } finally {
        setLoadingInternalQuestions(false);
      }
    };

    fetchQuestionsOfExam();
  }, [isOpen, pb, selectedSourceExamId]);

  // Fetch dari Wayground REST API
  const handleFetchWayground = async () => {
    if (!waygroundUrl.trim()) return;
    setLoadingWayground(true);
    setWaygroundError("");
    setSelectedQuestionIds(new Set());

    try {
      const meta = await fetchWaygroundQuiz(waygroundUrl);
      setWaygroundMeta({ title: meta.title, subject: meta.subject });
      setWaygroundQuestions(meta.questions);
    } catch (err: any) {
      console.error(err);
      setWaygroundError(err?.message || "Gagal mengambil kuis dari Wayground API.");
    } finally {
      setLoadingWayground(false);
    }
  };

  // Filtered List tergantung Tab
  const activeQuestionsList = useMemo(() => {
    const sourceList = activeTab === "internal" ? internalQuestions : waygroundQuestions;
    const q = searchQuery.trim().toLowerCase();

    return sourceList.filter((item: any) => {
      // Type Filter
      if (selectedTypeFilter !== "all") {
        const itemType = item.type || "pilihan_ganda";
        if (itemType !== selectedTypeFilter) return false;
      }

      // Text Search
      if (!q) return true;
      const textToSearch = `${item.text || ""} ${item.groupText || ""}`.toLowerCase();
      return textToSearch.includes(q);
    });
  }, [activeTab, internalQuestions, waygroundQuestions, searchQuery, selectedTypeFilter]);

  // Toggle selection
  const toggleQuestionSelect = (id: string) => {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedQuestionIds.size === activeQuestionsList.length && activeQuestionsList.length > 0) {
      setSelectedQuestionIds(new Set());
    } else {
      setSelectedQuestionIds(new Set(activeQuestionsList.map((q: any) => q.id)));
    }
  };

  // Submit Import
  const handleExecuteImport = async () => {
    if (selectedQuestionIds.size === 0) return;
    setIsSubmittingImport(true);

    try {
      const sourceList = activeTab === "internal" ? internalQuestions : waygroundQuestions;
      const selectedItems = sourceList.filter((q: any) => selectedQuestionIds.has(q.id));

      const questionsToImport: Partial<QuestionData>[] = selectedItems.map((q: any) => ({
        type: q.type || "pilihan_ganda",
        text: q.text || "",
        imageUrl: q.imageUrl || undefined,
        groupText: q.groupText || undefined,
        choices: q.choices || undefined,
        pairs: q.pairs || undefined,
        answerKey: q.answerKey || undefined,
        items: q.items || undefined,
      }));

      await onImportQuestions(questionsToImport);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingImport(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-100/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Repository & Impor Butir Soal
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 text-[10px]">
                    Khusus Admin
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pilih butir soal dari Bank Soal sekolah atau impor otomatis dari Wayground REST API.
                </DialogDescription>
              </div>
            </div>

            {/* Tab Selector */}
            <div className="flex bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => { setActiveTab("internal"); setSelectedQuestionIds(new Set()); }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === "internal" 
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                Bank Internal
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("wayground"); setSelectedQuestionIds(new Set()); }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === "wayground" 
                    ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm" 
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                Wayground API
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: BANK INTERNAL */}
          {activeTab === "internal" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Select Bank Soal Sumber */}
                <div className="flex-1 min-w-[240px]">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Pilih Bank Soal Sumber:
                  </label>
                  {loadingInternalExams ? (
                    <Skeleton className="h-9 w-full rounded-xl" />
                  ) : (
                    <select
                      value={selectedSourceExamId}
                      onChange={(e) => setSelectedSourceExamId(e.target.value)}
                      className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500"
                    >
                      {examsList.length === 0 ? (
                        <option value="">(Tidak ada Bank Soal lain)</option>
                      ) : (
                        examsList.map((exam) => {
                          const subjName = subjects.find((s: any) => s.id === (exam.subjectId || exam.subjectid))?.name || "";
                          return (
                            <option key={exam.id} value={exam.id}>
                              {exam.title} {subjName ? `(${subjName})` : ""}
                            </option>
                          );
                        })
                      )}
                    </select>
                  )}
                </div>

                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Cari Kata Kunci Soal:
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari teks soal..."
                      className="pl-9 h-9 text-xs rounded-xl"
                    />
                  </div>
                </div>

                {/* Filter Tipe Soal */}
                <div className="w-full sm:w-44">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Tipe Soal:
                  </label>
                  <select
                    value={selectedTypeFilter}
                    onChange={(e) => setSelectedTypeFilter(e.target.value)}
                    className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Semua Tipe</option>
                    <option value="pilihan_ganda">Pilihan Ganda</option>
                    <option value="pilihan_ganda_kompleks">PG Kompleks</option>
                    <option value="isian_singkat">Isian Singkat</option>
                    <option value="uraian">Uraian</option>
                    <option value="menjodohkan">Menjodohkan</option>
                    <option value="urutkan">Urutkan</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WAYGROUND REST API */}
          {activeTab === "wayground" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 text-xs text-purple-800 dark:text-purple-300 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Impor REST API Wayground:</strong> Tempelkan Link Kuis Wayground (contoh: <code>https://wayground.com/...</code>) atau ID Kuis untuk mengambil soal beserta pilihan jawaban & kunci secara instan.
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  value={waygroundUrl}
                  onChange={(e) => setWaygroundUrl(e.target.value)}
                  placeholder="Tempel Link / ID Kuis Wayground di sini..."
                  className="h-10 text-xs rounded-xl flex-1 border-purple-200 dark:border-purple-900 focus:ring-purple-500"
                />
                <Button
                  type="button"
                  onClick={handleFetchWayground}
                  disabled={loadingWayground || !waygroundUrl.trim()}
                  className="h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                >
                  {loadingWayground ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ambil Soal"}
                </Button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowJsonInput(!showJsonInput)}
                  className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1.5"
                >
                  <FileJson className="h-3.5 w-3.5" />
                  {showJsonInput ? "Sembunyikan Input JSON" : "Alternatif: Paste Respons JSON Kuis Direct"}
                </button>
              </div>

              {showJsonInput && (
                <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-900/50 space-y-2">
                  <p className="text-[11px] text-purple-700 dark:text-purple-300">
                    Buka link API kuis di tab browser (contoh: <code>https://quizizz.com/api/main/quiz/{`{ID_KUIS}`}</code>), salin seluruh isi teks JSON dan tempelkan di bawah ini:
                  </p>
                  <textarea
                    rows={4}
                    value={rawJsonText}
                    onChange={(e) => setRawJsonText(e.target.value)}
                    placeholder='{"info": {"name": "..."}, "questions": [...] }'
                    className="w-full p-2 text-xs font-mono rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleParseRawJson}
                      disabled={!rawJsonText.trim()}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg px-4"
                    >
                      Parse Soal JSON
                    </Button>
                  </div>
                </div>
              )}

              {waygroundError && (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                  ⚠️ {waygroundError}
                </p>
              )}

              {waygroundMeta && (
                <div className="flex items-center justify-between text-xs bg-slate-100 dark:bg-slate-800/60 p-2.5 rounded-xl">
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    Kuis: {waygroundMeta.title}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {waygroundQuestions.length} Butir Soal Terdeteksi
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* LIST PRATINJAU SOAL */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={activeQuestionsList.length === 0}
                className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600"
              >
                {selectedQuestionIds.size === activeQuestionsList.length && activeQuestionsList.length > 0 ? (
                  <CheckSquare className="h-4 w-4 text-blue-600" />
                ) : (
                  <Square className="h-4 w-4 text-slate-400" />
                )}
                Pilih Semua ({selectedQuestionIds.size}/{activeQuestionsList.length} terpilih)
              </button>

              <span className="text-[11px] text-slate-500 font-medium">
                Menampilkan {activeQuestionsList.length} soal
              </span>
            </div>

            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2">
              {loadingInternalQuestions || loadingWayground ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              ) : activeQuestionsList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Tidak ada butir soal ditemukan.
                </div>
              ) : (
                activeQuestionsList.map((item: any, idx: number) => {
                  const isSelected = selectedQuestionIds.has(item.id);
                  return (
                    <div
                      key={item.id || idx}
                      onClick={() => toggleQuestionSelect(item.id)}
                      className={`p-3 rounded-xl cursor-pointer transition-all flex items-start gap-3 border ${
                        isSelected 
                          ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60 shadow-sm" 
                          : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="pt-0.5">
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-blue-600 shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400 shrink-0" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] uppercase font-bold py-0.5 px-1.5">
                            No. {idx + 1}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] uppercase font-semibold py-0.5 px-1.5">
                            {item.type || "pilihan_ganda"}
                          </Badge>
                        </div>

                        {/* Soal Text Preview */}
                        <div className="text-xs text-slate-800 dark:text-slate-200 font-serif leading-relaxed line-clamp-3">
                          <MathText content={item.text} />
                        </div>

                        {/* Pilihan Preview jika PG */}
                        {item.choices && (
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            {Object.entries(item.choices).map(([key, val]: [string, any]) => (
                              <div 
                                key={key} 
                                className={`text-[11px] px-2 py-1 rounded-lg border ${
                                  val.isCorrect 
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold" 
                                    : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                <span className="font-bold mr-1">{key}.</span>
                                <MathText content={val.text || ""} className="inline" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            {selectedQuestionIds.size} butir soal dipilih
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleExecuteImport}
              disabled={isSubmittingImport || selectedQuestionIds.size === 0}
              className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
            >
              {isSubmittingImport ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Mengimpor...
                </>
              ) : (
                `Gunakan ${selectedQuestionIds.size} Soal Terpilih`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuestionRepositoryDialog;
