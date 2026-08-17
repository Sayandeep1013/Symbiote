import { chromium } from 'playwright';

const URL = process.env.SCREENSHOT_URL || 'http://localhost:5173';

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 506 } });

const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

const t0 = Date.now();
await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
const loadMs = Date.now() - t0;

const fps = await page.evaluate(() => new Promise((resolve) => {
  let frames = 0;
  const start = performance.now();
  function tick() {
    frames++;
    const elapsed = performance.now() - start;
    if (elapsed < 3000) {
      requestAnimationFrame(tick);
    } else {
      resolve(frames / (elapsed / 1000));
    }
  }
  requestAnimationFrame(tick);
}));

console.log('Load time (goto->load event): ' + loadMs + 'ms');
console.log('Measured FPS (software renderer, 900x506): ' + fps.toFixed(1));
if (errors.length) {
  console.log('CONSOLE_ERRORS:');
  for (const e of errors) console.log(' - ' + e);
} else {
  console.log('No console errors.');
}

await browser.close();
