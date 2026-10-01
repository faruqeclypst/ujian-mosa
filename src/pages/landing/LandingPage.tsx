import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap, Monitor, BarChart3, Shield, Users, Zap,
  ArrowRight, CheckCircle, Building2, Menu, X, Globe, Star, Wand2, MessageCircle, Phone,
  Check, AlertCircle
} from "lucide-react";
import { cn } from "../../lib/utils";
import { getDomainSuffix } from "../../utils/domainHelper";

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    { icon: Monitor, title: "Ujian CBT Stabil", desc: "Sistem ujian online yang dioptimasi agar lancar diakses ratusan siswa serentak tanpa server down.", color: "text-blue-600 bg-blue-50 border-blue-100" },
    { icon: BarChart3, title: "Nilai & Analisis Otomatis", desc: "Hasil ujian langsung dihitung otomatis. Tersedia analitik butir soal untuk evaluasi guru.", color: "text-violet-600 bg-violet-50 border-violet-100" },
    { icon: Shield, title: "Cegah Menyontek", desc: "Fitur wajib fullscreen, pencegahan buka tab lain, dan kunci ujian otomatis jika melanggar.", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
    { icon: Wand2, title: "AI Question Generator", desc: "Buat soal berkualitas dalam hitungan detik dengan bantuan AI. Hemat waktu persiapan ujian hingga 90%.", color: "text-amber-600 bg-amber-50 border-amber-100" },
    { icon: Zap, title: "Zero Maintenance", desc: "Sekolah tidak perlu sewa server atau urus teknis. Semuanya sudah kami kelola sepenuhnya.", color: "text-rose-600 bg-rose-50 border-rose-100" },
    { icon: Building2, title: "Identitas Sekolah", desc: "Siswa mengakses link ujian khusus dengan logo dan nama sekolah Anda sendiri.", color: "text-cyan-600 bg-cyan-50 border-cyan-100" },
  ];

  const testimonials = [
    {
      name: "Bapak Said",
      role: "Waka Kurikulum",
      school: "SMA Negeri Modal Bangsa Aceh",
      content: "Platform EXAM AA sangat membantu kami dalam pelaksanaan ujian sekolah. Servernya stabil meskipun diakses oleh ratusan siswa secara bersamaan. Fitur anti-conteknya juga sangat efektif.",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Said"
    },
    {
      name: "Ibu Rahma",
      role: "Guru IT",
      school: "SMK Negeri 1 Banda Aceh",
      content: "Dulu kami kesulitan mengelola bank soal, sekarang dengan fitur AI Generator dan import Word, persiapan ujian jadi jauh lebih cepat dan efisien.",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rahma"
    },
    {
      name: "Pak Budi",
      role: "Kepala Sekolah",
      school: "SMA Swasta Unggul",
      content: "Analisis nilainya sangat detail. Kami bisa langsung melihat statistik butir soal untuk evaluasi pembelajaran guru di kelas. Sangat direkomendasikan!",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Budi"
    }
  ];

  const techStackRow1 = [
    { name: "React", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" },
    { name: "TypeScript", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" },
    { name: "Tailwind CSS", logo: "https://www.vectorlogo.zone/logos/tailwindcss/tailwindcss-icon.svg" },
    { name: "Vite", logo: "https://vitejs.dev/logo.svg" },
    { name: "Bun", logo: "https://bun.sh/logo.svg" },
    { name: "Zod", logo: "https://raw.githubusercontent.com/colinhacks/zod/master/logo.svg" },
  ];

  const techStackRow2 = [
    { name: "PocketBase", logo: "https://pocketbase.io/images/logo.svg" },
    { name: "Capacitor", logo: "https://icon.icepanel.io/Technology/svg/Capacitor.svg" },
    { name: "Framer Motion", logo: "https://framerusercontent.com/images/Io89FonxEaWg4nxvQQllVLwPUUI.png" },
    { name: "Radix UI", logo: "https://avatars.githubusercontent.com/u/75042455?s=200&v=4" },
    { name: "Lucide", logo: "https://lucide.dev/logo.light.svg" }
  ];

  const plans = [
    {
      name: "Paket Berkembang",
      price: "160.000",
      oldPrice: "200.000",
      discountBadge: "Hemat 20%",
      period: "/ bulan",
      desc: "Untuk SD, SMP, & bimbingan belajar",
      quota: "Maks. 250 Siswa",
      features: [
        "Ujian CBT (8 Tipe Soal Lengkap)",
        "Import Word, Excel & Generator AI",
        "APK Kiosk Kunci Layar (Anti-Contek)",
        "Monitoring Peserta Real-time",
        "Bantuan Teknis via WhatsApp"
      ],
      cta: "Pilih Paket Berkembang",
      highlight: false,
      comingSoon: false,
    },
    {
      name: "Paket Lanjutan",
      price: "280.000",
      oldPrice: "350.000",
      discountBadge: "Hemat 20%",
      period: "/ bulan",
      desc: "Standar ideal SMP & SMA/SMK",
      quota: "Maks. 500 Siswa",
      features: [
        "Semua fitur di Paket Berkembang",
        "Server Cloud Kapasitas Medium",
        "Analisis Butir Soal & Ekspor Nilai",
        "Custom Subdomain (sekolah.examku.my.id)",
        "Pelatihan Guru & Admin via Zoom"
      ],
      cta: "Pilih Paket Lanjutan",
      highlight: true,
      comingSoon: false,
    },
    {
      name: "Paket Premium",
      price: "480.000",
      oldPrice: "600.000",
      discountBadge: "Hemat 20%",
      period: "/ bulan",
      desc: "Sekolah besar, yayasan, & kampus",
      quota: "Maks. 1.000 Siswa",
      features: [
        "Semua fitur di Paket Lanjutan",
        "Resource Server Prioritas Tinggi",
        "Dukungan Custom Domain Sekolah",
        "Bank Soal Terpusat Antar Guru",
        "Dukungan Teknis Prioritas Saat Ujian"
      ],
      cta: "Pilih Paket Premium",
      highlight: false,
      comingSoon: false,
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-[1440px] mx-auto px-8 sm:px-12 lg:px-20 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <GraduationCap size={18} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">EXAM AA</span>
            <span className="hidden sm:inline text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Ujian Anti Ribet</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-slate-100"
            >
              Fitur
            </button>
            <button
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-slate-100"
            >
              Harga
            </button>
            <button
              onClick={() => document.getElementById("testimonials")?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-slate-100"
            >
              Testimoni
            </button>
            <button
              onClick={() => navigate("/daftar")}
              className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all shadow-sm hover:shadow-md active:scale-95 ml-2"
            >
              Mulai Gratis
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200 px-4 py-3 space-y-1">
            <button
              onClick={() => { document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }); setMobileMenuOpen(false); }}
              className="w-full text-left text-sm font-medium text-slate-700 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Fitur Platform
            </button>
            <button
              onClick={() => { document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }); setMobileMenuOpen(false); }}
              className="w-full text-left text-sm font-medium text-slate-700 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Paket Harga
            </button>
            <button
              onClick={() => { document.getElementById("testimonials")?.scrollIntoView({ behavior: "smooth" }); setMobileMenuOpen(false); }}
              className="w-full text-left text-sm font-medium text-slate-700 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Testimoni
            </button>

            <button
              onClick={() => navigate("/daftar")}
              className="w-full text-sm font-semibold bg-blue-600 text-white px-4 py-3 rounded-xl transition-all"
            >
              Daftarkan Sekolah Sekarang
            </button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-6 sm:px-10 lg:px-16 z-10 overflow-hidden">
        {/* Subtle grid background - Only in Hero */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:32px_32px] z-0" />

        {/* Blue glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative max-w-7xl mx-auto text-center py-20">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-full px-4 py-1.5 mb-8 hover:border-blue-300 transition-colors cursor-default">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-600 text-sm font-medium">Platform CBT Anti Curang</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tight mb-6 text-slate-900">
            Platform Ujian Sekolah <br />
            <span className="relative inline-block mt-2">
              <span className="text-blue-600">Terpercaya</span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6C40 2 80 2 100 4C120 6 160 4 198 2" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
              </svg>
            </span>{" "}
            & Profesional
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-slate-500 max-w-3xl mx-auto mb-10 leading-relaxed font-medium">
            {/* Telah dipercayai oleh <span className="text-blue-600 font-bold">SMA Negeri Modal Bangsa</span> dan berbagai sekolah unggulan lainnya untuk menyelenggarakan ujian CBT yang aman, stabil, dan otomatis. */}
            EXAM AA membantu <span className="text-blue-600 font-bold">sekolah / universitas (umum)</span> mengadakan pelaksanaan ujian online dengan lancar. Tidak ada lagi kendala teknis atau aplikasi down saat ujian berlangsung.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate("/daftar")}
              className="group flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 sm:h-14 px-6 sm:px-8 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/25 text-sm sm:text-base active:scale-95"
            >
              Daftar Gratis Sekarang
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="flex items-center justify-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold h-12 sm:h-14 px-6 sm:px-8 rounded-xl transition-all hover:border-slate-400 text-sm sm:text-base"
            >
              Lihat Fitur
            </button>
          </div>

          {/* Browser URL preview */}
          <div className="mx-auto mt-12 w-full max-w-sm bg-white border border-slate-200 shadow-md rounded-xl p-3 text-left relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600" />
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm font-mono text-slate-500 flex items-center">
              <Globe size={12} className="text-slate-400 flex-shrink-0 mr-2" />
              <span className="text-slate-900 font-bold">sekolahanda</span>
              <span className="text-slate-500">{getDomainSuffix()}</span>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="mt-8 flex items-center justify-center gap-6 flex-wrap">
            {["Tanpa Ikatan Kontrak", "Setup < 24 Jam", "Support via WhatsApp"].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <CheckCircle size={13} className="text-emerald-500" />
                {item}
              </div>
            ))}
          </div>

          {/* School Partner Logo Bar */}
          <div className="mt-20 pt-10 border-t border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">Telah Dipercayai Oleh</p>
            <div className="flex flex-wrap justify-center items-center gap-10 opacity-80 grayscale hover:grayscale-0 transition-all duration-500">
              <div className="flex flex-col items-center gap-3">
                <img
                  src="https://cdn.alfaruqasri.my.id/assets/modalbangsa.png"
                  alt="SMA Negeri Modal Bangsa"
                  className="h-16 w-auto object-contain"
                />
                <span className="font-bold text-slate-400 text-[10px] uppercase tracking-widest text-center">SMAN Modal Bangsa</span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <img
                  src="https://cdn.alfaruqasri.my.id/assets/SMA%20Negeri%2011%20Tangerang%20Selatan.webp"
                  alt="SMA Negeri Modal Bangsa"
                  className="h-16 w-auto object-contain"
                />
                <span className="font-bold text-slate-400 text-[10px] uppercase tracking-widest text-center">SMAN 11 Tangerang Selatan</span>
              </div>
              {/* Add more as text/placeholders if no other logos are available */}
              {/* <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-400 text-sm shadow-inner">SMK</div>
                <span className="font-bold text-slate-400 text-[10px] uppercase tracking-widest text-center">SMKN 1 Banda Aceh</span>
              </div> */}
              {/* <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-400 text-sm shadow-inner">SMA</div>
                <span className="font-bold text-slate-400 text-[10px] uppercase tracking-widest text-center">SMA Fatih Billingual</span>
              </div> */}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 sm:py-32 px-6 sm:px-10 lg:px-16 relative z-10 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wider">
              <Star size={12} /> Fitur Unggulan
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-6 text-slate-900 leading-tight">Kenapa EXAM AA Cocok untuk Sekolah Anda?</h2>
            <p className="text-slate-500 text-base max-w-2xl mx-auto font-medium">
              Dirancang berdasarkan masukan ratusan guru. Siapapun bisa menggunakannya dengan mudah.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 hover:border-blue-200 hover:shadow-lg transition-all duration-300 group"
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 border", f.color)}>
                  <f.icon size={20} />
                </div>
                <h3 className="font-bold text-base mb-2 text-slate-900 group-hover:text-blue-700 transition-colors">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Marquee */}
      <section className="py-16 bg-white overflow-hidden border-y border-slate-50 relative">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white to-transparent z-10" />

        <div className="flex flex-col items-center mb-16 px-6">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wider">
            ⚡ Teknologi
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-tight text-center max-w-3xl">Teknologi Modern di Balik <span className="text-blue-600">EXAM AA</span></h2>
          <p className="mt-6 text-slate-500 text-base max-w-2xl mx-auto font-medium text-center">
            Demi aplikasi yang stabil, kami mengembangkan sistem CBT dan Website dengan stack teknologi terkini untuk memastikan performa maksimal, keamanan data yang tinggi, dan pengalaman ujian yang mulus bagi seluruh siswa.
          </p>
        </div>

        <div className="space-y-12">
          {/* Row 1: To the Left */}
          <div className="flex w-max animate-marquee whitespace-nowrap gap-24 items-center">
            {[...techStackRow1, ...techStackRow1, ...techStackRow1, ...techStackRow1].map((tech, i) => (
              <div key={i} className="flex items-center gap-4 transition-all duration-300 group">
                <img
                  src={tech.logo}
                  alt={tech.name}
                  className="h-10 w-auto grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500 transform group-hover:scale-110"
                />
                <span className="text-xl font-black text-slate-300 group-hover:text-slate-900 transition-all duration-500 tracking-tighter">
                  {tech.name}
                </span>
              </div>
            ))}
          </div>

          {/* Row 2: To the Right */}
          <div className="flex w-max animate-marquee-reverse whitespace-nowrap gap-24 items-center">
            {[...techStackRow2, ...techStackRow2, ...techStackRow2, ...techStackRow2].map((tech, i) => (
              <div key={i} className="flex items-center gap-4 transition-all duration-300 group">
                <img
                  src={tech.logo}
                  alt={tech.name}
                  className="h-10 w-auto grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500 transform group-hover:scale-110"
                />
                <span className="text-xl font-black text-slate-300 group-hover:text-slate-900 transition-all duration-500 tracking-tighter">
                  {tech.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 sm:py-32 px-6 sm:px-10 lg:px-16 relative z-10 bg-white border-t border-slate-100 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          <div className="flex-1 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full mb-6 uppercase tracking-wider">
              <CheckCircle size={12} /> Terpercaya
            </div>
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-6 text-slate-900 leading-tight">Memudahkan Guru, Melancarkan Nilai Siswa</h3>
            <p className="text-slate-500 text-base mb-8 leading-relaxed font-medium">
              Dari penyusunan naskah ujian, pelaksanaan di lab atau kelas, hingga mencetak hasil evaluasi yang siap ditarik ke laporan rapor.
            </p>
            <ul className="space-y-4">
              {[
                "Kehandalan server dimonitor tim teknis 24/7",
                "Privasi dan keamanan bank soal terjamin",
                "Navigasi minimalis dan ramah pengguna",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-700 font-medium text-sm">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={14} className="text-emerald-600" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate("/daftar")}
              className="mt-8 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-bold text-sm hover:underline underline-offset-4"
            >
              Mulai Daftarkan Sekarang <ArrowRight size={16} />
            </button>
          </div>
          <div className="flex-1 w-full max-w-2xl relative group">
            {/* Decorative elements behind image */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>

            <div className="relative bg-white border border-slate-200 rounded-[2rem] p-2 shadow-2xl overflow-hidden">
              <img
                src="https://cdn.alfaruqasri.my.id/schools/modalbangsa/identity/2026-04-21T08-17-30-489Z-screenshot-1514-.png"
                alt="EXAM AA Dashboard Preview"
                className="w-full h-auto rounded-[1.8rem] shadow-sm transform group-hover:scale-[1.01] transition-transform duration-500"
              />

              {/* Label Overlay */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-slate-200/50 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Preview Dashboard EXAM AA</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 sm:py-32 px-6 sm:px-10 lg:px-16 relative z-10 bg-slate-50 overflow-hidden">
        {/* Decorative Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/50 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-50/50 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wider">
              <MessageCircle size={12} /> Testimoni
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-6 text-slate-900 leading-tight">Apa Kata Mereka Tentang EXAM AA?</h2>
            <p className="text-slate-500 text-base max-w-2xl mx-auto font-medium">
              Telah digunakan oleh berbagai sekolah unggulan untuk meningkatkan kualitas evaluasi pembelajaran.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div key={i} className="group bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-600/10 transition-all duration-500 flex flex-col justify-between relative overflow-hidden">
                {/* Accent line on hover */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />

                <div>
                  <div className="flex gap-1 text-amber-400 mb-6">
                    {[...Array(5)].map((_, j) => <Star key={j} size={16} fill="currentColor" />)}
                  </div>
                  <p className="text-slate-600 italic mb-8 leading-relaxed font-medium relative z-10">
                    "{t.content}"
                  </p>
                </div>
                <div className="flex items-center gap-4 border-t border-slate-50 pt-6">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner group-hover:scale-110 transition-transform duration-500">
                    <img src={t.image} alt={t.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{t.name}</h4>
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">{t.role}</p>
                    <p className="text-[11px] text-slate-400 font-medium">{t.school}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 sm:py-32 px-6 sm:px-10 lg:px-16 relative z-10 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3.5 py-1.5 rounded-full mb-4 uppercase tracking-wider">
              🏷️ 20% Lebih Hemat dari Pasar CBT
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-3 text-slate-900">
              Biaya Operasional Jelas, Lebih Hemat 20%
            </h2>
            <p className="text-slate-600 text-base max-w-2xl mx-auto font-medium">
              Dibandingkan rata-rata biaya platform CBT sekolah di Indonesia, EXAM AA memberikan harga 20% lebih terjangkau dengan server cloud yang dikelola penuh dan zero maintenance.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={cn(
                  "relative rounded-2xl border p-6 sm:p-8 transition-all duration-300 flex flex-col justify-between",
                  plan.highlight
                    ? "bg-blue-600 border-blue-500 shadow-2xl shadow-blue-600/30 md:-translate-y-3 text-white"
                    : "bg-white border-slate-200 shadow-sm hover:shadow-md"
                )}
              >
                <div>
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-950 text-[10px] font-black px-4 py-1 rounded-full shadow whitespace-nowrap uppercase tracking-wider">
                      ⭐ Paling Diminati
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-1">
                    <h3 className={cn("font-bold text-lg", plan.highlight ? "text-white" : "text-slate-900")}>
                      {plan.name}
                    </h3>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-md",
                      plan.highlight
                        ? "bg-blue-500 text-white border border-blue-400"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    )}>
                      {plan.discountBadge}
                    </span>
                  </div>
                  <p className={cn("text-sm mb-5", plan.highlight ? "text-blue-100" : "text-slate-500")}>
                    {plan.desc}
                  </p>

                  <div className="flex flex-col mb-5">
                    {plan.oldPrice && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-sm font-semibold line-through decoration-rose-500 decoration-2", plan.highlight ? "text-blue-200/80" : "text-slate-400")}>
                          Rp {plan.oldPrice}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white uppercase tracking-wider">
                          Pasar Normal
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn("text-xs font-bold mr-1", plan.highlight ? "text-blue-200" : "text-slate-500")}>Rp</span>
                      <span className={cn("text-3xl sm:text-4xl font-black tracking-tight", plan.highlight ? "text-white" : "text-slate-900")}>
                        {plan.price}
                      </span>
                      <span className={cn("text-xs font-semibold", plan.highlight ? "text-blue-200" : "text-slate-400")}>{plan.period}</span>
                    </div>
                  </div>

                  <div className={cn(
                    "inline-block rounded-lg px-3 py-1 text-xs font-bold mb-6 border",
                    plan.highlight
                      ? "bg-blue-500/40 text-blue-100 border-blue-400"
                      : "bg-blue-50 text-blue-700 border-blue-100"
                  )}>
                    {plan.quota}
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feat, j) => (
                      <li key={j} className={cn("flex items-center gap-2.5 text-sm font-medium", plan.highlight ? "text-blue-100" : "text-slate-700")}>
                        <CheckCircle size={16} className={plan.highlight ? "text-blue-300 flex-shrink-0" : "text-blue-600 flex-shrink-0"} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => navigate("/daftar", { state: { selectedPlan: plan.name } })}
                  className={cn(
                    "w-full h-11 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                    plan.highlight
                      ? "bg-white text-blue-700 hover:bg-blue-50 shadow-lg hover:shadow-xl active:scale-95"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md active:scale-95"
                  )}
                >
                  {plan.cta}
                  <ArrowRight size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Free Trial Callout */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 mb-16 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={24} />
              </div>
              <div>
                <div className="inline-block bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-1">
                  Uji Coba Tanpa Risiko
                </div>
                <h3 className="text-lg font-bold text-slate-900">Ingin Menguji Sistem Terlebih Dahulu?</h3>
                <p className="text-sm text-slate-600 max-w-xl font-medium mt-0.5">
                  Dapatkan akses simulasi gratis hingga 50 siswa untuk mencoba kestabilan ujian dan aplikasi kunci layar APK di sekolah Anda.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/daftar")}
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-all whitespace-nowrap active:scale-95 shadow-sm"
            >
              Mulai Uji Coba Gratis
            </button>
          </div>

          {/* Competitor Comparison Section */}
          <div className="mt-8 border-t border-slate-100 pt-16">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold px-3.5 py-1.5 rounded-full mb-3 uppercase tracking-wider">
                ⚖️ Komparasi Transparan
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-2">
                Perbandingan EXAM AA vs Pilihan CBT Lainnya
              </h3>
              <p className="text-slate-600 text-sm max-w-2xl mx-auto font-medium">
                Pahami perbedaan antara layanan managed cloud seperti EXAM AA, platform SaaS umum, dan script mandiri (self-hosted).
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white">
              <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-4 px-5 font-bold text-slate-700 w-1/4">Kriteria Evaluasi</th>
                    <th className="py-4 px-5 font-bold text-blue-700 bg-blue-50/70 border-x border-blue-200 w-1/4">
                      EXAM AA (Managed)
                    </th>
                    <th className="py-4 px-5 font-bold text-slate-700 w-1/4">
                      Platform SaaS Lain (E-Ujian / CBT Pro)
                    </th>
                    <th className="py-4 px-5 font-bold text-slate-700 w-1/4">
                      Script Mandiri (Extraordinary CBT / ZenCBT)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  <tr>
                    <td className="py-4 px-5 font-semibold text-slate-900">Perkiraan Biaya</td>
                    <td className="py-4 px-5 bg-blue-50/30 border-x border-blue-100 text-blue-900 font-bold">
                      Rp 160rb - 480rb / bulan
                      <span className="block text-[11px] font-semibold text-emerald-600 mt-0.5">
                        20% Lebih Hemat dari Pasar
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      Rp 300rb - 995rb / bulan
                      <span className="block text-[11px] text-slate-400 mt-0.5">
                        Add-on fitur berbayar terpisah
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      Gratis kode sumber
                      <span className="block text-[11px] text-rose-600 font-medium mt-0.5">
                        Sewa VPS sendiri Rp 150rb - 500rb/bln
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-4 px-5 font-semibold text-slate-900">Pengelolaan Server</td>
                    <td className="py-4 px-5 bg-blue-50/30 border-x border-blue-100 text-blue-900 font-semibold">
                      Dikelola Penuh (Zero Maintenance)
                      <span className="block text-[11px] text-slate-500 font-normal mt-0.5">
                        Sekolah siap pakai, tanpa tim IT khusus
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      Dikelola Vendor
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      Sekolah Urus Sendiri
                      <span className="block text-[11px] text-rose-600 font-medium mt-0.5">
                        Wajib konfigurasi Linux, database, & backup
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-4 px-5 font-semibold text-slate-900">Aplikasi Kiosk Anti-Contek</td>
                    <td className="py-4 px-5 bg-blue-50/30 border-x border-blue-100 text-blue-900 font-semibold">
                      Tersedia 2 APK Khusus
                      <span className="block text-[11px] text-slate-500 font-normal mt-0.5">
                        Kunci layar, blokir split screen & tombol back
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      Safe Exam Browser dasar
                      <span className="block text-[11px] text-slate-400 mt-0.5">
                        Sebagian meminta biaya APK tambahan
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      Tergantung setup sekolah
                      <span className="block text-[11px] text-slate-400 mt-0.5">
                        Perlu setelan manual oleh teknisi
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-4 px-5 font-semibold text-slate-900">AI Generator Soal</td>
                    <td className="py-4 px-5 bg-blue-50/30 border-x border-blue-100 text-blue-900 font-semibold">
                      Tersedia Langsung
                      <span className="block text-[11px] text-slate-500 font-normal mt-0.5">
                        Buat naskah soal otomatis dari materi
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      Paket add-on berbayar
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      Tidak tersedia (Input manual)
                    </td>
                  </tr>

                  <tr>
                    <td className="py-4 px-5 font-semibold text-slate-900">Dukungan Teknis Ujian</td>
                    <td className="py-4 px-5 bg-blue-50/30 border-x border-blue-100 text-blue-900 font-semibold">
                      Pendampingan Langsung via WhatsApp
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      Sistem tiket antrean / bot
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      Mandiri / forum komunitas
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative z-10 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl sm:rounded-3xl p-8 sm:p-12 md:p-16 relative overflow-hidden shadow-2xl shadow-blue-600/30">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />
            <div className="relative z-10 text-center">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">
                Siap Beralih ke Ujian Online yang Tenang?
              </h2>
              <p className="text-blue-100 text-base mb-8 max-w-lg mx-auto font-medium">
                Kami akan memandu admin sekolah / kampus hingga seluruh sistem berjalan mandiri. Bebas konsultasi awal gratis.
              </p>
              <button
                onClick={() => navigate("/daftar")}
                className="inline-flex items-center gap-3 bg-white text-blue-700 hover:bg-blue-50 font-bold h-12 sm:h-14 px-8 sm:px-10 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-xl text-sm sm:text-base"
              >
                Daftar Sekarang
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 px-6 sm:px-10 lg:px-16 bg-white relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
              <GraduationCap size={15} className="text-blue-600" />
            </div>
            <span className="font-bold text-slate-800 text-sm">EXAM AA</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-5 text-sm text-slate-500">
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-blue-600 transition-colors">Beranda</button>
            <button onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-blue-600 transition-colors">Fitur</button>
            <button onClick={() => document.getElementById("testimonials")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-blue-600 transition-colors">Testimoni</button>
            <button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-blue-600 transition-colors text-nowrap">Harga</button>
            <a href="/privacy-policy.html" className="hover:text-blue-600 transition-colors text-nowrap">Privacy Policy</a>
            <a href="/terms-of-service.html" className="hover:text-blue-600 transition-colors text-nowrap">Terms of Service</a>
            <a href="https://wa.me/6285359907696" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 transition-colors flex items-center gap-1 text-nowrap">
              <MessageCircle size={14} /> Hubungi CS
            </a>
          </div>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} EXAM AA · By Alfaruq Asri</p>
        </div>
      </footer>

      {/* Floating WA */}
      <a
        href="https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20saya%20ingin%20tanya%20seputar%20platform%20ujian..."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-[999] flex items-center group"
      >
        <div className="mr-3 bg-white border border-slate-200 py-2 px-4 rounded-xl shadow-lg text-slate-700 text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 pointer-events-none whitespace-nowrap">
          Tanya Admin (WhatsApp)
        </div>
        <div className="w-12 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-xl shadow-emerald-500/25 flex items-center justify-center transition-all hover:scale-110 active:scale-95 relative">
          <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" />
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6 fill-current relative z-10"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
        </div>
      </a>
    </div>
  );
};

export default LandingPage;
