import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  CheckCircle2, 
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
  Zap
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

import { QUESTIONS, MI_QUESTIONS, JURUSAN_DATA } from "../../lib/riasec";

import pb from "../../lib/pocketbase";
import { useStudentAuth } from "../../context/StudentAuthContext";

const InterestSurveyPage = () => {
  const { student } = useStudentAuth();
  const ALL_QUESTIONS = useMemo(() => [...QUESTIONS, ...MI_QUESTIONS], []);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [finalResult, setFinalResult] = useState<{ 
    top: string, 
    scores: Record<string, number>,
    hollandCode: string,
    miScores: Record<string, number>,
    topMI: string[]
  } | null>(null);

  useEffect(() => {
    const checkExistingResult = async () => {
      if (!student) return;
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

          setFinalResult({
            top: record.category || sortedRIASEC[0]?.[0] || 'R',
            scores: scores,
            hollandCode: record.hollandCode || derivedHollandCode,
            miScores: miScores,
            topMI: (record.topMI && record.topMI.length > 0) ? record.topMI : sortedMI
          });
          setShowResult(true);
        }
      } catch (err) { } finally {
        setIsLoading(false);
      }
    };

    checkExistingResult();
  }, [student]);

  const progress = (Object.keys(answers).length / ALL_QUESTIONS.length) * 100;

  const resetSurvey = () => {
    setAnswers({});
    setFinalResult(null);
    setCurrentStep(0);
    setShowResult(false);
  };

  const autoSaveResult = async (res: any, currentAnswers: any) => {
    if (!student) return;
    setIsSaving(true);
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
    } catch (err: any) {
      console.error("❌ Gagal Sinkronisasi Data:", err);
      const errorDetail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      alert("Gagal sinkronisasi ke database! \n\nDetail Error: " + errorDetail + "\n\nPastikan field miScores, topMI, dan hollandCode sudah ada di PocketBase.");
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

      Object.entries(newAnswers).forEach(([id, val]) => {
        const qIdNum = Number(id);
        const riasecQ = QUESTIONS.find(q => q.id === qIdNum);
        if (riasecQ) riasecScores[riasecQ.category] += val as number;
        else {
          const miQ = MI_QUESTIONS.find(q => q.id === qIdNum);
          if (miQ) miScores[miQ.category] += val as number;
        }
      });

      const sortedRIASEC = Object.entries(riasecScores).sort(([, a], [, b]) => b - a).slice(0, 3);
      const hollandCode = sortedRIASEC.map(([type]) => type).join("");
      const topCat = sortedRIASEC[0][0];
      const sortedMI = Object.entries(miScores).sort(([, a], [, b]) => b - a).slice(0, 3).map(([type]) => type);

      const res = { top: topCat, scores: riasecScores, hollandCode, miScores, topMI: sortedMI };
      setFinalResult(res);
      setShowResult(true);
      setIsProcessing(false);
      autoSaveResult(res, newAnswers);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-56 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
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

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center font-sans tracking-tight">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full min-h-screen">
          <Card className={`border-none shadow-none min-h-screen rounded-none bg-gradient-to-br ${resultContent.bgGradient} text-white relative flex flex-col`}>
            <div className="absolute top-0 right-0 p-12 opacity-5 hidden lg:block"><GraduationCap size={400} /></div>
            
            <CardContent className="p-6 sm:p-12 relative z-10 flex-1 flex flex-col max-w-7xl mx-auto w-full">
               <div className="flex flex-col items-center text-center mb-6 shrink-0">
                 <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center mb-3 backdrop-blur-md border border-white/30">
                   <Sparkles className="h-6 w-6 text-yellow-300 animate-pulse" />
                 </motion.div>
                 <h1 className="text-2xl sm:text-4xl font-black mb-1 leading-none tracking-tighter uppercase">Analisis RIASEC + MI Selesai!</h1>
                 <p className="text-white/80 font-bold tracking-[0.3em] uppercase text-[10px] mt-2 border-b border-white/20 pb-2">Laporan Hasil: {student?.name || 'Siswa E-Ujian'}</p>
                 <div className="flex flex-wrap justify-center items-center gap-3 mt-4">
                    <div className="flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full border border-white/20">
                       <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.2em]">Holland Code:</p>
                       <span className="text-sm font-black tracking-widest text-white">{finalResult.hollandCode}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full border border-white/20">
                       <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.2em]">Kecerdasan Utama:</p>
                       <span className="text-sm font-black tracking-widest text-white capitalize">{miLabels[finalResult.topMI[0]]}</span>
                    </div>
                 </div>
               </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start flex-1 overflow-y-auto pb-6 custom-scrollbar">
                <div className="space-y-6 flex flex-col h-full">
                  <motion.div initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="p-7 bg-white/10 rounded-[2.5rem] border border-white/20 backdrop-blur-xl shadow-2xl">
                    <div className="flex items-center gap-5 mb-5">
                       <div className="bg-white p-4 rounded-2xl text-slate-900 shadow-xl scale-110">
                          <resultContent.icon className={`h-7 w-7 text-emerald-600`} />
                       </div>
                       <h2 className="text-2xl sm:text-3xl font-black text-left leading-tight tracking-tight text-white">{resultContent.title}</h2>
                    </div>
                    <p className="text-base leading-relaxed text-white font-medium italic border-l-4 border-white/40 pl-5">"{resultContent.desc}"</p>
                  </motion.div>

                  <div className="p-7 bg-white text-slate-900 rounded-[2.5rem] shadow-2xl space-y-6">
                    <div className="flex justify-between items-center">
                       <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600 flex items-center gap-2"><Lightbulb className="h-5 w-5" /> 8 Spektrum Kecerdasan:</h3>
                       <span className="text-[10px] font-bold text-slate-400">Total Potensi Kognitif</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                       {Object.values(finalResult.miScores).every(v => v === 0) ? (
                         <div className="col-span-full py-10 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                           <BrainCircuit className="h-10 w-10 text-slate-300" />
                           <div className="space-y-1 px-6">
                             <p className="text-xs font-black text-slate-500 uppercase tracking-tight">Data Lama Terdeteksi</p>
                             <p className="text-[10px] text-slate-400 leading-tight">Profil Kecerdasan Majemuk belum tersedia untuk rekam medis ini. Silakan tekan <b>Ulangi Analisis</b> untuk mendapatkan hasil terbaru.</p>
                           </div>
                         </div>
                       ) : (
                         Object.entries(finalResult.miScores).sort(([,a],[,b])=>b-a).map(([mi, score], idx) => (
                           <div key={mi} className="space-y-1.5 group">
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-tight">
                                 <span className={idx < 3 ? "text-slate-900" : "text-slate-400"}>
                                   {idx < 3 && <Sparkles className="inline-block h-3 w-3 mr-1 text-emerald-500" />}
                                   {miLabels[mi]}
                                 </span>
                                 <span className={idx < 3 ? "text-emerald-600" : "text-slate-400"}>{score} Pts</span>
                              </div>
                              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                 <motion.div 
                                   initial={{ width: 0 }} 
                                   animate={{ width: `${(score / 12) * 100}%` }} 
                                   className={`h-full rounded-full transition-all ${
                                     idx === 0 ? "bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : 
                                     idx < 3 ? "bg-emerald-400" : "bg-slate-300"
                                   }`} 
                                 />
                              </div>
                           </div>
                         ))
                       )}
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex gap-4 items-start">
                       <BrainCircuit className="h-10 w-10 text-emerald-600 shrink-0" />
                       <p className="text-[11px] font-medium text-emerald-800 leading-relaxed">
                         Kamu memiliki keunggulan tajam di bidang <strong>{miLabels[finalResult.topMI[0]]}</strong>. 
                         Kekuatan ini sangat mendukung caramu memproses informasi dan menyelesaikan masalah di bidang {resultContent.title}.
                       </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 h-full flex flex-col">
                  <motion.div initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="bg-white text-slate-900 p-8 sm:p-10 rounded-[3rem] shadow-2xl space-y-7 flex-1">
                    <div className="space-y-6">
                      <div className="border-b border-slate-100 pb-6">
                        <h3 className="font-black mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-600"><Landmark className="h-5 w-5" /> {resultContent.pathTitle}</h3>
                        <div className="space-y-3">
                          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-600 text-white`}>{resultContent.pathType}</div>
                          <p className="text-xl font-black text-slate-900 leading-tight">{resultContent.pathSaran}</p>
                          <p className="text-sm font-medium text-slate-500 leading-relaxed italic">{resultContent.pathDetail}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 border-b border-slate-100 pb-6">
                        <div>
                          <h3 className="font-black mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Gaya Kerja Utama:</h3>
                          <div className="flex flex-wrap gap-2 text-white">
                            {resultContent.keySkills.map((skill, i) => (
                              <span key={i} className="px-2 py-1 bg-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h3 className="font-black mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Paket Kelas 11:</h3>
                          <p className="text-sm font-black text-emerald-600 uppercase tracking-tight bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 inline-block shadow-sm">
                            {resultContent.suggestedSubjects}
                          </p>
                        </div>
                      </div>
                      <div className="pt-4">
                        <h3 className="font-black mb-5 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400"><BookOpen className="h-4 w-4" /> Jurusan & Karir Terpilih:</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {resultContent.recommendations.map((rec, i) => (
                            <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black text-slate-800 hover:shadow-lg hover:bg-white hover:border-emerald-200 transition-all group">
                              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <div className="flex flex-wrap gap-4 mt-auto pt-6">
                    <Button 
                      onClick={resetSurvey} 
                      variant="outline" 
                      className="flex-1 rounded-2xl h-14 border-white/30 bg-white/10 text-white hover:bg-white hover:text-slate-900 font-black uppercase tracking-widest text-sm"
                    >
                      <RotateCcw className="mr-2 h-5 w-5" /> 
                      Ulangi Analisis
                    </Button>
                    <Button 
                      onClick={() => window.location.href = "/"} 
                      className="flex-2 w-full lg:w-auto px-10 rounded-2xl h-14 bg-white text-slate-900 hover:bg-slate-100 font-black uppercase tracking-widest shadow-2xl text-sm"
                    >
                      Kembali ke Dashboard
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = ALL_QUESTIONS[currentStep];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-emerald-500/5 blur-[120px] pointer-events-none -z-10 rounded-full" />
      <button onClick={() => window.location.href = "/"} className="absolute top-6 right-6 p-4 bg-white dark:bg-slate-900 shadow-xl rounded-2xl text-slate-400 hover:text-rose-500 z-50 group border border-slate-100 dark:border-slate-800"><X className="h-5 w-5" /></button>

      <div className="max-w-4xl w-full space-y-8 relative z-10">
        <div className="text-center space-y-3">
           <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-black tracking-widest uppercase border border-emerald-100 dark:border-emerald-900/30">Instrumen RIASEC + MI</div>
           <h1 className="text-4xl sm:text-5xl font-black text-slate-800 dark:text-white tracking-tighter leading-none">Pilih Masa Depanmu</h1>
           <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Temukan potensi terbaik dalam diri Anda secara otomatis.</p>
        </div>

        {!showResult && currentQuestion && (
          <Card className="border-none shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)] rounded-[3rem] bg-white dark:bg-slate-900 overflow-hidden relative z-10">
            <div className="absolute top-0 left-0 w-full h-2 bg-slate-100 dark:bg-slate-800">
              <motion.div initial={false} animate={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" />
            </div>
            
            <CardContent className="p-8 sm:p-12">
              <AnimatePresence mode="wait">
                <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{currentStep < QUESTIONS.length ? "Orientasi Kerja" : "Potensi Otak"}</span>
                       <span className="text-xs font-black text-slate-800 dark:text-slate-200">Soal {currentStep + 1} / {ALL_QUESTIONS.length}</span>
                    </div>
                    <span className="text-sm font-black text-emerald-600">{Math.round(progress)}%</span>
                  </div>

                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 leading-tight min-h-[4em] flex items-center">{currentQuestion.text}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[{ label: "Sangat Setuju", value: 4, clr: "bg-emerald-600 text-white shadow-emerald-200" }, { label: "Setuju", value: 3, clr: "bg-white border-2 border-slate-100 text-slate-800 shadow-sm" }, { label: "Ragu-ragu", value: 2, clr: "bg-white border-2 border-slate-100 text-slate-800 shadow-sm" }, { label: "Tidak Setuju", value: 1, clr: "bg-white border-2 border-slate-100 text-slate-800 shadow-sm" }].map((opt, i) => (
                      <button key={i} onClick={() => handleAnswer(opt.value)} className={`group p-6 rounded-[2rem] text-sm font-black flex items-center justify-between transition-all hover:scale-[1.03] ${opt.clr}`}>{opt.label} <ChevronRight className="h-5 w-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" /></button>
                    ))}
                  </div>

                  <div className="pt-8 flex justify-between items-center border-t border-slate-100 dark:border-slate-800/60 font-medium text-slate-400">
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
