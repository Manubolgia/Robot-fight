// Round-robin of every archetype against every other, AI driving both sides,
// to check that no strategy dominates.
//   node tools/balance.ts [tier] [fightsPerPair] [arenas,comma,separated]
// (arenas default to those of the tier's events)
import { archetypesFor, makeBuild } from '../src/career/builds.ts';
import { arenaOf } from '../src/data/arenas.ts';
import { arenasOfTier } from '../src/data/events.ts';
import { Driver } from '../src/sim/ai.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { computeStats } from '../src/sim/stats.ts';
import { World, DT } from '../src/sim/world.ts';

const tier = Number(process.argv[2] ?? 3);
const N = Number(process.argv[3] ?? 8);
const arenas = process.argv[4] ? process.argv[4].split(',') : arenasOfTier(tier);
const only = process.argv[5]?.split(',');
const archs = archetypesFor(tier).filter((a) => !only || only.includes(a.id));

const wins: Record<string, Record<string, number>> = {};
const games: Record<string, Record<string, number>> = {};
const methods: Record<string, number> = {};
const diag: Record<string, { dealt: number; taken: number; n: number; wonBy: Record<string, number>; lostBy: Record<string, number> }> = {};
let totalTime = 0;
let fights = 0;
const t0 = performance.now();
for (const A of archs) {
  wins[A.id] = {};
  games[A.id] = {};
  diag[A.id] = { dealt: 0, taken: 0, n: 0, wonBy: {}, lostBy: {} };
}
for (let i = 0; i < archs.length; i++) {
  for (let j = i + 1; j < archs.length; j++) {
    const A = archs[i];
    const B = archs[j];
    for (let k = 0; k < N; k++) {
      const seed = 1000 + k * 31 + i * 7 + j * 13;
      const rng = mulberry32(seed);
      const da = makeBuild(A, tier, rng, { name: A.id, quality: 0.9 });
      const db = makeBuild(B, tier, rng, { name: B.id, quality: 0.9 });
      const swap = k % 2 === 1;
      const arena = arenaOf(arenas[k % arenas.length]);
      const w = new World(computeStats(swap ? db : da), computeStats(swap ? da : db), arena, { seed });
      w.quiet = true;
      const drivers = [new Driver(w, 0, seed), new Driver(w, 1, seed + 5)];
      let n = 0;
      while (!w.over && n < 12000) {
        drivers[0].update(DT);
        drivers[1].update(DT);
        w.step();
        n++;
      }
      const r = w.result!;
      fights++;
      totalTime += r.time;
      methods[r.method] = (methods[r.method] ?? 0) + 1;
      const aWon = r.winner === null ? 0.5 : (r.winner === 0) !== swap ? 1 : 0;
      const ia = swap ? 1 : 0;
      for (const [id, k] of [[A.id, ia], [B.id, 1 - ia]] as const) {
        diag[id].dealt += r.stats[k].dmgDealt;
        diag[id].taken += r.stats[k].dmgTaken;
        diag[id].n++;
      }
      if (r.winner !== null) {
        const wid = r.winner === ia ? A.id : B.id;
        const lid = wid === A.id ? B.id : A.id;
        diag[wid].wonBy[r.method] = (diag[wid].wonBy[r.method] ?? 0) + 1;
        diag[lid].lostBy[r.method] = (diag[lid].lostBy[r.method] ?? 0) + 1;
      }
      wins[A.id][B.id] = (wins[A.id][B.id] ?? 0) + aWon;
      wins[B.id][A.id] = (wins[B.id][A.id] ?? 0) + (1 - aWon);
      games[A.id][B.id] = (games[A.id][B.id] ?? 0) + 1;
      games[B.id][A.id] = (games[B.id][A.id] ?? 0) + 1;
    }
  }
}
const pad = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, n);
console.log(`tier ${tier}, ${fights} fights in ${((performance.now() - t0) / 1000).toFixed(1)}s, mean length ${(totalTime / fights).toFixed(1)}s`, methods);
console.log(pad('', 12) + archs.map((a) => pad(a.id.slice(0, 5), 6)).join('') + ' total');
const totals: Array<[string, number]> = [];
for (const A of archs) {
  let w = 0;
  let g = 0;
  const row = archs.map((B) => {
    if (A === B) return pad(' --', 6);
    w += wins[A.id][B.id];
    g += games[A.id][B.id];
    return pad(String(Math.round((wins[A.id][B.id] / games[A.id][B.id]) * 100)), 6);
  });
  totals.push([A.id, w / g]);
  console.log(pad(A.id, 12) + row.join('') + ' ' + Math.round((w / g) * 100) + '%');
}

console.log('');
for (const A of archs) {
  const d = diag[A.id];
  console.log(pad(A.id, 12), 'dealt', (d.dealt / d.n).toFixed(0).padStart(4), 'taken', (d.taken / d.n).toFixed(0).padStart(4), ' won', JSON.stringify(d.wonBy), ' lost', JSON.stringify(d.lostBy));
}
