// Builds a robot's 3D model from its design: frame shape, armour plates in
// the armour's material, wheels or tracks, the weapons with their moving
// parts, and the modules. The same model is used in the garage and the arena.
//
// Local axes: +x forward, +y up, +z the robot's right side.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { armorOf, chassisOf, driveOf, moduleOf, weaponOf } from '../data/parts.ts';
import type { BotDesign, HitZone, WeaponDef, WeaponType } from '../data/types.ts';
import { brushedTexture, carbonTexture, hubTexture, numberTexture, paintTexture, tireTexture, treadTexture } from './textures.ts';

export interface WeaponRig {
  type: WeaponType;
  slot: 'front' | 'top';
  /** spins with the weapon */
  spinner?: THREE.Object3D;
  spinAxis: 'x' | 'y' | 'z';
  /** translucent disc shown when spinning fast */
  blur?: THREE.Mesh;
  /** hinged parts: rotated about z between rest and fire */
  pivot?: THREE.Object3D;
  rest: number;
  fire: number;
  /** a second hinged part (clamp claws) */
  pivot2?: THREE.Object3D;
  rest2: number;
  fire2: number;
  /** where flames come out, in body space */
  nozzle?: THREE.Object3D;
}

export interface BotView {
  root: THREE.Group;
  lift: THREE.Group;
  body: THREE.Group;
  height: number;
  length: number;
  width: number;
  wheels: THREE.Object3D[];
  wheelR: number;
  treads: THREE.Texture[];
  front: WeaponRig | null;
  top: WeaponRig | null;
  armor: Record<HitZone, THREE.Object3D[]>;
  paintMat: THREE.MeshStandardMaterial;
  frameMat: THREE.MeshStandardMaterial;
  led: THREE.MeshBasicMaterial;
  wheelAngle: number;
  dispose(): void;
}

const ARMOR_LOOK: Record<string, () => THREE.MeshStandardMaterial> = {
  alu: () => new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.85, roughness: 0.38, map: brushedTexture() }),
  steel: () => new THREE.MeshStandardMaterial({ color: 0x737881, metalness: 0.9, roughness: 0.52, map: brushedTexture() }),
  uhmw: () => new THREE.MeshStandardMaterial({ color: 0xeeebe2, metalness: 0.0, roughness: 0.72 }),
  titanium: () => new THREE.MeshStandardMaterial({ color: 0x9aa6bb, metalness: 0.92, roughness: 0.3, map: brushedTexture() }),
  composite: () => new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.35, roughness: 0.42, map: carbonTexture() }),
  nano: () => new THREE.MeshStandardMaterial({ color: 0x404858, metalness: 1, roughness: 0.18, emissive: 0x0a1a33, emissiveIntensity: 0.6 }),
};

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const box = (w: number, h: number, d: number, r = 0) => (r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d));

/** A side profile (x right, y up) extruded across the robot's width, centred. */
function profile(points: Array<[number, number]>, width: number, bevel = 0.012): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.computeVertexNormals();
  return g;
}

export interface BuildOptions {
  /** corner colour for the power light: blue for the player, red for the opponent */
  corner?: 'blue' | 'red' | 'none';
  number?: string;
}

export function buildBot(d: BotDesign, opts: BuildOptions = {}): BotView {
  const ch = chassisOf(d.chassis);
  const L = ch.length;
  const W = ch.width;
  const H = ch.height;
  const root = new THREE.Group();
  const lift = new THREE.Group();
  const body = new THREE.Group();
  root.add(lift);
  lift.add(body);
  lift.position.y = H / 2;

  const disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  const track = <T extends THREE.BufferGeometry | THREE.Material>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const paintMat = track(new THREE.MeshStandardMaterial({ map: paintTexture(d.paint), metalness: 0.35, roughness: 0.45 }));
  const secMat = track(new THREE.MeshStandardMaterial({ color: d.paint.secondary, metalness: 0.45, roughness: 0.42 }));
  const frameMat = track(new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.75, roughness: 0.48 }));
  const steelMat = track(new THREE.MeshStandardMaterial({ color: 0xbfc5cd, metalness: 1, roughness: 0.22 }));
  const toothMat = track(new THREE.MeshStandardMaterial({ color: 0xe9edf2, metalness: 1, roughness: 0.15 }));
  const darkMat = track(new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.4, roughness: 0.7 }));
  const rubberMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: tireTexture(), metalness: 0, roughness: 0.92 }));
  const hubMat = track(new THREE.MeshStandardMaterial({ map: hubTexture(), metalness: 0.6, roughness: 0.4 }));
  const ledColor = opts.corner === 'red' ? 0xff3b30 : opts.corner === 'blue' ? 0x2ee6ff : 0x7dff7a;
  const led = track(new THREE.MeshBasicMaterial({ color: ledColor }));
  const armorLook = armorOf(d.armor.material).look;
  const armorMat = track(ARMOR_LOOK[armorLook]());

  const armor: Record<HitZone, THREE.Object3D[]> = { front: [], left: [], right: [], rear: [], top: [] };
  const plate = (n: number) => 0.008 + n * 0.007;

  // ---- frame ----------------------------------------------------------------
  let frontX = L / 2; // where the front face is, at weapon height
  let topY = H / 2;
  const bottom = -H / 2;
  switch (ch.shape) {
    case 'box':
    case 'tall': {
      const h = ch.shape === 'tall' ? H * 0.62 : H;
      const y0 = bottom + h / 2;
      body.add(mesh(track(box(L * 0.96, h * 0.96, W * 0.96, 0.03)), frameMat, 0, y0, 0));
      topY = bottom + h;
      // top panel, painted
      const tp = mesh(track(box(L * 0.94, plate(d.armor.top), W * 0.9, 0.006)), paintMat, 0, topY + plate(d.armor.top) / 2 - 0.004, 0);
      body.add(tp);
      armor.top.push(tp);
      // front, sides, rear plates
      const fp = mesh(track(box(plate(d.armor.front), h * 0.86, W * 0.88, 0.005)), d.armor.front ? armorMat : secMat, L * 0.48 + plate(d.armor.front) / 2, y0, 0);
      body.add(fp);
      armor.front.push(fp);
      const rp = mesh(track(box(plate(d.armor.rear), h * 0.8, W * 0.86, 0.005)), d.armor.rear ? armorMat : frameMat, -L * 0.48 - plate(d.armor.rear) / 2, y0, 0);
      body.add(rp);
      armor.rear.push(rp);
      for (const side of [-1, 1]) {
        const sp = mesh(track(box(L * 0.82, h * 0.72, plate(d.armor.sides), 0.005)), d.armor.sides ? armorMat : secMat, 0, y0 + h * 0.06, side * (W * 0.48 + plate(d.armor.sides) / 2));
        body.add(sp);
        (side < 0 ? armor.left : armor.right).push(sp);
      }
      if (ch.shape === 'tall') {
        // the tower that carries the overhead weapon
        const th = H - h;
        const tower = mesh(track(box(L * 0.36, th, W * 0.66, 0.025)), paintMat, -L * 0.22, topY + th / 2, 0);
        body.add(tower);
        armor.top.push(tower);
        const brace = mesh(track(box(L * 0.5, 0.03, W * 0.7)), frameMat, -L * 0.1, topY + 0.015, 0);
        body.add(brace);
        topY = topY + 0.02;
      }
      break;
    }
    case 'wedge': {
      const xb = -L / 2 + L * 0.42;
      const lip = 0.028;
      const pts: Array<[number, number]> = [
        [-L / 2, bottom + 0.01],
        [-L / 2, bottom + H],
        [xb, bottom + H],
        [L / 2, bottom + lip],
        [L / 2 - 0.02, bottom],
        [-L / 2 + 0.02, bottom],
      ];
      body.add(mesh(track(profile(pts, W * 0.96)), frameMat));
      // sloped front plate, the armour that gets hit
      const sx = L / 2 - xb;
      const sy = H - lip;
      const slope = Math.hypot(sx, sy);
      const ang = Math.atan2(sy, sx);
      const t = plate(d.armor.front);
      const fp = mesh(track(box(slope * 0.98, t, W * 0.94, 0.004)), d.armor.front ? armorMat : paintMat, 0, 0, 0);
      fp.rotation.z = -ang;
      fp.position.set((xb + L / 2) / 2 + Math.sin(ang) * t * 0.5, bottom + lip + sy / 2 + Math.cos(ang) * t * 0.5, 0);
      body.add(fp);
      armor.front.push(fp);
      // painted top deck at the back
      const tp = mesh(track(box(xb + L / 2 - 0.02, plate(d.armor.top), W * 0.9, 0.005)), paintMat, (-L / 2 + xb) / 2, bottom + H + plate(d.armor.top) / 2 - 0.004, 0);
      body.add(tp);
      armor.top.push(tp);
      const rp = mesh(track(box(plate(d.armor.rear), H * 0.8, W * 0.86, 0.004)), d.armor.rear ? armorMat : frameMat, -L / 2 - plate(d.armor.rear) / 2, 0, 0);
      body.add(rp);
      armor.rear.push(rp);
      for (const side of [-1, 1]) {
        const g = profile(pts.map(([x, y]) => [x * 0.94, y * 0.82] as [number, number]), plate(d.armor.sides) + 0.004, 0);
        const sp = mesh(track(g), d.armor.sides ? armorMat : secMat, 0, 0, side * (W * 0.48 + plate(d.armor.sides) / 2));
        body.add(sp);
        (side < 0 ? armor.left : armor.right).push(sp);
      }
      frontX = L / 2;
      topY = bottom + H;
      break;
    }
    case 'low': {
      const c = Math.min(0.07, H * 0.45);
      const pts: Array<[number, number]> = [
        [-L / 2, bottom + c],
        [-L / 2 + c * 1.6, bottom + H],
        [L / 2 - c * 1.6, bottom + H],
        [L / 2, bottom + c],
        [L / 2 - c * 1.6, bottom],
        [-L / 2 + c * 1.6, bottom],
      ];
      body.add(mesh(track(profile(pts, W * 0.96)), frameMat));
      const tp = mesh(track(box(L - c * 3.4, plate(d.armor.top), W * 0.9, 0.004)), paintMat, 0, bottom + H + plate(d.armor.top) / 2 - 0.003, 0);
      body.add(tp);
      armor.top.push(tp);
      // under panel mirrors the top (it is invertible)
      const bp = mesh(track(box(L - c * 3.4, 0.008, W * 0.9)), secMat, 0, bottom - 0.002, 0);
      body.add(bp);
      for (const [zone, sx] of [['front', 1], ['rear', -1]] as const) {
        const n = d.armor[zone];
        const g = profile(
          [[sx * (L / 2 - c * 1.6), bottom + H], [sx * (L / 2 + plate(n)), bottom + c], [sx * (L / 2 - c * 1.6), bottom]].map(([x, y]) => [x, y] as [number, number]),
          W * 0.92,
          0,
        );
        const p = mesh(track(g), n ? armorMat : secMat);
        body.add(p);
        armor[zone].push(p);
      }
      for (const side of [-1, 1]) {
        const sp = mesh(track(box(L - c * 3.2, H * 0.62, plate(d.armor.sides), 0.004)), d.armor.sides ? armorMat : secMat, 0, 0, side * (W * 0.48 + plate(d.armor.sides) / 2));
        body.add(sp);
        (side < 0 ? armor.left : armor.right).push(sp);
      }
      topY = bottom + H;
      break;
    }
    case 'dome': {
      const R = W / 2;
      const baseH = Math.min(0.12, H * 0.32);
      const base = mesh(track(new THREE.CylinderGeometry(R * 0.98, R * 0.98, baseH, 40)), frameMat, 0, bottom + baseH / 2, 0);
      body.add(base);
      const dome = new THREE.SphereGeometry(R * 0.96, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const dm = mesh(track(dome), paintMat, 0, bottom + baseH, 0);
      dm.scale.y = (H - baseH) / (R * 0.96);
      body.add(dm);
      armor.top.push(dm);
      // armour band around the skirt, split by zone
      const segs: Array<[HitZone, number, number]> = [
        ['front', -Math.PI / 4, Math.PI / 4],
        ['left', Math.PI / 4, (3 * Math.PI) / 4],
        ['rear', (3 * Math.PI) / 4, (5 * Math.PI) / 4],
        ['right', (5 * Math.PI) / 4, (7 * Math.PI) / 4],
      ];
      for (const [zone, a0, a1] of segs) {
        const n = zone === 'left' || zone === 'right' ? d.armor.sides : d.armor[zone as 'front' | 'rear'];
        const g = new THREE.CylinderGeometry(R + plate(n), R + plate(n), baseH * 0.9, 16, 1, true, a0 + Math.PI / 2, a1 - a0);
        const p = mesh(track(g), n ? armorMat : secMat, 0, bottom + baseH / 2, 0);
        (p.material as THREE.Material).side = THREE.DoubleSide;
        body.add(p);
        armor[zone].push(p);
      }
      frontX = R;
      topY = bottom + H;
      break;
    }
  }

  // power light and number
  const ledBar = mesh(track(new THREE.BoxGeometry(0.04, 0.02, W * 0.4)), led, -L / 2 + 0.06, topY + 0.012, 0);
  ledBar.castShadow = false;
  body.add(ledBar);
  if (opts.number && ch.shape !== 'dome') {
    const decal = new THREE.Mesh(track(new THREE.PlaneGeometry(0.2, 0.2)), track(new THREE.MeshBasicMaterial({ map: numberTexture(opts.number, d.paint.secondary), transparent: true, depthWrite: false })));
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = -Math.PI / 2;
    decal.position.set(ch.shape === 'wedge' ? -L * 0.28 : -L * 0.18, topY + plate(d.armor.top) + 0.004, 0);
    body.add(decal);
  }

  // ---- drive ----------------------------------------------------------------
  const drive = driveOf(d.drive);
  const wheels: THREE.Object3D[] = [];
  const treads: THREE.Texture[] = [];
  const wheelR = Math.max(0.075, Math.min(0.15, H * 0.42 + 0.02));
  const wheelW = 0.07;
  const wheelZ = W / 2 - wheelW * 0.15;
  const addWheel = (x: number, side: number, mecanum = false) => {
    const g = new THREE.Group();
    const tire = mesh(track(new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 22)), rubberMat);
    tire.rotation.x = Math.PI / 2;
    g.add(tire);
    const cap = mesh(track(new THREE.CircleGeometry(wheelR * 0.62, 20)), hubMat, 0, 0, side * (wheelW / 2 + 0.001));
    if (side < 0) cap.rotation.y = Math.PI;
    g.add(cap);
    if (mecanum) {
      for (let i = 0; i < 6; i++) {
        const roller = mesh(track(new THREE.CylinderGeometry(0.012, 0.012, wheelW * 1.1, 6)), steelMat);
        const a = (i / 6) * Math.PI * 2;
        roller.position.set(Math.cos(a) * wheelR * 0.98, Math.sin(a) * wheelR * 0.98, 0);
        roller.rotation.set(Math.PI / 2, 0, 0);
        roller.rotateX(side * 0.6);
        g.add(roller);
      }
    }
    g.position.set(x, bottom + wheelR - 0.004, side * wheelZ);
    body.add(g);
    wheels.push(g);
  };
  if (drive.style === 'treads') {
    const tl = L * 0.86;
    const th = Math.min(H * 0.9, 0.3);
    for (const side of [-1, 1]) {
      const t = treadTexture().clone();
      t.needsUpdate = true;
      t.repeat.set(1, tl * 4);
      treads.push(t);
      const tm = track(new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0.1 }));
      const tg = mesh(track(box(tl, th, 0.1, Math.min(0.06, th / 2 - 0.001))), tm, 0, bottom + th / 2, side * (W / 2 + 0.02));
      body.add(tg);
      for (const x of [-tl / 2 + th / 2, tl / 2 - th / 2]) {
        const sprocket = mesh(track(new THREE.CylinderGeometry(th * 0.42, th * 0.42, 0.104, 12)), hubMat, x, bottom + th / 2, side * (W / 2 + 0.02));
        sprocket.rotation.x = Math.PI / 2;
        body.add(sprocket);
      }
    }
  } else {
    const xs = drive.style === 'wheels2' ? [-L * 0.08] : drive.style === 'wheels6' ? [-L * 0.32, 0, L * 0.32] : [-L * 0.3, L * 0.26];
    for (const side of [-1, 1]) for (const x of xs) addWheel(x, side, drive.style === 'mecanum');
    if (drive.style === 'wheels2') {
      // a skid at the front
      body.add(mesh(track(new THREE.SphereGeometry(0.03, 10, 8)), steelMat, L * 0.32, bottom + 0.02, 0));
    }
  }

  // ---- weapons ----------------------------------------------------------------
  const front = d.front ? buildWeapon(weaponOf(d.front), 'front') : null;
  const top = d.top ? buildWeapon(weaponOf(d.top), 'top') : null;

  function buildWeapon(w: WeaponDef, slot: 'front' | 'top'): WeaponRig {
    const rig: WeaponRig = { type: w.type, slot, spinAxis: 'z', rest: 0, fire: 0, rest2: 0, fire2: 0 };
    const reachK = 0.6 + w.reach;
    switch (w.type) {
      case 'vspin': {
        const r = 0.2 + w.reach * 0.35 + (w.energy ?? 20) / 400;
        const g = new THREE.Group();
        const egg = /beater/i.test(w.name);
        if (egg) {
          for (const a of [0, Math.PI / 2]) {
            const blade = mesh(track(new THREE.TorusGeometry(r * 0.72, 0.025, 6, 24, Math.PI)), steelMat);
            blade.rotation.z = a;
            blade.rotation.y = Math.PI / 2;
            blade.scale.set(1, 1, 0.5);
            g.add(blade);
          }
          const hub = mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 12)), darkMat);
          hub.rotation.x = Math.PI / 2;
          g.add(hub);
        } else {
          const disc = mesh(track(new THREE.CylinderGeometry(r, r, 0.04, 36)), steelMat);
          disc.rotation.x = Math.PI / 2;
          g.add(disc);
          for (const a of [0, Math.PI]) {
            const tooth = mesh(track(new THREE.BoxGeometry(0.1, 0.07, 0.05)), toothMat, Math.cos(a) * r, Math.sin(a) * r, 0);
            tooth.rotation.z = a + 0.4;
            g.add(tooth);
          }
        }
        const cx = frontX + r * 0.45;
        const cy = bottom + r + 0.03;
        g.position.set(cx, cy, 0);
        body.add(g);
        // mounting forks
        for (const s of [-1, 1]) body.add(mesh(track(box(r * 1.2 + 0.1, 0.06, 0.03)), frameMat, cx - r * 0.5, cy, s * 0.06));
        rig.spinner = g;
        rig.spinAxis = 'z';
        const blur = new THREE.Mesh(track(new THREE.CircleGeometry(r * 1.06, 32)), track(new THREE.MeshBasicMaterial({ color: 0xdfe8f5, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })));
        blur.position.set(cx, cy, 0);
        body.add(blur);
        rig.blur = blur;
        break;
      }
      case 'drum': {
        const r = 0.09 + (w.energy ?? 10) / 600;
        const len = W * 0.72;
        const g = new THREE.Group();
        const drum = mesh(track(new THREE.CylinderGeometry(r, r, len, 20)), steelMat);
        drum.rotation.x = Math.PI / 2;
        g.add(drum);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          for (const z of [-len * 0.3, len * 0.05, len * 0.35]) {
            const t = mesh(track(new THREE.BoxGeometry(0.05, 0.045, 0.06)), toothMat, Math.cos(a) * r, Math.sin(a) * r, z + (i - 1) * 0.04);
            t.rotation.z = a;
            g.add(t);
          }
        }
        const cx = frontX + r * 0.7;
        const cy = bottom + r + 0.012;
        g.position.set(cx, cy, 0);
        body.add(g);
        for (const s of [-1, 1]) body.add(mesh(track(box(r * 2 + 0.06, r * 1.6, 0.03, 0.01)), frameMat, cx - r * 0.5, cy, s * (len / 2 + 0.02)));
        rig.spinner = g;
        rig.spinAxis = 'z';
        break;
      }
      case 'hspin': {
        const low = (w.lowHit ?? 0) > 0;
        const len = low ? 0.82 + w.reach : Math.max(L, W) + w.reach * 1.2;
        const g = new THREE.Group();
        const bar = mesh(track(box(len, 0.045, 0.12, 0.01)), steelMat);
        g.add(bar);
        for (const s of [-1, 1]) {
          const tip = mesh(track(new THREE.BoxGeometry(0.1, 0.06, 0.14)), toothMat, (s * len) / 2, 0, 0);
          g.add(tip);
        }
        let cx: number;
        let cy: number;
        if (low) {
          cx = frontX + len / 2 - 0.08;
          cy = bottom + 0.06;
          for (const s of [-1, 1]) body.add(mesh(track(box(len / 2 + 0.08, 0.04, 0.04)), frameMat, frontX + len / 4 - 0.1, cy + 0.02, s * 0.12));
        } else {
          cx = L * 0.08;
          cy = topY + 0.1;
          body.add(mesh(track(new THREE.CylinderGeometry(0.06, 0.08, 0.1, 12)), frameMat, cx, topY + 0.04, 0));
        }
        g.position.set(cx, cy, 0);
        body.add(g);
        rig.spinner = g;
        rig.spinAxis = 'y';
        const blur = new THREE.Mesh(track(new THREE.CircleGeometry(len / 2 + 0.04, 40)), track(new THREE.MeshBasicMaterial({ color: 0xdfe8f5, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })));
        blur.rotation.x = -Math.PI / 2;
        blur.position.set(cx, cy, 0);
        body.add(blur);
        rig.blur = blur;
        break;
      }
      case 'ring': {
        const R = Math.max(L, W) / 2 + 0.05;
        const g = new THREE.Group();
        const ring = mesh(track(new THREE.TorusGeometry(R, 0.035, 8, 48)), steelMat);
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
        for (const a of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
          const t = mesh(track(new THREE.BoxGeometry(0.1, 0.08, 0.07)), toothMat, Math.cos(a) * (R + 0.03), 0, Math.sin(a) * (R + 0.03));
          t.rotation.y = -a;
          g.add(t);
        }
        // spokes to the hub
        for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
          const s = mesh(track(box(R, 0.02, 0.03)), frameMat, (Math.cos(a) * R) / 2, 0, (Math.sin(a) * R) / 2);
          s.rotation.y = -a;
          g.add(s);
        }
        g.position.set(0, bottom + Math.min(0.14, H * 0.45), 0);
        body.add(g);
        rig.spinner = g;
        rig.spinAxis = 'y';
        break;
      }
      case 'flipper': {
        const pl = L * 0.55;
        const pivot = new THREE.Group();
        const hingeX = frontX - pl * 0.78;
        const hingeY = topY + 0.01;
        pivot.position.set(hingeX, hingeY, 0);
        const dy = hingeY - (bottom + 0.01);
        const dx = frontX + 0.1 - hingeX;
        const len = Math.hypot(dx, dy);
        const ang = -Math.atan2(dy, dx);
        const flap = mesh(track(box(len, 0.025, W * 0.86, 0.006)), paintMat, len / 2, 0, 0);
        pivot.add(flap);
        const lip = mesh(track(new THREE.BoxGeometry(0.04, 0.02, W * 0.86)), steelMat, len, -0.006, 0);
        pivot.add(lip);
        for (const s of [-1, 1]) pivot.add(mesh(track(box(len * 0.8, 0.03, 0.03)), frameMat, len * 0.45, -0.025, s * W * 0.3));
        pivot.rotation.z = ang;
        body.add(pivot);
        rig.pivot = pivot;
        rig.rest = ang;
        rig.fire = ang + 1.35;
        break;
      }
      case 'lifter': {
        const pivot = new THREE.Group();
        const hx = frontX - 0.12;
        const hy = topY - 0.02;
        pivot.position.set(hx, hy, 0);
        const dx = frontX + 0.28 - hx;
        const dy = hy - (bottom + 0.012);
        const len = Math.hypot(dx, dy);
        const ang = -Math.atan2(dy, dx);
        const prongs = w.grab ? [-0.2, 0.2] : [-0.24, -0.08, 0.08, 0.24];
        for (const z of prongs) pivot.add(mesh(track(box(len, 0.03, 0.05, 0.008)), steelMat, len / 2, 0, z * W));
        pivot.add(mesh(track(new THREE.CylinderGeometry(0.03, 0.03, W * 0.6, 10)), frameMat).rotateX(Math.PI / 2));
        pivot.rotation.z = ang;
        body.add(pivot);
        rig.pivot = pivot;
        rig.rest = ang;
        rig.fire = ang + 0.75;
        if (w.grab) {
          const claw = new THREE.Group();
          claw.position.set(frontX - 0.2, topY + 0.14, 0);
          const arm = mesh(track(box(0.5, 0.04, 0.08, 0.01)), secMat, 0.25, 0, 0);
          claw.add(arm);
          const tip = mesh(track(new THREE.ConeGeometry(0.05, 0.12, 8)), steelMat, 0.5, -0.04, 0);
          tip.rotation.z = Math.PI;
          claw.add(tip);
          body.add(mesh(track(box(0.06, 0.16, 0.1)), frameMat, frontX - 0.2, topY + 0.07, 0));
          claw.rotation.z = 0.5;
          body.add(claw);
          rig.pivot2 = claw;
          rig.rest2 = 0.5;
          rig.fire2 = -0.25;
        }
        break;
      }
      case 'hammer':
      case 'axe': {
        const pivot = new THREE.Group();
        const px = -L * 0.12;
        const py = topY + 0.08;
        pivot.position.set(px, py, 0);
        const reachX = frontX + w.reach * 0.8 + (ch.topReach ?? 0) * 0.6;
        const armLen = Math.hypot(reachX - px, py - (bottom + 0.06));
        body.add(mesh(track(box(0.16, 0.1, 0.18, 0.02)), frameMat, px, topY + 0.04, 0));
        const arm = mesh(track(box(armLen, 0.05, 0.05, 0.01)), secMat, armLen / 2, 0, 0);
        pivot.add(arm);
        if (w.type === 'hammer') {
          const head = mesh(track(box(0.14, 0.14, 0.22, 0.02)), steelMat, armLen, -0.02, 0);
          pivot.add(head);
        } else {
          const blade = mesh(track(new THREE.ConeGeometry(0.1, 0.24, 4)), toothMat, armLen + 0.02, -0.08, 0);
          blade.rotation.z = Math.PI;
          blade.scale.set(1, 1, 0.25);
          pivot.add(blade);
          pivot.add(mesh(track(box(0.08, 0.1, 0.04)), steelMat, armLen, 0, 0));
        }
        const strike = -Math.asin(Math.min(0.95, (py - (bottom + 0.1)) / armLen));
        pivot.rotation.z = 2.1;
        body.add(pivot);
        rig.pivot = pivot;
        rig.rest = 2.1;
        rig.fire = strike;
        break;
      }
      case 'crusher': {
        // lower jaw: a fixed wedge; upper jaw: a beak on a hinge
        const lj = mesh(track(profile([[frontX - 0.12, bottom + 0.1], [frontX + 0.3, bottom + 0.01], [frontX + 0.3, bottom], [frontX - 0.12, bottom]], W * 0.5, 0)), steelMat);
        body.add(lj);
        const pivot = new THREE.Group();
        pivot.position.set(frontX - 0.12, topY + 0.1, 0);
        const beakLen = 0.46 + w.reach * 0.3;
        pivot.add(mesh(track(box(beakLen, 0.08, 0.16, 0.02)), secMat, beakLen / 2, 0, 0));
        const tip = mesh(track(new THREE.ConeGeometry(0.06, 0.22, 4)), toothMat, beakLen, -0.09, 0);
        tip.rotation.z = Math.PI;
        pivot.add(tip);
        body.add(mesh(track(box(0.14, 0.2, 0.22, 0.02)), frameMat, frontX - 0.16, topY + 0.05, 0));
        pivot.rotation.z = 0.55;
        body.add(pivot);
        rig.pivot = pivot;
        rig.rest = 0.55;
        rig.fire = -0.22;
        break;
      }
      case 'saw': {
        const r = 0.13 + w.reach * 0.1;
        const blade = () => {
          const g = new THREE.Group();
          const disc = mesh(track(new THREE.CylinderGeometry(r, r, 0.012, 32)), toothMat);
          disc.rotation.x = Math.PI / 2;
          g.add(disc);
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const t = mesh(track(new THREE.BoxGeometry(0.03, 0.03, 0.014)), steelMat, Math.cos(a) * r, Math.sin(a) * r, 0);
            t.rotation.z = a + 0.6;
            g.add(t);
          }
          return g;
        };
        if (slot === 'top') {
          const pivot = new THREE.Group();
          const px = -L * 0.08;
          const py = topY + 0.1;
          pivot.position.set(px, py, 0);
          const len = frontX + w.reach * 0.7 - px;
          pivot.add(mesh(track(box(len, 0.05, 0.05, 0.01)), secMat, len / 2, 0, 0));
          const b = blade();
          b.position.set(len, 0, 0.04);
          pivot.add(b);
          body.add(mesh(track(box(0.12, 0.12, 0.14, 0.02)), frameMat, px, topY + 0.05, 0));
          pivot.rotation.z = 0.45;
          body.add(pivot);
          rig.pivot = pivot;
          rig.rest = 0.45;
          rig.fire = -Math.asin(Math.min(0.9, (py - bottom - r * 0.6) / len));
          rig.spinner = b;
        } else {
          const g = new THREE.Group();
          for (const s of [-1, 1]) {
            const b = blade();
            b.position.set(frontX + r * 0.45, bottom + r + 0.02, s * W * 0.28);
            g.add(b);
            body.add(mesh(track(box(r + 0.06, 0.05, 0.03)), frameMat, frontX, bottom + r + 0.02, s * W * 0.28 - s * 0.03));
          }
          body.add(g);
          rig.spinner = g;
          rig.spinAxis = 'none' as never;
          (rig as WeaponRig & { blades?: THREE.Object3D[] }).blades = g.children;
        }
        rig.spinAxis = 'z';
        break;
      }
      case 'wedge': {
        const forks = (w.lip ?? 0) > 0.9;
        if (forks) {
          for (let i = 0; i < 4; i++) {
            const z = (-0.36 + i * 0.24) * W;
            const f = mesh(track(profile([[frontX - 0.06, bottom + 0.08], [frontX + 0.3, bottom + 0.006], [frontX + 0.3, bottom], [frontX - 0.06, bottom]], 0.05, 0)), steelMat, 0, 0, z);
            body.add(f);
          }
          const bar = mesh(track(new THREE.CylinderGeometry(0.025, 0.025, W * 0.92, 10)), frameMat, frontX - 0.04, bottom + 0.06, 0);
          bar.rotation.x = Math.PI / 2;
          body.add(bar);
        } else {
          const h = Math.max(0.12, Math.min(0.26, H * 0.75));
          body.add(mesh(track(profile([[frontX - 0.04, bottom + h], [frontX + 0.24, bottom + 0.006], [frontX + 0.24, bottom], [frontX - 0.04, bottom]], W * 1.04, 0.006)), steelMat));
        }
        if (w.ram) {
          // battering ram head on the plow
          if ((w.ram ?? 0) > 1) body.add(mesh(track(box(0.12, 0.16, W * 0.5, 0.02)), toothMat, frontX + 0.1, bottom + 0.12, 0));
        }
        break;
      }
      case 'ram': {
        const lance = w.reach >= 0.3;
        if (lance && (w.ram ?? 1) < 1.9) {
          const c = mesh(track(new THREE.ConeGeometry(0.06, 0.2 + w.reach, 12)), toothMat, frontX + (0.2 + w.reach) / 2, bottom + H * 0.45, 0);
          c.rotation.z = -Math.PI / 2;
          body.add(c);
          body.add(mesh(track(box(0.08, 0.12, 0.2, 0.02)), frameMat, frontX + 0.02, bottom + H * 0.45, 0));
        } else if (lance) {
          body.add(mesh(track(box(0.16, 0.18, W * 0.62, 0.03)), toothMat, frontX + w.reach - 0.06, bottom + H * 0.45, 0));
          for (const s of [-1, 1]) body.add(mesh(track(box(w.reach, 0.05, 0.05)), frameMat, frontX + w.reach / 2 - 0.08, bottom + H * 0.45, s * W * 0.22));
        } else {
          for (const z of [-0.26, 0, 0.26]) {
            const c = mesh(track(new THREE.ConeGeometry(0.04, 0.2, 10)), toothMat, frontX + 0.09, bottom + H * 0.5, z * W);
            c.rotation.z = -Math.PI / 2;
            body.add(c);
          }
        }
        break;
      }
      case 'flame': {
        const nozzle = new THREE.Group();
        const nx = frontX - 0.06;
        const ny = topY + 0.07;
        const n = mesh(track(new THREE.CylinderGeometry(0.022, 0.03, 0.18, 10)), darkMat, 0, 0, 0);
        n.rotation.z = -Math.PI / 2;
        nozzle.add(n);
        nozzle.position.set(nx, ny, 0);
        body.add(nozzle);
        const tip = new THREE.Object3D();
        tip.position.set(0.1, 0, 0);
        nozzle.add(tip);
        rig.nozzle = tip;
        const tank = mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 0.24, 12)), track(new THREE.MeshStandardMaterial({ color: 0xc0392b, metalness: 0.5, roughness: 0.35 })), -L * 0.2, topY + 0.06, W * 0.22);
        tank.rotation.z = Math.PI / 2;
        body.add(tank);
        body.add(mesh(track(new THREE.BoxGeometry(0.2, 0.06, 0.06)), frameMat, nx - 0.12, topY + 0.04, 0));
        break;
      }
    }
    void reachK;
    return rig;
  }

  // ---- modules ----------------------------------------------------------------
  for (const id of d.modules) {
    const m = moduleOf(id);
    switch (m.effect) {
      case 'selfright': {
        const arm = mesh(track(box(0.3, 0.03, 0.06, 0.01)), secMat, -L / 2 + 0.18, topY + 0.03, W * 0.3);
        body.add(arm);
        break;
      }
      case 'wedgelets':
        for (const s of [-1, 1]) body.add(mesh(track(profile([[frontX - 0.02, bottom + 0.09], [frontX + 0.15, bottom + 0.005], [frontX + 0.15, bottom], [frontX - 0.02, bottom]], 0.1, 0)), steelMat, 0, 0, s * (W / 2 - 0.06)));
        break;
      case 'skirts':
        for (const s of [-1, 1]) body.add(mesh(track(box(L * 0.7, 0.07, 0.012)), steelMat, 0, bottom + 0.035, s * (W / 2 + 0.03)));
        break;
      case 'heatsink':
        for (let i = 0; i < 5; i++) body.add(mesh(track(new THREE.BoxGeometry(0.012, 0.05, W * 0.3)), track(new THREE.MeshStandardMaterial({ color: 0xc87533, metalness: 1, roughness: 0.3 })), -L * 0.32 + i * 0.03, topY + 0.025, -W * 0.15));
        break;
      case 'thorns':
        for (const [x, z] of [[L / 2, -W / 2], [L / 2, W / 2], [-L / 2, -W / 2], [-L / 2, W / 2], [0, -W / 2], [0, W / 2]]) {
          const c = mesh(track(new THREE.ConeGeometry(0.025, 0.11, 8)), toothMat, x, 0, z);
          c.rotation.set(z !== 0 && x === 0 ? Math.sign(z) * Math.PI / 2 : 0, 0, x !== 0 ? -Math.sign(x) * Math.PI / 2 : 0);
          if (x === 0) c.rotation.set(Math.sign(z) * Math.PI / 2, 0, 0);
          body.add(c);
        }
        break;
      case 'magnets': {
        const g = new THREE.Mesh(track(new THREE.PlaneGeometry(L * 0.6, W * 0.5)), track(new THREE.MeshBasicMaterial({ color: 0x3aa0ff, transparent: true, opacity: 0.35, depthWrite: false })));
        g.rotation.x = Math.PI / 2;
        g.position.y = bottom - 0.004;
        body.add(g);
        break;
      }
      case 'gyro':
        body.add(mesh(track(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16)), steelMat, -L * 0.25, topY + 0.025, W * 0.2));
        break;
      case 'ablative':
        for (const s of [-1, 1]) body.add(mesh(track(box(L * 0.3, H * 0.4, 0.02, 0.005)), secMat, L * 0.18, 0, s * (W / 2 + 0.03)));
        break;
      case 'guard':
        if (front) for (const s of [-1, 1]) body.add(mesh(track(box(0.32, 0.03, 0.03)), frameMat, frontX + 0.08, topY - 0.02, s * W * 0.36));
        break;
      case 'capacitor':
        for (let i = 0; i < 3; i++) body.add(mesh(track(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 10)), track(new THREE.MeshStandardMaterial({ color: 0x1e88e5, emissive: 0x0d47a1, emissiveIntensity: 0.8 })), -L * 0.05 + i * 0.06, topY + 0.04, -W * 0.3));
        break;
      case 'targeting': {
        const s = mesh(track(new THREE.SphereGeometry(0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), darkMat, L * 0.18, topY, W * 0.3);
        body.add(s);
        body.add(mesh(track(new THREE.SphereGeometry(0.012, 6, 6)), track(new THREE.MeshBasicMaterial({ color: 0xff2020 })), L * 0.2, topY + 0.03, W * 0.3));
        break;
      }
      case 'coolant':
        for (const s of [-1, 1]) {
          const c = mesh(track(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10)), track(new THREE.MeshStandardMaterial({ color: 0x4fc3f7, metalness: 0.4, roughness: 0.3 })), -L * 0.35, topY + 0.03, s * W * 0.12);
          c.rotation.z = Math.PI / 2;
          body.add(c);
        }
        break;
      case 'reactive':
        for (let i = 0; i < 3; i++) body.add(mesh(track(box(0.02, 0.06, 0.12, 0.004)), track(new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.6 })), frontX + 0.012, 0, (-0.14 + i * 0.14) * W));
        break;
      default:
        break;
    }
  }

  body.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== ledBar) {
      o.castShadow = true;
    }
  });

  return {
    root,
    lift,
    body,
    height: H,
    length: L,
    width: W,
    wheels,
    wheelR,
    treads,
    front,
    top,
    armor,
    paintMat,
    frameMat,
    led,
    wheelAngle: 0,
    dispose() {
      for (const x of disposables) x.dispose();
      for (const t of treads) t.dispose();
    },
  };
}

/** Pose a weapon: spinner angle and speed blur, hinged parts by anim 0..1. */
export function poseWeapon(rig: WeaponRig | null, spin: number, energyFrac: number, anim: number) {
  if (!rig) return;
  if (rig.spinner) {
    if (rig.spinAxis === 'y') rig.spinner.rotation.y = spin;
    else {
      const blades = (rig as WeaponRig & { blades?: THREE.Object3D[] }).blades;
      if (blades) for (const b of blades) b.rotation.z = -spin;
      else rig.spinner.rotation.z = -spin;
    }
  }
  if (rig.blur) {
    const m = rig.blur.material as THREE.MeshBasicMaterial;
    m.opacity = Math.max(0, Math.min(0.32, (energyFrac - 0.25) * 0.45));
    rig.blur.visible = m.opacity > 0.01;
  }
  if (rig.pivot) rig.pivot.rotation.z = rig.rest + (rig.fire - rig.rest) * anim;
  if (rig.pivot2) rig.pivot2.rotation.z = rig.rest2 + (rig.fire2 - rig.rest2) * anim;
}
