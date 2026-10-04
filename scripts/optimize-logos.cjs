const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  console.log('🚀 Memulai optimasi logo dengan Puppeteer (Chromium Canvas)...');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Helper untuk render gambar ke canvas dan ekspor dataURL
  async function resizeImage(sourcePath, targetWidth, targetHeight, format = 'png', quality = 0.9) {
    const fileData = fs.readFileSync(sourcePath);
    const base64Data = fileData.toString('base64');
    const mime = sourcePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const dataUri = `data:${mime};base64,${base64Data}`;

    return await page.evaluate(async (uri, w, h, fmt, q) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          const mimeType = fmt === 'webp' ? 'image/webp' : 'image/png';
          resolve(canvas.toDataURL(mimeType, q));
        };
        img.onerror = reject;
        img.src = uri;
      });
    }, dataUri, targetWidth, targetHeight, format, quality);
  }

  function saveBase64(dataUrl, outputPath) {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buf = Buffer.from(base64, 'base64');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buf);
    console.log(`  ✓ Tersimpan: ${outputPath} (${(buf.length / 1024).toFixed(1)} KB)`);
  }

  const rawDir = path.join(__dirname, '..', 'assets-raw', 'logos');
  const publicDir = path.join(__dirname, '..', 'public');

  const blueIcon = path.join(rawDir, 'Ikon A Panah Biru Mengilap.png');
  const blueLogo = path.join(rawDir, 'Logo Glossy Examku CBT Biru.png');
  const greenIcon = path.join(rawDir, 'Ikon Examku CBT Browser.png');
  const greenLogo = path.join(rawDir, 'Logo Examku Hijau dengan Badge CBT Browser.png');

  console.log('\n📦 1. Mengoptimalkan Logo Web di public/...');

  // Blue Icon (Square) - 512x512
  const blue512Png = await resizeImage(blueIcon, 512, 512, 'png');
  saveBase64(blue512Png, path.join(publicDir, 'logo-exam-aa.png'));
  saveBase64(blue512Png, path.join(publicDir, 'logo-default.png'));

  const blue512Webp = await resizeImage(blueIcon, 512, 512, 'webp', 0.88);
  saveBase64(blue512Webp, path.join(publicDir, 'logo-exam-aa.webp'));
  saveBase64(blue512Webp, path.join(publicDir, 'logo-default.webp'));

  // Favicon & Small Icons - 192x192 & 64x64
  const blue192Png = await resizeImage(blueIcon, 192, 192, 'png');
  saveBase64(blue192Png, path.join(publicDir, 'logo.png'));
  saveBase64(blue192Png, path.join(publicDir, 'logo-192.png'));

  const blue64Png = await resizeImage(blueIcon, 64, 64, 'png');
  saveBase64(blue64Png, path.join(publicDir, 'favicon.png'));

  // Blue Horizontal Logo - 800x288
  const blueBannerPng = await resizeImage(blueLogo, 800, 288, 'png');
  saveBase64(blueBannerPng, path.join(publicDir, 'logo-examku-cbt.png'));

  const blueBannerWebp = await resizeImage(blueLogo, 800, 288, 'webp', 0.88);
  saveBase64(blueBannerWebp, path.join(publicDir, 'logo-examku-cbt.webp'));

  // Green Browser Icon - 512x512 & 192x192
  const green512Png = await resizeImage(greenIcon, 512, 512, 'png');
  saveBase64(green512Png, path.join(publicDir, 'icon-cbt-browser.png'));

  const green512Webp = await resizeImage(greenIcon, 512, 512, 'webp', 0.88);
  saveBase64(green512Webp, path.join(publicDir, 'icon-cbt-browser.webp'));

  // Green Horizontal Logo - 800x288
  const greenBannerPng = await resizeImage(greenLogo, 800, 288, 'png');
  saveBase64(greenBannerPng, path.join(publicDir, 'logo-cbt-browser.png'));

  const greenBannerWebp = await resizeImage(greenLogo, 800, 288, 'webp', 0.88);
  saveBase64(greenBannerWebp, path.join(publicDir, 'logo-cbt-browser.webp'));

  console.log('\n📱 2. Menyiapkan Aset Ikon Android (Mipmap WebP)...');
  const mipmaps = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];

  // Simpan preset ikon untuk EXAM AA (Blue) dan Browser (Green)
  const androidResDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  const presetsDir = path.join(__dirname, '..', 'configs', 'app-icons');

  for (const m of mipmaps) {
    // Generate Blue Icons (EXAM AA)
    const blueIconWebp = await resizeImage(blueIcon, m.size, m.size, 'webp', 0.9);
    saveBase64(blueIconWebp, path.join(presetsDir, 'examaa', m.dir, 'ic_launcher.webp'));
    saveBase64(blueIconWebp, path.join(presetsDir, 'examaa', m.dir, 'ic_launcher_round.webp'));
    saveBase64(blueIconWebp, path.join(presetsDir, 'examaa', m.dir, 'ic_launcher_foreground.webp'));

    // Terapkan langsung ke android res saat ini (default examaa)
    saveBase64(blueIconWebp, path.join(androidResDir, m.dir, 'ic_launcher.webp'));
    saveBase64(blueIconWebp, path.join(androidResDir, m.dir, 'ic_launcher_round.webp'));
    saveBase64(blueIconWebp, path.join(androidResDir, m.dir, 'ic_launcher_foreground.webp'));

    // Generate Green Icons (Browser)
    const greenIconWebp = await resizeImage(greenIcon, m.size, m.size, 'webp', 0.9);
    saveBase64(greenIconWebp, path.join(presetsDir, 'browser', m.dir, 'ic_launcher.webp'));
    saveBase64(greenIconWebp, path.join(presetsDir, 'browser', m.dir, 'ic_launcher_round.webp'));
    saveBase64(greenIconWebp, path.join(presetsDir, 'browser', m.dir, 'ic_launcher_foreground.webp'));
  }

  // Splash screen drawable (512x512 PNG)
  console.log('\n🎨 3. Menyiapkan Splash Screen Android...');
  const splashPng = await resizeImage(blueIcon, 512, 512, 'png');
  saveBase64(splashPng, path.join(androidResDir, 'drawable', 'splash.png'));
  saveBase64(splashPng, path.join(presetsDir, 'examaa', 'splash.png'));

  const splashGreenPng = await resizeImage(greenIcon, 512, 512, 'png');
  saveBase64(splashGreenPng, path.join(presetsDir, 'browser', 'splash.png'));

  // Hapus 6 file mentahan raksasa dari public/ agar tidak membengkakkan dist/
  console.log('\n🧹 4. Membersihkan file mentahan besar dari public/...');
  const rawNames = [
    'Ikon A Globe Hijau Neon.png',
    'Ikon A Panah Biru Mengilap.png',
    'Ikon Examku CBT Browser.png',
    'Logo Aplikasi EXAMKU CBT Berkilau(1).png',
    'Logo Examku Hijau dengan Badge CBT Browser.png',
    'Logo Glossy Examku CBT Biru.png',
    'test-512.png'
  ];
  for (const name of rawNames) {
    const fPath = path.join(publicDir, name);
    if (fs.existsSync(fPath)) {
      fs.unlinkSync(fPath);
      console.log(`  ✓ Dihapus dari public/: ${name} (Disimpan aman di assets-raw/logos/)`);
    }
  }

  await browser.close();
  console.log('\n✨ Selesai! Seluruh logo berhasil dioptimasi menjadi super ringan.');
}

main().catch(err => {
  console.error('Error saat optimasi logo:', err);
  process.exit(1);
});
