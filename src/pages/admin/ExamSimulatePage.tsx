import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, Reorder } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { MathText } from "../../components/ui/MathText";
import { SmartImage } from "../../components/ui/smart-image";
import { Card, CardContent } from "../../components/ui/card";
import {
  ChevronLeft, ChevronRight, X, LogOut, CheckCircle2, Flag,
  AlertCircle, ArrowRight, GripVertical, Maximize2, Eye
} from "lucide-react";

/* ============================================================
   HorizontalScrollHint — salinan dari CBTPage (indikator geser)
   ============================================================ */
const HorizontalScrollHint = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const overflow = el.scrollWidth > el.clientWidth + 8;
      setCanScroll(overflow);
      if (!overflow) setShowHint(false);
    };
    check();
    const t = setTimeout(check, 300);
    window.addEventListener("resize", check);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", check);
    };
  }, []);

  const handleScroll = () => {
    const el = ref.current;
    if (el && el.scrollLeft > 16) setShowHint(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        onScroll={handleScroll}
        className="overflow-x-auto pb-3"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="flex gap-2 w-max min-w-full items-center">{children}</div>
      </div>
      {canScroll && showHint && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center">
          <div className="h-full w-10 bg-gradient-to-l from-white dark:from-slate-900 to-transparent" />
          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 dark:text-slate-500 animate-pulse whitespace-nowrap bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
            ← geser →
          </span>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   Tipe data soal (disederhanakan dari CBTPage)
   ============================================================ */
type SimQuestion = {
  id: string;
  type: string;
  text: string;
  imageUrl: string;
  groupId: string;
  groupText: string;
  choices: any;
  pairs: any;
  items: any;
  statements: any;
  columns: any;
  blanks: any;
  rumpangText: string;
  hotspotImageUrl: string;
  hotspotMode: string;
  shuffleStatements: boolean;
};

const TYPE_MAP: Record<string, string> = {
  "multiple_choice": "pilihan_ganda",
  "complex_multiple_choice": "pilihan_ganda_kompleks",
  "complex_choice": "pilihan_ganda_kompleks",
  "short_answer": "isian_singkat",
  "essay": "uraian",
  "matching": "menjodohkan",
  "ordering": "urutkan",
  "sequence": "urutkan",
  "true_false": "benar_salah",
  "drag_drop": "drag_drop",
  "klasifikasi": "klasifikasi",
  "hotspot": "hotspot",
  "isian_rumpang": "isian_rumpang",
  "matriks": "matriks",
  "pilihan_ganda": "pilihan_ganda",
  "pilihan_ganda_kompleks": "pilihan_ganda_kompleks",
  "isian_singkat": "isian_singkat",
  "uraian": "uraian",
  "menjodohkan": "menjodohkan",
  "urutkan": "urutkan",
  "benar_salah": "benar_salah",
};

const TYPE_LABEL: Record<string, string> = {
  "pilihan_ganda": "Pilihan Ganda",
  "pilihan_ganda_kompleks": "PG Kompleks",
  "menjodohkan": "Menjodohkan",
  "benar_salah": "Benar / Salah",
  "isian_singkat": "Isian Singkat",
  "uraian": "Uraian",
  "urutkan": "Mengurutkan",
  "drag_drop": "Drag & Drop",
  "klasifikasi": "Klasifikasi",
  "hotspot": "Hotspot",
  "isian_rumpang": "Isian Rumpang",
  "matriks": "Matriks",
};

/* Cek apakah soal sudah dijawab (untuk indikator navigasi) */
function isAnswered(q: SimQuestion, ans: any): boolean {
  if (ans === undefined || ans === null || ans === "") return false;
  switch (q.type) {
    case "pilihan_ganda":
      return typeof ans === "string" && ans !== "";
    case "pilihan_ganda_kompleks":
      return Array.isArray(ans) && ans.length > 0;
    case "benar_salah":
    case "matriks":
    case "klasifikasi": {
      if (typeof ans !== "object") return false;
      const stmts = q.statements || [];
      if (stmts.length === 0) return false;
      return stmts.some((s: any) => ans[s.id]);
    }
    case "menjodohkan": {
      if (typeof ans !== "object") return false;
      return Object.keys(ans).length > 0;
    }
    case "isian_rumpang": {
      if (typeof ans !== "object") return false;
      return Object.values(ans).some((v: any) => String(v || "").trim() !== "");
    }
    case "hotspot": {
      const mode = (q.hotspotMode || "any").toLowerCase();
      if (mode === "all") return Array.isArray(ans) && ans.length > 0;
      return ans && typeof ans.x === "number" && typeof ans.y === "number";
    }
    case "urutkan":
    case "drag_drop":
      return Array.isArray(ans) && ans.length > 0;
    case "isian_singkat":
    case "uraian":
      return String(ans || "").trim() !== "";
    default:
      return false;
  }
}

/* ============================================================
   Komponen utama — Simulasi Ujian untuk Guru
   ============================================================ */
export default function ExamSimulatePage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pb, terminology } = useTenant();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [questions, setQuestions] = useState<SimQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [doubtful, setDoubtful] = useState<Set<string>>(new Set());
  const [showGrid, setShowGrid] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // Untuk urutkan/drag_drop: urutan tampil (acak saat load)
  const [itemsOrder, setItemsOrder] = useState<Record<string, string[]>>({});
  // Untuk klasifikasi: urutan pernyataan (acak saat load jika shuffle)
  const [klasifikasiOrder, setKlasifikasiOrder] = useState<Record<string, string[]>>({});
  // Untuk menjodohkan: opsi kanan (acak)
  const [matchingOptions, setMatchingOptions] = useState<Record<string, string[]>>({});
  const [selectedPair, setSelectedPair] = useState<string | null>(null);

  const fontSize = 1;

  /* ---- Load exam + questions ---- */
  useEffect(() => {
    if (!pb || !examId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const ex = await pb.collection("exams").getOne(examId);
        if (cancelled) return;
        setExamTitle(ex.title || "Simulasi Ujian");

        const qRecord = await pb.collection("questions").getFullList({
          filter: `examId = "${examId}"`,
          sort: "order,created",
        });
        if (cancelled) return;

        const loaded: SimQuestion[] = qRecord.map((q: any) => {
          let qImg = q.imageUrl || "";
          if (qImg && !qImg.startsWith("http") && !qImg.startsWith("data:")) {
            try { qImg = pb.files.getUrl(q, qImg); } catch (e) { /* abaikan */ }
          }
          let rawOptions: any = q.options || {};
          if (typeof rawOptions === "string") {
            try { rawOptions = JSON.parse(rawOptions); } catch (e) { rawOptions = {}; }
          }
          const mappedType = TYPE_MAP[q.field || q.type] || "pilihan_ganda";

          let choices: any = {};
          let pairs: any = undefined;
          let items: any = undefined;
          let statements: any = undefined;
          let columns: any = undefined;
          let blanks: any = undefined;
          let rumpangText = "";
          let hotspotImageUrl = "";
          let hotspotMode = "any";

          if (mappedType === "menjodohkan") {
            pairs = rawOptions.pairs || [];
          } else if (mappedType === "urutkan" || mappedType === "drag_drop") {
            items = rawOptions.items || [];
          } else if (mappedType === "benar_salah") {
            statements = rawOptions.statements || [];
            if ((!statements || statements.length === 0) && (rawOptions.a || rawOptions.b)) {
              choices = { ...rawOptions };
            }
          } else if (mappedType === "matriks") {
            statements = rawOptions.statements || [];
            columns = rawOptions.columns || [];
          } else if (mappedType === "klasifikasi") {
            statements = rawOptions.statements || [];
            columns = rawOptions.categories || [];
          } else if (mappedType === "isian_rumpang") {
            blanks = rawOptions.blanks || [];
            rumpangText = rawOptions.text || "";
          } else if (mappedType === "hotspot") {
            hotspotImageUrl = rawOptions.imageUrl || "";
            if (hotspotImageUrl && !hotspotImageUrl.startsWith("http") && !hotspotImageUrl.startsWith("data:")) {
              try { hotspotImageUrl = pb.files.getUrl(q, hotspotImageUrl); } catch (e) { /* abaikan */ }
            }
            hotspotMode = rawOptions.mode || "any";
          } else {
            choices = { ...rawOptions };
            Object.keys(choices).forEach((id) => {
              if (choices[id] && typeof choices[id] === "object" && choices[id].imageUrl && !choices[id].imageUrl.startsWith("http") && !choices[id].imageUrl.startsWith("data:")) {
                try { choices[id].imageUrl = pb.files.getUrl(q, choices[id].imageUrl); } catch (e) { /* abaikan */ }
              }
            });
          }

          return {
            id: q.id, type: mappedType, text: q.text, imageUrl: qImg,
            groupId: q.groupId || "", groupText: q.groupText || "",
            choices, pairs, items, statements, columns, blanks,
            rumpangText, hotspotImageUrl, hotspotMode,
            shuffleStatements: rawOptions.shuffleStatements !== false,
          };
        });

        setQuestions(loaded);

        // Acak urutan untuk tipe yang butuh: choices PG, items urutkan, pairs menjodohkan, statements klasifikasi
        const cOrder: Record<string, string[]> = {};
        const iOrder: Record<string, string[]> = {};
        const mOpts: Record<string, string[]> = {};
        const kOrder: Record<string, string[]> = {};
        const shuffle = <T,>(arr: T[]): T[] => {
          const a = [...arr];
          for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
          }
          return a;
        };
        loaded.forEach((q) => {
          if ((q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks") && q.choices) {
            cOrder[q.id] = shuffle(Object.keys(q.choices));
          }
          if ((q.type === "urutkan" || q.type === "drag_drop") && q.items) {
            iOrder[q.id] = shuffle(q.items.map((it: any) => it.id));
          }
          if (q.type === "menjodohkan" && q.pairs) {
            mOpts[q.id] = shuffle(q.pairs.map((p: any) => p.right));
          }
          if (q.type === "klasifikasi" && q.shuffleStatements && q.statements) {
            kOrder[q.id] = shuffle(q.statements.map((s: any) => s.id));
          }
        });
        setItemsOrder(iOrder);
        setMatchingOptions(mOpts);
        setKlasifikasiOrder(kOrder);
        // choicesOrder disimpan di ref terpisah agar tidak re-render berlebih
        choicesOrderRef.current = cOrder;
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Gagal memuat soal.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [pb, examId]);

  const choicesOrderRef = useRef<Record<string, string[]>>({});

  const setAnswer = useCallback((qid: string, val: any) => {
    setAnswers((prev) => ({ ...prev, [qid]: val }));
  }, []);

  const toggleDoubtful = useCallback((qid: string) => {
    setDoubtful((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }, []);

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= questions.length) return;
    setCurrentIndex(idx);
    setShowGrid(false);
    setSelectedPair(null);
    window.scrollTo({ top: 0 });
  }, [questions.length]);

  const handleExit = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  /* ---- Guard render ---- */
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Eye className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Akses Ditolak</h2>
            <p className="text-sm text-slate-500 mb-6">Simulasi ujian hanya untuk guru/admin yang sudah login.</p>
            <button
              onClick={() => navigate("/admin")}
              className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors"
            >
              Ke Halaman Login
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Memuat soal...</p>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-amber-400 mb-4" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              {error ? "Gagal Memuat" : "Belum Ada Soal"}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              {error || "Bank soal ini belum memiliki butir soal."}
            </p>
            <button
              onClick={handleExit}
              className="px-6 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 transition-colors"
            >
              Kembali
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter((q) => isAnswered(q, answers[q.id])).length;

  return (
    <div className="min-h-screen bg-[#f1f5f9] dark:bg-slate-950 flex flex-col">
      {/* ===== Header simulasi ===== */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 font-bold text-sm hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-colors active:scale-95"
            title="Keluar dari simulasi kapan saja"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Simulasi Guru
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
                Tidak disimpan
              </span>
            </div>
            <h1 className="font-extrabold text-slate-900 dark:text-white truncate text-base sm:text-lg leading-tight mt-0.5">
              {examTitle}
            </h1>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs font-black text-slate-700 dark:text-slate-200">
              {currentIndex + 1} / {questions.length}
            </div>
            <div className="text-[10px] font-medium text-slate-400">
              {answeredCount} dijawab
            </div>
          </div>
          <button
            onClick={() => setShowGrid(true)}
            className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition-colors"
          >
            Daftar Soal
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
            style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>
      </header>

      {/* ===== Isi soal ===== */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-4 sm:py-6">
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Kepala soal */}
          <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-2 flex items-start gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg sm:text-xl shadow-lg shadow-emerald-600/20">
              {currentIndex + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {TYPE_LABEL[currentQuestion.type] || currentQuestion.type}
                </span>
                {currentQuestion.groupId && (
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                    Grup: {currentQuestion.groupId}
                  </span>
                )}
              </div>
              {currentQuestion.groupText && (
                <div className="mb-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
                  <MathText content={currentQuestion.groupText} disableJustify={true} className="font-serif [&_p]:m-0" />
                </div>
              )}
              <div style={{ fontSize: `${16 * fontSize}px` }}>
                <MathText
                  content={currentQuestion.text}
                  disableJustify={true}
                  className="font-serif text-slate-900 dark:text-slate-100 leading-relaxed [&_p]:mb-2"
                />
              </div>
              {currentQuestion.imageUrl && currentQuestion.type !== "hotspot" && (
                <div className="mt-3">
                  <img
                    src={currentQuestion.imageUrl}
                    alt="Gambar soal"
                    className="max-w-full h-auto rounded-xl border border-slate-200 dark:border-slate-700 cursor-zoom-in"
                    style={{ maxHeight: "40vh" }}
                    onClick={() => setPreviewImage(currentQuestion.imageUrl)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Badan soal per tipe */}
          <CardContent className="px-4 sm:px-8 pb-6 pt-2">
            <QuestionBody
              q={currentQuestion}
              answers={answers}
              setAnswer={setAnswer}
              fontSize={fontSize}
              itemsOrder={itemsOrder}
              klasifikasiOrder={klasifikasiOrder}
              matchingOptions={matchingOptions}
              choicesOrder={choicesOrderRef.current}
              selectedPair={selectedPair}
              setSelectedPair={setSelectedPair}
              setPreviewImage={setPreviewImage}
            />
          </CardContent>
        </Card>

        {/* ===== Navigasi bawah ===== */}
        <div className="mt-4 flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex <= 0}
            className="flex-1 sm:flex-none sm:px-8 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:border-slate-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </button>
          <button
            onClick={() => toggleDoubtful(currentQuestion.id)}
            className={`px-4 sm:px-6 py-3.5 rounded-2xl border-2 font-bold text-sm transition-all active:scale-[0.98] flex items-center gap-2 ${
              doubtful.has(currentQuestion.id)
                ? "bg-amber-100 dark:bg-amber-950/50 border-amber-400 text-amber-700 dark:text-amber-300"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-amber-300"
            }`}
            title="Tandai ragu-ragu"
          >
            <Flag className="w-4 h-4" />
            <span className="hidden sm:inline">Ragu</span>
          </button>
          <button
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex >= questions.length - 1}
            className="flex-1 sm:flex-none sm:px-8 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg shadow-emerald-600/20"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 mt-4 mb-8">
          Mode simulasi — jawaban hanya di memori perangkat ini dan tidak disimpan ke server.
        </p>
      </main>

      {/* ===== Drawer daftar soal ===== */}
      {showGrid && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowGrid(false)} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative w-full sm:max-w-2xl max-h-[80vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-slate-900 dark:text-white">Daftar Soal</h3>
              <button
                onClick={() => setShowGrid(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-4 mb-4 text-[11px] font-bold text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" /> Dijawab</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-amber-400 inline-block" /> Ragu-ragu</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-slate-200 dark:bg-slate-700 inline-block" /> Belum</span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 overflow-y-auto pb-2">
              {questions.map((q, idx) => {
                const done = isAnswered(q, answers[q.id]);
                const isDoubt = doubtful.has(q.id);
                const isCur = idx === currentIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => goTo(idx)}
                    className={`aspect-square rounded-xl font-black text-sm transition-all active:scale-95 border-2 ${
                      isCur
                        ? "border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900"
                        : "border-transparent"
                    } ${
                      isDoubt
                        ? "bg-amber-400 text-white"
                        : done
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleExit}
              className="mt-4 w-full py-3.5 rounded-2xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Keluar dari Simulasi
            </button>
          </motion.div>
        </div>
      )}

      {/* ===== Preview gambar ===== */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="Pratinjau" className="max-w-full max-h-full rounded-xl object-contain" />
          <button
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/20 text-white flex items-center justify-center"
            onClick={() => setPreviewImage(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   QuestionBody — render 12 tipe soal (adaptasi dari CBTPage)
   ============================================================ */
function QuestionBody(props: {
  q: SimQuestion;
  answers: Record<string, any>;
  setAnswer: (qid: string, val: any) => void;
  fontSize: number;
  itemsOrder: Record<string, string[]>;
  klasifikasiOrder: Record<string, string[]>;
  matchingOptions: Record<string, string[]>;
  choicesOrder: Record<string, string[]>;
  selectedPair: string | null;
  setSelectedPair: (v: string | null) => void;
  setPreviewImage: (v: string | null) => void;
}) {
  const { q, answers, setAnswer, fontSize, setPreviewImage } = props;
  const ans = answers[q.id];

  /* ---------- Pilihan ganda & PG kompleks ---------- */
  if (q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks") {
    const order = props.choicesOrder[q.id] || Object.keys(q.choices || {});
    const isM = q.type === "pilihan_ganda_kompleks";
    return (
      <div className="space-y-1.5 sm:space-y-2">
        {isM && (
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">Pilih semua jawaban yang benar</p>
        )}
        {order.map((choiceId: string, idx: number) => {
          const c = q.choices[choiceId];
          if (!c) return null;
          const isS = isM ? (ans || []).includes(choiceId) : ans === choiceId;
          return (
            <button
              key={`${q.id}-${choiceId}`}
              onClick={() => {
                if (isM) {
                  const a = ans || [];
                  setAnswer(q.id, a.includes(choiceId) ? a.filter((i: any) => i !== choiceId) : [...a, choiceId]);
                } else {
                  setAnswer(q.id, choiceId);
                }
              }}
              className={`w-full text-left p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 flex items-start gap-2.5 sm:gap-4 outline-none group active:scale-[0.99] transition-all ${
                isS
                  ? "bg-emerald-50/80 border-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500"
                  : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-700"
              }`}
            >
              <div className={`w-7 h-7 sm:w-9 sm:h-9 shrink-0 rounded-lg sm:rounded-xl border flex items-center justify-center font-black text-xs sm:text-sm mt-0.5 ${
                isS ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800"
              }`}>
                {String.fromCharCode(65 + idx)}
              </div>
              <div className="flex-1 overflow-hidden min-w-0">
                <div style={{ fontSize: `${15 * fontSize}px` }}>
                  <MathText content={c.text} disableJustify={true}
                    className={`break-words font-serif !p-0 text-left text-inherit ${isS ? "font-bold" : "font-normal"}`} />
                </div>
                {c.imageUrl && (
                  <div className="relative inline-block cursor-zoom-in mt-3"
                    onClick={(e) => { e.stopPropagation(); setPreviewImage(c.imageUrl); }}>
                    <SmartImage src={c.imageUrl} className="max-h-[180px] rounded-xl border border-slate-100 dark:border-slate-800"
                      containerClassName="min-h-[70px] rounded-xl" alt="Choice" draggable={false} />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                    </div>
                  </div>
                )}
                {isM && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      isS ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80"
                    }`}>
                      {isS && <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </div>
                    <span className={`text-[11px] font-black uppercase tracking-wider ${isS ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400"}`}>
                      {isS ? "Jawaban Dipilih" : "Pilih Jawaban"}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  /* ---------- Benar / Salah ---------- */
  if (q.type === "benar_salah") {
    const statements = q.statements || [];
    const cur = (typeof ans === "object" && ans !== null) ? ans : {};
    if (statements.length === 0) {
      // fallback legacy
      return (
        <div className="grid grid-cols-2 gap-4">
          {Object.keys(q.choices || {}).slice(0, 2).map((choiceId) => {
            const isS = ans === choiceId;
            return (
              <button key={choiceId} onClick={() => setAnswer(q.id, choiceId)}
                className={`py-6 px-4 rounded-2xl border-2 font-black text-sm uppercase tracking-widest transition-all active:scale-95 ${
                  isS ? "bg-emerald-500 border-emerald-500 text-white shadow-lg" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
                }`}>
                {q.choices[choiceId]?.text || choiceId}
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
                <th className="py-2.5 px-3 sm:px-6 font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider text-xs">Pernyataan</th>
                <th className="w-16 sm:w-28 py-2.5 text-center font-black text-emerald-600 uppercase tracking-wider text-xs">Benar</th>
                <th className="w-16 sm:w-28 py-2.5 text-center font-black text-rose-600 uppercase tracking-wider text-xs">Salah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {statements.map((s: any, idx: number) => {
                const sel = cur[s.id];
                return (
                  <tr key={s.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-2.5 px-3 sm:px-6 align-middle">
                      <div className="flex items-start gap-2">
                        <span className="inline-flex shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold items-center justify-center mt-0.5 text-[11px]">{idx + 1}</span>
                        <div className="flex-1 min-w-0" style={{ fontSize: `${15 * fontSize}px` }}>
                          <MathText content={s.text} disableJustify={true} className="text-left font-serif leading-relaxed !p-0 [&_p]:m-0" />
                        </div>
                      </div>
                    </td>
                    {(["benar", "salah"] as const).map((v) => {
                      const isSel = sel === v;
                      const emerald = v === "benar";
                      return (
                        <td key={v} className="py-2 px-1 text-center align-middle">
                          <button type="button"
                            onClick={() => setAnswer(q.id, { ...cur, [s.id]: v })}
                            className={`inline-flex items-center justify-center p-1.5 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-2xl border-2 font-bold text-xs sm:text-sm transition-all active:scale-95 ${
                              isSel
                                ? emerald ? "bg-emerald-500 border-emerald-500 text-white shadow-md" : "bg-rose-500 border-rose-500 text-white shadow-md"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400"
                            }`}>
                            <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center sm:mr-1.5 ${
                              isSel ? "border-white bg-white" : "border-slate-300 dark:border-slate-700"
                            }`}>
                              {isSel && <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${emerald ? "bg-emerald-600" : "bg-rose-600"}`} />}
                            </span>
                            <span className="hidden sm:inline capitalize">{v}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ---------- Matriks ---------- */
  if (q.type === "matriks") {
    const statements = q.statements || [];
    const columns = q.columns || [];
    const cur = (typeof ans === "object" && ans !== null) ? ans : {};
    if (statements.length === 0 || columns.length === 0) return null;
    return (
      <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
                <th className="py-2.5 px-3 sm:px-6 font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider text-xs">Pernyataan</th>
                {columns.map((col: any) => (
                  <th key={col.id} className="min-w-[64px] sm:w-28 py-2.5 px-1 text-center font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs">{col.text}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {statements.map((s: any, idx: number) => {
                const sel = cur[s.id];
                return (
                  <tr key={s.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-2.5 px-3 sm:px-6 align-middle">
                      <div className="flex items-start gap-2">
                        <span className="inline-flex shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold items-center justify-center mt-0.5 text-[11px]">{idx + 1}</span>
                        <div className="flex-1 min-w-0" style={{ fontSize: `${15 * fontSize}px` }}>
                          <MathText content={s.text} disableJustify={true} className="text-left font-serif leading-relaxed !p-0 [&_p]:m-0" />
                        </div>
                      </div>
                    </td>
                    {columns.map((col: any) => {
                      const isSel = sel === col.id;
                      return (
                        <td key={col.id} className="py-2 px-1 text-center align-middle">
                          <button type="button"
                            onClick={() => setAnswer(q.id, { ...cur, [s.id]: col.id })}
                            title={`Pilih ${col.text}`}
                            className={`inline-flex items-center justify-center p-1.5 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-2xl border-2 font-bold text-xs transition-all active:scale-95 ${
                              isSel ? "bg-emerald-500 border-emerald-500 text-white shadow-md"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-emerald-300"
                            }`}>
                            <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center sm:mr-1.5 ${
                              isSel ? "border-white bg-white" : "border-slate-300 dark:border-slate-700"
                            }`}>
                              {isSel && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-600" />}
                            </span>
                            <span className="hidden sm:inline">{col.text}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ---------- Klasifikasi (chips) ---------- */
  if (q.type === "klasifikasi") {
    const allStatements = q.statements || [];
    const categories = q.columns || [];
    const cur = (typeof ans === "object" && ans !== null) ? ans : {};
    const orderIds = props.klasifikasiOrder[q.id];
    const statements = orderIds && orderIds.length > 0
      ? orderIds.map((id) => allStatements.find((s: any) => s.id === id)).filter(Boolean)
      : allStatements;
    if (statements.length === 0 || categories.length === 0) return null;
    return (
      <div className="space-y-3">
        {statements.map((s: any, idx: number) => {
          const selected = cur[s.id] || "";
          return (
            <div key={s.id || idx} className="p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
              <div className="flex items-start gap-3 mb-3">
                <span className="inline-flex shrink-0 w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold items-center justify-center mt-0.5 text-[11px]">{idx + 1}</span>
                <div className="flex-1 min-w-0" style={{ fontSize: `${15 * fontSize}px` }}>
                  <MathText content={s.text} disableJustify={true} className="text-left font-serif leading-relaxed !p-0 [&_p]:m-0 text-slate-800 dark:text-slate-200" />
                </div>
              </div>
              <HorizontalScrollHint className="mt-1">
                {categories.map((cat: any) => {
                  const isActive = selected === cat.id;
                  return (
                    <button key={cat.id} type="button" aria-pressed={isActive}
                      onClick={() => setAnswer(q.id, { ...cur, [s.id]: isActive ? "" : cat.id })}
                      className={isActive
                        ? "shrink-0 min-h-[44px] px-4 py-2.5 rounded-full text-base font-semibold bg-emerald-500 text-white shadow-md shadow-emerald-500/30 active:scale-95 transition-all"
                        : "shrink-0 min-h-[44px] px-4 py-2.5 rounded-full text-base font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
                      }>
                      {cat.text}
                    </button>
                  );
                })}
              </HorizontalScrollHint>
            </div>
          );
        })}
      </div>
    );
  }

  /* ---------- Isian rumpang ---------- */
  if (q.type === "isian_rumpang") {
    const text = q.rumpangText || "";
    const cur = (typeof ans === "object" && ans !== null) ? ans : {};
    if (!text) return null;
    const parts: React.ReactNode[] = [];
    const re = /\[\[(\d+)\]\]/g;
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    let keyIdx = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIdx) parts.push(<span key={`t-${keyIdx++}`}>{text.slice(lastIdx, m.index)}</span>);
      const blankId = m[1];
      const blankVal = cur[blankId] || "";
      parts.push(
        <input key={`b-${blankId}-${keyIdx++}`} type="text" value={blankVal}
          onChange={(e) => setAnswer(q.id, { ...cur, [blankId]: e.target.value })}
          placeholder={`[${blankId}]`}
          className="inline-block mx-1 px-3 py-2.5 rounded-lg border-2 border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-slate-800 dark:text-slate-200 font-medium shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all align-middle min-h-[44px]"
          style={{ minWidth: "100px", width: `${Math.max(100, (blankVal.length || 4) * 12)}px`, fontSize: "16px" }}
        />
      );
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) parts.push(<span key={`t-${keyIdx++}`}>{text.slice(lastIdx)}</span>);
    return (
      <div className="p-5 sm:p-8 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm font-serif leading-loose text-slate-800 dark:text-slate-200"
        style={{ fontSize: `${15 * fontSize}px` }}>
        {parts}
      </div>
    );
  }

  /* ---------- Hotspot ---------- */
  if (q.type === "hotspot") {
    const imgUrl = q.hotspotImageUrl || q.imageUrl || "";
    const mode = (q.hotspotMode || "any").toLowerCase();

    const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const imgEl = (e.currentTarget as HTMLDivElement).querySelector("img");
      if (!imgEl) return;
      const rect = imgEl.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const cx = Math.max(0, Math.min(100, Math.round(x * 10) / 10));
      const cy = Math.max(0, Math.min(100, Math.round(y * 10) / 10));
      if (mode === "all") {
        const pts = Array.isArray(ans) ? [...ans] : [];
        pts.push({ x: cx, y: cy });
        setAnswer(q.id, pts);
      } else {
        setAnswer(q.id, { x: cx, y: cy });
      }
    };
    const handleClear = () => setAnswer(q.id, mode === "all" ? [] : null);
    const handleRemovePoint = (idx: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (mode === "all" && Array.isArray(ans)) {
        const pts = [...ans];
        pts.splice(idx, 1);
        setAnswer(q.id, pts);
      }
    };

    if (!imgUrl) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-500 font-medium">Gambar soal tidak tersedia.</p>
        </div>
      );
    }

    const markers: Array<{ x: number; y: number }> = mode === "all"
      ? (Array.isArray(ans) ? ans.filter((p: any) => p && typeof p.x === "number" && typeof p.y === "number") : [])
      : (ans && typeof ans.x === "number" && typeof ans.y === "number" ? [ans] : []);

    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium px-1">
          {mode === "all"
            ? "Klik pada gambar untuk menandai titik (bisa beberapa titik). Klik nomor untuk menghapus."
            : "Klik pada gambar untuk menandai titik. Klik lagi untuk memindahkan."}
        </p>
        <div className="relative inline-block max-w-full rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 select-none"
          style={{ touchAction: "manipulation", cursor: "crosshair" }}
          onClick={handleImageClick}>
          <img src={imgUrl} alt="Soal hotspot" className="max-w-full h-auto block" style={{ maxHeight: "60vh" }} draggable={false} />
          {markers.map((pt, idx) => (
            <div key={idx}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-red-500 border-2 border-white shadow-lg font-bold text-white"
              style={{ left: `${pt.x}%`, top: `${pt.y}%`, width: "28px", height: "28px", fontSize: "14px", pointerEvents: mode === "all" ? "auto" : "none", cursor: mode === "all" ? "pointer" : "default" }}
              onClick={mode === "all" ? (e) => handleRemovePoint(idx, e) : undefined}
              title={mode === "all" ? "Klik untuk hapus titik ini" : `Titik (${pt.x}%, ${pt.y}%)`}>
              {mode === "all" ? idx + 1 : "•"}
            </div>
          ))}
        </div>
        {markers.length > 0 && (
          <button type="button" onClick={handleClear}
            className="px-4 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 text-sm font-bold hover:border-rose-300 hover:text-rose-500 transition-all active:scale-95">
            Hapus {mode === "all" ? "semua titik" : "titik"}
          </button>
        )}
      </div>
    );
  }

  /* ---------- Menjodohkan (klik untuk pasangkan — versi sederhana) ---------- */
  if (q.type === "menjodohkan") {
    const pairs = q.pairs || [];
    const cur = (typeof ans === "object" && ans !== null) ? ans : {};
    const options = props.matchingOptions[q.id] || pairs.map((p: any) => p.right);
    const used = Object.values(cur);
    return (
      <div className="space-y-4">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Ketuk pernyataan, lalu ketuk pasangannya</p>
        <div className="space-y-2.5">
          {pairs.map((p: any) => {
            const v = cur[p.id];
            const isSel = props.selectedPair === p.id;
            return (
              <div key={p.id} className="flex items-stretch gap-2">
                <button
                  onClick={() => props.setSelectedPair(isSel ? null : p.id)}
                  className={`flex-1 p-3 rounded-xl border-2 text-left font-serif transition-all active:scale-[0.99] ${
                    isSel ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  }`}
                  style={{ fontSize: `${15 * fontSize}px` }}
                >
                  <MathText content={p.left} disableJustify={true} className="!p-0 [&_p]:m-0" />
                </button>
                <div className="flex items-center opacity-30"><ArrowRight className="w-4 h-4" /></div>
                <button
                  onClick={() => {
                    if (v) {
                      const n = { ...cur };
                      delete n[p.id];
                      setAnswer(q.id, n);
                    } else if (props.selectedPair && props.selectedPair !== p.id) {
                      // tidak dipakai — pasangan dipilih dari panel kanan
                    }
                  }}
                  className={`flex-1 p-3 rounded-xl border-2 border-dashed flex items-center justify-center min-h-[52px] transition-all text-sm font-serif ${
                    v ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-slate-300"
                  }`}
                  title={v ? "Ketuk untuk hapus pasangan" : "Pilih dari panel kanan"}
                >
                  {v || <span className="text-[10px] font-bold uppercase">Pilih pasangan</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Pilihan jawaban</p>
          <div className="flex flex-wrap gap-2">
            {options.filter((o: string) => !used.includes(o)).map((o: string) => (
              <button key={o}
                onClick={() => {
                  if (props.selectedPair) {
                    setAnswer(q.id, { ...cur, [props.selectedPair]: o });
                    props.setSelectedPair(null);
                  }
                }}
                disabled={!props.selectedPair}
                className={`px-3 py-2 rounded-xl border-2 text-sm font-serif transition-all active:scale-95 ${
                  props.selectedPair
                    ? "bg-white dark:bg-slate-800 border-emerald-300 hover:border-emerald-500 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                    : "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 opacity-60 cursor-not-allowed"
                }`}>
                {o}
              </button>
            ))}
            {options.filter((o: string) => !used.includes(o)).length === 0 && (
              <span className="text-xs text-slate-400 italic">Semua pilihan sudah terpakai.</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Isian singkat & Uraian ---------- */
  if (q.type === "isian_singkat" || q.type === "uraian") {
    return (
      <textarea
        value={ans || ""}
        onChange={(e) => setAnswer(q.id, e.target.value)}
        placeholder={q.type === "uraian" ? "Tuliskan jawaban Anda di sini secara lengkap..." : "Tuliskan jawaban Anda..."}
        rows={q.type === "uraian" ? 8 : 3}
        className="w-full p-5 sm:p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 font-medium text-sm sm:text-base resize-y focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all outline-none text-slate-800 dark:text-slate-200"
      />
    );
  }

  /* ---------- Urutkan & Drag & Drop (pakai Reorder) ---------- */
  if (q.type === "urutkan" || q.type === "drag_drop") {
    const items = q.items || [];
    const defaultOrder = items.map((it: any) => it.id);
    const savedOrder = Array.isArray(ans) ? ans : null;
    const shuffledOrder = Array.isArray(props.itemsOrder[q.id]) ? props.itemsOrder[q.id] : null;
    const displayOrder: string[] = savedOrder || shuffledOrder || defaultOrder;
    const hasTouched = !!savedOrder;
    if (!displayOrder || displayOrder.length === 0) return null;
    return (
      <div className="space-y-3">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-emerald-500" /> Seret atau gunakan tombol untuk mengurutkan
        </p>
        <Reorder.Group axis="y" values={displayOrder} onReorder={(o: string[]) => setAnswer(q.id, o)} className="space-y-2">
          {displayOrder.map((id: string, i: number) => {
            const it = items.find((x: any) => x.id === id);
            return (
              <Reorder.Item key={id} value={id}
                className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border-2 rounded-2xl shadow-sm cursor-grab active:cursor-grabbing transition-colors ${
                  hasTouched ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40"
                    : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700"
                }`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                  hasTouched ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                }`}>{String.fromCharCode(65 + i)}</div>
                <div className="flex-1 font-serif text-slate-800 dark:text-slate-200" style={{ fontSize: `${15 * fontSize}px` }}>
                  {it?.text || ""}
                </div>
                <div className="flex flex-col gap-1">
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); if (i > 0) { const n = [...displayOrder]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setAnswer(q.id, n); } }}
                    disabled={i === 0}
                    className="w-8 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 disabled:opacity-30 active:scale-95"
                    title="Naik">▲</button>
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); if (i < displayOrder.length - 1) { const n = [...displayOrder]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setAnswer(q.id, n); } }}
                    disabled={i === displayOrder.length - 1}
                    className="w-8 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 disabled:opacity-30 active:scale-95"
                    title="Turun">▼</button>
                </div>
                <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </div>
    );
  }

  /* ---------- Fallback ---------- */
  return (
    <div className="p-6 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
      Tipe soal "{q.type}" belum didukung di mode simulasi.
    </div>
  );
}
