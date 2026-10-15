import React from "react";
import { RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";

export interface ReopenDialogState {
  isOpen: boolean;
  attemptIds: string[];
  title: string;
  remainingMinutes: number;
  timeOption: "keep" | "reset" | "extra";
  extraMinutes: number;
}

interface ReopenDialogProps {
  dialog: ReopenDialogState;
  setDialog: React.Dispatch<React.SetStateAction<ReopenDialogState>>;
  monitorRoom: any;
  onConfirm: () => void;
  isProcessing: boolean;
}

export const ReopenDialog = ({ dialog, setDialog, monitorRoom, onConfirm, isProcessing }: ReopenDialogProps) => {
  return (
    <Dialog open={dialog.isOpen} onOpenChange={(open) => setDialog(prev => ({ ...prev, isOpen: open }))}>
      <DialogContent className="max-w-md p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 border border-indigo-100 dark:border-indigo-800/50">
            <RotateCcw className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Buka Kembali Ujian Siswa {dialog.attemptIds.length > 1 ? `(${dialog.attemptIds.length} Siswa)` : ""}
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mengembalikan status pengerjaan <span className="font-bold text-slate-800 dark:text-slate-200">{dialog.title}</span> menjadi <span className="font-black text-blue-600 dark:text-blue-400">ONGOING</span>.
          </p>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl text-xs text-indigo-900 dark:text-indigo-300">
            <p className="font-bold">✨ Jawaban Aman Tersimpan</p>
            <p className="text-[11px] text-indigo-700 dark:text-indigo-400 mt-0.5">
              Semua butir jawaban yang telah diisi siswa sebelumnya tetap utuh. Siswa dapat langsung melanjutkan pengerjaan soal.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Pilihan Waktu Pengerjaan</label>

            <div className="space-y-2">
              {dialog.remainingMinutes > 0 && (
                <label className={cn(
                  "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all",
                  dialog.timeOption === "keep"
                    ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                )}>
                  <input
                    type="radio"
                    name="timeOption"
                    checked={dialog.timeOption === "keep"}
                    onChange={() => setDialog(prev => ({ ...prev, timeOption: "keep" }))}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-slate-800 dark:text-slate-200">Gunakan Sisa Waktu Asli</p>
                    <p className="text-[10px] text-slate-400">Tersisa sekitar {dialog.remainingMinutes} menit dari durasi semula.</p>
                  </div>
                </label>
              )}

              <label className={cn(
                "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all",
                dialog.timeOption === "extra"
                  ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
              )}>
                <input
                  type="radio"
                  name="timeOption"
                  checked={dialog.timeOption === "extra"}
                  onChange={() => setDialog(prev => ({ ...prev, timeOption: "extra" }))}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs flex-1">
                  <p className="font-bold text-slate-800 dark:text-slate-200">Beri Tambahan Waktu Baru</p>
                  <p className="text-[10px] text-slate-400 mb-1.5">Siswa mendapat waktu pengerjaan tambahan dihitung mulai saat ini.</p>
                  {dialog.timeOption === "extra" && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={dialog.extraMinutes}
                        onChange={(e) => setDialog(prev => ({ ...prev, extraMinutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="w-20 px-2.5 py-1 text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                      <span className="text-xs font-bold text-slate-500">Menit dari sekarang</span>
                    </div>
                  )}
                </div>
              </label>

              <label className={cn(
                "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all",
                dialog.timeOption === "reset"
                  ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
              )}>
                <input
                  type="radio"
                  name="timeOption"
                  checked={dialog.timeOption === "reset"}
                  onChange={() => setDialog(prev => ({ ...prev, timeOption: "reset" }))}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200">Reset Durasi Penuh ({monitorRoom?.duration || 60} Menit)</p>
                  <p className="text-[10px] text-slate-400">Timer siswa akan dimulai ulang dari awal secara penuh mulai dari sekarang.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))}
            className="rounded-xl text-xs h-9"
          >
            Batal
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isProcessing}
            className="rounded-xl text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
          >
            {isProcessing ? "Memproses..." : `Buka ${dialog.attemptIds.length} Ujian Sekarang`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
