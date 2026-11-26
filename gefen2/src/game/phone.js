// ============================================================================
//  The player's phone: signal, messages, incoming calls.
// ============================================================================
import { UI, SPEAKERS } from '../story.js';
import { audio } from '../engine/audio.js';
import { esc } from '../ui/dom.js';

export class Phone {
  constructor(S) {
    this.S = S;
    this.signal = 0; // 0..4 bars
    this.status = 'No Signal';
    this.msgs = [];
    this.unread = 0;
    this.open = false;
    this.ringing = null; // { who, resolve }
    this.dialLabel = null;
    this.onDial = null;
  }

  setSignal(bars, status = null) {
    this.signal = bars;
    this.status = status ?? (bars > 0 ? '' : 'No Signal');
  }

  message(who, text, silent = false) {
    const sp = SPEAKERS[who] || SPEAKERS.sys;
    this.msgs.push({ who: sp.name || '', color: sp.color, text });
    if (!this.open) this.unread++;
    if (!silent) {
      audio.msgPing?.(0.2);
      this.S.hud.toast(`💬 ${sp.name}: ${text}`, 6, 'msg');
    }
    this.render();
  }

  /** Ring until answered. Resolves when the player picks up. */
  ring(who) {
    return new Promise((resolve) => {
      this.ringing = { who, resolve };
      audio.phoneRing?.();
      const el = this.S.hud.$('.call');
      el.hidden = false;
      el.classList.remove('live');
      el.querySelector('.call-who').textContent = who;
      el.querySelector('.call-answer').hidden = false;
    });
  }

  answer() {
    if (!this.ringing) return;
    audio.stopLoop('ring', 0.05);
    audio.click(0.3);
    const el = this.S.hud.$('.call');
    el.classList.add('live');
    el.querySelector('.call-answer').hidden = true;
    const r = this.ringing;
    this.ringing = null;
    r.resolve();
  }

  hangup() {
    audio.stopLoop('ring', 0.05);
    this.ringing = null;
    this.S.hud.$('.call').hidden = true;
  }

  toggle(force = null) {
    this.open = force ?? !this.open;
    if (this.open) this.unread = 0;
    this.S.hud.$('.phone').hidden = !this.open;
    audio.click(0.15);
    this.render();
  }

  setDial(label, fn) {
    this.dialLabel = label;
    this.onDial = fn;
    this.render();
  }

  dial() {
    this.onDial?.();
  }

  render() {
    const hud = this.S.hud;
    if (!hud) return;
    const st = hud.$('.ph-status');
    st.textContent = this.status || `${UI.phone}`;
    const list = hud.$('.ph-list');
    list.innerHTML = this.msgs.length
      ? this.msgs.map((m) => `<div class="pm"><b style="color:${m.color}">${esc(m.who)}</b><span>${esc(m.text)}</span></div>`).join('')
      : `<div class="pm empty">—</div>`;
    list.scrollTop = list.scrollHeight;
    const d = hud.$('.ph-dial');
    d.hidden = !this.dialLabel;
    if (this.dialLabel) d.textContent = this.dialLabel;
  }
}
