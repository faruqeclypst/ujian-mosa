import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { Button } from "../../../../components/ui/button";
import { Zap, RefreshCw } from "lucide-react";

export interface QuickGradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pb: any;
  students: any[];
  attempts: any[];
  monitorQuestions: any[];
  showAlert: (title: string, description: string, type?: "success" | "danger" | "warning" | "info") => void;
}

export const QuickGradeDialog: React.FC<QuickGradeDialogProps> = ({
  open,
  onOpenChange,
  pb,
  students,
  attempts,
  monitorQuestions,
  showAlert,
}) => {
  const [quickGradeText, setQuickGradeText] = useState("");
  const [quickGradeProgress, setQuickGradeProgress] = useState<{ total: number; done: number; errors: string[] } | null>(null);
  const [quickGradeRunning, setQuickGradeRunning] = useState(false);

  const handleClose = () => {
    setQuickGradeProgress(null);
    onOpenChange(false);
  };

const handleQuickGrade = async () => {
  if (!pb || !quickGradeText.trim()) return;
  const essayQs = monitorQuestions.filter((q: any) => q.type === "uraian");
  if (essayQs.length === 0) { showAlert("Info", "Tidak ada soal essay di ruang ini.", "warning"); return; }

  // ── Smart parser: auto-detect format ──────────────────────────────────────
  // Supported formats:
  //   A) Tab-separated (Excel/Sheets copy) — with or without header
  //   B) Plain space-separated lines: "16 NAMA LENGKAP Benar Salah Benar"
  //      (no header needed; "Benar/Salah" keywords used as pivot)

  const GRADE_KEYWORDS = new Set(["benar", "salah", "b", "s", "true", "false", "1", "0", "ya", "tidak", "✓", "✗", "-"]);

  // Detect if a word is a grade value
  const isGradeWord = (w: string) => GRADE_KEYWORDS.has(w.toLowerCase());

  // Parse a single plain-text line → { name, grades[] }
  // Strategy: find first token that is a grade keyword; everything before = no+name
  const parsePlainLine = (line: string): { name: string; grades: string[] } | null => {
    const tokens = line.trim().split(/\s+/);
    let gradeStart = tokens.findIndex(t => isGradeWord(t));
    if (gradeStart === -1) return null;
    // strip leading number (nomor urut)
    let nameParts = tokens.slice(0, gradeStart);
    if (nameParts.length > 0 && /^\d+$/.test(nameParts[0])) nameParts = nameParts.slice(1);
    const name = nameParts.join(" ").trim();
    const grades = tokens.slice(gradeStart);
    return name ? { name, grades } : null;
  };

  const rawLines = quickGradeText.trim().split(/\r?\n/).filter(l => l.trim());

  // Determine mode: tab-separated or plain text
  const hasTabSep = rawLines.some(l => l.includes("\t"));

  type ParsedRow = { name: string; grades: string[] };
  let parsedRows: ParsedRow[] = [];

  if (hasTabSep) {
    // ── Mode A: Tab-separated (Excel/Google Sheets) ──────────────────────────
    const splitTab = (line: string) => line.split("\t").map(c => c.trim());
    const rows = rawLines.map(splitTab);

    // Detect header row: first row that contains "nama" or no grade keywords
    const firstRowLower = rows[0].map(c => c.toLowerCase());
    const isHeaderRow = firstRowLower.some(c => c === "nama" || c.includes("nama")) ||
      !firstRowLower.some(c => isGradeWord(c));

    let namaIdx = firstRowLower.findIndex(h => h === "nama" || h.includes("nama"));
    if (namaIdx === -1) namaIdx = 1;

    const dataRows = (isHeaderRow ? rows.slice(1) : rows).filter(r => r.length > namaIdx && r[namaIdx]?.trim());
    if (dataRows.length === 0) { showAlert("Error", "Tidak ada baris data. Pastikan format kolom benar.", "danger"); return; }

    const qColCount = rows[0].length - namaIdx - 1;
    parsedRows = dataRows.map(row => {
      const name = row[namaIdx] || "";
      const grades = row.slice(namaIdx + 1, namaIdx + 1 + Math.max(qColCount, essayQs.length));
      return { name: name.trim(), grades };
    }).filter(r => r.name);

  } else {
    // ── Mode B: Plain space-separated "No Nama Benar Salah..." ───────────────
    // Try to detect if first line is a header (contains "nama", "no", "q1" etc. but no grade values)
    const firstLineLower = rawLines[0].toLowerCase();
    const firstLineParsed = parsePlainLine(rawLines[0]);
    const isHeader = (firstLineLower.includes("nama") || firstLineLower.includes("no") || firstLineLower.startsWith("no\t")) && !firstLineParsed;
    const dataLines = isHeader ? rawLines.slice(1) : rawLines;

    for (const line of dataLines) {
      const p = parsePlainLine(line);
      if (p) parsedRows.push(p);
    }

    if (parsedRows.length === 0) {
      showAlert("Error", "Tidak dapat mem-parse baris data. Pastikan ada kata 'Benar' atau 'Salah' di setiap baris, atau gunakan format tab-separated dari Excel.", "danger");
      return;
    }
  }

  if (parsedRows.length === 0) { showAlert("Error", "Tidak ada baris data yang valid.", "danger"); return; }

  // Helper: normalize name for comparison
  const normName = (s: string) => s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // remove special chars
    .replace(/\s+/g, ' ')
    .trim();

  // Helper: count matching words between two names
  const wordMatchScore = (a: string, b: string): number => {
    const wa = normName(a).split(' ').filter(Boolean);
    const wb = normName(b).split(' ').filter(Boolean);
    const matched = wa.filter(w => wb.includes(w)).length;
    return matched / Math.max(wa.length, wb.length);
  };

  // Helper: simple Levenshtein distance
  const levenshtein = (a: string, b: string): number => {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
  };

  // Robust name matching: exact → contains → word overlap → levenshtein
  const findStudent = (pastedName: string) => {
    const pn = normName(pastedName);
    // 1. Exact normalized match
    let found = students.find(s => normName(s.name) === pn);
    if (found) return found;
    // 2. Contains match (one side)
    found = students.find(s => { const sn = normName(s.name); return sn.includes(pn) || pn.includes(sn); });
    if (found) return found;
    // 3. Word overlap >= 60%
    const candidates = students.map(s => ({ s, score: wordMatchScore(s.name, pastedName) })).filter(x => x.score >= 0.6).sort((a, b) => b.score - a.score);
    if (candidates.length > 0) return candidates[0].s;
    // 4. Levenshtein fallback (max distance 4 for long names)
    const lev = students.map(s => ({ s, d: levenshtein(normName(s.name), pn) })).sort((a, b) => a.d - b.d);
    const maxLen = Math.max(pn.length, 3);
    const maxAllowed = maxLen > 15 ? 4 : maxLen > 8 ? 3 : 2;
    if (lev[0] && lev[0].d <= maxAllowed) return lev[0].s;
    return null;
  };

  setQuickGradeRunning(true);
  const errors: string[] = [];
  let done = 0;
  setQuickGradeProgress({ total: parsedRows.length, done: 0, errors: [] });

  for (const row of parsedRows) {
    const pastedName = row.name?.trim();
    if (!pastedName) { errors.push(`Baris kosong dilewati.`); done++; setQuickGradeProgress({ total: parsedRows.length, done, errors: [...errors] }); continue; }

    // Robust name matching
    const matchedStudent = findStudent(pastedName);

    if (!matchedStudent) { errors.push(`Tidak ditemukan: "${pastedName}"`); done++; setQuickGradeProgress({ total: parsedRows.length, done, errors: [...errors] }); continue; }

    // Build overrides for this student from the parsed grades
    const att = attempts.filter(a => a.studentId === matchedStudent.id || (a as any).student_id === matchedStudent.id)
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())[0];

    if (!att) { errors.push(`${matchedStudent.name}: belum ada attempt.`); done++; setQuickGradeProgress({ total: parsedRows.length, done, errors: [...errors] }); continue; }

    let currentOverrides: Record<string, boolean> = {};
    try {
      const fromField = typeof att.overrides === 'string' ? JSON.parse(att.overrides) : (att.overrides || {});
      const fromAnswers = (att.answers as any)?.__overrides__ || {};
      currentOverrides = { ...fromField, ...fromAnswers };
    } catch { currentOverrides = {}; }

    const newOverrides = { ...currentOverrides };
    row.grades.forEach((cellVal, qArrIdx) => {
      if (qArrIdx >= essayQs.length) return;
      const cv = cellVal.trim().toLowerCase();
      const q = essayQs[qArrIdx];
      if (["benar", "b", "true", "1", "ya", "✓"].includes(cv)) {
        newOverrides[q.id] = true;
      } else if (["salah", "s", "false", "0", "tidak", "✗"].includes(cv)) {
        newOverrides[q.id] = false;
      }
      // if empty / unrecognized, leave existing override
    });

    // Recalculate score
    const sisAnswers = att.answers || {};
    const targetQuestions = getTargetQuestions(monitorQuestions, sisAnswers, monitorRoom?.max_questions);
    let objectiveCorrect = 0, objectiveTotal = 0, essayCorrect = 0, essayTotal = 0;
    targetQuestions.forEach((q: any) => {
      const type = q.type || "pilihan_ganda";
      const isEssay = type === "uraian";
      const ic = checkAns(q, sisAnswers[q.id], newOverrides);
      if (isEssay) { essayTotal++; if (ic) essayCorrect++; } else { objectiveTotal++; if (ic) objectiveCorrect++; }
    });

    const objScore = objectiveTotal > 0 ? (objectiveCorrect / objectiveTotal) * 100 : 0;
    const essScore = essayTotal > 0 ? (essayCorrect / essayTotal) * 100 : 0;
    const finalScore = essayTotal === 0 ? Math.round(objScore) : Math.round(objScore * 0.6 + essScore * 0.4);
    const essGradedVal = Object.keys(newOverrides).filter(k => { const q = monitorQuestions.find((x: any) => x.id === k); return q && (q.type === "uraian"); }).length;

    const updatedAnswers = {
      ...(att.answers || {}),
      __overrides__: newOverrides,
      __meta: { ...((att.answers || {}).__meta || {}), objectiveScore: Math.round(objScore), objectiveCorrect: Math.floor(objectiveCorrect), objectiveTotal, essayTotal, essayCorrect, essayScore: Math.round(essScore), essayGraded: essGradedVal }
    };

    try {
      await pb.collection('attempts').update(att.id, { overrides: newOverrides, answers: updatedAnswers, correct: Math.floor(objectiveCorrect + essayCorrect), objectiveCorrect: Math.floor(objectiveCorrect), objectiveTotal, objectiveScore: Math.round(objScore), essayCorrect, essayTotal, essayScore: Math.round(essScore), essayGraded: essGradedVal, score: finalScore });
      setAttempts(prev => prev.map(a => a.id === att.id ? { ...a, overrides: newOverrides, answers: updatedAnswers, score: finalScore } : a));
    } catch (e) { errors.push(`${matchedStudent.name}: gagal disimpan.`); }

    done++;
    setQuickGradeProgress({ total: parsedRows.length, done, errors: [...errors] });
  }

  setQuickGradeRunning(false);
  if (errors.length === 0) { showAlert("Selesai", `Quick Grade berhasil diterapkan ke ${done} siswa!`, "success"); }
  else { showAlert("Selesai", `${done - errors.length} berhasil, ${errors.length} gagal:\n${errors.join("\n")}`, "warning"); }
};

  {/* ⚡ Dialog Quick Grade */}
  <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
    <DialogContent className="max-w-2xl bg-white dark:bg-slate-950 rounded-2xl border-none shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
      <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <DialogTitle className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
          <Zap className="h-5 w-5 text-violet-500" /> Quick Grade — Paste Tabel dari Excel/Sheets
        </DialogTitle>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          Copy tabel dari Excel/Google Sheets lalu paste di bawah ini. Kolom setelah <strong>Nama</strong> akan dipetakan ke soal essay (Q1, Q2...) secara berurutan.
          Isi kolom: <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1 rounded font-bold">Benar</span> atau <span className="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 px-1 rounded font-bold">Salah</span> (juga bisa: B, S, 1, 0, ✓, ✗).
        </p>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
  {/* Contoh format */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Contoh Format (copy dari spreadsheet)</p>
          <pre className="text-[10px] text-slate-600 dark:text-slate-300 font-mono leading-relaxed overflow-x-auto">{`No\tNama\tQ1\tQ2\tQ3\tQ4\tQ5
11\tDAFFA AL HAYYUN\tBenar\tBenar\tSalah\tSalah\tBenar
12\tDARA NADIA ASSYIFA\tBenar\tBenar\tSalah\tBenar\tBenar`}</pre>
        </div>

  {/* Soal essay yang terdeteksi */}
        {monitorQuestions.some((q: any) => q.type === "uraian") && (
          <div className="bg-violet-50 dark:bg-violet-950/20 rounded-xl p-3 border border-violet-100 dark:border-violet-800/30">
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-2">Urutan Soal Essay ({monitorQuestions.filter((q: any) => q.type === "uraian").length} soal)</p>
            <div className="flex flex-wrap gap-2">
              {monitorQuestions.filter((q: any) => q.type === "uraian").map((q: any, i: number) => (
                <span key={q.id} className="text-[10px] px-2 py-1 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded-lg font-bold">
                  Q{i + 1}: #{monitorQuestions.indexOf(q) + 1} ({q.type === "isian_singkat" ? "Isian" : "Uraian"})
                </span>
              ))}
            </div>
          </div>
        )}

  {/* Textarea paste */}
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Paste Tabel Disini:</label>
          <textarea
            className="w-full h-44 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-slate-700 dark:text-slate-300 placeholder-slate-300 dark:placeholder-slate-600"
            placeholder={"Paste tabel dari Excel atau Google Sheets di sini...\n(Ctrl+V / Cmd+V)\n\nTips: di Excel/Sheets, select semua sel termasuk header lalu Ctrl+C"}
            value={quickGradeText}
            onChange={e => setQuickGradeText(e.target.value)}
            disabled={quickGradeRunning}
          />
        </div>

  {/* Live preview of parsed data */}
        {quickGradeText.trim() && !quickGradeRunning && (() => {
          const GKWS = new Set(["benar", "salah", "b", "s", "true", "false", "1", "0", "ya", "tidak", "✓", "✗", "-"]);
          const isGW = (w: string) => GKWS.has(w.toLowerCase());
          const pLines = quickGradeText.trim().split(/\r?\n/).filter(l => l.trim());
          const hasTab = pLines.some(l => l.includes("\t"));

          type PR = { name: string; grades: string[] };
          let previewParsed: PR[] = [];

          if (hasTab) {
            const rows2 = pLines.map(l => l.split("\t").map(c => c.trim()));
            const frLow = rows2[0].map(c => c.toLowerCase());
            const isHdr = frLow.some(c => c === "nama" || c.includes("nama")) || !frLow.some(c => isGW(c));
            let nIdx2 = frLow.findIndex(h => h === "nama" || h.includes("nama"));
            if (nIdx2 === -1) nIdx2 = 1;
            const dRows2 = (isHdr ? rows2.slice(1) : rows2).filter(r => r.length > nIdx2 && r[nIdx2]?.trim());
            previewParsed = dRows2.map(r => ({ name: r[nIdx2] || "", grades: r.slice(nIdx2 + 1) })).filter(r => r.name.trim());
          } else {
            const parsePL = (line: string): PR | null => {
              const toks = line.trim().split(/\s+/);
              let gs = toks.findIndex(t => isGW(t));
              if (gs === -1) return null;
              let np = toks.slice(0, gs);
              if (np.length > 0 && /^\d+$/.test(np[0])) np = np.slice(1);
              const nm = np.join(" ").trim();
              return nm ? { name: nm, grades: toks.slice(gs) } : null;
            };
            const frLow2 = pLines[0].toLowerCase();
            const isHdr2 = (frLow2.includes("nama") || frLow2.includes("no")) && !parsePL(pLines[0]);
            (isHdr2 ? pLines.slice(1) : pLines).forEach(l => { const p = parsePL(l); if (p) previewParsed.push(p); });
          }

          if (previewParsed.length === 0) return null;
          const normN2 = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
          const essayQCount = monitorQuestions.filter((q: any) => q.type === "uraian").length;
          return (
            <div className="bg-violet-50/50 dark:bg-violet-950/10 rounded-xl border border-violet-100 dark:border-violet-800/30 overflow-hidden">
              <div className="px-3 py-2 border-b border-violet-100 dark:border-violet-800/30 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-violet-500">Preview ({previewParsed.length} baris terdeteksi)</span>
                <span className="text-[10px] text-slate-400">{hasTab ? "Format: Tab (Excel)" : "Format: Teks (Benar/Salah)"} | {essayQCount} soal essay</span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-violet-50 dark:divide-violet-900/20">
                {previewParsed.map((row, i) => {
                  const pn2 = normN2(row.name);
                  const match = students.find(s => normN2(s.name) === pn2) ||
                    students.find(s => { const sn = normN2(s.name); return sn.includes(pn2) || pn2.includes(sn); }) ||
                    students.map(s => ({ s, sc: normN2(s.name).split(' ').filter(w => pn2.split(' ').includes(w)).length / Math.max(normN2(s.name).split(' ').length, pn2.split(' ').length) })).sort((a, b) => b.sc - a.sc).find(x => x.sc >= 0.6)?.s;
                  const grades2 = row.grades.slice(0, essayQCount);
                  return (
                    <div key={i} className="px-3 py-1.5 flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${match ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-rose-100 dark:bg-rose-900/40"}`}>
                        <span className="text-[9px]">{match ? "✓" : "✗"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-[11px] font-semibold truncate block ${match ? "text-slate-700 dark:text-slate-200" : "text-rose-600 dark:text-rose-400"}`}>{row.name || "(kosong)"}</span>
                        {match && <span className="text-[9px] text-slate-400">→ {match.name}</span>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {grades2.map((g, gi) => {
                          const gn = g.toLowerCase();
                          const isBenar = ["benar", "b", "1", "ya", "true", "✓"].includes(gn);
                          const isSalah = ["salah", "s", "0", "tidak", "false", "✗"].includes(gn);
                          return <span key={gi} className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${isBenar ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : isSalah ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" : "bg-slate-100 text-slate-400"}`}>{g || "—"}</span>;
                        })}
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          );
        })()}

  {/* Progress */}
        {quickGradeProgress && (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Progress</span>
              <span className="text-xs font-black text-violet-600 dark:text-violet-400">{quickGradeProgress.done}/{quickGradeProgress.total}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${quickGradeProgress.total > 0 ? (quickGradeProgress.done / quickGradeProgress.total) * 100 : 0}%`,
                  background: quickGradeProgress.errors.length > 0 ? '#f59e0b' : '#8b5cf6'
                }}
              />
            </div>
            {quickGradeProgress.errors.length > 0 && (
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {quickGradeProgress.errors.map((err, i) => (
                  <p key={i} className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">⚠ {err}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-white dark:bg-slate-950">
        <Button
          variant="ghost"
          className="rounded-xl text-sm"
          onClick={handleClose}
          disabled={quickGradeRunning}
        >
          Tutup
        </Button>
        <Button
          className="rounded-xl text-sm bg-violet-600 hover:bg-violet-700 text-white font-semibold disabled:opacity-50 gap-2"
          onClick={handleQuickGrade}
          disabled={quickGradeRunning || !quickGradeText.trim()}
        >
          {quickGradeRunning ? (
            <><RefreshCw className="h-4 w-4 animate-spin" /> Memproses...</>
          ) : (
            <><Zap className="h-4 w-4" /> Terapkan Grading</>
          )}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
};

export default QuickGradeDialog;
