import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";

const NotFoundPage = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 overflow-hidden relative font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse delay-75"></div>
        <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-teal-500/5 rounded-full blur-[100px] animate-pulse delay-150"></div>
      </div>

      <div className="relative z-10 text-center max-w-lg w-full">
        {/* Large 404 text with premium glass effect */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="relative"
        >
          <h1 className="text-[120px] md:text-[200px] font-black leading-none bg-gradient-to-b from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent opacity-10 dark:opacity-20 select-none blur-[2px]">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
             <span className="text-6xl md:text-8xl font-black text-slate-900 dark:text-white tracking-tighter drop-shadow-2xl">UPS!</span>
          </div>
        </motion.div>

        {/* Content Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="-mt-6 md:-mt-10"
        >
          <div className="mb-8 inline-flex p-5 rounded-[2rem] bg-white dark:bg-slate-800 shadow-2xl shadow-blue-500/10 border border-blue-50 dark:border-blue-900/30 text-blue-600 dark:text-blue-400">
            <Home size={40} className="animate-bounce" />
          </div>
          
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter uppercase">
            Halaman Tidak Ditemukan
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base mb-12 max-w-xs mx-auto font-bold uppercase tracking-widest leading-relaxed opacity-80">
            Sepertinya Anda tersesat di dimensi yang salah.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              className="w-full sm:w-auto rounded-3xl h-16 px-10 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-xs shadow-2xl transition-all hover:scale-[1.05] active:scale-95 border-none"
            >
              <Link to="/" className="flex items-center gap-3">
                <Home size={18} />
                Ke Beranda
              </Link>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="w-full sm:w-auto rounded-3xl h-16 px-10 border-2 border-slate-200 dark:border-slate-800 bg-transparent font-black uppercase tracking-widest text-[10px] transition-all hover:scale-[1.05] active:scale-95 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <ArrowLeft size={18} className="mr-2" />
              Kembali
            </Button>
          </div>
        </motion.div>

        {/* Subtle Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-20 flex flex-col items-center gap-4"
        >
          <div className="h-1 w-12 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent rounded-full" />
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">
            Portal E-Ujian &copy; {new Date().getFullYear()}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFoundPage;
