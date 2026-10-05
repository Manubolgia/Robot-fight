// Robot recipes. Each archetype is a strategy; makeBuild() turns it into a
// legal design from the parts of a tier, filling the weight limit with
// armour the way that strategy wants. Used for every computer team, for the
// starter kits and by the balance tests.

import { ARMORS, BRAINS, CHASSIS, CORES, DRIVES, MODULES, WEAPONS, brainOf, chassisOf, coreOf, driveOf, moduleOf, weaponOf } from '../data/parts.ts';
import type { ArmorZone, BattlePlan, BotDesign, BrainTrait, ChassisShape, DriveStyle, ModuleEffect, Paint, PowerSplit, Tier, WeaponType } from '../data/types.ts';
import { MAX_PLATES, WEIGHT_LIMIT } from '../data/types.ts';
import { pick, type Rng } from '../sim/rng.ts';
import { MAX_POWER, OVERVOLT_HEAT, POWER_KEYS, designWeight, minShares, powerDraw, ratedDraw, type PowerKey } from '../sim/stats.ts';

export interface Archetype {
  id: string;
  name: string;
  blurb: string;
  front: WeaponType[];
  top: WeaponType[];
  shapes: ChassisShape[];
  drive: 'fast' | 'push' | 'balanced';
  styles?: DriveStyle[];
  materials: string[];
  zones: Partial<Record<ArmorZone, number>>;
  modules: ModuleEffect[];
  /** share of spare power that goes to the weapon rather than the drive */
  weaponBias: number;
  /** the top weapon is the point of the robot: the frame must carry it */
  topRequired?: boolean;
  /** first tier whose parts can build it (its signature weapon) */
  from: Tier;
  /** how its brain is told to fight */
  plan: BattlePlan;
  /** brain quirks that suit it */
  traits: BrainTrait[];
}

export const ARCHETYPES: Archetype[] = [
  {
    id: 'disc', from: 2, name: 'Disc Slayer', blurb: 'A big vertical disc and armour up front.',
    front: ['vspin'], top: [], shapes: ['box', 'low'], drive: 'balanced', styles: ['wheels4', 'wheels2'],
    materials: ['ar_nano', 'ar_composite', 'ar_titanium', 'ar_uhmw', 'ar_alu'], zones: { front: 3, sides: 2, rear: 1, top: 1 },
    modules: ['gyro', 'selfright', 'guard', 'shock'], weaponBias: 0.8,
    plan: { stance: 'balanced', approach: 'counter', hazards: false }, traits: ['adaptive', 'cautious'],
  },
  {
    id: 'drum', from: 1, name: 'Drum Brute', blurb: 'A tough drum that never stops biting.',
    front: ['drum'], top: [], shapes: ['low', 'box'], drive: 'balanced',
    materials: ['ar_nano', 'ar_titanium', 'ar_uhmw', 'ar_steel', 'ar_alu'], zones: { front: 2, sides: 2, rear: 1, top: 1 },
    modules: ['selfright', 'shock', 'guard', 'heatsink'], weaponBias: 0.7,
    plan: { stance: 'aggressive', approach: 'direct', hazards: false }, traits: ['reckless', 'adaptive'],
  },
  {
    id: 'bar', from: 1, name: 'Bar Spinner', blurb: 'A huge horizontal bar; wide hits, big recoil.',
    front: ['hspin'], top: [], shapes: ['box', 'tall'], drive: 'balanced',
    materials: ['ar_nano', 'ar_titanium', 'ar_uhmw', 'ar_alu'], zones: { sides: 2, rear: 2, front: 1, top: 1 },
    modules: ['selfright', 'shock', 'guard', 'redundant'], weaponBias: 0.75,
    plan: { stance: 'balanced', approach: 'counter', hazards: false }, traits: ['adaptive', 'cautious'],
  },
  {
    id: 'ring', from: 3, name: 'Ring Spinner', blurb: 'Spinning teeth all the way round.',
    front: ['ring'], top: [], shapes: ['dome', 'box'], drive: 'balanced',
    materials: ['ar_nano', 'ar_titanium', 'ar_uhmw', 'ar_alu'], zones: { top: 2, front: 1, sides: 1, rear: 1 },
    modules: ['shock', 'guard', 'gyro', 'redundant'], weaponBias: 0.75,
    plan: { stance: 'aggressive', approach: 'direct', hazards: false }, traits: ['reckless', 'cautious'],
  },
  {
    id: 'flipper', from: 1, name: 'Flipper', blurb: 'Gets under, throws them over, counts them out.',
    front: ['flipper'], top: [], shapes: ['wedge', 'box'], drive: 'balanced', styles: ['wheels4', 'wheels6', 'treads'],
    materials: ['ar_nano', 'ar_titanium', 'ar_steel', 'ar_alu'], zones: { front: 2, sides: 2, rear: 1, top: 1 },
    modules: ['skirts', 'magnets', 'shock', 'heatsink'], weaponBias: 0.5,
    plan: { stance: 'balanced', approach: 'flank', hazards: true }, traits: ['hunter', 'adaptive'],
  },
  {
    id: 'lifter', from: 2, name: 'Lifter', blurb: 'Scoop, carry, dump them in the hazards.',
    front: ['lifter'], top: [], shapes: ['box', 'wedge'], drive: 'push', styles: ['treads', 'wheels6', 'wheels4'],
    materials: ['ar_nano', 'ar_titanium', 'ar_uhmw', 'ar_steel'], zones: { front: 2, sides: 2, rear: 1, top: 1 },
    modules: ['magnets', 'skirts', 'shock', 'reactive'], weaponBias: 0.45,
    plan: { stance: 'balanced', approach: 'flank', hazards: true }, traits: ['hunter', 'cautious'],
  },
  {
    id: 'hammer', from: 1, name: 'Hammer Wedge', blurb: 'A wedge to pin them, a hammer to finish them.',
    front: ['wedge'], top: ['hammer', 'axe'], topRequired: true, shapes: ['wedge', 'tall', 'box'], drive: 'balanced',
    materials: ['ar_nano', 'ar_titanium', 'ar_uhmw', 'ar_alu'], zones: { front: 2, sides: 2, rear: 1, top: 1 },
    modules: ['skirts', 'shock', 'wedgelets', 'reactive'], weaponBias: 0.55,
    plan: { stance: 'balanced', approach: 'direct', hazards: true }, traits: ['hunter', 'adaptive'],
  },
  {
    id: 'crusher', from: 2, name: 'Crusher', blurb: 'Bites through any armour and holds on.',
    front: ['crusher'], top: [], shapes: ['box', 'tall'], drive: 'push', styles: ['treads', 'wheels6', 'wheels4'],
    materials: ['ar_nano', 'ar_titanium', 'ar_uhmw', 'ar_steel'], zones: { front: 2, sides: 2, top: 2, rear: 1 },
    modules: ['selfright', 'shock', 'magnets', 'guard'], weaponBias: 0.55,
    plan: { stance: 'balanced', approach: 'direct', hazards: true }, traits: ['cautious', 'hunter'],
  },
  {
    id: 'rammer', from: 1, name: 'Rammer', blurb: 'Fast, heavy, spiked. Hits like a train.',
    front: ['ram'], top: [], shapes: ['box', 'low'], drive: 'fast',
    materials: ['ar_nano', 'ar_titanium', 'ar_steel', 'ar_uhmw'], zones: { front: 3, sides: 2, rear: 1, top: 1 },
    modules: ['thorns', 'capacitor', 'selfright', 'shock'], weaponBias: 0,
    plan: { stance: 'aggressive', approach: 'direct', hazards: true }, traits: ['reckless'],
  },
  {
    id: 'wedge', from: 2, name: 'Control Wedge', blurb: 'All drive and armour. Wins on control and the hazards.',
    front: ['wedge'], top: [], shapes: ['box', 'wedge', 'low'], drive: 'push', styles: ['treads', 'wheels6', 'wheels4'],
    materials: ['ar_nano', 'ar_titanium', 'ar_steel', 'ar_alu'], zones: { front: 3, sides: 3, rear: 2, top: 2 },
    modules: ['magnets', 'skirts', 'thorns', 'capacitor'], weaponBias: 0.2,
    plan: { stance: 'aggressive', approach: 'direct', hazards: true }, traits: ['reckless', 'cautious'],
  },
  {
    id: 'saw', from: 1, name: 'Saw Bot', blurb: 'Pins with a wedge and grinds away.',
    front: ['wedge'], top: ['saw'], topRequired: true, shapes: ['wedge', 'box'], drive: 'balanced',
    materials: ['ar_nano', 'ar_titanium', 'ar_steel', 'ar_alu'], zones: { front: 2, sides: 2, rear: 1, top: 1 },
    modules: ['skirts', 'heatsink', 'shock', 'targeting'], weaponBias: 0.5,
    plan: { stance: 'aggressive', approach: 'direct', hazards: true }, traits: ['reckless', 'hunter'],
  },
  {
    id: 'firestarter', from: 2, name: 'Firestarter', blurb: 'Flipper and flamethrower: cook them, then toss them.',
    front: ['flipper', 'wedge'], top: ['flame'], shapes: ['wedge', 'box'], drive: 'balanced',
    materials: ['ar_nano', 'ar_titanium', 'ar_steel', 'ar_alu'], zones: { front: 2, sides: 2, rear: 1, top: 1 },
    modules: ['heatsink', 'skirts', 'shock', 'coolant'], weaponBias: 0.5,
    plan: { stance: 'balanced', approach: 'flank', hazards: true }, traits: ['hunter', 'adaptive'],
  },
];

export const archetypeOf = (id: string) => ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPES[0];

/** The strategies the parts of a tier can build. */
export const archetypesFor = (tier: number) => ARCHETYPES.filter((a) => a.from <= tier);

const avail = <T extends { tier: Tier }>(list: T[], tier: number) => list.filter((p) => p.tier <= tier);

/** Pick among the best few of a list, scored; low tiers of AI are a bit random. */
function best<T>(rng: Rng, list: T[], score: (p: T) => number, spread = 0.12): T | null {
  if (!list.length) return null;
  const scored = list.map((p) => ({ p, s: score(p) * (1 + (rng() - 0.5) * spread) }));
  scored.sort((a, b) => b.s - a.s);
  return scored[0].p;
}

export interface BuildOptions {
  /** limit which parts may be used (the player's owned parts) */
  owned?: (id: string) => boolean;
  name?: string;
  paint?: Paint;
  id?: string;
  /** 0..1 how optimised the build is (AI teams at low tiers are scrappy) */
  quality?: number;
  /** money for parts beyond the starter kit (which every team has); unset for no limit */
  budget?: number;
}

/** What every team owns from the start: the parts of the starter kits' robot. */
const STARTER = new Set(['ch_scrapbox', 'dr_twin', 'co_lead', 'ar_alu', 'br_relay']);

export function makeBuild(arch: Archetype, tier: number, rng: Rng, opts: BuildOptions = {}): BotDesign {
  const ok = opts.owned ?? (() => true);
  const q = opts.quality ?? 1;
  const spread = 0.1 + (1 - q) * 0.5;
  const tierFit = <T extends { tier: Tier; id: string }>(list: T[]) => avail(list, tier).filter((p) => ok(p.id));
  // the team's money: the starter kit is free, everything else is bought in
  // order of importance (weapons, frame, drive, brain, core, modules, armour),
  // and nothing the team could not then afford a core to run
  let left = opts.budget ?? Infinity;
  const cost = (p: { id: string; price: number }) => (STARTER.has(p.id) ? 0 : p.price);
  const free = <T extends { id: string; price: number }>(list: T[]) => list.filter((p) => cost(p) === 0);
  const afford = <T extends { id: string; price: number }>(list: T[]) => {
    const can = list.filter((p) => cost(p) <= left);
    return can.length ? can : free(list);
  };
  const spend = (p: { id: string; price: number } | null | undefined) => {
    if (p) left -= cost(p);
  };
  const cores = tierFit(CORES);
  /** the cheapest core that runs this many kilowatts, with the strategy's margin */
  const powerCost = (kw: number) => {
    const can = cores.filter((c) => c.output >= kw * (1 + arch.weaponBias * 0.15) * 0.92).map(cost);
    return can.length ? Math.min(...can) : Math.max(0, ...cores.map(cost));
  };
  /** what the team can buy and still power, with `kw` already drawn */
  const affordRun = <T extends { id: string; price: number; power: number }>(list: T[], kw: number) => {
    const can = list.filter((p) => cost(p) + powerCost(kw + p.power) <= left);
    return can.length ? can : free(list).length ? free(list) : afford(list);
  };

  // weapons: the signature weapon comes first, the cheapest of its family if
  // that is all the team can stretch to
  const frontPool = tierFit(WEAPONS).filter((w) => arch.front.includes(w.type) && w.mount !== 'top');
  const frontCan = frontPool.filter((w) => cost(w) <= left);
  // a wedge under a top weapon is only there to pin them: the cheap plow does
  const front = best(rng, frontCan.length ? frontCan : [...frontPool].sort((a, b) => a.price - b.price).slice(0, 1), (w) => (w.type === 'wedge' && arch.topRequired ? -w.price / 100 : w.tier * 10 + w.price / 4000), spread);
  spend(front);
  const wantsTop = arch.top.length > 0 && front?.mount !== 'full';
  const topPool = wantsTop ? tierFit(WEAPONS).filter((w) => arch.top.includes(w.type) && w.mount === 'top') : [];
  const topCan = topPool.filter((w) => cost(w) <= left);
  let top = best(rng, arch.topRequired && !topCan.length ? [...topPool].sort((a, b) => a.price - b.price).slice(0, 1) : topCan, (w) => w.tier * 10 + w.price / 4000, spread);
  spend(top);
  // frame
  const needTop = !!top && !!arch.topRequired;
  let chPool = tierFit(CHASSIS).filter((c) => arch.shapes.includes(c.shape) && (!needTop || c.topMount));
  if (!chPool.length) chPool = tierFit(CHASSIS).filter((c) => !needTop || c.topMount);
  if (!chPool.length) chPool = tierFit(CHASSIS);
  const shapeRank = (s: ChassisShape) => arch.shapes.length - Math.max(0, arch.shapes.indexOf(s));
  let chFit = afford(chPool);
  if (!chFit.length) chFit = afford(tierFit(CHASSIS).filter((c) => !needTop || c.topMount));
  const chassis = best(rng, chFit.length ? chFit : chPool, (c) => c.tier * 10 + shapeRank(c.shape) * 3 + c.hp / 200, spread)!;
  spend(chassis);
  if (!chassis.topMount) {
    if (top) left += cost(top);
    top = null;
  }
  // a robot that cannot get back up is one flip from losing: a team on a
  // budget buys its self-righter before the nice-to-haves
  const rightsItself = chassis.invertible || chassis.rolls || ['flipper', 'lifter'].includes(front?.type ?? '') || ['hammer', 'axe'].includes(top?.type ?? '');
  const srimech = !rightsItself && opts.budget !== undefined ? tierFit(MODULES).find((m) => m.effect === 'selfright' && cost(m) <= left) : undefined;
  spend(srimech);
  const weaponKW = (front?.power ?? 0) + (top?.power ?? 0);
  // drive
  let drPool = tierFit(DRIVES);
  if (arch.styles) {
    const pref = drPool.filter((d) => arch.styles!.includes(d.style));
    if (pref.length && afford(pref).length) drPool = pref;
  }
  const driveScore = (d: (typeof DRIVES)[number]) =>
    d.tier * 6 + (arch.drive === 'fast' ? d.speed * 3 : arch.drive === 'push' ? d.force / 250 + d.grip * 4 : d.speed * 1.5 + d.force / 500) - d.weight * 0.15;
  const drFit = affordRun(drPool, weaponKW + 0.1);
  const drive = best(rng, drFit.length ? drFit : afford(tierFit(DRIVES)), driveScore, spread)!;
  spend(drive);
  // brain: the sharpest the team can field, leaning to quirks that suit the plan
  const brain = best(
    rng,
    affordRun(tierFit(BRAINS), weaponKW + drive.power),
    (b) => b.tier * 10 + (b.trait && arch.traits.includes(b.trait) ? 6 : b.trait ? -4 : 0) - b.power * 1.5,
    spread * 2,
  )!;
  spend(brain);

  const design: BotDesign = {
    id: opts.id ?? `b${Math.floor(rng() * 1e9).toString(36)}`,
    name: opts.name ?? arch.name,
    chassis: chassis.id,
    drive: drive.id,
    core: 'co_lead',
    front: front?.id ?? null,
    top: top?.id ?? null,
    armor: { material: 'ar_alu', front: 0, sides: 0, rear: 0, top: 0 },
    modules: [],
    brain: brain.id,
    power: { drive: 1, front: 1, top: 1, aux: 1, brain: 1 },
    plan: { ...arch.plan },
    paint: opts.paint ?? { primary: '#d9d9d9', secondary: '#333333', pattern: 'plain' },
  };

  // core: enough power for everything, as light as possible; a team that
  // changes its mind about the core trades the old one in
  const rated = () => {
    const r = ratedDraw(design);
    return r.drive + r.front + r.top + r.aux + r.brain;
  };
  let coreSpent = 0;
  const corePool = () => {
    const can = cores.filter((c) => cost(c) <= left + coreSpent);
    return can.length ? can : free(cores);
  };
  const setCore = (c: (typeof CORES)[number]) => {
    left += coreSpent - cost(c);
    coreSpent = cost(c);
    design.core = c.id;
  };
  const pickCore = () => {
    const need = rated() * (1 + arch.weaponBias * 0.15);
    const pool = corePool();
    const enough = pool.filter((c) => c.output >= need * 0.92);
    const c = enough.length
      ? best(rng, enough, (c) => -c.weight + c.output * 0.25 + c.tier, spread * 0.5)
      : best(rng, pool, (c) => c.output - c.weight * 0.1, spread * 0.5);
    setCore(c!);
  };
  pickCore();

  // modules, as weight and money allow; a frame that cannot get back up gets
  // a self-righter
  const modPool = tierFit(MODULES);
  const wanted = [...arch.modules];
  if (!rightsItself && !wanted.includes('selfright') && q >= 0.5) wanted.unshift('selfright');
  if (srimech) design.modules.push(srimech.id);
  for (const eff of wanted) {
    if (design.modules.length >= chassis.modules) break;
    if (eff === 'selfright' && (chassis.invertible || srimech)) continue;
    if (eff === 'gyro' && !(front && front.gyro)) continue;
    const m = modPool.find((p) => p.effect === eff);
    if (!m) continue;
    if (q < 0.6 && rng() < 0.4) continue;
    if (cost(m) > left) continue;
    design.modules.push(m.id);
    if (designWeight(design) > WEIGHT_LIMIT - 12) design.modules.pop();
    else spend(m);
  }
  pickCore();

  // too heavy before armour? shed the top weapon, modules, then use lighter parts
  while (designWeight(design) > WEIGHT_LIMIT) {
    if (design.modules.length) left += cost(moduleOf(design.modules.pop()!));
    else if (design.top && design.front) {
      left += cost(weaponOf(design.top));
      design.top = null;
    } else if (brainOf(design.brain).weight > 1) {
      const light = tierFit(BRAINS).sort((a, b) => a.weight - b.weight)[0];
      left += cost(brainOf(design.brain)) - cost(light);
      design.brain = light.id;
    } else {
      const lighter = corePool().filter((c) => c.weight < coreOf(design.core).weight).sort((a, b) => b.output - a.output)[0];
      if (lighter) setCore(lighter);
      else break;
    }
  }

  // armour: the best material the strategy likes that the team can afford,
  // then plates
  const mats = arch.materials.map((id) => ARMORS.find((a) => a.id === id)!).filter((a) => a && a.tier <= tier && ok(a.id) && cost(a) <= left);
  const material = mats.length ? mats[0] : ARMORS[0];
  spend(material);
  design.armor.material = material.id;
  const zones = (Object.entries(arch.zones) as [ArmorZone, number][]).sort((a, b) => b[1] - a[1]);
  const target: Record<ArmorZone, number> = { front: 0, sides: 0, rear: 0, top: 0 };
  // add plates round-robin weighted by the archetype's priorities
  let guard = 0;
  while (guard++ < 60) {
    let added = false;
    for (const [z, w] of zones) {
      for (let k = 0; k < w; k++) {
        if (target[z] >= MAX_PLATES) continue;
        design.armor[z] = target[z] + 1;
        if (designWeight(design) <= WEIGHT_LIMIT - (q < 0.7 ? rng() * 6 : 0)) {
          target[z]++;
          added = true;
        } else {
          design.armor[z] = target[z];
        }
      }
    }
    if (!added) break;
  }
  Object.assign(design.armor, target);

  design.power = allocate(design, arch.weaponBias);
  return design;
}

/**
 * Share the core between systems: 100% each if it can, spare power spent on
 * overvolting the weapon (or drive), or cuts spread by priority if short,
 * never below what a part needs to run.
 */
export function allocate(d: BotDesign, weaponBias: number, outputOverride?: number): PowerSplit {
  const r = ratedDraw(d);
  const mins = minShares(d);
  const out = outputOverride ?? coreOf(d.core).output;
  const p: PowerSplit = { drive: 1, front: 1, top: 1, aux: 1, brain: 1 };
  const draw = () => powerDraw(d, p);
  const snap = (v: number) => Math.round(v * 20) / 20;
  const up = (v: number) => Math.ceil(v * 20 - 1e-9) / 20;
  let spare = out - draw();
  if (spare >= 0) {
    // overvolt a little with what is left, keeping a margin of cooling for
    // flames and long pushes
    const cooling = coreOf(d.core).cooling * (d.modules.some((m) => moduleOf(m).effect === 'heatsink') ? 1.6 : 1);
    let heatRoom = cooling * 0.6;
    const wKW = r.front + r.top;
    const toW = wKW > 0 ? spare * weaponBias : 0;
    const toD = spare - toW;
    if (wKW > 0) {
      let k = Math.min(MAX_POWER - 1, (toW / wKW) * 0.6);
      k = Math.min(k, heatRoom / (OVERVOLT_HEAT * wKW));
      heatRoom -= k * OVERVOLT_HEAT * wKW;
      if (r.front) p.front = snap(1 + k);
      if (r.top) p.top = snap(1 + k);
    }
    const kd = Math.min(0.15, (toD / r.drive) * 0.5, Math.max(0, heatRoom) / (OVERVOLT_HEAT * r.drive));
    p.drive = snap(Math.min(MAX_POWER, 1 + kd));
  } else {
    // short: cut the less important side first, then everything to its minimum
    const order: PowerKey[] = weaponBias >= 0.5 ? ['aux', 'drive', 'top', 'front', 'brain'] : ['aux', 'top', 'front', 'drive', 'brain'];
    for (const pass of [0, 1]) {
      for (const k of order) {
        if (spare >= 0 || !r[k]) continue;
        const floor = pass === 0 ? Math.max(up(mins[k]), k === 'drive' ? 0.6 : k === 'brain' ? 0.8 : 0.5) : up(mins[k]);
        const cut = Math.max(0, Math.min(p[k] - floor, -spare / r[k]));
        p[k] -= cut;
        spare += cut * r[k];
      }
    }
    for (const k of POWER_KEYS) p[k] = Math.max(up(mins[k]), Math.floor(p[k] * 20 + 1e-6) / 20);
  }
  // never over budget after rounding: trim toward the minimums, and as a last
  // resort switch the top weapon off, then the front
  for (const k of ['drive', 'top', 'front'] as PowerKey[]) {
    while (draw() > out + 1e-9 && r[k] && p[k] - 0.05 >= up(mins[k]) - 1e-9) p[k] = Math.round((p[k] - 0.05) * 20) / 20;
  }
  if (draw() > out + 1e-9 && r.top) p.top = 0;
  if (draw() > out + 1e-9 && r.front) p.front = 0;
  return p;
}

export function randomPaint(rng: Rng): Paint {
  const pairs: Array<[string, string]> = [
    ['#e63946', '#1d1d1d'], ['#ffb703', '#222222'], ['#2a9d8f', '#e9f5f2'], ['#8338ec', '#ffbe0b'],
    ['#3a86ff', '#f1f1f1'], ['#fb5607', '#111111'], ['#06d6a0', '#073b4c'], ['#ef476f', '#ffd166'],
    ['#9d0208', '#ffba08'], ['#4361ee', '#4cc9f0'], ['#f72585', '#3a0ca3'], ['#80b918', '#1b4332'],
    ['#ff7b00', '#2b2d42'], ['#c0c0c0', '#d00000'], ['#264653', '#e9c46a'], ['#ffffff', '#ff006e'],
  ];
  const [primary, secondary] = pick(rng, pairs);
  return { primary, secondary, pattern: pick(rng, ['plain', 'stripes', 'checker', 'flames', 'hazard', 'camo', 'bolt'] as const) };
}

/** Sanity: every part referenced exists (used by tests). */
export function designParts(d: BotDesign): string[] {
  return [d.chassis, d.drive, d.core, d.front, d.top, d.armor.material, ...d.modules].filter((x): x is string => !!x);
}

export const starterParts = ['ch_scrapbox', 'dr_twin', 'co_lead', 'ar_alu'];

export { chassisOf, driveOf, weaponOf, moduleOf };
