import { useState, useEffect } from "react";
import { BarChart3, Users, CalendarDays, Activity, TrendingUp } from "lucide-react";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";

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
          masterPb.collection("schools").getList(1, 1000, { filter: "is_active=true" }),
          masterPb.collection("school_requests").getList(1, 1000),
        ]);

        const totalQuota = schoolsRes.items.reduce((acc, curr) => acc + (curr.student_quota || 250), 0);

        const last14Days = Array.from({ length: 14 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (13 - i));
          return d.toISOString().split("T")[0];
        });

        const chartData = last14Days.map(date => {
          const schoolCount = schoolsRes.items.filter(s => s.created.startsWith(date)).length;
          const reqCount = requestsRes.items.filter(r => r.created.startsWith(date)).length;
          const dObj = new Date(date);
          const label = `${dObj.getDate()} ${dObj.toLocaleString("id-ID", { month: "short" })}`;
          return { label, count: schoolCount + reqCount };
        });

        const maxCount = Math.max(...chartData.map(d => d.count), 1);

        setStats({
          schoolsCount: schoolsRes.totalItems,
          requestsCount: requestsRes.totalItems,
          totalQuota,
          chartData,
          maxChartCount: maxCount,
          loading: false,
        });
      } catch (err) {
        console.error(err);
        setStats(s => ({ ...s, loading: false }));
      }
    };
    fetchAnalytics();
  }, []);

  const statCards = [
    {
      label: "Total Sekolah Aktif",
      value: stats.schoolsCount,
      icon: CalendarDays,
      color: "text-blue-600",
      bg: "bg-blue-50",
      sub: "Dari seluruh kluster tenant",
    },
    {
      label: "Total Kuota Siswa",
      value: stats.totalQuota.toLocaleString("id-ID"),
      icon: Users,
      color: "text-amber-600",
      bg: "bg-amber-50",
      sub: "Kapasitas global termanage",
    },
    {
      label: "Antrean Pendaftaran",
      value: stats.requestsCount,
      icon: Activity,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      sub: "Histori pendaftar mendarat",
    },
  ];

  const isEmpty = stats.chartData.every(d => d.count === 0);

  return (
    <SuperAdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Statistik Server</h2>
          <p className="text-slate-500 text-sm mt-0.5">Analitik penggunaan sistem EXAM AA.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
          <button className="px-4 py-2 text-sm font-semibold rounded-lg bg-white text-slate-800 shadow-sm">
            Semua Waktu
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{card.label}</p>
                <h3 className="text-3xl font-bold text-slate-900">
                  {stats.loading ? <span className="text-slate-300">–</span> : card.value}
                </h3>
              </div>
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", card.bg)}>
                <card.icon size={22} className={card.color} />
              </div>
            </div>
            <div className={cn("flex items-center gap-1.5 text-xs font-semibold", card.color)}>
              <TrendingUp size={12} />
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-600" />
            Tren Aktivitas Registrasi
          </h3>
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">14 Hari Terakhir</span>
        </div>

        {/* Bar chart */}
        <div className="h-48 sm:h-64 flex items-end justify-between gap-1 sm:gap-1.5 pb-2">
          {stats.loading ? (
            <div className="w-full flex items-center justify-center text-slate-400 text-sm font-medium h-full">
              Memuat data...
            </div>
          ) : isEmpty ? (
            <div className="w-full flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <BarChart3 size={40} className="opacity-30" />
              <p className="text-sm font-medium">Belum ada aktivitas dalam 14 hari terakhir</p>
            </div>
          ) : (
            stats.chartData.map((data, i) => {
              const heightPercent = Math.max((data.count / stats.maxChartCount) * 100, 4);
              const isToday = i === stats.chartData.length - 1;
              return (
                <div key={i} className="h-full w-full flex flex-col justify-end items-center group relative">
                  {/* Tooltip */}
                  {data.count > 0 && (
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-lg">
                      {data.count} registrasi
                    </div>
                  )}
                  <div
                    className={cn(
                      "w-full max-w-[32px] rounded-t-md transition-all duration-500 relative overflow-hidden",
                      data.count > 0
                        ? isToday ? "bg-blue-600" : "bg-blue-200 group-hover:bg-blue-300"
                        : "bg-slate-100"
                    )}
                    style={{ height: `${data.count > 0 ? heightPercent : 4}%` }}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* X-axis labels */}
        {!stats.loading && stats.chartData.length > 0 && (
          <div className="flex justify-between text-[10px] font-medium text-slate-400 pt-2 border-t border-slate-100 mt-2">
            <span>{stats.chartData[0]?.label}</span>
            <span>{stats.chartData[Math.floor(stats.chartData.length / 2)]?.label}</span>
            <span className="text-blue-600 font-bold">Hari Ini</span>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
};

export default SuperAdminAnalyticsPage;
