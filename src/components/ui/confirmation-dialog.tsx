import * as React from "react";
import { AlertCircle, AlertTriangle, AlertOctagon, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./button";

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
}) => {
  const icons = {
    danger: <AlertOctagon className="h-5 w-5 text-red-600" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    info: <HelpCircle className="h-5 w-5 text-blue-600" />,
    success: <AlertCircle className="h-5 w-5 text-green-600" />,
  };

  const bgColors = {
    danger: "bg-red-100 dark:bg-red-900/20",
    warning: "bg-amber-100 dark:bg-amber-900/20",
    info: "bg-blue-100 dark:bg-blue-900/20",
    success: "bg-green-100 dark:bg-green-900/20",
  };

  const btnVariants = {
    danger: "secondary" as const,
    warning: "secondary" as const,
    info: "secondary" as const,
    success: "secondary" as const,
  };

  const btnClasses = {
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 dark:bg-rose-900/40 dark:text-rose-400 dark:border-rose-800/20 dark:hover:bg-rose-900/50",
    warning: "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800/20 dark:hover:bg-amber-900/50",
    info: "bg-blue-50 text-blue-700 !hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800/20 dark:!hover:bg-blue-900/50",
    success: "bg-green-50 text-green-700 !hover:bg-green-100 border border-green-100 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800/20 dark:!hover:bg-green-900/50",
  };

  const iconColors = {
    danger: "text-red-600",
    warning: "text-amber-600",
    info: "text-blue-600",
    success: "text-green-600",
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 !p-7 sm:!p-8">
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-4 text-left">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${bgColors[type]}`}>
              {React.cloneElement(icons[type] as React.ReactElement, { 
                className: `h-6 w-6 ${iconColors[type]}` 
              })}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {title}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-base text-gray-600 dark:text-gray-400 text-left leading-relaxed pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end mt-10">
          {showCancel && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={isLoading}
              className="h-11 px-6 text-sm font-medium border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {cancelLabel}
            </Button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`${btnClasses[type]} inline-flex items-center justify-center whitespace-nowrap h-11 px-6 text-sm font-medium rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95 ${!showCancel ? "w-full" : ""}`}
          >
            {isLoading ? "Memuat..." : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  );
};

