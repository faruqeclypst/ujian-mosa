import React, { useState, useEffect } from "react";
import {
  Search, ChevronDown, Copy, Check,
  Server, Database, ShieldCheck, AlertCircle, CheckCircle2,
  ArrowRight, Menu, X, ArrowUpRight,
  BookOpen, Users, FileSpreadsheet, Lock, Clock,
  CreditCard, HelpCircle, HardDrive, Zap, Terminal,
  Monitor, Smartphone, KeyRound, Laptop, RotateCcw, Download, ChevronRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

interface DocItem {
  id: string;
  title: string;
  category: string;
  description: string;
  keywords: string[];
}

const PUBLIC_DOC_ITEMS: DocItem[] = [
  // Mulai
  { id: "ringkasan", title: "Ringkasan Sistem CBT", category: "Panduan Memulai", description: "Pengenalan arsitektur dan kapabilitas platform CBT EXAMKU.", keywords: ["ringkasan", "cbt", "ujian", "fitur", "keunggulan", "overview"] },
  { id: "mulai-cepat", title: "Panduan Mulai Cepat", category: "Panduan Memulai", description: "Langkah mudah menyiapkan bank soal dan pelaksanaan ujian pertama.", keywords: ["mulai", "quickstart", "langkah", "awal", "panduan", "jadwal"] },
  { id: "peran-pengguna", title: "Hak Akses & Peran Pengguna", category: "Panduan Memulai", description: "Peran admin sekolah, guru pembuat soal, proktor pengawas, dan siswa.", keywords: ["peran", "role", "admin", "guru", "proktor", "siswa", "hak akses"] },

  // Mode Offline & Lisensi
  { id: "offline-arsitektur", title: "Arsitektur Server Offline", category: "Mode Offline & Lisensi", description: "Operasional ujian di lab sekolah pada jaringan lokal tanpa internet luar.", keywords: ["offline", "server", "lan", "local", "lab", "tanpa internet", "mandiri", "sqlite"] },
  { id: "offline-serial-key", title: "Aktivasi Lisensi Serial Key", category: "Mode Offline & Lisensi", description: "Tata cara aktivasi lisensi serial key resmi sekolah dan validasi kriptografis.", keywords: ["lisensi", "serial key", "aktivasi", "validasi", "offline", "rsa-2048", "sekolah"] },
  { id: "offline-hardware-binding", title: "Hardware ID & Anti-Duplikasi", category: "Mode Offline & Lisensi", description: "Penguncian perangkat server sekolah, jaminan keutuhan database data.db, dan prosedur pergantian laptop.", keywords: ["hardware id", "anti-duplikasi", "sidik jari", "database", "data.db", "ganti laptop", "reset perangkat"] },
  { id: "offline-update", title: "Pembaruan 1-Click Server", category: "Mode Offline & Lisensi", description: "Cara memperbarui modul aplikasi server offline tanpa menimpa database lokal.", keywords: ["update", "1-click", "pembaruan", "perbarui-server", "patch", "versi"] },

  // Operasional CBT & Manajemen Sekolah
  { id: "bank-soal", title: "Bank Soal & Import Excel", category: "Operasional CBT", description: "Format template soal Excel, aneka ragam tipe butir soal, dan penulisan rumus KaTeX.", keywords: ["soal", "bank soal", "excel", "import", "katex", "rumus", "opsi", "esai"] },
  { id: "ruang-ujian", title: "Ruang Ujian, Sesi & Token", category: "Operasional CBT", description: "Pengaturan ruang ujian, pembagian sesi peserta, pengacakan soal, dan token dinamis.", keywords: ["ruang ujian", "sesi", "jadwal", "acak", "token", "durasi", "waktu"] },
  { id: "monitoring-ujian", title: "Monitoring Proktor & Live Score", category: "Operasional CBT", description: "Pemantauan status pengerjaan siswa secara realtime dan tampilan live score layar proyektor.", keywords: ["monitoring", "live score", "proktor", "pengawas", "pantau", "skor langsung"] },
  { id: "penilaian-analisis", title: "Penilaian & Analisis Butir Soal", category: "Operasional CBT", description: "Skoring otomatis, koreksi esai guru, daya beda butir soal, dan ekspor rekap Excel.", keywords: ["nilai", "penilaian", "analisis", "koreksi", "ekspor", "rapor", "excel"] },

  // Aplikasi Siswa & Keamanan Exambro
  { id: "exambro-keamanan", title: "Proteksi Kiosk Exambro", category: "Aplikasi Siswa", description: "Protokol keamanan penguncian layar, pencegahan split screen, dan deteksi floating apps.", keywords: ["exambro", "kiosk", "anti-curang", "kunci layar", "split screen", "floating", "android"] },
  { id: "resiliensi-offline", title: "Resiliensi Jawaban Siswa", category: "Aplikasi Siswa", description: "Penyimpanan ganda jawaban di perangkat siswa untuk pencegahan koneksi Wi-Fi lab terputus.", keywords: ["resiliensi", "jawaban", "localstorage", "anti-hilang", "putus koneksi", "autosave"] },
  { id: "unduh-aplikasi", title: "Unduh Aplikasi Ujian Siswa", category: "Aplikasi Siswa", description: "Tautan unduh resmi Exambro APK Android dan panduan instalasi siswa.", keywords: ["unduh", "download", "apk", "android", "exambro", "instalasi"] },

  // Paket & Layanan
  { id: "paket-langganan", title: "Paket & Sistem Layanan", category: "Paket & Layanan", description: "Informasi paket kuota peserta ujian dan kemudahan aktivasi sekolah.", keywords: ["paket", "harga", "langganan", "kuota", "fitur", "sekolah"] },

  // Bantuan & Solusi Kendala
  { id: "troubleshoot", title: "Solusi Kendala Ujian (FAQ)", category: "Pusat Bantuan", description: "Panduan proktor mengatasi siswa terputus, reset login sesi, dan sinkronisasi jam.", keywords: ["troubleshoot", "reset login", "kendala", "error", "token", "bantuan", "proktor"] },
];

interface CommandSnippetProps {
  code: string;
  title?: string;
}

const CommandSnippet: React.FC<CommandSnippetProps> = ({ code, title }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xs my-3 text-left">
      {title && (
        <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
            <span>{title}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Terminal Script</span>
        </div>
      )}
      <div className="p-3.5 flex items-start justify-between gap-3 overflow-x-auto">
        <pre className="font-mono text-xs text-slate-100 whitespace-pre-wrap leading-relaxed select-all">
          {code}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "p-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer",
            copied
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white"
          )}
          title="Salin teks"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span>Tersalin</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export const PublicDocsPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("ringkasan");

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    "Panduan Memulai": false,
    "Mode Offline & Lisensi": false,
    "Operasional CBT": false,
    "Aplikasi Siswa": false,
    "Paket & Layanan": false,
    "Pusat Bantuan": false,
  });

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-80px 0px -60% 0px" }
    );

    PUBLIC_DOC_ITEMS.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    setSearchOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const filteredItems = PUBLIC_DOC_ITEMS.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q))
    );
  });

  const categories = [
    "Panduan Memulai",
    "Mode Offline & Lisensi",
    "Operasional CBT",
    "Aplikasi Siswa",
    "Paket & Layanan",
    "Pusat Bantuan",
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* ── TOP NAVBAR (PUBLIC CLEAN THEME) ─────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Buka navigasi menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 p-0.5 flex items-center justify-center shadow-2xs shrink-0">
              <img
                src="/logo-default.webp"
                onError={(e) => { (e.target as HTMLImageElement).src = "/logo-default.png"; }}
                alt="Examku Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 tracking-tight leading-none">
                  EXAMKU
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 leading-none">
                  Docs
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mt-0.5">
                Pusat Dokumentasi Resmi
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Search Trigger */}
        <div className="flex-1 max-w-md mx-6 hidden sm:block">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white text-slate-400 hover:text-slate-700 px-3 text-xs flex items-center justify-between transition-all shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <div className="flex items-center gap-2">
              <Search size={14} className="text-slate-400" />
              <span className="text-slate-500 font-medium">Cari panduan & dokumentasi ujian...</span>
            </div>
            <kbd className="font-mono text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-semibold shadow-2xs">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right Nav Buttons (Public facing only) */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="sm:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Cari dokumentasi"
          >
            <Search size={18} />
          </button>

          <Link
            to="/"
            className="hidden sm:inline-flex px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
          >
            Beranda
          </Link>

          <Link
            to="/pilih-sekolah"
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <span>Masuk CBT</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>

      {/* ── MAIN CONTENT LAYOUT ───────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex pt-6 pb-24 gap-8">
        {/* ── LEFT SIDEBAR (TREE NAVIGATION) ──────────────────── */}
        <aside
          className={cn(
            "fixed md:sticky top-[65px] left-0 h-[calc(100vh-65px)] w-64 bg-white md:bg-transparent z-30 md:z-auto p-4 md:p-0 overflow-y-auto scrollbar-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] border-r md:border-r-0 border-slate-200 flex-shrink-0 transition-transform duration-200",
            mobileMenuOpen ? "translate-x-0 shadow-2xl md:shadow-none" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="space-y-4 pb-16">
            {categories.map((category) => {
              const items = PUBLIC_DOC_ITEMS.filter((i) => i.category === category);
              const isCollapsed = collapsedCategories[category];

              return (
                <div key={category} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-slate-900 py-1 cursor-pointer"
                  >
                    <span>{category}</span>
                    <ChevronDown
                      size={14}
                      className={cn("text-slate-400 transition-transform duration-150", isCollapsed && "-rotate-90")}
                    />
                  </button>

                  {!isCollapsed && (
                    <ul className="space-y-0.5 border-l border-slate-200 ml-1 pl-2.5">
                      {items.map((item) => {
                        const isActive = activeSection === item.id;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => scrollToSection(item.id)}
                              className={cn(
                                "w-full text-left py-1 px-2 text-xs rounded-lg transition-colors cursor-pointer block truncate",
                                isActive
                                  ? "text-blue-700 bg-blue-50 font-bold"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                              )}
                            >
                              {item.title}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── CENTER DOCUMENTATION ARTICLE ────────────────────── */}
        <main className="flex-1 min-w-0 max-w-3xl space-y-10">
          {/* Main Title Section */}
          <div className="space-y-3 pb-6 border-b border-slate-200">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
              <BookOpen size={14} />
              <span>Panduan Resmi Penggunaan Platform CBT EXAMKU</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Pusat Dokumentasi CBT EXAMKU
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Panduan lengkap persiapan, operasional ujian mandiri, pengelolaan bank soal, instalasi aplikasi Exambro siswa, serta pengaturan server offline sekolah.
            </p>
          </div>

          {/* ── SECTION: RINGKASAN SISTEM ────────────────────────── */}
          <section id="ringkasan" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Ringkasan Sistem CBT</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong>EXAMKU</strong> adalah platform Computer Based Test (CBT) modern yang dirancang khusus untuk memenuhi kebutuhan evaluasi akademik sekolah di Indonesia (Sumatif Harian, PTS, PAS, PAT, hingga Asesmen Sekolah).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-1.5 text-blue-700">
                  <Monitor size={15} /> Mode Online Cloud
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Sekolah dapat langsung menyelenggarakan ujian melalui internet dengan domain atau subdomain resmi sekolah tanpa perlu menyediakan server fisik di sekolah.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-1.5 text-emerald-700">
                  <Server size={15} /> Mode Semi-Offline LAN
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Ujian dapat dijalankan 100% mandiri di lab komputer sekolah tanpa koneksi internet luar menggunakan server lokal berbasis PocketBase & SQLite.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: MULAI CEPAT ─────────────────────────────── */}
          <section id="mulai-cepat" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Panduan Mulai Cepat</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Alur praktis pelaksanaan ujian di sekolah dari tahap persiapan hingga pengumuman hasil:
            </p>
            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                  Registrasi Data Guru & Siswa
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Admin sekolah mengimpor data peserta didik (NISN, Nama, Kelas) dan akun guru melalui berkas Excel template yang telah disediakan.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
                  Pembuatan & Import Bank Soal
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Bapak/Ibu guru menyusun butir soal di Excel atau langsung di editor web, lengkap dengan opsi jawaban, pembahasan, dan rumus matematika jika diperlukan.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
                  Penjadwalan Ruang Ujian & Sesi
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Tentukan tanggal, jam mulai, durasi pengerjaan, opsi acak soal, serta token masuk ujian untuk masing-masing rombongan belajar.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">4</span>
                  Pelaksanaan & Monitoring Nilai
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Siswa mengerjakan ujian melalui aplikasi Exambro. Proktor mengawasi progres pengerjaan di dashboard dan langsung mencetak rekap nilai setelah ujian usai.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: PERAN PENGGUNA ──────────────────────────── */}
          <section id="peran-pengguna" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Hak Akses & Peran Pengguna</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Sistem membagi tugas berdasarkan 4 peran operasional:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-1.5 text-blue-700">
                  <Users size={14} /> Admin Sekolah
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Mengelola data induk (mata pelajaran, kelas, akun guru, akun siswa), pengaturan identitas sekolah, konfigurasi lisensi, dan pencadangan data.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-1.5 text-indigo-700">
                  <BookOpen size={14} /> Guru Mata Pelajaran
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Menyusun bank soal, mengoreksi butir esai siswa, serta melihat analisis butir soal dan statistik capaian siswa per kompetensi.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-1.5 text-amber-700">
                  <Monitor size={14} /> Proktor / Pengawas
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Membuka sesi ruang ujian, merilis token ujian, memantau kehadiran siswa, serta mereset login siswa yang mengalami kendala perangkat.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-1.5 text-emerald-700">
                  <Smartphone size={14} /> Peserta Ujian (Siswa)
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Login menggunakan NISN/username dan password, memasukkan token ujian, serta menyelesaikan soal dengan antarmuka yang ramah pengguna.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: ARSITEKTUR SERVER OFFLINE ─────────────── */}
          <section id="offline-arsitektur" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Arsitektur Server Mandiri CBT Offline</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Mode Offline EXAMKU dirancang untuk sekolah yang memiliki keterbatasan koneksi internet luar atau memilih menyelenggarakan ujian di jaringan intranet lab komputer sekolah secara mandiri.
            </p>

            {/* Kotak Perizinan & Persetujuan Wajib Pihak EXAMKU */}
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/90 text-xs text-amber-950 space-y-2.5 shadow-2xs leading-relaxed">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <span>Ketentuan Wajib: Perizinan, Persetujuan & Persyaratan Resmi EXAMKU</span>
              </div>
              <p>
                Penyelenggaraan ujian dengan <strong>Mode Offline (Server Mandiri CBT LAN)</strong> tidak dapat dilakukan secara sepihak. Sekolah <strong>WAJIB memiliki perizinan resmi, persetujuan tertulis (*approval*), dan memenuhi seluruh persyaratan administrasi serta teknis yang ditetapkan oleh pihak manajemen EXAMKU</strong>.
              </p>
              <ul className="list-disc list-inside space-y-1 text-amber-900 pl-1">
                <li><strong>Pengajuan & Verifikasi Institusi:</strong> Pihak sekolah (Kepala Sekolah / Penanggung Jawab CBT) wajib mengajukan permohonan lisensi offline resmi kepada pihak EXAMKU dengan melampirkan identitas institusi sekolah dan NPSN.</li>
                <li><strong>Penerbitan Serial Key Terotorisasi:</strong> Serial Key RSA-2048 resmi hanya akan diterbitkan setelah verifikasi perizinan dan persyaratan disetujui penuh oleh manajemen EXAMKU.</li>
                <li><strong>Kepatuhan Hak Cipta:</strong> Mengoperasikan server offline tanpa izin sah, menduplikasi, atau menyalahgunakan lisensi institusi merupakan pelanggaran terhadap hak cipta dan ketentuan layanan EXAMKU.</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Server size={15} className="text-blue-600" /> Engine & Database SQLite Mandiri
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Server berjalan menggunakan PocketBase binary mandiri di komputer proktor atau server lab sekolah. Seluruh konfigurasi, akun siswa, bank soal, dan jawaban tersimpan di database lokal <code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">pb_data/data.db</code>.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <HardDrive size={15} className="text-emerald-600" /> Media Gambar Lokal Terkompresi
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Pada mode offline, setiap gambar soal yang di-upload atau dipaste di editor soal dikonversi otomatis menjadi format WebP terkompresi dan disimpan langsung di database SQLite lokal tanpa memerlukan koneksi ke storage cloud luar.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-2 text-slate-700">
              <p className="font-bold text-slate-900">Topologi Jaringan Lab Ujian:</p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-600 pl-1 leading-relaxed">
                <li><strong>Komputer Server / Laptop Proktor:</strong> Menjalankan aplikasi server pada port default 8090. Komputer ini terhubung ke switch/hub lab atau router Wi-Fi lokal.</li>
                <li><strong>Perangkat Siswa (Klien):</strong> Komputer lab, laptop, atau smartphone Android siswa membuka alamat IP server proktor di jaringan lokal (contoh: <code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">http://192.168.1.100:8090</code>).</li>
                <li><strong>Isolasi Total:</strong> Kabel internet luar (WAN) pada router dapat dicabut. Sistem ujian tetap berjalan 100% lancar tanpa takut kendala kuota atau internet terputus.</li>
              </ul>
            </div>
          </section>

          {/* ── SECTION: SERIAL KEY & RSA-2048 ─────────────────── */}
          <section id="offline-serial-key" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Aktivasi Lisensi Serial Key RSA-2048</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Karena server offline tidak terhubung ke internet saat ujian, keabsahan lisensi sekolah divalidasi menggunakan tanda tangan digital asimetris berstandar kriptografi RSA-2048:
            </p>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-3 text-slate-700">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <KeyRound size={16} className="text-purple-600" />
                <span>Format Serial Key Resmi Sekolah</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Serial key offline memiliki format terstruktur yang dipisahkan oleh tanda titik:
              </p>
              <div className="p-3 bg-slate-950 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto select-all">
                EXAMKU-v2.&lt;base64_payload&gt;.&lt;rsa2048_signature&gt;
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li><strong>Header:</strong> Format resmi <code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">EXAMKU-v2</code> menandakan lisensi asimetris generasi kedua.</li>
                <li><strong>Payload:</strong> Berisi informasi resmi nama sekolah, NPSN, masa aktif (<code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">valid_until</code>), kuota siswa, dan paket layanan.</li>
                <li><strong>Tanda Tangan Digital:</strong> Enkripsi RSA-2048 SHA-256 yang menjamin serial key tidak dapat dipalsukan atau diubah masa berlakunya oleh pihak mana pun.</li>
              </ul>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <p className="font-bold text-slate-900 text-sm">Langkah Aktivasi di Server Sekolah:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1 leading-relaxed">
                <li>Buka aplikasi CBT di komputer server sekolah melalui browser.</li>
                <li>Masuk ke menu <strong>Pengaturan &rarr; Lisensi Server Offline</strong> (atau melalui halaman aktivasi awal).</li>
                <li>Salin serial key resmi yang diterima sekolah, lalu tempelkan (*paste*) ke kotak input serial key.</li>
                <li>Klik tombol <strong>"Aktifkan Lisensi"</strong>. Sistem seketika memverifikasi tanda tangan digital secara offline dan mengaktifkan masa berlaku server sekolah.</li>
              </ol>
            </div>
          </section>

          {/* ── SECTION: HARDWARE ID & ANTI-DUPLIKASI ─────────── */}
          <section id="offline-hardware-binding" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Hardware ID Binding & Kebijakan Anti-Duplikasi</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Untuk melindungi integritas lisensi sekolah dan mencegah penyalahgunaan duplikasi sistem ke sekolah lain, EXAMKU menerapkan protokol penguncian perangkat server (<em>Hardware ID Binding</em>).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Laptop size={15} className="text-indigo-600" /> Penguncian Otomatis Mesin Server
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Saat serial key pertama kali diaktivasi di server sekolah, sistem mengikat lisensi tersebut secara spesifik ke komputer/laptop server proktor sekolah terkait.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-rose-600" /> Proteksi Duplikasi
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Jika folder aplikasi disalin ke komputer atau laptop lain yang tidak terdaftar, sistem akan meminta aktivasi lisensi resmi yang sah untuk perangkat baru tersebut.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-950 space-y-2 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5 text-sm text-emerald-900">
                🛡️ Jaminan Integritas & Keamanan Database Lokal
              </p>
              <p>
                Sistem proteksi EXAMKU dirancang adil dan aman. Jika masa aktif lisensi berakhir atau terjadi kendala perangkat, <strong>berkas database lokal (<code className="font-mono bg-emerald-100 px-1 py-0.5 rounded text-emerald-900">pb_data/data.db</code>) tetap 100% utuh dan tidak pernah dihapus atau dirusak</strong>. Seluruh naskah soal bapak/ibu guru dan riwayat nilai siswa tetap aman tersimpan di komputer sekolah.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-purple-200 bg-white shadow-xs text-xs space-y-2 text-slate-700">
              <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <RotateCcw size={15} className="text-purple-600" /> Prosedur Pergantian Laptop Server Resmi
              </p>
              <p className="text-slate-600 leading-relaxed">
                Jika laptop server utama sekolah mengalami kerusakan fisik, baterai drop, atau sedang diservis sehingga proktor perlu memindahkan server ujian ke laptop pengganti:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li>Proktor menghubungi layanan dukungan bantuan resmi EXAMKU.</li>
                <li>Tim dukungan akan mereset kunci ikatan perangkat lama pada data lisensi sekolah Anda.</li>
                <li>Proktor dapat langsung menginput ulang serial key di laptop server baru tanpa perlu membeli lisensi tambahan.</li>
              </ol>
            </div>
          </section>

          {/* ── SECTION: PEMBARUAN 1-CLICK SERVER OFFLINE ─────── */}
          <section id="offline-update" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Pembaruan 1-Click Server Offline</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Server mandiri sekolah dapat diperbarui ke versi rilis terbaru dengan sangat mudah tanpa perlu instalasi ulang dan tanpa risiko kehilangan data ujian:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Download size={15} className="text-blue-600" /> Pembaruan via Menu Pengaturan Web
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Jika laptop proktor terhubung ke internet sebentar (misal via hotspot tethering HP), buka menu <strong>Pengaturan &rarr; Pembaruan 1-Click</strong>. Jika rilis baru tersedia, klik tombol <strong>"Pasang Pembaruan Sekarang"</strong>. Sistem mengunduh pembaruan dan memuat versi baru secara otomatis.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Terminal size={15} className="text-slate-700" /> Pembaruan via Berkas perbarui-server.bat
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Proktor cukup menjalankan berkas <code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">perbarui-server.bat</code> yang ada di folder utama server. Skrip secara otomatis membuat cadangan berkas lama ke folder backup sebelum memperbarui modul sistem.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: BANK SOAL & IMPORT EXCEL ─────────────── */}
          <section id="bank-soal" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Bank Soal & Import Excel</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              EXAMKU mendukung beragam tipe soal evaluasi modern sesuai format Asesmen Nasional (ANBK): Pilihan Ganda (PG), Pilihan Ganda Kompleks (PGK), Menjodohkan, Isian Singkat, dan Esai Uraian.
            </p>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <FileSpreadsheet size={15} className="text-emerald-600" /> Format Import Excel Praktis
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Buka menu <strong>Bank Soal</strong> di panel admin sekolah, lalu unduh Template Excel resmi. Kolom berisi: No, Jenis Soal, Pertanyaan, Opsi A, B, C, D, E, Kunci Jawaban, Pembahasan, dan Bobot Skor.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <BookOpen size={15} className="text-blue-600" /> Rumus Matematika KaTeX & Gambar Soal
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Soal eksakta (Matematika, Fisika, Kimia) mendukung penulisan rumus LaTeX standar seperti <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">{"$\\sqrt{x^2 + y^2}$"}</code>. Gambar dapat langsung di-upload atau dipaste ke dalam editor soal secara instan.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: RUANG UJIAN & SESI ─────────────────────── */}
          <section id="ruang-ujian" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Ruang Ujian, Sesi, & Token</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Fitur Ruang Ujian memudahkan sekolah mengatur jadwal dan sesi pelaksanaan tes secara tertib:
            </p>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-2 text-slate-700">
              <p className="font-bold text-slate-900">Fitur Keamanan Sesi Ujian:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li><strong>Acak Nomor Butir Soal:</strong> Urutan nomor soal diacak unik untuk setiap peserta ujian.</li>
                <li><strong>Acak Pilihan Opsi:</strong> Posisi jawaban pilihan ganda diacak sehingga siswa yang duduk berdampingan tidak bisa saling mencocokkan pilihan.</li>
                <li><strong>Token Masuk Dinamis:</strong> Token 6 karakter dapat diperbarui secara otomatis setiap periode tertentu (misal tiap 15 menit) atau dibuat statis sesuai arahan pengawas lab.</li>
                <li><strong>Batas Toleransi Keterlambatan:</strong> Proktor dapat menentukan batas menit toleransi bagi peserta yang terlambat masuk ruang ujian.</li>
              </ul>
            </div>
          </section>

          {/* ── SECTION: MONITORING & LIVE SCORE ───────────────── */}
          <section id="monitoring-ujian" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Monitoring Proktor & Live Score</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Pengawas dan proktor dapat memantau jalannya ujian secara realtime melalui panel pengawas:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-1.5 text-blue-700">
                  <Monitor size={14} /> Panel Proktor & Reset Sesi
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Jika siswa tidak sengaja menutup aplikasi atau berganti perangkat karena kendala baterai, proktor dapat mereset sesi login siswa dengan satu klik tanpa menghilangkan jawaban yang telah tersimpan.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-1.5 text-amber-600">
                  <Zap size={14} /> Live Score Layar Proyektor
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Tersedia tampilan papan peringkat live score untuk ditampilkan pada layar TV atau proyektor aula sekolah guna transparansi hasil seleksi atau tryout.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: PENILAIAN & ANALISIS BUTIR ─────────────── */}
          <section id="penilaian-analisis" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Penilaian & Analisis Butir Soal</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Setelah ujian selesai, sistem secara otomatis mengolah data hasil tes:
            </p>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-2 text-slate-700">
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li><strong>Koreksi Otomatis:</strong> Nilai pilihan ganda, PGK, dan menjodohkan langsung dihitung seketika siswa menekan tombol Selesai Ujian.</li>
                <li><strong>Koreksi Esai Manual:</strong> Antarmuka koreksi guru yang intuitif memudahkan penilaian butir soal uraian per siswa.</li>
                <li><strong>Analisis Butir Soal:</strong> Statistik otomatis yang menyajikan tingkat kesukaran soal (mudah, sedang, sukar) dan daya beda soal.</li>
                <li><strong>Ekspor Rekap Excel:</strong> Laporan nilai per rombel/kelas dapat langsung diunduh dalam format Excel siap cetak untuk pengisian e-Rapor sekolah.</li>
              </ul>
            </div>
          </section>

          {/* ── SECTION: EXAMBRO KEAMANAN ──────────────────────── */}
          <section id="exambro-keamanan" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Proteksi Kiosk Exambro Anti-Kecurangan</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Aplikasi mobile Exambro Android dirancang untuk mencegah siswa membuka aplikasi lain selama ujian berlangsung:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 shadow-xs space-y-1.5 text-slate-800">
                <p className="font-bold flex items-center gap-1.5 text-rose-800">
                  <Lock size={14} /> Penguncian Layar & Pinning
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Menonaktifkan tombol Home, Recent Apps, dan tombol navigasi perangkat. Siswa tidak dapat keluar dari aplikasi tanpa memasukkan password keluar pengawas.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs space-y-1.5 text-slate-800">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <Smartphone size={14} /> Blokir Floating Apps & Split Screen
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Mendeteksi dan memblokir aplikasi mengambang (floating calculator, overlay pop-up, atau asisten AI). Jika terjadi pelanggaran, ujian otomatis terkunci dengan alarm peringatan.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: RESILIENSI OFFLINE ────────────────────── */}
          <section id="resiliensi-offline" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Resiliensi Jawaban Siswa</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Jaringan Wi-Fi lab sekolah terkadang mengalami penurunan sinyal saat ratusan siswa mengakses secara serentak. EXAMKU dilengkapi perlindungan ketahanan data jawaban:
            </p>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-2 text-slate-700">
              <p className="font-bold text-slate-900">Mekanisme Penyimpanan Ganda (Dual-Storage):</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li>Setiap pilihan jawaban siswa langsung disimpan seketika di memori lokal perangkat (IndexedDB / LocalStorage).</li>
                <li>Secara simultan, jawaban disinkronkan ke server secara berkala di latar belakang.</li>
                <li>Jika sinyal Wi-Fi putus sejenak, siswa tetap dapat membaca soal dan memilih jawaban berikutnya tanpa muncul pesan error yang mengganggu.</li>
                <li>Begitu sinyal Wi-Fi tersambung kembali, seluruh jawaban yang belum terkirim otomatis tersinkronisasi ke server proktor.</li>
              </ul>
            </div>
          </section>

          {/* ── SECTION: UNDUH APLIKASI SISWA ──────────────────── */}
          <section id="unduh-aplikasi" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Unduh Aplikasi Ujian Siswa</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Peserta ujian dapat menggunakan perangkat smartphone Android atau laptop/komputer lab sekolah:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5 text-blue-800">
                  <Smartphone size={15} /> Aplikasi Android Exambro
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Aplikasi resmi berkas APK dengan proteksi keamanan penuh dan mode kiosk terpadu.
                </p>
                <a
                  href="/exam-aa-latest.apk"
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-xs"
                >
                  <Download size={13} />
                  <span>Unduh APK Exambro (.apk)</span>
                </a>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5 text-slate-800">
                  <Monitor size={15} /> Komputer Lab / Browser PC
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Untuk PC/Laptop lab sekolah, proktor dapat menggunakan Safe Exam Browser (SEB) atau browser modern (Chrome, Edge) dengan mode layar penuh (*Full Screen*).
                </p>
                <Link
                  to="/pilih-sekolah"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-900 transition-colors shadow-xs"
                >
                  <span>Buka Portal Web CBT</span>
                  <ChevronRight size={13} />
                </Link>
              </div>
            </div>
          </section>

          {/* ── SECTION: PAKET & LAYANAN ───────────────────────── */}
          <section id="paket-langganan" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Paket & Layanan Berlangganan</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              EXAMKU menyediakan pilihan paket fleksibel sesuai kapasitas jumlah siswa sekolah:
            </p>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <CreditCard size={15} className="text-blue-600" /> Pilihan Skema Layanan
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Sekolah dapat memilih paket per semester, tahunan, atau lisensi server offline mandiri dengan kuota siswa sesuai jenjang pendidikan (SD, SMP, SMA/SMK, hingga Perguruan Tinggi).
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Clock size={15} className="text-amber-600" /> Masa Aktif & Perpanjangan
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Pemberitahuan perpanjangan dikirimkan secara otomatis sebelum masa aktif berakhir sehingga sekolah dapat menyelenggarakan asesmen tanpa kendala jadwal.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: DIAGNOSTIK & TROUBLESHOOTING ─────────── */}
          <section id="troubleshoot" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Pusat Bantuan & Solusi Kendala Proktor (FAQ)</h2>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5 text-blue-700">
                  <HelpCircle size={15} /> 1. Siswa Terputus atau Ganti HP di Tengah Ujian
                </p>
                <p className="text-slate-600 leading-relaxed">
                  <strong>Solusi:</strong> Buka menu <strong>Monitoring Ujian</strong> di panel proktor, cari nama siswa terkait, lalu klik tombol <strong>"Reset Login"</strong>. Siswa dapat langsung login kembali di perangkat baru dan melanjutkan ujian tanpa kehilangan jawaban yang telah dipilih sebelumnya.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5 text-blue-700">
                  <HelpCircle size={15} /> 2. Pesan "Token Ujian Tidak Valid atau Kedaluwarsa"
                </p>
                <p className="text-slate-600 leading-relaxed">
                  <strong>Solusi:</strong> Pastikan siswa memasukkan token terbaru dari layar proktor. Jika menggunakan token dinamis, periksa sisa waktu token aktif di panel pengawas dan umumkan token terbaru kepada peserta.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5 text-blue-700">
                  <HelpCircle size={15} /> 3. Waktu Pengerjaan Siswa Tidak Cocok dengan Server
                </p>
                <p className="text-slate-600 leading-relaxed">
                  <strong>Solusi:</strong> Pastikan jam dan zona waktu (WIB/WITA/WIT) di komputer server proktor sudah tersetel dengan benar. Penghitungan sisa waktu ujian dihitung secara terpusat dari waktu server untuk menjaga keadilan seluruh peserta.
                </p>
              </div>
            </div>
          </section>

          {/* Footer Back to Home */}
          <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>&copy; {new Date().getFullYear()} EXAMKU CBT Platform. Hak Cipta Dilindungi.</p>
            <div className="flex items-center gap-4">
              <Link to="/" className="text-blue-600 hover:underline font-semibold">
                Beranda
              </Link>
              <Link to="/pilih-sekolah" className="text-blue-600 hover:underline font-semibold">
                Pilih Sekolah
              </Link>
            </div>
          </div>
        </main>
      </div>

      {/* ── SEARCH MODAL (CTRL+K) ─────────────────────────────── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-200 flex items-center gap-2">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Ketik topik panduan yang dicari..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filteredItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Tidak ada panduan yang cocok dengan kata kunci tersebut.
                </div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 flex items-center justify-between group transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {item.description}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                      {item.category}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicDocsPage;
