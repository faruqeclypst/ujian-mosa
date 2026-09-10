import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { MathText } from "../ui/MathText";
import { useTenant } from "../../context/TenantContext";
import { useExamData } from "../../context/ExamDataContext";
import { 
  BarChart2, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Download, 
  Printer, 
  Search, 
  Users, 
  Target, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  FileSpreadsheet, 
  BookOpen,
  Sparkles,
  Info,
  HelpCircle,
  TrendingUp,
  Layers,
  Percent
} from "lucide-react";
import * as XLSX from "xlsx-js-style";
import type { QuestionType } from "../../pages/admin/QuestionsPage";

interface ItemAnalysisDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
  examId?: string;
  roomName?: string;
  examTitle?: string;
}

export interface QuestionAnalysis {
  id: string;
  index: number;
  text: string;
  imageUrl?: string;
  type: QuestionType;
  groupId?: string;
  groupText?: string;
  choices?: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }>;
  answerKey?: string;
  pairs?: Array<{ id: string; left: string; right: string }>;
  items?: Array<{ id: string; text: string }>;
  
  // Analisis Metrik
  totalAnswered: number;
  totalCorrect: number;
  difficultyIndex: number; // P (0.0 - 1.0)
  difficultyCategory: "Sukar" | "Sedang" | "Mudah";
  
  upperGroupCorrect: number;
  lowerGroupCorrect: number;
  discriminationIndex: number; // D (-1.0 - 1.0)
  discriminationCategory: "Sangat Baik" | "Baik" | "Cukup" | "Jelek" | "Negatif";
  
  verdict: "Diterima" | "Direvisi" | "Ditolak";
  recommendation: string;
  
  // Analisis Pengecoh (khusus Pilihan Ganda)
  distractors?: Array<{
    key: string;
    text: string;
    isCorrect: boolean;
    totalCount: number;
    totalPercent: number;
    upperCount: number;
    upperPercent: number;
    lowerCount: number;
    lowerPercent: number;
    status: "Kunci" | "Efektif" | "Tidak Efektif" | "Menyesatkan";
  }>;
}

const isFuzzyMatch = (studentAns: any, correctKey: string) => {
  if (typeof studentAns !== "string" || !correctKey) return false;
  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "");
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

export const ItemAnalysisDialog: React.FC<ItemAnalysisDialogProps> = ({
  isOpen,
  onClose,
  roomId,
  examId: propExamId,
  roomName: propRoomName,
  examTitle: propExamTitle,
}) => {
  const { pb, terminology } = useTenant();
  const { subjects, teachers } = useExamData();

  const [loading, setLoading] = useState(true);
  const [examMeta, setExamMeta] = useState<{
    id: string;
    title: string;
    subjectName: string;
    teacherName: string;
    roomName: string;
    totalParticipants: number;
    upperCount: number;
    lowerCount: number;
  }>({
    id: "",
    title: propExamTitle || "Ujian",
    subjectName: "-",
    teacherName: "-",
    roomName: propRoomName || "-",
    totalParticipants: 0,
    upperCount: 0,
    lowerCount: 0
  });

  const [analyzedQuestions, setAnalyzedQuestions] = useState<QuestionAnalysis[]>([]);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [showGuide, setShowGuide] = useState(false);

  const loadAnalysisData = useCallback(async () => {
    if (!pb || (!roomId && !propExamId)) return;
    setLoading(true);

    try {
      let targetExamId = propExamId || "";
      let currentRoomName = propRoomName || "Ujian";

      // 1. Fetch Room jika ada roomId
      if (roomId) {
        const roomRecord = await pb.collection("exam_rooms").getOne(roomId).catch(() => null);
        if (roomRecord) {
          targetExamId = roomRecord.examId;
          currentRoomName = roomRecord.room_name || currentRoomName;
        }
      }

      // 2. Fetch Exam
      let currentExamTitle = propExamTitle || "Ujian";
      let subjName = "-";
      let teachName = "-";

      if (targetExamId) {
        const examRecord = await pb.collection("exams").getOne(targetExamId).catch(() => null);
        if (examRecord) {
          currentExamTitle = examRecord.title || currentExamTitle;
          const s = subjects.find((sub: any) => sub.id === (examRecord.subjectId || examRecord.subjectid));
          subjName = s ? s.name : "-";
          const t = teachers.find((tc: any) => tc.id === (examRecord.teacherId || examRecord.teacherid));
          teachName = t ? t.name : "-";
        }
      }

      // 3. Fetch Questions
      const qRecords = await pb.collection("questions").getFullList({
        filter: `examId = "${targetExamId}"`,
        sort: "order,created"
      });

      const typeMapReverse: Record<string, QuestionType> = {
        multiple_choice: "pilihan_ganda",
        complex_choice: "pilihan_ganda_kompleks",
        matching: "menjodohkan",
        true_false: "benar_salah",
        short_answer: "isian_singkat",
        essay: "uraian",
        sequence: "urutkan",
        drag_drop: "drag_drop"
      };

      const groupTextMap: Record<string, string> = {};
      qRecords.forEach((q: any) => {
        const gId = q.groupId || q.group_id;
        const gTxt = q.groupText || q.group_text;
        if (gId && gTxt && !groupTextMap[gId]) {
          groupTextMap[gId] = gTxt;
        }
      });

      const questionsList = qRecords.map((q: any, idx: number) => {
        const rawType = q.field || q.type || "pilihan_ganda";
        const mappedType = (typeMapReverse[rawType] || rawType) as QuestionType;
        const options = q.options || q.choices || {};
        const gId = q.groupId || q.group_id || "";
        const gTxt = q.groupText || q.group_text || (gId ? groupTextMap[gId] || "" : "");
        const ansKey = q.correctAnswer || q.answerKey || q.correct_answer || q.answer || "";

        let choicesObj: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }> | undefined = undefined;
        if (mappedType === "pilihan_ganda" || mappedType === "pilihan_ganda_kompleks" || mappedType === "benar_salah") {
          if (options && typeof options === "object" && !Array.isArray(options)) {
            const cur: Record<string, any> = { ...options };
            if (ansKey) {
              const keys = ansKey.toLowerCase().split(/[,|; ]+/).map((s: string) => s.trim());
              Object.keys(cur).forEach(k => {
                if (cur[k]) {
                  const isCorr = cur[k].isCorrect !== undefined ? Boolean(cur[k].isCorrect) : keys.includes(k.toLowerCase());
                  cur[k] = { ...cur[k], isCorrect: isCorr };
                }
              });
            }
            choicesObj = cur;
          }
        }

        return {
          id: q.id,
          index: idx + 1,
          text: q.text || "",
          imageUrl: q.imageUrl || q.image_url || undefined,
          type: mappedType,
          groupId: gId || undefined,
          groupText: gTxt || undefined,
          choices: choicesObj,
          pairs: mappedType === "menjodohkan" ? (options.pairs || q.pairs) : undefined,
          items: (mappedType === "urutkan" || mappedType === "drag_drop") ? (options.items || q.items) : undefined,
          answerKey: ansKey || undefined,
        };
      });

      // 4. Fetch Attempts (Siswa yang mengerjakan)
      let filterQuery = roomId ? `examRoomId = "${roomId}"` : `examId = "${targetExamId}"`;
      const attempts = await pb.collection("attempts").getFullList({
        filter: filterQuery
      });

      // Filter hanya attempt yang sudah ada jawaban atau sudah submit / finished / ongoing
      const validAttempts = attempts.filter((a: any) => a.answers && typeof a.answers === "object" && Object.keys(a.answers).length > 0);

      // Hitung skor total tiap siswa untuk membagi Kelompok Atas vs Kelompok Bawah
      const evaluatedStudents: Array<{
        attemptId: string;
        studentId: string;
        totalScore: number;
        questionResults: Record<string, { isCorrect: boolean; rawAnswer: any; selectedKey?: string }>;
      }> = [];

      validAttempts.forEach((att: any) => {
        const answers = att.answers || {};
        const overrides = att.overrides || (answers as any)?.__overrides__ || {};
        let correctCount = 0;
        const qResults: Record<string, { isCorrect: boolean; rawAnswer: any; selectedKey?: string }> = {};

        questionsList.forEach((q) => {
          const rawAns = answers[q.id];
          const hasOverride = overrides[q.id] !== undefined;
          let isCorrect = false;
          let selectedKey = "-";

          if (hasOverride) {
            isCorrect = Boolean(overrides[q.id]);
            selectedKey = typeof rawAns === "string" ? rawAns.toUpperCase() : (isCorrect ? "BENAR" : "SALAH");
          } else if (rawAns !== undefined && rawAns !== null && rawAns !== "") {
            if (q.type === "pilihan_ganda" || q.type === "benar_salah") {
              selectedKey = String(rawAns).trim().toUpperCase();
              const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === selectedKey.toLowerCase());
              isCorrect = ck ? Boolean(q.choices![ck]?.isCorrect) : false;
            } else if (q.type === "pilihan_ganda_kompleks") {
              const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices![k]?.isCorrect).map(k => k.toLowerCase());
              const studentKeys = Array.isArray(rawAns) ? rawAns.map((k: string) => String(k).toLowerCase()) : [];
              isCorrect = studentKeys.length === correctKeys.length && studentKeys.every((k: string) => correctKeys.includes(k));
              selectedKey = studentKeys.map(k => k.toUpperCase()).sort().join(",");
            } else if (q.type === "isian_singkat") {
              isCorrect = isFuzzyMatch(rawAns, q.answerKey || "");
              selectedKey = String(rawAns);
            } else if (q.type === "uraian") {
              isCorrect = false; // default if not graded override
              selectedKey = String(rawAns);
            } else if (q.type === "menjodohkan") {
              const pairs = q.pairs || [];
              isCorrect = pairs.length > 0 && pairs.every((p: any) => rawAns[p.id] === p.right);
              selectedKey = isCorrect ? "BENAR" : "SALAH";
            } else if (q.type === "urutkan" || q.type === "drag_drop") {
              const co = (q.items || []).map((it: any) => it.id);
              isCorrect = Array.isArray(rawAns) && rawAns.length === co.length && rawAns.every((v: string, i: number) => v === co[i]);
              selectedKey = isCorrect ? "BENAR" : "SALAH";
            }
          }

          if (isCorrect) correctCount++;
          qResults[q.id] = { isCorrect, rawAnswer: rawAns, selectedKey };
        });

        const totalScore = questionsList.length > 0 ? (correctCount / questionsList.length) * 100 : 0;
        evaluatedStudents.push({
          attemptId: att.id,
          studentId: att.studentId,
          totalScore,
          questionResults: qResults
        });
      });

      // Urutkan siswa dari skor tertinggi ke terendah
      evaluatedStudents.sort((a, b) => b.totalScore - a.totalScore);

      const N = evaluatedStudents.length;
      // Pembagian Kelompok Atas & Bawah:
      // Jika N < 10, gunakan separuh (50%)
      // Jika N >= 10, gunakan proporsi standar 27% (atau minimal 3 siswa)
      const groupSize = N < 10 ? Math.max(1, Math.floor(N / 2)) : Math.max(2, Math.round(N * 0.27));
      const upperGroup = evaluatedStudents.slice(0, groupSize);
      const lowerGroup = evaluatedStudents.slice(N - groupSize);

      setExamMeta({
        id: targetExamId,
        title: currentExamTitle,
        subjectName: subjName,
        teacherName: teachName,
        roomName: currentRoomName,
        totalParticipants: N,
        upperCount: upperGroup.length,
        lowerCount: lowerGroup.length
      });

      // 5. Analisis Tiap Butir Soal
      const analyzed: QuestionAnalysis[] = questionsList.map((q) => {
        let totalCorrect = 0;
        let totalAnswered = 0;
        let upperCorrect = 0;
        let lowerCorrect = 0;

        // Distribusi Pilihan untuk Pilihan Ganda
        const choiceCounts: Record<string, { total: number; upper: number; lower: number }> = {};
        if (q.choices) {
          Object.keys(q.choices).forEach(k => {
            choiceCounts[k.toUpperCase()] = { total: 0, upper: 0, lower: 0 };
          });
        }

        evaluatedStudents.forEach((student) => {
          const res = student.questionResults[q.id];
          if (res) {
            totalAnswered++;
            if (res.isCorrect) totalCorrect++;

            // Hitung opsi yang dipilih jika Pilihan Ganda
            const optKey = res.selectedKey ? res.selectedKey.toUpperCase() : "";
            if (optKey && choiceCounts[optKey]) {
              choiceCounts[optKey].total++;
            }
          }
        });

        upperGroup.forEach((student) => {
          const res = student.questionResults[q.id];
          if (res?.isCorrect) upperCorrect++;
          const optKey = res?.selectedKey ? res.selectedKey.toUpperCase() : "";
          if (optKey && choiceCounts[optKey]) {
            choiceCounts[optKey].upper++;
          }
        });

        lowerGroup.forEach((student) => {
          const res = student.questionResults[q.id];
          if (res?.isCorrect) lowerCorrect++;
          const optKey = res?.selectedKey ? res.selectedKey.toUpperCase() : "";
          if (optKey && choiceCounts[optKey]) {
            choiceCounts[optKey].lower++;
          }
        });

        // Tingkat Kesukaran P = B / N
        const difficultyIndex = N > 0 ? totalCorrect / N : 0;
        let difficultyCategory: "Sukar" | "Sedang" | "Mudah" = "Sedang";
        if (difficultyIndex < 0.30) {
          difficultyCategory = "Sukar";
        } else if (difficultyIndex > 0.70) {
          difficultyCategory = "Mudah";
        }

        // Daya Pembeda D = (B_A - B_B) / n
        const nGroup = upperGroup.length || 1;
        const discriminationIndex = (upperCorrect - lowerCorrect) / nGroup;
        let discriminationCategory: "Sangat Baik" | "Baik" | "Cukup" | "Jelek" | "Negatif" = "Cukup";
        if (discriminationIndex < 0) {
          discriminationCategory = "Negatif";
        } else if (discriminationIndex < 0.20) {
          discriminationCategory = "Jelek";
        } else if (discriminationIndex < 0.30) {
          discriminationCategory = "Cukup";
        } else if (discriminationIndex < 0.40) {
          discriminationCategory = "Baik";
        } else {
          discriminationCategory = "Sangat Baik";
        }

        // Analisis Pengecoh (Distractors)
        let distractorsList: QuestionAnalysis["distractors"] = undefined;
        let hasMisleadingDistractor = false;
        let hasDeadDistractor = false;

        if (q.choices && Object.keys(q.choices).length > 0) {
          distractorsList = Object.entries(q.choices).map(([key, choiceVal]) => {
            const kUpper = key.toUpperCase();
            const counts = choiceCounts[kUpper] || { total: 0, upper: 0, lower: 0 };
            const totalPercent = N > 0 ? (counts.total / N) * 100 : 0;
            const upperPercent = upperGroup.length > 0 ? (counts.upper / upperGroup.length) * 100 : 0;
            const lowerPercent = lowerGroup.length > 0 ? (counts.lower / lowerGroup.length) * 100 : 0;
            const isCorrect = Boolean(choiceVal.isCorrect);

            let status: "Kunci" | "Efektif" | "Tidak Efektif" | "Menyesatkan" = "Efektif";

            if (isCorrect) {
              status = "Kunci";
            } else {
              // Pengecoh:
              // 1. Menyesatkan jika dipilih lebih banyak oleh kelompok atas daripada kelompok bawah
              if (counts.upper > counts.lower && counts.total >= 1) {
                status = "Menyesatkan";
                hasMisleadingDistractor = true;
              }
              // 2. Tidak efektif jika dipilih < 5% peserta
              else if (totalPercent < 5) {
                status = "Tidak Efektif";
                hasDeadDistractor = true;
              } else {
                status = "Efektif";
              }
            }

            return {
              key: kUpper,
              text: choiceVal.text || "",
              isCorrect,
              totalCount: counts.total,
              totalPercent: Math.round(totalPercent),
              upperCount: counts.upper,
              upperPercent: Math.round(upperPercent),
              lowerCount: counts.lower,
              lowerPercent: Math.round(lowerPercent),
              status
            };
          });
        }

        // Keputusan (Verdict) & Rekomendasi berdasarkan Standar Suharsimi Arikunto / Kemdikbud
        let verdict: "Diterima" | "Direvisi" | "Ditolak" = "Diterima";
        let recommendation = "";

        if (discriminationIndex < 0) {
          verdict = "Ditolak";
          recommendation = `Daya pembeda negatif (D = ${discriminationIndex.toFixed(2)}). Kelompok bawah justru lebih banyak benar dibanding kelompok atas. Mohon periksa apakah kunci jawaban salah atau butir soal memiliki tafsir ganda.`;
        } else if (discriminationIndex >= 0.30) {
          // Daya pembeda Baik / Sangat Baik (D >= 0.30)
          if (hasMisleadingDistractor) {
            verdict = "Direvisi";
            recommendation = `Daya pembeda baik (D = +${discriminationIndex.toFixed(2)}), namun ada opsi pengecoh yang lebih banyak dipilih siswa kelompok atas. Cek dan revisi opsi pengecoh tersebut.`;
          } else if (difficultyIndex > 0.85) {
            verdict = "Direvisi";
            recommendation = `Daya pembeda baik (D = +${discriminationIndex.toFixed(2)}), namun tingkat kesukaran sangat mudah (P = ${difficultyIndex.toFixed(2)}). Tepat untuk tes matrikulasi/awal, namun untuk ujian akhir disarankan ditingkatkan kesukarannya.`;
          } else if (difficultyIndex < 0.15) {
            verdict = "Direvisi";
            recommendation = `Daya pembeda baik (D = +${discriminationIndex.toFixed(2)}), namun tingkat kesukaran sangat sukar (P = ${difficultyIndex.toFixed(2)}). Perlu disederhanakan kalimat atau konsepnya.`;
          } else {
            verdict = "Diterima";
            recommendation = `Butir soal berkualitas sangat baik (D = +${discriminationIndex.toFixed(2)}, P = ${difficultyIndex.toFixed(2)}). Memiliki daya pembeda tinggi dan tingkat kesukaran proporsional. Siap disimpan di Bank Soal.`;
          }
        } else if (discriminationIndex >= 0.20) {
          // Daya pembeda Cukup (0.20 <= D < 0.30)
          verdict = "Direvisi";
          recommendation = `Daya pembeda berkategori cukup (D = +${discriminationIndex.toFixed(2)}). Butir soal dapat dipertahankan setelah merevisi redaksi soal atau pilihan opsi.`;
        } else {
          // Daya pembeda Rendah / Jelek (0.00 <= D < 0.20)
          if (difficultyIndex > 0.80) {
            verdict = "Direvisi";
            recommendation = `Soal tergolong sangat mudah (P = ${difficultyIndex.toFixed(2)}, dijawab benar ${Math.round(difficultyIndex * 100)}% siswa). Karena hampir semua siswa benar, selisih kelompok atas & bawah kecil (D = +${discriminationIndex.toFixed(2)}). Tepat untuk tes awal/matrikulasi dasar, namun untuk ujian akhir perlu ditingkatkan kesukarannya.`;
          } else if (difficultyIndex < 0.20) {
            verdict = "Direvisi";
            recommendation = `Soal tergolong sangat sukar (P = ${difficultyIndex.toFixed(2)}, hanya benar ${Math.round(difficultyIndex * 100)}% siswa), sehingga daya pembeda rendah (D = +${discriminationIndex.toFixed(2)}). Disarankan disederhanakan.`;
          } else {
            verdict = "Ditolak";
            recommendation = `Daya pembeda rendah (D = +${discriminationIndex.toFixed(2)}), butir soal tidak mampu membedakan kemampuan siswa pandai dan kurang. Disarankan diganti.`;
          }
        }

        return {
          ...q,
          totalAnswered,
          totalCorrect,
          difficultyIndex: Number(difficultyIndex.toFixed(2)),
          difficultyCategory,
          upperGroupCorrect: upperCorrect,
          lowerGroupCorrect: lowerCorrect,
          discriminationIndex: Number(discriminationIndex.toFixed(2)),
          discriminationCategory,
          verdict,
          recommendation,
          distractors: distractorsList
        };
      });

      setAnalyzedQuestions(analyzed);
    } catch (err) {
      console.error("Gagal load analisis butir soal:", err);
    } finally {
      setLoading(false);
    }
  }, [pb, roomId, propExamId, propExamTitle, propRoomName, subjects, teachers]);

  useEffect(() => {
    if (isOpen) {
      loadAnalysisData();
    } else {
      setAnalyzedQuestions([]);
      setExpandedQuestionId(null);
    }
  }, [isOpen, loadAnalysisData]);

  // Metrik Ringkasan (KPIs)
  const summaryMetrics = useMemo(() => {
    const total = analyzedQuestions.length;
    if (total === 0) return { 
      avgP: 0, 
      avgD: 0, 
      acceptedCount: 0, 
      revisedCount: 0, 
      rejectedCount: 0, 
      easyCount: 0, 
      mediumCount: 0, 
      hardCount: 0,
      goodDiscriminationCount: 0,
      moderateDiscriminationCount: 0,
      lowDiscriminationCount: 0
    };

    const sumP = analyzedQuestions.reduce((acc, q) => acc + q.difficultyIndex, 0);
    const sumD = analyzedQuestions.reduce((acc, q) => acc + q.discriminationIndex, 0);

    const acceptedCount = analyzedQuestions.filter(q => q.verdict === "Diterima").length;
    const revisedCount = analyzedQuestions.filter(q => q.verdict === "Direvisi").length;
    const rejectedCount = analyzedQuestions.filter(q => q.verdict === "Ditolak").length;

    const easyCount = analyzedQuestions.filter(q => q.difficultyCategory === "Mudah").length;
    const mediumCount = analyzedQuestions.filter(q => q.difficultyCategory === "Sedang").length;
    const hardCount = analyzedQuestions.filter(q => q.difficultyCategory === "Sukar").length;

    const goodDiscriminationCount = analyzedQuestions.filter(q => q.discriminationIndex >= 0.30).length;
    const moderateDiscriminationCount = analyzedQuestions.filter(q => q.discriminationIndex >= 0.20 && q.discriminationIndex < 0.30).length;
    const lowDiscriminationCount = analyzedQuestions.filter(q => q.discriminationIndex < 0.20).length;

    return {
      avgP: Number((sumP / total).toFixed(2)),
      avgD: Number((sumD / total).toFixed(2)),
      acceptedCount,
      revisedCount,
      rejectedCount,
      easyCount,
      mediumCount,
      hardCount,
      goodDiscriminationCount,
      moderateDiscriminationCount,
      lowDiscriminationCount
    };
  }, [analyzedQuestions]);

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return analyzedQuestions.filter(q => {
      // Type Filter
      if (typeFilter !== "all" && q.type !== typeFilter) return false;

      // Verdict Filter
      if (verdictFilter === "accepted" && q.verdict !== "Diterima") return false;
      if (verdictFilter === "revised" && q.verdict !== "Direvisi") return false;
      if (verdictFilter === "rejected" && q.verdict !== "Ditolak") return false;
      if (verdictFilter === "hard" && q.difficultyCategory !== "Sukar") return false;
      if (verdictFilter === "easy" && q.difficultyCategory !== "Mudah") return false;

      // Search Query
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        String(q.index).includes(query) ||
        q.text.toLowerCase().includes(query) ||
        (q.groupText || "").toLowerCase().includes(query) ||
        (q.groupId || "").toLowerCase().includes(query)
      );
    });
  }, [analyzedQuestions, typeFilter, verdictFilter, searchQuery]);

  // Ekspor Excel Lengkap Berformat Styling
  const handleExportExcel = () => {
    if (analyzedQuestions.length === 0) return;

    const wb = XLSX.utils.book_new();

    // Palet Warna & Gaya Header
    const STYLES = {
      header: {
        fill: { fgColor: { rgb: "2563EB" } },
        font: { color: { rgb: "FFFFFF" }, bold: true, sz: 10 },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      title: {
        font: { bold: true, sz: 14, color: { rgb: "1E293B" } }
      },
      cell: {
        alignment: { vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      cellCenter: {
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      accepted: {
        fill: { patternType: "solid", fgColor: { rgb: "DCFCE7" } },
        font: { color: { rgb: "16A34A" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      revised: {
        fill: { patternType: "solid", fgColor: { rgb: "FEF3C7" } },
        font: { color: { rgb: "D97706" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      rejected: {
        fill: { patternType: "solid", fgColor: { rgb: "FEE2E2" } },
        font: { color: { rgb: "DC2626" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      }
    };

    // Sheet 1: Analisis Butir Soal Utama
    const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, "").trim();

    const mainHeader = [
      "No",
      "Tipe Soal",
      "Paket Literasi",
      "Teks Butir Soal",
      "Kunci",
      "Jumlah Benar",
      "Tingkat Kesukaran (P)",
      "Kategori Kesukaran",
      "Benar Kel. Atas",
      "Benar Kel. Bawah",
      "Daya Pembeda (D)",
      "Kategori Daya Pembeda",
      "Keputusan",
      "Catatan Rekomendasi"
    ];

    const mainRows: any[][] = [
      [{ v: `ANALISIS BUTIR SOAL & DAYA PEMBEDA: ${examMeta.title}`, s: STYLES.title }],
      [{ v: `Mata Pelajaran: ${examMeta.subjectName} | Guru: ${examMeta.teacherName} | Peserta: ${examMeta.totalParticipants} Siswa`, s: { font: { italic: true, sz: 10 } } }],
      [{ v: `Kelompok Atas (27%): ${examMeta.upperCount} Siswa | Kelompok Bawah (27%): ${examMeta.lowerCount} Siswa`, s: { font: { italic: true, sz: 10 } } }],
      [],
      mainHeader.map(h => ({ v: h, s: STYLES.header }))
    ];

    analyzedQuestions.forEach((q) => {
      let vStyle = STYLES.accepted;
      if (q.verdict === "Direvisi") vStyle = STYLES.revised;
      if (q.verdict === "Ditolak") vStyle = STYLES.rejected;

      mainRows.push([
        { v: q.index, s: STYLES.cellCenter },
        { v: q.type.toUpperCase(), s: STYLES.cellCenter },
        { v: q.groupId || "-", s: STYLES.cellCenter },
        { v: stripHtml(q.text).slice(0, 200), s: STYLES.cell },
        { v: q.answerKey || "-", s: STYLES.cellCenter },
        { v: `${q.totalCorrect}/${q.totalAnswered}`, s: STYLES.cellCenter },
        { v: q.difficultyIndex, s: STYLES.cellCenter },
        { v: q.difficultyCategory, s: STYLES.cellCenter },
        { v: q.upperGroupCorrect, s: STYLES.cellCenter },
        { v: q.lowerGroupCorrect, s: STYLES.cellCenter },
        { v: q.discriminationIndex, s: STYLES.cellCenter },
        { v: q.discriminationCategory, s: STYLES.cellCenter },
        { v: q.verdict, s: vStyle },
        { v: q.recommendation, s: STYLES.cell }
      ]);
    });

    const wsMain = XLSX.utils.aoa_to_sheet(mainRows);
    wsMain["!cols"] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 16 },
      { wch: 45 },
      { wch: 10 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 14 },
      { wch: 50 }
    ];
    XLSX.utils.book_append_sheet(wb, wsMain, "Analisis Butir Soal");

    // Sheet 2: Analisis Pengecoh (Distractors)
    const distHeader = [
      "No Soal",
      "Opsi",
      "Teks Pilihan",
      "Status",
      "Total Pemilih",
      "Persentase (%)",
      "Pemilih Kel. Atas",
      "Pemilih Kel. Bawah",
      "Efektivitas Pengecoh"
    ];

    const distRows: any[][] = [
      [{ v: `ANALISIS DISTRIBUSI PENGECOH (DISTRACTOR ANALYSIS)`, s: STYLES.title }],
      [{ v: `Kriteria Pengecoh Baik: Dipilih >= 5% siswa & lebih banyak dipilih Kelompok Bawah daripada Kelompok Atas.`, s: { font: { italic: true, sz: 10 } } }],
      [],
      distHeader.map(h => ({ v: h, s: STYLES.header }))
    ];

    analyzedQuestions.forEach((q) => {
      if (q.distractors && q.distractors.length > 0) {
        q.distractors.forEach((d) => {
          distRows.push([
            { v: q.index, s: STYLES.cellCenter },
            { v: d.key, s: STYLES.cellCenter },
            { v: stripHtml(d.text).slice(0, 100), s: STYLES.cell },
            { v: d.isCorrect ? "KUNCI JAWABAN" : "PENGECOH", s: d.isCorrect ? STYLES.accepted : STYLES.cellCenter },
            { v: d.totalCount, s: STYLES.cellCenter },
            { v: `${d.totalPercent}%`, s: STYLES.cellCenter },
            { v: `${d.upperCount} (${d.upperPercent}%)`, s: STYLES.cellCenter },
            { v: `${d.lowerCount} (${d.lowerPercent}%)`, s: STYLES.cellCenter },
            { v: d.status, s: d.status === "Efektif" || d.status === "Kunci" ? STYLES.accepted : (d.status === "Menyesatkan" ? STYLES.rejected : STYLES.revised) }
          ]);
        });
      }
    });

    const wsDist = XLSX.utils.aoa_to_sheet(distRows);
    wsDist["!cols"] = [
      { wch: 8 },
      { wch: 8 },
      { wch: 35 },
      { wch: 18 },
      { wch: 14 },
      { wch: 15 },
      { wch: 20 },
      { wch: 20 },
      { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDist, "Analisis Pengecoh");

    // Simpan file
    const cleanTitle = examMeta.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    XLSX.writeFile(wb, `Analisis_Butir_Soal_${cleanTitle}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Header Dialog */}
        <DialogHeader className="p-5 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 shadow-xs">
                <BarChart2 className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  Analisis Butir Soal & Daya Pembeda
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 text-[10px] uppercase font-bold">
                    Item Analysis
                  </Badge>
                </DialogTitle>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{examMeta.title}</span>
                  <span>•</span>
                  <span>{examMeta.subjectName}</span>
                  <span>•</span>
                  <span>{examMeta.totalParticipants} Peserta Terdaftar</span>
                  <span>•</span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">Kelompok U/L: {examMeta.upperCount} Siswa</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowGuide(prev => !prev)}
                className={`h-9 px-3 rounded-xl text-xs font-semibold gap-1.5 transition-colors ${
                  showGuide 
                    ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700" 
                    : "bg-blue-50/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100"
                }`}
                title="Panduan Cara Hitung & Interpretasi Psikometri"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Panduan & Rumus</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadAnalysisData}
                disabled={loading}
                className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5"
                title="Muat Ulang Data"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5 hidden md:flex"
                title="Cetak Laporan"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleExportExcel}
                disabled={loading || analyzedQuestions.length === 0}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 gap-1.5"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Ekspor Excel Lengkap</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* PANDUAN CARA HITUNG (COLLAPSIBLE) */}
          {showGuide && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 border border-blue-200 dark:border-blue-800 shadow-md space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 dark:border-blue-800/60">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      Panduan Analisis Butir Soal dalam Paradigma Kurikulum Merdeka & Kemendikdasmen
                      <Badge className="bg-indigo-600 text-white text-[9px] font-bold">Deep Learning</Badge>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Mengintegrasikan psikometri klasik dengan prinsip <em>Mindful, Meaningful, & Joyful Learning</em>.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGuide(false)}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                >
                  Tutup Panduan ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {/* 1. Tingkat Kesukaran & Asesmen Awal */}
                <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <Percent className="h-4 w-4" /> 1. Tingkat Kesukaran (P = B / N)
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Menghitung proporsi siswa yang menjawab benar: <strong>P = {summaryMetrics.avgP}</strong> (dari {examMeta.totalParticipants} peserta).
                  </p>
                  <div className="space-y-1 text-[10px] text-slate-500 border-t pt-1.5 border-slate-100 dark:border-slate-700">
                    <div>• <strong>P &gt; 0.70 (Mudah)</strong>: Ideal untuk <em>Asesmen Awal / Matrikulasi</em> guna memastikan kompetensi fondasional tuntas.</div>
                    <div>• <strong>0.30 ≤ P ≤ 0.70 (Sedang)</strong>: Ideal untuk <em>Asesmen Sumatif Capaian Pembelajaran (CP)</em>.</div>
                    <div>• <strong>P &lt; 0.30 (Sukar)</strong>: Soal tantangan bernalar tinggi (HOTS / Pemecahan Masalah Kompleks).</div>
                  </div>
                </div>

                {/* 2. Daya Pembeda & Pembelajaran Mendalam */}
                <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" /> 2. Daya Pembeda [ D = (Bₐ - Bᵦ) / n ]
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Membandingkan 27% siswa nilai tertinggi (Kel. Atas = {examMeta.upperCount} siswa) vs 27% siswa nilai terendah (Kel. Bawah = {examMeta.lowerCount} siswa).
                  </p>
                  <div className="space-y-1 text-[10px] text-slate-500 border-t pt-1.5 border-slate-100 dark:border-slate-700">
                    <div>• <strong>D ≥ 0.30 (Baik / Sangat Baik)</strong>: Efektif mengukur <em>Deep Understanding</em> (pemahaman mendalam) vs <em>Surface Learning</em>.</div>
                    <div>• <strong>0.20 ≤ D &lt; 0.30 (Cukup)</strong>: Perlu penyempurnaan stimulus konteks atau opsi.</div>
                    <div>• <strong>D &lt; 0.20 (Rendah)</strong>: Pada soal dasar wajar karena semua siswa bisa; pada soal sumatif perlu ditingkatkan daya nalarnya.</div>
                    <div>• <strong>D &lt; 0 (Negatif)</strong>: Indikasi kunci jawaban salah / ambigu.</div>
                  </div>
                </div>

                {/* 3. Refleksi Asesmen Diagnostik vs Sumatif */}
                <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" /> 3. Refleksi Diferensiasi Pembelajaran
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Di <strong>Kurikulum Merdeka</strong>, hasil analisis butir bukan untuk melabeli siswa, melainkan sebagai <em>Umpan Balik Guru</em> (Teaching at the Right Level):
                  </p>
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[10px] text-blue-800 dark:text-blue-300 font-medium space-y-1">
                    <div>🎯 <strong>Untuk Matrikulasi</strong>: Soal mudah (P &gt; 0.85, D rendah) membuktikan fondasi literasi/numerasi sudah dikuasai mayoritas siswa.</div>
                    <div>🚀 <strong>Untuk Sumatif</strong>: Gunakan soal berbasis wacana kontekstual agar daya nalar kritis siswa terpetakan optimal.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
              <Skeleton className="h-80 w-full rounded-2xl" />
            </div>
          ) : examMeta.totalParticipants === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
              <div className="p-4 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 mx-auto w-fit">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Belum Ada Jawaban Siswa</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Analisis butir soal dan daya pembeda memerlukan data jawaban dari siswa yang telah mengikuti ujian di ruang ini.
              </p>
            </div>
          ) : (
            <>
              {/* SUMMARY STATS / KPI CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Tingkat Kesukaran Rata-rata */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tingkat Kesukaran (P)</span>
                    <Percent className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{summaryMetrics.avgP}</span>
                    <Badge variant="outline" className={`text-[10px] font-bold ${summaryMetrics.avgP >= 0.3 && summaryMetrics.avgP <= 0.7 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {summaryMetrics.avgP < 0.3 ? "Sukar" : summaryMetrics.avgP > 0.7 ? "Mudah" : "Ideal (Sedang)"}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {summaryMetrics.easyCount} Mudah · {summaryMetrics.mediumCount} Sedang · {summaryMetrics.hardCount} Sukar
                  </p>
                </div>

                {/* Daya Pembeda Rata-rata */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Daya Pembeda (D)</span>
                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">+{summaryMetrics.avgD}</span>
                    <Badge variant="outline" className={`text-[10px] font-bold ${summaryMetrics.avgD >= 0.3 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                      {summaryMetrics.avgD >= 0.4 ? "Sangat Baik" : summaryMetrics.avgD >= 0.3 ? "Baik" : summaryMetrics.avgD >= 0.2 ? "Cukup" : "Rendah"}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {summaryMetrics.goodDiscriminationCount} Soal Berdaya Beda Baik (D ≥ 0.30)
                  </p>
                </div>

                {/* Butir Soal Diterima */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kualitas Soal Baik</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{summaryMetrics.acceptedCount}</span>
                    <span className="text-xs font-semibold text-slate-400">/ {analyzedQuestions.length} Butir</span>
                  </div>
                  <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-semibold">
                    {Math.round((summaryMetrics.acceptedCount / (analyzedQuestions.length || 1)) * 100)}% Soal Sangat Layak Pakai
                  </p>
                </div>

                {/* Perlu Revisi / Ditolak */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Perlu Penyesuaian</span>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{summaryMetrics.revisedCount + summaryMetrics.rejectedCount}</span>
                    <span className="text-xs font-semibold text-slate-400">Butir</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {summaryMetrics.revisedCount} Perlu Revisi · {summaryMetrics.rejectedCount} Ditolak / Cek Kunci
                  </p>
                </div>
              </div>

              {/* FILTER & SEARCH BAR */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nomor, teks soal, wacana..."
                    className="pl-9 h-9 text-xs rounded-xl border-slate-200 dark:border-slate-800"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  {/* Filter Status */}
                  <select
                    value={verdictFilter}
                    onChange={(e) => setVerdictFilter(e.target.value)}
                    className="h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">Semua Rekomendasi</option>
                    <option value="accepted">🟢 Diterima (Layak)</option>
                    <option value="revised">🟡 Perlu Revisi</option>
                    <option value="rejected">🔴 Ditolak / Kunci Salah</option>
                    <option value="hard">⚡ Terlalu Sukar (P &lt; 0.30)</option>
                    <option value="easy">🎈 Terlalu Mudah (P &gt; 0.70)</option>
                  </select>

                  {/* Filter Tipe */}
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">Semua Tipe Soal</option>
                    <option value="pilihan_ganda">Pilihan Ganda</option>
                    <option value="pilihan_ganda_kompleks">PG Kompleks</option>
                    <option value="menjodohkan">Menjodohkan</option>
                    <option value="isian_singkat">Isian Singkat</option>
                    <option value="uraian">Uraian</option>
                    <option value="urutkan">Urutkan</option>
                  </select>
                </div>
              </div>

              {/* DAFTAR BUTIR SOAL & TABEL ANALISIS */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center justify-between">
                  <span>Daftar Analisis Butir Soal ({filteredQuestions.length} Soal Ditampilkan)</span>
                  <span className="text-[11px] font-normal text-slate-400">Klik butir soal untuk membuka rincian distribusi pilihan & pengecoh</span>
                </div>

                {filteredQuestions.length === 0 ? (
                  <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                    Tidak ada butir soal yang sesuai filter pencarian.
                  </div>
                ) : (
                  filteredQuestions.map((q) => {
                    const isExpanded = expandedQuestionId === q.id;

                    return (
                      <div
                        key={q.id}
                        className={`rounded-2xl border transition-all overflow-hidden bg-white dark:bg-slate-900 ${
                          isExpanded 
                            ? "border-blue-400 dark:border-blue-700 shadow-md ring-2 ring-blue-400/10" 
                            : "border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        {/* Row Summary Header */}
                        <div
                          onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                          className="p-3.5 sm:p-4 cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 select-none"
                        >
                          {/* Left: No & Text */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-xs text-slate-700 dark:text-slate-200 shrink-0 mt-0.5">
                              {q.index}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-[9px] font-bold uppercase py-0.5 px-1.5">
                                  {q.type}
                                </Badge>
                                {q.groupId && (
                                  <Badge className="bg-amber-500 text-white text-[9px] font-bold py-0.5 px-1.5">
                                    Literasi: {q.groupId}
                                  </Badge>
                                )}
                                {q.answerKey && (
                                  <span className="text-[11px] font-bold text-slate-500">
                                    Kunci: <span className="text-emerald-600 dark:text-emerald-400 uppercase">{q.answerKey}</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-800 dark:text-slate-200 font-serif line-clamp-2 leading-relaxed">
                                <MathText content={q.text} />
                              </div>
                            </div>
                          </div>

                          {/* Right: Metrics & Verdict */}
                          <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                            {/* Tingkat Kesukaran */}
                            <div className="text-center min-w-[70px]">
                              <span className="text-[10px] text-slate-400 block">Kesukaran (P)</span>
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{q.difficultyIndex}</span>
                                <Badge variant="outline" className={`text-[8px] font-bold px-1 py-0 ${
                                  q.difficultyCategory === "Sukar" 
                                    ? "bg-rose-50 text-rose-700 border-rose-200" 
                                    : q.difficultyCategory === "Mudah" 
                                      ? "bg-sky-50 text-sky-700 border-sky-200" 
                                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}>
                                  {q.difficultyCategory}
                                </Badge>
                              </div>
                            </div>

                            {/* Daya Pembeda */}
                            <div className="text-center min-w-[70px]">
                              <span className="text-[10px] text-slate-400 block">Daya Beda (D)</span>
                              <div className="flex items-center justify-center gap-1">
                                <span className={`text-xs font-bold ${q.discriminationIndex < 0.2 ? "text-rose-600" : "text-emerald-600"}`}>
                                  {q.discriminationIndex > 0 ? `+${q.discriminationIndex}` : q.discriminationIndex}
                                </span>
                                <Badge variant="outline" className={`text-[8px] font-bold px-1 py-0 ${
                                  q.discriminationCategory === "Sangat Baik" || q.discriminationCategory === "Baik"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : q.discriminationCategory === "Cukup"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}>
                                  {q.discriminationCategory}
                                </Badge>
                              </div>
                            </div>

                            {/* Verdict Badge */}
                            <div className="min-w-[85px] text-right">
                              {q.verdict === "Diterima" && (
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Diterima
                                </Badge>
                              )}
                              {q.verdict === "Direvisi" && (
                                <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Direvisi
                                </Badge>
                              )}
                              {q.verdict === "Ditolak" && (
                                <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Ditolak
                                </Badge>
                              )}
                            </div>

                            <div className="p-1 text-slate-400">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Detail Panel */}
                        {isExpanded && (
                          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                            {/* Wacana Stimulus (jika ada) */}
                            {q.groupText && (
                              <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                                <div className="font-bold text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                  <BookOpen className="h-3 w-3" />
                                  Teks Stimulus Wacana ({q.groupId}):
                                </div>
                                <div className="font-serif leading-relaxed text-xs">
                                  <MathText content={q.groupText} />
                                </div>
                              </div>
                            )}

                            {/* Full Question Text */}
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Teks Soal Lengkap:</span>
                              <div className="text-sm font-serif leading-relaxed text-slate-800 dark:text-slate-100">
                                <MathText content={q.text} />
                              </div>
                              {q.imageUrl && (
                                <img src={q.imageUrl} alt="soal" className="max-h-40 rounded-lg border border-slate-200 object-contain mt-2" />
                              )}
                            </div>

                            {/* Komparasi Kelompok Atas vs Kelompok Bawah */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Kelompok Atas */}
                              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1">
                                    <Users className="h-3 w-3" /> Kelompok Atas ({examMeta.upperCount} Siswa)
                                  </span>
                                  <span className="text-xs font-black text-blue-700 dark:text-blue-300">
                                    {q.upperGroupCorrect} Benar ({examMeta.upperCount > 0 ? Math.round((q.upperGroupCorrect / examMeta.upperCount) * 100) : 0}%)
                                  </span>
                                </div>
                                <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full" style={{ width: `${examMeta.upperCount > 0 ? (q.upperGroupCorrect / examMeta.upperCount) * 100 : 0}%` }} />
                                </div>
                              </div>

                              {/* Kelompok Bawah */}
                              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                                    <Users className="h-3 w-3" /> Kelompok Bawah ({examMeta.lowerCount} Siswa)
                                  </span>
                                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                                    {q.lowerGroupCorrect} Benar ({examMeta.lowerCount > 0 ? Math.round((q.lowerGroupCorrect / examMeta.lowerCount) * 100) : 0}%)
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-slate-600 h-full rounded-full" style={{ width: `${examMeta.lowerCount > 0 ? (q.lowerGroupCorrect / examMeta.lowerCount) * 100 : 0}%` }} />
                                </div>
                              </div>
                            </div>

                            {/* Distractor Analysis Table (jika Pilihan Ganda) */}
                            {q.distractors && q.distractors.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                  <Target className="h-3.5 w-3.5 text-blue-500" />
                                  Analisis Efektivitas Pilihan Pengecoh (Distractor Analysis):
                                </span>
                                
                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                                      <tr>
                                        <th className="p-2.5 pl-3">Opsi</th>
                                        <th className="p-2.5">Isi Pilihan</th>
                                        <th className="p-2.5 text-center">Total Pemilih</th>
                                        <th className="p-2.5 text-center">Kel. Atas</th>
                                        <th className="p-2.5 text-center">Kel. Bawah</th>
                                        <th className="p-2.5 text-center">Status Pengecoh</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {q.distractors.map((d) => (
                                        <tr key={d.key} className={d.isCorrect ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}>
                                          <td className="p-2.5 pl-3 font-black">
                                            <span className={`px-2 py-0.5 rounded-md ${d.isCorrect ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"}`}>
                                              {d.key}
                                            </span>
                                          </td>
                                          <td className="p-2.5 font-serif text-slate-700 dark:text-slate-300">
                                            <MathText content={d.text} className="inline" />
                                          </td>
                                          <td className="p-2.5 text-center font-bold">
                                            {d.totalCount} ({d.totalPercent}%)
                                            <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-1 mx-auto mt-1 overflow-hidden">
                                              <div className={`h-full ${d.isCorrect ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${d.totalPercent}%` }} />
                                            </div>
                                          </td>
                                          <td className="p-2.5 text-center text-slate-600 dark:text-slate-400">
                                            {d.upperCount} ({d.upperPercent}%)
                                          </td>
                                          <td className="p-2.5 text-center text-slate-600 dark:text-slate-400">
                                            {d.lowerCount} ({d.lowerPercent}%)
                                          </td>
                                          <td className="p-2.5 text-center">
                                            {d.status === "Kunci" && (
                                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[9px] font-bold">
                                                Kunci Jawaban
                                              </Badge>
                                            )}
                                            {d.status === "Efektif" && (
                                              <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 text-[9px] font-semibold">
                                                🟢 Berfungsi Baik
                                              </Badge>
                                            )}
                                            {d.status === "Tidak Efektif" && (
                                              <Badge variant="outline" className="bg-slate-50 text-slate-500 dark:bg-slate-800 text-[9px]">
                                                ⚠️ Mati (&lt; 5%)
                                              </Badge>
                                            )}
                                            {d.status === "Menyesatkan" && (
                                              <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 text-[9px] font-bold">
                                                🚩 Menyesatkan (Atas &gt; Bawah)
                                              </Badge>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Naratif Rekomendasi Guru */}
                            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                              <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                              <div>
                                <strong>Rekomendasi Ahli Evaluasi:</strong> {q.recommendation}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2 flex-wrap">
            <Info className="h-4 w-4 text-blue-500 shrink-0" />
            <span className="text-[11px]">
              Rumus: <strong>P = B / N</strong> (Tingkat Kesukaran) · <strong>D = (Bₐ - Bᵦ) / n</strong> (Daya Pembeda 27% Kelompok Atas/Bawah)
            </span>
          </div>
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl text-xs">
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ItemAnalysisDialog;
