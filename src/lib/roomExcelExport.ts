import JSZip from "jszip";
import * as XLSX from "xlsx-js-style";

// 🛡️ Fuzzy Match Helper for Short Answers
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

// Helper for answer comparison (all types)
const checkAns = (q: any, studentAns: any, overrides?: Record<string, boolean>) => {
  if (overrides && overrides[q.id] !== undefined) return overrides[q.id];
  if (!studentAns) return false;
  const type = q.type || q.field || "pilihan_ganda";

  if (type === "pilihan_ganda" || type === "benar_salah") {
    const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(studentAns).toLowerCase());
    return ck ? q.choices[ck].isCorrect === true : false;
  }
  if (type === "pilihan_ganda_kompleks") {
    const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase());
    const studentKeys = Array.isArray(studentAns) ? studentAns.map((k: any) => String(k).toLowerCase()) : [];
    return studentKeys.length === correctKeys.length && studentKeys.every((k: string) => correctKeys.includes(k));
  }
  if (type === "isian_singkat") {
    return isFuzzyMatch(studentAns, q.answerKey);
  }
  if (type === "urutkan" || type === "drag_drop") {
    const co = (q.items || []).map((it: any) => it.id);
    return Array.isArray(studentAns) && studentAns.length === co.length && studentAns.every((v: any, i: number) => v === co[i]);
  }
  if (type === "menjodohkan") {
    const pairs = q.pairs || [];
    return pairs.length > 0 && pairs.every((p: any) => studentAns[p.id] === p.right);
  }
  return false;
};

// 📝 Real-time Live Score Calculator (Weighted: objective + essay)
const getLiveScore = (sisAnswers: Record<string, any>, monitorQuestions: any[], attOverrides: Record<string, boolean> = {}) => {
  if (!sisAnswers || monitorQuestions.length === 0) return 0;

  // Fallback: read overrides from answers.__overrides__ if attOverrides is empty
  const overrides = Object.keys(attOverrides).length > 0 ? attOverrides : ((sisAnswers as any)?.__overrides__ || {});

  let objectiveCorrect = 0;
  let objectiveTotal = 0;
  let essayCorrect = 0;
  let essayTotal = 0;

  monitorQuestions.forEach((q: any) => {
    const type = q.type || "pilihan_ganda";
    const isEssay = type === "isian_singkat" || type === "uraian";
    let itemCorrect = false;

    if (overrides[q.id] !== undefined) {
      itemCorrect = overrides[q.id];
    } else {
      const ansId = sisAnswers[q.id];
      if (ansId !== undefined && ansId !== null) {
        if (type === "pilihan_ganda" || type === "benar_salah") {
          const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === String(ansId).toLowerCase());
          itemCorrect = ck ? q.choices[ck].isCorrect === true : false;
        } else if (type === "pilihan_ganda_kompleks") {
          const correctKeys = Object.keys(q.choices || {}).filter(k => q.choices[k].isCorrect).map(k => k.toLowerCase());
          const studentKeys = Array.isArray(ansId) ? ansId.map(k => String(k).toLowerCase()) : [];
          itemCorrect = studentKeys.length === correctKeys.length && studentKeys.every(k => correctKeys.includes(k));
        } else if (type === "isian_singkat") {
          itemCorrect = isFuzzyMatch(ansId, q.answerKey);
        } else if (type === "urutkan" || type === "drag_drop") {
          const co = (q.items || []).map((it: any) => it.id);
          itemCorrect = Array.isArray(ansId) && ansId.length === co.length && ansId.every((v, i) => v === co[i]);
        } else if (type === "menjodohkan") {
          const pairs = q.pairs || [];
          itemCorrect = pairs.length > 0 && pairs.every((p: any) => ansId[p.id] === p.right);
        }
      }
    }

    if (isEssay) {
      essayTotal++;
      if (itemCorrect) essayCorrect++;
    } else {
      objectiveTotal++;
      if (itemCorrect) objectiveCorrect++;
    }
  });

  // Weighted final score: 60% objektif, 40% essay (jika ada essay)
  if (essayTotal === 0) {
    return objectiveTotal > 0 ? Math.round((objectiveCorrect / objectiveTotal) * 100) : 0;
  }

  const objScore = objectiveTotal > 0 ? (objectiveCorrect / objectiveTotal) * 100 : 0;
  const essScore = essayTotal > 0 ? (essayCorrect / essayTotal) * 100 : 0;
  return Math.round(objScore * 0.6 + essScore * 0.4);
};

// Helper: format answer for display in Excel
const formatAnswer = (q: any, studentAns: any) => {
  if (!studentAns) return "-";
  const type = q.type || "pilihan_ganda";

  if (type === "pilihan_ganda" || type === "benar_salah") {
    return String(studentAns).toUpperCase();
  }
  if (type === "pilihan_ganda_kompleks") {
    return Array.isArray(studentAns) ? studentAns.map((k: any) => String(k).toUpperCase()).join(",") : String(studentAns).toUpperCase();
  }
  if (type === "isian_singkat" || type === "uraian") {
    const text = String(studentAns).replace(/<[^>]*>/g, '').trim();
    return text.length > 100 ? text.substring(0, 100) + "..." : text;
  }
  if (type === "urutkan" || type === "drag_drop") {
    return Array.isArray(studentAns) ? studentAns.join(" → ") : String(studentAns);
  }
  if (type === "menjodohkan") {
    if (typeof studentAns === "object" && !Array.isArray(studentAns)) {
      return Object.entries(studentAns).map(([k, v]) => `${k}=${v}`).join(", ");
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
    default: return "PG";
  }
};

interface ExportRoomsToZipParams {
  rooms: any[];
  students: any[];
  examClasses: any[];
  pb: any;
  terminology: any;
}

export async function exportActiveRoomsToZip({
  rooms,
  students,
  examClasses,
  pb,
  terminology
}: ExportRoomsToZipParams) {
  if (!pb || rooms.length === 0) return;

  const zip = new JSZip();

  // STYLES definition
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
    neutral: {
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

  // Group exams to fetch questions in batches (faster than fetching one-by-one sequentially)
  const examIds = Array.from(new Set(rooms.map(r => r.examId).filter(Boolean)));
  const questionsByExam: Record<string, any[]> = {};

  for (const examId of examIds) {
    try {
      const qList = await pb.collection('questions').getFullList({
        filter: `examId = "${examId}"`,
        sort: 'order,created'
      });

      const mappedQuestions = qList.map((q: any) => {
        const rawType = q.field || q.type || "pilihan_ganda";
        const typeMapReverse: Record<string, string> = {
          multiple_choice: "pilihan_ganda",
          complex_multiple_choice: "pilihan_ganda_kompleks",
          matching: "menjodohkan",
          true_false: "benar_salah",
          short_answer: "isian_singkat",
          essay: "uraian",
          ordering: "urutkan",
          drag_drop: "drag_drop",
          pilihan_ganda: "pilihan_ganda",
          pilihan_ganda_kompleks: "pilihan_ganda_kompleks",
          isian_singkat: "isian_singkat",
          uraian: "uraian",
          menjodohkan: "menjodohkan",
          urutkan: "urutkan",
          benar_salah: "benar_salah"
        };
        const mappedType = typeMapReverse[rawType] || rawType;
        const options = q.options || {};
        return {
          ...q,
          type: mappedType,
          choices: options,
          pairs: mappedType === "menjodohkan" ? options.pairs : undefined,
          items: (mappedType === "urutkan" || mappedType === "drag_drop") ? options.items : undefined,
          answerKey: q.correctAnswer || q.answerKey
        };
      });

      questionsByExam[examId] = Array.from(new Map(mappedQuestions.map((q: any) => [q.id, q])).values())
        .sort((a: any, b: any) => {
          const aIsEssay = a.type === "isian_singkat" || a.type === "uraian";
          const bIsEssay = b.type === "isian_singkat" || b.type === "uraian";
          if (aIsEssay && !bIsEssay) return 1;
          if (!aIsEssay && bIsEssay) return -1;
          return 0;
        });
    } catch (err) {
      console.error(`Gagal mengambil soal untuk exam ${examId}:`, err);
      questionsByExam[examId] = [];
    }
  }

  // Fetch attempts per room
  for (const room of rooms) {
    let attempts: any[] = [];
    try {
      attempts = await pb.collection('attempts').getFullList({
        filter: `examRoomId = "${room.id}"`
      });
    } catch (err) {
      console.error(`Gagal mengambil pengerjaan untuk ruangan ${room.room_name || room.id}:`, err);
    }

    const monitorQuestions = questionsByExam[room.examId] || [];

    const workbook = XLSX.utils.book_new();

    const COL_WIDTHS = [
      { wch: 4 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 22 },
      { wch: 10 }, { wch: 8 },
      { wch: 14 }, { wch: 8 }, { wch: 8 }, // Objektif: Jumlah Benar, 100%, 60%
      { wch: 14 }, { wch: 8 }, // Subjektif: Jumlah Benar, 40%
      { wch: 8 } // Nilai
    ];
    monitorQuestions.forEach((q: any) => {
      const type = q.type || "pilihan_ganda";
      const isEssay = type === "isian_singkat" || type === "uraian";
      COL_WIDTHS.push({ wch: isEssay ? 30 : 10 });
    });

    const filteredStudents = students
      .map(s => ({
        ...s,
        className: examClasses.find(c => c.id === s.classId)?.name || "N/A"
      }))
      .filter(s => {
        if (room.allClasses) return true;
        const allowedIds = Array.isArray(room.classId) ? room.classId : String(room.classId || "").split(",");
        return allowedIds.includes(s.classId);
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

      monitorQuestions.forEach((q: any, i: number) => {
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

      monitorQuestions.forEach((_: any, i: number) => {
        merges.push({ s: { r: 0, c: 13 + i }, e: { r: 1, c: 13 + i } });
      });

      groupStudents.forEach((std: any, idx: number) => {
        const atts = attempts.filter(a => a.studentId === std.id || a.student_id === std.id);
        const att = atts.sort((ax, bx) => new Date(bx.created).getTime() - new Date(ax.created).getTime())[0];
        const answers = att?.answers || {};
        const rawOverrides = typeof att?.overrides === 'string' ? JSON.parse(att.overrides) : (att?.overrides || {});
        const answersOverrides = (answers as any)?.__overrides__ || {};
        const overrides: Record<string, boolean> = { ...answersOverrides, ...rawOverrides };

        let objCorrect = 0, objTotal = 0, essCorrect = 0, essTotal = 0;
        monitorQuestions.forEach((q: any) => {
          const type = q.type || "pilihan_ganda";
          const isEssay = type === "isian_singkat" || type === "uraian";
          const ic = checkAns(q, answers[q.id], overrides);
          if (isEssay) { essTotal++; if (ic) essCorrect++; }
          else { objTotal++; if (ic) objCorrect++; }
        });

        const objScore = objTotal > 0 ? Math.round((objCorrect / objTotal) * 100) : 0;
        const essScore = essTotal > 0 ? Math.round((essCorrect / essTotal) * 100) : 0;
        let finalScore = att?.score || 0;
        if (att?.status === "finished" && finalScore === 0) {
          finalScore = getLiveScore(answers, monitorQuestions, overrides);
        }
        if (!finalScore) {
          finalScore = essTotal === 0 ? objScore : Math.round(objScore * 0.6 + essScore * 0.4);
        }

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

        const essGraded = Object.keys(overrides).filter((k: string) => {
          const q = monitorQuestions.find((x: any) => x.id === k);
          return q && (q.type === "isian_singkat" || q.type === "uraian");
        }).length;

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
          { t: "s", v: `${objCorrect}/${objTotal}`, z: "@", s: STYLES.cellCenter },
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

        monitorQuestions.forEach((q: any) => {
          const ans = answers[q.id];
          const isOverridden = overrides[q.id] !== undefined;
          const isCorrect = checkAns(q, ans, overrides);
          const display = isOverridden ? `${formatAnswer(q, ans)} ✓` : formatAnswer(q, ans);

          let cellStyle = STYLES.neutral;
          if (q.type === "uraian" && !isOverridden) {
            cellStyle = STYLES.neutral;
          } else if (ans || isOverridden) {
            cellStyle = isCorrect ? STYLES.correct : STYLES.wrong;
          }

          row.push({
            v: display,
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

    if (classesArray.length > 1) {
      buildSheet(filteredStudents, "SEMUA KELAS");
    }

    classesArray.forEach((cls: string) => {
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
      absentStudents.forEach((s: any, idx: number) => {
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

    // Write Excel workbook to binary buffer
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const cleanRoomName = (room.room_name || `Ruang_${room.id}`).replace(/[^a-zA-Z0-9_\-]/g, "_");
    zip.file(`Rekap_${cleanRoomName}_${new Date().toISOString().split('T')[0]}.xlsx`, excelBuffer);
  }

  // Generate ZIP and trigger download
  const content = await zip.generateAsync({ type: "blob" });
  const url = window.URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `Rekap_Semua_Ruang_Aktif_${new Date().toISOString().split('T')[0]}.zip`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
