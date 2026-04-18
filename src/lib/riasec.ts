import {
  Settings2,
  Atom,
  Palette,
  Users2,
  TrendingUp,
  Library
} from "lucide-react";

export const QUESTIONS = [
  // Realistic (R) - Praktikal & Fisik
  { id: 1, text: "Saya senang mengutak-atik atau memperbaiki gadget, kabel, atau motor yang bermasalah di rumah.", category: "R" },
  { id: 2, text: "Saya lebih menikmati praktikum di laboratorium atau bengkel daripada hanya mendengarkan teori di kelas.", category: "R" },
  { id: 3, text: "Saya merasa bangga saat berhasil merakit sesuatu (seperti komputer atau robot) sampai bisa berfungsi.", category: "R" },
  { id: 4, text: "Saya senang dengan kegiatan luar ruangan seperti Pramuka, mendaki gunung, atau berkemah.", category: "R" },
  { id: 5, text: "Saya tertarik mempelajari cara kerja mesin pada kendaraan (pesawat, mobil, dsb) secara mendatail.", category: "R" },
  { id: 6, text: "Saya lebih suka aktivitas gerak fisik atau olahraga daripada hanya duduk diam dalam waktu lama.", category: "R" },
  { id: 7, text: "Saya merasa tertantang saat harus memecahkan masalah praktis yang membutuhkan logika mekanik di rumah/sekolah.", category: "R" },

  // Investigative (I) - Analitis & Teoritis
  { id: 8, text: "Saya sering merasa penasaran dan mencari tahu sendiri 'mengapa' dan 'bagaimana' sebuah fenomena alam terjadi.", category: "I" },
  { id: 9, text: "Saya sangat menikmati pelajaran seperti Matematika atau Fisika yang membutuhkan pemikiran logika mendalam.", category: "I" },
  { id: 10, text: "Saya senang melakukan riset kecil-kecilan di internet atau eksperimen mandiri tentang topik sains terbaru.", category: "I" },
  { id: 11, text: "Saya lebih suka membaca artikel ensiklopedia, jurnal, atau berita teknologi daripada membaca novel fiksi.", category: "I" },
  { id: 12, text: "Saya merasa puas jika berhasil memecahkan soal teka-teki logika yang dianggap sulit oleh teman-teman lain.", category: "I" },
  { id: 13, text: "Saya tertarik mempelajari tentang coding, keamanan siber, data rahasia, atau konspirasi yang butuh analisis.", category: "I" },
  { id: 14, text: "Saya lebih fokus dan produktif saat belajar atau bekerja sendirian di tempat yang tenang.", category: "I" },

  // Artistic (A) - Kreatif & Ekspresif
  { id: 15, text: "Saya sering mendapatkan ide-ide kreatif yang unik saat mengerjakan proyek seni atau tugas sekolah.", category: "A" },
  { id: 16, text: "Saya sangat menikmati kegiatan seni seperti menggambar digital, menulis cerpen, atau bermain alat musik.", category: "A" },
  { id: 17, text: "Saya merasa kurang nyaman jika harus mengikuti aturan yang terlalu kaku dan membatasi ekspresi ide saya.", category: "A" },
  { id: 18, text: "Saya senang memperhatikan detail estetika pada desain bangunan, poster sekolah, atau tampilan aplikasi.", category: "A" },
  { id: 19, text: "Saya lebih suka mengekspresikan diri melalui karya (video/gambar/musik) daripada melalui kata-kata formal.", category: "A" },
  { id: 20, text: "Saya tertarik mempelajari dunia konten kreator (YouTube/TikTok), desain grafis, fotografi, atau perfilman.", category: "A" },
  { id: 21, text: "Saya merasa paling bersemangat saat berada di lingkungan yang bebas, estetik, dan penuh inspirasi baru.", category: "A" },

  // Social (S) - Membantu & Mengajar
  { id: 22, text: "Saya merasa senang saat bisa menjadi 'tutor sebaya' bagi teman yang kesulitan memahami pelajaran di sekolah.", category: "S" },
  { id: 23, text: "Saya lebih suka bekerja dalam kelompok belajar atau berorganisasi daripada mengerjakan semuanya sendirian.", category: "S" },
  { id: 24, text: "Saya sering menjadi tempat curhat bagi teman-teman dan bisa mendengarkan masalah mereka dengan sabar.", category: "S" },
  { id: 25, text: "Saya tertarik mengikuti kegiatan bakti sosial, pengabdian masyarakat, atau komunitas kemanusiaan.", category: "S" },
  { id: 26, text: "Saya senang menjelaskan sebuah konsep atau pelajaran kepada orang lain sampai mereka benar-benar paham.", category: "S" },
  { id: 27, text: "Saya merasa mudah bergaul dan bisa cepat menyesuaikan diri di lingkungan atau pertemanan baru.", category: "S" },
  { id: 28, text: "Saya lebih memprioritaskan membantu kepentingan bersama daripada mengejar ambisi pribadi saya.", category: "S" },

  // Enterprising (E) - Memimpin & Memengaruhi
  { id: 29, text: "Saya merasa percaya diri saat harus memimpin sebuah kelompok atau menjadi ketua panitia di acara sekolah.", category: "E" },
  { id: 30, text: "Saya senang merencanakan strategi atau taktik untuk bisa memenangkan sebuah perlombaan antar kelas/sekolah.", category: "E" },
  { id: 31, text: "Saya menikmati tantangan dalam memengaruhi atau meyakinkan tim agar mendukung rencana yang saya buat.", category: "E" },
  { id: 32, text: "Saya tidak takut mengambil risiko untuk mencoba hal baru demi meraih pencapaian atau peringkat pertama.", category: "E" },
  { id: 33, text: "Saya tertarik mempelajari kepemimpinan dan manajemen lewat organisasi seperti OSIS, MPK, atau Pramuka.", category: "E" },
  { id: 34, text: "Saya memiliki jiwa kompetitif yang kuat dan selalu terdorong untuk memberikan performa terbaik dalam setiap lomba.", category: "E" },
  { id: 35, text: "Saya senang memberikan motivasi dan membakar semangat teman setim agar tetap solid mencapai target bersama.", category: "E" },

  // Conventional (C) - Sistematis & Rapi
  { id: 36, text: "Saya sangat menikmati saat bisa menyusun jadwal belajar mingguan atau tugas sekolah dengan rapi dan terencana.", category: "C" },
  { id: 37, text: "Saya merasa jauh lebih tenang jika guru memberikan panduan tugas yang sangat detail dan sistematis step-by-step.", category: "C" },
  { id: 38, text: "Saya sangat teliti dalam mengecek ulang angka-angka, typo, atau format penulisan pada tugas yang saya kumpulkan.", category: "C" },
  { id: 39, text: "Saya senang membuat daftar tugas harian (to-do list) dan merasa puas saat berhasil mencoret tugas yang selesai.", category: "C" },
  { id: 40, text: "Saya tidak keberatan melakukan tugas rutin (seperti merekap data uang kas atau presensi) asalkan datanya rapi.", category: "C" },
  { id: 41, text: "Saya lebih menyukai lingkungan yang disiplin dan mengikuti aturan daripada situasi yang berantakan/random.", category: "C" },
  { id: 42, text: "Saya merasa puas saat melihat kumpulan catatan pelajaran atau materi sekolah saya tersusun rapi dalam folder.", category: "C" },
];

export const MI_QUESTIONS = [
  // Linguistic (LIN)
  { id: 101, text: "Saya merasa mudah menuangkan ide dalam bentuk tulisan seperti artikel majalah sekolah, puisi, atau caption media sosial yang menarik.", category: "LIN" },
  { id: 102, text: "Saya sangat menikmati kegiatan debat sekolah, pidato, atau menceritakan kembali sebuah kisah kepada teman-teman.", category: "LIN" },
  { id: 103, text: "Saya senang mempelajari kosa kata baru, istilah asing, atau bahasa baru di waktu luang.", category: "LIN" },

  // Logical-Mathematical (LOG)
  { id: 104, text: "Saya lebih mudah memahami informasi jika disajikan dalam bentuk angka, grafik statistik, atau urutan kronologis yang jelas.", category: "LOG" },
  { id: 105, text: "Saya suka mencari tahu logika di balik trik sulap, teka-teki angka, atau cara kerja sebuah kode enkripsi/coding.", category: "LOG" },
  { id: 106, text: "Menyelesaikan masalah Matematika atau Fisika yang rumit dengan langkah-langkah logis memberikan kepuasan tersendiri bagi saya.", category: "LOG" },

  // Spatial-Visual (SPA)
  { id: 107, text: "Saya lebih mudah mengingat wajah orang, denah gedung sekolah, atau arah jalan dibandingkan mengingat nama mereka.", category: "SPA" },
  { id: 108, text: "Saya bisa membayangkan bentuk sebuah benda 3D dari berbagai sudut pandang hanya di dalam pikiran (seperti pada pelajaran Geometri).", category: "SPA" },
  { id: 109, text: "Saya senang menggambar sketsa, membuat desain poster, atau mengatur tata letak feed Instagram agar terlihat estetik.", category: "SPA" },

  // Bodily-Kinesthetic (KIN)
  { id: 110, text: "Saya memiliki koordinasi tubuh yang baik dan merasa gesit saat berolahraga, menari (dance), atau latihan baris-berbaris.", category: "KIN" },
  { id: 111, text: "Saya lebih mudah belajar dengan cara mencoba langsung (hands-on) di laboratorium daripada hanya membaca instruksi di buku.", category: "KIN" },
  { id: 112, text: "Saya senang menggunakan tangan saya untuk memperbaiki alat elektronik, membuat prakarya, atau memasang peralatan teknis.", category: "KIN" },

  // Musical (MUS)
  { id: 113, text: "Saya bisa dengan mudah mengenali nada yang tidak pas (fals) atau meniru pola irama dalam sebuah lagu dengan tepat.", category: "MUS" },
  { id: 114, text: "Telinga saya sangat peka terhadap suara-suara di lingkungan sekitar (seperti suara burung atau instrumen musik) yang mungkin diabaikan orang lain.", category: "MUS" },
  { id: 115, text: "Mendengarkan musik favorit atau memainkan instrumen musik sangat membantu saya untuk rileks dan berkonsentrasi saat belajar.", category: "MUS" },

  // Interpersonal (INT-R)
  { id: 116, text: "Saya memiliki kemampuan alami untuk mencairkan suasana dan mengajak teman-teman bekerja sama dalam sebuah tim/kelompok.", category: "INT-R" },
  { id: 117, text: "Saya peka terhadap perasaan dan bisa menyadari perubahan suasana hati teman-teman di sekitar saya meskipun mereka tidak mengatakannya.", category: "INT-R" },
  { id: 118, text: "Saya sering menjadi tempat bertanya atau penengah (mediator) jika ada teman yang sedang berselisih paham atau punya masalah pribadi.", category: "INT-R" },

  // Intrapersonal (INT-A)
  { id: 119, text: "Saya sangat memahami kekuatan dan kelemahan diri saya sendiri dan tahu target nilai atau pencapaian yang ingin saya kejar.", category: "INT-A" },
  { id: 120, text: "Saya sering meluangkan waktu untuk merenung sendirian dan merencanakan cita-cita masa depan saya secara mandiri.", category: "INT-A" },
  { id: 121, text: "Saya memiliki prinsip hidup yang kuat dan tidak mudah ikut-ikutan tren atau pendapat orang banyak jika itu tidak sesuai dengan hati saya.", category: "INT-A" },

  // Naturalist (NAT)
  { id: 122, text: "Saya merasa sangat tenang dan bersemangat saat berada di alam terbuka (seperti kegiatan Sispala, berkemah di gunung, atau ke pantai).", category: "NAT" },
  { id: 123, text: "Saya tertarik mempelajari ekosistem alam, jenis-jenis tanaman hias, atau cara merawat hewan piaraan dengan telaten.", category: "NAT" },
  { id: 124, text: "Saya peduli pada masalah lingkungan seperti polusi plastik atau pemanasan global dan ingin berkontribusi dalam gerakan pelestarian alam.", category: "NAT" },
];

export const JURUSAN_DATA: Record<string, {
  title: string;
  desc: string;
  icon: any;
  recommendations: string[];
  suggestedSubjects: string;
  pathType: string;
  pathTitle: string;
  pathSaran: string;
  pathDetail: string;
  dailyLife: string;
  keySkills: string[];
  longTerm: string;
  color: string;
  bgGradient: string;
  requiredMI: string[];
}> = {
  R: {
    title: "Mekanik & Keteknikan (Realistic)",
    desc: "Kamu adalah 'Sang Praktisi'. Kamu merasa paling hidup saat bekerja dengan tangan, mengutak-atik mesin, atau berada langsung di lapangan.",
    icon: Settings2,
    recommendations: ["Teknik Industri & Sistem", "Teknik Mesin & Robotik", "Teknik Sipil & Struktur", "Teknologi Pangan", "Agroteknologi & Perkebunan", "Ilmu Kelautan & Perikanan", "Teknik Lingkungan", "Logistik & Rantai Pasok"],
    suggestedSubjects: "Fisika - Kimia",
    pathType: "Kedinasan",
    pathTitle: "Analisis Jalur Kedinasan:",
    pathSaran: "PTDI-STTD (Darat), PPI Curug (Udara/Penerbangan), STMKG (BMKG).",
    pathDetail: "Sangat direkomendasikan bagi kamu yang ingin mengabdi di sektor infrastruktur, logistik, dan sistem transportasi nasional.",
    dailyLife: "Bekerja di pusat pemeliharaan teknik, operasional logistik, atau lingkungan teknis lapangan yang dinamis.",
    keySkills: ["Troubleshooting Sistem", "Ketangkasan Operasional", "Logika Mekanik", "Disiplin Standar Prosedur"],
    longTerm: "Karir profesional di BUMN Strategis, Kementerian Perhubungan, atau sebagai Tenaga Ahli Teknik di Industri Global.",
    color: "rose",
    bgGradient: "from-rose-600 to-rose-800",
    requiredMI: ["SPA", "KIN", "LOG"]
  },
  I: {
    title: "Sains & Analisis Data (Investigative)",
    desc: "Kamu adalah 'Sang Peneliti'. Duniamu adalah data, logika, dan pencarian jawaban atas pertanyaan-pertanyaan sulit.",
    icon: Atom,
    recommendations: ["Pendidikan Dokter (Umum)", "Farmasi & Farmakologi", "Ilmu Murni (Fisika/Kimia/Bio)", "Matematika & Statistika Riset", "Bio-Teknologi Molekuler", "Informatika & Data Science", "Astronomi & Astrofisika", "Arkeologi & Paleontologi"],
    suggestedSubjects: "Biologi - Kimia",
    pathType: "Kedinasan/Profesional",
    pathTitle: "Analisis Jalur Strategis:",
    pathSaran: "Poltek SSN (Sandi), STIS (Statistik), STIN (Intelijen).",
    pathDetail: "Pilihan terbaik untuk analisis data negara (STIS/SSN) atau karir peneliti profesional di industri teknologi tingkat tinggi.",
    dailyLife: "Fokus mendalam di depan layar atau laboratorium. Menganalisis pola yang tidak dilihat orang lain dan menyusun strategi berdasarkan data akurat.",
    keySkills: ["Analisa Data", "Berpikir Kritis", "Konsentrasi Tinggi", "Riset & Metodologi"],
    longTerm: "Dibutuhkan di kementerian strategis, perbankan, perusahaan teknologi (Big Tech), hingga lembaga riset internasional.",
    color: "blue",
    bgGradient: "from-blue-600 to-blue-800",
    requiredMI: ["LOG", "INT-A", "NAT"]
  },
  A: {
    title: "Ekspresi & Industri Kreatif (Artistic)",
    desc: "Kamu adalah 'Sang Kreator'. Duniamu tidak mengenal batas; kamu lebih suka menciptakan aturan sendiri daripada mengikuti yang sudah ada.",
    icon: Palette,
    recommendations: ["Arsitektur & Interior", "DKV & Branding", "Film & Sinematografi", "Seni Rupa & Kriya", "Fashion Design", "Sastra & Penulisan Kreatif", "Seni Musik/Vokal", "Animasi & Game Dev"],
    suggestedSubjects: "Ekonomi - Teknologi Informasi dan Komunikasi",
    pathType: "Profesional",
    pathTitle: "Analisis Industri Kreatif:",
    pathSaran: "Berbasis Portofolio & Jalur Universitas Umum.",
    pathDetail: "Bidang ini tidak direkomendasikan untuk Jalur Kedinasan karena aturan kaku (militer/seragam) dapat menghambat kebebasan ekspresimu.",
    dailyLife: "Bekerja di studio kreatif, agency global, atau lingkungan kolaboratif yang menghargai fleksibilitas dan ide-ide orisinal.",
    keySkills: ["Imajinasi Liar", "Detail Estetika", "Storytelling", "Penguasaan Alat Digital"],
    longTerm: "Menjadi Creative Director, Sutradara Profesional, Founder Studio Independen, atau Konsultan Visual Global.",
    color: "amber",
    bgGradient: "from-amber-500 to-amber-700",
    requiredMI: ["SPA", "MUS", "LIN"]
  },
  S: {
    title: "Kemanusiaan & Pelayanan (Social)",
    desc: "Kamu adalah 'Sang Penolong'. Kebahagiaan terbesarmu adalah saat bisa memberikan dampak positif bagi kehidupan orang lain.",
    icon: Users2,
    recommendations: ["Ilmu Keperawatan", "Kebidanan", "Kesehatan Masyarakat", "Psikologi Klinis", "Pendidikan Guru", "Ilmu Kesejahteraan Sosial", "Sosiologi", "Hubungan Masyarakat"],
    suggestedSubjects: "Biologi - Fisika",
    pathType: "Kedinasan",
    pathTitle: "Analisis Jalur Kedinasan:",
    pathSaran: "IPDN, Poltekip, atau Poltekim.",
    pathDetail: "Sangat ideal untuk pengabdian nasional di bidang Tata Kelola Pemerintahan, Hukum, dan Layanan Masyarakat.",
    dailyLife: "Membangun interaksi sosial di lingkungan profesional, mengedukasi masyarakat, dan mengelola kesejahteraan publik.",
    keySkills: ["Empati Tinggi", "Komunikasi Interpersonal", "Negosiasi & Mediasi", "Sabar & Teliti"],
    longTerm: "Menjadi pejabat publik, pimpinan lembaga kesehatan, diplomat, atau pimpinan di organisasi internasional (LSM).",
    color: "emerald",
    bgGradient: "from-emerald-600 to-emerald-800",
    requiredMI: ["INT-R", "LIN", "INT-A"]
  },
  E: {
    title: "Kepemimpinan & Bisnis (Enterprising)",
    desc: "Kamu adalah 'Sang Penggerak'. Kamu suka memegang kendali, meyakinkan orang lain, dan memenangkan kompetisi.",
    icon: TrendingUp,
    recommendations: ["Manajemen Bisnis", "Pengusaha (Entrepreneur)", "Ilmu Hukum", "Marketing & Bisnis Digital", "Hubungan Internasional", "Ilmu Politik", "Manajemen Perhotelan", "Administrasi Publik"],
    suggestedSubjects: "Ekonomi - Teknologi Informasi dan Komunikasi",
    pathType: "Kedinasan/Profesional",
    pathTitle: "Analisis Kepemimpinan:",
    pathSaran: "Akpol (Polisi) atau Akmil (TNI/AD/AL/AU).",
    pathDetail: "Sangat cocok untuk perwira pemimpin pasukan (Akmil/Akpol) atau pimpinan perusahaan/CEO di masa depan.",
    dailyLife: "Banyak melakukan presentasi, memimpin rapat, dan mengambil keputusan cepat di bawah tekanan. Fokus pada target dan pengembangan jaringan.",
    keySkills: ["Leadership", "Public Speaking", "Strategi Bisnis", "Keberanian Risiko"],
    longTerm: "CEO perusahaan besar, Pendiri Bisnis (Founder), Jenderal/Komisaris, atau Politisi berpengaruh di masa depan.",
    color: "orange",
    bgGradient: "from-orange-600 to-orange-800",
    requiredMI: ["INT-R", "LIN", "LOG"]
  },
  C: {
    title: "Administrasi & Keuangan (Conventional)",
    desc: "Kamu adalah 'Sang Pengatur'. Kamu adalah pelindung keteraturan; tanpa orang sepertimu, organisasi akan berantakan.",
    icon: Library,
    recommendations: ["Akuntansi Perpajakan", "Ilmu Aktuaria", "Administrasi Perkantoran", "Manajemen Keuangan", "Audit Keuangan", "Ilmu Perpustakaan", "Manajemen Data/Arsip", "Sistem Informasi Akuntansi"],
    suggestedSubjects: "Ekonomi - Teknologi Informasi dan Komunikasi",
    pathType: "Kedinasan/Profesional",
    pathTitle: "Analisis Tata Kelola:",
    pathSaran: "PKN STAN (Keuangan) atau STIS (Statistik).",
    pathDetail: "Pilihan utama bagi pengelolan keuangan negara (STAN) atau ahli audit dan administrasi di korporasi besar.",
    dailyLife: "Bekerja di lingkungan kantor yang terstruktur. Merapikan laporan, memastikan semua angka akurat, dan kepatuhan terhadap aturan yang berlaku.",
    keySkills: ["Ketelitian Detail", "Manajemen Arsip", "Integritas", "Ketajaman Numerik"],
    longTerm: "Analis keuangan senior, Auditor negara, Manajer Pajak, atau Direktur Administrasi di instansi pemerintahan/perusahaan multinasional.",
    color: "slate",
    bgGradient: "from-slate-600 to-slate-800",
    requiredMI: ["LOG", "INT-A", "SPA"]
  }
};
