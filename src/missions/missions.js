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
  }

  register(def) { this.defs.push(def); }
  get progress() { return this.game.progress; }
  done(id) { return this.progress.done.includes(id); }

  // the first story mission not done yet
  next() { return this.defs.find((d) => !this.done(d.id)) || null; }

  start(id, { replay = false } = {}) {
    const def = this.defs.find((d) => d.id === id);
    if (!def) return false;
    this.stop();
    const m = { def, stepIndex: 0, s: {}, t: 0, replay, checkpoint: 0 };
    this.active = m;
    this.startMarker.hide();
    def.setup?.(m, this.game);
    this.game.hud.banner(`משימה ${def.number}`, def.title, '', 2600);
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
        if (game.mode === 'foot' && near(game.player.pos, p, 1.6)) this.start(n.id);
      } else {
        this.startMarker.hide();
        game.target = null;
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
    if (!this.done(def.id)) {
      this.progress.done.push(def.id);
      if (def.reward?.money) game.addMoney(def.reward.money);
      for (const u of def.reward?.unlocks || []) if (!this.progress.unlocks.includes(u)) this.progress.unlocks.push(u);
      sub = def.reward?.text || '';
    } else sub = 'המשימה שוחקה שוב';
    game.hud.banner('המשימה הושלמה', def.title, sub, 4600);
    this.active = null;
    def.cleanup?.(m, game);
    game.populate?.({ walk: true });
    const n = this.next();
    game.hud.setObjective(n ? `המשימה הבאה: ${n.title}` : this.freeRoamText);
    game.save();
    game.onMissionsChanged?.();
  }

  fail(reason) {
    const m = this.active, game = this.game;
    game.hold = true;
    game.controls.reset();
    game.hud.showFail(`משימה ${m.def.number} · ${m.def.title}`, reason, {
      onRetry: () => {
        game.hold = false;
        m.def.restore?.(m, game, m.checkpoint);
        this.enterStep(m.checkpoint);
      },
      onQuit: () => {
        game.hold = false;
        this.stop();
        const n = this.next();
        game.hud.setObjective(n ? `המשימה הבאה: ${n.title}` : this.freeRoamText);
      },
    });
  }

  // leave the active mission (quitting, or starting another)
  stop() {
    const m = this.active;
    if (!m) return;
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
