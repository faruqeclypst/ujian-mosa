import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Sparkles,
  Library,
  Atom,
  Palette,
  Users2,
  TrendingUp,
  Settings2,
  BrainCircuit,
  GraduationCap,
  BookOpen,
  Landmark,
  X,
  Lightbulb,
  Zap,
  Info,
  LayoutGrid,
  Star,
  Trophy,
  AlertCircle,
  RefreshCw,
  Compass,
  School,
  Target,
  ArrowRight,
  Shield,
  ShieldCheck
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

import { QUESTIONS, MI_QUESTIONS, JURUSAN_DATA, KELOMPOK_MAPEL, KEDINASAN_INFO, RIASEC_TO_KELOMPOK } from "../../lib/riasec";

import { useTenant } from "../../context/TenantContext";
import { useStudentAuth } from "../../context/StudentAuthContext";

const InterestSurveyPage = () => {
  const { pb, terminology } = useTenant();
  const { student } = useStudentAuth();
  const ALL_QUESTIONS = useMemo(() => [...QUESTIONS, ...MI_QUESTIONS], []);

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ res: any; answers: any } | null>(null);

  const [finalResult, setFinalResult] = useState<{
    top: string,
    scores: Record<string, number>,
    hollandCode: string,
    miScores: Record<string, number>,
    topMI: string[],
    accuracy?: number
  } | null>(null);
  const [showAccuracyInfo, setShowAccuracyInfo] = useState(false);

  useEffect(() => {
    const checkExistingResult = async () => {
      if (!student || !pb) return;
      try {
        const record = await pb.collection("student_interests").getFirstListItem(`studentId="${student.id}"`, {
          sort: "-updated",
        });
        if (record) {
          // Re-calculate top types if missing (for legacy records)
          const scores = record.scores || {};
          const miScores = record.miScores || { LIN: 0, LOG: 0, SPA: 0, KIN: 0, MUS: 0, "INT-R": 0, "INT-A": 0, NAT: 0 };

          const sortedRIASEC = Object.entries(scores).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 3);
          const derivedHollandCode = sortedRIASEC.map(([type]) => type).join("");

          const sortedMI = Object.entries(miScores).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 3).map(([type]) => type);

          let fetchedAccuracy = 100;
          if (record.accuracy !== undefined && record.accuracy !== null) {
            fetchedAccuracy = record.accuracy;
          } else if (record.answers) {
            let inconsistentCount = 0;
            Object.entries(record.answers).forEach(([id, val]) => {
              const qIdNum = Number(id);
              const riasecQ = QUESTIONS.find(q => q.id === qIdNum);
              if (riasecQ?.isNegative && (val as number) > 2) inconsistentCount++;
              else {
                const miQ = MI_QUESTIONS.find(q => q.id === qIdNum);
                if (miQ?.isNegative && (val as number) > 2) inconsistentCount++;
              }
            });
            fetchedAccuracy = Math.round(Math.max(0, 100 - (inconsistentCount * 7.14)));
          }

          setFinalResult({
            top: record.category || sortedRIASEC[0]?.[0] || 'R',
            scores: scores,
            hollandCode: record.hollandCode || derivedHollandCode,
            miScores: miScores,
            topMI: (record.topMI && record.topMI.length > 0) ? record.topMI : sortedMI,
            accuracy: fetchedAccuracy
          });
          setShowResult(true);
        }
      } catch (err) { } finally {
        setIsLoading(false);
      }
    };

    checkExistingResult();
  }, [student]);

  // Auto-retry pending save ketika student/pb sudah siap
  useEffect(() => {
    if (pendingSave && student && pb && !isSaving) {
      console.log("🔄 Auto-retrying pending save...");
      autoSaveResult(pendingSave.res, pendingSave.answers);
    }
  }, [student, pb, pendingSave, isSaving]);

  const progress = (Object.keys(answers).length / ALL_QUESTIONS.length) * 100;

  const resetSurvey = () => {
    setAnswers({});
    setFinalResult(null);
    setCurrentStep(0);
    setShowResult(false);
  };

  const autoSaveResult = async (res: any, currentAnswers: any, retryCount = 0) => {
    // Jika student/pb belum siap, simpan data untuk di-retry nanti
    if (!student || !pb) {
      console.warn("⚠️ Student/PB belum siap, menyimpan data untuk retry...");
      setPendingSave({ res, answers: currentAnswers });
      setSaveFailed(true);
      return;
    }
    setIsSaving(true);
    setSaveFailed(false);
    try {
      let existingId = null;
      try {
        const record = await pb.collection("student_interests").getFirstListItem(`studentId="${student.id}"`, {
          sort: "-updated"
        });
        if (record) existingId = record.id;
      } catch (e) { }

      const data = {
        studentId: student.id,
        category: res.top,
        scores: res.scores,
        hollandCode: res.hollandCode,
        miScores: res.miScores,
        topMI: res.topMI,
        package: JURUSAN_DATA[res.top]?.suggestedSubjects || "-",
        answers: currentAnswers,
      };

      if (existingId) {
        await pb.collection("student_interests").update(existingId, data);
      } else {
        await pb.collection("student_interests").create(data);
      }
      console.log("✅ Data Minat Bakat Berhasil Disinkronkan");
      setPendingSave(null);
      setSaveFailed(false);
    } catch (err: any) {
      console.error("❌ Gagal Sinkronisasi Data:", err);
      setSaveFailed(true);
      setPendingSave({ res, answers: currentAnswers });

      // Auto-retry hingga 3x dengan delay
      if (retryCount < 3) {
        console.log(`🔄 Auto-retry (${retryCount + 1}/3) dalam 2 detik...`);
        setTimeout(() => autoSaveResult(res, currentAnswers, retryCount + 1), 2000);
        return;
      }

      // Setelah 3x gagal, tampilkan alert
      const fieldErrors = err.response?.data?.data;
      const errorMsg = err.response?.data?.message || err.message;
      const errorDetail = fieldErrors ? JSON.stringify(fieldErrors, null, 2) : (err.response?.data ? JSON.stringify(err.response.data, null, 2) : err.message);

      alert(`Gagal sinkronisasi ke database!\n\nStatus: ${err.status}\nMessage: ${errorMsg}\n\nDetail Field: ${errorDetail}\n\nSaran: Tekan tombol "Simpan Ulang" atau coba Logout dan Login kembali.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnswer = (value: number) => {
    if (isProcessing || showResult) return;
    setIsProcessing(true);

    const qId = ALL_QUESTIONS[currentStep].id;
    const newAnswers = { ...answers, [qId]: value };
    setAnswers(newAnswers);

    if (currentStep < ALL_QUESTIONS.length - 1) {
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsProcessing(false);
      }, 50);
    } else {
      const riasecScores: Record<string, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
      const miScores: Record<string, number> = { LIN: 0, LOG: 0, SPA: 0, KIN: 0, MUS: 0, "INT-R": 0, "INT-A": 0, NAT: 0 };
      let inconsistentCount = 0;

      Object.entries(newAnswers).forEach(([id, val]) => {
        const qIdNum = Number(id);
        const riasecQ = QUESTIONS.find(q => q.id === qIdNum);
        let actualVal = val as number;

        if (riasecQ) {
          if (riasecQ.isNegative) {
            actualVal = 5 - actualVal; // Correct inversion for 1-4 scale: 4 becomes 1, 1 becomes 4
            if ((val as number) > 2) inconsistentCount++; // Answered "Setuju" (3) or "Sangat Setuju" (4) on a negative statement
          }
          riasecScores[riasecQ.category] += actualVal;
        } else {
          const miQ = MI_QUESTIONS.find(q => q.id === qIdNum);
          if (miQ) {
            if (miQ.isNegative) {
              actualVal = 5 - actualVal;
              if ((val as number) > 2) inconsistentCount++;
            }
            miScores[miQ.category] += actualVal;
          }
        }
      });

      let sortedRIASEC = Object.entries(riasecScores).sort(([, a], [, b]) => b - a);
      const sortedMI = Object.entries(miScores).sort(([, a], [, b]) => b - a);
      const topMI = sortedMI.slice(0, 3).map(([type]) => type);
      const lowestMI = sortedMI.slice(-3).map(([type]) => type);

      // === CROSS-VALIDATION LOGIC ===
      if (sortedRIASEC[0][0] === 'I' && lowestMI.includes('LOG')) {
        [sortedRIASEC[0], sortedRIASEC[1]] = [sortedRIASEC[1], sortedRIASEC[0]];
      } else if (sortedRIASEC[0][0] === 'R' && lowestMI.includes('KIN')) {
        [sortedRIASEC[0], sortedRIASEC[1]] = [sortedRIASEC[1], sortedRIASEC[0]];
      } else if (sortedRIASEC[0][0] === 'S' && lowestMI.includes('INT-R')) {
        [sortedRIASEC[0], sortedRIASEC[1]] = [sortedRIASEC[1], sortedRIASEC[0]];
      } else if (sortedRIASEC[0][0] === 'A' && lowestMI.includes('SPA') && lowestMI.includes('LIN')) {
        [sortedRIASEC[0], sortedRIASEC[1]] = [sortedRIASEC[1], sortedRIASEC[0]];
      }

      const finalTop3RIASEC = sortedRIASEC.slice(0, 3);
      const hollandCode = finalTop3RIASEC.map(([type]) => type).join("");
      const topCat = finalTop3RIASEC[0][0];

      // Calculate Lie Scale accuracy (14 negative items total)
      const accuracyScore = Math.max(0, 100 - (inconsistentCount * 7.14));

      const res = {
        top: topCat,
        scores: riasecScores,
        hollandCode,
        miScores,
        topMI,
        accuracy: Math.round(accuracyScore)
      };

      // Clear any previous pending save state
      setSaveFailed(false);
      setPendingSave(null);
      setFinalResult(res);
      setShowResult(true);
      setIsProcessing(false);
      autoSaveResult(res, newAnswers);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center space-y-4">
        <div className="w-56 h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
          <motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }} className="absolute inset-0 bg-emerald-500 rounded-full" />
        </div>
        <p className="text-[10px] font-black text-slate-400 animate-pulse tracking-[0.3em] uppercase">Sinkronisasi Data...</p>
      </div>
    );
  }

  if (showResult && finalResult) {
    const resultContent = JURUSAN_DATA[finalResult.top];
    if (!resultContent) return <div className="min-h-screen flex items-center justify-center">Loading Content...</div>;

    const miLabels: Record<string, string> = {
      LIN: "Linguistik", LOG: "Logis-Matematis", SPA: "Visual-Spasial",
      KIN: "Kinestetik", MUS: "Musikal", "INT-R": "Interpersonal",
      "INT-A": "Intrapersonal", NAT: "Naturalis"
    };

    const accuracyVal = finalResult.accuracy ?? 100;
    const accuracyColor = accuracyVal >= 80 ? 'text-emerald-600' : accuracyVal >= 50 ? 'text-yellow-600' : 'text-rose-600';

    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 selection:bg-emerald-500/10 font-sans tracking-tight">
        {/* CLEAN BACKGROUND */}
        <div className="fixed inset-0 bg-[#f8fafc] pointer-events-none" />

        <div className="relative z-10 max-w-[1400px] mx-auto px-4 py-4 lg:py-8">
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
                {student?.name || 'STUDENT'}
              </h1>
              <div className="flex items-center gap-4 text-slate-600 font-bold tracking-widest uppercase text-xs">
                <span>KELAS {student?.className || '-'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span>ID: {student?.id?.slice(-6).toUpperCase()}</span>
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
                <p className="text-3xl font-black text-slate-900">{finalResult.hollandCode}</p>
              </div>
            </motion.div>
          </div>

          {/* BENTO GRID - LIGHT */}
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
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-2xl rounded-xl mb-6 border border-white/30 shadow-sm">
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
                      // Logic pintar untuk memilih rekomendasi berdasarkan MI
                      const topMI = finalResult.topMI || [];
                      const allRecs = [...resultContent.recommendations];
                      
                      // Filter sederhana: Jika LIN tinggi, prioritaskan Guru/Hukum/Sosial
                      if (topMI.includes('LIN')) {
                        allRecs.sort((a, b) => {
                          const aIsLin = a.includes('Guru') || a.includes('Hukum') || a.includes('Sosiologi') || a.includes('Komunikasi');
                          const bIsLin = b.includes('Guru') || b.includes('Hukum') || b.includes('Sosiologi') || b.includes('Komunikasi');
                          return aIsLin === bIsLin ? 0 : aIsLin ? -1 : 1;
                        });
                      }
                      // Jika NAT/LOG tinggi, prioritaskan Medis/Sains
                      else if (topMI.includes('NAT') || topMI.includes('LOG')) {
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
                  const topRiasec = finalResult.hollandCode[0];
                  const items = KEDINASAN_INFO.items.filter(item => item.riasec?.includes(topRiasec)).slice(0, 2);
                  
                  if (items.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center p-5 text-center h-full space-y-2 bg-slate-50/50 rounded-2xl border border-slate-100 border-dashed">
                        <span className="text-2xl opacity-40">🎯</span>
                        <p className="text-xs font-bold text-slate-500 leading-relaxed">
                          Profil ini lebih optimal berkembang di jalur Profesional/Reguler dibandingkan jalur Kedinasan.
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
                const mapping = RIASEC_TO_KELOMPOK[finalResult.top];
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
                {Object.entries(finalResult.miScores).sort(([, a], [, b]) => b - a).slice(0, 6).map(([mi, score], idx) => (
                  <div key={mi} className="space-y-1 group/mi">
                    <div className="flex justify-between items-center px-1">
                      <span className={`text-xs font-black uppercase tracking-tight ${idx < 3 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {miLabels[mi]}
                      </span>
                      <span className={`text-[11px] font-black ${idx < 3 ? 'text-slate-900' : 'text-slate-300'}`}>{score}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(score / 12) * 100}%` }}
                        transition={{ duration: 1.5, delay: 0.5 + (idx * 0.05) }}
                        className={`h-full rounded-full ${idx < 3 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-slate-200'}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ACTION CARD - LIGHT WIDE FOOTER */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="lg:col-span-12 p-8 rounded-[2.5rem] bg-white border border-slate-200/60 flex flex-col md:flex-row items-center justify-between shadow-2xl shadow-slate-200/40 relative overflow-hidden gap-8"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <LayoutGrid className="w-32 h-32 text-slate-900" />
              </div>
              <div className="relative z-10 space-y-3 max-w-xl">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">Masa Depan di Tanganmu.</h3>
                {accuracyVal < 70 ? (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-sm text-amber-800 font-bold flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4" /> Hasil Kurang Konsisten ({accuracyVal}%)
                    </p>
                    <p className="text-xs text-amber-700 leading-relaxed font-medium">Jawabanmu terdeteksi kurang stabil. Kami menyarankan untuk melakukan tes ulang dengan lebih teliti atau berkonsultasi dengan Guru BK untuk validasi lebih lanjut.</p>
                  </div>
                ) : (
                  <p className="text-base text-slate-600 font-medium leading-relaxed">Analisis ini hanyalah kompas. Langkah kakimu yang akan menentukan tujuan akhirnya. Konsultasikan hasil ini dengan Guru BK atau Mentor Akademik untuk rencana aksi nyata.</p>
                )}
              </div>

              <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <button
                  onClick={() => window.location.replace(`${window.location.origin}/exam`)}
                  className="px-8 h-14 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Dashboard
                </button>
                <button
                  onClick={() => { setShowResult(false); setCurrentStep(0); setAnswers({}); }}
                  className="px-8 h-14 rounded-2xl bg-blue-50 text-blue-700 font-black uppercase tracking-widest text-[10px] border border-blue-100 hover:bg-blue-100 transition-all flex items-center justify-center gap-3"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retake
                </button>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = ALL_QUESTIONS[currentStep];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-emerald-500/5 blur-[120px] pointer-events-none -z-10 rounded-full" />
      <button onClick={() => window.location.href = "/"} className="absolute top-6 right-6 p-4 bg-white shadow-xl rounded-2xl text-slate-400 hover:text-rose-500 z-50 group border border-slate-100"><X className="h-5 w-5" /></button>

      <div className="max-w-4xl w-full space-y-8 relative z-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-xs font-black tracking-widest uppercase border border-emerald-100">Instrumen RIASEC + MI</div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tighter leading-none">Pilih Masa Depanmu</h1>
          <p className="text-slate-500 text-sm font-medium">Temukan potensi terbaik dalam diri Anda secara otomatis.</p>
        </div>

        {!showResult && currentQuestion && (
          <Card className="border-none shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] rounded-[3rem] bg-white overflow-hidden relative z-10">
            <div className="absolute top-0 left-0 w-full h-2 bg-slate-100">
              <motion.div initial={false} animate={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" />
            </div>

            <CardContent className="p-8 sm:p-12">
              <AnimatePresence mode="wait">
                <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{currentStep < QUESTIONS.length ? "Orientasi Kerja" : "Potensi Otak"}</span>
                      <span className="text-xs font-black text-slate-800">Soal {currentStep + 1} / {ALL_QUESTIONS.length}</span>
                    </div>
                    <span className="text-sm font-black text-emerald-600">{Math.round(progress)}%</span>
                  </div>

                  <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight min-h-[4em] flex items-center">{currentQuestion.text}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[{ label: "Sangat Setuju", value: 4, clr: "bg-emerald-600 text-white shadow-emerald-200" }, { label: "Setuju", value: 3, clr: "bg-white border-2 border-slate-100 text-slate-800 shadow-sm" }, { label: "Ragu-ragu", value: 2, clr: "bg-white border-2 border-slate-100 text-slate-800 shadow-sm" }, { label: "Tidak Setuju", value: 1, clr: "bg-white border-2 border-slate-100 text-slate-800 shadow-sm" }].map((opt, i) => (
                      <button key={i} onClick={() => handleAnswer(opt.value)} className={`group p-6 rounded-[2rem] text-sm font-black flex items-center justify-between transition-all hover:scale-[1.03] ${opt.clr}`}>{opt.label} <ChevronRight className="h-5 w-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" /></button>
                    ))}
                  </div>

                  <div className="pt-8 flex justify-between items-center border-t border-slate-100 font-medium text-slate-400">
                    <button disabled={currentStep === 0} onClick={() => setCurrentStep(prev => prev - 1)} className="flex items-center gap-2 hover:text-emerald-600 transition-colors disabled:opacity-30"><ChevronLeft className="h-4 w-4" /> Sebelumnya</button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default InterestSurveyPage;
