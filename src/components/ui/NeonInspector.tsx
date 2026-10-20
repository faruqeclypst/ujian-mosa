import React from "react";
import { cn } from "../../lib/utils";

// ── 1. Main Inspector Container / Aside ──
export interface NeonInspectorProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  /** When true, sidebar sticks to the top during scroll on desktop */
  isSticky?: boolean;
  /** Custom width classes, defaults to standard Neon Console width */
  widthClassName?: string;
  /** Enable vertical scroll container within viewport height */
  scrollable?: boolean;
}

export const NeonInspector: React.FC<NeonInspectorProps> = ({
  children,
  className,
  isSticky = true,
  widthClassName = "w-full xl:w-[300px] 2xl:w-[320px]",
  scrollable = false,
  ...props
}) => {
  return (
    <aside
      className={cn(
        "shrink-0 space-y-6",
        widthClassName,
        isSticky && "xl:sticky xl:top-6",
        scrollable && "xl:max-h-[calc(100vh-3.5rem)] xl:overflow-y-auto pr-1",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
};

// ── 2. Inspector Section (Group of related fields) ──
export interface InspectorSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Adds top border separation matching Neon Console standard */
  divided?: boolean;
}

export const InspectorSection: React.FC<InspectorSectionProps> = ({
  children,
  divided = false,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "space-y-3",
        divided && "pt-3 border-t border-neutral-200 dark:border-neutral-800",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// ── 3. Inspector Header ──
export interface InspectorHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  icon?: React.ElementType;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  onClose?: () => void;
}

export const InspectorHeader: React.FC<InspectorHeaderProps> = ({
  title,
  icon: Icon,
  badge,
  actions,
  onClose,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-xs font-semibold text-neutral-900 dark:text-neutral-100 pb-1 border-b border-neutral-200 dark:border-neutral-800",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {Icon && <Icon className="h-3.5 w-3.5 text-neutral-500 shrink-0" />}
        <span className="truncate">{title}</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {badge !== undefined && (
          typeof badge === "string" ? (
            <span className="text-[10px] font-mono text-neutral-400">
              {badge}
            </span>
          ) : (
            badge
          )
        )}
        {actions}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            title="Tutup Panel Detail"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

// ── 4. Inspector Field (Label + Value) ──
export interface InspectorFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value?: React.ReactNode;
  children?: React.ReactNode;
  hint?: React.ReactNode;
  truncate?: boolean;
  mono?: boolean;
  actionSlot?: React.ReactNode;
}

export const InspectorField: React.FC<InspectorFieldProps> = ({
  label,
  value,
  children,
  hint,
  truncate = true,
  mono = false,
  actionSlot,
  className,
  ...props
}) => {
  return (
    <div className={cn("space-y-0.5", className)} {...props}>
      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
        <span>{label}</span>
        {hint && <span className="text-[10px] text-neutral-400 font-normal">{hint}</span>}
      </div>
      <div className="flex items-center justify-between gap-1">
        <div
          className={cn(
            "font-semibold text-neutral-900 dark:text-neutral-100 text-xs",
            mono && "font-mono font-normal text-neutral-700 dark:text-neutral-300",
            truncate && "truncate"
          )}
        >
          {value ?? children}
        </div>
        {actionSlot && <div className="shrink-0">{actionSlot}</div>}
      </div>
    </div>
  );
};

// ── 5. Multi-column Field Grid ──
export interface InspectorGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
  divided?: boolean;
}

export const InspectorGrid: React.FC<InspectorGridProps> = ({
  children,
  cols = 2,
  divided = true,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "grid gap-2",
        cols === 2 && "grid-cols-2",
        cols === 3 && "grid-cols-3",
        cols === 4 && "grid-cols-4",
        divided && "pt-1 border-t border-neutral-100 dark:border-neutral-800",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// ── 6. Inspector Actions Wrapper ──
export interface InspectorActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  divided?: boolean;
}

export const InspectorActions: React.FC<InspectorActionsProps> = ({
  children,
  divided = false,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "pt-2 space-y-1.5",
        divided && "border-t border-neutral-100 dark:border-neutral-800",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// ── 7. Inspector Button ──
export interface InspectorButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost";
  icon?: React.ElementType;
  children: React.ReactNode;
}

export const InspectorButton: React.FC<InspectorButtonProps> = ({
  variant = "secondary",
  icon: Icon,
  children,
  className,
  type = "button",
  ...props
}) => {
  const baseClasses = "w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-30 disabled:pointer-events-none";

  const variantClasses = {
    primary: "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs",
    secondary: "bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800",
    success: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
    danger: "bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/20",
    ghost: "bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 shadow-none",
  };

  return (
    <button
      type={type}
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span>{children}</span>
    </button>
  );
};

// ── 8. Inspector Helper / Tip Box ──
export interface InspectorCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  icon?: React.ElementType;
  description?: React.ReactNode;
  actionSlot?: React.ReactNode;
  children?: React.ReactNode;
}

export const InspectorCard: React.FC<InspectorCardProps> = ({
  title,
  icon: Icon,
  description,
  actionSlot,
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 text-xs space-y-2",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between font-semibold text-neutral-900 dark:text-neutral-100">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5 text-neutral-500 shrink-0" />}
          <span>{title}</span>
        </div>
        {actionSlot}
      </div>

      {description && (
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
          {description}
        </p>
      )}

      {children}
    </div>
  );
};

// ── 9. Inspector Empty State ──
export interface InspectorEmptyProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  message?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ElementType;
  children?: React.ReactNode;
}

export const InspectorEmpty: React.FC<InspectorEmptyProps> = ({
  message,
  title,
  description,
  icon: Icon,
  children,
  className,
  ...props
}) => {
  if (title || description || Icon) {
    return (
      <div
        className={cn(
          "p-4 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center space-y-2 py-6",
          className
        )}
        {...props}
      >
        {Icon && (
          <div className="w-9 h-9 mx-auto rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400">
            <Icon className="h-4 w-4" />
          </div>
        )}
        {title && (
          <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {title}
          </div>
        )}
        {description && (
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 leading-relaxed max-w-[220px] mx-auto">
            {description}
          </p>
        )}
        {children}
      </div>
    );
  }

  return (
    <p
      className={cn("text-xs text-neutral-400 italic py-1", className)}
      {...props}
    >
      {children ?? message ?? "Pilih atau arahkan kursor ke salah satu baris pada tabel."}
    </p>
  );
};

// ── 10. Inspector Prev / Next Quick Nav Bar ──
export interface InspectorNavProps extends React.HTMLAttributes<HTMLDivElement> {
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  previousLabel?: string;
  nextLabel?: string;
}

export const InspectorNav: React.FC<InspectorNavProps> = ({
  onPrevious,
  onNext,
  hasPrevious = true,
  hasNext = true,
  previousLabel = "Sebelumnya",
  nextLabel = "Selanjutnya",
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800",
        className
      )}
      {...props}
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={!hasPrevious}
        className="py-1.5 px-2 text-xs font-semibold rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-850 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        <span>{previousLabel}</span>
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        className="py-1.5 px-2 text-xs font-semibold rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-850 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
      >
        <span>{nextLabel}</span>
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>
  );
};

// ── 11. Inspector Toggle Button for Table Toolbars ──
export interface InspectorToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  onToggle?: () => void;
  label?: string;
}

export const InspectorToggle: React.FC<InspectorToggleProps> = ({
  active,
  onToggle,
  label = "Panel Detail",
  className,
  ...props
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer shadow-2xs",
        active
          ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white"
          : "bg-white dark:bg-neutral-850 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800",
        className
      )}
      title={active ? "Sembunyikan panel detail" : "Tampilkan panel detail"}
      {...props}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-400 animate-pulse" : "bg-neutral-400")} />
      <span>{label}</span>
      <span className="text-[10px] opacity-75 font-mono ml-0.5">
        {active ? "Aktif" : "Mati"}
      </span>
    </button>
  );
};
