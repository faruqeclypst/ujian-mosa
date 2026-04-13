import { 
  Settings2, 
  Atom, 
  Palette, 
  Users2, 
  TrendingUp, 
  Library
} from "lucide-react";

export const QUESTIONS = [
  // Realistic (R)
  { id: 1, text: "Saya suka merakit atau memperbaiki peralatan mekanik/elektronik.", category: "R" },
  { id: 2, text: "Saya lebih suka bekerja dengan benda atau alat daripada dengan orang.", category: "R" },
  { id: 3, text: "Saya menikmati kegiatan di luar ruangan seperti berkemah atau bertani.", category: "R" },
  { id: 4, text: "Saya tertarik mempelajari cara mengoperasikan mesin industri atau berat.", category: "R" },
  { id: 5, text: "Saya senang membuat benda dari kayu, logam, atau bahan fisik lainnya.", category: "R" },
  
  // Investigative (I)
  { id: 6, text: "Saya suka memecahkan masalah matematika atau teka-teki logika yang sulit.", category: "I" },
  { id: 7, text: "Saya tertarik mempelajari cara kerja alam semesta melalui sains.", category: "I" },
  { id: 8, text: "Saya senang melakukan riset atau eksperimen untuk menemukan hal baru.", category: "I" },
  { id: 9, text: "Saya suka menganalisis data untuk menemukan pola yang tersembunyi.", category: "I" },
  { id: 10, text: "Saya senang membaca jurnal ilmiah atau berita tentang penemuan terbaru.", category: "I" },

  // Artistic (A)
  { id: 11, text: "Saya senang mengekspresikan diri melalui seni, musik, atau tulisan.", category: "A" },
  { id: 12, text: "Saya suka berimajinasi dan menciptakan sesuatu yang orisinal.", category: "A" },
  { id: 13, text: "Saya lebih suka bekerja dalam lingkungan yang bebas dan tidak kaku.", category: "A" },
  { id: 14, text: "Saya tertarik pada bidang desain visual, mode, atau dekorasi interior.", category: "A" },
  { id: 15, text: "Saya senang mencoba teknik seni baru atau instrumen musik baru.", category: "A" },

  // Social (S)
  { id: 16, text: "Saya merasa bahagia saat bisa membantu orang lain memecahkan masalah mereka.", category: "S" },
  { id: 17, text: "Saya senang mengajar atau menjelaskan sesuatu kepada orang lain.", category: "S" },
  { id: 18, text: "Saya suka bekerja dalam tim dan menjalin hubungan sosial yang erat.", category: "S" },
  { id: 19, text: "Saya tertarik pada kegiatan relawan atau pengabdian masyarakat.", category: "S" },
  { id: 20, text: "Saya senang mendengarkan cerita orang lain dan memberikan dukungan moral.", category: "S" },

  // Enterprising (E)
  { id: 21, text: "Saya percaya diri saat harus memimpin sebuah kelompok atau tim.", category: "E" },
  { id: 22, text: "Saya tertarik untuk memulai bisnis atau menjual sebuah ide/produk.", category: "E" },
  { id: 23, text: "Saya suka tantangan dalam meyakinkan orang lain untuk mengikuti pandangan saya.", category: "E" },
  { id: 24, text: "Saya senang mengambil risiko untuk mencapai keuntungan atau kesuksesan.", category: "E" },
  { id: 25, text: "Saya tertarik pada bidang politik, manajemen, atau negosiasi bisnis.", category: "E" },

  // Conventional (C)
  { id: 26, text: "Saya suka mengatur data, file, atau jadwal secara sistematis.", category: "C" },
  { id: 27, text: "Saya lebih nyaman bekerja dengan instruksi yang jelas dan terstruktur.", category: "C" },
  { id: 28, text: "Saya teliti dalam memeriksa angka atau detail dalam sebuah laporan.", category: "C" },
  { id: 29, text: "Saya senang membuat daftar prioritas atau alur kerja yang rapi.", category: "C" },
  { id: 30, text: "Saya lebih suka tugas yang membutuhkan ketelitian tinggi daripada kreativitas bebas.", category: "C" },
];

export const JURUSAN_DATA: Record<string, { 
  title: string; 
  desc: string; 
  icon: any; 
  recommendations: string[];
  suggestedSubjects: string;
  kedinasanSaran: string;
  color: string;
  bgGradient: string;
}> = {
  R: {
    title: "Teknik & Teknologi (Realistic)",
    desc: "Kamu tipe praktis yang suka bekerja dengan alat dan hasil nyata.",
    icon: Settings2,
    recommendations: ["Teknik Mesin", "Teknik Elektro", "Teknik Sipil", "Otomotif", "Sistem Informasi"],
    suggestedSubjects: "BIOLOGI FISIKA",
    kedinasanSaran: "Sekolah Tinggi Meteorologi (STMKG) atau Politeknik Imigrasi.",
    color: "rose",
    bgGradient: "from-rose-600 to-rose-800"
  },
  I: {
    title: "Sains & Riset (Investigative)",
    desc: "Kamu pemikir analotis yang suka memecahkan masalah kompleks.",
    icon: Atom,
    recommendations: ["Kedokteran", "Data Science", "Farmasi", "Astronomi", "Bioteknologi"],
    suggestedSubjects: "FISIKA KIMIA",
    kedinasanSaran: "Sekolah Tinggi Intelijen Negara (STIN) atau STIS (Statistika).",
    color: "blue",
    bgGradient: "from-blue-600 to-blue-800"
  },
  A: {
    title: "Seni & Kreatif (Artistic)",
    desc: "Kamu memiliki imajinasi tinggi dan pandangan unik terhadap dunia.",
    icon: Palette,
    recommendations: ["DKV", "Arsitektur", "Seni Rupa", "Film & TV", "Desain Produk"],
    suggestedSubjects: "SENI & DESAIN",
    kedinasanSaran: "Cenderung ke Perguruan Tinggi Seni atau Desain (Bukan Jalur Kedinasan Utama).",
    color: "purple",
    bgGradient: "from-purple-600 to-purple-800"
  },
  S: {
    title: "Sosial & Kemanusiaan (Social)",
    desc: "Kamu memiliki empati tinggi dan senang membantu orang lain.",
    icon: Users2,
    recommendations: ["Psikologi", "Pendidikan", "Hukum", "Keperawatan", "Hubungan Masyarakat"],
    suggestedSubjects: "SOSIOLOGI - PSIKOLOGI",
    kedinasanSaran: "IPDN (Pemerintahan) atau Poltekip (Pemasyarakatan).",
    color: "emerald",
    bgGradient: "from-emerald-600 to-emerald-800"
  },
  E: {
    title: "Bisnis & Kepemimpinan (Enterprising)",
    desc: "Kamu pemimpin alami yang persuasif dan suka tantangan.",
    icon: TrendingUp,
    recommendations: ["Manajemen Bisnis", "Hukum Ekonomi", "Marketing", "Hubungan Internasional"],
    suggestedSubjects: "EKONOMI TIK",
    kedinasanSaran: "PKN STAN (Akuntansi/Pajak) atau Akademi Militer/Kepolisian.",
    color: "orange",
    bgGradient: "from-orange-600 to-orange-800"
  },
  C: {
    title: "Organisasi & Administrasi (Conventional)",
    desc: "Kamu sangat terorganisir, teliti, dan disiplin dalam data.",
    icon: Library,
    recommendations: ["Akuntansi", "Administrasi Negara", "Aktuaria", "Audit", "Perbankan"],
    suggestedSubjects: "MATEMATIKA - EKONOMI",
    kedinasanSaran: "Politeknik Keuangan Negara (PKN STAN) atau STIS.",
    color: "indigo",
    bgGradient: "from-indigo-600 to-indigo-800"
  }
};
