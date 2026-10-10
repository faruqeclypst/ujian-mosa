// ============================================================
// Panduan: Membuat Keystore untuk Google Play Store
// ============================================================
// Keystore = "tanda tangan digital" aplikasi. WAJIB dibackup!
// Kalau hilang → tidak bisa update aplikasi lagi selamanya.
//
// LANGKAH 1: Generate keystore (jalankan sekali saja)
// ------------------------------------------------------------
//   keytool -genkey -v -keystore examku-release.keystore \
//     -alias examku -keyalg RSA -keysize 2048 -validity 10000
//
//   Isi yang diminta:
//   - Password keystore  → buat yang kuat, CATAT!
//   - Nama, organisasi   → isi bebas (nama Anda / "Alfa Projects")
//   - Password key       → boleh sama dengan password keystore
//
//   File examku-release.keystore akan muncul di folder ini.
//
// LANGKAH 2: Buat android/keystore.properties
// ------------------------------------------------------------
//   Copy dari android/keystore.properties.example, isi password:
//
//   storeFile=../examku-release.keystore
//   storePassword=PASSWORD_ANDA
//   keyAlias=examku
//   keyPassword=PASSWORD_ANDA
//
//   ⚠️ File keystore.properties TIDAK BOLEH di-commit ke git!
//   Sudah otomatis di-ignore via .gitignore.
//
// LANGKAH 3: Backup!
// ------------------------------------------------------------
//   Simpan di MINIMAL 2 tempat berbeda:
//   - Google Drive / cloud storage pribadi
//   - Flashdisk / harddisk eksternal
//   Catat juga password-nya di password manager.
//
// LANGKAH 4: Build AAB
// ------------------------------------------------------------
//   npm run build:aab
//   Hasil: android/app/build/outputs/bundle/release/app-release.aab
//   File inilah yang di-upload ke Play Console.
// ============================================================
