import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../../components/ui/dialog";
import { Button } from "../../../../components/ui/button";
import { MathText } from "../../../../components/ui/MathText";
import ReactQuill from "react-quill";
import {
  BookOpen,
  Sparkles,
  Trash,
  Plus,
  Image,
  Check,
  Forward,
  GripVertical,
  RefreshCw,
  X,
} from "lucide-react";

export interface QuestionBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchQuestions: any[];
  setBatchQuestions: React.Dispatch<React.SetStateAction<any[]>>;
  onSaveBatch: () => void;
  isSavingBatch: boolean;
  importProgress: number;
  onOpenMathGuide: () => void;
  onOpenGallery: (index: number) => void;
  onOpenAIModal: () => void;
  role?: string | null;
  user?: any;
  teacherAIAccess?: boolean;
  onAIGenerateDirect: () => void;
  isAIGeneratingDirect: boolean;
  onAIRegenerateSingle: (index: number) => void;
  isRegeneratingIndex: number | null;
  handleAddBatchRow: () => void;
  handleRemoveBatchRow: (index: number) => void;
  updateBatchItem: (index: number, field: string, value: any) => void;
  updateBatchChoice: (index: number, letter: string, value: string) => void;
  quillModules?: any;
  quillFormats?: any;
}

export const QuestionBatchDialog: React.FC<QuestionBatchDialogProps> = ({
  open,
  onOpenChange,
  batchQuestions,
  setBatchQuestions,
  onSaveBatch,
  isSavingBatch,
  importProgress,
  onOpenMathGuide,
  onOpenGallery,
  onOpenAIModal,
  role,
  user,
  teacherAIAccess,
  onAIGenerateDirect,
  isAIGeneratingDirect,
  onAIRegenerateSingle,
  isRegeneratingIndex,
  handleAddBatchRow,
  handleRemoveBatchRow,
  updateBatchItem,
  updateBatchChoice,
  quillModules,
  quillFormats,
}) => {
  const [batchDragState, setBatchDragState] = useState<{ questionIndex: number; itemIndex: number } | null>(null);

  return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-4xl bg-slate-50 dark:bg-slate-900 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Kelola & Tinjau Paket Soal</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 pt-3">
              {/* BATCH LITERACY STIMULUS DISPLAY */}
              {batchQuestions.length > 0 && batchQuestions[0].groupText && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-4 sm:p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-blue-900 dark:text-blue-100 uppercase tracking-tight">Stimulus / Literasi</h3>
                        <p className="text-xs text-blue-700/60 dark:text-blue-400/60 font-bold uppercase tracking-widest">Stimulus / Literasi Induk untuk Paket Soal Ini</p>
                      </div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-900/80 px-4 py-1.5 rounded-full border border-blue-100 dark:border-blue-800/40 shadow-sm">
                      <span className="text-xs font-black text-blue-600 uppercase tracking-tighter">ID: {batchQuestions[0].groupId || 'LIT-NEW'}</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-blue-800/40 shadow-inner overflow-hidden">
                    <ReactQuill
                      theme="snow"
                      value={batchQuestions[0].groupText}
                      onChange={(content, _delta, source) => {
                        if (source !== 'user') return;
                        // Update all questions in batch to share same stimulus
                        const updatedBatch = batchQuestions.map(bq => ({ ...bq, groupText: content }));
                        setBatchQuestions(updatedBatch);
                      }}
                      placeholder="Tuliskan stimulus / literasi di sini..."
                      className="[&_.ql-editor]:min-h-[250px] [&_.ql-editor_p]:text-indent-[48px] [&_.ql-editor_p]:mb-[1.5rem] [&_.ql-editor_p]:leading-[1.8] [&_.ql-editor_p]:text-justify [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:bg-slate-50 dark:[&_.ql-toolbar]:bg-slate-800/50"
                    />
                  </div>
                </div>
              )}

              {batchQuestions.map((q, index) => (
                <div key={index} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm shadow-slate-200/20 dark:shadow-none relative space-y-4 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all duration-300">
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 -mx-5 -mt-5 p-4 py-3 rounded-t-3xl border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-black text-sm shadow-lg shadow-slate-200 dark:shadow-none">
                        {index + 1}
                      </div>
                      <span className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest">Unit Soal</span>
                      {q.type && q.type !== "pilihan_ganda" && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${q.type === "pilihan_ganda_kompleks" ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40" :
                          q.type === "benar_salah" ? "bg-green-50 text-green-600 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/40" :
                            q.type === "menjodohkan" ? "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/40" :
                              q.type === "isian_singkat" ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40" :
                                q.type === "uraian" ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40" :
                                  q.type === "urutkan" ? "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40" :
                                    q.type === "matriks" ? "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800/40" :
                                      q.type === "klasifikasi" ? "bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40" :
                                        q.type === "isian_rumpang" ? "bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950/30 dark:text-lime-400 dark:border-lime-800/40" :
                                          q.type === "hotspot" ? "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/40" :
                                            "bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800/40"
                          }`}>
                          {q.type === "pilihan_ganda_kompleks" ? "PG Kompleks" :
                            q.type === "benar_salah" ? "Benar/Salah" :
                              q.type === "menjodohkan" ? "Menjodohkan" :
                                q.type === "isian_singkat" ? "Isian Singkat" :
                                  q.type === "uraian" ? "Uraian" :
                                    q.type === "urutkan" ? "Urutkan" :
                                      q.type === "drag_drop" ? "Drag & Drop" :
                                        q.type === "matriks" ? "Matriks" :
                                          q.type === "klasifikasi" ? "Klasifikasi" :
                                            q.type === "isian_rumpang" ? "Isian Rumpang" :
                                              q.type === "hotspot" ? "Hotspot" : q.type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {q.isFromAI && role === "admin" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onAIRegenerateSingle(index)}
                          disabled={isRegeneratingIndex === index}
                          className={`h-8 w-8 rounded-xl transition-all ${isRegeneratingIndex === index ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600" : "text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600"}`}
                          title="Regenerasi butir soal ini saja"
                        >
                          <Sparkles className={`h-4 w-4 ${isRegeneratingIndex === index ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                      {batchQuestions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveBatchRow(index)}
                          className="h-8 w-8 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 rounded-xl transition-all"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pertanyaan Utama</p>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenMathGuide}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 text-xs font-semibold hover:bg-amber-100 transition-all shadow-sm"
                      >
                        <Sparkles className="w-3 h-3" />
                        Panduan Rumus
                      </button>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                      <ReactQuill
                        theme="snow"
                        value={q.text}
                        onChange={(content, _delta, source) => {
                          if (source !== 'user') return;
                          updateBatchItem(index, 'text', content);
                        }}
                        placeholder="Tuliskan pertanyaan disini..."
                        modules={quillModules}
                        formats={quillFormats}
                        className="font-serif [&_.ql-editor]:min-h-[80px] [&_.ql-editor]:py-3 [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:px-2 [&_.ql-toolbar]:py-1 [&_.ql-formats]:mr-1 text-sm"
                      />
                      <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/20 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl">
                        <div className="flex items-center gap-2 mb-2 opacity-60">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                          <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Pratinjau Live Render</p>
                        </div>
                        <MathText content={q.text} className="font-serif ql-editor !p-0 text-base text-slate-800 dark:text-slate-200 leading-relaxed [&_p]:mb-3" />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 px-1">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 cursor-pointer bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-xl py-2 px-3.5 border border-purple-200 dark:border-purple-800/50 font-bold text-xs transition-all shadow-sm"
                        onClick={() => {
                          onOpenGallery(index);
                        }}
                        title="Buka galeri sekolah atau arsip gambar dan sisipkan ke teks pertanyaan"
                      >
                        <Image className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Sisipkan Gambar (Galeri Sekolah)</span>
                      </button>
                    </div>
                  </div>

                  {(q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks" || q.type === "benar_salah") && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pilihan Jawaban & Kunci</p>
                      </div>
                      {/* Fallback: if benar_salah has no choices, create default */}
                      {q.type === "benar_salah" && (!q.choices || (!q.choices.a && !q.choices.b)) && (
                        <div className="flex flex-col gap-2.5">
                          {[{ letter: "a", text: "Benar" }, { letter: "b", text: "Salah" }].map(({ letter, text }) => {
                            const isCorrect = q.correctKey === letter;
                            return (
                              <div key={letter} className={`group relative flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300 ${isCorrect ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400" : "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800"}`}>
                                <button type="button" onClick={() => updateBatchItem(index, 'correctKey', letter)} className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all shadow-sm ${isCorrect ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-700 text-slate-400"}`}>{letter.toUpperCase()}</button>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{text}</span>
                                {isCorrect && <div className="bg-emerald-600 text-white p-1 rounded-lg ml-auto"><Check className="w-3 h-3" /></div>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Normal choices rendering */}
                      {(q.choices && (q.choices.a || q.choices.b)) && (
                        <div className="flex flex-col gap-2.5">
                          {['a', 'b', 'c', 'd', 'e'].map(letter => {
                            if (!q.choices?.[letter]) return null;
                            const isCorrect = q.type === "pilihan_ganda_kompleks"
                              ? (q.correctKey || "").split(",").map((k: string) => k.trim()).includes(letter)
                              : q.correctKey === letter;
                            return (
                              <div
                                key={letter}
                                className={`group relative flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300 ${isCorrect
                                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400 shadow-md shadow-emerald-100 dark:shadow-none"
                                  : "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                  }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (q.type === "pilihan_ganda_kompleks") {
                                      // Toggle: add/remove from comma-separated list
                                      const current = (q.correctKey || "").split(",").map((k: string) => k.trim()).filter(Boolean);
                                      const idx = current.indexOf(letter);
                                      if (idx >= 0) current.splice(idx, 1);
                                      else current.push(letter);
                                      updateBatchItem(index, 'correctKey', current.join(","));
                                    } else {
                                      updateBatchItem(index, 'correctKey', letter);
                                    }
                                  }}
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all shadow-sm ${isCorrect
                                    ? "bg-emerald-600 text-white shadow-emerald-200"
                                    : "bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                                    }`}
                                >
                                  {letter.toUpperCase()}
                                </button>
                                <div className="flex-1">
                                  <div className="w-full flex flex-col gap-1.5">
                                    <input
                                      type="text"
                                      placeholder={`Teks Pilihan ${letter.toUpperCase()}...`}
                                      value={q.choices[letter].text}
                                      onChange={(e) => updateBatchChoice(index, letter, e.target.value)}
                                      className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600 p-0"
                                    />
                                    {q.choices[letter].text && (
                                      <div className="mt-1.5 p-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 animate-in fade-in slide-in-from-top-1 duration-300">
                                        <div className="flex items-center gap-1.5 mb-1 opacity-50">
                                          <Sparkles className="w-3 h-3 text-indigo-500" />
                                          <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Preview Math</p>
                                        </div>
                                        <MathText
                                          key={q.choices[letter].text}
                                          content={q.choices[letter].text.startsWith('<') ? q.choices[letter].text : `<p>${q.choices[letter].text}</p>`}
                                          disableJustify={true}
                                          className="text-base font-serif ql-editor !p-0 cbt-choice-text text-left text-slate-800 dark:text-slate-200"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {isCorrect && (
                                  <div className="bg-emerald-600 text-white p-1 rounded-lg animate-in zoom-in-50 duration-300">
                                    <Check className="w-3 h-3" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {(q.type === "isian_singkat" || q.type === "uraian") && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          {q.type === "isian_singkat" ? "Kunci Jawaban" : "Pedoman Penilaian"}
                        </p>
                      </div>
                      <input
                        type="text"
                        placeholder={q.type === "isian_singkat" ? "Kunci Jawaban Singkat..." : "Pedoman Penilaian..."}
                        value={q.answerKey || ""}
                        onChange={(e) => updateBatchItem(index, 'answerKey', e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 focus:ring-1 focus:ring-amber-500 outline-none"
                      />
                    </div>
                  )}

                  {q.type === "menjodohkan" && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-purple-500 rounded-full"></div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pasangan (Kiri  Kanan)</p>
                      </div>
                      {(!q.pairs || q.pairs.length === 0) ? (
                        <div className="text-center py-4 text-xs text-slate-400 italic">
                          AI tidak menghasilkan pasangan. Tambahkan manual atau regenerasi.
                          <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => {
                            updateBatchItem(index, 'pairs', [
                              { id: "1", left: "", right: "" },
                              { id: "2", left: "", right: "" },
                              { id: "3", left: "", right: "" },
                              { id: "4", left: "", right: "" }
                            ]);
                          }}>+ Tambah 4 Pasangan</Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {q.pairs.map((pair: any, pIdx: number) => (
                            <div
                              key={pair.id || pIdx}
                              draggable
                              onDragStart={() => setBatchDragState({ questionIndex: index, itemIndex: pIdx })}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => {
                                if (!batchDragState || batchDragState.questionIndex !== index || batchDragState.itemIndex === pIdx) return;
                                const newPairs = [...q.pairs];
                                const temp = newPairs[batchDragState.itemIndex];
                                newPairs[batchDragState.itemIndex] = newPairs[pIdx];
                                newPairs[pIdx] = temp;
                                updateBatchItem(index, 'pairs', newPairs);
                                setBatchDragState(null);
                              }}
                              onDragEnd={() => setBatchDragState(null)}
                              className={`flex items-center gap-2 p-2 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-800/40 cursor-grab active:cursor-grabbing transition-opacity ${batchDragState?.questionIndex === index && batchDragState?.itemIndex === pIdx ? "opacity-50" : ""}`}
                            >
                              <GripVertical className="w-4 h-4 text-purple-300 flex-shrink-0" />
                              <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0">{pIdx + 1}</span>
                              <input
                                type="text"
                                value={pair.left}
                                onChange={(e) => {
                                  const updatedPairs = [...q.pairs];
                                  updatedPairs[pIdx] = { ...updatedPairs[pIdx], left: e.target.value };
                                  updateBatchItem(index, 'pairs', updatedPairs);
                                }}
                                className="flex-1 text-xs p-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-purple-500 outline-none"
                                placeholder="Item kiri..."
                              />
                              <Forward className="w-4 h-4 text-purple-400 flex-shrink-0" />
                              <input
                                type="text"
                                value={pair.right}
                                onChange={(e) => {
                                  const updatedPairs = [...q.pairs];
                                  updatedPairs[pIdx] = { ...updatedPairs[pIdx], right: e.target.value };
                                  updateBatchItem(index, 'pairs', updatedPairs);
                                }}
                                className="flex-1 text-xs p-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-purple-500 outline-none"
                                placeholder="Pasangan kanan..."
                              />
                              <button type="button" onClick={() => {
                                const newPairs = q.pairs.filter((_: any, i: number) => i !== pIdx);
                                updateBatchItem(index, 'pairs', newPairs);
                              }} className="text-red-300 hover:text-red-500 transition-colors flex-shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" className="text-xs text-purple-500" onClick={() => {
                            const newPairs = [...(q.pairs || []), { id: String((q.pairs?.length || 0) + 1), left: "", right: "" }];
                            updateBatchItem(index, 'pairs', newPairs);
                          }}>+ Tambah Pasangan</Button>
                        </div>
                      )}
                    </div>
                  )}

                  {(q.type === "urutkan" || q.type === "drag_drop") && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-6 ${q.type === "urutkan" ? "bg-orange-500" : "bg-cyan-500"} rounded-full`}></div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          {q.type === "urutkan" ? "Urutan Benar (atas  bawah)" : "Item (urutan benar)"}
                        </p>
                      </div>
                      {(!q.items || q.items.length === 0) ? (
                        <div className="text-center py-4 text-xs text-slate-400 italic">
                          AI tidak menghasilkan item. Tambahkan manual atau regenerasi.
                          <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => {
                            updateBatchItem(index, 'items', [
                              { id: "1", text: "" },
                              { id: "2", text: "" },
                              { id: "3", text: "" },
                              { id: "4", text: "" }
                            ]);
                          }}>+ Tambah 4 Item</Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {q.items.map((item: any, iIdx: number) => (
                            <div
                              key={item.id || iIdx}
                              draggable
                              onDragStart={() => setBatchDragState({ questionIndex: index, itemIndex: iIdx })}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => {
                                if (!batchDragState || batchDragState.questionIndex !== index || batchDragState.itemIndex === iIdx) return;
                                const newItems = [...q.items];
                                const temp = newItems[batchDragState.itemIndex];
                                newItems[batchDragState.itemIndex] = newItems[iIdx];
                                newItems[iIdx] = temp;
                                updateBatchItem(index, 'items', newItems);
                                setBatchDragState(null);
                              }}
                              onDragEnd={() => setBatchDragState(null)}
                              className={`flex items-center gap-2 p-2 rounded-xl cursor-grab active:cursor-grabbing transition-opacity ${q.type === "urutkan" ? "bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-800/40" : "bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-800/40"} ${batchDragState?.questionIndex === index && batchDragState?.itemIndex === iIdx ? "opacity-50" : ""}`}
                            >
                              <GripVertical className={`w-4 h-4 flex-shrink-0 ${q.type === "urutkan" ? "text-orange-300" : "text-cyan-300"}`} />
                              <span className={`w-6 h-6 rounded-lg ${q.type === "urutkan" ? "bg-orange-600" : "bg-cyan-600"} text-white flex items-center justify-center text-xs font-black flex-shrink-0`}>{iIdx + 1}</span>
                              <input
                                type="text"
                                value={item.text}
                                onChange={(e) => {
                                  const updatedItems = [...q.items];
                                  updatedItems[iIdx] = { ...updatedItems[iIdx], text: e.target.value };
                                  updateBatchItem(index, 'items', updatedItems);
                                }}
                                className={`flex-1 text-xs p-1.5 rounded-lg border ${q.type === "urutkan" ? "border-orange-200 dark:border-orange-800" : "border-cyan-200 dark:border-cyan-800"} bg-white dark:bg-slate-800 focus:ring-1 ${q.type === "urutkan" ? "focus:ring-orange-500" : "focus:ring-cyan-500"} outline-none`}
                                placeholder={`Item ${iIdx + 1}...`}
                              />
                              <button type="button" onClick={() => {
                                const newItems = q.items.filter((_: any, i: number) => i !== iIdx);
                                updateBatchItem(index, 'items', newItems);
                              }} className="text-red-300 hover:text-red-500 transition-colors flex-shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" className={`text-xs ${q.type === "urutkan" ? "text-orange-500" : "text-cyan-500"}`} onClick={() => {
                            const newItems = [...(q.items || []), { id: String((q.items?.length || 0) + 1), text: "" }];
                            updateBatchItem(index, 'items', newItems);
                          }}>+ Tambah Item</Button>
                        </div>
                      )}
                    </div>
                  )}

                  {q.type === "klasifikasi" && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-6 bg-violet-500 rounded-full"></div>
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            Klasifikasi (Kategori & Pernyataan)
                          </p>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.shuffleStatements !== false}
                            onChange={(e) => updateBatchItem(index, 'shuffleStatements', e.target.checked)}
                            className="rounded accent-violet-600 w-3.5 h-3.5"
                          />
                          Acak Urutan
                        </label>
                      </div>

                      {/* Categories */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Kategori Pilihan
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {(q.categories || []).map((cat: any, cIdx: number) => (
                            <div key={cat.id || cIdx} className="flex items-center gap-1 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50 rounded-xl px-2 py-1">
                              <input
                                type="text"
                                value={cat.text}
                                onChange={(e) => {
                                  const newCats = [...(q.categories || [])];
                                  newCats[cIdx] = { ...newCats[cIdx], text: e.target.value };
                                  updateBatchItem(index, 'categories', newCats);
                                }}
                                placeholder={`Kategori ${cIdx + 1}`}
                                className="text-xs font-bold bg-transparent outline-none text-violet-800 dark:text-violet-300 w-28"
                              />
                              {(q.categories || []).length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newCats = (q.categories || []).filter((_: any, i: number) => i !== cIdx);
                                    updateBatchItem(index, 'categories', newCats);
                                  }}
                                  className="text-violet-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const newCats = [...(q.categories || [])];
                              const newId = `c${newCats.length + 1}`;
                              newCats.push({ id: newId, text: "" });
                              updateBatchItem(index, 'categories', newCats);
                            }}
                            className="text-xs text-violet-600 font-bold px-2.5 py-1 rounded-xl border border-dashed border-violet-300 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/20"
                          >
                            + Kategori
                          </button>
                        </div>
                      </div>

                      {/* Statements */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Daftar Pernyataan & Kunci Kategori
                        </span>
                        {(!q.statements || q.statements.length === 0) ? (
                          <div className="text-center py-3 text-xs text-slate-400 italic">
                            Belum ada pernyataan.
                            <Button variant="outline" size="sm" className="ml-2 text-xs" onClick={() => {
                              const firstCatId = q.categories?.[0]?.id || "c1";
                              updateBatchItem(index, 'statements', [
                                { id: "s1", text: "", answer: firstCatId },
                                { id: "s2", text: "", answer: firstCatId }
                              ]);
                            }}>+ Tambah 2 Pernyataan</Button>
                          </div>
                        ) : (
                          q.statements.map((st: any, sIdx: number) => (
                            <div key={st.id || sIdx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                              <span className="w-6 h-6 rounded-lg bg-violet-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0">
                                {sIdx + 1}
                              </span>
                              <input
                                type="text"
                                value={st.text}
                                onChange={(e) => {
                                  const newSts = [...(q.statements || [])];
                                  newSts[sIdx] = { ...newSts[sIdx], text: e.target.value };
                                  updateBatchItem(index, 'statements', newSts);
                                }}
                                placeholder={`Pernyataan ${sIdx + 1}...`}
                                className="flex-1 text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-violet-500"
                              />
                              <select
                                value={st.answer}
                                onChange={(e) => {
                                  const newSts = [...(q.statements || [])];
                                  newSts[sIdx] = { ...newSts[sIdx], answer: e.target.value };
                                  updateBatchItem(index, 'statements', newSts);
                                }}
                                className="text-xs font-bold p-1.5 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 text-violet-800 dark:text-violet-300 outline-none max-w-[140px]"
                              >
                                {(q.categories || []).map((cat: any) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.text || `Kategori ${cat.id}`}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  const newSts = (q.statements || []).filter((_: any, i: number) => i !== sIdx);
                                  updateBatchItem(index, 'statements', newSts);
                                }}
                                className="text-red-300 hover:text-red-500 transition-colors flex-shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-violet-600 font-bold"
                          onClick={() => {
                            const newSts = [...(q.statements || [])];
                            const firstCatId = q.categories?.[0]?.id || "c1";
                            newSts.push({ id: `s${newSts.length + 1}`, text: "", answer: firstCatId });
                            updateBatchItem(index, 'statements', newSts);
                          }}
                        >
                          + Tambah Pernyataan
                        </Button>
                      </div>
                    </div>
                  )}

                  {q.type === "matriks" && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-teal-500 rounded-full"></div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          Matriks (Kolom Pilihan & Pernyataan)
                        </p>
                      </div>

                      {/* Columns */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Kolom Pilihan (Opsi Matriks)
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {(q.columns || []).map((col: any, cIdx: number) => (
                            <div key={col.id || cIdx} className="flex items-center gap-1 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50 rounded-xl px-2 py-1">
                              <input
                                type="text"
                                value={col.text}
                                onChange={(e) => {
                                  const newCols = [...(q.columns || [])];
                                  newCols[cIdx] = { ...newCols[cIdx], text: e.target.value };
                                  updateBatchItem(index, 'columns', newCols);
                                }}
                                placeholder={`Kolom ${cIdx + 1}`}
                                className="text-xs font-bold bg-transparent outline-none text-teal-800 dark:text-teal-300 w-24"
                              />
                              {(q.columns || []).length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newCols = (q.columns || []).filter((_: any, i: number) => i !== cIdx);
                                    updateBatchItem(index, 'columns', newCols);
                                  }}
                                  className="text-teal-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const newCols = [...(q.columns || [])];
                              const newId = `c${newCols.length + 1}`;
                              newCols.push({ id: newId, text: "" });
                              updateBatchItem(index, 'columns', newCols);
                            }}
                            className="text-xs text-teal-600 font-bold px-2.5 py-1 rounded-xl border border-dashed border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/20"
                          >
                            + Kolom
                          </button>
                        </div>
                      </div>

                      {/* Statements */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Daftar Pernyataan & Kunci Pilihan
                        </span>
                        {(!q.statements || q.statements.length === 0) ? (
                          <div className="text-center py-3 text-xs text-slate-400 italic">
                            Belum ada baris pernyataan matriks.
                            <Button variant="outline" size="sm" className="ml-2 text-xs" onClick={() => {
                              const firstColId = q.columns?.[0]?.id || "c1";
                              updateBatchItem(index, 'statements', [
                                { id: "s1", text: "", answer: firstColId },
                                { id: "s2", text: "", answer: firstColId }
                              ]);
                            }}>+ Tambah 2 Pernyataan</Button>
                          </div>
                        ) : (
                          q.statements.map((st: any, sIdx: number) => (
                            <div key={st.id || sIdx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                              <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0">
                                {sIdx + 1}
                              </span>
                              <input
                                type="text"
                                value={st.text}
                                onChange={(e) => {
                                  const newSts = [...(q.statements || [])];
                                  newSts[sIdx] = { ...newSts[sIdx], text: e.target.value };
                                  updateBatchItem(index, 'statements', newSts);
                                }}
                                placeholder={`Pernyataan ${sIdx + 1}...`}
                                className="flex-1 text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-teal-500"
                              />
                              <select
                                value={st.answer}
                                onChange={(e) => {
                                  const newSts = [...(q.statements || [])];
                                  newSts[sIdx] = { ...newSts[sIdx], answer: e.target.value };
                                  updateBatchItem(index, 'statements', newSts);
                                }}
                                className="text-xs font-bold p-1.5 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20 text-teal-800 dark:text-teal-300 outline-none max-w-[140px]"
                              >
                                {(q.columns || []).map((col: any) => (
                                  <option key={col.id} value={col.id}>
                                    {col.text || `Kolom ${col.id}`}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  const newSts = (q.statements || []).filter((_: any, i: number) => i !== sIdx);
                                  updateBatchItem(index, 'statements', newSts);
                                }}
                                className="text-red-300 hover:text-red-500 transition-colors flex-shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-teal-600 font-bold"
                          onClick={() => {
                            const newSts = [...(q.statements || [])];
                            const firstColId = q.columns?.[0]?.id || "c1";
                            newSts.push({ id: `s${newSts.length + 1}`, text: "", answer: firstColId });
                            updateBatchItem(index, 'statements', newSts);
                          }}
                        >
                          + Tambah Pernyataan
                        </Button>
                      </div>
                    </div>
                  )}

                  {q.type === "isian_rumpang" && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-6 bg-lime-500 rounded-full"></div>
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            Kunci Jawaban Isian Rumpang
                          </p>
                        </div>
                        <span className="text-[11px] text-lime-700 dark:text-lime-400 bg-lime-50 dark:bg-lime-950/30 px-2 py-0.5 rounded-full border border-lime-200 dark:border-lime-800">
                          Format teks: [[1]], [[2]], dst.
                        </span>
                      </div>

                      {(!q.blanks || q.blanks.length === 0) ? (
                        <div className="text-center py-3 text-xs text-slate-400 italic">
                          Belum ada kunci rumpang. Tambahkan manual atau pastikan teks pertanyaan berisi tanda [[1]].
                          <Button variant="outline" size="sm" className="ml-2 text-xs" onClick={() => {
                            updateBatchItem(index, 'blanks', [
                              { id: "1", answers: [""], caseSensitive: false }
                            ]);
                          }}>+ Tambah Kunci Rumpang [[1]]</Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {q.blanks.map((b: any, bIdx: number) => (
                            <div key={b.id || bIdx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                              <span className="px-2 py-1 rounded-lg bg-lime-100 dark:bg-lime-950/40 text-lime-800 dark:text-lime-300 text-xs font-black border border-lime-200 dark:border-lime-800/40 font-mono flex-shrink-0">
                                [[{b.id}]]
                              </span>
                              <input
                                type="text"
                                value={Array.isArray(b.answers) ? b.answers.join(", ") : (b.answersText || "")}
                                onChange={(e) => {
                                  const answers = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                                  const newBlanks = [...(q.blanks || [])];
                                  newBlanks[bIdx] = { ...newBlanks[bIdx], answers, answersText: e.target.value };
                                  updateBatchItem(index, 'blanks', newBlanks);
                                }}
                                placeholder="Jawaban diterima (pisahkan koma bila lebih dari 1)..."
                                className="flex-1 text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-lime-500"
                              />
                              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 cursor-pointer select-none px-1">
                                <input
                                  type="checkbox"
                                  checked={!!b.caseSensitive}
                                  onChange={(e) => {
                                    const newBlanks = [...(q.blanks || [])];
                                    newBlanks[bIdx] = { ...newBlanks[bIdx], caseSensitive: e.target.checked };
                                    updateBatchItem(index, 'blanks', newBlanks);
                                  }}
                                  className="rounded accent-lime-600 w-3.5 h-3.5"
                                />
                                Case-sensitive
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const newBlanks = (q.blanks || []).filter((_: any, i: number) => i !== bIdx);
                                  updateBatchItem(index, 'blanks', newBlanks);
                                }}
                                className="text-red-300 hover:text-red-500 transition-colors flex-shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-lime-600 font-bold"
                            onClick={() => {
                              const newBlanks = [...(q.blanks || [])];
                              const nextId = String(newBlanks.length + 1);
                              newBlanks.push({ id: nextId, answers: [""], caseSensitive: false });
                              updateBatchItem(index, 'blanks', newBlanks);
                            }}
                          >
                            + Tambah Kunci Rumpang
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div className="flex justify-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={handleAddBatchRow} className="rounded-xl flex items-center gap-1 text-slate-600 dark:text-slate-400 text-xs h-9">
                  <Plus className="h-3.5 w-3.5" /> Tambah Manual
                </Button>
                {(role === "admin" || (role === "teacher" && (user?.ai_api_key || teacherAIAccess))) && batchQuestions.some(q => q.isFromAI) && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onOpenAIModal}
                      className="rounded-xl flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-xs h-9"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Ubah Pengaturan
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onAIGenerateDirect}
                      disabled={isAIGeneratingDirect}
                      className="rounded-xl flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs h-9"
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${isAIGeneratingDirect ? "animate-spin" : ""}`} />
                      {isAIGeneratingDirect ? "Generasi..." : "Regenerasi Langsung"}
                    </Button>
                  </>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</Button>
              <Button onClick={onSaveBatch} disabled={isSavingBatch} className="bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/20 text-blue-700 font-semibold">
                {isSavingBatch ? (importProgress > 0 ? `Menyimpan ${importProgress}%` : "Menyimpan...") : `Simpan ${batchQuestions.length} Soal`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


  );
};
