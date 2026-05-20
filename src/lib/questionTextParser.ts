/**
 * Smart Question Parser (Tanpa AI)
 * 
 * Mengekstrak soal dari teks biasa atau PDF menggunakan heuristic pattern matching.
 * Mendukung format soal Indonesia yang umum:
 * - Nomor soal: "1.", "1)", "(1)"
 * - Opsi jawaban: "A.", "a)", "(A)", "A )"
 * - Kunci jawaban: "Kunci: A", "*A.", bold marker, tanda bintang
 * - Stimulus/wacana: blok teks sebelum soal atau ditandai header
 */

export interface ParsedTextQuestion {
  text: string;
  imageUrl?: string;
  groupId?: string;
  groupText?: string;
  choices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }>;
}

// ─── PDF Text Extraction ─────────────────────────────────────────────────────

export async function extractTextFromPdf(file: File): Promise<string> {
  // Lazy-load pdfjs-dist agar tidak membengkakkan bundle utama
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const lines: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    
    // Group text items by Y position to reconstruct lines
    const itemsByY: Map<number, { x: number; text: string }[]> = new Map();
    
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round((item as any).transform[5]); // Y position
      const x = (item as any).transform[4]; // X position
      if (!itemsByY.has(y)) itemsByY.set(y, []);
      itemsByY.get(y)!.push({ x, text: item.str });
    }

    // Sort by Y descending (PDF coordinates are bottom-up)
    const sortedYs = [...itemsByY.keys()].sort((a, b) => b - a);
    
    for (const y of sortedYs) {
      const items = itemsByY.get(y)!.sort((a, b) => a.x - b.x);
      const lineText = items.map(i => i.text).join(" ").trim();
      if (lineText) lines.push(lineText);
    }
    
    // Page separator
    if (i < pdf.numPages) lines.push("");
  }

  return lines.join("\n");
}

// ─── Smart Text Parser ───────────────────────────────────────────────────────

// Regex patterns
const QUESTION_NUM_PATTERN = /^[\s]*[\(]?(\d{1,3})[\.\)\s]+(.+)/;
const QUESTION_NUM_ONLY = /^[\s]*[\(]?(\d{1,3})[\.\)\s]*$/;
const CHOICE_PATTERN = /^[\s]*[\(\[]?([A-Ea-e])[\.\)\]\s]+(.+)/;
const CHOICE_ONLY = /^[\s]*[\(\[]?([A-Ea-e])[\.\)\]\s]*$/;
const ANSWER_KEY_PATTERN = /(?:kunci|jawaban|answer|key)[\s]*(?:jawaban)?[\s]*[:\-=]\s*([A-Ea-e])/i;
const ANSWER_INLINE_PATTERN = /\*\*?([A-Ea-e])\*\*?/; // **A** or *A*
const STIMULUS_PATTERN = /^[\s]*(LITERASI|STIMULUS|TEKS|WACANA|BACAAN|STIMULI|PARAGRAF|CERITA|TEKS BACAAN)[\s.\-:]*(\d+)?[\s.\-:]*(.*)/i;

// Detect if a line is a section header (not a question)
const HEADER_PATTERN = /^[\s]*(Nama Guru|Kelas|Mapel|Mata Pelajaran|Nama Sekolah|Waktu|Hari|Tanggal|Petunjuk|PETUNJUK|Pilihlah|Berilah|Kerjakan)[\s]*[:\-!.]/i;
const SEPARATOR_PATTERN = /^[\s]*[-=_]{3,}[\s]*$/;

export function parseQuestionsFromText(rawText: string): ParsedTextQuestion[] {
  const lines = rawText.split(/\r?\n/);
  const questions: ParsedTextQuestion[] = [];

  let currentQuestion: Partial<ParsedTextQuestion> | null = null;
  let currentChoices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }> = {};
  let currentAnswerKey = "";
  let pendingQuestionText = false;
  let pendingChoiceLetter: string | null = null;
  let lastChoiceLetter: string | null = null;

  let currentGroupId: string | undefined = undefined;
  let currentGroupText: string | undefined = undefined;
  let collectingStimulus = false;

  const pushCurrentQuestion = () => {
    if (currentQuestion && currentQuestion.text?.trim()) {
      // Apply answer key
      if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) {
        currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true;
      }
      // If no answer key found, try to detect from markers
      if (!currentAnswerKey) {
        const marked = Object.entries(currentChoices).find(([_, v]) => v.isCorrect);
        if (!marked) {
          // No answer detected — leave all as false
        }
      }
      questions.push({
        text: currentQuestion.text.trim(),
        imageUrl: currentQuestion.imageUrl,
        groupId: currentGroupId,
        groupText: currentGroupText?.trim(),
        choices: { ...currentChoices },
      });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and separators
    if (!trimmed || SEPARATOR_PATTERN.test(trimmed)) {
      // If collecting stimulus and hit empty line after content, might end stimulus
      if (collectingStimulus && currentGroupText && currentGroupText.trim().length > 50) {
        // Long enough stimulus, stop collecting on double empty
        if (i + 1 < lines.length && !lines[i + 1].trim()) {
          collectingStimulus = false;
        }
      }
      continue;
    }

    // Skip headers
    if (HEADER_PATTERN.test(trimmed)) continue;

    // ─── Detect Stimulus/Wacana ──────────────────────────────────────────
    const stimulusMatch = trimmed.match(STIMULUS_PATTERN);
    if (stimulusMatch) {
      // Save previous question first
      pushCurrentQuestion();
      currentQuestion = null;
      currentChoices = {};
      currentAnswerKey = "";

      currentGroupId = `GROUP-${stimulusMatch[2] || Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      currentGroupText = stimulusMatch[3] || "";
      collectingStimulus = true;
      continue;
    }

    // ─── Detect Answer Key Line ──────────────────────────────────────────
    const answerKeyMatch = trimmed.match(ANSWER_KEY_PATTERN);
    if (answerKeyMatch) {
      currentAnswerKey = answerKeyMatch[1].toLowerCase();
      continue;
    }

    // ─── Detect Question Start ───────────────────────────────────────────
    const questionMatch = trimmed.match(QUESTION_NUM_PATTERN);
    const questionNumOnly = trimmed.match(QUESTION_NUM_ONLY);

    if (questionMatch || questionNumOnly) {
      collectingStimulus = false;

      // Save previous question
      pushCurrentQuestion();

      // Start new question
      const qText = questionMatch ? questionMatch[2].trim() : "";
      currentQuestion = { text: qText, imageUrl: undefined };
      currentChoices = {};
      currentAnswerKey = "";
      pendingQuestionText = !questionMatch; // If only number, text comes next
      pendingChoiceLetter = null;
      lastChoiceLetter = null;

      // Check for inline answer key in the question line itself (rare but possible)
      // e.g., "1. Apa ibu kota Indonesia? (Kunci: A)"
      const inlineAnswer = qText.match(ANSWER_KEY_PATTERN);
      if (inlineAnswer) {
        currentAnswerKey = inlineAnswer[1].toLowerCase();
        currentQuestion.text = qText.replace(ANSWER_KEY_PATTERN, "").trim();
      }
      continue;
    }

    // ─── Detect Choice ───────────────────────────────────────────────────
    const choiceMatch = trimmed.match(CHOICE_PATTERN);
    const choiceOnly = trimmed.match(CHOICE_ONLY);

    if ((choiceMatch || choiceOnly) && currentQuestion) {
      const letter = (choiceMatch ? choiceMatch[1] : choiceOnly![1]).toLowerCase();
      let choiceText = choiceMatch ? choiceMatch[2].trim() : "";

      // Detect if this choice is marked as correct
      let isCorrect = false;

      // Check for asterisk/bold markers: "*A. jawaban*" or "**jawaban**"
      if (trimmed.startsWith("*") || trimmed.includes("**")) {
        isCorrect = true;
        choiceText = choiceText.replace(/\*+/g, "").trim();
      }

      // Check for trailing marker like "(benar)" or "(correct)" or "✓"
      if (choiceText.match(/[\s]*[\(✓✔★●]*(benar|correct|betul|✓|✔|★)[\)]*[\s]*$/i)) {
        isCorrect = true;
        choiceText = choiceText.replace(/[\s]*[\(✓✔★●]*(benar|correct|betul|✓|✔|★)[\)]*[\s]*$/i, "").trim();
      }

      currentChoices[letter] = {
        text: choiceText,
        imageUrl: undefined,
        isCorrect,
      };

      if (isCorrect && !currentAnswerKey) {
        currentAnswerKey = letter;
      }

      pendingQuestionText = false;
      pendingChoiceLetter = choiceOnly ? letter : null;
      lastChoiceLetter = letter;
      continue;
    }

    // ─── Continuation / Fragment Handling ─────────────────────────────────
    if (currentQuestion) {
      if (pendingQuestionText) {
        // Text for a question that only had a number
        currentQuestion.text = trimmed;
        pendingQuestionText = false;
      } else if (pendingChoiceLetter && currentChoices[pendingChoiceLetter]) {
        // Text for a choice that only had a letter
        currentChoices[pendingChoiceLetter].text = trimmed;
        pendingChoiceLetter = null;
      } else if (!lastChoiceLetter) {
        // Still in question text (before any choice appeared)
        currentQuestion.text += " " + trimmed;
      } else if (lastChoiceLetter && currentChoices[lastChoiceLetter]) {
        // Continuation of last choice text (multi-line choice)
        currentChoices[lastChoiceLetter].text += " " + trimmed;
      }
    } else if (collectingStimulus) {
      // Collecting stimulus/wacana text
      currentGroupText = (currentGroupText || "") + " " + trimmed;
    }
  }

  // Push last question
  pushCurrentQuestion();

  return questions;
}

// ─── Combined: Parse from PDF file ───────────────────────────────────────────

export async function parseQuestionsFromPdf(file: File): Promise<ParsedTextQuestion[]> {
  const text = await extractTextFromPdf(file);
  return parseQuestionsFromText(text);
}

// ─── Combined: Parse from any text-based source ──────────────────────────────

export async function parseQuestionsFromTextFile(file: File): Promise<ParsedTextQuestion[]> {
  const text = await file.text();
  return parseQuestionsFromText(text);
}
