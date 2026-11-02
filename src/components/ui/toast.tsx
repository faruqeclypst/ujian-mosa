import * as React from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "../../lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastStyles = {
  success: "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200/80 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-100",
  error: "bg-rose-50 dark:bg-rose-950/90 border-rose-200/80 dark:border-rose-800/60 text-rose-950 dark:text-rose-100",
  warning: "bg-amber-50 dark:bg-amber-950/90 border-amber-200/80 dark:border-amber-800/60 text-amber-950 dark:text-amber-100",
  info: "bg-sky-50 dark:bg-sky-950/90 border-sky-200/80 dark:border-sky-800/60 text-sky-950 dark:text-sky-100",
};

const iconStyles = {
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-rose-600 dark:text-rose-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { ...toast, id };

    setToasts([newToast]);

    if (toast.duration !== 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 3500);
    }
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 left-4 z-[100000] flex flex-col gap-2 pointer-events-none max-w-[320px] sm:max-w-[340px] w-auto">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onClose={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const Icon = toastIcons[toast.type];

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-md shadow-black/5 dark:shadow-black/30 backdrop-blur-sm transition-all duration-200 animate-in fade-in slide-in-from-bottom-2",
        toastStyles[toast.type]
      )}
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", iconStyles[toast.type])} />
      <div className="flex-1 min-w-0 pr-1">
        <h4 className="font-semibold text-xs leading-snug">{toast.title}</h4>
        {toast.description && (
          <p className="text-[11px] mt-0.5 opacity-90 leading-tight text-neutral-600 dark:text-neutral-300 line-clamp-2">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-0.5 -mr-1 -mt-0.5 opacity-60 hover:opacity-100 rounded transition-opacity"
        aria-label="Tutup notifikasi"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
