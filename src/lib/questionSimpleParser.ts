export interface SimpleParsedQuestion {
  text: string;
  choices: Record<string, { text: string; isCorrect: boolean }>;
  answerKey: string;
}

export const parseQuestionsSimple = (html: string): SimpleParsedQuestion[] => {
  const questions: SimpleParsedQuestion[] = [];

  // 1. Convert HTML → plain text, but mark colored/bold text with ** for later detection
  let text = html
    .replace(/<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n")
    // Wrap colored spans with ** markers (likely indicates correct answer)
    .replace(/<span[^>]*style="[^"]*color:\s*(?!rgb\(0|#000|black)[^"]*"[^>]*>(.*?)<\/span>/gi, "**$1**")
    // Wrap bold with ** markers
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  // 2. Split into lines, then group by question number at the start of a line
  const lines = text.split(/\r?\n/).map(l => l.trimEnd());

  // Question number pattern: "1.", "1)", "(1)" at the START of a line
  const questionStartPattern = /^\s*[\(]?(\d+)[\.\)\s]\s*/;

  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    if (questionStartPattern.test(line)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) blocks.push(currentBlock);

  // 3. Parse each block into a question
  for (const block of blocks) {
    const trimmedLines = block.map(l => l.trim()).filter(l => l.length > 0);
    if (trimmedLines.length < 2) continue;

    let questionText = "";
    const choices: Record<string, { text: string; isCorrect: boolean }> = {};
    let answerKey = "";
    let parsingQuestion = true;

    for (let i = 0; i < trimmedLines.length; i++) {
      let line = trimmedLines[i];

      // Strip leading question number from the first line
      if (i === 0) {
        line = line.replace(questionStartPattern, "");
      }

      // --- Detect explicit answer key ---
      // e.g. "Jawaban: B", "Kunci: C", "Answer: A"
      const answerMatch = line.match(/^(?:Jawaban|Kunci|Key|Answer|Ans|Jwb|Kunci\s*Jawaban)\s*[:\-]?\s*\**([A-E])\**\s*$/i);
      if (answerMatch) {
        answerKey = answerMatch[1].toLowerCase();
        parsingQuestion = false;
        continue;
      }

      // --- Detect option line: "A. text", "A) text", "(A) text" ---
      const optionMatch = line.match(/^[\(]?([A-E])[\.\)\s]\s*(.*)/i);
      if (optionMatch) {
        parsingQuestion = false;
        const letter = optionMatch[1].toLowerCase();
        let content = optionMatch[2].trim();

        // Check if entire content is wrapped in ** (bold/color = correct answer marker)
        const isFullyBold = /^\*\*(.+)\*\*$/.test(content);
        let isCorrect = false;

        if (isFullyBold) {
          isCorrect = true;
          content = content.replace(/^\*\*|\*\*$/g, "").trim();
          if (!answerKey) answerKey = letter;
        } else {
          // Strip any stray ** markers from content (partial bold does NOT count as correct)
          content = content.replace(/\*\*/g, "").trim();
        }

        choices[letter] = { text: content, isCorrect };
        continue;
      }

      // --- Continuation: append to question text or last option ---
      if (parsingQuestion) {
        questionText += (questionText ? " " : "") + line.replace(/\*\*/g, "");
      } else {
        const lastKey = Object.keys(choices).pop();
        if (lastKey) {
          choices[lastKey].text += " " + line.replace(/\*\*/g, "").trim();
        }
      }
    }

    if (!questionText || Object.keys(choices).length === 0) continue;

    // Apply the answer key: set correct flags
    if (answerKey && choices[answerKey]) {
      Object.keys(choices).forEach(k => (choices[k].isCorrect = false));
      choices[answerKey].isCorrect = true;
    } else {
      // No explicit key found — reset all to false (don't guess)
      Object.keys(choices).forEach(k => (choices[k].isCorrect = false));
      answerKey = "";
    }

    questions.push({
      text: questionText,
      choices,
      answerKey,
    });
  }

  return questions;
};
