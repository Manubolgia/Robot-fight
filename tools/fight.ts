// Run one headless fight between two archetypes and print what happened.
//   node tools/fight.ts disc wedge 3 [seed] [arena]
import { ARCHETYPES, archetypeOf, makeBuild } from '../src/career/builds.ts';
import { arenaOf } from '../src/data/arenas.ts';
import { Driver } from '../src/sim/ai.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { computeStats, validate, designWeight, powerDraw } from '../src/sim/stats.ts';
import { World, DT } from '../src/sim/world.ts';

const [a = 'disc', b = 'wedge', tierS = '3', seedS = '1', arenaId = 'crucible'] = process.argv.slice(2);
const tier = Number(tierS);
const seed = Number(seedS);
const rng = mulberry32(seed);
const da = makeBuild(archetypeOf(a), tier, rng, { name: a });
const db = makeBuild(archetypeOf(b), tier, rng, { name: b });
for (const d of [da, db]) {
  console.log(d.name, JSON.stringify({ ch: d.chassis, dr: d.drive, co: d.core, f: d.front, t: d.top, ar: d.armor, mod: d.modules, p: d.power }));
  console.log('  kg', designWeight(d).toFixed(1), 'kW', powerDraw(d).toFixed(2), validate(d).map((i) => i.text).join('; '));
}
const w = new World(computeStats(da), computeStats(db), arenaOf(arenaId), { seed });
const drivers = [new Driver(w, 0, seed), new Driver(w, 1, seed + 1)];
let n = 0;
const counts: Record<string, number> = {};
while (!w.over && n < 200000) {
  for (const d of drivers) d.update(DT);
  w.step();
  for (const e of w.events) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    if (e.type === 'hit' && e.big) console.log(`${w.t.toFixed(1)}s  ${e.by >= 0 ? w.bots[e.by].s.name : 'hazard'} -> ${w.bots[e.to].s.name}: ${e.kind} ${e.dmg.toFixed(0)} @${e.zone}`);
    if (['flip', 'ko', 'pitfall', 'compdown', 'overheat', 'selfright', 'clash', 'armorbreak'].includes(e.type)) console.log(`${w.t.toFixed(1)}s  ${JSON.stringify(e)}`);
  }
  w.events.length = 0;
  n++;
}
console.log(counts);
const r = w.result!;
console.log('winner', r.winner === null ? 'draw' : w.bots[r.winner].s.name, r.method, r.time.toFixed(1), JSON.stringify(r.judges?.votes));
for (const bt of w.bots) console.log(bt.s.name, 'hp', bt.hp.toFixed(0), '/', bt.s.hpMax.toFixed(0), 'dealt', bt.dmgDealt.toFixed(0), 'aggr', bt.aggression.toFixed(1), 'ctrl', bt.control.toFixed(1), 'comp', JSON.stringify(Object.fromEntries(Object.entries(bt.comp).map(([k, v]) => [k, Math.round(v)]))));
void ARCHETYPES;
