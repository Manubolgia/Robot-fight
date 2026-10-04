// Check the installed-app basics on the production build: the manifest, the
// service worker taking control, and a reload with the network off.
//   npm run build && npx vite preview --port 4173 & node tools/offline-check.mjs
import { chromium, devices } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
console.log('manifest', manifest.name, manifest.display, manifest.icons.length, 'icons');
await page.waitForFunction(() => navigator.serviceWorker?.controller || null, null, { timeout: 30000 }).catch(() => {});
await page.reload();
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
console.log('service worker in control');
await page.waitForTimeout(2000);
await ctx.setOffline(true);
await page.reload();
await page.getByText(/Start career|Continue career/).first().waitFor({ timeout: 15000 });
console.log('offline reload: title screen up');
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
