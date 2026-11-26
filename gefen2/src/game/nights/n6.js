// ============================================================================
//  NIGHT 6 – "THE FINAL NIGHT"
// ============================================================================
import { N6, UI } from '../../story.js';
import { SPOTS, POINTS, PLAYER } from '../../world/layout.js';
import { fadeIn, bg, seat, put, rubberBand, audio } from './common.js';

const ORDER = ['yellow', 'green', 'brown', 'blue', 'pink'];
const HEX = { yellow: 0xf2c81a, green: 0x1a9a3a, brown: 0x6a3a14, blue: 0x1a4ad0, pink: 0xf07ab0 };
const START = { 1: [0, -1.4, 0], 2: [0, -26.6, 0], 3: [0, -26.6, 0], 4: [0, -26.6, 0], 5: [0, -26.6, 0], 6: [0, -26.6, 0], 7: [0, -26.6, Math.PI] };

function base(S, stage) {
  const O = S.office;
  const W = S.world;
  const a = S.G.save.data.allies;
  S.flags.cap = S.flags.cap || a.cap || 'ok';
  S.flags.smiler = S.flags.smiler || a.smiler || 'ok';
  O.enabled = { tablet: false, lure: false, fix: false, kill: false, vents: false };
  O.camOffline.delete(12);
  S.player.mask.enabled = true;
  S.phone.setSignal(0, 'No Signal');
  for (const id of ['yahali', 'maayan', 'cap', 'smiler']) S.allyInOffice(id);
  W.setDoor('entrance', stage >= 7, true);
  W.setDoor('storage', true, true);
  W.setDoor('vip', true, true);
  W.setDoor('cellar', true, true);
  S.balls = 3;
  S.powerOverride = true;
  W.setPower('final');
  S.powerOn = false;
  S.showClock = true;
  S.clock = Math.min(5.5, stage * 0.75);
  S.clockRun = false;
  S.enemies.gefen.final = stage < 7;
  // the frame so far
  S.potted = Math.max(0, Math.min(5, stage - 1));
  ORDER.forEach((c, i) => {
    const b = W.items['ball_' + c];
    b.visible = i >= S.potted && stage <= 5;
  });
  // the blue and pink balls live in the storage and the toilets
  if (!W.items.ball_blue._placed) {
    W.items.ball_blue._placed = true;
  }
  W.items.blackBall.visible = stage <= 6;
}

/** Enemies that are still hunting at this point of the frame. */
function hunters(S, { gefenAt = [3, -31] } = {}) {
  const { gefen: G, ido: I, dolev: D } = S.enemies;
  G.final = true;
  G.startFP(gefenAt[0], gefenAt[1], { patrol: [[-5, -31], [5, -31], [5, -24], [0, -22.5], [-5, -24], [0, -17]] });
  if (S.potted < 2) D.startFP(SPOTS.d_home[0], SPOTS.d_home[1], { patrol: [[5.9, -18], [0.8, -16.5], [0.6, -10], [0.8, -16.5]] });
  else put(D, [7.6, -33.6]);
  if (S.potted < 4) I.startFP(SPOTS.i_home[0], SPOTS.i_home[1]);
  else put(I, [-7.6, -33.4]);
  if (S.potted >= 2) {
    D.actor.eyeBase = 0.6;
    D.actor.flicker = 1;
  }
  if (S.potted >= 4) {
    I.actor.eyeBase = 0.6;
    I.actor.flicker = 1;
  }
}

/** Yahali can pull Gefen away once in a while; Maayan brings the lights back for a moment. */
function helpers(S) {
  const G = S.enemies.gefen;
  let cd = 0;
  const btn = () => {
    S.hud.action('yahali', UI.yahaliDistract, () => {
      if (S.time < cd) return S.hud.toast('יהלי מתנשף. עוד רגע.', 2);
      cd = S.time + 32;
      bg(S.say(N6.yahaliGo, { block: false, radio: true }));
      audio.bang(S.pan(-14, -27), 0.5);
      G.state = 'search';
      G.lastSeen = S.player.dist(-13, -27) > S.player.dist(13, -27) ? [-12.5, -27] : [12.5, -27];
      G.waitT = -5;
    });
  };
  btn();
  bg((async () => {
    for (;;) {
      await S.wait(34);
      bg(S.say(N6.maayanLight, { block: false, radio: true }));
      S.world.setPower('dim');
      audio.okBeep?.(0.2);
      await S.wait(9);
      S.world.setPower('final');
      audio.powerDown();
    }
  })());
}

// ---------------------------------------------------------------- the plan
async function intro(S) {
  const G = S.enemies.gefen;
  const P = S.player;
  seat(S, {}, { clock: 0 });
  S.powerOn = false;
  S.clockRun = false;
  fadeIn(S, 1.2);
  S.hud.titleCard('', 'THE FINAL NIGHT', 5);
  audio.braam(0.8);
  await S.wait(4);
  await S.talk(N6.start);
  // he comes in his final form and the light no longer stops him
  G.final = true;
  G.mode = 'script';
  G.actor.setPose(G.actor.sheet.final ? 'final' : 'idle');
  G.placeSpot('g_corr_mid');
  G.actor.show(true);
  G.actor.eyeBase = 4.5;
  audio.sting(0.7);
  S.tensionBase = 0.7;
  const played = await S.clip('n6_form', { max: 8 });
  if (!played) {
    S.G.gfx.fx.glitch = 1;
    await S.wait(0.9);
    G.placeSpot('g_corr_near');
    S.G.gfx.fx.glitch = 1;
    await S.wait(0.7);
  }
  await S.say(N6.form);
  G.placeSpot('g_hall_c');
  audio.hiss?.(0.6);
  S.hud.toast('האור כבר לא מבריח אותו. רק מסנוור לרגע.', 6, 'warn');
  P.stand(PLAYER.office_stand.x, PLAYER.office_stand.z, 0);
}

// ---------------------------------------------------------------- one ball
function ballStage(i) {
  const c = ORDER[i];
  return async function (S) {
    const P = S.player;
    const { gefen: G, ido: I, dolev: D } = S.enemies;
    const W = S.world;
    const s = START[i + 1];
    if (S.stageRetry || i === 0) P.stand(s[0], s[1], s[2]);
    else P.stand(P.x, P.z, P.yaw);
    if (i === 0) P.stand(PLAYER.office_stand.x, PLAYER.office_stand.z, 0);
    fadeIn(S, 0.5);
    S.tensionBase = 0.45 + i * 0.06;
    hunters(S, { gefenAt: i === 0 ? [3, -31] : P.dist(-5, -31) > P.dist(5, -24) ? [-5, -31] : [5, -24] });
    helpers(S);
    const name = N6.colors[c];
    const key = 'ball_' + c;
    S.hud.objective(`${N6.objBall(name)} (${N6.where[c]})`);
    await S.goTo(key, { label: `קח את הכדור ה${name}`, short: UI.interact, hold: 0.7, y: 1.0 });
    W.items[key].visible = false;
    P.carrying = true;
    audio.okBeep?.(0.2);
    S.hud.objective(N6.got(name));
    S.hud.toast(N6.got(name), 3);
    await S.goTo([POINTS.cursed_table[0], POINTS.cursed_table[1] + 1.35], { label: `הכנס את ה${name}`, short: UI.hold, hold: 2.4, y: 0.95, radius: 2.0 });
    P.carrying = false;
    S.potted = i + 1;
    audio.pot?.(0.6);
    // the demon is hurt: everything staggers
    S.G.gfx.fx.flash = 0.7;
    bg(S.until(() => (S.G.gfx.fx.flash = Math.max(0, S.G.gfx.fx.flash - 0.03)) <= 0));
    S.G.gfx.fx.glitch = 1;
    audio.scream(0.35);
    audio.bang(0, 0.6);
    W.cursedLamp.color.setHex(HEX[c]);
    if (G.mode === 'fp') {
      G.state = 'stunned';
      G.stunT = 4;
    }
    if (I.mode === 'fp') I.graceT = 4;
    if (D.mode === 'fp') D.tinkerT = 4;
    S.hud.objective(null);
    S.hud.toast(`${N6.potted(name)} (${i + 1}/5)`, 4);
    S.clock = Math.min(5.5, (i + 2) * 0.75);
    if (i + 1 === 2) {
      // Dolev fights it
      D.mode = 'script';
      D.actor.moving = false;
      D.actor.eyeBase = 0.6;
      D.actor.flicker = 1;
      await S.say(N6.dolevFights, { radio: false });
    }
    if (i + 1 === 4) {
      I.mode = 'script';
      I.actor.moving = false;
      I.actor.eyeBase = 0.6;
      I.actor.flicker = 1;
      await S.say(N6.idoFights, { radio: false });
    }
    await S.wait(0.8);
  };
}

// ---------------------------------------------------------------- the black
async function black(S) {
  const P = S.player;
  const { gefen: G, ido: I, dolev: D } = S.enemies;
  const W = S.world;
  if (S.stageRetry) P.stand(0, -26.6, 0);
  else P.stand(P.x, P.z, P.yaw);
  fadeIn(S, 0.5);
  S.clock = 5.5;
  S.tensionBase = 0.75;
  put(D, [7.6, -33.6]);
  put(I, [-7.6, -33.4]);
  D.actor.eyeBase = I.actor.eyeBase = 0.6;
  D.actor.flicker = I.actor.flicker = 1;
  G.final = true;
  G.startFP(-6, -24, { patrol: [[-6, -24], [-5, -31], [5, -24]] });
  helpers(S);
  S.hud.objective(N6.objBlack);
  await S.goTo([POINTS.altar[0], POINTS.altar[1] + 0.35], { label: 'קח את הכדור השחור', short: UI.hold, hold: 2.2, y: -1.9 + 3, radius: 2.0 });
  // it burns
  W.items.blackBall.visible = false;
  W.sourceLight.state = 'off';
  P.carrying = true;
  P.flash.dead = true;
  P.flash.on = false;
  S.hud.action('yahali', null);
  S.redPulse = 0.5;
  audio.braam(0.9);
  audio.rumble?.(0.35);
  await S.say(N6.takeBlack);
  S.hud.objective(N6.objPot);
  // his voice from every direction
  bg((async () => {
    for (const l of N6.voices) {
      await S.wait(4.5);
      audio.staticBurst(0.2, 0.15);
      await S.say(l, { block: true });
    }
  })());
  G.placeAt(5, -44.6, 'basement');
  G.actor.setY(-3);
  G.state = 'chase';
  G.lastSeen = [P.x, P.z];
  G.loseT = 99;
  G.stunCd = 99;
  bg(rubberBand(S, G, { min: 0.55, max: 0.98, near: 2.2, far: 8 }));
  bg(S.until(() => {
    G.loseT = 99;
    G.lastSeen = [P.x, P.z];
    S.world.flickerBoost = 1;
    return false;
  }));
  const tx = POINTS.cursed_table[0];
  const tz = POINTS.cursed_table[1] + 1.35;
  S.setMarker(tx, tz, 0.95);
  await S.reach(tx, tz, 3.2);
  // the friends hold him
  G.hold = true;
  G.passive = true;
  G.mode = 'script';
  const gx = Math.max(-7, Math.min(7, P.x + 2.4));
  G.placeAt(...W.nav.nearest(gx, tz + 1.6));
  put(I, W.nav.nearest(G.x - 0.6, G.z + 0.3));
  put(D, W.nav.nearest(G.x + 0.6, G.z + 0.3));
  I.actor.eyeBase = D.actor.eyeBase = 0;
  G.actor.uniforms.twitch.value = 2.4;
  audio.bang(0.3, 0.8);
  bg(S.say(N6.hold, { block: false }));
  await S.goTo([tx, tz], { label: 'הכנס את השחור', short: UI.hold, hold: 3.4, y: 0.95, radius: 2.2 });
  // it is over
  P.carrying = false;
  S.busy = true;
  S.playerSafe = true;
  audio.pot?.(0.9);
  audio.stopLoop('rumble', 0.5);
  S.tensionBase = 0;
  S.redPulse = 0;
  S.G.gfx.fx.flash = 1;
  audio.scream(0.8);
  audio.bang(0, 1);
  await S.wait(0.5);
  const played = await S.clip('n6_exorcism', { max: 10 });
  bg(S.until(() => (S.G.gfx.fx.flash = Math.max(0, S.G.gfx.fx.flash - 0.012)) <= 0));
  G.final = false;
  for (const e of [G, I, D]) {
    e.actor.setPose(e.actor.sheet.normal ? 'normal' : 'idle');
    e.actor.eyeBase = 0;
    e.actor.jitter = 0;
    e.actor.flicker = 0;
    e.actor.uniforms.twitch.value = 0;
  }
  W.setPower('dim');
  W.flickerBoost = 0;
  if (!played) await S.wait(1.4);
  await S.say(N6.done);
  S.busy = false;
  S.clock = 5.8;
}

// ---------------------------------------------------------------- out
async function escape(S) {
  const P = S.player;
  const { gefen: G, ido: I, dolev: D } = S.enemies;
  const W = S.world;
  P.stand(0, -26.6, Math.PI);
  fadeIn(S, 0.5);
  S.clock = 5.8;
  S.clockRate = 0.25;
  S.clockRun = true;
  W.setPower('dim');
  W.flickerBoost = 1;
  S.playerSafe = true;
  S.hud.action('yahali', null);
  // everybody follows you out
  const team = [];
  const add = (mover, x, z) => {
    const f = S.allies[mover.id] || mover;
    if (f.startFollow) f.startFollow(x, z);
    else {
      mover.mode = 'script';
      mover.placeAt(x, z);
      mover.actor.show(true);
      team.push(mover);
    }
  };
  for (const e of [G, I, D]) {
    e.final = false;
    e.actor.setPose(e.actor.sheet.normal ? 'normal' : 'idle');
    e.actor.eyeBase = 0;
    e.actor.jitter = 0;
    e.actor.flicker = 0;
    e.actor.uniforms.twitch.value = 0;
  }
  add(G, 1.4, -27.6);
  add(I, -1.3, -27.4);
  add(D, 2.4, -26.6);
  for (const id of ['yahali', 'maayan', 'cap', 'smiler']) {
    const a = S.allies[id];
    a.inOffice = false;
    a.startFollow(a.x, a.z);
  }
  // the freed three trail behind the player with simple steering
  bg(S.until(() => {
    team.forEach((m, k) => {
      if (m.playerDist() > 2.4 + k * 0.7) m.goTo(P.x, P.z, 3.4, 1 / 60, 1.6 + k * 0.6);
      else m.actor.moving = false;
    });
    return false;
  }));
  audio.rumble?.(0.6);
  bg(S.say(N6.collapse, { block: false }));
  let left = 60;
  bg(S.until(() => {
    left -= 1 / 60;
    P.shake = 0.012 + 0.012 * Math.sin(S.time * 3);
    if (Math.random() < 0.01) audio.bang(Math.random() * 2 - 1, 0.4 + Math.random() * 0.4);
    S.hud.objective(`${N6.objExit} · ${Math.max(0, Math.ceil(left))}`);
    if (left <= 0) S.kill('gefen');
    return false;
  }));
  S.setMarker(POINTS.exit[0], POINTS.exit[1], 1.2);
  await S.reach(POINTS.exit[0], POINTS.exit[1], 1.6);
  S.setMarker(null);
  S.hud.objective(null);
  P.shake = 0;
  S.busy = true;
  S.G.gfx.fx.fade = 1;
  audio.stopLoop('rumble', 1);
  S.clock = 6;
  await S.wait(0.5);
}

export default {
  base,
  stages: [
    { id: 'intro', run: intro },
    { id: 'yellow', run: ballStage(0) },
    { id: 'green', run: ballStage(1) },
    { id: 'brown', run: ballStage(2) },
    { id: 'blue', run: ballStage(3) },
    { id: 'pink', run: ballStage(4) },
    { id: 'black', run: black },
    { id: 'escape', run: escape },
  ],
};
