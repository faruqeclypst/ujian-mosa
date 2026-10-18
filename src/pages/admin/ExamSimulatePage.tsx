import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "../../components/ui/dialog";
import {
  ChevronLeft, ChevronRight, X, LogOut,
  AlertCircle, Eye, Bookmark
} from "lucide-react";
import { QuestionRenderer } from "../../components/cbt/QuestionRenderer";
import LoadingScreen from "../../components/layout/LoadingScreen";

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
    return <LoadingScreen />;
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

  /* Grid nomor soal ala CBT (dipakai sidebar desktop + dialog mobile) */
  const navGrid = (btnRounded: string) => (
    <div className="grid grid-cols-5 gap-2 sm:gap-3 content-start">
      {questions.map((q, i) => {
        const done = isAnswered(q, answers[q.id]);
        const isDoubt = doubtful.has(q.id);
        const isCur = i === currentIndex;
        return (
          <button
            key={q.id}
            onClick={() => goTo(i)}
            className={`${btnRounded} aspect-square flex items-center justify-center font-black text-xl border-2 transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${isCur
              ? "bg-emerald-700 border-emerald-700 text-white shadow-lg shadow-emerald-700/30"
              : isDoubt
                ? "bg-amber-500 border-amber-600 text-white shadow-lg shadow-amber-500/20"
                : done
                  ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20"
                  : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500"
            }`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="h-screen h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden select-none font-sans">
      {/* ===== Header ala CBT siswa (timer diganti badge, profil diganti Keluar) ===== */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl border-b border-slate-100 dark:border-slate-800 min-h-[2.85rem] sm:min-h-[4.5rem] h-auto px-2.5 sm:px-8 py-1 sm:py-0 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <span className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1 sm:py-2 rounded-xl sm:rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            Simulasi Guru
          </span>
        </div>

        <div className="flex-1 text-center min-w-0 px-2 sm:px-4">
          <p className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-xs sm:text-base leading-tight" title={examTitle}>{examTitle}</p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mt-0.5 sm:mt-1">Tidak disimpan</p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-4 ml-auto relative z-10">
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs sm:text-xs font-black uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-colors active:scale-95"
            title="Keluar dari simulasi kapan saja"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* ===== Layout 2 kolom ala CBT ===== */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Kolom soal */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-6 space-y-2.5 sm:space-y-6 text-slate-800">
          {currentQuestion && (
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
              bookmarkButton={(
                <button
                  onClick={() => toggleDoubtful(currentQuestion.id)}
                  className={`h-8 w-8 sm:h-14 sm:w-14 flex items-center justify-center rounded-xl sm:rounded-3xl transition-all active:scale-90 ${doubtful.has(currentQuestion.id) ? "bg-amber-500 text-white" : "bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700"}`}
                  title="Tandai ragu-ragu"
                >
                  <Bookmark className={`w-4 h-4 sm:w-6 sm:h-6 ${doubtful.has(currentQuestion.id) ? "fill-white" : ""}`} />
                </button>
              )}
            />
          )}
        </div>

        {/* Sidebar navigasi (desktop) ala CBT */}
        <aside className="hidden lg:flex w-[320px] bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 flex-col shadow-sm relative z-10 overflow-hidden">
          <div className="p-5 pb-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-600 rounded-full animate-pulse" />
                <h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em]">Navigasi Soal</h3>
              </div>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {answeredCount} / {questions.length}
              </span>
            </div>
            <div className="flex items-center gap-3 px-1 text-xs font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Lengkap</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Ragu</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 inline-block" /> Kosong</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-2 custom-scrollbar">
            {navGrid("rounded-xl")}
          </div>

          <div className="p-5 pt-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => goTo(currentIndex - 1)}
                className="h-16 rounded-2xl font-black uppercase tracking-widest text-[12px] border-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 active:bg-emerald-200/70 dark:active:bg-emerald-900/80 disabled:opacity-30 disabled:border-slate-200 dark:disabled:border-slate-800 disabled:text-slate-400 disabled:bg-slate-50 dark:disabled:bg-slate-900 transition-all active:scale-95 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                type="button"
                disabled={currentIndex >= questions.length - 1}
                onClick={() => goTo(currentIndex + 1)}
                className="h-16 text-white font-black uppercase tracking-widest text-[12px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:active:bg-emerald-700 active:scale-95 shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-30"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleExit}
              className="mt-3 w-full h-12 rounded-2xl font-black uppercase tracking-widest text-[11px] bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-all active:scale-95 flex items-center justify-center gap-2 focus:outline-none"
            >
              <LogOut className="w-4 h-4" />
              Keluar Simulasi
            </button>
          </div>
        </aside>
      </div>

      {/* Bottom bar mobile ala CBT */}
      <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-100 dark:border-slate-800 px-3 py-2 sm:p-6 lg:hidden flex justify-between items-center z-40 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => goTo(currentIndex - 1)}
          className="rounded-xl h-10 px-4 sm:h-14 sm:px-6 font-black uppercase text-xs sm:text-[12px] tracking-[0.15em] border-2 border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/70 active:scale-95 transition-all flex items-center gap-1 focus:outline-none disabled:opacity-30"
        >
          <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Back
        </button>
        <button
          type="button"
          className="font-black text-emerald-800 dark:text-emerald-100 uppercase tracking-[0.2em] text-[13px] sm:text-[16px] px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
          onClick={() => setShowGrid(true)}
        >
          {currentIndex + 1} / {questions.length}
        </button>
        <button
          type="button"
          disabled={currentIndex >= questions.length - 1}
          onClick={() => goTo(currentIndex + 1)}
          className="rounded-xl h-10 px-4 sm:h-14 sm:px-6 text-white font-black uppercase text-xs sm:text-[12px] tracking-[0.15em] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-90 transition-all shadow-md shadow-emerald-600/25 flex items-center gap-1 focus:outline-none disabled:opacity-30"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>

      {/* Dialog navigasi mobile ala CBT */}
      <Dialog open={showGrid} onOpenChange={setShowGrid}>
        <DialogContent className="max-w-md rounded-2xl p-8 pointer-events-auto border-none bg-white dark:bg-slate-950 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <DialogTitle className="text-xl font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tighter">Navigasi Soal</DialogTitle>
            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {answeredCount} / {questions.length}
            </span>
          </div>

          <div className="overflow-y-auto max-h-[60vh] pr-2">
            {navGrid("rounded-2xl")}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Lengkap</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Ragu</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700 inline-block" /> Kosong</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview gambar */}
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
