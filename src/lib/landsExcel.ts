import * as XLSX from "xlsx-js-style";
import { z } from "zod";

export const LANDS_IMPORT_HEADERS = [
  "Nama Lokasi",
  "Kode Lokasi",
  "Luas Area (m2)",
  "Tahun Perolehan",
  "Alamat",
  "Nomor Sertifikat",
  "Asal",
  "Keterangan",
] as const;

type LandsImportRow = Record<(typeof LANDS_IMPORT_HEADERS)[number], unknown>;

const yearSchema = z.coerce
  .number()
  .min(1950, "Tahun Perolehan tidak valid")
  .max(new Date().getFullYear(), "Tahun Perolehan tidak valid");

const rowSchema = z.object({
  "Nama Lokasi": z.string().min(2, "Nama Lokasi wajib diisi"),
  "Kode Lokasi": z.string().min(1, "Kode Lokasi wajib diisi"),
  "Luas Area (m2)": z.coerce.number().min(0.1, "Luas Area wajib diisi"),
  "Tahun Perolehan": yearSchema,
  "Alamat": z.string().min(3, "Alamat wajib diisi"),
  "Nomor Sertifikat": z.string().min(1, "Nomor Sertifikat wajib diisi"),
  "Asal": z.string().min(1, "Asal wajib diisi"),
  "Keterangan": z.string().optional().default(""),
});

export interface ParsedLandImport {
  locationName: string;
  locationCode: string;
  area: number;
  acquisitionYear: number;
  address: string;
  certificateNumber: string;
  origin: string;
  description?: string;
}

export function downloadLandsImportTemplate(filename = "template-import-tanah.xlsx") {
  const ws = XLSX.utils.aoa_to_sheet([
    [...LANDS_IMPORT_HEADERS],
    ["Lapangan Utama", "TNH-01", 1200, new Date().getFullYear(), "Jl. Contoh No. 1", "CERT-123", "Hibah", ""],
  ]);

  (ws as any)["!cols"] = [
    { wch: 22 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 30 },
    { wch: 18 },
    { wch: 14 },
    { wch: 30 },
  ];
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  (ws as any)["!autofilter"] = { ref: "A1:H1" };

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
    border: {
      top: { style: "thin", color: { rgb: "CBD5E1" } },
      bottom: { style: "thin", color: { rgb: "CBD5E1" } },
      left: { style: "thin", color: { rgb: "CBD5E1" } },
      right: { style: "thin", color: { rgb: "CBD5E1" } },
    },
  };
  for (let c = 0; c < LANDS_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }
  (ws as any)["!rows"] = [{ hpt: 22 }];

  const wsNotes = XLSX.utils.aoa_to_sheet([
    ["Keterangan Import Tanah"],
    [],
    ["Aturan:"],
    ["- Semua kolom wajib diisi kecuali Keterangan."],
    ["- Luas Area dalam meter persegi (m2)."],
    ["- Foto tanah tidak diimport via Excel. Upload via aplikasi."],
  ]);
  (wsNotes as any)["!cols"] = [{ wch: 90 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tanah");
  XLSX.utils.book_append_sheet(wb, wsNotes, "Keterangan");
  XLSX.writeFile(wb, filename);
}

function toStringCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export async function parseLandsImportExcel(file: File): Promise<ParsedLandImport[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) throw new Error("File Excel tidak memiliki sheet");
  const ws = wb.Sheets[firstSheetName];
  if (!ws) throw new Error("Sheet tidak ditemukan");

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
  if (rawRows.length === 0) return [];

  const missingHeaders = LANDS_IMPORT_HEADERS.filter((h) => !(h in rawRows[0]));
  if (missingHeaders.length > 0) throw new Error(`Header tidak sesuai template. Kurang: ${missingHeaders.join(", ")}`);

  const parsed: ParsedLandImport[] = [];
  const errors: string[] = [];

  rawRows.forEach((row, idx) => {
    const isEmpty = LANDS_IMPORT_HEADERS.every((h) => {
      const v = (row as any)[h];
      return v === "" || v === null || v === undefined;
    });
    if (isEmpty) return;

    const normalized: LandsImportRow = { ...(row as any) };
    normalized["Nama Lokasi"] = toStringCell(normalized["Nama Lokasi"]).trim();
    normalized["Kode Lokasi"] = toStringCell(normalized["Kode Lokasi"]).trim();
    normalized["Alamat"] = toStringCell(normalized["Alamat"]).trim();
    normalized["Nomor Sertifikat"] = toStringCell(normalized["Nomor Sertifikat"]).trim();
    normalized["Asal"] = toStringCell(normalized["Asal"]).trim();
    normalized["Keterangan"] = toStringCell(normalized["Keterangan"]).trim();

    const res = rowSchema.safeParse(normalized);
    if (!res.success) {
      errors.push(`Baris ${idx + 2}: ${res.error.issues.map((i) => i.message).join("; ")}`);
      return;
    }

    parsed.push({
      locationName: res.data["Nama Lokasi"],
      locationCode: res.data["Kode Lokasi"],
      area: res.data["Luas Area (m2)"],
      acquisitionYear: res.data["Tahun Perolehan"],
      address: res.data["Alamat"],
      certificateNumber: res.data["Nomor Sertifikat"],
      origin: res.data["Asal"],
      description: res.data["Keterangan"] || "",
    });
  });

  if (errors.length > 0) throw new Error(errors.slice(0, 20).join("\n"));
  return parsed;
}

export function exportLandsToExcel(params: {
  lands: Array<{
    locationName: string;
    locationCode: string;
    area: number;
    acquisitionYear: number;
    address: string;
    certificateNumber: string;
    origin: string;
    description?: string;
  }>;
  filename?: string;
}) {
  const filename = params.filename ?? "data-tanah.xlsx";
  const aoa = [
    [...LANDS_IMPORT_HEADERS],
    ...params.lands.map((l) => [
      l.locationName,
      l.locationCode,
      l.area,
      l.acquisitionYear,
      l.address,
      l.certificateNumber,
      l.origin,
      l.description ?? "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  (ws as any)["!cols"] = [
    { wch: 22 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 30 },
    { wch: 18 },
    { wch: 14 },
    { wch: 30 },
  ];
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  (ws as any)["!autofilter"] = { ref: "A1:H1" };

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { patternType: "solid", fgColor: { rgb: "16A34A" } },
    border: {
      top: { style: "thin", color: { rgb: "CBD5E1" } },
      bottom: { style: "thin", color: { rgb: "CBD5E1" } },
      left: { style: "thin", color: { rgb: "CBD5E1" } },
      right: { style: "thin", color: { rgb: "CBD5E1" } },
    },
  };
  for (let c = 0; c < LANDS_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }
  (ws as any)["!rows"] = [{ hpt: 22 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tanah");
  XLSX.writeFile(wb, filename);
}

