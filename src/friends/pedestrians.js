// Passers-by in Hadera: invented people walking around the sidewalk of a block, stopping now and then
// on the phone. They step out of the way of a car coming at them and complain if one nudges them.
// They are not part of fights: punches never reach them and nothing rewards hurting them.
// Only a few exist; whoever drifts far from Nehorai reappears on a block near him, out of sight.
import { Npc } from './npc.js';
import { passerBy } from '../characters/extras.js';

const COMPLAINTS = ['עובר אורח: היי! תסתכל על הכביש!', 'עוברת אורח: יש פה מדרכה, אחי!', 'עובר אורח: נו באמת, לאט!', 'עובר אורח: וואו! כמעט!'];

export class Pedestrians {
  constructor(game, count) {
    this.game = game;
    this.count = count;
    this.people = [];
    this.loops = game.world.places.walkLoops || [];
    this.city = game.world.places.hadera?.CITY;
    this.quiet = 0; // time until the next complaint may be shown
  }

  near(p, m) {
    const C = this.city;
    return !!C && p.x > C.x0 - m && p.x < C.x1 + m && p.z > C.z0 - m && p.z < C.z1 + m;
  }

  // made the first time Nehorai comes close to the city, so the start of the game stays quick
  create() {
    for (let k = 0; k < this.count; k++) {
      const n = new Npc(this.game, passerBy(k + 1), { detail: 'low' });
      n.show(false);
      n.walk = { loop: null, corner: 0, dir: k % 2 ? 1 : -1, pause: 0, aside: 0 };
      n.bumpedBy = () => this.bumped(n);
      this.people.push(n);
    }
  }

  corners(L) { return [[L.x0, L.z0], [L.x1, L.z0], [L.x1, L.z1], [L.x0, L.z1]]; }

  // onto the sidewalk of a block near Nehorai, behind the camera when there is a choice
  spawn(n) {
    const g = this.game, p = g.pos, cam = g.camera.position;
    const fx = p.x - cam.x, fz = p.z - cam.z;
    const options = this.loops.filter((L) => { const d = Math.hypot((L.x0 + L.x1) / 2 - p.x, (L.z0 + L.z1) / 2 - p.z); return d > 30 && d < 150; });
    if (!options.length) { n.show(false); return; }
    options.sort((a, b) => {
      const da = ((a.x0 + a.x1) / 2 - p.x) * fx + ((a.z0 + a.z1) / 2 - p.z) * fz, db = ((b.x0 + b.x1) / 2 - p.x) * fx + ((b.z0 + b.z1) / 2 - p.z) * fz;
      return da - db + (Math.random() - 0.5) * 3000;
    });
    const L = options[0], c = this.corners(L), k = Math.floor(Math.random() * 4), [ax, az] = c[k], [bx, bz] = c[(k + 1) % 4], t = Math.random();
    n.place(ax + (bx - ax) * t, az + (bz - az) * t, Math.atan2(bx - ax, bz - az));
    n.walk.loop = L;
    n.walk.corner = n.walk.dir > 0 ? (k + 1) % 4 : k;
    n.walk.pause = 0;
    n.idle = null;
    n.show(true);
    this.next(n);
  }

  next(n) {
    const w = n.walk, [x, z] = this.corners(w.loop)[w.corner];
    n.walkTo(x, z, {
      near: 0.8,
      onArrive: () => {
        w.corner = (w.corner + w.dir + 4) % 4;
        if (Math.random() < 0.25) { w.pause = 2 + Math.random() * 4; n.idle = 'phone'; } else this.next(n);
      },
    });
  }

  bumped(n) {
    n.model.play('dodge');
    if (this.quiet <= 0) { this.game.hud.toast(COMPLAINTS[Math.floor(Math.random() * COMPLAINTS.length)], 2200); this.quiet = 6; }
  }

  update(dt) {
    const g = this.game;
    this.quiet -= dt;
    if (!this.near(g.pos, 160)) { for (const n of this.people) if (n.visible) n.show(false); return; }
    if (!this.people.length && this.count) this.create();
    const cars = [g.car, ...(g.traffic?.cars || [])];
    for (const n of this.people) {
      if (!n.visible || Math.hypot(n.pos.x - g.pos.x, n.pos.z - g.pos.z) > 170) { this.spawn(n); if (!n.visible) continue; }
      const w = n.walk;
      if (w.pause > 0 && (w.pause -= dt) <= 0) { n.idle = null; this.next(n); }
      if (w.aside > 0 && (w.aside -= dt) <= 0) this.next(n);
      // a car coming this way: get out of its path, to whichever side is closer
      for (const c of cars) {
        const sp = Math.abs(c.speed ?? 0);
        if (sp < 2) continue;
        const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), dx = n.pos.x - c.pos.x, dz = n.pos.z - c.pos.z;
        const ahead = (dx * fx + dz * fz) * Math.sign(c.speed), side = dx * fz - dz * fx;
        if (ahead > 0 && ahead < 4 + sp * 1.1 && Math.abs(side) < 2.2 && w.aside <= 0) {
          const k = side >= 0 ? 1 : -1;
          n.walkTo(n.pos.x + fz * k * 3.2, n.pos.z - fx * k * 3.2, { run: true, near: 0.4 });
          n.idle = null;
          w.pause = 0;
          w.aside = 1.6;
        }
      }
      n.update(dt);
    }
  }

  dispose() {
    for (const n of this.people) n.dispose();
    this.people = [];
  }
}
