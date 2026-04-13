import * as XLSX from "xlsx-js-style";

export const QUESTION_IMPORT_HEADERS = [
  "Pertanyaan", 
  "Opsi A", 
  "Opsi B", 
  "Opsi C", 
  "Opsi D", 
  "Opsi E", 
  "Kunci Jawaban", 
  "GroupId (Literasi)", 
  "Teks Literasi"
] as const;

export function downloadQuestionTemplate(filename = "Template_Soal_Baru.xlsx") {
  const ws = XLSX.utils.aoa_to_sheet([
    [...QUESTION_IMPORT_HEADERS],
    [
      "Apa makanan utama gajah?", 
      "Daging", 
      "Tumbuhan", 
      "Ikan", 
      "Buah-buahan", 
      "Serangga", 
      "B",
      "GAJAH-01",
      "Gajah adalah mamalia besar yang hidup di hutan-hutan Asia dan Afrika. Gajah merupakan hewan herbivora yang memakan dedaunan dan rumput."
    ],
    [
      "Di mana habitat asli Gajah Afrika?", 
      "Hutan", 
      "Gurun", 
      "Laut", 
      "Pegunungan Es", 
      "Luar Angkasa", 
      "A",
      "GAJAH-01",
      ""
    ],
  ]);
  
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "059669" } }, // Emerald-600
    border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
    }
  };

  for (let c = 0; c < QUESTION_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }

  (ws as any)["!cols"] = [
    { wch: 50 }, // Pertanyaan
    { wch: 20 }, // A
    { wch: 20 }, // B
    { wch: 20 }, // C
    { wch: 20 }, // D
    { wch: 20 }, // E
    { wch: 15 }, // Kunci
    { wch: 20 }, // GroupId
    { wch: 40 }, // GroupText
  ];

  const wsNotes = XLSX.utils.aoa_to_sheet([
    ["PANDUAN PENGISIAN TEMPLATE SOAL"],
    [],
    ["1. Kolom Pertanyaan wajib diisi."],
    ["2. Kolom Opsi A-E diisi dengan teks jawaban."],
    ["3. Kolom Kunci Jawaban diisi dengan huruf (A, B, C, D, atau E)."],
    ["4. Kolom GroupId & Teks Literasi (Opsional):"],
    ["   - Jika beberapa soal memiliki stimulus/wacana yang sama, berikan GroupId yang identik."],
    ["   - Teks Literasi hanya perlu diisi pada soal pertama dalam grup tersebut."],
    [],
    ["Tips: Pastikan tidak ada karakter aneh atau baris kosong di tengah data."],
  ]);
  (wsNotes as any)["!cols"] = [{ wch: 100 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Soal");
  XLSX.utils.book_append_sheet(wb, wsNotes, "Panduan");
  XLSX.writeFile(wb, filename);
}

export async function parseQuestionImportExcel(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets["Soal"] || wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Sheet soal tidak ditemukan. Pastikan menggunakan template yang disediakan.");

  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  return raw
    .map((row) => {
      const qText = String(row["Pertanyaan"] || "").trim();
      if (!qText) return null;

      const choices: Record<string, { text: string; isCorrect: boolean }> = {};
      ['A', 'B', 'C', 'D', 'E'].forEach((letter) => {
        const val = String(row[`Opsi ${letter}`] || "").trim();
        choices[letter.toLowerCase()] = {
          text: val,
          isCorrect: String(row["Kunci Jawaban"] || "").trim().toUpperCase() === letter
        };
      });

      return {
        text: qText,
        type: "pilihan_ganda",
        choices: choices,
        groupId: String(row["GroupId (Literasi)"] || "").trim() || undefined,
        groupText: String(row["Teks Literasi"] || "").trim() || undefined,
      };
    })
    .filter((v) => v !== null);
}
