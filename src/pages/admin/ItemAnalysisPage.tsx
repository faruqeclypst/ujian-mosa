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
  SlidersHorizontal
} from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { MathText } from "../../components/ui/MathText";
import { SmartImage } from "../../components/ui/smart-image";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "../../components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
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
  side = "top",
}) => {
  const info = METRIC_INFO_DETAILS[type];
  if (!info) return null;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-0.5 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700/60 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
          aria-label={`Informasi ${info.title}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align="start"
        className="w-80 max-w-[90vw] p-3.5 bg-slate-900/95 dark:bg-slate-950 text-slate-100 text-xs rounded-xl shadow-2xl border border-slate-800 backdrop-blur-md z-50 animate-in fade-in-0 zoom-in-95"
      >
        <div className="space-y-2">
          {/* Header */}
          <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
            <span className="font-bold text-white text-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              {info.title}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {info.reference}
            </span>
          </div>

          {/* Formula Box */}
          <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/50">
            <div className="font-mono text-emerald-400 font-bold text-[11px]">
              {info.formula}
            </div>
            <div className="text-[10px] text-slate-300 mt-0.5">
              {info.formulaDesc}
            </div>
          </div>

          {/* Kategori / Klasifikasi */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Kriteria & Klasifikasi:
            </div>
            <div className="space-y-1">
              {info.ranges.map((r, rIdx) => (
                <div key={rIdx} className="flex items-center justify-between text-[10px] bg-slate-800/40 px-2 py-0.5 rounded">
                  <span className="font-medium text-slate-200">{r.label}</span>
                  <span className="font-mono text-slate-300">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Deskripsi Evaluasi */}
          <div className="text-[10px] text-slate-300 leading-relaxed pt-1 border-t border-slate-800">
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

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [discriminationFilter, setDiscriminationFilter] = useState<string>("all");
  const [rpbFilter, setRpbFilter] = useState<string>("all");
  const [showGuideModal, setShowGuideModal] = useState(false);

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
          // Jika belum ada roomId di query string, gunakan roomId pertama
          if (!currentRoomId && mapped.length > 0) {
            const first = mapped[0];
            setSelectedRoomId(first.id);
            setSearchParams({ roomId: first.id, examId: first.examId }, { replace: true });
          } else if (currentRoomId) {
            setSelectedRoomId(currentRoomId);
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
  }, [pb, subjects, teachers]);

  // Handle Switch Ruangan
  const handleRoomChange = (newRoomId: string) => {
    setSelectedRoomId(newRoomId);
    const found = roomList.find(r => r.id === newRoomId);
    if (found) {
      setSearchParams({ roomId: found.id, examId: found.examId });
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

      // 1. Fetch Room jika ada selectedRoomId
      if (selectedRoomId) {
        const roomRecord = await pb.collection("exam_rooms").getOne(selectedRoomId).catch(() => null);
        if (roomRecord) {
          targetExamId = roomRecord.examId || (roomRecord as any).examid || targetExamId;
          currentRoomName = roomRecord.room_name || currentRoomName;
        }
      }

      // 2. Fetch Exam Metadata
      let currentExamTitle = "Ujian";
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

        // Ekstraksi terstandar untuk pernyataan benar / salah
        const statementsArr = (mappedType === "benar_salah" || hasStatements)
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
        if (q.type === "benar_salah" && q.statements && q.statements.length > 0) {
          q.statements.forEach((st: any) => {
            stStats[st.id] = { totalBenar: 0, totalSalah: 0, upperBenar: 0, lowerBenar: 0 };
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
            } else if (q.type === "benar_salah" && res.statementAnswers && q.statements) {
              q.statements.forEach((st: any) => {
                const ans = res.statementAnswers![st.id];
                if (ans === "benar") stStats[st.id].totalBenar++;
                else if (ans === "salah") stStats[st.id].totalSalah++;
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
          } else if (q.type === "benar_salah" && res?.statementAnswers && q.statements) {
            q.statements.forEach((st: any) => {
              const ans = res.statementAnswers![st.id];
              const expected = (st.answer || "benar").toLowerCase().trim();
              if (ans === expected) stStats[st.id].upperBenar++;
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
          } else if (q.type === "benar_salah" && res?.statementAnswers && q.statements) {
            q.statements.forEach((st: any) => {
              const ans = res.statementAnswers![st.id];
              const expected = (st.answer || "benar").toLowerCase().trim();
              if (ans === expected) stStats[st.id].lowerBenar++;
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

        // Layer 1 Khusus: Analisis Pernyataan Benar / Salah
        let statementsList: StatementAnalysis[] | undefined = undefined;
        if (q.type === "benar_salah" && q.statements && q.statements.length > 0) {
          statementsList = q.statements.map((st: any, sIdx: number) => {
            const stats = stStats[st.id] || { totalBenar: 0, totalSalah: 0, upperBenar: 0, lowerBenar: 0 };
            const expectedAns = (st.answer || "benar").toLowerCase() as "benar" | "salah";
            const totalBenarPercent = N > 0 ? Math.round((stats.totalBenar / N) * 100) : 0;
            const totalSalahPercent = N > 0 ? Math.round((stats.totalSalah / N) * 100) : 0;

            const upperBenarPercent = upperGroup.length > 0 ? Math.round((stats.upperBenar / upperGroup.length) * 100) : 0;
            const lowerBenarPercent = lowerGroup.length > 0 ? Math.round((stats.lowerBenar / lowerGroup.length) * 100) : 0;

            const correctTotal = expectedAns === "benar" ? stats.totalBenar : stats.totalSalah;
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
              id: st.id,
              index: sIdx + 1,
              text: st.text || "",
              correctAnswer: expectedAns,
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

        const hasValidKey = q.type === "benar_salah"
          ? (q.statements && q.statements.length > 0 && q.statements.some((s: any) => Boolean(s.answer))) || Boolean(q.answerKey)
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
      [{ v: `Sekolah: ${school?.name || "SMA Negeri Modal Bangsa"} | Ruangan: ${examMeta.roomName}`, s: { font: { bold: true, sz: 10 } } }],
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
      [{ v: `Sekolah: ${school?.name || "SMA Negeri Modal Bangsa"}`, s: { font: { bold: true, sz: 11 } } }],
      [{ v: `Ujian: ${examMeta.title} | Mata Pelajaran: ${examMeta.subjectName} | Guru Pengampu: ${examMeta.teacherName}`, s: { font: { italic: true, sz: 10 } } }],
      [{ v: `Ruangan: ${examMeta.roomName} | Tanggal Ekspor: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, s: { font: { italic: true, sz: 9, color: { rgb: "64748B" } } } }],
      [],
      [{ v: "PARAMETER ANALISIS CTT", s: STYLES.header }, { v: "NILAI", s: STYLES.header }, { v: "KETERANGAN STANDAR", s: STYLES.header }],
      [{ v: "Total Peserta Ujian (N)", s: STYLES.cell }, { v: examMeta.totalParticipants, s: STYLES.cellCenter }, { v: "Siswa yang mengumpulkan ujian", s: STYLES.cell }],
      [{ v: "Ukuran Sampel Kelompok Ekstrem (n)", s: STYLES.cell }, { v: `${examMeta.upperCount} Siswa`, s: STYLES.cellCenter }, { v: "Proporsi 27% Atas dan 27% Bawah (Kelley's Rule)", s: STYLES.cell }],
      [{ v: "Total Butir Soal Teranalisis", s: STYLES.cell }, { v: `${analyzedQuestions.length} Butir`, s: STYLES.cellCenter }, { v: "Seluruh butir soal dalam paket ujian", s: STYLES.cell }],
      [{ v: "Rata-rata Tingkat Kesukaran (P)", s: STYLES.cell }, { v: stats.avgP, s: STYLES.cellCenter }, { v: `${getDifficultyCategory(stats.avgP)} (Distribusi: ${stats.pDist.mudah} Mudah, ${stats.pDist.sedang} Sedang, ${stats.pDist.sukar} Sukar)`, s: STYLES.cell }],
      [{ v: "Rata-rata Daya Pembeda (D)", s: STYLES.cell }, { v: stats.avgD >= 0 ? `+${stats.avgD}` : stats.avgD, s: STYLES.cellCenter }, { v: `${getDiscriminationCategory(stats.avgD)} (Pedoman Robert L. Ebel)`, s: STYLES.cell }],
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

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-6 pb-16 print:p-0 print:space-y-4">
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
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-slate-900 text-black">
        {/* Kop Surat Sekolah */}
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-300">
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-slate-900">
              {school?.name || "SMA NEGERI MODAL BANGSA"}
            </h2>
            <p className="text-xs text-slate-600">
              Sistem Penjaminan Mutu &amp; Analisis Psikometri Classical Test Theory (CTT)
            </p>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            <div>Dicetak: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
            <div>EXAM AA • Platform CBT Terstandar</div>
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
            <div className="text-[10px] text-slate-500 uppercase font-bold">Rata-rata Kesukaran (P)</div>
            <div className="text-sm font-black text-slate-900">{stats.avgP.toFixed(2)} ({getDifficultyCategory(stats.avgP)})</div>
          </div>
          <div className="p-2 border border-slate-300 rounded bg-white">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Rata-rata Daya Beda (D)</div>
            <div className="text-sm font-black text-slate-900">{stats.avgD >= 0 ? `+${stats.avgD.toFixed(2)}` : stats.avgD.toFixed(2)} ({getDiscriminationCategory(stats.avgD)})</div>
          </div>
          <div className="p-2 border border-slate-300 rounded bg-white">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Rata-rata Point-Biserial (r_pb)</div>
            <div className="text-sm font-black text-slate-900">{stats.avgRpb >= 0 ? `+${stats.avgRpb.toFixed(2)}` : stats.avgRpb.toFixed(2)} ({getPointBiserialCategory(stats.avgRpb)})</div>
          </div>
          <div className="p-2 border border-slate-300 rounded bg-white">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Efektivitas Pengecoh (DE)</div>
            <div className="text-sm font-black text-slate-900">{stats.avgDE}% Rata-rata</div>
          </div>
        </div>

        {/* Keputusan Kelayakan Cetak */}
        <div className="grid grid-cols-5 gap-1.5 mt-2 text-center text-xs">
          <div className="p-1.5 border border-emerald-300 rounded bg-emerald-50 text-emerald-900">
            <div className="text-[9px] uppercase font-bold">Diterima</div>
            <div className="font-black">{stats.acceptedCount} ({stats.acceptedPercent}%)</div>
          </div>
          <div className="p-1.5 border border-yellow-300 rounded bg-yellow-50 text-yellow-900">
            <div className="text-[9px] uppercase font-bold">Revisi Kecil</div>
            <div className="font-black">{stats.minorRevisionCount} ({stats.minorRevisionPercent}%)</div>
          </div>
          <div className="p-1.5 border border-amber-300 rounded bg-amber-50 text-amber-900">
            <div className="text-[9px] uppercase font-bold">Revisi</div>
            <div className="font-black">{stats.revisionCount} ({stats.revisionPercent}%)</div>
          </div>
          <div className="p-1.5 border border-orange-300 rounded bg-orange-50 text-orange-900">
            <div className="text-[9px] uppercase font-bold">Revisi Total</div>
            <div className="font-black">{stats.totalRevisionCount} ({stats.totalRevisionPercent}%)</div>
          </div>
          <div className="p-1.5 border border-rose-300 rounded bg-rose-50 text-rose-900">
            <div className="text-[9px] uppercase font-bold">Ditolak</div>
            <div className="font-black">{stats.rejectedCount} ({stats.rejectedPercent}%)</div>
          </div>
        </div>
      </div>

      {/* 1. TOP HEADER & BREADCRUMB (Screen Only) */}
      <div className="flex flex-col gap-4 print:hidden">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Link to="/admin" className="hover:text-blue-600 transition-colors">Dashboard</Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <Link to="/admin/ruang-ujian" className="hover:text-blue-600 transition-colors">Ruang Ujian</Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-900 dark:text-white font-bold">Analisis Butir Soal</span>
        </div>

        {/* Page Title & Responsive Main Actions */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 shadow-2xs shrink-0 mt-0.5">
              <BarChart2 className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Analisis Butir Soal &amp; Daya Pembeda
                </h1>
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 font-bold text-[10px] uppercase tracking-wider">
                  Psikometri Arikunto &amp; Depdiknas
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Evaluasi komprehensif tingkat kesukaran, daya pembeda, efektivitas pengecoh, serta panduan tindak lanjut guru untuk perbaikan instrumen evaluasi.
              </p>
            </div>
          </div>

          {/* Action Buttons Toolbar: Single Dropdown Menu */}
          <div className="self-start xl:self-center shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="rounded-xl font-bold text-xs h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <SlidersHorizontal className="h-4 w-4 text-blue-400 dark:text-blue-600" />
                  <span>Menu Aksi &amp; Laporan</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-1.5 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-50">
                <DropdownMenuItem
                  onClick={() => setShowGuideModal(true)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 shrink-0">
                    <HelpCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Panduan &amp; Rumus</span>
                    <span className="text-[10px] text-slate-400 font-normal">Kriteria Ebel &amp; Arikunto</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={loadAnalysisData}
                  disabled={loading}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin text-blue-600")} />
                  </div>
                  <div>
                    <span className="block font-bold">Refresh Data</span>
                    <span className="text-[10px] text-slate-400 font-normal">Kalkulasi ulang psikometri</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <DropdownMenuItem
                  onClick={handlePrint}
                  disabled={loading || analyzedQuestions.length === 0}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                    <Printer className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Cetak Laporan</span>
                    <span className="text-[10px] text-slate-400 font-normal">Format resmi A4 siap print</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleExportExcel}
                  disabled={loading || analyzedQuestions.length === 0}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                >
                  <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-emerald-800 dark:text-emerald-300">Ekspor Excel Lengkap</span>
                    <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-normal">3 Sheet + Pilihan Jawaban A-E</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* 2. RUANG UJIAN SELECTOR & EXAM METADATA (Screen Only, Clean & Uncluttered) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs print:hidden space-y-4">
        {/* Top: Ruang Ujian Selector with Clean Label */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                Pilih Ruang Ujian yang Dianalisis
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Pilih sesi ujian untuk memuat data analisis psikometri
              </span>
            </div>
          </div>

          <div className="w-full md:w-[420px] lg:w-[480px]">
            <select
              value={selectedRoomId}
              onChange={(e) => handleRoomChange(e.target.value)}
              disabled={loadingRooms}
              className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer shadow-2xs"
            >
              {roomList.length === 0 ? (
                <option value="">Belum ada ruang ujian</option>
              ) : (
                roomList.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} — {room.examTitle} ({room.subjectName})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Bottom: Clean Integrated Metadata Badges (No messy squished boxes, just clean airy inline summary) */}
        <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            {/* Meta 1: Ujian / Paket */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Ujian / Paket
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100" title={examMeta.title}>
                  {examMeta.title || "-"}
                </span>
              </div>
            </div>

            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800" />

            {/* Meta 2: Mata Pelajaran & Guru */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <BookOpen className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Mata Pelajaran &amp; Guru
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {examMeta.subjectName || "-"}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1.5 font-normal">
                  ({examMeta.teacherName || "-"})
                </span>
              </div>
            </div>
          </div>

          {/* Meta 3: Sampel Peserta */}
          <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300">
            <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Sampel Peserta (Kelley 27%)
              </span>
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {examMeta.totalParticipants} Siswa
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1.5 font-normal">
                (Kel. Atas/Bawah: {examMeta.upperCount} Siswa)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. EXECUTIVE SUMMARY / KPI CARDS (Screen Only) */}
      <div className="space-y-4 print:hidden">
        {/* Top 4 KPI Metrics: Layer 1 CTT Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Tingkat Kesukaran Rata-Rata */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tingkat Kesukaran (P)</span>
                <MetricInfoTooltip type="difficulty" side="bottom" />
              </div>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                %
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {stats.avgP.toFixed(2)}
              </span>
              <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold text-[10px]">
                {getDifficultyCategory(stats.avgP)}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Distribusi: <span className="text-emerald-600 font-bold">{stats.pDist.mudah} Mudah</span> •{" "}
              <span className="text-blue-600 font-bold">{stats.pDist.sedang} Sedang</span> •{" "}
              <span className="text-rose-600 font-bold">{stats.pDist.sukar} Sukar</span>
            </p>
          </div>

          {/* KPI 2: Daya Pembeda Rata-Rata */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Daya Pembeda (D)</span>
                <MetricInfoTooltip type="discrimination" side="bottom" />
              </div>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {stats.avgD >= 0 ? `+${stats.avgD.toFixed(2)}` : stats.avgD.toFixed(2)}
              </span>
              <Badge className={cn(
                "font-bold text-[10px]",
                stats.avgD >= 0.40
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : stats.avgD >= 0.30
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  : stats.avgD >= 0.20
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
              )}>
                {getDiscriminationCategory(stats.avgD)}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Metode 27% Kelley ({examMeta.upperCount} Atas vs {examMeta.lowerCount} Bawah).
            </p>
          </div>

          {/* KPI 3: Point-Biserial Rata-Rata */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Point-Biserial (r_pb)</span>
                <MetricInfoTooltip type="point_biserial" side="bottom" />
              </div>
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                <BarChart2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {stats.avgRpb >= 0 ? `+${stats.avgRpb.toFixed(2)}` : stats.avgRpb.toFixed(2)}
              </span>
              <Badge className={cn(
                "font-bold text-[10px]",
                stats.avgRpb >= 0.30
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : stats.avgRpb >= 0.20
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              )}>
                {getPointBiserialCategory(stats.avgRpb)}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Corrected Item-Total Pearson Correlation.
            </p>
          </div>

          {/* KPI 4: Efektivitas Pengecoh Rata-Rata */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Efektivitas Pengecoh</span>
                <MetricInfoTooltip type="distractor" side="bottom" />
              </div>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {stats.avgDE}%
              </span>
              <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold text-[10px]">
                DE Rata-rata
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Pengecoh berfungsi jika Fo ≥ 5% &amp; nBB &gt; nBA.
            </p>
          </div>
        </div>

        {/* Bottom Banner: Layer 3 Decision Engine 5-Tier Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Decision Engine: Rekapitulasi Keputusan CTT
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  Klik kategori untuk memfilter butir soal secara langsung
                </span>
              </div>
            </div>

            {stats.keyAlertCount > 0 && (
              <Badge className="bg-rose-600 text-white font-bold text-xs px-3 py-1 animate-pulse">
                ⚠️ {stats.keyAlertCount} Butir Indikasi Kunci Salah
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {/* Tier 1: Diterima */}
            <button
              onClick={() => setVerdictFilter(verdictFilter === "Diterima" ? "all" : "Diterima")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                verdictFilter === "Diterima"
                  ? "bg-emerald-100 dark:bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                  : "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40 hover:bg-emerald-100/60"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase">🟢 Diterima</span>
                <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">{stats.acceptedCount}</span>
              </div>
              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-medium mt-1">
                {stats.acceptedPercent}% • Item Sangat Baik
              </span>
            </button>

            {/* Tier 2: Revisi Kecil */}
            <button
              onClick={() => setVerdictFilter(verdictFilter === "Revisi Kecil" ? "all" : "Revisi Kecil")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                verdictFilter === "Revisi Kecil"
                  ? "bg-yellow-100 dark:bg-yellow-950/60 border-yellow-500 ring-2 ring-yellow-500/20 shadow-sm"
                  : "bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200/70 dark:border-yellow-900/40 hover:bg-yellow-100/60"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-yellow-800 dark:text-yellow-300 uppercase">🟡 Revisi Kecil</span>
                <span className="text-lg font-black text-yellow-700 dark:text-yellow-400">{stats.minorRevisionCount}</span>
              </div>
              <span className="text-[10px] text-yellow-700/80 dark:text-yellow-400/80 font-medium mt-1">
                {stats.minorRevisionPercent}% • Cek 1 Pengecoh
              </span>
            </button>

            {/* Tier 3: Revisi */}
            <button
              onClick={() => setVerdictFilter(verdictFilter === "Revisi" ? "all" : "Revisi")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                verdictFilter === "Revisi"
                  ? "bg-amber-100 dark:bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/20 shadow-sm"
                  : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/40 hover:bg-amber-100/60"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 uppercase">🟠 Revisi</span>
                <span className="text-lg font-black text-amber-700 dark:text-amber-400">{stats.revisionCount}</span>
              </div>
              <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium mt-1">
                {stats.revisionPercent}% • Kesukaran / Opsi
              </span>
            </button>

            {/* Tier 4: Revisi Total */}
            <button
              onClick={() => setVerdictFilter(verdictFilter === "Revisi Total" ? "all" : "Revisi Total")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                verdictFilter === "Revisi Total"
                  ? "bg-orange-100 dark:bg-orange-950/60 border-orange-500 ring-2 ring-orange-500/20 shadow-sm"
                  : "bg-orange-50/50 dark:bg-orange-950/20 border-orange-200/70 dark:border-orange-900/40 hover:bg-orange-100/60"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-orange-800 dark:text-orange-300 uppercase">🔴 Revisi Total</span>
                <span className="text-lg font-black text-orange-700 dark:text-orange-400">{stats.totalRevisionCount}</span>
              </div>
              <span className="text-[10px] text-orange-700/80 dark:text-orange-400/80 font-medium mt-1">
                {stats.totalRevisionPercent}% • D Rendah &lt; 0.20
              </span>
            </button>

            {/* Tier 5: Ditolak */}
            <button
              onClick={() => setVerdictFilter(verdictFilter === "Ditolak" ? "all" : "Ditolak")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                verdictFilter === "Ditolak"
                  ? "bg-rose-100 dark:bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/20 shadow-sm"
                  : "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/70 dark:border-rose-900/40 hover:bg-rose-100/60"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-rose-800 dark:text-rose-300 uppercase">⛔ Ditolak</span>
                <span className="text-lg font-black text-rose-700 dark:text-rose-400">{stats.rejectedCount}</span>
              </div>
              <span className="text-[10px] text-rose-700/80 dark:text-rose-400/80 font-medium mt-1">
                {stats.rejectedPercent}% • D Negatif / Kunci
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. FILTER & SEARCH TOOLBAR (Screen Only) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor, teks butir soal, atau materi stimulus..."
              className="pl-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-xs font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Keputusan CTT */}
            <select
              value={verdictFilter}
              onChange={(e) => setVerdictFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">Semua Keputusan CTT</option>
              <option value="Diterima">🟢 Diterima ({stats.acceptedCount})</option>
              <option value="Revisi Kecil">🟡 Revisi Kecil ({stats.minorRevisionCount})</option>
              <option value="Revisi">🟠 Revisi ({stats.revisionCount})</option>
              <option value="Revisi Total">🔴 Revisi Total ({stats.totalRevisionCount})</option>
              <option value="Ditolak">⛔ Ditolak ({stats.rejectedCount})</option>
            </select>

            {/* Tipe Soal */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">Semua Tipe Soal</option>
              <option value="pilihan_ganda">Pilihan Ganda</option>
              <option value="pilihan_ganda_kompleks">Pilihan Ganda Kompleks</option>
              <option value="benar_salah">Benar / Salah</option>
              <option value="menjodohkan">Menjodohkan</option>
              <option value="isian_singkat">Isian Singkat</option>
              <option value="uraian">Uraian</option>
            </select>

            {/* Kesukaran */}
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">Semua Kesukaran (P)</option>
              <option value="mudah">Mudah (P &gt; 0.70)</option>
              <option value="sedang">Sedang (0.31 - 0.70)</option>
              <option value="sukar">Sukar (P ≤ 0.30)</option>
            </select>

            {/* Daya Pembeda */}
            <select
              value={discriminationFilter}
              onChange={(e) => setDiscriminationFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">Semua Daya Beda (D)</option>
              <option value="sangat_baik">Sangat Baik (D ≥ 0.40)</option>
              <option value="baik">Baik (0.30 ≤ D &lt; 0.40)</option>
              <option value="cukup">Cukup (0.20 ≤ D &lt; 0.30)</option>
              <option value="rendah">Rendah (0.00 ≤ D &lt; 0.20)</option>
              <option value="negatif">Negatif (D &lt; 0.00)</option>
            </select>

            {/* Point-Biserial */}
            <select
              value={rpbFilter}
              onChange={(e) => setRpbFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">Semua Point-Biserial (r_pb)</option>
              <option value="sangat_baik">Sangat Baik (r_pb ≥ 0.40)</option>
              <option value="baik">Baik (0.30 ≤ r_pb &lt; 0.40)</option>
              <option value="cukup">Cukup (0.20 ≤ r_pb &lt; 0.30)</option>
              <option value="rendah">Rendah (0.00 ≤ r_pb &lt; 0.20)</option>
              <option value="negatif">Negatif (r_pb &lt; 0.00)</option>
            </select>

            {/* Expand / Collapse All */}
            <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExpandAll(true)}
                className="h-10 px-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Buka semua rincian butir soal"
              >
                Buka Semua
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExpandAll(false)}
                className="h-10 px-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Tutup semua rincian butir soal"
              >
                Tutup Semua
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. QUESTION ANALYSIS LIST (3-LAYER CTT ARCHITECTURE) */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-32 rounded-lg" />
                  <Skeleton className="h-6 w-24 rounded-lg" />
                </div>
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center print:hidden">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Search className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Tidak Ada Butir Soal yang Cocok</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
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
                className="mt-4 rounded-xl text-xs font-bold cursor-pointer"
              >
                Reset Semua Filter
              </Button>
            )}
          </div>
        ) : (
          filteredQuestions.map((q) => {
            const isExpanded = !!expandedQuestionIds[q.id];
            const verdictInfo = q.verdictDetail;

            // Warna kartu callout Layer 3 Keputusan (5 Discrete Tiers)
            let alertBg = "bg-emerald-50/70 border-emerald-200 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-800/60 dark:text-emerald-200";
            let alertIcon = <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />;
            let badgeBg = "bg-emerald-600 text-white";

            if (verdictInfo.verdict === "Revisi Kecil") {
              alertBg = "bg-yellow-50/80 border-yellow-200 text-yellow-950 dark:bg-yellow-950/20 dark:border-yellow-800/60 dark:text-yellow-200";
              alertIcon = <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />;
              badgeBg = "bg-yellow-500 text-slate-900 font-black";
            } else if (verdictInfo.verdict === "Revisi") {
              alertBg = "bg-amber-50/80 border-amber-200 text-amber-950 dark:bg-amber-950/20 dark:border-amber-800/60 dark:text-amber-200";
              alertIcon = <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />;
              badgeBg = "bg-amber-600 text-white font-black";
            } else if (verdictInfo.verdict === "Revisi Total") {
              alertBg = "bg-orange-50/80 border-orange-200 text-orange-950 dark:bg-orange-950/20 dark:border-orange-800/60 dark:text-orange-200";
              alertIcon = <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />;
              badgeBg = "bg-orange-600 text-white font-black";
            } else if (verdictInfo.verdict === "Ditolak") {
              alertBg = "bg-rose-50/80 border-rose-200 text-rose-950 dark:bg-rose-950/20 dark:border-rose-800/60 dark:text-rose-200";
              alertIcon = <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />;
              badgeBg = "bg-rose-600 text-white font-black";
            }

            return (
              <div
                key={q.id}
                className={cn(
                  "print-card bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs",
                  "print:border-slate-300 print:shadow-none print:mb-4 print:bg-white",
                  verdictInfo.keyAlert
                    ? "border-rose-300 dark:border-rose-800/70 ring-1 ring-rose-200 dark:ring-rose-900/40"
                    : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                )}
              >
                {/* Header Butir Soal */}
                <div
                  onClick={() => toggleExpand(q.id)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors print:bg-white print:p-2"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-sm text-slate-800 dark:text-slate-200 shrink-0 print:border-slate-400">
                      {q.index}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-slate-800 print:border-slate-400">
                          {q.type.replace(/_/g, " ")}
                        </Badge>
                        {q.groupId && (
                          <Badge variant="secondary" className="text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 print:hidden">
                            Paket Literasi
                          </Badge>
                        )}
                        {q.type === "benar_salah" && q.statements && q.statements.length > 0 ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 text-[10px] font-bold print:border-slate-400">
                            Kunci: {q.statements.map((s, idx) => `${idx + 1}:${(s.answer || "benar").toUpperCase().charAt(0)}`).join(" ")}
                          </Badge>
                        ) : q.type === "pilihan_ganda_kompleks" && q.choices ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 text-[10px] font-bold print:border-slate-400">
                            Kunci: {Object.keys(q.choices).filter(k => q.choices![k]?.isCorrect).map(k => k.toUpperCase()).sort().join(", ") || q.answerKey || "-"}
                          </Badge>
                        ) : q.answerKey ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 text-[10px] font-bold print:border-slate-400">
                            Kunci: {q.answerKey}
                          </Badge>
                        ) : null}
                      </div>
                      {!isExpanded && (
                        <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 max-w-3xl font-medium mt-0.5 print:hidden">
                          <MathText content={q.text || "Tanpa teks pertanyaan"} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metrik Mini di Header: Statistik Terpisah dari Keputusan */}
                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center flex-wrap">
                    {/* Kesukaran */}
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Kesukaran (P)</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {q.difficultyIndex.toFixed(2)}{" "}
                        <span className={cn(
                          "text-[10px] font-bold",
                          q.difficultyCategory === "Sedang" ? "text-emerald-600" : (q.difficultyCategory === "Mudah" ? "text-blue-600" : "text-amber-600")
                        )}>
                          ({q.difficultyCategory})
                        </span>
                      </span>
                    </div>

                    {/* Daya Pembeda */}
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Daya Beda (D)</span>
                      <span className={cn(
                        "text-xs font-black",
                        q.discriminationIndex >= 0.40
                          ? "text-emerald-600 dark:text-emerald-400"
                          : q.discriminationIndex >= 0.30
                          ? "text-blue-600 dark:text-blue-400"
                          : q.discriminationIndex >= 0.20
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-rose-600 dark:text-rose-400"
                      )}>
                        {q.discriminationIndex >= 0 ? `+${q.discriminationIndex.toFixed(2)}` : q.discriminationIndex.toFixed(2)}{" "}
                        <span className="text-[10px] font-bold">({q.discriminationCategory})</span>
                      </span>
                    </div>

                    {/* Point-Biserial */}
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Point-Biserial</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {q.pointBiserial >= 0 ? `+${q.pointBiserial.toFixed(2)}` : q.pointBiserial.toFixed(2)}{" "}
                        <span className="text-[10px] font-bold text-slate-500">({q.pointBiserialCategory})</span>
                      </span>
                    </div>

                    {/* Keputusan Badge (Decision Engine Verdict) */}
                    <Badge className={cn("font-black text-[11px] px-2.5 py-1 rounded-xl shadow-xs print:border print:border-slate-400", badgeBg)}>
                      {verdictInfo.badgeLabel}
                    </Badge>

                    <div className="text-slate-400 hover:text-slate-600 p-1 print:hidden">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Konten Rinci Butir Soal (Expanded pada layar, selalu tampil penuh saat dicetak) */}
                <div className={cn("p-5 border-t border-slate-200/80 dark:border-slate-800 space-y-5 print:p-3 print:space-y-3", !isExpanded && "hidden print:block")}>
                  {/* 1. Teks Soal & Stimulus Lengkap */}
                  <div className="space-y-3">
                    {q.groupText && (
                      <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed print:bg-slate-50 print:border-slate-300">
                        <span className="font-bold block text-[10px] text-indigo-600 uppercase tracking-widest mb-1 print:text-black">
                          Materi Stimulus / Teks Wacana
                        </span>
                        <MathText content={q.groupText} />
                      </div>
                    )}

                    <div className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                      <MathText content={q.text} />
                    </div>

                    {/* Teks Opsi Jawaban (Print Only View) */}
                    {q.choices && (
                      <div className="hidden print:grid grid-cols-2 gap-1.5 text-[11px] pt-2">
                        {Object.entries(q.choices).map(([key, ch]) => {
                          const isCorr = ch.isCorrect || (q.answerKey && q.answerKey.toUpperCase().includes(key.toUpperCase()));
                          return (
                            <div key={key} className={cn("p-2 rounded border text-left flex items-start gap-1.5", isCorr ? "border-slate-900 font-bold bg-slate-100" : "border-slate-200")}>
                              <span className="font-black shrink-0">{key.toUpperCase()}.</span>
                              <div className="flex-1">
                                <MathText content={ch.text} />
                              </div>
                              {isCorr && <span className="ml-1 text-[9px] uppercase font-black text-emerald-700 shrink-0">[Kunci]</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Teks Pernyataan Benar/Salah (Tampil Penuh di Layar & Cetak) */}
                    {q.type === "benar_salah" && q.statements && q.statements.length > 0 && (
                      <div className="mt-3 p-4 bg-slate-50/90 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2.5 print:bg-white print:border-slate-300 print:p-2.5">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-700/80">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />
                            Daftar Pernyataan &amp; Kunci Jawaban
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {q.statements.length} Pernyataan
                          </span>
                        </div>
                        <div className="space-y-2 pt-0.5">
                          {q.statements.map((st, sIdx) => {
                            const isBenar = (st.answer || "benar").toLowerCase() === "benar";
                            return (
                              <div
                                key={st.id || sIdx}
                                className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-start gap-3 shadow-2xs print:border-slate-300 print:p-2"
                              >
                                <span className="font-black text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                                  #{sIdx + 1}
                                </span>
                                <div className="flex-1 text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                                  <MathText content={st.text} />
                                </div>
                                <Badge
                                  className={cn(
                                    "font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-md shrink-0 shadow-2xs",
                                    isBenar
                                      ? "bg-emerald-600 text-white hover:bg-emerald-600"
                                      : "bg-rose-600 text-white hover:bg-rose-600"
                                  )}
                                >
                                  Kunci: {isBenar ? "BENAR" : "SALAH"}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {q.imageUrl && (
                      <div className="max-w-md pt-2">
                        <SmartImage src={q.imageUrl} alt={`Gambar Soal ${q.index}`} className="rounded-xl border border-slate-200 dark:border-slate-700 max-h-64 object-contain" />
                      </div>
                    )}
                  </div>

                  {/* 2. LAPISAN 1: STATISTIK ITEM CTT (Item Statistics) */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                      Lapisan 1: Statistik Psikometri Butir Soal (CTT)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 print:bg-white print:border-slate-300">
                      {/* P */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tingkat Kesukaran (P)</span>
                          <MetricInfoTooltip type="difficulty" side="top" />
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            P = {q.difficultyIndex.toFixed(2)}
                          </span>
                          <span className={cn(
                            "text-[10px] font-bold",
                            q.difficultyCategory === "Sedang" ? "text-emerald-600" : (q.difficultyCategory === "Mudah" ? "text-blue-600" : "text-amber-600")
                          )}>
                            ({q.difficultyCategory})
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          B / N = {q.totalCorrect} / {q.totalAnswered} Siswa ({Math.round(q.difficultyIndex * 100)}%)
                        </span>
                      </div>

                      {/* D */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Daya Pembeda (D)</span>
                          <MetricInfoTooltip type="discrimination" side="top" />
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className={cn(
                            "text-sm font-black",
                            q.discriminationIndex >= 0.40 ? "text-emerald-600" : (q.discriminationIndex >= 0.30 ? "text-blue-600" : (q.discriminationIndex >= 0.20 ? "text-amber-600" : "text-rose-600"))
                          )}>
                            D = {q.discriminationIndex >= 0 ? `+${q.discriminationIndex.toFixed(2)}` : q.discriminationIndex.toFixed(2)}
                          </span>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            ({q.discriminationCategory})
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          Ba: {q.upperGroupCorrect}/{examMeta.upperCount} vs Bb: {q.lowerGroupCorrect}/{examMeta.lowerCount} (Δ {q.upperGroupCorrect - q.lowerGroupCorrect})
                        </span>
                      </div>

                      {/* r_pb */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Point-Biserial (r_pb)</span>
                          <MetricInfoTooltip type="point_biserial" side="top" />
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            r_pb = {q.pointBiserial >= 0 ? `+${q.pointBiserial.toFixed(2)}` : q.pointBiserial.toFixed(2)}
                          </span>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            ({q.pointBiserialCategory})
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          Corrected Item-Total Pearson (Yi vs X - Yi)
                        </span>
                      </div>

                      {/* Distractor Efficiency */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Efektivitas Pengecoh</span>
                          <MetricInfoTooltip type="distractor" side="top" />
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            DE = {q.distractorEfficiency}%
                          </span>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            ({q.effectiveDistractorCount}/{q.totalDistractorCount} Efektif)
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          Syarat: Fo ≥ 5% &amp; nBB &gt; nBA
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. LAPISAN 2: DIAGNOSIS MASALAH PSIKOMETRI (Diagnostic Engine) */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                      Lapisan 2: Diagnosis Masalah &amp; Anomali Butir Soal
                    </span>
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                      {/* Diagnostic Flags Tag Bar */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {q.flags && q.flags.length > 0 ? (
                          q.flags.map((flag, flIdx) => (
                            <Badge
                              key={flIdx}
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5",
                                flag.includes("NEGATIF") || flag.includes("KUNCI")
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200 border-rose-300"
                                  : flag.includes("RENDAH") || flag.includes("MENYESATKAN")
                                  ? "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 border-orange-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-300"
                              )}
                            >
                              ⚠️ {flag}
                            </Badge>
                          ))
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 font-bold text-[10px]">
                            ✓ TIDAK ADA ANOMALI PSIKOMETRI
                          </Badge>
                        )}
                      </div>

                      {/* Temuan Rinci */}
                      <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        {verdictInfo.findings.map((f, fIdx) => (
                          <li key={fIdx} className="flex items-start gap-2 leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 4. LAPISAN 3: KEPUTUSAN KELAYAKAN & REKOMENDASI GURU (Decision Engine) */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                      Lapisan 3: Keputusan CTT &amp; Tindak Lanjut Guru
                    </span>
                    <div className={cn("rounded-2xl border p-5 space-y-4 transition-all shadow-xs print:border-slate-300 print:p-3 print:bg-slate-50", alertBg)}>
                      {/* Top Bar: Title, Badge, and Subtitle */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b border-black/10 dark:border-white/10 print:pb-2">
                        <div className="flex items-center gap-2.5">
                          {alertIcon}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white">
                                {verdictInfo.summaryTitle}
                              </h4>
                              {verdictInfo.keyAlert && (
                                <Badge className="bg-rose-600 text-white font-bold text-[9px] uppercase tracking-wider animate-bounce">
                                  Kritis: Cek Kunci Jawaban
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                              Keputusan Psikometri: <strong className="underline decoration-current underline-offset-2 text-slate-800 dark:text-slate-200">{verdictInfo.badgeLabel}</strong> (Classical Test Theory)
                            </p>
                          </div>
                        </div>
                        <Badge className={cn("font-black text-[11px] px-3 py-1 rounded-xl shadow-xs shrink-0 self-start sm:self-center print:border print:border-slate-400", badgeBg)}>
                          {verdictInfo.badgeLabel}
                        </Badge>
                      </div>

                      {/* Content: Alasan Keputusan & Tindak Lanjut Konkret */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 print:grid-cols-12">
                        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2 print:border-slate-300 print:bg-white print:p-2.5">
                          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            <Search className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Dasar Pertimbangan Keputusan</span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                            {verdictInfo.verdict === "Diterima"
                              ? "Item berfungsi memuaskan (D ≥ 0.40), kunci jawaban terverifikasi valid, dan memiliki konsistensi internal yang baik. Tidak ditemukan masalah substansi kritis."
                              : verdictInfo.verdict === "Revisi Kecil"
                              ? "Secara empiris butir soal memiliki daya pisah baik (0.30 ≤ D < 0.40), namun terdapat opsi pengecoh yang pasif/mati. Cukup perbaiki pilihan jawaban yang tidak bekerja tanpa merombak soal."
                              : verdictInfo.verdict === "Revisi"
                              ? "Butir soal memiliki daya pisah cukup (0.20 ≤ D < 0.30) atau tingkat kesukaran ekstrem (sangat mudah/sulit). Butir soal masih dapat diselamatkan melalui kalibrasi redaksi."
                              : verdictInfo.verdict === "Revisi Total"
                              ? "Daya pembeda rendah (0.00 ≤ D < 0.20) atau terdapat ambiguitas konstruksi soal yang signifikan. Disarankan merombak stimulus dan pilihan jawaban secara menyeluruh."
                              : "Daya pembeda negatif (D < 0) mengindikasikan siswa kelompok bawah lebih banyak menjawab benar daripada kelompok atas. Sangat mungkin kunci jawaban salah atau butir soal sangat menyesatkan."}
                          </p>
                        </div>

                        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2 print:border-slate-300 print:bg-white print:p-2.5">
                          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Tindak Lanjut &amp; Rekomendasi Guru</span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                            {verdictInfo.actionPlan}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5A. TABEL DISTRIBUSI PENGECOH (PILIHAN GANDA & KOMPLEKS) (Screen Only) */}
                  {q.type !== "benar_salah" && q.distractors && q.distractors.length > 0 && (
                    <div className="space-y-2.5 pt-2 print:hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="h-4 w-4 text-blue-600" />
                          {q.type === "pilihan_ganda_kompleks"
                            ? "Distribusi Opsi & Analisis Pengecoh (Pilihan Ganda Kompleks)"
                            : "Distribusi Pemilih & Analisis Pengecoh"}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {q.type === "pilihan_ganda_kompleks"
                            ? "Multi-Pilihan • Pengecoh Efektif: Fo ≥ 5% & Kelompok Bawah > Kelompok Atas"
                            : "Pengecoh Efektif: Fo ≥ 5% & Kelompok Bawah > Kelompok Atas"}
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="py-2.5 px-3 w-12 text-center">Opsi</th>
                              <th className="py-2.5 px-3">Teks Pilihan Jawaban</th>
                              <th className="py-2.5 px-3 text-center">Total Pemilih</th>
                              <th className="py-2.5 px-3 text-center">Kel. Atas (Ba)</th>
                              <th className="py-2.5 px-3 text-center">Kel. Bawah (Bb)</th>
                              <th className="py-2.5 px-3 text-center">Efektif?</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                              <th className="py-2.5 px-3">Catatan Evaluasi Pengecoh</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {q.distractors.map((dis) => {
                              let badgeColor = "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
                              if (dis.status === "Kunci") badgeColor = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-black";
                              else if (dis.status === "Menyesatkan") badgeColor = "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 font-black";
                              else if (dis.status === "Tidak Efektif") badgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";

                              return (
                                <tr key={dis.key} className={cn("hover:bg-slate-50/60 dark:hover:bg-slate-800/40", dis.isCorrect && "bg-emerald-50/30 dark:bg-emerald-950/10")}>
                                  <td className="py-2 px-3 text-center font-black text-slate-800 dark:text-slate-200">
                                    {dis.key}
                                  </td>
                                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300 max-w-xs">
                                    <MathText content={dis.text || "-"} />
                                  </td>
                                  <td className="py-2 px-3 text-center font-bold">
                                    {dis.totalCount} <span className="text-[10px] text-slate-400 font-normal">({dis.totalPercent}%)</span>
                                    <div className="w-16 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                                      <div
                                        className={cn("h-full rounded-full", dis.isCorrect ? "bg-emerald-500" : (dis.status === "Menyesatkan" ? "bg-rose-500" : "bg-blue-500"))}
                                        style={{ width: `${Math.min(100, dis.totalPercent)}%` }}
                                      />
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                                    {dis.upperCount} <span className="text-[10px] text-slate-400 font-normal">({dis.upperPercent}%)</span>
                                  </td>
                                  <td className="py-2 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                                    {dis.lowerCount} <span className="text-[10px] text-slate-400 font-normal">({dis.lowerPercent}%)</span>
                                  </td>
                                  <td className="py-2 px-3 text-center font-bold">
                                    {dis.isCorrect ? (
                                      <span className="text-emerald-600 font-black text-[10px]">KUNCI</span>
                                    ) : dis.effective ? (
                                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[9px] font-bold">YA</Badge>
                                    ) : (
                                      <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[9px] font-bold">TIDAK</Badge>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <Badge className={cn("text-[10px] font-bold px-2 py-0.5", badgeColor)}>
                                      {dis.status}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-3 text-slate-600 dark:text-slate-400 text-[11px] leading-snug">
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

                  {/* 5B. TABEL DISTRIBUSI & ANALISIS PERNYATAAN (BENAR / SALAH) (Screen Only) */}
                  {q.type === "benar_salah" && (
                    <div className="space-y-2.5 pt-2 print:hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckSquare className="h-4 w-4 text-emerald-600" />
                          Distribusi Respon &amp; Analisis Pernyataan (Benar / Salah)
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          Kriteria Pernyataan Baik: Daya Beda D ≥ +0.20 &amp; Kesukaran Proporsional (0.20 ≤ P ≤ 0.90)
                        </span>
                      </div>

                      {q.statementsAnalysis && q.statementsAnalysis.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                              <tr>
                                <th className="py-2.5 px-3 w-10 text-center">No</th>
                                <th className="py-2.5 px-3">Teks Pernyataan</th>
                                <th className="py-2.5 px-3 text-center">Kunci</th>
                                <th className="py-2.5 px-3 text-center">Distribusi Respon (Benar / Salah)</th>
                                <th className="py-2.5 px-3 text-center">Kel. Atas (Ba)</th>
                                <th className="py-2.5 px-3 text-center">Kel. Bawah (Bb)</th>
                                <th className="py-2.5 px-3 text-center">Kesukaran (P)</th>
                                <th className="py-2.5 px-3 text-center">Daya Beda (D)</th>
                                <th className="py-2.5 px-3 text-center">Status</th>
                                <th className="py-2.5 px-3">Catatan Evaluasi Pernyataan</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                              {q.statementsAnalysis.map((st) => {
                                let badgeColor = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold";
                                if (st.status === "Menyesatkan") badgeColor = "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 font-black";
                                else if (st.status === "Terlalu Mudah") badgeColor = "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold";
                                else if (st.status === "Terlalu Sukar") badgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-bold";
                                else if (st.status === "Cukup") badgeColor = "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 font-bold";

                                return (
                                  <tr key={st.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                    <td className="py-2 px-3 text-center font-black text-slate-800 dark:text-slate-200">
                                      {st.index}
                                    </td>
                                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300 max-w-sm">
                                      <MathText content={st.text || "-"} />
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <Badge className={cn(
                                        "text-[10px] font-black uppercase px-2 py-0.5",
                                        st.correctAnswer === "benar" 
                                          ? "bg-emerald-600 text-white" 
                                          : "bg-rose-600 text-white"
                                      )}>
                                        {st.correctAnswer}
                                      </Badge>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5 font-bold">
                                        <span className="text-emerald-700 dark:text-emerald-400">{st.totalBenar} B <span className="text-[10px] text-slate-400 font-normal">({st.totalBenarPercent}%)</span></span>
                                        <span className="text-slate-300 dark:text-slate-600">/</span>
                                        <span className="text-rose-600 dark:text-rose-400">{st.totalSalah} S <span className="text-[10px] text-slate-400 font-normal">({st.totalSalahPercent}%)</span></span>
                                      </div>
                                      <div className="w-24 bg-rose-100 dark:bg-rose-950/40 h-1.5 rounded-full mx-auto mt-1 overflow-hidden flex">
                                        <div
                                          className="bg-emerald-500 h-full"
                                          style={{ width: `${st.totalBenarPercent}%` }}
                                        />
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                                      {st.upperBenar} <span className="text-[10px] text-slate-400 font-normal">({st.upperBenarPercent}%)</span>
                                    </td>
                                    <td className="py-2 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                                      {st.lowerBenar} <span className="text-[10px] text-slate-400 font-normal">({st.lowerBenarPercent}%)</span>
                                    </td>
                                    <td className="py-2 px-3 text-center font-black text-slate-800 dark:text-slate-200">
                                      {st.difficultyIndex.toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-center font-black">
                                      <span className={cn(
                                        st.discriminationIndex >= 0.30
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : st.discriminationIndex >= 0.20
                                          ? "text-blue-600 dark:text-blue-400"
                                          : st.discriminationIndex >= 0
                                          ? "text-amber-600 dark:text-amber-400"
                                          : "text-rose-600 dark:text-rose-400"
                                      )}>
                                        {st.discriminationIndex >= 0 ? `+${st.discriminationIndex.toFixed(2)}` : st.discriminationIndex.toFixed(2)}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <Badge className={cn("text-[10px] px-2 py-0.5 whitespace-nowrap", badgeColor)}>
                                        {st.status}
                                      </Badge>
                                    </td>
                                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 text-[11px] leading-snug">
                                      {st.note}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500">
                          Data analisis respon siswa untuk setiap butir pernyataan akan tampil saat siswa mulai mengerjakan ujian.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
          <p className="text-[10px] text-slate-500 mt-0.5">NIP. ................................................................</p>
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
          <p className="text-[10px] text-slate-500 mt-0.5">NIP. ................................................................</p>
        </div>
      </div>

      {/* 6. MODAL PANDUAN & RUMUS PSIKOMETRI (CLASSICAL TEST THEORY 3 LAPISAN) */}
      <Dialog open={showGuideModal} onOpenChange={setShowGuideModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Panduan Evaluasi Butir Soal: Classical Test Theory (CTT 3 Lapisan)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Arsitektur evaluasi psikometri terstandar: Statistik Butir Soal → Diagnosis Masalah → Decision Engine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {/* Bagian 1: Tingkat Kesukaran */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black">1</span>
                Tingkat Kesukaran (Facility Value / P)
              </h4>
              <p>
                Proporsi peserta tes yang menjawab benar. Nilai P semakin besar menandakan butir soal semakin mudah.
              </p>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-blue-700 dark:text-blue-300">
                P = B / N (B = Jumlah siswa menjawab benar, N = Total peserta tes)
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                <li><strong>0.00 – 0.30:</strong> Sukar</li>
                <li><strong>0.31 – 0.70:</strong> Sedang (Proporsional / Ideal untuk Evaluasi)</li>
                <li><strong>0.71 – 1.00:</strong> Mudah</li>
              </ul>
            </div>

            {/* Bagian 2: Daya Pembeda & Aturan 27% Kelley */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black">2</span>
                Daya Pembeda (D) &amp; Aturan 27% Kelley
              </h4>
              <p>
                Mengukur kemampuan butir soal membedakan siswa kelompok atas (pandai) dan kelompok bawah (kurang pandai). Siswa diurutkan berdasarkan skor total, lalu diambil 27% teratas dan 27% terbawah: <code>groupSize = floor(N × 0.27)</code>.
              </p>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
                D = PA - PB = (BA - BB) / groupSize
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                <li><strong>D ≥ 0.40:</strong> Sangat Baik (Pedoman Robert L. Ebel)</li>
                <li><strong>0.30 ≤ D &lt; 0.40:</strong> Baik (Diterima tanpa revisi signifikan)</li>
                <li><strong>0.20 ≤ D &lt; 0.30:</strong> Cukup (Perlu revisi minor)</li>
                <li><strong>0.00 ≤ D &lt; 0.20:</strong> Rendah (Perlu revisi total)</li>
                <li><strong>D &lt; 0.00:</strong> Negatif (DITOLAK / Indikasi salah kunci jawaban)</li>
              </ul>
            </div>

            {/* Bagian 3: Point-Biserial Correlation (r_pb) */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-black">3</span>
                Point-Biserial Correlation (Corrected Item-Total r_pb)
              </h4>
              <p>
                Korelasi Pearson antara skor dikotomis butir soal (0 atau 1) dengan total skor siswa yang dikoreksi (skor butir dikurangkan dari skor total agar tidak terjadi inflasi korelasi artifisial).
              </p>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-purple-700 dark:text-purple-300">
                r_pb = Corr(Yi, X - Yi)
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                <li><strong>r_pb ≥ 0.40:</strong> Sangat Baik (Konsistensi internal sangat tinggi)</li>
                <li><strong>0.30 ≤ r_pb &lt; 0.40:</strong> Baik</li>
                <li><strong>0.20 ≤ r_pb &lt; 0.30:</strong> Cukup</li>
                <li><strong>0.00 ≤ r_pb &lt; 0.20:</strong> Rendah</li>
                <li><strong>r_pb &lt; 0.00:</strong> Negatif (Diskriminasi terbalik)</li>
              </ul>
            </div>

            {/* Bagian 4: Analisis Pengecoh & Distractor Efficiency */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">4</span>
                Efektivitas Pengecoh &amp; Distractor Efficiency (DE%)
              </h4>
              <p>
                Setiap pilihan jawaban salah (pengecoh) dianalisis efektivitas fungsinya berdasarkan dua syarat:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                <li><strong>Frekuensi Pemilih:</strong> Dipilih minimal 5% dari total peserta (<code>Fo ≥ 5%</code>). Pengecoh &lt;5% adalah <em>Pengecoh Pasif/Mati</em>.</li>
                <li><strong>Daya Tarik Kelompok:</strong> Lebih banyak menarik siswa Kelompok Bawah daripada Kelompok Atas (<code>nBB &gt; nBA</code>). Jika sebaliknya, pengecoh berstatus <em>Menyesatkan</em>.</li>
              </ul>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                DE = (Jumlah Pengecoh Efektif / Total Pengecoh) × 100%
              </div>
            </div>

            {/* Bagian 5: Decision Engine (5 Tingkat Keputusan) */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-black">5</span>
                Decision Engine (5 Tingkat Keputusan)
              </h4>
              <p>
                Sistem tidak menggabungkan rumus statistik mentah ke dalam label keputusan, melainkan menggunakan mesin inferensi 5 tingkat:
              </p>
              <div className="space-y-1.5 text-[11px]">
                <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200">
                  <strong>🟢 DITERIMA:</strong> D ≥ 0.40, kunci valid, konsistensi r_pb baik, dan tidak ada anomali substansi kritis.
                </div>
                <div className="p-2 rounded bg-yellow-50 dark:bg-yellow-950/40 text-yellow-900 dark:text-yellow-200 border border-yellow-200">
                  <strong>🟡 REVISI KECIL:</strong> 0.30 ≤ D &lt; 0.40 atau D ≥ 0.40 dengan 1 opsi pengecoh yang tidak berfungsi (cukup revisi opsi terkait).
                </div>
                <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200">
                  <strong>🟠 REVISI:</strong> 0.20 ≤ D &lt; 0.30 atau tingkat kesukaran ekstrem (P &lt; 0.30 atau P &gt; 0.70) namun D masih positif.
                </div>
                <div className="p-2 rounded bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 border border-orange-200">
                  <strong>🔴 REVISI TOTAL:</strong> 0.00 ≤ D &lt; 0.20 atau soal multitafsir / cacat konstruksi stimulus.
                </div>
                <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border border-rose-200">
                  <strong>⛔ DITOLAK:</strong> D &lt; 0.00 (kelompok bawah lebih banyak benar) atau terindikasi kuat salah kunci jawaban.
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button onClick={() => setShowGuideModal(false)} className="rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">
              Mengerti &amp; Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};

export default ItemAnalysisPage;
