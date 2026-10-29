// The game itself: who is where (on foot or driving), which camera looks, what the context button does,
// and one step of the world per frame. Missions and other activities plug in through `activities`.
import { CONFIG } from './config.js';
import { makeNehorai } from './player/character.js';
import { PlayerController } from './player/controller.js';
import { FollowCamera } from './camera/followCamera.js';
import { CarCamera } from './camera/carCamera.js';
import { Vehicle } from './vehicle/vehicle.js';
import { makeHatchback } from './world/car.js';

const PARKED = { throttle: 0, brake: 0, steer: 0, handbrake: false };

export class Game {
  constructor({ scene, camera, world, hud, controls }) {
    Object.assign(this, { scene, camera, world, hud, controls });
    this.time = 0;
    this.mode = 'foot';
    this.nehorai = makeNehorai();
    scene.add(this.nehorai.root);
    this.player = new PlayerController(world, this.nehorai);
    this.follow = new FollowCamera(camera, world);
    this.carCam = new CarCamera(camera, world);

    // the white Renault, parked in the driveway
    const spot = world.places.carSpot;
    this.car = new Vehicle(world, makeHatchback({ color: '#f3f4f6' }), { name: 'renault' });
    scene.add(this.car.model);
    this.car.place(spot.x, spot.z, spot.yaw);
    this.vehicles = [this.car];
    this.exitPending = false;

    this.activities = [];   // { update(dt, game), interaction?(game) → { label, priority, run } }
    this.prompt = null;
    controls.onInteract = () => this.prompt?.run();
    controls.onExit = () => this.requestExit();
  }

  get driving() { return this.mode === 'car' ? this.car : null; }
  // where Nehorai is, whether walking or driving
  get pos() { return this.mode === 'car' ? this.car.pos : this.player.pos; }

  start(x, z, yaw) {
    this.player.place(x, z, yaw);
    this.follow.snapBehind(yaw);
  }

  // ---------- getting in and out ----------
  enterCar(car = this.car) {
    if (this.mode === 'car') return;
    this.mode = 'car';
    this.exitPending = false;
    car.occupants.add('nehorai');
    this.nehorai.root.visible = false;
    this.controls.mode = 'car';
    this.controls.setRun(false);
    this.carCam.snap(car);
    this.hud.setMode('car');
  }

  // getting out at speed: brake to a stop first, then step out
  requestExit() {
    if (this.mode !== 'car') return;
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
    this.controls.mode = 'foot';
    this.follow.snapBehind(spot.yaw);
    this.hud.setMode('foot');
  }

  // ---------- the context button: the most important thing nearby ----------
  interactions() {
    const out = [];
    if (this.mode === 'foot' && !this.follow.override) {
      const p = this.player.pos;
      if (this.car.doorDistance(p.x, p.z) < 1.9 && Math.abs(this.car.pos.y - p.y) < 1.2) {
        out.push({ label: 'להיכנס לרכב', priority: 1, run: () => this.enterCar() });
      }
    }
    for (const a of this.activities) {
      const it = a.interaction?.(this);
      if (it) out.push(it);
    }
    return out.sort((a, b) => b.priority - a.priority)[0] || null;
  }

  update(dt) {
    this.time += dt;
    const input = this.controls.sample();
    if (this.mode === 'foot') {
      this.follow.look(input.lookDX, input.lookDY);
      this.player.update(dt, input.move, input.run, this.follow.yaw);
      this.nehorai.animate(dt, this.player.speed, CONFIG.player.runSpeed);
    } else {
      this.carCam.look(input.lookDX, input.lookDY);
      this.car.update(dt, this.exitPending ? { ...PARKED, brake: 1 } : input);
      if (this.exitPending && Math.abs(this.car.speed) < 1.5) this.exitCar();
      this.player.pos.x = this.car.pos.x; this.player.pos.z = this.car.pos.z; this.player.pos.y = this.car.pos.y;
    }
    for (const v of this.vehicles) if (v !== this.driving && (Math.abs(v.speed) > 0.05 || v.vy)) v.update(dt, PARKED);
    for (const a of this.activities) a.update?.(dt, this);

    this.prompt = this.interactions();
    this.hud.setInteract(this.prompt?.label ?? null);
    if (this.mode === 'foot') this.follow.update(dt, this.player);
    else {
      this.carCam.update(dt, this.car);
      this.hud.setCar(this.car);
    }
  }
}
