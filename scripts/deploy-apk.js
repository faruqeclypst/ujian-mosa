import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const VPS_HOST = 'root@64.235.41.108';
const VPS_DIST = '/opt/frontend/ujian/dist';

// 1. Format tanggal dd-mm-yyyy
const now = new Date();
const dd = String(now.getDate()).padStart(2, '0');
const mm = String(now.getMonth() + 1).padStart(2, '0');
const yyyy = now.getFullYear();
const dateStr = `${dd}-${mm}-${yyyy}`;

console.log(`\n========================================`);
console.log(`  EXAM AA - Auto Build & Deploy APK`);
console.log(`  Tanggal: ${dateStr}`);
console.log(`========================================\n`);

// 2. Hitung digit build keberapa hari ini di VPS
let nextBuildNum = 1;
try {
  const remoteFiles = execSync(`ssh -o ConnectTimeout=5 ${VPS_HOST} "ls ${VPS_DIST}/exam-aa_${dateStr}-*.apk 2>/dev/null || true"`, { encoding: 'utf-8' });
  const matches = remoteFiles.match(new RegExp(`exam-aa_${dateStr}-(\\d+)\\.apk`, 'g'));
  if (matches && matches.length > 0) {
    const nums = matches.map(m => {
      const parts = m.match(/-(\d+)\.apk$/);
      return parts ? parseInt(parts[1], 10) : 0;
    });
    nextBuildNum = Math.max(...nums) + 1;
  }
} catch {
  // Gunakan build 1 jika gagal query
}

const apkFileName = `exam-aa_${dateStr}-${nextBuildNum}.apk`;
console.log(`Target nama APK: ${apkFileName}\n`);

// 3. Sync Capacitor
console.log(`[1/4] Sinkronisasi web assets ke Android...`);
execSync(`npx cap sync android`, { stdio: 'inherit' });

// 4. Build APK Android
console.log(`\n[2/4] Membangun APK Android via Gradle...`);
const gradlewCmd = process.platform === 'win32' ? 'cmd.exe /c "cd android && gradlew.bat assembleDebug"' : 'cd android && ./gradlew assembleDebug';
execSync(gradlewCmd, { stdio: 'inherit' });

const localApkPath = path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!fs.existsSync(localApkPath)) {
  console.error(`\n[ERROR] File APK lokal tidak ditemukan di: ${localApkPath}`);
  process.exit(1);
}

// 5. Transfer ke VPS
console.log(`\n[3/4] Mengirim ${apkFileName} ke VPS (${VPS_HOST})...`);
execSync(`scp "${localApkPath}" ${VPS_HOST}:${VPS_DIST}/${apkFileName}`, { stdio: 'inherit' });

// 6. Update symlink / fallback app-debug.apk & izin akses Caddy
console.log(`\n[4/4] Memperbarui izin akses & Caddy di VPS...`);
execSync(`ssh ${VPS_HOST} "cp -f ${VPS_DIST}/${apkFileName} ${VPS_DIST}/app-debug.apk && chown caddy:caddy ${VPS_DIST}/${apkFileName} ${VPS_DIST}/app-debug.apk && chmod 644 ${VPS_DIST}/${apkFileName} ${VPS_DIST}/app-debug.apk && systemctl reload caddy"`, { stdio: 'inherit' });

console.log(`\n======================================================`);
console.log(`  [SUKSES] APK Berhasil Di-build & Dikirim ke VPS!`);
console.log(`  File APK : ${apkFileName}`);
console.log(`  Download : https://examku.my.id/${apkFileName}`);
console.log(`  Fallback : https://examku.my.id/app-debug.apk`);
console.log(`======================================================\n`);
