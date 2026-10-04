// Names for the teams on the circuit, and the rivals who follow you up it.

import type { Paint } from '../data/types.ts';
import { pick, type Rng } from '../sim/rng.ts';

export interface RivalDef {
  id: string;
  team: string;
  bot: string;
  driver: string;
  archetype: string;
  /** first tier they enter */
  from: number;
  paint: Paint;
  country: string;
  taunt: string;
}

export const RIVALS: RivalDef[] = [
  { id: 'gearheads', team: 'The Gearheads', bot: 'Torque Jr.', driver: 'Mo Gearhart', archetype: 'drum', from: 1, country: 'US',
    paint: { primary: '#2f6fed', secondary: '#f2f2f2', pattern: 'stripes' }, taunt: 'Dad built the first Torque. I built this one better.' },
  { id: 'ironmonks', team: 'Iron Monks', bot: 'Bulldozer', driver: 'Brother Anselm', archetype: 'wedge', from: 1, country: 'IT',
    paint: { primary: '#ffc400', secondary: '#141414', pattern: 'hazard' }, taunt: 'Patience. The wall does the work.' },
  { id: 'launchlab', team: 'Launch Lab', bot: 'Catapult', driver: 'Priya Raman', archetype: 'flipper', from: 2, country: 'IN',
    paint: { primary: '#ff7b00', secondary: '#2b2d42', pattern: 'bolt' }, taunt: 'What goes up, I decide where it comes down.' },
  { id: 'sawbones', team: 'Sawbones', bot: 'Grinder', driver: 'Dr. Ilse Krupp', archetype: 'saw', from: 2, country: 'DE',
    paint: { primary: '#7b2cbf', secondary: '#e0aaff', pattern: 'checker' }, taunt: 'This will only hurt the whole time.' },
  { id: 'vex', team: 'Vex Robotics', bot: 'Hexblade', driver: 'Nadia Vex', archetype: 'disc', from: 3, country: 'GB',
    paint: { primary: '#f72585', secondary: '#111111', pattern: 'flames' }, taunt: 'One hit. That is all I ever need.' },
  { id: 'valhalla', team: 'Valhalla Works', bot: 'Mjolnir', driver: 'Sigrid Hale', archetype: 'hammer', from: 3, country: 'NO',
    paint: { primary: '#adb5bd', secondary: '#1d3557', pattern: 'plain' }, taunt: 'The hammer falls on everyone eventually.' },
  { id: 'pinchbros', team: 'Pinch Brothers', bot: 'Jaws of Life', driver: 'Tony & Sal Pinch', archetype: 'crusher', from: 3, country: 'AU',
    paint: { primary: '#2d6a4f', secondary: '#b7e4c7', pattern: 'camo' }, taunt: 'We just want a hug. A very tight hug.' },
  { id: 'kaiju', team: 'Kaiju Labs', bot: 'Whirlwind', driver: 'Kenji Mori', archetype: 'ring', from: 4, country: 'JP',
    paint: { primary: '#d00000', secondary: '#ffffff', pattern: 'checker' }, taunt: 'There is no safe side of Whirlwind.' },
  { id: 'rhino', team: 'Rhino Racing', bot: 'Battering Rhino', driver: 'Lucia Ferro', archetype: 'rammer', from: 4, country: 'BR',
    paint: { primary: '#6c757d', secondary: '#e63946', pattern: 'stripes' }, taunt: 'Brakes are for people who plan to stop.' },
  { id: 'drvolt', team: 'Volt Industries', bot: 'Inferno', driver: 'Dr. Volt', archetype: 'firestarter', from: 4, country: 'FR',
    paint: { primary: '#9d0208', secondary: '#ffba08', pattern: 'flames' }, taunt: 'Your electronics are rated to what temperature, exactly?' },
  { id: 'forklift', team: 'Forklift Union', bot: 'Scoop', driver: 'Big Rosa', archetype: 'lifter', from: 2, country: 'MX',
    paint: { primary: '#ffb703', secondary: '#023047', pattern: 'hazard' }, taunt: 'Lift with the legs. Drop in the pit.' },
  { id: 'typhoon', team: 'Typhoon Tech', bot: 'Tornado', driver: 'Mei Lin', archetype: 'bar', from: 3, country: 'CN',
    paint: { primary: '#06d6a0', secondary: '#073b4c', pattern: 'bolt' }, taunt: 'Stand next to me. Go on.' },
];

const BOT_A = ['Rusty', 'Mega', 'Iron', 'Turbo', 'Steel', 'Scrap', 'Hyper', 'Atomic', 'Mad', 'Sonic', 'Volt', 'Grim', 'Lucky', 'Nitro', 'Brutal', 'Little', 'Big', 'Red', 'Black', 'Chrome', 'Dread', 'Rapid', 'Savage', 'Silent'];
const BOT_B = ['Hornet', 'Mauler', 'Badger', 'Wombat', 'Crab', 'Viper', 'Brick', 'Toaster', 'Hammerhead', 'Gnasher', 'Mantis', 'Cyclone', 'Rattler', 'Bison', 'Piranha', 'Goblin', 'Ripper', 'Tank', 'Wasp', 'Mule', 'Kraken', 'Lobster', 'Beetle', 'Grizzly'];
const BOT_SOLO = ['Kilobyte', 'Sparkplug', 'Overclock', 'Gearbox', 'Flywheel', 'Duct Tape', 'Chopper', 'Bolt Action', 'Short Circuit', 'Torque Wrench', 'Payload', 'Dropkick', 'Megahertz', 'Shrapnel', 'Wrecking Ball', 'Piston', 'Dynamo', 'Ratchet', 'Hacksaw', 'Lockjaw'];
const TEAM_A = ['Team', 'Garage', 'Bolt', 'Circuit', 'Steel', 'Spark', 'Rust', 'Iron', 'Torque', 'Flux', 'Chrome', 'Static'];
const TEAM_B = ['Brothers', 'Collective', 'Works', 'Racing', 'Labs', 'Society', 'Crew', 'Union', 'Engineering', 'Garage', 'Club', 'Squad'];
const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'SE', 'NO', 'PL', 'JP', 'CN', 'KR', 'IN', 'AU', 'NZ', 'BR', 'AR', 'MX', 'CA', 'ZA', 'EG', 'TR'];

export function botName(rng: Rng, taken: Set<string>): string {
  for (let i = 0; i < 40; i++) {
    const n = rng() < 0.4 ? pick(rng, BOT_SOLO) : `${pick(rng, BOT_A)} ${pick(rng, BOT_B)}`;
    if (!taken.has(n)) {
      taken.add(n);
      return n;
    }
  }
  return `Unit ${Math.floor(rng() * 900 + 100)}`;
}

export function teamName(rng: Rng): string {
  return `${pick(rng, TEAM_A)} ${pick(rng, TEAM_B)}`;
}

export const country = (rng: Rng) => pick(rng, COUNTRIES);

export function flag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
