// The story: 4 nights at the Dimona commune.
// Night 1 "השקט"       – Noam sleeps. Find the key, meet Ori, get the flashlight + walkie (Yarin), steal the diary.
// Night 2 "ההתעוררות"  – Power is out. Take the panel key from Noam's nightstand, find a fuse, restore power...
//                         the TV blasts on, Noam WAKES UP for good. Ori distracts him and vanishes.
// Night 3 "הקול בקשר"   – Noam patrols. Ori is back on the radio. Crack the shed code (24 + 55), follow the water.
// Night 4 "DIMONA DEMONS" – Distract Noam with FIFA, pick his pocket, free everyone, burn the mask.
import * as THREE from 'three';
import { audio } from './audio.js';
import { IMAGES } from './assets.js';
import { glowSprite, paperTex } from './textures.js';
import { makeMask } from './characters.js';
import { rand, pick, dist2, sleep, clamp } from './util.js';

const ABORT = Symbol('abort');
const P = Math.PI;

export class Story {
  constructor(game) {
    this.game = game;
    this.token = { aborted: true };
    this.waiters = [];
    this.spawned = [];
    this.glints = [];
    this.flags = {};
    this.night = 0;
    this.stageIdx = 0;
    this.cpStage = 0;
    this.objs = [];
    this.radioCd = 20;
    this.hintT = 0;
  }

  get world() { return this.game.world; }
  get player() { return this.game.player; }
  get noam() { return this.game.noam; }
  get ui() { return this.game.ui; }

  // ---------------- run control ----------------
  abort() {
    this.token.aborted = true;
    for (const w of this.waiters) w.rej(ABORT);
    this.waiters = [];
    this.ui.clearDialog();
  }

  async start(night, fromStage = 0) {
    this.abort();
    const token = (this.token = { aborted: false });
    this.night = night;
    this.flags = {};
    this.objs = [];
    this.ui.setObjectives([]);
    const def = this['night' + night]();
    this.def = def;
    this.resetWorld(def);
    def.setup();
    // fast-forward completed stages when restarting from a checkpoint
    for (let i = 0; i < fromStage; i++) if (def.stages[i].skip) def.stages[i].skip();
    this.cpStage = fromStage;
    this.restoredStage = fromStage > 0 ? fromStage : -1;
    try {
      if (fromStage > 0) {
        const st = def.stages[fromStage];
        if (st.restore) st.restore();
        this.ui.setNightLabel(`לילה ${night} · ${def.title}`);
        await this.game.nightIntro(`לילה ${night}`, def.title, '', true);
      }
      for (let i = fromStage; i < def.stages.length; i++) {
        this.stageIdx = i;
        if (def.stages[i].cp) this.cpStage = i;
        await def.stages[i].run();
        if (token.aborted) return;
      }
    } catch (e) {
      if (e !== ABORT) console.error(e);
    }
  }

  wait(sec) { const t0 = this.game.time; return this.waitFor(() => this.game.time - t0 >= sec); }
  waitFor(pred) {
    if (this.token.aborted) return Promise.reject(ABORT);
    if (pred()) return Promise.resolve();
    return new Promise((res, rej) => this.waiters.push({ pred, res, rej }));
  }

  say(sp, text, opts = {}) {
    if (this.token.aborted) { const r = Promise.reject(ABORT); r.catch(() => {}); return r; }
    const tok = this.token;
    const p = this.ui.say(sp, text, { ...opts, abort: tok }).then(() => { if (tok.aborted) throw ABORT; });
    p.catch(() => {});
    return p;
  }

  // a conversation: freezes movement, waits for click on each line
  async talk(lines, { freeze = true, look = null } = {}) {
    const p = this.player;
    if (freeze) { p.frozen = true; p.freeLook = true; }
    if (look) p.lookAtPoint(look, 3);
    try {
      for (const [sp, text] of lines) await this.say(sp, text, { wait: freeze });
    } finally { p.frozen = false; p.freeLook = false; p.stopLookAt(); }
  }

  // quick radio blip from Yarin (doesn't block the dialogue queue)
  radio(text, who = 'ירין') {
    if (!this.player.has('walkie')) return;
    audio.squelch(); audio.staticBed(2.2);
    this.ui.subtitle('📻 ' + who, text, { time: 3.2 });
    const s = document.getElementById('subtitle'); s.style.color = '#9dff8a';
    this.ui.walkieIcon(true); setTimeout(() => this.ui.walkieIcon(false), 2400);
  }

  // ---------------- objectives ----------------
  obj(id, text, { sub, hint } = {}) {
    const o = { id, text, sub, hint, done: false, t: this.game.time };
    this.objs = this.objs.filter((x) => x.id !== id);
    this.objs.push(o);
    this.ui.setObjectives(this.objs);
    audio.click(audio.now, audio.ui, 0.2, 900);
    this.hintT = 0;
    return o;
  }
  objSub(id, sub) { const o = this.objs.find((x) => x.id === id); if (o) { o.sub = sub; this.ui.setObjectives(this.objs); } }
  done(id) {
    const o = this.objs.find((x) => x.id === id);
    if (!o || o.done) return;
    o.done = true;
    this.ui.setObjectives(this.objs);
    audio.pickup();
    setTimeout(() => { this.objs = this.objs.filter((x) => x !== o || !x.done); this.ui.setObjectives(this.objs); }, 4000);
  }

  // ---------------- world helpers ----------------
  spawn(obj) { this.game.scene.add(obj); this.spawned.push(obj); return obj; }

  act(cfg) {
    const it = this.world.addInteractable({ ...cfg, story: true });
    return it;
  }

  item({ id, x, y, z, mesh, label, give, onTake, r = 1.8, glint = true, cond, hold, onHold }) {
    if (mesh) { mesh.position.set(x, y, z); this.spawn(mesh); }
    let g = null;
    if (glint) {
      g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('255,236,200'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      g.position.set(x, y + 0.08, z); g.scale.set(0.22, 0.22, 1);
      this.spawn(g); this.glints.push(g);
    }
    const it = this.act({
      id, x, y, z, r, label, hold, onHold,
      enabled: () => !it.taken && (!cond || cond()),
      use: () => {
        it.taken = true;
        if (mesh) mesh.visible = false;
        if (g) g.visible = false;
        if (give) { this.player.give(give); audio.pickup(); }
        this.world.emitNoise(x, z, 1.5, 'item');
        if (onTake) onTake();
      },
    });
    return it;
  }

  battery(x, y, z) {
    const m = new THREE.Group();
    for (let i = 0; i < 2; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 10), new THREE.MeshStandardMaterial({ color: i ? '#c9a227' : '#222', metalness: 0.5, roughness: 0.4 })); c.rotation.z = P / 2; c.position.z = i * 0.03; m.add(c); }
    this.item({ id: 'bat' + x + z, x, y, z, mesh: m, label: 'קח סוללות', onTake: () => { this.player.battery = Math.min(1, this.player.battery + 0.6); this.ui.toast('🔋 הפנס נטען'); audio.pickup(); } });
  }

  mesh(kind) {
    const S = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...extra });
    const g = new THREE.Group();
    const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
    switch (kind) {
      case 'flashlight': add(new THREE.CylinderGeometry(0.022, 0.018, 0.2, 12), S('#181818', { metalness: 0.6 }), 0, 0.02, 0, 0, 0, P / 2); add(new THREE.CylinderGeometry(0.03, 0.024, 0.05, 12), S('#2a2a2a', { metalness: 0.7 }), 0.12, 0.02, 0, 0, 0, P / 2); break;
      case 'walkie': add(new THREE.BoxGeometry(0.06, 0.13, 0.03), S('#141414')); add(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 6), S('#111'), 0.018, 0.1, 0); add(new THREE.BoxGeometry(0.03, 0.01, 0.002), new THREE.MeshBasicMaterial({ color: 0x66ff66 }), 0, 0.03, 0.016); break;
      case 'diary': add(new THREE.BoxGeometry(0.17, 0.035, 0.23), S('#5b2a1e')); add(new THREE.BoxGeometry(0.16, 0.03, 0.22), S('#efe6cf'), 0.006, 0.002, 0); break;
      case 'key': add(new THREE.TorusGeometry(0.018, 0.005, 6, 14), S('#c9a227', { metalness: 0.9, roughness: 0.3 }), 0, 0.01, 0, P / 2); add(new THREE.BoxGeometry(0.05, 0.006, 0.012), S('#c9a227', { metalness: 0.9, roughness: 0.3 }), 0.04, 0.01, 0); break;
      case 'fuse': add(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 10), S('#e8e2d4'), 0, 0.01, 0, 0, 0, P / 2); for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.013, 0.013, 0.01, 10), S('#b5b5b5', { metalness: 0.9 }), s * 0.03, 0.01, 0, 0, 0, P / 2); break;
      case 'phone': add(new THREE.BoxGeometry(0.075, 0.008, 0.15), S('#0c0c0e', { roughness: 0.2 })); add(new THREE.PlaneGeometry(0.068, 0.14), new THREE.MeshBasicMaterial({ color: 0x8fb4ff }), 0, 0.0045, 0, -P / 2); break;
      case 'controller': add(new THREE.BoxGeometry(0.14, 0.03, 0.07), S('#f0f0f0')); for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.03, 10, 8), S('#f0f0f0'), s * 0.06, -0.005, 0.03); add(new THREE.BoxGeometry(0.03, 0.005, 0.02), new THREE.MeshBasicMaterial({ color: 0x3060ff }), 0, 0.017, -0.02); break;
      case 'note': { const m = add(new THREE.PlaneGeometry(0.2, 0.26), new THREE.MeshStandardMaterial({ map: paperTex(['...'], { seed: 9 }), side: THREE.DoubleSide })); m.rotation.x = -P / 2; break; }
      case 'shirt': add(new THREE.BoxGeometry(0.5, 0.03, 0.4), S('#8ec1ec', { roughness: 1 })); break;
      case 'mask': g.add(makeMask()); break;
    }
    return g;
  }

  // ---------------- world reset per night ----------------
  resetWorld(def) {
    const w = this.world, g = this.game;
    // remove spawned things
    for (const o of this.spawned) { o.parent && o.parent.remove(o); }
    this.spawned = []; this.glints = [];
    w.interactables = w.interactables.filter((i) => !i.story);
    // doors
    for (const d of w.doors.values()) { d.setOpenInstant(0); d.locked = false; d.noamCanPass = false; d.onOpen = null; d.insideUnlock = null; }
    w.doors.get('stairs').locked = true;
    w.doors.get('storage').locked = true;
    w.doors.get('shed').locked = true;
    // lights / props
    w.tv.setMode('off'); audio.stopAllLoops();
    w.tvLight.intensity = 0; w.hallLight.intensity = 0; w.hallBulb.material.emissiveIntensity = 0;
    w.boysLight.intensity = 0; w.boysStrip.visible = false; w.deskLight.intensity = 0;
    w.muralEyes.visible = false; w.mirrorWriting.visible = false; w.sleepers.forEach((m) => (m.visible = false));
    w.panelDoor.rotation.y = 0;
    g.hallFlicker = 0; g.redAlert = 0; g.fire = false; g.power = false; g.hallOn = false; g.hallFlickerT = 0;
    if (g.flames) g.flames.forEach((f) => (f.visible = false));
    if (g.fireLight) g.fireLight.intensity = 0;
    g.setDawn(false);
    // characters
    g.noam.state = 'off'; g.noam.show(false); g.noam.disturbance = 0; g.noam.canReturnToBed = true; g.noam.model.setPossessed(false);
    g.noam.patrolSpeed = 1.45; g.noam.chaseSpeed = 3.6; g.chaseMul = 1; g.director = 0.45;
    for (const n of [g.ori, g.msg, g.yarin]) n.hide();
    g.ghost.root.visible = false;
    // player
    const p = this.player;
    p.inventory.clear(); p.hidden = null; p.frozen = false; p.freeLook = false; p.stopLookAt(); p.crouch = false;
    p.hasFlashlight = false; p.flashOn = false; p.battery = 1; p.stamina = 1; p.breath = 1;
    this.ui.setHideOverlay(null);
    this.ui.refreshInventory(p.inventory);
    g.allowHiding = true; g.allowTerrace = true;
    g.sleepSensitivity = 1;
    this.radioCd = 25;
    this.lastNoamRoom = null;
    this.clockMin = def.clock;
  }

  giveBasics() {
    const p = this.player;
    p.hasFlashlight = true; p.give('flashlight'); p.give('walkie'); p.battery = 0.85;
    // you locked yourself in last night
    const d = this.world.doors.get('myroom');
    d.locked = true; d.insideUnlock = 'myroom'; d.lockedMsg = 'נעול מבפנים.';
  }

  // ---------------- per frame ----------------
  update(dt) {
    if (this.token.aborted) return;
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      const w = this.waiters[i];
      let ok = false;
      try { ok = w.pred(); } catch (e) { ok = false; }
      if (ok) { this.waiters.splice(i, 1); w.res(); }
    }
    // glints pulse
    const cam = this.player.camera.position;
    for (const g of this.glints) {
      if (!g.visible && g.userData.off) continue;
      const d = cam.distanceTo(g.position);
      g.material.opacity = d > 7 ? 0 : (0.35 + 0.35 * Math.sin(this.game.time * 3 + g.position.x)) * Math.min(1, (7 - d) / 3);
    }
    // in-game clock: 1 minute every 3 seconds
    if (this.clockMin != null) {
      this.clockMin += dt / 3;
      const m = Math.floor(this.clockMin) % (24 * 60);
      this.ui.setClock(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }
    this._yarinDirector(dt);
    // objective hints from Yarin
    this.hintT += dt;
    const cur = this.objs.find((o) => !o.done && o.hint);
    if (cur && this.hintT > 80) { this.hintT = 0; this.radio(cur.hint); }
  }

  _yarinDirector(dt) {
    const n = this.noam, p = this.player;
    if (!p.has('walkie') || !n.active || this.flags.noRadio) return;
    this.radioCd -= dt;
    const nr = this.world.roomAt(n.pos.x, n.pos.z), pr = this.world.roomAt(p.pos.x, p.pos.z);
    if (n.state === 'chase') {
      if (!this.saidChase) { this.saidChase = true; this.radio(pick(['הוא רודף אחריך! רוץ!!', 'תברח! תמצא מקום להתחבא!', 'הוא ראה אותך! רוץ!'])); this.radioCd = 18; }
      return;
    }
    this.saidChase = false;
    if (this.radioCd > 0 || !nr) return;
    const d = dist2(n.pos.x, n.pos.z, p.pos.x, p.pos.z);
    if (p.hidden && d < 4) { this.radio(pick(['אל תזוז... הוא ממש לידך...', 'שקט... תעצור את הנשימה...'])); this.radioCd = 22; return; }
    if (nr !== this.lastNoamRoom) {
      this.lastNoamRoom = nr;
      if (d < 8 && nr !== pr) { this.radio(`זהירות! הוא נכנס ל${nr.name}. הוא קרוב אליך.`); this.radioCd = 26; }
      else if (Math.random() < 0.35) { this.radio(`הוא עכשיו ב${nr.name}.`); this.radioCd = 30; }
    }
  }

  // =====================================================================
  //                               NIGHT 1
  // =====================================================================
  night1() {
    const g = this.game, w = this.world, p = this.player, n = this.noam, ori = g.ori, msg = g.msg;
    const F = this.flags;
    const oriSeat = { x: 12.25, z: 4.6 };
    const setup = () => {
      w.doors.get('entrance').locked = true;
      w.doors.get('boys').setOpenInstant(0.25);
      w.tv.setMode('menu'); w.tvLight.intensity = 1.2;
      w.boysLight.intensity = 0.6; w.boysStrip.visible = true;
      w.deskLight.intensity = 1.2;
      n.setSleeping();
      ori.place(oriSeat.x, oriSeat.z, P / 2, 'sit');
      ori.lookAtPlayer = true;
      p.setPose(6.0, -3.2, -2.4, 0.05);
      audio.tvLoop(audio.emitter(w.tvPos.x, w.tvPos.y, w.tvPos.z).input, false);
      // key under the cushion of the black sofa
      this.item({ id: 'keyEntrance', x: 15.0, y: 0.56, z: -0.6, mesh: null, glint: true, label: 'להרים את הכרית', give: 'key_entrance', cond: () => F.introDone, onTake: () => { this.ui.toast('🔑 מצאת את המפתח'); F.hasKey = true; } });
      // entrance door: use the key
      const ent = w.doors.get('entrance');
      ent.onOpen = () => { F.entered = true; };
      this.act({ id: 'entranceKey', x: ent.cx, y: 1.1, z: ent.cz - 0.2, label: () => (p.has('key_entrance') && ent.locked ? 'לפתוח עם המפתח' : null), enabled: () => ent.locked && p.has('key_entrance'), use: () => { ent.locked = false; audio.unlock(); ent.open(); p.take('key_entrance'); } });
    };
    const stages = [
      { // intro on the terrace
        run: async () => {
          this.ui.setNightLabel('לילה 1 · השקט');
          msg.place(8.2, -1.7, -2.2, 'idle');
          msg.lookAtPlayer = true;
          await this.game.nightIntro('לילה 1', 'השקט', '23:47');
          await this.wait(1.2);
          p.lookAtPoint(new THREE.Vector3(8.2, 1.55, -1.7), 2);
          await this.wait(1.0);
          await this.talk([
            ['msg', 'הגעת. סוף סוף.'],
            ['msg', 'תקשיב טוב, כי אין לי זמן להסביר פעמיים.'],
            ['msg', 'חצי מהקומונה נעלמו. ככה. באמצע הלילה. הטלפונים שלהם פה, המיטות שלהם עוד חמות.'],
            ['msg', 'ונועם... נועם אמירם ישן כבר שלושה ימים. לא אוכל, לא קם. רק נוחר.'],
            ['msg', 'ניסו להעיר אותו פעם אחת. מי שניסה — נעלם באותו לילה.'],
            ['msg', 'אני יורד להביא עזרה. אתה — אל תעיר אותו. לא משנה מה תשמע.'],
            ['msg', 'המפתח של הדלת? הוא תמיד מתחת לכרית של הספה השחורה. תיזהר.'],
          ], { look: new THREE.Vector3(8.2, 1.55, -1.7) });
          F.introDone = true;
          // he leaves down the stairs
          msg.lookAtPlayer = false;
          const sd = w.doors.get('stairs');
          (async () => {
            await msg.walkTo(0.9, -1.9, { speed: 1.5 });
            sd.locked = false; sd.open(true);
            await msg.walkTo(-1.9, -1.9, { speed: 1.5, direct: true });
            sd.close(true); sd.locked = true;
            msg.hide();
          })();
        },
        skip: () => { F.introDone = true; msg.hide(); },
      },
      {
        run: async () => {
          this.obj('key', 'מצא את המפתח של הדלת', { sub: 'מתחת לכרית של הספה השחורה במרפסת', hint: 'הספה השחורה במרפסת, ליד החלונות.' });
          await this.waitFor(() => p.has('key_entrance'));
          this.done('key');
          this.obj('enter', 'היכנס לקומונה');
          await this.waitFor(() => F.entered);
          this.done('enter');
        },
        skip: () => { const it = w.getInteractable('keyEntrance'); if (it) it.taken = true; const e = w.doors.get('entrance'); e.locked = false; e.setOpenInstant(1); F.entered = true; },
      },
      { // meet Ori
        cp: true,
        restore: () => p.setPose(2.5, 1.2, P, 0),
        run: async () => {
          F.entered2 = true;
          await this.waitFor(() => { const r = p.room; return r && (r.id === 'dining' || r.id === 'living' || dist2(p.pos.x, p.pos.z, ori.pos.x, ori.pos.z) < 5.5); });
          await this.talk([
            ['ori', 'ששש! אל תצעק. זה אני, אורי.'],
            ['ori', 'אני לא ישן כבר יומיים. יושב פה ומשחק פיפא על שקט, רק כדי לא להירדם.'],
            ['ori', 'אתה שומע את הנחירות? זה נועם. בחדר בנים.'],
            ['ori', 'וכל פעם שהנחירות נעצרות... מישהו נעלם.'],
            ['ori', 'קח את הפנס מהשולחן עם הכלים בכניסה. ותמצא את מכשיר הקשר — הוא באחד הארונות במטבח.'],
            ['ori', 'ותזוז בשקט. ברצינות. אם הוא קם — תתחבא. בארון, מתחת לשולחן, איפה שאתה יכול.'],
          ], { look: new THREE.Vector3(ori.pos.x, 1.2, ori.pos.z) });
          g.ui.toast(g.ui.touch ? '⬇ = התכופפות · 🔦 = פנס · ✋ = פעולה' : 'C = התכופפות · F = פנס · E = פעולה · Shift = ריצה (רועש!)', 5000);
        },
        skip: () => { F.entered2 = true; },
      },
      { // flashlight + walkie
        run: async () => {
          this.item({ id: 'flashlight', x: 0.95, y: 0.78, z: 2.85, mesh: this.mesh('flashlight'), label: 'לקחת את הפנס', give: 'flashlight', onTake: () => { p.hasFlashlight = true; p.setFlashlight(true); this.ui.toast(this.ui.touch ? 'לחץ 🔦 כדי להדליק/לכבות' : 'F / קליק ימני — פנס', 3500); } });
          this.obj('flash', 'קח את הפנס מהשולחן בכניסה');
          this.obj('walkie', 'מצא את מכשיר הקשר במטבח', { sub: 'באחד הארונות התחתונים' });
          // kitchen cabinets: one has the walkie, one is full of pots
          const slots = [5.4, 6.0, 7.2, 7.8];
          const walkieSlot = pick([0, 2, 3]);
          slots.forEach((z, i) => {
            const it = this.act({
              id: 'cab' + i, x: 0.7, y: 0.5, z, r: 1.6, label: () => (it.opened ? null : 'לפתוח ארון'), enabled: () => !it.opened,
              use: () => {
                it.opened = true;
                audio.at({ x: 0.7, y: 0.5, z }, (d) => audio.doorCreak(d, 0.4, 0.5));
                if (i === 1) {
                  audio.at({ x: 0.7, y: 0.5, z }, (d) => audio.potsCrash(d), 3);
                  w.emitNoise(0.7, z, 14, 'pots');
                  this.ui.toast('💥 סירים נפלו!!');
                  this.radio('מה זה היה?! הרעש הזה... תקפא במקום.');
                } else if (i === walkieSlot) {
                  p.give('walkie'); audio.pickup(); F.walkie = true;
                } else this.ui.toast(pick(['רק שקיות במבה ריקות.', 'סכו״ם. ומשהו דביק.', 'קופסאות טונה. הרבה קופסאות טונה.']));
              },
            });
          });
          this.battery(19.55, 0.55, 5.0);
          await this.waitFor(() => p.has('flashlight') && p.has('walkie'));
          this.done('flash'); this.done('walkie');
          await this.wait(1.5);
          await this.say('yarin', '...שומע? שומע?! אם מישהו מחזיק את הקשר הזה — תענה!');
          await this.say('yarin', 'זאת ירין. אני בבניין ממול. ברחתי מהקומונה לפני יומיים, כשזה התחיל.');
          await this.say('yarin', 'אני רואה את החלונות שלכם מפה. אני אגיד לך מה אני רואה.');
          await this.say('yarin', 'ודבר אחד: הוא שומע הכל. תתכופף כשאתה ליד החדר שלו. ואל תכוון לו פנס לפנים.');
        },
        skip: () => { p.hasFlashlight = true; p.give('flashlight'); p.give('walkie'); F.walkie = true; },
      },
      { // the diary in the boys' room
        cp: true,
        restore: () => p.setPose(11.0, 6.0, P, 0),
        run: async () => {
          this.obj('diary', 'מצא את היומן של הקומונה', { sub: 'אורי חושב שנועם לקח אותו לחדר בנים', hint: 'היומן על הרצפה ליד המיטה של נועם. תתכופף!' });
          this.say('ori', 'היומן של הקומונה... נועם לקח אותו לחדר בנים. אם נבין מה קרה — אולי נוכל לעצור את זה.');
          F.showSleep = true;
          this.item({
            id: 'diary', x: 9.35, y: 0.04, z: 14.7, mesh: this.mesh('diary'), label: 'לקחת את היומן', give: 'diary',
            onTake: async () => {
              F.diary = true;
              // he stirs...
              n.stopSnore(); if (n.em) { audio.mumble(n.em.input); audio.bedCreak(n.em.input); }
              this.radio('אל תזוז. הוא זז במיטה...');
              await this.ui.showNote(DIARY);
              setTimeout(() => { if (n.state === 'sleep' && n.em) audio.snoreLoop(n.em.input); }, 2500);
            },
          });
          // first time in the hallway: the light flickers
          await this.waitFor(() => F.diary || (p.room && p.room.id === 'hallway'));
          if (!F.diary) { g.flickerHall(2.0); audio.zap(audio.sfx); }
          await this.waitFor(() => F.diary);
          this.done('diary');
        },
        skip: () => { F.diary = true; p.give('diary'); },
      },
      { // back to Ori, then bed
        run: async () => {
          this.obj('backOri', 'חזור לאורי בפינת האוכל');
          await this.waitFor(() => dist2(p.pos.x, p.pos.z, ori.pos.x, ori.pos.z) < 3.2 && n.state === 'sleep');
          await this.talk([
            ['ori', 'מסכה עם קרניים... כמו הלוגו של DIMONA DEMONS על הקיר.'],
            ['ori', 'אז ככה זה התחיל. נועם מצא את המסכה, והמסכה... מצאה אותו.'],
            ['ori', 'טוב. באמצע הלילה אין מה לעשות. לך לחדר שלך, תסגור את הדלת ותנסה לישון.'],
            ['ori', 'אני נשאר פה. מישהו צריך לשמור.'],
          ], { look: new THREE.Vector3(ori.pos.x, 1.2, ori.pos.z) });
          this.done('backOri');
          this.obj('sleep', 'לך לישון בחדר שלך', { sub: 'סגור את הדלת אחריך' });
          await this.goToBed();
          await this.endNight(1, async () => {
            await sleep(1500);
            const dp = { x: 4.65, y: 1.2, z: 10.6 };
            for (let i = 0; i < 4; i++) { audio.at({ x: 9 - i * 1.2, y: 0.1, z: 9.9 }, (d) => audio.footstep(d, { heavy: true, vol: 1.2 }), 2); await sleep(700); }
            await sleep(600);
            audio.at(dp, (d) => audio.lockedRattle(d));
            await sleep(1400);
            this.ui.subtitle('נועם', 'אני יודע שאתה ער...', { danger: true, time: 3 });
            audio.at(dp, (d) => audio.demonVoice(d, 1.6));
            await sleep(3200);
          });
        },
      },
    ];
    return { title: 'השקט', clock: 23 * 60 + 47, setup, stages };
  }

  // shared: walk into your room, close the door, lie down
  async goToBed() {
    const w = this.world, p = this.player;
    const d = w.doors.get('myroom');
    let slept = false;
    this.act({
      id: 'bed', x: w.bedPos.x, y: 0.6, z: w.bedPos.z, r: 1.9, cos: 0.6,
      label: () => (d.isOpen ? 'סגור קודם את הדלת' : 'ללכת לישון'),
      enabled: () => p.room && p.room.id === 'myroom' && !this.noam.active,
      use: () => { if (d.isOpen) { this.ui.toast('סגור את הדלת של החדר קודם.'); return; } slept = true; },
    });
    await this.waitFor(() => slept);
    this.done('sleep');
  }

  async endNight(nightNum, scene) {
    const p = this.player, g = this.game;
    p.frozen = true; p.setFlashlight(false);
    g.ui.setHud(false);
    await this.ui.fade(1, 1800);
    audio.stopAllLoops();
    this.noam.stopSnore();
    if (scene) await scene();
    this.game.saveProgress(nightNum + 1);
    await this.ui.nightCard(`לילה ${nightNum}`, 'שרדת.', '');
    this.game.nextNight(nightNum + 1);
  }

  // =====================================================================
  //                               NIGHT 2
  // =====================================================================
  night2() {
    const g = this.game, w = this.world, p = this.player, n = this.noam, ori = g.ori;
    const F = this.flags;
    const setup = () => {
      w.doors.get('boys').setOpenInstant(0.15);
      n.setSleeping();
      ori.place(13.65, 3.0, P / 2, 'sit');
      ori.lookAtPlayer = true;
      this.giveBasics();
      p.setPose(4.4, 14.4, -0.05, 0);
      F.showSleep = true;
      this.battery(0.5, 0.79, 16.4);
      this.battery(7.0, 0.8, 16.4);
    };
    const panelUse = () => {
      // the electrical panel
      this.act({
        id: 'panel', x: w.panelPos.x, y: 1.7, z: w.panelPos.z, r: 1.7, hold: 2.2,
        label: () => {
          if (F.power) return null;
          if (!p.has('key_panel')) return 'לוח חשמל (נעול)';
          if (!p.has('fuse')) return 'צריך נתיך חדש';
          return 'להחליף נתיך ולהחזיר חשמל';
        },
        enabled: () => !F.power,
        onHold: (dt, k) => { if (Math.random() < dt * 6) audio.click(audio.now, audio.sfx, 0.2, 2500); },
        use: () => {
          if (!p.has('key_panel') || !p.has('fuse')) { audio.lockedRattle(audio.sfx); return; }
          F.power = true; p.take('fuse'); p.take('key_panel');
        },
      });
      // hold length 0 for locked case: make it immediate
      const it = w.getInteractable('panel');
      const baseHold = it.hold;
      Object.defineProperty(it, 'hold', { get: () => (p.has('key_panel') && p.has('fuse') ? baseHold : 0) });
    };
    const stages = [
      {
        run: async () => {
          this.ui.setNightLabel('לילה 2 · ההתעוררות');
          await this.game.nightIntro('לילה 2', 'ההתעוררות', '02:14');
          await this.say('yarin', 'אתה ער? כל הבניין שלכם נהיה חשוך לפני רבע שעה. החשמל נפל אצלכם.');
          await this.say('yarin', 'אורי מחכה לך בסלון. תיזהר במסדרון — אני לא רואה כלום בחושך הזה.');
          this.obj('talkOri', 'דבר עם אורי בסלון');
          await this.waitFor(() => dist2(p.pos.x, p.pos.z, ori.pos.x, ori.pos.z) < 3.2);
          await this.talk([
            ['ori', 'החשמל קפץ. בלי חשמל אין מקרר, אין מזגן — ובעיקר אין אור.'],
            ['ori', 'לוח החשמל במסדרון. אבל הוא נעול, והמפתח אצל נועם. על השידה ליד הראש שלו.'],
            ['ori', 'ותצטרך נתיך חדש. יש בארון מתחת לכיור בשירותים.'],
            ['ori', 'אני יודע שזה מטורף לגנוב ממנו כשהוא ישן... אבל בחושך הזה הוא מסוכן עוד יותר. בבקשה.'],
          ], { look: new THREE.Vector3(ori.pos.x, 1.0, ori.pos.z) });
          this.done('talkOri');
        },
      },
      {
        cp: true,
        restore: () => p.setPose(12.6, 4.0, -P / 2, 0),
        run: async () => {
          panelUse();
          this.obj('panelKey', 'קח את המפתח מהשידה של נועם', { sub: 'תתכופף. אל תכוון אליו פנס. תחזיק את הכפתור.', hint: 'השידה ליד הראש של נועם, בחדר בנים. תתכופף ותחזיק.' });
          this.obj('fuse', 'מצא נתיך בשירותים', { sub: 'בארון מתחת לכיור', hint: 'השירותים — הארון הלבן מתחת לכיור.' });
          // key on the nightstand — taking it takes time, and makes noise
          const ns = w.nightstandPos;
          this.item({
            id: 'panelKey', x: ns.x, y: ns.y, z: ns.z, mesh: this.mesh('key'), label: 'לקחת את המפתח', give: 'key_panel', hold: 2.4,
            onHold: (dt) => { n.disturbance += dt * (p.crouch ? 9 : 22); if (Math.random() < dt * 5) audio.at({ x: ns.x, y: 0.6, z: ns.z }, (d) => audio.click(audio.now, d, 0.15, 3800), 1); },
            onTake: () => { this.radio('יפה... עכשיו צא משם לאט.'); },
          });
          // fuse in the bathroom cabinet + mirror scare
          this.item({
            id: 'fuse', x: w.sinkPos.x, y: 0.45, z: w.sinkPos.z, mesh: null, label: 'לפתוח את הארון מתחת לכיור', give: 'fuse',
            onTake: () => { this.ui.toast('⚡ מצאת נתיך'); F.fuse = true; },
          });
          await this.waitFor(() => { if (p.has('key_panel')) this.done('panelKey'); if (p.has('fuse')) this.done('fuse'); return p.has('key_panel') && p.has('fuse'); });
        },
        skip: () => { panelUse(); p.give('key_panel'); p.give('fuse'); F.fuse = true; },
      },
      { // mirror scare happens in parallel the moment you look at the mirror with the fuse
        run: async () => {
          this.obj('power', 'פתח את לוח החשמל במסדרון והחזר את החשמל');
          let scared = false;
          const mirrorWatch = this.waitFor(() => {
            if (scared || !F.fuse) return scared;
            const cam = p.camera, m = w.mirrorPos;
            const dx = m.x - cam.position.x, dz = m.z - cam.position.z, d = Math.hypot(dx, dz);
            if (d > 2.8) return false;
            const dir = cam.getWorldDirection(new THREE.Vector3());
            if ((dx * dir.x + dz * dir.z) / d > 0.85) { scared = true; this.game.mirrorScare(); }
            return scared;
          }).catch(() => {});
          await this.waitFor(() => F.power);
          scared = true;
          this.done('power');
          await this.wakeSequence();
        },
        skip: () => { F.power = true; p.take('fuse'); p.take('key_panel'); },
      },
      { // HIDE!
        cp: true,
        restore: () => {
          // restarting from checkpoint: state after the wake-up
          F.showSleep = false;
          g.powerOn(true); w.tv.setMode('match'); audio.tvLoop(audio.emitter(w.tvPos.x, w.tvPos.y, w.tvPos.z).input, true);
          w.doors.get('entrance').setOpenInstant(1); w.doors.get('boys').setOpenInstant(1);
          p.setPose(15.6, 9.9, P / 2, 0);
          n.show(true); n.teleport(2.5, -0.5, 0);
          ori.hide();
        },
        run: async () => {
          n.canReturnToBed = false;
          this.obj('hide', 'התחבא!', { sub: 'בארון, מתחת לשולחן, במקלחת...' });
          n.startAI('search');
          n.lastKnown.set(11.5, 0, 6.5);
          n._setPath(11.5, 6.5);
          n.searchLeft = 28;
          n._pickSearchSpots();
          const t0 = g.time;
          let hiddenFor = 0;
          await this.waitFor(() => { if (p.hidden) hiddenFor += 1 / 60; return hiddenFor > 10 || g.time - t0 > 32; });
          this.done('hide');
          w.tv.setMode('off'); audio.stopLoop('tv', 0.1); w.tvLight.intensity = 0;
          audio.at(w.tvPos, (d) => audio.doorThud(d, 1.5));
          this.radio('הוא... כיבה את הטלוויזיה. עם האגרוף.');
        },
      },
      {
        run: async () => {
          await this.wait(3);
          await this.say('yarin', 'אורי לא עונה לי... ראיתי משהו נופל ליד המחסן על הגג. אולי הטלפון שלו.');
          this.obj('phone', 'מצא את הטלפון של אורי במרפסת', { hint: 'ליד מחסן הגג, בצד המזרחי של המרפסת.' });
          this.item({
            id: 'phone', x: 15.9, y: 0.02, z: -5.3, mesh: this.mesh('phone'), label: 'להרים את הטלפון', give: 'phone_ori',
            onTake: async () => {
              F.phone = true;
              await this.ui.showPhone([
                { from: 'ירין', text: 'איפה אתם?? למה אף אחד לא עונה' },
                { from: 'קבוצת הקומונה 🏠', text: 'מישהו ראה את נועם קם?' },
                { out: true, text: 'הוא לא נועם.' },
                { out: true, text: 'הוא לא נועם. הוא לא נועם. הוא' },
                { glitch: true, text: '▓▓▒░ אתה הבא ░▒▓▓' },
              ]);
            },
          });
          await this.waitFor(() => F.phone);
          this.done('phone');
          await this.say('yarin', 'מה כתוב שם...? אוי לא. תחזור לחדר שלך. עכשיו. ותסגור את הדלת.');
          this.obj('sleep', 'חזור לחדר שלך וסגור את הדלת', { sub: 'הוא עדיין ער...' });
          g.allowHiding = true;
          await this.goToBedAwake();
          await this.endNight(2, async () => {
            await sleep(1600);
            audio.at({ x: 4.65, y: 1.2, z: 10.7 }, (d) => audio.knock(d, 3, 1.2));
            await sleep(2200);
            this.ui.subtitle('נועם', 'מחר בלילה.', { danger: true, time: 3 });
            audio.at({ x: 4.65, y: 1.4, z: 10.6 }, (d) => audio.demonVoice(d, 1.2));
            await sleep(3000);
          });
        },
      },
    ];
    return { title: 'ההתעוררות', clock: 2 * 60 + 14, setup, stages };
  }

  // bed when Noam is awake: you need him to be away from the room
  async goToBedAwake() {
    const w = this.world, p = this.player, n = this.noam;
    const d = w.doors.get('myroom');
    let slept = false;
    this.act({
      id: 'bed', x: w.bedPos.x, y: 0.6, z: w.bedPos.z, r: 1.9, cos: 0.6,
      label: () => (d.isOpen ? 'סגור קודם את הדלת' : n.state === 'chase' ? 'הוא רודף אחריך!' : 'לנעול ולהיכנס למיטה'),
      enabled: () => p.room && p.room.id === 'myroom',
      use: () => {
        if (d.isOpen) { this.ui.toast('סגור את הדלת של החדר קודם.'); return; }
        if (n.state === 'chase' || (n.root.visible && dist2(n.pos.x, n.pos.z, p.pos.x, p.pos.z) < 5)) { this.ui.toast('הוא קרוב מדי...'); return; }
        d.locked = true; audio.unlock(); slept = true;
      },
    });
    await this.waitFor(() => slept);
    n.state = 'off'; n.show(false);
    this.done('sleep');
  }

  async wakeSequence() {
    const g = this.game, w = this.world, p = this.player, n = this.noam, ori = g.ori;
    p.frozen = true; p.freeLook = true;
    audio.zap(audio.sfx);
    await this.wait(0.6);
    g.powerOn(true);
    audio.powerUp();
    w.tv.setMode('goal'); w.tvLight.intensity = 2.2;
    const tvEm = audio.emitter(w.tvPos.x, w.tvPos.y, w.tvPos.z, { ref: 3 });
    audio.tvLoop(tvEm.input, true); audio.goalRoar(tvEm.input);
    g.flickerHall(1.5);
    w.emitNoise(w.tvPos.x, w.tvPos.z, 30, 'loud');
    await this.wait(1.4);
    n.stopSnore();
    audio.at({ x: w.noamBed.x, y: 0.8, z: w.noamBed.z }, (d) => audio.bedCreak(d));
    this.ui.setSleepMeter(100, true);
    await this.wait(1.2);
    this.ui.subtitle('נועם', 'מי. הדליק. את. זה.', { danger: true, time: 3 });
    n.ensureEmitter(); if (n.em) audio.demonVoice(n.em.input, 2.2);
    audio.stinger(1);
    await this.wait(1.6);
    this.flags.showSleep = false;
    this.ui.setSleepMeter(0, false);
    this.say('ori', 'לעזאזל! הטלוויזיה! תתחבא! אני אמשוך אותו ממך!');
    // Noam bursts out of the boys' room and stares at you
    n.state = 'script'; n.model.setPossessed(true); n.show(true);
    n.teleport(10.65, 12.0, P);
    const bd = w.doors.get('boys'); bd.open(true, true);
    await this.wait(0.4);
    p.freeLook = true;
    p.lookAtPoint(new THREE.Vector3(10.65, 1.5, 10.2), 5);
    await n.walkTo(10.7, 10.0, { run: true });
    n.faceTowards(p.pos.x, p.pos.z); n.scriptPose = 'idle';
    if (n.em) audio.growl(n.em.input, 1.5, 1.3);
    await this.wait(1.3);
    // Ori yells from the living room and runs for the entrance
    ori.lookAtPlayer = false;
    ori.place(12.3, 6.5, -P / 2, 'idle');
    this.ui.subtitle('אורי', 'הי! נועם!! פה! תתפוס אותי אם אתה יכול!', { time: 2.5 });
    audio.murmur(audio.voice, 1.5, 1.2);
    p.stopLookAt();
    p.frozen = false; p.freeLook = false;
    const ent = w.doors.get('entrance');
    ent.locked = false;
    const oriRun = (async () => {
      await ori.walkTo(6.0, 3.2, { speed: 4.2, mode: 'run' });
      await ori.walkTo(2.5, 0.8, { speed: 4.2, mode: 'run' });
      ent.open(true, true);
      await ori.walkPath([[2.5, -1.5], [9.5, -4.5], [16.0, -5.6]], { speed: 4.2, mode: 'run' });
      ori.hide();
    })();
    await this.wait(0.6);
    await n.walkTo(6.0, 3.4, { run: true });
    await n.walkTo(2.5, 0.6, { run: true });
    await n.walkTo(2.5, -1.5, { run: true });
    await n.walkTo(10.5, -4.6, { run: true });
    await oriRun.catch(() => {});
    await this.wait(0.8);
    audio.at({ x: 16, y: 1.5, z: -5.5 }, (d) => { audio.scream(0.35); }, 3);
    await this.wait(2.0);
    n.show(false);
    await this.say('yarin', 'מה קורה שם?! ראיתי את אורי רץ על הגג... ואז... הוא פשוט נעלם.');
    n.show(true); n.teleport(4.0, -2.0, P);
    await this.say('yarin', 'נועם חוזר פנימה! תתחבא! עכשיו!!');
  }

  // =====================================================================
  //                               NIGHT 3
  // =====================================================================
  night3() {
    const g = this.game, w = this.world, p = this.player, n = this.noam;
    const F = this.flags;
    const setup = () => {
      this.giveBasics();
      g.powerOn(true);
      g.hallFlicker = 1;
      w.boysLight.intensity = 0.6; w.boysStrip.visible = true;
      p.setPose(4.4, 14.4, -0.05, 0);
      n.canReturnToBed = false;
      n.patrolSpeed = 1.55; n.chaseSpeed = 3.7;
      n.show(true); n.teleport(9.0, -4.0, P);
      n.state = 'off';
      this.battery(13.9, 0.5, 4.3);
      this.battery(0.5, 0.79, 16.4);
    };
    const shedStuff = () => {
      const shed = w.doors.get('shed');
      this.act({
        id: 'shedPad', x: 16.3, y: 1.1, z: -5.75, r: 1.8,
        label: () => (shed.locked ? 'מנעול קוד — להקיש קוד' : null), enabled: () => shed.locked,
        use: async () => {
          const ok = await this.ui.keypad((c) => c === '2455');
          if (ok) { shed.locked = false; audio.unlock(); shed.open(); F.shedOpen = true; }
        },
      });
    };
    const stages = [
      {
        run: async () => {
          this.ui.setNightLabel('לילה 3 · הקול בקשר');
          await this.game.nightIntro('לילה 3', 'הקול בקשר', '01:33');
          n.startAI('patrol');
          await this.say('yarin', 'אתה שם? ...נועם לא חזר לישון מאז אתמול. הוא מסתובב. כל הלילה.');
          await this.say('yarin', 'אני אגיד לך איפה הוא. תקשיב לקשר.');
          await this.wait(4);
          audio.staticBed(3);
          await this.wait(1.5);
          await this.say('oriRadio', '...ש...שומע? זה... זה אורי.');
          await this.say('yarin', 'אורי?! אתה חי!!');
          await this.say('oriRadio', 'בקושי. נועם תפס אותי על הגג וסגר אותי במחסן הגג. יש עליו מנעול קוד.');
          await this.say('oriRadio', 'שמעתי אותו ממלמל את הקוד כשהוא נעל... משהו על לוח השעם בסלון.');
        },
      },
      {
        cp: true,
        restore: () => n.startAI('patrol'),
        run: async () => {
          shedStuff();
          this.obj('clue', 'חפש רמז לקוד בלוח השעם בסלון', { hint: 'לוח השעם ליד הטלוויזיה. יש שם פתק חדש.' });
          const note = this.mesh('note'); note.rotation.set(0, -P / 2, 0); note.children[0].rotation.set(0, 0, 0);
          this.item({
            id: 'codeNote', x: 19.8, y: 1.6, z: 6.55, mesh: note, label: 'לקרוא את הפתק', glint: true,
            onTake: async () => { F.clue = true; await this.ui.showNote(CODE_NOTE); },
          });
          await this.waitFor(() => F.clue);
          this.done('clue');
          this.obj('code', 'גלה את הקוד', { sub: 'המספר על הגב של נועם: ?? · הקו לדימונה: ??', hint: 'החולצה של נועם תלויה על מתקן הייבוש. ולוח הזמנים הצהוב על לוח השעם.' });
          const upd = () => this.objSub('code', `המספר על הגב של נועם: ${F.n24 ? '24' : '??'} · הקו לדימונה: ${F.n55 ? '55' : '??'}`);
          this.act({ id: 'jersey', x: 6.7, y: 0.7, z: 7.55, r: 1.8, label: 'לבדוק את החולצה של נועם', use: () => { F.n24 = true; upd(); this.ui.toast('SEMENYO 24 — המספר על הגב: 24'); audio.paper(); } });
          this.act({ id: 'bus', x: 19.8, y: 1.25, z: 7.85, r: 1.8, label: 'לקרוא את לוח הזמנים', use: async () => { F.n55 = true; upd(); await this.ui.showNote(BUS_NOTE); } });
          this.obj('shed', 'פתח את מחסן הגג', { sub: 'מנעול של 4 ספרות', hint: 'הקוד: המספר על הגב, ואחריו הקו לדימונה.' });
          await this.waitFor(() => { if (F.n24 && F.n55) this.done('code'); return F.shedOpen; });
          this.done('code'); this.done('shed');
        },
        skip: () => { shedStuff(); F.clue = F.n24 = F.n55 = true; },
      },
      {
        cp: true,
        restore: () => {
          const shed = w.doors.get('shed'); shed.locked = false; shed.setOpenInstant(1);
          p.setPose(15.6, -5.75, -P / 2, 0);
          n.startAI('patrol'); n.teleport(15.5, 13.0, 0);
        },
        run: async () => {
          if (this.restoredStage !== this.stageIdx) {
            this.obj('inside', 'תיכנס למחסן הגג');
            await this.waitFor(() => p.room && p.room.id === 'shed');
            this.done('inside');
            // Ori is not here. Only his radio... and a photo.
            const rad = this.mesh('walkie'); rad.rotation.z = P / 2;
            rad.position.set(18.5, 0.05, -5.6); this.spawn(rad);
            await this.wait(1.0);
            audio.at({ x: 18.5, y: 0.3, z: -5.6 }, (d) => { audio.squelch(d); audio.staticBed(4, d); }, 6);
            await this.say('oriRadio', '...זה לא... זה לא המחסן הזה... הוא העביר אותי...');
            await this.say('oriRadio', 'אני שומע מים... טפטוף... מים...');
            audio.at({ x: 18.5, y: 0.3, z: -5.6 }, (d) => audio.laugh(d), 4);
            this.ui.subtitle('📻 ???', 'חה. חה. חה.', { danger: true, time: 2.5 });
            await this.wait(2.5);
            this.item({ id: 'photo1', x: 19.0, y: 0.03, z: -6.2, mesh: null, label: 'להרים תמונה', onTake: () => this.ui.showPhoto(IMAGES.photoTerrace, 'היום הראשון בקומונה. כולנו.') });
            await this.say('yarin', 'תצא משם! נועם בדרך למרפסת! הוא שמע!');
            n.state = 'investigate';
            n.lastKnown.set(17.5, 0, -5.4);
            n.teleport(2.5, 1.0, P);
            w.doors.get('entrance').setOpenInstant(0);
            n._setPath(15.5, -5.2);
          }
          this.obj('water', 'מצא את אורי — "אני שומע מים"', { hint: 'מים... המקלחת בשירותים.' });
          audio.showerLoop(audio.emitter(w.showerPos.x, w.showerPos.y, w.showerPos.z, { ref: 1.5 }).input);
          w.mirrorWriting.visible = true;
          const shirt = this.mesh('shirt');
          this.item({ id: 'oriShirt', x: 16.3, y: 0.03, z: 16.3, mesh: shirt, label: 'להרים את החולצה של אורי', onTake: () => { F.shirt = true; audio.stopLoop('shower', 1); } });
          await this.waitFor(() => F.shirt);
          this.done('water');
          await this.say('oriRadio', '...לא... אני לא שם... אני ב... המחסן של הדירה. מאחורי הדלת הנעולה.');
          await this.say('oriRadio', 'אני שומע את כולם נושמים פה. כולם פה. ישנים.');
          await this.say('yarin', 'המחסן?! המפתח של המחסן... ראיתי את נועם שם אותו בכיס. הוא לא מוריד אותו.');
          await this.say('oriRadio', 'מחר... תבוא מחר. ותביא... ', {});
          audio.staticBed(1.5);
          this.obj('sleep', 'חזור לחדר שלך וסגור את הדלת');
          await this.goToBedAwake();
          await this.endNight(3, async () => {
            await sleep(1800);
            audio.squelch(); audio.staticBed(3);
            this.ui.subtitle('📻 נועם', 'גם אתה תישן איתם.', { danger: true, time: 3.5 });
            audio.demonVoice(audio.voice, 2);
            await sleep(3800);
          });
        },
      },
    ];
    return { title: 'הקול בקשר', clock: 1 * 60 + 33, setup, stages };
  }

  // =====================================================================
  //                               NIGHT 4
  // =====================================================================
  night4() {
    const g = this.game, w = this.world, p = this.player, n = this.noam, ori = g.ori;
    const F = this.flags;
    const setup = () => {
      this.giveBasics();
      g.powerOn(true);
      g.hallFlicker = 1;
      g.redAlert = 0.35;
      w.muralEyes.visible = true;
      w.boysLight.intensity = 0.9; w.boysStrip.visible = true;
      p.setPose(4.4, 14.4, -0.05, 0);
      n.canReturnToBed = false;
      n.patrolSpeed = 1.7; n.chaseSpeed = 3.9;
      n.show(true); n.teleport(16.5, 6.5, P);
      n.state = 'off';
      g.director = 0.55;
      this.battery(9.6, 0.8, 4.2);
      this.battery(0.4, 0.8, 16.3);
      this.battery(18.8, 0.05, -6.2);
    };
    const stages = [
      {
        run: async () => {
          this.ui.setNightLabel('לילה 4 · DIMONA DEMONS');
          await this.game.nightIntro('לילה 4', 'DIMONA DEMONS', '03:03');
          n.startAI('patrol');
          await this.say('yarin', 'זה הלילה האחרון. אני מרגישה את זה. אם לא נגמור את זה עד הזריחה...');
          await this.say('oriRadio', 'תקשיב. הדבר שבתוך נועם... הוא עדיין נועם. ונועם לא יכול להגיד לא לפיפא.');
          await this.say('oriRadio', 'תדליק לו את הפלייסטיישן. הוא יתיישב לשחק. ואז תוציא לו את המפתח מהכיס.');
        },
      },
      {
        cp: true,
        restore: () => n.startAI('patrol'),
        run: async () => {
          this.obj('ctrl', 'מצא את השלט של הפלייסטיישן', { sub: 'כנראה בחדר בנים', hint: 'השלט על המיטה של נועם בחדר בנים.' });
          this.item({ id: 'controller', x: 8.6, y: 0.5, z: 14.4, mesh: this.mesh('controller'), label: 'לקחת את השלט', give: 'controller' });
          await this.waitFor(() => p.has('controller'));
          this.done('ctrl');
          this.obj('ps', 'הדלק את הפלייסטיישן בסלון');
          let on = false;
          this.act({ id: 'psOn', x: 19.5, y: 0.6, z: 3.7, r: 1.8, label: 'להדליק את הפלייסטיישן', enabled: () => p.has('controller') && !on, use: () => { on = true; p.take('controller'); } });
          await this.waitFor(() => on);
          this.done('ps');
          w.tv.setMode('match'); w.tvLight.intensity = 2;
          const tvEm = audio.emitter(w.tvPos.x, w.tvPos.y, w.tvPos.z, { ref: 2 });
          audio.tvLoop(tvEm.input, true);
          w.emitNoise(w.tvPos.x, w.tvPos.z, 30, 'loud');
          this.radio('הוא שמע! הוא בדרך לסלון! תתחבא ותחכה!');
          n.state = 'script';
          await n.walkTo(14.7, 4.3, { speed: 2.4, mode: 'walk' });
          n.startTV(55);
          n.model.setPossessed(true);
          this.radio('הוא... התיישב?! זה עובד! עכשיו — מאחורי הספה. לאט.');
        },
        skip: () => {},
      },
      {
        run: async () => {
          this.obj('pocket', 'קח את המפתח מהכיס של נועם', { sub: 'תתגנב מאחורי הספה. אל תיכנס לו לשדה הראייה.' });
          let got = false;
          this.act({
            id: 'pocket', x: 13.75, y: 0.7, z: 4.3, r: 1.5, cos: 0.6, hold: 2.2,
            label: () => (n.state === 'tv' ? 'לשלוף את המפתח מהכיס' : null),
            enabled: () => n.state === 'tv' && p.pos.x < 13.4 && !got,
            onHold: (dt) => { if (Math.random() < dt * 2) audio.click(audio.now, audio.sfx, 0.12, 4000); },
            use: () => { got = true; p.give('key_storage'); audio.pickup(); },
          });
          await this.waitFor(() => got || n.state !== 'tv');
          if (!got) {
            // the match ended before you got it: he'll sit again when it restarts
            this.radio('המשחק נגמר! הוא קם! תתחבא — אני אדליק את זה שוב מרחוק.');
            await this.wait(25);
            n.state = 'script';
            await n.walkTo(14.7, 4.3, { speed: 2.4 });
            n.startTV(45);
            this.radio('הוא שוב יושב. זאת ההזדמנות האחרונה.');
            await this.waitFor(() => got || n.state !== 'tv');
            if (!got) { await this.waitFor(() => got); }
          }
          this.done('pocket');
          this.radio('יש לך את זה!! עכשיו למחסן! מהר!');
          await this.wait(4);
          if (n.state === 'tv') { w.tv.setMode('fulltime'); n.timer = 0.1; }
          await this.wait(0.3);
          this.ui.subtitle('נועם', 'איפה. המפתח.', { danger: true, time: 3 });
          if (n.em) audio.demonVoice(n.em.input, 1.5);
          n.state = 'search'; n.lastKnown.copy(p.pos); n._setPath(p.pos.x, p.pos.z); n.searchLeft = 20; n._pickSearchSpots();
        },
      },
      {
        cp: true,
        restore: () => {
          p.give('key_storage'); p.setPose(17.5, 9.9, -P / 2, 0);
          w.tv.setMode('fulltime'); n.startAI('patrol'); n.teleport(6, 3, 0);
        },
        run: async () => {
          const st = w.doors.get('storage');
          this.obj('storage', 'פתח את המחסן בסוף המסדרון');
          this.act({ id: 'stKey', x: st.cx, y: 1.1, z: st.cz - 0.2, label: 'לפתוח את המחסן עם המפתח', enabled: () => st.locked && p.has('key_storage'), use: () => { st.locked = false; audio.unlock(); st.open(); p.take('key_storage'); F.storage = true; } });
          await this.waitFor(() => F.storage);
          this.done('storage');
          // inside: Ori and the missing members
          w.sleepers.forEach((m) => (m.visible = true));
          ori.place(19.3, 12.1, -P / 2, 'sit');
          ori.lookAtPlayer = true;
          const mask = this.mesh('mask'); mask.position.copy(w.maskShelfPos); mask.rotation.y = -P / 2; this.spawn(mask);
          const maskLight = new THREE.PointLight(0xff2010, 1.5, 3, 2); maskLight.position.copy(w.maskShelfPos).add(new THREE.Vector3(-0.3, 0.1, 0)); this.spawn(maskLight);
          await this.waitFor(() => p.room && p.room.id === 'storage');
          this.flags.noRadio = true;
          await this.talk([
            ['ori', 'ידעתי שתבוא!! תסתכל עליהם... כולם פה. הם נושמים, אבל לא מתעוררים.'],
            ['ori', 'זאת המסכה. על המדף. כל עוד היא קיימת — נועם לא יחזור להיות נועם.'],
            ['ori', 'צריך לשרוף אותה. הכיריים במטבח! תיקח אותה ותרוץ! אני אחריך!'],
          ], { look: new THREE.Vector3(ori.pos.x, 0.8, ori.pos.z) });
          this.flags.noRadio = false;
          this.obj('mask', 'קח את המסכה');
          let took = false;
          this.act({ id: 'maskTake', x: w.maskShelfPos.x, y: w.maskShelfPos.y, z: w.maskShelfPos.z, r: 2, label: 'לקחת את המסכה', enabled: () => !took, use: () => { took = true; mask.visible = false; maskLight.intensity = 0; p.give('mask'); } });
          await this.waitFor(() => took);
          this.done('mask');
          // everything goes red. He knows.
          g.redAlert = 1;
          audio.whisper(audio.now, audio.sfx, -0.6, 3, 1.5); audio.whisper(audio.now + 0.3, audio.sfx, 0.6, 3, 1.5);
          audio.stinger(1.2);
          g.flickerHall(3);
          this.ui.flash(300, '#ff0000');
          // one of the "sleepers" in the corner sits up... it's Noam
          n.state = 'script'; n.scriptPose = 'idle';
          w.sleepers[0].visible = false; w.sleepers[1].visible = false;
          n.teleport(17.75, 16.0, Math.atan2(p.pos.x - 17.75, p.pos.z - 16.0));
          n.show(true); n.model.setPossessed(true);
          this.ui.subtitle('נועם', 'תחזיר. לי. את. זה.', { danger: true, time: 3 });
          n.ensureEmitter(); if (n.em) { audio.demonVoice(n.em.input, 2); audio.growl(n.em.input, 2, 1.5); }
          this.radio('הוא היה שם כל הזמן!! רוץ!!!');
          await this.wait(1.3);
          g.chaseMul = 1.0;
          n.startAI('chase'); n.state = 'chase'; n.lastKnown.copy(p.pos); n.suspicion = 1;
          audio.chaseMusic(true);
          this.obj('burn', 'שרוף את המסכה בכיריים במטבח!', { sub: 'רוץ! או תתחבא ותחכה שהוא יתרחק' });
          ori.hide();
          let burned = false;
          this.act({
            id: 'stove', x: w.stovePos.x, y: w.stovePos.y, z: w.stovePos.z, r: 1.8, hold: 1.6, cos: 0.6,
            label: 'להדליק את הכיריים ולשרוף את המסכה',
            enabled: () => p.has('mask') && !burned,
            onHold: (dt) => { if (Math.random() < dt * 8) audio.click(audio.now, audio.sfx, 0.3, 3500); },
            use: () => { burned = true; p.take('mask'); },
          });
          await this.waitFor(() => burned);
          this.done('burn');
          await this.finale();
        },
        skip: () => {},
      },
    ];
    return { title: 'DIMONA DEMONS', clock: 3 * 60 + 3, setup, stages };
  }

  async finale() {
    const g = this.game, w = this.world, p = this.player, n = this.noam;
    p.frozen = true; p.freeLook = true;
    audio.chaseMusic(false);
    g.fire = true;
    audio.whoosh();
    audio.fireLoop(audio.emitter(w.stovePos.x, w.stovePos.y, w.stovePos.z).input);
    n.state = 'script';
    n.scriptPose = 'idle';
    audio.scream(0.7);
    this.ui.subtitle('נועם', 'לא! לא!! לאאאאא!!!', { danger: true, time: 3 });
    g.shake = 1.5;
    await this.wait(2.5);
    this.ui.flash(2500, '#fff');
    await this.ui.fade(1, 400);
    g.shake = 0;
    audio.stopAllLoops();
    await sleep(1500);
    await this.game.ending();
  }
}

const DIARY = `<span class="title">יומן הקומונה — קומונת דימונה</span>

יום ראשון: נועם מצא משהו בארגז הישן במחסן. מסכה אדומה עם קרניים. הוא צחק ואמר שזה בדיוק כמו הלוגו של DIMONA DEMONS שציירנו על הקיר.

יום שני: נועם לא ישן כל הלילה. עמד מול הציור בסלון ובהה בו. שעות. כשקראנו לו הוא לא ענה.

יום שלישי: שלושה אנשים נעלמו. נועם ישן כבר 20 שעות ברצף. כשניסינו להעיר אותו, העיניים שלו נפתחו לשנייה. הן היו אדומות.

<span class="blood">אם מישהו קורא את זה — אל תעירו את נועם.</span>`;

const CODE_NOTE = `<span class="title">(כתב יד עקום, בלחץ חזק על העט)</span>

הקוד של המחסן למעלה —
המספר שעל הגב שלי,
ואחריו הקו שמביא הביתה, לדימונה.

<span class="blood">כן יעשה.</span>`;

const BUS_NOTE = `<span class="title">לוח זמנים — תחנה מרכזית באר שבע</span>

קו 7 — אצטדיון
קו 7 — בית עלמין
<b>קו 55 — דימונה</b>
קו 60 — מצפה רמון
קו 150 — ירוחם`;
