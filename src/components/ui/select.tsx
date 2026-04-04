import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => {
  return (
    <div className="relative w-full group">
      <select
        ref={ref}
        className={cn(
          "flex h-10 sm:h-11 w-full rounded-md border border-input bg-background pl-3 pr-10 py-2 text-sm sm:text-base shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus:border-ring hover:border-ring/50 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation appearance-none cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-slate-600 transition-colors">
        <ChevronDown className="h-4 w-4" />
      </div>
    </div>
  );
});
Select.displayName = "Select";

export { Select };
