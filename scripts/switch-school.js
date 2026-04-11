const fs = require('fs');
const path = require('path');

const schoolKey = process.argv[2];

if (!schoolKey) {
  console.error('Silakan masukkan nama config. Contoh: node scripts/switch-school.js mosa');
  process.exit(1);
}

const configPath = path.join(__dirname, '..', 'configs', `${schoolKey}.json`);

if (!fs.existsSync(configPath)) {
  console.error(`File konfigurasi configs/${schoolKey}.json tidak ditemukan!`);
  process.exit(1);
}

const school = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log(`--- MENGGANTI IDENTITAS APLIKASI KE: ${school.name} ---`);

// 1. Update capacitor.config.ts
const capConfigPath = path.join(__dirname, '..', 'capacitor.config.ts');
let capConfig = fs.readFileSync(capConfigPath, 'utf8');
capConfig = capConfig.replace(/appId: '.*'/, `appId: '${school.id}'`);
capConfig = capConfig.replace(/appName: '.*'/, `appName: '${school.name}'`);
capConfig = capConfig.replace(/url: '.*'/, `url: '${school.serverUrl}'`);
fs.writeFileSync(capConfigPath, capConfig);
console.log('✅ capacitor.config.ts diperbarui.');

// 2. Update strings.xml (Nama Aplikasi)
const stringsPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
let strings = fs.readFileSync(stringsPath, 'utf8');
strings = strings.replace(/<string name="app_name">.*<\/string>/, `<string name="app_name">${school.name}</string>`);
strings = strings.replace(/<string name="title_activity_main">.*<\/string>/, `<string name="title_activity_main">${school.name}</string>`);
strings = strings.replace(/<string name="package_name">.*<\/string>/, `<string name="package_name">${school.id}</string>`);
strings = strings.replace(/<string name="custom_url_scheme">.*<\/string>/, `<string name="custom_url_scheme">${school.id}</string>`);
fs.writeFileSync(stringsPath, strings);
console.log('✅ strings.xml diperbarui.');

// 3. Update build.gradle (Application ID & Namespace)
const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/namespace = ".*"/, `namespace = "${school.id}"`);
gradle = gradle.replace(/applicationId ".*"/, `applicationId "${school.id}"`);
fs.writeFileSync(gradlePath, gradle);
console.log('✅ build.gradle diperbarui.');

console.log(`\nSIAP! Sekarang jalankan: \nnpx cap sync\n`);
