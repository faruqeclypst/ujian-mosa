import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const args = process.argv.slice(2);
let targetVersion = args[0];
let notes = 'Pembaruan otomatis sistem CBT, peningkatan performa, dan stabilitas.';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--notes' && args[i + 1]) {
    notes = args[i + 1];
  }
}

// Format tanggal DD-MM-YYYY
const now = new Date();
const dd = String(now.getDate()).padStart(2, '0');
const mm = String(now.getMonth() + 1).padStart(2, '0');
const yyyy = now.getFullYear();
const dateStr = `${dd}-${mm}-${yyyy}`;

// Baca versi saat ini dari package.json
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version || '1.1.1';

if (!targetVersion || targetVersion === '--notes') {
  console.log(`\n======================================================`);
  console.log(`   📌 SISTEM KONTROL VERSI 1 GERBANG (EXAMKU CBT)`);
  console.log(`======================================================`);
  console.log(`Versi saat ini: ${currentVersion}\n`);
  console.log(`Penggunaan:`);
  console.log(`  node scripts/set-version.js <versi_baru> [--notes "Catatan Rilis"]`);
  console.log(`\nContoh:`);
  console.log(`  node scripts/set-version.js 1.1.2`);
  console.log(`  node scripts/set-version.js 1.2.0 --notes "Fitur Analisis Butir Soal Baru"`);
  console.log(`======================================================\n`);
  process.exit(0);
}

// Bersihkan format (hapus 'v' jika ada, misal v1.1.2 -> 1.1.2)
targetVersion = targetVersion.replace(/^v/i, '').trim();

if (!/^\d+\.\d+\.\d+$/.test(targetVersion)) {
  console.error(`❌ Format versi tidak valid: "${targetVersion}". Gunakan format semver X.Y.Z (contoh: 1.1.2)`);
  process.exit(1);
}

const displayVersion = `v${targetVersion}`;

console.log(`\n======================================================`);
console.log(`   🚀 SINKRONISASI VERSI 1 GERBANG: ${currentVersion} ➔ ${targetVersion}`);
console.log(`   Badge Display : ${displayVersion}`);
console.log(`   Tanggal Rilis : ${dateStr}`);
console.log(`======================================================\n`);

// 1. Update package.json
pkg.version = targetVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`✅ [1/6] package.json diupdate ke ${targetVersion}`);

// 2. Update src/utils/version.ts (Frontend Single Source of Truth)
const versionTsPath = path.join(rootDir, 'src', 'utils', 'version.ts');
const versionTsContent = `export const APP_VERSION = "${targetVersion}";\nexport const APP_DISPLAY_VERSION = "${displayVersion}";\n`;
fs.writeFileSync(versionTsPath, versionTsContent, 'utf8');
console.log(`✅ [2/6] src/utils/version.ts diupdate ke ${targetVersion} (${displayVersion})`);

// 3. Update android/app/build.gradle (versionName & versionCode)
const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  // Ambil versionCode saat ini dan naikkan +1
  const codeMatch = gradle.match(/versionCode\s+(\d+)/);
  let nextCode = 1;
  if (codeMatch && codeMatch[1]) {
    nextCode = parseInt(codeMatch[1], 10) + 1;
  }
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${nextCode}`);
  gradle = gradle.replace(/versionName\s+".*"/, `versionName "${targetVersion}"`);
  fs.writeFileSync(gradlePath, gradle, 'utf8');
  console.log(`✅ [3/6] android/app/build.gradle diupdate (versionName: ${targetVersion}, versionCode: ${nextCode})`);
}

// 4. Update public/version.json & offline_package/version.json
const versionPayload = {
  version: targetVersion,
  release_date: dateStr,
  timestamp: now.toISOString(),
  notes: notes
};
const versionJsonStr = JSON.stringify(versionPayload, null, 2) + '\n';

const publicVersionPath = path.join(rootDir, 'public', 'version.json');
fs.writeFileSync(publicVersionPath, versionJsonStr, 'utf8');

const offlineVersionPath = path.join(rootDir, 'offline_package', 'version.json');
if (fs.existsSync(path.dirname(offlineVersionPath))) {
  fs.writeFileSync(offlineVersionPath, versionJsonStr, 'utf8');
}
console.log(`✅ [4/6] public/version.json & offline_package/version.json diupdate`);

// 5. Update PocketBase offline_update.pb.js fallback versions
const hookFiles = [
  path.join(rootDir, 'pb_hooks', 'offline_update.pb.js'),
  path.join(rootDir, 'vps', 'template_school', 'pb_hooks', 'offline_update.pb.js'),
  path.join(rootDir, 'offline_package', 'pb_hooks', 'offline_update.pb.js')
];

hookFiles.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/let\s+currentVersion\s*=\s*"[^"]*";/, `let currentVersion = "${targetVersion}";`);
    fs.writeFileSync(file, content, 'utf8');
  }
});
console.log(`✅ [5/6] Seluruh hook offline_update.pb.js diupdate`);

// 6. Update scripts/release-all.js default version & notes
const releaseScriptPath = path.join(rootDir, 'scripts', 'release-all.js');
if (fs.existsSync(releaseScriptPath)) {
  let releaseScript = fs.readFileSync(releaseScriptPath, 'utf8');
  releaseScript = releaseScript.replace(/version:\s*pkg\.version\s*\|\|\s*'[^']*'/, `version: pkg.version || '${targetVersion}'`);
  fs.writeFileSync(releaseScriptPath, releaseScript, 'utf8');
  console.log(`✅ [6/6] scripts/release-all.js diupdate`);
}

console.log(`\n======================================================`);
console.log(`   🎉 SELURUH GERBANG VERSI BERHASIL DISINKRONKAN!`);
console.log(`   Untuk merilis ke VPS Master & APK sekarang, jalankan:`);
console.log(`   👉 npm run release:all     (Rilis Lengkap + APK)`);
console.log(`   👉 npm run release:quick   (Rilis Cepat Web + Offline)`);
console.log(`======================================================\n`);
