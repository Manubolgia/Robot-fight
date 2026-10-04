import { useEffect } from 'preact/hooks';
import { damageOf } from '../../career/career.ts';
import { flag } from '../../career/names.ts';
import { sfx } from '../../audio/sfx.ts';
import { BotThumb, Btn, fmtMoney } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { app, go, useApp } from '../store.ts';
import type { FightOutcome, FightSetup } from './Fight.tsx';

export function Results() {
  useApp();
  const o = app.params.outcome as FightOutcome | undefined;
  useEffect(() => {
    if (!o) return;
    if (o.result.winner === 0) sfx.fanfare();
    else sfx.sad();
  }, []);
  if (!o) {
    queueMicrotask(() => go(app.career ? 'hub' : 'title'));
    return null;
  }
  const r = o.result;
  const won = r.winner === 0;
  const me = r.stats[0];
  const them = r.stats[1];
  const how =
    r.method === 'decision'
      ? `${r.judges && (r.judges.votes[0] === 3 || r.judges.votes[1] === 3) ? 'Unanimous' : 'Split'} decision, ${Math.max(...(r.judges?.votes ?? [2, 1]))}–${Math.min(...(r.judges?.votes ?? [2, 1]))}`
      : r.method === 'pit'
        ? `Into the pit at ${r.time.toFixed(1)}s`
        : r.method === 'countout'
          ? `Count-out at ${r.time.toFixed(1)}s`
          : r.method === 'forfeit'
            ? 'Forfeit'
            : `Knockout at ${r.time.toFixed(1)}s`;
  const total = o.payouts.reduce((s, [, v]) => s + v, 0);
  const c = app.career;
  const wearDmg = o.mode === 'career' && c?.tournament ? damageOf(c.wear[c.tournament.botId]) : 0;
  const t = c?.tournament;
  const out = t && (t.out || t.phase === 'done');

  return (
    <div class="screen">
      <div class="scroll pad-bottom" style={{ paddingTop: '10px' }}>
        <div class="label center">{o.title}</div>
        <div class="result-hero">
          <div class={`big ${won ? 'win' : 'lose'}`}>{won ? 'VICTORY' : 'DEFEAT'}</div>
          <div class="muted" style={{ marginTop: '8px' }}>
            {how}
          </div>
        </div>
        <div class="vs-card" style={{ margin: '8px 0 14px' }}>
          <div class="side">
            <BotThumb d={o.me} corner="blue" w={110} h={82} />
            <b class="ellipsis" style={{ maxWidth: '100%', color: won ? 'var(--gold)' : 'var(--text)' }}>
              {won && <Icon name="crown" size={14} />} {o.me.name}
            </b>
          </div>
          <div class="vs" style={{ fontSize: '20px' }}>
            VS
          </div>
          <div class="side">
            <BotThumb d={o.op.bot} corner="red" w={110} h={82} />
            <b class="ellipsis" style={{ maxWidth: '100%', color: !won ? 'var(--gold)' : 'var(--text)' }}>
              {flag(o.op.country)} {o.op.bot.name}
            </b>
          </div>
        </div>
        <div class="statgrid">
          <div class="cell">
            <div class="label">Damage dealt</div>
            <b>{Math.round(me.dmgDealt)}</b>
          </div>
          <div class="cell">
            <div class="label">Damage taken</div>
            <b>{Math.round(them.dmgDealt)}</b>
          </div>
          <div class="cell">
            <div class="label">Biggest hit</div>
            <b>{Math.round(me.biggestHit)}</b>
          </div>
          <div class="cell">
            <div class="label">Hits landed</div>
            <b>{me.hits}</b>
          </div>
          <div class="cell">
            <div class="label">Robots thrown</div>
            <b>{me.flips}</b>
          </div>
          <div class="cell">
            <div class="label">Control</div>
            <b>
              {Math.round((me.control / Math.max(1, me.control + them.control)) * 100)}%
            </b>
          </div>
        </div>

        {o.mode === 'career' && (
          <>
            <div class="section-title">Pay day</div>
            <div class="card" style={{ padding: '6px 14px' }}>
              {o.payouts.length ? (
                o.payouts.map(([k, v]) => (
                  <div class="payout" key={k}>
                    <span>{k}</span>
                    <b>+{fmtMoney(v)}</b>
                  </div>
                ))
              ) : (
                <div class="payout">
                  <span class="muted">No bonus this time</span>
                  <b>$0</b>
                </div>
              )}
              <div class="payout">
                <span>Fame</span>
                <b style={{ color: 'var(--cyan)' }}>+{o.fame}</b>
              </div>
              {total > 0 && (
                <div class="payout">
                  <span>
                    <b style={{ color: 'var(--text)' }}>Total</b>
                  </span>
                  <b>+{fmtMoney(total)}</b>
                </div>
              )}
            </div>
            {wearDmg > 0.01 && !out && (
              <div class="small muted" style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
                <Icon name="wrench" size={16} /> {o.me.name} is {Math.round(wearDmg * 100)}% damaged. The pit crew patches it before the next fight; a full repair costs money.
              </div>
            )}
          </>
        )}
        <div style={{ height: '18px' }} />
        {o.mode === 'career' ? (
          <Btn kind="primary" size="big" wide shine sound="select" onClick={() => go(app.career?.tournament ? 'tournament' : 'hub')}>
            {out ? 'See the final standings' : 'Continue'}
          </Btn>
        ) : (
          <div class="col">
            <Btn kind="primary" size="big" wide shine sound="select" onClick={() => go('fight', { mode: 'quick', setup: quickAgain(o) })}>
              Rematch
            </Btn>
            <Btn wide onClick={() => go('quick')}>
              New quick fight
            </Btn>
            <Btn kind="ghost" wide onClick={() => go(app.career ? 'hub' : 'title')}>
              Done
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function quickAgain(o: FightOutcome): FightSetup {
  return { mode: 'quick', me: o.me, op: { ...o.op, wear: { hp: 1, armor: { front: 1, left: 1, right: 1, rear: 1, top: 1 }, comp: { drive: 1, front: 1, top: 1, core: 1 }, shield: 1 } }, arena: o.arena, levels: app.career ? (id: string) => app.career!.owned[id] ?? 1 : () => 1, title: o.title };
}
