/**
 * Smart Question Parser (Tanpa AI) - OPTIMIZED
 * 
 * Mengekstrak soal dari teks biasa atau PDF menggunakan heuristic pattern matching.
 * Mendukung format soal Indonesia yang umum:
 * - Nomor soal: "1.", "1)", "(1)", "Soal 1"
 * - Opsi jawaban: "A.", "a)", "(A)", "A )"
 * - Kunci jawaban: "Kunci: A", "*A.", bold marker, tanda bintang, trailing key list
 * - Stimulus/wacana: blok teks sebelum soal atau ditandai header
 * - Kunci jawaban di akhir dokumen: "1.A 2.B 3.C" atau "1)A 2)B"
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
    
    const itemsByY: Map<number, { x: number; text: string }[]> = new Map();
    
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round((item as any).transform[5]);
      const x = (item as any).transform[4];
      if (!itemsByY.has(y)) itemsByY.set(y, []);
      itemsByY.get(y)!.push({ x, text: item.str });
    }

    const sortedYs = [...itemsByY.keys()].sort((a, b) => b - a);
    
    for (const y of sortedYs) {
      const items = itemsByY.get(y)!.sort((a, b) => a.x - b.x);
      const lineText = items.map(i => i.text).join(" ").trim();
      if (lineText) lines.push(lineText);
    }
    
    if (i < pdf.numPages) lines.push("");
  }

  return lines.join("\n");
}

// ─── Smart Text Parser ───────────────────────────────────────────────────────

// Regex patterns
const QUESTION_NUM_PATTERN = /^[\s]*(?:Soal\s+)?[\(]?(\d{1,3})[\.\)\s]+(.+)/i;
const QUESTION_NUM_ONLY = /^[\s]*(?:Soal\s+)?[\(]?(\d{1,3})[\.\)\s]*$/i;
const CHOICE_PATTERN = /^[\s]*[\(\[]?([A-Ea-e])[\.\)\]\s]+(.+)/;
const CHOICE_ONLY = /^[\s]*[\(\[]?([A-Ea-e])[\.\)\]\s]*$/;
const ANSWER_KEY_PATTERN = /(?:kunci|jawaban|answer|key)[\s]*(?:jawaban)?[\s]*[:\-=]\s*([A-Ea-e])/i;
const STIMULUS_PATTERN = /^[\s]*(LITERASI|STIMULUS|TEKS|WACANA|BACAAN|STIMULI|PARAGRAF|CERITA|TEKS BACAAN)[\s.\-:]*(\d+)?[\s.\-:]*(.*)/i;

// Detect trailing answer key list: "1.A 2.B 3.C" or "1)A 2)B 3)C" or "1. A, 2. B, 3. C"
const ANSWER_LIST_PATTERN = /^[\s]*(?:kunci|jawaban|answer|key)[\s]*(?:jawaban)?[\s]*[:\-=]?\s*/i;
const ANSWER_ITEM_PATTERN = /(\d{1,3})[\.\)\s]*([A-Ea-e])/g;

// Detect section headers (not questions)
const HEADER_PATTERN = /^[\s]*(Nama Guru|Kelas|Mapel|Mata Pelajaran|Nama Sekolah|Waktu|Hari|Tanggal|Petunjuk|PETUNJUK|Pilihlah|Berilah|Kerjakan|Pilihan Ganda|PILIHAN GANDA|Soal Pilihan|SOAL PILIHAN)[\s]*[:\-!.]/i;
const SEPARATOR_PATTERN = /^[\s]*[-=_]{3,}[\s]*$/;

/**
 * Deteksi apakah sebuah blok teks berisi daftar kunci jawaban
 * Format: "1.A 2.B 3.C" atau "1)A, 2)B, 3)C" atau per baris "1. A\n2. B"
 */
function extractAnswerKeyList(text: string): Map<number, string> | null {
  const keys = new Map<number, string>();
  const matches = text.matchAll(ANSWER_ITEM_PATTERN);
  
  for (const match of matches) {
    const num = parseInt(match[1]);
    const letter = match[2].toLowerCase();
    keys.set(num, letter);
  }
  
  // Hanya valid jika ada minimal 2 kunci dan berurutan
  if (keys.size >= 2) return keys;
  return null;
}

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

  // Collect potential answer key sections at the end
  let trailingAnswerKeys: Map<number, string> | null = null;
  let answerSectionStartIndex = -1;

  // ─── PRE-SCAN: Detect trailing answer key section ──────────────────────
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 50); i--) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    
    // Check if this line starts an answer key section
    if (ANSWER_LIST_PATTERN.test(trimmed)) {
      // Collect all answer items from this line onwards
      const answerSection = lines.slice(i).join(" ");
      const keys = extractAnswerKeyList(answerSection);
      if (keys && keys.size >= 2) {
        trailingAnswerKeys = keys;
        answerSectionStartIndex = i;
        break;
      }
    }
    
    // Also check if the line itself is just answer items without header
    const lineKeys = extractAnswerKeyList(trimmed);
    if (lineKeys && lineKeys.size >= 3) {
      // Multiple answer items on one line — likely an answer key list
      const fullSection = lines.slice(i).join(" ");
      const allKeys = extractAnswerKeyList(fullSection);
      if (allKeys && allKeys.size >= 3) {
        trailingAnswerKeys = allKeys;
        answerSectionStartIndex = i;
        break;
      }
    }
  }

  const pushCurrentQuestion = () => {
    if (currentQuestion && currentQuestion.text?.trim()) {
      if (currentAnswerKey && currentChoices[currentAnswerKey.toLowerCase()]) {
        currentChoices[currentAnswerKey.toLowerCase()].isCorrect = true;
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

  // ─── MAIN PARSE LOOP ──────────────────────────────────────────────────
  const parseEndIndex = answerSectionStartIndex > 0 ? answerSectionStartIndex : lines.length;

  for (let i = 0; i < parseEndIndex; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || SEPARATOR_PATTERN.test(trimmed)) {
      if (collectingStimulus && currentGroupText && currentGroupText.trim().length > 50) {
        if (i + 1 < parseEndIndex && !lines[i + 1]?.trim()) {
          collectingStimulus = false;
        }
      }
      continue;
    }

    if (HEADER_PATTERN.test(trimmed)) continue;

    // ─── Detect Stimulus/Wacana ──────────────────────────────────────────
    const stimulusMatch = trimmed.match(STIMULUS_PATTERN);
    if (stimulusMatch) {
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
      pushCurrentQuestion();

      const qText = questionMatch ? questionMatch[2].trim() : "";
      currentQuestion = { text: qText, imageUrl: undefined };
      currentChoices = {};
      currentAnswerKey = "";
      pendingQuestionText = !questionMatch;
      pendingChoiceLetter = null;
      lastChoiceLetter = null;

      // Check for inline answer key
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
      let isCorrect = false;

      // Check for asterisk/bold markers
      if (trimmed.startsWith("*") || trimmed.includes("**")) {
        isCorrect = true;
        choiceText = choiceText.replace(/\*+/g, "").trim();
      }

      // Check for trailing marker
      if (choiceText.match(/[\s]*[\(✓✔★●]*(benar|correct|betul|✓|✔|★)[\)]*[\s]*$/i)) {
        isCorrect = true;
        choiceText = choiceText.replace(/[\s]*[\(✓✔★●]*(benar|correct|betul|✓|✔|★)[\)]*[\s]*$/i, "").trim();
      }

      currentChoices[letter] = { text: choiceText, imageUrl: undefined, isCorrect };
      if (isCorrect && !currentAnswerKey) currentAnswerKey = letter;

      pendingQuestionText = false;
      pendingChoiceLetter = choiceOnly ? letter : null;
      lastChoiceLetter = letter;
      continue;
    }

    // ─── Continuation / Fragment Handling ─────────────────────────────────
    if (currentQuestion) {
      if (pendingQuestionText) {
        currentQuestion.text = trimmed;
        pendingQuestionText = false;
      } else if (pendingChoiceLetter && currentChoices[pendingChoiceLetter]) {
        currentChoices[pendingChoiceLetter].text = trimmed;
        pendingChoiceLetter = null;
      } else if (!lastChoiceLetter) {
        currentQuestion.text += " " + trimmed;
      } else if (lastChoiceLetter && currentChoices[lastChoiceLetter]) {
        currentChoices[lastChoiceLetter].text += " " + trimmed;
      }
    } else if (collectingStimulus) {
      currentGroupText = (currentGroupText || "") + " " + trimmed;
    }
  }

  // Push last question
  pushCurrentQuestion();

  // ─── POST-PROCESS: Apply trailing answer keys ──────────────────────────
  if (trailingAnswerKeys && trailingAnswerKeys.size > 0) {
    questions.forEach((q, index) => {
      const questionNum = index + 1;
      const key = trailingAnswerKeys!.get(questionNum);
      if (key && q.choices[key]) {
        // Reset all choices first
        Object.keys(q.choices).forEach(k => { q.choices[k].isCorrect = false; });
        // Set the correct one
        q.choices[key].isCorrect = true;
      }
    });
  }

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
