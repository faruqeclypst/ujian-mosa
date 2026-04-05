import { useEffect, useState, useMemo } from "react";
import {
  Users,
  LayoutTemplate,
  BookOpen,
  CheckCircle2,
  GraduationCap
} from "lucide-react";
import pb from "../lib/pocketbase";

import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useExamData } from "../context/ExamDataContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const DashboardPage = () => {
  const { teachers, classes, subjects, students } = useExamData();

  const [totalExams, setTotalExams] = useState(0);
  const [activeRooms, setActiveRooms] = useState(0);
  const [ongoingStudents, setOngoingStudents] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]); // <--- Chart data state

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

            // Count unique students for ongoing and finished
            const ongoingSet = new Set();
            const finishedSet = new Set();

            roomAttempts.forEach((a: any) => {
              const sId = a.studentId || a.student_id;
              if (!sId) return;

              if (a.status === "ongoing") {
                ongoingSet.add(sId);
              } else if (a.status === "finished" || a.status === "submitted" || a.status === "graded") {
                finishedSet.add(sId);
              }
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

      } catch (e) {
        console.error("Dashboard init error:", e);
      }
    };

    initDashboard();

    // Subscribe to changes for live updates
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

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-indigo-500" />
            Dashboard Monitoring
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pantau ringkasan metrik aktivitas pengerjaan ujian secara live.</p>
        </div>
        <Badge variant="outline" className="w-fit text-emerald-600 border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800/30 rounded-xl px-2.5 py-1 flex items-center shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1 animate-pulse" /> Sistem Aktif
        </Badge>
      </div>

      {/* 🔴 LIVE MONITORING CARDS */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
              <Users className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Siswa Sedang Ujian</p>
                <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0 h-4 px-1 text-[9px] font-bold rounded">Live</Badge>
              </div>
              <p className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{ongoingStudents}</p>
            </div>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm flex items-center gap-3.5 backdrop-blur-sm">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <LayoutTemplate className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Ruang Ujian Aktif</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">{activeRooms}</p>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm flex items-center gap-3.5 backdrop-blur-sm">
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Master Bank Soal</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">{totalExams}</p>
          </div>
        </div>
      </div>

      {/* 📊 CHART AKTiVITAS UJiAN */}
      <div className="bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <div className="pb-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-slow-ping"></span>
            Aktivitas Pengerjaan Ujian Live (Per Ruang)
          </h3>
        </div>
        <div className="h-[280px] w-full mt-2">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 font-medium">Belum ada sesi ujian yang berjalan untuk divisualisasikan.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="opacity-40 dark:opacity-10" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.05)" }} contentStyle={{ border: '1px solid rgba(148,163,184,0.1)', borderRadius: '12px', fontSize: '11px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', backgroundColor: 'transparent', backdropFilter: 'blur(8px)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar name="Mengerjakan" dataKey="Mengerjakan" fill="#EA580C" radius={[5, 5, 0, 0]} barSize={22} />
                <Bar name="Selesai" dataKey="Selesai" fill="#10B981" radius={[5, 5, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 📊 MASTER DATA Grid */}
      <div className="bg-card p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Ringkasan Master Data</h4>
        <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Total Guru</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white leading-none mt-0.5">{totalTeachers}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Total Kelas</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white leading-none mt-0.5">{totalClasses}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Total Mapel</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white leading-none mt-0.5">{totalSubjects}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Total Siswa</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white leading-none mt-0.5">{totalStudents}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
