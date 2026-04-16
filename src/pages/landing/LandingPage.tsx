import { useNavigate } from "react-router-dom";
import {
  GraduationCap, Monitor, BarChart3, Shield, Users, Zap,
  ArrowRight, CheckCircle, Building2
} from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    { icon: Monitor, title: "Ujian CBT yang Stabil", desc: "Sistem ujian online yang dirancang dan dioptimasi agar lancar diakses ratusan siswa serentak tanpa server down." },
    { icon: BarChart3, title: "Nilai & Analisis Otomatis", desc: "Hasil ujian langsung dihitung otomatis. Tersedia analitik butir soal untuk bahan evaluasi guru." },
    { icon: Shield, title: "Cegah Siswa Menyontek", desc: "Dilengkapi fitur wajib fullscreen, pencegahan buka tab lain, dan kunci ujian otomatis jika melanggar." },
    { icon: Users, title: "Kelola Kelas & Guru", desc: "Tidak repot. Satu dashboard untuk atur jadwal ujian, mata pelajaran, guru pengawas, hingga ribuan siswa." },
    { icon: Zap, title: "Tanpa Repot Urus Server", desc: "Sekolah tidak perlu sewa server, hosting, atau urus teknis sama sekali. Semuanya sudah kami kelola." },
    { icon: Building2, title: "Pakai Identitas Sekolah", desc: "Siswa dapat mengakses link ujian khusus dengan logo dan nama sekolah tercinta Anda sendiri." },
  ];

  const plans = [
    {
      name: "Paket Berkembang",
      price: "Rp 299",
      period: "ribu / bulan",
      desc: "Pilihan utama sekolah aktif",
      quota: "Maks. 250 Siswa",
      features: ["Pelaksanaan ujian CBT", "Import ribuan soal via Ms. Word", "Analisa kompetensi siswa", "Bantuan teknis prioritas via WA"],
      cta: "Daftar Sekolah Sekarang",
      highlight: false,
      comingSoon: false,
    },
    {
      name: "Paket Lanjutan",
      price: "Rp 499",
      period: "ribu / bulan",
      desc: "Untuk institusi skala menengah",
      quota: "Maks. 500 Siswa",
      features: ["Semua di Paket Berkembang", "Server kapasitas tingkat tinggi", "Integrasi rapor digital", "Pendampingan khusus via Zoom"],
      cta: "Daftar Sekolah Sekarang",
      highlight: true,
      comingSoon: false,
    },
    {
      name: "Paket Premium",
      price: "Segera",
      period: "Hadir",
      desc: "Untuk entitas skala besar",
      quota: "Maks. 1000 Siswa",
      features: ["Semua di Paket Lanjutan", "Pakai domain sekolah.sch.id", "Kapasitas server dedicated", "Sistem Bank Soal Terpusat"],
      cta: "Nantikan Segera",
      highlight: false,
      comingSoon: true,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">

      {/* Background pattern */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <GraduationCap size={24} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight leading-none text-slate-900">E-Ujian</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/superadmin/login")}
              className="hidden md:block text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors px-4 py-2"
            >
              Super Admin
            </button>
            <button
              onClick={() => navigate("/daftar")}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-sm"
            >
              Mulai Gunakan
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-24 px-6 z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[400px] bg-blue-600/5 blur-[120px] pointer-events-none rounded-full" />

        <div className="relative max-w-4xl mx-auto text-center mt-[-40px]">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-full px-4 py-1.5 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-slate-600 text-sm font-medium">Solusi Ujian Sekolah Berbasis Komputer</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight mb-8 text-slate-900">
            Pelaksanaan Ujian Praktis Tanpa Perlu Ribet Urus Server
          </h1>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            Sistem E-Ujian membantu sekolah mengadakan ujian online, PTS, maupun Penilaian Akhir dengan lancar. Tidak ada lagi kendala teknis atau aplikasi down.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate("/daftar")}
              className="group flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold h-14 px-8 rounded-xl transition-all hover:shadow-md text-base"
            >
              Daftarkan Sekolah Sekarang
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              className="flex items-center justify-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold h-14 px-8 rounded-xl transition-all hover:shadow-sm text-base"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              Lihat Fitur E-Ujian
            </button>
          </div>

          {/* URL preview example */}
          <div className="mx-auto mt-14 w-full max-w-md bg-white border border-slate-200 shadow-sm rounded-xl p-3 text-left flex items-center gap-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
            <div className="flex gap-1.5 px-2">
              <div className="w-3 h-3 rounded-full bg-slate-200"></div>
              <div className="w-3 h-3 rounded-full bg-slate-200"></div>
              <div className="w-3 h-3 rounded-full bg-slate-200"></div>
            </div>
            <div className="bg-slate-50 border border-slate-100 flex-1 rounded px-3 py-2 text-sm font-mono text-slate-500">
              <span className="text-slate-900 font-bold">sekolahanda</span>.alfaruqasri.my.id
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 relative z-10 border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold mb-4 text-slate-900">Kenapa E-Ujian Cocok Untuk Sekolah Anda?</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto font-medium">Kami mendengarkan masukan dari ratusan guru. Sistem ini dirancang agar siapapun mudah menggunakannya.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-blue-300 hover:shadow-lg transition-all shadow-sm"
              >
                <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center mb-5 text-blue-600">
                  <f.icon size={24} />
                </div>
                <h3 className="font-bold text-lg mb-2 text-slate-900">{f.title}</h3>
                <p className="text-slate-600 text-base leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 px-6 border-y border-slate-200 bg-slate-50 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-16">
          <div className="flex-1">
            <h3 className="text-3xl font-extrabold mb-6 text-slate-900">Memudahkan Guru, Melancarkan Nilai Siswa</h3>
            <p className="text-slate-600 text-lg mb-8 leading-relaxed font-medium">Mulai dari penyusunan naskah ujian, pelaksanaan di lab atau kelas, hingga mencetak hasil evaluasi yang siap ditarik ke dalam laporan rapor.</p>
            <ul className="space-y-4">
              <li className="flex gap-4 text-slate-700 items-center font-medium">
                <CheckCircle size={22} className="text-emerald-500 flex-shrink-0" /> Kehandalan server selalu dimonitor tim teknis 24/7
              </li>
              <li className="flex gap-4 text-slate-700 items-center font-medium">
                <CheckCircle size={22} className="text-emerald-500 flex-shrink-0" /> Privasi dan keamanan bank soal sekolah terjamin
              </li>
              <li className="flex gap-4 text-slate-700 items-center font-medium">
                <CheckCircle size={22} className="text-emerald-500 flex-shrink-0" /> Navigasi sengaja dibuat minimalis dan ramah pengguna
              </li>
            </ul>
          </div>
          <div className="flex-1 w-full bg-white border border-slate-200 shadow-xl p-3 rounded-2xl">
            <div className="bg-slate-100 border border-slate-200/60 rounded-xl h-80 w-full flex items-center justify-center text-slate-400 font-semibold shadow-inner">
              ✨ Tampilan Dashboard E-Ujian ✨
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 relative z-10 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold mb-4 text-slate-900">Biaya Operasional Jelas & Terjangkau</h2>
            <p className="text-slate-600 text-lg font-medium">Tidak ada tarif tersembunyi. Sesuai dengan kemampuan sekolah menengah.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-[2rem] p-8 border transition-all duration-300 ${plan.highlight
                    ? "bg-white border-blue-200 ring-4 ring-blue-50 shadow-xl lg:-translate-y-4"
                    : "bg-white border-slate-200 shadow-sm hover:shadow-md"
                  }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-sm whitespace-nowrap">
                    PALING DIMINATI
                  </div>
                )}
                {plan.comingSoon && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-200 text-slate-600 text-xs font-bold px-4 py-1.5 rounded-full shadow-sm whitespace-nowrap">
                    COMING SOON
                  </div>
                )}
                <h3 className="font-extrabold text-2xl mb-2 text-slate-900">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-6 font-medium">{plan.desc}</p>
                <div className="flex items-baseline gap-1.5 mb-4 flex-wrap">
                  <span className={`text-4xl font-black ${plan.comingSoon ? "text-slate-400" : "text-slate-900"}`}>{plan.price}</span>
                  <span className="text-slate-500 text-sm font-semibold">{plan.period}</span>
                </div>
                <div className={`inline-block rounded-lg px-3 py-1.5 text-sm font-bold mb-8 border shadow-sm ${plan.comingSoon ? "bg-slate-50 text-slate-500 border-slate-200" : "bg-blue-50 text-blue-700 border-blue-100"}`}>{plan.quota}</div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-slate-700 font-medium">
                      <CheckCircle size={18} className={plan.comingSoon ? "text-slate-300 mt-0.5" : plan.highlight ? "text-blue-500 mt-0.5" : "text-slate-400 mt-0.5"} />
                      <span className={plan.comingSoon ? "text-slate-400" : ""}>{feat}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => { if (!plan.comingSoon) navigate("/daftar"); }}
                  disabled={plan.comingSoon}
                  className={`w-full h-12 rounded-xl font-bold text-sm transition-all ${plan.comingSoon
                      ? "bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200"
                      : plan.highlight
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 hover:scale-[1.02] active:scale-95"
                        : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm hover:scale-[1.02] active:scale-95"
                    }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 relative z-10 bg-slate-50 border-t border-slate-200">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2.5rem] p-12 md:p-16 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />

            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-6 text-white leading-tight tracking-tight">Siap Beralih ke Ujian Online yang Tenang?</h2>
              <p className="text-blue-100 text-lg mb-10 max-w-xl mx-auto font-medium">Kami siap memandu admin sekolah Anda hingga seluruh sistem dapat berjalan mandiri. Bebas konsultasi awal gratis.</p>
              <button
                onClick={() => navigate("/daftar")}
                className="inline-flex items-center gap-3 bg-white text-blue-800 hover:bg-slate-50 font-extrabold h-14 px-10 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg text-base"
              >
                Buat Akun Sekolah Sekarang
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-10 px-6 bg-white relative z-10 text-slate-500 font-medium">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              <GraduationCap size={18} />
            </div>
            <span className="font-bold text-slate-800 text-sm">E-Ujian SaaS</span>
          </div>

          <div className="flex gap-6 text-sm">
            <a href="#" className="hover:text-blue-600 transition-colors">Beranda</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Panduan Aplikasi</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Hubungi Bantuan</a>
          </div>

          <p className="text-sm">© {new Date().getFullYear()} E-Ujian. Dedikasi untuk Edukasi Indonesia.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

