import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Monitor,
  BarChart3,
  Lock,
  Server,
  CheckCircle2,
} from "lucide-react";
import { APP_DISPLAY_VERSION } from "../../utils/version";
import { cn } from "../../lib/utils";

interface ChangelogItem {
  id: string;
  category: string;
  scopeTag: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const CHANGELOG_ITEMS: ChangelogItem[] = [
  {
    id: "fluid-layout",
    category: "Tampilan Layar",
    scopeTag: "Antarmuka Pengawas",
    title: "Tata Letak Responsif untuk Tablet dan Ponsel Pengawas",
    description:
      "Penyesuaian tata letak tabel dan menu administrasi agar pas di layar tablet dan ponsel pengawas tanpa pergeseran horizontal selama pengawasan sesi ujian berlangsung.",
    icon: Monitor,
  },
  {
    id: "item-analysis",
    category: "Analisis Soal",
    scopeTag: "Statistik Asesmen",
    title: "Kalkulasi Daya Pembeda & Rekapitulasi Otomatis",
    description:
      "Perhitungan otomatis parameter mutu soal: indeks daya pembeda, tingkat kesukaran butir soal, efektivitas distraktor, serta ekspor rekap nilai siap cetak ke format Excel (.xlsx).",
    icon: BarChart3,
  },
  {
    id: "integrity-kiosk",
    category: "Keamanan Kiosk",
    scopeTag: "Exambro Kiosk",
    title: "Toleransi Jaringan Wi-Fi & Proteksi Anti-Curang",
    description:
      "Penyempurnaan heartbeat siswa dengan pemulihan otomatis saat fluktuasi sinyal router lokal, deteksi peralihan jendela aplikasi, dan penguncian instan sesi ujian.",
    icon: Lock,
  },
  {
    id: "offline-update",
    category: "Server Offline",
    scopeTag: "Instalasi Lokal",
    title: "Pembaruan Server Sekolah Sekali Klik",
    description:
      "Instalasi server offline sekolah dapat diperbarui langsung dari antarmuka web dalam 1 klik dengan jaminan database lokal ujian (data.db) tetap aman dan tidak terhapus.",
    icon: Server,
  },
];

const AUTO_SLIDE_DURATION = 6500; // 6.5 detik per slide

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 14 : -14,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.22,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -14 : 14,
    opacity: 0,
    transition: {
      duration: 0.16,
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
      className="rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#0c0d0e] overflow-hidden shadow-2xs transition-all"
    >
      {/* ── 1. Clean Official Release Header Banner ── */}
      <div className="relative px-4 sm:px-6 py-4 border-b border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40">
        {/* Subtle decorative grid pattern background (low opacity, purely textural) */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />

        <div className="relative z-10 space-y-3">
          {/* Top Row: Logo + Version + Official Release Status */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <img
                src="/logo-examku-cbt.webp"
                alt="EXAMKU CBT"
                className="h-6 sm:h-6.5 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/logo-default.webp";
                }}
              />
              <span className="h-3 w-px bg-neutral-300 dark:bg-neutral-700 hidden sm:inline-block" />
              <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-white dark:bg-neutral-850 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-750 shadow-2xs">
                {APP_DISPLAY_VERSION}
              </span>
              <span className="text-[11px] font-mono text-neutral-400 dark:text-neutral-500 hidden sm:inline">
                Rilis Stabil
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sistem Terkini</span>
            </div>
          </div>

          {/* Headline & Description */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400 dark:text-neutral-500">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Catatan Rilis</span>
              <span>•</span>
              <span>21 Oktober 2026</span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight leading-snug">
              Infrastruktur Asesmen Terintegrasi &amp; Pengamanan Kiosk Realtime
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-2xl hidden sm:block">
              Pembaruan stabilitas ujian, perlindungan sesi peserta secara realtime, dan rekapitulasi nilai otomatis.
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. Carousel Slide Content Body ── */}
      <div className="p-4 sm:p-5 min-h-[110px] flex flex-col justify-center relative overflow-hidden bg-white dark:bg-[#0c0d0e]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentItem.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="space-y-2.5"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1.5 max-w-3xl">
                {/* Category & Scope Indicator */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-850 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-750">
                    <IconComponent className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{currentItem.category}</span>
                  </span>

                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-neutral-400 dark:text-neutral-500 border border-neutral-200/70 dark:border-neutral-800">
                    {currentItem.scopeTag}
                  </span>

                  <h3 className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100">
                    {currentItem.title}
                  </h3>
                </div>

                {/* Substantive Description */}
                <p className="text-xs sm:text-[13px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {currentItem.description}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── 3. Bottom Interactive Controls & Progress Tabs ── */}
      <div className="bg-neutral-50/80 dark:bg-neutral-900/30 px-3 sm:px-4 py-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-2 sm:gap-3">
        {/* Category Tabs (Direct Navigation) */}
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
                  "relative px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 select-none shrink-0",
                  isActive
                    ? "bg-white dark:bg-neutral-850 text-neutral-900 dark:text-white font-semibold shadow-2xs border border-neutral-200 dark:border-neutral-750"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40 border border-transparent"
                )}
                title={item.title}
              >
                <ItemIcon className={cn("h-3 w-3 shrink-0", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400")} />
                <span>{item.category}</span>

                {/* Subtle active progress indicator */}
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

        {/* Arrow Controls & Slide Counter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500 mr-1">
            <span className="text-neutral-800 dark:text-neutral-200 font-semibold">{currentIndex + 1}</span>
            <span>/{CHANGELOG_ITEMS.length}</span>
          </div>

          <button
            type="button"
            onClick={prevSlide}
            className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer active:scale-95"
            title="Slide Sebelumnya"
            aria-label="Slide Sebelumnya"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={nextSlide}
            className="h-7 w-7 rounded-md flex items-center justify-center bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer active:scale-95"
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
