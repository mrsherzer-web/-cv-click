import * as THREE from 'three';
import { CAST, portraitOf } from './cast.js';
import { Abort } from './util.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const _v = new THREE.Vector3();

// All DOM-side presentation: dialogue, phone, objectives, markers, cards.
export class UI {
  constructor({ sfx, assets }) {
    this.sfx = sfx;
    this.assets = assets;
    this.colors = {};
    this.pending = new Set();
    this.dlg = null;
    this.subT = 0;
    this.toastT = 0;
    this.targetPos = null;
    this.voice = false;
    this.el = {
      hud: $('hud'),
      dialog: $('dialog'),
      dlgImg: $('dlgImg'),
      dlgName: $('dlgName'),
      dlgText: $('dlgText'),
      subtitle: $('subtitle'),
      toast: $('toast'),
      objective: $('objective'),
      objText: $('objText'),
      objItems: $('objItems'),
      objDist: $('objDist'),
      marker: $('marker'),
      action: $('actionBtn'),
      actionLabel: $('actionLabel'),
      holdRing: $('holdRing'),
      card: $('card'),
      intro: $('intro'),
      phone: $('phone'),
      phoneFrame: $('phoneFrame'),
      phoneVideo: $('phoneVideo'),
      phoneImg: $('phoneImg'),
      phoneName: $('phoneName'),
      phoneStatus: $('phoneStatus'),
      phoneLines: $('phoneLines'),
      phoneAccept: $('phoneAccept'),
      phoneHang: $('phoneHang'),
      phoneEnded: $('phoneEnded'),
      fade: $('fade'),
      danger: $('danger'),
    };
    this.el.dialog.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this._advance = true;
    });
  }

  color(id) {
    return this.colors[id] || CAST[id]?.color || '#ffcc4d';
  }

  _promise(setup) {
    let entry;
    const p = new Promise((res, rej) => {
      entry = { res, rej };
      this.pending.add(entry);
      setup(
        (v) => {
          this.pending.delete(entry);
          res(v);
        },
        entry
      );
    });
    return p;
  }

  // Cancel everything on screen (chapter restart / menu).
  reset() {
    for (const e of this.pending) e.rej(new Abort());
    this.pending.clear();
    this.dlg = null;
    this.el.dialog.hidden = true;
    this.el.subtitle.hidden = true;
    this.el.card.hidden = true;
    this.el.intro.hidden = true;
    this.phoneHide();
    this.clearObjective();
    this.target(null);
    this.action(null);
    this.danger(0);
    this.toastT = 0;
    this.el.toast.classList.remove('show');
    this.subT = 0;
    this.sfx.stopRing();
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  // ---------- dialogue
  say(id, text) {
    return this._promise((done) => {
      const narrator = !id;
      this.el.dialog.hidden = false;
      this.el.dialog.classList.toggle('narrator', narrator);
      if (!narrator) {
        this.el.dialog.style.setProperty('--who', this.color(id));
        this.el.dlgImg.src = portraitOf(id, this.assets);
        this.el.dlgName.textContent = CAST[id]?.name || id;
      } else this.el.dlgName.textContent = '';
      this.el.dlgText.textContent = '';
      this.dlg = { id, text, shown: 0, done, pitch: CAST[id]?.pitch || 1, blip: 0 };
      this._advance = false;
      this.speak(id, text);
    });
  }

  narrate(text) {
    return this.say(null, text);
  }

  speak(id, text) {
    if (!this.voice || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/\.\.\./g, ','));
      u.lang = 'he-IL';
      u.rate = 1.05;
      u.pitch = id ? CAST[id]?.pitch || 1 : 0.9;
      speechSynthesis.speak(u);
    } catch {
      /* no voice available */
    }
  }

  subtitle(id, text, dur = 3.2) {
    const el = this.el.subtitle;
    el.hidden = false;
    el.style.setProperty('--who', this.color(id));
    el.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = (CAST[id]?.name || '') + ':';
    el.append(b, document.createTextNode(text));
    this.subT = dur;
    this.speak(id, text);
  }

  toast(text, dur = 2.6) {
    this.el.toast.textContent = text;
    this.placeToast();
    this.el.toast.classList.add('show');
    this.toastT = dur;
  }

  // Keep toasts clear of the objective panel: beside it on wide screens, under it on narrow ones.
  placeToast() {
    const el = this.el.toast;
    const o = this.el.objective;
    el.style.top = '';
    el.style.left = '';
    el.style.maxWidth = '';
    if (o.hidden) return;
    const r = o.getBoundingClientRect();
    const free = r.left - 84;
    if (free >= 320) {
      el.style.left = `${72 + free / 2}px`;
      el.style.maxWidth = `${free}px`;
    } else el.style.top = `${Math.round(r.bottom + 10)}px`;
  }

  // ---------- objectives (right edge, never in the middle)
  objective(text, items = null) {
    const o = this.el.objective;
    o.hidden = false;
    this.el.objText.textContent = text;
    this.el.objItems.innerHTML = '';
    this.items = items ? items.map((t) => ({ t, done: false })) : [];
    for (const it of this.items) {
      const li = document.createElement('li');
      li.textContent = it.t;
      this.el.objItems.append(li);
      it.li = li;
    }
    o.classList.remove('flash');
    void o.offsetWidth;
    o.classList.add('flash');
    this.sfx.sting('objective');
  }

  check(index) {
    const it = this.items?.[index];
    if (!it || it.done) return;
    it.done = true;
    it.li.classList.add('done');
    this.sfx.sting('objective');
  }

  clearObjective() {
    this.el.objective.hidden = true;
    this.items = [];
  }

  target(pos) {
    this.trackObj = null;
    this.targetPos = pos ? pos.clone() : null;
    this.el.marker.hidden = !pos;
    if (!pos) this.el.objDist.textContent = '';
  }

  // Marker that follows a moving person (above their head).
  track(person) {
    this.target(person ? person.pos : null);
    this.trackObj = person;
  }

  action(label) {
    this.el.action.hidden = !label;
    if (label) this.el.actionLabel.textContent = label;
    if (!label) this.hold(0);
  }

  hold(p) {
    this.el.holdRing.style.strokeDashoffset = String(289 * (1 - Math.max(0, Math.min(1, p))));
  }

  danger(level) {
    this.el.danger.style.opacity = String(Math.max(0, Math.min(1, level)));
  }

  // ---------- cards
  async card(kicker, title, sub = '', ms = 2600) {
    const c = this.el.card;
    $('cardKicker').textContent = kicker;
    $('cardTitle').textContent = title;
    $('cardSub').textContent = sub;
    c.hidden = false;
    c.classList.remove('show');
    void c.offsetWidth;
    c.classList.add('show');
    await sleep(ms);
    c.hidden = true;
  }

  async intro(id, { video = null, image = null, ms = 2600 } = {}) {
    const box = this.el.intro;
    const who = $('introWho');
    who.innerHTML = '';
    if (video) {
      const v = document.createElement('video');
      v.src = video;
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      v.loop = true;
      who.append(v);
      v.play().catch(() => {});
    } else {
      const img = document.createElement('img');
      img.src = image || portraitOf(id, this.assets);
      img.alt = '';
      who.append(img);
    }
    box.style.setProperty('--who', this.color(id));
    $('introRole').textContent = CAST[id].role;
    $('introName').textContent = CAST[id].full;
    $('introNick').textContent = CAST[id].nick || '';
    box.hidden = false;
    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');
    this.sfx.sting('reveal');
    await sleep(ms);
    box.hidden = true;
    who.innerHTML = '';
  }

  fade(to, ms = 600) {
    const f = this.el.fade;
    f.style.transition = `opacity ${ms}ms ease`;
    f.style.opacity = String(to);
    return sleep(ms);
  }

  // ---------- phone
  phoneShow(id, status, { video = null, accept = false } = {}) {
    const el = this.el;
    el.phone.hidden = false;
    el.phoneEnded.hidden = true;
    el.phoneFrame.classList.remove('glitch');
    el.phoneFrame.classList.toggle('video', !!video);
    el.phoneImg.src = portraitOf(id, this.assets);
    el.phoneName.textContent = CAST[id]?.full || id;
    el.phoneStatus.textContent = status;
    el.phoneLines.innerHTML = '';
    el.phoneAccept.hidden = !accept;
    el.phoneVideo.hidden = !video;
    if (video) {
      el.phoneVideo.src = video;
      el.phoneVideo.play().catch(() => {});
    } else el.phoneVideo.removeAttribute('src');
  }

  phoneIncoming(id, opts = {}) {
    this.phoneShow(id, opts.video ? 'שיחת וידאו נכנסת…' : 'שיחה נכנסת…', { accept: true });
    this.sfx.startRing();
    return this._promise((done) => {
      const go = () => {
        this.el.phoneAccept.removeEventListener('click', go);
        this.sfx.stopRing();
        this.phoneShow(id, opts.video ? 'שיחת וידאו' : '00:01', { video: opts.video });
        done();
      };
      this.el.phoneAccept.addEventListener('click', go);
      this._phoneAccept = go;
    });
  }

  async phoneDial(id) {
    this.phoneShow(id, 'מחייג…');
    this.sfx.sting('dial');
    await sleep(2200);
    this.el.phoneStatus.textContent = '00:01';
  }

  phoneLine(id, text) {
    const b = document.createElement('div');
    b.className = 'bubble';
    b.style.setProperty('--who', this.color(id));
    const n = document.createElement('b');
    n.textContent = CAST[id]?.name || '';
    b.append(n, document.createTextNode(text));
    const lines = this.el.phoneLines;
    lines.append(b);
    while (lines.children.length > 3) lines.firstChild.remove();
    this.speak(id, text);
    return this._promise((done) => {
      this.dlg = { phone: true, done, shown: text.length, text };
      this._advance = false;
    });
  }

  async phoneDrop(glitch = true) {
    if (glitch) {
      this.el.phoneFrame.classList.add('glitch');
      this.sfx.sting('glitch');
      await sleep(900);
    }
    this.el.phoneVideo.pause();
    this.el.phoneEnded.hidden = false;
    this.sfx.sting('hangup');
    await sleep(1400);
  }

  phoneHide() {
    this.el.phone.hidden = true;
    this.el.phoneVideo.pause();
    this.el.phoneFrame.classList.remove('glitch');
  }

  // ---------- per frame
  update(dt, input, camera, from) {
    const adv = this._advance || input.advancePressed;
    this._advance = false;
    if (this.dlg) {
      const d = this.dlg;
      if (!d.phone && d.shown < d.text.length) {
        d.shown = Math.min(d.text.length, d.shown + dt * 46);
        this.el.dlgText.textContent = d.text.slice(0, Math.floor(d.shown));
        d.blip -= dt;
        if (d.blip <= 0 && d.id) {
          d.blip = 0.075;
          this.sfx.blip(d.pitch);
        }
        if (adv) {
          d.shown = d.text.length;
          this.el.dlgText.textContent = d.text;
        }
      } else if (adv) {
        this.dlg = null;
        if (!d.phone) this.el.dialog.hidden = true;
        d.done();
      }
    } else if (adv && this.el.phone.hidden === false && this._phoneAccept && !this.el.phoneAccept.hidden) {
      this._phoneAccept();
    }
    if (this.subT > 0) {
      this.subT -= dt;
      if (this.subT <= 0) this.el.subtitle.hidden = true;
    }
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.el.toast.classList.remove('show');
    }
    this.updateMarker(camera, from);
  }

  updateMarker(camera, from) {
    if (!this.targetPos) return;
    if (this.trackObj) {
      this.targetPos.copy(this.trackObj.pos);
      this.targetPos.y += 2.2;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const s = _v.copy(this.targetPos).project(camera);
    let x = s.x;
    let y = s.y;
    const behind = s.z > 1;
    if (behind) {
      x = -x;
      y = -y;
    }
    const on = !behind && Math.abs(x) < 0.9 && Math.abs(y) < 0.85;
    const m = this.el.marker;
    if (!on) {
      const ang = Math.atan2(y, x);
      x = Math.cos(ang) * 0.86;
      y = Math.max(Math.sin(ang) * 0.8, -0.5);
      m.classList.add('edge');
      m.style.setProperty('--rot', `${-ang}rad`);
    } else m.classList.remove('edge');
    m.style.transform = `translate(${(x * 0.5 + 0.5) * w}px, ${(-y * 0.5 + 0.5) * h}px)`;
    if (from) this.el.objDist.textContent = `${Math.round(from.distanceTo(this.targetPos))} מ׳`;
  }
}
