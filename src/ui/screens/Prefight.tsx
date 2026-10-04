import { useEffect } from 'preact/hooks';
import { CREW_PCT, crewPatch, damageOf, fullRepair, levels, repairCost, wearOf } from '../../career/career.ts';
import { RIVALS, flag } from '../../career/names.ts';
import { entrantLevels, nextPlayerMatch, opponentOf, type Entrant } from '../../career/tournament.ts';
import { eventOf } from '../../data/events.ts';
import { WEAPON_FAMILY, weaponOf } from '../../data/parts.ts';
import type { BotDesign, Wear } from '../../data/types.ts';
import { computeStats, readout, validate } from '../../sim/stats.ts';
import { sfx } from '../../audio/sfx.ts';
import { BotThumb, Btn, Stat, TopBar, fmtMoney } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { app, go, toast, update, useApp } from '../store.ts';
import { PlanTab, PowerTab, TRAIT_TEXT } from './Garage.tsx';

/** A line of advice for facing a robot with this main weapon. */
export function scoutAdvice(op: BotDesign): string[] {
  const s = computeStats(op);
  const w = s.front && s.front.def.type !== 'wedge' ? s.front.def : s.top?.def ?? s.front?.def;
  const out: string[] = [];
  switch (w?.type) {
    case 'vspin':
      out.push('A vertical spinner: deadly from the front but slow to turn while spun up. Attack its sides right after it hits something.');
      break;
    case 'drum':
      out.push('A drum: bites hard and often. Thick front armour, or stay out of its way and strike when it misses.');
      break;
    case 'hspin':
      out.push('A horizontal bar: wide sweeping hits. A low wedge deflects it; hit it while it spins back up.');
      break;
    case 'ring':
      out.push('A ring spinner: dangerous from every side. Thick kinetic armour (UHMW) soaks it up; it is weak on top.');
      break;
    case 'flipper':
      out.push('A flipper: it wants to get under you. Keep your front to it, and carry a self-righter or an invertible frame.');
      break;
    case 'lifter':
      out.push('A lifter: it will try to carry you into the hazards. Stay away from walls and the pit.');
      break;
    case 'hammer':
    case 'axe':
      out.push('An overhead weapon: it hits your top armour. Rush it right after a swing, it needs time to reset.');
      break;
    case 'crusher':
      out.push('A crusher: bites through armour and holds on. Do not linger in front of its jaws.');
      break;
    case 'saw':
      out.push('Saws grind while they touch: steel armour shrugs them off. Do not get pinned.');
      break;
    case 'ram':
      out.push('A rammer: hits hardest with a run-up. Stay close, or meet it with a weapon of your own.');
      break;
    case 'flame':
      out.push('A flamethrower: heat, not damage. Don\'t overvolt against it, or you will overheat.');
      break;
    default:
      out.push('A pusher: it wins on control and the hazards. Keep away from the walls and hit it hard.');
  }
  if (s.mind.trait) out.push(`Its brain is ${TRAIT_TEXT[s.mind.trait].charAt(0).toLowerCase()}${TRAIT_TEXT[s.mind.trait].slice(1)}`);
  if (s.mind.plan.stance === 'aggressive') out.push('Told to be aggressive: it will come at you with a half-ready weapon.');
  else if (s.mind.plan.approach === 'counter') out.push('It plays the counter: it waits for you to commit, then strikes.');
  if (!s.invertible && s.selfRight <= 0) out.push('It cannot self-right: flip it over and it is counted out.');
  if (s.armorMax.top < 60) out.push('Its top armour is thin.');
  if (s.mass < 85) out.push(`Light at ${s.mass.toFixed(0)} kg: easy to throw and push around.`);
  return out;
}

function WearView({ w }: { w: Wear }) {
  const pct = (v: number) => Math.round(v * 100);
  return (
    <div class="col" style={{ gap: '4px' }}>
      <Stat icon="heart" label="Structure" value={pct(w.hp)} max={100} unit="%" fmt={(v) => v.toFixed(0)} color={w.hp < 0.5 ? 'red' : 'green'} />
      <Stat icon="shield" label="Armour" value={pct((w.armor.front + w.armor.left + w.armor.right + w.armor.rear + w.armor.top) / 5)} max={100} unit="%" fmt={(v) => v.toFixed(0)} color="green" />
      <Stat icon="wheel" label="Drive" value={pct(w.comp.drive)} max={100} unit="%" fmt={(v) => v.toFixed(0)} color={w.comp.drive < 0.5 ? 'red' : 'green'} />
      <Stat icon="target" label="Weapons" value={pct(Math.min(w.comp.front, w.comp.top))} max={100} unit="%" fmt={(v) => v.toFixed(0)} color={Math.min(w.comp.front, w.comp.top) < 0.5 ? 'red' : 'green'} />
      <Stat icon="battery" label="Core" value={pct(w.comp.core)} max={100} unit="%" fmt={(v) => v.toFixed(0)} color={w.comp.core < 0.5 ? 'red' : 'green'} />
    </div>
  );
}

export function ScoutCard({ op, label }: { op: Entrant; label?: string }) {
  const rv = op.rival ? RIVALS.find((r) => r.id === op.rival) : null;
  const ro = readout(op.bot, entrantLevels(op));
  const weapons = [op.bot.front, op.bot.top].filter((x): x is string => !!x).map((id) => weaponOf(id));
  return (
    <div class="card" style={{ borderColor: 'rgba(255,59,48,0.35)' }}>
      <div class="row" style={{ alignItems: 'flex-start' }}>
        <BotThumb d={op.bot} corner="red" w={116} h={87} />
        <div class="grow col" style={{ gap: '3px' }}>
          <div class="label" style={{ color: 'var(--red)' }}>
            {label ?? 'Red corner'}
          </div>
          <div class="display" style={{ fontSize: '19px' }}>
            {op.bot.name}
          </div>
          <div class="small muted">
            {flag(op.country)} {op.team}
          </div>
          <div class="row small" style={{ gap: '6px' }}>
            <Icon name="brain" size={14} style={{ color: 'var(--cyan)' }} /> {ro.brain}
            {(op.mk ?? 1) > 1 && <span class="badge gold">Mk {op.mk}</span>}
          </div>
          <div class="tiny muted" style={{ textTransform: 'capitalize' }}>
            {op.bot.plan.stance} · {op.bot.plan.approach === 'direct' ? 'head-on' : op.bot.plan.approach} · {op.bot.plan.hazards ? 'uses hazards' : 'avoids hazards'}
          </div>
        </div>
      </div>
      {rv && (
        <div class="small" style={{ marginTop: '8px', fontStyle: 'italic', color: '#ffd9d6' }}>
          “{rv.taunt}” — {rv.driver}
        </div>
      )}
      <div class="row" style={{ gap: '6px', flexWrap: 'wrap', margin: '10px 0 8px' }}>
        {weapons.map((w) => (
          <span class="badge bad" key={w.id}>
            {w.name} · {WEAPON_FAMILY[w.type]}
          </span>
        ))}
        <span class="badge">{ro.weight.toFixed(0)} kg</span>
      </div>
      <div class="col" style={{ gap: '4px' }}>
        <Stat icon="speed" label="Speed" value={ro.topSpeed * 3.6} max={25} unit=" km/h" fmt={(v) => v.toFixed(0)} />
        <Stat icon="heart" label="Hit points" value={ro.hp} max={2000} fmt={(v) => v.toFixed(0)} color="green" />
        <Stat icon="shield" label="Armour" value={ro.armorAvg} max={750} fmt={(v) => v.toFixed(0)} color="green" />
        <Stat icon="target" label="Hit damage" value={ro.hitDamage} max={250} fmt={(v) => v.toFixed(0)} color="red" />
      </div>
      <div class="col" style={{ gap: '6px', marginTop: '10px' }}>
        {scoutAdvice(op.bot).map((s) => (
          <div class="small" key={s} style={{ display: 'flex', gap: '6px' }}>
            <Icon name="info" size={14} style={{ color: 'var(--cyan)', flexShrink: 0, marginTop: '2px' }} />
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Prefight() {
  const a = useApp();
  const c = a.career!;
  const t = c.tournament;
  const m = t ? nextPlayerMatch(t) : null;

  // the crew patches the robot up once per fight
  useEffect(() => {
    if (!t || !m || t.patched === m.id) return;
    const before = damageOf(c.wear[t.botId]);
    update((cc) => {
      crewPatch(cc, cc.tournament!.botId);
      cc.tournament!.patched = m.id;
    });
    if (before > 0.01) toast(`Pit crew repaired ${Math.round(CREW_PCT[c.crew] * 100)}% of the damage`, 'good');
  }, [m?.id]);

  if (!t || !m) {
    queueMicrotask(() => go(t ? 'tournament' : 'hub'));
    return null;
  }
  const ev = eventOf(t.event)!;
  const op = opponentOf(t, m);
  const bot = c.bots.find((b) => b.id === t.botId)!;
  const w = wearOf(c, bot.id);
  const dmg = damageOf(c.wear[bot.id]);
  const cost = repairCost(c, bot.id);
  const issues = validate(bot, levels(c)).filter((i) => i.level === 'error');
  return (
    <div class="screen">
      <TopBar title="Pit stop" sub={`${ev.name} · ${m.stage}`} back="tournament" />
      <div class="scroll pad-bottom">
        <ScoutCard op={op} />
        <div class="section-title">{bot.name}</div>
        <div class="card">
          {dmg > 0.005 ? <WearView w={w} /> : <div class="row small" style={{ color: 'var(--green)' }}><Icon name="check" size={16} /> Fully repaired and ready.</div>}
          {dmg > 0.005 && (
            <Btn
              size="sm"
              kind="cyan"
              wide
              style={{ marginTop: '10px' }}
              sound="none"
              disabled={c.money < cost}
              onClick={() => {
                let ok = false;
                update((cc) => (ok = fullRepair(cc, bot.id)));
                if (ok) {
                  sfx.buy();
                  toast('Good as new', 'good');
                }
              }}
            >
              <Icon name="wrench" size={16} /> Full repair · {fmtMoney(cost)}
            </Btn>
          )}
        </div>
        <div class="section-title">Battle plan</div>
        <PlanTab bot={bot} />
        <div class="section-title">Power for this fight</div>
        <PowerTab c={c} bot={bot} />
        <div style={{ height: '10px' }} />
        <Btn
          wide
          onClick={() => {
            app.career!.active = bot.id;
            go('garage', { back: 'prefight' });
          }}
        >
          <Icon name="garage" size={18} /> Change parts in the garage
        </Btn>
        {issues.length > 0 && (
          <div class="issue" style={{ marginTop: '10px' }}>
            <Icon name="info" size={16} /> {issues[0].text}
          </div>
        )}
        <div style={{ height: '14px' }} />
        <Btn kind="primary" size="big" wide shine sound="select" disabled={issues.length > 0} onClick={() => go('fight', { mode: 'career' })}>
          <Icon name="bolt" size={20} /> Fight!
        </Btn>
      </div>
    </div>
  );
}
