import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  X,
  RefreshCw,
  FileText,
  Check,
  Filter,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { MathText } from "../../components/ui/MathText";
import {
  NeonPageHeader,
  NeonStatGrid,
  NeonStatCard,
  NeonTabs,
  NeonBadge,
} from "../../components/ui";
import { useTenant } from "../../context/TenantContext";
import { useExamData } from "../../context/ExamDataContext";
import { useToast } from "../../components/ui/toast";
import { gradeEssayWithAI } from "../../lib/ai";
import { ConfirmationDialog } from "../../components/dialogs/ConfirmationDialog";
import { cn } from "../../lib/utils";

// Strip HTML tags for clean text display
const stripHtml = (html: string): string => {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
};

const isFuzzyMatch = (studentAns: any, correctKey: string) => {
  if (typeof studentAns !== "string" || !correctKey) return false;
  const cleanAns = stripHtml(studentAns).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanKey = stripHtml(correctKey).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (cleanAns === cleanKey) return true;
  if (!cleanAns || !cleanKey) return false;
  if (cleanAns.includes(cleanKey) || cleanKey.includes(cleanAns)) return true;
  if (cleanKey.length < 3) return cleanAns === cleanKey;
  
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
  const dist = distance(cleanAns, cleanKey);
  const maxLen = Math.max(cleanAns.length, cleanKey.length);
  const maxAllowed = maxLen > 10 ? 3 : (maxLen > 6 ? 2 : (maxLen >= 4 ? 1 : 0));
  return dist <= maxAllowed;
};

const StudentGradingDetailPage = () => {
  const navigate = useNavigate();
  const { studentId } = useParams<{ studentId: string }>();
  const [searchParams] = useSearchParams();
  const { pb, terminology } = useTenant();
  const { classes: examClasses, students } = useExamData();
  const { addToast } = useToast();

  const queryRoomId = searchParams.get("roomId");
  const [sessionRoomId, setSessionRoomId] = useState<string | null>(() => {
    return sessionStorage.getItem("activeGradingRoomId") || sessionStorage.getItem("activeMonitoringRoomId");
  });

  const roomId = queryRoomId || sessionRoomId;

  useEffect(() => {
    if (queryRoomId) {
      sessionStorage.setItem("activeGradingRoomId", queryRoomId);
      setSessionRoomId(queryRoomId);
    }
  }, [queryRoomId]);

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [attempt, setAttempt] = useState<any>(null);
  const [aiGradingId, setAiGradingId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "essay" | "wrong" | "correct">("all");

  const student = students.find((s) => s.id === studentId);
  const className = student ? examClasses.find((c) => c.id === student.classId)?.name || "-" : "-";

  useEffect(() => {
    if (!roomId || !studentId) {
      navigate("/admin/penilaian", { replace: true });
      return;
    }
    loadData();
  }, [roomId, studentId]);

  const loadData = useCallback(async () => {
    if (!pb || !roomId || !studentId) return;
    setLoading(true);
    try {
      const roomRecord = await pb.collection("exam_rooms").getOne(roomId, {
        expand: "examId,examId.subjectId",
      });
      const examObj = roomRecord.expand?.examId || (await pb.collection("exams").getOne(roomRecord.examId).catch(() => null));
      let subjectName = examObj?.expand?.subjectId?.name || "";
      if (!subjectName && examObj?.subjectId) {
        const subjectObj = await pb.collection("subjects").getOne(examObj.subjectId).catch(() => null);
        subjectName = subjectObj?.name || "";
      }
      setRoom({
        ...roomRecord,
        examTitle: examObj?.title || "Ujian",
        examId: roomRecord.examId,
        subjectName,
        roomName: roomRecord.room_name || (roomRecord as any).title || roomRecord.title || "",
      });

      const qList = await pb.collection("questions").getFullList({
        filter: `examId = "${roomRecord.examId}"`,
        sort: "order,created",
      });
      const typeMap: Record<string, string> = {
        multiple_choice: "pilihan_ganda",
        complex_choice: "pilihan_ganda_kompleks",
        matching: "menjodohkan",
        true_false: "benar_salah",
        short_answer: "isian_singkat",
        essay: "uraian",
        sequence: "urutkan",
        drag_drop: "drag_drop",
        klasifikasi: "klasifikasi",
        hotspot: "hotspot",
        isian_rumpang: "isian_rumpang",
        matriks: "matriks",
      };
      const mapped = qList.map((q) => {
        const t = typeMap[q.field || q.type] || q.field || q.type || "pilihan_ganda";
        const opts = q.options || {};
        return {
          ...q,
          type: t,
          choices: opts,
          statements: ["benar_salah", "klasifikasi", "matriks"].includes(t) && Array.isArray(opts.statements) ? opts.statements : undefined,
          categories: t === "klasifikasi" ? opts.categories || [] : undefined,
          columns: t === "matriks" ? opts.columns || [] : undefined,
          blanks: t === "isian_rumpang" ? opts.blanks || [] : undefined,
          rumpangText: t === "isian_rumpang" ? opts.text || "" : undefined,
          areas: t === "hotspot" ? opts.areas || [] : undefined,
          hotspotMode: t === "hotspot" ? opts.mode || "any" : undefined,
          hotspotImageUrl: t === "hotspot" ? opts.imageUrl || "" : undefined,
          pairs: t === "menjodohkan" ? opts.pairs : undefined,
          items: t === "urutkan" || t === "drag_drop" ? opts.items : undefined,
          answerKey: q.correctAnswer || q.answerKey,
        };
      });
      setBankQuestions(mapped);

      const attList = await pb.collection("attempts").getFullList({
        filter: `examRoomId = "${roomId}" && studentId = "${studentId}"`,
      });
      const attRecord = attList.length > 0 ? attList[0] : null;
      setAttempt(attRecord);

      const studentOrder = attRecord?.answers?.__order__ || attRecord?.answers?.__meta?.questionOrder;
      let finalQuestions = mapped;
      if (Array.isArray(studentOrder) && studentOrder.length > 0) {
        finalQuestions = studentOrder.map((id: string) => mapped.find((q: any) => q.id === id)).filter((q): q is any => !!q);
      }

      setQuestions(
        finalQuestions.sort((a: any, b: any) => {
          const aIsEssay = a.type === "uraian";
          const bIsEssay = b.type === "uraian";
          if (aIsEssay && !bIsEssay) return 1;
          if (!aIsEssay && bIsEssay) return -1;
          return 0;
        })
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [pb, roomId, studentId]);

  // Helper to compute question score (supports proportional scoring)
  const computeQuestionScore = (q: any, ans: any, overrideVal?: any): number | null => {
    if (overrideVal !== undefined) {
      return overrideVal === true ? 1 : typeof overrideVal === "number" ? overrideVal : 0;
    }
    if (ans === undefined || ans === null) return 0;
    const t = q.type;
    if (t === "pilihan_ganda") {
      const ck = Object.keys(q.choices || {}).find((k) => k.toLowerCase() === String(ans).toLowerCase());
      return ck && q.choices[ck].isCorrect === true ? 1 : 0;
    }
    if (t === "benar_salah") {
      const sts = q.statements || q.choices?.statements;
      if (Array.isArray(sts) && sts.length > 0) {
        let stCorrect = 0;
        sts.forEach((st: any) => {
          const expected = (st.answer || "benar").toLowerCase();
          const given = (ans?.[st.id] || "").toLowerCase();
          if (given === expected) stCorrect++;
        });
        return sts.length > 0 ? stCorrect / sts.length : 0;
      } else {
        const ck = Object.keys(q.choices || {}).find((k) => k.toLowerCase() === String(ans).toLowerCase());
        return ck && q.choices[ck].isCorrect === true ? 1 : 0;
      }
    }
    if (t === "pilihan_ganda_kompleks") {
      const ck = Object.keys(q.choices || {}).filter((k) => q.choices[k].isCorrect).map((k) => k.toLowerCase());
      const sk = Array.isArray(ans) ? ans.map((k: any) => String(k).toLowerCase()) : [];
      const correctChosen = sk.filter((k) => ck.includes(k));
      const wrongChosen = sk.filter((k) => !ck.includes(k));
      return ck.length > 0 ? Math.max(0, correctChosen.length - wrongChosen.length) / ck.length : 0;
    }
    if (t === "menjodohkan") {
      const pairs = q.pairs || [];
      if (pairs.length > 0) {
        let pairCorrect = 0;
        pairs.forEach((p: any) => {
          if (ans[p.id] === p.right) pairCorrect++;
        });
        return pairCorrect / pairs.length;
      }
      return 0;
    }
    if (t === "urutkan" || t === "drag_drop") {
      const co = (q.items || []).map((it: any) => it.id);
      return Array.isArray(ans) && ans.length === co.length && ans.every((v: any, i: number) => v === co[i]) ? 1 : 0;
    }
    if (t === "klasifikasi" || t === "matriks") {
      const kstmts = q.statements || q.choices?.statements || [];
      if (Array.isArray(kstmts) && kstmts.length > 0 && typeof ans === "object" && ans !== null && !Array.isArray(ans)) {
        let kCorr = 0;
        kstmts.forEach((st: any) => {
          const sid = String(st.id ?? "");
          if (!sid) return;
          if (String(ans[sid] ?? "") === String(st.answer ?? "")) kCorr++;
        });
        return kCorr / kstmts.length;
      }
      return 0;
    }
    if (t === "isian_rumpang") {
      const blanks = q.blanks || q.choices?.blanks || [];
      if (Array.isArray(blanks) && blanks.length > 0 && typeof ans === "object" && ans !== null && !Array.isArray(ans)) {
        let bCorr = 0;
        blanks.forEach((bl: any) => {
          const bid = String(bl.id ?? "");
          if (!bid) return;
          let given = String(ans[bid] ?? "").trim();
          const cs = bl.caseSensitive === true;
          if (!cs) given = given.toLowerCase();
          if (!given) return;
          const acc = Array.isArray(bl.answers) ? bl.answers : bl.answers != null ? [bl.answers] : [];
          for (const ac of acc) {
            let exp = String(ac ?? "").trim();
            if (!cs) exp = exp.toLowerCase();
            if (exp && given === exp) {
              bCorr++;
              break;
            }
          }
        });
        return bCorr / blanks.length;
      }
      return 0;
    }
    if (t === "hotspot") {
      const areas = q.areas || q.choices?.areas || [];
      const hmode = String(q.hotspotMode || q.choices?.mode || "any").toLowerCase();
      const inArea = (px: number, py: number, ar: any) => {
        const ax = Number(ar.x), ay = Number(ar.y), aw = Number(ar.w), ah = Number(ar.h);
        if (isNaN(ax) || isNaN(ay) || isNaN(aw) || isNaN(ah)) return false;
        return px >= ax && px <= ax + aw && py >= ay && py <= ay + ah;
      };
      if (Array.isArray(areas) && areas.length > 0) {
        if (hmode === "all") {
          const pts = Array.isArray(ans) ? ans : [];
          let hit = 0;
          for (const ar of areas) {
            for (const pt of pts) {
              const px = Number(pt?.x), py = Number(pt?.y);
              if (!isNaN(px) && !isNaN(py) && inArea(px, py, ar || {})) {
                hit++;
                break;
              }
            }
          }
          return hit / areas.length;
        } else {
          let hx = NaN, hy = NaN;
          if (ans !== null && typeof ans === "object" && !Array.isArray(ans)) {
            hx = Number(ans.x);
            hy = Number(ans.y);
          }
          if (isNaN(hx) || isNaN(hy)) return 0;
          for (const ar of areas) {
            if (inArea(hx, hy, ar || {})) return 1;
          }
          return 0;
        }
      }
      return 0;
    }
    if (t === "isian_singkat") {
      return isFuzzyMatch(ans, q.answerKey) ? 1 : 0;
    }
    return null; // essay - manual grading required
  };

  const objectiveQuestions = questions.filter((q) => q.type !== "uraian");
  const essayQuestions = questions.filter((q) => q.type === "uraian");
  const hasEssay = essayQuestions.length > 0;

  const getScoreBreakdown = () => {
    if (!attempt) return { objScore: 0, essScore: 0, finalScore: 0, objCorrect: 0, essCorrect: 0, essGraded: 0 };
    const answers = attempt.answers || {};
    const overrides = attempt.overrides || (answers as any)?.__overrides__ || {};

    let objCorrect = 0;
    objectiveQuestions.forEach((q) => {
      const s = computeQuestionScore(q, answers[q.id], overrides[q.id]);
      if (s !== null) objCorrect += s;
    });

    let essCorrect = 0,
      essGraded = 0;
    essayQuestions.forEach((q) => {
      if (overrides[q.id] !== undefined) {
        essGraded++;
        if (overrides[q.id]) essCorrect++;
      } else if (q.type === "isian_singkat" && answers[q.id]) {
        essGraded++;
        if (isFuzzyMatch(answers[q.id], q.answerKey)) essCorrect++;
      }
    });

    const objScore = objectiveQuestions.length > 0 ? Math.round((objCorrect / objectiveQuestions.length) * 100) : 0;
    const essScore = essayQuestions.length > 0 ? Math.round((essCorrect / essayQuestions.length) * 100) : 0;
    const finalScore = !hasEssay ? objScore : Math.round(objScore * 0.6 + essScore * 0.4);

    return { objScore, essScore, finalScore, objCorrect, essCorrect, essGraded };
  };

  const handleGrade = async (qId: string, isCorrect: boolean) => {
    if (!attempt || !pb) return;
    const answers = attempt.answers || {};
    const currentOverrides = attempt.overrides || (answers as any)?.__overrides__ || {};
    const newOverrides = { ...currentOverrides, [qId]: isCorrect };

    let objCorrect = 0;
    objectiveQuestions.forEach((q) => {
      const s = computeQuestionScore(q, answers[q.id], newOverrides[q.id]);
      if (s !== null) objCorrect += s;
    });

    let essCorrect = 0,
      essGraded = 0;
    essayQuestions.forEach((q) => {
      if (newOverrides[q.id] !== undefined) {
        essGraded++;
        if (newOverrides[q.id]) essCorrect++;
      } else if (q.type === "isian_singkat" && answers[q.id]) {
        essGraded++;
        if (isFuzzyMatch(answers[q.id], q.answerKey)) essCorrect++;
      }
    });

    const objScore = objectiveQuestions.length > 0 ? Math.round((objCorrect / objectiveQuestions.length) * 100) : 0;
    const essScore = essayQuestions.length > 0 ? Math.round((essCorrect / essayQuestions.length) * 100) : 0;
    const finalScore = !hasEssay ? objScore : Math.round(objScore * 0.6 + essScore * 0.4);

    const updatedAnswers = {
      ...answers,
      __overrides__: newOverrides,
      __meta: {
        ...(answers.__meta || {}),
        objectiveScore: objScore,
        objectiveCorrect: Math.floor(objCorrect),
        objectiveTotal: objectiveQuestions.length,
        essayTotal: essayQuestions.length,
        essayCorrect: essCorrect,
        essayScore: essScore,
        essayGraded: essGraded,
      },
    };

    try {
      const updatePayload = {
        overrides: newOverrides,
        answers: updatedAnswers,
        correct: Math.floor(objCorrect + essCorrect),
        objectiveCorrect: Math.floor(objCorrect),
        objectiveTotal: objectiveQuestions.length,
        objectiveScore: objScore,
        essayCorrect: essCorrect,
        essayTotal: essayQuestions.length,
        essayScore: essScore,
        essayGraded: essGraded,
        score: finalScore,
      };
      await pb.collection("attempts").update(attempt.id, updatePayload);
      setAttempt((prev: any) => (prev ? { ...prev, ...updatePayload } : prev));
    } catch (e) {
      console.error(e);
    }
  };

  // Synchronize database scores if they are out of sync on load
  useEffect(() => {
    if (!attempt || !pb || loading || questions.length === 0) return;

    const { objScore, essScore, finalScore, objCorrect, essCorrect, essGraded } = getScoreBreakdown();

    const needsSync =
      attempt.essayTotal !== essayQuestions.length ||
      attempt.essayGraded !== essGraded ||
      attempt.essayCorrect !== essCorrect ||
      attempt.essayScore !== essScore ||
      attempt.objectiveCorrect !== objCorrect ||
      attempt.objectiveTotal !== objectiveQuestions.length ||
      attempt.objectiveScore !== objScore ||
      attempt.score !== finalScore ||
      attempt.answers?.__meta?.essayGraded !== essGraded ||
      attempt.answers?.__meta?.essayCorrect !== essCorrect;

    if (needsSync) {
      const syncDB = async () => {
        try {
          const updatedAnswers = {
            ...(attempt.answers || {}),
            __meta: {
              ...((attempt.answers || {}).__meta || {}),
              objectiveScore: objScore,
              objectiveCorrect: Math.floor(objCorrect),
              objectiveTotal: objectiveQuestions.length,
              essayTotal: essayQuestions.length,
              essayCorrect: essCorrect,
              essayScore: essScore,
              essayGraded: essGraded,
            },
          };
          const updatePayload = {
            answers: updatedAnswers,
            correct: Math.floor(objCorrect + essCorrect),
            objectiveCorrect: Math.floor(objCorrect),
            objectiveTotal: objectiveQuestions.length,
            objectiveScore: objScore,
            essayCorrect: essCorrect,
            essayTotal: essayQuestions.length,
            essayScore: essScore,
            essayGraded: essGraded,
            score: finalScore,
          };
          await pb.collection("attempts").update(attempt.id, updatePayload);
          setAttempt((prev: any) => (prev ? { ...prev, ...updatePayload } : prev));
        } catch (e) {
          console.error("Failed to auto-sync scores in DB:", e);
        }
      };
      syncDB();
    }
  }, [attempt, questions, loading, pb]);

  const handleAIGradeQuestion = async (qId: string) => {
    const q = questions.find((x) => x.id === qId);
    if (!attempt || !q || !pb) return;
    const studentAnswer = attempt.answers?.[qId];
    if (!studentAnswer) {
      handleGrade(qId, false);
      return;
    }

    setAiGradingId(qId);
    try {
      const result = await gradeEssayWithAI(
        pb,
        q.text?.replace(/<[^>]*>/g, "") || "",
        String(studentAnswer),
        q.answerKey || "",
        q.type === "isian_singkat" ? "isian_singkat" : "uraian"
      );
      await handleGrade(qId, result.isCorrect);
      addToast({
        title: result.isCorrect ? "✓ Benar" : "✗ Salah",
        description: result.feedback,
        type: result.isCorrect ? "success" : "warning",
      });
    } catch (err: any) {
      addToast({ title: "Gagal", description: err.message, type: "error" });
    } finally {
      setAiGradingId(null);
    }
  };

  const [isAutoGrading, setIsAutoGrading] = useState(false);
  const [showAutoGradeConfirm, setShowAutoGradeConfirm] = useState(false);

  const handleAutoGradeClick = () => {
    if (!attempt) return;
    const overrides = attempt.overrides || (attempt.answers as any)?.__overrides__ || {};
    const alreadyGraded = essayQuestions.some((q) => overrides[q.id] !== undefined);
    if (alreadyGraded) {
      setShowAutoGradeConfirm(true);
    } else {
      executeAutoGrade();
    }
  };

  const executeAutoGrade = async () => {
    if (!attempt) return;
    setShowAutoGradeConfirm(false);
    setIsAutoGrading(true);
    try {
      for (const q of essayQuestions) {
        const studentAnswer = attempt.answers?.[q.id];
        if (!studentAnswer) {
          await handleGrade(q.id, false);
          continue;
        }

        if (q.type === "isian_singkat") {
          const isCorrect = isFuzzyMatch(studentAnswer, q.answerKey);
          await handleGrade(q.id, isCorrect);
        } else {
          await handleAIGradeQuestion(q.id);
        }
      }
      addToast({
        title: "Auto Grading Selesai",
        description: `${essayQuestions.length} soal essay telah dinilai.`,
        type: "success",
      });
    } catch (err: any) {
      addToast({ title: "Gagal", description: err.message, type: "error" });
    } finally {
      setIsAutoGrading(false);
    }
  };

  const { objScore, essScore, finalScore, objCorrect, essCorrect, essGraded } = getScoreBreakdown();

  const getQuestionScore = (q: any): number | null => {
    if (!attempt) return null;
    const answers = attempt.answers || {};
    const overrides = attempt.overrides || (answers as any)?.__overrides__ || {};
    return computeQuestionScore(q, answers[q.id], overrides[q.id]);
  };

  const isQuestionCorrect = (q: any): boolean | null => {
    const s = getQuestionScore(q);
    if (s === null) return null;
    return s >= 1;
  };

  const handleExportPDF = () => {
    if (!attempt || !student) return;
    const typeLabels: Record<string, string> = {
      pilihan_ganda: "PG",
      pilihan_ganda_kompleks: "PG Kompleks",
      menjodohkan: "Menjodohkan",
      benar_salah: "B/S",
      isian_singkat: "Isian",
      uraian: "Uraian",
      urutkan: "Urutan",
      drag_drop: "Drag & Drop",
      klasifikasi: "Klasifikasi",
      matriks: "Matriks",
      isian_rumpang: "Isian Rumpang",
      hotspot: "Hotspot",
    };

    const getAnswerText = (q: any) => {
      const ans = attempt.answers?.[q.id];
      if (!ans) return "<em>Tidak dijawab</em>";
      if (q.type === "benar_salah") {
        const sts = q.statements || q.choices?.statements;
        if (Array.isArray(sts) && sts.length > 0) {
          return sts
            .map((st: any) => {
              const userAns = ans?.[st.id];
              return `${stripHtml(st.text).substring(0, 35)}: ${userAns ? userAns.toUpperCase() : "<em>-</em>"}`;
            })
            .join("<br>");
        }
        const label = q.choices?.[ans]?.text || "";
        return `${String(ans).toUpperCase()}${label ? ". " + stripHtml(label).substring(0, 60) : ""}`;
      }
      if (q.type === "pilihan_ganda") {
        const label = q.choices?.[ans]?.text || "";
        return `${String(ans).toUpperCase()}${label ? ". " + stripHtml(label).substring(0, 60) : ""}`;
      }
      if (q.type === "pilihan_ganda_kompleks") return Array.isArray(ans) ? ans.map((k: string) => k.toUpperCase()).join(", ") : String(ans);
      if (q.type === "menjodohkan") {
        const pairs = q.pairs || [];
        return pairs.map((p: any) => `${p.left} → ${ans[p.id] || "?"}`).join("<br>");
      }
      if (q.type === "urutkan" || q.type === "drag_drop")
        return Array.isArray(ans)
          ? ans.map((id: string, i: number) => `${i + 1}. ${(q.items || []).find((it: any) => it.id === id)?.text || id}`).join("<br>")
          : String(ans);
      if (q.type === "klasifikasi" || q.type === "matriks") {
        const stmts = q.statements || q.choices?.statements || [];
        const cats = q.type === "klasifikasi" ? q.categories || q.choices?.categories || [] : q.columns || q.choices?.columns || [];
        const catMap: Record<string, string> = {};
        if (Array.isArray(cats)) cats.forEach((c: any) => { catMap[String(c.id)] = String(c.text || c.id); });
        if (Array.isArray(stmts) && stmts.length > 0 && typeof ans === "object" && ans !== null) {
          return stmts
            .map((st: any) => {
              const userVal = ans?.[st.id];
              return `${stripHtml(st.text).substring(0, 35)}: ${userVal ? stripHtml(catMap[String(userVal)] || String(userVal)).substring(0, 30) : "<em>-</em>"}`;
            })
            .join("<br>");
        }
        return String(ans).substring(0, 200);
      }
      if (q.type === "isian_rumpang") {
        const blanks = q.blanks || q.choices?.blanks || [];
        if (Array.isArray(blanks) && blanks.length > 0 && typeof ans === "object" && ans !== null) {
          return blanks.map((bl: any, idx: number) => `[${idx + 1}]: ${stripHtml(String(ans?.[bl.id] ?? "-")).substring(0, 40) || "<em>-</em>"}`).join("<br>");
        }
        return String(ans).substring(0, 200);
      }
      if (q.type === "hotspot") {
        const hmode = String(q.hotspotMode || q.choices?.mode || "any").toLowerCase();
        if (hmode === "all" && Array.isArray(ans)) {
          return ans.map((pt: any, i: number) => `Titik ${i + 1}: (${Math.round(Number(pt?.x) || 0)}%, ${Math.round(Number(pt?.y) || 0)}%)`).join("<br>");
        }
        if (ans && typeof ans === "object") {
          return `Klik di (${Math.round(Number(ans.x) || 0)}%, ${Math.round(Number(ans.y) || 0)}%)`;
        }
        return String(ans).substring(0, 200);
      }
      return String(ans).substring(0, 200);
    };

    const getKeyText = (q: any) => {
      if (q.type === "benar_salah") {
        const sts = q.statements || q.choices?.statements;
        if (Array.isArray(sts) && sts.length > 0) {
          return sts.map((st: any) => `${stripHtml(st.text).substring(0, 35)}: ${(st.answer || "benar").toUpperCase()}`).join("<br>");
        }
        const ck = Object.keys(q.choices || {}).find((k) => q.choices[k].isCorrect);
        if (!ck) return "-";
        const label = q.choices[ck]?.text || "";
        return `${ck.toUpperCase()}${label ? ". " + stripHtml(label).substring(0, 60) : ""}`;
      }
      if (q.type === "pilihan_ganda") {
        const ck = Object.keys(q.choices || {}).find((k) => q.choices[k].isCorrect);
        if (!ck) return "-";
        const label = q.choices[ck]?.text || "";
        return `${ck.toUpperCase()}${label ? ". " + stripHtml(label).substring(0, 60) : ""}`;
      }
      if (q.type === "pilihan_ganda_kompleks") return Object.keys(q.choices || {}).filter((k) => q.choices[k].isCorrect).map((k) => k.toUpperCase()).join(", ");
      if (q.type === "menjodohkan") return (q.pairs || []).map((p: any) => `${p.left} → ${p.right}`).join("<br>");
      if (q.type === "urutkan" || q.type === "drag_drop") return (q.items || []).map((it: any, i: number) => `${i + 1}. ${it.text}`).join("<br>");
      if (q.type === "klasifikasi" || q.type === "matriks") {
        const stmts = q.statements || q.choices?.statements || [];
        const cats = q.type === "klasifikasi" ? q.categories || q.choices?.categories || [] : q.columns || q.choices?.columns || [];
        const catMap: Record<string, string> = {};
        if (Array.isArray(cats)) cats.forEach((c: any) => { catMap[String(c.id)] = String(c.text || c.id); });
        if (Array.isArray(stmts) && stmts.length > 0) {
          return stmts.map((st: any) => `${stripHtml(st.text).substring(0, 35)}: ${stripHtml(catMap[String(st.answer)] || String(st.answer || "-")).substring(0, 30)}`).join("<br>");
        }
        return "-";
      }
      if (q.type === "isian_rumpang") {
        const blanks = q.blanks || q.choices?.blanks || [];
        if (Array.isArray(blanks) && blanks.length > 0) {
          return blanks
            .map((bl: any, idx: number) => {
              const acc = Array.isArray(bl.answers) ? bl.answers : bl.answers != null ? [bl.answers] : [];
              return `[${idx + 1}]: ${acc.map((a: any) => String(a)).join(" / ") || "-"}`;
            })
            .join("<br>");
        }
        return "-";
      }
      if (q.type === "hotspot") {
        const areas = q.areas || q.choices?.areas || [];
        const hmode = String(q.hotspotMode || q.choices?.mode || "any").toLowerCase();
        if (Array.isArray(areas) && areas.length > 0) {
          return (
            `${areas.length} area (${hmode === "all" ? "semua" : "satu saja"})` +
            areas.map((ar: any, i: number) => `<br>Area ${i + 1}${ar.label ? ` (${stripHtml(String(ar.label)).substring(0, 30)})` : ""}: x=${ar.x}%, y=${ar.y}%, ${ar.w}%×${ar.h}%`).join("")
          );
        }
        return "-";
      }
      return (q.answerKey || "-").substring(0, 200);
    };

    const rows = questions
      .map((q, idx) => {
        const qScore = getQuestionScore(q);
        const status = qScore === null ? "Belum" : qScore >= 1 ? "Benar" : qScore > 0 ? `${Math.round(qScore * 100)}%` : "Salah";
        const rowBg = qScore !== null && qScore >= 1 ? "background:#f0fdf4;" : qScore !== null && qScore > 0 ? "background:#fffbeb;" : qScore === 0 ? "background:#fef2f2;" : "";
        const statusStyle = qScore !== null && qScore >= 1 ? "color:#16a34a;font-weight:bold;" : qScore !== null && qScore > 0 ? "color:#d97706;font-weight:bold;" : qScore === 0 ? "color:#dc2626;font-weight:bold;" : "color:#6b7280;";
        return `<tr style="page-break-inside:avoid;${rowBg}">
        <td class="cell center">${idx + 1}</td>
        <td class="cell soal">${q.text?.replace(/<[^>]*>/g, "").substring(0, 150) || "-"}</td>
        <td class="cell center"><span class="badge">${typeLabels[q.type] || q.type}</span></td>
        <td class="cell">${getAnswerText(q)}</td>
        <td class="cell">${getKeyText(q)}</td>
        <td class="cell center" style="${statusStyle}">${status}</td>
      </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Detail Nilai - ${student.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', serif; padding: 20px 28px; color: #000; font-size: 9pt; line-height: 1.3; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .header h1 { font-size: 12pt; font-weight: bold; letter-spacing: 1px; margin-bottom: 2px; }
  .header .meta { font-size: 9pt; color: #333; }
  .info-table { width: 100%; margin-bottom: 12px; border: none; font-size: 9pt; }
  .info-table td { padding: 2px 0; border: none; vertical-align: top; }
  .info-label { font-weight: normal; color: #333; width: 80px; }
  .info-value { font-weight: bold; color: #000; padding-right: 20px; }
  .scores { display: table; width: 100%; margin-bottom: 12px; border: 1px solid #000; }
  .scores .col { display: table-cell; width: 25%; text-align: center; padding: 6px 4px; border-right: 1px solid #000; }
  .scores .col:last-child { border-right: none; }
  .scores .col .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.3px; color: #333; }
  .scores .col .value { font-size: 14pt; font-weight: bold; margin: 1px 0; }
  .scores .col .sub { font-size: 7pt; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 8pt; }
  th { background: #f0f0f0; padding: 4px 6px; border: 1px solid #000; text-align: left; font-size: 7pt; font-weight: bold; text-transform: uppercase; }
  .cell { padding: 4px 6px; border: 1px solid #000; vertical-align: top; word-break: break-word; }
  .cell.center { text-align: center; }
  .cell.soal { max-width: 160px; }
  .badge { font-weight: bold; font-size: 7pt; }
  .footer { margin-top: 12px; text-align: right; font-size: 7pt; color: #666; }
  @media print {
    body { padding: 10px 14px; }
    @page { size: A4 portrait; margin: 12mm; }
  }
</style></head><body>
<div class="header">
  <h1>LAPORAN HASIL PENILAIAN</h1>
  <div class="meta">${room?.examTitle || "Ujian"}${room?.subjectName ? " — Mata Pelajaran: " + room.subjectName : ""}</div>
</div>
<table class="info-table"><tbody>
  <tr><td class="info-label">Nama Peserta</td><td class="info-value">: ${student.name}</td><td class="info-label">Kelas</td><td class="info-value">: ${className}</td></tr>
  <tr><td class="info-label">${terminology?.id || "NISN"}</td><td class="info-value">: ${(student as any)?.nisn || "-"}</td><td class="info-label">Ruang Ujian</td><td class="info-value">: ${room?.roomName || "-"}</td></tr>
</tbody></table>
<div class="scores">
  <div class="col"><div class="label">Nilai Final</div><div class="value">${finalScore}</div><div class="sub">${hasEssay ? "60% obj + 40% essay" : "100% objektif"}</div></div>
  <div class="col"><div class="label">Benar</div><div class="value" style="color:#16a34a;">${questions.filter((q) => isQuestionCorrect(q) === true).length}</div><div class="sub">dari ${questions.length} soal</div></div>
  <div class="col"><div class="label">Salah</div><div class="value" style="color:#dc2626;">${questions.filter((q) => isQuestionCorrect(q) === false).length}</div><div class="sub">dari ${questions.length} soal</div></div>
  <div class="col"><div class="label">Objektif</div><div class="value">${objScore}</div><div class="sub">${objCorrect}/${objectiveQuestions.length} benar</div></div>
  <div class="col"><div class="label">Subjektif</div><div class="value">${hasEssay ? essScore : "-"}</div><div class="sub">${hasEssay ? `${essCorrect}/${essayQuestions.length} benar` : "-"}</div></div>
</div>
<table><thead><tr><th style="width:30px;">No</th><th style="width:28%;">Soal</th><th style="width:60px;">Tipe</th><th style="width:22%;">Jawaban Siswa</th><th style="width:22%;">Kunci Jawaban</th><th style="width:60px;">Status</th></tr></thead><tbody>${rows}</tbody></table>
<div class="footer">Dicetak pada ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
</body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const getStudentAnswer = (q: any) => {
    if (!attempt) return "-";
    const ans = attempt.answers?.[q.id];
    if (ans === undefined || ans === null) {
      return <span className="text-neutral-400 italic text-xs">Tidak dijawab</span>;
    }

    if (q.type === "benar_salah") {
      const sts = q.statements || q.choices?.statements;
      if (Array.isArray(sts) && sts.length > 0) {
        return (
          <div className="space-y-1.5 my-0.5">
            {sts.map((st: any) => {
              const userAns = ans?.[st.id];
              const isMatch = userAns && userAns.toLowerCase() === (st.answer || "benar").toLowerCase();
              return (
                <div key={st.id} className="text-xs flex items-start justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800/60 pb-1 last:border-0 last:pb-0">
                  <div className="flex-1 text-neutral-700 dark:text-neutral-300">
                    <MathText content={st.text} className="inline text-xs [&_p]:inline [&_p]:m-0" />
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    {userAns ? (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[11px] font-bold font-mono",
                          userAns.toLowerCase() === "benar"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40"
                            : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40"
                        )}
                      >
                        {userAns.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-neutral-400 italic text-xs">-</span>
                    )}
                    {userAns && (
                      isMatch ? <span className="text-emerald-500 font-bold text-xs">✓</span> : <span className="text-rose-500 font-bold text-xs">✗</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      const choiceText = q.choices?.[ans]?.text || ans;
      return (
        <span className="inline-flex items-baseline gap-1">
          <span className="font-bold text-neutral-900 dark:text-neutral-100 font-mono">{String(ans).toUpperCase()}.</span>{" "}
          <MathText content={choiceText} className="inline text-xs [&_p]:inline [&_p]:m-0 [&_img]:hidden text-neutral-700 dark:text-neutral-300" />
        </span>
      );
    }

    if (q.type === "pilihan_ganda") {
      const choiceText = q.choices?.[ans]?.text || ans;
      return (
        <span className="inline-flex items-baseline gap-1">
          <span className="font-bold text-neutral-900 dark:text-neutral-100 font-mono">{String(ans).toUpperCase()}.</span>{" "}
          <MathText content={choiceText} className="inline text-xs [&_p]:inline [&_p]:m-0 [&_img]:hidden text-neutral-700 dark:text-neutral-300" />
        </span>
      );
    }

    if (q.type === "pilihan_ganda_kompleks") {
      const correctKeys = Object.keys(q.choices || {}).filter((k) => q.choices[k].isCorrect).map((k) => k.toLowerCase());
      const selected = Array.isArray(ans) ? ans.map((k: string) => String(k).toLowerCase()) : [];
      if (selected.length === 0) return <span className="text-neutral-400 italic text-xs">Tidak dijawab</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {selected.map((k: string) => {
            const isMatch = correctKeys.includes(k);
            return (
              <span
                key={k}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[11px] font-bold font-mono inline-flex items-center gap-0.5",
                  isMatch
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40"
                    : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40"
                )}
              >
                {k.toUpperCase()} {isMatch ? "✓" : "✗"}
              </span>
            );
          })}
        </div>
      );
    }

    if (q.type === "menjodohkan") {
      const pairs = q.pairs || [];
      return (
        <div className="space-y-1">
          {pairs.map((p: any) => (
            <div key={p.id} className="text-xs flex items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800/40 pb-0.5 last:border-0">
              <span className="text-neutral-500">{stripHtml(p.left)}</span>
              <div className="flex items-center gap-1 font-mono">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">{stripHtml(ans[p.id] || "?")}</span>
                {ans[p.id] === p.right ? <span className="text-emerald-500">✓</span> : <span className="text-rose-500">✗</span>}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (q.type === "urutkan" || q.type === "drag_drop") {
      return Array.isArray(ans) ? (
        <div className="flex flex-wrap items-center gap-1 text-xs font-mono">
          {ans.map((id: string, idx: number) => {
            const item = (q.items || []).find((it: any) => it.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-sans">
                  {idx + 1}. {stripHtml(item?.text || id)}
                </span>
                {idx < ans.length - 1 && <span className="text-neutral-400">→</span>}
              </span>
            );
          })}
        </div>
      ) : (
        String(ans)
      );
    }

    if (q.type === "klasifikasi" || q.type === "matriks") {
      const stmts = q.statements || q.choices?.statements || [];
      const cats = q.type === "klasifikasi" ? q.categories || q.choices?.categories || [] : q.columns || q.choices?.columns || [];
      const catMap: Record<string, string> = {};
      if (Array.isArray(cats)) cats.forEach((c: any) => { catMap[String(c.id)] = String(c.text || c.id); });
      if (Array.isArray(stmts) && stmts.length > 0 && typeof ans === "object" && ans !== null) {
        return (
          <div className="space-y-1.5 my-0.5">
            {stmts.map((st: any) => {
              const userVal = ans?.[st.id];
              const expected = String(st.answer ?? "");
              const isMatch = userVal !== undefined && String(userVal) === expected && userVal !== "";
              return (
                <div key={st.id} className="text-xs flex items-start justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800/60 pb-1 last:border-0 last:pb-0">
                  <div className="flex-1 text-neutral-700 dark:text-neutral-300">
                    <MathText content={st.text} className="inline text-xs [&_p]:inline [&_p]:m-0" />
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    {userVal ? (
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                        {stripHtml(catMap[String(userVal)] || String(userVal)).substring(0, 25)}
                      </span>
                    ) : (
                      <span className="text-neutral-400 italic text-xs">-</span>
                    )}
                    {userVal && (isMatch ? <span className="text-emerald-500 font-bold text-xs">✓</span> : <span className="text-rose-500 font-bold text-xs">✗</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      return <span className="text-neutral-400 italic text-xs">Tidak dijawab</span>;
    }

    if (q.type === "isian_rumpang") {
      const blanks = q.blanks || q.choices?.blanks || [];
      if (Array.isArray(blanks) && blanks.length > 0 && typeof ans === "object" && ans !== null) {
        return (
          <div className="space-y-1.5 my-0.5">
            {blanks.map((bl: any, idx: number) => {
              const bid = String(bl.id ?? idx);
              const given = String(ans?.[bid] ?? "").trim();
              const cs = bl.caseSensitive === true;
              const givenCmp = cs ? given : given.toLowerCase();
              const acc = Array.isArray(bl.answers) ? bl.answers : bl.answers != null ? [bl.answers] : [];
              let isMatch = false;
              if (given) {
                for (const a of acc) {
                  const expCmp = cs ? String(a ?? "").trim() : String(a ?? "").trim().toLowerCase();
                  if (expCmp && givenCmp === expCmp) {
                    isMatch = true;
                    break;
                  }
                }
              }
              return (
                <div key={bid} className="text-xs flex items-start justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800/60 pb-1 last:border-0 last:pb-0">
                  <span className="text-neutral-400 font-mono">[{idx + 1}]</span>
                  <div className="flex-1 text-neutral-800 dark:text-neutral-200 font-medium">{given || <span className="text-neutral-400 italic">-</span>}</div>
                  <div className="shrink-0">
                    {given && (isMatch ? <span className="text-emerald-500 font-bold text-xs">✓</span> : <span className="text-rose-500 font-bold text-xs">✗</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      return <span className="text-neutral-400 italic text-xs">Tidak dijawab</span>;
    }

    if (q.type === "hotspot") {
      const hmode = String(q.hotspotMode || q.choices?.mode || "any").toLowerCase();
      const areas = q.areas || q.choices?.areas || [];
      const inArea = (px: number, py: number, ar: any) => {
        const ax = Number(ar.x), ay = Number(ar.y), aw = Number(ar.w), ah = Number(ar.h);
        if (isNaN(ax) || isNaN(ay) || isNaN(aw) || isNaN(ah)) return false;
        return px >= ax && px <= ax + aw && py >= ay && py <= ay + ah;
      };
      if (hmode === "all" && Array.isArray(ans)) {
        let hitCount = 0;
        ans.forEach((pt: any) => {
          const px = Number(pt?.x), py = Number(pt?.y);
          if (!isNaN(px) && !isNaN(py) && areas.some((ar: any) => inArea(px, py, ar || {}))) {
            hitCount++;
          }
        });
        return (
          <div className="text-xs space-y-1">
            <div className="font-medium text-neutral-800 dark:text-neutral-200">
              {ans.length} titik diklik • {hitCount}/{areas.length} area kena
            </div>
            <div className="flex flex-wrap gap-1">
              {ans.map((pt: any, i: number) => (
                <span key={i} className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                  ({Math.round(Number(pt?.x) || 0)}%, {Math.round(Number(pt?.y) || 0)}%)
                </span>
              ))}
            </div>
          </div>
        );
      }
      if (ans && typeof ans === "object" && !Array.isArray(ans)) {
        const hx = Number(ans.x), hy = Number(ans.y);
        let hitLabel = "";
        if (!isNaN(hx) && !isNaN(hy) && Array.isArray(areas)) {
          const hitAr = areas.find((ar: any) => inArea(hx, hy, ar || {}));
          hitLabel = hitAr ? hitAr.label || "area target" : "";
        }
        return (
          <div className="text-xs flex items-center gap-1.5">
            <span className="font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-1.5 py-0.5 rounded text-[11px]">
              ({Math.round(hx || 0)}%, {Math.round(hy || 0)}%)
            </span>
            {hitLabel && <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">✓ {stripHtml(hitLabel).substring(0, 30)}</span>}
          </div>
        );
      }
      return <span className="text-neutral-400 italic text-xs">Tidak dijawab</span>;
    }

    if (q.type === "uraian") {
      return (
        <div className="text-xs text-neutral-800 dark:text-neutral-200 bg-neutral-50 dark:bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 whitespace-pre-wrap leading-relaxed">
          {String(ans)}
        </div>
      );
    }

    return <span className="text-xs text-neutral-800 dark:text-neutral-200">{String(ans)}</span>;
  };

  const getCorrectAnswer = (q: any) => {
    if (q.type === "benar_salah") {
      const sts = q.statements || q.choices?.statements;
      if (Array.isArray(sts) && sts.length > 0) {
        return (
          <div className="space-y-1.5 my-0.5">
            {sts.map((st: any) => {
              const expected = (st.answer || "benar").toUpperCase();
              return (
                <div key={st.id} className="text-xs flex items-start justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800/60 pb-1 last:border-0 last:pb-0">
                  <div className="flex-1 text-neutral-500 dark:text-neutral-400">
                    <MathText content={st.text} className="inline text-xs [&_p]:inline [&_p]:m-0" />
                  </div>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[11px] font-bold font-mono shrink-0",
                      expected === "BENAR"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40"
                        : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40"
                    )}
                  >
                    {expected}
                  </span>
                </div>
              );
            })}
          </div>
        );
      }
      const correctKey = Object.keys(q.choices || {}).find((k) => q.choices[k].isCorrect);
      if (!correctKey) return "-";
      const choiceText = q.choices[correctKey]?.text || "";
      return (
        <span className="inline-flex items-baseline gap-1">
          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{correctKey.toUpperCase()}.</span>{" "}
          <MathText content={choiceText} className="inline text-xs [&_p]:inline [&_p]:m-0 [&_img]:hidden text-neutral-600 dark:text-neutral-400" />
        </span>
      );
    }
    if (q.type === "pilihan_ganda") {
      const correctKey = Object.keys(q.choices || {}).find((k) => q.choices[k].isCorrect);
      if (!correctKey) return "-";
      const choiceText = q.choices[correctKey]?.text || "";
      return (
        <span className="inline-flex items-baseline gap-1">
          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{correctKey.toUpperCase()}.</span>{" "}
          <MathText content={choiceText} className="inline text-xs [&_p]:inline [&_p]:m-0 [&_img]:hidden text-neutral-600 dark:text-neutral-400" />
        </span>
      );
    }
    if (q.type === "pilihan_ganda_kompleks") {
      const correctKeys = Object.keys(q.choices || {}).filter((k) => q.choices[k].isCorrect);
      return (
        <div className="flex flex-wrap gap-1">
          {correctKeys.map((k) => (
            <span key={k} className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40">
              {k.toUpperCase()}
            </span>
          ))}
        </div>
      );
    }
    if (q.type === "menjodohkan") {
      const pairs = q.pairs || [];
      return (
        <div className="space-y-1">
          {pairs.map((p: any) => (
            <div key={p.id} className="text-xs flex items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800/40 pb-0.5 last:border-0 text-neutral-600 dark:text-neutral-400">
              <span>{stripHtml(p.left)}</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{stripHtml(p.right)}</span>
            </div>
          ))}
        </div>
      );
    }
    if (q.type === "urutkan" || q.type === "drag_drop") {
      return (
        <div className="flex flex-wrap items-center gap-1 text-xs font-mono">
          {(q.items || []).map((it: any, idx: number) => (
            <span key={it.id || idx} className="inline-flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40 font-sans">
                {idx + 1}. {stripHtml(it.text)}
              </span>
              {idx < (q.items || []).length - 1 && <span className="text-neutral-400">→</span>}
            </span>
          ))}
        </div>
      );
    }
    if (q.type === "klasifikasi" || q.type === "matriks") {
      const stmts = q.statements || q.choices?.statements || [];
      const cats = q.type === "klasifikasi" ? q.categories || q.choices?.categories || [] : q.columns || q.choices?.columns || [];
      const catMap: Record<string, string> = {};
      if (Array.isArray(cats)) cats.forEach((c: any) => { catMap[String(c.id)] = String(c.text || c.id); });
      if (Array.isArray(stmts) && stmts.length > 0) {
        return (
          <div className="space-y-1.5 my-0.5">
            {stmts.map((st: any) => (
              <div key={st.id} className="text-xs flex items-start justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800/60 pb-1 last:border-0 last:pb-0">
                <div className="flex-1 text-neutral-500 dark:text-neutral-400">
                  <MathText content={st.text} className="inline text-xs [&_p]:inline [&_p]:m-0" />
                </div>
                <span className="px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40">
                  {stripHtml(catMap[String(st.answer)] || String(st.answer || "-")).substring(0, 25)}
                </span>
              </div>
            ))}
          </div>
        );
      }
      return "-";
    }
    if (q.type === "isian_rumpang") {
      const blanks = q.blanks || q.choices?.blanks || [];
      if (Array.isArray(blanks) && blanks.length > 0) {
        return (
          <div className="space-y-1 my-0.5">
            {blanks.map((bl: any, idx: number) => {
              const acc = Array.isArray(bl.answers) ? bl.answers : bl.answers != null ? [bl.answers] : [];
              return (
                <div key={String(bl.id ?? idx)} className="text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="font-mono">[{idx + 1}]</span>{" "}
                  <span className="font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                    {acc.map((a: any) => String(a)).join(" / ") || "-"}
                  </span>
                </div>
              );
            })}
          </div>
        );
      }
      return "-";
    }
    if (q.type === "hotspot") {
      const areas = q.areas || q.choices?.areas || [];
      const hmode = String(q.hotspotMode || q.choices?.mode || "any").toLowerCase();
      if (Array.isArray(areas) && areas.length > 0) {
        return (
          <div className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1">
            <div className="font-medium">{areas.length} area target ({hmode === "all" ? "klik semua" : "klik satu saja"})</div>
            {areas.map((ar: any, i: number) => (
              <div key={String(ar.id ?? i)} className="font-mono text-[11px]">
                Area {i + 1}{ar.label ? `: ${stripHtml(String(ar.label)).substring(0, 30)}` : ""} (x={ar.x}%, y={ar.y}%, {ar.w}%×{ar.h}%)
              </div>
            ))}
          </div>
        );
      }
      return "-";
    }
    if (q.type === "isian_singkat" || q.type === "uraian") {
      return (
        <div className="text-xs text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900/40 p-2 rounded-md border border-neutral-200/60 dark:border-neutral-800">
          <MathText content={q.answerKey || "-"} className="inline text-xs [&_p]:inline [&_p]:m-0" />
        </div>
      );
    }
    return "-";
  };

  // Filter questions according to active tab
  const filteredQuestions = useMemo(() => {
    if (!attempt) return questions;
    const overrides = attempt.overrides || (attempt.answers as any)?.__overrides__ || {};
    return questions.filter((q) => {
      const score = computeQuestionScore(q, attempt.answers?.[q.id], overrides[q.id]);
      if (filterTab === "essay") {
        return q.type === "uraian";
      }
      if (filterTab === "wrong") {
        return score !== null && score === 0;
      }
      if (filterTab === "correct") {
        return score !== null && score >= 1;
      }
      return true;
    });
  }, [questions, attempt, filterTab]);

  const fullCorrectCount = useMemo(() => {
    if (!attempt) return 0;
    return questions.filter((q) => {
      const s = getQuestionScore(q);
      return s !== null && s >= 1;
    }).length;
  }, [questions, attempt]);

  const wrongCount = useMemo(() => {
    if (!attempt) return 0;
    return questions.filter((q) => {
      const s = getQuestionScore(q);
      return s !== null && s === 0;
    }).length;
  }, [questions, attempt]);

  const partialCount = useMemo(() => {
    if (!attempt) return 0;
    return questions.filter((q) => {
      const s = getQuestionScore(q);
      return s !== null && s > 0 && s < 1;
    }).length;
  }, [questions, attempt]);

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
        <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
          <Skeleton className="h-12 w-64 rounded-lg" />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans pb-16">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">

        {/* ═══════════════════════════════════════════════════════════════
            1. TOP HEADER BAR (Simplified & Clean)
           ═══════════════════════════════════════════════════════════════ */}
        <NeonPageHeader
          bordered
          backTo={roomId ? `/admin/penilaian?roomId=${roomId}` : "/admin/penilaian"}
          title={student?.name || "Detail Penilaian Siswa"}
          badge={
            bankQuestions.length > questions.length ? (
              <NeonBadge variant="purple" mono>
                <span>🎲</span> {questions.length} Soal Teracak (dari {bankQuestions.length} Bank Soal)
              </NeonBadge>
            ) : null
          }
          meta={
            <div className="flex items-center gap-2 flex-wrap font-mono">
              <span>{(student as any)?.nisn || "-"}</span>
              <span>•</span>
              <span className="font-sans font-medium text-neutral-700 dark:text-neutral-300">{className}</span>
              <span>•</span>
              <span className="font-sans text-neutral-600 dark:text-neutral-400">
                {room?.examTitle || "Ujian"}{room?.subjectName ? ` (${room.subjectName})` : ""}
              </span>
              <span>•</span>
              <span className="font-sans text-neutral-500">
                Ruang: {room?.roomName || "-"}
              </span>
            </div>
          }
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="h-8 px-3 text-xs font-medium rounded-md border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 shadow-2xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Export PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                className="h-8 px-3 text-xs font-medium rounded-md border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 shadow-2xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Segarkan
              </Button>
              {hasEssay && (
                <Button
                  size="sm"
                  onClick={handleAutoGradeClick}
                  disabled={isAutoGrading}
                  className="h-8 px-3 text-xs font-semibold rounded-md bg-purple-600 hover:bg-purple-700 text-white shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className={cn("w-3.5 h-3.5 mr-1.5", isAutoGrading && "animate-spin")} />
                  {isAutoGrading ? "Menilai AI..." : "Auto Grade Uraian"}
                </Button>
              )}
            </>
          }
        />

        {/* ═══════════════════════════════════════════════════════════════
            2. SUMMARY SCORE CARDS (5 Metric Cards)
           ═══════════════════════════════════════════════════════════════ */}
        <NeonStatGrid cols={5}>
          <NeonStatCard
            label="Nilai Akhir"
            value={attempt ? finalScore : "-"}
            subText={hasEssay ? "60% Objektif + 40% Essay" : "100% Objektif"}
            valueClassName={
              !attempt
                ? "text-neutral-400"
                : finalScore >= 75
                ? "text-emerald-600 dark:text-emerald-400"
                : finalScore >= 50
                ? "text-amber-600 dark:text-amber-400"
                : "text-rose-600 dark:text-rose-400"
            }
          />
          <NeonStatCard
            label="Benar Penuh"
            labelClassName="text-emerald-600 dark:text-emerald-400"
            value={fullCorrectCount}
            unit={`/ ${questions.length}`}
            subText={partialCount > 0 ? `+ ${partialCount} benar sebagian` : "skor 100% tepat"}
            valueClassName="text-emerald-600 dark:text-emerald-400"
          />
          <NeonStatCard
            label="Salah"
            labelClassName="text-rose-600 dark:text-rose-400"
            value={wrongCount}
            unit={`/ ${questions.length}`}
            subText="skor 0 atau tidak dijawab"
            valueClassName="text-rose-600 dark:text-rose-400"
          />
          <NeonStatCard
            label="Objektif"
            value={objScore}
            subText={`${Number(objCorrect.toFixed(1))}/${objectiveQuestions.length} poin`}
          />
          <NeonStatCard
            label="Subjektif"
            labelClassName="text-purple-600 dark:text-purple-400"
            value={!hasEssay ? "-" : essGraded < essayQuestions.length ? `${essGraded}/${essayQuestions.length}` : essScore}
            subText={
              !hasEssay
                ? "Tidak ada soal essay"
                : essGraded < essayQuestions.length
                ? "Perlu penilaian"
                : `${essCorrect}/${essayQuestions.length} poin`
            }
            valueClassName={
              !hasEssay
                ? "text-neutral-400"
                : essGraded < essayQuestions.length
                ? "text-amber-500"
                : "text-purple-600 dark:text-purple-400"
            }
          />
        </NeonStatGrid>

        {/* ═══════════════════════════════════════════════════════════════
            3. QUESTIONS TABLE WITH STATUS BADGES & QUICK OVERRIDES
           ═══════════════════════════════════════════════════════════════ */}
        {attempt ? (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 shadow-xs overflow-hidden">
            {/* Toolbar / Header */}
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-900/60">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                  Koreksi & Pembahasan Jawaban Siswa
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Klik tombol centang atau silang pada kolom aksi untuk memperbarui nilai secara manual.
                </p>
              </div>

              {/* Filter Tabs */}
              <NeonTabs
                tabs={[
                  { id: "all", label: "Semua", count: questions.length },
                  ...(hasEssay ? [{ id: "essay", label: "Uraian", count: essayQuestions.length }] : []),
                  { id: "wrong", label: "Salah", count: wrongCount },
                  { id: "correct", label: "Benar", count: fullCorrectCount },
                ]}
                activeTab={filterTab}
                onChange={(id) => setFilterTab(id as any)}
                countFormat="parens"
                size="sm"
              />
            </div>

            {/* Questions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-850/80 text-neutral-600 dark:text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 text-center w-12">#</th>
                    <th className="py-2.5 px-3 min-w-[240px]">Pertanyaan / Soal</th>
                    <th className="py-2.5 px-3 w-24 text-center">Tipe</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Jawaban Siswa</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Kunci Jawaban</th>
                    <th className="py-2.5 px-3 w-28 text-center">Status</th>
                    <th className="py-2.5 px-3 w-24 text-right">Koreksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-transparent">
                  {filteredQuestions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-neutral-400">
                        Tidak ada butir soal yang sesuai dengan filter terpilih.
                      </td>
                    </tr>
                  ) : (
                    filteredQuestions.map((q, idx) => {
                      const qScore = getQuestionScore(q);
                      const isFullCorrect = qScore !== null && qScore >= 1;
                      const isPartialCorrect = qScore !== null && qScore > 0 && qScore < 1;
                      const isWrong = qScore !== null && qScore === 0;
                      const isEssay = q.type === "uraian";
                      const overrides = attempt.overrides || (attempt.answers as any)?.__overrides__ || {};
                      const isManuallyGraded = overrides[q.id] !== undefined;

                      const typeLabels: Record<string, string> = {
                        pilihan_ganda: "PG",
                        pilihan_ganda_kompleks: "PGK",
                        menjodohkan: "Jodoh",
                        benar_salah: "B/S",
                        isian_singkat: "Isian",
                        uraian: "Uraian",
                        urutkan: "Urut",
                        drag_drop: "D&D",
                        klasifikasi: "Klas",
                        matriks: "Matriks",
                        isian_rumpang: "Rumpang",
                        hotspot: "Hotspot",
                      };

                      const bankIdx = bankQuestions.findIndex((x) => x.id === q.id);
                      const bankNo = bankIdx !== -1 ? bankIdx + 1 : "-";
                      const originalIdx = questions.findIndex((x) => x.id === q.id) + 1;

                      return (
                        <tr
                          key={q.id}
                          className={cn(
                            "group transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40",
                            isEssay && "bg-purple-500/[0.02]"
                          )}
                        >
                          {/* Number & Bank Random Badge */}
                          <td className="py-3 px-3 text-center align-top">
                            <div className="flex flex-col items-center gap-1 font-mono">
                              <span className="font-bold text-neutral-600 dark:text-neutral-400 text-xs">
                                {originalIdx}
                              </span>
                              {bankQuestions.length > questions.length && (
                                <span
                                  className="px-1 py-0.2 rounded text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 whitespace-nowrap"
                                  title={`Soal Bank #${bankNo}`}
                                >
                                  #{bankNo}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Soal */}
                          <td className="py-3 px-3 align-top">
                            <div className="text-xs leading-relaxed text-neutral-800 dark:text-neutral-200">
                              <MathText content={q.text} className="text-xs [&_p]:m-0" />
                            </div>
                          </td>

                          {/* Tipe Soal */}
                          <td className="py-3 px-3 text-center align-top">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                              {typeLabels[q.type] || q.type}
                            </span>
                          </td>

                          {/* Jawaban Siswa */}
                          <td className="py-3 px-3 align-top">
                            {getStudentAnswer(q)}
                          </td>

                          {/* Kunci Jawaban */}
                          <td className="py-3 px-3 align-top">
                            {getCorrectAnswer(q)}
                          </td>

                          {/* Status Pill */}
                          <td className="py-3 px-3 text-center align-top">
                            {qScore === null ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                Perlu Dinilai
                              </span>
                            ) : isFullCorrect ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                                <Check className="w-3 h-3 stroke-[3]" />
                                1.0
                              </span>
                            ) : isPartialCorrect ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono">
                                ~ {Number(qScore.toFixed(2))}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-mono">
                                <X className="w-3 h-3 stroke-[3]" />
                                0.0
                              </span>
                            )}
                          </td>

                          {/* Actions / Overrides */}
                          <td className="py-3 px-3 text-right align-top">
                            <div className="inline-flex items-center gap-1 justify-end">
                              {isEssay && (
                                <button
                                  type="button"
                                  onClick={() => handleAIGradeQuestion(q.id)}
                                  disabled={aiGradingId === q.id}
                                  className={cn(
                                    "h-7 w-7 rounded-md border border-purple-200 dark:border-purple-800/60 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 flex items-center justify-center transition-colors cursor-pointer",
                                    aiGradingId === q.id && "animate-spin"
                                  )}
                                  title="Nilai dengan AI"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleGrade(q.id, true)}
                                className={cn(
                                  "h-7 w-7 rounded-md border flex items-center justify-center transition-colors cursor-pointer",
                                  isManuallyGraded && overrides[q.id]
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700"
                                )}
                                title="Tandai Benar Penuh (1.0)"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleGrade(q.id, false)}
                                className={cn(
                                  "h-7 w-7 rounded-md border flex items-center justify-center transition-colors cursor-pointer",
                                  isManuallyGraded && !overrides[q.id]
                                    ? "bg-rose-600 border-rose-600 text-white"
                                    : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-700"
                                )}
                                title="Tandai Salah (0.0)"
                              >
                                <X className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 p-12 text-center shadow-xs">
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              {terminology.student || "Siswa"} belum memulai atau mengumpulkan ujian di ruang ini.
            </p>
          </div>
        )}

        {/* Confirmation Dialog for Auto Grade Overwrite */}
        <ConfirmationDialog
          isOpen={showAutoGradeConfirm}
          onClose={() => setShowAutoGradeConfirm(false)}
          onConfirm={executeAutoGrade}
          title="Auto Grade Ulang?"
          description="Beberapa soal essay sudah pernah dinilai. Auto grade ulang akan menimpa semua penilaian sebelumnya. Lanjutkan?"
          type="warning"
          confirmLabel="Ya, Grade Ulang"
          cancelLabel="Batal"
        />

      </div>
    </div>
  );
};

export default StudentGradingDetailPage;
