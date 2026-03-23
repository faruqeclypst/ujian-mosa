// Simple CSV export utility for Excel compatibility
export const exportToCSV = (data: any[], filename: string, headers: string[]) => {
  if (data.length === 0) {
    throw new Error("No data to export");
  }

  // Create CSV content
  const csvContent = [
    headers.join(","),
    ...data.map(row =>
      headers.map(header => {
        const rawValue = row[header];
        const value = rawValue === null || rawValue === undefined ? "" : String(rawValue);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(",")
    )
  ].join("\n");

  // Create and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

// Format date for export
export const formatDateForExport = (date: Date | string | null | undefined): string => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("id-ID");
};

// Format currency for export
export const formatCurrencyForExport = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return "";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};