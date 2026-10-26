import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { INFRA, VPS_HOST, WORKER_HOST } from './infra-config.js';

// IP terpusat di vps/infra.conf — jangan hardcode di sini.
const VPS_DIST = '/opt/frontend/ujian/dist';
const VPS_DOWNLOADS = '/opt/frontend/ujian/dist/downloads';
const REMOTE_TEMPLATE = '/opt/pocketbase/schools/template';

const args = process.argv.slice(2);
const skipApk = args.includes('--skip-apk') || args.includes('--quick');
const buildBothApks = !args.includes('--single-apk');

const now = new Date();
const dd = String(now.getDate()).padStart(2, '0');
const mm = String(now.getMonth() + 1).padStart(2, '0');
const yyyy = now.getFullYear();
const dateStr = `${dd}-${mm}-${yyyy}`;
const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

console.log('\n================================================================');
console.log('       🚀 EXAMKU CBT - ALL-IN-ONE MASTER RELEASE PIPELINE       ');
console.log(`       Tanggal : ${dateStr} ${timeStr}`);
console.log(`       Mode    : ${skipApk ? 'Web + Hooks + Offline Update (Tanpa APK)' : 'Lengkap (Web + Hooks + Offline + APK)'}`);
console.log('================================================================\n');

try {
  // ── [0/6] BUILD GO BINARY DI MAIN VPS (jika source berubah) ──
  console.log('🔨 [0/6] Mengecek binary Go-native PocketBase...');
  let justBuiltGo = false;
  try {
    const goSrc = 'pb-native/main.go';
    let needBuild = false;
    let localHash = '';
    if (fs.existsSync(goSrc)) {
      // Bandingkan hash source lokal vs hash build terakhir di Main VPS
      localHash = execSync('powershell -Command "(Get-FileHash pb-native/main.go -Algorithm SHA256).Hash"', { encoding: 'utf-8' }).trim();
      let remoteHash = '';
      try {
        remoteHash = execSync(`ssh ${VPS_HOST} "cat ${REMOTE_TEMPLATE}/.go_src_hash 2>/dev/null || echo none"`, { encoding: 'utf-8' }).trim();
      } catch { }
      if (localHash !== remoteHash) {
        console.log('   Source berubah, akan build di Main VPS...');
        needBuild = true;
      } else {
        console.log('   Binary sudah up-to-date, skip build.');
      }
    }
    if (needBuild) {
      console.log('   Install Go di Main VPS jika belum ada...');
      execSync(`ssh ${VPS_HOST} "test -x /usr/local/go/bin/go || (cd /tmp && wget -q https://go.dev/dl/go1.25.1.linux-amd64.tar.gz && tar -C /usr/local -xzf go1.25.1.linux-amd64.tar.gz && /usr/local/go/bin/go version)"`, { stdio: 'inherit' });
      console.log('   Sync source ke Main VPS & build (bisa 1-2 menit)...');
      execSync(`ssh ${VPS_HOST} "rm -rf /tmp/pb-native-build && mkdir -p /tmp/pb-native-build"`, { stdio: 'inherit' });
      execSync(`scp -r pb-native/* ${VPS_HOST}:/tmp/pb-native-build/`, { stdio: 'inherit' });
      execSync(`ssh ${VPS_HOST} "cd /tmp/pb-native-build && /usr/local/go/bin/go build -o ${REMOTE_TEMPLATE}/pocketbase -ldflags='-s -w' . && chmod +x ${REMOTE_TEMPLATE}/pocketbase"`, { stdio: 'inherit' });
      // Simpan hash source yang sudah di-build
      execSync(`ssh ${VPS_HOST} "echo '${localHash}' > ${REMOTE_TEMPLATE}/.go_src_hash"`, { stdio: 'inherit' });
      console.log('✅ Go binary berhasil di-build di Main VPS!');
      justBuiltGo = true;
    }
  } catch (goErr) {
    console.log('⚠️  Go build gagal/dilewati:', goErr.message.split('\n')[0]);
    console.log('   Lanjut tanpa rebuild binary (pakai yang ada di template).');
  }

  // ── [1/6] BUILD WEB FRONTEND ──
  console.log('\n📦 [1/6] Membangun bundle web frontend (npm run build)...');
  execSync('npm run build', { stdio: 'inherit' });

  // ── [2/6] DEPLOY WEB KE MASTER VPS ──
  console.log('\n🌐 [2/6] Mengirim dan mengekstrak bundle web ke Master VPS...');
  if (fs.existsSync('dist.tar.gz')) fs.unlinkSync('dist.tar.gz');
  execSync('tar -czf dist.tar.gz -C dist .', { stdio: 'inherit' });
  execSync(`scp dist.tar.gz ${VPS_HOST}:/opt/frontend/ujian/`, { stdio: 'inherit' });
  execSync(`ssh ${VPS_HOST} "tar -xzf /opt/frontend/ujian/dist.tar.gz -C ${VPS_DIST}/ && rm -f /opt/frontend/ujian/dist.tar.gz && chmod -R 755 ${VPS_DIST} && chown -R caddy:caddy ${VPS_DIST}"`, { stdio: 'inherit' });
  if (fs.existsSync('dist.tar.gz')) fs.unlinkSync('dist.tar.gz');
  console.log('✅ Web frontend berhasil diperbarui di Master VPS!');

  // ── [3/6] PUSH TEMPLATE & HOOKS KE MASTER & WORKER VPS ──
  console.log('\n⚙️ [3/6] Mengirim pb_hooks & template ke Master & Worker VPS...');
  // Sinkronkan pb_hooks root ke template lokal
  if (fs.existsSync('pb_hooks') && fs.existsSync('vps/template_school/pb_hooks')) {
    execSync('powershell -Command "Copy-Item pb_hooks/* vps/template_school/pb_hooks/ -Recurse -Force; Remove-Item vps/template_school/pb_hooks/_removed_go_native -Recurse -Force -ErrorAction SilentlyContinue"', { stdio: 'inherit' });
  }
  execSync(`scp -r vps/template_school/pb_hooks/* ${VPS_HOST}:${REMOTE_TEMPLATE}/pb_hooks/`, { stdio: 'inherit' });
  execSync(`scp vps/template_school/pb_data/data.db ${VPS_HOST}:${REMOTE_TEMPLATE}/pb_data/data.db`, { stdio: 'inherit' });
  // Binary Go-native: dari repo lokal jika ada, atau hanya download jika belum ada di Master VPS
  // NOTE: jika baru build di [0/6], binary sudah ada di Master — jangan overwrite dari Worker!
  if (fs.existsSync('vps/template_school/pocketbase')) {
    execSync(`scp vps/template_school/pocketbase ${VPS_HOST}:${REMOTE_TEMPLATE}/pocketbase`, { stdio: 'inherit' });
  } else if (typeof justBuiltGo !== 'undefined' && justBuiltGo) {
    console.log('  ✅ Binary baru sudah di-build di [0/6], lewati download dari Worker.');
  } else {
    // Lewati jika binary di Master VPS sudah ada dan ukurannya valid (>25MB, binary strip ~32MB)
    let needCopy = true;
    try {
      const remoteSize = parseInt(execSync(`ssh -o ConnectTimeout=5 ${VPS_HOST} "test -f ${REMOTE_TEMPLATE}/pocketbase && stat -c%s ${REMOTE_TEMPLATE}/pocketbase"`, { encoding: 'utf-8' }).trim());
      if (remoteSize > 25000000) {
        needCopy = false;
      }
    } catch { }
    if (needCopy) {
      console.log('  ⬇️ Mengunduh binary pocketbase Linux dari Worker VPS ke Master VPS...');
      execSync(`ssh ${VPS_HOST} "scp -o StrictHostKeyChecking=no ${WORKER_HOST}:/opt/pocketbase/schools/template/pocketbase ${REMOTE_TEMPLATE}/pocketbase"`, { stdio: 'inherit' });
    }
  }
  execSync(`ssh ${VPS_HOST} "chmod +x ${REMOTE_TEMPLATE}/pocketbase"`, { stdio: 'inherit' });
  // Hapus fast_login.pb.js dari template (diganti Go native)
  execSync(`ssh ${VPS_HOST} "rm -f ${REMOTE_TEMPLATE}/pb_hooks/fast_login.pb.js"`, { stdio: 'inherit' });
  // Sinkronkan infra.conf ke Master & Worker (untuk shell scripts di VPS)
  execSync(`scp vps/infra.conf ${VPS_HOST}:/opt/pocketbase/infra.conf`, { stdio: 'inherit' });
  execSync(`ssh ${VPS_HOST} "sed -i 's/\\r$//' /opt/pocketbase/infra.conf"`, { stdio: 'inherit' });
  execSync(`ssh ${VPS_HOST} "chown -R ubuntu:ubuntu ${REMOTE_TEMPLATE} && rsync -avz --delete ${REMOTE_TEMPLATE}/ ${WORKER_HOST}:${REMOTE_TEMPLATE}/ && ssh ${WORKER_HOST} 'chown -R ubuntu:ubuntu ${REMOTE_TEMPLATE}'"`, { stdio: 'inherit' });
  execSync(`ssh ${VPS_HOST} "scp -o StrictHostKeyChecking=no /opt/pocketbase/infra.conf ${WORKER_HOST}:/opt/pocketbase/infra.conf && ssh -o BatchMode=yes -o StrictHostKeyChecking=no ${WORKER_HOST} 'sed -i \"s/\\r$//\" /opt/pocketbase/infra.conf 2>/dev/null || true'"`, { stdio: 'inherit' });
  console.log('✅ Template di Master VPS dan Worker Node sudah 100% mutakhir!');

  // ── [3b/6] UPDATE BINARY & RESTART SEMUA TENANT DI WORKER ──
  console.log('\n🔄 [3b/6] Update binary & restart semua tenant di Worker VPS...');
  try {
    // Ambil daftar tenant (direktori di /opt/pocketbase/schools, kecuali template)
    const tenants = execSync(`ssh ${VPS_HOST} "ssh -o BatchMode=yes -o StrictHostKeyChecking=no ${WORKER_HOST} 'ls /opt/pocketbase/schools/'"`, { encoding: 'utf-8' })
      .split('\n').map(s => s.trim()).filter(s => s && s !== 'template');
    console.log(`   Ditemukan ${tenants.length} tenant: ${tenants.join(', ')}`);
    for (const t of tenants) {
      console.log(`   → Update & restart pb-${t}...`);
      execSync(`ssh ${VPS_HOST} "ssh -o BatchMode=yes -o StrictHostKeyChecking=no ${WORKER_HOST} 'cp ${REMOTE_TEMPLATE}/pocketbase /opt/pocketbase/schools/${t}/pocketbase.new && chmod +x /opt/pocketbase/schools/${t}/pocketbase.new && mv /opt/pocketbase/schools/${t}/pocketbase.new /opt/pocketbase/schools/${t}/pocketbase && systemctl restart pb-${t}'"`, { stdio: 'inherit' });
    }
    console.log('✅ Semua tenant berhasil di-restart dengan binary baru!');
  } catch (e) {
    console.log('⚠️  Gagal update/restart tenant:', e.message.split('\n')[0]);
  }

  // Update sync-all-tenants.sh di Master VPS (pastikan versi terbaru)
  if (fs.existsSync('vps/sync-all-tenants.sh')) {
    execSync(`scp vps/sync-all-tenants.sh ${VPS_HOST}:/usr/local/bin/sync-all-tenants.sh`, { stdio: 'inherit' });
    execSync(`ssh ${VPS_HOST} "chmod +x /usr/local/bin/sync-all-tenants.sh && sed -i 's/\\r$//' /usr/local/bin/sync-all-tenants.sh"`, { stdio: 'inherit' });
  }
  if (fs.existsSync('vps/migrate-tenant.sh')) {
    execSync(`scp vps/migrate-tenant.sh ${VPS_HOST}:/usr/local/bin/migrate-tenant.sh`, { stdio: 'inherit' });
    execSync(`ssh ${VPS_HOST} "chmod +x /usr/local/bin/migrate-tenant.sh && sed -i 's/\\r$//' /usr/local/bin/migrate-tenant.sh"`, { stdio: 'inherit' });
  }
  if (fs.existsSync('vps/migrate-tenant-schema.py')) {
    execSync(`scp vps/migrate-tenant-schema.py ${VPS_HOST}:/usr/local/bin/migrate-tenant-schema.py`, { stdio: 'inherit' });
    execSync(`ssh ${VPS_HOST} "chmod +x /usr/local/bin/migrate-tenant-schema.py && sed -i 's/\\r$//' /usr/local/bin/migrate-tenant-schema.py"`, { stdio: 'inherit' });
    execSync(`ssh ${VPS_HOST} "scp -o StrictHostKeyChecking=no /usr/local/bin/migrate-tenant-schema.py ${WORKER_HOST}:/usr/local/bin/migrate-tenant-schema.py 2>/dev/null || true"`, { stdio: 'inherit' });
  }

  // ── [4/6] 1-CLICK SYNC KE SELURUH TENANT SEKOLAH AKTIF ──
  console.log('\n🔄 [4/6] Menjalankan 1-Click Sync ke seluruh tenant sekolah aktif...');
  execSync(`ssh ${VPS_HOST} "/usr/local/bin/sync-all-tenants.sh"`, { stdio: 'inherit' });
  console.log('✅ Seluruh tenant sekolah aktif di Master & Worker VPS berhasil disinkronkan!');

  // ── [5/6] PAKET & PUBLIKASIKAN OFFLINE UPDATE (1-CLICK UPDATE) ──
  console.log('\n💾 [5/6] Mengemas dan merilis berkas Offline 1-Click Update...');

  // 1. Sinkronkan langsung dist terbaru & pb_hooks ke offline_package lokal
  console.log('  📂 Menyinkronkan dist & pb_hooks ke folder offline_package lokal...');
  if (!fs.existsSync('offline_package/pb_public')) fs.mkdirSync('offline_package/pb_public', { recursive: true });
  execSync('powershell -Command "Copy-Item dist/* offline_package/pb_public/ -Recurse -Force"', { stdio: 'inherit' });
  if (!fs.existsSync('offline_package/pb_hooks')) fs.mkdirSync('offline_package/pb_hooks', { recursive: true });
  execSync('powershell -Command "Copy-Item pb_hooks/* offline_package/pb_hooks/ -Recurse -Force; Remove-Item offline_package/pb_hooks/_removed_go_native -Recurse -Force -ErrorAction SilentlyContinue"', { stdio: 'inherit' });

  // 2. Bangun ulang database offline yang bersih (fresh clone dari template VPS)
  console.log('  🔄 Membangun ulang database offline dari template VPS...');
  execSync('python scripts/prepare_offline_db.py', { stdio: 'inherit' });
  console.log('  ✅ Database offline package berhasil dibangun ulang dari template VPS.');

  // 3. Tulis version.json ke root, dist, dan offline_package
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const versionData = {
    version: pkg.version || '1.2.1',
    release_date: dateStr,
    timestamp: now.toISOString(),
    notes: `Rilis Resmi v${pkg.version || '1.1.19'}: Pembaruan terpadu seluruh sistem (Web, APK Android, Template VPS, dan Paket Offline).`
  };
  fs.writeFileSync('version.json', JSON.stringify(versionData, null, 2), 'utf-8');
  if (fs.existsSync('dist')) {
    fs.copyFileSync('version.json', 'dist/version.json');
  }
  fs.copyFileSync('version.json', 'offline_package/version.json');

  // Siapkan folder staging untuk offline-update.zip
  const stagingDir = path.join(process.cwd(), '.temp_offline_update');
  if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  execSync(`powershell -Command "Copy-Item dist ${stagingDir}/pb_public -Recurse -Force"`, { stdio: 'inherit' });
  // pb_hooks tanpa _removed_go_native (arsip hook yang diganti Go native)
  execSync(`powershell -Command "Copy-Item pb_hooks ${stagingDir}/pb_hooks_tmp -Recurse -Force; Remove-Item ${stagingDir}/pb_hooks_tmp/_removed_go_native -Recurse -Force -ErrorAction SilentlyContinue; Move-Item ${stagingDir}/pb_hooks_tmp ${stagingDir}/pb_hooks -Force"`, { stdio: 'inherit' });
  execSync(`powershell -Command "Copy-Item version.json ${stagingDir}/version.json -Force"`, { stdio: 'inherit' });
  // Binary PocketBase Windows untuk server offline sekolah (33.9MB, support --publicDir & JSVM)
  // Prioritaskan binary teruji dari offline_package lokal (identik dengan copy-paste offline_package)
  if (fs.existsSync('offline_package/pocketbase.exe')) {
    console.log('  📦 Menggunakan pocketbase.exe resmi dari offline_package (33.9MB)...');
    fs.copyFileSync('offline_package/pocketbase.exe', path.join(stagingDir, 'pocketbase.exe'));
  } else {
    const pbExeCache = path.join(process.cwd(), '.cache', 'pocketbase.exe');
    if (fs.existsSync(pbExeCache)) {
      fs.copyFileSync(pbExeCache, path.join(stagingDir, 'pocketbase.exe'));
    } else {
      execSync(`scp -o StrictHostKeyChecking=no ${VPS_HOST}:/opt/pocketbase/schools/template/pocketbase.exe ${stagingDir}/pocketbase.exe`, { stdio: 'inherit' });
    }
  }
  if (fs.existsSync('offline_package/perbarui-server.bat')) {
    execSync(`powershell -Command "Copy-Item offline_package/perbarui-server.bat ${stagingDir}/perbarui-server.bat -Force"`, { stdio: 'inherit' });
  }
  if (fs.existsSync('offline_package/jalankan-server.bat')) {
    execSync(`powershell -Command "Copy-Item offline_package/jalankan-server.bat ${stagingDir}/jalankan-server.bat -Force"`, { stdio: 'inherit' });
  }
  // Sertakan starter database template agar proktor/sekolah yang baru pertama kali memasang langsung siap pakai
  if (fs.existsSync('offline_package/pb_data/data.db')) {
    const templateDir = path.join(stagingDir, 'pb_data_template');
    if (!fs.existsSync(templateDir)) fs.mkdirSync(templateDir, { recursive: true });
    fs.copyFileSync('offline_package/pb_data/data.db', path.join(templateDir, 'data.db'));
  }

  // Kompres ke offline-update.zip (Gunakan tar.exe bawaan Windows — cepat & kompatibel dengan seluruh extractor)
  // CATATAN: JANGAN gunakan '.' sebagai target tar, karena bsdtar akan menambahkan prefix './' ke setiap file/folder
  // di dalam zip yang menyebabkan Windows Explorer / WinRAR menganggap zip corrupted / invalid (0 file).
  // Berikan daftar item teratas di stagingDir secara langsung agar struktur zip standar (tanpa prefix ./).
  const updateZipName = 'offline-update.zip';
  if (fs.existsSync(updateZipName)) fs.unlinkSync(updateZipName);
  const stagingItems = fs.readdirSync(stagingDir);
  try {
    execSync(`tar.exe -a -c -f "${updateZipName}" -C "${stagingDir}" ${stagingItems.map(f => `"${f}"`).join(' ')}`, { stdio: 'inherit' });
  } catch (tarErr) {
    console.warn('  ⚠️ tar.exe gagal, mencoba fallback PowerShell Compress-Archive...', tarErr.message);
    execSync(`powershell -Command "Compress-Archive -Path '${stagingDir}/*' -DestinationPath '${updateZipName}' -Force"`, { stdio: 'inherit' });
  }
  fs.rmSync(stagingDir, { recursive: true, force: true });

  // Kirim ke Master VPS /opt/frontend/ujian/dist/downloads/
  // (mkdir diulang sebelum tiap scp untuk cegah race condition)
  // Catatan: folder downloads ada di dalam dist yang di-wipe tiap deploy,
  // jadi harus dibuat ulang setiap kali setelah dist terekstrak.
  execSync(`ssh ${VPS_HOST} "mkdir -p ${VPS_DOWNLOADS} && chown caddy:caddy ${VPS_DOWNLOADS} && test -d ${VPS_DOWNLOADS}"`, { stdio: 'inherit' });
  execSync(`scp ${updateZipName} ${VPS_HOST}:${VPS_DOWNLOADS}/${updateZipName}`, { stdio: 'inherit' });
  execSync(`ssh ${VPS_HOST} "test -f ${VPS_DOWNLOADS}/${updateZipName} || (echo 'GAGAL: ${updateZipName} tidak terupload' && exit 1)"`, { stdio: 'inherit' });
  execSync(`scp version.json ${VPS_HOST}:${VPS_DOWNLOADS}/version.json`, { stdio: 'inherit' });
  execSync(`ssh ${VPS_HOST} "test -f ${VPS_DOWNLOADS}/version.json || (echo 'GAGAL: version.json tidak terupload' && exit 1)"`, { stdio: 'inherit' });
  execSync(`ssh ${VPS_HOST} "chmod 644 ${VPS_DOWNLOADS}/${updateZipName} ${VPS_DOWNLOADS}/version.json && chown -R caddy:caddy ${VPS_DOWNLOADS} && echo 'Downloads OK'"`, { stdio: 'inherit' });

  if (fs.existsSync(updateZipName)) fs.unlinkSync(updateZipName);
  if (fs.existsSync('version.json')) fs.unlinkSync('version.json');

  // Sinkronkan folder repo offline_package lokal agar selalu identik dengan rilis terbaru
  if (fs.existsSync('offline_package')) {
    try {
      execSync(`powershell -Command "Copy-Item pb_hooks/* offline_package/pb_hooks/ -Recurse -Force"`, { stdio: 'ignore' });
      execSync(`powershell -Command "Remove-Item offline_package/pb_hooks/fast_login.pb.js -Force -ErrorAction SilentlyContinue"`, { stdio: 'ignore' });
      execSync(`powershell -Command "Copy-Item dist/* offline_package/pb_public/ -Recurse -Force"`, { stdio: 'ignore' });
      console.log('✅ Sinkronisasi otomatis ke offline_package lokal berhasil!');
    } catch { }
  }
  console.log('✅ Berkas Offline 1-Click Update berhasil dipublikasikan di CDN Examku!');

  // ── [6/6] BUILD & DEPLOY APK (OPTIONAL / DEFAULT) ──
  let apkVersionCode = null;
  let apkVersionName = null;
  // Baca versionCode & versionName dari build.gradle untuk sync app_settings
  try {
    const gradleContent = fs.readFileSync('android/app/build.gradle', 'utf8');
    const codeMatch = gradleContent.match(/versionCode\s+(\d+)/);
    const nameMatch = gradleContent.match(/versionName\s+"([^"]+)"/);
    if (codeMatch) apkVersionCode = codeMatch[1];
    if (nameMatch) apkVersionName = nameMatch[1];
  } catch (e) { }

  if (skipApk) {
    console.log('\n⏩ [6/6] Dilewati: Build APK dilewati (--skip-apk / --quick).');
  } else {
    console.log('\n📱 [6/6] Membangun dan merilis APK Android...');
    if (buildBothApks) {
      execSync('node scripts/deploy-both-apks.js --skip-build', { stdio: 'inherit' });
    } else {
      execSync('node scripts/deploy-apk.js', { stdio: 'inherit' });
    }
    console.log('✅ APK Android berhasil di-build dan di-deploy ke server!');
  }

  // ── [7/7] SYNC VERSI APK KE APP_SETTINGS (FORCE UPDATE) ──
  // Update min_version_code & min_version_name di master agar
  // fitur force update di aplikasi Android berfungsi otomatis.
  // TIDAK mengubah is_force_update (tetap keputusan user via dashboard).
  if (apkVersionCode && apkVersionName) {
    console.log('\n🔄 [7/7] Menyinkronkan versi APK ke app_settings master...');
    try {
      execSync(`ssh ${VPS_HOST} "python3 /usr/local/bin/update-app-settings.py ${apkVersionCode} ${apkVersionName}"`, { stdio: 'inherit' });
      console.log('✅ app_settings master diupdate (force_update tidak diubah).');
    } catch (e) {
      console.log('⚠️ Gagal update app_settings (tidak fatal, bisa set manual via dashboard).');
    }
  }

  // ── PURGE CLOUDFLARE CACHE ──
  console.log('\n⚡ Membersihkan seluruh cache Cloudflare CDN...');
  execSync(`ssh ${VPS_HOST} "/root/purge_cache.sh"`, { stdio: 'inherit' });
  console.log('✅ Cache Cloudflare berhasil di-purge 100%!');

  console.log('\n================================================================');
  console.log('   🎉 SEMUA PROSES RELEASE SELESAI DENGAN SUKSES!              ');
  console.log('   1. Web Frontend     : https://examku.my.id');
  console.log('   2. Seluruh Tenant   : Berhasil disinkronkan');
  console.log('   3. Offline 1-Click  : https://examku.my.id/downloads/offline-update.zip');
  if (!skipApk) {
    console.log('   4. APK Terbaru      : https://examku.my.id/app-debug.apk');
  }
  console.log('================================================================\n');

} catch (error) {
  console.error('\n❌ Terjadi kesalahan pada proses release:', error.message);
  process.exit(1);
}
