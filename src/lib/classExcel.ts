import * as XLSX from "xlsx-js-style";

export const CLASS_IMPORT_HEADERS = ["Nama Kelas"] as const;

export function downloadClassImportTemplate(terminologyOrFilename?: any) {
  let terminology: any = null;
  let filename = "template-import-kelas.xlsx";

  if (typeof terminologyOrFilename === "string") {
    filename = terminologyOrFilename;
  } else if (terminologyOrFilename && typeof terminologyOrFilename === "object") {
    terminology = terminologyOrFilename;
    const classLabel = terminology?.class || "Kelas";
    const isCampus = (terminology?.school || "").toLowerCase().includes("kampus") || classLabel.toLowerCase().includes("prodi");
    filename = isCampus ? "template-import-prodi-semester.xlsx" : `template-import-${classLabel.toLowerCase().replace(/\s+/g, "-")}.xlsx`;
  }

  const classLabel = terminology?.class || "Kelas";
  const isCampus = (terminology?.school || "").toLowerCase().includes("kampus") || classLabel.toLowerCase().includes("prodi");
  const header = `Nama ${classLabel}`;

  const ws = XLSX.utils.aoa_to_sheet([
    [header],
    [isCampus ? "S1 Teknik Informatika - Semester 3" : "X MIPA 1"],
    [isCampus ? "S1 Sistem Informasi - Semester 1" : "XI IPS 2"],
    [isCampus ? "D3 Manajemen Informatika - Semester 5" : "XII RPL 1"],
  ]);
  
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
  };

  const addr = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[addr]) (ws[addr] as any).s = headerStyle;

  (ws as any)["!cols"] = [{ wch: 35 }];

  const wsNotes = XLSX.utils.aoa_to_sheet([
    [`Keterangan Import ${classLabel}`],
    [],
    ["Aturan:"],
    [`- Kolom '${header}' wajib diisi.`],
    [isCampus ? "- Contoh: S1 Teknik Informatika - Semester 3, D3 Kebidanan 2A." : "- Contoh: X MIPA 1, XII IPS 2, X RPL 1."],
    ["- Pastikan nama tidak duplikat dengan data yang sudah ada."],
  ]);
  (wsNotes as any)["!cols"] = [{ wch: 70 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isCampus ? "Prodi" : "Class");
  XLSX.utils.book_append_sheet(wb, wsNotes, "Keterangan");
  XLSX.writeFile(wb, filename);
}

export async function parseClassImportExcel(file: File): Promise<{ name: string }[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Sheet tidak ditemukan");

  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  return raw
    .map((row) => {
      // Robust detection: supports "Nama Kelas", "Nama Prodi", "Nama Prodi / Semester", "Prodi", "Program Studi", "Jurusan", "Semester", "Kelas"
      const matchedKey = Object.keys(row).find((k) =>
        /^(Nama\s+)?(Kelas|Prodi|Program\s*Studi|Jurusan|Semester|Rombel|Class)/i.test(k.trim())
      );
      const val = matchedKey 
        ? row[matchedKey] 
        : (row["Nama Kelas"] || row["Nama Prodi / Semester"] || row["Nama Prodi"] || row["Prodi"] || row["Kelas"] || Object.values(row)[0] || "");
      return { name: String(val || "").trim() };
    })
    .filter((v) => v.name.length > 0);
}

export function exportClassToExcel(params: { classes: Array<{ name: string }>; filename?: string; terminology?: any }) {
  const classLabel = params.terminology?.class || "Kelas";
  const filename = params.filename ?? `data-${classLabel.toLowerCase().replace(/[\/\s]+/g, "-")}.xlsx`;
  const header = `Nama ${classLabel}`;

  const ws = XLSX.utils.aoa_to_sheet([
    [header],
    ...params.classes.map((c) => [c.name]),
  ]);

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "16A34A" } },
  };
  const addr = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[addr]) (ws[addr] as any).s = headerStyle;

  (ws as any)["!cols"] = [{ wch: 35 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, classLabel.replace(/[\/\s]+/g, "_").substring(0, 31));
  XLSX.writeFile(wb, filename);
}
