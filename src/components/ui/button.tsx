import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:focus-visible:ring-emerald-400 focus-visible:ring-offset-2 ring-offset-background select-none disabled:pointer-events-none disabled:opacity-50 touch-manipulation active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90 active:bg-primary/95",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/95",
        outline:
          "border border-input bg-background shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        soft: "bg-blue-50 text-blue-700 border border-blue-100/80 hover:bg-blue-100/80 active:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50 dark:hover:bg-blue-900/40 shadow-sm",
        softSuccess: "bg-emerald-50 text-emerald-700 border border-emerald-100/80 hover:bg-emerald-100/80 active:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50 dark:hover:bg-emerald-900/40 shadow-sm",
        ghost: "hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 text-slate-700 dark:text-slate-300",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[44px] h-10 sm:min-h-0 sm:h-10 px-4 py-2 text-sm",
        sm: "min-h-[40px] h-9 sm:min-h-0 sm:h-9 px-3 text-xs sm:text-sm",
        lg: "min-h-[44px] h-11 px-6 text-base",
        icon: "min-h-[44px] min-w-[44px] h-10 w-10 sm:min-h-0 sm:min-w-0 sm:h-10 sm:w-10",
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
