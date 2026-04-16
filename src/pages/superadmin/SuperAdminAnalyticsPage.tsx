import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, Activity, CalendarDays, ExternalLink } from "lucide-react";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { masterPb } from "../../lib/pocketbase";

interface ChartDay {
  label: string;
  count: number;
}

const SuperAdminAnalyticsPage = () => {
  const [stats, setStats] = useState({
    schoolsCount: 0,
    requestsCount: 0,
    totalQuota: 0,
    chartData: [] as ChartDay[],
    maxChartCount: 1,
    loading: true,
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [schoolsRes, requestsRes] = await Promise.all([
          masterPb.collection("schools").getList(1, 1000, { filter: 'is_active=true' }),
          masterPb.collection("school_requests").getList(1, 1000)
        ]);

        const totalQuota = schoolsRes.items.reduce((acc, curr) => acc + (curr.student_quota || 250), 0);

        // Menghitung data grafik untuk 14 Hari Terakhir dari kolom 'created'
        const last14Days = Array.from({ length: 14 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (13 - i));
          return d.toISOString().split('T')[0];
        });

        const chartData = last14Days.map(date => {
          const schoolCount = schoolsRes.items.filter(s => s.created.startsWith(date)).length;
          const reqCount = requestsRes.items.filter(r => r.created.startsWith(date)).length;
          // Format label tanggal (contoh: "14 Apr")
          const dObj = new Date(date);
          const label = `${dObj.getDate()} ${dObj.toLocaleString('id-ID', { month: 'short' })}`;
          return { label, count: schoolCount + reqCount };
        });

        const maxCount = Math.max(...chartData.map(d => d.count), 1);

        setStats({
          schoolsCount: schoolsRes.totalItems,
          requestsCount: requestsRes.totalItems,
          totalQuota: totalQuota,
          chartData: chartData,
          maxChartCount: maxCount,
          loading: false
        });
      } catch (err) {
        console.error("Terjadi kesalahan saat memuat analitik", err);
        setStats(s => ({ ...s, loading: false }));
      }
    };

    fetchAnalytics();
  }, []);

  return (
    <SuperAdminLayout>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1">
            Statistik Server
          </h2>
          <p className="text-slate-500 font-medium text-sm">Analitik penggunaan sistem as a service E-Ujian.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
          <button className="px-4 py-2 text-sm font-bold rounded-lg bg-slate-100 text-slate-800">Semua Waktu</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Sekolah Aktif</p>
              <h3 className="text-4xl font-black text-slate-900">{stats.loading ? "--" : stats.schoolsCount}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <CalendarDays size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-blue-600 text-sm font-bold mt-2">
            Dari seluruh kluster tenant
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between mb-4">
            <div>
               <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Kuota Tersedia</p>
               <h3 className="text-4xl font-black text-slate-900">{stats.loading ? "--" : stats.totalQuota.toLocaleString('id-ID')}</h3>
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <Users size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-amber-600 text-sm font-bold mt-2">
            Total siswa termanage secara global
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between mb-4">
            <div>
               <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Antrean Pendaftaran</p>
               <h3 className="text-4xl font-black text-slate-900">{stats.loading ? "--" : stats.requestsCount}</h3>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <Activity size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold mt-2">
            Histori pendaftar mendarat
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-600" /> Tren Aktivitas Registrasi (14 Hari Terakhir)
          </h3>
        </div>

        {/* Real Chart Visualization using mapped data */}
        <div className="h-64 flex items-end justify-between gap-1 sm:gap-2 pb-2">
          {stats.loading ? (
            <div className="w-full flex items-center justify-center text-slate-400 font-bold h-full">Memuat Grafik...</div>
          ) : stats.chartData.every(d => d.count === 0) ? (
            <div className="w-full flex items-center justify-center text-slate-400 font-bold h-full">Belum ada aktivitas dalam 14 hari terakhir.</div>
          ) : (
            stats.chartData.map((data, i) => {
              const heightPercent = Math.max((data.count / stats.maxChartCount) * 100, 2); // minimal 2% height agar tetap terlihat ada batang meski nol jika dipaksa
              return (
                <div key={i} className="h-full w-full flex flex-col justify-end items-center group relative">
                  {/* Tooltip pada hover */}
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slate-800 text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded transition-opacity whitespace-nowrap z-10 pointer-events-none">
                    {data.count} Registrasi
                  </div>
                  <div 
                    className={`w-full max-w-[40px] rounded-t-lg relative overflow-hidden transition-all duration-500 cursor-pointer ${data.count > 0 ? 'bg-blue-100 group-hover:bg-blue-200' : 'bg-slate-50'}`}
                    style={{ height: `${data.count > 0 ? heightPercent : 0}%` }}
                  >
                    <div 
                      className="absolute bottom-0 w-full bg-blue-500 rounded-t-lg" 
                      style={{ height: `${data.count > 0 ? heightPercent * 0.8 : 0}%` }} 
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="flex justify-between text-[10px] sm:text-xs font-bold text-slate-400 pt-3 border-t border-slate-100 mt-2 px-1">
          {!stats.loading && stats.chartData.length > 0 && (
            <>
              <span className="hidden sm:inline">{stats.chartData[0].label}</span>
              <span className="sm:hidden">{stats.chartData[0].label.split(' ')[0]}</span>
              
              <span className="hidden sm:inline">{stats.chartData[Math.floor(stats.chartData.length / 2)].label}</span>
              <span className="sm:hidden">{stats.chartData[Math.floor(stats.chartData.length / 2)].label.split(' ')[0]}</span>

              <span className="text-slate-600">Hari Ini</span>
            </>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
};

export default SuperAdminAnalyticsPage;
