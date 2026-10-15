export interface ExamRoomData {
  id: string;
  examId: string;
  classId: string | null;
  allClasses: boolean;
  token: string;
  start_time: string;
  end_time: string;
  startTime?: string;
  endTime?: string;
  duration: number;
  cheat_limit: number;
  submit_window?: number;
  max_questions?: number;
  randomize_questions?: boolean;
  examTitle?: string;
  className?: string;
  room_code?: string;
  token_updated_at?: string;
  status?: "archive" | null;
  room_name?: string;
  examTeacherId?: string;
  examType?: string;
  isDisabled?: boolean;
  subjectName?: string;
  teacherName?: string;
  show_result?: boolean;
  isActive?: boolean;
}

// 🕒 Real-time Student Timer Component
export const stripHtmlTags = (html: string): string => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
};

// 🛡️ Fuzzy Match Helper for Short Answers
export const isFuzzyMatch = (studentAns: any, correctKey: string) => {
  if (typeof studentAns !== "string" || !correctKey) return false;
  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '');
  const sAns = stripHtml(studentAns).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const cKey = stripHtml(correctKey).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (sAns === cKey) return true;
  if (!sAns || !cKey) return false;
  if (sAns.includes(cKey) || cKey.includes(sAns)) return true;
  if (cKey.length < 3) return sAns === cKey;
  const distance = (a: string, b: string) => {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + cost);
      }
    }
    return matrix[b.length][a.length];
  };
  const dist = distance(sAns, cKey);
  const maxLen = Math.max(sAns.length, cKey.length);
  const maxAllowed = maxLen > 10 ? 3 : (maxLen > 6 ? 2 : (maxLen >= 4 ? 1 : 0));
  return dist <= maxAllowed;
};

// Helper to get target questions for a student attempt
export const getTargetQuestions = (
  allQuestions: any[],
  answers: Record<string, any>,
  maxQuestions?: number
) => {
  if (!allQuestions || allQuestions.length === 0) return [];
  const studentOrder = (answers as any)?.__order__ || (answers as any)?.__meta?.questionOrder;
  const isRandomSubset = Number(maxQuestions) > 0 && Number(maxQuestions) < allQuestions.length;

  if (Array.isArray(studentOrder) && studentOrder.length > 0) {
    const answeredQIds = Object.keys(answers || {}).filter(k => !k.startsWith("__"));
    const allStudentQIds = Array.from(new Set([...studentOrder, ...answeredQIds]));

    if (isRandomSubset) {
      const filtered = allQuestions.filter((q: any) => allStudentQIds.includes(q.id));
      return filtered.sort((a: any, b: any) => {
        const idxA = studentOrder.indexOf(a.id);
        const idxB = studentOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    } else {
      return [...allQuestions].sort((a: any, b: any) => {
        const idxA = studentOrder.indexOf(a.id);
        const idxB = studentOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return (a.order || 0) - (b.order || 0);
      });
    }
  }

  return allQuestions;
};

// Helper to compute question score (supports proportional scoring for complex multiple choice and true/false matrix)
export const computeQuestionScore = (q: any, ans: any, overrides?: Record<string, boolean>): number => {
  if (overrides && overrides[q.id] !== undefined) {
    return overrides[q.id] ? 1 : 0;
  }
  if (ans === undefined || ans === null) return 0;
  const type = q.type || q.field || "pilihan_ganda";

  if (type === "pilihan_ganda" || type === "multiple_choice") {
    const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ans).toLowerCase());
    return ck && q.choices[ck]?.isCorrect === true ? 1 : 0;
  }

  if (type === "benar_salah" || type === "true_false") {
    const sts = q.statements || (q.choices && q.choices.statements);
    if (Array.isArray(sts) && sts.length > 0) {
      if (typeof ans !== "object" || ans === null || Array.isArray(ans)) return 0;
      let stCorrect = 0;
      sts.forEach((st: any, idx: number) => {
        const expected = (st.answer || "benar").toLowerCase();
        const userRaw = ans[st.id] !== undefined
          ? ans[st.id]
          : (ans[String(idx + 1)] !== undefined
              ? ans[String(idx + 1)]
              : (ans[String(idx)] !== undefined ? ans[String(idx)] : ""));
        const given = String(userRaw || "").toLowerCase();
        if (given === expected) stCorrect++;
      });
      return sts.length > 0 ? stCorrect / sts.length : 0;
    } else {
      const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ans).toLowerCase());
      return ck && q.choices[ck]?.isCorrect === true ? 1 : 0;
    }
  }

  if (type === "pilihan_ganda_kompleks" || type === "complex_choice" || type === "complex_multiple_choice") {
    const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices[k]?.isCorrect).map(k => k.toLowerCase());
    const studentKeys = Array.isArray(ans)
      ? ans.map((k: any) => String(k).toLowerCase().trim())
      : typeof ans === "string" && ans.trim().length > 0
        ? ans.split(",").map((k: any) => k.toLowerCase().trim())
        : [];
    if (studentKeys.length === 0 || correctKeys.length === 0) return 0;
    const correctChosen = studentKeys.filter(k => correctKeys.includes(k));
    const wrongChosen = studentKeys.filter(k => !correctKeys.includes(k));
    return Math.max(0, correctChosen.length - wrongChosen.length) / correctKeys.length;
  }

  if (type === "isian_singkat" || type === "short_answer") {
    return isFuzzyMatch(ans, q.answerKey) ? 1 : 0;
  }

  if (type === "urutkan" || type === "drag_drop" || type === "ordering" || type === "sequence") {
    const co = (q.items || []).map((it: any) => it.id);
    return Array.isArray(ans) && ans.length === co.length && ans.every((v: any, i: number) => v === co[i]) ? 1 : 0;
  }

  if (type === "menjodohkan" || type === "matching") {
    const pairs = q.pairs || [];
    if (pairs.length > 0 && typeof ans === "object" && ans !== null) {
      const correctCount = pairs.filter((p: any) => ans[p.id] === p.right).length;
      return correctCount / pairs.length;
    }
    return 0;
  }

  return 0;
};

// Helper for boolean full-credit check
export const checkAns = (q: any, studentAns: any, overrides?: Record<string, boolean>): boolean => {
  return computeQuestionScore(q, studentAns, overrides) >= 1;
};

export interface QuestionDetailInfo {
  score: number;
  status: "correct" | "partial" | "wrong" | "empty";
  badgeLabel: string;
  breakdown?: any;
}

export const getQuestionDetailInfo = (q: any, ans: any, overrides?: Record<string, boolean>): QuestionDetailInfo => {
  if (overrides && overrides[q.id] !== undefined) {
    const isOverride = overrides[q.id];
    return {
      score: isOverride ? 1 : 0,
      status: isOverride ? "correct" : "wrong",
      badgeLabel: isOverride ? "Benar (Manual)" : "Salah (Manual)"
    };
  }

  if (ans === undefined || ans === null) {
    return { score: 0, status: "empty", badgeLabel: "Kosong" };
  }

  const type = q.type || q.field || "pilihan_ganda";

  if (type === "pilihan_ganda" || type === "multiple_choice") {
    const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ans).toLowerCase());
    const isCorrect = ck ? q.choices[ck]?.isCorrect === true : false;
    return {
      score: isCorrect ? 1 : 0,
      status: isCorrect ? "correct" : "wrong",
      badgeLabel: isCorrect ? "Benar" : "Salah"
    };
  }

  if (type === "benar_salah" || type === "true_false") {
    const sts = q.statements || (q.choices && q.choices.statements);
    if (Array.isArray(sts) && sts.length > 0) {
      if (typeof ans !== "object" || ans === null || Array.isArray(ans)) {
        return { score: 0, status: "empty", badgeLabel: "Kosong" };
      }
      let matchCount = 0;
      const breakdown = sts.map((st: any, idx: number) => {
        const expected = (st.answer || "benar").toLowerCase();
        const userRaw = ans[st.id] !== undefined
          ? ans[st.id]
          : (ans[String(idx + 1)] !== undefined
              ? ans[String(idx + 1)]
              : (ans[String(idx)] !== undefined ? ans[String(idx)] : ""));
        const userVal = String(userRaw || "").toLowerCase();
        const isMatch = userVal === expected;
        if (isMatch) matchCount++;
        return {
          id: st.id || String(idx + 1),
          num: idx + 1,
          text: st.text,
          userVal: userRaw ? (String(userRaw).toLowerCase() === "salah" ? "Salah" : "Benar") : "-",
          expected: expected === "salah" ? "Salah" : "Benar",
          isMatch
        };
      });

      const score = sts.length > 0 ? matchCount / sts.length : 0;
      const status = matchCount === sts.length ? "correct" : (matchCount > 0 ? "partial" : "wrong");
      const badgeLabel = matchCount === sts.length 
        ? "Benar" 
        : (matchCount > 0 ? `Sebagian (${matchCount}/${sts.length} Benar)` : `Salah (0/${sts.length})`);

      return {
        score,
        status,
        badgeLabel,
        breakdown: { type: "benar_salah", items: breakdown }
      };
    } else {
      const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ans).toLowerCase());
      const isCorrect = ck ? q.choices[ck]?.isCorrect === true : false;
      return {
        score: isCorrect ? 1 : 0,
        status: isCorrect ? "correct" : "wrong",
        badgeLabel: isCorrect ? "Benar" : "Salah"
      };
    }
  }

  if (type === "pilihan_ganda_kompleks" || type === "complex_choice" || type === "complex_multiple_choice") {
    const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices[k]?.isCorrect).map(k => k.toLowerCase());
    const studentKeys = Array.isArray(ans)
      ? ans.map((k: any) => String(k).toLowerCase().trim())
      : typeof ans === "string" && ans.trim().length > 0
        ? ans.split(",").map((k: any) => k.toLowerCase().trim())
        : [];
    if (studentKeys.length === 0) {
      return { score: 0, status: "empty", badgeLabel: "Kosong" };
    }

    const correctChosen = studentKeys.filter(k => correctKeys.includes(k));
    const wrongChosen = studentKeys.filter(k => !correctKeys.includes(k));
    const missingKeys = correctKeys.filter(k => !studentKeys.includes(k)).map(k => k.toUpperCase());
    const isFull = studentKeys.length === correctKeys.length && wrongChosen.length === 0 && correctKeys.every(k => studentKeys.includes(k));

    const breakdownItems = studentKeys.map(k => ({
      key: k.toUpperCase(),
      isCorrect: correctKeys.includes(k)
    }));

    const score = correctKeys.length > 0 ? Math.max(0, correctChosen.length - wrongChosen.length) / correctKeys.length : 0;
    const status = isFull ? "correct" : (correctChosen.length > 0 ? "partial" : "wrong");
    const badgeLabel = isFull 
      ? "Benar" 
      : (correctChosen.length > 0 ? `Sebagian (${correctChosen.length}/${correctKeys.length} Benar)` : "Salah");

    return {
      score,
      status,
      badgeLabel,
      breakdown: { type: "pilihan_ganda_kompleks", items: breakdownItems, missingKeys }
    };
  }

  if (type === "isian_singkat" || type === "short_answer") {
    const isCorrect = isFuzzyMatch(ans, q.answerKey);
    return {
      score: isCorrect ? 1 : 0,
      status: isCorrect ? "correct" : "wrong",
      badgeLabel: isCorrect ? "Benar" : "Salah"
    };
  }

  if (type === "urutkan" || type === "drag_drop" || type === "ordering" || type === "sequence") {
    const co = (q.items || []).map((it: any) => it.id);
    const isCorrect = Array.isArray(ans) && ans.length === co.length && ans.every((v: any, i: number) => v === co[i]);
    return {
      score: isCorrect ? 1 : 0,
      status: isCorrect ? "correct" : "wrong",
      badgeLabel: isCorrect ? "Benar" : "Salah"
    };
  }

  if (type === "menjodohkan" || type === "matching") {
    const pairs = q.pairs || [];
    if (pairs.length > 0 && typeof ans === "object" && ans !== null) {
      let matchCount = 0;
      const breakdownItems = pairs.map((p: any) => {
        const isMatch = ans[p.id] === p.right;
        if (isMatch) matchCount++;
        return {
          left: p.left,
          right: p.right,
          userVal: ans[p.id],
          isMatch
        };
      });
      const score = matchCount / pairs.length;
      const status = matchCount === pairs.length ? "correct" : (matchCount > 0 ? "partial" : "wrong");
      const badgeLabel = matchCount === pairs.length 
        ? "Benar" 
        : (matchCount > 0 ? `Sebagian (${matchCount}/${pairs.length} Benar)` : "Salah");

      return {
        score,
        status,
        badgeLabel,
        breakdown: { type: "menjodohkan", items: breakdownItems }
      };
    }
  }

  return { score: 0, status: "empty", badgeLabel: "Kosong" };
};

