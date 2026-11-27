// ============================================================================
//  The game always thinks in landscape.
//  On a phone held upright - or inside an app that never rotates, such as an
//  embedded page - the whole document is turned 90 degrees with CSS, and this
//  module translates sizes and touch positions so the rest of the code never
//  notices. Hold the phone sideways and it simply looks right.
// ============================================================================
export const VIEW = { w: innerWidth, h: innerHeight, rot: false };

const params = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;

/** Re-read the screen. Called on every resize, before anything else lays out. */
export function measure() {
  const W = innerWidth;
  const H = innerHeight;
  // ?norot / ?rot force it for testing
  const rot = params.has('norot') ? false : params.has('rot') ? H > W : coarse && H > W * 1.05;
  VIEW.rot = rot;
  VIEW.w = rot ? H : W;
  VIEW.h = rot ? W : H;
  const root = document.documentElement;
  const st = root.style;
  // viewport units of the GAME (css uses these instead of vw / vh / vmin / vmax)
  st.setProperty('--vw', VIEW.w / 100 + 'px');
  st.setProperty('--vh', VIEW.h / 100 + 'px');
  st.setProperty('--vmin', Math.min(VIEW.w, VIEW.h) / 100 + 'px');
  st.setProperty('--vmax', Math.max(VIEW.w, VIEW.h) / 100 + 'px');
  root.classList.toggle('vland', rot);
  root.classList.toggle('short', VIEW.h <= 430);
  root.classList.toggle('tall', VIEW.h > VIEW.w);
  if (document.body) {
    document.body.style.width = rot ? H + 'px' : '';
    document.body.style.height = rot ? W + 'px' : '';
  }
  return VIEW;
}

/** screen position -> game position */
export const px = (cx, cy) => (VIEW.rot ? [cy, innerWidth - cx] : [cx, cy]);
/** screen movement -> game movement */
export const delta = (dx, dy) => (VIEW.rot ? [dy, -dx] : [dx, dy]);

measure();
