import * as XLSX from "xlsx-js-style";

export const QUESTION_IMPORT_HEADERS = [
  "Pertanyaan", 
  "Tipe Soal",
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
      "pilihan_ganda",
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
      "pilihan_ganda",
      "Hutan", 
      "Gurun", 
      "Laut", 
      "Pegunungan Es", 
      "Luar Angkasa", 
      "A",
      "GAJAH-01",
      ""
    ],
    [
      "Gajah adalah hewan karnivora",
      "benar_salah",
      "Benar",
      "Salah",
      "",
      "",
      "",
      "B",
      "",
      ""
    ],
    [
      "Sebutkan 3 ciri-ciri gajah!",
      "isian_singkat",
      "",
      "",
      "",
      "",
      "",
      "Belalai panjang, telinga lebar, badan besar",
      "",
      ""
    ],
  ]);
  
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "059669" } },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  };

  for (let c = 0; c < QUESTION_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }

  (ws as any)["!cols"] = [
    { wch: 50 }, // Pertanyaan
    { wch: 20 }, // Tipe Soal
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
    ["2. Kolom Tipe Soal (opsional, default: pilihan_ganda):"],
    ["   - pilihan_ganda: Pilihan ganda biasa (1 jawaban benar)"],
    ["   - pilihan_ganda_kompleks: Pilihan ganda dengan >1 jawaban benar (kunci: A,C,E)"],
    ["   - benar_salah: Benar/Salah (isi Opsi A=Benar, Opsi B=Salah)"],
    ["   - isian_singkat: Isian singkat (kunci jawaban di kolom Kunci Jawaban)"],
    ["   - uraian: Uraian/Essay (kunci jawaban opsional)"],
    [],
    ["3. Kolom Opsi A-E diisi dengan teks jawaban."],
    ["4. Kolom Kunci Jawaban:"],
    ["   - Untuk pilihan_ganda: isi huruf (A, B, C, D, atau E)"],
    ["   - Untuk pilihan_ganda_kompleks: isi huruf dipisah koma (A,C,E)"],
    ["   - Untuk isian_singkat/uraian: isi teks jawaban"],
    ["5. Kolom GroupId & Teks Literasi (Opsional):"],
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

// Type mapping from Indonesian to DB field
const TYPE_MAP: Record<string, { type: string; field: string }> = {
  pilihan_ganda: { type: "pilihan_ganda", field: "multiple_choice" },
  pg: { type: "pilihan_ganda", field: "multiple_choice" },
  "pilihan ganda": { type: "pilihan_ganda", field: "multiple_choice" },
  pilihan_ganda_kompleks: { type: "pilihan_ganda_kompleks", field: "complex_choice" },
  "pg kompleks": { type: "pilihan_ganda_kompleks", field: "complex_choice" },
  benar_salah: { type: "benar_salah", field: "true_false" },
  "benar salah": { type: "benar_salah", field: "true_false" },
  isian_singkat: { type: "isian_singkat", field: "short_answer" },
  "isian singkat": { type: "isian_singkat", field: "short_answer" },
  isian: { type: "isian_singkat", field: "short_answer" },
  uraian: { type: "uraian", field: "essay" },
  essay: { type: "uraian", field: "essay" },
};

export async function parseQuestionImportExcel(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets["Soal"] || wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Sheet soal tidak ditemukan. Pastikan menggunakan template yang disediakan.");

  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  return raw
    .map((row) => {
      const cleanRow: Record<string, any> = {};
      Object.keys(row).forEach(key => { cleanRow[key.trim()] = row[key]; });

      const qText = String(cleanRow["Pertanyaan"] || "").trim();
      if (!qText) return null;

      // Resolve question type
      const rawType = String(cleanRow["Tipe Soal"] || "").trim().toLowerCase();
      const typeInfo = TYPE_MAP[rawType] || TYPE_MAP["pilihan_ganda"];
      
      const rawAnswer = String(cleanRow["Kunci Jawaban"] || "").trim();

      // For isian_singkat / uraian: answer key is the text answer itself
      if (typeInfo.type === "isian_singkat" || typeInfo.type === "uraian") {
        return {
          text: qText,
          type: typeInfo.type,
          field: typeInfo.field,
          choices: {},
          answerKey: rawAnswer,
          groupId: String(cleanRow["GroupId (Literasi)"] || "").trim() || undefined,
          groupText: String(cleanRow["Teks Literasi"] || "").trim() || undefined,
        };
      }

      // For pilihan_ganda_kompleks: multiple correct answers (e.g., "A,C,E")
      const correctLetters = rawAnswer.toUpperCase().split(/[,\s]+/).filter(l => /^[A-E]$/.test(l));
      
      const choices: Record<string, { text: string; isCorrect: boolean; imageUrl: string }> = {};
      ['A', 'B', 'C', 'D', 'E'].forEach((letter) => {
        const val = String(cleanRow[`Opsi ${letter}`] || "").trim();
        if (val || typeInfo.type === "benar_salah") { // Include even empty for benar_salah
          choices[letter.toLowerCase()] = {
            text: val,
            isCorrect: correctLetters.includes(letter),
            imageUrl: ""
          };
        }
      });

      // Filter out empty choices (except for benar_salah which needs A and B)
      const filteredChoices: Record<string, any> = {};
      Object.entries(choices).forEach(([k, v]) => {
        if (v.text || typeInfo.type === "benar_salah") {
          filteredChoices[k] = v;
        }
      });

      return {
        text: qText,
        type: typeInfo.type,
        field: typeInfo.field,
        choices: filteredChoices,
        answerKey: correctLetters.length > 0 ? correctLetters.join(",").toLowerCase() : undefined,
        groupId: String(cleanRow["GroupId (Literasi)"] || "").trim() || undefined,
        groupText: String(cleanRow["Teks Literasi"] || "").trim() || undefined,
      };
    })
    .filter((v) => v !== null);
}
