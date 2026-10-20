import React from "react";
import { cn } from "../../lib/utils";

export type NeonProgressVariant =
  | "emerald"
  | "success"
  | "rose"
  | "danger"
  | "amber"
  | "warning"
  | "sky"
  | "info"
  | "purple"
  | "neutral";

export interface NeonProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 - 100
  max?: number;
  variant?: NeonProgressVariant;
  size?: "xs" | "sm" | "md" | "lg";
  glow?: boolean;
  pulseHead?: boolean;
  barClassName?: string;
}

export const NeonProgress: React.FC<NeonProgressProps> = ({
  value,
  max = 100,
  variant = "emerald",
  size = "sm",
  glow = true,
  pulseHead = true,
  className,
  barClassName,
  ...props
}) => {
  const percentage = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));

  const variantStyles: Record<string, { bar: string; glow: string; head: string }> = {
    emerald: {
      bar: "bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 dark:from-emerald-500 dark:via-emerald-400 dark:to-teal-300",
      glow: "shadow-[0_0_10px_rgba(16,185,129,0.35)]",
      head: "bg-emerald-100 dark:bg-emerald-100 shadow-[0_0_6px_#34d399]",
    },
    success: {
      bar: "bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 dark:from-emerald-500 dark:via-emerald-400 dark:to-teal-300",
      glow: "shadow-[0_0_10px_rgba(16,185,129,0.35)]",
      head: "bg-emerald-100 dark:bg-emerald-100 shadow-[0_0_6px_#34d399]",
    },
    amber: {
      bar: "bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 dark:from-amber-500 dark:via-amber-400 dark:to-yellow-300",
      glow: "shadow-[0_0_10px_rgba(245,158,11,0.35)]",
      head: "bg-amber-100 dark:bg-amber-100 shadow-[0_0_6px_#fbbf24]",
    },
    warning: {
      bar: "bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 dark:from-amber-500 dark:via-amber-400 dark:to-yellow-300",
      glow: "shadow-[0_0_10px_rgba(245,158,11,0.35)]",
      head: "bg-amber-100 dark:bg-amber-100 shadow-[0_0_6px_#fbbf24]",
    },
    rose: {
      bar: "bg-gradient-to-r from-rose-600 via-rose-500 to-red-400 dark:from-rose-500 dark:via-rose-400 dark:to-red-300",
      glow: "shadow-[0_0_10px_rgba(244,63,94,0.4)]",
      head: "bg-rose-100 dark:bg-rose-100 shadow-[0_0_6px_#fb7185]",
    },
    danger: {
      bar: "bg-gradient-to-r from-rose-600 via-rose-500 to-red-400 dark:from-rose-500 dark:via-rose-400 dark:to-red-300",
      glow: "shadow-[0_0_10px_rgba(244,63,94,0.4)]",
      head: "bg-rose-100 dark:bg-rose-100 shadow-[0_0_6px_#fb7185]",
    },
    sky: {
      bar: "bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-400 dark:from-sky-500 dark:via-sky-400 dark:to-cyan-300",
      glow: "shadow-[0_0_10px_rgba(14,165,233,0.35)]",
      head: "bg-sky-100 dark:bg-sky-100 shadow-[0_0_6px_#38bdf8]",
    },
    info: {
      bar: "bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-400 dark:from-sky-500 dark:via-sky-400 dark:to-cyan-300",
      glow: "shadow-[0_0_10px_rgba(14,165,233,0.35)]",
      head: "bg-sky-100 dark:bg-sky-100 shadow-[0_0_6px_#38bdf8]",
    },
    purple: {
      bar: "bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-400 dark:from-purple-500 dark:via-purple-400 dark:to-indigo-300",
      glow: "shadow-[0_0_10px_rgba(168,85,247,0.35)]",
      head: "bg-purple-100 dark:bg-purple-100 shadow-[0_0_6px_#c084fc]",
    },
    neutral: {
      bar: "bg-neutral-500 dark:bg-neutral-400",
      glow: "shadow-none",
      head: "bg-neutral-200 dark:bg-neutral-200",
    },
  };

  const currentVariant = variantStyles[variant] || variantStyles.emerald;

  const sizeStyles = {
    xs: "h-1.5",
    sm: "h-2",
    md: "h-2.5",
    lg: "h-3.5",
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "w-full rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/90 overflow-hidden p-[1px] relative",
        sizeStyles[size],
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out relative",
          currentVariant.bar,
          glow && currentVariant.glow,
          barClassName
        )}
        style={{ width: `${percentage}%` }}
      >
        {pulseHead && percentage > 3 && percentage < 99 && (
          <span
            className={cn(
              "absolute right-0 top-0 bottom-0 w-1 rounded-full opacity-90",
              currentVariant.head
            )}
          />
        )}
      </div>
    </div>
  );
};
