// Dev helper: screenshot debug.html (a portrait of every part) from the dev server.
//   npx vite --port 5173 & node tools/partsheet.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 1600 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto(process.argv[2] ?? 'http://localhost:5173/debug.html');
await page.waitForFunction(() => document.title === 'ready', null, { timeout: 200000 });
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/parts.png', fullPage: true });
await browser.close();
console.log('done');
