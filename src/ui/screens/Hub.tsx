import { activeBot, damageOf, worldRank } from '../../career/career.ts';
import { RIVALS, flag } from '../../career/names.ts';
import { currentStageName, nextPlayerMatch, opponentOf } from '../../career/tournament.ts';
import { EVENTS, TIERS, eventOf, tierOf } from '../../data/events.ts';
import { ALL_PARTS } from '../../data/parts.ts';
import { readout, validate } from '../../sim/stats.ts';
import { levels } from '../../career/career.ts';
import { BotThumb, Btn, Money, Stat, TabBar, Tip, fmtMoney } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { go, useApp } from '../store.ts';

export function Hub() {
  const a = useApp();
  const c = a.career!;
  const bot = activeBot(c);
  const r = readout(bot, levels(c));
  const issues = validate(bot, levels(c)).filter((i) => i.level === 'error');
  const t = c.tournament;
  const ev = t ? eventOf(t.event) : null;
  const next = t ? nextPlayerMatch(t) : null;
  const tier = tierOf(c.tier);
  // suggest the best event at the current licence
  const suggest = EVENTS.filter((e) => e.tier === c.tier).sort((x, y) => x.entry - y.entry)[0] ?? EVENTS[0];
  const newParts = ALL_PARTS.filter((p) => p.tier === c.tier && !c.owned[p.id]).length;
  const rivalsMet = RIVALS.filter((rv) => c.rivals[rv.id]);
  const dmg = damageOf(c.wear[bot.id]);

  return (
    <div class="screen">
      <div class="topbar">
        <div class="team-head grow">
          <div class="crest">{c.team.slice(0, 1).toUpperCase()}</div>
          <div class="grow" style={{ minWidth: 0 }}>
            <div class="display ellipsis" style={{ fontSize: '19px' }}>
              {c.team} {flag(c.country)}
            </div>
            <div class="sub" style={{ fontSize: '11.5px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Season {c.season} · {tier.name}
            </div>
          </div>
        </div>
        <Money />
      </div>
      <div class="scroll">
        <Tip id="welcome">
          Your robot weighs in at up to 100 kg and runs off one power core. Every part costs weight, and every powered part draws on the core, its brain included. You build it and give it a battle plan; it does the fighting, all the way up the circuit to the World Cup.
        </Tip>
        <div class="kpis">
          <div class="kpi">
            <div class="label">World rank</div>
            <b>#{worldRank(c.fame)}</b>
          </div>
          <div class="kpi">
            <div class="label">Record</div>
            <b>
              {c.records.wins}–{c.records.fights - c.records.wins}
            </b>
          </div>
          <div class="kpi">
            <div class="label">Titles</div>
            <b>{c.records.titles}</b>
          </div>
        </div>
        <div class="card" style={{ marginTop: '10px', padding: '12px 14px' }}>
          <div class="row">
            <div class="label grow">Licence: {tier.short}</div>
            <span class="small muted">{c.tier < 5 ? `Next: ${tier.goal}` : c.champion ? `World champion ×${c.champion}` : 'Win the World Cup'}</span>
          </div>
          <div class="licence">
            {TIERS.map((td) => (
              <i key={td.tier} class={td.tier <= c.tier ? 'on' : ''} style={td.tier <= c.tier ? { background: td.color, boxShadow: `0 0 8px ${td.color}` } : {}} />
            ))}
          </div>
        </div>

        {t && ev ? (
          <div class="card hero" style={{ marginTop: '12px' }}>
            <div class="corner" />
            <div class="label" style={{ color: 'var(--accent)' }}>
              In progress
            </div>
            <div class="display" style={{ fontSize: '21px', margin: '2px 0 4px' }}>
              {ev.name}
            </div>
            <div class="small muted">
              {t.phase === 'done' ? 'Finished: collect your prize' : currentStageName(t)}
              {next ? ` · vs ${opponentOf(t, next).bot.name}` : ''}
            </div>
            <div style={{ height: '12px' }} />
            <Btn kind="primary" wide shine sound="select" onClick={() => go('tournament')}>
              <Icon name="play" size={18} /> {t.phase === 'done' ? 'Results' : 'Continue'}
            </Btn>
          </div>
        ) : (
          <div class="card hero" style={{ marginTop: '12px' }}>
            <div class="corner" />
            <div class="label" style={{ color: 'var(--accent)' }}>
              Next up
            </div>
            <div class="display" style={{ fontSize: '21px', margin: '2px 0 4px' }}>
              {suggest.name}
            </div>
            <div class="small muted">
              {suggest.blurb} First prize {fmtMoney(suggest.prizes[0])}.
            </div>
            <div style={{ height: '12px' }} />
            <Btn kind="primary" wide shine sound="select" onClick={() => go('events')}>
              <Icon name="events" size={18} /> Find an event
            </Btn>
          </div>
        )}

        <div class="section-title">Your robot</div>
        <button class="card tap" style={{ width: '100%', textAlign: 'left' }} onClick={() => go('garage')}>
          <div class="row" style={{ alignItems: 'flex-start' }}>
            <BotThumb d={bot} corner="blue" w={108} h={81} />
            <div class="grow col" style={{ gap: '4px' }}>
              <div class="display" style={{ fontSize: '18px' }}>
                {bot.name}
              </div>
              <div class="small muted">{r.label}</div>
              <div class="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
                <span class={`badge ${r.weight > 100 ? 'bad' : 'gold'}`}>{r.weight.toFixed(1)} kg</span>
                <span class={`badge ${r.draw > r.output + 1e-6 ? 'bad' : 'cyan'}`}>
                  {r.draw.toFixed(1)}/{r.output.toFixed(1)} kW
                </span>
                <span class="badge">
                  <Icon name="brain" size={11} /> {r.brain}
                </span>
                {dmg > 0.01 && <span class="badge bad">{Math.round(dmg * 100)}% damaged</span>}
              </div>
            </div>
            <Icon name="next" style={{ color: 'var(--dim)' }} />
          </div>
          <div class="col" style={{ gap: '4px', marginTop: '10px' }}>
            <Stat icon="speed" label="Top speed" value={r.topSpeed * 3.6} max={25} unit=" km/h" fmt={(v) => v.toFixed(0)} />
            <Stat icon="heart" label="Hit points" value={r.hp} max={2000} fmt={(v) => v.toFixed(0)} color="green" />
            <Stat icon="target" label="Hit damage" value={r.hitDamage} max={250} fmt={(v) => v.toFixed(0)} color="red" />
          </div>
          {issues.length > 0 && (
            <div class="issue" style={{ marginTop: '10px' }}>
              <Icon name="info" size={16} /> {issues[0].text}
            </div>
          )}
        </button>

        <div class="section-title">Workshop</div>
        <div class="row">
          <button class="card tap grow" style={{ textAlign: 'left' }} onClick={() => go('shop')}>
            <Icon name="shop" style={{ color: 'var(--accent)' }} />
            <div class="display" style={{ fontSize: '15px', marginTop: '6px' }}>
              Parts shop
            </div>
            <div class="small muted">{newParts > 0 ? `${newParts} new parts at your tier` : 'Upgrade what you own'}</div>
          </button>
          <button class="card tap grow" style={{ textAlign: 'left' }} onClick={() => go('team')}>
            <Icon name="trophy" style={{ color: 'var(--gold)' }} />
            <div class="display" style={{ fontSize: '15px', marginTop: '6px' }}>
              Trophy room
            </div>
            <div class="small muted">
              {c.trophies.length} {c.trophies.length === 1 ? 'trophy' : 'trophies'} · crew level {c.crew}
            </div>
          </button>
        </div>

        {rivalsMet.length > 0 && (
          <>
            <div class="section-title">Rivals</div>
            <div class="card" style={{ padding: '6px 14px' }}>
              {rivalsMet.map((rv) => (
                <div class="kv" key={rv.id}>
                  <span>
                    {flag(rv.country)} {rv.bot} <span class="muted small">· {rv.team}</span>
                  </span>
                  <b class={c.rivals[rv.id].w >= c.rivals[rv.id].l ? 'up' : 'down'}>
                    {c.rivals[rv.id].w}–{c.rivals[rv.id].l}
                  </b>
                </div>
              ))}
            </div>
          </>
        )}
        <div style={{ height: '10px' }} />
        <Btn kind="ghost" size="sm" wide onClick={() => go('title')}>
          Main menu
        </Btn>
      </div>
      <TabBar dots={{ shop: newParts > 0 }} />
    </div>
  );
}
