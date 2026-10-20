import React from "react";
import { cn } from "../../lib/utils";

export interface NeonTabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  count?: number | string;
  countFormat?: "parens" | "badge";
  icon?: React.ElementType;
  indicator?: boolean;
  disabled?: boolean;
}

export interface NeonTabsProps<T extends string = string> extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  tabs: NeonTabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  countFormat?: "parens" | "badge";
  size?: "sm" | "md";
  rightSlot?: React.ReactNode;
}

export function NeonTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  countFormat: defaultCountFormat = "parens",
  size = "sm",
  rightSlot,
  className,
  ...props
}: NeonTabsProps<T>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 text-xs overflow-x-auto",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-4 sm:gap-6 shrink-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={cn(
                "pb-2.5 flex items-center gap-1.5 sm:gap-2 border-b-2 font-medium transition-colors cursor-pointer -mb-px whitespace-nowrap shrink-0 disabled:opacity-40 disabled:pointer-events-none",
                isActive
                  ? "border-emerald-500 text-neutral-900 dark:text-neutral-100 font-semibold"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              )}
            >
              {tab.indicator && (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    isActive ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"
                  )}
                />
              )}

              {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}

              <span>{tab.label}</span>

              {tab.count !== undefined && (
                (tab.countFormat || defaultCountFormat) === "badge" ? (
                  <span
                    className={cn(
                      "font-mono text-[11px] px-1.5 py-0.2 rounded-full font-bold",
                      isActive
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                    )}
                  >
                    {tab.count}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-neutral-400">
                    ({tab.count})
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>

      {rightSlot && <div className="pb-2 shrink-0 pl-4">{rightSlot}</div>}
    </div>
  );
}
