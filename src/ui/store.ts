// App state: the career, which screen is up, settings, toasts and sheets.
// Plain objects plus a change counter; components re-render via useApp().

import { useEffect, useReducer } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { loadCareer, saveCareer, type Career } from '../career/career.ts';

export type Screen =
  | 'title'
  | 'newgame'
  | 'hub'
  | 'events'
  | 'garage'
  | 'shop'
  | 'team'
  | 'tournament'
  | 'prefight'
  | 'fight'
  | 'results'
  | 'settings'
  | 'quick'
  | 'howto';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  quality: 'high' | 'low';
  numbers: boolean;
}

export interface Toast {
  id: number;
  text: string;
  kind?: 'good' | 'bad' | 'gold';
}

const SETTINGS_KEY = 'kilowatt.settings.v1';

function loadSettings(): Settings {
  const d: Settings = { sound: true, haptics: true, quality: 'high', numbers: true };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return d;
  }
}

export const app = {
  career: loadCareer() as Career | null,
  screen: 'title' as Screen,
  params: {} as Record<string, unknown>,
  settings: loadSettings(),
  toasts: [] as Toast[],
  sheet: null as null | (() => ComponentChildren),
  modal: null as null | (() => ComponentChildren),
  tab: 'hub' as Screen,
  version: 0,
};

const listeners = new Set<() => void>();

export function emit() {
  app.version++;
  for (const l of listeners) l();
}

export function useApp() {
  const [, bump] = useReducer((x: number, _: void) => x + 1, 0);
  const force = () => bump(undefined);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  return app;
}

export function go(screen: Screen, params: Record<string, unknown> = {}) {
  app.screen = screen;
  app.params = params;
  app.sheet = null;
  if (['hub', 'events', 'garage', 'shop', 'team'].includes(screen)) app.tab = screen;
  emit();
}

/** Change the career and save it. */
export function update(fn: (c: Career) => void) {
  if (!app.career) return;
  fn(app.career);
  saveCareer(app.career);
  emit();
}

export function setCareer(c: Career | null) {
  app.career = c;
  saveCareer(c);
  emit();
}

export function setSettings(patch: Partial<Settings>) {
  app.settings = { ...app.settings, ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(app.settings));
  } catch {
    // ignore
  }
  emit();
}

let toastId = 0;
export function toast(text: string, kind?: Toast['kind']) {
  const t = { id: ++toastId, text, kind };
  app.toasts = [...app.toasts.slice(-2), t];
  emit();
  setTimeout(() => {
    app.toasts = app.toasts.filter((x) => x.id !== t.id);
    emit();
  }, 2700);
}

export function openSheet(render: () => ComponentChildren) {
  app.sheet = render;
  emit();
}

export function closeSheet() {
  app.sheet = null;
  emit();
}

export function openModal(render: () => ComponentChildren) {
  app.modal = render;
  emit();
}

export function closeModal() {
  app.modal = null;
  emit();
}

export function buzz(ms = 12) {
  if (!app.settings.haptics) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // not supported
  }
}

// ---- the library ------------------------------------------------------------------

export const inLibrary = typeof window !== 'undefined' && window.parent !== window && window.name === 'mnbglibrary';

export function helloLibrary() {
  if (!inLibrary) return;
  try {
    window.parent.postMessage({ type: 'mnbglibrary:hello', exit: true }, location.origin);
  } catch {
    // another origin: the deck keeps its own eject tab
  }
}

export function backToLibrary() {
  try {
    (window.parent as unknown as { mnbglibrary: { eject(): void } }).mnbglibrary.eject();
  } catch {
    window.parent.postMessage({ type: 'mnbglibrary:eject' }, location.origin);
  }
}
