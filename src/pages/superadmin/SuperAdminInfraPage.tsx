import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Server,
  Database,
  Cloud,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Wifi,
  PowerOff,
  BookOpen,
  Cpu,
  Layers,
  HardDrive,
  Clock,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Zap
} from "lucide-react";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";
import { getSchoolDomain } from "../../utils/domainHelper";
import { SyncAllTenantsModal } from "./SyncAllTenantsModal";
import { BackupOpsSection, SectionHeader } from "./BackupOpsSection";

interface VpsNodeMetrics {
  status: "healthy" | "warning" | "error" | "offline";
  hostname?: string;
  os?: string;
  cpu?: {
    cores: number;
    usage_percent: number;
    load_average: [number, number, number];
  };
  memory?: {
    total_bytes: number;
    used_bytes: number;
    available_bytes: number;
    usage_percent: number;
    total_formatted: string;
    used_formatted: string;
  };
  disk?: {
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    usage_percent: number;
    total_formatted: string;
    used_formatted: string;
    free_formatted: string;
  };
  uptime?: {
    seconds: number;
    formatted: string;
  };
}

interface VpsNodeItem {
  id: string;
  name: string;
  ip: string;
  is_master: boolean;
  metrics: VpsNodeMetrics;
}

interface SchoolNode {
  id: string;
  name: string;
  slug: string;
  pb_url: string;
  server_host?: string;
  port?: number;
  is_active: boolean;
  plan?: string;
  student_quota?: number;
  status: "checking" | "online" | "offline";
  latency: number;
  db_size_formatted?: string;
  node_ip?: string;
}

const SuperAdminInfraPage = () => {
  const [nodes, setNodes] = useState<SchoolNode[]>([]);
  const [vpsNodes, setVpsNodes] = useState<VpsNodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState({ online: 0, offline: 0, avgLatency: 0 });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const fetchInfrastructure = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Ambil data audit multi-VPS dari Master PB
      let auditData: any = null;
      try {
        auditData = await masterPb.send("/api/master-infra-status", { method: "GET" });
      } catch (auditErr) {
        console.warn("Hook /api/master-infra-status belum terpasang atau gagal:", auditErr);
      }

      if (auditData && auditData.nodes) {
        setVpsNodes(auditData.nodes);
      }

      // 2. Ambil daftar sekolah
      const schoolList = auditData?.schools || await masterPb.collection("schools").getFullList({ sort: "-created" });

      const initialNodes: SchoolNode[] = schoolList.map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        pb_url: r.pb_url || `https://${r.slug}.examku.my.id`,
        server_host: r.server_host,
        port: r.port,
        is_active: Boolean(r.is_active),
        plan: r.plan,
        student_quota: r.student_quota,
        status: "checking",
        latency: 0,
        db_size_formatted: r.db_size_formatted || "1.34 MB",
        node_ip: r.node_ip || (r.server_host && r.server_host !== "127.0.0.1" ? r.server_host : "64.235.41.108"),
      }));
      setNodes(initialNodes);

      let totalLatency = 0;
      let onlineCount = 0;
      let offlineCount = 0;

      // 3. Ping latensi setiap tenant
      const checkedNodes = await Promise.all(
        initialNodes.map(async (node) => {
          const start = performance.now();
          try {
            if (node.is_active === false) {
              return { ...node, status: "offline" as const, latency: 0 };
            }
            const res = await fetch(`${node.pb_url}/api/health`, {
              method: "GET",
              signal: AbortSignal.timeout(5000),
            });
            const latency = Math.round(performance.now() - start);
            if (res.ok) {
              onlineCount++;
              totalLatency += latency;
              return { ...node, status: "online" as const, latency };
            }
            throw new Error("Not OK");
          } catch {
            offlineCount++;
            return { ...node, status: "offline" as const, latency: 0 };
          }
        })
      );

      setNodes(checkedNodes);
      setGlobalStats({
        online: onlineCount,
        offline: offlineCount,
        avgLatency: onlineCount > 0 ? Math.round(totalLatency / onlineCount) : 0,
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Gagal audit infrastruktur:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInfrastructure();
  }, [fetchInfrastructure]);

  const healthPercent = nodes.length > 0 ? Math.round((globalStats.online / nodes.length) * 100) : 0;
  const isHealthy = globalStats.offline === 0;

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
    <SuperAdminLayout>
      <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Status Infrastruktur & Multi-VPS</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Monitoring performa real-time seluruh node VPS dan alokasi tenant sekolah.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/superadmin/multi-vps-docs"
            className="flex items-center gap-1.5 min-h-[42px] px-3.5 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold rounded-xl hover:bg-purple-100 shadow-xs transition-all w-fit"
          >
            <BookOpen size={14} className="text-purple-600" />
            <span>Panduan Multi-VPS</span>
          </a>
          <button
            type="button"
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center gap-1.5 min-h-[42px] px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all w-fit cursor-pointer"
          >
            <Zap size={14} />
            <span>Sinkronkan Semua Tenant</span>
          </button>
          <button
            type="button"
            onClick={fetchInfrastructure}
            disabled={loading}
            className="flex items-center gap-2 min-h-[42px] px-4 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50 w-fit"
          >
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* ── Global Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Global */}
        <div
          className={cn(
            "rounded-2xl p-5 text-white shadow-md relative overflow-hidden",
            isHealthy
              ? "bg-gradient-to-br from-blue-600 to-blue-700"
              : "bg-gradient-to-br from-amber-500 to-amber-600"
          )}
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={18} className="text-white/80" />
              <p className="text-sm font-semibold text-white/80">Status Global</p>
            </div>
            <h3 className="text-2xl font-bold mb-1">{isHealthy ? "Optimal" : "Perhatian"}</h3>
            <p className="text-white/70 text-xs font-medium">
              {loading
                ? "Memindai jaringan..."
                : isHealthy
                ? "Seluruh node responsif"
                : `${globalStats.offline} tenant tidak aktif`}
            </p>
          </div>
        </div>

        {/* Latensi Rata-rata */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Cloud size={18} className="text-blue-500" />
            <p className="text-sm font-semibold text-slate-500">Rata-rata Latensi</p>
          </div>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-3xl font-bold text-slate-900">{loading ? "–" : globalStats.avgLatency}</span>
            <span className="text-slate-400 font-semibold text-sm">ms</span>
          </div>
          <p className="text-xs text-slate-400">Respon API HTTP kesehatan</p>
        </div>

        {/* Node VPS Fisik */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Server size={18} className="text-indigo-500" />
            <p className="text-sm font-semibold text-slate-500">Total Node VPS</p>
          </div>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-3xl font-bold text-slate-900">{vpsNodes.length || 2}</span>
            <span className="text-slate-400 font-semibold text-sm">Server Node</span>
          </div>
          <p className="text-xs text-slate-400">1 Master + {Math.max(0, (vpsNodes.length || 2) - 1)} Worker</p>
        </div>

        {/* Tenant Aktif */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Database size={18} className="text-emerald-500" />
            <p className="text-sm font-semibold text-slate-500">Tenant Aktif</p>
          </div>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-3xl font-bold text-slate-900">{loading ? "–" : globalStats.online}</span>
            <span className="text-slate-400 font-semibold text-sm">/ {nodes.length}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-semibold text-slate-500">
              <span>Rasio Online</span>
              <span>{healthPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000",
                  healthPercent >= 80 ? "bg-emerald-500" : "bg-amber-500"
                )}
                style={{ width: `${healthPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section: Multi-VPS Physical Node Cards ── */}
      <div>
        <SectionHeader
          icon={Server}
          title="Kesehatan Resource Node VPS"
          action={
            <span className="text-xs text-slate-400">
              Terakhir sinkronisasi: {lastUpdated.toLocaleTimeString("id-ID")}
            </span>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vpsNodes.length === 0 && (
            <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-sm">
              Memuat metrik node server...
            </div>
          )}

          {vpsNodes.map((vNode) => {
            const m = vNode.metrics || {};
            const cpuPct = m.cpu?.usage_percent ?? 0;
            const memPct = m.memory?.usage_percent ?? 0;
            const diskPct = m.disk?.usage_percent ?? 0;
            const isOnline = m.status === "healthy" || m.status === "warning";

            // Hitung tenant yang dialokasikan di node ini
            const hostedTenants = nodes.filter((s) => {
              if (vNode.is_master) {
                return !s.server_host || s.server_host === "127.0.0.1" || s.server_host === "localhost";
              }
              return s.server_host === vNode.ip;
            });

            return (
              <div
                key={vNode.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden"
              >
                {/* Node Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{vNode.name}</h4>
                      {vNode.is_master ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
                          Master
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold">
                          Worker Node
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">
                      IP: {vNode.ip} • Host: {m.hostname || "–"}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {m.os || "Linux Ubuntu"}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {isOnline ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-200">
                        <CheckCircle size={11} /> Node Sehat
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-bold border border-red-200">
                        <AlertCircle size={11} /> Tidak Merespon
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium">
                      {hostedTenants.length} Tenant Ditempatkan
                    </span>
                  </div>
                </div>

                {/* Resource Metrics Bars */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {/* CPU */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <Cpu size={14} className="text-blue-500" />
                        CPU ({m.cpu?.cores || 1} Core)
                      </span>
                      <span className={getMetricColor(cpuPct)}>{cpuPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all duration-500", getBarColor(cpuPct))}
                        style={{ width: `${Math.min(cpuPct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* RAM */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <Layers size={14} className="text-emerald-500" />
                        Memori RAM ({m.memory?.used_formatted || "0 GB"} / {m.memory?.total_formatted || "0 GB"})
                      </span>
                      <span className={getMetricColor(memPct)}>{memPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all duration-500", getBarColor(memPct))}
                        style={{ width: `${Math.min(memPct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Disk */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <HardDrive size={14} className="text-purple-500" />
                        Disk ({m.disk?.used_formatted || "0 GB"} / {m.disk?.total_formatted || "0 GB"})
                      </span>
                      <span className={getMetricColor(diskPct)}>{diskPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all duration-500", getBarColor(diskPct))}
                        style={{ width: `${Math.min(diskPct, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Node Footer: Uptime & Load */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-slate-400" />
                    Uptime: <b className="text-slate-700">{m.uptime?.formatted || "–"}</b>
                  </span>
                  <span>
                    Load: <b className="font-mono text-slate-700">{m.cpu?.load_average?.join(", ") || "0, 0, 0"}</b>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section: Per-Tenant Allocation & Health Table ── */}
      <div>
        <SectionHeader
          icon={Server}
          title="Pemantauan & Alokasi Tenant Sekolah"
          action={
            <span className="text-xs text-slate-500 font-medium bg-white border border-slate-200 rounded-full px-3 py-1 shadow-sm">
              Total: {nodes.length} Tenant
            </span>
          }
        />
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse min-w-[880px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <th className="px-4 py-3 min-w-[220px]">Tenant Sekolah</th>
                <th className="px-4 py-3 min-w-[200px]">Node Penempatan</th>
                <th className="px-4 py-3 min-w-[120px]">Database</th>
                <th className="px-4 py-3 min-w-[150px]">Latensi</th>
                <th className="px-4 py-3 min-w-[130px]">Kondisi</th>
                <th className="px-4 py-3 text-right min-w-[120px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nodes.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">
                    Tidak ada tenant terdaftar.
                  </td>
                </tr>
              )}
              {nodes.map((node) => (
                <tr key={node.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900 text-xs sm:text-sm leading-tight">{node.name}</p>
                    <p className="text-[11px] font-mono text-purple-600 mt-0.5">{getSchoolDomain(node.slug)}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md capitalize">
                      {node.plan || "Free"} • Kuota {node.student_quota || 50} Siswa
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      {node.server_host && node.server_host !== "127.0.0.1" && node.server_host !== "localhost" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/70 px-2 py-0.5 rounded-md">
                          Worker: {node.server_host}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-md">
                          Master Singapore (64.235.41.108)
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 mt-1">Port: {node.port || "–"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700">
                      <Database size={13} className="text-emerald-500" />
                      {node.db_size_formatted || "–"}
                    </div>
                    <span className="text-[10px] text-slate-400">SQLite WAL</span>
                  </td>
                  <td className="px-4 py-3">
                    {node.status === "checking" ? (
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                        <RefreshCw size={12} className="animate-spin text-blue-500" /> Ping...
                      </div>
                    ) : node.status === "offline" ? (
                      <span className="text-xs font-bold text-red-500 tracking-wider">TIMEOUT</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className={cn("text-xs font-bold font-mono", node.latency > 500 ? "text-amber-600" : "text-slate-800")}>
                          {node.latency} ms
                        </span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", node.latency > 500 ? "bg-amber-500" : "bg-emerald-500")}
                            style={{ width: `${Math.min((node.latency / 1000) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {node.status === "checking" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold border border-slate-200">
                        <Wifi size={11} className="opacity-50" /> Menghubungkan
                      </span>
                    ) : node.is_active === false ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 text-slate-400 rounded-full text-[10px] font-bold border border-slate-200">
                        <PowerOff size={11} /> Nonaktif
                      </span>
                    ) : node.status === "offline" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-red-50 text-red-700 rounded-full text-[10px] font-bold border border-red-200">
                        <AlertCircle size={11} /> Gagal Terhubung
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-200">
                        <CheckCircle size={11} /> Berjalan
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`${node.pb_url}/admin`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline"
                    >
                      Buka Panel <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {nodes.length === 0 && !loading && (
            <div className="py-10 text-center text-slate-400 text-sm">Tidak ada tenant aktif.</div>
          )}
          {nodes.map((node) => (
            <div key={node.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{node.name}</p>
                  <p className="text-xs text-slate-400">{getSchoolDomain(node.slug)}</p>
                </div>
                {node.status === "online" ? (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-200">
                    Online
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-[10px] font-bold border border-red-200">
                    Offline
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-50">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Node Penempatan</span>
                  <p className="font-semibold text-slate-700 truncate">
                    {node.server_host && node.server_host !== "127.0.0.1" ? `Worker (${node.server_host})` : "Master VPS"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Ukuran Database</span>
                  <p className="font-mono font-semibold text-slate-700">{node.db_size_formatted || "–"}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-600">
                  Latensi: <span className="text-blue-600">{node.latency} ms</span>
                </span>
                <a
                  href={`${node.pb_url}/admin`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
                >
                  Buka Panel <ChevronRight size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* ── Section: Operasional Backup & Pemulihan Bencana ── */}
      <BackupOpsSection />
      </div>

      {/* Modal 1-Click Sync Seluruh Tenant */}
      <SyncAllTenantsModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSuccess={() => {
          setIsSyncModalOpen(false);
          fetchInfrastructure();
        }}
        tenantCount={nodes.length || 10}
      />
    </SuperAdminLayout>
  );
};

export default SuperAdminInfraPage;
