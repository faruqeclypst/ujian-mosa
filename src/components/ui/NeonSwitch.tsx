import React from "react";
import { cn } from "../../lib/utils";

export interface NeonSwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size" | "onChange"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: "sm" | "md";
  variant?: "emerald" | "neutral" | "blue" | "amber";
  label?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ElementType;
}

export const NeonSwitch: React.FC<NeonSwitchProps> = ({
  checked,
  onChange,
  size = "md",
  variant = "emerald",
  label,
  description,
  icon: Icon,
  disabled = false,
  className,
  id,
  ...props
}) => {
  const switchId = id || React.useId();

  // Active track colors
  const activeTrackColor = {
    emerald: "bg-emerald-600 dark:bg-emerald-500",
    neutral: "bg-neutral-900 dark:bg-neutral-100",
    blue: "bg-blue-600 dark:bg-blue-500",
    amber: "bg-amber-500 dark:bg-amber-500",
  }[variant];

  // Inactive track color
  const inactiveTrackColor = "bg-neutral-300 dark:bg-neutral-700";

  // Dimensions
  const trackDimensions = size === "sm" ? "w-9 h-5 p-0.5" : "w-11 h-6 p-0.5";
  const knobDimensions = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const knobTranslate = size === "sm" 
    ? (checked ? "translate-x-4" : "translate-x-0") 
    : (checked ? "translate-x-5" : "translate-x-0");

  const switchControl = (
    <button
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      className={cn(
        "relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 shrink-0 select-none",
        trackDimensions,
        checked ? activeTrackColor : inactiveTrackColor,
        disabled && "opacity-50 cursor-not-allowed"
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block rounded-full bg-white shadow-md transform ring-0 transition duration-200 ease-in-out",
          knobDimensions,
          knobTranslate
        )}
      />
    </button>
  );

  if (!label && !description) {
    return switchControl;
  }

  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-all duration-150 cursor-pointer select-none",
        checked
          ? "border-neutral-300 dark:border-neutral-700 bg-neutral-50/70 dark:bg-neutral-850/40"
          : "border-neutral-200/70 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/30 hover:border-neutral-300 dark:hover:border-neutral-700",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
              checked
                ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 space-y-0.5">
          <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 leading-snug">
            {label}
          </div>
          {description && (
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()} className="shrink-0 pt-0.5">
        {switchControl}
      </div>
    </div>
  );
};

