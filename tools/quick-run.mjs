// Quick fight in a hazard arena on autopilot, screenshots along the way.
//   node tools/quick-run.mjs [baseUrl] [arenaName]
import { chromium, devices } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4173/';
const arena = process.argv[3] ?? 'World Arena';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
await page.addInitScript(() => localStorage.setItem('kilowatt.devSpeed', '3'));
await page.goto(base);
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /Quick fight/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: '5', exact: true }).click();
await page.getByRole('button', { name: 'Drum Brute' }).nth(1).click();
await page.getByText(arena, { exact: true }).click();
await page.screenshot({ path: 'shots/q-01-setup.png' });
await page.getByRole('button', { name: /Fight!/ }).click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Autopilot' }).click();
for (let i = 2; i <= 7; i++) {
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `shots/q-0${i}-fight.png` });
}
await page.getByText(/VICTORY|DEFEAT/).first().waitFor({ timeout: 240000 });
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/q-08-results.png' });
console.log(errors.join('\n') || 'no errors');
await browser.close();
