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
    targetLink: 'exam-aa-latest',
    online: true
  },
  {
    key: 'browser',
    name: 'EXAM AA Browser (Custom Exam Browser)',
    targetApk: 'exam-aa-browser-latest.apk',
    targetLink: 'exam-aa-browser-latest',
    online: true
  },
  {
    key: 'local',
    name: 'EXAMKU Local (Offline Server Client)',
    targetApk: 'examku-local.apk',
    targetLink: 'examku-local'
  }
];

console.log('\n======================================================');
console.log('   Membangun & Mengirim 3 APK ke VPS (examku.my.id)');
console.log('======================================================\n');

// 1. Bersihkan APK sampah di public, dist, dan assets Android agar tidak ikut terbungkus ke APK
const cleanDirs = [
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'android', 'app', 'src', 'main', 'assets', 'public')
];
for (const dir of cleanDirs) {
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.apk')) {
        try { fs.unlinkSync(path.join(dir, f)); } catch {}
      }
    }
  }
}

// 2. Build Web terlebih dahulu agar dist selalu versi terbaru
console.log('📦 [Langkah 1/3] Membangun bundle web (npm run build)...');
execSync('npm run build', { stdio: 'inherit' });

// Siapkan webDir per profil:
// - online (serverUrl): shell minimal, konten dimuat dari server (~4MB APK)
// - offline (local): full dist agar bisa jalan tanpa internet
const minimalHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EXAMKU</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#10b981;font-family:sans-serif}</style></head><body><p>Memuat EXAMKU...</p></body></html>`;
function prepareWebDir(webDir, online) {
  const target = path.join(process.cwd(), webDir);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  if (online) {
    fs.writeFileSync(path.join(target, 'index.html'), minimalHtml);
    console.log(`📦 ${webDir}: shell minimal (load online, APK ~4MB)`);
  } else {
    console.log(`📦 Menyalin dist -> ${webDir} (offline full)...`);
    fs.cpSync(path.join(process.cwd(), 'dist'), target, { recursive: true });
  }
}

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

  // Siapkan webDir SESUDAH switch config tapi SEBELUM cap sync.
  // (switch-app.js menjalankan npx cap sync di dalamnya,
  //  jadi webDir harus sudah benar sebelum switch dipanggil.)
  const webDir = item.key === 'browser' ? 'dist-browser' : 'dist-shell';
  prepareWebDir(webDir, !!item.online);

  // Switch konfigurasi (menjalankan npx cap sync di dalamnya)
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
console.log('\n🌐 [Langkah 3/4] Mengompres dan memperbarui web bundle di VPS...');
try {
  execSync(`tar -czf dist.tar.gz -C dist .`, { stdio: 'inherit' });
  execSync(`scp dist.tar.gz ${VPS_HOST}:${VPS_DIST}/`, { stdio: 'inherit' });
  execSync(`ssh ${VPS_HOST} "tar -xzf ${VPS_DIST}/dist.tar.gz -C ${VPS_DIST}/ && rm -f ${VPS_DIST}/dist.tar.gz && chown -R caddy:caddy ${VPS_DIST} && chmod -R 755 ${VPS_DIST} && systemctl reload caddy"`, { stdio: 'inherit' });
} finally {
  if (fs.existsSync('dist.tar.gz')) {
    fs.unlinkSync('dist.tar.gz');
  }
}

// 4. Purge Cache Cloudflare otomatis
console.log('\n⚡ [Langkah 4/4] Membersihkan Cache Cloudflare (Purge Cache)...');
try {
  execSync(`ssh ${VPS_HOST} "/root/purge_cache.sh"`, { stdio: 'inherit' });
  console.log('✅ Cloudflare Cache berhasil dibersihkan otomatis!');
} catch (err) {
  console.warn('⚠️ Gagal membersihkan cache Cloudflare otomatis:', err.message);
}

// Kembalikan profil default ke examaa
console.log('\n[+] Mengembalikan profil aktif ke examaa...');
execSync('node scripts/switch-app.js examaa', { stdio: 'inherit' });

console.log('\n======================================================');
console.log('   🎉 SEMUA APK & WEB DIST SELESAI DI-DEPLOY KE VPS!');
console.log('======================================================');
console.log(`1. APK EXAM AA:`);
console.log(`   👉 https://examku.my.id/exam-aa-latest`);
console.log(`   👉 https://examku.my.id/exam-aa-latest.apk`);
console.log(`2. APK EXAM AA Browser:`);
console.log(`   👉 https://examku.my.id/exam-aa-browser-latest`);
console.log(`   👉 https://examku.my.id/exam-aa-browser-latest.apk`);
console.log(`3. Web App:`);
console.log(`   👉 https://examku.my.id`);
console.log('======================================================\n');
