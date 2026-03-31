import * as XLSX from "xlsx-js-style";
import type { StudentData, ClassData } from "../types/exam";

export const STUDENT_IMPORT_HEADERS = ["NISN", "Nama student", "Gender (L/P)", "Nama Kelas"] as const;

export function downloadStudentImportTemplate(filename = "template-import-student.xlsx") {
  const ws = XLSX.utils.aoa_to_sheet([
    [...STUDENT_IMPORT_HEADERS],
    ["1234567890", "Ahmad Fauzi", "L", "X MIPA 1"],
    ["0987654321", "Siti Aminah", "P", "XI IPS 2"],
  ]);
  
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
  };

  for (let c = 0; c < STUDENT_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }

  (ws as any)["!cols"] = [
    { wch: 15 }, // NISN
    { wch: 25 }, // Nama student
    { wch: 12 }, // Gender
    { wch: 15 }, // Nama Kelas
  ];

  const wsNotes = XLSX.utils.aoa_to_sheet([
    ["Keterangan Import student"],
    [],
    ["Aturan:"],
    ["- NISN wajib diisi (angka 10 digit biasanya)."],
    ["- Nama student wajib diisi."],
    ["- Gender wajib diisi dengan huruf L atau P."],
    ["- Nama Kelas wajib disi (pilih nama kelas yang sudah didaftarkan pada Menu Data Kelas)."],
  ]);
  (wsNotes as any)["!cols"] = [{ wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "student");
  XLSX.utils.book_append_sheet(wb, wsNotes, "Keterangan");
  XLSX.writeFile(wb, filename);
}

export async function parseStudentImportExcel(
  file: File, 
  classes: ClassData[]
): Promise<{ nisn: string; name: string; gender: "L" | "P"; classId: string }[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Sheet tidak ditemukan");

  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  const results: { nisn: string; name: string; gender: "L" | "P"; classId: string }[] = [];

  for (const row of raw) {
    const nisn = String(row["NISN"] || "").trim();
    const name = String(row["Nama student"] || "").trim();
    const genderRaw = String(row["Gender (L/P)"] || "").trim().toUpperCase();
    const className = String(row["Nama Kelas"] || "").trim();

    const gender: "L" | "P" = genderRaw === "P" ? "P" : "L"; // Fallback to L if invalid

    // Find classId
    const foundClass = classes.find(c => c.name.toLowerCase() === className.toLowerCase());
    
    if (nisn && name && foundClass) {
      results.push({
        nisn,
        name,
        gender,
        classId: foundClass.id,
      });
    }
  }

  return results;
}

export function exportStudentToExcel(params: { 
  students: StudentData[];
  classes: ClassData[];
  filename?: string 
}) {
  const filename = params.filename ?? "data-student.xlsx";
  const ws = XLSX.utils.aoa_to_sheet([
    [...STUDENT_IMPORT_HEADERS],
    ...params.students.map((s) => {
      const cls = params.classes.find(c => c.id === s.classId);
      return [
        s.nisn, 
        s.name, 
        s.gender, 
        cls ? cls.name : "Tanpa Kelas"
      ];
    }),
  ]);

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "16A34A" } },
  };

  for (let c = 0; c < STUDENT_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }

  (ws as any)["!cols"] = [
    { wch: 15 }, // NISN
    { wch: 25 }, // Nama student
    { wch: 12 }, // Gender
    { wch: 15 }, // Nama Kelas
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "student");
  XLSX.writeFile(wb, filename);
}

