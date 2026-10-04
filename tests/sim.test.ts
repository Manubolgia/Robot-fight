import { describe, expect, it } from 'vitest';
import { ARCHETYPES, archetypesFor, makeBuild } from '../src/career/builds.ts';
import { KITS, closeTournament, newCareer } from '../src/career/career.ts';
import { PLAYER, createTournament, nextPlayerMatch, recordPlayerFight } from '../src/career/tournament.ts';
import { ARENAS, arenaOf } from '../src/data/arenas.ts';
import { EVENTS, FORMAT_FIGHTS } from '../src/data/events.ts';
import { ALL_PARTS, part, weaponOf } from '../src/data/parts.ts';
import { WEIGHT_LIMIT } from '../src/data/types.ts';
import { Driver, skillFor } from '../src/sim/ai.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { computeStats, designWeight, isLegal, powerDraw, coreOutput, autoPower } from '../src/sim/stats.ts';
import { DT, FIGHT_TIME, World, freshWear, type FightResult } from '../src/sim/world.ts';

function fight(seed: number, a = 'disc', b = 'wedge', tier = 3, arena = 'crucible'): FightResult {
  const rng = mulberry32(seed);
  const da = makeBuild(ARCHETYPES.find((x) => x.id === a)!, tier, rng);
  const db = makeBuild(ARCHETYPES.find((x) => x.id === b)!, tier, rng);
  const w = new World(computeStats(da), computeStats(db), arenaOf(arena), { seed });
  w.quiet = true;
  const d = [new Driver(w, 0, skillFor(tier), seed), new Driver(w, 1, skillFor(tier), seed + 1)];
  let n = 0;
  while (!w.over && n < 20000) {
    d[0].update(DT);
    d[1].update(DT);
    w.step();
    n++;
  }
  return w.result!;
}

const win = (): FightResult => ({
  winner: 0,
  method: 'KO',
  time: 30,
  stats: [0, 1].map(() => ({ dmgDealt: 100, dmgTaken: 10, hits: 3, bigHits: 1, flips: 0, aggression: 5, control: 5, biggestHit: 50 })),
  wear: [freshWear(), freshWear()],
});

describe('parts and designs', () => {
  it('has unique part ids', () => {
    const ids = ALL_PARTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('starter kits are legal robots', () => {
    for (const k of KITS) {
      const c = newCareer('Test', k.id, 'Bot', { primary: '#fff', secondary: '#000', pattern: 'plain' });
      const bot = c.bots[0];
      for (const id of [bot.chassis, bot.drive, bot.core, bot.front, bot.top, bot.armor.material]) if (id) expect(c.owned[id]).toBe(1);
      expect(designWeight(bot)).toBeLessThanOrEqual(WEIGHT_LIMIT);
      expect(isLegal(bot)).toBe(true);
    }
  });

  it('every archetype builds a legal robot at every tier', () => {
    for (const a of ARCHETYPES) {
      for (let tier = 1; tier <= 5; tier++) {
        const d = makeBuild(a, tier, mulberry32(tier * 31 + a.id.length));
        expect(designWeight(d)).toBeLessThanOrEqual(WEIGHT_LIMIT + 1e-9);
        expect(powerDraw(d)).toBeLessThanOrEqual(coreOutput(d) + 1e-9);
        for (const id of [d.chassis, d.drive, d.core, d.front, d.top, ...d.modules]) if (id) expect(part(id).tier).toBeLessThanOrEqual(tier);
      }
    }
  });

  it('a strategy only enters tiers whose parts can build its weapon', () => {
    for (let tier = 1; tier <= 5; tier++) {
      for (const a of archetypesFor(tier)) {
        const d = makeBuild(a, tier, mulberry32(tier * 13 + a.id.length));
        const signature = a.topRequired ? (d.top ? weaponOf(d.top).type : null) : d.front ? weaponOf(d.front).type : null;
        expect(signature && (a.topRequired ? a.top : a.front).includes(signature), `${a.id} at tier ${tier}`).toBe(true);
      }
    }
    expect(archetypesFor(1).length).toBeGreaterThanOrEqual(6);
    expect(archetypesFor(5).length).toBe(ARCHETYPES.length);
  });

  it('auto power never overloads the core', () => {
    const d = makeBuild(ARCHETYPES[0], 5, mulberry32(3));
    d.core = 'co_lead';
    d.power = autoPower(d);
    expect(powerDraw(d)).toBeLessThanOrEqual(coreOutput(d) + 1e-9);
  });
});

describe('the fight', () => {
  it('is deterministic for a seed', () => {
    const a = fight(42);
    const b = fight(42);
    expect(a.winner).toBe(b.winner);
    expect(a.method).toBe(b.method);
    expect(a.time).toBeCloseTo(b.time, 6);
  });

  it('always ends with a result inside the time', () => {
    for (let s = 1; s <= 6; s++) {
      const r = fight(s, ARCHETYPES[s % ARCHETYPES.length].id, ARCHETYPES[(s * 5) % ARCHETYPES.length].id, 1 + (s % 5), ARENAS[s % ARENAS.length].id);
      expect(r).toBeTruthy();
      expect(r.time).toBeLessThanOrEqual(FIGHT_TIME + 1e-6);
      if (r.method === 'decision') expect(r.judges?.cards.length).toBe(3);
    }
  });
});

describe('tournaments', () => {
  for (const ev of EVENTS) {
    it(`${ev.name}: a player who wins every fight is champion after ${FORMAT_FIGHTS[ev.format]} fights`, () => {
      const c = newCareer('Test', 'spinner', 'Bot', { primary: '#fff', secondary: '#000', pattern: 'plain' });
      const t = createTournament(c, ev.id, c.bots[0].id, () => 1);
      let fights = 0;
      while (nextPlayerMatch(t) && fights < 10) {
        recordPlayerFight(t, win());
        fights++;
      }
      expect(fights).toBe(FORMAT_FIGHTS[ev.format]);
      expect(t.phase).toBe('done');
      expect(t.place).toBe(1);
    });
  }

  it('losing the first knockout fight ends the event', () => {
    const c = newCareer('Test', 'spinner', 'Bot', { primary: '#fff', secondary: '#000', pattern: 'plain' });
    const t = createTournament(c, 'regional-open', c.bots[0].id, () => 1);
    recordPlayerFight(t, { ...win(), winner: 1 });
    expect(t.out).toBe(true);
    expect(t.phase).toBe('done');
    expect(t.place).toBe(5);
    expect(t.entrants.some((e) => e.id === PLAYER)).toBe(true);
  });

  it('a title earns the next licence', () => {
    const c = newCareer('Test', 'spinner', 'Bot', { primary: '#fff', secondary: '#000', pattern: 'plain' });
    const res = closeTournament(c, 'garage-rumble', 'Garage Rumble', 1, 1, 900, 'Bot');
    expect(res.newTier).toBe(true);
    expect(c.tier).toBe(2);
    expect(c.trophies.length).toBe(1);
  });

  it('winning the World Cup starts a new season', () => {
    const c = newCareer('Test', 'spinner', 'Bot', { primary: '#fff', secondary: '#000', pattern: 'plain' });
    c.tier = 5;
    const res = closeTournament(c, 'world-cup', 'Kilowatt World Cup', 5, 1, 1, 'Bot');
    expect(res.champion).toBe(true);
    expect(c.season).toBe(2);
  });
});

describe('thumbstick driving', () => {
  it('turns toward the stick and drives, reverses when it points behind', async () => {
    const { ManualDriver } = await import('../src/sim/manual.ts');
    const rng = mulberry32(9);
    const d = makeBuild(ARCHETYPES[0], 2, rng);
    const w = new World(computeStats(d), computeStats(d), arenaOf('garage'), { seed: 1 });
    const me = w.bots[0]; // starts facing north (up the screen)
    const md = new ManualDriver();
    md.apply(me, w.bots[1], 0, 1, false); // stick up: straight ahead
    expect(me.ctl.throttle).toBeGreaterThan(0.9);
    expect(Math.abs(me.ctl.turn)).toBeLessThan(0.05);
    md.apply(me, w.bots[1], 0, -1, false); // stick down: back up
    expect(me.ctl.throttle).toBeLessThan(-0.5);
    const md2 = new ManualDriver();
    md2.apply(me, w.bots[1], -1, 0, false); // stick left: turn left (counter-clockwise)
    expect(me.ctl.turn).toBeGreaterThan(0.5);
  });
});
