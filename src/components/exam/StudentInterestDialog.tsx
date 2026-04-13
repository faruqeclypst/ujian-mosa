import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "../ui/dialog";
import { 
  TrendingUp, 
  BookOpen, 
  Landmark, 
  Library,
  CheckCircle2,
  Loader2,
  Sparkles,
  Info
} from "lucide-react";
import { motion } from "framer-motion";
import { JURUSAN_DATA } from "../../lib/riasec";
import pb from "../../lib/pocketbase";
import { Button } from "../ui/button";

interface StudentInterestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
}

const StudentInterestDialog = ({ isOpen, onClose, studentId, studentName }: StudentInterestDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (isOpen && studentId) {
      const fetchData = async () => {
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

  const getColorClass = (color: string) => {
    const maps: any = {
      rose: "text-rose-600 bg-rose-50",
      blue: "text-blue-600 bg-blue-50",
      purple: "text-purple-600 bg-purple-50",
      emerald: "text-emerald-600 bg-emerald-50",
      orange: "text-orange-600 bg-orange-50",
      indigo: "text-indigo-600 bg-indigo-50",
    };
    return maps[color] || maps.indigo;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
        <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
             </div>
             <div>
                <DialogTitle className="text-lg font-black text-slate-800 dark:text-white">Hasil Analisis Minat Bakat</DialogTitle>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{studentName}</p>
             </div>
          </div>
        </DialogHeader>

        <div className="p-0 min-h-[400px] flex flex-col bg-white dark:bg-slate-950">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 p-12">
               <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
               <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase italic">Menganalisis Data...</p>
            </div>
          ) : data ? (
            <div className="grid grid-cols-1 md:grid-cols-5 h-full">
               {/* Left Panel: Summary */}
               <div className="md:col-span-2 p-8 border-r border-slate-50 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/10">
                  <div className="space-y-6">
                    {(() => {
                      const res = JURUSAN_DATA[data.category];
                      const Icon = res?.icon || Info;
                      return (
                        <>
                          <div className={`p-6 rounded-[2rem] ${res?.bgGradient ? "bg-gradient-to-br " + res.bgGradient : "bg-indigo-600"} text-white shadow-xl`}>
                            <div className="flex items-center gap-4 mb-4">
                               <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                                  <Icon className="h-6 w-6" />
                               </div>
                               <h3 className="text-xl font-black leading-tight">{res?.title || "Hasil"}</h3>
                            </div>
                            <p className="text-sm font-medium text-white/90 italic leading-relaxed">
                              "{res?.desc}"
                            </p>
                          </div>

                          {/* Scores List */}
                          <div className="space-y-4">
                             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="h-3 w-3" /> Skor Potensi:
                             </h4>
                             <div className="space-y-3">
                                {Object.entries(data.scores || {}).map(([cat, score]: [string, any]) => (
                                  <div key={cat} className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold">
                                      <span className="text-slate-500">{JURUSAN_DATA[cat]?.title.split(" (")[0]}</span>
                                      <span className="text-slate-900 dark:text-slate-100">{score} Ptn</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                       <motion.div 
                                         initial={{ width: 0 }}
                                         animate={{ width: `${((score as number) / 25) * 100}%` }}
                                         className={`h-full ${cat === data.category ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-600"}`}
                                       />
                                    </div>
                                  </div>
                                ))}
                             </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
               </div>

               {/* Right Panel: Recommendations */}
               <div className="md:col-span-3 p-8 space-y-8 overflow-y-auto max-h-[600px]">
                  {(() => {
                    const res = JURUSAN_DATA[data.category];
                    if (!res) return null;
                    return (
                      <>
                        <div className="space-y-4">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <BookOpen className="h-4 w-4" /> Saran Pilihan Paket:
                           </h4>
                           <div className={`p-6 rounded-3xl border-2 border-slate-50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30`}>
                              <p className={`text-3xl font-black tracking-tighter ${getColorClass(res.color).split(" ")[0]}`}>
                                {res.suggestedSubjects}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sesuai Minat Utama</p>
                           </div>
                        </div>

                        <div className="space-y-4">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Landmark className="h-4 w-4" /> Jalur Kedinasan:
                           </h4>
                           <div className="flex gap-4">
                              <div className="w-1 h-auto bg-slate-100 dark:bg-slate-800 rounded-full" />
                              <p className="text-sm font-bold text-slate-600 dark:text-slate-300 italic leading-relaxed">
                                {res.kedinasanSaran}
                              </p>
                           </div>
                        </div>

                        <div className="space-y-4">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Library className="h-4 w-4" /> Karir & Jurusan:
                           </h4>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {res.recommendations.map((rec, i) => (
                                <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-[11px] font-black text-slate-700 dark:text-slate-300">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                  {rec}
                                </div>
                              ))}
                           </div>
                        </div>
                      </>
                    );
                  })()}
               </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
               <div className="h-20 w-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-300">
                  <Info size={40} />
               </div>
               <div className="max-w-xs mx-auto">
                  <h3 className="text-slate-800 dark:text-white font-bold mb-1">Belum Ada Data</h3>
                  <p className="text-xs text-slate-400 font-medium">Siswa ini belum mengikuti tes minat bakat interaktif.</p>
               </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end">
           <Button variant="default" onClick={onClose} className="rounded-xl px-8 h-10 font-bold bg-slate-800 hover:bg-slate-900 text-white">
              Tutup
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentInterestDialog;
