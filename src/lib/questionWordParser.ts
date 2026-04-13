import mammoth from "mammoth";

export interface ParsedQuestion {
  text: string;
  imageUrl?: string;
  groupId?: string;
  groupText?: string;
  choices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }>;
}

export const parseQuestionsFromWord = async (file: File): Promise<ParsedQuestion[]> => {
  const arrayBuffer = await file.arrayBuffer();
  // Gunakan convertToHtml agar gambar tidak hilang (mammoth otomatis mengubahnya ke base64 inline)
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  // Ambil semua p dan td, tapi saring td yang sudah punya p di dalamnya agar tidak double
  const paragraphs = Array.from(doc.querySelectorAll("p, td")).filter(el => {
    if (el.tagName === 'TD') return el.querySelectorAll('p').length === 0;
    return true;
  });

  const questions: ParsedQuestion[] = [];

  let pendingNumber: string | null = null;
  let pendingLetter: string | null = null;
  let currentQuestion: Partial<ParsedQuestion> | null = null;
  let currentChoices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }> = {};
  let currentAnswerKey = "";

  let currentGroupId: string | undefined = undefined;
  let currentGroupText: string | undefined = undefined;

  paragraphs.forEach((p) => {
    const img = p.querySelector("img");
    const imageSrc = img ? img.getAttribute("src") : undefined;
    const textOnly = p.textContent?.trim() || "";
    let line = p.innerHTML?.trim() || "";

    // Ignore Headers
    if (textOnly.match(/^(Nama Guru|Kelas|Mapel|Mata Pelajaran)\s*[:]/i)) return;

    if (!textOnly && !imageSrc) return;

    // Detect Literasi / Stimulus Start
    // Format: "LITERASI: teks..." atau "STIMULUS 1: teks..." atau "WACANA [1]"
    const literasiMatch = textOnly.match(/^(LITERASI|STIMULUS|TEKS|WACANA|BACAAN|STIMULI)[.\s]*(\d+)?[:\s\-]*(.*)/i);
    if (literasiMatch) {
        currentGroupId = `GROUP-${literasiMatch[2] || Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        currentGroupText = literasiMatch[3] || "";
        return;
    }

    // A. Detect Question Start (Direct "1. Text" or Pending Number)
    // Support "1.", "1)", "(1)", "1 "
    const questionMatch = textOnly.match(/^[\(]?(\d+)[\.\s\)]+(.*)/);
    const isJustNumber = textOnly.match(/^[\(]?(\d+)[\.\s\)]?$/);

    if (questionMatch || isJustNumber) {
      // Save previous question
      if (currentQuestion && currentQuestion.text) {
        if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) {
          currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true;
        }
        questions.push({
          text: currentQuestion.text,
          imageUrl: currentQuestion.imageUrl,
          groupId: currentGroupId,
          groupText: currentGroupText,
          choices: { ...currentChoices },
        });
      }

      // Start new question
      const num = questionMatch ? questionMatch[1] : isJustNumber![1];
      const text = questionMatch ? questionMatch[2] : ""; // Text might come in next paragraph

      currentQuestion = { text, imageUrl: undefined };
      currentChoices = {};
      currentAnswerKey = "";
      pendingNumber = questionMatch ? null : num;
      pendingLetter = null;
      return;
    }

    // B. Detect Choice (Direct "A. Text" or Pending Letter)
    const choiceMatch = textOnly.match(/^([A-Ea-e])[.\s)]+(.*)/);
    const isJustLetter = textOnly.match(/^([A-Ea-e])$/);

    if (choiceMatch || isJustLetter) {
      if (currentQuestion) {
        const letter = choiceMatch ? choiceMatch[1].toLowerCase() : isJustLetter![1].toLowerCase();
        const text = choiceMatch ? choiceMatch[2].trim() : "";
        
        currentChoices[letter] = { 
          text, 
          imageUrl: imageSrc || undefined,
          isCorrect: false 
        };
        pendingLetter = choiceMatch ? null : letter;
        pendingNumber = null;
        
        // Bonus: Check if red color in HTML (if mammoth configured)
        if (line.includes("color: #ff0000") || line.includes("color:#ff0000") || line.includes("rgb(255, 0, 0)")) {
            currentAnswerKey = letter;
        }
        return;
      }
    }

    // C. Detect Answer Key ("Kunci: A" - bisa di mana saja dalam baris/cell)
    const answerMatch = textOnly.match(/(Kunci|Answer|Kunci Jawaban|Jawaban)[.\s:]+([A-Ea-e])/i);
    if (answerMatch && currentQuestion) {
      currentAnswerKey = answerMatch[2].toLowerCase();
      return;
    }

    // D. Fragment Handling (Greedy capture for fragmented text/images)
    if (currentQuestion) {
        if (pendingNumber && !currentQuestion.text) {
            currentQuestion.text = line;
            pendingNumber = null;
        } else if (pendingLetter && currentChoices[pendingLetter]) {
            currentChoices[pendingLetter].text = line;
            pendingLetter = null;
        } else {
            // Continuation for either question or wacana
            if (line) {
                if (!currentChoices["a"] && !currentAnswerKey) {
                    currentQuestion.text += " " + line;
                }
            }
        }
    } else if (currentGroupText !== undefined) {
        // If no current question but we have wacana, append to wacana
        currentGroupText += " " + line;
    }
  });


  // Dorong soal terakhir
  const lastQuestion = currentQuestion as ParsedQuestion | null;
  if (lastQuestion && lastQuestion.text) {
    if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) {
      currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true;
    }
    questions.push({
      text: lastQuestion.text,
      imageUrl: lastQuestion.imageUrl,
      groupId: currentGroupId,
      groupText: currentGroupText,
      choices: { ...currentChoices },
    });
  }

  return questions;
};
