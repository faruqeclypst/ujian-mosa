import { useState, useEffect } from "react";
import { Activity, Server, Database, Cloud, CheckCircle, RefreshCw, AlertCircle, Wifi, PowerOff } from "lucide-react";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";

interface SchoolNode {
  id: string;
  name: string;
  slug: string;
  pb_url: string;
  is_active: boolean;
  status: "checking" | "online" | "offline";
  latency: number;
}

const SuperAdminInfraPage = () => {
  const [nodes, setNodes] = useState<SchoolNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState({ online: 0, offline: 0, avgLatency: 0 });

  const fetchAndPingNodes = async () => {
    setLoading(true);
    try {
      const records = await masterPb.collection("schools").getFullList({ sort: "-created" });
      const initialNodes: SchoolNode[] = records.map(r => ({
        id: r.id, name: r.name, slug: r.slug, pb_url: r.pb_url, is_active: r.is_active,
        status: "checking", latency: 0,
      }));
      setNodes(initialNodes);

      let totalLatency = 0;
      let onlineCount = 0;
      let offlineCount = 0;

      const checkedNodes = await Promise.all(initialNodes.map(async (node) => {
        const start = performance.now();
        try {
          if (node.is_active === false) {
            return { ...node, status: "offline" as const, latency: 0 };
          }
          const res = await fetch(`${node.pb_url}/api/health`, { method: "GET", signal: AbortSignal.timeout(5000) });
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
      }));

      setNodes(checkedNodes);
      setGlobalStats({
        online: onlineCount,
        offline: offlineCount,
        avgLatency: onlineCount > 0 ? Math.round(totalLatency / onlineCount) : 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAndPingNodes(); }, []);

  const healthPercent = nodes.length > 0 ? Math.round((globalStats.online / nodes.length) * 100) : 0;
  const isHealthy = globalStats.offline === 0;

  return (
    <SuperAdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Status Infrastruktur</h2>
          <p className="text-slate-500 text-sm mt-0.5">Monitoring latensi realtime ke seluruh tenant node.</p>
        </div>
        <button
          onClick={fetchAndPingNodes}
          disabled={loading}
          className="flex items-center gap-2 h-9 px-4 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50 w-fit"
        >
          <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          Segarkan
        </button>
      </div>

      {/* Global Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Status Card */}
        <div className={cn(
          "rounded-xl p-5 text-white shadow-md relative overflow-hidden",
          isHealthy ? "bg-gradient-to-br from-blue-600 to-blue-700" : "bg-gradient-to-br from-amber-500 to-amber-600"
        )}>
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={18} className="text-white/80" />
              <p className="text-sm font-semibold text-white/80">Status Global</p>
            </div>
            <h3 className="text-2xl font-bold mb-1">{isHealthy ? "Excellent" : "Perhatian"}</h3>
            <p className="text-white/70 text-xs font-medium">
              {loading ? "Memindai jaringan..." : isHealthy ? "Seluruh node responsif" : `${globalStats.offline} node offline`}
            </p>
          </div>
        </div>

        {/* Latency Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Cloud size={18} className="text-blue-500" />
            <p className="text-sm font-semibold text-slate-500">Rata-rata Latensi</p>
          </div>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-3xl font-bold text-slate-900">{loading ? "–" : globalStats.avgLatency}</span>
            <span className="text-slate-400 font-semibold text-sm">ms</span>
          </div>
          <p className="text-xs text-slate-400">Dari endpoint /api/health</p>
        </div>

        {/* Node Health */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Database size={18} className="text-emerald-500" />
            <p className="text-sm font-semibold text-slate-500">Node Aktif</p>
          </div>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-3xl font-bold text-slate-900">{loading ? "–" : globalStats.online}</span>
            <span className="text-slate-400 font-semibold text-sm">/ {nodes.length}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-semibold text-slate-500">
              <span>Uptime</span>
              <span>{healthPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-1000", healthPercent >= 80 ? "bg-emerald-500" : "bg-amber-500")}
                style={{ width: `${healthPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Node Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <Server size={16} className="text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Pemantauan Server Individu</h3>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tenant</th>
                <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">URL Protokol</th>
                <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Latensi</th>
                <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kondisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nodes.length === 0 && !loading && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-sm">Tidak ada tenant terdaftar.</td></tr>
              )}
              {nodes.map(node => (
                <tr key={node.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-900 text-sm">{node.name}</p>
                    <p className="text-xs text-slate-400">{node.slug}.alfaruqasri.my.id</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <a href={node.pb_url} target="_blank" rel="noreferrer"
                      className="text-xs font-mono bg-slate-100 border border-slate-200 px-2 py-1 rounded-md text-blue-600 hover:underline inline-block">
                      {node.pb_url}
                    </a>
                  </td>
                  <td className="px-5 py-3.5">
                    {node.status === "checking" ? (
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                        <RefreshCw size={12} className="animate-spin" /> Ping...
                      </div>
                    ) : node.status === "offline" ? (
                      <span className="text-xs font-bold text-red-500 tracking-widest">TIMEOUT</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className={cn("text-sm font-bold", node.latency > 500 ? "text-amber-600" : "text-slate-800")}>
                          {node.latency}ms
                        </span>
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", node.latency > 500 ? "bg-amber-500" : "bg-emerald-500")}
                            style={{ width: `${Math.min((node.latency / 1000) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {node.status === "checking" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold border border-slate-200">
                        <Wifi size={11} className="opacity-50" /> Menghubungkan
                      </span>
                    ) : node.is_active === false ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-400 rounded-full text-[10px] font-bold border border-slate-200">
                        <PowerOff size={11} /> Sistem Nonaktif
                      </span>
                    ) : node.status === "offline" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-bold border border-red-200">
                        <AlertCircle size={11} /> Gagal Terhubung
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-200">
                        <CheckCircle size={11} /> Server Berjalan
                      </span>
                    )}
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
          {nodes.map(node => (
            <div key={node.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{node.name}</p>
                  <p className="text-xs text-slate-400">{node.slug}.alfaruqasri.my.id</p>
                </div>
                {node.status === "checking" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold border border-slate-200 flex-shrink-0">
                    <RefreshCw size={10} className="animate-spin" /> Cek
                  </span>
                ) : node.is_active === false ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-[10px] font-bold border border-slate-200 flex-shrink-0">
                    <PowerOff size={10} /> Nonaktif
                  </span>
                ) : node.status === "offline" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[10px] font-bold border border-red-200 flex-shrink-0">
                    <AlertCircle size={10} /> Offline
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-200 flex-shrink-0">
                    <CheckCircle size={10} /> Online
                  </span>
                )}
              </div>

              {node.status === "online" && (
                <div className="flex items-center gap-3">
                  <span className={cn("text-sm font-bold", node.latency > 500 ? "text-amber-600" : "text-emerald-600")}>
                    {node.latency}ms
                  </span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", node.latency > 500 ? "bg-amber-500" : "bg-emerald-500")}
                      style={{ width: `${Math.min((node.latency / 1000) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </SuperAdminLayout>
  );
};

export default SuperAdminInfraPage;
