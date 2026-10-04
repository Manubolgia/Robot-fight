// Dev-only page: a portrait of every weapon, frame, drive and module.
import { CHASSIS, DRIVES, MODULES, WEAPONS } from './data/parts.ts';
import type { BotDesign } from './data/types.ts';
import { onThumbsReady, thumb } from './render/thumbs.ts';

const base: BotDesign = {
  id: 'x', name: 'x', chassis: 'ch_bulldog', drive: 'dr_quad', core: 'co_lead', front: null, top: null,
  armor: { material: 'ar_titanium', front: 2, sides: 2, rear: 1, top: 1 }, modules: [], brain: 'br_relay', power: { drive: 1, front: 1, top: 1, aux: 1, brain: 1 }, plan: { stance: 'balanced', approach: 'direct', hazards: true },
  paint: { primary: '#ff7a1a', secondary: '#1d3557', pattern: 'stripes' },
};
const items: Array<[string, BotDesign]> = [];
for (const w of WEAPONS) items.push([w.name, { ...base, front: w.mount === 'top' ? 'wp_plow' : w.id, top: w.mount === 'top' ? w.id : null }]);
for (const c of CHASSIS) items.push([c.name, { ...base, chassis: c.id, front: 'wp_drum' }]);
for (const d of DRIVES) items.push([d.name, { ...base, drive: d.id, front: 'wp_spikes' }]);
for (const m of MODULES) items.push([m.name, { ...base, modules: [m.id], front: 'wp_disc' }]);
for (const look of ['ar_alu', 'ar_steel', 'ar_uhmw', 'ar_titanium', 'ar_composite', 'ar_nano']) items.push([look, { ...base, armor: { ...base.armor, material: look, front: 4, sides: 4 } }]);

const root = document.getElementById('root')!;
function draw() {
  root.innerHTML = '';
  let pending = 0;
  for (const [name, d] of items) {
    const src = thumb(d, 'blue');
    if (!src) pending++;
    const el = document.createElement('div');
    el.className = 'c';
    el.innerHTML = `${src ? `<img src="${src}">` : '<div style="height:60px"></div>'}<div>${name}</div>`;
    root.appendChild(el);
  }
  document.title = pending ? `pending ${pending}` : 'ready';
}
onThumbsReady(draw);
draw();
