import { useEffect, useState } from "react";
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
} from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { Badge } from "../components/ui/badge";
import { useExamData } from "../context/ExamDataContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils";

const DashboardPage = () => {
  const { teachers, classes, subjects, students, loading: contextLoading } = useExamData();
  const { pb: tenantPb, school } = useTenant();
  const pb = tenantPb!;

  const planName = school?.plan ? school.plan.charAt(0).toUpperCase() + school.plan.slice(1) : "Free";
  const quota = school?.student_quota || 250;

  const [totalExams, setTotalExams] = useState(0);
  const [activeRooms, setActiveRooms] = useState(0);
  const [ongoingStudents, setOngoingStudents] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [typeDistribution, setTypeDistribution] = useState<any[]>([]);
  const [activityTrend, setActivityTrend] = useState<any[]>([]);
  const [localLoading, setLocalLoading] = useState(true);

  const [activeDashboardTab, setActiveDashboardTab] = useState<"performa" | "pelanggaran" | "selesai" | "mapel">("performa");
  const [subjectStats, setSubjectStats] = useState<any[]>([]);
  const [logActivity, setLogActivity] = useState<{
    violations: any[];
    recentFinished: any[];
  }>({ violations: [], recentFinished: [] });

  const loading = contextLoading || localLoading;

  useEffect(() => {
    const initDashboard = async () => {
      try {
        // 1. Total Bank Soal
        const examsData = await pb.collection("exams").getFullList();
        setTotalExams(examsData.length);

        // 2. Total Ruang Ujian Aktif
        const roomsData = await pb.collection("exam_rooms").getFullList();
        const active = roomsData.filter((r: any) => r.status !== "archive").length;
        setActiveRooms(active);

        // 3. Attempts
        const attemptsData = await pb.collection("attempts").getFullList({ sort: "-updated" });

        const ongoingUnique = new Set();
        attemptsData.forEach((a: any) => {
          if (a.status === "ongoing") ongoingUnique.add(a.studentId || a.student_id);
        });
        setOngoingStudents(ongoingUnique.size);

        // A. Performa & Room Participation
        const mappedChart = roomsData
          .filter((room: any) => room.status !== "archive")
          .map((room: any) => {
            const roomAttempts = attemptsData.filter(
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

        // B. Violations & Recent Activity
        const violations: any[] = [];
        const finished: any[] = [];

        attemptsData.forEach((a) => {
          const std = students.find((s) => s.id === (a.studentId || a.student_id));
          const exm = examsData.find((e) => e.id === a.examId);
          const cls = classes.find((c) => c.id === std?.classId);

          if (a.status === "LOCKED" || (a.cheatCount || 0) > 0) {
            const room = roomsData.find((r) => r.id === a.examRoomId);
            violations.push({
              name: std?.name || "Siswa",
              className: cls?.name || "-",
              cheatCount: a.cheatCount || 0,
              cheatLimit: room?.cheat_limit || 0,
              status: a.status,
            });
          }

          if (["finished", "submitted", "graded"].includes(a.status)) {
            finished.push({
              name: std?.name || "Siswa",
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

        // C. Subject Stats
        const subMap: Record<string, { total: number; count: number }> = {};
        examsData.forEach((e) => {
          const sub = subjects.find((s) => s.id === e.subjectId);
          if (!sub) return;
          const relatedAttempts = attemptsData.filter((a) => a.examId === e.id && (a.score || 0) > 0);
          relatedAttempts.forEach((ra) => {
            if (!subMap[sub.name]) subMap[sub.name] = { total: 0, count: 0 };
            subMap[sub.name].total += ra.score;
            subMap[sub.name].count++;
          });
        });
        setSubjectStats(
          Object.entries(subMap)
            .map(([name, data]) => ({ name, avgScore: Math.round(data.total / data.count) }))
            .sort((a, b) => b.avgScore - a.avgScore)
        );

        // D. Type Distribution
        const types: Record<string, number> = {};
        examsData.forEach((e: any) => {
          const t = e.examType || e.examtype || "UMUM";
          types[t] = (types[t] || 0) + 1;
        });
        setTypeDistribution(Object.entries(types).map(([name, value]) => ({ name, value })));

        // E. Activity Trend
        const trendMap: Record<string, number> = {};
        attemptsData.slice(0, 50).reverse().forEach((a: any) => {
          const date = new Date(a.updated || a.created).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          });
          trendMap[date] = (trendMap[date] || 0) + 1;
        });
        setActivityTrend(
          Object.entries(trendMap).slice(-10).map(([time, count]) => ({ time, count }))
        );
      } catch (e) {
        console.error("Dashboard init error:", e);
      } finally {
        setLocalLoading(false);
      }
    };

    initDashboard();

    const unsubExams = pb.collection("exams").subscribe("*", initDashboard);
    const unsubRooms = pb.collection("exam_rooms").subscribe("*", initDashboard);
    const unsubAttempts = pb.collection("attempts").subscribe("*", initDashboard);

    return () => {
      unsubExams.then((u: any) => u());
      unsubRooms.then((u: any) => u());
      unsubAttempts.then((u: any) => u());
    };
  }, [students, classes, subjects]);

  const totalTeachers = teachers.length;
  const totalClasses = classes.length;
  const totalSubjects = subjects.length;
  const totalStudents = students.length;

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

  const capacityPercent = totalStudents > 0 ? Math.round((ongoingStudents / totalStudents) * 100) : 0;

  const tabs = [
    { id: "performa" as const, label: "Performa" },
    { id: "pelanggaran" as const, label: "Pelanggaran" },
    { id: "selesai" as const, label: "Terbaru" },
    { id: "mapel" as const, label: "Mapel" },
  ];

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30 flex-shrink-0">
            <LayoutTemplate size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-none tracking-tight">
              Console Admin
            </h1>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
              Sistem Informasi &amp; Manajemen Ujian
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-full">
            <span className="font-bold text-blue-600">{planName}</span>
            <span className="w-px h-3 bg-slate-300" />
            {quota.toLocaleString("id-ID")} Siswa
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30 px-3 py-1.5 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live
          </div>
        </div>
      </div>

      {/* ── Live Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))
        ) : (
          <>
            {/* Siswa sedang ujian */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-orange-200 dark:hover:border-orange-800 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users size={18} className="text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-[10px] font-bold bg-orange-500 text-white px-2 py-0.5 rounded-full uppercase shadow-sm shadow-orange-300/50">
                  Live
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">
                {ongoingStudents}
              </p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-1.5">
                Siswa Sedang Ujian
              </p>
            </div>

            {/* Ruang ujian aktif */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle2 size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-full uppercase">
                  Session
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">
                {activeRooms}
              </p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-1.5">
                Ruang Ujian Terbuka
              </p>
            </div>

            {/* Bank soal */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen size={18} className="text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/40 px-2 py-0.5 rounded-full uppercase">
                  Repository
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">
                {totalExams}
              </p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-1.5">
                Bank Soal Terdaftar
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Main Content: Intelligence + Side Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Intelligence Panel */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {/* Card header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <div className="w-1 h-5 bg-blue-600 rounded-full" />
              Live Intelligence
            </h3>
            {/* Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-0.5 overflow-x-auto no-scrollbar">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveDashboardTab(t.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                    activeDashboardTab === t.id
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Card body */}
          <div className="p-5 flex-1 min-h-[300px] sm:min-h-[360px]">
            {loading ? (
              <Skeleton className="h-full w-full rounded-xl min-h-[260px]" />
            ) : chartData.length === 0 && activeDashboardTab === "performa" ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-3 py-16">
                <BarChart2 size={40} strokeWidth={1.5} />
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Belum ada data ruang
                </p>
              </div>
            ) : (
              <div className="h-full">
                {/* Performa */}
                {activeDashboardTab === "performa" && (
                  <div className="h-72 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.6} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontWeight={600} stroke="#94A3B8" dy={8} tick={{ fill: "#94A3B8" }} />
                        <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight={600} tick={{ fill: "#94A3B8" }} />
                        <Tooltip
                          contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", padding: "10px 14px", fontSize: "12px" }}
                          cursor={{ fill: "#F8FAFC" }}
                        />
                        <Bar name="Rerata Nilai" dataKey="avgScore" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Pelanggaran */}
                {activeDashboardTab === "pelanggaran" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle size={14} className="text-red-500" />
                      <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest">
                        Peserta Dalam Pelanggaran
                      </p>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    </div>
                    {logActivity.violations.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs font-medium">
                        ✓ Tidak ada pelanggaran aktif saat ini.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {logActivity.violations.slice(0, 6).map((v: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 font-bold text-sm flex-shrink-0">
                                {v.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{v.name}</p>
                                <p className="text-[10px] text-red-500 font-semibold truncate">{v.className}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <p className="text-sm font-bold text-red-600">
                                {v.cheatCount}<span className="text-red-400">/{v.cheatLimit}</span>
                              </p>
                              <p className="text-[9px] text-slate-400 font-medium">pelanggaran</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Terbaru */}
                {activeDashboardTab === "selesai" && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-3">
                      Penyelesaian Terakhir
                    </p>
                    {logActivity.recentFinished.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs font-medium">
                        Belum ada siswa yang selesai.
                      </div>
                    ) : (
                      logActivity.recentFinished.slice(0, 6).map((s: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 hover:border-emerald-200 dark:hover:border-emerald-800/40 transition-all group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                              <CheckCircle2 size={14} className="text-emerald-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {s.name}
                                <span className="text-[10px] font-medium text-slate-400 ml-1.5">({s.className})</span>
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">{s.examTitle}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0 ml-3">
                            <span className="text-base font-bold text-slate-900 dark:text-white leading-none">{s.score}</span>
                            <span className="text-[9px] text-slate-400 font-semibold mt-0.5">{s.time}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Mapel */}
                {activeDashboardTab === "mapel" && (
                  <div className="h-72 sm:h-80">
                    {subjectStats.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                        <BarChart2 size={40} strokeWidth={1.5} />
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Belum ada data nilai</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={subjectStats} layout="vertical" margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#E2E8F0" opacity={0.5} />
                          <XAxis type="number" axisLine={false} tickLine={false} fontSize={10} fontWeight={600} tick={{ fill: "#94A3B8" }} />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={9} fontWeight={600} tick={{ fill: "#64748B" }} width={90} />
                          <Tooltip
                            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", padding: "10px 14px" }}
                            cursor={{ fill: "#F8FAFC" }}
                          />
                          <Bar name="Rerata Skor" dataKey="avgScore" fill="#8B5CF6" radius={[0, 6, 6, 0]} barSize={18} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Activity Trend */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-blue-500" />
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Tren Aktivitas
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-blue-500">
                  {activityTrend.reduce((sum, item) => sum + item.count, 0)} log/min
                </span>
                <RefreshCw size={11} className="text-emerald-500 animate-spin" style={{ animationDuration: "3s" }} />
              </div>
            </div>

            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityTrend} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time" hide={false} axisLine={false} tickLine={false}
                    fontSize={8} fontWeight="bold" stroke="#94A3B8" interval="preserveStartEnd"
                    tick={{ fill: "#94A3B8" }}
                  />
                  <Tooltip
                    labelStyle={{ fontSize: "10px", fontWeight: "bold", color: "#64748B" }}
                    itemStyle={{ fontSize: "12px", fontWeight: "900", color: "#3B82F6" }}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                    formatter={(value) => [`${value} Aktivitas`, "Jumlah"]}
                  />
                  <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="px-5 pb-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{capacityPercent}%</p>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Kapasitas Terpakai</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", capacityPercent > 80 ? "bg-red-500" : "bg-emerald-500")}
                      style={{ width: `${capacityPercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                    Stabil
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Type Distribution */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <TrendingUp size={14} className="text-purple-500" />
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Distribusi Bank Soal
              </h3>
            </div>
            <div className="p-4 flex items-center gap-2">
              <div className="h-28 w-28 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeDistribution.length > 0 ? typeDistribution : [{ name: "Kosong", value: 1 }]}
                      innerRadius={28}
                      outerRadius={46}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {(typeDistribution.length > 0 ? typeDistribution : [{ name: "Kosong", value: 1 }]).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={typeDistribution.length > 0 ? COLORS[index % COLORS.length] : "#E2E8F0"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "10px", border: "none", fontSize: "11px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                {typeDistribution.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium">Belum ada soal</p>
                ) : typeDistribution.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate">{item.name}</span>
                    <span className="text-[10px] font-bold text-slate-400 ml-auto flex-shrink-0">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Master Data ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-3 mb-5">
          <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex-shrink-0">
            Master Data
          </h4>
          <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full flex-shrink-0">
            {(totalStudents + totalTeachers + totalClasses + totalSubjects).toLocaleString("id-ID")} Entitas
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          ) : (
            [
              { label: "Tenaga Pendidik", value: totalTeachers, icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-100 dark:border-blue-800/30" },
              { label: "Rombongan Belajar", value: totalClasses, icon: LayoutTemplate, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-100 dark:border-purple-800/30" },
              { label: "Mata Pelajaran", value: totalSubjects, icon: BookOpen, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-100 dark:border-amber-800/30" },
              { label: "Peserta Didik", value: totalStudents, icon: GraduationCap, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-100 dark:border-emerald-800/30" },
            ].map((item, idx) => (
              <div key={idx} className={cn("flex items-center gap-3 p-3.5 rounded-xl border group hover:shadow-sm transition-all", item.bg, item.border)}>
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform bg-white/60 dark:bg-slate-900/40", item.color)}>
                  <item.icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide leading-none truncate">
                    {item.label}
                  </p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 leading-none">
                    {item.value}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
