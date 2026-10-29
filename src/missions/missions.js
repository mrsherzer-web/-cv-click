// Story missions: ordered steps, each with an objective line and an optional target that gets the
// marker, the arrow and the minimap dot. A blue marker shows where the next mission starts. Failure
// offers a retry from the last checkpoint; completion pays the reward once; finished missions can be
// played again from the pause menu.
import { Marker } from '../ui/marker.js';

export const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) < r;

export class Missions {
  constructor(game) {
    this.game = game;
    this.defs = [];            // in story order
    this.active = null;
    this.marker = new Marker(game.scene);
    this.startMarker = new Marker(game.scene, '#6cb6ff');
    this.freeRoamText = 'שיטוט חופשי';
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

  // the objective line between missions
  nextText() {
    const n = this.next();
    if (!n) return this.freeRoamText;
    const who = { dolev: 'לדולב' }[n.startByCall];
    return `המשימה הבאה: ${n.title}${who ? ` · להתקשר ${who} מהטלפון` : ''}`;
  }

  start(id, { replay = false } = {}) {
    const def = this.find(id);
    if (!def) return false;
    this.stop();
    const m = { def, stepIndex: 0, s: {}, t: 0, replay, checkpoint: 0 };
    this.active = m;
    this.startMarker.hide();
    for (const mk of this.sideMarkers.values()) mk.hide();
    def.setup?.(m, this.game);
    this.game.hud.banner(def.side ? 'פעילות' : `משימה ${def.number}`, def.title, '', 2600);
    this.enterStep(0);
    return true;
  }

  enterStep(i) {
    const m = this.active, step = m.def.steps[i];
    m.stepIndex = i;
    m.t = 0;
    if (step.checkpoint) m.checkpoint = i;
    this.game.hud.setObjective(step.objective);
    step.enter?.(m, this.game);
  }

  get step() { return this.active ? this.active.def.steps[this.active.stepIndex] : null; }

  update(dt) {
    const game = this.game;
    this.marker.update(dt);
    this.startMarker.update(dt);
    const m = this.active;
    if (!m) {
      const n = this.next();
      const p = n?.startAt?.(game);
      if (p && (!n.requires || n.requires.every((r) => this.done(r)))) {
        this.startMarker.set(p.x, p.y, p.z, 1.4);
        game.target = p;
        if (game.mode === 'foot' && near(game.player.pos, p, 1.6)) { this.start(n.id); return; }
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
    const reason = m.def.failIf?.(m, game);
    if (reason) { this.fail(reason); return; }
    const step = this.step, r = step.update?.(m, game, dt);
    const tgt = step.target?.(m, game) || null;
    if (tgt) this.marker.set(tgt.x, tgt.y ?? game.world.groundHeight(tgt.x, tgt.z), tgt.z, tgt.r ?? 1.7);
    else this.marker.hide();
    game.target = tgt;
    if (r === 'next') {
      step.exit?.(m, game);
      if (m.stepIndex + 1 < m.def.steps.length) this.enterStep(m.stepIndex + 1);
      else this.complete();
    } else if (typeof r === 'string' && r.startsWith('fail:')) this.fail(r.slice(5));
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
    game.sound?.chime(true);
    this.active = null;
    def.cleanup?.(m, game);
    game.populate?.({ walk: true });
    game.hud.setObjective(this.nextText());
    game.save();
    game.onMissionsChanged?.();
  }

  fail(reason) {
    const m = this.active, game = this.game;
    game.sound?.chime(false);
    game.hold = true;
    game.controls.reset();
    game.hud.showFail(m.def.side ? m.def.title : `משימה ${m.def.number} · ${m.def.title}`, reason, {
      onRetry: () => {
        game.hold = false;
        m.def.restore?.(m, game, m.checkpoint);
        this.enterStep(m.checkpoint);
      },
      onQuit: () => {
        game.hold = false;
        this.stop();
        game.hud.setObjective(this.nextText());
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

  rows() { return this.defs.map((d) => ({ id: d.id, title: `${d.number}. ${d.title}`, done: this.done(d.id) })); }
}
