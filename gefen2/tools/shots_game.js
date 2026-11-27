// Stages a few situations in the real game and takes screenshots.
// usage: node gefen2/tools/shots_game.js <outDir> [only]
const { chromium, devices } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const out = process.argv[2];
const only = process.argv[3];
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8123/gefen2/';
const SHOTS = [
  { name: 'office_gefen', q: 'night=3&stage=1', js: `const S=__g2; S.officeAI({gefen:false,ido:false,dolev:false}); S.clockRun=false; const G=S.enemies.gefen; G.mode='script'; G.placeSpot('g_corr_near'); G.actor.show(true); S.G.input.hold('light', true); S.player.yawT=0;` },
  { name: 'office_dark', q: 'night=3&stage=1', js: `const S=__g2; S.officeAI({gefen:false,ido:false,dolev:false}); S.clockRun=false; const G=S.enemies.gefen; G.mode='script'; G.placeSpot('g_corr_mid'); G.actor.show(true); S.player.yawT=0;` },
  { name: 'vent_ido', q: 'night=3&stage=1', js: `const S=__g2; S.officeAI({gefen:false,ido:false,dolev:false}); S.clockRun=false; const I=S.enemies.ido; I.mode='script'; I.actor.setPose('crawl'); I.placeSpot('i_ventL_mouth'); I.actor.show(true); S.player.yawT=1.25; S.player.pitchT=-0.12; S.G.input.hold('light', true);` },
  { name: 'mask', q: 'night=3&stage=1', js: `const S=__g2; S.officeAI({gefen:false,ido:false,dolev:false}); S.clockRun=false; S.player.setMask(true);` },
  { name: 'tablet_cam1', q: 'night=3&stage=1', js: `const S=__g2; S.officeAI({gefen:false,ido:false,dolev:false}); S.clockRun=false; const G=S.enemies.gefen; G.mode='script'; G.placeSpot('g_hall_b'); G.actor.show(true); S.office.toggleTablet(true); S.office.selectCam(1);` },
  { name: 'tablet_fix', q: 'night=3&stage=1', js: `const S=__g2; S.officeAI({gefen:false,ido:false,dolev:false}); S.clockRun=false; S.office.sabotage('cams'); S.office.toggleTablet(true); S.office.setTab('fix'); S.office.startReboot('cams');` },
  { name: 'fp_hall', q: 'night=4&stage=1', js: `const S=__g2; const P=S.player; P.stand(0.5,-23,0); P.flash.toggled=true; const G=S.enemies.gefen; G.hold=true; G.placeAt(-0.5,-27.4); S.enemies.dolev.hold=true; S.enemies.ido.hold=true; S.playerSafe=true;` },
  { name: 'fp_corridor', q: 'night=4&stage=1', js: `const S=__g2; const P=S.player; P.stand(0,-4,0); P.flash.toggled=true; const G=S.enemies.gefen; G.hold=true; G.placeAt(0.2,-10.5); S.enemies.dolev.hold=true; S.playerSafe=true;` },
  { name: 'fp_ido', q: 'night=4&stage=1', js: `const S=__g2; const P=S.player; P.stand(0,-6,0); P.flash.toggled=true; for (const e of Object.values(S.enemies)) { e.hold=true; e.actor.show(false); } const I=S.enemies.ido; I.placeAt(0.3,-10.2); I.actor.setPose('idle'); I.actor.show(true); S.playerSafe=true;` },
  { name: 'fp_dolev', q: 'night=4&stage=1', js: `const S=__g2; const P=S.player; P.stand(0,-6,0); P.flash.toggled=true; for (const e of Object.values(S.enemies)) { e.hold=true; e.actor.show(false); } const D=S.enemies.dolev; D.placeAt(-0.2,-9.4); D.actor.show(true); S.playerSafe=true;` },
  { name: 'fp_three', q: 'night=6&stage=1', js: `const S=__g2; const P=S.player; P.stand(0.5,-22.5,0); P.flash.toggled=true; for (const e of Object.values(S.enemies)) { e.hold=true; } S.enemies.gefen.placeAt(0.4,-27.2); S.enemies.ido.placeAt(-1.6,-26.4); S.enemies.dolev.placeAt(2.4,-26.6); for (const e of Object.values(S.enemies)) e.actor.show(true); S.playerSafe=true;` },
  { name: 'office_left', q: 'night=3&stage=1', js: `const S=__g2; S.officeAI({gefen:false,ido:false,dolev:false}); S.clockRun=false; S.allyInOffice('yahali'); S.allyInOffice('maayan'); S.player.yawT=1.5;` },
  { name: 'office_right', q: 'night=3&stage=1', js: `const S=__g2; S.officeAI({gefen:false,ido:false,dolev:false}); S.clockRun=false; S.allyInOffice('yahali'); S.allyInOffice('maayan'); S.player.yawT=-1.5;` },
  { name: 'office_dolev', q: 'night=3&stage=1', js: `const S=__g2; S.officeAI({gefen:false,ido:false,dolev:false}); S.clockRun=false; const D=S.enemies.dolev; D.mode='script'; D.placeSpot('d_front'); D.actor.show(true); S.G.input.hold('light', true); S.player.yawT=-0.15;` },
  { name: 'cam_duo', q: 'night=1&stage=1', js: `const S=__g2; S.officeAI({gefen:false}); S.clockRun=false; const a=S.allies; a.cap.placeSpot('duo_hall_a'); a.smiler.placeSpot('duo_hall_b'); a.cap.actor.show(true); a.smiler.actor.show(true); const G=S.enemies.gefen; G.mode='script'; G.placeSpot('g_hall_b'); G.actor.show(true); S.office.toggleTablet(true); S.office.selectCam(1);` },
  { name: 'jump_ido', nogod: true, q: 'night=3&stage=1', js: `__g2.kill('ido')`, wait: 700 },
  { name: 'jump_dolev', nogod: true, q: 'night=3&stage=1', js: `__g2.kill('dolev')`, wait: 700 },
  { name: 'jump_gefen', nogod: true, q: 'night=3&stage=1', js: `__g2.kill('gefen')`, wait: 700 },
  { name: 'caught', nogod: true, q: 'night=3&stage=1', js: `__g2.kill('ido')`, wait: 3200 },
  { name: 'fp_allies', q: 'night=4&stage=1', js: `const S=__g2; const P=S.player; P.stand(0.5,-21.5,0); P.flash.toggled=true; for (const e of Object.values(S.enemies)) { e.hold=true; e.actor.show(false); } const a=S.allies; let i=0; for (const k of ['cap','smiler','yahali','maayan']) { a[k].mode='idle'; a[k].placeAt(-2.4+i*1.6,-25.6); a[k].actor.show(true); i++; } S.playerSafe=true;` },
  { name: 'face_ido', q: 'night=3&stage=1', js: `const G=__game; G.gfx.setFace(G.assets.faceTexture('face_ido')); const fx=G.gfx.fx; setInterval(()=>{fx.faceAmt=1; fx.faceScale=1.45; fx.faceX=0; fx.faceY=0; fx.glitch=0.8;},8);`, wait: 600 },
  { name: 'face_dolev', q: 'night=3&stage=1', js: `const G=__game; G.gfx.setFace(G.assets.faceTexture('face_dolev')); const fx=G.gfx.fx; setInterval(()=>{fx.faceAmt=1; fx.faceScale=1.45; fx.faceX=0; fx.faceY=0; fx.glitch=0.8;},8);`, wait: 600 },
  { name: 'face_gefen', q: 'night=3&stage=1', js: `const G=__game; G.gfx.setFace(G.assets.faceTexture('face_gefen')); const fx=G.gfx.fx; setInterval(()=>{fx.faceAmt=1; fx.faceScale=1.45; fx.faceX=0; fx.faceY=0; fx.glitch=0.8;},8);`, wait: 600 },
  { name: 'opening', q: 'night=1&stage=0', js: `void 0`, wait: 2500 },
  { name: 'menu', q: 'scene=menu', js: `void 0` },
  { name: 'phone_office', q: 'night=3&stage=1', device: 'iPhone 13 landscape', js: `const S=__g2; S.officeAI({gefen:false,ido:false,dolev:false}); S.clockRun=false; const G=S.enemies.gefen; G.mode='script'; G.placeSpot('g_corr_near'); G.actor.show(true); S.G.input.hold('light', true);` },
  { name: 'phone_tablet', q: 'night=3&stage=1', device: 'iPhone 13 landscape', js: `const S=__g2; S.officeAI({gefen:false,ido:false,dolev:false}); S.clockRun=false; S.office.toggleTablet(true); S.office.selectCam(5);` },
  { name: 'phone_walk', q: 'night=4&stage=1', device: 'iPhone 13 landscape', js: `const S=__g2; const P=S.player; P.stand(-12,-27,1.2); P.flash.toggled=true; for (const e of Object.values(S.enemies)) e.hold=true; S.playerSafe=true;` },
];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  for (const s of SHOTS) {
    if (only && !only.split(',').includes(s.name)) continue;
    const ctx = await browser.newContext(s.device ? { ...devices[s.device] } : { viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', s.name, e.message));
    page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', s.name, m.text().slice(0, 200)));
    await page.goto(BASE + 'index.html?' + s.q + '&dev&mute' + (s.nogod ? '' : '&god') + (s.device ? '&q=1' : '&q=2'));
    try {
      await page.waitForFunction(() => window.__frames > 5 && (window.__g2 || window.__scene === 'menu'), null, { timeout: 60000 });
      await page.waitForTimeout(900);
      await page.evaluate(s.js);
      await page.waitForTimeout(s.wait || 1800);
    } catch (e) { console.log('ERR', s.name, e.message.slice(0, 200)); }
    await page.screenshot({ path: path.join(out, s.name + '.jpg'), type: 'jpeg', quality: 82 });
    console.log('shot', s.name);
    await ctx.close();
  }
  await browser.close();
})();
