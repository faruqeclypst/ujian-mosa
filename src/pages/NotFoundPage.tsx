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
        {/* Large 404 text with gradient */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
        >
          <h1 className="text-[120px] md:text-[180px] font-black leading-none bg-gradient-to-b from-blue-600 to-indigo-600 bg-clip-text text-transparent opacity-20 dark:opacity-30 select-none">
            404
          </h1>
        </motion.div>

        {/* Content Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="-mt-10 md:-mt-16"
        >
          <div className="mb-6 inline-flex p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
            <Home size={32} />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
            Ups! Halaman Tidak Ada
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg mb-10 max-w-md mx-auto leading-relaxed">
            Sepertinya Anda tersesat. Halaman yang Anda cari tidak tersedia atau telah dipindahkan ke alamat lain.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              className="w-full sm:w-auto rounded-2xl h-14 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Link to="/" className="flex items-center gap-2">
                <Home size={20} />
                Kembali ke Beranda
              </Link>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="w-full sm:w-auto rounded-2xl h-14 px-8 border-slate-200 dark:border-slate-800 bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 font-bold transition-all hover:scale-[1.02] active:scale-95 text-slate-700 dark:text-slate-300"
            >
              <ArrowLeft size={20} className="mr-2" />
              Kembali
            </Button>
          </div>
        </motion.div>

        {/* Subtle Footer */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-16 text-slate-400 text-sm font-medium"
        >
          Portal Ujian &copy; {new Date().getFullYear()}
        </motion.p>
      </div>
    </div>
  );
};

export default NotFoundPage;
