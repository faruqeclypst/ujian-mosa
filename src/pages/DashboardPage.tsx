import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  LayoutTemplate,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  RefreshCw,
  AlertTriangle,
  Activity,
  TrendingUp,
  BarChart2,
  Lock,
  Clock,
  Calendar,
  ArrowUpRight,
  Radio,
  DoorOpen,
  FileSpreadsheet,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ShieldCheck,
  Building2,
  GripVertical,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useTheme } from "../context/ThemeContext";
import { useExamData } from "../context/ExamDataContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils";

type DashboardPanelId = "kpis" | "actions" | "intelligence" | "analytics" | "master_data";

const DEFAULT_PANEL_ORDER: DashboardPanelId[] = [
  "kpis",
  "actions",
  "intelligence",
  "analytics",
  "master_data",
];

const PANEL_STORAGE_KEY = "cbt_admin_dashboard_panel_order";

const DashboardPage = () => {
  const navigate = useNavigate();
  const { teachers, classes, subjects, students, loading: contextLoading } = useExamData();
  const { pb: tenantPb, school, terminology } = useTenant();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === "dark";
  const pb = tenantPb!;

  const planName = school?.plan ? school.plan.charAt(0).toUpperCase() + school.plan.slice(1) : "Free";
  const quota = school?.student_quota || 250;

  const [exams, setExams] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);

  const [totalExams, setTotalExams] = useState(0);
  const [activeRooms, setActiveRooms] = useState(0);
  const [ongoingStudents, setOngoingStudents] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [typeDistribution, setTypeDistribution] = useState<any[]>([]);
  const [activityTrend, setActivityTrend] = useState<any[]>([]);
  const [localLoading, setLocalLoading] = useState(true);

  const [activeDashboardTab, setActiveDashboardTab] = useState<"performa" | "pelanggaran" | "selesai">("performa");
  const [logActivity, setLogActivity] = useState<{
    violations: any[];
    recentFinished: any[];
  }>({ violations: [], recentFinished: [] });

  // ── Drag & Drop Panel Order State ──
  const [panelOrder, setPanelOrder] = useState<DashboardPanelId[]>(() => {
    try {
      const saved = localStorage.getItem(PANEL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as DashboardPanelId[];
        const isValid = DEFAULT_PANEL_ORDER.every((p) => parsed.includes(p)) && parsed.length === DEFAULT_PANEL_ORDER.length;
        if (isValid) return parsed;
      }
    } catch (e) {
      // Fallback to default
    }
    return DEFAULT_PANEL_ORDER;
  });

  const [draggedPanel, setDraggedPanel] = useState<DashboardPanelId | null>(null);
  const [dragOverPanel, setDragOverPanel] = useState<DashboardPanelId | null>(null);

  const isCustomOrder = JSON.stringify(panelOrder) !== JSON.stringify(DEFAULT_PANEL_ORDER);

  const movePanel = (panelId: DashboardPanelId, direction: "up" | "down") => {
    const currentIndex = panelOrder.indexOf(panelId);
    if (currentIndex === -1) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= panelOrder.length) return;

    const updated = [...panelOrder];
    const [moved] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setPanelOrder(updated);
    try {
      localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleDragStart = (e: React.DragEvent, panelId: DashboardPanelId) => {
    setDraggedPanel(panelId);
    e.dataTransfer.setData("text/plain", panelId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetPanelId: DashboardPanelId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverPanel !== targetPanelId) {
      setDragOverPanel(targetPanelId);
    }
  };

  const handleDragLeave = () => {
    setDragOverPanel(null);
  };

  const handleDrop = (e: React.DragEvent, targetPanelId: DashboardPanelId) => {
    e.preventDefault();
    if (!draggedPanel || draggedPanel === targetPanelId) {
      setDraggedPanel(null);
      setDragOverPanel(null);
      return;
    }

    const fromIndex = panelOrder.indexOf(draggedPanel);
    const toIndex = panelOrder.indexOf(targetPanelId);
    if (fromIndex !== -1 && toIndex !== -1) {
      const updated = [...panelOrder];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      setPanelOrder(updated);
      try {
        localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {}
    }

    setDraggedPanel(null);
    setDragOverPanel(null);
  };

  const handleDragEnd = () => {
    setDraggedPanel(null);
    setDragOverPanel(null);
  };

  const resetPanelOrder = () => {
    setPanelOrder(DEFAULT_PANEL_ORDER);
    try {
      localStorage.removeItem(PANEL_STORAGE_KEY);
    } catch (e) {}
  };

  const loading = contextLoading || localLoading;

  // Current formatted date in Indonesian
  const currentDateStr = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  // 1. Fetch Exams and Rooms on mount and subscribe to their updates
  useEffect(() => {
    const initData = async () => {
      try {
        const [examsData, roomsData] = await Promise.all([
          pb.collection("exams").getFullList(),
          pb.collection("exam_rooms").getFullList(),
        ]);
        setExams(examsData);
        setRooms(roomsData);
      } catch (e) {
        console.error("Dashboard mount error:", e);
      } finally {
        setLocalLoading(false);
      }
    };

    initData();

    const unsubExams = pb.collection("exams").subscribe("*", async () => {
      try {
        const examsData = await pb.collection("exams").getFullList();
        setExams(examsData);
      } catch (e) {
        console.error(e);
      }
    });

    const unsubRooms = pb.collection("exam_rooms").subscribe("*", async () => {
      try {
        const roomsData = await pb.collection("exam_rooms").getFullList();
        setRooms(roomsData);
      } catch (e) {
        console.error(e);
      }
    });

    return () => {
      unsubExams.then((u: any) => u());
      unsubRooms.then((u: any) => u());
    };
  }, [pb]);

  // Compute active room IDs sorted and joined as a string to serve as a dependency
  const activeRoomsList = rooms.filter((r: any) => r.status !== "archive");
  const activeRoomIdsStr = activeRoomsList.map((r: any) => r.id).sort().join(",");

  // 2. Fetch Attempts only for active rooms and only specific fields when activeRoomIdsStr changes
  useEffect(() => {
    let isMounted = true;
    const fetchAttempts = async () => {
      if (!activeRoomIdsStr) {
        setAttempts([]);
        return;
      }
      try {
        const activeIds = activeRoomIdsStr.split(",");
        const filterStr = activeIds.map((id) => `examRoomId = "${id}"`).join(" || ");
        const attemptsData = await pb.collection("attempts").getFullList({
          filter: filterStr,
          sort: "-updated",
          fields: "id,status,studentId,student_id,examRoomId,exam_room_id,score,cheatCount,updated,created,examId",
        });
        if (isMounted) {
          setAttempts(attemptsData);
        }
      } catch (e) {
        console.error("Error fetching attempts:", e);
      }
    };

    fetchAttempts();

    return () => {
      isMounted = false;
    };
  }, [pb, activeRoomIdsStr]);

  const activeRoomIdsRef = useRef<string[]>([]);
  useEffect(() => {
    activeRoomIdsRef.current = activeRoomIdsStr ? activeRoomIdsStr.split(",") : [];
  }, [activeRoomIdsStr]);

  // 3. Real-time Subscription for attempts
  useEffect(() => {
    if (!pb) return;
    let isSubscribed = true;
    let currentUnsub: (() => void) | null = null;

    const startSubscribe = async () => {
      try {
        const unsub = await pb.collection("attempts").subscribe("*", (e) => {
          if (!isSubscribed) return;

          const recRoomId = e.record.examRoomId || e.record.exam_room_id || "";
          if (!activeRoomIdsRef.current.includes(recRoomId)) return;

          if (e.action === "create" || e.action === "update") {
            setAttempts((prev) => {
              const idx = prev.findIndex((a) => a.id === e.record.id);
              const cleanRecord = {
                id: e.record.id,
                status: e.record.status,
                studentId: e.record.studentId || e.record.student_id,
                student_id: e.record.student_id || e.record.studentId,
                examRoomId: e.record.examRoomId || e.record.exam_room_id,
                exam_room_id: e.record.exam_room_id || e.record.examRoomId,
                score: e.record.score,
                cheatCount: e.record.cheatCount,
                updated: e.record.updated,
                created: e.record.created,
                examId: e.record.examId,
              };

              if (idx > -1) {
                const newArr = [...prev];
                newArr[idx] = { ...newArr[idx], ...cleanRecord };
                return newArr.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
              }
              return [cleanRecord, ...prev].sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
            });
          } else if (e.action === "delete") {
            setAttempts((prev) => prev.filter((a) => a.id !== e.record.id));
          }
        });

        if (!isSubscribed) {
          unsub();
        } else {
          currentUnsub = () => { unsub(); };
        }
      } catch (err) {
        console.error("Attempts subscription error:", err);
      }
    };

    startSubscribe();

    return () => {
      isSubscribed = false;
      if (currentUnsub) currentUnsub();
    };
  }, [pb]);

  // 4. Recalculate dashboard derived data whenever raw data or context variables change
  useEffect(() => {
    // A. Total Bank Soal
    setTotalExams(exams.length);

    // B. Total Ruang Ujian Aktif
    const active = rooms.filter((r: any) => r.status !== "archive").length;
    setActiveRooms(active);

    // C. Ongoing Students count
    const ongoingUnique = new Set();
    attempts.forEach((a: any) => {
      if (a.status === "ongoing") ongoingUnique.add(a.studentId || a.student_id);
    });
    setOngoingStudents(ongoingUnique.size);

    // D. Performa & Room Participation
    const mappedChart = rooms
      .filter((room: any) => room.status !== "archive")
      .map((room: any) => {
        const roomAttempts = attempts.filter(
          (a: any) => (a.examRoomId === room.id) || (a.exam_room_id === room.id)
        );
        const ongoingSet = new Set();
        const finishedSet = new Set();
        let totalScore = 0;
        let finishedCount = 0;

        roomAttempts.forEach((a: any) => {
          const sId = a.studentId || a.student_id;
          if (!sId) return;
          if (a.status === "ongoing") ongoingSet.add(sId);
          else if (["finished", "submitted", "graded"].includes(a.status)) {
            finishedSet.add(sId);
            totalScore += a.score || 0;
            finishedCount++;
          }
        });

        return {
          name: room.room_name || room.title || room.room_code || "Ruang",
          Mengerjakan: ongoingSet.size,
          Selesai: finishedSet.size,
          avgScore: finishedCount > 0 ? Math.round(totalScore / finishedCount) : 0,
          total: ongoingSet.size + finishedSet.size,
        };
      })
      .filter((r) => r.total > 0);

    setChartData(mappedChart);

    // E. Violations & Recent Activity
    const violations: any[] = [];
    const finished: any[] = [];

    attempts.forEach((a) => {
      const std = students.find((s) => s.id === (a.studentId || a.student_id));
      const exm = exams.find((e) => e.id === a.examId);
      const cls = classes.find((c) => c.id === std?.classId);

      if (a.status === "LOCKED" || (a.cheatCount || 0) > 0) {
        const room = rooms.find((r) => r.id === a.examRoomId || r.id === a.exam_room_id);
        violations.push({
          name: std?.name || terminology.student,
          className: cls?.name || "-",
          cheatCount: a.cheatCount || 0,
          cheatLimit: room?.cheat_limit || 0,
          status: a.status,
        });
      }

      if (["finished", "submitted", "graded"].includes(a.status)) {
        finished.push({
          name: std?.name || terminology.student,
          className: cls?.name || "-",
          score: a.score || 0,
          examTitle: exm?.title || "Ujian",
          time: new Date(a.updated).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        });
      }
    });

    setLogActivity({
      violations: violations.sort((a, b) => b.cheatCount - a.cheatCount),
      recentFinished: finished.slice(0, 10),
    });

    // F. Type Distribution
    const types: Record<string, number> = {};
    exams.forEach((e: any) => {
      const t = e.examType || e.examtype || "UMUM";
      types[t] = (types[t] || 0) + 1;
    });
    setTypeDistribution(Object.entries(types).map(([name, value]) => ({ name, value })));

    // G. Activity Trend
    const trendMap: Record<string, number> = {};
    attempts.slice(0, 50).reverse().forEach((a: any) => {
      const date = new Date(a.updated || a.created).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      trendMap[date] = (trendMap[date] || 0) + 1;
    });
    setActivityTrend(
      Object.entries(trendMap).slice(-10).map(([time, count]) => ({ time, count }))
    );
  }, [exams, rooms, attempts, students, classes, terminology]);

  const totalTeachers = teachers.length;
  const totalClasses = classes.length;
  const totalSubjects = subjects.length;
  const totalStudents = students.length;

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

  const capacityPercent = totalStudents > 0 ? Math.round((ongoingStudents / totalStudents) * 100) : 0;

  const overallAvgScore = chartData.length > 0
    ? Math.round(chartData.reduce((acc, curr) => acc + (curr.avgScore || 0), 0) / chartData.length)
    : 0;

  const tabs = [
    { id: "performa" as const, label: "Performa Ruang", icon: BarChart2 },
    { id: "pelanggaran" as const, label: "Pelanggaran Aktif", icon: AlertTriangle, count: logActivity.violations.length },
    { id: "selesai" as const, label: "Penyelesaian Terbaru", icon: CheckCircle2 },
  ];

  // ── Render Panel Header with Drag Handle & Reorder Controls ──
  const renderPanelHeader = (
    panelId: DashboardPanelId,
    title: string,
    subtitle?: string,
    rightContent?: React.ReactNode
  ) => {
    const currentIndex = panelOrder.indexOf(panelId);
    const canMoveUp = currentIndex > 0;
    const canMoveDown = currentIndex < panelOrder.length - 1;

    return (
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 select-none bg-slate-50/50 dark:bg-slate-800/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            title="Tahan dan geser untuk mengatur posisi panel"
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors flex-shrink-0"
          >
            <GripVertical size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate hidden sm:block">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {rightContent}
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => movePanel(panelId, "up")}
              disabled={!canMoveUp}
              title="Pindahkan panel ke atas"
              className={cn(
                "p-1 rounded-md text-slate-400 transition-colors",
                canMoveUp
                  ? "hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                  : "opacity-30 cursor-not-allowed"
              )}
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={() => movePanel(panelId, "down")}
              disabled={!canMoveDown}
              title="Pindahkan panel ke bawah"
              className={cn(
                "p-1 rounded-md text-slate-400 transition-colors",
                canMoveDown
                  ? "hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                  : "opacity-30 cursor-not-allowed"
              )}
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render Individual Panels ──

  // 1. KPI Panel (3 Metric Cards)
  const renderKPIsPanel = () => (
    <div className="p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            {/* Card 1: Siswa Sedang Ujian */}
            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700/60 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Users size={16} />
                  </div>
                  <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/40 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      Aktif
                    </span>
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-none tracking-tight">
                  {ongoingStudents.toLocaleString("id-ID")}
                </p>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  {terminology.student} Sedang Ujian
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-slate-400">Porsi siswa</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">{capacityPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Ruang Ujian Terbuka */}
            <div
              onClick={() => navigate("/admin/ruang-ujian")}
              className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700/60 transition-all flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <DoorOpen size={16} />
                  </div>
                  <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/40 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                      Sesi Buka
                    </span>
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-none tracking-tight">
                  {activeRooms.toLocaleString("id-ID")}
                </p>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  Ruang Ujian Terbuka
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">
                  dari {rooms.length} ruang
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-0.5 group-hover:underline">
                  Kelola <ChevronRight size={12} />
                </span>
              </div>
            </div>

            {/* Card 3: Bank Soal Terdaftar */}
            <div
              onClick={() => navigate("/admin/bank-soal")}
              className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700/60 transition-all flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <BookOpen size={16} />
                  </div>
                  <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-900/40 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                      Siap Uji
                    </span>
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-none tracking-tight">
                  {totalExams.toLocaleString("id-ID")}
                </p>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  Bank Soal Terdaftar
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">
                  {typeDistribution.length} variasi tipe
                </span>
                <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-0.5 group-hover:underline">
                  Buka Bank Soal <ChevronRight size={12} />
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // 2. Actions Panel (4 Quick Shortcuts)
  const renderActionsPanel = () => (
    <div className="p-4 sm:p-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={() => navigate("/admin/monitoring")}
          className="flex items-center justify-between p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 hover:border-blue-300 transition-all text-left group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Radio size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-950 dark:text-blue-100 truncate">Monitoring Sesi</p>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate">Pantau peserta aktif</p>
            </div>
          </div>
          <ArrowUpRight size={14} className="text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform flex-shrink-0 ml-1" />
        </button>

        <button
          onClick={() => navigate("/admin/ruang-ujian")}
          className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 transition-all text-left group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0">
              <DoorOpen size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">Ruang Ujian</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">Jadwal &amp; peserta</p>
            </div>
          </div>
          <ArrowUpRight size={14} className="text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform flex-shrink-0 ml-1" />
        </button>

        <button
          onClick={() => navigate("/admin/bank-soal")}
          className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 transition-all text-left group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0">
              <BookOpen size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">Bank Soal</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">Kelola butir soal</p>
            </div>
          </div>
          <ArrowUpRight size={14} className="text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform flex-shrink-0 ml-1" />
        </button>

        <button
          onClick={() => navigate("/admin/penilaian")}
          className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 transition-all text-left group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">Rekap Penilaian</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">Koreksi &amp; unduh hasil</p>
            </div>
          </div>
          <ArrowUpRight size={14} className="text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform flex-shrink-0 ml-1" />
        </button>
      </div>
    </div>
  );

  // 3. Live Intelligence Panel (Tabs: Performa, Pelanggaran, Selesai)
  const renderIntelligencePanel = () => (
    <div className="p-4 sm:p-5">
      {/* Tab Switcher */}
      <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 overflow-x-auto no-scrollbar mb-4">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeDashboardTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveDashboardTab(t.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
                isActive
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm border border-slate-200/60 dark:border-slate-600/40"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
              )}
            >
              <Icon size={13} className={isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400"} />
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full leading-none">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[260px]">
        {loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : chartData.length === 0 && activeDashboardTab === "performa" ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 gap-2.5 py-12">
            <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex items-center justify-center text-slate-400">
              <BarChart2 size={24} />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Belum Ada Data Ruangan Aktif
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-sm text-center">
              Mulai ruang ujian melalui menu Ruang Ujian untuk memantau performa peserta secara langsung.
            </p>
          </div>
        ) : (
          <div>
            {/* Tab 1: Performa */}
            {activeDashboardTab === "performa" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Rerata Nilai:</span>
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                      {overallAvgScore} Poin
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    {chartData.length} Ruangan Dievaluasi
                  </span>
                </div>

                <div className="h-60 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barScoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#2563EB" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke={isDark ? "#334155" : "#E2E8F0"}
                        opacity={isDark ? 0.4 : 0.6}
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        fontSize={10}
                        fontWeight={600}
                        stroke={isDark ? "#64748B" : "#94A3B8"}
                        dy={8}
                        tick={{ fill: isDark ? "#64748B" : "#94A3B8" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        fontSize={10}
                        fontWeight={600}
                        stroke={isDark ? "#64748B" : "#94A3B8"}
                        tick={{ fill: isDark ? "#64748B" : "#94A3B8" }}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[160px]">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <p className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">
                                  {data.name}
                                </p>
                              </div>
                              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-3">
                                <span className="text-slate-400 font-medium">Rerata Nilai:</span>
                                <span className="font-extrabold text-sm text-blue-600 dark:text-blue-400">
                                  {data.avgScore}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                                <span>Selesai:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {data.Selesai} siswa
                                </span>
                              </div>
                              {data.Mengerjakan > 0 && (
                                <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span>Mengerjakan:</span>
                                  <span className="font-semibold text-orange-500">
                                    {data.Mengerjakan} siswa
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        }}
                        cursor={{ fill: isDark ? "rgba(51, 65, 85, 0.35)" : "rgba(241, 245, 249, 0.75)", radius: 6 }}
                      />
                      <Bar
                        name="Rerata Nilai"
                        dataKey="avgScore"
                        fill="url(#barScoreGradient)"
                        radius={[6, 6, 0, 0]}
                        barSize={26}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tab 2: Pelanggaran */}
            {activeDashboardTab === "pelanggaran" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-red-500" />
                    <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                      Peserta Dalam Catatan Pelanggaran
                    </span>
                  </div>
                  <button
                    onClick={() => navigate("/admin/monitoring")}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    Buka Monitoring <ArrowUpRight size={12} />
                  </button>
                </div>

                {logActivity.violations.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/40">
                      <ShieldCheck size={22} />
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Kondisi Ujian Tertib &amp; Kondusif
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-sm">
                      Tidak ada peserta yang terdeteksi melakukan pelanggaran aktif.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {logActivity.violations.slice(0, 6).map((v: any, i: number) => {
                      const isLocked = v.status === "LOCKED" || (v.cheatLimit > 0 && v.cheatCount >= v.cheatLimit);
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all",
                            isLocked
                              ? "bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-900/40"
                              : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0",
                                isLocked
                                  ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                                  : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                              )}
                            >
                              {isLocked ? <Lock size={14} /> : v.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{v.name}</p>
                              <p className="text-[11px] text-slate-400 truncate">{v.className}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <span className={cn("text-sm font-extrabold", isLocked ? "text-red-600" : "text-amber-600")}>
                              {v.cheatCount}{v.cheatLimit > 0 ? `/${v.cheatLimit}` : ""}
                            </span>
                            <p className="text-[9px] text-slate-400 uppercase font-semibold">Pelanggaran</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Selesai */}
            {activeDashboardTab === "selesai" && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    Penyelesaian Terakhir
                  </span>
                  <button
                    onClick={() => navigate("/admin/penilaian")}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    Rekap Lengkap <ArrowUpRight size={12} />
                  </button>
                </div>

                {logActivity.recentFinished.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                      <Clock size={20} />
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Belum Ada Penyelesaian Baru</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-sm">
                      Peserta yang mengumpulkan lembar jawaban akan terdata otomatis di sini secara realtime.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logActivity.recentFinished.slice(0, 6).map((s: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{s.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{s.className} &bull; {s.examTitle}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0 ml-2">
                          <span
                            className={cn(
                              "text-xs font-extrabold px-2 py-0.5 rounded-md",
                              s.score >= 75
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40"
                                : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/40"
                            )}
                          >
                            {s.score}
                          </span>
                          <span className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                            <Clock size={9} /> {s.time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // 4. Analytics Panel (Side-by-side: Aktivitas Sesi + Distribusi Bank Soal)
  const renderAnalyticsPanel = () => (
    <div className="p-4 sm:p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kolom Kiri: Tren Aktivitas */}
        <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-blue-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Tren Aktivitas
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                <span>{activityTrend.reduce((sum, item) => sum + item.count, 0)} log/min</span>
                <RefreshCw size={11} className="text-emerald-500 animate-spin" style={{ animationDuration: "3s" }} />
              </div>
            </div>

            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityTrend} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorCountSimple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={isDark ? 0.35 : 0.25} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    hide={false}
                    axisLine={false}
                    tickLine={false}
                    fontSize={8}
                    fontWeight="bold"
                    stroke={isDark ? "#64748B" : "#94A3B8"}
                    interval="preserveStartEnd"
                    tick={{ fill: isDark ? "#64748B" : "#94A3B8" }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      return (
                        <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 py-1.5 shadow-xl text-xs space-y-0.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                          <p className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                            {payload[0].value} <span className="text-[10px] font-medium text-slate-400">Aktivitas</span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorCountSimple)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">Kapasitas Sesi:</span>
              <span className="font-extrabold text-slate-900 dark:text-white ml-1.5">{capacityPercent}%</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
              Kapasitas Aman
            </span>
          </div>
        </div>

        {/* Kolom Kanan: Distribusi Bank Soal */}
        <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-purple-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Distribusi Bank Soal
              </span>
            </div>
            <button
              onClick={() => navigate("/admin/bank-soal")}
              className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5"
            >
              Kelola <ChevronRight size={12} />
            </button>
          </div>

          <div className="flex items-center gap-3 py-1">
            <div className="h-28 w-28 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeDistribution.length > 0 ? typeDistribution : [{ name: "Kosong", value: 1 }]}
                    innerRadius={26}
                    outerRadius={44}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {(typeDistribution.length > 0 ? typeDistribution : [{ name: "Kosong", value: 1 }]).map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={typeDistribution.length > 0 ? COLORS[index % COLORS.length] : isDark ? "#334155" : "#E2E8F0"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0];
                      return (
                        <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-2.5 py-1.5 shadow-xl text-xs">
                          <p className="font-bold text-slate-800 dark:text-slate-100">{data.name}</p>
                          <p className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold mt-0.5">
                            {data.value} {data.name === "Kosong" ? "" : "paket soal"}
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              {typeDistribution.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">Belum ada paket soal</p>
              ) : (
                typeDistribution.slice(0, 4).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate">{item.name}</span>
                    <span className="text-[10px] font-bold text-slate-400 ml-auto flex-shrink-0">{item.value}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Total Paket Soal:</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200">{totalExams}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // 5. Master Data Panel (4 Entity Cards)
  const renderMasterDataPanel = () => (
    <div className="p-4 sm:p-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
        ) : (
          [
            {
              label: terminology.teacher,
              value: totalTeachers,
              icon: Users,
              color: "text-blue-600 dark:text-blue-400",
              bg: "bg-blue-50/60 dark:bg-blue-950/20",
              route: "/admin/teacher",
            },
            {
              label: terminology.class,
              value: totalClasses,
              icon: LayoutTemplate,
              color: "text-purple-600 dark:text-purple-400",
              bg: "bg-purple-50/60 dark:bg-purple-950/20",
              route: "/admin/classes",
            },
            {
              label: terminology.subject,
              value: totalSubjects,
              icon: BookOpen,
              color: "text-amber-600 dark:text-amber-400",
              bg: "bg-amber-50/60 dark:bg-amber-950/20",
              route: "/admin/subjects",
            },
            {
              label: terminology.student,
              value: totalStudents,
              icon: GraduationCap,
              color: "text-emerald-600 dark:text-emerald-400",
              bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
              route: "/admin/student",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => navigate(item.route)}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-blue-300 dark:hover:border-blue-700/60 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform", item.bg, item.color)}>
                  <item.icon size={17} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none truncate">
                    {item.label}
                  </p>
                  <p className="text-lg font-extrabold text-slate-900 dark:text-white mt-1 leading-none">
                    {item.value.toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Map panel definitions
  const panelRenderers: Record<
    DashboardPanelId,
    {
      title: string;
      subtitle: string;
      rightContent?: React.ReactNode;
      render: () => React.ReactNode;
    }
  > = {
    kpis: {
      title: "Ringkasan Indikator Sesi",
      subtitle: "Metrik utama peserta ujian, ruangan aktif, dan kesiapan bank soal",
      render: renderKPIsPanel,
    },
    actions: {
      title: "Aksi Operasional Cepat",
      subtitle: "Pintasan langsung ke modul pemantauan dan pengelolaan",
      render: renderActionsPanel,
    },
    intelligence: {
      title: "Live Intelligence & Pengawasan",
      subtitle: "Pantau performa nilai, catatan pelanggaran, dan penyelesaian lembar jawaban",
      render: renderIntelligencePanel,
    },
    analytics: {
      title: "Aktivitas & Distribusi Soal",
      subtitle: "Tren log realtime per menit dan sebaran kategori butir soal",
      render: renderAnalyticsPanel,
    },
    master_data: {
      title: "Master Data Entitas",
      subtitle: `${(totalStudents + totalTeachers + totalClasses + totalSubjects).toLocaleString("id-ID")} data terdaftar`,
      render: renderMasterDataPanel,
    },
  };

  return (
    <div className="space-y-4">
      {/* ── Page Header: Simpel & Clean ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
              Dashboard
            </h1>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 hidden sm:inline-block" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" /> {currentDateStr}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            {/* Realtime Pill */}
            <div className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/40 px-2.5 py-1 rounded-lg shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Realtime
            </div>

            {/* Plan Badge */}
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg">
              <span className="font-bold text-blue-600 dark:text-blue-400">{planName}</span>
              <span className="w-px h-3 bg-slate-300 dark:bg-slate-700" />
              <span>{quota.toLocaleString("id-ID")} {terminology.student}</span>
            </div>

            {/* Reset Panel Layout Button (if modified) */}
            {isCustomOrder && (
              <button
                onClick={resetPanelOrder}
                title="Kembalikan susunan panel ke posisi awal"
                className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg transition-colors"
              >
                <RotateCcw size={12} />
                <span className="hidden sm:inline">Reset Posisi</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Reorderable Panels (Drag and Drop) ── */}
      <div className="space-y-4">
        {panelOrder.map((panelId) => {
          const config = panelRenderers[panelId];
          if (!config) return null;

          const isBeingDragged = draggedPanel === panelId;
          const isDragOver = dragOverPanel === panelId && draggedPanel !== panelId;

          return (
            <div
              key={panelId}
              draggable
              onDragStart={(e) => handleDragStart(e, panelId)}
              onDragOver={(e) => handleDragOver(e, panelId)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, panelId)}
              onDragEnd={handleDragEnd}
              className={cn(
                "bg-white dark:bg-slate-900 border rounded-2xl shadow-sm transition-all duration-200 overflow-hidden",
                isBeingDragged
                  ? "opacity-40 scale-[0.99] border-dashed border-blue-400 dark:border-blue-600"
                  : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
                isDragOver && "ring-2 ring-blue-500/80 ring-offset-2 dark:ring-offset-slate-950 border-blue-500"
              )}
            >
              {renderPanelHeader(
                panelId,
                config.title,
                config.subtitle,
                config.rightContent
              )}
              {config.render()}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardPage;
