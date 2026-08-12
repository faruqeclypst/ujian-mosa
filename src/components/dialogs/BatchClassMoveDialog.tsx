import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
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

export const BatchClassMoveDialog = ({
  isOpen,
  onOpenChange,
  selectedCount,
  classes,
  targetClassId,
  onTargetClassChange,
  onSubmit,
}: BatchClassMoveDialogProps) => {
  const { terminology } = useTenant();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-orange-500" />
            Pindah {terminology.class} ({selectedCount} {terminology.student})
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pilih {terminology.class.toLowerCase()} baru untuk {terminology.student.toLowerCase()}-{terminology.student.toLowerCase()} yang terpilih.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih {terminology.class} Tujuan:</label>
            <select
              value={targetClassId}
              onChange={(e) => onTargetClassChange(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all cursor-pointer dark:bg-slate-900/50 dark:border-slate-800"
            >
              <option value="">-- Pilih {terminology.class} --</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-slate-200 dark:border-slate-800">Batal</Button>
          <Button
            disabled={!targetClassId}
            onClick={onSubmit}
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-500/20"
          >
            Proses Pindah {terminology.class}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BatchClassMoveDialog;
