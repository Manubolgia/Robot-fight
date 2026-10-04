// Running a tournament: the field of robots, knockout brackets and group
// tables, simulating every fight the player is not in, prize money and the
// sponsor deal.

import { arenaOf } from '../data/arenas.ts';
import { eventOf, type EventDef, type Format } from '../data/events.ts';
import type { BotDesign, Wear } from '../data/types.ts';
import { Driver, skillFor, type Skill } from '../sim/ai.ts';
import { hashString, mulberry32, pick, shuffle, type Rng } from '../sim/rng.ts';
import { computeStats, type Levels } from '../sim/stats.ts';
import { DT, World, freshWear, type FightResult } from '../sim/world.ts';
import { archetypeOf, archetypesFor, makeBuild, randomPaint } from './builds.ts';
import { mend, type Career } from './career.ts';
import { RIVALS, botName, country, teamName } from './names.ts';

export const PLAYER = 'player';

export interface Entrant {
  id: string;
  team: string;
  bot: BotDesign;
  skill: Skill;
  country: string;
  rival?: string;
  arch: string;
  /** rough strength, for seeding */
  rating: number;
  wear: Wear;
}

export interface Match {
  id: string;
  a: string;
  b: string;
  winner?: string;
  method?: FightResult['method'];
  time?: number;
  /** damage dealt by a and b */
  dmg?: [number, number];
  stage: string;
}

export interface Group {
  name: string;
  ids: string[];
  matches: Match[];
}

export interface Sponsor {
  id: string;
  name: string;
  goal: string;
  kind: 'ko' | 'flip' | 'bighit' | 'final' | 'fast' | 'decision' | 'win';
  amount: number;
}

export interface Tournament {
  event: string;
  season: number;
  seed: number;
  botId: string;
  entrants: Entrant[];
  groups: Group[] | null;
  day: number;
  rounds: Match[][];
  phase: 'groups' | 'knockout' | 'done';
  out: boolean;
  place: number | null;
  prizeIndex: number | null;
  earned: number;
  wins: number;
  sponsor: Sponsor | null;
  offers: Sponsor[];
  sponsorEarned: number;
  news: string[];
  /** the match the pit crew last patched up for */
  patched?: string;
}

const ROUND_NAMES: Record<number, string> = { 2: 'Final', 4: 'Semi-final', 8: 'Quarter-final', 16: 'Round of 16' };

// ---- the field ------------------------------------------------------------------

function pickArchetypes(rng: Rng, n: number, tier: number): string[] {
  const ids = archetypesFor(tier).map((a) => a.id);
  const out: string[] = [];
  while (out.length < n) out.push(...shuffle(rng, [...ids]));
  return out.slice(0, n);
}

/** Opponents are built from the parts of the event's tier; scrappier early on. */
function makeEntrant(rng: Rng, ev: EventDef, season: number, arch: string, taken: Set<string>, rival?: (typeof RIVALS)[number]): Entrant {
  const tier = ev.tier;
  const lowQ = [0, 0.35, 0.6, 0.78, 0.9, 1][tier];
  const quality = rival ? 1 : Math.min(1, lowQ + rng() * 0.25 + (season - 1) * 0.08);
  const partsTier = Math.min(5, tier + (season > 2 && rng() < 0.3 ? 1 : 0));
  const name = rival ? rival.bot : botName(rng, taken);
  const bot = makeBuild(archetypeOf(arch), partsTier, rng, { name, paint: rival ? rival.paint : randomPaint(rng), quality });
  const skill = skillFor(tier, season, !!rival);
  if (!rival) {
    const k = (rng() - 0.5) * 0.12;
    skill.aim = Math.max(0.3, Math.min(0.98, skill.aim + k));
    skill.reaction = Math.max(0.08, skill.reaction * (1 - k));
  }
  return {
    id: rival ? `rival-${rival.id}` : `ai-${Math.floor(rng() * 1e9).toString(36)}`,
    team: rival ? rival.team : teamName(rng),
    bot,
    skill,
    country: rival ? rival.country : country(rng),
    rival: rival?.id,
    arch,
    rating: quality * 10 + skill.aim * 5 + (rival ? 4 : 0) + rng(),
    wear: freshWear(),
  };
}

export function sponsorOffers(rng: Rng, ev: EventDef): Sponsor[] {
  const base = Math.max(150, Math.round((ev.prizes[0] * 0.06) / 50) * 50);
  const all: Sponsor[] = [
    { id: 'kokings', name: 'KO Kings Energy', goal: 'per knockout win', kind: 'ko', amount: base * 2 },
    { id: 'flipit', name: 'Flip-It Insurance', goal: 'per robot you throw', kind: 'flip', amount: Math.round(base * 0.6) },
    { id: 'voltcola', name: 'Volt Cola', goal: 'per big hit (40+)', kind: 'bighit', amount: Math.round(base * 0.35) },
    { id: 'steelmill', name: 'Steel Mill Co.', goal: 'for reaching the final', kind: 'final', amount: base * 5 },
    { id: 'lightning', name: 'Lightning Logistics', goal: 'per win inside 45 s', kind: 'fast', amount: Math.round(base * 2.4) },
    { id: 'rhinotyres', name: 'Rhino Tyres', goal: 'per win on the judges', kind: 'decision', amount: Math.round(base * 1.6) },
    { id: 'gridpower', name: 'GridPower', goal: 'per fight won', kind: 'win', amount: Math.round(base * 1.1) },
  ];
  return shuffle(rng, all).slice(0, 3);
}

export function createTournament(c: Career, eventId: string, botId: string, levels: Levels): Tournament {
  const ev = eventOf(eventId)!;
  const seed = hashString(`${eventId}-${c.season}-${c.records.tournaments}-${Date.now()}`);
  const rng = mulberry32(seed);
  const size = { bracket4: 4, bracket8: 8, bracket16: 16, groups8: 8, worldcup: 16 }[ev.format];
  const taken = new Set<string>(c.bots.map((b) => b.name));
  const player = c.bots.find((b) => b.id === botId)!;
  void levels;
  const entrants: Entrant[] = [
    {
      id: PLAYER,
      team: c.team,
      bot: player,
      skill: skillFor(ev.tier),
      country: c.country,
      arch: 'player',
      rating: 5,
      wear: c.wear[botId] ?? freshWear(),
    },
  ];
  // rivals of this tier and below join, a few at a time
  const rivals = shuffle(rng, RIVALS.filter((r) => r.from <= ev.tier));
  const nRivals = Math.min(rivals.length, ev.tier === 5 ? 8 : Math.max(1, Math.floor(size / 4)));
  for (const r of rivals.slice(0, nRivals)) entrants.push(makeEntrant(rng, ev, c.season, r.archetype, taken, r));
  const archs = pickArchetypes(rng, size, ev.tier);
  let k = 0;
  while (entrants.length < size) entrants.push(makeEntrant(rng, ev, c.season, archs[k++], taken));

  const t: Tournament = {
    event: eventId,
    season: c.season,
    seed,
    botId,
    entrants,
    groups: null,
    day: 0,
    rounds: [],
    phase: 'knockout',
    out: false,
    place: null,
    prizeIndex: null,
    earned: 0,
    wins: 0,
    sponsor: null,
    offers: sponsorOffers(rng, ev),
    sponsorEarned: 0,
    news: [],
  };

  // seeding: strongest apart; the player sits as a middle seed
  const seeded = [...entrants].sort((a, b) => b.rating - a.rating);
  if (ev.format === 'groups8' || ev.format === 'worldcup') {
    const n = ev.format === 'groups8' ? 2 : 4;
    const groups: Group[] = Array.from({ length: n }, (_, i) => ({ name: 'ABCD'[i], ids: [], matches: [] }));
    seeded.forEach((e, i) => {
      const pot = Math.floor(i / n);
      const g = pot % 2 === 0 ? i % n : n - 1 - (i % n);
      groups[g].ids.push(e.id);
    });
    for (const g of groups) {
      const [a, b, cc, d] = g.ids;
      const days = [
        [[a, b], [cc, d]],
        [[a, cc], [b, d]],
        [[a, d], [b, cc]],
      ];
      days.forEach((pairs, day) => {
        for (const [x, y] of pairs) g.matches.push({ id: `${g.name}${day}${x}${y}`, a: x, b: y, stage: `Group ${g.name} · Day ${day + 1}` });
      });
    }
    t.groups = groups;
    t.phase = 'groups';
  } else {
    t.rounds = [firstRound(seeded.map((e) => e.id), size)];
  }
  return t;
}

function firstRound(ids: string[], size: number): Match[] {
  // standard seeding order: 1v16, 8v9, 5v12, 4v13, ...
  const order = seedOrder(size);
  const slots = order.map((s) => ids[s - 1]);
  const ms: Match[] = [];
  for (let i = 0; i < size; i += 2) ms.push({ id: `r0m${i / 2}`, a: slots[i], b: slots[i + 1], stage: ROUND_NAMES[size] ?? `Round of ${size}` });
  return ms;
}

function seedOrder(n: number): number[] {
  let order = [1, 2];
  while (order.length < n) {
    const m = order.length * 2 + 1;
    order = order.flatMap((s) => [s, m - s]);
  }
  return order;
}

// ---- progress -----------------------------------------------------------------------

export const entrant = (t: Tournament, id: string) => t.entrants.find((e) => e.id === id)!;

/** The player's next fight, if they are still in it. */
export function nextPlayerMatch(t: Tournament): Match | null {
  if (t.phase === 'done' || t.out) return null;
  if (t.phase === 'groups' && t.groups) {
    for (const g of t.groups) {
      const m = g.matches.find((x) => !x.winner && (x.a === PLAYER || x.b === PLAYER) && x.stage.endsWith(`Day ${t.day + 1}`));
      if (m) return m;
    }
    return null;
  }
  const round = t.rounds[t.rounds.length - 1];
  return round?.find((m) => !m.winner && (m.a === PLAYER || m.b === PLAYER)) ?? null;
}

export function currentStageName(t: Tournament): string {
  if (t.phase === 'groups') return `Group stage · Day ${t.day + 1} of 3`;
  const round = t.rounds[t.rounds.length - 1];
  return round?.[0]?.stage ?? '';
}

export function standings(t: Tournament, g: Group) {
  const rows = g.ids.map((id) => ({ id, w: 0, l: 0, pts: 0, dmg: 0, played: 0 }));
  const row = (id: string) => rows.find((r) => r.id === id)!;
  for (const m of g.matches) {
    if (!m.winner) continue;
    const loser = m.winner === m.a ? m.b : m.a;
    row(m.winner).w++;
    row(m.winner).pts += 3;
    row(loser).l++;
    row(m.a).played++;
    row(m.b).played++;
    if (m.dmg) {
      row(m.a).dmg += m.dmg[0];
      row(m.b).dmg += m.dmg[1];
    }
  }
  return rows.sort((a, b) => b.pts - a.pts || b.dmg - a.dmg);
}

/** Simulate a fight between two computer teams, headless. */
export function simulate(a: Entrant, b: Entrant, arenaId: string, seed: number): FightResult {
  const w = new World(computeStats(a.bot), computeStats(b.bot), arenaOf(arenaId), { seed, wear: [a.wear, b.wear] });
  w.quiet = true;
  const da = new Driver(w, 0, a.skill, seed);
  const db = new Driver(w, 1, b.skill, seed + 3);
  let n = 0;
  while (!w.over && n < 14000) {
    da.update(DT);
    db.update(DT);
    w.step();
    n++;
  }
  return w.result!;
}

function applyResult(t: Tournament, m: Match, r: FightResult) {
  m.winner = r.winner === 0 ? m.a : r.winner === 1 ? m.b : r.stats[0].dmgDealt >= r.stats[1].dmgDealt ? m.a : m.b;
  m.method = r.method;
  m.time = r.time;
  m.dmg = [r.stats[0].dmgDealt, r.stats[1].dmgDealt];
  const ea = entrant(t, m.a);
  const eb = entrant(t, m.b);
  // computer teams patch up between fights
  if (ea.id !== PLAYER) ea.wear = mend(r.wear[0], 0.75);
  if (eb.id !== PLAYER) eb.wear = mend(r.wear[1], 0.75);
}

function describe(t: Tournament, m: Match): string {
  const w = entrant(t, m.winner!);
  const l = entrant(t, m.winner === m.a ? m.b : m.a);
  const how = m.method === 'decision' ? 'on the judges' : m.method === 'pit' ? 'into the pit' : m.method === 'countout' ? 'by count-out' : m.method === 'forfeit' ? 'by forfeit' : `by KO in ${Math.round(m.time ?? 0)}s`;
  return `${w.bot.name} beat ${l.bot.name} ${how}`;
}

/**
 * Record the player's fight, simulate the rest of that round or match day,
 * and move the tournament on. Returns what happened to the player.
 */
export function recordPlayerFight(t: Tournament, r: FightResult): { won: boolean; out: boolean; done: boolean } {
  const ev = eventOf(t.event)!;
  const m = nextPlayerMatch(t);
  if (!m) return { won: false, out: t.out, done: t.phase === 'done' };
  // the player is always side 0 of the fight screen
  const playerIsA = m.a === PLAYER;
  const fixed: FightResult = playerIsA
    ? r
    : { ...r, winner: r.winner === null ? null : 1 - r.winner, stats: [r.stats[1], r.stats[0]], wear: [r.wear[1], r.wear[0]] };
  applyResult(t, m, fixed);
  const won = m.winner === PLAYER;
  if (won) t.wins++;
  t.news = [];
  const rng = mulberry32(t.seed + t.day * 97 + t.rounds.length * 13);
  if (t.phase === 'groups' && t.groups) {
    for (const g of t.groups) {
      for (const x of g.matches) {
        if (!x.winner && x.stage.endsWith(`Day ${t.day + 1}`)) {
          applyResult(t, x, simulate(entrant(t, x.a), entrant(t, x.b), ev.arena, Math.floor(rng() * 1e9)));
          t.news.push(describe(t, x));
        }
      }
    }
    t.day++;
    if (t.day >= 3) advanceFromGroups(t);
  } else {
    const round = t.rounds[t.rounds.length - 1];
    for (const x of round) {
      if (!x.winner) {
        applyResult(t, x, simulate(entrant(t, x.a), entrant(t, x.b), ev.arena, Math.floor(rng() * 1e9)));
        t.news.push(describe(t, x));
      }
    }
    if (!won) {
      t.out = true;
      finish(t, round.length);
    } else if (round.length === 1) {
      finish(t, 0);
    } else {
      nextRound(t);
    }
  }
  return { won, out: t.out, done: t.phase === 'done' };
}

function nextRound(t: Tournament) {
  const round = t.rounds[t.rounds.length - 1];
  const ms: Match[] = [];
  for (let i = 0; i < round.length; i += 2) {
    ms.push({ id: `r${t.rounds.length}m${i / 2}`, a: round[i].winner!, b: round[i + 1].winner!, stage: ROUND_NAMES[round.length] ?? 'Round' });
  }
  t.rounds.push(ms);
}

function advanceFromGroups(t: Tournament) {
  const gs = t.groups!;
  const tables = gs.map((g) => standings(t, g));
  const playerThrough = tables.some((rows) => rows.slice(0, 2).some((r) => r.id === PLAYER));
  const top = (gi: number, k: number) => tables[gi][k].id;
  let ms: Match[];
  if (gs.length === 2) {
    ms = [
      { id: 'k0', a: top(0, 0), b: top(1, 1), stage: 'Semi-final' },
      { id: 'k1', a: top(1, 0), b: top(0, 1), stage: 'Semi-final' },
    ];
  } else {
    ms = [
      { id: 'k0', a: top(0, 0), b: top(1, 1), stage: 'Quarter-final' },
      { id: 'k1', a: top(2, 0), b: top(3, 1), stage: 'Quarter-final' },
      { id: 'k2', a: top(1, 0), b: top(0, 1), stage: 'Quarter-final' },
      { id: 'k3', a: top(3, 0), b: top(2, 1), stage: 'Quarter-final' },
    ];
  }
  t.phase = 'knockout';
  t.rounds = [ms];
  if (!playerThrough) {
    t.out = true;
    finish(t, gs.length === 2 ? 4 : 8, true);
  }
}

/** Places: 0 = champion. `lostIn` is the size of the round the player went out in. */
function finish(t: Tournament, lostIn: number, groupStage = false) {
  const ev = eventOf(t.event)!;
  // let the rest of the event play out for the record
  const rng = mulberry32(t.seed + 4242);
  if (t.out) {
    while (t.phase !== 'done') {
      const round = t.rounds[t.rounds.length - 1];
      if (!round) break;
      for (const x of round) if (!x.winner) applyResult(t, x, simulate(entrant(t, x.a), entrant(t, x.b), ev.arena, Math.floor(rng() * 1e9)));
      if (round.length === 1) break;
      nextRound(t);
    }
  }
  t.phase = 'done';
  let idx: number;
  let place: number;
  if (lostIn === 0) {
    idx = 0;
    place = 1;
  } else if (groupStage) {
    idx = ev.prizes.length - 1;
    place = lostIn + 1;
  } else {
    const roundIdx = lostIn === 1 ? 1 : lostIn === 2 ? 2 : lostIn === 4 ? 3 : 4;
    idx = Math.min(ev.prizes.length - 1, roundIdx);
    place = lostIn === 1 ? 2 : lostIn + 1;
  }
  t.prizeIndex = idx;
  t.place = place;
}

/** Prize money grows 15% with every season after the first. */
export const seasonScale = (season: number) => 1 + (Math.max(1, season) - 1) * 0.15;

export function prizeFor(t: Tournament): number {
  const ev = eventOf(t.event)!;
  if (t.prizeIndex === null) return 0;
  return Math.round(((ev.prizes[t.prizeIndex] ?? 0) * seasonScale(t.season)) / 50) * 50;
}

export const formatOf = (t: Tournament): Format => eventOf(t.event)!.format;

export function champion(t: Tournament): Entrant | null {
  const last = t.rounds[t.rounds.length - 1];
  if (t.phase !== 'done' || !last || last.length !== 1 || !last[0].winner) return null;
  return entrant(t, last[0].winner);
}

export function opponentOf(t: Tournament, m: Match): Entrant {
  return entrant(t, m.a === PLAYER ? m.b : m.a);
}

/** Pick a random computer opponent for an exhibition fight. */
export function exhibitionOpponent(tier: number, season: number, archId?: string): Entrant {
  const rng = mulberry32(Math.floor(Math.random() * 1e9));
  const ev = { tier, prizes: [0] } as unknown as EventDef;
  const arch = archId ?? pick(rng, archetypesFor(tier)).id;
  return makeEntrant(rng, ev, season, arch, new Set());
}

/** Give up every remaining fight. */
export function withdraw(t: Tournament) {
  let guard = 0;
  while (nextPlayerMatch(t) && guard++ < 12) {
    recordPlayerFight(t, {
      winner: 1,
      method: 'forfeit',
      time: 0,
      stats: [0, 1].map(() => ({ dmgDealt: 0, dmgTaken: 0, hits: 0, bigHits: 0, flips: 0, aggression: 0, control: 0, biggestHit: 0 })),
      wear: [freshWear(), freshWear()],
    });
  }
}

/** All the rounds of a knockout, with empty slots for the rounds to come. */
export function bracketView(t: Tournament): Array<{ name: string; matches: Array<Match | null> }> {
  const ev = eventOf(t.event)!;
  const firstSize = ev.format === 'groups8' ? 4 : ev.format === 'worldcup' ? 8 : { bracket4: 4, bracket8: 8, bracket16: 16 }[ev.format as 'bracket4'];
  const out: Array<{ name: string; matches: Array<Match | null> }> = [];
  if (t.phase === 'groups') {
    for (let n = firstSize; n >= 2; n /= 2) out.push({ name: ROUND_NAMES[n] ?? `Round of ${n}`, matches: Array.from({ length: n / 2 }, () => null) });
    return out;
  }
  let n = firstSize;
  let i = 0;
  while (n >= 2) {
    const round = t.rounds[i];
    out.push({ name: ROUND_NAMES[n] ?? `Round of ${n}`, matches: round ? round : Array.from({ length: n / 2 }, () => null) });
    n /= 2;
    i++;
  }
  return out;
}
