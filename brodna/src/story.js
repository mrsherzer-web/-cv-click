import * as THREE from 'three';
import { Run, Abort, store, damp, clamp } from './util.js';
import { buildMall } from './levels/mall.js';
import { buildRoad } from './levels/road.js';
import { buildKatzir } from './levels/katzir.js';
import { buildBunker } from './levels/bunker.js';
import { buildLineup } from './levels/lineup.js';
import { Car } from './car.js';
import { Guard, Traps } from './stealth.js';
import { CAST } from './cast.js';

export const CHAPTERS = [
  { title: 'קניון מיקס', kicker: 'פרק 1', sub: 'חדרה, יום חמישי בערב' },
  { title: 'הדרך לקציר', kicker: 'פרק 2', sub: 'העליות של קציר' },
  { title: 'קציר', kicker: 'פרק 3', sub: 'הכיכר, אחרי השקיעה' },
  { title: 'מצפה דור', kicker: 'פרק 4', sub: 'אסור שיראו אותך' },
  { title: 'המפתחות', kicker: 'פרק 5', sub: 'יונתי ואברהם' },
  { title: 'המחבוא', kicker: 'פרק 6', sub: 'להציל את עידו' },
  { title: 'זריחה', kicker: 'פרק 7', sub: 'מצפה דור, הבוקר שאחרי' },
];

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Story {
  constructor(game) {
    this.g = game;
    this.ui = game.ui;
    this.sfx = game.sfx;
    this.rig = game.rig;
    this.input = game.input;
    this.cast = game.cast;
    this.player = game.player;
    this.index = 0;
    this.run = null;
    this.level = null;
    this.scene = game.scene;
    this.world = null;
    this.car = null;
    this.interacts = [];
    this.inScene = new Set();
    this.guards = [];
    this.traps = null;
    this.stepAcc = 0;
    this.holdP = 0;
    this.surface = 'hard';
  }

  // ---------- plumbing
  ch(id) {
    return this.cast[id];
  }
  wait(s) {
    return this.run.wait(s);
  }
  until(fn) {
    return this.run.until(fn);
  }
  guard(p) {
    const run = this.run;
    return p.then((v) => {
      if (run.killed) throw new Abort();
      return v;
    });
  }

  stop() {
    if (this.run) this.run.kill();
    this.ui.reset();
    this.control('none');
    this.sfx.engine(false);
    this.sfx.suspense(0);
    this.sfx.stopRing();
  }

  async start(i) {
    this.stop();
    this.index = i;
    store.set('maxChapter', Math.max(store.get('maxChapter', 0), i));
    const run = (this.run = new Run(this.g.clock));
    try {
      await this.ui.fade(1, 300);
      await CH[i](this);
    } catch (e) {
      if (!(e instanceof Abort)) {
        console.error(e);
        this.ui.toast('משהו השתבש בפרק. נסו להתחיל אותו מחדש מהתפריט.');
      }
    }
    if (run === this.run && !run.killed && i + 1 < CHAPTERS.length) this.start(i + 1);
  }

  // Replace the current scene with a freshly built level.
  loadLevel(name, opts = {}) {
    const old = this.scene;
    for (const p of Object.values(this.cast)) {
      p.group.parent?.remove(p.group);
      p.pose = null;
      p.follow = null;
      p.goal = null;
      p.onArrive = null;
      p.lookTarget = null;
      p.talking = false;
      p.vel.set(0, 0, 0);
      p.speed = 0;
      p.driven = false;
      p.passTag = null;
    }
    this.inScene.clear();
    this.stealthPose = false;
    old.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => m.dispose());
    });
    const scene = new THREE.Scene();
    scene.environment = this.g.envTex;
    this.scene = scene;
    this.g.scene = scene;
    this.g.setScene?.(scene);
    const B = { mall: buildMall, road: buildRoad, katzir: buildKatzir, bunker: buildBunker, lineup: buildLineup }[name];
    this.level = B(scene, opts, this.g);
    this.world = this.level.world;
    this.interacts = [];
    this.guards = [];
    this.traps = null;
    this.car = null;
    this.surface = this.level.surface || 'hard';
    this.rig.setStyle(this.level.styleCam || {});
    if (this.rig.camera.view?.enabled) this.rig.camera.clearViewOffset(); // the menu shifts the lens
    this.g.applyPost?.();
    this.g.tuneShadows?.(scene);
    this.sfx.ambience(this.level.ambience || null);
    return this.level;
  }

  add(id, x, z, yaw = 0) {
    const p = this.ch(id);
    this.scene.add(p.group);
    this.inScene.add(p);
    p.place(x, this.world ? this.world.ground(x, z) : 0, z, yaw);
    p.faceYaw = yaw;
    p.pose = null;
    return p;
  }

  remove(id) {
    const p = this.ch(id);
    p.group.parent?.remove(p.group);
    this.inScene.delete(p);
  }

  menuScene() {
    if (this.run) this.run.kill();
    this.loadLevel('lineup');
    this.level.setup(this);
  }

  control(mode) {
    this.mode = mode;
    if (mode === 'walk') this.rig.follow();
    if (mode === 'car') this.rig.mode = 'car';
    if (mode !== 'walk') this.ui.action(null);
    this.input.reset();
  }

  // ---------- story verbs
  async say(id, text, { to = null, cam = true } = {}) {
    const p = this.ch(id);
    let other = to ? this.ch(to) : id === 'yonati' ? this.lastOther : this.player;
    if (other === p) other = null;
    if (id !== 'yonati') this.lastOther = p;
    p.talking = true;
    if (other && this.inScene.has(other) && other.pose !== 'hidden') {
      p.lookTarget = other.headWorld(new THREE.Vector3());
      other.lookTarget = p.headWorld(new THREE.Vector3());
      if (!p.goal && !p.pose && p.speed < 0.2) p.faceTo(other.pos.x, other.pos.z);
    }
    if (cam && this.mode !== 'car' && this.inScene.has(p) && p.pose !== 'hidden' && !this.noCloseups) this.rig.closeup(p, other ? other.pos : null);
    try {
      await this.guard(this.ui.say(id, text));
    } finally {
      p.talking = false;
    }
  }

  async talk(lines, opts) {
    for (const [id, text] of lines) await this.say(id, text, opts);
    this.endTalk();
  }

  endTalk() {
    for (const p of this.inScene) p.lookTarget = null;
    if (this.mode === 'walk' || this.mode === 'none') this.rig.follow();
    if (this.mode === 'car') this.rig.mode = 'car';
  }

  narrate(text) {
    return this.guard(this.ui.narrate(text));
  }

  // Character card. Prefers the dedicated card photo (e.g. ido_card) over the dialogue portrait.
  intro(id, opts = {}) {
    const portraits = this.g.assets.portraits;
    const image = opts.image || portraits[id + '_card'] || null;
    return this.guard(this.ui.intro(id, { ...opts, image }));
  }

  async card(i) {
    const c = CHAPTERS[i];
    await this.guard(this.ui.card(c.kicker, c.title, c.sub));
  }

  goal(text, pos = null, items = null) {
    this.ui.objective(text, items);
    this.ui.target(pos);
  }

  reach(pos, r = 2.5, who = null) {
    return this.until(() => d2((who || (this.mode === 'car' && this.car ? this.car : this.player)).pos, pos) < r);
  }

  use(pos, label, { r = 2.0, hold = 0 } = {}) {
    return this.guard(
      new Promise((res) => {
        const it = { pos: pos.clone(), r, label, hold, res, enabled: true };
        this.interacts.push(it);
      })
    );
  }

  async fade(to, ms = 600) {
    await this.guard(this.ui.fade(to, ms));
  }

  shot(pos, look, dur = 1.2) {
    return this.guard(this.rig.shot(pos, look, dur));
  }

  newCar(x, z, yaw, opts = {}) {
    const car = new Car(this.scene, { headlights: !!this.level.night, ...opts });
    car.place(x, z, yaw, this.world);
    return car;
  }

  board(car, seats) {
    for (const [id, seat] of Object.entries(seats)) {
      const p = this.ch(id);
      if (!p.group.parent) this.inScene.add(p);
      car.seat(p, seat);
      this.inScene.add(p);
    }
    this.car = car;
  }

  unboard(car, ids) {
    ids.forEach((id, i) => car.unseat(this.ch(id), this.scene, this.world, i % 2 ? -1 : 1));
  }

  follow(id, targetId, dist = 1.6, side = 1) {
    const p = this.ch(id);
    p.goal = null;
    p.follow = { target: this.ch(targetId), dist, offset: new THREE.Vector3(side * 0.9, 0, 0), trail: [] };
  }

  unfollow(...ids) {
    for (const id of ids) this.ch(id).follow = null;
  }

  // ---------- per-frame
  update(dt) {
    if (!this.level) return;
    const P = this.player;
    if (this.mode === 'walk') this.walk(dt);
    else if (this.mode === 'car' && this.car) {
      this.car.update(dt, this.input, this.world, true);
      this.sfx.engine(true, this.car.speed);
      if (this.car.bumped) {
        this.sfx.sting('door');
        this.car.bumped = 0;
      }
    } else if (this.inScene.has(P) && !P.goal && P.pose !== 'drive') {
      P.vel.x = damp(P.vel.x, 0, 10, dt);
      P.vel.z = damp(P.vel.z, 0, 10, dt);
      P.move(dt, this.world);
    }
    if (this.mode !== 'car') this.sfx.engine(false);
    for (const p of this.inScene) {
      // breadcrumbs for followers (see Person.ai)
      const f = p.follow;
      if (f && f.trail) {
        const last = f.trail[f.trail.length - 1];
        const L = f.target.pos;
        if (!last || Math.hypot(last.x - L.x, last.z - L.z) > 0.6) f.trail.push({ x: L.x, z: L.z });
        if (f.trail.length > 90) f.trail.shift();
      }
      if (p !== P || this.mode !== 'walk') {
        if (p !== P || P.goal) p.ai(dt, this.world);
      }
      p.animate(dt, this.g.camera);
    }
    for (const gd of this.guards) gd.update(dt, P);
    if (this.traps) this.traps.update(dt, P);
    this.level.update?.(dt, this.mode === 'car' && this.car ? this.car : P, this.g.camera, this);
    this.rig.update(dt, { target: P.group.visible && this.mode !== 'car' ? P : null, car: this.mode === 'car' ? this.car : null, input: this.input, world: this.world });
    this.updateInteract(dt);
  }

  walk(dt) {
    const P = this.player;
    const inp = this.input;
    const mag = Math.min(1, Math.hypot(inp.mx, inp.my));
    let tx = 0;
    let tz = 0;
    if (mag > 0.08 && !P.goal) {
      const yaw = this.rig.yaw;
      const dx = Math.sin(yaw) * inp.my - Math.cos(yaw) * inp.mx;
      const dz = Math.cos(yaw) * inp.my + Math.sin(yaw) * inp.mx;
      const l = Math.hypot(dx, dz) || 1;
      const run = mag > 0.92 && !this.sneakOnly;
      const sp = run ? 5.4 : 1.3 + mag * 1.9;
      tx = (dx / l) * sp;
      tz = (dz / l) * sp;
    }
    P.vel.x = damp(P.vel.x, tx, 11, dt);
    P.vel.z = damp(P.vel.z, tz, 11, dt);
    P.move(dt, this.world);
    // sneaking sections: crouch while creeping or holding still, stand up to run
    if (this.stealthPose && (P.pose === null || P.pose === 'crouch')) P.pose = P.speed < 3.6 ? 'crouch' : null;
    else if (!this.stealthPose && P.pose === 'crouch') P.pose = null;
    if (P.speed > 0.4) {
      this.stepAcc += P.speed * dt;
      const stride = P.speed > 4 ? 1.4 : 0.9;
      if (this.stepAcc > stride) {
        this.stepAcc = 0;
        this.sfx.step(this.surface, P.speed < 2);
      }
    }
  }

  updateInteract(dt) {
    if (this.mode !== 'walk') {
      this.ui.action(null);
      return;
    }
    const P = this.player;
    let best = null;
    let bd = Infinity;
    for (const it of this.interacts) {
      if (!it.enabled) continue;
      const d = d2(P.pos, it.pos);
      if (d < it.r && d < bd) {
        bd = d;
        best = it;
      }
    }
    if (!best) {
      this.ui.action(null);
      this.holdP = 0;
      return;
    }
    this.ui.action(best.label);
    if (best.hold > 0) {
      if (this.input.action) {
        this.holdP += dt / best.hold;
        if (Math.floor(this.holdP * 6) !== Math.floor((this.holdP - dt / best.hold) * 6)) this.sfx.sting('hold');
      } else this.holdP = Math.max(0, this.holdP - dt * 2);
      this.ui.hold(this.holdP);
      if (this.holdP >= 1) this.fire(best);
    } else if (this.input.actionPressed) this.fire(best);
  }

  fire(it) {
    this.holdP = 0;
    this.ui.hold(0);
    this.interacts = this.interacts.filter((x) => x !== it);
    P_ANIM(this.player);
    it.res();
  }
}

function P_ANIM(p) {
  p.pose = 'interact';
  setTimeout(() => {
    if (p.pose === 'interact') p.pose = null;
  }, 450);
}

// =====================================================================
// Chapters
// =====================================================================
const CH = [ch1, ch2, ch3, ch4, ch5, ch6, ch7];

// ---------- 1. the mall
async function ch1(S) {
  const L = S.loadLevel('mall');
  const pt = L.points;
  const P = S.add('yonati', pt.start.x, pt.start.z, 0);
  const ido = S.add('ido', pt.idoStart.x, pt.idoStart.z, 0);
  S.rig.snapBehind(P);
  S.ui.colors.yiftach = CAST.yiftach.color;
  S.control('none');
  await S.fade(0, 900);
  await S.card(0);
  await S.intro('ido');
  await S.talk([
    ['ido', 'יאללה יונתי, הסרט מתחיל עוד רבע שעה. בוא נזוז לקולנוע.'],
    ['yonati', 'יאללה אחי. רק שיהיה עוד פופקורן כשנגיע.'],
    ['ido', 'בשביל זה רצים, אחי.'],
  ]);
  S.follow('ido', 'yonati', 1.8, -1);
  S.control('walk');
  S.goal('לכו עם עידו לקולנוע', pt.cinema);
  // Yiftach steps out of the pizza place halfway down the gallery
  await S.until(() => P.pos.z > pt.meet.z - 9);
  S.control('none');
  S.unfollow('ido');
  const yif = S.add('yiftach', pt.pizza.x, pt.pizza.z, -Math.PI / 2);
  await S.shot(V(6.2, 1.8, pt.pizza.z - 4.5), V(pt.pizza.x, 1.5, pt.pizza.z), 1.1);
  yif.walkTo(pt.meet.x + 0.6, P.pos.z + 2.4, { speed: 1.4 });
  ido.walkTo(P.pos.x + 1.3, P.pos.z + 0.6);
  await S.wait(1.6);
  await S.intro('yiftach');
  await S.until(() => !yif.goal);
  yif.faceTo(ido.pos.x, ido.pos.z);
  await S.talk([
    ['ido', 'יפתחוס אחשלו! מה אתה עושה פה?'],
    ['yiftach', 'אחשלי, בדיוק מה שאתה עושה פה. אני הולך לראות סרט, ככה בפאנן…'],
    ['yonati', 'לבד? מה אתה, פסיכי?'],
    ['yiftach', 'מה לבד. עכשיו אני איתכם, לא?'],
    ['ido', 'יאללה, בוא איתנו. יש מקום ליד.'],
    ['yiftach', 'מושלם. ממש… מושלם.'],
  ]);
  S.follow('ido', 'yonati', 1.8, -1);
  S.follow('yiftach', 'yonati', 2.6, 1);
  S.control('walk');
  S.goal('לכו לקולנוע ביחד', pt.cinema);
  await S.use(pt.cinema, 'נכנסים לסרט', { r: 3 });
  S.control('none');
  S.ui.clearObjective();
  S.ui.target(null);
  await S.fade(1, 900);
  S.unfollow('ido', 'yiftach');
  P.place(pt.cinema.x + 1, 0, pt.cinema.z - 2.5, Math.PI);
  ido.place(pt.cinema.x - 0.6, 0, pt.cinema.z - 3.3, Math.PI * 0.85);
  yif.place(pt.cinema.x + 2.6, 0, pt.cinema.z - 3.6, -Math.PI * 0.8);
  S.rig.snapBehind(P);
  S.sfx.ambience(null);
  await S.guard(S.ui.card('', 'שעתיים אחר כך…', '', 2000));
  S.sfx.ambience('mall');
  await S.fade(0, 700);
  await S.talk([
    ['ido', 'איזה סרט, אחי. הסוף הזה… לא ציפיתי.'],
    ['yiftach', 'סרט טוב. סוף טוב. הכי טוב כשלא מצפים לכלום.'],
  ]);
  // Dolev's video call
  ido.pose = 'phone';
  await S.wait(0.5);
  await S.guard(S.ui.phoneIncoming('dolev', { video: S.g.assets.clips.dolev || null }));
  await S.guard(S.ui.phoneLine('dolev', 'עידו… שמע. אני לא יודע מי שומע אותי, אבל אתה חייב להיזהר.'));
  await S.guard(S.ui.phoneLine('dolev', 'יש סכנות שבאות אלייך, ואני בעצמי בסכנה עכשיו.'));
  await S.guard(S.ui.phoneLine('dolev', 'תיזהר מ…'));
  await S.guard(S.ui.phoneDrop(true));
  S.ui.phoneHide();
  ido.pose = 'scared';
  await S.talk([
    ['ido', 'דולב? דולב!! …ניתק.'],
    ['ido', 'יונתי, משהו לא בסדר עם דולב. הוא נשמע מפוחד. ממש מפוחד.'],
    ['yiftach', 'בטח סתם קליטה גרועה, ברודנה. בואו נזוז מפה.'],
    ['yonati', 'לא, משהו פה מוזר. ניסע לקציר באוטו שלי, נבדוק מה קורה עם דולב.'],
    ['yiftach', '…יאללה. קציר.'],
  ]);
  ido.pose = null;
  S.follow('ido', 'yonati', 1.8, -1);
  S.follow('yiftach', 'yonati', 2.6, 1);
  S.control('walk');
  S.goal('צאו לחניון, לאוטו של יונתי', pt.exit);
  await S.reach(pt.exit, 2.2);
  S.control('none');
  S.ui.clearObjective();
  S.ui.target(null);
  await S.fade(1, 800);
}

// ---------- 2. the road to Katzir
async function ch2(S) {
  const L = S.loadLevel('road');
  const pt = L.points;
  const car = S.newCar(pt.start.x, pt.start.z, pt.startYaw);
  S.board(car, { yonati: 'driver', ido: 'front', yiftach: 'rearL' });
  S.control('car');
  S.rig.yaw = pt.startYaw;
  S.ui.colors.yiftach = CAST.yiftach.color;
  await S.fade(0, 900);
  await S.card(1);
  S.goal('סעו לקציר. העליות מחכות', pt.gate);
  S.ui.toast(S.g.input && document.body.classList.contains('touch') ? 'ג׳ויסטיק למעלה: גז · למטה: ברקס · ימינה ושמאלה: הגה' : 'W / חץ למעלה: גז · S: ברקס · A / D: הגה');
  const chatter = [
    ['ido', 'אני מנסה להתקשר לדולב שוב… לא עונה.'],
    ['yiftach', 'תירגע, ברודנה. הוא בטח נרדם.'],
    ['ido', 'באמצע שיחה? באמצע משפט?'],
    ['yonati', 'עוד כמה עליות ואנחנו בקציר. נמצא אותו.'],
    ['yiftach', 'אין מה למצוא. הכל בסדר. באמת.'],
  ];
  let i = 0;
  let t = 3;
  while (d2(car.pos, pt.gate) > 14) {
    await S.wait(0.25);
    t -= 0.25;
    if (t <= 0 && i < chatter.length) {
      S.ui.subtitle(chatter[i][0], chatter[i][1], 4);
      i++;
      t = 6;
    }
    if (car.pos.y < L.minY) {
      S.ui.toast('ירדת מהכביש. חוזרים לכביש.');
      const r = L.nearestRoad(car.pos);
      car.place(r.x, r.z, r.yaw, S.world);
    }
  }
  S.control('none');
  S.ui.clearObjective();
  S.ui.target(null);
  S.sfx.engine(false);
  await S.shot(V(pt.gate.x + 6, pt.gate.y + 4, pt.gate.z - 10), V(pt.gate.x, pt.gate.y + 2, pt.gate.z + 4), 2.2);
  await S.wait(1.2);
  await S.fade(1, 800);
}

// ---------- 3. Katzir: Yahli, the hour that disappears, the walk up to the lookout
async function ch3(S) {
  const L = S.loadLevel('katzir', { time: 'dusk' });
  const pt = L.points;
  const car = S.newCar(pt.park.x, pt.park.z, pt.parkYaw);
  S.board(car, { yonati: 'driver', ido: 'front', yiftach: 'rearL' });
  S.car = car;
  S.ui.colors.yiftach = CAST.yiftach.color;
  S.control('none');
  S.rig.mode = 'car';
  await S.fade(0, 900);
  await S.card(2);
  S.unboard(car, ['yonati', 'ido', 'yiftach']);
  L.parked(car);
  const P = S.player;
  S.rig.snapBehind(P);
  const yahli = S.add('yahli', pt.yahli.x, pt.yahli.z, Math.PI);
  S.follow('ido', 'yonati', 1.8, -1);
  S.follow('yiftach', 'yonati', 2.6, 1);
  S.control('walk');
  S.goal('לכו לכיכר של קציר', pt.square);
  await S.reach(pt.square, 9);
  S.control('none');
  S.unfollow('ido', 'yiftach');
  S.ch('ido').walkTo(P.pos.x - 1.2, P.pos.z + 0.4);
  S.ch('yiftach').walkTo(P.pos.x + 1.4, P.pos.z - 0.6);
  yahli.faceTo(P.pos.x, P.pos.z);
  await S.say('yonati', 'יהלי! מה איתך אח יקר?', { to: 'yahli' });
  await S.intro('yahli', { video: S.g.assets.clips.yahli || null, ms: 2900 });
  yahli.walkTo(P.pos.x + Math.sin(P.yaw) * 2.2, P.pos.z + Math.cos(P.yaw) * 2.2, { run: true });
  await S.wait(0.6);
  await S.talk([
    ['yahli', 'אהההה דלביובים! מה איתכם אחים שלי?'],
    ['ido', 'יהלי, שמעת משהו מדולב היום? הוא התקשר אליי ונשמע ממש לחוץ.'],
    ['yahli', 'דולב? ראיתי אותו אתמול בקניון. מאז כלום. מוזר.'],
    ['yiftach', 'יואו יהלי, שומע אחי? אני צריך שתבוא לעזור לי במשהו רגע. אתה בא?'],
    ['yahli', 'יאללה בטח. מה צריך?'],
    ['yiftach', 'משהו קטן. נחזור עוד שנייה.'],
  ]);
  // they walk off into the dark
  yahli.lookTarget = null;
  const yif = S.ch('yiftach');
  yif.walkTo(pt.dark.x, pt.dark.z, { speed: 1.5 });
  yahli.walkTo(pt.dark.x + 1, pt.dark.z + 1, { speed: 1.5 });
  await S.shot(V(P.pos.x + 2, 2.2, P.pos.z - 3), V(pt.dark.x, 1.4, pt.dark.z), 1.6);
  await S.wait(3.2);
  await S.fade(1, 900);
  S.remove('yahli');
  yif.stop();
  // he comes back alone along the path to the lookout, a short walk away
  const yx = Math.max(pt.dark.x, P.pos.x - 14);
  const yz = Math.max(-2.4, Math.min(2.4, P.pos.z));
  yif.place(yx, S.world.ground(yx, yz), yz, Math.PI / 2);
  L.setTime('night');
  S.sfx.ambience('night');
  await S.guard(S.ui.card('', 'כעבור שעה…', '', 2200));
  S.ch('ido').place(P.pos.x - 1.2, S.world.ground(P.pos.x - 1.2, P.pos.z), P.pos.z + 0.4, P.yaw);
  S.rig.snapBehind(P);
  await S.fade(0, 900);
  await S.say('ido', 'נו… איפה הם לעזאזל?');
  yif.walkTo(P.pos.x + 1.6, P.pos.z + 1.2, { speed: 1.6 });
  await S.until(() => !yif.goal);
  await S.talk([
    ['yiftach', 'מה אומרים?'],
    ['yonati', 'אחי, איפה יהלי?'],
    ['yiftach', 'יהלי הלך בסוף לבית שלו. שנייה, הוא יבוא עוד שעתיים כזה.'],
  ]);
  await S.narrate('מה שהם לא יודעים: יפתח השתגע, וחטף את יהלי למחבוא שלו.');
  await S.talk([
    ['yiftach', 'יאללה, בואו נעלה למצפה דור. הנוף משם בלילה מטורף.'],
    ['ido', 'יאללה… אבל אחר כך הולכים לדולב.'],
  ]);
  S.follow('ido', 'yonati', 1.8, -1);
  S.follow('yiftach', 'yonati', 2.6, 1);
  S.control('walk');
  S.goal('עלו למצפה דור', pt.lookout);
  await S.reach(pt.lookout, 7);
  S.control('none');
  S.ui.clearObjective();
  S.ui.target(null);
  await S.fade(1, 800);
}

// ---------- 4. Mitzpe Dor: the shout, the follow, the kidnapping, the call
async function ch4(S) {
  const L = S.loadLevel('katzir', { time: 'night' });
  const pt = L.points;
  const P = S.add('yonati', pt.lookout.x + 1.5, pt.lookout.z + 1, pt.viewYaw);
  const ido = S.add('ido', pt.lookout.x - 0.5, pt.lookout.z + 1.4, pt.viewYaw);
  const yif = S.add('yiftach', pt.lookout.x + 3.4, pt.lookout.z + 2.2, pt.viewYaw + 0.4);
  const car = S.newCar(pt.park.x, pt.park.z, pt.parkYaw);
  L.parked(car);
  S.ui.colors.yiftach = CAST.yiftach.color;
  S.rig.snapBehind(P);
  S.control('none');
  await S.shot(V(pt.lookout.x + 4, 2.6, pt.lookout.z + 6), V(pt.lookout.x - 20, -10, pt.lookout.z - 30), 0.01);
  await S.fade(0, 1200);
  await S.card(3);
  await S.shot(V(pt.lookout.x + 2, 1.9, pt.lookout.z + 5), V(pt.lookout.x, 1.4, pt.lookout.z), 2.4);
  await S.talk([
    ['yonati', 'אחי, מה אתה חושב קרה לדולב?'],
    ['ido', 'שמע, אני לא יודע. זה די מדאיג אותי.'],
  ]);
  yif.pose = 'shout';
  S.sfx.sting('shout');
  S.ui.colors.yiftach = CAST.yiftach.villainColor;
  await S.say('yiftach', 'אולי די כבר לדבר על דולב?!?! הוא בסדר! ואני בטוח בזה!!!');
  yif.pose = null;
  S.sfx.ambience(null);
  await S.narrate('…');
  S.sfx.ambience('night');
  await S.say('ido', 'אחי… הכל טוב?', { to: 'yiftach' });
  yif.walkTo(pt.follow[0].x, pt.follow[0].z, { speed: 2.2 });
  await S.wait(1.4);
  yif.stop();
  yif.faceTo(ido.pos.x, ido.pos.z);
  await S.say('yiftach', 'עידו. שנייה בוא, אני צריך לדבר איתך.', { to: 'ido' });
  await S.say('ido', '…טוב.', { to: 'yiftach' });
  S.endTalk();
  await S.say('yonati', 'משהו פה לא מסתדר לי. אני הולך אחריהם. בשקט.', { cam: false });
  S.endTalk();

  // ---- follow without being seen
  const guard = new Guard(S, yif, { range: 16, fov: 0.55, cone: true, color: 0xfff1c9, flashlight: true });
  for (;;) {
    const ok = await followMission(S, L, guard);
    if (ok) break;
    await S.fade(1, 500);
    S.sfx.suspense(0);
    P.place(pt.lookout.x + 1.5, S.world.ground(pt.lookout.x + 1.5, pt.lookout.z + 1), pt.lookout.z + 1, pt.viewYaw);
    S.rig.snapBehind(P);
    await S.fade(0, 500);
  }
  S.guards = [];
  guard.dispose();

  // ---- the kidnapping
  S.control('none');
  S.ui.clearObjective();
  S.ui.target(null);
  const door = pt.bunkerDoor;
  yif.stop();
  ido.stop();
  ido.follow = null;
  yif.faceTo(ido.pos.x, ido.pos.z);
  await S.shot(V(door.x + 6, door.y + 2.2, door.z + 7), V(door.x, door.y + 1.2, door.z), 1.4);
  await S.say('ido', 'יפתח? מה זה המקום הזה? מה אתה…', { to: 'yiftach', cam: false });
  yif.pose = 'grab';
  S.sfx.sting('grab');
  await S.wait(0.4);
  ido.pose = 'dragged';
  await S.say('ido', 'יפתח!!! עזוב אותי! יונתי!!!', { cam: false });
  yif.walkTo(door.x, door.z, { speed: 1.4 });
  ido.walkTo(door.x + 0.6, door.z + 0.6, { speed: 1.4 });
  await S.wait(2.4);
  L.openDoor(true);
  S.sfx.sting('door');
  await S.wait(1.4);
  S.remove('ido');
  S.remove('yiftach');
  L.openDoor(false);
  S.sfx.sting('slam');
  await S.wait(0.4);
  S.sfx.sting('lock');
  await S.wait(1.2);
  S.endTalk();
  await S.say('yonati', 'לא… לא לא לא. הוא חטף את עידו!');
  await S.say('yonati', 'אני חייב עזרה. אברהם!');
  S.endTalk();
  // ---- calling Avraham
  P.pose = 'phone';
  await S.guard(S.ui.phoneDial('avraham'));
  await S.guard(S.ui.phoneLine('yonati', 'אברהם אחשלי, אני חייב אותך דחוף! יפתח השתגע וחטף את עידו.'));
  await S.guard(S.ui.phoneLine('yonati', 'ואני חושב שגם את דולב. וגם יהלי לא עונה מלא זמן!'));
  await S.guard(S.ui.phoneLine('avraham', 'אחי, תניע את הרכב ותבוא לאסוף אותי. הולכים לעצור את זה.'));
  await S.guard(S.ui.phoneDrop(false));
  S.ui.phoneHide();
  P.pose = null;
  // ---- back to the car, pick up Avraham
  S.control('walk');
  S.goal('חזרו לאוטו', pt.park);
  await S.use(V(car.pos.x + Math.cos(car.yaw) * 1.6, 0, car.pos.z - Math.sin(car.yaw) * 1.6), 'נכנסים לאוטו', { r: 3.2 });
  L.unparked(car);
  S.board(car, { yonati: 'driver' });
  S.control('car');
  S.goal('אספו את אברהם מהבית שלו', pt.avraham);
  const av = S.add('avraham', pt.avraham.x, pt.avraham.z, pt.avrahamYaw);
  await S.reach(pt.avraham, 9);
  S.control('none');
  S.car.speed = 0;
  S.ui.target(null);
  await S.intro('avraham');
  av.walkTo(car.pos.x - Math.cos(car.yaw) * 1.8, car.pos.z + Math.sin(car.yaw) * 1.8, { speed: 2.6 });
  await S.until(() => !av.goal);
  S.board(car, { avraham: 'front' });
  await S.say('avraham', 'יאללה, סע למצפה. ומהר. אני מכיר את יפתח, הוא לא סתם השתגע.', { cam: false });
  S.endTalk();
  S.control('car');
  S.goal('סעו לחניה של מצפה דור', pt.lookoutPark);
  await S.reach(pt.lookoutPark, 8);
  S.control('none');
  S.car.speed = 0;
  S.ui.clearObjective();
  S.ui.target(null);
  await S.fade(1, 800);
}

async function followMission(S, L, guard) {
  const pt = L.points;
  const P = S.player;
  const yif = S.ch('yiftach');
  const ido = S.ch('ido');
  yif.place(pt.follow[0].x, S.world.ground(pt.follow[0].x, pt.follow[0].z), pt.follow[0].z, 0);
  ido.place(pt.follow[0].x + 1, S.world.ground(pt.follow[0].x + 1, pt.follow[0].z - 1), pt.follow[0].z - 1, 0);
  S.follow('ido', 'yiftach', 1.4, 1);
  S.sneakOnly = false;
  S.stealthPose = true;
  S.control('walk');
  S.goal('עקבו אחרי יפתח ועידו בלי שיראו אתכם', null, ['שמרו מרחק, אבל אל תאבדו אותם', 'כשיפתח מסתובב: התחבאו מאחורי עץ או שיח, או התרחקו מהאור']);
  S.ui.track(yif);
  S.guards = [guard];
  guard.reset();
  guard.active = false;
  let fail = null;
  const watch = () => {
    const d = d2(P.pos, yif.pos);
    if (guard.spotted) fail = 'יפתח ראה אותך!';
    else if (d > 46) fail = 'איבדת אותם בחושך. נסו שוב.';
    else if (d < 3.5) fail = 'התקרבת יותר מדי. יפתח שמע אותך.';
    return !!fail;
  };
  for (let i = 1; i < pt.follow.length; i++) {
    const wp = pt.follow[i];
    yif.walkTo(wp.x, wp.z, { speed: 1.35 });
    let walking = true;
    S.until(() => !yif.goal).then(() => (walking = false), () => {});
    await S.until(() => !walking || watch());
    if (fail) break;
    if (wp.look) {
      // he stops, the "!" warning, then turns back with his phone light on
      guard.warn(1.6);
      S.ui.toast('יפתח עומד להסתובב! התחבאו!');
      await S.wait(1.6);
      yif.faceTo(P.pos.x, P.pos.z);
      guard.active = true;
      const until = S.g.clock.t + 2.6;
      await S.until(() => S.g.clock.t > until || watch());
      guard.active = false;
      if (fail) break;
    }
  }
  S.unfollow('ido');
  S.stealthPose = false;
  P.pose = null;
  if (fail) {
    S.control('none');
    yif.stop();
    ido.stop();
    S.sfx.sting('caught');
    S.ui.toast(fail, 2.4);
    await S.wait(1.8);
    return false;
  }
  return true;
}

// ---------- 5. keys
async function ch5(S) {
  const L = S.loadLevel('katzir', { time: 'night' });
  const pt = L.points;
  const P = S.add('yonati', pt.lookoutPark.x + 2, pt.lookoutPark.z + 2, pt.parkYaw);
  const av = S.add('avraham', pt.lookoutPark.x + 3.5, pt.lookoutPark.z + 1, pt.parkYaw);
  const car = S.newCar(pt.lookoutPark.x - 2.5, pt.lookoutPark.z - 1.5, pt.parkYaw);
  L.parked(car);
  S.ui.colors.yiftach = CAST.yiftach.villainColor;
  S.rig.snapBehind(P);
  S.control('none');
  await S.fade(0, 900);
  await S.card(4);
  await S.talk([
    ['avraham', 'איפה הוא נכנס עם עידו?'],
    ['yonati', 'בסלעים מתחת למצפה. יש שם דלת ברזל. הוא נעל אותה מבפנים.'],
    ['avraham', 'אני מכיר את יפתח. הוא תמיד משאיר מפתחות באוטו שלו. האוטו השחור, שם.'],
  ]);
  S.follow('avraham', 'yonati', 2.0, 1);
  S.control('walk');
  const items = ['מפתח אדום: באוטו של יפתח', 'מפתח כחול: במחסן ליד מגדל המים', 'לפתוח את דלת הברזל במצוק'];
  S.goal('מצאו את המפתחות לדלת הברזל', pt.yiftachCar, items);
  await S.use(pt.yiftachCarDoor, 'לחפש באוטו', { r: 2.6 });
  S.sfx.sting('key');
  S.ui.check(0);
  S.ui.toast('מצאתם: מפתח אדום. ועליו פתק: "מחסן — מגדל המים".', 3.4);
  await S.talk([
    ['avraham', 'מגדל המים! יש שם מחסן ישן. יאללה.'],
  ]);
  S.ui.target(pt.shedDoor);
  S.ui.objective('פתחו את המחסן ליד מגדל המים', items);
  S.ui.check(0);
  await S.use(pt.shedDoor, 'לפתוח במפתח האדום', { r: 2.4 });
  L.openShed();
  S.sfx.sting('door');
  await S.wait(0.6);
  S.ui.target(pt.shedKey);
  await S.use(pt.shedKey, 'לקחת', { r: 1.8 });
  L.takeShedKey();
  S.sfx.sting('key');
  S.ui.check(1);
  S.ui.toast('מצאתם: מפתח כחול.', 2.6);
  await S.talk([
    ['avraham', 'זה המפתח של דלת הברזל. אני בטוח.'],
    ['yonati', 'ויש פה עוד משהו… תמונות של כולנו. עם עיגולים אדומים.'],
    ['avraham', 'הוא באמת השתגע. יאללה, לפני שיהיה מאוחר.'],
  ]);
  S.ui.target(pt.bunkerDoor);
  await S.use(pt.bunkerDoor, 'לפתוח במפתח הכחול', { r: 2.6 });
  S.ui.check(2);
  L.openDoor(true);
  S.sfx.sting('door');
  await S.talk([
    ['avraham', 'אני נשאר פה בחוץ לשמור. אם הוא מנסה לברוח, הוא נתקל בי.'],
    ['avraham', 'לך תציל אותם, יונתי. בשקט.'],
    ['yonati', 'סומך עליך, אחי.'],
  ]);
  S.control('none');
  S.ui.clearObjective();
  S.ui.target(null);
  P.walkTo(pt.bunkerDoor.x, pt.bunkerDoor.z, { speed: 1.4 });
  await S.wait(1.4);
  await S.fade(1, 800);
}

// ---------- 6. the hideout
async function ch6(S) {
  const L = S.loadLevel('bunker');
  const pt = L.points;
  const P = S.add('yonati', pt.start.x, pt.start.z, 0);
  const yif = S.add('yiftach', pt.patrol[0].x, pt.patrol[0].z, 0);
  yif.setOutfit({ ...CAST.yiftach.outfit, coat: true });
  yif.passTag = 'doorB';
  const yahli = S.add('yahli', pt.yahli.x, pt.yahli.z, pt.yahliYaw);
  const dolev = S.add('dolev', pt.dolev.x, pt.dolev.z, pt.dolevYaw);
  const ido = S.add('ido', pt.ido.x, pt.ido.z, pt.idoYaw);
  yahli.pose = dolev.pose = ido.pose = 'tied';
  L.chairs([yahli, dolev, ido]);
  S.ui.colors.yiftach = CAST.yiftach.villainColor;
  S.rig.pitch = 0.95;
  S.control('none');
  const guard = new Guard(S, yif, { route: pt.patrol, range: 7.5, fov: 0.62, cone: true, speed: 1.55, color: 0xfff1c9, flashlight: true });
  S.traps = new Traps(S, L);
  // establishing shots, so the player knows where everyone is before sneaking in
  await S.shot(V(-14.6, 1.75, 1.2), V(-14.4, 1.0, 4.6), 0.01);
  await S.fade(0, 900);
  await S.card(5);
  await S.shot(V(-10.6, 1.7, 1.6), V(-8.6, 1.05, 5.6), 2.4);
  await S.intro('dolev', { ms: 2400 });
  await S.say('dolev', '(בלחש) מישהו… מישהו שומע אותי?', { cam: false });
  await S.shot(V(9.8, 1.8, 8.0), V(6.6, 1.0, 8.6), 0.01);
  await S.narrate('עידו בחדר השני. לייזרים ולוחות לחץ בכל מקום.');
  await S.shot(V(0.5, 2.4, -6.5), V(0, 1.2, -2), 0.01);
  S.guards = [guard];
  await S.narrate('ויפתח מסתובב בין החדרים עם פנס. אם הוא מאיר עליך, נגמר.');
  S.endTalk();
  S.rig.snapBehind(P);
  let freed = { yahli: false, dolev: false, ido: false };
  let hasGold = false;
  const items = ['לשחרר את יהלי', 'לשחרר את דולב', 'לקחת את מפתח הזהב מהשולחן', 'לפתוח את החדר של עידו ולשחרר אותו', 'לברוח החוצה עם עידו'];
  S.goal('שחררו את החברים בלי שיפתח יראה אתכם', null, items);
  S.stealthPose = true;
  S.control('walk');
  const caught = async (why) => {
    S.control('none');
    S.sfx.sting('caught');
    S.ui.toast(why, 2.2);
    await S.wait(1.4);
    await S.fade(1, 400);
    const cp = hasGold && L.inRoomB(P.pos) ? pt.checkpointB : pt.start;
    P.place(cp.x, 0, cp.z, cp.yaw ?? 0);
    guard.reset();
    S.traps.reset();
    S.rig.snapBehind(P);
    await S.fade(0, 400);
    S.control('walk');
  };
  // interactions run in parallel; stealth failures reset position but keep progress
  const freeOne = async (who, i, line) => {
    await S.use(S.ch(who).pos, 'לשחרר (להחזיק)', { r: 1.7, hold: 1.4 });
    S.sfx.sting('free');
    freed[who] = true;
    S.ui.check(i);
    const p = S.ch(who);
    p.pose = null;
    // a subtitle, not a dialogue box: the stealth keeps running and nothing waits for a tap
    S.ui.subtitle(who, line, 4.5);
    await S.wait(2.4);
    p.walkTo(pt.exit.x, pt.exit.z, { speed: 2.4 });
    S.until(() => !p.goal).then(() => S.remove(who), () => {});
  };
  freeOne('yahli', 0, 'אחי… דלביובים… תודה. יפתח השתגע לגמרי. אני בורח לאברהם.').catch(() => {});
  freeOne('dolev', 1, 'יונתי! זה מה שניסיתי להגיד לעידו: תיזהר מיפתח! תוציא אותו!').catch(() => {});
  S.use(pt.goldKey, 'לקחת את מפתח הזהב', { r: 1.8 }).then(() => {
    hasGold = true;
    L.takeGoldKey();
    S.sfx.sting('key');
    S.ui.check(2);
    S.ui.target(pt.doorB);
  }, () => {});
  const doorB = (async () => {
    await S.until(() => hasGold);
    await S.use(pt.doorB, 'לפתוח במפתח הזהב', { r: 2.2 });
    L.openDoorB();
    S.sfx.sting('door');
    S.ui.toast('זהירות: לייזרים ולוחות לחץ. אל תיגעו ואל תדרכו.', 3.4);
    S.traps.active = true;
    S.ui.target(pt.ido);
  })();
  doorB.catch(() => {});
  // stealth loop until Ido is free
  let idoFree = false;
  S.until(() => hasGold && L.doorBOpen).then(async () => {
    try {
      await S.use(pt.ido, 'לשחרר את עידו (להחזיק)', { r: 1.7, hold: 1.6 });
      idoFree = true;
    } catch {
      /* chapter left */
    }
  }, () => {});
  while (!idoFree) {
    await S.until(() => idoFree || guard.spotted || S.traps.tripped);
    if (idoFree) break;
    const why = guard.spotted ? 'יפתח תפס אותך עם הפנס!' : 'נגעת במלכודת! יפתח שמע את האזעקה.';
    await caught(why);
  }
  // ---- Ido is free: escape with Yiftach on your heels
  S.sfx.sting('free');
  S.ui.check(3);
  S.traps.active = false;
  S.traps.hide();
  ido.pose = null;
  S.stealthPose = false;
  P.pose = null;
  S.control('none');
  guard.active = false;
  guard.mode = 'scripted';
  yif.driven = false;
  yif.place(-30, 0, 0, 0); // out of the way while the scene plays
  await S.talk([
    ['ido', 'יונתי!!! ידעתי שתבוא, אחי!'],
    ['yonati', 'אין זמן, ברודנה. רצים!'],
  ]);
  // the back-room door bangs open and Yiftach steps out, between you and nothing: run east
  const bd = L.backDoor;
  L.openBackDoor();
  S.sfx.sting('slam');
  yif.place(bd.x, 0, bd.z, Math.PI / 2);
  yif.pose = 'shout';
  L.alarm(true);
  S.sfx.sting('alarm');
  await S.shot(V(bd.x + 3.4, 2.3, bd.z - 2.6), V(bd.x, 1.4, bd.z), 0.5);
  await S.say('yiftach', 'אתם לא הולכים לשום מקום!!!', { cam: false });
  yif.pose = null;
  S.endTalk();
  S.rig.snapBehind(P);
  S.follow('ido', 'yonati', 1.5, -1);
  S.control('walk');
  S.goal('ברחו החוצה עם עידו!', pt.exit, items);
  for (let k = 0; k < 4; k++) S.ui.check(k);
  S.ui.toast('רוצו! יפתח מאחוריכם!', 2.2);
  await S.wait(1.0); // a head start
  guard.chase(P, 4.3);
  for (;;) {
    await S.until(() => d2(P.pos, pt.exit) < 2.2 || guard.spotted);
    if (!guard.spotted) break;
    S.control('none');
    S.sfx.sting('caught');
    S.ui.toast('יפתח תפס אותך! עוד ניסיון, מהר!', 2);
    await S.wait(1);
    await S.fade(1, 300);
    P.place(pt.escape.x, 0, pt.escape.z, Math.PI);
    ido.place(pt.escape.x + 1, 0, pt.escape.z + 1, Math.PI);
    guard.reset();
    guard.chase(P, 4.0, pt.chaseStart);
    S.rig.snapBehind(P);
    await S.fade(0, 300);
    S.control('walk');
  }
  S.ui.check(4);
  S.control('none');
  S.guards = [];
  S.sfx.suspense(0);
  await S.fade(1, 500);
}

// ---------- 7. dawn
async function ch7(S) {
  const L = S.loadLevel('katzir', { time: 'dawn' });
  const pt = L.points;
  const P = S.add('yonati', pt.bunkerDoor.x + 3, pt.bunkerDoor.z + 4, Math.PI * 0.2);
  const ido = S.add('ido', pt.bunkerDoor.x + 4.5, pt.bunkerDoor.z + 4.8, -Math.PI * 0.6);
  const av = S.add('avraham', pt.bunkerDoor.x + 1.2, pt.bunkerDoor.z + 1.8, Math.PI);
  const dolev = S.add('dolev', pt.bunkerDoor.x + 2.2, pt.bunkerDoor.z + 6.4, Math.PI);
  const yahli = S.add('yahli', pt.bunkerDoor.x + 4.6, pt.bunkerDoor.z + 6.8, Math.PI * 1.2);
  S.ui.colors.yiftach = CAST.yiftach.villainColor;
  S.rig.snapBehind(P);
  S.control('none');
  L.openDoor(false);
  L.police(true);
  S.sfx.sting('slam');
  await S.shot(V(pt.bunkerDoor.x + 9, pt.bunkerDoor.y + 3, pt.bunkerDoor.z + 12), V(pt.bunkerDoor.x + 2, pt.bunkerDoor.y + 1.2, pt.bunkerDoor.z + 3), 0.01);
  await S.fade(0, 1400);
  await S.card(6);
  await S.talk([
    ['avraham', 'טרקתי לו את הדלת ונעלתי במפתח הכחול. הוא לא יוצא משם.'],
    ['avraham', 'המשטרה כבר בדרך. רואים את האורות למטה.'],
    ['dolev', 'זה מה שרציתי להגיד בטלפון: תיזהר מיפתח. קצת מאוחר, אה?'],
    ['yahli', 'אהההה דלביובים… איזה לילה.'],
    ['ido', 'יונתי. אחי. הצלת אותי.'],
    ['yonati', 'בשביל זה יש אחים, ברודנה.'],
  ]);
  S.sfx.sting('door');
  await S.say('yiftach', '(מאחורי הדלת) אחשלי… רק רציתי לראות סרט, ככה בפאנן…', { cam: false });
  await S.say('avraham', 'יאללה. מגיע לנו שווארמה.', { cam: false });
  S.endTalk();
  for (const p of [P, ido, av, dolev, yahli]) p.pose = 'celebrate';
  S.sfx.sting('success');
  await S.shot(V(pt.bunkerDoor.x + 3.4, pt.bunkerDoor.y + 1.6, pt.bunkerDoor.z + 12), V(pt.bunkerDoor.x + 3, pt.bunkerDoor.y + 1.3, pt.bunkerDoor.z + 4.5), 2.6);
  await S.wait(3.5);
  await S.fade(1, 1200);
  S.g.showCredits();
  await S.fade(0, 800);
}
