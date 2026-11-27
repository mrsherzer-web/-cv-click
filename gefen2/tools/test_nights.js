// Plays nights with the autopilot and reports whether each can be completed.
// usage: node gefen2/tools/test_nights.js [nights=1,2,3] [speed=8] [god] [render] [stage=N]
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const args = Object.fromEntries(process.argv.slice(2).map((a) => (a.includes('=') ? a.split('=') : [a, true])));
const nights = String(args.nights || '1').split(',').map(Number);
const speed = +(args.speed || 8);
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  let fail = 0;
  for (const n of nights) {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    page.on('console', (m) => {
      const t = m.text();
      if (t.startsWith('BOTDEATH')) { if (args.deaths) console.log('   ' + t); } else if (m.type() === 'error' || t.startsWith('BOT')) errs.push(m.type() + ' ' + t);
    });
    const q = `night=${n}&stage=${args.stage || 0}&bot&speed=${speed}&mute&dev&q=0${args.god ? '&god' : ''}${args.render ? '' : '&norender'}`;
    await page.goto((process.env.BASE || 'http://127.0.0.1:8123/gefen2/') + 'index.html?' + q);
    const t0 = Date.now();
    let last = '';
    let done = false;
    let deaths = 0;
    let wasDead = false;
    const limit = +(args.limit || 240) * 1000;
    while (Date.now() - t0 < limit) {
      await page.waitForTimeout(1000);
      const st = await page.evaluate(() => {
        const S = window.__g2;
        if (window.__nightDone) return { done: window.__nightDone };
        if (!S) return { scene: window.__scene };
        const e = S.enemies;
        return { stage: S.stageIdx, clock: +S.clock.toFixed(2), mode: S.player.mode, dead: S.dead, by: S.deathBy, pow: Math.round(S.office.power), bat: Math.round(S.player.flash.battery),
          pos: [+S.player.x.toFixed(1), +S.player.z.toFixed(1)], g: e.gefen.mode + ':' + (e.gefen.mode === 'office' ? e.gefen.idx : e.gefen.state || ''), i: e.ido.mode + ':' + (e.ido.idx ?? ''), d: e.dolev.mode + ':' + (e.dolev.idx ?? ''), obj: document.querySelector('.objective:not([hidden])')?.textContent || '', busy: S.busy };
      });
      if (st.dead && !wasDead) { deaths++; console.log(`  n${n} DEATH by ${st.by} at stage ${st.stage} clock ${st.clock}`); }
      wasDead = !!st.dead;
      const line = JSON.stringify(st);
      if (args.verbose || (st.stage !== undefined && `${st.stage}` !== last)) { console.log(`  n${n} t=${((Date.now() - t0) / 1000).toFixed(0)}s ${line}`); last = `${st.stage}`; }
      if (st.done || st.scene === 'ending') { done = true; console.log(`  n${n} final ${line}`); break; }
      if (errs.some((e) => e.startsWith('PAGEERROR'))) break;
    }
    const sec = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(`NIGHT ${n}: ${done ? 'COMPLETED' : 'NOT COMPLETED'} in ${sec}s real, deaths=${deaths}`);
    if (!done) {
      fail++;
      const st = await page.evaluate(() => { const S = window.__g2; return S ? JSON.stringify({ stage: S.stageIdx, clock: S.clock, mode: S.player.mode, pos: [S.player.x, S.player.z], marker: S.marker, uses: S.uses.map((u) => u.id), busy: S.busy, waiters: S.waiters.size, dead: S.dead }) : 'no session'; });
      console.log('  state:', st);
      await page.screenshot({ path: `/tmp/claude-0/-home-user--cv-click/ae32b9bf-e871-5c7f-bad6-ec5051453fcf/scratchpad/fail_n${n}.jpg`, type: 'jpeg', quality: 70 });
    }
    [...new Set(errs)].slice(0, 12).forEach((e) => console.log('  ', e.slice(0, 300)));
    await page.close();
  }
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
