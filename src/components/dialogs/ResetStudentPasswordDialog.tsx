import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { KeyRound } from "lucide-react";
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

  const activeStudentsCount = students.filter(s => s.classId !== "ALUMNI").length;

  const handleExecute = () => {
    onOpenChange(false);
    onConfirmReset(resetScope, resetSelectedClassId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-500" />
            Reset Password {terminology.student}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Kembalikan password {terminology.student.toLowerCase()} ke nilai default <strong className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-amber-600 dark:text-amber-400">12345678</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cakupan Reset:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => setResetScope("selected")}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all text-center gap-1",
                  resetScope === "selected" 
                    ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-600 shadow-sm"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400",
                  selectedCount === 0 && "opacity-40 cursor-not-allowed"
                )}
              >
                <span>Terpilih</span>
                <span className="text-[10px] font-normal opacity-80">({selectedCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setResetScope("class")}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all text-center gap-1",
                  resetScope === "class" 
                    ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-600 shadow-sm"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
                )}
              >
                <span>Per {terminology.class}</span>
                <span className="text-[10px] font-normal opacity-80">Pilih kelas</span>
              </button>

              <button
                type="button"
                onClick={() => setResetScope("all")}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all text-center gap-1",
                  resetScope === "all" 
                    ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-600 shadow-sm"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
                )}
              >
                <span>Semua Akun</span>
                <span className="text-[10px] font-normal opacity-80">Seluruh siswa</span>
              </button>
            </div>
          </div>

          {resetScope === "selected" && (
            <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-xl text-xs text-amber-800 dark:text-amber-300">
              Akan mereset password <strong className="font-bold">{selectedCount} {terminology.student.toLowerCase()}</strong> yang dicentang di tabel.
            </div>
          )}

          {resetScope === "class" && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih {terminology.class}:</label>
              <select
                value={resetSelectedClassId}
                onChange={(e) => setResetSelectedClassId(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all cursor-pointer dark:bg-slate-900/50 dark:border-slate-800"
              >
                <option value="">-- Pilih {terminology.class} --</option>
                {classes.map(cls => {
                  const count = students.filter(s => s.classId === cls.id).length;
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
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-xl space-y-1">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                ⚠️ PERHATIAN
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">
                Anda akan mereset password SELURUH <strong className="font-extrabold">{activeStudentsCount} {terminology.student.toLowerCase()}</strong> aktif menjadi <strong>12345678</strong>. {terminology.student} harus mengganti password kembali setelah login.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-slate-200 dark:border-slate-800">
            Batal
          </Button>
          <Button
            disabled={resetScope === "class" && !resetSelectedClassId}
            onClick={handleExecute}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg shadow-amber-500/20"
          >
            Proses Reset Password
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResetStudentPasswordDialog;
