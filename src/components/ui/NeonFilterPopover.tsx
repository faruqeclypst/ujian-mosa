import React, { useState, useRef, useEffect } from "react";
import { SlidersHorizontal, ChevronDown, RotateCcw, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface NeonFilterPopoverProps {
  title?: string;
  buttonLabel?: string;
  activeCount?: number;
  onReset?: () => void;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  buttonClassName?: string;
}

export const NeonFilterPopover: React.FC<NeonFilterPopoverProps> = ({
  title = "Filter Data",
  buttonLabel = "Filter",
  activeCount = 0,
  onReset,
  children,
  align = "left",
  className,
  buttonClassName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const hasActive = activeCount > 0;

  return (
    <div ref={containerRef} className={cn("relative inline-flex items-center gap-1.5", className)}>
      {/* 1. Main Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={`${buttonLabel} (${activeCount} aktif)`}
        className={cn(
          "h-8 px-2.5 text-xs rounded-md border flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs select-none",
          hasActive
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 font-bold"
            : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-850 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium",
          isOpen && "ring-1 ring-emerald-500/30 border-emerald-400 dark:border-emerald-600",
          buttonClassName
        )}
      >
        <SlidersHorizontal
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-colors",
            hasActive ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500 dark:text-neutral-400"
          )}
        />
        <span>{buttonLabel}</span>

        {hasActive && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none bg-emerald-600 text-white shadow-2xs">
            {activeCount}
          </span>
        )}

        <ChevronDown
          className={cn(
            "h-3 w-3 text-neutral-400 transition-transform duration-150 shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* 2. Quick Reset Button (Visible outside when active) */}
      {hasActive && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="h-8 px-2 text-xs font-semibold text-neutral-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
          title="Reset semua filter"
        >
          <X className="h-3 w-3" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      )}

      {/* 3. Popover Card */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-full mt-1.5 z-50 w-72 sm:w-80 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-200">
              <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{title}</span>
            </div>

            {hasActive && onReset && (
              <button
                type="button"
                onClick={() => {
                  onReset();
                }}
                className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          {/* Form Fields / Controls */}
          <div className="space-y-2.5">{children}</div>
        </div>
      )}
    </div>
  );
};

// ── Sub-component: Filter Field Wrapper with Label ──
export interface NeonFilterFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export const NeonFilterField: React.FC<NeonFilterFieldProps> = ({
  label,
  children,
  className,
}) => {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
        {label}
      </label>
      {children}
    </div>
  );
};

// ── Sub-component: Standard Styled Filter Select ──
export interface NeonFilterSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const NeonFilterSelect = React.forwardRef<
  HTMLSelectElement,
  NeonFilterSelectProps
>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "h-8 w-full text-xs font-medium rounded-md bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 px-2.5 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400 cursor-pointer transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
NeonFilterSelect.displayName = "NeonFilterSelect";

