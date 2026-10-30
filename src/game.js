// The game itself: who is where (on foot or driving), which camera looks, what the context button does,
// fist fights and the punching bags, the friends in the world, the story missions, money and saving,
// and one step of the world per frame.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { angleDiff } from './core/math.js';
import { makeNehorai } from './player/character.js';
import { PlayerController } from './player/controller.js';
import { FollowCamera } from './camera/followCamera.js';
import { CarCamera } from './camera/carCamera.js';
import { Vehicle } from './vehicle/vehicle.js';
import { makeHatchback, repaint } from './world/car.js';
import { applyUpgrades } from './vehicle/upgrades.js';
import { Garage } from './ui/garage.js';
import { punchBag } from './world/gym.js';
import { Npc } from './friends/npc.js';
import { Fighter, fightEvents } from './combat/fighter.js';
import { Traffic } from './vehicle/traffic.js';
import { Pedestrians } from './friends/pedestrians.js';
import { ROSTER } from './characters/roster.js';
import { RIVALS, SHARKS, COUSIN } from './characters/extras.js';
import { Dialogue, VOICES } from './ui/dialogue.js';
import { Minimap } from './ui/minimap.js';
import { Missions } from './missions/missions.js';
import pickup, { gymCrowd } from './missions/m1-pickup.js';
import gymMission from './missions/m2-gym.js';
import haderaMission from './missions/m3-hadera.js';
import crewMission from './missions/m4-crew.js';
import dolevMission from './missions/m5-dolev.js';
import heistMission from './missions/m6-heist.js';
import homeMission from './missions/m7-home.js';
import morningMission from './missions/m8-morning.js';
import boxerMission from './missions/m9-boxer.js';
import kioskMission from './missions/m10-kiosk.js';
import glovesMission from './missions/m11-gloves.js';
import { ACTIVITIES } from './missions/activities.js';
import { makeSpeaker } from './world/props.js';
import { Phone } from './ui/phone.js';
import { Companion } from './friends/companion.js';
import { chat } from './friends/chats.js';
import { Alert } from './alert/alert.js';
import { saveProgress, newProgress } from './save/progress.js';

const PARKED = { throttle: 0, brake: 0, steer: 0, handbrake: false };
const STILL = { move: { x: 0, y: 0 }, run: false, lookDX: 0, lookDY: 0, block: false, ...PARKED };
// how much of the stick gets through while punching, covering up, staggered or down
const STANCE_MOVE = { attack: 0.35, block: 0.45, hit: 0, down: 0, dodge: 0 };
const screen = new THREE.Vector3();
const near2 = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) < r;

export class Game {
  constructor({ scene, camera, world, hud, controls, progress = newProgress() }) {
    Object.assign(this, { scene, camera, world, hud, controls, progress });
    this.time = 0;
    this.mode = 'foot';
    this.hold = false;       // frozen behind a menu (mission failed)
    this.cutscene = false;   // a scripted moment: no walking or driving
    this.target = null;      // where the current objective is, for the arrow and the minimap
    this.nehorai = makeNehorai();
    scene.add(this.nehorai.root);
    this.player = new PlayerController(world, this.nehorai);
    const player = this.player, nehorai = this.nehorai;
    // Nehorai's fists: the same rules as everyone else's
    this.fighter = new Fighter({ pos: player.pos, get yaw() { return player.yaw; }, set yaw(v) { player.yaw = v; player.sync(); }, model: nehorai }, { name: 'נהוראי' });
    this.fighter.onHurt = () => { hud.hurt(); this.follow.shake(0.14); };
    this.fighter.onDefend = (r) => hud.pop(r === 'blocked' ? 'חסום' : 'התחמקת', r === 'blocked' ? 'block' : 'dodge');
    this.fight = null;       // the fight going on, if any (see combat/fight.js)
    this.combat = false;     // fist-fight buttons showing: next to a punching bag or in a fight
    this.dash = null;        // the quick step of a dodge
    this.punchQueued = 0;    // a punch tapped a moment early, thrown as soon as the last one ends
    this.bagHits = 0;
    this.bagUppercuts = 0;  // uppercuts that landed on a bag (Hadar's lesson counts them)
    this.bags = (world.places.gymBags || []).map((bag) => this.bagTarget(bag));
    this.botInput = null;    // tests only: a function that adjusts the input each frame
    this.traffic = null;     // cars on the road to Hadera and in the city (see setPopulation)
    this.pedestrians = null; // passers-by in Hadera
    this.phone = new Phone(this);
    this.companion = new Companion(this, 'dolev');
    this.hadarBuddy = new Companion(this, 'hadar'); // chapter two
    this.chaseCars = [];     // other cars a mission drives (traffic gives way to them)
    this.alert = new Alert(this);
    this.garage = new Garage(this);
    this.sound = null;       // set by main.js once there is sound
    this.ringing = 0;
    fightEvents.onHit = (res) => { if (res !== 'dodged') this.sound?.hit(res === 'blocked' ? 'block' : 'punch', res === 'counter' ? 1.3 : 1); };
    this.chase = null;       // rival cars after the Renault (see vehicle/chaser.js)
    this.follow = new FollowCamera(camera, world);
    this.carCam = new CarCamera(camera, world);

    // the white Renault, parked in the driveway
    const spot = world.places.carSpot;
    this.car = new Vehicle(world, makeHatchback({ color: progress.car.color }), { name: 'renault' });
    scene.add(this.car.model);
    this.car.place(spot.x, spot.z, spot.yaw);
    this.car.health = progress.car.health ?? 100;
    this.car.onCrash = (v) => this.sound?.hit('crash', Math.min(1, v / 12));
    this.vehicles = [this.car];
    this.applyCar();
    this.exitPending = false;

    this.npcs = new Map();
    this.dialogue = new Dialogue(document.getElementById('caption'));
    this.minimap = new Minimap(document.getElementById('minimap'), world);
    this.missions = new Missions(this);
    this.missions.register(pickup);
    this.missions.register(gymMission);
    this.missions.register(haderaMission);
    this.missions.register(crewMission);
    this.missions.register(dolevMission);
    this.missions.register(heistMission);
    this.missions.register(homeMission);
    for (const m of [morningMission, boxerMission, kioskMission, glovesMission]) this.missions.register(m);
    for (const a of ACTIVITIES) this.missions.registerSide(a);
    // Erez's punches land on the middle bag
    this.npc('erez').onPunch = (power) => { const b = world.places.gymBags[1]; if (b) punchBag(b, Math.sin(this.npc('erez').yaw), Math.cos(this.npc('erez').yaw), power); };

    this.autopilot = null;  // when set, drives the player's car (tests, scripted moments)
    this.activities = [];   // { update(dt, game), interaction?(game) → { label, priority, run } }
    this.prompt = null;
    controls.onInteract = () => this.prompt?.run();
    controls.onExit = () => this.requestExit();
    controls.onPunch = () => this.punch();
    controls.onDodge = () => this.dodge();
    hud.setMoney(progress.money);
  }

  get driving() { return this.mode === 'car' ? this.car : null; }
  // where Nehorai is, whether walking or driving
  get pos() { return this.mode === 'car' ? this.car.pos : this.player.pos; }

  start(x, z, yaw) {
    this.player.place(x, z, yaw);
    this.follow.snapBehind(yaw);
  }

  // a friend (or anyone in the cast roster), created the first time they are needed
  npc(id) {
    if (!this.npcs.has(id)) {
      const n = new Npc(this, ROSTER[id] || RIVALS[id] || SHARKS[id] || (id === COUSIN.id ? COUSIN : null));
      n.show(false);
      this.npcs.set(id, n);
    }
    return this.npcs.get(id);
  }

  addMoney(amount) {
    this.progress.money = Math.max(0, this.progress.money + amount);
    this.hud.setMoney(this.progress.money);
  }

  has(unlock) { return this.progress.unlocks.includes(unlock); }

  // how many cars and passers-by the world has: set by the graphics quality
  setPopulation({ traffic = 0, people = 0 }) {
    this.traffic?.dispose();
    this.traffic = new Traffic(this, traffic);
    this.pedestrians?.dispose();
    this.pedestrians = new Pedestrians(this, people);
  }

  // the friends hang out at the gym once Nehorai has met them there (when no mission says otherwise)
  populate({ walk = false } = {}) {
    this.applyCar(); // a reward may have tuned the engine
    // the gym's speaker back on its stand once it has been won back
    if (this.has('speaker') && !this.gymSpeaker) {
      const g = this.world.places.gym, p = g.toWorld(9.8, -4.6);
      this.gymSpeaker = makeSpeaker();
      this.gymSpeaker.position.set(p.x, g.floorY + 0.72, p.z);
      this.gymSpeaker.rotation.y = g.yaw;
      this.scene.add(this.gymSpeaker);
    }
    if (!this.has('friends') || this.missions.active) return;
    // after the court the Porcupines are back at their kiosk, on speaking terms
    if (this.has('speaker')) {
      const K = this.world.places.kiosk;
      ['kotzi', 'shpitz', 'roller', 'tosti'].forEach((id, i) => {
        const n = this.npc(id), seat = K.seats[[0, 1, 3, 4][i]];
        if (n.visible && Math.hypot(n.pos.x - this.pos.x, n.pos.z - this.pos.z) < 120) return; // not in front of Nehorai
        n.place(seat.x, seat.z, seat.yaw);
        n.idle = null;
        n.model.setPose('sit');
        n.show(true);
      });
    }
    gymCrowd(this, { walk });
    if (this.has('hadar') && !this.hadarBuddy.active) {
      const h = this.npc('hadar');
      if (!h.inCar && !(h.visible && Math.hypot(h.pos.x - this.pos.x, h.pos.z - this.pos.z) < 60)) {
        const G = this.has('chapter-2') ? this.world.places.gymBags[2] : this.world.places.hadarGate;
        h.place(G.x + (this.has('chapter-2') ? 1.2 : 0), G.z, G.yaw ?? 0);
        h.idle = this.has('chapter-2') ? 'bag' : 'phone';
        h.show(true);
      }
    }
    const av = this.npc('avraham'), S = this.world.places.gymSpots, p = S.avraham;
    if (av.inCar) return;
    if (walk && av.visible && Math.hypot(av.pos.x - p.x, av.pos.z - p.z) < 20) av.walkTo(p.x, p.z, { onArrive: () => { av.yaw = p.yaw; av.idle = 'phone'; } });
    else { av.place(p.x, p.z, p.yaw); av.idle = 'phone'; }
    av.show(true);
  }

  // ---------- the Renault's upgrades and paint ----------
  ownedUpgrades() {
    const list = [...(this.progress.car.upgrades || [])];
    if (this.has('engine') && !list.includes('engine')) list.push('engine'); // Nissim's thank-you
    return list;
  }

  applyCar() { applyUpgrades(this.car, this.ownedUpgrades()); }

  paintCar(hex) {
    repaint(this.car.model, hex);
    this.progress.car.color = hex;
  }

  // the garage forecourt: drive in (or stand there with the car) and the garage opens
  garageOffer() {
    const G = this.world.places.garage;
    if (!G || !this.has('hadera-parking') || this.fight || this.chase || this.cutscene) return null;
    const there = near2(this.car.pos, G.bay, G.bay.r) && Math.abs(this.car.speed) < 0.8;
    if (!there || (this.mode === 'foot' && !near2(this.player.pos, G.bay, 6))) return null;
    return { label: 'להיכנס למוסך', priority: 3, run: () => this.garage.open() };
  }

  // ---------- the phone ----------
  // the friend a mission is waiting for a call to, if any
  wantedCall() {
    const M = this.missions, m = M.active;
    if (m) return M.step?.call || null;
    const n = M.next();
    return n?.startByCall && (n.requires || []).every((r) => M.done(r)) ? n.startByCall : null;
  }

  contactNote(id) {
    if (this.wantedCall() === id) return 'מחכה לשיחה';
    if (id === 'dolev' && this.companion.active) return 'איתך';
    if (id === 'hadar' && this.hadarBuddy.active) return 'איתך';
    return '';
  }

  call(id) {
    const M = this.missions, m = M.active, step = M.step;
    if (m && step?.call === id) { step.onCall?.(m, this); return; }
    if (!m && this.wantedCall() === id) { M.start(M.next().id); return; }
    if (id === 'dolev' && this.has('dolev-crew')) {
      if (this.companion.active) this.dialogue.play([['דולב', 'אחי, אני ממש מאחוריך. תסתובב.', 'phone']]);
      else { this.dialogue.play([['דולב', 'אני בא. תן לי דקה.', 'phone']]); this.companion.join(); }
      return;
    }
    if (id === 'hadar' && this.has('hadar-crew')) {
      if (this.hadarBuddy.active) this.dialogue.play([['הדר', 'Bro, אני לידך. תסתכל ימינה.', 'phone']]);
      else { this.dialogue.play([['הדר', 'בדרך, אחי. רץ אליך, זה גם אימון.', 'phone']]); this.hadarBuddy.join(); }
      return;
    }
    this.dialogue.play(chat(id));
  }

  // a quick trip (pause menu): Nehorai and the Renault to the safe parking in Hadera
  travelTo(where) {
    if (where !== 'hadera' || !this.has('hadera-parking') || this.missions.active) return false;
    const p = this.world.places.safeParking;
    this.exitCar();
    this.car.place(p.x, p.z, p.yaw);
    const q = this.car.local(1.8, 0.3);
    this.player.place(q.x, q.z, p.yaw);
    this.follow.snapBehind(p.yaw);
    this.hud.toast('הגעתם לחנייה בשדרות הים');
    return true;
  }

  save() {
    this.progress.car.health = Math.round(this.car.health);
    return saveProgress(this.progress);
  }

  // ---------- getting in and out ----------
  enterCar(car = this.car) {
    if (this.mode === 'car') return;
    this.mode = 'car';
    this.exitPending = false;
    car.occupants.add('nehorai');
    this.nehorai.root.visible = false;
    this.player.body.enabled = false;
    this.controls.mode = 'car';
    this.controls.setRun(false);
    this.carCam.snap(car);
    this.hud.setMode('car');
  }

  // getting out at speed: brake to a stop first, then step out
  requestExit() {
    if (this.mode !== 'car' || this.cutscene) return;
    if (Math.abs(this.car.speed) < 2) this.exitCar();
    else this.exitPending = true;
  }

  exitCar() {
    if (this.mode !== 'car') return;
    const car = this.car, spot = car.exitSpot();
    car.occupants.delete('nehorai');
    this.mode = 'foot';
    this.exitPending = false;
    this.player.place(spot.x, spot.z, spot.yaw);
    if (spot.onRoof) this.player.pos.y = this.player.visualY = car.pos.y + 1.5;
    this.nehorai.root.visible = true;
    this.player.body.enabled = true;
    this.controls.mode = 'foot';
    this.follow.snapBehind(spot.yaw);
    this.hud.setMode('foot');
  }

  // ---------- fists ----------
  // a punching bag as something to hit: it swings and counts, nothing else
  bagTarget(bag) {
    return {
      bag, pos: { x: bag.x, z: bag.z }, down: false, counter: 0,
      takeHit: (from, damage) => {
        const dx = bag.x - from.pos.x, dz = bag.z - from.pos.z, d = Math.hypot(dx, dz) || 1;
        punchBag(bag, dx / d, dz / d, damage / 10);
        if (from === this.fighter) { this.bagHits++; if (from.lastMove === 'uppercut') this.bagUppercuts++; }
        this.sound?.hit('bag', damage / 12);
        return 'hit';
      },
    };
  }

  nearBag(r = 2.6) {
    const p = this.player.pos;
    return this.bags.some((b) => Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < r);
  }

  // what Nehorai's punches can land on: opponents in the fight and the bags. Nobody else, ever.
  get targets() {
    const out = this.fight && !this.fight.over ? [...this.fight.enemies] : [];
    if (this.nearBag(3)) out.push(...this.bags);
    return out;
  }

  // the nearest opponent still standing, for facing and the camera
  foe(range = 6) {
    if (!this.fight || this.fight.over) return null;
    const p = this.player.pos;
    let best = null, bd = range;
    for (const o of this.fight.opponents) {
      if (o.fighter.down) continue;
      const d = Math.hypot(o.npc.pos.x - p.x, o.npc.pos.z - p.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // jab, cross; once the combination is learned the third punch in a row is a hook, and once Hadar
  // has shown it (chapter two) the fourth is an uppercut
  punch() {
    if (!this.combat || this.cutscene || this.mode !== 'foot') return;
    const f = this.fighter;
    if (!f.canAct()) { if (f.state === 'attack' && f.timer < 0.2) this.punchQueued = 0.3; return; }
    const targets = this.targets, chain = this.has('uppercut') ? ['jab', 'cross', 'hook', 'uppercut'] : this.has('combo') ? ['jab', 'cross', 'hook'] : ['jab', 'cross'];
    f.faceNearest(targets, 3.2);
    const name = chain[f.combo % chain.length];
    const ok = f.punch(name, targets, {
      onLand: (t, res, open) => {
        if (!t) return;
        if (!t.bag) this.follow.shake(0.06);
        if (open && (res === 'hit' || res === 'down')) this.hud.pop('מכת נגד!', 'counter');
        else if (name === 'hook' && !t.bag) this.hud.pop('הוק!', 'hit');
        else if (name === 'uppercut' && !t.bag) this.hud.pop('אפרקאט!', 'hit');
      },
    });
    if (ok) { f.combo++; f.comboTimer = 0.95; }
  }

  // a quick step: along the stick if it is pushed, otherwise straight back
  dodge() {
    if (!this.combat || this.cutscene || this.mode !== 'foot') return;
    const f = this.fighter;
    if (!f.dodge()) return;
    const m = this.controls.move, cy = this.follow.yaw;
    let dx = -Math.sin(this.player.yaw), dz = -Math.cos(this.player.yaw);
    if (Math.hypot(m.x, m.y) > 0.3) { dx = -Math.sin(cy) * m.y + Math.cos(cy) * m.x; dz = -Math.cos(cy) * m.y - Math.sin(cy) * m.x; }
    const l = Math.hypot(dx, dz) || 1;
    this.dash = { x: dx / l, z: dz / l, t: 0.24 };
  }

  // show the fist-fight buttons only where they do something
  updateCombat(dt) {
    const f = this.fighter;
    const fighting = !!this.fight && !this.fight.over;
    const on = this.mode === 'foot' && !this.cutscene && !this.follow.override && (fighting || this.nearBag(this.combat ? 3.4 : 2.6));
    if (on !== this.combat) {
      this.combat = on;
      this.hud.setCombat(on);
      if (on) { this.controls.setRun(false); if (!f.down) this.nehorai.setPose('guard'); }
      else { f.setBlock(false); if (!f.down) this.nehorai.setPose(null); this.punchQueued = 0; }
    }
    // out of a fight, a breather brings the health back
    if (!fighting && !f.down && f.lastHurt > 3 && f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + 12 * dt);
  }

  // ---------- the context button: the most important thing nearby ----------
  interactions() {
    if (this.cutscene) return this.missions.interaction();
    const out = [];
    if (this.mode === 'foot' && !this.follow.override) {
      const p = this.player.pos;
      if (this.car.doorDistance(p.x, p.z) < 1.9 && Math.abs(this.car.pos.y - p.y) < 1.2) {
        out.push({ label: 'להיכנס לרכב', priority: 1, run: () => this.enterCar() });
      }
    }
    const mi = this.missions.interaction();
    if (mi) out.push(mi);
    const gar = this.garageOffer();
    if (gar) out.push(gar);
    for (const a of this.activities) {
      const it = a.interaction?.(this);
      if (it) out.push(it);
    }
    return out.sort((a, b) => b.priority - a.priority)[0] || null;
  }

  update(dt) {
    this.time += dt;
    let input = this.cutscene ? (this.controls.sample(), STILL) : this.controls.sample();
    if (this.botInput) input = this.botInput(input, dt) || input;
    const f = this.fighter;
    f.update(dt);
    this.updateCombat(dt);
    if (this.mode === 'foot') {
      this.follow.look(input.lookDX, input.lookDY);
      let move = input.move, face = null;
      if (this.combat) {
        const k = STANCE_MOVE[f.state] ?? 1;
        if (k !== 1) move = { x: move.x * k, y: move.y * k };
        f.setBlock(input.block);
        if (this.punchQueued > 0 && (this.punchQueued -= dt) > 0 && f.canAct()) { this.punchQueued = 0; this.punch(); }
        const foe = this.foe(), seen = foe || this.foe(14);
        if (foe && f.state !== 'down') face = Math.atan2(foe.npc.pos.x - this.player.pos.x, foe.npc.pos.z - this.player.pos.z);
        this.follow.lockOn = seen ? seen.npc.pos : null; // keep whoever is coming in view
      } else this.follow.lockOn = null;
      if (this.dash) {
        const step = Math.min(dt, this.dash.t) * 6.2;
        this.player.push(this.dash.x * step, this.dash.z * step);
        if ((this.dash.t -= dt) <= 0) this.dash = null;
      }
      if (f.knock) { this.player.push(f.knock.x, f.knock.z); f.knock = null; }
      this.player.update(dt, move, input.run && !this.combat, this.follow.yaw, face);
      this.nehorai.animate(dt, this.player.speed, CONFIG.player.runSpeed);
      this.hud.setVitals(f.hpFrac, f.staminaFrac, f.tired > 0);
    } else {
      this.carCam.look(input.lookDX, input.lookDY);
      const drive = this.exitPending || this.cutscene ? { ...PARKED, brake: 1 } : this.autopilot ? this.autopilot.drive(this.car) : input;
      this.car.update(dt, drive);
      if (this.exitPending && Math.abs(this.car.speed) < 1.5) this.exitCar();
      this.player.pos.x = this.car.pos.x; this.player.pos.z = this.car.pos.z; this.player.pos.y = this.car.pos.y;
    }
    for (const v of this.vehicles) if (v !== this.driving && (Math.abs(v.speed) > 0.05 || v.vy)) v.update(dt, PARKED);
    for (const n of this.npcs.values()) if (n.visible || n.inCar) n.update(dt);
    this.traffic?.update(dt);
    this.pedestrians?.update(dt);
    this.companion.update(dt);
    this.hadarBuddy.update(dt);
    this.chase?.update(dt);
    this.alert.update(dt);
    this.fight?.update(dt);
    this.missions.update(dt);
    for (const a of this.activities) a.update?.(dt, this);
    this.dialogue.update(dt);

    this.prompt = this.interactions();
    this.hud.setInteract(this.prompt?.label ?? null);
    this.hud.setCinematic(this.cutscene);
    this.phone.refresh();
    this.updateSound(dt, input);
    if (this.mode === 'foot') this.follow.update(dt, this.player);
    else {
      this.carCam.update(dt, this.car);
      this.hud.setCar(this.car);
    }
    this.updateGuide(dt);
    this.updateEnemyBars();
    const R = this.world.places.room, cam = this.camera.position;
    if (R) R.group.visible = R.inside(this.player.pos.x, this.player.pos.z) || R.inside(cam.x, cam.z);
  }

  updateSound(dt, input) {
    const s = this.sound;
    if (!s) return;
    const C = this.world.places.hadera?.CITY, p = this.pos;
    s.update({
      driving: this.mode === 'car', speed: this.car.speed, slip: this.car.slip,
      throttle: this.autopilot ? 0.5 : input.throttle || 0,
      city: !!C && p.x > C.x0 - 40 && p.x < C.x1 + 40 && p.z > C.z0 - 40 && p.z < C.z1 + 40,
    });
    // the phone rings while a call waits to be answered
    const calling = !document.getElementById('callCard').hidden;
    if (calling && (this.ringing -= dt) <= 0) { s.ring(); this.ringing = 2.2; }
    if (!calling) this.ringing = 0;
  }

  // names and health over the heads of opponents in a fight (not over a coach running a drill)
  updateEnemyBars() {
    const list = [];
    if (this.fight && !this.fight.over) {
      for (const o of this.fight.opponents) {
        if (o.fighter.down || o.drill) continue;
        screen.set(o.npc.pos.x, o.npc.pos.y + 2.15, o.npc.pos.z).project(this.camera);
        if (screen.z > 1 || Math.abs(screen.x) > 1.05 || Math.abs(screen.y) > 1.05) continue;
        list.push({ x: (screen.x + 1) / 2 * innerWidth, y: (1 - screen.y) / 2 * innerHeight, name: o.name, frac: o.fighter.hpFrac, open: o.fighter.counter > 0 });
      }
    }
    if (list.length || this.hadBars) this.hud.setEnemyBars(list);
    this.hadBars = list.length > 0;
  }

  // the arrow and distance under the objective, and the minimap
  updateGuide(dt) {
    const p = this.pos, cam = this.camera.position, t = this.target;
    const dir = { x: p.x - cam.x, z: p.z - cam.z }, l = Math.hypot(dir.x, dir.z) || 1;
    dir.x /= l; dir.z /= l;
    if (t) {
      const bearing = angleDiff(Math.atan2(dir.x, dir.z), Math.atan2(t.x - p.x, t.z - p.z));
      this.hud.setDistance(Math.hypot(t.x - p.x, t.z - p.z), -bearing);
    } else this.hud.setDistance(null);
    this.minimap.target = t;
    const others = [];
    for (const n of this.npcs.values()) {
      if (!n.visible || n.inCar) continue;
      const color = n.spec.crew ? '#e2574c' : VOICES[n.spec.name.split(' ')[0]];
      if (color) others.push({ x: n.pos.x, z: n.pos.z, color });
    }
    // places to go: side activities that are open (green) and the garage once Hadera is open
    if (!this.missions.active) {
      for (const d of this.missions.sides) if (d.available(this)) { const q = d.startAt(this); if (q) others.push({ x: q.x, z: q.z, color: '#7bd88f' }); }
      const G = this.world.places.garage;
      if (G && this.has('hadera-parking')) others.push({ x: G.bay.x, z: G.bay.z, color: '#9fb4c7' });
    }
    this.minimap.draw(dt, p, dir, { car: this.mode === 'car' ? null : this.car.pos, range: this.mode === 'car' ? 190 : 110, others });
  }
}
