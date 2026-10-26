import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:focus-visible:ring-emerald-400 focus-visible:ring-offset-2 ring-offset-background select-none disabled:pointer-events-none disabled:opacity-50 touch-manipulation active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs dark:shadow-[0_0_14px_rgba(16,185,129,0.25)] border border-emerald-500/80 cursor-pointer",
        neon: "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs dark:shadow-[0_0_16px_rgba(16,185,129,0.35)] border border-emerald-500/80 cursor-pointer",
        neonSecondary: "border border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-2xs cursor-pointer",
        neonOutline: "border border-emerald-500/40 hover:border-emerald-500/80 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 shadow-2xs cursor-pointer",
        neonGhost: "hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer",
        destructive: "bg-rose-600 text-white shadow-sm hover:bg-rose-500 active:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600 border border-rose-600/80 cursor-pointer",
        outline:
          "border border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 shadow-2xs hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 cursor-pointer",
        secondary: "bg-neutral-100 dark:bg-neutral-850 text-neutral-800 dark:text-neutral-200 shadow-2xs hover:bg-neutral-200/80 dark:hover:bg-neutral-800 border border-neutral-200/70 dark:border-neutral-750 cursor-pointer",
        soft: "bg-sky-50 text-sky-700 border border-sky-200/70 hover:bg-sky-100/80 active:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/50 dark:hover:bg-sky-900/40 shadow-2xs cursor-pointer",
        softSuccess: "bg-emerald-50 text-emerald-700 border border-emerald-200/70 hover:bg-emerald-100/80 active:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50 dark:hover:bg-emerald-900/40 shadow-2xs cursor-pointer",
        ghost: "hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 text-neutral-700 dark:text-neutral-300 cursor-pointer",
        link: "text-emerald-600 dark:text-emerald-400 underline-offset-4 hover:underline cursor-pointer",
      },
      size: {
        default: "min-h-[44px] h-10 sm:min-h-0 sm:h-10 px-4 py-2 text-sm",
        sm: "min-h-[38px] h-8 sm:min-h-0 sm:h-8 px-3 text-xs sm:text-xs",
        lg: "min-h-[44px] h-11 px-6 text-base",
        icon: "min-h-[36px] min-w-[36px] h-8 w-8 sm:min-h-0 sm:min-w-0 sm:h-8 sm:w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
