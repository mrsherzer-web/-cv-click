// ============================================================================
//  NIGHT 5 – "החשמל נופל"
// ============================================================================
import { N5, UI } from '../../story.js';
import { SPOTS, POINTS, PLAYER } from '../../world/layout.js';
import { fadeIn, bg, seat, put, closeUp, rubberBand, audio } from './common.js';

function base(S, stage) {
  const O = S.office;
  const a = S.G.save.data.allies;
  S.flags.cap = S.flags.cap || a.cap || 'ok';
  S.flags.smiler = S.flags.smiler || a.smiler || 'ok';
  O.enabled = { tablet: stage === 0, lure: stage === 0, fix: stage === 0, kill: stage === 0, vents: stage === 0 };
  S.player.mask.enabled = true;
  S.phone.setSignal(stage === 0 ? 3 : 0, stage === 0 ? '' : 'No Signal');
  for (const id of ['yahali', 'maayan', 'cap', 'smiler']) S.allyInOffice(id);
  S.world.setDoor('entrance', false, true);
  S.world.setDoor('storage', true, true);
  S.world.setDoor('vip', true, true);
  S.world.setDoor('cellar', stage >= 2, true);
  S.balls = stage >= 1 ? 3 : -1;
  if (stage >= 2) O.camOffline.delete(12);
  if (stage >= 1) {
    S.powerOverride = true;
    S.world.setPower(stage >= 3 ? 'dim' : 'emergency');
    S.powerOn = false;
  }
  for (const k of ['fuse_storage', 'fuse_wc', 'fuse_arcade']) S.world.items[k].led.material.color.setRGB(stage >= 2 ? 0.2 : 2.5, stage >= 2 ? 2.5 : 0.1, 0.1);
}

function walkFromOffice(S) {
  S.officeAI({ gefen: false, ido: false, dolev: false });
  S.clockRun = false;
  S.player.stand(PLAYER.office_stand.x, PLAYER.office_stand.z, 0);
}

// ---------------------------------------------------------------- the lights go
async function collapse(S) {
  const O = S.office;
  seat(S, { gefen: true, ido: true, dolev: true }, { clock: 0, rate: 1.5 });
  fadeIn(S, 1);
  S.titleCard();
  await S.clockTo(0.75);
  S.clockRun = false;
  for (const e of Object.values(S.enemies)) e.hold = true;
  S.playerSafe = true;
  if (S.enemies.ido.idx === 5) S.enemies.ido.leave();
  if (S.enemies.dolev.idx === 5) S.enemies.dolev.leave();
  if (S.enemies.gefen.idx >= 5) S.enemies.gefen.retreat();
  S.world.flickerBoost = 1;
  audio.staticBurst(0.6, 0.3);
  await S.say(N5.pa);
  // everything dies
  O.toggleTablet(false);
  O.enabled = { tablet: false, lure: false, fix: false, kill: false, vents: false };
  S.powerOverride = true;
  S.world.setPower('blackout');
  S.powerOn = false;
  audio.powerDown();
  audio.bang(0, 0.8);
  S.G.gfx.fx.flash = 0.7;
  bg(S.until(() => (S.G.gfx.fx.flash = Math.max(0, S.G.gfx.fx.flash - 0.03)) <= 0));
  S.officeAI({ gefen: false, ido: false, dolev: false });
  await S.wait(2.2);
  S.world.setPower('emergency');
  S.phone.setSignal(0, 'No Signal');
  await S.talk(N5.after);
  if (S.flags.cap === 'ok') await S.say(N5.capHelps);
  else await S.say(N5.capHurt);
  if (S.flags.smiler === 'ok') await S.say(N5.smilerHelps);
  S.clock = 1.0;
}

// ---------------------------------------------------------------- three fuses
async function fuses(S) {
  const P = S.player;
  const { gefen: G, ido: I, dolev: D } = S.enemies;
  S.clock = 1.0;
  walkFromOffice(S);
  fadeIn(S, 0.6);
  G.startFP(0, -30, { patrol: [[0, -30], [-5, -27], [0, -22.5], [0, -17], [5, -29]] });
  I.startFP(SPOTS.i_home[0], SPOTS.i_home[1]);
  D.startFP(SPOTS.d_home[0], SPOTS.d_home[1], { patrol: [[5.9, -18], [0.8, -16.5], [0.6, -11], [0.8, -16.5]] });
  S.tensionBase = 0.35;
  const todo = new Set(['fuse_storage', 'fuse_wc', 'fuse_arcade']);
  const label = () => `${N5.objFuses} (${3 - todo.size}/3)`;
  const fixed = (k) => {
    todo.delete(k);
    S.removeUse(k);
    S.world.items[k].led.material.color.setRGB(0.2, 2.5, 0.2);
    audio.switchClack?.(0.5, S.pan(POINTS[k][0], POINTS[k][1]));
    audio.okBeep?.(0.2);
    S.hud.toast(`${N5.fuseDone} (${3 - todo.size}/3)`, 3);
    S.hud.objective(todo.size ? label() : null);
    nearest();
  };
  const nearest = () => {
    let best = null;
    let bd = 1e9;
    for (const k of todo) {
      if (k === 'fuse_storage' && S.flags.cap === 'ok') continue;
      const d = P.dist(POINTS[k][0], POINTS[k][1]);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    if (best) S.setMarker(POINTS[best][0], POINTS[best][1], 1.4);
    else S.setMarker(null);
  };
  S.hud.objective(label());
  for (const k of todo) {
    if (k === 'fuse_storage' && S.flags.cap === 'ok') continue;
    S.addUse({ id: k, x: POINTS[k][0], z: POINTS[k][1], label: 'החזר את הנתיך', short: UI.hold, hold: 2.4, done: () => fixed(k) });
  }
  nearest();
  // the cap guy handles the storage on his own
  if (S.flags.cap === 'ok') {
    const cap = S.allies.cap;
    cap.inOffice = false;
    cap.runTo(POINTS.fuse_storage[0] + 0.7, POINTS.fuse_storage[1], 3.2);
    bg((async () => {
      await S.until(() => cap.mode === 'idle');
      await S.wait(3);
      fixed('fuse_storage');
      cap.runTo(-2.3, -1.5, 3.2);
      await S.until(() => cap.mode === 'idle');
      S.allyInOffice('cap');
    })());
  }
  // the smiler buys you one escape
  if (S.flags.smiler === 'ok') {
    bg((async () => {
      await S.event('chase', (e) => e.on);
      await S.wait(1.2);
      if (G.state !== 'chase') return;
      S.quick('smiler', 'היי גפן! תסתכל עליי!');
      audio.laugh(0.3, 0.6, 140);
      G.state = 'search';
      G.lastSeen = [SPOTS.g_hall_b[0], SPOTS.g_hall_b[1]];
      G.waitT = -4;
    })());
  }
  await S.until(() => todo.size === 0);
  S.setMarker(null);
  await S.wait(0.6);
}

// ---------------------------------------------------------------- the generator
async function basement(S) {
  const P = S.player;
  const { gefen: G, ido: I, dolev: D } = S.enemies;
  S.clock = 2.5;
  S.clockRun = false;
  S.officeAI({ gefen: false, ido: false, dolev: false });
  if (P.mode !== 'walk' || S.stageRetry) P.stand(0, -19.5, 0);
  else P.stand(P.x, P.z, P.yaw);
  fadeIn(S, 0.5);
  S.world.setDoor('cellar', true);
  audio.doorOpen(0);
  G.startFP(-6, -25, { patrol: [[-6, -25], [-5, -31], [4, -24]] });
  I.startFP(-4.5, -39);
  D.startFP(SPOTS.d_home[0], SPOTS.d_home[1], { patrol: [[5.9, -18], [3.2, -16.8]] });
  D.hold = true;
  S.tensionBase = 0.4;
  S.hud.objective(N5.objCellar);
  S.setMarker(POINTS.generator[0] + 1.4, POINTS.generator[1] + 1.2, 1.2);
  await S.until(() => P.room === 'basement');
  // the source
  I.hold = true;
  G.passive = true;
  await S.talk(N5.source, { radio: false });
  I.hold = false;
  G.passive = false;
  S.hud.objective(N5.objGen);
  await S.goTo([POINTS.generator[0] + 1.4, POINTS.generator[1] + 1.3], { label: 'משוך את חבל ההתנעה', short: UI.hold, hold: 3.2, y: 1.1 });
  audio.generator?.(0.3);
  audio.bang(0, 0.5);
  S.world.items.generator.led.material.color.setRGB(0.2, 2.5, 0.2);
  S.world.setPower('dim');
  S.makeNoise(P.x, P.z, 1);
  await S.say(N5.genDone);
}

// ---------------------------------------------------------------- Dolev
async function dolev(S) {
  const P = S.player;
  const { gefen: G, ido: I, dolev: D } = S.enemies;
  S.clock = 3.5;
  S.clockRun = false;
  S.officeAI({ gefen: false, ido: false, dolev: false });
  P.stand(1.6, -49, 0);
  fadeIn(S, 0.5);
  audio.generator?.(0.3);
  S.world.items.generator.led.material.color.setRGB(0.2, 2.5, 0.2);
  G.startFP(-5, -30, { patrol: [[-5, -30], [5, -31], [5, -24], [-5, -24]] });
  I.startFP(12, -27);
  put(D, 'd_home');
  D.actor.flicker = 0.9;
  D.actor.uniforms.twitch.value = 1.2;
  S.tensionBase = 0.45;
  S.hud.objective(N5.objDolev);
  await S.goTo('breaker', { label: 'הרם את המפסק', short: UI.hold, hold: 1.6, y: 1.5, radius: 2.6 });
  // overload
  G.hold = I.hold = true;
  S.busy = true;
  P.freeze(true);
  S.playerSafe = true;
  audio.zap?.(0, 0.7);
  audio.bang(0, 0.9);
  S.G.gfx.fx.flash = 1;
  bg(S.until(() => (S.G.gfx.fx.flash = Math.max(0, S.G.gfx.fx.flash - 0.025)) <= 0));
  const played = await S.clip('n5_dolev', { max: 9 });
  if (!played) await closeUp(S, D, { dist: 1.7, dur: 0.5 });
  D.actor.eyeBase = 0;
  D.actor.uniforms.twitch.value = 0.4;
  await S.say(N5.dolev);
  D.actor.eyeBase = 3.2;
  D.actor.uniforms.twitch.value = 2.2;
  S.G.gfx.fx.glitch = 1;
  audio.zap?.(0, 0.5);
  await S.wait(0.7);
  D.off();
  S.busy = false;
  P.freeze(false);
  S.playerSafe = false;
  await S.talk(N5.vow, { radio: true });
  G.hold = I.hold = false;
}

// ---------------------------------------------------------------- back
async function back(S) {
  const P = S.player;
  const { gefen: G, ido: I } = S.enemies;
  S.clock = 4.5;
  S.clockRun = false;
  S.officeAI({ gefen: false, ido: false, dolev: false });
  P.stand(5.2, -16.6, Math.PI / 2);
  fadeIn(S, 0.5);
  audio.generator?.(0.2);
  S.hud.objective(N5.objBack);
  S.setMarker(PLAYER.office_stand.x, PLAYER.office_stand.z, 1);
  G.startFP(0, -24, { patrol: [[0, -24], [0, -20]] });
  I.startFP(-6, -9);
  S.tensionBase = 0.6;
  await S.until(() => P.room === 'corr');
  G.spotPlayer();
  G.loseT = 30;
  bg(rubberBand(S, G, { min: 0.6, max: 1, near: 2, far: 9 }));
  await S.until(() => P.z > -2.3 && Math.abs(P.x) < 3.2);
  S.playerSafe = true;
  S.setMarker(null);
  S.hud.objective(null);
  G.passive = true;
  G.sendTo(0, -5.5, 1.4, 'wait');
  I.off();
  P.seat();
  S.busy = true;
  S.world.flickerBoost = 1;
  await S.say(N5.unsafe);
  // the office lights blow, the generator dies
  audio.stopLoop('generator', 0.3);
  audio.powerDown();
  audio.bang(0, 1);
  S.world.setPower('final');
  S.G.gfx.fx.flash = 0.8;
  bg(S.until(() => (S.G.gfx.fx.flash = Math.max(0, S.G.gfx.fx.flash - 0.03)) <= 0));
  G.mode = 'script';
  G.placeSpot('g_front');
  G.actor.show(true);
  G.actor.uniforms.twitch.value = 2;
  audio.sting(0.6);
  await S.wait(1.6);
  await S.say(N5.end);
  S.G.gfx.fx.fade = 1;
  S.clock = 6;
  await S.wait(0.6);
}

export default {
  base,
  stages: [
    { id: 'collapse', run: collapse },
    { id: 'fuses', run: fuses },
    { id: 'basement', run: basement },
    { id: 'dolev', run: dolev },
    { id: 'back', run: back },
  ],
};
