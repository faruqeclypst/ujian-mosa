export interface SimpleParsedQuestion {
  text: string;
  choices: Record<string, { text: string; isCorrect: boolean }>;
  answerKey: string;
}

export const parseQuestionsSimple = (html: string): SimpleParsedQuestion[] => {
  const questions: SimpleParsedQuestion[] = [];
  
  // Convert HTML to simple text-like format but preserve some markers
  // We'll replace <p>, <div>, <br> with newlines, and keep <strong> for detection
  let text = html
    .replace(/<\/p>|<\/div>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li>/gi, "\n- ")
    .replace(/<strong[^>]*>(.*?)<\/strong>|<b>(.*?)<\/b>/gi, "**$1$2**") // Convert bold to markdown-ish for regex
    .replace(/<span[^>]*style="[^"]*color:[^"]*"[^>]*>(.*?)<\/span>/gi, "**$1**"); // Convert colored text to bold marks

  // Strip all other HTML tags
  text = text.replace(/<[^>]*>/g, "");
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  // Split by question numbers (e.g. "1.", "1 )", "1)")
  const blocks = text.split(/(?:\r?\n|^)\s*(\d+[.\)]\s+)/);
  
  const questionBlocks: string[] = [];
  for (let i = 1; i < blocks.length; i += 2) {
    questionBlocks.push(blocks[i] + blocks[i+1]);
  }
  
  const finalBlocks = questionBlocks.length > 0 ? questionBlocks : text.split(/\n\s*\n/);

  finalBlocks.forEach(block => {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return;

    let questionText = "";
    const choices: Record<string, { text: string; isCorrect: boolean }> = {};
    let answerKey = "";

    let currentLineIsQuestion = true;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      if (i === 0) {
        line = line.replace(/^\d+[.\)]\s+/, "");
      }

      // Check if line is an answer key indicator
      const answerMatch = line.match(/^(?:Jawaban|Kunci|Key|Answer|Ans|Jwb|Kunj)\s*[:\-]?\s*([A-E*])/i);
      
      // Check if line is an option (A. B. C. D. E. or A) B) ...)
      const optionMatch = line.match(/^([(\[]?[\*xVv]?[)\]]?\s*)?([A-E])[\.\)]\s*(.*)/i);

      if (answerMatch) {
        answerKey = answerMatch[1].toLowerCase();
        currentLineIsQuestion = false;
      } else if (optionMatch) {
        const marker = (optionMatch[1] || "").toLowerCase();
        const letter = optionMatch[2].toLowerCase();
        let content = optionMatch[3].trim();
        
        let isCorrect = false;
        // Detect if this option is marked as correct via marker, suffix, or our bold tags
        if (marker.includes('*') || marker.includes('x') || marker.includes('v') || content.endsWith('*')) {
          isCorrect = true;
          if (content.endsWith('*')) content = content.slice(0, -1).trim();
        }
        
        // Detect converted bold markdown
        if (content.includes('**') || line.includes('**')) {
          isCorrect = true;
          content = content.replace(/\*\*/g, '').trim();
        }

        choices[letter] = { text: content, isCorrect };
        currentLineIsQuestion = false;
        
        if (isCorrect) answerKey = letter;
        
      } else if (currentLineIsQuestion) {
        questionText += (questionText ? " " : "") + line;
      } else {
        const lastLetter = Object.keys(choices).pop();
        if (lastLetter) {
          choices[lastLetter].text += " " + line;
        }
      }
    }

    if (questionText && Object.keys(choices).length > 0) {
      if (answerKey && choices[answerKey]) {
        Object.keys(choices).forEach(k => choices[k].isCorrect = false);
        choices[answerKey].isCorrect = true;
      }

      questions.push({
        text: questionText,
        choices,
        answerKey: answerKey || Object.keys(choices).find(k => choices[k].isCorrect) || ""
      });
    }
  });

  return questions;
};
