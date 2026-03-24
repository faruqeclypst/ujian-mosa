import { useEffect, useState, useMemo } from "react";
import { 
  Users, 
  LayoutTemplate, 
  BookOpen, 
  CheckCircle2,
  GraduationCap
} from "lucide-react";
import { ref, onValue } from "firebase/database";
import { database } from "../lib/firebase";

import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { usePiket } from "../context/PiketContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const DashboardPage = () => {
  const { teachers, classes, mapels, students } = usePiket();

  const [totalExams, setTotalExams] = useState(0);
  const [activeRooms, setActiveRooms] = useState(0);
  const [ongoingStudents, setOngoingStudents] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]); // <--- Chart data state

  useEffect(() => {
    // 1. Total Bank Soal (Ujian)
    const unsubExams = onValue(ref(database, "exams"), (snap) => {
      setTotalExams(snap.exists() ? Object.keys(snap.val()).length : 0);
    });

    // 2. Total Ruang Ujian Aktif & Chart Builders
    const unsubRooms = onValue(ref(database, "exam_rooms"), (snap) => {
      if (snap.exists()) {
        const roomsData = snap.val();
        const active = Object.values(roomsData).filter((r: any) => r.status !== "archive").length;
        setActiveRooms(active);

        // Fetch Attempts to compute chart
        onValue(ref(database, "attempts"), (attSnap) => {
           const attemptsData = attSnap.exists() ? attSnap.val() : {};
           const mappedChart = Object.keys(roomsData)
             .filter((rk) => roomsData[rk].status !== "archive")
             .map((rk) => {
                 const room = roomsData[rk];
                 const ongoing = Object.keys(attemptsData).filter((ak) => ak.includes(rk) && attemptsData[ak].status === "ongoing").length;
                 const submitted = Object.keys(attemptsData).filter((ak) => ak.includes(rk) && (attemptsData[ak].status === "submitted" || attemptsData[ak].status === "graded")).length;
                 return {
                    name: room.room_code || "Ruang",
                    Mengerjakan: ongoing,
                    Selesai: submitted
                 }
             });
           
           setChartData(mappedChart);
        });
      } else {
        setActiveRooms(0);
        setChartData([]);
      }
    });

    // 3. Siswa Sedang Aktif Ujian
    const unsubAttempts = onValue(ref(database, "attempts"), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const ongoing = Object.values(data).filter((a: any) => a.status === "ongoing").length;
        setOngoingStudents(ongoing);
      } else {
        setOngoingStudents(0);
      }
    });

    return () => {
      unsubExams();
      unsubRooms();
      unsubAttempts();
    };
  }, []);

  const totalTeachers = teachers.length;
  const totalClasses = classes.length;
  const totalMapels = mapels.length;
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
               <p className="text-lg font-bold text-slate-800 dark:text-white leading-none mt-0.5">{totalMapels}</p>
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
