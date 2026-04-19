import React, { useState } from "react";
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
  Code,
  Image as ImageIcon,
  ChevronRight,
  Menu,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";

const GuidePage = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("pendahuluan");

  const NAV_ITEMS = [
    { id: "pendahuluan", label: "Pendahuluan", color: "bg-blue-500", icon: Home },
    { id: "bank-soal", label: "Bank Soal", color: "bg-indigo-500", icon: BookOpen },
    { id: "ruang-ujian", label: "Ruang Ujian", color: "bg-emerald-500", icon: ClipboardList },
    { id: "data-master", label: "Data Master", color: "bg-amber-500", icon: LayoutTemplate },
    { id: "monitoring", label: "Anti-Cheat", color: "bg-rose-500", icon: Monitor },
    { id: "sistem", label: "Sistem", color: "bg-slate-500", icon: Settings },
    { id: "pengembang", label: "Pengembang", color: "bg-blue-600", icon: User }
  ];

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-6 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        {/* Background blobs for header */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
            <BookOpen size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Panduan Sistem
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Dokumentasi operasional terpadu E-Ujian.
            </p>
          </div>
        </div>

        {/* Mobile Navigation Toggle */}
        <button 
          className="lg:hidden relative z-10 flex items-center justify-between px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 transition-all active:scale-95"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span className="flex items-center gap-2">
            {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            Daftar Isi
          </span>
          <Badge className="bg-blue-600 text-white hover:bg-blue-700 pointer-events-none text-[10px] uppercase font-black px-2 ml-2">Menu</Badge>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 relative">
        {/* ── Sidebar Navigation ── */}
        <div className={cn(
          "lg:col-span-1 lg:sticky lg:top-24 h-fit space-y-4 lg:space-y-6 transition-all duration-300",
          mobileMenuOpen ? "block" : "hidden lg:block"
        )}>
          <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <LayoutTemplate size={14} /> Daftar Isi
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <nav className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      "w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group",
                      activeSection === item.id 
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon size={16} className={cn("transition-colors", activeSection === item.id ? "text-blue-600 dark:text-blue-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-400")} />
                      {item.label}
                    </span>
                    <ChevronRight size={14} className={cn("transition-transform", activeSection === item.id ? "text-blue-500 opacity-100" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0")} />
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>

          <div className="hidden lg:block p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <AlertCircle size={64} className="rotate-12" />
             </div>
             <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                <AlertCircle size={16} className="text-blue-200" /> Bantuan Teknis
             </h4>
             <p className="text-[11px] text-blue-100/90 leading-relaxed relative z-10 font-medium">
                Jika mengalami kendala operasional, hubungi administrator atau tim IT Sekolah.
             </p>
          </div>
        </div>

        {/* ── Content Section ── */}
        <div className="lg:col-span-3 space-y-12 lg:space-y-16">
          
          {/* Pendahuluan */}
          <section id="pendahuluan" className="scroll-mt-32 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <Home size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">1. Pendahuluan</h2>
            </div>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              E-Ujian adalah platform Computer Based Test (CBT) generasi terbaru yang dirancang untuk stabilitas dan keamanan tinggi. Sistem ini menyediakan alur kerja yang intuitif untuk Guru dan Administrator dalam mengelola evaluasi belajar mandiri.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-all">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ShieldAlert size={20} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-3">Administrator</h4>
                <ul className="text-xs space-y-2.5 text-slate-500 dark:text-slate-400">
                  <li className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span>Manajemen Data Master (Siswa, Kelas, Guru)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span>Konfigurasi identitas sekolah & logo</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span>Kontrol keamanan akun & pencadangan data</span>
                  </li>
                </ul>
              </div>
              <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-all">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-3">Guru Mata Pelajaran</h4>
                <ul className="text-xs space-y-2.5 text-slate-500 dark:text-slate-400">
                  <li className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>Pembuatan Bank Soal secara mandiri</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>Aktivasi Ruang Ujian & Pengaturan Sesi</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>Monitoring Siswa secara real-time</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Bank Soal */}
          <section id="bank-soal" className="scroll-mt-32 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <BookOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">2. Manajemen Bank Soal</h2>
            </div>
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
              <div className="divide-y divide-slate-100 dark:divide-slate-800 flex flex-col">
                {[
                  { char: "A", title: "Pembuatan Paket", desc: "Buat paket soal melalui tombol Tambah Paket Soal. Isi nama paket dan atur ketersediaan akses tingkat kelas." },
                  { char: "B", title: "Input Pertanyaan", desc: "Berbagai tipe tersedia (Pilihan Ganda, Essay, Menjodohkan). Editor Teks Kaya mendukung gambar dan format penuh." },
                  { char: "C", title: "Generate via AI", desc: "Buat soal dalam detik menggunakan integrasi Kecerdasan Buatan. Cukup ketik topik kompetensi dasar." }
                ].map((step) => (
                  <div key={step.char} className="p-5 flex items-start sm:items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-800/40">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{step.char}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1.5">{step.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{step.desc}</p>
                    </div>
                  </div>
                ))}
                
                {/* Info Literasi Alert style */}
                <div className="p-5 bg-blue-50/50 dark:bg-blue-900/10">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <Badge className="bg-blue-600 text-white border-0 px-2.5 py-0.5 text-[10px] uppercase font-black uppercase shrink-0">Wacana / Literasi</Badge>
                    <p className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">
                      Gunakan <span className="font-black bg-blue-100 dark:bg-blue-800/50 px-1 rounded mx-0.5">ID Grup</span> yang identik untuk mengelompokkan soal ke dalam satu wacana. Teks bacaan wacana cukup diisi pada butir soal pertama.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* Ruang Ujian */}
          <section id="ruang-ujian" className="scroll-mt-32 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <ClipboardList size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">3. Operasional Ruang Ujian</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Settings size={14} className="text-slate-400" /> Parameter Sesi
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-4">
                  {[
                    { label: "Nama Ruang", desc: "Identitas ruangan (Contoh: VIII-A Sesi Pagi)" },
                    { label: "Waktu Berlaku", desc: "Batas rentang kapan ujian dapat diakses" },
                    { label: "Durasi Aktif", desc: "Total alokasi pengerjaan dalam satuan menit" }
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-1.5 shrink-0" />
                      <div>
                        <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</h5>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Key size={14} className="text-slate-400" /> Aksesabilitas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-4">
                  {[
                    { label: "Universal Token", desc: "Refresh otomatis tiap 5 menit untuk akses awal kelas" },
                    { label: "Target Kelas", desc: "Pembatasan khusus bagi rombongan belajar tertentu" },
                    { label: "Acak Soal & Opsi", desc: "Pengurutan unik dan acak otomatis tiap peserta" }
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-1.5 shrink-0" />
                      <div>
                        <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</h5>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Anti-Cheat */}
          <section id="monitoring" className="scroll-mt-32 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <Monitor size={20} className="text-rose-600 dark:text-rose-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">4. Sistem Anti-Cheat</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 rounded-2xl shadow-sm relative overflow-hidden flex flex-col sm:flex-row gap-5 items-start">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-500 flex items-center justify-center shrink-0 border border-red-100 dark:border-red-800/40 relative z-10">
                  <ShieldAlert size={24} />
                </div>
                <div className="relative z-10">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Deteksi Pindah Tab (Lock System)</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    E-Ujian memantau status fokus browser siswa secara ketat. Jika siswa terdeteksi beralih ke aplikasi lain atau membuka tab baru, sistem akan mencatat sebagai pelanggaran. Melebihi batas pelanggaran akan menyebabkan <span className="font-bold text-red-600 dark:text-red-400 uppercase">ujian terkunci otomatis</span>.
                  </p>
                </div>
              </div>
              
              <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-5 items-start">
                <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
                  <Key size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Membuka Kunci & Selesaikan Paksa</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    Gunakan dashboard Pengawasan Ruang (Menu Monitoring) untuk membuka kunci siswa yang ter-lock atau mengatur ulang (reset) login siswa. Guru juga dapat menggunakan <span className="font-semibold italic">Selesaikan Paksa</span> bila sesi waktu ujian dirasa telah paripurna namun siswa lupa klik tombol Selesai.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Master Data */}
          <section id="data-master" className="scroll-mt-32 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <LayoutTemplate size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">5. Manajemen Data Master</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="space-y-3">
                {[
                  { icon: GraduationCap, label: "Database Peserta Didik", count: "Tabel Siswa" },
                  { icon: Users, label: "Database Tenaga Pendidik", count: "Tabel Guru" },
                  { icon: Award, label: "Database Mata Pelajaran", count: "Tabel Mapel" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 flex items-center justify-center flex-shrink-0">
                        <item.icon size={16} />
                      </div>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] text-slate-400 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">{item.count}</Badge>
                  </div>
                ))}
              </div>

              <Card className="rounded-2xl border-dashed border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 shadow-none">
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Download size={14} /> Aturan Import Excel
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-2">
                  <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
                    <li className="flex gap-3 items-start">
                      <span className="font-black text-slate-400">1</span>
                      Gunakan template standar resmi dengan klik tombol <b>Unduh Template</b>.
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="font-black text-slate-400">2</span>
                      Hindari merubah struktur kolom (header) atau urutannya.
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="font-black text-slate-400">3</span>
                      Validasi kode unik (NISN, NIP) jangan sampai berubah format scientific (contoh 1.2E+). Pastikan format kolom teks.
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="font-black text-slate-400">4</span>
                      Setiap baris yang sama persis (ID/Username) akan ditimpa jika sudah ada.
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Sistem */}
          <section id="sistem" className="scroll-mt-32 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
                <Settings size={20} className="text-slate-700 dark:text-slate-300" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">6. Konfigurasi Lingkungan</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">Identitas Visual Sekolah</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">Unggah logo dan nama institusi Anda dari panel Pengaturan. Ini akan dipakai untuk tampilan antarmuka murid serta laporan PDF.</p>
                  </div>
                </div>
                
                <div className="flex gap-4 border-t border-slate-100 dark:border-slate-800 pt-5">
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                    <Cpu size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">Model LLM Generatif AI</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">Pengaturan kunci API dari penyedia (Groq atau Ollama) beserta pilihan model yang digunakkan saat melakukan generasi soal otomatis.</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-indigo-600 dark:bg-slate-800 border fill-slate-200 dark:border-slate-700 rounded-2xl shadow-sm text-white overflow-hidden relative">
                <Database size={100} className="absolute right-0 top-1/2 -translate-y-1/2 opacity-10 text-white" />
                <h4 className="text-sm font-bold uppercase tracking-widest text-indigo-200 dark:text-slate-400 mb-4 flex items-center gap-2">
                  <Database size={16} /> Pencadangan Data
                </h4>
                <div className="space-y-4 relative z-10 text-xs font-medium text-indigo-50 dark:text-slate-300 leading-relaxed">
                  <p>
                    Opsi Ekspor pada menu pengaturan akan melakukan penyalinan seluruh data tabel base (termasuk soal, kelas, peserta, dan pengaturan) ke dalam satu file tunggal <span className="bg-indigo-700 dark:bg-slate-900 px-1 rounded font-mono">.json</span>.
                  </p>
                  <ul className="space-y-2 mt-4 opacity-90 pl-4 list-disc marker:text-indigo-400">
                    <li>Gunakan fitur ini secara rutin setiap semester.</li>
                    <li>Jangan melakukan modifikasi isi JSON jika berniat dipulihkan.</li>
                    <li>Sandi reset pada menu Impor akan diubah menjadi <span className="font-bold border-b border-white">12345678</span>.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Pengembang */}
          <section id="pengembang" className="scroll-mt-32 pt-6">
            <Card className="rounded-[2.5rem] border-0 bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-indigo-950/30 dark:to-slate-950 shadow-none overflow-hidden relative">
               <div className="pointer-events-none absolute inset-0 rounded-[2.5rem] ring-1 ring-inset ring-slate-200/50 dark:ring-white/5" />
               <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[80px] -mr-48 -mt-48 transition-opacity duration-1000" />
               <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[80px] -ml-48 -mb-48 transition-opacity duration-1000" />

               <CardContent className="p-8 sm:p-12 relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                  {/* Foto Profil */}
                  <div className="flex flex-col items-center gap-4 flex-shrink-0">
                     <div className="w-36 h-48 sm:w-40 sm:h-56 rounded-3xl border-4 border-white/60 dark:border-white/10 overflow-hidden shadow-xl bg-white/20 dark:bg-slate-800">
                        <img 
                          src="https://www.sman-modalbangsa.sch.id/wp-content/uploads/2021/09/alfaruqasri-300x400.jpeg" 
                          alt="Alfaruq Asri" 
                          className="w-full h-full object-cover object-[center_15%]"
                        />
                     </div>
                     <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-black uppercase tracking-widest text-[9px] px-3">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                       Lead Developer
                     </Badge>
                  </div>

                  {/* Biodata */}
                  <div className="text-center md:text-left space-y-5">
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-3">
                        Alfaruq Asri, S.Pd., Gr.
                      </h3>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                         {["Informatics Engineer", "Tim IT Sekolah", "SMA Negeri Modal Bangsa Aceh"].map((bLabel, idx) => (
                           <Badge key={idx} variant="secondary" className="bg-white/60 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 pointer-events-none text-[10px] uppercase font-bold tracking-wider">{bLabel}</Badge>
                         ))}
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium max-w-2xl">
                      "Platform E-Ujian ini adalah karya dedikasi untuk simplifikasi digitalisasi madrasah dan sekolahan. Dibangun dengan PocketBase mutakhir dan React demi stabilitas tinggi."
                    </p>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
                       <a 
                         href="https://www.alfaruqasri.my.id/" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm"
                       >
                         <Globe size={16} className="text-blue-600 dark:text-blue-400" /> Web Portofolio
                       </a>
                       <a 
                         href="https://wa.me/6285359907696" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-xl transition-all shadow-sm"
                       >
                         <MessageCircle size={16} className="fill-current text-opacity-80" /> Hubungi via WhatsApp
                       </a>
                    </div>
                  </div>
               </CardContent>
            </Card>
          </section>

          <div className="flex flex-col items-center justify-center pt-8 border-t border-slate-200 dark:border-slate-800 text-center gap-4">
             <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 border-0 font-black uppercase tracking-[0.2em] px-4 py-1.5 text-[9px]">
               E-Ujian Platform • Build 2026
             </Badge>
             <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-600">
               © {new Date().getFullYear()} Hak Cipta Dilindungi Undang-Undang.
             </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default GuidePage;
