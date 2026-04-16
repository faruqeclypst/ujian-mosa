import { useState, useEffect } from "react";
import { Activity, Server, Database, Cloud, CheckCircle, RefreshCw, AlertCircle } from "lucide-react";
import SuperAdminLayout from "../../components/layout/SuperAdminLayout";
import { masterPb } from "../../lib/pocketbase";

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
      // Dapatkan semua sekolah aktif dari Master Database
      const records = await masterPb.collection("schools").getFullList({ filter: 'is_active=true' });
      
      const initialNodes: SchoolNode[] = records.map(r => ({
        id: r.id, name: r.name, slug: r.slug, pb_url: r.pb_url, is_active: r.is_active,
        status: "checking", latency: 0
      }));
      setNodes(initialNodes);

      // Ping setiap URL node untuk mengecek health status dari Pocketbase instance klien
      let totalLatency = 0;
      let onlineCount = 0;
      let offlineCount = 0;

      const checkedNodes = await Promise.all(initialNodes.map(async (node) => {
        const start = performance.now();
        try {
          // Pocketbase memiliki endpoint bawaan /api/health
          const res = await fetch(`${node.pb_url}/api/health`, { method: "GET", signal: AbortSignal.timeout(5000) });
          const latency = Math.round(performance.now() - start);
          if (res.ok) {
            onlineCount++;
            totalLatency += latency;
            return { ...node, status: "online", latency } as SchoolNode;
          }
          throw new Error("Not OK");
        } catch (err) {
          offlineCount++;
          return { ...node, status: "offline", latency: 0 } as SchoolNode;
        }
      }));

      setNodes(checkedNodes);
      setGlobalStats({ 
        online: onlineCount, 
        offline: offlineCount, 
        avgLatency: onlineCount > 0 ? Math.round(totalLatency / onlineCount) : 0 
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndPingNodes();
  }, []);

  return (
    <SuperAdminLayout>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1">
            Status Infrastruktur
          </h2>
          <p className="text-slate-500 font-medium text-sm">Monitoring latensi realtime ke seluruh tenant node E-Ujian.</p>
        </div>
        <button 
          onClick={fetchAndPingNodes}
          disabled={loading}
          className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Segarkan Data
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className={`${globalStats.offline > 0 ? 'bg-amber-600' : 'bg-blue-600'} rounded-2xl p-6 text-white shadow-md relative overflow-hidden transition-colors`}>
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-4">
            <Activity size={24} className="text-white/80" />
            <h3 className="font-bold text-lg">Infrastruktur Global</h3>
          </div>
          <div className="text-4xl font-black mb-2">{globalStats.offline > 0 ? "Warning" : "Excellent"}</div>
          <p className="text-white/80 text-sm font-medium">
            {loading ? "Sedang memindai jaringan..." : globalStats.offline > 0 ? `${globalStats.offline} node target terdeteksi offline` : "Seluruh node responsif."}
          </p>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Cloud size={24} className="text-blue-600" />
            <h3 className="font-bold text-lg text-slate-900">Rata-rata Latensi Jaringan</h3>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-black text-slate-900">{loading ? "--" : globalStats.avgLatency}</span>
            <span className="text-slate-500 font-semibold tracking-wider">MS</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Durasi balasan dari API /health</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Database size={24} className="text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">Node Tenant Aktif</h3>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-black text-slate-900">{loading ? "--" : globalStats.online}</span>
            <span className="text-slate-500 font-semibold tracking-wider">/ {nodes.length} INSTANSI</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-3">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
              style={{ width: `${nodes.length > 0 ? (globalStats.online / nodes.length) * 100 : 0}%` }} 
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Server size={20} className="text-blue-600" /> Pemantauan Server Individu
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4">Layanan Target (Tenant)</th>
                <th className="px-6 py-4">Protokol URL / IP</th>
                <th className="px-6 py-4">Waktu Respon (Latensi)</th>
                <th className="px-6 py-4">Kondisi Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nodes.length === 0 && !loading && (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500 font-medium">Tidak ada tenant aktif.</td></tr>
              )}
              {nodes.map((node) => (
                <tr key={node.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900 text-sm mb-0.5">{node.name}</p>
                    <p className="text-xs text-slate-500 font-medium">{node.slug}.alfaruqasri.my.id</p>
                  </td>
                  <td className="px-6 py-4">
                    <a href={node.pb_url} target="_blank" rel="noreferrer" className="text-xs font-mono bg-slate-100 px-2 py-1.5 rounded text-blue-600 hover:underline">
                      {node.pb_url}
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    {node.status === "checking" ? (
                      <span className="text-slate-400 text-xs font-bold flex items-center gap-2"><RefreshCw size={12} className="animate-spin" /> Ping...</span>
                    ) : node.status === "offline" ? (
                      <span className="text-red-500 text-xs font-bold tracking-widest">TIMEOUT</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold w-10 ${node.latency > 500 ? 'text-amber-600' : 'text-slate-800'}`}>{node.latency}ms</span>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${node.latency > 500 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${Math.min((node.latency / 1000) * 100, 100)}%` }} 
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {node.status === "checking" ? (
                       <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold border border-slate-200">
                         Menghubungkan
                       </div>
                    ) : node.status === "offline" ? (
                       <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-bold border border-red-200">
                         <AlertCircle size={12} /> Gagal Terhubung
                       </div>
                    ) : (
                       <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-200">
                         <CheckCircle size={12} /> Server Berjalan
                       </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminLayout>
  );
};

export default SuperAdminInfraPage;
