import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./dialog";
import { NeonProgress, type NeonProgressVariant } from "./NeonProgress";
import { Loader2, ShieldCheck, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";

export interface BatchProgressState {
  isOpen: boolean;
  current: number;
  total: number;
  message: string;
  title: string;
}

export interface NeonProgressModalProps {
  progress: BatchProgressState;
  variant?: NeonProgressVariant;
  colorClass?: string; // Kept for backwards compatibility
  footnote?: string;
  icon?: React.ElementType;
}

export const NeonProgressModal: React.FC<NeonProgressModalProps> = ({
  progress,
  variant = "emerald",
  colorClass: _colorClass,
  footnote,
  icon: CustomIcon,
}) => {
  const total = Math.max(1, progress.total || 1);
  const current = Math.min(total, Math.max(0, progress.current || 0));
  const percentage = Math.round((current / total) * 100) || 0;
  const isComplete = percentage >= 100 && current >= total;

  return (
    <Dialog open={progress.isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md w-[calc(100vw-2rem)] bg-white dark:bg-[#0c0d0e] border border-neutral-200/90 dark:border-neutral-800 rounded-2xl shadow-2xl dark:shadow-[0_0_50px_rgba(16,185,129,0.08)] p-0 overflow-hidden"
        hideClose
      >
        {/* Header Bar */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-[#111214] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Glowing Icon Container */}
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              {CustomIcon ? (
                <CustomIcon className="h-5 w-5" />
              ) : isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-400" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] shrink-0" />
                <DialogTitle className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight truncate">
                  {progress.title || "Memproses Tindakan"}
                </DialogTitle>
              </div>
              <DialogDescription className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                {isComplete ? "Proses selesai, sinkronisasi data..." : "Sinkronisasi data sistem sedang berjalan"}
              </DialogDescription>
            </div>
          </div>

          {/* Monospace Glowing Percentage Counter */}
          <div className="text-right shrink-0">
            <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-600 dark:text-emerald-400 tracking-tight drop-shadow-[0_0_10px_rgba(16,185,129,0.35)]">
              {percentage}%
            </span>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-5 bg-white dark:bg-[#0c0d0e]">
          {/* Progress Status Row */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  {!isComplete && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                  {progress.message || "Mohon tunggu..."}
                </span>
              </div>

              {/* Step Counter Badge */}
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                {current} / {total}
              </span>
            </div>

            {/* NEON Progress Bar with Glowing Head */}
            <NeonProgress
              value={percentage}
              variant={variant}
              size="md"
              glow={true}
              pulseHead={!isComplete}
            />
          </div>

          {/* Footnote Warning Card */}
          <div className="flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800/80 text-[11px] text-neutral-500 dark:text-neutral-400 text-center font-medium leading-relaxed">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {footnote || "Jangan menutup atau merefresh halaman ini selama proses berlangsung."}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NeonProgressModal;
