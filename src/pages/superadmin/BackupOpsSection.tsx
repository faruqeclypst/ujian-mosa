import { useState, useEffect, useCallback } from "react";
import {
  Database, ShieldCheck, RefreshCw, Play, Terminal,
  CheckCircle2, AlertCircle, ChevronDown, HardDrive, Clock
} from "lucide-react";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";

interface JobInfo {
  last_run: string;
  summary: string;
  log: string[];
}

interface SnapshotInfo {
  slug: string;
  count: number;
  latest: string;
  total_mb: number;
}

interface OpsStatus {
  crons: string[];
  backup: JobInfo;
  fallback: JobInfo;
  snapshots: SnapshotInfo[];
}

const cronSchedule = (crons: string[], key: string): string => {
  const line = crons.find((c) => c.includes(key));
  if (!line) return "belum terpasang";
  const parts = line.trim().split(/\s+/).slice(0, 5).join(" ");
  if (parts.startsWith("0 2 ")) return "tiap hari 02:00";
  if (parts.startsWith("0 3 ")) return "tiap hari 03:00";
  return parts;
};

const summaryOk = (summary: string): boolean | null => {
  if (!summary) return null;
  if (/failed=\d*[1-9]|FAIL/i.test(summary)) return false;
  return true;
};

function JobCard({
  title, desc, icon: Icon, jobKey, info, crons, onRun, running,
}: {
  title: string;
  desc: string;
  icon: any;
  jobKey: "backup" | "fallback";
  info: JobInfo;
  crons: string[];
  onRun: (job: "backup" | "fallback") => void;
  running: string | null;
}) {
  const [showLog, setShowLog] = useState(false);
  const ok = summaryOk(info.summary);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Icon size={17} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">{title}</h4>
            <p className="text-[11px] text-slate-500">{desc}</p>
          </div>
        </div>
        {ok === true && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle2 size={11} /> OK
          </span>
        )}
        {ok === false && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
            <AlertCircle size={11} /> Gagal
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
            <Clock size={10} /> Jadwal
          </p>
          <p className="font-bold text-slate-800 mt-0.5">{cronSchedule(crons, jobKey === "backup" ? "backup-workers" : "auto-fallback")}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Eksekusi Terakhir</p>
          <p className="font-bold text-slate-800 mt-0.5">{info.last_run || "-"}</p>
        </div>
      </div>

      {info.summary && (
        <p className="text-[11px] font-mono text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 break-all">
          {info.summary}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onRun(jobKey)}
          disabled={running !== null}
          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
        >
          <Play size={13} className={cn(running === jobKey && "animate-pulse")} />
          <span>{running === jobKey ? "Berjalan..." : "Jalankan Sekarang"}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
        >
          <Terminal size={13} />
          <span>Log</span>
          <ChevronDown size={13} className={cn("transition-transform", showLog && "rotate-180")} />
        </button>
      </div>

      {showLog && (
        <div className="bg-slate-900 rounded-xl p-3 max-h-56 overflow-y-auto">
          {info.log.length === 0 ? (
            <p className="text-[11px] text-slate-400 font-mono">Belum ada log.</p>
          ) : (
            info.log.map((line, i) => (
              <p key={i} className="text-[10px] text-slate-300 font-mono leading-relaxed break-all">
                {line}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export const BackupOpsSection = () => {
  const [status, setStatus] = useState<OpsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await masterPb.send<OpsStatus>("/api/multi-vps/ops-status", { method: "GET" });
      if (res?.success !== false) setStatus(res);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleRun = async (job: "backup" | "fallback") => {
    setNotice("");
    setRunning(job);
    try {
      const res = await masterPb.send<any>(
        `/api/multi-vps/run-job?job=${job}`,
        { method: "POST" }
      );
      setNotice(res?.message || "Job dimulai.");
    } catch (err: any) {
      setNotice(err?.message || "Gagal menjalankan job.");
    } finally {
      setRunning(null);
      setTimeout(fetchStatus, 2500);
    }
  };

  const emptyJob: JobInfo = { last_run: "-", summary: "", log: [] };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-blue-600" />
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Operasional Backup & Pemulihan Bencana</h3>
        </div>
        <button
          type="button"
          onClick={fetchStatus}
          disabled={loading}
          className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={13} className={cn(loading && "animate-spin")} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {notice && (
        <div className="mb-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs p-3 rounded-xl">
          {notice}
        </div>
      )}

      {loading && !status ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-sm">
          Memuat status operasional...
        </div>
      ) : !status ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-sm">
          Endpoint operasional belum tersedia di Master VPS. Pastikan hook terbaru sudah terdeploy.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <JobCard
              title="Backup Harian Worker"
              desc="Snapshot DB semua tenant worker ke master (retensi 7 hari)"
              icon={Database}
              jobKey="backup"
              info={status.backup || emptyJob}
              crons={status.crons}
              onRun={handleRun}
              running={running}
            />
            <JobCard
              title="Auto-Fallback H-3"
              desc="Tarik otomatis tenant worker yang sisa masa aktif ≤ 3 hari"
              icon={ShieldCheck}
              jobKey="fallback"
              info={status.fallback || emptyJob}
              crons={status.crons}
              onRun={handleRun}
              running={running}
            />
          </div>

          {/* Snapshot overview */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive size={16} className="text-indigo-500" />
              <h4 className="text-sm font-bold text-slate-900">Snapshot Tersimpan di Master</h4>
            </div>
            {status.snapshots.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada snapshot. Backup pertama jalan tiap jam 02:00.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-slate-400 border-b border-slate-100">
                      <th className="pb-2 font-bold">Tenant</th>
                      <th className="pb-2 font-bold">Jumlah</th>
                      <th className="pb-2 font-bold">Terbaru</th>
                      <th className="pb-2 font-bold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {status.snapshots.map((s) => (
                      <tr key={s.slug}>
                        <td className="py-2 font-mono font-bold text-slate-800">{s.slug}</td>
                        <td className="py-2 text-slate-600">{s.count} file</td>
                        <td className="py-2 text-slate-600">{s.latest}</td>
                        <td className="py-2 text-right font-semibold text-slate-700">{s.total_mb} MB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
              Untuk memulihkan snapshot, buka tenant di Dashboard → tombol migrasi → tab <strong>3. Darurat</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
