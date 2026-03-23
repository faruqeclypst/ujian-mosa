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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Computer Based Test</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Monitor rincian data pengerjaan ujian secara live.</p>
        </div>
        <Badge variant="outline" className="w-fit text-green-600 border-green-200 bg-green-50/50">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Sistem Aktif
        </Badge>
      </div>
      
      {/* 🔴 LIVE MONITORING CARDS */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5 shadow-sm border border-orange-100 bg-orange-50/20">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Users className="h-5 w-5 text-orange-600 animate-pulse" />
              <Badge className="bg-orange-500">Live</Badge>
            </div>
            <div className="text-3xl font-bold text-slate-800">{ongoingStudents}</div>
            <div className="text-xs font-semibold text-orange-600">Siswa Sedang Ujian</div>
            <p className="text-[10px] text-slate-400">Jumlah siswa aktif mengerjakan soal.</p>
          </div>
        </Card>

        <Card className="p-5 shadow-sm border border-blue-100 bg-blue-50/20">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <LayoutTemplate className="h-5 w-5 text-blue-600" />
              <span className="text-xs text-slate-500">Sesi Ujian</span>
            </div>
            <div className="text-3xl font-bold text-slate-800">{activeRooms}</div>
            <div className="text-xs font-semibold text-blue-600">Ruang Ujian Aktif</div>
            <p className="text-[10px] text-slate-400">Total sesi yang belum diarsipkan.</p>
          </div>
        </Card>

        <Card className="p-5 shadow-sm border border-purple-100 bg-purple-50/20">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <BookOpen className="h-5 w-5 text-purple-600" />
              <span className="text-xs text-slate-500">Bank Soal</span>
            </div>
            <div className="text-3xl font-bold text-slate-800">{totalExams}</div>
            <div className="text-xs font-semibold text-purple-600">Master Bank Soal</div>
            <p className="text-[10px] text-slate-400">Total paket soal yang sudah dibuat.</p>
          </div>
        </Card>
      </div>

      {/* 📊 CHART AKTiVITAS UJiAN */}
      <Card className="p-5 shadow-sm border border-slate-200/60">
        <div className="p-0 pb-4">
           <h3 className="text-sm font-semibold text-slate-700">Aktivitas Ujian Live per Ruangan</h3>
        </div>
        <div className="h-[260px] w-full p-0">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">Belum ada aktivitas ujian berjalan untuk divisualisasikan.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} contentStyle={{ border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar name="Mengerjakan" dataKey="Mengerjakan" fill="#EA580C" radius={[4, 4, 0, 0]} barSize={25} />
                <Bar name="Selesai" dataKey="Selesai" fill="#16A34A" radius={[4, 4, 0, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* 📊 MASTER DATA Grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4 pt-4 border-t">
        <div className="space-y-1">
          <p className="text-xs text-slate-400">Total Guru</p>
          <p className="text-xl font-bold text-slate-700">{totalTeachers}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-slate-400">Total Kelas</p>
          <p className="text-xl font-bold text-slate-700">{totalClasses}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-slate-400">Total Mapel</p>
          <p className="text-xl font-bold text-slate-700">{totalMapels}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-slate-400">Total Siswa</p>
          <p className="text-xl font-bold text-slate-700">{totalStudents}</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
