import { useEffect, useState } from "react";
import {
  Users,
  LayoutTemplate,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  RefreshCw
} from "lucide-react";
import pb from "../lib/pocketbase";

import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useExamData } from "../context/ExamDataContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  AreaChart, Area, PieChart, Pie, Cell
} from "recharts";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils";

const DashboardPage = () => {
  const { teachers, classes, subjects, students, loading: contextLoading } = useExamData();

  const [totalExams, setTotalExams] = useState(0);
  const [activeRooms, setActiveRooms] = useState(0);
  const [ongoingStudents, setOngoingStudents] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [typeDistribution, setTypeDistribution] = useState<any[]>([]);
  const [activityTrend, setActivityTrend] = useState<any[]>([]);
  const [localLoading, setLocalLoading] = useState(true);

  const loading = contextLoading || localLoading;

  useEffect(() => {
    const initDashboard = async () => {
      try {
        // 1. Total Bank Soal (Ujian)
        const examsData = await pb.collection('exams').getFullList();
        setTotalExams(examsData.length);

        // 2. Total Ruang Ujian Aktif & Chart Builders
        const roomsData = await pb.collection('exam_rooms').getFullList();
        const active = roomsData.filter((r: any) => r.status !== "archive").length;
        setActiveRooms(active);

        // 3. fetch Attempts
        const attemptsData = await pb.collection('attempts').getFullList();

        // Compute unique ongoing students globally
        const ongoingUnique = new Set();
        attemptsData.forEach((a: any) => {
          if (a.status === "ongoing") {
            ongoingUnique.add(a.studentId || a.student_id);
          }
        });
        setOngoingStudents(ongoingUnique.size);

        // Compute chart data
        const mappedChart = roomsData
          .filter((room: any) => room.status !== "archive")
          .map((room: any) => {
            const roomAttempts = attemptsData.filter((a: any) => (a.examRoomId === room.id) || (a.exam_room_id === room.id));

            const ongoingSet = new Set();
            const finishedSet = new Set();

            roomAttempts.forEach((a: any) => {
              const sId = a.studentId || a.student_id;
              if (!sId) return;

              if (a.status === "ongoing") ongoingSet.add(sId);
              else if (["finished", "submitted", "graded"].includes(a.status)) finishedSet.add(sId);
            });

            return {
              name: room.room_name || room.room_code || "Ruang",
              Mengerjakan: ongoingSet.size,
              Selesai: finishedSet.size,
              total: ongoingSet.size + finishedSet.size
            }
          })
          .filter(r => r.total > 0);

        setChartData(mappedChart);

        // 4. Type Distribution
        const types: Record<string, number> = {};
        examsData.forEach((e: any) => {
          const t = e.examType || e.examtype || "UMUM";
          types[t] = (types[t] || 0) + 1;
        });
        setTypeDistribution(Object.entries(types).map(([name, value]) => ({ name, value })));

        // 5. Activity Trend
        const trendMap: Record<string, number> = {};
        attemptsData.slice(-50).forEach((a: any) => {
          const date = new Date(a.created).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
          trendMap[date] = (trendMap[date] || 0) + 1;
        });
        setActivityTrend(Object.entries(trendMap).slice(-10).map(([time, count]) => ({ time, count })));

      } catch (e) {
        console.error("Dashboard init error:", e);
      } finally {
        setLocalLoading(false);
      }
    };

    initDashboard();

    const unsubExams = pb.collection('exams').subscribe("*", initDashboard);
    const unsubRooms = pb.collection('exam_rooms').subscribe("*", initDashboard);
    const unsubAttempts = pb.collection('attempts').subscribe("*", initDashboard);

    return () => {
      unsubExams.then((u: any) => u());
      unsubRooms.then((u: any) => u());
      unsubAttempts.then((u: any) => u());
    };
  }, []);

  const totalTeachers = teachers.length;
  const totalClasses = classes.length;
  const totalSubjects = subjects.length;
  const totalStudents = students.length;

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="space-y-6">
      {/* Formal Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/20 dark:shadow-none">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none">
              <LayoutTemplate className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none">
                Console Admin
              </h1>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                Sistem Informasi & Manajemen Ujian Berbasis Komputer
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-emerald-600 border-emerald-100 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800/30 rounded-full px-3 py-1.5 flex items-center gap-2 font-bold shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Real-time Connected
          </Badge>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-[2rem]" />)
        ) : (
          <>
            <div className="group bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-lg shadow-slate-200/20 dark:shadow-none flex flex-col justify-between hover:border-orange-200 dark:hover:border-orange-900 transition-all">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                  <Users className="h-6 w-6" />
                </div>
                <Badge className="bg-orange-500 text-white border-0 px-2 py-0.5 text-[10px] font-black rounded-full shadow-lg shadow-orange-200 dark:shadow-none uppercase">Live</Badge>
              </div>
              <div className="mt-4">
                <p className="text-4xl font-black text-slate-800 dark:text-white leading-none tracking-tighter">{ongoingStudents}</p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2 ml-1">Siswa Sedang Ujian</p>
              </div>
            </div>

            <div className="group bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-lg shadow-slate-200/20 dark:shadow-none flex flex-col justify-between hover:border-blue-200 dark:hover:border-blue-900 transition-all">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2 py-1 rounded-full uppercase">Session</span>
              </div>
              <div className="mt-4">
                <p className="text-4xl font-black text-slate-800 dark:text-white leading-none tracking-tighter">{activeRooms}</p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2 ml-1">Ruang Ujian Terbuka</p>
              </div>
            </div>

            <div className="group bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-lg shadow-slate-200/20 dark:shadow-none flex flex-col justify-between hover:border-purple-200 dark:hover:border-purple-900 transition-all">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                  <BookOpen className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/40 px-2 py-1 rounded-full uppercase">Repository</span>
              </div>
              <div className="mt-4">
                <p className="text-4xl font-black text-slate-800 dark:text-white leading-none tracking-tighter">{totalExams}</p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2 ml-1">Bank Soal Terdaftar</p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/10 dark:shadow-none overflow-hidden">
          <CardHeader className="p-6 pb-0">
            <CardTitle className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-3 text-left">
              <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
              Statistik Partisipasi Siswa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              {loading ? (
                <Skeleton className="h-full w-full rounded-2xl" />
              ) : chartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                  <RefreshCw className="h-10 w-10 opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">Data Tidak Tersedia</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontWeight={700} stroke="#94A3B8" dy={10} />
                    <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight={700} stroke="#94A3B8" />
                    <Tooltip
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }}
                      cursor={{ fill: '#F8FAFC' }}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 700 }} />
                    <Bar name="Mengerjakan" dataKey="Mengerjakan" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={30} />
                    <Bar name="Selesai" dataKey="Selesai" fill="#10B981" radius={[6, 6, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/10 dark:shadow-none overflow-hidden text-left">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                Tren Aktivitas
                <RefreshCw className="h-3 w-3 text-emerald-500 animate-spin-slow" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityTrend}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip contentStyle={{ display: 'none' }} />
                    <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="p-6 pt-2">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-2xl font-black text-slate-800 dark:text-white leading-none tracking-tighter">Live</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Status Koneksi Database</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded-lg">Stabil</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/10 dark:shadow-none overflow-hidden text-left">
            <CardHeader className="p-6 pb-0">
              <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">Distribusi Bank Soal</CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex items-center">
              <div className="h-32 w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeDistribution}
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {typeDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-1.5">
                {typeDistribution.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/10 dark:shadow-none text-left">
        <div className="flex items-center justify-between mb-8">
          <h4 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Master Data</h4>
          <div className="h-[2px] flex-1 bg-slate-50 dark:bg-slate-800 mx-6"></div>
          <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 pointer-events-none">Total {totalStudents + totalTeachers + totalClasses + totalSubjects} Entitas</Badge>
        </div>

        <div className="grid gap-8 grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Tenaga Pendidik", value: totalTeachers, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
            { label: "Rombongan Belajar", value: totalClasses, icon: LayoutTemplate, color: "text-purple-500", bg: "bg-purple-50" },
            { label: "Mata Pelajaran", value: totalSubjects, icon: BookOpen, color: "text-amber-500", bg: "bg-amber-50" },
            { label: "Peserta Didik", value: totalStudents, icon: GraduationCap, color: "text-emerald-500", bg: "bg-emerald-50" },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-4 group">
              <div className={cn("p-4 rounded-[1.25rem] transition-all group-hover:scale-110", item.bg, item.color)}>
                <item.icon className="h-6 w-6" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{item.label}</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white mt-1.5 leading-none tracking-tighter">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
