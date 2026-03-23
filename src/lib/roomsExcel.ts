import * as XLSX from "xlsx-js-style";
import { z } from "zod";

export const ROOMS_IMPORT_HEADERS = [
  "Nama Ruangan",
  "Kode Gedung",
  "Kondisi",
  "Kapasitas",
  "Jenis Ruangan",
  "Lantai",
  "Catatan",
] as const;

type RoomsImportRow = Record<(typeof ROOMS_IMPORT_HEADERS)[number], unknown>;

const conditionSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => ["baik", "cukup", "rusak"].includes(v), { message: "Kondisi harus: baik/cukup/rusak" }) as z.ZodType<
  "baik" | "cukup" | "rusak"
>;

const roomTypeSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => ["kelas", "laboratorium", "kantor", "ruang_rapat", "perpustakaan", "lainnya", ""].includes(v), {
    message: "Jenis Ruangan tidak valid",
  }) as z.ZodType<
  "" | "kelas" | "laboratorium" | "kantor" | "ruang_rapat" | "perpustakaan" | "lainnya"
>;

const rowSchema = z.object({
  "Nama Ruangan": z.string().min(2, "Nama Ruangan wajib diisi"),
  "Kode Gedung": z.string().min(1, "Kode Gedung wajib diisi"),
  "Kondisi": conditionSchema,
  "Kapasitas": z.coerce.number().min(0, "Kapasitas tidak valid").optional().or(z.nan()).transform((v) => (Number.isFinite(v) ? v : undefined)),
  "Jenis Ruangan": z.string().optional().default("").transform((v) => v.trim()).pipe(roomTypeSchema),
  "Lantai": z.coerce.number().min(0, "Lantai tidak valid").optional().or(z.nan()).transform((v) => (Number.isFinite(v) ? v : undefined)),
  "Catatan": z.string().optional().default(""),
});

export interface ParsedRoomImport {
  name: string;
  buildingCode: string;
  condition: "baik" | "cukup" | "rusak";
  capacity?: number;
  roomType?: "" | "kelas" | "laboratorium" | "kantor" | "ruang_rapat" | "perpustakaan" | "lainnya";
  floor?: number;
  notes?: string;
}

export function downloadRoomsImportTemplate(filename = "template-import-ruangan.xlsx") {
  const ws = XLSX.utils.aoa_to_sheet([
    [...ROOMS_IMPORT_HEADERS],
    ["Ruang Kelas 1A", "GDG-A", "baik", 30, "kelas", 1, ""],
  ]);

  (ws as any)["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 30 }];
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  (ws as any)["!autofilter"] = { ref: "A1:G1" };

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
  for (let c = 0; c < ROOMS_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }
  (ws as any)["!rows"] = [{ hpt: 22 }];

  // Dropdowns: Kondisi (C), Jenis Ruangan (E)
  (ws as any)["!dataValidation"] = [
    { type: "list", allowBlank: 0, sqref: "C2:C5000", formula1: '"baik,cukup,rusak"' },
    { type: "list", allowBlank: 1, sqref: "E2:E5000", formula1: '"kelas,laboratorium,kantor,ruang_rapat,perpustakaan,lainnya"' },
  ];

  const wsNotes = XLSX.utils.aoa_to_sheet([
    ["Keterangan Import Ruangan"],
    [],
    ["Aturan:"],
    ["- Nama Ruangan, Kode Gedung, Kondisi wajib diisi."],
    ["- Kondisi: pilih dari dropdown (baik/cukup/rusak)."],
    ["- Jenis Ruangan: pilih dari dropdown (opsional)."],
    ["- Kapasitas & Lantai: angka (opsional)."],
    [],
    ["Catatan:"],
    ["- Foto ruangan tidak diimport via Excel. Upload via aplikasi."],
  ]);
  (wsNotes as any)["!cols"] = [{ wch: 90 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ruangan");
  XLSX.utils.book_append_sheet(wb, wsNotes, "Keterangan");
  XLSX.writeFile(wb, filename);
}

function toStringCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export async function parseRoomsImportExcel(file: File): Promise<ParsedRoomImport[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) throw new Error("File Excel tidak memiliki sheet");
  const ws = wb.Sheets[firstSheetName];
  if (!ws) throw new Error("Sheet tidak ditemukan");

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
  if (rawRows.length === 0) return [];

  const missingHeaders = ROOMS_IMPORT_HEADERS.filter((h) => !(h in rawRows[0]));
  if (missingHeaders.length > 0) throw new Error(`Header tidak sesuai template. Kurang: ${missingHeaders.join(", ")}`);

  const parsed: ParsedRoomImport[] = [];
  const errors: string[] = [];

  rawRows.forEach((row, idx) => {
    const isEmpty = ROOMS_IMPORT_HEADERS.every((h) => {
      const v = (row as any)[h];
      return v === "" || v === null || v === undefined;
    });
    if (isEmpty) return;

    const normalized: RoomsImportRow = { ...(row as any) };
    normalized["Nama Ruangan"] = toStringCell(normalized["Nama Ruangan"]).trim();
    normalized["Kode Gedung"] = toStringCell(normalized["Kode Gedung"]).trim();
    normalized["Kondisi"] = toStringCell(normalized["Kondisi"]).trim();
    normalized["Jenis Ruangan"] = toStringCell(normalized["Jenis Ruangan"]).trim();
    normalized["Catatan"] = toStringCell(normalized["Catatan"]).trim();

    const res = rowSchema.safeParse(normalized);
    if (!res.success) {
      errors.push(`Baris ${idx + 2}: ${res.error.issues.map((i) => i.message).join("; ")}`);
      return;
    }

    parsed.push({
      name: res.data["Nama Ruangan"],
      buildingCode: res.data["Kode Gedung"],
      condition: res.data["Kondisi"],
      capacity: res.data["Kapasitas"],
      roomType: res.data["Jenis Ruangan"] || undefined,
      floor: res.data["Lantai"],
      notes: res.data["Catatan"] || "",
    });
  });

  if (errors.length > 0) throw new Error(errors.slice(0, 20).join("\n"));
  return parsed;
}

export function exportRoomsToExcel(params: {
  rooms: Array<{
    name: string;
    buildingCode: string;
    condition: string;
    capacity?: number;
    roomType?: string;
    floor?: number;
    notes?: string;
  }>;
  filename?: string;
}) {
  const filename = params.filename ?? "data-ruangan.xlsx";
  const aoa = [
    [...ROOMS_IMPORT_HEADERS],
    ...params.rooms.map((r) => [r.name, r.buildingCode, r.condition, r.capacity ?? "", r.roomType ?? "", r.floor ?? "", r.notes ?? ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  (ws as any)["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 30 }];
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  (ws as any)["!autofilter"] = { ref: "A1:G1" };

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
  for (let c = 0; c < ROOMS_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }
  (ws as any)["!rows"] = [{ hpt: 22 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ruangan");
  XLSX.writeFile(wb, filename);
}

