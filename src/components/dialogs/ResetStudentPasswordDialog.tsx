import { useState, useEffect } from "react";
import { NeonModal } from "../ui/NeonModal";
import { NeonButton } from "../ui/NeonButton";
import { KeyRound, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTenant } from "../../context/TenantContext";
import type { ClassData, StudentData } from "../../types/exam";

interface ResetStudentPasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  classes: ClassData[];
  students: StudentData[];
  onConfirmReset: (scope: "selected" | "class" | "all", selectedClassId?: string) => void;
}

export const ResetStudentPasswordDialog = ({
  isOpen,
  onOpenChange,
  selectedCount,
  classes,
  students,
  onConfirmReset,
}: ResetStudentPasswordDialogProps) => {
  const { terminology } = useTenant();
  const [resetScope, setResetScope] = useState<"selected" | "class" | "all">("class");
  const [resetSelectedClassId, setResetSelectedClassId] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setResetScope(selectedCount > 0 ? "selected" : "class");
      setResetSelectedClassId("");
    }
  }, [isOpen, selectedCount]);

  const activeStudentsCount = students.filter((s) => s.classId !== "ALUMNI").length;

  const handleExecute = () => {
    onOpenChange(false);
    onConfirmReset(resetScope, resetSelectedClassId);
  };

  return (
    <NeonModal
      isOpen={isOpen}
      onClose={() => onOpenChange(false)}
      title={`Reset Password ${terminology.student}`}
      subtitle="Kembalikan password ke nilai awal (12345678)"
      icon={KeyRound}
      iconColor="amber"
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
            color="amber"
            size="sm"
            disabled={resetScope === "class" && !resetSelectedClassId}
            onClick={handleExecute}
          >
            Proses Reset Password
          </NeonButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
            Cakupan Reset:
          </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => setResetScope("selected")}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all text-center gap-1 cursor-pointer",
                  resetScope === "selected"
                    ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 dark:border-amber-500/40 shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400",
                  selectedCount === 0 && "opacity-40 cursor-not-allowed"
                )}
              >
                <span>Terpilih</span>
                <span className="text-[10px] font-normal opacity-80 font-mono">({selectedCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setResetScope("class")}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all text-center gap-1 cursor-pointer",
                  resetScope === "class"
                    ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 dark:border-amber-500/40 shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400"
                )}
              >
                <span>Per {terminology.class}</span>
                <span className="text-[10px] font-normal opacity-80">Pilih kelas</span>
              </button>

              <button
                type="button"
                onClick={() => setResetScope("all")}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all text-center gap-1 cursor-pointer",
                  resetScope === "all"
                    ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 dark:border-rose-500/40 shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400"
                )}
              >
                <span>Semua Akun</span>
                <span className="text-[10px] font-normal opacity-80">Seluruh siswa</span>
              </button>
            </div>
          </div>

          {resetScope === "selected" && (
            <div className="p-3 bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium">
              Akan mereset password <strong className="font-bold">{selectedCount} {terminology.student.toLowerCase()}</strong> yang dicentang di tabel.
            </div>
          )}

          {resetScope === "class" && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                Pilih {terminology.class}:
              </label>
              <select
                value={resetSelectedClassId}
                onChange={(e) => setResetSelectedClassId(e.target.value)}
                className="w-full h-10 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 px-3 text-xs font-semibold text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
              >
                <option value="">-- Pilih {terminology.class} --</option>
                {classes.map((cls) => {
                  const count = students.filter((s) => s.classId === cls.id).length;
                  return (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({count} {terminology.student})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {resetScope === "all" && (
            <div className="p-3.5 bg-rose-500/10 dark:bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" /> PERHATIAN
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                Anda akan mereset password SELURUH <strong className="font-extrabold">{activeStudentsCount} {terminology.student.toLowerCase()}</strong> aktif menjadi <strong className="font-mono">12345678</strong>.
              </p>
            </div>
          )}
        </div>
    </NeonModal>
  );
};

export default ResetStudentPasswordDialog;
