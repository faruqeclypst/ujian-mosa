import * as XLSX from "xlsx-js-style";
import type { StudentData, ClassData } from "../types/exam";

export const STUDENT_IMPORT_HEADERS = ["NISN", "Nama Siswa", "Gender (L/P)", "Nama Kelas"] as const;

export function downloadStudentImportTemplate(terminology?: any) {
  const studentLabel = terminology?.student || "Siswa";
  const idLabel = terminology?.id || "NISN";
  const classLabel = terminology?.class || "Kelas";
  const filename = `Template_Import_${studentLabel}_Master.xlsx`;

  const headers = [idLabel, `Nama ${studentLabel}`, "Gender (L/P)", `Nama ${classLabel}`];

  const ws = XLSX.utils.aoa_to_sheet([
    [...headers],
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

  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }

  (ws as any)["!cols"] = [
    { wch: 20 }, // ID
    { wch: 30 }, // Nama student
    { wch: 15 }, // Gender
    { wch: 20 }, // Nama Kelas
  ];

  const wsNotes = XLSX.utils.aoa_to_sheet([
    [`PANDUAN PENGISIAN DATA ${studentLabel.toUpperCase()}`],
    [],
    [`1. ${idLabel}`, "Wajib diisi. Usahakan format kolom adalah 'Text' agar nol di depan tidak hilang."],
    [`2. NAMA ${studentLabel.toUpperCase()}`, "Wajib diisi sesuai nama lengkap."],
    ["3. GENDER", "Isi dengan 'L' untuk Laki-laki atau 'P' untuk Perempuan."],
    [`4. NAMA ${classLabel.toUpperCase()}`, `PENTING: Harus sama persis dengan nama ${classLabel.toLowerCase()} di menu 'Data ${classLabel}' .`],
    [],
    ["TIPS:", `Jika nama ${classLabel.toLowerCase()} di sistem adalah 'XII-IPA-1', maka di Excel harus 'XII-IPA-1' (boleh pakai spasi/tanpa spasi karena sistem sudah auto-match).`],
  ]);
  (wsNotes as any)["!cols"] = [{ wch: 20 }, { wch: 80 }];

  const styleNoteHeader = { font: { bold: true, size: 14, color: { rgb: "4F46E5" } } };
  (wsNotes["A1"] as any).s = styleNoteHeader;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `DATA_${studentLabel.toUpperCase()}`);
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
    // Robust detection for ID column
    const nisn = String(
      row["NISN"] || 
      row["NIM"] || 
      row["ID"] || 
      row["Nomor Induk"] ||
      Object.keys(row).find(k => k.match(/NISN|NIM|ID|Nomor/i)) ? row[Object.keys(row).find(k => k.match(/NISN|NIM|ID|Nomor/i))!] : ""
    ).trim();

    // Robust detection for Name column
    const name = String(
      row["Nama Siswa"] || 
      row["Nama Mahasiswa"] || 
      row["Nama"] || 
      row["Name"] ||
      row["Full Name"] ||
      Object.keys(row).find(k => k.match(/Nama|Name/i)) ? row[Object.keys(row).find(k => k.match(/Nama|Name/i))!] : ""
    ).trim();

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
      row["Nama Program"] || 
      row["Kelas"] || 
      row["Program"] || 
      row["Class"] || 
      row["Kls"] || 
      Object.keys(row).find(k => k.match(/Kelas|Program|Class/i)) ? row[Object.keys(row).find(k => k.match(/Kelas|Program|Class/i))!] : ""
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
  filename?: string;
  terminology?: any;
}) {
  const studentLabel = params.terminology?.student || "Siswa";
  const idLabel = params.terminology?.id || "NISN";
  const classLabel = params.terminology?.class || "Kelas";
  
  const filename = params.filename ?? `data-${studentLabel.toLowerCase()}.xlsx`;
  const headers = [idLabel, `Nama ${studentLabel}`, "Gender", `Nama ${classLabel}`];

  const ws = XLSX.utils.aoa_to_sheet([
    [...headers],
    ...params.students.map((s) => {
      const cls = params.classes.find(c => c.id === s.classId);
      return [
        s.nisn, 
        s.name, 
        s.gender, 
        cls ? cls.name : `Tanpa ${classLabel}`
      ];
    }),
  ]);

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "16A34A" } },
  };

  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }

  (ws as any)["!cols"] = [
    { wch: 15 }, // ID
    { wch: 25 }, // Nama student
    { wch: 12 }, // Gender
    { wch: 15 }, // Nama Kelas
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, studentLabel.toLowerCase());
  XLSX.writeFile(wb, filename);
}

export function exportStudentLoginsToExcel(params: { 
  students: StudentData[];
  classes: ClassData[];
  filename?: string;
  terminology?: any;
}) {
  const studentLabel = params.terminology?.student || "Siswa";
  const idLabel = params.terminology?.id || "NISN";
  const classLabel = params.terminology?.class || "Kelas";
  
  const filename = params.filename ?? `data-login-${studentLabel.toLowerCase()}.xlsx`;
  const headers = [idLabel, `Nama ${studentLabel}`, `Nama ${classLabel}`, "Username", "Password"];

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "D97706" } }, // Amber-600
  };

  const cols = [
    { wch: 15 }, // ID
    { wch: 25 }, // Nama student
    { wch: 20 }, // Nama Kelas
    { wch: 20 }, // Username
    { wch: 15 }, // Password
  ];

  const wb = XLSX.utils.book_new();

  // Helper to create and append a sheet
  const createSheet = (data: StudentData[], sheetName: string) => {
    const wsData = [
      [...headers],
      ...data.map((s) => {
        const cls = params.classes.find(c => c.id === s.classId);
        return [
          s.nisn, 
          s.name, 
          cls ? cls.name : `Tanpa ${classLabel}`,
          s.nisn, 
          "12345678"
        ];
      })
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: c });
      if (ws[addr]) (ws[addr] as any).s = headerStyle;
    }
    (ws as any)["!cols"] = cols;
    
    // Clean sheet name (max 31 chars, no invalid chars for Excel)
    let safeName = sheetName.replace(/[\\\/\?\*\[\]\:]/g, "").substring(0, 31) || "Sheet";
    
    // Ensure unique sheet name (just in case truncation causes duplicates)
    let finalName = safeName;
    let counter = 1;
    while (wb.SheetNames.includes(finalName)) {
      finalName = `${safeName.substring(0, 28)}_${counter}`;
      counter++;
    }

    XLSX.utils.book_append_sheet(wb, ws, finalName);
  };

  // 1. Sheet for ALL classes
  createSheet(params.students, `Semua ${classLabel}`);

  // 2. Sheets for individual classes
  const classGroups: Record<string, StudentData[]> = {};
  const noClassKey = `Tanpa ${classLabel}`;
  
  params.students.forEach(s => {
    const cls = params.classes.find(c => c.id === s.classId);
    const key = cls ? cls.name : noClassKey;
    if (!classGroups[key]) classGroups[key] = [];
    classGroups[key].push(s);
  });

  // Sort class names alphabetically
  const sortedClassNames = Object.keys(classGroups).sort((a, b) => 
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  for (const cName of sortedClassNames) {
    createSheet(classGroups[cName], cName);
  }

  XLSX.writeFile(wb, filename);
}


