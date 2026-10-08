// DOM user interface: HUD, objectives, dialogue (incl. walkie-talkie), notes, keypad,
// phone, photos, night cards, jumpscare, menus and screens.
import { IMAGES } from './assets.js';
import { audio } from './audio.js';
import { sleep, clamp, isTouchDevice } from './util.js';
import { NOAM_SCARE_EYES } from './characters.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const MESSENGER_NAME = 'חבר מהקומונה';

export const SPEAKERS = {
  noam: { name: 'נועם', img: IMAGES.noam, cls: 'danger' },
  ori: { name: 'אורי', img: IMAGES.ori },
  oriRadio: { name: 'אורי (בקשר)', img: IMAGES.ori, cls: 'walkie', radio: true },
  yarin: { name: 'ירין (בקשר)', img: IMAGES.yarin, cls: 'walkie', radio: true },
  yarinLive: { name: 'ירין', img: IMAGES.yarin },
  msg: { name: MESSENGER_NAME, img: IMAGES.messenger },
  me: { name: 'אתה', img: null, cls: 'noportrait' },
  sys: { name: '', img: null, cls: 'noportrait' },
};

const ITEM_INFO = {
  flashlight: ['🔦', 'פנס'], walkie: ['📻', 'מכשיר קשר'], diary: ['📔', 'יומן הקומונה'], key_entrance: ['🔑', 'מפתח הכניסה'],
  key_panel: ['🗝️', 'מפתח לוח החשמל'], fuse: ['⚡', 'נתיך'], phone_ori: ['📱', 'הטלפון של אורי'], controller: ['🎮', 'השלט של הפלייסטיישן'],
  key_storage: ['🔑', 'מפתח המחסן'], mask: ['👹', 'המסכה'], lighter: ['🔥', 'מצית'],
};

export class UI {
  constructor(game) {
    this.game = game;
    this.touch = isTouchDevice();
    if (this.touch) document.body.classList.add('touch');
    this.prompt = $('#prompt');
    this._dialogQueue = Promise.resolve();
    this._toastT = null;
    this.objectives = [];
    $('#rotateHint').addEventListener('click', () => document.body.classList.add('noRotate'));
    $('#rotateHint').addEventListener('touchstart', () => document.body.classList.add('noRotate'));
    // overlays close buttons
    for (const id of ['note', 'photoView', 'phone']) $(`#${id} .close`).addEventListener('click', () => this._closeOverlay(id));
    $('#keypad .close').addEventListener('click', () => this._closeOverlay('keypad'));
    $('#dialog').addEventListener('click', () => { this._skip = true; });
  }

  show(id, on = true) { $(id).classList.toggle('hidden', !on); }

  setHud(on) {
    this.show('#hud', on);
    $('#touch').classList.toggle('play', on);
    document.body.classList.toggle('playing', on);
  }

  // ---------- HUD ----------
  setClock(text) { $('#clock').textContent = text; }
  setNightLabel(text) { $('#nightLabel').textContent = text; }

  setPrompt(text, progress = 0, hold = false) {
    const p = this.prompt;
    if (!text) { if (!p.classList.contains('hidden')) p.classList.add('hidden'); $('#crosshair').classList.remove('active'); return; }
    p.classList.remove('hidden');
    $('#crosshair').classList.add('active');
    const t = $('.txt', p);
    const label = hold ? text + ' (להחזיק)' : text;
    if (t.textContent !== label) t.textContent = label;
    $('.key', p).textContent = 'E';
    p.classList.toggle('hold', hold);
    if (hold) $('.ring circle', p).style.strokeDashoffset = String(100.5 * (1 - clamp(progress, 0, 1)));
  }

  setObjectives(list) {
    this.objectives = list;
    const ul = $('#objectives ul');
    const old = new Map($$('li', ul).map((li) => [li.dataset.id, li]));
    ul.innerHTML = '';
    for (const o of list) {
      if (o.hidden) continue;
      const li = document.createElement('li');
      li.dataset.id = o.id;
      li.innerHTML = o.text + (o.sub ? `<span class="sub">${o.sub}</span>` : '');
      if (o.done) li.classList.add('done');
      if (!old.has(o.id)) li.classList.add('new');
      ul.appendChild(li);
    }
  }

  setSleepMeter(v, visible, label = 'נועם ישן') {
    const el = $('#sleepMeter');
    el.classList.toggle('hidden', !visible);
    if (!visible) return;
    $('.bar i', el).style.width = clamp(v, 0, 100) + '%';
    $('.lid', el).style.transform = `scaleY(${1 - clamp(v / 100, 0, 1) * 0.85})`;
    $('.lbl', el).textContent = v > 70 ? 'נועם מתעורר!' : v > 40 ? 'נועם מתהפך...' : label;
    el.classList.toggle('alert', v > 70);
  }

  setAwareness(v) { $('#awareness').classList.toggle('hidden', v < 0.25); $('#awareness').style.opacity = String(clamp(v, 0.25, 1)); }

  setStamina(v, exhausted) {
    const s = $('#stamina');
    s.classList.toggle('show', v < 0.99);
    s.classList.toggle('ex', exhausted);
    $('i', s).style.width = v * 100 + '%';
  }

  setBattery(v, visible) {
    const b = $('#battery');
    b.classList.toggle('hidden', !visible);
    $('i', b).style.width = clamp(v, 0, 1) * 100 + '%';
    b.classList.toggle('low', v < 0.2);
  }

  setBreath(visible, v, urgent) {
    const b = $('#breath');
    b.classList.toggle('hidden', !visible);
    $('#btnBreath').classList.toggle('hidden', !visible);
    if (!visible) return;
    $('i', b).style.width = clamp(v, 0, 1) * 100 + '%';
    b.classList.toggle('urgent', urgent);
    if (this.touch) $('.hint', b).innerHTML = 'החזק את 😮‍💨 כדי לעצור את הנשימה';
  }

  setHideOverlay(kind) {
    const o = $('#hideOverlay');
    o.className = kind ? 'on ' + kind : '';
  }

  refreshInventory(inv) {
    const el = $('#inventory');
    el.innerHTML = '';
    for (const k of inv) {
      const info = ITEM_INFO[k]; if (!info) continue;
      const d = document.createElement('div'); d.className = 'it'; d.textContent = `${info[0]} ${info[1]}`; el.appendChild(d);
    }
  }

  toast(text, ms = 2600) {
    const t = $('#toast');
    t.textContent = text; t.classList.add('on');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('on'), ms);
  }

  walkieIcon(on) { $('#walkieIcon').classList.toggle('hidden', !on); }

  // short floating subtitle (Noam's taunts etc.)
  subtitle(who, text, { danger = false, time = 2.5 } = {}) {
    const s = $('#subtitle');
    s.innerHTML = `<span class="who">${who}</span>${text}`;
    s.style.color = danger ? '#ff4b4b' : '#eee';
    s.classList.add('on');
    clearTimeout(this._subT);
    this._subT = setTimeout(() => s.classList.remove('on'), time * 1000);
  }

  // ---------- dialogue ----------
  // Lines are queued; returns a promise resolving when this line is done.
  say(speaker, text, opts = {}) {
    const p = this._dialogQueue.then(() => this._sayNow(speaker, text, opts));
    this._dialogQueue = p.catch(() => {});
    return p;
  }

  async _sayNow(speakerKey, text, { wait = false, hold, abort } = {}) {
    if (abort && abort.aborted) return;
    const sp = SPEAKERS[speakerKey] || SPEAKERS.sys;
    const d = $('#dialog');
    d.className = sp.cls || '';
    $('.name', d).textContent = sp.name;
    const img = $('.portrait', d);
    if (sp.img) img.src = sp.img;
    const tx = $('.text', d);
    tx.textContent = '';
    d.classList.remove('hidden');
    if (sp.radio) { audio.squelch(); audio.staticBed(Math.min(6, 1 + text.length * 0.05)); this.walkieIcon(true); }
    else if (speakerKey === 'noam') { if (this.game.noam && this.game.noam.em) audio.demonVoice(this.game.noam.em.input, Math.min(3, text.length * 0.07)); }
    else if (speakerKey !== 'sys' && speakerKey !== 'me') audio.murmur(audio.voice, Math.min(3.5, text.length * 0.05), speakerKey === 'msg' ? 0.85 : speakerKey === 'yarinLive' ? 1.5 : 1);
    this._skip = false;
    if (this.instant) { tx.textContent = text; this.log = (this.log || []).concat(`${sp.name}: ${text}`); await sleep(5); d.classList.add('hidden'); return; }
    const chars = [...text];
    for (let i = 0; i < chars.length; i++) {
      if (this._skip) { tx.textContent = text; break; }
      tx.textContent += chars[i];
      if (i % 2 === 0) await sleep(22);
      if (abort && abort.aborted) break;
    }
    tx.textContent = text;
    this._skip = false;
    const minHold = hold ?? 1.4 + text.length * 0.045;
    if (wait) {
      d.classList.add('wait');
      const t0 = performance.now();
      await new Promise((res) => {
        const tick = () => {
          if ((abort && abort.aborted) || this._skip || (this.game.input.consume('interact') && performance.now() - t0 > 250)) return res();
          if (performance.now() - t0 > (minHold + 6) * 1000) return res();
          requestAnimationFrame(tick);
        };
        tick();
      });
      d.classList.remove('wait');
    } else {
      const t0 = performance.now();
      while (performance.now() - t0 < minHold * 1000) {
        if (this._skip || (abort && abort.aborted)) break;
        await sleep(50);
      }
    }
    this._skip = false;
    if (sp.radio) { audio.squelch(); this.walkieIcon(false); }
    d.classList.add('hidden');
    await sleep(120);
  }

  clearDialog() {
    this._dialogQueue = Promise.resolve();
    $('#dialog').classList.add('hidden');
    this._skip = true;
    this.walkieIcon(false);
  }

  // ---------- overlays ----------
  _openOverlay(id) {
    $('#' + id).classList.remove('hidden');
    this.game.setOverlay(true);
    return new Promise((res) => { this['_res_' + id] = res; });
  }
  _closeOverlay(id, val) {
    $('#' + id).classList.add('hidden');
    this.game.setOverlay(false);
    const r = this['_res_' + id]; this['_res_' + id] = null;
    if (r) r(val);
  }
  overlayOpen() { return ['note', 'photoView', 'phone', 'keypad'].some((id) => !$('#' + id).classList.contains('hidden')); }
  closeTopOverlay(includeKeypad = true) { for (const id of ['note', 'photoView', 'phone', 'keypad']) if (!$('#' + id).classList.contains('hidden')) { if (id === 'keypad' && !includeKeypad) return false; this._closeOverlay(id); return true; } return false; }

  showNote(html) {
    audio.paper();
    $('#note .content').innerHTML = html;
    return this._openOverlay('note');
  }

  showPhoto(src, caption) {
    audio.paper();
    $('#photoView img').src = src;
    $('#photoView .cap').textContent = caption;
    return this._openOverlay('photoView');
  }

  showPhone(msgs) {
    const box = $('#phone .msgs');
    box.innerHTML = '';
    const p = this._openOverlay('phone');
    msgs.forEach((m, i) => setTimeout(() => {
      const d = document.createElement('div');
      d.className = 'msg ' + (m.out ? 'out' : 'in') + (m.glitch ? ' glitch' : '');
      d.innerHTML = (m.from ? `<span class="from">${m.from}</span>` : '') + m.text;
      box.appendChild(d);
      audio.click(audio.now, audio.ui, 0.15, 3000);
    }, 350 + i * 650));
    return p;
  }

  keypad(check) {
    const pad = $('#keypad');
    const disp = $$('.display span', pad);
    const keys = $('.keys', pad);
    let code = '';
    const render = () => disp.forEach((s, i) => (s.textContent = code[i] || ''));
    keys.innerHTML = '';
    const press = (k) => {
      if (k === '⌫') code = code.slice(0, -1);
      else if (k === '✓') {
        if (code.length < 4) return;
        if (check(code)) {
          audio.beep(true); $('.display', pad).classList.add('ok');
          setTimeout(() => { $('.display', pad).classList.remove('ok'); this._closeOverlay('keypad', true); }, 600);
        } else {
          audio.beep(false); $('.display', pad).classList.add('bad');
          setTimeout(() => { $('.display', pad).classList.remove('bad'); code = ''; render(); }, 500);
        }
        return;
      } else if (code.length < 4) code += k;
      audio.beep(true); render();
    };
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓']) {
      const b = document.createElement('button'); b.textContent = k;
      b.addEventListener('click', () => press(k));
      keys.appendChild(b);
    }
    this._keyHandler = (e) => {
      if ($('#keypad').classList.contains('hidden')) return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Enter') press('✓');
    };
    removeEventListener('keydown', this._keyHandlerOld || (() => {}));
    addEventListener('keydown', this._keyHandler);
    this._keyHandlerOld = this._keyHandler;
    render();
    return this._openOverlay('keypad');
  }

  // ---------- transitions ----------
  fade(to, ms = 1200) {
    const f = $('#fade');
    f.style.transition = `opacity ${ms}ms`;
    f.style.opacity = to ? '1' : '0';
    return sleep(ms);
  }

  flash(ms = 120, color = '#fff') {
    const f = $('#flash');
    f.style.background = color;
    f.style.transition = 'none'; f.style.opacity = '1';
    requestAnimationFrame(() => { f.style.transition = `opacity ${ms}ms`; f.style.opacity = '0'; });
  }

  async nightCard(num, title, time) {
    const c = $('#nightCard');
    $('.num', c).textContent = num; $('.title', c).textContent = title; $('.time', c).textContent = time;
    c.classList.add('on');
    audio.boom(audio.now, audio.music, 0.9);
    await sleep(3200);
    c.classList.remove('on');
    await sleep(1200);
  }

  // ---------- jumpscare ----------
  async jumpscare() {
    const box = $('#jumpscare'), cv = $('canvas', box);
    const img = this.game.images.noamScare;
    cv.width = innerWidth; cv.height = innerHeight;
    const x = cv.getContext('2d');
    box.classList.add('on');
    audio.scream(1);
    const t0 = performance.now();
    await new Promise((res) => {
      const draw = () => {
        const t = (performance.now() - t0) / 1000;
        const W = cv.width, H = cv.height;
        x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
        const sc = 1.15 + t * 0.9 + Math.sin(t * 60) * 0.03;
        const iw = Math.max(W, H * 0.75) * sc, ih = iw / 0.75;
        const ox = (W - iw) / 2 + (Math.random() - 0.5) * 40, oy = (H - ih) / 2 + (Math.random() - 0.5) * 40 - ih * 0.05;
        x.filter = 'contrast(1.9) saturate(0.4) brightness(0.8)';
        x.drawImage(img, ox, oy, iw, ih);
        x.filter = 'none';
        x.globalCompositeOperation = 'multiply'; x.fillStyle = '#ff2a20'; x.fillRect(0, 0, W, H);
        x.globalCompositeOperation = 'source-over';
        // black eyes + glowing pupils
        for (const [ex, ey] of NOAM_SCARE_EYES) {
          const px = ox + ex * iw, py = oy + ey * ih, r = iw * 0.05;
          x.fillStyle = '#000'; x.beginPath(); x.ellipse(px, py, r * 1.3, r * 0.8, 0, 0, Math.PI * 2); x.fill();
          const g = x.createRadialGradient(px, py, 0, px, py, r * 0.8);
          g.addColorStop(0, '#fff6c8'); g.addColorStop(0.35, '#ff2a10'); g.addColorStop(1, 'rgba(255,0,0,0)');
          x.fillStyle = g; x.beginPath(); x.arc(px, py, r * 0.8, 0, Math.PI * 2); x.fill();
        }
        // RGB split slices
        for (let i = 0; i < 6; i++) {
          const sy = Math.random() * H, sh = 10 + Math.random() * 60;
          x.drawImage(cv, 0, sy, W, sh, (Math.random() - 0.5) * 80, sy, W, sh);
        }
        const v = x.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.75);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.9)');
        x.fillStyle = v; x.fillRect(0, 0, W, H);
        if (t < 1.5) requestAnimationFrame(draw); else res();
      };
      draw();
    });
    box.classList.remove('on');
  }

  // quick scare image (non-lethal) e.g. Noam in the mirror
  async flashScare(ms = 260) {
    const box = $('#jumpscare'), cv = $('canvas', box);
    cv.width = innerWidth; cv.height = innerHeight;
    const x = cv.getContext('2d');
    const img = this.game.images.noamScare;
    const W = cv.width, H = cv.height, iw = Math.max(W, H * 0.75) * 1.3, ih = iw / 0.75;
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    x.globalAlpha = 0.85; x.filter = 'contrast(2) brightness(0.6) grayscale(0.5)';
    x.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih); x.filter = 'none'; x.globalAlpha = 1;
    box.classList.add('on');
    audio.stinger(1.2);
    await sleep(ms);
    box.classList.remove('on');
  }
}
