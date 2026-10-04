// Play a whole Garage League event on autopilot at high speed, taking
// screenshots of every step: fight, results, bracket, prize, trophy room.
//   node tools/career-run.mjs [baseUrl]
import { chromium, devices } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
await page.addInitScript(() => localStorage.setItem('kilowatt.devSpeed', '10'));
let n = 0;
const shot = async (name, wait = 500) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/run-${String(++n).padStart(2, '0')}-${name}.png` });
  console.log('shot', name);
};
await page.goto(base);
await page.waitForTimeout(1500);
await page.getByText('Start career').first().click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Start career/ }).click();
await page.waitForTimeout(1000);
await page.locator('.tabbar .tab', { hasText: 'Events' }).click();
await page.getByText('Garage Rumble').first().click();
await page.getByRole('button', { name: /Enter/ }).click();
await page.waitForTimeout(1200);
for (let round = 0; round < 4; round++) {
  const pit = page.getByRole('button', { name: /Pit stop/ });
  if (!(await pit.count())) break;
  await pit.click();
  await shot(`r${round}-pit`, 1500);
  await page.getByRole('button', { name: /Fight!/ }).click();
  await shot(`r${round}-fight-a`, 3300);
  await shot(`r${round}-fight-b`, 2500);
  // wait for the results screen
  await page.getByText(/VICTORY|DEFEAT/).first().waitFor({ timeout: 180000 });
  await shot(`r${round}-results`, 1200);
  await page.getByRole('button', { name: /Continue|final standings/ }).click();
  await shot(`r${round}-tournament`, 1500);
}
const collect = page.getByRole('button', { name: /Collect/ });
if (await collect.count()) {
  await collect.click();
  await shot('after-collect', 1500);
  const ok = page.locator('.modal .btn').first();
  if (await ok.count()) {
    await ok.click();
    await shot('after-modal', 1200);
  }
}
await page.locator('.tabbar .tab', { hasText: 'Team' }).click();
await shot('team', 1500);
await page.locator('.tabbar .tab', { hasText: 'Shop' }).click();
await shot('shop', 1500);
console.log(errors.join('\n') || 'no errors');
await browser.close();
