import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Copy,
  Check,
  ExternalLink,
  Download,
  Wifi,
  Globe,
  HardDrive,
  ShieldCheck,
  KeyRound,
  QrCode,
  X,
  Monitor,
  Maximize2,
} from "../../lib/icons/phosphor-bridge";
import { Dialog, DialogContent } from "../ui/dialog";
import { NeonButton } from "../ui/NeonButton";
import { useTenant } from "../../context/TenantContext";
import { useExamData } from "../../context/ExamDataContext";
import { getStudentExamUrl, getStudentPortalOrigin, isLocalNetwork } from "../../utils/domainHelper";
import { isLocalServer } from "../../pages/landing/SelectSchoolPage";

export const openCbtConnect = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-cbt-connect"));
  }
};

export interface CbtConnectModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const CbtConnectModal = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}: CbtConnectModalProps) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = typeof controlledIsOpen === "boolean";
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleClose = useCallback(() => {
    setIsProjectorMode(false);
    if (isControlled && controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalIsOpen(false);
    }
  }, [isControlled, controlledOnClose]);

  // Listen to global open event
  useEffect(() => {
    const handleGlobalOpen = () => setInternalIsOpen(true);
    window.addEventListener("open-cbt-connect", handleGlobalOpen);
    return () => window.removeEventListener("open-cbt-connect", handleGlobalOpen);
  }, []);

  // Keyboard shortcut ESC for projector mode
  useEffect(() => {
    if (!isProjectorMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setIsProjectorMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isProjectorMode]);

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const { school, terminology } = useTenant();
  const { universalToken, timeLeft, students } = useExamData();

  const [activeTab, setActiveTab] = useState<"portal" | "exambro" | "server">("portal");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [portalQrDataUrl, setPortalQrDataUrl] = useState<string>("");
  const [apkQrDataUrl, setApkQrDataUrl] = useState<string>("");

  const portalOrigin = useMemo(() => getStudentPortalOrigin(school?.slug), [school?.slug]);
  const studentExamUrl = useMemo(() => getStudentExamUrl(school?.slug), [school?.slug]);
  const apkDownloadUrl = useMemo(() => `${portalOrigin}/unduh`, [portalOrigin]);

  const isLocal = useMemo(() => {
    return isLocalNetwork() || (school && isLocalServer(school));
  }, [school]);

  // Generate QR codes
  useEffect(() => {
    if (!isOpen && !isProjectorMode) return;

    QRCode.toDataURL(studentExamUrl, {
      width: 500,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setPortalQrDataUrl)
      .catch((err) => console.error("Gagal generate QR portal:", err));

    QRCode.toDataURL(apkDownloadUrl, {
      width: 320,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setApkQrDataUrl)
      .catch((err) => console.error("Gagal generate QR APK:", err));
  }, [isOpen, isProjectorMode, studentExamUrl, apkDownloadUrl]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const totalStudents = students?.length || 0;
  const quota = (school as any)?.quota || 1000;

  return (
    <>
      <Dialog
        open={isOpen && !isProjectorMode}
        onOpenChange={(open) => {
          if (!open && !isProjectorMode) {
            handleClose();
          }
        }}
      >
        <DialogContent className="max-w-xl w-full p-0 overflow-hidden bg-white dark:bg-[#0e0f11] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <span>Portal Siswa &amp; Akses CBT</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    {school?.name || "EXAMKU"}
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Tautan akses siswa, QR Code proyektor ruang ujian, dan aplikasi Exambro
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="h-8 w-8 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-6 pt-2 bg-neutral-50/30 dark:bg-neutral-900/20">
            <button
              type="button"
              onClick={() => setActiveTab("portal")}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === "portal"
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>Portal Siswa &amp; QR</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("exambro")}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === "exambro"
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Exambro Siswa</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("server")}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === "server"
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <Wifi className="h-3.5 w-3.5" />
              <span>Status Server</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {activeTab === "portal" && (
              <div className="space-y-4">
                {/* QR Code & Link Card */}
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex flex-col sm:flex-row items-center gap-4">
                  {/* QR Image Box */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div
                      onClick={() => setIsProjectorMode(true)}
                      className="p-2 bg-white rounded-xl border border-neutral-200 shadow-xs cursor-pointer hover:border-emerald-500 transition-colors group relative"
                      title="Klik untuk Perbesar ke Layar Proyektor"
                    >
                      {portalQrDataUrl ? (
                        <img
                          src={portalQrDataUrl}
                          alt="QR Portal Ujian Siswa"
                          className="w-28 h-28 sm:w-32 sm:h-32 object-contain"
                        />
                      ) : (
                        <div className="w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center text-xs text-neutral-400">
                          Memuat QR...
                        </div>
                      )}
                      <div className="absolute inset-0 bg-emerald-950/20 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center transition-opacity">
                        <span className="text-[10px] font-bold bg-white text-neutral-900 px-2 py-0.5 rounded shadow">
                          Perbesar
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsProjectorMode(true)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer"
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      <span>Mode Proyektor LCD</span>
                    </button>
                  </div>

                  {/* Link Info */}
                  <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        URL Login {terminology.student}
                      </span>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
                        Siswa cukup memindai QR Code atau membuka tautan berikut di browser / Exambro:
                      </p>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono text-xs text-neutral-900 dark:text-neutral-100">
                      <span className="flex-1 truncate select-all">{studentExamUrl}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(studentExamUrl, "portal_url")}
                        className="p-1 rounded text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                        title="Salin Link"
                      >
                        {copiedKey === "portal_url" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <NeonButton
                        variant="primary"
                        color="brand"
                        size="xs"
                        onClick={() => setIsProjectorMode(true)}
                      >
                        <Monitor className="h-3.5 w-3.5" />
                        <span>Mode Proyektor</span>
                      </NeonButton>
                      <NeonButton
                        variant="secondary"
                        size="xs"
                        onClick={() => handleCopy(studentExamUrl, "portal_url_btn")}
                      >
                        {copiedKey === "portal_url_btn" ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Salin Link</span>
                          </>
                        )}
                      </NeonButton>
                      <NeonButton
                        variant="outline"
                        size="xs"
                        onClick={() => window.open(studentExamUrl, "_blank")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Buka Tab Baru</span>
                      </NeonButton>
                    </div>
                  </div>
                </div>

                {/* Token Universal Section */}
                {universalToken ? (
                  <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                          Token Ujian Universal Aktif
                        </div>
                        <div className="text-base font-extrabold font-mono tracking-widest text-amber-900 dark:text-amber-100">
                          {universalToken}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {timeLeft && (
                        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-md">
                          Sisa: {timeLeft}
                        </span>
                      )}
                      <NeonButton
                        variant="secondary"
                        size="xs"
                        onClick={() => handleCopy(universalToken, "token")}
                      >
                        {copiedKey === "token" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </NeonButton>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>Token Universal belum diaktifkan (Siswa masuk menggunakan token per-ruangan).</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === "exambro" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex flex-col sm:flex-row items-center gap-4">
                  <div className="p-2 bg-white rounded-xl border border-neutral-200 shadow-xs shrink-0">
                    {apkQrDataUrl ? (
                      <img
                        src={apkQrDataUrl}
                        alt="QR Download APK Siswa"
                        className="w-28 h-28 sm:w-32 sm:h-32 object-contain"
                      />
                    ) : (
                      <div className="w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center text-xs text-neutral-400">
                        Memuat QR...
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-center sm:justify-start gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Aplikasi Resmi Exambro Siswa (Android APK)</span>
                      </h4>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                        Aplikasi anti-curang dengan proteksi kiosk resmi: melarang split-screen, tangkapan layar, berpindah aplikasi, dan floating app.
                      </p>
                    </div>

                    <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <NeonButton
                        variant="primary"
                        color="brand"
                        size="xs"
                        onClick={() => window.open(apkDownloadUrl, "_blank")}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Unduh APK Siswa</span>
                      </NeonButton>
                      <NeonButton
                        variant="secondary"
                        size="xs"
                        onClick={() => handleCopy(apkDownloadUrl, "apk_url")}
                      >
                        {copiedKey === "apk_url" ? "Tautan Disalin!" : "Salin Link Unduh"}
                      </NeonButton>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 text-[11px] text-neutral-600 dark:text-neutral-300 space-y-1">
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Panduan untuk Pengawas Ruangan:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-neutral-500 dark:text-neutral-400">
                    <li>Siswa pengguna smartphone Android wajib menginstal APK ini sebelum masuk ruang ujian.</li>
                    <li>Siswa di perangkat Laptop/Chromebook dapat membuka portal via Google Chrome / Safe Exam Browser.</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === "server" && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 space-y-2">
                  <div className="flex justify-between items-center py-1 border-b border-neutral-200/60 dark:border-neutral-800">
                    <span className="text-neutral-500 dark:text-neutral-400">Tipe Layanan CBT:</span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      {isLocal ? (
                        <>
                          <HardDrive className="h-3.5 w-3.5 text-amber-500" />
                          <span>Server Lokal (Offline LAN)</span>
                        </>
                      ) : (
                        <>
                          <Globe className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Cloud Master VPS (Online SaaS)</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-neutral-200/60 dark:border-neutral-800">
                    <span className="text-neutral-500 dark:text-neutral-400">Database Engine:</span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      PocketBase (SQLite WAL Mode)
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-neutral-200/60 dark:border-neutral-800">
                    <span className="text-neutral-500 dark:text-neutral-400">Latensi Respons Jaringan:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      &lt; 2 ms (Sangat Responsif)
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-neutral-500 dark:text-neutral-400">Kapasitas Peserta:</span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {totalStudents} / {quota} {terminology.student}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/40">
            <span className="text-[11px] text-neutral-400">
              Examku Engine v1.2.2 • Kiosk Shield 2.0
            </span>
            <div className="flex items-center gap-2">
              <NeonButton variant="secondary" size="xs" onClick={handleClose}>
                Tutup
              </NeonButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Mode Proyektor LCD / InFocus Fullscreen Overlay via Portal ── */}
      {isProjectorMode && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] flex flex-col justify-between p-6 sm:p-10 bg-[#090d16] text-white select-none overflow-y-auto animate-in fade-in duration-200">
          {/* Top Bar */}
          <div className="w-full flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {school?.name || "PORTAL UJIAN"}
                  </span>
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Mode Proyektor LCD / Layar Kelas
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white mt-0.5 tracking-tight">
                  Akses Ujian Berbasis Komputer (CBT)
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleBrowserFullscreen}
                className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-700/60"
                title="Layar Penuh"
              >
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline">{isFullscreen ? "Keluar Fullscreen" : "Fullscreen"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                  }
                  setIsProjectorMode(false);
                }}
                className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 border border-red-500/40"
              >
                <X className="h-4 w-4" />
                <span>Kembali (ESC)</span>
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="my-auto py-6 flex flex-col items-center justify-center text-center space-y-6 max-w-3xl mx-auto w-full">
            <div className="space-y-2">
              <p className="text-sm sm:text-base font-medium text-slate-300 max-w-xl mx-auto">
                Arahkan kamera smartphone atau aplikasi Exambro ke QR Code berikut untuk langsung membuka halaman ujian:
              </p>
            </div>

            {/* Giant QR Card */}
            <div className="p-5 sm:p-7 bg-white rounded-3xl shadow-2xl shadow-emerald-500/10 border-4 border-emerald-500/40 transform transition-transform hover:scale-[1.02]">
              {portalQrDataUrl ? (
                <img
                  src={portalQrDataUrl}
                  alt="QR Portal Proyektor"
                  className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 object-contain"
                />
              ) : (
                <div className="w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center text-slate-500 font-bold">
                  Memuat QR Code...
                </div>
              )}
            </div>

            {/* URL Display */}
            <div className="w-full max-w-lg space-y-1.5">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
                Atau Buka Alamat Web Melalui Browser:
              </span>
              <div className="py-3 px-5 rounded-2xl bg-slate-900/90 border-2 border-emerald-500/40 font-mono text-base sm:text-xl font-bold text-emerald-400 tracking-wider shadow-inner flex items-center justify-center gap-3">
                <Globe className="h-5 w-5 text-emerald-400 shrink-0" />
                <span className="select-all">{studentExamUrl}</span>
              </div>
            </div>

            {/* Token Universal Banner */}
            {universalToken && (
              <div className="inline-flex items-center gap-3.5 px-6 py-3 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 shadow-lg shadow-amber-500/5">
                <KeyRound className="h-6 w-6 text-amber-400 shrink-0" />
                <span className="text-sm font-semibold uppercase tracking-wider text-amber-300">Token Ujian:</span>
                <span className="text-2xl sm:text-3xl font-extrabold tracking-widest font-mono text-white">
                  {universalToken}
                </span>
                {timeLeft && (
                  <span className="text-xs px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-200 border border-amber-500/30">
                    Sisa: {timeLeft}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bottom Bar Info */}
          <div className="w-full pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Status Server: Aktif &amp; Siap Melayani Siswa</span>
            </div>
            <div className="text-center sm:text-right">
              Tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">ESC</kbd> pada keyboard untuk menutup mode proyektor
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default CbtConnectModal;
