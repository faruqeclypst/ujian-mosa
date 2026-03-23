import * as XLSX from "xlsx-js-style";

export const GURU_IMPORT_HEADERS = ["Nama Guru", "Kode Guru", "Mapel Utama (Pisahkan dengan koma)"] as const;

export function downloadGuruImportTemplate(filename = "template-import-guru.xlsx") {
  const ws = XLSX.utils.aoa_to_sheet([
    [...GURU_IMPORT_HEADERS],
    ["Pak Toni Syafi'i", "TS", "Informatika, Matematika"],
    ["Bu Siti Aminah", "SA", "Bahasa Indonesia"],
  ]);
  
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
  };

  for (let c = 0; c < GURU_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }

  (ws as any)["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 40 }];

  const wsNotes = XLSX.utils.aoa_to_sheet([
    ["Keterangan Import Guru"],
    [],
    ["Aturan:"],
    ["- Nama Guru wajib diisi."],
    ["- Kode Guru: opsional (misal: TS, SA)."],
    ["- Mapel Utama: pisahkan dengan koma jika lebih dr satu (misal: Matematika, IPA)."],
  ]);
  (wsNotes as any)["!cols"] = [{ wch: 80 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Guru");
  XLSX.utils.book_append_sheet(wb, wsNotes, "Keterangan");
  XLSX.writeFile(wb, filename);
}

export async function parseGuruImportExcel(file: File): Promise<{ name: string; code?: string; subjects: string[] }[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Sheet tidak ditemukan");

  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  return raw
    .map((row) => ({
      name: String(row["Nama Guru"] || "").trim(),
      code: String(row["Kode Guru"] || "").trim() || undefined,
      subjects: String(row["Mapel Utama (Pisahkan dengan koma)"] || "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    }))
    .filter((v) => v.name.length > 0);
}

export function exportGuruToExcel(params: { teachers: Array<{ name: string; code?: string; subjects?: string[] }>; filename?: string }) {
  const filename = params.filename ?? "data-guru.xlsx";
  const ws = XLSX.utils.aoa_to_sheet([
    [...GURU_IMPORT_HEADERS],
    ...params.teachers.map((t) => [t.name, t.code || "", (t.subjects || []).join(", ")]),
  ]);

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "16A34A" } },
  };
  for (let c = 0; c < GURU_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }

  (ws as any)["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Guru");
  XLSX.writeFile(wb, filename);
}
