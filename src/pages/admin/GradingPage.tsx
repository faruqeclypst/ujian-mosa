import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, BookOpen, FileSpreadsheet, RefreshCw, BarChart2, ChevronRight, Download, Award, GitBranch } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { NeonTable, type NeonTableColumn } from "../../components/ui/NeonTable";
import { NeonPageHeader } from "../../components/ui/NeonPageHeader";
import { NeonStatGrid, NeonStatCard } from "../../components/ui/NeonStats";
import { ExamRoomPicker } from "../../components/common/ExamRoomPicker";
import { useTenant } from "../../context/TenantContext";
import { useExamData } from "../../context/ExamDataContext";
import { useToast } from "../../components/ui/toast";
import { cn } from "../../lib/utils";

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
  const [searchParams] = useSearchParams();
  const { pb, terminology } = useTenant();
  const { classes: examClasses, students } = useExamData();
  const { addToast } = useToast();

  const roomId = searchParams.get("roomId");

  const [loading, setLoading] = useState(false);
  const [room, setRoom] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  const loadData = useCallback(async () => {
    if (!pb || !roomId) return;
    setLoading(true);
    try {
      const roomRecord = await pb.collection("exam_rooms").getOne(roomId, {
        expand: "examId,examId.subjectId"
      });
      const examObj = roomRecord.expand?.examId || await pb.collection("exams").getOne(roomRecord.examId).catch(() => null);
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
        room_name: roomRecord.room_name || roomRecord.title || "Ruang Ujian"
      });

      const qList = await pb.collection("questions").getFullList({
        filter: `examId = "${roomRecord.examId}"`,
        sort: "order,created"
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
        matriks: "matriks"
      };

      const mapped = qList.map(q => {
        const t = typeMap[q.field || q.type] || q.field || q.type || "pilihan_ganda";
        const opts = q.options || {};
        const statements = (t === "benar_salah" || t === "klasifikasi" || t === "matriks") ? (opts.statements || []) : undefined;
        const categories = t === "klasifikasi" ? (opts.categories || []) : undefined;
        const columns = t === "matriks" ? (opts.columns || []) : undefined;
        const blanks = t === "isian_rumpang" ? (opts.blanks || []) : undefined;
        const areas = t === "hotspot" ? (opts.areas || []) : undefined;
        const hotspotMode = t === "hotspot" ? (opts.mode || "any") : undefined;
        return {
          ...q,
          type: t,
          choices: opts,
          pairs: t === "menjodohkan" ? opts.pairs : undefined,
          items: (t === "urutkan" || t === "drag_drop") ? opts.items : undefined,
          statements,
          categories,
          columns,
          blanks,
          areas,
          hotspotMode,
          answerKey: q.correctAnswer || q.answerKey
        };
      });

      setQuestions(mapped.sort((a: any, b: any) => {
        const aIsEssay = a.type === "isian_singkat" || a.type === "uraian";
        const bIsEssay = b.type === "isian_singkat" || b.type === "uraian";
        if (aIsEssay && !bIsEssay) return 1;
        if (!aIsEssay && bIsEssay) return -1;
        return 0;
      }));

      const attList = await pb.collection("attempts").getFullList({
        filter: `examRoomId = "${roomId}"`
      });
      setAttempts(attList);
    } catch (e) {
      console.error(e);
      addToast({ type: "error", title: "Gagal Memuat Data", description: "Terjadi kesalahan saat memuat data penilaian." });
    } finally {
      setLoading(false);
    }
  }, [pb, roomId, addToast]);

  useEffect(() => {
    if (roomId) {
      loadData();
    }
  }, [roomId, loadData]);

  // Scoring helpers
  const objectiveQuestions = useMemo(() => questions.filter(q => q.type !== "isian_singkat" && q.type !== "uraian"), [questions]);
  const essayQuestions = useMemo(() => questions.filter(q => q.type === "isian_singkat" || q.type === "uraian"), [questions]);
  const hasEssay = essayQuestions.length > 0;

  const roomClassLabel = useMemo(() => {
    if (!room) return "-";
    if (room.allClasses || room.all_classes) return "Semua Kelas";
    const raw = room.classId || room.classid || room.classIds || "";
    const ids = Array.isArray(raw) ? raw : String(raw).split(",").map(s => s.trim()).filter(Boolean);
    const names = examClasses.filter(c => ids.includes(c.id)).map(c => c.name);
    return names.length > 0 ? names.join(", ") : "Semua Kelas";
  }, [room, examClasses]);

  const getScoreBreakdown = useCallback((att: any) => {
    const defaultObjTotal = room?.max_questions && room.max_questions > 0 ? room.max_questions : objectiveQuestions.length;
    if (!att) {
      return { objScore: 0, essScore: 0, finalScore: 0, objCorrect: 0, essCorrect: 0, essGraded: 0, objTotal: defaultObjTotal, essTotal: essayQuestions.length };
    }
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
      let qScore = 0;
      if (overrides[q.id] !== undefined) {
        qScore = overrides[q.id] === true ? 1 : (typeof overrides[q.id] === 'number' ? overrides[q.id] : 0);
      } else {
        const a = answers[q.id];
        if (!a) return;
        const t = q.type;
        if (t === "pilihan_ganda") {
          const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(a).toLowerCase());
          qScore = ck ? (q.choices[ck].isCorrect === true ? 1 : 0) : 0;
        } else if (t === "benar_salah") {
          const sts = q.statements || q.choices?.statements || [];
          if (sts.length > 0) {
            let stCorrect = 0;
            sts.forEach((st: any) => {
              const expected = (st.answer || "benar").toLowerCase();
              const given = (a?.[st.id] || "").toLowerCase();
              if (given === expected) stCorrect++;
            });
            qScore = stCorrect / sts.length;
          } else {
            const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(a).toLowerCase());
            qScore = ck ? (q.choices[ck].isCorrect === true ? 1 : 0) : 0;
          }
        } else if (t === "pilihan_ganda_kompleks") {
          const ck = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase());
          const sk = Array.isArray(a) ? a.map((k: any) => String(k).toLowerCase()) : [];
          const correctChosen = sk.filter(k => ck.includes(k));
          const wrongChosen = sk.filter(k => !ck.includes(k));
          qScore = ck.length > 0 ? Math.max(0, correctChosen.length - wrongChosen.length) / ck.length : 0;
        } else if (t === "menjodohkan") {
          const pairs = q.pairs || [];
          qScore = pairs.length > 0 && pairs.every((p: any) => a[p.id] === p.right) ? 1 : 0;
        } else if (t === "urutkan" || t === "drag_drop") {
          const co = (q.items || []).map((it: any) => it.id);
          qScore = Array.isArray(a) && a.length === co.length && a.every((v: any, i: number) => v === co[i]) ? 1 : 0;
        } else if (t === "klasifikasi" || t === "matriks") {
          const kstmts = q.statements || q.choices?.statements || [];
          if (kstmts.length > 0 && a !== null && typeof a === "object" && !Array.isArray(a)) {
            let kCorr = 0;
            kstmts.forEach((st: any) => {
              const sid = String(st.id ?? "");
              if (!sid) return;
              if (String(a[sid] ?? "") === String(st.answer ?? "")) kCorr++;
            });
            qScore = kCorr / kstmts.length;
          }
        } else if (t === "isian_rumpang") {
          const blanks = q.blanks || q.choices?.blanks || [];
          if (blanks.length > 0 && a !== null && typeof a === "object" && !Array.isArray(a)) {
            let bCorr = 0;
            blanks.forEach((bl: any) => {
              const bid = String(bl.id ?? "");
              if (!bid) return;
              let given = String(a[bid] ?? "").trim();
              const cs = bl.caseSensitive === true;
              if (!cs) given = given.toLowerCase();
              if (!given) return;
              const acc = Array.isArray(bl.answers) ? bl.answers : (bl.answers != null ? [bl.answers] : []);
              for (const ac of acc) {
                let exp = String(ac ?? "").trim();
                if (!cs) exp = exp.toLowerCase();
                if (exp && given === exp) { bCorr++; break; }
              }
            });
            qScore = bCorr / blanks.length;
          }
        } else if (t === "hotspot") {
          const areas = q.areas || q.choices?.areas || [];
          const hmode = String(q.hotspotMode || q.choices?.mode || "any").toLowerCase();
          const inArea = (px: number, py: number, ar: any) => {
            const ax = Number(ar.x), ay = Number(ar.y), aw = Number(ar.w), ah = Number(ar.h);
            if (isNaN(ax) || isNaN(ay) || isNaN(aw) || isNaN(ah)) return false;
            return px >= ax && px <= ax + aw && py >= ay && py <= ay + ah;
          };
          if (areas.length > 0) {
            if (hmode === "all") {
              const pts = Array.isArray(a) ? a : [];
              let hit = 0;
              for (const ar of areas) {
                for (const pt of pts) {
                  const px = Number(pt?.x), py = Number(pt?.y);
                  if (!isNaN(px) && !isNaN(py) && inArea(px, py, ar || {})) { hit++; break; }
                }
              }
              qScore = hit / areas.length;
            } else {
              let hx = NaN, hy = NaN;
              if (a !== null && typeof a === "object" && !Array.isArray(a)) { hx = Number(a.x); hy = Number(a.y); }
              if (!isNaN(hx) && !isNaN(hy)) {
                for (const ar of areas) { if (inArea(hx, hy, ar || {})) { qScore = 1; break; } }
              }
            }
          }
        }
      }
      objCorrect += qScore;
    });

    let essCorrect = 0, essGraded = 0;
    studentEssQuestions.forEach(q => {
      if (overrides[q.id] !== undefined) {
        essGraded++;
        if (overrides[q.id]) essCorrect++;
      } else if (q.type === "isian_singkat" && answers[q.id]) {
        essGraded++;
        if (isFuzzyMatch(answers[q.id], q.answerKey)) essCorrect++;
      }
    });

    const objScore = studentObjQuestions.length > 0 ? Math.round((objCorrect / studentObjQuestions.length) * 100) : 0;
    const essScore = studentEssQuestions.length > 0 ? Math.round((essCorrect / studentEssQuestions.length) * 100) : 0;
    const finalScore = !studentHasEssay ? objScore : Math.round(objScore * 0.6 + essScore * 0.4);

    return {
      objScore,
      essScore,
      finalScore,
      objCorrect,
      essCorrect,
      essGraded,
      objTotal: studentObjQuestions.length,
      essTotal: studentEssQuestions.length
    };
  }, [questions, objectiveQuestions, essayQuestions, room]);

  const handleExportGrading = () => {
    if (!room) return;
    const workbook = XLSX.utils.book_new();
    const STYLES = {
      header: { fill: { fgColor: { rgb: "10B981" } }, font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } },
      cell: { alignment: { vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } },
      cellCenter: { alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } },
      correct: { fill: { patternType: "solid", fgColor: { rgb: "DCFCE7" } }, font: { color: { rgb: "16A34A" }, bold: true }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } },
      wrong: { fill: { patternType: "solid", fgColor: { rgb: "FEE2E2" } }, font: { color: { rgb: "DC2626" }, bold: true }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } },
    };

    const headerRow = ["No", terminology.id, "Nama", terminology.class, "Objektif (B/T)", "Skor Objektif", "Essay (B/T)", "Skor Essay", "Nilai Final", "Rumus"];
    const rows: any[][] = [headerRow.map(h => ({ v: h, s: STYLES.header }))];

    const eligibleList = students.filter(s => {
      const isAllClasses = room.allClasses || room.all_classes || false;
      if (isAllClasses) return true;
      const classData = room.classId || room.classid || room.classIds || room.classids || "";
      let ids: string[] = [];
      if (Array.isArray(classData)) ids = classData;
      else if (typeof classData === 'string' && classData.length > 0) ids = classData.split(",").map((x: string) => x.trim()).filter(Boolean);
      if (ids.length === 0) return true;
      return ids.includes(s.classId) || ids.includes((s as any).classid);
    }).sort((a, b) => a.name.localeCompare(b.name));

    eligibleList.forEach((std, idx) => {
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
        { v: att ? finalScore : "-", s: { ...STYLES.cellCenter, font: { bold: true, sz: 12 } } },
        { v: att ? formula : "Belum Mengerjakan", s: STYLES.cellCenter },
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 4 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(workbook, ws, "Rekap Nilai");
    XLSX.writeFile(workbook, `Penilaian_${room.room_name || "Ujian"}_${new Date().toISOString().split('T')[0]}.xlsx`);
    addToast({ title: "Export Berhasil", description: "File Excel telah diunduh.", type: "success" });
  };

  const eligibleStudents = useMemo(() => {
    if (!room) return [];
    const isAllClasses = room.allClasses || room.all_classes || false;
    let base = students;
    if (!isAllClasses) {
      const classData = room.classId || room.classid || room.classIds || room.classids || "";
      let ids: string[] = [];
      if (Array.isArray(classData)) ids = classData;
      else if (typeof classData === 'string' && classData.length > 0) ids = classData.split(",").map((x: string) => x.trim()).filter(Boolean);
      if (ids.length > 0) {
        base = students.filter(s => ids.includes(s.classId) || ids.includes((s as any).classid));
      }
    }
    return base.map(s => ({
      ...s,
      className: examClasses.find(c => c.id === s.classId)?.name || "-"
    }));
  }, [room, students, examClasses]);

  const filteredStudents = useMemo(() => {
    let list = eligibleStudents;
    if (classFilter !== "all") {
      list = list.filter(s => s.className === classFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || String(s.nisn || "").includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [eligibleStudents, classFilter, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = eligibleStudents.length;
    let finishedCount = 0;
    let totalScore = 0;
    let highest = 0;
    let lowest = 100;
    let hasAnyFinished = false;

    eligibleStudents.forEach(std => {
      const att = attempts.find(a => (a.studentId || a.student_id) === std.id);
      if (att && (att.status === "finished" || att.status === "submitted" || att.status === "graded")) {
        hasAnyFinished = true;
        finishedCount++;
        const { finalScore } = getScoreBreakdown(att);
        totalScore += finalScore;
        if (finalScore > highest) highest = finalScore;
        if (finalScore < lowest) lowest = finalScore;
      }
    });

    const avg = finishedCount > 0 ? Math.round((totalScore / finishedCount) * 10) / 10 : 0;
    return {
      total,
      finishedCount,
      avg,
      highest: hasAnyFinished ? highest : 0,
      lowest: hasAnyFinished ? lowest : 0,
    };
  }, [eligibleStudents, attempts, getScoreBreakdown]);

  // NeonTable Columns
  const columns: NeonTableColumn<any>[] = useMemo(() => {
    const cols: NeonTableColumn<any>[] = [
      {
        key: "name",
        header: `Nama ${terminology.student || "Siswa"}`,
        className: "min-w-0 max-w-[340px]",
        render: (std) => (
          <div className="flex flex-col gap-0.5 py-1">
            <span className="text-[13px] font-bold tracking-tight text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {std.name}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
              <span>{std.nisn || "-"}</span>
              <span>•</span>
              <span className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
                {std.className}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: "objektif",
        header: "Objektif",
        align: "center",
        width: "110px",
        className: "hidden sm:table-cell",
        headerClassName: "hidden sm:table-cell",
        render: (std) => {
          const att = attempts.find(a => (a.studentId || a.student_id) === std.id);
          if (!att) return <span className="font-mono text-xs text-neutral-400">-</span>;
          const { objScore, objCorrect, objTotal } = getScoreBreakdown(att);
          return (
            <div className="flex flex-col items-center justify-center font-mono py-1">
              <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{objScore}</span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{Number(objCorrect.toFixed(1))}/{objTotal}</span>
            </div>
          );
        },
      },
    ];

    if (hasEssay) {
      cols.push({
        key: "subjektif",
        header: "Subjektif",
        align: "center",
        width: "110px",
        className: "hidden sm:table-cell",
        headerClassName: "hidden sm:table-cell",
        render: (std) => {
          const att = attempts.find(a => (a.studentId || a.student_id) === std.id);
          if (!att) return <span className="font-mono text-xs text-neutral-400">-</span>;
          const { essScore, essCorrect, essGraded, essTotal } = getScoreBreakdown(att);
          if (essGraded < essTotal) {
            return (
              <div className="flex flex-col items-center justify-center font-mono py-1">
                <span className="text-[11px] font-bold text-amber-500">{essGraded}/{essTotal}</span>
                <span className="text-[9px] text-amber-500/80">dinilai</span>
              </div>
            );
          }
          return (
            <div className="flex flex-col items-center justify-center font-mono py-1">
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{essScore}</span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{essCorrect}/{essTotal}</span>
            </div>
          );
        },
      });
    }

    cols.push(
      {
        key: "final",
        header: "Nilai Final",
        align: "center",
        width: "100px",
        render: (std) => {
          const att = attempts.find(a => (a.studentId || a.student_id) === std.id);
          if (!att) return <span className="font-mono text-xs text-neutral-400">-</span>;
          const { finalScore } = getScoreBreakdown(att);
          return (
            <span className={cn(
              "font-mono text-sm font-bold",
              finalScore >= 75 ? "text-emerald-600 dark:text-emerald-400" : (finalScore >= 50 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400")
            )}>
              {finalScore}
            </span>
          );
        },
      },
      {
        key: "action",
        header: "Aksi",
        align: "right",
        width: "80px",
        render: (std) => (
          <div className="flex justify-end items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => navigate(`/admin/penilaian/${std.id}?roomId=${roomId || ""}`)}
              className="h-7 w-7 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
              title="Lihat Detail Penilaian"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ),
      }
    );

    return cols;
  }, [attempts, getScoreBreakdown, hasEssay, navigate, roomId, terminology]);

  // Jika belum memilih ruang ujian, tampilkan Room Picker terlebih dahulu
  if (!roomId) {
    return (
      <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
        <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <ExamRoomPicker
            title="Rekapitulasi Nilai Ujian"
            subtitle="Pilih sesi ruang ujian yang ingin ditampilkan untuk melihat lembar jawaban, rekap skor, dan ekspor excel."
            badgeText="Nilai"
            actionText="Buka Lembar Nilai"
            icon={Award}
            onSelectRoom={(r) => {
              navigate(`/admin/penilaian?roomId=${r.id}`);
            }}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
        <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans overflow-x-hidden">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">

        {/* ═══════════════════════════════════════════════════════════════
            1. TOP HEADER BAR (Simplified & Clean)
           ═══════════════════════════════════════════════════════════════ */}
        <NeonPageHeader
          bordered
          onBack={() => navigate("/admin/penilaian")}
          backTitle="Pilih Ruang Lain"
          title={`Penilaian: ${room?.room_name || "Ruang Ujian"}`}
          breadcrumbs={
            <>
              <button
                type="button"
                onClick={() => navigate("/admin/penilaian")}
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shrink-0 cursor-pointer font-medium"
              >
                Pilih Ruang
              </button>
              <span>/</span>
              <span className="font-medium text-neutral-700 dark:text-neutral-300 shrink-0">
                {room?.subjectName || "Mapel"}
              </span>
              <span>•</span>
              <span className="truncate max-w-[280px] sm:max-w-[400px]">{roomClassLabel}</span>
            </>
          }
          actions={
            <>
              <button
                type="button"
                onClick={() => navigate("/admin/penilaian")}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer"
                title="Pilih ruang ujian lain"
              >
                <GitBranch className="h-3.5 w-3.5 text-neutral-400" />
                <span>Ganti Ruang</span>
              </button>
              <button
                type="button"
                onClick={handleExportGrading}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer"
                title="Unduh Rekap Nilai ke format Excel"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Export Excel</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/admin/analisis-butir-soal?roomId=${roomId || ""}&examId=${room?.examId || ""}`)}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer"
                title="Lihat Analisis Butir Soal"
              >
                <BarChart2 className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                <span>Analisis Butir</span>
              </button>

              <button
                type="button"
                onClick={loadData}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-mono rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 shadow-2xs transition-colors cursor-pointer"
                title="Segarkan data penilaian"
              >
                <RefreshCw className="h-3 w-3 text-neutral-400" />
                <span className="font-sans font-medium text-neutral-500">Refresh</span>
              </button>
            </>
          }
        />

        {/* ═══════════════════════════════════════════════════════════════
            2. STATS STRIP (4 Kartu Ringkas & Elegan)
           ═══════════════════════════════════════════════════════════════ */}
        <NeonStatGrid cols={4}>
          <NeonStatCard
            label={`Total ${terminology.student || "Siswa"}`}
            value={stats.total}
            unit="siswa"
          />

          <NeonStatCard
            label="Telah Mengerjakan"
            indicator={true}
            value={
              <span className="text-emerald-600 dark:text-emerald-400">
                {stats.finishedCount}{" "}
                <span className="text-xs font-sans font-normal text-neutral-400">/ {stats.total}</span>
              </span>
            }
          />

          <NeonStatCard
            label="Rata-Rata Nilai"
            value={stats.avg}
          />

          <NeonStatCard
            label="Tertinggi / Terendah"
            value={
              <>
                <span className="text-emerald-600 dark:text-emerald-400">{stats.highest}</span>
                <span className="text-neutral-400 text-sm font-sans mx-1">/</span>
                <span className="text-rose-600 dark:text-rose-400">{stats.lowest}</span>
              </>
            }
          />
        </NeonStatGrid>

        {/* ═══════════════════════════════════════════════════════════════
            3. FORMULA INFO STRIP
           ═══════════════════════════════════════════════════════════════ */}
        <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Rumus Penilaian:{" "}
              {hasEssay ? (
                <code className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                  (Objektif × 60%) + (Subjektif × 40%)
                </code>
              ) : (
                <code className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                  (Benar / {objectiveQuestions.length} Soal) × 100 (100% Objektif)
                </code>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
            <span>Objektif: {objectiveQuestions.length} soal</span>
            {hasEssay && (
              <>
                <span>•</span>
                <span>Uraian: {essayQuestions.length} soal</span>
              </>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            4. MAIN NEON TABLE
           ═══════════════════════════════════════════════════════════════ */}
        <NeonTable<any>
          data={filteredStudents}
          columns={columns}
          keyExtractor={(std) => std.id}
          title="Daftar Penilaian Siswa"
          subtitle="Klik nama siswa atau tombol detail untuk memeriksa jawaban butir per butir."
          searchPlaceholder={`Cari nama ${terminology.student?.toLowerCase() || "siswa"} atau NISN...`}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          filterSlot={
            <div className="flex items-center gap-2">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="h-8 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5 py-1 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 text-neutral-700 dark:text-neutral-300 cursor-pointer"
              >
                <option value="all">Semua {terminology.class || "Kelas"}</option>
                {examClasses
                  .filter(c => {
                    if (room?.allClasses || room?.all_classes) return true;
                    const raw = room?.classId || room?.classid || room?.classIds || "";
                    const ids = Array.isArray(raw) ? raw : String(raw).split(",").map(s => s.trim());
                    return ids.includes(c.id);
                  })
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                }
              </select>
            </div>
          }
          onRowClick={(std) => navigate(`/admin/penilaian/${std.id}?roomId=${roomId || ""}`)}
          pagination={true}
          pageSize={25}
          pageSizeOptions={[10, 25, 50, 100]}
          emptyTitle="Tidak Ada Data Penilaian"
          emptySubtitle="Belum ada siswa yang sesuai dengan filter pencarian atau belum ada pengerjaan ujian."
        />

      </div>
    </div>
  );
};

export default GradingPage;
