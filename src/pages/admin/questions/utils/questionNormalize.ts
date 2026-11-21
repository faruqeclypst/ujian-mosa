import type { QuestionData, QuestionType } from "../types";

export const TYPE_ALIAS_MAP: Record<string, QuestionType> = {
  pilihan_ganda: "pilihan_ganda",
  multiple_choice: "pilihan_ganda",
  mc: "pilihan_ganda",
  pg: "pilihan_ganda",
  "pilihan-ganda": "pilihan_ganda",

  pilihan_ganda_kompleks: "pilihan_ganda_kompleks",
  complex_choice: "pilihan_ganda_kompleks",
  multiple_answers: "pilihan_ganda_kompleks",
  pg_kompleks: "pilihan_ganda_kompleks",
  "pilihan-ganda-kompleks": "pilihan_ganda_kompleks",

  benar_salah: "benar_salah",
  true_false: "benar_salah",
  tf: "benar_salah",
  "true-false": "benar_salah",
  "benar-salah": "benar_salah",

  menjodohkan: "menjodohkan",
  matching: "menjodohkan",
  jodohkan: "menjodohkan",
  match: "menjodohkan",

  isian_singkat: "isian_singkat",
  short_answer: "isian_singkat",
  isian: "isian_singkat",
  "short-answer": "isian_singkat",
  "isian-singkat": "isian_singkat",

  uraian: "uraian",
  essay: "uraian",
  esai: "uraian",

  urutkan: "urutkan",
  sequence: "urutkan",
  ordering: "urutkan",
  urutan: "urutkan",

  drag_drop: "drag_drop",
  "drag-drop": "drag_drop",
  draganddrop: "drag_drop",

  matriks: "matriks",
  matrix: "matriks",
  matrix_table: "matriks",
  tabel_matriks: "matriks",

  klasifikasi: "klasifikasi",
  classification: "klasifikasi",
  classify: "klasifikasi",
  kategori: "klasifikasi",

  isian_rumpang: "isian_rumpang",
  cloze: "isian_rumpang",
  fill_blank: "isian_rumpang",
  fill_in_the_blank: "isian_rumpang",
  rumpang: "isian_rumpang",

  hotspot: "hotspot",
};

export const CANONICAL_TO_FIELD_MAP: Record<QuestionType, string> = {
  pilihan_ganda: "multiple_choice",
  pilihan_ganda_kompleks: "complex_choice",
  menjodohkan: "matching",
  benar_salah: "true_false",
  isian_singkat: "short_answer",
  uraian: "essay",
  urutkan: "sequence",
  drag_drop: "drag_drop",
  klasifikasi: "klasifikasi",
  hotspot: "hotspot",
  isian_rumpang: "isian_rumpang",
  matriks: "matriks",
};

/**
 * Ekstrak pernyataan bernomor (1. ... 2. ...) yang tertanam di dalam teks HTML/string
 * jika JSON tidak memiliki array `statements` terpisah.
 */
export function extractStatementsFromText(
  rawText: string,
  answerKey: any
): { statements: Array<{ id: string; text: string; answer: "benar" | "salah" }>; cleanText: string } | null {
  if (!rawText) return null;

  const keyMap: Record<string, string> = {};
  if (typeof answerKey === "string") {
    const pairs = answerKey.split(",").map((s) => s.trim()).filter(Boolean);
    pairs.forEach((p, idx) => {
      const parts = p.split(":");
      if (parts.length >= 2) {
        keyMap[parts[0].trim()] = parts.slice(1).join(":").trim().toLowerCase();
      } else {
        keyMap[String(idx + 1)] = parts[0].trim().toLowerCase();
      }
    });
  } else if (Array.isArray(answerKey)) {
    answerKey.forEach((ans, idx) => {
      keyMap[String(idx + 1)] = String(ans).trim().toLowerCase();
    });
  }

  // 1. Cek <ol><li>...</li></ol>
  const olMatch = rawText.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
  if (olMatch) {
    const liMatches = [...olMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
    if (liMatches.length > 0) {
      const statements = liMatches.map((m, idx) => {
        const id = String(idx + 1);
        const ans = keyMap[id] || "benar";
        return {
          id,
          text: m[1].trim(),
          answer: (ans === "salah" ? "salah" : "benar") as "benar" | "salah",
        };
      });
      const cleanText = rawText.replace(olMatch[0], "").trim();
      return { statements, cleanText };
    }
  }

  // 2. Cek format bernomor 1. ... 2. ... <br> atau baris baru
  const firstNumMatch = /(?:<p>|<br\s*\/?>|\n|^)\s*1[\.\)]\s*/i.exec(rawText);
  if (firstNumMatch && firstNumMatch.index !== undefined) {
    const listPart = rawText.slice(firstNumMatch.index);
    const introPart = rawText.slice(0, firstNumMatch.index).trim();

    const items: Array<{ id: string; text: string }> = [];
    const itemRegex = /(?:^|<p>|<br\s*\/?>|\n)\s*(\d+)[\.\)]\s*([\s\S]*?)(?=(?:<p>|<br\s*\/?>|\n)\s*\d+[\.\)]|<\/p>|$)/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(listPart)) !== null) {
      const id = match[1];
      const itemContent = match[2].replace(/<\/p>|<br\s*\/?>/gi, "").trim();
      if (itemContent) {
        items.push({ id, text: itemContent });
      }
    }

    if (items.length > 1) {
      const statements = items.map((it, idx) => {
        const id = it.id || String(idx + 1);
        const ans = keyMap[id] || keyMap[String(idx + 1)] || "benar";
        return {
          id,
          text: it.text,
          answer: (ans === "salah" ? "salah" : "benar") as "benar" | "salah",
        };
      });
      let cleanText = introPart;
      if (cleanText.endsWith("<p>")) {
        cleanText = cleanText.slice(0, -3).trim();
      }
      return { statements, cleanText };
    }
  }

  return null;
}

/**
 * Normalisasi objek soal dari berbagai variasi format JSON menjadi QuestionData yang konsisten.
 * Catatan: tipe 'hotspot' sengaja diabaikan / dilewati sesuai instruksi.
 */
export function normalizeImportedQuestion(q: any, index: number = 0): QuestionData | null {
  if (!q || typeof q !== "object") return null;

  const rawType = (q.type || q.field || q.questionType || "pilihan_ganda").toLowerCase().trim();
  const canonicalType = (TYPE_ALIAS_MAP[rawType] || "pilihan_ganda") as QuestionType;

  // Sesuai instruksi: hotspot dikecualikan dari import JSON
  if (canonicalType === "hotspot") {
    console.warn(`[Skip Hotspot] Soal #${index + 1} bertipe hotspot dilewati.`);
    return null;
  }

  let text = q.text || q.question || "";
  const imageUrl = q.imageUrl || q.image_url || "";
  const groupId = q.groupId || q.group_id || "";
  const groupText = q.groupText || q.group_text || "";
  let answerKey = q.answerKey || q.answer_key || q.correctAnswer || q.correct_answer || "";

  const options = q.options && typeof q.options === "object" ? q.options : {};

  let choices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }> | undefined = undefined;
  let statements: Array<{ id: string; text: string; answer?: any }> | undefined = undefined;
  let pairs: Array<{ id: string; left: string; right: string }> | undefined = undefined;
  let items: Array<{ id: string; text: string; imageUrl?: string }> | undefined = undefined;
  let categories: Array<{ id: string; text: string }> | undefined = undefined;
  let columns: Array<{ id: string; text: string }> | undefined = undefined;
  let blanks: Array<{ id: string; answers: string[]; caseSensitive?: boolean }> | undefined = undefined;
  let shuffleStatements: boolean = q.shuffleStatements ?? options.shuffleStatements ?? true;

  // -------------------------------------------------------------
  // A. PILIHAN GANDA & PILIHAN GANDA KOMPLEKS
  // -------------------------------------------------------------
  if (canonicalType === "pilihan_ganda" || canonicalType === "pilihan_ganda_kompleks") {
    const rawChoices = q.choices || options.choices || options;
    const normalizedChoices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }> = {};

    if (Array.isArray(rawChoices)) {
      const defaultLetters = ["a", "b", "c", "d", "e", "f", "g", "h"];
      rawChoices.forEach((ch, chIdx) => {
        const key = (typeof ch === "object" && ch && ch.key ? ch.key : defaultLetters[chIdx] || String(chIdx + 1)).toLowerCase();
        if (typeof ch === "string") {
          normalizedChoices[key] = { text: ch, isCorrect: false };
        } else if (typeof ch === "object" && ch) {
          normalizedChoices[key] = {
            text: ch.text || ch.label || "",
            imageUrl: ch.imageUrl || ch.image_url || undefined,
            isCorrect: !!ch.isCorrect,
          };
        }
      });
    } else if (rawChoices && typeof rawChoices === "object") {
      Object.keys(rawChoices).forEach((k) => {
        if (["statements", "pairs", "items", "categories", "columns", "blanks"].includes(k)) return;
        const val = rawChoices[k];
        const lowerK = k.toLowerCase();
        if (typeof val === "string") {
          normalizedChoices[lowerK] = { text: val, isCorrect: false };
        } else if (typeof val === "object" && val) {
          normalizedChoices[lowerK] = {
            text: val.text || val.label || "",
            imageUrl: val.imageUrl || val.image_url || undefined,
            isCorrect: !!val.isCorrect,
          };
        }
      });
    }

    let correctKeys: string[] = [];
    if (typeof answerKey === "string" && answerKey.trim()) {
      correctKeys = answerKey.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    } else if (Array.isArray(answerKey)) {
      correctKeys = answerKey.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    }

    if (correctKeys.length > 0) {
      Object.keys(normalizedChoices).forEach((k) => {
        if (correctKeys.includes(k)) {
          normalizedChoices[k].isCorrect = true;
        }
      });
    } else {
      correctKeys = Object.keys(normalizedChoices).filter((k) => normalizedChoices[k].isCorrect);
    }

    answerKey = correctKeys.join(",");
    choices = normalizedChoices;
  }

  // -------------------------------------------------------------
  // B. BENAR / SALAH
  // -------------------------------------------------------------
  else if (canonicalType === "benar_salah") {
    const rawStatements = q.statements || options.statements;

    if (Array.isArray(rawStatements) && rawStatements.length > 0) {
      statements = rawStatements.map((st, sIdx) => {
        if (typeof st === "string") {
          return { id: String(sIdx + 1), text: st, answer: "benar" };
        }
        return {
          id: String(st.id || sIdx + 1),
          text: st.text || "",
          answer: String(st.answer || "benar").toLowerCase() === "salah" ? "salah" : "benar",
        };
      });
    } else {
      // Coba ekstrak otomatis pernyataan bernomor dari teks stimulus
      const extracted = extractStatementsFromText(text, answerKey);
      if (extracted && extracted.statements.length > 0) {
        statements = extracted.statements;
        text = extracted.cleanText;
      } else {
        const rawChoices = q.choices || options.choices || options;
        if (rawChoices && typeof rawChoices === "object" && (rawChoices.benar || rawChoices.salah || rawChoices.a || rawChoices.b)) {
          choices = {};
          Object.keys(rawChoices).forEach((k) => {
            const val = rawChoices[k];
            choices![k.toLowerCase()] = typeof val === "string" ? { text: val, isCorrect: false } : val;
          });
        } else {
          statements = [
            { id: "1", text: "Pernyataan 1", answer: "benar" },
            { id: "2", text: "Pernyataan 2", answer: "salah" },
            { id: "3", text: "Pernyataan 3", answer: "benar" },
          ];
        }
      }
    }

    if (statements && statements.length > 0) {
      if (typeof answerKey === "string" && answerKey.includes(":")) {
        const parts = answerKey.split(",").map((p) => p.trim());
        parts.forEach((p, idx) => {
          const [k, v] = p.split(":");
          const st = statements!.find((s) => s.id === k.trim()) || statements![idx];
          if (st && v) {
            st.answer = v.trim().toLowerCase() === "salah" ? "salah" : "benar";
          }
        });
      }
      answerKey = statements.map((s) => `${s.id}:${s.answer}`).join(",");
    }
  }

  // -------------------------------------------------------------
  // C. MENJODOHKAN
  // -------------------------------------------------------------
  else if (canonicalType === "menjodohkan") {
    const rawPairs = q.pairs || options.pairs || q.items || options.items || [];
    const normalizedPairs: Array<{ id: string; left: string; right: string }> = [];

    if (Array.isArray(rawPairs)) {
      rawPairs.forEach((p, pIdx) => {
        if (Array.isArray(p) && p.length >= 2) {
          normalizedPairs.push({ id: String(pIdx + 1), left: String(p[0] || ""), right: String(p[1] || "") });
        } else if (typeof p === "object" && p) {
          normalizedPairs.push({
            id: String(p.id || pIdx + 1),
            left: String(p.left || p.premise || p.soal || p.pertanyaan || ""),
            right: String(p.right || p.response || p.jawaban || p.pasangan || ""),
          });
        }
      });
    } else if (rawPairs && typeof rawPairs === "object") {
      Object.entries(rawPairs).forEach(([left, right], pIdx) => {
        normalizedPairs.push({ id: String(pIdx + 1), left, right: String(right || "") });
      });
    }

    pairs = normalizedPairs;
    answerKey = normalizedPairs.map((p) => `${p.id}:${p.right}`).join(",");
  }

  // -------------------------------------------------------------
  // D. URUTKAN & DRAG DROP
  // -------------------------------------------------------------
  else if (canonicalType === "urutkan" || canonicalType === "drag_drop") {
    const rawItems = q.items || options.items || q.steps || options.steps || [];
    const normalizedItems: Array<{ id: string; text: string; imageUrl?: string }> = [];

    if (Array.isArray(rawItems)) {
      rawItems.forEach((it, itIdx) => {
        if (typeof it === "string") {
          normalizedItems.push({ id: String(itIdx + 1), text: it });
        } else if (typeof it === "object" && it) {
          normalizedItems.push({
            id: String(it.id || itIdx + 1),
            text: it.text || it.label || "",
            imageUrl: it.imageUrl || it.image_url || undefined,
          });
        }
      });
    }

    items = normalizedItems;
    if (!answerKey || typeof answerKey !== "string") {
      answerKey = normalizedItems.map((it) => it.id).join(",");
    }
  }

  // -------------------------------------------------------------
  // E. MATRIKS
  // -------------------------------------------------------------
  else if (canonicalType === "matriks") {
    const rawCols = q.columns || options.columns || q.cols || options.cols || [];
    const rawStmts = q.statements || options.statements || q.rows || options.rows || [];

    const normalizedCols: Array<{ id: string; text: string }> = [];
    if (Array.isArray(rawCols)) {
      rawCols.forEach((c, cIdx) => {
        if (typeof c === "string") {
          normalizedCols.push({ id: `c${cIdx + 1}`, text: c });
        } else if (typeof c === "object" && c) {
          normalizedCols.push({ id: String(c.id || `c${cIdx + 1}`), text: c.text || c.label || "" });
        }
      });
    }

    const ansMap: Record<string, string> = {};
    if (typeof answerKey === "string" && answerKey.includes(":")) {
      answerKey.split(",").forEach((p) => {
        const [k, v] = p.split(":");
        if (k && v) ansMap[k.trim()] = v.trim();
      });
    }

    const normalizedStmts: Array<{ id: string; text: string; answer?: any }> = [];
    if (Array.isArray(rawStmts)) {
      rawStmts.forEach((st, sIdx) => {
        const sId = String(st.id || `s${sIdx + 1}`);
        let ans = (typeof st === "object" && st ? st.answer : undefined) || ansMap[sId] || ansMap[String(sIdx + 1)] || "";

        const matchCol = normalizedCols.find(
          (c) => c.id === ans || c.text.toLowerCase() === String(ans).toLowerCase()
        );
        if (matchCol) ans = matchCol.id;
        else if (!ans && normalizedCols.length > 0) ans = normalizedCols[0].id;

        normalizedStmts.push({
          id: sId,
          text: typeof st === "string" ? st : st.text || "",
          answer: ans,
        });
      });
    }

    columns = normalizedCols;
    statements = normalizedStmts;
    answerKey = normalizedStmts.map((s) => `${s.id}:${s.answer}`).join(",");
  }

  // -------------------------------------------------------------
  // F. KLASIFIKASI
  // -------------------------------------------------------------
  else if (canonicalType === "klasifikasi") {
    const rawCats = q.categories || options.categories || q.columns || options.columns || [];
    const rawStmts = q.statements || options.statements || [];

    const normalizedCats: Array<{ id: string; text: string }> = [];
    if (Array.isArray(rawCats)) {
      rawCats.forEach((cat, cIdx) => {
        if (typeof cat === "string") {
          normalizedCats.push({ id: `cat${cIdx + 1}`, text: cat });
        } else if (typeof cat === "object" && cat) {
          normalizedCats.push({ id: String(cat.id || `cat${cIdx + 1}`), text: cat.text || cat.name || "" });
        }
      });
    }

    const ansMap: Record<string, string> = {};
    if (typeof answerKey === "string" && answerKey.includes(":")) {
      answerKey.split(",").forEach((p) => {
        const [k, v] = p.split(":");
        if (k && v) ansMap[k.trim()] = v.trim();
      });
    }

    const normalizedStmts: Array<{ id: string; text: string; answer?: any }> = [];
    if (Array.isArray(rawStmts)) {
      rawStmts.forEach((st, sIdx) => {
        const sId = String(st.id || `s${sIdx + 1}`);
        let ans = (typeof st === "object" && st ? st.answer : undefined) || ansMap[sId] || ansMap[String(sIdx + 1)] || "";

        const matchCat = normalizedCats.find(
          (c) => c.id === ans || c.text.toLowerCase() === String(ans).toLowerCase()
        );
        if (matchCat) ans = matchCat.id;
        else if (!ans && normalizedCats.length > 0) ans = normalizedCats[0].id;

        normalizedStmts.push({
          id: sId,
          text: typeof st === "string" ? st : st.text || "",
          answer: ans,
        });
      });
    }

    categories = normalizedCats;
    statements = normalizedStmts;
    shuffleStatements = q.shuffleStatements ?? options.shuffleStatements ?? true;
    answerKey = normalizedStmts.map((s) => `${s.id}:${s.answer}`).join(",");
  }

  // -------------------------------------------------------------
  // G. ISIAN RUMPANG
  // -------------------------------------------------------------
  else if (canonicalType === "isian_rumpang") {
    const rawBlanks = q.blanks || options.blanks || [];
    const normalizedBlanks: Array<{ id: string; answers: string[]; caseSensitive?: boolean }> = [];

    const rumpangIds: string[] = [];
    const re = /\[\[(\d+)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (!rumpangIds.includes(m[1])) rumpangIds.push(m[1]);
    }

    if (Array.isArray(rawBlanks)) {
      rawBlanks.forEach((b, bIdx) => {
        const bId = String(b.id || rumpangIds[bIdx] || bIdx + 1);
        let answers: string[] = [];
        if (typeof b === "string") answers = [b];
        else if (Array.isArray(b.answers)) answers = b.answers.map(String);
        else if (b.answer) answers = [String(b.answer)];

        normalizedBlanks.push({
          id: bId,
          answers,
          caseSensitive: !!b.caseSensitive,
        });
      });
    } else if (rawBlanks && typeof rawBlanks === "object") {
      Object.entries(rawBlanks).forEach(([bId, val]) => {
        let answers: string[] = [];
        if (typeof val === "string") answers = [val];
        else if (Array.isArray(val)) answers = val.map(String);
        else if (typeof val === "object" && val && (val as any).answers) answers = (val as any).answers.map(String);
        normalizedBlanks.push({
          id: bId,
          answers,
          caseSensitive: !!(val && (val as any).caseSensitive),
        });
      });
    }

    if (normalizedBlanks.length === 0 && rumpangIds.length > 0) {
      rumpangIds.forEach((id) => {
        normalizedBlanks.push({ id, answers: [], caseSensitive: false });
      });
    }

    blanks = normalizedBlanks;
    answerKey = normalizedBlanks.map((b) => `${b.id}:${(b.answers || [])[0] || ""}`).join(",");
  }

  // -------------------------------------------------------------
  // H. ISIAN SINGKAT & URAIAN
  // -------------------------------------------------------------
  else if (canonicalType === "isian_singkat" || canonicalType === "uraian") {
    if (Array.isArray(answerKey)) {
      answerKey = answerKey.join(", ");
    } else if (typeof answerKey !== "string") {
      answerKey = String(answerKey || "");
    }
  }

  return {
    id: q.id || `temp_${index}_${Math.random().toString(36).substring(2, 7)}`,
    examId: q.examId || q.exam_id || "",
    text,
    type: canonicalType,
    imageUrl,
    groupId,
    groupText,
    choices,
    statements,
    pairs,
    items,
    categories,
    columns,
    blanks,
    shuffleStatements,
    answerKey,
    order: q.order || index + 1,
  };
}

/**
 * Bangun payload PocketBase untuk disimpan ke koleksi 'questions'.
 */
export async function buildQuestionSavePayload(
  q: QuestionData,
  examId: string,
  orderNumber: number,
  helpers: {
    localizeImage?: (url: string, prefix: string) => Promise<string>;
    localizeInlineImages?: (html: string) => Promise<string>;
  } = {}
): Promise<any> {
  const { localizeImage = async (url) => url, localizeInlineImages = async (html) => html } = helpers;
  const type = q.type || "pilihan_ganda";
  const field = CANONICAL_TO_FIELD_MAP[type] || "multiple_choice";

  let localizedQText = await localizeInlineImages(q.text || "Pertanyaan");
  const qImageUrl = q.imageUrl || "";
  let localizedQImageUrl = "";
  if (qImageUrl) {
    localizedQImageUrl = await localizeImage(qImageUrl, `q_${orderNumber}`);
    if (localizedQImageUrl && !localizedQText.includes(localizedQImageUrl)) {
      localizedQText =
        `<p><img src="${localizedQImageUrl}" alt="Gambar Soal" style="max-height:320px;max-width:100%;border-radius:16px;margin-bottom:12px;" /></p>` +
        localizedQText;
    }
  }

  const rawGroupText = q.groupText || "";
  const localizedGroupText = rawGroupText ? await localizeInlineImages(rawGroupText) : "";

  let options: any = {};
  let correctAnswer = q.answerKey || "";

  if (type === "benar_salah" && q.statements && Array.isArray(q.statements) && q.statements.length > 0) {
    const validStatements = await Promise.all(
      q.statements.map(async (st: any) => ({
        id: String(st.id || Math.random()),
        text: await localizeInlineImages(st.text || ""),
        answer: (st.answer || "benar").toLowerCase() === "salah" ? "salah" : "benar",
      }))
    );
    options = { statements: validStatements };
    correctAnswer = validStatements.map((s) => `${s.id}:${s.answer}`).join(",");
  } else if (type === "pilihan_ganda" || type === "pilihan_ganda_kompleks" || (type === "benar_salah" && q.choices)) {
    const rawChoices = q.choices || {};
    const opts: any = {};
    const keys = Object.keys(rawChoices);
    for (let kIdx = 0; kIdx < keys.length; kIdx++) {
      const k = keys[kIdx];
      const val = rawChoices[k];
      const choiceImg = val.imageUrl || "";
      const localizedChoiceImg = choiceImg ? await localizeImage(choiceImg, `opt_${orderNumber}_${k}`) : undefined;
      opts[k] = {
        text: val.text ? await localizeInlineImages(val.text) : "",
        imageUrl: localizedChoiceImg,
        isCorrect: !!val.isCorrect,
      };
    }
    options = opts;
    if (!correctAnswer) {
      const correctKeys = Object.keys(options).filter((k) => options[k].isCorrect);
      correctAnswer = correctKeys.join(",");
    }
  } else if (type === "menjodohkan") {
    const pairs = q.pairs || [];
    const localizedPairs = [];
    for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
      const p = pairs[pIdx];
      localizedPairs.push({
        ...p,
        left: await localizeInlineImages(p.left || ""),
        right: await localizeInlineImages(p.right || ""),
      });
    }
    options = { pairs: localizedPairs };
    if (!correctAnswer) {
      correctAnswer = localizedPairs.map((p) => `${p.id}:${p.right}`).join(",");
    }
  } else if (type === "urutkan" || type === "drag_drop") {
    const items = q.items || [];
    const localizedItems = [];
    for (let itIdx = 0; itIdx < items.length; itIdx++) {
      const it = items[itIdx];
      const itemImg = it.imageUrl || "";
      const localizedItemImg = itemImg ? await localizeImage(itemImg, `item_${orderNumber}_${itIdx}`) : undefined;
      localizedItems.push({
        ...it,
        text: await localizeInlineImages(it.text || ""),
        imageUrl: localizedItemImg,
      });
    }
    options = { items: localizedItems };
    if (!correctAnswer) {
      correctAnswer = localizedItems.map((it) => it.id).join(",");
    }
  } else if (type === "matriks") {
    const cols = q.columns || [];
    const localizedStmts = [];
    for (const st of q.statements || []) {
      localizedStmts.push({
        ...st,
        text: await localizeInlineImages(st.text || ""),
      });
    }
    options = {
      columns: cols,
      statements: localizedStmts,
    };
    if (!correctAnswer) {
      correctAnswer = localizedStmts.map((s) => `${s.id}:${s.answer}`).join(",");
    }
  } else if (type === "klasifikasi") {
    const cats = q.categories || [];
    const localizedStmts = [];
    for (const st of q.statements || []) {
      localizedStmts.push({
        ...st,
        text: await localizeInlineImages(st.text || ""),
      });
    }
    options = {
      categories: cats,
      columns: cats, // fallback kompatibilitas CBT
      statements: localizedStmts,
      shuffleStatements: q.shuffleStatements !== undefined ? q.shuffleStatements : true,
    };
    if (!correctAnswer) {
      correctAnswer = localizedStmts.map((s) => `${s.id}:${s.answer}`).join(",");
    }
  } else if (type === "isian_rumpang") {
    options = {
      text: localizedQText,
      blanks: q.blanks || [],
    };
    if (!correctAnswer && q.blanks) {
      correctAnswer = q.blanks.map((b) => `${b.id}:${(b.answers || [])[0] || ""}`).join(",");
    }
  } else if (type === "isian_singkat" || type === "uraian") {
    options = {};
    correctAnswer = q.answerKey || "";
  }

  const payload: any = {
    examId,
    field,
    text: localizedQText,
    options: options || {},
    correctAnswer: correctAnswer || "",
    order: orderNumber,
  };
  if (q.groupId) payload.groupId = q.groupId;
  if (localizedGroupText) payload.groupText = localizedGroupText;

  return payload;
}

export const QUESTION_TEMPLATE_JSON = JSON.stringify(
  [
    {
      order: 1,
      type: "pilihan_ganda",
      text: "<p>Organel sel yang berfungsi sebagai tempat berlangsungnya respirasi seluler dan penghasil energi utama (ATP) adalah ....</p>",
      choices: {
        a: { text: "<p>Ribosom</p>", isCorrect: false },
        b: { text: "<p>Mitokondria</p>", isCorrect: true },
        c: { text: "<p>Lisosom</p>", isCorrect: false },
        d: { text: "<p>Badan Golgi</p>", isCorrect: false },
        e: { text: "<p>Retikulum Endoplasma</p>", isCorrect: false },
      },
      answerKey: "b",
    },
    {
      order: 2,
      type: "pilihan_ganda_kompleks",
      text: "<p>Pilihlah pernyataan yang tepat mengenai ciri-ciri pembelahan meiosis pada sel eukariotik! <em>(Jawaban benar lebih dari satu)</em></p>",
      choices: {
        a: { text: "<p>Menghasilkan 4 sel anakan yang bersifat haploid ($n$)</p>", isCorrect: true },
        b: { text: "<p>Terjadi pindah silang (<em>crossing over</em>) pada profase I</p>", isCorrect: true },
        c: { text: "<p>Berfungsi untuk pertumbuhan dan perbaikan jaringan tubuh yang rusak</p>", isCorrect: false },
        d: { text: "<p>Menghasilkan variasi genetik pada keturunan</p>", isCorrect: true },
        e: { text: "<p>Kromosom sel anakan identik dengan kromosom sel induk</p>", isCorrect: false },
      },
      answerKey: "a,b,d",
    },
    {
      order: 3,
      type: "benar_salah",
      text: "<p>Tentukan nilai kebenaran (<strong>Benar</strong> atau <strong>Salah</strong>) untuk setiap pernyataan mengenai hukum kekekalan energi berikut ini:</p>",
      statements: [
        { id: "1", text: "Energi mekanik adalah penjumlahan antara energi kinetik dan energi potensial.", answer: "benar" },
        { id: "2", text: "Pada sistem tertutup tanpa gesekan, energi mekanik total dapat berkurang secara spontan.", answer: "salah" },
        { id: "3", text: "Satuan internasional (SI) untuk usaha dan energi adalah Joule ($J$).", answer: "benar" },
      ],
      answerKey: "1:benar,2:salah,3:benar",
    },
    {
      order: 4,
      type: "menjodohkan",
      text: "<p>Pasangkan besaran fisika berikut dengan satuan SI yang tepat:</p>",
      pairs: [
        { id: "1", left: "Gaya", right: "Newton (N)" },
        { id: "2", left: "Tekanan", right: "Pascal (Pa)" },
        { id: "3", left: "Daya", right: "Watt (W)" },
        { id: "4", left: "Frekuensi", right: "Hertz (Hz)" },
      ],
      answerKey: "1:Newton (N),2:Pascal (Pa),3:Watt (W),4:Hertz (Hz)",
    },
    {
      order: 5,
      type: "urutkan",
      text: "<p>Urutkan tahapan metode ilmiah berikut dari awal hingga akhir dengan benar:</p>",
      items: [
        { id: "1", text: "Merumuskan masalah" },
        { id: "2", text: "Mengumpulkan data dan observasi" },
        { id: "3", text: "Menyusun hipotesis" },
        { id: "4", text: "Melakukan eksperimen" },
        { id: "5", text: "Menarik kesimpulan" },
      ],
      answerKey: "1,2,3,4,5",
    },
    {
      order: 6,
      type: "drag_drop",
      text: "<p>Susunlah alur transmisi sinyal listrik pada neuron dari penerimaan impuls hingga penghantaran:</p>",
      items: [
        { id: "1", text: "Dendrit" },
        { id: "2", text: "Badan Sel (Soma)" },
        { id: "3", text: "Akson (Neurit)" },
        { id: "4", text: "Terminal Sinapsis" },
      ],
      answerKey: "1,2,3,4",
    },
    {
      order: 7,
      type: "matriks",
      text: "<p>Kelompokkan besaran-besaran berikut ke dalam jenis besaran skalar atau besaran vektor:</p>",
      columns: [
        { id: "c1", text: "Besaran Skalar" },
        { id: "c2", text: "Besaran Vektor" },
      ],
      statements: [
        { id: "s1", text: "Kelajuan mobil $60\\text{ km/jam}$", answer: "c1" },
        { id: "s2", text: "Kecepatan angin $20\\text{ knot}$ ke arah utara", answer: "c2" },
        { id: "s3", text: "Perpindahan sejauh $5\\text{ meter}$ ke barat", answer: "c2" },
        { id: "s4", text: "Massa benda $10\\text{ kg}$", answer: "c1" },
      ],
      answerKey: "s1:c1,s2:c2,s3:c2,s4:c1",
    },
    {
      order: 8,
      type: "klasifikasi",
      text: "<p>Kelompokkan organisme-organisme berikut ke dalam kingdom yang tepat:</p>",
      categories: [
        { id: "cat1", text: "Plantae" },
        { id: "cat2", text: "Animalia" },
        { id: "cat3", text: "Fungi" },
      ],
      statements: [
        { id: "s1", text: "Lumut daun (<em>Bryophyta</em>)", answer: "cat1" },
        { id: "s2", text: "Jamur tiram (<em>Pleurotus ostreatus</em>)", answer: "cat3" },
        { id: "s3", text: "Burung merpati (<em>Columba livia</em>)", answer: "cat2" },
        { id: "s4", text: "Paku tanduk rusa (<em>Platycerium bifurcatum</em>)", answer: "cat1" },
      ],
      shuffleStatements: true,
      answerKey: "s1:cat1,s2:cat3,s3:cat2,s4:cat1",
    },
    {
      order: 9,
      type: "isian_rumpang",
      text: "<p>Dalam proses fotosintesis, tumbuhan hijau menyerap gas [[1]] dari udara dan air dari tanah untuk menghasilkan molekul gula dan melepaskan gas [[2]] ke atmosfer.</p>",
      blanks: [
        { id: "1", answers: ["karbon dioksida", "CO2", "karbondioksida"], caseSensitive: false },
        { id: "2", answers: ["oksigen", "O2"], caseSensitive: false },
      ],
      answerKey: "1:karbon dioksida,2:oksigen",
    },
    {
      order: 10,
      type: "isian_singkat",
      text: "<p>Enzim pengikat $\\text{CO}_2$ yang bekerja pada tahap fiksasi karbon dalam Siklus Calvin tanaman $\\text{C}_3$ adalah ....</p>",
      answerKey: "RuBisCO",
    },
    {
      order: 11,
      type: "uraian",
      text: "<p>Jelaskan perbedaan mendasar antara reaksi terang dan reaksi gelap (Siklus Calvin) pada fotosintesis ditinjau dari tempat berlangsungnya, kebutuhan cahaya, dan produk akhir yang dihasilkan!</p>",
      answerKey:
        "Pedoman Penilaian: 1. Tempat: Reaksi terang di tilakoid/grana, Siklus Calvin di stroma (skor 30). 2. Kebutuhan cahaya: Reaksi terang memerlukan cahaya langsung untuk fotolisis, Siklus Calvin memerlukan ATP & NADPH hasil reaksi terang (skor 30). 3. Produk: Reaksi terang menghasilkan ATP, NADPH, dan O2; Siklus Calvin menghasilkan glukosa/karbohidrat (skor 40).",
    },
  ],
  null,
  2
);
