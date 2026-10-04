import React, { useState, useEffect, useRef } from "react";
import { 
  Globe, 
  QrCode, 
  Lock, 
  Play, 
  Clipboard, 
  X, 
  RotateCcw, 
  Clock, 
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Camera
} from "lucide-react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Html5Qrcode } from "html5-qrcode";

const CheatAlert = registerPlugin<any>("CheatAlert");

const PRESETS = [
  { label: "Google Forms", url: "https://docs.google.com/forms" },
  { label: "Microsoft Forms", url: "https://forms.office.com" },
  { label: "Quizizz", url: "https://quizizz.com/join" },
];

export const CustomBrowserPage: React.FC = () => {
  const [url, setUrl] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const qrReaderRef = useRef<Html5Qrcode | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("exam_browser_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {
      // ignore
    }

    // Stop alarm if still sounding
    if (Capacitor.isNativePlatform()) {
      try {
        CheatAlert.stopAlarm();
      } catch {}
    }
  }, []);

  const saveToHistory = (newUrl: string) => {
    try {
      const updated = [newUrl, ...history.filter(h => h !== newUrl)].slice(0, 5);
      setHistory(updated);
      localStorage.setItem("exam_browser_history", JSON.stringify(updated));
    } catch {}
  };

  const handleStartExam = async (targetUrl?: string) => {
    const rawUrl = (targetUrl || url).trim();
    if (!rawUrl) return;

    let finalUrl = rawUrl;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = "https://" + finalUrl;
    }

    saveToHistory(finalUrl);

    setIsLoading(true);

    if (Capacitor.isNativePlatform()) {
      try {
        await CheatAlert.startCustomExam({
          url: finalUrl,
          pin: "1234"
        });
      } catch (err) {
        console.error("Failed to start native custom exam:", err);
        // Fallback: direct navigation
        window.location.href = finalUrl;
      }
    } else {
      // In web browser (dev/preview)
      window.location.href = finalUrl;
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch {
      // clipboard access denied
    }
  };

  const startScanner = async () => {
    setIsScanning(true);
    setScanError(null);

    // Give DOM time to mount container
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader-container");
        qrReaderRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            stopScanner();
            setUrl(decodedText);
            handleStartExam(decodedText);
          },
          () => {
            // QR scan frame error, safely ignore
          }
        );
      } catch (err: any) {
        console.error("Camera error:", err);
        setScanError("Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.");
      }
    }, 200);
  };

  const stopScanner = async () => {
    if (qrReaderRef.current) {
      try {
        await qrReaderRef.current.stop();
        qrReaderRef.current.clear();
      } catch {}
      qrReaderRef.current = null;
    }
    setIsScanning(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full mx-auto my-auto space-y-6">
        {/* Header / Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 mb-1 shadow-lg shadow-blue-500/10">
            <Globe size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            EXAM AA Browser
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Kiosk browser ujian aman untuk Google Forms, Quizizz, dan CBT web dengan kuncian layar penuh.
          </p>
        </div>

        {/* Scanner Modal / Overlay */}
        {isScanning && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative space-y-4">
              <button 
                onClick={stopScanner}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-2"
                aria-label="Tutup pemindai"
              >
                <X size={20} />
              </button>
              
              <div className="text-center">
                <h3 className="font-semibold text-white text-base">Arahkan ke QR Code Soal</h3>
                <p className="text-xs text-slate-400 mt-0.5">Pindai QR link Google Form yang dibagikan guru</p>
              </div>

              <div id="qr-reader-container" className="w-full rounded-2xl overflow-hidden bg-black aspect-square flex items-center justify-center" />

              {scanError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{scanError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={stopScanner}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Input Card */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          {/* URL Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Tautan / URL Ujian
            </label>
            <div className="relative flex items-center">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://forms.gle/... atau IP Ujian"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl pl-3.5 pr-20 py-3 text-sm text-white placeholder-slate-500 outline-none transition"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {url ? (
                  <button
                    type="button"
                    onClick={() => setUrl("")}
                    className="p-1.5 text-slate-400 hover:text-slate-200"
                    title="Hapus"
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="p-1.5 text-slate-400 hover:text-blue-400 flex items-center gap-1 text-xs"
                    title="Tempel URL"
                  >
                    <Clipboard size={14} />
                    <span className="hidden sm:inline">Tempel</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons: Scan QR & Presets */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={startScanner}
              className="w-full py-3 px-4 rounded-2xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <Camera size={18} />
              <span>Pindai QR Code Soal</span>
            </button>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setUrl(preset.url)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                <Clock size={12} />
                <span>Riwayat Tautan:</span>
              </div>
              <div className="space-y-1">
                {history.map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setUrl(h)}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 text-xs text-slate-300 truncate block transition"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit / Start Button */}
          <button
            type="button"
            disabled={!url.trim() || isLoading}
            onClick={() => handleStartExam()}
            className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition"
          >
            <Play size={18} fill="currentColor" />
            <span>{isLoading ? "Menyiapkan Ujian..." : "Mulai Ujian (Kunci Layar)"}</span>
          </button>
        </div>

        {/* Security Info Footnote */}
        <div className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>Proteksi Kiosk, Anti-Screenshot & Semat Layar Aktif</span>
        </div>
      </div>
    </div>
  );
};

export default CustomBrowserPage;
