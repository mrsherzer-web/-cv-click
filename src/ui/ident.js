// The studio ident that opens the game: SHERZER PRODUCTION.
//
// About five seconds on a pale stage: ribbons of amber light sweep in and wind themselves into a glossy orb
// with an S on it, the orb blooms, its reflection settles on the floor and the wordmark resolves under it
// with a warm bell chord. An original piece in the manner of the console boot animations of the mid-2000s.
// Everything is drawn here on a 2D canvas from sprites made once per screen size (no asset files, no
// network, no canvas text: the letters are built from strokes, so the wordmark is the same on every
// device), and every sound is made with the Web Audio API.
//
// It plays on the first press of a start button in a page load (that tap is what lets the browser play
// sound): the press is caught on its way down (capture, on window: ahead of the asset layer's opening film,
// which listens on document), the ident plays, and the same click is then handed on, so everything after it
// runs exactly as before. A tap, click or key skips it, but not in its first 0.7 s. While it plays nothing
// under it reacts, the world behind it is not drawn and the game's own sound waits; when it is over it takes
// itself out of the page.
//
// The picture is a pure function of the timeline's time: the clock runs on performance.now(), holds while
// the tab is hidden, and prefers-reduced-motion gets a short still version. Automated browsers
// (navigator.webdriver) do not get it unless window.__identForce === true was set before the page's scripts
// ran; window.__identSpeed multiplies its clock (0 freezes it), and window.__ident reports it:
//   { state: 'idle' | 'playing' | 'done', played, t, phase, reduced, sound: { started, voices, cues }, skip() }
// (voices: its sources still sounding; cues: the sounds set off so far; and frames, drawMs: how many frames
// it drew and the mean time one took)

const BUTTONS = '#startBtn, #newGameBtn, #chapterPick button';
const GUARD = 0.7; // seconds in which a tap does not skip (the tap that started it must not)

// the beats of the timeline, in seconds
const B = {
  fadeIn: 0.3,                 // the stage comes up over the start screen
  ribbons: 0.1,                // the first ribbon sets off
  bloom: 2.2,                  // the ribbons have wound in: the flash
  orb: 2.04, orbDur: 0.62,     // the orb swells out of it
  word: 2.72, wordStep: 0.06, wordDur: 0.55, // SHERZER, letter by letter
  sub: 3.2, subDur: 0.7,       // PRODUCTION under it
  sheen: 3.8, sheenDur: 0.8,   // a light passes over the orb and the letters
  end: 4.9, fadeOut: 0.55,     // the click is handed on, and the stage dissolves over what comes next
};
const STILL = { fadeIn: 0.25, end: 1.0, fadeOut: 0.3 }; // reduced motion: the finished picture, 1.3 s in all
const SKIP_FADE = 0.28;

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
const outCubic = (k) => 1 - (1 - k) ** 3;
const outBack = (k, s = 1.5) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2;
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;
const sheet = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

// the game's amber (--accent in style.css) and its neighbours
const AMBER = [255, 181, 71], ORANGE = [255, 138, 31], DEEP = [236, 104, 14], GOLD = [255, 209, 102], CREAM = [255, 243, 214];
const INK = ['#3a3e46', '#1c1f24']; // graphite, top to bottom

function phaseAt(t, reduced) {
  if (reduced) return 'still';
  if (t < B.fadeIn) return 'in';
  if (t < B.orb) return 'ribbons';
  if (t < B.word) return 'bloom';
  if (t < B.sub + B.subDur) return 'wordmark';
  return 'hold';
}

// ---------------------------------------------------------------------------------------------------------
// the letters: each one a few strokes in a box one cap height tall (x right, y down), stroked with a flat
// pen of width s and cut off at the box, which squares the feet of the diagonals. w is the letter's width
// before the pen's own (I is just the pen)
const GLYPHS = {
  S: { w: 0.64, d(c, W, a) { const r = (0.5 - a) / 2; c.moveTo(W * 0.97, a); c.lineTo(a + r, a); c.arc(a + r, a + r, r, -PI / 2, PI / 2, true); c.lineTo(W - a - r, 0.5); c.arc(W - a - r, 0.5 + r, r, -PI / 2, PI / 2); c.lineTo(0, 1 - a); } },
  H: { w: 0.70, d(c, W, a) { c.moveTo(a, 0); c.lineTo(a, 1); c.moveTo(W - a, 0); c.lineTo(W - a, 1); c.moveTo(a, 0.5); c.lineTo(W - a, 0.5); } },
  E: { w: 0.56, d(c, W, a) { c.moveTo(W, a); c.lineTo(a, a); c.lineTo(a, 1 - a); c.lineTo(W, 1 - a); c.moveTo(a, 0.5); c.lineTo(W * 0.9, 0.5); } },
  R: { w: 0.66, d(c, W, a) { const r = (0.55 - a) / 2; c.moveTo(a, 1); c.lineTo(a, a); c.lineTo(W - a - r, a); c.arc(W - a - r, a + r, r, -PI / 2, PI / 2); c.lineTo(a, a + 2 * r); c.moveTo(W * 0.44, a + 2 * r); c.lineTo(W - a * 0.9, 1.2); } },
  Z: { w: 0.66, d(c, W, a) { c.moveTo(0, a); c.lineTo(W - a * 0.6, a); c.lineTo(a * 0.6, 1 - a); c.lineTo(W, 1 - a); } },
  P: { w: 0.62, d(c, W, a) { const r = (0.58 - a) / 2; c.moveTo(a, 1); c.lineTo(a, a); c.lineTo(W - a - r, a); c.arc(W - a - r, a + r, r, -PI / 2, PI / 2); c.lineTo(a, a + 2 * r); } },
  O: { w: 0.84, d(c, W, a) { const q = 0.32; c.moveTo(a + q, a); c.lineTo(W - a - q, a); c.arc(W - a - q, a + q, q, -PI / 2, 0); c.lineTo(W - a, 1 - a - q); c.arc(W - a - q, 1 - a - q, q, 0, PI / 2); c.lineTo(a + q, 1 - a); c.arc(a + q, 1 - a - q, q, PI / 2, PI); c.lineTo(a, a + q); c.arc(a + q, a + q, q, PI, 1.5 * PI); c.closePath(); } },
  D: { w: 0.78, d(c, W, a) { const q = 0.34; c.moveTo(a, 1 - a); c.lineTo(a, a); c.lineTo(W - a - q, a); c.arc(W - a - q, a + q, q, -PI / 2, 0); c.lineTo(W - a, 1 - a - q); c.arc(W - a - q, 1 - a - q, q, 0, PI / 2); c.closePath(); } },
  U: { w: 0.76, d(c, W, a) { const q = 0.32; c.moveTo(a, 0); c.lineTo(a, 1 - a - q); c.arc(a + q, 1 - a - q, q, PI, PI / 2, true); c.lineTo(W - a - q, 1 - a); c.arc(W - a - q, 1 - a - q, q, PI / 2, 0, true); c.lineTo(W - a, 0); } },
  C: { w: 0.7, d(c, W, a) { const q = 0.32; c.moveTo(W, a); c.lineTo(a + q, a); c.arc(a + q, a + q, q, -PI / 2, PI, true); c.lineTo(a, 1 - a - q); c.arc(a + q, 1 - a - q, q, PI, PI / 2, true); c.lineTo(W, 1 - a); } },
  T: { w: 0.72, d(c, W, a) { c.moveTo(0, a); c.lineTo(W, a); c.moveTo(W / 2, a); c.lineTo(W / 2, 1); } },
  I: { w: 0, d(c, W, a) { c.moveTo(a, 0); c.lineTo(a, 1); } },
  N: { w: 0.78, d(c, W, a) { c.moveTo(a, 1); c.lineTo(a, 0); c.lineTo(W - a, 1); c.lineTo(W - a, 0); } },
};
const glyphWidth = (ch, s) => GLYPHS[ch].w + s * (ch === 'I' ? 1 : 0.6);

// one letter's strokes as the current path of g, in a box cap tall whose left top corner is at (x, y)
function strokeGlyph(g, ch, x, y, cap, s, paint) {
  const W = glyphWidth(ch, s);
  g.save();
  g.translate(x, y);
  g.scale(cap, cap);
  g.beginPath(); g.rect(0, 0, W, 1); g.clip();
  g.beginPath();
  GLYPHS[ch].d(g, W, s / 2);
  g.lineWidth = s; g.lineCap = 'butt'; g.lineJoin = 'miter'; g.miterLimit = 12;
  g.strokeStyle = paint;
  g.stroke();
  g.restore();
}

// a line of letters on its own sheet: cap px tall, pen s (of the cap height), track px between letters.
// Returns the sheet, its padding and where each letter sits
function setLine(text, cap, s, track, colours) {
  const pad = 2, xs = [];
  let x = pad;
  for (const ch of text) { const w = Math.round(glyphWidth(ch, s) * cap); xs.push({ x, w }); x += w + track; }
  const width = x - track + pad;
  const cv = sheet(width, cap + pad * 2), g = cv.getContext('2d');
  const paint = g.createLinearGradient(0, 0, 0, 1); // in the letter's own box
  paint.addColorStop(0, colours[0]); paint.addColorStop(1, colours[1]);
  [...text].forEach((ch, i) => strokeGlyph(g, ch, xs[i].x, pad, cap, s, paint));
  return { cv, pad, cap, letters: xs, width: width - pad * 2 };
}

// ---------------------------------------------------------------------------------------------------------
// the sprites

// a soft round light: white hot in the middle, the tint around it
function makeGlow(size, inner, outer, peak = 1) {
  const cv = sheet(size, size), g = cv.getContext('2d'), r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, rgba(inner, peak)); gr.addColorStop(0.22, rgba(inner, peak * 0.62)); gr.addColorStop(0.5, rgba(outer, peak * 0.2)); gr.addColorStop(0.78, rgba(outer, peak * 0.045)); gr.addColorStop(1, rgba(outer, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return cv;
}

// the wave the bloom sends out: a soft bright edge with its glow trailing inside
function makeRing(size) {
  const cv = sheet(size, size), g = cv.getContext('2d'), r = size / 2;
  const gr = g.createRadialGradient(r, r, r * 0.62, r, r, r);
  gr.addColorStop(0, rgba(AMBER, 0)); gr.addColorStop(0.5, rgba(AMBER, 0.1)); gr.addColorStop(0.8, rgba([255, 204, 120], 0.5)); gr.addColorStop(0.9, 'rgba(255,250,236,0.95)'); gr.addColorStop(0.95, rgba(AMBER, 0.45)); gr.addColorStop(1, rgba(AMBER, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return cv;
}

// a slice of ribbon: across it (down the sheet) a soft skirt, the body and a bright line off centre; along
// it a window that sums to an even band when the slices overlap by half
const STAMP = { w: 32, h: 96, body: 0.42 }; // body: the share of the height that reads as the ribbon
function makeStamp(edge, body, core) {
  const cv = sheet(STAMP.w, STAMP.h), g = cv.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, STAMP.h);
  [[0, edge, 0], [0.14, edge, 0.05], [0.27, edge, 0.3], [0.33, edge, 0.72], [0.41, body, 0.9], [0.455, core, 1], [0.5, core, 0.96], [0.56, body, 0.92], [0.66, edge, 0.74], [0.73, edge, 0.3], [0.86, edge, 0.05], [1, edge, 0]]
    .forEach(([at, col, a]) => v.addColorStop(at, rgba(col, a)));
  g.fillStyle = v; g.fillRect(0, 0, STAMP.w, STAMP.h);
  g.globalCompositeOperation = 'destination-in';
  const u = g.createLinearGradient(0, 0, STAMP.w, 0);
  for (let i = 0; i <= 10; i++) u.addColorStop(i / 10, `rgba(0,0,0,${Math.sin(PI * i / 10) ** 2})`);
  g.fillStyle = u; g.fillRect(0, 0, STAMP.w, STAMP.h);
  return cv;
}

// the orb: amber glass lit from the upper left, the S inside it, a window of gloss over the top
function makeOrb(R) {
  const pad = 3, S = Math.ceil(R + pad) * 2, o = S / 2;
  const cv = sheet(S, S), g = cv.getContext('2d');
  g.translate(o, o);
  g.save();
  g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
  let gr = g.createRadialGradient(-0.3 * R, -0.4 * R, 0.04 * R, 0, 0, R);
  gr.addColorStop(0, '#fff3cf'); gr.addColorStop(0.2, '#ffd27a'); gr.addColorStop(0.5, '#ffab38'); gr.addColorStop(0.8, '#f58214'); gr.addColorStop(1, '#cf5b08');
  g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
  // light gathered at the bottom of the glass
  gr = g.createRadialGradient(0, 0.7 * R, 0, 0, 0.62 * R, 0.82 * R);
  gr.addColorStop(0, 'rgba(255,202,128,0.4)'); gr.addColorStop(0.5, 'rgba(255,186,104,0.17)'); gr.addColorStop(1, 'rgba(255,180,90,0)');
  g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
  g.globalCompositeOperation = 'source-over';
  // the S: its shade first, then the letter in warm white
  const cap = 1.0 * R, s = 0.205, W = glyphWidth('S', s) * cap, x = -W / 2, y = -cap / 2 + 0.02 * R;
  strokeGlyph(g, 'S', x + 0.012 * R, y + 0.05 * R, cap, s, 'rgba(150,58,0,0.22)');
  strokeGlyph(g, 'S', x + 0.006 * R, y + 0.026 * R, cap, s, 'rgba(142,52,0,0.34)');
  const white = g.createLinearGradient(0, 0, 0, 1);
  white.addColorStop(0, '#ffffff'); white.addColorStop(0.55, '#fffaf0'); white.addColorStop(1, '#ffe6b4');
  strokeGlyph(g, 'S', x, y, cap, s, white);
  // the rim falls away into a deeper orange
  gr = g.createRadialGradient(0, 0, 0.66 * R, 0, 0, R);
  gr.addColorStop(0, 'rgba(132,46,0,0)'); gr.addColorStop(0.72, 'rgba(132,46,0,0.09)'); gr.addColorStop(1, 'rgba(118,38,0,0.42)');
  g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
  // the window of gloss over the upper half
  g.save();
  g.beginPath(); g.ellipse(0, -0.47 * R, 0.76 * R, 0.47 * R, 0, 0, TAU); g.clip();
  gr = g.createLinearGradient(0, -0.96 * R, 0, 0.02 * R);
  gr.addColorStop(0, 'rgba(255,255,255,0.92)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0.04)');
  g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, R * 1.1);
  g.restore();
  // a line of light along the lower rim
  gr = g.createLinearGradient(-0.8 * R, 0, 0.8 * R, 0);
  gr.addColorStop(0, 'rgba(255,240,200,0)'); gr.addColorStop(0.5, 'rgba(255,244,214,0.85)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
  g.strokeStyle = gr; g.lineWidth = 0.03 * R; g.lineCap = 'round';
  g.beginPath(); g.arc(0, 0, 0.945 * R, 0.2 * PI, 0.8 * PI); g.stroke();
  g.restore();
  return { cv, half: o };
}

// what the floor shows of a sheet: upside down, fading with distance
function makeReflection(src, depth, strength) {
  const cv = sheet(src.width, depth), g = cv.getContext('2d');
  g.translate(0, src.height); g.scale(1, -1);
  g.drawImage(src, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  const gr = g.createLinearGradient(0, 0, 0, depth);
  gr.addColorStop(0, `rgba(0,0,0,${strength})`); gr.addColorStop(0.35, `rgba(0,0,0,${strength * 0.42})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, cv.width, depth);
  return cv;
}

// the stage: a white wall, a pale floor a shade deeper where they meet, light pooled in the middle and
// the corners falling off; a grain too fine to see keeps the gradients from banding
function makeStage(W, H, cx, cy, floorY, c) {
  const cv = sheet(W, H), g = cv.getContext('2d');
  let gr = g.createLinearGradient(0, 0, 0, floorY);
  gr.addColorStop(0, '#f5f3ef'); gr.addColorStop(0.55, '#faf9f6'); gr.addColorStop(1, '#efede8');
  g.fillStyle = gr; g.fillRect(0, 0, W, Math.ceil(floorY));
  gr = g.createLinearGradient(0, floorY, 0, H);
  gr.addColorStop(0, '#e4e0d8'); gr.addColorStop(Math.min(0.5, (1.1 * c) / Math.max(1, H - floorY)), '#ece9e3'); gr.addColorStop(1, '#f3f1ec');
  g.fillStyle = gr; g.fillRect(0, Math.floor(floorY), W, H - Math.floor(floorY));
  // the line where they meet, softened
  gr = g.createLinearGradient(0, floorY - 0.5 * c, 0, floorY);
  gr.addColorStop(0, 'rgba(218,213,203,0)'); gr.addColorStop(1, 'rgba(218,213,203,0.5)');
  g.fillStyle = gr; g.fillRect(0, floorY - 0.5 * c, W, 0.5 * c);
  // light on the wall behind the orb and on the floor in front of it
  const far = Math.hypot(W, H) / 2;
  gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(6.5 * c, far * 0.62));
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.72)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.save();
  g.translate(cx, floorY + 1.5 * c); g.scale(1, 0.24);
  gr = g.createRadialGradient(0, 0, 0, 0, 0, 8 * c);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(-8 * c, -8 * c, 16 * c, 16 * c);
  g.restore();
  gr = g.createRadialGradient(cx, H * 0.5, far * 0.42, cx, H * 0.5, far * 1.04);
  gr.addColorStop(0, 'rgba(176,164,146,0)'); gr.addColorStop(1, 'rgba(176,164,146,0.34)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const grain = sheet(128, 128), n = grain.getContext('2d'), px = n.createImageData(128, 128);
  for (let i = 0; i < px.data.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255; px.data[i] = px.data[i + 1] = px.data[i + 2] = v; px.data[i + 3] = 2; }
  n.putImageData(px, 0, 0);
  g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, W, H);
  return cv;
}

// ---------------------------------------------------------------------------------------------------------
// the ribbons: each one a spiral that comes in from beyond the corners of the screen, tilts into an orbit as
// it nears the middle and winds itself onto the orb. p is the place along it: 0 far out, 1 on the orb,
// past 1 it goes on round. [first angle, tilt, the tilt's axis, turns, width, twist, sets off, colour]
const RIBBONS = [
  [0.02, 1.08, 0.35, 2.3, 1.0, 0.0, 0.00, 0],
  [0.36, 0.62, 2.1, 2.6, 0.82, 1.3, 0.10, 1],
  [0.69, 1.2, 1.2, 2.2, 0.92, 2.2, 0.20, 2],
  [0.19, 0.9, 2.75, 2.8, 0.7, 0.6, 0.30, 3],
  [0.53, 0.42, 0.9, 2.5, 0.86, 2.9, 0.38, 0],
  [0.86, 1.0, 1.75, 2.9, 0.62, 1.8, 0.46, 2],
  // threads: thin and bright, quicker round
  [0.11, 0.8, 0.6, 3.4, 0.16, 0, 0.16, 4],
  [0.45, 1.15, 2.4, 3.6, 0.14, 0, 0.34, 4],
  [0.78, 0.5, 1.5, 3.8, 0.13, 0, 0.5, 4],
];
const TRAIL = 0.3, SAMPLES = 52;

function ribbonPoint(rb, p, far, near, out) {
  const [a0, tiltMax, node, turns] = rb;
  const q = p < 1 ? p : 1;
  const rho = p < 1 ? near + (far - near) * (1 - q) ** 2.3 : near;
  const ang = a0 * TAU + TAU * turns * (p < 1 ? Math.max(0, p) ** 1.35 : 1 + 1.35 * (p - 1)) + (p < 0 ? p * 2 : 0);
  const tilt = tiltMax * smooth(0.12, 0.82, p);
  const x = rho * Math.cos(ang), y = rho * Math.sin(ang);
  const cn = Math.cos(node), sn = Math.sin(node);
  const xr = x * cn + y * sn, yr = -x * sn + y * cn;
  const y2 = yr * Math.cos(tilt);
  out.x = xr * cn - y2 * sn; out.y = xr * sn + y2 * cn; out.z = yr * Math.sin(tilt);
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// the picture for one screen size: everything measured from the cap height of SHERZER
function makeScene(canvas, w, h) {
  const k = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2.8e6 / Math.max(1, w * h))); // at most 2x, and under three megapixels
  const W = Math.round(w * k), H = Math.round(h * k);
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });

  const c = Math.max(8, Math.round(Math.min((w * 0.8) / 7.4, (h * 0.68) / 6.7) * k));
  const R = 1.85 * c;
  const lock = 2 * R + 0.16 * c + 0.98 * c + c + 0.44 * c + 0.36 * c; // orb, air, reflection, SHERZER, air, PRODUCTION
  const cx = Math.round(W / 2), cy = Math.round((H - lock) / 2 + R - 0.04 * c);
  const floorY = Math.round(cy + R + 0.16 * c);
  const wordY = Math.round(floorY + 0.98 * c);
  const subCap = Math.max(4, Math.round(0.36 * c));
  const subY = Math.round(wordY + c + 0.44 * c);

  const stage = makeStage(W, H, cx, cy, floorY, c);
  const orb = makeOrb(R);
  const refl = makeReflection(orb.cv, Math.ceil(0.8 * c), 0.6); // gone before it reaches the letters
  const wave = makeRing(512);
  const halo = makeGlow(256, [255, 196, 96], AMBER, 0.9);
  const flash = makeGlow(256, [255, 255, 255], [255, 226, 160], 1);
  const spark = makeGlow(48, [255, 255, 255], GOLD, 1);
  const pool = makeGlow(192, [255, 190, 96], AMBER, 0.8);
  const shade = makeGlow(128, [86, 58, 26], [86, 58, 26], 0.6);
  const stamps = [makeStamp(ORANGE, AMBER, CREAM), makeStamp(DEEP, ORANGE, GOLD), makeStamp(AMBER, GOLD, [255, 252, 236]), makeStamp(DEEP, [246, 120, 20], AMBER), makeStamp(AMBER, CREAM, [255, 255, 255])];
  const word = setLine('SHERZER', c, 0.2, Math.round(0.33 * c), INK);
  // PRODUCTION is spaced out to the width of SHERZER
  const subS = 0.085, subText = 'PRODUCTION';
  const subGlyphs = [...subText].reduce((sum, ch) => sum + Math.round(glyphWidth(ch, subS) * subCap), 0);
  const sub = setLine(subText, subCap, subS, Math.max(1, Math.round((word.width - subGlyphs) / (subText.length - 1))), ['#4b5059', '#33373e']);
  const wordX = Math.round(cx - word.width / 2), subX = Math.round(cx - sub.width / 2);
  const lit = sheet(word.cv.width, word.cv.height), litG = lit.getContext('2d'); // SHERZER with the light passing over it

  // each ribbon sets off from just beyond the edge of the screen in its own direction
  const near = R * 1.03;
  const fars = RIBBONS.map(([a0]) => { const a = a0 * TAU, edge = Math.min(W / 2 / Math.max(0.001, Math.abs(Math.cos(a))), H / 2 / Math.max(0.001, Math.abs(Math.sin(a)))); return Math.max(edge * 1.1 + 1.4 * c, 3 * R); });
  const pt = { x: 0, y: 0, z: 0 }, pt2 = { x: 0, y: 0, z: 0 };
  const buf = new Float32Array(RIBBONS.length * SAMPLES * 8);
  // the sparks the bloom throws: [direction, reach, size, delay]
  const SPARKS = Array.from({ length: 16 }, (_, i) => { const r = (n) => { const v = Math.sin((i + 1) * n) * 43758.5453; return v - Math.floor(v); }; return [r(12.9898) * TAU, 2.2 + r(78.233) * 3.4, 0.5 + r(39.425) * 0.9, r(93.989) * 0.12]; });

  // the ribbons at time t into buf: [x, y, cos, sin, length, across, alpha, sprite] per slice; z in a second pass
  const depth = new Float32Array(RIBBONS.length * SAMPLES);
  function ribbons(t) {
    let n = 0;
    const gone = 1 - smooth(B.bloom - 0.06, B.bloom + 0.42, t);
    if (gone <= 0) return 0;
    for (let r = 0; r < RIBBONS.length; r++) {
      const rb = RIBBONS[r], far = fars[r];
      const [, , , , wide, twist0, sets, sprite] = rb;
      const t0 = B.ribbons + sets, head = (t - t0) / (B.bloom - t0);
      if (head < -0.02) continue;
      const thread = sprite === 4;
      const trail = thread ? TRAIL * 0.8 : TRAIL;
      ribbonPoint(rb, head, far, near, pt);
      for (let j = 0; j < SAMPLES; j++) {
        const s = (j + 1) / SAMPLES, p = head - trail * s;
        ribbonPoint(rb, p, far, near, pt2);
        const mx = cx + (pt.x + pt2.x) / 2, my = cy + (pt.y + pt2.y) / 2, dx = pt2.x - pt.x, dy = pt2.y - pt.y, len = Math.hypot(dx, dy) || 1;
        const z = (pt.z + pt2.z) / 2;
        pt.x = pt2.x; pt.y = pt2.y; pt.z = pt2.z;
        if (mx < -2 * c || mx > W + 2 * c || my < -2 * c || my > H + 2 * c) continue;
        const sm = s - 0.5 / SAMPLES;
        const taper = smooth(0, 0.1, sm) * (1 - sm) ** 0.9;
        const turn = thread ? 1 : 0.46 + 0.54 * Math.abs(Math.cos(twist0 + p * 8.5));
        const size = lerp(1.1, 0.5, smooth(0.05, 0.92, p)) * (1 - 0.1 * clamp(z / R, -1, 1)); // wider far out, a little smaller behind
        const across = Math.max(1.5, wide * c * size * turn * (0.25 + 0.75 * taper));
        const i = n * 8;
        buf[i] = mx; buf[i + 1] = my; buf[i + 2] = dx / len; buf[i + 3] = dy / len; buf[i + 4] = len * 2.3 + 1; buf[i + 5] = across / STAMP.body;
        buf[i + 6] = gone * (thread ? 0.9 : 0.8) * smooth(0, 0.07, sm) * (1 - sm) ** 0.7 * smooth(-0.02, 0.05, p + trail);
        buf[i + 7] = sprite;
        depth[n] = z;
        n++;
      }
    }
    return n;
  }
  function slices(n, behind) {
    for (let j = 0; j < n; j++) {
      if ((depth[j] > 0) !== behind) continue;
      const i = j * 8, co = buf[i + 2], si = buf[i + 3], lx = buf[i + 4] / STAMP.w, ly = buf[i + 5] / STAMP.h;
      ctx.setTransform(co * lx, si * lx, -si * ly, co * ly, buf[i], buf[i + 1]);
      ctx.globalAlpha = buf[i + 6];
      ctx.drawImage(stamps[buf[i + 7]], -STAMP.w / 2, -STAMP.h / 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }
  const glow = (img, x, y, rx, ry, a) => { if (a <= 0.003) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(img, x - rx, y - ry, rx * 2, ry * 2); ctx.globalAlpha = 1; };

  function draw(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(stage, 0, 0);

    const born = clamp((t - B.orb) / B.orbDur);                 // the orb swelling out of the flash
    const there = smooth(B.orb, B.orb + 0.2, t);                // its presence: 0 to 1
    const scale = born <= 0 ? 0 : outBack(born);
    const breath = 1 + 0.006 * Math.sin((t - B.orb) * 2.1);
    const gather = smooth(B.ribbons + 0.5, B.bloom, t) * (1 - there); // light gathering in the middle as they wind in
    const since = t - B.bloom;

    // the floor under the orb: its glow, its shade, its reflection
    glow(pool, cx, floorY + 0.5 * c, 4.4 * R, 0.62 * R, 0.5 * there + 0.2 * gather);
    glow(shade, cx, floorY + 0.03 * c, 1.02 * R * scale, 0.1 * R, 0.5 * there);
    if (there > 0) {
      const rw = refl.width * scale, rh = refl.height * scale;
      ctx.globalAlpha = there;
      ctx.drawImage(refl, cx - rw / 2, floorY + 0.16 * c + (1 - scale) * R, rw, rh);
      ctx.globalAlpha = 1;
    }

    const n = ribbons(t);
    slices(n, true);
    glow(halo, cx, cy, 2.5 * R, 2.5 * R, 0.6 * gather);
    if (there > 0) {
      const pulse = since > 0 ? Math.exp(-since * 3.2) : 0;
      glow(halo, cx, cy, (2.05 + 0.5 * pulse) * R, (2.05 + 0.5 * pulse) * R, there * (0.5 + 0.4 * pulse));
      const d = orb.cv.width * scale * breath;
      ctx.globalAlpha = there;
      ctx.drawImage(orb.cv, cx - d / 2, cy - d / 2, d, d);
      ctx.globalAlpha = 1;
      // a band of light across the glass
      const sw = (t - B.sheen) / B.sheenDur;
      if (sw > 0 && sw < 1) {
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, R * scale - 1, 0, TAU); ctx.clip();
        ctx.translate(cx + lerp(-1.7, 1.7, outCubic(sw)) * R, cy); ctx.rotate(-0.42);
        const gr = ctx.createLinearGradient(-0.5 * R, 0, 0.5 * R, 0);
        const a = 0.5 * Math.sin(PI * sw);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(-0.5 * R, -1.6 * R, R, 3.2 * R);
        ctx.restore();
      }
    }
    slices(n, false);

    // the bloom: a flash, a streak, a ring running out, sparks
    if (since > -0.14 && since < 1.3) {
      const up = smooth(-0.14, 0.02, since), fl = up * Math.exp(-Math.max(0, since) * 4.2);
      ctx.globalAlpha = 0.42 * fl; ctx.fillStyle = '#fff3d9'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; // the whole stage lit warm for a moment
      glow(flash, cx, cy, (1.6 + 5.5 * outCubic(clamp((since + 0.14) / 0.8))) * R, (1.6 + 5.5 * outCubic(clamp((since + 0.14) / 0.8))) * R, fl);
      glow(flash, cx, cy, (2 + 9 * outCubic(clamp((since + 0.1) / 0.6))) * R, 0.2 * R * (1 - 0.5 * clamp(since)), 0.9 * up * Math.exp(-Math.max(0, since) * 3.4));
      const ring = clamp(since / 0.95);
      if (since > 0 && ring < 1) { const r = lerp(1.0, 5.6, outCubic(ring)) * R; glow(wave, cx, cy, r, r, 0.85 * (1 - ring) ** 1.5); }
      for (const [dir, reach, size, wait] of SPARKS) {
        const q = clamp((since - wait) / 0.95);
        if (q <= 0 || q >= 1) continue;
        const d = (1.05 + reach * outCubic(q)) * R, r = size * 0.16 * c * (1 - q * 0.6);
        glow(spark, cx + Math.cos(dir) * d, cy + Math.sin(dir) * d * 0.92 + q * q * 0.5 * R, r, r, (1 - q) ** 1.2);
      }
    }

    // SHERZER: each letter up into its place, the spacing closing as it comes
    const wordDone = B.word + B.wordStep * (word.letters.length - 1) + B.wordDur;
    if (t >= wordDone) {
      const sw = (t - B.sheen - 0.1) / B.sheenDur;
      if (sw > 0 && sw < 1) {
        litG.globalCompositeOperation = 'source-over';
        litG.clearRect(0, 0, lit.width, lit.height);
        litG.drawImage(word.cv, 0, 0);
        litG.globalCompositeOperation = 'source-atop';
        const at = lerp(-0.15, 1.15, sw) * lit.width, band = 0.8 * c;
        const gr = litG.createLinearGradient(at - band, 0, at + band, band * 0.6);
        gr.addColorStop(0, rgba(AMBER, 0)); gr.addColorStop(0.4, rgba(AMBER, 0.7)); gr.addColorStop(0.5, 'rgba(255,226,170,0.95)'); gr.addColorStop(0.6, rgba(AMBER, 0.7)); gr.addColorStop(1, rgba(AMBER, 0));
        litG.fillStyle = gr; litG.fillRect(0, 0, lit.width, lit.height);
        ctx.drawImage(lit, wordX - word.pad, wordY - word.pad);
      } else ctx.drawImage(word.cv, wordX - word.pad, wordY - word.pad);
    } else if (t > B.word) {
      word.letters.forEach((L, i) => {
        const e = outCubic(clamp((t - B.word - i * B.wordStep) / B.wordDur));
        if (e <= 0) return;
        const mid = L.x + L.w / 2 - word.pad - word.width / 2; // from the middle of the word
        ctx.globalAlpha = e * e;
        ctx.drawImage(word.cv, L.x - 1, 0, L.w + 2, word.cv.height, wordX - word.pad + L.x - 1 + mid * 0.16 * (1 - e), wordY - word.pad + 0.3 * c * (1 - e), L.w + 2, word.cv.height);
      });
      ctx.globalAlpha = 1;
    }
    // PRODUCTION: in from wide
    if (t > B.sub) {
      const e = outCubic(clamp((t - B.sub) / B.subDur));
      if (e >= 1) ctx.drawImage(sub.cv, subX - sub.pad, subY - sub.pad);
      else {
        ctx.globalAlpha = e;
        for (const L of sub.letters) {
          const mid = L.x + L.w / 2 - sub.pad - sub.width / 2;
          ctx.drawImage(sub.cv, L.x - 1, 0, L.w + 2, sub.cv.height, subX - sub.pad + L.x - 1 + mid * 0.22 * (1 - e), subY - sub.pad, L.w + 2, sub.cv.height);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  return { draw, k, c, W, H };
}

// ---------------------------------------------------------------------------------------------------------
// the sound: an airy rising whoosh while the ribbons wind in, a soft low thump at the bloom, a warm chord of
// bells as the wordmark resolves, a short tail. Played on the game's own audio context when one is given: it
// is made inside the starting tap, so the game may sound afterwards without another tap, and the game's side
// of it stays quiet until the game begins. Muted, the context is still made and nothing is played.
function openAudio(sound, info) {
  let ctx = null, own = false;
  try {
    if (sound && typeof sound.start === 'function') {
      sound.setPaused?.(true);
      sound.start();
      ctx = sound.ctx || null;
    } else {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { ctx = new AC(); own = true; }
    }
  } catch { ctx = null; }
  // the game's side comes back when the game begins (the start screen goes away), not before: a film may
  // play in between
  const release = () => {
    if (!sound?.setPaused) return;
    const start = document.getElementById('startScreen');
    if (!start || start.hidden) { sound.setPaused(false); return; }
    const mo = new MutationObserver(() => { if (start.hidden) { mo.disconnect(); sound.setPaused(false); } });
    mo.observe(start, { attributes: true, attributeFilter: ['hidden'] });
  };
  const silent = { cue() {}, duck() {}, end() { release(); if (own) ctx?.close?.(); } };
  if (!ctx || sound?.muted) return silent;
  if (ctx.state === 'suspended') ctx.resume?.();

  const LEVEL = 0.85;
  const out = ctx.createGain(), bus = ctx.createGain(), comp = ctx.createDynamicsCompressor();
  const echo = ctx.createDelay(0.5), damp = ctx.createBiquadFilter(), back = ctx.createGain(), wet = ctx.createGain();
  out.gain.value = LEVEL;
  comp.threshold.value = -9; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
  echo.delayTime.value = 0.27; damp.type = 'lowpass'; damp.frequency.value = 2100; back.gain.value = 0.36; wet.gain.value = 0.3;
  bus.connect(comp); bus.connect(echo); echo.connect(damp); damp.connect(back); back.connect(echo); damp.connect(wet); wet.connect(comp);
  comp.connect(out); out.connect(ctx.destination);
  const nodes = [out, bus, comp, echo, damp, back, wet];

  const live = new Set();
  const run = (src, from, until) => {
    live.add(src); info.voices = live.size; info.started = true;
    src.onended = () => { live.delete(src); info.voices = live.size; try { src.disconnect(); } catch { /* already out */ } };
    src.start(from); src.stop(until);
    return src;
  };
  let hiss = null;
  const noise = () => {
    if (!hiss) { hiss = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = hiss.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(); s.buffer = hiss; s.loop = true;
    return s;
  };
  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filter = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

  const cues = {
    // air through a band that climbs, swelling to the bloom, with a faint rising note inside it
    whoosh(at, dur) {
      const end = at + dur;
      const n = noise(), band = filter('bandpass', 240, 0.8), g = gain(0);
      band.frequency.setValueAtTime(240, at); band.frequency.exponentialRampToValueAtTime(3400, end);
      g.gain.setValueAtTime(0.004, at); g.gain.exponentialRampToValueAtTime(0.3, end); g.gain.setTargetAtTime(0, end, 0.07);
      n.connect(band); band.connect(g);
      if (ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); pan.pan.setValueAtTime(-0.55, at); pan.pan.linearRampToValueAtTime(0.55, at + dur * 0.6); pan.pan.linearRampToValueAtTime(0, end); g.connect(pan); pan.connect(bus); } else g.connect(bus);
      run(n, at, end + 0.6);
      const air = noise(), high = filter('highpass', 5200), ag = gain(0);
      ag.gain.setValueAtTime(0.001, at); ag.gain.exponentialRampToValueAtTime(0.085, end); ag.gain.setTargetAtTime(0, end, 0.16);
      air.connect(high); high.connect(ag); ag.connect(bus);
      run(air, at, end + 1.1);
      for (const [from, to, level] of [[110, 220, 0.05], [165, 330, 0.022]]) {
        const o = ctx.createOscillator(), og = gain(0);
        o.type = 'sine'; o.frequency.setValueAtTime(from, at); o.frequency.exponentialRampToValueAtTime(to, end);
        og.gain.setValueAtTime(0.0006, at); og.gain.exponentialRampToValueAtTime(level, end); og.gain.setTargetAtTime(0, end, 0.09);
        o.connect(og); og.connect(bus);
        run(o, at, end + 0.7);
      }
    },
    // low and round, with an octave over it for small speakers and a breath of air let go
    thump(at) {
      for (const [type, from, to, level, len] of [['sine', 112, 44, 0.62, 0.62], ['triangle', 176, 82, 0.2, 0.34]]) {
        const o = ctx.createOscillator(), g = gain(0);
        o.type = type; o.frequency.setValueAtTime(from, at); o.frequency.exponentialRampToValueAtTime(to, at + 0.24);
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, at + len); g.gain.setTargetAtTime(0, at + len, 0.02);
        o.connect(g); g.connect(bus);
        run(o, at, at + len + 0.15);
      }
      const n = noise(), low = filter('lowpass', 520), g = gain(0);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.16, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, at + 0.5); g.gain.setTargetAtTime(0, at + 0.5, 0.02);
      n.connect(low); low.connect(g); g.connect(bus);
      run(n, at, at + 0.65);
    },
    // D add 9, spread wide and rolled upward, each note a struck bell (a tone, its octave, a twelfth a
    // shade sharp and a short bright ping), over a soft held fifth
    chord(at, level = 1) {
      const notes = [[50, 0, 0.13, 2.6], [57, 0.05, 0.11, 2.5], [66, 0.1, 0.1, 2.3], [69, 0.15, 0.085, 2.2], [76, 0.21, 0.075, 2.0], [86, 0.46, 0.03, 1.5]];
      let last = at;
      for (const [midi, wait, amp, ring] of notes) {
        const f = hz(midi), from = at + wait;
        for (const [ratio, share, length] of [[1, 1, 1], [2.003, 0.3, 0.62], [3.012, 0.1, 0.36], [5.43, 0.055, 0.07]]) {
          if (f * ratio > 9000) continue;
          const o = ctx.createOscillator(), g = gain(0), len = Math.max(0.09, ring * length);
          o.type = 'sine'; o.frequency.value = f * ratio;
          g.gain.setValueAtTime(0, from); g.gain.linearRampToValueAtTime(amp * share * level, from + 0.007); g.gain.exponentialRampToValueAtTime(0.0004, from + len); g.gain.setTargetAtTime(0, from + len, 0.02);
          o.connect(g); g.connect(bus);
          run(o, from, from + len + 0.15);
          last = Math.max(last, from + len + 0.15);
        }
      }
      for (const [midi, detune] of [[50, -4], [50, 5], [57, 3]]) {
        const o = ctx.createOscillator(), g = gain(0);
        o.type = 'triangle'; o.frequency.value = hz(midi); o.detune.value = detune;
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.03 * level, at + 0.3); g.gain.setTargetAtTime(0, at + 0.7, 0.45);
        o.connect(g); g.connect(bus);
        run(o, at, at + 2.9);
      }
    },
  };

  let closed = false;
  return {
    cue(name, ...args) { if (closed) return; try { cues[name](ctx.currentTime + 0.03, ...args); info.cues.push(name); } catch { /* a browser without a node type: that sound is left out */ } },
    // the tab hidden: quiet until it is back
    duck(on) { if (!closed) out.gain.setTargetAtTime(on ? 0 : LEVEL, ctx.currentTime, 0.04); },
    // fade, then let go of every source and node
    end(fast) {
      if (closed) return;
      closed = true;
      release();
      const now = ctx.currentTime, fade = fast ? 0.12 : 0.5;
      out.gain.cancelScheduledValues(now); out.gain.setValueAtTime(out.gain.value, now); out.gain.linearRampToValueAtTime(0, now + fade);
      setTimeout(() => {
        for (const s of [...live]) { try { s.stop(); } catch { /* not started */ } }
        for (const n of nodes) { try { n.disconnect(); } catch { /* already out */ } }
        if (own) ctx.close?.();
      }, fade * 1000 + 120);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
const CSS = '#ident { position: fixed; inset: 0; z-index: 2147483000; margin: 0; opacity: 0; overflow: hidden; background: #f3f1ec; direction: ltr; outline: none; cursor: default; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; contain: strict; }'
  + ' #ident canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }';
const SWALLOW = ['click', 'dblclick', 'auxclick', 'contextmenu', 'pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchend', 'touchmove', 'touchcancel', 'keydown', 'keyup', 'keypress', 'wheel'];

// sound: the game's Sound (its start(), setPaused(), muted and ctx are used); game: its hold flag stops the
// world being drawn behind the ident
export function installIdent({ sound = null, game = null } = {}) {
  const api = { state: 'idle', played: false, t: 0, phase: 'idle', reduced: false, frames: 0, drawMs: 0, sound: { started: false, voices: 0, cues: [] }, skip: () => false };
  window.__ident = api;
  if (navigator.webdriver && window.__identForce !== true) return api; // automated browsers go straight through

  const onStart = (e) => {
    if (api.state !== 'idle') return;
    const btn = e.target?.closest?.(BUTTONS);
    if (!btn || btn.disabled) return;
    e.preventDefault(); e.stopImmediatePropagation();
    removeEventListener('click', onStart, true);
    play(btn);
  };
  addEventListener('click', onStart, true);

  let handing = false; // the click on its way on: the ident's own listeners let it through
  const hand = (btn) => { handing = true; try { if (btn.isConnected && !btn.disabled) btn.click(); } finally { handing = false; } };

  function play(btn) {
    api.state = 'playing'; api.played = true;
    const reduced = api.reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const audio = openAudio(sound, api.sound);
    // the tap also blesses the page's films: the opening film that may follow starts without a tap of its
    // own, and a phone that lets sound start only inside a tap would otherwise play it silent
    for (const v of document.querySelectorAll('video')) { if (!v.paused) continue; try { v.play()?.catch?.(() => {}); v.pause(); } catch { /* not loaded: it asks for its own tap */ } }
    const held = game ? game.hold : false;
    if (game) game.hold = true;

    const style = document.createElement('style'), root = document.createElement('div'), canvas = document.createElement('canvas');
    style.id = 'identStyle'; style.textContent = CSS;
    root.id = 'ident'; root.tabIndex = -1; root.setAttribute('role', 'img'); root.setAttribute('aria-label', 'Sherzer Production');
    root.append(canvas);

    let scene = null, t = 0, last = performance.now(), raf = 0, frames = 0, spent = 0, turned = 0;
    let out = null;          // the way out once it has begun: { k: 0..1, dur, skipped, since }
    let over = false;
    const still = B.end - 0.1; // the frame the still version shows
    const layout = () => { scene = makeScene(canvas, Math.max(1, innerWidth), Math.max(1, innerHeight)); scene.draw(reduced ? still : t); };
    const turn = () => { clearTimeout(turned); turned = setTimeout(() => { if (!over) layout(); }, 250); }; // a phone reports its new size a moment after it turns

    const total = reduced ? STILL.end : B.end, fadeIn = reduced ? STILL.fadeIn : B.fadeIn;
    const cued = new Set();
    const cue = (name, at, ...args) => { if (t >= at && !cued.has(name)) { cued.add(name); audio.cue(name, ...args); } };

    // the way out: the world let go, the sound faded, the click that started it handed on to whoever was
    // waiting for it, and the stage dissolving over what comes next
    const leave = (skipped) => {
      if (out) return false;
      out = { k: 0, dur: skipped ? SKIP_FADE : reduced ? STILL.fadeOut : B.fadeOut, skipped, since: performance.now() };
      api.phase = 'out';
      if (game) game.hold = held;
      audio.end(skipped);
      hand(btn);
      return true;
    };
    api.skip = () => (api.state === 'playing' && t >= GUARD ? leave(true) : false);

    const down = new Set(); // pointers still pressed: their release belongs to the ident too
    const plain = (e) => !(e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key || '')); // not a shortcut of the browser's
    const swallow = (e) => {
      if (handing) return;
      e.stopImmediatePropagation();
      if (e.type.startsWith('key')) { if (plain(e)) e.preventDefault(); } else if (e.cancelable && e.type !== 'pointermove' && e.type !== 'mousemove') e.preventDefault();
      if (e.type === 'pointerdown') down.add(e.pointerId);
      else if (e.type === 'pointerup' || e.type === 'pointercancel') down.delete(e.pointerId);
      if (over) return;
      if (e.type === 'pointerdown' || e.type === 'touchstart' || e.type === 'mousedown' || (e.type === 'keydown' && !e.repeat && plain(e) && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key))) api.skip();
    };
    const onVisible = () => { last = performance.now(); audio.duck(document.hidden); };

    const finish = () => {
      over = true;
      cancelAnimationFrame(raf); clearTimeout(turned);
      removeEventListener('resize', layout); removeEventListener('orientationchange', turn);
      document.removeEventListener('visibilitychange', onVisible);
      root.remove(); style.remove();
      scene = null;
      api.state = 'done'; api.phase = 'done'; api.skip = () => false;
      // the tail of the tap that skipped it (its release, its click) is still the ident's
      setTimeout(() => { for (const type of SWALLOW) removeEventListener(type, swallow, { capture: true }); }, 90);
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const real = document.hidden ? 0 : Math.min((now - last) / 1000, 0.5);
      last = now;
      const speed = Number(window.__identSpeed ?? 1);
      if (out) { out.k += real / out.dur; t += real; } else t += real * (speed >= 0 ? speed : 1);
      if (!out) {
        api.phase = phaseAt(t, reduced);
        if (reduced) cue('chord', 0.1, 0.8);
        else {
          cue('whoosh', B.ribbons, (B.bloom - B.ribbons - 0.05) / Math.max(1, speed));
          cue('thump', B.bloom - 0.03);
          cue('chord', B.word + 0.08);
        }
        if (t >= total) { t = total; leave(false); }
      }
      api.t = t;
      if (!reduced) {
        const from = performance.now();
        try { scene.draw(t); } catch (err) { console.warn('ident:', err); leave(true); out.k = 1; } // a picture that cannot be drawn: straight on to the game
        spent += performance.now() - from; api.frames = ++frames; api.drawMs = spent / frames;
      }
      root.style.opacity = String(clamp(t / fadeIn) * (out ? 1 - clamp(out.k) : 1));
      // gone once the fade is through and the finger that skipped it is up (or a moment later all the same)
      if (out && out.k >= 1 && (!down.size || now - out.since > out.dur * 1000 + 1200)) finish();
    };

    try {
      layout();
      document.head.append(style); document.body.append(root);
      root.focus({ preventScroll: true }); // the start button no longer has the keyboard
      for (const type of SWALLOW) addEventListener(type, swallow, { capture: true, passive: false });
      document.addEventListener('visibilitychange', onVisible);
      addEventListener('resize', layout); addEventListener('orientationchange', turn);
      raf = requestAnimationFrame(frame);
    } catch (err) {
      // no canvas to draw on: no ident, and the press goes on as if it had never been caught
      console.warn('ident:', err);
      cancelAnimationFrame(raf);
      for (const type of SWALLOW) removeEventListener(type, swallow, { capture: true });
      removeEventListener('resize', layout); removeEventListener('orientationchange', turn);
      document.removeEventListener('visibilitychange', onVisible);
      root.remove(); style.remove();
      api.state = 'done'; api.phase = 'done'; api.skip = () => false;
      if (game) game.hold = held;
      audio.end(true);
      hand(btn);
    }
  }

  return api;
}
