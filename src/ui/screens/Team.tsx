import { CREW_COST, CREW_PCT, crewUpgrade, worldRank } from '../../career/career.ts';
import { RIVALS, flag } from '../../career/names.ts';
import { EVENTS, tierOf } from '../../data/events.ts';
import { sfx } from '../../audio/sfx.ts';
import { Btn, Pips, TabBar, TopBar, fmtMoney } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { go, toast, update, useApp } from '../store.ts';

export function TrophyIcon({ tier, size = 64 }: { tier: number; size?: number }) {
  const col = tierOf(tier).color;
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 64 70" aria-hidden="true">
      <defs>
        <linearGradient id={`tg${tier}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff" />
          <stop offset="0.35" stop-color={col} />
          <stop offset="1" stop-color="#3a2a00" />
        </linearGradient>
      </defs>
      <path d="M18 6h28v14c0 9-6 16-14 16S18 29 18 20V6Z" fill={`url(#tg${tier})`} stroke="#000" stroke-opacity=".35" />
      <path d="M18 10H8c0 9 5 14 12 14M46 10h10c0 9-5 14-12 14" fill="none" stroke={col} stroke-width="3.5" />
      <rect x="29" y="36" width="6" height="12" fill={col} />
      <rect x="20" y="48" width="24" height="6" rx="2" fill={col} />
      <rect x="15" y="54" width="34" height="9" rx="2" fill="#2a2f3a" stroke={col} stroke-opacity=".6" />
      <path d="M33 13 27 23h5l-1 7 6-10h-5l1-7Z" fill="#fff" fill-opacity=".85" />
    </svg>
  );
}

export function Team() {
  const a = useApp();
  const c = a.career!;
  const r = c.records;
  const next = c.crew < 5 ? CREW_COST[c.crew + 1] : 0;
  const titleEvents = EVENTS;
  return (
    <div class="screen">
      <TopBar title={c.team} sub={`World rank #${worldRank(c.fame)} · ${c.fame} fame`} right={<button class="iconbtn" aria-label="Settings" onClick={() => { sfx.click(); go('settings', { from: 'team' }); }}><Icon name="settings" /></button>} />
      <div class="scroll">
        <div class="section-title">Trophy room</div>
        <div class="cabinet">
          {titleEvents.map((ev) => {
            const won = c.trophies.filter((t) => t.event === ev.id);
            return (
              <div key={ev.id} class={`item ${won.length ? '' : 'empty'}`}>
                <TrophyIcon tier={ev.tier} size={48} />
                <div style={{ fontWeight: 700, marginTop: '4px', lineHeight: 1.15 }}>{ev.name}</div>
                <div class="muted">{won.length ? `×${won.length}` : 'not yet'}</div>
              </div>
            );
          })}
        </div>
        {c.champion > 0 && (
          <div class="card hero center" style={{ marginTop: '10px' }}>
            <Icon name="crown" size={30} style={{ color: 'var(--gold)' }} />
            <div class="display" style={{ fontSize: '20px', color: 'var(--gold)' }}>
              World champions ×{c.champion}
            </div>
          </div>
        )}

        <div class="section-title">Pit crew</div>
        <div class="card">
          <div class="row">
            <Icon name="wrench" style={{ color: 'var(--accent)' }} />
            <div class="grow">
              <b>Level {c.crew}</b>
              <div class="small muted">Repairs {Math.round(CREW_PCT[c.crew] * 100)}% of the damage between fights, free.</div>
            </div>
          </div>
          <div style={{ margin: '10px 0' }}>
            <Pips n={c.crew} max={5} />
          </div>
          {c.crew < 5 ? (
            <Btn
              size="sm"
              kind="cyan"
              wide
              sound="none"
              disabled={c.money < next}
              onClick={() => {
                let ok = false;
                update((cc) => (ok = crewUpgrade(cc)));
                if (ok) {
                  sfx.levelUp();
                  toast(`Crew level ${c.crew}: repairs ${Math.round(CREW_PCT[c.crew] * 100)}%`, 'good');
                }
              }}
            >
              Hire and train · {fmtMoney(next)} → {Math.round(CREW_PCT[c.crew + 1] * 100)}%
            </Btn>
          ) : (
            <div class="small" style={{ color: 'var(--green)' }}>
              The best crew on the circuit.
            </div>
          )}
        </div>

        <div class="section-title">Records</div>
        <div class="statgrid">
          <div class="cell">
            <div class="label">Fights</div>
            <b>
              {r.wins}–{r.fights - r.wins}
            </b>
          </div>
          <div class="cell">
            <div class="label">Knockouts</div>
            <b>{r.kos}</b>
          </div>
          <div class="cell">
            <div class="label">Robots thrown</div>
            <b>{r.flips}</b>
          </div>
          <div class="cell">
            <div class="label">Into the pit</div>
            <b>{r.pits}</b>
          </div>
          <div class="cell">
            <div class="label">Biggest hit</div>
            <b>{Math.round(r.biggestHit)}</b>
          </div>
          <div class="cell">
            <div class="label">Fastest KO</div>
            <b>{r.fastestKO ? `${r.fastestKO.toFixed(1)}s` : '—'}</b>
          </div>
          <div class="cell">
            <div class="label">Damage dealt</div>
            <b>{Math.round(r.damage).toLocaleString('en-US')}</b>
          </div>
          <div class="cell">
            <div class="label">Titles</div>
            <b>{r.titles}</b>
          </div>
        </div>

        <div class="section-title">Rivals</div>
        <div class="card" style={{ padding: '4px 14px' }}>
          {RIVALS.map((rv) => {
            const rec = c.rivals[rv.id];
            return (
              <div class="kv" key={rv.id}>
                <span>
                  {flag(rv.country)} <b>{rv.bot}</b> <span class="small muted">· {rv.driver}</span>
                </span>
                <span class={rec ? (rec.w >= rec.l ? 'up' : 'down') : 'muted'}>{rec ? `${rec.w}–${rec.l}` : rv.from > c.tier ? `tier ${rv.from}` : 'not met'}</span>
              </div>
            );
          })}
        </div>

        {c.history.length > 0 && (
          <>
            <div class="section-title">History</div>
            <div class="card" style={{ padding: '4px 14px' }}>
              {c.history.slice(0, 12).map((h, i) => (
                <div class="kv" key={i}>
                  <span>
                    {h.name} <span class="small muted">· S{h.season} · {h.bot}</span>
                  </span>
                  <b class={h.place === 1 ? 'up' : ''}>{h.place === 1 ? '🏆 1st' : `${h.place}${h.place === 2 ? 'nd' : h.place === 3 ? 'rd' : 'th'}`}</b>
                </div>
              ))}
            </div>
          </>
        )}
        <div style={{ height: '12px' }} />
      </div>
      <TabBar />
    </div>
  );
}
