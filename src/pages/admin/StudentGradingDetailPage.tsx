import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles, CheckCircle2, X, RefreshCw, FileText } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";
import { MathText } from "../../components/MathText";
import { useTenant } from "../../context/TenantContext";
import { useExamData } from "../../context/ExamDataContext";
import { useToast } from "../../components/ui/toast";
import { gradeEssayWithAI } from "../../lib/ai";
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog";

// Strip HTML tags for clean text display
const stripHtml = (html: string): string => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
};

const isFuzzyMatch = (studentAns: any, correctKey: string) => {
  if (typeof studentAns !== "string" || !correctKey) return false;
  // Strip HTML tags first, then normalize
  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '');
  const sAns = stripHtml(studentAns).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const cKey = stripHtml(correctKey).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (sAns === cKey) return true;
  if (!sAns || !cKey) return false;
  // If one contains the other, consider it correct
  if (sAns.includes(cKey) || cKey.includes(sAns)) return true;
  if (cKey.length < 3) return sAns === cKey;
  const distance = (a: string, b: string) => {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) { for (let i = 1; i <= a.length; i++) { const cost = a[i - 1] === b[j - 1] ? 0 : 1; matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + cost); } }
    return matrix[b.length][a.length];
  };
  const dist = distance(sAns, cKey);
  const maxLen = Math.max(sAns.length, cKey.length);
  const maxAllowed = maxLen > 10 ? 3 : (maxLen > 6 ? 2 : (maxLen >= 4 ? 1 : 0));
  return dist <= maxAllowed;
};

const StudentGradingDetailPage = () => {
  const navigate = useNavigate();
  const { studentId } = useParams<{ studentId: string }>();
  const { pb, terminology } = useTenant();
  const { classes: examClasses, students } = useExamData();
  const { addToast } = useToast();

  const [roomId] = useState<string | null>(() => sessionStorage.getItem("activeGradingRoomId") || sessionStorage.getItem("activeMonitoringRoomId"));
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [attempt, setAttempt] = useState<any>(null);
  const [aiGradingId, setAiGradingId] = useState<string | null>(null);

  const student = students.find(s => s.id === studentId);
  const className = student ? (examClasses.find(c => c.id === student.classId)?.name || "-") : "-";

  useEffect(() => {
    if (!roomId || !studentId) { navigate("/admin/penilaian", { replace: true }); return; }
    loadData();
  }, [roomId, studentId]);

  const loadData = useCallback(async () => {
    if (!pb || !roomId || !studentId) return;
    setLoading(true);
    try {
      const roomRecord = await pb.collection("exam_rooms").getOne(roomId);
      const examObj = await pb.collection("exams").getOne(roomRecord.examId).catch(() => null);
      let subjectName = "";
      if (examObj?.subjectId) {
        const subjectObj = await pb.collection("subjects").getOne(examObj.subjectId).catch(() => null);
        subjectName = subjectObj?.name || "";
      }
      setRoom({ ...roomRecord, examTitle: examObj?.title || "Ujian", examId: roomRecord.examId, subjectName, roomName: roomRecord.room_name || (roomRecord as any).title || roomRecord.title || "" });

      const qList = await pb.collection("questions").getFullList({ filter: `examId = "${roomRecord.examId}"`, sort: "order,created" });
      const typeMap: Record<string, string> = { multiple_choice: "pilihan_ganda", complex_choice: "pilihan_ganda_kompleks", matching: "menjodohkan", true_false: "benar_salah", short_answer: "isian_singkat", essay: "uraian", sequence: "urutkan", drag_drop: "drag_drop" };
      const mapped = qList.map(q => {
        const t = typeMap[q.field || q.type] || q.field || q.type || "pilihan_ganda";
        const opts = q.options || {};
        return { ...q, type: t, choices: opts, pairs: t === "menjodohkan" ? opts.pairs : undefined, items: (t === "urutkan" || t === "drag_drop") ? opts.items : undefined, answerKey: q.correctAnswer || q.answerKey };
      });
      setQuestions(mapped.sort((a: any, b: any) => {
        const aIsEssay = a.type === "isian_singkat" || a.type === "uraian";
        const bIsEssay = b.type === "isian_singkat" || b.type === "uraian";
        if (aIsEssay && !bIsEssay) return 1;
        if (!aIsEssay && bIsEssay) return -1;
        return 0;
      }));

      const attList = await pb.collection("attempts").getFullList({ filter: `examRoomId = "${roomId}" && studentId = "${studentId}"` });
      setAttempt(attList.length > 0 ? attList[0] : null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pb, roomId, studentId]);

  const objectiveQuestions = questions.filter(q => q.type !== "isian_singkat" && q.type !== "uraian");
  const essayQuestions = questions.filter(q => q.type === "isian_singkat" || q.type === "uraian");
  const hasEssay = essayQuestions.length > 0;

  const getScoreBreakdown = () => {
    if (!attempt) return { objScore: 0, essScore: 0, finalScore: 0, objCorrect: 0, essCorrect: 0, essGraded: 0 };
    const answers = attempt.answers || {};
    const overrides = attempt.overrides || (answers as any)?.__overrides__ || {};

    let objCorrect = 0;
    objectiveQuestions.forEach(q => {
      let ic = false;
      if (overrides[q.id] !== undefined) { ic = overrides[q.id]; }
      else {
        const a = answers[q.id]; if (!a) return;
        const t = q.type;
        if (t === "pilihan_ganda" || t === "benar_salah") { const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(a).toLowerCase()); ic = ck ? q.choices[ck].isCorrect === true : false; }
        else if (t === "pilihan_ganda_kompleks") { const ck = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase()); const sk = Array.isArray(a) ? a.map((k: any) => String(k).toLowerCase()) : []; ic = sk.length === ck.length && sk.every((k: any) => ck.includes(k)); }
        else if (t === "menjodohkan") { const pairs = q.pairs || []; ic = pairs.length > 0 && pairs.every((p: any) => a[p.id] === p.right); }
        else if (t === "urutkan" || t === "drag_drop") { const co = (q.items || []).map((it: any) => it.id); ic = Array.isArray(a) && a.length === co.length && a.every((v: any, i: number) => v === co[i]); }
      }
      if (ic) objCorrect++;
    });

    let essCorrect = 0, essGraded = 0;
    essayQuestions.forEach(q => {
      if (overrides[q.id] !== undefined) { essGraded++; if (overrides[q.id]) essCorrect++; }
      else if (q.type === "isian_singkat" && answers[q.id]) { essGraded++; if (isFuzzyMatch(answers[q.id], q.answerKey)) essCorrect++; }
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

    // Calculate new scores to save in DB
    let objCorrect = 0;
    objectiveQuestions.forEach(q => {
      let ic = false;
      if (newOverrides[q.id] !== undefined) { ic = newOverrides[q.id]; }
      else {
        const a = answers[q.id]; if (!a) return;
        const t = q.type;
        if (t === "pilihan_ganda" || t === "benar_salah") { const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(a).toLowerCase()); ic = ck ? q.choices[ck].isCorrect === true : false; }
        else if (t === "pilihan_ganda_kompleks") { const ck = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase()); const sk = Array.isArray(a) ? a.map((k: any) => String(k).toLowerCase()) : []; ic = sk.length === ck.length && sk.every((k: any) => ck.includes(k)); }
        else if (t === "menjodohkan") { const pairs = q.pairs || []; ic = pairs.length > 0 && pairs.every((p: any) => a[p.id] === p.right); }
        else if (t === "urutkan" || t === "drag_drop") { const co = (q.items || []).map((it: any) => it.id); ic = Array.isArray(a) && a.length === co.length && a.every((v: any, i: number) => v === co[i]); }
      }
      if (ic) objCorrect++;
    });

    let essCorrect = 0, essGraded = 0;
    essayQuestions.forEach(q => {
      if (newOverrides[q.id] !== undefined) { essGraded++; if (newOverrides[q.id]) essCorrect++; }
      else if (q.type === "isian_singkat" && answers[q.id]) { essGraded++; if (isFuzzyMatch(answers[q.id], q.answerKey)) essCorrect++; }
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
        essayGraded: essGraded
      }
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
        score: finalScore
      };
      await pb.collection("attempts").update(attempt.id, updatePayload);
      setAttempt((prev: any) => prev ? { ...prev, ...updatePayload } : prev);
    } catch (e) { console.error(e); }
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
              essayGraded: essGraded
            }
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
            score: finalScore
          };
          await pb.collection("attempts").update(attempt.id, updatePayload);
          setAttempt((prev: any) => prev ? { ...prev, ...updatePayload } : prev);
          console.log("Automatically synchronized grading scores in PocketBase.");
        } catch (e) {
          console.error("Failed to auto-sync scores in DB:", e);
        }
      };
      syncDB();
    }
  }, [attempt, questions, loading, pb]);

  const handleAIGradeQuestion = async (qId: string) => {
    const q = questions.find(x => x.id === qId);
    if (!attempt || !q || !pb) return;
    const studentAnswer = attempt.answers?.[qId];
    if (!studentAnswer) { handleGrade(qId, false); return; }

    setAiGradingId(qId);
    try {
      const result = await gradeEssayWithAI(pb, q.text?.replace(/<[^>]*>/g, '') || "", String(studentAnswer), q.answerKey || "", q.type === "isian_singkat" ? "isian_singkat" : "uraian");
      await handleGrade(qId, result.isCorrect);
      addToast({ title: result.isCorrect ? "✓ Benar" : "✗ Salah", description: result.feedback, type: result.isCorrect ? "success" : "warning" });
    } catch (err: any) { addToast({ title: "Gagal", description: err.message, type: "error" }); }
    finally { setAiGradingId(null); }
  };

  const [isAutoGrading, setIsAutoGrading] = useState(false);
  const [showAutoGradeConfirm, setShowAutoGradeConfirm] = useState(false);

  const handleAutoGradeClick = () => {
    if (!attempt) return;
    const overrides = attempt.overrides || (attempt.answers as any)?.__overrides__ || {};
    const alreadyGraded = essayQuestions.some(q => overrides[q.id] !== undefined);
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
        if (!studentAnswer) { await handleGrade(q.id, false); continue; }

        if (q.type === "isian_singkat") {
          const isCorrect = isFuzzyMatch(studentAnswer, q.answerKey);
          await handleGrade(q.id, isCorrect);
        } else {
          await handleAIGradeQuestion(q.id);
        }
      }
      addToast({ title: "Auto Grading Selesai", description: `${essayQuestions.length} soal essay telah dinilai.`, type: "success" });
    } catch (err: any) {
      addToast({ title: "Gagal", description: err.message, type: "error" });
    } finally {
      setIsAutoGrading(false);
    }
  };

  const { objScore, essScore, finalScore, objCorrect, essCorrect, essGraded } = getScoreBreakdown();

  const handleExportPDF = () => {
    if (!attempt || !student) return;
    const typeLabels: Record<string, string> = {
      pilihan_ganda: "PG", pilihan_ganda_kompleks: "PG Kompleks", menjodohkan: "Menjodohkan",
      benar_salah: "B/S", isian_singkat: "Isian", uraian: "Uraian", urutkan: "Urutan", drag_drop: "Drag & Drop",
    };

    const getAnswerText = (q: any) => {
      const ans = attempt.answers?.[q.id];
      if (!ans) return "<em>Tidak dijawab</em>";
      if (q.type === "pilihan_ganda" || q.type === "benar_salah") {
        const label = q.choices?.[ans]?.text || "";
        return `${String(ans).toUpperCase()}${label ? ". " + label.replace(/<[^>]*>/g, '').substring(0, 60) : ""}`;
      }
      if (q.type === "pilihan_ganda_kompleks") return Array.isArray(ans) ? ans.map((k: string) => k.toUpperCase()).join(", ") : String(ans);
      if (q.type === "menjodohkan") { const pairs = q.pairs || []; return pairs.map((p: any) => `${p.left} → ${ans[p.id] || "?"}`).join("<br>"); }
      if (q.type === "urutkan" || q.type === "drag_drop") return Array.isArray(ans) ? ans.map((id: string, i: number) => `${i + 1}. ${(q.items || []).find((it: any) => it.id === id)?.text || id}`).join("<br>") : String(ans);
      return String(ans).substring(0, 200);
    };

    const getKeyText = (q: any) => {
      if (q.type === "pilihan_ganda" || q.type === "benar_salah") {
        const ck = Object.keys(q.choices || {}).find(k => q.choices[k].isCorrect);
        if (!ck) return "-";
        const label = q.choices[ck]?.text || "";
        return `${ck.toUpperCase()}${label ? ". " + label.replace(/<[^>]*>/g, '').substring(0, 60) : ""}`;
      }
      if (q.type === "pilihan_ganda_kompleks") return Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect).map(k => k.toUpperCase()).join(", ");
      if (q.type === "menjodohkan") return (q.pairs || []).map((p: any) => `${p.left} → ${p.right}`).join("<br>");
      if (q.type === "urutkan" || q.type === "drag_drop") return (q.items || []).map((it: any, i: number) => `${i + 1}. ${it.text}`).join("<br>");
      return (q.answerKey || "-").substring(0, 200);
    };

    const rows = questions.map((q, idx) => {
      const correct = isQuestionCorrect(q);
      const status = correct === null ? "Belum" : correct ? "Benar" : "Salah";
      const rowBg = correct === true ? "background:#f0fdf4;" : correct === false ? "background:#fef2f2;" : "";
      const statusStyle = correct === true ? "color:#16a34a;font-weight:bold;" : correct === false ? "color:#dc2626;font-weight:bold;" : "color:#d97706;";
      return `<tr style="page-break-inside:avoid;${rowBg}">
        <td class="cell center">${idx + 1}</td>
        <td class="cell soal">${q.text?.replace(/<[^>]*>/g, '').substring(0, 150) || "-"}</td>
        <td class="cell center"><span class="badge">${typeLabels[q.type] || q.type}</span></td>
        <td class="cell">${getAnswerText(q)}</td>
        <td class="cell">${getKeyText(q)}</td>
        <td class="cell center" style="${statusStyle}">${status}</td>
      </tr>`;
    }).join("");

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
  .status-ok { font-weight: bold; }
  @media print {
    body { padding: 10px 14px; }
    @page { size: A4 portrait; margin: 12mm; }
  }
</style></head><body>
<div class="header">
  <h1>LAPORAN HASIL PENILAIAN</h1>
  <div class="meta">${room?.examTitle || "Ujian"}${room?.subjectName ? ' — Mata Pelajaran: ' + room.subjectName : ''}</div>
</div>
<table class="info-table"><tbody>
  <tr><td class="info-label">Nama Peserta</td><td class="info-value">: ${student.name}</td><td class="info-label">Kelas</td><td class="info-value">: ${className}</td></tr>
  <tr><td class="info-label">${terminology?.id || 'NISN'}</td><td class="info-value">: ${(student as any)?.nisn || "-"}</td><td class="info-label">Ruang Ujian</td><td class="info-value">: ${room?.roomName || "-"}</td></tr>
</tbody></table>
<div class="scores">
  <div class="col"><div class="label">Nilai Final</div><div class="value">${finalScore}</div><div class="sub">${hasEssay ? '60% obj + 40% essay' : '100% objektif'}</div></div>
  <div class="col"><div class="label">Benar</div><div class="value" style="color:#16a34a;">${questions.filter(q => isQuestionCorrect(q) === true).length}</div><div class="sub">dari ${questions.length} soal</div></div>
  <div class="col"><div class="label">Salah</div><div class="value" style="color:#dc2626;">${questions.filter(q => isQuestionCorrect(q) === false).length}</div><div class="sub">dari ${questions.length} soal</div></div>
  <div class="col"><div class="label">Objektif</div><div class="value">${objScore}</div><div class="sub">${objCorrect}/${objectiveQuestions.length} benar</div></div>
  <div class="col"><div class="label">Subjektif</div><div class="value">${hasEssay ? essScore : '-'}</div><div class="sub">${hasEssay ? `${essCorrect}/${essayQuestions.length} benar` : '-'}</div></div>
</div>
<table><thead><tr><th style="width:30px;">No</th><th style="width:28%;">Soal</th><th style="width:60px;">Tipe</th><th style="width:22%;">Jawaban Siswa</th><th style="width:22%;">Kunci Jawaban</th><th style="width:60px;">Status</th></tr></thead><tbody>${rows}</tbody></table>
<div class="footer">Dicetak pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
</body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  if (loading) return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Header skeleton */}
      <div className="bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </div>
      {/* Score cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
            <Skeleton className="h-3 w-16 mx-auto" />
            <Skeleton className="h-8 w-12 mx-auto" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );

  const getStudentAnswer = (q: any) => {
    if (!attempt) return "-";
    const ans = attempt.answers?.[q.id];
    if (!ans) return <span className="text-slate-300 italic">Tidak dijawab</span>;

    if (q.type === "pilihan_ganda" || q.type === "benar_salah") {
      const choiceText = q.choices?.[ans]?.text || ans;
      return <span className="inline-flex items-baseline gap-1"><span className="font-bold">{String(ans).toUpperCase()}.</span> <MathText content={choiceText} className="inline text-xs [&_p]:inline [&_p]:m-0 [&_img]:hidden" /></span>;
    }
    if (q.type === "pilihan_ganda_kompleks") {
      return Array.isArray(ans) ? ans.map((k: string) => String(k).toUpperCase()).join(", ") : String(ans);
    }
    if (q.type === "menjodohkan") {
      const pairs = q.pairs || [];
      return (
        <div className="space-y-0.5">
          {pairs.map((p: any) => (
            <div key={p.id} className="text-xs">
              <span className="text-slate-500">{stripHtml(p.left)}</span> → <span className="font-medium">{stripHtml(ans[p.id] || "?")}</span>
              {ans[p.id] === p.right ? <span className="text-emerald-500 ml-1">✓</span> : <span className="text-rose-500 ml-1">✗</span>}
            </div>
          ))}
        </div>
      );
    }
    if (q.type === "urutkan" || q.type === "drag_drop") {
      return Array.isArray(ans) ? ans.map((id: string) => {
        const item = (q.items || []).find((it: any) => it.id === id);
        return stripHtml(item?.text || id);
      }).join(" → ") : String(ans);
    }
    return String(ans);
  };

  const getCorrectAnswer = (q: any) => {
    if (q.type === "pilihan_ganda" || q.type === "benar_salah") {
      const correctKey = Object.keys(q.choices || {}).find(k => q.choices[k].isCorrect);
      if (!correctKey) return "-";
      const choiceText = q.choices[correctKey]?.text || "";
      return <span className="inline-flex items-baseline gap-1"><span className="font-bold">{correctKey.toUpperCase()}.</span> <MathText content={choiceText} className="inline text-xs [&_p]:inline [&_p]:m-0 [&_img]:hidden" /></span>;
    }
    if (q.type === "pilihan_ganda_kompleks") {
      const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect);
      return correctKeys.map(k => k.toUpperCase()).join(", ");
    }
    if (q.type === "menjodohkan") {
      const pairs = q.pairs || [];
      return pairs.map((p: any) => `${stripHtml(p.left)} → ${stripHtml(p.right)}`).join(", ");
    }
    if (q.type === "urutkan" || q.type === "drag_drop") {
      return (q.items || []).map((it: any) => stripHtml(it.text)).join(" → ");
    }
    if (q.type === "isian_singkat" || q.type === "uraian") {
      return <MathText content={q.answerKey || "-"} className="inline text-xs [&_p]:inline [&_p]:m-0 [&_img]:hidden" />;
    }
    return "-";
  };

  const isQuestionCorrect = (q: any) => {
    if (!attempt) return null;
    const overrides = attempt.overrides || (attempt.answers as any)?.__overrides__ || {};
    if (overrides[q.id] !== undefined) return overrides[q.id];

    const ans = attempt.answers?.[q.id];
    if (!ans) return false;

    if (q.type === "pilihan_ganda" || q.type === "benar_salah") {
      const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ans).toLowerCase());
      return ck ? q.choices[ck].isCorrect === true : false;
    }
    if (q.type === "pilihan_ganda_kompleks") {
      const ck = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase());
      const sk = Array.isArray(ans) ? ans.map((k: any) => String(k).toLowerCase()) : [];
      return sk.length === ck.length && sk.every((k: any) => ck.includes(k));
    }
    if (q.type === "menjodohkan") {
      const pairs = q.pairs || [];
      return pairs.length > 0 && pairs.every((p: any) => ans[p.id] === p.right);
    }
    if (q.type === "urutkan" || q.type === "drag_drop") {
      const co = (q.items || []).map((it: any) => it.id);
      return Array.isArray(ans) && ans.length === co.length && ans.every((v: any, i: number) => v === co[i]);
    }
    if (q.type === "isian_singkat") {
      return isFuzzyMatch(ans, q.answerKey);
    }
    return null; // essay - needs manual grading
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/penilaian")} className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{student?.name || "Siswa"}</h1>
            <p className="text-xs text-slate-500">{(student as any)?.nisn || ""} • {className} • {room?.examTitle || "Ujian"}{room?.subjectName ? ` • ${room.subjectName}` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl text-xs">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} className="rounded-xl text-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          {hasEssay && (
            <Button size="sm" onClick={handleAutoGradeClick} disabled={isAutoGrading} className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">
              <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${isAutoGrading ? "animate-spin" : ""}`} /> {isAutoGrading ? "Menilai..." : "Auto Grade Essay"}
            </Button>
          )}
        </div>
      </div>

      {/* Score Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Nilai Final</p>
          <p className={`text-2xl font-black ${finalScore >= 75 ? "text-emerald-600" : finalScore >= 50 ? "text-amber-600" : "text-rose-600"}`}>{attempt ? finalScore : "-"}</p>
          <p className="text-[10px] text-slate-400">{hasEssay ? "60% obj + 40% essay" : "100% objektif"}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 p-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-emerald-500 mb-1">Benar</p>
          <p className="text-2xl font-black text-emerald-600">{attempt ? questions.filter(q => isQuestionCorrect(q) === true).length : 0}</p>
          <p className="text-[10px] text-slate-400">dari {questions.length} soal</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-100 dark:border-rose-800/30 p-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-rose-500 mb-1">Salah</p>
          <p className="text-2xl font-black text-rose-600">{attempt ? questions.filter(q => isQuestionCorrect(q) === false).length : 0}</p>
          <p className="text-[10px] text-slate-400">dari {questions.length} soal</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Objektif</p>
          <p className={`text-2xl font-black ${objScore >= 75 ? "text-emerald-600" : objScore >= 50 ? "text-amber-600" : "text-rose-600"}`}>{objScore}</p>
          <p className="text-[10px] text-slate-400">{objCorrect}/{objectiveQuestions.length} benar</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Subjektif</p>
          <p className={`text-2xl font-black ${essGraded < essayQuestions.length ? "text-amber-500" : essScore >= 75 ? "text-emerald-600" : essScore >= 50 ? "text-amber-600" : "text-rose-600"}`}>
            {essGraded < essayQuestions.length ? `${essGraded}/${essayQuestions.length}` : essScore}
          </p>
          <p className="text-[10px] text-slate-400">{essGraded < essayQuestions.length ? "belum selesai" : `${essCorrect}/${essayQuestions.length} benar`}</p>
        </div>
      </div>

      {/* Questions Detail */}
      {attempt && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Detail Jawaban</h2>
            <span className="text-[10px] text-slate-400 font-medium">{questions.length} soal</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="w-10 text-center text-[10px] font-bold">No</TableHead>
                  <TableHead className="text-[10px] font-bold min-w-[220px]">Soal</TableHead>
                  <TableHead className="text-[10px] font-bold w-20 text-center">Tipe</TableHead>
                  <TableHead className="text-[10px] font-bold min-w-[140px]">Jawaban Siswa</TableHead>
                  <TableHead className="text-[10px] font-bold min-w-[140px]">Kunci Jawaban</TableHead>
                  <TableHead className="text-center text-[10px] font-bold w-16">Status</TableHead>
                  <TableHead className="text-right text-[10px] font-bold w-28">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q, idx) => {
                  const correct = isQuestionCorrect(q);
                  const isEssay = q.type === "isian_singkat" || q.type === "uraian";
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
                  };
                  const typeColors: Record<string, string> = {
                    pilihan_ganda: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/30",
                    pilihan_ganda_kompleks: "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/30",
                    menjodohkan: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/30",
                    benar_salah: "bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800/30",
                    isian_singkat: "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/30",
                    uraian: "bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-800/30",
                    urutkan: "bg-teal-50 text-teal-600 border-teal-100 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800/30",
                    drag_drop: "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/30",
                  };

                  return (
                    <TableRow key={q.id} className={`group transition-colors ${correct === true ? "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10" : correct === false ? "hover:bg-rose-50/50 dark:hover:bg-rose-950/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"} ${isEssay ? "bg-purple-50/20 dark:bg-purple-950/5" : ""}`}>
                      <TableCell className="text-center">
                        <span className="text-[10px] font-bold text-slate-400 font-mono">{idx + 1}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-[11px] leading-snug text-slate-700 dark:text-slate-300 line-clamp-2">
                          <MathText content={q.text} className="text-[11px] [&_p]:m-0 [&_p]:inline [&_img]:hidden [&_br]:hidden line-clamp-2" />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold border ${typeColors[q.type] || "bg-slate-50 text-slate-500 border-slate-100"}`}>
                          {typeLabels[q.type] || q.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2 leading-snug">{getStudentAnswer(q)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">{getCorrectAnswer(q)}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        {correct === null ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/30" title="Belum dinilai">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          </span>
                        ) : correct ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/30" title="Benar">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/30" title="Salah">
                            <X className="w-3 h-3 text-rose-500" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-0.5 justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                          {isEssay && (
                            <button
                              onClick={() => handleAIGradeQuestion(q.id)}
                              disabled={aiGradingId === q.id}
                              className={`p-1 rounded-md text-xs transition-colors ${aiGradingId === q.id ? "animate-spin text-indigo-500" : "text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"}`}
                              title="AI Grading"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleGrade(q.id, true)}
                            className={`p-1 rounded-md transition-colors ${isManuallyGraded && overrides[q.id] ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"}`}
                            title="Tandai Benar"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleGrade(q.id, false)}
                            className={`p-1 rounded-md transition-colors ${isManuallyGraded && !overrides[q.id] ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30" : "text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"}`}
                            title="Tandai Salah"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {!attempt && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center">
          <p className="text-slate-400 text-sm">{terminology.student} belum mengerjakan ujian ini.</p>
        </div>
      )}

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
  );
};

export default StudentGradingDetailPage;
