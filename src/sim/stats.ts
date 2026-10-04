// Turn a robot design (the parts, the armour plates and the power split) into
// the numbers the fight runs on, and the numbers the garage shows.

import {
  armorOf, brainOf, chassisOf, coreOf, driveOf, levelMult, minPowerOf, moduleOf, weaponOf, WEAPON_FAMILY,
} from '../data/parts.ts';
import type {
  ArmorDef, BattlePlan, BotDesign, BrainDef, BrainTrait, ChassisDef, CoreDef, DmgType, DriveDef, HitZone, ModuleEffect, Paint, PowerSplit, WeaponDef,
} from '../data/types.ts';
import { ARMOR_ZONES, WEIGHT_LIMIT } from '../data/types.ts';

export const G = 9.81;
/** kg per plate level per unit of area at density 1 */
export const ARMOR_KG = 2.0;
/** HP of damage per kJ a spinner delivers */
export const DMG_PER_KJ = 3.6;
/** share of a spinner motor's power that ends up in the weapon */
export const SPIN_EFF = 1.2;
/** heat per second per overvolted kW while a system is working */
export const OVERVOLT_HEAT = 5;

/**
 * Per weapon damage trim, set by the balance runs (tools/tune.ts): each tier
 * is played out strategy against strategy, and the weapons that strategy
 * uses at that tier are trimmed until it wins about half its fights. For
 * flippers and lifters the trim also scales the throw (by its square root).
 */
export const TUNE: Record<string, number> = {
  wp_drum: 1.07, wp_twindrum: 0.84, wp_megadrum: 0.71,
  wp_bar: 0.91, wp_tribar: 1.13, wp_undercutter: 1.23,
  wp_disc: 0.74, wp_egg: 1.09, wp_megadisc: 0.52,
  wp_ring: 1.94, wp_halo: 1.89,
  wp_springflip: 2.97, wp_pneuflip: 1.43, wp_megaflip: 0.74, wp_launcher: 0.64,
  wp_lifter: 5, wp_clamp: 0.55, wp_hydrofork: 0.32,
  wp_sledge: 0.89, wp_pickaxe: 0.66, wp_thwack: 0.68, wp_pulverizer: 0.51, wp_titanhammer: 0.68,
  wp_jaw: 0.78, wp_megajaw: 1.15,
  wp_buzzsaw: 1.21, wp_twinsaw: 2.74, wp_armsaw: 0.68,
  wp_plow: 1.3, wp_forks: 4.31, wp_plough: 2.65,
  wp_spikes: 3.81, wp_lance: 3.49, wp_ramhead: 5, wp_battering: 2.42,
  wp_flame: 0.28, wp_inferno: 0.25,
};
export const trimOf = (w: WeaponDef) => TUNE[w.id] ?? 1;
export const MAX_POWER = 1.3;

export type Levels = (partId: string) => number;
export const LEVEL_ONE: Levels = () => 1;

export interface WeaponStats {
  def: WeaponDef;
  slot: 'front' | 'top';
  level: number;
  /** power share 0..1.3 */
  p: number;
  energyMax: number; // J
  /** damage per kJ delivered (spinners) */
  perKJ: number;
  spinPower: number; // W into the weapon
  reload: number;
  impulse: number;
  damage: number;
  dps: number;
  heat: number;
  fuel: number;
  reach: number;
  arc: number; // radians, half angle
  hold: number;
  stun: number;
  pierce: number;
  ram: number;
  compHp: number;
  overvoltHeat: number;
}

/** What the brain brings to a fight, after upgrades, with its orders. */
export interface Mind {
  /** seconds between decisions at full power */
  reaction: number;
  /** 0..1 steering, lead and weapon timing */
  aim: number;
  /** 0..1 reading the arena */
  awareness: number;
  trait: BrainTrait | null;
  /** the share of its rated draw the power split gives it, and the least it runs on */
  p: number;
  min: number;
  plan: BattlePlan;
}

export interface BotStats {
  design: BotDesign;
  name: string;
  paint: Paint;
  chassis: ChassisDef;
  drive: DriveDef;
  core: CoreDef;
  armor: ArmorDef;
  brain: BrainDef;
  mind: Mind;
  mass: number;
  hpMax: number;
  armorMax: Record<HitZone, number>;
  resist: Record<DmgType, number>;
  shieldMax: number;
  length: number;
  width: number;
  height: number;
  radius: number;
  halfSeg: number;
  inertia: number;
  low: { front: number; sides: number; rear: number };
  /** 0..1 strength of the wedge effect at the front */
  frontWedge: number;
  stability: number;
  invertible: boolean;
  deflect: number;
  driveForce: number;
  driveSpeed: number;
  grip: number;
  turnRate: number;
  turnAccel: number;
  lateral: number;
  strafe: boolean;
  downforce: number;
  output: number;
  draw: number;
  cooling: number;
  volatile: boolean;
  driveHeat: number;
  /** heat per second from an overvolted brain, which never rests */
  brainHeat: number;
  front: WeaponStats | null;
  top: WeaponStats | null;
  compHp: { drive: number; front: number; top: number; core: number };
  /** seconds to self right, 0 if it cannot */
  selfRight: number;
  selfRightBy: 'srimech' | 'flipper' | 'lifter' | 'arm' | 'roll' | null;
  boostMult: number;
  boostCooldown: number;
  thorns: number;
  shock: number;
  gyroDamp: number;
  guard: number;
  coolant: number;
  reactive: number;
  redundant: number;
  effects: Set<ModuleEffect>;
}

function weaponStats(id: string | null, slot: 'front' | 'top', p: number, levels: Levels, targeting: number, topReach: number): WeaponStats | null {
  if (!id) return null;
  const def = weaponOf(id);
  const level = levels(id);
  const m = levelMult(level);
  // below its minimum a powered weapon does not run at all
  const pw = def.power > 0 && p >= minPowerOf(def) - 1e-9 ? p : 0;
  const sq = Math.sqrt(pw);
  const rate = def.power > 0 ? 0.3 + 0.7 * pw : 1;
  const k = trimOf(def);
  const throwK = def.type === 'flipper' || def.type === 'lifter' ? Math.sqrt(k) : 1;
  return {
    def,
    slot,
    level,
    p: pw,
    energyMax: (def.energy ?? 0) * 1000 * m * (0.5 + 0.5 * pw),
    perKJ: DMG_PER_KJ * k,
    spinPower: def.power * 1000 * pw * SPIN_EFF * Math.sqrt(m),
    reload: (def.reload ?? 0) / Math.max(rate, 0.2),
    impulse: (def.impulse ?? 0) * m * sq * throwK,
    damage: (def.damage ?? 0) * m * (def.power > 0 ? sq : 1) * k * 0.82,
    dps: (def.dps ?? 0) * m * (def.power > 0 ? Math.pow(pw, 0.75) : 1) * k * 0.82,
    heat: (def.heat ?? 0) * m * Math.max(sq, 0.5) * k,
    fuel: (def.fuel ?? 0) * m,
    reach: (def.reach + (slot === 'top' ? topReach : 0)) * (1 + targeting * 0.33),
    arc: ((def.arc * (1 + targeting)) * Math.PI) / 180,
    hold: def.hold ?? 0,
    stun: def.stun ?? 0,
    pierce: def.pierce ?? 0,
    ram: (def.ram ?? 0) * m * k,
    compHp: 100 * def.durability * m,
    overvoltHeat: OVERVOLT_HEAT * Math.max(0, pw - 1) * def.power,
  };
}

export function armorWeight(d: BotDesign): number {
  const ch = chassisOf(d.chassis);
  const ar = armorOf(d.armor.material);
  let kg = 0;
  for (const z of ARMOR_ZONES) kg += d.armor[z] * ar.density * ch.area[z] * ARMOR_KG;
  return kg;
}

export function designWeight(d: BotDesign): number {
  let kg = chassisOf(d.chassis).weight + driveOf(d.drive).weight + coreOf(d.core).weight;
  if (d.front) kg += weaponOf(d.front).weight;
  if (d.top) kg += weaponOf(d.top).weight;
  for (const m of d.modules) kg += moduleOf(m).weight;
  kg += brainOf(d.brain).weight;
  return kg + armorWeight(d);
}

/** Rated draw of every powered system, kW */
export function ratedDraw(d: BotDesign) {
  const aux = d.modules.reduce((s, m) => s + (moduleOf(m).power ?? 0), 0);
  return {
    drive: driveOf(d.drive).power,
    front: d.front ? weaponOf(d.front).power : 0,
    top: d.top ? weaponOf(d.top).power : 0,
    aux,
    brain: brainOf(d.brain).power,
  };
}

export type PowerKey = keyof PowerSplit;
export const POWER_KEYS: PowerKey[] = ['drive', 'front', 'top', 'aux', 'brain'];

export function powerDraw(d: BotDesign, split: PowerSplit = d.power): number {
  const r = ratedDraw(d);
  return POWER_KEYS.reduce((sum, k) => sum + r[k] * split[k], 0);
}

/** The least share each system runs on (0 for a system the robot lacks). */
export function minShares(d: BotDesign): PowerSplit {
  const aux = d.modules.reduce((m, id) => Math.max(m, minPowerOf(moduleOf(id))), 0);
  return {
    drive: minPowerOf(driveOf(d.drive)),
    front: d.front ? minPowerOf(weaponOf(d.front)) : 0,
    top: d.top ? minPowerOf(weaponOf(d.top)) : 0,
    aux,
    brain: minPowerOf(brainOf(d.brain)),
  };
}

/** kW needed to keep every system at its minimum (weapons switched off excepted). */
export function minDraw(d: BotDesign): number {
  const r = ratedDraw(d);
  const m = minShares(d);
  return r.drive * m.drive + r.aux * m.aux + r.brain * m.brain + (d.power.front > 0 ? r.front * m.front : 0) + (d.power.top > 0 ? r.top * m.top : 0);
}

export function coreOutput(d: BotDesign, levels: Levels = LEVEL_ONE): number {
  return coreOf(d.core).output * levelMult(levels(d.core));
}

/**
 * Give every system as close to 100% as the core allows, scaling evenly, but
 * never below the share it needs to run.
 */
export function autoPower(d: BotDesign, levels: Levels = LEVEL_ONE): PowerSplit {
  const r = ratedDraw(d);
  const out = coreOutput(d, levels);
  const mins = minShares(d);
  const total = POWER_KEYS.reduce((sum, k) => sum + r[k], 0);
  const k = total > 0 ? Math.min(1, out / total) : 1;
  const snap = (v: number) => Math.floor(v * 20) / 20;
  const up = (v: number) => Math.ceil(v * 20 - 1e-9) / 20;
  const p = {} as PowerSplit;
  for (const key of POWER_KEYS) p[key] = r[key] ? Math.max(up(mins[key]), snap(k)) : 1;
  // the minimums may push the total over: take it back from the weapons, then the rest
  const draw = () => POWER_KEYS.reduce((sum, key) => sum + r[key] * p[key], 0);
  for (const key of ['top', 'front', 'aux', 'drive', 'brain'] as PowerKey[]) {
    while (draw() > out + 1e-9 && r[key] && p[key] - 0.05 >= up(mins[key]) - 1e-9) p[key] = Math.round((p[key] - 0.05) * 20) / 20;
  }
  // still too much even at the minimums: switch the weapons and modules off, top first
  for (const key of ['top', 'aux', 'front'] as PowerKey[]) if (draw() > out + 1e-9 && r[key]) p[key] = 0;
  return p;
}

export function computeStats(d: BotDesign, levels: Levels = LEVEL_ONE): BotStats {
  const chassis = chassisOf(d.chassis);
  const drive = driveOf(d.drive);
  const core = coreOf(d.core);
  const armor = armorOf(d.armor.material);
  const effects = new Set<ModuleEffect>(d.modules.map((m) => moduleOf(m).effect));
  const modVal = (e: ModuleEffect) => {
    const id = d.modules.find((m) => moduleOf(m).effect === e);
    return id ? (moduleOf(id).value ?? 0) * (e === 'ablative' || e === 'thorns' ? levelMult(levels(id)) : 1) : 0;
  };

  const mass = designWeight(d);
  const chM = levelMult(levels(d.chassis));
  const arM = levelMult(levels(d.armor.material));
  const drM = levelMult(levels(d.drive));
  const coM = levelMult(levels(d.core));

  const targeting = modVal('targeting');
  const front = weaponStats(d.front, 'front', d.power.front, levels, targeting, 0);
  const top = weaponStats(d.top, 'top', d.power.top, levels, targeting, chassis.topReach ?? 0);

  const sideArmor = d.armor.sides * armor.hpPerLevel * arM * DMG_SCALE;
  const armorMax: Record<HitZone, number> = {
    front: d.armor.front * armor.hpPerLevel * arM * DMG_SCALE,
    left: sideArmor,
    right: sideArmor,
    rear: d.armor.rear * armor.hpPerLevel * arM * DMG_SCALE,
    top: d.armor.top * armor.hpPerLevel * arM * DMG_SCALE,
  };
  const resist = { ...armor.resist };
  for (const k of Object.keys(resist) as DmgType[]) resist[k] = Math.min(0.9, resist[k] + 0.01 * (levels(d.armor.material) - 1));

  // How low each edge sits, after weapons and modules.
  let lowFront = chassis.low.front;
  if (front?.def.lip) lowFront = Math.max(lowFront, front.def.lip);
  if (effects.has('wedgelets')) lowFront = Math.max(lowFront, modVal('wedgelets'));
  if (front?.def.type === 'ring') lowFront = Math.min(lowFront, 0.35);
  const low = {
    front: lowFront,
    sides: Math.min(0.85, chassis.low.sides + modVal('skirts')),
    rear: Math.min(0.85, chassis.low.rear + modVal('skirts') * 0.5),
  };
  const frontWedge = Math.max(0, Math.min(1, (lowFront - 0.4) / 0.5)) * (front && ['hspin', 'vspin', 'ring', 'saw'].includes(front.def.type) ? 0.6 : 1);

  const pD = Math.max(minPowerOf(drive), d.power.drive);
  const massK = Math.pow(85 / Math.max(mass, 30), 0.22);
  const driveForce = drive.force * drM * Math.sqrt(pD);
  const driveSpeed = drive.speed * (1 + 0.03 * (levels(d.drive) - 1)) * Math.sqrt(pD) * massK;
  const turnRate = drive.turn * Math.sqrt(pD) * Math.pow(90 / Math.max(mass, 30), 0.3);
  const turnAccel = turnRate * 7 * Math.pow(90 / Math.max(mass, 30), 0.4);

  const radius = chassis.width / 2;
  const halfSeg = Math.max(0, chassis.length / 2 - radius);
  const inertia = (mass * (chassis.length ** 2 + chassis.width ** 2)) / 12;

  let selfRight = 0;
  let selfRightBy: BotStats['selfRightBy'] = null;
  if (!chassis.invertible) {
    if (effects.has('selfright')) {
      selfRight = modVal('selfright');
      selfRightBy = 'srimech';
    } else if (front?.def.type === 'flipper') {
      selfRight = 0.6;
      selfRightBy = 'flipper';
    } else if (front?.def.type === 'lifter') {
      selfRight = 1.3;
      selfRightBy = 'lifter';
    } else if (top && (top.def.type === 'hammer' || top.def.type === 'axe')) {
      selfRight = 1.6;
      selfRightBy = 'arm';
    } else if (chassis.rolls) {
      selfRight = 2.4;
      selfRightBy = 'roll';
    }
  }

  const brain = brainOf(d.brain);
  const brL = levels(d.brain);
  const mind: Mind = {
    reaction: brain.reaction / levelMult(brL),
    aim: Math.min(0.99, brain.aim + 0.02 * (brL - 1)),
    awareness: Math.min(0.99, brain.awareness + 0.02 * (brL - 1)),
    trait: brain.trait ?? null,
    p: d.power.brain,
    min: brain.minPower,
    plan: d.plan,
  };

  const cap = effects.has('capacitor');
  const draw = powerDraw(d);
  return {
    design: d,
    name: d.name,
    paint: d.paint,
    chassis,
    drive,
    core,
    armor,
    brain,
    mind,
    mass,
    hpMax: chassis.hp * chM * DMG_SCALE,
    armorMax,
    resist,
    shieldMax: modVal('ablative') * DMG_SCALE,
    length: chassis.length,
    width: chassis.width,
    height: chassis.height,
    radius,
    halfSeg,
    inertia,
    low,
    frontWedge,
    stability: Math.min(0.97, chassis.stability + (effects.has('magnets') ? 0.25 : 0) + (effects.has('gyro') ? 0.12 : 0)),
    invertible: chassis.invertible,
    deflect: chassis.deflect ?? 0,
    driveForce,
    driveSpeed,
    grip: drive.grip,
    turnRate,
    turnAccel,
    lateral: drive.lateral,
    strafe: !!drive.strafe,
    downforce: effects.has('magnets') ? modVal('magnets') * Math.sqrt(Math.max(0, d.power.aux)) : 0,
    output: core.output * coM,
    draw,
    cooling: core.cooling * (1 + modVal('heatsink')) * (1 + 0.05 * (levels(d.core) - 1)),
    volatile: !!core.volatile,
    driveHeat: OVERVOLT_HEAT * Math.max(0, d.power.drive - 1) * drive.power,
    brainHeat: OVERVOLT_HEAT * Math.max(0, d.power.brain - 1) * brain.power,
    front,
    top,
    compHp: {
      drive: 100 * drive.durability * drM * DMG_SCALE,
      front: (front?.compHp ?? 0) * DMG_SCALE,
      top: (top?.compHp ?? 0) * DMG_SCALE,
      core: 100 * core.durability * coM * DMG_SCALE,
    },
    selfRight,
    selfRightBy,
    boostMult: cap ? 0.7 : 0.35,
    boostCooldown: cap ? 5 : 7,
    thorns: modVal('thorns'),
    shock: modVal('shock'),
    gyroDamp: modVal('gyro'),
    guard: modVal('guard'),
    coolant: modVal('coolant'),
    reactive: modVal('reactive'),
    redundant: modVal('redundant'),
    effects,
  };
}

// ---- checks ----------------------------------------------------------------

export interface DesignIssue {
  level: 'error' | 'warn';
  text: string;
}

export function validate(d: BotDesign, levels: Levels = LEVEL_ONE): DesignIssue[] {
  const out: DesignIssue[] = [];
  const ch = chassisOf(d.chassis);
  const kg = designWeight(d);
  if (kg > WEIGHT_LIMIT + 1e-6) out.push({ level: 'error', text: `Overweight: ${kg.toFixed(1)} of ${WEIGHT_LIMIT} kg` });
  const draw = powerDraw(d);
  const output = coreOutput(d, levels);
  const mins = minShares(d);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const least = minDraw(d);
  if (least > output + 1e-6) out.push({ level: 'error', text: `This core cannot keep it all running: even at their minimum the parts need ${least.toFixed(1)} of ${output.toFixed(1)} kW` });
  if (draw > output + 1e-6) out.push({ level: 'error', text: `Power overload: ${draw.toFixed(1)} of ${output.toFixed(1)} kW` });
  if (d.power.drive < mins.drive - 1e-9) out.push({ level: 'error', text: `The drive needs at least ${pct(mins.drive)} power to move` });
  if (d.power.brain < mins.brain - 1e-9) out.push({ level: 'warn', text: `The brain is starved: below ${pct(mins.brain)} it keeps rebooting mid-fight` });
  for (const slot of ['front', 'top'] as const) {
    const id = d[slot];
    if (id && weaponOf(id).power > 0 && d.power[slot] > 0 && d.power[slot] < mins[slot] - 1e-9) {
      out.push({ level: 'warn', text: `${weaponOf(id).name} needs ${pct(mins[slot])} to run: as it is, it is switched off` });
    }
  }
  if (d.modules.length > ch.modules) out.push({ level: 'error', text: `Only ${ch.modules} module bays on this frame` });
  if (d.top && !ch.topMount) out.push({ level: 'error', text: 'This frame has no top mount' });
  if (d.front && weaponOf(d.front).mount === 'full' && d.top) out.push({ level: 'error', text: 'A ring spinner takes the top mount too' });
  if (d.front && weaponOf(d.front).mount === 'top') out.push({ level: 'error', text: 'That weapon goes on the top mount' });
  if (d.top && weaponOf(d.top).mount !== 'top') out.push({ level: 'error', text: 'That weapon goes on the front' });
  if (!d.front && !d.top) out.push({ level: 'warn', text: 'No weapon: you can only push' });
  for (const slot of ['front', 'top'] as const) {
    const id = d[slot];
    if (id && weaponOf(id).power > 0 && d.power[slot] <= 0) out.push({ level: 'warn', text: `${weaponOf(id).name} is switched off: give it power in the Power tab` });
  }
  if (!ch.invertible && !computeStats(d, levels).selfRight) out.push({ level: 'warn', text: 'Cannot self-right: one good flip and you are counted out' });
  const s = computeStats(d, levels);
  const heatRate = s.driveHeat + s.brainHeat + (s.front?.overvoltHeat ?? 0) + (s.top?.overvoltHeat ?? 0);
  if (heatRate > s.cooling) out.push({ level: 'warn', text: 'Overvolted: runs hot, may overheat in a long fight' });
  return out;
}

export const isLegal = (d: BotDesign, levels?: Levels) => !validate(d, levels).some((i) => i.level === 'error');

// ---- numbers for the garage -------------------------------------------------

export interface Readout {
  weight: number;
  draw: number;
  output: number;
  topSpeed: number; // m/s
  accel: number; // seconds to 3 m/s
  push: number; // N
  turn: number; // deg/s
  hp: number;
  armorAvg: number;
  hitDamage: number; // damage of a typical main weapon hit
  hitEvery: number; // seconds between hits, roughly
  dpsEstimate: number;
  heatRate: number; // net heat per second when everything works flat out
  label: string;
  brain: string;
  /** seconds per decision, aim and awareness at this power */
  reaction: number;
  aim: number;
  awareness: number;
  brownout: boolean;
}

/**
 * The mind at a given power: e is the share of its rated draw actually
 * reaching the brain (the split, less what core damage and overheating take).
 * Starved below its minimum it browns out; overvolted it thinks faster.
 */
export function mindAt(m: Mind, e: number) {
  const f = e <= 1 ? Math.pow(Math.max(e, 0.05), 0.6) : 1 + ((e - 1) / 0.3) * 0.2;
  return {
    brownout: e < m.min - 1e-9,
    reaction: m.reaction / Math.max(0.2, f),
    aim: m.aim * (0.82 + 0.18 * Math.min(1, e)),
    awareness: m.awareness,
  };
}

export function readout(d: BotDesign, levels: Levels = LEVEL_ONE): Readout {
  const s = computeStats(d, levels);
  const traction = s.grip * G * s.mass * (1 + s.downforce);
  // Time to reach 3 m/s with the motor curve and traction limit.
  let v = 0;
  let t = 0;
  const target = Math.min(3, s.driveSpeed * 0.95);
  while (v < target && t < 10) {
    const f = Math.min(traction, s.driveForce * (1 - v / s.driveSpeed)) - 0.04 * s.mass * G;
    v += (f / s.mass) * 0.01;
    t += 0.01;
  }
  const main = s.front && s.front.def.type !== 'wedge' ? s.front : s.top ?? s.front;
  let hitDamage = 0;
  let hitEvery = 0;
  if (main) {
    const w = main.def;
    switch (w.type) {
      case 'vspin':
      case 'drum':
      case 'hspin':
      case 'ring': {
        const e = main.energyMax * (w.bite ?? 0.5);
        hitDamage = (e / 1000) * main.perKJ;
        hitEvery = main.spinPower > 0 ? e / main.spinPower + 1 : 99;
        break;
      }
      case 'hammer':
      case 'axe':
        hitDamage = main.damage;
        hitEvery = main.reload + 0.8;
        break;
      case 'crusher':
        hitDamage = main.damage + main.dps * main.hold * 0.7;
        hitEvery = main.reload + main.hold + 1;
        break;
      case 'flipper':
      case 'lifter':
        hitDamage = main.damage;
        hitEvery = main.reload + 0.8;
        break;
      case 'saw':
      case 'flame':
        hitDamage = main.dps;
        hitEvery = 1;
        break;
      case 'ram':
        hitDamage = ramDamage(s.mass, Math.min(s.driveSpeed, 4), main.ram);
        hitEvery = 2.5;
        break;
      case 'wedge':
        hitDamage = 0;
        hitEvery = 0;
        break;
    }
  }
  const armorTotal = (['front', 'left', 'right', 'rear', 'top'] as HitZone[]).reduce((a, z) => a + s.armorMax[z], 0);
  const heatRate = s.driveHeat + s.brainHeat + (s.front?.overvoltHeat ?? 0) + (s.top?.overvoltHeat ?? 0) - s.cooling;
  const mind = mindAt(s.mind, s.mind.p);
  return {
    weight: s.mass,
    draw: s.draw,
    output: s.output,
    topSpeed: s.driveSpeed,
    accel: t,
    push: Math.min(s.driveForce, traction),
    turn: (s.turnRate * 180) / Math.PI,
    hp: s.hpMax,
    armorAvg: armorTotal / 5,
    hitDamage: hitDamage * DMG_SCALE,
    hitEvery,
    dpsEstimate: hitEvery > 0 ? (hitDamage * DMG_SCALE) / hitEvery : 0,
    heatRate,
    label: archetypeLabel(d),
    brain: s.brain.name,
    reaction: mind.reaction,
    aim: mind.aim,
    awareness: mind.awareness,
    brownout: mind.brownout,
  };
}

/** Damage of a 100 kg ram hitting at 3 m/s with ram factor 1 */
export const RAM_K = 20;

/** How hard a ram lands: grows faster than speed, scales with mass. */
export const ramDamage = (mass: number, closing: number, ram: number) => ram * RAM_K * Math.pow(Math.min(5, Math.max(0, closing)) / 3, 1.5) * (mass / 100);

/**
 * Hit points and damage are both shown at this scale: it changes no outcome,
 * only how big the numbers read.
 */
export const DMG_SCALE = 2.5;

export function archetypeLabel(d: BotDesign): string {
  const f = d.front ? weaponOf(d.front) : null;
  const t = d.top ? weaponOf(d.top) : null;
  const names: string[] = [];
  if (f) names.push(WEAPON_FAMILY[f.type]);
  if (t) names.push(WEAPON_FAMILY[t.type]);
  if (!names.length) return 'Pusher';
  if (names.length === 2 && f && f.type === 'wedge') return `${WEAPON_FAMILY[t!.type]} + wedge`;
  return names.join(' + ');
}

/** What a weapon does at full power, level 1, in the numbers a fight shows. */
export function weaponSpecs(w: WeaponDef): Array<[string, string]> {
  const k = trimOf(w) * DMG_SCALE;
  const out: Array<[string, string]> = [];
  if (w.energy) out.push(['spinner', `hit ${Math.round(w.energy * (w.bite ?? 0.5) * DMG_PER_KJ * k)}`]);
  if (w.damage) out.push(['target', `${Math.round(w.damage * (w.type === 'flipper' || w.type === 'lifter' ? 1 : 0.82) * k)} dmg`]);
  if (w.dps) out.push(['saw', `${Math.round(w.dps * 0.82 * k)}/s`]);
  if (w.ram) out.push(['ram', `ram ${Math.round(ramDamage(100, 3, w.ram) * k)}`]);
  return out;
}

/** Hit points of a frame and plates as a fight counts them. */
export const scaledHp = (hp: number) => Math.round(hp * DMG_SCALE);
