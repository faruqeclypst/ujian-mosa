import * as React from "react";
import { Upload } from "lucide-react";
import { Button } from "./button";
import { useToast } from "./toast";
import { cn } from "../../lib/utils";

export interface ImportButtonProps {
  onImport: (file: File) => Promise<void> | void;
  isLoading?: boolean;
  progress?: number;
  label?: string;
  description?: string;
  className?: string;
  accept?: string;
  variant?: "default" | "item" | "rich";
}

export const ImportButton: React.FC<ImportButtonProps> = ({
  onImport,
  isLoading = false,
  progress = 0,
  label = "Import Excel",
  description,
  className,
  accept = ".xlsx,.xls",
  variant = "default",
}) => {
  const { addToast } = useToast();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleClick = () => inputRef.current?.click();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset value so same file can be selected again
    e.target.value = "";
    if (!file) return;
    try {
      await onImport(file);
      addToast({
        type: "success",
        title: "Berhasil",
        description: "Import data selesai.",
      });
    } catch (error) {
      console.error("Import error:", error);
      addToast({
        type: "error",
        title: "Gagal",
        description: error instanceof Error ? error.message : "Gagal mengimpor data. Silakan coba lagi.",
      });
    }
  };

  const content = variant === "rich" ? (
    <div className="flex items-center gap-3 w-full">
      <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
        <Upload className="h-5 w-5" />
      </div>
      <div className="flex flex-col items-start min-w-0">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate w-full leading-tight">
          {isLoading ? (progress > 0 ? `Mengimpor ${progress}%` : "Mengimpor...") : label}
        </span>
        <span className="text-[10px] text-slate-400 mt-1 truncate w-full">
          {description || "Unggah file (.xlsx)"}
        </span>
      </div>
    </div>
  ) : (
    <>
      {variant !== "item" && <Upload className="mr-1 h-3.5 w-3.5" />}
      {isLoading ? (progress > 0 ? `Mengimpor ${progress}%` : "Mengimpor...") : label}
    </>
  );

  if (variant === "rich") {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
        <button
          onClick={handleClick}
          disabled={isLoading}
          className={cn(
            "w-full flex items-center justify-start text-left p-2.5 rounded-xl cursor-copy hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-slate-50 dark:focus:bg-slate-900 transition-colors bg-transparent border-none outline-none disabled:opacity-50 group",
            className
          )}
        >
          {content}
        </button>
      </>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      <Button
        onClick={handleClick}
        disabled={isLoading}
        variant="secondary"
        size="sm"
        className={cn(
          variant === "item" 
            ? "w-full justify-start bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 border-none shadow-none font-bold rounded-lg text-sm p-2 gap-2 h-auto"
            : "bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100 dark:bg-blue-900/10 dark:text-blue-400 dark:hover:bg-blue-900/30 dark:border-slate-800 rounded-xl font-semibold shadow-sm",
          className
        )}
      >
        {content}
      </Button>
    </>
  );
};

