import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Monitor, Smartphone, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { motion } from "framer-motion";
import { fadeUp } from "../../lib/motion";

const DownloadAppsPage = () => {
  const { school } = useTenant();
  const navigate = useNavigate();

  const handleDownloadSeb = () => {
    const schoolUrl = window.location.origin;
    const schoolDomain = window.location.hostname;
    const slug = schoolDomain.split('.')[0] || "ujian";

    const sebConfigXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>startURL</key>
    <string>${schoolUrl}</string>
    <key>allowQuit</key>
    <true/>
    <key>quitURL</key>
    <string>${schoolUrl}/exam</string>
    <key>allowPreferencesWindow</key>
    <false/>
    <key>browserViewMode</key>
    <integer>0</integer>
    <key>enableAudio</key>
    <true/>
    <key>enableScreenCapture</key>
    <false/>
    <key>enableSpellChecking</key>
    <false/>
    <key>showTaskBar</key>
    <false/>
    <key>showReloadButton</key>
    <true/>
    <key>showTime</key>
    <true/>
    <key>allowSpellCheck</key>
    <false/>
</dict>
</plist>`;

    const blob = new Blob([sebConfigXml], { type: "application/seb" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CBT-${slug}.seb`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    document.title = `Unduh Aplikasi Ujian - ${school?.name || "EXAMKU"}`;
  }, [school]);

  const schoolHost = typeof window !== "undefined" ? window.location.host : "";

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="min-h-screen bg-neutral-50 dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans pb-16 transition-colors">
      {/* Header */}
      <div className="bg-gradient-to-b from-neutral-900 to-neutral-800 dark:from-neutral-950 dark:to-neutral-900 pb-16 pt-8 sm:pt-12 px-4 relative overflow-hidden border-b border-neutral-800/80">
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:20px_20px] opacity-10"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <div className="flex justify-start mb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/70 border border-neutral-700/60 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Kembali</span>
            </button>
          </div>

          <div className="inline-flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/30 backdrop-blur-xs text-emerald-300 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-5 shadow-xs">
            <CheckCircle size={14} className="text-emerald-400" />
            <span>Sistem Ujian Aman (Anti-Curang Kiosk)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight">
            Unduh Aplikasi Ujian Siswa
          </h1>
          <p className="text-neutral-300 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Untuk mengikuti ujian dengan proteksi maksimal, peserta dapat menggunakan aplikasi peramban khusus (CBT Exambro) agar ujian berlangsung tertib dan terlindungi dari kecurangan.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Card 1: Android */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col hover:border-emerald-500/40 transition-all"
          >
            <div className="p-6 flex-1">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-5 border border-emerald-200/50 dark:border-emerald-800/40">
                <Smartphone size={24} />
              </div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1">Android (HP / Tablet)</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 leading-relaxed">
                Aplikasi Exambro resmi untuk perangkat Android. Mengunci notifikasi, mencegah split-screen, dan sangat ringan.
              </p>

              <ul className="space-y-2 mb-6">
                {["Minimal Android 6.0", "Ukuran file kecil (< 8 MB)", "Anti split-screen & floating app"].map((ft, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>{ft}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-850/60 border-t border-neutral-100 dark:border-neutral-800">
              <a
                href="https://examku.my.id/app-debug.apk"
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                target="_blank"
                rel="noreferrer"
              >
                <Download size={15} />
                <span>Unduh APK Exambro</span>
              </a>
            </div>
          </motion.div>

          {/* Card 2: iOS / iPhone */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
          >
            <div className="p-6 flex-1">
              <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-xl flex items-center justify-center mb-5 border border-neutral-200 dark:border-neutral-750">
                <Smartphone size={24} />
              </div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1">iPhone & iPad (iOS)</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 leading-relaxed">
                Gunakan aplikasi Safe Exam Browser (SEB) resmi dari App Store untuk mengerjakan ujian di ekosistem Apple.
              </p>

              <ul className="space-y-2 mb-6">
                {["iOS 11.0 ke atas", "Tersedia resmi di App Store", "Gunakan profil SEB konfigurasi"].map((ft, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                    <CheckCircle size={14} className="text-neutral-400 shrink-0 mt-0.5" />
                    <span>{ft}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-850/60 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
              <a
                href="https://apps.apple.com/us/app/safe-exam-browser/id1155002283"
                className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-white py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                target="_blank"
                rel="noreferrer"
              >
                <Smartphone size={15} />
                <span>App Store (SEB)</span>
              </a>
              <button
                type="button"
                onClick={handleDownloadSeb}
                className="w-full flex items-center justify-center gap-2 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-200 py-2 rounded-xl font-semibold text-xs border border-neutral-300 dark:border-neutral-700 transition-colors cursor-pointer"
              >
                <Download size={14} />
                <span>Konfigurasi (.seb)</span>
              </button>
            </div>
          </motion.div>

          {/* Card 3: Windows (Opsional) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
          >
            <div className="p-6 flex-1">
              <div className="w-12 h-12 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-xl flex items-center justify-center mb-5 border border-sky-200/50 dark:border-sky-800/40">
                <Monitor size={24} />
              </div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1 flex items-center justify-between">
                <span>Windows PC</span>
                <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded uppercase tracking-wider font-mono border border-neutral-200 dark:border-neutral-750">Opsional</span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 leading-relaxed">
                Klien khusus untuk pengerjaan ujian melalui laptop atau PC Windows dengan mode kiosk Safe Exam Browser.
              </p>

              <ul className="space-y-2 mb-6">
                {["Windows 8.1, 10, 11", "Mencegah Alt+Tab & Snipping", "Mode full-screen otomatis"].map((ft, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                    <CheckCircle size={14} className="text-sky-500 shrink-0 mt-0.5" />
                    <span>{ft}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-850/60 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
              <a
                href="https://safeexambrowser.org/download_en.html"
                className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                target="_blank"
                rel="noreferrer"
              >
                <Download size={15} />
                <span>Unduh SEB Windows</span>
              </a>
              <button
                type="button"
                onClick={handleDownloadSeb}
                className="w-full flex items-center justify-center gap-2 bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-700 dark:text-sky-300 py-2 rounded-xl font-semibold text-xs border border-sky-200 dark:border-sky-800/40 transition-colors cursor-pointer"
              >
                <Download size={14} />
                <span>Konfigurasi (.seb)</span>
              </button>
            </div>
          </motion.div>

        </div>

        {/* Bantuan Section */}
        <div className="mt-8 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/50 dark:border-emerald-800/40">
            <AlertCircle size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Panduan Masuk Ujian</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-2xl">
              Setelah aplikasi terunduh dan terpasang, masukkan alamat (URL) portal ujian sekolah Anda 
              <span className="font-mono bg-white dark:bg-neutral-800 px-2 py-0.5 rounded text-emerald-600 dark:text-emerald-400 font-bold mx-1.5 border border-neutral-200 dark:border-neutral-750">
                {schoolHost || "slug.examku.my.id"}
              </span>
              ke dalam aplikasi untuk memulai ujian. Gunakan NIS/NISN dan password yang telah diberikan pengawas.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DownloadAppsPage;
