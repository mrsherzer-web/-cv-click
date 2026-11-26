// Checks the walk grid: no sealed pockets that matter, every mission point and standing spot reachable from the office.
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.goto((process.env.BASE || 'http://127.0.0.1:8123/gefen2/') + 'dev.html?cam=1&open=storage,vip,cellar,entrance');
  await p.waitForFunction(() => window.__frames > 3);
  const r = await p.evaluate(async () => {
    const L = await import('./src/world/layout.js');
    const nav = window.__world.nav;
    const { w, h, walk } = nav;
    // flood fill from the office front
    const seen = new Uint8Array(w * h);
    const start = nav.idx(0, -1.4);
    const q = [start];
    seen[start] = 1;
    while (q.length) {
      const k = q.pop();
      const i = k % w, j = (k / w) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        const nk = nj * w + ni;
        if (walk[nk] && !seen[nk]) { seen[nk] = 1; q.push(nk); }
      }
    }
    let total = 0, reach = 0;
    const pockets = {};
    for (let k = 0; k < walk.length; k++) if (walk[k]) { total++; if (seen[k]) reach++; else { const x = nav.cx(k % w), z = nav.cz((k / w) | 0); const room = L.roomAt(x, z); pockets[room] = (pockets[room] || 0) + 1; } }
    const near = (x, z, r) => { for (let dz = -r; dz <= r; dz += 0.25) for (let dx = -r; dx <= r; dx += 0.25) { if (dx * dx + dz * dz > r * r) continue; const k = nav.idx(x + dx, z + dz); if (k >= 0 && seen[k]) return true; } return false; };
    const bad = [];
    for (const [k, v] of Object.entries(L.POINTS)) if (!near(v[0], v[1], 1.6)) bad.push('POINT ' + k);
    for (const [k, v] of Object.entries(L.SPOTS)) { if (v[3].startsWith('vent')) continue; if (!near(v[0], v[1], 0.6)) bad.push('SPOT ' + k); }
    // narrow places: door widths in cells
    return { total, reach, pockets, bad };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
  process.exit(r.bad.length ? 1 : 0);
})();
