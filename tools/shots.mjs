// Drive the built app in headless Chromium at iPhone size and screenshot
// each screen. Used while developing; not part of the build.
//   node tools/shots.mjs [baseUrl]
import { chromium, devices } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
const shot = async (name, wait = 600) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/${name}.png` });
  console.log('shot', name);
};
const click = async (text) => {
  await page.getByText(text, { exact: false }).first().click();
};

await page.goto(base);
await shot('01-title', 2500);
await click('Start career');
await shot('02-newgame', 1500);
await click('Start career');
await shot('03-hub', 2500);
await page.locator('.tabbar .tab', { hasText: 'Garage' }).click();
await shot('04-garage', 2500);
await page.getByRole('button', { name: /Weapons/ }).first().click();
await shot('05-garage-weapons', 800);
await page.getByRole('button', { name: /Armour/ }).first().click();
await shot('06-garage-armor', 800);
await page.getByRole('button', { name: /Power/ }).first().click();
await shot('07-garage-power', 800);
await page.getByRole('button', { name: /Stats/ }).first().click();
await shot('08-garage-stats', 800);
await page.locator('.tabbar .tab', { hasText: 'Events' }).click();
await shot('09-events', 1200);
await page.getByText('Garage Rumble').first().click();
await shot('10-event-sheet', 1200);
await page.getByRole('button', { name: /Enter/ }).click();
await shot('11-tournament', 2500);
await click('Pit stop');
await shot('12-prefight', 2000);
await page.getByRole('button', { name: /Fight!/ }).click();
await shot('13-fight-intro', 1500);
await shot('14-fight-countdown', 2000);
// drive at the opponent a little
const box = await page.locator('.joy-zone').boundingBox();
if (box) {
  await page.mouse.move(box.x + 90, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 60, { steps: 5 });
}
await shot('15-fight-1', 3000);
await shot('16-fight-2', 3000);
if (box) await page.mouse.up();
await page.getByRole('button', { name: 'Autopilot' }).click();
await shot('17-fight-3', 6000);
await shot('18-fight-4', 8000);
console.log(errors.slice(0, 30).join('\n'));
await browser.close();
