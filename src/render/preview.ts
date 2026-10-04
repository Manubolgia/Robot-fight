// The garage turntable: the robot under studio lights, slowly turning,
// draggable with a finger. Rebuilt whenever the design changes.

import * as THREE from 'three';
import type { BotDesign } from '../data/types.ts';
import { buildBot, poseWeapon, type BotView } from './botMesh.ts';
import { glowTexture } from './textures.ts';
import { envMap } from './gfx.ts';

export class Preview {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  private bot: BotView | null = null;
  private stage = new THREE.Group();
  private turn = 0.6;
  private spinV = 0.35;
  private dragging = false;
  private t = 0;
  private key: string = '';
  zoom = 1;
  /** where on the robot the camera aims: raise it to push the robot down the screen */
  lookY = 0.12;

  constructor() {
    this.scene.background = new THREE.Color(0x0b0d12);
    this.scene.fog = new THREE.Fog(0x0b0d12, 6, 14);
    this.scene.environment = envMap();
    this.scene.environmentIntensity = 0.55;
    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x101015, 1.2);
    this.scene.add(hemi);
    const key = new THREE.SpotLight(0xffffff, 40, 12, 0.6, 0.5, 1.4);
    key.position.set(-2.2, 3.6, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x2ee6ff, 1.6);
    rim.position.set(2.5, 1.5, -2.5);
    this.scene.add(rim);
    const rim2 = new THREE.DirectionalLight(0xffb000, 0.9);
    rim2.position.set(-3, 1, -2);
    this.scene.add(rim2);
    // turntable
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.32, 0.06, 64), new THREE.MeshStandardMaterial({ color: 0x23262d, metalness: 0.85, roughness: 0.35 }));
    disc.position.y = -0.03;
    disc.receiveShadow = true;
    this.scene.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.29, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: 0x2ee6ff }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.002;
    this.scene.add(ring);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x2ee6ff, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.055;
    this.scene.add(glow);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.06;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.scene.add(this.stage);
  }

  setDesign(d: BotDesign, corner: 'blue' | 'red' | 'none' = 'blue') {
    const key = JSON.stringify(d) + corner;
    if (key === this.key) return;
    this.key = key;
    if (this.bot) {
      this.stage.remove(this.bot.root);
      this.bot.dispose();
    }
    this.bot = buildBot(d, { corner, number: '' });
    this.stage.add(this.bot.root);
  }

  setSize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  drag(dx: number) {
    this.turn += dx * 0.012;
    this.spinV = dx * 0.6;
  }

  setDragging(v: boolean) {
    this.dragging = v;
  }

  frame(dt: number) {
    this.t += dt;
    if (!this.dragging) {
      this.spinV += (0.35 - this.spinV) * Math.min(1, dt * 1.5);
      this.turn += this.spinV * dt;
    }
    this.stage.rotation.y = this.turn;
    if (this.bot) {
      const b = this.bot;
      // show the weapon working
      const cycle = (this.t % 4) / 4;
      const anim = cycle > 0.55 && cycle < 0.75 ? Math.sin(((cycle - 0.55) / 0.2) * Math.PI) : 0;
      poseWeapon(b.front, this.t * 6, 0.3, anim);
      poseWeapon(b.top, this.t * 6, 0.3, anim);
      b.lift.position.y = b.height / 2 + Math.sin(this.t * 2) * 0.004;
    }
    // fit a ~1.5 m wide robot in both directions, whatever the screen shape
    const vf = (this.camera.fov * Math.PI) / 360;
    const hf = Math.atan(Math.tan(vf) * this.camera.aspect);
    const fitW = 0.85 / Math.tan(hf);
    const fitH = 0.62 / Math.tan(vf);
    const dist = Math.max(fitW, fitH, 2.2) / this.zoom;
    this.camera.position.set(0, dist * 0.45, dist * 0.9);
    this.camera.lookAt(0, this.lookY, 0);
  }

  render(r: THREE.WebGLRenderer) {
    r.render(this.scene, this.camera);
  }

  dispose() {
    this.bot?.dispose();
  }
}
