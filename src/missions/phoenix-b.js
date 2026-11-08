// Shared pieces of chapter nine's missions 37–39, under the ground and without the markers: the light and
// the covered map down there, the gang's markers kept in the stash (and given back at the wall of weapons),
// the Order's guards standing, walking in and sitting beaten, fist fights with Erez, Ido and the others
// really fighting alongside, the machine room's presses and steam catching whoever stands in them, and
// short scripted beats (lines, waits, poses) that run on game time. Paint and fists only: whoever is beaten
// sits down. Everyone in the gang stays loyal; every threat is the Black Order's. Invented, all of it.
import * as THREE from 'three';
import { Fight } from '../combat/fight.js';
import { TEAM, armCrew, crew } from './phoenix.js';

export const FAC = (game) => game.world.places.facility;
// a point of the facility in its own coordinates (x east, z south of its centre), on its floor
export function L(game, lx, lz, ly = 0, yaw) { const f = FAC(game), p = f.toWorld(lx, lz); return { x: p.x, z: p.z, y: f.y + ly, ...(yaw != null ? { yaw } : {}) }; }

// under the ground: the night's lamps (the halls are lit by their own tubes), the minimap covered; the
// machine room's presses know who stands under them (a head never comes down onto anyone)
export function underground(game) {
  game.daylight?.set(1, 0);
  game.overlay?.mapHidden(true, 'מתחת לאדמה');
  watchPresses(game);
}
// whoever is on his feet down there, for the presses' safety stop: Nehorai and everyone shown
export function watchPresses(game) {
  const H = FAC(game)?.machines;
  if (!H?.watch || H.watching === game) return;
  const out = [];
  H.watch(() => {
    out.length = 0;
    if (game.mode === 'foot') out.push(game.player.pos);
    for (const n of game.npcs.values()) if (n.visible && !n.inCar) out.push(n.pos);
    return out;
  });
  H.watching = game;
}

// lines that wait their turn: a line still being said is never cut off by the next one (the queue plays
// from the mission's tick, never over a scene); the promise resolves once these lines have been shown
export function talk(m, game, lines) {
  return new Promise((resolve) => { (m.talk ||= []).push({ lines, resolve }); talkOn(m, game); });
}
export function talkOn(m, game) {
  if (!m.talk?.length || game.dialogue.busy || game.cutscene) return;
  const { lines, resolve } = m.talk.shift();
  game.dialogue.play(lines).then(resolve);
}

// the chief guard's keys: a ring of them on og1's belt, from the moment he walks in until Nehorai takes them
export function chiefKeys(game, on) {
  const n = game.npc('og1'), hips = n.model.bones?.hips;
  if (!hips) return;
  if (on && !n.keyRing) {
    const mat = new THREE.MeshStandardMaterial({ color: '#d2b24e', metalness: 0.85, roughness: 0.3, emissive: '#6a5012', emissiveIntensity: 0.7 });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 18), mat));
    for (let i = 0; i < 4; i++) {
      const a = -0.6 + i * 0.4, k = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.1, 0.007), mat);
      k.position.set(Math.sin(a) * 0.06, -0.05 - Math.cos(a) * 0.035, 0.004 * i); k.rotation.z = a * 0.6;
      g.add(k);
    }
    g.position.set(-0.19, -0.07, 0.04); g.rotation.y = Math.PI / 2;
    hips.add(g);
    n.keyRing = g;
  } else if (!on && n.keyRing) {
    const g = n.keyRing;
    g.removeFromParent();
    g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    g.children[0]?.material?.dispose();
    n.keyRing = null;
  }
}

// the markers taken: everyone's own is in the stash (a fresh page names them all, so the wall can give each
// his own back); idempotent, and saved in the progress, so a reload keeps them unarmed
export function unarmed(game) { game.paint.stash({ player: true, allies: TEAM }); }
// at a mission's start: the markers into the stash first (who carried what), then anything of the round
// before put away (a port guard's marker and cone, the friends' paint state); the stash is kept
export function disarmAll(game) { if (game.mode === 'car') game.exitCar(); unarmed(game); game.paint.dispose(); }
// the markers back: each his own from the stash, anyone not in it armed in his own colour
export function rearmed(game) { game.paint.unstash(); armCrew(game); }
// a replay of a mission before the wall, played after the armory was done: the markers it put in the stash
// go back to their owners when it ends (finished, quit or handed over), so no stale stash outlives it
export function replayDone(m, game) { if (m.replay && game.missions.done('armory')) game.paint.unstash(); }

// the Order's people: standing at a post (arms crossed), sitting beaten (out, no collision), gone
export function stand(game, id, at, { yaw = at.yaw ?? 0, idle = 'arms', pose = null, floor = false } = {}) {
  const n = game.npc(id);
  n.target = null; n.face = null; n.idle = idle; n.posed = false;
  n.floorY = floor ? at.y : null;
  n.model.setPose(pose);
  n.place(at.x, at.z, yaw, at.y ?? null);
  n.show(true);
  return n;
}
export function beaten(game, id, at, yaw = at.yaw ?? 0) { const n = stand(game, id, at, { yaw, idle: null, pose: 'down' }); n.body.enabled = false; return n; }
export function away(game, ids) { for (const id of ids) { const n = game.npc(id); n.target = null; n.idle = null; n.posed = false; n.floorY = null; n.model.setPose(null); n.show(false); } }
// whoever of `ids` already sits beaten where he fell (a mission carried straight on) stays there; the rest at `spots`
export function keepBeaten(game, ids, spots) {
  ids.forEach((id, i) => {
    const n = game.npc(id);
    if (n.visible && n.model.pose === 'down' && FAC(game).inside(n.pos.x, n.pos.z)) { n.idle = null; n.target = null; n.body.enabled = false; return; }
    const s = spots[i % spots.length];
    beaten(game, id, s, s.yaw ?? 0);
  });
}

// along a list of points, one after the other
export function walkPath(n, pts, { run = false, onDone = null } = {}) {
  let i = 0;
  const go = () => { if (i >= pts.length) { onDone?.(); return; } const p = pts[i++]; n.walkTo(p.x, p.z, { run, near: 0.6, onArrive: go }); };
  go();
}

// A fist fight: the guards in `foes` ({ id, hp, power, aggression, windup, moves, guard, boss, armor, phases,
// name }) against Nehorai and the friends in `allies`, who leave the formation and really fight (they are
// sent, so the squad leaves them to it, and given back after). The result lands in m.s.won / m.s.lost.
export function brawl(m, game, { foes, allies = ['erez', 'ido'], max = 2, allyHp = 85, allyPower = 0.35, onPhase = null }) {
  stopBrawl(m, game);
  for (const id of allies) { const n = game.npc(id); if (!n.visible) continue; game.squad.send(id, { x: n.pos.x, z: n.pos.z }, { label: 'בקרב' }); n.target = null; n.idle = null; n.model.setPose(null); }
  m.s.won = false; m.s.lost = false;
  m.fight = new Fight(game, {
    opponents: foes.map((f) => ({ name: 'שומר', ...f, npc: game.npc(f.id) })),
    allies: allies.filter((id) => game.npc(id).visible).map((id) => ({ npc: game.npc(id), hp: allyHp, power: allyPower })),
    maxAttackers: max,
    onWin: () => { m.s.won = true; }, onLose: () => { m.s.lost = true; }, onPhase,
  });
  m.fightAllies = allies.slice();
  game.sound?.music?.('action');
  return m.fight;
}
// after a fight that was won: the beaten sit where they fell (out of everyone's way), the friends who fought
// get up and fall in again
export function endBrawl(m, game) {
  const f = m.fight;
  if (f) {
    for (const o of f.opponents) if (o.fighter.down) { o.npc.target = null; o.npc.idle = null; o.npc.model.setPose('down'); o.npc.body.enabled = false; }
    f.dispose();
  }
  m.fight = null;
  for (const id of m.fightAllies || []) { const n = game.npc(id); n.model.setPose(null); n.target = null; game.squad.release(id); }
  m.fightAllies = [];
  game.nehorai.setPose(null);
  game.sound?.music?.(null);
}
// a fight called off (a retry, a quit): the rings gone, the friends back in the formation
export function stopBrawl(m, game) {
  if (m.fight) { m.fight.dispose(); m.fight = null; }
  for (const id of m.fightAllies || []) { const n = game.npc(id); n.model.setPose(null); n.target = null; game.squad.release(id); }
  m.fightAllies = [];
}

// Nehorai on his feet with his full strength (a retry after he went down, a fresh page)
export function freshPlayer(game) {
  const f = game.fighter;
  f.body.model = game.nehorai; // the body the fists animate is the one on screen (after a playAs)
  f.revive(); f.minHp = 0;
  game.dash = null;
  game.nehorai.setPose(null);
}

// The machine room's hazards as real obstacles: a press coming down or a burst of steam (each warns first:
// an amber lamp) hits whoever stands in it, Nehorai, a friend or a guard, once per burst — a big hit that
// staggers, floors a man who is low, and can finish him. A dodge at the right moment gets out of it.
export function machineHits(m, game, fighters) {
  const H = FAC(game).machines, now = game.time;
  m.hz = m.hz || new Map();
  for (const f of fighters) {
    if (!f || f.down || f.state === 'floored') continue;
    const hz = H.hits(f.pos.x, f.pos.z, f.pos.y);
    if (!hz) continue;
    const key = H.hazards.indexOf(hz), last = m.hz.get(f) || {};
    if (now - (last[key] ?? -9) < 1.6) continue;
    last[key] = now; m.hz.set(f, last);
    // from behind him: a press or a jet is not something a raised guard stops
    const yaw = f.body.yaw, from = { pos: { x: f.pos.x - Math.sin(yaw), z: f.pos.z - Math.cos(yaw), y: f.pos.y } };
    // out of a fight it staggers him, never floors him (no fight to get up into: no boxing stance after it)
    const loose = !m.fight || m.fight.over, floorable = f.floorable;
    if (loose) f.floorable = false;
    const res = f.takeHit(from, hz.kind === 'press' ? 30 : 18, 'slam', { heavy: true });
    f.floorable = floorable;
    if (res === 'dodged') continue;
    m.s.hazardHits = (m.s.hazardHits || 0) + 1; m.s.hazardOn = (m.s.hazardOn || 0) + (f === game.fighter ? 0 : 1);
    game.fx?.sparks?.(f.pos.x, f.pos.y + 1, f.pos.z, hz.kind === 'press' ? 14 : 6);
    game.sound?.hit?.('crash', hz.kind === 'press' ? 0.9 : 0.5);
    if (f === game.fighter) game.hud.pop(hz.kind === 'press' ? 'המכבש!' : 'קיטור!', 'hit');
    else if (m.fight?.opponentOf(f)) game.hud.pop(hz.kind === 'press' ? 'המכבש תפס אותו!' : 'הקיטור תפס אותו!', 'counter');
  }
}

// A short scene on game time: ['say', lines] waits for the lines, ['wait', seconds], ['do', fn], ['until',
// fn] waits for fn() to be true. update(dt) from the step's update; done when through; cancel() stops it.
// A 'say' lets a line still being said finish first (it never cuts one off).
export function beats(game, list) {
  let i = 0, t = 0, started = false, token = 0, held = 0;
  const b = {
    done: false, talking: false,
    update(dt) {
      while (i < list.length) {
        const [k, v] = list[i];
        if (!started) {
          if (k === 'say' && game.dialogue.busy && (held += dt) < 8) return;
          started = true; t = 0; held = 0;
          if (k === 'say') { const my = ++token; b.talking = true; game.dialogue.play(v).then(() => { if (my === token) b.talking = false; }); }
          else if (k === 'do') v();
        }
        if (k === 'say' && b.talking) return;
        if (k === 'wait') { t += dt; if (t < v) return; }
        if (k === 'until' && !v()) return;
        i++; started = false;
      }
      b.done = true;
    },
    cancel() { token++; i = list.length; b.done = true; b.talking = false; },
  };
  return b;
}

// everything a restore or a cleanup puts away first
export function clearStage(m, game) {
  game.dialogue.stop(); game.cutscene = false; game.follow.override = null; game.hud.setCinematic(false); game.keypad?.close(false);
  m.talk = [];
  stopBrawl(m, game);
  m.beats?.cancel(); m.beats = null;
  m.work?.cancel(); m.work = null; m.job?.cancel(); m.job = null;
  m.hz = null;
  game.fx.resetAtmosphere();
  game.fx.clear?.();
  if (game.mode === 'car') game.exitCar();
  freshPlayer(game);
}

// the gang formed up at `at` (Nehorai leading), unarmed
export function gangAt(game, at, yaw = at.yaw ?? 0) {
  game.player.place(at.x, at.z, yaw, at.y); game.follow.snapBehind(yaw);
  crew(game, game.player.pos, yaw);
}
