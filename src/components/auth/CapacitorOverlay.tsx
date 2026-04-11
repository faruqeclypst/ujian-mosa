import { useEffect, useState } from "react";
import { RefreshCw, LogOut, X, ShieldAlert } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { motion, AnimatePresence } from "framer-motion";

const CapacitorOverlay = () => {
  const [isCapacitor, setIsCapacitor] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [dialogType, setDialogType] = useState<"none" | "refresh" | "exit">("none");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setIsCapacitor(true);
    }
  }, []);

  if (!isCapacitor) return null;

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExitApp = async () => {
    if (password === "quit") {
      setDialogType("none");
      try {
        if (Capacitor.isNativePlatform()) {
          // @ts-ignore
          await (Capacitor.Plugins.CheatAlert as any).exitApp();
        } else {
          window.close();
        }
      } catch (e) {
        console.error("Exit failed", e);
        App.exitApp();
      }
    } else {
      alert("Password Salah!");
      setPassword("");
    }
  };

  return (
    <>
      <motion.div
        drag
        dragMomentum={false}
        initial={{ x: 0, y: 0 }}
        className="fixed bottom-48 right-4 z-[9999] flex flex-col items-center gap-2"
        style={{ touchAction: "none" }}
      >
        <AnimatePresence>
          {showMenu && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 20 }}
              className="bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2 mb-2"
            >
              <button
                onClick={handleRefresh}
                className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center hover:bg-blue-100 transition-colors"
                title="Refresh"
              >
                <RefreshCw size={18} />
              </button>
              <button
                onClick={() => { setDialogType("exit"); setShowMenu(false); }}
                className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center hover:bg-rose-100 transition-colors"
                title="Keluar Aplikasi"
              >
                <LogOut size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-12 h-12 bg-slate-900/90 dark:bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all border border-white/20"
        >
          {showMenu ? <X size={20} /> : <div className="font-black text-[10px]">CBT</div>}
        </button>
      </motion.div>

      <AnimatePresence>
        {dialogType !== "none" && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center mb-6 mx-auto">
                {dialogType === "refresh" ? <RefreshCw className="text-blue-600" /> : <ShieldAlert className="text-rose-600" />}
              </div>
              <h3 className="text-xl font-black text-center mb-2 dark:text-white uppercase tracking-tight">
                {dialogType === "refresh" ? "Muat Ulang?" : "Keluar Sesi?"}
              </h3>
              <p className="text-center text-slate-500 text-sm mb-8 font-medium">
                {dialogType === "refresh" ? "Seluruh progres jawaban yang belum tersimpan mungkin akan hilang." : "Hanya pengawas yang diizinkan untuk menutup aplikasi ujian ini."}
              </p>
              {dialogType === "exit" && (
                <input 
                  type="password"
                  placeholder="Password Pengawas"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full mb-6 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none text-center font-bold tracking-widest outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              )}
              <div className="flex flex-col gap-3">
                <button 
                  onClick={dialogType === "refresh" ? handleRefresh : handleExitApp}
                  className={`w-full py-4 rounded-2xl font-black text-white uppercase tracking-widest text-xs ${dialogType === "refresh" ? "bg-blue-600" : "bg-rose-600"}`}
                >
                  Ya, Lanjutkan
                </button>
                <button 
                  onClick={() => { setDialogType("none"); setPassword(""); }}
                  className="w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-[10px]"
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
