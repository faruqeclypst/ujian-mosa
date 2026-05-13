import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";
import {
  Loader2,
  Sparkles,
  Info,
  Trophy,
  GraduationCap,
  ShieldCheck,
  BrainCircuit,
  AlertCircle,
  LayoutGrid,
  Library
} from "lucide-react";
import { motion } from "framer-motion";
import {
  QUESTIONS,
  MI_QUESTIONS,
  JURUSAN_DATA,
  KELOMPOK_MAPEL,
  KEDINASAN_INFO,
  RIASEC_TO_KELOMPOK
} from "../../lib/riasec";
import { useTenant } from "../../context/TenantContext";
import { Button } from "../ui/button";

interface StudentInterestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
}

const StudentInterestDialog = ({ isOpen, onClose, studentId, studentName }: StudentInterestDialogProps) => {
  const { pb } = useTenant();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (isOpen && studentId) {
      const fetchData = async () => {
        if (!pb) return;
        setLoading(true);
        try {
          const record = await pb.collection("student_interests").getFirstListItem(`studentId="${studentId}"`, {
            sort: "-created",
          });
          setData(record);
        } catch (err) {
          console.error("Gagal mengambil data minat bakat:", err);
          setData(null);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen, studentId]);

  let accuracyVal = 100;
  if (data) {
    if (data.accuracy !== undefined && data.accuracy !== null) {
      accuracyVal = data.accuracy;
    } else if (data.answers) {
      let inconsistentCount = 0;
      Object.entries(data.answers).forEach(([id, val]) => {
        const qIdNum = Number(id);
        const riasecQ = QUESTIONS.find((q: any) => q.id === qIdNum);
        if (riasecQ?.isNegative && (val as number) > 2) inconsistentCount++;
        else {
          const miQ = MI_QUESTIONS.find((q: any) => q.id === qIdNum);
          if (miQ?.isNegative && (val as number) > 2) inconsistentCount++;
        }
      });
      accuracyVal = Math.round(Math.max(0, 100 - (inconsistentCount * 7.14)));
    }
  }

  const accuracyColor = accuracyVal >= 80 ? 'text-emerald-600' : accuracyVal >= 50 ? 'text-yellow-600' : 'text-rose-600';

  const miLabels: Record<string, string> = {
    LIN: "Linguistik", LOG: "Logis-Matematis", SPA: "Visual-Spasial",
    KIN: "Kinestetik", MUS: "Musikal", "INT-R": "Interpersonal",
    "INT-A": "Intrapersonal", NAT: "Naturalis"
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1200px] w-[95vw] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl max-h-[90vh] flex flex-col bg-[#f8fafc] text-slate-800 font-sans tracking-tight" hideClose>

        {/* Header - Fixed */}
        <DialogHeader className="px-6 py-4 lg:px-10 lg:py-6 bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">
                Hasil Analisis Minat Bakat
              </DialogTitle>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">{studentName}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose} className="h-10 w-10 rounded-full hover:bg-rose-50 hover:text-rose-600 shrink-0">
            <span className="sr-only">Tutup</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </Button>
        </DialogHeader>

        {/* Content - Scrollable */}
        <div className="p-4 lg:p-8 overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-20">
              <div className="w-56 h-1.5 bg-slate-200 rounded-full overflow-hidden relative">
                <motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }} className="absolute inset-0 bg-indigo-500 rounded-full" />
              </div>
              <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase italic">Memuat Data...</p>
            </div>
          ) : data ? (
            <div className="max-w-[1400px] mx-auto">
              {/* PERSONALIZED HEADER - LIGHT */}
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="inline-flex items-center gap-2">
                    {accuracyVal >= 70 ? (
                      <>
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Analisis Selesai</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600">Analisis Perlu Validasi</span>
                      </>
                    )}
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 uppercase leading-tight">
                    {studentName}
                  </h1>
                  <div className="flex items-center gap-4 text-slate-600 font-bold tracking-widest uppercase text-xs">
                    <span>ID: {studentId.slice(-6).toUpperCase()}</span>
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-10">
                  <div className="group cursor-default">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                      Konsistensi <Info className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-all cursor-help text-emerald-500" />
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl font-black ${accuracyColor}`}>{accuracyVal}</span>
                      <span className="text-xs font-bold text-slate-300">%</span>
                    </div>
                  </div>
                  <div className="cursor-default">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Profil Holland</p>
                    <p className="text-3xl font-black text-slate-900">{data.hollandCode}</p>
                  </div>
                </motion.div>
              </div>

              {(() => {
                const resultContent = JURUSAN_DATA[data.category];
                if (!resultContent) return <div className="py-20 text-center">Loading Content...</div>;

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* DOMINANT TRAIT - BIG HERO CARD */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`lg:col-span-12 p-8 md:p-12 rounded-[2.5rem] bg-gradient-to-br ${resultContent.bgGradient} relative overflow-hidden group shadow-2xl shadow-slate-200/50 flex flex-col md:flex-row justify-between gap-10 hover:shadow-emerald-500/10 transition-all duration-500`}
                    >
                      <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none translate-x-1/4 -translate-y-1/4 group-hover:translate-x-1/3 transition-transform duration-1000 scale-150">
                        <resultContent.icon className="w-full h-full" />
                      </div>

                      <div className="relative z-10 flex-1 flex flex-col justify-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-2xl rounded-xl mb-6 border border-white/30 shadow-sm w-max">
                          <Trophy className="h-4 w-4 text-yellow-300" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-white">Profil Dominan</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight tracking-tight uppercase">{resultContent.title}</h2>
                        <p className="text-white/90 text-lg md:text-xl font-medium max-w-2xl leading-relaxed italic border-l-4 border-white/20 pl-6 mb-2">
                          "{resultContent.desc}"
                        </p>
                      </div>

                      <div className="relative z-10 flex flex-col justify-center gap-8 md:w-1/3 md:border-l md:border-white/20 md:pl-10">
                        <div className="space-y-4">
                          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70 flex items-center gap-2">
                            <Sparkles className="h-3 w-3" /> Kompetensi Utama
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {resultContent.keySkills.map((s, i) => (
                              <span key={i} className="px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-2xl text-[11px] font-bold text-white border border-white/20 uppercase tracking-tight hover:bg-white/20 transition-colors cursor-default">{s}</span>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70 flex items-center gap-2">
                            <GraduationCap className="h-3 w-3" /> Jalur Pendidikan
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {(() => {
                              let topMI = data.topMI;
                              if (!topMI || topMI.length === 0) {
                                topMI = Object.entries(data.miScores || {})
                                  .sort(([, a], [, b]) => (b as number) - (a as number))
                                  .slice(0, 3)
                                  .map(([type]) => type);
                              }

                              const allRecs = [...resultContent.recommendations];

                              if (topMI.includes('LIN')) {
                                allRecs.sort((a, b) => {
                                  const aIsLin = a.includes('Guru') || a.includes('Hukum') || a.includes('Sosiologi') || a.includes('Komunikasi');
                                  const bIsLin = b.includes('Guru') || b.includes('Hukum') || b.includes('Sosiologi') || b.includes('Komunikasi');
                                  return aIsLin === bIsLin ? 0 : aIsLin ? -1 : 1;
                                });
                              } else if (topMI.includes('NAT') || topMI.includes('LOG')) {
                                allRecs.sort((a, b) => {
                                  const aIsScience = a.includes('Dokter') || a.includes('Keperawatan') || a.includes('Farmasi') || a.includes('Teknik');
                                  const bIsScience = b.includes('Dokter') || b.includes('Keperawatan') || b.includes('Farmasi') || b.includes('Teknik');
                                  return aIsScience === bIsScience ? 0 : aIsScience ? -1 : 1;
                                });
                              }

                              return allRecs.slice(0, 4).map((r, i) => (
                                <span key={i} className="px-5 py-2.5 bg-white/20 rounded-2xl text-[11px] font-bold text-white border border-white/20 transition-all hover:bg-white/40 cursor-default hover:scale-105">{r}</span>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* THE TRIO ROW: KEDINASAN | PAKET KELAS | COGNITIVE MAP */}
                    {/* KEDINASAN - LIGHT */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="lg:col-span-4 p-8 rounded-[2rem] bg-white border border-slate-200/60 flex flex-col justify-between shadow-xl shadow-slate-200/30 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-rose-500/5 rounded-2xl">
                          <ShieldCheck className="h-6 w-6 text-rose-600" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-1">Jalur Elite</h4>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">KEDINASAN</p>
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-1 gap-3">
                        {(() => {
                          const topRiasec = data.hollandCode[0];
                          const items = KEDINASAN_INFO.items.filter(item => item.riasec?.includes(topRiasec)).slice(0, 2);

                          if (items.length === 0) {
                            return (
                              <div className="flex flex-col items-center justify-center p-5 text-center h-full space-y-2 bg-slate-50/50 rounded-2xl border border-slate-100 border-dashed">
                                <span className="text-2xl opacity-40">🎯</span>
                                <p className="text-xs font-bold text-slate-500 leading-relaxed">
                                  Kamu lebih optimal berkembang di jalur Profesional/Reguler dibandingkan jalur Kedinasan.
                                </p>
                              </div>
                            );
                          }

                          return items.map((item, i) => (
                            <div key={i} className="group/item p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-rose-500/30 transition-all hover:bg-white hover:shadow-lg hover:shadow-rose-500/5">
                              <div className="flex justify-between items-start mb-1">
                                <h4 className="text-base font-black text-slate-900 leading-none tracking-tight italic group-hover:text-rose-600 transition-colors">{item.singkatan}</h4>
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-600 border border-rose-200">{item.kategori}</span>
                              </div>
                              <p className="text-[11px] font-bold text-slate-700 leading-tight mb-1">{item.nama}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mb-3 line-clamp-1">{item.instansi}</p>
                              <div className="flex flex-wrap gap-1">
                                {item.mapelKunci.slice(0, 2).map((m, j) => (
                                  <span key={j} className="px-2 py-0.5 bg-white rounded-md text-[10px] font-black text-slate-500 border border-slate-100">{m}</span>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </motion.div>

                    {/* PAKET KELAS - LIGHT */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="lg:col-span-4 p-8 rounded-[2rem] bg-white border border-slate-200/60 flex flex-col justify-between shadow-xl shadow-slate-200/30 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group"
                    >
                      {(() => {
                        const mapping = RIASEC_TO_KELOMPOK[data.category];
                        const primary = KELOMPOK_MAPEL[mapping?.primary];
                        if (!primary) return null;
                        return (
                          <>
                            <div className="flex items-center gap-4 mb-6">
                              <div className="p-3 bg-blue-500/5 rounded-2xl">
                                <Library className="h-6 w-6 text-blue-600" />
                              </div>
                              <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 italic leading-none mb-1">Paket Rekom</h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">KURIKULUM MERDEKA</p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className={`p-6 rounded-[2rem] bg-gradient-to-br ${primary.bgClass} text-white shadow-lg relative overflow-hidden group/pkg flex flex-col justify-center min-h-[160px]`}>
                                <span className="absolute -bottom-4 -right-4 text-7xl opacity-10 group-hover/pkg:scale-110 transition-transform duration-700">{primary.emoji}</span>
                                <div className="relative z-10">
                                  <h4 className="text-xl font-black tracking-tighter uppercase italic leading-none mb-1">{primary.nama}</h4>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-4">{primary.fokus}</p>
                                  <div className="flex flex-wrap gap-1">
                                    {primary.mapel.map((m, i) => (
                                      <span key={i} className="px-2 py-0.5 bg-black/10 rounded-md text-[10px] font-black border border-white/10">{m}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3 px-1">
                                <div>
                                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Jurusan Populer</h5>
                                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                                    {primary.jurusan.slice(0, 6).map((j, i) => (
                                      <div key={i} className="flex items-center gap-1.5">
                                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                                        <span className="text-[11px] font-bold text-slate-700">{j}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Prospek Karir</h5>
                                  <div className="flex flex-wrap gap-2">
                                    {primary.profesi.slice(0, 4).map((p, i) => (
                                      <span key={i} className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">#{p}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </motion.div>

                    {/* COGNITIVE MAP - LIGHT */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="lg:col-span-4 p-8 rounded-[2rem] bg-white border border-slate-200/60 flex flex-col justify-between shadow-xl shadow-slate-200/30 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-emerald-500/5 rounded-2xl">
                          <BrainCircuit className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-1">Peta Kognitif</h4>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">DIMENSI MI</p>
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-1 gap-3">
                        {Object.entries(data.miScores || {}).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 6).map(([mi, score], idx) => (
                          <div key={mi} className="space-y-1 group/mi">
                            <div className="flex justify-between items-center px-1">
                              <span className={`text-xs font-black uppercase tracking-tight ${idx < 3 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {miLabels[mi]}
                              </span>
                              <span className={`text-[11px] font-black ${idx < 3 ? 'text-slate-900' : 'text-slate-300'}`}>{score as number}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${((score as number) / 12) * 100}%` }}
                                transition={{ duration: 1.5, delay: 0.5 + (idx * 0.05) }}
                                className={`h-full rounded-full ${idx < 3 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-slate-200'}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 h-full">
              <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                <Info size={40} />
              </div>
              <div className="max-w-xs mx-auto">
                <h3 className="text-slate-800 font-black mb-1">Belum Ada Data</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">Siswa ini belum mengikuti tes minat bakat atau API Rules belum diatur dengan benar.</p>
              </div>
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default StudentInterestDialog;
