// The design rules of the parts economy. Later parts are better at what they
// do, and better per kilowatt and per kilo; the weight limit and the core's
// output still make every design a trade at every tier.

import { describe, expect, it } from 'vitest';
import { ARMORS, BRAINS, CHASSIS, CORES, DRIVES, WEAPONS, minPowerOf } from '../src/data/parts.ts';
import type { DriveDef, Tier, WeaponDef } from '../src/data/types.ts';
import { WEIGHT_LIMIT } from '../src/data/types.ts';
import { ARMOR_KG, lineOf, lineStep, weaponStrength, weaponValue } from '../src/sim/stats.ts';

const TIERS: Tier[] = [1, 2, 3, 4, 5];

function groupBy<T>(list: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(x);
  }
  return m;
}

const pairs = <T extends { tier: number }>(list: T[]) => {
  const s = [...list].sort((a, b) => a.tier - b.tier);
  return s.slice(1).map((b, i) => [s[i], b] as const);
};

describe('weapon upgrade lines', () => {
  const lines = groupBy(WEAPONS, lineOf);

  it('have one part per tier, with no gaps from the tier they enter', () => {
    for (const [line, parts] of lines) {
      const tiers = parts.map((w) => w.tier).sort();
      for (let i = 1; i < tiers.length; i++) expect(tiers[i] - tiers[i - 1], line).toBe(1);
    }
  });

  it('get stronger with every tier, trims included', () => {
    for (const [line, parts] of lines) {
      for (const [a, b] of pairs(parts)) {
        expect(weaponStrength(b) / weaponStrength(a), `${line}: ${a.id} -> ${b.id}`).toBeGreaterThanOrEqual(lineStep(b) - 1e-6);
        expect(weaponStrength(b, 1) / weaponStrength(a, 1), `${line} base: ${a.id} -> ${b.id}`).toBeGreaterThanOrEqual(lineStep(b) - 1e-6);
      }
    }
  });

  it('deliver more per kilowatt up the line, at much the same weight', () => {
    for (const [line, parts] of lines) {
      for (const [a, b] of pairs(parts)) {
        if (a.power > 0) expect(weaponValue(b) / b.power, `${line}: ${a.id} -> ${b.id}`).toBeGreaterThanOrEqual((weaponValue(a) / a.power) * 0.995);
        expect(b.weight - a.weight, `${line}: ${a.id} -> ${b.id}`).toBeLessThanOrEqual(1.5);
        expect(minPowerOf(b), `${line}: ${a.id} -> ${b.id}`).toBeGreaterThanOrEqual(minPowerOf(a));
      }
    }
  });
});

describe('the rest of the catalogue', () => {
  const driveLine = (d: DriveDef) => (d.style === 'mecanum' ? 'omni' : d.style === 'treads' || d.style === 'wheels6' ? 'grip' : 'wheels');

  it('drives get faster, stronger and lighter up each line, and better per kilowatt', () => {
    // the twin-wheel starter is the light alternative at tier 1, not a step on the line
    const lines = groupBy(DRIVES.filter((d) => d.id !== 'dr_twin'), driveLine);
    for (const [line, parts] of lines) {
      for (const [a, b] of pairs(parts)) {
        expect(b.speed, `${line}: ${a.id} -> ${b.id}`).toBeGreaterThan(a.speed);
        expect(b.force, `${line}: ${a.id} -> ${b.id}`).toBeGreaterThan(a.force);
        expect(b.weight, `${line}: ${a.id} -> ${b.id}`).toBeLessThanOrEqual(a.weight);
        expect((b.force * b.speed) / b.power, `${line}: ${a.id} -> ${b.id}`).toBeGreaterThanOrEqual((a.force * a.speed) / a.power);
      }
    }
  });

  it('cores give about 20% more power a tier, lighter per kilowatt', () => {
    for (const pick of [0, 1]) {
      // each tier: the compact cell and the heavy stack
      const line = TIERS.map((t) => CORES.filter((c) => c.tier === t).sort((a, b) => a.output - b.output)[pick]);
      for (const [a, b] of pairs(line)) {
        expect(b.output / a.output, `${a.id} -> ${b.id}`).toBeGreaterThanOrEqual(1.15);
        expect(b.output / b.weight, `${a.id} -> ${b.id}`).toBeGreaterThan(a.output / a.weight);
      }
    }
  });

  it('all-round armour holds more per kilo with each tier', () => {
    const line = ['ar_alu', 'ar_titanium', 'ar_composite', 'ar_nano'].map((id) => ARMORS.find((a) => a.id === id)!);
    for (const [a, b] of pairs(line)) expect(b.hpPerLevel / b.density, `${a.id} -> ${b.id}`).toBeGreaterThan(a.hpPerLevel / a.density);
  });

  it('frames of the same shape get tougher per kilo', () => {
    for (const [shape, parts] of groupBy(CHASSIS, (c) => c.shape)) {
      for (const [a, b] of pairs(parts)) {
        expect(b.hp, `${shape}: ${a.id} -> ${b.id}`).toBeGreaterThan(a.hp);
        expect(b.hp / b.weight, `${shape}: ${a.id} -> ${b.id}`).toBeGreaterThan(a.hp / a.weight);
      }
    }
  });

  it('plain brains think faster, aim better and read more, for more power', () => {
    const line = BRAINS.filter((b) => !b.trait);
    for (const [a, b] of pairs(line)) {
      expect(b.reaction, `${a.id} -> ${b.id}`).toBeLessThan(a.reaction);
      expect(b.aim, `${a.id} -> ${b.id}`).toBeGreaterThan(a.aim);
      expect(b.awareness, `${a.id} -> ${b.id}`).toBeGreaterThan(a.awareness);
      expect(b.power, `${a.id} -> ${b.id}`).toBeGreaterThan(a.power);
    }
  });
});

describe('every design is a trade', () => {
  /** The most a robot of this tier could ask of its core: the hungriest drive, weapon and plain brain. */
  function fullSpec(t: Tier) {
    const at = <T extends { tier: number }>(list: T[]) => list.filter((p) => p.tier <= t);
    const drive = at(DRIVES).reduce((m, d) => (d.power > m.power ? d : m));
    const front = at(WEAPONS.filter((w: WeaponDef) => w.mount !== 'top')).reduce((m, w) => (w.power > m.power ? w : m));
    const brain = at(BRAINS.filter((b) => !b.trait)).reduce((m, b) => (b.power > m.power ? b : m));
    return { drive, front, brain, kw: drive.power + front.power + brain.power };
  }

  it('a full-spec robot of its tier fits the heavy stack, but not the compact cell', () => {
    for (const t of TIERS) {
      const [cell, stack] = CORES.filter((c) => c.tier === t).sort((a, b) => a.output - b.output);
      const { kw } = fullSpec(t);
      expect(kw, `tier ${t}`).toBeGreaterThan(cell.output);
      expect(kw, `tier ${t}`).toBeLessThanOrEqual(stack.output);
    }
  });

  it('with the stack and the biggest parts, well under full armour fits', () => {
    for (const t of TIERS) {
      const at = <T extends { tier: number }>(list: T[]) => list.filter((p) => p.tier <= t);
      const frame = at(CHASSIS.filter((c) => c.topMount)).reduce((m, c) => (c.hp > m.hp ? c : m));
      const stack = CORES.filter((c) => c.tier === t).sort((a, b) => b.output - a.output)[0];
      const top = at(WEAPONS.filter((w) => w.mount === 'top')).reduce((m, w) => (w.weight > m.weight ? w : m));
      const { drive, front, brain } = fullSpec(t);
      const armour = at(ARMORS).filter((a) => ['ar_alu', 'ar_titanium', 'ar_composite', 'ar_nano'].includes(a.id)).pop()!;
      const kg = frame.weight + stack.weight + drive.weight + front.weight + top.weight + brain.weight;
      const fullPlates = 5 * (frame.area.front + frame.area.sides + frame.area.rear + frame.area.top) * armour.density * ARMOR_KG;
      expect(WEIGHT_LIMIT - kg, `tier ${t}`).toBeLessThan(fullPlates * 0.6);
    }
  });
});
