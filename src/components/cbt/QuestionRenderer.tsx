import React, { useEffect, useRef, useState } from "react";
import { Reorder } from "framer-motion";
import { MathText } from "../ui/MathText";
import { SmartImage } from "../ui/smart-image";
import { Card, CardHeader, CardContent } from "../ui/card";
import {
  Maximize2,
  FileText,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  X,
  ArrowRight,
  GripVertical,
  Lock,
} from "lucide-react";


// Palet warna zona kategori untuk soal klasifikasi.
// Tiap kategori mendapat identitas warna konsisten di semua pernyataan.
const KLASIFIKASI_COLORS = [
  {
    activeBg: "bg-emerald-500", activeShadow: "shadow-emerald-500/30",
    softBg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-300 dark:border-emerald-700", dot: "bg-emerald-500", bar: "border-l-emerald-500",
  },
  {
    activeBg: "bg-sky-500", activeShadow: "shadow-sky-500/30",
    softBg: "bg-sky-50 dark:bg-sky-950/40", text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-300 dark:border-sky-700", dot: "bg-sky-500", bar: "border-l-sky-500",
  },
  {
    activeBg: "bg-amber-500", activeShadow: "shadow-amber-500/30",
    softBg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-700", dot: "bg-amber-500", bar: "border-l-amber-500",
  },
  {
    activeBg: "bg-violet-500", activeShadow: "shadow-violet-500/30",
    softBg: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-300 dark:border-violet-700", dot: "bg-violet-500", bar: "border-l-violet-500",
  },
  {
    activeBg: "bg-rose-500", activeShadow: "shadow-rose-500/30",
    softBg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-300 dark:border-rose-700", dot: "bg-rose-500", bar: "border-l-rose-500",
  },
  {
    activeBg: "bg-cyan-500", activeShadow: "shadow-cyan-500/30",
    softBg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-300 dark:border-cyan-700", dot: "bg-cyan-500", bar: "border-l-cyan-500",
  },
  {
    activeBg: "bg-orange-500", activeShadow: "shadow-orange-500/30",
    softBg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-300 dark:border-orange-700", dot: "bg-orange-500", bar: "border-l-orange-500",
  },
  {
    activeBg: "bg-fuchsia-500", activeShadow: "shadow-fuchsia-500/30",
    softBg: "bg-fuchsia-50 dark:bg-fuchsia-950/40", text: "text-fuchsia-700 dark:text-fuchsia-300",
    border: "border-fuchsia-300 dark:border-fuchsia-700", dot: "bg-fuchsia-500", bar: "border-l-fuchsia-500",
  },
];


// Wrapper scroll horizontal dengan indikator "geser" untuk mobile.
// Menampilkan gradient fade di kanan + hint teks "← geser →" yang hilang
// otomatis setelah user scroll atau jika konten ternyata muat.
// Props scrollClassName/contentClassName opsional untuk konten non-flex
// (mis. <table> yang tidak boleh jadi flex item).
const HorizontalScrollHint = ({ children, className = "", scrollClassName, contentClassName }: {
  children: React.ReactNode;
  className?: string;
  scrollClassName?: string;
  contentClassName?: string;
}) => {
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
    // Cek ulang setelah layout stabil (font/gambar) + saat resize/rotasi
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
        className={scrollClassName ?? "overflow-x-auto pb-3"}
        style={{ scrollbarWidth: "thin" }}
      >
        <div className={contentClassName ?? "flex gap-2 w-max min-w-full pr-10"}>
          {children}
        </div>
      </div>
      {canScroll && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white dark:from-slate-900 to-transparent" />
      )}
      {canScroll && showHint && (
        <div className="pointer-events-none absolute bottom-0 right-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 animate-pulse select-none">
          {"\u2190"} geser {"\u2192"}
        </div>
      )}
    </div>
  );
};

// Badan soal klasifikasi — alur 3 langkah yang jelas:
// 1. Ketuk kartu pernyataan → 2. Pilih kategori → 3. Kartu masuk zona kategori.
// Komponen terpisah agar boleh pakai state lokal (pernyataan terpilih).
function KlasifikasiBody({
  question,
  answer,
  onAnswer,
  fontSize = 1,
  klasifikasiOrder,
}: {
  question: SharedQuestion;
  answer: any;
  onAnswer: (value: any) => void;
  fontSize?: number;
  klasifikasiOrder?: string[];
}) {
  const allStatements = question.statements || [];
  const categories = question.columns || [];
  const currentAnswers: Record<string, string> =
    typeof answer === "object" && answer !== null ? answer : {};

  // Hormati urutan acak jika ada
  const orderIds = klasifikasiOrder;
  const statements = orderIds && orderIds.length > 0
    ? orderIds.map((id) => allStatements.find((s: any) => s.id === id)).filter(Boolean)
    : allStatements;

  // Pernyataan yang sedang dipilih — menunggu user memilih kategori
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (statements.length === 0 || categories.length === 0) return null;

  const catColor = (ci: number) => KLASIFIKASI_COLORS[ci % KLASIFIKASI_COLORS.length];
  const answered = (s: any) => !!currentAnswers[s.id];
  const unanswered = statements.filter((s: any) => !answered(s));
  const selStmt = selectedId ? statements.find((s: any) => s.id === selectedId) ?? null : null;
  const stmtNo = (s: any) => statements.findIndex((x: any) => x.id === s.id) + 1;

  const assign = (statementId: string, catId: string) => {
    const next = { ...currentAnswers, [statementId]: catId };
    onAnswer(next);
    // Lanjut otomatis ke pernyataan berikutnya yang belum dikelompokkan
    const nextUn = statements.find((s: any) => s.id !== statementId && !next[s.id]);
    setSelectedId(nextUn ? nextUn.id : null);
  };

  const unassign = (statementId: string) => {
    const next = { ...currentAnswers, [statementId]: "" };
    onAnswer(next);
    // Langsung buka picker agar bisa pilih ulang
    setSelectedId(statementId);
  };

  const labelSize = Math.max(9, Math.round(10 * fontSize));

  return (
    <div className="space-y-5">
      {/* Panduan 3 langkah */}
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/30 px-4 py-3">
        <p
          className="font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wider"
          style={{ fontSize: `${Math.max(11, Math.round(12 * fontSize))}px` }}
        >
          Cara menjawab
        </p>
        <ol
          className="mt-1.5 space-y-1 text-emerald-700 dark:text-emerald-300 font-medium"
          style={{ fontSize: `${Math.max(11, Math.round(12.5 * fontSize))}px` }}
        >
          <li><span className="font-black">1.</span> Ketuk kartu pernyataan di bawah</li>
          <li><span className="font-black">2.</span> Pilih kategorinya</li>
          <li><span className="font-black">3.</span> Ketuk <span className="font-black">×</span> di zona untuk mengubah pilihan</li>
        </ol>
      </div>

      {/* Pernyataan yang belum dikelompokkan */}
      {unanswered.length > 0 ? (
        <div>
          <p
            className="mb-2 font-black uppercase tracking-widest text-slate-400 dark:text-slate-500"
            style={{ fontSize: `${labelSize}px` }}
          >
            Belum dikelompokkan · {unanswered.length}
          </p>
          <div className="space-y-3">
            {unanswered.map((s: any) => {
              const isSel = !!selStmt && selStmt.id === s.id;
              return (
                <div
                  key={s.id}
                  className={`rounded-2xl border-2 bg-white dark:bg-slate-900/90 shadow-sm transition-all overflow-hidden ${
                    isSel
                      ? "border-emerald-500 ring-2 ring-emerald-500/30"
                      : "border-dashed border-slate-300 dark:border-slate-700"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(isSel ? null : s.id)}
                    aria-expanded={isSel}
                    className="w-full text-left flex items-start gap-3 p-4 min-h-[56px]"
                  >
                    <span
                      className={`inline-flex shrink-0 w-7 h-7 rounded-lg font-bold items-center justify-center mt-0.5 ${
                        isSel
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                      style={{ fontSize: `${Math.max(11, Math.round(12 * fontSize))}px` }}
                    >
                      {stmtNo(s)}
                    </span>
                    <div
                      className="flex-1 min-w-0 font-serif text-slate-800 dark:text-slate-200"
                      style={{ fontSize: `${15 * fontSize}px` }}
                    >
                      <MathText
                        content={s.text}
                        disableJustify={true}
                        className="cbt-choice-text text-left font-serif leading-relaxed !p-0 [&_p]:m-0"
                      />
                    </div>
                    <span
                      className={`shrink-0 mt-1 text-emerald-600 dark:text-emerald-400 transition-transform ${isSel ? "rotate-90" : ""}`}
                      aria-hidden="true"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  </button>
                  {isSel && (
                    <div className="px-4 pb-4">
                      <div className="pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                        <p
                          className="mb-2 font-bold text-slate-600 dark:text-slate-300"
                          style={{ fontSize: `${Math.max(11, Math.round(13 * fontSize))}px` }}
                        >
                          Kelompokkan pernyataan {stmtNo(s)} ke:
                        </p>
                        <div className="grid gap-2">
                          {categories.map((cat: any, ci: number) => {
                            const c = catColor(ci);
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => assign(s.id, cat.id)}
                                className={`w-full min-h-[52px] px-4 py-3 rounded-xl border-2 font-bold text-left flex items-center gap-3 transition-all active:scale-[0.98] ${c.softBg} ${c.border} ${c.text}`}
                                style={{ fontSize: `${Math.max(13, Math.round(14 * fontSize))}px` }}
                              >
                                <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${c.dot}`} />
                                <span className="flex-1">{cat.text}</span>
                                <ArrowRight className="w-4 h-4 opacity-60 shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3.5 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <p
            className="font-bold text-emerald-700 dark:text-emerald-300"
            style={{ fontSize: `${Math.max(12, Math.round(13 * fontSize))}px` }}
          >
            Semua pernyataan sudah dikelompokkan. Ketuk × di zona untuk mengubah.
          </p>
        </div>
      )}

      {/* Zona kategori — pernyataan yang sudah masuk */}
      <div>
        <p
          className="mb-2 font-black uppercase tracking-widest text-slate-400 dark:text-slate-500"
          style={{ fontSize: `${labelSize}px` }}
        >
          Zona kategori
        </p>
        <div className="space-y-3">
          {categories.map((cat: any, ci: number) => {
            const c = catColor(ci);
            const members = statements.filter((s: any) => currentAnswers[s.id] === cat.id);
            return (
              <div key={cat.id} className={`rounded-2xl border-2 ${c.border} ${c.softBg} p-3`}>
                <div className="flex items-center gap-2 px-1 pb-2">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${c.dot}`} />
                  <span
                    className={`font-black ${c.text}`}
                    style={{ fontSize: `${Math.max(12, Math.round(13.5 * fontSize))}px` }}
                  >
                    {cat.text}
                  </span>
                  <span
                    className="ml-auto inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-white/70 dark:bg-slate-900/60 font-black text-slate-500 dark:text-slate-400"
                    style={{ fontSize: `${Math.max(10, Math.round(11 * fontSize))}px` }}
                  >
                    {members.length}
                  </span>
                </div>
                {members.length > 0 ? (
                  <div className="space-y-2">
                    {members.map((s: any) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 pl-3 pr-1.5 py-1.5"
                      >
                        <span
                          className="inline-flex shrink-0 w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold items-center justify-center"
                          style={{ fontSize: `${Math.max(10, Math.round(11 * fontSize))}px` }}
                        >
                          {stmtNo(s)}
                        </span>
                        <div
                          className="flex-1 min-w-0 font-serif text-slate-700 dark:text-slate-200"
                          style={{ fontSize: `${Math.max(12, Math.round(13.5 * fontSize))}px` }}
                        >
                          <MathText
                            content={s.text}
                            disableJustify={true}
                            className="cbt-choice-text text-left font-serif leading-snug !p-0 [&_p]:m-0"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => unassign(s.id)}
                          aria-label={`Ubah kategori pernyataan ${stmtNo(s)}`}
                          title="Ubah kategori"
                          className="shrink-0 w-9 h-9 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p
                    className="px-1 pb-1 italic text-slate-400 dark:text-slate-500"
                    style={{ fontSize: `${Math.max(11, Math.round(12 * fontSize))}px` }}
                  >
                    Belum ada pernyataan di sini
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export interface SharedQuestion {
  id: string;
  type?: "pilihan_ganda" | "pilihan_ganda_kompleks" | "menjodohkan" | "benar_salah" | "isian_singkat" | "uraian" | "urutkan" | "drag_drop" | "klasifikasi" | "hotspot" | "isian_rumpang" | "matriks";
  text: string;
  imageUrl?: string;
  groupId?: string;
  groupText?: string;
  choices?: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }>;
  pairs?: Array<{ id: string; left: string; right: string }>;
  items?: Array<{ id: string; text: string; imageUrl?: string }>;
  statements?: Array<{ id: string; text: string; answer?: string }>;
  columns?: Array<{ id: string; text: string }>;
  blanks?: Array<{ id: string; caseSensitive?: boolean }>;
  rumpangText?: string;
  hotspotImageUrl?: string;
  hotspotMode?: string;
  shuffleStatements?: boolean;
}

export interface QuestionStatusInfo {
  isComplete: boolean;
  isPartiallyAnswered: boolean;
  isUnanswered: boolean;
  typeLabel: string;
  missingDetail: string;
  summaryText: string;
}

export const getQuestionStatus = (q: SharedQuestion, ans: any): QuestionStatusInfo => {
  const type = q.type || "pilihan_ganda";

  // 1. BENAR_SALAH
  if (type === "benar_salah") {
    const statements = q.statements || [];
    if (statements.length > 0) {
      const currentAns = (typeof ans === "object" && ans !== null && !Array.isArray(ans)) ? ans : {};
      const answeredStatements = statements.filter(
        s => currentAns[s.id] !== undefined && currentAns[s.id] !== ""
      );
      const unpickedStatements = statements
        .map((s, idx) => ({ index: idx + 1, id: s.id, isFilled: currentAns[s.id] !== undefined && currentAns[s.id] !== "" }))
        .filter(s => !s.isFilled);

      if (answeredStatements.length === statements.length) {
        return {
          isComplete: true,
          isPartiallyAnswered: false,
          isUnanswered: false,
          typeLabel: "Benar / Salah",
          missingDetail: "",
          summaryText: `Lengkap (${statements.length}/${statements.length} pernyataan)`
        };
      } else if (answeredStatements.length === 0) {
        return {
          isComplete: false,
          isPartiallyAnswered: false,
          isUnanswered: true,
          typeLabel: "Benar / Salah",
          missingDetail: `Belum dijawab (${statements.length} pernyataan)`,
          summaryText: "Belum dijawab"
        };
      } else {
        const unpickedList = unpickedStatements.map(s => `No. ${s.index}`).join(", ");
        return {
          isComplete: false,
          isPartiallyAnswered: true,
          isUnanswered: false,
          typeLabel: "Benar / Salah",
          missingDetail: `Baru ${answeredStatements.length}/${statements.length} pernyataan dipilih (${unpickedList} belum diisi)`,
          summaryText: `Belum lengkap (${answeredStatements.length}/${statements.length})`
        };
      }
    } else {
      const isFilled = typeof ans === "string" ? ans.trim().length > 0 : (ans !== undefined && ans !== null);
      return {
        isComplete: isFilled,
        isPartiallyAnswered: false,
        isUnanswered: !isFilled,
        typeLabel: "Benar / Salah",
        missingDetail: isFilled ? "" : "Pilihan belum dijawab",
        summaryText: isFilled ? "Terjawab" : "Belum dijawab"
      };
    }
  }

  // 2. PILIHAN_GANDA_KOMPLEKS
  if (type === "pilihan_ganda_kompleks") {
    const selected = Array.isArray(ans) ? ans : (typeof ans === "string" && ans.trim() ? [ans] : []);

    if (selected.length === 0) {
      return {
        isComplete: false,
        isPartiallyAnswered: false,
        isUnanswered: true,
        typeLabel: "PG Kompleks",
        missingDetail: "Belum ada opsi yang dipilih",
        summaryText: "Belum dijawab"
      };
    } else {
      return {
        isComplete: true,
        isPartiallyAnswered: false,
        isUnanswered: false,
        typeLabel: "PG Kompleks",
        missingDetail: "",
        summaryText: `${selected.length} opsi dipilih`
      };
    }
  }

  // 3. MENJODOHKAN
  if (type === "menjodohkan") {
    const pairs = q.pairs || [];
    if (pairs.length > 0) {
      const currentAns = (typeof ans === "object" && ans !== null && !Array.isArray(ans)) ? ans : {};
      const answeredPairs = pairs.filter(p => currentAns[p.id] !== undefined && currentAns[p.id] !== "");
      if (answeredPairs.length === pairs.length) {
        return {
          isComplete: true,
          isPartiallyAnswered: false,
          isUnanswered: false,
          typeLabel: "Menjodohkan",
          missingDetail: "",
          summaryText: "Semua pasangan lengkap"
        };
      } else if (answeredPairs.length === 0) {
        return {
          isComplete: false,
          isPartiallyAnswered: false,
          isUnanswered: true,
          typeLabel: "Menjodohkan",
          missingDetail: `Belum ada pasangan yang dijodohkan (total ${pairs.length} baris)`,
          summaryText: "Belum dijawab"
        };
      } else {
        return {
          isComplete: false,
          isPartiallyAnswered: true,
          isUnanswered: false,
          typeLabel: "Menjodohkan",
          missingDetail: `Baru ${answeredPairs.length}/${pairs.length} pasangan dijodohkan`,
          summaryText: `Belum lengkap (${answeredPairs.length}/${pairs.length})`
        };
      }
    }
  }

  // 4. URUTKAN / DRAG_DROP
  if (type === "urutkan" || type === "drag_drop") {
    const items = q.items || [];
    const currentOrder = Array.isArray(ans) ? ans : [];
    if (items.length > 0) {
      if (currentOrder.length === 0) {
        return {
          isComplete: false,
          isPartiallyAnswered: false,
          isUnanswered: true,
          typeLabel: "Urutkan",
          missingDetail: "Belum diurutkan",
          summaryText: "Belum dijawab"
        };
      } else if (currentOrder.length < items.length) {
        return {
          isComplete: false,
          isPartiallyAnswered: true,
          isUnanswered: false,
          typeLabel: "Urutkan",
          missingDetail: `Baru ${currentOrder.length}/${items.length} item diurutkan`,
          summaryText: `Belum lengkap (${currentOrder.length}/${items.length})`
        };
      } else {
        return {
          isComplete: true,
          isPartiallyAnswered: false,
          isUnanswered: false,
          typeLabel: "Urutkan",
          missingDetail: "",
          summaryText: "Semua item diurutkan"
        };
      }
    }
  }

  // 5. MATRIKS
  if (type === "matriks") {
    const statements = q.statements || [];
    if (statements.length > 0) {
      const currentAns = (typeof ans === "object" && ans !== null && !Array.isArray(ans)) ? ans : {};
      const answeredStatements = statements.filter(
        s => currentAns[s.id] !== undefined && currentAns[s.id] !== ""
      );
      const unpickedStatements = statements
        .map((s, idx) => ({ index: idx + 1, id: s.id, isFilled: currentAns[s.id] !== undefined && currentAns[s.id] !== "" }))
        .filter(s => !s.isFilled);

      if (answeredStatements.length === statements.length) {
        return {
          isComplete: true,
          isPartiallyAnswered: false,
          isUnanswered: false,
          typeLabel: "Matriks",
          missingDetail: "",
          summaryText: `Lengkap (${statements.length}/${statements.length} pernyataan)`
        };
      } else if (answeredStatements.length === 0) {
        return {
          isComplete: false,
          isPartiallyAnswered: false,
          isUnanswered: true,
          typeLabel: "Matriks",
          missingDetail: `Belum dijawab (${statements.length} pernyataan)`,
          summaryText: "Belum dijawab"
        };
      } else {
        const unpickedList = unpickedStatements.map(s => `No. ${s.index}`).join(", ");
        return {
          isComplete: false,
          isPartiallyAnswered: true,
          isUnanswered: false,
          typeLabel: "Matriks",
          missingDetail: `Baru ${answeredStatements.length}/${statements.length} pernyataan dipilih (${unpickedList} belum diisi)`,
          summaryText: `Belum lengkap (${answeredStatements.length}/${statements.length})`
        };
      }
    }
  }

  // 6. KLASIFIKASI
  if (type === "klasifikasi") {
    const statements = q.statements || [];
    if (statements.length > 0) {
      const currentAns = (typeof ans === "object" && ans !== null && !Array.isArray(ans)) ? ans : {};
      const answeredStatements = statements.filter(
        s => currentAns[s.id] !== undefined && currentAns[s.id] !== ""
      );

      if (answeredStatements.length === statements.length) {
        return {
          isComplete: true,
          isPartiallyAnswered: false,
          isUnanswered: false,
          typeLabel: "Klasifikasi",
          missingDetail: "",
          summaryText: `Lengkap (${statements.length}/${statements.length} pernyataan)`
        };
      } else if (answeredStatements.length === 0) {
        return {
          isComplete: false,
          isPartiallyAnswered: false,
          isUnanswered: true,
          typeLabel: "Klasifikasi",
          missingDetail: `Belum dijawab (${statements.length} pernyataan)`,
          summaryText: "Belum dijawab"
        };
      } else {
        return {
          isComplete: false,
          isPartiallyAnswered: true,
          isUnanswered: false,
          typeLabel: "Klasifikasi",
          missingDetail: `Baru ${answeredStatements.length}/${statements.length} pernyataan diklasifikasikan`,
          summaryText: `Belum lengkap (${answeredStatements.length}/${statements.length})`
        };
      }
    }
  }

  // 7. ISIAN_RUMPANG
  if (type === "isian_rumpang") {
    const blanks = q.blanks || [];
    if (blanks.length > 0) {
      const currentAns = (typeof ans === "object" && ans !== null && !Array.isArray(ans)) ? ans : {};
      const filledBlanks = blanks.filter(b => {
        const v = currentAns[b.id];
        return typeof v === "string" && v.trim().length > 0;
      });

      if (filledBlanks.length === blanks.length) {
        return {
          isComplete: true,
          isPartiallyAnswered: false,
          isUnanswered: false,
          typeLabel: "Isian Rumpang",
          missingDetail: "",
          summaryText: `Lengkap (${blanks.length}/${blanks.length} rumpang)`
        };
      } else if (filledBlanks.length === 0) {
        return {
          isComplete: false,
          isPartiallyAnswered: false,
          isUnanswered: true,
          typeLabel: "Isian Rumpang",
          missingDetail: `Belum dijawab (${blanks.length} rumpang)`,
          summaryText: "Belum dijawab"
        };
      } else {
        return {
          isComplete: false,
          isPartiallyAnswered: true,
          isUnanswered: false,
          typeLabel: "Isian Rumpang",
          missingDetail: `Baru ${filledBlanks.length}/${blanks.length} rumpang diisi`,
          summaryText: `Belum lengkap (${filledBlanks.length}/${blanks.length})`
        };
      }
    }
  }

  // 8. HOTSPOT
  if (type === "hotspot") {
    const mode = (q.hotspotMode || "any").toLowerCase();
    if (mode === "all") {
      const pts = Array.isArray(ans) ? ans : [];
      const validPts = pts.filter(p => p && typeof p.x === "number" && typeof p.y === "number");
      if (validPts.length === 0) {
        return {
          isComplete: false,
          isPartiallyAnswered: false,
          isUnanswered: true,
          typeLabel: "Hotspot",
          missingDetail: "Belum ada titik yang ditandai",
          summaryText: "Belum dijawab"
        };
      } else {
        return {
          isComplete: true,
          isPartiallyAnswered: false,
          isUnanswered: false,
          typeLabel: "Hotspot",
          missingDetail: "",
          summaryText: `${validPts.length} titik ditandai`
        };
      }
    } else {
      const isFilled = ans !== null && typeof ans === "object" && !Array.isArray(ans) &&
        typeof ans.x === "number" && typeof ans.y === "number";
      return {
        isComplete: isFilled,
        isPartiallyAnswered: false,
        isUnanswered: !isFilled,
        typeLabel: "Hotspot",
        missingDetail: isFilled ? "" : "Belum klik pada gambar",
        summaryText: isFilled ? "Titik ditandai" : "Belum dijawab"
      };
    }
  }

  // 9. ISIAN_SINGKAT / URAIAN
  if (type === "isian_singkat" || type === "uraian") {
    const isFilled = typeof ans === "string" && ans.trim().length > 0;
    return {
      isComplete: isFilled,
      isPartiallyAnswered: false,
      isUnanswered: !isFilled,
      typeLabel: type === "uraian" ? "Uraian" : "Isian Singkat",
      missingDetail: isFilled ? "" : "Jawaban teks masih kosong",
      summaryText: isFilled ? "Terjawab" : "Belum dijawab"
    };
  }

  // 6. PILIHAN_GANDA BIASA
  const isFilled = typeof ans === "string" ? ans.trim().length > 0 : (ans !== undefined && ans !== null);
  return {
    isComplete: isFilled,
    isPartiallyAnswered: false,
    isUnanswered: !isFilled,
    typeLabel: "Pilihan Ganda",
    missingDetail: isFilled ? "" : "Belum memilih jawaban",
    summaryText: isFilled ? "Terjawab" : "Belum dijawab"
  };
};

export interface EssayLockInfo {
  locked: boolean;
  remaining: number;
}

export interface QuestionRendererProps {
  question: SharedQuestion;
  /** nomor soal tampil (1-based) */
  questionNumber: number;
  /** daftar semua soal — dipakai untuk lookup stimulus/bacaan via groupId */
  questions?: SharedQuestion[];
  /** jawaban saat ini untuk soal ini */
  answer: any;
  /** dipanggil dengan nilai jawaban baru */
  onAnswer: (value: any) => void;
  /** pengali ukuran font, default 1 */
  fontSize?: number;
  /** urutan acak pilihan PG untuk soal ini */
  choicesOrder?: string[];
  /** urutan tampil items untuk urutkan/drag_drop */
  itemsOrder?: string[];
  /** urutan acak pernyataan untuk klasifikasi */
  klasifikasiOrder?: string[];
  /** opsi acak untuk menjodohkan */
  matchingOptions?: string[];
  /** tombol bookmark di header (opsional, untuk CBT siswa) */
  bookmarkButton?: React.ReactNode;
  /** kunci uraian/isian saat objektif belum selesai (opsional) */
  essayLock?: EssayLockInfo | null;
  /** callback preview gambar */
  onPreviewImage?: (url: string) => void;
}

/**
 * QuestionRenderer — kartu soal lengkap (header + badan jawaban) yang IDENTIK
 * antara CBT siswa dan mode simulasi guru. Satu-satunya sumber kebenaran
 * tampilan soal.
 */
export const QuestionRenderer = (props: QuestionRendererProps) => {
  const {
    question,
    questionNumber,
    questions = [],
    answer,
    onAnswer,
    fontSize = 1,
    choicesOrder,
    itemsOrder,
    klasifikasiOrder,
    matchingOptions,
    bookmarkButton,
    essayLock,
    onPreviewImage,
  } = props;

  // State drag-and-drop untuk menjodohkan (transient, per soal)
  const [draggingOption, setDraggingOption] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  return (
      <Card className="rounded-[20px] sm:rounded-[35px] border border-slate-100 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition-all duration-300">
        <CardHeader className="p-3.5 sm:p-8 pb-0 sm:pb-2">
          <div className="relative flex items-center justify-between gap-3 mb-2.5 sm:mb-6 min-h-[38px] sm:min-h-[56px]">
            <div className="flex items-center gap-2.5 sm:gap-4">
              <div className="w-8 h-8 sm:w-14 sm:h-14 bg-emerald-600 text-white rounded-xl sm:rounded-[35%] flex items-center justify-center font-black text-sm sm:text-2xl shrink-0">{questionNumber}</div>
              <div className="flex flex-col">
                <span className="text-[8px] sm:text-[10px] font-black text-emerald-400 tracking-[0.2em] uppercase">Pertanyaan</span>
                <span className="text-xs sm:text-xl font-black text-emerald-800 dark:text-white uppercase tracking-tight leading-tight">Soal Nomor {questionNumber}</span>
              </div>
            </div>

            {bookmarkButton}
          </div>

          {question.imageUrl && (
            <div className="relative group cursor-zoom-in select-none" onClick={() => onPreviewImage?.(question.imageUrl!)}>
              <SmartImage
                src={question.imageUrl}
                className="max-w-full h-auto mx-auto block rounded-2xl border border-slate-100 dark:border-slate-800 mb-3 sm:mb-6 transition-transform hover:scale-[1.01] select-none"
                containerClassName="min-h-[100px] rounded-2xl"
                alt="Soal"
                draggable={false}
                style={{ userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties}
              />
              <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center pointer-events-none">
                <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </div>
          )}
          {question.groupId && (() => {
            const f = questions.find(x => x.groupId === question.groupId);
            if (f && (f.groupText || f.text)) return (
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 sm:p-8 rounded-2xl sm:rounded-[30px] border border-slate-200 dark:border-slate-800 mb-4 sm:mb-14 space-y-2.5 sm:space-y-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                  <FileText className="w-10 h-10 sm:w-20 sm:h-20 text-emerald-800" />
                </div>

                <div className="flex items-center gap-2.5 mb-2.5 sm:mb-4 relative z-10">
                  <div className="h-4 sm:h-6 w-1 sm:w-1.5 rounded-full bg-emerald-600"></div>
                  <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500 dark:text-emerald-400">Bacaan</span>
                </div>

                <div style={{ fontSize: `${15 * fontSize}px` }}>
                  <MathText
                    content={f.groupText || f.text}
                    className={`leading-relaxed text-slate-800 dark:text-slate-200 font-serif ql-editor !p-0 selection:bg-emerald-100 dark:selection:bg-emerald-900/40`}
                  />
                </div>

                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-end opacity-50 dark:opacity-100">
                  <span className="text-[8px] sm:text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest italic">Bacalah teks dengan seksama sebelum memberikan jawaban.</span>
                </div>
              </div>
            );
          })()}

          <div className="h-1.5 sm:h-4" />

          <div style={{ fontSize: `${16 * fontSize}px` }}>
            <MathText
              content={question.text}
              className={`ql-editor !p-0 font-serif text-slate-800 dark:text-slate-200 leading-relaxed break-words [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_b]:text-slate-900 dark:[&_b]:text-white [&_p]:mb-2.5 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 selection:bg-emerald-100 dark:selection:bg-emerald-900/40`}
            />
          </div>

          {(() => {
            const t = question.type;
            if (t === "pilihan_ganda_kompleks" || t === "benar_salah" || t === "menjodohkan" || t === "urutkan") {
              const status = getQuestionStatus(question, answer);
              const instruction = t === "pilihan_ganda_kompleks"
                ? "Pilih semua jawaban yang benar"
                : t === "benar_salah"
                  ? "Pilih Benar atau Salah untuk tiap baris pernyataan"
                  : t === "menjodohkan"
                    ? "Pasangkan pernyataan di bawah ini"
                    : "Urutkan pernyataan dengan benar";

              return (
                <div className="flex flex-wrap items-center gap-2 my-2.5 sm:mb-6 px-3 sm:px-4 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
                    <span className="text-[9px] sm:text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {instruction}
                    </span>
                  </div>
                  {status.isPartiallyAnswered && (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 sm:ml-auto">
                      <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                      {status.missingDetail}
                    </span>
                  )}
                  {status.isComplete && (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 sm:ml-auto">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      {status.summaryText}
                    </span>
                  )}
                </div>
              );
            }
            return null;
          })()}
          <div className="h-1 sm:h-2" />
        </CardHeader>
        <CardContent className="px-3.5 sm:px-8 pb-4 sm:pb-8 space-y-2 sm:space-y-3">
          {(question.type === "pilihan_ganda" || question.type === "pilihan_ganda_kompleks") && (
            <div className="space-y-1.5 sm:space-y-2">
              {(choicesOrder || Object.keys(question.choices || {})).map((choiceId, idx) => {
                const c = question.choices![choiceId];
                const isM = question.type === "pilihan_ganda_kompleks";
                const isS = isM ? (answer || []).includes(choiceId) : answer === choiceId;
                return (
                  <button
                    key={`${question.id}-${choiceId}`}
                    onClick={() => {
                      if (isM) {
                        const a = answer || [];
                        onAnswer( a.includes(choiceId) ? a.filter((i: any) => i !== choiceId) : [...a, choiceId]);
                      } else {
                        onAnswer( choiceId);
                      }
                    }}
                    className={`w-full text-left p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 flex items-start gap-2.5 sm:gap-4 outline-none group active:scale-[0.99] transition-all ${
                      isS
                        ? "bg-emerald-50/80 border-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500"
                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-700"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 sm:w-9 sm:h-9 shrink-0 rounded-lg sm:rounded-xl border flex items-center justify-center font-black text-xs sm:text-sm mt-0.5 ${
                        isS
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800 group-hover:bg-emerald-50 group-hover:text-emerald-900"
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <div className="flex-1 overflow-hidden min-w-0">
                      <div style={{ fontSize: `${15 * fontSize}px` }}>
                        <MathText
                          content={c.text}
                          disableJustify={true}
                          className={`break-words font-serif ql-editor !p-0 cbt-choice-text text-left [&_p:not([dir="rtl"]):not(.arabic-text)]:!text-left [&_span:not([dir="rtl"]):not(.arabic-text)]:!text-left [&_div:not([dir="rtl"]):not(.arabic-text)]:!text-left [&_img]:max-w-[300px] [&_img]:h-auto [&_img]:rounded-xl [&_img]:mt-2 text-inherit ${
                            isS ? "font-bold" : "font-normal"
                          }`}
                        />
                      </div>
                      {c.imageUrl && (
                        <div
                          className="relative inline-block cursor-zoom-in group mt-3 select-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPreviewImage?.(c.imageUrl!);
                          }}
                        >
                          <SmartImage
                            src={c.imageUrl}
                            className="max-h-[180px] sm:max-h-[200px] rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800 group-hover:brightness-90 transition-all select-none"
                            containerClassName="min-h-[70px] rounded-xl sm:rounded-2xl"
                            alt="Choice"
                            draggable={false}
                            style={{ userSelect: "none", WebkitUserDrag: "none" } as React.CSSProperties}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                          </div>
                        </div>
                      )}

                      {/* Checklist Pilihan Ganda Kompleks: Dipindah ke Bawah Pilihan */}
                      {isM && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                          <div
                            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg border-2 flex items-center justify-center transition-all ${
                              isS
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80"
                            }`}
                          >
                            {isS && <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />}
                          </div>
                          <span
                            className={`text-[11px] sm:text-xs font-black uppercase tracking-wider transition-colors ${
                              isS ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            {isS ? "Jawaban Dipilih" : "Pilih Jawaban"}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {question.type === "benar_salah" && (
            (() => {
              const statements = question.statements || [];
              const currentAnswers = (typeof answer === "object" && answer !== null)
                ? answer
                : {};

              if (statements.length > 0) {
                return (
                  <div className="overflow-hidden rounded-xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
                            <th
                              className="py-2.5 px-3 sm:py-4 sm:px-6 font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                              style={{ fontSize: `${Math.max(11, Math.round(13 * fontSize))}px` }}
                            >
                              Pernyataan
                            </th>
                            <th
                              className="w-14 sm:w-32 py-2.5 px-1 sm:py-4 sm:px-4 text-center font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider"
                              style={{ fontSize: `${Math.max(11, Math.round(13 * fontSize))}px` }}
                            >
                              Benar
                            </th>
                            <th
                              className="w-14 sm:w-32 py-2.5 px-1 sm:py-4 sm:px-4 text-center font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider"
                              style={{ fontSize: `${Math.max(11, Math.round(13 * fontSize))}px` }}
                            >
                              Salah
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                          {statements.map((s, idx) => {
                            const selected = currentAnswers[s.id];
                            const isBenar = selected === "benar";
                            const isSalah = selected === "salah";

                            return (
                              <tr
                                key={s.id || idx}
                                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                              >
                                <td className="py-2.5 px-3 sm:py-5 sm:px-6 font-serif text-slate-800 dark:text-slate-200 align-middle">
                                  <div className="flex items-start gap-2">
                                    <span
                                      className="inline-flex shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold items-center justify-center mt-0.5"
                                      style={{ fontSize: `${Math.max(10, Math.round(11 * fontSize))}px` }}
                                    >
                                      {idx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0" style={{ fontSize: `${15 * fontSize}px` }}>
                                      <MathText
                                        content={s.text}
                                        disableJustify={true}
                                        className="cbt-choice-text text-left font-serif leading-relaxed !p-0 [&_p]:m-0"
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2 px-1 sm:py-4 sm:px-4 text-center align-middle">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onAnswer( {
                                        ...currentAnswers,
                                        [s.id]: "benar"
                                      });
                                    }}
                                    className={`group/btn relative inline-flex items-center justify-center p-1.5 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-2xl border-2 font-bold text-xs sm:text-sm transition-all active:scale-95 ${
                                      isBenar
                                        ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20"
                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-emerald-300 dark:hover:border-emerald-700"
                                    }`}
                                    title="Pilih Benar"
                                  >
                                    <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center sm:mr-1.5 transition-colors ${
                                      isBenar ? "border-white bg-white text-emerald-600" : "border-slate-300 dark:border-slate-700"
                                    }`}>
                                      {isBenar && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-600" />}
                                    </span>
                                    <span className="hidden sm:inline">Benar</span>
                                  </button>
                                </td>
                                <td className="py-2 px-1 sm:py-4 sm:px-4 text-center align-middle">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onAnswer( {
                                        ...currentAnswers,
                                        [s.id]: "salah"
                                      });
                                    }}
                                    className={`group/btn relative inline-flex items-center justify-center p-1.5 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-2xl border-2 font-bold text-xs sm:text-sm transition-all active:scale-95 ${
                                      isSalah
                                        ? "bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-500/20"
                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-rose-300 dark:hover:border-rose-700"
                                    }`}
                                    title="Pilih Salah"
                                  >
                                    <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center sm:mr-1.5 transition-colors ${
                                      isSalah ? "border-white bg-white text-rose-600" : "border-slate-300 dark:border-slate-700"
                                    }`}>
                                      {isSalah && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-rose-600" />}
                                    </span>
                                    <span className="hidden sm:inline">Salah</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              // Fallback untuk format legacy lama
              return (
                <div className="grid grid-cols-2 gap-5 px-2">
                  {Object.keys(question.choices || {}).slice(0, 2).map((choiceId, idx) => {
                    const isS = answer === choiceId;
                    const isB = question.choices![choiceId].text.toLowerCase().includes("benar") || idx === 0;
                    return (
                      <button
                        key={choiceId}
                        onClick={() => onAnswer( choiceId)}
                        className={`group relative flex flex-col items-center justify-center gap-4 py-8 px-6 rounded-[2.5rem] border-2 transition-all duration-300 active:scale-95 ${
                          isS
                            ? (isB ? "bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-400 text-white shadow-xl shadow-emerald-500/20" : "bg-gradient-to-br from-rose-500 to-rose-600 border-rose-400 text-white shadow-xl shadow-rose-500/20")
                            : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600 hover:border-emerald-200 dark:hover:border-emerald-800"
                        }`}
                      >
                        <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-colors ${
                          isS ? "bg-white/20 text-white" : (isB ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500" : "bg-rose-50 dark:bg-rose-950/30 text-rose-500")
                        }`}>
                          {isB ? <CheckCircle2 className="w-9 h-9" strokeWidth={2.5} /> : <X className="w-9 h-9" strokeWidth={2.5} />}
                        </div>
                        <span className={`font-black text-sm uppercase tracking-widest ${isS ? "text-white" : "text-slate-700 dark:text-slate-300"}`}>
                          {question.choices![choiceId].text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()
          )}
          {question.type === "matriks" && (
            (() => {
              const statements = question.statements || [];
              const columns = question.columns || [];
              const currentAnswers = (typeof answer === "object" && answer !== null)
                ? answer
                : {};

              if (statements.length > 0 && columns.length > 0) {
                // Warna tombol kolom: "Benar" = hijau, "Salah" = merah (case-insensitive),
                // kolom lain netral. Dipakai tabel desktop & kartu mobile.
                const colTone = (col: any) => {
                  const colName = String(col.text || "").trim().toLowerCase();
                  const isSalahCol = colName === "salah";
                  return {
                    selected: isSalahCol
                      ? "bg-red-500 border-red-500 text-white shadow-md shadow-red-500/20"
                      : "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20",
                    hover: isSalahCol
                      ? "hover:border-red-300 dark:hover:border-red-700"
                      : "hover:border-emerald-300 dark:hover:border-emerald-700",
                    dotText: isSalahCol ? "text-red-600" : "text-emerald-600",
                    dotBg: isSalahCol ? "bg-red-600" : "bg-emerald-600",
                  };
                };
                const pick = (sId: string, colId: string) =>
                  onAnswer({
                    ...currentAnswers,
                    [sId]: colId,
                  });
                const stmtHeaderSize = Math.max(11, Math.round(13 * fontSize));
                const stmtBodySize = 15 * fontSize;

                return (
                  <div>
                    {/* Desktop: tabel + scroll horizontal berindikator "← geser →" */}
                    <div className="hidden sm:block overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
                      <HorizontalScrollHint scrollClassName="overflow-x-auto" contentClassName="w-max min-w-full">
                        <table className="w-full text-left border-collapse" style={{ minWidth: `${240 + columns.length * 120}px` }}>
                          <thead>
                            <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
                              <th
                                className="py-4 px-6 font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider min-w-[200px]"
                                style={{ fontSize: `${stmtHeaderSize}px` }}
                              >
                                Pernyataan
                              </th>
                              {columns.map((col: any) => (
                                <th
                                  key={col.id}
                                  className="py-4 px-4 text-center font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider min-w-[110px]"
                                  style={{ fontSize: `${stmtHeaderSize}px` }}
                                >
                                  {col.text}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                            {statements.map((s: any, idx: number) => {
                              const selected = currentAnswers[s.id];
                              return (
                                <tr
                                  key={s.id || idx}
                                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                                >
                                  <td className="py-5 px-6 align-middle">
                                    <div className="flex items-start gap-2">
                                      <span
                                        className="inline-flex shrink-0 w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold items-center justify-center mt-0.5"
                                        style={{ fontSize: `${Math.max(10, Math.round(11 * fontSize))}px` }}
                                      >
                                        {idx + 1}
                                      </span>
                                      <div className="flex-1 min-w-0 font-serif text-slate-800 dark:text-slate-200" style={{ fontSize: `${stmtBodySize}px` }}>
                                        <MathText
                                          content={s.text}
                                          disableJustify={true}
                                          className="cbt-choice-text text-left font-serif leading-relaxed !p-0 [&_p]:m-0"
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  {columns.map((col: any) => {
                                    const isSelected = selected === col.id;
                                    const tone = colTone(col);
                                    return (
                                      <td key={col.id} className="py-4 px-4 text-center align-middle">
                                        <button
                                          type="button"
                                          onClick={() => pick(s.id, col.id)}
                                          className={`relative inline-flex items-center justify-center px-4 py-2.5 rounded-2xl border-2 font-bold text-sm transition-all active:scale-95 whitespace-nowrap ${
                                            isSelected
                                              ? tone.selected
                                              : `bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 ${tone.hover}`
                                          }`}
                                          title={`Pilih ${col.text}`}
                                        >
                                          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-1.5 transition-colors ${
                                            isSelected ? `border-white bg-white ${tone.dotText}` : "border-slate-300 dark:border-slate-700"
                                          }`}>
                                            {isSelected && <div className={`w-2.5 h-2.5 rounded-full ${tone.dotBg}`} />}
                                          </span>
                                          {col.text}
                                        </button>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </HorizontalScrollHint>
                    </div>

                    {/* Mobile: tiap pernyataan jadi kartu vertikal */}
                    <div className="sm:hidden space-y-3">
                      {statements.map((s: any, idx: number) => {
                        const selected = currentAnswers[s.id];
                        return (
                          <div
                            key={s.id || idx}
                            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm"
                          >
                            <div className="flex items-start gap-2.5">
                              <span
                                className="inline-flex shrink-0 w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold items-center justify-center mt-0.5"
                                style={{ fontSize: `${Math.max(10, Math.round(11 * fontSize))}px` }}
                              >
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0 font-serif text-slate-800 dark:text-slate-200" style={{ fontSize: `${stmtBodySize}px` }}>
                                <MathText
                                  content={s.text}
                                  disableJustify={true}
                                  className="cbt-choice-text text-left font-serif leading-relaxed !p-0 [&_p]:m-0"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              {columns.map((col: any) => {
                                const isSelected = selected === col.id;
                                const tone = colTone(col);
                                return (
                                  <button
                                    key={col.id}
                                    type="button"
                                    onClick={() => pick(s.id, col.id)}
                                    aria-pressed={isSelected}
                                    className={`min-h-[48px] px-3 py-2.5 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 inline-flex items-center justify-center gap-2 ${
                                      isSelected
                                        ? tone.selected
                                        : `bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 ${tone.hover}`
                                    }`}
                                  >
                                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                      isSelected ? `border-white bg-white ${tone.dotText}` : "border-slate-300 dark:border-slate-600"
                                    }`}>
                                      {isSelected && <div className={`w-2 h-2 rounded-full ${tone.dotBg}`} />}
                                    </span>
                                    <span className="truncate">{col.text}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return null;
            })()
          )}
          {question.type === "klasifikasi" && (
            <KlasifikasiBody
              question={question}
              answer={answer}
              onAnswer={onAnswer}
              fontSize={fontSize}
              klasifikasiOrder={klasifikasiOrder}
            />
          )}
          {question.type === "isian_rumpang" && (
            (() => {
              const text = question.rumpangText || "";
              const blanks = question.blanks || [];
              const currentAnswers = (typeof answer === "object" && answer !== null)
                ? answer
                : {};

              if (!text) return null;

              // Parse teks, ganti [[n]] dengan input
              const parts: React.ReactNode[] = [];
              const re = /\[\[(\d+)\]\]/g;
              let lastIdx = 0;
              let m: RegExpExecArray | null;
              let keyIdx = 0;

              while ((m = re.exec(text)) !== null) {
                if (m.index > lastIdx) {
                  parts.push(
                    <span key={`t-${keyIdx++}`}>{text.slice(lastIdx, m.index)}</span>
                  );
                }
                const blankId = m[1];
                const blankVal = currentAnswers[blankId] || "";
                parts.push(
                  <input
                    key={`b-${blankId}-${keyIdx++}`}
                    type="text"
                    value={blankVal}
                    onChange={(e) => {
                      onAnswer( {
                        ...currentAnswers,
                        [blankId]: e.target.value
                      });
                    }}
                    placeholder="..."
                    className="inline-block mx-1 px-2 py-1 rounded-md border border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-slate-800 dark:text-slate-200 font-medium shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none transition-all align-middle"
                    style={{
                      width: `${Math.max(3, blankVal.length + 1)}ch`,
                      fontSize: "16px"
                    }}
                  />
                );
                lastIdx = m.index + m[0].length;
              }
              if (lastIdx < text.length) {
                parts.push(
                  <span key={`t-${keyIdx++}`}>{text.slice(lastIdx)}</span>
                );
              }

              return (
                <div
                  className="p-5 sm:p-8 rounded-xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm font-serif leading-loose text-slate-800 dark:text-slate-200"
                  style={{ fontSize: `${15 * fontSize}px` }}
                >
                  {parts}
                </div>
              );
            })()
          )}
          {question.type === "hotspot" && (
            (() => {
              const imgUrl = question.hotspotImageUrl || question.imageUrl || "";
              const mode = (question.hotspotMode || "any").toLowerCase();
              const ans = answer;

              const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
                const imgEl = (e.currentTarget as HTMLDivElement).querySelector("img");
                if (!imgEl) return;
                const rect = imgEl.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                // Clamp 0-100
                const cx = Math.max(0, Math.min(100, Math.round(x * 10) / 10));
                const cy = Math.max(0, Math.min(100, Math.round(y * 10) / 10));

                if (mode === "all") {
                  const pts = Array.isArray(ans) ? [...ans] : [];
                  pts.push({ x: cx, y: cy });
                  onAnswer( pts);
                } else {
                  onAnswer( { x: cx, y: cy });
                }
              };

              const handleClear = () => {
                onAnswer( mode === "all" ? [] : null);
              };

              const handleRemovePoint = (idx: number, e: React.MouseEvent) => {
                e.stopPropagation();
                if (mode === "all" && Array.isArray(ans)) {
                  const pts = [...ans];
                  pts.splice(idx, 1);
                  onAnswer( pts);
                }
              };

              const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
                const container = (e.target as HTMLImageElement).closest("[data-hotspot-container]");
                const fallback = container?.querySelector("[data-hotspot-fallback]");
                const imgWrap = container?.querySelector("[data-hotspot-imgwrap]");
                if (fallback) (fallback as HTMLElement).style.display = "flex";
                if (imgWrap) (imgWrap as HTMLElement).style.display = "none";
              };

              if (!imgUrl) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                      Gambar soal tidak tersedia.
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                      Hubungi pengawas jika masalah berlanjut.
                    </p>
                  </div>
                );
              }

              const markers: Array<{ x: number; y: number }> = mode === "all"
                ? (Array.isArray(ans) ? ans.filter((p: any) => p && typeof p.x === "number" && typeof p.y === "number") : [])
                : (ans && typeof ans.x === "number" && typeof ans.y === "number" ? [ans] : []);

              return (
                <div className="space-y-3" data-hotspot-container>
                  <div className="text-sm text-slate-500 dark:text-slate-400 font-medium px-1">
                    {mode === "all"
                      ? "Klik pada gambar untuk menandai titik (bisa beberapa titik). Klik nomor untuk menghapus."
                      : "Klik pada gambar untuk menandai titik. Klik lagi untuk memindahkan."}
                  </div>
                  <div
                    data-hotspot-imgwrap
                    className="relative inline-block max-w-full rounded-xl sm:rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 select-none"
                    style={{ touchAction: "manipulation", cursor: "crosshair" }}
                    onClick={handleImageClick}
                  >
                    <img
                      src={imgUrl}
                      alt="Soal hotspot"
                      className="max-w-full h-auto block"
                      style={{ maxHeight: "60vh" }}
                      draggable={false}
                      onError={handleImgError}
                    />
                    {markers.map((pt, idx) => (
                      <div
                        key={idx}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-red-500 border-2 border-white shadow-lg font-bold text-white"
                        style={{
                          left: `${pt.x}%`,
                          top: `${pt.y}%`,
                          width: "28px",
                          height: "28px",
                          fontSize: "14px",
                          pointerEvents: mode === "all" ? "auto" : "none",
                          cursor: mode === "all" ? "pointer" : "default"
                        }}
                        onClick={mode === "all" ? (e) => handleRemovePoint(idx, e) : undefined}
                        title={mode === "all" ? "Klik untuk hapus titik ini" : `Titik (${pt.x}%, ${pt.y}%)`}
                      >
                        {mode === "all" ? idx + 1 : "•"}
                      </div>
                    ))}
                  </div>
                  <div
                    data-hotspot-fallback
                    className="flex-col items-center justify-center py-12 px-6 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800"
                    style={{ display: "none" }}
                  >
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                      Gambar gagal dimuat.
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                      Hubungi pengawas jika masalah berlanjut.
                    </p>
                  </div>
                  {markers.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-4 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-bold hover:border-rose-300 hover:text-rose-500 transition-all active:scale-95"
                    >
                      Hapus {mode === "all" ? "semua titik" : "titik"}
                    </button>
                  )}
                </div>
              );
            })()
          )}
          {question.type === "menjodohkan" && (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 space-y-3">
                {(question.pairs || []).map(p => {
                  const sA = answer || {}; const v = sA[p.id];
                  return (
                    <div key={p.id} className="flex items-stretch gap-2">
                      <div
                        className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-serif text-slate-800 dark:text-slate-200"
                        style={{ fontSize: `${15 * fontSize}px` }}
                      >{p.left}</div>
                      <div className="flex items-center opacity-20"><ArrowRight className="w-4 h-4" /></div>
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragOverSlot(p.id); }}
                        onDragLeave={() => setDragOverSlot(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverSlot(null);
                          if (draggingOption) {
                            onAnswer( { ...(answer || {}), [p.id]: draggingOption });
                            setDraggingOption(null);
                          }
                        }}
                        onClick={() => { if (v) { const n = { ...sA }; delete n[p.id]; onAnswer( n); } }}
                        className={`flex-1 p-1 rounded-xl border-2 border-dashed flex items-center justify-center min-h-[50px] transition-all ${dragOverSlot === p.id && !v ? "bg-emerald-100/50 dark:bg-emerald-900/30 border-emerald-500 scale-[1.02]" :
                            v ? "bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-400/50 cursor-pointer" :
                              "bg-slate-50/30 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"
                          }`}
                      >
                        {v ? <div className="w-full h-full flex items-center justify-center bg-emerald-600 text-white rounded-lg p-2 font-serif shadow-sm" style={{ fontSize: `${14 * fontSize}px` }}>{v}</div> : <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase">Drop Disini</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="lg:w-1/3 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-wrap gap-2 content-start min-h-[100px]">
                {(matchingOptions || []).filter(o => !Object.values(answer || {}).includes(o)).map(o => (
                  <div
                    key={o}
                    draggable
                    onDragStart={() => setDraggingOption(o)}
                    onDragEnd={() => { setDraggingOption(null); setDragOverSlot(null); }}
                    onClick={() => { const p = (question.pairs || []).find(x => !(answer || {})[x.id]); if (p) onAnswer( { ...(answer || {}), [p.id]: o }); }}
                    className={`px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-serif text-emerald-600 dark:text-emerald-400 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-grab active:cursor-grabbing select-none ${draggingOption === o ? "opacity-50 scale-95" : ""}`}
                    style={{ fontSize: `${14 * fontSize}px` }}
                  >{o}</div>
                ))}
              </div>
            </div>
          )}
          {(question.type === "isian_singkat" || question.type === "uraian") && (
            (essayLock?.locked ?? false) ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-amber-50/50 dark:bg-amber-950/20 rounded-[30px] border-2 border-dashed border-amber-200 dark:border-amber-800/40">
                <Lock className="w-12 h-12 text-amber-400 mb-4" />
                <h3 className="text-lg font-black text-amber-700 dark:text-amber-400 uppercase tracking-tight mb-2">Soal Terkunci</h3>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/60 font-medium max-w-sm">
                  Selesaikan semua soal objektif terlebih dahulu sebelum mengerjakan soal uraian/isian singkat.
                </p>
                <p className="text-xs text-amber-500 mt-3 font-bold">
                  Sisa {(essayLock?.remaining ?? 0)} soal objektif belum dijawab
                </p>
              </div>
            ) : (
              <textarea value={answer || ""} onChange={(e) => onAnswer( e.target.value)} placeholder={question.type === "uraian" ? 'Tuliskan jawaban Anda di sini secara lengkap...\n\n(Isi "lembar ujian" jika Anda mengerjakan di lembar ujian kertas)' : 'Tuliskan jawaban Anda...\n(Isi "lembar ujian" jika Anda mengerjakan di lembar ujian)'} rows={question.type === "uraian" ? 10 : 3} className="w-full p-6 sm:p-8 rounded-[30px] border-2 border-slate-100 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 font-bold text-sm sm:text-base resize-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all outline-none" />
            )
          )}
          {(question.type === "urutkan" || question.type === "drag_drop") && (() => {
            const savedOrder = Array.isArray(answer) ? answer : null;
            const shuffledOrder = Array.isArray(itemsOrder) ? itemsOrder : null;
            const defaultOrder = (question.items || []).map(it => it.id);
            const displayOrder = savedOrder || shuffledOrder || defaultOrder;
            const hasBeenTouched = !!savedOrder; // Siswa sudah pernah geser
            if (!displayOrder || displayOrder.length === 0) return null;
            return (
              <Reorder.Group axis="y" values={displayOrder} onReorder={(o: string[]) => onAnswer( o)} className="space-y-2">
                {displayOrder.map((id: string, i: number) => {
                  const it = question.items?.find(x => x.id === id); return <Reorder.Item key={id} value={id} className={`flex items-center gap-4 sm:gap-6 p-4 sm:p-5 border rounded-2xl shadow-sm cursor-grab active:cursor-grabbing group relative overflow-hidden transition-colors ${hasBeenTouched ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40" : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700"}`}><div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm ${hasBeenTouched ? "bg-emerald-600 text-white" : "bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400"}`}>{String.fromCharCode(65 + i)}</div><div className="flex-1 font-serif text-slate-800 dark:text-slate-200" style={{ fontSize: `${15 * fontSize}px` }}>{it?.text || ""}</div><div className={`p-2 rounded-lg ${hasBeenTouched ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-slate-50 dark:bg-slate-900"}`}><GripVertical className={`w-4 h-4 sm:w-5 sm:h-5 ${hasBeenTouched ? "text-emerald-400" : "text-slate-300"}`} /></div></Reorder.Item>;
                })}
              </Reorder.Group>
            );
          })()}
        </CardContent>
      </Card>
  );
};

export default QuestionRenderer;
