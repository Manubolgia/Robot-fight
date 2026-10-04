// One WebGL renderer for the whole app. Phones (iOS especially) limit how
// many WebGL contexts a page may hold, so the garage turntable and the arena
// share this one and its canvas moves between them.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

let renderer: THREE.WebGLRenderer | null = null;
let quality: 'high' | 'low' = 'high';
let host: HTMLElement | null = null;
let observer: ResizeObserver | null = null;
let onResize: (() => void) | null = null;

export function setQuality(q: 'high' | 'low') {
  quality = q;
  if (renderer) {
    renderer.setPixelRatio(pixelRatio());
    renderer.shadowMap.enabled = q === 'high';
    if (host) fit();
  }
}

export const getQuality = () => quality;

function pixelRatio() {
  return Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.25);
}

export function getRenderer(): THREE.WebGLRenderer {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
    renderer.setPixelRatio(pixelRatio());
    renderer.shadowMap.enabled = quality === 'high';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = 'gl';
    renderer.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault());
  }
  return renderer;
}

function fit() {
  if (!renderer || !host) return;
  const w = Math.max(1, host.clientWidth);
  const h = Math.max(1, host.clientHeight);
  renderer.setSize(w, h, true);
  onResize?.();
}

/** Put the canvas in `el` and keep it sized to it. Returns the size now. */
export function mount(el: HTMLElement, resized?: () => void): THREE.WebGLRenderer {
  const r = getRenderer();
  if (host !== el) {
    observer?.disconnect();
    host = el;
    el.appendChild(r.domElement);
    observer = new ResizeObserver(() => fit());
    observer.observe(el);
  }
  onResize = resized ?? null;
  fit();
  return r;
}

export function unmount(el: HTMLElement) {
  if (host === el) {
    observer?.disconnect();
    observer = null;
    host = null;
    onResize = null;
    renderer?.domElement.remove();
  }
}

let env: THREE.Texture | null = null;

/** A soft studio room baked into an environment map, so metal parts reflect something. */
export function envMap(): THREE.Texture {
  if (!env) {
    const r = getRenderer();
    const pm = new THREE.PMREMGenerator(r);
    const room = new RoomEnvironment();
    env = pm.fromScene(room, 0.04).texture;
    room.dispose();
    pm.dispose();
  }
  return env;
}

export function canvasSize(): { w: number; h: number } {
  const c = renderer?.domElement;
  return { w: c?.clientWidth ?? 1, h: c?.clientHeight ?? 1 };
}
