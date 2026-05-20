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

  // Helper: extract all image sources from an element
  const extractImages = (el: Element): string[] => {
    const imgs = el.querySelectorAll("img");
    const srcs: string[] = [];
    imgs.forEach(img => {
      const src = img.getAttribute("src");
      if (src) srcs.push(src);
    });
    return srcs;
  };

  // Helper: get text content without image alt text noise
  const getCleanText = (el: Element): string => {
    // Clone to avoid mutating the original
    const clone = el.cloneNode(true) as Element;
    clone.querySelectorAll("img").forEach(img => img.remove());
    return clone.textContent?.trim() || "";
  };

  paragraphs.forEach((p) => {
    const images = extractImages(p);
    const firstImage = images.length > 0 ? images[0] : undefined;
    const textOnly = getCleanText(p);
    const line = p.innerHTML?.trim() || "";

    // Ignore Headers
    if (textOnly.match(/^(Nama Guru|Kelas|Mapel|Mata Pelajaran)\s*[:]/i)) return;

    // Paragraph with only image(s) and no meaningful text
    const isImageOnly = !textOnly && images.length > 0;

    if (!textOnly && !isImageOnly) return;

    // Detect Literasi / Stimulus Start
    const literasiMatch = textOnly.match(/^(LITERASI|STIMULUS|TEKS|WACANA|BACAAN|STIMULI)[.\s]*(\d+)?[:\s\-]*(.*)/i);
    if (literasiMatch) {
        currentGroupId = `GROUP-${literasiMatch[2] || Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        currentGroupText = literasiMatch[3] || "";
        return;
    }

    // A. Detect Question Start (Direct "1. Text" or Pending Number)
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
      const text = questionMatch ? questionMatch[2] : "";

      currentQuestion = { text, imageUrl: firstImage || undefined };
      currentChoices = {};
      currentAnswerKey = "";
      pendingNumber = questionMatch ? null : (isJustNumber![1]);
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
          imageUrl: firstImage || undefined,
          isCorrect: false 
        };
        pendingLetter = choiceMatch ? null : letter;
        pendingNumber = null;
        
        // Check if red color in HTML (jawaban benar ditandai warna merah)
        if (line.includes("color: #ff0000") || line.includes("color:#ff0000") || line.includes("rgb(255, 0, 0)")) {
            currentAnswerKey = letter;
        }
        return;
      }
    }

    // C. Detect Answer Key ("Kunci: A")
    const answerMatch = textOnly.match(/(Kunci|Answer|Kunci Jawaban|Jawaban)[.\s:]+([A-Ea-e])/i);
    if (answerMatch && currentQuestion) {
      currentAnswerKey = answerMatch[2].toLowerCase();
      return;
    }

    // D. Image-only paragraph — attach to current question or current choice
    if (isImageOnly) {
      if (currentQuestion) {
        if (pendingLetter && currentChoices[pendingLetter]) {
          // Image belongs to the pending choice
          if (!currentChoices[pendingLetter].imageUrl) {
            currentChoices[pendingLetter].imageUrl = firstImage;
          }
          pendingLetter = null;
        } else if (!currentQuestion.imageUrl) {
          // Image belongs to the question itself
          currentQuestion.imageUrl = firstImage;
        } else {
          // Additional image — embed as inline in question text so it's not lost
          currentQuestion.text += ` <img src="${firstImage}" />`;
        }
      }
      return;
    }

    // E. Fragment Handling (text/images for pending items)
    if (currentQuestion) {
        if (pendingNumber && !currentQuestion.text) {
            currentQuestion.text = textOnly;
            if (firstImage && !currentQuestion.imageUrl) {
              currentQuestion.imageUrl = firstImage;
            }
            pendingNumber = null;
        } else if (pendingLetter && currentChoices[pendingLetter]) {
            currentChoices[pendingLetter].text = textOnly;
            if (firstImage && !currentChoices[pendingLetter].imageUrl) {
              currentChoices[pendingLetter].imageUrl = firstImage;
            }
            pendingLetter = null;
        } else {
            // Continuation for question text (before choices start)
            if (textOnly || firstImage) {
                if (!currentChoices["a"] && !currentAnswerKey) {
                    if (textOnly) currentQuestion.text += " " + textOnly;
                    if (firstImage && !currentQuestion.imageUrl) {
                      currentQuestion.imageUrl = firstImage;
                    }
                }
            }
        }
    } else if (currentGroupText !== undefined) {
        // Append to wacana/stimulus text
        currentGroupText += " " + textOnly;
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
