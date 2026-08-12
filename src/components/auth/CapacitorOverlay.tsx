import { useEffect, useState, useRef, useCallback } from "react";
import { RefreshCw, LogOut, X, MoreHorizontal, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

const CapacitorOverlay = () => {
  const [isCapacitor, setIsCapacitor] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [dialogType, setDialogType] = useState<"none" | "refresh" | "exit">("none");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Simple drag implementation without framer-motion
  const fabRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragState.current = {
      isDragging: true,
      startX: touch.clientX - position.x,
      startY: touch.clientY - position.y,
      offsetX: position.x,
      offsetY: position.y,
    };
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragState.current.isDragging) return;
    const touch = e.touches[0];
    const newX = touch.clientX - dragState.current.startX;
    const newY = touch.clientY - dragState.current.startY;
    setPosition({ x: newX, y: newY });
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragState.current.isDragging = false;
  }, []);

  useEffect(() => {
    if (dialogType === "exit") {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [dialogType]);

  useEffect(() => {
    // Only show on Android native platform
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      setIsCapacitor(true);
    }

    // Listen for hardware back button — block completely to prevent session exit
    const backListener = App.addListener('backButton', () => {
      // Do nothing — back button is disabled during exam sessions.
      // Exit is only available via the floating menu button with password.
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, []);

  const isExcludedRoute = window.location.pathname.startsWith('/admin') ||
    window.location.pathname.startsWith('/superadmin');

  if (!isCapacitor || isExcludedRoute) return null;

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExitApp = async () => {
    const cleanPass = password.trim().toLowerCase();
    if (cleanPass === "quit") {
      try {
        if (Capacitor.isNativePlatform()) {
          // @ts-ignore
          const cheatAlert = Capacitor.Plugins.CheatAlert;
          if (cheatAlert && (cheatAlert as any).exitApp) {
            await (cheatAlert as any).exitApp();
          }
          await App.exitApp();
        } else {
          setDialogType("none");
          window.close();
        }
      } catch (e) {
        console.error("Exit system failed, forcing fallback:", e);
        App.exitApp();
      }
    } else {
      alert("Password Salah!");
      setPassword("");
    }
  };

  return (
    <>
      {/* Draggable Menu Toggle — lightweight, no framer-motion */}
      <div
        ref={fabRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        className="fixed bottom-24 right-5 flex flex-col items-center gap-2.5 z-[9990] pointer-events-auto select-none print:hidden touch-none"
      >
        {showMenu && (
          <div className="flex flex-col gap-2.5 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {/* Refresh Button */}
            <button
              onClick={() => { handleRefresh(); setShowMenu(false); }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl border border-emerald-400 active:scale-90 transition-transform"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>

            {/* Exit Button */}
            <button
              onClick={() => { setDialogType("exit"); setPassword(""); setShowPassword(false); setShowMenu(false); }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-rose-500 text-white shadow-xl border border-rose-400 active:scale-90 transition-transform"
              title="Exit"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}

        {/* Main Toggle Button */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`w-12 h-12 flex items-center justify-center rounded-full shadow-2xl border active:scale-90 transition-transform ${
            showMenu
              ? "bg-slate-900 border-slate-700 text-white"
              : "bg-emerald-500 border-emerald-400 text-white"
          }`}
        >
          {showMenu ? <X size={20} /> : <MoreHorizontal size={20} />}
        </button>
      </div>

      {dialogType !== "none" && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/60 pointer-events-auto select-none">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[320px] rounded-[2rem] p-6 shadow-2xl border border-white/5 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto select-text">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-5 mx-auto">
              {dialogType === "refresh" ? (
                <RefreshCw className="text-blue-500 w-6 h-6" />
              ) : (
                <ShieldAlert className="text-rose-500 w-6 h-6" />
              )}
            </div>

            <h3 className="text-lg font-bold text-center mb-2 dark:text-white">
              {dialogType === "refresh" ? "Muat Ulang?" : "Keluar Sesi?"}
            </h3>

            <p className="text-center text-slate-500 dark:text-slate-400 text-xs mb-6 leading-relaxed">
              {dialogType === "refresh"
                ? "Seluruh progres jawaban yang belum tersimpan mungkin akan hilang."
                : "Hanya pengawas yang diizinkan untuk menutup aplikasi ujian ini."}
            </p>

            {dialogType === "exit" && (
              <div className="mb-6 relative">
                <input
                  ref={inputRef}
                  type={showPassword ? "text" : "password"}
                  inputMode="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="KODE PENGAWAS"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-4 pl-4 pr-12 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center font-bold tracking-[0.3em] outline-none placeholder:tracking-normal placeholder:font-medium text-sm dark:text-white select-text pointer-events-auto"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleExitApp();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={dialogType === "refresh" ? handleRefresh : handleExitApp}
                className={`w-full py-3.5 rounded-xl font-bold text-white text-sm shadow-lg active:scale-95 transition-transform ${
                  dialogType === "refresh"
                    ? "bg-blue-600 shadow-blue-500/20"
                    : "bg-rose-600 shadow-rose-500/20"
                }`}
              >
                Ya, Lanjutkan
              </button>
              <button
                onClick={() => { setDialogType("none"); setPassword(""); setShowPassword(false); }}
                className="w-full py-2 text-slate-400 font-bold text-xs"
              >
                Batal / Kembali
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CapacitorOverlay;
