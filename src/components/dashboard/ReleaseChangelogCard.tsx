import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  Sparkles,
  ShieldCheck,
  Database,
} from "lucide-react";
import { APP_DISPLAY_VERSION } from "../../utils/version";
import { cn } from "../../lib/utils";

interface ChangelogItem {
  id: string;
  category: string;
  badgeClass: string;
  activeColor: string;
  title: string;
  description: string;
  metric: string;
  metricClass: string;
  icon: React.ElementType;
}

const CHANGELOG_ITEMS: ChangelogItem[] = [
  {
    id: "fluid-layout",
    category: "Performa",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    activeColor: "#10b981",
    title: "Fluid Layout & Zero Horizontal Overflow di Seluruh Modul Admin",
    description:
      "Arsitektur grid tabel admin dirombak menyeluruh tanpa pergeseran horizontal pada layar tablet dan ponsel pengawas. Akselerasi rendering memangkas beban memori hingga 40% untuk pengawasan sesi ratusan peserta secara simultan.",
    metric: "+40% Kecepatan Render",
    metricClass: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
    icon: Zap,
  },
  {
    id: "item-analysis",
    category: "Fitur Utama",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
    activeColor: "#0ea5e9",
    title: "Diagnostik Butir Soal & Rekapitulasi Kurikulum Otomatis",
    description:
      "Kalkulasi instan parameter mutu asesmen: indeks daya pembeda, tingkat kesukaran butir soal, dan efektivitas distraktor pilihan ganda, dilengkapi rekomendasi butir soal serta ekspor rekap nilai siap cetak ke Excel (.xlsx).",
    metric: "Otomatisasi Penuh",
    metricClass: "text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800/60 shadow-[0_0_12px_rgba(14,165,233,0.15)]",
    icon: Sparkles,
  },
  {
    id: "integrity-kiosk",
    category: "Integritas",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    activeColor: "#a855f7",
    title: "Toleransi Jaringan Wi-Fi & Proteksi Anti-Curang Kiosk",
    description:
      "Penyempurnaan heartbeat siswa dengan pemulihan otomatis saat fluktuasi sinyal router lokal, deteksi peralihan jendela aplikasi, serta respon penguncian instan yang dapat dibuka kembali oleh pengawas dalam satu klik.",
    metric: "Latensi < 2ms",
    metricClass: "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800/60 shadow-[0_0_12px_rgba(168,85,247,0.15)]",
    icon: ShieldCheck,
  },
  {
    id: "offline-update",
    category: "Infrastruktur",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    activeColor: "#f59e0b",
    title: "Pembaruan 1-Click Server Offline dengan Proteksi Database",
    description:
      "Instalasi server lokal sekolah kini dapat diperbarui langsung secara mandiri dari antarmuka web dalam 1 klik tanpa perintah manual dan dengan jaminan keamanan database lokal ujian (data.db) tidak terhapus.",
    metric: "Zero Data Loss",
    metricClass: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
    icon: Database,
  },
];

const AUTO_SLIDE_DURATION = 6000; // 6 detik per slide

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 18 : -18,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.25,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -18 : 18,
    opacity: 0,
    transition: {
      duration: 0.18,
      ease: [0.25, 0.1, 0.25, 1],
    },
  }),
};

export const ReleaseChangelogCard: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const goToSlide = useCallback((index: number, newDir?: number) => {
    setDirection(newDir ?? (index > currentIndex ? 1 : -1));
    setCurrentIndex(index);
  }, [currentIndex]);

  const nextSlide = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % CHANGELOG_ITEMS.length);
  }, []);

  const prevSlide = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + CHANGELOG_ITEMS.length) % CHANGELOG_ITEMS.length);
  }, []);

  // Auto slide ticker
  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      nextSlide();
    }, AUTO_SLIDE_DURATION);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, nextSlide]);

  const currentItem = CHANGELOG_ITEMS[currentIndex];
  const IconComponent = currentItem.icon;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#0f1115] overflow-hidden shadow-2xs transition-all"
    >
      {/* ── 1. Elegant Header Banner (Light & Dark Responsive) ── */}
      <div className="relative h-36 sm:h-44 md:h-48 w-full overflow-hidden bg-slate-100 dark:bg-neutral-950 flex items-center border-b border-neutral-200 dark:border-neutral-800">
        {/* Background 3D Graphic */}
        <img
          src="/images/changelog-banner-light.jpg"
          alt="Examku CBT Release"
          className="absolute inset-0 w-full h-full object-cover object-right md:object-center opacity-90 dark:opacity-40 scale-[1.01]"
        />

        {/* Ambient Gradients: Crisp white fade on light mode, dark fade on dark mode */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent dark:from-neutral-950 dark:via-neutral-950/85 dark:to-neutral-950/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-white/40 dark:from-neutral-950/95 dark:via-transparent dark:to-neutral-950/40" />

        {/* Ad Banner Content */}
        <div className="relative z-10 w-full px-4 sm:px-6 py-3.5 flex flex-col justify-between h-full">
          {/* Top Row: Official Examku CBT Logo + Status Badge */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <img
                src="/logo-examku-cbt.webp"
                alt="EXAMKU CBT"
                className="h-6 sm:h-7 w-auto object-contain drop-shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/logo-default.webp";
                }}
              />
              <span className="h-3.5 w-px bg-neutral-300 dark:bg-white/20 hidden sm:inline-block" />
              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono font-bold bg-white/80 dark:bg-white/10 backdrop-blur-md text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs">
                {APP_DISPLAY_VERSION}
              </span>
              <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-100 dark:bg-neutral-900/80 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700/80">
                Major Release
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-white/80 dark:bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-neutral-200 dark:border-neutral-800 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[10px] sm:text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                Produksi Aktif
              </span>
            </div>
          </div>

          {/* Bottom Headline & Tagline */}
          <div className="space-y-1 max-w-xl">
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-emerald-600 dark:text-cyan-400 uppercase tracking-wider font-bold">
              <span>Catatan Rilis Resmi</span>
              <span>•</span>
              <span>21 Oktober 2026</span>
            </div>
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-neutral-900 dark:text-white tracking-tight leading-snug drop-shadow-xs">
              Infrastruktur Asesmen Terintegrasi &amp; Pengamanan Kiosk Realtime
            </h2>
            <p className="text-[11px] sm:text-xs text-neutral-600 dark:text-neutral-400 line-clamp-1 hidden sm:block">
              Performa stabil, proteksi heartbeat cerdas, dan analisis butir soal otomatis.
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. Carousel Slide Content Body ── */}
      <div className="p-4 sm:p-5 min-h-[140px] sm:min-h-[120px] flex flex-col justify-center relative overflow-hidden bg-white dark:bg-[#0f1115]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentItem.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wide uppercase border",
                      currentItem.badgeClass
                    )}
                  >
                    <IconComponent className="h-3 w-3" />
                    <span>{currentItem.category}</span>
                  </span>
                  <h3 className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100">
                    {currentItem.title}
                  </h3>
                </div>
                <p className="text-xs sm:text-[13px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {currentItem.description}
                </p>
              </div>

              <div className="shrink-0 self-start sm:self-center">
                <span
                  className={cn(
                    "inline-block font-mono text-[11px] font-semibold px-2.5 py-1 rounded-md border shadow-2xs whitespace-nowrap",
                    currentItem.metricClass
                  )}
                >
                  {currentItem.metric}
                </span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── 3. Bottom Interactive Controls & Progress Tabs ── */}
      <div className="bg-neutral-50/80 dark:bg-neutral-850 px-3 sm:px-4 py-2 sm:py-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2 sm:gap-3">
        {/* Category Pills (Tabs to jump directly) */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {CHANGELOG_ITEMS.map((item, idx) => {
            const isActive = idx === currentIndex;
            const ItemIcon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goToSlide(idx)}
                className={cn(
                  "relative px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 sm:gap-1.5 select-none shrink-0",
                  isActive
                    ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold shadow-2xs border border-neutral-200 dark:border-neutral-700"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                )}
                title={item.title}
              >
                <ItemIcon className={cn("h-3 w-3 transition-colors shrink-0", isActive ? "text-emerald-500" : "text-neutral-400")} />
                <span>{item.category}</span>

                {/* Animated progress line on active slide */}
                {isActive && !isPaused && (
                  <motion.div
                    className="absolute bottom-0 left-1 right-1 h-0.5 bg-emerald-500 rounded-full"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: AUTO_SLIDE_DURATION / 1000, ease: "linear" }}
                    style={{ originX: 0 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Arrow Controls & Counter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 mr-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{currentIndex + 1}</span>
            <span>/{CHANGELOG_ITEMS.length}</span>
          </div>

          <button
            type="button"
            onClick={prevSlide}
            className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-750 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors shadow-2xs cursor-pointer active:scale-95"
            title="Slide Sebelumnya"
            aria-label="Slide Sebelumnya"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={nextSlide}
            className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-750 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors shadow-2xs cursor-pointer active:scale-95"
            title="Slide Berikutnya"
            aria-label="Slide Berikutnya"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReleaseChangelogCard;
