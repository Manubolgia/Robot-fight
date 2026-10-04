// A 3D turntable of one robot, using the shared renderer.

import { useEffect, useRef } from 'preact/hooks';
import type { BotDesign } from '../data/types.ts';
import { canvasSize, mount, unmount } from '../render/gfx.ts';
import { clearFrame, setFrame } from '../render/loop.ts';
import { Preview } from '../render/preview.ts';

export function Stage({ design, corner = 'blue', class: cls, zoom = 1, lookY = 0.12, interactive = true }: { design: BotDesign; corner?: 'blue' | 'red' | 'none'; class?: string; zoom?: number; lookY?: number; interactive?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const pv = useRef<Preview | null>(null);
  const drag = useRef<{ x: number; id: number } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const p = new Preview();
    pv.current = p;
    p.setDesign(design, corner);
    p.zoom = zoom;
    const r = mount(el, () => {
      const s = canvasSize();
      p.setSize(s.w, s.h);
    });
    const s = canvasSize();
    p.setSize(s.w, s.h);
    const frame = (dt: number) => {
      p.frame(dt);
      p.render(r);
    };
    setFrame(frame);
    return () => {
      clearFrame(frame);
      unmount(el);
      p.dispose();
      pv.current = null;
    };
  }, []);

  // rebuild when the design changes (setDesign ignores identical designs)
  pv.current?.setDesign(design, corner);
  if (pv.current) {
    pv.current.zoom = zoom;
    pv.current.lookY = lookY;
  }

  return (
    <div
      ref={host}
      class={cls}
      style={{ position: 'absolute', inset: 0 }}
      onPointerDown={(e) => {
        if (!interactive) return;
        drag.current = { x: e.clientX, id: e.pointerId };
        pv.current?.setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        pv.current?.drag(e.clientX - d.x);
        d.x = e.clientX;
      }}
      onPointerUp={() => {
        drag.current = null;
        pv.current?.setDragging(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        pv.current?.setDragging(false);
      }}
    />
  );
}
