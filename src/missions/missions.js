// Story missions: ordered steps, each with an objective line and an optional target that gets the
// marker, the arrow and the minimap dot. The objective panel is headed by the mission's number and
// name; between missions it names the next one and where it begins. A mission begins at a blue marker,
// at the Renault (getting in also starts it), with a call the player makes from the phone, or with a
// call that comes in by itself once things are quiet. Failure offers a retry from the last checkpoint;
// completion pays the reward once; finished missions can be played again from the pause menu.
import { Marker } from '../ui/marker.js';

export const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) < r;

// a step's objective line when it changes with the situation (the page is touched only on a change)
export function say(m, game, text) {
  if (m.said === text) return;
  m.said = text;
  game.hud.setObjective(text);
}

const CALL_AFTER = 5;      // seconds of quiet before a mission's call comes in
const CALL_AGAIN = 30;     // ...and after the player turned that mission down

export class Missions {
  constructor(game) {
    this.game = game;
    this.defs = [];            // in story order
    this.active = null;
    this.marker = new Marker(game.scene);
    this.startMarker = new Marker(game.scene, '#6cb6ff');
    this.freeRoamText = 'שיטוט חופשי · הפעילויות בתשלום מסומנות בירוק במפה';
    this.sides = [];           // side activities: repeatable, paid every time, green markers
    this.sideMarkers = new Map();
  }

  register(def) { this.defs.push(def); }
  registerSide(def) { this.sides.push({ ...def, side: true }); this.sideMarkers.set(def.id, new Marker(this.game.scene, '#7bd88f')); }
  find(id) { return this.defs.find((d) => d.id === id) || this.sides.find((d) => d.id === id); }
  get progress() { return this.game.progress; }
  done(id) { return this.progress.done.includes(id); }

  // the first story mission not done yet
  next() { return this.defs.find((d) => !this.done(d.id)) || null; }
  ready(def) { return (def.requires || []).every((r) => this.done(r)); }

  // the objective panel between missions: the next one and where it begins, or free roam
  nextText() {
    const n = this.next();
    return n ? `${n.title} · ${n.where}` : this.freeRoamText;
  }

  showNext() {
    const n = this.next(), last = this.defs.filter((d) => this.done(d.id)).pop();
    const label = n ? (n.chapter > (last?.chapter || 1) ? `פרק ${n.chapter} · המשימה הבאה` : 'המשימה הבאה') : `הפרק ${['', 'הראשון', 'השני', 'השלישי'][last?.chapter || 1]} הושלם`;
    this.game.hud.setObjective(this.nextText(), label);
  }

  // the panel's heading while a mission runs: its number in its chapter
  heading(def) {
    const ch = def.chapter || 1, of = this.defs.filter((d) => (d.chapter || 1) === ch).length;
    return `${ch > 1 ? `פרק ${ch} · ` : ''}משימה ${def.number} מתוך ${of} · ${def.title}`;
  }

  // nothing else going on: no menu, scene, conversation, fight or chase, and not at the garage's door
  quiet() {
    const g = this.game;
    return !g.hold && !g.cutscene && !g.dialogue.busy && !(g.fight && !g.fight.over) && !g.chase && !g.garage?.isOpen && !g.garageOffer?.();
  }

  start(id, { replay = false } = {}) {
    const def = this.find(id);
    if (!def) return false;
    this.stop();
    const m = { def, stepIndex: 0, s: {}, t: 0, replay, checkpoint: 0 };
    this.active = m;
    this.startMarker.hide();
    for (const mk of this.sideMarkers.values()) mk.hide();
    this.quietFor = 0;
    if (!def.side && this.game.car.disabled) this.game.car.repair(); // a story mission never begins with a wreck
    def.setup?.(m, this.game);
    this.game.hud.banner(def.side ? 'פעילות' : `${(def.chapter || 1) > 1 ? `פרק ${def.chapter} · ` : ''}משימה ${def.number}`, def.title, '', 2600);
    this.label = def.side ? `פעילות · ${def.title}` : this.heading(def);
    this.enterStep(0);
    return true;
  }

  enterStep(i) {
    const m = this.active, step = m.def.steps[i];
    m.stepIndex = i;
    m.t = 0;
    if (step.checkpoint) m.checkpoint = i;
    m.said = step.objective;
    this.game.hud.setObjective(step.objective, this.label);
    step.enter?.(m, this.game);
  }

  get step() { return this.active ? this.active.def.steps[this.active.stepIndex] : null; }

  update(dt) {
    const game = this.game;
    this.marker.update(dt);
    this.startMarker.update(dt);
    const m = this.active;
    if (!m) {
      const n = this.next(), open = n && this.ready(n);
      const p = open ? n.startAt?.(game) : null;
      // just left from the fail screen: it waits until the player is on foot and off its marker
      if (this.declined && this.declined === n?.id && game.mode === 'foot' && (!p || !near(game.player.pos, p, 3))) this.declined = null;
      const waits = !!this.declined && this.declined === n?.id;
      // a mission that begins at the Renault also begins by getting into it
      if (open && !waits && n.startInCar && game.mode === 'car') { this.start(n.id); return; }
      // one that begins with a call: it rings after a few quiet seconds
      if (open && n.incoming) {
        this.quietFor = this.quiet() ? (this.quietFor || 0) + dt : 0;
        if (this.quietFor > (this.callAgain ? CALL_AGAIN : CALL_AFTER)) { this.callAgain = false; this.start(n.id); return; }
      }
      if (p) {
        this.startMarker.set(p.x, p.y, p.z, 1.4);
        game.target = p;
        if (!waits && game.mode === 'foot' && near(game.player.pos, p, 1.6)) { this.start(n.id); return; }
      } else {
        this.startMarker.hide();
        game.target = null;
      }
      // side activities that are open: a green marker each, stepping on it starts it
      for (const d of this.sides) {
        const mk = this.sideMarkers.get(d.id);
        mk.update(dt);
        const q = d.available(game) ? d.startAt(game) : null;
        if (!q) { mk.hide(); continue; }
        mk.set(q.x, q.y ?? game.world.groundHeight(q.x, q.z), q.z, 1.1);
        // just finished here: it starts again only after stepping off and back on
        if (this.resting === d.id) { if (!near(game.player.pos, q, 3)) this.resting = null; continue; }
        if (game.mode === 'foot' && near(game.player.pos, q, 1.3)) { this.start(d.id); return; }
      }
      return;
    }
    m.t += dt;
    m.def.tick?.(m, game, dt);
    const reason = m.def.failIf?.(m, game);
    if (reason) { this.fail(reason); return; }
    const step = this.step, r = step.update?.(m, game, dt);
    if (r === 'next') {
      step.exit?.(m, game);
      if (m.stepIndex + 1 >= m.def.steps.length) { this.complete(); return; }
      this.enterStep(m.stepIndex + 1);
    } else if (typeof r === 'string' && r.startsWith('fail:')) { this.fail(r.slice(5)); return; }
    // the marker, the arrow and the minimap dot show the step running now, from its first frame
    const tgt = this.step.target?.(m, game) || null;
    if (tgt) this.marker.set(tgt.x, tgt.y ?? game.world.groundHeight(tgt.x, tgt.z), tgt.z, tgt.r ?? 1.7);
    else this.marker.hide();
    game.target = tgt;
  }

  interaction() {
    const m = this.active;
    return m ? this.step.interaction?.(m, this.game) || null : null;
  }

  complete() {
    const m = this.active, def = m.def, game = this.game;
    this.marker.hide();
    game.target = null;
    def.complete?.(m, game);
    let sub = '';
    if (def.side) { // paid every time
      if (def.reward?.money) game.addMoney(def.reward.money);
      sub = m.s.result || (def.reward?.money ? `+${def.reward.money} ₪` : '');
    } else if (!this.done(def.id)) {
      this.progress.done.push(def.id);
      if (def.reward?.money) game.addMoney(def.reward.money);
      for (const u of def.reward?.unlocks || []) if (!this.progress.unlocks.includes(u)) this.progress.unlocks.push(u);
      sub = def.reward?.text || '';
    } else sub = 'המשימה שוחקה שוב';
    game.hud.banner(def.side ? 'הצלחה' : 'המשימה הושלמה', def.title, sub, 4600);
    if (def.side) this.resting = def.id;
    else { // a story scene can end right on an activity's marker: that one waits until Nehorai steps off it
      const under = this.sides.find((d) => d.available(game) && near(game.player.pos, d.startAt(game), 2));
      if (under) this.resting = under.id;
    }
    game.sound?.chime(true);
    this.active = null;
    def.cleanup?.(m, game);
    game.populate?.({ walk: true });
    this.showNext();
    game.save();
    game.onMissionsChanged?.();
    const n = this.next();
    if (!def.side && n?.follows && this.ready(n)) this.start(n.id); // a mission that carries straight on
  }

  fail(reason) {
    const m = this.active, game = this.game;
    game.sound?.chime(false);
    game.hold = true;
    game.controls.reset();
    game.hud.showFail(m.def.side ? m.def.title : `${(m.def.chapter || 1) > 1 ? `פרק ${m.def.chapter} · ` : ''}משימה ${m.def.number} · ${m.def.title}`, reason, {
      onRetry: () => {
        game.hold = false;
        m.def.restore?.(m, game, m.checkpoint);
        this.enterStep(m.checkpoint);
      },
      onQuit: () => {
        game.hold = false;
        if (m.def.incoming) this.callAgain = true; // not now: the call comes back a little later
        else if (!m.def.side) this.declined = m.def.id;
        this.stop();
        this.showNext();
      },
    });
  }

  // leave the active mission (quitting, or starting another)
  stop() {
    const m = this.active;
    if (!m) return;
    if (m.def.side) this.resting = m.def.id;
    m.def.cleanup?.(m, this.game);
    this.game.dialogue.stop();
    this.marker.hide();
    this.game.target = null;
    this.active = null;
  }

  // play a finished mission again from its start
  replay(id) {
    const def = this.defs.find((d) => d.id === id);
    if (!def || !this.done(id)) return false;
    def.prepareReplay?.(this.game);
    return this.start(id, { replay: true });
  }

  // every story mission for the pause menu: done (and can be played again), running now (with what to
  // do), next (with where it begins), or not open yet
  rows() {
    const next = this.next(), now = this.active?.def;
    return this.defs.map((d) => {
      const row = { id: d.id, title: `${(d.chapter || 1) > 1 ? `פרק ${d.chapter} · ` : ''}${d.number}. ${d.title}`, done: this.done(d.id) };
      if (now === d) { row.state = 'now'; row.note = `עכשיו: ${this.game.hud.objectiveText}`; }
      else if (row.done) row.state = 'done';
      else if (d === next) { row.state = 'next'; row.note = `הבאה · ${d.where}`; }
      else { row.state = 'locked'; row.note = d.number > 1 ? `נפתחת אחרי משימה ${d.number - 1}` : `נפתחת אחרי הפרק ${['', 'הראשון', 'השני'][d.chapter - 1]}`; }
      return row;
    });
  }
}
