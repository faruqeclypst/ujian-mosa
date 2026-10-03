import React, { useState } from "react";
import {
  X,
  Zap,
  Server,
  Database,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Check
} from "lucide-react";
import { masterPb } from "../../lib/pocketbase";
import { cn } from "../../lib/utils";

interface SyncAllTenantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantCount?: number;
}

const SYNC_STEPS = [
  "Memeriksa kesiapan template & konektivitas VPS Master ke Worker",
  "Menyinkronkan file hooks & optimasi ke seluruh tenant di Master VPS",
  "Menyinkronkan hooks & template ke Worker VPS (43.134.175.87)",
  "Memulai ulang service PocketBase pada seluruh sekolah",
  "Sinkronisasi berhasil! Seluruh tenant telah mutakhir."
];

export const SyncAllTenantsModal: React.FC<SyncAllTenantsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tenantCount = 10
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<{
    success: boolean;
    message?: string;
    master_tenants?: string[];
    worker_tenants?: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleStartSync = async () => {
    setErrorMsg(null);
    setIsSyncing(true);
    setCurrentStep(0);

    try {
      // Step 1: Validasi
      setCurrentStep(0);
      await new Promise((r) => setTimeout(r, 600));

      // Step 2: Mulai eksekusi
      setCurrentStep(1);

      const res = await masterPb.send<any>("/api/multi-vps/sync-all-tenants", {
        method: "POST"
      });

      // Step 3 & 4
      setCurrentStep(2);
      await new Promise((r) => setTimeout(r, 600));
      setCurrentStep(3);
      await new Promise((r) => setTimeout(r, 600));

      if (res && res.success) {
        setCurrentStep(4);
        setResultData(res);
        setTimeout(() => {
          onSuccess();
        }, 1800);
      } else {
        throw new Error(res?.error || res?.message || "Gagal menyinkronkan tenant.");
      }
    } catch (err: any) {
      console.error("Gagal sinkronisasi tenant:", err);
      setErrorMsg(
        err?.message || "Terjadi kesalahan saat mengeksekusi sinkronisasi tenant."
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Zap size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Sinkronkan Seluruh Tenant (1-Klik)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Otomasi penyelarasan hooks dan skema database untuk {tenantCount} sekolah.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Info Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
              <ShieldCheck size={16} className="text-emerald-500" />
              <span>Sumber Rujukan: Template Master / Modal Bangsa</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              Tindakan ini akan menyebarkan seluruh file hooks terbaru (patch keamanan, performa SQLite, hitungan ujian) dan memastikan seluruh tenant di <strong>Master Singapore (64.235.41.108)</strong> dan <strong>Worker Node (43.134.175.87)</strong> menggunakan konfigurasi seragam tanpa menghapus data siswa atau ujian sekolah.
            </p>
          </div>

          {/* Cakupan Node */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold mb-0.5">
                <Server size={14} />
                <span>Master VPS</span>
              </div>
              <p className="text-[11px] text-slate-500">4 Tenant Sekolah</p>
            </div>
            <div className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold mb-0.5">
                <Database size={14} />
                <span>Worker Node</span>
              </div>
              <p className="text-[11px] text-slate-500">6 Tenant Sekolah</p>
            </div>
          </div>

          {/* Stepper Progress jika sedang berjalan */}
          {isSyncing && (
            <div className="p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-300">
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                  Sedang Menyelaraskan...
                </span>
                <span>{Math.round(((currentStep + 1) / SYNC_STEPS.length) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${((currentStep + 1) / SYNC_STEPS.length) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                {SYNC_STEPS[currentStep]}
              </p>
            </div>
          )}

          {/* Sukses Banner */}
          {resultData?.success && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold">Sinkronisasi Selesai!</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {resultData.message || "Seluruh tenant berhasil diperbarui."}
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
              <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Gagal Menyelaraskan</p>
                <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
          >
            Tutup
          </button>
          {!resultData?.success && (
            <button
              type="button"
              onClick={handleStartSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Zap size={14} />
                  <span>Mulai Sinkronkan Sekarang</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
