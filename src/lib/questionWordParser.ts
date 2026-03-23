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

  let pendingNumber: string | null = null;
  let pendingLetter: string | null = null;
  let currentQuestion: Partial<ParsedQuestion> | null = null;
  let currentChoices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }> = {};
  let currentAnswerKey = "";

  paragraphs.forEach((p) => {
    const img = p.querySelector("img");
    const imageSrc = img ? img.getAttribute("src") : undefined;
    const textOnly = p.textContent?.trim() || "";
    let line = p.innerHTML?.trim() || "";
    line = line.replace(/<img[^>]*>/g, ""); // Cleanup line for storage

    // Ignore Headers
    if (textOnly.match(/^(Nama Guru|Kelas|Mapel|Mata Pelajaran)\s*[:]/i)) return;

    if (!textOnly && !imageSrc) return;

    // A. Detect Question Start (Direct "1. Text" or Pending Number)
    const questionMatch = textOnly.match(/^(\d+)[.\s]+(.+)/);
    const isJustNumber = textOnly.match(/^(\d+)$/);

    if (questionMatch || isJustNumber) {
      // Save previous question
      if (currentQuestion && currentQuestion.text) {
        if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) {
          currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true;
        }
        questions.push({
          text: currentQuestion.text,
          imageUrl: currentQuestion.imageUrl,
          choices: { ...currentChoices },
        });
      }

      // Start new question
      const num = questionMatch ? questionMatch[1] : isJustNumber![1];
      const text = questionMatch ? questionMatch[2] : ""; // Text might come in next paragraph

      currentQuestion = { text, imageUrl: imageSrc || undefined };
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

    // C. Detect Answer Key ("Kunci: A")
    const answerMatch = textOnly.match(/^(Kunci|Answer|Kunci Jawaban)[.\s:]+([A-Ea-e])/i);
    if (answerMatch && currentQuestion) {
      currentAnswerKey = answerMatch[2].toLowerCase();
      return;
    }

    // D. Fragment Handling (Filling pending fields)
    if (currentQuestion) {
        if (pendingNumber && !currentQuestion.text) {
            currentQuestion.text = line;
            if (imageSrc) currentQuestion.imageUrl = imageSrc;
            pendingNumber = null;
        } else if (pendingLetter && currentChoices[pendingLetter]) {
            currentChoices[pendingLetter].text = line;
            if (imageSrc) currentChoices[pendingLetter].imageUrl = imageSrc;
            
            // Check color in fragment too
            if (line.includes("color: #ff0000") || line.includes("color:#ff0000") || line.includes("rgb(255, 0, 0)")) {
                currentAnswerKey = pendingLetter;
            }
            pendingLetter = null;
        } else {
            // Continuation or Literasi
            if (!currentChoices["a"] && !currentAnswerKey) {
                currentQuestion.text += "\n\n" + line;
                if (imageSrc && !currentQuestion.imageUrl) {
                    currentQuestion.imageUrl = imageSrc;
                }
            } else if (imageSrc) {
                // If it's choice-related image but letter was already processed
                const lastLetter = Object.keys(currentChoices).pop();
                if (lastLetter && !currentChoices[lastLetter].imageUrl) {
                    currentChoices[lastLetter].imageUrl = imageSrc;
                }
            }
        }
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
      choices: { ...currentChoices },
    });
  }

  return questions;
};
