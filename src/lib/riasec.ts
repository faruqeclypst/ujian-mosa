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
  { id: 1, text: "Saya senang memperbaiki barang-barang yang rusak di rumah (seperti alat elektronik atau perabot).", category: "R" },
  { id: 2, text: "Saya lebih suka belajar di laboratorium atau bengkel daripada hanya duduk di dalam kelas.", category: "R" },
  { id: 3, text: "Saya merasa bangga jika bisa merakit sesuatu dengan tangan saya sendiri sampai berfungsi.", category: "R" },
  { id: 4, text: "Saya tidak keberatan bekerja di luar ruangan meskipun cuaca sedang panas atau berdebu.", category: "R" },
  { id: 5, text: "Saya tertarik memelajari cara kerja mesin pesawat, kapal, atau kereta api secara mendalam.", category: "R" },
  { id: 6, text: "Saya lebih suka melakukan aktivitas fisik seperti olahraga atau berkemah daripada aktivitas diam.", category: "R" },
  { id: 7, text: "Saya merasa tertantang saat harus memecahkan masalah praktis yang membutuhkan logika mekanik.", category: "R" },

  // Investigative (I) - Analitis & Teoritis
  { id: 8, text: "Saya sering bertanya-tanya 'mengapa' dan 'bagaimana' sesuatu terjadi sampai menemukan jawabannya.", category: "I" },
  { id: 9, text: "Saya sangat menikmati pelajaran matematika atau sains yang membutuhkan pemikiran mendalam.", category: "I" },
  { id: 10, text: "Saya senang melakukan eksperimen kecil atau riset mandiri lewat internet tentang topik ilmiah.", category: "I" },
  { id: 11, text: "Saya lebih suka membaca buku pengetahuan atau jurnal daripada novel fiksi yang ringan.", category: "I" },
  { id: 12, text: "Saya merasa puas saat berhasil memecahkan teka-teki logika yang dianggap sulit oleh orang lain.", category: "I" },
  { id: 13, text: "Saya tertarik memelajari tentang keamanan siber, data rahasia, atau fenomena alam yang misterius.", category: "I" },
  { id: 14, text: "Saya lebih suka bekerja sendirian di tempat yang tenang agar bisa berkonsentrasi penuh.", category: "I" },

  // Artistic (A) - Kreatif & Ekspresif
  { id: 15, text: "Saya sering mendapatkan ide-ide unik yang tidak terpikirkan oleh teman-teman saya lainnya.", category: "A" },
  { id: 16, text: "Saya sangat menikmati kegiatan seni seperti menggambar, menulis cerita, atau bermain musik.", category: "A" },
  { id: 17, text: "Saya merasa tidak nyaman jika harus mengikuti aturan yang terlalu kaku dan membatasi kreativitas.", category: "A" },
  { id: 18, text: "Saya senang memperhatikan detail estetika (keindahan) pada desain sebuah bangunan atau produk.", category: "A" },
  { id: 19, text: "Saya lebih suka mengekspresikan diri melalui karya daripada melalui kata-kata formal.", category: "A" },
  { id: 20, text: "Saya tertarik memelajari tentang dunia perfilman, desain grafis, atau tren fashion terbaru.", category: "A" },
  { id: 21, text: "Saya merasa paling produktif saat bekerja di lingkungan yang bebas dan penuh inspirasi.", category: "A" },

  // Social (S) - Membantu & Mengajar
  { id: 22, text: "Saya merasa sangat bahagia saat bisa membantu teman yang sedang kesulitan memahami pelajaran.", category: "S" },
  { id: 23, text: "Saya lebih suka bekerja dalam kelompok dan berdiskusi daripada bekerja sendirian.", category: "S" },
  { id: 24, text: "Saya memiliki kemampuan untuk mendengarkan curhatan teman dengan sabar dan memberikan solusi.", category: "S" },
  { id: 25, text: "Saya tertarik dengan kegiatan sukarela atau organisasi yang membantu masyarakat luas.", category: "S" },
  { id: 26, text: "Saya senang menjelaskan sesuatu kepada orang lain sampai mereka benar-benar paham.", category: "S" },
  { id: 27, text: "Saya merasa mudah bergaul dan menjalin pertemanan baru di lingkungan yang asing.", category: "S" },
  { id: 28, text: "Saya lebih mengutamakan kesejahteraan orang lain daripada ambisi pribadi saya semata.", category: "S" },

  // Enterprising (E) - Memimpin & Memengaruhi
  { id: 29, text: "Saya merasa percaya diri saat harus memimpin sebuah kelompok atau organisasi di sekolah.", category: "E" },
  { id: 30, text: "Saya senang merencanakan strategi untuk mencapai target atau kemenangan dalam sebuah lomba.", category: "E" },
  { id: 31, text: "Saya menikmati tantangan dalam memengaruhi atau meyakinkan teman-teman agar mengikuti rencana saya.", category: "E" },
  { id: 32, text: "Saya tidak takut mengambil risiko dalam mengikuti perlombaan atau kompetisi tingkat sekolah/wilayah.", category: "E" },
  { id: 33, text: "Saya tertarik memelajari cara kerja kepemimpinan dan manajemen organisasi seperti di OSIS atau MPK.", category: "E" },
  { id: 34, text: "Saya memiliki jiwa kompetitif yang tinggi dan selalu berusaha meraih peringkat atau prestasi tertinggi.", category: "E" },
  { id: 35, text: "Saya senang memotivasi teman-teman satu tim agar semua bekerja lebih giat untuk memenangkan lomba.", category: "E" },

  // Conventional (C) - Sistematis & Rapi
  { id: 36, text: "Saya sangat menikmati saat bisa menyusun jadwal belajar atau tugas sekolah dengan rapi dan teratur.", category: "C" },
  { id: 37, text: "Saya jauh lebih tenang jika guru memberikan petunjuk pengerjaan tugas yang sangat jelas dan bertahap.", category: "C" },
  { id: 38, text: "Saya sangat teliti dalam mengecek ulang jawaban ujian, angka-angka, atau kesalahan penulisan (typo).", category: "C" },
  { id: 39, text: "Saya senang membuat daftar tugas (to-do list) dan mencoretnya satu per satu setelah selesai dikerjakan.", category: "C" },
  { id: 40, text: "Saya tidak masalah mengerjakan tugas rutin yang sama secara berulang-ulang asalkan semua terdata dengan rapi.", category: "C" },
  { id: 41, text: "Saya lebih menyukai lingkungan yang tertib dan mengikuti aturan daripada situasi yang penuh ketidakpastian.", category: "C" },
  { id: 42, text: "Saya merasa puas saat melihat kumpulan catatan pelajaran atau file digital saya tersusun rapi dalam folder.", category: "C" },
];

export const MI_QUESTIONS = [
  // Linguistic (LIN)
  { id: 101, text: "Saya merasa mudah menuangkan ide dalam bentuk tulisan (artikel, puisi, atau caption yang menarik).", category: "LIN" },
  { id: 102, text: "Saya sangat menikmati kegiatan debat, pidato, atau menceritakan kembali sebuah kisah kepada orang lain.", category: "LIN" },
  { id: 103, text: "Saya senang mempelajari kosa kata baru atau bahasa asing di waktu luang.", category: "LIN" },
  
  // Logical-Mathematical (LOG)
  { id: 104, text: "Saya lebih mudah memahami informasi jika disajikan dalam bentuk angka, statistik, atau urutan kronologis.", category: "LOG" },
  { id: 105, text: "Saya suka mencari tahu rahasia di balik trik sulap atau cara kerja sebuah kode enkripsi.", category: "LOG" },
  { id: 106, text: "Menyelesaikan masalah yang rumit dengan langkah-langkah logis memberikan kepuasan tersendiri bagi saya.", category: "LOG" },

  // Spatial-Visual (SPA)
  { id: 107, text: "Saya lebih mudah mengingat wajah orang atau arah jalan dibandingkan mengingat nama mereka.", category: "SPA" },
  { id: 108, text: "Saya bisa membayangkan bentuk sebuah benda dari berbagai sudut pandang hanya di dalam pikiran.", category: "SPA" },
  { id: 109, text: "Saya senang menggambar sketsa, membuat denah, atau mengatur tata letak benda agar terlihat estetik.", category: "SPA" },

  // Bodily-Kinesthetic (KIN)
  { id: 110, text: "Saya memiliki koordinasi tubuh yang baik dan merasa gesit dalam berolahraga atau menari.", category: "KIN" },
  { id: 111, text: "Saya lebih mudah belajar dengan cara 'melakukan langsung' daripada hanya membaca instruksi.", category: "KIN" },
  { id: 112, text: "Saya senang menggunakan tangan saya untuk membuat sesuatu yang detail (kerajinan tangan/mekanik).", category: "KIN" },

  // Musical (MUS)
  { id: 113, text: "Saya bisa dengan mudah mengenali nada yang fals atau pola irama dalam sebuah lagu.", category: "MUS" },
  { id: 114, text: "Telinga saya sangat peka terhadap suara-suara di lingkungan sekitar yang mungkin diabaikan orang lain.", category: "MUS" },
  { id: 115, text: "Mendengarkan atau memainkan musik sangat membantu saya untuk berkonsentrasi saat belajar.", category: "MUS" },

  // Interpersonal (INT-R)
  { id: 116, text: "Saya memiliki kemampuan alami untuk mengajak orang lain bekerja sama dalam sebuah tim.", category: "INT-R" },
  { id: 117, text: "Saya peka terhadap perasaan dan perubahan suasana hati orang-orang di sekitar saya.", category: "INT-R" },
  { id: 118, text: "Saya sering menjadi tempat bertanya (konsultasi) bagi teman yang sedang memiliki masalah pribadi.", category: "INT-R" },

  // Intrapersonal (INT-A)
  { id: 119, text: "Saya sangat memahami kekuatan dan kelemahal diri saya sendiri dan tahu cara memperbaikinya.", category: "INT-A" },
  { id: 120, text: "Saya sering meluangkan waktu untuk merenung dan merencanakan target masa depan saya secara mandiri.", category: "INT-A" },
  { id: 121, text: "Saya memiliki prinsip hidup yang kuat dan tidak mudah terpengaruh oleh pendapat orang banyak.", category: "INT-A" },

  // Naturalist (NAT)
  { id: 122, text: "Saya merasa sangat tenang dan bersemangat saat berada di alam terbuka (hutan, pantai, atau gunung).", category: "NAT" },
  { id: 123, text: "Saya tertarik mempelajari ekosistem, jenis-jenis tanaman, atau cara merawat hewan piaraan.", category: "NAT" },
  { id: 124, text: "Saya peduli pada masalah lingkungan dan ingin berkontribusi dalam gerakan pelestarian alam.", category: "NAT" },
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
    recommendations: ["Teknik Dirgantara", "Teknik Logistik", "Sipil & Konstruksi", "Otomotif Modern", "Teknologi Perkapal"],
    suggestedSubjects: "Fisika - Kimia",
    pathType: "Kedinasan",
    pathTitle: "Analisis Jalur Kedinasan:",
    pathSaran: "PTDI-STTD (Darat), PPI Curug (Udara), STMKG (BMKG).",
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
    recommendations: ["Kedokteran Spesialis", "Cyber Security", "Bio-Teknologi", "Data Science", "Astronomi"],
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
    recommendations: ["Branding & DKV", "Arsitektur Kreatif", "Film & Sinematografi", "Content Creation", "Fashion Design"],
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
    recommendations: ["Keperawatan Publik", "Psikologi Kesehatan", "Pendidikan Guru", "Manajemen Lingkungan", "Hubungan Masyarakat"],
    suggestedSubjects: "Biologi - Fisika",
    pathType: "Kedinasan",
    pathTitle: "Analisis Jalur Kedinasan:",
    pathSaran: "IPDN, Poltekip (Penjara), atau Poltekim (Imigrasi).",
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
    recommendations: ["Manajemen Bisnis", "Pengusaha (Start-up)", "Hukum Bisnis", "Marketing", "Hubungan Internasional"],
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
    recommendations: ["Akuntansi Pajak", "Aktuaria (Risk)", "Administrasi Bisnis", "Audit Keuangan", "Manajemen Data"],
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
