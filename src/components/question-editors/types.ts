import type { HotspotArea } from "./HotspotAreaEditor";

export type QuestionType =
  | "pilihan_ganda"
  | "pilihan_ganda_kompleks"
  | "benar_salah"
  | "menjodohkan"
  | "isian_singkat"
  | "uraian"
  | "urutkan"
  | "drag_drop"
  | "klasifikasi"
  | "matriks"
  | "isian_rumpang"
  | "hotspot";

export interface QuestionChoice {
  text: string;
  imageUrl?: string;
  isCorrect: boolean;
}

export interface QuestionPair {
  id: string;
  left: string;
  right: string;
}

export interface QuestionItem {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface QuestionStatement {
  id: string;
  text: string;
  answer: "benar" | "salah";
}

export interface MatrixColumn {
  id: string;
  text: string;
}

export interface MatrixStatement {
  id: string;
  text: string;
  answer: string;
}

export interface KlasifikasiCategory {
  id: string;
  text: string;
}

export interface KlasifikasiStatement {
  id: string;
  text: string;
  answer: string;
}

export interface IsianRumpangBlank {
  id: string;
  answersText: string;
  caseSensitive: boolean;
}

export interface QuestionFormValues {
  text: string;
  type: QuestionType;
  imageUrl?: string;
  groupId?: string;
  groupText?: string;
  choices: Record<string, QuestionChoice>;
  pairs: QuestionPair[];
  answerKey: string;
  items: QuestionItem[];
  statements?: QuestionStatement[];
  matrixColumns: MatrixColumn[];
  matrixStatements: MatrixStatement[];
  klasifikasiCategories: KlasifikasiCategory[];
  klasifikasiStatements: KlasifikasiStatement[];
  klasifikasiShuffle: boolean;
  isianRumpangText: string;
  isianRumpangBlanks: IsianRumpangBlank[];
  hotspotImageUrl: string;
  hotspotMode: "any" | "all";
  hotspotAreas: HotspotArea[];
}

/** Helper untuk mendeteksi ID token [[1]], [[2]], dst. di teks isian rumpang */
export const detectRumpangIds = (text: string): string[] => {
  const ids: string[] = [];
  const re = /\[\[(\d+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
};

/** Helper untuk mengecek apakah kurung rumpang seimbang */
export const hasUnbalancedRumpang = (text: string): boolean => {
  const openCount = (text.match(/\[\[/g) || []).length;
  const closeCount = (text.match(/\]\]/g) || []).length;
  return openCount !== closeCount;
};

/** Helper auto-detect LaTeX dan membungkusnya dengan $...$ jika belum ada delimiter */
export const autoDetectLatex = (html: string): string => {
  if (!html || !html.includes('\\')) return html;
  if (html.includes('$') || html.includes('\\(') || html.includes('\\[')) return html;

  const latexCommands = /\\(frac|dfrac|sqrt|int|sum|prod|lim|log|ln|sin|cos|tan|vec|text|left|right|cdot|times|div|pm|mp|leq|geq|neq|approx|infty|alpha|beta|gamma|theta|sigma|delta|Delta|Omega|pi|circ|rightarrow|leftarrow|rightleftharpoons)\b/;
  if (!latexCommands.test(html)) return html;

  const processed = html.replace(
    /(<p[^>]*>)((?:(?!<\/p>).)*)(<\/p>)/gi,
    (match, open, content, close) => {
      if (content.includes('$') || content.includes('\\(')) return match;
      if (!latexCommands.test(content)) return match;

      const stripped = content.replace(/<[^>]*>/g, '').trim();
      if (latexCommands.test(stripped) && stripped.length < 500) {
        const textBeforeMath = stripped.match(/^([^\\]*?)(\\(?:frac|dfrac|sqrt|int|sum|prod|lim|log|ln|sin|cos|tan|vec|left|right|cdot|times|div|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|theta|sigma|delta|Delta|Omega|pi|circ|rightarrow|leftarrow|rightleftharpoons))/);
        if (textBeforeMath && textBeforeMath[1].length > 5) {
          const mathStart = stripped.indexOf(textBeforeMath[2]);
          const textPart = stripped.substring(0, mathStart);
          const mathPart = stripped.substring(mathStart);
          return open + textPart + '$ ' + mathPart + ' $' + close;
        }
        return open + '$ ' + content + ' $' + close;
      }
      return match;
    }
  );

  return processed;
};
