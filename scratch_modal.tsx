        {/* MODAL GENERASI AI */}
        <Dialog open={isAIModalOpen} onOpenChange={setIsAIModalOpen}>
          <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <DialogTitle className="text-sm font-bold text-slate-900 dark:text-white">Generate Soal</DialogTitle>
                <p className="text-[10px] text-slate-400 mt-0.5">{AI_MODELS.find((m: any) => m.id === activeAIConfig.model)?.name || activeAIConfig.model}</p>
              </div>
              <button type="button" onClick={handleRandomFill} className="text-[10px] font-medium text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                <RefreshCw className="w-3 h-3" /> Isi Contoh
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Jenjang / Kelas</label>
                  <Input value={aiLevel} onChange={(e) => setAiLevel(e.target.value)} placeholder="SMA Kelas 11" className="h-10 rounded-lg text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Mata Pelajaran</label>
                  <Input value={aiSubject} onChange={(e) => setAiSubject(e.target.value)} placeholder="Informatika" className="h-10 rounded-lg text-xs" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Topik</label>
                <div className="flex gap-2">
                  <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="Jaringan Komputer, Fotosintesis..." className="flex-1 h-10 rounded-lg text-xs" />
                  <button type="button" onClick={handleGenerateTopic} disabled={isGeneratingTopic} className="shrink-0 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all disabled:opacity-50" title="Generate topik otomatis">
                    {isGeneratingTopic ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {dynamicSuggestions.length > 0 && !isFetchingSuggestions && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {dynamicSuggestions.map((s, i) => (
                      <button key={i} type="button" onClick={() => setAiTopic(String(s))} className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">{String(s)}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bahan Materi (upload/paste) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Bahan Materi <span className="font-normal text-slate-400">(opsional)</span></label>
                  {aiMaterialFileName && (
                    <button
                      onClick={() => { setAiMaterialFile(null); setAiMaterialText(""); setAiMaterialFileName(""); }}
                      className="text-[10px] text-rose-500 hover:text-rose-600 font-medium"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                {aiMaterialFileName ? (
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-[10px] font-medium text-slate-600 truncate flex-1">{aiMaterialFileName}</span>
                    <span className="text-[9px] text-slate-400">{Math.round(aiMaterialText.length / 1000)}k</span>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 cursor-pointer hover:border-indigo-300 hover:bg-slate-50 transition-all">
                    <Plus className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] text-slate-500">{isExtractingMaterial ? "Mengekstrak..." : "Upload Word, PDF, PPT, atau Gambar"}</span>
                    <input type="file" className="hidden" accept=".pdf,.docx,.docm,.pptx,.ppt,.png,.jpg,.jpeg" onChange={handleAIMaterialUpload} disabled={isExtractingMaterial} />
                  </label>
                )}

                <textarea value={aiMaterialText} onChange={(e) => setAiMaterialText(e.target.value.substring(0, 4000))} placeholder="Atau paste materi di sini (dari buku, artikel, modul)..." className="w-full min-h-[56px] p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-[11px] resize-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400" />
                {aiMaterialText && <p className="text-[9px] text-slate-400 text-right">{aiMaterialText.length}/4000</p>}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Tipe Soal</label>
                  <select value={aiType} onChange={(e) => setAiType(e.target.value)} className="w-full h-10 px-3 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500 outline-none">
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
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Jumlah Soal</label>
                  <div className="flex items-center h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3">
                    <button onClick={() => setAiCount(Math.max(1, aiCount - 1))} className="text-slate-400 hover:text-slate-700 font-bold text-sm">-</button>
                    <input type="number" value={aiCount || ""} onChange={(e) => setAiCount(e.target.value === "" ? 1 : parseInt(e.target.value, 10) || 1)} className="flex-1 text-center bg-transparent font-bold text-slate-800 dark:text-white outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <button onClick={() => setAiCount(Math.min(10, aiCount + 1))} className="text-slate-400 hover:text-slate-700 font-bold text-sm">+</button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Kesulitan</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  {['mudah', 'sedang', 'sulit'].map((d) => (
                    <button key={d} onClick={() => setAiDifficulty(d)} className={`py-2 rounded-md text-[10px] font-semibold capitalize transition-all ${aiDifficulty === d ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400'}`}>{d}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Taksonomi Bloom</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  {([['lots', 'LOTS (C1-C3)'], ['campuran', 'Campuran'], ['hots', 'HOTS (C4-C6)']] as [string, string][]).map(([key, label]) => (
                    <button key={key} onClick={() => setTaxonomyPreset(key as "lots" | "hots" | "campuran")} className={`py-2 rounded-md text-[10px] font-semibold transition-all ${getTaxonomyPreset() === key ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400'}`}>{label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {(['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] as string[]).map((c) => (
                    <button key={c} onClick={() => toggleTaxonomy(c)} className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${aiTaxonomy.includes(c) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}>{c}</button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-400">{aiTaxonomy.sort().map(c => { const l: Record<string, string> = { C1: "Mengingat", C2: "Memahami", C3: "Menerapkan", C4: "Menganalisis", C5: "Mengevaluasi", C6: "Mencipta" }; return `${c}: ${l[c]}`; }).join(" · ")}</p>
              </div>

              {(aiObjectives.length > 0 || isFetchingObjectives) && (
                <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Indikator Soal</p>
                    {isFetchingObjectives && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
                  </div>
                  {aiObjectives.length > 0 && (
                    <ul className="space-y-1.5">
                      {aiObjectives.map((obj, idx) => {
                        const cMatch = obj.match(/^(C[1-6])\s*[:\-]/);
                        const cLevel = cMatch ? cMatch[1] : "";
                        const text = cMatch ? obj.replace(/^C[1-6]\s*[:\-]\s*/, "") : obj;
                        return (
                          <li key={idx} className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                            {cLevel && <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[8px] font-bold mt-0.5">{cLevel}</span>}
                            <span>{text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Mode Literasi</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">{aiMaterialText ? "Buat stimulus dari materi, lalu soal." : "Buat teks bacaan sebelum soal."}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={isAiLiteracy} onChange={(e) => setIsAiLiteracy(e.target.checked)} />
                  <div className="w-9 h-5 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {isAiLiteracy && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Panjang Stimulus</label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    {['pendek', 'sedang', 'panjang'].map((len) => (
                      <button key={len} type="button" onClick={() => setAiPassageLength(len)} className={`py-2 rounded-md text-[10px] font-semibold capitalize transition-all ${aiPassageLength === len ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400'}`}>{len}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
              {(isAIGenerating && aiProgress > 0) ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-600">Generating... {aiProgress}%</span>
                    <button onClick={cancelAIGeneration} className="text-[10px] font-medium text-rose-500 hover:text-rose-600">Batalkan</button>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${aiProgress}%` }} />
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setIsAIModalOpen(false)} className="rounded-lg text-xs font-medium">Batal</Button>
                  <Button onClick={handleAIGenerate} disabled={isAIGenerating || !aiTopic.trim()} className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold h-10">Generate {aiCount} Soal</Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
