// ============================================================================
//  Visual-novel style dialogue box (typewriter + voice + click to continue)
// ============================================================================
import { SPEAKERS, UI as TXT } from '../story.js';
import { voice } from '../engine/voice.js';
import { audio } from '../engine/audio.js';
import { h, esc } from './dom.js';

export class Dialogue {
  constructor(root, { skippable = true } = {}) {
    this.root = root;
    this.el = h(`<div class="dialog"><div class="name"></div><div class="text"></div><div class="next" hidden>${TXT.next}</div></div>`);
    this.nameEl = this.el.querySelector('.name');
    this.textEl = this.el.querySelector('.text');
    this.nextEl = this.el.querySelector('.next');
    this.skipped = false;
    this._advance = null;
    this.el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.advance();
    });
    this._key = (e) => {
      if (['Space', 'Enter', 'ArrowLeft', 'NumpadEnter'].includes(e.code)) {
        e.preventDefault();
        this.advance();
      }
      if (e.code === 'Escape' && skippable) this.skip();
    };
    window.addEventListener('keydown', this._key);
    if (skippable) {
      this.skipBtn = h(`<button class="btn small ghost skip">${TXT.skip} ⏭</button>`);
      this.skipBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.skip();
      });
      root.appendChild(this.skipBtn);
    }
    root.appendChild(this.el);
  }

  advance() {
    if (this._advance) this._advance();
  }

  skip() {
    this.skipped = true;
    voice.cancel();
    this.advance();
  }

  destroy() {
    window.removeEventListener('keydown', this._key);
    voice.cancel();
    this.el.remove();
    this.skipBtn?.remove();
  }

  async play(lines, { onLine, onFx } = {}) {
    for (const line of lines) {
      if (this.skipped) break;
      onLine?.(line);
      if (line.fx && onFx) await onFx(line.fx, line);
      if (this.skipped) break;
      await this.say(line);
    }
    this.destroy();
    return !this.skipped;
  }

  say(line) {
    const sp = SPEAKERS[line.who] || SPEAKERS.narrator;
    this.nameEl.textContent = sp.name;
    this.nameEl.style.display = sp.name ? '' : 'none';
    this.nameEl.style.color = sp.color;
    this.textEl.className = 'text' + (sp.demon ? ' demon' : '') + (line.who === 'narrator' ? ' narrator' : '');
    this.textEl.textContent = '';
    this.nextEl.hidden = true;
    const chars = [...line.text];
    let shown = 0;
    let typed = false;
    let voiced = false;
    const useVoice = voice.available && !!sp.voice;
    const speedMs = sp.demon ? 55 : 30;
    return new Promise((resolve) => {
      let autoTimer = 0;
      let typeTimer = 0;
      const finishTyping = () => {
        typed = true;
        clearInterval(typeTimer);
        this.textEl.textContent = line.text;
        this.nextEl.hidden = false;
        maybeAuto();
      };
      const maybeAuto = () => {
        if (!typed || (!voiced && useVoice)) return;
        clearTimeout(autoTimer);
        autoTimer = setTimeout(() => this.advance(), 1800 + chars.length * 38);
      };
      this._advance = () => {
        if (!typed && !this.skipped) return finishTyping();
        clearTimeout(autoTimer);
        clearInterval(typeTimer);
        voice.cancel();
        this._advance = null;
        resolve();
      };
      typeTimer = setInterval(() => {
        if (shown >= chars.length) return finishTyping();
        shown++;
        this.textEl.textContent = chars.slice(0, shown).join('');
        if (!useVoice && shown % 2 === 0 && chars[shown - 1] !== ' ') audio.blip(sp.demon ? 0.45 : (sp.voice?.pitch || 1), sp.demon ? 0.08 : 0.04);
      }, speedMs);
      if (useVoice) {
        voice.speak(line, sp.voice).then(() => {
          voiced = true;
          maybeAuto();
        });
      } else voiced = true;
      if (this.skipped) this.advance();
    });
  }
}

/** Speak one line without a dialogue box (used for the demon line) */
export function speakLine(line) {
  const sp = SPEAKERS[line.who];
  return voice.speak(line, sp?.voice);
}

export function speakerName(who) {
  return esc((SPEAKERS[who] || {}).name || '');
}
