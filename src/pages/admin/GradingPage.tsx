import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, FileSpreadsheet, RefreshCw, Search } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";
import { useTenant } from "../../context/TenantContext";
import { useExamData } from "../../context/ExamDataContext";
import { useToast } from "../../components/ui/toast";

const isFuzzyMatch = (studentAns: any, correctKey: string) => {
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
    for (let j = 1; j <= b.length; j++) { for (let i = 1; i <= a.length; i++) { const cost = a[i - 1] === b[j - 1] ? 0 : 1; matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + cost); } }
    return matrix[b.length][a.length];
  };
  const dist = distance(sAns, cKey);
  const maxLen = Math.max(sAns.length, cKey.length);
  const maxAllowed = maxLen > 10 ? 3 : (maxLen > 6 ? 2 : (maxLen >= 4 ? 1 : 0));
  return dist <= maxAllowed;
};

const GradingPage = () => {
  const navigate = useNavigate();
  const { pb, terminology } = useTenant();
  const { classes: examClasses, students } = useExamData();
  const { addToast } = useToast();

  const [roomId] = useState<string | null>(() => sessionStorage.getItem("activeGradingRoomId") || sessionStorage.getItem("activeMonitoringRoomId"));
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!roomId) { navigate("/admin/ruang-ujian", { replace: true }); return; }
    loadData();
  }, [roomId]);

  const loadData = useCallback(async () => {
    if (!pb || !roomId) return;
    setLoading(true);
    try {
      const roomRecord = await pb.collection("exam_rooms").getOne(roomId);
      const examObj = await pb.collection("exams").getOne(roomRecord.examId).catch(() => null);
      setRoom({ ...roomRecord, examTitle: examObj?.title || "Ujian", examId: roomRecord.examId });

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

      const attList = await pb.collection("attempts").getFullList({ filter: `examRoomId = "${roomId}"` });
      setAttempts(attList);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pb, roomId]);

  // Scoring helpers
  const objectiveQuestions = questions.filter(q => q.type !== "isian_singkat" && q.type !== "uraian");
  const essayQuestions = questions.filter(q => q.type === "isian_singkat" || q.type === "uraian");
  const hasEssay = essayQuestions.length > 0;

  const getScoreBreakdown = (att: any) => {
    const defaultObjTotal = room?.max_questions && room.max_questions > 0 ? room.max_questions : objectiveQuestions.length;
    if (!att) return { objScore: 0, essScore: 0, finalScore: 0, objCorrect: 0, essCorrect: 0, essGraded: 0, objTotal: defaultObjTotal, essTotal: essayQuestions.length };
    const answers = att.answers || {};
    const overrides = att.overrides || (answers as any)?.__overrides__ || {};
    const studentOrder = answers.__order__ || (answers as any)?.__meta?.questionOrder;
    const targetQuestions = Array.isArray(studentOrder) && studentOrder.length > 0
      ? questions.filter(q => studentOrder.includes(q.id))
      : (room?.max_questions && room.max_questions > 0 ? questions.slice(0, room.max_questions) : questions);

    const studentObjQuestions = targetQuestions.filter(q => q.type !== "isian_singkat" && q.type !== "uraian");
    const studentEssQuestions = targetQuestions.filter(q => q.type === "isian_singkat" || q.type === "uraian");
    const studentHasEssay = studentEssQuestions.length > 0;

    let objCorrect = 0;
    studentObjQuestions.forEach(q => {
      let ic = false;
      if (overrides[q.id] !== undefined) { ic = overrides[q.id]; }
      else {
        const a = answers[q.id]; if (!a) return;
        const t = q.type;
        if (t === "pilihan_ganda" || t === "benar_salah") { const ck = Object.keys(q.choices||{}).find(k=>k.toLowerCase()===String(a).toLowerCase()); ic = ck ? q.choices[ck].isCorrect===true : false; }
        else if (t === "pilihan_ganda_kompleks") { const ck = Object.keys(q.choices||{}).filter(k=>q.choices[k].isCorrect).map(k=>k.toLowerCase()); const sk = Array.isArray(a)?a.map((k:any)=>String(k).toLowerCase()):[]; ic = sk.length===ck.length && sk.every((k:any)=>ck.includes(k)); }
        else if (t === "menjodohkan") { const pairs = q.pairs||[]; ic = pairs.length>0 && pairs.every((p:any)=>a[p.id]===p.right); }
        else if (t === "urutkan" || t === "drag_drop") { const co = (q.items||[]).map((it:any)=>it.id); ic = Array.isArray(a) && a.length===co.length && a.every((v:any,i:number)=>v===co[i]); }
      }
      if (ic) objCorrect++;
    });

    let essCorrect = 0, essGraded = 0;
    studentEssQuestions.forEach(q => {
      if (overrides[q.id] !== undefined) { essGraded++; if (overrides[q.id]) essCorrect++; }
      else if (q.type === "isian_singkat" && answers[q.id]) { essGraded++; if (isFuzzyMatch(answers[q.id], q.answerKey)) essCorrect++; }
    });

    const objScore = studentObjQuestions.length > 0 ? Math.round((objCorrect / studentObjQuestions.length) * 100) : 0;
    const essScore = studentEssQuestions.length > 0 ? Math.round((essCorrect / studentEssQuestions.length) * 100) : 0;
    const finalScore = !studentHasEssay ? objScore : Math.round(objScore * 0.6 + essScore * 0.4);

    return { objScore, essScore, finalScore, objCorrect, essCorrect, essGraded, objTotal: studentObjQuestions.length, essTotal: studentEssQuestions.length };
  };

  const handleExportGrading = () => {
    if (!room) return;
    const workbook = XLSX.utils.book_new();
    const STYLES = {
      header: { fill: { fgColor: { rgb: "4F46E5" } }, font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } },
      cell: { alignment: { vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } },
      cellCenter: { alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } },
      correct: { fill: { patternType: "solid", fgColor: { rgb: "DCFCE7" } }, font: { color: { rgb: "16A34A" }, bold: true }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } },
      wrong: { fill: { patternType: "solid", fgColor: { rgb: "FEE2E2" } }, font: { color: { rgb: "DC2626" }, bold: true }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } },
    };

    const headerRow = ["No", terminology.id, "Nama", terminology.class, "Objektif (B/T)", "Skor Objektif", "Essay (B/T)", "Skor Essay", "Nilai Final", "Rumus"];
    const rows: any[][] = [headerRow.map(h => ({ v: h, s: STYLES.header }))];

    const filteredStudents = students.filter(s => {
      const isAllClasses = room.allClasses || room.all_classes || false;
      if (isAllClasses) return true;
      const classData = room.classId || room.classid || room.classIds || room.classids || "";
      let ids: string[] = [];
      if (Array.isArray(classData)) ids = classData;
      else if (typeof classData === 'string' && classData.length > 0) ids = classData.split(",").map((x: string) => x.trim()).filter(Boolean);
      if (ids.length === 0) return true;
      return ids.includes(s.classId) || ids.includes((s as any).classid);
    }).sort((a, b) => a.name.localeCompare(b.name));

    filteredStudents.forEach((std, idx) => {
      const att = attempts.find(a => a.studentId === std.id || a.student_id === std.id);
      const { objScore, essScore, finalScore, objCorrect, essCorrect, objTotal, essTotal } = getScoreBreakdown(att);
      const className = examClasses.find(c => c.id === std.classId)?.name || "-";
      const formula = hasEssay ? `${objScore}×60% + ${essScore}×40% = ${finalScore}` : `${objScore} (100% objektif)`;

      rows.push([
        { v: idx + 1, s: STYLES.cellCenter },
        { v: (std as any).nisn || std.id, s: STYLES.cellCenter },
        { v: std.name, s: STYLES.cell },
        { v: className, s: STYLES.cellCenter },
        { v: `${objCorrect}/${objTotal}`, s: STYLES.cellCenter },
        { v: objScore, s: objScore >= 75 ? STYLES.correct : (objScore >= 50 ? STYLES.cellCenter : STYLES.wrong) },
        { v: `${essCorrect}/${essTotal}`, s: STYLES.cellCenter },
        { v: essScore, s: essScore >= 75 ? STYLES.correct : (essScore >= 50 ? STYLES.cellCenter : STYLES.wrong) },
        { v: finalScore, s: { ...STYLES.cellCenter, font: { bold: true, sz: 12 } } },
        { v: formula, s: STYLES.cellCenter },
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 4 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(workbook, ws, "Rekap Nilai");
    XLSX.writeFile(workbook, `Penilaian_${room.room_name || "Ujian"}_${new Date().toISOString().split('T')[0]}.xlsx`);
    addToast({ title: "Export Berhasil", description: "File Excel telah diunduh.", type: "success" });
  };

  const filteredStudents = students.filter(s => {
    if (!room) return false;
    const isAllClasses = room.allClasses || room.all_classes || false;
    if (isAllClasses) return true;
    const classData = room.classId || room.classid || room.classIds || room.classids || "";
    let ids: string[] = [];
    if (Array.isArray(classData)) ids = classData;
    else if (typeof classData === 'string' && classData.length > 0) ids = classData.split(",").map((x: string) => x.trim()).filter(Boolean);
    if (ids.length === 0) return true;
    return ids.includes(s.classId) || ids.includes((s as any).classid);
  }).filter(s => !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-[500px] w-full rounded-2xl" />
    </div>
  );

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/monitoring")} className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Detail Penilaian</h1>
            <p className="text-xs text-slate-500">{room?.examTitle || "Ujian"} • {room?.room_name || ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="rounded-xl text-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" onClick={handleExportGrading} className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Export Excel
          </Button>
        </div>
      </div>

      {/* Formula Card */}
      <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800/40 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center"><BookOpen className="w-4 h-4 text-white" /></div>
          <h2 className="font-black text-indigo-700 dark:text-indigo-300 text-sm uppercase tracking-widest">Rumus Penilaian</h2>
        </div>
        {hasEssay ? (
          <div className="space-y-2 text-sm text-indigo-700 dark:text-indigo-300">
            <p><span className="font-black">Nilai Final</span> = (Skor Objektif × <span className="font-black text-blue-600">60%</span>) + (Skor Subjektif × <span className="font-black text-purple-600">40%</span>)</p>
            <p className="text-xs text-indigo-500">Skor Objektif = (Benar / {objectiveQuestions.length} soal) × 100 &nbsp;|&nbsp; Skor Subjektif = (Benar / {essayQuestions.length} soal) × 100</p>
            <p className="text-xs text-indigo-500">Contoh semua benar: (100 × 0.6) + (100 × 0.4) = <span className="font-black">100</span></p>
          </div>
        ) : (
          <p className="text-sm text-indigo-600">Tidak ada soal essay. <span className="font-bold">Nilai = (Benar / {objectiveQuestions.length}) × 100</span> (100% objektif)</p>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={`Cari ${terminology.student.toLowerCase()}...`} className="w-full pl-10 pr-4 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
              <TableRow>
                <TableHead className="w-10 text-center text-[10px]">No</TableHead>
                <TableHead className="text-[10px]">Nama</TableHead>
                <TableHead className="text-center text-[10px] w-20">Kelas</TableHead>
                <TableHead className="text-center text-[10px] w-24 text-blue-600">Objektif</TableHead>
                <TableHead className="text-center text-[10px] w-24 text-purple-600">Subjektif</TableHead>
                <TableHead className="text-center text-[10px] w-20 font-black">Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((std, idx) => {
                const att = attempts.find(a => a.studentId === std.id || a.student_id === std.id);
                const { objScore, essScore, finalScore, objCorrect, essGraded, essCorrect, objTotal, essTotal } = getScoreBreakdown(att);
                const className = examClasses.find(c => c.id === std.classId)?.name || "-";

                return (
                  <TableRow key={std.id} className="h-14 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer" onClick={() => navigate(`/admin/penilaian/${std.id}`)}>
                    <TableCell className="text-center text-xs text-slate-400">{idx + 1}</TableCell>
                    <TableCell>
                      <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400 hover:underline">{std.name}</span>
                      <span className="block text-[10px] text-slate-400">{(std as any).nisn}</span>
                    </TableCell>
                    <TableCell className="text-center text-xs">{className}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-sm font-black ${objScore >= 75 ? "text-emerald-600" : objScore >= 50 ? "text-amber-600" : "text-rose-600"}`}>{objScore}</span>
                        <span className="text-[9px] text-slate-400">{objCorrect}/{objTotal}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {hasEssay ? (
                        <div className="flex flex-col items-center">
                          <span className={`text-sm font-black ${essGraded < essTotal ? "text-amber-500" : essScore >= 75 ? "text-emerald-600" : essScore >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                            {essGraded < essTotal ? `${essGraded}/${essTotal}` : essScore}
                          </span>
                          <span className="text-[9px] text-slate-400">{essGraded < essTotal ? "belum dinilai" : `${essCorrect}/${essTotal}`}</span>
                        </div>
                      ) : <span className="text-xs text-slate-300">-</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-lg font-black ${finalScore >= 75 ? "text-emerald-600" : finalScore >= 50 ? "text-amber-600" : "text-rose-600"}`}>{att ? finalScore : "-"}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default GradingPage;
