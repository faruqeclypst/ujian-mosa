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
  ShieldCheck,
  Maximize2,
  Clock,
  Key,
  Info,
  Sparkles,
  ShieldAlert
} from "lucide-react";
import { NeonButton } from "../ui/NeonButton";
import { cn } from "../../lib/utils";
import { useToast } from "../ui/toast";
import { APP_DISPLAY_VERSION } from "../../utils/version";
import { getSchoolDomain, getSchoolUrl } from "../../utils/domainHelper";

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

  const schoolDomain = getSchoolDomain(schoolSlug);
  const schoolUrl = getSchoolUrl(schoolSlug);
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
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-2xl rounded-2xl p-0 border border-neutral-200 dark:border-neutral-800 shadow-2xl bg-white dark:bg-neutral-900 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-6 pb-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/60 relative">
          <DialogTitle className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xs">
              <ShieldCheck size={18} />
            </div>
            Panduan Aplikasi Ujian & Konfigurasi SEB
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Petunjuk akses ujian untuk Android (APK), iPhone/iPad (SEB), Laptop Windows (SEB), dan Browser Biasa.
          </DialogDescription>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 mt-4 p-1 bg-neutral-200/70 dark:bg-neutral-800/80 rounded-xl overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("android")}
              className={cn(
                "flex-1 min-w-[130px] flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeTab === "android"
                  ? "bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              )}
            >
              <Smartphone size={14} /> Android (APK)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ios")}
              className={cn(
                "flex-1 min-w-[130px] flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeTab === "ios"
                  ? "bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              )}
            >
              <AppleIcon size={14} /> iPhone & iPad (SEB)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("windows")}
              className={cn(
                "flex-1 min-w-[130px] flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeTab === "windows"
                  ? "bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              )}
            >
              <Monitor size={14} /> Windows (SEB)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("browser")}
              className={cn(
                "flex-1 min-w-[130px] flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeTab === "browser"
                  ? "bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
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
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-emerald-500/5 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-500/20 flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-neutral-800 dark:text-neutral-200 space-y-1">
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">Aplikasi Resmi Android (EXAMKU APK)</p>
                  <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    Aplikasi Android native yang dilengkapi proteksi Kiosk: layar penuh otomatis, penguncian tombol Home/Back/Recent Apps, deteksi split-screen, dan sirine alarm keras jika mencoba curang.
                  </p>
                </div>
              </div>

              {/* Tautan Unduh APK */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                  Pilihan Berkas APK Android
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* APK Standar */}
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/40 space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-white">EXAMKU APK (Rekomendasi)</h4>
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-full">{APP_DISPLAY_VERSION}</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">Aplikasi ujian utama dengan fitur penguncian layar penuh dan deteksi multi-window.</p>
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={apkStandardUrl}
                        download
                        className="flex-1"
                      >
                        <NeonButton
                          variant="primary"
                          size="sm"
                          className="w-full"
                          type="button"
                        >
                          <Download size={13} className="mr-1.5" /> Unduh APK
                        </NeonButton>
                      </a>
                      <NeonButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        iconOnly
                        aria-label="Salin Link APK Standar"
                        onClick={() => handleCopy(apkStandardUrl, "Link APK Standar")}
                      >
                        {copiedText === "Link APK Standar" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </NeonButton>
                    </div>
                  </div>

                  {/* APK Browser Helper */}
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/40 space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-white">EXAMKU Browser Kiosk</h4>
                        <span className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-[10px] font-bold rounded-full">Alternatif</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">Versi ringan khusus perangkat Android dengan RAM terbatas.</p>
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={apkBrowserUrl}
                        download
                        className="flex-1"
                      >
                        <NeonButton
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          type="button"
                        >
                          <Download size={13} className="mr-1.5" /> Unduh APK
                        </NeonButton>
                      </a>
                      <NeonButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        iconOnly
                        aria-label="Salin Link APK Browser"
                        onClick={() => handleCopy(apkBrowserUrl, "Link APK Browser")}
                      >
                        {copiedText === "Link APK Browser" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </NeonButton>
                    </div>
                  </div>
                </div>
              </div>

              {/* Petunjuk Penggunaan Siswa */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2.5">
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Info size={14} className="text-emerald-600 dark:text-emerald-400" /> Petunjuk Pemasangan di HP Android Siswa:
                </h4>
                <ol className="list-decimal pl-4 text-xs text-neutral-600 dark:text-neutral-400 space-y-1.5 leading-relaxed">
                  <li>Unduh berkas APK di atas dan izinkan pemasangan dari <i>Sumber Tidak Dikenal</i> jika diminta.</li>
                  <li>Buka aplikasi <strong>EXAMKU</strong>, sistem akan otomatis mengunci layar.</li>
                  <li>Masukkan NISN / Username dan Password siswa untuk memulai ujian.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: IPHONE & IPAD (SEB) */}
          {activeTab === "ios" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-emerald-500/5 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-500/20 flex items-start gap-3">
                <AppleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-neutral-800 dark:text-neutral-200 space-y-1">
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">Safe Exam Browser (SEB) Resmi untuk iOS</p>
                  <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    Di iPhone dan iPad, Apple menyediakan fitur <i>Automatic Assessment Configuration (AAC)</i>. Melalui Safe Exam Browser, sistem iOS otomatis mematikan Siri, notifikasi, screenshot, dan kontrol gestur saat ujian berlangsung.
                  </p>
                </div>
              </div>

              {/* 1-Klik Download Config */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center justify-center sm:justify-start gap-1.5">
                    <Sparkles size={14} className="text-emerald-600 dark:text-emerald-400" /> File Konfigurasi SEB Sekolah Anda
                  </h4>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    File ini sudah terkonfigurasi dengan URL <b>{schoolDomain}</b>. Bagikan file ini ke siswa via WhatsApp / AirDrop.
                  </p>
                </div>
                <NeonButton
                  variant="primary"
                  size="sm"
                  onClick={handleDownloadSeb}
                  className="shrink-0"
                >
                  <Download size={14} className="mr-1.5" /> Unduh File Config (.seb)
                </NeonButton>
              </div>

              {/* Tautan 1-Klik Buka di SEB */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                  Tautan Cepat Buka di SEB iOS (Deep Link)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={sebDirectLink}
                    className="flex-1 h-9 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-300 select-all"
                  />
                  <NeonButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    iconOnly
                    aria-label="Salin Tautan SEB iOS"
                    onClick={() => handleCopy(sebDirectLink, "Tautan SEB iOS")}
                  >
                    {copiedText === "Tautan SEB iOS" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </NeonButton>
                </div>
                <p className="text-[10px] text-neutral-400">
                  Jika siswa membuka link di atas di Safari iPhone yang sudah terpasang SEB, iOS akan otomatis meminta konfirmasi untuk membuka Safe Exam Browser.
                </p>
              </div>

              {/* Langkah Manual Setup di iPhone */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <AppleIcon size={14} className="text-neutral-700 dark:text-neutral-300" /> Langkah Pengaturan Manual di iPhone / iPad:
                </h4>
                <ol className="list-decimal pl-4 text-xs text-neutral-600 dark:text-neutral-400 space-y-2 leading-relaxed">
                  <li>
                    Unduh aplikasi <strong>Safe Exam Browser</strong> dari <b>Apple App Store</b>.
                  </li>
                  <li>
                    <strong>Metode Paling Mudah:</strong> Kirim file <code>config_ujian_{schoolSlug}.seb</code> yang diunduh di atas ke WhatsApp siswa. Siswa cukup mengetuk file tersebut dan memilih <i>Buka di Safe Exam Browser</i>.
                  </li>
                  <li>
                    <strong>Atau Atur Manual:</strong> Buka menu <b>Settings iPhone</b> → cari aplikasi <b>Safe Exam Browser</b> → pada kolom <b>Start URL</b>, masukkan:
                    <div className="mt-1 flex items-center gap-2">
                      <code className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                        {schoolUrl}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(schoolUrl, "URL Sekolah")}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
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
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-neutral-100 dark:bg-neutral-850 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 flex items-start gap-3">
                <Monitor className="w-5 h-5 text-neutral-700 dark:text-neutral-300 shrink-0 mt-0.5" />
                <div className="text-xs text-neutral-800 dark:text-neutral-200 space-y-1">
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">Safe Exam Browser untuk Laptop & Komputer Windows</p>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    Di lingkungan laboratorium komputer sekolah atau laptop siswa berbasis Windows 10/11, SEB mengunci sistem operasi sehingga siswa tidak bisa membuka Alt+Tab, tombol Windows, Task Manager, ataupun menyambungkan monitor kedua.
                  </p>
                </div>
              </div>

              {/* Tombol Unduh Config File untuk Windows */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                    Gunakan File Konfigurasi Instan (.seb)
                  </h4>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    File ini kompatibel 100% dengan SEB Windows. Siswa cukup klik dua kali file ini untuk langsung masuk ujian.
                  </p>
                </div>
                <NeonButton
                  variant="primary"
                  size="sm"
                  onClick={handleDownloadSeb}
                  className="shrink-0"
                >
                  <Download size={14} className="mr-1.5" /> Unduh File Config (.seb)
                </NeonButton>
              </div>

              {/* Panduan Konfigurasi Manual SEB Config Tool Windows */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Key size={14} className="text-amber-500" /> Cara Setting Sendiri di Aplikasi SEB Config Tool (Windows):
                </h4>
                <div className="space-y-3 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  <p>
                    Jika operator sekolah ingin membuat file kustom dengan password keluar khusus, ikuti langkah berikut di <b>SEB Config Tool</b>:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-100 dark:border-neutral-800 space-y-1">
                      <span className="font-bold text-neutral-800 dark:text-neutral-200 text-[11px] block">1. Tab General</span>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Isi <b>Start URL</b> dengan:
                        <br />
                        <code className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">{schoolUrl}</code>
                      </p>
                    </div>

                    <div className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-100 dark:border-neutral-800 space-y-1">
                      <span className="font-bold text-neutral-800 dark:text-neutral-200 text-[11px] block">2. Tab Config</span>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Pilih <i>"Use SEB settings file to start an exam"</i> agar file bisa dibagikan ke seluruh komputer.
                      </p>
                    </div>

                    <div className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-100 dark:border-neutral-800 space-y-1">
                      <span className="font-bold text-neutral-800 dark:text-neutral-200 text-[11px] block">3. Tab Security</span>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Atur <b>Quit Password</b> jika pengawas ingin siswa hanya bisa menutup SEB dengan izin password pengawas.
                      </p>
                    </div>

                    <div className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-100 dark:border-neutral-800 space-y-1">
                      <span className="font-bold text-neutral-800 dark:text-neutral-200 text-[11px] block">4. Simpan Berkas</span>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
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
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-emerald-500/5 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-500/20 flex items-start gap-3">
                <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-neutral-800 dark:text-neutral-200 space-y-1">
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">Ujian Menggunakan Browser Biasa (Chrome, Edge, Safari, Firefox)</p>
                  <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    Jika opsi <b>Wajib Exambro</b> dinonaktifkan di Pengaturan, siswa dapat mengerjakan ujian langsung dari browser biasa di laptop atau ponsel tanpa perlu menginstal aplikasi tambahan.
                  </p>
                </div>
              </div>

              {/* 4 Pilar Keamanan Browser Biasa */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                  Sistem Pengamanan Otomatis di Browser Biasa
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <Maximize2 size={16} /> 1. Wajib Layar Penuh (Fullscreen)
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      Saat menekan tombol <i>"Mulai Ujian"</i>, sistem otomatis memaksa layar penuh. Jika siswa keluar dari fullscreen, lembar soal tertutup layar abu-abu pemblokir hingga kembali fullscreen.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                      <Clock size={16} /> 2. Deteksi Focus Loss & Timer 5 Detik
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      Jika siswa berpindah tab, membuka jendela aplikasi lain, atau menekan tombol Windows/Command, sirine peringatan dan hitung mundur 5 detik muncul mewajibkan siswa segera kembali.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1.5">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
                      <ShieldAlert size={16} /> 3. Kunci Sesi Otomatis (Auto-Lock)
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      Setiap kejadian focus loss dicatat secara real-time di tabel <b>Monitoring Pengawas</b>. Jika pelanggaran melebihi batas (default 1-3 kali), ujian otomatis <b>TERKUNCI</b> dan siswa wajib lapor ke pengawas untuk di-reset.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1.5">
                    <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xs">
                      <Key size={16} /> 4. Blokir Shortcut & Klik Kanan
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      Klik kanan, seleksi teks soal, tombol F12 / Inspect Element, tombol print (Ctrl+P), dan tombol pintas navigasi dinonaktifkan secara menyeluruh di kode browser.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
            <span>Alamat Portal Ujian:</span>
            <code className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{schoolUrl}</code>
          </div>
          <NeonButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Tutup Panduan
          </NeonButton>
        </div>
      </DialogContent>
    </Dialog>
  );
};
