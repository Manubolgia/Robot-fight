// Trim each weapon until every strategy wins about half its fights, tier by
// tier. Each round plays a round-robin per tier (one worker per tier, the
// strategies that tier's parts can build), then nudges the trim of the weapons
// each strategy used there. A weapon used in several tiers gets the average
// nudge. Prints the TUNE table to paste into src/sim/stats.ts.
//   node tools/tune.ts [tiers] [fightsPerPair] [rounds]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { archetypesFor, makeBuild } from '../src/career/builds.ts';
import { arenaOf } from '../src/data/arenas.ts';
import { weaponOf } from '../src/data/parts.ts';
import type { WeaponType } from '../src/data/types.ts';
import { Driver } from '../src/sim/ai.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { TUNE, computeStats } from '../src/sim/stats.ts';
import { World, DT } from '../src/sim/world.ts';

const ARENAS = ['garage', 'steelpit', 'crucible', 'worldarena', 'scrapyard', 'thunderdome'];
/**
 * The weapons that make each strategy what it is: their trims answer for its
 * record (a wedge's trim sets how hard it crushes what it pins).
 */
const KEY: Record<string, WeaponType[]> = {
  disc: ['vspin'], drum: ['drum'], bar: ['hspin'], ring: ['ring'], flipper: ['flipper'], lifter: ['lifter'],
  hammer: ['hammer', 'axe'], crusher: ['crusher'], rammer: ['ram'], wedge: ['wedge'], saw: ['saw'], firestarter: ['flipper', 'flame'],
};
/** trims outside these bounds mean the part's numbers need a look, not a bigger trim */
const LIMITS = [0.25, 5];

export interface TierResult {
  tier: number;
  rate: Record<string, number>;
  /** per strategy, how often each key weapon was carried */
  used: Record<string, Record<string, number>>;
  meanLen: number;
  koRate: number;
}

export function playTier(tier: number, n: number, seedBase: number): TierResult {
  const archs = archetypesFor(tier);
  const score: Record<string, number> = {};
  const count: Record<string, number> = {};
  const used: Record<string, Record<string, number>> = {};
  let len = 0;
  let fights = 0;
  let kos = 0;
  for (let i = 0; i < archs.length; i++) {
    for (let j = i + 1; j < archs.length; j++) {
      const A = archs[i];
      const B = archs[j];
      for (let k = 0; k < n; k++) {
        const seed = seedBase + k * 31 + i * 7 + j * 13 + tier * 101;
        const rng = mulberry32(seed);
        const da = makeBuild(A, tier, rng, { quality: 0.9 });
        const db = makeBuild(B, tier, rng, { quality: 0.9 });
        for (const [arch, d] of [[A.id, da], [B.id, db]] as const) {
          for (const id of [d.front, d.top]) {
            if (id && KEY[arch].includes(weaponOf(id).type)) {
              used[arch] ??= {};
              used[arch][id] = (used[arch][id] ?? 0) + 1;
            }
          }
        }
        const swap = k % 2 === 1;
        const w = new World(computeStats(swap ? db : da), computeStats(swap ? da : db), arenaOf(ARENAS[(k + i + j) % ARENAS.length]), { seed });
        w.quiet = true;
        const d0 = new Driver(w, 0, seed);
        const d1 = new Driver(w, 1, seed + 5);
        let steps = 0;
        while (!w.over && steps < 12000) {
          d0.update(DT);
          d1.update(DT);
          w.step();
          steps++;
        }
        const r = w.result!;
        const aWon = r.winner === null ? 0.5 : (r.winner === 0) !== swap ? 1 : 0;
        score[A.id] = (score[A.id] ?? 0) + aWon;
        score[B.id] = (score[B.id] ?? 0) + 1 - aWon;
        count[A.id] = (count[A.id] ?? 0) + 1;
        count[B.id] = (count[B.id] ?? 0) + 1;
        len += r.time;
        fights++;
        if (r.method !== 'decision') kos++;
      }
    }
  }
  const rate: Record<string, number> = {};
  for (const id of Object.keys(score)) rate[id] = score[id] / count[id];
  return { tier, rate, used, meanLen: len / fights, koRate: kos / fights };
}

/** Play every tier at once, a worker each. */
export function playTiers(tiers: number[], n: number, seedBase: number): Promise<TierResult[]> {
  return Promise.all(
    tiers.map(
      (tier) =>
        new Promise<TierResult>((resolve, reject) => {
          const w = new Worker(new URL(import.meta.url), { workerData: { tier, n, seedBase, tune: TUNE } });
          w.once('message', resolve);
          w.once('error', reject);
        }),
    ),
  );
}

export function formatTune(): string {
  const lines: string[] = [];
  let fam = '';
  let line: string[] = [];
  for (const [id, v] of Object.entries(TUNE)) {
    const t = weaponOf(id).type;
    const f = t === 'axe' ? 'hammer' : t;
    if (f !== fam && line.length) {
      lines.push('  ' + line.join(' '));
      line = [];
    }
    fam = f;
    line.push(`${id}: ${v},`);
  }
  if (line.length) lines.push('  ' + line.join(' '));
  return lines.join('\n');
}

if (!isMainThread) {
  const { tier, n, seedBase, tune } = workerData as { tier: number; n: number; seedBase: number; tune: Record<string, number> };
  Object.assign(TUNE, tune);
  parentPort!.postMessage(playTier(tier, n, seedBase));
} else if (process.argv[1]?.endsWith('tune.ts')) {
  const tiers = (process.argv[2] ?? '1,2,3,4,5').split(',').map(Number);
  const N = Number(process.argv[3] ?? 6);
  const rounds = Number(process.argv[4] ?? 6);
  for (let r = 0; r < rounds; r++) {
    const res = await playTiers(tiers, N, 1000 + r * 977);
    const logSum: Record<string, number> = {};
    const wSum: Record<string, number> = {};
    for (const t of res) {
      const line = Object.entries(t.rate).map(([k, v]) => `${k} ${Math.round(v * 100)}`).join('  ');
      console.log(`round ${r} tier ${t.tier}: len ${t.meanLen.toFixed(0)}s ko ${(t.koRate * 100).toFixed(0)}%  ${line}`);
      for (const [arch, v] of Object.entries(t.rate)) {
        const f = Math.max(0.88, Math.min(1.15, Math.pow(0.5 / Math.max(0.05, v), 0.4)));
        const parts = t.used[arch] ?? {};
        const total = Object.values(parts).reduce((s, x) => s + x, 0);
        for (const [id, c] of Object.entries(parts)) {
          logSum[id] = (logSum[id] ?? 0) + (c / total) * Math.log(f);
          wSum[id] = (wSum[id] ?? 0) + c / total;
        }
      }
    }
    for (const id of Object.keys(logSum)) {
      TUNE[id] = Math.round(Math.max(LIMITS[0], Math.min(LIMITS[1], (TUNE[id] ?? 1) * Math.exp(logSum[id] / wSum[id]))) * 100) / 100;
    }
    console.log(formatTune());
  }
}
