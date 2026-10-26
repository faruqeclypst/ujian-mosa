import * as React from "react";
import { AlertCircle, AlertTriangle, AlertOctagon, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: "danger" | "warning" | "info" | "success";
  isLoading?: boolean;
  showCancel?: boolean;
  requireWord?: string;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  type = "info",
  isLoading = false,
  showCancel = true,
  requireWord,
}) => {
  const [inputValue, setInputValue] = React.useState("");

  React.useEffect(() => {
    if (isOpen) setInputValue("");
  }, [isOpen]);

  const isConfirmDisabled = isLoading || (requireWord ? inputValue !== requireWord : false);
  const icons = {
    danger: <AlertOctagon className="h-4 w-4 text-rose-600 dark:text-rose-400" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
    info: <HelpCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
    success: <AlertCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
  };

  const iconContainers = {
    danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    info: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  };

  const confirmBtnClasses = {
    danger: "bg-rose-600 hover:bg-rose-700 text-white border border-rose-600/50 shadow-2xs",
    warning: "bg-amber-600 hover:bg-amber-700 text-white border border-amber-600/50 shadow-2xs",
    info: "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/25",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600/50 shadow-2xs",
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#0c0d0e] border border-neutral-200/90 dark:border-neutral-800 p-5 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3 text-left">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${iconContainers[type]}`}>
              {icons[type]}
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {title}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400 text-left leading-relaxed pt-1">
            {description}
          </DialogDescription>
          {requireWord && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                Ketik <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200 uppercase">"{requireWord}"</span> untuk melanjutkan:
              </p>
              <input
                type="text"
                autoFocus
                className="w-full h-8 px-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono font-semibold uppercase text-neutral-900 dark:text-neutral-100"
                placeholder={requireWord}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              />
            </div>
          )}
        </DialogHeader>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-850">
          {showCancel && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={isLoading}
              className="h-8 px-3.5 text-xs font-medium rounded-md border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-850 text-neutral-700 dark:text-neutral-300"
            >
              {cancelLabel}
            </Button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            className={`${confirmBtnClasses[type]} inline-flex items-center justify-center whitespace-nowrap h-8 px-3.5 text-xs font-semibold rounded-md transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${!showCancel ? "w-full" : ""}`}
          >
            {isLoading ? "Memuat..." : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmationDialog;
