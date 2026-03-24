import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "./button";
import { useToast } from "./toast";
import { cn } from "../../lib/utils";

export interface ExportButtonProps {
  onExport: () => void;
  isLoading?: boolean;
  label?: string;
  className?: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  onExport,
  isLoading = false,
  label = "Export Excel",
  className,
}) => {
  const { addToast } = useToast();

  const handleExport = async () => {
    try {
      await onExport();
      addToast({
        type: "success",
        title: "Berhasil",
        description: "Data berhasil diekspor ke Excel",
      });
    } catch (error) {
      console.error("Export error:", error);
      addToast({
        type: "error",
        title: "Gagal",
        description: "Gagal mengekspor data. Silakan coba lagi.",
      });
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className={cn(
        "bg-green-50 text-green-600 hover:bg-green-100 border-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/30 dark:border-slate-800 rounded-xl font-semibold shadow-sm",
        className
      )}
    >
      <Download className="mr-1 h-3.5 w-3.5" />
      {isLoading ? "Mengekspor..." : label}
    </Button>
  );
};