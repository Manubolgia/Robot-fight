import { useMemo, useState } from 'preact/hooks';
import { archetypesFor, makeBuild, randomPaint } from '../../career/builds.ts';
import { levels } from '../../career/career.ts';
import { exhibitionOpponent } from '../../career/tournament.ts';
import { ARENAS } from '../../data/arenas.ts';
import { isLegal } from '../../sim/stats.ts';
import { mulberry32 } from '../../sim/rng.ts';
import { setQuality } from '../../render/gfx.ts';
import { sfx } from '../../audio/sfx.ts';
import { BotThumb, Btn, Toggle, TopBar, confirm } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { go, setCareer, setSettings, useApp } from '../store.ts';
import { hazardsOf } from './Events.tsx';
import type { FightSetup } from './Fight.tsx';

// ---- quick fight -------------------------------------------------------------------

export function QuickFight() {
  const a = useApp();
  const c = a.career;
  const [tier, setTier] = useState(c ? Math.max(1, c.tier) : 3);
  const [mine, setMine] = useState<string>(c ? c.active : `arch:${archetypesFor(3)[0].id}`);
  const [opArch, setOpArch] = useState<string>('random');
  const [arena, setArena] = useState(ARENAS[c ? Math.min(ARENAS.length - 1, c.tier) : 4].id);
  // only the strategies this tier's parts can build
  const archs = archetypesFor(tier);
  const presets = useMemo(() => archs.map((ar, i) => ({ ar, d: makeBuild(ar, tier, mulberry32(100 + i * 7 + tier), { name: ar.name, paint: randomPaint(mulberry32(i * 31 + 5)) }) })), [tier]);
  if (mine.startsWith('arch:') && !presets.some((p) => `arch:${p.ar.id}` === mine)) setMine(`arch:${presets[0].ar.id}`);
  if (opArch !== 'random' && !archs.some((ar) => ar.id === opArch)) setOpArch('random');
  const myBot = mine.startsWith('arch:') ? presets.find((p) => `arch:${p.ar.id}` === mine)?.d : c?.bots.find((b) => b.id === mine);
  const legal = myBot && (mine.startsWith('arch:') || (c && isLegal(myBot, levels(c))));
  return (
    <div class="screen">
      <TopBar title="Quick fight" sub="No money, no damage, just fun" back={c ? 'hub' : 'title'} right={<span />} />
      <div class="scroll pad-bottom">
        <div class="section-title">Your robot</div>
        <div class="list">
          {c &&
            c.bots.map((b) => (
              <button key={b.id} class={`card tap row ${mine === b.id ? 'sel' : ''}`} style={{ textAlign: 'left' }} onClick={() => { sfx.click(); setMine(b.id); }}>
                <BotThumb d={b} corner="blue" w={72} h={54} />
                <div class="grow">
                  <b>{b.name}</b>
                  <div class="small muted">Your garage</div>
                </div>
              </button>
            ))}
        </div>
        <div class="label" style={{ margin: '12px 0 6px' }}>
          Or borrow a tier {tier} robot
        </div>
        <div class="row" style={{ flexWrap: 'wrap', gap: '6px' }}>
          {presets.map((p) => (
            <button key={p.ar.id} class={`badge ${mine === `arch:${p.ar.id}` ? 'cyan' : ''}`} style={{ padding: '7px 10px', fontSize: '12px' }} onClick={() => { sfx.click(); setMine(`arch:${p.ar.id}`); }}>
              {p.ar.name}
            </button>
          ))}
        </div>
        <div class="section-title">Opponent</div>
        <div class="label" style={{ marginBottom: '6px' }}>
          Tier (parts and brains)
        </div>
        <div class="seg">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} class={tier === n ? 'on' : ''} onClick={() => { sfx.click(); setTier(n); }}>
              {n}
            </button>
          ))}
        </div>
        <div class="row" style={{ flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
          <button class={`badge ${opArch === 'random' ? 'cyan' : ''}`} style={{ padding: '7px 10px', fontSize: '12px' }} onClick={() => setOpArch('random')}>
            Random
          </button>
          {archs.map((ar) => (
            <button key={ar.id} class={`badge ${opArch === ar.id ? 'cyan' : ''}`} style={{ padding: '7px 10px', fontSize: '12px' }} onClick={() => { sfx.click(); setOpArch(ar.id); }}>
              {ar.name}
            </button>
          ))}
        </div>
        <div class="section-title">Arena</div>
        <div class="list">
          {ARENAS.map((ar) => (
            <button key={ar.id} class={`card tap ${arena === ar.id ? 'sel' : ''}`} style={{ textAlign: 'left', padding: '10px 12px' }} onClick={() => { sfx.click(); setArena(ar.id); }}>
              <div class="row">
                <b class="grow">{ar.name}</b>
                <span class="tiny muted">{ar.size} m</span>
              </div>
              <div class="hazards" style={{ marginTop: '6px' }}>
                {hazardsOf(ar).map(([icon, label]) => (
                  <span class="hz" key={label}>
                    <Icon name={icon} size={12} /> {label}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
        <div style={{ height: '16px' }} />
        <Btn
          kind="primary"
          size="big"
          wide
          shine
          sound="select"
          disabled={!legal}
          onClick={() => {
            const op = exhibitionOpponent(tier, c?.season ?? 1, opArch === 'random' ? undefined : opArch);
            const setup: FightSetup = {
              mode: 'quick',
              me: myBot!,
              op,
              arena,
              levels: c && !mine.startsWith('arch:') ? levels(c) : () => 1,
              title: 'Quick fight',
            };
            go('fight', { mode: 'quick', setup });
          }}
        >
          <Icon name="bolt" size={20} /> Fight!
        </Btn>
      </div>
    </div>
  );
}

// ---- settings ----------------------------------------------------------------------

export function Settings() {
  const a = useApp();
  const s = a.settings;
  const from = (a.params.from as 'title' | 'team') ?? 'title';
  const row = (label: string, sub: string, on: boolean, set: (v: boolean) => void) => (
    <div class="row" style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
      <div class="grow">
        <b>{label}</b>
        <div class="small muted">{sub}</div>
      </div>
      <Toggle on={on} onChange={set} />
    </div>
  );
  return (
    <div class="screen">
      <TopBar title="Settings" back={from} right={<span />} />
      <div class="scroll pad-bottom">
        <div class="card" style={{ paddingTop: '2px', paddingBottom: '2px' }}>
          {row('Sound', 'Engines, impacts and the crowd', s.sound, (v) => {
            setSettings({ sound: v });
            sfx.setEnabled(v);
          })}
          {row('Vibration', 'Buzz on hits (where supported)', s.haptics, (v) => setSettings({ haptics: v }))}
          {row('Damage numbers', 'Show how hard each hit lands', s.numbers, (v) => setSettings({ numbers: v }))}
          <div class="row" style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
            <div class="grow">
              <b>Graphics</b>
              <div class="small muted">Low saves battery on older phones</div>
            </div>
            <div class="seg" style={{ width: '140px' }}>
              {(['high', 'low'] as const).map((q) => (
                <button
                  key={q}
                  class={s.quality === q ? 'on' : ''}
                  onClick={() => {
                    setSettings({ quality: q });
                    setQuality(q);
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
        {a.career && (
          <>
            <div class="section-title">Career</div>
            <Btn
              kind="danger"
              wide
              onClick={() =>
                confirm('Delete career?', 'Your team, money, parts, robots and trophies will be gone for good.', 'Delete', () => {
                  setCareer(null);
                  go('title');
                }, true)
              }
            >
              <Icon name="trash" size={18} /> Delete career
            </Btn>
          </>
        )}
        <div class="small muted center" style={{ marginTop: '22px' }}>
          Kilowatt · robot combat league
          <br />
          Everything is drawn and synthesised in your browser. Works offline once installed.
        </div>
      </div>
    </div>
  );
}

// ---- how to play ---------------------------------------------------------------------

const COUNTERS: Array<[string, string, string]> = [
  ['Vertical spinners', 'wedges, flippers, lifters', 'fast flankers, thick UHMW'],
  ['Drums', 'low pushers, rammers', 'hammers, crushers'],
  ['Horizontal bars', 'boxes, crushers', 'low wedges, flippers'],
  ['Ring spinners', 'saws, crushers, wedges', 'hammers (top), flippers'],
  ['Flippers & lifters', 'robots that cannot self-right, spinners from the side', 'saws, rammers, low frames'],
  ['Hammers & axes', 'thin top armour, rings, drums', 'flippers, fast robots'],
  ['Crushers', 'heavy armour, ring spinners', 'vertical spinners'],
  ['Saws', 'pushers, plastic armour', 'steel armour, spinners'],
  ['Rammers', 'flippers, wedges', 'drums, spinners'],
  ['Wedges', 'horizontal spinners, hazards', 'vertical spinners, hammers'],
  ['Flamethrowers', 'overvolted robots, UHMW', 'heat sinks, coolant'],
];

export function HowTo() {
  const a = useApp();
  const sec = (title: string, body: preact.ComponentChildren) => (
    <>
      <div class="section-title">{title}</div>
      <div class="card small" style={{ lineHeight: 1.5 }}>
        {body}
      </div>
    </>
  );
  return (
    <div class="screen">
      <TopBar title="How to play" back={a.career ? 'hub' : 'title'} right={<span />} />
      <div class="scroll pad-bottom">
        {sec(
          'You build, the robot fights',
          <>
            Nobody drives in the arena. You design the robot, split its power and give it a <b>battle plan</b>; its <b>brain</b> does the rest. A sharper brain reacts sooner, aims and times its weapon better and reads the hazards, but it draws power your weapons and wheels could have had. Watch at 1×, 2× or 4×, or skip straight to the result.
          </>,
        )}
        {sec(
          'Weight and power',
          <>
            Every robot must weigh <b>100 kg or less</b>. Heavier parts are stronger, but heavy robots accelerate and turn slowly, and every plate of armour costs weight. Your <b>power core</b> makes a fixed number of kilowatts that the drive, the weapons, the modules and the brain share: in the garage's Power tab you choose who gets what. Less power makes a system weaker; <b>overvolting</b> past 100% makes it stronger but builds heat, and an overheated robot runs its drive and weapons at half power. Every part also needs a <b>minimum</b>: below it a weapon is off, and a brain that drops under its minimum mid-fight (a damaged core, an overheat on top) reboots, frozen for a moment. Later parts are better, but they draw more and need a bigger minimum: fit the best of everything and something else, usually the armour, has to give.
          </>,
        )}
        {sec(
          'The battle plan',
          <>
            <b>Stance</b>: aggressive robots press with a half-ready weapon and never back off; defensive ones wait for clean openings. <b>Approach</b>: head-on, round to the side (flank), or hold off until the other robot commits (counter). <b>Hazards</b>: shove them into the pit and the saws, or fight in the open. Brains have quirks too: reckless, cautious, hunters and adaptive minds each bend the plan their own way.
          </>,
        )}
        {sec(
          'Damage',
          <>
            Armour plates sit on the front, sides, rear and top and soak up a share of each hit until they are smashed off. Materials matter: UHMW plastic shrugs off spinners but saws and flames cut through it; steel stops saws but is heavy. Hits that get through also damage the <b>drive</b>, <b>weapons</b> and <b>power core</b>.
          </>,
        )}
        {sec(
          'Winning',
          <>
            Destroy the other robot, drop it into the <b>pit</b>, or leave it unable to move for ten seconds (flipped over with no way to self-right, or with its drive wrecked). If both survive 90 seconds, three judges score <b>damage</b>, <b>control</b> and <b>aggression</b>.
          </>,
        )}
        <div class="section-title">What beats what</div>
        <div class="card" style={{ padding: '4px 12px' }}>
          {COUNTERS.map(([w, good, bad]) => (
            <div key={w} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <b>{w}</b>
              <div class="small">
                <span class="up">strong vs</span> {good}
              </div>
              <div class="small">
                <span class="down">weak vs</span> {bad}
              </div>
            </div>
          ))}
        </div>
        {sec(
          'The career',
          <>
            Start in the Garage League with a starter kit and a thousand dollars. Win events for prize money and the next <b>licence</b>: Regional, National, the Continental Masters, then the <b>Kilowatt World Cup</b> with its group stage and knockouts. Buy parts once and fit them to any robot; upgrade them in the workshop; hire a better pit crew to repair more between fights. Damage carries over between the fights of a tournament.
          </>,
        )}
        <div style={{ height: '16px' }} />
        <Btn kind="primary" wide onClick={() => go(a.career ? 'hub' : 'title')}>
          Got it
        </Btn>
      </div>
    </div>
  );
}
