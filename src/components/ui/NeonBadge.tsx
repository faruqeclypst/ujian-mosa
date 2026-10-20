import React from "react";
import { cn } from "../../lib/utils";

export type NeonBadgeVariant =
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

export interface NeonBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: NeonBadgeVariant;
  pulse?: boolean;
  mono?: boolean;
  size?: "xs" | "sm" | "md";
  icon?: React.ElementType;
  children: React.ReactNode;
}

export const NeonBadge: React.FC<NeonBadgeProps> = ({
  variant = "neutral",
  pulse = false,
  mono = false,
  size = "xs",
  icon: Icon,
  children,
  className,
  ...props
}) => {
  const variantStyles: Record<string, { container: string; dot: string }> = {
    emerald: {
      container: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      dot: "bg-emerald-500",
    },
    success: {
      container: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      dot: "bg-emerald-500",
    },
    rose: {
      container: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
      dot: "bg-rose-500",
    },
    danger: {
      container: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
      dot: "bg-rose-500",
    },
    amber: {
      container: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
      dot: "bg-amber-500",
    },
    warning: {
      container: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
      dot: "bg-amber-500",
    },
    sky: {
      container: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
      dot: "bg-sky-500",
    },
    info: {
      container: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
      dot: "bg-sky-500",
    },
    purple: {
      container: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
      dot: "bg-purple-500",
    },
    neutral: {
      container: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700",
      dot: "bg-neutral-400",
    },
  };

  const currentVariant = variantStyles[variant] || variantStyles.neutral;

  const sizeClasses = {
    xs: "px-1.5 py-0.2 text-[10px]",
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold shrink-0 transition-colors",
        currentVariant.container,
        sizeClasses[size],
        mono && "font-mono",
        className
      )}
      {...props}
    >
      {pulse && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full animate-pulse", currentVariant.dot)}
        />
      )}
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span>{children}</span>
    </span>
  );
};
