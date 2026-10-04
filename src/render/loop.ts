// One animation loop for the whole app; the screen on show plugs its frame in.

type FrameFn = (dt: number) => void;

let current: FrameFn | null = null;
let raf = 0;
let last = 0;

function tick(now: number) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  raf = 0;
  const fn = current;
  if (!fn) return;
  try {
    fn(dt);
  } finally {
    // the frame may have swapped or cleared the loop
    if (current !== null && !raf) raf = requestAnimationFrame(tick);
  }
}

export function setFrame(fn: FrameFn | null) {
  current = fn;
  if (fn && !raf) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  if (!fn && raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

export function clearFrame(fn: FrameFn) {
  if (current === fn) setFrame(null);
}
