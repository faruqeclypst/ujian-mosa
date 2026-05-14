import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen, ClipboardList, LayoutTemplate, Settings, ShieldAlert, Users, User,
  GraduationCap, Award, AlertCircle, Download, Monitor, Key, Home, Globe, Database,
  Cpu, MessageCircle, ChevronRight, Menu, X, FileSpreadsheet, FileText, Sparkles,
  Bot, CheckCircle2, Zap, FileJson, Lightbulb, FileBox, HelpCircle, Eye, RefreshCw,
  Search, ShieldCheck, PieChart, Info, Terminal, Laptop, FileCheck, Layers
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";

// --- Advanced Documentation Components ---

const DocSection = ({ id, title, icon: Icon, children }: any) => (
  <section id={id} className="scroll-mt-28 space-y-8 py-12 border-t border-slate-200 dark:border-slate-800 first:border-0 first:pt-0">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-blue-600/10 dark:bg-blue-400/10 rounded-2xl flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/30">
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          {title}
        </h2>
        <div className="h-1 w-12 bg-blue-600 rounded-full mt-2" />
      </div>
    </div>
    <div className="text-slate-600 dark:text-slate-400 leading-relaxed space-y-8">
      {children}
    </div>
  </section>
);

const SubSection = ({ title, children, icon: Icon }: any) => (
  <div className="space-y-4">
    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5">
      {Icon && <Icon size={18} className="text-blue-500" />}
      {title}
    </h3>
    <div className="pl-0 sm:pl-7 space-y-4 text-sm sm:text-base">
      {children}
    </div>
  </div>
);

const AlertBox = ({ type = "info", title, children }: any) => {
  const styles = {
    info: "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/60 text-blue-800 dark:text-blue-300",
    warning: "bg-amber-50/40 dark:bg-amber-900/20 border-amber-200/60 dark:border-amber-800/60 text-amber-800 dark:text-amber-300",
    success: "bg-emerald-50/40 dark:bg-emerald-900/20 border-emerald-200/60 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300",
    danger: "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-800/60 text-rose-800 dark:text-rose-300"
  };
  const icons = {
    info: <Info size={18} className="shrink-0 mt-0.5" />,
    warning: <AlertCircle size={18} className="shrink-0 mt-0.5" />,
    success: <CheckCircle2 size={18} className="shrink-0 mt-0.5" />,
    danger: <ShieldAlert size={18} className="shrink-0 mt-0.5" />
  };
  return (
    <div className={cn("p-6 rounded-2xl border flex gap-4 my-6 shadow-sm", styles[type as keyof typeof styles])}>
      {icons[type as keyof typeof icons]}
      <div className="flex-1">
        {title && <h4 className="font-bold text-sm mb-1.5 uppercase tracking-wider">{title}</h4>}
        <div className="text-[13px] sm:text-sm leading-relaxed opacity-90">{children}</div>
      </div>
    </div>
  );
};

const Step = ({ number, title, children }: any) => (
  <div className="flex gap-6 items-start relative group">
    <div className="absolute left-[19px] top-10 bottom-[-16px] w-px bg-slate-200 dark:bg-slate-800 group-last:hidden" />
    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center justify-center font-black text-sm shrink-0 z-10 border border-slate-200 dark:border-slate-800 shadow-sm transition-all group-hover:scale-110 group-hover:border-blue-500 group-hover:text-blue-600">
      {number}
    </div>
    <div className="pt-2 pb-8 flex-1">
      <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2 tracking-tight group-hover:text-blue-600 transition-colors">{title}</h4>
      <div className="text-[13px] sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
        {children}
      </div>
    </div>
  </div>
);

const FeatureGrid = ({ items }: { items: { icon: any, label: string, desc: string, color: string }[] }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
    {items.map((item, idx) => (
      <div key={idx} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm flex gap-4 transition-all hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", item.color)}>
          <item.icon size={20} />
        </div>
        <div>
          <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{item.label}</h5>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{item.desc}</p>
        </div>
      </div>
    ))}
  </div>
);

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 shadow-sm">{children}</kbd>
);

const GuidePage = () => {
  const { school, terminology } = useTenant();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("pendahuluan");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  const NAV_ITEMS = [
    { id: "pendahuluan", label: "Overview Platform", icon: Home, keywords: "pengenalan cbt aplikasi" },
    { id: "akun", label: "Manajemen Akun", icon: User, keywords: "password ganti profil" },
    { id: "data-master", label: "Data Master & Import", icon: Database, keywords: "siswa guru kelas excel nisn" },
    { id: "bank-soal", label: "Pengelolaan Bank Soal", icon: BookOpen, keywords: "tipe soal pg kompleks literasi" },
    { id: "ai-magic", label: "Teknologi AI & PDF", icon: Bot, keywords: "magic ai pdf extraction generator llm" },
    { id: "ruang-ujian", label: "Siklus Ruang Ujian", icon: ClipboardList, keywords: "sesi token durasi waktu" },
    { id: "monitoring", label: "Anti-Cheat & Pengawasan", icon: Monitor, keywords: "lock gembok pelanggaran monitor" },
    { id: "nilai", label: "Laporan & Analisis", icon: PieChart, keywords: "rekap excel nilai statistik" },
    { id: "pengaturan", label: "Konfigurasi & Backup", icon: Settings, keywords: "logo branding exambro reset format" },
    { id: "pengembang", label: "Tim Pengembang", icon: User, keywords: "alfaruq asri developer wa" }
  ];

  const searchResults = NAV_ITEMS.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.keywords.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close search results on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(event.target as Node) && !searchInputRef.current?.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      { rootMargin: "-20% 0px -60% 0px" }
    );
    NAV_ITEMS.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleNavClick = (id: string) => {
    setMobileMenuOpen(false);
    setShowSearchResults(false);
    setSearchQuery("");
    
    // Smooth scroll using scrollIntoView
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      setActiveSection(id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 animate-in fade-in duration-700">
      
      {/* ── Page Hero Header ── */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 dark:bg-blue-400/5 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-400/5 rounded-full blur-[80px] -ml-20 -mb-20 pointer-events-none" />
        
        <div className="p-8 sm:p-12 relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/40 shrink-0 border-4 border-white dark:border-slate-800 rotate-3 transform transition-transform hover:rotate-0 duration-500">
              <BookOpen size={40} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <Badge className="bg-blue-600 text-white border-0 font-black uppercase tracking-widest text-[10px] px-3 py-1">Documentation Hub</Badge>
                <Badge variant="outline" className="text-slate-400 border-slate-200 dark:border-slate-800 font-black uppercase tracking-widest text-[10px] px-3 py-1 shadow-sm">Version 2.5.4</Badge>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50 font-black uppercase tracking-widest text-[10px] px-3 py-1">Online</Badge>
              </div>
              <div>
                <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  EXAM AA <span className="text-blue-600">Full Guide</span>
                </h1>
                <p className="text-base sm:text-xl font-medium text-slate-500 dark:text-slate-400 mt-4 max-w-2xl leading-relaxed">
                  Pelajari setiap sudut aplikasi EXAM AA mulai dari pengelolaan data master yang mendasar hingga pemanfaatan Kecerdasan Buatan (AI) yang canggih.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto relative">
            <button
              className="lg:hidden flex items-center justify-between px-6 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 shadow-sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="flex items-center gap-3">
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                Explore Chapters
              </span>
            </button>
            <div className="hidden lg:flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
               <Search size={16} className="text-slate-400 ml-2" />
               <input 
                 ref={searchInputRef}
                 type="text" 
                 value={searchQuery}
                 onChange={(e) => {
                   setSearchQuery(e.target.value);
                   setShowSearchResults(true);
                 }}
                 onFocus={() => setShowSearchResults(true)}
                 placeholder="Cepat cari panduan..." 
                 className="bg-transparent border-0 outline-none text-xs font-bold text-slate-600 dark:text-slate-300 w-40 placeholder:text-slate-400" 
               />
               <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
            </div>

            {/* Floating Search Results */}
            {showSearchResults && searchQuery.length > 0 && (
              <div 
                ref={searchResultsRef}
                className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hasil Pencarian ({searchResults.length})</h4>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                  {searchResults.length > 0 ? (
                    searchResults.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className="w-full text-left flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                          <item.icon size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{item.label}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{item.keywords}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-xs font-bold text-slate-400">Tidak ada hasil ditemukan.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        {/* ── Sticky Navigation Sidebar ── */}
        <div className={cn(
          "lg:col-span-3 lg:sticky lg:top-6 h-fit z-40 transition-all",
          mobileMenuOpen ? "block" : "hidden lg:block"
        )}>
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Terminal size={14} /> Knowledge Base
              </h3>
            </div>
            <nav className="p-3 space-y-1.5 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    "w-full text-left flex items-center justify-between px-5 py-3.5 rounded-2xl text-[13px] font-bold transition-all group",
                    activeSection === item.id
                      ? "bg-blue-600 text-white shadow-xl shadow-blue-500/30 scale-[1.02]"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <span className="flex items-center gap-4">
                    <div className={cn("w-2 h-2 rounded-full transition-all", activeSection === item.id ? "bg-white scale-125" : "bg-slate-300 dark:bg-slate-700 group-hover:bg-blue-400")} />
                    {item.label}
                  </span>
                  <item.icon size={16} className={cn("transition-all", activeSection === item.id ? "text-white opacity-100 rotate-0" : "text-slate-300 dark:text-slate-700 opacity-0 group-hover:opacity-100 -rotate-12")} />
                </button>
              ))}
            </nav>
            <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-center">
               <button className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">Download PDF Manual</button>
            </div>
          </div>
        </div>

        {/* ── Documentation Deep Dive Content ── */}
        <div className="lg:col-span-9 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm p-8 sm:p-14 lg:p-20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600" />
            
            {/* 1. Overview */}
            <DocSection id="pendahuluan" title="Overview Platform" icon={Home}>
              <div className="space-y-6">
                <p className="text-lg text-slate-700 dark:text-slate-300 font-medium leading-relaxed italic">
                  "Satu ekosistem terintegrasi untuk segala kebutuhan evaluasi digital."
                </p>
                <p>
                  EXAM AA bukan sekadar aplikasi ujian online. Ini adalah solusi <strong>End-to-End</strong> yang mengotomatisasi seluruh siklus ujian, mulai dari registrasi peserta, pembuatan bank soal cerdas, monitoring anti-contek, hingga analisis nilai otomatis. 
                </p>
                
                <FeatureGrid items={[
                   { icon: Zap, label: "Performa Instan", desc: "Berbasis Single Page Application yang tidak memerlukan reload halaman.", color: "bg-blue-50 text-blue-600" },
                   { icon: ShieldCheck, label: "Integritas Tinggi", desc: "Sistem pengawasan ketat dengan deteksi pindah tab real-time.", color: "bg-emerald-50 text-emerald-600" },
                   { icon: Bot, label: "AI Powered", desc: "Integrasi LLM untuk pembuatan soal dan ekstraksi materi PDF.", color: "bg-indigo-50 text-indigo-600" },
                   { icon: Globe, label: "Multi-Tenant", desc: "Satu infrastruktur yang aman untuk berbagai institusi berbeda.", color: "bg-amber-50 text-amber-600" }
                ]} />

                <SubSection title="Tujuan Pengembangan">
                  <p>Aplikasi ini dikembangkan untuk menghilangkan hambatan teknis bagi pendidik, sehingga guru dapat fokus sepenuhnya pada kualitas konten ujian tanpa harus direpotkan oleh pengelolaan server atau input data yang membosankan.</p>
                </SubSection>
              </div>
            </DocSection>

            {/* 2. Manajemen Akun */}
            <DocSection id="akun" title="Manajemen Akun" icon={User}>
              <div className="space-y-8">
                <SubSection title="Profil & Keamanan Akun" icon={ShieldCheck}>
                  <p>Setiap pengguna (Admin & Guru) memiliki akses profil pribadi yang dapat diakses melalui menu <Kbd>Profil</Kbd> di pojok kanan atas.</p>
                  <div className="pl-0 sm:pl-4 space-y-4 mt-4">
                     <div className="p-5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/30 dark:bg-slate-900/40">
                        <h6 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white mb-2">Ganti Kata Sandi</h6>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Untuk keamanan data institusi, sangat disarankan mengubah kata sandi default setelah login pertama kali.</p>
                        <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400 italic">
                           <li>• Kata sandi minimal harus terdiri dari 8 karakter.</li>
                           <li>• Gunakan kombinasi huruf besar, kecil, dan angka.</li>
                        </ul>
                     </div>
                  </div>
                </SubSection>

                <SubSection title="Hak Akses Guru (Permissions)" icon={Layers}>
                   <p>Ada dua level akses untuk akun Guru:</p>
                   <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                      <li><strong>Guru Standar:</strong> Hanya dapat mengelola bank soal dan ruang ujian miliknya sendiri.</li>
                      <li><strong>Guru Full Access:</strong> Dapat membantu admin melakukan reset ujian siswa di ruang manapun dan melihat data master tertentu.</li>
                   </ul>
                </SubSection>
              </div>
            </DocSection>

            {/* 3. Data Master */}
            <DocSection id="data-master" title="Data Master & Import" icon={Database}>
              <div className="space-y-8">
                <p>Data Master adalah fondasi utama aplikasi. Pastikan data ini diinput dengan benar sebelum masuk ke tahap pembuatan ujian.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white border-l-4 border-blue-500 pl-3 uppercase tracking-tighter">Mata Pelajaran & Kelas</h4>
                      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">Input list mata pelajaran dan rombongan belajar (kelas). Data ini akan muncul sebagai pilihan dropdown saat Anda membuat bank soal dan paket ujian.</p>
                   </div>
                   <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white border-l-4 border-emerald-500 pl-3 uppercase tracking-tighter">Data Siswa & Guru</h4>
                      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">Input profil siswa lengkap dengan username/NISN. NISN akan digunakan sebagai identitas login siswa yang bersifat unik (tidak boleh duplikat).</p>
                   </div>
                </div>

                <AlertBox type="success" title="Smart Bulk Import">
                  Meningkatkan kecepatan input data ribuan siswa menggunakan Excel:
                  <div className="mt-2 pl-2">
                    1. Unduh template Excel di menu <strong>Siswa &gt; Import</strong>.<br />
                    2. Isi kolom Nama, Username (NISN), dan Kelas sesuai format.<br />
                    3. Klik tombol <strong>Import</strong> dan biarkan sistem memproses secara otomatis.
                  </div>
                </AlertBox>

                <AlertBox type="warning" title="Format Excel">
                  Pastikan kolom NISN di Excel diformat sebagai <strong>Text</strong> (bukan Number/Scientific) agar digit tidak berubah menjadi <em>1.23E+10</em>.
                </AlertBox>
              </div>
            </DocSection>

            {/* 4. Bank Soal */}
            <DocSection id="bank-soal" title="Pengelolaan Bank Soal" icon={BookOpen}>
              <div className="space-y-8">
                <p>Sistem Bank Soal EXAM AA mendukung fleksibilitas konten yang sangat tinggi, mulai dari teks sederhana hingga multimedia kompleks.</p>

                <div className="space-y-2">
                  <Step number="1" title="Konfigurasi Paket">Tentukan Mata Pelajaran dan target Kelas. Paket yang sudah dibuat dapat di-duplikasi (copy) ke tahun ajaran berikutnya.</Step>
                  <Step number="2" title="Rich Text Editor (Quill)">Masukkan teks soal. Gunakan menu <strong>Image</strong> untuk upload gambar pendukung. Untuk rumus matematika, Anda dapat mengetik langsung atau copy-paste dari editor eksternal.</Step>
                  <Step number="3" title="Mode Literasi">Aktifkan switch <strong>Literasi</strong> jika soal memiliki wacana/bacaan yang sama untuk beberapa nomor soal. Bacaan akan muncul secara berdampingan dengan soal di layar siswa.</Step>
                </div>

                <SubSection title="Detail 8 Tipe Soal">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50">
                         <h6 className="text-[11px] font-black text-indigo-600 mb-1">PG & PG KOMPLEKS</h6>
                         <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Pilihan ganda biasa (1 kunci) atau kompleks (boleh memilih lebih dari 1 jawaban benar).</p>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50">
                         <h6 className="text-[11px] font-black text-blue-600 mb-1">MENJODOHKAN</h6>
                         <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Memasangkan premis di kiri dengan respon di kanan menggunakan dropdown interaktif.</p>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50">
                         <h6 className="text-[11px] font-black text-emerald-600 mb-1">URUTKAN (ORDERING)</h6>
                         <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Siswa harus mengurutkan item (teks/gambar) dari atas ke bawah menggunakan drag-and-drop.</p>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50">
                         <h6 className="text-[11px] font-black text-rose-600 mb-1">DRAG & DROP VISUAL</h6>
                         <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Menyeret label jawaban masuk ke dalam area yang kosong pada teks pertanyaan.</p>
                      </div>
                   </div>
                </SubSection>
              </div>
            </DocSection>

            {/* 5. AI Magic & PDF */}
            <DocSection id="ai-magic" title="Teknologi AI & PDF" icon={Bot}>
              <div className="space-y-10">
                <p className="text-base font-medium">EXAM AA menggunakan integrasi <strong>Large Language Models (LLM)</strong> mutakhir untuk mengotomatisasi pembuatan soal dari sumber manapun.</p>

                <div className="space-y-6">
                   <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles size={18} className="text-orange-500" /> Magic AI Generator (Topic-to-Quiz)
                   </h4>
                   <p className="text-sm">Buka menu <strong>Magic AI</strong>, ketik instruksi spesifik. AI akan secara mandiri merangkai soal, pilihan jawaban, hingga analisis kunci jawaban berdasarkan basis pengetahuan yang dimilikinya.</p>
                   <div className="p-5 rounded-2xl bg-orange-50/30 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-800/60">
                      <span className="text-[10px] font-black uppercase text-orange-600 tracking-widest block mb-2">Contoh Prompt Efektif:</span>
                      <p className="text-xs font-mono text-orange-800/80 dark:text-orange-300 italic">"Buatkan 10 soal pilihan ganda tentang Hukum Newton II dengan tingkat kesulitan sulit (HOTS) untuk kelas 11 SMA."</p>
                   </div>
                </div>

                <div className="space-y-6 border-t border-slate-100 dark:border-slate-800 pt-10">
                   <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileBox size={18} className="text-blue-500" /> AI PDF Extraction (Cara Kerja Detail)
                   </h4>
                   <p className="text-sm text-slate-600 dark:text-slate-400">Fitur ini memungkinkan Anda mengubah Buku Paket PDF atau Modul Ajar menjadi bank soal siap pakai.</p>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                         <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">01</div>
                         <h6 className="text-[11px] font-black uppercase tracking-tight">PDF Parsing</h6>
                         <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Sistem memindai setiap halaman PDF dan mengekstrak teks menggunakan teknologi PDF.js.</p>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                         <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">02</div>
                         <h6 className="text-[11px] font-black uppercase tracking-tight">AI Summarization</h6>
                         <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Teks yang diekstrak dianalisis oleh AI untuk menentukan poin-poin materi yang paling esensial.</p>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                         <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">03</div>
                         <h6 className="text-[11px] font-black uppercase tracking-tight">Quiz Formulation</h6>
                         <p className="text-[10px] text-slate-500 leading-relaxed font-medium">AI menyusun butir-butir soal sesuai dengan materi yang benar-benar ada di dalam file PDF tersebut.</p>
                      </div>
                   </div>

                   <AlertBox type="info" title="Format PDF Ideal">
                      Gunakan PDF yang memiliki teks (Selectable Text). PDF hasil foto/scan yang tidak memiliki lapisan teks mungkin akan sulit diekstraksi. Pastikan ukuran file di bawah 10MB untuk kecepatan optimal.
                   </AlertBox>
                </div>
              </div>
            </DocSection>

            {/* 6. Ruang Ujian */}
            <DocSection id="ruang-ujian" title="Siklus Ruang Ujian" icon={ClipboardList}>
              <div className="space-y-8">
                <p>Ruang Ujian adalah tempat Anda mengatur eksekusi ujian bagi siswa.</p>

                <SubSection title="Konfigurasi Waktu & Sesi" icon={Zap}>
                   <ul className="space-y-3 text-sm">
                      <li className="flex gap-4">
                         <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                         <div><strong>Waktu Mulai & Berakhir:</strong> Rentang waktu di mana tombol "Mulai" akan muncul di layar siswa. Jika melewati waktu berakhir, siswa tidak bisa login lagi.</div>
                      </li>
                      <li className="flex gap-4">
                         <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                         <div><strong>Durasi (Menit):</strong> Alokasi waktu pengerjaan sejak siswa klik "Mulai". Countdown akan muncul di pojok atas layar siswa.</div>
                      </li>
                      <li className="flex gap-4">
                         <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                         <div><strong>Universal Token:</strong> Kode akses keamanan 6 digit. Token ini dapat diatur untuk berganti otomatis setiap 5 atau 15 menit melalui menu Pengaturan untuk mencegah kebocoran akses bagi siswa yang terlambat.</div>
                      </li>
                   </ul>
                </SubSection>

                <AlertBox type="info" title="Acak Soal & Opsi">
                   Sistem secara otomatis mengacak nomor soal dan susunan pilihan jawaban (A, B, C, D, E) untuk setiap siswa. Hasilnya, tidak ada dua siswa yang memiliki tampilan ujian yang persis sama, efektif menekan angka kecurangan.
                </AlertBox>
              </div>
            </DocSection>

            {/* 7. Monitoring & Anti-Cheat */}
            <DocSection id="monitoring" title="Anti-Cheat & Pengawasan" icon={Monitor}>
              <div className="space-y-8">
                <p className="text-base font-medium">Sistem Keamanan EXAM AA bekerja di level browser untuk mendeteksi segala bentuk aktivitas mencurigakan.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="p-6 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-2xl space-y-4">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center"><ShieldAlert size={20} /></div>
                      <h6 className="font-bold text-rose-800 dark:text-rose-400">Deteksi Focus Loss</h6>
                      <p className="text-xs text-rose-700/80 dark:text-rose-300/80 leading-relaxed font-medium">Sistem mendeteksi saat siswa berpindah tab browser, membuka aplikasi lain, atau menekan tombol sistem (seperti Windows Key). Kejadian ini akan dicatat sebagai Pelanggaran.</p>
                   </div>
                   <div className="p-6 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-2xl space-y-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><Key size={20} /></div>
                      <h6 className="font-bold text-amber-800 dark:text-amber-400">Otomatis Lock Ujian</h6>
                      <p className="text-xs text-amber-700/80 dark:text-amber-300/80 leading-relaxed font-medium">Setelah batas toleransi (biasanya 1-3 kali), ujian siswa akan terkunci secara otomatis. Siswa tidak bisa melanjutkan ujian hingga statusnya di-reset oleh pengawas.</p>
                   </div>
                </div>

                <SubSection title="Dashboard Pengawasan (Real-time)" icon={Eye}>
                   <p>Melalui menu <strong>Monitoring</strong>, pengawas dapat melihat:</p>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                      <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                         <span className="text-[11px] font-bold">Status pengerjaan & sisa waktu</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                         <div className="w-2 h-2 rounded-full bg-rose-500" />
                         <span className="text-[11px] font-bold">Jumlah pelanggaran tiap siswa</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                         <div className="w-2 h-2 rounded-full bg-blue-500" />
                         <span className="text-[11px] font-bold">Nilai real-time (jika diizinkan)</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                         <div className="w-2 h-2 rounded-full bg-amber-500" />
                         <span className="text-[11px] font-bold">Opsi Buka Kunci / Reset Login</span>
                      </div>
                   </div>
                </SubSection>
              </div>
            </DocSection>

            {/* 8. Laporan & Analisis */}
            <DocSection id="nilai" title="Laporan & Analisis" icon={PieChart}>
              <div className="space-y-8">
                <p>Data nilai diolah secara otomatis oleh sistem sesaat setelah siswa mengklik tombol Selesai.</p>

                <SubSection title="Ekspor ke Excel" icon={FileSpreadsheet}>
                   <p>Semua hasil ujian per ruang dapat diunduh dalam format <Kbd>.xlsx</Kbd> lengkap dengan:</p>
                   <ul className="text-xs sm:text-sm list-disc pl-5 space-y-2 mt-2 text-slate-600 dark:text-slate-400">
                      <li>Skor total dan nilai skala 100.</li>
                      <li>Waktu pengerjaan (start & finish).</li>
                      <li>Rincian jawaban siswa di setiap nomor soal (untuk keperluan analitik butir soal).</li>
                   </ul>
                </SubSection>

                <SubSection title="Analitik Butir Soal" icon={Layers}>
                   <p>Sistem menyediakan data statistik per soal untuk membantu guru mengevaluasi tingkat kesulitan soal. Anda dapat melihat soal mana yang paling banyak salah dijawab oleh siswa sebagai bahan evaluasi pembelajaran di kelas.</p>
                </SubSection>
              </div>
            </DocSection>

            {/* 9. Pengaturan & Backup */}
            <DocSection id="pengaturan" title="Konfigurasi & Backup" icon={Settings}>
              <div className="space-y-10">
                <p>Panel Kontrol utama bagi Administrator untuk mengelola ekosistem aplikasi institusi.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Globe size={20} /></div>
                      <h6 className="font-bold text-slate-900 dark:text-white">Branding & Identitas</h6>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ubah logo sekolah dan nama institusi yang tampil di seluruh antarmuka aplikasi. Gunakan file gambar berformat PNG/JPG transparan untuk hasil terbaik.</p>
                   </div>
                   <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Laptop size={20} /></div>
                      <h6 className="font-bold text-slate-900 dark:text-white">Wajib Exambro (Native App)</h6>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Aktifkan fitur ini jika Anda ingin memaksa siswa hanya bisa login melalui Aplikasi Android/Windows resmi EXAM AA. Login via Chrome/Safari biasa akan diblokir.</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileJson size={20} className="text-emerald-500" /> Manajemen Database JSON
                   </h4>
                   <p className="text-sm">Fitur <strong>Ekspor DB</strong> mengunduh seluruh data (soal, siswa, guru, nilai) ke dalam satu file tunggal. Fitur <strong>Impor DB</strong> digunakan untuk memulihkan data tersebut di kemudian hari.</p>
                   <AlertBox type="danger" title="Peringatan Fatal">
                      Tombol <strong>Format Sistem</strong> akan menghapus seluruh data di database (Kecuali akun admin). Lakukan langkah ini hanya jika Anda ingin memulai tahun ajaran baru dan pastikan sudah memiliki file backup sebelumnya.
                   </AlertBox>
                </div>

                <div className="p-6 bg-slate-900 rounded-[2rem] border border-slate-800 text-white relative overflow-hidden">
                   <Terminal size={100} className="absolute right-0 top-0 opacity-5 rotate-12 -translate-y-6" />
                   <h5 className="font-bold mb-4 flex items-center gap-2 text-indigo-400 uppercase tracking-widest text-xs">
                      <Cpu size={16} /> Konfigurasi AI Engine
                   </h5>
                   <p className="text-xs font-medium text-slate-400 leading-relaxed mb-6">Untuk menggunakan Magic AI & PDF Extraction, Anda harus menghubungkan API Provider eksternal:</p>
                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px] font-black uppercase tracking-tighter">
                      <div className="p-2 border border-slate-800 rounded-xl bg-slate-800/50 text-center">Groq Cloud</div>
                      <div className="p-2 border border-slate-800 rounded-xl bg-slate-800/50 text-center">OpenRouter</div>
                      <div className="p-2 border border-slate-800 rounded-xl bg-slate-800/50 text-center">Google Gemini</div>
                      <div className="p-2 border border-slate-800 rounded-xl bg-slate-800/50 text-center">Ollama (Local)</div>
                   </div>
                </div>
              </div>
            </DocSection>

            {/* 10. Pengembang */}
            <DocSection id="pengembang" title="Tim Pengembang" icon={User}>
              <div className="bg-slate-50 dark:bg-slate-800/30 p-8 sm:p-12 rounded-[3rem] border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center gap-10">
                <div className="w-32 h-44 sm:w-40 sm:h-52 rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white dark:border-slate-700 shrink-0 relative group">
                  <img
                    src="https://www.sman-modalbangsa.sch.id/wp-content/uploads/2021/09/alfaruqasri-300x400.jpeg"
                    alt="Alfaruq Asri"
                    className="w-full h-full object-cover object-[center_15%] transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-blue-600/20 mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-center md:text-left space-y-5">
                  <div>
                    <Badge className="bg-blue-600 text-white border-0 font-black uppercase tracking-widest text-[9px] px-3 mb-4">Master Developer</Badge>
                    <h3 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Alfaruq Asri, S.Pd., Gr.</h3>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2">
                       <Badge variant="outline" className="text-slate-400 border-slate-200 dark:border-slate-800 font-bold text-[9px] px-2 py-0.5 uppercase tracking-tighter">Informatics Engineer</Badge>
                       <Badge variant="outline" className="text-slate-400 border-slate-200 dark:border-slate-800 font-bold text-[9px] px-2 py-0.5 uppercase tracking-tighter">Tim IT {terminology.school}</Badge>
                    </div>
                  </div>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-xl">
                    "EXAM AA hadir untuk mendefinisikan ulang standar ujian sekolah yang modern. Kami mengintegrasikan teknologi AI terbaik untuk memastikan proses evaluasi pendidikan berjalan lebih efektif dan bermartabat."
                  </p>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <a href="https://wa.me/6285359907696" target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2">
                       <MessageCircle size={16} /> WhatsApp IT Support
                    </a>
                    <a href="https://www.alfaruqasri.my.id/" target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2">
                       <Globe size={16} /> Portofolio
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-16 pt-10 border-t border-slate-200 dark:border-slate-800 text-center space-y-4">
                <div className="flex items-center justify-center gap-3">
                   <div className="w-12 h-[1px] bg-slate-200 dark:bg-slate-800" />
                   <Badge variant="outline" className="text-slate-400 border-slate-200 dark:border-slate-800 font-black uppercase tracking-[0.2em] px-5 py-2 text-[10px]">
                     EXAM AA Platform Hub
                   </Badge>
                   <div className="w-12 h-[1px] bg-slate-200 dark:bg-slate-800" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-tighter">
                  © 2026 Alfaruq Asri. Hak Cipta Dilindungi Undang-Undang. Dokumentasi ini bersifat internal institusi.
                </p>
              </div>
            </DocSection>

          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidePage;
