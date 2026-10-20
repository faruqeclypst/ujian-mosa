import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "../../lib/utils";

export interface NeonPageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  onBack?: () => void;
  backTo?: string;
  backTitle?: string;
  bordered?: boolean;
}

export const NeonPageHeader: React.FC<NeonPageHeaderProps> = ({
  title,
  subtitle,
  meta,
  breadcrumbs,
  badge,
  actions,
  onBack,
  backTo,
  backTitle = "Kembali",
  bordered = false,
  className,
  ...props
}) => {
  const renderBackButton = () => {
    if (!onBack && !backTo) return null;

    const buttonClass =
      "h-8.5 w-8.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors shrink-0 cursor-pointer shadow-2xs flex items-center justify-center";

    if (backTo) {
      return (
        <Link to={backTo} className={buttonClass} title={backTitle}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={onBack}
        className={buttonClass}
        title={backTitle}
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
        bordered && "pb-5 border-b border-neutral-200 dark:border-neutral-800",
        className
      )}
      {...props}
    >
      {/* Left: Back button + Title & Breadcrumb / Meta */}
      <div className="flex items-center gap-3 min-w-0">
        {renderBackButton()}

        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 truncate">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>

          {breadcrumbs && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {breadcrumbs}
            </div>
          )}

          {meta && (
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {meta}
            </div>
          )}

          {subtitle && !breadcrumbs && !meta && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
};
