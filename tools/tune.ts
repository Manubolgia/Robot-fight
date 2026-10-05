// Trim each weapon until every strategy wins about half its fights, tier by
// tier. Each round plays a round-robin per tier (one worker per tier, the
// strategies that tier's parts can build, in the arenas of that tier's
// events), then nudges the trim of the weapons
// each strategy used there. A weapon used in several tiers gets the average
// nudge. The trims are then held to their upgrade line: each part close to the
// line's common trim, and each tier stronger than the one before, so tuning
// never makes a later part worse. Prints the TUNE table for src/sim/stats.ts.
//   node tools/tune.ts [tiers] [fightsPerPair] [rounds]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { archetypesFor, makeBuild } from '../src/career/builds.ts';
import { arenaOf } from '../src/data/arenas.ts';
import { arenasOfTier } from '../src/data/events.ts';
import { WEAPONS, weaponOf } from '../src/data/parts.ts';
import type { WeaponType } from '../src/data/types.ts';
import { Driver } from '../src/sim/ai.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { TUNE, computeStats, lineOf, lineStep, weaponStrength } from '../src/sim/stats.ts';
import { World, DT } from '../src/sim/world.ts';

/**
 * The weapons that make each strategy what it is: their trims answer for its
 * record (a wedge's trim sets how hard it crushes what it pins).
 */
const KEY: Record<string, WeaponType[]> = {
  disc: ['vspin'], drum: ['drum'], bar: ['hspin'], ring: ['ring'], flipper: ['flipper'], lifter: ['lifter'],
  hammer: ['hammer', 'axe'], crusher: ['crusher'], rammer: ['ram'], wedge: ['wedge'], saw: ['saw'], firestarter: ['flipper', 'flame'],
};
/** trims outside these bounds mean the part's numbers need a look, not a bigger trim */
const LIMITS = [0.1, 5];

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
  // fought where the tier's events are
  const arenas = arenasOfTier(tier);
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
        const w = new World(computeStats(swap ? db : da), computeStats(swap ? da : db), arenaOf(arenas[(k + i + j) % arenas.length]), { seed });
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
    const f = lineOf(weaponOf(id));
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

/** How far one part's trim may stray from its line's common trim. */
const BAND = 1.2;

/**
 * Hold the trims to their upgrade lines. Within a line each part stays within
 * BAND of the line's geometric mean trim, then an isotonic fit (pool adjacent
 * violators, in log space) makes strength climb at least lineStep per tier
 * with the least change to the trims.
 */
export function holdLines() {
  const byLine = new Map<string, typeof WEAPONS>();
  for (const w of WEAPONS) {
    const l = lineOf(w);
    if (!byLine.has(l)) byLine.set(l, []);
    byLine.get(l)!.push(w);
  }
  for (const parts of byLine.values()) {
    parts.sort((a, b) => a.tier - b.tier);
    const mean = Math.exp(parts.reduce((s, w) => s + Math.log(TUNE[w.id] ?? 1), 0) / parts.length);
    for (const w of parts) TUNE[w.id] = Math.max(mean / BAND, Math.min(mean * BAND, TUNE[w.id] ?? 1));
    // y_i = log strength less the climb it must make; fit y non-decreasing
    let climb = 0;
    const need: number[] = [];
    const y = parts.map((w, i) => {
      // a hair over the step, so rounding the trims cannot dip under it
      if (i > 0) climb += Math.log(lineStep(w) + 0.004) * (w.tier - parts[i - 1].tier);
      need.push(climb);
      return Math.log(weaponStrength(w)) - climb;
    });
    const blocks: Array<{ v: number; n: number }> = [];
    for (const v of y) {
      blocks.push({ v, n: 1 });
      while (blocks.length > 1 && blocks[blocks.length - 2].v > blocks[blocks.length - 1].v) {
        const b = blocks.pop()!;
        const a = blocks.pop()!;
        blocks.push({ v: (a.v * a.n + b.v * b.n) / (a.n + b.n), n: a.n + b.n });
      }
    }
    const fit: number[] = [];
    for (const b of blocks) for (let k = 0; k < b.n; k++) fit.push(b.v);
    parts.forEach((w, i) => {
      // solve the trim that gives the fitted strength
      const want = Math.exp(fit[i] + need[i]);
      const at1 = weaponStrength(w, 1);
      const sqrt = w.type === 'flipper' || w.type === 'lifter';
      const trim = sqrt ? (want / at1) ** 2 : want / at1;
      TUNE[w.id] = Math.round(Math.max(LIMITS[0], Math.min(LIMITS[1], trim)) * 10000) / 10000;
    });
  }
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
      TUNE[id] = Math.max(LIMITS[0], Math.min(LIMITS[1], (TUNE[id] ?? 1) * Math.exp(logSum[id] / wSum[id])));
    }
    holdLines();
    console.log(formatTune());
  }
}
