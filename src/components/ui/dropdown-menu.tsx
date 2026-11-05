import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface DropdownMenuContextProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextProps | undefined>(undefined);

const useDropdownMenu = () => {
  const context = React.useContext(DropdownMenuContext);
  if (!context) {
    throw new Error('useDropdownMenu must be used within a DropdownMenu');
  }
  return context;
};

interface DropdownMenuProps {
  children: React.ReactNode;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) {
        return;
      }
      if (contentRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div ref={triggerRef} className={cn("inline-flex items-center justify-center shrink-0", open ? "z-50" : "z-auto")} data-dropdown-menu>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({ children, asChild }) => {
  const { open, setOpen } = useDropdownMenu();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(!open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        handleClick(e);
        if (typeof (children.props as any).onClick === 'function') {
          (children.props as any).onClick(e);
        }
      },
      ...children.props
    });
  }

  return (
    <div onClick={handleClick} className="inline-block cursor-pointer">
      {children}
    </div>
  );
};

interface DropdownMenuContentProps {
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  sideOffset?: number;
  portal?: boolean;
}

const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({
  children,
  align = "start",
  className,
  sideOffset = 6,
  portal = true
}) => {
  const { open, triggerRef, contentRef } = useDropdownMenu();
  const [coords, setCoords] = React.useState<{ top: number; left?: number; right?: number } | null>(null);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const contentEl = contentRef.current;
    const contentHeight = contentEl ? contentEl.offsetHeight : 140;
    const contentWidth = contentEl ? contentEl.offsetWidth : 192;
    const padding = 8;

    // If bottom would overflow viewport and top has enough space, flip above
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const placeAbove = spaceBelow < contentHeight + sideOffset && triggerRect.top > contentHeight + sideOffset;

    let top = placeAbove
      ? Math.max(padding, triggerRect.top - contentHeight - sideOffset)
      : Math.min(window.innerHeight - contentHeight - padding, triggerRect.bottom + sideOffset);

    let left: number | undefined;
    let right: number | undefined;

    if (align === "end") {
      const calculatedRight = window.innerWidth - triggerRect.right;
      if (window.innerWidth - calculatedRight - contentWidth < padding) {
        left = padding;
        right = undefined;
      } else {
        right = Math.max(padding, calculatedRight);
      }
    } else if (align === "center") {
      const centerX = triggerRect.left + triggerRect.width / 2;
      let calculatedLeft = centerX - contentWidth / 2;
      calculatedLeft = Math.max(padding, Math.min(calculatedLeft, window.innerWidth - contentWidth - padding));
      left = calculatedLeft;
    } else {
      let calculatedLeft = triggerRect.left;
      calculatedLeft = Math.max(padding, Math.min(calculatedLeft, window.innerWidth - contentWidth - padding));
      left = calculatedLeft;
    }

    setCoords({ top, left, right });
  }, [triggerRef, contentRef, align, sideOffset]);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updatePosition]);

  if (!open) return null;

  const contentElement = (
    <div
      ref={contentRef}
      data-dropdown-menu-content
      style={
        portal
          ? {
              position: "fixed",
              top: coords ? `${coords.top}px` : "-9999px",
              left: coords?.left !== undefined ? `${coords.left}px` : undefined,
              right: coords?.right !== undefined ? `${coords.right}px` : undefined,
              opacity: coords ? 1 : 0,
              zIndex: 99999
            }
          : undefined
      }
      className={cn(
        portal ? "" : "absolute mt-2",
        "min-w-[8rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-1 text-neutral-900 dark:text-neutral-100 shadow-xl",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );

  if (portal && typeof document !== "undefined") {
    return createPortal(contentElement, document.body);
  }

  return contentElement;
};

interface DropdownMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({
  children,
  onClick,
  className,
  disabled
}) => {
  const { setOpen } = useDropdownMenu();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onClick?.();
    setOpen(false);
  };

  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
        disabled && "opacity-50 pointer-events-none cursor-not-allowed",
        className
      )}
      onClick={handleClick}
    >
      {children}
    </div>
  );
};

interface DropdownMenuCheckboxItemProps {
  children: React.ReactNode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

const DropdownMenuCheckboxItem: React.FC<DropdownMenuCheckboxItemProps> = ({
  children,
  checked = false,
  onCheckedChange,
  className
}) => {
  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-xs outline-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onCheckedChange?.(!checked);
      }}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {checked && <Check className="h-4 w-4" />}
      </span>
      {children}
    </div>
  );
};

interface DropdownMenuLabelProps {
  children: React.ReactNode;
  className?: string;
}

const DropdownMenuLabel: React.FC<DropdownMenuLabelProps> = ({ children, className }) => {
  return (
    <div className={cn("px-2.5 py-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400", className)}>
      {children}
    </div>
  );
};

interface DropdownMenuSeparatorProps {
  className?: string;
}

const DropdownMenuSeparator: React.FC<DropdownMenuSeparatorProps> = ({ className }) => {
  return <div className={cn("-mx-1 my-1 h-px bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800", className)} />;
};

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};
