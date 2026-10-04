// Particles: sparks (additive streaks), fire and glow (additive points),
// smoke and dust (soft points), flying debris and shockwave rings.

import * as THREE from 'three';
import { dotTexture, puffTexture } from './textures.ts';

const POINT_VERT = /* glsl */ `
attribute float size;
attribute vec4 tint;
varying vec4 vTint;
uniform float scale;
void main() {
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const POINT_FRAG = /* glsl */ `
uniform sampler2D map;
varying vec4 vTint;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vTint.rgb, vTint.a * t.a);
  if (gl_FragColor.a < 0.004) discard;
}`;

class PointPool {
  readonly points: THREE.Points;
  readonly n: number;
  pos: Float32Array;
  vel: Float32Array;
  size: Float32Array;
  grow: Float32Array;
  tint: Float32Array;
  base: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  drag: Float32Array;
  lift: Float32Array;
  next = 0;
  private geo: THREE.BufferGeometry;
  readonly mat: THREE.ShaderMaterial;

  constructor(n: number, additive: boolean, map: THREE.Texture) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.grow = new Float32Array(n);
    this.tint = new Float32Array(n * 4);
    this.base = new Float32Array(n * 4);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.lift = new Float32Array(n);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('tint', new THREE.BufferAttribute(this.tint, 4).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, scale: { value: 400 } },
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, grow: number, r: number, g: number, b: number, a: number, life: number, drag = 1, lift = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.size[i] = size;
    this.grow[i] = grow;
    this.base.set([r, g, b, a], i * 4);
    this.tint.set([r, g, b, a], i * 4);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.drag[i] = drag;
    this.lift[i] = lift;
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        if (this.tint[i * 4 + 3] !== 0) this.tint[i * 4 + 3] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d + this.lift[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      this.tint[i * 4] = this.base[i * 4];
      this.tint[i * 4 + 1] = this.base[i * 4 + 1] * (0.4 + 0.6 * k);
      this.tint[i * 4 + 2] = this.base[i * 4 + 2] * k;
      this.tint[i * 4 + 3] = this.base[i * 4 + 3] * Math.min(1, k * 1.6);
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.size as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.tint as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

class SparkPool {
  readonly lines: THREE.LineSegments;
  readonly n: number;
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  hot: Float32Array;
  verts: Float32Array;
  colors: Float32Array;
  next = 0;
  private geo: THREE.BufferGeometry;
  private mat: THREE.LineBasicMaterial;

  constructor(n: number) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.hot = new Float32Array(n);
    this.verts = new Float32Array(n * 6);
    this.colors = new Float32Array(n * 6);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.verts, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.lines = new THREE.LineSegments(this.geo, this.mat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 4;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, hot = 1) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.hot[i] = hot;
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      const o = i * 6;
      if (this.life[i] <= 0) {
        this.colors.fill(0, o, o + 6);
        continue;
      }
      this.life[i] -= dt;
      const p = i * 3;
      this.vel[p + 1] -= 9.8 * dt;
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      if (this.pos[p + 1] < 0.01) {
        this.pos[p + 1] = 0.01;
        this.vel[p + 1] *= -0.35;
        this.vel[p] *= 0.6;
        this.vel[p + 2] *= 0.6;
      }
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const tail = 0.022 + 0.01 * this.hot[i];
      this.verts[o] = this.pos[p];
      this.verts[o + 1] = this.pos[p + 1];
      this.verts[o + 2] = this.pos[p + 2];
      this.verts[o + 3] = this.pos[p] - this.vel[p] * tail;
      this.verts[o + 4] = this.pos[p + 1] - this.vel[p + 1] * tail;
      this.verts[o + 5] = this.pos[p + 2] - this.vel[p + 2] * tail;
      const r = 1;
      const g = 0.45 + 0.5 * k;
      const b = 0.1 + 0.6 * k * k;
      this.colors[o] = r * k;
      this.colors[o + 1] = g * k;
      this.colors[o + 2] = b * k;
      this.colors[o + 3] = r * k * 0.5;
      this.colors[o + 4] = g * k * 0.3;
      this.colors[o + 5] = 0;
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

class DebrisPool {
  readonly mesh: THREE.InstancedMesh;
  readonly n: number;
  pos: Float32Array;
  vel: Float32Array;
  rot: Float32Array;
  spin: Float32Array;
  scale: Float32Array;
  life: Float32Array;
  next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(n: number) {
    this.n = n;
    const geo = new THREE.BoxGeometry(1, 0.25, 0.7);
    const mat = new THREE.MeshStandardMaterial({ metalness: 0.8, roughness: 0.4 });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.rot = new Float32Array(n * 3);
    this.spin = new Float32Array(n * 3);
    this.scale = new Float32Array(n);
    this.life = new Float32Array(n);
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) {
      this.mesh.setMatrixAt(i, hide);
      this.mesh.setColorAt(i, this.c.set(0x888888));
    }
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, color: THREE.ColorRepresentation) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.rot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3);
    this.spin.set([(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20], i * 3);
    this.scale[i] = size;
    this.life[i] = 4 + Math.random() * 3;
    this.mesh.setColorAt(i, this.c.set(color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const p = i * 3;
      const grounded = this.pos[p + 1] <= this.scale[i] * 0.13 + 0.001;
      this.vel[p + 1] -= 9.8 * dt;
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      if (this.pos[p + 1] < this.scale[i] * 0.13) {
        this.pos[p + 1] = this.scale[i] * 0.13;
        this.vel[p + 1] *= -0.3;
        this.vel[p] *= 0.7;
        this.vel[p + 2] *= 0.7;
        for (let k = 0; k < 3; k++) this.spin[p + k] *= 0.6;
      }
      if (!grounded) for (let k = 0; k < 3; k++) this.rot[p + k] += this.spin[p + k] * dt;
      const fade = Math.min(1, this.life[i]);
      this.e.set(this.rot[p], this.rot[p + 1], this.rot[p + 2]);
      this.q.setFromEuler(this.e);
      this.s.setScalar(this.scale[i] * fade);
      this.p.set(this.pos[p], this.pos[p + 1], this.pos[p + 2]);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

export class Effects {
  readonly group = new THREE.Group();
  private sparks = new SparkPool(700);
  private glow: PointPool;
  private smoke: PointPool;
  private debris = new DebrisPool(90);
  private rings: Array<{ mesh: THREE.Mesh; life: number; max: number; size: number }> = [];
  private flash: THREE.PointLight;
  private flashT = 0;
  low = false;

  constructor() {
    this.glow = new PointPool(600, true, dotTexture());
    this.smoke = new PointPool(360, false, puffTexture());
    this.group.add(this.smoke.points, this.glow.points, this.sparks.lines, this.debris.mesh);
    const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, life: 0, max: 1, size: 1 });
    }
    this.flash = new THREE.PointLight(0xffd9a0, 0, 7, 2);
    this.group.add(this.flash);
  }

  setScale(px: number) {
    this.glow.mat.uniforms.scale.value = px;
    this.smoke.mat.uniforms.scale.value = px;
  }

  /** A shower of sparks from a hit, flying along (dx, dz) in three space. */
  sparksAt(p: THREE.Vector3, n: number, dx = 0, dz = 0, power = 1) {
    const count = this.low ? Math.ceil(n / 2) : n;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (1.5 + Math.random() * 5) * power;
      this.sparks.spawn(p.x, p.y, p.z, Math.cos(a) * sp * 0.6 + dx * sp, 1 + Math.random() * 4 * power, Math.sin(a) * sp * 0.6 + dz * sp, 0.25 + Math.random() * 0.5);
    }
    this.glow.spawn(p.x, p.y, p.z, 0, 0, 0, 0.5 * power, 1.5, 1, 0.85, 0.5, 0.9, 0.12);
  }

  bigHit(p: THREE.Vector3, power: number, dx: number, dz: number) {
    this.sparksAt(p, Math.round(18 + power * 30), dx * 0.6, dz * 0.6, 1 + power * 0.6);
    this.glow.spawn(p.x, p.y, p.z, 0, 0, 0, 1.2 + power, 4, 1, 0.9, 0.7, 1, 0.16);
    this.ring(p, 0.6 + power * 1.2, 0.35);
    this.flash.position.copy(p).setY(p.y + 0.4);
    this.flashT = 0.12;
    for (let i = 0; i < 3 + power * 4; i++) this.puff(p, 0.25 + Math.random() * 0.3, 0.35, 0.3);
  }

  ring(p: THREE.Vector3, size: number, life: number) {
    const r = this.rings.find((x) => x.life <= 0) ?? this.rings[0];
    r.life = life;
    r.max = life;
    r.size = size;
    r.mesh.position.set(p.x, 0.03, p.z);
    r.mesh.visible = true;
  }

  puff(p: THREE.Vector3, size: number, shade: number, life = 1.4) {
    this.smoke.spawn(p.x + (Math.random() - 0.5) * 0.2, p.y, p.z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.5, size, size * 1.6, shade, shade, shade, 0.5, life, 1.2, 0.3);
  }

  dust(p: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.8 + Math.random() * 1.6;
      this.smoke.spawn(p.x, 0.05, p.z, Math.cos(a) * sp, 0.2 + Math.random() * 0.3, Math.sin(a) * sp, 0.35, 0.9, 0.55, 0.52, 0.48, 0.45, 0.9, 2.5, 0.1);
    }
  }

  /** Fire from a nozzle along (dx, dy, dz). */
  flame(p: THREE.Vector3, dx: number, dy: number, dz: number, power = 1) {
    for (let i = 0; i < (this.low ? 2 : 4); i++) {
      const s = 3.2 + Math.random() * 1.5;
      const j = 0.35;
      this.glow.spawn(p.x, p.y, p.z, dx * s + (Math.random() - 0.5) * j, dy * s + Math.random() * j, dz * s + (Math.random() - 0.5) * j, 0.18 * power, 1.4, 1, 0.55 + Math.random() * 0.3, 0.12, 0.85, 0.3 + Math.random() * 0.15, 2.2, 0.8);
    }
  }

  /** Blue-white exhaust while boosting. */
  boost(p: THREE.Vector3, dx: number, dz: number) {
    for (let i = 0; i < 2; i++) {
      const s = 1 + Math.random();
      this.glow.spawn(p.x, p.y, p.z, dx * s + (Math.random() - 0.5) * 0.4, 0.2 + Math.random() * 0.3, dz * s + (Math.random() - 0.5) * 0.4, 0.12, 0.5, 0.45, 0.85, 1, 0.75, 0.22, 3, 0);
    }
  }

  /** A column of fire from a floor vent. */
  vent(p: THREE.Vector3, r: number) {
    for (let i = 0; i < (this.low ? 3 : 6); i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r * 0.8;
      this.glow.spawn(p.x + Math.cos(a) * d, 0.05, p.z + Math.sin(a) * d, (Math.random() - 0.5) * 0.4, 2.5 + Math.random() * 2.5, (Math.random() - 0.5) * 0.4, 0.35, 0.6, 1, 0.5 + Math.random() * 0.3, 0.1, 0.8, 0.45, 1, 0.5);
    }
  }

  /** Smoke and flames trailing a damaged robot. */
  damaged(p: THREE.Vector3, hpFrac: number, burning: boolean, dt: number) {
    if (hpFrac < 0.55 && Math.random() < dt * (hpFrac < 0.25 ? 14 : 5)) {
      const shade = hpFrac < 0.25 ? 0.12 : 0.3;
      this.puff(p, 0.25, shade, 1.8);
    }
    if ((burning || hpFrac < 0.15) && Math.random() < dt * 20) {
      this.glow.spawn(p.x + (Math.random() - 0.5) * 0.2, p.y, p.z + (Math.random() - 0.5) * 0.2, 0, 0.8 + Math.random(), 0, 0.22, 0.4, 1, 0.5, 0.1, 0.8, 0.5, 1, 0.6);
    }
  }

  chunks(p: THREE.Vector3, n: number, color: THREE.ColorRepresentation, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (1 + Math.random() * 3) * power;
      this.debris.spawn(p.x, p.y + 0.1, p.z, Math.cos(a) * sp, 2 + Math.random() * 3 * power, Math.sin(a) * sp, 0.05 + Math.random() * 0.09, color);
    }
  }

  update(dt: number) {
    this.sparks.update(dt);
    this.glow.update(dt);
    this.smoke.update(dt);
    this.debris.update(dt);
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const k = 1 - Math.max(0, r.life) / r.max;
      r.mesh.scale.setScalar(0.2 + k * r.size * 2);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.7;
      if (r.life <= 0) r.mesh.visible = false;
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.intensity = Math.max(0, this.flashT) * 160;
    } else this.flash.intensity = 0;
  }

  dispose() {
    this.sparks.dispose();
    this.glow.dispose();
    this.smoke.dispose();
    this.debris.dispose();
    for (const r of this.rings) (r.mesh.material as THREE.Material).dispose();
    this.rings[0]?.mesh.geometry.dispose();
  }
}
