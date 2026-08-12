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
    const correctLetters: string[] = [];

    if (Array.isArray(rawOptions) && rawOptions.length > 0) {
      rawOptions.forEach((opt: any, i: number) => {
        const letter = optionLetters[i] || `O${i + 1}`;
        const optText = opt.text || opt.media?.[0]?.url || (typeof opt === "string" ? opt : "");
        const optImage = opt.media?.[0]?.url || opt.image || undefined;
        
        const ansRaw = structure.answer !== undefined ? structure.answer : q.answer;
        const ansNum = typeof ansRaw === "number" ? ansRaw : (typeof ansRaw === "string" && !isNaN(Number(ansRaw)) && ansRaw.trim() !== "" ? Number(ansRaw) : -1);

        let isCorrect = Boolean(
          opt.isCorrect === true || 
          opt.isCorrect === 1 || 
          opt.isCorrect === "true" ||
          opt.correct === true || 
          opt.correct === 1 || 
          opt.correct === "true" ||
          (ansNum !== -1 && ansNum === i) ||
          (Array.isArray(ansRaw) && (ansRaw.includes(i) || ansRaw.includes(String(i)))) ||
          (typeof ansRaw === "string" && ansRaw.trim() !== "" && ansRaw.trim().toLowerCase() === String(optText).trim().toLowerCase())
        );

        if (isCorrect) {
          correctCount++;
          correctLetters.push(letter);
        }

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

    // Determine answerKey:
    let computedAnswerKey = "";
    if (type === "pilihan_ganda" || type === "pilihan_ganda_kompleks") {
      computedAnswerKey = correctLetters.join(",");
    } else {
      const rawAns = q.answer !== undefined ? q.answer : structure.answer;
      computedAnswerKey = typeof rawAns === "string" ? rawAns : (rawAns !== undefined ? JSON.stringify(rawAns) : "");
    }

    return {
      id: qId,
      type,
      text: textRaw,
      imageUrl,
      choices: Object.keys(choices).length > 0 ? choices : undefined,
      answerKey: computedAnswerKey || undefined,
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

const promiseAny = <T>(promises: Promise<T>[]): Promise<T> => {
  return new Promise((resolve, reject) => {
    let rejectedCount = 0;
    const errors: any[] = [];
    if (promises.length === 0) return reject(new Error("No promises provided"));

    promises.forEach((p, i) => {
      Promise.resolve(p)
        .then(resolve)
        .catch(err => {
          errors[i] = err;
          rejectedCount++;
          if (rejectedCount === promises.length) {
            reject(new Error("All promises failed"));
          }
        });
    });
  });
};

/**
 * Fetch and parse questions from Wayground / External Quiz REST API using parallel CORS proxies
 */
export const fetchWaygroundQuiz = async (urlOrId: string): Promise<ExternalQuizMeta> => {
  const quizId = extractQuizIdFromUrl(urlOrId);
  if (!quizId) {
    throw new Error("ID atau Link Kuis tidak valid.");
  }

  const targetApi = `https://quizizz.com/api/main/quiz/${quizId}`;

  // Candidate CORS Proxy URLs targeting the exact API endpoint (prevents 404 & direct CORS console warnings)
  const candidateUrls = [
    `https://corsproxy.io/?${encodeURIComponent(targetApi)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetApi)}`
  ];

  if (urlOrId.startsWith("http") && (urlOrId.includes("api") || urlOrId.includes("json"))) {
    candidateUrls.push(`https://corsproxy.io/?${encodeURIComponent(urlOrId)}`);
  }

  const fetchSingle = async (url: string): Promise<any> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const json = JSON.parse(text);
      if (json && (json.data || json.quiz || json.info || json.questions)) {
        return json;
      }
      throw new Error("Payload JSON tidak berisi soal.");
    } catch (e: any) {
      clearTimeout(timeoutId);
      throw e;
    }
  };

  // Run candidate fetches in parallel, resolve immediately on first success!
  let rawData: any = null;
  try {
    rawData = await promiseAny(candidateUrls.map(url => fetchSingle(url)));
  } catch (err) {
    // All candidates failed or timed out
    throw new Error("Gagal mengambil kuis secara otomatis. Silakan gunakan opsi Paste JSON.");
  }

  return parseWaygroundQuizData(rawData, quizId);
};
