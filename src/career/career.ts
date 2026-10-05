// The team: money, fame, licences, the parts you own and their upgrade
// levels, your robots and the damage they carry, trophies and records.
// Saved to localStorage after every change.

import { ALL_PARTS, MAX_LEVEL, part, upgradeCost } from '../data/parts.ts';
import { DEFAULT_PLAN, type BotDesign, type PartDef, type Wear } from '../data/types.ts';
import { tierOf } from '../data/events.ts';
import { autoPower, type Levels } from '../sim/stats.ts';
import { freshWear } from '../sim/world.ts';
import type { Tournament } from './tournament.ts';

export const SAVE_KEY = 'kilowatt.career.v1';
export const MAX_BOTS = 4;
export const CREW_PCT = [0, 0.4, 0.55, 0.7, 0.85, 1];
export const CREW_COST = [0, 0, 1500, 6000, 16000, 40000];

export interface Trophy {
  event: string;
  name: string;
  tier: number;
  season: number;
  bot: string;
  at: number;
}

export interface HistoryEntry {
  event: string;
  name: string;
  season: number;
  place: number;
  earned: number;
  bot: string;
}

export interface Records {
  fights: number;
  wins: number;
  kos: number;
  flips: number;
  pits: number;
  damage: number;
  biggestHit: number;
  fastestKO: number;
  tournaments: number;
  titles: number;
}

export interface Career {
  v: 1;
  team: string;
  country: string;
  money: number;
  fame: number;
  season: number;
  tier: number;
  champion: number;
  owned: Record<string, number>;
  bots: BotDesign[];
  active: string;
  wear: Record<string, Wear>;
  crew: number;
  tournament: Tournament | null;
  trophies: Trophy[];
  history: HistoryEntry[];
  records: Records;
  rivals: Record<string, { w: number; l: number }>;
  best: Record<number, number>;
  seen: string[];
  created: number;
}

export interface Kit {
  id: string;
  name: string;
  blurb: string;
  parts: string[];
  design: Omit<BotDesign, 'id' | 'name' | 'paint' | 'power'>;
}

const BASE = ['ch_scrapbox', 'dr_twin', 'co_lead', 'ar_alu', 'br_relay'];

export const KITS: Kit[] = [
  {
    id: 'spinner', name: 'Spinner', blurb: 'A toothed drum on a flat frame that fights either way up. Hits hard and pops robots into the air.',
    parts: [...BASE, 'ch_pancake', 'wp_drum'],
    design: { chassis: 'ch_pancake', drive: 'dr_twin', core: 'co_lead', front: 'wp_drum', top: null, armor: { material: 'ar_alu', front: 5, sides: 5, rear: 5, top: 4 }, modules: [], brain: 'br_relay', plan: { stance: 'aggressive', approach: 'direct', hazards: false } },
  },
  {
    id: 'control', name: 'Control', blurb: 'A wedge frame with a spring flipper. Get under them and throw them over.',
    parts: [...BASE, 'ch_ramprat', 'wp_springflip'],
    design: { chassis: 'ch_ramprat', drive: 'dr_twin', core: 'co_lead', front: 'wp_springflip', top: null, armor: { material: 'ar_alu', front: 5, sides: 5, rear: 5, top: 5 }, modules: [], brain: 'br_relay', plan: { stance: 'aggressive', approach: 'flank', hazards: true } },
  },
  {
    id: 'brawler', name: 'Brawler', blurb: 'A plow to pin them and a sledgehammer to finish them off.',
    parts: [...BASE, 'wp_plow', 'wp_sledge'],
    design: { chassis: 'ch_scrapbox', drive: 'dr_twin', core: 'co_lead', front: 'wp_plow', top: 'wp_sledge', armor: { material: 'ar_alu', front: 5, sides: 4, rear: 2, top: 2 }, modules: [], brain: 'br_relay', plan: { stance: 'balanced', approach: 'direct', hazards: true } },
  },
];

export function newId(prefix = 'bot'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function newCareer(team: string, kitId: string, botName: string, paint: BotDesign['paint']): Career {
  const kit = KITS.find((k) => k.id === kitId) ?? KITS[0];
  const owned: Record<string, number> = {};
  for (const p of kit.parts) owned[p] = 1;
  const bot: BotDesign = { ...structuredClone(kit.design), id: newId(), name: botName || 'Rookie', paint, power: { drive: 1, front: 1, top: 1, aux: 1, brain: 1 } };
  bot.power = autoPower(bot);
  return {
    v: 1,
    team: team || 'Garage Team',
    country: 'US',
    money: 1000,
    fame: 0,
    season: 1,
    tier: 1,
    champion: 0,
    owned,
    bots: [bot],
    active: bot.id,
    wear: {},
    crew: 1,
    tournament: null,
    trophies: [],
    history: [],
    records: { fights: 0, wins: 0, kos: 0, flips: 0, pits: 0, damage: 0, biggestHit: 0, fastestKO: 0, tournaments: 0, titles: 0 },
    rivals: {},
    best: {},
    seen: [],
    created: Date.now(),
  };
}

// ---- saving ------------------------------------------------------------------

export function saveCareer(c: Career | null) {
  try {
    if (c) localStorage.setItem(SAVE_KEY, JSON.stringify(c));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    // private mode or full storage: the game carries on unsaved
  }
}

export function loadCareer(): Career | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Career;
    if (!c || c.v !== 1 || !Array.isArray(c.bots)) return null;
    // drop anything that no longer exists in the catalogue
    for (const id of Object.keys(c.owned)) if (!ALL_PARTS.some((p) => p.id === id)) delete c.owned[id];
    // robots from before brains: the starter board and a balanced plan
    c.owned.br_relay ??= 1;
    const designs = [...c.bots, ...(c.tournament?.entrants.map((e) => e.bot) ?? [])];
    for (const d of designs) upgradeDesign(d);
    c.seen ??= [];
    c.best ??= {};
    c.rivals ??= {};
    return c;
  } catch {
    return null;
  }
}

/** Bring a saved design up to date with the current shape of a robot. */
export function upgradeDesign(d: BotDesign) {
  if (!d.brain || !ALL_PARTS.some((p) => p.id === d.brain)) d.brain = 'br_relay';
  d.plan = { ...DEFAULT_PLAN, ...(d.plan ?? {}) };
  d.power.brain ??= 1;
}

// ---- parts -------------------------------------------------------------------

export const owns = (c: Career, id: string | null | undefined) => !!id && (c.owned[id] ?? 0) > 0;
export const levelOf = (c: Career, id: string) => c.owned[id] ?? 1;
export const levels = (c: Career): Levels => (id: string) => c.owned[id] ?? 1;
export const upgradeCap = (c: Career) => Math.min(MAX_LEVEL, c.tier + 1);
export const canBuy = (c: Career, p: PartDef) => p.tier <= c.tier && !owns(c, p.id) && c.money >= p.price;

export function buy(c: Career, id: string): boolean {
  const p = part(id);
  if (!canBuy(c, p)) return false;
  c.money -= p.price;
  c.owned[id] = 1;
  return true;
}

export function upgrade(c: Career, id: string): boolean {
  const lvl = levelOf(c, id);
  if (!owns(c, id) || lvl >= upgradeCap(c)) return false;
  const cost = upgradeCost(part(id), lvl + 1);
  if (c.money < cost) return false;
  c.money -= cost;
  c.owned[id] = lvl + 1;
  return true;
}

export function crewUpgrade(c: Career): boolean {
  if (c.crew >= 5) return false;
  const cost = CREW_COST[c.crew + 1];
  if (c.money < cost) return false;
  c.money -= cost;
  c.crew++;
  return true;
}

// ---- damage and repairs ------------------------------------------------------

export function botValue(d: BotDesign): number {
  const ids = [d.chassis, d.drive, d.core, d.front, d.top, d.armor.material, ...d.modules].filter((x): x is string => !!x);
  return ids.reduce((s, id) => s + Math.max(250, part(id).price), 0);
}

/** 0 (pristine) .. 1 (wrecked) */
export function damageOf(w: Wear | undefined): number {
  if (!w) return 0;
  const armor = (w.armor.front + w.armor.left + w.armor.right + w.armor.rear + w.armor.top) / 5;
  const comp = (w.comp.drive + w.comp.front + w.comp.top + w.comp.core) / 4;
  return 1 - (w.hp * 0.55 + armor * 0.2 + comp * 0.25);
}

export function repairCost(c: Career, botId: string): number {
  const bot = c.bots.find((b) => b.id === botId);
  const w = c.wear[botId];
  if (!bot || !w) return 0;
  return Math.round((damageOf(w) * botValue(bot) * 0.35) / 10) * 10 + (damageOf(w) > 0.001 ? 40 : 0);
}

/** Restore a share of everything that is missing. */
export function mend(w: Wear, share: number): Wear {
  const f = (v: number) => Math.min(1, v + (1 - v) * share);
  return {
    hp: f(w.hp),
    armor: { front: f(w.armor.front), left: f(w.armor.left), right: f(w.armor.right), rear: f(w.armor.rear), top: f(w.armor.top) },
    comp: { drive: f(w.comp.drive), front: f(w.comp.front), top: f(w.comp.top), core: f(w.comp.core) },
    shield: f(w.shield),
  };
}

export function crewPatch(c: Career, botId: string) {
  const w = c.wear[botId];
  if (w) c.wear[botId] = mend(w, CREW_PCT[c.crew]);
}

export function fullRepair(c: Career, botId: string): boolean {
  const cost = repairCost(c, botId);
  if (c.money < cost) return false;
  c.money -= cost;
  delete c.wear[botId];
  return true;
}

export const wearOf = (c: Career, botId: string): Wear => c.wear[botId] ?? freshWear();

// ---- garage ------------------------------------------------------------------

export function activeBot(c: Career): BotDesign {
  return c.bots.find((b) => b.id === c.active) ?? c.bots[0];
}

export function addBot(c: Career, from?: BotDesign): BotDesign | null {
  if (c.bots.length >= MAX_BOTS) return null;
  const base = from ?? c.bots[0];
  const b: BotDesign = { ...structuredClone(base), id: newId(), name: from ? `${from.name} II` : 'New Robot' };
  c.bots.push(b);
  return b;
}

export function removeBot(c: Career, id: string) {
  if (c.bots.length <= 1 || c.tournament?.botId === id) return;
  c.bots = c.bots.filter((b) => b.id !== id);
  delete c.wear[id];
  if (c.active === id) c.active = c.bots[0].id;
}

// ---- licences and fame ---------------------------------------------------------

/** Called when a tournament ends: records, trophies, the next licence. */
export function closeTournament(c: Career, eventId: string, name: string, tier: number, place: number, earned: number, botName: string): { newTier: boolean; champion: boolean } {
  c.records.tournaments++;
  c.history.unshift({ event: eventId, name, season: c.season, place, earned, bot: botName });
  c.history = c.history.slice(0, 40);
  c.best[tier] = Math.min(c.best[tier] ?? 99, place);
  let newTier = false;
  let champion = false;
  if (place === 1) {
    c.records.titles++;
    c.trophies.push({ event: eventId, name, tier, season: c.season, bot: botName, at: Date.now() });
  }
  const td = tierOf(tier);
  if (tier === c.tier && tier < 5 && place <= td.needPlace) {
    c.tier++;
    newTier = true;
  }
  if (tier === 5 && place === 1) {
    champion = true;
    c.champion++;
    c.season++;
  }
  c.wear = {};
  return { newTier, champion };
}

/** A world ranking out of 200 from fame. */
export function worldRank(fame: number): number {
  return Math.max(1, Math.round(200 - 199 * Math.min(1, Math.pow(fame / 4200, 0.55))));
}
