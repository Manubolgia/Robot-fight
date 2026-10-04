// The arena on screen: places the robot models where the simulation has
// them, turns simulation events into sparks, smoke and shaking, and flies a
// camera that keeps both robots framed on a portrait phone.

import * as THREE from 'three';
import type { BotDesign } from '../data/types.ts';
import type { Bot, SimEvent, World } from '../sim/world.ts';
import { animateArena, buildArena, type ArenaView } from './arenaMesh.ts';
import { buildBot, poseWeapon, type BotView } from './botMesh.ts';
import { Effects } from './effects.ts';
import { envMap, getQuality } from './gfx.ts';

export interface Snap {
  x: number;
  y: number;
  th: number;
  z: number;
  flip: number;
  axis: 'roll' | 'pitch';
  tilt: number;
}

export const snap = (b: Bot): Snap => ({ x: b.x, y: b.y, th: b.th, z: b.z, flip: b.flip, axis: b.flipAxis, tilt: b.tilt });

const TAU = Math.PI * 2;
const lerpAngle = (a: number, b: number, t: number) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
};

const ARMOR_COLORS: Record<string, number> = { alu: 0xc9ced6, steel: 0x737881, uhmw: 0xeeebe2, titanium: 0x9aa6bb, composite: 0x222428, nano: 0x404858 };

export type CamMode = 'intro' | 'fight' | 'ko' | 'orbit';

export class FightView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 140);
  readonly arena: ArenaView;
  readonly bots: BotView[];
  readonly fx = new Effects();
  private world: World;
  private shake = 0;
  private camLook = new THREE.Vector3();
  private camPos = new THREE.Vector3(0, 14, 12);
  private armorGone: Array<Record<string, boolean>> = [{}, {}];
  private excitement = 0;
  private time = 0;
  mode: CamMode = 'intro';
  modeT = 0;
  koBot = -1;
  /** fraction of the screen height the HUD covers top and bottom */
  insetTop = 0.13;
  insetBottom = 0.17;

  constructor(world: World, designs: [BotDesign, BotDesign]) {
    this.world = world;
    const q = getQuality();
    this.fx.low = q === 'low';
    this.arena = buildArena(world.arena, q);
    this.scene.add(this.arena.group);
    this.scene.background = new THREE.Color(world.arena.theme.fog);
    this.scene.fog = new THREE.Fog(world.arena.theme.fog, 16, 46);
    this.scene.environment = envMap();
    this.scene.environmentIntensity = 0.45;
    this.bots = designs.map((d, i) => buildBot(d, { corner: i === 0 ? 'blue' : 'red', number: String(i + 1) }));
    for (const b of this.bots) this.scene.add(b.root);
    this.scene.add(this.fx.group);
    const H = world.half;
    this.camPos.set(0, H * 2.4, H * 2.6);
    this.camLook.set(0, 0, 0);
  }

  setSize(w: number, h: number, pixelRatio: number) {
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 52 : 40;
    const off = (this.insetTop - this.insetBottom) / 2;
    this.camera.setViewOffset(w, h, 0, -off * h, w, h);
    this.camera.updateProjectionMatrix();
    this.fx.setScale((h * pixelRatio) / 2 / Math.tan((this.camera.fov * Math.PI) / 360));
  }

  setMode(m: CamMode, bot = -1) {
    this.mode = m;
    this.modeT = 0;
    if (bot >= 0) this.koBot = bot;
  }

  /** Draw a frame: robots between two simulation steps (alpha), effects on real time. */
  frame(prev: Snap[], cur: Snap[], alpha: number, dt: number) {
    const w = this.world;
    this.time += dt;
    this.modeT += dt;
    this.excitement = Math.max(0, this.excitement - dt * 0.6);
    for (let i = 0; i < 2; i++) this.placeBot(i, prev[i], cur[i], alpha, dt);
    animateArena(this.arena, w.arena, w.t, dt, w.pitOpen, w.hammerAnim, this.camera, this.excitement);
    this.ambient(dt);
    this.fx.update(dt);
    this.updateCamera(cur, dt);
  }

  private placeBot(i: number, a: Snap, b: Snap, t: number, dt: number) {
    const v = this.bots[i];
    const bot = this.world.bots[i];
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const z = a.z + (b.z - a.z) * t;
    const th = lerpAngle(a.th, b.th, t);
    v.root.position.set(x, 0, -y);
    v.root.rotation.y = th;
    v.lift.position.y = v.height / 2 + z;
    const flip = a.axis === b.axis ? a.flip + (b.flip - a.flip) * t : b.flip;
    const tilt = a.tilt + (b.tilt - a.tilt) * t;
    if (b.axis === 'roll') {
      v.lift.rotation.set(flip, 0, tilt);
    } else {
      v.lift.rotation.set(0, 0, flip + tilt);
    }
    // wheels and tracks
    const fwd = bot.vx * Math.cos(bot.th) + bot.vy * Math.sin(bot.th);
    const spinW = bot.airborne ? 0 : fwd + bot.w * v.width * 0.3;
    v.wheelAngle -= (spinW * dt) / v.wheelR;
    for (const wh of v.wheels) wh.rotation.z = v.wheelAngle;
    for (const tr of v.treads) tr.offset.y -= fwd * dt * 1.2;
    // weapons
    for (const [rig, ws] of [[v.front, bot.front], [v.top, bot.top]] as const) {
      if (!rig || !ws) continue;
      const ef = ws.w.energyMax > 0 ? ws.energy / ws.w.energyMax : ws.firing ? 1 : 0;
      poseWeapon(rig, ws.spin, ef, ws.anim);
      if (rig.nozzle && ws.firing) {
        const p = rig.nozzle.getWorldPosition(new THREE.Vector3());
        const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(rig.nozzle.getWorldQuaternion(new THREE.Quaternion()));
        this.fx.flame(p, dir.x, dir.y + 0.05, dir.z, 1);
      }
    }
    // armour panels knocked off
    for (const zone of ['front', 'left', 'right', 'rear'] as const) {
      if (bot.s.armorMax[zone] > 0 && bot.armor[zone] <= 0 && !this.armorGone[i][zone]) {
        this.armorGone[i][zone] = true;
        for (const p of v.armor[zone]) {
          p.visible = false;
          const wp = p.getWorldPosition(new THREE.Vector3());
          this.fx.chunks(wp, 4, ARMOR_COLORS[bot.s.armor.look] ?? 0x999999, 1);
        }
      }
    }
    // scorching, smoke and fire as it gets beaten up
    const hpFrac = Math.max(0, bot.hp / bot.s.hpMax);
    const k = 0.45 + 0.55 * hpFrac;
    v.paintMat.color.setRGB(k, k * (bot.burning > 0 ? 0.8 : 1), k * (bot.burning > 0 ? 0.7 : 1));
    if (!bot.inPit) this.fx.damaged(v.root.position.clone().setY(v.height + z + 0.05), hpFrac, bot.burning > 0, dt);
    // power light: blinks while being counted, dark when out
    const blink = bot.ko ? 0 : bot.immobileT > 0.5 ? (Math.floor(this.time * 6) % 2 ? 1 : 0.1) : 1;
    v.led.color.setHex(i === 0 ? 0x2ee6ff : 0xff3b30).multiplyScalar(blink);
    if (bot.boostT > 0 && Math.random() < dt * 40) {
      const back = new THREE.Vector3(-Math.cos(bot.th) * v.length * 0.55, 0.12 + z, Math.sin(bot.th) * v.length * 0.55).add(v.root.position);
      this.fx.boost(back, -Math.cos(bot.th), Math.sin(bot.th));
    }
  }

  private ambient(dt: number) {
    const w = this.world;
    for (const vent of this.arena.vents) {
      const z = vent.zone;
      const ph = (((w.t + z.offset) % z.period) + z.period) % z.period;
      if (ph < z.active && Math.random() < dt * 40) this.fx.vent(new THREE.Vector3(z.x, 0, -z.y), z.r);
    }
  }

  /** Effects for what just happened in the simulation. */
  onEvents(events: SimEvent[]) {
    const w = this.world;
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const p = new THREE.Vector3(e.x, Math.max(0.12, e.z + (e.zone === 'top' ? 0.05 : 0.15)), -e.y);
          const power = Math.min(1.6, e.dmg / 110);
          const dx = e.nx;
          const dz = -e.ny;
          if (e.big) {
            this.fx.bigHit(p, power, dx, dz);
            this.shake = Math.min(1.2, this.shake + 0.25 + power * 0.45);
            this.excitement = Math.min(1, this.excitement + 0.4);
          } else {
            this.fx.sparksAt(p, 6 + Math.round(power * 14), dx * 0.4, dz * 0.4, 0.7 + power * 0.5);
            this.shake = Math.min(1, this.shake + power * 0.15);
          }
          if (e.dmg > 70 && e.to >= 0) {
            const bot = w.bots[e.to];
            const zoneArmor = bot.armor[e.zone] > 0;
            this.fx.chunks(p, Math.min(5, 1 + Math.floor(e.dmg / 75)), zoneArmor ? (ARMOR_COLORS[bot.s.armor.look] ?? 0x999999) : bot.s.paint.primary, 0.8 + power * 0.4);
          }
          break;
        }
        case 'clash': {
          const p = new THREE.Vector3(e.x, e.z, -e.y);
          this.fx.bigHit(p, 1.2, 0, 0);
          this.fx.sparksAt(p, 40, 0, 0, 2);
          this.shake = Math.min(1.3, this.shake + 0.8);
          this.excitement = Math.min(1, this.excitement + 0.5);
          break;
        }
        case 'sparks':
          this.fx.sparksAt(new THREE.Vector3(e.x, Math.max(0.05, e.z), -e.y), e.n, e.nx * 0.5, -e.ny * 0.5, e.hot ? 0.8 : 1);
          break;
        case 'flip': {
          const b = w.bots[e.bot];
          this.fx.dust(new THREE.Vector3(b.x, 0, -b.y), 10);
          this.shake = Math.min(1, this.shake + 0.3);
          this.excitement = Math.min(1, this.excitement + 0.6);
          break;
        }
        case 'land':
          if (e.impact > 2.5) {
            this.fx.dust(new THREE.Vector3(e.x, 0, -e.y), Math.min(14, Math.round(e.impact * 2)));
            this.fx.ring(new THREE.Vector3(e.x, 0, -e.y), 0.5 + e.impact * 0.12, 0.35);
            this.shake = Math.min(1, this.shake + e.impact * 0.06);
          }
          break;
        case 'fire':
          if (e.weapon === 'flipper') this.fx.dust(new THREE.Vector3(e.x, 0, -e.y), 6);
          break;
        case 'pitfall': {
          const b = w.bots[e.bot];
          this.fx.dust(new THREE.Vector3(b.x, 0, -b.y), 16);
          this.excitement = 1;
          break;
        }
        case 'ko': {
          const b = w.bots[e.bot];
          const p = new THREE.Vector3(b.x, 0.3, -b.y);
          if (e.method === 'destroyed') {
            this.fx.bigHit(p, 1.6, 0, 0);
            this.fx.chunks(p, 14, b.s.paint.primary, 1.6);
            this.fx.chunks(p, 8, ARMOR_COLORS[b.s.armor.look] ?? 0x999999, 1.4);
            for (let k = 0; k < 14; k++) this.fx.puff(p, 0.4 + Math.random() * 0.4, 0.1, 2.5);
            this.shake = 1.4;
          }
          this.excitement = 1;
          break;
        }
        case 'compdown': {
          const b = w.bots[e.bot];
          const p = new THREE.Vector3(b.x, 0.4, -b.y);
          this.fx.sparksAt(p, 24, 0, 0, 1.2);
          for (let k = 0; k < 5; k++) this.fx.puff(p, 0.3, 0.15, 2);
          break;
        }
        case 'wall':
          if (e.speed > 3) {
            this.fx.sparksAt(new THREE.Vector3(e.x, 0.2, -e.y), Math.round(e.speed * 3), 0, 0, 0.8);
            this.shake = Math.min(1, this.shake + 0.12);
          }
          break;
        case 'hazard': {
          const p = new THREE.Vector3(e.x, 0.15, -e.y);
          if (e.kind === 'hammer') {
            this.fx.bigHit(p, 1.3, 0, 0);
            this.fx.dust(p, 14);
            this.shake = Math.min(1.3, this.shake + 0.9);
            this.excitement = Math.min(1, this.excitement + 0.6);
          } else if (e.kind === 'spikes') {
            this.fx.sparksAt(p, 14, 0, 0, 1);
          } else if (e.kind === 'saw') {
            this.fx.sparksAt(p, 12, 0, 0, 1.2);
          }
          break;
        }
        case 'boost': {
          const b = w.bots[e.bot];
          this.fx.dust(new THREE.Vector3(b.x, 0, -b.y), 6);
          break;
        }
        default:
          break;
      }
    }
  }

  private updateCamera(cur: Snap[], dt: number) {
    const cam = this.camera;
    const H = this.world.half;
    const k = 1 - Math.exp(-dt * 3.2);
    const look = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const aspect = cam.aspect;
    const vf = (cam.fov * Math.PI) / 360;
    const hf = Math.atan(Math.tan(vf) * aspect);
    const pitch = 0.98; // ~56 degrees down
    if (this.mode === 'intro' || this.mode === 'orbit') {
      const t = this.modeT;
      const a = (this.mode === 'intro' ? -0.9 + t * 0.35 : t * 0.15) + 0.3;
      const r = H * (this.mode === 'intro' ? 2.3 - Math.min(1, t / 3) * 0.6 : 2.2);
      look.set(0, 0, 0);
      pos.set(Math.sin(a) * r, H * (this.mode === 'intro' ? 1.9 - Math.min(1, t / 3) * 0.6 : 1.5), Math.cos(a) * r);
      this.camLook.lerp(look, this.mode === 'intro' && t < 0.05 ? 1 : k);
      this.camPos.lerp(pos, this.mode === 'intro' && t < 0.05 ? 1 : k);
    } else {
      const [a, b] = cur;
      let tx: number;
      let ty: number;
      let spreadX: number;
      let spreadY: number;
      if (this.mode === 'ko' && this.koBot >= 0) {
        const kb = cur[this.koBot];
        tx = kb.x;
        ty = kb.y;
        spreadX = 0.4;
        spreadY = 0.4;
      } else {
        tx = a.x * 0.55 + b.x * 0.45;
        ty = a.y * 0.55 + b.y * 0.45;
        spreadX = Math.abs(a.x - b.x);
        spreadY = Math.abs(a.y - b.y);
      }
      const margin = this.mode === 'ko' ? 1.2 : 1.6;
      const needX = (spreadX / 2 + margin) / Math.tan(hf);
      const needY = ((spreadY / 2) * Math.sin(pitch) + margin) / Math.tan(vf);
      const minD = this.mode === 'ko' ? (aspect < 1 ? 6 : 4.2) : aspect < 1 ? 8.5 : 6;
      const d = Math.max(minD, Math.min(H * 2.8, Math.max(needX, needY)));
      const lim = H * 0.85;
      look.set(Math.max(-lim, Math.min(lim, tx)), 0, -Math.max(-lim, Math.min(lim, ty)));
      pos.set(look.x * 0.85, d * Math.sin(pitch), look.z + d * Math.cos(pitch));
      const kk = this.mode === 'ko' ? 1 - Math.exp(-dt * 2) : k;
      this.camLook.lerp(look, kk);
      this.camPos.lerp(pos, kk);
    }
    this.shake *= Math.exp(-dt * 7);
    const s = this.shake * 0.12;
    cam.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camPos.y + (Math.random() - 0.5) * s, this.camPos.z + (Math.random() - 0.5) * s);
    cam.lookAt(this.camLook);
  }

  addShake(v: number) {
    this.shake = Math.min(1.5, this.shake + v);
  }

  render(r: THREE.WebGLRenderer) {
    r.render(this.scene, this.camera);
  }

  /** Screen position (CSS px) of a point in the arena. */
  toScreen(x: number, y: number, h: number, w: number, hpx: number): { x: number; y: number; visible: boolean } {
    const v = new THREE.Vector3(x, h, -y).project(this.camera);
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * hpx, visible: v.z < 1 };
  }

  dispose() {
    for (const b of this.bots) b.dispose();
    this.arena.dispose();
    this.fx.dispose();
  }
}
