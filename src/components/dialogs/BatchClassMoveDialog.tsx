import React from "react";
import { NeonModal } from "../ui/NeonModal";
import { NeonButton } from "../ui/NeonButton";
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
    <NeonModal
      isOpen={isOpen}
      onClose={() => onOpenChange(false)}
      title={`Pindah ${terminology.class}`}
      subtitle={`${selectedCount} ${terminology.student.toLowerCase()} terpilih akan dipindahkan`}
      icon={ArrowLeftRight}
      size="sm"
      footer={
        <>
          <NeonButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </NeonButton>
          <NeonButton
            type="button"
            variant="primary"
            color="brand"
            size="sm"
            disabled={!targetClassId}
            onClick={onSubmit}
          >
            Proses Pindah {terminology.class}
          </NeonButton>
        </>
      }
    >
      <div className="space-y-2">
        <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
          Pilih {terminology.class} Tujuan:
        </label>
        <select
          value={targetClassId}
          onChange={(e) => onTargetClassChange(e.target.value)}
          className="w-full h-10 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 px-3 text-xs font-semibold text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
        >
          <option value="">-- Pilih {terminology.class} --</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </select>
      </div>
    </NeonModal>
  );
};

export default BatchClassMoveDialog;
