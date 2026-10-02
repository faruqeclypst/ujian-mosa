const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');

async function renderPromoVideo() {
  const startTime = Date.now();
  console.log('=== MEMULAI RENDER VIDEO PROMOSI EXAM AA ===');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(chromePath)) {
    throw new Error('Chrome tidak ditemukan di: ' + chromePath);
  }

  const htmlPath = path.resolve(__dirname, 'index.html');
  const outputPath = path.resolve(__dirname, 'exam-aa-promo.mp4');

  console.log('1. Membuka Chrome Headless 1080x1920...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-setuid-sandbox',
      '--window-size=1080,1920',
      '--font-render-hinting=max'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 1080,
    height: 1920,
    deviceScaleFactor: 1
  });

  console.log('2. Memuat template HTML: ' + htmlPath);
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  // Tunggu web fonts selesai di-render dan aktifkan render-mode
  await page.evaluate(async () => {
    document.body.classList.add('render-mode');
    if (typeof fitStage === 'function') fitStage();
    if (document.fonts) {
      await document.fonts.ready;
    }
  });

  const duration = await page.evaluate(() => window.TOTAL_DURATION || 41);
  const FPS = 30;
  const totalFrames = Math.floor(duration * FPS);

  console.log(`3. Konfigurasi Video: 1080x1920, ${FPS} FPS, Durasi: ${duration}s (${totalFrames} frame)`);
  console.log('4. Memulai FFmpeg encoder...');

  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', String(FPS),
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '18',
    outputPath
  ]);

  ffmpeg.stderr.on('data', data => {
    // console.log(data.toString()); // Uncomment for debug if needed
  });

  console.log('5. Rendering frame demi frame...');
  let lastLogTime = Date.now();

  for (let f = 0; f < totalFrames; f++) {
    const time = f / FPS;
    
    // Set exact state at time
    await page.evaluate((t) => window.seek(t), time);

    // Capture frame buffer
    const buf = await page.screenshot({
      type: 'jpeg',
      quality: 92
    });

    ffmpeg.stdin.write(buf);

    if (f % 60 === 0 || f === totalFrames - 1) {
      const pct = ((f / totalFrames) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const fpsReal = (f / ((Date.now() - startTime) / 1000)).toFixed(1);
      console.log(`[Frame ${f}/${totalFrames}] (${pct}%) - Video Time: ${time.toFixed(1)}s / ${duration}s - Speed: ${fpsReal} fps (Elapsed: ${elapsed}s)`);
    }
  }

  ffmpeg.stdin.end();

  console.log('6. Menunggu FFmpeg menyelesaikan muxing...');
  await new Promise((resolve, reject) => {
    ffmpeg.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error('FFmpeg error with code ' + code));
    });
    ffmpeg.on('error', reject);
  });

  await browser.close();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('====================================================');
  console.log(`BERHASIL! Video selesai dirender dalam ${totalTime} detik.`);
  console.log(`File Output: ${outputPath}`);
  console.log(`Ukuran File: ${sizeMB} MB`);
  console.log('====================================================');
}

renderPromoVideo().catch(err => {
  console.error('RENDER GAGAL:', err);
  process.exit(1);
});
