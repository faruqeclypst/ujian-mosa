import React from "react";
import { cn } from "../../lib/utils";

export interface NeonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const NeonCard: React.FC<NeonCardProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#0f1115] shadow-2xs overflow-hidden transition-all duration-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export interface NeonCardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ElementType;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export const NeonCardHeader: React.FC<NeonCardHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  badge,
  actions,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className="w-6 h-6 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 text-neutral-600 dark:text-neutral-300">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {actions}
      </div>
    </div>
  );
};

export interface NeonCardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const NeonCardBody: React.FC<NeonCardBodyProps> = ({ children, className, ...props }) => {
  return (
    <div className={cn("p-5 space-y-5", className)} {...props}>
      {children}
    </div>
  );
};
