// Arenas: a square box of a given size with hazards. Coordinates are metres
// from the centre, +x east, +y north. The player starts south.

export interface PitDef {
  x: number;
  y: number;
  w: number;
  h: number;
  /** seconds into the fight when the pit opens */
  opensAt: number;
}

export interface CycleZone {
  x: number;
  y: number;
  w: number;
  h: number;
  period: number;
  active: number;
  offset: number;
}

export interface CircleZone {
  x: number;
  y: number;
  r: number;
}

export interface FlameVent extends CircleZone {
  period: number;
  active: number;
  offset: number;
}

export interface WallSpikes {
  side: 'n' | 's' | 'e' | 'w';
  from: number;
  to: number;
}

export interface ArenaTheme {
  floor: 'concrete' | 'steel' | 'plate' | 'dark';
  accent: string;
  light: string;
  crowd: number; // 0..1 how full the stands are
  fog: string;
}

export interface ArenaDef {
  id: string;
  name: string;
  size: number;
  pit?: PitDef;
  saws?: CycleZone[];
  hammer?: CircleZone;
  flames?: FlameVent[];
  spikes?: WallSpikes[];
  theme: ArenaTheme;
  blurb: string;
}

export const ARENAS: ArenaDef[] = [
  {
    id: 'garage', name: 'The Garage', size: 8,
    theme: { floor: 'concrete', accent: '#ffb000', light: '#ffe2b0', crowd: 0.15, fog: '#120d08' },
    blurb: 'A lock-up with a chalk circle. No hazards, no excuses.',
  },
  {
    id: 'scrapyard', name: 'Scrapyard', size: 9,
    spikes: [
      { side: 'e', from: -2.5, to: 2.5 },
      { side: 'w', from: -2.5, to: 2.5 },
    ],
    theme: { floor: 'plate', accent: '#ff7a1a', light: '#ffd9a8', crowd: 0.3, fog: '#140c06' },
    blurb: 'Spiked scrap walls east and west. Shove them in.',
  },
  {
    id: 'steelpit', name: 'Steel Pit', size: 10,
    pit: { x: 3.5, y: 0, w: 1.5, h: 1.5, opensAt: 40 },
    saws: [
      { x: -3.3, y: 0, w: 0.5, h: 4.5, period: 5, active: 2, offset: 0 },
    ],
    theme: { floor: 'steel', accent: '#2ee6ff', light: '#cfe9ff', crowd: 0.5, fog: '#060a10' },
    blurb: 'Floor saws in the west, and the pit opens in the east after 40 seconds.',
  },
  {
    id: 'thunderdome', name: 'Thunderdome', size: 10,
    flames: [
      { x: -2.6, y: 2.6, r: 0.75, period: 6, active: 1.8, offset: 0 },
      { x: 2.6, y: -2.6, r: 0.75, period: 6, active: 1.8, offset: 3 },
      { x: 2.6, y: 2.6, r: 0.75, period: 6, active: 1.8, offset: 1.5 },
      { x: -2.6, y: -2.6, r: 0.75, period: 6, active: 1.8, offset: 4.5 },
    ],
    spikes: [{ side: 'n', from: -2, to: 2 }],
    theme: { floor: 'dark', accent: '#ff3b3b', light: '#ffc9a8', crowd: 0.6, fog: '#140606' },
    blurb: 'Fire vents in every corner. Hot robots overheat.',
  },
  {
    id: 'crucible', name: 'The Crucible', size: 11,
    pit: { x: 0, y: 4.0, w: 1.6, h: 1.4, opensAt: 45 },
    saws: [
      { x: -3.6, y: -1.5, w: 0.5, h: 3.5, period: 5, active: 2, offset: 0 },
      { x: 3.6, y: -1.5, w: 0.5, h: 3.5, period: 5, active: 2, offset: 2.5 },
    ],
    hammer: { x: 0, y: -0.2, r: 0.9 },
    theme: { floor: 'steel', accent: '#ffc400', light: '#fff1c9', crowd: 0.7, fog: '#0d0b05' },
    blurb: 'Saws on both flanks, a hammer in the middle and a pit in the north.',
  },
  {
    id: 'gauntlet', name: 'The Gauntlet', size: 11,
    hammer: { x: 3.7, y: 3.7, r: 1.0 },
    flames: [
      { x: -3.6, y: 3.6, r: 0.8, period: 5, active: 1.6, offset: 0 },
      { x: 0, y: 0, r: 0.7, period: 7, active: 1.6, offset: 2 },
    ],
    spikes: [
      { side: 'e', from: -3, to: 1.5 },
      { side: 'w', from: -3, to: 1.5 },
    ],
    theme: { floor: 'plate', accent: '#b26bff', light: '#e6d4ff', crowd: 0.75, fog: '#0b0612' },
    blurb: 'Spiked walls, a corner hammer and a fire vent dead centre.',
  },
  {
    id: 'colosseum', name: 'Colosseum', size: 12,
    pit: { x: -4.4, y: 4.4, w: 1.6, h: 1.6, opensAt: 35 },
    saws: [
      { x: 0, y: 2.0, w: 4.5, h: 0.5, period: 6, active: 2.2, offset: 0 },
    ],
    hammer: { x: 4.4, y: 4.4, r: 1.0 },
    flames: [
      { x: -4.2, y: -4.2, r: 0.85, period: 6, active: 1.8, offset: 1 },
      { x: 4.2, y: -4.2, r: 0.85, period: 6, active: 1.8, offset: 4 },
    ],
    spikes: [{ side: 'e', from: -2, to: 2 }, { side: 'w', from: -2, to: 2 }],
    theme: { floor: 'dark', accent: '#ff7a1a', light: '#ffe0bf', crowd: 0.9, fog: '#100804' },
    blurb: 'Everything at once, in front of a full house.',
  },
  {
    id: 'worldarena', name: 'World Arena', size: 12,
    pit: { x: 0, y: 4.7, w: 1.8, h: 1.3, opensAt: 30 },
    saws: [
      { x: -4.4, y: 0, w: 0.5, h: 4.0, period: 5, active: 2, offset: 0 },
      { x: 4.4, y: 0, w: 0.5, h: 4.0, period: 5, active: 2, offset: 2.5 },
    ],
    hammer: { x: 0, y: -0.4, r: 0.9 },
    flames: [
      { x: -4.3, y: 4.3, r: 0.8, period: 6, active: 1.8, offset: 0 },
      { x: 4.3, y: 4.3, r: 0.8, period: 6, active: 1.8, offset: 3 },
    ],
    spikes: [{ side: 's', from: -3, to: 3 }],
    theme: { floor: 'steel', accent: '#ffd23f', light: '#ffffff', crowd: 1, fog: '#05070d' },
    blurb: 'The World Cup stage: saws, hammer, fire, spikes, and the pit.',
  },
];

const BY_ID = new Map(ARENAS.map((a) => [a.id, a]));
export const arenaOf = (id: string): ArenaDef => BY_ID.get(id) ?? ARENAS[0];
