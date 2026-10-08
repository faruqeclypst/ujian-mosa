import re

with open(r"D:\PROJECT\ujian\src\pages\admin\QuestionsPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# find the block between {/* MODAL GENERASI AI */} and {/* Smart AI Import Dialog */}
start_marker = "{/* MODAL GENERASI AI */}"
end_marker = "{/* Smart AI Import Dialog */}"

new_modal = """{/* MODAL GENERASI AI */}
        <Dialog open={isAIModalOpen} onOpenChange={setIsAIModalOpen}>
          <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border border-slate-200/60 dark:border-slate-800/60 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] bg-white dark:bg-slate-900">
            {/* Header dengan efek glow */}
            <div className="relative px-6 py-5 overflow-hidden border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/50 dark:from-indigo-950/20 dark:via-slate-900 dark:to-purple-950/20">
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-48 h-48 bg-purple-400/20 dark:bg-purple-600/20 rounded-full blur-3xl opacity-60 mix-blend-multiply dark:mix-blend-lighten pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-40 h-40 bg-indigo-400/20 dark:bg-indigo-600/20 rounded-full blur-3xl opacity-60 mix-blend-multiply dark:mix-blend-lighten pointer-events-none"></div>
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-50 dark:ring-indigo-900/20">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                      AI Studio Generator <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-[9px] text-indigo-700 dark:text-indigo-400 font-bold uppercase tracking-wider">Beta</span>
                    </DialogTitle>
                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <Wand2 className="w-3.5 h-3.5 text-purple-500" />
                      Powered by <span className="font-bold text-slate-700 dark:text-slate-300">{AI_MODELS.find((m: any) => m.id === activeAIConfig.model)?.name || activeAIConfig.model}</span>
                    </p>
                  </div>
                </div>
                <button type="button" onClick={handleRandomFill} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-500/20">
                  <RefreshCw className="w-3.5 h-3.5" /> Isi Otomatis
                </button>
              </div>
            </div>

            <div className="px-6 py-6 max-h-[65vh] overflow-y-auto scrollbar-thin">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Kolom Kiri: Konteks & Materi */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50"></div> Konteks Soal
                    </h4>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Jenjang / Kelas</label>
                        <Input value={aiLevel} onChange={(e) => setAiLevel(e.target.value)} placeholder="Contoh: SMA Kelas 11" className="h-10 rounded-xl text-xs bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 transition-colors shadow-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mata Pelajaran</label>
                        <Input value={aiSubject} onChange={(e) => setAiSubject(e.target.value)} placeholder="Contoh: Biologi" className="h-10 rounded-xl text-xs bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 transition-colors shadow-sm" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Topik Pembahasan</label>
                      <div className="flex gap-2 group">
                        <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="Fotosintesis, Metabolisme..." className="flex-1 h-10 rounded-xl text-xs bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 transition-colors shadow-sm" />
                        <button type="button" onClick={handleGenerateTopic} disabled={isGeneratingTopic} className="shrink-0 h-10 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all disabled:opacity-50 border border-indigo-100 dark:border-indigo-500/20 shadow-sm flex items-center justify-center gap-1.5" title="Minta saran topik dari AI">
                          {isGeneratingTopic ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        </button>
                      </div>
                      {dynamicSuggestions.length > 0 && !isFetchingSuggestions && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {dynamicSuggestions.map((s, i) => (
                            <button key={i} type="button" onClick={() => setAiTopic(String(s))} className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm">{String(s)}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></div> Referensi Materi <span className="font-bold normal-case text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded ml-1 text-[9px]">Opsional</span>
                    </h4>
                    <div className="space-y-2.5">
                      {aiMaterialFileName ? (
                        <div className="flex items-center gap-3 p-3 bg-emerald-50/80 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 truncate">{aiMaterialFileName}</p>
                            <p className="text-[9px] text-emerald-600/70 dark:text-emerald-500/70 font-semibold mt-0.5">{Math.round(aiMaterialText.length / 1000)}k karakter disematkan</p>
                          </div>
                          <button onClick={() => { setAiMaterialFile(null); setAiMaterialText(""); setAiMaterialFileName(""); }} className="w-7 h-7 rounded-lg hover:bg-emerald-200/50 dark:hover:bg-emerald-800/50 flex items-center justify-center text-emerald-700 dark:text-emerald-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-2.5 px-4 py-5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-all group bg-slate-50/30 dark:bg-slate-800/30">
                          <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform group-hover:border-indigo-200 dark:group-hover:border-indigo-700">
                            <Plus className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                          </div>
                          <div className="text-center">
                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">{isExtractingMaterial ? "Mengekstrak Teks..." : "Upload PDF, Word, atau PPT"}</p>
                            <p className="text-[9px] font-medium text-slate-400 mt-0.5">Atau paste teks langsung di bawah</p>
                          </div>
                          <input type="file" className="hidden" accept=".pdf,.docx,.docm,.pptx,.ppt,.png,.jpg,.jpeg" onChange={handleAIMaterialUpload} disabled={isExtractingMaterial} />
                        </label>
                      )}
                      
                      <div className="relative">
                        <textarea value={aiMaterialText} onChange={(e) => setAiMaterialText(e.target.value.substring(0, 4000))} placeholder="Paste teks materi atau artikel di sini..." className="w-full min-h-[90px] p-3.5 pb-7 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs resize-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400 transition-all shadow-sm focus:bg-white dark:focus:bg-slate-900" />
                        {aiMaterialText && <p className="absolute bottom-2.5 right-3 text-[10px] font-bold text-slate-400">{aiMaterialText.length}/4000</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kolom Kanan: Pengaturan Output */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></div> Format Output
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tipe Soal</label>
                        <select value={aiType} onChange={(e) => setAiType(e.target.value)} className="w-full h-10 px-3 rounded-xl text-xs font-bold bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-700 dark:text-slate-200 shadow-sm focus:bg-white dark:focus:bg-slate-900 transition-colors">
                          {allowedTypes.pilihan_ganda && <option value="pilihan_ganda">Pilihan Ganda</option>}
                          {allowedTypes.pilihan_ganda_kompleks && <option value="pilihan_ganda_kompleks">PG Kompleks</option>}
                          {allowedTypes.benar_salah && <option value="benar_salah">Benar / Salah</option>}
                          {allowedTypes.menjodohkan && <option value="menjodohkan">Menjodohkan</option>}
                          {allowedTypes.isian_singkat && <option value="isian_singkat">Isian Singkat</option>}
                          {allowedTypes.urutkan && <option value="urutkan">Mengurutkan</option>}
                          {allowedTypes.drag_drop && <option value="drag_drop">Drag & Drop</option>}
                          {allowedTypes.uraian && <option value="uraian">Uraian / Essay</option>}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Jumlah Soal</label>
                        <div className="flex items-center h-10 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-xl px-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all shadow-sm focus-within:bg-white dark:focus-within:bg-slate-900">
                          <button onClick={() => setAiCount(Math.max(1, aiCount - 1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 font-black text-sm transition-colors">-</button>
                          <input type="number" value={aiCount || ""} onChange={(e) => setAiCount(e.target.value === "" ? 1 : parseInt(e.target.value, 10) || 1)} className="flex-1 text-center bg-transparent font-black text-slate-800 dark:text-white outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                          <button onClick={() => setAiCount(Math.min(20, aiCount + 1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 font-black text-sm transition-colors">+</button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 bg-slate-50/50 dark:bg-slate-800/30 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Taksonomi Bloom</label>
                        <span className="text-[10px] font-semibold text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded shadow-sm">Level Kognitif</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([['lots', 'LOTS (C1-C3)'], ['campuran', 'Mix'], ['hots', 'HOTS (C4-C6)']] as [string, string][]).map(([key, label]) => (
                          <button key={key} onClick={() => setTaxonomyPreset(key as "lots" | "hots" | "campuran")} className={`py-2 rounded-xl text-[10px] font-bold transition-all shadow-sm ${getTaxonomyPreset() === key ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-400 border border-slate-300 dark:border-slate-600 ring-1 ring-indigo-500/20' : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent bg-slate-100/50 dark:bg-slate-800/50'}`}>{label}</button>
                        ))}
                      </div>
                      <div className="grid grid-cols-6 gap-1 pt-1.5">
                        {(['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] as string[]).map((c) => (
                          <button key={c} onClick={() => toggleTaxonomy(c)} className={`py-1.5 rounded-lg text-[10px] font-black transition-all border ${aiTaxonomy.includes(c) ? 'bg-indigo-500 text-white border-indigo-600 shadow-sm shadow-indigo-500/30' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}>{c}</button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tingkat Kesulitan</label>
                         <div className="grid grid-cols-3 gap-1 bg-slate-50/80 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                           {['mudah', 'sedang', 'sulit'].map((d) => (
                             <button key={d} onClick={() => setAiDifficulty(d)} className={`py-2 rounded-lg text-[10px] font-bold capitalize transition-all shadow-sm ${aiDifficulty === d ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600' : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent'}`}>{d}</button>
                           ))}
                         </div>
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            Mode Literasi
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={isAiLiteracy} onChange={(e) => setIsAiLiteracy(e.target.checked)} />
                              <div className="w-8 h-4.5 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                         </label>
                         <div className="h-[38px] flex items-center px-3 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                            <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Buat Teks Bacaan</span>
                         </div>
                      </div>
                    </div>
                  </div>

                  {(aiObjectives.length > 0 || isFetchingObjectives) && (
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40 shadow-sm relative overflow-hidden">
                      <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-400/10 rounded-full blur-2xl"></div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                           <Target className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-blue-800 dark:text-blue-300">Indikator Pembelajaran</p>
                        {isFetchingObjectives && <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin ml-auto" />}
                      </div>
                      {aiObjectives.length > 0 && (
                        <ul className="space-y-2 relative z-10">
                          {aiObjectives.map((obj, idx) => {
                            const cMatch = obj.match(/^(C[1-6])\\s*[:\\-]/);
                            const cLevel = cMatch ? cMatch[1] : "";
                            const text = cMatch ? obj.replace(/^C[1-6]\\s*[:\\-]\\s*/, "") : obj;
                            return (
                              <li key={idx} className="flex items-start gap-2.5 text-[11px] font-medium leading-relaxed text-blue-950/80 dark:text-blue-200/80">
                                {cLevel ? <span className="shrink-0 px-2 py-0.5 rounded-md bg-white dark:bg-blue-900/60 shadow-sm border border-blue-100 dark:border-blue-800/50 text-[9px] font-black mt-0.5 text-blue-700 dark:text-blue-300">{cLevel}</span> : <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></div>}
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

            {/* Footer */}
            <div className="px-6 py-5 bg-slate-50/80 dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800 flex flex-col gap-3">
              {(isAIGenerating && aiProgress > 0) ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2 tracking-tight">
                      <Sparkles className="w-4 h-4 animate-pulse text-purple-500" />
                      {aiProgress < 40 ? "Merancang kerangka soal terstruktur..." : aiProgress < 80 ? "Memproses konteks & validasi keilmuan..." : "Menyusun format JSON akhir..."} <span className="text-slate-400 ml-1 font-medium text-[10px]">({aiProgress}%)</span>
                    </span>
                    <button onClick={cancelAIGeneration} className="text-[11px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> Batalkan</button>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner p-0.5">
                    <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-300 relative bg-[length:200%_auto] animate-gradient" style={{ width: `${aiProgress}%` }}>
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="hidden sm:flex items-center gap-2.5 max-w-[280px]">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                      Proses akan memakan waktu <span className="font-bold text-slate-700 dark:text-slate-300">beberapa detik</span> karena AI merakit seluruh JSON secara akurat & paralel di belakang layar.
                    </p>
                  </div>
                  <div className="flex gap-2.5 w-full sm:w-auto ml-auto">
                    <Button variant="ghost" onClick={() => setIsAIModalOpen(false)} className="rounded-xl text-xs font-bold px-5 h-11 hover:bg-slate-200/50 dark:hover:bg-slate-800">Batal</Button>
                    <Button onClick={handleAIGenerate} disabled={isAIGenerating || !aiTopic.trim()} className="flex-1 sm:flex-none rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-xl shadow-indigo-500/25 text-xs font-black px-6 h-11 gap-2 border-0 group overflow-hidden relative">
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                      <Wand2 className="w-4 h-4 relative z-10" />
                      <span className="relative z-10">Generate {aiCount} Soal</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
"""

content = content.replace(content[content.find(start_marker):content.find(end_marker)], new_modal)

with open(r"D:\PROJECT\ujian\src\pages\admin\QuestionsPage.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Modal replaced successfully")
