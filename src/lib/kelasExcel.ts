import * as XLSX from "xlsx-js-style";

export const KELAS_IMPORT_HEADERS = ["Nama Kelas"] as const;

export function downloadKelasImportTemplate(filename = "template-import-kelas.xlsx") {
  const ws = XLSX.utils.aoa_to_sheet([
    [...KELAS_IMPORT_HEADERS],
    ["X MIPA 1"],
    ["XI IPS 2"],
  ]);
  
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
  };

  const addr = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[addr]) (ws[addr] as any).s = headerStyle;

  (ws as any)["!cols"] = [{ wch: 25 }];

  const wsNotes = XLSX.utils.aoa_to_sheet([
    ["Keterangan Import Kelas"],
    [],
    ["Aturan:"],
    ["- Nama Kelas wajib diisi (misal: X MIPA 1, XII IPS 2)."],
  ]);
  (wsNotes as any)["!cols"] = [{ wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Kelas");
  XLSX.utils.book_append_sheet(wb, wsNotes, "Keterangan");
  XLSX.writeFile(wb, filename);
}

export async function parseKelasImportExcel(file: File): Promise<{ name: string }[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Sheet tidak ditemukan");

  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  return raw
    .map((row) => ({ name: String(row["Nama Kelas"] || "").trim() }))
    .filter((v) => v.name.length > 0);
}

export function exportKelasToExcel(params: { classes: Array<{ name: string }>; filename?: string }) {
  const filename = params.filename ?? "data-kelas.xlsx";
  const ws = XLSX.utils.aoa_to_sheet([
    [...KELAS_IMPORT_HEADERS],
    ...params.classes.map((c) => [c.name]),
  ]);

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "16A34A" } },
  };
  const addr = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[addr]) (ws[addr] as any).s = headerStyle;

  (ws as any)["!cols"] = [{ wch: 25 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Kelas");
  XLSX.writeFile(wb, filename);
}
