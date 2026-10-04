import { useState } from 'preact/hooks';
import { closeTournament } from '../../career/career.ts';
import { RIVALS, flag } from '../../career/names.ts';
import { PLAYER, bracketView, champion, currentStageName, entrant, nextPlayerMatch, opponentOf, prizeFor, standings, withdraw, type Match, type Tournament as T } from '../../career/tournament.ts';
import { arenaOf } from '../../data/arenas.ts';
import { eventOf, tierOf } from '../../data/events.ts';
import { readout } from '../../sim/stats.ts';
import { sfx } from '../../audio/sfx.ts';
import { BotThumb, Btn, TopBar, confirm, fmtMoney } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { app, closeModal, go, openModal, update, useApp } from '../store.ts';
import { hazardsOf } from './Events.tsx';
import { TrophyIcon } from './Team.tsx';

const how = (m: Match) => (m.method === 'decision' ? 'JD' : m.method === 'pit' ? 'PIT' : m.method === 'countout' ? 'CO' : m.method === 'forfeit' ? 'FF' : 'KO');

function MatchCard({ t, m, next }: { t: T; m: Match | null; next?: boolean }) {
  if (!m) {
    return (
      <div class="mcard">
        <div class="e muted">—</div>
        <div class="e muted">—</div>
      </div>
    );
  }
  const row = (id: string) => {
    const e = entrant(t, id);
    const state = m.winner ? (m.winner === id ? 'win' : 'lose') : '';
    return (
      <div class={`e ${state} ${id === PLAYER ? 'you' : ''}`}>
        <span>{flag(e.country)}</span>
        <span class="ellipsis grow">{e.bot.name}</span>
        {m.winner === id && <span class="how">{how(m)}</span>}
      </div>
    );
  };
  return (
    <div class={`mcard ${next ? 'next' : ''}`}>
      {row(m.a)}
      {row(m.b)}
    </div>
  );
}

export function Tournament() {
  const a = useApp();
  const c = a.career!;
  const t = c.tournament;
  if (!t) {
    queueMicrotask(() => go('hub'));
    return null;
  }
  const ev = eventOf(t.event)!;
  const ar = arenaOf(ev.arena);
  const next = nextPlayerMatch(t);
  const done = t.phase === 'done';
  return (
    <div class="screen">
      <TopBar title={ev.name} sub={done ? 'Final results' : currentStageName(t)} back="hub" />
      <div class="scroll pad-bottom">
        {done ? <Finished t={t} /> : next ? <NextFight t={t} m={next} /> : null}

        {t.news.length > 0 && !done && (
          <>
            <div class="section-title">Around the arena</div>
            <div class="card" style={{ padding: '4px 14px' }}>
              {t.news.slice(0, 6).map((n, i) => (
                <div class="kv small" key={i}>
                  <span>{n}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {t.groups && (
          <>
            <div class="section-title">Groups</div>
            <div class="list">
              {[...t.groups]
                .sort((x, y) => Number(y.ids.includes(PLAYER)) - Number(x.ids.includes(PLAYER)))
                .map((g) => (
                  <div class="card" key={g.name} style={{ padding: '10px 12px' }}>
                    <div class="label" style={{ marginBottom: '4px' }}>
                      Group {g.name}
                    </div>
                    <table class="standings">
                      <thead>
                        <tr>
                          <th>Robot</th>
                          <th>W</th>
                          <th>L</th>
                          <th>Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings(t, g).map((r, i) => {
                          const e = entrant(t, r.id);
                          return (
                            <tr key={r.id} class={`${r.id === PLAYER ? 'you' : ''} ${i < 2 && t.phase !== 'groups' ? 'through' : ''}`}>
                              <td>
                                {flag(e.country)} {e.bot.name}
                                {e.rival && <span class="badge" style={{ marginLeft: '6px' }}>rival</span>}
                              </td>
                              <td>{r.w}</td>
                              <td>{r.l}</td>
                              <td>
                                <b>{r.pts}</b>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
            </div>
          </>
        )}

        <div class="section-title">{t.phase === 'groups' ? 'Knockouts' : 'Bracket'}</div>
        <div class="bracket">
          {bracketView(t).map((r) => (
            <div class="round" key={r.name}>
              <h4>{r.name}</h4>
              {r.matches.map((m, i) => (
                <MatchCard key={i} t={t} m={m} next={!!m && m === next} />
              ))}
            </div>
          ))}
        </div>

        <div class="section-title">Arena</div>
        <div class="card">
          <div class="display" style={{ fontSize: '16px' }}>
            {ar.name}
          </div>
          <div class="small muted" style={{ margin: '4px 0 8px' }}>
            {ar.blurb}
          </div>
          <div class="hazards">
            {hazardsOf(ar).map(([icon, label]) => (
              <span class="hz" key={label}>
                <Icon name={icon} size={12} /> {label}
              </span>
            ))}
          </div>
        </div>
        {t.sponsor && (
          <div class="card" style={{ marginTop: '10px' }}>
            <div class="row">
              <Icon name="coin" style={{ color: 'var(--gold)' }} />
              <div class="grow">
                <b>{t.sponsor.name}</b>
                <div class="small muted">
                  {fmtMoney(t.sponsor.amount)} {t.sponsor.goal}
                </div>
              </div>
              <b style={{ color: 'var(--gold)' }}>{fmtMoney(t.sponsorEarned)}</b>
            </div>
          </div>
        )}
        {!done && (
          <>
            <div style={{ height: '16px' }} />
            <Btn
              kind="ghost"
              size="sm"
              wide
              onClick={() =>
                confirm('Withdraw?', 'You forfeit every remaining fight. Prize money is paid for how far you got.', 'Withdraw', () => {
                  update((cc) => withdraw(cc.tournament!));
                }, true)
              }
            >
              Withdraw from the event
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

function NextFight({ t, m }: { t: T; m: Match }) {
  const c = app.career!;
  const op = opponentOf(t, m);
  const me = c.bots.find((b) => b.id === t.botId)!;
  const rv = op.rival ? RIVALS.find((r) => r.id === op.rival) : null;
  const ro = readout(op.bot);
  return (
    <div class="card hero">
      <div class="corner" />
      <div class="label center" style={{ color: 'var(--accent)', marginBottom: '8px' }}>
        {m.stage}
      </div>
      <div class="vs-card">
        <div class="side">
          <BotThumb d={me} corner="blue" w={120} h={90} />
          <b class="ellipsis" style={{ maxWidth: '100%' }}>
            {me.name}
          </b>
          <span class="tiny muted">{c.team}</span>
        </div>
        <div class="vs">VS</div>
        <div class="side">
          <BotThumb d={op.bot} corner="red" w={120} h={90} />
          <b class="ellipsis" style={{ maxWidth: '100%' }}>
            {flag(op.country)} {op.bot.name}
          </b>
          <span class="tiny muted">{rv ? `Rival · ${rv.team}` : ro.label}</span>
        </div>
      </div>
      {rv && (
        <div class="small center" style={{ margin: '10px 0 0', fontStyle: 'italic', color: '#ffd9d6' }}>
          “{rv.taunt}” — {rv.driver}
        </div>
      )}
      <div style={{ height: '12px' }} />
      <Btn kind="primary" size="big" wide shine sound="select" onClick={() => go('prefight')}>
        <Icon name="wrench" size={18} /> Pit stop & scout
      </Btn>
    </div>
  );
}

function Finished({ t }: { t: T }) {
  const ev = eventOf(t.event)!;
  const prize = prizeFor(t);
  const champ = champion(t);
  const won = t.place === 1;
  const finalBonus = t.sponsor?.kind === 'final' && (t.place ?? 99) <= 2 ? t.sponsor.amount : 0;
  const [busy, setBusy] = useState(false);
  const placeText = t.place === 1 ? 'Champions!' : t.place === 2 ? 'Runners-up' : t.place && t.place <= 4 ? 'Semi-finalists' : t.place && t.place <= 8 ? 'Quarter-finalists' : 'Knocked out';
  return (
    <div class="card hero center">
      <div class="corner" />
      {won ? (
        <div style={{ position: 'relative', margin: '6px 0 4px' }}>
          <div class="rays" />
          <div class="trophy">
            <TrophyIcon tier={ev.tier} size={120} />
          </div>
        </div>
      ) : (
        <Icon name="flag" size={40} style={{ color: 'var(--muted)', margin: '8px 0' }} />
      )}
      <div class="display" style={{ fontSize: '28px', color: won ? 'var(--gold)' : 'var(--text)' }}>
        {placeText}
      </div>
      <div class="small muted" style={{ margin: '4px 0 12px' }}>
        {champ && !won ? `${champ.bot.name} (${champ.team}) won the ${ev.name}.` : won ? `${ev.name} · Season ${t.season}` : ''}
      </div>
      <div class="card" style={{ textAlign: 'left', padding: '6px 14px', background: 'rgba(0,0,0,0.25)' }}>
        <div class="payout">
          <span>Prize money</span>
          <b>{fmtMoney(prize)}</b>
        </div>
        {finalBonus > 0 && (
          <div class="payout">
            <span>{t.sponsor!.name}: final bonus</span>
            <b>{fmtMoney(finalBonus)}</b>
          </div>
        )}
        <div class="payout">
          <span>Already earned this event</span>
          <b>{fmtMoney(t.earned + t.sponsorEarned)}</b>
        </div>
      </div>
      <div style={{ height: '14px' }} />
      <Btn
        kind="primary"
        size="big"
        wide
        shine
        disabled={busy}
        sound="none"
        onClick={() => {
          setBusy(true);
          let res = { newTier: false, champion: false };
          const tierName = tierOf(Math.min(5, app.career!.tier + 1)).name;
          update((cc) => {
            const tt = cc.tournament!;
            const bot = cc.bots.find((b) => b.id === tt.botId);
            cc.money += prize + finalBonus;
            cc.fame += Math.round(ev.fame * (tt.place === 1 ? 1 : tt.place === 2 ? 0.5 : tt.place! <= 4 ? 0.3 : 0.12));
            res = closeTournament(cc, ev.id, ev.name, ev.tier, tt.place ?? 9, prize + finalBonus + tt.earned + tt.sponsorEarned, bot?.name ?? '');
            cc.tournament = null;
          });
          if (won) sfx.fanfare();
          else sfx.buy();
          if (res.champion) {
            openModal(() => (
              <div class="col center" style={{ gap: '12px' }}>
                <Icon name="crown" size={44} style={{ color: 'var(--gold)', margin: '0 auto' }} />
                <div class="display" style={{ fontSize: '26px', color: 'var(--gold)' }}>
                  World champions!
                </div>
                <div class="muted">You are the best robot team on the planet. A new season begins: every team comes back stronger, and the prize money grows.</div>
                <Btn kind="primary" wide onClick={() => { closeModal(); go('hub'); }}>
                  Onwards
                </Btn>
              </div>
            ));
          } else if (res.newTier) {
            sfx.levelUp();
            openModal(() => (
              <div class="col center" style={{ gap: '12px' }}>
                <Icon name="star" size={40} style={{ color: 'var(--gold)', margin: '0 auto' }} />
                <div class="display" style={{ fontSize: '24px' }}>
                  Licence earned
                </div>
                <div class="muted">
                  Welcome to the <b style={{ color: 'var(--text)' }}>{tierName}</b>. New events, new parts in the shop, and higher upgrade marks in the workshop.
                </div>
                <Btn kind="primary" wide onClick={() => { closeModal(); go('events'); }}>
                  See the events
                </Btn>
              </div>
            ));
          }
          go('hub');
        }}
      >
        Collect {fmtMoney(prize + finalBonus)}
      </Btn>
      <div class="tiny muted" style={{ marginTop: '8px' }}>
        Your robots are fully repaired between events.
      </div>
    </div>
  );
}
