const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlPath = path.resolve(__dirname, 'index.html');
const scratchDir = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\39ae1804-2f60-4143-acaf-39830562b4a2\\scratch';

async function captureMoments() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1080,1920']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

  await page.evaluate(async () => {
    document.body.classList.add('render-mode');
    if (typeof fitStage === 'function') fitStage();
    if (document.fonts) await document.fonts.ready;
  });

  const moments = [
    { t: 1.5, name: 'scene1_intro.jpg' },
    { t: 6.2, name: 'scene2_login.jpg' },
    { t: 10.0, name: 'scene3_dashboard.jpg' },
    { t: 14.8, name: 'scene4_token.jpg' },
    { t: 19.2, name: 'scene5_exam.jpg' },
    { t: 24.0, name: 'scene6_violation.jpg' },
    { t: 27.5, name: 'scene7_locked.jpg' },
    { t: 30.5, name: 'scene8_navigator.jpg' },
    { t: 32.8, name: 'scene9_ragu_warning.jpg' },
    { t: 37.5, name: 'scene10_success.jpg' },
    { t: 43.0, name: 'scene11_outro.jpg' }
  ];

  for (const m of moments) {
    await page.evaluate((t) => window.seek(t), m.t);
    const dest = path.join(scratchDir, m.name);
    await page.screenshot({ path: dest, quality: 90, type: 'jpeg' });
    console.log(`Saved moment t=${m.t}s -> ${m.name}`);
  }

  await browser.close();
  console.log('All snapshots captured successfully!');
}

captureMoments().catch(console.error);
