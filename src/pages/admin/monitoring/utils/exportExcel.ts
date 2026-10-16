import * as XLSX from "xlsx-js-style";
import { checkAns, getTargetQuestions, computeQuestionScore, stripHtmlTags } from "./helpers";

export interface ExportExcelParams {
  monitorRoom: any;
  students: any[];
  attempts: any[];
  monitorQuestions: any[];
  terminology: any;
  examClasses: any[];
  monitorClassFilter: string;
  getLiveScore: (answers: Record<string, any>, overrides?: Record<string, boolean>) => number;
  showAlert: (title: string, description: string, type?: "success" | "danger" | "warning" | "info") => void;
}

export function exportRecapExcel({ monitorRoom, students, attempts, monitorQuestions, terminology, examClasses, monitorClassFilter, getLiveScore, showAlert }: ExportExcelParams): void {
  if (!monitorRoom) return;
  const workbook = XLSX.utils.book_new();

  // Helper: format answer for display in Excel

  // Helper: format answer for display in Excel
  const formatAnswer = (q: any, studentAns: any) => {
    if (studentAns === undefined || studentAns === null) return "-";
    const type = q.type || q.field || "pilihan_ganda";

    if (type === "pilihan_ganda" || type === "multiple_choice") {
      return String(studentAns).toUpperCase();
    }
    if (type === "benar_salah" || type === "true_false") {
      const sts = q.statements || (q.choices && q.choices.statements);
      if (Array.isArray(sts) && sts.length > 0 && typeof studentAns === "object" && studentAns !== null) {
        return sts.map((st: any, idx: number) => {
          const val = studentAns[st.id] !== undefined
            ? studentAns[st.id]
            : (studentAns[String(idx + 1)] !== undefined
                ? studentAns[String(idx + 1)]
                : (studentAns[String(idx)] !== undefined ? studentAns[String(idx)] : "-"));
          const displayVal = val ? (String(val).toLowerCase() === "salah" ? "SALAH" : String(val).toLowerCase() === "benar" ? "BENAR" : String(val).toUpperCase()) : "-";
          return `${idx + 1}:${displayVal}`;
        }).join(", ");
      }
      if (typeof studentAns === "object" && !Array.isArray(studentAns) && studentAns !== null) {
        return Object.entries(studentAns).map(([k, v], idx) => {
          const num = /^\d+$/.test(k) && Number(k) < 100 ? k : `${idx + 1}`;
          return `${num}:${String(v).toUpperCase()}`;
        }).join(", ");
      }
      return String(studentAns).toUpperCase();
    }
    if (type === "pilihan_ganda_kompleks" || type === "complex_choice" || type === "complex_multiple_choice") {
      return Array.isArray(studentAns) ? studentAns.map((k: any) => String(k).toUpperCase()).join(",") : String(studentAns).toUpperCase();
    }
    if (type === "uraian") {
      const text = String(studentAns).replace(/<[^>]*>/g, '').trim();
      return text.length > 100 ? text.substring(0, 100) + "..." : text;
    }
    if (type === "urutkan" || type === "drag_drop" || type === "ordering") {
      return Array.isArray(studentAns) ? studentAns.join(" → ") : String(studentAns);
    }
    if (type === "menjodohkan" || type === "matching") {
      const pairs = q.pairs || [];
      if (pairs.length > 0 && typeof studentAns === "object" && !Array.isArray(studentAns) && studentAns !== null) {
        return pairs.map((p: any, idx: number) => {
          const userVal = studentAns[p.id] !== undefined ? studentAns[p.id] : (studentAns[String(idx + 1)] || "-");
          return `${idx + 1}:${userVal}`;
        }).join(", ");
      }
      if (typeof studentAns === "object" && !Array.isArray(studentAns) && studentAns !== null) {
        return Object.entries(studentAns).map(([k, v], idx) => {
          const num = /^\d+$/.test(k) && Number(k) < 100 ? k : `${idx + 1}`;
          return `${num}=${v}`;
        }).join(", ");
      }
      return String(studentAns);
    }
    if (type === "klasifikasi" || type === "matriks") {
      const stmts = q.statements || (q.choices && q.choices.statements) || [];
      const cats = q.categories || q.columns || (q.choices && (q.choices.categories || q.choices.columns)) || [];
      const catMap: Record<string, string> = {};
      if (Array.isArray(cats)) cats.forEach((c: any) => { catMap[String(c.id)] = String(c.text || c.id); });
      if (Array.isArray(stmts) && stmts.length > 0 && typeof studentAns === "object" && studentAns !== null && !Array.isArray(studentAns)) {
        return stmts.map((st: any, idx: number) => {
          const sid = String(st.id ?? idx);
          const val = studentAns[sid] !== undefined ? String(studentAns[sid]) : "-";
          return `${idx + 1}:${catMap[val] || val}`;
        }).join(", ");
      }
      return String(studentAns);
    }
    if (type === "isian_rumpang" || type === "cloze") {
      const blanks = q.blanks || (q.choices && q.choices.blanks) || [];
      if (Array.isArray(blanks) && blanks.length > 0 && typeof studentAns === "object" && studentAns !== null && !Array.isArray(studentAns)) {
        return blanks.map((bl: any, idx: number) => {
          const bid = String(bl.id ?? idx);
          const val = studentAns[bid] !== undefined ? String(studentAns[bid]).trim() : "-";
          return `${idx + 1}:${val || "-"}`;
        }).join(", ");
      }
      return String(studentAns);
    }
    if (type === "hotspot") {
      if (Array.isArray(studentAns)) {
        return `${studentAns.length} titik`;
      }
      if (studentAns !== null && typeof studentAns === "object" && !Array.isArray(studentAns)) {
        const hx = Number(studentAns.x), hy = Number(studentAns.y);
        if (!isNaN(hx) && !isNaN(hy)) return `(${Math.round(hx)}%, ${Math.round(hy)}%)`;
      }
      return String(studentAns);
    }
    return String(studentAns);
  };

  // Type label for header
  const typeLabel = (type: string) => {
    switch (type) {
      case "pilihan_ganda": return "PG";
      case "pilihan_ganda_kompleks": return "PGK";
      case "benar_salah": return "BS";
      case "menjodohkan": return "JDH";
      case "urutkan": return "URU";
      case "drag_drop": return "DD";
      case "isian_singkat": return "IS";
      case "uraian": return "UR";
      case "klasifikasi": return "KLAS";
      case "hotspot": return "HS";
      case "isian_rumpang": return "IR";
      case "matriks": return "MTX";
      default: return "PG";
    }
  };

  // Prepare style tokens
  const STYLES = {
    header: {
      fill: { fgColor: { rgb: "4F46E5" } }, // Indigo 600
      font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 },
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    cell: {
      alignment: { vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    cellCenter: {
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    correct: {
      fill: { patternType: "solid", fgColor: { rgb: "DCFCE7" } },
      font: { color: { rgb: "16A34A" }, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    wrong: {
      fill: { patternType: "solid", fgColor: { rgb: "FEE2E2" } },
      font: { color: { rgb: "DC2626" }, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    partial: {
      fill: { patternType: "solid", fgColor: { rgb: "FEF3C7" } }, // Amber 100
      font: { color: { rgb: "B45309" }, bold: true }, // Amber 700
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    unassignedDarkGray: {
      fill: { patternType: "solid", fgColor: { rgb: "64748B" } }, // Abu-abu pekat untuk soal di luar kuota siswa
      font: { color: { rgb: "E2E8F0" } }, // Teks tanda - abu terang
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    unansweredWhite: {
      fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } }, // Putih untuk soal dapat siswa tapi tidak dijawab
      font: { color: { rgb: "94A3B8" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    neutral: {
      fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
      font: { color: { rgb: "64748B" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    finalGreen: {
      fill: { patternType: "solid", fgColor: { rgb: "D1FAE5" } },
      font: { color: { rgb: "065F46" }, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    finalYellow: {
      fill: { patternType: "solid", fgColor: { rgb: "FEF9C3" } },
      font: { color: { rgb: "854D0E" }, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    finalRed: {
      fill: { patternType: "solid", fgColor: { rgb: "FEE2E2" } },
      font: { color: { rgb: "991B1B" }, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    }
  };

  const getFinalScoreStyle = (score: number) => {
    if (score >= 75) return STYLES.finalGreen;
    if (score >= 50) return STYLES.finalYellow;
    return STYLES.finalRed;
  };

  const COL_WIDTHS = [
    { wch: 4 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 22 },
    { wch: 10 }, { wch: 8 },
    { wch: 14 }, { wch: 8 }, { wch: 8 }, // Objektif: Jumlah Benar, 100%, 60%
    { wch: 14 }, { wch: 8 }, // Subjektif: Jumlah Benar, 40%
    { wch: 8 } // Nilai
  ];
  monitorQuestions.forEach((q) => {
    const type = q.type || "pilihan_ganda";
    const isEssay = type === "uraian";
    COL_WIDTHS.push({ wch: isEssay ? 30 : 10 });
  });

  const filteredStudents = students
    .map(s => ({
      ...s,
      className: examClasses.find(c => c.id === s.classId)?.name || "N/A"
    }))
    .filter(s => {
      if (monitorRoom?.allClasses) {
        if (monitorClassFilter !== "all" && s.className !== monitorClassFilter) return false;
        return true;
      }
      const allowedIds = Array.isArray(monitorRoom?.classId) ? monitorRoom?.classId : String(monitorRoom?.classId || "").split(",");
      if (!allowedIds.includes(s.classId)) return false;
      if (monitorClassFilter !== "all" && s.className !== monitorClassFilter) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const classesArray = Array.from(new Set(filteredStudents.map(s => s.className))).sort();
  const buildSheet = (groupStudents: any[], sheetName: string) => {
    const headerRow1 = [
      "No", terminology.id, "Nama", terminology.class, "Login", "Durasi", "Submit",
      "Objektif", "", "", "Subjektif", "", "Nilai"
    ];
    const headerRow2 = [
      "", "", "", "", "", "", "",
      "Jumlah Benar", "100%", "60%", "Jumlah Benar", "40%", ""
    ];

    monitorQuestions.forEach((q, i) => {
      const type = q.type || "pilihan_ganda";
      headerRow1.push(`Q${i + 1} (${typeLabel(type)})`);
      headerRow2.push("");
    });

    const rows: any[][] = [
      headerRow1.map(h => ({ v: h, s: STYLES.header })),
      headerRow2.map(h => ({ v: h, s: STYLES.header }))
    ];

    const merges: any[] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },
      { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },
      { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } },
      { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } },
      { s: { r: 0, c: 7 }, e: { r: 0, c: 9 } },
      { s: { r: 0, c: 10 }, e: { r: 0, c: 11 } },
      { s: { r: 0, c: 12 }, e: { r: 1, c: 12 } }
    ];

    monitorQuestions.forEach((_, i) => {
      merges.push({ s: { r: 0, c: 13 + i }, e: { r: 1, c: 13 + i } });
    });

    groupStudents.forEach((std, idx) => {
      const atts = attempts.filter(a => a.studentId === std.id || a.student_id === std.id);
      const att = atts.sort((ax, bx) => new Date(bx.created).getTime() - new Date(ax.created).getTime())[0];
      const answers = att?.answers || {};
      // Merge overrides from both field and answers.__overrides__ backup
      const rawOverrides = typeof att?.overrides === 'string' ? JSON.parse(att.overrides) : (att?.overrides || {});
      const answersOverrides = (answers as any)?.__overrides__ || {};
      const overrides: Record<string, boolean> = { ...answersOverrides, ...rawOverrides };

      const targetQuestions = getTargetQuestions(monitorQuestions, answers, monitorRoom?.max_questions);

      // Calculate scores per category
      let objCorrect = 0, objTotal = 0, essCorrect = 0, essTotal = 0;
      targetQuestions.forEach((q: any) => {
        const type = q.type || q.field || "pilihan_ganda";
        const isEssay = type === "uraian";
        const s = computeQuestionScore(q, answers[q.id], overrides);
        if (isEssay) { essTotal++; essCorrect += s; }
        else { objTotal++; objCorrect += s; }
      });
      objCorrect = Math.min(objCorrect, objTotal);
      const displayObjCorrect = Number.isInteger(objCorrect) ? objCorrect : (Math.round(objCorrect * 10) / 10);

      if (objTotal === 0 && essTotal === 0) {
        const maxQ = monitorRoom?.max_questions && monitorRoom.max_questions > 0
          ? monitorRoom.max_questions
          : monitorQuestions.filter((q: any) => q.type !== "uraian").length;
        objTotal = maxQ;
      }

      const objScore = objTotal > 0 ? Math.round((objCorrect / objTotal) * 100) : 0;
      const essScore = essTotal > 0 ? Math.round((essCorrect / essTotal) * 100) : 0;
      let finalScore = att?.score || 0;
      if (att?.status === "finished" && finalScore === 0) {
        finalScore = getLiveScore(answers, overrides);
      }
      if (!finalScore) {
        finalScore = essTotal === 0 ? objScore : Math.round(objScore * 0.6 + essScore * 0.4);
      }

      // Calculate duration
      let durationStr = "-";
      const loginTime = att?.startedAt || att?.startTime || att?.created;
      if (loginTime) {
        const startMs = new Date(loginTime).getTime();
        const endMs = att?.submitTime ? new Date(att.submitTime).getTime() :
          (att?.submittedAt ? new Date(att.submittedAt).getTime() :
            (att?.status === "finished" ? new Date(att.updated || att.created).getTime() : Date.now()));
        const diffMs = Math.max(0, endMs - startMs);
        const dHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const dMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const dSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
        durationStr = dHrs > 0
          ? `${dHrs}j ${dMins}m ${dSecs}d`
          : `${dMins}m ${dSecs}d`;
      }

      const essGraded = Object.keys(overrides).filter(k => { const q = targetQuestions.find((x: any) => x.id === k); return q && (q.type === "uraian"); }).length;

      const finalVal = Math.round(finalScore) || 0;
      const ri = idx + 3;

      const row = [
        { v: idx + 1, s: STYLES.cellCenter },
        { v: std.nisn, s: STYLES.cellCenter },
        { v: std.name, s: STYLES.cell },
        { v: std.className, s: STYLES.cellCenter },
        { v: loginTime ? new Date(loginTime).toLocaleString("id-ID", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "-", s: STYLES.cellCenter },
        { v: durationStr, s: STYLES.cellCenter },
        { v: att?.submitTime ? new Date(att.submitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (att?.submittedAt ? new Date(att.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (att?.status === "finished" ? "Selesai" : (att ? "Proses" : "-"))), s: STYLES.cellCenter },
        { t: "s", v: `${displayObjCorrect}/${objTotal}`, z: "@", s: STYLES.cellCenter },
        { t: "n", v: Number(objScore), s: getFinalScoreStyle(objScore) },
        { t: "n", v: Math.round(objScore * 0.6), f: `ROUND(I${ri}*0.6,0)`, s: STYLES.cellCenter },
        essTotal > 0 ? (
          essGraded < essTotal ?
            { t: "s", v: `${essGraded}/${essTotal} dinilai`, s: STYLES.cellCenter } :
            { t: "s", v: `${essCorrect}/${essTotal}`, z: "@", s: STYLES.cellCenter }
        ) : { t: "s", v: "-", s: STYLES.cellCenter },
        { t: "n", v: essTotal > 0 ? Math.round(essScore * 0.4) : 0, s: STYLES.cellCenter },
        { t: "n", v: finalVal, f: essTotal > 0 ? `ROUND(J${ri}+L${ri},0)` : `I${ri}`, s: getFinalScoreStyle(finalVal) }
      ];

      monitorQuestions.forEach(q => {
        const isQuestionAssigned = targetQuestions.some((tq: any) => tq.id === q.id);
        const ans = answers[q.id];
        const isOverridden = overrides[q.id] !== undefined;
        const display = isOverridden ? `${formatAnswer(q, ans)} ✓` : formatAnswer(q, ans);

        let cellStyle = STYLES.unansweredWhite;
        let cellValue = "-";

        if (!isQuestionAssigned) {
          // Soal acak yang TIDAK didapat siswa → warna abu pekat
          cellStyle = STYLES.unassignedDarkGray;
          cellValue = "-";
        } else if (!ans && !isOverridden) {
          // Soal yang didapat siswa tapi TIDAK dijawab → warna putih
          cellStyle = STYLES.unansweredWhite;
          cellValue = "-";
        } else {
          // Soal yang didapat dan dijawab siswa
          cellValue = display;
          if (q.type === "uraian" && !isOverridden) {
            cellStyle = STYLES.neutral;
          } else {
            const qScore = computeQuestionScore(q, ans, overrides);
            cellStyle = qScore >= 1 ? STYLES.correct : (qScore > 0 ? STYLES.partial : STYLES.wrong);
          }
        }

        row.push({
          v: cellValue,
          s: cellStyle
        });
      });

      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = COL_WIDTHS;
    ws["!merges"] = merges;
    XLSX.utils.book_append_sheet(workbook, ws, sheetName.substring(0, 31));
  };

  // Build Master Sheet if multiple classes
  if (classesArray.length > 1) {
    buildSheet(filteredStudents, "SEMUA KELAS");
  }

  // Build Per-Class Sheets
  classesArray.forEach(cls => {
    buildSheet(filteredStudents.filter(s => s.className === cls), cls);
  });

  // Sheet: Siswa Belum Ujian
  const absentStudents = filteredStudents.filter(s => {
    const att = attempts.filter(a => a.studentId === s.id || a.student_id === s.id)[0];
    return !att;
  }).sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));

  if (absentStudents.length > 0) {
    const absentHeader = ["No", terminology.id, "Nama", terminology.class].map(h => ({
      v: h,
      s: {
        fill: { fgColor: { rgb: "DC2626" } },
        font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      }
    }));
    const absentRows: any[][] = [absentHeader];
    absentStudents.forEach((s, idx) => {
      absentRows.push([
        { v: idx + 1, s: STYLES.cellCenter },
        { v: s.nisn, s: STYLES.cellCenter },
        { v: s.name, s: STYLES.cell },
        { v: s.className, s: STYLES.cellCenter },
      ]);
    });
    const wsAbsent = XLSX.utils.aoa_to_sheet(absentRows);
    wsAbsent["!cols"] = [{ wch: 4 }, { wch: 15 }, { wch: 30 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, wsAbsent, "Belum Ujian");
  }

  XLSX.writeFile(workbook, `Rekap_${monitorRoom.room_name || "Monitoring"}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export function exportEssayExcel({ monitorRoom, students, attempts, monitorQuestions, terminology, examClasses, monitorClassFilter, showAlert }: ExportExcelParams): void {
  if (!monitorRoom) return;

  const essayQuestions = monitorQuestions.filter((q: any) => q.type === "uraian");
  if (essayQuestions.length === 0) {
    showAlert("Informasi", "Tidak ada soal essay (isian singkat atau uraian) di ruang ujian ini.", "warning");
    return;
  }

  const workbook = XLSX.utils.book_new();

  const formatAnswerFull = (studentAns: any) => {
    if (!studentAns) return "-";
    return String(studentAns).replace(/<[^>]*>/g, '').trim();
  };

  const typeLabel = (type: string) => {
    return type === "isian_singkat" ? "Isian" : "Uraian";
  };

  const STYLES = {
    header: {
      fill: { fgColor: { rgb: "0F766E" } }, // Teal 700
      font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    questionHeader: {
      fill: { fgColor: { rgb: "F0FDFA" } }, // Teal 50 bg
      font: { color: { rgb: "0F766E" }, bold: true, sz: 10 },
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    titleHeader: {
      font: { bold: true, sz: 14, color: { rgb: "0F766E" } },
      alignment: { horizontal: "left", vertical: "center" }
    },
    cell: {
      alignment: { vertical: "center", wrapText: true },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    cellCenter: {
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    correct: {
      fill: { patternType: "solid", fgColor: { rgb: "DCFCE7" } },
      font: { color: { rgb: "16A34A" }, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    wrong: {
      fill: { patternType: "solid", fgColor: { rgb: "FEE2E2" } },
      font: { color: { rgb: "DC2626" }, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    neutral: {
      fill: { patternType: "solid", fgColor: { rgb: "FEF9C3" } }, // Yellowish for ungraded
      font: { color: { rgb: "854D0E" }, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    nilaiEssay: {
      fill: { patternType: "solid", fgColor: { rgb: "E0F2FE" } }, // Sky 100
      font: { color: { rgb: "0369A1" }, bold: true, sz: 11 }, // Sky 700
      alignment: { horizontal: "center", vertical: "center" },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    },
    nilaiEssayHeader: {
      fill: { fgColor: { rgb: "0284C7" } }, // Sky 600
      font: { color: { rgb: "FFFFFF" }, bold: true, sz: 10 },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    }
  };

  const COL_WIDTHS = [
    { wch: 5 },   // No
    { wch: 18 },  // NISN
    { wch: 30 },  // Nama
    { wch: 12 },  // Kelas
    { wch: 15 },  // Nilai Essay (100%)
    { wch: 15 },  // Nilai Essay (40%)
  ];
  essayQuestions.forEach(() => {
    COL_WIDTHS.push({ wch: 50 }); // Jawaban
    COL_WIDTHS.push({ wch: 15 }); // Status
  });

  const filteredStudents = students
    .map(s => ({
      ...s,
      className: examClasses.find(c => c.id === s.classId)?.name || "N/A"
    }))
    .filter(s => {
      if (monitorRoom?.allClasses) {
        if (monitorClassFilter !== "all" && s.className !== monitorClassFilter) return false;
        return true;
      }
      const allowedIds = Array.isArray(monitorRoom?.classId) ? monitorRoom?.classId : String(monitorRoom?.classId || "").split(",");
      if (!allowedIds.includes(s.classId)) return false;
      if (monitorClassFilter !== "all" && s.className !== monitorClassFilter) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const classesArray = Array.from(new Set(filteredStudents.map(s => s.className))).sort();

  const buildEssaySheet = (groupStudents: any[], sheetName: string) => {
    const titleRow = [
      { v: `REKAP JAWABAN ESSAY - ${monitorRoom.room_name || "MONITORING"}`, s: STYLES.titleHeader }
    ];

    const emptyRow: any[] = [];

    const questionTextRow: any[] = [
      { v: "PERTANYAAN SOAL", s: STYLES.header },
      { v: "", s: STYLES.header },
      { v: "", s: STYLES.header },
      { v: "", s: STYLES.header },
      { v: "", s: STYLES.header }, // Nilai Essay (100%) column span placeholder
      { v: "", s: STYLES.header }  // Nilai Essay (40%) column span placeholder
    ];

    essayQuestions.forEach((q, i) => {
      const qTextClean = stripHtmlTags(q.text || "");
      questionTextRow.push({ v: `Q${i + 1} [${typeLabel(q.type)}]: ${qTextClean}`, s: STYLES.questionHeader });
      questionTextRow.push({ v: "", s: STYLES.questionHeader });
    });

    const headerRow = [
      { v: "No", s: STYLES.header },
      { v: terminology.id || "NISN", s: STYLES.header },
      { v: "Nama Peserta", s: STYLES.header },
      { v: terminology.class || "Kelas", s: STYLES.header },
      { v: `Nilai Essay (100%)`, s: STYLES.nilaiEssayHeader },
      { v: `Nilai Essay (40%)`, s: STYLES.nilaiEssayHeader }
    ];

    essayQuestions.forEach((q, i) => {
      headerRow.push({ v: `Jawaban Q${i + 1}`, s: STYLES.header });
      headerRow.push({ v: `Status Q${i + 1}`, s: STYLES.header });
    });

    const rows: any[][] = [
      titleRow,
      emptyRow,
      questionTextRow,
      headerRow
    ];

    const merges: any[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 + essayQuestions.length * 2 } }, // Title spans all cols incl. Nilai 100% & 40%
      { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }  // "PERTANYAAN SOAL" spans No+NISN+Nama+Kelas+Nilai100+Nilai40
    ];

    essayQuestions.forEach((_, i) => {
      merges.push({
        s: { r: 2, c: 6 + i * 2 },
        e: { r: 2, c: 6 + i * 2 + 1 }
      });
    });

    groupStudents.forEach((std, idx) => {
      const atts = attempts.filter(a => a.studentId === std.id || a.student_id === std.id);
      const att = atts.sort((ax, bx) => new Date(bx.created).getTime() - new Date(ax.created).getTime())[0];
      const answers = att?.answers || {};
      const rawOverrides = typeof att?.overrides === 'string' ? JSON.parse(att.overrides) : (att?.overrides || {});
      const answersOverrides = (answers as any)?.__overrides__ || {};
      const overrides: Record<string, boolean> = { ...answersOverrides, ...rawOverrides };

      // Calculate essay score for this student
      const essayCorrectCount = essayQuestions.filter(q => checkAns(q, answers[q.id], overrides)).length;
      const essayTotal = essayQuestions.length;
      const essayScoreRaw = att ? Math.round((essayCorrectCount / essayTotal) * 100) : null;
      // Weighted contribution = essayScore * 40%
      const essayWeighted = essayScoreRaw !== null ? Math.round(essayScoreRaw * 0.4) : null;

      const rowNum = idx + 5;

      const row = [
        { v: idx + 1, s: STYLES.cellCenter },
        { v: std.nisn, s: STYLES.cellCenter },
        { v: std.name, s: STYLES.cell },
        { v: std.className, s: STYLES.cellCenter },
        {
          v: essayScoreRaw !== null ? essayScoreRaw : "—",
          s: STYLES.nilaiEssay
        },
        {
          f: essayScoreRaw !== null ? `ROUND(E${rowNum}*0.4,0)` : undefined,
          v: essayScoreRaw !== null ? essayWeighted : "—",
          s: STYLES.nilaiEssay
        }
      ];

      essayQuestions.forEach(q => {
        const ans = answers[q.id];
        const isOverridden = overrides[q.id] !== undefined;
        const isCorrect = checkAns(q, ans, overrides);
        const fullAnsText = formatAnswerFull(ans);

        row.push({ v: fullAnsText, s: STYLES.cell });

        let statusVal = "Belum Dinilai";
        let cellStyle = STYLES.neutral;

        if (isOverridden) {
          statusVal = isCorrect ? "Benar" : "Salah";
          cellStyle = isCorrect ? STYLES.correct : STYLES.wrong;
        } else if (ans) {
          if (q.type === "isian_singkat") {
            statusVal = isCorrect ? "Benar" : "Salah";
            cellStyle = isCorrect ? STYLES.correct : STYLES.wrong;
          } else {
            statusVal = "Belum Dinilai";
            cellStyle = STYLES.neutral;
          }
        } else {
          statusVal = "Tidak Dijawab";
          cellStyle = STYLES.wrong;
        }

        row.push({ v: statusVal, s: cellStyle });
      });

      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = COL_WIDTHS;
    ws["!merges"] = merges;
    XLSX.utils.book_append_sheet(workbook, ws, sheetName.substring(0, 31));
  };

  if (classesArray.length > 1) {
    buildEssaySheet(filteredStudents, "SEMUA KELAS ESSAY");
  }

  classesArray.forEach(cls => {
    buildEssaySheet(filteredStudents.filter(s => s.className === cls), cls);
  });

  XLSX.writeFile(workbook, `Rekap_Essay_${monitorRoom.room_name || "Monitoring"}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
