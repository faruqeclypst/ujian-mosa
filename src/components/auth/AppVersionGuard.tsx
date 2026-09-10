import { useEffect, useState, ReactNode } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { masterPb } from "../../lib/pocketbase";
import { Download, LogOut, ShieldAlert, Copy, Check } from "lucide-react";

const CheatAlert = registerPlugin<any>("CheatAlert");

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
  const [copied, setCopied] = useState(false);

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

            // Segera unpin layar agar siswa tidak terjebak dan bisa membuka browser
            try {
              await CheatAlert.disableLockForUpdate();
            } catch (e) {
              console.warn("[AppVersionGuard] Gagal melepas lock task secara otomatis:", e);
            }
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

  const handleDownload = async () => {
    if (!requiredVersion?.apk_url) return;

    try {
      if (Capacitor.isNativePlatform()) {
        await CheatAlert.openUrlAndExit({ url: requiredVersion.apk_url });
        return;
      }
    } catch (e) {
      console.warn("[AppVersionGuard] Gagal membuka URL via native plugin:", e);
    }

    // Fallback standard browser
    window.open(requiredVersion.apk_url, "_system");
  };

  const handleCopyLink = () => {
    if (!requiredVersion?.apk_url) return;
    navigator.clipboard.writeText(requiredVersion.apk_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleExit = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          await CheatAlert.exitApp();
          return;
        } catch (e) {}
        await App.exitApp();
      } else {
        window.close();
      }
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
      <div className="fixed inset-0 z-[999999] bg-slate-950 flex items-center justify-center p-4 select-none font-sans overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 text-white rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-center my-auto">
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-center justify-center mx-auto mb-5 relative z-10">
            <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10 text-rose-500 animate-pulse" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">
            Pembaruan Diperlukan
          </h2>

          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-5">
            Aplikasi <span className="font-bold text-white">{requiredVersion.app_name || "EXAM AA"}</span> di perangkat Anda sudah usang. Anda wajib memperbarui aplikasi ke versi terbaru untuk dapat mengakses ujian.
          </p>

          {/* Version Info Card */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 mb-5 text-left space-y-3">
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
          <div className="space-y-2.5">
            {requiredVersion.apk_url ? (
              <>
                <button
                  onClick={handleDownload}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all text-xs sm:text-sm uppercase tracking-wider"
                >
                  <Download size={17} />
                  Unduh APK Otomatis
                </button>

                <button
                  onClick={handleCopyLink}
                  className={`w-full py-3 px-6 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider transition-all active:scale-95 border ${
                    copied
                      ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-400"
                      : "bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                  }`}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? "Link Berhasil Disalin!" : "Salin Link Download APK"}
                </button>
              </>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs">
                Hubungi pengawas atau operator sekolah untuk mengunduh APK versi terbaru.
              </div>
            )}

            <button
              onClick={handleExit}
              className="w-full py-3 px-6 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 font-bold rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              <LogOut size={15} />
              Tutup Aplikasi (Lepas Layar)
            </button>

            {/* Instruction Card for Students */}
            <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 text-left space-y-1.5 mt-3">
              <p className="font-bold text-slate-300 flex items-center gap-1.5">
                <span>💡</span> Panduan jika layar disematkan (App is pinned):
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1">
                <li>Klik <strong className="text-white">"Salin Link Download APK"</strong> di atas.</li>
                <li>Klik <strong className="text-rose-400">"Tutup Aplikasi"</strong> (layar otomatis terlepas).</li>
                <li>Buka <strong className="text-white">Chrome / Browser HP</strong>, tempel (<span className="italic">paste</span>) link dan unduh APK terbaru.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AppVersionGuard;
