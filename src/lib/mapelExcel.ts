import * as XLSX from "xlsx-js-style";
import { z } from "zod";

export const MAPEL_IMPORT_HEADERS = ["Mata Pelajaran"] as const;

export function downloadMapelImportTemplate(filename = "template-import-mapel.xlsx") {
  const ws = XLSX.utils.aoa_to_sheet([
    [...MAPEL_IMPORT_HEADERS],
    ["Matematika"],
    ["Bahasa Indonesia"],
  ]);
  
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
  };

  const addr = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[addr]) (ws[addr] as any).s = headerStyle;

  (ws as any)["!cols"] = [{ wch: 30 }];

  const wsNotes = XLSX.utils.aoa_to_sheet([
    ["Keterangan Import Mata Pelajaran"],
    [],
    ["Aturan:"],
    ["- Nama Mata Pelajaran wajib diisi."],
  ]);
  (wsNotes as any)["!cols"] = [{ wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mapel");
  XLSX.utils.book_append_sheet(wb, wsNotes, "Keterangan");
  XLSX.writeFile(wb, filename);
}

export async function parseMapelImportExcel(file: File): Promise<{ name: string }[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Sheet tidak ditemukan");

  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  if (raw.length === 0) return [];

  return raw
    .map((row) => ({ name: String(row["Mata Pelajaran"] || "").trim() }))
    .filter((v) => v.name.length > 1);
}

export function exportMapelToExcel(params: { mapels: Array<{ name: string }>; filename?: string }) {
  const filename = params.filename ?? "data-mapel.xlsx";
  const ws = XLSX.utils.aoa_to_sheet([
    [...MAPEL_IMPORT_HEADERS],
    ...params.mapels.map((m) => [m.name]),
  ]);

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "16A34A" } },
  };
  const addr = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[addr]) (ws[addr] as any).s = headerStyle;

  (ws as any)["!cols"] = [{ wch: 30 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mapel");
  XLSX.writeFile(wb, filename);
}
