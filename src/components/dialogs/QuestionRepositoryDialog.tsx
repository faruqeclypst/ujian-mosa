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
  FileText,
  Sparkles,
  Layers
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
  const [isJsonInputMode, setIsJsonInputMode] = useState(false);
  const [rawJsonText, setRawJsonText] = useState("");

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

  // Fetch & Normalisasi butir soal dari Bank Soal Internal terpilih
  useEffect(() => {
    if (!isOpen || !pb || !selectedSourceExamId) return;

    const fetchQuestionsOfExam = async () => {
      setLoadingInternalQuestions(true);
      setSelectedQuestionIds(new Set());
      try {
        const records = await pb.collection("questions").getFullList({
          filter: `examId = "${selectedSourceExamId}"`,
          sort: "order,created"
        });

        const typeMapReverse: Record<string, QuestionType> = {
          multiple_choice: "pilihan_ganda",
          complex_choice: "pilihan_ganda_kompleks",
          matching: "menjodohkan",
          true_false: "benar_salah",
          short_answer: "isian_singkat",
          essay: "uraian",
          sequence: "urutkan",
          drag_drop: "drag_drop"
        };

        // Kumpulkan map stimulus wacana literasi (groupId -> groupText)
        const groupTextMap: Record<string, string> = {};
        records.forEach((q: any) => {
          const gId = q.groupId || q.group_id;
          const gTxt = q.groupText || q.group_text;
          if (gId && gTxt && !groupTextMap[gId]) {
            groupTextMap[gId] = gTxt;
          }
        });

        const normalized: QuestionData[] = records.map((q: any) => {
          const rawType = q.field || q.type || "pilihan_ganda";
          const mappedType: QuestionType = (typeMapReverse[rawType] || rawType) as QuestionType;
          const options = q.options || q.choices || {};
          const gId = q.groupId || q.group_id || "";
          const gTxt = q.groupText || q.group_text || (gId ? groupTextMap[gId] || "" : "");
          const ansKey = q.correctAnswer || q.answerKey || q.correct_answer || q.answer || "";

          let choicesObj: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }> | undefined = undefined;
          if (mappedType === "pilihan_ganda" || mappedType === "pilihan_ganda_kompleks" || mappedType === "benar_salah") {
            if (options && typeof options === "object" && !Array.isArray(options)) {
              const currentChoices: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }> = { ...options };
              // Pastikan status isCorrect sinkron dengan answerKey / correctAnswer
              if (ansKey) {
                const correctKeys = ansKey.toLowerCase().split(/[,|; ]+/).map((s: string) => s.trim());
                Object.keys(currentChoices).forEach((k) => {
                  if (currentChoices[k]) {
                    const isCorr = currentChoices[k].isCorrect !== undefined
                      ? Boolean(currentChoices[k].isCorrect)
                      : correctKeys.includes(k.toLowerCase());
                    currentChoices[k] = { ...currentChoices[k], isCorrect: isCorr };
                  }
                });
              }
              choicesObj = currentChoices;
            }
          }

          return {
            id: q.id,
            examId: q.examId || q.examid || selectedSourceExamId,
            type: mappedType,
            text: q.text || "",
            imageUrl: q.imageUrl || q.image_url || undefined,
            groupId: gId || undefined,
            groupText: gTxt || undefined,
            choices: choicesObj,
            pairs: mappedType === "menjodohkan" ? (options.pairs || q.pairs) : undefined,
            items: (mappedType === "urutkan" || mappedType === "drag_drop") ? (options.items || q.items) : undefined,
            answerKey: ansKey || undefined,
            order: q.order
          };
        });

        // Pertahankan urutan soal berdasarkan paket literasi
        const grouped: QuestionData[] = [];
        const seen = new Set<string>();
        normalized.forEach((q) => {
          if (seen.has(q.id)) return;
          if (q.groupId) {
            if (!seen.has("group_" + q.groupId)) {
              seen.add("group_" + q.groupId);
              const groupQuestions = normalized.filter((gq) => gq.groupId === q.groupId);
              groupQuestions.forEach((gq) => {
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

        setInternalQuestions(grouped);
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

  const handleParseJsonInput = () => {
    if (!rawJsonText.trim()) return;
    setWaygroundError("");
    setSelectedQuestionIds(new Set());
    try {
      const parsed = JSON.parse(rawJsonText);
      const meta = parseWaygroundQuizData(parsed);
      setWaygroundMeta({ title: meta.title, subject: meta.subject });
      setWaygroundQuestions(meta.questions);
      setIsJsonInputMode(false);
    } catch (e: any) {
      setWaygroundError(e?.message || "Format JSON tidak valid.");
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

      // Text Search (Mencari di teks soal, teks wacana literasi, dan ID/nama paket)
      if (!q) return true;
      const textToSearch = `${item.text || ""} ${item.groupText || ""} ${item.groupId || ""}`.toLowerCase();
      return textToSearch.includes(q);
    });
  }, [activeTab, internalQuestions, waygroundQuestions, searchQuery, selectedTypeFilter]);

  // Toggle selection satu butir soal
  const toggleQuestionSelect = (id: string) => {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle semua butir soal di paket literasi yang sama
  const toggleGroupSelect = (groupId: string) => {
    if (!groupId) return;
    const groupItems = activeQuestionsList.filter((q: any) => q.groupId === groupId);
    const allSelected = groupItems.every((q: any) => selectedQuestionIds.has(q.id));

    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      groupItems.forEach((q: any) => {
        if (allSelected) {
          next.delete(q.id);
        } else {
          next.add(q.id);
        }
      });
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
        groupId: q.groupId || undefined,
        groupText: q.groupText || undefined,
        choices: q.choices || undefined,
        pairs: q.pairs || undefined,
        answerKey: q.answerKey || undefined,
        items: q.items || undefined,
      }));

      await onImportQuestions(questionsToImport);
      onOpenChange(false);
    } catch (e) {
      console.error("Gagal eksekusi impor soal:", e);
    } finally {
      setIsSubmittingImport(false);
    }
  };

  const typeLabels: Record<string, string> = {
    pilihan_ganda: "Pilihan Ganda",
    pilihan_ganda_kompleks: "PG Kompleks",
    menjodohkan: "Menjodohkan",
    benar_salah: "Benar/Salah",
    isian_singkat: "Isian Singkat",
    uraian: "Uraian",
    urutkan: "Urutkan",
    drag_drop: "Drag & Drop"
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
                    Cari Kata Kunci Soal / Wacana:
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari teks soal atau wacana..."
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
                    <option value="drag_drop">Drag & Drop</option>
                    <option value="benar_salah">Benar / Salah</option>
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
                  <strong>Impor REST API Wayground:</strong> Tempelkan Link Kuis Wayground (contoh: <code>https://wayground.com/activity/admin/quiz/5daf...</code>) atau ID Kuis untuk mengambil soal secara otomatis via CORS Proxy.
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
                  {loadingWayground ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ambil Soal (Auto)"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsJsonInputMode(!isJsonInputMode)}
                  className="h-10 px-3 rounded-xl border-purple-200 text-purple-700 dark:text-purple-300 font-semibold text-xs"
                >
                  {isJsonInputMode ? "Tutup Textarea" : "Paste JSON"}
                </Button>
              </div>

              {isJsonInputMode && (
                <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-xl space-y-2">
                  <textarea
                    rows={4}
                    value={rawJsonText}
                    onChange={(e) => setRawJsonText(e.target.value)}
                    placeholder="Paste teks JSON respons kuis Wayground di sini..."
                    className="w-full p-2.5 text-xs font-mono rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                  <Button
                    type="button"
                    onClick={handleParseJsonInput}
                    disabled={!rawJsonText.trim()}
                    className="h-8 px-3 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs"
                  >
                    Parse Data JSON Instan
                  </Button>
                </div>
              )}

              {waygroundError && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                    ⚠️ {waygroundError}
                  </p>
                </div>
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

            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2">
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
                  const isGrouped = Boolean(item.groupId);
                  const groupQuestions = isGrouped ? activeQuestionsList.filter((q: any) => q.groupId === item.groupId) : [];
                  const isFirstInGroup = isGrouped && groupQuestions[0]?.id === item.id;

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

                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Header Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[9px] uppercase font-bold py-0.5 px-1.5">
                            No. {idx + 1}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] uppercase font-semibold py-0.5 px-1.5">
                            {typeLabels[item.type || "pilihan_ganda"] || item.type || "Pilihan Ganda"}
                          </Badge>

                          {/* Paket Literasi Badge & Quick Group Selector */}
                          {item.groupId && (
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-bold py-0.5 px-2 flex items-center gap-1">
                                <FileText className="h-2.5 w-2.5" />
                                Literasi: {item.groupId}
                              </Badge>
                              {groupQuestions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleGroupSelect(item.groupId);
                                  }}
                                  className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 hover:underline bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/40 flex items-center gap-1"
                                >
                                  <Layers className="h-2.5 w-2.5" />
                                  Pilih 1 Paket ({groupQuestions.length} soal)
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Stimulus Wacana Bacaan Preview (jika ada groupText) */}
                        {item.groupText && (
                          <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                              <FileText className="h-3 w-3" />
                              Teks Stimulus / Wacana Bacaan:
                            </div>
                            <div className="max-h-24 overflow-y-auto font-serif leading-relaxed line-clamp-3 text-[11px]">
                              <MathText content={item.groupText} />
                            </div>
                          </div>
                        )}

                        {/* Question Text */}
                        <div className="text-xs text-slate-800 dark:text-slate-200 font-serif leading-relaxed line-clamp-3">
                          <MathText content={item.text} />
                        </div>

                        {/* Image Preview if any */}
                        {item.imageUrl && (
                          <div className="pt-1">
                            <img 
                              src={item.imageUrl} 
                              alt="soal" 
                              className="max-h-24 rounded-lg border border-slate-200 dark:border-slate-800 object-contain bg-white dark:bg-slate-900" 
                            />
                          </div>
                        )}

                        {/* Pilihan Preview jika PG / PG Kompleks / Benar Salah */}
                        {item.choices && Object.keys(item.choices).length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {Object.entries(item.choices).map(([key, val]: [string, any]) => (
                              <div 
                                key={key} 
                                className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-start gap-1.5 ${
                                  val.isCorrect 
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-bold" 
                                    : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                <span className="font-black shrink-0">{key.toUpperCase()}.</span>
                                <div className="flex-1 min-w-0">
                                  <MathText content={val.text || ""} className="inline" />
                                  {val.imageUrl && (
                                    <img src={val.imageUrl} alt="" className="max-h-12 mt-1 rounded border border-slate-200" />
                                  )}
                                </div>
                                {val.isCorrect && (
                                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 stroke-[3px]" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Menjodohkan Pairs Preview */}
                        {item.type === "menjodohkan" && item.pairs && item.pairs.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <div className="text-[10px] font-bold text-slate-500 uppercase">{item.pairs.length} Pasangan:</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {item.pairs.map((p: any, pIdx: number) => (
                                <div key={p.id || pIdx} className="text-[11px] p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                  <span className="font-semibold">{p.left}</span>
                                  <span className="text-blue-500 font-bold mx-2">➔</span>
                                  <span>{p.right}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Isian / Uraian Answer Key Preview */}
                        {(item.type === "isian_singkat" || item.type === "uraian") && item.answerKey && (
                          <div className="text-[11px] px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                            <span className="font-bold mr-1">Kunci Jawaban:</span> {item.answerKey}
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
