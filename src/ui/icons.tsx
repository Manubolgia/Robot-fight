// Line icons, drawn on a 24 x 24 grid.

import type { CSSProperties, JSX } from 'preact';

const P: Record<string, JSX.Element> = {
  bolt: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" fill="currentColor" stroke="none" />,
  boltO: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />,
  weight: (
    <>
      <path d="M8 8a4 4 0 1 1 8 0" />
      <path d="M5.5 9h13l1.5 11H4L5.5 9Z" />
    </>
  ),
  shield: <path d="M12 2.5 4 5.5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10v-6l-8-3Z" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 3h8v6a4 4 0 0 1-8 0V3Z" />
      <path d="M16 5h3.5a3 3 0 0 1-3.5 4M8 5H4.5A3 3 0 0 0 8 9M12 13v4M8.5 21h7M9.5 17h5" />
    </>
  ),
  wrench: <path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.4L3 17.4 6.6 21l5.7-5.7a4.5 4.5 0 0 0 5.4-6l-3 3-2.8-.7-.7-2.8 3-3Z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 8.8c-.6-.8-1.5-1.2-2.6-1.2-1.6 0-2.7.9-2.7 2.1 0 2.9 5.6 1.5 5.6 4.5 0 1.3-1.2 2.2-2.9 2.2-1.2 0-2.2-.5-2.8-1.3M12 6v1.6M12 16.4V18" />
    </>
  ),
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  back: <path d="M15 5 8 12l7 7" />,
  next: <path d="m9 5 7 7-7 7" />,
  play: <path d="M7 4.5v15l12-7.5L7 4.5Z" fill="currentColor" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
  starF: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" fill="currentColor" />,
  fire: <path d="M12 22c4 0 7-2.8 7-6.8 0-3.7-2.5-5.6-3.6-8.7-.5 1.8-1.5 3-2.6 3.4.3-3.2-1-6.3-3.8-7.9.3 3.2-1.4 5.1-2.9 7C4.8 10.8 5 12.7 5 15.2 5 19.2 8 22 12 22Z" />,
  flip: (
    <>
      <path d="M4 15a8 8 0 0 1 14.5-4.5" />
      <path d="M19 5v5.5h-5.5" />
      <path d="M4 20h16" />
    </>
  ),
  hammer: (
    <>
      <path d="m14 7 3-3 4 4-3 3-4-4Z" />
      <path d="M15.5 9.5 4 21" />
    </>
  ),
  saw: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="m12 2 1.5 3M22 12l-3 1.5M12 22l-1.5-3M2 12l3-1.5M19 5l-2 2.5M19 19l-2.5-2M5 19l2-2.5M5 5l2.5 2" />
    </>
  ),
  spinner: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v4M12 16.5v4M5 12h0" />
      <path d="m15.5 5.5 3 1M5.5 17.5l3 1" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  wedge: <path d="M3 19h18L21 8 3 19Z" />,
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.2 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />,
  speed: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m12 17 4.5-5.5" />
    </>
  ),
  turn: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20 4v4.5h-4.5" />
    </>
  ),
  push: (
    <>
      <path d="M3 12h11M10 7l5 5-5 5" />
      <path d="M19 4v16" />
    </>
  ),
  heat: (
    <>
      <path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0Z" />
      <path d="M12 9v7" />
    </>
  ),
  home: <path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5" />,
  events: (
    <>
      <path d="M4 7h16v4a2 2 0 0 0 0 2v4H4v-4a2 2 0 0 0 0-2V7Z" />
      <path d="M14 7v10" strokeDasharray="2 2" />
    </>
  ),
  garage: (
    <>
      <path d="M3 10 12 4l9 6v10H3V10Z" />
      <path d="M7 20v-6h10v6M7 17h10" />
    </>
  ),
  shop: (
    <>
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V4H4v12h4" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  brush: <path d="M19 3 9 13l2 2L21 5l-2-2ZM9 13c-3 0-4 2-4 4 0 1.5-1 2.5-2 3 3 1 7 .5 8-3l-2-4Z" />,
  chip: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5V9M12 15v5.5M3.5 12H9M15 12h5.5" />
    </>
  ),
  battery: (
    <>
      <rect x="3" y="7" width="16" height="10" rx="2" />
      <path d="M21 10.5v3M7 10v4M10.5 10v4" />
    </>
  ),
  frame: (
    <>
      <path d="M4 8 12 4l8 4v8l-8 4-8-4V8Z" />
      <path d="m4 8 8 4 8-4M12 12v8" />
    </>
  ),
  pause: <path d="M8 5v14M16 5v14" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9S9.5 5.6 12 3Z" />
    </>
  ),
  crown: <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </>
  ),
  claw: <path d="M5 20V10l4-6M19 20V10l-4-6M5 14h14" />,
  ram: <path d="M3 12h12M15 8l6 4-6 4M3 8v8" />,
  library: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="8.5" cy="12" r="2" />
      <circle cx="15.5" cy="12" r="2" />
      <path d="M8.5 14h7" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8v.5M12 17v.5" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
};

export function Icon({ name, size = 22, stroke = 2, class: cls, style }: { name: string; size?: number; stroke?: number; class?: string; style?: CSSProperties }) {
  return (
    <svg
      class={cls}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {P[name] ?? P.info}
    </svg>
  );
}

const WEAPON_ICON: Record<string, string> = {
  vspin: 'spinner', drum: 'spinner', hspin: 'spinner', ring: 'spinner', flipper: 'flip', lifter: 'flip',
  hammer: 'hammer', axe: 'hammer', crusher: 'claw', saw: 'saw', wedge: 'wedge', ram: 'ram', flame: 'fire',
};

export function partIcon(kind: string, type?: string): string {
  if (kind === 'weapon') return WEAPON_ICON[type ?? ''] ?? 'target';
  return { chassis: 'frame', drive: 'wheel', core: 'battery', armor: 'shield', module: 'chip' }[kind] ?? 'gear';
}
