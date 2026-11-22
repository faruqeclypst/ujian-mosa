import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { NeonButton, type NeonButtonVariant, type NeonButtonColor } from "./NeonButton";

export type NeonModalSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";

const SIZE_CLASSES: Record<NeonModalSize, string> = {
  xs: "max-w-sm",
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  full: "max-w-[96vw]",
};

export type NeonModalIconColor = "brand" | "amber" | "sky" | "rose" | "purple" | "neutral";

const ICON_COLOR_STYLES: Record<NeonModalIconColor, { box: string; dot: string }> = {
  brand: {
    box: "bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
    dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]",
  },
  rose: {
    box: "bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 text-rose-600 dark:text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.15)]",
    dot: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]",
  },
  amber: {
    box: "bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
    dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]",
  },
  sky: {
    box: "bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/25 text-sky-600 dark:text-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.15)]",
    dot: "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.7)]",
  },
  purple: {
    box: "bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/25 text-purple-600 dark:text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)]",
    dot: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.7)]",
  },
  neutral: {
    box: "bg-neutral-500/10 dark:bg-neutral-500/15 border border-neutral-500/25 text-neutral-600 dark:text-neutral-400 shadow-[0_0_12px_rgba(115,115,115,0.15)]",
    dot: "bg-neutral-500 shadow-[0_0_8px_rgba(115,115,115,0.7)]",
  },
};

export interface NeonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ElementType;
  iconColor?: NeonModalIconColor;
  size?: NeonModalSize;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  asForm?: boolean;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  formId?: string;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  isSubmitDisabled?: boolean;
  submitVariant?: NeonButtonVariant;
  submitColor?: NeonButtonColor;
  hideFooter?: boolean;
  hideClose?: boolean;
  noPadding?: boolean;
  className?: string;
  bodyClassName?: string;
}

export interface NeonModalHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ElementType;
  iconColor?: NeonModalIconColor;
  onClose?: () => void;
  hideClose?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const NeonModalHeader: React.FC<NeonModalHeaderProps> = ({
  title,
  subtitle,
  badge,
  icon: Icon,
  iconColor = "brand",
  onClose,
  hideClose = false,
  className,
  children,
}) => {
  const colorStyle = ICON_COLOR_STYLES[iconColor] || ICON_COLOR_STYLES.brand;

  return (
    <div
      className={cn(
        "px-5 sm:px-6 py-3.5 sm:py-4 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-[#111214] flex items-center justify-between gap-3 shrink-0 z-10",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {Icon && (
          <div
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
              colorStyle.box
            )}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full shrink-0", colorStyle.dot)} />
            <DialogPrimitive.Title className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight truncate">
              {title}
            </DialogPrimitive.Title>
            {badge && (
              <span className="shrink-0">{badge}</span>
            )}
          </div>
          {subtitle && (
            <DialogPrimitive.Description className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
              {subtitle}
            </DialogPrimitive.Description>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {children}
        {!hideClose && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-lg inline-flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-850 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 transition-colors focus:outline-hidden cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export interface NeonModalBodyProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const NeonModalBody: React.FC<NeonModalBodyProps> = ({
  children,
  className,
  noPadding = false,
}) => {
  return (
    <div
      className={cn(
        "flex-1 min-h-0 overflow-y-auto overflow-x-hidden focus:outline-hidden",
        !noPadding && "p-5 sm:p-6 space-y-4",
        className
      )}
    >
      {children}
    </div>
  );
};

export interface NeonModalFooterProps {
  children?: React.ReactNode;
  className?: string;
  onCancel?: () => void;
  onSubmit?: (e?: any) => void;
  cancelLabel?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  isSubmitDisabled?: boolean;
  submitVariant?: NeonButtonVariant;
  submitColor?: NeonButtonColor;
  formId?: string;
}

export const NeonModalFooter: React.FC<NeonModalFooterProps> = ({
  children,
  className,
  onCancel,
  onSubmit,
  cancelLabel = "Batal",
  submitLabel = "Simpan",
  isSubmitting = false,
  isSubmitDisabled = false,
  submitVariant = "primary",
  submitColor = "brand",
  formId,
}) => {
  return (
    <div
      className={cn(
        "px-5 sm:px-6 py-3 sm:py-3.5 border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-[#111214]/80 flex items-center justify-end gap-2.5 shrink-0 z-10",
        className
      )}
    >
      {children ? (
        children
      ) : (
        <>
          {onCancel && (
            <NeonButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {cancelLabel}
            </NeonButton>
          )}
          <NeonButton
            type="submit"
            form={formId}
            variant={submitVariant}
            color={submitColor}
            size="sm"
            onClick={onSubmit}
            loading={isSubmitting}
            disabled={isSubmitDisabled || isSubmitting}
          >
            {submitLabel}
          </NeonButton>
        </>
      )}
    </div>
  );
};

export const NeonModal: React.FC<NeonModalProps> & {
  Header: typeof NeonModalHeader;
  Body: typeof NeonModalBody;
  Footer: typeof NeonModalFooter;
} = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  icon,
  iconColor = "brand",
  size = "md",
  children,
  footer,
  asForm = false,
  onSubmit,
  formId,
  submitLabel = "Simpan",
  cancelLabel = "Batal",
  isSubmitting = false,
  isSubmitDisabled = false,
  submitVariant = "primary",
  submitColor = "brand",
  hideFooter = false,
  hideClose = false,
  noPadding = false,
  className,
  bodyClassName,
}) => {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  const content = (
    <>
      {title && (
        <NeonModalHeader
          title={title}
          subtitle={subtitle}
          badge={badge}
          icon={icon}
          iconColor={iconColor}
          onClose={onClose}
          hideClose={hideClose || isSubmitting}
        />
      )}

      {children && (
        typeof children === "function" ? (
          children
        ) : (
          <NeonModalBody className={bodyClassName} noPadding={noPadding}>
            {children}
          </NeonModalBody>
        )
      )}

      {!hideFooter && (
        footer !== undefined ? (
          footer
        ) : (
          <NeonModalFooter
            onCancel={onClose}
            formId={formId}
            cancelLabel={cancelLabel}
            submitLabel={submitLabel}
            isSubmitting={isSubmitting}
            isSubmitDisabled={isSubmitDisabled}
            submitVariant={submitVariant}
            submitColor={submitColor}
          />
        )
      )}
    </>
  );

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[calc(100vw-1.5rem)] sm:w-full",
            sizeClass,
            // 🛡️ Batas tinggi absolut 720p: modal tidak pernah meluap di luar layar viewport
            "max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)]",
            "flex flex-col overflow-hidden",
            "bg-white dark:bg-[#0c0d0e]",
            "border border-neutral-200/90 dark:border-neutral-800",
            "rounded-2xl shadow-2xl",
            "duration-150 focus:outline-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className
          )}
        >
          {asForm ? (
            <form
              id={formId}
              onSubmit={onSubmit}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              {content}
            </form>
          ) : (
            content
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

NeonModal.Header = NeonModalHeader;
NeonModal.Body = NeonModalBody;
NeonModal.Footer = NeonModalFooter;

export default NeonModal;
