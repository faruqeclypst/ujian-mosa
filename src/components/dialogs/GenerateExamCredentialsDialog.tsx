import { useState, useEffect } from "react";
import { NeonModal } from "../ui/NeonModal";
import { NeonButton } from "../ui/NeonButton";
import { Sparkles, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTenant } from "../../context/TenantContext";
import type { ClassData, StudentData } from "../../types/exam";

export type GenerateCredsScope = "selected" | "class" | "all";

interface GenerateExamCredentialsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  classes: ClassData[];
  students: StudentData[];
  onConfirm: (scope: GenerateCredsScope, selectedClassId?: string, onlyEmpty?: boolean) => void;
}

export const GenerateExamCredentialsDialog = ({
  isOpen,
  onOpenChange,
  selectedCount,
  classes,
  students,
  onConfirm,
}: GenerateExamCredentialsDialogProps) => {
  const { terminology } = useTenant();
  const [scope, setScope] = useState<GenerateCredsScope>("class");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [onlyEmpty, setOnlyEmpty] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setScope(selectedCount > 0 ? "selected" : "class");
      setSelectedClassId("");
      setOnlyEmpty(true);
    }
  }, [isOpen, selectedCount]);

  const handleExecute = () => {
    onOpenChange(false);
    onConfirm(scope, selectedClassId, onlyEmpty);
  };

  return (
    <NeonModal
      isOpen={isOpen}
      onClose={() => onOpenChange(false)}
      title="Generate Sandi Ujian"
      subtitle="Buat username & password kartu ujian (TU[NISN] + sandi acak)"
      icon={Sparkles}
      iconColor="purple"
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
            color="purple"
            size="sm"
            disabled={scope === "class" && !selectedClassId}
            onClick={handleExecute}
          >
            Generate Sandi Ujian
          </NeonButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
            Cakupan Generate:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => setScope("selected")}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all text-center gap-1 cursor-pointer",
                scope === "selected"
                  ? "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300 dark:border-purple-500/40 shadow-xs"
                  : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400",
                selectedCount === 0 && "opacity-40 cursor-not-allowed"
              )}
            >
              <span>Terpilih</span>
              <span className="text-[10px] font-normal opacity-80 font-mono">({selectedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setScope("class")}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all text-center gap-1 cursor-pointer",
                scope === "class"
                  ? "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300 dark:border-purple-500/40 shadow-xs"
                  : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400"
              )}
            >
              <span>Per {terminology.class}</span>
              <span className="text-[10px] font-normal opacity-80">Pilih kelas</span>
            </button>

            <button
              type="button"
              onClick={() => setScope("all")}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all text-center gap-1 cursor-pointer",
                scope === "all"
                  ? "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300 dark:border-purple-500/40 shadow-xs"
                  : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400"
              )}
            >
              <span>Semua Akun</span>
              <span className="text-[10px] font-normal opacity-80">Seluruh siswa</span>
            </button>
          </div>
        </div>

        {scope === "selected" && (
          <div className="p-3 bg-purple-500/10 dark:bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-purple-800 dark:text-purple-300 font-medium">
            Akan memproses <strong className="font-bold">{selectedCount} {terminology.student.toLowerCase()}</strong> yang dicentang di tabel.
          </div>
        )}

        {scope === "class" && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
              Pilih {terminology.class}:
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full h-10 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 px-3 text-xs font-semibold text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer"
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

        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
            Mode Generate:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOnlyEmpty(true)}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all text-center gap-1 cursor-pointer",
                onlyEmpty
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 dark:border-emerald-500/40 shadow-xs"
                  : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400"
              )}
            >
              <span>Hanya yang Kosong</span>
              <span className="text-[10px] font-normal opacity-80">Sandi lama tidak berubah</span>
            </button>

            <button
              type="button"
              onClick={() => setOnlyEmpty(false)}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all text-center gap-1 cursor-pointer",
                !onlyEmpty
                  ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 dark:border-rose-500/40 shadow-xs"
                  : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400"
              )}
            >
              <span>Generate Ulang</span>
              <span className="text-[10px] font-normal opacity-80">Sandi lama diganti baru</span>
            </button>
          </div>
        </div>

        {scope === "all" && !onlyEmpty && (
          <div className="p-3.5 bg-rose-500/10 dark:bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1">
            <p className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" /> PERHATIAN
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
              Sandi ujian SELURUH {terminology.student.toLowerCase()} akan diganti baru. Kartu ujian yang sudah dicetak dengan sandi lama tidak berlaku lagi dan harus dicetak ulang.
            </p>
          </div>
        )}
      </div>
    </NeonModal>
  );
};

export default GenerateExamCredentialsDialog;
