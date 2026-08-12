# 🎓 EXAM AA — Platform Ujian & CBT (Computer Based Test) Multi-Tenant

Platform modern berbasis web untuk menyelenggarakan ujian sekolah (Computer Based Test) secara *real-time* dan aman. Sistem ini dirancang sebagai platform **SaaS (Software as a Service) Multi-Tenant** yang memungkinkan beberapa sekolah mendaftar dan mengelola data ujian mereka sendiri secara terisolasi dengan performa tinggi.

---

<p align="center">
  <img src="https://img.shields.io/badge/React-18.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.3.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5.0.10-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4.1-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/PocketBase-0.26.8-2F9E8F?style=for-the-badge&logo=pocketbase&logoColor=white" alt="PocketBase" />
  <img src="https://img.shields.io/badge/Capacitor-8.3.0-119EFF?style=for-the-badge&logo=capacitor&logoColor=white" alt="Capacitor" />
  <img src="https://img.shields.io/badge/Cloudflare_R2-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare" />
  <img src="https://img.shields.io/badge/Bun-1.x-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun" />
</p>

---

## 🚀 Fitur Utama

### 🏢 **SaaS Multi-Tenant Architecture**
Manajemen multi-sekolah dengan registrasi mandiri, isolasi data lengkap pada level database, pemetaan subdomain sekolah otomatis, dan kontrol panel admin pusat untuk manajemen global.

### 📝 **Manajemen Bank Soal, Wayground REST API & AI**
*   **Repository & Impor Soal Wayground (Khusus Admin)**: Tarik dan impor butir soal secara otomatis dari REST API Wayground / Bank Soal internal sekolah dengan penanganan presisi untuk kunci jawaban multi-format (PG, PG Kompleks, Isian), gambar, serta formula KaTeX.
*   **Bebas Blokir AWS WAF & CORS**: Terintegrasi dengan Caddy Reverse Proxy & Cloudflare WARP SOCKS5 lokal (Port 4001) di VPS, serta dilengkapi mode alternatif **Paste JSON** instan (0,00 detik).
*   **Import Dokumen Praktis**: Konversi naskah soal `.docx` (Word) dan `.xlsx` (Excel) langsung menjadi soal ujian lengkap beserta media gambar dan persamaan matematika LaTeX.
*   **Export ke Word (Offline Image)**: Ekspor naskah soal beserta kunci jawaban ke format `.doc` (Word) dengan gambar yang tersemat secara offline (format MHTML) dan formula LaTeX terkonversi.
*   **AI-Powered Question Generator**: Integrasi kecerdasan buatan (LLM / Groq) untuk memproduksi soal ujian secara otomatis berdasarkan topik, tingkat kesulitan, serta stimulus teks literasi/numerasi.

### 🖥️ **CBT Exam Engine Modern**
*   Antarmuka ujian siswa yang responsif, minimalis, dan dirancang fokus bebas gangguan.
*   *Rendering* persamaan matematika kompleks berkecepatan tinggi menggunakan **KaTeX (LaTeX)**.
*   **Auto-Save & Safe State**: Sinkronisasi jawaban berkala ke server untuk menghindari kehilangan progres jika terjadi kendala jaringan/daya.

### 🔒 **Exambro Guard Security**
*   Proteksi keamanan tingkat tinggi yang mendeteksi pergantian tab browser, meminimalkan jendela, dan integrasi penuh dengan aplikasi mobile client (**Exambro Guard**).
*   Gunakan variabel `VITE_DISABLE_EXAMBRO_GUARD=true` untuk menonaktifkan fitur pengaman saat tahap pengembangan/testing.

### 📊 **Real-Time Monitoring Panel**
*   Dasbor pengawas (*Proctor*) real-time untuk memantau status keaktifan siswa, kemajuan pengerjaan, sisa waktu, IP Address, dan deteksi pelanggaran saat ujian berlangsung.

### 📉 **Autograding & Laporan Penilaian**
*   Kalkulasi nilai otomatis untuk berbagai tipe soal: pilihan ganda tunggal, pilihan ganda kompleks, benar/salah, menjodohkan (*matching*), dan mengurutkan (*reorder*).
*   Fitur **Salin Laporan WhatsApp** untuk memudahkan guru membagikan rekap progres bank soal ke grup chat sekolah.

### 📲 **Capacitor Hybrid Mobile Support**
*   Konfigurasi terintegrasi untuk memaketkan platform web menjadi aplikasi native Android & iOS menggunakan framework **Capacitor**.

---

## 🛠️ Tech Stack & Dependencies

Sistem ini didesain menggunakan ekosistem teknologi modern dengan efisiensi tinggi:

| Layer | Keterangan | Teknologi Utama |
| :--- | :--- | :--- |
| **Frontend Core** | Antarmuka dinamis dan responsif | `React 18`, `TypeScript`, `Vite`, `React Router DOM` |
| **Styling & UI** | Desain premium, interaktif & konsisten | `Tailwind CSS`, `Framer Motion`, `Lucide Icons`, `Shadcn UI` |
| **Database & Auth** | Real-time backend dengan performa tinggi | `PocketBase` (Go backend, SQLite database, Real-time SDK) |
| **Math Rendering** | Render formula matematika LaTeX instan | `KaTeX` |
| **Media Storage** | Penyimpanan aset gambar/audio aman | `Cloudflare R2` dengan custom secure proxy worker |
| **File Parser** | Ekstraksi dan pengemasan berkas | `Mammoth` (.docx), `JSZip` (MHTML), `SheetJS/XLSX` (.xlsx) |
| **Mobile Integration**| Kemasan aplikasi mobile native Android/iOS | `Capacitor CLI & Plugins` (Splash Screen, App lifecycle) |

---

## 📁 Struktur Proyek

```bash
├── android                 # Proyek Native Android (Capacitor wrapper)
├── configs                 # Konfigurasi tambahan deployment & build
├── pb_hooks                # Custom Go/JS hooks backend PocketBase
├── pocketbase-schema       # Skema koleksi database PocketBase (JSON)
├── public                  # Aset statis public (logo, favicon)
├── scripts                 # Script utilitas (e.g. switch environment)
├── src
│   ├── components          # Komponen reusable (form, modal, UI shadcn, tabel)
│   ├── context             # Auth & CBT Exam data context state
│   ├── lib                 # Utility parser (Word, Excel), helper AI & R2 storage
│   ├── pages
│   │   ├── admin           # Panel Guru/Sekolah: Bank Soal, Monitoring, Ruang Ujian, Nilai
│   │   ├── student         # Halaman Siswa: Login CBT, Dashboard, Lembar Ujian
│   │   └── superadmin      # Dashboard pusat admin SaaS Multi-Tenant
│   ├── styles              # Konfigurasi gaya CSS global & Tailwind
│   └── App.tsx             # Routing & layout utama aplikasi
├── capacitor.config.ts     # Konfigurasi Capacitor Mobile App
├── tailwind.config.ts      # Konfigurasi token visual Tailwind CSS
└── package.json            # Manifest proyek & script perintah
```

---

## ⚙️ Persiapan Lingkungan (Environment Variables)

Salin berkas `.env` di root direktori proyek Anda dan sesuaikan isinya dengan parameter berikut:

```env
# Nama Aplikasi Utama
VITE_APP_NAME="EXAM AA"

# SaaS Multi-Tenant Config
VITE_MASTER_PB_URL=https://db.alfaruqasri.my.id   # Master PB database untuk registry sekolah
VITE_MAIN_DOMAIN=alfaruqasri.my.id                # Domain utama platform SaaS (tanpa subdomain)
VITE_LANDING_SUBDOMAIN=ujian                       # Subdomain halaman landing & super admin
# VITE_DEV_SCHOOL_SLUG=modalbangsa                # Aktifkan untuk bypass landing page di localhost

# Tenant Database Connection
VITE_POCKETBASE_URL=https://db.alfaruqasri.my.id

# Keamanan Exambro (Set 'true' hanya untuk bypass debugging)
VITE_DISABLE_EXAMBRO_GUARD=false

# Media & Storage Cloudflare R2
VITE_R2_PUBLIC_BASE_URL=https://assets.examku.my.id
VITE_R2_WORKER_URL=https://examku-worker.faruq-blogger.workers.dev # CF Worker proxy
```

---

## 🏃‍♂️ Panduan Menjalankan Aplikasi

### 1. Instalasi Dependensi
Rekomendasi menggunakan `bun` untuk kecepatan maksimal, namun Anda juga dapat menggunakan `npm`:
```bash
# Menggunakan Bun
bun install

# Menggunakan NPM
npm install
```

### 2. Mode Pengembangan (Local Dev Server)
Jalankan server lokal untuk proses coding dan testing:
```bash
# Menggunakan Bun
bun run dev

# Menggunakan NPM
npm run dev
```
Buka browser dan akses halaman di [http://localhost:5173](http://localhost:5173).

### 3. Build untuk Produksi
Menghasilkan bundle statis siap pasang di server hosting/VPS:
```bash
# Menggunakan Bun
bun run build

# Menggunakan NPM
npm run build
```
Hasil build teroptimasi akan tersimpan dalam direktori `dist/`.

---

## 📲 Panduan Build Aplikasi Mobile (Capacitor Android & iOS)

Aplikasi CBT ini dirancang untuk dapat dibungkus menjadi aplikasi mobile native untuk memicu deteksi Exambro Guard.

### 1. Build Proyek Web
Sebelum melakukan sinkronisasi Capacitor, pastikan bundle web terbaru telah dibuat:
```bash
bun run build
```

### 2. Sinkronisasi Aset & Plugin ke Folder Native
```bash
npx cap sync
```

### 3. Menjalankan / Membuka Android Studio
Akses editor Android Studio untuk melakukan kompilasi file APK atau Bundle:
```bash
npx cap open android
```

### 🔒 Catatan Keamanan Mobile Agent
Konfigurasi Android memiliki agen User-Agent yang dimodifikasi khusus:
```typescript
android: {
  overrideUserAgent: 'MosaExambro/1.0 (Android)'
}
```
*Platform Ujian akan mendeteksi User-Agent di atas. Siswa yang tidak menggunakan aplikasi native Exambro resmi dengan User-Agent tersebut akan secara otomatis diblokir dari lembar ujian untuk menghindari kecurangan.*

---

## 📄 Lisensi & Hak Cipta

Platform ini dirancang khusus untuk operasional dan manajemen internal ujian sekolah mitra. Seluruh kode sumber tunduk pada kebijakan lisensi internal pengembang. Penggunaan tanpa izin tertulis dilarang keras.
