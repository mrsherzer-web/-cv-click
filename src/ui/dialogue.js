// Spoken lines at the bottom of the screen, one at a time, with the speaker's name in their color.
// Lines move on by themselves (longer lines stay longer); a tap on the caption moves on sooner.
export const VOICES = {
  נהוראי: '#ffb547',
  אברהם: '#7cc8ff',
  יונתי: '#a8e07c',
  ארז: '#ff9180',
  מולר: '#d6a8ff',
  דולב: '#f5d04a',
};

export class Dialogue {
  constructor(el) {
    this.el = el;           // the caption element
    this.queue = [];
    this.current = null;
    this.left = 0;
    this.done = null;
    el.addEventListener('pointerdown', (e) => { if (this.current) { e.stopPropagation(); this.left = 0; } });
  }

  get busy() { return !!this.current || this.queue.length > 0; }

  // lines: [who, text] pairs or { who, text, ms }; resolves when the last line has been shown
  play(lines) {
    this.stop();
    this.queue = lines.map((l) => (Array.isArray(l) ? { who: l[0], text: l[1] } : l));
    return new Promise((resolve) => { this.done = resolve; this.next(); });
  }

  stop() {
    this.queue = [];
    this.current = null;
    this.el.hidden = true;
    const d = this.done;
    this.done = null;
    d?.();
  }

  next() {
    this.current = this.queue.shift() || null;
    if (!this.current) { this.stop(); return; }
    const { who, text, ms } = this.current;
    this.left = (ms ?? Math.max(2200, 62 * text.length)) / 1000;
    this.el.replaceChildren();
    if (who) {
      const name = document.createElement('b');
      name.textContent = `${who}: `;
      name.style.color = VOICES[who] || 'var(--accent)';
      this.el.append(name);
    }
    this.el.append(text);
    this.el.hidden = false;
  }

  update(dt) {
    if (!this.current) return;
    this.left -= dt;
    if (this.left <= 0) this.next();
  }
}
