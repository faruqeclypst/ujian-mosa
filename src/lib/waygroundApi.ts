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
  
  // If it's already a raw ID (24 hex characters or 6-36 alphanumerics)
  if (/^[a-f0-9]{24}$/i.test(trimmed) || (/^[a-z0-9_-]{6,36}$/i.test(trimmed) && !trimmed.includes("/"))) {
    return trimmed;
  }

  try {
    const urlObj = new URL(trimmed);
    const pathSegments = urlObj.pathname.split("/").filter(Boolean);
    
    // Pattern: /admin/quiz/613eabc... or /quiz/613eabc... or /game/613eabc...
    const quizIdx = pathSegments.findIndex(s => s === "quiz" || s === "game" || s === "quiz-room" || s === "details" || s === "activity");
    if (quizIdx !== -1) {
      // Find the segment after quiz or last segment that looks like an ID
      for (let i = quizIdx + 1; i < pathSegments.length; i++) {
        if (/^[a-f0-9]{24}$/i.test(pathSegments[i]) || /^[a-z0-9_-]{6,36}$/i.test(pathSegments[i])) {
          return pathSegments[i];
        }
      }
    }

    // Return last segment if it looks like an ID
    const last = pathSegments[pathSegments.length - 1];
    if (last && (last.length >= 6)) return last;
  } catch (e) {
    return trimmed;
  }

  return trimmed;
};

/**
 * Parse Quiz JSON payload into ExternalQuizMeta
 */
export const parseWaygroundQuizData = (rawData: any, fallbackId: string = ""): ExternalQuizMeta => {
  if (!rawData) {
    throw new Error("Data JSON kuis kosong.");
  }

  const quizObj = rawData.data?.quiz || rawData.quiz || rawData.data || rawData;
  const title = quizObj.info?.name || quizObj.name || quizObj.title || `Kuis Wayground (${fallbackId.slice(0, 8)})`;
  const subject = quizObj.info?.subjects?.[0] || quizObj.subject || "Umum";

  // Raw questions list
  const rawQuestions: any[] = 
    quizObj.info?.questions || 
    quizObj.questions || 
    rawData.data?.questions || 
    rawData.questions || 
    [];

  if (rawQuestions.length === 0) {
    throw new Error("Tidak menemukan butir soal di dalam data kuis.");
  }

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

/**
 * Fetch and parse questions from Wayground / External Quiz REST API using CORS Proxy
 */
export const fetchWaygroundQuiz = async (urlOrId: string): Promise<ExternalQuizMeta> => {
  const quizId = extractQuizIdFromUrl(urlOrId);
  if (!quizId) {
    throw new Error("ID atau Link Kuis tidak valid.");
  }

  // Base API endpoints to try for quizId
  const directEndpoints = [
    `https://quizizz.com/api/main/quiz/${quizId}`,
    `https://wayground.com/api/v1/quizzes/${quizId}`,
    `https://wayground.com/api/quiz/${quizId}`,
    `https://api.wayground.com/v1/quiz/${quizId}`,
    urlOrId.startsWith("http") ? urlOrId : ""
  ].filter(Boolean);

  let rawData: any = null;
  let lastError: Error | null = null;

  for (const directUrl of directEndpoints) {
    // List of fetch attempts: direct + CORS proxies
    const fetchVariants = [
      directUrl,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(directUrl)}`,
      `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(directUrl)}`
    ];

    for (const url of fetchVariants) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { "Accept": "application/json" }
        });

        if (res.ok) {
          const text = await res.text();
          try {
            rawData = JSON.parse(text);
            if (rawData && (rawData.data || rawData.quiz || rawData.info || rawData.questions)) {
              break;
            }
          } catch (e) {
            // Not valid JSON
          }
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (rawData) break;
  }

  if (!rawData) {
    throw lastError || new Error(`Gagal mengambil data kuis. Browser memblokir koneksi CORS. Gunakan opsi Paste JSON.`);
  }

  return parseWaygroundQuizData(rawData, quizId);
};
