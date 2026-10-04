// The arena: floor plates, walls, the hazards and their moving parts, the
// lights and the crowd in the stands.

import * as THREE from 'three';
import type { ArenaDef } from '../data/arenas.ts';
import { mulberry32 } from '../sim/rng.ts';
import { floorTexture, glowTexture, stripeTexture } from './textures.ts';

export interface ArenaView {
  group: THREE.Group;
  key: THREE.DirectionalLight;
  saws: Array<{ blades: THREE.Object3D[]; zone: NonNullable<ArenaDef['saws']>[number] }>;
  pitCover: THREE.Object3D | null;
  pitGlow: THREE.Mesh | null;
  hammerHead: THREE.Object3D | null;
  hammerY: number;
  vents: Array<{ light: THREE.PointLight; zone: NonNullable<ArenaDef['flames']>[number] }>;
  flashes: THREE.InstancedMesh | null;
  flashLife: Float32Array;
  crowd: THREE.InstancedMesh | null;
  dispose(): void;
}

// sim (x, y) -> three (x, 0, -y)
export const toThree = (x: number, y: number, h = 0) => new THREE.Vector3(x, h, -y);

export function buildArena(def: ArenaDef, quality: 'high' | 'low' = 'high'): ArenaView {
  const g = new THREE.Group();
  const S = def.size;
  const H = S / 2;
  const theme = def.theme;
  const disposables: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];
  const track = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const rng = mulberry32(S * 13 + def.id.length);

  // ---- floor (with a hole for the pit) ------------------------------------------
  const shape = new THREE.Shape();
  shape.moveTo(-H, -H);
  shape.lineTo(H, -H);
  shape.lineTo(H, H);
  shape.lineTo(-H, H);
  shape.closePath();
  if (def.pit) {
    const p = def.pit;
    const hole = new THREE.Path();
    hole.moveTo(p.x - p.w / 2, p.y - p.h / 2);
    hole.lineTo(p.x - p.w / 2, p.y + p.h / 2);
    hole.lineTo(p.x + p.w / 2, p.y + p.h / 2);
    hole.lineTo(p.x + p.w / 2, p.y - p.h / 2);
    hole.closePath();
    shape.holes.push(hole);
  }
  const floorGeo = track(new THREE.ShapeGeometry(shape));
  floorGeo.rotateX(-Math.PI / 2);
  const ftex = floorTexture(theme.floor);
  const floorMat = track(
    new THREE.MeshStandardMaterial({
      map: ftex,
      metalness: theme.floor === 'concrete' ? 0.05 : 0.55,
      roughness: theme.floor === 'concrete' ? 0.9 : 0.62,
      color: 0xffffff,
    }),
  );
  // ShapeGeometry UVs are in metres; tiles are 2 m.
  ftex.repeat.set(0.5, 0.5);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  g.add(floor);

  // outer apron beyond the walls
  const apron = new THREE.Mesh(track(new THREE.PlaneGeometry(S + 14, S + 14)), track(new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 1 })));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  apron.receiveShadow = true;
  g.add(apron);

  // a painted border line and the corner squares
  const lineMat = track(new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.55 }));
  for (const [w, d, x, z] of [
    [S - 0.8, 0.06, 0, H - 0.4],
    [S - 0.8, 0.06, 0, -H + 0.4],
    [0.06, S - 0.8, H - 0.4, 0],
    [0.06, S - 0.8, -H + 0.4, 0],
  ]) {
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, d)), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.004, z);
    g.add(m);
  }
  const square = (color: number, y: number) => {
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(1.6, 1.6)), track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false })));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.005, -y);
    g.add(m);
    const edge = new THREE.Mesh(track(new THREE.RingGeometry(0.98, 1.02, 4, 1)), track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })));
    edge.rotation.x = -Math.PI / 2;
    edge.rotation.z = Math.PI / 4;
    edge.scale.setScalar(1.13);
    edge.position.set(0, 0.006, -y);
    g.add(edge);
  };
  square(0x2ee6ff, -(H - 1.4));
  square(0xff3b30, H - 1.4);
  // centre logo ring
  const logo = new THREE.Mesh(track(new THREE.RingGeometry(1.0, 1.08, 48)), track(new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.35 })));
  logo.rotation.x = -Math.PI / 2;
  logo.position.y = 0.004;
  g.add(logo);

  // ---- walls ---------------------------------------------------------------------
  const wallMat = track(new THREE.MeshStandardMaterial({ color: 0x31353d, metalness: 0.8, roughness: 0.4 }));
  const railMat = track(new THREE.MeshStandardMaterial({ color: theme.accent, metalness: 0.5, roughness: 0.4, emissive: theme.accent, emissiveIntensity: 0.25 }));
  const glassMat = track(new THREE.MeshStandardMaterial({ color: 0xaad4ff, transparent: true, opacity: 0.07, metalness: 0.2, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide }));
  const kickH = 0.45;
  for (const side of ['n', 's', 'e', 'w'] as const) {
    const horiz = side === 'n' || side === 's';
    const sign = side === 'n' || side === 'e' ? 1 : -1;
    const len = S + 0.3;
    const kick = new THREE.Mesh(track(new THREE.BoxGeometry(horiz ? len : 0.14, kickH, horiz ? 0.14 : len)), wallMat);
    kick.position.set(horiz ? 0 : sign * (H + 0.07), kickH / 2, horiz ? -sign * (H + 0.07) : 0);
    kick.castShadow = true;
    kick.receiveShadow = true;
    g.add(kick);
    const rail = new THREE.Mesh(track(new THREE.BoxGeometry(horiz ? len : 0.16, 0.04, horiz ? 0.16 : len)), railMat);
    rail.position.set(kick.position.x, kickH + 0.02, kick.position.z);
    g.add(rail);
    if (side !== 's') {
      const glass = new THREE.Mesh(track(new THREE.PlaneGeometry(len, 2.6)), glassMat);
      glass.position.set(horiz ? 0 : sign * (H + 0.08), kickH + 1.3, horiz ? -sign * (H + 0.08) : 0);
      if (!horiz) glass.rotation.y = Math.PI / 2;
      g.add(glass);
      const top = new THREE.Mesh(track(new THREE.BoxGeometry(horiz ? len : 0.08, 0.08, horiz ? 0.08 : len)), wallMat);
      top.position.set(glass.position.x, kickH + 2.6, glass.position.z);
      g.add(top);
    }
    // posts
    for (let k = -H; k <= H + 0.01; k += S / 4) {
      const post = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, side === 's' ? kickH + 0.15 : kickH + 2.7, 0.12)), wallMat);
      const ph = side === 's' ? kickH + 0.15 : kickH + 2.7;
      post.position.set(horiz ? k : sign * (H + 0.1), ph / 2, horiz ? -sign * (H + 0.1) : -k);
      post.castShadow = true;
      g.add(post);
    }
  }

  // spiked wall sections, all the spikes in one instanced mesh
  const spikeMat = track(new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 1, roughness: 0.25 }));
  const spikeGeo = track(new THREE.ConeGeometry(0.05, 0.26, 8));
  const spikePlaces: THREE.Object3D[] = [];
  for (const sp of def.spikes ?? []) {
    const horiz = sp.side === 'n' || sp.side === 's';
    const sign = sp.side === 'n' || sp.side === 'e' ? 1 : -1;
    const stripeTex = track(stripeTexture().clone());
    stripeTex.needsUpdate = true;
    stripeTex.repeat.set((sp.to - sp.from) * 2, 1);
    const stripe = new THREE.Mesh(track(new THREE.PlaneGeometry(sp.to - sp.from, 0.5)), track(new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 })));
    for (let a = sp.from + 0.2; a <= sp.to - 0.1; a += 0.32) {
      for (const hh of [0.12, 0.3]) {
        const c = new THREE.Object3D();
        if (horiz) {
          c.position.set(a, hh, -sign * (H - 0.11));
          c.rotation.x = (sign * Math.PI) / 2;
        } else {
          c.position.set(sign * (H - 0.11), hh, -a);
          c.rotation.z = (sign * Math.PI) / 2;
        }
        c.updateMatrix();
        spikePlaces.push(c);
      }
    }
    // warning stripe on the floor in front
    stripe.rotation.x = -Math.PI / 2;
    if (horiz) stripe.position.set((sp.from + sp.to) / 2, 0.006, -sign * (H - 0.25));
    else {
      stripe.rotation.z = Math.PI / 2;
      stripe.position.set(sign * (H - 0.25), 0.006, -(sp.from + sp.to) / 2);
    }
    g.add(stripe);
  }
  if (spikePlaces.length) {
    const spikes = new THREE.InstancedMesh(spikeGeo, spikeMat, spikePlaces.length);
    spikePlaces.forEach((o, i) => spikes.setMatrixAt(i, o.matrix));
    spikes.castShadow = true;
    g.add(spikes);
  }

  // ---- hazards -----------------------------------------------------------------------
  const stripeMat = (w: number, h: number) => {
    const t = track(stripeTexture().clone());
    t.needsUpdate = true;
    t.repeat.set(w * 2, h * 2);
    return track(new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.2 }));
  };

  let pitCover: THREE.Object3D | null = null;
  let pitGlow: THREE.Mesh | null = null;
  if (def.pit) {
    const p = def.pit;
    // the shaft
    const shaftMat = track(new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 1, side: THREE.BackSide }));
    const shaft = new THREE.Mesh(track(new THREE.BoxGeometry(p.w, 3, p.h)), shaftMat);
    shaft.position.set(p.x, -1.5, -p.y);
    g.add(shaft);
    pitGlow = new THREE.Mesh(track(new THREE.PlaneGeometry(p.w, p.h)), track(new THREE.MeshBasicMaterial({ color: 0xff2a00, transparent: true, opacity: 0.0 })));
    pitGlow.rotation.x = -Math.PI / 2;
    pitGlow.position.set(p.x, -2.9, -p.y);
    g.add(pitGlow);
    // rim stripes
    for (const [w, d, x, z] of [
      [p.w + 0.5, 0.25, p.x, -(p.y + p.h / 2 + 0.125)],
      [p.w + 0.5, 0.25, p.x, -(p.y - p.h / 2 - 0.125)],
      [0.25, p.h, p.x + p.w / 2 + 0.125, -p.y],
      [0.25, p.h, p.x - p.w / 2 - 0.125, -p.y],
    ]) {
      const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, d)), stripeMat(w, d));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.006, z);
      m.receiveShadow = true;
      g.add(m);
    }
    const cover = new THREE.Mesh(track(new THREE.BoxGeometry(p.w, 0.04, p.h)), track(new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.8, roughness: 0.5 })));
    cover.position.set(p.x, -0.02, -p.y);
    cover.receiveShadow = true;
    g.add(cover);
    pitCover = cover;
  }

  const saws: ArenaView['saws'] = [];
  const bladeMat = track(new THREE.MeshStandardMaterial({ color: 0xe6eaef, metalness: 1, roughness: 0.18 }));
  const bladeGeo = track(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24));
  const toothGeo = track(new THREE.BoxGeometry(0.05, 0.05, 0.022));
  for (const zone of def.saws ?? []) {
    const slot = new THREE.Mesh(track(new THREE.PlaneGeometry(zone.w + 0.2, zone.h + 0.2)), stripeMat(zone.w + 0.2, zone.h + 0.2));
    slot.rotation.x = -Math.PI / 2;
    slot.position.set(zone.x, 0.005, -zone.y);
    g.add(slot);
    const dark = new THREE.Mesh(track(new THREE.PlaneGeometry(zone.w * 0.6, zone.h * 0.92)), track(new THREE.MeshBasicMaterial({ color: 0x050505 })));
    dark.rotation.x = -Math.PI / 2;
    dark.position.set(zone.x, 0.007, -zone.y);
    g.add(dark);
    const along = zone.h > zone.w;
    const len = along ? zone.h : zone.w;
    const n = Math.max(2, Math.round(len / 1.1));
    const blades: THREE.Object3D[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const b = new THREE.Group();
      const disc = new THREE.Mesh(bladeGeo, bladeMat);
      disc.rotation.x = Math.PI / 2;
      b.add(disc);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const tooth = new THREE.Mesh(toothGeo, bladeMat);
        tooth.position.set(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0);
        tooth.rotation.z = a + 0.6;
        b.add(tooth);
      }
      const holder = new THREE.Group();
      holder.add(b);
      holder.position.set(zone.x + (along ? 0 : t * len), -0.25, -(zone.y + (along ? t * len : 0)));
      if (along) holder.rotation.y = Math.PI / 2;
      b.castShadow = true;
      g.add(holder);
      blades.push(holder);
    }
    saws.push({ blades, zone });
  }

  let hammerHead: THREE.Object3D | null = null;
  const hammerY = 3.2;
  if (def.hammer) {
    const hm = def.hammer;
    const ring = new THREE.Mesh(track(new THREE.RingGeometry(hm.r - 0.12, hm.r, 40)), stripeMat(hm.r * 2, 0.2));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(hm.x, 0.006, -hm.y);
    g.add(ring);
    const target = new THREE.Mesh(track(new THREE.CircleGeometry(hm.r - 0.12, 40)), track(new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.08, depthWrite: false })));
    target.rotation.x = -Math.PI / 2;
    target.position.set(hm.x, 0.006, -hm.y);
    g.add(target);
    const head = new THREE.Group();
    const block = new THREE.Mesh(track(new THREE.BoxGeometry(0.8, 0.5, 0.8)), track(new THREE.MeshStandardMaterial({ color: 0x8f969f, metalness: 1, roughness: 0.3 })));
    block.castShadow = true;
    head.add(block);
    const shaft = new THREE.Mesh(track(new THREE.CylinderGeometry(0.08, 0.08, 4, 10)), wallMat);
    shaft.position.y = 2.25;
    head.add(shaft);
    const stripe = new THREE.Mesh(track(new THREE.BoxGeometry(0.82, 0.12, 0.82)), stripeMat(1, 0.2));
    stripe.position.y = 0.1;
    head.add(stripe);
    head.position.set(hm.x, hammerY, -hm.y);
    g.add(head);
    hammerHead = head;
  }

  const vents: ArenaView['vents'] = [];
  for (const zone of def.flames ?? []) {
    const grate = new THREE.Mesh(track(new THREE.CircleGeometry(zone.r, 32)), track(new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.6 })));
    grate.rotation.x = -Math.PI / 2;
    grate.position.set(zone.x, 0.005, -zone.y);
    grate.receiveShadow = true;
    g.add(grate);
    for (let i = -2; i <= 2; i++) {
      const slat = new THREE.Mesh(track(new THREE.PlaneGeometry(zone.r * 1.6 * Math.sqrt(1 - (i / 3) ** 2), 0.05)), track(new THREE.MeshBasicMaterial({ color: 0x3a1500 })));
      slat.rotation.x = -Math.PI / 2;
      slat.position.set(zone.x, 0.007, -zone.y + i * zone.r * 0.3);
      g.add(slat);
    }
    const ring = new THREE.Mesh(track(new THREE.RingGeometry(zone.r, zone.r + 0.1, 32)), stripeMat(zone.r * 4, 0.2));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(zone.x, 0.006, -zone.y);
    g.add(ring);
    const light = new THREE.PointLight(0xff7a1a, 0, 4, 2);
    light.position.set(zone.x, 0.6, -zone.y);
    g.add(light);
    vents.push({ light, zone });
  }

  // ---- lights ------------------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(theme.light, 0x0b0b10, 1.1);
  g.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(-S * 0.35, S * 1.3, S * 0.6);
  key.target.position.set(0, 0, 0);
  key.castShadow = quality === 'high';
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -H - 1;
  sc.right = H + 1;
  sc.top = H + 1;
  sc.bottom = -H - 1;
  sc.near = 1;
  sc.far = S * 4;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  g.add(key);
  g.add(key.target);
  const rimA = new THREE.DirectionalLight(theme.accent, 0.7);
  rimA.position.set(S, S * 0.5, -S);
  g.add(rimA);
  const rimB = new THREE.DirectionalLight(0x6fa8ff, 0.5);
  rimB.position.set(-S, S * 0.4, -S * 0.8);
  g.add(rimB);

  // light pools on the floor, like stadium rigs
  const poolMat = track(new THREE.MeshBasicMaterial({ map: glowTexture(), color: theme.light, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }));
  for (const [x, z] of [[-H / 2, -H / 2], [H / 2, -H / 2], [-H / 2, H / 2], [H / 2, H / 2]]) {
    const pool = new THREE.Mesh(track(new THREE.PlaneGeometry(S * 0.7, S * 0.7)), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.01, z);
    g.add(pool);
  }

  // ---- stands and crowd -----------------------------------------------------------------
  let crowd: THREE.InstancedMesh | null = null;
  let flashes: THREE.InstancedMesh | null = null;
  const flashLife = new Float32Array(48);
  {
    const standMat = track(new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.9 }));
    const rows = 6;
    const people: Array<[number, number, number, number]> = [];
    for (const side of ['n', 'e', 'w', 's'] as const) {
      for (let r = 0; r < rows; r++) {
        const d = H + 1.6 + r * 0.8;
        const y = 0.4 + r * 0.55;
        const len = S + 2 + r * 1.6;
        const step = new THREE.Mesh(track(new THREE.BoxGeometry(side === 'n' || side === 's' ? len : 0.8, y, side === 'n' || side === 's' ? 0.8 : len)), standMat);
        const sx = side === 'e' ? d : side === 'w' ? -d : 0;
        const sz = side === 'n' ? -d : side === 's' ? d + 3 : 0;
        if (side === 's' && r < 3) continue;
        step.position.set(sx, y / 2, sz);
        step.receiveShadow = true;
        g.add(step);
        const count = Math.floor(len * 1.6 * theme.crowd);
        for (let i = 0; i < count; i++) {
          const a = (rng() - 0.5) * len;
          const px = side === 'n' || side === 's' ? a : sx;
          const pz = side === 'n' || side === 's' ? sz : a;
          people.push([px, y, pz, rng()]);
        }
      }
    }
    if (people.length) {
      const geo = track(new THREE.BoxGeometry(0.22, 0.42, 0.22));
      geo.translate(0, 0.21, 0);
      crowd = new THREE.InstancedMesh(geo, track(new THREE.MeshStandardMaterial({ roughness: 0.9 })), people.length);
      const m = new THREE.Matrix4();
      const c = new THREE.Color();
      const palette = [0x8a2b2b, 0x2b4f8a, 0x8a7a2b, 0x3b3b3b, 0x5e2b8a, 0x2b8a5a, 0x9a9a9a, 0x8a4f2b];
      people.forEach(([x, y, z, k], i) => {
        m.makeScale(0.8 + k * 0.4, 0.8 + k * 0.5, 0.8 + k * 0.4);
        m.setPosition(x, y, z);
        crowd!.setMatrixAt(i, m);
        c.setHex(palette[Math.floor(k * palette.length) % palette.length]).multiplyScalar(0.35 + k * 0.25);
        crowd!.setColorAt(i, c);
      });
      g.add(crowd);
      // camera flashes in the crowd
      const fm = track(new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      flashes = new THREE.InstancedMesh(track(new THREE.PlaneGeometry(0.5, 0.5)), fm, flashLife.length);
      const hide = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < flashLife.length; i++) flashes.setMatrixAt(i, hide);
      flashes.userData.people = people;
      g.add(flashes);
    }
    // banner on the north stand
    const bc = document.createElement('canvas');
    bc.width = 1024;
    bc.height = 128;
    const bg = bc.getContext('2d')!;
    bg.fillStyle = '#0b0c10';
    bg.fillRect(0, 0, 1024, 128);
    bg.fillStyle = theme.accent;
    bg.font = 'bold 84px "Russo One", Impact, sans-serif';
    bg.textAlign = 'center';
    bg.textBaseline = 'middle';
    bg.fillText(`KILOWATT  ·  ${def.name.toUpperCase()}`, 512, 68);
    const bt = track(new THREE.CanvasTexture(bc));
    bt.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(track(new THREE.PlaneGeometry(S * 0.8, S * 0.1)), track(new THREE.MeshBasicMaterial({ map: bt })));
    banner.position.set(0, 4.4, -(H + 1.4));
    g.add(banner);
  }

  return {
    group: g,
    key,
    saws,
    pitCover,
    pitGlow,
    hammerHead,
    hammerY,
    vents,
    flashes,
    flashLife,
    crowd,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

/** Animate hazards from the fight state; flash cameras in the crowd. */
export function animateArena(v: ArenaView, def: ArenaDef, t: number, dt: number, pitOpen: boolean, hammerAnim: number, cam: THREE.Camera, excitement: number) {
  for (const s of v.saws) {
    const z = s.zone;
    const ph = (((t + z.offset) % z.period) + z.period) % z.period;
    const up = ph < z.active ? 1 : ph > z.period - 0.35 ? (ph - (z.period - 0.35)) / 0.35 : ph < z.active + 0.3 ? 1 - (ph - z.active) / 0.3 : 0;
    for (const h of s.blades) {
      h.position.y = -0.25 + up * 0.33;
      h.children[0].rotation.z -= dt * 40 * (0.2 + up);
    }
  }
  if (v.pitCover) {
    const target = pitOpen ? -0.9 : -0.02;
    v.pitCover.position.y += (target - v.pitCover.position.y) * Math.min(1, dt * 2.5);
  }
  if (v.pitGlow) {
    const m = v.pitGlow.material as THREE.MeshBasicMaterial;
    m.opacity = pitOpen ? 0.55 + Math.sin(t * 6) * 0.2 : 0;
  }
  if (v.hammerHead) {
    // hammerAnim goes 1 -> 0 after a strike: drop fast, rise slow
    const a = hammerAnim;
    const drop = a > 0.75 ? 1 - (a - 0.75) / 0.25 : a / 0.75;
    v.hammerHead.position.y = v.hammerY - drop * (v.hammerY - 0.25);
  }
  for (const vent of v.vents) {
    const z = vent.zone;
    const ph = (((t + z.offset) % z.period) + z.period) % z.period;
    vent.light.intensity = ph < z.active ? 6 + Math.random() * 4 : ph > z.period - 0.5 ? 1.2 : 0;
  }
  if (v.flashes) {
    const people = v.flashes.userData.people as Array<[number, number, number, number]>;
    const rate = 1.5 + excitement * 30;
    for (let i = 0; i < v.flashLife.length; i++) {
      if (v.flashLife[i] > 0) {
        v.flashLife[i] -= dt * 6;
        const life = Math.max(0, v.flashLife[i]);
        v.flashes.getMatrixAt(i, tmpM);
        tmpM.decompose(tmpP, tmpQ, tmpS);
        tmpQ.copy(cam.quaternion);
        tmpS.setScalar(life * 1.4);
        tmpM.compose(tmpP, tmpQ, tmpS);
        v.flashes.setMatrixAt(i, tmpM);
      } else if (Math.random() < rate * dt / v.flashLife.length * 4) {
        const p = people[Math.floor(Math.random() * people.length)];
        v.flashLife[i] = 1;
        tmpP.set(p[0], p[1] + 0.5, p[2]);
        tmpS.setScalar(1.4);
        tmpM.compose(tmpP, cam.quaternion, tmpS);
        v.flashes.setMatrixAt(i, tmpM);
      }
    }
    v.flashes.instanceMatrix.needsUpdate = true;
  }
}
