// On-foot movement: camera-relative joystick input, acceleration, collisions with the world,
// feet snapped to the ground, and a safety net that returns the player to the last safe spot.
// Chapter ten adds: crawling when hurt (prone, slow, no running until crawl(false)), a body that a scripted
// move can take for a moment (a leap, a climb, helped up: take / release), being held still (a stasis field:
// freeze), and falling instead of snapping down where a mission asks for it (gravity, over a rift).
import { CONFIG } from '../config.js';
import { damp, dampAngle } from '../core/math.js';
import { CollisionWorld } from '../world/colliders.js';

const STILL = { x: 0, y: 0 };
const DROP = 0.7;       // with gravity on: a step down deeper than this is fallen, not snapped
const FALL = 22;        // m/s², a little heavier than the real thing: a fall reads at once
const CRAWL_TURN = 4;   // how fast the body turns while crawling (walking: CONFIG.player.turnRate)

export class PlayerController {
  constructor(world, model) {
    this.world = world;
    this.model = model;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, z: 0 };
    this.yaw = 0;
    this.speed = 0;
    this.running = false;
    this.visualY = 0;
    this.safe = { x: 0, z: 0, yaw: 0, y: null };
    this.safeTimer = 0;
    this.respawns = 0;
    // 0.4..1: walking and running slowed (Nehorai on his feet again after the blast); 1 is his own pace.
    // Only the stick's walk and run: shoves, dodges, the car and the camera are not touched
    this.speedScale = 1;
    // chapter ten (none of it is saved: a restore stages it, a cleanup clears it)
    this.crawling = false;  // crawl(true): prone, slow, the run button does nothing, no standing until crawl(false)
    this.crawlSpeed = 0.9;  // m/s with the stick fully pushed (times speedScale)
    this.crawlSide = false; // which arm reaches next
    this.frozen = 0;        // seconds left held still (freeze): the stick is ignored
    this.scripted = null;   // the move that owns the body now (take / release): no stick, no snapping to the ground
    this.gravity = false;   // true: a drop deeper than a step is fallen through the air (a rift guard turns it on)
    this.falling = false;
    this.vy = 0;
    this.body = world.cols.addDynamicCircle(this, 0.3); // so friends, rivals and cars don't walk through him
  }

  place(x, z, yaw, y = null) {
    this.pos.x = x;
    this.pos.z = z;
    this.pos.y = this.visualY = this.world.groundHeight(x, z, y);
    this.vel.x = this.vel.z = 0;
    this.yaw = yaw;
    this.safe = { x, z, yaw, y: this.pos.y };
    // put somewhere by hand (a restore, a way back from a fall): whatever held the body lets go
    this.scripted = null; this.frozen = 0; this.falling = false; this.vy = 0;
    this.sync();
  }

  // hurt: down on the belly. Slow (crawlSpeed, times speedScale), no running, the camera low and close
  // (FollowCamera reads `crawling`); the prone pose is kept whatever else asks for a pose, until crawl(false)
  crawl(on = true, { speed = null } = {}) {
    on = !!on;
    if (speed != null && Number.isFinite(speed)) this.crawlSpeed = Math.max(0.3, speed);
    if (on === this.crawling) return on;
    this.crawling = on;
    this.running = false;
    const M = this.model;
    if (on) M.setPose('prone');
    else {
      if (M.pose === 'prone') M.setPose(null);
      if (M.action === 'crawlL' || M.action === 'crawlR') M.play(M.action, { at: 1 }); // the reach under way ends here
    }
    this.sync();
    return on;
  }

  // how tall he is to whatever looks or shoots at him
  get height() { return this.crawling ? 0.7 : 1.8; }
  // a move owns the body, or he is held still: no new move may begin
  get busy() { return !!this.scripted || this.frozen > 0; }

  // a scripted move takes the body: the stick is ignored and the feet are not snapped to the ground; the move
  // sets pos, visualY and yaw itself and calls sync(). Refused (false) while another move holds it
  take(owner) {
    if (this.scripted && this.scripted !== owner) return false;
    this.scripted = owner;
    this.vel.x = this.vel.z = 0; this.speed = 0; this.running = false; this.falling = false; this.vy = 0;
    return true;
  }
  // ...and gives it back, feet on the floor at `y` (the floor to stand on; without it, where he is)
  release(owner, y = this.pos.y) {
    if (this.scripted !== owner) return false;
    this.scripted = null;
    const g = this.world.groundHeight(this.pos.x, this.pos.z, y);
    if (this.gravity && y - g > DROP) this.pos.y = this.visualY = y; // let go over a rift with nothing under him: he falls from here
    else {
      this.pos.y = this.visualY = g;
      this.safe = { x: this.pos.x, z: this.pos.z, yaw: this.yaw, y: g };
      this.safeTimer = 0;
    }
    this.sync();
    return true;
  }

  // held still for `seconds` (time stopped around him): the stick does nothing; looking around still works
  freeze(seconds) {
    this.frozen = Math.max(this.frozen, seconds);
    this.vel.x = this.vel.z = 0; this.running = false;
    return this.frozen;
  }

  // move: { x: right, y: forward } in -1..1; camYaw: camera yaw (see FollowCamera); faceYaw: keep
  // facing this way while moving (squared up to an opponent) instead of turning toward the movement.
  // Long frames are split into short steps so fast movement never skips through a thin wall.
  update(dt, move, run, camYaw, faceYaw = null) {
    if (this.scripted) { this.speed = 0; this.running = false; this.sync(); return; } // the move that took the body places it
    if (this.frozen > 0) { this.frozen = Math.max(0, this.frozen - dt); move = STILL; run = false; faceYaw = null; }
    if (this.crawling) { run = false; faceYaw = null; }
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    let dist = 0, whole = true;
    for (let i = 0; i < steps; i++) {
      if (!this.step(dt / steps, move, run, camYaw, faceYaw)) { whole = false; break; }
      dist += this.speed * (dt / steps);
    }
    if (whole) this.speed = dt > 0 ? dist / dt : 0;
    if (this.crawling) this.crawlCycle();
  }

  // the crawl: the prone pose held (whoever else set a pose, he stays down), one arm reaching after the other
  // while he moves, at the pace he actually makes
  crawlCycle() {
    const M = this.model;
    if (M.pose !== 'prone') M.setPose('prone');
    if (this.speed > 0.12 && !M.action) {
      this.crawlSide = !this.crawlSide;
      M.play(this.crawlSide ? 'crawlL' : 'crawlR', { speed: Math.min(1.4, Math.max(0.55, this.speed / 0.9)) });
    }
  }

  step(dt, move, run, camYaw, faceYaw) {
    const P = CONFIG.player;
    const mag = Math.min(1, Math.hypot(move.x, move.y));
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);   // camera forward on the ground
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);    // camera right
    let dx = fx * move.y + rx * move.x, dz = fz * move.y + rz * move.x;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-5) { dx /= dl; dz /= dl; }
    this.running = run && mag > 0.2;
    const k = Number.isFinite(this.speedScale) ? Math.min(1, Math.max(0.4, this.speedScale)) : 1;
    const pace = this.crawling ? this.crawlSpeed * Math.max(0.45, mag) : this.running ? P.runSpeed : P.walkSpeed * Math.max(0.45, mag);
    const target = mag < 0.08 ? 0 : pace * k;
    this.vel.x = damp(this.vel.x, dx * target, P.accel, dt);
    this.vel.z = damp(this.vel.z, dz * target, P.accel, dt);

    const p = this.pos;
    const ox = p.x, oz = p.z;
    p.x += this.vel.x * dt;
    p.z += this.vel.z * dt;
    this.world.cols.resolve(p, P.radius, p.y, this);
    this.world.clampToPlayArea(p);
    // speed actually achieved, after walls stopped us
    this.speed = dt > 0 ? Math.hypot(p.x - ox, p.z - oz) / dt : 0;
    const turn = this.crawling ? CRAWL_TURN : P.turnRate;
    if (faceYaw !== null) this.yaw = dampAngle(this.yaw, faceYaw, turn, dt);
    else if (target > 0 && dl > 1e-5) this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), turn, dt);

    const g = this.world.groundHeight(p.x, p.z, p.y);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(g) || p.y < g - CONFIG.world.fallLimit) {
      this.respawn();
      return false;
    }
    if (this.gravity && (this.falling || p.y - g > DROP)) {
      // over a rift: off the edge (or the stone under him gone) he falls; whoever watches the rift puts him back
      this.falling = true;
      this.vy -= FALL * dt;
      p.y += this.vy * dt;
      if (p.y <= g) { p.y = g; this.vy = 0; this.falling = false; }
      this.visualY = p.y;
      this.sync();
      return true;
    }
    p.y = g;
    this.visualY = Math.abs(this.visualY - g) > 0.6 ? g : damp(this.visualY, g, 22, dt); // smooth curb steps
    this.safeTimer += dt;
    if (this.safeTimer > 0.5) { this.safeTimer = 0; this.safe = { x: p.x, z: p.z, yaw: this.yaw, y: p.y }; }
    this.sync();
    return true;
  }

  // a shove or a quick step that is not walking (knocked back, dodging): walls still stop it
  push(dx, dz) {
    this.pos.x += dx;
    this.pos.z += dz;
    this.world.cols.resolve(this.pos, CONFIG.player.radius, this.pos.y, this);
    this.world.clampToPlayArea(this.pos);
    const g = this.world.groundHeight(this.pos.x, this.pos.z, this.pos.y);
    if (!(this.gravity && (this.falling || this.pos.y - g > DROP))) this.pos.y = g; // shoved off an edge over a rift: the next step falls
    this.sync();
  }

  // back to the last safe spot on its own floor: without the height, the ground there is the highest
  // surface (a multi-storey building's roof)
  respawn() {
    this.respawns++;
    this.place(this.safe.x, this.safe.z, this.safe.yaw, this.safe.y ?? null);
  }

  sync() {
    this.model.root.position.set(this.pos.x, this.visualY, this.pos.z);
    this.model.root.rotation.y = this.yaw;
    CollisionWorld.setCircle(this.body, this.pos.x, this.pos.z, this.pos.y - 0.2, this.pos.y + this.height);
  }
}
