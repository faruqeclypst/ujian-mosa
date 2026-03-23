import mammoth from "mammoth";

export interface ParsedQuestion {
  text: string;
  imageUrl?: string;
  choices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }>;
}

export const parseQuestionsFromWord = async (file: File): Promise<ParsedQuestion[]> => {
  const arrayBuffer = await file.arrayBuffer();
  // Gunakan convertToHtml agar gambar tidak hilang (mammoth otomatis mengubahnya ke base64 inline)
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const paragraphs = doc.querySelectorAll("p");

  const questions: ParsedQuestion[] = [];

  let currentQuestion: Partial<ParsedQuestion> | null = null;
  let currentChoices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }> = {};
  let currentAnswerKey = "";

  paragraphs.forEach((p) => {
    // Cari apakah ada gambar di paragraf ini
    const img = p.querySelector("img");
    const imageSrc = img ? img.getAttribute("src") : undefined;

    // Bersihkan teks paragraf dari tag HTML lain (jika ada), gunakan innerHTML agar tag <b> / <i> tidak hilang
    let line = p.innerHTML?.trim() || "";
    
    // 🧹 Hapus tag <img> dari LINE agar tidak duplikasi (karena sudah disimpan di `currentQuestion.imageUrl` dan diupload ke R2)
    line = line.replace(/<img[^>]*>/g, "");

    if (!line && !imageSrc) return;

    // 1. Deteksi Soal (misal: "1. Apa itu...")
    const questionMatch = line.match(/^(\d+)[.\s]+(.+)/);
    if (questionMatch) {
      if (currentQuestion && currentQuestion.text) {
        if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) {
          currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true;
        }
        questions.push({
          text: currentQuestion.text,
          imageUrl: currentQuestion.imageUrl,
          choices: currentChoices,
        });
      }

      // Reset untuk soal baru
      currentQuestion = { 
        text: questionMatch[2].trim(),
        imageUrl: imageSrc || undefined 
      };
      currentChoices = {};
      currentAnswerKey = "";
      return;
    }

    // 2. Deteksi Pilihan Ganda (misal: "A. Jakarta" atau "A) Jakarta")
    const choiceMatch = line.match(/^([A-Ea-e])[.\s)]+(.*)/);
    if (choiceMatch && currentQuestion) {
      const letter = choiceMatch[1].toLowerCase();
      const text = choiceMatch[2].trim();
      currentChoices[letter] = { 
        text, 
        imageUrl: imageSrc || undefined,
        isCorrect: false 
      };
      return;
    }

    // 3. Deteksi Kunci Jawaban (misal: "Kunci: A" atau "Answer: A")
    const answerMatch = line.match(/^(Kunci|Answer|Kunci Jawaban)[.\s:]+([A-Ea-e])/i);
    if (answerMatch && currentQuestion) {
      currentAnswerKey = answerMatch[2].toLowerCase();
      return;
    }

    // 4. Jika bukan kriteria di atas, dan kita sedang memproses soal, tambahkan teks ke soal
    if (currentQuestion && !currentChoices["a"] && !currentAnswerKey) {
        currentQuestion.text += "\n\n" + line;
        if (imageSrc && !currentQuestion.imageUrl) {
          currentQuestion.imageUrl = imageSrc; // Simpan gambar jika belum ada
        }
    }
  });

  // Dorong soal terakhir
  const cq = currentQuestion as any;
  if (cq && cq.text) {
    if (currentAnswerKey && currentChoices[currentAnswerKey]) {
      currentChoices[currentAnswerKey].isCorrect = true;
    }
    questions.push({
      text: cq.text,
      imageUrl: cq.imageUrl,
      choices: currentChoices || {} as any,
    });
  }

  return questions;
};
