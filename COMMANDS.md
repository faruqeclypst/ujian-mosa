# 📋 CHEATSHEET & PANDUAN PERINTAH OPERASIONAL EXAMKU

Dokumen ini merangkum seluruh perintah operasional, otomatisasi build, deploy, sinkronisasi template PocketBase, rilis paket offline, dan pengelolaan VPS.

---

## 📌 Kontrol Versi 1 Gerbang (Single Gate Versioning)

Untuk mengubah versi sistem di **SELURUH** komponen sekaligus dalam 1 perintah (`package.json`, badge UI Web, `build.gradle` APK Android, `version.json` CDN, dan hook offline update):

```bash
npm run version:set <versi_baru> [--notes "Catatan Rilis"]
```

Contoh:
```bash
npm run version:set 1.1.2
# atau
npm run version:set 1.2.0 --notes "Peningkatan stabilitas dan fitur baru"
```

Setelah gerbang versi di-set, cukup lanjutkan dengan rilis:
- `npm run release:all` (Rilis penuh: Web + VPS + Tenants + Offline + APK)
- `npm run release:quick` (Rilis cepat: Web + VPS + Tenants + Offline tanpa APK)

---

## 🚀 0. Rilis Master Serentak (All-in-One Master Release)

Jika Anda memiliki pembaruan dan ingin memperbarui **semua komponen sekaligus dalam 1 perintah** (Web frontend, VPS Master, Hooks backend, Sync seluruh tenant sekolah aktif, Paket Offline 1-Click Update, APK Android, dan Purge Cloudflare):

```bash
npm run release:all
```

### Opsi Cepat / Khusus Web & Offline (Tanpa Rebuild APK Android):
Jika hanya memperbarui frontend web, hooks backend, atau paket offline tanpa perlu mengompilasi ulang APK Android:
```bash
npm run release:quick
# atau
npm run release:offline
```

#### Alur Otomatis yang Dijalankan:
1. **Web Build**: Kompilasi TypeScript dan Vite bundle production (`dist/`).
2. **Web Deploy**: Mengunggah bundle web ke Master VPS (`/opt/frontend/ujian/dist/`).
3. **Template & Hooks**: Mengirim `pb_hooks/` ke template Master VPS dan Worker Node.
4. **1-Click Sync Tenants**: Menerapkan perubahan hooks ke seluruh sekolah aktif.
5. **Offline 1-Click Update**: Mengemas `offline-update.zip` dan `version.json` ke folder download CDN (`https://examku.my.id/downloads/offline-update.zip`). Database sekolah (`data.db`) dijamin 100% aman dan tidak tersentuh.
6. **APK Android (khusus `release:all`)**: Build Gradle APK Exambro dan unggah ke server download.
7. **Purge Cache**: Membersihkan cache Cloudflare CDN secara menyeluruh.

---

## ⚡ 1. Alur Kerja Satuan (Individual Workflow)

### A. Alur Update Template & Hooks Backend
Jika Anda hanya ingin memperbarui kode di `pb_hooks/` (seperti cron job, triggers, atau skema database template):

1. **Edit kode lokal**: Ubah file di folder `pb_hooks/` atau `vps/template_school/`.
2. **Kirim ke VPS**:
   ```bash
   npm run push:template
   ```
   *Perintah ini otomatis meng-copy file ke template Master VPS dan Worker VPS.*
3. **Terapkan ke Seluruh Sekolah Aktif**:
   - **Opsi Terminal**:
     ```bash
     npm run sync:tenants
     ```
   - **Opsi Dashboard SuperAdmin (UI)**:
     Buka [https://examku.my.id/superadmin/infra](https://examku.my.id/superadmin/infra), lalu klik tombol **"1-Click Sync Seluruh Tenant"**.

---

### B. Alur Update Tampilan Web Frontend
Jika Anda mengubah tampilan, komponen React, atau styling di `src/`:

1. **Deploy ke VPS**:
   ```bash
   npm run deploy:vps
   ```
   *Perintah ini otomatis menjalankan `npm run build`, mengompres file, mengirim ke VPS, mengekstrak ke `/opt/frontend/ujian/dist`, dan mengatur izin akses.*
2. **Bersihkan Cache Cloudflare (jika diperlukan)**:
   ```bash
   ssh root@64.235.41.108 "/root/purge_cache.sh"
   ```

---

### C. Alur Build & Rilis APK Mobile (Exambro)
Jika Anda memperbarui aplikasi Android Exambro:

1. **Pilih Profil Aplikasi**:
   ```bash
   npm run switch:examaa      # Mode Exam AA (Aplikasi Resmi Ujian)
   # atau
   npm run switch:browser     # Mode Browser Biasa
   ```
2. **Build dan Kirim APK ke Server**:
   ```bash
   npm run deploy:apk
   ```

---

### D. Alur Pembaruan Server Offline Sekolah (1-Click Update)
Sekolah pengguna Server Offline Mandiri dapat memperbarui server dengan dua cara praktis tanpa perlu unduh ulang master installer 150MB+:

1. **Melalui Dashboard Web (1-Click Update)**:
   - Hubungkan laptop server ke Wi-Fi / internet sebentar.
   - Buka menu **Pengaturan** di dashboard web sekolah.
   - Pada kartu **"Pembaruan 1-Click Offline Server"**, klik **"Cek Pembaruan Sistem"** lalu **"Pasang Pembaruan Sekarang"**.
   - Sistem otomatis mengunduh dan memasang modul web & hooks terbaru. Database `data.db` tetap 100% aman dan utuh.
2. **Melalui Batch Script (`perbarui-server.bat`)**:
   - Di folder server sekolah, klik dua kali file `perbarui-server.bat`.
   - Script akan mengunduh paket update dan mengekstraknya secara otomatis.

---

## 💻 2. Daftar Perintah NPM Lengkap

| Perintah | Fungsi | Lokasi Target / Efek |
| :--- | :--- | :--- |
| `npm run release:all` | **Rilis master lengkap (Web + VPS + Hooks + Sync + Offline + APK + Purge)** | Seluruh Server Cloud, Tenant, Offline, & CDN |
| `npm run release:quick` | **Rilis cepat Web + VPS + Hooks + Sync + Offline + Purge (Tanpa APK)** | Server Cloud, Tenant, & Offline CDN |
| `npm run release:offline`| Alias untuk rilis cepat pembaruan offline dan web | Server Cloud & Offline CDN |
| `npm run dev` | Menjalankan Vite dev server lokal | `http://localhost:5173` |
| `npm run build` | Kompilasi TypeScript dan bundle web production | Folder `dist/` |
| :--- | :--- | :--- |
| `npm run dev` | Menjalankan Vite dev server lokal | `http://localhost:5173` |
| `npm run build` | Kompilasi TypeScript dan bundle web production | Folder `dist/` |
| `npm run preview` | Meninjau hasil build secara lokal | Local preview server |
| `npm run deploy:vps` | Build frontend dan deploy langsung ke server web VPS | Master VPS (`/opt/frontend/ujian/dist`) |
| `npm run push:template` | Push `pb_hooks` dan database template lokal ke template VPS | Template Master VPS & Worker VPS |
| `npm run sync:tenants` | Push template sekaligus sinkronisasi ke seluruh sekolah aktif | Seluruh tenant di Master & Worker |
| `npm run switch:examaa` | Switch konfigurasi Android ke mode Exam AA | `capacitor.config.ts` & native Android |
| `npm run switch:browser`| Switch konfigurasi Android ke mode Browser | `capacitor.config.ts` & native Android |
| `npm run switch` | Menu interaktif pemilihan profil aplikasi | Terminal CLI |
| `npm run deploy:apk` | Build APK Android dan rilis otomatis ke server download | `https://examku.my.id/app-debug.apk` |
| `npm run deploy:apks` | Build dan deploy kedua versi APK sekaligus | Server download VPS |
| `npm run lint` | Pengecekan standar kode (ESLint) | Local environment |
| `npm run format` | Memformat kode secara otomatis (Prettier) | Local codebase |

---

## 🏢 3. Struktur Template Sekolah di Repo & VPS

Setiap sekolah baru yang dibuat di platform ini disalin dari template dasar:

```
[Repo Lokal]
├── pb_hooks/                     <-- Hook JavaScript PocketBase utama (crons, triggers)
└── vps/template_school/
    ├── pb_hooks/                 <-- Salinan identik dari pb_hooks root
    └── pb_data/data.db           <-- Database SQLite kosong dengan 17 koleksi baku

        │ (dikirim via: npm run push:template)
        ▼

[Master VPS: 64.235.41.108]
└── /opt/pocketbase/schools/template/
    ├── pb_hooks/
    └── pb_data/data.db

        │ (otomatis di-rsync ke Worker VPS)
        ▼

[Worker VPS: 43.134.175.87]
└── /opt/pocketbase/schools/template/
    ├── pb_hooks/
    └── pb_data/data.db
```

Saat Anda menjalankan perintah sinkronisasi (`npm run sync:tenants` atau klik tombol di SuperAdmin):
1. Script membaca seluruh folder sekolah di `/opt/pocketbase/schools/*`.
2. Isi folder `pb_hooks/` di setiap sekolah diperbarui dari template.
3. Service `pb-<slug>` di-restart otomatis tanpa downtime berarti.

---

## 🖥️ 4. Perintah Operasional di Terminal VPS

### Akses Server via SSH
- **Master VPS**: `ssh root@64.235.41.108`
- **Worker VPS**: `ssh root@43.134.175.87` (bisa diakses langsung dari Master VPS via `ssh root@43.134.175.87`)

### Skrip Utilitas di `/usr/local/bin/` (Master VPS)

| Skrip | Contoh Perintah | Kegunaan |
| :--- | :--- | :--- |
| **Sync All Tenants** | `/usr/local/bin/sync-all-tenants.sh` | Sinkronkan hooks template ke seluruh sekolah aktif |
| **Add School** | `/usr/local/bin/add-school.sh sman1 8095` | Mendaftarkan sekolah baru di Master VPS |
| **Add School (Worker)** | `/usr/local/bin/add-school.sh sman1 8095 _ 500 43.134.175.87` | Mendaftarkan sekolah baru langsung di Worker Node |
| **Remove School** | `/usr/local/bin/remove-school.sh sman1` | Menghapus database, service, dan reverse proxy sekolah |
| **Migrate Tenant** | `/usr/local/bin/migrate-tenant.sh sman1 43.134.175.87 8095` | Pindahkan sekolah dari Master ke Worker VPS (atau sebaliknya) |
| **Purge CDN Cache** | `/root/purge_cache.sh` | Bersihkan cache Cloudflare CDN |

---

## 🛠️ 5. Manajemen Service Systemd (PocketBase & Caddy)

Ganti `<slug>` dengan slug sekolah (contoh: `pb-modalbangsa`, `pb-sman1kbj`, `pb-master`):

```bash
# Cek status service sekolah
systemctl status pb-<slug>

# Restart service sekolah
systemctl restart pb-<slug>

# Membaca log realtime sekolah (debug error/cron)
journalctl -u pb-<slug> -f

# Reload web server Caddy setelah perubahan domain/proxy
systemctl reload caddy

# Membaca log web server Caddy
journalctl -u caddy -f
```

---

## 📂 6. Lokasi Folder Penting di VPS

- **Master Database PocketBase**: `/opt/pocketbase/master/pb_data/data.db`
- **Data Sekolah-Sekolah**: `/opt/pocketbase/schools/<slug>/`
- **Folder Template Sekolah**: `/opt/pocketbase/schools/template/`
- **Frontend Web Terpasang**: `/opt/frontend/ujian/dist/`
- **Konfigurasi Caddy Global**: `/etc/caddy/Caddyfile`
- **Konfigurasi Subdomain Sekolah**: `/etc/caddy/conf.d/<slug>.caddy`
- **Binary PocketBase**: `/usr/local/bin/pocketbase`

---

## ❓ 7. Troubleshooting Cepat

### Q1: Perubahan di file `pb_hooks/main.pb.js` tidak berefek di sekolah?
**Solusi**:
Jalankan `npm run sync:tenants` dari komputer lokal Anda. Perintah ini akan menyalin file ke template VPS dan me-restart service PocketBase di semua sekolah.

### Q2: Tampilan web yang baru saya deploy tidak muncul di browser siswa?
**Solusi**:
Browser atau Cloudflare CDN menyimpan cache versi lama.
1. Jalankan `ssh root@64.235.41.108 "/root/purge_cache.sh"` untuk membersihkan cache Cloudflare.
2. Di browser siswa/guru, lakukan hard reload (`Ctrl + Shift + R`).

### Q3: Bagaimana cara melihat apakah database seluruh sekolah sudah sama?
**Solusi**:
Semua skema database telah diselaraskan ke template 17 koleksi baku. Anda dapat mengecek log atau status service kapan saja dengan `systemctl status pb-<slug>`.
