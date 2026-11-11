import React from "react";
import { Dialog, DialogContent, DialogTitle } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { NeonButton } from "../../../../components/ui/NeonButton";
import {
  Sparkles,
  Wand2,
  RefreshCw,
  FileText,
  X,
  Plus,
  BookOpen,
  Target,
  Info,
} from "lucide-react";

export interface AIGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeAIConfig: any;
  AI_MODELS: any[];
  handleRandomFill: () => void;
  aiLevel: string;
  setAiLevel: (val: string) => void;
  aiSubject: string;
  setAiSubject: (val: string) => void;
  aiTopic: string;
  setAiTopic: (val: string) => void;
  handleGenerateTopic: () => void;
  isGeneratingTopic: boolean;
  dynamicSuggestions: any[];
  isFetchingSuggestions: boolean;
  aiMaterialFileName: string;
  aiMaterialText: string;
  setAiMaterialFile: (file: any) => void;
  setAiMaterialText: (val: string) => void;
  setAiMaterialFileName: (val: string) => void;
  handleAIMaterialUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isExtractingMaterial: boolean;
  aiType: string;
  setAiType: (val: string) => void;
  allowedTypes: Record<string, boolean>;
  aiCount: number;
  setAiCount: (val: number) => void;
  getTaxonomyPreset: () => string;
  setTaxonomyPreset: (preset: "lots" | "hots" | "campuran") => void;
  toggleTaxonomy: (c: string) => void;
  aiTaxonomy: string[];
  aiDifficulty: string;
  setAiDifficulty: (val: string) => void;
  isAiLiteracy: boolean;
  setIsAiLiteracy: (val: boolean) => void;
  aiPassageLength: string;
  setAiPassageLength: (val: string) => void;
  aiObjectives: string[];
  isFetchingObjectives: boolean;
  isAIGenerating: boolean;
  aiProgress: number;
  cancelAIGeneration: () => void;
  handleAIGenerate: () => void;
}

export const AIGenerateDialog: React.FC<AIGenerateDialogProps> = ({
  open,
  onOpenChange,
  activeAIConfig,
  AI_MODELS,
  handleRandomFill,
  aiLevel,
  setAiLevel,
  aiSubject,
  setAiSubject,
  aiTopic,
  setAiTopic,
  handleGenerateTopic,
  isGeneratingTopic,
  dynamicSuggestions,
  isFetchingSuggestions,
  aiMaterialFileName,
  aiMaterialText,
  setAiMaterialFile,
  setAiMaterialText,
  setAiMaterialFileName,
  handleAIMaterialUpload,
  isExtractingMaterial,
  aiType,
  setAiType,
  allowedTypes,
  aiCount,
  setAiCount,
  getTaxonomyPreset,
  setTaxonomyPreset,
  toggleTaxonomy,
  aiTaxonomy,
  aiDifficulty,
  setAiDifficulty,
  isAiLiteracy,
  setIsAiLiteracy,
  aiPassageLength,
  setAiPassageLength,
  aiObjectives,
  isFetchingObjectives,
  isAIGenerating,
  aiProgress,
  cancelAIGeneration,
  handleAIGenerate,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-2xl bg-white dark:bg-neutral-850">
        {/* Header Neon */}
        <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shadow-2xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                  AI Studio Generator
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold uppercase tracking-wider">
                    Beta
                  </span>
                </DialogTitle>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mt-0.5">
                  <Wand2 className="w-3.5 h-3.5 text-emerald-500" />
                  Powered by <span className="font-semibold text-neutral-700 dark:text-neutral-300">{AI_MODELS.find((m: any) => m.id === activeAIConfig.model)?.name || activeAIConfig.model}</span>
                </p>
              </div>
            </div>
            <NeonButton
              type="button"
              variant="secondary"
              size="xs"
              onClick={handleRandomFill}
              icon={<RefreshCw className="w-3 h-3" />}
            >
              Isi Otomatis
            </NeonButton>
          </div>
        </div>

        <div className="px-6 py-6 max-h-[65vh] overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Kolom Kiri: Konteks & Materi */}
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Konteks Soal
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Jenjang / Kelas</label>
                    <Input value={aiLevel} onChange={(e) => setAiLevel(e.target.value)} placeholder="Contoh: SMA Kelas 11" className="h-9 rounded-lg text-xs bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-neutral-900 dark:text-neutral-100 shadow-2xs" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Mata Pelajaran</label>
                    <Input value={aiSubject} onChange={(e) => setAiSubject(e.target.value)} placeholder="Contoh: Biologi" className="h-9 rounded-lg text-xs bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-neutral-900 dark:text-neutral-100 shadow-2xs" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Topik Pembahasan</label>
                  <div className="flex gap-2 group">
                    <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="Fotosintesis, Metabolisme..." className="flex-1 h-9 rounded-lg text-xs bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-neutral-900 dark:text-neutral-100 shadow-2xs" />
                    <button type="button" onClick={handleGenerateTopic} disabled={isGeneratingTopic} className="shrink-0 h-9 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/60 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer" title="Minta saran topik dari AI">
                      {isGeneratingTopic ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {dynamicSuggestions.length > 0 && !isFetchingSuggestions && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {dynamicSuggestions.map((s, i) => (
                        <button key={i} type="button" onClick={() => setAiTopic(String(s))} className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-2xs cursor-pointer">{String(s)}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Referensi Materi <span className="font-semibold normal-case text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md ml-1 text-[11px]">Opsional</span>
                </h4>
                <div className="space-y-2.5">
                  {aiMaterialFileName ? (
                    <div className="flex items-center gap-3 p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40 shadow-2xs">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 truncate">{aiMaterialFileName}</p>
                        <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-0.5">{Math.round(aiMaterialText.length / 1000)}k karakter disematkan</p>
                      </div>
                      <button onClick={() => { setAiMaterialFile(null); setAiMaterialText(""); setAiMaterialFileName(""); }} className="w-7 h-7 rounded-lg hover:bg-emerald-200/50 dark:hover:bg-emerald-800/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2.5 px-4 py-5 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all group bg-neutral-50/50 dark:bg-neutral-900/30">
                      <div className="w-9 h-9 rounded-full bg-white dark:bg-neutral-800 shadow-2xs border border-neutral-200 dark:border-neutral-700 flex items-center justify-center group-hover:scale-105 transition-transform group-hover:border-emerald-300 dark:group-hover:border-emerald-600">
                        <Plus className="w-4 h-4 text-neutral-400 group-hover:text-emerald-600 transition-colors" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{isExtractingMaterial ? "Mengekstrak Teks..." : "Upload PDF, Word, atau PPT"}</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Atau paste teks langsung di bawah</p>
                      </div>
                      <input type="file" className="hidden" accept=".pdf,.docx,.docm,.pptx,.ppt,.png,.jpg,.jpeg" onChange={handleAIMaterialUpload} disabled={isExtractingMaterial} />
                    </label>
                  )}

                  <div className="relative">
                    <textarea value={aiMaterialText} onChange={(e) => setAiMaterialText(e.target.value.substring(0, 4000))} placeholder="Paste teks materi atau artikel di sini..." className="w-full min-h-[90px] p-3 pb-7 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-xs resize-none text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 transition-all shadow-2xs" />
                    {aiMaterialText && <p className="absolute bottom-2.5 right-3 text-[10px] font-mono text-neutral-400">{aiMaterialText.length}/4000</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Pengaturan Output */}
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Format Output
                </h4>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Tipe Soal</label>
                    <select value={aiType} onChange={(e) => setAiType(e.target.value)} className="w-full h-9 px-2.5 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-neutral-800 dark:text-neutral-200 shadow-2xs transition-colors cursor-pointer">
                      {allowedTypes.pilihan_ganda && <option value="pilihan_ganda">Pilihan Ganda</option>}
                      {allowedTypes.pilihan_ganda_kompleks && <option value="pilihan_ganda_kompleks">PG Kompleks</option>}
                      {allowedTypes.benar_salah && <option value="benar_salah">Benar / Salah</option>}
                      {allowedTypes.menjodohkan && <option value="menjodohkan">Menjodohkan</option>}
                      {allowedTypes.isian_singkat && <option value="isian_singkat">Isian Singkat</option>}
                      {allowedTypes.urutkan && <option value="urutkan">Mengurutkan</option>}
                      {allowedTypes.drag_drop && <option value="drag_drop">Drag & Drop</option>}
                      {allowedTypes.uraian && <option value="uraian">Uraian / Essay</option>}
                      {allowedTypes.klasifikasi && <option value="klasifikasi">Klasifikasi</option>}
                      {allowedTypes.matriks && <option value="matriks">Matriks (Tabel Pernyataan)</option>}
                      {allowedTypes.isian_rumpang && <option value="isian_rumpang">Isian Rumpang</option>}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Jumlah Soal</label>
                    <div className="flex items-center h-9 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-1.5 focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all shadow-2xs">
                      <button onClick={() => setAiCount(Math.max(1, aiCount - 1))} className="w-6 h-6 flex items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-bold text-xs transition-colors cursor-pointer">-</button>
                      <input type="number" value={aiCount || ""} onChange={(e) => setAiCount(e.target.value === "" ? 1 : parseInt(e.target.value, 10) || 1)} className="flex-1 text-center bg-transparent font-bold text-neutral-900 dark:text-neutral-100 outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      <button onClick={() => setAiCount(Math.min(20, aiCount + 1))} className="w-6 h-6 flex items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-bold text-xs transition-colors cursor-pointer">+</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4 bg-neutral-50/70 dark:bg-neutral-900/50 p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Taksonomi Bloom</label>
                    <span className="text-[10px] font-semibold text-neutral-400 bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 shadow-2xs">Level Kognitif</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([['lots', 'LOTS (C1-C3)'], ['campuran', 'Mix'], ['hots', 'HOTS (C4-C6)']] as [string, string][]).map(([key, label]) => (
                      <button key={key} onClick={() => setTaxonomyPreset(key as "lots" | "hots" | "campuran")} className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${getTaxonomyPreset() === key ? 'bg-emerald-600 text-white shadow-2xs font-bold' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-750'}`}>{label}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-6 gap-1 pt-1.5">
                    {(['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] as string[]).map((c) => (
                      <button key={c} onClick={() => toggleTaxonomy(c)} className={`py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${aiTaxonomy.includes(c) ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-emerald-400'}`}>{c}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Tingkat Kesulitan</label>
                    <div className="grid grid-cols-3 gap-1 bg-neutral-100/80 dark:bg-neutral-900/60 p-1 rounded-lg border border-neutral-200/80 dark:border-neutral-800">
                      {['mudah', 'sedang', 'sulit'].map((d) => (
                        <button key={d} onClick={() => setAiDifficulty(d)} className={`py-1.5 rounded-md text-xs font-medium capitalize transition-all cursor-pointer ${aiDifficulty === d ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 shadow-2xs font-bold' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800'}`}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                      Mode Literasi
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={isAiLiteracy} onChange={(e) => setIsAiLiteracy(e.target.checked)} />
                        <div className="w-8 h-4.5 bg-neutral-200 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </label>
                    {isAiLiteracy ? (
                      <div className="grid grid-cols-3 gap-1 bg-neutral-100/80 dark:bg-neutral-900/60 p-1 rounded-lg border border-neutral-200/80 dark:border-neutral-800 h-[34px]">
                        {['pendek', 'sedang', 'panjang'].map((len) => (
                          <button key={len} type="button" onClick={() => setAiPassageLength(len)} className={`rounded-md text-xs font-medium capitalize transition-all cursor-pointer ${aiPassageLength === len ? 'bg-emerald-600 text-white shadow-2xs font-bold' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800'}`}>{len}</button>
                        ))}
                      </div>
                    ) : (
                      <div className="h-[34px] flex items-center px-2.5 bg-neutral-50 dark:bg-neutral-900/40 rounded-lg border border-neutral-200/80 dark:border-neutral-800">
                        <span className="text-xs font-medium text-neutral-500 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Buat Teks Bacaan</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(aiObjectives.length > 0 || isFetchingObjectives) && (
                <div className="p-3.5 bg-neutral-50/70 dark:bg-neutral-900/50 rounded-xl border border-neutral-200/80 dark:border-neutral-800 shadow-2xs">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Target className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">Indikator Pembelajaran</p>
                    {isFetchingObjectives && <RefreshCw className="w-3.5 h-3.5 text-neutral-400 animate-spin ml-auto" />}
                  </div>
                  {aiObjectives.length > 0 && (
                    <ul className="space-y-2">
                      {aiObjectives.map((obj, idx) => {
                        const cMatch = obj.match(/^(C[1-6])\s*[:\-]/);
                        const cLevel = cMatch ? cMatch[1] : "";
                        const text = cMatch ? obj.replace(/^C[1-6]\s*[:\-]\s*/, "") : obj;
                        return (
                          <li key={idx} className="flex items-start gap-2 text-xs font-normal leading-relaxed text-neutral-700 dark:text-neutral-300">
                            {cLevel ? <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{cLevel}</span> : <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>}
                            <span>{text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Footer Neon */}
        <div className="px-6 py-4 bg-neutral-50/60 dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-neutral-800 flex flex-col gap-3">
          {(isAIGenerating && aiProgress > 0) ? (
            <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-pulse text-emerald-500" />
                  {aiProgress < 40 ? "Merancang kerangka soal terstruktur..." : aiProgress < 80 ? "Memproses konteks & validasi keilmuan..." : "Menyusun format JSON akhir..."} <span className="text-neutral-400 ml-1 font-mono text-xs font-medium">({aiProgress}%)</span>
                </span>
                <button onClick={cancelAIGeneration} className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer"><X className="w-3.5 h-3.5" /> Batalkan</button>
              </div>
              <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden p-0.5">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${aiProgress}%` }}></div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="hidden sm:flex items-center gap-2.5 max-w-[290px]">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Info className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                  Proses berlangsung beberapa detik karena AI merakit seluruh JSON secara akurat & tervalidasi.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
                <NeonButton variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                  Batal
                </NeonButton>
                <NeonButton
                  variant="primary"
                  size="sm"
                  onClick={handleAIGenerate}
                  disabled={isAIGenerating || !aiTopic.trim()}
                  loading={isAIGenerating}
                  icon={<Wand2 className="w-3.5 h-3.5" />}
                >
                  Generate {aiCount} Soal
                </NeonButton>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

