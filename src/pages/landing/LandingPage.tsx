import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap, Monitor, BarChart3, Shield, Users, Zap,
  ArrowRight, CheckCircle, Building2, Menu, X, Globe, Star
} from "lucide-react";
import { cn } from "../../lib/utils";

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    { icon: Monitor, title: "Ujian CBT Stabil", desc: "Sistem ujian online yang dioptimasi agar lancar diakses ratusan siswa serentak tanpa server down.", color: "text-blue-600 bg-blue-50 border-blue-100" },
    { icon: BarChart3, title: "Nilai & Analisis Otomatis", desc: "Hasil ujian langsung dihitung otomatis. Tersedia analitik butir soal untuk evaluasi guru.", color: "text-violet-600 bg-violet-50 border-violet-100" },
    { icon: Shield, title: "Cegah Menyontek", desc: "Fitur wajib fullscreen, pencegahan buka tab lain, dan kunci ujian otomatis jika melanggar.", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
    { icon: Users, title: "Kelola Kelas & Guru", desc: "Satu dashboard untuk atur jadwal, mata pelajaran, guru pengawas, hingga ribuan siswa.", color: "text-amber-600 bg-amber-50 border-amber-100" },
    { icon: Zap, title: "Zero Maintenance", desc: "Sekolah tidak perlu sewa server atau urus teknis. Semuanya sudah kami kelola sepenuhnya.", color: "text-rose-600 bg-rose-50 border-rose-100" },
    { icon: Building2, title: "Identitas Sekolah", desc: "Siswa mengakses link ujian khusus dengan logo dan nama sekolah Anda sendiri.", color: "text-cyan-600 bg-cyan-50 border-cyan-100" },
  ];

  const plans = [
    {
      name: "Paket Berkembang",
      price: "Rp 299",
      period: "ribu / bulan",
      desc: "Pilihan utama sekolah aktif",
      quota: "Maks. 250 Siswa",
      features: ["Pelaksanaan ujian CBT", "Import soal via Ms. Word", "Analisa kompetensi siswa", "Bantuan teknis via WA"],
      cta: "Daftar Sekarang",
      highlight: false,
      comingSoon: false,
    },
    {
      name: "Paket Lanjutan",
      price: "Rp 499",
      period: "ribu / bulan",
      desc: "Untuk institusi skala menengah",
      quota: "Maks. 500 Siswa",
      features: ["Semua di Paket Berkembang", "Server kapasitas tinggi", "Integrasi rapor digital", "Pendampingan via Zoom"],
      cta: "Daftar Sekarang",
      highlight: true,
      comingSoon: false,
    },
    {
      name: "Paket Premium",
      price: "Segera",
      period: "Hadir",
      desc: "Untuk entitas skala besar",
      quota: "Maks. 1000 Siswa",
      features: ["Semua di Paket Lanjutan", "Domain sekolah.sch.id", "Server dedicated", "Bank Soal Terpusat"],
      cta: "Nantikan Segera",
      highlight: false,
      comingSoon: true,
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">

      {/* Subtle grid background */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:32px_32px] z-0" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <GraduationCap size={18} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">E-Ujian</span>
            <span className="hidden sm:inline text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wider">SaaS</span>
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
              onClick={() => navigate("/superadmin/login")}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-slate-100"
            >
              Admin
            </button>
            <button
              onClick={() => navigate("/daftar")}
              className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all shadow-sm hover:shadow-md active:scale-95"
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
              onClick={() => navigate("/superadmin/login")}
              className="w-full text-left text-sm font-medium text-slate-500 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Super Admin
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
      <section className="relative min-h-screen flex items-center justify-center pt-16 px-4 sm:px-6 z-10">
        {/* Blue glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center py-16 sm:py-24">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-full px-4 py-1.5 mb-8 hover:border-blue-300 transition-colors cursor-default">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-600 text-sm font-medium">Platform CBT untuk Sekolah Indonesia</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6 text-slate-900">
            Ujian Online Profesional{" "}
            <span className="relative inline-block">
              <span className="text-blue-600">Tanpa Ribet</span>
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6C40 2 80 2 100 4C120 6 160 4 198 2" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />
              </svg>
            </span>{" "}
            Urus Server
          </h1>

          <p className="text-base sm:text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            E-Ujian membantu sekolah mengadakan CBT, PTS, dan PAT dengan lancar. Tidak ada lagi kendala teknis atau aplikasi down saat ujian berlangsung.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate("/daftar")}
              className="group flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 sm:h-14 px-6 sm:px-8 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/25 text-sm sm:text-base active:scale-95"
            >
              Daftarkan Sekolah Gratis
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
            <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm font-mono text-slate-500 flex items-center gap-2">
              <Globe size={12} className="text-slate-400 flex-shrink-0" />
              <span className="text-slate-900 font-bold">sekolahanda</span>
              <span>.alfaruqasri.my.id</span>
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
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 relative z-10 border-t border-slate-100 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wider">
              <Star size={12} /> Fitur Unggulan
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-4 text-slate-900">Kenapa E-Ujian Cocok untuk Sekolah Anda?</h2>
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

      {/* Trust Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative z-10 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 max-w-xl">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full mb-6 uppercase tracking-wider">
              <CheckCircle size={12} /> Terpercaya
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold mb-4 text-slate-900">Memudahkan Guru, Melancarkan Nilai Siswa</h3>
            <p className="text-slate-500 text-base mb-8 leading-relaxed font-medium">
              Dari penyusunan naskah ujian, pelaksanaan di lab atau kelas, hingga mencetak hasil evaluasi yang siap ditarik ke laporan rapor.
            </p>
            <ul className="space-y-4">
              {[
                "Kehandalan server dimonitor tim teknis 24/7",
                "Privasi dan keamanan bank soal sekolah terjamin",
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
              Mulai Daftarkan Sekolah <ArrowRight size={16} />
            </button>
          </div>
          <div className="flex-1 w-full max-w-lg">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-6 shadow-inner space-y-3">
              {/* Mock dashboard preview */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center">
                    <Monitor size={13} className="text-blue-600" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">Ujian Aktif</span>
                  <span className="ml-auto text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">LIVE</span>
                </div>
                <div className="space-y-2">
                  {["Matematika Kelas 10A", "Bahasa Indonesia Kelas 11B"].map((name, j) => (
                    <div key={j} className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 font-medium">{name}</span>
                      <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${j === 0 ? 78 : 56}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Siswa", value: "142", color: "text-blue-600" },
                  { label: "Selesai", value: "89", color: "text-emerald-600" },
                  { label: "Peringatan", value: "3", color: "text-amber-600" },
                ].map((stat, k) => (
                  <div key={k} className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
                    <p className={cn("text-xl font-bold", stat.color)}>{stat.value}</p>
                    <p className="text-[10px] text-slate-400 font-semibold">{stat.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-slate-400 font-medium pt-1">✨ Preview Dashboard E-Ujian</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 relative z-10 bg-slate-50 border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wider">
              💰 Harga
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3 text-slate-900">Biaya Operasional Jelas & Terjangkau</h2>
            <p className="text-slate-500 text-base font-medium">Tidak ada tarif tersembunyi. Sesuai kemampuan sekolah menengah.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={cn(
                  "relative rounded-2xl border p-6 sm:p-8 transition-all duration-300",
                  plan.highlight
                    ? "bg-blue-600 border-blue-500 shadow-2xl shadow-blue-600/30 md:-translate-y-3 text-white"
                    : "bg-white border-slate-200 shadow-sm hover:shadow-md"
                )}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-[10px] font-black px-4 py-1 rounded-full shadow whitespace-nowrap uppercase tracking-wider">
                    ⭐ Paling Diminati
                  </div>
                )}
                {plan.comingSoon && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-200 text-slate-600 text-[10px] font-bold px-4 py-1 rounded-full shadow whitespace-nowrap">
                    Coming Soon
                  </div>
                )}

                <h3 className={cn("font-bold text-lg mb-1", plan.highlight ? "text-white" : "text-slate-900")}>{plan.name}</h3>
                <p className={cn("text-sm mb-5", plan.highlight ? "text-blue-100" : "text-slate-500")}>{plan.desc}</p>

                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className={cn("text-3xl sm:text-4xl font-black", plan.comingSoon ? "text-slate-400" : plan.highlight ? "text-white" : "text-slate-900")}>
                    {plan.price}
                  </span>
                  <span className={cn("text-sm font-semibold", plan.highlight ? "text-blue-200" : "text-slate-400")}>{plan.period}</span>
                </div>

                <div className={cn(
                  "inline-block rounded-lg px-3 py-1 text-xs font-bold mb-6 border",
                  plan.highlight ? "bg-blue-500/40 text-blue-100 border-blue-400"
                    : plan.comingSoon ? "bg-slate-50 text-slate-500 border-slate-200"
                      : "bg-blue-50 text-blue-700 border-blue-100"
                )}>
                  {plan.quota}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat, j) => (
                    <li key={j} className={cn("flex items-center gap-2.5 text-sm font-medium", plan.highlight ? "text-blue-100" : plan.comingSoon ? "text-slate-400" : "text-slate-700")}>
                      <CheckCircle size={16} className={plan.highlight ? "text-blue-300" : plan.comingSoon ? "text-slate-300" : "text-blue-500"} />
                      {feat}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => { if (!plan.comingSoon) navigate("/daftar"); }}
                  disabled={plan.comingSoon}
                  className={cn(
                    "w-full h-11 rounded-xl font-bold text-sm transition-all",
                    plan.comingSoon
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                      : plan.highlight
                        ? "bg-white text-blue-700 hover:bg-blue-50 shadow-lg hover:shadow-xl active:scale-95"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md active:scale-95"
                  )}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
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
                Kami memandu admin sekolah hingga seluruh sistem berjalan mandiri. Bebas konsultasi awal gratis.
              </p>
              <button
                onClick={() => navigate("/daftar")}
                className="inline-flex items-center gap-3 bg-white text-blue-700 hover:bg-blue-50 font-bold h-12 sm:h-14 px-8 sm:px-10 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-xl text-sm sm:text-base"
              >
                Buat Akun Sekolah Sekarang
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-4 sm:px-6 bg-slate-50 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
              <GraduationCap size={15} className="text-blue-600" />
            </div>
            <span className="font-bold text-slate-800 text-sm">E-Ujian SaaS</span>
          </div>
          <div className="flex gap-5 text-sm text-slate-500">
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-blue-600 transition-colors">Beranda</button>
            <button onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-blue-600 transition-colors">Fitur</button>
            <button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-blue-600 transition-colors">Harga</button>
          </div>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} E-Ujian · Edukasi Indonesia</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
