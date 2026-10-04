// Shared UI pieces.

import type { ComponentChildren, CSSProperties } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '../audio/sfx.ts';
import type { BotDesign } from '../data/types.ts';
import { thumb } from '../render/thumbs.ts';
import { Icon } from './icons.tsx';
import { app, buzz, closeModal, closeSheet, emit, go, update, useApp, type Screen } from './store.ts';

export function Btn(props: {
  children: ComponentChildren;
  onClick?: () => void;
  kind?: 'primary' | 'cyan' | 'danger' | 'ghost' | '';
  size?: 'big' | 'sm' | 'xs' | '';
  wide?: boolean;
  disabled?: boolean;
  shine?: boolean;
  sound?: 'click' | 'select' | 'none';
  class?: string;
  style?: CSSProperties;
}) {
  const cls = ['btn', props.kind ?? '', props.size ?? '', props.wide ? 'wide' : '', props.class ?? ''].join(' ');
  return (
    <button
      class={cls}
      style={props.style}
      disabled={props.disabled}
      onClick={() => {
        if (props.disabled) return;
        if (props.sound !== 'none') (props.sound === 'select' ? sfx.select() : sfx.click());
        buzz(8);
        props.onClick?.();
      }}
    >
      {props.shine && <span class="shine" />}
      {props.children}
    </button>
  );
}

export const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function Money({ value }: { value?: number }) {
  const a = useApp();
  const v = value ?? a.career?.money ?? 0;
  const [flash, setFlash] = useState(false);
  const prev = useRef(v);
  useEffect(() => {
    if (prev.current !== v) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      prev.current = v;
      return () => clearTimeout(t);
    }
  }, [v]);
  return (
    <span class={`money ${flash ? 'flash' : ''}`}>
      <Icon name="coin" size={16} />
      {fmtMoney(v).slice(1)}
    </span>
  );
}

export function TierBadge({ tier, label }: { tier: number; label?: string }) {
  return <span class={`badge t${tier}`}>{label ?? `Tier ${tier}`}</span>;
}

export function TopBar({ title, sub, back, right }: { title: ComponentChildren; sub?: ComponentChildren; back?: Screen | (() => void); right?: ComponentChildren }) {
  return (
    <div class="topbar">
      {back && (
        <button
          class="iconbtn"
          aria-label="Back"
          onClick={() => {
            sfx.click();
            if (typeof back === 'function') back();
            else go(back);
          }}
        >
          <Icon name="back" />
        </button>
      )}
      <div class="title">
        {sub && <div class="sub">{sub}</div>}
        <h1>{title}</h1>
      </div>
      {right ?? (app.career ? <Money /> : null)}
    </div>
  );
}

const TABS: Array<[Screen, string, string]> = [
  ['hub', 'home', 'Home'],
  ['events', 'events', 'Events'],
  ['garage', 'garage', 'Garage'],
  ['shop', 'shop', 'Shop'],
  ['team', 'team', 'Team'],
];

export function TabBar({ dots = {} }: { dots?: Partial<Record<Screen, boolean>> }) {
  const a = useApp();
  return (
    <nav class="tabbar">
      {TABS.map(([s, icon, label]) => (
        <button
          key={s}
          class={`tab ${a.screen === s ? 'on' : ''}`}
          onClick={() => {
            if (a.screen !== s) {
              sfx.click();
              buzz(6);
              go(s);
            }
          }}
        >
          <Icon name={icon} size={23} />
          {label}
          {dots[s] && <span class="dot" />}
        </button>
      ))}
    </nav>
  );
}

export function Stat({ icon, label, value, max, delta, unit = '', fmt, color }: { icon: string; label: string; value: number; max: number; delta?: number; unit?: string; fmt?: (v: number) => string; color?: string }) {
  const p = Math.max(0, Math.min(1, value / max));
  const d = delta ?? 0;
  const pd = Math.max(0, Math.min(1, (value + d) / max));
  const show = fmt ?? ((v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : v.toFixed(1)));
  return (
    <div class="stat">
      <Icon name={icon} size={16} style={{ color: 'var(--muted)' }} />
      <span class="muted">{label}</span>
      <div class={`bar ${color ?? ''}`}>
        <i style={{ width: `${Math.min(p, pd) * 100}%` }} />
        {Math.abs(d) > 1e-6 && <i class={d > 0 ? 'up' : 'down'} style={{ left: `${Math.min(p, pd) * 100}%`, width: `${Math.abs(pd - p) * 100}%` }} />}
      </div>
      <span class="v">
        {show(value + d)}
        {unit}
        {Math.abs(d) > 1e-6 && <span class={`d ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '▲' : '▼'}</span>}
      </span>
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      class={`toggle ${on ? 'on' : ''}`}
      role="switch"
      aria-checked={on}
      onClick={() => {
        sfx.click();
        onChange(!on);
      }}
    />
  );
}

export function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div class="stepper">
      <button disabled={value <= min} onClick={() => { sfx.click(); onChange(value - 1); }} aria-label="Less">−</button>
      <button disabled={value >= max} onClick={() => { sfx.click(); onChange(value + 1); }} aria-label="More">+</button>
    </div>
  );
}

export function Pips({ n, max, cls }: { n: number; max: number; cls?: string }) {
  return (
    <div class={`pips ${cls ?? ''}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} class={i < n ? 'on' : ''} />
      ))}
    </div>
  );
}

export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span class="row" style={{ gap: '1px', color: 'var(--gold)' }}>
      {Array.from({ length: max }, (_, i) => (
        <Icon key={i} name={i < Math.round(value) ? 'starF' : 'star'} size={13} stroke={1.8} />
      ))}
    </span>
  );
}

export function BotThumb({ d, corner = 'none', w = 88, h = 66 }: { d: BotDesign; corner?: 'blue' | 'red' | 'none'; w?: number; h?: number }) {
  useApp();
  const src = thumb(d, corner);
  return (
    <div class={`thumb ${corner === 'blue' ? 'blue' : corner === 'red' ? 'red' : ''}`} style={{ width: `${w}px`, height: `${h}px` }}>
      {src ? <img src={src} alt="" draggable={false} /> : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--dim)' }}><Icon name="frame" /></div>}
    </div>
  );
}

export function Overlays() {
  const a = useApp();
  return (
    <>
      {a.sheet && (
        <div class="sheet-wrap" onClick={(e) => e.target === e.currentTarget && closeSheet()}>
          <div class="sheet">
            <div class="grab" />
            {a.sheet()}
          </div>
        </div>
      )}
      {a.modal && (
        <div class="modal-wrap">
          <div class="modal">{a.modal()}</div>
        </div>
      )}
      <div class="toast-host">
        {a.toasts.map((t) => (
          <div key={t.id} class={`toast ${t.kind ?? ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}

/** A yes/no question in a modal. */
export function confirm(title: string, body: ComponentChildren, yes: string, onYes: () => void, danger = false) {
  app.modal = () => (
    <div class="col" style={{ gap: '14px' }}>
      <div class="display" style={{ fontSize: '22px' }}>
        {title}
      </div>
      <div class="muted">{body}</div>
      <div class="row">
        <Btn kind="ghost" class="grow" onClick={() => closeModal()}>
          Cancel
        </Btn>
        <Btn
          kind={danger ? 'danger' : 'primary'}
          class="grow"
          onClick={() => {
            closeModal();
            onYes();
          }}
        >
          {yes}
        </Btn>
      </div>
    </div>
  );
  emit();
}

export function Tip({ id, children }: { id: string; children: ComponentChildren }) {
  const a = useApp();
  const c = a.career;
  if (!c || c.seen.includes(id)) return null;
  return (
    <div class="tip" style={{ marginBottom: '12px' }}>
      <Icon name="info" size={18} />
      <div>{children}</div>
      <button
        class="x"
        aria-label="Dismiss"
        onClick={() => {
          update((cc) => cc.seen.push(id));
        }}
      >
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}
