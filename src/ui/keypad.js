// A door keypad (chapter seven): four digits, a code found elsewhere in the fort. Wrong codes shake
// and clear; the right one opens the door. A game prop and nothing more.
export class Keypad {
  constructor(game, root) {
    this.game = game; this.root = root; this.resolve = null; this.code = ''; this.entry = '';
    if (!root) return;
    root.innerHTML = `<div class="pad"><div class="show" id="kpShow">· · · ·</div>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button type="button" data-d="${d}">${d}</button>`).join('')}<button type="button" data-d="c">✕</button><button type="button" data-d="0">0</button><button type="button" data-d="x">סגור</button><div class="hint" id="kpHint">הקוד מארבע ספרות. הפתק בחדר הבקרה.</div></div>`;
    this.show = root.querySelector('#kpShow'); this.hint = root.querySelector('#kpHint');
    root.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      const d = b.dataset.d;
      if (d === 'x') return this.close(false);
      if (d === 'c') { this.entry = ''; this.paint(); return; }
      if (this.entry.length >= 4) return;
      this.entry += d; this.paint();
      if (this.entry.length === 4) this.check();
    });
  }
  paint(cls = '') { this.show.textContent = (this.entry + '····').slice(0, 4).split('').join(' '); this.show.className = `show ${cls}`; }
  open(code, hint) {
    if (!this.root) return Promise.resolve(true);
    this.code = code; this.entry = ''; this.paint();
    if (hint) this.hint.textContent = hint;
    this.root.hidden = false;
    this.game.cutscene = true;
    return new Promise((res) => { this.resolve = res; });
  }
  check() {
    if (this.entry === this.code) { this.paint('ok'); this.game.sound?.chime?.(true); setTimeout(() => this.close(true), 500); }
    else { this.paint('bad'); this.game.sound?.hit?.('block', 0.6); this.game.hud.toast('קוד שגוי', 1200); setTimeout(() => { this.entry = ''; this.paint(); }, 600); }
  }
  close(ok) { if (!this.root) return; this.root.hidden = true; this.game.cutscene = false; const r = this.resolve; this.resolve = null; r?.(ok); }
  // for the tests
  enter(code) { this.entry = code; this.paint(); this.check(); }
}
