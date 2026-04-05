import React from "react";
import { 
  BookOpen, 
  ClipboardList, 
  LayoutTemplate, 
  Settings, 
  ShieldAlert, 
  Users, 
  User,
  GraduationCap, 
  Award,
  AlertCircle,
  Download,
  Monitor,
  Key,
  Home,
  Globe,
  Database,
  Cpu,
  MessageCircle,
  Code,
  Image as ImageIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

const GuidePage = () => {
  return (
    <div className="px-4 py-8 md:px-6 lg:container lg:mx-auto max-w-6xl animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6 bg-white dark:bg-slate-900/40 p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm backdrop-blur-xl relative overflow-hidden group">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl transition-transform duration-1000 group-hover:scale-150" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl transition-transform duration-1000 group-hover:scale-150" />
        
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 ring-4 ring-blue-50 dark:ring-blue-900/20">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Panduan Aplikasi E-Ujian</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Dokumentasi operasional terpadu sistem Computer Based Test</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-6 h-fit lg:sticky lg:top-24 mt-2">
          <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 py-4 px-5 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Daftar Isi</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-1 pb-2 lg:pb-0 scrollbar-none">
                {[
                  { id: "pendahuluan", label: "Pendahuluan", color: "bg-blue-500", icon: Home },
                  { id: "bank-soal", label: "Bank Soal", color: "bg-indigo-500", icon: BookOpen },
                  { id: "ruang-ujian", label: "Ruang Ujian", color: "bg-emerald-500", icon: ClipboardList },
                  { id: "data-master", label: "Data Master", color: "bg-amber-500", icon: LayoutTemplate },
                  { id: "monitoring", label: "Anti-Cheat", color: "bg-rose-500", icon: Monitor },
                  { id: "sistem", label: "Sistem", color: "bg-slate-500", icon: Settings },
                  { id: "pengembang", label: "Pengembang", color: "bg-blue-600", icon: User }
                ].map((item) => (
                  <a 
                    key={item.id}
                    href={`#${item.id}`} 
                    className="flex items-center gap-2 lg:gap-3 px-4 py-2.5 text-xs lg:text-[13px] font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all whitespace-nowrap lg:whitespace-normal group"
                  >
                    <item.icon className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                    {item.label}
                  </a>
                ))}
              </nav>
            </CardContent>
          </Card>

          <div className="hidden lg:block p-6 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-slate-800 dark:to-slate-900 border border-blue-500/20 dark:border-slate-700/50 text-white shadow-xl shadow-blue-500/10 dark:shadow-none relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <AlertCircle className="w-16 h-16 rotate-12" />
             </div>
             <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-200" /> Bantuan Teknis
             </h4>
             <p className="text-xs text-blue-100 dark:text-slate-400 leading-relaxed relative z-10">
                Jika mengalami kendala operasional, hubungi administrator atau tim IT Sekolah melalui portal bantuan resmi.
             </p>
          </div>
        </div>

        {/* Content Section */}
        <div className="lg:col-span-3 space-y-12 pb-32">
          {/* Pendahuluan */}
          <section id="pendahuluan" className="scroll-mt-28 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Home className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">1. Pendahuluan</h2>
            </div>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[15px]">
                E-Ujian adalah platform Computer Based Test (CBT) generasi terbaru yang dirancang untuk stabilitas dan keamanan tinggi. Sistem ini menyediakan alur kerja yang intuitif untuk Guru dan Administrator dalam mengelola evaluasi belajar mandiri.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
              <div className="p-6 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-800 hover:border-blue-500/30 transition-colors shadow-sm">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center mb-4">
                  <ShieldAlert className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-3">Administrator</h4>
                <ul className="text-xs space-y-3 text-slate-500 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5" />
                    <span>Manajemen Data Master (Siswa, Kelas, Guru)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5" />
                    <span>Konfigurasi identitas sekolah & logo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5" />
                    <span>Kontrol keamanan akun & hak akses</span>
                  </li>
                </ul>
              </div>
              <div className="p-6 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-800 hover:border-emerald-500/30 transition-colors shadow-sm">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center mb-4">
                  <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-3">Guru Mata Pelajaran</h4>
                <ul className="text-xs space-y-3 text-slate-500 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5" />
                    <span>Pembuatan Bank Soal secara mandiri</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5" />
                    <span>Aktivasi Ruang Ujian & Pengaturan Sesi</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5" />
                    <span>Monitoring Siswa secara real-time</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Bank Soal */}
          <section id="bank-soal" className="scroll-mt-28 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">2. Manajemen Bank Soal</h2>
            </div>
            <Card className="border-slate-200/60 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 rounded-2xl overflow-hidden shadow-sm">
              <CardContent className="p-0">
                <div className="divide-y dark:divide-slate-800">
                  {[
                    { char: "A", title: "Pembuatan Paket", desc: "Buat paket soal melalui tombol 'Tambah Paket Soal'. Isi detail mapel dan verifikasi guru pengampu." },
                    { char: "B", title: "Input Pertanyaan", desc: "Manfaatkan Rich Text Editor untuk memasukkan teks berwarna, tabel, hingga rumus matematika kompleks." },
                    { char: "C", title: "Visual & Lampiran", desc: "Gunakan fitur upload gambar untuk soal atau pilihan jawaban guna mempermudah ilustrasi pertanyaan." }
                  ].map((step) => (
                    <div key={step.char} className="p-6 flex gap-5 group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-800 shadow-sm">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{step.char}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">{step.title}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                  <div className="p-6 bg-blue-50/20 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900/30">
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                      <Badge className="bg-blue-600 dark:bg-blue-700 text-white border-none px-3 py-1 text-[10px] uppercase font-black shrink-0 whitespace-nowrap shadow-sm shadow-blue-500/20">
                        Fitur Literasi
                      </Badge>
                      <p className="text-xs font-bold text-blue-800 dark:text-blue-300 leading-relaxed">
                        Gunakan <span className="underline decoration-blue-400/50">ID Grup</span> yang identik untuk mengelompokkan soal dalam satu wacana. Konten wacana cukup diisi pada butir soal pertama di dalam grup tersebut.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Ruang Ujian */}
          <section id="ruang-ujian" className="scroll-mt-28 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">3. Operasional Ruang Ujian</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              <Card className="border-slate-200/60 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <Settings className="h-4 w-4" /> Parameter Sesi
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   {[
                     { label: "Nama Ruang", desc: "Identitas ruangan (Contoh: VIII-A Sesi Pagi)" },
                     { label: "Durasi Aktif", desc: "Total alokasi pengerjaan siswa dalam menit" },
                     { label: "Minimal Waktu", desc: "Waktu tunggu sebelum tombol selesai muncul" }
                   ].map((item) => (
                     <div key={item.label}>
                       <h5 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{item.label}</h5>
                       <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none">{item.desc}</p>
                     </div>
                   ))}
                </CardContent>
              </Card>
              <Card className="border-slate-200/60 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <Key className="h-4 w-4" /> Proteksi & Akses
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   {[
                     { label: "Universal Token", desc: "Refresh otomatis 5 menit untuk akses awal ujian" },
                     { label: "Target Kelas", desc: "Pembatasan akses sesuai database siswa di kelas" },
                     { label: "Acak Soal", desc: "Pengurutan butir soal unik untuk setiap peserta" }
                   ].map((item) => (
                     <div key={item.label}>
                       <h5 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{item.label}</h5>
                       <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none">{item.desc}</p>
                     </div>
                   ))}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Monitoring */}
          <section id="monitoring" className="scroll-mt-28 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                <Monitor className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">4. Sistem Anti-Cheat</h2>
            </div>
            <div className="grid grid-cols-1 gap-5">
              <div className="group p-6 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-md transition-all overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl -mr-16 -mt-16" />
                <div className="flex items-start gap-5 relative z-10">
                  <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-rose-500/20 shadow-inner">
                    <ShieldAlert className="h-6 w-6 text-rose-600 dark:text-rose-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">Deteksi Pindah Tab (Lock System)</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                      E-Ujian memantau status browser siswa secara ketat. Jika siswa terdeteksi beralih ke aplikasi lain atau tab baru, sistem akan mencatat sebagai pelanggaran. Melebihi batas toleransi akan menyebabkan <span className="text-rose-600 dark:text-rose-400 font-black">UJIAN TERKUNCI OTOMATIS</span>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="group p-6 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start gap-5 relative z-10">
                  <div className="w-12 h-12 bg-blue-500/10 dark:bg-blue-500/5 rounded-2xl flex items-center justify-center shrink-0 border border-blue-500/20 dark:border-blue-800/40 shadow-inner">
                    <Key className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">Membuka Kunci & Selesaikan Paksa</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                      Gunakan dashboard Monitoring untuk membuka kunci siswa yang terblokir. Guru juga dapat menekan 'Selesaikan Paksa' untuk mengakhiri sesi siswa yang lupa menekan tombol selesai.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Master Data */}
          <section id="data-master" className="scroll-mt-28 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <LayoutTemplate className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">5. Manajemen Data Master</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                 {[
                   { icon: GraduationCap, label: "Database Siswa", color: "text-emerald-500" },
                   { icon: Users, label: "Database Guru & Mapel", color: "text-blue-500" },
                   { icon: Award, label: "Basis Data Alumni", color: "text-amber-500" }
                 ].map((item) => (
                   <div key={item.label} className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-sm transition-transform hover:scale-[1.02]">
                     <item.icon className={`h-5 w-5 ${item.color}`} />
                     <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.label}</span>
                   </div>
                 ))}
              </div>
              <Card className="bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 border-dashed rounded-3xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-white dark:bg-slate-800 rounded-full blur-2xl opacity-50" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black flex items-center gap-2 text-slate-500 dark:text-slate-400 italic">
                    <Download className="h-4 w-4" /> Protokol Import Excel
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] space-y-3 text-slate-500 dark:text-slate-500 leading-relaxed font-medium">
                  <p className="flex gap-2"><span>1.</span> Gunakan template standar yang dapat diunduh di setiap menu modul.</p>
                  <p className="flex gap-2"><span>2.</span> Hindari restrukturisasi kolom atau pengosongan kolom wajib bertanda (*).</p>
                  <p className="flex gap-2"><span>3.</span> Validasi format NISN/NIP agar tetap sebagai teks murni (bukan angka scientific).</p>
                  <p className="flex gap-2"><span>4.</span> Simpan sebagai file .xlsx terbaru sebelum proses unggah dilakukan.</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Sistem & Akun */}
          <section id="sistem" className="scroll-mt-28 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Settings className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">6. Konfigurasi Sistem</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-8 bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
                <div className="flex gap-5">
                  <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/20 rounded-xl flex items-center justify-center shrink-0">
                    <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">Manajemen Akun Guru</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                      Setiap guru pengampu wajib memiliki akun personal. Administrator bertanggung jawab atas pemberian akses dan pemulihan kata sandi jika diperlukan. Hak akses admin mencakup seluruh data master sekolah.
                    </p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center shrink-0">
                    <ImageIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">Visual Branding Sekolah</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                      Unggah logo sekolah melalui menu Pengaturan. Perubahan akan merubah tampilan pada kartu login peserta, tajuk navigasi, dan aset dokumen yang dihasilkan oleh sistem.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-indigo-600 dark:bg-slate-800 rounded-3xl border border-indigo-500 dark:border-slate-700 shadow-xl text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-transform">
                  <Database size={80} />
                </div>
                <h4 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
                  <Database className="h-6 w-6 text-indigo-300" /> Pencadangan Data
                </h4>
                <div className="space-y-4 relative z-10">
                  <p className="text-sm text-indigo-100 dark:text-slate-300 leading-relaxed">
                    Sistem mendukung pencadangan penuh (Full Backup) melalui file JSON. Ini mencakup Bank Soal, Siswa, Ruang Ujian, dan Akun Pengguna.
                  </p>
                  <div className="p-4 bg-white/10 dark:bg-black/20 rounded-2xl border border-white/20 dark:border-white/5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mt-1.5 shrink-0" />
                      <p className="text-[11px] font-medium leading-tight">Akun hasil impor akan memiliki password default <span className="font-black underline italic">username@mosa</span>.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mt-1.5 shrink-0" />
                      <p className="text-[11px] font-medium leading-tight">Token Universal tidak ikut dalam ekspor demi menjaga integritas akses kunci ujian.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-300 mt-1.5 shrink-0" />
                      <p className="text-[11px] font-medium leading-tight text-rose-200">Tombol <span className="underline">Hapus Semua Data</span> akan membersihkan seluruh database secara permanen kecuali akun Admin yang sedang aktif digunakan.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Developer Section */}
          <section id="pengembang" className="scroll-mt-28">
            <Card className="border-none bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-indigo-950/80 dark:to-slate-950 text-slate-900 dark:text-white shadow-2xl overflow-hidden relative group rounded-[40px] border border-slate-200 dark:border-white/5 transition-colors duration-500">
              {/* Animated Background Gradients */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 dark:bg-blue-600/10 rounded-full blur-[100px] -mr-48 -mt-48 transition-opacity duration-1000 group-hover:opacity-40" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-600/10 rounded-full blur-[100px] -ml-48 -mb-48 transition-opacity duration-1000 group-hover:opacity-40" />
              
              <CardContent className="p-8 sm:p-12 flex flex-col md:flex-row items-center gap-10 relative z-10 text-center md:text-left">
                <div className="flex flex-col items-center gap-4 shrink-0">
                  <div className="w-32 h-44 sm:w-36 sm:h-48 rounded-[32px] border-4 border-white/50 dark:border-white/10 overflow-hidden shadow-2xl backdrop-blur-sm bg-white/20 dark:bg-white/5 group-hover:scale-105 transition-transform duration-700 ring-8 ring-slate-200/50 dark:ring-white/5">
                    <img 
                      src="https://www.sman-modalbangsa.sch.id/wp-content/uploads/2021/09/alfaruqasri-300x400.jpeg" 
                      alt="Alfaruq Asri" 
                      className="w-full h-full object-cover object-[center_15%]"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-full backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Verified Developer</span>
                  </div>
                </div>
                <div className="flex-1 space-y-6">
                  <div>
                    <h3 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 uppercase bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 dark:from-white dark:via-blue-100 dark:to-indigo-100 bg-clip-text text-transparent transition-colors">Alfaruq Asri, S.Pd., Gr.</h3>
                    <div className="flex flex-wrap justify-center md:justify-start items-center gap-2">
                       <Badge className="bg-blue-600/10 dark:bg-blue-500/20 hover:bg-blue-600/20 dark:hover:bg-blue-500/30 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors">Informatics Engineer</Badge>
                       <Badge className="bg-indigo-600/10 dark:bg-indigo-500/20 hover:bg-indigo-600/20 dark:hover:bg-indigo-500/30 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors">IT Instructor</Badge>
                       <Badge className="bg-slate-200/50 dark:bg-slate-500/20 hover:bg-slate-200/70 dark:hover:bg-slate-500/30 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors">SMAN Modal Bangsa Aceh</Badge>
                    </div>
                  </div>
                  
                  <p className="text-base text-slate-600 dark:text-slate-300/90 leading-relaxed max-w-2xl font-medium transition-colors">
                    "Platform E-Ujian ini adalah manifestasi dedikasi saya untuk digitalisasi pendidikan Indonesia. Dikembangkan dengan standar keamanan tinggi dan pengalaman pengguna yang modern guna menjamin integritas pelaksanaan ujian di sekolah."
                  </p>

                  <div className="pt-4 flex flex-wrap justify-center md:justify-start items-center gap-4">
                    <a 
                      href="https://www.alfaruqasri.my.id/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="group/btn relative inline-flex items-center gap-3 px-6 py-3 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 rounded-2xl text-xs font-bold text-slate-700 dark:text-white transition-all backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-lg shadow-slate-200/50 dark:shadow-none"
                    >
                      <Globe className="h-4 w-4 group-hover/btn:rotate-12 transition-transform text-blue-600 dark:text-blue-400" /> 
                      Portfolio Website
                    </a>
                    <a 
                      href="https://wa.me/6285359907696" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="group/wa relative inline-flex items-center gap-3 px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-2xl text-xs font-bold text-emerald-700 dark:text-white transition-all backdrop-blur-md border border-emerald-200 dark:border-emerald-500/20 shadow-lg shadow-emerald-500/10"
                    >
                      <div className="absolute inset-0 bg-emerald-500/5 rounded-2xl group-hover/wa:animate-pulse" />
                      <MessageCircle className="h-4 w-4 fill-emerald-600 dark:fill-emerald-500 text-emerald-600 dark:text-emerald-500 group-hover/wa:scale-110 transition-transform" /> 
                      Hubungi saya (WA)
                    </a>
                  </div>

                  {/* Tech Stack Display */}
                  <div className="mt-10 pt-8 border-t border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-3 mb-6 opacity-60">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">System Architecture Stack</span>
                    </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                           {[
                             { icon: Code, label: "React 18 & TS" },
                             { icon: Database, label: "PocketBase DB" },
                             { icon: LayoutTemplate, label: "Tailwind UI" },
                             { icon: Cpu, label: "Cloudflare R2" },
                             { icon: Award, label: "Vite Project" }
                           ].map((tech) => (
                             <div key={tech.label} className="flex items-center gap-2 p-2 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-blue-300 dark:hover:border-white/10 transition-colors">
                               <tech.icon className="h-3 w-3 shrink-0 text-slate-500 dark:text-white opacity-70" />
                               <span className="text-[9px] font-bold truncate text-slate-600 dark:text-white">{tech.label}</span>
                             </div>
                           ))}
                        </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <footer className="pt-16 pb-32 text-center">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 mb-6 group hover:border-blue-500/30 transition-colors">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                E-UJIAN SYSTEM 2.0 &bull; BUILD 2026
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-600 font-medium">DESIGNED & ENGINEERED BY ALFARUQ ASRI, S.PD., GR.</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default GuidePage;
