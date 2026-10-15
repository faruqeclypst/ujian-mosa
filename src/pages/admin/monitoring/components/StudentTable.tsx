import React from "react";
import { ChevronDown, RotateCcw, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { StudentTimer } from "./StudentTimer";

interface StudentTableProps {
  students: any[];
  attempts: any[];
  monitorQuestions: any[];
  monitorRoom: any;
  terminology: any;
  selectedStudentIds: string[];
  setSelectedStudentIds: (ids: string[]) => void;
  monitorSortBy: string;
  monitorSortOrder: "asc" | "desc";
  toggleSort: (key: any) => void;
  monitorPage: number;
  monitorPageSize: number;
  monitorClassFilter: string;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  expandedstudent: string | null;
  setExpandedstudent: (id: string | null) => void;
  setPreviewImage: (url: string | null) => void;
  getAttemptScore: (attempt: any) => any;
  getLiveScore: (answers: any, overrides?: any) => any;
  handleForceSubmitStudent: (id: string) => void;
  handleOpenReopenDialog: (att: any, name: string) => void;
  handleUnlockStudent: (id: string) => void;
  handleResetSession: (attId: string, sisId: string) => void;
  handleResetCheatCount: (id: string) => void;
  handleManualGrade: (studentId: string, qId: string, isCorrect: boolean) => void;
  handleClearOverride: (studentId: string, qId: string) => void;
  handleAIGrade: (studentId: string, qId: string) => void;
  setEditAnswerDialog: (d: any) => void;
  detailAnswers: Record<string, any>;
  answersList: Record<string, any>;
}

export const StudentTable = (props: StudentTableProps) => {
  const {
    students, attempts, monitorQuestions, monitorRoom, terminology,
    selectedStudentIds, setSelectedStudentIds,
    monitorSortBy, monitorSortOrder, toggleSort,
    monitorPage, monitorPageSize, monitorClassFilter,
    openMenuId, setOpenMenuId, expandedstudent, setExpandedstudent,
    setPreviewImage, getAttemptScore, getLiveScore,
    handleForceSubmitStudent, handleOpenReopenDialog, handleUnlockStudent,
    handleResetSession, handleResetCheatCount, handleManualGrade,
    handleClearOverride, handleAIGrade, setEditAnswerDialog,
    detailAnswers, answersList,
  } = props;

  return (
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-9 text-center px-1">
                      <input
                        type="checkbox"
                        checked={students.length > 0 && students.every(s => selectedStudentIds.includes(s.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudentIds(students.map(s => s.id));
                          } else {
                            setSelectedStudentIds([]);
                          }
                        }}
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5"
                      />
                    </TableHead>
                    <TableHead className="w-10 text-center text-[10px]">No</TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-blue-600 transition-colors group select-none"
                      onClick={() => toggleSort("nama")}
                    >
                      <div className="flex items-center gap-1.5">
                        Nama {terminology.student}
                        {monitorSortBy === 'nama' ? (
                          monitorSortOrder === 'asc' ? <ChevronDown className="h-3 w-3 text-blue-600" /> : <ChevronDown className="h-3 w-3 text-blue-600 rotate-180" />
                        ) : <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />}
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-32 text-center cursor-pointer hover:text-blue-600 transition-colors group select-none"
                      onClick={() => toggleSort("status")}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        Status
                        {monitorSortBy === 'status' ? (
                          monitorSortOrder === 'asc' ? <ChevronDown className="h-3 w-3 text-blue-600" /> : <ChevronDown className="h-3 w-3 text-blue-600 rotate-180" />
                        ) : <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />}
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-20 text-center cursor-pointer hover:text-blue-600 transition-colors group select-none"
                      onClick={() => toggleSort("nilai")}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        Objektif
                        {monitorSortBy === 'nilai' ? (
                          monitorSortOrder === 'asc' ? <ChevronDown className="h-3 w-3 text-blue-600" /> : <ChevronDown className="h-3 w-3 text-blue-600 rotate-180" />
                        ) : <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />}
                      </div>
                    </TableHead>
                    {monitorQuestions.some((q: any) => q.type === "uraian") && (
                      <TableHead className="w-20 text-center">Subjektif</TableHead>
                    )}
                    {monitorQuestions.some((q: any) => q.type === "uraian") && (
                      <TableHead className="w-20 text-center">Nilai</TableHead>
                    )}
                    <TableHead
                      className="text-center w-32 cursor-pointer hover:text-blue-600 transition-colors group select-none text-[10px]"
                      onClick={() => toggleSort("monitoring")}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        Monitoring
                        {monitorSortBy === 'monitoring' ? (
                          monitorSortOrder === 'asc' ? <ChevronDown className="h-3 w-3 text-blue-600" /> : <ChevronDown className="h-3 w-3 text-blue-600 rotate-180" />
                        ) : <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={`skele-row-${i}`} className="h-16">
                        <TableCell className="text-center px-1"><Skeleton className="h-3.5 w-3.5 mx-auto rounded" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-3 w-3 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-48" /><Skeleton className="h-3 w-32 mt-1.5" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-6 w-8 mx-auto" /></TableCell>
                        <TableCell className="text-center px-1"><Skeleton className="h-6 w-12 mx-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-7 w-20 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : (() => {
                    const filtered = students
                      .map(s => ({
                        ...s,
                        className: examClasses.find(c => c.id === s.classId)?.name || "-"
                      }))
                      .filter((s) => {
                        // Search Filter
                        if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase()) && !s.nisn.includes(searchQuery)) return false;

                        // Class Filter
                        if (monitorRoom?.allClasses) {
                          if (monitorClassFilter !== "all" && s.className !== monitorClassFilter) return false;
                          return true;
                        }
                        const allowedIds = Array.isArray(monitorRoom?.classId) ? monitorRoom?.classId : String(monitorRoom?.classId || "").split(",");
                        if (!allowedIds.includes(s.classId)) return false;
                        if (monitorClassFilter !== "all" && s.className !== monitorClassFilter) return false;
                        return true;
                      })
                      .sort((a, b) => {
                        const attA = attempts.find(at => at.studentId === a.id || at.student_id === a.id);
                        const attB = attempts.find(at => at.studentId === b.id || at.student_id === b.id);

                        let comparison = 0;
                        if (monitorSortBy === "nilai") {
                          comparison = getAttemptScore(attA) - getAttemptScore(attB);
                        } else if (monitorSortBy === "login") {
                          comparison = new Date(attA?.startTime || 0).getTime() - new Date(attB?.startTime || 0).getTime();
                        } else if (monitorSortBy === "status") {
                          const getStatusRank = (status?: string) => {
                            if (status === "LOCKED") return 3;
                            if (status === "ongoing") return 2;
                            if (status === "finished") return 1;
                            return 0;
                          };
                          comparison = getStatusRank(attA?.status) - getStatusRank(attB?.status);
                        } else if (monitorSortBy === "monitoring") {
                          const cheatA = attA?.cheatCount || 0;
                          const cheatB = attB?.cheatCount || 0;
                          if (cheatA !== cheatB) {
                            comparison = cheatA - cheatB;
                          } else {
                            // Mode ringan: pakai answeredCount server-side bila answers tak diunduh
                            const cntA = (att: any) => (att?.answers && Object.keys(att.answers).length > 0)
                              ? Object.keys(att.answers).filter(k => k !== "__overrides__" && monitorQuestions.some((q: any) => q.id === k)).length
                              : (att?.answeredCount ?? 0);
                            const ansA = cntA(attA);
                            const ansB = cntA(attB);
                            comparison = ansA - ansB;
                          }
                        } else if (monitorSortBy === "nama") {
                          comparison = a.name.localeCompare(b.name);
                        }

                        if (comparison === 0) comparison = a.name.localeCompare(b.name);
                        return monitorSortOrder === "asc" ? comparison : -comparison;
                      });

                    const startIndex = (monitorPage - 1) * monitorPageSize;
                    const currentData = filtered.slice(startIndex, startIndex + monitorPageSize);

                    if (currentData.length === 0 && monitorPage === 1) return <TableRow><TableCell colSpan={8} className="h-60 text-center text-slate-400">{terminology.student} tidak ditemukan</TableCell></TableRow>;

                    const rows = currentData.map((student, localIdx) => {
                      const attempt = attempts.find(a => a.studentId === student.id || a.student_id === student.id);
                      // Mode ringan: detail jawaban diambil on-demand (detailAnswers),
                      // daftar hanya membawa answeredCount dari server.
                      const sisAnswers = (attempt && detailAnswers[attempt.id]) || attempt?.answers || {};
                      const hasFullAnswers = Object.keys(sisAnswers).length > 0;
                      const targetQuestions = getTargetQuestions(monitorQuestions, sisAnswers, monitorRoom?.max_questions);

                      const answered = hasFullAnswers
                        ? Object.keys(sisAnswers).filter(k =>
                          k !== "__overrides__" && k !== "__order__" && k !== "__meta" && k !== "__choices__" &&
                          targetQuestions.some((q: any) => q.id === k)
                        ).length
                        : (attempt?.answeredCount ?? 0);
                      const isExpanded = expandedstudent === student.id;

                      return (
                        <React.Fragment key={student.id}>
                          <TableRow className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-16 ${isExpanded ? "bg-blue-50/30 dark:bg-blue-900/10" : ""}`}>
                            <TableCell className="text-center px-1">
                              <input
                                type="checkbox"
                                checked={selectedStudentIds.includes(student.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudentIds(prev => [...prev, student.id]);
                                  } else {
                                    setSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                                  }
                                }}
                                className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5"
                              />
                            </TableCell>
                            <TableCell className="text-center text-slate-400 text-[10px] px-1">{startIndex + localIdx + 1}</TableCell>
                            <TableCell>
                              <div className="flex flex-col cursor-pointer" onClick={() => { sessionStorage.setItem("activeGradingRoomId", roomId || ""); navigate(`/admin/penilaian/${student.id}`); }}>                                <span className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">{student.name}</span>
                                <span className="text-[10px] text-slate-500 font-medium">{student.nisn} • {student.className}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {attempt ? (
                                <div className="flex flex-col items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight border shadow-sm ${attempt.status === "finished" ? (attempt.forceFinished ? "bg-orange-500 text-white border-orange-400" : "bg-emerald-500 text-white border-emerald-400") :
                                    attempt.status === "LOCKED" ? "bg-rose-500 text-white border-rose-400" :
                                      "bg-blue-600 text-white border-blue-500"
                                    }`}>
                                    {attempt.status === "finished" && attempt.forceFinished ? "SELESAI (PAKSA)" : (attempt.status?.toUpperCase() || "AKTIF")}
                                  </span>
                                  <StudentTimer attempt={attempt} room={monitorRoom} />
                                </div>
                              ) : <span className="text-[10px] text-slate-400 font-bold italic">OFFLINE</span>}
                            </TableCell>
                            <TableCell className="text-center text-[11px] font-bold">
                              {(() => {
                                if (!attempt) return "-";
                                // Mode ringan tanpa answers: skor live tak bisa dihitung.
                                // Tampilkan skor tersimpan bila sudah finished.
                                if (!hasFullAnswers) {
                                  if (attempt.status === "finished") {
                                    return (
                                      <div className="flex flex-col items-center">
                                        <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">{attempt.score ?? "-"}</span>
                                        <span className="text-[9px] text-slate-400">{attempt.objectiveCorrect ?? attempt.correct ?? "-"}/{attempt.objectiveTotal ?? attempt.total ?? "-"}</span>
                                      </div>
                                    );
                                  }
                                  return "-";
                                }
                                const overrides = attempt.overrides || (sisAnswers as any)?.__overrides__ || {};

                                // Calculate objective breakdown
                                let objCorrect = 0, objTotal = 0;
                                targetQuestions.forEach((q: any) => {
                                  const type = q.type || "pilihan_ganda";
                                  const isEssay = type === "uraian";
                                  if (!isEssay) {
                                    objTotal++;
                                    const s = computeQuestionScore(q, sisAnswers[q.id], overrides);
                                    objCorrect += s;
                                  }
                                });
                                objCorrect = Math.min(objCorrect, objTotal); // safety cap
                                const objScore = objTotal > 0 ? Math.round((objCorrect / objTotal) * 100) : 0;
                                const displayCorrect = Number.isInteger(objCorrect) ? objCorrect : (Math.round(objCorrect * 10) / 10);

                                return (
                                  <div className="flex flex-col items-center">
                                    <span className="text-blue-600 dark:text-blue-400 font-black text-sm">{objScore}</span>
                                    <span className="text-[9px] text-slate-400">{displayCorrect}/{objTotal}</span>
                                  </div>
                                );
                              })()}
                            </TableCell>
                            {monitorQuestions.some((q: any) => q.type === "uraian") && (
                              <TableCell className="text-center text-[11px] font-bold">
                                {(() => {
                                  if (!attempt) return "-";
                                  const overrides = attempt.overrides || (sisAnswers as any)?.__overrides__ || {};

                                  let essCorrect = 0, essTotal = 0;
                                  targetQuestions.forEach((q: any) => {
                                    const type = q.type || "pilihan_ganda";
                                    if (type === "isian_singkat" || type === "uraian") {
                                      essTotal++;
                                      if (overrides[q.id]) essCorrect++;
                                    }
                                  });
                                  const essGraded = Object.keys(overrides).filter(k => { const q = targetQuestions.find((x: any) => x.id === k); return q && (q.type === "uraian"); }).length;
                                  const essScore = essTotal > 0 ? Math.round((essCorrect / essTotal) * 100) : 0;

                                  if (essGraded < essTotal) {
                                    return (
                                      <div className="flex flex-col items-center">
                                        <span className="text-amber-500 font-bold text-[10px]">{essGraded}/{essTotal}</span>
                                        <span className="text-[9px] text-amber-400">dinilai</span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="flex flex-col items-center">
                                      <span className="text-purple-600 dark:text-purple-400 font-black text-sm">{essScore}</span>
                                      <span className="text-[9px] text-slate-400">{essCorrect}/{essTotal}</span>
                                    </div>
                                  );
                                })()}
                              </TableCell>
                            )}
                            {monitorQuestions.some((q: any) => q.type === "uraian") && (
                              <TableCell className="text-center text-[11px] font-bold">
                                {(() => {
                                  if (!attempt) return "-";
                                  // Mode ringan tanpa answers: pakai skor dari server (hook hitung tiap autosave).
                                  if (!hasFullAnswers && attempt.status !== "finished") {
                                    const oc = attempt.objectiveCorrect ?? attempt.correct;
                                    const ot = attempt.objectiveTotal ?? attempt.total;
                                    if (oc !== undefined && ot !== undefined && ot > 0) {
                                      return (
                                        <div className="flex flex-col items-center">
                                          <span className="text-indigo-600 dark:text-indigo-400 font-black text-sm animate-pulse">{attempt.objectiveScore ?? attempt.score ?? "-"}</span>
                                          <span className="text-[9px] text-slate-400">{oc}/{ot}</span>
                                        </div>
                                      );
                                    }
                                    return "-";
                                  }
                                  const displayScore = getAttemptScore(attempt);

                                  return (
                                    <span className={`text-sm font-black ${attempt.status === "finished" ? "text-emerald-600" : "text-indigo-600 animate-pulse"}`}>{displayScore}</span>
                                  );
                                })()}
                              </TableCell>
                            )}
                            <TableCell className="text-center px-1">
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold">
                                  <span className="text-slate-600 font-bold">{answered}/{targetQuestions.length}</span>
                                  <span className="text-slate-200">|</span>
                                  <span className={cn((attempt?.cheatCount || 0) > 0 ? "text-rose-600" : "text-slate-400")}>
                                    C: {attempt?.cheatCount || 0}
                                  </span>
                                </div>
                                {attempt?.status === "ongoing" && (() => {
                                  const activeQId = (sisAnswers as any)?.__activeQuestionId__ || (sisAnswers as any)?.__meta?.activeQuestionId;
                                  const activeIdx = activeQId ? targetQuestions.findIndex((q: any) => q.id === activeQId) : -1;
                                  if (activeIdx !== -1) {
                                    return (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse border border-blue-200 dark:border-blue-800/40">
                                        Soal #{activeIdx + 1}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                {attempt && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        const next = isExpanded ? null : student.id;
                                        setExpandedstudent(next);
                                        // Mode ringan: ambil jawaban lengkap satu siswa ini saja, saat dibuka
                                        // (selalu fetch ulang agar tidak basi)
                                        if (next && isLargeRoom && attempt && pb) {
                                          pb.collection('attempts').getOne(attempt.id).then((rec: any) => {
                                            if (rec?.answers) setDetailAnswers(prev => ({ ...prev, [attempt.id]: rec.answers }));
                                          }).catch(() => {});
                                        }
                                      }}
                                      className={`h-8 w-8 rounded-xl transition-all shadow-sm ${isExpanded
                                        ? "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
                                        : "bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/40 dark:hover:bg-blue-900/50 dark:hover:text-blue-300"
                                        }`}
                                      title={isExpanded ? "Tutup" : "Detail"}
                                    >
                                      {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    <div className="relative">
                                      {(role === "admin" || (role === "teacher" && teacherFullAccess)) && (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => setOpenMenuId(openMenuId === student.id ? null : student.id)}
                                          className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 hover:text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/40 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-300 shadow-sm transition-all"
                                          title="Menu Opsi"
                                        >
                                          <Settings className="h-4 w-4" />
                                        </Button>
                                      )}
                                      {(role === "admin" || (role === "teacher" && teacherFullAccess)) && openMenuId === student.id && (
                                        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-100" onMouseLeave={() => setOpenMenuId(null)}>
                                          <div className="px-3 py-1 mb-1 border-b border-slate-50 dark:border-slate-700/50">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Opsi {terminology.student}</span>
                                          </div>
                                          <button
                                            onClick={() => { handleResetCheatCount(attempt.id); setOpenMenuId(null); }}
                                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-[10px] text-amber-600 dark:text-amber-500 font-bold transition-colors flex items-center gap-2"
                                          >
                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Reset Cheat
                                          </button>
                                          {attempt.status === "LOCKED" && (
                                            <button
                                              onClick={() => { handleUnlockStudent(attempt.id); setOpenMenuId(null); }}
                                              className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-[10px] text-emerald-600 dark:text-emerald-500 font-bold transition-colors flex items-center gap-2"
                                            >
                                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Buka Kunci
                                            </button>
                                          )}
                                          {attempt.status !== "finished" && (
                                            <button
                                              onClick={() => { handleForceSubmitStudent(attempt.id); setOpenMenuId(null); }}
                                              className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-[10px] text-blue-600 dark:text-blue-400 font-bold transition-colors flex items-center gap-2"
                                            >
                                              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Selesaikan
                                            </button>
                                          )}
                                          {attempt.status === "finished" && (
                                            <button
                                              onClick={() => { handleOpenReopenDialog(attempt, student.name); setOpenMenuId(null); }}
                                              className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold transition-colors flex items-center gap-2"
                                            >
                                              <RotateCcw className="h-3 w-3 text-indigo-500" /> Buka Kembali (Ongoing)
                                            </button>
                                          )}
                                          <button
                                            onClick={() => { handleResetSession(attempt.id, student.id); setOpenMenuId(null); }}
                                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-[10px] text-rose-600 dark:text-rose-500 font-bold transition-colors flex items-center gap-2"
                                          >
                                            <div className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Reset Sesi
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-slate-50/50 dark:bg-slate-900/40">
                              <TableCell colSpan={8} className="p-4">
                                {/* Header Info Paket Soal Siswa */}
                                <div className="mb-3 flex items-center justify-between flex-wrap gap-2 px-3.5 py-2 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/40 rounded-xl text-xs">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="h-2 w-2 rounded-full bg-indigo-500" />
                                    <span className="font-bold text-indigo-900 dark:text-indigo-200">
                                      Lembar Jawaban: <span className="font-black underline">{student.name}</span>
                                    </span>
                                    {Number(monitorRoom?.max_questions) > 0 && Number(monitorRoom?.max_questions) < monitorQuestions.length ? (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 flex items-center gap-1 shadow-sm">
                                        <span>🎲</span> {targetQuestions.length} Soal Teracak (dari {monitorQuestions.length} Bank Soal)
                                      </span>
                                    ) : monitorRoom?.randomize_questions !== false ? (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 flex items-center gap-1 shadow-sm">
                                        <span>🎲</span> Total {targetQuestions.length} Soal (Acak)
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                        Total {targetQuestions.length} Soal (Urut)
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex-wrap">
                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" /> Sedang Dikerjakan</span>
                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Benar (100%)</span>
                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Sebagian Benar</span>
                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Salah</span>
                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> Kosong</span>
                                  </div>
                                </div>

                                <div
                                  className="grid gap-3.5"
                                  style={{
                                    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))"
                                  }}
                                >
                                  {targetQuestions.map((q, qIdx) => {
                                    const ans = sisAnswers[q.id];
                                    const overrides = attempt?.overrides || (sisAnswers as any)?.__overrides__ || {};
                                    const detail = getQuestionDetailInfo(q, ans, overrides);
                                    const { status, score: qScore, badgeLabel, breakdown } = detail;
                                    const bankIdx = monitorQuestions.findIndex((mq: any) => mq.id === q.id);
                                    const bankNo = bankIdx !== -1 ? bankIdx + 1 : "-";
                                    const activeQId = (sisAnswers as any)?.__activeQuestionId__ || (sisAnswers as any)?.__meta?.activeQuestionId;
                                    const isActive = activeQId === q.id;

                                    const cardBorder = isActive
                                      ? "border-blue-400 dark:border-blue-500 shadow-md ring-2 ring-blue-500/40 bg-blue-50/40 dark:bg-blue-950/30"
                                      : status === "correct"
                                        ? "border-emerald-200 dark:border-emerald-800/40 bg-white dark:bg-slate-800 shadow-xs"
                                        : status === "partial"
                                          ? "border-amber-300 dark:border-amber-700/60 bg-white dark:bg-slate-800 shadow-xs ring-1 ring-amber-400/20"
                                          : status === "wrong"
                                            ? "border-rose-200 dark:border-rose-800/40 bg-white dark:bg-slate-800 shadow-xs"
                                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs";

                                    return (
                                      <div
                                        key={q.id}
                                        className={cn(
                                          "p-3.5 rounded-xl border transition-all flex flex-col gap-2.5 relative min-w-0",
                                          cardBorder
                                        )}
                                      >
                                        {/* Header */}
                                        <div className="flex items-center justify-between gap-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 shadow-xs">
                                              No. {qIdx + 1}
                                            </span>
                                            {monitorQuestions.length !== targetQuestions.length ? (
                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 flex items-center gap-0.5" title={`Soal ini diambil dari nomor ${bankNo} di Bank Soal`}>
                                                <span>🎲 Bank #{bankNo}</span>
                                              </span>
                                            ) : (
                                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                                                (Bank #{bankNo})
                                              </span>
                                            )}
                                          </div>
                                          {isActive && (
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-600 text-white animate-pulse flex items-center gap-1 shadow-sm shrink-0">
                                              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                                              AKTIF
                                            </span>
                                          )}
                                        </div>

                                        {/* Text Soal */}
                                        <div className="flex gap-2">
                                          <MathText content={q.text} className="text-[10px] font-medium leading-relaxed text-slate-700 dark:text-slate-300 line-clamp-3" />
                                        </div>

                                        {/* Kunci Jawaban */}
                                        <div className="px-2.5 py-1.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                                          <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mr-1">KUNCI:</span>
                                          <span className="text-[10px] font-bold text-blue-800 dark:text-blue-200">
                                            {(() => {
                                              const t = q.type || q.field || "pilihan_ganda";
                                              if (t === "pilihan_ganda" || t === "multiple_choice") {
                                                const ck = Object.keys(q.choices || {}).find(k => q.choices[k]?.isCorrect);
                                                if (!ck) return stripHtmlTags(q.answerKey || "-");
                                                const choiceText = q.choices[ck]?.text || "";
                                                return <span className="inline-flex items-baseline gap-1"><span>{ck.toUpperCase()}.</span> <MathText content={choiceText} className="inline text-[10px] [&_p]:inline [&_p]:m-0 [&_img]:hidden" /></span>;
                                              }
                                              if (t === "benar_salah" || t === "true_false") {
                                                const sts = q.statements || (q.choices && q.choices.statements);
                                                if (Array.isArray(sts) && sts.length > 0) {
                                                  return sts.map((s: any, idx: number) => `P${idx + 1}: ${s.answer === "salah" ? "Salah" : "Benar"}`).join(", ");
                                                }
                                                const ck = Object.keys(q.choices || {}).find(k => q.choices[k]?.isCorrect);
                                                if (!ck) return stripHtmlTags(q.answerKey || "-");
                                                const choiceText = q.choices[ck]?.text || "";
                                                return <span className="inline-flex items-baseline gap-1"><span>{ck.toUpperCase()}.</span> <MathText content={choiceText} className="inline text-[10px] [&_p]:inline [&_p]:m-0 [&_img]:hidden" /></span>;
                                              }
                                              if (t === "pilihan_ganda_kompleks" || t === "complex_choice" || t === "complex_multiple_choice") {
                                                const cks = Object.keys(q.choices || {}).filter(k => q.choices[k]?.isCorrect);
                                                return cks.map(k => k.toUpperCase()).join(", ") || stripHtmlTags(q.answerKey || "-");
                                              }
                                              if (t === "isian_singkat" || t === "uraian" || t === "short_answer") return <MathText content={q.answerKey || "-"} className="inline text-[10px] [&_p]:inline [&_p]:m-0 [&_img]:hidden" />;
                                              if (t === "menjodohkan" || t === "matching") return `${(q.pairs || []).length} pasangan`;
                                              if (t === "urutkan" || t === "drag_drop") return (q.items || []).map((it: any) => stripHtmlTags(it.text || "").substring(0, 10)).join(" → ");
                                              return stripHtmlTags(q.answerKey || "-");
                                            })()}
                                          </span>
                                        </div>

                                        {/* Jawaban Siswa & Detail Breakdown */}
                                        <div
                                          className={cn(
                                            "mt-auto p-2.5 rounded-lg flex flex-col gap-2 border transition-all",
                                            status === "correct"
                                              ? "bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200"
                                              : status === "partial"
                                                ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-200 shadow-xs"
                                                : status === "wrong"
                                                  ? "bg-rose-50/70 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200"
                                                  : "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/40 text-slate-600 dark:text-slate-400"
                                          )}
                                        >
                                          <div>
                                            <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
                                              <span className="text-[9px] font-black uppercase tracking-wider opacity-70 shrink-0">Jawaban Siswa:</span>
                                              <span
                                                className={cn(
                                                  "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 shrink-0",
                                                  status === "correct" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300",
                                                  status === "partial" && "bg-amber-200 text-amber-950 dark:bg-amber-900/80 dark:text-amber-200 font-black ring-1 ring-amber-400/40",
                                                  status === "wrong" && "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300",
                                                  status === "empty" && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                                )}
                                              >
                                                {status === "correct" && <Check className="h-3 w-3 stroke-[2.5]" />}
                                                {status === "partial" && <span>½</span>}
                                                {status === "wrong" && <X className="h-3 w-3 stroke-[2.5]" />}
                                                {badgeLabel}
                                              </span>
                                            </div>

                                            {/* Detail Content */}
                                            {(() => {
                                              if (status === "empty") {
                                                return <div className="text-[10px] text-slate-400 italic py-1 font-semibold">(Belum ada jawaban)</div>;
                                              }

                                              // 1. Benar / Salah detailed breakdown
                                              if (breakdown?.type === "benar_salah" && Array.isArray(breakdown.items)) {
                                                return (
                                                  <div className="flex flex-col gap-1 mt-1">
                                                    {breakdown.items.map((it: any) => (
                                                      <div
                                                        key={it.id}
                                                        className={cn(
                                                          "flex items-center justify-between px-2 py-1 rounded text-[10px] border font-medium",
                                                          it.isMatch
                                                            ? "bg-emerald-100/70 dark:bg-emerald-950/40 border-emerald-300/80 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200"
                                                            : "bg-rose-100/70 dark:bg-rose-950/40 border-rose-300/80 dark:border-rose-800/60 text-rose-900 dark:text-rose-200"
                                                        )}
                                                      >
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                          <span className="font-black text-slate-600 dark:text-slate-400 shrink-0">P{it.num}:</span>
                                                          <span className="font-bold truncate">{it.userVal}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0 text-[9px] font-black">
                                                          {it.isMatch ? (
                                                            <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-0.5">
                                                              <Check className="h-3 w-3 stroke-[3]" /> Benar
                                                            </span>
                                                          ) : (
                                                            <span className="text-rose-700 dark:text-rose-300 flex items-center gap-0.5">
                                                              <X className="h-3 w-3 stroke-[3]" /> Salah
                                                              <span className="text-[8.5px] font-semibold opacity-80">(Kunci: {it.expected})</span>
                                                            </span>
                                                          )}
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                );
                                              }

                                              // 2. Pilihan Ganda Kompleks detailed breakdown
                                              if (breakdown?.type === "pilihan_ganda_kompleks" && Array.isArray(breakdown.items)) {
                                                return (
                                                  <div className="flex flex-col gap-1.5 mt-1">
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mr-0.5">Pilihan Siswa:</span>
                                                      {breakdown.items.length > 0 ? (
                                                        breakdown.items.map((it: any) => (
                                                          <span
                                                            key={it.key}
                                                            className={cn(
                                                              "px-2 py-0.5 rounded text-[10px] font-black inline-flex items-center gap-1 border shadow-xs",
                                                              it.isCorrect
                                                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
                                                                : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200 border-rose-300 dark:border-rose-700"
                                                            )}
                                                          >
                                                            {it.key}
                                                            {it.isCorrect ? <Check className="h-3 w-3 stroke-[3]" /> : <X className="h-3 w-3 stroke-[3]" />}
                                                          </span>
                                                        ))
                                                      ) : (
                                                        <span className="text-[10px] text-slate-400 italic">(Kosong)</span>
                                                      )}
                                                    </div>
                                                    {breakdown.missingKeys && breakdown.missingKeys.length > 0 && (
                                                      <div className="flex items-center gap-1 flex-wrap text-[9px] font-semibold text-amber-800 dark:text-amber-300">
                                                        <span className="opacity-80">Belum dipilih:</span>
                                                        {breakdown.missingKeys.map((mk: string) => (
                                                          <span
                                                            key={mk}
                                                            className="px-1.5 py-0.2 rounded bg-amber-100/90 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-dashed border-amber-400 dark:border-amber-700 font-black"
                                                          >
                                                            {mk}
                                                          </span>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              }

                                              // 3. Menjodohkan detailed breakdown
                                              if (breakdown?.type === "menjodohkan" && Array.isArray(breakdown.items)) {
                                                return (
                                                  <div className="flex flex-col gap-1 mt-1">
                                                    {breakdown.items.map((it: any, pIdx: number) => (
                                                      <div
                                                        key={pIdx}
                                                        className={cn(
                                                          "flex items-center justify-between px-2 py-1 rounded text-[9px] border font-medium",
                                                          it.isMatch
                                                            ? "bg-emerald-100/70 border-emerald-300 text-emerald-900 dark:text-emerald-200"
                                                            : "bg-rose-100/70 border-rose-300 text-rose-900 dark:text-rose-200"
                                                        )}
                                                      >
                                                        <span className="truncate max-w-[120px] font-bold">{it.left}</span>
                                                        <span className="flex items-center gap-1 font-bold">
                                                          <span>{it.userVal || "-"}</span>
                                                          {it.isMatch ? <Check className="h-3 w-3 text-emerald-600 stroke-[2.5]" /> : <X className="h-3 w-3 text-rose-600 stroke-[2.5]" />}
                                                        </span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                );
                                              }

                                              // 4. Default / standard single choice / essay
                                              return (
                                                <div className="mt-0.5 font-mono font-bold text-[10px] break-words whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto pr-1">
                                                  {(() => {
                                                    if (typeof ans === "object") {
                                                      return Object.entries(ans).map(([k, v]) => `${k}: ${v}`).join(", ");
                                                    }
                                                    const strAns = String(ans).trim();
                                                    if (q.choices && q.choices[strAns.toLowerCase()]) {
                                                      return (
                                                        <span className="inline-flex items-baseline gap-1">
                                                          <span>{strAns.toUpperCase()}.</span>
                                                          <MathText content={q.choices[strAns.toLowerCase()].text || ""} className="inline text-[10px] [&_p]:inline [&_p]:m-0 [&_img]:hidden" />
                                                        </span>
                                                      );
                                                    }
                                                    return stripHtmlTags(strAns).toUpperCase();
                                                  })()}
                                                </div>
                                              );
                                            })()}
                                          </div>

                                          {/* Bottom Action / Score Bar */}
                                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/70 dark:border-slate-800/60 gap-1.5 flex-wrap">
                                            <div className="flex items-center gap-1 text-[9px] font-black shrink-0">
                                              <span className="opacity-60 uppercase tracking-widest">Skor:</span>
                                              <span className={cn(
                                                "font-black",
                                                status === "correct" && "text-emerald-700 dark:text-emerald-300",
                                                status === "partial" && "text-amber-800 dark:text-amber-300",
                                                status === "wrong" && "text-rose-700 dark:text-rose-300",
                                                status === "empty" && "text-slate-400"
                                              )}>
                                                {Number.isInteger(qScore) ? qScore : (Math.round(qScore * 100) / 100)} / 1
                                              </span>
                                            </div>

                                            <div className="flex gap-1 items-center shrink-0">
                                              {(role === "admin" || (role === "teacher" && teacherFullAccess)) && (
                                                <>
                                                  {(q.type === "uraian") && (
                                                    <button onClick={() => handleAIGrade(student.id, q.id)} disabled={aiGradingId === `${student.id}_${q.id}`} className="p-1 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded text-indigo-500" title="Periksa dengan AI">
                                                      <Sparkles className={`h-3 w-3 ${aiGradingId === `${student.id}_${q.id}` ? "animate-spin" : ""}`} />
                                                    </button>
                                                  )}
                                                  {(q.type === "pilihan_ganda" || q.type === "benar_salah" || !q.type) && (
                                                    <button
                                                      onClick={() => setEditAnswerDialog({
                                                        open: true,
                                                        studentId: student.id,
                                                        studentName: student.name,
                                                        question: q,
                                                        currentAnswer: ans || "",
                                                        qIdx,
                                                      })}
                                                      className="p-1 rounded hover:bg-amber-50 dark:hover:bg-slate-700 text-amber-500"
                                                      title="Edit jawaban siswa"
                                                    >
                                                      <Pencil className="h-3 w-3" />
                                                    </button>
                                                  )}
                                                  <button onClick={() => handleManualGrade(student.id, q.id, true)} className={`min-h-[36px] min-w-[36px] p-1.5 rounded-lg flex items-center justify-center transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${overrides[q.id] === true ? "bg-emerald-200 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400"}`} title="Tandai Benar"><CheckCircle2 className="h-4 w-4" /></button>
                                                  <button onClick={() => handleManualGrade(student.id, q.id, false)} className={`min-h-[36px] min-w-[36px] p-1.5 rounded-lg flex items-center justify-center transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${overrides[q.id] === false ? "bg-rose-200 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400"}`} title="Tandai Salah"><X className="h-4 w-4" /></button>
                                                  {overrides[q.id] !== undefined && (
                                                    <button onClick={() => handleClearOverride(student.id, q.id)} className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg flex items-center justify-center transition-all active:scale-95 hover:bg-amber-50 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500" title="Netralkan (hapus override)"><RotateCcw className="h-4 w-4" /></button>
                                                  )}
                                                </>
                                              )}
                                              <span className={cn(
                                                "text-[10px] font-black ml-1 px-1 py-0.2 rounded",
                                                status === "correct" && "text-emerald-700 dark:text-emerald-300",
                                                status === "partial" && "text-amber-700 dark:text-amber-300 font-black",
                                                status === "wrong" && "text-rose-700 dark:text-rose-300",
                                                status === "empty" && "text-slate-400"
                                              )}>
                                                {status === "correct" ? "✓" : status === "partial" ? "½" : status === "wrong" ? "✗" : "-"}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      )
                    });

                    // Add empty rows if data < 10
                    const emptyRowsCount = Math.max(0, 10 - currentData.length);
                    const emptyRows = Array.from({ length: emptyRowsCount }).map((_, i) => (
                      <TableRow key={`empty-${i}`} className="h-16 border-slate-50 dark:border-slate-800/20">
                        <TableCell colSpan={7}>&nbsp;</TableCell>
                      </TableRow>
                    ));

                    return [...rows, ...emptyRows];
                  })()}
                </TableBody>
              </Table>
  );
};
