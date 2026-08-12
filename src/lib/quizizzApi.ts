/**
 * Quizizz & External Web REST API Import Service
 */

export interface ExternalQuestionItem {
  id: string;
  text: string;
  type: "pilihan_ganda" | "pilihan_ganda_kompleks" | "isian_singkat" | "uraian" | "benar_salah";
  choices: Record<string, string>; // { A: "...", B: "..." }
  answerKey: string; // "A" or "A,B" or text
  explanation?: string;
  score?: number;
  imageUrl?: string;
}

export interface QuizizzQuizDetails {
  id: string;
  title: string;
  subject?: string;
  questions: ExternalQuestionItem[];
}

/**
 * Extracts Quizizz Quiz ID from URL or raw ID string
 * Examples:
 * - https://quizizz.com/admin/quiz/613eabc1234567890?source=page
 * - https://quizizz.com/join/quiz/613eabc1234567890/start
 * - 613eabc1234567890
 */
export const extractQuizizzId = (input: string): string => {
  const trimmed = input.trim();
  const match = trimmed.match(/quiz\/([a-f0-9]{24})/i) || trimmed.match(/([a-f0-9]{24})/i);
  return match ? match[1] : trimmed;
};

/**
 * Strips HTML tags or cleans Quizizz text formatting
 */
const cleanQuizizzText = (htmlOrText: string): string => {
  if (!htmlOrText) return "";
  let clean = htmlOrText.replace(/<p[^>]*>/gi, "").replace(/<\/p>/gi, "<br/>").trim();
  clean = clean.replace(/(<br\s*\/?>)+$/, "").trim();
  return clean || htmlOrText;
};

/**
 * Fetches Quizizz details by Quiz ID or URL
 */
export const fetchQuizizzQuiz = async (quizIdOrUrl: string): Promise<QuizizzQuizDetails> => {
  const quizId = extractQuizizzId(quizIdOrUrl);
  if (!quizId || quizId.length < 10) {
    throw new Error("ID atau Link Quizizz tidak valid. Pastikan format link Quizizz benar.");
  }

  const primaryUrl = `https://quizizz.com/api/main/quiz/${quizId}`;
  let responseData: any = null;

  try {
    const res = await fetch(primaryUrl, {
      headers: {
        "Accept": "application/json"
      }
    });
    if (res.ok) {
      responseData = await res.json();
    }
  } catch (err) {
    // If CORS or direct fetch fails, try allorigins proxy fallback
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(primaryUrl)}`;
    const proxyRes = await fetch(proxyUrl);
    if (!proxyRes.ok) {
      throw new Error("Gagal mengambil data dari Quizizz API. Pastikan kuis bersifat publik.");
    }
    responseData = await proxyRes.json();
  }

  const quizData = responseData?.data?.quiz || responseData?.data || responseData?.quiz;
  if (!quizData) {
    throw new Error("Data Kuis Quizizz tidak ditemukan atau kuis bersifat privat.");
  }

  const title = quizData.info?.name || quizData.name || "Kuis Quizizz";
  const rawQuestions: any[] = quizData.info?.questions || quizData.questions || [];

  const optionLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];

  const parsedQuestions: ExternalQuestionItem[] = rawQuestions.map((q, idx) => {
    const qId = q._id || `qz_${idx}_${Date.now()}`;
    const rawText = q.structure?.query?.text || q.structure?.query?.html || q.text || `Soal ${idx + 1}`;
    const qText = cleanQuizizzText(rawText);

    // Extract image if present
    const media = q.structure?.query?.media || [];
    const imageMedia = media.find((m: any) => m.type === "image");
    const imageUrl = imageMedia?.url || "";

    const rawChoices: any[] = q.structure?.options || q.options || [];
    const typeRaw = q.type || q.structure?.kind || "MCQ";

    const choicesObj: Record<string, string> = {};
    const correctLetters: string[] = [];

    rawChoices.forEach((opt: any, optIdx: number) => {
      const letter = optionLetters[optIdx] || `OPT${optIdx + 1}`;
      const optText = cleanQuizizzText(opt.text || opt.html || "");
      choicesObj[letter] = optText;

      // Quizizz indicates correct answer via isCorrect === true or answer === index
      const isCorrect = opt.isCorrect === true || opt.isCorrect === 1 || q.structure?.answer === optIdx;
      if (isCorrect) {
        correctLetters.push(letter);
      }
    });

    let qType: ExternalQuestionItem["type"] = "pilihan_ganda";
    if (typeRaw === "MSQ" || correctLetters.length > 1) {
      qType = "pilihan_ganda_kompleks";
    } else if (typeRaw === "BLANK" || typeRaw === "SHORT_ANSWER") {
      qType = "isian_singkat";
    } else if (typeRaw === "OPEN") {
      qType = "uraian";
    }

    return {
      id: qId,
      text: qText,
      type: qType,
      choices: choicesObj,
      answerKey: correctLetters.join(",") || "A",
      score: 1,
      imageUrl
    };
  });

  return {
    id: quizId,
    title,
    questions: parsedQuestions
  };
};
