// Little portraits of robots for lists and brackets, rendered off-screen with
// the shared renderer and cached as image URLs.

import * as THREE from 'three';
import type { BotDesign } from '../data/types.ts';
import { buildBot } from './botMesh.ts';
import { envMap, getRenderer } from './gfx.ts';

const W = 200;
const H = 150;
const cache = new Map<string, string>();
const queue: Array<{ key: string; d: BotDesign; corner: 'blue' | 'red' | 'none' }> = [];
const waiting = new Set<string>();
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let rt: THREE.WebGLRenderTarget | null = null;
let busy = false;
let onReady: (() => void) | null = null;

export function onThumbsReady(fn: () => void) {
  onReady = fn;
}

const keyOf = (d: BotDesign, corner: string) =>
  [d.chassis, d.drive, d.core, d.front, d.top, d.armor.material, d.armor.front, d.armor.sides, d.armor.rear, d.armor.top, d.modules.join(','), d.paint.primary, d.paint.secondary, d.paint.pattern, corner].join('|');

/** The image URL if it is ready, otherwise null (and it gets made soon). */
export function thumb(d: BotDesign, corner: 'blue' | 'red' | 'none' = 'none'): string | null {
  const key = keyOf(d, corner);
  const hit = cache.get(key);
  if (hit) return hit;
  if (!waiting.has(key)) {
    waiting.add(key);
    queue.push({ key, d: structuredClone(d), corner });
    pump();
  }
  return null;
}

function setup() {
  if (scene) return;
  scene = new THREE.Scene();
  scene.environment = envMap();
  scene.environmentIntensity = 0.6;
  scene.add(new THREE.HemisphereLight(0xe6eeff, 0x1a1c22, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.8);
  key.position.set(-2, 3, 2.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x2ee6ff, 1.5);
  rim.position.set(2.5, 1.2, -2);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffb000, 0.8);
  rim2.position.set(-2.5, 1, -2);
  scene.add(rim2);
  camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 20);
  camera.position.set(1.55, 1.25, 1.75);
  camera.lookAt(0.05, 0.12, 0);
  rt = new THREE.WebGLRenderTarget(W * 2, H * 2, { type: THREE.HalfFloatType, samples: 4 });
}

function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const run = () => {
    const job = queue.shift();
    if (job) {
      try {
        cache.set(job.key, render(job.d, job.corner));
      } catch {
        cache.set(job.key, '');
      }
      waiting.delete(job.key);
    }
    if (queue.length) setTimeout(run, 16);
    else {
      busy = false;
      onReady?.();
    }
    if (queue.length % 3 === 0) onReady?.();
  };
  setTimeout(run, 30);
}

// ACES filmic approximation, then sRGB, to match what the canvas shows
const aces = (x: number) => {
  x *= 1.25;
  const v = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  return Math.min(1, Math.max(0, v));
};
const srgb = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

function render(d: BotDesign, corner: 'blue' | 'red' | 'none'): string {
  setup();
  const r = getRenderer();
  const bot = buildBot(d, { corner });
  const s = 1.05 / Math.max(bot.length, bot.width, 0.9);
  bot.root.scale.setScalar(s);
  bot.root.rotation.y = -0.55;
  scene!.add(bot.root);
  const prev = r.getRenderTarget();
  const prevTone = r.toneMapping;
  r.setRenderTarget(rt);
  r.setClearColor(0x000000, 0);
  r.clear();
  r.render(scene!, camera!);
  const w = rt!.width;
  const h = rt!.height;
  const px = new Uint16Array(w * h * 4);
  r.readRenderTargetPixels(rt!, 0, 0, w, h, px);
  r.setRenderTarget(prev);
  r.toneMapping = prevTone;
  r.setClearColor(0x000000, 1);
  scene!.remove(bot.root);
  bot.dispose();

  // downsample 2x, tone map, flip
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  const f16 = THREE.DataUtils.fromHalfFloat;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let rr = 0;
      let gg = 0;
      let bb = 0;
      let aa = 0;
      for (let k = 0; k < 4; k++) {
        const sx = x * 2 + (k & 1);
        const sy = (H - 1 - y) * 2 + (k >> 1);
        const i = (sy * w + sx) * 4;
        rr += f16(px[i]);
        gg += f16(px[i + 1]);
        bb += f16(px[i + 2]);
        aa += f16(px[i + 3]);
      }
      const o = (y * W + x) * 4;
      const a = Math.min(1, aa / 4);
      const un = a > 0.001 ? 1 / a : 0;
      img.data[o] = 255 * srgb(aces((rr / 4) * un));
      img.data[o + 1] = 255 * srgb(aces((gg / 4) * un));
      img.data[o + 2] = 255 * srgb(aces((bb / 4) * un));
      img.data[o + 3] = 255 * a;
    }
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}
