import type { QuestionType } from "../pages/admin/QuestionsPage";

export interface ParsedExternalQuestion {
  id: string;
  type: QuestionType;
  text: string;
  imageUrl?: string;
  groupText?: string;
  choices?: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }>;
  pairs?: Array<{ id: string; left: string; right: string }>;
  answerKey?: string;
  items?: Array<{ id: string; text: string; imageUrl?: string }>;
  sourceTitle?: string;
}

export interface ExternalQuizMeta {
  title: string;
  subject?: string;
  totalQuestions: number;
  questions: ParsedExternalQuestion[];
}

/**
 * Extract Quiz ID or API endpoint from a Wayground / Quizizz / REST API URL
 */
export const extractQuizIdFromUrl = (urlOrId: string): string => {
  const trimmed = urlOrId.trim();
  if (!trimmed) return "";
  
  // If it's already a raw ID
  if (/^[a-f0-9]{24}$/i.test(trimmed) || (/^[a-z0-9_-]{6,36}$/i.test(trimmed) && !trimmed.includes("/"))) {
    return trimmed;
  }

  try {
    const urlObj = new URL(trimmed);
    const pathSegments = urlObj.pathname.split("/").filter(Boolean);
    
    // Pattern: /admin/quiz/613eabc... or /quiz/613eabc... or /game/613eabc...
    const quizIdx = pathSegments.findIndex(s => s === "quiz" || s === "game" || s === "quiz-room" || s === "details");
    if (quizIdx !== -1 && pathSegments[quizIdx + 1]) {
      return pathSegments[quizIdx + 1];
    }

    // Return last segment if it looks like an ID
    const last = pathSegments[pathSegments.length - 1];
    if (last) return last;
  } catch (e) {
    // Not a valid URL, treat input as ID directly
    return trimmed;
  }

  return trimmed;
};

/**
 * Fetch and parse questions from Wayground / External Quiz REST API
 */
export const fetchWaygroundQuiz = async (urlOrId: string): Promise<ExternalQuizMeta> => {
  const quizId = extractQuizIdFromUrl(urlOrId);
  if (!quizId) {
    throw new Error("ID atau Link Kuis tidak valid.");
  }

  let rawData: any = null;
  let lastError: Error | null = null;

  // List of candidate endpoints for Wayground / Quiz REST APIs
  const endpoints = [
    `https://wayground.com/api/v1/quizzes/${quizId}`,
    `https://wayground.com/api/quiz/${quizId}`,
    `https://api.wayground.com/v1/quiz/${quizId}`,
    // Fallback Quizizz API pratinjau (compatible API format)
    `https://quizizz.com/api/main/quiz/${quizId}`,
    // Direct URL fetch if user pasted a full JSON REST API URL
    urlOrId.startsWith("http") ? urlOrId : ""
  ].filter(Boolean);

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (res.ok) {
        rawData = await res.json();
        if (rawData) break;
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!rawData) {
    throw lastError || new Error(`Gagal mengambil kuis dari Wayground API. Pastikan kuis bersifat publik dan ID/Link benar.`);
  }

  // Parse payload metadata
  const quizObj = rawData.data?.quiz || rawData.quiz || rawData.data || rawData;
  const title = quizObj.info?.name || quizObj.name || quizObj.title || `Kuis Wayground (${quizId.slice(0, 8)})`;
  const subject = quizObj.info?.subjects?.[0] || quizObj.subject || "Umum";

  // Raw questions list
  const rawQuestions: any[] = 
    quizObj.info?.questions || 
    quizObj.questions || 
    rawData.data?.questions || 
    rawData.questions || 
    [];

  const parsedQuestions: ParsedExternalQuestion[] = rawQuestions.map((q, index) => {
    const qId = q.id || q._id || `ext_q_${index + 1}`;
    
    // Teks Soal & Gambar
    const structure = q.structure || q;
    const textRaw = structure.query?.media?.[0]?.url 
      ? `<p>${structure.query?.text || ""}</p><img src="${structure.query.media[0].url}" alt="soal" />`
      : (structure.query?.text || q.text || q.question || `Soal No ${index + 1}`);

    const imageUrl = structure.query?.media?.[0]?.url || q.image || q.imageUrl || undefined;

    // Tipe Soal
    const rawType = String(q.type || structure.kind || "").toLowerCase();
    let type: QuestionType = "pilihan_ganda";

    if (rawType.includes("multiple") || rawType.includes("mcq") || rawType.includes("option")) {
      type = "pilihan_ganda";
    } else if (rawType.includes("checkbox") || rawType.includes("multi")) {
      type = "pilihan_ganda_kompleks";
    } else if (rawType.includes("blank") || rawType.includes("short") || rawType.includes("fill")) {
      type = "isian_singkat";
    } else if (rawType.includes("essay") || rawType.includes("open") || rawType.includes("textarea")) {
      type = "uraian";
    } else if (rawType.includes("match")) {
      type = "menjodohkan";
    } else if (rawType.includes("reorder") || rawType.includes("order")) {
      type = "urutkan";
    }

    // Parse Pilihan Jawaban
    const rawOptions = structure.options || q.options || q.choices || [];
    const choices: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }> = {};
    const optionLetters = ["A", "B", "C", "D", "E", "F"];

    let correctCount = 0;
    if (Array.isArray(rawOptions) && rawOptions.length > 0) {
      rawOptions.forEach((opt: any, i: number) => {
        const letter = optionLetters[i] || `O${i + 1}`;
        const optText = opt.text || opt.media?.[0]?.url || (typeof opt === "string" ? opt : "");
        const optImage = opt.media?.[0]?.url || opt.image || undefined;
        
        let isCorrect = Boolean(
          opt.isCorrect || 
          opt.correct || 
          (structure.answer !== undefined && Number(structure.answer) === i) ||
          (Array.isArray(structure.answer) && structure.answer.includes(i))
        );

        if (isCorrect) correctCount++;

        choices[letter] = {
          text: optText,
          imageUrl: optImage,
          isCorrect
        };
      });
    }

    // Jika ada lebih dari 1 jawaban benar, otomatis ubah tipe ke pilihan_ganda_kompleks
    if (correctCount > 1 && type === "pilihan_ganda") {
      type = "pilihan_ganda_kompleks";
    }

    // AnswerKey untuk isian/uraian
    const answerKey = q.answer || structure.answer || (typeof structure.answer === "string" ? structure.answer : undefined);

    return {
      id: qId,
      type,
      text: textRaw,
      imageUrl,
      choices: Object.keys(choices).length > 0 ? choices : undefined,
      answerKey: typeof answerKey === "string" ? answerKey : undefined,
      sourceTitle: title
    };
  });

  return {
    title,
    subject,
    totalQuestions: parsedQuestions.length,
    questions: parsedQuestions
  };
};
