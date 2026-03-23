import * as XLSX from "xlsx-js-style";
import { z } from "zod";

export const INVENTORY_IMPORT_HEADERS = [
  "Kode Barang",
  "Nama Barang",
  "Merek",
  "Spesifikasi",
  "Jumlah",
  "Tanggal Perolehan",
  "Sumber",
  "Ruangan",
  "Kondisi",
] as const;

export type InventoryImportRow = Record<(typeof INVENTORY_IMPORT_HEADERS)[number], unknown>;

const conditionSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => ["baik", "cukup", "rusak"].includes(v), {
    message: "Kondisi harus: baik/cukup/rusak",
  }) as z.ZodType<"baik" | "cukup" | "rusak">;

const rowSchema = z.object({
  "Kode Barang": z.string().min(2, "Kode Barang wajib diisi"),
  "Nama Barang": z.string().min(2, "Nama Barang wajib diisi"),
  "Merek": z.string().optional().default(""),
  "Spesifikasi": z.string().optional().default(""),
  "Jumlah": z.coerce.number().min(0, "Jumlah tidak boleh negatif"),
  "Tanggal Perolehan": z
    .string()
    .min(1, "Tanggal Perolehan wajib diisi")
    .transform((v) => v.trim())
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "Tanggal Perolehan harus format YYYY-MM-DD",
    }),
  "Sumber": z.string().min(1, "Sumber wajib diisi"),
  "Ruangan": z.string().min(1, "Ruangan wajib diisi"),
  "Kondisi": conditionSchema,
});

export interface ParsedInventoryImportItem {
  code: string;
  name: string;
  brand: string;
  specification: string;
  quantity: number;
  acquisitionDate: string; // YYYY-MM-DD
  source: string;
  roomName: string;
  condition: "baik" | "cukup" | "rusak";
}

export function downloadInventoryImportTemplate(filename?: string): void;
export function downloadInventoryImportTemplate(opts?: { roomNames: string[]; filename?: string }): void;
export function downloadInventoryImportTemplate(
  arg: string | { roomNames: string[]; filename?: string } = { roomNames: [] }
) {
  const opts = typeof arg === "string" ? { roomNames: [], filename: arg } : (arg ?? { roomNames: [] });
  const filename = opts.filename ?? "template-import-inventaris.xlsx";
  const roomNames = [...new Set((opts.roomNames ?? []).map((n) => n.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "id-ID")
  );

  const ws = XLSX.utils.aoa_to_sheet([
    [...INVENTORY_IMPORT_HEADERS],
    [
      "BRG-001",
      "Kursi Belajar",
      "Olympic",
      "Bahan besi, warna hitam",
      30,
      new Date().toISOString().slice(0, 10),
      "BOS",
      roomNames[0] ?? "Ruang Kelas 1A",
      "baik",
    ],
  ]);

  // Set some column widths for readability
  (ws as any)["!cols"] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 18 },
    { wch: 30 },
    { wch: 10 },
    { wch: 18 },
    { wch: 14 },
    { wch: 22 },
    { wch: 10 },
  ];

  // Freeze header row + enable autofilter
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  (ws as any)["!autofilter"] = { ref: "A1:I1" };

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { patternType: "solid", fgColor: { rgb: "2563EB" } }, // blue
    border: {
      top: { style: "thin", color: { rgb: "CBD5E1" } },
      bottom: { style: "thin", color: { rgb: "CBD5E1" } },
      left: { style: "thin", color: { rgb: "CBD5E1" } },
      right: { style: "thin", color: { rgb: "CBD5E1" } },
    },
  };

  const cellBorder = {
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    },
  };

  // Header row styling
  for (let c = 0; c < INVENTORY_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }
  (ws as any)["!rows"] = [{ hpt: 22 }];

  // Apply borders + basic alignment for a reasonable range (A2:I5000)
  for (let r = 2; r <= 5000; r++) {
    for (let c = 0; c < INVENTORY_IMPORT_HEADERS.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: r - 1, c });
      if (!ws[addr]) ws[addr] = { t: "s", v: "" } as any;
      (ws[addr] as any).s = {
        ...cellBorder,
        alignment: {
          vertical: "top",
          wrapText: c === 3, // Spesifikasi wrap
        },
      };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventaris");

  // Instructions / notes sheet
  const wsNotes = XLSX.utils.aoa_to_sheet([
    ["Keterangan Import Inventaris"],
    [],
    ["Cara pakai:"],
    ["1) Klik tombol Download Template di aplikasi."],
    ["2) Isi data pada sheet 'Inventaris' mulai dari baris 2."],
    ["3) Simpan file (format .xlsx) lalu Import Excel di aplikasi."],
    [],
    ["Aturan penting:"],
    ["- Kolom wajib: Kode Barang, Nama Barang, Jumlah, Tanggal Perolehan, Sumber, Ruangan, Kondisi."],
    ["- Tanggal Perolehan WAJIB format teks: YYYY-MM-DD (contoh: 2026-03-19)."],
    ["- Ruangan: pilih dari dropdown (berdasarkan data ruangan yang sudah ada di aplikasi)."],
    ["- Kondisi: pilih dari dropdown: baik / cukup / rusak."],
    ["- Jumlah: angka >= 0."],
    ["- Jangan ubah nama header kolom (baris 1)."],
    [],
    ["Catatan:"],
    ["- Foto Barang tidak bisa diimport via Excel. Silakan upload foto saat edit barang di aplikasi."],
  ]);
  (wsNotes as any)["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, "Keterangan");

  // Reference sheet for dropdown lists
  const refSheetAoa = [
    ["Daftar Ruangan"],
    ...roomNames.map((n) => [n]),
    [],
    ["Kondisi"],
    ["baik"],
    ["cukup"],
    ["rusak"],
  ];
  const wsRef = XLSX.utils.aoa_to_sheet(refSheetAoa);
  (wsRef as any)["!cols"] = [{ wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsRef, "Referensi");

  // Keep "Tanggal Perolehan" as plain text so Excel won't auto-change the format.
  // Apply text format (@) to a reasonable range (F2:F5000)
  for (let r = 2; r <= 5000; r++) {
    const addr = `F${r}`;
    if (!ws[addr]) ws[addr] = { t: "s", v: "" };
    (ws[addr] as any).z = "@";
  }

  // Try to add data validation (dropdown) for Ruangan (H) and Kondisi (I)
  // Note: Excel honors this when the writer preserves DV records.
  const roomEndRow = Math.max(2, roomNames.length + 1);
  (ws as any)["!dataValidation"] = [
    roomNames.length > 0
      ? {
          type: "list",
          allowBlank: 0,
          showInputMessage: 1,
          showErrorMessage: 1,
          sqref: "H2:H5000",
          formula1: `=Referensi!$A$2:$A$${roomEndRow}`,
        }
      : null,
    {
      type: "list",
      allowBlank: 0,
      showInputMessage: 1,
      showErrorMessage: 1,
      sqref: "I2:I5000",
      // Inline list so Excel can show dropdown immediately
      formula1: '"baik,cukup,rusak"',
    },
  ].filter(Boolean);

  // Hide reference sheet if possible
  (wb as any).Workbook = (wb as any).Workbook ?? {};
  (wb as any).Workbook.Sheets = [
    { name: "Inventaris" },
    { name: "Keterangan" },
    { name: "Referensi", Hidden: 1 },
  ];

  XLSX.writeFile(wb, filename);
}

function toStringCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function excelDateToISODateString(value: unknown): string {
  // SheetJS may return:
  // - string (already formatted)
  // - number (Excel date serial)
  // - Date (if cellDates=true)
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return "";
    const yyyy = String(date.y).padStart(4, "0");
    const mm = String(date.m).padStart(2, "0");
    const dd = String(date.d).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return toStringCell(value).trim();
}

export async function parseInventoryImportExcel(file: File): Promise<ParsedInventoryImportItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) throw new Error("File Excel tidak memiliki sheet");
  const ws = wb.Sheets[firstSheetName];
  if (!ws) throw new Error("Sheet tidak ditemukan");

  // Read rows as objects with headers from first row
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: true,
  });

  if (rawRows.length === 0) return [];

  const missingHeaders = INVENTORY_IMPORT_HEADERS.filter(
    (h) => !(h in rawRows[0])
  );
  if (missingHeaders.length > 0) {
    throw new Error(`Header tidak sesuai template. Kurang: ${missingHeaders.join(", ")}`);
  }

  const parsed: ParsedInventoryImportItem[] = [];
  const errors: string[] = [];

  rawRows.forEach((row, idx) => {
    // Skip completely empty rows
    const isEmpty = INVENTORY_IMPORT_HEADERS.every((h) => {
      const v = (row as any)[h];
      return v === "" || v === null || v === undefined;
    });
    if (isEmpty) return;

    // Normalize date field from possible Excel date serial/Date/string
    const normalizedRow: InventoryImportRow = { ...(row as any) };
    normalizedRow["Tanggal Perolehan"] = excelDateToISODateString((row as any)["Tanggal Perolehan"]);

    // Normalize all cells to strings for string fields
    normalizedRow["Kode Barang"] = toStringCell(normalizedRow["Kode Barang"]).trim();
    normalizedRow["Nama Barang"] = toStringCell(normalizedRow["Nama Barang"]).trim();
    normalizedRow["Merek"] = toStringCell(normalizedRow["Merek"]).trim();
    normalizedRow["Spesifikasi"] = toStringCell(normalizedRow["Spesifikasi"]).trim();
    normalizedRow["Sumber"] = toStringCell(normalizedRow["Sumber"]).trim();
    normalizedRow["Ruangan"] = toStringCell(normalizedRow["Ruangan"]).trim();
    normalizedRow["Kondisi"] = toStringCell(normalizedRow["Kondisi"]).trim();

    const res = rowSchema.safeParse(normalizedRow);
    if (!res.success) {
      const msg = res.error.issues.map((i) => i.message).join("; ");
      errors.push(`Baris ${idx + 2}: ${msg}`); // +2 because header is row 1
      return;
    }

    parsed.push({
      code: res.data["Kode Barang"],
      name: res.data["Nama Barang"],
      brand: res.data["Merek"],
      specification: res.data["Spesifikasi"],
      quantity: res.data["Jumlah"],
      acquisitionDate: res.data["Tanggal Perolehan"],
      source: res.data["Sumber"],
      roomName: res.data["Ruangan"],
      condition: res.data["Kondisi"],
    });
  });

  if (errors.length > 0) {
    throw new Error(errors.slice(0, 20).join("\n"));
  }

  return parsed;
}

export function exportInventoryToExcel(params: {
  items: Array<{
    code: string;
    name: string;
    brand: string;
    specification: string;
    quantity: number;
    acquisitionDate: string;
    source: string;
    roomId: string;
    condition: string;
  }>;
  rooms: Array<{ id: string; name: string }>;
  filename?: string;
}) {
  const filename = params.filename ?? "data-inventaris.xlsx";
  const roomLookup = new Map(params.rooms.map((r) => [r.id, r.name]));

  const aoa = [
    [...INVENTORY_IMPORT_HEADERS],
    ...params.items.map((item) => [
      item.code,
      item.name,
      item.brand ?? "",
      item.specification ?? "",
      item.quantity ?? 0,
      item.acquisitionDate ?? "",
      item.source ?? "",
      roomLookup.get(item.roomId) ?? "",
      item.condition ?? "",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  (ws as any)["!cols"] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 18 },
    { wch: 30 },
    { wch: 10 },
    { wch: 18 },
    { wch: 14 },
    { wch: 22 },
    { wch: 10 },
  ];

  // Freeze header row + enable autofilter
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  (ws as any)["!autofilter"] = { ref: "A1:I1" };

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { patternType: "solid", fgColor: { rgb: "16A34A" } }, // green
    border: {
      top: { style: "thin", color: { rgb: "CBD5E1" } },
      bottom: { style: "thin", color: { rgb: "CBD5E1" } },
      left: { style: "thin", color: { rgb: "CBD5E1" } },
      right: { style: "thin", color: { rgb: "CBD5E1" } },
    },
  };

  const cellBorder = {
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    },
  };

  // Header row styling
  for (let c = 0; c < INVENTORY_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }
  (ws as any)["!rows"] = [{ hpt: 22 }];

  // Keep "Tanggal Perolehan" as text (@) to avoid auto date conversion
  const maxRow = aoa.length + 1;
  for (let r = 2; r <= Math.max(2, maxRow); r++) {
    const addr = `F${r}`;
    if (!ws[addr]) ws[addr] = { t: "s", v: "" };
    (ws[addr] as any).z = "@";
  }

  // Apply borders + basic alignment for used range (A2:I{n})
  const lastDataRow = Math.max(2, aoa.length);
  for (let r = 2; r <= lastDataRow; r++) {
    for (let c = 0; c < INVENTORY_IMPORT_HEADERS.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: r - 1, c });
      if (!ws[addr]) continue;
      (ws[addr] as any).s = {
        ...(ws[addr] as any).s,
        ...cellBorder,
        alignment: {
          vertical: "top",
          wrapText: c === 3,
        },
      };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventaris");
  XLSX.writeFile(wb, filename);
}
