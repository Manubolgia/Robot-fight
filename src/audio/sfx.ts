// Every sound is synthesised with WebAudio: spinner whine, motor hum,
// impacts, sparks, pneumatics, the crowd, the starting horn. No files to load.

type Voice = { osc: OscillatorNode; osc2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode };

class Sfx {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private crowdGain: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private voices: Voice[] = [];
  private motors: Voice[] = [];
  private loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  enabled = true;
  private lastHit = 0;

  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let b = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b = (b + 0.02 * w) / 1.02;
        d[i] = w * 0.6 + b * 2.5;
      }
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      this.stopFight();
      void this.ctx?.suspend();
    } else if (this.ctx) void this.ctx.resume();
  }

  private ok(): AudioContext | null {
    return this.enabled && this.ctx && this.ctx.state === 'running' ? this.ctx : null;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private noiseBurst(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number, sweepTo?: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, peak, 0.004, dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, attack = 0.005) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    this.env(g, t, peak, attack, dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  // ---- UI ----------------------------------------------------------------------

  click() {
    const c = this.ok();
    if (!c) return;
    this.tone(c.currentTime, 'sine', 1400, 700, 0.05, 0.12);
  }

  select() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    this.tone(t, 'triangle', 660, 660, 0.06, 0.1);
    this.tone(t + 0.05, 'triangle', 990, 990, 0.08, 0.1);
  }

  buy() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    this.noiseBurst(t, 0.05, 'highpass', 4000, 1, 0.2);
    this.tone(t + 0.02, 'sine', 1320, 1320, 0.12, 0.18);
    this.tone(t + 0.1, 'sine', 1760, 1760, 0.25, 0.18);
  }

  equip() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    this.noiseBurst(t, 0.06, 'bandpass', 2400, 3, 0.25);
    this.tone(t, 'square', 180, 90, 0.08, 0.08);
  }

  error() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    this.tone(t, 'square', 220, 200, 0.12, 0.08);
    this.tone(t + 0.13, 'square', 180, 160, 0.16, 0.08);
  }

  fanfare() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(t + i * 0.11, 'square', f, f, i === 5 ? 0.6 : 0.12, 0.07));
    [262, 330, 392].forEach((f) => this.tone(t + 0.55, 'sawtooth', f, f, 0.7, 0.04, 0.02));
  }

  sad() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    [392, 349, 311, 262].forEach((f, i) => this.tone(t + i * 0.18, 'triangle', f, f * 0.98, 0.3, 0.12));
  }

  levelUp() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    [440, 554, 659, 880, 1109, 1319].forEach((f, i) => this.tone(t + i * 0.07, 'triangle', f, f, 0.18, 0.1));
  }

  // ---- fight one-shots ---------------------------------------------------------

  /** A weapon hit: power 0..1.5 */
  hit(power: number, kind = 'kinetic') {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    if (t - this.lastHit < 0.03) return;
    this.lastHit = t;
    const p = Math.min(1.6, power);
    this.noiseBurst(t, 0.08 + p * 0.18, 'lowpass', 1800 + p * 2500, 0.8, 0.35 + p * 0.45);
    this.tone(t, 'sine', 150 + p * 40, 38, 0.18 + p * 0.15, 0.4 + p * 0.4);
    // metal ring
    const base = kind === 'pierce' ? 520 : 340;
    for (const m of [1, 2.76, 5.4]) this.tone(t, 'sine', base * m * (0.9 + Math.random() * 0.2), base * m * 0.97, 0.25 + p * 0.35, (0.05 + p * 0.05) / m);
    if (p > 0.6) this.sparks(p);
  }

  sparks(power = 1) {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    for (let i = 0; i < 4; i++) this.noiseBurst(t + i * 0.025 + Math.random() * 0.02, 0.04, 'highpass', 5000 + Math.random() * 3000, 1, 0.08 * power);
  }

  clash() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    this.hit(1.4);
    for (const f of [880, 1240, 1975, 2630]) this.tone(t, 'triangle', f, f * 0.96, 0.9, 0.05);
  }

  grind() {
    const c = this.ok();
    if (!c) return;
    this.noiseBurst(c.currentTime, 0.07, 'bandpass', 3200 + Math.random() * 1500, 4, 0.12);
  }

  pneumatic() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    this.noiseBurst(t, 0.22, 'highpass', 1500, 0.7, 0.45, 6000);
    this.tone(t, 'sine', 120, 50, 0.2, 0.5);
  }

  whoosh() {
    const c = this.ok();
    if (!c) return;
    this.noiseBurst(c.currentTime, 0.25, 'bandpass', 400, 2, 0.25, 2200);
  }

  land(power: number) {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    this.tone(t, 'sine', 110, 35, 0.25, Math.min(0.8, 0.2 + power * 0.08));
    this.noiseBurst(t, 0.15, 'lowpass', 900, 0.7, Math.min(0.5, power * 0.07));
  }

  hammerHazard() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    this.noiseBurst(t, 0.12, 'bandpass', 600, 1, 0.3, 200);
    this.hit(1.5);
  }

  boost() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    this.noiseBurst(t, 0.5, 'bandpass', 300, 1.5, 0.3, 2400);
    this.tone(t, 'sawtooth', 80, 220, 0.4, 0.06);
  }

  horn() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    for (const f of [220, 277, 330, 440]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.05);
      g.gain.setValueAtTime(0.06, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(lp).connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 1.2);
    }
    this.cheer(0.8);
  }

  beep(final = false) {
    const c = this.ok();
    if (!c) return;
    this.tone(c.currentTime, 'square', final ? 1320 : 880, final ? 1320 : 880, final ? 0.4 : 0.12, 0.1);
  }

  buzzer() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    this.tone(t, 'sawtooth', 140, 130, 0.9, 0.12, 0.01);
    this.tone(t, 'square', 70, 65, 0.9, 0.06, 0.01);
  }

  ko() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    this.hit(1.6);
    this.tone(t + 0.1, 'sawtooth', 300, 60, 1.2, 0.08);
    this.cheer(1);
  }

  pitDrop() {
    const c = this.ok();
    if (!c) return;
    const t = c.currentTime;
    this.tone(t, 'triangle', 600, 80, 1.1, 0.12);
    this.cheer(1);
  }

  /** The crowd roars. */
  cheer(power: number) {
    const c = this.ok();
    if (!c || !this.crowdGain) return;
    const g = this.crowdGain.gain;
    const t = c.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.05 + power * 0.22, t + 0.15);
    g.linearRampToValueAtTime(0.045, t + 1.8 + power);
  }

  // ---- fight loops -------------------------------------------------------------

  startFight() {
    const c = this.ok();
    if (!c) return;
    this.stopFight();
    // crowd bed
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 0.6;
    const g = c.createGain();
    g.gain.value = 0.045;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    this.crowdGain = g;
    this.crowdFilter = f;
    this.loops.set('crowd', { src, gain: g });
    // weapon whine and motor hum per robot
    for (let i = 0; i < 2; i++) {
      this.voices.push(this.voice('sawtooth', 'bandpass', 2.2));
      this.motors.push(this.voice('square', 'lowpass', 0.7));
    }
  }

  private voice(type: OscillatorType, ft: BiquadFilterType, q: number): Voice {
    const c = this.ctx!;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = 60;
    const osc2 = c.createOscillator();
    osc2.type = type;
    osc2.frequency.value = 61;
    const filter = c.createBiquadFilter();
    filter.type = ft;
    filter.frequency.value = 400;
    filter.Q.value = q;
    const gain = c.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(this.master);
    osc.start();
    osc2.start();
    return { osc, osc2, filter, gain };
  }

  /** Per frame: spinner speed 0..1, weapon kind, drive speed m/s, for each robot. */
  fightTick(state: Array<{ spin: number; saw: boolean; speed: number; flame: boolean }>, excitement: number) {
    const c = this.ok();
    if (!c || !this.voices.length) return;
    const t = c.currentTime;
    state.forEach((s, i) => {
      const v = this.voices[i];
      const m = this.motors[i];
      if (!v || !m) return;
      const spin = s.saw ? 0.75 : s.spin;
      const f = 70 + Math.pow(spin, 0.8) * (s.saw ? 900 : 520);
      v.osc.frequency.setTargetAtTime(f, t, 0.08);
      v.osc2.frequency.setTargetAtTime(f * 1.012, t, 0.08);
      v.filter.frequency.setTargetAtTime(f * 2.2, t, 0.1);
      v.gain.gain.setTargetAtTime(spin > 0.03 ? 0.018 + spin * 0.05 : 0, t, 0.1);
      const mf = 38 + s.speed * 22;
      m.osc.frequency.setTargetAtTime(mf, t, 0.1);
      m.osc2.frequency.setTargetAtTime(mf * 1.5, t, 0.1);
      m.filter.frequency.setTargetAtTime(200 + s.speed * 120, t, 0.1);
      m.gain.gain.setTargetAtTime(Math.min(0.045, 0.006 + s.speed * 0.008), t, 0.12);
      this.flame(i, s.flame);
    });
    if (this.crowdFilter) this.crowdFilter.frequency.setTargetAtTime(800 + excitement * 700, t, 0.3);
  }

  private flame(i: number, on: boolean) {
    const key = `flame${i}`;
    const c = this.ctx!;
    const cur = this.loops.get(key);
    if (on && !cur) {
      const src = c.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      const g = c.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.35, c.currentTime + 0.08);
      src.connect(f).connect(g).connect(this.master);
      src.start();
      this.loops.set(key, { src, gain: g });
    } else if (!on && cur) {
      cur.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.05);
      cur.src.stop(c.currentTime + 0.3);
      this.loops.delete(key);
    }
  }

  stopFight() {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    for (const v of [...this.voices, ...this.motors]) {
      v.gain.gain.setTargetAtTime(0, t, 0.05);
      v.osc.stop(t + 0.3);
      v.osc2.stop(t + 0.3);
    }
    this.voices = [];
    this.motors = [];
    for (const l of this.loops.values()) {
      l.gain.gain.setTargetAtTime(0.0001, t, 0.1);
      l.src.stop(t + 0.5);
    }
    this.loops.clear();
    this.crowdGain = null;
    this.crowdFilter = null;
  }
}

export const sfx = new Sfx();
