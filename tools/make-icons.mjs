// Draw the app icons: a lightning bolt between two spinning discs on dark
// steel. Rendered with headless Chromium (Playwright) into public/icons/.
//   node tools/make-icons.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const svg = (maskable, square = maskable) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#26324a"/>
      <stop offset="0.55" stop-color="#121722"/>
      <stop offset="1" stop-color="#07090d"/>
    </radialGradient>
    <linearGradient id="bolt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff6c4"/>
      <stop offset="0.45" stop-color="#ffd23f"/>
      <stop offset="1" stop-color="#ff9500"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <pattern id="haz" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="24" height="48" fill="#ffc400"/><rect x="24" width="24" height="48" fill="#141414"/>
    </pattern>
  </defs>
  <rect width="512" height="512" rx="${square ? 0 : 112}" fill="url(#bg)"/>
  <g transform="${maskable ? 'translate(256 256) scale(0.78) translate(-256 -256)' : ''}">
    <circle cx="256" cy="262" r="176" fill="none" stroke="#2ee6ff" stroke-opacity="0.22" stroke-width="10"/>
    <circle cx="256" cy="262" r="176" fill="none" stroke="#2ee6ff" stroke-width="10" stroke-dasharray="70 40" stroke-linecap="round" filter="url(#glow)" opacity="0.9"/>
    <rect x="120" y="420" width="272" height="26" rx="8" fill="url(#haz)" opacity="0.9"/>
    <path d="M286 64 152 284h86l-24 164 146-232h-90l16-152Z" fill="url(#bolt)" stroke="#3a2600" stroke-width="10" stroke-linejoin="round" filter="url(#glow)"/>
  </g>
</svg>`;

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon.svg', svg(false));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage();
for (const [name, size, maskable, square] of [['icon-32.png', 32, false, false], ['icon-180.png', 180, false, true], ['icon-192.png', 192, false, false], ['icon-512.png', 512, false, false], ['icon-maskable-512.png', 512, true, true]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(maskable, square).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: !square, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log('icons written');
