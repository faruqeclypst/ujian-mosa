import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appKey = process.argv[2];

if (!appKey) {
  console.error('Silakan masukkan nama konfigurasi aplikasi. Contoh: node scripts/switch-app.js examaa atau browser');
  process.exit(1);
}

const configPath = path.join(__dirname, '..', 'configs', `${appKey}.json`);

if (!fs.existsSync(configPath)) {
  console.error(`File konfigurasi configs/${appKey}.json tidak ditemukan!`);
  process.exit(1);
}

const appConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log(`\n======================================================`);
console.log(`  Beralih Profil Aplikasi ke: ${appConfig.name}`);
console.log(`  Package ID : ${appConfig.id}`);
console.log(`  Web Dir    : ${appConfig.webDir || 'dist'}`);
console.log(`  Server URL : ${appConfig.serverUrl || '(Standalone Local Assets)'}`);
console.log(`======================================================\n`);

// 1. Update capacitor.config.ts
const capConfigPath = path.join(__dirname, '..', 'capacitor.config.ts');
let capConfig = fs.readFileSync(capConfigPath, 'utf8');

capConfig = capConfig.replace(/appId:\s*'.*'/, `appId: '${appConfig.id}'`);
capConfig = capConfig.replace(/appName:\s*'.*'/, `appName: '${appConfig.name}'`);

const targetWebDir = appConfig.webDir || 'dist';
capConfig = capConfig.replace(/webDir:\s*'.*'/, `webDir: '${targetWebDir}'`);

// Handle server.url
if (appConfig.serverUrl) {
  if (/url:\s*'.*'/.test(capConfig)) {
    capConfig = capConfig.replace(/url:\s*'.*'/, `url: '${appConfig.serverUrl}'`);
  } else {
    capConfig = capConfig.replace(/androidScheme:\s*'https',/, `androidScheme: 'https',\n    url: '${appConfig.serverUrl}',`);
  }
} else {
  // Standalone local mode: hapus setting url agar load local webDir
  capConfig = capConfig.replace(/\s*url:\s*'.*',?/g, '');
}

if (!/allowNavigation/.test(capConfig)) {
  capConfig = capConfig.replace(/cleartext:\s*true/g, `cleartext: true,\n    allowNavigation: ['*']`);
}

fs.writeFileSync(capConfigPath, capConfig);
console.log('✅ [1/3] capacitor.config.ts diperbarui.');

// 2. Update strings.xml (Nama & Identitas Aplikasi)
const stringsPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
let strings = fs.readFileSync(stringsPath, 'utf8');
strings = strings.replace(/<string name="app_name">.*<\/string>/, `<string name="app_name">${appConfig.name}</string>`);
strings = strings.replace(/<string name="title_activity_main">.*<\/string>/, `<string name="title_activity_main">${appConfig.name}</string>`);
strings = strings.replace(/<string name="package_name">.*<\/string>/, `<string name="package_name">${appConfig.id}</string>`);
strings = strings.replace(/<string name="custom_url_scheme">.*<\/string>/, `<string name="custom_url_scheme">${appConfig.id}</string>`);
fs.writeFileSync(stringsPath, strings);
console.log('✅ [2/3] android strings.xml diperbarui.');

// 3. Update build.gradle (Application ID)
const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/applicationId\s+".*"/, `applicationId "${appConfig.id}"`);
fs.writeFileSync(gradlePath, gradle);
console.log('✅ [3/3] android build.gradle diperbarui.');

// 4. Sinkronisasi Capacitor
console.log('\n🔄 Menjalankan npx cap sync android...');
execSync('npx cap sync android', { stdio: 'inherit' });
console.log(`\n🎉 Profil ${appConfig.name} aktif & siap di-build!\n`);
