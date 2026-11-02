import * as XLSX from "xlsx-js-style";

export const TEACHER_IMPORT_HEADERS = ["Nama Guru", "Kode Guru", "Username Login", "Mapel Utama (Pisahkan dengan koma)"] as const;

export function downloadTeacherImportTemplate(terminologyOrFilename?: any) {
  let terminology: any = null;
  let filename = "template-import-guru.xlsx";

  if (typeof terminologyOrFilename === "string") {
    filename = terminologyOrFilename;
  } else if (terminologyOrFilename && typeof terminologyOrFilename === "object") {
    terminology = terminologyOrFilename;
    const teacherLabel = terminology?.teacher || "Guru";
    filename = `template-import-${teacherLabel.toLowerCase().replace(/\s+/g, "-")}.xlsx`;
  }

  const teacherLabel = terminology?.teacher || "Guru";
  const subjectLabel = terminology?.subject || "Mata Pelajaran";
  const isCampus = teacherLabel.toLowerCase() === "dosen";

  const headers = [
    `Nama ${teacherLabel}`,
    `Kode ${teacherLabel}`,
    "Username Login",
    `${subjectLabel} Utama (Pisahkan dengan koma)`
  ];

  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    isCampus
      ? ["Dr. Hendra Gunawan, M.T.", "HG", "hendragunawan", "Algoritma & Pemrograman, Basis Data"]
      : ["Pak Toni Syafi'i", "TS", "tonisyafii", "Informatika, Matematika"],
    isCampus
      ? ["Siti Aminah, S.Kom., M.Cs.", "SA", "sitiaminah", "Kecerdasan Buatan, Rekayasa Web"]
      : ["Bu Siti Aminah", "SA", "sitiaminah", "Bahasa Indonesia"],
  ]);
  
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
  };

  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }

  (ws as any)["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 20 }, { wch: 45 }];

  const wsNotes = XLSX.utils.aoa_to_sheet([
    [`Keterangan Import ${teacherLabel}`],
    [],
    ["Aturan:"],
    [`- Nama ${teacherLabel} wajib diisi.`],
    [`- Kode ${teacherLabel}: opsional (misal: TS, SA, HG).`],
    ["- Username Login: opsional (jika kosong akan dibuat otomatis dari nama)."],
    [`- ${subjectLabel} Utama: pisahkan dengan koma jika lebih dari satu (misal: Matematika, IPA).`],
  ]);
  (wsNotes as any)["!cols"] = [{ wch: 80 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isCampus ? "Dosen" : "Teacher");
  XLSX.utils.book_append_sheet(wb, wsNotes, "Keterangan");
  XLSX.writeFile(wb, filename);
}

export async function parseTeacherImportExcel(file: File): Promise<{ name: string; code?: string; username?: string; subjects: string[] }[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Sheet tidak ditemukan");

  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  return raw
    .map((row) => {
      // Find name: "Nama Guru", "Nama Dosen", "Nama Pengajar", "Dosen", "Guru", "Nama", "Nama Lengkap"
      const nameKey = Object.keys(row).find((k) =>
        /^(Nama\s+)?(Guru|Dosen|Pengajar|Lengkap|Teacher|Lecturer)$|^Nama$/i.test(k.trim())
      );
      const name = String((nameKey ? row[nameKey] : (row["Nama Guru"] || row["Nama Dosen"] || row["Nama"])) || "").trim();

      // Find code: "Kode Guru", "Kode Dosen", "Kode", "NIDN", "NIP"
      const codeKey = Object.keys(row).find((k) =>
        /^(Kode\s+)?(Guru|Dosen|Pengajar)|^(Kode|NIDN|NIP)$/i.test(k.trim())
      );
      const code = String((codeKey ? row[codeKey] : (row["Kode Guru"] || row["Kode Dosen"])) || "").trim() || undefined;

      // Find username: "Username Login", "Username", "User"
      const userKey = Object.keys(row).find((k) =>
        /^Username/i.test(k.trim())
      );
      const username = String((userKey ? row[userKey] : row["Username Login"]) || "").trim() || undefined;

      // Find subjects: "Mapel Utama", "Mata Kuliah Utama", "Mata Pelajaran", "Mata Kuliah", "Matkul", "Subject"
      const subKey = Object.keys(row).find((k) =>
        /(Mapel|Mata\s*Pelajaran|Mata\s*Kuliah|Matkul|Subject)/i.test(k.trim())
      );
      const subStr = String((subKey ? row[subKey] : (row["Mapel Utama (Pisahkan dengan koma)"] || row["Mata Kuliah Utama"])) || "");
      const subjects = subStr
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      return { name, code, username, subjects };
    })
    .filter((v) => v.name.length > 0);
}

export function exportTeacherToExcel(params: { 
  teachers: Array<{ name: string; code?: string; username?: string; subjects?: string[] }>; 
  filename?: string;
  terminology?: any;
}) {
  const teacherLabel = params.terminology?.teacher || "Guru";
  const subjectLabel = params.terminology?.subject || "Mata Pelajaran";
  const filename = params.filename ?? `data-${teacherLabel.toLowerCase().replace(/\s+/g, "-")}.xlsx`;

  const headers = [
    `Nama ${teacherLabel}`, 
    `Kode ${teacherLabel}`, 
    "Username Login", 
    `${subjectLabel} Utama (Pisahkan dengan koma)`
  ];

  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    ...params.teachers.map((t) => [t.name, t.code || "", t.username || "", (t.subjects || []).join(", ")]),
  ]);

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "16A34A" } },
  };
  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }

  (ws as any)["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 20 }, { wch: 45 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, teacherLabel.replace(/[\/\s]+/g, "_").substring(0, 31));
  XLSX.writeFile(wb, filename);
}
