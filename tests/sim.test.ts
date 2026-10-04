import { describe, expect, it } from 'vitest';
import { ARCHETYPES, archetypesFor, makeBuild } from '../src/career/builds.ts';
import { KITS, closeTournament, newCareer } from '../src/career/career.ts';
import { PLAYER, createTournament, nextPlayerMatch, recordPlayerFight } from '../src/career/tournament.ts';
import { ARENAS, arenaOf } from '../src/data/arenas.ts';
import { EVENTS, FORMAT_FIGHTS } from '../src/data/events.ts';
import { ALL_PARTS, part, weaponOf } from '../src/data/parts.ts';
import { WEIGHT_LIMIT } from '../src/data/types.ts';
import { Driver, REBOOT_TIME } from '../src/sim/ai.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { computeStats, designWeight, isLegal, powerDraw, coreOutput, autoPower, validate } from '../src/sim/stats.ts';
import { DT, FIGHT_TIME, World, freshWear, type FightResult } from '../src/sim/world.ts';

function fight(seed: number, a = 'disc', b = 'wedge', tier = 3, arena = 'crucible'): FightResult {
  const rng = mulberry32(seed);
  const da = makeBuild(ARCHETYPES.find((x) => x.id === a)!, tier, rng);
  const db = makeBuild(ARCHETYPES.find((x) => x.id === b)!, tier, rng);
  const w = new World(computeStats(da), computeStats(db), arenaOf(arena), { seed });
  w.quiet = true;
  const d = [new Driver(w, 0, seed), new Driver(w, 1, seed + 1)];
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
    d.power = autoPower(d);
    expect(powerDraw(d)).toBeLessThanOrEqual(coreOutput(d) + 1e-9);
    // a core far too small: the weapons go off before anything is overloaded,
    // and if even the drive and brain cannot run the design is flagged
    d.core = 'co_lead';
    d.power = autoPower(d);
    expect(powerDraw(d) <= coreOutput(d) + 1e-9 || validate(d).some((i) => /cannot keep it all running/.test(i.text))).toBe(true);
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

describe('brains and power', () => {
  const arch = (id: string) => ARCHETYPES.find((x) => x.id === id)!;

  it('switches off a weapon below its minimum power', () => {
    const d = makeBuild(arch('drum'), 3, mulberry32(4));
    d.power.front = 0.2;
    expect(computeStats(d).front!.p).toBe(0);
    expect(validate(d).some((i) => i.level === 'warn' && /switched off/.test(i.text))).toBe(true);
    d.power.front = 1;
    expect(computeStats(d).front!.p).toBe(1);
  });

  it('will not pass a core that cannot keep every part at its minimum', () => {
    const d = makeBuild(arch('disc'), 5, mulberry32(5));
    d.core = 'co_lead';
    d.brain = 'br_overmind';
    d.power = { drive: 1, front: 1, top: 1, aux: 1, brain: 1 };
    expect(validate(d).some((i) => i.level === 'error' && /cannot keep it all running/.test(i.text))).toBe(true);
    // auto power gets it running by switching the weapon off, and says so
    d.power = autoPower(d);
    expect(d.power.front).toBe(0);
    expect(validate(d).some((i) => /switched off/.test(i.text))).toBe(true);
  });

  it('a starved brain reboots and freezes the robot for a moment', () => {
    const d = makeBuild(arch('drum'), 5, mulberry32(6));
    d.brain = 'br_overmind';
    d.power.brain = 0.4;
    const w = new World(computeStats(d), computeStats(d), arenaOf('garage'), { seed: 3 });
    const a = new Driver(w, 0, 1);
    const b = new Driver(w, 1, 2);
    let rebooted = false;
    for (let i = 0; i < 240; i++) {
      a.update(DT);
      b.update(DT);
      w.step();
      if (w.events.some((e) => e.type === 'reboot' && e.bot === 0)) rebooted = true;
      if (a.rebooting) expect(w.bots[0].ctl.throttle).toBe(0);
      w.events.length = 0;
    }
    expect(rebooted).toBe(true);
    expect(REBOOT_TIME).toBeGreaterThan(0.3);
  });

  it('a sharper brain wins more often in a mirror match', () => {
    let sharp = 0;
    let n = 0;
    for (const id of ['disc', 'hammer', 'flipper', 'crusher', 'rammer', 'saw']) {
      for (let k = 0; k < 6; k++) {
        const d = makeBuild(arch(id), 5, mulberry32(500 + k * 17));
        d.brain = 'br_overmind';
        d.power = autoPower(d);
        const dull = structuredClone(d);
        dull.brain = 'br_relay';
        const swap = k % 2 === 1;
        const w = new World(computeStats(swap ? dull : d), computeStats(swap ? d : dull), arenaOf(ARENAS[k % 4].id), { seed: k + 1 });
        w.quiet = true;
        const drivers = [new Driver(w, 0, k), new Driver(w, 1, k + 7)];
        let steps = 0;
        while (!w.over && steps < 14000) {
          drivers[0].update(DT);
          drivers[1].update(DT);
          w.step();
          steps++;
        }
        const r = w.result!;
        sharp += r.winner === null ? 0.5 : r.winner === (swap ? 1 : 0) ? 1 : 0;
        n++;
      }
    }
    expect(sharp / n).toBeGreaterThan(0.6);
  });
});
