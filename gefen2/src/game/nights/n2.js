// ============================================================================
//  NIGHT 2 – "החברים בדרך"
// ============================================================================
import { N2, UI } from '../../story.js';
import { SPOTS } from '../../world/layout.js';
import { AI } from '../../config.js';
import { fadeIn, bg, seat, standUp, backToSeat, put, audio } from './common.js';

function base(S, stage) {
  const O = S.office;
  O.enabled = { tablet: true, lure: false, fix: false, kill: false, vents: false };
  S.player.mask.enabled = false;
  S.balls = -1;
  S.phone.setSignal(3, '');
  S.world.setDoor('storage', stage < 1, true);
  S.world.setDoor('vip', stage < 1, true);
  S.world.setDoor('entrance', false, true);
}

// ---------------------------------------------------------------- 12 → 2 AM
async function officeA(S) {
  const G = S.enemies.gefen;
  const { cap, smiler } = S.allies;
  seat(S, { gefen: true }, { clock: 0, rate: 1.3 });
  S.phone.setSignal(0, 'Reconnecting…');
  fadeIn(S, 1);
  S.titleCard();
  await S.wait(4);
  // the signal is back: the call
  S.phone.setSignal(3, '');
  S.hud.toast('📶 ' + N2.signal, 4);
  G.hold = true;
  await S.race(S.phone.ring('יהלי · מעיין'), S.wait(S.G.dev.bot ? 0.5 : 14));
  S.phone.answer();
  S.clockRun = false;
  await S.talk(N2.call, { radio: true });
  S.phone.hangup();
  G.hold = false;
  S.clockRun = true;

  await S.clockTo(0.7);
  S.phone.message(...N2.msgs[0]);
  await S.clockTo(1.1);
  S.phone.setSignal(0, 'No Signal');
  S.hud.toast('📵 No Signal', 3, 'warn');

  // second chase: the duo go for the black ball
  await S.clockTo(1.35);
  G.hold = true;
  S.clockRun = false;
  G.idx = 1;
  G.placeSpot('g_hall_b');
  put(cap, 'duo_hall_a');
  put(smiler, 'duo_hall_b');
  S.camGlitch('hall');
  S.hud.toast('🎥 תנועה במצלמה 1', 6, 'warn');
  audio.radioBeep();
  await S.race(S.until(() => S.tabletOpen && S.office.tablet.cam === 1), S.wait(7));
  await S.say(N2.duo[0], { radio: true });
  await S.say(N2.duo[1], { radio: true });
  G.placeAt(-0.6, -26.2, 'hall');
  G.actor.uniforms.twitch.value = 2;
  S.camGlitch('hall');
  audio.laugh(0.45, 0, 78);
  await S.say(N2.duo[2], { radio: true });
  await S.say(N2.duo[3], { radio: true });
  audio.running(-0.5, 2, 0.3);
  put(cap, 'cap_trapped');
  put(smiler, 'smiler_trapped');
  S.world.setDoor('storage', false);
  S.world.setDoor('vip', false);
  audio.doorSlam(-0.6);
  S.camGlitch('hall');
  S.camGlitch('storage');
  S.camGlitch('vip');
  G.placeSpot('g_hall_c');
  await S.wait(2);
  G.hold = false;
  G.startOffice(G.level, { idx: 2 });
  S.clockRun = true;

  await S.clockTo(1.7);
  S.phone.setSignal(1, 'Reconnecting…');
  await S.wait(3);
  S.phone.setSignal(2, '');
  S.phone.message(...N2.msgs[1]);
  await S.clockTo(2.0);
}

// ---------------------------------------------------------------- entrance system
async function entrance(S) {
  const P = S.player;
  const G = S.enemies.gefen;
  const { cap, smiler } = S.allies;
  seat(S, {}, { clock: 2.0 });
  S.clockRun = false;
  put(cap, 'cap_trapped');
  put(smiler, 'smiler_trapped');
  fadeIn(S, 0.6);
  S.phone.setSignal(2, '');
  S.phone.message(...N2.outside);
  await S.wait(2.5);
  standUp(S);
  S.hud.objective(N2.objPanel);
  S.hud.toast('גפן מסתובב באולם. במסדרון עדיף לכבות את הפנס.', 6);
  G.startFP(-3, -30, { patrol: [[-3, -30], [3, -25], [0, -22.6], [0, -19], [0, -22.6], [4, -31]] });
  S.tensionBase = 0.3;
  const pan = S.world.items.entrance_panel;
  let alerted = false;
  bg(S.until(() => {
    // half way through the reboot the panel beeps loudly
    if (!alerted && P.use.target?.id === 'entrance_panel' && P.use.progress > 0.5) {
      alerted = true;
      audio.errorBeep?.(0.35);
      audio.okBeep?.(0.3);
      S.makeNoise(P.x, P.z, 1);
      S.hud.toast('הפאנל מצפצף. הוא שמע.', 4, 'warn');
    }
    return false;
  }));
  await S.goTo('entrance_panel', { label: 'אתחל את מערכת הכניסה', short: UI.hold, hold: 4, y: 1.4 });
  pan.screen.color.setRGB(0.1, 1.6, 0.3);
  audio.okBeep?.(0.3);
  bg(S.say(N2.panelDone, { block: false }));
  S.hud.objective(N2.objBack);
  await backToSeat(S);
  S.hud.objective(null);
  G.off();
  P.seat();
  S.tensionBase = 0;
  S.clock = 3.0;
}

// ---------------------------------------------------------------- 3 → 5 AM
async function officeB(S) {
  const { cap, smiler } = S.allies;
  seat(S, { gefen: AI.gefen.level[2] + 1 }, { clock: 3.0, rate: 1.5 });
  put(cap, 'cap_trapped');
  put(smiler, 'smiler_trapped');
  S.world.items.entrance_panel.screen.color.setRGB(0.1, 1.6, 0.3);
  fadeIn(S, 0.6);
  await S.clockTo(4.0);
  S.phone.message(...N2.msgs[2]);
  await S.clockTo(5.0);
}

// ---------------------------------------------------------------- rescue
async function rescue(S) {
  const G = S.enemies.gefen;
  const { yahali, maayan, cap, smiler } = S.allies;
  seat(S, { gefen: AI.gefen.level[2] + 3 }, { clock: 5.0, rate: 0.6 });
  S.clockRun = false;
  put(cap, 'cap_trapped');
  put(smiler, 'smiler_trapped');
  put(yahali, 'entrance_out_a');
  put(maayan, 'entrance_out_b');
  S.world.items.entrance_panel.screen.color.setRGB(0.1, 1.6, 0.3);
  fadeIn(S, 0.6);
  audio.glassKnock?.(5, 0.5);
  await S.wait(1.2);
  await S.say(N2.knock, { radio: true });
  audio.glassKnock?.(4, 0.5);
  S.hud.objective(N2.objOpen);
  // open the door from the tablet while looking at camera 4
  await new Promise((res, rej) => {
    const w = { fn: () => false, res, rej, off: () => S.hud.action('door', null) };
    S.waiters.add(w);
    S.hud.action('door', UI.openDoor, () => {
      if (!(S.tabletOpen && S.office.tablet.cam === 4)) {
        S.hud.toast('פתח קודם את מצלמה 4 בטאבלט', 3, 'warn');
        audio.errorBeep?.(0.12);
        return;
      }
      S.hud.action('door', null);
      S.waiters.delete(w);
      res();
    });
  });
  S.world.setDoor('entrance', true);
  audio.doorOpen(0.5);
  yahali.runTo(SPOTS.lobby_in_a[0], SPOTS.lobby_in_a[1], 2.6);
  maayan.runTo(SPOTS.lobby_in_b[0], SPOTS.lobby_in_b[1], 2.6);
  S.camGlitch('lobby');
  await S.wait(2.2);
  S.world.setDoor('entrance', false);
  await S.say(N2.inside, { radio: true });
  // now clear the corridor and call them over
  S.hud.objective(N2.objRun);
  let ok = false;
  await new Promise((res, rej) => {
    const w = { fn: () => false, res, rej, off: () => S.hud.action('run', null) };
    S.waiters.add(w);
    S.hud.action('run', UI.runNow, () => {
      S.hud.action('run', null);
      S.waiters.delete(w);
      ok = G.idx <= 3;
      res();
    });
  });
  S.hud.objective(null);
  bg(S.say(N2.go, { block: false }));
  G.hold = true;
  if (!ok) {
    S.hud.toast(N2.caughtThem, 4, 'warn');
    await S.wait(0.9);
    S.kill('rescue');
    await S.wait(10);
  }
  audio.running(0.3, 3, 0.4);
  yahali.runTo(-1.2, -1.4, 4.2);
  maayan.runTo(1.2, -1.2, 4.0);
  await S.race(S.until(() => yahali.mode === 'idle' && maayan.mode === 'idle'), S.wait(9));
  S.allyInOffice('yahali');
  S.allyInOffice('maayan');
  G.hold = false;
  S.clockRate = 1.6;
  S.clock = 5.55;
  S.clockRun = true;
  await S.wait(1.5);
  await S.clockTo(5.9);
  G.off();
  S.clockRun = false;
  await S.talk(N2.six);
  S.clock = 6;
}

export default {
  base,
  stages: [
    { id: 'officeA', run: officeA },
    { id: 'entrance', run: entrance },
    { id: 'officeB', run: officeB },
    { id: 'rescue', run: rescue },
  ],
};
