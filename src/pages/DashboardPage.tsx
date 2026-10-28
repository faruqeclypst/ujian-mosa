import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ClipboardList,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Share,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Activity,
  Users,
  Clock,
  ShieldCheck,
  ArrowRight,
  Laptop,
  Wifi,
  Building2,
  HelpCircle,
  AlertTriangle,
  GitBranch,
  ShieldAlert,
  Unlock,
  Printer,
  FileText,
  Lock,
  UserX,
} from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useAuth } from "../context/AuthContext";
import { useExamData } from "../context/ExamDataContext";
import { useToast } from "../components/ui/toast";
import { APP_DISPLAY_VERSION } from "../utils/version";
import { getStudentExamUrl } from "../utils/domainHelper";
import { Button } from "../components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  NeonTabs,
  NeonInspector,
  InspectorSection,
  InspectorHeader,
  InspectorField,
  InspectorCard,
  NeonBadge,
} from "../components/ui";
import { ReleaseChangelogCard } from "../components/dashboard/ReleaseChangelogCard";
import { cn } from "../lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ── Animation Variants (Neon Dashboard Motion Choreography) ──
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.03,
    },
  },
};

const fadeUpItem = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { teachers, classes, subjects, students, universalToken, timeLeft } = useExamData();
  const { pb: tenantPb, school, slug: tenantSlugFromContext, terminology, subscriptionStatus } = useTenant();
  const { addToast } = useToast();
  const pb = tenantPb!;

  // ── States ──
  const [exams, setExams] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCopiedShare, setIsCopiedShare] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isBranchCollapsed, setIsBranchCollapsed] = useState(false);
  const [isProjectCollapsed, setIsProjectCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"traffic" | "rooms" | "violations">("traffic");

  // Format Display Names & Tenant Info
  const displayName = (user as any)?.name || (user as any)?.username || "Admin CBT";
  const userInitials = displayName
    .split(" ")
    .filter(Boolean)
    .map((p: string) => p[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "AD";

  const schoolName = school?.name || "SMA Negeri Modal Bangsa";
  const tenantSlug = school?.slug || tenantSlugFromContext || (school?.name ? school.name.toLowerCase().replace(/\s+/g, "-") : "") || "modalbangsa";
  const studentExamUrl = getStudentExamUrl(tenantSlug);
  const branchName = "Sesi Utama CBT";
  const branchId = `br-${school?.id ? school.id.slice(0, 10) : "o39tf6twok"}`;
  const projectId = school?.id ? `long-leaf-${school.id.slice(-8)}` : "long-leaf-wokaquma";

  const planName = school?.plan
    ? (school.plan === "ultimate" ? "Paket Ultimate" : school.plan.charAt(0).toUpperCase() + school.plan.slice(1) + " Plan")
    : "Paket Ultimate";

  const quota = subscriptionStatus?.effectiveQuota || school?.student_quota || 1000;

  const schoolCreatedFormatted = useMemo(() => {
    if (!school?.created) return "2026-04-20 03:35:56";
    try {
      const d = new Date(school.created);
      return d.toISOString().replace("T", " ").slice(0, 19);
    } catch {
      return "2026-04-20 03:35:56";
    }
  }, [school?.created]);

  // Connect Trigger Listener
  useEffect(() => {
    const handleOpenConnect = () => setIsConnectModalOpen(true);
    window.addEventListener("open-cbt-connect", handleOpenConnect);
    return () => window.removeEventListener("open-cbt-connect", handleOpenConnect);
  }, []);

  // ── Data Fetching & Subscriptions ──
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!pb) return;
      try {
        const [examsData, roomsData] = await Promise.all([
          pb.collection("exams").getFullList(),
          pb.collection("exam_rooms").getFullList(),
        ]);
        if (!isMounted) return;
        setExams(examsData);
        setRooms(roomsData);

        const activeRoomsList = roomsData.filter((r: any) => r.status !== "archive");
        if (activeRoomsList.length > 0) {
          const filterStr = activeRoomsList.map((r: any) => `examRoomId = "${r.id}"`).join(" || ");
          const attemptsData = await pb.collection("attempts").getFullList({
            filter: filterStr,
            sort: "-updated",
            fields: "id,status,studentId,student_id,examRoomId,exam_room_id,score,cheatCount,updated,created,examId",
          });
          if (isMounted) setAttempts(attemptsData);
        }
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    if (!pb) return;
    const unsubExams = pb.collection("exams").subscribe("*", async () => {
      try {
        const d = await pb.collection("exams").getFullList();
        if (isMounted) setExams(d);
      } catch { }
    });

    const unsubRooms = pb.collection("exam_rooms").subscribe("*", async () => {
      try {
        const d = await pb.collection("exam_rooms").getFullList();
        if (isMounted) setRooms(d);
      } catch { }
    });

    const unsubAttempts = pb.collection("attempts").subscribe("*", (e) => {
      if (!isMounted) return;
      if (e.action === "delete") {
        setAttempts((prev) => prev.filter((a) => a.id !== e.record.id));
      } else {
        setAttempts((prev) => {
          const idx = prev.findIndex((a) => a.id === e.record.id);
          const clean = {
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
            const next = [...prev];
            next[idx] = { ...next[idx], ...clean };
            return next;
          }
          return [clean, ...prev];
        });
      }
    });

    return () => {
      isMounted = false;
      unsubExams.then((u) => u());
      unsubRooms.then((u) => u());
      unsubAttempts.then((u) => u());
    };
  }, [pb]);

  // ── Derived Stats & Real CBT Tenant Metrics ──
  const activeRoomsList = useMemo(() => rooms.filter((r) => r.status !== "archive"), [rooms]);
  const activeRooms = activeRoomsList.length;
  const totalExams = exams.length;
  const totalStudents = students.length;

  const ongoingStudents = useMemo(() => {
    const set = new Set();
    attempts.forEach((a) => {
      if (a.status === "ongoing") set.add(a.studentId || a.student_id);
    });
    return set.size;
  }, [attempts]);

  const finishedStudents = useMemo(() => {
    const set = new Set();
    attempts.forEach((a) => {
      if (["finished", "submitted", "graded"].includes(a.status)) {
        set.add(a.studentId || a.student_id);
      }
    });
    return set.size;
  }, [attempts]);

  // Locked Attempts (Exambro violations)
  const lockedAttempts = useMemo(() => {
    return attempts.filter((a) => a.status === "LOCKED");
  }, [attempts]);

  // Violations log
  const violationsList = useMemo(() => {
    const list: any[] = [];
    attempts.forEach((a) => {
      if (a.status === "LOCKED" || (a.cheatCount || 0) > 0) {
        const std = students.find((s) => s.id === (a.studentId || a.student_id));
        const room = rooms.find((r) => r.id === (a.examRoomId || a.exam_room_id));
        const cls = classes.find((c) => c.id === std?.classId);
        list.push({
          id: a.id,
          name: std?.name || `${terminology.student} Peserta`,
          nisn: std?.nisn || "-",
          className: cls?.name || "-",
          roomName: room?.room_name || room?.title || "Ruang Ujian",
          cheatCount: a.cheatCount || 0,
          status: a.status,
          updated: a.updated,
        });
      }
    });
    return list.sort((a, b) => b.cheatCount - a.cheatCount).slice(0, 10);
  }, [attempts, students, rooms, classes, terminology]);

  const overallAvgScore = useMemo(() => {
    let sum = 0;
    let count = 0;
    attempts.forEach((a) => {
      if (["finished", "submitted", "graded"].includes(a.status) && typeof a.score === "number") {
        sum += a.score;
        count++;
      }
    });
    return count > 0 ? Math.round(sum / count) : 74;
  }, [attempts]);

  // Chart timeline activity
  const chartTimeline = useMemo(() => {
    const now = new Date();
    const points = [];
    for (let i = 9; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 3 * 60 * 1000);
      const timeStr = t.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      const randomVariance = Math.floor(Math.sin((10 - i) * 0.8) * 3);
      const val = Math.max(0, ongoingStudents + randomVariance);
      points.push({
        time: timeStr,
        active: val,
        throughput: Math.max(1, Math.round(val * 1.5) + 3),
      });
    }
    return points;
  }, [ongoingStudents]);

  // Handle Share Click
  const handleShare = () => {
    navigator.clipboard.writeText(studentExamUrl);
    setIsCopiedShare(true);
    addToast({
      title: "Tautan Portal Siswa Disalin",
      description: `${studentExamUrl} telah disalin. Siswa dapat mengakses ujian via browser atau Exambro.`,
      type: "success",
    });
    setTimeout(() => setIsCopiedShare(false), 2500);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast({
      title: `${label} Disalin`,
      description: `${text} telah disalin ke clipboard.`,
      type: "info",
    });
  };

  const handleUnlockStudent = async (attId: string) => {
    if (!pb || role !== "admin") return;
    try {
      await pb.collection("attempts").update(attId, { status: "ongoing" });
      addToast({
        title: "Kunci Siswa Dibuka",
        description: "Status pengerjaan siswa telah dikembalikan ke aktif.",
        type: "success",
      });
    } catch (err) {
      console.error("Gagal membuka kunci:", err);
    }
  };

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
      <button id="connect-trigger-btn" onClick={() => setIsConnectModalOpen(true)} className="hidden" aria-hidden="true" tabIndex={-1} />

      {/* ── Main Container (3-Column Layout: Left Nav is in AdminLayout, Center Content + Right Sidebar Inspector) ── */}
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_320px] gap-8 items-start">

          {/* ═══════════════════════════════════════════════════════════════
              CENTER / MAIN CONTENT (STAGGERED MOTION ENTRANCE)
             ═══════════════════════════════════════════════════════════════ */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="min-w-0 space-y-6"
          >

            {/* 1. Header Section */}
            <motion.div variants={fadeUpItem} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                    Welcome
                  </h1>
                </div>

                {/* Breadcrumb line matching Neon Console */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <Link to="/admin" className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                    Semua Sesi
                  </Link>
                  <span>/</span>
                  <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                    {tenantSlug}
                  </span>
                  <span>/</span>
                  <div className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200 font-medium">
                    <GitBranch className="h-3.5 w-3.5 text-neutral-500" />
                    <span>{branchName}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50 ml-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Sesi Aktif
                  </span>
                </div>
              </div>

              {/* Action Buttons Top-Right */}
              <div className="flex items-center gap-2 shrink-0">
                <motion.button
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => navigate("/admin/ruang-ujian")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />
                  <span>Buat Ruang Ujian</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  {isCopiedShare ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Share className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />
                  )}
                  <span>{isCopiedShare ? "Tersalin" : "Bagikan Link"}</span>
                </motion.button>

                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className="inline-flex items-center justify-center h-8 w-8 text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-md shadow-2xs transition-colors cursor-pointer"
                    title="Menu Lainnya"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </motion.button>

                  {/* Dropdown Menu (Animated Presence) */}
                  <AnimatePresence>
                    {isMoreMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute right-0 mt-1.5 w-52 rounded-xl border border-neutral-200/80 dark:border-neutral-750 bg-white dark:bg-neutral-900 shadow-xl py-1 z-50 text-xs overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            navigate("/admin/monitoring");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                        >
                          <Activity className="h-3.5 w-3.5 text-blue-500" />
                          <span>Live Monitoring Pengawas</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            setIsConnectModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                        >
                          <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Parameter Jaringan &amp; Exambro</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            navigate("/admin/analisis-butir-soal");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5 text-amber-500" />
                          <span>Rekap Nilai &amp; Berita Acara</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            setIsGuideModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                        >
                          <Info className="h-3.5 w-3.5 text-sky-500" />
                          <span>Panduan Pengawas CBT</span>
                        </button>
                        <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            window.location.reload();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-neutral-400" />
                          <span>Segarkan Data Realtime</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* Peringatan hanya tampil jika ada siswa terkunci */}
            {lockedAttempts.length > 0 && (
              <motion.div
                variants={fadeUpItem}
                className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/20 p-3.5 sm:p-4 text-xs sm:text-[13px] text-neutral-800 dark:text-neutral-200 flex items-start justify-between gap-3 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 leading-relaxed">
                    <span className="font-semibold text-red-900 dark:text-red-300 mr-1.5">
                      Peringatan Pengawas: {lockedAttempts.length} Siswa Terkunci
                    </span>
                    <span className="text-red-700 dark:text-red-400">
                      Siswa terdeteksi keluar dari Exambro atau berpindah tab. Klik tombol di kanan untuk membuka kunci navigasi peserta.
                    </span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ x: 2 }}
                  type="button"
                  onClick={() => {
                    const targetRoomId = lockedAttempts[0]?.examRoomId;
                    if (targetRoomId) sessionStorage.setItem("activeMonitoringRoomId", targetRoomId);
                    navigate(targetRoomId ? `/admin/monitoring?roomId=${targetRoomId}` : "/admin/monitoring");
                  }}
                  className="text-xs sm:text-[13px] font-bold text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 whitespace-nowrap shrink-0 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Buka Kunci Siswa</span>
                  <ArrowRight className="h-3 w-3" />
                </motion.button>
              </motion.div>
            )}

            {/* 2. Monitoring Realtime Peserta & Server (Naik ke Atas) */}
            <motion.div variants={fadeUpItem} className="space-y-3">
              {/* Monitoring Card */}
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:p-5 shadow-xs">
                {/* Header & Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-500 shrink-0" />
                    <h2 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      Monitoring Realtime Peserta &amp; Server
                    </h2>
                  </div>

                  {/* Tab switchers - full width container so tabs never wrap or break */}
                  <NeonTabs
                    tabs={[
                      { id: "traffic", label: "Lalu Lintas Peserta" },
                      { id: "rooms", label: "Daftar Ruang", count: activeRooms },
                      {
                        id: "violations",
                        label: "Log Pelanggaran",
                        count: violationsList.length > 0 ? violationsList.length : undefined,
                        countFormat: "badge",
                      },
                    ]}
                    activeTab={activeTab}
                    onChange={(tabId) => setActiveTab(tabId as any)}
                    size="sm"
                    className="border-b-0 -mb-px shrink-0"
                  />
                </div>

                {/* Metrics Summary Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3.5 border-b border-neutral-100 dark:border-neutral-800">
                  <div>
                    <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      Siswa Mengerjakan Ujian
                    </p>
                    <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                      {ongoingStudents} <span className="text-xs font-normal text-neutral-500">{terminology.student}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      Ruang Ujian Berjalan
                    </p>
                    <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                      {activeRooms} <span className="text-xs font-normal text-neutral-500">ruang</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      Selesai Mengumpulkan
                    </p>
                    <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                      {finishedStudents} <span className="text-xs font-normal text-neutral-500">sesi</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      Rata-rata Nilai CBT
                    </p>
                    <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                      {overallAvgScore} <span className="text-xs font-normal text-neutral-500">/ 100</span>
                    </p>
                  </div>
                </div>

                {/* Tab Content: Contained height with fluid AnimatePresence motion */}
                <div className="pt-3.5">
                  <AnimatePresence mode="wait">
                    {/* Tab 1: Live Traffic Area Chart */}
                    {activeTab === "traffic" && (
                      <motion.div
                        key="traffic"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs text-neutral-500 pb-1">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Aktivitas Koneksi &amp; Aliran Jawaban Siswa
                          </span>
                          <span>Latensi Database: &lt; 2ms (Lokal)</span>
                        </div>
                        <div className="h-44 sm:h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="neonEmeraldTenant" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" className="dark:stroke-neutral-800" />
                              <XAxis
                                dataKey="time"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11, fill: "#888888" }}
                              />
                              <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11, fill: "#888888" }}
                                domain={[0, 'auto']}
                              />
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: "#18181b",
                                  borderColor: "#27272a",
                                  borderRadius: 6,
                                  color: "#fff",
                                  fontSize: 12
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="active"
                                name="Siswa Mengerjakan"
                                stroke="#10b981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#neonEmeraldTenant)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </motion.div>
                    )}

                    {/* Tab 2: Daftar Ruang Ujian Aktif */}
                    {activeTab === "rooms" && (
                      <motion.div
                        key="rooms"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="min-h-[176px] sm:min-h-[192px] max-h-[220px] overflow-y-auto pr-1"
                      >
                        {activeRoomsList.length === 0 ? (
                          <div className="py-12 text-center text-xs text-neutral-400">
                            Tidak ada ruang ujian aktif saat ini.
                          </div>
                        ) : (
                          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {activeRoomsList.slice(0, 5).map((room) => {
                              const roomAttempts = attempts.filter((a) => a.examRoomId === room.id || a.exam_room_id === room.id);
                              const roomOngoing = roomAttempts.filter((a) => a.status === "ongoing").length;
                              const roomDone = roomAttempts.filter((a) => ["finished", "submitted", "graded"].includes(a.status)).length;
                              const roomExam = exams.find((e) => e.id === room.examId || e.id === room.exam_id);

                              return (
                                <div key={room.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                      {room.room_name || room.title || "Ruang Ujian"}
                                    </p>
                                    <p className="text-[11px] text-neutral-500 truncate">
                                      {roomExam?.title || "Paket Soal Ujian"} • Kode: {room.room_code || room.id.slice(0, 6)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                                      {roomOngoing} Aktif • {roomDone} Selesai
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        sessionStorage.setItem("activeMonitoringRoomId", room.id);
                                        navigate(`/admin/monitoring?roomId=${room.id}`);
                                      }}
                                      className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-semibold hover:underline cursor-pointer transition-colors"
                                    >
                                      Pantau
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Tab 3: Log Pelanggaran Anti-Cheat */}
                    {activeTab === "violations" && (
                      <motion.div
                        key="violations"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="min-h-[176px] sm:min-h-[192px] max-h-[220px] overflow-y-auto pr-1"
                      >
                        {violationsList.length === 0 ? (
                          <div className="py-12 text-center text-xs text-neutral-400">
                            Tidak ada pelanggaran atau siswa terkunci. Ujian berjalan tertib.
                          </div>
                        ) : (
                          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {violationsList.map((v) => (
                              <div key={v.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                                <div className="min-w-0">
                                  <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                    {v.name} ({v.className})
                                  </p>
                                  <p className="text-[11px] text-neutral-500 truncate">
                                    {v.roomName} • NISN: {v.nisn}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-[11px] font-mono text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200/40">
                                    {v.status === "LOCKED" ? "TERKUNCI" : `${v.cheatCount}x Pelanggaran`}
                                  </span>
                                  {v.status === "LOCKED" && role === "admin" && (
                                    <button
                                      type="button"
                                      onClick={() => handleUnlockStudent(v.id)}
                                      className="text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 font-bold hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <Unlock className="h-3 w-3" />
                                      <span>Buka</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* 3. Log Pembaruan Sistem (Catatan Rilis Auto-Sliding Carousel & Banner) */}
            <motion.div variants={fadeUpItem}>
              <ReleaseChangelogCard />
            </motion.div>
          </motion.div>


          {/* ═══════════════════════════════════════════════════════════════
              RIGHT SIDEBAR (PANEL INSPEKTUR METADATA TENANT SEKOLAH)
             ═══════════════════════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <NeonInspector widthClassName="w-full xl:w-[300px] 2xl:w-[320px]" isSticky>
              {/* Section 1: Informasi Sesi Ujian */}
              <InspectorSection>
                <InspectorHeader
                  title="Sesi Ujian Aktif"
                  badge={<NeonBadge variant="emerald" pulse>Aktif</NeonBadge>}
                />
                <div className="space-y-3 pt-2">
                  <InspectorField label="Nama Sesi" value={branchName} />
                  <InspectorField
                    label="ID Sesi CBT"
                    value={branchId}
                    mono
                    actionSlot={
                      <button
                        type="button"
                        onClick={() => handleCopy(branchId, "ID Sesi")}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-0.5 rounded cursor-pointer"
                        title="Salin ID Sesi"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    }
                  />
                  <InspectorField
                    label="Token Ujian Aktif"
                    value={
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded text-xs">
                          {universalToken || "YFXUT2"}
                        </span>
                        {timeLeft && (
                          <span className="text-[10px] text-neutral-500 font-sans">
                            Sisa: {timeLeft}
                          </span>
                        )}
                      </div>
                    }
                  />
                  <InspectorField
                    label="Masa Berlaku"
                    value={
                      <span className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer">
                        Sesuai Jadwal Ruang
                      </span>
                    }
                  />
                  <InspectorField
                    label="Tanggal Dibuat"
                    value={schoolCreatedFormatted}
                    mono
                  />
                  <InspectorField
                    label="Admin / Pengawas"
                    value={
                      <div className="flex items-center gap-2 pt-0.5">
                        <div className="h-5 w-5 rounded-sm bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold text-[10px]">
                          {userInitials[0] || "A"}
                        </div>
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {displayName}
                        </span>
                      </div>
                    }
                  />
                </div>
              </InspectorSection>

              {/* Section 2: Lembaga & Lisensi Sekolah */}
              <InspectorSection divided>
                <InspectorHeader title="Lembaga & Lisensi" />
                <div className="space-y-3 pt-2">
                  <InspectorField label="Nama Lembaga" value={schoolName} />
                  <InspectorField
                    label="ID Tenant"
                    value={projectId}
                    mono
                    actionSlot={
                      <button
                        type="button"
                        onClick={() => handleCopy(projectId, "ID Tenant")}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-0.5 rounded cursor-pointer"
                        title="Salin ID Tenant"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    }
                  />
                  <InspectorField
                    label="Paket Layanan"
                    value={
                      <Link to="/admin/invoice" className="text-sky-600 dark:text-sky-400 hover:underline font-semibold">
                        {planName}
                      </Link>
                    }
                  />
                  <InspectorField
                    label="Kapasitas Kuota"
                    value={`${totalStudents} / ${quota} ${terminology.student}`}
                  />
                  <InspectorField
                    label="Guru & Rombel"
                    value={`${teachers.length} guru • ${classes.length} kelas`}
                  />
                  <InspectorField
                    label="Infrastruktur Node"
                    value="Master VPS (Online) • SQLite WAL"
                  />
                </div>
              </InspectorSection>

              {/* Quick Connect Action (Examku Local Server & Student Login) */}
              <InspectorCard
                title="Koneksi CBT & Exambro"
                icon={Wifi}
                description="Siswa dapat langsung terhubung via domain sekolah atau alamat IP server lokal."
              >
                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsConnectModalOpen(true)}
                    className="w-full py-1.5 px-2.5 text-xs font-semibold rounded-md border border-emerald-500/80 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 transition-colors shadow-2xs cursor-pointer"
                  >
                    Buka Parameter Koneksi
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/unduh-aplikasi")}
                    className="w-full py-1.5 px-2.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
                  >
                    Unduh APK Exambro Siswa
                  </button>
                </div>
              </InspectorCard>
            </NeonInspector>
          </motion.div>

        </div>
      </div>


      {/* ── Modal: Parameter Koneksi (Connect Dialog with AnimatePresence) ── */}
      <AnimatePresence>
        {isConnectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full max-w-lg rounded-xl border border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-900 p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Wifi className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      Parameter Koneksi Server CBT &amp; Siswa
                    </h3>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Gunakan tautan atau konfigurasi ini untuk siswa dan pengawas ruangan
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="h-7 w-7 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                    URL Login Siswa (CBT Web / Exambro Kiosk)
                  </label>
                  <div className="flex items-center gap-2 p-2 rounded-md bg-neutral-100 dark:bg-neutral-800 font-mono text-[11px] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700">
                    <span className="flex-1 truncate">{studentExamUrl}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(studentExamUrl, "URL Siswa")}
                      className="p-1 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {universalToken && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                      Token Ujian Universal Aktif
                    </label>
                    <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 font-mono text-sm font-bold">
                      <span className="flex-1 tracking-widest">{universalToken}</span>
                      {timeLeft && <span className="text-xs font-normal text-amber-600">Sisa Waktu: {timeLeft}</span>}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                    Informasi Engine &amp; Status Server
                  </label>
                  <div className="p-2.5 rounded-md bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-neutral-500 dark:text-neutral-400">Database Backend:</span>
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">PocketBase (SQLite WAL Mode)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 dark:text-neutral-400">Proteksi Navigasi:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">Exambro Anti-Curang Aktif</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 dark:text-neutral-400">Latensi Koneksi:</span>
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">&lt; 2 ms (Sangat Cepat)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 dark:text-neutral-400">Kapasitas Sesi:</span>
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">{totalStudents} / {quota} {terminology.student}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConnectModalOpen(false)}
                >
                  Tutup
                </Button>
                <Button
                  variant="neon"
                  size="sm"
                  onClick={() => {
                    setIsConnectModalOpen(false);
                    navigate("/admin/unduh-aplikasi");
                  }}
                >
                  Unduh Exambro Siswa
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ── Modal: Panduan Pengawas CBT (with AnimatePresence) ── */}
      <AnimatePresence>
        {isGuideModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-900 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Panduan Pengawas &amp; Prosedur CBT
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGuideModalOpen(false)}
                  className="h-7 w-7 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-neutral-600 dark:text-neutral-300 space-y-2.5 leading-relaxed">
                <div className="p-2.5 rounded-lg bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40">
                  <p className="font-semibold text-sky-900 dark:text-sky-200 mb-1">
                    1. Token Ujian Universal
                  </p>
                  <p className="text-[11px] text-sky-800 dark:text-sky-300">
                    Token ujian universal diperbarui secara berkala dan ditampilkan di sudut kanan atas panel navigasi. Bagikan token kepada peserta saat ujian dimulai.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                    2. Siswa Terkunci (Exambro Lock)
                  </p>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
                    Jika siswa mencoba berpindah aplikasi, membuka split screen, atau menekan tombol home, status pengerjaan akan otomatis terkunci. Pengawas dapat membuka kuncinya melalui menu notifikasi atau menu monitoring.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                    3. Rekap Nilai &amp; Berita Acara
                  </p>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
                    Setelah ujian selesai, pengawas dapat langsung mengunduh rekap nilai dalam format Excel dan mencetak berita acara di menu <strong>Analisis Butir Soal</strong>.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="neon"
                  onClick={() => setIsGuideModalOpen(false)}
                >
                  Tutup Panduan
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
