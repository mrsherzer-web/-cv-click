// ============================================================================
//  On-screen interface for a night: clock, meters, buttons, tablet, phone,
//  subtitles, prompts.  Reads the session state every frame.
// ============================================================================
import { UI, SPEAKERS } from '../story.js';
import { ROOMS, VENTS, CAMS, WORLD_BOUNDS } from '../world/layout.js';
import { h, esc } from '../ui/dom.js';
import { audio } from '../engine/audio.js';

const B = WORLD_BOUNDS;
const LZ = B.z1 - B.z0;
const LX = B.x1 - B.x0;
const mapRect = ([x0, z0, x1, z1]) =>
  `left:${(((z0 - B.z0) / LZ) * 100).toFixed(2)}%;top:${(((B.x1 - x1) / LX) * 100).toFixed(2)}%;width:${(((z1 - z0) / LZ) * 100).toFixed(2)}%;height:${(((x1 - x0) / LX) * 100).toFixed(2)}%`;

export function clockText(hours) {
  const hh = Math.floor(hours + 1e-6);
  const mm = Math.floor((hours - hh + 1e-6) * 60);
  return `${hh === 0 ? 12 : hh}:${String(mm).padStart(2, '0')} AM`;
}

export class Hud {
  constructor(S) {
    this.S = S;
    this.root = document.getElementById('hud');
    this.root.hidden = false;
    this.root.innerHTML = '';
    this.cache = {};
    this.actions = {};
    this.build();
  }

  build() {
    const S = this.S;
    const touch = S.G.input.touch;
    const mapRooms = Object.entries(ROOMS)
      .filter(([id]) => id !== 'outside')
      .map(([id, r]) => `<i class="mr ${id}" style="${mapRect(r.rect)}"></i>`)
      .join('');
    const mapVents = Object.values(VENTS)
      .map((v) => `<i class="mr vent" style="${mapRect(v.a)}"></i><i class="mr vent" style="${mapRect(v.b)}"></i>`)
      .join('');
    const mapCams = CAMS.map((c) => {
      const x = ((c.pos[2] - B.z0) / LZ) * 100;
      const y = ((B.x1 - c.pos[0]) / LX) * 100;
      const r = c.room.startsWith('vent') ? VENTS[c.room].b : ROOMS[c.room].rect;
      const cx = (((r[1] + r[3]) / 2 - B.z0) / LZ) * 100;
      const cy = ((B.x1 - (r[0] + r[2]) / 2) / LX) * 100;
      void x;
      void y;
      return `<button class="cam" data-cam="${c.n}" style="left:${cx.toFixed(1)}%;top:${cy.toFixed(1)}%">${c.n}</button>`;
    }).join('');
    this.el = h(`
      <div class="g2hud ${touch ? 'touch' : 'mouse'}">
        <div class="threat"></div>
        <div class="top">
          <div class="clock"><b class="time">12:00 AM</b><span class="nightn"></span></div>
          <div class="meters">
            <div class="meter pow"><span>${UI.power}</span><b>100%</b><i class="bars"></i></div>
            <div class="meter bat"><span>${UI.battery}</span><div class="batbar"><i></i></div></div>
            <div class="meter balls" hidden><span>⚫</span><b>0</b></div>
          </div>
          <button class="phonechip" data-act="phone"><span class="sig"><i></i><i></i><i></i><i></i></span><em></em></button>
        </div>
        <div class="objective" hidden></div>
        <div class="toasts"></div>
        <div class="title-card" hidden><small></small><b></b></div>
        <div class="prompt" hidden><div class="ring"><i></i></div><span></span></div>
        <div class="mash" hidden><b>${UI.free}</b><span>${UI.mash}</span><div class="mbar"><i></i></div></div>
        <div class="subs" hidden><b></b><span></span></div>
        <div class="stick" hidden><i></i></div>
        <div class="btns seat">
          <button class="hb mask" data-tap="mask" hidden>${UI.mask}<kbd>M</kbd></button>
          <button class="hb tabbar" data-tap="tablet">▲ ${UI.tablet} ▲<kbd>רווח</kbd></button>
          <button class="hb kill" data-tap="kill" hidden>${UI.kill}<kbd>K</kbd></button>
          <button class="hb light" data-hold="light">${UI.light}<kbd>F</kbd></button>
        </div>
        <div class="btns walk" hidden>
          <button class="hb use" data-hold="interact" hidden>${UI.interact}<kbd>E</kbd></button>
          <button class="hb light" data-tap="light">${UI.light}<kbd>F</kbd></button>
          <button class="hb mask" data-tap="mask" hidden>${UI.mask}<kbd>M</kbd></button>
          <button class="hb throw" data-tap="throw" hidden>${UI.throw}<kbd>G</kbd></button>
          <button class="hb sprint" data-hold="sprint">${UI.sprint}<kbd>Shift</kbd></button>
        </div>
        <div class="script-actions"></div>
        <div class="tablet" hidden>
          <div class="tb-top">
            <div class="rec"><i></i> REC</div>
            <div class="camname"></div>
            <div class="tabs">
              <button data-tab="cams" class="on">${UI.camsTab}</button>
              <button data-tab="fix" hidden>${UI.fixTab}</button>
            </div>
          </div>
          <div class="tb-msg" hidden></div>
          <div class="map"><div class="mapin">${mapRooms}${mapVents}<i class="you" style="left:${(((1.35 - B.z0) / LZ) * 100).toFixed(1)}%;top:50%"></i>${mapCams}</div></div>
          <button class="lure" hidden>🔊 ${UI.lure}</button>
          <div class="fix" hidden>
            <h3>${UI.fixTab}</h3>
            <div class="row" data-sys="cams"><span>${UI.sysCams}</span><em></em><button>${UI.reboot}</button></div>
            <div class="row" data-sys="audio"><span>${UI.sysAudio}</span><em></em><button>${UI.reboot}</button></div>
            <div class="row" data-sys="power"><span>${UI.sysPower}</span><em></em><button>${UI.reboot}</button></div>
            <button class="all" data-sys="all">${UI.rebootAll}</button>
            <div class="prog" hidden><i></i><span>${UI.rebooting}</span></div>
          </div>
          <button class="tb-close" data-tap="tablet">▼</button>
        </div>
        <div class="call" hidden>
          <div class="call-ic">📞</div>
          <div class="call-who"></div>
          <button class="call-answer">${UI.answer}</button>
        </div>
        <div class="phone" hidden>
          <div class="ph-head"><span class="ph-status"></span><button class="ph-x">✕</button></div>
          <div class="ph-list"></div>
          <button class="ph-dial" hidden></button>
        </div>
        <button class="pausebtn" data-tap="pause">❚❚</button>
      </div>`);
    this.root.appendChild(this.el);
    const $ = (s) => this.el.querySelector(s);
    this.$ = $;
    const inp = S.G.input;
    // generic buttons
    this.el.querySelectorAll('[data-tap]').forEach((b) =>
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        audio.unlock();
        inp.press(b.dataset.tap);
      }),
    );
    this.el.querySelectorAll('[data-hold]').forEach((b) => {
      const a = b.dataset.hold;
      const off = (e) => {
        e.stopPropagation();
        inp.hold(a, false);
        b.classList.remove('down');
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          b.setPointerCapture(e.pointerId);
        } catch (err) {}
        inp.hold(a, true);
        b.classList.add('down');
      });
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('lostpointercapture', off);
    });
    $('.phonechip').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      S.phone.toggle();
    });
    // tablet
    this.el.querySelectorAll('.cam').forEach((b) =>
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        S.office.selectCam(+b.dataset.cam);
      }),
    );
    this.el.querySelectorAll('.tabs button').forEach((b) =>
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        S.office.setTab(b.dataset.tab);
      }),
    );
    $('.lure').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      S.office.playLure();
    });
    this.el.querySelectorAll('.fix [data-sys]').forEach((r) => {
      const btn = r.tagName === 'BUTTON' ? r : r.querySelector('button');
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        S.office.startReboot(r.dataset.sys);
      });
    });
    $('.tablet').addEventListener('pointerdown', (e) => e.stopPropagation());
    $('.call-answer').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      S.phone.answer();
    });
    $('.ph-x').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      S.phone.toggle(false);
    });
    $('.ph-dial').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      S.phone.dial();
    });
    $('.phone').addEventListener('pointerdown', (e) => e.stopPropagation());
    $('.nightn').textContent = S.night ? `${UI.night} ${S.night}` : '';
  }

  set(key, val, fn) {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    fn(val);
  }

  // ------------------------------------------------------------ messages
  say(who, text, dur = 0) {
    const sp = SPEAKERS[who] || SPEAKERS.sys;
    const el = this.$('.subs');
    el.hidden = false;
    el.className = 'subs' + (sp.demon ? ' demon' : '');
    el.querySelector('b').textContent = sp.name ? sp.name + ':' : '';
    el.querySelector('b').style.color = sp.color;
    el.querySelector('span').textContent = text;
    clearTimeout(this._subT);
    if (dur > 0) this._subT = setTimeout(() => (el.hidden = true), dur * 1000);
  }
  hideSubs() {
    this.$('.subs').hidden = true;
  }

  toast(text, dur = 4, cls = '') {
    const t = h(`<div class="toast ${cls}">${esc(text)}</div>`);
    const box = this.$('.toasts');
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), dur * 1000);
    setTimeout(() => t.remove(), dur * 1000 + 500);
  }

  objective(text) {
    const el = this.$('.objective');
    if (!text) {
      el.hidden = true;
      return;
    }
    if (el.textContent !== text) {
      el.textContent = text;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
      audio.blip(0.8, 0.05);
    }
    el.hidden = false;
  }

  titleCard(small, big, dur = 4.5) {
    const el = this.$('.title-card');
    el.querySelector('small').textContent = small;
    el.querySelector('b').textContent = big;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this._tcT);
    this._tcT = setTimeout(() => (el.hidden = true), dur * 1000);
  }

  /** A big contextual button created by a night script. */
  action(id, label, fn) {
    const box = this.$('.script-actions');
    this.actions[id]?.remove();
    delete this.actions[id];
    if (!label) return;
    const b = h(`<button class="hb sa">${esc(label)}</button>`);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
    box.appendChild(b);
    this.actions[id] = b;
  }

  mash(progress) {
    const el = this.$('.mash');
    if (progress == null) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.querySelector('.mbar i').style.width = Math.round(progress * 100) + '%';
  }

  // ------------------------------------------------------------ per frame
  update() {
    const S = this.S;
    const P = S.player;
    const O = S.office;
    const $ = this.$;
    const seat = P.mode === 'seat';
    const walk = P.mode === 'walk';
    const t = O.tablet;
    this.set('mode', P.mode + (S.busy ? 'b' : ''), () => {
      $('.btns.seat').hidden = !seat || S.busy;
      $('.btns.walk').hidden = !walk || S.busy;
    });
    this.set('hide', !!S.hideHud, (v) => this.el.classList.toggle('hidden', v));
    this.set('time', clockText(S.clock), (v) => ($('.time').textContent = v));
    this.set('clockvis', !!S.showClock, (v) => ($('.clock').style.visibility = v ? 'visible' : 'hidden'));
    this.set('pow', S.powerOn ? Math.ceil(O.power) : -1, (v) => {
      $('.meter.pow').hidden = v < 0;
      $('.meter.pow b').textContent = v + '%';
      $('.meter.pow').classList.toggle('low', v <= 20);
    });
    this.set('use', O.usage, (v) => ($('.meter.pow .bars').style.width = Math.min(5, v) * 9 + 'px'));
    this.set('bat', Math.ceil(P.flash.battery / 2), (v) => {
      $('.batbar i').style.width = v * 2 + '%';
      $('.meter.bat').classList.toggle('low', v * 2 <= 20);
    });
    this.set('batvis', P.flash.enabled, (v) => ($('.meter.bat').hidden = !v));
    this.set('balls', S.balls ?? -1, (v) => {
      $('.meter.balls').hidden = v < 0;
      $('.meter.balls b').textContent = v;
      this.el.querySelector('.btns.walk .throw').hidden = v <= 0;
    });
    this.set('mask', P.mask.enabled, (v) => this.el.querySelectorAll('.hb.mask').forEach((b) => (b.hidden = !v)));
    this.set('maskon', P.mask.on, (v) => this.el.querySelectorAll('.hb.mask').forEach((b) => b.classList.toggle('on', v)));
    this.set('kill', O.enabled.kill, (v) => ($('.hb.kill').hidden = !v));
    this.set('killcd', O.killCd > 0, (v) => $('.hb.kill').classList.toggle('cool', v));
    this.set('lighton', P.flash.on || O.ventLight.L || O.ventLight.R, (v) => this.el.querySelectorAll('.hb.light').forEach((b) => b.classList.toggle('on', v)));
    this.set('tabbar', O.enabled.tablet && !O.dark && !P.mask.on, (v) => $('.tabbar').classList.toggle('off', !v));
    this.set('threat', Math.round(S.threatShown * 20), (v) => ($('.threat').style.opacity = (v / 20) * 0.85));
    // prompt
    const u = P.use;
    this.set('prompt', u.target ? u.target.label : '', (v) => {
      $('.prompt').hidden = !v;
      $('.prompt span').textContent = v;
      this.el.querySelector('.btns.walk .use').hidden = !v;
      if (v) this.el.querySelector('.btns.walk .use').firstChild.textContent = u.target.short || UI.interact;
    });
    if (u.target) $('.ring i').style.transform = `scaleX(${u.progress.toFixed(3)})`;
    // stick
    const st = S.G.input.stick;
    this.set('stick', st.active, (v) => ($('.stick').hidden = !v));
    if (st.active) {
      const R = Math.min(innerWidth, innerHeight) * 0.16;
      $('.stick').style.cssText = `left:${st.ox}px;top:${st.oy}px;width:${R * 2}px;height:${R * 2}px`;
      $('.stick i').style.transform = `translate(${st.x * R}px, ${-st.y * R}px)`;
    }
    // tablet
    this.set('tablet', t.open, (v) => ($('.tablet').hidden = !v));
    if (t.open) {
      this.set('tab', t.tab, (v) => {
        this.el.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === v));
        $('.fix').hidden = v !== 'fix';
        $('.map').hidden = v !== 'cams';
      });
      this.set('fixtab', O.enabled.fix, (v) => (this.el.querySelector('.tabs [data-tab="fix"]').hidden = !v));
      this.set('fixalert', O.anyBroken(), (v) => this.el.querySelector('.tabs [data-tab="fix"]').classList.toggle('alert', v));
      this.set('cam', t.cam, (v) => {
        this.el.querySelectorAll('.cam').forEach((b) => b.classList.toggle('on', +b.dataset.cam === v));
        const c = CAMS.find((x) => x.n === v);
        const name = c.room.startsWith('vent') ? VENTS[c.room].name : ROOMS[c.room].name;
        $('.camname').textContent = `CAM ${String(v).padStart(2, '0')} · ${name}`;
      });
      const msg = t.tab !== 'cams' ? '' : O.sys.cams !== 'ok' ? UI.camError : O.camOffline.has(t.cam) ? UI.noSignal : '';
      this.set('tbmsg', msg, (v) => {
        $('.tb-msg').hidden = !v;
        $('.tb-msg').textContent = v;
      });
      this.set('lure', t.tab === 'cams' && O.enabled.lure ? (O.sys.audio !== 'ok' ? 'err' : O.lureCd > 0 ? 'cool' : 'ok') : '', (v) => {
        const b = $('.lure');
        b.hidden = !v;
        b.className = 'lure ' + v;
        b.textContent = v === 'err' ? `🔇 ${UI.sysAudio}: ${UI.error}` : v === 'cool' ? UI.lureCool : `🔊 ${UI.lure}`;
      });
      if (t.tab === 'fix') {
        for (const k of ['cams', 'audio', 'power']) {
          this.set('sys' + k, O.sys[k], (v) => {
            const r = this.el.querySelector(`.fix .row[data-sys="${k}"]`);
            r.classList.toggle('bad', v !== 'ok');
            r.querySelector('em').textContent = v === 'ok' ? UI.ok : UI.error;
          });
        }
        const rb = O.rebooting;
        this.set('rb', !!rb, (v) => ($('.fix .prog').hidden = !v));
        if (rb) $('.fix .prog i').style.width = Math.round((rb.t / rb.total) * 100) + '%';
      }
    }
    // phone chip
    const ph = S.phone;
    this.set('sig', ph.signal + ph.status, () => {
      $('.phonechip').className = 'phonechip s' + ph.signal + (ph.unread ? ' unread' : '');
      $('.phonechip em').textContent = ph.status;
    });
    this.set('unread', ph.unread, (v) => $('.phonechip').classList.toggle('unread', v > 0));
  }

  destroy() {
    clearTimeout(this._subT);
    clearTimeout(this._tcT);
    this.root.innerHTML = '';
    this.root.hidden = true;
  }
}
