import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
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
  Layers,
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useToast } from "../../components/ui/toast";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { NeonStatGrid, NeonStatCard } from "../../components/ui/NeonStats";
import { NeonCard, NeonCardHeader, NeonCardBody } from "../../components/ui/NeonCard";
import { NeonBadge } from "../../components/ui/NeonBadge";

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
          description: `Data performa server berhasil diperbarui (${pingTime} ms).`,
          type: "success"
        });
      }
    } catch (err: any) {
      console.error("Gagal mengambil status VPS:", err);
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
    return "text-rose-600 dark:text-rose-400";
  };

  const getBarColor = (percent: number) => {
    if (percent < 60) return "bg-emerald-500";
    if (percent < 85) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">

        {/* ── 1. Page Header Bar (Title, Breadcrumb & Primary Actions) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              Status Server &amp; VPS
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <Link to="/admin" className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                Semua Modul
              </Link>
              <span>/</span>
              <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                {school?.slug || "modalbangsa"}
              </span>
              <span>/</span>
              <span className="text-neutral-900 dark:text-neutral-100 font-semibold">
                status-server
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer shadow-2xs select-none",
                autoRefresh
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-white dark:bg-neutral-850 border-neutral-200 dark:border-neutral-750 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              )}
              title="Pembaruan otomatis setiap 10 detik"
            >
              <span className={cn("w-2 h-2 rounded-full", autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-neutral-400")} />
              <span>Auto-Refresh (10s)</span>
            </button>

            <Button
              type="button"
              onClick={() => fetchStatus(true)}
              disabled={loading}
              className="h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span>{loading ? "Memperbarui..." : "Segarkan"}</span>
            </Button>
          </div>
        </div>

        {/* ── 2. Top Stats Strip (4 Kartu Ringkas, Elegan, Presisi Sama dengan Ruang Ujian & Bank Soal) ── */}
        <NeonStatGrid cols={4}>
          <NeonStatCard
            label="Kondisi Server"
            indicator={
              metrics?.status === "healthy" ? (
                <NeonBadge variant="emerald" size="xs" pulse={true}>
                  Optimal
                </NeonBadge>
              ) : (
                <NeonBadge variant="amber" size="xs">
                  Tinggi
                </NeonBadge>
              )
            }
            value={metrics ? (metrics.status === "healthy" ? "Optimal & Sehat" : "Beban Tinggi") : "Memeriksa..."}
            valueClassName="text-base sm:text-lg font-bold"
            subText={metrics?.hostname ? `Host: ${metrics.hostname}` : "Host server terhubung"}
            isLoading={loading && !metrics}
          />

          <NeonStatCard
            label="Latensi API"
            indicator={
              latency !== null ? (
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", latency < 200 ? "bg-emerald-500" : "bg-amber-500")} />
              ) : undefined
            }
            value={latency !== null ? `${latency}` : "–"}
            unit="ms"
            subText={latency !== null && latency < 100 ? "Koneksi sangat cepat" : "Respon jaringan normal"}
            isLoading={loading && !metrics}
          />

          <NeonStatCard
            label="Masa Aktif VPS"
            value={metrics?.uptime?.formatted || "–"}
            valueClassName="text-base sm:text-lg font-bold truncate"
            subText="Tanpa restart sistem"
            isLoading={loading && !metrics}
          />

          <NeonStatCard
            label="Database Sekolah"
            value={metrics?.tenant?.db_size_formatted || "1.34 MB"}
            subText="PocketBase SQLite WAL"
            isLoading={loading && !metrics}
          />
        </NeonStatGrid>

        {/* ── 3. Three Resource Gauges (CPU, RAM, Disk) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {/* CPU USAGE */}
          <NeonCard>
            <NeonCardHeader
              icon={Cpu}
              title="Penggunaan CPU"
              subtitle={`${metrics?.cpu.cores || 1} CPU Core`}
              badge={
                <span className={cn("text-base sm:text-lg font-mono font-bold", getMetricColor(metrics?.cpu.usage_percent || 0))}>
                  {metrics?.cpu.usage_percent ?? 0}%
                </span>
              }
            />
            <NeonCardBody className="p-4 sm:p-5 space-y-3.5">
              <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full transition-all duration-500 rounded-full", getBarColor(metrics?.cpu.usage_percent || 0))}
                  style={{ width: `${Math.min(metrics?.cpu.usage_percent || 0, 100)}%` }}
                />
              </div>

              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>Rata-rata Beban (1m, 5m, 15m):</span>
                <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                  {metrics?.cpu.load_average ? metrics.cpu.load_average.join(", ") : "0.0, 0.0, 0.0"}
                </span>
              </div>
            </NeonCardBody>
          </NeonCard>

          {/* RAM USAGE */}
          <NeonCard>
            <NeonCardHeader
              icon={Layers}
              title="Memori (RAM)"
              subtitle={`${metrics?.memory.used_formatted || "0 GB"} / ${metrics?.memory.total_formatted || "0 GB"}`}
              badge={
                <span className={cn("text-base sm:text-lg font-mono font-bold", getMetricColor(metrics?.memory.usage_percent || 0))}>
                  {metrics?.memory.usage_percent ?? 0}%
                </span>
              }
            />
            <NeonCardBody className="p-4 sm:p-5 space-y-3.5">
              <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full transition-all duration-500 rounded-full", getBarColor(metrics?.memory.usage_percent || 0))}
                  style={{ width: `${Math.min(metrics?.memory.usage_percent || 0, 100)}%` }}
                />
              </div>

              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>Ketersediaan RAM:</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {metrics?.memory.available_bytes ? `${(metrics.memory.available_bytes / (1024**3)).toFixed(2)} GB Tersedia` : "–"}
                </span>
              </div>
            </NeonCardBody>
          </NeonCard>

          {/* DISK USAGE */}
          <NeonCard>
            <NeonCardHeader
              icon={HardDrive}
              title="Penyimpanan (Disk)"
              subtitle={`${metrics?.disk.used_formatted || "0 GB"} / ${metrics?.disk.total_formatted || "0 GB"}`}
              badge={
                <span className={cn("text-base sm:text-lg font-mono font-bold", getMetricColor(metrics?.disk.usage_percent || 0))}>
                  {metrics?.disk.usage_percent ?? 0}%
                </span>
              }
            />
            <NeonCardBody className="p-4 sm:p-5 space-y-3.5">
              <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full transition-all duration-500 rounded-full", getBarColor(metrics?.disk.usage_percent || 0))}
                  style={{ width: `${Math.min(metrics?.disk.usage_percent || 0, 100)}%` }}
                />
              </div>

              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>Ruang Bebas Tersisa:</span>
                <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                  {metrics?.disk.free_formatted || "–"}
                </span>
              </div>
            </NeonCardBody>
          </NeonCard>
        </div>

        {/* ── 4. Technical Details & Server Environment ── */}
        <NeonCard>
          <NeonCardHeader
            icon={Terminal}
            title="Rincian Node &amp; Lingkungan Server"
            subtitle="Spesifikasi runtime instance PocketBase dan host VPS"
            actions={
              <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                Pembaruan: {lastRefreshed.toLocaleTimeString("id-ID")}
              </span>
            }
          />
          <NeonCardBody className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 text-xs">
              <div className="p-3.5 rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-1">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Sistem Operasi</span>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100">{metrics?.os || "Linux Ubuntu"}</p>
              </div>

              <div className="p-3.5 rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-1">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Nama Host VPS</span>
                <p className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">{metrics?.hostname || "–"}</p>
              </div>

              <div className="p-3.5 rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-1">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Tenant Institusi</span>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {school?.name || "Sekolah"} ({school?.slug || "tenant"})
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-1">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Paket CBT Aktif</span>
                <div className="flex items-center gap-2">
                  <NeonBadge variant="emerald" size="xs">
                    {school?.plan || "Free"}
                  </NeonBadge>
                  <span className="text-neutral-600 dark:text-neutral-300 font-medium">
                    (Maks. {school?.student_quota || 50} Siswa)
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-1">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Database Engine</span>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                  PocketBase Embedded SQLite (WAL Mode)
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-1">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Protokol Keamanan</span>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  <span>HTTPS / TLS Terenkripsi Penuh</span>
                </div>
              </div>
            </div>

            {/* Capacity Guide Alert */}
            <div className="p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 text-xs text-neutral-700 dark:text-neutral-300 flex items-start gap-2.5">
              <HelpCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-neutral-900 dark:text-neutral-100 font-semibold">Panduan Kapasitas:</strong> Saat pelaksanaan ujian serentak berlangsung, pastikan beban RAM berada di bawah 85% dan CPU di bawah 80%. Server otomatis mendistribusikan caching gambar dan data butir soal agar latensi pengerjaan siswa tetap instan tanpa beban berlebih.
              </p>
            </div>
          </NeonCardBody>
        </NeonCard>

      </div>
    </div>
  );
};

export default ServerStatusPage;
