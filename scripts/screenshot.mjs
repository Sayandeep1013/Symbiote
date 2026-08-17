import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const URL = process.env.SCREENSHOT_URL || 'http://localhost:5173';
const OUT = process.argv[2] || 'scratchpad/screenshot.png';
const MOUSE = process.argv[3]; // "x,y" optional, in CSS pixels
const WAIT_MS = Number(process.argv[4] || 1500);

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 506 } });

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });

  if (MOUSE) {
    const [x, y] = MOUSE.split(',').map(Number);
    await page.mouse.move(x, y, { steps: 10 });
  }

  await page.waitForTimeout(WAIT_MS);
  await page.screenshot({ path: OUT, timeout: 180000, animations: 'allow' });
  console.log('Saved: ' + OUT);
} catch (err) {
  console.log('SCRIPT_ERROR: ' + err.message);
} finally {
  if (errors.length) {
    console.log('CONSOLE_ERRORS:');
    for (const e of errors) console.log(' - ' + e);
  } else {
    console.log('No console errors.');
  }
  await browser.close();
}
