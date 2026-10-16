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
  "Teks Literasi",
  "Kategori / Kolom",
  "Pernyataan & Kunci",
  "Kunci Rumpang"
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
      "",
      "",
      "",
      ""
    ],
    [
      "Tentukan kategori yang sesuai untuk setiap pernyataan berikut.",
      "klasifikasi",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Mamalia | Burung | Reptil",
      "Gajah memiliki belalai => Mamalia\nElang terbang dengan sayap => Burung\nUlar tidak berkaki => Reptil",
      ""
    ],
    [
      "Tentukan Benar atau Salah untuk setiap pernyataan berikut.",
      "matriks",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Benar | Salah",
      "Gajah adalah mamalia => Benar\nGajah bisa terbang => Salah",
      ""
    ],
    [
      "Ibu kota Indonesia adalah [[1]] dan mata uangnya [[2]].",
      "isian_rumpang",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "1=Jakarta; 2=Rupiah/Rp"
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
    { wch: 30 }, // Kategori / Kolom
    { wch: 50 }, // Pernyataan & Kunci
    { wch: 30 }, // Kunci Rumpang
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
    ["   - klasifikasi: Klasifikasi (kategori di kolom 'Kategori / Kolom' pisah |, pernyataan di 'Pernyataan & Kunci' format: pernyataan => kategori, pisah baris baru)"],
    ["   - matriks: Matriks (kolom di 'Kategori / Kolom' pisah |, pernyataan di 'Pernyataan & Kunci' format: pernyataan => kolom, pisah baris baru)"],
    ["   - isian_rumpang: Isian rumpang (tulis teks dengan [[1]], [[2]] di kolom Pertanyaan, kunci di 'Kunci Rumpang' format: 1=Jakarta; 2=Rupiah/Rp)"],
    ["   - hotspot: TIDAK didukung via Excel — gunakan editor soal di aplikasi (butuh gambar + tandai area)"],
    [],
    ["3. Kolom Opsi A-E diisi dengan teks jawaban."],
    ["4. Kolom Kunci Jawaban:"],
    ["   - Untuk pilihan_ganda: isi huruf (A, B, C, D, atau E)"],
    ["   - Untuk pilihan_ganda_kompleks: isi huruf dipisah koma (A,C,E)"],
    ["   - Untuk isian_singkat/uraian: isi teks jawaban"],
    ["5. Kolom GroupId & Teks Literasi (Opsional):"],
    ["   - Jika beberapa soal memiliki stimulus/literasi yang sama, berikan GroupId yang identik."],
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
  klasifikasi: { type: "klasifikasi", field: "klasifikasi" },
  "klasifikasi / categorization": { type: "klasifikasi", field: "klasifikasi" },
  matriks: { type: "matriks", field: "matriks" },
  "matriks pilihan ganda": { type: "matriks", field: "matriks" },
  isian_rumpang: { type: "isian_rumpang", field: "isian_rumpang" },
  "isian rumpang": { type: "isian_rumpang", field: "isian_rumpang" },
  cloze: { type: "isian_rumpang", field: "isian_rumpang" },
  hotspot: { type: "hotspot", field: "hotspot" },
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

      // hotspot: tidak didukung via Excel
      if (typeInfo.type === "hotspot") {
        throw new Error(`Baris "${qText.substring(0, 40)}...": tipe hotspot tidak didukung via Excel. Gunakan editor soal di aplikasi untuk upload gambar dan menandai area.`);
      }

      // klasifikasi & matriks: kolom "Kategori / Kolom" + "Pernyataan & Kunci"
      if (typeInfo.type === "klasifikasi" || typeInfo.type === "matriks") {
        const catCol = String(cleanRow["Kategori / Kolom"] || "").trim();
        const stmtCol = String(cleanRow["Pernyataan & Kunci"] || "").trim();
        if (!catCol) throw new Error(`Baris "${qText.substring(0, 40)}...": kolom "Kategori / Kolom" wajib diisi untuk tipe ${typeInfo.type}.`);
        if (!stmtCol) throw new Error(`Baris "${qText.substring(0, 40)}...": kolom "Pernyataan & Kunci" wajib diisi untuk tipe ${typeInfo.type}.`);

        const labels = catCol.split("|").map(s => s.trim()).filter(Boolean);
        if (labels.length < 2) throw new Error(`Baris "${qText.substring(0, 40)}...": minimal 2 kategori/kolom dipisah "|".`);

        const labelIds = labels.map((label, i) => ({ id: `c${i + 1}`, text: label }));
        const labelMap = new Map(labelIds.map(l => [l.text.toLowerCase(), l.id]));

        const statements = stmtCol.split(/\r?\n/).map((line, i) => {
          const parts = line.split("=>").map(s => s.trim());
          if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new Error(`Baris "${qText.substring(0, 40)}...": format pernyataan baris ${i + 1} salah. Gunakan: pernyataan => kategori`);
          }
          const catId = labelMap.get(parts[1].toLowerCase());
          if (!catId) {
            throw new Error(`Baris "${qText.substring(0, 40)}...": kategori "${parts[1]}" tidak ada di daftar Kategori / Kolom (baris ${i + 1}).`);
          }
          return { id: `s${i + 1}`, text: parts[0], answer: catId };
        }).filter(s => s.text);

        if (statements.length === 0) throw new Error(`Baris "${qText.substring(0, 40)}...": tidak ada pernyataan valid.`);

        const options = typeInfo.type === "klasifikasi"
          ? { categories: labelIds, statements, shuffleStatements: true }
          : { columns: labelIds, statements };

        return {
          text: qText,
          type: typeInfo.type,
          field: typeInfo.field,
          choices: options,
          answerKey: "",
          groupId: String(cleanRow["GroupId (Literasi)"] || "").trim() || undefined,
          groupText: String(cleanRow["Teks Literasi"] || "").trim() || undefined,
        };
      }

      // isian_rumpang: kolom Pertanyaan berisi [[n]], kunci di "Kunci Rumpang"
      if (typeInfo.type === "isian_rumpang") {
        const kunciCol = String(cleanRow["Kunci Rumpang"] || "").trim();
        const blankMatches = [...qText.matchAll(/\[\[(\d+)\]\]/g)].map(m => m[1]);
        if (blankMatches.length === 0) {
          throw new Error(`Baris "${qText.substring(0, 40)}...": teks tidak mengandung [[n]] untuk tipe isian_rumpang.`);
        }
        if (!kunciCol) throw new Error(`Baris "${qText.substring(0, 40)}...": kolom "Kunci Rumpang" wajib diisi.`);

        const keyMap = new Map<string, string[]>();
        kunciCol.split(";").forEach(part => {
          const eqIdx = part.indexOf("=");
          if (eqIdx === -1) return;
          const num = part.substring(0, eqIdx).trim();
          const answers = part.substring(eqIdx + 1).split("/").map(s => s.trim()).filter(Boolean);
          if (num && answers.length > 0) keyMap.set(num, answers);
        });

        const blanks = blankMatches.map(num => {
          const answers = keyMap.get(num);
          if (!answers) {
            throw new Error(`Baris "${qText.substring(0, 40)}...": kunci untuk rumpang [[${num}]] tidak ditemukan di kolom "Kunci Rumpang".`);
          }
          return { id: num, answers, caseSensitive: false };
        });

        return {
          text: qText,
          type: typeInfo.type,
          field: typeInfo.field,
          choices: { text: qText, blanks },
          answerKey: "",
          groupId: String(cleanRow["GroupId (Literasi)"] || "").trim() || undefined,
          groupText: String(cleanRow["Teks Literasi"] || "").trim() || undefined,
        };
      }

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
