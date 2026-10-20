import React from "react";
import { Skeleton } from "./skeleton";
import { cn } from "../../lib/utils";

// ── 1. Grid Container for Stats ──
export interface NeonStatGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 5;
}

export const NeonStatGrid: React.FC<NeonStatGridProps> = ({
  children,
  cols = 4,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "grid gap-3",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 sm:grid-cols-3",
        cols === 4 && "grid-cols-2 sm:grid-cols-4",
        cols === 5 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// ── 2. Individual Stat Card ──
export interface NeonStatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  indicator?: boolean | React.ReactNode;
  actionSlot?: React.ReactNode;
  icon?: React.ElementType;
  subValue?: React.ReactNode;
  subText?: React.ReactNode;
  labelClassName?: string;
  valueClassName?: string;
  isLoading?: boolean;
}

export const NeonStatCard: React.FC<NeonStatCardProps> = ({
  label,
  value,
  unit,
  indicator,
  actionSlot,
  icon: Icon,
  subValue,
  subText,
  labelClassName,
  valueClassName,
  isLoading = false,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex flex-col justify-between gap-1.5 min-h-[86px]",
        className
      )}
      {...props}
    >
      {/* Top row: Label + Indicator / Action / Icon */}
      <div className={cn("flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 min-h-[28px]", labelClassName)}>
        <div className="flex items-center gap-1.5 font-medium truncate">
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-500" />}
          <span className="truncate">{label}</span>
          {indicator === true && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          )}
          {typeof indicator === "object" && indicator}
        </div>

        {actionSlot && <div className="shrink-0">{actionSlot}</div>}
      </div>

      {/* Main Value Row */}
      <div className="flex items-baseline justify-between gap-2">
        <div className={cn("text-xl sm:text-2xl font-mono font-bold text-neutral-900 dark:text-neutral-100 flex items-baseline gap-1", valueClassName)}>
          {isLoading ? (
            <Skeleton className="h-7 w-16 inline-block" />
          ) : (
            <>
              <span>{value}</span>
              {unit && (
                <span className="text-xs font-normal font-sans text-neutral-500 dark:text-neutral-400">
                  {unit}
                </span>
              )}
            </>
          )}
        </div>

        {subValue && (
          <div className="text-[11px] font-mono text-neutral-400 shrink-0">
            {subValue}
          </div>
        )}
      </div>

      {/* Optional subText */}
      {subText && (
        <div className="text-[11px] text-neutral-400 dark:text-neutral-500 font-sans mt-0.5">
          {subText}
        </div>
      )}
    </div>
  );
};
