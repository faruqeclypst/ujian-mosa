import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Monitor, BarChart3, Shield, Building2, ArrowRight, Check, Menu, X,
  MessageCircle, Server, FileSpreadsheet, LayoutGrid, Lock, Clock,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { getDomainSuffix } from "../../utils/domainHelper";

/* ─────────────────────────────────────────────────────────────
   Examku — landing page
   Prinsip: jujur, tenang, padat. Tanpa testimoni karangan,
   tanpa marquee tech-stack, tanpa klaim tanpa bukti.
   ───────────────────────────────────────────────────────────── */

const WA = "https://wa.me/6285359907696";
const WA_LINK = `${WA}?text=${encodeURIComponent("Halo Admin Examku, saya ingin bertanya seputar platform ujian online.")}`;

const Logo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 246 64" className={className} role="img" aria-label="Examku">
    <defs>
      <linearGradient id="ek-lp" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="52%" stopColor="#1D4ED8" />
        <stop offset="100%" stopColor="#3D34C9" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="64" height="64" rx="16" fill="url(#ek-lp)" />
    <path d="M14.5 18.5h26" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    <path d="M14.5 32h19" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
    <path d="M14.5 45.5h26" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    <circle cx="49.6" cy="18.5" r="3.4" fill="#4ADE80" />
    <text
      x="82" y="43"
      fontFamily="Outfit, Inter, system-ui, sans-serif"
      fontSize="31" fontWeight="700" letterSpacing="-1.2" fill="#0F172A"
    >
      Examku
    </text>
  </svg>
);

const features = [
  {
    icon: Monitor,
    title: "Ujian berjalan, bukan tersendat",
    desc: "Ratusan siswa mengerjakan ujian di satu waktu. Halaman ujian dikirim dari jaringan tepi Cloudflare, jadi tidak semua beban menumpuk di satu server sekolah.",
  },
  {
    icon: FileSpreadsheet,
    title: "Bank soal dari Word & Excel",
    desc: "Guru menyusun soal di dokumen yang sudah biasa dipakai. Impor, lalu sistem menyusunnya menjadi paket ujian yang siap dipakai.",
  },
  {
    icon: LayoutGrid,
    title: "Delapan tipe soal",
    desc: "Pilihan ganda, jamak, benar–salah, menjodohkan, isian singkat, esai, numerik, hingga soal bergambar dan rumus matematika.",
  },
  {
    icon: BarChart3,
    title: "Nilai langsung, analisis per butir",
    desc: "Hasil dihitung begitu ujian ditutup. Guru dapat melihat butir mana yang paling banyak dijawab salah, untuk perbaikan pembelajaran berikutnya.",
  },
  {
    icon: Lock,
    title: "Kunci layar saat ujian",
    desc: "Mode layar penuh wajib, perpindahan tab terdeteksi, dan ujian dapat ditutup otomatis saat siswa meninggalkan halaman. Setiap kejadian tercatat di log pengawas.",
  },
  {
    icon: Building2,
    title: "Nama dan logo sekolah sendiri",
    desc: "Siswa membuka alamat khusus sekolah Anda dan melihat identitas sekolahnya sendiri, bukan identitas penyedia layanan.",
  },
];

const steps = [
  {
    n: "01",
    title: "Daftar sekolah",
    desc: "Isi data sekolah dan pilih paket. Tanpa biaya awal, tanpa ikatan kontrak jangka panjang.",
  },
  {
    n: "02",
    title: "Kami siapkan ruangnya",
    desc: "Alamat, logo, dan akun admin sekolah disiapkan. Umumnya selesai dalam 1×24 jam kerja.",
  },
  {
    n: "03",
    title: "Guru menyusun soal",
    desc: "Impor dari Word atau Excel, susun paket ujian, atur jadwal dan lama pengerjaan.",
  },
  {
    n: "04",
    title: "Ujian & nilai",
    desc: "Siswa mengerjakan dari lab atau perangkat sendiri. Hasil tersedia segera setelah ujian ditutup.",
  },
];

const plans = [
  {
    name: "Berkembang",
    price: "225.000",
    period: "/ bulan",
    desc: "Untuk sekolah dengan satu gelombang ujian.",
    quota: "sampai 250 siswa",
    features: [
      "8 tipe soal",
      "Impor soal Word & Excel",
      "Mode layar penuh & log pelanggaran",
      "Nilai otomatis + ekspor Excel",
      "Bantuan teknis via WhatsApp",
    ],
    highlight: false,
  },
  {
    name: "Lanjutan",
    price: "450.000",
    period: "/ bulan",
    desc: "Untuk sekolah dengan ujian paralel antar kelas.",
    quota: "sampai 500 siswa",
    features: [
      "Semua yang ada di paket Berkembang",
      "Kapasitas server lebih besar",
      "Analisis butir soal",
      "Alamat khusus sekolah Anda",
      "Pelatihan guru via daring",
    ],
    highlight: true,
  },
  {
    name: "Mandiri",
    price: "900.000",
    period: "/ bulan",
    desc: "Untuk yayasan atau sekolah dengan kebutuhan khusus.",
    quota: "sampai 1.500 siswa",
    features: [
      "Semua yang ada di paket Lanjutan",
      "Nama domain sekolah sendiri",
      "Bank soal terpusat antar unit",
      "Pendampingan teknis terjadwal",
    ],
    highlight: false,
  },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const suffix = getDomainSuffix();

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setOpen(false);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">

      {/* ── Navbar ───────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Examku">
            <Logo className="h-8 w-auto" />
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {[
              ["Fitur", "fitur"],
              ["Cara Kerja", "cara-kerja"],
              ["Harga", "harga"],
            ].map(([label, id]) => (
              <button
                key={id}
                onClick={() => go(id)}
                className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => navigate("/daftar")}
              className="ml-2 h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
            >
              Daftar sekolah
            </button>
          </nav>

          <button
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {open && (
          <div className="md:hidden border-t border-slate-200 bg-white px-5 py-3 space-y-1">
            {[
              ["Fitur", "fitur"],
              ["Cara Kerja", "cara-kerja"],
              ["Harga", "harga"],
            ].map(([label, id]) => (
              <button
                key={id}
                onClick={() => go(id)}
                className="block w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-100"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => navigate("/daftar")}
              className="w-full mt-1 h-11 rounded-lg bg-slate-900 text-white text-sm font-semibold"
            >
              Daftar sekolah
            </button>
          </div>
        )}
      </header>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="pt-28 sm:pt-36 pb-20 sm:pb-28 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-14 lg:gap-20 items-center">

          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-6">
              <span className="h-px w-6 bg-slate-300" />
              Sistem ujian sekolah
            </p>

            <h1 className="text-[2rem] leading-[1.12] sm:text-5xl lg:text-[3.4rem] font-bold tracking-[-0.02em] text-slate-900">
              Ujian sekolah yang
              <br className="hidden sm:block" /> tenang dijalankan,
              <br className="hidden sm:block" /> cepat dinilai.
            </h1>

            <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              Examku menyiapkan ruang ujian daring untuk sekolah: soal diimpor dari
              dokumen yang sudah biasa dipakai guru, siswa mengerjakan dari lab atau
              perangkat sendiri, dan nilainya tersedia begitu ujian ditutup.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate("/daftar")}
                className="group inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold transition-colors"
              >
                Mulai daftar sekolah
                <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => go("cara-kerja")}
                className="inline-flex items-center justify-center h-12 px-6 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
              >
                Lihat cara kerjanya
              </button>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5">
              {["Tanpa biaya awal", "Siap pakai dalam 1×24 jam", "Bantuan langsung via WhatsApp"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2 text-[13px] text-slate-500">
                  <Check size={14} className="text-emerald-600 shrink-0" strokeWidth={3} />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Mockup alamat sekolah */}
          <div className="lg:pl-4">
            <div className="rounded-xl border border-slate-200 bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.28)] overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 h-10 border-b border-slate-100 bg-slate-50/80">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              </div>

              <div className="px-4 py-3 border-b border-slate-100">
                <div className="flex items-center rounded-md bg-slate-100 px-3 h-9 text-[13px] font-mono">
                  <span className="text-slate-400 mr-1.5">https://</span>
                  <span className="font-semibold text-slate-800">sekolahanda</span>
                  <span className="text-slate-500">{suffix}</span>
                  <span className="text-slate-300 ml-auto">/exam</span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-slate-100" />
                    <div className="space-y-1.5">
                      <div className="h-2 w-24 rounded-full bg-slate-200" />
                      <div className="h-2 w-16 rounded-full bg-slate-100" />
                    </div>
                  </div>
                  <div className="h-6 w-16 rounded-full bg-emerald-50 border border-emerald-100" />
                </div>

                <div className="rounded-lg border border-slate-100 p-4 space-y-3">
                  <div className="h-2 w-3/5 rounded-full bg-slate-200" />
                  <div className="space-y-2 pt-1">
                    {[92, 78, 85, 60].map((w, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className="h-4 w-4 rounded-full border border-slate-200 shrink-0" />
                        <div className="h-2 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="h-2 w-20 rounded-full bg-slate-100" />
                  <div className="h-8 w-24 rounded-lg bg-blue-700" />
                </div>
              </div>
            </div>

            <p className="mt-3.5 text-center text-[11.5px] text-slate-400">
              Contoh tampilan halaman ujian siswa
            </p>
          </div>
        </div>
      </section>

      {/* ── Kenapa Examku ────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700 mb-3">
              Kenapa Examku
            </p>
            <h2 className="text-[26px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-[1.15] mb-4">
              Dibangun setelah mengurus ujian sekolah sungguhan
            </h2>
            <p className="text-[15px] text-slate-600 leading-relaxed mb-6">
              Examku bukan alat yang dirancang di ruang kosong. Ia tumbuh dari
              kebutuhan harian satu sekolah, lalu dipakai sekolah lain, dan
              diperbaiki dari keluhan yang benar-benar terjadi di ruang ujian.
            </p>
            <div className="space-y-5">
              <div className="border-l-2 border-blue-600 pl-4">
                <p className="font-semibold text-slate-900 text-[15px] mb-1">
                  Soal tidak perlu diketik ulang
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Guru mengimpor dari Word atau Excel yang sudah dipakai
                  sehari-hari. Tidak ada pelatihan panjang sebelum ujian pertama.
                </p>
              </div>
              <div className="border-l-2 border-blue-600 pl-4">
                <p className="font-semibold text-slate-900 text-[15px] mb-1">
                  Beratnya ditanggung penyedia, bukan sekolah
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Halaman dan soal disajikan dari jaringan tepi CDN, sehingga
                  komputer lab sekolah tidak perlu menanggung beban ribuan siswa
                  sekaligus.
                </p>
              </div>
              <div className="border-l-2 border-blue-600 pl-4">
                <p className="font-semibold text-slate-900 text-[15px] mb-1">
                  Data tiap sekolah terpisah
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Satu sekolah, satu ruang data sendiri. Berkas ujian satu
                  sekolah tidak dapat diakses sekolah lain.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-7 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-5">
              Yang berubah di sekolah
            </p>
            <dl className="space-y-6">
              <div>
                <dt className="text-sm text-slate-500 mb-1.5">
                  Sebelum memakai Examku
                </dt>
                <dd className="text-[15px] text-slate-700 leading-relaxed">
                  Guru mengetik ulang soal, koreksi lembar jawaban satu per satu,
                  dan nilai baru selesai berhari-hari setelah ujian.
                </dd>
              </div>
              <div className="border-t border-slate-200 pt-6">
                <dt className="text-sm font-semibold text-blue-700 mb-1.5">
                  Sesudah memakai Examku
                </dt>
                <dd className="text-[15px] text-slate-900 leading-relaxed font-medium">
                  Soal diimpor sekali, siswa mengerjakan di perangkat masing-masing,
                  dan nilai sudah tersedia saat ujian ditutup.
                </dd>
              </div>
            </dl>
            <div className="mt-7 pt-6 border-t border-slate-200">
              <p className="text-[13px] text-slate-500 leading-relaxed">
                Setiap sekolah mendapat satu ruang ujian sendiri dengan alamat
                dan logo sekolahnya, siap dalam 1×24 jam.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dipakai sekolah ──────────────────────────────── */}
      <section className="border-y border-slate-100 bg-slate-50/60 py-9 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 shrink-0">
            Sedang dipakai
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {[
              { src: "https://cdn.alfaruqasri.my.id/assets/modalbangsa.png", alt: "SMA Negeri Modal Bangsa", label: "SMA Negeri Modal Bangsa" },
              { src: "https://cdn.alfaruqasri.my.id/assets/SMA%20Negeri%2011%20Tangerang%20Selatan.webp", alt: "SMA Negeri 11 Tangerang Selatan", label: "SMA Negeri 11 Tangerang Selatan" },
            ].map((sch) => (
              <div key={sch.alt} className="flex items-center gap-3.5">
                <img
                  src={sch.src}
                  alt={sch.alt}
                  className="h-11 w-11 sm:h-12 sm:w-12 object-contain shrink-0"
                />
                <span className="text-[13px] font-medium text-slate-600 leading-snug max-w-[9.5rem]">
                  {sch.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fitur ────────────────────────────────────────── */}
      <section id="fitur" className="py-20 sm:py-28 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700 mb-4">
              Fitur
            </p>
            <h2 className="text-[1.75rem] sm:text-4xl font-bold tracking-[-0.02em] text-slate-900 leading-tight">
              Yang benar-benar dipakai saat hari-H
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Bukan daftar panjang. Hanya hal-hal yang menentukan apakah ujian
              berjalan lancar atau tidak.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
            {features.map((f) => (
              <div key={f.title} className="bg-white p-6 sm:p-7 hover:bg-slate-50/70 transition-colors">
                <f.icon size={19} className="text-blue-700 mb-4" strokeWidth={2} />
                <h3 className="font-semibold text-slate-900 mb-2 leading-snug">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cara kerja ───────────────────────────────────── */}
      <section id="cara-kerja" className="py-20 sm:py-28 px-5 sm:px-8 bg-slate-50/70 border-y border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700 mb-4">
              Cara kerja
            </p>
            <h2 className="text-[1.75rem] sm:text-4xl font-bold tracking-[-0.02em] text-slate-900 leading-tight">
              Dari pendaftaran sampai nilai keluar
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={s.n} className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[13px] font-bold tabular-nums text-blue-700">{s.n}</span>
                  {i < steps.length - 1 && (
                    <span className="hidden lg:block h-px flex-1 bg-slate-200" />
                  )}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Harga ────────────────────────────────────────── */}
      <section id="harga" className="py-20 sm:py-28 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700 mb-4">
              Harga
            </p>
            <h2 className="text-[1.75rem] sm:text-4xl font-bold tracking-[-0.02em] text-slate-900 leading-tight">
              Biaya jelas, tanpa tambahan tersembunyi
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Ditagih bulanan dan dapat dihentikan kapan saja. Tidak ada biaya
              pemasangan.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  "rounded-xl border p-6 sm:p-7 flex flex-col",
                  plan.highlight
                    ? "border-slate-900 bg-slate-900 text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.5)]"
                    : "border-slate-200 bg-white"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className={cn("font-semibold", plan.highlight ? "text-white" : "text-slate-900")}>
                    {plan.name}
                  </h3>
                  {plan.highlight && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white">
                      Umum dipilih
                    </span>
                  )}
                </div>

                <p className={cn("text-sm mb-6", plan.highlight ? "text-slate-300" : "text-slate-500")}>
                  {plan.desc}
                </p>

                <div className="flex items-baseline gap-1 mb-2">
                  <span className={cn("text-sm font-medium", plan.highlight ? "text-slate-300" : "text-slate-500")}>
                    Rp
                  </span>
                  <span className={cn("text-[2rem] font-bold tracking-tight", plan.highlight ? "text-white" : "text-slate-900")}>
                    {plan.price}
                  </span>
                  <span className={cn("text-sm ml-0.5", plan.highlight ? "text-slate-400" : "text-slate-400")}>
                    {plan.period}
                  </span>
                </div>

                <p className={cn("text-[13px] mb-7", plan.highlight ? "text-slate-400" : "text-slate-500")}>
                  {plan.quota}
                </p>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2.5 text-[13.5px] leading-snug">
                      <Check
                        size={15}
                        strokeWidth={2.5}
                        className={cn("shrink-0 mt-0.5", plan.highlight ? "text-blue-400" : "text-emerald-600")}
                      />
                      <span className={plan.highlight ? "text-slate-200" : "text-slate-600"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate("/daftar", { state: { selectedPlan: plan.name } })}
                  className={cn(
                    "w-full h-11 rounded-lg font-semibold text-sm transition-colors",
                    plan.highlight
                      ? "bg-white text-slate-900 hover:bg-slate-100"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  )}
                >
                  Pilih {plan.name}
                </button>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-slate-500">
            Butuh kapasitas lebih besar, yayasan multi-unit, atau domain sendiri?{" "}
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="text-blue-700 font-medium underline underline-offset-4 decoration-slate-300 hover:decoration-blue-700">
              Hubungi kami
            </a>{" "}
            untuk penawaran khusus.
          </p>
        </div>
      </section>

      {/* ── Keandalan ────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-5 sm:px-8 bg-slate-50/70 border-y border-slate-100">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-3 gap-10">
          {[
            { icon: Server, title: "Jaringan tepi CDN", desc: "Berkas aplikasi dilayani dari jaringan tepi, meringankan beban server sekolah saat ujian serentak." },
            { icon: Lock, title: "Data tiap sekolah terpisah", desc: "Setiap sekolah memiliki ruang datanya sendiri. Bank soal satu sekolah tidak dapat diakses sekolah lain." },
            { icon: Clock, title: "Pendampingan berkelanjutan", desc: "Bukan sekadar dipasang lalu ditinggal. Kami membantu saat persiapan maupun ketika ujian berlangsung." },
          ].map((item) => (
            <div key={item.title}>
              <item.icon size={18} className="text-slate-700 mb-3.5" strokeWidth={2} />
              <h3 className="font-semibold text-slate-900 mb-2 text-[15px]">{item.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl bg-slate-900 px-8 sm:px-14 py-14 sm:py-16 text-center relative overflow-hidden">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-700/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-600/15 blur-3xl" />

            <div className="relative">
              <h2 className="text-[1.6rem] sm:text-4xl font-bold tracking-[-0.02em] text-white leading-tight mb-4">
                Coba dulu dengan satu kelas
              </h2>
              <p className="text-slate-300 max-w-xl mx-auto leading-relaxed mb-9">
                Jalankan ujian percobaan sebelum memakainya di ujian sesungguhnya.
                Kami dampingi dari penyiapan soal sampai hasil keluar.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => navigate("/daftar")}
                  className="group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors"
                >
                  Daftar sekolah
                  <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
                <a
                  href={WA_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-lg border border-slate-600 text-white font-semibold hover:bg-white/5 transition-colors"
                >
                  <MessageCircle size={17} />
                  Tanya lewat WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-slate-200 py-12 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 lg:items-start justify-between">
            <div className="max-w-xs">
              <Logo className="h-8 w-auto mb-4" />
              <p className="text-sm text-slate-500 leading-relaxed">
                Sistem ujian daring untuk sekolah dan kampus di Indonesia.
              </p>
            </div>

            <div className="flex flex-wrap gap-x-14 gap-y-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3.5">
                  Platform
                </p>
                <ul className="space-y-2.5 text-sm">
                  {[["Fitur", "fitur"], ["Cara Kerja", "cara-kerja"], ["Harga", "harga"]].map(([l, id]) => (
                    <li key={id}>
                      <button onClick={() => go(id)} className="text-slate-600 hover:text-blue-700 transition-colors">
                        {l}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3.5">
                  Bantuan
                </p>
                <ul className="space-y-2.5 text-sm">
                  <li>
                    <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-blue-700 transition-colors">
                      Hubungi kami
                    </a>
                  </li>
                  <li>
                    <a href="/privacy-policy.html" className="text-slate-600 hover:text-blue-700 transition-colors">
                      Kebijakan Privasi
                    </a>
                  </li>
                  <li>
                    <a href="/terms-of-service.html" className="text-slate-600 hover:text-blue-700 transition-colors">
                      Ketentuan Layanan
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-between text-[13px] text-slate-400">
            <p>© {new Date().getFullYear()} Examku</p>
            <p>Dikelola di Indonesia</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
