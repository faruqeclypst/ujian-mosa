import type { NeonBadgeVariant } from "../../../components/ui/NeonBadge";

export type QuestionType =
  | "pilihan_ganda"
  | "pilihan_ganda_kompleks"
  | "menjodohkan"
  | "benar_salah"
  | "isian_singkat"
  | "uraian"
  | "urutkan"
  | "drag_drop"
  | "klasifikasi"
  | "hotspot"
  | "isian_rumpang"
  | "matriks";

export interface QuestionData {
  id: string;
  examId: string;
  type?: QuestionType; // Default is pilihan_ganda if undefined
  text: string;
  imageUrl?: string;
  groupId?: string; // ID Kelompok/Literasi (Opsional)
  groupText?: string; // Teks khusus Literasi (Opsional)
  choices?: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }>;
  // Menjodohkan
  pairs?: Array<{ id: string; left: string; right: string }>;
  // Isian Singkat / Uraian
  answerKey?: string;
  // Urutkan / Drag & Drop
  items?: Array<{ id: string; text: string; imageUrl?: string }>;
  // Benar / Salah Statement Matrix / Matriks / Klasifikasi
  statements?: Array<{ id: string; text: string; answer?: any }>;
  categories?: Array<{ id: string; text: string }>;
  columns?: Array<{ id: string; text: string }>;
  blanks?: Array<{ id: string; answers: string[]; caseSensitive?: boolean }>;
  shuffleStatements?: boolean;
  options?: any;
  order?: number;
}

// Helper: deteksi ID rumpang [[n]] dari teks isian_rumpang
export const detectRumpangIds = (text: string): string[] => {
  const ids: string[] = [];
  const re = /\[\[(\d+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
};

// Helper: cek apakah ada [[ tanpa pasangan ]]
export const hasUnbalancedRumpang = (text: string): boolean => {
  const openCount = (text.match(/\[\[/g) || []).length;
  const closeCount = (text.match(/\]\]/g) || []).length;
  return openCount !== closeCount;
};

export const typeMapReverse: Record<string, QuestionType> = {
  multiple_choice: "pilihan_ganda",
  complex_choice: "pilihan_ganda_kompleks",
  matching: "menjodohkan",
  true_false: "benar_salah",
  short_answer: "isian_singkat",
  essay: "uraian",
  sequence: "urutkan",
  drag_drop: "drag_drop",
  matriks: "matriks",
  klasifikasi: "klasifikasi",
  hotspot: "hotspot",
  isian_rumpang: "isian_rumpang",
};

// Helper untuk menormalisasi record mentah PocketBase menjadi QuestionData yang lengkap
export const mapRawQuestionToQuestionData = (q: any): QuestionData => {
  if (!q) return q;
  const rawType = q.field || q.type || "multiple_choice";
  const mappedType = (typeMapReverse[rawType] || rawType || "pilihan_ganda") as QuestionType;
  const options = q.options || {};

  const correctAnswersList = (q.correctAnswer || q.answerKey || "")
    .toString()
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);

  const rawChoices =
    mappedType === "pilihan_ganda" ||
    mappedType === "pilihan_ganda_kompleks" ||
    (mappedType === "benar_salah" && !options.statements)
      ? q.choices || options || {}
      : q.choices || {};

  const defaultKeys = ["a", "b", "c", "d", "e"];
  const allChoiceKeys = Array.from(new Set([...defaultKeys, ...Object.keys(rawChoices || {})]));

  const mappedChoices: Record<string, { text: string; imageUrl?: string; isCorrect: boolean }> = {};
  allChoiceKeys.forEach((k) => {
    const lowerKey = k.toLowerCase();
    const val = rawChoices[k] ?? rawChoices[lowerKey] ?? rawChoices[k.toUpperCase()];
    if (!val && !defaultKeys.includes(lowerKey)) return;

    let textVal = "";
    let imgVal: string | undefined = undefined;
    let isCorrectVal = false;

    if (typeof val === "string") {
      textVal = val;
    } else if (val && typeof val === "object") {
      textVal = val.text || "";
      imgVal = val.imageUrl;
      isCorrectVal = typeof val.isCorrect === "boolean" ? val.isCorrect : false;
    }

    if (!isCorrectVal && correctAnswersList.includes(lowerKey)) {
      isCorrectVal = true;
    }

    mappedChoices[lowerKey] = {
      text: textVal,
      imageUrl: imgVal,
      isCorrect: isCorrectVal,
    };
  });

  return {
    ...q,
    id: q.id,
    examId: q.examId || q.exam_id || "",
    type: mappedType,
    text: q.text || "",
    imageUrl: q.imageUrl || "",
    groupId: q.groupId || q.group_id || "",
    groupText: q.groupText || q.group_text || "",
    choices: mappedChoices,
    pairs:
      q.pairs ||
      options.pairs ||
      (mappedType === "menjodohkan" ? [{ id: "1", left: "", right: "" }] : undefined),
    items:
      q.items ||
      options.items ||
      (mappedType === "urutkan" || mappedType === "drag_drop"
        ? [{ id: "1", text: "" }]
        : undefined),
    statements:
      mappedType === "benar_salah"
        ? q.statements ||
          options.statements ||
          (Array.isArray(options) ? options : undefined) || [
            { id: "1", text: "", answer: "benar" },
            { id: "2", text: "", answer: "salah" },
            { id: "3", text: "", answer: "benar" },
          ]
        : undefined,
    options: options,
    answerKey: q.correctAnswer || q.answerKey || "",
    order: q.order,
  };
};

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  pilihan_ganda: "Pilihan Ganda",
  pilihan_ganda_kompleks: "PG Kompleks",
  benar_salah: "Benar / Salah",
  menjodohkan: "Menjodohkan",
  isian_singkat: "Isian Singkat",
  uraian: "Uraian / Esai",
  matriks: "Matriks",
  klasifikasi: "Klasifikasi",
  isian_rumpang: "Isian Rumpang",
  hotspot: "Hotspot",
  urutkan: "Urutkan",
  drag_drop: "Drag & Drop",
};

export const QUESTION_TYPE_BADGE: Record<string, { variant: NeonBadgeVariant; label: string }> = {
  pilihan_ganda: { variant: "sky", label: "Pilihan Ganda" },
  pilihan_ganda_kompleks: { variant: "purple", label: "PG Kompleks" },
  benar_salah: { variant: "emerald", label: "Benar / Salah" },
  menjodohkan: { variant: "purple", label: "Menjodohkan" },
  isian_singkat: { variant: "amber", label: "Isian Singkat" },
  uraian: { variant: "emerald", label: "Uraian / Esai" },
  matriks: { variant: "sky", label: "Matriks" },
  klasifikasi: { variant: "purple", label: "Klasifikasi" },
  isian_rumpang: { variant: "amber", label: "Isian Rumpang" },
  hotspot: { variant: "rose", label: "Hotspot" },
  urutkan: { variant: "sky", label: "Urutkan" },
  drag_drop: { variant: "rose", label: "Drag & Drop" },
};

export const getQuestionTypeColor = (type?: string): string => {
  switch (type) {
    case "pilihan_ganda":
      return "bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.12)]";
    case "pilihan_ganda_kompleks":
      return "bg-indigo-500/15 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.12)]";
    case "benar_salah":
      return "bg-cyan-500/15 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.12)]";
    case "menjodohkan":
      return "bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.12)]";
    case "isian_singkat":
      return "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.12)]";
    case "uraian":
      return "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.12)]";
    case "matriks":
      return "bg-teal-500/15 border-teal-500/30 text-teal-700 dark:text-teal-300 shadow-[0_0_8px_rgba(20,184,166,0.12)]";
    case "klasifikasi":
      return "bg-violet-500/15 border-violet-500/30 text-violet-700 dark:text-violet-300 shadow-[0_0_8px_rgba(139,92,246,0.12)]";
    case "isian_rumpang":
      return "bg-lime-500/15 border-lime-500/30 text-lime-700 dark:text-lime-300 shadow-[0_0_8px_rgba(132,204,22,0.12)]";
    case "hotspot":
      return "bg-sky-500/15 border-sky-500/30 text-sky-700 dark:text-sky-300 shadow-[0_0_8px_rgba(14,165,233,0.12)]";
    case "urutkan":
      return "bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-700 dark:text-fuchsia-300 shadow-[0_0_8px_rgba(217,70,239,0.12)]";
    case "drag_drop":
      return "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.12)]";
    default:
      return "bg-neutral-100 border-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300";
  }
};
