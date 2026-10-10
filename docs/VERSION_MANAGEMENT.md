# Manajemen Versi & Force Update APK

Dokumen ini menjelaskan cara kerja versioning terpusat dan fitur force update aplikasi Android siswa.

## Konsep Dasar

Setiap APK Android punya dua identitas versi:

| Istilah | Contoh | Fungsi |
|---|---|---|
| **VersionName** | `1.1.18` | Label yang dibaca manusia, tampil di layar HP |
| **VersionCode** | `20` | Angka integer tersembunyi, dipakai sistem untuk perbandingan |

**Yang menentukan force update adalah VersionCode (angka), bukan VersionName (label).**

Logika di `src/components/auth/AppVersionGuard.tsx`:
```javascript
if (forceUpdate && installedBuild < minVersionCode) {
  // Kunci aplikasi, tampilkan layar wajib update
}
```

## Satu Gerbang Versi (Single-Gate)

**JANGAN PERNAH** edit versi manual di file terpisah. Gunakan satu perintah:

```bash
npm run version:set <versi_baru> [--notes "Catatan Rilis"]
```

Contoh:
```bash
npm run version:set 1.1.19
npm run version:set 1.2.0 --notes "Fitur analisis butir soal baru"
```

### 7 Gerbang Otomatis

Perintah di atas otomatis menyinkronkan ke 7 tempat:

1. `package.json` → field `"version"`
2. `src/utils/version.ts` → `APP_VERSION` & `APP_DISPLAY_VERSION` (tampil di UI web)
3. `android/app/build.gradle` → `versionName` diset, `versionCode` naik +1 otomatis
4. `public/version.json` & `offline_package/version.json` → metadata CDN
5. `pb_hooks/offline_update.pb.js` → versi fallback backend
6. `scripts/release-all.js` → konstanta fallback rilis
7. `app_settings` di Master PocketBase → `min_version_code` & `min_version_name`
   (via step [7/7] di `release-all.js`, script: `vps/update-app-settings.py`)

**Catatan:** `is_force_update` di `app_settings` TIDAK diubah otomatis — tetap dikontrol manual via dashboard superadmin.

## Alur Rilis Normal

```bash
# 1. Naikkan versi
npm run version:set 1.1.19

# 2. Rilis lengkap (build APK + deploy + sync)
npm run release:all

# ATAU rilis cepat tanpa build APK:
npm run release:quick
```

Setelah `release:all`:
- APK baru (versionCode 21) ter-upload ke server
- `app_settings` otomatis update: min_version_code = 21
- HP siswa dengan build < 21 langsung dikunci saat buka aplikasi

## Cara Kerja Force Update

### Di Aplikasi (Exam AA)

1. Saat aplikasi dibuka, `AppVersionGuard` berjalan (hanya di Android/iOS native)
2. Ambil info versi terinstall via Capacitor: `App.getInfo()` → `build`, `version`
3. Ambil konfigurasi dari Master PocketBase: collection `app_settings`
4. Bandingkan: jika `is_force_update = true` DAN `installedBuild < min_version_code` → tampilkan layar kunci
5. Siswa wajib download APK baru via tombol yang disediakan

### Di Dashboard Superadmin

**Lokasi:** Superadmin → Pengaturan → Versi APK Siswa

| Field | Isi dengan | Contoh |
|---|---|---|
| Nama Aplikasi | Nama app | `EXAM AA` |
| Versi Minimal Label | VersionName APK terbaru | `1.1.18` |
| Kode Versi Minimal | VersionCode APK terbaru | `20` |
| Download URL | Link APK terbaru | `http://examku.my.id/exam-aa-latest.apk` |
| Force Update toggle | ON untuk paksa update | — |

**PENTING:** Kode Versi Minimal harus sama dengan (atau lebih tinggi dari) versionCode APK terbaru di `android/app/build.gradle`. Jika lebih rendah, tidak ada HP yang diblokir.

## Troubleshooting

### Force update tidak berfungsi

1. **Cek Kode Versi Minimal** — pastikan angkanya >= versionCode APK terbaru di build.gradle
   ```bash
   grep "versionCode" android/app/build.gradle
   ```
2. **Cek toggle Force Update** — harus ON (biru)
3. **Cek di HP** — buka aplikasi, lihat apakah layar kunci muncul. Jika tidak, berarti `installedBuild >= minVersionCode`
4. **Cek koneksi** — aplikasi harus bisa akses Master PocketBase untuk ambil konfigurasi

### Setting tidak tersimpan

- Pastikan login sebagai Super Admin
- Cek console browser (F12) untuk error
- Pastikan collection `app_settings` ada di Master PocketBase

### Setelah release:all, setting tidak update otomatis

- Cek output step [7/7] — pastikan tidak ada error SSH
- Pastikan file `/usr/local/bin/update-app-settings.py` ada di Master VPS
- Bisa update manual via dashboard sebagai fallback

## File Terkait

| File | Fungsi |
|---|---|
| `scripts/set-version.js` | Single-gate version bump (6 gerbang lokal) |
| `scripts/release-all.js` | Pipeline rilis + step [7/7] sync app_settings |
| `vps/update-app-settings.py` | Script Python di Master VPS untuk update collection |
| `src/components/auth/AppVersionGuard.tsx` | Komponen React yang mengunci aplikasi usang |
| `src/pages/superadmin/SuperAdminSettingsPage.tsx` | Form pengaturan versi di dashboard |
| `android/app/build.gradle` | Sumber kebenaran versionCode/versionName APK |
