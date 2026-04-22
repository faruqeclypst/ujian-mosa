import { motion } from "framer-motion";

const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-6 bg-slate-50 dark:bg-slate-950 font-sans">
      <div className="relative">
        {/* Outer Glow */}
        <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse"></div>
        {/* Spinner */}
        <motion.div
          className="h-20 w-20 rounded-[2rem] border-4 border-emerald-500/10 border-t-emerald-500 relative z-10"
          animate={{ rotate: 360, borderRadius: ["2rem", "1rem", "2rem"] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        />
      </div>
      <div className="flex flex-col items-center gap-2 relative z-10">
        <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.5em] animate-pulse">EXAM AA System</p>
        <p className="text-[12px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Menyiapkan Dashboard...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
