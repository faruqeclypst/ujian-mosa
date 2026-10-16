import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { Card, CardContent } from "../../components/ui/card";
import {
  ChevronLeft, ChevronRight, X, LogOut, CheckCircle2, Flag,
  AlertCircle, ArrowRight, GripVertical, Maximize2, Eye
} from "lucide-react";
import { QuestionRenderer } from "../../components/cbt/QuestionRenderer";

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
  type?: "pilihan_ganda" | "pilihan_ganda_kompleks" | "menjodohkan" | "benar_salah" | "isian_singkat" | "uraian" | "urutkan" | "drag_drop" | "klasifikasi" | "hotspot" | "isian_rumpang" | "matriks";
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
            id: q.id, type: mappedType as SimQuestion["type"], text: q.text, imageUrl: qImg,
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
        <QuestionRenderer
          key={currentQuestion.id}
          question={currentQuestion}
          questionNumber={currentIndex + 1}
          questions={questions}
          answer={answers[currentQuestion.id]}
          onAnswer={(v) => setAnswer(currentQuestion.id, v)}
          fontSize={fontSize}
          choicesOrder={choicesOrderRef.current[currentQuestion.id]}
          itemsOrder={itemsOrder[currentQuestion.id]}
          klasifikasiOrder={klasifikasiOrder[currentQuestion.id]}
          matchingOptions={matchingOptions[currentQuestion.id]}
          onPreviewImage={setPreviewImage}
        />

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
