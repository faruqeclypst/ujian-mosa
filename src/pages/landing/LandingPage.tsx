import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap, BarChart3, Shield, Zap,
  ArrowRight, CheckCircle, Building2, Menu, X, Globe, Wand2, MessageCircle, Check
} from "lucide-react";
import { cn } from "../../lib/utils";

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    { icon: Globe, title: "CDN & Ujian Anti-Lag", desc: "Didukung jaringan Cloudflare CDN berkecepatan tinggi agar akses ujian lancar serentak ribuan siswa tanpa lemot atau server down.", color: "text-blue-600 bg-blue-50 border-blue-100" },
    { icon: Shield, title: "Kiosk APK & Alarm HP Berbunyi", desc: "Layar terkunci penuh, blokir split screen, dan alarm suara otomatis berbunyi kencang di HP jika siswa mencoba curang atau keluar aplikasi.", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
    { icon: Wand2, title: "AI Question Generator", desc: "Buat naskah soal berkualitas otomatis dari modul guru dalam hitungan detik. Hemat waktu persiapan ujian hingga 90%.", color: "text-amber-600 bg-amber-50 border-amber-100" },
    { icon: BarChart3, title: "Nilai & Analisis Butir Soal", desc: "Hasil ujian langsung dihitung otomatis lengkap dengan analisis tingkat kesulitan butir soal dan ekspor nilai format rapor.", color: "text-violet-600 bg-violet-50 border-violet-100" },
    { icon: Zap, title: "Zero Maintenance", desc: "Sekolah tidak perlu sewa server, install Linux, atau pusing teknis. Seluruh infrastruktur kami kelola penuh.", color: "text-rose-600 bg-rose-50 border-rose-100" },
    { icon: Building2, title: "Subdomain & Identitas Sekolah", desc: "Siswa mengakses link ujian dengan nama subdomain resmi dan logo sekolah Anda sendiri (contoh: sman1.examku.my.id).", color: "text-cyan-600 bg-cyan-50 border-cyan-100" },
  ];

  const schoolShowcases = [
    {
      name: "SMA Negeri Modal Bangsa",
      location: "Aceh Besar",
      desc: "Penyelenggaraan ujian semester digital dan simulasi berkala menggunakan APK Kiosk EXAM AA di perangkat siswa.",
      logo: "https://cdn.alfaruqasri.my.id/assets/modalbangsa.png",
      tag: "Sekolah Pengguna"
    },
    {
      name: "SMAN 11 Tangerang Selatan",
      location: "Banten",
      desc: "Implementasi bank soal terpusat dan pelaksanaan evaluasi belajar siswa dengan pemantauan pengawas secara real-time.",
      logo: "https://cdn.alfaruqasri.my.id/assets/SMA%20Negeri%2011%20Tangerang%20Selatan.webp",
      tag: "Sekolah Pengguna"
    }
  ];

  const infrastructureHighlights = [
    {
      icon: Shield,
      title: "Enkripsi & Kerahasiaan Bank Soal",
      desc: "Naskah soal tersimpan terenkripsi pada server dan diacak per peserta. Kunci jawaban tidak pernah tersimpan di browser siswa."
    },
    {
      icon: Zap,
      title: "Penyimpanan Jawaban Real-Time",
      desc: "Setiap butir jawaban yang dipilih siswa langsung tersimpan ke server per detik, mencegah kehilangan progres jika perangkat mati tiba-tiba."
    },
    {
      icon: Globe,
      title: "Akselerasi Cloudflare CDN Global",
      desc: "Distribusi aset grafis dan rumus matematika KaTeX dari edge server lokal terdekat untuk menjamin kelancaran koneksi di jaringan sekolah."
    }
  ];

  const plans = [
    {
      name: "Paket Berkembang",
      price: "380.000",
      oldPrice: "400.000",
      discountBadge: "Diskon 5%",
      period: "/ bulan",
      desc: "Untuk SD, SMP, & bimbingan belajar",
      quota: "Maks. 250 Siswa",
      features: [
        "Akses CDN & Ujian Anti-Lag",
        "APK Kiosk & Alarm HP Berbunyi",
        "Ujian CBT (8 Tipe Soal Lengkap)",
        "Import Word, Excel & Generator AI",
        "Monitoring Pengawas Real-Time",
        "Bantuan Teknis via WhatsApp"
      ],
      cta: "Pilih Paket Berkembang",
      highlight: false,
      comingSoon: false,
    },
    {
      name: "Paket Lanjutan",
      price: "760.000",
      oldPrice: "800.000",
      discountBadge: "Diskon 5%",
      period: "/ bulan",
      desc: "Standar ideal SMP & SMA/SMK",
      quota: "Maks. 500 Siswa",
      features: [
        "Semua fitur di Paket Berkembang",
        "Kapasitas 500 Siswa Serentak",
        "Infrastruktur Cloud Prioritas Anti-Lag",
        "Custom Subdomain (sekolah.examku.my.id)",
        "Analisis Butir Soal & Ekspor Nilai",
        "Pelatihan Guru & Admin via Zoom"
      ],
      cta: "Pilih Paket Lanjutan",
      highlight: true,
      comingSoon: false,
    },
    {
      name: "Paket Premium",
      price: "1.235.000",
      oldPrice: "1.300.000",
      discountBadge: "Diskon 5%",
      period: "/ bulan",
      desc: "Sekolah besar, yayasan, & kampus",
      quota: "Maks. 1.000 Siswa",
      features: [
        "Semua fitur di Paket Lanjutan",
        "Kapasitas 1.000 Siswa Serentak",
        "Resource Server High-Priority Dedicated",
        "Dukungan Custom Domain Sekolah",
        "Bank Soal Terpusat Antar Guru",
        "Pendampingan Teknis Siaga Saat Ujian"
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
      <section className="relative min-h-[90vh] flex items-center justify-center pt-24 pb-16 px-6 sm:px-10 lg:px-16 z-10 bg-white">
        <div className="relative max-w-5xl mx-auto text-center">
          {/* Eyebrow badge without decorative pulse dot */}
          <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-1 mb-6 text-xs font-semibold text-slate-700">
            <span>Sistem CBT Sekolah & Kampus</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black leading-[1.15] tracking-tight mb-6 text-slate-900">
            Ujian Digital Tanpa Kendala, <br className="hidden sm:inline" />
            <span className="text-blue-600">Terlindungi Penuh</span> dari Kecurangan
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            Platform ujian terintegrasi dengan penguncian layar APK native, alarm suara HP otomatis, performa server anti-lag, dan jaringan Cloudflare CDN. Langsung siap digunakan tanpa perlu sewa VPS mandiri.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
            <button
              onClick={() => navigate("/daftar")}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold h-12 px-7 rounded-xl transition-all shadow-sm active:scale-95 text-sm sm:text-base"
            >
              Mulai Uji Coba Gratis
            </button>
            <button
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              className="flex items-center justify-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold h-12 px-7 rounded-xl transition-all text-sm sm:text-base"
            >
              Lihat Paket Harga
            </button>
          </div>

          {/* Subdomain preview badge - Clean, no fake traffic lights */}
          <div className="mx-auto max-w-md bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs text-slate-600 mb-12">
            <div className="flex items-center gap-2">
              <Globe size={15} className="text-blue-600 flex-shrink-0" />
              <span className="font-mono font-medium">sekolahanda.examku.my.id</span>
            </div>
            <span className="text-[11px] font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700">
              Subdomain Mandiri
            </span>
          </div>

          {/* School Partner Showcase */}
          <div className="pt-8 border-t border-slate-100">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6">Telah Digunakan Oleh Sekolah Unggulan</p>
            <div className="flex flex-wrap justify-center items-center gap-10">
              <div className="flex items-center gap-3">
                <img
                  src="https://cdn.alfaruqasri.my.id/assets/modalbangsa.png"
                  alt="SMA Negeri Modal Bangsa"
                  className="h-12 w-auto object-contain"
                />
                <div className="text-left">
                  <span className="font-bold text-slate-800 text-xs block">SMAN Modal Bangsa</span>
                  <span className="text-[11px] text-slate-400">Aceh Besar</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <img
                  src="https://cdn.alfaruqasri.my.id/assets/SMA%20Negeri%2011%20Tangerang%20Selatan.webp"
                  alt="SMAN 11 Tangerang Selatan"
                  className="h-12 w-auto object-contain"
                />
                <div className="text-left">
                  <span className="font-bold text-slate-800 text-xs block">SMAN 11 Tangerang Selatan</span>
                  <span className="text-[11px] text-slate-400">Banten</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features - Asymmetric Content Hierarchy */}
      <section id="features" className="py-20 sm:py-28 px-6 sm:px-10 lg:px-16 relative z-10 border-t border-slate-100 bg-slate-50/60">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2 block">
              Fitur Unggulan
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Dirancang Khusus untuk Ujian Tertib dan Kestabilan Tinggi
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed">
              Kombinasi teknologi penguncian aplikasi native di perangkat siswa dan keandalan server cloud berskala besar.
            </p>
          </div>

          {/* 2 Primary Spotlight Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Spotlight 1: Kiosk & Sound Alert */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-sm">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center mb-5">
                  <Shield size={20} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                  Keamanan Kiosk
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-3 mb-2">
                  Layar Terkunci & Alarm HP Berbunyi
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                  Siswa tidak dapat keluar aplikasi, membagi layar (split screen), membuka Google, atau mengambil tangkapan layar. Jika siswa berusaha keluar secara paksa, APK secara otomatis membunyikan alarm suara kencang dari speaker HP untuk memperingatkan pengawas di ruang ujian.
                </p>
              </div>
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Tersedia: EXAM AA & EXAM AA Browser</span>
                <span className="font-semibold text-slate-700">Android APK Resmi</span>
              </div>
            </div>

            {/* Spotlight 2: CDN & Anti-Lag */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-sm">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center mb-5">
                  <Globe size={20} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                  Jaringan Cloud & Akselerasi CDN
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-3 mb-2">
                  Akses Cepat & Ujian Anti-Lag
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                  Didukung jaringan Cloudflare CDN dengan ratusan titik edge server di Indonesia. Seluruh naskah, gambar soal, audio listening, dan rumus matematika (KaTeX) di-cache secara cerdas agar ratusan hingga ribuan siswa dapat mengakses lembar soal serentak tanpa lag atau server down.
                </p>
              </div>
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Uptime Terkelola</span>
                <span className="font-semibold text-slate-700">Zero Maintenance Sekolah</span>
              </div>
            </div>
          </div>

          {/* 4 Supporting Feature Rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center mb-3">
                <Wand2 size={16} />
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">AI Question Generator</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Buat variasi soal berkualitas secara instan dari materi guru, atau import langsung dari file Word dan Excel.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-700 border border-violet-100 flex items-center justify-center mb-3">
                <BarChart3 size={16} />
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">Analisis Butir Soal</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Penilaian otomatis instan dengan evaluasi daya pembeda butir soal dan ekspor nilai siap olah ke format rapor.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-100 flex items-center justify-center mb-3">
                <Building2 size={16} />
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">Subdomain Mandiri</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Alamat link khusus dengan logo sekolah Anda sendiri untuk memperkuat identitas resmi institusi pendidikan.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-center mb-3">
                <Zap size={16} />
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">8 Tipe Soal Lengkap</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pilihan Ganda, PG Kompleks, Menjodohkan, Isian, Uraian, Benar/Salah, Angket, dan Audio Listening.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Infrastructure Section */}
      <section className="py-20 sm:py-24 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="max-w-3xl mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
              Infrastruktur & Keamanan Data
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Standar Keamanan untuk Ketenangan Pelaksanaan Ujian
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {infrastructureHighlights.map((item, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-6 bg-slate-50/50">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
                  <item.icon size={18} />
                </div>
                <h3 className="font-bold text-base text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="py-20 sm:py-24 px-6 sm:px-10 lg:px-16 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 max-w-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 inline-block mb-4">
              Antarmuka Guru & Admin
            </span>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 leading-tight mb-4">
              Penyusunan Naskah Mudah, Rekapitulasi Nilai Cepat
            </h3>
            <p className="text-slate-600 text-sm sm:text-base mb-6 leading-relaxed">
              Dari pengelolaan bank soal, pengaturan jadwal ruang ujian, pemantauan status siswa di kelas, hingga cetak lembar hasil ujian yang siap ditarik ke rapor.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "Pemantauan status pengerjaan siswa secara langsung",
                "Kunci lembar ujian otomatis jika waktu habis",
                "Tata letak ringkas dan mudah dipahami guru",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-700 font-medium text-xs sm:text-sm">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Check size={12} className="text-emerald-700" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate("/daftar")}
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-bold text-sm"
            >
              Daftarkan Sekolah Sekarang <ArrowRight size={16} />
            </button>
          </div>
          <div className="flex-1 w-full max-w-2xl">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2 shadow-md overflow-hidden">
              <img
                src="https://cdn.alfaruqasri.my.id/schools/modalbangsa/identity/2026-04-21T08-17-30-489Z-screenshot-1514-.png"
                alt="EXAM AA Dashboard Preview"
                className="w-full h-auto rounded-xl border border-slate-100"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Real School Implementation */}
      <section id="testimonials" className="py-20 sm:py-24 px-6 sm:px-10 lg:px-16 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2 block">
              Sekolah Pengguna
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Telah Digunakan di Berbagai Sekolah Unggulan
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2">
              Sistem ujian kami telah terbukti andal dalam menyelenggarakan evaluasi akademik siswa secara serentak.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {schoolShowcases.map((school, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 p-2 flex items-center justify-center flex-shrink-0">
                      <img src={school.logo} alt={school.name} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900">{school.name}</h3>
                      <p className="text-xs text-slate-500">{school.location}</p>
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed mb-4">
                    {school.desc}
                  </p>
                </div>
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Status Penggunaan</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    {school.tag}
                  </span>
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
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold px-3.5 py-1.5 rounded-full mb-4 uppercase tracking-wider">
              Jaringan CDN Global & Ujian Anti-Lag
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-3 text-slate-900">
              Paket Berlangganan Resmi EXAM AA
            </h2>
            <p className="text-slate-600 text-base max-w-2xl mx-auto font-medium">
              Sistem ujian online siap pakai dengan akselerasi Cloudflare CDN, server anti-lag, dan keamanan APK Kiosk dengan alarm suara HP otomatis. Dapatkan potongan 5% dari harga normal.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
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
                      Paling Diminati
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
                          Harga Normal
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

          {/* Custom Package Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row items-center justify-between gap-6 mb-16 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-start gap-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-300 flex items-center justify-center flex-shrink-0">
                <Building2 size={24} />
              </div>
              <div>
                <div className="inline-block bg-blue-500/20 text-blue-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-1 border border-blue-400/20">
                  Kapasitas Besar & Yayasan
                </div>
                <h3 className="text-xl font-bold text-white">Butuh Paket Kustom atau Lebih dari 1.000 Siswa?</h3>
                <p className="text-sm text-slate-300 max-w-2xl font-normal mt-1 leading-relaxed">
                  Untuk yayasan multi-sekolah, dinas pendidikan, atau kampus dengan kebutuhan server mandiri dan kapasitas ujian akbar ribuan siswa serentak, hubungi kami untuk proposal penawaran khusus.
                </p>
              </div>
            </div>
            <a
              href="https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20konsultasi%20Paket%20Kustom%20CBT%20untuk%20sekolah/institusi%20kami..."
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 w-full lg:w-auto h-12 px-7 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 shadow-lg shadow-emerald-500/20 flex-shrink-0"
            >
              <MessageCircle size={18} />
              Hubungi Kami via WhatsApp
            </a>
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
                  Dapatkan akses simulasi gratis hingga 50 siswa untuk mencoba kestabilan server anti-lag dan aplikasi kunci layar APK di sekolah Anda.
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
                Komparasi Transparan
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
                      EXAM AA (Managed Cloud)
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
                      Rp 380rb - 1,23jt / bulan
                      <span className="block text-[11px] font-semibold text-emerald-600 mt-0.5">
                        Diskon 5% (Sudah Termasuk CDN & Kiosk)
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
                    <td className="py-4 px-5 font-semibold text-slate-900">Jaringan CDN & Performa</td>
                    <td className="py-4 px-5 bg-blue-50/30 border-x border-blue-100 text-blue-900 font-semibold">
                      Cloudflare CDN Global + Anti-Lag
                      <span className="block text-[11px] text-slate-500 font-normal mt-0.5">
                        Akses secepat kilat ribuan siswa serentak
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      CDN Standar / Tergantung Paket
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      Tergantung spesifikasi VPS sekolah
                      <span className="block text-[11px] text-rose-600 font-medium mt-0.5">
                        Rentan lemot jika VPS spesifikasi minim
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
                    <td className="py-4 px-5 font-semibold text-slate-900">Keamanan APK Kiosk & Alarm</td>
                    <td className="py-4 px-5 bg-blue-50/30 border-x border-blue-100 text-blue-900 font-semibold">
                      Kunci Layar + Alarm HP Berbunyi
                      <span className="block text-[11px] text-slate-500 font-normal mt-0.5">
                        Alarm suara kencang jika siswa coba keluar/split
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
        <div className="w-12 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-xl shadow-emerald-500/25 flex items-center justify-center transition-all hover:scale-105 active:scale-95">
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
