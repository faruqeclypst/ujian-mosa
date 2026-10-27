import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
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
  RotateCcw,
  FileSpreadsheet,
  BookOpen,
  Sparkles,
  Info,
  HelpCircle,
  TrendingUp,
  Layers,
  Percent,
  ArrowLeft,
  ShieldAlert,
  ChevronRight,
  Filter,
  Check,
  CheckSquare,
  AlertCircle,
  FileText,
  ClipboardCheck,
  Building2,
  Calendar,
  SlidersHorizontal,
  GitBranch,
} from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { MathText } from "../../components/ui/MathText";
import { SmartImage } from "../../components/ui/smart-image";
import { ExamRoomPicker } from "../../components/common/ExamRoomPicker";
import {
  NeonPageHeader,
  NeonCard,
  NeonCardHeader,
  NeonStatGrid,
  NeonStatCard,
  NeonBadge,
  NeonTabs,
} from "../../components/ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "../../components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { useToast } from "../../components/ui/toast";
import { AIQuestionRevisionDialog } from "../../components/dialogs/AIQuestionRevisionDialog";
import { useTenant } from "../../context/TenantContext";
import { useAuth } from "../../context/AuthContext";
import { useExamData } from "../../context/ExamDataContext";
import type { QuestionType } from "./QuestionsPage";
import {
  evaluateQuestionVerdict,
  getDifficultyCategory,
  getDiscriminationCategory,
  getPointBiserialCategory,
  calculateCorrectedPointBiserial,
  isFuzzyMatch,
  type QuestionAnalysis,
  type DistractorAnalysis,
  type StatementAnalysis,
  type VerdictType,
  type DifficultyCategory,
  type DiscriminationCategory,
  type PointBiserialCategory
} from "../../lib/itemAnalysisEvaluator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";

type MetricInfoType = "difficulty" | "discrimination" | "point_biserial" | "distractor";

interface MetricInfoData {
  title: string;
  formula: string;
  formulaDesc: string;
  reference: string;
  description: string;
  ranges: Array<{
    label: string;
    value: string;
  }>;
}

const METRIC_INFO_DETAILS: Record<MetricInfoType, MetricInfoData> = {
  difficulty: {
    title: "Tingkat Kesukaran (P)",
    formula: "P = B / N",
    formulaDesc: "B: Jumlah siswa benar, N: Total peserta tes.",
    reference: "Standar Depdiknas & Arikunto",
    description: "Mengukur derajat kesukaran butir soal. Butir yang ideal untuk evaluasi sumatif berada pada kategori Sedang (0.30 s.d. 0.70).",
    ranges: [
      { label: "Mudah", value: "P > 0.70" },
      { label: "Sedang (Ideal)", value: "0.30 <= P <= 0.70" },
      { label: "Sukar", value: "P < 0.30" },
    ],
  },
  discrimination: {
    title: "Daya Pembeda (D)",
    formula: "D = (Ba - Bb) / n",
    formulaDesc: "Ba: Benar kelompok atas, Bb: Benar kelompok bawah, n: Ukuran kelompok (27% Kelley).",
    reference: "Standar Robert L. Ebel & Arikunto",
    description: "Mengukur kemampuan butir soal membedakan siswa pandai (kelompok atas) dari siswa yang belum paham (kelompok bawah).",
    ranges: [
      { label: "Sangat Baik", value: "D >= +0.40" },
      { label: "Baik", value: "+0.30 <= D < +0.40" },
      { label: "Cukup", value: "+0.20 <= D < +0.30" },
      { label: "Jelek", value: "0.00 <= D < +0.20" },
      { label: "Negatif (Anomali)", value: "D < 0.00" },
    ],
  },
  point_biserial: {
    title: "Point-Biserial (r_pb)",
    formula: "r_pb = Pearson(Yi, X - Yi)",
    formulaDesc: "Korelasi skor butir Yi dengan skor total tes murni tanpa butir tersebut (X - Yi).",
    reference: "Corrected Item-Total Pearson Correlation",
    description: "Menguji validitas dan konsistensi internal butir terhadap keseluruhan instrumen tes tanpa bias spuriositas.",
    ranges: [
      { label: "Baik (Diskriminasi Kuat)", value: "r_pb >= +0.30" },
      { label: "Cukup (Memadai)", value: "+0.20 <= r_pb < +0.30" },
      { label: "Rendah", value: "0.00 <= r_pb < +0.20" },
      { label: "Negatif (Kontradiktif)", value: "r_pb < 0.00" },
    ],
  },
  distractor: {
    title: "Efektivitas Pengecoh (DE)",
    formula: "DE = (Pengecoh Efektif / Total Pengecoh) * 100%",
    formulaDesc: "Syarat efektif: Dipilih >= 5% siswa & pemilih kelompok bawah > kelompok atas.",
    reference: "Distractor Efficiency Analysis",
    description: "Menilai apakah opsi jawaban salah (pengecoh) bekerja memancing siswa yang belum menguasai materi dan tidak menjebak siswa pintar.",
    ranges: [
      { label: "Efektif", value: "Fo >= 5% & nBB > nBA" },
      { label: "Tidak Efektif (Mati)", value: "Fo < 5%" },
      { label: "Menyesatkan (Jebakan)", value: "nBA > nBB & Fo >= 1" },
    ],
  },
};

const MetricInfoTooltip: React.FC<{ type: MetricInfoType; side?: "top" | "bottom" | "left" | "right" }> = ({
  type,
  side = "bottom",
}) => {
  const info = METRIC_INFO_DETAILS[type];
  if (!info) return null;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center h-4 w-4 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all rounded-full focus:outline-none focus:ring-1 focus:ring-emerald-500/40 cursor-pointer"
          aria-label={`Informasi ${info.title}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="w-[320px] max-w-[calc(100vw-32px)] p-3.5 bg-white dark:bg-[#0f1115] text-neutral-800 dark:text-neutral-100 text-xs rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 backdrop-blur-md z-50 animate-in fade-in-0 zoom-in-95"
      >
        <div className="space-y-2.5">
          {/* Header */}
          <div className="border-b border-neutral-100 dark:border-neutral-800 pb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  type === "difficulty" && "bg-sky-500",
                  type === "discrimination" && "bg-indigo-500",
                  type === "point_biserial" && "bg-purple-500",
                  type === "distractor" && "bg-emerald-500"
                )}
              />
              <span className="font-bold text-neutral-900 dark:text-white text-xs">
                {info.title}
              </span>
            </div>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono shrink-0">
              {info.reference}
            </span>
          </div>

          {/* Formula Box */}
          <div className="bg-neutral-50 dark:bg-neutral-900/60 rounded-lg p-2.5 border border-neutral-200/80 dark:border-neutral-800">
            <div className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              {info.formula}
            </div>
            <div className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
              {info.formulaDesc}
            </div>
          </div>

          {/* Kriteria & Klasifikasi */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Kriteria Standar:
            </div>
            <div className="grid grid-cols-1 gap-1">
              {info.ranges.map((r, rIdx) => (
                <div
                  key={rIdx}
                  className="flex items-center justify-between text-[11px] bg-neutral-50/70 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800 px-2 py-1 rounded-md"
                >
                  <span className="font-medium text-neutral-700 dark:text-neutral-200">{r.label}</span>
                  <span className="font-mono text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Deskripsi Evaluasi */}
          <div className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 p-2 rounded-lg">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">Makna Evaluasi: </span>
            {info.description}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

interface ExamRoomOption {
  id: string;
  name: string;
  examId: string;
  examTitle: string;
  subjectName: string;
  teacherName: string;
  totalAttempts?: number;
  created: string;
}

export const ItemAnalysisPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pb, terminology, school } = useTenant();
  const { user } = useAuth();
  const { subjects, teachers } = useExamData();

  const currentRoomId = searchParams.get("roomId") || "";
  const currentExamId = searchParams.get("examId") || "";

  // State Room List & Selection
  const [roomList, setRoomList] = useState<ExamRoomOption[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(currentRoomId);

  // State Analisis
  const [loading, setLoading] = useState(false);
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
    title: "Memuat Ujian...",
    subjectName: "-",
    teacherName: "-",
    roomName: "-",
    totalParticipants: 0,
    upperCount: 0,
    lowerCount: 0
  });

  const [analyzedQuestions, setAnalyzedQuestions] = useState<QuestionAnalysis[]>([]);
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Record<string, boolean>>({});

  // AI Revision State & Handlers
  const { addToast } = useToast();
  const [revisionTargetQuestion, setRevisionTargetQuestion] = useState<QuestionAnalysis | null>(null);
  const [isRevisionDialogOpen, setIsRevisionDialogOpen] = useState<boolean>(false);

  const handleOpenAIRevision = (q: QuestionAnalysis) => {
    setRevisionTargetQuestion(q);
    setIsRevisionDialogOpen(true);
  };

  const handleSaveRevisedChoices = async (
    questionId: string,
    updatedChoices: Record<string, { text: string; isCorrect: boolean; imageUrl?: string }>,
    updatedAnswerKey: string
  ) => {
    if (!pb) throw new Error("Koneksi database tidak tersedia.");

    // Update PocketBase question record
    await pb.collection("questions").update(questionId, {
      options: updatedChoices,
      choices: updatedChoices,
      correctAnswer: updatedAnswerKey,
      answerKey: updatedAnswerKey,
      answer: updatedAnswerKey,
      correct_answer: updatedAnswerKey
    });

    // Update local analyzedQuestions state immediately
    const correctKeys = updatedAnswerKey.toLowerCase().split(/[,|; ]+/).map((s) => s.trim()).filter(Boolean);

    setAnalyzedQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;

        const newChoices: Record<string, any> = { ...updatedChoices };
        const newDistractors = (q.distractors || []).map((dis) => {
          const lowerKey = dis.key.toLowerCase();
          const updated = updatedChoices[lowerKey];
          if (!updated) return dis;
          const isCorr = correctKeys.includes(lowerKey) || Boolean(updated.isCorrect);
          return {
            ...dis,
            text: updated.text,
            isCorrect: isCorr,
            status: isCorr ? ("Kunci" as const) : dis.status
          };
        });

        return {
          ...q,
          choices: newChoices,
          answerKey: updatedAnswerKey,
          distractors: newDistractors
        };
      })
    );
  };

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [discriminationFilter, setDiscriminationFilter] = useState<string>("all");
  const [rpbFilter, setRpbFilter] = useState<string>("all");
  const [showGuideModal, setShowGuideModal] = useState(false);

  const activeFiltersCount = useMemo(() => {
    return [
      typeFilter !== "all",
      verdictFilter !== "all",
      difficultyFilter !== "all",
      discriminationFilter !== "all",
      rpbFilter !== "all",
      Boolean(searchQuery.trim())
    ].filter(Boolean).length;
  }, [typeFilter, verdictFilter, difficultyFilter, discriminationFilter, rpbFilter, searchQuery]);

  const handleResetAllFilters = useCallback(() => {
    setSearchQuery("");
    setTypeFilter("all");
    setVerdictFilter("all");
    setDifficultyFilter("all");
    setDiscriminationFilter("all");
    setRpbFilter("all");
  }, []);

  // 1. Fetch Daftar Ruangan Ujian untuk Dropdown Selector
  useEffect(() => {
    let isMounted = true;
    const loadRooms = async () => {
      if (!pb) return;
      try {
        setLoadingRooms(true);
        const roomsRecords = await pb.collection("exam_rooms").getFullList({
          sort: "-created",
          expand: "examId"
        });

        const examsList = await pb.collection("exams").getFullList({
          fields: "id,title,subjectId,subjectid,teacherId,teacherid"
        }).catch(() => []);

        const mapped: ExamRoomOption[] = roomsRecords.map((r: any) => {
          const exId = r.examId || (r as any).examid || "";
          const foundExam = examsList.find((e: any) => e.id === exId) || (r.expand?.examId as any);
          const subj = subjects.find((s: any) => s.id === (foundExam?.subjectId || foundExam?.subjectid));
          const teach = teachers.find((t: any) => t.id === (foundExam?.teacherId || foundExam?.teacherid));

          return {
            id: r.id,
            name: r.room_name || r.title || "Ruang Ujian",
            examId: exId,
            examTitle: foundExam?.title || "Ujian",
            subjectName: subj?.name || "-",
            teacherName: teach?.name || "-",
            created: r.created
          };
        });

        if (isMounted) {
          setRoomList(mapped);
          if (currentRoomId) {
            setSelectedRoomId(currentRoomId);
          } else {
            setSelectedRoomId("");
          }
        }
      } catch (err) {
        console.error("Gagal memuat daftar ruangan ujian:", err);
      } finally {
        if (isMounted) setLoadingRooms(false);
      }
    };

    loadRooms();
    return () => { isMounted = false; };
  }, [pb, subjects, teachers, currentRoomId]);

  // Handle Switch Ruangan
  const handleRoomChange = (newRoomId: string, examIdHint?: string) => {
    setSelectedRoomId(newRoomId);
    if (!newRoomId) {
      setSearchParams({});
      return;
    }
    const found = roomList.find(r => r.id === newRoomId);
    const targetExamId = found?.examId || examIdHint;
    if (targetExamId) {
      setSearchParams({ roomId: newRoomId, examId: targetExamId });
    } else {
      setSearchParams({ roomId: newRoomId });
    }
  };

  // 2. Fetch & Hitung Analisis Butir Soal untuk Ruangan Terpilih
  const loadAnalysisData = useCallback(async () => {
    if (!pb || (!selectedRoomId && !currentExamId)) return;
    setLoading(true);

    try {
      let targetExamId = currentExamId;
      let currentRoomName = "Ruang Ujian";
      let currentExamTitle = "Ujian";
      let subjName = "-";
      let teachName = "-";

      // 1. Fetch Room jika ada selectedRoomId
      if (selectedRoomId) {
        const roomRecord = await pb.collection("exam_rooms").getOne(selectedRoomId, {
          expand: "examId,examId.subjectId,examId.teacherId"
        }).catch(() => null);
        if (roomRecord) {
          targetExamId = roomRecord.examId || (roomRecord as any).examid || targetExamId;
          currentRoomName = roomRecord.room_name || currentRoomName;
          const expExam = roomRecord.expand?.examId;
          if (expExam) {
            currentExamTitle = expExam.title || currentExamTitle;
            subjName = expExam.expand?.subjectId?.name || subjName;
            teachName = expExam.expand?.teacherId?.name || teachName;
          }
        }
      }

      // 2. Fetch Exam Metadata
      if (targetExamId && (subjName === "-" || teachName === "-")) {
        const examRecord = await pb.collection("exams").getOne(targetExamId, {
          expand: "subjectId,teacherId"
        }).catch(() => null);
        if (examRecord) {
          currentExamTitle = examRecord.title || currentExamTitle;
          const s = examRecord.expand?.subjectId || subjects.find((sub: any) => sub.id === (examRecord.subjectId || examRecord.subjectid));
          subjName = s ? s.name : "-";
          const t = examRecord.expand?.teacherId || teachers.find((tc: any) => tc.id === (examRecord.teacherId || examRecord.teacherid));
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
        pilihan_ganda: "pilihan_ganda",
        complex_choice: "pilihan_ganda_kompleks",
        complex_multiple_choice: "pilihan_ganda_kompleks",
        pilihan_ganda_kompleks: "pilihan_ganda_kompleks",
        matching: "menjodohkan",
        menjodohkan: "menjodohkan",
        true_false: "benar_salah",
        benar_salah: "benar_salah",
        short_answer: "isian_singkat",
        isian_singkat: "isian_singkat",
        essay: "uraian",
        uraian: "uraian",
        sequence: "urutkan",
        ordering: "urutkan",
        urutkan: "urutkan",
        drag_drop: "drag_drop",
        klasifikasi: "klasifikasi",
        hotspot: "hotspot",
        isian_rumpang: "isian_rumpang",
        matriks: "matriks"
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
        let rawOptions = q.options || q.choices || {};
        if (typeof rawOptions === "string") {
          try {
            rawOptions = JSON.parse(rawOptions);
          } catch (e) {
            rawOptions = {};
          }
        }

        let rawStatements = rawOptions?.statements || q.statements;
        if (typeof rawStatements === "string") {
          try {
            rawStatements = JSON.parse(rawStatements);
          } catch (e) {
            rawStatements = undefined;
          }
        }

        const hasStatements = (Array.isArray(rawStatements) && rawStatements.length > 0) ||
          (Array.isArray(rawOptions) && rawOptions.length > 0 && Boolean((rawOptions[0] as any)?.statement || (rawOptions[0] as any)?.text));

        let mappedType = (typeMapReverse[rawType] || rawType) as QuestionType;
        if (hasStatements) {
          mappedType = "benar_salah";
        }

        const gId = q.groupId || q.group_id || "";
        const gTxt = q.groupText || q.group_text || (gId ? groupTextMap[gId] || "" : "");
        const ansKey = q.correctAnswer || q.answerKey || q.correct_answer || q.answer || "";

        let choicesObj: Record<string, { text: string; imageUrl?: string; isCorrect?: boolean }> | undefined = undefined;
        if (mappedType === "pilihan_ganda" || mappedType === "pilihan_ganda_kompleks") {
          if (rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)) {
            const cur: Record<string, any> = { ...rawOptions };
            delete cur.statements;
            delete cur.pairs;
            delete cur.items;
            if (ansKey) {
              const keys = ansKey.toLowerCase().split(/[,|; ]+/).map((s: string) => s.trim()).filter(Boolean);
              Object.keys(cur).forEach(k => {
                if (cur[k]) {
                  const isCorr = keys.length > 0
                    ? keys.includes(k.toLowerCase().trim())
                    : Boolean(cur[k].isCorrect);
                  cur[k] = { ...cur[k], isCorrect: isCorr };
                }
              });
            }
            choicesObj = cur;
          }
        }

        // Ekstraksi terstandar untuk pernyataan benar / salah / klasifikasi / matriks
        const statementsArr = (["benar_salah", "klasifikasi", "matriks"].includes(mappedType) || hasStatements)
          ? (Array.isArray(rawStatements) ? rawStatements : (Array.isArray(rawOptions) ? rawOptions : [])).map((st: any, sIdx: number) => ({
              id: String(st.id || sIdx + 1),
              text: st.text || st.statement || st.title || "",
              answer: String(st.answer || st.correctAnswer || st.kunci || "benar").toLowerCase().trim()
            }))
          : undefined;

        return {
          id: q.id,
          index: idx + 1,
          text: q.text || "",
          imageUrl: q.imageUrl || q.image_url || undefined,
          type: mappedType,
          groupId: gId || undefined,
          groupText: gTxt || undefined,
          choices: choicesObj,
          pairs: mappedType === "menjodohkan" ? (rawOptions.pairs || q.pairs) : undefined,
          items: (mappedType === "urutkan" || mappedType === "drag_drop") ? (rawOptions.items || q.items) : undefined,
          statements: statementsArr,
          categories: mappedType === "klasifikasi" ? (rawOptions.categories || undefined) : undefined,
          columns: mappedType === "matriks" ? (rawOptions.columns || undefined) : undefined,
          blanks: mappedType === "isian_rumpang" ? (rawOptions.blanks || undefined) : undefined,
          areas: mappedType === "hotspot" ? (rawOptions.areas || undefined) : undefined,
          options: rawOptions,
          answerKey: ansKey || undefined,
        };
      });

      // 4. Fetch Attempts (Jawaban Siswa)
      const filterQuery = selectedRoomId ? `examRoomId = "${selectedRoomId}"` : `examId = "${targetExamId}"`;
      const attempts = await pb.collection("attempts").getFullList({
        filter: filterQuery
      });

      const validAttempts = attempts.filter((a: any) => a.answers && typeof a.answers === "object" && Object.keys(a.answers).length > 0);

      // Evaluasi jawaban tiap siswa
      const evaluatedStudents: Array<{
        attemptId: string;
        studentId: string;
        totalScore: number;
        rawCorrectCount: number;
        questionResults: Record<string, {
          isCorrect: boolean;
          rawAnswer: any;
          selectedKey?: string;
          selectedKeysArray?: string[];
          statementAnswers?: Record<string, string>;
        }>;
      }> = [];

      validAttempts.forEach((att: any) => {
        const answers = att.answers || {};
        const overrides = att.overrides || (answers as any)?.__overrides__ || {};
        let correctCount = 0;
        const qResults: Record<string, {
          isCorrect: boolean;
          rawAnswer: any;
          selectedKey?: string;
          selectedKeysArray?: string[];
          statementAnswers?: Record<string, string>;
        }> = {};

        questionsList.forEach((q) => {
          const rawAns = answers[q.id];
          const hasOverride = overrides[q.id] !== undefined;
          let isCorrect = false;
          let selectedKey = "-";
          let selectedKeysArray: string[] | undefined = undefined;
          let statementAnswers: Record<string, string> | undefined = undefined;

          // 1. Selalu parse jawaban asli siswa terlebih dahulu agar data pilihan (selectedKey / selectedKeysArray) tidak hilang
          if (rawAns !== undefined && rawAns !== null && rawAns !== "") {
            if (q.type === "benar_salah") {
              const sts = q.statements || [];
              const stMap: Record<string, string> = {};
              if (sts.length > 0) {
                let stCorrect = 0;
                let parsedAns: any = rawAns;
                if (typeof rawAns === "string" && (rawAns.startsWith("{") || rawAns.startsWith("["))) {
                  try { parsedAns = JSON.parse(rawAns); } catch (e) { parsedAns = rawAns; }
                }
                sts.forEach((st: any, sIdx: number) => {
                  const expected = (st.answer || "benar").toLowerCase().trim();
                  const userRaw = (typeof parsedAns === "object" && parsedAns !== null && !Array.isArray(parsedAns))
                    ? (parsedAns[st.id] !== undefined
                        ? parsedAns[st.id]
                        : (parsedAns[String(sIdx + 1)] !== undefined
                            ? parsedAns[String(sIdx + 1)]
                            : (parsedAns[String(sIdx)] !== undefined ? parsedAns[String(sIdx)] : "")))
                    : (typeof parsedAns === "string" ? parsedAns : "");
                  const given = String(userRaw || "").toLowerCase().trim();
                  stMap[st.id] = given;
                  if (given === expected) stCorrect++;
                });
                isCorrect = sts.length > 0 && stCorrect === sts.length;
                selectedKey = sts.map((st: any, sIdx: number) => {
                  const val = stMap[st.id] || "";
                  return `${sIdx + 1}:${val ? val.toUpperCase().charAt(0) : "-"}`;
                }).join(" ");
                statementAnswers = stMap;
              } else {
                selectedKey = String(rawAns).trim().toUpperCase();
                const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === selectedKey.toLowerCase());
                isCorrect = ck ? Boolean(q.choices![ck]?.isCorrect) : false;
              }
            } else if (q.type === "pilihan_ganda") {
              selectedKey = String(rawAns).trim().toUpperCase();
              const ck = Object.keys(q.choices || {}).find(k => k.toLowerCase() === selectedKey.toLowerCase());
              isCorrect = ck ? Boolean(q.choices![ck]?.isCorrect) : false;
            } else if (q.type === "pilihan_ganda_kompleks") {
              const correctKeys = Object.keys(q.choices || {})
                .filter(k => q.choices![k]?.isCorrect)
                .map(k => k.toLowerCase().trim());

              const fallbackKeys = (q.answerKey || "").toLowerCase().split(/[,|; ]+/).map((s: string) => s.trim()).filter(Boolean);
              const finalCorrectKeys = correctKeys.length > 0 ? correctKeys : fallbackKeys;

              let studentKeys: string[] = [];
              let parsedAns: any = rawAns;
              if (typeof parsedAns === "string" && (parsedAns.startsWith("[") || parsedAns.startsWith("{"))) {
                try { parsedAns = JSON.parse(parsedAns); } catch (e) { parsedAns = rawAns; }
              }

              if (Array.isArray(parsedAns)) {
                studentKeys = parsedAns.map((k: any) => {
                  if (typeof k === "string") return k;
                  if (k && typeof k === "object") return k.key || k.id || k.value || "";
                  return String(k);
                }).map((k: any) => String(k).toLowerCase().trim());
              } else if (typeof parsedAns === "object" && parsedAns !== null) {
                const isIndexedArray = Object.keys(parsedAns).every(k => !isNaN(Number(k)));
                if (isIndexedArray) {
                  studentKeys = Object.values(parsedAns).map((v: any) => String(v).toLowerCase().trim());
                } else {
                  studentKeys = Object.entries(parsedAns)
                    .filter(([_, v]) => Boolean(v) && v !== "false" && v !== 0)
                    .map(([k]) => k.toLowerCase().trim());
                }
              } else if (typeof parsedAns === "string" && parsedAns.trim().length > 0) {
                studentKeys = parsedAns
                  .replace(/[\[\]"']/g, "")
                  .split(/[,|;\s]+/)
                  .map((k: string) => k.toLowerCase().trim());
              }
              studentKeys = studentKeys.filter(Boolean);

              const sortedStudent = [...studentKeys].sort();
              const sortedCorrect = [...finalCorrectKeys].sort();
              isCorrect = sortedCorrect.length > 0 &&
                sortedStudent.length === sortedCorrect.length &&
                sortedStudent.every((k, i) => k === sortedCorrect[i]);

              const upperKeys = studentKeys.map((k: string) => k.toUpperCase());
              selectedKey = upperKeys.sort().join(", ");
              selectedKeysArray = upperKeys;
            } else if (q.type === "isian_singkat") {
              isCorrect = isFuzzyMatch(rawAns, q.answerKey || "");
              selectedKey = String(rawAns);
            } else if (q.type === "uraian") {
              isCorrect = false;
              selectedKey = String(rawAns);
            } else if (q.type === "menjodohkan") {
              const pairs = q.pairs || [];
              isCorrect = pairs.length > 0 && pairs.every((p: any) => rawAns[p.id] === p.right);
              selectedKey = isCorrect ? "BENAR" : "SALAH";
            } else if (q.type === "urutkan" || q.type === "drag_drop") {
              const co = (q.items || []).map((it: any) => it.id);
              isCorrect = Array.isArray(rawAns) && rawAns.length === co.length && rawAns.every((v: string, i: number) => v === co[i]);
              selectedKey = isCorrect ? "BENAR" : "SALAH";
            } else if (q.type === "klasifikasi" || q.type === "matriks") {
              const ksts = q.statements || [];
              if (ksts.length > 0 && typeof rawAns === "object" && rawAns !== null && !Array.isArray(rawAns)) {
                let kCorr = 0;
                const kMap: Record<string, string> = {};
                ksts.forEach((st: any) => {
                  const sid = String(st.id ?? "");
                  const given = String(rawAns[sid] ?? "");
                  kMap[sid] = given;
                  if (given === String(st.answer ?? "")) kCorr++;
                });
                isCorrect = kCorr === ksts.length;
                statementAnswers = kMap;
                selectedKey = isCorrect ? "BENAR" : "SALAH";
              }
            } else if (q.type === "isian_rumpang") {
              const rblanks = q.blanks || q.options?.blanks || [];
              if (rblanks.length > 0 && typeof rawAns === "object" && rawAns !== null && !Array.isArray(rawAns)) {
                let bCorr = 0;
                const bMap: Record<string, string> = {};
                rblanks.forEach((bl: any) => {
                  const bid = String(bl.id ?? "");
                  const given = String(rawAns[bid] ?? "").trim();
                  bMap[bid] = given;
                  const cs = bl.caseSensitive === true;
                  const givenCmp = cs ? given : given.toLowerCase();
                  if (!givenCmp) return;
                  const acc = Array.isArray(bl.answers) ? bl.answers : (bl.answers != null ? [bl.answers] : []);
                  for (const a of acc) {
                    const expCmp = cs ? String(a ?? "").trim() : String(a ?? "").trim().toLowerCase();
                    if (expCmp && givenCmp === expCmp) { bCorr++; break; }
                  }
                });
                isCorrect = bCorr === rblanks.length;
                statementAnswers = bMap;
                selectedKey = isCorrect ? "BENAR" : "SALAH";
              }
            } else if (q.type === "hotspot") {
              const hareas = q.areas || q.options?.areas || [];
              const hmode = String(q.options?.mode || "any").toLowerCase();
              const inAr = (px: number, py: number, ar: any) => {
                const ax = Number(ar.x), ay = Number(ar.y), aw = Number(ar.w), ah = Number(ar.h);
                if (isNaN(ax) || isNaN(ay) || isNaN(aw) || isNaN(ah)) return false;
                return px >= ax && px <= ax + aw && py >= ay && py <= ay + ah;
              };
              if (hareas.length > 0) {
                if (hmode === "all") {
                  const pts = Array.isArray(rawAns) ? rawAns : [];
                  isCorrect = hareas.every((ar: any) => pts.some((pt: any) => {
                    const px = Number(pt?.x), py = Number(pt?.y);
                    return !isNaN(px) && !isNaN(py) && inAr(px, py, ar || {});
                  }));
                } else if (typeof rawAns === "object" && rawAns !== null && !Array.isArray(rawAns)) {
                  const hx = Number(rawAns.x), hy = Number(rawAns.y);
                  isCorrect = !isNaN(hx) && !isNaN(hy) && hareas.some((ar: any) => inAr(hx, hy, ar || {}));
                }
                selectedKey = isCorrect ? "BENAR" : "SALAH";
              }
            }
          }

          // 2. Override HANYA mengganti status skor penilaian (isCorrect), TIDAK menghilangkan data pilihan jawaban siswa
          if (hasOverride) {
            isCorrect = Boolean(overrides[q.id]);
            if (!selectedKey || selectedKey === "-") {
              selectedKey = isCorrect ? "BENAR" : "SALAH";
            }
          }

          if (isCorrect) correctCount++;
          qResults[q.id] = { isCorrect, rawAnswer: rawAns, selectedKey, selectedKeysArray, statementAnswers };
        });

        const totalScore = questionsList.length > 0 ? (correctCount / questionsList.length) * 100 : 0;
        evaluatedStudents.push({
          attemptId: att.id,
          studentId: att.studentId,
          totalScore,
          rawCorrectCount: correctCount,
          questionResults: qResults
        });
      });

      // Urutkan siswa dari skor tertinggi ke terendah
      evaluatedStudents.sort((a, b) => b.totalScore - a.totalScore);

      const N = evaluatedStudents.length;
      // Proporsi Kelompok Atas vs Kelompok Bawah: 27% Kelley (floor)
      const groupSize = N < 4 ? Math.max(1, Math.floor(N / 2)) : Math.max(1, Math.floor(N * 0.27));
      const upperGroup = evaluatedStudents.slice(0, groupSize);
      const lowerGroup = evaluatedStudents.slice(N - groupSize);
      const allStudentRawTotals = evaluatedStudents.map(s => s.rawCorrectCount);

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

      // 5. Analisis Tiap Butir Soal dengan 3 Lapisan CTT
      const analyzed: QuestionAnalysis[] = questionsList.map((q) => {
        let totalCorrect = 0;
        let totalAnswered = 0;
        let upperCorrect = 0;
        let lowerCorrect = 0;

        const choiceCounts: Record<string, { total: number; upper: number; lower: number }> = {};
        if (q.choices) {
          Object.keys(q.choices).forEach(k => {
            choiceCounts[k.toUpperCase()] = { total: 0, upper: 0, lower: 0 };
          });
        }

        const stStats: Record<string, {
          totalBenar: number;
          totalSalah: number;
          upperBenar: number;
          lowerBenar: number;
        }> = {};
        const hasSubItems = ["benar_salah", "klasifikasi", "matriks", "isian_rumpang"].includes(q.type) && (
          (q.statements && q.statements.length > 0) || (q.blanks && q.blanks.length > 0)
        );
        if (hasSubItems) {
          const subItems = q.type === "isian_rumpang" ? (q.blanks || q.options?.blanks || []) : (q.statements || []);
          subItems.forEach((st: any) => {
            stStats[String(st.id)] = { totalBenar: 0, totalSalah: 0, upperBenar: 0, lowerBenar: 0 };
          });
        }

        evaluatedStudents.forEach((student) => {
          const res = student.questionResults[q.id];
          if (res) {
            totalAnswered++;
            if (res.isCorrect) totalCorrect++;

            if (q.choices && (q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks")) {
              const rawList = res.selectedKeysArray && res.selectedKeysArray.length > 0
                ? res.selectedKeysArray
                : (res.selectedKey && res.selectedKey !== "-" && res.selectedKey !== "BENAR" && res.selectedKey !== "SALAH"
                    ? res.selectedKey.split(/[, ;]+/)
                    : []);
              const keys = rawList.map((s: string) => s.trim().toUpperCase()).filter(Boolean);
              keys.forEach((k: string) => {
                if (k && choiceCounts[k]) {
                  choiceCounts[k].total++;
                }
              });
            } else if (["benar_salah", "klasifikasi", "matriks", "isian_rumpang"].includes(q.type) && res.statementAnswers) {
              const subItems = q.type === "isian_rumpang" ? (q.blanks || q.options?.blanks || []) : (q.statements || []);
              subItems.forEach((st: any) => {
                const sid = String(st.id);
                const ans = res.statementAnswers![sid];
                if (q.type === "benar_salah") {
                  if (ans === "benar") stStats[sid].totalBenar++;
                  else if (ans === "salah") stStats[sid].totalSalah++;
                } else if (q.type === "isian_rumpang") {
                  const cs = st.caseSensitive === true;
                  const givenCmp = cs ? String(ans ?? "").trim() : String(ans ?? "").trim().toLowerCase();
                  const acc = Array.isArray(st.answers) ? st.answers : (st.answers != null ? [st.answers] : []);
                  const isMatch = givenCmp && acc.some((a: any) => {
                    const expCmp = cs ? String(a ?? "").trim() : String(a ?? "").trim().toLowerCase();
                    return expCmp && givenCmp === expCmp;
                  });
                  if (isMatch) stStats[sid].totalBenar++; else stStats[sid].totalSalah++;
                } else {
                  // klasifikasi / matriks
                  if (String(ans ?? "") === String(st.answer ?? "")) stStats[sid].totalBenar++;
                  else stStats[sid].totalSalah++;
                }
              });
            }
          }
        });

        upperGroup.forEach((student) => {
          const res = student.questionResults[q.id];
          if (res?.isCorrect) upperCorrect++;

          if (q.choices && (q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks")) {
            const rawList = res?.selectedKeysArray && res.selectedKeysArray.length > 0
              ? res.selectedKeysArray
              : (res?.selectedKey && res.selectedKey !== "-" && res.selectedKey !== "BENAR" && res.selectedKey !== "SALAH"
                  ? res.selectedKey.split(/[, ;]+/)
                  : []);
            const keys = rawList.map((s: string) => s.trim().toUpperCase()).filter(Boolean);
            keys.forEach((k: string) => {
              if (k && choiceCounts[k]) {
                choiceCounts[k].upper++;
              }
            });
          } else if (["benar_salah", "klasifikasi", "matriks", "isian_rumpang"].includes(q.type) && res?.statementAnswers) {
            const subItems = q.type === "isian_rumpang" ? (q.blanks || q.options?.blanks || []) : (q.statements || []);
            subItems.forEach((st: any) => {
              const sid = String(st.id);
              const ans = res.statementAnswers![sid];
              let isStCorrect = false;
              if (q.type === "benar_salah") {
                const expected = (st.answer || "benar").toLowerCase().trim();
                isStCorrect = ans === expected;
              } else if (q.type === "isian_rumpang") {
                const cs = st.caseSensitive === true;
                const givenCmp = cs ? String(ans ?? "").trim() : String(ans ?? "").trim().toLowerCase();
                const acc = Array.isArray(st.answers) ? st.answers : (st.answers != null ? [st.answers] : []);
                isStCorrect = !!givenCmp && acc.some((a: any) => {
                  const expCmp = cs ? String(a ?? "").trim() : String(a ?? "").trim().toLowerCase();
                  return expCmp && givenCmp === expCmp;
                });
              } else {
                isStCorrect = String(ans ?? "") === String(st.answer ?? "");
              }
              if (isStCorrect) stStats[sid].upperBenar++;
            });
          }
        });

        lowerGroup.forEach((student) => {
          const res = student.questionResults[q.id];
          if (res?.isCorrect) lowerCorrect++;

          if (q.choices && (q.type === "pilihan_ganda" || q.type === "pilihan_ganda_kompleks")) {
            const rawList = res?.selectedKeysArray && res.selectedKeysArray.length > 0
              ? res.selectedKeysArray
              : (res?.selectedKey && res.selectedKey !== "-" && res.selectedKey !== "BENAR" && res.selectedKey !== "SALAH"
                  ? res.selectedKey.split(/[, ;]+/)
                  : []);
            const keys = rawList.map((s: string) => s.trim().toUpperCase()).filter(Boolean);
            keys.forEach((k: string) => {
              if (k && choiceCounts[k]) {
                choiceCounts[k].lower++;
              }
            });
          } else if (["benar_salah", "klasifikasi", "matriks", "isian_rumpang"].includes(q.type) && res?.statementAnswers) {
            const subItems = q.type === "isian_rumpang" ? (q.blanks || q.options?.blanks || []) : (q.statements || []);
            subItems.forEach((st: any) => {
              const sid = String(st.id);
              const ans = res.statementAnswers![sid];
              let isStCorrect = false;
              if (q.type === "benar_salah") {
                const expected = (st.answer || "benar").toLowerCase().trim();
                isStCorrect = ans === expected;
              } else if (q.type === "isian_rumpang") {
                const cs = st.caseSensitive === true;
                const givenCmp = cs ? String(ans ?? "").trim() : String(ans ?? "").trim().toLowerCase();
                const acc = Array.isArray(st.answers) ? st.answers : (st.answers != null ? [st.answers] : []);
                isStCorrect = !!givenCmp && acc.some((a: any) => {
                  const expCmp = cs ? String(a ?? "").trim() : String(a ?? "").trim().toLowerCase();
                  return expCmp && givenCmp === expCmp;
                });
              } else {
                isStCorrect = String(ans ?? "") === String(st.answer ?? "");
              }
              if (isStCorrect) stStats[sid].lowerBenar++;
            });
          }
        });

        // Skor butir seluruh siswa (1 jika benar, 0 jika salah)
        const itemScores = evaluatedStudents.map((student) => {
          const res = student.questionResults[q.id];
          return res && res.isCorrect ? 1 : 0;
        });

        // Layer 1: Point-Biserial Correlation (Corrected Item-Total)
        const pointBiserial = calculateCorrectedPointBiserial(itemScores, allStudentRawTotals);
        const pointBiserialCategory = getPointBiserialCategory(pointBiserial);

        // Layer 1: Indeks Kesukaran P = B / N
        const difficultyIndex = N > 0 ? totalCorrect / N : 0;
        const difficultyCategory = getDifficultyCategory(difficultyIndex);

        // Layer 1: Daya Pembeda D = (B_A - B_B) / n
        const nGroup = upperGroup.length || 1;
        const discriminationIndex = (upperCorrect - lowerCorrect) / nGroup;
        const discriminationCategory = getDiscriminationCategory(discriminationIndex);

        // Layer 1: Analisis Pengecoh & Distractor Efficiency (DE)
        let distractorsList: DistractorAnalysis[] | undefined = undefined;
        let effectiveDistractorCount = 0;
        let totalDistractorCount = 0;

        if (q.choices && Object.keys(q.choices).length > 0) {
          distractorsList = Object.entries(q.choices).map(([key, choiceVal]) => {
            const kUpper = key.toUpperCase();
            const counts = choiceCounts[kUpper] || { total: 0, upper: 0, lower: 0 };
            const totalPercent = N > 0 ? (counts.total / N) * 100 : 0;
            const upperPercent = upperGroup.length > 0 ? (counts.upper / upperGroup.length) * 100 : 0;
            const lowerPercent = lowerGroup.length > 0 ? (counts.lower / lowerGroup.length) * 100 : 0;
            const isCorrect = Boolean(choiceVal.isCorrect) || (q.answerKey ? q.answerKey.toUpperCase().split(/[,|; ]+/).includes(kUpper) : false);

            let status: DistractorAnalysis["status"] = "Efektif";
            let effective = false;
            let note = "";

            if (isCorrect) {
              status = "Kunci";
              note = "Kunci jawaban resmi.";
            } else {
              totalDistractorCount++;
              if (counts.upper > counts.lower && counts.total >= 1) {
                status = "Menyesatkan";
                effective = false;
                note = `Pengecoh menjebak siswa pintar (dipilih ${counts.upper} siswa kelompok atas vs ${counts.lower} siswa kelompok bawah).`;
              } else if (totalPercent < 5) {
                status = "Tidak Efektif";
                effective = false;
                note = `Pengecoh pasif/mati (hanya dipilih ${Math.round(totalPercent)}% siswa, di bawah standar minimal 5%).`;
              } else {
                status = "Efektif";
                effective = true;
                effectiveDistractorCount++;
                note = `Pengecoh bekerja dengan baik (dipilih ${Math.round(totalPercent)}% siswa dan lebih banyak menarik kelompok bawah).`;
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
              status,
              effective,
              note
            };
          });
        }

        const distractorEfficiency = totalDistractorCount > 0
          ? Math.round((effectiveDistractorCount / totalDistractorCount) * 100)
          : 100;

        // Layer 1 Khusus: Analisis Pernyataan (Benar/Salah, Klasifikasi, Matriks, Isian Rumpang)
        let statementsList: StatementAnalysis[] | undefined = undefined;
        const subItemsForAnalysis = q.type === "isian_rumpang" ? (q.blanks || q.options?.blanks || []) : (q.statements || []);
        if (["benar_salah", "klasifikasi", "matriks", "isian_rumpang"].includes(q.type) && subItemsForAnalysis.length > 0) {
          statementsList = subItemsForAnalysis.map((st: any, sIdx: number) => {
            const sid = String(st.id ?? sIdx + 1);
            const stats = stStats[sid] || { totalBenar: 0, totalSalah: 0, upperBenar: 0, lowerBenar: 0 };
            const expectedAns = q.type === "benar_salah" ? (st.answer || "benar").toLowerCase() : "benar";
            const totalBenarPercent = N > 0 ? Math.round((stats.totalBenar / N) * 100) : 0;
            const totalSalahPercent = N > 0 ? Math.round((stats.totalSalah / N) * 100) : 0;

            const upperBenarPercent = upperGroup.length > 0 ? Math.round((stats.upperBenar / upperGroup.length) * 100) : 0;
            const lowerBenarPercent = lowerGroup.length > 0 ? Math.round((stats.lowerBenar / lowerGroup.length) * 100) : 0;

            const correctTotal = stats.totalBenar;
            const pSt = N > 0 ? Number((correctTotal / N).toFixed(2)) : 0;
            const dSt = Number(((stats.upperBenar - stats.lowerBenar) / nGroup).toFixed(2));

            let status: StatementAnalysis["status"] = "Berfungsi Baik";
            let note = "";

            if (dSt < 0) {
              status = "Menyesatkan";
              note = `Kelompok bawah (${stats.lowerBenar}) lebih banyak menjawab benar dibanding kelompok atas (${stats.upperBenar}). Pernyataan memicu miskonsepsi.`;
            } else if (pSt > 0.90) {
              status = "Terlalu Mudah";
              note = `Hampir seluruh siswa (${Math.round(pSt * 100)}%) menjawab benar. Daya pembeda pernyataan ini rendah.`;
            } else if (pSt < 0.20) {
              status = "Terlalu Sukar";
              note = `Hanya ${Math.round(pSt * 100)}% siswa yang menjawab benar. Konsep atau redaksi pernyataan terlalu sulit.`;
            } else if (dSt >= 0.30) {
              status = "Berfungsi Baik";
              note = `Daya pembeda sangat baik (D = +${dSt.toFixed(2)}). Efektif membedakan pemahaman siswa.`;
            } else {
              status = "Cukup";
              note = `Daya pembeda cukup (D = +${dSt.toFixed(2)}). Pernyataan dapat dipertahankan.`;
            }

            return {
              id: sid,
              index: sIdx + 1,
              text: st.text || (q.type === "isian_rumpang" ? `Rumpang ${sIdx + 1}` : ""),
              correctAnswer: q.type === "isian_rumpang"
                ? (Array.isArray(st.answers) ? st.answers.map((a: any) => String(a)).join(" / ") : String(st.answers || ""))
                : expectedAns,
              totalBenar: stats.totalBenar,
              totalBenarPercent,
              totalSalah: stats.totalSalah,
              totalSalahPercent,
              upperBenar: stats.upperBenar,
              upperBenarPercent,
              lowerBenar: stats.lowerBenar,
              lowerBenarPercent,
              difficultyIndex: pSt,
              discriminationIndex: dSt,
              status,
              note
            };
          });
        }

        const hasValidKey = ["benar_salah", "klasifikasi", "matriks", "isian_rumpang"].includes(q.type)
          ? (subItemsForAnalysis.length > 0 && subItemsForAnalysis.some((s: any) => q.type === "isian_rumpang" ? Boolean(s.answers) : Boolean(s.answer))) || Boolean(q.answerKey)
          : q.type === "pilihan_ganda_kompleks"
          ? (q.choices && Object.values(q.choices).some((c: any) => Boolean(c.isCorrect))) || Boolean(q.answerKey)
          : Boolean(q.answerKey);

        // Layer 2 & 3: Evaluasi Rinci dengan Evaluator Psikometri CTT
        const verdictDetail = evaluateQuestionVerdict({
          p: difficultyIndex,
          d: discriminationIndex,
          rpb: pointBiserial,
          hasValidKey,
          distractors: distractorsList,
          statementsAnalysis: statementsList,
          qType: q.type
        });

        return {
          id: q.id,
          index: q.index,
          text: q.text,
          imageUrl: q.imageUrl,
          type: q.type,
          groupId: q.groupId,
          groupText: q.groupText,
          choices: q.choices,
          answerKey: q.answerKey,
          pairs: q.pairs,
          items: q.items,
          statements: q.statements,
          totalAnswered,
          totalCorrect,
          difficultyIndex: Number(difficultyIndex.toFixed(2)),
          difficultyCategory,
          upperGroupCorrect: upperCorrect,
          lowerGroupCorrect: lowerCorrect,
          discriminationIndex: Number(discriminationIndex.toFixed(2)),
          discriminationCategory,
          pointBiserial,
          pointBiserialCategory,
          distractorEfficiency,
          effectiveDistractorCount,
          totalDistractorCount,
          flags: verdictDetail.flags,
          verdict: verdictDetail.verdict,
          verdictDetail,
          recommendation: verdictDetail.summaryTitle,
          distractors: distractorsList,
          statementsAnalysis: statementsList
        };
      });

      setAnalyzedQuestions(analyzed);
      const initExpanded: Record<string, boolean> = {};
      analyzed.forEach(q => { initExpanded[q.id] = true; });
      setExpandedQuestionIds(initExpanded);
    } catch (err) {
      console.error("Gagal memproses analisis butir soal:", err);
    } finally {
      setLoading(false);
    }
  }, [pb, selectedRoomId, currentExamId, subjects, teachers]);

  useEffect(() => {
    if (selectedRoomId) {
      loadAnalysisData();
    }
  }, [selectedRoomId, loadAnalysisData]);

  // Toggle Accordion per Butir Soal
  const toggleExpand = (qId: string) => {
    setExpandedQuestionIds(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const toggleExpandAll = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    analyzedQuestions.forEach(q => { updated[q.id] = expand; });
    setExpandedQuestionIds(updated);
  };

  // KPI Metrics Calculation
  const stats = useMemo(() => {
    if (analyzedQuestions.length === 0) {
      return {
        avgP: 0,
        avgD: 0,
        avgRpb: 0,
        avgDE: 0,
        acceptedCount: 0,
        minorRevisionCount: 0,
        revisionCount: 0,
        totalRevisionCount: 0,
        rejectedCount: 0,
        keyAlertCount: 0,
        acceptedPercent: 0,
        minorRevisionPercent: 0,
        revisionPercent: 0,
        totalRevisionPercent: 0,
        rejectedPercent: 0,
        pDist: { mudah: 0, sedang: 0, sukar: 0 }
      };
    }

    let sumP = 0;
    let sumD = 0;
    let sumRpb = 0;
    let sumDE = 0;
    let accepted = 0;
    let minorRevision = 0;
    let revision = 0;
    let totalRevision = 0;
    let rejected = 0;
    let keyAlert = 0;
    const pDist = { mudah: 0, sedang: 0, sukar: 0 };

    analyzedQuestions.forEach(q => {
      sumP += q.difficultyIndex;
      sumD += q.discriminationIndex;
      sumRpb += q.pointBiserial;
      sumDE += q.distractorEfficiency;

      if (q.verdict === "Diterima") accepted++;
      else if (q.verdict === "Revisi Kecil") minorRevision++;
      else if (q.verdict === "Revisi") revision++;
      else if (q.verdict === "Revisi Total") totalRevision++;
      else if (q.verdict === "Ditolak") rejected++;

      if (q.verdictDetail?.keyAlert) keyAlert++;

      if (q.difficultyIndex <= 0.30) pDist.sukar++;
      else if (q.difficultyIndex <= 0.70) pDist.sedang++;
      else pDist.mudah++;
    });

    const total = analyzedQuestions.length;
    return {
      avgP: Number((sumP / total).toFixed(2)),
      avgD: Number((sumD / total).toFixed(2)),
      avgRpb: Number((sumRpb / total).toFixed(2)),
      avgDE: Math.round(sumDE / total),
      acceptedCount: accepted,
      minorRevisionCount: minorRevision,
      revisionCount: revision,
      totalRevisionCount: totalRevision,
      rejectedCount: rejected,
      keyAlertCount: keyAlert,
      acceptedPercent: Math.round((accepted / total) * 100),
      minorRevisionPercent: Math.round((minorRevision / total) * 100),
      revisionPercent: Math.round((revision / total) * 100),
      totalRevisionPercent: Math.round((totalRevision / total) * 100),
      rejectedPercent: Math.round((rejected / total) * 100),
      pDist
    };
  }, [analyzedQuestions]);

  // Filter Data
  const filteredQuestions = useMemo(() => {
    return analyzedQuestions.filter(q => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesIndex = String(q.index).includes(query);
        const matchesText = q.text.toLowerCase().includes(query);
        const matchesGroup = q.groupText ? q.groupText.toLowerCase().includes(query) : false;
        if (!matchesIndex && !matchesText && !matchesGroup) return false;
      }

      if (typeFilter !== "all" && q.type !== typeFilter) return false;
      if (verdictFilter !== "all" && q.verdict !== verdictFilter) return false;

      if (difficultyFilter !== "all") {
        if (difficultyFilter === "sukar" && q.difficultyCategory !== "Sukar") return false;
        if (difficultyFilter === "sedang" && q.difficultyCategory !== "Sedang") return false;
        if (difficultyFilter === "mudah" && q.difficultyCategory !== "Mudah") return false;
      }

      if (discriminationFilter !== "all") {
        if (discriminationFilter === "sangat_baik" && q.discriminationCategory !== "Sangat Baik") return false;
        if (discriminationFilter === "baik" && q.discriminationCategory !== "Baik") return false;
        if (discriminationFilter === "cukup" && q.discriminationCategory !== "Cukup") return false;
        if (discriminationFilter === "rendah" && q.discriminationCategory !== "Rendah") return false;
        if (discriminationFilter === "negatif" && q.discriminationCategory !== "Negatif") return false;
      }

      if (rpbFilter !== "all") {
        if (rpbFilter === "sangat_baik" && q.pointBiserialCategory !== "Sangat Baik") return false;
        if (rpbFilter === "baik" && q.pointBiserialCategory !== "Baik") return false;
        if (rpbFilter === "cukup" && q.pointBiserialCategory !== "Cukup") return false;
        if (rpbFilter === "rendah" && q.pointBiserialCategory !== "Rendah") return false;
        if (rpbFilter === "negatif" && q.pointBiserialCategory !== "Negatif") return false;
      }

      return true;
    });
  }, [analyzedQuestions, searchQuery, typeFilter, verdictFilter, difficultyFilter, discriminationFilter, rpbFilter]);

  // Export Excel Lengkap (3 Sheet: Soal + Pilihan Jawaban Lengkap, Pengecoh, Rekapitulasi)
  const handleExportExcel = () => {
    if (analyzedQuestions.length === 0) return;

    const wb = XLSX.utils.book_new();

    const STYLES = {
      title: {
        font: { bold: true, sz: 14, color: { rgb: "1E293B" } },
        alignment: { vertical: "center" }
      },
      header: {
        fill: { patternType: "solid", fgColor: { rgb: "1E3A8A" } },
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      cell: {
        alignment: { vertical: "center", wrapText: true },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      cellCenter: {
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      accepted: {
        fill: { patternType: "solid", fgColor: { rgb: "D1FAE5" } },
        font: { color: { rgb: "065F46" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      minorRevision: {
        fill: { patternType: "solid", fgColor: { rgb: "FEF9C3" } },
        font: { color: { rgb: "854D0E" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      revision: {
        fill: { patternType: "solid", fgColor: { rgb: "FEF3C7" } },
        font: { color: { rgb: "92400E" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      totalRevision: {
        fill: { patternType: "solid", fgColor: { rgb: "FFEDD5" } },
        font: { color: { rgb: "9A3412" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      },
      rejected: {
        fill: { patternType: "solid", fgColor: { rgb: "FEE2E2" } },
        font: { color: { rgb: "991B1B" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      }
    };

    const cleanTextForExcel = (raw: string) => {
      if (!raw) return "";
      return raw
        .replace(/\\noindent\b/g, "")
        .replace(/\\textbf\{([^}]+)\}/g, "$1")
        .replace(/\\textit\{([^}]+)\}/g, "$1")
        .replace(/\\emph\{([^}]+)\}/g, "$1")
        .replace(/\\underline\{([^}]+)\}/g, "$1")
        .replace(/\\dots\b/g, "...")
        .replace(/\\qquad\b/g, " ")
        .replace(/\\quad\b/g, " ")
        .replace(/\\newline\b/g, " ")
        .replace(/<[^>]*>?/gm, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    };

    // Helper untuk mengambil rincian teks pilihan jawaban
    const getChoiceDetail = (q: QuestionAnalysis, key: string) => {
      const kUpper = key.toUpperCase();

      // Jika butir soal adalah benar_salah, petakan A, B, C, D, E ke Pernyataan 1, 2, 3, 4, 5
      if (q.type === "benar_salah" && q.statements && q.statements.length > 0) {
        const sIdx = kUpper.charCodeAt(0) - 65; // A -> 0, B -> 1, ...
        if (sIdx >= 0 && sIdx < q.statements.length) {
          const st = q.statements[sIdx];
          const stAn = q.statementsAnalysis?.find(s => s.id === st.id || s.index === sIdx + 1);
          const ansKey = (st.answer || "benar").toUpperCase();
          let stRes = `[Pernyataan ${sIdx + 1} - Kunci: ${ansKey}] ${cleanTextForExcel(st.text || "")}`;
          if (stAn) {
            stRes += ` (${stAn.totalBenar}B/${stAn.totalSalah}S • P=${stAn.difficultyIndex.toFixed(2)} • D=${stAn.discriminationIndex >= 0 ? "+" : ""}${stAn.discriminationIndex.toFixed(2)})`;
          }
          return stRes;
        }
        return "-";
      }

      if (!q.choices) return "-";
      const choice = q.choices[kUpper] || q.choices[key.toLowerCase()];
      if (!choice) return "-";

      const cleanText = cleanTextForExcel(choice.text || "");
      const isKey = Boolean(choice.isCorrect) || (q.answerKey ? q.answerKey.toUpperCase().split(/[,|; ]+/).includes(kUpper) : false);
      const dist = q.distractors?.find(d => d.key.toUpperCase() === kUpper);

      let res = cleanText;
      if (isKey) res = `[KUNCI] ${res}`;
      if (dist) {
        res += ` (${dist.totalCount} pemilih • ${dist.totalPercent}%)`;
      }
      return res;
    };

    // Sheet 1: Analisis Butir Soal Utama & Pilihan Jawaban Lengkap (Layer 1, 2, 3 CTT)
    const mainHeader = [
      "No",
      "Tipe Soal",
      "Teks Butir Soal",
      "Kunci Jawaban",
      "Pilihan A",
      "Pilihan B",
      "Pilihan C",
      "Pilihan D",
      "Pilihan E",
      "Siswa Benar (B/N)",
      "Tingkat Kesukaran (P)",
      "Kategori Kesukaran",
      "Benar Kel. Atas (Ba)",
      "Benar Kel. Bawah (Bb)",
      "Daya Pembeda (D)",
      "Kategori Daya Beda",
      "Point-Biserial (r_pb)",
      "Kategori r_pb",
      "Efektivitas Pengecoh (DE%)",
      "Keputusan CTT",
      "Ringkasan Evaluasi",
      "Diagnosis Masalah & Temuan",
      "Tindak Lanjut & Rekomendasi Guru"
    ];

    const mainRows: any[][] = [
      [{ v: `LAPORAN ANALISIS BUTIR SOAL & DAYA PEMBEDA (CLASSICAL TEST THEORY): ${examMeta.title}`, s: STYLES.title }],
      [{ v: `Sekolah: ${school?.name || "Sekolah"} | Ruangan: ${examMeta.roomName}`, s: { font: { bold: true, sz: 10 } } }],
      [{ v: `Mata Pelajaran: ${examMeta.subjectName} | Guru Pengampu: ${examMeta.teacherName}`, s: { font: { italic: true, sz: 10 } } }],
      [{ v: `Total Peserta: ${examMeta.totalParticipants} Siswa | Kelompok Atas (27%): ${examMeta.upperCount} Siswa | Kelompok Bawah (27%): ${examMeta.lowerCount} Siswa`, s: { font: { italic: true, sz: 10 } } }],
      [{ v: `Standar Psikometri: Classical Test Theory (CTT), Kelley's 27% Rule, Robert L. Ebel, & Point-Biserial Correlation`, s: { font: { italic: true, sz: 9, color: { rgb: "64748B" } } } }],
      [],
      mainHeader.map(h => ({ v: h, s: STYLES.header }))
    ];

    analyzedQuestions.forEach((q) => {
      let vStyle = STYLES.accepted;
      if (q.verdict === "Revisi Kecil") vStyle = STYLES.minorRevision;
      else if (q.verdict === "Revisi") vStyle = STYLES.revision;
      else if (q.verdict === "Revisi Total") vStyle = STYLES.totalRevision;
      else if (q.verdict === "Ditolak") vStyle = STYLES.rejected;

      const findingsStr = q.verdictDetail.findings.map((f, i) => `${i + 1}. ${f}`).join("\n");

      const keyDisplay = q.type === "benar_salah" && q.statements
        ? q.statements.map((s, idx) => `${idx + 1}:${(s.answer || "benar").toUpperCase().charAt(0)}`).join(" ")
        : (q.type === "pilihan_ganda_kompleks" && q.choices
            ? Object.keys(q.choices).filter(k => q.choices![k]?.isCorrect).map(k => k.toUpperCase()).sort().join(", ") || q.answerKey || "-"
            : q.answerKey || "-");

      mainRows.push([
        { v: q.index, s: STYLES.cellCenter },
        { v: q.type.toUpperCase(), s: STYLES.cellCenter },
        { v: cleanTextForExcel(q.text), s: STYLES.cell },
        { v: keyDisplay, s: STYLES.cellCenter },
        { v: getChoiceDetail(q, "A"), s: STYLES.cell },
        { v: getChoiceDetail(q, "B"), s: STYLES.cell },
        { v: getChoiceDetail(q, "C"), s: STYLES.cell },
        { v: getChoiceDetail(q, "D"), s: STYLES.cell },
        { v: getChoiceDetail(q, "E"), s: STYLES.cell },
        { v: `${q.totalCorrect}/${q.totalAnswered}`, s: STYLES.cellCenter },
        { v: q.difficultyIndex, s: STYLES.cellCenter },
        { v: q.difficultyCategory, s: STYLES.cellCenter },
        { v: q.upperGroupCorrect, s: STYLES.cellCenter },
        { v: q.lowerGroupCorrect, s: STYLES.cellCenter },
        { v: q.discriminationIndex, s: STYLES.cellCenter },
        { v: q.discriminationCategory, s: STYLES.cellCenter },
        { v: q.pointBiserial, s: STYLES.cellCenter },
        { v: q.pointBiserialCategory, s: STYLES.cellCenter },
        { v: `${q.distractorEfficiency}%`, s: STYLES.cellCenter },
        { v: q.verdict.toUpperCase(), s: vStyle },
        { v: q.verdictDetail.summaryTitle, s: STYLES.cell },
        { v: findingsStr, s: STYLES.cell },
        { v: q.verdictDetail.actionPlan, s: STYLES.cell }
      ]);
    });

    const wsMain = XLSX.utils.aoa_to_sheet(mainRows);
    wsMain["!cols"] = [
      { wch: 6 },   // No
      { wch: 18 },  // Tipe Soal
      { wch: 45 },  // Teks Butir Soal
      { wch: 14 },  // Kunci
      { wch: 32 },  // Pilihan A
      { wch: 32 },  // Pilihan B
      { wch: 32 },  // Pilihan C
      { wch: 32 },  // Pilihan D
      { wch: 32 },  // Pilihan E
      { wch: 14 },  // B/N
      { wch: 18 },  // P
      { wch: 16 },  // Kategori P
      { wch: 16 },  // Ba
      { wch: 16 },  // Bb
      { wch: 18 },  // D
      { wch: 18 },  // Kategori D
      { wch: 18 },  // r_pb
      { wch: 16 },  // Kategori r_pb
      { wch: 18 },  // DE%
      { wch: 20 },  // Keputusan
      { wch: 36 },  // Ringkasan
      { wch: 45 },  // Temuan & Diagnosis
      { wch: 45 }   // Tindak Lanjut
    ];
    XLSX.utils.book_append_sheet(wb, wsMain, "Analisis Butir Soal");

    // Sheet 2: Analisis Distribusi Pengecoh (Distractors)
    const distHeader = [
      "No Soal",
      "Opsi",
      "Peran",
      "Status Efektivitas",
      "Efektif (≥5% & Bb>Ba)",
      "Total Pemilih",
      "Persentase (%)",
      "Pemilih Kel. Atas (Ba)",
      "Pemilih Kel. Bawah (Bb)",
      "Catatan Evaluasi Pengecoh",
      "Teks Opsi Pilihan Jawaban"
    ];

    const distRows: any[][] = [
      [{ v: `DISTRIBUSI OPSI JAWABAN & ANALISIS PENGECOH (DISTRACTOR ANALYSIS)`, s: STYLES.title }],
      [{ v: `Kriteria Pengecoh Efektif: Dipilih minimal 5% peserta (Fo >= 5%) dan lebih banyak menarik siswa Kelompok Bawah daripada Kelompok Atas (nBB > nBA).`, s: { font: { italic: true, sz: 10 } } }],
      [],
      distHeader.map(h => ({ v: h, s: STYLES.header }))
    ];

    analyzedQuestions.forEach((q) => {
      if (q.type !== "benar_salah" && q.distractors && q.distractors.length > 0) {
        q.distractors.forEach((d) => {
          let dStyle = STYLES.cellCenter;
          if (d.status === "Kunci" || d.effective) dStyle = STYLES.accepted;
          else if (d.status === "Menyesatkan") dStyle = STYLES.rejected;
          else if (d.status === "Tidak Efektif") dStyle = STYLES.revision;

          distRows.push([
            { v: q.index, s: STYLES.cellCenter },
            { v: d.key, s: STYLES.cellCenter },
            { v: d.isCorrect ? "KUNCI JAWABAN" : "PENGECOH", s: d.isCorrect ? STYLES.accepted : STYLES.cellCenter },
            { v: d.status, s: dStyle },
            { v: d.isCorrect ? "KUNCI" : (d.effective ? "YA" : "TIDAK"), s: d.effective ? STYLES.accepted : STYLES.cellCenter },
            { v: d.totalCount, s: STYLES.cellCenter },
            { v: `${d.totalPercent}%`, s: STYLES.cellCenter },
            { v: `${d.upperCount} (${d.upperPercent}%)`, s: STYLES.cellCenter },
            { v: `${d.lowerCount} (${d.lowerPercent}%)`, s: STYLES.cellCenter },
            { v: d.note, s: STYLES.cell },
            { v: cleanTextForExcel(d.text), s: STYLES.cell }
          ]);
        });
      } else if (q.statementsAnalysis && q.statementsAnalysis.length > 0) {
        q.statementsAnalysis.forEach((st) => {
          let sStyle = STYLES.cellCenter;
          if (st.status === "Berfungsi Baik") sStyle = STYLES.accepted;
          else if (st.status === "Menyesatkan") sStyle = STYLES.rejected;
          else if (st.status === "Terlalu Mudah" || st.status === "Terlalu Sukar") sStyle = STYLES.revision;

          distRows.push([
            { v: q.index, s: STYLES.cellCenter },
            { v: `P.${st.index}`, s: STYLES.cellCenter },
            { v: `KUNCI: ${st.correctAnswer.toUpperCase()}`, s: STYLES.accepted },
            { v: st.status, s: sStyle },
            { v: st.status === "Berfungsi Baik" ? "YA" : "TIDAK", s: st.status === "Berfungsi Baik" ? STYLES.accepted : STYLES.cellCenter },
            { v: `${st.totalBenar} B / ${st.totalSalah} S`, s: STYLES.cellCenter },
            { v: `${st.totalBenarPercent}% B`, s: STYLES.cellCenter },
            { v: `${st.upperBenar} B (${st.upperBenarPercent}%)`, s: STYLES.cellCenter },
            { v: `${st.lowerBenar} B (${st.lowerBenarPercent}%)`, s: STYLES.cellCenter },
            { v: st.note, s: STYLES.cell },
            { v: cleanTextForExcel(st.text), s: STYLES.cell }
          ]);
        });
      }
    });

    const wsDist = XLSX.utils.aoa_to_sheet(distRows);
    wsDist["!cols"] = [
      { wch: 8 },
      { wch: 8 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 14 },
      { wch: 15 },
      { wch: 22 },
      { wch: 22 },
      { wch: 45 },
      { wch: 40 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDist, "Analisis Pengecoh");

    // Sheet 3: Rekapitulasi & Statistik Ujian (3-Layer CTT)
    const recapRows: any[][] = [
      [{ v: `REKAPITULASI LAPORAN ANALISIS BUTIR SOAL (CLASSICAL TEST THEORY)`, s: STYLES.title }],
      [{ v: `Sekolah: ${school?.name || "Sekolah"}`, s: { font: { bold: true, sz: 11 } } }],
      [{ v: `Ujian: ${examMeta.title} | Mata Pelajaran: ${examMeta.subjectName} | Guru Pengampu: ${examMeta.teacherName}`, s: { font: { italic: true, sz: 10 } } }],
      [{ v: `Ruangan: ${examMeta.roomName} | Tanggal Ekspor: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, s: { font: { italic: true, sz: 9, color: { rgb: "64748B" } } } }],
      [],
      [{ v: "PARAMETER ANALISIS CTT", s: STYLES.header }, { v: "NILAI", s: STYLES.header }, { v: "KETERANGAN STANDAR", s: STYLES.header }],
      [{ v: "Total Peserta Ujian (N)", s: STYLES.cell }, { v: examMeta.totalParticipants, s: STYLES.cellCenter }, { v: "Siswa yang mengumpulkan ujian", s: STYLES.cell }],
      [{ v: "Ukuran Sampel Kelompok Ekstrem (n)", s: STYLES.cell }, { v: `${examMeta.upperCount} Siswa`, s: STYLES.cellCenter }, { v: "Proporsi 27% Atas dan 27% Bawah (Kelley's Rule)", s: STYLES.cell }],
      [{ v: "Total Butir Soal Teranalisis", s: STYLES.cell }, { v: `${analyzedQuestions.length} Butir`, s: STYLES.cellCenter }, { v: "Seluruh butir soal dalam paket ujian", s: STYLES.cell }],
      [{ v: "Rata-rata Tingkat Kesukaran (P)", s: STYLES.cell }, { v: stats.avgP, s: STYLES.cellCenter }, { v: `${getDifficultyCategory(stats.avgP)} (Distribusi: ${stats.pDist.mudah} Mudah, ${stats.pDist.sedang} Sedang, ${stats.pDist.sukar} Sukar)`, s: STYLES.cell }],
      [{ v: "Rata-rata Daya Pembeda (D)", s: STYLES.cell }, { v: stats.avgD >= 0 ? `+${stats.avgD}` : stats.avgD, s: STYLES.cellCenter }, { v: `${getDifficultyCategory(stats.avgD)} (Pedoman Robert L. Ebel)`, s: STYLES.cell }],
      [{ v: "Rata-rata Point-Biserial (r_pb)", s: STYLES.cell }, { v: stats.avgRpb >= 0 ? `+${stats.avgRpb}` : stats.avgRpb, s: STYLES.cellCenter }, { v: `${getPointBiserialCategory(stats.avgRpb)} (Corrected Item-Total Correlation)`, s: STYLES.cell }],
      [{ v: "Rata-rata Efektivitas Pengecoh (DE%)", s: STYLES.cell }, { v: `${stats.avgDE}%`, s: STYLES.cellCenter }, { v: "Persentase pengecoh berfungsi memenuhi syarat psikometri", s: STYLES.cell }],
      [],
      [{ v: "REKAPITULASI KEPUTUSAN KELAYAKAN (DECISION ENGINE)", s: STYLES.header }, { v: "JUMLAH BUTIR", s: STYLES.header }, { v: "PERSENTASE (%)", s: STYLES.header }],
      [{ v: "🟢 Diterima (Item Berfungsi Sangat Baik)", s: STYLES.cell }, { v: stats.acceptedCount, s: STYLES.accepted }, { v: `${stats.acceptedPercent}%`, s: STYLES.accepted }],
      [{ v: "🟡 Revisi Kecil (Penyesuaian Minor Pengecoh)", s: STYLES.cell }, { v: stats.minorRevisionCount, s: STYLES.minorRevision }, { v: `${stats.minorRevisionPercent}%`, s: STYLES.minorRevision }],
      [{ v: "🟠 Revisi (Penyesuaian Kesukaran / Opsi)", s: STYLES.cell }, { v: stats.revisionCount, s: STYLES.revision }, { v: `${stats.revisionPercent}%`, s: STYLES.revision }],
      [{ v: "🔴 Revisi Total (Konstruksi Soal / Daya Beda Rendah)", s: STYLES.cell }, { v: stats.totalRevisionCount, s: STYLES.totalRevision }, { v: `${stats.totalRevisionPercent}%`, s: STYLES.totalRevision }],
      [{ v: "⛔ Ditolak (Daya Beda Negatif / Kunci Salah)", s: STYLES.cell }, { v: stats.rejectedCount, s: STYLES.rejected }, { v: `${stats.rejectedPercent}%`, s: STYLES.rejected }]
    ];
    const wsRecap = XLSX.utils.aoa_to_sheet(recapRows);
    wsRecap["!cols"] = [{ wch: 45 }, { wch: 22 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, wsRecap, "Rekapitulasi");

    // Simpan file Excel
    const safeTitle = (examMeta.title || "Ujian").replace(/[^a-zA-Z0-9_-]/g, "_");
    XLSX.writeFile(wb, `Analisis_Butir_Soal_${safeTitle}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Jika belum memilih ruangan, tampilkan ExamRoomPicker terlebih dahulu
  if (!selectedRoomId && !currentRoomId) {
    return (
      <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
        <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <ExamRoomPicker
            title="Analisis Butir Soal &amp; Psikometri"
            subtitle="Pilih sesi ruang ujian yang ingin dianalisis untuk memuat kalkulasi daya pembeda (D Kelley 27%), tingkat kesukaran (P), efektivitas opsi pengecoh, dan rekomendasi AI."
            badgeText="Analisis Soal"
            actionText="Buka Analisis Soal"
            icon={Sparkles}
            onSelectRoom={(r) => {
              handleRoomChange(r.id, r.examId);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      {/* PRINT STYLESHEET OVERRIDE */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 14mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* 0. DOKUMEN RESMI KOP SURAT & SUMMARY SAAT DICETAK (Print Only) */}
      <div hidden className="hidden print:block mb-6 pb-4 border-b-2 border-slate-900 text-black">
        {/* Kop Surat Sekolah */}
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-300">
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-slate-900">
              {school?.name || "SEKOLAH INDEPENDEN"}
            </h2>
            <p className="text-xs text-slate-600">
              Sistem Penjaminan Mutu &amp; Analisis Psikometri Classical Test Theory (CTT)
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Dicetak: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
            <div>EXAMKU • Platform CBT Terstandar</div>
          </div>
        </div>

        {/* Judul Laporan */}
        <div className="text-center my-4">
          <h1 className="text-lg font-black uppercase tracking-tight text-slate-900">
            LAPORAN ANALISIS BUTIR SOAL &amp; DAYA PEMBEDA (CTT)
          </h1>
          <p className="text-xs font-semibold text-slate-600">
            Standar Psikometri: Classical Test Theory, Kelley's 27% Rule, &amp; Robert L. Ebel
          </p>
        </div>

        {/* Tabel Identitas Ujian */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div><strong>Mata Pelajaran:</strong> {examMeta.subjectName}</div>
          <div><strong>Nama Ujian:</strong> {examMeta.title}</div>
          <div><strong>Guru Pengampu:</strong> {examMeta.teacherName}</div>
          <div><strong>Ruang Ujian:</strong> {examMeta.roomName}</div>
          <div><strong>Total Peserta Ujian (N):</strong> {examMeta.totalParticipants} Siswa</div>
          <div><strong>Kelompok Ekstrem (27% Kelley):</strong> {examMeta.upperCount} Siswa (Kel. Atas / Kel. Bawah)</div>
        </div>

        {/* Statistik Ringkas Cetak: Layer 1 CTT & Keputusan */}
        <div className="grid grid-cols-4 gap-2 mt-3 text-center text-xs">
          <div className="p-2 border border-slate-300 rounded bg-white">
            <div className="text-xs text-slate-500 uppercase font-bold">Rata-rata Kesukaran (P)</div>
            <div className="text-sm font-black text-slate-900">{stats.avgP.toFixed(2)} ({getDifficultyCategory(stats.avgP)})</div>
          </div>
          <div className="p-2 border border-slate-300 rounded bg-white">
            <div className="text-xs text-slate-500 uppercase font-bold">Rata-rata Daya Beda (D)</div>
            <div className="text-sm font-black text-slate-900">{stats.avgD >= 0 ? `+${stats.avgD.toFixed(2)}` : stats.avgD.toFixed(2)} ({getDiscriminationCategory(stats.avgD)})</div>
          </div>
          <div className="p-2 border border-slate-300 rounded bg-white">
            <div className="text-xs text-slate-500 uppercase font-bold">Rata-rata Point-Biserial (r_pb)</div>
            <div className="text-sm font-black text-slate-900">{stats.avgRpb >= 0 ? `+${stats.avgRpb.toFixed(2)}` : stats.avgRpb.toFixed(2)} ({getPointBiserialCategory(stats.avgRpb)})</div>
          </div>
          <div className="p-2 border border-slate-300 rounded bg-white">
            <div className="text-xs text-slate-500 uppercase font-bold">Efektivitas Pengecoh (DE)</div>
            <div className="text-sm font-black text-slate-900">{stats.avgDE}% Rata-rata</div>
          </div>
        </div>

        {/* Keputusan Kelayakan Cetak */}
        <div className="grid grid-cols-5 gap-1.5 mt-2 text-center text-xs">
          <div className="p-1.5 border border-emerald-300 rounded bg-emerald-50 text-emerald-900">
            <div className="text-xs uppercase font-bold">Diterima</div>
            <div className="font-black">{stats.acceptedCount} ({stats.acceptedPercent}%)</div>
          </div>
          <div className="p-1.5 border border-yellow-300 rounded bg-yellow-50 text-yellow-900">
            <div className="text-xs uppercase font-bold">Revisi Kecil</div>
            <div className="font-black">{stats.minorRevisionCount} ({stats.minorRevisionPercent}%)</div>
          </div>
          <div className="p-1.5 border border-amber-300 rounded bg-amber-50 text-amber-900">
            <div className="text-xs uppercase font-bold">Revisi</div>
            <div className="font-black">{stats.revisionCount} ({stats.revisionPercent}%)</div>
          </div>
          <div className="p-1.5 border border-orange-300 rounded bg-orange-50 text-orange-900">
            <div className="text-xs uppercase font-bold">Revisi Total</div>
            <div className="font-black">{stats.totalRevisionCount} ({stats.totalRevisionPercent}%)</div>
          </div>
          <div className="p-1.5 border border-rose-300 rounded bg-rose-50 text-rose-900">
            <div className="text-xs uppercase font-bold">Ditolak</div>
            <div className="font-black">{stats.rejectedCount} ({stats.rejectedPercent}%)</div>
          </div>
        </div>
      </div>

      <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans pb-16 print:pb-0">
        <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 print:p-0 print:max-w-none print:space-y-4">
        {/* 1. TOP HEADER BAR */}
        <NeonPageHeader
          bordered
          onBack={() => {
            setSelectedRoomId("");
            setSearchParams({});
          }}
          backTitle="Pilih Ruang Lain"
          title="Analisis Butir Soal & Daya Pembeda"
          badge={
            <NeonBadge variant="sky">
              Psikometri CTT
            </NeonBadge>
          }
          breadcrumbs={
            <>
              <button
                type="button"
                onClick={() => {
                  setSelectedRoomId("");
                  setSearchParams({});
                }}
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shrink-0 cursor-pointer font-medium"
              >
                Pilih Ruang
              </button>
              <span>/</span>
              <span className="font-medium text-neutral-700 dark:text-neutral-300 shrink-0">
                {examMeta.subjectName || "Mata Pelajaran"}
              </span>
              <span>•</span>
              <span className="truncate max-w-[280px] sm:max-w-[400px]">
                {examMeta.title || "Paket Ujian"}
              </span>
            </>
          }
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setSelectedRoomId("");
                  setSearchParams({});
                }}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer"
                title="Pilih sesi ruang ujian lain"
              >
                <GitBranch className="h-3.5 w-3.5 text-neutral-400" />
                <span>Ganti Ruang</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGuideModal(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer"
                title="Lihat kriteria dan rumus psikometri Ebel & Arikunto"
              >
                <HelpCircle className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                <span>Panduan Rumus</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={loading || analyzedQuestions.length === 0}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                title="Unduh Rekap Lengkap ke format Excel (3 Sheet + Opsi A-E)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Export Excel</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={loading || analyzedQuestions.length === 0}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                title="Cetak format resmi A4"
              >
                <Printer className="h-3.5 w-3.5 text-neutral-400" />
                <span>Cetak</span>
              </button>

              <button
                type="button"
                onClick={loadAnalysisData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-mono rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                title="Kalkulasi ulang data psikometri"
              >
                <RefreshCw className={cn("h-3 w-3 text-neutral-400", loading && "animate-spin text-emerald-500")} />
                <span className="font-sans font-medium text-neutral-500">Refresh</span>
              </button>
            </>
          }
        />

        {/* 2. RUANG UJIAN SELECTOR & EXAM METADATA (Screen Only) */}
        <NeonCard className="print:hidden">
          <div className="p-4 sm:p-5 space-y-3.5">
            {/* Top: Ruang Ujian Selector with Clean Label */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-100 block">
                    Pilih Ruang Ujian yang Dianalisis
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Sesi ujian aktif untuk memuat data analisis psikometri
                  </span>
                </div>
              </div>

              <div className="w-full md:w-[420px] lg:w-[480px]">
                <select
                  value={selectedRoomId}
                  onChange={(e) => handleRoomChange(e.target.value)}
                  disabled={loadingRooms}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium text-neutral-900 dark:text-neutral-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all cursor-pointer shadow-2xs"
                >
                  {roomList.length === 0 ? (
                    <option value="">Belum ada ruang ujian</option>
                  ) : (
                    roomList.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name} • {room.examTitle} ({room.subjectName})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Bottom: Clean Integrated Metadata Badges */}
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 min-w-0">
                {/* Meta 1: Ujian / Paket */}
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-neutral-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Ujian / Paket
                    </span>
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block truncate max-w-[240px] sm:max-w-xs md:max-w-sm" title={examMeta.title}>
                      {examMeta.title || "-"}
                    </span>
                  </div>
                </div>

                <div className="hidden sm:block h-6 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />

                {/* Meta 2: Mata Pelajaran & Guru */}
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="h-4 w-4 text-neutral-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Mata Pelajaran & Guru
                    </span>
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate block max-w-[200px] sm:max-w-xs">
                      {examMeta.subjectName || "-"}
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 ml-1.5 font-normal">
                        ({examMeta.teacherName || "-"})
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Meta 3: Sampel Peserta */}
              <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900/60 px-3 py-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 w-full sm:w-auto shrink-0 justify-between sm:justify-start">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                    Sampel Peserta (Kelley 27%)
                  </span>
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {examMeta.totalParticipants} Siswa
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 ml-1.5 font-normal">
                      (Atas/Bawah: {examMeta.upperCount} Siswa)
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </NeonCard>

        {/* 3. EXECUTIVE SUMMARY / PSYCHOMETRIC OVERVIEW (Screen Only) */}
        <NeonStatGrid cols={4} className="print:hidden">
          {/* P: Kesukaran */}
          <NeonStatCard
            label="Kesukaran (P)"
            actionSlot={<MetricInfoTooltip type="difficulty" side="bottom" />}
            value={
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold text-neutral-900 dark:text-neutral-100">
                  {stats.avgP.toFixed(2)}
                </span>
                <NeonBadge
                  variant={
                    stats.avgP >= 0.30 && stats.avgP <= 0.70
                      ? "emerald"
                      : stats.avgP > 0.70
                      ? "sky"
                      : "amber"
                  }
                >
                  {getDifficultyCategory(stats.avgP)}
                </NeonBadge>
              </div>
            }
            subText={
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {stats.pDist.mudah} Mudah · {stats.pDist.sedang} Sedang · {stats.pDist.sukar} Sukar
              </span>
            }
          />

          {/* D: Daya Pembeda */}
          <NeonStatCard
            label="Daya Pembeda (D)"
            actionSlot={<MetricInfoTooltip type="discrimination" side="bottom" />}
            value={
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-2xl font-mono font-bold",
                    stats.avgD >= 0.40
                      ? "text-emerald-600 dark:text-emerald-400"
                      : stats.avgD >= 0.30
                      ? "text-sky-600 dark:text-sky-400"
                      : stats.avgD >= 0.20
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {stats.avgD >= 0 ? `+${stats.avgD.toFixed(2)}` : stats.avgD.toFixed(2)}
                </span>
                <NeonBadge
                  variant={
                    stats.avgD >= 0.40
                      ? "emerald"
                      : stats.avgD >= 0.30
                      ? "sky"
                      : stats.avgD >= 0.20
                      ? "amber"
                      : "rose"
                  }
                >
                  {getDiscriminationCategory(stats.avgD)}
                </NeonBadge>
              </div>
            }
            subText={
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Kelley 27% ({examMeta.upperCount} Atas / {examMeta.lowerCount} Bawah)
              </span>
            }
          />

          {/* r_pb: Point-Biserial */}
          <NeonStatCard
            label="Point-Biserial (r_pb)"
            actionSlot={<MetricInfoTooltip type="point_biserial" side="bottom" />}
            value={
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold text-neutral-900 dark:text-neutral-100">
                  {stats.avgRpb >= 0 ? `+${stats.avgRpb.toFixed(2)}` : stats.avgRpb.toFixed(2)}
                </span>
                <NeonBadge
                  variant={
                    stats.avgRpb >= 0.30
                      ? "emerald"
                      : stats.avgRpb >= 0.20
                      ? "sky"
                      : stats.avgRpb >= 0
                      ? "amber"
                      : "rose"
                  }
                >
                  {getPointBiserialCategory(stats.avgRpb)}
                </NeonBadge>
              </div>
            }
            subText={
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Item-Total Pearson Correlation
              </span>
            }
          />

          {/* Efektivitas Pengecoh */}
          <NeonStatCard
            label="Efektivitas Pengecoh"
            actionSlot={<MetricInfoTooltip type="distractor" side="bottom" />}
            value={
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold text-neutral-900 dark:text-neutral-100">
                  {stats.avgDE}%
                </span>
                <NeonBadge variant="neutral">Rata-rata</NeonBadge>
              </div>
            }
            subText={
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Syarat: Fo ≥ 5% & nBB &gt; nBA
              </span>
            }
          />
        </NeonStatGrid>

        {/* 4. STATUS CTT SIGNATURE TABS */}
        <div className="pt-1 print:hidden">
          <NeonTabs
            activeTab={verdictFilter}
            onChange={(id) => setVerdictFilter(id as any)}
            tabs={[
              { id: "all", label: "Semua", count: analyzedQuestions.length },
              { id: "Diterima", label: "Diterima", count: stats.acceptedCount, indicator: stats.acceptedCount > 0 },
              { id: "Revisi Kecil", label: "Revisi Kecil", count: stats.minorRevisionCount },
              { id: "Revisi", label: "Revisi", count: stats.revisionCount },
              { id: "Revisi Total", label: "Revisi Total", count: stats.totalRevisionCount },
              { id: "Ditolak", label: "Ditolak", count: stats.rejectedCount },
            ]}
            rightSlot={
              stats.keyAlertCount > 0 ? (
                <NeonBadge variant="rose" pulse>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {stats.keyAlertCount} Perlu Cek Kunci
                </NeonBadge>
              ) : null
            }
          />
        </div>

        {/* 5. FILTER & SEARCH TOOLBAR (Screen Only) */}
        <NeonCard className="print:hidden">
          <div className="p-3.5 sm:p-4 space-y-3">
            {/* Row 1: Search Bar & Global Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Search Input */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nomor butir, teks stimulus, atau kata kunci pertanyaan..."
                  className="pl-9 pr-8 h-9 w-full rounded-md bg-neutral-50/50 dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800 text-xs placeholder:text-neutral-400 focus-visible:ring-emerald-500/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs font-bold p-1 cursor-pointer"
                    title="Hapus pencarian"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Action Buttons: Reset & Expand/Collapse */}
              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-md transition-colors cursor-pointer"
                    title="Reset semua filter"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset ({activeFiltersCount})</span>
                  </button>
                )}

                <div className="inline-flex items-center rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => toggleExpandAll(true)}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Buka semua butir soal"
                  >
                    <ChevronDown className="h-3 w-3" />
                    <span>Buka</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleExpandAll(false)}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Tutup semua butir soal"
                  >
                    <ChevronUp className="h-3 w-3" />
                    <span>Tutup</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: 5 Structured Filter Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 pt-2.5 border-t border-neutral-100 dark:border-neutral-800">
              {/* 1. Keputusan CTT */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block px-0.5">
                  Keputusan CTT
                </label>
                <select
                  value={verdictFilter}
                  onChange={(e) => setVerdictFilter(e.target.value)}
                  className="h-8.5 w-full px-2.5 rounded-md border text-xs font-medium transition-all focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 cursor-pointer bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300"
                >
                  <option value="all">Semua Keputusan</option>
                  <option value="Diterima">Diterima ({stats.acceptedCount})</option>
                  <option value="Revisi Kecil">Revisi Kecil ({stats.minorRevisionCount})</option>
                  <option value="Revisi">Revisi ({stats.revisionCount})</option>
                  <option value="Revisi Total">Revisi Total ({stats.totalRevisionCount})</option>
                  <option value="Ditolak">Ditolak ({stats.rejectedCount})</option>
                </select>
              </div>

              {/* 2. Tipe Soal */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block px-0.5">
                  Tipe Soal
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-8.5 w-full px-2.5 rounded-md border text-xs font-medium transition-all focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 cursor-pointer bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300"
                >
                  <option value="all">Semua Tipe Soal</option>
                  <option value="pilihan_ganda">Pilihan Ganda</option>
                  <option value="pilihan_ganda_kompleks">Pilihan Ganda Kompleks</option>
                  <option value="benar_salah">Benar / Salah</option>
                  <option value="menjodohkan">Menjodohkan</option>
                  <option value="isian_singkat">Isian Singkat</option>
                  <option value="uraian">Uraian</option>
                  <option value="urutkan">Urutkan</option>
                  <option value="drag_drop">Drag &amp; Drop</option>
                  <option value="klasifikasi">Klasifikasi</option>
                  <option value="matriks">Matriks</option>
                  <option value="isian_rumpang">Isian Rumpang</option>
                  <option value="hotspot">Hotspot</option>
                </select>
              </div>

              {/* 3. Tingkat Kesukaran (P) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block px-0.5">
                  Kesukaran (P)
                </label>
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="h-8.5 w-full px-2.5 rounded-md border text-xs font-medium transition-all focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 cursor-pointer bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300"
                >
                  <option value="all">Semua Kesukaran (P)</option>
                  <option value="mudah">Mudah (P &gt; 0.70)</option>
                  <option value="sedang">Sedang (0.30 - 0.70)</option>
                  <option value="sukar">Sukar (P &lt; 0.30)</option>
                </select>
              </div>

              {/* 4. Daya Pembeda (D) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block px-0.5">
                  Daya Pembeda (D)
                </label>
                <select
                  value={discriminationFilter}
                  onChange={(e) => setDiscriminationFilter(e.target.value)}
                  className="h-8.5 w-full px-2.5 rounded-md border text-xs font-medium transition-all focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 cursor-pointer bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300"
                >
                  <option value="all">Semua Daya Beda (D)</option>
                  <option value="sangat_baik">Sangat Baik (D ≥ 0.40)</option>
                  <option value="baik">Baik (0.30 ≤ D &lt; 0.40)</option>
                  <option value="cukup">Cukup (0.20 ≤ D &lt; 0.30)</option>
                  <option value="rendah">Rendah (0.00 ≤ D &lt; 0.20)</option>
                  <option value="negatif">Negatif (D &lt; 0.00)</option>
                </select>
              </div>

              {/* 5. Point-Biserial (r_pb) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block px-0.5">
                  Point-Biserial (r_pb)
                </label>
                <select
                  value={rpbFilter}
                  onChange={(e) => setRpbFilter(e.target.value)}
                  className="h-8.5 w-full px-2.5 rounded-md border text-xs font-medium transition-all focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 cursor-pointer bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300"
                >
                  <option value="all">Semua Point-Biserial</option>
                  <option value="sangat_baik">Sangat Baik (r_pb ≥ 0.40)</option>
                  <option value="baik">Baik (0.30 ≤ r_pb &lt; 0.40)</option>
                  <option value="cukup">Cukup (0.20 ≤ r_pb &lt; 0.30)</option>
                  <option value="rendah">Rendah (0.00 ≤ r_pb &lt; 0.20)</option>
                  <option value="negatif">Negatif (r_pb &lt; 0.00)</option>
                </select>
              </div>
            </div>
          </div>
        </NeonCard>

        {/* 6. QUESTION ANALYSIS LIST (3-LAYER CTT ARCHITECTURE) */}
        <div className="space-y-3.5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <NeonCard key={i} className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32 rounded-md" />
                    <Skeleton className="h-5 w-24 rounded-md" />
                  </div>
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-16 w-full rounded-md" />
                </NeonCard>
              ))}
            </div>
          ) : filteredQuestions.length === 0 ? (
            <NeonCard className="p-10 text-center print:hidden">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto mb-3">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                Tidak Ada Butir Soal yang Cocok
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-md mx-auto">
                {analyzedQuestions.length === 0
                  ? "Belum ada data butir soal atau jawaban siswa pada ruang ujian yang dipilih. Pastikan siswa telah mengerjakan ujian."
                  : "Tidak ditemukan butir soal yang sesuai dengan kata kunci atau kriteria filter yang Anda terapkan."}
              </p>
              {analyzedQuestions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setTypeFilter("all");
                    setVerdictFilter("all");
                    setDifficultyFilter("all");
                    setDiscriminationFilter("all");
                    setRpbFilter("all");
                  }}
                  className="mt-3 text-xs font-semibold cursor-pointer"
                >
                  Reset Semua Filter
                </Button>
              )}
            </NeonCard>
          ) : (
          filteredQuestions.map((q) => {
          const isExpanded = !!expandedQuestionIds[q.id];
          const verdictInfo = q.verdictDetail;

          const getNeonVerdictVariant = (verdict: string): "emerald" | "amber" | "warning" | "rose" | "neutral" => {
            switch (verdict) {
              case "Diterima":
                return "emerald";
              case "Revisi Kecil":
                return "amber";
              case "Revisi":
                return "amber";
              case "Revisi Total":
                return "warning";
              case "Ditolak":
                return "rose";
              default:
                return "neutral";
            }
          };

          return (
            <NeonCard
              key={q.id}
              className={cn(
                "print-card transition-all duration-150 overflow-hidden",
                "print:border-neutral-300 print:shadow-none print:mb-4 print:bg-white",
                verdictInfo.keyAlert
                  ? "border-rose-300/80 dark:border-rose-800/70"
                  : "hover:border-neutral-300 dark:hover:border-neutral-700"
              )}
            >
              {/* Header Butir Soal */}
              <div
                onClick={() => toggleExpand(q.id)}
                className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none bg-white dark:bg-[#0f1115] hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40 transition-colors print:bg-white print:p-2"
              >
                <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center font-mono font-bold text-xs text-neutral-800 dark:text-neutral-200 shrink-0">
                    #{q.index}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        {q.type.replace(/_/g, " ")}
                      </span>
                      {q.groupId && (
                        <NeonBadge variant="purple" size="xs">
                          Literasi
                        </NeonBadge>
                      )}
                      {q.type === "benar_salah" && q.statements && q.statements.length > 0 ? (
                        <NeonBadge variant="neutral" mono size="xs">
                          Kunci: {q.statements.map((s, idx) => `${idx + 1}:${(s.answer || "benar").toUpperCase().charAt(0)}`).join(" ")}
                        </NeonBadge>
                      ) : q.type === "pilihan_ganda_kompleks" && q.choices ? (
                        <NeonBadge variant="neutral" mono size="xs">
                          Kunci: {Object.keys(q.choices).filter(k => q.choices![k]?.isCorrect).map(k => k.toUpperCase()).sort().join(", ") || q.answerKey || "-"}
                        </NeonBadge>
                      ) : q.answerKey ? (
                        <NeonBadge variant="neutral" mono size="xs">
                          Kunci: {q.answerKey}
                        </NeonBadge>
                      ) : null}

                      {verdictInfo.keyAlert && (
                        <NeonBadge variant="rose" pulse size="xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Cek Kunci
                        </NeonBadge>
                      )}
                    </div>

                    {!isExpanded && (
                      <div className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-1 max-w-2xl font-normal mt-1 print:hidden">
                        <MathText content={q.text || "Tanpa teks pertanyaan"} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrik Mini di Header */}
                <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 shrink-0 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-neutral-100 dark:border-neutral-800/80">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="text-left md:text-right text-xs">
                      <span className="text-[10px] text-neutral-400 font-medium uppercase block">P (Sukar)</span>
                      <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                        {q.difficultyIndex.toFixed(2)}{" "}
                        <span className={cn(
                          "text-[10px] font-sans font-semibold",
                          q.difficultyCategory === "Sedang" ? "text-emerald-600 dark:text-emerald-400" : (q.difficultyCategory === "Mudah" ? "text-sky-600 dark:text-sky-400" : "text-amber-600 dark:text-amber-400")
                        )}>
                          {q.difficultyCategory}
                        </span>
                      </span>
                    </div>

                    <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800" />

                    <div className="text-left md:text-right text-xs">
                      <span className="text-[10px] text-neutral-400 font-medium uppercase block">D (Beda)</span>
                      <span className={cn(
                        "font-mono font-bold",
                        q.discriminationIndex >= 0.40 ? "text-emerald-600 dark:text-emerald-400" : (q.discriminationIndex >= 0.30 ? "text-sky-600 dark:text-sky-400" : (q.discriminationIndex >= 0.20 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"))
                      )}>
                        {q.discriminationIndex >= 0 ? `+${q.discriminationIndex.toFixed(2)}` : q.discriminationIndex.toFixed(2)}
                      </span>
                    </div>

                    <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />

                    <div className="text-left md:text-right text-xs hidden sm:block">
                      <span className="text-[10px] text-neutral-400 font-medium uppercase block">r_pb</span>
                      <span className="font-mono font-bold text-neutral-700 dark:text-neutral-300">
                        {q.pointBiserial >= 0 ? `+${q.pointBiserial.toFixed(2)}` : q.pointBiserial.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Verdict badge */}
                    <NeonBadge variant={getNeonVerdictVariant(verdictInfo.verdict)} size="sm">
                      {verdictInfo.badgeLabel}
                    </NeonBadge>

                    <div className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 print:hidden shrink-0">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Konten Rinci Butir Soal */}
              <div className={cn("p-3.5 sm:p-5 border-t border-neutral-100 dark:border-neutral-800 space-y-3.5 sm:space-y-4 print:p-3 print:space-y-3 bg-white dark:bg-[#0f1115]", !isExpanded && "hidden print:block")}>
                {/* 1. Teks Stimulus & Soal */}
                <div className="space-y-3">
                  {q.groupText && (
                    <div className="p-3.5 bg-neutral-50/70 dark:bg-neutral-900/40 border border-neutral-200/80 dark:border-neutral-800 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed print:bg-slate-50 print:border-slate-300">
                      <span className="font-bold block text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                        Materi Stimulus / Teks Wacana
                      </span>
                      <MathText content={q.groupText} />
                    </div>
                  )}

                  <div className="text-sm text-neutral-800 dark:text-neutral-200 font-medium leading-relaxed">
                    <MathText content={q.text} />
                  </div>

                  {/* Teks Opsi Jawaban (Print Only View) */}
                  {q.choices && (
                    <div className="hidden print:grid grid-cols-2 gap-1.5 text-[11px] pt-2">
                      {Object.entries(q.choices).map(([key, ch]) => {
                        const isCorr = ch.isCorrect || (q.answerKey && q.answerKey.toUpperCase().includes(key.toUpperCase()));
                        return (
                          <div key={key} className={cn("p-2 rounded border text-left flex items-start gap-1.5", isCorr ? "border-slate-900 font-bold bg-slate-100" : "border-slate-200")}>
                            <span className="font-bold shrink-0">{key.toUpperCase()}.</span>
                            <div className="flex-1">
                              <MathText content={ch.text} />
                            </div>
                            {isCorr && <span className="ml-1 text-xs uppercase font-bold text-emerald-700 shrink-0">[Kunci]</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Teks Pernyataan Benar/Salah (Tampil Penuh di Layar & Cetak) */}
                  {q.type === "benar_salah" && q.statements && q.statements.length > 0 && (
                    <div className="mt-3 p-3.5 sm:p-4 bg-neutral-50/70 dark:bg-neutral-900/40 rounded-lg border border-neutral-200/80 dark:border-neutral-800 space-y-2.5 print:bg-white print:border-slate-300 print:p-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-200/80 dark:border-neutral-800">
                        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          Daftar Pernyataan &amp; Kunci Jawaban
                        </span>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {q.statements.length} Pernyataan
                        </span>
                      </div>
                      <div className="space-y-2 pt-0.5">
                        {q.statements.map((st, sIdx) => {
                          const isBenar = (st.answer || "benar").toLowerCase() === "benar";
                          return (
                            <div
                              key={st.id || sIdx}
                              className="p-2.5 sm:p-3 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-2.5 sm:gap-3 shadow-2xs print:border-slate-300 print:p-2"
                            >
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 shrink-0">
                                #{sIdx + 1}
                              </span>
                              <div className="flex-1 text-xs text-neutral-800 dark:text-neutral-200 font-medium leading-relaxed">
                                <MathText content={st.text} />
                              </div>
                              <NeonBadge variant={isBenar ? "emerald" : "rose"} size="xs">
                                {isBenar ? "BENAR" : "SALAH"}
                              </NeonBadge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {q.imageUrl && (
                    <div className="max-w-md pt-2">
                      <SmartImage src={q.imageUrl} alt={`Gambar Soal ${q.index}`} className="rounded-lg border border-neutral-200 dark:border-neutral-800 max-h-64 object-contain" />
                    </div>
                  )}
                </div>

                {/* 2. RINGKASAN METRIK PSIKOMETRI BUTIR (CTT) */}
                <div className="bg-neutral-50/70 dark:bg-neutral-900/40 rounded-lg p-3 sm:p-3.5 border border-neutral-200/60 dark:border-neutral-800 grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
                  {/* P */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Kesukaran (P)</span>
                      <MetricInfoTooltip type="difficulty" side="bottom" />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-mono font-bold text-neutral-900 dark:text-white">
                        {q.difficultyIndex.toFixed(2)}
                      </span>
                      <span className={cn(
                        "text-[11px] font-semibold",
                        q.difficultyCategory === "Sedang" ? "text-emerald-600 dark:text-emerald-400" : (q.difficultyCategory === "Mudah" ? "text-sky-600 dark:text-sky-400" : "text-amber-600 dark:text-amber-400")
                      )}>
                        {q.difficultyCategory}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      B/N: {q.totalCorrect}/{q.totalAnswered} Siswa ({Math.round(q.difficultyIndex * 100)}%)
                    </p>
                  </div>

                  {/* D */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Daya Beda (D)</span>
                      <MetricInfoTooltip type="discrimination" side="bottom" />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn(
                        "text-sm font-mono font-bold",
                        q.discriminationIndex >= 0.40 ? "text-emerald-600 dark:text-emerald-400" : (q.discriminationIndex >= 0.30 ? "text-sky-600 dark:text-sky-400" : (q.discriminationIndex >= 0.20 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"))
                      )}>
                        {q.discriminationIndex >= 0 ? `+${q.discriminationIndex.toFixed(2)}` : q.discriminationIndex.toFixed(2)}
                      </span>
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                        {q.discriminationCategory}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate" title={`Ba: ${q.upperGroupCorrect}/${examMeta.upperCount} vs Bb: ${q.lowerGroupCorrect}/${examMeta.lowerCount}`}>
                      Ba: {q.upperGroupCorrect} vs Bb: {q.lowerGroupCorrect} (Δ {q.upperGroupCorrect - q.lowerGroupCorrect})
                    </p>
                  </div>

                  {/* r_pb */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Point-Biserial</span>
                      <MetricInfoTooltip type="point_biserial" side="bottom" />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-mono font-bold text-neutral-900 dark:text-white">
                        {q.pointBiserial >= 0 ? `+${q.pointBiserial.toFixed(2)}` : q.pointBiserial.toFixed(2)}
                      </span>
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                        {q.pointBiserialCategory}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                      Item-Total Pearson
                    </p>
                  </div>

                  {/* DE */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Efektivitas Pengecoh</span>
                      <MetricInfoTooltip type="distractor" side="bottom" />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-mono font-bold text-neutral-900 dark:text-white">
                        {q.distractorEfficiency}%
                      </span>
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                        {q.effectiveDistractorCount}/{q.totalDistractorCount} Efektif
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                      Fo ≥ 5% &amp; nBB &gt; nBA
                    </p>
                  </div>
                </div>

                {/* 3. EVALUASI PSIKOMETRI & TINDAK LANJUT GURU (Consolidated) */}
                <div className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      {verdictInfo.verdict === "Diterima" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : verdictInfo.verdict === "Ditolak" ? (
                        <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      )}

                      <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                        {verdictInfo.summaryTitle}
                      </h4>

                      {/* Anomaly flags tags */}
                      {q.flags && q.flags.length > 0 ? (
                        q.flags.map((flag, flIdx) => (
                          <NeonBadge
                            key={flIdx}
                            variant={flag.includes("NEGATIF") || flag.includes("KUNCI") ? "rose" : "amber"}
                            size="xs"
                          >
                            {flag}
                          </NeonBadge>
                        ))
                      ) : (
                        <NeonBadge variant="emerald" size="xs">
                          Parameter Normal
                        </NeonBadge>
                      )}
                    </div>

                    {/* Primary Action Button: Revisi Pilihan AI */}
                    {q.type !== "benar_salah" && q.choices && (
                      <button
                        type="button"
                        onClick={() => handleOpenAIRevision(q)}
                        className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 cursor-pointer shrink-0 shadow-2xs transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <span>Revisi Pilihan AI</span>
                      </button>
                    )}
                  </div>

                  {/* Body: Temuan & Tindak Lanjut */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Temuan Analisis */}
                    <div className="space-y-1.5 bg-neutral-50/70 dark:bg-neutral-900/40 p-3 rounded-md border border-neutral-100 dark:border-neutral-800/60">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                        Temuan Analisis Psikometri:
                      </span>
                      <ul className="space-y-1 text-neutral-600 dark:text-neutral-300">
                        {verdictInfo.findings.map((f, fIdx) => (
                          <li key={fIdx} className="flex items-start gap-1.5 leading-relaxed text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 mt-1.5 shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Rekomendasi Guru */}
                    <div className="space-y-1.5 bg-neutral-50/70 dark:bg-neutral-900/40 p-3 rounded-md border border-neutral-100 dark:border-neutral-800/60">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                        Rekomendasi Tindak Lanjut:
                      </span>
                      <p className="text-[11px] text-neutral-700 dark:text-neutral-200 leading-relaxed font-medium">
                        {verdictInfo.actionPlan}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. TABEL DISTRIBUSI PENGECOH (PILIHAN GANDA & KOMPLEKS) (Screen Only) */}
                {q.type !== "benar_salah" && q.distractors && q.distractors.length > 0 && (
                  <div className="space-y-2 pt-1 print:hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                        <span>
                          {q.type === "pilihan_ganda_kompleks"
                            ? "Distribusi Pilihan & Evaluasi Pengecoh (Kompleks)"
                            : "Distribusi Pemilih & Evaluasi Pengecoh"}
                        </span>
                      </span>
                      <span className="text-[11px] text-neutral-400 font-normal">
                        Kriteria Efektif: Pemilih ≥ 5% &amp; Kelompok Bawah &gt; Kelompok Atas
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800 -mx-1 sm:mx-0">
                      <table className="w-full text-xs text-left min-w-[620px]">
                        <thead className="bg-neutral-50/75 dark:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400 font-semibold uppercase text-[11px] border-b border-neutral-200 dark:border-neutral-800">
                          <tr>
                            <th className="py-2.5 px-3 w-12 text-center whitespace-nowrap">Opsi</th>
                            <th className="py-2.5 px-3 min-w-[160px]">Teks Pilihan Jawaban</th>
                            <th className="py-2.5 px-3 text-center whitespace-nowrap">Total Pemilih</th>
                            <th className="py-2.5 px-3 text-center whitespace-nowrap">Kel. Atas (Ba)</th>
                            <th className="py-2.5 px-3 text-center whitespace-nowrap">Kel. Bawah (Bb)</th>
                            <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                            <th className="py-2.5 px-3 min-w-[160px]">Catatan Evaluasi Pengecoh</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80 font-medium">
                          {q.distractors.map((dis) => {
                            let statusVariant: "emerald" | "rose" | "neutral" = "neutral";
                            let statusLabel = dis.status;
                            if (dis.isCorrect) {
                              statusVariant = "emerald";
                              statusLabel = "Kunci";
                            } else if (dis.status === "Menyesatkan") {
                              statusVariant = "rose";
                            } else if (dis.effective) {
                              statusVariant = "emerald";
                              statusLabel = "Efektif";
                            } else {
                              statusVariant = "neutral";
                              statusLabel = "Tidak Efektif";
                            }

                            return (
                              <tr key={dis.key} className={cn("hover:bg-neutral-50/60 dark:hover:bg-neutral-850/50", dis.isCorrect && "bg-emerald-50/20 dark:bg-emerald-950/10")}>
                                <td className="py-2 px-3 text-center font-mono font-bold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                                  {dis.key}
                                </td>
                                <td className="py-2 px-3 text-neutral-700 dark:text-neutral-300 min-w-[160px] max-w-xs">
                                  <MathText content={dis.text || "-"} />
                                </td>
                                <td className="py-2 px-3 text-center font-semibold whitespace-nowrap">
                                  {dis.totalCount} <span className="text-[11px] text-neutral-400 font-normal">({dis.totalPercent}%)</span>
                                  <div className="w-16 bg-neutral-100 dark:bg-neutral-800 h-1 rounded-full mx-auto mt-1 overflow-hidden">
                                    <div
                                      className={cn("h-full rounded-full", dis.isCorrect ? "bg-emerald-500" : (dis.status === "Menyesatkan" ? "bg-rose-500" : "bg-neutral-400"))}
                                      style={{ width: `${Math.min(100, dis.totalPercent)}%` }}
                                    />
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-center font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap font-mono">
                                  {dis.upperCount} <span className="text-[11px] text-neutral-400 font-normal">({dis.upperPercent}%)</span>
                                </td>
                                <td className="py-2 px-3 text-center font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap font-mono">
                                  {dis.lowerCount} <span className="text-[11px] text-neutral-400 font-normal">({dis.lowerPercent}%)</span>
                                </td>
                                <td className="py-2 px-3 text-center whitespace-nowrap">
                                  <NeonBadge variant={statusVariant} size="xs">
                                    {statusLabel}
                                  </NeonBadge>
                                </td>
                                <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400 text-[11px] leading-snug min-w-[160px]">
                                  {dis.note}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5. TABEL DISTRIBUSI & ANALISIS PERNYATAAN (BENAR / SALAH) (Screen Only) */}
                {q.type === "benar_salah" && (
                  <div className="space-y-2 pt-1 print:hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckSquare className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                        <span>Distribusi Respon &amp; Analisis Pernyataan (Benar / Salah)</span>
                      </span>
                      <span className="text-[11px] text-neutral-400 font-normal">
                        Kriteria Baik: Daya Beda D ≥ +0.20 &amp; Kesukaran (0.20 ≤ P ≤ 0.90)
                      </span>
                    </div>

                    {q.statementsAnalysis && q.statementsAnalysis.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800 -mx-1 sm:mx-0">
                        <table className="w-full text-xs text-left min-w-[720px]">
                          <thead className="bg-neutral-50/75 dark:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400 font-semibold uppercase text-[11px] border-b border-neutral-200 dark:border-neutral-800">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center whitespace-nowrap">No</th>
                              <th className="py-2.5 px-3 min-w-[180px]">Teks Pernyataan</th>
                              <th className="py-2.5 px-3 text-center whitespace-nowrap">Kunci</th>
                              <th className="py-2.5 px-3 text-center whitespace-nowrap">Respon (Benar / Salah)</th>
                              <th className="py-2.5 px-3 text-center whitespace-nowrap">Kel. Atas (Ba)</th>
                              <th className="py-2.5 px-3 text-center whitespace-nowrap">Kel. Bawah (Bb)</th>
                              <th className="py-2.5 px-3 text-center whitespace-nowrap">Kesukaran (P)</th>
                              <th className="py-2.5 px-3 text-center whitespace-nowrap">Daya Beda (D)</th>
                              <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                              <th className="py-2.5 px-3 min-w-[160px]">Catatan Evaluasi Pernyataan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80 font-medium">
                            {q.statementsAnalysis.map((st) => {
                              let stVariant: "emerald" | "amber" | "rose" | "neutral" = "neutral";
                              if (st.status === "Menyesatkan") stVariant = "rose";
                              else if (st.status === "Terlalu Mudah" || st.status === "Terlalu Sukar") stVariant = "amber";
                              else if (st.status === "Berfungsi Baik") stVariant = "emerald";

                              return (
                                <tr key={st.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-850/50">
                                  <td className="py-2 px-3 text-center font-mono font-bold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                                    {st.index}
                                  </td>
                                  <td className="py-2 px-3 text-neutral-700 dark:text-neutral-300 min-w-[180px] max-w-sm">
                                    <MathText content={st.text || "-"} />
                                  </td>
                                  <td className="py-2 px-3 text-center whitespace-nowrap">
                                    <NeonBadge variant={st.correctAnswer === "benar" ? "emerald" : "rose"} size="xs">
                                      {st.correctAnswer}
                                    </NeonBadge>
                                  </td>
                                  <td className="py-2 px-3 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1.5 font-semibold text-xs">
                                      <span className="text-emerald-700 dark:text-emerald-400">{st.totalBenar} B <span className="text-[10px] text-neutral-400 font-normal">({st.totalBenarPercent}%)</span></span>
                                      <span className="text-neutral-300 dark:text-neutral-700">/</span>
                                      <span className="text-rose-600 dark:text-rose-400">{st.totalSalah} S <span className="text-[10px] text-neutral-400 font-normal">({st.totalSalahPercent}%)</span></span>
                                    </div>
                                    <div className="w-20 bg-rose-100 dark:bg-rose-950/40 h-1 rounded-full mx-auto mt-1 overflow-hidden flex">
                                      <div
                                        className="bg-emerald-500 h-full"
                                        style={{ width: `${st.totalBenarPercent}%` }}
                                      />
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-center font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap font-mono">
                                    {st.upperBenar} <span className="text-[11px] text-neutral-400 font-normal">({st.upperBenarPercent}%)</span>
                                  </td>
                                  <td className="py-2 px-3 text-center font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap font-mono">
                                    {st.lowerBenar} <span className="text-[11px] text-neutral-400 font-normal">({st.lowerBenarPercent}%)</span>
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono font-bold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                                    {st.difficultyIndex.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono font-bold whitespace-nowrap">
                                    <span className={cn(
                                      st.discriminationIndex >= 0.30
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : st.discriminationIndex >= 0.20
                                        ? "text-sky-600 dark:text-sky-400"
                                        : st.discriminationIndex >= 0
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-rose-600 dark:text-rose-400"
                                    )}>
                                      {st.discriminationIndex >= 0 ? `+${st.discriminationIndex.toFixed(2)}` : st.discriminationIndex.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-center whitespace-nowrap">
                                    <NeonBadge variant={stVariant} size="xs">
                                      {st.status}
                                    </NeonBadge>
                                  </td>
                                  <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400 text-[11px] leading-snug min-w-[160px]">
                                    {st.note}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-900/40 rounded-lg border border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-500">
                        Data analisis respon siswa untuk setiap butir pernyataan akan tampil saat siswa mulai mengerjakan ujian.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </NeonCard>
          );
        })
      )}
    </div>

    {/* TANDA TANGAN PENGESAHAN LAPORAN (Print Only) */}
    <div className="hidden print:grid grid-cols-2 gap-8 mt-12 pt-6 text-xs text-center print-card text-black">
        <div>
          <p className="text-slate-600">Mengetahui,</p>
          <p className="font-bold text-slate-900 mt-0.5">Kepala Sekolah</p>
          <div className="h-20" />
          <p className="font-bold text-slate-900 underline underline-offset-4">( ................................................................ )</p>
          <p className="text-xs text-slate-500 mt-0.5">NIP. ................................................................</p>
        </div>
        <div>
          <p className="text-slate-600">
            {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p className="font-bold text-slate-900 mt-0.5">Guru Mata Pelajaran</p>
          <div className="h-20" />
          <p className="font-bold text-slate-900 underline underline-offset-4">
            ( {examMeta.teacherName !== "-" ? examMeta.teacherName : "................................................................"} )
          </p>
        </div>
      </div>
    </div>
  </div>

      {/* 7. MODAL PANDUAN & RUMUS PSIKOMETRI */}
      <Dialog open={showGuideModal} onOpenChange={setShowGuideModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl p-6 bg-white dark:bg-[#0f1115] border border-neutral-200 dark:border-neutral-800 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Panduan Evaluasi Butir Soal: Classical Test Theory (CTT 3 Lapisan)
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400">
              Arsitektur evaluasi psikometri terstandar: Statistik Butir Soal → Diagnosis Masalah → Decision Engine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-3 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
            {/* Bagian 1: Tingkat Kesukaran */}
            <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <h4 className="font-bold text-neutral-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xs font-mono font-bold">1</span>
                Tingkat Kesukaran (Facility Value / P)
              </h4>
              <p>
                Proporsi peserta tes yang menjawab benar. Nilai P semakin besar menandakan butir soal semakin mudah.
              </p>
              <div className="bg-white dark:bg-neutral-850 p-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-sky-700 dark:text-sky-300">
                P = B / N (B = Jumlah siswa menjawab benar, N = Total peserta tes)
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-neutral-600 dark:text-neutral-400">
                <li><strong>0.00 – 0.30:</strong> Sukar</li>
                <li><strong>0.31 – 0.70:</strong> Sedang (Proporsional / Ideal untuk Evaluasi)</li>
                <li><strong>0.71 – 1.00:</strong> Mudah</li>
              </ul>
            </div>

            {/* Bagian 2: Daya Pembeda & Aturan 27% Kelley */}
            <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <h4 className="font-bold text-neutral-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-mono font-bold">2</span>
                Daya Pembeda (D) &amp; Aturan 27% Kelley
              </h4>
              <p>
                Mengukur kemampuan butir soal membedakan siswa kelompok atas (pandai) dan kelompok bawah (kurang pandai). Siswa diurutkan berdasarkan skor total, lalu diambil 27% teratas dan 27% terbawah: <code>groupSize = floor(N × 0.27)</code>.
              </p>
              <div className="bg-white dark:bg-neutral-850 p-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
                D = PA - PB = (BA - BB) / groupSize
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-neutral-600 dark:text-neutral-400">
                <li><strong>D ≥ 0.40:</strong> Sangat Baik (Pedoman Robert L. Ebel)</li>
                <li><strong>0.30 ≤ D &lt; 0.40:</strong> Baik (Diterima tanpa revisi signifikan)</li>
                <li><strong>0.20 ≤ D &lt; 0.30:</strong> Cukup (Perlu revisi minor)</li>
                <li><strong>0.00 ≤ D &lt; 0.20:</strong> Rendah (Perlu revisi total)</li>
                <li><strong>D &lt; 0.00:</strong> Negatif (DITOLAK / Indikasi salah kunci jawaban)</li>
              </ul>
            </div>

            {/* Bagian 3: Point-Biserial Correlation (r_pb) */}
            <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <h4 className="font-bold text-neutral-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-mono font-bold">3</span>
                Point-Biserial Correlation (Corrected Item-Total r_pb)
              </h4>
              <p>
                Korelasi Pearson antara skor dikotomis butir soal (0 atau 1) dengan total skor siswa yang dikoreksi (skor butir dikurangkan dari skor total agar tidak terjadi inflasi korelasi artifisial).
              </p>
              <div className="bg-white dark:bg-neutral-850 p-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-purple-700 dark:text-purple-300">
                r_pb = Corr(Yi, X - Yi)
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-neutral-600 dark:text-neutral-400">
                <li><strong>r_pb ≥ 0.40:</strong> Sangat Baik (Konsistensi internal sangat tinggi)</li>
                <li><strong>0.30 ≤ r_pb &lt; 0.40:</strong> Baik</li>
                <li><strong>0.20 ≤ r_pb &lt; 0.30:</strong> Cukup</li>
                <li><strong>0.00 ≤ r_pb &lt; 0.20:</strong> Rendah</li>
                <li><strong>r_pb &lt; 0.00:</strong> Negatif (Diskriminasi terbalik)</li>
              </ul>
            </div>

            {/* Bagian 4: Analisis Pengecoh & Distractor Efficiency */}
            <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <h4 className="font-bold text-neutral-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-mono font-bold">4</span>
                Efektivitas Pengecoh &amp; Distractor Efficiency (DE%)
              </h4>
              <p>
                Setiap pilihan jawaban salah (pengecoh) dianalisis efektivitas fungsinya berdasarkan dua syarat:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-neutral-600 dark:text-neutral-400">
                <li><strong>Frekuensi Pemilih:</strong> Dipilih minimal 5% dari total peserta (<code>Fo ≥ 5%</code>). Pengecoh &lt;5% adalah <em>Pengecoh Pasif/Mati</em>.</li>
                <li><strong>Daya Tarik Kelompok:</strong> Lebih banyak menarik siswa Kelompok Bawah daripada Kelompok Atas (<code>nBB &gt; nBA</code>). Jika sebaliknya, pengecoh berstatus <em>Menyesatkan</em>.</li>
              </ul>
              <div className="bg-white dark:bg-neutral-850 p-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                DE = (Jumlah Pengecoh Efektif / Total Pengecoh) × 100%
              </div>
            </div>

            {/* Bagian 5: Decision Engine (5 Tingkat Keputusan) */}
            <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <h4 className="font-bold text-neutral-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-mono font-bold">5</span>
                Decision Engine (5 Tingkat Keputusan)
              </h4>
              <p>
                Sistem tidak menggabungkan rumus statistik mentah ke dalam label keputusan, melainkan menggunakan mesin inferensi 5 tingkat:
              </p>
              <div className="space-y-1.5 text-[11px]">
                <div className="p-2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  <strong>🟢 DITERIMA:</strong> D ≥ 0.40, kunci valid, konsistensi r_pb baik, dan tidak ada anomali substansi kritis.
                </div>
                <div className="p-2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  <strong>🟡 REVISI KECIL:</strong> 0.30 ≤ D &lt; 0.40 atau D ≥ 0.40 dengan 1 opsi pengecoh yang tidak berfungsi (cukup revisi opsi terkait).
                </div>
                <div className="p-2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  <strong>🟠 REVISI:</strong> 0.20 ≤ D &lt; 0.30 atau tingkat kesukaran ekstrem (P &lt; 0.30 atau P &gt; 0.70) namun D masih positif.
                </div>
                <div className="p-2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  <strong>🔴 REVISI TOTAL:</strong> 0.00 ≤ D &lt; 0.20 atau soal multitafsir / cacat konstruksi stimulus.
                </div>
                <div className="p-2 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                  <strong>⛔ DITOLAK:</strong> D &lt; 0.00 (kelompok bawah lebih banyak benar) atau terindikasi kuat salah kunci jawaban.
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button onClick={() => setShowGuideModal(false)} className="rounded-md font-semibold text-xs bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 cursor-pointer">
              Mengerti &amp; Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG REVISI PILIHAN JAWABAN DENGAN AI */}
      <AIQuestionRevisionDialog
        isOpen={isRevisionDialogOpen}
        onClose={() => {
          setIsRevisionDialogOpen(false);
          setRevisionTargetQuestion(null);
        }}
        question={revisionTargetQuestion}
        onSaveToQuestionBank={handleSaveRevisedChoices}
      />
    </TooltipProvider>
  );
};

export default ItemAnalysisPage;
