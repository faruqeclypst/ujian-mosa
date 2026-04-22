import { useState, useEffect } from "react";
import { masterPb } from "../../lib/pocketbase";
import { SchoolRecord, useTenant } from "../../context/TenantContext";
import { Search, ChevronRight, Loader2, Sparkles, RefreshCw, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

const SelectSchoolPage = () => {
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { setManualSchool } = useTenant();

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const records = await masterPb.collection("schools").getFullList<SchoolRecord>({
          filter: "is_active = true",
          sort: "name",
        });
        setSchools(records);
      } catch (err) {
        console.error("Failed to fetch schools:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchools();
  }, []);

  const filteredSchools = schools.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (slug: string) => {
    setManualSchool(slug);
  };

  return (
    <div className="h-screen bg-[#fdfdfd] flex flex-col relative font-sans overflow-hidden">
      {/* Dev Back to Landing Button */}
      {window.location.hostname === 'localhost' && !Capacitor.isNativePlatform() && (
        <div className="absolute top-6 left-6 z-50">
          <button
            onClick={() => setManualSchool(null)}
            className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-md border border-slate-200 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
          >
            Back to Landing
          </button>
        </div>
      )}
      {/* Premium Pristine Ambient Background */}
      <div className="absolute top-[-15%] left-[-10%] w-[60vw] h-[60vw] bg-slate-200/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[70vw] h-[70vw] bg-blue-50/30 rounded-full blur-[140px] pointer-events-none" />

      {/* Luxury Minimalist Header Section */}
      <div className="pt-20 pb-10 px-8 relative z-10 max-w-md mx-auto w-full">
        <div className="flex items-center gap-6 mb-2">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, x: -20 }}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full scale-150" />
            <img src="/logo-default.png" alt="Logo" className="w-16 h-16 sm:w-20 sm:h-20 object-contain relative z-10 drop-shadow-sm" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex-1"
          >
            <h1 className="text-[1.65rem] font-bold text-slate-800 tracking-tight leading-none mb-1 font-display">
              Computer Based <span className="text-blue-600 font-black italic">Test</span>
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-slate-400 text-[9.5px] font-semibold uppercase tracking-[0.3em] mt-2 font-sans opacity-60"
            >
              Pilih Sekolah / Kampus Anda!
            </motion.p>
          </motion.div>
        </div>
      </div>

      {/* Search Bar - Pristine Glass Pill */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="px-6 relative z-10 mb-8 w-full max-w-md mx-auto"
      >
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none z-20">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-300" strokeWidth={2.5} />
          </div>
          <input
            type="text"
            className="block w-full pl-14 pr-6 py-4 rounded-full bg-white/60 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] outline-none text-slate-800 font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 border border-white/80 transition-all z-10 relative"
            placeholder="Cari nama sekolah..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </motion.div>

      {/* List Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="flex-1 px-6 pb-28 overflow-y-auto overscroll-y-contain relative z-10 w-full max-w-md mx-auto scrollbar-hidden"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-slate-500 font-medium tracking-wide">Mencari Server...</p>
          </div>
        ) : filteredSchools.length > 0 ? (
          <div className="flex flex-col gap-4">
            <AnimatePresence>
              {filteredSchools.map((school, index) => (
                <motion.button
                  key={school.id}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    delay: index * 0.05,
                    type: "spring",
                    stiffness: 260,
                    damping: 20
                  }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleSelect(school.slug)}
                  className="w-full bg-white/70 backdrop-blur-2xl border border-white rounded-[1.75rem] p-4 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_15px_35px_rgb(0,0,0,0.06)] transition-all duration-300 text-left group"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Brand Image (No Wrapper) */}
                    <img
                      src={school.logo_url ? (school.logo_url.startsWith('http') ? school.logo_url : masterPb.files.getUrl(school as any, school.logo_url)) : "/logo-default.png"}
                      alt={school.name}
                      className="w-14 h-14 shrink-0 object-contain relative z-10 group-hover:scale-110 transition-transform duration-300 drop-shadow-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/logo-default.png";
                      }}
                    />
                    {/* Brand Text Wrapper */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-bold text-slate-800 text-[0.95rem] leading-snug line-clamp-2 px-1 group-hover:text-blue-600 transition-colors">
                        {school.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 px-1">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                        </span>
                        <span className="text-[0.7rem] text-slate-500 font-bold tracking-widest uppercase">
                          Online Server
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Action Button Indicator */}
                  <div className="w-12 h-12 shrink-0 rounded-full bg-slate-50/80 flex items-center justify-center group-hover:bg-blue-600 group-hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all duration-300 ring-1 ring-black/5">
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" strokeWidth={3} />
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.03)]"
          >
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-5 ring-8 ring-blue-50/50">
              <Search className="w-8 h-8 text-blue-400" strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Tidak Ditemukan</h3>
            <p className="text-slate-500 text-[13px] font-medium leading-relaxed px-4">
              Kami tidak dapat menemukan sekolah tersebut. Pastikan ejaan sudah benar.
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* Elegant Fade Footer */}
      <div className="fixed bottom-0 left-0 w-full text-center pb-8 pt-20 flex-shrink-0 bg-gradient-to-t from-[#fdfdfd] via-[#fdfdfd]/90 to-transparent pointer-events-none z-20">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em]">
          CBT by Alfaruq Asri
        </p>
      </div>
    </div>
  );
};

export default SelectSchoolPage;
