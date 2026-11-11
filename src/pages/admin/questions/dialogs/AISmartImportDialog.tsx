import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../../components/ui/dialog";
import { Button } from "../../../../components/ui/button";
import { Select } from "../../../../components/ui/select";
import { MathText } from "../../../../components/ui/MathText";
import {
  FileText,
  Plus,
  Sparkles,
  BookOpen,
  Check,
  Forward,
  FileJson,
} from "lucide-react";

export interface AISmartImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedResults: any[];
  setParsedResults: (results: any[]) => void;
  importMode: "extract" | "generate" | "json";
  setImportMode: (mode: "extract" | "generate" | "json") => void;
  importCount: number;
  setImportCount: (count: number) => void;
  importType: string;
  setImportType: (type: string) => void;
  importText: string;
  setImportText: (text: string) => void;
  isParsing: boolean;
  importProgress: number;
  aiProgress: number;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAIParse: () => void;
  handleSaveAIImport: () => void;
  cancelAIGeneration: () => void;
}

export const AISmartImportDialog: React.FC<AISmartImportDialogProps> = ({
  open,
  onOpenChange,
  parsedResults,
  setParsedResults,
  importMode,
  setImportMode,
  importCount,
  setImportCount,
  importType,
  setImportType,
  importText,
  setImportText,
  isParsing,
  importProgress,
  aiProgress,
  handleFileUpload,
  handleAIParse,
  handleSaveAIImport,
  cancelAIGeneration,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white dark:bg-slate-900 max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
        <DialogHeader className="p-6 pb-2 border-b border-slate-100 dark:border-slate-800">
          {parsedResults.length > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Hasil Ekstraksi Cerdas</h3>
                <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/40">{parsedResults.length} Butir</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setParsedResults([])} className="h-8 text-xs font-black uppercase text-slate-400 hover:text-rose-500 transition-colors">Ulangi Proses</Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/40 shadow-sm">
                <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">{importMode === 'json' ? 'Import JSON' : 'Smart AI Import'}</DialogTitle>
                <p className="text-xs text-slate-500 font-medium tracking-tight">{importMode === 'json' ? 'Tempel data JSON, langsung diproses tanpa AI.' : 'Tempel teks dari PDF/Word, biarkan AI yang merapikannya.'}</p>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6 scrollbar-thin">
          {parsedResults.length === 0 ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Mode Selection */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-fit">
                <button
                  onClick={() => setImportMode('extract')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${importMode === 'extract'
                    ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  Ekstraksi Soal (Detect)
                </button>
                <button
                  onClick={() => setImportMode('generate')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${importMode === 'generate'
                    ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  Buat dari Materi (Gen)
                </button>
                <button
                  onClick={() => setImportMode('json')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${importMode === 'json'
                    ? "bg-white dark:bg-slate-700 text-orange-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  Import JSON
                </button>
              </div>

              {importMode === 'generate' && (
                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-slate-400">Jumlah Soal</label>
                    <Select value={importCount.toString()} onChange={(e) => setImportCount(parseInt(e.target.value))}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <option key={n} value={n.toString()}>{n} Soal</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-slate-400">Tipe Soal</label>
                    <Select value={importType} onChange={(e) => setImportType(e.target.value)}>
                      <option value="pilihan_ganda">Pilihan Ganda</option>
                      <option value="pilihan_ganda_kompleks">Ganda Kompleks</option>
                      <option value="benar_salah">Benar / Salah</option>
                      <option value="menjodohkan">Menjodohkan</option>
                      <option value="isian_singkat">Isian Singkat</option>
                      <option value="urutkan">Mengurutkan</option>
                      <option value="drag_drop">Drag & Drop</option>
                      <option value="uraian">Uraian / Essay</option>
                      <option value="klasifikasi">Klasifikasi</option>
                      <option value="matriks">Matriks (Tabel)</option>
                      <option value="isian_rumpang">Isian Rumpang</option>
                    </Select>
                  </div>
                </div>
              )}

              {importMode !== 'json' && (
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <label className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-emerald-200 dark:border-emerald-800/40 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/10 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all group">
                      <Plus className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Pilih File PDF / Word</span>
                      <input type="file" className="hidden" accept=".pdf,.docx,.docm" onChange={handleFileUpload} disabled={isParsing} />
                    </label>
                  </div>
                  <div className="text-slate-400 text-xs font-bold">ATAU</div>
                  <div className="flex-1 text-xs text-slate-500 font-medium italic">
                    {importMode === 'extract' ? "Tempel soal-soal mentah di bawah ini" : "Tempel materi bacaan/artikel di bawah ini"}
                  </div>
                </div>
              )}

              <div className="p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100/50 dark:border-blue-800/40 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-24 h-24 text-blue-600" />
                </div>
                <div className="flex gap-4 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-800 dark:text-blue-300">Cara Menggunakan:</p>
                    <ul className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1.5 space-y-1.5 list-none">
                      {importMode === 'extract' ? (
                        <>
                          <li className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
                            <span>Salin seluruh naskah soal dari Word/PDF (Ctrl+A {'->'} Ctrl+C).</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
                            <span>Tempel di kotak bawah. AI akan mendeteksi puluhan soal sekaligus secara otomatis.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                            <span>Tinjau hasil deteksi, lalu klik "Simpan" untuk memasukkannya ke sistem.</span>
                          </li>
                        </>
                      ) : importMode === 'json' ? (
                        <>
                          <li className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-800 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
                            <span>Tempel data JSON hasil export atau buat manual sesuai format.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-800 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
                            <span>Klik "Parse JSON" - tidak memerlukan AI, langsung diproses.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-800 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                            <span>Format: {`[{"text":"...","choices":{"a":{"text":"...","isCorrect":true},...},"answerKey":"a"}]`}</span>
                          </li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
                            <span>Tempelkan materi pelajaran, artikel, atau bacaan apa saja.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
                            <span>Tentukan jumlah soal, lalu klik tombol "Buat Soal" di bawah.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                            <span>Soal-soal baru akan muncul dan siap disimpan ke bank soal.</span>
                          </li>
                        </>
                      )}
                      <li className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                        <span>Teks stimulus / literasi pembuka akan otomatis dipisahkan (Mode Literasi).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-800 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">4</span>
                        <span>Mendukung rumus Matematika (LaTeX), potongan kode program, soal Isian & Uraian.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="relative group">
                <textarea
                  className="w-full h-[400px] p-6 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-mono focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none shadow-inner"
                  placeholder={importMode === 'json' ? '[{"text":"Pertanyaan...","choices":{"a":{"text":"Jawaban A","isCorrect":true},"b":{"text":"Jawaban B","isCorrect":false}},"answerKey":"a"}]' : "Contoh: Buatkan 5 soal literasi tentang ekosistem laut... atau tempelkan naskah soal Anda di sini."}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                {!importText && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                    <div className="text-center">
                      <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-400">Isi perintah anda / masukkan materi / soal yang sudah jadi untuk dimasukkan ke aplikasi secara cepat</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-4 pb-6">
                {parsedResults.map((q, idx) => (
                  <div key={idx} className="p-4 sm:p-6 border border-slate-200/60 dark:border-slate-800 rounded-2xl bg-card hover:border-indigo-200 dark:hover:border-indigo-900/40 transition-colors shadow-sm">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-400 shrink-0">
                        {idx + 1}
                      </div>
                      <div className="space-y-4 flex-1">
                        {q.groupText && (
                          <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/20 border-l-4 border-indigo-500 rounded-r-2xl mb-2">
                            <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                              <Plus className="w-3 h-3" /> Literasi / Stimulus Khusus
                            </p>
                            <MathText content={q.groupText} className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium line-clamp-4 italic" />
                          </div>
                        )}
                        <MathText content={q.text} className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-normal" />
                        {q.imageUrl && (
                          <div className="my-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 max-w-sm bg-slate-50 dark:bg-slate-900">
                            <img src={q.imageUrl} alt="Gambar Soal" className="w-full max-h-48 object-contain" />
                          </div>
                        )}
                        {/* Type badge */}
                        {q.type && q.type !== "pilihan_ganda" && (
                          <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${q.type === "pilihan_ganda_kompleks" ? "bg-blue-50 text-blue-600 border-blue-200" :
                            q.type === "benar_salah" ? "bg-green-50 text-green-600 border-green-200" :
                              q.type === "menjodohkan" ? "bg-purple-50 text-purple-600 border-purple-200" :
                                q.type === "isian_singkat" ? "bg-amber-50 text-amber-600 border-amber-200" :
                                  q.type === "uraian" ? "bg-rose-50 text-rose-600 border-rose-200" :
                                    q.type === "urutkan" ? "bg-orange-50 text-orange-600 border-orange-200" :
                                      "bg-cyan-50 text-cyan-600 border-cyan-200"
                            }`}>
                            {q.type === "pilihan_ganda_kompleks" ? "PG Kompleks" :
                              q.type === "benar_salah" ? "Benar/Salah" :
                                q.type === "menjodohkan" ? "Menjodohkan" :
                                  q.type === "isian_singkat" ? "Isian Singkat" :
                                    q.type === "uraian" ? "Uraian" :
                                      q.type === "urutkan" ? "Urutkan" :
                                        q.type === "drag_drop" ? "Drag & Drop" : q.type}
                          </span>
                        )}
                        {/* Statements (benar_salah tabel matriks) */}
                        {q.statements && q.statements.length > 0 && (
                          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs mt-2">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Pernyataan</th>
                                  <th className="w-24 px-4 py-3 text-center text-xs font-semibold text-emerald-600 uppercase tracking-wide">Kunci</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {q.statements.map((s: any, sIdx: number) => (
                                  <tr key={s.id || sIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                                      <span className="font-bold mr-1.5 text-slate-400">{sIdx + 1}.</span>
                                      <MathText content={s.text} disableJustify={true} className="inline !p-0 [&_p]:inline" />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${s.answer === "benar" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"}`}>
                                        {s.answer || "benar"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {/* Choices (pilihan ganda, atau benar/salah legacy tanpa statements) */}
                        {(!q.statements || q.statements.length === 0) && q.choices && Object.keys(q.choices).length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2">
                            {Object.entries(q.choices).map(([key, val]: [string, any]) => (
                              <div key={key} className={`p-2.5 rounded-xl border flex items-center gap-3 transition-all ${val.isCorrect ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black uppercase shrink-0 ${val.isCorrect ? 'bg-emerald-500 text-white shadow-md' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-800'}`}>
                                  {key}
                                </div>
                                <MathText content={val.text} className="text-xs font-semibold" />
                                {val.isCorrect && <Check className="w-3.5 h-3.5 ml-auto text-emerald-500 stroke-[3px]" />}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Pairs (menjodohkan) */}
                        {q.pairs && q.pairs.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {q.pairs.map((p: any, pIdx: number) => (
                              <div key={p.id || pIdx} className="flex items-center gap-2 p-2 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-800/40">
                                <span className="w-5 h-5 rounded bg-purple-600 text-white flex items-center justify-center text-xs font-black shrink-0">{pIdx + 1}</span>
                                <span className="flex-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{p.left}</span>
                                <Forward className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <span className="flex-1 text-xs font-bold text-purple-600 dark:text-purple-400">{p.right}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Items (urutkan / drag_drop) */}
                        {q.items && q.items.length > 0 && (
                          <div className="space-y-1.5 mt-2">
                            {q.items.map((item: any, iIdx: number) => (
                              <div key={item.id || iIdx} className={`flex items-center gap-2 p-2 rounded-xl ${q.type === "urutkan" ? "bg-orange-50/50 border border-orange-100" : "bg-cyan-50/50 border border-cyan-100"}`}>
                                <span className={`w-5 h-5 rounded ${q.type === "urutkan" ? "bg-orange-600" : "bg-cyan-600"} text-white flex items-center justify-center text-xs font-black shrink-0`}>{iIdx + 1}</span>
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Answer key (isian singkat / uraian) */}
                        {(q.type === "isian_singkat" || q.type === "uraian") && q.answerKey && (
                          <div className="mt-2 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                            <p className="text-xs font-black text-amber-500 uppercase tracking-widest mb-1">{q.type === "isian_singkat" ? "Kunci Jawaban" : "Pedoman Penilaian"}</p>
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{q.answerKey}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-slate-50/50 dark:bg-slate-900/40 gap-3">
          {parsedResults.length === 0 ? (
            <Button
              onClick={handleAIParse}
              disabled={isParsing || !importText.trim()}
              className={`w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-sm transition-all active:scale-95 ${importMode === 'json'
                ? "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200/50"
                : importMode === 'extract'
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200/50"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200/50"
                }`}
            >
              {isParsing ? (
                <div className="flex flex-col items-center gap-2 w-full py-1">
                  <div className="flex items-center justify-between w-full px-2">
                    <span className="text-xs font-black uppercase tracking-widest">
                      {importMode === 'extract' ? "Memilah..." : "Membangun..."} {aiProgress}%
                    </span>
                    <button onClick={cancelAIGeneration} className="px-3 py-1 rounded-lg bg-white/20 text-xs font-bold border border-white/30 hover:bg-white/30 transition-colors">
                      Batalkan
                    </button>
                  </div>
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full transition-all duration-300 ease-out" style={{ width: `${aiProgress}%` }} />
                  </div>
                </div>
              ) : (
                <>
                  {importMode === 'json' ? <FileJson className="mr-2 h-5 w-5" /> : <Sparkles className="mr-2 h-5 w-5" />}
                  {importMode === 'json' ? "Parse JSON Sekarang" : importMode === 'extract' ? "Analisis Dokumen Sekarang" : "Buat Soal dari Materi Sekarang"}
                </>
              )}
            </Button>
          ) : (
            <div className="flex gap-4 w-full">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-14 rounded-2xl font-bold uppercase text-xs tracking-widest border border-slate-200 dark:border-slate-800 hover:bg-slate-100 transition-all font-black"
              >
                Batal
              </Button>
              <Button
                onClick={handleSaveAIImport}
                disabled={isParsing}
                className="flex-[2] h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-sm shadow-indigo-200/50 dark:shadow-none transition-all active:scale-95"
              >
                {isParsing ? (
                  importProgress > 0 ? `Menyimpan ${importProgress}%` : "Sedang Menyimpan..."
                ) : (
                  <>
                    <Check className="mr-2 h-5 w-5" />
                    Simpan Semuanya ke Bank Soal
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

