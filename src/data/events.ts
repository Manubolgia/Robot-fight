// The circuit: five tiers of events from a garage floor to the World Cup.
// Winning (or placing high) in a tier earns the licence for the next one.

import type { Tier } from './types.ts';

export type Format = 'bracket4' | 'bracket8' | 'bracket16' | 'groups8' | 'worldcup';

export interface EventDef {
  id: string;
  name: string;
  tier: Tier;
  arena: string;
  format: Format;
  entry: number;
  /** prize by finishing place: champion, runner-up, semi-final, quarter-final, earlier */
  prizes: number[];
  /** paid for every fight won */
  winBonus: number;
  fame: number;
  blurb: string;
}

export interface TierDef {
  tier: Tier;
  name: string;
  short: string;
  /** what earns the next licence */
  goal: string;
  /** best finish (1 = win) in this tier that unlocks the next */
  needPlace: number;
  color: string;
}

export const TIERS: TierDef[] = [
  { tier: 1, name: 'Garage League', short: 'GARAGE', goal: 'Win any Garage League event', needPlace: 1, color: '#9aa4b2' },
  { tier: 2, name: 'Regional Circuit', short: 'REGIONAL', goal: 'Win any Regional event', needPlace: 1, color: '#4fd18b' },
  { tier: 3, name: 'National Series', short: 'NATIONAL', goal: 'Win any National event', needPlace: 1, color: '#2ee6ff' },
  { tier: 4, name: 'Continental Masters', short: 'MASTERS', goal: 'Reach the final of a Masters event', needPlace: 2, color: '#b26bff' },
  { tier: 5, name: 'Kilowatt World Cup', short: 'WORLD CUP', goal: 'Lift the World Cup', needPlace: 1, color: '#ffd23f' },
];

export const EVENTS: EventDef[] = [
  {
    id: 'garage-rumble', name: 'Garage Rumble', tier: 1, arena: 'garage', format: 'bracket4',
    entry: 0, prizes: [900, 350, 100], winBonus: 150, fame: 20,
    blurb: 'Four robots, one lock-up, no hazards. Everyone starts here.',
  },
  {
    id: 'scrapyard-scuffle', name: 'Scrapyard Scuffle', tier: 1, arena: 'scrapyard', format: 'bracket4',
    entry: 100, prizes: [1200, 450, 150], winBonus: 200, fame: 25,
    blurb: 'Spiked walls east and west. Pushers love it here.',
  },
  {
    id: 'basement-bash', name: 'Basement Bash', tier: 1, arena: 'garage', format: 'bracket8',
    entry: 200, prizes: [1800, 700, 300, 100], winBonus: 150, fame: 35,
    blurb: 'Eight teams and three wins for the title.',
  },
  {
    id: 'regional-open', name: 'Regional Open', tier: 2, arena: 'steelpit', format: 'bracket8',
    entry: 400, prizes: [4200, 1700, 750, 250], winBonus: 400, fame: 60,
    blurb: 'Floor saws and the pit. The real circuit starts here.',
  },
  {
    id: 'thunderdome-classic', name: 'Thunderdome Classic', tier: 2, arena: 'thunderdome', format: 'bracket8',
    entry: 500, prizes: [4800, 1900, 850, 300], winBonus: 450, fame: 70,
    blurb: 'Fire vents in every corner. Bring a heat sink.',
  },
  {
    id: 'iron-valley', name: 'Iron Valley Cup', tier: 2, arena: 'scrapyard', format: 'bracket8',
    entry: 400, prizes: [4000, 1600, 700, 250], winBonus: 400, fame: 60,
    blurb: 'Spiked walls and a tough regional field.',
  },
  {
    id: 'nationals', name: 'National Championship', tier: 3, arena: 'crucible', format: 'bracket8',
    entry: 1500, prizes: [13000, 5200, 2300, 800], winBonus: 1200, fame: 140,
    blurb: 'The Crucible: saws, a centre hammer and a pit. National title on the line.',
  },
  {
    id: 'gauntlet', name: 'Gauntlet Invitational', tier: 3, arena: 'gauntlet', format: 'groups8',
    entry: 1800, prizes: [15000, 6000, 2600, 900], winBonus: 1100, fame: 160,
    blurb: 'Two groups of four, then semis and a final. Five fights, little time to repair.',
  },
  {
    id: 'masters', name: 'Masters of Metal', tier: 4, arena: 'colosseum', format: 'bracket16',
    entry: 4000, prizes: [34000, 14000, 6500, 2800, 900], winBonus: 2600, fame: 300,
    blurb: 'Sixteen of the best robots on the continent in front of a full Colosseum.',
  },
  {
    id: 'continental-crown', name: 'Continental Crown', tier: 4, arena: 'crucible', format: 'groups8',
    entry: 5000, prizes: [38000, 15000, 7000, 3000], winBonus: 2800, fame: 320,
    blurb: 'Group stage and knockouts in the Crucible. A final berth earns a World Cup invitation.',
  },
  {
    id: 'world-cup', name: 'Kilowatt World Cup', tier: 5, arena: 'worldarena', format: 'worldcup',
    entry: 0, prizes: [125000, 52000, 26000, 12000, 5000], winBonus: 5000, fame: 1000,
    blurb: 'Sixteen nations. Four groups, then the knockouts. Six fights to be champion of the world.',
  },
];

export const eventOf = (id: string) => EVENTS.find((e) => e.id === id);
/** The arenas a tier's events are fought in. */
export const arenasOfTier = (t: number) => [...new Set(EVENTS.filter((e) => e.tier === t).map((e) => e.arena))];
export const tierOf = (t: number) => TIERS.find((x) => x.tier === t) ?? TIERS[0];

export const FORMAT_LABEL: Record<Format, string> = {
  bracket4: '4-robot knockout',
  bracket8: '8-robot knockout',
  bracket16: '16-robot knockout',
  groups8: '2 groups of 4 + knockouts',
  worldcup: '4 groups of 4 + knockouts',
};

export const FORMAT_FIGHTS: Record<Format, number> = { bracket4: 2, bracket8: 3, bracket16: 4, groups8: 5, worldcup: 6 };
export const FORMAT_SIZE: Record<Format, number> = { bracket4: 4, bracket8: 8, bracket16: 16, groups8: 8, worldcup: 16 };
