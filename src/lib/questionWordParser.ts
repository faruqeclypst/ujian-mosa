import mammoth from "mammoth";

export interface ParsedQuestion {
  text: string;
  imageUrl?: string;
  groupId?: string;
  groupText?: string;
  choices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }>;
}

/**
 * Parse questions from Word (.docx) file - OPTIMIZED
 * 
 * Improvements:
 * - Detects bold text as correct answer marker (not just red color)
 * - Detects multiple color formats (red, blue, green, custom)
 * - Handles underline as answer marker
 * - Better table support
 * - Trailing answer key detection ("Kunci: 1.A 2.B 3.C")
 */
export const parseQuestionsFromWord = async (file: File): Promise<ParsedQuestion[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  
  // Ambil semua p dan td, tapi saring td yang sudah punya p di dalamnya
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

  // Trailing answer key collection
  const trailingAnswerKeys = new Map<number, string>();
  let questionCounter = 0;

  // Helper: extract all image sources from an element
  const extractImages = (el: Element): string[] => {
    const imgs = el.querySelectorAll("img");
    return Array.from(imgs).map(img => img.getAttribute("src")).filter(Boolean) as string[];
  };

  // Helper: get text content without image alt text
  const getCleanText = (el: Element): string => {
    const clone = el.cloneNode(true) as Element;
    clone.querySelectorAll("img").forEach(img => img.remove());
    return clone.textContent?.trim() || "";
  };

  // Helper: detect if element has "correct answer" styling
  const hasCorrectMarker = (el: Element, innerHTML: string): boolean => {
    // 1. Color-based detection (red, blue, green, or any non-black color with emphasis)
    const colorPatterns = [
      /color:\s*#(?!000|333|444|555|666)[0-9a-f]{3,6}/i,
      /color:\s*(?:red|blue|green|darkred|darkblue)/i,
      /color:\s*rgb\(\s*(?!0\s*,\s*0\s*,\s*0)[\d,\s]+\)/i,
    ];
    const hasColor = colorPatterns.some(p => p.test(innerHTML));
    
    // 2. Bold detection — entire choice text is bold
    const isBold = (
      innerHTML.includes("<strong") || 
      innerHTML.includes("<b>") || 
      innerHTML.includes("font-weight: bold") ||
      innerHTML.includes("font-weight:bold") ||
      innerHTML.includes("font-weight: 700") ||
      innerHTML.includes("font-weight:700")
    );
    
    // 3. Underline detection (some teachers use underline for correct answer)
    const isUnderlined = innerHTML.includes("text-decoration: underline") || innerHTML.includes("<u>");
    
    // Color alone is strong signal. Bold alone needs to be the ENTIRE text.
    // Underline alone is weaker signal but still valid.
    if (hasColor) return true;
    
    // For bold: check if the ENTIRE choice text is wrapped in bold (not just a word)
    if (isBold) {
      const textContent = getCleanText(el);
      // Strip the choice letter prefix to get just the answer text
      const choiceTextMatch = textContent.match(/^[A-Ea-e][\.\)\s]+(.*)/);
      const choiceBody = choiceTextMatch ? choiceTextMatch[1] : textContent;
      
      // Check if bold wraps most of the content
      const strongContent = el.querySelector("strong, b");
      if (strongContent) {
        const boldText = strongContent.textContent?.trim() || "";
        // If bold text is >60% of choice body, consider it marked
        if (boldText.length > choiceBody.length * 0.6) return true;
      }
    }
    
    if (isUnderlined) return true;
    
    return false;
  };

  // ─── FIRST PASS: Detect trailing answer key section ────────────────────
  const allTexts = paragraphs.map(p => getCleanText(p));
  for (let i = allTexts.length - 1; i >= Math.max(0, allTexts.length - 30); i--) {
    const text = allTexts[i];
    if (!text) continue;
    
    // Detect answer key header
    if (/^(kunci|jawaban|answer|key)\s*(jawaban)?/i.test(text)) {
      // Collect answer items from this point onwards
      const remaining = allTexts.slice(i).join(" ");
      const matches = remaining.matchAll(/(\d{1,3})[\.\)\s]*([A-Ea-e])/g);
      for (const match of matches) {
        trailingAnswerKeys.set(parseInt(match[1]), match[2].toLowerCase());
      }
      break;
    }
    
    // Detect inline answer list without header (e.g., "1.A 2.B 3.C 4.D 5.E")
    const inlineMatches = [...text.matchAll(/(\d{1,3})[\.\)\s]*([A-Ea-e])/g)];
    if (inlineMatches.length >= 3) {
      // Likely an answer key list
      const remaining = allTexts.slice(i).join(" ");
      const allMatches = remaining.matchAll(/(\d{1,3})[\.\)\s]*([A-Ea-e])/g);
      for (const match of allMatches) {
        trailingAnswerKeys.set(parseInt(match[1]), match[2].toLowerCase());
      }
      break;
    }
  }

  // ─── MAIN PARSE ───────────────────────────────────────────────────────
  paragraphs.forEach((p) => {
    const images = extractImages(p);
    const firstImage = images.length > 0 ? images[0] : undefined;
    const textOnly = getCleanText(p);
    const line = p.innerHTML?.trim() || "";

    // Ignore Headers
    if (textOnly.match(/^(Nama Guru|Kelas|Mapel|Mata Pelajaran|Nama Sekolah|Waktu|Hari|Tanggal|Petunjuk|Pilihlah|Berilah|Kerjakan)\s*[:]/i)) return;

    const isImageOnly = !textOnly && images.length > 0;
    if (!textOnly && !isImageOnly) return;

    // Skip if this is part of the trailing answer key section
    if (trailingAnswerKeys.size > 0) {
      const answerListMatch = textOnly.match(/^(kunci|jawaban|answer|key)\s*(jawaban)?/i);
      if (answerListMatch) return;
      // Check if line is purely answer items
      const items = [...textOnly.matchAll(/(\d{1,3})[\.\)\s]*([A-Ea-e])/g)];
      if (items.length >= 3 && textOnly.replace(/[\d\.\)\s,A-Ea-e]/g, "").length < 5) return;
    }

    // Detect Literasi / Stimulus Start
    const literasiMatch = textOnly.match(/^(LITERASI|STIMULUS|TEKS|WACANA|BACAAN|STIMULI)[.\s]*(\d+)?[:\s\-]*(.*)/i);
    if (literasiMatch) {
      currentGroupId = `GROUP-${literasiMatch[2] || Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      currentGroupText = literasiMatch[3] || "";
      return;
    }

    // A. Detect Question Start
    const questionMatch = textOnly.match(/^[\(]?(\d+)[\.\s\)]+(.*)/);
    const isJustNumber = textOnly.match(/^[\(]?(\d+)[\.\s\)]?$/);

    if (questionMatch || isJustNumber) {
      // Save previous question
      if (currentQuestion && currentQuestion.text) {
        if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) {
          currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true;
        }
        questionCounter++;
        questions.push({
          text: currentQuestion.text,
          imageUrl: currentQuestion.imageUrl,
          groupId: currentGroupId,
          groupText: currentGroupText,
          choices: { ...currentChoices },
        });
      }

      const text = questionMatch ? questionMatch[2] : "";
      currentQuestion = { text, imageUrl: firstImage || undefined };
      currentChoices = {};
      currentAnswerKey = "";
      pendingNumber = questionMatch ? null : (isJustNumber![1]);
      pendingLetter = null;
      return;
    }

    // B. Detect Choice
    const choiceMatch = textOnly.match(/^([A-Ea-e])[.\s)]+(.*)/);
    const isJustLetter = textOnly.match(/^([A-Ea-e])$/);

    if (choiceMatch || isJustLetter) {
      if (currentQuestion) {
        const letter = choiceMatch ? choiceMatch[1].toLowerCase() : isJustLetter![1].toLowerCase();
        const text = choiceMatch ? choiceMatch[2].trim() : "";
        
        // Check for correct answer markers (color, bold, underline)
        const isMarkedCorrect = hasCorrectMarker(p, line);
        
        currentChoices[letter] = { 
          text, 
          imageUrl: firstImage || undefined,
          isCorrect: isMarkedCorrect
        };
        
        if (isMarkedCorrect) currentAnswerKey = letter;
        
        pendingLetter = choiceMatch ? null : letter;
        pendingNumber = null;
        return;
      }
    }

    // C. Detect Answer Key ("Kunci: A")
    const answerMatch = textOnly.match(/(Kunci|Answer|Kunci Jawaban|Jawaban)[.\s:]+([A-Ea-e])/i);
    if (answerMatch && currentQuestion) {
      currentAnswerKey = answerMatch[2].toLowerCase();
      return;
    }

    // D. Image-only paragraph
    if (isImageOnly) {
      if (currentQuestion) {
        if (pendingLetter && currentChoices[pendingLetter]) {
          if (!currentChoices[pendingLetter].imageUrl) {
            currentChoices[pendingLetter].imageUrl = firstImage;
          }
          pendingLetter = null;
        } else if (!currentQuestion.imageUrl) {
          currentQuestion.imageUrl = firstImage;
        } else {
          currentQuestion.text += ` <img src="${firstImage}" />`;
        }
      }
      return;
    }

    // E. Fragment Handling
    if (currentQuestion) {
      if (pendingNumber && !currentQuestion.text) {
        currentQuestion.text = textOnly;
        if (firstImage && !currentQuestion.imageUrl) currentQuestion.imageUrl = firstImage;
        pendingNumber = null;
      } else if (pendingLetter) {
        const pendingChoice = currentChoices[pendingLetter];
        if (pendingChoice) {
          pendingChoice.text = textOnly;
          if (firstImage && !pendingChoice.imageUrl) {
            pendingChoice.imageUrl = firstImage;
          }
        }
        pendingLetter = null;
      } else {
        // Continuation for question text (before choices start)
        if (textOnly || firstImage) {
          if (!currentChoices["a"] && !currentAnswerKey) {
            if (textOnly) currentQuestion.text += " " + textOnly;
            if (firstImage && !currentQuestion.imageUrl) currentQuestion.imageUrl = firstImage;
          }
        }
      }
    } else if (currentGroupText !== undefined) {
      currentGroupText += " " + textOnly;
    }
  });

  // Push last question
  const lastQ = currentQuestion as Partial<ParsedQuestion> | null;
  if (lastQ && lastQ.text) {
    if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) {
      currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true;
    }
    questionCounter++;
    questions.push({
      text: lastQ.text,
      imageUrl: lastQ.imageUrl,
      groupId: currentGroupId,
      groupText: currentGroupText,
      choices: { ...currentChoices },
    });
  }

  // ─── POST-PROCESS: Apply trailing answer keys ──────────────────────────
  if (trailingAnswerKeys.size > 0) {
    questions.forEach((q, index) => {
      const questionNum = index + 1;
      const key = trailingAnswerKeys.get(questionNum);
      if (key && q.choices[key]) {
        // Only apply if no answer was already detected inline
        const hasInlineAnswer = Object.values(q.choices).some(c => c.isCorrect);
        if (!hasInlineAnswer) {
          Object.keys(q.choices).forEach(k => { q.choices[k].isCorrect = false; });
          q.choices[key].isCorrect = true;
        }
      }
    });
  }

  return questions;
};
