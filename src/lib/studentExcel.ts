import * as XLSX from "xlsx";
import type { StudentData, ClassData } from "../types/exam";

export const STUDENT_IMPORT_HEADERS = ["NISN", "Nama Siswa", "Gender (L/P)", "Nama Kelas"] as const;

export function downloadStudentImportTemplate(filename = "Template_Import_Siswa_Master.xlsx") {
  const ws = XLSX.utils.aoa_to_sheet([
    [...STUDENT_IMPORT_HEADERS],
    ["1234567890", "Ahmad Fauzi", "L", "X-MIPA-1"],
    ["0987654321", "Siti Aminah", "P", "X-MIPA-1"],
    ["1122334455", "Budi Santoso", "L", "XI-IPS-2"],
    ["5544332211", "Dewi Lestari", "P", "XI-IPS-2"],
  ]);
  
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "4F46E5" } }, // Indigo 600
    border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
    }
  };

  for (let c = 0; c < STUDENT_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }

  (ws as any)["!cols"] = [
    { wch: 20 }, // NISN
    { wch: 30 }, // Nama student
    { wch: 15 }, // Gender
    { wch: 20 }, // Nama Kelas
  ];

  const wsNotes = XLSX.utils.aoa_to_sheet([
    ["PANDUAN PENGISIAN DATA SISWA"],
    [],
    ["1. NISN", "Wajib diisi. Usahakan format kolom adalah 'Text' agar nol di depan tidak hilang."],
    ["2. NAMA SISWA", "Wajib diisi sesuai nama lengkap."],
    ["3. GENDER", "Isi dengan 'L' untuk Laki-laki atau 'P' untuk Perempuan."],
    ["4. NAMA KELAS", "PENTING: Harus sama persis dengan nama kelas di menu 'Data Kelas'."],
    [],
    ["TIPS:", "Jika nama kelas di sistem adalah 'XII-IPA-1', maka di Excel harus 'XII-IPA-1' (boleh pakai spasi/tanpa spasi karena sistem sudah auto-match)."],
  ]);
  (wsNotes as any)["!cols"] = [{ wch: 20 }, { wch: 80 }];

  const styleNoteHeader = { font: { bold: true, size: 14, color: { rgb: "4F46E5" } } };
  (wsNotes["A1"] as any).s = styleNoteHeader;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DATA_SISWA");
  XLSX.utils.book_append_sheet(wb, wsNotes, "PANDUAN_IMPORT");
  XLSX.writeFile(wb, filename);
}

export async function parseStudentImportExcel(
  file: File, 
  classes: ClassData[]
): Promise<{ 
  results: { nisn: string; name: string; gender: "L" | "P"; classId: string }[],
  skipped: { nisn: string; name: string; className: string }[]
}> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Sheet tidak ditemukan");

  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  const results: { nisn: string; name: string; gender: "L" | "P"; classId: string }[] = [];
  const skipped: { nisn: string; name: string; className: string }[] = [];

  for (const row of raw) {
    const nisn = String(row["NISN"] || "").trim();
    const name = String(row["Nama Siswa"] || "").trim();
    // Detect Gender with multiple possible header names
    const genderRaw = (
      row["Gender (L/P)"] || 
      row["Gender"] || 
      row["Jenis Kelamin"] || 
      row["JK"] || 
      ""
    ).toString().trim().toUpperCase();

    const gender: "L" | "P" = genderRaw.startsWith("P") ? "P" : "L"; 
    // Detect Class Name with multiple possible header names
    const className = (
      row["Nama Kelas"] || 
      row["Kelas"] || 
      row["Class"] || 
      row["Kls"] || 
      ""
    ).toString().trim();

    if (!nisn && !name) continue;

    // Normalize name for comparison (remove spaces, hyphens, dots, underscores)
    const normalize = (s: string) => s.replace(/[\s\-\._]+/g, "").toLowerCase();
    
    const foundClass = classes.find(c => {
      const dbClassName = normalize(c.name);
      const excelClassName = normalize(className);
      return dbClassName === excelClassName || c.id === className;
    });
    
    if (foundClass) {
      results.push({
        nisn,
        name,
        gender,
        classId: foundClass.id,
      });
    } else {
      skipped.push({ nisn, name, className });
    }
  }

  return { results, skipped };
}

export function exportStudentToExcel(params: { 
  students: StudentData[];
  classes: ClassData[];
  filename?: string 
}) {
  const filename = params.filename ?? "data-siswa.xlsx";
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
  XLSX.utils.book_append_sheet(wb, ws, "siswa");
  XLSX.writeFile(wb, filename);
}

