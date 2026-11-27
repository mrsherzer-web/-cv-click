// ============================================================================
//  NIGHT 1 – "הוא עדיין כאן"  (opening + first night)
// ============================================================================
import { OPENING, N1, UI } from '../../story.js';
import { PLAYER, POINTS } from '../../world/layout.js';
import { fadeIn, bg, seat, standUp, backToSeat, rubberBand, put, mash, breakerGame, audio } from './common.js';

function base(S) {
  const O = S.office;
  O.enabled = { tablet: true, lure: false, fix: false, kill: false, vents: false };
  S.player.mask.enabled = false;
  S.phone.setSignal(0, 'No Signal');
  S.balls = -1;
  S.world.setDoor('storage', true, true);
  S.world.setDoor('vip', true, true);
}

// ---------------------------------------------------------------- opening
async function opening(S) {
  const P = S.player;
  const G = S.enemies.gefen;
  const W = S.world;
  S.showClock = false;
  S.powerOn = false;
  S.powerOverride = true;
  W.setPower('dim');
  S.office.enabled.tablet = false;
  P.stand(PLAYER.start_hall.x, PLAYER.start_hall.z, 0);
  put(G, [0.2, -26.6], 'back');
  G.actor.eyeBase = 0;
  G.actor.jitter = 0;
  S.tensionBase = 0.2;
  fadeIn(S, 2.2);
  bg(S.say(OPENING.arrive, { block: false }));
  // walk up to him
  S.setMarker(0.2, -26.6, 1.5);
  await S.reach(0.2, -26.6, 2.3);
  S.setMarker(null);
  S.busy = true;
  P.freeze(true);
  P.face(0.2, -26.6);
  P.pitch = 0;
  await S.say(OPENING.call);
  await S.wait(0.5);
  // he turns
  const played = await S.clip('op_turn', { max: 9 });
  G.actor.setPose('idle');
  G.actor.eyeBase = 3.4;
  G.actor.jitter = 1;
  G.actor.uniforms.twitch.value = 1.5;
  if (!played) {
    S.G.gfx.fx.glitch = 0.9;
    audio.glitch(0.5, 0.3);
    W.flickerBoost = 1;
    await S.wait(1.1);
  }
  audio.braam(0.7);
  S.tensionBase = 0.7;
  await S.say(OPENING.turn);
  // lunge + struggle
  audio.scream(0.6);
  S.G.gfx.fx.glitch = 0.8;
  const gx = P.x - Math.sin(P.yaw) * 0.75;
  const gz = P.z - Math.cos(P.yaw) * 0.75;
  G.placeAt(...S.world.nav.nearest(gx, gz));
  G.actor.uniforms.twitch.value = 2.2;
  bg(S.clip('op_grab', { max: 4, shake: 0.5 }));
  audio.heartbeat(150, 0.6);
  const ok = await mash(S, { need: 13, time: 8 });
  S.stopClip();
  if (!ok) {
    S.kill('fp_gefen');
    await S.wait(10);
  }
  audio.bang(0, 0.9);
  audio.hiss?.(0.6);
  S.G.gfx.fx.flash = 0.6;
  bg(S.until(() => (S.G.gfx.fx.flash = Math.max(0, S.G.gfx.fx.flash - 0.04)) <= 0));
  // free: turn to the corridor and run
  S.busy = false;
  P.freeze(false);
  P.yaw = P.yawT = Math.PI;
  W.flickerBoost = 0.6;
  S.hud.objective(OPENING.run);
  S.setMarker(0, -3.4, 1.4);
  G.startFP(G.x, G.z, { state: 'stunned' });
  G.noMercy = true;
  G.stunT = 2.6;
  G.stunCd = 99;
  bg(rubberBand(S, G, { min: 0.5, max: 0.95, near: 1.8, far: 7 }));
  await S.until(() => P.z > -3.6 && Math.abs(P.x) < 1.6);
  // inside: he hesitates at the edge of the light
  S.playerSafe = true;
  G.passive = true;
  G.sendTo(0, -8.5, 1.2, 'wait');
  audio.stopLoop('heart', 0.6);
  S.hud.objective(OPENING.console);
  await S.goTo('office_console', { label: OPENING.console, short: UI.interact, hold: 1.3, y: 0.95, radius: 2.2 });
  // systems on
  S.hud.objective(null);
  audio.okBeep?.(0.25);
  audio.bang(0, 0.5);
  S.powerOverride = false;
  W.flickerBoost = 0;
  S.G.gfx.fx.flash = 0.5;
  bg(S.until(() => (S.G.gfx.fx.flash = Math.max(0, S.G.gfx.fx.flash - 0.03)) <= 0));
  audio.hiss?.(0.7);
  G.off();
  S.tensionBase = 0;
  S.clock = 0;
  S.showClock = true;
  S.powerOn = true;
  P.seat();
  await S.say(OPENING.consoleDone);
  S.titleCard();
  await S.say(OPENING.breath);
}

// ---------------------------------------------------------------- 12 → 2 AM
async function officeA(S) {
  const G = S.enemies.gefen;
  const { cap, smiler } = S.allies;
  seat(S, { gefen: true }, { clock: 0, rate: 1.2 });
  fadeIn(S, 0.8);
  if (S.stageIdx === 1 && !S.flags.card) {
    S.flags.card = true;
  }
  bg((async () => {
    await S.wait(2.5);
    S.hud.toast(N1.hints[0], 8);
    await S.wait(10);
    S.hud.toast(N1.hints[1], 8);
    await S.wait(11);
    S.hud.toast(N1.hints[2], 8);
  })());
  // nobody answers
  S.phone.setDial('חייג ליהלי', () => {
    S.phone.setSignal(0, 'Call Failed');
    audio.errorBeep?.(0.15);
    setTimeout(() => S.phone.setSignal(0, 'Reconnecting…'), 1800);
    setTimeout(() => S.phone.setSignal(0, 'No Signal'), 4800);
  });
  await S.clockTo(0.35);
  bg(S.say(N1.tryCall, { block: false }));
  S.phone.setSignal(0, 'Call Failed');
  S.hud.toast('📵 Call Failed', 3, 'warn');
  await S.wait(3);
  S.phone.setSignal(0, 'Reconnecting…');
  S.hud.toast('📶 Reconnecting…', 3);
  await S.wait(4);
  S.phone.setSignal(0, 'No Signal');
  S.hud.toast('📵 No Signal', 3, 'warn');

  // the duo try to reach Gefen: watch it on the cameras
  await S.clockTo(0.9);
  G.hold = true;
  S.clockRun = false;
  G.idx = 0;
  G.placeSpot('g_hall_a');
  put(cap, 'duo_bar_a');
  put(smiler, 'duo_bar_b');
  S.camGlitch('bar');
  S.hud.toast('🎥 ' + N1.camToast, 6, 'warn');
  audio.radioBeep();
  await S.race(S.until(() => S.tabletOpen && [1, 2].includes(S.office.tablet.cam)), S.wait(7));
  await S.say(N1.duo[0], { radio: true });
  put(cap, 'duo_hall_a');
  put(smiler, 'duo_hall_b');
  S.camGlitch('bar');
  S.camGlitch('hall');
  if (S.tabletOpen && S.office.tablet.cam === 2) S.hud.toast('🎥 תנועה במצלמה 1', 4, 'warn');
  await S.say(N1.duo[1], { radio: true });
  G.actor.uniforms.twitch.value = 2;
  S.camGlitch('hall');
  audio.laugh(0.4, 0, 80);
  await S.say(N1.duo[2], { radio: true });
  G.placeAt(-2.4, -28.6, 'hall');
  S.camGlitch('hall');
  await S.say(N1.duo[3], { radio: true });
  audio.running(-0.4, 2.2, 0.3);
  put(cap, 'duo_storage_a');
  put(smiler, 'duo_storage_b');
  S.camGlitch('hall');
  S.camGlitch('storage');
  G.placeSpot('g_hall_c');
  await S.wait(2.4);
  cap.off();
  smiler.off();
  S.camGlitch('storage');
  await S.say(N1.after);
  G.hold = false;
  G.startOffice(G.level, { idx: 1 });
  await S.clockTo(2.0);
}

// ---------------------------------------------------------------- the breaker
async function breaker(S) {
  const P = S.player;
  const G = S.enemies.gefen;
  const W = S.world;
  seat(S, {}, { clock: 2.0 });
  S.clockRun = false;
  S.powerOverride = true;
  W.setPower('blackout');
  S.office.enabled.tablet = false;
  S.powerOn = false;
  fadeIn(S, 0.5);
  audio.powerDown();
  await S.wait(1.2);
  await S.say(N1.powerDown);
  standUp(S);
  S.hud.objective(N1.objBreaker);
  S.hud.toast('הפנס שלך עובד גם בלי חשמל. לחץ עליו כדי להדליק.', 6);
  // he is somewhere in the hall, far away
  G.startFP(-2, -30, { patrol: [[-2, -30], [3, -31], [4, -25]] });
  G.passive = true;
  S.tensionBase = 0.25;
  await S.goTo('breaker', { label: 'פתח את לוח החשמל', short: UI.interact, hold: 0.7, y: 1.5 });
  S.hud.toast(N1.breakerHint, 5);
  await breakerGame(S);
  // light
  S.powerOverride = false;
  S.powerOn = true;
  audio.okBeep?.(0.3);
  audio.bang(0.3, 0.4);
  const bp = W.items.breaker;
  bp.leds.forEach((l) => l.material.color.setRGB(0.2, 3, 0.4));
  bp.lever.rotation.x = -0.6;
  await S.say(N1.breakerDone);
  audio.laugh(0.6, -0.3, 76);
  await S.say(N1.laugh);
  S.hud.objective(N1.objBack);
  S.setMarker(PLAYER.office_stand.x, PLAYER.office_stand.z, 1.0);
  S.tensionBase = 0.6;
  // he comes once you are back in the corridor
  await S.until(() => P.room === 'corr' || P.room === 'office');
  G.passive = false;
  G.placeAt(0, -21.6, 'hall');
  G.state = 'chase';
  G.lastSeen = [P.x, P.z];
  G.loseT = 30;
  audio.sting(0.6);
  audio.running(0, 2.5, 0.4);
  bg(rubberBand(S, G, { min: 0.45, max: 0.9, near: 2, far: 8 }));
  await backToSeat(S);
  S.hud.objective(null);
  G.off();
  P.seat();
  S.office.enabled.tablet = true;
  // he is right there in the corridor: teach the flashlight once more
  G.startOffice(G.level || 5, { idx: 5 });
  G.cool = 0;
  S.tensionBase = 0;
  S.hud.toast(N1.hints[0], 6, 'warn');
  await S.race(S.event('repel'), S.wait(9));
  await S.say(N1.safe);
  S.clock = 2.5;
}

// ---------------------------------------------------------------- 2:30 → 6 AM
async function officeB(S) {
  seat(S, { gefen: true }, { clock: 2.5, rate: 1.4 });
  fadeIn(S, 0.6);
  await S.clockTo(5.7);
  S.world.flickerBoost = 1;
  S.powerOverride = true;
  S.world.setPower('dim');
  audio.staticBurst(0.4, 0.2);
  await S.say(N1.whisper);
  S.powerOverride = false;
  S.world.flickerBoost = 0;
  await S.clockTo(6);
}

export default {
  base,
  stages: [
    { id: 'opening', run: opening },
    { id: 'officeA', run: officeA },
    { id: 'breaker', run: breaker },
    { id: 'officeB', run: officeB },
  ],
};
