import React from "react";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "../../../components/ui/dialog";
import { MathText } from "../../../components/ui/MathText";

export interface EditAnswerDialogState {
  open: boolean;
  studentId: string;
  studentName: string;
  question: any;
  currentAnswer: string;
  qIdx: number;
}

interface EditAnswerDialogProps {
  dialog: EditAnswerDialogState | null;
  setDialog: React.Dispatch<React.SetStateAction<EditAnswerDialogState | null>>;
  onSave: (answer: string) => void;
}

export const EditAnswerDialog = ({ dialog, setDialog, onSave }: EditAnswerDialogProps) => {
  return (
    <Dialog open={!!dialog?.open} onOpenChange={(open) => { if (!open) setDialog(null); }}>
      <DialogContent className="max-w-lg bg-white dark:bg-slate-950 rounded-2xl border-none shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        {dialog && (() => {
          const q = dialog.question;
          const choices: Record<string, { text: string; isCorrect: boolean }> = q.choices || {};
          const choiceKeys = Object.keys(choices).sort();
          const currentAns = dialog.currentAnswer;

          return (
            <>
              <div className="bg-amber-500 px-6 py-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Edit Jawaban Siswa</p>
                    <DialogTitle className="text-base font-black leading-tight">
                      Soal #{dialog.qIdx + 1} — {dialog.studentName}
                    </DialogTitle>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Soal</p>
                  <MathText content={q.text} className="text-sm leading-relaxed text-slate-800 dark:text-slate-200" />
                  {q.image && (
                    <img src={q.image} className="mt-3 rounded-lg max-h-48 object-contain" alt="gambar soal" />
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Jawaban</p>
                  {choiceKeys.length > 0 ? (
                    choiceKeys.map(key => {
                      const choice = choices[key];
                      const isSelected = currentAns === key;
                      const isCorrectKey = choice.isCorrect;
                      return (
                        <button
                          key={key}
                          onClick={() => setDialog(prev => prev ? { ...prev, currentAnswer: key } : prev)}
                          className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${isSelected
                            ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-900"
                            }`}
                        >
                          <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black border-2 ${isSelected
                            ? "bg-amber-500 border-amber-500 text-white"
                            : "border-slate-300 dark:border-slate-600 text-slate-500"
                            }`}>
                            {key.toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            <MathText content={choice.text} className="text-sm text-slate-700 dark:text-slate-300 leading-snug" />
                          </div>
                          {isCorrectKey && (
                            <span className="shrink-0 text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              KUNCI
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 italic">Soal ini tidak memiliki pilihan ganda.</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-800">
                  <span>Jawaban dipilih:</span>
                  <span className="font-black text-amber-600 text-sm">
                    {dialog.currentAnswer ? dialog.currentAnswer.toUpperCase() : "— (belum dipilih)"}
                  </span>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setDialog(null)}
                    className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => onSave(dialog.currentAnswer)}
                    disabled={!dialog.currentAnswer}
                    className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-black uppercase tracking-widest transition-colors"
                  >
                    Simpan Jawaban
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
};
