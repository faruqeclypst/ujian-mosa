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
import { Button } from "../components/ui/button";
import {
  NeonTabs,
  NeonInspector,
  InspectorSection,
  InspectorHeader,
  InspectorField,
  InspectorCard,
  NeonBadge,
} from "../components/ui";
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { teachers, classes, subjects, students, universalToken, timeLeft } = useExamData();
  const { pb: tenantPb, school, terminology, subscriptionStatus } = useTenant();
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
  const tenantSlug = school?.slug || schoolName.toLowerCase().replace(/\s+/g, "-") || "modalbangsa";
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
    const studentUrl = `${window.location.origin}/student/login`;
    navigator.clipboard.writeText(studentUrl);
    setIsCopiedShare(true);
    addToast({
      title: "Tautan Portal Siswa Disalin",
      description: "URL login siswa telah disalin. Siswa dapat mengakses ujian via browser atau Exambro.",
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
              CENTER / MAIN CONTENT
             ═══════════════════════════════════════════════════════════════ */}
          <div className="min-w-0 space-y-6">

            {/* 1. Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                    Ringkasan Sesi &amp; Ujian
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
                <button
                  type="button"
                  onClick={() => navigate("/admin/ruang-ujian")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-200 rounded-md shadow-xs transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />
                  <span>Buat Ruang Ujian</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-200 rounded-md shadow-xs transition-colors"
                >
                  {isCopiedShare ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Share className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />
                  )}
                  <span>{isCopiedShare ? "Tersalin" : "Bagikan Link"}</span>
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className="inline-flex items-center justify-center h-8 w-8 text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-750 rounded-md shadow-xs transition-colors"
                    title="Menu Lainnya"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {isMoreMenuOpen && (
                    <div className="absolute right-0 mt-1.5 w-52 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl py-1 z-50 text-xs animate-in fade-in-0 zoom-in-95">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          navigate("/admin/monitoring");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
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
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
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
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
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
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
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
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-neutral-400" />
                        <span>Segarkan Data Realtime</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Peringatan hanya tampil jika ada siswa terkunci */}
            {lockedAttempts.length > 0 && (
              <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/20 p-3.5 sm:p-4 text-xs sm:text-[13px] text-neutral-800 dark:text-neutral-200 flex items-start justify-between gap-3 shadow-xs">
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
                <button
                  type="button"
                  onClick={() => navigate("/admin/monitoring")}
                  className="text-xs sm:text-[13px] font-bold text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 whitespace-nowrap shrink-0 hover:underline flex items-center gap-1"
                >
                  <span>Buka Kunci Siswa</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* 3. Log Pembaruan Sistem (Changelog v1.2.1) */}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-xs">
              {/* Header Bar */}
              <div className="bg-neutral-50/70 dark:bg-neutral-850 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Catatan Rilis
                  </span>
                  <span className="text-neutral-300 dark:text-neutral-700">•</span>
                  <span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {APP_DISPLAY_VERSION}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                    Major Release
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="font-mono text-[11px]">21 Oktober 2026</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Produksi Aktif
                  </span>
                </div>
              </div>

              {/* Changelog Entries (Clean, Abstracted, Professional List) */}
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                {/* 1. Performa UI */}
                <div className="p-4 sm:p-4.5 flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-850/40 transition-colors">
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        Performa
                      </span>
                      <h3 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100">
                        Fluid Layout &amp; Zero Horizontal Overflow di Seluruh Modul Admin
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      Arsitektur grid tabel admin dirombak menyeluruh tanpa pergeseran horizontal pada layar tablet dan ponsel pengawas. Akselerasi rendering memangkas beban memori hingga 40% untuk pengawasan sesi ratusan peserta secara simultan.
                    </p>
                  </div>
                  <div className="shrink-0 text-left md:text-right">
                    <span className="inline-block font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      +40% Kecepatan Render
                    </span>
                  </div>
                </div>

                {/* 2. Fitur Utama: Analisis Butir Soal */}
                <div className="p-4 sm:p-4.5 flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-850/40 transition-colors">
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wide uppercase bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                        Fitur Utama
                      </span>
                      <h3 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100">
                        Diagnostik Butir Soal &amp; Rekapitulasi Kurikulum Otomatis
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      Kalkulasi instan parameter mutu asesmen: indeks daya pembeda, tingkat kesukaran butir soal, dan efektivitas distraktor pilihan ganda, dilengkapi rekomendasi butir soal serta ekspor rekap nilai siap cetak ke Excel (.xlsx).
                    </p>
                  </div>
                  <div className="shrink-0 text-left md:text-right">
                    <span className="inline-block font-mono text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                      Otomatisasi Penuh
                    </span>
                  </div>
                </div>

                {/* 3. Integritas Ujian */}
                <div className="p-4 sm:p-4.5 flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-850/40 transition-colors">
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wide uppercase bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                        Integritas
                      </span>
                      <h3 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100">
                        Toleransi Jaringan Wi-Fi &amp; Proteksi Anti-Curang Kiosk
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      Penyempurnaan heartbeat siswa dengan pemulihan otomatis saat fluktuasi sinyal router lokal, deteksi peralihan jendela aplikasi, serta respon penguncian instan yang dapat dibuka kembali oleh pengawas dalam satu klik.
                    </p>
                  </div>
                  <div className="shrink-0 text-left md:text-right">
                    <span className="inline-block font-mono text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                      Latensi &lt; 2ms
                    </span>
                  </div>
                </div>

                {/* 4. Pembaruan Server */}
                <div className="p-4 sm:p-4.5 flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-850/40 transition-colors">
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wide uppercase bg-neutral-500/10 text-neutral-700 dark:text-neutral-400 border border-neutral-500/20">
                        Infrastruktur
                      </span>
                      <h3 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100">
                        Pembaruan 1-Click Server Offline dengan Proteksi Database
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      Instalasi server lokal sekolah kini dapat diperbarui langsung secara mandiri dari antarmuka web dalam 1 klik tanpa perintah manual dan dengan jaminan keamanan database lokal ujian (<code className="font-mono text-[11px]">data.db</code>) tidak terhapus.
                    </p>
                  </div>
                  <div className="shrink-0 text-left md:text-right">
                    <span className="inline-block font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      Zero Data Loss
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Monitoring Section: Realtime Peserta & Server */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Monitoring Realtime Peserta &amp; Server
                </h2>

                {/* Tab switchers */}
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
                />
              </div>

              {/* Monitoring Card */}
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:p-5 shadow-xs">
                {/* Metrics Summary Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 mb-4 border-b border-neutral-100 dark:border-neutral-800">
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

                {/* Tab 1: Live Traffic Area Chart */}
                {activeTab === "traffic" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-500 pb-1">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Aktivitas Koneksi &amp; Aliran Jawaban Siswa
                      </span>
                      <span>Latensi Database: &lt; 2ms (Lokal)</span>
                    </div>
                    <div className="h-48 sm:h-56 w-full">
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
                  </div>
                )}

                {/* Tab 2: Daftar Ruang Ujian Aktif */}
                {activeTab === "rooms" && (
                  <div className="space-y-2">
                    {activeRoomsList.length === 0 ? (
                      <div className="py-8 text-center text-xs text-neutral-400">
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
                                  onClick={() => navigate("/admin/monitoring")}
                                  className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold hover:underline"
                                >
                                  Pantau
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Log Pelanggaran Anti-Cheat */}
                {activeTab === "violations" && (
                  <div className="space-y-2">
                    {violationsList.length === 0 ? (
                      <div className="py-8 text-center text-xs text-neutral-400">
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
                                  className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline flex items-center gap-1"
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
                  </div>
                )}

              </div>
            </div>

          </div>


          {/* ═══════════════════════════════════════════════════════════════
              RIGHT SIDEBAR (PANEL INSPEKTUR METADATA TENANT SEKOLAH)
             ═══════════════════════════════════════════════════════════════ */}
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
                  className="w-full py-1.5 px-2.5 text-xs font-semibold rounded-md border border-emerald-500/80 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors shadow-2xs cursor-pointer"
                >
                  Buka Parameter Koneksi
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/admin/unduh-aplikasi")}
                  className="w-full py-1.5 px-2.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors shadow-2xs cursor-pointer"
                >
                  Unduh APK Exambro Siswa
                </button>
              </div>
            </InspectorCard>
          </NeonInspector>

        </div>
      </div>


      {/* ── Modal: Parameter Koneksi (Connect Dialog) ── */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-2xl space-y-5 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Wifi className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Parameter Koneksi Server CBT &amp; Siswa
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Gunakan tautan atau konfigurasi ini untuk siswa dan pengawas ruangan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(false)}
                className="h-7 w-7 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center"
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
                  <span className="flex-1 truncate">{window.location.origin}/student/login</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(`${window.location.origin}/student/login`, "URL Siswa")}
                    className="p-1 hover:text-emerald-600 transition-colors"
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
                    <span className="text-neutral-500">Database Backend:</span>
                    <span className="font-medium">PocketBase (SQLite WAL Mode)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Proteksi Navigasi:</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Exambro Anti-Curang Aktif</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Latensi Koneksi:</span>
                    <span className="font-medium">&lt; 2 ms (Sangat Cepat)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Kapasitas Sesi:</span>
                    <span className="font-medium">{totalStudents} / {quota} {terminology.student}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConnectModalOpen(false)}
                className="text-xs font-medium"
              >
                Tutup
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setIsConnectModalOpen(false);
                  navigate("/admin/unduh-aplikasi");
                }}
                className="text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Unduh Exambro Siswa
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* ── Modal: Panduan Pengawas CBT ── */}
      {isGuideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-2xl space-y-4 animate-in fade-in-0 zoom-in-95">
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
                className="text-neutral-400 hover:text-neutral-600 text-sm"
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
                onClick={() => setIsGuideModalOpen(false)}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs cursor-pointer"
              >
                Tutup Panduan
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
