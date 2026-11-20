// A chase with a build-up, for the missions that end in one. Getting into the Renault is not the
// moment the rivals appear: there are a few seconds of grace while they are still working out which
// way you went (a pill counts them down; driving off fast shortens them), a warning line, and then
// the cars arrive one at a time, each announced. Friends in the car call out what they see — the
// rivals closing in, a hit, one of them gone — and losing them all ends it with the time it took and
// a bonus for a clean escape. Everything on screen is the game's own; the rivals are the crews
// invented for it, never police.
import { Chase } from '../vehicle/chaser.js';

export class Pursuit {
  constructor(game, { grace = 6, cars = 2, gap = 14, colors = null, lines = {}, bonus = 150, radio = true } = {}) {
    this.game = game;
    this.grace = grace; this.cars = cars; this.gap = gap; this.colors = colors;
    this.lines = lines;              // { start, arrive: [perCar...], close, hit, lost }
    this.bonus = bonus;
    this.t = 0;                      // seconds in the current phase
    this.phase = 'grace';            // 'grace' | 'on' | 'done'
    this.chase = null;
    this.joined = 0;
    this.time = 0;                   // seconds since the first car arrived
    this.health0 = game.car.health;
    this.closeAt = -10; this.hitAt = -10; this.lastHealth = game.car.health;
    this.start = { x: game.car.pos.x, z: game.car.pos.z };
    this.radioWasOff = false;
    this.said = { start: false, lost: false };
    if (lines.start && !this.said.start) { this.said.start = true; game.dialogue.play(lines.start); }
    game.hud.setPursuit(`הם מחפשים אתכם · ${Math.ceil(grace)}`);
    // the radio comes on for the ride, if it was off
    if (radio && game.radio && !game.radio.on && game.mode === 'car') { this.radioWasOff = true; game.radio.play(0); game.radio.refresh(true); }
  }

  get over() { return this.phase === 'done'; }
  get escaped() { return this.phase === 'done' && !!this.chase?.escaped; }
  get active() { return this.phase === 'on' && this.chase && !this.chase.over; }

  update(dt) {
    const g = this.game;
    if (this.phase === 'done') return;
    this.t += dt;
    if (this.phase === 'grace') {
      const gone = Math.hypot(g.car.pos.x - this.start.x, g.car.pos.z - this.start.z);
      const left = Math.max(0, this.grace - this.t - (gone > 80 ? 2 : 0));
      g.hud.setPursuit(`הם מחפשים אתכם · ${Math.ceil(left)}`);
      if (left <= 0 && g.mode === 'car') this.begin();
      return;
    }
    // on
    this.time += dt;
    const c = this.chase; // ticked by the game itself (game.chase), once a frame
    if (this.joined < this.cars && this.time > this.joined * this.gap) this.join();
    const near = c.nearest, cars = c.chasers.filter((ch) => !ch.out).length;
    g.hud.setPursuit(c.over ? null : `מרדף · ${cars === 1 ? 'רכב אחד' : `${cars} רכבים`} · ${near === Infinity ? '—' : `${Math.round(near)} מ׳`}`);
    // a friend calls it when they are right behind, and when the Renault takes a hit
    if (near < 22 && this.time - this.closeAt > 12 && this.lines.close) { this.closeAt = this.time; g.dialogue.play([this.lines.close[Math.floor(Math.random() * this.lines.close.length)]]); }
    if (g.car.health < this.lastHealth - 6 && this.time - this.hitAt > 8 && this.lines.hit) { this.hitAt = this.time; g.dialogue.play([this.lines.hit[Math.floor(Math.random() * this.lines.hit.length)]]); }
    this.lastHealth = g.car.health;
    if (c.over) this.finish();
  }

  begin() {
    const g = this.game;
    this.phase = 'on';
    this.chase = new Chase(g, { cars: 1, after: 20, colors: this.colors || undefined });
    g.chase = this.chase;
    this.joined = 1;
    g.hud.banner('מרדף', '', 'לאבד אותם · הם לא מכירים את הדרך כמוך', 2200);
    g.sound?.hit?.('crash', 0.35);
    const l = this.lines.arrive?.[0]; if (l) g.dialogue.play(l);
  }

  join() {
    const k = this.joined++;
    const col = this.colors ? this.colors[k % this.colors.length] : undefined;
    this.chase.add(col);
    const l = this.lines.arrive?.[k]; if (l) this.game.dialogue.play(l);
  }

  finish() {
    const g = this.game;
    this.phase = 'done';
    const secs = Math.round(this.time), clean = g.car.health >= this.health0 - 12;
    const mm = Math.floor(secs / 60), ss = String(secs % 60).padStart(2, '0');
    if (this.chase?.escaped) {
      if (clean && this.bonus) { g.addMoney(this.bonus); g.hud.toast(`איבדתם אותם ב-${mm}:${ss} · בלי שריטה: +${this.bonus} ₪`, 3200); }
      else g.hud.toast(`איבדתם אותם ב-${mm}:${ss}`, 2600);
      g.sound?.chime?.(true);
      if (this.lines.lost && !this.said.lost) { this.said.lost = true; g.dialogue.play(this.lines.lost); }
    }
    g.hud.setPursuit(null);
    if (this.radioWasOff && g.radio) { g.radio.stop(); g.radio.refresh(true); }
  }

  dispose() {
    const g = this.game;
    this.chase?.dispose();
    if (g.chase === this.chase) g.chase = null;
    g.alert.chasing = false;
    g.hud.setPursuit(null);
    if (this.radioWasOff && g.radio) { g.radio.stop(); g.radio.refresh(true); }
    this.phase = 'done';
  }
}
