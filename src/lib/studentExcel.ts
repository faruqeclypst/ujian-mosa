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



// ─── Export Nilai Semua Siswa per Mapel/Ruang (Admin Only) ───────────────────

export interface ExamScoreRow {
  nisn: string;
  name: string;
  className: string;
  examTitle: string;
  subjectName: string;
  roomName: string;
  objectiveCorrect: number;
  objectiveTotal: number;
  essayTotal: number;
  essayCorrect: number;
  objectiveScore: number;
  essayScore: number;
  finalScore: number | null;
  status: string;
  submittedAt: string;
  essayGraded: number;
}

export async function exportAllStudentScores(params: {
  pb: any;
  students: StudentData[];
  classes: ClassData[];
  terminology?: any;
  filename?: string;
}) {
  const { pb, students, classes, terminology } = params;
  const studentLabel = terminology?.student || "Siswa";
  const classLabel = terminology?.class || "Kelas";
  const idLabel = terminology?.id || "NISN";
  const filename = params.filename || `rekap-nilai-${studentLabel.toLowerCase()}.xlsx`;

  // 1. Fetch semua attempt yang finished
  const attempts = await pb.collection("attempts").getFullList({
    filter: 'status = "finished"',
    sort: "-submittedAt",
  });

  if (attempts.length === 0) {
    throw new Error("Belum ada data nilai yang tersedia.");
  }

  // 2. Fetch semua exam_rooms
  const rooms = await pb.collection("exam_rooms").getFullList({
    expand: "examId,examId.subjectId",
    sort: "created",
  });

  // Build lookup maps
  const roomMap: Record<string, any> = {};
  rooms.forEach((r: any) => {
    roomMap[r.id] = r;
  });

  const studentMap: Record<string, StudentData> = {};
  students.forEach(s => { studentMap[s.id] = s; });

  const classMap: Record<string, string> = {};
  classes.forEach(c => { classMap[c.id] = c.name; });

  // 3. Build score rows
  const rows: ExamScoreRow[] = [];
  for (const att of attempts) {
    const student = studentMap[att.studentId || att.student_id];
    if (!student) continue;

    const room = roomMap[att.examRoomId || att.exam_room_id];
    if (!room) continue;

    const exam = room.expand?.examId;
    const subject = exam?.expand?.subjectId;

    const meta = att.answers?.__meta;
    const objCorrect = meta?.objectiveCorrect ?? att.objectiveCorrect ?? att.correct ?? 0;
    const objTotal = meta?.objectiveTotal ?? att.objectiveTotal ?? att.total ?? 0;
    const essayTotal = meta?.essayTotal ?? att.essayTotal ?? 0;
    const essayCorrect = meta?.essayCorrect ?? att.essayCorrect ?? 0;

    const objectiveScore = meta?.objectiveScore ?? att.objectiveScore ?? (objTotal > 0 ? Math.round((objCorrect / objTotal) * 100) : (att.score ?? 0));
    const essayScore = meta?.essayScore ?? att.essayScore ?? (essayTotal > 0 ? Math.round((essayCorrect / essayTotal) * 100) : 0);
    const finalScore = att.score ?? (essayTotal === 0 ? objectiveScore : Math.round(objectiveScore * 0.6 + essayScore * 0.4));

    rows.push({
      nisn: student.nisn,
      name: student.name,
      className: classMap[student.classId] || student.classId || "-",
      examTitle: exam?.title || room.room_name || "-",
      subjectName: subject?.name || "-",
      roomName: room.room_name || room.name || "-",
      objectiveCorrect: objCorrect,
      objectiveTotal: objTotal,
      essayTotal,
      essayCorrect,
      objectiveScore,
      essayScore,
      finalScore,
      status: att.status || "-",
      submittedAt: att.submittedAt
        ? new Date(att.submittedAt).toLocaleString("id-ID")
        : "-",
      essayGraded: meta?.essayGraded ?? att.essayGraded ?? 0,
    });
  }

  if (rows.length === 0) {
    throw new Error("Tidak ada data nilai yang cocok dengan daftar siswa.");
  }

  // Sort: kelas ASC, lalu nama ASC
  rows.sort((a, b) => {
    const classCmp = a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: "base" });
    if (classCmp !== 0) return classCmp;
    return a.name.localeCompare(b.name, "id", { sensitivity: "base" });
  });

  // 4. Build Excel
  const HEADER_STYLE = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { patternType: "solid", fgColor: { rgb: "1D4ED8" } },
    border: {
      top: { style: "thin", color: { rgb: "93C5FD" } },
      bottom: { style: "thin", color: { rgb: "93C5FD" } },
      left: { style: "thin", color: { rgb: "93C5FD" } },
      right: { style: "thin", color: { rgb: "93C5FD" } },
    },
  };
  const GOOD_STYLE   = { fill: { patternType: "solid", fgColor: { rgb: "D1FAE5" } }, font: { color: { rgb: "065F46" }, bold: true }, alignment: { horizontal: "center", vertical: "center" } }; // hijau ≥75
  const MED_STYLE    = { fill: { patternType: "solid", fgColor: { rgb: "FEF9C3" } }, font: { color: { rgb: "854D0E" }, bold: true }, alignment: { horizontal: "center", vertical: "center" } }; // kuning 50-74
  const BAD_STYLE    = { fill: { patternType: "solid", fgColor: { rgb: "FEE2E2" } }, font: { color: { rgb: "991B1B" }, bold: true }, alignment: { horizontal: "center", vertical: "center" } }; // merah <50
  const CENTER_STYLE = { alignment: { horizontal: "center", vertical: "center" } };

  const scoreStyle = (score: number | null) => {
    if (score === null) return null;
    if (score >= 75) return GOOD_STYLE;
    if (score >= 50) return MED_STYLE;
    return BAD_STYLE;
  };

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Semua nilai (flat) ──────────────────────────────────────────
  const headerRow1 = [
    idLabel, `Nama ${studentLabel}`, classLabel,
    "Mata Pelajaran",
    "Objektif", "", "",
    "Subjektif", "",
    "Nilai Akhir",
    "Status", "Waktu Submit"
  ];
  const headerRow2 = [
    "", "", "", "",
    "Jumlah Benar", "100%", "60%",
    "Jumlah Benar", "40%",
    "", "", ""
  ];

  const allData = [headerRow1, headerRow2, ...rows.map((r, idx) => {
    const ri = idx + 3;
    const isEssayGraded = r.essayGraded >= r.essayTotal;
    return [
      { t: "s", v: r.nisn, s: CENTER_STYLE },
      { t: "s", v: r.name },
      { t: "s", v: r.className, s: CENTER_STYLE },
      { t: "s", v: r.subjectName },
      { t: "s", v: `${r.objectiveCorrect}/${r.objectiveTotal}`, z: "@", s: CENTER_STYLE },
      { t: "n", v: r.objectiveScore, s: scoreStyle(r.objectiveScore) || CENTER_STYLE },
      { t: "n", v: Math.round(r.objectiveScore * 0.6), f: `ROUND(F${ri}*0.6,0)`, s: CENTER_STYLE },
      r.essayTotal > 0 ? (
        isEssayGraded ?
          { t: "s", v: `${r.essayCorrect}/${r.essayTotal}`, z: "@", s: CENTER_STYLE } :
          { t: "s", v: `${r.essayGraded}/${r.essayTotal} dinilai`, s: CENTER_STYLE }
      ) : { t: "s", v: "-", s: CENTER_STYLE },
      { t: "n", v: r.essayTotal > 0 ? Math.round(r.essayScore * 0.4) : 0, s: CENTER_STYLE },
      { t: "n", v: r.finalScore ?? 0, f: r.essayTotal > 0 ? `ROUND(G${ri}+I${ri},0)` : `F${ri}`, s: scoreStyle(r.finalScore) || CENTER_STYLE },
      { t: "s", v: r.status, s: CENTER_STYLE },
      { t: "s", v: r.submittedAt, s: CENTER_STYLE }
    ];
  })];

  const wsAll = XLSX.utils.aoa_to_sheet(allData);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < headerRow1.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (wsAll[addr]) (wsAll[addr] as any).s = HEADER_STYLE;
    }
  }

  const mergesAll = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // ID
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Nama
    { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // Kelas
    { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } }, // Mata Pelajaran
    { s: { r: 0, c: 4 }, e: { r: 0, c: 6 } }, // Objektif (4 to 6)
    { s: { r: 0, c: 7 }, e: { r: 0, c: 8 } }, // Subjektif (7 to 8)
    { s: { r: 0, c: 9 }, e: { r: 1, c: 9 } }, // Nilai Akhir
    { s: { r: 0, c: 10 }, e: { r: 1, c: 10 } }, // Status
    { s: { r: 0, c: 11 }, e: { r: 1, c: 11 } } // Waktu Submit
  ];
  wsAll["!merges"] = mergesAll;
  (wsAll as any)["!cols"] = [
    { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 24 },
    { wch: 14 }, { wch: 8 }, { wch: 8 }, // Objektif: Jumlah Benar, 100%, 60%
    { wch: 14 }, { wch: 8 }, { wch: 12 }, // Subjektif: Jumlah Benar, 40%, Nilai Akhir
    { wch: 12 }, { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsAll, `Semua Nilai`);

  // ── Sheet per Mata Pelajaran ─────────────────────────────────────────────
  const bySubject: Record<string, ExamScoreRow[]> = {};
  rows.forEach(r => {
    const key = r.subjectName || "Lainnya";
    if (!bySubject[key]) bySubject[key] = [];
    bySubject[key].push(r);
  });

  Object.keys(bySubject).sort().forEach(subject => {
    const subRows = bySubject[subject];
    // Group further by room within subject
    const byRoom: Record<string, ExamScoreRow[]> = {};
    subRows.forEach(r => {
      if (!byRoom[r.roomName]) byRoom[r.roomName] = [];
      byRoom[r.roomName].push(r);
    });

    // One sheet per subject, rows grouped by room
    const sheetData: any[][] = [headerRow1, headerRow2];
    const mergesSubject = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // ID
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Nama
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // Kelas
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } }, // Mata Pelajaran
      { s: { r: 0, c: 4 }, e: { r: 0, c: 6 } }, // Objektif (4 to 6)
      { s: { r: 0, c: 7 }, e: { r: 0, c: 8 } }, // Subjektif (7 to 8)
      { s: { r: 0, c: 9 }, e: { r: 1, c: 9 } }, // Nilai Akhir
      { s: { r: 0, c: 10 }, e: { r: 1, c: 10 } }, // Status
      { s: { r: 0, c: 11 }, e: { r: 1, c: 11 } } // Waktu Submit
    ];

    Object.keys(byRoom).sort().forEach(room => {
      // Room separator row - only if room name is valid and not "-"
      const showSeparator = room !== "-" && room !== "";
      if (showSeparator) {
        const sepIdx = sheetData.length;
        mergesSubject.push({ s: { r: sepIdx, c: 0 }, e: { r: sepIdx, c: 11 } });
        const sepStyle = {
          font: { bold: true, color: { rgb: "374151" } },
          fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
          alignment: { horizontal: "center", vertical: "center" }
        };
        sheetData.push([
          { t: "s", v: `— Ruang: ${room} —`, s: sepStyle },
          ...Array(11).fill("")
        ]);
      }
      byRoom[room].forEach(r => {
        const ri = sheetData.length + 1;
        const isEssayGraded = r.essayGraded >= r.essayTotal;
        sheetData.push([
          { t: "s", v: r.nisn, s: CENTER_STYLE },
          { t: "s", v: r.name },
          { t: "s", v: r.className, s: CENTER_STYLE },
          { t: "s", v: r.subjectName },
          { t: "s", v: `${r.objectiveCorrect}/${r.objectiveTotal}`, z: "@", s: CENTER_STYLE },
          { t: "n", v: r.objectiveScore, s: scoreStyle(r.objectiveScore) || CENTER_STYLE },
          { t: "n", v: Math.round(r.objectiveScore * 0.6), f: `ROUND(F${ri}*0.6,0)`, s: CENTER_STYLE },
          r.essayTotal > 0 ? (
            isEssayGraded ?
              { t: "s", v: `${r.essayCorrect}/${r.essayTotal}`, z: "@", s: CENTER_STYLE } :
              { t: "s", v: `${r.essayGraded}/${r.essayTotal} dinilai`, s: CENTER_STYLE }
          ) : { t: "s", v: "-", s: CENTER_STYLE },
          { t: "n", v: r.essayTotal > 0 ? Math.round(r.essayScore * 0.4) : 0, s: CENTER_STYLE },
          { t: "n", v: r.finalScore ?? 0, f: r.essayTotal > 0 ? `ROUND(G${ri}+I${ri},0)` : `F${ri}`, s: scoreStyle(r.finalScore) || CENTER_STYLE },
          { t: "s", v: r.status, s: CENTER_STYLE },
          { t: "s", v: r.submittedAt, s: CENTER_STYLE }
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < headerRow1.length; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]) (ws[addr] as any).s = HEADER_STYLE;
      }
    }
    ws["!merges"] = mergesSubject;
    (ws as any)["!cols"] = [
      { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 24 },
      { wch: 14 }, { wch: 8 }, { wch: 8 }, // Objektif: Jumlah Benar, 100%, 60%
      { wch: 14 }, { wch: 8 }, { wch: 12 }, // Subjektif: Jumlah Benar, 40%, Nilai Akhir
      { wch: 12 }, { wch: 20 }
    ];

    const safeName = subject.replace(/[\\\/\?\*\[\]\:]/g, "").substring(0, 31) || "Sheet";
    let finalName = safeName;
    let n = 1;
    while (wb.SheetNames.includes(finalName)) {
      finalName = `${safeName.substring(0, 28)}_${n++}`;
    }
    XLSX.utils.book_append_sheet(wb, ws, finalName);
  });

  XLSX.writeFile(wb, filename);
}
