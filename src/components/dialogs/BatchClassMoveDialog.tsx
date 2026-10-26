import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { ArrowLeftRight } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import type { ClassData } from "../../types/exam";

interface BatchClassMoveDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  classes: ClassData[];
  targetClassId: string;
  onTargetClassChange: (classId: string) => void;
  onSubmit: () => void;
}

export const BatchClassMoveDialog: React.FC<BatchClassMoveDialogProps> = ({
  isOpen,
  onOpenChange,
  selectedCount,
  classes,
  targetClassId,
  onTargetClassChange,
  onSubmit,
}) => {
  const { terminology } = useTenant();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] bg-white dark:bg-[#0c0d0e] border border-neutral-200/90 dark:border-neutral-800 rounded-2xl shadow-2xl p-0 overflow-hidden">
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-[#111214] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            <ArrowLeftRight className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] shrink-0" />
              <DialogTitle className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight truncate">
                Pindah {terminology.class}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
              {selectedCount} {terminology.student.toLowerCase()} terpilih akan dipindahkan
            </DialogDescription>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 bg-white dark:bg-[#0c0d0e]">
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
              Pilih {terminology.class} Tujuan:
            </label>
            <select
              value={targetClassId}
              onChange={(e) => onTargetClassChange(e.target.value)}
              className="w-full h-10 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 px-3 text-xs font-semibold text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="">-- Pilih {terminology.class} --</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-neutral-50/70 dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-neutral-200 dark:border-neutral-800 h-9 text-xs"
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={!targetClassId}
            onClick={onSubmit}
            className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl h-9 text-xs shadow-md shadow-emerald-600/25 disabled:opacity-40"
          >
            Proses Pindah {terminology.class}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BatchClassMoveDialog;
