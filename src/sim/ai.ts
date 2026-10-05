// Robot brains. Each one reads the fight and works the robot's controls: no
// one drives in the arena. Tactics follow the robot's main weapon and the
// battle plan its team gave it; the brain part sets how fast it reacts, how
// well it aims and times its weapon and how much it respects the hazards, and
// all of that depends on the power that actually reaches it.

import { mulberry32, type Rng } from './rng.ts';
import { mindAt } from './stats.ts';
import type { Bot, WeaponState, World } from './world.ts';

export interface Skill {
  /** seconds between decisions */
  reaction: number;
  /** 0..1 aim precision and lead */
  aim: number;
  /** 0..1 how readily it attacks with a half-ready weapon */
  aggression: number;
  /** 0..1 how well it avoids hazards and uses them */
  hazardIQ: number;
}

const STANCE_AGGRESSION = { aggressive: 0.85, balanced: 0.6, defensive: 0.35 };
/** frozen while a starved brain reboots, then a moment before it can brown out again */
export const REBOOT_TIME = 0.8;
const REBOOT_GRACE = 1.6;

type Mode = 'attack' | 'retreat' | 'flank' | 'push' | 'hold' | 'wait' | 'backoff' | 'carry' | 'unstick' | 'escape' | 'stalk';

const TAU = Math.PI * 2;
const wrap = (a: number) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

const SPINNERS = new Set(['vspin', 'drum', 'hspin', 'ring']);

/**
 * Turn input that brings the heading error to zero as fast as the robot can
 * without overshooting: the fastest spin from which it can still brake in time.
 */
export function turnToward(err: number, turnRate: number, turnAccel: number): number {
  const w = Math.sqrt(2 * turnAccel * 0.7 * Math.abs(err));
  return clamp((Math.sign(err) * Math.min(turnRate, w)) / Math.max(0.1, turnRate), -1, 1);
}

export class Driver {
  private rng: Rng;
  private next = 0;
  private mode: Mode = 'attack';
  private tx = 0;
  private ty = 0;
  /** face this point instead of driving at it (reverse away from it) */
  private faceX = 0;
  private faceY = 0;
  private reverse = false;
  private throttle = 1;
  private boost = false;
  private stuckT = 0;
  private unstickT = 0;
  private backoffT = 0;
  /** how long we have been wedged, lifted or held */
  private pinnedT = 0;
  private escapeT = 0;
  private noise = 0;
  private flankSide = 1;
  /** whether this decision noticed the hazards ahead */
  private notice = true;
  /** time spent circling for a flank, and waiting for an opening, since the last clash */
  private flankT = 0;
  private stalkT = 0;
  /** a starved brain: frozen while it reboots */
  private rebootT = 0;
  private graceT = 0;

  private world: World;
  readonly idx: number;
  skill: Skill = { reaction: 0.3, aim: 0.5, aggression: 0.6, hazardIQ: 0.5 };

  constructor(world: World, idx: number, seed = 7) {
    this.world = world;
    this.idx = idx;
    this.rng = mulberry32(seed * 7919 + idx);
    this.noise = this.rng() * 100;
    this.flankSide = this.rng() < 0.5 ? 1 : -1;
    this.refresh();
  }

  /** What the brain is up to, in a word or two for the HUD. */
  get intent(): string {
    if (this.rebootT > 0) return 'Rebooting';
    switch (this.mode) {
      case 'attack':
        return this.boost ? 'Charging' : 'Going in';
      case 'retreat': {
        const m = this.mainWeapon();
        return m && SPINNERS.has(m.w.def.type) && m.energy < m.w.energyMax * 0.9 ? 'Spinning up' : 'Backing off';
      }
      case 'flank':
        return 'Flanking';
      case 'push':
        return 'Pushing';
      case 'hold':
        return 'Lining up';
      case 'wait':
        return 'Waiting';
      case 'backoff':
        return 'Run-up';
      case 'carry':
        return 'Carrying';
      case 'unstick':
        return 'Unsticking';
      case 'escape':
        return 'Escaping';
      case 'stalk':
        return 'Biding time';
    }
  }

  get rebooting(): boolean {
    return this.rebootT > 0;
  }

  /**
   * Share of its rated draw reaching the brain right now. The core feeds the
   * electronics last-cut: an overheat takes a fifth, not half, so it is a
   * damaged core on top of the heat that browns a sharp brain out.
   */
  private brainPower(): number {
    const me = this.me;
    return me.s.mind.p * this.world.coreFactor(me) * (me.overheated ? 0.8 : 1);
  }

  /** Re-read the brain at the power it is getting, and the plan it is following. */
  private refresh() {
    const me = this.me;
    const mind = me.s.mind;
    const m = mindAt(mind, Math.max(this.brainPower(), mind.min));
    let agg = STANCE_AGGRESSION[mind.plan.stance];
    if (mind.trait === 'reckless') agg = Math.min(0.97, agg + 0.25);
    if (mind.trait === 'cautious') agg = Math.max(0.2, agg - 0.1);
    this.skill = { reaction: m.reaction, aim: m.aim, aggression: agg, hazardIQ: m.awareness };
    // a sharp brain fires the instant the target lines up; a dull one hesitates
    me.trigger = (1 - m.aim) * 0.45 + m.reaction * 0.15;
  }

  get me(): Bot {
    return this.world.bots[this.idx];
  }

  get op(): Bot {
    return this.world.bots[1 - this.idx];
  }

  /** Call every simulation step. */
  update(dt: number) {
    const me = this.me;
    if (this.world.over) {
      me.ctl.throttle = 0;
      me.ctl.turn = 0;
      me.ctl.strafe = 0;
      return;
    }
    // a brain starved below its minimum (a damaged core, an overheat) browns out
    this.graceT = Math.max(0, this.graceT - dt);
    if (this.rebootT > 0) {
      this.rebootT -= dt;
      if (this.rebootT <= 0) this.graceT = REBOOT_GRACE;
      this.freeze();
      return;
    }
    if (this.graceT <= 0 && !me.ko && this.brainPower() < me.s.mind.min - 1e-9) {
      this.rebootT = REBOOT_TIME;
      this.world.emit({ type: 'reboot', bot: this.idx });
      this.freeze();
      return;
    }
    me.auto = true;
    this.watchStuck(dt);
    if (this.mode === 'stalk') this.stalkT += dt;
    if (this.mode === 'flank') this.flankT += dt;
    if (this.touching()) {
      this.stalkT = Math.max(0, this.stalkT - dt * 2);
      this.flankT = 0;
    }
    this.next -= dt;
    if (this.next <= 0) {
      this.refresh();
      this.next = this.skill.reaction * (0.75 + this.rng() * 0.5);
      this.think();
    }
    this.steer();
  }

  private freeze() {
    const c = this.me.ctl;
    this.me.auto = false;
    c.throttle = 0;
    c.turn = 0;
    c.strafe = 0;
    c.fire = false;
    c.fireTop = false;
    c.boost = false;
  }

  // ---- deciding --------------------------------------------------------------

  private mainWeapon(): WeaponState | null {
    const me = this.me;
    if (me.front && me.front.w.def.type !== 'wedge' && me.comp.front > 0) return me.front;
    if (me.top && me.comp.top > 0) return me.top;
    return me.front && me.comp.front > 0 ? me.front : null;
  }

  private think() {
    const w = this.world;
    const me = this.me;
    const op = this.op;
    if (!w.mobile(me)) return;
    const mind = me.s.mind;
    const careful = !mind.plan.hazards || mind.trait === 'cautious';
    this.notice = this.rng() < 0.25 + this.skill.hazardIQ * 0.75 + (careful ? 0.2 : 0);
    if (this.unstickT > 0) {
      this.mode = 'unstick';
      return;
    }
    if (this.escapeT > 0) {
      this.mode = 'escape';
      return;
    }
    const dx = op.x - me.x;
    const dy = op.y - me.y;
    const dist = Math.hypot(dx, dy);
    const lead = clamp(dist / 4, 0, 0.6) * this.skill.aim;
    const px = op.x + op.vx * lead;
    const py = op.y + op.vy * lead;
    const opDown = op.ko || op.inPit || (op.inverted && !op.s.invertible && op.s.selfRight <= 0);
    this.boost = false;
    this.reverse = false;
    this.throttle = 1;

    if (opDown) {
      // they are being counted out: stay clear
      this.mode = 'wait';
      this.setRetreat(2.5);
      return;
    }

    const main = this.mainWeapon();
    const type = main?.w.def.type ?? 'wedge';
    const danger = this.opDanger();
    // aggressive stances and reckless brains never give ground
    const neverBack = mind.plan.stance === 'aggressive' || mind.trait === 'reckless';
    const [ax, ay] = this.aimPoint(op, px, py);

    // a defensive brain losing the exchange keeps clear while its weapon is not ready
    if (!neverBack && (mind.plan.stance === 'defensive' || mind.trait === 'cautious') && danger && dist < 2.6 && !this.ready(main) && this.losing()) {
      this.mode = 'retreat';
      this.setRetreat(1.8);
      return;
    }

    if (main && SPINNERS.has(type)) {
      const ef = main.energy / Math.max(1, main.w.energyMax);
      const need = (type === 'ring' ? 0.7 : 0.62) - 0.25 * this.skill.aggression;
      if (ef >= need || (dist < 1.1 && ef > 0.22)) {
        if (type !== 'ring' && this.approachFirst(op, dist)) return;
        this.mode = 'attack';
        this.target(ax, ay);
        this.boost = dist > 1.4 && dist < 4 && ef > 0.8;
      } else {
        this.mode = 'retreat';
        this.setRetreat(dist < 3 ? 2 : 0);
      }
      return;
    }

    if (type === 'flipper' || type === 'lifter') {
      if (main?.holding) {
        this.mode = 'carry';
        const [hx, hy] = this.hazardGoal(op);
        this.target(hx, hy);
        return;
      }
      if (danger && dist < 3.2 && this.skill.hazardIQ > 0.25) {
        this.mode = 'flank';
        this.flank(op, 1.25);
        if (Math.abs(this.opFacing()) > 1.3) this.target(ax, ay);
        return;
      }
      if (this.approachFirst(op, dist)) return;
      this.mode = 'attack';
      this.target(ax, ay);
      this.boost = dist > 1.5 && dist < 3.5 && main != null && main.reload <= 0;
      return;
    }

    if (type === 'crusher') {
      if (main?.holding) {
        this.mode = 'carry';
        const [hx, hy] = this.hazardGoal(op);
        this.target(hx, hy);
        return;
      }
      if (!neverBack && danger && dist < 3 && main && main.reload > 0.4) {
        this.mode = 'retreat';
        this.setRetreat(1.8);
        return;
      }
      if (this.approachFirst(op, dist)) return;
      this.mode = 'attack';
      this.target(ax, ay);
      return;
    }

    if (type === 'hammer' || type === 'axe') {
      const reach = me.s.length / 2 + main!.w.reach * 0.7 + op.s.radius;
      const pushy = me.s.frontWedge > 0.35;
      if (pushy && main!.reload > 0.4) {
        this.pushPlan(op);
        return;
      }
      if (!neverBack && danger && main!.reload > 0.5 && dist < 2.5) {
        this.mode = 'retreat';
        this.setRetreat(1.5);
        return;
      }
      if (dist > reach && this.approachFirst(op, dist)) return;
      this.mode = dist < reach ? 'hold' : 'attack';
      this.target(ax, ay);
      if (this.mode === 'hold') this.throttle = 0.15;
      return;
    }

    if (type === 'ram') {
      // a ram needs a short run-up after each hit; pinned against a wall or a
      // hazard, keep shoving instead
      const pinned = w.hazardAt(op.x, op.y, 0.6) > 0 || Math.abs(op.x) > w.half - 1 || Math.abs(op.y) > w.half - 1;
      if (this.backoffT > 0 || (!pinned && me.ramCd > 0.25 && dist < 1.4)) {
        if (this.backoffT <= 0) this.backoffT = 0.45 + this.rng() * 0.3;
        this.mode = 'backoff';
        this.setRetreat(1.6);
        return;
      }
      if (pinned && dist < 1.5) {
        this.pushPlan(op);
        return;
      }
      if (this.approachFirst(op, dist)) return;
      this.mode = 'attack';
      this.target(ax, ay);
      this.boost = dist > 1.3 && dist < 4.5;
      return;
    }

    if (type === 'saw' || type === 'flame') {
      if (me.s.frontWedge > 0.35 || type === 'flame') {
        this.pushPlan(op);
        return;
      }
      this.mode = 'attack';
      this.target(ax, ay);
      return;
    }

    // wedges, plows and anything else: push them into trouble
    this.pushPlan(op);
  }

  /**
   * Before an attack: circle round to their side while they face us (flank
   * plans, hunters), or hold off until they commit (counter plans, adaptive
   * brains). Never for long: the judges score aggression. True if it chose to.
   */
  private approachFirst(op: Bot, dist: number): boolean {
    const mind = this.me.s.mind;
    const ringOp = op.front?.w.def.type === 'ring';
    // a plan is carried out only as well as the brain can: a dull one cannot
    // work round a flank, and runs out of patience on a counter
    const sharp = this.skill.aim;
    if ((mind.plan.approach === 'flank' || mind.trait === 'hunter') && sharp >= 0.55 && !ringOp && dist > 1.0 && dist < 5 && Math.abs(this.opFacing()) < 1.1 && this.flankT < 3) {
      this.mode = 'flank';
      this.flank(op, clamp(dist * 0.8, 1.2, 2));
      return true;
    }
    const patience = (mind.plan.approach === 'counter' ? 5 : mind.trait === 'adaptive' ? 2.5 : 0) * clamp((sharp - 0.3) / 0.5, 0, 1);
    if (patience > 0 && dist > 1.5 && this.stalkT < patience && !this.opCommitted()) {
      this.mode = 'stalk';
      this.stalk(op);
      return true;
    }
    return false;
  }

  /** Has the other robot committed: charging in, or its weapon spent? */
  private opCommitted(): boolean {
    const me = this.me;
    const op = this.op;
    const dx = me.x - op.x;
    const dy = me.y - op.y;
    const d = Math.hypot(dx, dy) || 1;
    if ((op.vx * dx + op.vy * dy) / d > 1.2) return true;
    const w = op.front && op.front.w.def.type !== 'wedge' && op.comp.front > 0 ? op.front : op.top && op.comp.top > 0 ? op.top : null;
    if (!w || w.w.def.power === 0) return true;
    if (w.w.energyMax > 0) return w.energy < w.w.energyMax * 0.45;
    return w.reload > 0.4 || w.holding;
  }

  /** Hold off at a striking distance, circling slowly, weapon toward them. */
  private stalk(op: Bot) {
    const me = this.me;
    const R = 2.3;
    const a = Math.atan2(me.y - op.y, me.x - op.x) + 0.35 * this.flankSide;
    const h = this.world.half - 1;
    this.tx = clamp(op.x + Math.cos(a) * R, -h, h);
    this.ty = clamp(op.y + Math.sin(a) * R, -h, h);
    this.faceX = op.x;
    this.faceY = op.y;
    const far = Math.hypot(this.tx - me.x, this.ty - me.y);
    this.reverse = false;
    this.throttle = far > 0.45 ? 0.55 : 0;
    this.boost = false;
  }

  /** Where to strike: hunters go for the flank nearest them. */
  private aimPoint(op: Bot, px: number, py: number): [number, number] {
    if (this.me.s.mind.trait !== 'hunter') return [px, py];
    const side = wrap(Math.atan2(this.me.y - op.y, this.me.x - op.x) - op.th) > 0 ? 1 : -1;
    const a = op.th + (side * Math.PI) / 2;
    const r = op.s.radius * 0.6;
    return [px + Math.cos(a) * r, py + Math.sin(a) * r];
  }

  private ready(w: WeaponState | null): boolean {
    if (!w) return false;
    if (w.w.energyMax > 0) return w.energy > w.w.energyMax * 0.6;
    return w.reload <= 0 && !w.holding;
  }

  private losing(): boolean {
    const me = this.me;
    const op = this.op;
    return me.hp / me.s.hpMax < op.hp / op.s.hpMax - 0.1;
  }

  private pushPlan(op: Bot) {
    const me = this.me;
    // a live spinner: meet it front-on, where the wedge deflects it, and get under
    const spin = op.front && SPINNERS.has(op.front.w.def.type) && op.comp.front > 0 && op.front.energy > op.front.w.energyMax * 0.3;
    if (spin && me.s.frontWedge > 0.5 && !this.touching()) {
      this.mode = 'push';
      this.target(op.x, op.y);
      this.boost = Math.hypot(op.x - me.x, op.y - me.y) < 2.5;
      return;
    }
    const [gx, gy] = this.hazardGoal(op);
    let ux = gx - op.x;
    let uy = gy - op.y;
    const ul = Math.hypot(ux, uy) || 1;
    ux /= ul;
    uy /= ul;
    const behindX = op.x - ux * (me.s.radius + op.s.radius + 0.5);
    const behindY = op.y - uy * (me.s.radius + op.s.radius + 0.5);
    const lined = Math.hypot(behindX - me.x, behindY - me.y) < 0.7 || this.touching();
    if (lined || this.skill.hazardIQ < 0.4 || Math.hypot(op.x - me.x, op.y - me.y) < 1.2) {
      this.mode = 'push';
      this.target(op.x + ux * 0.6, op.y + uy * 0.6);
      this.boost = this.touching() || Math.hypot(op.x - me.x, op.y - me.y) < 2.5;
    } else {
      this.mode = 'flank';
      this.target(behindX, behindY);
    }
  }

  private touching(): boolean {
    const me = this.me;
    const op = this.op;
    return Math.hypot(op.x - me.x, op.y - me.y) < me.s.length / 2 + op.s.length / 2 + 0.15;
  }

  /** The best place to shove the opponent: open pit, hazards, spiked walls, else the nearest wall. */
  private hazardGoal(op: Bot): [number, number] {
    const w = this.world;
    const ar = w.arena;
    const h = w.half;
    const opts: Array<[number, number, number]> = [];
    const wx = op.x > 0 ? h : -h;
    const wy = op.y > 0 ? h : -h;
    const wall: [number, number, number] = Math.abs(op.x) > Math.abs(op.y) ? [wx, op.y, 0.5] : [op.x, wy, 0.5];
    // told to fight in the open: pin them on a plain wall at most
    if (!this.me.s.mind.plan.hazards) return [wall[0], wall[1]];
    if (ar.pit && (w.pitOpen || w.t + 4 > ar.pit.opensAt)) opts.push([ar.pit.x, ar.pit.y, 3]);
    for (const s of ar.saws ?? []) opts.push([s.x, s.y, 1.2]);
    if (ar.hammer) opts.push([ar.hammer.x, ar.hammer.y, 1.4]);
    for (const f of ar.flames ?? []) opts.push([f.x, f.y, 0.8]);
    for (const sp of ar.spikes ?? []) {
      const mid = (sp.from + sp.to) / 2;
      if (sp.side === 'n') opts.push([mid, h, 1.1]);
      if (sp.side === 's') opts.push([mid, -h, 1.1]);
      if (sp.side === 'e') opts.push([h, mid, 1.1]);
      if (sp.side === 'w') opts.push([-h, mid, 1.1]);
    }
    // plain walls
    opts.push(wall);
    let best = opts[opts.length - 1];
    let bestScore = -Infinity;
    for (const o of opts) {
      const d = Math.hypot(o[0] - op.x, o[1] - op.y);
      const score = o[2] * this.skill.hazardIQ * 2 - d * 0.6;
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    return [best[0], best[1]];
  }

  /** How squarely the opponent faces us (0 = dead on). */
  private opFacing(): number {
    const me = this.me;
    const op = this.op;
    return wrap(Math.atan2(me.y - op.y, me.x - op.x) - op.th);
  }

  /** Is the opponent's weapon a threat from where we are? */
  private opDanger(): boolean {
    const op = this.op;
    const f = Math.abs(this.opFacing());
    const fw = op.front;
    if (fw && op.comp.front > 0) {
      const t = fw.w.def.type;
      if (SPINNERS.has(t) && fw.energy > fw.w.energyMax * 0.4 && (t === 'ring' || f < fw.w.arc + 0.5)) return true;
      if ((t === 'flipper' || t === 'lifter' || t === 'crusher') && fw.reload <= 0 && f < 0.8) return true;
    }
    const tw = op.top;
    if (tw && op.comp.top > 0 && (tw.w.def.type === 'hammer' || tw.w.def.type === 'axe') && tw.reload <= 0 && f < 0.6) return true;
    return false;
  }

  private flank(op: Bot, r: number) {
    const me = this.me;
    // pick the flank on our side of their heading
    const side = wrap(Math.atan2(me.y - op.y, me.x - op.x) - op.th) > 0 ? 1 : -1;
    this.flankSide = side;
    const a = op.th + side * 1.75;
    this.target(op.x + Math.cos(a) * r, op.y + Math.sin(a) * r);
    this.boost = false;
  }

  /** Back away from the opponent while keeping the weapon pointed at them. */
  private setRetreat(dist: number) {
    const me = this.me;
    const op = this.op;
    const h = this.world.half - 1;
    let ax = me.x - op.x;
    let ay = me.y - op.y;
    const l = Math.hypot(ax, ay) || 1;
    ax /= l;
    ay /= l;
    let tx = me.x + ax * dist;
    let ty = me.y + ay * dist;
    // near a wall: slide along it instead
    if (Math.abs(tx) > h || Math.abs(ty) > h) {
      const sx = -ay * this.flankSide;
      const sy = ax * this.flankSide;
      tx = me.x + sx * dist;
      ty = me.y + sy * dist;
      if (Math.abs(tx) > h || Math.abs(ty) > h) this.flankSide *= -1;
    }
    this.tx = clamp(tx, -h, h);
    this.ty = clamp(ty, -h, h);
    this.faceX = op.x;
    this.faceY = op.y;
    this.reverse = dist > 0;
    this.throttle = dist > 0 ? 0.85 : 0;
  }

  private target(x: number, y: number) {
    const h = this.world.half - 0.45;
    // aim wobble for less skilled drivers
    const n = (1 - this.skill.aim) * 0.9;
    const t = this.world.t;
    this.tx = clamp(x + Math.sin(t * 0.9 + this.noise) * n, -h, h);
    this.ty = clamp(y + Math.cos(t * 1.1 + this.noise) * n, -h, h);
    this.faceX = this.tx;
    this.faceY = this.ty;
  }

  // ---- steering --------------------------------------------------------------

  private watchStuck(dt: number) {
    const me = this.me;
    this.backoffT = Math.max(0, this.backoffT - dt);
    this.escapeT = Math.max(0, this.escapeT - dt);
    const pinned = me.wedged > 0 && me.wedgeK > 0.3;
    this.pinnedT = pinned ? this.pinnedT + dt : Math.max(0, this.pinnedT - dt * 2);
    // a wedge has us: back off it, twisting, before we get shoved into something
    if (this.pinnedT > 0.55 + (1 - this.skill.aim) * 0.6 && this.escapeT <= 0 && this.unstickT <= 0) {
      this.escapeT = 0.7 + this.rng() * 0.4;
      this.flankSide = this.rng() < 0.5 ? 1 : -1;
      this.pinnedT = 0;
      this.mode = 'escape';
    }
    if (this.unstickT > 0) {
      this.unstickT -= dt;
      return;
    }
    const pushing = Math.abs(me.ctl.throttle) > 0.5 && me.speed < 0.15 && this.world.mobile(me);
    const contact = this.touching();
    this.stuckT = pushing && !(contact && this.mode !== 'unstick' && this.mode !== 'retreat') ? this.stuckT + dt : 0;
    if (contact && pushing) this.stuckT += dt * 0.25;
    if (this.stuckT > 1.4) {
      this.stuckT = 0;
      this.unstickT = 0.7;
      this.mode = 'unstick';
    }
  }

  private steer() {
    const w = this.world;
    const me = this.me;
    const c = me.ctl;
    c.fire = false;
    c.fireTop = false;
    c.boost = false;
    if (!w.mobile(me)) {
      c.throttle = 0;
      c.turn = 0;
      c.strafe = 0;
      return;
    }
    if (this.mode === 'unstick') {
      c.throttle = -0.9;
      c.turn = this.flankSide;
      c.strafe = 0;
      return;
    }
    if (this.mode === 'escape') {
      c.throttle = -1;
      c.turn = this.flankSide;
      c.strafe = me.s.strafe ? this.flankSide : 0;
      c.boost = true;
      if (this.escapeT <= 0) this.mode = 'attack';
      return;
    }
    // face the point, then drive at it (or away from it, in reverse)
    const dist = Math.hypot(this.tx - me.x, this.ty - me.y);
    let heading: number;
    let base = this.throttle;
    if (base <= 0.01 || dist < 0.05) {
      heading = Math.atan2(this.faceY - me.y, this.faceX - me.x);
      base = 0;
    } else {
      const move = this.avoid(Math.atan2(this.ty - me.y, this.tx - me.x));
      heading = this.reverse ? wrap(move + Math.PI) : move;
    }
    const err = wrap(heading - me.th);
    // a dull brain lets small errors ride and overcorrects the big ones
    const sloppy = 1 - this.skill.aim;
    c.turn = clamp(turnToward(Math.abs(err) < sloppy * 0.35 ? 0 : err, me.s.turnRate, me.s.turnAccel) * (1 + sloppy * 0.4), -1, 1);
    const align = Math.cos(err);
    let thr = align > 0.2 ? base * Math.pow(align, 1.4) : base > 0 ? 0.1 : 0;
    if (dist < 0.3 && this.mode !== 'attack' && this.mode !== 'push') thr *= dist / 0.3;
    c.throttle = this.reverse ? -thr : thr;
    c.strafe = 0;
    if (me.s.strafe && this.mode === 'flank') {
      // mecanum: slide toward the flank while turning
      c.strafe = clamp(-Math.sin(err) * 1.2, -1, 1);
    }
    c.boost = this.boost && Math.abs(err) < 0.35;
  }

  /** Bend a heading around hazards ahead, as far as the driver notices them. */
  private avoid(goal: number): number {
    const w = this.world;
    const me = this.me;
    const iq = this.skill.hazardIQ;
    if (iq < 0.05) return goal;
    const look = 0.6 + me.speed * 0.35;
    const probe = (a: number) => w.hazardAt(me.x + Math.cos(a) * look, me.y + Math.sin(a) * look, me.s.radius * 0.6);
    // carrying or pushing an opponent into a hazard: keep going
    if (this.me.s.mind.plan.hazards && (this.mode === 'carry' || (this.mode === 'push' && this.touching()))) {
      const d = probe(goal);
      if (d < 2.5 || this.mode === 'carry') return goal;
    }
    const ahead = probe(goal);
    if (ahead === 0) return goal;
    // the open pit is impossible to miss for anyone half decent
    if (!this.notice && !(ahead >= 3 && iq > 0.3)) return goal;
    for (const off of [0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3]) {
      if (probe(goal + off) === 0) return goal + off;
    }
    return goal + Math.PI;
  }
}
