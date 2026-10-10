# 📝 Log Riwayat Deployment & Sinkronisasi Sistem

Dokumen ini mencatat riwayat pembaruan, perbaikan bug, proses build, deployment frontend ke VPS, serta sinkronisasi template dan database tenant PocketBase.

---

## 📅 Tanggal: 04 Oktober 2026

### 📌 Ringkasan Perubahan:
1. **Halaman Pengaturan Tenant (`SettingsPage.tsx`)**:
   - Memperbaiki masalah race condition pada `useEffect` saat memuat data settings sekolah.
   - Menggunakan `useCallback` dan dependency array `[pb, tenantLoading, fetchSettings]`.
   - Menambahkan safety timeout 3.5 detik untuk memastikan halaman tidak terjebak dalam skeleton loading.

2. **Halaman Panduan Tenant (`GuidePage.tsx`)**:
   - Menjadikan kolom pencarian universal (tersedia di ponsel, tablet, dan desktop) lengkap dengan shortcut `Ctrl + K`.
   - Menambahkan bilah navigasi bab horizontal (*swipeable chip bar*) pada layar ponsel (`lg:hidden`) untuk navigasi cepat antar-bab.
   - Menyesuaikan padding kartu (`p-4 sm:p-8 lg:p-12`) dan sudut kurva (`rounded-2xl sm:rounded-3xl`) agar konten tidak terjepit pada layar smartphone.
   - Merapikan kartu analitik psikometri butir soal, tabel rumus LaTeX matematika, dan profil pengembang.

3. **Perbaikan Rotasi Token Ujian di Offline Mode**:
   - Memperbaiki query PocketBase JS pada cron 5-menit di `offline_package/pb_hooks/main.pb.js`, `pb_hooks/main.pb.js`, dan `vps/template_school/pb_hooks/main.pb.js` menggunakan `$app.findRecordsByFilter("exam_rooms", "status != 'archive' && isActive != false", "", 1, 0)`.
   - Mengatasi error Goja refleksi Go yang sebelumnya menyebabkan rotasi token gagal diam-diam (*silent failure*).
   - Menambahkan endpoint `POST /api/rotate-token` dan `GET /api/rotate-token` untuk rotasi on-demand.
   - Menambahkan tombol **"Putar Token"** serta auto-trigger rotasi saat hitung mundur mencapai `00:00` di `TokenViewPage.tsx` dan `ExamDataContext.tsx`.
   - Menyinkronkan perubahan ke folder offline testing aktif (`C:\Users\Admin\Music\exam aa sd\offline_package\pb_hooks\main.pb.js`).

---

4. **Master Release Pipeline All-in-One (`npm run release:all` & `release:offline`)**:
   - Dibuat script otomasi rilis terpusat `scripts/release-all.js`.
   - Menggabungkan build web, deploy ke Master VPS, sinkronisasi template dan hooks ke Master & Worker VPS, 1-Click sync ke seluruh tenant sekolah, pengemasan paket offline update ke CDN, build/upload APK Android, dan purge Cloudflare CDN hanya dalam 1 perintah tunggal.
   - Mendukung flag `--skip-apk` (`npm run release:quick` / `npm run release:offline`) untuk rilis cepat web & backend tanpa harus menunggu build APK Android.

5. **Pembaruan 1-Click Server Offline Mandiri**:
   - Dibuat hook PocketBase `offline_update.pb.js` yang menyediakan endpoint `GET /api/offline-update-check` dan `POST /api/offline-update-apply`.
   - Menerapkan pembaruan web (`pb_public/`) dan modul backend (`pb_hooks/`) dengan aman tanpa menyentuh database sekolah (`pb_data/data.db`).
   - Ditambahkan kartu interaktif **"Pembaruan 1-Click (Offline Server)"** pada halaman Pengaturan (`SettingsPage.tsx`).
   - Disediakan script batch utilitas `offline_package/perbarui-server.bat` untuk pembaruan manual 1-klik di komputer offline.

---

### 🚀 Status Eksekusi Deployment:
- [x] **`npm run build`**: Selesai tanpa kendala (0 error TypeScript & Vite production bundle berhasil).
- [x] **`npm run deploy:vps`**: Berhasil di-deploy ke Master VPS (`64.235.41.108`) pada direktori `/opt/frontend/ujian/dist`.
- [x] **`npm run push:template`**: Berhasil diunggah ke template Master VPS dan Worker Node (`43.134.175.87`).
- [x] **`npm run sync:tenants`**: Berhasil disinkronkan ke seluruh tenant sekolah aktif di Master VPS & Worker VPS.
- [x] **`npm run release:offline`**: Berhasil mengemas dan mempublikasikan `offline-update.zip` dan `version.json` ke CDN Examku (`https://examku.my.id/downloads/`).
- [x] **Cloudflare Cache Purge**: Cache CDN di-purge secara penuh melalui `/root/purge_cache.sh`.
