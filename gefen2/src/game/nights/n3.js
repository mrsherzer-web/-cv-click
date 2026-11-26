// ============================================================================
//  NIGHT 3 – "החברים שהשתנו"
// ============================================================================
import { N3 } from '../../story.js';
import { CAMS } from '../../world/layout.js';
import { fadeIn, bg, seat, put, audio } from './common.js';

function base(S, stage) {
  const O = S.office;
  const full = stage > 0;
  O.enabled = { tablet: true, lure: full, fix: full, kill: full, vents: full };
  S.player.mask.enabled = full;
  S.balls = -1;
  S.phone.setSignal(3, '');
  S.allyInOffice('yahali');
  S.allyInOffice('maayan');
  S.world.setDoor('storage', false, true);
  S.world.setDoor('vip', false, true);
  S.world.setDoor('entrance', false, true);
  put(S.allies.cap, 'cap_trapped');
  put(S.allies.smiler, 'smiler_trapped');
}

// ---------------------------------------------------------------- the reveal
async function reveal(S) {
  const { ido: I, dolev: D, gefen: G } = S.enemies;
  const O = S.office;
  seat(S, { gefen: true }, { clock: 0, rate: 1.2 });
  fadeIn(S, 1);
  S.titleCard();
  await S.wait(3.5);
  await S.talk(N3.start);
  await S.clockTo(0.3);
  // Ido in the arcade
  G.hold = true;
  S.clockRun = false;
  put(I, 'i_home');
  I.actor.flicker = 0.4;
  S.camGlitch('arcade');
  await S.say(N3.look7);
  S.hud.toast('🎥 פתח את מצלמה 7', 6, 'warn');
  if (S.scene.bot) S.scene.bot.wantCam = 7;
  await S.race(S.until(() => S.tabletOpen && O.tablet.cam === 7), S.wait(9));
  await S.wait(0.8);
  audio.sting(0.4);
  await S.say(N3.ido);
  // Dolev at the breakers
  put(D, 'd_home');
  S.camGlitch('elec');
  S.hud.toast('🎥 תנועה במצלמה 6', 6, 'warn');
  if (S.scene.bot) S.scene.bot.wantCam = 6;
  await S.race(S.until(() => S.tabletOpen && O.tablet.cam === 6), S.wait(8));
  audio.zap?.(0.2, 0.25);
  await S.say(N3.dolev);
  if (S.scene.bot) S.scene.bot.wantCam = null;
  await S.talk(N3.after);
  // the mask + the new tools
  await S.say(N3.mask);
  S.player.mask.enabled = true;
  O.enabled = { tablet: true, lure: true, fix: true, kill: true, vents: true };
  audio.okBeep?.(0.2);
  S.hud.toast(N3.tipIdo, 10);
  await S.wait(4.5);
  S.hud.toast(N3.tipDolev, 11);
  await S.wait(3);
  G.hold = false;
  S.officeAI({ ido: true, dolev: true });
  S.clockRun = true;
  await S.clockTo(1.2);
}

// ---------------------------------------------------------------- 1:12 → 3:30
async function officeA(S) {
  seat(S, { gefen: true, ido: true, dolev: true }, { clock: 1.2, rate: 1.2 });
  fadeIn(S, 0.6);
  await S.clockTo(3.5);
}

// ---------------------------------------------------------------- 3:30 → 6
async function officeB(S) {
  const { gefen: G, ido: I, dolev: D } = S.enemies;
  const O = S.office;
  seat(S, { gefen: true, ido: true, dolev: true }, { clock: 3.5, rate: 1.25 });
  fadeIn(S, 0.6);
  await S.wait(3);
  bg(S.say(N3.mid, { block: false }));
  await S.clockTo(5.75);
  // every camera dies, then one comes back with him in it
  S.clockRun = false;
  G.hold = I.hold = D.hold = true;
  S.playerSafe = true;
  if (I.idx === 5) I.leave();
  if (D.idx === 5) D.leave();
  if (G.idx >= 5) G.retreat();
  S.busy = true;
  O.toggleTablet(false);
  audio.staticBurst(0.8, 0.3);
  await S.say(N3.camsDie);
  const played = await S.clip('n3_stare', { preset: 'clipCam', max: 9 });
  if (!played) {
    // in-engine: he walks up to camera 1 and stares into it
    const c = CAMS[0];
    const cam = S.cctv;
    cam.position.set(...c.pos);
    cam.lookAt(...c.look);
    cam.fov = c.fov;
    cam.updateProjectionMatrix();
    S.cine = { cam, room: 'hall', preset: 'cctv' };
    G.mode = 'script';
    G.placeAt(4.4, -25.2, 'hall');
    G.actor.show(true);
    S.camGlitch('hall');
    S.G.gfx.fx.glitch = 0.9;
    await S.wait(1.6);
    G.placeAt(6.6, -23.4, 'hall');
    S.G.gfx.fx.glitch = 1;
    audio.staticBurst(0.3, 0.3);
    await S.wait(1.2);
    G.placeAt(7.55, -22.55, 'hall');
    G.actor.setY(1.35);
    G.actor.uniforms.twitch.value = 2;
    S.G.gfx.fx.glitch = 1;
    audio.sting(0.6);
    await S.wait(0.6);
  }
  await S.say(N3.stare);
  S.cine = null;
  S.G.gfx.fx.glitch = 1;
  audio.staticBurst(0.5, 0.35);
  S.busy = false;
  S.officeAI({ gefen: false, ido: false, dolev: false });
  S.clockRate = 2;
  S.clockRun = true;
  await S.clockTo(6);
}

export default {
  base,
  stages: [
    { id: 'reveal', run: reveal },
    { id: 'officeA', run: officeA },
    { id: 'officeB', run: officeB },
  ],
};
