import React, { useEffect } from "react";
import { Download, Monitor, Smartphone, CheckCircle, AlertCircle } from "lucide-react";
import { useTenant } from "../../context/TenantContext";

const DownloadAppsPage = () => {
  const { school } = useTenant();

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

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      {/* Header */}
      <div className="bg-blue-700 pb-16 pt-8 sm:pt-12 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-50"></div>
        
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-800/50 border border-blue-600/50 backdrop-blur-sm text-blue-100 text-xs font-bold px-3 py-1.5 rounded-full mb-6">
            <CheckCircle size={14} className="text-emerald-400" />
            <span>Sistem Ujian Aman (Anti-Contek)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight">
            Unduh Aplikasi Ujian
          </h1>
          <p className="text-blue-100/90 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Untuk mengikuti ujian, Anda wajib menggunakan aplikasi peramban khusus (CBT Browser) agar ujian berjalan lancar, aman, dan meminimalisir kecurangan.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Card 1: Android */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-200 overflow-hidden flex flex-col transition-transform hover:-translate-y-1 duration-300">
            <div className="p-6 flex-1">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-5">
                <Smartphone size={24} />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 mb-2">Android (HP / Tablet)</h2>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Aplikasi Exambro resmi untuk perangkat Android. Mengunci notifikasi, mencegah split-screen, dan sangat ringan.
              </p>
              
              <ul className="space-y-2 mb-6">
                {["Minimal Android 6.0", "Ukuran file kecil", "Anti split-screen & float app"].map((ft, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] font-medium text-slate-600">
                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>{ft}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <a
                href="https://examku.my.id/app-debug.apk"
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-sm transition-colors"
                target="_blank"
                rel="noreferrer"
              >
                <Download size={16} />
                Unduh APK
              </a>
            </div>
          </div>

          {/* Card 2: iOS / iPhone */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-200 overflow-hidden flex flex-col transition-transform hover:-translate-y-1 duration-300">
            <div className="p-6 flex-1">
              <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-xl flex items-center justify-center mb-5">
                <Smartphone size={24} />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 mb-2">iPhone & iPad (iOS)</h2>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Gunakan aplikasi Safe Exam Browser (SEB) resmi dari App Store untuk mengerjakan ujian di ekosistem Apple.
              </p>
              
              <ul className="space-y-2 mb-6">
                {["iOS 11.0 ke atas", "Tersedia di App Store", "Gunakan profil SEB sekolah (jika ada)"].map((ft, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] font-medium text-slate-600">
                    <CheckCircle size={14} className="text-slate-600 shrink-0 mt-0.5" />
                    <span>{ft}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <a
                href="https://apps.apple.com/us/app/safe-exam-browser/id1155002283"
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl font-bold text-sm transition-colors"
                target="_blank"
                rel="noreferrer"
              >
                <Smartphone size={16} />
                App Store (SEB)
              </a>
              <button onClick={handleDownloadSeb} className="w-full mt-2 flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-800 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer"><Download size={16} /> Konfigurasi (.seb)</button>
            </div>
          </div>

          {/* Card 3: Windows (Opsional) */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-200 overflow-hidden flex flex-col transition-transform hover:-translate-y-1 duration-300">
            <div className="p-6 flex-1">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5">
                <Monitor size={24} />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 mb-2 flex items-center justify-between">
                Windows 
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-widest border border-slate-200">Opsional</span>
              </h2>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Klien khusus untuk pengerjaan ujian melalui laptop atau PC Windows (Windows 10/11) dengan mode kiosk (Safe Exam Browser).
              </p>
              
              <ul className="space-y-2 mb-6">
                {["Windows 8.1, 10, 11", "Mencegah Alt+Tab & Snipping", "Mode full-screen otomatis"].map((ft, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] font-medium text-slate-600">
                    <CheckCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                    <span>{ft}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <a
                href="https://safeexambrowser.org/download_en.html"
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-sm transition-colors"
                target="_blank"
                rel="noreferrer"
              >
                <Download size={16} />
                Unduh SEB (Windows)
              </a>
              <button onClick={handleDownloadSeb} className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-800 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer"><Download size={16} /> Konfigurasi (.seb)</button>
            </div>
          </div>

        </div>

        {/* Bantuan Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200/60 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <AlertCircle size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Panduan Penggunaan</h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              Setelah aplikasi terunduh dan terpasang, masukkan alamat (URL) portal ujian sekolah Anda 
              <span className="font-mono bg-blue-100/50 px-1.5 py-0.5 rounded text-blue-700 font-bold mx-1">
                {typeof window !== 'undefined' ? window.location.host : ''}
              </span>
              ke dalam aplikasi untuk mulai mengerjakan ujian. Pastikan Anda sudah menerima username dan password dari panitia ujian.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadAppsPage;
