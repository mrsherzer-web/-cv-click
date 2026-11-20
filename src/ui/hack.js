// "The computer": a game on Nehorai's screen for chapter six, written like a memory game and nothing
// else — a map of nodes lights up along a route, and the route has to be tapped back in the same
// order before a trace bar fills. Three rounds, each a node longer and a little faster. Nothing here
// is, or hints at, a real technique; it is a Simon game in a terminal's clothes.
import { rng } from '../core/math.js';

const COLS = 4, ROWS = 3;
const ROUTE = [4, 5, 6];        // nodes per round
const SHOW = [0.62, 0.52, 0.44]; // seconds per node while the route is shown
const TRACE_RATE = [2.6, 3.4, 4.2]; // trace percent per second while it is your turn
const MISTAKE = 14;             // trace percent for a wrong tap

export class Hack {
  constructor(game, root) {
    this.game = game;
    this.root = root;             // #hack
    this.active = false;
    this.r = rng(606);
    this.onRound = null;          // (round index that just finished)
    this.onFail = null;           // the trace filled
    this.resolve = null;
    this.state = 'idle';          // 'show' | 'play' | 'done'
    this.trace = 0;
    this.round = 0;
    this.route = [];
    this.pos = 0;
    this.t = 0;
    this.nodes = [];
    this.build();
  }

  build() {
    const root = this.root; if (!root) return;
    root.innerHTML = `
      <div class="hack-head"><span class="hack-title">איתור השרת של הצופן</span><span class="hack-round" id="hackRound"></span></div>
      <div class="hack-hint" id="hackHint">הנתיב מהבהב. לחזור עליו באותו סדר.</div>
      <svg class="hack-map" id="hackMap" viewBox="0 0 400 300" aria-label="מפת הנתיב"></svg>
      <div class="hack-trace"><span>איתור נגדי</span><div class="hack-bar"><i id="hackBar"></i></div></div>`;
    const svg = root.querySelector('#hackMap');
    const NS = 'http://www.w3.org/2000/svg';
    const px = (c) => 60 + c * (280 / (COLS - 1)), py = (r) => 50 + r * (200 / (ROWS - 1));
    // edges between neighbours
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        const c2 = c + dc, r2 = r + dr; if (c2 < 0 || c2 >= COLS || r2 < 0 || r2 >= ROWS) continue;
        if (dc && dr && (c + r) % 2) continue; // only some diagonals, so the map reads as a net
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', px(c)); l.setAttribute('y1', py(r)); l.setAttribute('x2', px(c2)); l.setAttribute('y2', py(r2));
        l.setAttribute('class', 'hack-edge'); svg.append(l);
      }
    }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'hack-node'); g.dataset.i = r * COLS + c;
      const o = document.createElementNS(NS, 'circle'); o.setAttribute('cx', px(c)); o.setAttribute('cy', py(r)); o.setAttribute('r', 20); g.append(o);
      const t = document.createElementNS(NS, 'text'); t.setAttribute('x', px(c)); t.setAttribute('y', py(r) + 5); t.setAttribute('text-anchor', 'middle'); t.textContent = String(r * COLS + c + 1).padStart(2, '0'); g.append(t);
      g.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.tap(r * COLS + c); });
      svg.append(g);
      this.nodes.push(g);
    }
    this.el = { round: root.querySelector('#hackRound'), hint: root.querySelector('#hackHint'), bar: root.querySelector('#hackBar') };
  }

  // begins the game; resolves true when the three rounds are done, false when the trace fills
  start({ onRound = null, onFail = null } = {}) {
    if (!this.root) return Promise.resolve(true);
    this.onRound = onRound; this.onFail = onFail;
    this.active = true; this.trace = 0; this.round = 0;
    this.root.hidden = false;
    this.root.classList.add('on');
    this.beginRound();
    return new Promise((res) => { this.resolve = res; });
  }

  neighbours(i) {
    const c = i % COLS, r = Math.floor(i / COLS), out = [];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const c2 = c + dc, r2 = r + dr; if (c2 < 0 || c2 >= COLS || r2 < 0 || r2 >= ROWS) continue;
      if (dc && dr) { const lo = Math.min(c, c2), lr = dc * dr > 0 ? Math.min(r, r2) : Math.max(r, r2); if ((lo + lr) % 2) continue; } // the diagonals that exist
      out.push(r2 * COLS + c2);
    }
    return out;
  }

  beginRound() {
    const n = ROUTE[this.round];
    // a random walk without repeats
    let route;
    for (let tries = 0; tries < 50; tries++) {
      route = [Math.floor(this.r() * COLS * ROWS)];
      while (route.length < n) {
        const opts = this.neighbours(route[route.length - 1]).filter((k) => !route.includes(k));
        if (!opts.length) break;
        route.push(opts[Math.floor(this.r() * opts.length)]);
      }
      if (route.length === n) break;
    }
    this.route = route; this.pos = 0; this.t = 0; this.state = 'show';
    this.el.round.textContent = `שלב ${this.round + 1}/${ROUTE.length}`;
    this.el.hint.textContent = 'הנתיב מהבהב. לזכור את הסדר.';
    for (const g of this.nodes) g.classList.remove('lit', 'ok', 'bad');
  }

  tap(i) {
    if (!this.active || this.state !== 'play') return;
    const want = this.route[this.pos];
    const g = this.nodes[i];
    if (i === want) {
      g.classList.add('ok'); this.pos++;
      this.game.sound?.tick?.();
      if (this.pos >= this.route.length) {
        this.state = 'done';
        this.el.hint.textContent = 'הנתיב נפתח.';
        const r = this.round;
        setTimeout(() => {
          this.onRound?.(r);
          if (r + 1 >= ROUTE.length) this.finish(true);
          else { this.round = r + 1; this.beginRound(); }
        }, 700);
      }
    } else {
      g.classList.add('bad');
      this.trace = Math.min(100, this.trace + MISTAKE);
      this.el.hint.textContent = 'חסימה. הנתיב מהבהב שוב.';
      this.game.sound?.hit?.('block', 0.6);
      setTimeout(() => { if (this.active) { this.pos = 0; this.t = 0; this.state = 'show'; for (const n of this.nodes) n.classList.remove('lit', 'ok', 'bad'); } }, 600);
      this.state = 'wait';
    }
  }

  update(dt) {
    if (!this.active) return;
    if (this.state === 'show') {
      this.t += dt;
      const step = SHOW[this.round], k = Math.floor(this.t / step);
      for (const [j, idx] of this.route.entries()) this.nodes[idx].classList.toggle('lit', j === k);
      if (k >= this.route.length) { this.state = 'play'; this.el.hint.textContent = 'עכשיו אתה: באותו סדר.'; for (const n of this.nodes) n.classList.remove('lit'); }
    } else if (this.state === 'play') {
      this.trace = Math.min(100, this.trace + TRACE_RATE[this.round] * dt);
    }
    this.el.bar.style.width = `${this.trace}%`;
    this.el.bar.classList.toggle('hot', this.trace > 70);
    if (this.trace >= 100 && this.state !== 'done') { this.finish(false); }
  }

  finish(ok) {
    if (!this.active) return;
    this.active = false; this.state = 'idle';
    setTimeout(() => { this.root.hidden = true; this.root.classList.remove('on'); }, ok ? 600 : 200);
    if (!ok) this.onFail?.();
    const res = this.resolve; this.resolve = null;
    res?.(ok);
  }

  close() { if (this.active) this.finish(false); else if (this.root) { this.root.hidden = true; this.root.classList.remove('on'); } }

  // for the tests: completes every round at once
  solve() { if (!this.active) return; const r = this.round; this.onRound?.(r); for (let k = r + 1; k < ROUTE.length; k++) this.onRound?.(k); this.finish(true); }
}
