// Turning a thumbstick into robot controls. The stick points where you want
// to go on screen (up = north); the robot turns that way and drives, or backs
// up if the direction is behind it, keeping its weapon facing the action.

import { turnToward } from './ai.ts';
import type { Bot } from './world.ts';

const TAU = Math.PI * 2;
const wrap = (a: number) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};

export class ManualDriver {
  private reversing = false;

  /** sx, sy: stick in -1..1, screen space (y up). assist: nudge toward the opponent. */
  apply(me: Bot, op: Bot, sx: number, sy: number, assist: boolean) {
    const c = me.ctl;
    const mag = Math.min(1, Math.hypot(sx, sy));
    if (mag < 0.12) {
      c.throttle = 0;
      c.turn = 0;
      c.strafe = 0;
      return;
    }
    let want = Math.atan2(sy, sx);
    // aim assist: if the stick points roughly at the opponent, point right at it
    if (assist && !op.ko) {
      const toOp = Math.atan2(op.y - me.y, op.x - me.x);
      const d = Math.hypot(op.x - me.x, op.y - me.y);
      const off = wrap(toOp - want);
      if (Math.abs(off) < 0.45 && d < 5) want += off * 0.75;
    }
    const errF = wrap(want - me.th);
    // reverse when the stick points behind, with hysteresis
    if (!this.reversing && Math.abs(errF) > 2.05) this.reversing = true;
    else if (this.reversing && Math.abs(errF) < 1.2) this.reversing = false;
    const err = this.reversing ? wrap(errF + Math.PI) : errF;
    c.turn = turnToward(err, me.s.turnRate, me.s.turnAccel);
    const align = Math.cos(err);
    const thr = align > 0.3 ? mag * Math.pow(align, 0.8) : mag * 0.15;
    c.throttle = this.reversing ? -thr : thr;
    c.strafe = 0;
    if (me.s.strafe) {
      // mecanum: slide toward the stick while turning
      c.strafe = Math.max(-1, Math.min(1, -Math.sin(errF) * mag * 0.9));
    }
  }
}
