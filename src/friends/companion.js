// A friend along for the ride (Dolev): called from the phone he comes over from just out of sight,
// follows Nehorai on foot, gets into the Renault's passenger seat when Nehorai drives, and fights with
// him in mission fights (only those). Left behind, he waits a while and then makes his own way. If he
// gets stuck behind something he catches up where nobody is looking. He never holds a mission up.
export class Companion {
  constructor(game, id) {
    this.game = game;
    this.id = id;
    this.active = false;
    this.left = 0;        // how long Nehorai has been gone without him
    this.stuck = 0;       // how long since he last got closer to Nehorai
    this.best = Infinity; // the closest he has got since then
    this.rescued = 0;     // times he caught up out of sight
  }

  get npc() { return this.game.npc(this.id); }

  // Nehorai's position seen from behind the camera: where someone can appear without popping into view
  behind(dist) {
    const g = this.game, p = g.pos, cam = g.camera.position;
    let fx = p.x - cam.x, fz = p.z - cam.z;
    const l = Math.hypot(fx, fz) || 1;
    fx /= l; fz /= l;
    const W = g.world;
    for (const side of [0, 0.7, -0.7, 1.4, -1.4]) {
      const a = Math.atan2(-fx, -fz) + side, x = p.x + Math.sin(a) * dist, z = p.z + Math.cos(a) * dist;
      const probe = { x, z, y: W.groundHeight(x, z) };
      if (Math.abs(probe.y - p.y) < 2.5 && !W.cols.resolve(probe, 0.4, probe.y, this.npc)) return probe;
    }
    return { x: p.x - fx * 2, z: p.z - fz * 2 };
  }

  // he comes over: from out of sight behind Nehorai, or straight into the car if Nehorai is driving
  join({ near = null } = {}) {
    const n = this.npc, g = this.game;
    this.active = true;
    this.left = 0;
    n.idle = null;
    if (n.inCar) return;
    if (g.mode === 'car') { n.enter(g.car); return; }
    const at = near || this.behind(14);
    n.place(at.x, at.z, 0);
    n.show(true);
  }

  leave() {
    const n = this.npc;
    this.active = false;
    if (n.inCar) n.stepOut(-1);
    n.target = null;
    n.show(false);
  }

  // in a mission fight he fights too, when he is there on foot
  ally() {
    const n = this.npc, g = this.game;
    if (!this.active || n.inCar || !n.visible) return [];
    return Math.hypot(n.pos.x - g.pos.x, n.pos.z - g.pos.z) < 30 ? [{ npc: n, hp: 95, power: 0.95 }] : [];
  }

  update(dt) {
    if (!this.active) return;
    const g = this.game, n = this.npc, car = g.car;
    if (g.fight?.allies?.some((a) => a.npc === n)) return; // the fight steers him
    if (g.mode === 'car') {
      if (n.inCar) return;
      const d = Math.hypot(n.pos.x - car.pos.x, n.pos.z - car.pos.z);
      if (n.visible && d < 22 && Math.abs(car.speed) < 3) { // to the passenger door
        const door = car.local(-1.45, 0.25);
        if (!n.target) n.walkTo(door.x, door.z, { near: 0.9, run: d > 5, onArrive: () => n.enter(car) });
        this.left = 0;
        return;
      }
      // left behind: he waits, then goes off on his own (and rejoins when Nehorai is back on foot)
      this.left += dt;
      if (this.left > 25 && n.visible) { n.target = null; n.show(false); }
      return;
    }
    if (n.inCar) n.stepOut(-1);
    if (!n.visible) { const at = this.behind(12); n.place(at.x, at.z, g.player.yaw); n.show(true); }
    this.left = 0;
    const p = g.player.pos, gap = Math.hypot(n.pos.x - p.x, n.pos.z - p.z);
    if (gap > 60) { const at = this.behind(12); n.place(at.x, at.z, g.player.yaw); return; }
    // following: a step behind and to the side, running to keep up
    if (gap > 3.2) {
      const back = { x: p.x - Math.sin(g.player.yaw) * 1.6 + Math.cos(g.player.yaw) * 1.2, z: p.z - Math.cos(g.player.yaw) * 1.6 - Math.sin(g.player.yaw) * 1.2 };
      n.walkTo(back.x, back.z, { near: 1.2, run: gap > 7 });
      // not getting any closer for a while (a wall, a fence, a dead end): catch up out of sight
      if (gap < this.best - 0.5) { this.best = gap; this.stuck = 0; } else this.stuck += dt;
      if (this.stuck > 5 && gap > 6) { const at = this.behind(9); n.place(at.x, at.z, g.player.yaw); this.stuck = 0; this.best = Infinity; this.rescued++; }
    } else {
      n.target = null;
      n.lookAt(p.x + Math.sin(g.player.yaw) * 4, p.z + Math.cos(g.player.yaw) * 4);
      this.stuck = 0;
      this.best = gap;
    }
  }
}
