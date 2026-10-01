import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, Zap, ArrowRight, CheckCircle, Building2, Menu, X, Globe,
  Wand2, MessageCircle, Check, Siren, Sparkles, BarChart3,
  FileSpreadsheet, Users, HelpCircle, Phone, Smartphone, Laptop,
  Lock, ArrowUpRight, Star, GraduationCap, ChevronDown, ChevronLeft, ChevronRight,
  Eye, Clock, AlertTriangle, Play, Pause, FileText, Search,
  Server, XCircle, AlertCircle, Crown, CreditCard
} from "lucide-react";
import { cn } from "../../lib/utils";
import { getDomainSuffix } from "../../utils/domainHelper";

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [activeFaqCategory, setActiveFaqCategory] = useState<string>("semua");
  const [faqSearchQuery, setFaqSearchQuery] = useState<string>("");
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"bulanan" | "semester" | "tahunan">("bulanan");

  // Luxury Interactive Gallery State
  const [activeSlide, setActiveSlide] = useState(0);
  const [isGalleryHovered, setIsGalleryHovered] = useState(false);

  const gallerySlides = [
    {
      id: "login",
      title: "01. Portal Login Siswa",
      badge: "Keamanan Akun",
      category: "Alur Siswa",
      desc: "Antarmuka login yang bersih dan ramah siswa. Dilengkapi logo sekolah Anda sendiri dan pemilih mode gelap/terang.",
      image: "/gallery/1-login.png",
      url: "sekolahanda.examku.my.id/login",
      tagline: "Akses Akun Terverifikasi"
    },
    {
      id: "dashboard",
      title: "02. Dashboard & Agenda Ujian",
      badge: "Pusat Siswa",
      category: "Alur Siswa",
      desc: "Siswa dapat melihat jadwal ujian yang sedang aktif, identitas kelas/NISN, serta ringkasan pencapaian akademik.",
      image: "/gallery/2-dashboard.png",
      url: "sekolahanda.examku.my.id/dashboard",
      tagline: "Agenda Ujian Real-Time"
    },
    {
      id: "token",
      title: "03. Verifikasi Token Ujian",
      badge: "Proteksi Ujian",
      category: "Alur Siswa",
      desc: "Ujian terlindungi dengan kode token 6 digit yang dibagikan proktor ruangan untuk memastikan siswa mulai tepat waktu.",
      image: "/gallery/3-token.png",
      url: "sekolahanda.examku.my.id/cbt/token-gate",
      tagline: "Akses Terproteksi Token"
    },
    {
      id: "rules",
      title: "04. Konfirmasi & Aturan Ujian",
      badge: "Kepatuhan Ujian",
      category: "Alur Siswa",
      desc: "Informasi transparan jumlah soal, durasi waktu, serta batas toleransi mode layar penuh sebelum siswa memulai pengerjaan.",
      image: "/gallery/4-rules.png",
      url: "sekolahanda.examku.my.id/cbt/konfirmasi",
      tagline: "Tata Tertib Terpantau"
    },
    {
      id: "exam",
      title: "05. Lembar Pengerjaan Soal CBT",
      badge: "Ruang Ujian Interaktif",
      category: "Alur Siswa",
      desc: "Navigasi nomor soal 1-25 cepat, timer hitung mundur siaga, status koneksi hijau, dan rendering peta/gambar resolusi tinggi.",
      image: "/gallery/5-exam.png",
      url: "sekolahanda.examku.my.id/cbt/workspace",
      tagline: "Pengalaman Ujian Cepat & Mulus"
    },
    {
      id: "focus",
      title: "06. Kunci Mode Fokus Layar Penuh",
      badge: "Kunci Layar Native",
      category: "Keamanan",
      desc: "Sistem mewajibkan mode Full Screen terkunci. Siswa tidak dapat membuka tab lain atau aplikasi contekan di latar belakang.",
      image: "/gallery/6-focus.png",
      url: "sekolahanda.examku.my.id/cbt/fullscreen-lock",
      tagline: "Wajib Layar Penuh"
    },
    {
      id: "warning",
      title: "07. Peringatan Pelanggaran Otomatis",
      badge: "Alarm & Anti Curang",
      category: "Keamanan",
      desc: "Deteksi instan saat siswa berupaya keluar aplikasi atau split-screen. Muncul peringatan batas pelanggaran (2/2) dan sirine alarm kencang.",
      image: "/gallery/7-warning.png",
      url: "sekolahanda.examku.my.id/cbt/pelanggaran",
      tagline: "Sirine Alarm & Deteksi Curang"
    },
    {
      id: "locked",
      title: "08. Ujian Terkunci & Pembekuan Sesi",
      badge: "Penalti Keamanan",
      category: "Keamanan",
      desc: "Siswa yang melampaui batas pelanggaran (3/2) otomatis dibekukan dengan hitung mundur penalti keamanan untuk efek jera.",
      image: "/gallery/11-locked.png",
      url: "sekolahanda.examku.my.id/cbt/freeze-penalty",
      tagline: "Pembekuan Sesi Pelanggar"
    },
    {
      id: "multi",
      title: "09. Pilihan Ganda Kompleks",
      badge: "Standar AKM / ANBK",
      category: "Ragam Soal",
      desc: "Mendukung format pilihan ganda kompleks di mana siswa dapat memilih lebih dari satu jawaban benar dengan counter opsi terpilih.",
      image: "/gallery/8-multi.png",
      url: "sekolahanda.examku.my.id/cbt/soal-kompleks",
      tagline: "Pilih Semua Jawaban Benar"
    },
    {
      id: "matrix",
      title: "10. Soal Matriks Benar / Salah",
      badge: "Evaluasi Logika",
      category: "Ragam Soal",
      desc: "Tipe soal tabel matriks interaktif untuk mengevaluasi tiap baris pernyataan dengan validasi kelengkapan visual otomatis.",
      image: "/gallery/9-matrix.png",
      url: "sekolahanda.examku.my.id/cbt/soal-matriks",
      tagline: "Pernyataan Benar / Salah"
    },
    {
      id: "incomplete",
      title: "11. Validasi Jawaban Belum Lengkap",
      badge: "Asisten Siswa Cerdas",
      category: "Ragam Soal",
      desc: "Mencegah siswa salah pencet selesai saat masih ada butir kosong. Sistem merangkum butir nomor yang terlewat dan memberi tombol lompat instan.",
      image: "/gallery/10-incomplete.png",
      url: "sekolahanda.examku.my.id/cbt/cek-kelengkapan",
      tagline: "Cegah Soal Terlewat"
    },
    {
      id: "analytics",
      title: "12. Analisis Butir Soal Psikometri",
      badge: "Standar Depdiknas",
      category: "Panel Guru",
      desc: "Evaluasi otomatis tingkat kesukaran (P), daya pembeda (D), point-biserial, efektivitas pengecoh, dan Decision Engine rekomendasi perbaikan instrumen.",
      image: "/gallery/12-analytics.png",
      url: "sekolahanda.examku.my.id/admin/analisis-butir-soal",
      tagline: "Psikometri Arikunto & CTT"
    },
    {
      id: "editor",
      title: "13. Bank Soal & Editor Rumus LaTeX",
      badge: "Kelola Soal Praktis",
      category: "Panel Guru",
      desc: "Penyusunan butir soal kaya format dengan editor rumus matematika KaTeX/LaTeX, paket stimulus literasi bersama, dan gambar cover ilustrasi.",
      image: "/gallery/13-editor.png",
      url: "sekolahanda.examku.my.id/admin/bank-soal/tambah",
      tagline: "Mendukung KaTeX & Formula"
    },
    {
      id: "word-template",
      title: "14. Import Soal dari Word (.docx)",
      badge: "Format Standar Sekolah",
      category: "Panel Guru",
      desc: "Guru dapat menyusun soal langsung di Microsoft Word menggunakan template tabel dan KOP resmi sekolah untuk di-import otomatis tanpa ketik ulang.",
      image: "/gallery/14-word-template.png",
      url: "sekolahanda.examku.my.id/admin/bank-soal/import-word",
      tagline: "Tarik Otomatis dari Word"
    }
  ];

  // Auto-play Gallery slides every 4.5 seconds when not hovered
  useEffect(() => {
    if (isGalleryHovered) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % gallerySlides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isGalleryHovered, gallerySlides.length]);

  // Animated Tech Stack Marquee (from the beloved old version, now with 3D luxury touch)
  const techStackRow1 = [
    { name: "React 18", desc: "UI Reaktif", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" },
    { name: "TypeScript", desc: "Type Safe", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" },
    { name: "Tailwind CSS", desc: "Modern Styling", logo: "https://www.vectorlogo.zone/logos/tailwindcss/tailwindcss-icon.svg" },
    { name: "Vite 5", desc: "Instant Bundler", logo: "https://vitejs.dev/logo.svg" },
    { name: "Bun", desc: "High Performance", logo: "https://bun.sh/logo.svg" },
    { name: "Cloudflare CDN", desc: "Global Edge", logo: "https://www.vectorlogo.zone/logos/cloudflare/cloudflare-icon.svg" },
  ];

  const techStackRow2 = [
    { name: "PocketBase", desc: "Embedded Backend", logo: "https://pocketbase.io/images/logo.svg" },
    { name: "Capacitor Native", desc: "Android Kiosk", logo: "https://icon.icepanel.io/Technology/svg/Capacitor.svg" },
    { name: "KaTeX Math", desc: "Fast Equation", logo: "https://katex.org/img/katex-logo.svg" },
    { name: "Framer Motion", desc: "Smooth FX", logo: "https://framerusercontent.com/images/Io89FonxEaWg4nxvQQllVLwPUUI.png" },
    { name: "Radix UI", desc: "Accessible", logo: "https://avatars.githubusercontent.com/u/75042455?s=200&v=4" },
    { name: "Lucide Icons", desc: "Crisp Vectors", logo: "https://lucide.dev/logo.light.svg" }
  ];

  const features = [
    {
      icon: Shield,
      title: "Anti-Curang Native: APK Android & iOS SEB",
      desc: "Perangkat Android menggunakan aplikasi native APK EXAM AA dengan proteksi Kiosk, deteksi split-screen, dan sirine alarm volume kencang jika mencoba curang. Pengguna iPhone & iPad terintegrasi resmi dengan Safe Exam Browser (SEB). Keamanan selalu diperbarui secara berkala.",
      badge: "Android & iOS Terproteksi",
    },
    {
      icon: FileText,
      title: "Import Naskah Word & Export e-Rapor Excel",
      desc: "Guru tidak perlu ketik manual satu per satu. Cukup ketik naskah di Microsoft Word (.docx) berformat tabel standar dengan KOP sekolah untuk import instan beserta gambar & stimulus. Nilai akhir langsung diexport ke format Excel (.xlsx) rapi siap cetak e-Rapor.",
      badge: "Standar Format Sekolah",
    },
    {
      icon: Wand2,
      title: "Pembuat Soal & Stimulus Otomatis dengan AI",
      desc: "Cukup masukkan modul ajar atau dokumen materi, sistem AI cerdas EXAM AA akan otomatis merancang butir soal AKM/ANBK, bacaan stimulus literasi, kunci jawaban, dan rumus matematika KaTeX siap pakai dalam hitungan detik.",
      badge: "Hemat Waktu Guru",
    },
    {
      icon: BarChart3,
      title: "Analisis Butir Soal Standar Kementerian",
      desc: "Menyaring soal berkualitas tinggi menggunakan metode psikometri Classical Test Theory (CTT) standar Prof. Arikunto & Depdiknas: Tingkat Kesukaran (P), Daya Pembeda (D), Point-Biserial (r_pb), Efektivitas Pengecoh, dan Decision Engine rekomendasi perbaikan instrumen.",
      badge: "Standar Psikometri Nasional",
    },
    {
      icon: Zap,
      title: "Server Anti-Lag Akselerasi Cloudflare Edge CDN",
      desc: "Didukung jaringan Cloudflare CDN berkecepatan tinggi di puluhan server edge. Ribuan siswa menekan tombol mulai serentak tanpa antrean, tanpa lag, dan auto-save jawaban ke cloud per detik meski jaringan internet sekolah sempat terputus.",
      badge: "Akselerasi Global Edge",
    },
    {
      icon: Sparkles,
      title: "Desain UI/UX Sangat Ramah Guru & Siswa",
      desc: "Antarmuka dirancang bersih, intuitif, dan manusiawi. Guru senior dapat mengoperasikan tanpa kendala teknis dan tanpa perlu pelatihan rumit. Siswa mengerjakan soal dengan nyaman dan fokus di smartphone, tablet, maupun laptop.",
      badge: "Mudah Dipahami Siapa Saja",
    },
    {
      icon: Building2,
      title: "Subdomain Khusus & Identitas Resmi Sekolah",
      desc: "Siswa dan guru mengakses sistem melalui alamat web resmi sekolah Anda (contoh: sman1.examku.my.id atau custom domain sekolah) lengkap dengan logo dan nama sekolah sendiri. Meningkatkan kredibilitas dan wibawa lembaga.",
      badge: "Identitas Sekolah Mandiri",
    },
    {
      icon: MessageCircle,
      title: "Pendampingan Teknis Siaga via WhatsApp",
      desc: "Kami mendampingi sekolah Anda secara langsung. Dari input naskah soal, simulasi gladi bersih, hingga hari H pelaksanaan ujian, tim teknis kami siap memandu via WhatsApp (0853 5990 7696) hingga ujian sukses.",
      badge: "Dukungan Penuh Proktor",
    }
  ];

  const handleFeatureLearnMore = (index: number) => {
    switch (index) {
      case 0:
        setActiveSlide(5);
        document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
        break;
      case 1:
        setActiveSlide(13);
        document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
        break;
      case 2:
        setActiveSlide(12);
        document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
        break;
      case 3:
        setActiveSlide(11);
        document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
        break;
      case 4:
        document.getElementById("technology")?.scrollIntoView({ behavior: "smooth" });
        break;
      case 5:
        setActiveSlide(4);
        document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
        break;
      case 6:
        document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
        break;
      case 7:
        window.open(
          "https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20konsultasi%20pendampingan%20teknis%20proktor%20ujian...",
          "_blank",
          "noopener,noreferrer"
        );
        break;
      default:
        document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const steps = [
    {
      num: "01",
      title: "Daftar & Dapatkan Web Sekolah",
      desc: "Cukup daftarkan nama sekolah Anda, alamat portal ujian (sekolah.examku.my.id) langsung siap digunakan dalam hitungan menit."
    },
    {
      num: "02",
      title: "Input Soal atau Buat Pakai AI",
      desc: "Guru dapat menginput soal langsung, mengimpor dari file Word/Excel, atau memakai generator AI untuk membuat naskah soal otomatis."
    },
    {
      num: "03",
      title: "Siswa Ujian, Nilai Langsung Selesai",
      desc: "Siswa mengerjakan dari HP atau laptop dengan aman. Hasil evaluasi langsung terekap otomatis dan siap diunduh ke Excel."
    }
  ];

  const plans = [
    {
      name: "Paket Berkembang",
      quota: "Maks. 250 Siswa",
      desc: "Pilihan pas untuk SD, SMP, & bimbingan belajar",
      highlight: false,
      cta: "Pilih Paket Berkembang",
      pricing: {
        bulanan: {
          price: "380.000",
          oldPrice: "400.000",
          period: "/ bulan",
          discountBadge: "Diskon 5%",
          subtext: "Dibayar bulanan fleksibel"
        },
        semester: {
          price: "2.100.000",
          oldPrice: "2.400.000",
          period: "/ 6 bulan",
          discountBadge: "Hemat 12%",
          subtext: "Setara Rp 350.000 / bulan"
        },
        tahunan: {
          price: "3.840.000",
          oldPrice: "4.800.000",
          period: "/ tahun",
          discountBadge: "Hemat 20%",
          subtext: "Setara Rp 320.000 / bulan"
        }
      },
      features: [
        "Akses Jaringan CDN & Ujian Anti-Lag",
        "APK Kiosk & Alarm HP Berbunyi Otomatis",
        "8 Tipe Soal Ujian Lengkap",
        "Import Word, Excel & Generator AI",
        "Papan Pantau Pengawas Real-Time",
        "Pendampingan Teknis via WhatsApp"
      ],
    },
    {
      name: "Paket Lanjutan",
      quota: "Maks. 500 Siswa",
      desc: "Standar favorit untuk SMP & SMA/SMK",
      highlight: true,
      cta: "Pilih Paket Lanjutan",
      pricing: {
        bulanan: {
          price: "760.000",
          oldPrice: "800.000",
          period: "/ bulan",
          discountBadge: "Diskon 5%",
          subtext: "Dibayar bulanan fleksibel"
        },
        semester: {
          price: "4.200.000",
          oldPrice: "4.800.000",
          period: "/ 6 bulan",
          discountBadge: "Hemat 12%",
          subtext: "Setara Rp 700.000 / bulan"
        },
        tahunan: {
          price: "7.680.000",
          oldPrice: "9.600.000",
          period: "/ tahun",
          discountBadge: "Hemat 20%",
          subtext: "Setara Rp 640.000 / bulan"
        }
      },
      features: [
        "Semua fitur di Paket Berkembang",
        "Kapasitas 500 Siswa Serentak",
        "Server Prioritas Anti-Lag",
        "Subdomain Resmi (sekolah.examku.my.id)",
        "Analisis Butir Soal & Ekspor Nilai",
        "Sesi Panduan Guru & Admin via Zoom"
      ],
    },
    {
      name: "Paket Premium",
      quota: "Maks. 1.000 Siswa",
      desc: "Untuk sekolah besar, yayasan, & perguruan tinggi",
      highlight: false,
      cta: "Pilih Paket Premium",
      pricing: {
        bulanan: {
          price: "1.235.000",
          oldPrice: "1.300.000",
          period: "/ bulan",
          discountBadge: "Diskon 5%",
          subtext: "Dibayar bulanan fleksibel"
        },
        semester: {
          price: "6.840.000",
          oldPrice: "7.800.000",
          period: "/ 6 bulan",
          discountBadge: "Hemat 12%",
          subtext: "Setara Rp 1.140.000 / bulan"
        },
        tahunan: {
          price: "12.480.000",
          oldPrice: "15.600.000",
          period: "/ tahun",
          discountBadge: "Hemat 20%",
          subtext: "Setara Rp 1.040.000 / bulan"
        }
      },
      features: [
        "Semua fitur di Paket Lanjutan",
        "Kapasitas 1.000 Siswa Serentak",
        "Resource Server Prioritas Khusus",
        "Dukungan Custom Domain Sekolah",
        "Bank Soal Kolaborasi Antar Guru",
        "Pendampingan Teknis Siaga Saat Ujian"
      ],
    },
  ];

  const faqs = [
    {
      category: "server",
      shortBadge: "Tanpa Server Fisik",
      q: "Apakah sekolah kami harus punya server komputer sendiri?",
      a: "Tidak perlu. EXAM AA berbasis cloud terkelola penuh. Sekolah cukup menyediakan koneksi internet atau WiFi tanpa perlu membeli server fisik maupun sewa VPS."
    },
    {
      category: "keamanan",
      shortBadge: "APK Kiosk & iOS SEB",
      q: "Bagaimana proteksi anti-contek di Android dan iOS (iPhone/iPad)?",
      a: "Android menggunakan APK Kiosk dengan kunci layar penuh, deteksi split-screen, dan sirine alarm jika curang. Pengguna iPhone & iPad terintegrasi otomatis dengan Safe Exam Browser (SEB) resmi."
    },
    {
      category: "guru",
      shortBadge: "Import Word Instan",
      q: "Apakah guru bisa import soal langsung dari Microsoft Word (.docx)?",
      a: "Bisa. Tersedia template Word (.docx) berformat tabel standar dengan KOP sekolah. Cukup upload file Word dan sistem otomatis mengimpor teks, gambar, dan stimulus soal."
    },
    {
      category: "guru",
      shortBadge: "Pembuat Soal AI",
      q: "Bagaimana cara kerja fitur pembuatan soal otomatis dengan AI?",
      a: "Cukup upload modul ajar atau materi pelajaran. AI akan menyusun butir soal AKM, stimulus bacaan, kunci jawaban, dan rumus matematika secara instan."
    },
    {
      category: "guru",
      shortBadge: "Psikometri Standar",
      q: "Apa itu fitur Analisis Butir Soal Psikometri standar Kementerian?",
      a: "Sistem otomatis menghitung Tingkat Kesukaran (P), Daya Pembeda (D), korelasi Point-Biserial, dan efektivitas pengecoh untuk menilai kelayakan butir soal sesuai kaidah ilmiah."
    },
    {
      category: "guru",
      shortBadge: "Export e-Rapor",
      q: "Apakah nilai siswa bisa langsung diekspor ke Excel untuk format e-Rapor?",
      a: "Ya. Nilai terkoreksi otomatis begitu ujian selesai dan dapat langsung diunduh ke format Excel (.xlsx) siap pakai untuk e-Rapor."
    },
    {
      category: "keamanan",
      shortBadge: "Auto-Save Cloud",
      q: "Bagaimana jika koneksi internet di sekolah sempat putus saat ujian?",
      a: "Jawaban tersimpan otomatis ke cloud server per detik. Jika koneksi terputus atau ganti perangkat, siswa dapat melanjutkan tanpa kehilangan jawaban."
    },
    {
      category: "server",
      shortBadge: "Simulasi Gratis",
      q: "Bisakah kami mencoba sistem ini terlebih dahulu secara gratis?",
      a: "Bisa. Tersedia uji coba simulasi gratis hingga 50 siswa untuk mencoba bank soal, APK Kiosk, dan kestabilan sistem sebelum memutuskan berlangganan."
    },
    {
      category: "server",
      shortBadge: "Pendampingan WhatsApp",
      q: "Bagaimana jika sekolah kami membutuhkan bantuan atau pendampingan teknis?",
      a: "Tim teknis kami siaga memandu langsung via WhatsApp (0853 5990 7696) mulai dari input data, simulasi gladi bersih, hingga hari H ujian."
    }
  ];

  const faqCategories = [
    { id: "semua", label: "Semua Pertanyaan", count: faqs.length },
    { id: "keamanan", label: "Proteksi Anti-Curang", count: faqs.filter((f) => f.category === "keamanan").length },
    { id: "guru", label: "Kemudahan Guru & Soal", count: faqs.filter((f) => f.category === "guru").length },
    { id: "server", label: "Server & Dukungan", count: faqs.filter((f) => f.category === "server").length },
  ];

  const filteredFaqs = faqs.filter((faq) => {
    const matchCategory = activeFaqCategory === "semua" || faq.category === activeFaqCategory;
    const matchSearch =
      faqSearchQuery.trim() === "" ||
      faq.q.toLowerCase().includes(faqSearchQuery.toLowerCase()) ||
      faq.a.toLowerCase().includes(faqSearchQuery.toLowerCase()) ||
      faq.shortBadge.toLowerCase().includes(faqSearchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">

      {/* Ambient 3D Mesh Gradient Blobs */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute top-[35%] -right-32 w-[550px] h-[550px] bg-sky-400/10 rounded-full blur-[130px] animate-pulse-glow" style={{ animationDelay: "2.5s" }} />
        <div className="absolute bottom-10 left-1/3 w-[500px] h-[500px] bg-teal-400/10 rounded-full blur-[140px] animate-pulse-glow" style={{ animationDelay: "5s" }} />
      </div>

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 text-white text-xs py-2 px-4 text-center font-medium shadow-sm flex items-center justify-center gap-2 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.15),transparent)] animate-marquee" />
        <span className="inline-flex items-center justify-center bg-white/20 text-white rounded-full px-2.5 py-0.5 text-[11px] font-bold">
          Promo Ujian 2026
        </span>
        <span className="relative z-10">Dapatkan potongan 5% untuk semua paket langganan bulanan EXAM AA.</span>
        <button
          onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
          className="relative z-10 underline font-bold hover:text-blue-100 ml-1"
        >
          Lihat Paket
        </button>
      </div>

      {/* Navbar - Clean without "Masuk Portal" button as requested */}
      <nav className="sticky top-0 left-0 right-0 z-[100] bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo Brand */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:shadow-md transition-all duration-300">
              <img
                src="/logo-exam-aa.png"
                alt="Logo EXAM AA"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight block leading-tight">
                EXAM AA
              </span>
              <span className="text-[11px] font-semibold text-blue-600 block leading-none">
                Platform CBT Sekolah
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1 text-sm font-semibold text-slate-600">
            <button
              onClick={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })}
              className="px-3.5 py-2 rounded-xl hover:text-blue-700 hover:bg-blue-50/60 transition-colors"
            >
              Galeri Sistem
            </button>
            <button
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="px-3.5 py-2 rounded-xl hover:text-blue-700 hover:bg-blue-50/60 transition-colors"
            >
              Fitur Unggulan
            </button>
            <button
              onClick={() => document.getElementById("technology")?.scrollIntoView({ behavior: "smooth" })}
              className="px-3.5 py-2 rounded-xl hover:text-blue-700 hover:bg-blue-50/60 transition-colors"
            >
              Teknologi
            </button>
            <button
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              className="px-3.5 py-2 rounded-xl hover:text-blue-700 hover:bg-blue-50/60 transition-colors"
            >
              Paket Harga
            </button>
            <button
              onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}
              className="px-3.5 py-2 rounded-xl hover:text-blue-700 hover:bg-blue-50/60 transition-colors"
            >
              Tanya Jawab
            </button>
          </div>

          {/* Right Action Button (Masuk Portal removed per user request) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate("/daftar")}
              className="h-10 sm:h-11 px-5 sm:px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/25 transition-all hover:shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <span>Uji Coba Gratis</span>
              <ArrowRight size={15} />
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-2 text-sm font-medium text-slate-700 shadow-xl">
            <button
              onClick={() => { document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" }); setMobileMenuOpen(false); }}
              className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-slate-50 font-semibold"
            >
              Galeri Sistem
            </button>
            <button
              onClick={() => { document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }); setMobileMenuOpen(false); }}
              className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-slate-50 font-semibold"
            >
              Fitur Unggulan
            </button>
            <button
              onClick={() => { document.getElementById("technology")?.scrollIntoView({ behavior: "smooth" }); setMobileMenuOpen(false); }}
              className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-slate-50 font-semibold"
            >
              Teknologi
            </button>
            <button
              onClick={() => { document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }); setMobileMenuOpen(false); }}
              className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-slate-50 font-semibold"
            >
              Biaya & Paket Harga
            </button>
            <button
              onClick={() => { document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" }); setMobileMenuOpen(false); }}
              className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-slate-50 font-semibold"
            >
              Tanya Jawab
            </button>
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={() => navigate("/daftar")}
                className="w-full py-3 px-3 rounded-xl bg-blue-600 text-white text-center font-bold text-xs shadow-md shadow-blue-600/20 hover:bg-blue-700"
              >
                Daftarkan Sekolah Sekarang
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section from previous commit */}
      <section className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center py-16 sm:py-20 px-4 sm:px-6 lg:px-12 z-10 overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:32px_32px] z-0" />

        {/* Blue glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 shadow-xs rounded-full px-4 py-1.5 mb-8 hover:border-blue-300 transition-colors cursor-default">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-700 text-xs sm:text-sm font-semibold">Platform CBT Anti Curang</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.15] tracking-tight mb-6 text-slate-900">
            Platform Ujian Sekolah <br />
            <span className="relative inline-block mt-2">
              <span className="text-blue-600">Terpercaya</span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6C40 2 80 2 100 4C120 6 160 4 198 2" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
              </svg>
            </span>{" "}
            & Profesional
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            EXAM AA membantu <span className="text-blue-600 font-bold">sekolah / universitas (umum)</span> mengadakan pelaksanaan ujian online dengan lancar. Tidak ada lagi kendala teknis atau aplikasi down saat ujian berlangsung.
          </p>

          <div className="flex flex-col sm:flex-row gap-3.5 justify-center items-center">
            <button
              onClick={() => navigate("/daftar")}
              className="w-full sm:w-auto group flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 sm:h-14 px-7 sm:px-8 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/25 text-sm sm:text-base active:scale-95"
            >
              <span>Daftar Gratis Sekarang</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="w-full sm:w-auto flex items-center justify-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold h-12 sm:h-14 px-7 sm:px-8 rounded-xl transition-all hover:border-slate-400 text-sm sm:text-base active:scale-95"
            >
              Lihat Fitur
            </button>
          </div>

          {/* Browser URL preview */}
          <div className="mx-auto mt-10 w-full max-w-sm bg-white border border-slate-200 shadow-md rounded-xl p-3 text-left relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600" />
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-slate-500 flex items-center">
              <Globe size={13} className="text-slate-400 flex-shrink-0 mr-2" />
              <span className="text-slate-900 font-bold">sekolahanda</span>
              <span className="text-slate-500">{getDomainSuffix()}</span>
            </div>
          </div>

          {/* Trust indicators - Only 2 requested badges */}
          <div className="mt-8 flex items-center justify-center gap-3 sm:gap-4 flex-wrap text-xs sm:text-sm text-slate-700 font-semibold">
            <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors">
              <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
              <span>APK Android Kiosk & iOS Safe Exam Browser</span>
            </span>
            <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors">
              <CheckCircle size={16} className="text-blue-600 flex-shrink-0" />
              <span>Cloudflare CDN Anti-Lag 99.98%</span>
            </span>
          </div>
        </div>
      </section>

      {/* LUXURY INTERACTIVE AUTO-PLAYING GALLERY SHOWCASE */}
      <section id="gallery" className="py-16 sm:py-24 px-4 sm:px-6 bg-white border-y border-slate-200/80 relative">
        <div className="max-w-6xl mx-auto">
          {/* Section Heading */}
          <div className="text-center max-w-3xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 px-3.5 py-1 rounded-full text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">
              <Sparkles size={14} className="text-blue-600" />
              Galeri Sistem Resmi EXAM AA · 14 Tampilan Nyata
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Tampilan Nyata Platform yang Elegan & Mudah Digunakan
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2">
              Jelajahi alur lengkap ujian digital: dari portal login, proteksi sanksi penalti otomatis, ragam soal AKM/ANBK, hingga panel guru dengan psikometri Arikunto & import Word (.docx).
            </p>
          </div>

          {/* Category Filter Pills for Quick Jumping (4 Categories) */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            <button
              onClick={() => setActiveSlide(0)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                activeSlide < 5
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />
              Alur Siswa (1–5)
            </button>
            <button
              onClick={() => setActiveSlide(5)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                activeSlide >= 5 && activeSlide < 8
                  ? "bg-rose-600 text-white shadow-sm shadow-rose-500/25"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              <Siren size={13} />
              Keamanan & Sanksi (6–8)
            </button>
            <button
              onClick={() => setActiveSlide(8)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                activeSlide >= 8 && activeSlide < 11
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/25"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              <CheckCircle size={13} />
              Ragam Soal AKM (9–11)
            </button>
            <button
              onClick={() => setActiveSlide(11)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                activeSlide >= 11
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              <BarChart3 size={13} />
              Panel Guru & Analisis (12–14)
            </button>
          </div>

          {/* Interactive Luxury Screen Carousel Container */}
          <div
            className="relative max-w-5xl mx-auto"
            onMouseEnter={() => setIsGalleryHovered(true)}
            onMouseLeave={() => setIsGalleryHovered(false)}
          >
            {/* 3D Browser Window Frame */}
            <div className="bg-slate-900 rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 shadow-2xl shadow-slate-900/25 border border-slate-800 transition-all duration-500 relative">

              {/* Browser Header Bar */}
              <div className="bg-slate-800/90 rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between gap-4 border border-slate-700/60">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500 shadow-xs" />
                  <div className="w-3 h-3 rounded-full bg-amber-500 shadow-xs" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs" />
                  <div className="ml-3 hidden sm:flex items-center gap-2 bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300">
                    <Lock size={12} className="text-emerald-400" />
                    <span>https://{gallerySlides[activeSlide].url}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/70 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live System
                  </span>

                  {/* Play/Pause state indicator */}
                  <div className="text-slate-400 text-xs hidden sm:flex items-center gap-1">
                    {isGalleryHovered ? <Pause size={13} /> : <Play size={13} className="text-emerald-400" />}
                    <span className="text-[10px]">{isGalleryHovered ? "Dijeda" : "Otomatis"}</span>
                  </div>
                </div>
              </div>

              {/* Screen Viewer Canvas */}
              <div className="relative rounded-xl overflow-hidden bg-slate-950 min-h-[320px] sm:min-h-[520px] flex items-center justify-center">
                {gallerySlides.map((slide, idx) => (
                  <div
                    key={slide.id}
                    className={cn(
                      "absolute inset-0 transition-all duration-700 ease-out flex items-center justify-center p-1 sm:p-2",
                      activeSlide === idx
                        ? "opacity-100 scale-100 z-10 pointer-events-auto"
                        : "opacity-0 scale-98 z-0 pointer-events-none"
                    )}
                  >
                    <img
                      src={slide.image}
                      alt={slide.title}
                      className="w-full h-full object-contain rounded-lg"
                    />

                    {/* Overlay Label Banner */}
                    <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md bg-slate-950/90 backdrop-blur-md border border-slate-800 text-white p-3.5 sm:p-4 rounded-xl shadow-2xl">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
                            {slide.badge}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {slide.category}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-300">{idx + 1} / {gallerySlides.length}</span>
                      </div>
                      <h4 className="font-bold text-sm sm:text-base text-white">{slide.title}</h4>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed hidden sm:block font-normal">
                        {slide.desc}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Left/Right Floating Navigation Arrows */}
                <button
                  onClick={() => setActiveSlide((prev) => (prev - 1 + gallerySlides.length) % gallerySlides.length)}
                  className="absolute left-3 sm:left-4 z-20 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white backdrop-blur-md border border-slate-700 flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95"
                  aria-label="Previous Screenshot"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setActiveSlide((prev) => (prev + 1) % gallerySlides.length)}
                  className="absolute right-3 sm:right-4 z-20 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white backdrop-blur-md border border-slate-700 flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95"
                  aria-label="Next Screenshot"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Slide Progress Indicator Bar (14 segments) */}
              <div
                className="grid gap-1 mt-3 px-1"
                style={{ gridTemplateColumns: `repeat(${gallerySlides.length}, minmax(0, 1fr))` }}
              >
                {gallerySlides.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setActiveSlide(i)}
                    className="h-1.5 rounded-full bg-slate-800 cursor-pointer overflow-hidden relative"
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        activeSlide === i ? "bg-blue-500 w-full" : "w-0"
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Minimalist Elegant Slide Navigation Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3.5 mt-5 px-1">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 shadow-2xs">
                  {String(activeSlide + 1).padStart(2, "0")} / {String(gallerySlides.length).padStart(2, "0")}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-800">
                  {gallerySlides[activeSlide].title.replace(/^\d+\.\s*/, "")}
                </span>
                <span className="text-xs text-slate-400 hidden md:inline">
                  · {gallerySlides[activeSlide].tagline}
                </span>
              </div>

              {/* Prev / Next Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveSlide((prev) => (prev - 1 + gallerySlides.length) % gallerySlides.length)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs hover:border-slate-300 active:scale-95"
                >
                  <ChevronLeft size={15} />
                  <span>Sebelumnya</span>
                </button>
                <button
                  onClick={() => setActiveSlide((prev) => (prev + 1) % gallerySlides.length)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs hover:border-slate-300 active:scale-95"
                >
                  <span>Selanjutnya</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features - Simplified, Clean & Responsive */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full mb-3">
              Fitur Lengkap & Praktis
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Mengapa Guru & Sekolah Memilih EXAM AA?
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed">
              Dirancang dari kebutuhan nyata guru di kelas dan panitia ujian di sekolah. Semua fitur praktis, siap pakai, dan mudah dipahami.
            </p>
          </div>

          {/* Simple, Responsive 2-Column Card Grid (Displaying 4 core highlights) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {features.slice(0, 4).map((feat, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:border-blue-400/80 hover:shadow-lg transition-all duration-200 group"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50/90 px-3 py-1 rounded-lg border border-blue-100">
                      {feat.badge}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 group-hover:text-blue-600 group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors">
                      <feat.icon size={20} />
                    </div>
                  </div>

                  <h3 className="font-bold text-base sm:text-lg text-slate-900 mb-2.5 group-hover:text-blue-600 transition-colors leading-snug">
                    {feat.title}
                  </h3>

                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-normal mb-5">
                    {feat.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleFeatureLearnMore(i)}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors py-1 group/btn focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                    aria-label={`Pelajari selengkapnya tentang ${feat.title}`}
                  >
                    <span>Pelajari selengkapnya</span>
                    <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                  <span className="text-[11px] font-mono font-medium text-slate-300">0{i + 1}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Read More button to open dedicated page */}
          <div className="mt-10 sm:mt-12 text-center flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => navigate("/fitur")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 hover:shadow-lg transition-all active:scale-95 group"
            >
              <span>Buka Halaman Khusus Seluruh Fitur Lengkap</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20konsultasi%20fitur%20CBT%20untuk%20sekolah..."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs sm:text-sm transition-all shadow-2xs hover:border-slate-300 active:scale-95"
            >
              <MessageCircle size={15} className="text-emerald-600" />
              <span>Konsultasi Fitur via WhatsApp</span>
            </a>
          </div>
        </div>
      </section>

      {/* ANIMATED TECH STACK MARQUEE (BELOVED OLD VERSION WITH 3D LUXURY EFFECT) */}
      <section id="technology" className="py-20 bg-white overflow-hidden border-y border-slate-200/80 relative">
        {/* Soft edge blur overlays */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center mb-14 px-4">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wider">
            <Zap size={13} />
            Arsitektur Teknologi Kelas Dunia
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Teknologi Modern di Balik Keandalan <span className="text-blue-600">EXAM AA</span>
          </h2>
          <p className="mt-3 text-slate-600 text-sm max-w-xl mx-auto leading-relaxed">
            Demi ujian yang stabil tanpa downtime, kami membangun sistem CBT dengan stack teknologi terkini berkecepatan tinggi dan berstandar internasional.
          </p>
        </div>

        {/* Marquee Row 1: Scrolling Left */}
        <div className="flex w-max animate-marquee whitespace-nowrap gap-6 items-center mb-6 hover:[animation-play-state:paused]">
          {[...techStackRow1, ...techStackRow1, ...techStackRow1].map((tech, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 bg-slate-50 hover:bg-white border border-slate-200/90 hover:border-blue-300 rounded-2xl px-5 py-3 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-default"
            >
              <img
                src={tech.logo}
                alt={tech.name}
                className="h-8 w-auto object-contain grayscale group-hover:grayscale-0 transition-all duration-300 group-hover:scale-110"
              />
              <div className="text-left">
                <span className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors block">
                  {tech.name}
                </span>
                <span className="text-[10px] text-slate-400 block font-medium">
                  {tech.desc}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Marquee Row 2: Scrolling Right */}
        <div className="flex w-max animate-marquee-reverse whitespace-nowrap gap-6 items-center hover:[animation-play-state:paused]">
          {[...techStackRow2, ...techStackRow2, ...techStackRow2].map((tech, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 bg-slate-50 hover:bg-white border border-slate-200/90 hover:border-blue-300 rounded-2xl px-5 py-3 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-default"
            >
              <img
                src={tech.logo}
                alt={tech.name}
                className="h-8 w-auto object-contain grayscale group-hover:grayscale-0 transition-all duration-300 group-hover:scale-110"
              />
              <div className="text-left">
                <span className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors block">
                  {tech.name}
                </span>
                <span className="text-[10px] text-slate-400 block font-medium">
                  {tech.desc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works - Semudah 3 Langkah Praktis */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 bg-white border-y border-slate-200/80">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full mb-3 inline-block">
              Mudah & Cepat
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Pelaksanaan Ujian Semudah 3 Langkah
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-2">
              Tidak ada proses instalasi yang rumit. Sekolah Anda bisa langsung mulai dalam waktu kurang dari 24 jam.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((st, i) => (
              <div key={i} className="bg-slate-50 border border-slate-200/90 rounded-2xl p-6 relative flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <span className="text-3xl font-black text-blue-300 block mb-2 font-mono">{st.num}</span>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{st.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - Exact Rates Requested */}
      <section id="pricing" className="py-20 sm:py-28 px-4 sm:px-6 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full mb-3">
              Biaya Hemat & Transparan
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Pilihan Paket Langganan CBT Sekolah
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed">
              Semua paket sudah termasuk Cloudflare CDN, aplikasi APK Kiosk anti-contek, dan proteksi server anti-lag. Pilihan fleksibel bulanan, paket per semester (6 bulan), dan paket hemat 1 tahun.
            </p>
          </div>

          {/* Billing Cycle Selector (Bulanan / Semester / 1 Tahun) */}
          <div className="flex justify-center mb-10 sm:mb-14">
            <div className="inline-flex items-center p-1.5 bg-slate-200/70 backdrop-blur-xs rounded-2xl border border-slate-300/70 shadow-inner gap-1">
              <button
                type="button"
                onClick={() => setBillingCycle("bulanan")}
                className={cn(
                  "px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer",
                  billingCycle === "bulanan"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Bulanan (1 Bulan)
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("semester")}
                className={cn(
                  "px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  billingCycle === "semester"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <span>Paket Semester (6 Bulan)</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">
                  Hemat 12%
                </span>
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("tahunan")}
                className={cn(
                  "px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  billingCycle === "tahunan"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <span>Paket 1 Tahun (12 Bulan)</span>
                <span className="text-[10px] bg-blue-600 text-white font-extrabold px-2 py-0.5 rounded-full">
                  Hemat 20%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {plans.map((plan, i) => {
              const currentPricing = plan.pricing[billingCycle];
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-3xl border p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 relative",
                    plan.highlight
                      ? "bg-white border-blue-600 shadow-2xl shadow-blue-600/15 ring-2 ring-blue-600 md:-translate-y-2"
                      : "bg-white border-slate-200/90 shadow-sm hover:border-slate-300 hover:shadow-md"
                  )}
                >
                  <div>
                    {plan.highlight && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md uppercase tracking-wider flex items-center gap-1">
                        <Sparkles size={13} className="text-amber-300" />
                        <span>Populer</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-extrabold text-lg text-slate-900">{plan.name}</h3>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {currentPricing.discountBadge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mb-6">{plan.desc}</p>

                    <div className="mb-6">
                      {currentPricing.oldPrice && (
                        <div className="flex items-center gap-2 mb-1 text-xs">
                          <span className="line-through text-slate-400">Rp {currentPricing.oldPrice}</span>
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">Harga Normal</span>
                        </div>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-bold text-slate-500">Rp</span>
                        <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                          {currentPricing.price}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">{currentPricing.period}</span>
                      </div>
                      <p className="text-[11px] font-medium text-emerald-600 mt-1">
                        {currentPricing.subtext}
                      </p>
                    </div>

                    <div className="inline-block bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-lg mb-6 border border-blue-100">
                      {plan.quota}
                    </div>

                    <ul className="space-y-3 mb-8 text-xs sm:text-sm text-slate-700 font-medium">
                      {plan.features.map((feat, j) => (
                        <li key={j} className="flex items-center gap-2.5">
                          <CheckCircle size={16} className="text-blue-600 flex-shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      const cycleLabel =
                        billingCycle === "bulanan"
                          ? "1 Bulan"
                          : billingCycle === "semester"
                            ? "Semester (6 Bulan)"
                            : "1 Tahun (12 Bulan)";
                      navigate("/daftar", {
                        state: { selectedPlan: `${plan.name} (${cycleLabel})` },
                      });
                    }}
                    className={cn(
                      "w-full h-11 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer",
                      plan.highlight
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25"
                        : "bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                    )}
                  >
                    <span>{plan.cta}</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Custom Package Banner */}
          <div className="border border-slate-200 bg-white rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                <Building2 size={24} />
              </div>
              <div>
                <span className="inline-block bg-blue-50 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded mb-1">
                  Kapasitas Besar & Yayasan
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Butuh Paket Kustom atau Lebih dari 1.000 Siswa?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mt-1 leading-relaxed">
                  Untuk yayasan multi-sekolah, dinas pendidikan, atau kampus dengan kebutuhan server mandiri dan ribuan siswa serentak, hubungi kami untuk proposal penawaran khusus.
                </p>
              </div>
            </div>
            <a
              href="https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20konsultasi%20Paket%20Kustom%20CBT%20untuk%20sekolah/institusi%20kami..."
              target="_blank"
              rel="noopener noreferrer"
              className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 shadow-sm flex-shrink-0"
            >
              <MessageCircle size={16} />
              Hubungi CS via WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 px-4 sm:px-6 bg-white border-t border-slate-200/90">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-14">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200/80 px-3.5 py-1.5 rounded-full mb-3 shadow-2xs">
              <Sparkles size={14} className="text-blue-600" />
              Perbandingan Jelas & Transparan
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Kenapa Memilih Layanan Managed EXAM AA?
            </h3>
            <p className="text-slate-600 text-xs sm:text-sm mt-2 leading-relaxed">
              Bandingkan antara sistem cloud siap pakai EXAM AA, SaaS biasa, dan script yang di-install sendiri di server sekolah.
            </p>
          </div>

          {/* Clean & Neat Table Container */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="py-4 px-5 font-bold text-slate-700 w-1/4 border-r border-slate-200/80">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold mb-0.5">
                        Parameter
                      </span>
                      <span className="text-sm font-extrabold text-slate-800">
                        Kriteria Penilaian
                      </span>
                    </th>
                    <th className="py-4 px-5 font-bold bg-blue-50/70 border-r border-blue-200 text-slate-900 w-1/4">
                      <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md mb-1 shadow-2xs">
                        <Crown size={11} className="text-amber-300" />
                        <span>Rekomendasi Utama</span>
                      </span>
                      <div className="text-sm font-black text-blue-950">
                        EXAM AA (Siap Pakai)
                      </div>
                      <span className="text-[11px] font-semibold text-blue-700 block">
                        Managed Cloud Terkelola
                      </span>
                    </th>
                    <th className="py-4 px-5 font-bold text-slate-700 w-1/4 border-r border-slate-200/80">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold mb-0.5">
                        Alternatif 1
                      </span>
                      <div className="text-sm font-bold text-slate-800">
                        Platform SaaS Lain
                      </div>
                      <span className="text-[11px] font-normal text-slate-500 block">
                        Vendor CBT Konvensional
                      </span>
                    </th>
                    <th className="py-4 px-5 font-bold text-slate-700 w-1/4">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold mb-0.5">
                        Alternatif 2
                      </span>
                      <div className="text-sm font-bold text-slate-800">
                        Install Sendiri di VPS
                      </div>
                      <span className="text-[11px] font-normal text-slate-500 block">
                        Self-Hosted / Script
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {/* Row 1: Biaya Bulanan */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-5 bg-slate-50/40 border-r border-slate-200/80">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">
                        Biaya Bulanan
                      </div>
                      <span className="text-[11px] text-slate-400 font-normal block mt-0.5">
                        Investasi & transparansi
                      </span>
                    </td>
                    <td className="py-4 px-5 bg-blue-50/20 border-r border-blue-200/80">
                      <div className="text-xs sm:text-sm font-black text-blue-900">
                        Mulai Rp 380rb / bln
                      </div>
                      <span className="inline-block text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md mt-1">
                        Sudah termasuk CDN & Kiosk
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600 border-r border-slate-200/80">
                      <div className="text-xs sm:text-sm font-semibold text-slate-800">
                        Rp 300rb - 995rb / bln
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        Fitur proteksi berbayar terpisah
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      <div className="text-xs sm:text-sm font-semibold text-slate-800">
                        Sewa VPS Rp 200rb - 800rb/bln
                      </div>
                      <span className="text-[11px] text-rose-600 font-medium block mt-1">
                        Belum biaya teknisi IT
                      </span>
                    </td>
                  </tr>

                  {/* Row 2: Performa Jam Ujian */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-5 bg-slate-50/40 border-r border-slate-200/80">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">
                        Performa Jam Ujian
                      </div>
                      <span className="text-[11px] text-slate-400 font-normal block mt-0.5">
                        Kestabilan jam sibuk serentak
                      </span>
                    </td>
                    <td className="py-4 px-5 bg-blue-50/20 border-r border-blue-200/80">
                      <div className="text-xs sm:text-sm font-black text-blue-900">
                        Cloudflare CDN (Anti-Lag)
                      </div>
                      <span className="inline-block text-[11px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md mt-1">
                        Garansi 99.98% tanpa antrean
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600 border-r border-slate-200/80">
                      <div className="text-xs sm:text-sm font-semibold text-slate-800">
                        Standar / Tergantung Paket
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        Shared resource, rawan antrean saat login massal
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      <div className="text-xs sm:text-sm font-semibold text-slate-800">
                        Rentan lemot jika VPS minim
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        CPU 100% saat siswa akses serentak
                      </span>
                    </td>
                  </tr>

                  {/* Row 3: Urus Server & Linux */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-5 bg-slate-50/40 border-r border-slate-200/80">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">
                        Urus Server & Linux
                      </div>
                      <span className="text-[11px] text-slate-400 font-normal block mt-0.5">
                        Pemeliharaan & backup
                      </span>
                    </td>
                    <td className="py-4 px-5 bg-blue-50/20 border-r border-blue-200/80">
                      <div className="text-xs sm:text-sm font-black text-blue-900">
                        Dikelola Penuh oleh Kami
                      </div>
                      <span className="inline-block text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md mt-1">
                        Guru & Panitia Bebas Repot
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600 border-r border-slate-200/80">
                      <div className="text-xs sm:text-sm font-semibold text-slate-800">
                        Dikelola Vendor
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        Konfigurasi terbatas, harus kirim tiket antrean
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      <div className="text-xs sm:text-sm font-semibold text-slate-800">
                        Sekolah harus urus sendiri
                      </div>
                      <span className="text-[11px] text-rose-600 font-medium block mt-1">
                        Wajib punya admin IT / teknisi Linux
                      </span>
                    </td>
                  </tr>

                  {/* Row 4: Alarm HP Anti-Curang */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-5 bg-slate-50/40 border-r border-slate-200/80">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">
                        Alarm HP Anti-Curang
                      </div>
                      <span className="text-[11px] text-slate-400 font-normal block mt-0.5">
                        Ketertiban ruang ujian
                      </span>
                    </td>
                    <td className="py-4 px-5 bg-blue-50/20 border-r border-blue-200/80">
                      <div className="text-xs sm:text-sm font-black text-blue-900">
                        Kunci Layar + Alarm Suara HP
                      </div>
                      <span className="inline-block text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md mt-1">
                        APK Kiosk & iOS SEB Terintegrasi
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600 border-r border-slate-200/80">
                      <div className="text-xs sm:text-sm font-semibold text-slate-800">
                        Kunci layar dasar (Safe Browser)
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        Tanpa alarm suara kencang di ruangan
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      <div className="text-xs sm:text-sm font-semibold text-slate-800">
                        Tergantung setelan teknisi
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        Mudah dibobol siswa lewat web browser biasa
                      </span>
                    </td>
                  </tr>

                  {/* Row 5: Pendampingan Ujian */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-5 bg-slate-50/40 border-r border-slate-200/80">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">
                        Pendampingan Ujian
                      </div>
                      <span className="text-[11px] text-slate-400 font-normal block mt-0.5">
                        Support teknis & gladi
                      </span>
                    </td>
                    <td className="py-4 px-5 bg-blue-50/20 border-r border-blue-200/80">
                      <div className="text-xs sm:text-sm font-black text-blue-900">
                        Langsung via WhatsApp & Zoom
                      </div>
                      <span className="inline-block text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md mt-1">
                        Respon Cepat Siaga Hari H
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600 border-r border-slate-200/80">
                      <div className="text-xs sm:text-sm font-semibold text-slate-800">
                        Sistem tiket antrean
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        Menunggu balasan 1x24 jam saat darurat
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-600">
                      <div className="text-xs sm:text-sm font-semibold text-slate-800">
                        Mandiri tanpa bantuan
                      </div>
                      <span className="text-[11px] text-rose-600 font-medium block mt-1">
                        Panitia pusing sendiri jika terjadi crash
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Fresh Redesigned FAQ Section */}
      <section id="faq" className="py-20 sm:py-28 px-4 sm:px-6 bg-[#F8FAFC] border-t border-slate-200/90 relative overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200/80 px-3.5 py-1.5 rounded-full mb-3 shadow-2xs">
              <HelpCircle size={14} className="text-blue-600" />
              Pusat Tanya Jawab & Solusi
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Pertanyaan yang Sering Diajukan
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed">
              Jawaban transparan seputar kesiapan server, proteksi anti-curang APK Kiosk, kemudahan import naskah Word, dan pendampingan ujian resmi.
            </p>
          </div>

          {/* Split Layout: Left Info Card & Right Accordion */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Assistance & Quick Consultation */}
            <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 border border-blue-100">
                    <MessageCircle size={20} />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base mb-1">
                    Punya Pertanyaan Lain?
                  </h3>
                  <p className="text-slate-600 text-xs leading-relaxed mb-3.5">
                    Tim teknis kami siap memandu sekolah Anda via WhatsApp mulai simulasi hingga hari H.
                  </p>
                  <a
                    href="https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20tanya%20seputar%20pelaksanaan%20CBT%20di%20sekolah%20kami..."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 active:scale-95 cursor-pointer"
                  >
                    <MessageCircle size={15} />
                    <span>Chat Tim Teknis WhatsApp</span>
                  </a>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                      Uji Coba Langsung
                    </span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                      Gratis
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mb-1">
                    Coba Gratis 50 Siswa
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">
                    Uji proteksi APK Kiosk dan buat bank soal langsung untuk sekolah Anda.
                  </p>
                  <button
                    onClick={() => navigate("/daftar")}
                    className="w-full h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <span>Daftarkan Sekolah</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Search + Category Pills + Fresh Accordion List */}
            <div className="lg:col-span-8 space-y-3.5">
              {/* Search Bar & Category Filter */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-2.5">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={faqSearchQuery}
                    onChange={(e) => {
                      setFaqSearchQuery(e.target.value);
                      setOpenFaqIndex(null);
                    }}
                    placeholder="Cari pertanyaan (misal: Word, Kiosk, Server, Nilai, AI)..."
                    className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                  {faqSearchQuery && (
                    <button
                      onClick={() => setFaqSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {faqCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveFaqCategory(cat.id);
                        setOpenFaqIndex(null);
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 cursor-pointer",
                        activeFaqCategory === cat.id
                          ? "bg-slate-900 border-slate-900 text-white shadow-2xs"
                          : "bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <span>{cat.label}</span>
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                          activeFaqCategory === cat.id
                            ? "bg-slate-800 text-slate-300"
                            : "bg-slate-200 text-slate-600"
                        )}
                      >
                        {cat.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Accordion Cards */}
              {(() => {
                const isSearchOrFilterActive = faqSearchQuery.trim() !== "" || activeFaqCategory !== "semua";
                const displayedFaqs = isSearchOrFilterActive || showAllFaqs ? filteredFaqs : filteredFaqs.slice(0, 4);

                return (
                  <div className="space-y-2.5">
                    {displayedFaqs.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                        <p className="text-slate-600 text-sm font-medium mb-3">
                          Tidak ada pertanyaan yang sesuai dengan kata kunci "{faqSearchQuery}".
                        </p>
                        <button
                          onClick={() => {
                            setFaqSearchQuery("");
                            setActiveFaqCategory("semua");
                          }}
                          className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          Tampilkan Semua Pertanyaan
                        </button>
                      </div>
                    ) : (
                      <>
                        {displayedFaqs.map((faq, originalIdx) => {
                          const isOpen = openFaqIndex === originalIdx;
                          return (
                            <div
                              key={originalIdx}
                              className={cn(
                                "bg-white border rounded-2xl transition-all duration-200 overflow-hidden",
                                isOpen
                                  ? "border-blue-500/80 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/20"
                                  : "border-slate-200/90 hover:border-slate-300 shadow-2xs"
                              )}
                            >
                              <button
                                onClick={() => setOpenFaqIndex(isOpen ? null : originalIdx)}
                                className="w-full text-left p-4 sm:p-4.5 flex items-start justify-between gap-3 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl cursor-pointer"
                                aria-expanded={isOpen}
                              >
                                <div className="space-y-0.5">
                                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                                    {faq.shortBadge}
                                  </span>
                                  <span className="font-bold text-xs sm:text-sm text-slate-900 block leading-snug">
                                    {faq.q}
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 mt-0.5",
                                    isOpen
                                      ? "bg-blue-600 text-white rotate-180"
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  )}
                                >
                                  <ChevronDown size={15} />
                                </div>
                              </button>

                              {isOpen && (
                                <div className="px-4 pb-4 pt-1 sm:px-4.5 sm:pb-4 text-xs sm:text-[13px] text-slate-600 leading-relaxed border-t border-slate-100 font-normal">
                                  <p>{faq.a}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Expand / Collapse toggle for "Semua" to keep page compact */}
                        {!isSearchOrFilterActive && filteredFaqs.length > 4 && (
                          <div className="pt-2 text-center">
                            <button
                              onClick={() => setShowAllFaqs(!showAllFaqs)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs hover:border-slate-300 transition-all active:scale-95 cursor-pointer"
                            >
                              <span>
                                {showAllFaqs
                                  ? "Tampilkan Lebih Ringkas"
                                  : `Lihat Pertanyaan Lainnya (+${filteredFaqs.length - 4})`}
                              </span>
                              <ChevronDown
                                size={14}
                                className={cn(
                                  "transition-transform duration-200 text-slate-500",
                                  showAllFaqs && "rotate-180"
                                )}
                              />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Card (Luxury Call-to-Action) */}
      <section className="py-20 px-4 sm:px-6 bg-[#F8FAFC] border-t border-slate-200">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-blue-950 rounded-3xl p-8 sm:p-14 text-white text-center shadow-2xl shadow-blue-700/25 relative overflow-hidden">
            {/* Ambient Background Accents */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-bold text-white mb-6">
                <Sparkles size={14} className="text-amber-300" />
                <span>Uji Coba Gratis 50 Siswa Tanpa Biaya di Awal</span>
              </div>

              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black mb-5 tracking-tight leading-tight">
                Siap Melaksanakan Ujian Sekolah yang <br className="hidden sm:inline" />
                <span className="text-amber-300">Tertib, Aman, dan Bebas Kendala?</span>
              </h2>

              <p className="text-blue-100 text-sm sm:text-base max-w-2xl mx-auto mb-8 leading-relaxed font-normal">
                Bergabung bersama ratusan sekolah di Indonesia. Ujian anti-curang dengan APK Kiosk Android & Safe Exam Browser iOS, import soal Word instan, dan server Cloudflare Edge CDN anti-lag.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-10">
                <button
                  onClick={() => navigate("/daftar")}
                  className="w-full sm:w-auto h-12 px-8 rounded-xl bg-white text-blue-800 hover:bg-blue-50 font-bold text-sm shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>Mulai Uji Coba Gratis (50 Siswa)</span>
                  <ArrowRight size={16} />
                </button>
                <a
                  href="https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20kami%20ingin%20konsultasi%20penggunaan%20CBT%20untuk%20sekolah%20kami..."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto h-12 px-7 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5"
                >
                  <MessageCircle size={18} />
                  <span>Chat WhatsApp: 0853 5990 7696</span>
                </a>
              </div>

              {/* Confidence badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/15 text-left text-xs font-semibold text-blue-100">
                <div className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
                  <span>Anti-Curang Android & iOS</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
                  <span>Import Word & e-Rapor Excel</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
                  <span>Analisis Butir CTT Depdiknas</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
                  <span>Didampingi via WhatsApp</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-200 bg-white py-10 px-4 sm:px-6 text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-5 text-center">
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <img src="/logo-exam-aa.png" alt="EXAM AA" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-slate-900 text-base tracking-tight">EXAM AA</span>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-600 font-medium">
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-blue-600 transition-colors">
              Beranda
            </button>
            <button onClick={() => navigate("/fitur")} className="hover:text-blue-600 transition-colors">
              Fitur Lengkap
            </button>
            <button onClick={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-blue-600 transition-colors">
              Galeri Sistem
            </button>
            <button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-blue-600 transition-colors">
              Paket Harga
            </button>
            <button onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-blue-600 transition-colors">
              Tanya Jawab
            </button>
            <a href="/privacy-policy.html" className="hover:text-blue-600 transition-colors">
              Kebijakan Privasi
            </a>
            <a href="/terms-of-service.html" className="hover:text-blue-600 transition-colors">
              Syarat & Ketentuan
            </a>
            <a
              href="https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA..."
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors flex items-center gap-1.5"
            >
              <MessageCircle size={14} />
              <span>WhatsApp: 0853 5990 7696</span>
            </a>
          </div>

          <p className="text-xs text-slate-400 mt-1">
            © {new Date().getFullYear()} EXAM AA · Platform CBT Sekolah Indonesia. Dikembangkan oleh Alfaruq Asri.
          </p>
        </div>
      </footer>

      {/* Floating WhatsApp Action Button (Interactive & Premium) */}
      <a
        href="https://wa.me/6285359907696?text=Halo%20Admin%20EXAM%20AA,%20saya%20ingin%20konsultasi%20penggunaan%20CBT%20untuk%20sekolah%20kami..."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[999] flex items-center group cursor-pointer focus:outline-none"
        aria-label="Hubungi Admin WhatsApp 0853 5990 7696"
      >
        {/* Desktop Tooltip Pill */}
        <div className="hidden sm:flex items-center gap-2 mr-3 bg-white/95 backdrop-blur-md border border-slate-200/90 py-2 px-3.5 rounded-full shadow-lg text-slate-800 text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 pointer-events-none whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Chat WhatsApp: <strong className="text-emerald-600 font-extrabold">0853 5990 7696</strong></span>
        </div>

        {/* Circular Floating Button with Ping Effect */}
        <div className="relative w-12 h-12 sm:w-14 sm:h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-xl shadow-emerald-500/35 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95">
          <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20 pointer-events-none" />
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6 sm:w-7 sm:h-7 fill-current relative z-10"
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
