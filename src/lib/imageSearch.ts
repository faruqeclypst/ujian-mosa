// src/lib/imageSearch.ts
// Helper untuk menyisipkan dan memformat gambar ke dalam konten teks soal

/**
 * Menyisipkan gambar langsung ke dalam pertanyaan utama (HTML).
 * Posisi disesuaikan secara cerdas:
 * - Jika ada kalimat pengantar stimulus di awal (misal: "Perhatikan gambar...", "Perhatikan diagram..."),
 *   gambar disisipkan tepat di bawah kalimat tersebut.
 * - Jika tidak ada pengantar khusus, gambar ditempatkan di bagian paling atas pertanyaan.
 */
export function insertImageIntoQuestionText(
  questionText: string,
  imageUrl: string,
  title?: string
): string {
  const cleanUrl = (imageUrl || "").trim();
  if (!cleanUrl) return questionText;
  if (questionText.includes(cleanUrl)) return questionText; // Cegah duplikasi

  const cleanTitle = (title || "Ilustrasi Soal").replace(/"/g, "&quot;");
  // Container gambar yang rapi, responsif, terpusat, dengan border radius modern
  const imgBlock = `<p style="text-align: center; margin: 12px 0;"><img src="${cleanUrl}" alt="${cleanTitle}" style="max-height: 340px; max-width: 100%; border-radius: 12px; margin: 0 auto; display: block; box-shadow: 0 2px 8px rgba(0,0,0,0.06);" /></p>`;

  const trimmed = (questionText || "").trim();
  if (!trimmed) return imgBlock;

  // Pola kalimat pengantar stimulus di awal:
  // Contoh:
  // "<p>Perhatikan gambar berikut ini!</p>"
  // "Perhatikan diagram siklus air di bawah ini:"
  // "<p>Cermati struktur sel berikut:</p>"
  const stimulusIntroRegex = /^((?:<p[^>]*>)?\s*(?:Perhatikan|Cermati|Amati|Berdasarkan|Periksalah)\s+(?:gambar|diagram|bagan|grafik|peta|tabel|ilustrasi|foto|struktur)[^.!?:\n<]*[.!?:]\s*(?:<\/p>)?)/i;
  const match = trimmed.match(stimulusIntroRegex);

  if (match) {
    const introSentence = match[0];
    const remainingText = trimmed.slice(introSentence.length).trim();
    if (remainingText) {
      return `${introSentence}\n${imgBlock}\n${remainingText}`;
    }
    return `${introSentence}\n${imgBlock}`;
  }

  // Jika tidak ada kalimat stimulus khusus, letakkan gambar di bagian atas pertanyaan
  return `${imgBlock}\n${trimmed}`;
}
