import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  BookOpen,
  ClipboardList,
  LayoutTemplate,
  Settings,
  ShieldAlert,
  Users,
  User,
  GraduationCap,
  Award,
  AlertCircle,
  Download,
  Monitor,
  Key,
  Home,
  Globe,
  Database,
  Cpu,
  MessageCircle,
  ChevronRight,
  ChevronLeft,
  X,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Bot,
  CheckCircle2,
  Zap,
  FileJson,
  Lightbulb,
  FileBox,
  HelpCircle,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  PieChart,
  Info,
  Terminal,
  Laptop,
  FileCheck,
  Layers,
  BarChart2,
  Target,
  TrendingUp,
  Percent,
  Printer,
  Copy,
  Check,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";

import { useTenant } from "../../context/TenantContext";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { ExambroGuideModal } from "../../components/dialogs/ExambroGuideModal";

// --- Neon Documentation Components ---

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = "bash", title }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#0c0d0e] text-neutral-200 overflow-hidden shadow-2xs font-mono text-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#141518] border-b border-neutral-800 text-[11px] text-neutral-400 select-none">
        <span className="font-mono text-neutral-300">{title || language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-neutral-200 transition-colors cursor-pointer text-[10px]"
          title="Salin kode"
        >
          {copied ? (
            <>
              <Check size={11} className="text-emerald-400" />
              <span className="text-emerald-400">Tersalin</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto leading-relaxed text-neutral-300">
        <pre className="m-0 font-mono whitespace-pre-wrap">{code}</pre>
      </div>
    </div>
  );
};

interface CalloutProps {
  type?: "note" | "tip" | "warning" | "danger";
  title?: string;
  children: React.ReactNode;
}

const Callout: React.FC<CalloutProps> = ({ type = "note", title, children }) => {
  const config = {
    note: {
      border: "border-l-emerald-500",
      bg: "bg-emerald-50/40 dark:bg-emerald-950/20",
      text: "text-emerald-950 dark:text-emerald-200",
      icon: <Info size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
      label: title || "Catatan",
    },
    tip: {
      border: "border-l-sky-500",
      bg: "bg-sky-50/40 dark:bg-sky-950/20",
      text: "text-sky-950 dark:text-sky-200",
      icon: <Sparkles size={14} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />,
      label: title || "Tips Proktor",
    },
    warning: {
      border: "border-l-amber-500",
      bg: "bg-amber-50/40 dark:bg-amber-950/20",
      text: "text-amber-950 dark:text-amber-200",
      icon: <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
      label: title || "Peringatan",
    },
    danger: {
      border: "border-l-red-500",
      bg: "bg-red-50/40 dark:bg-red-950/20",
      text: "text-red-950 dark:text-red-200",
      icon: <ShieldAlert size={14} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />,
      label: title || "Penting / Kritis",
    },
  }[type];

  return (
    <div className={cn(
      "my-4 p-3.5 rounded-r-lg border-l-2 text-xs leading-relaxed border-y border-r border-neutral-200/40 dark:border-neutral-800/60 flex items-start gap-2.5",
      config.border,
      config.bg,
      config.text
    )}>
      {config.icon}
      <div className="flex-1 min-w-0">
        <h5 className="font-semibold text-xs uppercase tracking-wider mb-1 font-mono">{config.label}</h5>
        <div className="opacity-95 space-y-1">{children}</div>
      </div>
    </div>
  );
};

interface DocsTableProps {
  headers: string[];
  rows: (React.ReactNode | string)[][];
  columnWidths?: string[];
}

const DocsTable: React.FC<DocsTableProps> = ({ headers, rows, columnWidths }) => (
  <div className="my-4 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-[#0e0f11]">
    {/* Desktop/Tablet view: table-fixed with break-words so it fits 100% without horizontal scroll */}
    <div className="hidden sm:block w-full">
      <table className="w-full text-left text-xs table-fixed">
        <thead className="bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 font-mono uppercase text-[10px] text-neutral-500 dark:text-neutral-400 select-none">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={cn(
                  "px-3.5 py-2.5 font-semibold break-words",
                  columnWidths ? columnWidths[i] : ""
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
          {rows.map((row, idx) => (
            <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20 transition-colors">
              {row.map((cell, cidx) => (
                <td key={cidx} className="px-3.5 py-2.5 align-top leading-relaxed break-words">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Mobile view: Stacked responsive definition card list with ZERO horizontal scroll */}
    <div className="sm:hidden divide-y divide-neutral-200 dark:divide-neutral-800">
      {rows.map((row, idx) => (
        <div key={idx} className="p-3 space-y-2 text-xs">
          {row.map((cell, cidx) => (
            <div key={cidx} className="space-y-0.5">
              <span className="font-mono text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 block">
                {headers[cidx]}
              </span>
              <div className="text-neutral-800 dark:text-neutral-200 break-words leading-relaxed">
                {cell}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono text-neutral-600 dark:text-neutral-400 shadow-2xs select-none">
    {children}
  </kbd>
);

// --- Documentation Topic Definition ---

interface DocSubSection {
  id: string;
  title: string;
}

interface DocTopic {
  id: string;
  category: string;
  title: string;
  lead: string;
  icon: any;
  sections: DocSubSection[];
  keywords: string;
  readTime: string;
}

const DOC_TOPICS: DocTopic[] = [
  {
    id: "overview",
    category: "PENGENALAN & IKHTISAR",
    title: "Overview Platform & Arsitektur",
    lead: "EXAMKU adalah ekosistem evaluasi digital terpadu (End-to-End) yang mengotomatisasi siklus ujian: pendaftaran peserta, pembuatan bank soal, pengawasan anti-contek, hingga psikometri analisis butir soal.",
    icon: Home,
    sections: [
      { id: "arsitektur", title: "Arsitektur Single Page Application" },
      { id: "keunggulan", title: "4 Pilar Keunggulan Platform" },
      { id: "tujuan", title: "Tujuan & Filosofi Sistem" },
    ],
    keywords: "pengenalan cbt spa single page application multi-tenant arsitektur",
    readTime: "3 mnt",
  },
  {
    id: "akun",
    category: "PENGENALAN & IKHTISAR",
    title: "Manajemen Akun & Hak Akses",
    lead: "Tata kelola pengguna institusi meliputi Administrator sekolah, Guru penguji dengan dua level wewenang, dan ribuan peserta didik dengan kredensial terproteksi.",
    icon: User,
    sections: [
      { id: "profil-keamanan", title: "Profil Pengguna & Keamanan Sandi" },
      { id: "hak-akses-guru", title: "Wewenang Akun Guru (Standar vs Full Access)" },
      { id: "peserta-didik", title: "Identitas Login Siswa (NISN Unik)" },
    ],
    keywords: "password ganti profil guru hak akses permission siswa",
    readTime: "4 mnt",
  },
  {
    id: "data-master",
    category: "DATA & BANK SOAL",
    title: "Data Master & Impor Massal Siswa",
    lead: "Konfigurasi dasar sekolah yang menjadi fondasi seluruh data akademik: rombongan belajar (kelas), mata pelajaran, daftar guru, dan impor massal data ribuan siswa via Excel.",
    icon: Database,
    sections: [
      { id: "rombel-mapel", title: "Mata Pelajaran & Rombongan Belajar (Kelas)" },
      { id: "data-siswa", title: "Data Siswa & Nomor Induk Siswa Nasional (NISN)" },
      { id: "bulk-import-excel", title: "SOP Smart Bulk Import Excel (.xlsx)" },
      { id: "aturan-kolom", title: "Aturan Tipe Data & Format Teks Excel" },
    ],
    keywords: "siswa guru kelas excel nisn mapel rombel bulk import template",
    readTime: "5 mnt",
  },
  {
    id: "bank-soal",
    category: "DATA & BANK SOAL",
    title: "Pengelolaan Bank Soal & Formula LaTeX",
    lead: "Sistem pembuatan naskah ujian komprehensif mendukung 12 jenis butir soal, wacana literasi berdampingan, formula matematika LaTeX/KaTeX, serta impor dari Microsoft Word (.docx).",
    icon: BookOpen,
    sections: [
      { id: "konfigurasi-paket", title: "Konfigurasi & Duplikasi Paket Soal" },
      { id: "rich-text-literasi", title: "Rich Text Editor & Mode Wacana Literasi" },
      { id: "metode-impor", title: "4 Metode Impor (Excel, Word, JSON, AI)" },
      { id: "katalog-tipe-soal", title: "Katalog 12 Tipe Butir Soal" },
      { id: "sintaks-latex", title: "Spesifikasi Rumus LaTeX & KaTeX" },
      { id: "trigonometri-kalkulus", title: "Fungsi Trigonometri & Kalkulus Lengkap" },
      { id: "mesin-autofix", title: "Mesin Auto-Fix Parser Backslash" },
    ],
    keywords: "tipe soal pg kompleks literasi latex katex rumus matematika trigonometri kalkulus docx word",
    readTime: "8 mnt",
  },
  {
    id: "ai-magic",
    category: "DATA & BANK SOAL",
    title: "Kecerdasan Buatan & Ekstraksi Naskah",
    lead: "Integrasi mutakhir Large Language Models (LLM) untuk mengotomatisasi pembuatan bank soal berbasis kurikulum dan mendeteksi naskah mentah dari dokumen materi apapun.",
    icon: Bot,
    sections: [
      { id: "magic-generator", title: "Magic AI Generator (Topic-to-Quiz HOTS)" },
      { id: "smart-detect", title: "Ekstraksi Materi & Naskah Soal Mentah" },
      { id: "json-direct", title: "Format Transfer JSON Instan (Tanpa AI)" },
    ],
    keywords: "magic ai json extraction generator llm import groq gemini openrouter ollama hots",
    readTime: "4 mnt",
  },
  {
    id: "ruang-ujian",
    category: "OPERASIONAL UJIAN (CBT)",
    title: "Siklus Ruang Ujian & Manajemen Sesi",
    lead: "Konfigurasi operasional pelaksanaan ujian digital: jadwal jendela akses, alokasi durasi waktu pengerjaan, rotasi token keamanan dinamis, dan algoritma pengacakan soal.",
    icon: ClipboardList,
    sections: [
      { id: "waktu-jendela", title: "Jendela Waktu Mulai & Berakhir" },
      { id: "durasi-timer", title: "Alokasi Durasi & Timer Hitung Mundur" },
      { id: "universal-token", title: "Universal Security Token & Rotasi Dinamis" },
      { id: "algoritma-acak", title: "Pengacakan Urutan Soal & Pilihan Opsi" },
    ],
    keywords: "sesi token durasi waktu acak soal opsi jendela akses",
    readTime: "4 mnt",
  },
  {
    id: "monitoring",
    category: "OPERASIONAL UJIAN (CBT)",
    title: "Anti-Cheat & Pengawasan Kiosk Live",
    lead: "Arsitektur proteksi keamanan terpadu mendeteksi focus loss, penguncian layar otomatis setelah batas toleransi, dan integrasi Safe Exam Browser (SEB) serta Exambro Android.",
    icon: Monitor,
    sections: [
      { id: "deteksi-focus-loss", title: "Deteksi Focus Loss & Perpindahan Tab" },
      { id: "kebijakan-auto-lock", title: "Kebijakan Penguncian Otomatis (Lock Ujian)" },
      { id: "dasbor-pengawasan", title: "Dasbor Pengawasan Real-Time Proktor" },
      { id: "matriks-platform", title: "Dukungan 4 Platform Klien (APK, SEB, Browser)" },
    ],
    keywords: "lock gembok pelanggaran monitor apk seb kiosk sirine android ios windows browser",
    readTime: "6 mnt",
  },
  {
    id: "nilai",
    category: "EVALUASI & NILAI",
    title: "Psikometri CTT & Analisis Butir Soal",
    lead: "Modul analitik asesmen tingkat lanjut mengintegrasikan Teori Tes Klasik (CTT) dengan paradigma Pembelajaran Mendalam (Deep Learning) Kurikulum Merdeka Kemendikdasmen RI.",
    icon: PieChart,
    sections: [
      { id: "ctt-paradigma", title: "Teori Tes Klasik & Paradigma Pembelajaran Mendalam" },
      { id: "tingkat-kesukaran", title: "Tingkat Kesukaran (Index P = B/N)" },
      { id: "daya-pembeda", title: "Daya Pembeda (Index D Metode 27% Kelley)" },
      { id: "analisis-distraktor", title: "Evaluasi Efektivitas Pengecoh (Distractor Analysis)" },
      { id: "diferensiasi-ajar", title: "Refleksi Diferensiasi (Teaching at the Right Level)" },
      { id: "ekspor-multisheet", title: "Ekspor Multi-Sheet Excel .xlsx Berformat" },
    ],
    keywords: "rekap excel nilai statistik analisis butir soal daya pembeda tingkat kesukaran pengecoh kurikulum merdeka deep learning kemendikdasmen psikometri ctt",
    readTime: "7 mnt",
  },
  {
    id: "pengaturan",
    category: "SISTEM & REFERENSI",
    title: "Konfigurasi Sistem & Cadangan Database",
    lead: "Pusat kendali administrator: penyesuaian identitas branding sekolah, penegakan aplikasi Exambro wajib, ekspor/impor cadangan database JSON, dan konfigurasi API AI.",
    icon: Settings,
    sections: [
      { id: "branding-sekolah", title: "Identitas Branding & Logo Institusi" },
      { id: "kiosk-enforcement", title: "Penegakan Wajib Exambro (Kiosk Enforcement)" },
      { id: "cadangan-json", title: "Manajemen Cadangan Database JSON (Ekspor/Impor)" },
      { id: "prosedur-format", title: "SOP Format Sistem & Reset Tahun Ajaran" },
      { id: "konektor-ai", title: "Konfigurasi Provider Mesin Kecerdasan Buatan" },
    ],
    keywords: "logo branding exambro reset format backup json api engine groq gemini",
    readTime: "5 mnt",
  },
  {
    id: "spesifikasi",
    category: "SISTEM & REFERENSI",
    title: "Spesifikasi Teknis & Tim Pengembang",
    lead: "Rincian spesifikasi teknologi platform EXAMKU, profil master developer, saluran layanan bantuan proktor, serta ketentuan hak cipta dan lisensi perangkat lunak.",
    icon: Terminal,
    sections: [
      { id: "arsitektur-teknologi", title: "Spesifikasi Teknologi & Infrastruktur Server" },
      { id: "profil-pengembang", title: "Profil Master Developer (Alfaruq Asri, S.Pd., Gr.)" },
      { id: "saluran-bantuan", title: "Saluran WhatsApp Bantuan Teknis IT Support" },
      { id: "legalitas-lisensi", title: "Ketentuan Hak Cipta & Dokumen Internal Institusi" },
    ],
    keywords: "alfaruq asri developer wa whatsapp support portofolio sqlite pocketbase react",
    readTime: "3 mnt",
  },
];

const GuidePage: React.FC = () => {
  const { school, terminology } = useTenant();
  const [activeTopicId, setActiveTopicId] = useState<string>(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const found = DOC_TOPICS.find((t) => t.id === hash);
    return found ? found.id : "overview";
  });

  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const [isExambroGuideOpen, setIsExambroGuideOpen] = useState(false);

  // Group topics by category
  const categories = useMemo(() => {
    const map = new Map<string, DocTopic[]>();
    DOC_TOPICS.forEach((t) => {
      const list = map.get(t.category) || [];
      list.push(t);
      map.set(t.category, list);
    });
    return Array.from(map.entries()).map(([name, topics]) => ({ name, topics }));
  }, []);

  // Current active topic object
  const currentTopic = useMemo(() => {
    return DOC_TOPICS.find((t) => t.id === activeTopicId) || DOC_TOPICS[0];
  }, [activeTopicId]);

  // Current topic index & next/previous navigation
  const currentIndex = DOC_TOPICS.findIndex((t) => t.id === currentTopic.id);
  const prevTopic = currentIndex > 0 ? DOC_TOPICS[currentIndex - 1] : null;
  const nextTopic = currentIndex < DOC_TOPICS.length - 1 ? DOC_TOPICS[currentIndex + 1] : null;

  // Search filter
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: Array<{ topic: DocTopic; section?: DocSubSection; matchText: string }> = [];

    DOC_TOPICS.forEach((topic) => {
      if (topic.title.toLowerCase().includes(q) || topic.keywords.toLowerCase().includes(q)) {
        results.push({ topic, matchText: topic.title });
      }
      topic.sections.forEach((sec) => {
        if (sec.title.toLowerCase().includes(q)) {
          results.push({ topic, section: sec, matchText: `${topic.title} › ${sec.title}` });
        }
      });
    });
    return results.slice(0, 10);
  }, [searchQuery]);

  // Handle Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close search results on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(e.target as Node) &&
        !searchInputRef.current?.contains(e.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update hash when topic changes
  const selectTopic = (topicId: string, sectionId?: string) => {
    setActiveTopicId(topicId);
    setShowSearchResults(false);
    setSearchQuery("");

    window.history.replaceState(null, "", `#${topicId}${sectionId ? `-${sectionId}` : ""}`);

    if (sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Scroll spy on active section headings
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id);
          }
        });
      },
      { rootMargin: "-10% 0px -75% 0px" }
    );

    currentTopic.sections.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [currentTopic]);

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSectionId(sectionId);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfb] dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 font-sans">

      {/* ── Top Header Toolbar (Neon Docs Style) ── */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0c0d0e]/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 px-4 sm:px-6 py-2.5">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold shrink-0">
              Dokumentasi Resmi
            </span>
            <span className="text-neutral-300 dark:text-neutral-700 select-none">•</span>
            <span className="text-xs font-mono text-neutral-500 truncate hidden sm:inline">
              {school?.name || "EXAMKU Platform"}
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-1 max-w-md justify-end">
            {/* Search Input Box */}
            <div className="relative w-full max-w-sm">
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-100 dark:bg-neutral-850/80 rounded-md border border-neutral-200 dark:border-neutral-750 transition-colors focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/10">
                <Search size={13} className="text-neutral-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  placeholder="Cari dokumentasi (Ctrl+K)..."
                  className="bg-transparent border-0 outline-none text-xs text-neutral-900 dark:text-neutral-100 w-full placeholder:text-neutral-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setShowSearchResults(false);
                    }}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-0.5"
                  >
                    <X size={12} />
                  </button>
                )}
                <span className="hidden md:inline-flex items-center gap-0.5 shrink-0">
                  <Kbd>Ctrl</Kbd>
                  <Kbd>K</Kbd>
                </span>
              </div>

              {/* Floating Dropdown Results */}
              {showSearchResults && searchQuery.trim().length > 0 && (
                <div
                  ref={searchResultsRef}
                  className="absolute top-full mt-1.5 right-0 w-full sm:w-[380px] bg-white dark:bg-[#121316] border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl z-50 overflow-hidden"
                >
                  <div className="px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 text-[10px] font-mono uppercase tracking-wider text-neutral-400 flex justify-between items-center">
                    <span>Hasil Pencarian ({searchResults.length})</span>
                    <button onClick={() => setShowSearchResults(false)} className="hover:text-neutral-600">
                      <X size={12} />
                    </button>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto p-1 space-y-0.5">
                    {searchResults.length > 0 ? (
                      searchResults.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectTopic(item.topic.id, item.section?.id)}
                          className="w-full text-left px-2.5 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-xs flex items-center gap-2 group cursor-pointer"
                        >
                          <item.topic.icon size={13} className="text-neutral-400 group-hover:text-emerald-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{item.matchText}</p>
                            <p className="text-[10px] text-neutral-400 uppercase font-mono tracking-wider">{item.topic.category}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-neutral-400">Tidak ada hasil ditemukan.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsExambroGuideOpen(true)}
              className="text-xs font-semibold h-8 px-2.5 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hidden sm:flex items-center gap-1.5 rounded-md cursor-pointer"
            >
              <Download size={13} className="text-neutral-400" />
              <span>Config SEB</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => window.print()}
              className="text-xs font-semibold h-8 px-2.5 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 rounded-md cursor-pointer"
              title="Cetak SOP atau Simpan PDF"
            >
              <Printer size={13} className="text-neutral-400" />
              <span className="hidden md:inline">Cetak</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main 3-Column Documentation Container ── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* COLUMN 1: LEFT SIDEBAR NAVIGATION (TREE VIEW)               */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <aside className="lg:col-span-3 lg:sticky lg:top-[57px] h-fit max-h-[calc(100vh-80px)] overflow-y-auto space-y-4 pr-2 select-none [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-200 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-800">
            {categories.map((cat, cIdx) => (
              <div key={cIdx} className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-semibold px-2.5 pt-2 pb-1">
                  {cat.name}
                </div>
                <div className="space-y-0.5">
                  {cat.topics.map((topic) => {
                    const isActive = topic.id === currentTopic.id;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => selectTopic(topic.id)}
                        className={cn(
                          "w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer group",
                          isActive
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold border-l-2 border-emerald-500"
                            : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/70 dark:hover:bg-neutral-850/60 font-medium"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <topic.icon className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-colors",
                            isActive ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"
                          )} />
                          <span className="truncate">{topic.title}</span>
                        </div>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="pt-3 border-t border-neutral-200/80 dark:border-neutral-800 px-1">
              <a
                href="https://wa.me/6285359907696"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-md bg-neutral-100 dark:bg-neutral-850/60 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  <MessageCircle size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>WhatsApp IT Support</span>
                </span>
                <ExternalLink size={11} className="text-neutral-400" />
              </a>
            </div>
          </aside>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* COLUMN 2: CENTER DOCUMENTATION ARTICLE (MDX PROSE STYLE)    */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <main className="lg:col-span-6 space-y-8 min-w-0">
            {/* Breadcrumb & Article Header */}
            <div className="space-y-2 border-b border-neutral-200 dark:border-neutral-800 pb-5">
              <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-400">
                <span>Dokumentasi</span>
                <span>/</span>
                <span className="uppercase">{currentTopic.category}</span>
                <span>/</span>
                <span className="text-neutral-700 dark:text-neutral-300 font-semibold">{currentTopic.title}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {currentTopic.title}
              </h1>

              <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400 leading-relaxed font-normal">
                {currentTopic.lead}
              </p>

              <div className="flex items-center gap-3 pt-2 text-[11px] font-mono text-neutral-400">
                <span>Waktu baca: {currentTopic.readTime}</span>
                <span>•</span>
                <span>Diperbarui: Oktober 2026</span>
              </div>
            </div>

            {/* Content Based on Active Topic */}
            <div className="space-y-10 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">

              {/* ────────────────── TOPIC 1: OVERVIEW ────────────────── */}
              {currentTopic.id === "overview" && (
                <>
                  <section id="arsitektur" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Zap size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Arsitektur Single Page Application (SPA)
                    </h2>
                    <p>
                      EXAMKU dibangun dengan arsitektur <strong>Single Page Application (SPA)</strong> modern berkecepatan tinggi. Berbeda dengan aplikasi CBT tradisional berbasis PHP yang melakukan reload penuh pada setiap perpindahan soal, EXAMKU menjalankan komputasi state sepenuhnya di memori klien dengan sinkronisasi latar belakang terenkripsi.
                    </p>
                    <Callout type="note" title="Manfaat Arsitektur SPA">
                      Beban server berkurang hingga 80% karena server hanya menerima payload JSON jawaban mini (kurang dari 2 KB) tanpa perlu merender ulang halaman HTML. Siswa dapat berpindah antar-soal secara instan tanpa jeda buffering.
                    </Callout>
                  </section>

                  <section id="keunggulan" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                      4 Pilar Keunggulan Platform
                    </h2>
                    <DocsTable
                      headers={["Pilar Keunggulan", "Spesifikasi Teknologi", "Dampak bagi Sekolah"]}
                      columnWidths={["w-[28%]", "w-[36%]", "w-[36%]"]}
                      rows={[
                        [
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Ketahanan Real-Time</span>,
                          <code className="font-mono text-xs">Offline-First IndexedDB Cache</code>,
                          "Jawaban siswa tidak pernah hilang meski kabel LAN terputus atau WiFi restart."
                        ],
                        [
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Keamanan Kiosk Mode</span>,
                          <code className="font-mono text-xs">Exambro Android &amp; Safe Exam Browser</code>,
                          "Mencegah screenshot, split-screen, membuka Google/ChatGPT, dan notifikasi pesan."
                        ],
                        [
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Generasi Soal Cerdas</span>,
                          <code className="font-mono text-xs">Magic AI &amp; Word Converter</code>,
                          "Guru dapat menyusun bank soal dari silabus atau file Word naskah soal dalam hitungan detik."
                        ],
                        [
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Psikometri Asesmen</span>,
                          <code className="font-mono text-xs">Classical Test Theory (CTT) &amp; Deep Learning</code>,
                          "Analisis otomatis tingkat kesukaran (P), daya pembeda (D), dan efektivitas pengecoh."
                        ],
                      ]}
                    />
                  </section>

                  <section id="tujuan" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Target size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Tujuan &amp; Filosofi Sistem
                    </h2>
                    <p>
                      Platform ini didesain dengan filosofi <em>Zero Technical Friction</em> untuk pendidik. Pendidik tidak perlu memahami perintah terminal server Linux atau arsitektur database. Cukup fokus pada kurikulum dan butir soal, sedangkan seluruh sinkronisasi data, backup, dan rekapitulasi nilai dikerjakan secara otomatis oleh sistem.
                    </p>
                  </section>
                </>
              )}

              {/* ────────────────── TOPIC 2: AKUN ────────────────── */}
              {currentTopic.id === "akun" && (
                <>
                  <section id="profil-keamanan" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Key size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Profil Pengguna &amp; Kebijakan Sandi
                    </h2>
                    <p>
                      Setiap akun pengguna (Admin dan Guru) memiliki panel manajemen identitas di menu <strong>Kelola Akun</strong> dan <strong>Profil</strong>.
                    </p>
                    <Callout type="warning" title="Kebijakan Sandi Bawaan">
                      Akun baru memiliki kata sandi bawaan institusi (<code className="font-mono text-xs">12345678</code>). Sangat disarankan mewajibkan seluruh pengajar mengubah sandi pada sesi login pertama untuk melindungi bank soal dan integritas nilai siswa.
                    </Callout>
                  </section>

                  <section id="hak-akses-guru" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Layers size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Wewenang Akun Guru (Standar vs Full Access)
                    </h2>
                    <DocsTable
                      headers={["Tingkat Akun", "Hak Akses Bank Soal", "Hak Akses Monitoring Ujian", "Hak Akses Data Master"]}
                      columnWidths={["w-[22%]", "w-[26%]", "w-[26%]", "w-[26%]"]}
                      rows={[
                        [
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Guru Standar</span>,
                          "Hanya paket soal miliknya sendiri",
                          "Hanya ruang ujian yang ditugaskan kepadanya",
                          "Hanya membaca daftar siswa"
                        ],
                        [
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Guru Full Access</span>,
                          "Melihat dan menyunting semua paket soal",
                          "Dapat membuka kunci / reset semua ruang ujian",
                          "Dapat mengedit kelas dan mata pelajaran"
                        ],
                        [
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Administrator</span>,
                          "Akses penuh (Full Super-Permission)",
                          "Akses penuh pengawasan real-time",
                          "Akses penuh konfigurasi sistem &amp; backup"
                        ],
                      ]}
                    />
                  </section>

                  <section id="peserta-didik" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <GraduationCap size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Identitas Login Siswa (NISN Unik)
                    </h2>
                    <p>
                      Siswa masuk ke portal ujian menggunakan Nomor Induk Siswa Nasional (NISN) sebagai username. NISN dienkripsi sebagai kunci unik primer. Siswa tidak diizinkan membuat akun sendiri, melainkan diimpor oleh administrator melalui berkas spreadsheet resmi.
                    </p>
                  </section>
                </>
              )}

              {/* ────────────────── TOPIC 3: DATA MASTER ────────────────── */}
              {currentTopic.id === "data-master" && (
                <>
                  <section id="rombel-mapel" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <LayoutTemplate size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Mata Pelajaran &amp; Rombongan Belajar (Kelas)
                    </h2>
                    <p>
                      Sebelum membuat soal atau jadwal ujian, konfigurasikan terlebih dahulu daftar mata pelajaran dan rombongan belajar (rombel) di menu master data. Penamaan kelas yang konsisten (misal: <code className="font-mono text-xs">X-MIPA-1</code>, <code className="font-mono text-xs">XII-IPS-2</code>) mempermudah filter rekapitulasi nilai.
                    </p>
                  </section>

                  <section id="data-siswa" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Users size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Data Siswa &amp; Nomor Induk Siswa Nasional (NISN)
                    </h2>
                    <p>
                      Setiap peserta didik memiliki profil yang mencakup Nama Lengkap, NISN, Kelas, dan Tempat/Tanggal Lahir. Data ini otomatis digunakan saat pencetakan <strong>Kartu Peserta Ujian</strong> dengan QR-Code autentikasi.
                    </p>
                  </section>

                  <section id="bulk-import-excel" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <FileSpreadsheet size={16} className="text-emerald-600 dark:text-emerald-400" />
                      SOP Smart Bulk Import Excel (.xlsx)
                    </h2>
                    <p>Untuk mengunggah ratusan hingga ribuan siswa sekaligus:</p>
                    <ol className="list-decimal pl-5 space-y-1.5 text-xs">
                      <li>Buka menu <strong>Data Siswa</strong> di sidebar navigasi.</li>
                      <li>Klik tombol <strong>Import Excel</strong> di pojok kanan atas tabel.</li>
                      <li>Unduh <em>Template Excel Resmi (.xlsx)</em> yang telah disediakan sistem.</li>
                      <li>Isi kolom <code className="font-mono text-xs">nama</code>, <code className="font-mono text-xs">username</code> (NISN), dan <code className="font-mono text-xs">kelas</code>.</li>
                      <li>Pilih file Excel yang telah diisi, lalu klik <strong>Mulai Impor</strong>.</li>
                    </ol>
                  </section>

                  <section id="aturan-kolom" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <AlertCircle size={16} className="text-amber-600 dark:text-amber-400" />
                      Aturan Tipe Data &amp; Format Teks Excel
                    </h2>
                    <Callout type="warning" title="Peringatan Tipe Kolom Excel">
                      Pastikan kolom NISN pada Excel diformat secara eksplisit sebagai tipe <strong>Text</strong> (bukan <em>Number</em> atau <em>General</em>). Format angka dapat memotong awalan angka nol (0) atau mengubah digit 10 angka menjadi notasi ilmiah seperti <code className="font-mono text-xs">1.23E+09</code>.
                    </Callout>
                  </section>
                </>
              )}

              {/* ────────────────── TOPIC 4: BANK SOAL ────────────────── */}
              {currentTopic.id === "bank-soal" && (
                <>
                  <section id="konfigurasi-paket" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <BookOpen size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Konfigurasi &amp; Duplikasi Paket Soal
                    </h2>
                    <p>
                      Paket soal dikelompokkan berdasarkan Mata Pelajaran dan Jenjang Kelas. Fitur <strong>Duplikasi Paket</strong> memungkinkan guru menduplikasi seluruh butir soal ke semester atau tahun ajaran berikutnya tanpa mengetik ulang.
                    </p>
                  </section>

                  <section id="rich-text-literasi" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <FileText size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Rich Text Editor &amp; Mode Wacana Literasi
                    </h2>
                    <p>
                      Editor soal mendukung integrasi gambar, tabel matriks, format cetak tebal/miring, dan subscript/superscript.
                    </p>
                    <Callout type="tip" title="Mode Literasi Bersama (Split Screen)">
                      Untuk soal bertipe bacaan panjang (Literasi Bahasa atau Studi Kasus Sains), aktifkan opsi <strong>Mode Literasi</strong>. Teks bacaan akan muncul di panel kiri layar siswa secara statis, sementara butir soal nomor 1 sampai 5 dapat dikerjakan di panel kanan tanpa kehilangan konteks bacaan.
                    </Callout>
                  </section>

                  <section id="metode-impor" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Download size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Metode Impor Naskah Soal
                    </h2>
                    <DocsTable
                      headers={["Format Berkas", "Karakteristik & Kecepatan", "Rekomendasi Penggunaan"]}
                      columnWidths={["w-[28%]", "w-[36%]", "w-[36%]"]}
                      rows={[
                        [
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Microsoft Word (.docx)</span>,
                          "Ekstraksi teks, gambar, tabel, dan Equation Editor otomatis",
                          "Naskah soal ujian semester yang sudah siap di Word"
                        ],
                        [
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Excel Spreadsheet (.xlsx)</span>,
                          "Tabel kolom: Soal, Opsi A-E, Kunci, Bobot Nilai",
                          "Bank soal pilihan ganda standar dalam jumlah banyak"
                        ],
                        [
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Berkas JSON Terstruktur</span>,
                          "Format pertukaran data tanpa dependensi AI / kuota",
                          "Migrasi antar-server offline sekolah atau backup lokal"
                        ],
                        [
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Smart AI Text Extraction</span>,
                          "Tempel teks mentah apapun; AI mengenali pola butir soal",
                          "Menyalin naskah soal dari PDF materi atau modul ajar"
                        ],
                      ]}
                    />
                  </section>

                  <section id="katalog-tipe-soal" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <SlidersHorizontal size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Katalog 12 Tipe Butir Soal
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">1. Pilihan Ganda Tunggal</span>
                        <span className="text-neutral-500">Satu jawaban benar dengan pengacakan opsi A–E.</span>
                      </div>
                      <div className="p-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">2. PG Kompleks (Multi-Jawaban)</span>
                        <span className="text-neutral-500">Siswa dapat memilih lebih dari satu pernyataan yang benar.</span>
                      </div>
                      <div className="p-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">3. Menjodohkan (Matching)</span>
                        <span className="text-neutral-500">Memasangkan premis kiri dan respon kanan via dropdown interaktif.</span>
                      </div>
                      <div className="p-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">4. Urutkan (Ordering)</span>
                        <span className="text-neutral-500">Menyusun kronologi atau urutan proses menggunakan drag-and-drop.</span>
                      </div>
                      <div className="p-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">5. Drag &amp; Drop Visual</span>
                        <span className="text-neutral-500">Menempatkan label teks ke dalam area kosong pada diagram gambar.</span>
                      </div>
                      <div className="p-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">6. Klasifikasi Kategori</span>
                        <span className="text-neutral-500">Menentukan kategori dari beberapa pernyataan secara proporsional.</span>
                      </div>
                      <div className="p-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">7. Hotspot (Klik Area Gambar)</span>
                        <span className="text-neutral-500">Siswa mengetuk koordinat gambar (peta geografi, diagram anatomi biologi).</span>
                      </div>
                      <div className="p-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">8. Isian Rumpang (Cloze Test)</span>
                        <span className="text-neutral-500">Melengkapi bagian kata yang hilang bertanda [[1]], [[2]].</span>
                      </div>
                      <div className="p-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">9. Matriks Benar/Salah</span>
                        <span className="text-neutral-500">Tabel pernyataan baris dengan pilihan opsi kolom evaluasi.</span>
                      </div>
                      <div className="p-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">10. Esai / Uraian Terstruktur</span>
                        <span className="text-neutral-500">Pengerjaan esai dengan pedoman penskoran rubrik guru / asistensi AI.</span>
                      </div>
                      <div className="p-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">11. Isian Singkat</span>
                        <span className="text-neutral-500">Input jawaban kata kunci dengan toleransi alternatif ejaan.</span>
                      </div>
                      <div className="p-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">12. Survei / Skala Likert</span>
                        <span className="text-neutral-500">Asesmen non-kognitif, minat bakat, dan evaluasi refleksi siswa.</span>
                      </div>
                    </div>
                  </section>

                  <section id="sintaks-latex" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Terminal size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Spesifikasi Rumus LaTeX &amp; KaTeX
                    </h2>
                    <p>
                      Penulisan persamaan sains dan matematika diapit menggunakan tanda dolar tunggal (<code className="font-mono text-xs">$...$</code>) untuk inline, atau tanda dolar ganda (<code className="font-mono text-xs">$$...$$</code>) untuk blok persamaan berdiri sendiri.
                    </p>
                    <CodeBlock
                      title="Contoh Rumus Matematika Inline &amp; Display"
                      code={`Tentukan nilai dari limit berikut:
$$\\lim_{x \\to 0} \\frac{\\sin(2x)}{x} = 2$$

Hitung akar persamaan kuadrat menggunakan rumus abc:
$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$`}
                    />
                  </section>

                  <section id="trigonometri-kalkulus" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Percent size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Fungsi Trigonometri &amp; Kalkulus Lengkap
                    </h2>
                    <DocsTable
                      headers={["Cabang Matematika", "Sintaks LaTeX yang Didukung", "Contoh Output"]}
                      columnWidths={["w-[28%]", "w-[44%]", "w-[28%]"]}
                      rows={[
                        [
                          "Trigonometri Dasar",
                          <code className="font-mono text-xs">$sin(x), cos(x), tan(x), cot(x), sec(x), csc(x)$</code>,
                          "sin(x), cos(x), tan(x)"
                        ],
                        [
                          "Invers & Hiperbolik",
                          <code className="font-mono text-xs">$arcsin(x), arccos(x), sinh(x), cosh(x)$</code>,
                          "arcsin(x), sinh(x)"
                        ],
                        [
                          "Integral & Derivatif",
                          <code className="font-mono text-xs">{'$\\int_0^1 f(x)dx, \\frac{\\partial y}{\\partial x}, \\sum_{i=1}^n x_i$'}</code>,
                          "Simbol integral berbatas, turunan parsial, sigma"
                        ],
                        [
                          "Simbol & Yunani",
                          <code className="font-mono text-xs">{'$\\alpha, \\beta, \\theta, \\lambda, \\pi, \\Delta, \\Omega$'}</code>,
                          "Karakter huruf Yunani kecil dan besar"
                        ],
                      ]}
                    />
                  </section>

                  <section id="mesin-autofix" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Zap size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Mesin Auto-Fix Parser Backslash
                    </h2>
                    <p>
                      Seringkali pendidik lupa mengetik karakter backslash (<code className="font-mono text-xs">\</code>) sebelum nama fungsi. Parser internal EXAMKU secara otomatis mendeteksi kata kunci seperti <code className="font-mono text-xs">$sin(x)$</code> dan membetulkannya menjadi <code className="font-mono text-xs">$\sin(x)$</code> tanpa menyebabkan rendering error pada klien siswa.
                    </p>
                  </section>
                </>
              )}

              {/* ────────────────── TOPIC 5: AI MAGIC ────────────────── */}
              {currentTopic.id === "ai-magic" && (
                <>
                  <section id="magic-generator" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-500" />
                      Magic AI Generator (Topic-to-Quiz HOTS)
                    </h2>
                    <p>
                      Cukup masukkan topik pembelajaran dan capaian kompetensi dasar. AI akan merangkai paket butir soal lengkap dengan kunci jawaban dan rubrik pembahasan.
                    </p>
                    <CodeBlock
                      title="Contoh Instruksi Prompt yang Efektif"
                      code={`Buatkan 10 soal pilihan ganda Fisika materi Hukum Gravitasi Newton untuk Kelas 10 SMA.
Karakteristik soal:
- 7 butir berorientasi penalaran HOTS (Higher Order Thinking Skills).
- Sertakan stimulus konteks kehidupan nyata atau eksplorasi luar angkasa.
- Format pilihan ganda A, B, C, D, E dengan kunci jawaban tepat.`}
                    />
                  </section>

                  <section id="smart-detect" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <FileBox size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Ekstraksi Materi &amp; Naskah Soal Mentah
                    </h2>
                    <p>
                      Bila Anda memiliki berkas naskah soal hasil ketikan manual tanpa format baku, salin dan tempelkan teks tersebut ke kotak dialog AI. AI mengenali pola penomoran, teks pertanyaan, pilihan jawaban, serta kunci jawaban secara otomatis.
                    </p>
                  </section>

                  <section id="json-direct" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <FileJson size={16} className="text-sky-600 dark:text-sky-400" />
                      Format Transfer JSON Instan (Tanpa AI)
                    </h2>
                    <p>
                      Untuk sekolah yang menjalankan server offline mandiri tanpa koneksi internet atau kuota API LLM, gunakan opsi <strong>Import JSON Langsung</strong>. Struktur JSON diparsing instan dalam milidetik secara lokal.
                    </p>
                  </section>
                </>
              )}

              {/* ────────────────── TOPIC 6: RUANG UJIAN ────────────────── */}
              {currentTopic.id === "ruang-ujian" && (
                <>
                  <section id="waktu-jendela" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <ClipboardList size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Jendela Waktu Mulai &amp; Berakhir
                    </h2>
                    <p>
                      Jendela akses menentukan rentang waktu tombol <strong>Mulai Ujian</strong> aktif di layar siswa. Jika siswa membuka aplikasi setelah waktu berakhir, sesi dinyatakan ditutup dan siswa tidak dapat memulai ujian tanpa izin administrator.
                    </p>
                  </section>

                  <section id="durasi-timer" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Zap size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Alokasi Durasi &amp; Timer Hitung Mundur
                    </h2>
                    <p>
                      Durasi waktu pengerjaan (misal: 90 menit) mulai dihitung saat peserta mengklik tombol "Mulai". Timer hitung mundur disinkronkan dengan jam server untuk mencegah manipulasi jam lokal perangkat siswa.
                    </p>
                  </section>

                  <section id="universal-token" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Key size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Universal Security Token &amp; Rotasi Dinamis
                    </h2>
                    <p>
                      Setiap ruang ujian dilindungi kode token 6-karakter acak.
                    </p>
                    <Callout type="tip" title="Rotasi Token Otomatis (5 / 15 Menit)">
                      Aktifkan fitur rotasi token otomatis di menu Pengaturan. Token akan berganti setiap interval waktu yang ditentukan, dan proktor dapat menampilkan token baru di proyektor aula melalui halaman <code className="font-mono text-xs">/token-view</code>.
                    </Callout>
                  </section>

                  <section id="algoritma-acak" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <RefreshCw size={16} className="text-sky-600 dark:text-sky-400" />
                      Pengacakan Urutan Soal &amp; Pilihan Opsi
                    </h2>
                    <p>
                      Sistem menerapkan algoritma <em>Fisher-Yates Shuffle</em> berbasis seed ID siswa. Urutan nomor soal dan letak opsi jawaban diacak secara unik untuk setiap siswa, sehingga menyontek antar-peserta yang duduk berdampingan menjadi tidak memungkinkan.
                    </p>
                  </section>
                </>
              )}

              {/* ────────────────── TOPIC 7: MONITORING ────────────────── */}
              {currentTopic.id === "monitoring" && (
                <>
                  <section id="deteksi-focus-loss" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <ShieldAlert size={16} className="text-red-600 dark:text-red-400" />
                      Deteksi Focus Loss &amp; Perpindahan Tab
                    </h2>
                    <p>
                      Sistem memantau event visibilitas window browser (<em>Page Visibility API &amp; Window Blur</em>). Saat siswa berpindah aplikasi, membuka tab baru, atau menekan tombol navigasi sistem, detektor mencatat insiden tersebut beserta durasi waktu keluarnya.
                    </p>
                  </section>

                  <section id="kebijakan-auto-lock" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Key size={16} className="text-amber-600 dark:text-amber-400" />
                      Kebijakan Penguncian Otomatis (Lock Ujian)
                    </h2>
                    <p>
                      Pengawas dapat mengatur ambang batas toleransi (misal: 2 kali pelanggaran). Melewati ambang tersebut, layar ujian terkunci total dan menampilkan pesan bahwa siswa harus melapor ke pengawas di ruangan.
                    </p>
                  </section>

                  <section id="dasbor-pengawasan" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Eye size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Dasbor Pengawasan Real-Time Proktor
                    </h2>
                    <p>
                      Melalui halaman <strong>Pengawasan Live</strong> (<code className="font-mono text-xs">/admin/monitoring</code>), proktor dapat:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-xs">
                      <li>Memantau status koneksi siswa (Aktif mengerjakan, Terkunci, atau Selesai).</li>
                      <li>Melihat jumlah pelanggaran dan log waktu kecurangan tiap peserta.</li>
                      <li>Melakukan <strong>Buka Kunci (Unlock)</strong> atau <strong>Reset Sesi Login</strong> secara individual atau massal.</li>
                    </ul>
                  </section>

                  <section id="matriks-platform" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Laptop size={16} className="text-sky-600 dark:text-sky-400" />
                      Dukungan Platform Klien Siswa
                    </h2>
                    <DocsTable
                      headers={["Platform Perangkat", "Mekanisme Proteksi Kiosk", "Konfigurasi yang Dibutuhkan"]}
                      columnWidths={["w-[25%]", "w-[45%]", "w-[30%]"]}
                      rows={[
                        [
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Android APK</span>,
                          "Kiosk Penuh, Penguncian Layar, Sirine Suara jika Split-Screen",
                          "Unduh file APK dari menu Aplikasi Siswa"
                        ],
                        [
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">iOS / iPadOS</span>,
                          "Safe Exam Browser dengan Apple Assessment Mode (AAC)",
                          "Buka file config .seb otomatis dari portal ujian"
                        ],
                        [
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Windows PC / Lab</span>,
                          "Safe Exam Browser mengunci Task Manager, Alt+Tab, tombol Windows",
                          "Unduh konfigurasi .seb dari tombol 'Config SEB' di atas"
                        ],
                        [
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">Web Browser Standar</span>,
                          "Fullscreen wajib, timer peringatan 5 detik saat focus loss",
                          "Dapat dijalankan langsung di Chrome/Edge/Safari"
                        ],
                      ]}
                    />
                  </section>
                </>
              )}

              {/* ────────────────── TOPIC 8: NILAI & CTT ────────────────── */}
              {currentTopic.id === "nilai" && (
                <>
                  <section id="ctt-paradigma" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <PieChart size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Teori Tes Klasik &amp; Paradigma Pembelajaran Mendalam
                    </h2>
                    <p>
                      Modul analitik EXAMKU menghitung tiga parameter psikometri baku <strong>Classical Test Theory (CTT)</strong> yang diselaraskan dengan paradigma <strong>Pembelajaran Mendalam (Deep Learning: Mindful, Meaningful, &amp; Joyful Learning)</strong> dari Kemendikdasmen RI.
                    </p>
                  </section>

                  <section id="tingkat-kesukaran" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Percent size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Tingkat Kesukaran (Index P = B/N)
                    </h2>
                    <p>
                      Tingkat kesukaran mengukur proporsi seluruh peserta yang menjawab butir soal dengan benar:
                    </p>
                    <CodeBlock language="text" code="P = B / N   (di mana B = jumlah siswa benar, N = total peserta)" />
                    <DocsTable
                      headers={["Rentang Nilai P", "Klasifikasi Butir Soal", "Peran dalam Asesmen Pembelajaran"]}
                      columnWidths={["w-[24%]", "w-[26%]", "w-[50%]"]}
                      rows={[
                        [<code className="font-mono text-xs font-semibold">P &gt; 0.70</code>, "Mudah", "Asesmen Diagnostik Awal &amp; Penguasaan Kompetensi Fondasional"],
                        [<code className="font-mono text-xs font-semibold">0.30 ≤ P ≤ 0.70</code>, "Sedang (Ideal)", "Asesmen Sumatif Capaian Pembelajaran (Standar Bank Soal)"],
                        [<code className="font-mono text-xs font-semibold">P &lt; 0.30</code>, "Sukar", "Soal Pengayaan &amp; Penalaran Analitis Lanjut (HOTS)"],
                      ]}
                    />
                  </section>

                  <section id="daya-pembeda" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <TrendingUp size={16} className="text-sky-600 dark:text-sky-400" />
                      Daya Pembeda (Index D Metode 27% Kelley)
                    </h2>
                    <p>
                      Mengukur kemampuan soal dalam membedakan kelompok siswa berkemampuan tinggi (27% ranking atas, <code className="font-mono text-xs">Ba</code>) dan kelompok siswa berkemampuan rendah (27% ranking bawah, <code className="font-mono text-xs">Bb</code>):
                    </p>
                    <CodeBlock language="text" code="D = (Ba - Bb) / n   (di mana n = 27% dari total peserta)" />
                    <DocsTable
                      headers={["Rentang Nilai D", "Kategori Daya Pembeda", "Rekomendasi Tindakan Guru"]}
                      columnWidths={["w-[24%]", "w-[26%]", "w-[50%]"]}
                      rows={[
                        [<code className="font-mono text-xs font-semibold text-emerald-600">D ≥ 0.40</code>, "Sangat Baik", "Soal bermutu tinggi; pertahankan dalam bank soal permanen."],
                        [<code className="font-mono text-xs font-semibold text-emerald-600">0.30 ≤ D &lt; 0.40</code>, "Baik", "Soal baik; layak digunakan dalam asesmen sumatif resmi."],
                        [<code className="font-mono text-xs font-semibold text-amber-600">0.20 ≤ D &lt; 0.30</code>, "Cukup (Revisi)", "Perbaiki redaksi kalimat atau tingkatkan efektivitas opsi pengecoh."],
                        [<code className="font-mono text-xs font-semibold text-red-600">D &lt; 0.20</code>, "Rendah / Buruk", "Kurang membedakan; buang atau tulis ulang butir soal."],
                        [<code className="font-mono text-xs font-semibold text-red-600">D &lt; 0.00</code>, "Negatif (Anomali)", "Deteksi salah kunci jawaban; kelompok bawah lebih banyak benar."],
                      ]}
                    />
                  </section>

                  <section id="analisis-distraktor" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Target size={16} className="text-amber-600 dark:text-amber-400" />
                      Evaluasi Efektivitas Pengecoh (Distractor Analysis)
                    </h2>
                    <p>
                      Pilihan opsi salah (distraktor) dinyatakan berfungsi dengan baik apabila dipilih oleh sekurang-kurangnya <strong>5% dari total peserta</strong> dan lebih banyak dipilih oleh kelompok bawah dibandingkan kelompok atas.
                    </p>
                  </section>

                  <section id="diferensiasi-ajar" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Refleksi Diferensiasi (Teaching at the Right Level)
                    </h2>
                    <p>
                      Hasil psikometri tidak digunakan untuk mendiskreditkan siswa, melainkan sebagai kompas diagnostik bagi guru dalam menerapkan <em>Teaching at the Right Level (TaRL)</em> dan menyusun materi remedial yang tepat sasaran.
                    </p>
                  </section>

                  <section id="ekspor-multisheet" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <FileSpreadsheet size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Ekspor Multi-Sheet Excel .xlsx Berformat
                    </h2>
                    <p>
                      Sistem menyediakan berkas laporan evaluasi siap cetak berbasis spreadsheet <Kbd>.xlsx</Kbd> lengkap dengan 4 lembar kerja (worksheet): Ringkasan Ujian, Analisis Butir Soal Lengkap, Distribusi Pilihan Opsi, dan Rekapitulasi Nilai Siswa.
                    </p>
                  </section>
                </>
              )}

              {/* ────────────────── TOPIC 9: PENGATURAN ────────────────── */}
              {currentTopic.id === "pengaturan" && (
                <>
                  <section id="branding-sekolah" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Globe size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Identitas Branding &amp; Logo Institusi
                    </h2>
                    <p>
                      Administrator dapat mengganti nama sekolah dan mengunggah berkas logo institusi berformat PNG transparan. Logo ini otomatis tampil pada halaman login siswa, header kartu ujian, dan kop laporan nilai.
                    </p>
                  </section>

                  <section id="kiosk-enforcement" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <ShieldCheck size={16} className="text-sky-600 dark:text-sky-400" />
                      Penegakan Wajib Exambro (Kiosk Enforcement)
                    </h2>
                    <p>
                      Bila diaktifkan, portal ujian menolak akses dari peramban biasa (Google Chrome atau Safari mobile). Siswa wajib membuka aplikasi dari Exambro Android resmi atau Safe Exam Browser yang terverifikasi.
                    </p>
                  </section>

                  <section id="cadangan-json" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <FileJson size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Manajemen Cadangan Database JSON (Ekspor/Impor)
                    </h2>
                    <p>
                      Fitur <strong>Ekspor DB</strong> mengunduh arsip komprehensif seluruh data bank soal, histori nilai, dan akun siswa dalam format JSON terenkripsi. Gunakan <strong>Impor DB</strong> untuk pemulihan bencana (Disaster Recovery).
                    </p>
                  </section>

                  <section id="prosedur-format" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <ShieldAlert size={16} className="text-red-600 dark:text-red-400" />
                      SOP Format Sistem &amp; Reset Tahun Ajaran
                    </h2>
                    <Callout type="danger" title="Peringatan Fatal Format Sistem">
                      Opsi Format Sistem menghapus seluruh bank soal dan catatan riwayat pengerjaan siswa untuk memulai tahun ajaran baru. Akun administrator tetap dipertahankan. Selalu cadangkan database sebelum menjalankan tindakan ini.
                    </Callout>
                  </section>

                  <section id="konektor-ai" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Cpu size={16} className="text-violet-600 dark:text-violet-400" />
                      Konfigurasi Provider Mesin Kecerdasan Buatan
                    </h2>
                    <p>
                      EXAMKU mendukung koneksi ke empat jenis penyedia layanan AI: <strong>Groq Cloud (Llama 3 70B berkecepatan ultra)</strong>, <strong>OpenRouter</strong>, <strong>Google Gemini Pro</strong>, dan <strong>Ollama (Local LLM Offline)</strong>.
                    </p>
                  </section>
                </>
              )}

              {/* ────────────────── TOPIC 10: SPESIFIKASI ────────────────── */}
              {currentTopic.id === "spesifikasi" && (
                <>
                  <section id="arsitektur-teknologi" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <Terminal size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Spesifikasi Teknologi &amp; Infrastruktur Server
                    </h2>
                    <DocsTable
                      headers={["Lapisan Sistem", "Komponen Teknologi", "Catatan Kinerja"]}
                      columnWidths={["w-[25%]", "w-[40%]", "w-[35%]"]}
                      rows={[
                        ["Frontend Web", "React 18, TypeScript, Tailwind CSS, Vite", "Kompilasi zero-bundle bloat, responsive layout"],
                        ["Backend Engine", "PocketBase (Go / SQLite WAL Mode)", "Mendukung hingga 1.000 konkurensi koneksi per node"],
                        ["Mobile Kiosk", "Capacitor Native Android & iOS", "Akses kontrol perangkat keras & status bar lock"],
                        ["Keamanan Sandi", "Argon2 / Bcrypt Password Hashing", "Standar enkripsi kriptografi OWASP"],
                      ]}
                    />
                  </section>

                  <section id="profil-pengembang" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <User size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Profil Master Developer
                    </h2>
                    <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 flex flex-col sm:flex-row items-center gap-4">
                      <img
                        src="https://www.sman-modalbangsa.sch.id/wp-content/uploads/2021/09/alfaruqasri-300x400.jpeg"
                        alt="Alfaruq Asri"
                        className="w-20 h-24 rounded object-cover object-[center_15%] border border-neutral-300 dark:border-neutral-700 shrink-0"
                      />
                      <div className="space-y-1 text-center sm:text-left">
                        <div className="text-xs font-mono text-emerald-700 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                          Lead Architect &amp; Software Engineer
                        </div>
                        <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                          Alfaruq Asri, S.Pd., Gr.
                        </h4>
                        <p className="text-xs text-neutral-500 leading-relaxed">
                          Pendidik dan insinyur perangkat lunak dengan fokus pada inovasi teknologi evaluasi pendidikan, arsitektur CBT anti-contek, dan asesmen psikometri digital.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section id="saluran-bantuan" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <MessageCircle size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Saluran WhatsApp Bantuan Teknis IT Support
                    </h2>
                    <p>
                      Untuk pertanyaan teknis instalasi server offline, integrasi VPS multi-node, atau lisensi institusi sekolah:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href="https://wa.me/6285359907696"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md transition-colors shadow-2xs flex items-center gap-1.5"
                      >
                        <MessageCircle size={13} /> Chat WhatsApp IT Support
                      </a>
                      <a
                        href="https://www.alfaruqasri.my.id/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-200 text-xs font-semibold rounded-md transition-colors border border-neutral-200 dark:border-neutral-700 shadow-2xs flex items-center gap-1.5"
                      >
                        <Globe size={13} /> Portofolio Pengembang
                      </a>
                    </div>
                  </section>

                  <section id="legalitas-lisensi" className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
                      <ShieldCheck size={16} className="text-neutral-600 dark:text-neutral-400" />
                      Ketentuan Hak Cipta &amp; Dokumen Internal Institusi
                    </h2>
                    <p className="text-xs text-neutral-500 leading-relaxed">
                      © 2026 Alfaruq Asri. Seluruh hak cipta dilindungi undang-undang. Dokumentasi panduan operasional ini disusun khusus untuk penggunaan resmi civitas akademika institusi berlisensi EXAMKU Platform.
                    </p>
                  </section>
                </>
              )}

            </div>

            {/* ── Article Footer Navigation (Prev / Next Buttons) ── */}
            <div className="pt-8 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {prevTopic ? (
                <button
                  type="button"
                  onClick={() => selectTopic(prevTopic.id)}
                  className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-[#111214] text-left transition-colors cursor-pointer group space-y-1"
                >
                  <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 group-hover:text-emerald-600 transition-colors">
                    <ChevronLeft size={12} />
                    <span>Sebelumnya</span>
                  </div>
                  <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {prevTopic.title}
                  </div>
                </button>
              ) : <div />}

              {nextTopic ? (
                <button
                  type="button"
                  onClick={() => selectTopic(nextTopic.id)}
                  className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-[#111214] text-right transition-colors cursor-pointer group space-y-1 sm:col-start-2"
                >
                  <div className="flex items-center justify-end gap-1 text-[11px] font-mono text-neutral-400 group-hover:text-emerald-600 transition-colors">
                    <span>Selanjutnya</span>
                    <ChevronRight size={12} />
                  </div>
                  <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {nextTopic.title}
                  </div>
                </button>
              ) : <div />}
            </div>
          </main>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* COLUMN 3: RIGHT RAIL (ON THIS PAGE TABLE OF CONTENTS)       */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <aside className="lg:col-span-3 lg:sticky lg:top-[57px] h-fit hidden lg:block space-y-5 select-none pl-2 border-l border-neutral-200/80 dark:border-neutral-850">
            <div className="space-y-2.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-1.5">
                <Terminal size={12} /> Di Halaman Ini
              </div>

              <nav className="space-y-1 text-xs">
                {currentTopic.sections.map((sec) => {
                  const isCurrentSection = activeSectionId === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => scrollToSection(sec.id)}
                      className={cn(
                        "w-full text-left py-1 text-xs transition-colors cursor-pointer block truncate",
                        isCurrentSection
                          ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                          : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                      )}
                    >
                      {sec.title}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-neutral-200/80 dark:border-neutral-850 space-y-2 text-xs">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                Tautan Cepat
              </div>
              <div className="space-y-1.5 text-xs text-neutral-500">
                <button
                  type="button"
                  onClick={() => setIsExambroGuideOpen(true)}
                  className="flex items-center gap-1.5 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  <Download size={12} /> Unduh Konfigurasi SEB
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  <Printer size={12} /> Cetak SOP Dokumen Ini
                </button>
                <a
                  href="https://wa.me/6285359907696"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
                >
                  <MessageCircle size={12} /> Bantuan WhatsApp IT
                </a>
              </div>
            </div>
          </aside>

        </div>
      </div>

      <ExambroGuideModal
        open={isExambroGuideOpen}
        onOpenChange={setIsExambroGuideOpen}
        schoolSlug={school?.slug || ""}
        schoolName={school?.name || ""}
      />
    </div>
  );
};

export default GuidePage;
