import { useState, useEffect } from "react";
import {
  X, Cpu, Server, Check, RefreshCw, AlertCircle, Copy,
  ArrowRight, ShieldCheck, Database, Zap, CheckCircle2,
  Terminal, ExternalLink
} from "lucide-react";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";

interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  pb_url: string;
  server_host?: string;
  student_quota?: number;
}

interface OneClickMigrationModalProps {
  school: SchoolRecord;
  onClose: () => void;
  onSuccess: () => void;
}

const MIGRATION_STEPS = [
  "Memeriksa otentikasi & konektivitas server",
  "Menghentikan service sementara untuk integritas data",
  "Sinkronisasi database SQLite & bank soal via rsync",
  "Mengalihkan Caddy reverse-proxy & sertifikat SSL",
  "Memulai service PocketBase di server tujuan",
  "Migrasi selesai dan tenant aktif!"
];

export const OneClickMigrationModal = ({
  school,
  onClose,
  onSuccess
}: OneClickMigrationModalProps) => {
  const isCurrentlyOnWorker = Boolean(
    school.server_host &&
    school.server_host !== "127.0.0.1" &&
    school.server_host !== "localhost"
  );

  const [direction, setDirection] = useState<"to_worker" | "to_master">(
    isCurrentlyOnWorker ? "to_master" : "to_worker"
  );

  const [workerHost, setWorkerHost] = useState<string>(() => {
    if (isCurrentlyOnWorker && school.server_host) return school.server_host;
    return localStorage.getItem("last_worker_ip") || "";
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latency_ms?: number;
    pb_ready?: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  const [migrating, setMigrating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [copiedSetupCmd, setCopiedSetupCmd] = useState(false);

  const setupWorkerOneLiner = "curl -sSL https://raw.githubusercontent.com/faruqeclypst/ujian-mosa/feature/saas-v2/vps/setup_worker_node.sh | bash";

  const handleCopySetup = () => {
    navigator.clipboard.writeText(setupWorkerOneLiner);
    setCopiedSetupCmd(true);
    setTimeout(() => setCopiedSetupCmd(false), 2000);
  };

  const handleTestConnection = async () => {
    const target = workerHost.trim();
    if (!target) {
      setError("Silakan masukkan IP Worker VPS terlebih dahulu.");
      return;
    }
    setError("");
    setTesting(true);
    setTestResult(null);

    try {
      const res = await masterPb.send<any>(
        `/api/multi-vps/test-connection?host=${encodeURIComponent(target)}`,
        { method: "POST" }
      );
      setTestResult(res);
      if (res.success) {
        localStorage.setItem("last_worker_ip", target);
      } else {
        setError(res.error || "Gagal terhubung ke worker.");
      }
    } catch (err: any) {
      setError(err?.message || "Gagal menghubungi API Master VPS.");
    } finally {
      setTesting(false);
    }
  };

  const handleExecuteMigration = async () => {
    setError("");
    if (direction === "to_worker" && !workerHost.trim()) {
      setError("Silakan tentukan IP Worker VPS tujuan.");
      return;
    }

    setMigrating(true);
    setCurrentStep(0);

    const target = direction === "to_worker" ? workerHost.trim() : "127.0.0.1";

    try {
      // Step 1: Validasi
      setCurrentStep(0);
      await new Promise(r => setTimeout(r, 600));

      // Step 2: Hentikan service
      setCurrentStep(1);
      await new Promise(r => setTimeout(r, 700));

      // Step 3: Sinkronisasi rsync
      setCurrentStep(2);

      const res = await masterPb.send<any>(
        `/api/multi-vps/migrate?slug=${encodeURIComponent(school.slug)}&target_host=${encodeURIComponent(target)}&direction=${direction}`,
        { method: "POST" }
      );

      // Step 4: Routing Caddy
      setCurrentStep(3);
      await new Promise(r => setTimeout(r, 600));

      // Step 5: Start service
      setCurrentStep(4);
      await new Promise(r => setTimeout(r, 600));

      if (res.success) {
        setCurrentStep(5);
        setSuccessMessage(res.message || "Migrasi berhasil!");
        if (direction === "to_worker") {
          localStorage.setItem("last_worker_ip", target);
        }
        setTimeout(() => {
          onSuccess();
        }, 1600);
      } else {
        throw new Error(res.error || res.message || "Migrasi gagal.");
      }
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat mengeksekusi migrasi otomatis.");
      setMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 text-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <Cpu size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Migrasi Server & Burst Mode</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/40 text-purple-200">
                  1-Klik Otomatis
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Pindahkan database & traffic ujian antar server secara otomatis tanpa ganti domain.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={migrating}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* School Info Strip */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-5 py-3 flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-slate-900">{school.name}</p>
            <p className="text-slate-500 font-mono text-[11px]">{school.slug}.examku.my.id</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-500">Lokasi Server Saat Ini:</p>
            <div className="flex items-center gap-1.5 justify-end mt-0.5">
              {isCurrentlyOnWorker ? (
                <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md text-[11px]">
                  <Cpu size={11} className="text-purple-600" /> Worker: {school.server_host}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md text-[11px]">
                  <Server size={11} className="text-blue-600" /> Master VPS (Lokal)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-start gap-2">
              <AlertCircle size={15} className="text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Gagal Melakukan Migrasi</p>
                <p className="mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
              <p className="font-bold">{successMessage}</p>
            </div>
          )}

          {/* Mode Switcher */}
          {!migrating && !successMessage && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => { setDirection("to_worker"); setTestResult(null); setError(""); }}
                className={cn(
                  "py-2 px-3 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5",
                  direction === "to_worker"
                    ? "bg-white text-purple-900 shadow-xs border border-purple-200"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Zap size={13} className={direction === "to_worker" ? "text-purple-600" : "text-slate-400"} />
                1. Mulai Ujian (Ke Worker)
              </button>

              <button
                type="button"
                onClick={() => { setDirection("to_master"); setTestResult(null); setError(""); }}
                className={cn(
                  "py-2 px-3 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5",
                  direction === "to_master"
                    ? "bg-white text-blue-900 shadow-xs border border-blue-200"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Database size={13} className={direction === "to_master" ? "text-blue-600" : "text-slate-400"} />
                2. Selesai Ujian (Ke Master)
              </button>
            </div>
          )}

          {/* Mode 1: To Worker */}
          {direction === "to_worker" && !migrating && !successMessage && (
            <div className="space-y-3.5">
              <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    IP Address Worker VPS Tujuan
                  </label>
                  <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                    Burst Mode Ujian
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Server size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={workerHost}
                      onChange={(e) => { setWorkerHost(e.target.value); setTestResult(null); }}
                      placeholder="cth. 103.123.45.67"
                      className="w-full h-10 border border-purple-200 rounded-xl pl-9 pr-3.5 text-xs text-slate-900 bg-white font-mono placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing || !workerHost.trim()}
                    className="h-10 px-3.5 rounded-xl bg-white border border-purple-300 text-purple-700 text-xs font-bold hover:bg-purple-50 transition-all flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0 cursor-pointer"
                  >
                    <RefreshCw size={13} className={cn(testing && "animate-spin")} />
                    <span>{testing ? "Menguji..." : "Tes Koneksi"}</span>
                  </button>
                </div>

                {testResult && (
                  <div className={cn(
                    "text-[11px] p-2.5 rounded-lg border font-medium flex items-center gap-2",
                    testResult.success
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  )}>
                    {testResult.success ? (
                      <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle size={14} className="text-rose-600 flex-shrink-0" />
                    )}
                    <span>{testResult.message || testResult.error}</span>
                  </div>
                )}
              </div>

              {/* Quick Setup Worker Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                    <Terminal size={13} className="text-slate-500" />
                    Belum setup VPS baru? Jalankan 1 baris ini di worker:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySetup}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedSetupCmd ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedSetupCmd ? "Tersalin!" : "Salin Perintah"}</span>
                  </button>
                </div>
                <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono text-[10px] select-all overflow-x-auto leading-relaxed">
                  {setupWorkerOneLiner}
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Script ini otomatis menginstal PocketBase dan menyambungkan kunci SSH Master VPS ke worker tanpa perlu edit file apapun secara manual.
                </p>
              </div>
            </div>
          )}

          {/* Mode 2: To Master */}
          {direction === "to_master" && !migrating && !successMessage && (
            <div className="space-y-3">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                  <Database size={15} className="text-blue-700" />
                  <span>Tarik Database Balik ke Master VPS (Ujian Usai)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Semua jawaban siswa, nilai ujian, dan perubahan data yang terjadi selama ujian di Worker Node (<code className="font-mono text-slate-800">{school.server_host || "Worker"}</code>) akan disinkronkan 100% kembali ke database Master VPS.
                </p>
                <div className="bg-white p-2.5 rounded-lg border border-blue-100 text-[11px] text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">Setelah ditarik ke Master:</p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px]">
                    <li>Siswa & guru tetap dapat melihat nilai dan review ujian tanpa kendala.</li>
                    <li>VPS Worker aman untuk dimatikan atau dihapus tanpa biaya berjalan.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Progress State while Migrating */}
          {migrating && (
            <div className="py-4 space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mx-auto border border-purple-200 shadow-xs">
                  <RefreshCw size={24} className="animate-spin text-purple-600" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 pt-2">
                  Sedang Menjalankan Migrasi 1-Klik...
                </h4>
                <p className="text-xs text-slate-500">
                  {direction === "to_worker"
                    ? `Memindahkan database & routing ke Worker ${workerHost}`
                    : "Menarik database terbaru kembali ke Master VPS"}
                </p>
              </div>

              <div className="space-y-2 max-w-md mx-auto pt-2">
                {MIGRATION_STEPS.map((step, idx) => {
                  const isDone = currentStep > idx;
                  const isCurrent = currentStep === idx;
                  return (
                    <div
                      key={step}
                      className={cn(
                        "flex items-center gap-2.5 text-xs p-2 rounded-lg transition-all",
                        isDone
                          ? "text-emerald-700 bg-emerald-50/70 font-semibold"
                          : isCurrent
                            ? "text-purple-700 bg-purple-50 font-bold border border-purple-200"
                            : "text-slate-400"
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
                      ) : isCurrent ? (
                        <RefreshCw size={13} className="animate-spin text-purple-600 flex-shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-300 flex-shrink-0" />
                      )}
                      <span>{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!migrating && !successMessage && (
          <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-white transition-all cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleExecuteMigration}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm flex items-center gap-2 cursor-pointer",
                direction === "to_worker"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {direction === "to_worker" ? (
                <>
                  <Zap size={14} />
                  <span>Mulai Migrasi 1-Klik ke Worker</span>
                </>
              ) : (
                <>
                  <Database size={14} />
                  <span>Tarik Database Balik ke Master (1-Klik)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
