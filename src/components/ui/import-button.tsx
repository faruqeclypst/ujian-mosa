import * as React from "react";
import { Upload } from "lucide-react";
import { Button } from "./button";
import { useToast } from "./toast";
import { cn } from "../../lib/utils";

export interface ImportButtonProps {
  onImport: (file: File) => Promise<void> | void;
  isLoading?: boolean;
  label?: string;
  className?: string;
  accept?: string;
}

export const ImportButton: React.FC<ImportButtonProps> = ({
  onImport,
  isLoading = false,
  label = "Import Excel",
  className,
  accept = ".xlsx,.xls",
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
        variant="outline"
        size="sm"
        className={cn(
          "bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100 dark:bg-blue-900/10 dark:text-blue-400 dark:hover:bg-blue-900/30 dark:border-slate-800 rounded-xl font-semibold shadow-sm",
          className
        )}
      >
        <Upload className="mr-1 h-3.5 w-3.5" />
        {isLoading ? "Mengimpor..." : label}
      </Button>
    </>
  );
};

