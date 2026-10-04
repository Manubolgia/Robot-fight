// How hits feel per archetype: hits per fight, average and top damage.
//   node tools/feel.ts [tier] [fights]
import { ARCHETYPES, makeBuild } from '../src/career/builds.ts';
import { arenaOf } from '../src/data/arenas.ts';
import { Driver } from '../src/sim/ai.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { computeStats } from '../src/sim/stats.ts';
import { DT, World } from '../src/sim/world.ts';

const tier = Number(process.argv[2] ?? 3);
const N = Number(process.argv[3] ?? 12);
for (const A of ARCHETYPES) {
  const dmgs: number[] = [];
  let fights = 0;
  let time = 0;
  for (let k = 0; k < N; k++) {
    const rng = mulberry32(500 + k * 17);
    const B = ARCHETYPES[(k * 5 + 3) % ARCHETYPES.length];
    const w = new World(computeStats(makeBuild(A, tier, rng, { quality: 0.9 })), computeStats(makeBuild(B, tier, rng, { quality: 0.9 })), arenaOf('garage'), { seed: k });
    const d = [new Driver(w, 0, k), new Driver(w, 1, k + 9)];
    while (!w.over) {
      d[0].update(DT);
      d[1].update(DT);
      w.step();
      for (const e of w.events) if (e.type === 'hit' && e.by === 0 && e.kind !== 'hazard' && e.kind !== 'land' && e.kind !== 'wall') dmgs.push(e.dmg);
      w.events.length = 0;
    }
    fights++;
    time += w.result!.time;
  }
  dmgs.sort((a, b) => b - a);
  const avg = dmgs.reduce((s, x) => s + x, 0) / Math.max(1, dmgs.length);
  console.log(`${A.id.padEnd(12)} hits/min ${((dmgs.length / time) * 60).toFixed(1).padStart(5)}  avg ${avg.toFixed(1).padStart(5)}  top10% ${(dmgs[Math.floor(dmgs.length * 0.1)] ?? 0).toFixed(0).padStart(4)}  max ${(dmgs[0] ?? 0).toFixed(0)}`);
}
