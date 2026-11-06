// Chapter eight, mission 5, "הקרב על הגשר". Out of the Iron Base, the great bridge: Kotzi's people hold the
// deck in waves behind the abandoned cars, drums go up, then his armoured car at the east end, whose
// turret watches the deck (stay in its sight and it marks you) and whose three sensors are the way to
// stop it; a last wave from the east, and the span gives way: Nehorai runs for it and jumps across,
// Erez is left hanging at the edge, and the player pulls him up. Paint, fire and dust; nobody falls for real.
import { near, say, nearestGuard } from './missions.js';
import { TEAM, crew, armCrew, endCrew, failOut, arriveCrew, Blast, Work, hideGuards, attempt, handsOver } from './firestorm.js';

const G = (game) => game.world.places.bridge;
const W1 = [['fg1', 'w1'], ['fg2', 'w2'], ['fg3', 'w3'], ['fg4', 'w4'], ['fg5', 'w5']];
const W2 = [['fg6', 'v1'], ['fg7', 'v2'], ['fg8', 'v3'], ['fg9', 'v4'], ['fg10', 'v5'], ['fg11', 'v6']];
const W3 = [['fg12', 'e1'], ['guard1', 'e2'], ['guard2', 'e3'], ['guard3', 'e4'], ['guard4', 'e5'], ['vg1', 'e6']];
const ALL = [...W1, ...W2, ...W3];
const ids = (list) => list.map((g) => g[0]);

const OPEN = [['ארז', 'הם חוסמים את המעבר.'], ['נהוראי', 'אז נעבור דרכם.'], ['עידו', 'מאחורי המכוניות. אחד אחד. ולא לעמוד באמצע.']];
const WAVE2 = [['מולר', 'עוד גל! מאחורי המכוניות באמצע!']];
const ARMOUR = [['ארז', 'רכב משוריין! הצריח רואה את כל הגשר — לא לעמוד מולו!'], ['עידו', 'שלושה חיישנים אדומים, מקדימה ובצדדים. תפגע בשלושתם.']];
const ARMOUR_DOWN = [['ליאם', 'אחים! הוא נשרף!'], ['דולב', 'אני לא מתקרב לזה.']];
const WAVE3 = [['עידו', 'מהצד המזרחי! הגל האחרון!']];
const COLLAPSE = [['עידו', 'הגשר! הוא לא יחזיק! כולם מזרחה, עכשיו!']];
const HANG = [['ארז', 'נהוראי!']];
const SAVED = [['ארז', 'זהו, אנחנו תיקו על החילוץ שלך.'], ['נהוראי', 'לא אחי, אתה עדיין חייב לי.']];
const DRIVE = [['עידו', 'שם! הרכב השחור בקצה הגשר — זה קוצי!']];

// a wave: these people at their posts, on their feet (the others as they are)
function wave(game, place, list) {
  const P = game.paint;
  for (const [id, route] of list) {
    const n = game.npc(id), pts = place.patrols[route];
    n.floorY = null; n.target = null; n.place(pts[0].x, pts[0].z, Math.PI * 1.5, place.y); n.idle = null; n.model.setPose(null); n.show(true);
    const had = P.guards.find((g) => g.npc === n);
    if (had) { P.setRoute(had, pts.map((p) => ({ x: p.x, z: p.z })), { still: true }); P.revive(had); }
    else P.addGuard(n, pts.map((p) => ({ x: p.x, z: p.z })), undefined, { quick: true, still: true });
  }
}
const standing = (game, list) => game.paint.guards.filter((g) => ids(list).includes(g.npc.id) && !g.marked && g.npc.visible).length;
function armourReset(m, game) {
  const a = G(game).armour;
  a.gun.setOn(false);
  for (const s of a.sensors) { s.mesh.material.emissiveIntensity = 0.9; s.mesh.visible = true; }
  game.paint.clearProps(); m.props = [];
  m.s.armourDown = false; m.s.seen = 0; m.s.cool = 0;
}
function armourOn(m, game) {
  const a = G(game).armour;
  game.paint.clearProps();
  m.s.seen = 0; m.s.cool = 0; m.s.armourDown = false;
  a.gun.setOn(true);
  m.props = a.sensors.map((s) => game.paint.addProp({ x: s.x, y: s.y, z: s.z, r: 0.42, hits: 1, label: 'חיישן', onHit: (pr) => { s.mesh.material.emissiveIntensity = 0; game.fx.sparks(s.x, s.y, s.z, 16); } }));
}
// the jump, inside the collapse cutscene (no control): from the west edge Nehorai runs across the span,
// takes off from its far end as it gives way under him and lands on the east side. `t`: seconds since it began
const RUN = 1.5, LEAP = 0.7;
function leap(game, t) {
  const g = G(game), P = game.player, a = g.edge.west, e = g.edge.east;
  const b = { x: e.x + 2.2, z: e.z - 1.5 }, off = e.x - 4; // where he lands; where he takes off
  const u = Math.min(1, Math.max(0, (t - RUN) / LEAP));
  const x = t < RUN ? a.x + (off - a.x) * Math.max(0, t) / RUN : off + (b.x - off) * u, z = a.z + (b.z - a.z) * (x - a.x) / (b.x - a.x);
  // his height is set here: once the span is down the ground under the gap is the ravine floor
  P.place(x, z, Math.PI / 2, g.y); P.pos.y = P.visualY = g.y + Math.sin(Math.PI * u) * 1.1; P.sync();
  P.vel.x = (off - a.x) / RUN; // the controller reads this next frame, so his legs run
  game.follow.override?.look.set(x, P.pos.y + 1, z);
}
// where the others wait across the span (by the index in the squad; Erez is the one left at the edge)
const across = (g, i) => ({ x: g.edge.east.x + 4 + (i % 3) * 1.2, z: g.edge.east.z - 3 + Math.floor(i / 3) * 1.6 });

export default {
  id: 'bridge', chapter: 8, number: 5, title: 'הקרב על הגשר', requires: ['blackout'],
  follows: true,
  where: 'בקצה המערבי של הגשר הגדול',
  startAt: (game) => { const g = G(game); return g ? { x: g.west.x, z: g.west.z, y: g.y } : null; },
  reward: { money: 900, unlocks: ['bridge'], text: 'עברתם את הגשר · 900 ₪' },

  setup(m, game) { m.s = {}; m.live = []; m.props = []; game.daylight?.set(0, 0); },
  prepareReplay(game) { if (game.mode === 'car') game.exitCar(); const g = G(game); game.start(g.west.x, g.west.z, g.west.yaw); game.daylight?.set(0, 0); },
  failIf(m, game) { return failOut(m, game, [1, 2, 3, 4]); },
  restore(m, game, checkpoint) {
    const g = G(game);
    game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
    for (const x of m.live || []) x.cancel(); m.live = []; m.work?.cancel(); m.work = null; game.fx.clear();
    if (game.mode === 'car') game.exitCar();
    g.span.restore(); armourReset(m, game);
    const at = checkpoint >= 4 ? { ...g.toWorld(4, 0), yaw: Math.PI / 2 } : checkpoint === 3 ? { ...g.toWorld(-6, 0), yaw: Math.PI / 2 } : checkpoint === 2 ? { ...g.toWorld(-16, 0), yaw: Math.PI / 2 } : g.westDeck;
    game.player.place(at.x, at.z, at.yaw, g.y); game.follow.snapBehind(at.yaw);
    crew(game, game.player.pos, at.yaw);
    game.paint.dispose(); armCrew(game);
    hideGuards(game, ids(ALL));
    wave(game, g, W1); if (checkpoint >= 2) wave(game, g, W2); if (checkpoint >= 4) wave(game, g, W3);
    for (const gd of game.paint.guards) { const id = gd.npc.id; if ((checkpoint >= 2 && ids(W1).includes(id)) || (checkpoint >= 3 && ids(W2).includes(id))) game.paint.markGuard(gd, 'restore'); }
    game.paint.hits = 0; game.hud.paintClear();
    if (checkpoint >= 4) { m.s.armourDown = true; for (const s of g.armour.sensors) s.mesh.material.emissiveIntensity = 0; }
    m.s = { ...m.s, wave2Said: checkpoint >= 2, armourSaid: checkpoint >= 3, wave3Said: checkpoint >= 4, boomT: m.t + 8, collapse: null, saved: false };
  },
  cleanup(m, game) {
    const g = G(game);
    game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false);
    for (const x of m.live || []) x.cancel(); m.live = []; m.work?.cancel(); m.work = null;
    armourReset(m, game); g.span.restore();
    game.paint.dispose(); hideGuards(game, ids(ALL));
    game.npc('erez').model.setPose(null);
    if (!m.done || !handsOver(game)) endCrew(game);
  },

  steps: [
    { // 0: at the west end
      objective: 'הגשר הגדול',
      enter(m, game) {
        const g = G(game);
        game.cutscene = true; game.hud.setCinematic(true);
        arriveCrew(game, g.west);
        game.paint.dispose(); hideGuards(game, ids(ALL));
        wave(game, g, W1);
        game.follow.shot({ x: g.west.x - 4, y: g.y + 3.4, z: g.west.z + 6 }, { x: g.mid.x, y: g.y + 1.2, z: g.mid.z }, 9999);
        game.hud.banner('הגשר הגדול', '06:20', 'אנשי קוצי חוסמים את המעבר', 3000);
        const live = attempt(game, m); game.dialogue.play(OPEN).then(() => { if (live()) m.s.ready = true; });
      },
      update: (m) => (m.s.ready ? 'next' : null),
      exit(m, game) { game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(game.player.yaw); armCrew(game); game.paint.reset(); m.s.boomT = m.t + 6; },
    },
    { // 1: the first wave
      objective: 'הגל הראשון · מאחורי המכוניות', checkpoint: true,
      enter(m, game) { m.s.boomT = 6; },
      target: (m, game) => nearestGuard(game, ids(W1)),
      update(m, game, dt) {
        const g = G(game), n = standing(game, W1);
        if (m.t > m.s.boomT) { m.s.boomT = m.t + 9 + Math.random() * 5; const d = g.drums[Math.floor(Math.random() * g.drums.length)]; if (!near(game.player.pos, d, 6)) m.live.push(new Blast(game, { at: d, size: 1.5, warn: 1.4, radius: 3, fire: 14 })); }
        for (const x of m.live) x.update(dt);
        say(m, game, `הגל הראשון: לסמן אותם (${W1.length - n}/${W1.length}) · לא לעמוד באמצע · סומנת ${game.paint.hits}/3`);
        return n === 0 ? 'next' : null;
      },
    },
    { // 2: the second wave
      objective: 'הגל השני · באמצע הגשר', checkpoint: true,
      enter(m, game) { wave(game, G(game), W2); game.dialogue.play(WAVE2); m.s.boomT = 7; },
      target: (m, game) => nearestGuard(game, ids(W2)),
      update(m, game, dt) {
        const g = G(game), n = standing(game, W2);
        if (m.t > m.s.boomT) { m.s.boomT = m.t + 10 + Math.random() * 5; const me = game.player.pos; m.live.push(new Blast(game, { at: { x: me.x + 12, y: g.y, z: g.z + (Math.random() < 0.5 ? -5 : 5) }, size: 1.3, warn: 1.6, radius: 3, fire: 10 })); }
        for (const x of m.live) x.update(dt);
        say(m, game, `הגל השני: לסמן אותם (${W2.length - n}/${W2.length}) · סומנת ${game.paint.hits}/3`);
        return n === 0 ? 'next' : null;
      },
    },
    { // 3: the armoured car: out of the turret's sight, the three sensors
      objective: 'הרכב המשוריין · שלושה חיישנים', checkpoint: true,
      enter(m, game) { armourOn(m, game); game.dialogue.play(ARMOUR); },
      target(m, game) { const s = (m.props || []).find((p) => !p.done); return s ? { x: s.x, z: s.z, y: s.y - 1.6, r: 1.2 } : null; },
      update(m, game, dt) {
        const g = G(game), a = g.armour, me = game.player.pos;
        for (const x of m.live) x.update(dt); // a blast left from the second wave finishes its warning here
        // the turret: in its sight a beep each second, and a mark after two and a half
        if (!m.s.armourDown && game.mode === 'foot') {
          m.s.cool = Math.max(0, m.s.cool - dt);
          if (a.gun.sees(game.world, me.x, me.z) && m.s.cool <= 0) {
            const before = m.s.seen; m.s.seen += dt;
            if (Math.floor(m.s.seen) > Math.floor(before)) game.sound?.beep?.(1, 1300);
            if (m.s.seen > 2.5) { m.s.seen = 0; m.s.cool = 1.4; game.paint.strike('הצריח!', '#ff4a4a'); game.fx.sparks(a.gun.pos.x, a.gun.pos.y, a.gun.pos.z, 8); }
          } else m.s.seen = Math.max(0, m.s.seen - dt * 1.5);
        }
        const done = (m.props || []).filter((p) => p.done).length;
        if (!m.s.armourDown && m.props.length && done === m.props.length) {
          m.s.armourDown = true;
          a.gun.setOn(false);
          game.fx.explode(a.x, a.y + 1, a.z, { size: 2.6, fire: 40 });
          setTimeout(() => game.fx.explode(a.x - 2, a.y + 2, a.z + 1, { size: 1.6, sound: false }), 400);
          game.hud.banner('', 'הרכב המשוריין בחוץ', '', 2000);
          game.dialogue.play(ARMOUR_DOWN);
        }
        say(m, game, m.s.armourDown ? 'הרכב המשוריין בחוץ' : `הרכב המשוריין: לפגוע בחיישנים (${done}/3) · להישאר מחוץ לקונוס האדום · סומנת ${game.paint.hits}/3`);
        return m.s.armourDown && !game.dialogue.busy ? 'next' : null;
      },
    },
    { // 4: the last wave, from the east end
      objective: 'הגל האחרון · מהצד המזרחי', checkpoint: true,
      enter(m, game) { wave(game, G(game), W3); game.dialogue.play(WAVE3); game.paint.clearProps(); },
      target: (m, game) => nearestGuard(game, ids(W3)),
      update(m, game, dt) {
        const n = standing(game, W3);
        for (const x of m.live) x.update(dt);
        say(m, game, `הגל האחרון: לסמן אותם (${W3.length - n}/${W3.length}) · סומנת ${game.paint.hits}/3`);
        return n === 0 && !game.dialogue.busy ? 'next' : null;
      },
    },
    { // 5: the span gives way; Nehorai jumps; Erez at the edge
      objective: 'הגשר קורס',
      enter(m, game) {
        const g = G(game), sp = g.span;
        game.cutscene = true; game.hud.setCinematic(true);
        game.dialogue.play(COLLAPSE);
        // everyone east: the others run for their places across (Erez for the edge), and Nehorai, from the
        // west edge, makes the jump; the deck blows behind him as he runs
        game.squad.ids.forEach((id, i) => game.squad.send(id, id === 'erez' ? g.edge.erez : across(g, i)));
        game.follow.shot({ x: g.edge.west.x - 10, y: g.y + 5, z: g.z + 12 }, { x: g.edge.west.x, y: g.y + 1, z: g.edge.west.z }, 9999);
        leap(game, 0); m.s.across = false;
        [0.55, 1.15, 1.75].forEach((t, k) => setTimeout(() => { const x = g.edge.west.x + 2 + k * 5; game.fx.explode(x, g.y, g.z + (k - 1) * 4, { size: 1.8 }); }, t * 1000));
        m.s.collapse = m.t;
      },
      interaction(m, game) { return m.work?.interaction(game) || null; },
      target(m, game) { return m.work && !m.work.done ? { ...G(game).edge.east, r: 1.4 } : null; },
      update(m, game, dt) {
        const g = G(game), sp = g.span;
        sp.update(dt);
        const since = m.s.collapse == null ? -1 : m.t - m.s.collapse;
        if (since >= 0 && !m.s.across) leap(game, since);
        // the span goes as he takes off from it; the others are across by then (anyone still on it is put
        // there), all but Erez, who hangs at the edge
        if (since > RUN && !sp.down) {
          sp.drop(); game.follow.shake(1.3); game.sound?.boom?.(1.2);
          for (let k = 0; k < 6; k++) game.fx.dust(g.edge.west.x + 1 + k * 2.4, g.y, g.z - 6 + k * 2.2, 1.6);
          game.squad.ids.forEach((id, i) => { if (id === 'erez') return; const n = game.npc(id), at = across(g, i); n.target = null; n.place(at.x, at.z, -Math.PI / 2, g.y); });
          const z = game.npc('erez'); z.target = null; z.place(g.edge.erez.x, g.edge.erez.z, -Math.PI / 2, g.y); z.model.setPose('down');
          game.squad.send('erez', g.edge.erez, { label: 'נאחז' }); z.target = null;
          game.nehorai.play('dodge', { speed: 0.6 }); // knees up for the jump
        }
        if (since > RUN + LEAP && !m.s.across) {
          m.s.across = true;
          // Nehorai made it across; the others follow him again
          const e = g.edge.east, z = game.npc('erez');
          game.player.place(e.x + 2.2, e.z - 1.5, -Math.PI / 2, g.y); game.follow.snapBehind(-Math.PI / 2);
          for (const id of game.squad.ids) if (id !== 'erez') game.squad.release(id);
          game.follow.shot({ x: e.x + 5, y: g.y + 2.4, z: e.z + 4 }, { x: g.edge.erez.x, y: g.y + 0.3, z: g.edge.erez.z }, 9999);
          const live = attempt(game, m);
          game.dialogue.play(HANG).then(() => {
            if (!live()) return;
            game.cutscene = false; game.hud.setCinematic(false); game.follow.override = null; game.follow.snapBehind(-Math.PI / 2);
            m.work = new Work(game, { at: g.edge.east, seconds: 2.5, label: 'לחלץ את ארז', pill: 'מושך את ארז', near: 2.6, onDone: () => {
              z.model.setPose(null); z.place(g.edge.east.x + 1.4, g.edge.east.z + 0.8, -Math.PI / 2, g.y); game.squad.release('erez');
              game.hud.banner('', 'ארז למעלה', '', 1600);
              game.dialogue.play(SAVED).then(() => (live() ? game.dialogue.play(DRIVE) : null)).then(() => { if (live()) m.s.saved = true; });
            } });
          });
        }
        m.work?.update(dt);
        say(m, game, m.s.saved ? 'ארז למעלה' : m.work ? 'ארז נאחז בקצה · לגשת וללחוץ "לחלץ את ארז"' : 'הגשר קורס');
        return m.s.saved ? 'next' : null;
      },
    },
  ],
  complete(m, game) { m.done = true; },
};
