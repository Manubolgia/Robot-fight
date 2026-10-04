import { useState } from 'preact/hooks';
import { activeBot, levels } from '../../career/career.ts';
import { createTournament, sponsorOffers } from '../../career/tournament.ts';
import { mulberry32 } from '../../sim/rng.ts';
import { arenaOf, type ArenaDef } from '../../data/arenas.ts';
import { EVENTS, FORMAT_FIGHTS, FORMAT_LABEL, TIERS, type EventDef } from '../../data/events.ts';
import { WEIGHT_LIMIT } from '../../data/types.ts';
import { isLegal, readout } from '../../sim/stats.ts';
import { sfx } from '../../audio/sfx.ts';
import { BotThumb, Btn, TabBar, Tip, TopBar, fmtMoney } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { app, closeSheet, emit, go, openSheet, toast, update, useApp } from '../store.ts';

export function hazardsOf(ar: ArenaDef): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (ar.pit) out.push(['flag', `Pit (opens ${ar.pit.opensAt}s)`]);
  if (ar.saws?.length) out.push(['saw', 'Floor saws']);
  if (ar.hammer) out.push(['hammer', 'Hammer']);
  if (ar.flames?.length) out.push(['fire', 'Fire vents']);
  if (ar.spikes?.length) out.push(['wedge', 'Spiked walls']);
  if (!out.length) out.push(['shield', 'No hazards']);
  return out;
}

function placeLabel(p: number | undefined): string {
  if (!p) return '';
  if (p === 1) return 'Won';
  if (p === 2) return 'Runner-up';
  if (p <= 4) return 'Semi-final';
  if (p <= 8) return 'Quarter-final';
  return 'Early exit';
}

export function Events() {
  const a = useApp();
  const c = a.career!;
  return (
    <div class="screen">
      <TopBar title="Events" sub={`Season ${c.season}`} />
      <div class="scroll">
        <Tip id="events">
          Every event is open to robots up to {WEIGHT_LIMIT} kg. Win events to earn the licence for the next tier: better parts, bigger prizes, tougher teams, all the way to the Kilowatt World Cup.
        </Tip>
        {TIERS.map((td) => {
          const locked = td.tier > c.tier;
          const evs = EVENTS.filter((e) => e.tier === td.tier);
          return (
            <div key={td.tier}>
              <div class="tier-head">
                <div class="num" style={{ background: locked ? 'var(--line2)' : td.color }}>
                  {locked ? <Icon name="lock" size={16} /> : td.tier}
                </div>
                <div class="grow">
                  <h2 style={{ color: locked ? 'var(--dim)' : 'var(--text)' }}>{td.name}</h2>
                  <div class="tiny muted">{locked ? `Locked · ${TIERS[td.tier - 2]?.goal ?? ''}` : td.tier < c.tier ? 'Licence held' : td.goal}</div>
                </div>
              </div>
              <div class="list">
                {evs.map((ev) => (
                  <EventCard key={ev.id} ev={ev} locked={locked} best={bestIn(c.history, ev.id)} />
                ))}
              </div>
            </div>
          );
        })}
        <div style={{ height: '12px' }} />
      </div>
      <TabBar />
    </div>
  );
}

function bestIn(h: { event: string; place: number }[], id: string): number | undefined {
  const ps = h.filter((x) => x.event === id).map((x) => x.place);
  return ps.length ? Math.min(...ps) : undefined;
}

function EventCard({ ev, locked, best }: { ev: EventDef; locked: boolean; best?: number }) {
  const ar = arenaOf(ev.arena);
  return (
    <button
      class={`card tap event-card ${locked ? 'locked' : ''}`}
      style={{ width: '100%', textAlign: 'left' }}
      onClick={() => {
        sfx.click();
        if (locked) {
          toast('Earn the licence for this tier first', 'bad');
          return;
        }
        openSheet(() => <EventSheet ev={ev} />);
      }}
    >
      <div class="row" style={{ alignItems: 'flex-start' }}>
        <div class="grow">
          <div class="display" style={{ fontSize: '17px' }}>
            {ev.name}
          </div>
          <div class="small muted">
            {ar.name} · {FORMAT_LABEL[ev.format]}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div class="prize">{fmtMoney(ev.prizes[0])}</div>
          <div class="tiny muted">first prize</div>
        </div>
      </div>
      <div class="meta">
        <span class="badge">
          <Icon name="flag" size={12} /> {FORMAT_FIGHTS[ev.format]} fights
        </span>
        <span class="badge">{ev.entry ? `Entry ${fmtMoney(ev.entry)}` : 'Free entry'}</span>
        {best && <span class={`badge ${best === 1 ? 'gold' : ''}`}>{best === 1 ? '🏆 ' : ''}{placeLabel(best)}</span>}
      </div>
    </button>
  );
}

function EventSheet({ ev }: { ev: EventDef }) {
  const c = app.career!;
  const [botId, setBotId] = useState(activeBot(c).id);
  const [sponsorIdx, setSponsorIdx] = useState(0);
  const ar = arenaOf(ev.arena);
  const bot = c.bots.find((b) => b.id === botId)!;
  const legal = isLegal(bot, levels(c));
  const r = readout(bot, levels(c));
  const busy = !!c.tournament;
  const afford = c.money >= ev.entry;
  const [offers] = useState(() => sponsorOffers(mulberry32(Math.floor(Math.random() * 1e9)), ev));
  const prizeNames = ['Champion', 'Runner-up', 'Semi-final', 'Quarter-final', 'Earlier'];
  return (
    <div class="scroll" style={{ maxHeight: '78vh' }}>
      <div class="display" style={{ fontSize: '24px' }}>
        {ev.name}
      </div>
      <div class="muted small" style={{ margin: '4px 0 10px' }}>
        {ev.blurb}
      </div>
      <div class="hazards">
        {hazardsOf(ar).map(([icon, label]) => (
          <span class="hz" key={label}>
            <Icon name={icon} size={12} /> {label}
          </span>
        ))}
      </div>
      <div class="section-title">Prizes</div>
      <div class="card" style={{ padding: '4px 14px' }}>
        {ev.prizes.map((p, i) => (
          <div class="kv" key={i}>
            <span>{prizeNames[i]}</span>
            <b style={{ color: i === 0 ? 'var(--gold)' : 'var(--text)' }}>{fmtMoney(p)}</b>
          </div>
        ))}
        <div class="kv">
          <span>Every fight won</span>
          <b>+{fmtMoney(ev.winBonus)}</b>
        </div>
      </div>
      <div class="section-title">Sponsor</div>
      <div class="list">
        {offers.map((s, i) => (
          <button key={s.id} class={`card tap ${sponsorIdx === i ? 'sel' : ''}`} style={{ textAlign: 'left', padding: '10px 12px' }} onClick={() => { sfx.click(); setSponsorIdx(i); }}>
            <div class="row">
              <div class="grow">
                <div style={{ fontWeight: 700 }}>{s.name}</div>
                <div class="small muted">
                  {fmtMoney(s.amount)} {s.goal}
                </div>
              </div>
              {sponsorIdx === i && <Icon name="check" style={{ color: 'var(--accent)' }} />}
            </div>
          </button>
        ))}
      </div>
      <div class="section-title">Your robot</div>
      {c.bots.length > 1 && (
        <div class="row" style={{ gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {c.bots.map((b) => (
            <button key={b.id} class={`badge ${b.id === botId ? 'cyan' : ''}`} style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => { sfx.click(); setBotId(b.id); }}>
              {b.name}
            </button>
          ))}
        </div>
      )}
      <div class="card row">
        <BotThumb d={bot} corner="blue" w={92} h={69} />
        <div class="grow">
          <div class="display" style={{ fontSize: '16px' }}>
            {bot.name}
          </div>
          <div class="small muted">{r.label}</div>
          <div class="small" style={{ marginTop: '4px' }}>
            <span class={r.weight > WEIGHT_LIMIT ? 'down' : ''}>{r.weight.toFixed(1)} kg</span> · {r.draw.toFixed(1)}/{r.output.toFixed(1)} kW
          </div>
        </div>
      </div>
      {!legal && (
        <div class="issue" style={{ marginTop: '8px' }}>
          <Icon name="info" size={16} /> This robot is not legal yet: fix it in the garage.
        </div>
      )}
      <div style={{ height: '14px' }} />
      {busy ? (
        <Btn wide onClick={() => { closeSheet(); go('tournament'); }}>
          Finish your current event first
        </Btn>
      ) : (
        <Btn
          kind="primary"
          size="big"
          wide
          shine
          sound="select"
          disabled={!legal || !afford}
          onClick={() => {
            update((cc) => {
              cc.money -= ev.entry;
              const t = createTournament(cc, ev.id, botId, levels(cc));
              t.offers = offers;
              t.sponsor = offers[sponsorIdx] ?? null;
              cc.tournament = t;
              cc.active = botId;
            });
            closeSheet();
            sfx.fanfare();
            go('tournament');
            emit();
          }}
        >
          {afford ? `Enter${ev.entry ? ` · ${fmtMoney(ev.entry)}` : ''}` : `Need ${fmtMoney(ev.entry)}`}
        </Btn>
      )}
    </div>
  );
}
