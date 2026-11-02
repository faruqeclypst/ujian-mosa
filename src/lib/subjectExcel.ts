import * as XLSX from "xlsx-js-style";

export const SUBJECT_IMPORT_HEADERS = ["Mata Pelajaran"] as const;

export function downloadSubjectImportTemplate(terminologyOrFilename?: any) {
  let terminology: any = null;
  let filename = "template-import-mapel.xlsx";

  if (typeof terminologyOrFilename === "string") {
    filename = terminologyOrFilename;
  } else if (terminologyOrFilename && typeof terminologyOrFilename === "object") {
    terminology = terminologyOrFilename;
    const subjectLabel = terminology?.subject || "Mata Pelajaran";
    filename = `template-import-${subjectLabel.toLowerCase().replace(/[\/\s]+/g, "-")}.xlsx`;
  }

  const subjectLabel = terminology?.subject || "Mata Pelajaran";
  const isCampus = subjectLabel.toLowerCase().includes("kuliah");
  const headers = [subjectLabel];

  const ws = XLSX.utils.aoa_to_sheet([
    [...headers],
    [isCampus ? "Algoritma & Struktur Data" : "Matematika"],
    [isCampus ? "Pemrograman Web Lanjut" : "Bahasa Indonesia"],
    [isCampus ? "Basis Data Relasional" : "Bahasa Inggris"],
    [isCampus ? "Kecerdasan Buatan" : "Fisika"],
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
    [`Keterangan Import ${subjectLabel}`],
    [],
    ["Aturan:"],
    [`- Nama ${subjectLabel} wajib diisi.`],
    [isCampus ? "- Contoh: Algoritma & Pemrograman, Jaringan Komputer, dsb." : "- Contoh: Matematika, Fisika, Biologi, dsb."],
  ]);
  (wsNotes as any)["!cols"] = [{ wch: 70 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isCampus ? "MataKuliah" : "Subject");
  XLSX.utils.book_append_sheet(wb, wsNotes, "Keterangan");
  XLSX.writeFile(wb, filename);
}

export async function parseSubjectImportExcel(file: File): Promise<{ name: string }[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Sheet tidak ditemukan");

  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  if (raw.length === 0) return [];

  return raw
    .map((row) => {
      // Robust detection: matches "Mata Pelajaran", "Mata Kuliah", "Mapel", "Matkul", "Nama Mata Pelajaran", "Nama Mata Kuliah", "Subject"
      const matchKey = Object.keys(row).find((k) =>
        /(Mata\s*Pelajaran|Mata\s*Kuliah|Mapel|Matkul|Subject)/i.test(k.trim())
      );
      const val = matchKey 
        ? row[matchKey] 
        : (row["Mata Pelajaran"] || row["Mata Kuliah"] || row["Mapel"] || row["Matkul"] || Object.values(row)[0] || "");
      return { name: String(val || "").trim() };
    })
    .filter((v) => v.name.length > 1);
}

export function exportSubjectToExcel(params: { 
  subjects: Array<{ name: string }>; 
  filename?: string;
  terminology?: any;
}) {
  const subjectLabel = params.terminology?.subject || "Mata Pelajaran";
  const filename = params.filename ?? `data-${subjectLabel.toLowerCase().replace(/[\/\s]+/g, "-")}.xlsx`;
  const header = subjectLabel;

  const ws = XLSX.utils.aoa_to_sheet([
    [header],
    ...params.subjects.map((m) => [m.name]),
  ]);

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "16A34A" } },
  };
  const addr = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[addr]) (ws[addr] as any).s = headerStyle;

  (ws as any)["!cols"] = [{ wch: 35 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, subjectLabel.replace(/[\/\s]+/g, "_").substring(0, 31));
  XLSX.writeFile(wb, filename);
}
