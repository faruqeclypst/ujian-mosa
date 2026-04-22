import { useEffect, useState } from "react";
import { RefreshCw, LogOut, X, MoreHorizontal, ShieldAlert } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { motion, AnimatePresence } from "framer-motion";

const CapacitorOverlay = () => {
  const [isCapacitor, setIsCapacitor] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [dialogType, setDialogType] = useState<"none" | "refresh" | "exit">("none");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Only show on Android native platform
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      setIsCapacitor(true);
    }

    // Listen for hardware back button to show exit dialog
    const backListener = App.addListener('backButton', ({ canGoBack }) => {
      // If we're on a deep route, we might want to let it go back, 
      // but for Exambro, we usually want to block exit.
      setDialogType("exit");
      setPassword("");
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
      // Keep dialog visible while exiting to prevent double-input confusion
      try {
        if (Capacitor.isNativePlatform()) {
          // Try custom plugin first (for specialized locker apps)
          // @ts-ignore
          const cheatAlert = Capacitor.Plugins.CheatAlert;
          if (cheatAlert && (cheatAlert as any).exitApp) {
            await (cheatAlert as any).exitApp();
          } 
          
          // Guaranteed fallback for standard Capacitor apps
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
      {/* Draggable Menu Toggle */}
      <motion.div 
        drag
        dragMomentum={false}
        dragElastic={0.1}
        initial={{ x: 0, y: 0 }}
        className="fixed bottom-24 right-5 flex flex-col items-center gap-2.5 z-[9990] pointer-events-auto select-none print:hidden touch-none"
      >
        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              className="flex flex-col gap-2.5 mb-1"
            >
              {/* Refresh Button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { handleRefresh(); setShowMenu(false); }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl border border-emerald-400 hover:bg-emerald-600 transition-colors"
                title="Refresh"
              >
                <RefreshCw size={18} />
              </motion.button>

              {/* Exit Button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { setDialogType("exit"); setPassword(""); setShowMenu(false); }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-rose-500 text-white shadow-xl border border-rose-400 hover:bg-rose-600 transition-colors"
                title="Exit"
              >
                <LogOut size={18} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Toggle Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowMenu(!showMenu)}
          className={`w-12 h-12 flex items-center justify-center rounded-full shadow-2xl transition-all duration-300 border ${
            showMenu 
              ? "bg-slate-900 border-slate-700 text-white rotate-45" 
              : "bg-emerald-500 border-emerald-400 text-white"
          }`}
        >
          {showMenu ? <X size={20} /> : <MoreHorizontal size={20} />}
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {dialogType !== "none" && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 w-full max-w-[320px] rounded-[2rem] p-6 shadow-2xl border border-white/5"
            >
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
                <div className="mb-6">
                  <input
                    type="password"
                    placeholder="PIN PENGAWAS"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full py-4 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center font-bold tracking-[0.3em] outline-none transition-all placeholder:tracking-normal placeholder:font-medium text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleExitApp();
                      }
                    }}
                  />
                </div>
              )}

              <div className="flex flex-col gap-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={dialogType === "refresh" ? handleRefresh : handleExitApp}
                  className={`w-full py-3.5 rounded-xl font-bold text-white text-sm shadow-lg ${dialogType === "refresh"
                      ? "bg-blue-600 shadow-blue-500/20"
                      : "bg-rose-600 shadow-rose-500/20"
                    }`}
                >
                  Ya, Lanjutkan
                </motion.button>
                <button
                  onClick={() => { setDialogType("none"); setPassword(""); }}
                  className="w-full py-2 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 font-bold text-xs transition-colors"
                >
                  Batal / Kembali
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CapacitorOverlay;
