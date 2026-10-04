// The fight. A fixed-step 2.5D simulation: robots are capsules sliding on the
// arena floor with a height, a vertical speed and a tumble for flips.
// Everything the screen, the sound and the commentary need comes out as
// events. The same code runs headless for AI-vs-AI fights and balance tests.

import type { ArenaDef } from '../data/arenas.ts';
import type { DmgType, HitZone, WeaponType, Wear } from '../data/types.ts';
import { ZONES } from '../data/types.ts';
import { mulberry32, type Rng } from './rng.ts';
import { DMG_SCALE, G, ramDamage, type BotStats, type WeaponStats } from './stats.ts';

export const DT = 1 / 120;
export const FIGHT_TIME = 90;
export const COUNT_OUT = 10;
const KNOCK = 0.6;
/** a hit at least this big gets the sparks, the shake and the crowd */
export const BIG_HIT = 60;
const TAU = Math.PI * 2;

export interface Controls {
  throttle: number; // -1..1
  turn: number; // -1..1, positive = counter-clockwise
  strafe: number; // -1..1, positive = to the right (mecanum only)
  fire: boolean;
  fireTop: boolean;
  boost: boolean;
}

export interface WeaponState {
  w: WeaponStats;
  energy: number;
  reload: number;
  /** pose 0 (rest) .. 1 (fully fired), for the renderer */
  anim: number;
  strikeT: number;
  windup: number;
  holding: boolean;
  holdT: number;
  fuel: number;
  firing: boolean;
  hitCd: number;
  spin: number;
  sparkT: number;
}

export type CompKey = 'drive' | 'front' | 'top' | 'core';

export interface Bot {
  idx: number;
  s: BotStats;
  x: number;
  y: number;
  th: number;
  vx: number;
  vy: number;
  w: number;
  z: number;
  vz: number;
  airborne: boolean;
  /** tumble angle: 0 upright, PI upside down */
  flip: number;
  flipVel: number;
  flipAxis: 'roll' | 'pitch';
  inverted: boolean;
  /** visual tilt when wedged or lifted, radians nose-up */
  tilt: number;
  /** thrown by the other robot: dazed for a moment on landing */
  thrown: boolean;
  hp: number;
  armor: Record<HitZone, number>;
  shield: number;
  comp: Record<CompKey, number>;
  heat: number;
  overheated: boolean;
  burning: number;
  front: WeaponState | null;
  top: WeaponState | null;
  stun: number;
  wedged: number;
  wedgeK: number;
  liftedBy: number;
  heldBy: number;
  boostT: number;
  boostCd: number;
  selfRightT: number;
  immobileT: number;
  countShown: number;
  inPit: boolean;
  pitT: number;
  ko: false | 'destroyed' | 'countout' | 'pit';
  ctl: Controls;
  auto: boolean;
  speed: number;
  // cooldowns
  ramCd: number;
  thornsCd: number;
  wallCd: number;
  coolantCd: number;
  reactiveCd: number;
  hazardCd: number;
  hammerZoneT: number;
  lastTouchBy: number;
  lastTouchT: number;
  // scoring
  dmgDealt: number;
  dmgTaken: number;
  aggression: number;
  control: number;
  hits: number;
  bigHits: number;
  flips: number;
  biggestHit: number;
}

export type HitKind = WeaponType | 'hazard' | 'land' | 'thorns' | 'wall' | 'fire';

export type SimEvent =
  | { type: 'hit'; x: number; y: number; z: number; by: number; to: number; dmg: number; kind: HitKind; big: boolean; zone: HitZone; nx: number; ny: number }
  | { type: 'clash'; x: number; y: number; z: number; a: number; b: number }
  | { type: 'sparks'; x: number; y: number; z: number; n: number; nx: number; ny: number; hot?: boolean }
  | { type: 'flip'; bot: number; by: number; height: number }
  | { type: 'land'; bot: number; inverted: boolean; impact: number; x: number; y: number }
  | { type: 'fire'; bot: number; slot: 'front' | 'top'; weapon: WeaponType; miss?: boolean; x: number; y: number }
  | { type: 'grab'; bot: number; by: number }
  | { type: 'release'; bot: number; by: number }
  | { type: 'selfright'; bot: number }
  | { type: 'pitopen' }
  | { type: 'pitfall'; bot: number; by: number }
  | { type: 'overheat'; bot: number }
  | { type: 'ablaze'; bot: number }
  | { type: 'count'; bot: number; n: number }
  | { type: 'ko'; bot: number; method: 'destroyed' | 'countout' | 'pit' }
  | { type: 'compdown'; bot: number; comp: CompKey }
  | { type: 'armorbreak'; bot: number; zone: HitZone }
  | { type: 'wall'; bot: number; speed: number; x: number; y: number }
  | { type: 'hazard'; kind: 'saw' | 'hammer' | 'flame' | 'spikes'; x: number; y: number; bot: number }
  | { type: 'boost'; bot: number }
  | { type: 'time' };

export interface JudgeCard {
  damage: [number, number];
  aggression: [number, number];
  control: [number, number];
}

export interface FightResult {
  winner: number | null;
  method: 'KO' | 'countout' | 'pit' | 'decision' | 'forfeit';
  time: number;
  judges?: { cards: JudgeCard[]; votes: [number, number] };
  stats: Array<{ dmgDealt: number; dmgTaken: number; hits: number; bigHits: number; flips: number; aggression: number; control: number; biggestHit: number }>;
  wear: [Wear, Wear];
}

const wrap = (a: number) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// scratch results, so the inner loops do not allocate
let QX = 0;
// contact point of the last successful inZone() test
let ZX = 0;
let ZY = 0;
let QY = 0;
function closestOnSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 1e-9 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  QX = ax + dx * t;
  QY = ay + dy * t;
}

let C1X = 0;
let C1Y = 0;
let C2X = 0;
let C2Y = 0;
function closestSegSeg(p1x: number, p1y: number, q1x: number, q1y: number, p2x: number, p2y: number, q2x: number, q2y: number) {
  const d1x = q1x - p1x;
  const d1y = q1y - p1y;
  const d2x = q2x - p2x;
  const d2y = q2y - p2y;
  const rx = p1x - p2x;
  const ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y;
  const e = d2x * d2x + d2y * d2y;
  const f = d2x * rx + d2y * ry;
  let s = 0;
  let t = 0;
  if (a <= 1e-9 && e <= 1e-9) {
    s = t = 0;
  } else if (a <= 1e-9) {
    s = 0;
    t = clamp(f / e, 0, 1);
  } else {
    const c = d1x * rx + d1y * ry;
    if (e <= 1e-9) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = d1x * d2x + d1y * d2y;
      const denom = a * e - b * b;
      s = denom > 1e-9 ? clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }
  C1X = p1x + d1x * s;
  C1Y = p1y + d1y * s;
  C2X = p2x + d2x * t;
  C2Y = p2y + d2y * t;
}

function newWeapon(w: WeaponStats | null, compFrac: number): WeaponState | null {
  if (!w) return null;
  return {
    w,
    energy: 0,
    reload: 0.5,
    anim: 0,
    strikeT: -1,
    windup: -1,
    holding: false,
    holdT: 0,
    fuel: w.fuel * Math.max(0.3, compFrac),
    firing: false,
    hitCd: 0,
    spin: 0,
    sparkT: 0,
  };
}

const FULL_WEAR: Wear = {
  hp: 1,
  armor: { front: 1, left: 1, right: 1, rear: 1, top: 1 },
  comp: { drive: 1, front: 1, top: 1, core: 1 },
  shield: 1,
};

export function freshWear(): Wear {
  return JSON.parse(JSON.stringify(FULL_WEAR));
}

function makeBot(idx: number, s: BotStats, x: number, y: number, th: number, wear: Wear = FULL_WEAR): Bot {
  const armor = {} as Record<HitZone, number>;
  for (const z of ZONES) armor[z] = s.armorMax[z] * clamp(wear.armor[z], 0, 1);
  return {
    idx,
    s,
    x,
    y,
    th,
    vx: 0,
    vy: 0,
    w: 0,
    z: 0,
    vz: 0,
    airborne: false,
    flip: 0,
    flipVel: 0,
    flipAxis: 'roll',
    inverted: false,
    tilt: 0,
    thrown: false,
    hp: s.hpMax * clamp(wear.hp, 0.05, 1),
    armor,
    shield: s.shieldMax * clamp(wear.shield, 0, 1),
    comp: {
      drive: s.compHp.drive * clamp(wear.comp.drive, 0.1, 1),
      front: s.compHp.front * clamp(wear.comp.front, 0.1, 1),
      top: s.compHp.top * clamp(wear.comp.top, 0.1, 1),
      core: s.compHp.core * clamp(wear.comp.core, 0.1, 1),
    },
    heat: 0,
    overheated: false,
    burning: 0,
    front: newWeapon(s.front, wear.comp.front),
    top: newWeapon(s.top, wear.comp.top),
    stun: 0,
    wedged: 0,
    wedgeK: 0,
    liftedBy: -1,
    heldBy: -1,
    boostT: 0,
    boostCd: 0,
    selfRightT: -1,
    immobileT: 0,
    countShown: 0,
    inPit: false,
    pitT: 0,
    ko: false,
    ctl: { throttle: 0, turn: 0, strafe: 0, fire: false, fireTop: false, boost: false },
    auto: true,
    speed: 0,
    ramCd: 0,
    thornsCd: 0,
    wallCd: 0,
    coolantCd: 0,
    reactiveCd: 0,
    hazardCd: 0,
    hammerZoneT: 0,
    lastTouchBy: -1,
    lastTouchT: -99,
    dmgDealt: 0,
    dmgTaken: 0,
    aggression: 0,
    control: 0,
    hits: 0,
    bigHits: 0,
    flips: 0,
    biggestHit: 0,
  };
}

export interface WorldOptions {
  seed?: number;
  wear?: [Wear | undefined, Wear | undefined];
  duration?: number;
}

export class World {
  readonly arena: ArenaDef;
  readonly half: number;
  readonly bots: [Bot, Bot];
  readonly rng: Rng;
  readonly duration: number;
  t = 0;
  events: SimEvent[] = [];
  pitOpen = false;
  over = false;
  result: FightResult | null = null;
  /** hazard hammer: time since it last struck */
  hammerCd = 0;
  hammerAnim = 0;
  /** keep events off for headless runs */
  quiet = false;

  constructor(a: BotStats, b: BotStats, arena: ArenaDef, opts: WorldOptions = {}) {
    this.arena = arena;
    this.half = arena.size / 2;
    this.rng = mulberry32(opts.seed ?? 1);
    this.duration = opts.duration ?? FIGHT_TIME;
    const sy = this.half - 1.4;
    this.bots = [
      makeBot(0, a, -0.6, -sy, Math.PI / 2, opts.wear?.[0]),
      makeBot(1, b, 0.6, sy, -Math.PI / 2, opts.wear?.[1]),
    ];
  }

  emit(e: SimEvent) {
    if (!this.quiet) this.events.push(e);
  }

  get timeLeft() {
    return Math.max(0, this.duration - this.t);
  }

  // ---- queries -------------------------------------------------------------

  /** Can this robot drive right now? */
  mobile(b: Bot): boolean {
    return !b.ko && !b.airborne && !b.inPit && (!b.inverted || b.s.invertible) && b.liftedBy < 0 && b.heldBy < 0 && b.stun <= 0 && this.driveFactor(b) > 0 && b.comp.core > 0;
  }

  driveFactor(b: Bot): number {
    const f = b.s.compHp.drive > 0 ? b.comp.drive / b.s.compHp.drive : 0;
    if (b.s.redundant) return Math.max(b.s.redundant, f);
    return f <= 0 ? 0 : 0.35 + 0.65 * f;
  }

  coreFactor(b: Bot): number {
    const f = b.s.compHp.core > 0 ? b.comp.core / b.s.compHp.core : 0;
    return f <= 0 ? 0 : 0.45 + 0.55 * f;
  }

  weaponFactor(b: Bot, ws: WeaponState): number {
    const max = ws.w.slot === 'front' ? b.s.compHp.front : b.s.compHp.top;
    const cur = ws.w.slot === 'front' ? b.comp.front : b.comp.top;
    const f = max > 0 ? cur / max : 0;
    return f <= 0 ? 0 : 0.35 + 0.65 * f;
  }

  powerScale(b: Bot): number {
    return (b.overheated ? 0.5 : 1) * this.coreFactor(b);
  }

  weaponsUsable(b: Bot): boolean {
    return !b.ko && !b.inPit && (!b.inverted || b.s.invertible) && b.stun <= 0 && b.comp.core > 0;
  }

  /** Where on `b` a blow coming from point (px, py) lands. */
  zoneFrom(b: Bot, px: number, py: number): HitZone {
    const a = wrap(Math.atan2(py - b.y, px - b.x) - b.th);
    const aa = Math.abs(a);
    if (aa <= Math.PI / 4) return 'front';
    if (aa >= (3 * Math.PI) / 4) return 'rear';
    return a > 0 ? 'left' : 'right';
  }

  /** Is `t` inside the striking zone of weapon `ws` on `a`? Fills ZX, ZY with the contact point. */
  inZone(a: Bot, t: Bot, ws: WeaponState, slack = 0): boolean {
    const w = ws.w;
    const type = w.def.type;
    const cx = Math.cos(t.th) * t.s.halfSeg;
    const cy = Math.sin(t.th) * t.s.halfSeg;
    closestOnSeg(a.x, a.y, t.x - cx, t.y - cy, t.x + cx, t.y + cy);
    const dx = QX - a.x;
    const dy = QY - a.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const surf = d - t.s.radius;
    const R = (type === 'ring' ? Math.max(a.s.length, a.s.width) / 2 : a.s.length / 2) + w.reach + 0.04 + slack;
    if (surf > R) return false;
    if (type !== 'ring') {
      const ang = Math.abs(wrap(Math.atan2(dy, dx) - a.th));
      const tol = Math.asin(Math.min(1, t.s.radius / Math.max(d, t.s.radius))) * 0.55;
      if (ang > w.arc + tol + slack) return false;
    }
    ZX = QX - (dx / d) * t.s.radius;
    ZY = QY - (dy / d) * t.s.radius;
    return true;
  }

  // ---- the step ------------------------------------------------------------

  step() {
    const dt = DT;
    this.t += dt;
    const [A, B] = this.bots;
    const ended = this.over;

    // Pit opening.
    const pit = this.arena.pit;
    if (pit && !this.pitOpen && this.t >= pit.opensAt) {
      this.pitOpen = true;
      this.emit({ type: 'pitopen' });
    }

    for (const b of this.bots) this.updateStatus(b, dt);
    for (const b of this.bots) this.drive(b, dt);
    if (!ended) {
      this.weapons(A, B, dt);
      this.weapons(B, A, dt);
    }
    this.collide(A, B);
    for (const b of this.bots) this.integrate(b, dt);
    for (const b of this.bots) this.walls(b);
    this.carry(A, B);
    this.carry(B, A);
    if (!ended) {
      this.hazards(dt);
      this.score(A, B, dt);
      this.score(B, A, dt);
      this.checkEnd();
    }
  }

  private updateStatus(b: Bot, dt: number) {
    b.stun = Math.max(0, b.stun - dt);
    b.wedged = Math.max(0, b.wedged - dt);
    b.boostT = Math.max(0, b.boostT - dt);
    b.boostCd = Math.max(0, b.boostCd - dt);
    b.ramCd -= dt;
    b.thornsCd -= dt;
    b.wallCd -= dt;
    b.coolantCd -= dt;
    b.reactiveCd -= dt;
    b.hazardCd -= dt;
    if (b.wedged <= 0) b.wedgeK = 0;

    // heat: overvolted systems at work, cooling, flames
    const working = Math.min(1, Math.abs(b.ctl.throttle) + Math.abs(b.ctl.turn) * 0.5);
    let heat = b.s.driveHeat * working;
    for (const ws of [b.front, b.top]) {
      if (!ws) continue;
      const busy = ws.w.def.energy ? ws.energy < ws.w.energyMax * 0.98 : ws.reload > 0 || ws.firing || ws.holding;
      if (busy) heat += ws.w.overvoltHeat;
    }
    if (b.boostT > 0) heat += 9;
    b.heat += (heat - b.s.cooling) * dt;
    if (b.burning > 0) {
      b.burning -= dt;
      b.heat += 10 * dt;
      this.damage(b, 4 * dt, 'thermal', 'top', -1, { quiet: true });
    }
    b.heat = clamp(b.heat, 0, 150);
    if (b.s.coolant && b.heat > 90 && b.coolantCd <= 0) {
      b.heat -= b.s.coolant;
      b.coolantCd = 15;
    }
    if (!b.overheated && b.heat >= 100) {
      b.overheated = true;
      this.emit({ type: 'overheat', bot: b.idx });
    } else if (b.overheated && b.heat < 55) {
      b.overheated = false;
    }
    if (b.heat > 100) this.damage(b, 5 * dt, 'thermal', 'top', -1, { quiet: true, internal: true });

    // boost
    if (b.ctl.boost && b.boostCd <= 0 && this.mobile(b)) {
      b.boostT = 2;
      b.boostCd = b.s.boostCooldown + 2;
      this.emit({ type: 'boost', bot: b.idx });
    }

    // self-righting
    if (b.inverted && !b.s.invertible && !b.airborne && !b.ko && !b.inPit && b.liftedBy < 0 && b.heldBy < 0) {
      if (b.selfRightT < 0 && b.s.selfRight > 0) {
        const usable = b.s.selfRightBy === 'flipper' ? (b.front && b.comp.front > 0 ? 1 : 0) : b.s.selfRightBy === 'lifter' ? (b.comp.front > 0 ? 1 : 0) : b.s.selfRightBy === 'arm' ? (b.comp.top > 0 ? 1 : 0) : 1;
        if (usable && b.comp.core > 0) b.selfRightT = b.s.selfRight;
      }
      if (b.selfRightT >= 0) {
        b.selfRightT -= dt;
        if (b.selfRightT < 0 && (b.s.selfRightBy !== 'flipper' || (b.front && b.front.reload <= 0))) {
          this.launch(b, 2.6, false, 'roll', this.rng() < 0.5 ? 1 : -1, 0);
          if (b.front && b.s.selfRightBy === 'flipper') {
            b.front.reload = b.front.w.reload;
            b.front.anim = 1;
          }
          this.emit({ type: 'selfright', bot: b.idx });
        } else if (b.selfRightT < 0) {
          b.selfRightT = 0.05;
        }
      }
    } else {
      b.selfRightT = -1;
    }

    // count-out: robots that cannot move for ten seconds are out
    const stuck = !b.ko && !b.airborne && (b.inPit || b.comp.core <= 0 || this.driveFactor(b) <= 0 || (b.inverted && !b.s.invertible && b.s.selfRight <= 0));
    const stuckSoft = !b.ko && !b.airborne && b.inverted && !b.s.invertible && b.s.selfRight > 0 && b.selfRightT < 0;
    if ((stuck || stuckSoft) && !this.over) {
      b.immobileT += dt;
      const n = Math.floor(b.immobileT);
      if (n > b.countShown && b.immobileT > 1) {
        b.countShown = n;
        this.emit({ type: 'count', bot: b.idx, n: COUNT_OUT - n + 1 });
      }
      if (b.immobileT >= COUNT_OUT) this.knockOut(b, 'countout');
    } else if (!stuck) {
      b.immobileT = Math.max(0, b.immobileT - dt * 3);
      if (b.immobileT === 0) b.countShown = 0;
    }

    // tilt eases back
    const want = b.liftedBy >= 0 ? 0.55 : b.heldBy >= 0 ? 0.3 : b.wedged > 0 ? 0.18 * b.wedgeK + 0.05 : 0;
    b.tilt += (want - b.tilt) * Math.min(1, dt * 12);
  }

  private drive(b: Bot, dt: number) {
    if (b.airborne || b.inPit) return;
    const s = b.s;
    const fx = Math.cos(b.th);
    const fy = Math.sin(b.th);
    const rx = Math.sin(b.th);
    const ry = -Math.cos(b.th);
    const vf = b.vx * fx + b.vy * fy;
    const vl = b.vx * rx + b.vy * ry;
    const m = s.mass;
    let traction = 1;
    if (b.wedged > 0) traction *= 1 - 0.72 * b.wedgeK;
    if (b.liftedBy >= 0) traction *= 0.08;
    if (b.heldBy >= 0) traction *= 0.2;
    const N = m * G * (1 + s.downforce) * traction;
    const canDrive = this.mobile(b);

    let F = 0;
    let Fl = 0;
    if (canDrive) {
      const ps = this.powerScale(b);
      const df = this.driveFactor(b);
      const boost = b.boostT > 0 ? 1 + s.boostMult : 1;
      const Fs = s.driveForce * df * ps * boost;
      const vFree = s.driveSpeed * (0.55 + 0.45 * df) * Math.sqrt(ps) * (b.boostT > 0 ? 1 + s.boostMult * 0.5 : 1);
      F = Fs * clamp(b.ctl.throttle - vf / vFree, -1, 1);
      if (s.strafe) Fl = Fs * 0.75 * clamp(b.ctl.strafe - vl / (vFree * 0.7), -1, 1);
      // turning, traction-limited, with gyroscopic drag from spun-up weapons
      let gyro = 0;
      for (const ws of [b.front, b.top]) {
        if (ws && ws.w.def.gyro) gyro += ws.w.def.gyro * (ws.energy / Math.max(1, ws.w.energyMax));
      }
      gyro *= 1 - s.gyroDamp;
      const turnMax = s.turnRate * Math.sqrt(df * ps) * (1 - clamp(gyro, 0, 0.8)) * (b.boostT > 0 ? 1.1 : 1);
      const wT = clamp(b.ctl.turn, -1, 1) * turnMax;
      const alpha = s.turnAccel * Math.sqrt(df * ps) * traction;
      b.w += clamp(wT - b.w, -alpha * dt, alpha * dt);
    } else {
      // dead weight: wheels roll a little, the rest drags
      b.w *= Math.exp(-4 * dt);
    }
    const Fmax = s.grip * N;
    F = clamp(F, -Fmax, Fmax);
    // rolling resistance / braking
    const roll = (canDrive ? 0.04 : 0.35) * m * G * traction;
    const brake = Math.min(Math.abs(vf) * m / dt, roll);
    F -= Math.sign(vf) * brake;
    // sideways grip: wheels do not slide unless shoved hard
    const latMax = s.grip * s.lateral * N;
    Fl += clamp((-vl * m) / dt, -latMax, latMax);
    b.vx += ((F * fx + Fl * rx) / m) * dt;
    b.vy += ((F * fy + Fl * ry) / m) * dt;
    if (!canDrive) {
      // tumbling to a stop when it cannot drive and is not being carried
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) {
        const k = Math.max(0, sp - 2.5 * dt) / sp;
        b.vx *= k;
        b.vy *= k;
      }
    }
  }

  private integrate(b: Bot, dt: number) {
    if (b.inPit) {
      b.pitT += dt;
      b.z = -Math.min(3, b.pitT * b.pitT * 4.9);
      b.vx *= 0.9;
      b.vy *= 0.9;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      return;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.th = wrap(b.th + b.w * dt);
    b.speed = Math.hypot(b.vx, b.vy);
    if (b.airborne) {
      b.vz -= G * dt;
      b.z += b.vz * dt;
      b.flip += b.flipVel * dt;
      if (b.z <= 0 && b.vz < 0) this.land(b);
    }
  }

  private land(b: Bot) {
    const impact = -b.vz;
    b.z = 0;
    b.airborne = false;
    let f = b.flip % TAU;
    if (f < 0) f += TAU;
    const upside = f > Math.PI / 2 && f < (3 * Math.PI) / 2;
    if (b.flipAxis === 'pitch' && upside) {
      // a pitch-over is the same pose as a roll with the robot turned round
      b.th = wrap(b.th + Math.PI);
    }
    b.inverted = upside;
    b.flip = upside ? Math.PI : 0;
    b.flipAxis = 'roll';
    b.flipVel = 0;
    if (impact > 4.5) {
      b.vz = impact * 0.18;
      b.airborne = true;
      b.flipVel = 0;
    } else {
      b.vz = 0;
    }
    b.vx *= 0.7;
    b.vy *= 0.7;
    b.w *= 0.5;
    if (impact > 4) {
      const dmg = (impact - 4) * 6;
      this.damage(b, dmg, 'kinetic', upside ? 'top' : 'rear', b.lastTouchT > this.t - 3 ? b.lastTouchBy : -1, { kind: 'land' });
    }
    this.emit({ type: 'land', bot: b.idx, inverted: upside, impact, x: b.x, y: b.y });
  }

  /**
   * Throw a robot into the air: vertical speed vz, landing upside down or not,
   * tumbling about its own roll or pitch axis.
   */
  launch(b: Bot, vz: number, invert: boolean, axis: 'roll' | 'pitch', sign: number, extraTurns: number) {
    b.airborne = true;
    b.vz = Math.max(b.vz, vz);
    b.z = Math.max(b.z, 0.001);
    const tAir = (b.vz + Math.sqrt(b.vz * b.vz + 2 * G * b.z)) / G;
    // express the current pose about the new axis
    if (b.flipAxis !== axis && b.inverted) {
      if (axis === 'pitch') b.th = wrap(b.th + Math.PI);
    }
    b.flipAxis = axis;
    const from = b.inverted ? Math.PI : 0;
    const to = invert !== b.inverted ? from + Math.PI : from;
    const total = (to - from) + TAU * extraTurns;
    b.flip = from;
    b.flipVel = (sign * total) / Math.max(0.15, tAir);
    if (b.liftedBy >= 0 || b.heldBy >= 0) this.releaseHolds(b);
  }

  private releaseHolds(b: Bot) {
    for (const o of this.bots) {
      for (const ws of [o.front, o.top]) {
        if (ws && ws.holding && (b.liftedBy === o.idx || b.heldBy === o.idx)) {
          ws.holding = false;
          ws.reload = ws.w.reload;
        }
      }
    }
    b.liftedBy = -1;
    b.heldBy = -1;
  }

  // ---- collisions ------------------------------------------------------------

  private collide(A: Bot, B: Bot) {
    if (A.inPit || B.inPit) return;
    if (Math.abs(A.z - B.z) > 0.35) return;
    if (A.heldBy === B.idx || B.heldBy === A.idx) return;
    const ac = Math.cos(A.th) * A.s.halfSeg;
    const as = Math.sin(A.th) * A.s.halfSeg;
    const bc = Math.cos(B.th) * B.s.halfSeg;
    const bs = Math.sin(B.th) * B.s.halfSeg;
    closestSegSeg(A.x - ac, A.y - as, A.x + ac, A.y + as, B.x - bc, B.y - bs, B.x + bc, B.y + bs);
    let nx = C2X - C1X;
    let ny = C2Y - C1Y;
    let d = Math.hypot(nx, ny);
    const rsum = A.s.radius + B.s.radius;
    if (d >= rsum) return;
    if (d < 1e-6) {
      nx = B.x - A.x;
      ny = B.y - A.y;
      d = Math.hypot(nx, ny) || 1;
      if (d < 1e-6) {
        nx = 1;
        ny = 0;
      }
    }
    nx /= d;
    ny /= d;
    const pen = rsum - d;
    const px = C1X + nx * (A.s.radius - pen / 2);
    const py = C1Y + ny * (A.s.radius - pen / 2);
    // relative velocity at the contact
    const rAx = px - A.x;
    const rAy = py - A.y;
    const rBx = px - B.x;
    const rBy = py - B.y;
    const vAx = A.vx - A.w * rAy;
    const vAy = A.vy + A.w * rAx;
    const vBx = B.vx - B.w * rBy;
    const vBy = B.vy + B.w * rBx;
    const rvx = vBx - vAx;
    const rvy = vBy - vAy;
    const vn = rvx * nx + rvy * ny;
    const imA = 1 / A.s.mass;
    const imB = 1 / B.s.mass;
    const iiA = 1 / A.s.inertia;
    const iiB = 1 / B.s.inertia;
    const closing = -vn;
    // how fast each drove into the other, before the bounce
    const driveA = Math.max(0, A.vx * nx + A.vy * ny);
    const driveB = Math.max(0, -(B.vx * nx + B.vy * ny));
    if (vn < 0) {
      const rnA = rAx * ny - rAy * nx;
      const rnB = rBx * ny - rBy * nx;
      const k = imA + imB + rnA * rnA * iiA + rnB * rnB * iiB;
      const e = 0.18;
      const j = (-(1 + e) * vn) / k;
      this.impulse(A, -j * nx, -j * ny, rAx, rAy);
      this.impulse(B, j * nx, j * ny, rBx, rBy);
      // friction along the tangent
      const tx = -ny;
      const ty = nx;
      const vt = rvx * tx + rvy * ty;
      const rtA = rAx * ty - rAy * tx;
      const rtB = rBx * ty - rBy * tx;
      const kt = imA + imB + rtA * rtA * iiA + rtB * rtB * iiB;
      const jt = clamp(-vt / kt, -0.3 * j, 0.3 * j);
      this.impulse(A, -jt * tx, -jt * ty, rAx, rAy);
      this.impulse(B, jt * tx, jt * ty, rBx, rBy);
    }
    // push apart
    const corr = Math.max(0, pen - 0.002) * 0.8;
    const share = imA / (imA + imB);
    A.x -= nx * corr * share;
    A.y -= ny * corr * share;
    B.x += nx * corr * (1 - share);
    B.y += ny * corr * (1 - share);

    if (this.over) return;
    A.lastTouchBy = B.idx;
    A.lastTouchT = this.t;
    B.lastTouchBy = A.idx;
    B.lastTouchT = this.t;
    this.contact(A, B, nx, ny, closing, driveA, px, py);
    this.contact(B, A, -nx, -ny, closing, driveB, px, py);
  }

  /** a's side of a touch: wedging, ramming and spikes. n points from a to b. */
  private contact(a: Bot, b: Bot, nx: number, ny: number, closing: number, approach: number, px: number, py: number) {
    const fx = Math.cos(a.th);
    const fy = Math.sin(a.th);
    const frontOn = fx * nx + fy * ny > 0.72;
    if (!frontOn || a.airborne || a.ko) return;
    const zone = this.zoneFrom(b, px, py);
    const under = this.under(a, b, zone);
    if (a.s.frontWedge > 0.05 && under > 0.62 && !b.airborne && this.weaponsUsable(a)) {
      b.wedged = 0.3;
      b.wedgeK = Math.max(b.wedgeK, a.s.frontWedge * under);
    }
    const fw = a.front;
    // a ram hurts as much as you drive into them: being thrown onto it does not count
    const drive = Math.min(approach, a.s.driveSpeed * (1 + a.s.boostMult) * 1.1);
    if (fw && fw.w.ram > 0 && drive > 1.2 && a.ramCd <= 0 && this.weaponsUsable(a)) {
      const dmg = ramDamage(a.s.mass, Math.min(closing, drive + 1), fw.w.ram) * this.weaponFactor(a, fw);
      a.ramCd = 0.6;
      this.damage(b, dmg, fw.w.def.dmgType, zone, a.idx, { kind: fw.w.def.type, x: px, y: py, pierce: fw.w.def.type === 'ram' ? 0.15 : 0, nx, ny });
      this.wearWeapon(a, fw, dmg * 0.06);
    }
    if (b.s.thorns && closing > 1.0 && b.thornsCd <= 0) {
      b.thornsCd = 0.6;
      this.damage(a, b.s.thorns * Math.min(2, closing / 2), 'pierce', 'front', b.idx, { kind: 'thorns', x: px, y: py, nx: -nx, ny: -ny });
    }
  }

  /** How well a's front gets under b at `zone` (0.15..1). */
  under(a: Bot, b: Bot, zone: HitZone): number {
    let lowB = zone === 'front' ? b.s.low.front : zone === 'rear' ? b.s.low.rear : zone === 'top' ? 0 : b.s.low.sides;
    if (b.inverted && b.s.invertible) lowB = Math.max(lowB, 0.5);
    return clamp(0.55 + (a.s.low.front - lowB) * 1.6, 0.15, 1);
  }

  private impulse(b: Bot, jx: number, jy: number, rx: number, ry: number) {
    if (b.inPit) return;
    b.vx += jx / b.s.mass;
    b.vy += jy / b.s.mass;
    b.w += (rx * jy - ry * jx) / b.s.inertia;
  }

  private walls(b: Bot) {
    if (b.inPit) return;
    const H = this.half;
    this.pinSpikes(b);
    const c = Math.cos(b.th) * b.s.halfSeg;
    const s = Math.sin(b.th) * b.s.halfSeg;
    const r = b.s.radius;
    for (let k = -1; k <= 1; k += 2) {
      const ex = b.x + c * k;
      const ey = b.y + s * k;
      for (let axis = 0; axis < 2; axis++) {
        const p = axis === 0 ? ex : ey;
        const lim = H - r;
        if (Math.abs(p) <= lim) continue;
        const side = Math.sign(p);
        const pen = Math.abs(p) - lim;
        const nx = axis === 0 ? side : 0;
        const ny = axis === 1 ? side : 0;
        b.x -= nx * pen;
        b.y -= ny * pen;
        const rx = ex - b.x + nx * r;
        const ry = ey - b.y + ny * r;
        const vpx = b.vx - b.w * ry;
        const vpy = b.vy + b.w * rx;
        const vn = vpx * nx + vpy * ny;
        if (vn > 0) {
          const rn = rx * ny - ry * nx;
          const kk = 1 / b.s.mass + (rn * rn) / b.s.inertia;
          const j = (-(1 + 0.3) * vn) / kk;
          this.impulse(b, j * nx, j * ny, rx, ry);
          if (!this.over) this.wallHit(b, vn, ex + nx * r, ey + ny * r, axis, side);
        }
      }
    }
  }

  private wallHit(b: Bot, speed: number, x: number, y: number, axis: number, side: number) {
    if (b.wallCd > 0) return;
    if (speed > 2.2) {
      b.wallCd = 0.3;
      this.emit({ type: 'wall', bot: b.idx, speed, x, y });
    }
    const by = b.lastTouchT > this.t - 1.5 ? b.lastTouchBy : -1;
    if (speed > 3.6) {
      this.damage(b, (speed - 3.6) * (speed - 3.6) * 3.2, 'kinetic', this.zoneFrom(b, x, y), by, { kind: 'wall', x, y });
    }
    // spiked wall sections
    const sideName = axis === 0 ? (side > 0 ? 'e' : 'w') : side > 0 ? 'n' : 's';
    const along = axis === 0 ? y : x;
    for (const sp of this.arena.spikes ?? []) {
      if (sp.side === sideName && along >= sp.from && along <= sp.to && speed > 1.0 && b.hazardCd <= 0) {
        b.hazardCd = 0.4;
        this.damage(b, 7 * speed + 6, 'pierce', this.zoneFrom(b, x, y), by, { kind: 'hazard', x, y });
        this.emit({ type: 'hazard', kind: 'spikes', x, y, bot: b.idx });
        if (by >= 0) this.bots[by].control += 1.5;
      }
    }
  }

  /** Shoved against a spiked wall section: the spikes keep biting. */
  private pinSpikes(b: Bot) {
    if (this.over || b.airborne || b.hazardCd > 0 || !this.arena.spikes) return;
    const by = b.lastTouchT > this.t - 0.25 ? b.lastTouchBy : -1;
    if (by < 0) return;
    const H = this.half;
    const reach = b.s.length / 2 + 0.06;
    for (const sp of this.arena.spikes) {
      const axis = sp.side === 'e' || sp.side === 'w' ? 0 : 1;
      const side = sp.side === 'e' || sp.side === 'n' ? 1 : -1;
      const p = axis === 0 ? b.x : b.y;
      const along = axis === 0 ? b.y : b.x;
      if (side * p < H - reach || along < sp.from || along > sp.to) continue;
      b.hazardCd = 0.5;
      const x = axis === 0 ? side * H : b.x;
      const y = axis === 0 ? b.y : side * H;
      this.damage(b, 9, 'pierce', this.zoneFrom(b, x, y), by, { kind: 'hazard', x, y });
      this.emit({ type: 'hazard', kind: 'spikes', x, y, bot: b.idx });
      this.bots[by].control += 0.8;
      return;
    }
  }

  /** Robots grabbed by a clamp or crusher ride along in front of it. */
  private carry(a: Bot, b: Bot) {
    if (b.heldBy !== a.idx && !(b.liftedBy === a.idx && a.front?.w.def.grab)) return;
    const fx = Math.cos(a.th);
    const fy = Math.sin(a.th);
    const d = a.s.length / 2 + b.s.radius * 0.8;
    const tx = a.x + fx * d;
    const ty = a.y + fy * d;
    b.x += (tx - b.x) * 0.5;
    b.y += (ty - b.y) * 0.5;
    b.vx = a.vx;
    b.vy = a.vy;
    b.th = wrap(b.th + a.w * DT);
    b.w = a.w;
  }

  // ---- weapons ---------------------------------------------------------------

  private weapons(a: Bot, b: Bot, dt: number) {
    const usable = this.weaponsUsable(a);
    for (const ws of [a.front, a.top]) {
      if (!ws) continue;
      const wf = this.weaponFactor(a, ws);
      ws.hitCd -= dt;
      ws.sparkT -= dt;
      const type = ws.w.def.type;
      const ps = this.powerScale(a);
      const on = usable && wf > 0 && (ws.w.def.power === 0 || ws.w.p > 0);
      switch (type) {
        case 'vspin':
        case 'drum':
        case 'hspin':
        case 'ring':
          this.spinner(a, b, ws, on, wf, ps, dt);
          break;
        case 'flipper':
          this.flipper(a, b, ws, on, wf, ps, dt);
          break;
        case 'lifter':
          this.lifter(a, b, ws, on, wf, ps, dt);
          break;
        case 'hammer':
        case 'axe':
          this.hammer(a, b, ws, on, wf, ps, dt);
          break;
        case 'crusher':
          this.crusher(a, b, ws, on, wf, ps, dt);
          break;
        case 'saw':
          this.saw(a, b, ws, on, wf, ps, dt);
          break;
        case 'flame':
          this.flame(a, b, ws, on, wf, dt);
          break;
        default:
          break;
      }
    }
  }

  private wants(a: Bot, ws: WeaponState) {
    return ws.w.slot === 'front' ? a.ctl.fire : a.ctl.fireTop;
  }

  private spinner(a: Bot, b: Bot, ws: WeaponState, on: boolean, wf: number, ps: number, dt: number) {
    const w = ws.w;
    const cap = w.energyMax * wf * (a.overheated ? 0.7 : 1);
    if (on) ws.energy += w.spinPower * ps * wf * dt;
    ws.energy -= ws.energy * (on ? 0.012 : 0.5) * dt;
    if (ws.energy > cap) ws.energy -= (ws.energy - cap) * Math.min(1, dt * 3);
    ws.energy = Math.max(0, ws.energy);
    ws.spin += Math.sqrt(ws.energy / Math.max(1, w.energyMax)) * 55 * dt;
    // a spun-down weapon only scrapes: it needs over half its energy to land a real hit
    if (!on || ws.hitCd > 0 || ws.energy < w.energyMax * 0.55 || b.ko === 'pit' || b.inPit) return;
    if (b.z > (w.def.type === 'vspin' || w.def.type === 'drum' ? 0.55 : 0.3) || a.airborne) return;
    if (!this.inZone(a, b, ws)) return;
    const px = ZX;
    const py = ZY;
    let nx = px - a.x;
    let ny = py - a.y;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    const zone = this.zoneFrom(b, a.x, a.y);
    const closing = Math.max(0, (a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
    ws.hitCd = 0.5;

    // spinner meets spinner: both weapons bounce off each other
    const bw = b.front;
    if (bw && ['vspin', 'drum', 'hspin', 'ring'].includes(bw.w.def.type) && bw.energy > bw.w.energyMax * 0.25 && this.weaponsUsable(b) && this.inZone(b, a, bw, 0.05)) {
      const e = Math.min(ws.energy, bw.energy) * 0.45;
      const big = (ws.energy + bw.energy) / 2;
      // weapon on weapon: both take a share, the harder spinner wins it
      const toB = ((ws.energy * (w.def.bite ?? 0.5) * 0.35) / 1000) * w.perKJ;
      const toA = ((bw.energy * (bw.w.def.bite ?? 0.5) * 0.35) / 1000) * bw.w.perKJ;
      ws.energy *= 0.5;
      bw.energy *= 0.5;
      this.damage(b, toB, 'kinetic', this.zoneFrom(b, a.x, a.y), a.idx, { quiet: true });
      this.damage(a, toA, 'kinetic', this.zoneFrom(a, b.x, b.y), b.idx, { quiet: true });
      bw.hitCd = 0.3;
      const mEff = (a.s.mass * b.s.mass) / (a.s.mass + b.s.mass);
      const J = Math.sqrt(2 * big * mEff) * KNOCK * 0.8;
      this.impulse(a, -nx * J, -ny * J, 0, 0);
      this.impulse(b, nx * J, ny * J, 0, 0);
      a.w += (this.rng() - 0.5) * 4;
      b.w += (this.rng() - 0.5) * 4;
      this.wearWeapon(a, ws, (e / 1000) * 2.2);
      this.wearWeapon(b, bw, (e / 1000) * 2.2);
      this.emit({ type: 'clash', x: px, y: py, z: 0.25, a: a.idx, b: b.idx });
      a.aggression += 0.5;
      b.aggression += 0.5;
      return;
    }

    const def = w.def;
    let f = (def.bite ?? 0.5) * (0.72 + 0.28 * Math.min(1, closing / 2.5));
    if (b.airborne) f *= 0.6;
    const et = ws.energy * f;
    ws.energy -= et;
    let dmg = (et / 1000) * w.perKJ;
    if ((def.type === 'hspin' || def.type === 'ring') && zone === 'front') dmg *= 1 - 0.5 * b.s.frontWedge;
    if ((def.type === 'hspin' || def.type === 'ring') && b.s.low.front > 0.6 && zone === 'front') {
      // a low wedge lifts the bar over itself
      dmg *= 0.85;
    }
    this.damage(b, dmg, 'kinetic', zone, a.idx, { kind: def.type, x: px, y: py, lowHit: def.lowHit ?? 0, nx, ny });
    this.wearWeapon(a, ws, (et / 1000) * 0.35);

    // knock back
    const mEff = (a.s.mass * b.s.mass) / (a.s.mass + b.s.mass);
    const J = Math.sqrt(2 * et * mEff) * KNOCK * (1 - b.s.shock * 0.4);
    const launchK = def.launch ?? 0;
    let dx = nx;
    let dy = ny;
    if (def.type === 'hspin' || def.type === 'ring') {
      // the bar sweeps sideways: knock is tangential as much as outward
      const sgn = a.idx === 0 ? 1 : -1;
      const tx = -ny * sgn;
      const ty = nx * sgn;
      dx = nx * 0.6 + tx * 0.8;
      dy = ny * 0.6 + ty * 0.8;
      const l = Math.hypot(dx, dy);
      dx /= l;
      dy /= l;
      b.w += (sgn * J * 1.4) / Math.sqrt(b.s.inertia * b.s.mass);
    }
    const horiz = J * (1 - launchK * 0.45);
    this.impulse(b, dx * horiz, dy * horiz, 0, 0);
    const recoil = J * (def.recoil ?? 0.3);
    this.impulse(a, -nx * recoil, -ny * recoil, 0, 0);
    if (def.type === 'hspin' || def.type === 'ring') a.w -= (a.idx === 0 ? 1 : -1) * recoil / Math.sqrt(a.s.inertia * a.s.mass) * 1.2;

    const vz = (J * launchK) / b.s.mass;
    if (vz > 1.2) {
      const stab = b.s.stability;
      const pInv = clamp((vz - 3) * 0.16 * (1 - stab * 0.55), 0, 0.6);
      const inv = this.rng() < pInv;
      const axis = zone === 'front' || zone === 'rear' ? 'pitch' : 'roll';
      const sign = this.tumbleSign(b, nx, ny, axis);
      this.launch(b, vz, inv ? !b.inverted : b.inverted, axis, sign, vz > 5.5 ? 1 : 0);
      if (inv) {
        a.flips++;
        a.control += 3;
        this.emit({ type: 'flip', bot: b.idx, by: a.idx, height: (vz * vz) / (2 * G) });
      }
    }
    a.aggression += 0.4;
  }

  /** Which way a robot tumbles when knocked along (nx, ny), so it falls away. */
  private tumbleSign(b: Bot, nx: number, ny: number, axis: 'roll' | 'pitch'): number {
    const fx = Math.cos(b.th);
    const fy = Math.sin(b.th);
    if (axis === 'pitch') {
      // pushed backwards -> nose up and over the back
      return fx * nx + fy * ny < 0 ? -1 : 1;
    }
    const rx = Math.sin(b.th);
    const ry = -Math.cos(b.th);
    return rx * nx + ry * ny > 0 ? 1 : -1;
  }

  private flipper(a: Bot, b: Bot, ws: WeaponState, on: boolean, wf: number, ps: number, dt: number) {
    const w = ws.w;
    if (ws.reload > 0) ws.reload -= dt * ps * (0.5 + 0.5 * wf);
    ws.anim = Math.max(0, ws.anim - dt * 2.5);
    if (!on || ws.reload > 0 || a.airborne) return;
    const target = !b.inPit && !b.airborne && b.z < 0.2 && this.inZone(a, b, ws);
    const auto = a.auto && target;
    if (!(this.wants(a, ws) || auto)) return;
    ws.reload = w.reload;
    ws.anim = 1;
    this.emit({ type: 'fire', bot: a.idx, slot: w.slot, weapon: w.def.type, miss: !target, x: a.x, y: a.y });
    if (!target) return;
    const zone = this.zoneFrom(b, a.x, a.y);
    const under = this.under(a, b, zone);
    const J = w.impulse * wf * Math.sqrt(ps) * under;
    const m = b.s.mass;
    let nx = b.x - a.x;
    let ny = b.y - a.y;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const vz = Math.min(9, (J * 0.78) / m);
    this.impulse(b, nx * J * 0.32, ny * J * 0.32, 0, 0);
    this.damage(b, w.damage * wf, 'kinetic', zone, a.idx, { kind: 'flipper', x: ZX, y: ZY, nx, ny });
    const stab = b.s.stability;
    const pInv = clamp(0.12 + (vz - 2.6) * 0.21 - stab * 0.32, 0.04, 0.92);
    const inv = vz > 1.5 && this.rng() < pInv;
    const axis = zone === 'front' || zone === 'rear' ? 'pitch' : 'roll';
    if (vz > 0.8) {
      this.launch(b, vz, inv ? !b.inverted : b.inverted, axis, this.tumbleSign(b, nx, ny, axis), vz > 6.5 ? 1 : 0);
      b.thrown = true;
      this.emit({ type: 'flip', bot: b.idx, by: a.idx, height: (vz * vz) / (2 * G) });
      a.flips++;
      a.control += inv ? 2 : 0.6;
    }
    this.impulse(a, -nx * J * 0.08, -ny * J * 0.08, 0, 0);
    a.aggression += 0.5;
  }

  private lifter(a: Bot, b: Bot, ws: WeaponState, on: boolean, wf: number, ps: number, dt: number) {
    const w = ws.w;
    if (ws.holding) {
      ws.holdT -= dt;
      ws.anim = Math.min(1, ws.anim + dt * 4);
      const still = !b.airborne && !b.inPit && this.inZone(a, b, ws, 0.35);
      const letGo = ws.holdT <= 0 || !still || !on || (this.wants(a, ws) && ws.holdT < w.hold - 0.6);
      if (letGo) {
        ws.holding = false;
        ws.reload = w.reload;
        b.liftedBy = -1;
        this.emit({ type: 'release', bot: b.idx, by: a.idx });
        if (still) {
          // tip them over on the way down
          const J = w.impulse * wf * Math.sqrt(ps);
          const r = J / b.s.mass;
          const pInv = clamp(0.2 + (r - 5) * 0.09 + (1 - b.s.stability) * 0.45, 0.08, 0.88);
          const inv = this.rng() < pInv;
          let nx = b.x - a.x;
          let ny = b.y - a.y;
          const l = Math.hypot(nx, ny) || 1;
          nx /= l;
          ny /= l;
          const zone = this.zoneFrom(b, a.x, a.y);
          const axis = zone === 'front' || zone === 'rear' ? 'pitch' : 'roll';
          this.launch(b, 1.6 + r * 0.15, inv ? !b.inverted : b.inverted, axis, this.tumbleSign(b, nx, ny, axis), 0);
          b.thrown = true;
          if (inv) {
            a.flips++;
            a.control += 3;
            this.emit({ type: 'flip', bot: b.idx, by: a.idx, height: 0.4 });
          }
        }
      } else {
        a.control += dt * 0.8;
      }
      return;
    }
    if (ws.reload > 0) ws.reload -= dt * ps * (0.5 + 0.5 * wf);
    ws.anim = Math.max(0, ws.anim - dt * 2);
    if (!on || ws.reload > 0 || a.airborne) return;
    const target = !b.inPit && !b.airborne && b.z < 0.2 && b.heldBy < 0 && this.inZone(a, b, ws);
    if (!(this.wants(a, ws) || (a.auto && target))) return;
    if (!target) {
      ws.reload = 0.6;
      ws.anim = 1;
      this.emit({ type: 'fire', bot: a.idx, slot: w.slot, weapon: w.def.type, miss: true, x: a.x, y: a.y });
      return;
    }
    const zone = this.zoneFrom(b, a.x, a.y);
    const under = this.under(a, b, zone);
    const strong = (w.impulse * wf * Math.sqrt(ps)) / b.s.mass;
    this.emit({ type: 'fire', bot: a.idx, slot: w.slot, weapon: w.def.type, x: a.x, y: a.y });
    if (under < 0.45 || strong < 3.2) {
      ws.reload = 0.8;
      ws.anim = 0.5;
      return;
    }
    ws.holding = true;
    ws.holdT = w.hold;
    b.liftedBy = a.idx;
    this.damage(b, w.damage * wf, 'kinetic', zone, a.idx, { kind: 'lifter', x: ZX, y: ZY });
    this.emit({ type: 'grab', bot: b.idx, by: a.idx });
    a.control += 1;
    a.aggression += 0.4;
  }

  private hammer(a: Bot, b: Bot, ws: WeaponState, on: boolean, wf: number, ps: number, dt: number) {
    const w = ws.w;
    if (ws.strikeT >= 0) {
      ws.strikeT -= dt;
      ws.anim = Math.min(1, ws.anim + dt * 6);
      if (ws.strikeT < 0) {
        ws.anim = 1;
        const hit = !b.inPit && b.z < 0.35 && this.inZone(a, b, ws, 0.08);
        if (hit) {
          const dmg = w.damage * wf * Math.sqrt(ps);
          let nx = b.x - a.x;
          let ny = b.y - a.y;
          const l = Math.hypot(nx, ny) || 1;
          nx /= l;
          ny /= l;
          this.damage(b, dmg, w.def.dmgType, 'top', a.idx, { kind: w.def.type, x: ZX, y: ZY, pierce: w.pierce, nx, ny, z: b.s.height });
          if (w.stun) b.stun = Math.max(b.stun, w.stun * (1 - b.s.shock));
          if (!b.airborne) {
            b.vz = 0.9;
            b.airborne = true;
            b.flipVel = 0;
          }
          this.wearWeapon(a, ws, dmg * 0.04);
          a.aggression += 0.6;
        } else {
          const fx = Math.cos(a.th);
          const fy = Math.sin(a.th);
          const d = a.s.length / 2 + w.reach;
          this.emit({ type: 'sparks', x: a.x + fx * d, y: a.y + fy * d, z: 0, n: 10, nx: fx, ny: fy });
        }
      }
      return;
    }
    if (ws.reload > 0) {
      ws.reload -= dt * ps * (0.5 + 0.5 * wf);
      ws.anim = Math.max(0, ws.anim - dt * 1.4);
    } else {
      ws.anim = Math.max(0, ws.anim - dt * 3);
    }
    if (!on || ws.reload > 0 || a.airborne) return;
    const target = !b.inPit && b.z < 0.3 && this.inZone(a, b, ws, -0.02);
    if (!(this.wants(a, ws) || (a.auto && target))) return;
    ws.strikeT = 0.16;
    ws.reload = w.reload;
    this.emit({ type: 'fire', bot: a.idx, slot: w.slot, weapon: w.def.type, miss: !target, x: a.x, y: a.y });
  }

  private crusher(a: Bot, b: Bot, ws: WeaponState, on: boolean, wf: number, ps: number, dt: number) {
    const w = ws.w;
    if (ws.holding) {
      ws.holdT -= dt;
      ws.anim = 1;
      const ok = on && b.heldBy === a.idx && !b.inPit && !b.airborne;
      if (ok) {
        this.damage(b, w.dps * wf * Math.sqrt(ps) * dt, 'pierce', 'top', a.idx, { kind: 'crusher', quiet: true, pierce: w.pierce });
        a.control += dt * 1.1;
        if (ws.sparkT <= 0) {
          ws.sparkT = 0.12;
          this.emit({ type: 'sparks', x: b.x, y: b.y, z: b.s.height, n: 4, nx: 0, ny: 0 });
        }
      }
      if (ws.holdT <= 0 || !ok) {
        ws.holding = false;
        ws.reload = w.reload;
        if (b.heldBy === a.idx) b.heldBy = -1;
        this.emit({ type: 'release', bot: b.idx, by: a.idx });
      }
      return;
    }
    if (ws.windup >= 0) {
      ws.windup -= dt;
      ws.anim = Math.min(1, ws.anim + dt * 4);
      if (ws.windup < 0) {
        const hit = !b.inPit && !b.airborne && b.liftedBy < 0 && this.inZone(a, b, ws, 0.06);
        if (hit) {
          ws.holding = true;
          ws.holdT = w.hold;
          b.heldBy = a.idx;
          this.damage(b, w.damage * wf * Math.sqrt(ps), 'pierce', 'top', a.idx, { kind: 'crusher', x: ZX, y: ZY, pierce: w.pierce, z: b.s.height });
          this.emit({ type: 'grab', bot: b.idx, by: a.idx });
          a.aggression += 0.6;
          // biting a spun-up weapon hurts
          const bw = b.front;
          if (bw && bw.w.def.energy && bw.energy > bw.w.energyMax * 0.3 && this.inZone(b, a, bw, 0.05)) {
            this.wearWeapon(a, ws, (bw.energy / 1000) * 1.5);
            bw.energy *= 0.4;
          }
        } else {
          ws.reload = w.reload * 0.5;
        }
      }
      return;
    }
    if (ws.reload > 0) ws.reload -= dt * ps * (0.5 + 0.5 * wf);
    ws.anim = Math.max(0, ws.anim - dt * 1.5);
    if (!on || ws.reload > 0 || a.airborne) return;
    const target = !b.inPit && !b.airborne && b.liftedBy < 0 && this.inZone(a, b, ws, -0.03);
    if (!(this.wants(a, ws) || (a.auto && target))) return;
    ws.windup = 0.3;
    this.emit({ type: 'fire', bot: a.idx, slot: w.slot, weapon: w.def.type, miss: !target, x: a.x, y: a.y });
  }

  private saw(a: Bot, b: Bot, ws: WeaponState, on: boolean, wf: number, ps: number, dt: number) {
    const w = ws.w;
    ws.firing = on;
    ws.spin += (on ? 45 : 0) * dt;
    ws.anim = on ? Math.min(1, ws.anim + dt * 3) : Math.max(0, ws.anim - dt * 3);
    if (!on || b.inPit || b.z > 0.4 || a.airborne) return;
    if (!this.inZone(a, b, ws)) return;
    const zone = w.slot === 'top' ? 'top' : this.zoneFrom(b, a.x, a.y);
    const px = ZX;
    const py = ZY;
    this.damage(b, w.dps * wf * Math.sqrt(ps) * dt, 'cut', zone, a.idx, { kind: 'saw', quiet: true });
    a.aggression += dt * 0.6;
    if (ws.sparkT <= 0) {
      ws.sparkT = 0.06;
      this.emit({ type: 'sparks', x: px, y: py, z: w.slot === 'top' ? b.s.height : 0.15, n: 5, nx: Math.cos(a.th), ny: Math.sin(a.th), hot: true });
    }
    // the blade grabs and jostles
    b.vx += (this.rng() - 0.5) * 6 * dt;
    b.vy += (this.rng() - 0.5) * 6 * dt;
  }

  private flame(a: Bot, b: Bot, ws: WeaponState, on: boolean, wf: number, dt: number) {
    const w = ws.w;
    const target = on && !b.inPit && this.inZone(a, b, ws);
    const want = this.wants(a, ws) || (a.auto && target);
    ws.firing = on && want && ws.fuel > 0 && !a.airborne;
    if (!ws.firing) return;
    ws.fuel -= dt;
    if (!target) return;
    b.heat += w.heat * wf * dt;
    const zone = this.zoneFrom(b, a.x, a.y);
    this.damage(b, w.dps * wf * dt, 'thermal', zone, a.idx, { kind: 'flame', quiet: true });
    a.aggression += dt * 0.5;
    if (b.heat > 80) a.control += dt * 0.4;
  }

  private wearWeapon(a: Bot, ws: WeaponState, amount: number) {
    const key: CompKey = ws.w.slot;
    const before = a.comp[key];
    a.comp[key] = Math.max(0, a.comp[key] - amount * (1 - a.s.guard));
    if (before > 0 && a.comp[key] <= 0) this.emit({ type: 'compdown', bot: a.idx, comp: key });
  }

  // ---- damage ----------------------------------------------------------------

  damage(
    b: Bot,
    raw: number,
    type: DmgType,
    zone: HitZone,
    by: number,
    o: { kind?: HitKind; x?: number; y?: number; z?: number; pierce?: number; lowHit?: number; quiet?: boolean; structural?: boolean; internal?: boolean; nx?: number; ny?: number } = {},
  ) {
    if (b.ko || raw <= 0 || this.over) return;
    raw *= DMG_SCALE;
    const s = b.s;
    if (!o.quiet && !o.internal && s.reactive && b.reactiveCd <= 0 && raw >= 60) {
      raw *= 1 - s.reactive;
      b.reactiveCd = 8;
    }
    if ((type === 'kinetic' || type === 'pierce') && !o.internal) raw *= 1 - s.deflect;
    const dealt = raw;
    if (b.shield > 0 && !o.internal) {
      const take = Math.min(b.shield, raw);
      b.shield -= take;
      raw -= take;
    }
    let through = raw;
    if (!o.structural && !o.internal && b.armor[zone] > 0 && raw > 0) {
      const absorbFrac = s.resist[type] * (1 - (o.pierce ?? 0));
      const absorbed = Math.min(b.armor[zone], raw * absorbFrac);
      b.armor[zone] -= absorbed;
      through = raw - absorbed;
      if (b.armor[zone] <= 0.01) {
        b.armor[zone] = 0;
        this.emit({ type: 'armorbreak', bot: b.idx, zone });
      }
    }
    b.hp -= through;
    b.dmgTaken += dealt;

    // internals take a share of what got through
    const comp = (key: CompKey, k: number) => {
      if (k <= 0 || s.compHp[key] <= 0) return;
      const before = b.comp[key];
      let amt = through * k * (1 - s.shock);
      if (key === 'front' || key === 'top') amt *= 1 - s.guard;
      b.comp[key] = Math.max(0, before - amt);
      if (before > 0 && b.comp[key] <= 0) this.emit({ type: 'compdown', bot: b.idx, comp: key });
    };
    if (!o.internal) {
      const low = o.lowHit ?? 0;
      switch (zone) {
        case 'front':
          comp('front', 0.4);
          comp('drive', 0.08 + low);
          break;
        case 'left':
        case 'right':
          comp('drive', 0.42 + low);
          comp('core', 0.05);
          break;
        case 'rear':
          comp('drive', 0.3 + low);
          comp('core', 0.18);
          break;
        case 'top':
          comp('core', 0.26);
          comp('top', 0.38);
          comp('front', 0.06);
          break;
      }
      if (o.structural) comp('drive', 0.2);
    }
    if (s.volatile && b.burning <= 0 && s.compHp.core > 0 && b.comp.core / s.compHp.core < 0.3 && !o.internal) {
      b.burning = 6;
      this.emit({ type: 'ablaze', bot: b.idx });
    }

    if (by >= 0 && by !== b.idx) {
      const a = this.bots[by];
      a.dmgDealt += dealt;
      if (!o.quiet) {
        a.hits++;
        if (dealt >= BIG_HIT) a.bigHits++;
        a.biggestHit = Math.max(a.biggestHit, dealt);
      }
    }
    if (!o.quiet && o.kind) {
      this.emit({
        type: 'hit',
        x: o.x ?? b.x,
        y: o.y ?? b.y,
        z: o.z ?? 0.2,
        by,
        to: b.idx,
        dmg: dealt,
        kind: o.kind,
        big: dealt >= BIG_HIT,
        zone,
        nx: o.nx ?? 0,
        ny: o.ny ?? 0,
      });
    }
    if (b.hp <= 0) this.knockOut(b, 'destroyed');
  }

  private knockOut(b: Bot, method: 'destroyed' | 'countout' | 'pit') {
    if (b.ko) return;
    b.ko = method;
    if (method === 'destroyed') b.hp = 0;
    this.emit({ type: 'ko', bot: b.idx, method });
  }

  // ---- hazards ---------------------------------------------------------------

  private hazards(dt: number) {
    const ar = this.arena;
    const t = this.t;
    this.hammerCd -= dt;
    this.hammerAnim = Math.max(0, this.hammerAnim - dt * 2.5);
    for (const b of this.bots) {
      if (b.inPit || b.ko === 'pit') continue;
      const by = b.lastTouchT > t - 2 ? b.lastTouchBy : -1;
      // the pit
      if (ar.pit && this.pitOpen && !b.airborne) {
        const p = ar.pit;
        const m = 0.12;
        if (Math.abs(b.x - p.x) < p.w / 2 - m && Math.abs(b.y - p.y) < p.h / 2 - m) {
          b.inPit = true;
          b.pitT = 0;
          this.releaseHolds(b);
          for (const o of this.bots) if (o.liftedBy === b.idx || o.heldBy === b.idx) this.releaseHolds(o);
          this.emit({ type: 'pitfall', bot: b.idx, by });
          if (by >= 0) this.bots[by].control += 4;
          this.knockOut(b, 'pit');
          continue;
        }
      }
      if (b.airborne) continue;
      // floor saws
      for (const sw of ar.saws ?? []) {
        const ph = (((t + sw.offset) % sw.period) + sw.period) % sw.period;
        if (ph >= sw.active) continue;
        if (Math.abs(b.x - sw.x) < sw.w / 2 + b.s.radius * 0.5 && Math.abs(b.y - sw.y) < sw.h / 2 + b.s.radius * 0.5) {
          this.damage(b, 34 * dt, 'cut', 'rear', by, { quiet: true, structural: true });
          if (by >= 0) this.bots[by].control += dt * 0.8;
          if (b.hazardCd <= 0) {
            b.hazardCd = 0.25;
            b.vz = 0.7 + this.rng() * 0.6;
            b.airborne = true;
            b.flipVel = (this.rng() - 0.5) * 0.4;
            b.w += (this.rng() - 0.5) * 3;
            this.emit({ type: 'hazard', kind: 'saw', x: b.x, y: b.y, bot: b.idx });
            this.emit({ type: 'sparks', x: b.x, y: b.y, z: 0.05, n: 10, nx: 0, ny: 0, hot: true });
          }
        }
      }
      // corner hammer
      const hm = ar.hammer;
      if (hm) {
        const inside = Math.hypot(b.x - hm.x, b.y - hm.y) < hm.r;
        b.hammerZoneT = inside ? b.hammerZoneT + dt : 0;
        if (inside && b.hammerZoneT > 0.45 && this.hammerCd <= 0) {
          this.hammerCd = 3.2;
          this.hammerAnim = 1;
          this.damage(b, 62, 'kinetic', 'top', by, { kind: 'hazard', x: b.x, y: b.y, z: b.s.height });
          b.stun = Math.max(b.stun, 0.6 * (1 - b.s.shock));
          this.emit({ type: 'hazard', kind: 'hammer', x: b.x, y: b.y, bot: b.idx });
          if (by >= 0) this.bots[by].control += 3;
        }
      }
      // fire vents
      for (const fv of ar.flames ?? []) {
        const ph = (((t + fv.offset) % fv.period) + fv.period) % fv.period;
        if (ph >= fv.active) continue;
        if (Math.hypot(b.x - fv.x, b.y - fv.y) < fv.r + b.s.radius * 0.4) {
          b.heat += 48 * dt;
          this.damage(b, 7 * dt, 'thermal', 'rear', by, { quiet: true, structural: true });
          if (by >= 0) this.bots[by].control += dt * 0.8;
          if (b.hazardCd <= 0) {
            b.hazardCd = 0.5;
            this.emit({ type: 'hazard', kind: 'flame', x: b.x, y: b.y, bot: b.idx });
          }
        }
      }
    }
  }

  /** Is a hazard active (or about to be) at this point? Used by the AI. */
  hazardAt(x: number, y: number, margin: number, lookahead = 0.6): number {
    const ar = this.arena;
    const t = this.t + lookahead;
    let danger = 0;
    if (ar.pit && (this.pitOpen || this.t + 3 > ar.pit.opensAt)) {
      const p = ar.pit;
      if (Math.abs(x - p.x) < p.w / 2 + margin && Math.abs(y - p.y) < p.h / 2 + margin) danger = Math.max(danger, 3);
    }
    for (const sw of ar.saws ?? []) {
      const ph = (((t + sw.offset) % sw.period) + sw.period) % sw.period;
      const soon = ph < sw.active + 0.3 || ph > sw.period - 0.6;
      if (soon && Math.abs(x - sw.x) < sw.w / 2 + margin && Math.abs(y - sw.y) < sw.h / 2 + margin) danger = Math.max(danger, 1.2);
    }
    if (ar.hammer && Math.hypot(x - ar.hammer.x, y - ar.hammer.y) < ar.hammer.r + margin) danger = Math.max(danger, 1);
    for (const fv of ar.flames ?? []) {
      const ph = (((t + fv.offset) % fv.period) + fv.period) % fv.period;
      if (ph < fv.active + 0.3 && Math.hypot(x - fv.x, y - fv.y) < fv.r + margin) danger = Math.max(danger, 0.8);
    }
    return danger;
  }

  // ---- judging ---------------------------------------------------------------

  private score(a: Bot, b: Bot, dt: number) {
    if (a.ko) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const toward = (a.vx * dx + a.vy * dy) / d;
    if (toward > 0.5 && d < 5) a.aggression += dt * Math.min(1, toward / 2);
    if (b.wedged > 0 && b.lastTouchBy === a.idx) a.control += dt * 0.6;
    if ((b.inverted && !b.s.invertible) || b.stun > 0) a.control += dt * 0.3;
  }

  private checkEnd() {
    const [A, B] = this.bots;
    if (A.ko || B.ko) {
      const winner = A.ko && B.ko ? null : A.ko ? 1 : 0;
      const loser = this.bots[winner === 0 ? 1 : 0];
      const method = winner === null ? 'decision' : loser.ko === 'destroyed' ? 'KO' : loser.ko === 'pit' ? 'pit' : 'countout';
      if (winner === null) this.finishOnPoints();
      else this.finish(winner, method);
      return;
    }
    if (this.t >= this.duration) {
      this.emit({ type: 'time' });
      this.finishOnPoints();
    }
  }

  forfeit(loser: number) {
    if (this.over) return;
    this.bots[loser].ko = 'countout';
    this.finish(loser === 0 ? 1 : 0, 'forfeit');
  }

  private finishOnPoints() {
    const [A, B] = this.bots;
    const split = (a: number, b: number, total: number, noise: number): [number, number] => {
      const sum = a + b;
      let r = sum > 0 ? a / sum : 0.5;
      r = clamp(r + (this.rng() - 0.5) * noise, 0, 1);
      const pa = Math.round(r * total);
      return [pa, total - pa];
    };
    const cards: JudgeCard[] = [];
    const votes: [number, number] = [0, 0];
    for (let j = 0; j < 3; j++) {
      const card: JudgeCard = {
        damage: split(A.dmgDealt + 1, B.dmgDealt + 1, 4, 0.12),
        aggression: split(A.aggression + 0.5, B.aggression + 0.5, 3, 0.15),
        control: split(A.control + 0.5, B.control + 0.5, 4, 0.15),
      };
      cards.push(card);
      const ta = card.damage[0] + card.aggression[0] + card.control[0];
      const tb = card.damage[1] + card.aggression[1] + card.control[1];
      if (ta > tb) votes[0]++;
      else if (tb > ta) votes[1]++;
      else votes[A.dmgDealt >= B.dmgDealt ? 0 : 1]++;
    }
    const winner = votes[0] > votes[1] ? 0 : 1;
    this.finish(winner, 'decision', { cards, votes });
  }

  private finish(winner: number | null, method: FightResult['method'], judges?: FightResult['judges']) {
    this.over = true;
    this.result = {
      winner,
      method,
      time: Math.min(this.t, this.duration),
      judges,
      stats: this.bots.map((b) => ({
        dmgDealt: b.dmgDealt,
        dmgTaken: b.dmgTaken,
        hits: b.hits,
        bigHits: b.bigHits,
        flips: b.flips,
        aggression: b.aggression,
        control: b.control,
        biggestHit: b.biggestHit,
      })),
      wear: [this.wearOf(this.bots[0]), this.wearOf(this.bots[1])],
    };
  }

  wearOf(b: Bot): Wear {
    const s = b.s;
    const f = (v: number, max: number) => (max > 0 ? clamp(v / max, 0, 1) : 1);
    const armor = {} as Record<HitZone, number>;
    for (const z of ZONES) armor[z] = f(b.armor[z], s.armorMax[z]);
    return {
      hp: f(b.hp, s.hpMax),
      armor,
      comp: {
        drive: f(b.comp.drive, s.compHp.drive),
        front: f(b.comp.front, s.compHp.front),
        top: f(b.comp.top, s.compHp.top),
        core: f(b.comp.core, s.compHp.core),
      },
      shield: f(b.shield, s.shieldMax),
    };
  }
}

