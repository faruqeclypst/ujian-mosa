/**
 * Build Android App Bundle (.aab) untuk Google Play Store.
 *
 * Prasyarat:
 *   1. Keystore sudah dibuat (lihat KEYSTORE_GUIDE.md)
 *   2. android/keystore.properties sudah diisi
 *
 * Hasil: android/app/build/outputs/bundle/release/app-release.aab
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const KEYSTORE_PROPS = path.join(ROOT, "android", "keystore.properties");

console.log("\n================================================================");
console.log("   📦 EXAMKU — Build AAB untuk Google Play Store");
console.log("================================================================\n");

// 1. Cek keystore.properties
if (!fs.existsSync(KEYSTORE_PROPS)) {
  console.error("❌ android/keystore.properties tidak ditemukan!");
  console.error("   Lihat KEYSTORE_GUIDE.md untuk cara membuat keystore.\n");
  process.exit(1);
}

// 2. Cek file keystore fisik ada
const props = fs.readFileSync(KEYSTORE_PROPS, "utf8");
const storeFileMatch = props.match(/^storeFile=(.+)$/m);
if (storeFileMatch) {
  const storePath = path.resolve(path.join(ROOT, "android"), storeFileMatch[1].trim());
  if (!fs.existsSync(storePath)) {
    console.error(`❌ File keystore tidak ditemukan: ${storePath}`);
    console.error("   Periksa storeFile di keystore.properties.\n");
    process.exit(1);
  }
  console.log(`✅ Keystore ditemukan: ${path.basename(storePath)}`);
}

// 3. Build web
console.log("\n📦 [1/2] Membangun bundle web (npm run build)...");
execSync("npm run build", { stdio: "inherit", cwd: ROOT });

// 4. Sync Capacitor
console.log("\n🔄 [2/3] Sync Capacitor...");
execSync("npx cap sync android", { stdio: "inherit", cwd: ROOT });

// 5. Build AAB release
console.log("\n🤖 [3/3] Membangun AAB release (bundleRelease)...");
const gradlewCmd =
  process.platform === "win32"
    ? 'cmd.exe /c "cd android && gradlew.bat bundleRelease"'
    : "cd android && ./gradlew bundleRelease";
execSync(gradlewCmd, { stdio: "inherit", cwd: ROOT });

const aabPath = path.join(ROOT, "android", "app", "build", "outputs", "bundle", "release", "app-release.aab");
if (fs.existsSync(aabPath)) {
  const sizeMB = (fs.statSync(aabPath).size / 1024 / 1024).toFixed(1);
  console.log("\n================================================================");
  console.log(`   ✅ SUKSES! AAB siap upload ke Play Console`);
  console.log(`   📁 ${aabPath}`);
  console.log(`   📏 Ukuran: ${sizeMB} MB`);
  console.log("================================================================\n");
} else {
  console.error("\n❌ AAB tidak ditemukan setelah build. Cek log error di atas.\n");
  process.exit(1);
}
