import { useNavigate } from "react-router-dom";
import {
  Shield, FileText, Wand2, BarChart3, Zap, Sparkles, Building2,
  MessageCircle, ArrowLeft, ArrowRight, CheckCircle, Smartphone,
  Check, Lock, ExternalLink
} from "lucide-react";

export const allFeaturesData = [
  {
    id: "anti-curang",
    icon: Shield,
    badge: "Android & iOS Terproteksi",
    title: "Anti-Curang Native: APK Android & iOS SEB",
    summary: "Perangkat Android menggunakan aplikasi native APK EXAM AA dengan proteksi Kiosk, deteksi split-screen, dan sirine alarm volume kencang jika mencoba curang. Pengguna iPhone & iPad terintegrasi resmi dengan Safe Exam Browser (SEB). Keamanan selalu diperbarui secara berkala.",
    points: [
      "Aplikasi Native APK Kiosk Android dengan penguncian layar penuh tanpa celah",
      "Deteksi otomatis multi-window, split-screen, dan floating apps terlarang",
      "Sirine alarm bersuara kencang otomatis aktif saat terdeteksi upaya keluar aplikasi",
      "Sesi ujian dibekukan (freeze penalty) dengan hitung mundur penalti keamanan",
      "Terintegrasi resmi dengan Safe Exam Browser (SEB) di iPhone & iPad",
      "Pembaruan keamanan native berkala mengantisipasi metode kecurangan baru"
    ],
    actionText: "Konsultasi Proteksi Kiosk",
    actionLink: "https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20tanya%20detail%20fitur%20APK%20Kiosk%20dan%20iOS%20SEB..."
  },
  {
    id: "import-word",
    icon: FileText,
    badge: "Standar Format Sekolah",
    title: "Import Naskah Word & Export e-Rapor Excel",
    summary: "Guru tidak perlu ketik manual satu per satu. Cukup ketik naskah di Microsoft Word (.docx) berformat tabel standar dengan KOP sekolah untuk import instan beserta gambar & stimulus. Nilai akhir langsung diexport ke format Excel (.xlsx) rapi siap cetak e-Rapor.",
    points: [
      "Template tabel Microsoft Word (.docx) berstandar KOP resmi sekolah",
      "Mendukung import instan butir soal beserta stimulus bacaan dan gambar",
      "Tidak perlu input manual berulang-ulang di panel browser",
      "Ekspor rekap nilai per kelas instan ke format Excel (.xlsx)",
      "Format nilai rapi disesuaikan langsung dengan template aplikasi e-Rapor sekolah",
      "Perhitungan bobot nilai dan konversi skor otomatis tanpa koreksi manual"
    ],
    actionText: "Tanya Template Naskah Word",
    actionLink: "https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20melihat%20template%20naskah%20Word%20dan%20ekspor%20Excel..."
  },
  {
    id: "pembuat-soal-ai",
    icon: Wand2,
    badge: "Hemat Waktu Guru",
    title: "Pembuat Soal & Stimulus Otomatis dengan AI",
    summary: "Cukup masukkan modul ajar atau dokumen materi, sistem AI cerdas EXAM AA akan otomatis merancang butir soal AKM/ANBK, bacaan stimulus literasi, kunci jawaban, dan rumus matematika KaTeX siap pakai dalam hitungan detik.",
    points: [
      "Ekstraksi materi pelajaran langsung dari file modul ajar atau ringkasan dokumen",
      "Generator otomatis butir soal AKM/ANBK, pilihan ganda biasa & pilihan ganda kompleks",
      "Pembuatan stimulus narasi literasi & numerasi yang relevan dengan kurikulum",
      "Penyertaan kunci jawaban dan pembahasan otomatis terverifikasi",
      "Mendukung penulisan rumus eksak matematika & fisika berbasis KaTeX / LaTeX",
      "Menghemat waktu persiapan guru hingga 80% dalam setiap siklus ujian"
    ],
    actionText: "Uji Generator Soal AI",
    actionLink: "https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20tertarik%20dengan%20fitur%20AI%20Pembuat%20Soal..."
  },
  {
    id: "psikometri-ctt",
    icon: BarChart3,
    badge: "Standar Psikometri Nasional",
    title: "Analisis Butir Soal Standar Kementerian",
    summary: "Menyaring soal berkualitas tinggi menggunakan metode psikometri Classical Test Theory (CTT) standar Prof. Arikunto & Depdiknas: Tingkat Kesukaran (P), Daya Pembeda (D), Point-Biserial (r_pb), Efektivitas Pengecoh, dan Decision Engine rekomendasi perbaikan instrumen.",
    points: [
      "Tingkat Kesukaran (P): mendeteksi apakah butir soal terlalu sukar, sedang, atau mudah",
      "Daya Pembeda (D): mengukur kemampuan soal membedakan siswa kelompok atas dan bawah",
      "Korelasi Point-Biserial (r_pb): validitas diskriminasi butir terhadap skor total ujian",
      "Efektivitas Pengecoh (Distraktor): menganalisis fungsi opsi salah pada pilihan ganda",
      "Decision Engine otomatis: label rekomendasi apakah soal Diterima, Direvisi, atau Dibuang",
      "Laporan statistik komprehensif siap diunduh dan dipresentasikan ke pengawas sekolah"
    ],
    actionText: "Pelajari Psikometri CTT",
    actionLink: "https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20tanya%20fitur%20Analisis%20Butir%20Soal%20Psikometri..."
  },
  {
    id: "cloudflare-cdn",
    icon: Zap,
    badge: "Akselerasi Global Edge",
    title: "Server Anti-Lag Akselerasi Cloudflare Edge CDN",
    summary: "Didukung jaringan Cloudflare CDN berkecepatan tinggi di puluhan server edge. Ribuan siswa menekan tombol mulai serentak tanpa antrean, tanpa lag, dan auto-save jawaban ke cloud per detik meski jaringan internet sekolah sempat terputus.",
    points: [
      "Didistribusikan melalui puluhan edge location Cloudflare CDN berkecepatan tinggi",
      "Tahan beban ribuan siswa menekan tombol mulai ujian secara bersamaan",
      "Tidak ada antrean login atau halaman loading macet saat jam ujian puncak",
      "Sistem auto-save jawaban setiap detik langsung tersimpan ke cloud server",
      "Jawaban tetap aman tersimpan utuh jika jaringan internet sekolah sempat drop",
      "Arsitektur server terisolasi dengan proteksi DDoS dan SSL enterprise grade"
    ],
    actionText: "Tanya Kapasitas Server CDN",
    actionLink: "https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20tanya%20keandalan%20server%20Cloudflare%20CDN..."
  },
  {
    id: "desain-ramah",
    icon: Sparkles,
    badge: "Mudah Dipahami Siapa Saja",
    title: "Desain UI/UX Sangat Ramah Guru & Siswa",
    summary: "Antarmuka dirancang bersih, intuitif, dan manusiawi. Guru senior dapat mengoperasikan tanpa kendala teknis dan tanpa perlu pelatihan rumit. Siswa mengerjakan soal dengan nyaman dan fokus di smartphone, tablet, maupun laptop.",
    points: [
      "Antarmuka berbahasa Indonesia yang sopan, rapi, dan mudah dipahami guru senior",
      "Alur kerja terstruktur tanpa menu tersembunyi yang membingungkan proktor",
      "Lembar ujian siswa bebas distraksi dengan pilihan font yang jelas dan kontras tinggi",
      "Navigasi nomor soal fleksibel dilengkapi penanda ragu-ragu dan verifikasi kelengkapan",
      "Responsif di semua perangkat: HP Android, iPhone, iPad, Chromebook, hingga laptop Windows",
      "Tidak memerlukan pelatihan teknis rumit, sekolah langsung siap ujian dalam hitungan menit"
    ],
    actionText: "Jadwalkan Demo Aplikasi",
    actionLink: "https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20melihat%20demo%20tampilan%20antarmuka%20aplikasi..."
  },
  {
    id: "subdomain-mandiri",
    icon: Building2,
    badge: "Identitas Sekolah Mandiri",
    title: "Subdomain Khusus & Identitas Resmi Sekolah",
    summary: "Siswa dan guru mengakses sistem melalui alamat web resmi sekolah Anda (contoh: sman1.examku.my.id atau custom domain sekolah) lengkap dengan logo dan nama sekolah sendiri. Meningkatkan kredibilitas dan wibawa lembaga.",
    points: [
      "Alamat portal khusus nama sekolah Anda sendiri (contoh: sman1.examku.my.id)",
      "Dukungan custom domain mandiri sekolah (misal: cbt.sman1jakarta.sch.id)",
      "Penyertaan logo resmi, nama lembaga, dan KOP sekolah di seluruh layar ujian",
      "Sertifikat keamanan HTTPS/SSL otomatis aktif tanpa biaya tambahan",
      "Meningkatkan wibawa dan rasa bangga seluruh civitas akademika sekolah",
      "Akses mandiri proktor ruangan dan guru tanpa tercampur sekolah lain"
    ],
    actionText: "Cek Ketersediaan Domain Sekolah",
    actionLink: "https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20cek%20subdomain%20khusus%20untuk%20sekolah%20kami..."
  },
  {
    id: "dukungan-proktor",
    icon: MessageCircle,
    badge: "Dukungan Penuh Proktor",
    title: "Pendampingan Teknis Siaga via WhatsApp",
    summary: "Kami mendampingi sekolah Anda secara langsung. Dari input naskah soal, simulasi gladi bersih, hingga hari H pelaksanaan ujian, tim teknis kami siap memandu via WhatsApp (0853 5990 7696) hingga ujian sukses.",
    points: [
      "Pendampingan langsung proktor ruangan dari tim teknis pengembang sistem",
      "Panduan langkah demi langkah proses input naskah soal dan data peserta",
      "Pendampingan gladi bersih / simulasi pra-ujian hingga seluruh siswa terbiasa",
      "Siaga penuh di jam pelaksanaan ujian resmi untuk respon cepat kendala mendadak",
      "Komunikasi langsung via WhatsApp tanpa sistem tiket yang lambat (0853 5990 7696)",
      "Garansi kelancaran evaluasi ujian sekolah hingga nilai akhir selesai diexport"
    ],
    actionText: "Hubungi Pendampingan WA",
    actionLink: "https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20pendampingan%20teknis%20proktor%20ujian..."
  }
];

const FeaturesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      {/* Top Navbar */}
      <nav className="sticky top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <img src="/logo-exam-aa.png" alt="EXAM AA" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight block leading-tight">
                EXAM AA
              </span>
              <span className="text-[11px] font-semibold text-blue-600 block leading-none">
                Platform CBT Sekolah
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors px-3 py-2 rounded-xl hover:bg-slate-50"
            >
              <ArrowLeft size={14} />
              <span>Kembali ke Beranda</span>
            </button>
            <button
              onClick={() => navigate("/daftar")}
              className="h-10 px-4 sm:px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>Uji Coba Gratis</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <section className="pt-12 sm:pt-16 pb-10 px-4 sm:px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-full text-xs font-bold text-blue-700 mb-4">
          <Sparkles size={14} className="text-blue-600" />
          <span>Katalog Fitur CBT Lengkap & Resmi</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
          Mengapa Guru & Sekolah <br />
          <span className="text-blue-600">Memilih EXAM AA?</span>
        </h1>
        <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto font-normal">
          Dirancang dari kebutuhan nyata guru di kelas dan panitia ujian di sekolah. Semua fitur praktis, siap pakai, dan mudah dipahami tanpa perlu instalasi rumit.
        </p>

        {/* Action Pills */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <CheckCircle size={14} className="text-emerald-500" /> 8 Solusi End-to-End
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <CheckCircle size={14} className="text-emerald-500" /> Siap Ujian SD, SMP, SMA/SMK
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <CheckCircle size={14} className="text-emerald-500" /> Pendampingan WA Siaga
          </span>
        </div>
      </section>

      {/* 8 Feature Cards Detail Grid */}
      <section className="py-8 sm:py-12 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {allFeaturesData.map((feat, idx) => (
            <div
              key={feat.id}
              id={feat.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Badge & Icon Header */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                    {feat.badge}
                  </span>
                  <div className="w-11 h-11 rounded-xl bg-blue-50/80 border border-blue-100 text-blue-600 flex items-center justify-center">
                    <feat.icon size={22} />
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 leading-snug">
                  {feat.title}
                </h2>

                {/* Description */}
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6 font-normal">
                  {feat.summary}
                </p>

                {/* Bullet Points */}
                <div className="space-y-2 mb-6 pt-4 border-t border-slate-100">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Keunggulan Utama:
                  </div>
                  {feat.points.map((pt, pIdx) => (
                    <div key={pIdx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                      <Check size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <a
                  href={feat.actionLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors py-1 group/btn"
                >
                  <span>{feat.actionText}</span>
                  <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                </a>
                <span className="text-xs font-mono font-bold text-slate-300">0{idx + 1}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 px-4 sm:px-6 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-blue-700 to-blue-800 rounded-3xl p-8 sm:p-12 text-white text-center shadow-xl shadow-blue-700/20 relative overflow-hidden">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
            Siap Menguji Coba EXAM AA di Sekolah Anda?
          </h2>
          <p className="text-blue-100 text-xs sm:text-sm max-w-xl mx-auto mb-8 leading-relaxed font-normal">
            Dapatkan akses simulasi gratis hingga 50 siswa. Uji proteksi APK Kiosk, import naskah Word, dan rasakan kemudahan evaluasi digital.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => navigate("/daftar")}
              className="w-full sm:w-auto h-12 px-7 rounded-xl bg-white text-blue-800 hover:bg-blue-50 font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Mulai Uji Coba Gratis</span>
              <ArrowRight size={15} />
            </button>
            <a
              href="https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20konsultasi%20penggunaan%20CBT%20untuk%20sekolah%20kami..."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto h-12 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <MessageCircle size={16} />
              <span>Chat WhatsApp: 0853 5990 7696</span>
            </a>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-4 sm:px-6 text-slate-500 text-center">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shadow-2xs">
              <img src="/logo-exam-aa.png" alt="EXAM AA" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">EXAM AA</span>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-1.5 text-xs text-slate-600 font-medium">
            <button onClick={() => navigate("/")} className="hover:text-blue-600 transition-colors">
              Beranda
            </button>
            <button onClick={() => navigate("/daftar")} className="hover:text-blue-600 transition-colors">
              Pendaftaran Sekolah
            </button>
            <a href="/privacy-policy.html" className="hover:text-blue-600 transition-colors">
              Kebijakan Privasi
            </a>
            <a href="/terms-of-service.html" className="hover:text-blue-600 transition-colors">
              Syarat & Ketentuan
            </a>
            <a
              href="https://wa.me/6285359907696"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors"
            >
              WhatsApp Support
            </a>
          </div>

          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} EXAM AA · Platform CBT Sekolah Indonesia. Dikembangkan oleh Alfaruq Asri.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default FeaturesPage;
