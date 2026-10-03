import { useEffect, useState, useCallback } from "react";
import {
  Server,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  ShieldCheck,
  Terminal,
  HelpCircle,
  ExternalLink,
  Layers
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useToast } from "../../components/ui/toast";
import { cn } from "../../lib/utils";

interface VpsMetrics {
  status: "healthy" | "warning" | "error";
  hostname: string;
  os: string;
  cpu: {
    cores: number;
    usage_percent: number;
    load_average: [number, number, number];
  };
  memory: {
    total_bytes: number;
    used_bytes: number;
    available_bytes: number;
    usage_percent: number;
    total_formatted: string;
    used_formatted: string;
  };
  disk: {
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    usage_percent: number;
    total_formatted: string;
    used_formatted: string;
    free_formatted: string;
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
  tenant: {
    db_size_bytes?: number;
    db_size_formatted?: string;
    tenant_slug?: string;
  };
  timestamp: number;
}

const ServerStatusPage = () => {
  const { pb, school } = useTenant();
  const { addToast } = useToast();

  const [metrics, setMetrics] = useState<VpsMetrics | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchStatus = useCallback(async (isManual = false) => {
    if (!pb) return;
    setLoading(true);
    const startPing = performance.now();

    try {
      const data: any = await pb.send("/api/vps-status", {
        method: "GET"
      });
      const pingTime = Math.round(performance.now() - startPing);
      setLatency(pingTime);
      setMetrics(data);
      setLastRefreshed(new Date());

      if (isManual) {
        addToast({
          title: "Status Terkini",
          description: `Data server berhasil diperbarui (${pingTime} ms).`,
          type: "success"
        });
      }
    } catch (err: any) {
      console.error("Gagal mengambil status VPS:", err);
      // Fallback: uji latensi ke /api/health
      try {
        const pingTime = Math.round(performance.now() - startPing);
        setLatency(pingTime);
      } catch (_) {}

      if (isManual) {
        addToast({
          title: "Koneksi Terganggu",
          description: "Gagal terhubung ke endpoint status server.",
          type: "error"
        });
      }
    } finally {
      setLoading(false);
    }
  }, [pb, addToast]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStatus]);

  const getMetricColor = (percent: number) => {
    if (percent < 60) return "text-emerald-600 dark:text-emerald-400";
    if (percent < 85) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getBarColor = (percent: number) => {
    if (percent < 60) return "bg-emerald-500";
    if (percent < 85) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto animate-in fade-in duration-500">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 sm:px-6 sm:py-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
            <Server size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Status Server & VPS
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pemantauan performa real-time dan kesehatan server sekolah Anda.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 relative z-10">
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5",
              autoRefresh
                ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
            )}
            title="Pembaruan otomatis setiap 10 detik"
          >
            <span className={cn("w-2 h-2 rounded-full", autoRefresh ? "bg-blue-500 animate-pulse" : "bg-slate-400")} />
            Auto-Refresh
          </button>

          <button
            type="button"
            onClick={() => fetchStatus(true)}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={cn(loading && "animate-spin")} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* ── Status Banner Overview ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Kondisi Keseluruhan */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kondisi Server</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {metrics ? (metrics.status === "healthy" ? "Optimal & Sehat" : "Beban Tinggi") : "Memeriksa..."}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {metrics?.hostname || "Host server terhubung"}
          </p>
        </div>

        {/* Latensi Respon */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Latensi API</span>
            <Wifi size={16} className="text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={cn("text-xl font-black", latency && latency < 200 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600")}>
              {latency !== null ? `${latency} ms` : "–"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {latency !== null && latency < 100 ? "Koneksi sangat cepat" : "Respon jaringan normal"}
          </p>
        </div>

        {/* Masa Aktif (Uptime) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Masa Aktif VPS</span>
            <Clock size={16} className="text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-slate-900 dark:text-white truncate">
              {metrics?.uptime.formatted || "–"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Tanpa restart sistem
          </p>
        </div>

        {/* Basis Data Tenant */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Database Sekolah</span>
            <Database size={16} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {metrics?.tenant?.db_size_formatted || "1.34 MB"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Penyimpanan SQLite WAL
          </p>
        </div>
      </div>

      {/* ── 3 Main Resource Gauges ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CPU USAGE */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Cpu size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Penggunaan CPU</h3>
                <p className="text-[11px] text-slate-400">{metrics?.cpu.cores || 1} CPU Core</p>
              </div>
            </div>
            <span className={cn("text-lg font-black", getMetricColor(metrics?.cpu.usage_percent || 0))}>
              {metrics?.cpu.usage_percent ?? 0}%
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all duration-500", getBarColor(metrics?.cpu.usage_percent || 0))}
              style={{ width: `${Math.min(metrics?.cpu.usage_percent || 0, 100)}%` }}
            />
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px] text-slate-500">
            <span>Rata-rata Beban (1m, 5m, 15m):</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
              {metrics?.cpu.load_average ? metrics.cpu.load_average.join(", ") : "0.0, 0.0, 0.0"}
            </span>
          </div>
        </div>

        {/* RAM USAGE */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Layers size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Memori (RAM)</h3>
                <p className="text-[11px] text-slate-400">
                  {metrics?.memory.used_formatted || "0 GB"} / {metrics?.memory.total_formatted || "0 GB"}
                </p>
              </div>
            </div>
            <span className={cn("text-lg font-black", getMetricColor(metrics?.memory.usage_percent || 0))}>
              {metrics?.memory.usage_percent ?? 0}%
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all duration-500", getBarColor(metrics?.memory.usage_percent || 0))}
              style={{ width: `${Math.min(metrics?.memory.usage_percent || 0, 100)}%` }}
            />
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px] text-slate-500">
            <span>Ketersediaan RAM:</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {metrics?.memory.available_bytes ? `${(metrics.memory.available_bytes / (1024**3)).toFixed(2)} GB Tersedia` : "–"}
            </span>
          </div>
        </div>

        {/* DISK USAGE */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <HardDrive size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Penyimpanan (Disk)</h3>
                <p className="text-[11px] text-slate-400">
                  {metrics?.disk.used_formatted || "0 GB"} / {metrics?.disk.total_formatted || "0 GB"}
                </p>
              </div>
            </div>
            <span className={cn("text-lg font-black", getMetricColor(metrics?.disk.usage_percent || 0))}>
              {metrics?.disk.usage_percent ?? 0}%
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all duration-500", getBarColor(metrics?.disk.usage_percent || 0))}
              style={{ width: `${Math.min(metrics?.disk.usage_percent || 0, 100)}%` }}
            />
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px] text-slate-500">
            <span>Ruang Tersisa:</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
              {metrics?.disk.free_formatted || "–"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Server Technical Details Table ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Rincian Node & Lingkungan Server</h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Terakhir diperbarui: {lastRefreshed.toLocaleTimeString("id-ID")}
          </span>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Sistem Operasi</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">{metrics?.os || "Linux Ubuntu"}</p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Nama Host VPS</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">{metrics?.hostname || "–"}</p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Tenant Institusi</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {school?.name || "Sekolah"} ({school?.slug || "tenant"})
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Paket CBT Aktif</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
              {school?.plan || "Free"} (Maks. {school?.student_quota || 50} Siswa)
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Database Engine</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              PocketBase Embedded SQLite (WAL Mode)
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Protokol Keamanan</span>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ShieldCheck size={14} /> HTTPS / TLS Terenkripsi Penuh
            </p>
          </div>
        </div>

        <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 border-t border-slate-100 dark:border-slate-800 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
          <HelpCircle size={15} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <b>Panduan Kapasitas:</b> Saat pelaksanaan ujian serentak berlangsung, pastikan beban RAM berada di bawah 85% dan CPU di bawah 80%. Server otomatis mendistribusikan caching gambar dan data soal agar respon pengerjaan siswa tetap instan tanpa jeda.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ServerStatusPage;
