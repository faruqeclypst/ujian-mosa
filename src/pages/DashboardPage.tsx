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
  
  const [activeDashboardTab, setActiveDashboardTab] = useState<'performa' | 'pelanggaran' | 'selesai' | 'mapel'>('performa');
  const [subjectStats, setSubjectStats] = useState<any[]>([]);
  const [logActivity, setLogActivity] = useState<{
    violations: any[],
    recentFinished: any[]
  }>({ violations: [], recentFinished: [] });

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
        const attemptsData = await pb.collection('attempts').getFullList({ sort: '-updated' });

        // Compute unique ongoing students globally
        const ongoingUnique = new Set();
        attemptsData.forEach((a: any) => {
          if (a.status === "ongoing") {
            ongoingUnique.add(a.studentId || a.student_id);
          }
        });
        setOngoingStudents(ongoingUnique.size);

        // --- INTELLIGENCE DATA CALCULATIONS ---

        // A. Performa & Room Participation
        const mappedChart = roomsData
          .filter((room: any) => room.status !== "archive")
          .map((room: any) => {
            const roomAttempts = attemptsData.filter((a: any) => (a.examRoomId === room.id) || (a.exam_room_id === room.id));
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
              total: ongoingSet.size + finishedSet.size
            }
          })
          .filter(r => r.total > 0);

        setChartData(mappedChart);

        // B. Violations & Recent Activity
        const violations: any[] = [];
        const finished: any[] = [];

        attemptsData.forEach(a => {
          const std = students.find(s => s.id === (a.studentId || a.student_id));
          const exm = examsData.find(e => e.id === a.examId);
          const cls = classes.find(c => c.id === std?.classId);
          
          if (a.status === "LOCKED" || (a.cheatCount || 0) > 0) {
            const room = roomsData.find(r => r.id === a.examRoomId);
            violations.push({
               name: std?.name || "Siswa",
               className: cls?.name || "-",
               cheatCount: a.cheatCount || 0,
               cheatLimit: room?.cheat_limit || 0,
               status: a.status
            });
          }

          if (["finished", "submitted", "graded"].includes(a.status)) {
             finished.push({
                name: std?.name || "Siswa",
                className: cls?.name || "-",
                score: a.score || 0,
                examTitle: exm?.title || "Ujian",
                time: new Date(a.updated).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })
             });
          }
        });

        setLogActivity({
           violations: violations.sort((a, b) => b.cheatCount - a.cheatCount),
           recentFinished: finished.slice(0, 10)
        });

        // C. Subject Stats
        const subMap: Record<string, { total: number, count: number }> = {};
        examsData.forEach(e => {
           const sub = subjects.find(s => s.id === e.subjectId);
           if (!sub) return;
           const relatedAttempts = attemptsData.filter(a => a.examId === e.id && (a.score || 0) > 0);
           relatedAttempts.forEach(ra => {
              if (!subMap[sub.name]) subMap[sub.name] = { total: 0, count: 0 };
              subMap[sub.name].total += ra.score;
              subMap[sub.name].count++;
           });
        });
        setSubjectStats(Object.entries(subMap).map(([name, data]) => ({
           name,
           avgScore: Math.round(data.total / data.count)
        })).sort((a, b) => b.avgScore - a.avgScore));

        // 4. Type Distribution
        const types: Record<string, number> = {};
        examsData.forEach((e: any) => {
          const t = e.examType || e.examtype || "UMUM";
          types[t] = (types[t] || 0) + 1;
        });
        setTypeDistribution(Object.entries(types).map(([name, value]) => ({ name, value })));

        // 5. Activity Trend (Tracking 50 NEWEST interactions)
        const trendMap: Record<string, number> = {};
        attemptsData.slice(0, 50).reverse().forEach((a: any) => {
          const date = new Date(a.updated || a.created).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
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
  }, [students, classes, subjects]);

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
        <Card className="lg:col-span-2 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/10 dark:shadow-none overflow-hidden flex flex-col">
          <CardHeader className="p-6 pb-0 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
              <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
              Live Intelligence
            </CardTitle>
            <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-[10px] font-bold">
              {[
                { id: 'performa', label: 'Performa' },
                { id: 'pelanggaran', label: 'Pelanggaran' },
                { id: 'selesai', label: 'Terbaru' },
                { id: 'mapel', label: 'Mapel' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveDashboardTab(t.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all",
                    activeDashboardTab === t.id 
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-6 flex-1 min-h-[350px]">
            {loading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : chartData.length === 0 && activeDashboardTab !== 'pelanggaran' ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                  <RefreshCw className="h-10 w-10 opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">Data Tidak Tersedia</p>
               </div>
            ) : (
              <div className="h-full">
                {activeDashboardTab === 'performa' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontWeight={700} stroke="#94A3B8" dy={10} />
                      <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight={700} stroke="#94A3B8" />
                      <Tooltip
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }}
                        cursor={{ fill: '#F8FAFC' }}
                      />
                      <Bar name="Rerata Nilai" dataKey="avgScore" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {activeDashboardTab === 'pelanggaran' && (
                  <div className="space-y-3">
                     <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                        Peserta Dalam Pelanggaran (Terkunci)
                     </p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {logActivity.violations.length === 0 ? (
                           <div className="col-span-2 py-10 text-center text-slate-400 text-xs font-medium italic">Tidak ada pelanggaran aktif.</div>
                        ) : logActivity.violations.slice(0, 6).map((v: any, i: number) => (
                           <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/30">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 font-bold text-xs">{v.name.charAt(0)}</div>
                                 <div className="text-left">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{v.name}</p>
                                    <p className="text-[9px] text-rose-500 font-bold uppercase">{v.className}</p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-[10px] font-black text-rose-600">
                                   {v.cheatCount} / {v.cheatLimit}
                                 </p>
                                 <p className="text-[8px] text-slate-400 font-medium whitespace-nowrap">Batas Pelanggaran</p>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                )}

                {activeDashboardTab === 'selesai' && (
                  <div className="space-y-4">
                     <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Penyelesaian Terakhir</p>
                     <div className="space-y-2">
                        {logActivity.recentFinished.length === 0 ? (
                           <div className="py-10 text-center text-slate-400 text-xs font-medium italic">Belum ada siswa yang selesai.</div>
                        ) : logActivity.recentFinished.slice(0, 5).map((s: any, i: number) => (
                           <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 group hover:border-emerald-200 dark:hover:border-emerald-800/40 transition-all">
                              <div className="flex items-center gap-4">
                                 <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 group-hover:scale-110 transition-transform">
                                    <CheckCircle2 className="h-4 w-4" />
                                 </div>
                                 <div className="text-left">
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.name} <span className="text-[10px] font-medium text-slate-400 ml-2">({s.className})</span></p>
                                    <p className="text-[10px] text-slate-500 font-medium italic">{s.examTitle}</p>
                                 </div>
                              </div>
                              <div className="flex flex-col items-end">
                                 <div className="text-base font-black text-slate-800 dark:text-white">{s.score}</div>
                                 <div className="text-[9px] text-slate-400 font-bold uppercase">{s.time}</div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                )}

                {activeDashboardTab === 'mapel' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectStats} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" opacity={0.5} />
                      <XAxis type="number" axisLine={false} tickLine={false} fontSize={10} fontWeight={700} stroke="#94A3B8" />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={9} fontWeight={700} stroke="#64748B" width={100} />
                      <Tooltip
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '10px' }}
                        cursor={{ fill: '#F8FAFC' }}
                      />
                      <Bar name="Rerata Skor" dataKey="avgScore" fill="#8B5CF6" radius={[0, 6, 6, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/10 dark:shadow-none overflow-hidden text-left">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                Tren Aktivitas
                <div className="flex items-center gap-1.5">
                   <span className="text-[10px] font-bold text-blue-500 lowercase">{activityTrend.reduce((sum, item) => sum + item.count, 0)} log/min</span>
                   <RefreshCw className="h-3 w-3 text-emerald-500 animate-spin-slow" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityTrend} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
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
                      stroke="#94A3B8" 
                      interval="preserveStartEnd"
                    />
                    <Tooltip 
                      labelStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B' }}
                      itemStyle={{ fontSize: '12px', fontWeight: '900', color: '#3B82F6' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      formatter={(value) => [`${value} Aktivitas`, "Jumlah"]}
                    />
                    <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="p-6 pt-2">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-2xl font-black text-slate-800 dark:text-white leading-none tracking-tighter">
                      {totalStudents > 0 ? Math.round((ongoingStudents / totalStudents) * 100) : 0}%
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Kapasitas Terpakai</p>
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
