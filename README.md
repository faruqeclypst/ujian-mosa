# EXAM AA - Platform Ujian & CBT (Computer Based Test) Multi-Tenant

Platform modern berbasis web untuk menyelenggarakan ujian sekolah (Computer Based Test) secara real-time dan aman. Sistem ini dirancang sebagai platform SaaS multi-tenant yang memungkinkan beberapa sekolah mendaftar dan mengelola data ujian mereka sendiri secara terisolasi dengan performa tinggi.

---

## 🚀 Fitur Utama

- 🏢 **Multi-Tenant SaaS Architecture** – Manajemen multi-sekolah dengan registrasi mandiri, integrasi subdomain sekolah, dan modul super admin pusat.
- 📝 **Manajemen Bank Soal & Soal**
  - **Import dari Word & Excel** – Konversi naskah soal `.docx`/`.xlsx` langsung menjadi soal ujian lengkap beserta gambar dan persamaan matematika LaTeX.
  - **Export ke Word (Offline Image)** – Cetak naskah soal beserta kunci jawaban ke format `.doc` (Word) dengan gambar yang di-embed secara offline (MHTML format) dan formula LaTeX terkonversi.
  - **AI-Powered Question Generator** – Integrasi AI (seperti Groq/LLM) untuk membuat soal otomatis berdasarkan topik, kesulitan, dan teks stimulus/literasi.
- 🖥️ **CBT Exam Engine**
  - Antarmuka ujian siswa yang responsif, minimalis, dan stabil.
  - Dukungan penulisan rumus matematika kompleks menggunakan **KaTeX (LaTeX)**.
  - Auto-save jawaban siswa secara berkala ke database server untuk mencegah kehilangan data akibat kendala koneksi.
- 🔒 **Exambro Guard Security**
  - Proteksi anti-curang dengan mendeteksi perpindahan tab browser, meminimalkan jendela, serta integrasi Exambro Guard (`VITE_DISABLE_EXAMBRO_GUARD` untuk bypass testing).
- 📊 **Monitoring Real-Time**
  - Dasbor pengawas/admin untuk memantau progress pengerjaan siswa, waktu mulai/selesai, sisa waktu, dan status keaktifan secara real-time.
- 📉 **Autograding & Laporan Progress**
  - Penilaian otomatis untuk soal pilihan ganda, kompleks, benar-salah, menjodohkan, dan urutkan.
  - Fitur salin format teks laporan kemajuan pembuatan soal guru untuk dibagikan via WhatsApp.
- 📲 **Capacitor Hybrid Mobile Support**
  - Konfigurasi siap pakai untuk memaketkan aplikasi frontend ke aplikasi mobile native (Android & iOS).

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React (Icons), Framer Motion (Animations), React Quill (Rich Text Editor).
- **Backend/Database**: PocketBase (Real-time DB, Auth Store, File Storage, SaaS registry).
- **Math Rendering**: KaTeX.
- **Media Storage**: Cloudflare R2 dengan secure proxy menggunakan Cloudflare Worker (`VITE_R2_WORKER_URL`).
- **File Parsing**: Mammoth (Word docx extractor), JSZip (Word MHTML packager), SheetJS/XLSX (Excel generator).

---

## 📁 Struktur Proyek

```
├── android                 # Proyek Android native (Capacitor)
├── configs                 # Konfigurasi deploy/build tambahan
├── pb_hooks                # Kustom hook server PocketBase
├── pocketbase-schema       # Schema koleksi database PocketBase
├── public                  # Aset statis public
├── scripts                 # Utilitas build & switch environment
├── src
│   ├── components          # Komponen reusable (forms, UI shadcn, tables)
│   ├── context             # Auth & Exam Data Context provider
│   ├── lib                 # Utility parser (Word, Excel), AI & R2 storage helper
│   ├── pages
│   │   ├── admin           # Kelola Bank Soal, Ruang Ujian, Monitoring, Nilai
│   │   ├── student         # Halaman CBT siswa, login & dashboard ujian
│   │   └── superadmin      # Dashboard pusat admin SaaS
│   ├── styles              # Konfigurasi styling Tailwind global
│   └── App.tsx             # Routing & Layouting inti
├── capacitor.config.ts     # Konfigurasi Capacitor Mobile app
├── tailwind.config.ts      # Konfigurasi Tailwind CSS
└── package.json            # Daftar dependensi & npm scripts
```

---

## ⚙️ Persiapan Lingkungan (Environment Variables)

Buat file `.env` di root direktori proyek dengan variabel konfigurasi berikut:

```env
# Nama Aplikasi
VITE_APP_NAME="EXAM AA"

# SaaS Multi-Tenant Config
VITE_MASTER_PB_URL=   # Master PB database untuk registry sekolah
VITE_MAIN_DOMAIN=                # Domain utama platform SaaS (tanpa subdomain)
VITE_LANDING_SUBDOMAIN=ujian                       # Subdomain halaman landing & super admin
# VITE_DEV_SCHOOL_SLUG=                # Bypass halaman landing di localhost (testing)

# Tenant Database Connection
VITE_POCKETBASE_URL=

# Keamanan Exambro (Isi 'true' untuk testing/nonaktifkan pengaman)
VITE_DISABLE_EXAMBRO_GUARD=false

# Media & Storage Cloudflare R2
VITE_R2_PUBLIC_BASE_URL=
VITE_R2_WORKER_URL=
```

---

## 🏃‍♂️ Cara Menjalankan

### 1. Instalasi Dependensi
Gunakan package manager untuk memasang dependensi:
```bash
bun install
# atau menggunakan npm:
npm install
```

### 2. Jalankan Mode Pengembangan (Local Dev Server)
```bash
bun run dev
# atau
npm run dev
```
Buka browser di `http://localhost:5173`.

### 3. Build untuk Produksi
Membangun paket statis aplikasi teroptimasi untuk di-deploy:
```bash
bun run build
# atau
npm run build
```
Hasil build akan disimpan di direktori `dist/`.

### 4. Sinkronisasi Aplikasi Mobile (Capacitor)
Jika Anda ingin memaketkan aplikasi ke perangkat Android/iOS:
```bash
npx cap sync
npx cap open android
```

---

## 📄 Lisensi

Platform ini dirancang khusus untuk operasional dan manajemen internal ujian sekolah mitra. Seluruh kode sumber tunduk pada kebijakan lisensi internal pengembang.
