import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Progress } from "../ui/progress";
import { Loader2 } from "lucide-react";

export interface BatchProgressState {
  isOpen: boolean;
  current: number;
  total: number;
  message: string;
  title: string;
}

interface BatchProgressDialogProps {
  progress: BatchProgressState;
  colorClass?: string;
}

export const BatchProgressDialog = ({ progress, colorClass = "bg-blue-600" }: BatchProgressDialogProps) => {
  const percentage = Math.round((progress.current / (progress.total || 1)) * 100) || 0;

  return (
    <Dialog open={progress.isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md bg-card border-none shadow-2xl p-0 overflow-hidden rounded-3xl" hideClose>
        <div className={`${colorClass} p-6 text-white flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">{progress.title}</DialogTitle>
              <DialogDescription className="text-blue-100 text-xs">Mohon tunggu hingga proses selesai.</DialogDescription>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-white/40">{percentage}%</span>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-end mb-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{progress.message}</span>
              <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {progress.current} / {progress.total}
              </span>
            </div>
            <Progress value={percentage} className="h-3 bg-slate-100 dark:bg-slate-800" />
          </div>

          <p className="text-[10px] text-center text-slate-400 font-medium italic">
            * Jangan menutup atau merefresh halaman ini selama proses berlangsung.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BatchProgressDialog;
