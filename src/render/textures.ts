// Procedural textures, drawn once on canvases: arena floors, paint jobs,
// treads, carbon weave, hazard stripes and the soft dot particles use.

import * as THREE from 'three';
import type { Paint } from '../data/types.ts';
import { mulberry32 } from '../sim/rng.ts';

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, repeat = false, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function memo<T extends THREE.Texture>(key: string, make: () => T): T {
  let t = cache.get(key) as T | undefined;
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

export type FloorStyle = 'concrete' | 'steel' | 'plate' | 'dark';

/** One 2 m x 2 m floor tile, repeated across the arena. */
export function floorTexture(style: FloorStyle): THREE.CanvasTexture {
  return memo(`floor-${style}`, () => {
    const S = 512;
    const [c, g] = canvas(S, S);
    const rng = mulberry32(style.length * 97 + 3);
    const base = { concrete: '#5d5a55', steel: '#4a5058', plate: '#4f4a44', dark: '#2c2e33' }[style];
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    // grain
    for (let i = 0; i < 2600; i++) {
      const v = rng();
      g.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.02 + rng() * 0.04})` : `rgba(0,0,0,${0.03 + rng() * 0.06})`;
      const s = 1 + rng() * 3;
      g.fillRect(rng() * S, rng() * S, s, s);
    }
    if (style === 'plate') {
      // diamond tread plate
      g.strokeStyle = 'rgba(255,255,255,0.09)';
      g.lineWidth = 3;
      for (let y = 0; y < S; y += 24) {
        for (let x = (y / 24) % 2 ? 12 : 0; x < S; x += 24) {
          g.beginPath();
          g.moveTo(x - 6, y - 4);
          g.lineTo(x + 6, y + 4);
          g.stroke();
        }
      }
    }
    // scratches and scuffs
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.04 + rng() * 0.08})`;
      g.lineWidth = 0.5 + rng() * 1.5;
      g.beginPath();
      const x = rng() * S;
      const y = rng() * S;
      const a = rng() * Math.PI;
      const l = 10 + rng() * 80;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rng() * 10, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const r = 20 + rng() * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${0.12 + rng() * 0.15})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // plate seams and bolts
    if (style !== 'concrete') {
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = 4;
      g.strokeRect(2, 2, S - 4, S - 4);
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.lineWidth = 1;
      g.strokeRect(5, 5, S - 10, S - 10);
      for (const [bx, by] of [[18, 18], [S - 18, 18], [18, S - 18], [S - 18, S - 18], [S / 2, 18], [S / 2, S - 18], [18, S / 2], [S - 18, S / 2]]) {
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.beginPath();
        g.arc(bx + 1, by + 1, 6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(200,205,210,0.5)';
        g.beginPath();
        g.arc(bx, by, 5, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 2;
      g.strokeRect(1, 1, S - 2, S - 2);
    }
    return tex(c, true);
  });
}

export function stripeTexture(a = '#ffc400', b = '#141414'): THREE.CanvasTexture {
  return memo(`stripe-${a}-${b}`, () => {
    const [c, g] = canvas(128, 128);
    g.fillStyle = b;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = a;
    for (let i = -128; i < 256; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 32, 0);
      g.lineTo(i + 32 + 128, 128);
      g.lineTo(i + 128, 128);
      g.closePath();
      g.fill();
    }
    return tex(c, true);
  });
}

export function treadTexture(): THREE.CanvasTexture {
  return memo('tread', () => {
    const [c, g] = canvas(64, 256);
    g.fillStyle = '#18191b';
    g.fillRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 32) {
      g.fillStyle = '#2b2d30';
      g.fillRect(0, y, 64, 14);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, y, 64, 2);
    }
    return tex(c, true);
  });
}

export function tireTexture(): THREE.CanvasTexture {
  return memo('tire', () => {
    const [c, g] = canvas(128, 32);
    g.fillStyle = '#151515';
    g.fillRect(0, 0, 128, 32);
    for (let x = 0; x < 128; x += 16) {
      g.fillStyle = '#262626';
      g.fillRect(x, 0, 8, 32);
    }
    return tex(c, true);
  });
}

export function hubTexture(): THREE.CanvasTexture {
  return memo('hub', () => {
    const [c, g] = canvas(128, 128);
    g.fillStyle = '#141414';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#9aa0a8';
    g.beginPath();
    g.arc(64, 64, 34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5e646c';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(64 + Math.cos(a) * 20, 64 + Math.sin(a) * 20, 6, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#2b2b2b';
    g.beginPath();
    g.arc(64, 64, 8, 0, Math.PI * 2);
    g.fill();
    return tex(c);
  });
}

export function carbonTexture(): THREE.CanvasTexture {
  return memo('carbon', () => {
    const [c, g] = canvas(64, 64);
    g.fillStyle = '#121316';
    g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) {
      for (let x = 0; x < 64; x += 8) {
        const odd = ((x + y) / 8) % 2;
        const gr = odd ? g.createLinearGradient(x, y, x + 8, y) : g.createLinearGradient(x, y, x, y + 8);
        gr.addColorStop(0, '#1b1d22');
        gr.addColorStop(0.5, '#34373e');
        gr.addColorStop(1, '#1b1d22');
        g.fillStyle = gr;
        g.fillRect(x + 0.5, y + 0.5, 7, 7);
      }
    }
    return tex(c, true);
  });
}

export function brushedTexture(): THREE.CanvasTexture {
  return memo('brushed', () => {
    const [c, g] = canvas(256, 256);
    const rng = mulberry32(5);
    g.fillStyle = '#d0d0d0';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) {
      const v = 180 + Math.floor(rng() * 60);
      g.strokeStyle = `rgba(${v},${v},${v},0.35)`;
      g.lineWidth = rng() * 1.5;
      const y = rng() * 256;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(256, y + (rng() - 0.5) * 4);
      g.stroke();
    }
    return tex(c, true);
  });
}

/** The paint job on a robot's top panels: base colour and a pattern. */
export function paintTexture(p: Paint): THREE.CanvasTexture {
  return memo(`paint-${p.primary}-${p.secondary}-${p.pattern}`, () => {
    const S = 256;
    const [c, g] = canvas(S, S);
    g.fillStyle = p.primary;
    g.fillRect(0, 0, S, S);
    g.fillStyle = p.secondary;
    g.strokeStyle = p.secondary;
    const rng = mulberry32(p.pattern.length * 31 + p.primary.charCodeAt(1));
    switch (p.pattern) {
      case 'stripes':
        g.fillRect(S * 0.38, 0, S * 0.08, S);
        g.fillRect(S * 0.54, 0, S * 0.08, S);
        break;
      case 'checker':
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect((x * S) / 8, (y * S) / 8, S / 8, S / 8);
        break;
      case 'flames': {
        for (let i = 0; i < 6; i++) {
          const y = (i + 0.5) * (S / 6);
          g.beginPath();
          g.moveTo(S, y - 18);
          g.bezierCurveTo(S * 0.6, y - 30, S * 0.5, y + 10, S * 0.15 + rng() * 30, y);
          g.bezierCurveTo(S * 0.5, y + 22, S * 0.7, y + 20, S, y + 18);
          g.closePath();
          g.fill();
        }
        break;
      }
      case 'hazard':
        for (let i = -S; i < S * 2; i += 48) {
          g.beginPath();
          g.moveTo(i, 0);
          g.lineTo(i + 24, 0);
          g.lineTo(i + 24 + S, S);
          g.lineTo(i + S, S);
          g.closePath();
          g.fill();
        }
        break;
      case 'camo':
        for (let i = 0; i < 26; i++) {
          g.globalAlpha = 0.55 + rng() * 0.45;
          g.beginPath();
          g.ellipse(rng() * S, rng() * S, 12 + rng() * 34, 8 + rng() * 22, rng() * 3, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
        break;
      case 'bolt':
        g.beginPath();
        g.moveTo(S * 0.58, S * 0.05);
        g.lineTo(S * 0.3, S * 0.55);
        g.lineTo(S * 0.5, S * 0.55);
        g.lineTo(S * 0.38, S * 0.95);
        g.lineTo(S * 0.74, S * 0.4);
        g.lineTo(S * 0.53, S * 0.4);
        g.closePath();
        g.fill();
        break;
      default:
        g.globalAlpha = 0.25;
        g.fillRect(0, S * 0.45, S, S * 0.1);
        g.globalAlpha = 1;
    }
    // panel wear
    g.globalAlpha = 0.18;
    for (let i = 0; i < 40; i++) {
      g.fillStyle = rng() > 0.5 ? '#000' : '#fff';
      g.fillRect(rng() * S, rng() * S, 1 + rng() * 3, 1 + rng() * 3);
    }
    g.globalAlpha = 1;
    return tex(c);
  });
}

/** Soft round dot for particles. */
export function dotTexture(): THREE.CanvasTexture {
  return memo('dot', () => {
    const [c, g] = canvas(64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return tex(c, false, false);
  });
}

/** Big soft smoke puff. */
export function puffTexture(): THREE.CanvasTexture {
  return memo('puff', () => {
    const [c, g] = canvas(128, 128);
    const rng = mulberry32(11);
    for (let i = 0; i < 14; i++) {
      const x = 40 + rng() * 48;
      const y = 40 + rng() * 48;
      const r = 18 + rng() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.32)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    }
    return tex(c, false, false);
  });
}

/** A team badge / number for robot top panels. */
export function numberTexture(text: string, color: string): THREE.CanvasTexture {
  return memo(`num-${text}-${color}`, () => {
    const [c, g] = canvas(128, 128);
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = color;
    g.font = 'bold 84px "Russo One", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 70);
    return tex(c);
  });
}

/** Glow gradient for lights on the floor. */
export function glowTexture(): THREE.CanvasTexture {
  return memo('glow', () => {
    const [c, g] = canvas(128, 128);
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.25)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return tex(c, false, false);
  });
}
