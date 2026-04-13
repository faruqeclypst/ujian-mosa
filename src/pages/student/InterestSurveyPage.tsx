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
  X
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

import { QUESTIONS, JURUSAN_DATA } from "../../lib/riasec";

import pb from "../../lib/pocketbase";
import { useStudentAuth } from "../../context/StudentAuthContext";

const InterestSurveyPage = () => {
  const { student } = useStudentAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalResult, setFinalResult] = useState<{ top: string, scores: Record<string, number> } | null>(null);

  useEffect(() => {
    const checkExistingResult = async () => {
      if (!student) return;
      try {
        const record = await pb.collection("student_interests").getFirstListItem(`studentId="${student.id}"`, {
          sort: "-created",
        });
        if (record) {
          setFinalResult({
            top: record.category,
            scores: record.scores,
          });
          setShowResult(true);
        }
      } catch (err) {
        // No existing result found, which is fine
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingResult();
  }, [student]);

  const progress = (Object.keys(answers).length / QUESTIONS.length) * 100;

  const saveResult = async (finalTop: string, finalScores: any, currentAnswers: any) => {
    if (!student) return;
    setIsSaving(true);
    try {
      // Periksa apakah sudah ada data lama, jika ada biarkan (atau bisa di-update)
      // Untuk stabilitas, kita buat baru saja
      await pb.collection("student_interests").create({
        studentId: student.id,
        category: finalTop,
        scores: finalScores,
        package: JURUSAN_DATA[finalTop]?.suggestedSubjects || "-",
        answers: currentAnswers,
      });
    } catch (err) {
      console.error("Gagal menyimpan hasil:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnswer = (value: number) => {
    if (isProcessing || showResult) return;
    setIsProcessing(true);

    const newAnswers = { ...answers, [QUESTIONS[currentStep].id]: value };
    setAnswers(newAnswers);
    
    if (currentStep < QUESTIONS.length - 1) {
      // Small timeout to give feedback and prevent rapid double-clicks
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsProcessing(false);
      }, 100); 
    } else {
      const scores: Record<string, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
      Object.entries(newAnswers).forEach(([id, val]) => {
        const q = QUESTIONS.find(item => item.id === Number(id));
        if (q) scores[q.category] += val as number;
      });

      let topCat = "R";
      let max = -1;
      Object.entries(scores).forEach(([cat, score]) => {
        if (score > max) { max = score; topCat = cat; }
      });

      const res = { top: topCat, scores };
      setFinalResult(res);
      setShowResult(true);
      setIsProcessing(false);
      saveResult(topCat, scores, newAnswers);
    }
  };

  const resetSurvey = () => {
    setAnswers({});
    setFinalResult(null);
    setCurrentStep(0);
    setShowResult(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-56 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
          <motion.div 
             initial={{ x: "-100%" }}
             animate={{ x: "100%" }}
             transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
             className="absolute inset-0 bg-indigo-500 rounded-full"
          />
        </div>
        <p className="text-[10px] font-black text-slate-400 animate-pulse tracking-[0.3em] uppercase">Mempersiapkan Analisis</p>
      </div>
    );
  }

  if (showResult && finalResult) {
    const resultContent = JURUSAN_DATA[finalResult.top];
    if (!resultContent) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    
    const Icon = resultContent.icon;

    const getColorClass = (color: string) => {
      const maps: any = {
        rose: "bg-rose-600 text-rose-600",
        blue: "bg-blue-600 text-blue-600",
        purple: "bg-purple-600 text-purple-600",
        emerald: "bg-emerald-600 text-emerald-600",
        orange: "bg-orange-600 text-orange-600",
        indigo: "bg-indigo-600 text-indigo-600",
      };
      return maps[color] || maps.indigo;
    };

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center font-sans tracking-tight">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full h-full min-h-screen"
        >
          <Card className={`border-none shadow-none min-h-screen rounded-none bg-gradient-to-br ${resultContent.bgGradient} text-white relative flex flex-col`}>
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 p-12 opacity-5 hidden lg:block">
              <GraduationCap size={400} />
            </div>
            
            <CardContent className="p-6 sm:p-12 relative z-10 flex-1 flex flex-col max-w-7xl mx-auto w-full">
              <div className="flex flex-col items-center text-center mb-8 shrink-0">
                <motion.div 
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/30"
                >
                  <Sparkles className="h-8 w-8 text-yellow-300 animate-pulse" />
                </motion.div>
                <h1 className="text-3xl sm:text-5xl font-black mb-2 tracking-tighter uppercase">Analisis Selesai!</h1>
                <p className="text-white/70 text-xs font-bold uppercase tracking-[0.2em]">Hasil Pemetaan Minat & Bakat</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 items-start flex-1 overflow-y-auto pb-10">
                <div className="space-y-6">
                  <motion.div 
                    initial={{ x: -30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="p-8 bg-white/10 rounded-[2.5rem] border border-white/20 backdrop-blur-xl shadow-2xl"
                  >
                    <div className="flex items-center gap-5 mb-6">
                       <div className="bg-white p-4 rounded-2xl text-slate-900 shadow-xl scale-110">
                          <Icon className={`h-8 w-8 ${getColorClass(resultContent.color).split(" ")[1]}`} />
                       </div>
                       <h2 className="text-2xl sm:text-3xl font-black text-left leading-none tracking-tight">{resultContent.title}</h2>
                    </div>
                    <p className="text-base leading-relaxed text-white/90 font-medium italic border-l-4 border-white/30 pl-4">
                      "{resultContent.desc}"
                    </p>
                  </motion.div>

                  {/* Score Breakdown */}
                  <div className="p-8 bg-black/20 rounded-[2.5rem] backdrop-blur-md border border-white/5 space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/50 flex items-center gap-2">
                      <TrendingUp className="h-3 w-3" /> Statistik Potensi:
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(finalResult.scores).map(([cat, score]) => (
                        <div key={cat} className="space-y-2">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                            <span>{JURUSAN_DATA[cat].title.split(" (")[0]}</span>
                            <span>{score} Poin</span>
                          </div>
                          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(score / 25) * 100}%` }}
                              className="h-full bg-white/70 rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 h-full flex flex-col">
                  <motion.div 
                    initial={{ x: 30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white text-slate-900 p-8 sm:p-10 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] space-y-8 flex-1"
                  >
                    <div>
                      <h3 className={`font-black mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] opacity-40`}>
                        <BookOpen className="h-4 w-4" />
                        Saran Pilihan Paket:
                      </h3>
                      <div className={`p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem]`}>
                        <p className={`text-3xl sm:text-4xl font-black tracking-tighter ${getColorClass(resultContent.color).split(" ")[1]}`}>
                          {resultContent.suggestedSubjects}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest leading-none">Kurikulum Standard Sekolah</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-black mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] opacity-40">
                        <Landmark className="h-4 w-4" />
                        Jalur Kedinasan:
                      </h3>
                      <div className="flex gap-4">
                        <div className={`w-1 h-auto bg-slate-200 rounded-full`} />
                        <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
                          {resultContent.kedinasanSaran}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-black mb-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] opacity-40">
                        <Library className="h-4 w-4" />
                        Karir & Jurusan:
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {resultContent.recommendations.map((rec, i) => (
                          <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black text-slate-700 hover:bg-white hover:shadow-md transition-all">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            {rec}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                    <Button 
                      onClick={resetSurvey}
                      variant="outline" 
                      className="flex-1 rounded-2xl h-14 border-white/30 bg-white/10 text-white hover:bg-white hover:text-slate-900 font-black uppercase tracking-widest transition-all text-xs"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Ulangi Tes
                    </Button>
                    <Button 
                      onClick={() => window.location.href = "/"}
                      className="flex-1 rounded-2xl h-14 bg-white text-slate-900 hover:bg-slate-100 font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 text-xs shadow-black/20"
                    >
                      Tutup & Selesai
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

  const currentQuestion = QUESTIONS[currentStep];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-indigo-500/5 blur-[120px] pointer-events-none -z-10 rounded-full" />

      {/* Exit Button */}
      <button 
        onClick={() => window.location.href = "/"}
        className="absolute top-6 right-6 p-4 bg-white dark:bg-slate-900 shadow-xl rounded-2xl text-slate-400 hover:text-rose-500 transition-all z-50 hover:scale-105 active:scale-95 group border border-slate-100 dark:border-slate-800"
      >
        <X className="h-5 w-5" />
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-bold">Keluar Survey</span>
      </button>

      <div className="max-w-4xl w-full space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center space-y-3">
           <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-black tracking-widest uppercase border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
              <BrainCircuit className="h-4 w-4" />
              Tes Minat Bakat Interaktif
           </div>
           <h1 className="text-4xl sm:text-5xl font-black text-slate-800 dark:text-white tracking-tighter">Temukan Masa Depanmu</h1>
           <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Jawablah 30 pertanyaan berikut untuk hasil analisis yang komprehensif.</p>
        </div>

        {/* Question Area */}
        <div className="relative">
          {!showResult && currentQuestion && (
            <Card className="border-none shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)] rounded-[3rem] bg-white dark:bg-slate-900 overflow-hidden relative z-10">
              {/* Static Progress Bar */}
              <div className="absolute top-0 left-0 w-full h-2 bg-slate-100 dark:bg-slate-800">
                <motion.div 
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                />
              </div>
              
              <CardContent className="p-8 sm:p-12">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-8"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Soal {currentStep + 1} / {QUESTIONS.length}</span>
                      <div className="flex items-center gap-2">
                         <div className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                         <span className="text-sm font-black text-indigo-600">{Math.round(progress)}%</span>
                      </div>
                    </div>

                    <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 leading-[1.15] tracking-tight min-h-[4em] flex items-center">
                      {currentQuestion.text}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { label: "Sangat Setuju", value: 4, color: "bg-indigo-600 text-white shadow-indigo-200" },
                        { label: "Setuju", value: 3, color: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-2 border-slate-100 dark:border-slate-800" },
                        { label: "Ragu-ragu", value: 2, color: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-2 border-slate-100 dark:border-slate-800" },
                        { label: "Tidak Setuju", value: 1, color: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-2 border-slate-100 dark:border-slate-800" },
                      ].map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleAnswer(opt.value)}
                          className={`group p-6 rounded-[2rem] text-sm font-black flex items-center justify-between transition-all hover:scale-[1.03] active:scale-95 ${opt.color} hover:shadow-xl`}
                        >
                          {opt.label}
                          <ChevronRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                        </button>
                      ))}
                    </div>

                    <div className="pt-8 flex justify-between items-center border-t border-slate-100 dark:border-slate-800/60">
                       <button 
                         disabled={currentStep === 0}
                         onClick={() => setCurrentStep(prev => prev - 1)}
                         className="flex items-center gap-2 text-slate-400 font-bold hover:text-indigo-600 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                       >
                          <ChevronLeft className="h-4 w-4" />
                          Soal Sebelumnya
                       </button>
                       <div className="hidden sm:block">
                          <Progress value={progress} className="h-1.5 w-40 bg-slate-100 dark:bg-slate-800" />
                       </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterestSurveyPage;
