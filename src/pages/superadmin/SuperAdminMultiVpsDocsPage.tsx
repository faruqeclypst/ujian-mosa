import React, { useState, useEffect } from "react";
import {
  Search, ChevronDown, Copy, Check,
  Server, Cpu, Database, Globe,
  ShieldCheck, AlertCircle, CheckCircle2,
  ExternalLink, ArrowRight, Menu, X, ArrowUpRight,
  BookOpen, Users, FileSpreadsheet, Lock, Clock,
  CreditCard, Terminal, HelpCircle, HardDrive, Zap,
  Monitor, Smartphone, Layers, Activity, KeyRound, Laptop, RotateCcw, Download
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import { masterPb } from "../../lib/pocketbase";

interface DocItem {
  id: string;
  title: string;
  category: string;
  description: string;
  keywords: string[];
}

const DOC_ITEMS: DocItem[] = [
  // Mulai
  { id: "ringkasan", title: "Ringkasan Sistem", category: "Mulai", description: "Pengenalan arsitektur dan kapabilitas EXAMKU Multi-VPS.", keywords: ["arsitektur", "pengenalan", "ringkasan", "overview", "vps", "cbt"] },
  { id: "mulai-cepat", title: "Mulai Cepat", category: "Mulai", description: "Langkah pertama menyiapkan sekolah dan server dalam 5 menit.", keywords: ["mulai cepat", "quickstart", "panduan", "awal", "langkah"] },
  { id: "arsitektur", title: "Arsitektur 3 Lapisan", category: "Mulai", description: "Pemisahan Edge CDN, Master Ingress Gateway, dan Worker Nodes.", keywords: ["cloudflare", "caddy", "ingress", "edge", "cdn", "ssl", "cors", "layer"] },

  // Mode Offline & Lisensi
  { id: "offline-arsitektur", title: "Arsitektur Server Offline", category: "Mode Offline & Lisensi", description: "Operasional server lokal LAN sekolah tanpa koneksi internet luar.", keywords: ["offline", "server", "lan", "local", "pocketbase", "tanpa internet", "proktor", "lab", "mandiri", "sqlite"] },
  { id: "offline-serial-key", title: "Lisensi Serial Key RSA-2048", category: "Mode Offline & Lisensi", description: "Struktur kunci asimetris, validasi offline tanpa internet, dan aktivasi.", keywords: ["lisensi", "serial key", "rsa-2048", "asimetris", "tanda tangan", "aktivasi", "superadmin", "offline"] },
  { id: "offline-hardware-binding", title: "Hardware ID & Anti-Duplikasi", category: "Mode Offline & Lisensi", description: "Penguncian sidik jari laptop, proteksi duplikasi, jaminan database, dan reset mesin.", keywords: ["hardware id", "hwid", "anti-duplikasi", "sidik jari", "machineguid", "reset perangkat", "kill-switch", "duplikat"] },
  { id: "offline-update", title: "Pembaruan 1-Click Server", category: "Mode Offline & Lisensi", description: "Update berkas aplikasi dan modul tanpa mengubah database lokal data.db.", keywords: ["update", "1-click", "pembaruan", "offline update", "perbarui-server", "patch"] },

  // Infrastruktur & Node
  { id: "worker-setup", title: "Setup Worker Node", category: "Infrastruktur & Node", description: "Perintah satu baris otomatis dan pairing kunci SSH worker.", keywords: ["worker", "node", "setup", "install", "ssh", "authorized_keys", "onboarding"] },
  { id: "firewall", title: "Aturan Firewall & Port", category: "Infrastruktur & Node", description: "Konfigurasi rentang port 8091-8150 untuk IP Master VPS.", keywords: ["firewall", "security group", "port", "8091", "8150", "ufw", "tencent", "aws"] },
  { id: "alokasi-ram", title: "Alokasi RAM Dinamis", category: "Infrastruktur & Node", description: "Formula pembagian RAM proporsional dan script rambalancer.py.", keywords: ["ram", "memory", "balancer", "rambalancer", "memorymax", "memoryhigh", "quota"] },
  { id: "worker-performance", title: "Performa Worker Dinamis", category: "Infrastruktur & Node", description: "Efisiensi alokasi CPU dan RAM saat tenant idle vs aktif ujian.", keywords: ["cpu", "idle", "performa", "burst", "beban", "kapasitas", "golang"] },

  // Siklus Hidup Tenant
  { id: "tambah-tenant", title: "Tambah Sekolah Baru", category: "Siklus Tenant", description: "Pendaftaran tenant lokal di Master vs worker node.", keywords: ["tambah", "create", "daftar", "sekolah", "tenant", "baru", "slug"] },
  { id: "edit-tenant", title: "Edit Kuota & Custom Domain", category: "Siklus Tenant", description: "Penyesuaian paket siswa, domain sendiri, dan auto-sync data.", keywords: ["edit", "update", "custom domain", "kuota", "domain", "ssl", "cname"] },
  { id: "migrasi-burst", title: "Migrasi 1-Klik (Burst Mode)", category: "Siklus Tenant", description: "Alur memindahkan sekolah sebelum ujian dan menarik kembali data.", keywords: ["migrasi", "burst mode", "pindah", "tarik", "ujian", "pas", "pat", "sqlite"] },
  { id: "isolasi-worker", title: "Isolasi Worker Node", category: "Siklus Tenant", description: "Tenant baru langsung dibuat di worker VPS terpisah.", keywords: ["isolasi", "worker node", "tenant baru", "server_host", "daftar"] },
  { id: "snapshot-restore", title: "Snapshot & Restore Backup", category: "Siklus Tenant", description: "Backup harian otomatis worker ke master dan cara restore.", keywords: ["snapshot", "backup", "restore", "rsync", "sqlite", "recovery"] },
  { id: "infra-conf", title: "Konfigurasi Infrastruktur Terpusat", category: "Infrastruktur & Node", description: "Satu file infra.conf untuk semua IP — migrasi VPS jadi mudah.", keywords: ["infra.conf", "konfigurasi", "ip", "migrasi vps", "terpusat"] },
  { id: "hapus-tenant", title: "Hapus Sekolah Bersih", category: "Siklus Tenant", description: "Pembersihan Caddy dan penghapusan otomatis di worker via SSH.", keywords: ["hapus", "delete", "remove", "clean", "ssh", "systemd"] },

  // Manajemen CBT & Sekolah
  { id: "bank-soal", title: "Bank Soal & Import Excel", category: "Operasional CBT", description: "Format template soal, ragam tipe soal, dan penyisipan rumus matematika KaTeX.", keywords: ["soal", "bank soal", "excel", "import", "katex", "rumus", "opsi"] },
  { id: "ruang-ujian", title: "Ruang Ujian & Sesi", category: "Operasional CBT", description: "Pengaturan jadwal sesi, batas waktu, pengacakan soal, dan token.", keywords: ["ruang ujian", "sesi", "jadwal", "acak", "token", "durasi"] },
  { id: "monitoring-ujian", title: "Monitoring & Live Score", category: "Operasional CBT", description: "Pemantauan status pengerjaan siswa, reset login, dan papan skor langsung.", keywords: ["monitoring", "live score", "reset login", "proctor", "pengawas"] },
  { id: "penilaian-analisis", title: "Penilaian & Analisis Butir", category: "Operasional CBT", description: "Skoring otomatis, koreksi esai manual, tingkat kesukaran, dan ekspor Excel.", keywords: ["nilai", "penilaian", "analisis", "daya beda", "kesukaran", "ekspor"] },

  // Aplikasi Siswa & Exambro
  { id: "exambro-keamanan", title: "Exambro Anti-Kecurangan", category: "Aplikasi Siswa", description: "Protokol keamanan penguncian layar, deteksi split-screen, dan anti-screenshot.", keywords: ["exambro", "anti-curang", "kunci", "split screen", "floating", "android"] },
  { id: "resiliensi-offline", title: "Resiliensi Jawaban Offline", category: "Aplikasi Siswa", description: "Penyimpanan jawaban lokal di perangkat siswa untuk pencegahan koneksi terputus.", keywords: ["offline", "resiliensi", "localstorage", "auto-save", "putus koneksi"] },

  // Paket & Billing
  { id: "paket-langganan", title: "Paket & Sistem Billing", category: "Billing & Paket", description: "Struktur harga berbasis kuota siswa, faktur otomatis, dan integrasi Midtrans.", keywords: ["paket", "harga", "langganan", "invoice", "midtrans", "qris", "pembayaran"] },

  // Referensi & Skrip
  { id: "skrip-terminal", title: "Referensi Perintah & Skrip", category: "Referensi & CLI", description: "Dokumentasi script add-school, remove-school, dan pocketbase CLI.", keywords: ["skrip", "script", "cli", "command", "bash", "superuser", "upsert"] },
  { id: "pocketbase-api", title: "PocketBase REST API", category: "Referensi & CLI", description: "Format endpoint, otentikasi JWT admin/siswa, dan struktur koleksi data.", keywords: ["api", "rest", "endpoint", "jwt", "koleksi", "curl", "auth"] },

  // Troubleshooting
  { id: "troubleshoot", title: "Diagnostik & Troubleshooting", category: "Troubleshooting", description: "Solusi masalah MIME type, bentrok port 8099, dan redirect installer.", keywords: ["troubleshoot", "error", "mime", "blank", "installer", "timeout", "8099"] },
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
    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-sm my-3 text-left">
      {title && (
        <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
            <span>{title}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Terminal Bash</span>
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
          title="Salin perintah"
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

export const SuperAdminMultiVpsDocsPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("ringkasan");

  // Auth guard: hanya superadmin yang sudah login
  useEffect(() => {
    if (!masterPb.authStore.isValid) {
      navigate("/superadmin/login");
    }
  }, [navigate]);

  // Collapsible categories state
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    Mulai: false,
    "Infrastruktur & Node": false,
    "Siklus Tenant": false,
    "Operasional CBT": false,
    "Aplikasi Siswa": false,
    "Billing & Paket": false,
    "Referensi & CLI": false,
    Troubleshooting: false,
  });

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  // Keyboard shortcut Ctrl+K
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

  // Track active section on scroll
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

    DOC_ITEMS.forEach((item) => {
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

  const filteredItems = DOC_ITEMS.filter((item) => {
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
    "Mulai",
    "Infrastruktur & Node",
    "Siklus Tenant",
    "Operasional CBT",
    "Aplikasi Siswa",
    "Billing & Paket",
    "Referensi & CLI",
    "Troubleshooting",
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* ── TOP NAVBAR (SUPERADMIN SLATE & BLUE THEME) ─────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Buka menu navigasi"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <Link to="/superadmin/multi-vps-docs" className="flex items-center gap-2.5">
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
                Dokumentasi Multi-VPS
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
              <span className="text-slate-500 font-medium">Cari panduan & dokumentasi...</span>
            </div>
            <kbd className="font-mono text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-semibold shadow-2xs">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right CTA (Language selector + Dashboard Button) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="sm:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Cari dokumentasi"
          >
            <Search size={18} />
          </button>

          <Link
            to="/superadmin"
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <span>Dashboard</span>
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
              const items = DOC_ITEMS.filter((i) => i.category === category);
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
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-semibold">
              <ShieldCheck size={14} />
              <span>Dokumentasi Resmi EXAMKU</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Dokumentasi Sistem EXAMKU
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              EXAMKU adalah platform Computer Based Test (CBT) multi-tenant dan manajemen sekolah dengan arsitektur Multi-VPS terdistribusi. Dokumentasi ini menjelaskan cara mengelola sistem, menyiapkan server worker ujian, alokasi memori dinamis, migrasi 1-klik, dan referensi API.
            </p>
          </div>

          {/* Quick Index Section (mirip Kenari style dengan warna SuperAdmin) */}
          <div className="border-t border-b border-slate-200 py-6 space-y-6">
            {/* Index: Mulai */}
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900">Mulai</h2>
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li>
                  <button type="button" onClick={() => scrollToSection("mulai-cepat")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Mulai cepat:
                  </button>{" "}
                  buat sekolah, tetapkan kuota siswa, dan hubungkan server node.
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("ringkasan")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Ringkasan sistem:
                  </button>{" "}
                  konsep dasar, pemisahan Master dan Worker node, serta alur request.
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("arsitektur")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Arsitektur 3 lapisan:
                  </button>{" "}
                  integrasi Cloudflare CDN, Caddy Ingress Gateway, dan PocketBase engine.
                </li>
              </ul>
            </div>

            {/* Index: Infrastruktur & Node */}
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900">Infrastruktur & Node</h2>
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li>
                  <button type="button" onClick={() => scrollToSection("worker-setup")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Setup worker node:
                  </button>{" "}
                  perintah satu baris untuk menyiapkan VPS Ubuntu baru dalam 3 menit.
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("firewall")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Aturan firewall & port:
                  </button>{" "}
                  pembukaan port TCP 8091 sampai 8150 untuk IP Master VPS.
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("alokasi-ram")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Alokasi RAM dinamis:
                  </button>{" "}
                  formula rambalancer.py, batas MemoryMax, dan redistribusi sisa memori.
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("migrasi-burst")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Migrasi 1-klik (Burst Mode):
                  </button>{" "}
                  pola hemat sewa VPS worker hanya saat masa ujian sekolah (PAS/PAT).
                </li>
              </ul>
            </div>

            {/* Index: Operasional CBT */}
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900">Operasional CBT & Sekolah</h2>
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li>
                  <button type="button" onClick={() => scrollToSection("bank-soal")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Bank soal & import:
                  </button>{" "}
                  format template Excel, variasi pilihan ganda, esai, dan rumus KaTeX.
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("ruang-ujian")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Ruang ujian & sesi:
                  </button>{" "}
                  pengaturan jadwal sesi, batas waktu, pengacakan soal, dan token ujian.
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("monitoring-ujian")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Monitoring & live score:
                  </button>{" "}
                  pantau progress siswa realtime, reset sesi login, dan display nilai hidup.
                </li>
              </ul>
            </div>

            {/* Index: Mode Offline & Lisensi */}
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900">Mode Offline & Lisensi</h2>
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li>
                  <button type="button" onClick={() => scrollToSection("offline-arsitektur")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Arsitektur server offline:
                  </button>{" "}
                  lab lokal LAN, database SQLite mandiri, dan media lokal bebas Cloudflare.
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("offline-serial-key")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Serial key RSA-2048:
                  </button>{" "}
                  tanda tangan digital asimetris, validasi tanpa internet, dan aktivasi proktor.
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("offline-hardware-binding")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Hardware ID & anti-duplikasi:
                  </button>{" "}
                  auto-lock sidik jari laptop, proteksi duplikasi, database aman, dan reset mesin.
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("offline-update")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Pembaruan 1-Click:
                  </button>{" "}
                  update modul dan aset web tanpa mengubah atau menimpa database lokal.
                </li>
              </ul>
            </div>

            {/* Index: Referensi & Diagnostik */}
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900">Referensi & Diagnostik</h2>
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li>
                  <button type="button" onClick={() => scrollToSection("skrip-terminal")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Referensi skrip terminal:
                  </button>{" "}
                  perintah add-school, remove-school, migrate-tenant, dan PocketBase CLI.
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection("troubleshoot")} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold text-left cursor-pointer">
                    Diagnostik & troubleshooting:
                  </button>{" "}
                  penanganan error layar blank, MIME type, bentrok port 8099, dan installer.
                </li>
              </ul>
            </div>
          </div>

          {/* ── SECTION: MULAI CEPAT ─────────────────────────────── */}
          <section id="mulai-cepat" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Mulai Cepat</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Ikuti alur berikut untuk mengaktifkan institusi sekolah baru di platform:
            </p>
            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                  Buka Dashboard Superadmin
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Akses menu <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-900">/superadmin</code> dengan akun superadmin.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
                  Klik "+ Tambah Institusi"
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Isi nama sekolah (contoh: <em>SMAN 1 Banda Aceh</em>), subdomain (contoh: <em>sman1bna</em>), dan kuota siswa (contoh: <em>300</em>).
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
                  Pilih Node Lokasi Server
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Pilih <strong>Master VPS</strong> untuk sekolah reguler atau masukkan IP <strong>Worker Node</strong> jika ingin menjalankan sekolah di server terpisah. Sistem otomatis menyiapkan database PocketBase, port unik, dan proxy Caddy.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">4</span>
                  Akses Aplikasi Sekolah
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Sekolah langsung aktif di <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-blue-600">https://[subdomain].examku.my.id</code>. Admin sekolah login dengan email dan password default yang dibuat saat pendaftaran.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: RINGKASAN SISTEM ────────────────────────── */}
          <section id="ringkasan" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Ringkasan Sistem</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              EXAMKU dibangun untuk memecahkan dua tantangan terbesar pada aplikasi evaluasi sekolah: <strong>lonjakan beban serentak saat jam ujian</strong> dan <strong>efisiensi biaya operasional server</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Server size={14} className="text-blue-600" /> Master Control Plane
                </p>
                <p className="text-slate-600 leading-relaxed">
                  VPS Utama (64.235.41.108) bertindak sebagai gerbang terpusat: mengelola database master, billing, invoice Midtrans, sertifikat SSL wildcard, dan reverse proxy Caddy.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Cpu size={14} className="text-purple-600" /> Worker Compute Node
                </p>
                <p className="text-slate-600 leading-relaxed">
                  VPS Worker terpisah (contoh 43.134.175.87) khusus memproses transaksi ujian siswa. Node ini tidak menyimpan data pembayaran dan dapat disewa secara temporer sesuai jadwal ujian.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: ARSITEKTUR 3 LAPISAN ────────────────────── */}
          <section id="arsitektur" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Arsitektur Tiga Lapisan</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Arsitektur menggabungkan Cloudflare Edge CDN, Caddy Ingress Gateway, dan PocketBase engine:
            </p>

            <div className="rounded-xl border border-slate-200 bg-white p-4 font-mono text-xs text-slate-800 leading-relaxed overflow-x-auto shadow-xs">
              {`[ Siswa Buka: https://sekolah.examku.my.id/exam ]
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ 1. CLOUDFLARE EDGE CDN (Proxy Awan Oranye)             │
│ - Menyajikan bundle frontend (React JS, CSS, KaTeX)    │
│ - Menyimpan gambar bank soal di Cloudflare R2          │
│ - Bandwidth tanpa batas, 0ms latency untuk aset statis │
└──────────────────────┬─────────────────────────────────┘
                       │ (Hanya saat request API atau Admin DB)
                       ▼
┌────────────────────────────────────────────────────────┐
│ 2. MASTER VPS INGRESS GATEWAY (64.235.41.108)          │
│ - Web server Caddy memeriksa tujuan tenant sekolah     │
│ - Mengakhiri koneksi HTTPS (Central Wildcard SSL)      │
│ - Bebas CORS karena seluruh subdomain satu root domain │
└──────────────────────┬─────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
[server_host: 127.0.0.1]    [server_host: IP_WORKER]
Proxy ke localhost:PORT     Proxy ke http://IP_WORKER:PORT
(Tenant di Master VPS)      (Tenant di Worker VPS)`}
            </div>
          </section>

          {/* ── SECTION: SETUP WORKER NODE ───────────────────────── */}
          <section id="worker-setup" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Setup Worker Node</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Saat Anda menyewa VPS baru (Ubuntu 22.04 / 24.04), login via SSH sebagai root dan jalankan skrip otomatis berikut:
            </p>

            <CommandSnippet
              title="Perintah Onboarding Worker Node (Jalankan sebagai root)"
              code="curl -sSL https://raw.githubusercontent.com/faruqeclypst/ujian-mosa/feature/saas-v2/vps/setup_worker_node.sh | bash"
            />

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-2">
              <p className="font-bold text-slate-900">Operasi Otomatis yang Dikerjakan Skrip:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li>Memasang paket dependensi: curl, wget, unzip, ufw, rsync.</li>
                <li>Memasangkan kunci publik SSH Master VPS ke <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">/root/.ssh/authorized_keys</code>.</li>
                <li>Membuka port 8091 sampai 8150 untuk IP Master VPS pada firewall lokal.</li>
                <li>Memasang helper script <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">/usr/local/bin/add-school.sh</code> dan <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">/usr/local/bin/remove-school.sh</code>.</li>
                <li>Menyiapkan template database PocketBase v0.36.9 lengkap dengan 17 skema koleksi.</li>
              </ul>
            </div>
          </section>

          {/* ── SECTION: FIREWALL & PORT RANGE ───────────────────── */}
          <section id="firewall" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Aturan Firewall & Port</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Sebagian penyedia cloud (seperti Tencent Cloud Security Group, AWS Security Group, atau Alibaba Cloud) memiliki firewall di luar sistem operasi. Anda wajib mengizinkan koneksi dari Master VPS:
            </p>

            <div className="p-4 rounded-xl border border-amber-200/90 bg-amber-50/60 space-y-2 text-xs text-amber-950">
              <p className="font-bold flex items-center gap-1.5 text-sm text-amber-900">
                <AlertCircle size={15} /> Aturan Inbound Security Group:
              </p>
              <div className="bg-white border border-amber-200 rounded-lg p-3 font-mono space-y-1 text-slate-800 shadow-2xs">
                <p><strong>Protokol:</strong> TCP</p>
                <p><strong>Port:</strong> 8091 - 8150</p>
                <p><strong>Source IP:</strong> 64.235.41.108 (Master VPS)</p>
                <p><strong>Kebijakan:</strong> Allow / Izinkan</p>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Catatan: Port ini tidak perlu dibuka untuk publik umum (0.0.0.0/0). Cukup izinkan IP Master VPS agar seluruh request tetap aman melalui Caddy Ingress Gateway.
              </p>
            </div>
          </section>

          {/* ── SECTION: ALOKASI RAM DINAMIS ───────────────────── */}
          <section id="alokasi-ram" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Alokasi RAM Dinamis (Master VPS)</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Master VPS (16 GB RAM) menggunakan mekanisme isolasi proporsional melalui script <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">/usr/local/bin/rambalancer.py</code>:
            </p>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1">
                <p className="font-bold text-slate-900">1. Formula Bobot Kuota Siswa</p>
                <p className="text-slate-600 leading-relaxed">
                  Setiap sekolah mendapat jatah memori sesuai paket siswa yang diambil. Kuota 1.000 siswa mendapat ~3.2 GB, kuota 300 siswa mendapat ~1.3 GB, dan kuota 50 siswa mendapat batas minimum 512 MB.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1">
                <p className="font-bold text-slate-900">2. Proteksi Noisy Neighbor (MemoryMax)</p>
                <p className="text-slate-600 leading-relaxed">
                  Setiap tenant memiliki plafon batas keras (MemoryMax). Jika sebuah sekolah mengalami kebocoran memori atau query berat, sekolah tersebut tidak akan bisa menghabiskan 16 GB RAM server, sehingga sekolah lain tetap aman beroperasi normal.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1">
                <p className="font-bold text-slate-900">3. Soft Limit Tanpa Crash (MemoryHigh 85%)</p>
                <p className="text-slate-600 leading-relaxed">
                  Jika pemakaian RAM sebuah sekolah menyentuh 85%, sistem tidak mematikan aplikasi. Linux kernel hanya mereclaim memory cache secara halus.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1">
                <p className="font-bold text-slate-900">4. Penyerapan Sisa RAM Kosong</p>
                <p className="text-slate-600 leading-relaxed">
                  Jika ada tenant yang dihapus atau dipindahkan ke worker, sisa RAM kosong otomatis diserap kembali dan didistribusikan untuk memperbesar alokasi sekolah yang sedang aktif.
                </p>
              </div>
            </div>

            <CommandSnippet
              title="Perintah cek alokasi RAM per tenant di Master VPS:"
              code="/usr/local/bin/rambalancer.py --show"
            />
          </section>

          {/* ── SECTION: PERFORMA WORKER DINAMIS ───────────────── */}
          <section id="worker-performance" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Performa Worker Dinamis</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Pada VPS Worker (contoh spesifikasi 2 CPU dan 2 GB RAM):
            </p>
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-2 text-slate-700">
              <p className="font-bold text-slate-900">Bagaimana jika ada 2 tenant, tapi tenant 1 sedang idle?</p>
              <p className="text-slate-600 leading-relaxed">
                PocketBase (Go-lang) saat idle hanya memakan sekitar <strong>15 MB sampai 25 MB RAM</strong> dan <strong>0% CPU</strong>. Artinya, sisa <strong>1.675 MB RAM dan 100% daya 2 CPU</strong> otomatis dialirkan penuh untuk melayani Tenant 2 yang sedang aktif ujian.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Spesifikasi 2 CPU / 2 GB RAM teruji sangat stabil menampung hingga <strong>400 sampai 600 siswa ujian serentak</strong>.
              </p>
            </div>
          </section>

          {/* ── SECTION: TAMBAH TENANT ─────────────────────────── */}
          <section id="tambah-tenant" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Tambah Sekolah Baru</h2>
            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 pl-1 leading-relaxed">
              <li>Buka menu <strong>Dashboard</strong> di Superadmin (/superadmin).</li>
              <li>Klik tombol <strong>+ Tambah Institusi</strong>.</li>
              <li>Isi nama institusi, subdomain (slug), kuota siswa, dan pilih paket.</li>
              <li>
                Pada bagian <strong>Lokasi Server Node</strong>:
                <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-slate-600">
                  <li><strong>Master VPS:</strong> untuk sekolah reguler (starter / trial). Dijalankan lokal di port 8091+.</li>
                  <li><strong>Worker Node:</strong> masukkan IP publik worker (contoh 43.134.175.87). Master otomatis sync template master ke worker dan mengarahkan Caddy.</li>
                </ul>
              </li>
              <li>Klik <strong>Simpan</strong>. Tenant langsung aktif dan siap diakses.</li>
            </ol>
          </section>

          {/* ── SECTION: EDIT TENANT ───────────────────────────── */}
          <section id="edit-tenant" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Edit Kuota & Custom Domain</h2>
            <div className="space-y-2 text-xs text-slate-700">
              <p className="leading-relaxed">
                Di menu <strong>Edit Sekolah</strong>:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-600 pl-1 leading-relaxed">
                <li><strong>Ganti Kuota Siswa:</strong> Misal upgrade dari 250 ke 500 siswa. Hook update otomatis menghitung ulang alokasi RAM dan menerapkan MemoryMax baru tanpa downtime.</li>
                <li><strong>Pasang Custom Domain:</strong> Masukkan domain sekolah (contoh: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">cbt.sman1.sch.id</code>). Arahkan CNAME atau A record domain tersebut ke IP Master VPS (64.235.41.108). Caddy otomatis menerbitkan sertifikat SSL Let's Encrypt.</li>
                <li><strong>Subdomain (slug) Dikunci:</strong> Slug tidak dapat diubah setelah dibuat untuk menjaga integritas data dan tautan ujian siswa.</li>
              </ul>
            </div>
          </section>

          {/* ── SECTION: MIGRASI 1-KLIK (BURST MODE) ───────────── */}
          <section id="migrasi-burst" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Migrasi 1-Klik (Burst Mode Ujian)</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Sekolah umumnya hanya membutuhkan server besar selama 1 sampai 2 pekan ujian semester. Anda dapat menyewa VPS worker hanya selama bulan ujian, lalu menarik kembali datanya setelah ujian usai:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 shadow-xs space-y-2">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded">
                  Fase 1: Menjelang Ujian (Ke Worker)
                </span>
                <p className="font-bold text-slate-900">Pindah ke Worker VPS</p>
                <p className="text-slate-600 leading-relaxed">
                  Buka Superadmin, klik ikon <strong>Petir (⚡)</strong> pada sekolah. Masukkan IP Worker VPS baru, klik <strong>Tes Koneksi</strong>, lalu klik <strong>Mulai Migrasi</strong>. Database SQLite disinkronkan dan Caddy dialihkan ke worker tanpa merubah link login siswa.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs space-y-2">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded">
                  Fase 2: Ujian Selesai (Tarik ke Master)
                </span>
                <p className="font-bold text-slate-900">Tarik Kembali ke Master VPS</p>
                <p className="text-slate-600 leading-relaxed">
                  Setelah ujian selesai, klik ikon <strong>Petir (⚡)</strong> lagi. Opsi otomatis beralih ke <strong>Tarik ke Master VPS</strong>. Semua jawaban siswa dan riwayat skor ditarik 100% utuh kembali ke Master. Worker VPS kini aman dimatikan.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: ISOLASI WORKER NODE ─────────────────── */}
          <section id="isolasi-worker" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Isolasi Worker Node (Tenant Baru)</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Saat mendaftarkan <strong>sekolah baru</strong>, Anda bisa langsung menaruh databasenya di worker VPS terpisah (bukan di master). Cocok untuk sekolah besar yang butuh resource dedicated sejak awal.
            </p>
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 space-y-3 text-xs">
              <p className="font-bold text-slate-900">Cara pakai:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-700 leading-relaxed">
                <li>Siapkan VPS worker baru dengan perintah 1-baris (lihat section <a href="#worker-setup" className="text-blue-600 font-bold">Setup Worker Node</a>).</li>
                <li>Di form <strong>Daftarkan Tenant</strong>, aktifkan toggle <strong>Isolasi Worker Node</strong>.</li>
                <li>Masukkan IP worker baru (cth. <code className="font-mono bg-white px-1 py-0.5 rounded border">103.123.45.67</code>).</li>
                <li>Klik <strong>Daftarkan Tenant</strong> — database tenant otomatis dibuat di worker via SSH, Caddy di master otomatis reverse-proxy.</li>
              </ol>
              <p className="text-slate-600 leading-relaxed">
                <strong>Bedanya dengan Migrasi 1-Klik:</strong> Isolasi untuk tenant <em>baru</em> (mulai dari kosong). Migrasi 1-Klik untuk tenant <em>existing</em> yang databasenya sudah ada dan perlu dipindah.
              </p>
            </div>
          </section>

          {/* ── SECTION: SNAPSHOT & RESTORE ────────────────────── */}
          <section id="snapshot-restore" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Snapshot & Restore Backup Worker</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Setiap tenant di worker VPS otomatis di-backup harian ke master. Tidak perlu setting manual — script membaca daftar worker dari database.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
                <p className="font-bold text-slate-900">Backup Otomatis (Cron 02:00)</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed">
                  <li>Script: <code className="font-mono bg-white px-1 rounded border">examku-backup-workers.sh</code></li>
                  <li>Snapshot via <code className="font-mono bg-white px-1 rounded border">sqlite3 .backup</code> — tanpa hentikan layanan</li>
                  <li>Ditarik via rsync ke <code className="font-mono bg-white px-1 rounded border">/opt/pocketbase/worker-snapshots/&lt;slug&gt;/</code></li>
                  <li>Verifikasi <code className="font-mono bg-white px-1 rounded border">PRAGMA integrity_check</code></li>
                  <li>Retensi 7 hari (otomatis hapus yang lama)</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
                <p className="font-bold text-slate-900">Restore (Darurat)</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed">
                  <li>Via dashboard: modal Migrasi → pilih tanggal snapshot → Restore</li>
                  <li>Via terminal: <code className="font-mono bg-white px-1 rounded border">examku-restore-snapshot.sh &lt;slug&gt; [YYYY-MM-DD]</code></li>
                  <li>Data live otomatis dibackup (.bak) sebelum ditimpa</li>
                  <li>Mode <code className="font-mono bg-white px-1 rounded border">--force</code> untuk timpa paksa</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Skenario: worker mati mendadak → restore snapshot ke master (tenant jalan darurat di master) → setelah worker baru siap, pakai Migrasi 1-Klik untuk pindah lagi.
            </p>
          </section>

          {/* ── SECTION: INFRA.CONF ────────────────────────────── */}
          <section id="infra-conf" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Konfigurasi Infrastruktur Terpusat</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Semua IP server terpusat di <strong>satu file</strong>: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">vps/infra.conf</code>. Tidak ada lagi IP hardcoded yang tersebar di banyak script.
            </p>
            <CommandSnippet
              title="vps/infra.conf"
              code={'MASTER_IP="64.235.41.108"\nMASTER_USER="root"\nWORKER_IP="43.134.175.87"\nWORKER_USER="root"'}
            />
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-2">
              <p className="font-bold text-slate-900">Cara kerja:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li>Script Node.js (<code className="font-mono bg-slate-100 px-1 rounded">release-all.js</code>, <code className="font-mono bg-slate-100 px-1 rounded">deploy-apk.js</code>) baca via <code className="font-mono bg-slate-100 px-1 rounded">scripts/infra-config.js</code>.</li>
                <li>Script Bash di VPS baca <code className="font-mono bg-slate-100 px-1 rounded">/opt/pocketbase/infra.conf</code> (otomatis disync setiap <code className="font-mono bg-slate-100 px-1 rounded">release:all</code>).</li>
                <li><strong>Migrasi master ke VPS baru:</strong> edit 1 baris <code className="font-mono bg-slate-100 px-1 rounded">MASTER_IP</code> → <code className="font-mono bg-slate-100 px-1 rounded">git pull</code> → <code className="font-mono bg-slate-100 px-1 rounded">npm run release:all</code> → update DNS Cloudflare.</li>
              </ul>
            </div>
          </section>

          {/* ── SECTION: HAPUS TENANT ─────────────────────────── */}
          <section id="hapus-tenant" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Hapus Sekolah Bersih (Clean Deletion)</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Saat sekolah dihapus dari dashboard Superadmin:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 pl-1 leading-relaxed">
              <li>Record dihapus dari database Master PB.</li>
              <li>Hook <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">onRecordAfterDeleteSuccess</code> membaca slug dan IP server host sekolah.</li>
              <li>Konfigurasi Caddy reverse proxy di Master VPS dihapus dan Caddy direload.</li>
              <li>Service lokal Master dimatikan dan foldernya dibersihkan.</li>
              <li><strong>Jika sekolah berada di Worker Node:</strong> Master otomatis mengirim perintah SSH ke worker untuk mematikan systemd service dan menghapus folder <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">/opt/pocketbase/schools/slug</code> hingga tuntas.</li>
            </ol>
          </section>

          {/* ── SECTION: BANK SOAL & IMPORT EXCEL ─────────────── */}
          <section id="bank-soal" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Bank Soal & Import Excel</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              EXAMKU mendukung beragam tipe soal ujian: Pilihan Ganda (PG), Pilihan Ganda Kompleks (PGK), Menjodohkan, Benar/Salah, dan Esai Uraian.
            </p>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <FileSpreadsheet size={15} className="text-emerald-600" /> Format Import Excel
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Buka menu <strong>Bank Soal</strong> di panel admin sekolah, lalu unduh Template Excel. Kolom berisi: No, Jenis Soal, Pertanyaan, Opsi A, B, C, D, E, Kunci Jawaban, Pembahasan, dan Bobot Nilai.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <BookOpen size={15} className="text-blue-600" /> Rumus Matematika KaTeX & Gambar
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Soal eksakta mendukung format LaTeX/KaTeX standar seperti <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">{"$\\sqrt{x^2 + y^2}$"}</code>. Gambar dapat langsung di-upload atau dipaste ke dalam editor soal dan disimpan di storage Cloudflare R2 secara otomatis.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: RUANG UJIAN & SESI ─────────────────────── */}
          <section id="ruang-ujian" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Ruang Ujian & Sesi</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Fitur Ruang Ujian memungkinkan admin sekolah membagi siswa ke dalam sesi, kelas, atau ruang lab fisik yang berbeda.
            </p>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-2 text-slate-700">
              <p className="font-bold text-slate-900">Opsi Keamanan Sesi Ujian:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li><strong>Acak Nomor Soal:</strong> Urutan soal diacak unik untuk setiap siswa.</li>
                <li><strong>Acak Pilihan Opsi:</strong> Posisi jawaban A, B, C, D, E diacak untuk mempersulit kerja sama antar siswa.</li>
                <li><strong>Token Dinamis:</strong> Token 6 karakter otomatis diperbarui secara berkala (misal tiap 15 menit) atau dibuat statis sesuai kebutuhan pengawas.</li>
                <li><strong>Batas Keterlambatan:</strong> Siswa tidak diizinkan masuk jika terlambat melebihi toleransi waktu yang ditetapkan.</li>
              </ul>
            </div>
          </section>

          {/* ── SECTION: MONITORING & LIVE SCORE ───────────────── */}
          <section id="monitoring-ujian" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Monitoring & Live Score</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Pengawas dan proktor dapat memantau jalannya ujian secara realtime melalui panel pengawas:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Monitor size={14} className="text-blue-600" /> Proktor & Reset Sesi
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Jika siswa tidak sengaja menutup aplikasi atau berganti perangkat karena kendala baterai, proktor dapat mereset sesi login siswa dengan satu klik tanpa menghilangkan jawaban yang telah tersimpan.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-500" /> Live Score Proyektor
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Akses rute <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">/livescore-view</code> untuk menampilkan papan skor peringkat hidup siswa pada layar TV atau proyektor aula sekolah.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: PENILAIAN & ANALISIS BUTIR ─────────────── */}
          <section id="penilaian-analisis" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Penilaian & Analisis Butir Soal</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Setelah ujian selesai, sistem secara instan mengolah data hasil tes:
            </p>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-2 text-slate-700">
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li><strong>Koreksi Otomatis:</strong> Nilai pilihan ganda, PGK, dan menjodohkan langsung keluar seketika siswa menekan tombol Selesai.</li>
                <li><strong>Koreksi Esai Guru:</strong> Antarmuka koreksi manual memudahkan guru membaca jawaban esai siswa dan memasukkan skor per nomor.</li>
                <li><strong>Analisis Butir Soal:</strong> Perhitungan statistik otomatis meliputi tingkat kesukaran soal (mudah, sedang, sukar) dan daya pembeda butir soal.</li>
                <li><strong>Ekspor Excel & PDF:</strong> Laporan rekap nilai per kelas dapat diunduh dalam format Excel siap cetak untuk arsip rapor sekolah.</li>
              </ul>
            </div>
          </section>

          {/* ── SECTION: EXAMBRO KEAMANAN ──────────────────────── */}
          <section id="exambro-keamanan" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Exambro Anti-Kecurangan</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Aplikasi mobile Exambro Android dirancang untuk mencegah siswa membuka aplikasi lain selama ujian berlangsung:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 shadow-xs space-y-1.5 text-slate-800">
                <p className="font-bold flex items-center gap-1.5 text-rose-800">
                  <Lock size={14} /> Penguncian Layar & Pinning
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Menonaktifkan tombol Home, Recent Apps, dan Back. Siswa tidak dapat keluar dari aplikasi tanpa memasukkan password keluar pengawas.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs space-y-1.5 text-slate-800">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <Smartphone size={14} /> Deteksi Floating & Split Screen
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Mendeteksi aplikasi mengambang (seperti kalkulator floating, pesan WhatsApp pop-up, atau asisten AI). Jika terdeteksi, ujian otomatis terkunci.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: RESILIENSI OFFLINE ────────────────────── */}
          <section id="resiliensi-offline" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Resiliensi Jawaban Offline</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Jaringan Wi-Fi sekolah sering mengalami gangguan ketika ratusan siswa terhubung bersamaan. EXAMKU memiliki mekanisme ketahanan data:
            </p>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-2 text-slate-700">
              <p className="font-bold text-slate-900">Pola Penyimpanan Ganda (Local + Remote):</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li>Setiap pilihan jawaban siswa langsung disimpan seketika di <strong>IndexedDB / LocalStorage perangkat</strong>.</li>
                <li>Secara simultan, sinyal disimpan ke PocketBase server via background queue.</li>
                <li>Jika Wi-Fi putus sementara, siswa tetap bisa melanjutkan membaca soal dan memilih jawaban tanpa pop-up error.</li>
                <li>Saat sinyal Wi-Fi tersambung kembali, seluruh antrean jawaban otomatis tersinkronisasi ke server.</li>
              </ul>
            </div>
          </section>

          {/* ── SECTION: ARSITEKTUR SERVER OFFLINE ─────────────── */}
          <section id="offline-arsitektur" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Arsitektur Server Mandiri CBT Offline</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Mode Offline EXAMKU dirancang untuk sekolah yang memiliki keterbatasan koneksi internet luar atau memilih menyelenggarakan ujian di jaringan intranet lab komputer sekolah.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Server size={15} className="text-blue-600" /> PocketBase Engine & SQLite Mandiri
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Server berjalan menggunakan PocketBase binary mandiri di komputer proktor atau server lab. Seluruh konfigurasi, akun siswa, bank soal, dan hasil pengerjaan tersimpan di file database lokal <code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">pb_data/data.db</code>.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <HardDrive size={15} className="text-emerald-600" /> Penyimpanan Gambar Bebas Cloudflare
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Pada mode offline, setiap gambar soal yang di-upload atau di-paste di editor soal dikonversi otomatis menjadi format WebP terkompresi dan disimpan langsung di database SQLite lokal. Berkas media tidak diunggah ke Cloudflare R2 sehingga server beroperasi 100% mandiri tanpa kuota internet.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-2 text-slate-700">
              <p className="font-bold text-slate-900">Topologi Jaringan Lab Ujian:</p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-600 pl-1 leading-relaxed">
                <li><strong>Komputer Server / Laptop Proktor:</strong> Menjalankan <code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">pocketbase.exe</code> pada port default 8090. Komputer ini terhubung ke switch/hub lab atau router Wi-Fi lokal.</li>
                <li><strong>Perangkat Siswa (Klien):</strong> Komputer lab, laptop, atau smartphone Android siswa cukup membuka browser atau aplikasi Exambro dengan memasukkan alamat IP server proktor di jaringan lokal (contoh: <code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">http://192.168.1.100:8090</code>).</li>
                <li><strong>Isolasi Total:</strong> Kabel internet luar (WAN) pada router dapat dicabut. Sistem ujian tetap berjalan normal tanpa gangguan putus jaringan luar.</li>
              </ul>
            </div>
          </section>

          {/* ── SECTION: SERIAL KEY & RSA-2048 ─────────────────── */}
          <section id="offline-serial-key" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sistem Lisensi Serial Key & Kriptografi RSA-2048</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Karena server offline tidak dapat menghubungi server pusat setiap kali ada siswa yang login, keabsahan lisensi diverifikasi menggunakan tanda tangan digital asimetris berstandar RSA-2048:
            </p>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-3 text-slate-700">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <KeyRound size={16} className="text-purple-600" />
                <span>Format Serial Key Resmi</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Serial key offline memiliki format terstruktur yang dipisahkan oleh tanda titik:
              </p>
              <div className="p-3 bg-slate-950 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto select-all">
                EXAMKU-v2.&lt;base64_payload&gt;.&lt;rsa2048_signature&gt;
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li><strong>Header:</strong> <code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">EXAMKU-v2</code> menandakan skema kriptografi asimetris generasi kedua.</li>
                <li><strong>Payload:</strong> Data terenkode Base64 berisi nama sekolah, NPSN, batas masa aktif (<code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">valid_until</code>), kuota siswa, dan paket layanan.</li>
                <li><strong>Signature:</strong> Tanda tangan digital RSA-2048 SHA-256 yang ditandatangani menggunakan Private Key rahasia Super Admin di Master Cloud VPS.</li>
              </ul>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 leading-relaxed">
                💡 <strong>Kekuatan Kriptografi Asimetris:</strong> Server offline hanya menyimpan Public Key RSA. Tanggal kadaluarsa dan data sekolah yang tercantum di serial key tidak dapat dimanipulasi oleh pihak mana pun. Jika ada karakter serial key yang diubah, tanda tangan digital seketika tidak cocok dan server menolak beroperasi.
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <p className="font-bold text-slate-900 text-sm">Alur Penerbitan & Aktivasi Lisensi:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1 leading-relaxed">
                <li>Super Admin membuka panel <strong>Super Admin &rarr; Kelola Lisensi Offline</strong> di Master Cloud VPS (<code className="font-mono text-slate-800">https://examku.my.id</code>).</li>
                <li>Super Admin mengisi nama sekolah, NPSN, dan tanggal berlaku, lalu menekan tombol <strong>"Terbitkan Lisensi Baru"</strong>. Sistem menandatangani payload menggunakan Private Key RSA-2048.</li>
                <li>Super Admin menyalin Serial Key yang terbentuk dan mengirimkannya kepada pihak sekolah atau proktor.</li>
                <li>Proktor memasukkan Serial Key tersebut di layar aktivasi server lokal saat pertama kali membuka aplikasi di komputer sekolah.</li>
              </ol>
            </div>
          </section>

          {/* ── SECTION: HARDWARE ID & ANTI-DUPLIKASI ─────────── */}
          <section id="offline-hardware-binding" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Hardware ID Binding & Kebijakan Anti-Duplikasi</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Untuk mencegah pelanggaran lisensi berupa penyalinan folder aplikasi server ke flashdisk untuk digunakan di sekolah lain, EXAMKU menerapkan protokol penguncian sidik jari perangkat fisik (<em>Hardware ID Binding</em>).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Laptop size={15} className="text-indigo-600" /> Auto-Lock Sidik Jari Mesin Server
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Saat lisensi pertama kali diinput di server sekolah, backend otomatis membaca sidik jari hardware fisik komputer (Windows Cryptography MachineGuid, Motherboard, dan UUID sistem). Serial key tersebut langsung dikunci permanen hanya untuk komputer server tersebut (<code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">locked_device_id</code>).
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-rose-600" /> Deteksi Duplikasi (Device Mismatch)
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Jika folder aplikasi disalin ke komputer atau laptop lain, sistem mendeteksi ketidaksesuaian sidik jari hardware. Akses login siswa dan ujian otomatis terkunci dengan notifikasi "Aplikasi Terkunci: Duplikasi Perangkat".
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-950 space-y-2 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5 text-sm text-emerald-900">
                🛡️ Jaminan Integritas & Keamanan Database Lokal
              </p>
              <p>
                Sistem penguncian EXAMKU dirancang adil dan bertanggung jawab. Jika terjadi ketidaksesuaian perangkat atau penonaktifan lisensi, <strong>file database lokal (<code className="font-mono bg-emerald-100 px-1 py-0.5 rounded text-emerald-900">pb_data/data.db</code>) tetap 100% utuh dan tidak pernah dihapus atau dirusak</strong>. Seluruh naskah soal bapak/ibu guru dan riwayat nilai siswa tetap aman di komputer sekolah.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-purple-200 bg-white shadow-xs text-xs space-y-2 text-slate-700">
              <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <RotateCcw size={15} className="text-purple-600" /> Prosedur Pergantian Laptop Server Resmi
              </p>
              <p className="text-slate-600 leading-relaxed">
                Jika laptop server utama sekolah mengalami kerusakan teknis, hilang, atau sedang diservis di masa ujian sehingga sekolah perlu memindahkan server ujian ke laptop pengganti:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li>Proktor menghubungi Super Admin dan menginformasikan pergantian komputer server resmi sekolah.</li>
                <li>Super Admin membuka detail lisensi sekolah terkait di dashboard Master Cloud, lalu mengklik tombol <strong>"Reset Kunci Laptop"</strong>.</li>
                <li>Ikatan perangkat lama seketika dihapus dari catatan lisensi.</li>
                <li>Proktor dapat langsung menginput ulang serial key di laptop baru, dan sistem akan mengunci sidik jari perangkat laptop baru tersebut.</li>
              </ol>
            </div>
          </section>

          {/* ── SECTION: PEMBARUAN 1-CLICK SERVER OFFLINE ─────── */}
          <section id="offline-update" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Pembaruan 1-Click Server Offline</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Server mandiri sekolah dapat diperbarui ke versi rilis terbaru tanpa perlu instalasi ulang dan tanpa risiko kehilangan data ujian:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Download size={15} className="text-blue-600" /> Pembaruan via Menu Pengaturan Web
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Jika laptop proktor terhubung ke internet sebentar (misal via hotspot tethering), buka menu <strong>Pengaturan &rarr; Pembaruan 1-Click</strong>. Jika versi baru tersedia di CDN Examku, klik tombol <strong>"Pasang Pembaruan Sekarang"</strong>. Sistem mengunduh pembaruan dan merestart modul secara otomatis.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Terminal size={15} className="text-slate-700" /> Pembaruan via Berkas Batch Script
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Proktor dapat mengunduh berkas pembaruan mandiri atau menjalankan skrip <code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">perbarui-server.bat</code> di folder utama server. Skrip secara otomatis membuat cadangan berkas lama ke folder backup sebelum menimpa berkas web baru.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: PAKET & BILLING ───────────────────────── */}
          <section id="paket-langganan" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Paket & Sistem Billing</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Pengelolaan invoice dan pembayaran berbasis langganan bulanan atau tahunan:
            </p>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <CreditCard size={15} className="text-blue-600" /> Payment Gateway Midtrans (QRIS & VA)
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Faktur diterbitkan otomatis dari panel Superadmin. Sekolah dapat membayar langsung via QRIS (GoPay, OVO, Dana) atau Virtual Account bank (BCA, Mandiri, BNI, BRI). Status langganan otomatis aktif setelah konfirmasi webhook Midtrans diterima.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Clock size={15} className="text-amber-600" /> Kebijakan Grace Period & Suspend
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Setelah jatuh tempo, sekolah diberikan masa tenggang 3 hari. Jika lewat H+3 belum diselesaikan, rute siswa otomatis dialihkan ke halaman pemberitahuan penangguhan (<code className="font-mono text-slate-800">/suspended</code>), sementara panel admin sekolah tetap terbuka agar bendahara dapat melunasi tagihan.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION: REFERENSI PERINTAH & SKRIP ───────────── */}
          <section id="skrip-terminal" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Referensi Perintah & Skrip</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Daftar perintah operasional manual yang tersedia di server Master dan Worker:
            </p>

            <div className="space-y-3">
              <CommandSnippet
                title="1. Menambah sekolah manual via CLI (Master VPS):"
                code="/usr/local/bin/add-school.sh <slug> <port> [custom_domain] [quota] [server_host]"
              />

              <CommandSnippet
                title="2. Menghapus sekolah manual via CLI (Master VPS):"
                code="/usr/local/bin/remove-school.sh <slug> [server_host]"
              />

              <CommandSnippet
                title="3. Migrasi tenant manual via CLI:"
                code="/usr/local/bin/migrate-tenant.sh <slug> <target_host> <to_worker|to_master>"
              />

              <CommandSnippet
                title="4. Cek alokasi RAM per tenant di Master:"
                code="/usr/local/bin/rambalancer.py --show"
              />

              <CommandSnippet
                title="5. Reset password superuser PocketBase tenant:"
                code="/opt/pocketbase/schools/<slug>/pocketbase superuser upsert admin@gmail.com PasswordBaru123"
              />
            </div>
          </section>

          {/* ── SECTION: POCKETBASE REST API ───────────────────── */}
          <section id="pocketbase-api" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">PocketBase REST API</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Setiap tenant sekolah memiliki PocketBase engine mandiri dengan endpoint REST API standar:
            </p>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs text-xs space-y-3 text-slate-700">
              <div>
                <p className="font-bold text-slate-900 mb-1">Base URL Endpoint Sekolah:</p>
                <code className="font-mono bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded block font-semibold">
                  https://[subdomain].examku.my.id/api/
                </code>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-slate-900">Format Autentikasi Header:</p>
                <div className="bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono text-[11px]">
                  Authorization: Bearer &lt;user_or_admin_token&gt;
                </div>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-slate-900">Daftar Koleksi Utama Database Tenant:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] text-slate-800">
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">exams (bank soal)</div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">questions (butir soal)</div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">exam_rooms (ruang ujian)</div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">students (data siswa)</div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">exam_sessions (sesi aktif)</div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">student_answers (jawaban)</div>
                </div>
              </div>
            </div>
          </section>

          {/* ── SECTION: DIAGNOSTIK & TROUBLESHOOTING ─────────── */}
          <section id="troubleshoot" className="space-y-4 scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Diagnostik & Troubleshooting</h2>

            <div className="space-y-4 text-xs">
              {/* Masalah 1 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5 text-rose-700">
                  <AlertCircle size={15} /> 1. Layar Blank Putih atau Error MIME Type pada URL /_
                </p>
                <p className="text-slate-600 leading-relaxed">
                  <strong>Penyebab:</strong> URL diakses tanpa garis miring penutup, atau port yang dipakai PocketBase di worker sedang bentrok dengan aplikasi lain (seperti kasus TelemetryHub uvicorn di port 8099).
                </p>
                <p className="text-slate-600 leading-relaxed">
                  <strong>Solusi:</strong> Pastikan URL diakses lengkap dengan garis miring: <code className="font-mono text-blue-600">https://sekolah.examku.my.id/_/</code>. Jika tetap gagal, periksa apakah port dipakai proses lain dengan perintah:
                </p>
                <CommandSnippet code="ss -tulpn | grep 809" />
              </div>

              {/* Masalah 2 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5 text-amber-700">
                  <AlertCircle size={15} /> 2. Halaman Admin Mengarah ke ?installer#
                </p>
                <p className="text-slate-600 leading-relaxed">
                  <strong>Penyebab:</strong> Folder template di worker node kosong atau masih memakai PocketBase versi lama tanpa tabel skema ujian.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  <strong>Solusi:</strong> Jalankan sinkronisasi template master dari Master VPS ke Worker VPS:
                </p>
                <CommandSnippet code="rsync -az --delete /opt/pocketbase/schools/template/ root@IP_WORKER:/opt/pocketbase/schools/template/" />
              </div>

              {/* Masalah 3 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5 text-blue-700">
                  <AlertCircle size={15} /> 3. Status Node TIMEOUT pada Menu Infrastruktur
                </p>
                <p className="text-slate-600 leading-relaxed">
                  <strong>Penyebab:</strong> Port 8091-8150 belum dibuka di Security Group provider worker untuk IP Master VPS (64.235.41.108), atau service PocketBase sekolah sedang mati.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  <strong>Solusi:</strong> Periksa status service di worker node:
                </p>
                <CommandSnippet code="systemctl status pb-<slug>.service --no-pager" />
              </div>
            </div>
          </section>
        </main>

        {/* ── RIGHT SIDEBAR: ON THIS PAGE (DI HALAMAN INI) ────── */}
        <aside className="w-56 hidden lg:block sticky top-[80px] h-[calc(100vh-100px)] overflow-y-auto scrollbar-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex-shrink-0 text-xs text-slate-600">
          <p className="font-bold text-slate-900 mb-3 text-xs uppercase tracking-wider">
            Di halaman ini
          </p>
          <ul className="space-y-1.5 border-l border-slate-200 pl-3">
            {DOC_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className={cn(
                      "text-left block transition-colors cursor-pointer truncate w-full py-0.5",
                      isActive
                        ? "text-blue-600 font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {item.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      {/* ── SEARCH MODAL (CTRL + K) ───────────────────────────── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-start justify-center pt-20 px-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="p-3.5 border-b border-slate-100 flex items-center gap-2">
              <Search size={16} className="text-slate-400 ml-1" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari dokumentasi (misal: ram, ssh, port, bank soal, exambro, caddy)..."
                className="w-full text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
              <kbd
                onClick={() => setSearchOpen(false)}
                className="font-mono text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 cursor-pointer"
              >
                ESC
              </kbd>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100 scrollbar-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {filteredItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Tidak ditemukan hasil untuk "{searchQuery}"
                </div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className="w-full text-left p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer flex flex-col gap-0.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{item.description}</p>
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

export default SuperAdminMultiVpsDocsPage;
