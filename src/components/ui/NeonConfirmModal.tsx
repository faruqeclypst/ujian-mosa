import * as React from "react";
import { AlertCircle, AlertTriangle, AlertOctagon, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { NeonButton, type NeonButtonVariant, type NeonButtonColor } from "./NeonButton";

export type NeonConfirmType = "danger" | "warning" | "info" | "success";

export interface NeonConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: NeonConfirmType;
  isLoading?: boolean;
  showCancel?: boolean;
  requireWord?: string;
  icon?: React.ElementType;
}

interface TypeConfig {
  dotClass: string;
  iconBoxClass: string;
  defaultIcon: React.ReactNode;
  buttonVariant: NeonButtonVariant;
  buttonColor?: NeonButtonColor;
}

const TYPE_CONFIGS: Record<NeonConfirmType, TypeConfig> = {
  danger: {
    dotClass: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]",
    iconBoxClass:
      "bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 text-rose-600 dark:text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.2)]",
    defaultIcon: <AlertOctagon className="h-5 w-5" />,
    buttonVariant: "danger",
    buttonColor: "rose",
  },
  warning: {
    dotClass: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]",
    iconBoxClass:
      "bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]",
    defaultIcon: <AlertTriangle className="h-5 w-5" />,
    buttonVariant: "primary",
    buttonColor: "amber",
  },
  info: {
    dotClass: "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.7)]",
    iconBoxClass:
      "bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/25 text-sky-600 dark:text-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.2)]",
    defaultIcon: <HelpCircle className="h-5 w-5" />,
    buttonVariant: "primary",
    buttonColor: "sky",
  },
  success: {
    dotClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]",
    iconBoxClass:
      "bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
    defaultIcon: <AlertCircle className="h-5 w-5" />,
    buttonVariant: "primary",
    buttonColor: "brand",
  },
};

export const NeonConfirmModal: React.FC<NeonConfirmModalProps> = ({
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
  icon: CustomIcon,
}) => {
  const [inputValue, setInputValue] = React.useState("");

  React.useEffect(() => {
    if (isOpen) setInputValue("");
  }, [isOpen]);

  const config = TYPE_CONFIGS[type] || TYPE_CONFIGS.info;
  const isConfirmDisabled = isLoading || (requireWord ? inputValue.trim() !== requireWord.trim() : false);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isLoading) onClose(); }}>
      <DialogContent
        className="max-w-md w-[calc(100vw-2rem)] bg-white dark:bg-[#0c0d0e] border border-neutral-200/90 dark:border-neutral-800 rounded-2xl shadow-2xl p-0 overflow-hidden"
        hideClose={isLoading}
      >
        {/* Header Bar */}
        <div className="px-5 sm:px-6 py-4 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-[#111214] flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl ${config.iconBoxClass} flex items-center justify-center shrink-0`}
          >
            {CustomIcon ? <CustomIcon className="h-5 w-5" /> : config.defaultIcon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${config.dotClass} shrink-0`} />
              <DialogTitle className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight truncate">
                {title}
              </DialogTitle>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-4 bg-white dark:bg-[#0c0d0e]">
          <DialogDescription asChild>
            <div className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed text-left">
              {description}
            </div>
          </DialogDescription>

          {requireWord && (
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#111214] border border-neutral-200/80 dark:border-neutral-800 space-y-2 text-left">
              <p className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                Ketik{" "}
                <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
                  "{requireWord}"
                </span>{" "}
                untuk mengonfirmasi tindakan ini:
              </p>
              <input
                type="text"
                autoFocus
                className="w-full h-9.5 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0c0d0e] focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-xs font-mono font-semibold uppercase text-neutral-900 dark:text-neutral-100 transition-colors"
                placeholder={requireWord}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                disabled={isLoading}
              />
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-[#111214]/60 flex items-center justify-end gap-2.5">
          {showCancel && (
            <NeonButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
            >
              {cancelLabel}
            </NeonButton>
          )}

          <NeonButton
            type="button"
            variant={config.buttonVariant}
            color={config.buttonColor}
            size="sm"
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            loading={isLoading}
          >
            {confirmLabel}
          </NeonButton>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NeonConfirmModal;

