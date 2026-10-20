import React from "react";
import { RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { Button } from "../../../../components/ui/button";
import { cn } from "../../../../lib/utils";

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
      <DialogContent className="max-w-md p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-neutral-800 shadow-2xl">
        <DialogHeader className="space-y-1.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-1 border border-emerald-500/20">
            <RotateCcw className="w-4 h-4" />
          </div>
          <DialogTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Buka Kembali Ujian Siswa {dialog.attemptIds.length > 1 ? `(${dialog.attemptIds.length} Siswa)` : ""}
          </DialogTitle>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Mengembalikan status pengerjaan <span className="font-semibold text-neutral-800 dark:text-neutral-200">{dialog.title}</span> menjadi <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">ONGOING</span>.
          </p>
        </DialogHeader>

        <div className="mt-4 space-y-3.5">
          <div className="p-3 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-700 dark:text-neutral-300">
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">Jawaban Aman Tersimpan</p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Semua butir jawaban yang telah diisi siswa sebelumnya tetap utuh. Siswa dapat langsung melanjutkan pengerjaan soal.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-400">Pilihan Waktu Pengerjaan</label>

            <div className="space-y-2">
              {dialog.remainingMinutes > 0 && (
                <label className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                  dialog.timeOption === "keep"
                    ? "border-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                )}>
                  <input
                    type="radio"
                    name="timeOption"
                    checked={dialog.timeOption === "keep"}
                    onChange={() => setDialog(prev => ({ ...prev, timeOption: "keep" }))}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-neutral-800 dark:text-neutral-200">Gunakan Sisa Waktu Asli</p>
                    <p className="text-[10px] text-neutral-400 font-mono">Tersisa sekitar {dialog.remainingMinutes} menit dari durasi semula.</p>
                  </div>
                </label>
              )}

              <label className={cn(
                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                dialog.timeOption === "extra"
                  ? "border-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-xs"
                  : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
              )}>
                <input
                  type="radio"
                  name="timeOption"
                  checked={dialog.timeOption === "extra"}
                  onChange={() => setDialog(prev => ({ ...prev, timeOption: "extra" }))}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs flex-1">
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">Beri Tambahan Waktu Baru</p>
                  <p className="text-[10px] text-neutral-400 mb-1.5">Siswa mendapat waktu pengerjaan tambahan dihitung mulai saat ini.</p>
                  {dialog.timeOption === "extra" && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={dialog.extraMinutes}
                        onChange={(e) => setDialog(prev => ({ ...prev, extraMinutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="w-20 px-2.5 py-1 text-xs font-mono font-bold border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                      />
                      <span className="text-xs font-medium text-neutral-500">Menit dari sekarang</span>
                    </div>
                  )}
                </div>
              </label>

              <label className={cn(
                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                dialog.timeOption === "reset"
                  ? "border-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-xs"
                  : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
              )}>
                <input
                  type="radio"
                  name="timeOption"
                  checked={dialog.timeOption === "reset"}
                  onChange={() => setDialog(prev => ({ ...prev, timeOption: "reset" }))}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">Reset Durasi Penuh ({monitorRoom?.duration || 60} Menit)</p>
                  <p className="text-[10px] text-neutral-400 font-mono">Timer siswa akan dimulai ulang dari awal secara penuh mulai dari sekarang.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))}
            className="rounded-xl text-xs h-9 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Batal
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isProcessing}
            className="rounded-xl text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer shadow-xs"
          >
            {isProcessing ? "Memproses..." : `Buka ${dialog.attemptIds.length} Ujian Sekarang`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
