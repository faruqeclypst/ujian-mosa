import { useEffect, useState, ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { masterPb } from "../../lib/pocketbase";
import { Download, LogOut, ShieldAlert } from "lucide-react";

interface AppVersionGuardProps {
  children: ReactNode;
}

interface AppSettingsRecord {
  id: string;
  app_name?: string;
  min_version_code?: number;
  min_version_name?: string;
  apk_url?: string;
  update_notes?: string;
  is_force_update?: boolean;
}

export const AppVersionGuard = ({ children }: AppVersionGuardProps) => {
  const [isOutdated, setIsOutdated] = useState(false);
  const [currentVersion, setCurrentVersion] = useState({ code: 1, name: "1.0" });
  const [requiredVersion, setRequiredVersion] = useState<AppSettingsRecord | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Pengecekan versi HANYA aktif pada platform native Capacitor (Android/iOS)
    if (!Capacitor.isNativePlatform()) {
      setChecking(false);
      return;
    }

    const checkAppVersion = async () => {
      try {
        const appInfo = await App.getInfo();
        const currentCode = parseInt(appInfo.build, 10) || 1;
        const currentName = appInfo.version || "1.0";
        setCurrentVersion({ code: currentCode, name: currentName });

        // Ambil konfigurasi versi dari Master PocketBase
        const records = await masterPb.collection("app_settings").getFullList<AppSettingsRecord>({
          limit: 1,
          sort: "-created",
        });

        if (records.length > 0) {
          const config = records[0];
          const minCode = Number(config.min_version_code) || 1;
          const force = config.is_force_update ?? false;

          // Jika force update aktif dan versi HP lebih rendah daripada versi minimal di Master PB
          if (force && currentCode < minCode) {
            setIsOutdated(true);
            setRequiredVersion(config);
          }
        }
      } catch (err) {
        console.warn("[AppVersionGuard] Gagal memeriksa versi dari Master PB:", err);
      } finally {
        setChecking(false);
      }
    };

    checkAppVersion();
  }, []);

  const handleDownload = () => {
    if (requiredVersion?.apk_url) {
      window.open(requiredVersion.apk_url, "_system");
    }
  };

  const handleExit = async () => {
    try {
      await App.exitApp();
    } catch (e) {
      window.close();
    }
  };

  if (checking) {
    return null;
  }

  // Jika terdeteksi versi usang, KUNCI tampilan aplikasi sepenuhnya
  if (isOutdated && requiredVersion) {
    return (
      <div className="fixed inset-0 z-[999999] bg-slate-950 flex items-center justify-center p-4 select-none font-sans">
        <div className="bg-slate-900 border border-slate-800 text-white rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-center">
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 relative z-10">
            <ShieldAlert className="w-10 h-10 text-rose-500 animate-pulse" />
          </div>

          <h2 className="text-2xl font-black tracking-tight mb-2">
            Pembaruan Diperlukan
          </h2>

          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
            Aplikasi <span className="font-bold text-white">{requiredVersion.app_name || "EXAM AA"}</span> di perangkat Anda sudah usang. Anda wajib memperbarui aplikasi ke versi terbaru untuk dapat mengakses ujian.
          </p>

          {/* Version Info Card */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 mb-6 text-left space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Versi Terpasang:</span>
              <span className="font-mono font-bold text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-800/30">
                v{currentVersion.name} (build {currentVersion.code})
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Versi Minimal:</span>
              <span className="font-mono font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/30">
                v{requiredVersion.min_version_name || requiredVersion.min_version_code} (build {requiredVersion.min_version_code})
              </span>
            </div>

            {requiredVersion.update_notes && (
              <div className="pt-2 border-t border-slate-800/80">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Catatan Pembaruan:</p>
                <p className="text-xs text-slate-300 italic whitespace-pre-line leading-relaxed">
                  "{requiredVersion.update_notes}"
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {requiredVersion.apk_url ? (
              <button
                onClick={handleDownload}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all text-sm uppercase tracking-wider"
              >
                <Download size={18} />
                Unduh APK Terbaru
              </button>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs">
                Hubungi pengawas atau operator sekolah untuk mengunduh APK versi terbaru.
              </div>
            )}

            <button
              onClick={handleExit}
              className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              <LogOut size={14} />
              Tutup Aplikasi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AppVersionGuard;
