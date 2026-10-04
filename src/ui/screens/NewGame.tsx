import { useMemo, useState } from 'preact/hooks';
import { KITS, newCareer } from '../../career/career.ts';
import { autoPower } from '../../sim/stats.ts';
import type { BotDesign, Paint } from '../../data/types.ts';
import { sfx } from '../../audio/sfx.ts';
import { Btn, TopBar } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { Stage } from '../stage.tsx';
import { go, setCareer, toast } from '../store.ts';

export const COLORS = ['#ffb000', '#ff3b30', '#ff7a1a', '#ffd23f', '#4fd18b', '#06d6a0', '#2ee6ff', '#3a86ff', '#8338ec', '#f72585', '#f1f1f1', '#9aa0a8', '#3b3f47', '#141414'];
export const PATTERNS: Paint['pattern'][] = ['plain', 'stripes', 'checker', 'flames', 'hazard', 'camo', 'bolt'];

const TEAMS = ['Garage 51', 'Bolt Brothers', 'Short Circuit Co.', 'Torque & Sons', 'Night Shift Robotics', 'The Overclockers'];
const BOTS = ['Rookie', 'Sparky', 'Little Tank', 'Knuckles', 'Dent Maker', 'Scrapper'];

export function PaintPicker({ paint, onChange }: { paint: Paint; onChange: (p: Paint) => void }) {
  return (
    <div class="col">
      <div class="label">Main colour</div>
      <div class="swatches">
        {COLORS.map((c) => (
          <button key={c} class={`swatch ${paint.primary === c ? 'on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => { sfx.click(); onChange({ ...paint, primary: c }); }} />
        ))}
      </div>
      <div class="label">Second colour</div>
      <div class="swatches">
        {COLORS.map((c) => (
          <button key={c} class={`swatch ${paint.secondary === c ? 'on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => { sfx.click(); onChange({ ...paint, secondary: c }); }} />
        ))}
      </div>
      <div class="label">Pattern</div>
      <div class="seg" style={{ flexWrap: 'wrap' }}>
        {PATTERNS.map((p) => (
          <button key={p} class={paint.pattern === p ? 'on' : ''} onClick={() => { sfx.click(); onChange({ ...paint, pattern: p }); }}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NewGame() {
  const [team, setTeam] = useState(TEAMS[Math.floor(Math.random() * TEAMS.length)]);
  const [botName, setBotName] = useState(BOTS[Math.floor(Math.random() * BOTS.length)]);
  const [kit, setKit] = useState(KITS[0].id);
  const [paint, setPaint] = useState<Paint>({ primary: '#ffb000', secondary: '#141414', pattern: 'hazard' });
  const preview: BotDesign = useMemo(() => {
    const k = KITS.find((x) => x.id === kit)!;
    const d: BotDesign = { ...structuredClone(k.design), id: 'preview', name: botName, paint, power: { drive: 1, front: 1, top: 1, aux: 1 } };
    d.power = autoPower(d);
    return d;
  }, [kit, paint, botName]);

  return (
    <div class="screen">
      <TopBar title="New career" sub="Found your team" back="title" right={<span />} />
      <div style={{ position: 'relative', height: '28vh', minHeight: '170px', flexShrink: 0 }}>
        <Stage design={preview} zoom={1.25} />
      </div>
      <div class="scroll pad-bottom">
        <div class="section-title">Team</div>
        <div class="col">
          <input class="field" value={team} maxLength={24} onInput={(e) => setTeam((e.target as HTMLInputElement).value)} placeholder="Team name" aria-label="Team name" />
          <input class="field" value={botName} maxLength={18} onInput={(e) => setBotName((e.target as HTMLInputElement).value)} placeholder="Robot name" aria-label="Robot name" />
        </div>
        <div class="section-title">Starter kit</div>
        <div class="list">
          {KITS.map((k) => (
            <button
              key={k.id}
              class={`card tap ${kit === k.id ? 'sel' : ''}`}
              style={{ textAlign: 'left' }}
              onClick={() => {
                sfx.select();
                setKit(k.id);
              }}
            >
              <div class="row">
                <Icon name={k.id === 'spinner' ? 'spinner' : k.id === 'control' ? 'flip' : 'hammer'} size={26} style={{ color: 'var(--accent)' }} />
                <div class="grow">
                  <div class="display" style={{ fontSize: '17px' }}>
                    {k.name}
                  </div>
                  <div class="small muted">{k.blurb}</div>
                </div>
                {kit === k.id && <Icon name="check" style={{ color: 'var(--accent)' }} />}
              </div>
            </button>
          ))}
        </div>
        <div class="small muted" style={{ marginTop: '8px' }}>
          Every kit can win. You keep the parts, and can buy any other part as your licences grow.
        </div>
        <div class="section-title">Paint job</div>
        <PaintPicker paint={paint} onChange={setPaint} />
        <div style={{ height: '18px' }} />
        <Btn
          kind="primary"
          size="big"
          wide
          shine
          sound="select"
          onClick={() => {
            const c = newCareer(team.trim(), kit, botName.trim(), paint);
            setCareer(c);
            sfx.fanfare();
            toast(`Welcome to the circuit, ${c.team}!`, 'gold');
            go('hub');
          }}
        >
          Start career
        </Btn>
      </div>
    </div>
  );
}
