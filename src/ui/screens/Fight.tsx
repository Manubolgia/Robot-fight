import { useEffect, useRef, useState } from 'preact/hooks';
import { levels, type Career } from '../../career/career.ts';
import { RIVALS, flag } from '../../career/names.ts';
import { PLAYER, entrant, nextPlayerMatch, recordPlayerFight, type Entrant } from '../../career/tournament.ts';
import { arenaOf } from '../../data/arenas.ts';
import { eventOf } from '../../data/events.ts';
import type { BotDesign, Wear } from '../../data/types.ts';
import { Driver, PILOT_SKILL } from '../../sim/ai.ts';
import { ManualDriver } from '../../sim/manual.ts';
import { computeStats, LEVEL_ONE } from '../../sim/stats.ts';
import { DT, World, type Bot, type FightResult, type SimEvent } from '../../sim/world.ts';
import { sfx } from '../../audio/sfx.ts';
import { canvasSize, getRenderer, mount, unmount } from '../../render/gfx.ts';
import { FightView, snap, type Snap } from '../../render/fightView.ts';
import { clearFrame, setFrame } from '../../render/loop.ts';
import { BotThumb, Btn } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { app, buzz, go, update, useApp } from '../store.ts';

export interface FightSetup {
  mode: 'career' | 'quick';
  me: BotDesign;
  op: Entrant;
  arena: string;
  levels: (id: string) => number;
  title: string;
  wear?: Wear;
}

export interface FightOutcome {
  mode: 'career' | 'quick';
  result: FightResult;
  me: BotDesign;
  op: Entrant;
  arena: string;
  title: string;
  payouts: Array<[string, number]>;
  fame: number;
}

/** Build the fight from the career's next match, or from a quick-fight setup. */
function setupFight(): FightSetup | null {
  const c = app.career;
  if (app.params.mode === 'quick') return app.params.setup as FightSetup;
  if (!c || !c.tournament) return null;
  const t = c.tournament;
  const m = nextPlayerMatch(t);
  if (!m) return null;
  const op = entrant(t, m.a === PLAYER ? m.b : m.a);
  const me = c.bots.find((b) => b.id === t.botId)!;
  const ev = eventOf(t.event)!;
  return { mode: 'career', me, op, arena: ev.arena, levels: levels(c), title: `${ev.name} · ${m.stage}`, wear: c.wear[me.id] };
}

interface HudBot {
  name: string;
  hp: number;
  armor: number[];
  weapon: string;
  hot: boolean;
  burning: boolean;
  down: string[];
  count: number;
}

interface Hud {
  t: number;
  bots: HudBot[];
  heat: number;
  ready: boolean;
  topReady: boolean;
  boost: number;
  spin: number;
}

type Phase = 'intro' | 'fight' | 'ending' | 'judges';

const FEED_MAX = 3;

/** Test hook: localStorage kilowatt.devSpeed speeds fights up for automated runs. */
const DEV_SPEED = (() => {
  try {
    return Math.max(1, Math.min(20, Number(localStorage.getItem('kilowatt.devSpeed')) || 1));
  } catch {
    return 1;
  }
})();

export function Fight() {
  useApp();
  const setup = useRef<FightSetup | null>(null);
  if (!setup.current) setup.current = setupFight();
  const host = useRef<HTMLDivElement>(null);
  const hudHost = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [countdown, setCountdown] = useState<string | null>(null);
  const [feed, setFeed] = useState<Array<{ id: number; text: string; color?: string }>>([]);
  const [banner, setBanner] = useState<{ text: string; sub?: string; cls?: string } | null>(null);
  const [count, setCount] = useState<{ bot: number; n: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [auto, setAuto] = useState(false);
  const [judges, setJudges] = useState<FightResult | null>(null);
  const [joy, setJoy] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);
  const [pressed, setPressed] = useState({ fire: false, top: false, boost: false });
  const ctl = useRef({ sx: 0, sy: 0, fire: false, top: false, boost: false, boostT: 0, keys: new Set<string>() });
  const state = useRef<{
    world: World;
    view: FightView;
    pilot: Driver;
    ai: Driver;
    manual: ManualDriver;
    prev: Snap[];
    cur: Snap[];
    acc: number;
    hitstop: number;
    slow: number;
    phase: Phase;
    phaseT: number;
    hudT: number;
    lagHp: number[];
    feedId: number;
    endT: number;
    done: boolean;
    paused: boolean;
    auto: boolean;
    lastCount: number[];
  } | null>(null);
  const settings = app.settings;

  useEffect(() => {
    const s = setup.current;
    if (!s) {
      queueMicrotask(() => go(app.career ? 'hub' : 'title'));
      return;
    }
    const el = host.current!;
    const statsA = computeStats(s.me, s.levels);
    const statsB = computeStats(s.op.bot, LEVEL_ONE);
    const seed = Math.floor(Math.random() * 1e9);
    const world = new World(statsA, statsB, arenaOf(s.arena), { seed, wear: [s.wear, s.op.wear] });
    const view = new FightView(world, [s.me, s.op.bot]);
    const r = mount(el, () => {
      const z = canvasSize();
      view.setSize(z.w, z.h, getRenderer().getPixelRatio());
    });
    const z = canvasSize();
    view.setSize(z.w, z.h, r.getPixelRatio());
    view.setMode('intro');
    const st = {
      world,
      view,
      pilot: new Driver(world, 0, PILOT_SKILL, seed + 11),
      ai: new Driver(world, 1, s.op.skill, seed + 3),
      manual: new ManualDriver(),
      prev: world.bots.map(snap),
      cur: world.bots.map(snap),
      acc: 0,
      hitstop: 0,
      slow: 1,
      phase: 'intro' as Phase,
      phaseT: 0,
      hudT: 0,
      lagHp: [1, 1],
      feedId: 0,
      endT: 0,
      done: false,
      paused: false,
      auto: false,
      lastCount: [0, 0],
    };
    state.current = st;
    sfx.startFight();
    sfx.cheer(0.4);

    const frame = (dt: number) => tick(dt);
    setFrame(frame);
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const down = e.type === 'keydown';
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'e', 'shift'].includes(k)) e.preventDefault();
      if (down) ctl.current.keys.add(k);
      else ctl.current.keys.delete(k);
      if (k === ' ') ctl.current.fire = down;
      if (k === 'e') ctl.current.top = down;
      if (k === 'shift' && down) {
        ctl.current.boost = true;
        ctl.current.boostT = 0.25;
      }
      if (k === 'escape' && down) togglePause();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    const onHide = () => {
      if (document.hidden && st.phase === 'fight') {
        st.paused = true;
        setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearFrame(frame);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      document.removeEventListener('visibilitychange', onHide);
      sfx.stopFight();
      unmount(el);
      view.dispose();
    };
  }, []);

  function togglePause() {
    const st = state.current;
    if (!st || st.phase !== 'fight') return;
    st.paused = !st.paused;
    setPaused(st.paused);
  }

  function pushFeed(text: string, color?: string) {
    const st = state.current!;
    const id = ++st.feedId;
    setFeed((f) => [...f.slice(-(FEED_MAX - 1)), { id, text, color }]);
    setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), 2300);
  }

  function damageNumber(x: number, y: number, z: number, dmg: number, toPlayer: boolean) {
    const st = state.current!;
    if (!app.settings.numbers || !hudHost.current) return;
    const w = hudHost.current.clientWidth;
    const h = hudHost.current.clientHeight;
    const p = st.view.toScreen(x, y, z + 0.3, w, h);
    if (!p.visible) return;
    const el = document.createElement('div');
    el.className = `dmg-num ${dmg >= 150 ? 'huge' : dmg >= 70 ? 'big' : ''} ${toPlayer ? 'you' : ''}`;
    el.textContent = String(Math.round(dmg));
    el.style.left = `${p.x + (Math.random() - 0.5) * 20}px`;
    el.style.top = `${p.y}px`;
    hudHost.current.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  function handleEvents(events: SimEvent[]) {
    const st = state.current!;
    const w = st.world;
    const name = (i: number) => w.bots[i].s.name.toUpperCase();
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const power = e.dmg / 110;
          sfx.hit(power, e.kind === 'axe' || e.kind === 'crusher' ? 'pierce' : 'kinetic');
          if (e.dmg >= 8) damageNumber(e.x, e.y, e.z, e.dmg, e.to === 0);
          if (e.big) {
            st.hitstop = Math.max(st.hitstop, Math.min(0.12, 0.05 + e.dmg / 3500));
            buzz(e.dmg > 150 ? 40 : 20);
            sfx.cheer(Math.min(1, e.dmg / 200));
            if (e.dmg >= 180) pushFeed('MASSIVE HIT!', 'var(--orange)');
            else if (e.dmg >= 100) pushFeed('BIG HIT!', 'var(--gold)');
            if (e.kind === 'hazard') pushFeed('HAZARD!', 'var(--orange)');
          }
          break;
        }
        case 'clash':
          sfx.clash();
          st.hitstop = 0.1;
          buzz(40);
          pushFeed('WEAPON CLASH!', 'var(--cyan)');
          break;
        case 'flip':
          if (e.height > 0.6) pushFeed(e.height > 1.5 ? 'SENT FLYING!' : 'AIRBORNE!', 'var(--gold)');
          sfx.cheer(0.7);
          break;
        case 'land':
          sfx.land(e.impact);
          if (e.inverted && !w.bots[e.bot].s.invertible) pushFeed(`${name(e.bot)} IS ON ITS BACK!`, 'var(--red)');
          break;
        case 'fire':
          if (e.weapon === 'flipper' || e.weapon === 'lifter') sfx.pneumatic();
          else if (e.weapon === 'hammer' || e.weapon === 'axe') sfx.whoosh();
          else if (e.weapon === 'crusher') sfx.pneumatic();
          break;
        case 'grab':
          pushFeed(`${name(e.by)} HAS GOT HOLD!`);
          break;
        case 'selfright':
          pushFeed(`${name(e.bot)} IS BACK UP!`, 'var(--green)');
          break;
        case 'pitopen':
          pushFeed('THE PIT IS OPEN!', 'var(--red)');
          sfx.buzzer();
          break;
        case 'pitfall':
          sfx.pitDrop();
          pushFeed('INTO THE PIT!', 'var(--red)');
          break;
        case 'overheat':
          pushFeed(`${name(e.bot)} OVERHEATING!`, 'var(--orange)');
          break;
        case 'ablaze':
          pushFeed(`${name(e.bot)} IS ON FIRE!`, 'var(--orange)');
          break;
        case 'compdown':
          pushFeed(`${name(e.bot)}: ${e.comp === 'drive' ? 'DRIVE' : e.comp === 'core' ? 'POWER' : 'WEAPON'} DOWN!`, 'var(--red)');
          sfx.sparks(1.4);
          break;
        case 'armorbreak':
          if (e.zone !== 'top') pushFeed('ARMOUR OFF!');
          break;
        case 'count':
          setCount({ bot: e.bot, n: e.n });
          sfx.beep(e.n <= 1);
          break;
        case 'hazard':
          if (e.kind === 'hammer') {
            sfx.hammerHazard();
            st.hitstop = 0.08;
            pushFeed('HAMMER TIME!', 'var(--orange)');
          } else if (e.kind === 'saw') sfx.grind();
          else if (e.kind === 'spikes') sfx.hit(0.5, 'pierce');
          break;
        case 'boost':
          if (e.bot === 0) sfx.boost();
          break;
        case 'ko':
          sfx.ko();
          buzz(80);
          break;
        case 'sparks':
          if (e.hot && Math.random() < 0.3) sfx.grind();
          break;
        default:
          break;
      }
    }
  }

  function tick(dt: number) {
    const st = state.current;
    if (!st) return;
    dt *= DEV_SPEED;
    const w = st.world;
    const v = st.view;
    st.phaseT += dt;
    // input
    const k = ctl.current;
    let sx = k.sx;
    let sy = k.sy;
    if (k.keys.size) {
      const kx = (k.keys.has('d') || k.keys.has('arrowright') ? 1 : 0) - (k.keys.has('a') || k.keys.has('arrowleft') ? 1 : 0);
      const ky = (k.keys.has('w') || k.keys.has('arrowup') ? 1 : 0) - (k.keys.has('s') || k.keys.has('arrowdown') ? 1 : 0);
      if (kx || ky) {
        const l = Math.hypot(kx, ky);
        sx = kx / l;
        sy = ky / l;
      }
    }
    if (k.boostT > 0) {
      k.boostT -= dt;
      if (k.boostT <= 0) k.boost = false;
    }

    if (st.phase === 'intro') {
      const t = st.phaseT;
      const n = t < 1.6 ? null : t < 2.3 ? '3' : t < 3.0 ? '2' : t < 3.7 ? '1' : 'FIGHT!';
      if (n !== countdownRef.current) {
        countdownRef.current = n;
        setCountdown(n);
        if (n && n !== 'FIGHT!') sfx.beep(false);
        if (n === 'FIGHT!') {
          sfx.horn();
          v.setMode('fight');
        }
      }
      if (t > 4.3) {
        st.phase = 'fight';
        st.phaseT = 0;
        setPhase('fight');
        setCountdown(null);
      }
    }

    const running = (st.phase === 'fight' || st.phase === 'ending') && !st.paused;
    if (running) {
      let simDt = dt * st.slow;
      if (st.hitstop > 0) {
        st.hitstop -= dt;
        simDt = 0;
      }
      st.acc += simDt;
      let steps = 0;
      if (st.acc > 0.25 * DEV_SPEED) st.acc = 0.25 * DEV_SPEED;
      while (st.acc >= DT && steps < 12 * DEV_SPEED) {
        st.acc -= DT;
        steps++;
        st.prev = st.cur;
        const me = w.bots[0];
        if (st.auto) {
          st.pilot.update(DT);
          me.ctl.fire = me.ctl.fire || k.fire;
          me.ctl.fireTop = me.ctl.fireTop || k.top;
          me.ctl.boost = me.ctl.boost || k.boost;
        } else {
          st.manual.apply(me, w.bots[1], sx, sy, app.settings.assist);
          me.auto = app.settings.autoFire;
          me.ctl.fire = k.fire;
          me.ctl.fireTop = k.top;
          me.ctl.boost = k.boost;
        }
        st.ai.update(DT);
        w.step();
        st.cur = w.bots.map(snap);
        if (w.events.length) {
          v.onEvents(w.events);
          handleEvents(w.events);
          w.events.length = 0;
        }
        if (w.over && st.phase === 'fight') {
          beginEnding();
          break;
        }
      }
    }
    const alpha = Math.min(1, st.acc / DT);
    v.frame(st.prev, st.cur, running ? alpha : 1, dt);
    v.render(getRenderer());

    if (st.phase === 'ending') {
      st.endT += dt;
      if (st.endT > 1.2) st.slow = Math.min(1, st.slow + dt * 0.6);
      const r = w.result!;
      if (r.method === 'decision' && st.endT > 1.6 && !judgesShown.current) {
        judgesShown.current = true;
        setJudges(r);
        setPhase('judges');
        st.phase = 'judges';
        st.endT = 0;
      } else if (r.method !== 'decision' && st.endT > 3.2 && !st.done) {
        finish();
      }
    } else if (st.phase === 'judges') {
      st.endT += dt;
      if (st.endT > 5.6 && !st.done) finish();
    }

    // HUD, a few times a second
    st.hudT -= dt;
    if (st.hudT <= 0) {
      st.hudT = 1 / 15;
      const me = w.bots[0];
      const ws = me.front && me.front.w.def.type !== 'wedge' && me.front.w.def.type !== 'ram' ? me.front : me.top;
      const topWs = me.top;
      setHud({
        t: Math.ceil(w.timeLeft),
        bots: w.bots.map((b) => hudBot(b)),
        heat: Math.min(1, me.heat / 100),
        ready: !!ws && (ws.w.energyMax > 0 ? ws.energy > ws.w.energyMax * 0.6 : ws.reload <= 0 && !ws.holding),
        topReady: !!topWs && topWs.reload <= 0,
        boost: me.boostCd > 0 ? 1 - me.boostCd / (me.s.boostCooldown + 2) : 1,
        spin: ws && ws.w.energyMax > 0 ? ws.energy / ws.w.energyMax : -1,
      });
      sfx.fightTick(
        w.bots.map((b) => {
          const s = b.front?.w.energyMax ? b.front : b.top?.w.energyMax ? b.top : null;
          return {
            spin: s ? s.energy / s.w.energyMax : 0,
            saw: !!(b.front?.w.def.type === 'saw' && b.front.firing) || !!(b.top?.w.def.type === 'saw' && b.top.firing),
            speed: b.speed,
            flame: !!(b.top?.firing && b.top.w.def.type === 'flame'),
          };
        }),
        0.3,
      );
      for (const i of [0, 1]) {
        const b = w.bots[i];
        if (b.immobileT <= 0.5 && st.lastCount[i] > 0) {
          st.lastCount[i] = 0;
          setCount((c0) => (c0 && c0.bot === i ? null : c0));
        }
        if (b.immobileT > 0.5) st.lastCount[i] = 1;
      }
    }
  }

  const countdownRef = useRef<string | null>(null);
  const judgesShown = useRef(false);

  function hudBot(b: Bot): HudBot {
    const s = b.s;
    const zones = ['front', 'left', 'right', 'rear', 'top'] as const;
    const down: string[] = [];
    if (s.compHp.drive > 0 && b.comp.drive <= 0) down.push('DRIVE');
    if ((b.front && b.comp.front <= 0) || (b.top && b.comp.top <= 0)) down.push('WEAPON');
    if (b.comp.core <= 0) down.push('POWER');
    return {
      name: s.name,
      hp: Math.max(0, b.hp / s.hpMax),
      armor: zones.map((z) => (s.armorMax[z] > 0 ? b.armor[z] / s.armorMax[z] : 0)),
      weapon: '',
      hot: b.overheated,
      burning: b.burning > 0,
      down,
      count: b.immobileT,
    };
  }

  function beginEnding() {
    const st = state.current!;
    const w = st.world;
    const r = w.result!;
    st.phase = 'ending';
    st.endT = 0;
    setPhase('ending');
    setCount(null);
    const win = r.winner === 0;
    if (r.method === 'decision') {
      sfx.buzzer();
      setBanner({ text: 'TIME!', sub: 'TO THE JUDGES', cls: 'yellow' });
    } else {
      const loser = r.winner === 0 ? 1 : 0;
      st.slow = 0.25;
      st.view.setMode('ko', loser);
      const text = r.method === 'pit' ? 'INTO THE PIT!' : r.method === 'countout' ? 'COUNTED OUT!' : r.method === 'forfeit' ? 'FORFEIT' : 'KNOCKOUT!';
      setBanner({ text, sub: `${w.bots[r.winner ?? 0].s.name.toUpperCase()} WINS`, cls: win ? 'yellow' : 'red' });
    }
  }

  function finish() {
    const st = state.current!;
    if (st.done) return;
    st.done = true;
    const s = setup.current!;
    const r = st.world.result!;
    const outcome = applyOutcome(s, r);
    app.params = {};
    go('results', { outcome });
  }

  function onJoyDown(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    joyRef.current = { id: e.pointerId, x, y };
    setJoy({ x, y, kx: 0, ky: 0 });
    sfx.unlock();
  }

  const joyRef = useRef<{ id: number; x: number; y: number } | null>(null);
  function onJoyMove(e: PointerEvent) {
    const j = joyRef.current;
    if (!j || j.id !== e.pointerId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let dx = e.clientX - rect.left - j.x;
    let dy = e.clientY - rect.top - j.y;
    const R = 54;
    const l = Math.hypot(dx, dy);
    if (l > R) {
      // drag the base along so the stick never runs out
      const over = l - R;
      j.x += (dx / l) * over;
      j.y += (dy / l) * over;
      dx = (dx / l) * R;
      dy = (dy / l) * R;
    }
    ctl.current.sx = dx / R;
    ctl.current.sy = -dy / R;
    setJoy({ x: j.x, y: j.y, kx: dx, ky: dy });
  }

  function onJoyUp(e: PointerEvent) {
    const j = joyRef.current;
    if (!j || j.id !== e.pointerId) return;
    joyRef.current = null;
    ctl.current.sx = 0;
    ctl.current.sy = 0;
    setJoy(null);
  }

  const press = (key: 'fire' | 'top' | 'boost', on: boolean) => {
    if (key === 'boost') {
      if (on) {
        ctl.current.boost = true;
        ctl.current.boostT = 0.25;
      }
    } else ctl.current[key] = on;
    setPressed((p) => ({ ...p, [key]: on }));
    if (on) buzz(10);
  };

  const s = setup.current;
  if (!s) return null;
  const me = s.me;
  const meStats = state.current?.world.bots[0].s;
  const hasActive = !!meStats && ((meStats.front && !['wedge', 'ram'].includes(meStats.front.def.type)) || false);
  const hasTop = !!meStats?.top;
  const rv = s.op.rival ? RIVALS.find((r) => r.id === s.op.rival) : null;
  const H = hud;

  return (
    <div class="screen fight" style={{ animation: 'none' }}>
      <div ref={host} class="gl-host" />
      <div class="hud" ref={hudHost}>
        {H && (
          <div class="hud-top">
            {[0, 1].map((i) => {
              const b = H.bots[i];
              return (
                <div class={`hp ${i === 1 ? 'right' : ''}`} key={i} style={{ gridColumn: i === 0 ? 1 : 3 }}>
                  <div class="name">{b.name}</div>
                  <div class="bar-outer">
                    <i class="lag" style={{ width: `${b.hp * 100}%` }} />
                    <i class={`fill ${b.hp < 0.25 ? 'low' : ''}`} style={{ width: `${b.hp * 100}%` }} />
                  </div>
                  <div class="armor">
                    {b.armor.map((v, k) => (
                      <b key={k}>
                        <i style={{ width: `${v * 100}%` }} />
                      </b>
                    ))}
                  </div>
                  <div class="icons">
                    {b.hot && <span class="hot">HOT</span>}
                    {b.burning && <span class="hot">FIRE</span>}
                    {b.down.map((d) => (
                      <span class="bad" key={d}>
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            <div class={`timer ${H.t <= 10 ? 'low' : ''}`} style={{ gridColumn: 2, gridRow: 1 }}>
              {Math.floor(H.t / 60)}:{String(H.t % 60).padStart(2, '0')}
            </div>
          </div>
        )}
        <div class="feed">
          {feed.map((f) => (
            <div class="line" key={f.id} style={{ color: f.color ?? '#fff' }}>
              {f.text}
            </div>
          ))}
        </div>
        {count && phase === 'fight' && (
          <div class="count" style={{ color: count.bot === 0 ? 'var(--red)' : 'var(--gold)' }}>
            {count.n}
          </div>
        )}
        {countdown && (
          <div class={`banner ${countdown === 'FIGHT!' ? 'yellow' : ''}`} key={countdown}>
            {countdown === 'FIGHT!' ? 'ACTIVATE!' : countdown}
          </div>
        )}
        {phase === 'intro' && (
          <>
            <div class="intro-card blue">
              <BotThumb d={me} corner="blue" w={84} h={63} />
              <div class="grow">
                <div class="label" style={{ color: 'var(--cyan)' }}>
                  Blue corner
                </div>
                <div class="display" style={{ fontSize: '20px' }}>
                  {me.name}
                </div>
                <div class="small muted">{app.career?.team ?? 'You'}</div>
              </div>
            </div>
            <div class="intro-card red">
              <BotThumb d={s.op.bot} corner="red" w={84} h={63} />
              <div class="grow">
                <div class="label" style={{ color: 'var(--red)' }}>
                  Red corner
                </div>
                <div class="display" style={{ fontSize: '20px' }}>
                  {s.op.bot.name}
                </div>
                <div class="small muted">
                  {flag(s.op.country)} {rv ? `${rv.driver} · ${rv.team}` : s.op.team}
                </div>
              </div>
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(var(--sat) + 84px)', textAlign: 'center', textShadow: '0 1px 4px #000' }} class="label">
              {s.title}
            </div>
          </>
        )}
        {banner && (
          <div class={`banner ${banner.cls ?? ''}`}>
            {banner.text}
            {banner.sub && <span class="sub">{banner.sub}</span>}
          </div>
        )}
        {(phase === 'fight' || phase === 'intro') && (
          <div class="hud-btns">
            <button class="hud-btn" aria-label="Pause" onClick={() => togglePause()}>
              <Icon name="pause" size={18} />
            </button>
            <button
              class={`hud-btn ${auto ? 'on' : ''}`}
              aria-label="Autopilot"
              onClick={() => {
                const st = state.current;
                if (!st) return;
                st.auto = !st.auto;
                setAuto(st.auto);
                sfx.click();
              }}
            >
              AUTO
            </button>
          </div>
        )}
        {phase !== 'judges' && phase !== 'ending' && (
          <div class={`controls ${settings.lefty ? 'lefty' : ''}`}>
            <div class="joy-zone" onPointerDown={onJoyDown} onPointerMove={onJoyMove} onPointerUp={onJoyUp} onPointerCancel={onJoyUp}>
              <div
                class={`joy ${joy ? '' : 'idle'}`}
                style={{ left: `${joy ? joy.x : 96}px`, top: `${joy ? joy.y : 120}px` }}
              >
                {!joy && <div class="hint">DRIVE</div>}
                <div class="knob" style={{ transform: `translate(${joy?.kx ?? 0}px, ${joy?.ky ?? 0}px)` }} />
              </div>
            </div>
            {H && (
              <div class="heatbar">
                <span>HEAT</span>
                <div class="bar">
                  <i style={{ width: `${H.heat * 100}%` }} />
                </div>
              </div>
            )}
            <div class="pad">
              <button
                class={`fbtn main ${pressed.fire ? 'pressed' : ''} ${H?.ready ? 'ready' : ''} ${!hasActive && H?.spin === -1 ? 'off' : ''}`}
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); press('fire', true); }}
                onPointerUp={() => press('fire', false)}
                onPointerCancel={() => press('fire', false)}
              >
                {H && H.spin >= 0 && (
                  <svg class="ring" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="6" />
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#ffd23f" stroke-width="6" stroke-dasharray={`${H.spin * 289} 289`} transform="rotate(-90 50 50)" stroke-linecap="round" />
                  </svg>
                )}
                <span class="lbl">{H && H.spin >= 0 ? 'SPIN' : 'FIRE'}</span>
              </button>
              {hasTop && (
                <button
                  class={`fbtn top ${pressed.top ? 'pressed' : ''}`}
                  onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); press('top', true); }}
                  onPointerUp={() => press('top', false)}
                  onPointerCancel={() => press('top', false)}
                >
                  <span class="lbl">TOP</span>
                </button>
              )}
              <button
                class={`fbtn boost ${pressed.boost ? 'pressed' : ''} ${H && H.boost < 1 ? 'off' : ''}`}
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); press('boost', true); }}
                onPointerUp={() => press('boost', false)}
                onPointerCancel={() => press('boost', false)}
              >
                {H && H.boost < 1 && (
                  <svg class="ring" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#2ee6ff" stroke-width="6" stroke-dasharray={`${H.boost * 289} 289`} transform="rotate(-90 50 50)" />
                  </svg>
                )}
                <span class="lbl">BOOST</span>
              </button>
            </div>
          </div>
        )}
      </div>
      {judges && <Judges r={judges} names={[me.name, s.op.bot.name]} />}
      {paused && (
        <div class="modal-wrap">
          <div class="modal col" style={{ gap: '12px' }}>
            <div class="display center" style={{ fontSize: '26px' }}>
              Paused
            </div>
            <div class="small muted center">Drive with the left thumb, fire with the right. AUTO lets your pit crew drive.</div>
            <Btn kind="primary" wide onClick={() => togglePause()}>
              Resume
            </Btn>
            <Btn
              kind="danger"
              wide
              onClick={() => {
                const st = state.current!;
                st.paused = false;
                setPaused(false);
                st.world.forfeit(0);
                beginEnding();
              }}
            >
              {s.mode === 'career' ? 'Forfeit the fight' : 'Give up'}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function Judges({ r, names }: { r: FightResult; names: [string, string] }) {
  const j = r.judges!;
  const total = (c: { damage: number[]; aggression: number[]; control: number[] }, i: number) => c.damage[i] + c.aggression[i] + c.control[i];
  const win = r.winner ?? 0;
  const votes = j.votes;
  const kind = votes[0] === 3 || votes[1] === 3 ? 'Unanimous decision' : 'Split decision';
  return (
    <div class="judges">
      <div class="scorecard">
        <div class="label center">The judges' scorecards</div>
        <div class="row" style={{ justifyContent: 'space-between', margin: '10px 0 4px' }}>
          <b style={{ color: 'var(--cyan)' }}>{names[0]}</b>
          <b style={{ color: 'var(--red)' }}>{names[1]}</b>
        </div>
        {j.cards.map((c, k) => (
          <div class="judge" key={k} style={{ animationDelay: `${0.4 + k * 0.6}s` }}>
            <span class="n" style={{ color: total(c, 0) > total(c, 1) ? 'var(--cyan)' : 'var(--muted)' }}>
              {total(c, 0)}
            </span>
            <span class="tiny muted center">
              Judge {k + 1}
              <br />
              DMG {c.damage[0]}–{c.damage[1]} · AGG {c.aggression[0]}–{c.aggression[1]} · CTL {c.control[0]}–{c.control[1]}
            </span>
            <span class="n" style={{ textAlign: 'right', color: total(c, 1) > total(c, 0) ? 'var(--red)' : 'var(--muted)' }}>
              {total(c, 1)}
            </span>
          </div>
        ))}
        <div class="center" style={{ marginTop: '12px', animation: 'fade-in 0.5s 2.3s backwards' }}>
          <div class="label">
            {kind} · {Math.max(votes[0], votes[1])}–{Math.min(votes[0], votes[1])}
          </div>
          <div class="display" style={{ fontSize: '24px', color: win === 0 ? 'var(--gold)' : 'var(--red)', marginTop: '4px' }}>
            {names[win]} wins
          </div>
        </div>
      </div>
    </div>
  );
}

/** Book the fight into the career (money, records, the tournament) and describe it. */
function applyOutcome(s: FightSetup, r: FightResult): FightOutcome {
  const payouts: Array<[string, number]> = [];
  let fame = 0;
  if (s.mode === 'career' && app.career?.tournament) {
    update((c: Career) => {
      const t = c.tournament!;
      const ev = eventOf(t.event)!;
      const won = r.winner === 0;
      const me = r.stats[0];
      const ko = won && r.method !== 'decision' && r.method !== 'forfeit';
      c.records.fights++;
      if (won) c.records.wins++;
      if (ko) c.records.kos++;
      if (ko && (!c.records.fastestKO || r.time < c.records.fastestKO)) c.records.fastestKO = r.time;
      c.records.flips += me.flips;
      if (won && r.method === 'pit') c.records.pits++;
      c.records.damage += me.dmgDealt;
      c.records.biggestHit = Math.max(c.records.biggestHit, me.biggestHit);
      const scale = 1 + (c.season - 1) * 0.15;
      if (won) payouts.push(['Win bonus', Math.round(ev.winBonus * scale)]);
      const sp = t.sponsor;
      if (sp) {
        let n = 0;
        if (sp.kind === 'ko' && ko) n = 1;
        if (sp.kind === 'flip') n = me.flips;
        if (sp.kind === 'bighit') n = me.bigHits;
        if (sp.kind === 'fast' && won && r.time <= 45) n = 1;
        if (sp.kind === 'decision' && won && r.method === 'decision') n = 1;
        if (sp.kind === 'win' && won) n = 1;
        if (n > 0) {
          const amt = Math.round(sp.amount * n * scale);
          payouts.push([`${sp.name}${n > 1 ? ` ×${n}` : ''}`, amt]);
          t.sponsorEarned += amt;
        }
      }
      for (const [, v] of payouts) c.money += v;
      t.earned += payouts.filter(([k]) => k === 'Win bonus').reduce((x, [, v]) => x + v, 0);
      fame = won ? 4 + ev.tier * 3 + (ko ? 3 : 0) : 1;
      c.fame += fame;
      if (s.op.rival) {
        const rec = (c.rivals[s.op.rival] ??= { w: 0, l: 0 });
        if (won) rec.w++;
        else rec.l++;
      }
      c.wear[t.botId] = r.wear[0];
      recordPlayerFight(t, r);
    });
  }
  return { mode: s.mode, result: r, me: s.me, op: s.op, arena: s.arena, title: s.title, payouts, fame };
}

