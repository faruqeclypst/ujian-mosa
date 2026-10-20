import React, { useState, useMemo, useEffect } from "react";
import {
  ChevronDown,
  RotateCcw,
  Eye,
  EyeOff,
  MoreVertical,
  Check,
  X,
  CheckCircle2,
  Sparkles,
  Pencil,
  Download,
  FileSpreadsheet,
  BookOpen,
  BarChart2,
  Zap,
  Copy,
  ShieldAlert,
  Users,
  Clock,
  FileText
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NeonTable, type NeonTableColumn } from "../../../../components/ui/NeonTable";
import { Button } from "../../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../../../components/ui/dropdown-menu";
import { Skeleton } from "../../../../components/ui/skeleton";
import { cn } from "../../../../lib/utils";
import { MathText } from "../../../../components/ui/MathText";
import { StudentTimer } from "./StudentTimer";
import { getTargetQuestions, computeQuestionScore, getQuestionDetailInfo, stripHtmlTags } from "../utils/helpers";

export interface StudentTableProps {
  students: any[];
  attempts: any[];
  monitorQuestions: any[];
  monitorRoom: any;
  terminology: any;
  selectedStudentIds: string[];
  setSelectedStudentIds: (ids: string[]) => void;
  monitorSortBy: "default" | "nama" | "nilai" | "login" | "status" | "monitoring";
  setMonitorSortBy: (sort: any) => void;
  monitorSortOrder: "asc" | "desc";
  setMonitorSortOrder: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  toggleSort: (key: any) => void;
  monitorPage: number;
  setMonitorPage: (page: number) => void;
  monitorPageSize: number;
  setMonitorPageSize: (size: number) => void;
  monitorClassFilter: string;
  setMonitorClassFilter: (cls: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
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
  isLoading: boolean;
  examClasses: any[];
  roomId: string | null;
  isLargeRoom: boolean;
  pb: any;
  setDetailAnswers: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  role: string | null;
  teacherFullAccess: boolean;
  aiGradingId: string | null;

  // Action Bar Handlers
  handleExportExcel: () => void;
  handleExportEssayExcel: () => void;
  handleCopyBelumUjian: () => void;
  waCopied: boolean;
  setQuickGradeOpen?: (open: boolean) => void;
  handleOpenReopenAllFinishedDialog: () => void;
  handleForceSubmitAll: () => void;
  handleResetAllSessions: () => void;
  handleOpenReopenSelectedDialog: () => void;

  // Neon Console Inspector & Status Tab Props
  inspectedStudentId?: string | null;
  setInspectedStudentId?: (id: string | null) => void;
  statusTab?: "all" | "ongoing" | "finished" | "absent" | "locked";
}

export const StudentTable: React.FC<StudentTableProps> = (props) => {
  const navigate = useNavigate();
  const {
    students, attempts, monitorQuestions, monitorRoom, terminology,
    selectedStudentIds, setSelectedStudentIds,
    monitorSortBy, setMonitorSortBy, monitorSortOrder, setMonitorSortOrder, toggleSort,
    monitorPage, setMonitorPage, monitorPageSize, setMonitorPageSize,
    monitorClassFilter, setMonitorClassFilter,
    searchQuery, setSearchQuery,
    openMenuId, setOpenMenuId, expandedstudent, setExpandedstudent,
    setPreviewImage, getAttemptScore, getLiveScore,
    handleForceSubmitStudent, handleOpenReopenDialog, handleUnlockStudent,
    handleResetSession, handleResetCheatCount, handleManualGrade,
    handleClearOverride, handleAIGrade, setEditAnswerDialog,
    detailAnswers, answersList,
    isLoading, examClasses, roomId, isLargeRoom, pb,
    setDetailAnswers, role, teacherFullAccess, aiGradingId,
    handleExportExcel, handleExportEssayExcel, handleCopyBelumUjian, waCopied,
    setQuickGradeOpen, handleOpenReopenAllFinishedDialog, handleForceSubmitAll,
    handleResetAllSessions, handleOpenReopenSelectedDialog,
    inspectedStudentId, setInspectedStudentId, statusTab
  } = props;

  const hasEssay = useMemo(() => {
    return monitorQuestions.some((q: any) => q.type === "uraian");
  }, [monitorQuestions]);

  // Realtime on-demand: subscribe HANYA ke attempt siswa yang sedang dibuka detailnya
  const expandedAttemptId = useMemo(() => {
    if (!expandedstudent) return null;
    const att = attempts.find((a: any) => {
      const sid = a.studentId || a.student_id;
      return sid === expandedstudent;
    });
    return att?.id || null;
  }, [expandedstudent, attempts]);

  useEffect(() => {
    if (!pb || !expandedAttemptId) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;
    pb.collection("attempts").subscribe(expandedAttemptId, (e: any) => {
      if (cancelled) return;
      const rec = e.record;
      if (rec?.answers) {
        setDetailAnswers((prev: Record<string, any>) => ({ ...prev, [expandedAttemptId]: rec.answers }));
      }
    }).then((u: () => void) => {
      if (cancelled) { u(); } else { unsub = u; }
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [pb, expandedAttemptId, setDetailAnswers]);

  // 1. Filter & Sort Data Siswa
  const processedStudents = useMemo(() => {
    const studentsSource = students.length > 0 ? students : attempts.map((att: any) => ({
      id: att.studentId || att.student_id || att.id,
      name: att.studentId || att.student_id || "(Memuat...)",
      nisn: "",
      classId: "",
      className: "-",
    }));

    return studentsSource
      .map((s: any) => ({
        ...s,
        className: examClasses.find((c: any) => c.id === s.classId)?.name || s.className || "-"
      }))
      .filter((s: any) => {
        // Search Filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchName = s.name.toLowerCase().includes(q);
          const matchNisn = (s.nisn || "").includes(q);
          if (!matchName && !matchNisn) return false;
        }

        // Status Tab Filter
        if (statusTab && statusTab !== "all") {
          const att = attempts.find(at => at.studentId === s.id || at.student_id === s.id);
          if (statusTab === "ongoing") {
            if (att?.status !== "ongoing") return false;
          } else if (statusTab === "finished") {
            const isFin = att?.status === "finished" || att?.status === "submitted" || att?.status === "graded";
            if (!isFin) return false;
          } else if (statusTab === "absent") {
            if (att) return false;
          } else if (statusTab === "locked") {
            if (att?.status !== "LOCKED") return false;
          }
        }

        // Class Filter
        if (!s.classId || monitorRoom?.allClasses) {
          if (monitorClassFilter !== "all" && s.className !== monitorClassFilter) return false;
          return true;
        }
        const allowedIds = Array.isArray(monitorRoom?.classId) && (monitorRoom.classId as string[]).length > 0
          ? monitorRoom.classId as string[]
          : null;
        if (allowedIds && !allowedIds.includes(s.classId)) return false;
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
  }, [students, attempts, examClasses, searchQuery, monitorClassFilter, monitorRoom, monitorSortBy, monitorSortOrder, getAttemptScore, monitorQuestions, statusTab]);

  // 2. Definisi Kolom NeonTable
  const neonColumns: NeonTableColumn<any>[] = useMemo(() => {
    const cols: NeonTableColumn<any>[] = [
      {
        key: "name",
        header: (
          <div
            className="flex items-center gap-1.5 cursor-pointer hover:text-emerald-500 transition-colors select-none group"
            onClick={() => toggleSort("nama")}
          >
            <span>Nama {terminology.student}</span>
            {monitorSortBy === "nama" ? (
              <ChevronDown className={cn("h-3 w-3 text-emerald-500 transition-transform", monitorSortOrder === "desc" && "rotate-180")} />
            ) : (
              <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />
            )}
          </div>
        ),
        className: "min-w-0 max-w-[340px]",
        render: (student) => {
          const isInspected = inspectedStudentId === student.id;
          return (
            <div className="flex flex-col gap-1 py-1 group/name">
              <span
                className={cn(
                  "text-[13px] font-bold tracking-tight leading-snug transition-colors truncate",
                  isInspected
                    ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                    : "text-neutral-900 dark:text-neutral-100 group-hover/name:text-emerald-600 dark:group-hover/name:text-emerald-400"
                )}
              >
                {student.name}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 font-mono truncate">
                <span>{student.nisn || "-"}</span>
                <span>•</span>
                <span className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
                  {student.className}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        key: "status",
        header: (
          <div
            className="flex items-center justify-center gap-1.5 cursor-pointer hover:text-emerald-500 transition-colors select-none group"
            onClick={() => toggleSort("status")}
          >
            <span>Status</span>
            {monitorSortBy === "status" ? (
              <ChevronDown className={cn("h-3 w-3 text-emerald-500 transition-transform", monitorSortOrder === "desc" && "rotate-180")} />
            ) : (
              <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />
            )}
          </div>
        ),
        align: "center",
        className: "w-28 sm:w-36 shrink-0",
        headerClassName: "w-28 sm:w-36",
        render: (student) => {
          const attempt = attempts.find(a => a.studentId === student.id || a.student_id === student.id);
          if (!attempt) {
            return (
              <div className="flex flex-col items-center justify-center py-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-100/60 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800">
                  Offline
                </span>
              </div>
            );
          }

          const isFinished = attempt.status === "finished" || attempt.status === "submitted" || attempt.status === "graded";
          const isOngoing = attempt.status === "ongoing";
          const isLocked = attempt.status === "LOCKED";
          const isForce = attempt.forceFinished;

          return (
            <div className="flex flex-col items-center justify-center gap-1.5 py-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border shrink-0",
                  isFinished
                    ? isForce
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                    : isLocked
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                    : isOngoing
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    isFinished
                      ? isForce ? "bg-amber-500" : "bg-neutral-400"
                      : isLocked
                      ? "bg-rose-500"
                      : isOngoing
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-neutral-400"
                  )}
                />
                <span>
                  {isFinished
                    ? isForce ? "Selesai (Paksa)" : "Selesai"
                    : isLocked
                    ? "Terkunci"
                    : isOngoing
                    ? "Mengerjakan"
                    : (attempt.status || "Aktif")}
                </span>
              </span>
              <StudentTimer attempt={attempt} room={monitorRoom} />
            </div>
          );
        },
      },
      {
        key: "objektif",
        header: (
          <div
            className="flex items-center justify-center gap-1.5 cursor-pointer hover:text-emerald-500 transition-colors select-none group"
            onClick={() => toggleSort("nilai")}
          >
            <span>Objektif</span>
            {monitorSortBy === "nilai" ? (
              <ChevronDown className={cn("h-3 w-3 text-emerald-500 transition-transform", monitorSortOrder === "desc" && "rotate-180")} />
            ) : (
              <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />
            )}
          </div>
        ),
        align: "center",
        width: "90px",
        className: "hidden md:table-cell",
        headerClassName: "hidden md:table-cell",
        render: (student) => {
          const attempt = attempts.find(a => a.studentId === student.id || a.student_id === student.id);
          if (!attempt) return <div className="py-1 text-center"><span className="text-neutral-400 font-mono text-xs">-</span></div>;

          const sisAnswers = (attempt && detailAnswers[attempt.id]) || attempt?.answers || {};
          const hasFullAnswers = Object.keys(sisAnswers).length > 0;

          if (!hasFullAnswers) {
            if (attempt.status === "finished") {
              return (
                <div className="flex flex-col items-center justify-center gap-0.5 py-1 font-mono">
                  <span className="text-neutral-900 dark:text-neutral-100 font-bold text-xs">{attempt.score ?? "-"}</span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{attempt.objectiveCorrect ?? attempt.correct ?? "-"}/{attempt.objectiveTotal ?? attempt.total ?? "-"}</span>
                </div>
              );
            }
            return <div className="py-1 text-center"><span className="text-neutral-400 font-mono text-xs">-</span></div>;
          }

          const targetQuestions = getTargetQuestions(monitorQuestions, sisAnswers, monitorRoom?.max_questions);
          const overrides = attempt.overrides || (sisAnswers as any)?.__overrides__ || {};

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
          objCorrect = Math.min(objCorrect, objTotal);
          const objScore = objTotal > 0 ? Math.round((objCorrect / objTotal) * 100) : 0;
          const displayCorrect = Number.isInteger(objCorrect) ? objCorrect : (Math.round(objCorrect * 10) / 10);

          return (
            <div className="flex flex-col items-center justify-center gap-0.5 py-1 font-mono">
              <span className="text-neutral-900 dark:text-neutral-100 font-bold text-xs">{objScore}</span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{displayCorrect}/{objTotal}</span>
            </div>
          );
        },
      },
    ];

    if (hasEssay) {
      cols.push(
        {
          key: "subjektif",
          header: "Subjektif",
          align: "center",
          width: "90px",
          className: "hidden md:table-cell",
          headerClassName: "hidden md:table-cell",
          render: (student) => {
            const attempt = attempts.find(a => a.studentId === student.id || a.student_id === student.id);
            if (!attempt) return <div className="py-1 text-center"><span className="text-neutral-400 font-mono text-xs">-</span></div>;

            const sisAnswers = (attempt && detailAnswers[attempt.id]) || attempt?.answers || {};
            const targetQuestions = getTargetQuestions(monitorQuestions, sisAnswers, monitorRoom?.max_questions);
            const overrides = attempt.overrides || (sisAnswers as any)?.__overrides__ || {};

            let essCorrect = 0, essTotal = 0;
            targetQuestions.forEach((q: any) => {
              const type = q.type || "pilihan_ganda";
              if (type === "isian_singkat" || type === "uraian") {
                essTotal++;
                if (overrides[q.id]) essCorrect++;
              }
            });
            const essGraded = Object.keys(overrides).filter(k => {
              const q = targetQuestions.find((x: any) => x.id === k);
              return q && (q.type === "uraian");
            }).length;
            const essScore = essTotal > 0 ? Math.round((essCorrect / essTotal) * 100) : 0;

            if (essGraded < essTotal) {
              return (
                <div className="flex flex-col items-center justify-center gap-0.5 py-1 font-mono">
                  <span className="text-amber-500 font-bold text-[10px]">{essGraded}/{essTotal}</span>
                  <span className="text-[9px] text-amber-500/80">dinilai</span>
                </div>
              );
            }
            return (
              <div className="flex flex-col items-center justify-center gap-0.5 py-1 font-mono">
                <span className="text-purple-600 dark:text-purple-400 font-bold text-xs">{essScore}</span>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{essCorrect}/{essTotal}</span>
              </div>
            );
          },
        },
        {
          key: "nilai",
          header: "Nilai",
          align: "center",
          width: "90px",
          render: (student) => {
            const attempt = attempts.find(a => a.studentId === student.id || a.student_id === student.id);
            if (!attempt) return <div className="py-1 text-center"><span className="text-neutral-400 font-mono text-xs">-</span></div>;

            const sisAnswers = (attempt && detailAnswers[attempt.id]) || attempt?.answers || {};
            const hasFullAnswers = Object.keys(sisAnswers).length > 0;

            if (!hasFullAnswers && attempt.status !== "finished") {
              const oc = attempt.objectiveCorrect ?? attempt.correct;
              const ot = attempt.objectiveTotal ?? attempt.total;
              if (oc !== undefined && ot !== undefined && ot > 0) {
                return (
                  <div className="flex flex-col items-center justify-center gap-0.5 py-1 font-mono">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xs animate-pulse">
                      {attempt.objectiveScore ?? attempt.score ?? "-"}
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{oc}/{ot}</span>
                  </div>
                );
              }
              return <div className="py-1 text-center"><span className="text-neutral-400 font-mono text-xs">-</span></div>;
            }

            const displayScore = getAttemptScore(attempt);
            return (
              <div className="flex flex-col items-center justify-center py-1">
                <span className={cn(
                  "text-xs font-mono font-bold",
                  attempt.status === "finished" ? "text-emerald-600 dark:text-emerald-400" : "text-indigo-500 animate-pulse"
                )}>
                  {displayScore}
                </span>
              </div>
            );
          },
        }
      );
    }

    cols.push(
      {
        key: "monitoring",
        header: (
          <div
            className="flex items-center justify-center gap-1.5 cursor-pointer hover:text-emerald-500 transition-colors select-none group"
            onClick={() => toggleSort("monitoring")}
          >
            <span>Monitoring</span>
            {monitorSortBy === "monitoring" ? (
              <ChevronDown className={cn("h-3 w-3 text-emerald-500 transition-transform", monitorSortOrder === "desc" && "rotate-180")} />
            ) : (
              <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />
            )}
          </div>
        ),
        align: "center",
        width: "140px",
        className: "hidden sm:table-cell",
        headerClassName: "hidden sm:table-cell",
        render: (student) => {
          const attempt = attempts.find(a => a.studentId === student.id || a.student_id === student.id);
          const sisAnswers = (attempt && detailAnswers[attempt.id]) || attempt?.answers || {};
          const hasFullAnswers = Object.keys(sisAnswers).length > 0;
          const targetQuestions = getTargetQuestions(monitorQuestions, sisAnswers, monitorRoom?.max_questions);

          const answered = hasFullAnswers
            ? Object.keys(sisAnswers).filter(k =>
              k !== "__overrides__" && k !== "__order__" && k !== "__meta" && k !== "__choices__" &&
              targetQuestions.some((q: any) => q.id === k)
            ).length
            : (attempt?.answeredCount ?? 0);

          const cheatCount = attempt?.cheatCount || 0;
          const activeQId = (sisAnswers as any)?.__activeQuestionId__ || (sisAnswers as any)?.__meta?.activeQuestionId;
          const activeIdx = activeQId ? targetQuestions.findIndex((q: any) => q.id === activeQId) : -1;

          return (
            <div className="flex flex-col items-center justify-center gap-1 py-1">
              <div className="flex items-center gap-1 font-mono text-xs">
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  {answered}/{targetQuestions.length}
                </span>
                <span className="text-[10px] text-neutral-400">soal</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {cheatCount > 0 ? (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    title={`${cheatCount} kali terdeteksi melanggar`}
                  >
                    <ShieldAlert className="h-3 w-3" />
                    <span>{cheatCount}x</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
                    C:0
                  </span>
                )}

                {attempt?.status === "ongoing" && activeIdx !== -1 && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    #{activeIdx + 1}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: "actions",
        header: "Aksi",
        align: "right",
        width: "90px",
        render: (student) => {
          const attempt = attempts.find(a => a.studentId === student.id || a.student_id === student.id);
          const isExpanded = expandedstudent === student.id;

          return (
            <div className="flex justify-end items-center gap-1.5 py-1" onClick={(e) => e.stopPropagation()}>
              {attempt && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      const next = isExpanded ? null : student.id;
                      setExpandedstudent(next);
                      if (next && attempt && pb) {
                        pb.collection('attempts').getOne(attempt.id).then((rec: any) => {
                          if (rec?.answers) setDetailAnswers((prev: any) => ({ ...prev, [attempt.id]: rec.answers }));
                        }).catch(() => {});
                      }
                    }}
                    className={cn(
                      "h-7 w-7 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 transition-colors cursor-pointer",
                      isExpanded
                        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                        : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    )}
                    title={isExpanded ? "Tutup Lembar Jawaban" : "Lihat Lembar Jawaban"}
                  >
                    {isExpanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>

                  {(role === "admin" || (role === "teacher" && teacherFullAccess)) && (
                    <div className="relative">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setOpenMenuId(openMenuId === student.id ? null : student.id)}
                        className={cn(
                          "h-7 w-7 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 transition-colors cursor-pointer text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                          openMenuId === student.id && "bg-neutral-100 dark:bg-neutral-800"
                        )}
                        title="Opsi Siswa"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                      {openMenuId === student.id && (
                        <div
                          className="absolute right-0 mt-1 w-44 bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl z-40 py-1 animate-in fade-in zoom-in-95 duration-100"
                          onMouseLeave={() => setOpenMenuId(null)}
                        >
                          <div className="px-2.5 py-1 mb-1 border-b border-neutral-100 dark:border-neutral-800">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Opsi Siswa</span>
                          </div>
                          <button
                            onClick={() => {
                              navigate(`/admin/penilaian/${student.id}?roomId=${roomId || ""}`);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 hover:text-indigo-600 font-medium transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <FileText className="h-3 w-3 text-indigo-500" /> Detail Penilaian
                          </button>
                          {(attempt.cheatCount || 0) > 0 && (
                            <button
                              onClick={() => { handleResetCheatCount(attempt.id); setOpenMenuId(null); }}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-amber-600 dark:text-amber-400 font-medium transition-colors flex items-center gap-2 cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" /> Reset Pelanggaran
                            </button>
                          )}
                          {attempt.status === "LOCKED" && (
                            <button
                              onClick={() => { handleUnlockStudent(attempt.id); setOpenMenuId(null); }}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-emerald-600 dark:text-emerald-400 font-medium transition-colors flex items-center gap-2 cursor-pointer"
                            >
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Buka Kunci
                            </button>
                          )}
                          {attempt.status !== "finished" && (
                            <button
                              onClick={() => { handleForceSubmitStudent(attempt.id); setOpenMenuId(null); }}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-rose-600 dark:text-rose-400 font-medium transition-colors flex items-center gap-2 cursor-pointer"
                            >
                              <div className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Selesaikan Ujian
                            </button>
                          )}
                          {attempt.status === "finished" && (
                            <button
                              onClick={() => { handleOpenReopenDialog(attempt, student.name); setOpenMenuId(null); }}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 hover:text-emerald-600 font-medium transition-colors flex items-center gap-2 cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3 text-emerald-500" /> Buka Kembali (Ongoing)
                            </button>
                          )}
                          <button
                            onClick={() => { handleResetSession(attempt.id, student.id); setOpenMenuId(null); }}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 hover:text-rose-500 font-medium transition-colors flex items-center gap-2 border-t border-neutral-100 dark:border-neutral-800 mt-1 pt-1 cursor-pointer"
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-neutral-400" /> Reset Sesi
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        },
      }
    );

    return cols;
  }, [
    attempts, detailAnswers, monitorQuestions, monitorRoom, hasEssay,
    monitorSortBy, monitorSortOrder, toggleSort, terminology, roomId,
    expandedstudent, openMenuId, role, teacherFullAccess,
    getAttemptScore, handleForceSubmitStudent, handleOpenReopenDialog,
    handleUnlockStudent, handleResetSession, handleResetCheatCount,
    setExpandedstudent, setOpenMenuId, setDetailAnswers, pb, navigate
  ]);

  // 3. Render Expanded Row (Lembar Jawaban Siswa - Neon Style)
  const renderExpandedStudentRow = (student: any) => {
    const attempt = attempts.find(a => a.studentId === student.id || a.student_id === student.id);
    const sisAnswers = (attempt && detailAnswers[attempt.id]) || attempt?.answers || {};
    const targetQuestions = getTargetQuestions(monitorQuestions, sisAnswers, monitorRoom?.max_questions);

    return (
      <div className="p-4 bg-neutral-50/60 dark:bg-[#070809] border-t border-neutral-200 dark:border-neutral-800/80">
        {/* Header Info Lembar Jawaban Siswa */}
        <div className="mb-3 flex items-center justify-between flex-wrap gap-2 px-3 py-2 bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              Lembar Jawaban: <strong className="font-bold text-neutral-900 dark:text-neutral-100">{student.name}</strong>
            </span>
            {Number(monitorRoom?.max_questions) > 0 && Number(monitorRoom?.max_questions) < monitorQuestions.length ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                {targetQuestions.length} Soal Acak (dari {monitorQuestions.length} Bank)
              </span>
            ) : monitorRoom?.randomize_questions !== false ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                Total {targetQuestions.length} Soal (Acak)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                Total {targetQuestions.length} Soal (Urut)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono font-medium text-neutral-500 dark:text-neutral-400 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" /> Aktif</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Benar (100%)</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Parsial</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Salah</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-neutral-400" /> Kosong</span>
          </div>
        </div>

        <div
          className="grid gap-3"
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
              ? "border-blue-500 ring-1 ring-blue-500/40 bg-white dark:bg-[#0c0d0e]"
              : status === "correct"
                ? "border-emerald-500/30 dark:border-emerald-500/20 bg-white dark:bg-[#0c0d0e]"
                : status === "partial"
                  ? "border-amber-500/30 dark:border-amber-500/20 bg-white dark:bg-[#0c0d0e]"
                  : status === "wrong"
                    ? "border-rose-500/30 dark:border-rose-500/20 bg-white dark:bg-[#0c0d0e]"
                    : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0c0d0e]";

            return (
              <div
                key={q.id}
                className={cn(
                  "p-3 rounded-lg border transition-all flex flex-col gap-2 relative min-w-0 shadow-2xs",
                  cardBorder
                )}
              >
                {/* Header Card Soal */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                      #{qIdx + 1}
                    </span>
                    {monitorQuestions.length !== targetQuestions.length && (
                      <span className="text-[9px] font-mono text-neutral-400 dark:text-neutral-500">
                        (Bank #{bankNo})
                      </span>
                    )}
                  </div>
                  {isActive && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-blue-500 animate-ping" />
                      Aktif
                    </span>
                  )}
                </div>

                {/* Text Soal */}
                <div className="flex gap-2">
                  <MathText content={q.text} className="text-[11px] font-medium leading-relaxed text-neutral-700 dark:text-neutral-300 line-clamp-3" />
                </div>

                {/* Kunci Jawaban */}
                <div className="px-2 py-1 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-[9px] font-mono font-semibold text-neutral-500 dark:text-neutral-400 uppercase mr-1">Kunci:</span>
                  <span className="text-[10px] font-mono font-bold text-neutral-800 dark:text-neutral-200">
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
                      if (t === "klasifikasi" || t === "matriks") {
                        const stmts = q.statements || (q.choices && q.choices.statements) || [];
                        const cats = q.categories || q.columns || (q.choices && (q.choices.categories || q.choices.columns)) || [];
                        const catMap: Record<string, string> = {};
                        if (Array.isArray(cats)) cats.forEach((c: any) => { catMap[String(c.id)] = stripHtmlTags(String(c.text || c.id)); });
                        if (Array.isArray(stmts) && stmts.length > 0) {
                          return stmts.map((s: any, idx: number) => `P${idx + 1}: ${catMap[String(s.answer)] || "-"}`).join(", ");
                        }
                        return "-";
                      }
                      if (t === "isian_rumpang" || t === "cloze") {
                        const blanks = q.blanks || (q.choices && q.choices.blanks) || [];
                        if (Array.isArray(blanks) && blanks.length > 0) {
                          return blanks.map((b: any, idx: number) => {
                            const acc = Array.isArray(b.answers) ? b.answers : (b.answers != null ? [b.answers] : []);
                            return `[${idx + 1}]: ${acc.map((a: any) => String(a)).join(" / ") || "-"}`;
                          }).join(", ");
                        }
                        return "-";
                      }
                      if (t === "hotspot") {
                        const areas = q.areas || (q.choices && q.choices.areas) || [];
                        const hmode = String(q.mode || (q.choices && q.choices.mode) || "any");
                        if (Array.isArray(areas) && areas.length > 0) {
                          return `${areas.length} area (${hmode === "all" ? "semua" : "satu saja"})`;
                        }
                        return "-";
                      }
                      return stripHtmlTags(q.answerKey || "-");
                    })()}
                  </span>
                </div>

                {/* Jawaban Siswa & Feedback */}
                <div className="mt-auto p-2 rounded bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider">Jawaban:</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold inline-flex items-center gap-1",
                        status === "correct" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
                        status === "partial" && "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
                        status === "wrong" && "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20",
                        status === "empty" && "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                      )}
                    >
                      {status === "correct" && <Check className="h-2.5 w-2.5" />}
                      {status === "partial" && <span>½</span>}
                      {status === "wrong" && <X className="h-2.5 w-2.5" />}
                      {badgeLabel}
                    </span>
                  </div>

                  {/* Jawaban Value */}
                  <div className="font-mono text-xs font-semibold text-neutral-800 dark:text-neutral-200 break-words whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                    {(() => {
                      if (status === "empty") {
                        return <span className="text-[10px] text-neutral-400 italic">(Belum dijawab)</span>;
                      }
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

                  {/* Skor & Tombol Aksi Override */}
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-200 dark:border-neutral-800 gap-1 mt-0.5">
                    <span className="text-[9px] font-mono text-neutral-500">
                      Skor: <strong className="text-neutral-900 dark:text-neutral-100">{Number.isInteger(qScore) ? qScore : (Math.round(qScore * 100) / 100)}/1</strong>
                    </span>

                    {(role === "admin" || (role === "teacher" && teacherFullAccess)) && (
                      <div className="flex items-center gap-1">
                        {q.type === "uraian" && (
                          <button
                            type="button"
                            onClick={() => handleAIGrade(student.id, q.id)}
                            disabled={aiGradingId === `${student.id}_${q.id}`}
                            className="p-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-indigo-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="Periksa dengan AI"
                          >
                            <Sparkles className={`h-3 w-3 ${aiGradingId === `${student.id}_${q.id}` ? "animate-spin" : ""}`} />
                          </button>
                        )}
                        {(q.type === "pilihan_ganda" || q.type === "benar_salah" || !q.type) && (
                          <button
                            type="button"
                            onClick={() => setEditAnswerDialog({
                              open: true,
                              studentId: student.id,
                              studentName: student.name,
                              question: q,
                              currentAnswer: ans || "",
                              qIdx,
                            })}
                            className="p-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-amber-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="Edit jawaban siswa"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleManualGrade(student.id, q.id, true)}
                          className={cn(
                            "h-6 w-6 rounded border flex items-center justify-center transition-colors cursor-pointer",
                            overrides[q.id] === true
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-neutral-800"
                          )}
                          title="Tandai Benar"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleManualGrade(student.id, q.id, false)}
                          className={cn(
                            "h-6 w-6 rounded border flex items-center justify-center transition-colors cursor-pointer",
                            overrides[q.id] === false
                              ? "bg-rose-600 border-rose-600 text-white"
                              : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-neutral-800"
                          )}
                          title="Tandai Salah"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {overrides[q.id] !== undefined && (
                          <button
                            type="button"
                            onClick={() => handleClearOverride(student.id, q.id)}
                            className="h-6 w-6 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-center"
                            title="Netralkan Override"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <NeonTable<any>
      data={processedStudents}
      columns={neonColumns}
      keyExtractor={(student) => student.id}
      isLoading={isLoading}
      title="Daftar Peserta Ujian Live"
      subtitle="Klik icon mata untuk membuka lembar jawaban butir soal dan penilaian interaktif."
      searchValue={searchQuery}
      onSearchChange={(val) => {
        setSearchQuery(val);
        setMonitorPage(1);
      }}
      searchPlaceholder={`Cari nama ${terminology.student.toLowerCase()} atau NISN...`}
      filterSlot={
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Filter Kelas */}
          <div className="relative">
            <select
              value={monitorClassFilter}
              onChange={(e) => {
                setMonitorClassFilter(e.target.value);
                setMonitorPage(1);
              }}
              className="h-8 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 pl-2.5 pr-7 py-1 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 text-neutral-700 dark:text-neutral-300 appearance-none cursor-pointer"
            >
              <option value="all">Semua {terminology.class}</option>
              {examClasses
                .filter(c => {
                  if (monitorRoom?.allClasses) return true;
                  const ids = Array.isArray(monitorRoom?.classId) ? monitorRoom?.classId : String(monitorRoom?.classId || "").split(",");
                  return ids.includes(c.id);
                })
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(c => <option key={c.id} value={c.name}>{c.name}</option>)
              }
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-400 pointer-events-none" />
          </div>

          {/* Urutkan */}
          <div className="relative">
            <select
              value={monitorSortBy}
              onChange={(e) => {
                setMonitorSortBy(e.target.value as any);
                setMonitorPage(1);
              }}
              className="h-8 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 pl-2.5 pr-7 py-1 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 text-neutral-700 dark:text-neutral-300 appearance-none cursor-pointer"
            >
              <option value="status">Urut: Status Ujian</option>
              <option value="nama">Urut: Nama</option>
              <option value="nilai">Urut: Nilai</option>
              <option value="monitoring">Urut: Monitoring</option>
              <option value="login">Urut: Waktu Login</option>
              <option value="default">Urut: Default</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-400 pointer-events-none" />
          </div>
        </div>
      }
      selectable={true}
      selectedKeys={selectedStudentIds}
      onSelectionChange={setSelectedStudentIds}
      activeKey={inspectedStudentId ?? undefined}
      onRowClick={(student) => setInspectedStudentId && setInspectedStudentId(student.id)}
      batchActions={
        (role === "admin" || (role === "teacher" && teacherFullAccess)) ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleOpenReopenSelectedDialog}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Buka Kembali ({selectedStudentIds.length})</span>
            </button>
          </div>
        ) : undefined
      }
      pagination={true}
      pageSize={monitorPageSize}
      pageSizeOptions={[10, 25, 50, 100]}
      currentPage={monitorPage}
      onPageChange={setMonitorPage}
      isRowExpanded={(student) => expandedstudent === student.id}
      renderExpandedRow={renderExpandedStudentRow}
      emptyTitle="Tidak ada data siswa"
      emptySubtitle="Tidak ada siswa yang sesuai dengan filter atau kata kunci pencarian saat ini."
    />
  );
};
