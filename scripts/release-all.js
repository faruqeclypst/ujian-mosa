import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const VPS_HOST = 'root@64.235.41.108';
const VPS_DIST = '/opt/frontend/ujian/dist';
const VPS_DOWNLOADS = '/opt/frontend/ujian/dist/downloads';
const REMOTE_TEMPLATE = '/opt/pocketbase/schools/template';

const args = process.argv.slice(2);
const skipApk = args.includes('--skip-apk') || args.includes('--quick');
const buildBothApks = args.includes('--both-apks');

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
  // ── [1/6] BUILD WEB FRONTEND ──
  console.log('📦 [1/6] Membangun bundle web frontend (npm run build)...');
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
    execSync('powershell -Command "Copy-Item pb_hooks/* vps/template_school/pb_hooks/ -Recurse -Force"', { stdio: 'inherit' });
  }
  execSync(`scp -r vps/template_school/pb_hooks/* ${VPS_HOST}:${REMOTE_TEMPLATE}/pb_hooks/`, { stdio: 'inherit' });
  execSync(`scp vps/template_school/pb_data/data.db ${VPS_HOST}:${REMOTE_TEMPLATE}/pb_data/data.db`, { stdio: 'inherit' });
  execSync(`ssh ${VPS_HOST} "chown -R ubuntu:ubuntu ${REMOTE_TEMPLATE} && rsync -avz --delete ${REMOTE_TEMPLATE}/ root@43.134.175.87:${REMOTE_TEMPLATE}/ && ssh root@43.134.175.87 'chown -R ubuntu:ubuntu ${REMOTE_TEMPLATE}'"`, { stdio: 'inherit' });
  console.log('✅ Template di Master VPS dan Worker Node sudah 100% mutakhir!');

  // ── [4/6] 1-CLICK SYNC KE SELURUH TENANT SEKOLAH AKTIF ──
  console.log('\n🔄 [4/6] Menjalankan 1-Click Sync ke seluruh tenant sekolah aktif...');
  execSync(`ssh ${VPS_HOST} "/usr/local/bin/sync-all-tenants.sh"`, { stdio: 'inherit' });
  console.log('✅ Seluruh tenant sekolah aktif di Master & Worker VPS berhasil disinkronkan!');

  // ── [5/6] PAKET & PUBLIKASIKAN OFFLINE UPDATE (1-CLICK UPDATE) ──
  console.log('\n💾 [5/6] Mengemas dan merilis berkas Offline 1-Click Update...');
  
  // Sinkronkan dist ke offline_package/pb_public lokal
  const offlinePublicDir = path.join(process.cwd(), 'offline_package', 'pb_public');
  if (fs.existsSync(offlinePublicDir)) {
    execSync(`powershell -Command "Copy-Item dist/* offline_package/pb_public/ -Recurse -Force"`, { stdio: 'inherit' });
    // Hapus APK besar dari pb_public offline agar zip tetap ringan
    const publicFiles = fs.readdirSync(offlinePublicDir);
    for (const f of publicFiles) {
      if (f.endsWith('.apk')) {
        try { fs.unlinkSync(path.join(offlinePublicDir, f)); } catch {}
      }
    }
  }

  // Tulis version.json
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const versionData = {
    version: pkg.version || '2.5.5',
    release_date: dateStr,
    timestamp: now.toISOString(),
    notes: 'Pembaruan otomatis sistem CBT, perbaikan rotasi token, dan optimasi UI responsif.'
  };
  fs.writeFileSync('version.json', JSON.stringify(versionData, null, 2), 'utf-8');

  // Siapkan folder staging untuk offline-update.zip
  const stagingDir = path.join(process.cwd(), '.temp_offline_update');
  if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  execSync(`powershell -Command "Copy-Item offline_package/pb_public ${stagingDir}/pb_public -Recurse -Force"`, { stdio: 'inherit' });
  execSync(`powershell -Command "Copy-Item offline_package/pb_hooks ${stagingDir}/pb_hooks -Recurse -Force"`, { stdio: 'inherit' });
  execSync(`powershell -Command "Copy-Item version.json ${stagingDir}/version.json -Force"`, { stdio: 'inherit' });
  if (fs.existsSync('offline_package/perbarui-server.bat')) {
    execSync(`powershell -Command "Copy-Item offline_package/perbarui-server.bat ${stagingDir}/perbarui-server.bat -Force"`, { stdio: 'inherit' });
  }

  // Kompres ke offline-update.zip
  const updateZipName = 'offline-update.zip';
  if (fs.existsSync(updateZipName)) fs.unlinkSync(updateZipName);
  execSync(`powershell -Command "Compress-Archive -Path '${stagingDir}/*' -DestinationPath '${updateZipName}' -Force"`, { stdio: 'inherit' });
  fs.rmSync(stagingDir, { recursive: true, force: true });

  // Kirim ke Master VPS /opt/frontend/ujian/dist/downloads/
  execSync(`ssh ${VPS_HOST} "mkdir -p ${VPS_DOWNLOADS} && chown -R caddy:caddy ${VPS_DOWNLOADS}"`, { stdio: 'inherit' });
  execSync(`scp ${updateZipName} ${VPS_HOST}:${VPS_DOWNLOADS}/${updateZipName}`, { stdio: 'inherit' });
  execSync(`scp version.json ${VPS_HOST}:${VPS_DOWNLOADS}/version.json`, { stdio: 'inherit' });
  execSync(`ssh ${VPS_HOST} "chmod 644 ${VPS_DOWNLOADS}/${updateZipName} ${VPS_DOWNLOADS}/version.json && chown -R caddy:caddy ${VPS_DOWNLOADS}"`, { stdio: 'inherit' });
  
  if (fs.existsSync(updateZipName)) fs.unlinkSync(updateZipName);
  if (fs.existsSync('version.json')) fs.unlinkSync('version.json');

  // Sinkronkan juga ke folder test offline lokal jika ada (misal Music)
  const musicOfflineDir = 'C:\\Users\\Admin\\Music\\exam aa sd\\offline_package';
  if (fs.existsSync(musicOfflineDir)) {
    try {
      execSync(`powershell -Command "Copy-Item offline_package/pb_hooks/* '${musicOfflineDir}\\pb_hooks\\' -Recurse -Force"`, { stdio: 'ignore' });
      execSync(`powershell -Command "Copy-Item offline_package/pb_public/* '${musicOfflineDir}\\pb_public\\' -Recurse -Force"`, { stdio: 'ignore' });
      console.log('✅ Sinkronisasi otomatis ke folder pengujian offline lokal berhasil!');
    } catch {}
  }
  console.log('✅ Berkas Offline 1-Click Update berhasil dipublikasikan di CDN Examku!');

  // ── [6/6] BUILD & DEPLOY APK (OPTIONAL / DEFAULT) ──
  if (skipApk) {
    console.log('\n⏩ [6/6] Dilewati: Build APK dilewati (--skip-apk / --quick).');
  } else {
    console.log('\n📱 [6/6] Membangun dan merilis APK Android...');
    if (buildBothApks) {
      execSync('node scripts/deploy-both-apks.js', { stdio: 'inherit' });
    } else {
      execSync('node scripts/deploy-apk.js', { stdio: 'inherit' });
    }
    console.log('✅ APK Android berhasil di-build dan di-deploy ke server!');
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
