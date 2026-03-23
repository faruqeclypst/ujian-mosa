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
    danger: "destructive" as const,
    warning: "default" as const,
    info: "default" as const,
    success: "default" as const,
  };

  const btnClasses = {
    danger: "bg-red-600 hover:bg-red-700 text-white",
    warning: "bg-amber-500 hover:bg-amber-600 text-white",
    info: "bg-blue-600 hover:bg-blue-700 text-white",
    success: "bg-green-600 hover:bg-green-700 text-white",
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
              className="h-11 px-6 text-sm font-medium"
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            type="button"
            variant={btnVariants[type]}
            onClick={onConfirm}
            disabled={isLoading}
            className={`${btnClasses[type]} h-11 px-6 text-sm font-medium ${!showCancel ? "w-full" : ""}`}
          >
            {isLoading ? "Memuat..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  );
};

