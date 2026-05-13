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
  { id: 1, text: "Saat prakarya, saya lebih suka merakit alat, menyolder kabel, atau membuat prototipe fisik daripada hanya menggambar desainnya.", category: "R" },
  { id: 2, text: "Saya merasa lebih paham pelajaran Fisika atau Kimia jika guru langsung mengajak praktikum di laboratorium daripada teori di kelas.", category: "R" },
  { id: 3, text: "Saya sering memperbaiki sendiri barang yang rusak di rumah atau sekolah (seperti kipas angin, stopkontak, atau rantai sepeda).", category: "R" },
  { id: 4, text: "Saya lebih menikmati kegiatan ekstrakurikuler yang banyak aktivitas fisik di luar ruangan (Sispala, Paskibra, atau Pramuka tingkat lanjut).", category: "R" },
  { id: 5, text: "Saya lebih suka membaca manual cara kerja sebuah mesin/kendaraan bermotor daripada membaca buku fiksi/novel sastra.", category: "R" },
  { id: 6, text: "Saya sangat tidak suka jika harus bekerja atau belajar sambil terus duduk diam di depan komputer atau meja selama berjam-jam.", category: "R", isNegative: false },
  { id: 7, text: "Saya merasa sangat lelah jika disuruh melakukan aktivitas fisik atau olahraga berat di sekolah.", category: "R", isNegative: true }, // Lie Scale/Consistency

  // Investigative (I) - Analitis & Teoritis
  { id: 8, text: "Saat mendapat tugas kelompok Biologi/Sejarah, saya lebih suka bagian menganalisis data dan mencari sumber literatur terpercaya.", category: "I" },
  { id: 9, text: "Saya sangat tertantang menyelesaikan soal Matematika Tingkat Lanjut atau Fisika yang membutuhkan pemikiran logika yang dalam.", category: "I" },
  { id: 10, text: "Saya sering membaca artikel sains, teknologi, atau jurnal penelitian terbaru meskipun tidak ditugaskan oleh guru.", category: "I" },
  { id: 11, text: "Saya lebih suka mencari tahu sendiri 'mengapa' dan 'bagaimana' sebuah fenomena alam atau fenomena sosial bisa terjadi.", category: "I" },
  { id: 12, text: "Saya benci saat disuruh menghafal rumus tanpa diberi tahu dari mana asal-usul atau logika dasar rumus tersebut.", category: "I" },
  { id: 13, text: "Saya sangat tertarik belajar coding, pemrograman, atau mencari tahu celah keamanan (cyber security) dari sebuah website.", category: "I" },
  { id: 14, text: "Saya sama sekali tidak tertarik memikirkan teka-teki logika atau soal-soal olimpiade sains yang rumit.", category: "I", isNegative: true }, // Consistency

  // Artistic (A) - Kreatif & Ekspresif
  { id: 15, text: "Dalam tugas presentasi, saya orang yang paling peduli mengatur desain PPT, memilih font, dan memadukan warna agar terlihat estetik.", category: "A" },
  { id: 16, text: "Saya merasa sangat bosan jika harus mengikuti aturan sekolah yang terlalu kaku dan membatasi ekspresi ide kreatif saya.", category: "A" },
  { id: 17, text: "Saya menghabiskan waktu luang untuk menggambar, menulis cerpen/puisi, membuat video estetik, atau bermain alat musik.", category: "A" },
  { id: 18, text: "Saya memiliki selera yang kuat dalam berpakaian (fashion), dekorasi kamar, atau penataan feed media sosial pribadi saya.", category: "A" },
  { id: 19, text: "Saya lebih suka mengekspresikan perasaan lewat karya (gambar/musik/video) daripada berbicara formal di depan banyak orang.", category: "A" },
  { id: 20, text: "Saya bercita-cita berkarir di industri kreatif seperti menjadi content creator, desainer grafis, sutradara, atau arsitek.", category: "A" },
  { id: 21, text: "Saya lebih suka mengerjakan tugas yang formatnya baku dan pasti (seperti pilihan ganda) daripada tugas seni yang bebas.", category: "A", isNegative: true }, // Consistency

  // Social (S) - Membantu & Mengajar
  { id: 22, text: "Saya sering menjadi 'tempat curhat' teman-teman karena saya sabar mendengarkan dan memahami perasaan mereka.", category: "S" },
  { id: 23, text: "Saya merasa bahagia saat bisa membantu teman yang kesulitan memahami pelajaran (menjadi tutor sebaya).", category: "S" },
  { id: 24, text: "Saya lebih suka belajar kelompok dan berdiskusi interaktif daripada harus memahami semuanya sendirian di kamar.", category: "S" },
  { id: 25, text: "Saya sangat tertarik mengikuti kegiatan kerelawanan, bakti sosial, atau OSIS bagian pengabdian masyarakat.", category: "S" },
  { id: 26, text: "Saya mudah bergaul, gampang mengobrol dengan anak baru, dan cepat beradaptasi di lingkungan pertemanan yang berbeda.", category: "S" },
  { id: 27, text: "Saya rela mengesampingkan kepentingan pribadi saya asalkan kelompok belajar atau kelas saya bisa rukun dan sukses.", category: "S" },
  { id: 28, text: "Saya merasa malas jika harus terus-menerus berurusan dengan masalah atau konflik perasaan orang lain.", category: "S", isNegative: true }, // Consistency

  // Enterprising (E) - Memimpin & Memengaruhi
  { id: 29, text: "Saya sering mencalonkan diri atau dipilih menjadi ketua kelas, ketua kelompok, atau koordinator acara di sekolah.", category: "E" },
  { id: 30, text: "Saya memiliki kemampuan negosiasi yang baik, misalnya membujuk guru untuk mengundur jadwal ulangan atau presentasi.", category: "E" },
  { id: 31, text: "Saya sangat berambisi untuk memenangkan perlombaan (class meeting, pidato, dsb) dan senang menyusun strategi kemenangannya.", category: "E" },
  { id: 32, text: "Saya tertarik pada dunia bisnis, seperti berjualan makanan di kelas, membuat clothing brand, atau menjadi pengusaha muda.", category: "E" },
  { id: 33, text: "Saya percaya diri berbicara di depan umum untuk memengaruhi, memotivasi, atau membakar semangat teman-teman.", category: "E" },
  { id: 34, text: "Saya tidak ragu mengambil risiko atau tantangan besar di kepanitiaan acara sekolah demi hasil yang spektakuler.", category: "E" },
  { id: 35, text: "Saya lebih suka menjadi anggota biasa yang diberi perintah daripada harus mengambil peran sebagai pemimpin.", category: "E", isNegative: true }, // Consistency

  // Conventional (C) - Sistematis & Rapi
  { id: 36, text: "Saya adalah orang yang selalu mencatat tugas-tugas sekolah secara detail dan membuat jadwal harian yang sangat teratur.", category: "C" },
  { id: 37, text: "Saya sangat menikmati menjadi sekretaris atau bendahara kelas karena saya suka mengelola dokumen, absen, atau uang kas secara rapi.", category: "C" },
  { id: 38, text: "Saya merasa jauh lebih tenang jika guru memberikan pedoman penilaian (rubrik) yang sangat detail dan sistematis.", category: "C" },
  { id: 39, text: "Saya sangat teliti (perfeksionis) dalam mengecek ulang ejaan (typo), angka-angka, dan format sebelum mengumpulkan tugas.", category: "C" },
  { id: 40, text: "Saya tidak keberatan menginput ratusan data ke dalam Microsoft Excel asalkan datanya terstruktur dan jelas.", category: "C" },
  { id: 41, text: "Saya lebih suka bekerja di lingkungan yang tenang, disiplin, dan memiliki SOP (aturan) yang pasti ketimbang lingkungan yang spontan.", category: "C" },
  { id: 42, text: "Kamar dan meja belajar saya sering kali berantakan dan saya jarang menyusun jadwal belajar yang terencana.", category: "C", isNegative: true }, // Consistency
];

export const MI_QUESTIONS = [
  // Linguistic (LIN)
  { id: 101, text: "Nilai Bahasa Indonesia dan Bahasa Inggris saya biasanya termasuk yang paling tinggi dibanding mata pelajaran lainnya.", category: "LIN" },
  { id: 102, text: "Saya sangat menikmati dan jago dalam kegiatan debat, pidato, atau menjadi MC (pembawa acara) di kegiatan sekolah.", category: "LIN" },
  { id: 103, text: "Saya kesulitan saat diminta untuk menulis esai atau artikel panjang dengan tata bahasa yang baik dan benar.", category: "LIN", isNegative: true },

  // Logical-Mathematical (LOG)
  { id: 104, text: "Saya lebih mudah mencerna materi pelajaran jika disajikan dalam bentuk angka, statistik, atau grafik diagram.", category: "LOG" },
  { id: 105, text: "Bagi saya, memecahkan soal Matematika, Kimia, atau Fisika yang rumit memberikan kepuasan tersendiri saat jawabannya ketemu.", category: "LOG" },
  { id: 106, text: "Saya sering merasa bingung jika harus menganalisis data angka atau menyelesaikan persoalan logika beruntun.", category: "LOG", isNegative: true },

  // Spatial-Visual (SPA)
  { id: 107, text: "Saya lebih cepat paham pelajaran jika melihat ilustrasi visual, video animasi, atau mind-map ketimbang hanya teks bacaan.", category: "SPA" },
  { id: 108, text: "Saya bisa dengan mudah membayangkan bentuk bangun ruang 3D (pada soal Geometri) hanya di dalam pikiran saya.", category: "SPA" },
  { id: 109, text: "Saya sering tersesat atau susah membaca peta (Google Maps) saat mencari alamat tempat baru.", category: "SPA", isNegative: true },

  // Bodily-Kinesthetic (KIN)
  { id: 110, text: "Saya unggul dalam pelajaran Olahraga (Penjasorkes), menari (dance), atau kegiatan ekstrakurikuler bela diri.", category: "KIN" },
  { id: 111, text: "Saya lebih cepat mengingat sesuatu jika saya mempraktekkannya langsung dengan tangan ketimbang hanya mendengarkan.", category: "KIN" },
  { id: 112, text: "Saya tidak terlalu mahir menggunakan alat-alat pertukangan atau memiliki refleks tubuh yang agak lambat.", category: "KIN", isNegative: true },

  // Musical (MUS)
  { id: 113, text: "Saya bisa menghafal lirik lagu atau nada irama dengan sangat cepat, bahkan untuk lagu yang baru pertama kali didengar.", category: "MUS" },
  { id: 114, text: "Mendengarkan musik yang tepat sangat membantu saya untuk rileks dan meningkatkan fokus saat belajar di kamar.", category: "MUS" },
  { id: 115, text: "Saya sering kesulitan membedakan nada yang tidak pas (fals) saat ada yang bernyanyi atau bermain alat musik.", category: "MUS", isNegative: true },

  // Interpersonal (INT-R)
  { id: 116, text: "Saya sangat mudah membaca situasi, mencairkan suasana canggung (ice-breaking), dan mengajak teman bekerja sama.", category: "INT-R" },
  { id: 117, text: "Saya peka terhadap gestur tubuh teman saya; saya bisa tahu jika dia sedang sedih meskipun dia bilang 'aku tidak apa-apa'.", category: "INT-R" },
  { id: 118, text: "Saya sering merasa canggung dan kesulitan memulai percakapan jika berada di lingkungan atau kelas yang baru.", category: "INT-R", isNegative: true },

  // Intrapersonal (INT-A)
  { id: 119, text: "Saya tahu persis apa kekurangan diri saya, dan saya memiliki prinsip hidup kuat yang tidak mudah goyah oleh tren teman-teman.", category: "INT-A" },
  { id: 120, text: "Saya sering meluangkan waktu merenung sendirian untuk mengevaluasi diri dan merencanakan target masa depan saya.", category: "INT-A" },
  { id: 121, text: "Saya sering merasa bingung tentang identitas diri saya dan apa yang sebenarnya benar-benar saya inginkan dalam hidup.", category: "INT-A", isNegative: true },

  // Naturalist (NAT)
  { id: 122, text: "Saya suka pelajaran Biologi terutama materi yang membahas tentang tanaman, hewan, anatomi, atau pelestarian lingkungan.", category: "NAT" },
  { id: 123, text: "Saya merasa jauh lebih rileks dan bersemangat jika belajar atau beraktivitas di alam terbuka (taman, hutan, gunung, pantai).", category: "NAT" },
  { id: 124, text: "Saya merasa tidak tertarik atau jijik untuk bersentuhan dengan tanah, merawat tanaman, atau berinteraksi dengan hewan.", category: "NAT", isNegative: true },
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

export const KELOMPOK_MAPEL: Record<string, {
  id: string;
  emoji: string;
  nama: string;
  mapel: string[];
  fokus: string;
  cocok: string;
  jurusan: string[];
  profesi: string[];
  color: string;
  bgClass: string;
}> = {
  K1: {
    id: "K1",
    emoji: "🧬",
    nama: "Kelompok 1 (Bio-Kim)",
    mapel: ["Biologi", "Kimia", "Matematika", "Informatika"],
    fokus: "Kesehatan & Life Science",
    cocok: "Suka tubuh manusia, teliti, sabar belajar detail",
    jurusan: ["Kedokteran", "Farmasi", "Keperawatan", "Kesehatan Masyarakat", "Gizi", "Biologi", "Bioteknologi", "Kedokteran Gigi", "Teknologi Lab Medis", "Kebidanan"],
    profesi: ["Dokter", "Apoteker", "Perawat", "Bidan", "Ahli Gizi", "Analis Laboratorium", "Peneliti Medis"],
    color: "teal",
    bgClass: "from-teal-500 to-emerald-600"
  },
  K2: {
    id: "K2",
    emoji: "⚙️",
    nama: "Kelompok 2 (Fis-Kim)",
    mapel: ["Fisika", "Kimia", "Matematika", "Informatika"],
    fokus: "Logika & Teknologi",
    cocok: "Suka logika, hitungan, problem solving",
    jurusan: ["Teknik Sipil", "Teknik Mesin", "Teknik Elektro", "Teknik Industri", "Teknik Kimia", "Informatika", "Sistem Informasi", "Arsitektur", "Teknik Lingkungan", "Teknik Geologi"],
    profesi: ["Engineer", "Programmer", "Arsitek", "Konsultan Teknik", "Data Analyst"],
    color: "blue",
    bgClass: "from-blue-500 to-indigo-600"
  },
  K3: {
    id: "K3",
    emoji: "🌱",
    nama: "Kelompok 3 (Bio-Fis)",
    mapel: ["Biologi", "Fisika", "Matematika", "Informatika"],
    fokus: "Alam & Lingkungan",
    cocok: "Masih eksplorasi, siap kerja lebih keras",
    jurusan: ["Pendidikan Biologi", "Pendidikan Fisika", "Ilmu Lingkungan", "Kehutanan", "Perikanan", "Peternakan", "Agribisnis", "Geografi (Sains)", "Teknologi Pangan", "Meteorologi"],
    profesi: ["Guru Sains", "Peneliti Lingkungan", "Konsultan Lingkungan", "Ahli Pertanian", "Pengelola SDA"],
    color: "green",
    bgClass: "from-green-500 to-lime-600"
  },
  K4: {
    id: "K4",
    emoji: "🌍",
    nama: "Kelompok 4 (Eko-Tik)",
    mapel: ["Ekonomi", "Geografi", "Sosiologi", "Informatika"],
    fokus: "Sosial & Komunikasi",
    cocok: "Suka interaksi, analisis sosial, komunikasi",
    jurusan: ["Manajemen", "Akuntansi", "Ilmu Ekonomi", "Hukum", "Sosiologi", "Ilmu Komunikasi", "Hubungan Internasional", "Administrasi Negara", "Pendidikan Ekonomi", "Pariwisata"],
    profesi: ["Pengusaha", "Akuntan", "Lawyer", "Konsultan Bisnis", "Pegawai Pemerintah", "Content Creator"],
    color: "violet",
    bgClass: "from-violet-500 to-purple-600"
  }
};

export const KEDINASAN_INFO: {
  intro: string;
  penentu: string[];
  items: {
    nama: string;
    singkatan: string;
    instansi: string;
    kelompok: string[];
    riasec: string[];
    alasan: string;
    mapelKunci: string[];
    kategori: "sipil" | "militer" | "semi-militer";
  }[];
} = {
  intro: "Pendidikan gratis dengan jaminan penempatan kerja (Ikatan Dinas).",
  penentu: ["Tes akademik", "Nilai rapor", "Tes fisik & kesehatan", "Tes psikologi", "Wawancara", "Kesesuaian bidang"],
  items: [
    // === SIPIL ===
    {
      nama: "Politeknik Keuangan Negara STAN",
      singkatan: "PKN STAN",
      instansi: "Kementerian Keuangan",
      kelompok: ["K4"],
      riasec: ["C", "E"],
      alasan: "Membutuhkan kemampuan analisis ekonomi, akuntansi, dan pengelolaan keuangan negara. Cocok untuk kamu yang kuat di angka dan tertarik dunia fiskal, pajak, serta bea cukai.",
      mapelKunci: ["Ekonomi", "Matematika"],
      kategori: "sipil"
    },
    {
      nama: "Politeknik Statistika STIS",
      singkatan: "STIS",
      instansi: "Badan Pusat Statistik (BPS)",
      kelompok: ["K2", "K4"],
      riasec: ["I", "C"],
      alasan: "Sangat menekankan kemampuan matematika tingkat tinggi dan logika pemrograman. Lulusan menjadi statistisi negara yang mengolah data untuk kebijakan nasional.",
      mapelKunci: ["Matematika", "Informatika"],
      kategori: "sipil"
    },
    {
      nama: "Politeknik Kesehatan Kemenkes",
      singkatan: "Poltekkes",
      instansi: "Kementerian Kesehatan",
      kelompok: ["K1", "K3"],
      riasec: ["S", "I"],
      alasan: "Mencetak tenaga kesehatan (perawat, bidan, analis, sanitarian) untuk seluruh Indonesia. Sangat cocok untuk yang suka biologi dan ingin mengabdi di bidang kesehatan masyarakat.",
      mapelKunci: ["Biologi", "Kimia"],
      kategori: "sipil"
    },
    {
      nama: "Institut Pemerintahan Dalam Negeri",
      singkatan: "IPDN",
      instansi: "Kementerian Dalam Negeri",
      kelompok: ["K4"],
      riasec: ["E", "S"],
      alasan: "Mencetak kader pemerintahan (camat, lurah, hingga bupati). Butuh pemahaman sosiologi, geografi wilayah, dan kemampuan kepemimpinan publik.",
      mapelKunci: ["Sosiologi", "Geografi"],
      kategori: "semi-militer"
    },
    {
      nama: "Sekolah Tinggi Intelijen Negara",
      singkatan: "STIN",
      instansi: "Badan Intelijen Negara (BIN)",
      kelompok: ["K2"],
      riasec: ["I", "E", "R"],
      alasan: "Fokus pada analisis data strategis, keamanan siber, dan teknologi informasi untuk pertahanan negara. Membutuhkan logika tajam dan kemampuan analisis mendalam.",
      mapelKunci: ["Matematika", "Informatika"],
      kategori: "semi-militer"
    },
    {
      nama: "Politeknik Siber dan Sandi Negara",
      singkatan: "Poltek SSN",
      instansi: "BSSN (Badan Siber dan Sandi Negara)",
      kelompok: ["K2"],
      riasec: ["I", "C"],
      alasan: "Satu-satunya kampus kedinasan yang fokus pada kriptografi, keamanan siber, dan persandian negara. Butuh logika matematika dan kemampuan coding yang sangat kuat.",
      mapelKunci: ["Matematika", "Informatika"],
      kategori: "semi-militer"
    },
    {
      nama: "Sekolah Tinggi Meteorologi Klimatologi dan Geofisika",
      singkatan: "STMKG",
      instansi: "BMKG",
      kelompok: ["K2", "K3"],
      riasec: ["I", "R"],
      alasan: "Mempelajari fisika atmosfer, klimatologi, dan geofisika untuk memprediksi cuaca dan gempa bumi. Sangat cocok untuk pecinta sains alam dan fisika terapan.",
      mapelKunci: ["Fisika", "Matematika"],
      kategori: "semi-militer"
    },
    {
      nama: "Politeknik Penerbangan Indonesia Curug",
      singkatan: "PPI Curug",
      instansi: "Kementerian Perhubungan",
      kelompok: ["K2"],
      riasec: ["R", "I"],
      alasan: "Mencetak teknisi penerbangan, ATC (Air Traffic Controller), dan penerbang. Membutuhkan fisika kuat (aerodinamika) dan kemampuan teknis presisi tinggi.",
      mapelKunci: ["Fisika", "Matematika"],
      kategori: "semi-militer"
    },
    {
      nama: "Politeknik Transportasi Darat Indonesia",
      singkatan: "PTDI-STTD",
      instansi: "Kementerian Perhubungan",
      kelompok: ["K2"],
      riasec: ["R", "E"],
      alasan: "Fokus pada manajemen transportasi darat, logistik, dan infrastruktur jalan. Cocok untuk yang tertarik sistem transportasi dan perencanaan kota.",
      mapelKunci: ["Fisika", "Matematika"],
      kategori: "semi-militer"
    },
    {
      nama: "Sekolah Tinggi Ilmu Pelayaran",
      singkatan: "STIP Jakarta",
      instansi: "Kementerian Perhubungan",
      kelompok: ["K2", "K3"],
      riasec: ["R", "E"],
      alasan: "Mencetak perwira pelayaran dan ahli teknika kapal. Membutuhkan fisika (navigasi, mesin kapal) dan kesiapan fisik untuk kehidupan di laut.",
      mapelKunci: ["Fisika", "Matematika"],
      kategori: "semi-militer"
    },
    {
      nama: "Politeknik Pelayaran Surabaya / Barombong / Malahayati",
      singkatan: "Poltekpel",
      instansi: "Kementerian Perhubungan",
      kelompok: ["K2", "K3"],
      riasec: ["R", "E"],
      alasan: "Serupa STIP tapi tersebar di beberapa kota. Melatih tenaga pelaut profesional dan teknisi kelautan. Butuh ketahanan fisik dan pemahaman teknis kapal.",
      mapelKunci: ["Fisika", "Matematika"],
      kategori: "semi-militer"
    },
    {
      nama: "Politeknik Ilmu Pemasyarakatan",
      singkatan: "Poltekip",
      instansi: "Kementerian Hukum dan HAM",
      kelompok: ["K4"],
      riasec: ["S", "E"],
      alasan: "Mencetak petugas pemasyarakatan (sipir profesional) yang memahami hukum pidana, rehabilitasi sosial, dan pembinaan warga binaan.",
      mapelKunci: ["Sosiologi", "Ekonomi"],
      kategori: "semi-militer"
    },
    {
      nama: "Politeknik Imigrasi",
      singkatan: "Poltekim",
      instansi: "Kementerian Hukum dan HAM",
      kelompok: ["K4"],
      riasec: ["E", "S", "I"],
      alasan: "Mencetak petugas imigrasi yang menguasai hukum keimigrasian, hubungan internasional, dan pelayanan publik di pintu masuk negara.",
      mapelKunci: ["Sosiologi", "Ekonomi"],
      kategori: "semi-militer"
    },
    // === MILITER ===
    {
      nama: "Akademi Militer",
      singkatan: "Akmil",
      instansi: "TNI Angkatan Darat",
      kelompok: ["K2", "K4"],
      riasec: ["E", "R"],
      alasan: "Mencetak perwira TNI AD yang memimpin pasukan. Membutuhkan fisik prima, leadership kuat, serta pemahaman strategi dan taktik militer.",
      mapelKunci: ["Matematika", "Fisika"],
      kategori: "militer"
    },
    {
      nama: "Akademi Angkatan Laut",
      singkatan: "AAL",
      instansi: "TNI Angkatan Laut",
      kelompok: ["K2", "K3"],
      riasec: ["R", "E"],
      alasan: "Mencetak perwira TNI AL. Membutuhkan pemahaman navigasi laut, fisika kelautan, dan kemampuan bertahan di lingkungan maritim.",
      mapelKunci: ["Fisika", "Matematika"],
      kategori: "militer"
    },
    {
      nama: "Akademi Angkatan Udara",
      singkatan: "AAU",
      instansi: "TNI Angkatan Udara",
      kelompok: ["K2"],
      riasec: ["R", "I"],
      alasan: "Mencetak perwira penerbang dan teknisi militer. Fokus pada aerodinamika, elektronika penerbangan, dan fisika atmosfer tingkat tinggi.",
      mapelKunci: ["Fisika", "Matematika"],
      kategori: "militer"
    },
    {
      nama: "Akademi Kepolisian",
      singkatan: "Akpol",
      instansi: "Kepolisian Republik Indonesia",
      kelompok: ["K4", "K2"],
      riasec: ["E", "S"],
      alasan: "Mencetak perwira Polri yang menguasai hukum pidana, kriminologi, dan manajemen keamanan. Butuh analisis sosial kuat dan fisik prima.",
      mapelKunci: ["Sosiologi", "Matematika"],
      kategori: "militer"
    },
  ]
};

// Mapping RIASEC → Kelompok Mapel (primary + secondary)
export const RIASEC_TO_KELOMPOK: Record<string, { primary: string; secondary: string[] }> = {
  R: { primary: "K2", secondary: ["K3"] },        // Realistic → Teknik, juga Lingkungan
  I: { primary: "K1", secondary: ["K2"] },         // Investigative → Life Science, juga Teknik
  A: { primary: "K4", secondary: [] },              // Artistic → Sosial/Komunikasi
  S: { primary: "K1", secondary: ["K4", "K3"] },   // Social → Kesehatan (K1) / Sosial (K4) / Alam (K3)
  E: { primary: "K4", secondary: ["K2"] },          // Enterprising → Bisnis/Sosial
  C: { primary: "K4", secondary: ["K2"] },          // Conventional → Administrasi/Keuangan
};
