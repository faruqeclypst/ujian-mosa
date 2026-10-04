import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "../ui/dialog";
import {
  Smartphone,
  Monitor,
  Globe,
  Download,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Maximize2,
  Clock,
  Key,
  Info,
  Layers,
  Sparkles
} from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { useToast } from "../ui/toast";
import { APP_DISPLAY_VERSION } from "../../utils/version";

const AppleIcon = ({ className = "", size = 16 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.87-.96.04-2.14.64-2.79 1.4-.57.65-1.07 1.71-.93 2.74 1.07.08 2.09-.52 2.71-1.27z" />
  </svg>
);

interface ExambroGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolSlug: string;
  schoolName: string;
}

export const ExambroGuideModal = ({
  open,
  onOpenChange,
  schoolSlug,
  schoolName
}: ExambroGuideModalProps) => {
  const [activeTab, setActiveTab] = useState<"android" | "ios" | "windows" | "browser">("android");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const { addToast } = useToast();

  const schoolDomain = `${schoolSlug}.examku.my.id`;
  const schoolUrl = `https://${schoolDomain}`;
  const sebDirectLink = `sebs://${schoolDomain}`;
  const apkStandardUrl = "https://examku.my.id/exam-aa-latest.apk";
  const apkBrowserUrl = "https://examku.my.id/exam-aa-browser-latest.apk";

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    addToast({
      title: "Tersalin",
      description: `${label} berhasil disalin ke papan klip.`,
      type: "success"
    });
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleDownloadSeb = () => {
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
    link.download = `config_ujian_${schoolSlug}.seb`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast({
      title: "Config SEB Diunduh",
      description: `File config_ujian_${schoolSlug}.seb berhasil disimpan.`,
      type: "success"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-[2rem] p-0 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 relative">
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <ShieldCheck size={18} />
            </div>
            Panduan Aplikasi Ujian & Konfigurasi SEB
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Petunjuk akses ujian untuk Android (APK), iPhone/iPad (SEB), Laptop Windows (SEB), dan Browser Biasa.
          </DialogDescription>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 mt-4 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-2xl overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("android")}
              className={cn(
                "flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all",
                activeTab === "android"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <Smartphone size={14} /> Android (APK)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ios")}
              className={cn(
                "flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all",
                activeTab === "ios"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <AppleIcon size={14} /> iPhone & iPad (SEB)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("windows")}
              className={cn(
                "flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all",
                activeTab === "windows"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <Monitor size={14} /> Windows (SEB)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("browser")}
              className={cn(
                "flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all",
                activeTab === "browser"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <Globe size={14} /> Browser Biasa
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* TAB 1: ANDROID APK */}
          {activeTab === "android" && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-blue-50/60 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950 dark:text-blue-200 space-y-1">
                  <p className="font-bold">Aplikasi Resmi Android (EXAMKU APK)</p>
                  <p className="text-blue-800/80 dark:text-blue-300 leading-relaxed font-medium">
                    Aplikasi Android native yang dilengkapi proteksi Kiosk: layar penuh otomatis, penguncian tombol Home/Back/Recent Apps, deteksi split-screen, dan sirine alarm keras jika mencoba curang.
                  </p>
                </div>
              </div>

              {/* Tautan Unduh APK */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Pilihan Berkas APK Android
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* APK Standar */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">EXAMKU APK (Rekomendasi)</h4>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">{APP_DISPLAY_VERSION}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Aplikasi ujian utama dengan fitur penguncian layar penuh dan deteksi multi-window.</p>
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={apkStandardUrl}
                        download
                        className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <Download size={13} /> Unduh APK
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleCopy(apkStandardUrl, "Link APK Standar")}
                        className="h-9 px-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300"
                      >
                        {copiedText === "Link APK Standar" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </Button>
                    </div>
                  </div>

                  {/* APK Browser Helper */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">EXAMKU Browser Kiosk</h4>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">Alternatif</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Versi ringan khusus perangkat Android dengan RAM terbatas.</p>
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={apkBrowserUrl}
                        download
                        className="flex-1 h-9 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <Download size={13} /> Unduh APK
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleCopy(apkBrowserUrl, "Link APK Browser")}
                        className="h-9 px-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300"
                      >
                        {copiedText === "Link APK Browser" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Petunjuk Penggunaan Siswa */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Info size={14} className="text-blue-500" /> Petunjuk Pemasangan di HP Android Siswa:
                </h4>
                <ol className="list-decimal pl-4 text-xs text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed">
                  <li>Unduh berkas APK di atas dan izinkan pemasangan dari <i>Sumber Tidak Dikenal</i> jika diminta.</li>
                  <li>Buka aplikasi <strong>EXAMKU</strong>, sistem akan otomatis mengunci layar.</li>
                  <li>Masukkan NISN / Username dan Password siswa untuk memulai ujian.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: IPHONE & IPAD (SEB) */}
          {activeTab === "ios" && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-purple-50/60 dark:bg-purple-950/20 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/50 flex items-start gap-3">
                <AppleIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs text-purple-950 dark:text-purple-200 space-y-1">
                  <p className="font-bold">Safe Exam Browser (SEB) Resmi untuk iOS</p>
                  <p className="text-purple-800/80 dark:text-purple-300 leading-relaxed font-medium">
                    Di iPhone dan iPad, Apple menyediakan fitur <i>Automatic Assessment Configuration (AAC)</i>. Melalui Safe Exam Browser, sistem iOS otomatis mematikan Siri, notifikasi, screenshot, dan kontrol gestur saat ujian berlangsung.
                  </p>
                </div>
              </div>

              {/* 1-Klik Download Config */}
              <div className="p-4 rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-1.5">
                    <Sparkles size={14} className="text-purple-600" /> File Konfigurasi SEB Sekolah Anda
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    File ini sudah terkonfigurasi dengan URL <b>{schoolDomain}</b>. Bagikan file ini ke siswa via WhatsApp / AirDrop.
                  </p>
                </div>
                <Button
                  onClick={handleDownloadSeb}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold h-10 px-4 shadow-sm shrink-0 flex items-center gap-2"
                >
                  <Download size={14} /> Unduh File Config (.seb)
                </Button>
              </div>

              {/* Tautan 1-Klik Buka di SEB */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Tautan Cepat Buka di SEB iOS (Deep Link)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={sebDirectLink}
                    className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 select-all"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCopy(sebDirectLink, "Tautan SEB iOS")}
                    className="h-10 px-3.5 rounded-xl text-xs font-bold"
                  >
                    {copiedText === "Tautan SEB iOS" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Jika siswa membuka link di atas di Safari iPhone yang sudah terpasang SEB, iOS akan otomatis meminta konfirmasi untuk membuka Safe Exam Browser.
                </p>
              </div>

              {/* Langkah Manual Setup di iPhone */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <AppleIcon size={14} className="text-slate-700" /> Langkah Pengaturan Manual di iPhone / iPad:
                </h4>
                <ol className="list-decimal pl-4 text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
                  <li>
                    Unduh aplikasi <strong>Safe Exam Browser</strong> dari <b>Apple App Store</b>.
                  </li>
                  <li>
                    <strong>Metode Paling Mudah:</strong> Kirim file <code>config_ujian_{schoolSlug}.seb</code> yang diunduh di atas ke WhatsApp siswa. Siswa cukup mengetuk file tersebut dan memilih <i>Buka di Safe Exam Browser</i>.
                  </li>
                  <li>
                    <strong>Atau Atur Manual:</strong> Buka menu <b>Settings iPhone</b> → cari aplikasi <b>Safe Exam Browser</b> → pada kolom <b>Start URL</b>, masukkan:
                    <div className="mt-1 flex items-center gap-2">
                      <code className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[11px] text-purple-600 dark:text-purple-400 font-bold">
                        {schoolUrl}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(schoolUrl, "URL Sekolah")}
                        className="text-[10px] text-blue-600 hover:underline font-bold"
                      >
                        Salin URL
                      </button>
                    </div>
                  </li>
                  <li>
                    Aktifkan opsi <b>Assessment Mode (AAC)</b> agar layar terkunci penuh. Buka aplikasi SEB dan siswa siap ujian.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: WINDOWS PC (SEB) */}
          {activeTab === "windows" && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                <Monitor className="w-5 h-5 text-slate-700 dark:text-slate-300 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-800 dark:text-slate-200 space-y-1">
                  <p className="font-bold">Safe Exam Browser untuk Laptop & Komputer Windows</p>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    Di lingkungan laboratorium komputer sekolah atau laptop siswa berbasis Windows 10/11, SEB mengunci sistem operasi sehingga siswa tidak bisa membuka Alt+Tab, tombol Windows, Task Manager, ataupun menyambungkan monitor kedua.
                  </p>
                </div>
              </div>

              {/* Tombol Unduh Config File untuk Windows */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Gunakan File Konfigurasi Instan (.seb)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    File ini kompatibel 100% dengan SEB Windows. Siswa cukup klik dua kali file ini untuk langsung masuk ujian.
                  </p>
                </div>
                <Button
                  onClick={handleDownloadSeb}
                  className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl text-xs font-bold h-10 px-4 shadow-sm shrink-0 flex items-center gap-2"
                >
                  <Download size={14} /> Unduh File Config (.seb)
                </Button>
              </div>

              {/* Panduan Konfigurasi Manual SEB Config Tool Windows */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Key size={14} className="text-amber-500" /> Cara Setting Sendiri di Aplikasi SEB Config Tool (Windows):
                </h4>
                <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <p>
                    Jika operator sekolah ingin membuat file kustom dengan password keluar khusus, ikuti langkah berikut di <b>SEB Config Tool</b>:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] block">1. Tab General</span>
                      <p className="text-[11px] text-slate-500">
                        Isi <b>Start URL</b> dengan:
                        <br />
                        <code className="text-blue-600 dark:text-blue-400 font-bold font-mono">{schoolUrl}</code>
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] block">2. Tab Config</span>
                      <p className="text-[11px] text-slate-500">
                        Pilih <i>"Use SEB settings file to start an exam"</i> agar file bisa dibagikan ke seluruh komputer.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] block">3. Tab Security</span>
                      <p className="text-[11px] text-slate-500">
                        Atur <b>Quit Password</b> jika pengawas ingin siswa hanya bisa menutup SEB dengan izin password pengawas.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] block">4. Simpan Berkas</span>
                      <p className="text-[11px] text-slate-500">
                        Klik <i>File → Save As</i>, simpan sebagai file <code>ujian.seb</code> dan distribusikan ke lab komputer.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BROWSER BIASA (FULLSCREEN & ANTI-CHEAT WEB) */}
          {activeTab === "browser" && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 flex items-start gap-3">
                <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950 dark:text-emerald-200 space-y-1">
                  <p className="font-bold">Ujian Menggunakan Browser Biasa (Chrome, Edge, Safari, Firefox)</p>
                  <p className="text-emerald-800/80 dark:text-emerald-300 leading-relaxed font-medium">
                    Jika opsi <b>Wajib Exambro</b> dinonaktifkan di Pengaturan, siswa dapat mengerjakan ujian langsung dari browser biasa di laptop atau ponsel tanpa perlu menginstal aplikasi tambahan.
                  </p>
                </div>
              </div>

              {/* 4 Pilar Keamanan Browser Biasa */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Sistem Pengamanan Otomatis di Browser Biasa
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <Maximize2 size={16} /> 1. Wajib Layar Penuh (Fullscreen)
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      Saat menekan tombol <i>"Mulai Ujian"</i>, sistem otomatis memaksa layar penuh. Jika siswa keluar dari fullscreen, lembar soal tertutup layar abu-abu pemblokir hingga kembali fullscreen.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                      <Clock size={16} /> 2. Deteksi Focus Loss & Timer 5 Detik
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      Jika siswa berpindah tab, membuka jendela aplikasi lain, atau menekan tombol Windows/Command, sirine peringatan dan hitung mundur 5 detik muncul mewajibkan siswa segera kembali.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
                      <ShieldAlert size={16} /> 3. Kunci Sesi Otomatis (Auto-Lock)
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      Setiap kejadian focus loss dicatat secara real-time di tabel <b>Monitoring Pengawas</b>. Jika pelanggaran melebihi batas (default 1-3 kali), ujian otomatis <b>TERKUNCI</b> dan siswa wajib lapor ke pengawas untuk di-reset.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                      <Key size={16} /> 4. Blokir Shortcut & Klik Kanan
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      Klik kanan, seleksi teks soal, tombol F12 / Inspect Element, tombol print (Ctrl+P), dan tombol pintas navigasi dinonaktifkan secara menyeluruh di kode browser.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span>Alamat Portal Ujian:</span>
            <code className="font-mono font-bold text-blue-600 dark:text-blue-400">{schoolUrl}</code>
          </div>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-9 px-5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl text-xs font-bold"
          >
            Tutup Panduan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
