import React from "react";
import { Dialog, DialogContent } from "../../../../components/ui/dialog";
import { SmartImage } from "../../../../components/ui/smart-image";
import { MathText } from "../../../../components/ui/MathText";
import {
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Maximize2,
  HelpCircle,
  Check,
  Forward,
  CheckCircle2,
  Menu,
} from "lucide-react";

interface QuestionPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: any[];
  previewQuestion: any | null;
  previewIndex: number;
  onNavigate: (index: number) => void;
}

export const QuestionPreviewDialog: React.FC<QuestionPreviewDialogProps> = ({
  open,
  onOpenChange,
  questions,
  previewQuestion,
  previewIndex,
  onNavigate,
}) => {
  if (!previewQuestion) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl p-0 h-[92vh] sm:h-[95vh] w-[95vw] sm:w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-300"
        hideClose
      >
        {/* CBT Header Replica - FIXED TOP */}
        <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 sm:px-10 py-5 sm:py-6 flex items-center justify-between z-20 backdrop-blur-md bg-white/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl sm:text-2xl shadow-sm shadow-emerald-200 dark:shadow-none">
              {questions.findIndex((q) => q.id === previewQuestion.id) + 1}
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-[0.2em] leading-tight mb-1">
                Soal Ujian
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">
                  Pratinjau Siswa
                </span>
                {previewQuestion.groupId && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 text-xs font-black uppercase tracking-widest">
                    Grup: {previewQuestion.groupId}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">
              {previewIndex + 1}/{questions.length}
            </span>
            <button
              onClick={() => {
                if (previewIndex > 0) {
                  onNavigate(previewIndex - 1);
                }
              }}
              disabled={previewIndex <= 0}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (previewIndex < questions.length - 1) {
                  onNavigate(previewIndex + 1);
                }
              }}
              disabled={previewIndex >= questions.length - 1}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-500 flex items-center justify-center border border-rose-100 dark:border-rose-800/40 hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* INTERNAL SCROLLABLE CONTENT - HIDDEN SCROLLBAR */}
        <div className="flex-1 overflow-y-auto scrollbar-hidden p-6 sm:p-10 space-y-8">
          {/* Literacy Stimulus (If Any) */}
          {previewQuestion.groupId &&
            (() => {
              const firstWithText = questions.find(
                (q) => q.groupId === previewQuestion.groupId && q.groupText
              );
              if (firstWithText) {
                return (
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 mb-10 space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                      <FileText className="w-16 h-16 sm:w-20 sm:h-20 text-emerald-800" />
                    </div>

                    <div className="flex items-center gap-3 mb-4 relative z-10">
                      <div className="h-5 sm:h-6 w-1 sm:w-1.5 rounded-full bg-emerald-600"></div>
                      <span className="text-xs sm:text-xs font-black uppercase tracking-[0.2em] text-emerald-500 dark:text-emerald-400">
                        Bacaan / Stimulus
                      </span>
                    </div>

                    <MathText
                      content={firstWithText.groupText || ""}
                      className={`leading-relaxed text-slate-800 dark:text-slate-200 font-serif ql-editor !p-0 !overflow-visible selection:bg-blue-100 dark:selection:bg-blue-900/40`}
                    />

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end opacity-50 dark:opacity-100 text-right">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest italic">
                        Bacalah teks dengan seksama sebelum memberikan jawaban.
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

          <div className="space-y-6">
            {/* Main Question Image */}
            {previewQuestion.imageUrl && (
              <div className="relative inline-block group">
                <SmartImage
                  src={previewQuestion.imageUrl}
                  className="max-h-[300px] sm:max-h-[450px] rounded-2xl border-4 border-white dark:border-slate-800 shadow transition-all group-hover:brightness-95"
                  alt="Question"
                />
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                  <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                </div>
              </div>
            )}

            {/* Question Text */}
            <MathText
              content={previewQuestion.text}
              className={`ql-editor !p-0 !overflow-visible font-serif text-lg sm:text-xl text-slate-800 dark:text-slate-100 leading-relaxed break-words [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_b]:text-slate-900 dark:[&_b]:text-white [&_p]:mb-3 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-10 [&_ul]:pl-10 selection:bg-emerald-100 dark:selection:bg-emerald-900/40`}
            />

            {/* Special Type Badge */}
            {(previewQuestion.type === "pilihan_ganda_kompleks" ||
              previewQuestion.type === "menjodohkan" ||
              previewQuestion.type === "urutkan") && (
              <div className="flex items-center gap-2 mb-6 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl w-fit">
                <HelpCircle className="w-4 h-4 text-blue-500" />
                <span className="text-xs sm:text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                  {previewQuestion.type === "pilihan_ganda_kompleks"
                    ? "Pilih semua jawaban yang benar"
                    : previewQuestion.type === "menjodohkan"
                    ? "Pasangkan pernyataan di bawah ini"
                    : "Urutkan pernyataan dengan benar"}
                </span>
              </div>
            )}
          </div>

          {/* Choices / Statements Container */}
          <div className="space-y-3 pt-4">
            {previewQuestion.type === "benar_salah" &&
            previewQuestion.statements &&
            previewQuestion.statements.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                        Pernyataan
                      </th>
                      <th className="w-28 px-4 py-3 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                        Kunci
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewQuestion.statements.map((s: any, idx: number) => (
                      <tr
                        key={s.id || idx}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                          <span className="font-bold mr-2 text-slate-400">
                            {idx + 1}.
                          </span>
                          <MathText
                            content={s.text}
                            disableJustify={true}
                            className="inline !p-0 [&_p]:inline"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${
                              s.answer === "benar"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                            }`}
                          >
                            {s.answer || "benar"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : previewQuestion.type === "matriks" &&
              (previewQuestion as any).options?.columns ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-left border-collapse min-w-[320px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                        Pernyataan
                      </th>
                      {((previewQuestion as any).options.columns || []).map(
                        (col: any) => (
                          <th
                            key={col.id}
                            className="px-4 py-3 text-center text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide whitespace-nowrap"
                          >
                            {col.text}
                          </th>
                        )
                      )}
                      <th className="w-24 px-4 py-3 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                        Kunci
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(
                      (previewQuestion as any).options.statements || []
                    ).map((s: any, idx: number) => {
                      const kunciCol = (
                        (previewQuestion as any).options.columns || []
                      ).find((c: any) => c.id === s.answer);
                      return (
                        <tr
                          key={s.id || idx}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                            <span className="font-bold mr-2 text-slate-400">
                              {idx + 1}.
                            </span>
                            <MathText
                              content={s.text}
                              disableJustify={true}
                              className="inline !p-0 [&_p]:inline"
                            />
                          </td>
                          {(
                            (previewQuestion as any).options.columns || []
                          ).map((col: any) => (
                            <td key={col.id} className="p-3.5 text-center">
                              <span
                                className={`inline-block w-4 h-4 rounded-full border-2 ${
                                  col.id === s.answer
                                    ? "bg-teal-500 border-teal-600"
                                    : "border-slate-300 dark:border-slate-600"
                                }`}
                              />
                            </td>
                          ))}
                          <td className="px-4 py-3 text-center">
                            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400">
                              {kunciCol?.text || "-"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : previewQuestion.type === "klasifikasi" &&
              (previewQuestion as any).options?.categories ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                        Pernyataan
                      </th>
                      <th className="w-36 px-4 py-3 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                        Kategori Benar
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(
                      (previewQuestion as any).options.statements || []
                    ).map((s: any, idx: number) => {
                      const kunciCat = (
                        (previewQuestion as any).options.categories || []
                      ).find((c: any) => c.id === s.answer);
                      return (
                        <tr
                          key={s.id || idx}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                            <span className="font-bold mr-2 text-slate-400">
                              {idx + 1}.
                            </span>
                            <MathText
                              content={s.text}
                              disableJustify={true}
                              className="inline !p-0 [&_p]:inline"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400">
                              {kunciCat?.text || "-"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kategori tersedia:{" "}
                    {(
                      (previewQuestion as any).options.categories || []
                    )
                      .map((c: any) => c.text)
                      .join(", ")}
                    {(previewQuestion as any).options.shuffleStatements !==
                      false && " • Urutan pernyataan diacak saat ujian"}
                  </p>
                </div>
              </div>
            ) : previewQuestion.type === "isian_rumpang" &&
              (previewQuestion as any).options?.text ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 sm:p-5">
                <p className="text-xs font-black text-lime-700 dark:text-lime-400 uppercase tracking-widest mb-3">
                  Pratinjau Isian Rumpang
                </p>
                <div className="text-sm sm:text-base text-slate-800 dark:text-slate-200 leading-loose">
                  {(previewQuestion as any).options.text
                    .split(/(\[\[\d+\]\])/g)
                    .map((part: string, idx: number) => {
                      const m = part.match(/\[\[(\d+)\]\]/);
                      if (m) {
                        const blank = (
                          (previewQuestion as any).options.blanks || []
                        ).find((b: any) => String(b.id) === m[1]);
                        return (
                          <span
                            key={idx}
                            className="inline-flex flex-col items-center mx-1 align-middle"
                          >
                            <input
                              disabled
                              placeholder={`[[${m[1]}]]`}
                              className="h-9 min-w-[100px] text-sm text-center rounded-lg border-2 border-dashed border-lime-300 dark:border-lime-700 bg-lime-50/50 dark:bg-lime-950/20 px-2"
                            />
                            {blank && (
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                {(blank.answers || []).join(" / ")}
                              </span>
                            )}
                          </span>
                        );
                      }
                      return <span key={idx}>{part}</span>;
                    })}
                </div>
              </div>
            ) : previewQuestion.type === "hotspot" &&
              (previewQuestion as any).options?.imageUrl ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-sky-700 dark:text-sky-400 uppercase tracking-widest">
                    Pratinjau Hotspot
                  </p>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {(previewQuestion as any).options.mode === "all"
                      ? "Mode: Semua area"
                      : "Mode: Satu saja"}{" "}
                    •{" "}
                    {(
                      (previewQuestion as any).options.areas || []
                    ).length}{" "}
                    area
                  </span>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                  <img
                    src={(previewQuestion as any).options.imageUrl}
                    alt="Gambar hotspot"
                    className="w-full h-auto block"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Area target:{" "}
                  {(
                    (previewQuestion as any).options.areas || []
                  )
                    .map((a: any) => a.label)
                    .join(", ") || "-"}
                  <span className="italic"> (tidak ditampilkan ke siswa)</span>
                </p>
              </div>
            ) : (previewQuestion.type === "pilihan_ganda" ||
                previewQuestion.type === "pilihan_ganda_kompleks" ||
                previewQuestion.type === "benar_salah" ||
                !previewQuestion.type) && (
              <div className="space-y-3">
                {Object.keys(previewQuestion.choices || {}).map((cKey, idx) => {
                  const choice = previewQuestion.choices![cKey];
                  if (!choice.text && !choice.imageUrl) return null;
                  const isCorrect = choice.isCorrect;

                  return (
                    <div
                      key={cKey}
                      className={`w-full text-left p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl border-2 flex items-center gap-3 sm:gap-5 transition-all outline-none group ${
                        isCorrect
                          ? "bg-emerald-50 border-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500 shadow-lg shadow-emerald-500/10"
                          : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-xl sm:rounded-2xl border flex items-center justify-center font-black text-sm sm:text-lg transition-colors ${
                          isCorrect
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800"
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <div className="flex-1 py-1 sm:py-2">
                        <MathText
                          content={choice.text}
                          className={`break-words font-serif ql-editor !p-0 !overflow-visible [&_img]:max-w-[300px] [&_img]:h-auto [&_img]:rounded-xl [&_img]:mt-2 text-inherit ${
                            isCorrect ? "font-bold" : "font-normal"
                          }`}
                        />
                        {choice.imageUrl && (
                          <div className="mt-4">
                            <SmartImage
                              src={choice.imageUrl}
                              alt="Choice"
                              className="max-h-[200px] rounded-2xl border border-slate-100"
                            />
                          </div>
                        )}
                      </div>
                      {isCorrect && (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg">
                          <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[4px]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {previewQuestion.type === "menjodohkan" && (
              <div className="space-y-4 pt-2">
                {(previewQuestion.pairs || []).map((p: any) => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row items-stretch gap-4"
                  >
                    <div className="flex-1 p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl font-serif text-slate-800 dark:text-slate-200 shadow-sm">
                      <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                        Pernyataan
                      </div>
                      {p.left}
                    </div>
                    <div className="hidden sm:flex items-center justify-center text-emerald-500">
                      <Forward className="w-8 h-8" />
                    </div>
                    <div className="flex-1 p-5 bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-dashed border-emerald-400/50 rounded-2xl font-serif text-emerald-800 dark:text-emerald-400 shadow-inner flex flex-col justify-center">
                      <div className="text-xs font-black text-emerald-600/50 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pasangan Benar
                      </div>
                      <div className="text-lg font-black">{p.right}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(previewQuestion.type === "isian_singkat" ||
              previewQuestion.type === "uraian") && (
              <div className="p-4 sm:p-6 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/20 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg">
                    <Check className="w-6 h-6 stroke-[3px]" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-blue-600/70 dark:text-blue-400/70 uppercase tracking-widest block">
                      Kunci Jawaban / Pedoman
                    </span>
                    <span className="text-xs text-blue-400 font-bold uppercase tracking-tighter">
                      Hanya terlihat oleh Administrator
                    </span>
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-blue-100 dark:border-blue-800/40 shadow-sm">
                  {previewQuestion.answerKey || "(Belum diisi)"}
                </div>
              </div>
            )}

            {(previewQuestion.type === "urutkan" ||
              previewQuestion.type === "drag_drop") && (
              <div className="space-y-4 pt-2">
                {(previewQuestion.items || []).map((it: any, idx: number) => (
                  <div
                    key={it.id}
                    className="flex items-center gap-5 p-4 sm:p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-sm shadow-indigo-200 dark:shadow-none transition-transform group-hover:rotate-6">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-0.5">
                        Urutan Benar
                      </div>
                      <span className="text-xl font-serif font-black text-indigo-800 dark:text-indigo-300 leading-tight">
                        {it.text}
                      </span>
                    </div>
                    <div className="opacity-20">
                      <Menu className="w-6 h-6" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

