// ============================================================================
//  NIGHT 4 – "משימת החילוץ"
// ============================================================================
import { N4, UI } from '../../story.js';
import { SPOTS, POINTS, PLAYER } from '../../world/layout.js';
import { fadeIn, bg, seat, standUp, backToSeat, put, keypadGame, closeUp, rubberBand, audio } from './common.js';

function base(S, stage) {
  const O = S.office;
  O.enabled = { tablet: true, lure: true, fix: true, kill: true, vents: true };
  S.player.mask.enabled = true;
  S.phone.setSignal(3, '');
  S.allyInOffice('yahali');
  S.allyInOffice('maayan');
  S.world.setDoor('entrance', false, true);
  S.world.setDoor('storage', stage >= 2, true);
  S.world.setDoor('vip', stage >= 3, true);
  if (stage < 2) put(S.allies.cap, 'cap_trapped');
  else S.allyInOffice('cap');
  if (stage < 3) put(S.allies.smiler, 'smiler_trapped');
  else S.allyInOffice('smiler');
  S.balls = stage >= 1 && stage <= 2 ? 3 : -1;
}

/** Yahali watches the cameras and warns you over the radio while you walk. */
function yahaliRadio(S) {
  const { gefen: G, ido: I, dolev: D } = S.enemies;
  let cd = 4;
  let last = '';
  return S.until(() => {
    cd -= 1 / 60;
    if (cd > 0 || S.busy) return false;
    const P = S.player;
    let key = null;
    if (I.mode === 'fp' && I.playerDist() < 7 && !I.watched && !P.mask.on) key = 'idoBehind';
    else if (G.mode === 'fp' && G.state === 'chase') key = null;
    else if (G.mode === 'fp' && G.actor.room === 'corr' && P.room !== 'office') key = 'gefenCorr';
    else if (D.mode === 'fp' && D.playerDist() < 7) key = 'dolevNear';
    else if (G.mode === 'fp' && G.actor.room === 'hall' && (P.room === 'corr' || P.room === 'hall')) key = 'gefenHall';
    else if (last && last !== 'clear') key = 'clear';
    if (key && key !== last) {
      last = key;
      cd = 6;
      S.quick('yahali', N4.yahali[key]);
      audio.radioBeep();
    }
    return false;
  });
}

// ---------------------------------------------------------------- 12 → 1 AM
async function officeA(S) {
  seat(S, { gefen: true, ido: true, dolev: true }, { clock: 0, rate: 1.4 });
  fadeIn(S, 1);
  S.titleCard();
  await S.wait(3.5);
  audio.radioBeep();
  await S.say(N4.radio, { radio: true });
  await S.talk(N4.plan);
  await S.clockTo(1.0);
}

// ---------------------------------------------------------------- the cap guy
async function rescueCap(S) {
  const P = S.player;
  const { gefen: G, ido: I, dolev: D } = S.enemies;
  const cap = S.allies.cap;
  seat(S, {}, { clock: 1.0 });
  fadeIn(S, 0.6);
  standUp(S);
  S.hud.toast('יש לך 3 כדורי סנוקר. זרוק אחד כדי למשוך אויבים לרעש.', 7);
  S.world.items.key.visible = true;
  G.startFP(-3, -31, { patrol: [[-3, -31], [4, -30], [5, -24], [0, -22.5], [-5, -25]] });
  D.startFP(SPOTS.d_home[0], SPOTS.d_home[1], { patrol: [[5.9, -18], [3.2, -16.8], [0.8, -16.5], [3.2, -16.8]] });
  S.tensionBase = 0.3;
  bg(yahaliRadio(S));
  S.hud.objective(N4.objKey);
  await S.goTo('bar_key', { label: 'קח את המפתח', short: UI.interact, hold: 0.6, y: 1.15 });
  S.world.items.key.visible = false;
  audio.okBeep?.(0.2);
  bg(S.say(N4.gotKey, { block: false }));
  // Ido starts stalking once you have the key
  I.startFP(SPOTS.i_home[0], SPOTS.i_home[1]);
  S.hud.toast('עידו זז רק כשלא מסתכלים עליו. מסכה גורמת לו להתעלם ממך.', 7, 'warn');
  S.hud.objective(N4.objStorage);
  await S.goTo('storage_door', { label: 'פתח את המחסן', short: UI.hold, hold: 1.6, y: 1.2 });
  S.world.setDoor('storage', true);
  audio.doorOpen(-0.4);
  cap.startFollow(SPOTS.cap_trapped[0], SPOTS.cap_trapped[1]);
  cap.state = 'ok';
  bg(S.say(N4.capFree, { block: false }));
  S.hud.objective(N4.objEscortCap);
  S.hud.toast(N4.yahali.clear ? 'אל תתרחק ממנו. אם אויב מגיע אליו, הוא נפגע.' : '', 6);
  const offHurt = S.on('hurt', (e) => e.who === 'cap' && S.hud.toast(`בעל הבקבוק ${N4.hurt}!`, 4, 'warn'));
  S.setMarker(PLAYER.office_stand.x, PLAYER.office_stand.z, 1);
  await S.until(() => P.z > -2.3 && Math.abs(P.x) < 3.2 && cap.playerDist() < 6 && cap.z > -6);
  offHurt();
  S.setMarker(null);
  S.playerSafe = true;
  S.flags.cap = cap.state;
  S.allyInOffice('cap');
  await S.say(N4.capSafe);
  S.hud.objective(null);
}

// ---------------------------------------------------------------- the smiler
async function rescueSmiler(S) {
  const P = S.player;
  const { gefen: G, ido: I, dolev: D } = S.enemies;
  const smiler = S.allies.smiler;
  S.clock = 2.5;
  S.clockRun = false;
  S.showClock = true;
  S.officeAI({ gefen: false, ido: false, dolev: false });
  P.stand(0, -1.4, 0);
  fadeIn(S, 0.5);
  S.world.items.note.visible = true;
  G.startFP(4, -30, { patrol: [[4, -30], [-4, -31], [-5, -24], [0, -22.5], [5, -25]] });
  D.startFP(SPOTS.d_home[0], SPOTS.d_home[1], { patrol: [[5.9, -18], [3.2, -16.8], [0.8, -16.5], [3.2, -16.8]] });
  I.startFP(-4, -17);
  S.tensionBase = 0.3;
  bg(yahaliRadio(S));
  S.hud.objective(N4.objNote);
  await S.goTo('arcade_note', { label: 'קרא את הפתק', short: UI.interact, hold: 0.8, y: 1.45 });
  bg(S.say(N4.gotNote, { block: false }));
  S.hud.objective(N4.objVip);
  for (;;) {
    await S.goTo('vip_keypad', { label: 'הקש קוד', short: UI.interact, hold: 0.3, y: 1.35 });
    G.hold = I.hold = D.hold = true;
    const ok = await keypadGame(S, '1947');
    G.hold = I.hold = D.hold = false;
    if (ok) break;
  }
  S.world.items.vip_keypad.led.material.color.setRGB(0.2, 2.4, 0.4);
  S.world.setDoor('vip', true);
  audio.doorOpen(0);
  smiler.startFollow(SPOTS.smiler_trapped[0], SPOTS.smiler_trapped[1]);
  smiler.state = 'ok';
  await S.say(N4.smilerFree);
  // ambush
  G.placeAt(3.5, -30.5, 'hall');
  G.state = 'stunned';
  G.stunT = 2.2;
  G.stunCd = 0;
  audio.sting(0.6);
  audio.braam(0.5);
  S.tensionBase = 0.7;
  bg(S.say(N4.ambush, { block: false }));
  bg(rubberBand(S, G, { min: 0.7, max: 1, near: 2, far: 9 }));
  G.lastSeen = [P.x, P.z];
  S.hud.objective(N4.objEscortSmiler);
  const offHurt = S.on('hurt', (e) => e.who === 'smiler' && S.hud.toast(`החייכן ${N4.hurt}!`, 4, 'warn'));
  S.setMarker(PLAYER.office_stand.x, PLAYER.office_stand.z, 1);
  // half way down the corridor Ido is standing in the way
  await S.until(() => P.room === 'corr' && P.z > -14.5);
  G.hold = true;
  D.hold = true;
  G.state = 'wait';
  G.passive = true;
  S.busy = true;
  P.freeze(true);
  S.playerSafe = true;
  audio.staticBurst(0.3, 0.2);
  const played = await S.clip('n4_ido', { max: 9 });
  if (!played) {
    await closeUp(S, I, { dist: 1.9, dur: 0.6 });
    I.actor.eyeBase = 0;
    I.actor.flicker = 1;
    I.actor.uniforms.twitch.value = 1.8;
  }
  await S.say(N4.ido);
  I.actor.eyeBase = 3.4;
  I.actor.uniforms.twitch.value = 2.4;
  S.G.gfx.fx.glitch = 1;
  audio.scream(0.5);
  await S.wait(0.7);
  I.off();
  audio.ventThump?.(-0.7, 0.6);
  S.busy = false;
  P.freeze(false);
  S.playerSafe = false;
  bg(S.say(N4.idoAfter, { block: false, radio: true }));
  G.hold = false;
  D.hold = false;
  G.passive = false;
  G.state = 'chase';
  G.loseT = 20;
  G.lastSeen = [P.x, P.z];
  await S.until(() => P.z > -2.3 && Math.abs(P.x) < 3.2 && smiler.playerDist() < 6 && smiler.z > -6);
  offHurt();
  S.setMarker(null);
  S.playerSafe = true;
  S.flags.smiler = smiler.state;
  S.allyInOffice('smiler');
  G.off();
  D.off();
  S.tensionBase = 0;
  P.seat();
  await S.say(N4.smilerSafe);
  S.hud.objective(null);
  S.clock = 4.5;
}

// ---------------------------------------------------------------- 4:30 → 6
async function officeB(S) {
  seat(S, { gefen: true, ido: true, dolev: true }, { clock: 4.5, rate: 1.3 });
  fadeIn(S, 0.6);
  await S.clockTo(6);
}

export default {
  base,
  stages: [
    { id: 'officeA', run: officeA },
    { id: 'rescueCap', run: rescueCap },
    { id: 'rescueSmiler', run: rescueSmiler },
    { id: 'officeB', run: officeB },
  ],
};
