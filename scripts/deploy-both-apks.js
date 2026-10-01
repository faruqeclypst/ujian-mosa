import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VPS_HOST = 'root@64.235.41.108';
const VPS_DIST = '/opt/frontend/ujian/dist';
const VPS_APKS = '/opt/frontend/ujian/apks';

const APKS = [
  {
    key: 'examaa',
    name: 'EXAM AA (Official CBT Client)',
    targetApk: 'exam-aa-latest.apk',
    targetLink: 'exam-aa-latest'
  },
  {
    key: 'browser',
    name: 'EXAM AA Browser (Custom Exam Browser)',
    targetApk: 'exam-aa-browser-latest.apk',
    targetLink: 'exam-aa-browser-latest'
  }
];

console.log('\n======================================================');
console.log('   Membangun & Mengirim 2 APK ke VPS (examku.my.id)');
console.log('======================================================\n');

// 1. Build Web terlebih dahulu agar dist selalu versi terbaru
console.log('📦 [Langkah 1/3] Membangun bundle web (bun run build)...');
execSync('bun run build', { stdio: 'inherit' });

// 2. Loop build masing-masing APK
const gradlewCmd = process.platform === 'win32' 
  ? 'cmd.exe /c "cd android && gradlew.bat assembleDebug"' 
  : 'cd android && ./gradlew assembleDebug';

const localApkPath = path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

for (let i = 0; i < APKS.length; i++) {
  const item = APKS[i];
  console.log(`\n------------------------------------------------------`);
  console.log(`📱 [${i + 1}/${APKS.length}] Memproses ${item.name}...`);
  console.log(`------------------------------------------------------`);

  // Switch konfigurasi
  console.log(`[+] Beralih konfigurasi ke ${item.key}...`);
  execSync(`node scripts/switch-app.js ${item.key}`, { stdio: 'inherit' });

  // Bersihkan APK lama jika ada
  if (fs.existsSync(localApkPath)) {
    fs.unlinkSync(localApkPath);
  }

  // Build via Gradle
  console.log(`[+] Mengompilasi APK via Gradle (${item.key})...`);
  execSync(gradlewCmd, { stdio: 'inherit' });

  if (!fs.existsSync(localApkPath)) {
    console.error(`[ERROR] Kompilasi gagal! File APK tidak ditemukan di: ${localApkPath}`);
    process.exit(1);
  }

  // Kirim ke VPS (ke folder apks permanen dan dist)
  console.log(`[+] Mengirim ${item.targetApk} ke VPS...`);
  execSync(`scp "${localApkPath}" ${VPS_HOST}:${VPS_APKS}/${item.targetApk}`, { stdio: 'inherit' });
  execSync(`scp "${localApkPath}" ${VPS_HOST}:${VPS_DIST}/${item.targetApk}`, { stdio: 'inherit' });

  // Buat copy / symlink tanpa ekstensi .apk agar endpoint examku.my.id/exam-aa-latest bisa langsung diakses
  console.log(`[+] Menautkan endpoint ${item.targetLink} di VPS...`);
  execSync(`ssh ${VPS_HOST} "cp -f ${VPS_APKS}/${item.targetApk} ${VPS_APKS}/${item.targetLink} && cp -f ${VPS_DIST}/${item.targetApk} ${VPS_DIST}/${item.targetLink} && chmod -R 755 ${VPS_APKS}"`, { stdio: 'inherit' });
}

// 3. Update izin dan kirim web dist terbaru ke VPS
console.log('\n🌐 [Langkah 3/4] Memperbarui web bundle & Caddy di VPS...');
execSync(`scp dist/index.html ${VPS_HOST}:${VPS_DIST}/index.html`, { stdio: 'inherit' });
execSync(`scp -r dist/assets ${VPS_HOST}:${VPS_DIST}/`, { stdio: 'inherit' });
execSync(`ssh ${VPS_HOST} "chown -R caddy:caddy ${VPS_DIST} && chmod -R 755 ${VPS_DIST} && systemctl reload caddy"`, { stdio: 'inherit' });

// 4. Purge Cache Cloudflare otomatis
console.log('\n⚡ [Langkah 4/4] Membersihkan Cache Cloudflare (Purge Cache)...');
try {
  execSync(`ssh ${VPS_HOST} "/root/purge_cache.sh"`, { stdio: 'inherit' });
  console.log('✅ Cloudflare Cache berhasil dibersihkan otomatis!');
} catch (err) {
  console.warn('⚠️ Gagal membersihkan cache Cloudflare otomatis:', err.message);
}

console.log('\n======================================================');
console.log('   🎉 SEMUA APK SELESAI DI-BUILD & DIPUBLIKASIKAN!');
console.log('======================================================');
console.log(`1. APK EXAM AA:`);
console.log(`   👉 https://examku.my.id/exam-aa-latest`);
console.log(`   👉 https://examku.my.id/exam-aa-latest.apk`);
console.log(`2. APK EXAM AA Browser:`);
console.log(`   👉 https://examku.my.id/exam-aa-browser-latest`);
console.log(`   👉 https://examku.my.id/exam-aa-browser-latest.apk`);
console.log('======================================================\n');
