// Shared pieces of chapter seven, the rescue of Nehorai, played as Erez: the team, arming it, posting
// Kotzi's guards, Nehorai's voice on the radio, the convoy between places, and the way back to
// playing Nehorai. Paint, as in every fight in this game: whoever is marked is out.
import { COLORS, OUT_AT } from '../combat/paint.js';

export const TEAM = ['ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam'];
export const NAMES = { ido: 'עידו', yonati: 'יונתי', avraham: 'אברהם', muller: 'מולר', dolev: 'דולב', hadar: 'הדר', liam: 'ליאם' };
export const MARKED_OUT = 'ארז סומן שלוש פעמים. לפי החוקים, בחוץ. עידו: "מההתחלה. ועכשיו אתה נשאר מאחורי המחסה, המפקד."';

export function asErez(game) {
  game.playAs('erez');
  game.daylight?.set(1, 0);
  for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy', 'erezBuddy']) { if (game[b]?.active) game[b].leave(); if (game[b]) game[b].held = true; }
  game.radio?.stopAmbient();
  for (const n of game.pubCrowd || []) n.show(false);
}
export function asNehorai(game) {
  game.squad.dismiss();
  game.paint.dispose();
  game.playAs('nehorai');
  for (const b of ['idoBuddy', 'hadarBuddy', 'companion', 'liamBuddy', 'erezBuddy']) if (game[b]) game[b].held = false;
  for (const id of TEAM) game.npc(id).show(false);
  const n = game.npcs.get('nehorai'); if (n) n.show(false);
}
export function team(game, near, yaw) { game.squad.form(TEAM, { near, yaw }); }
export function armTeam(game) {
  const P = game.paint;
  P.armPlayer(COLORS.erez);
  for (const id of TEAM) { const n = game.npc(id); if (!n.visible) continue; if (!P.allies.some((a) => a.npc === n)) P.addAlly(n, COLORS[id] || COLORS.ido); }
}
export function postGuards(game, place, list) {
  const P = game.paint;
  for (const [id, route, opts] of list) {
    const n = game.npc(id), pts = place.patrols[route]; if (!pts) continue;
    n.floorY = pts[0].y ?? null; n.place(pts[0].x, pts[0].z, pts[0].yaw ?? 0); n.idle = null; n.model.setPose(null); n.show(true);
    if (!P.guards.some((g) => g.npc === n)) P.addGuard(n, pts.map((p) => ({ x: p.x, z: p.z })), undefined, { quick: true, still: pts.length === 1, ...(opts || {}) });
  }
  P.reset();
}
export function hideGuards(game, ids) { for (const id of ids) { const n = game.npc(id); n.floorY = null; n.model.setPose(null); n.show(false); } }
export const left = (game, ids) => game.paint.guards.filter((g) => ids.some((id) => game.npc(id) === g.npc) && !g.marked).length;
// Nehorai on the radio: heard, not seen
export function radio(game, text) { game.hud.toast('קשר · נהוראי', 1400); return game.dialogue.play([['נהוראי', text, 'phone']]); }
export function failOut(m, game, steps) { return steps.includes(m.stepIndex) && game.paint.hits >= OUT_AT ? MARKED_OUT : null; }
// the drive between places: the team rides along (out of sight) and forms up again at the other end
export function arriveTeam(game, at) { game.exitCar(); game.player.place(at.x, at.z, at.yaw); game.follow.snapBehind(at.yaw); team(game, at, at.yaw); }
export const sayAll = (game, lines) => game.dialogue.play(lines);

// A friend's job on something — a lock, a door, a valve, the gate. He is sent to the spot; if he
// cannot find the way (no progress for a few seconds, or too long on the road) and the leader is
// near the spot, he is put there: the thing always gets done. While he works there is a count on
// the screen; when the count ends, `onDone` runs (the door opens).
export class Job {
  constructor(game, { who = 'ido', at, seconds = 4, label = 'פורץ', pill = 'עידו פורץ', near = 9, onDone = null, onBegin = null }) {
    this.game = game; this.who = who; this.at = at; this.seconds = seconds; this.label = label; this.pill = pill; this.near = near; this.onDone = onDone; this.onBegin = onBegin;
    this.phase = 'go'; this.t = 0; this.last = Infinity; this.stuck = 0; this.shown = -1;
    game.squad.send(who, at, { label });
  }
  get done() { return this.phase === 'done'; }
  update(dt) {
    const g = this.game, n = g.npc(this.who), me = g.player.pos;
    if (this.phase === 'done') return;
    const d = Math.hypot(n.pos.x - this.at.x, n.pos.z - this.at.z);
    if (this.phase === 'go') {
      this.t += dt;
      if (d < this.last - 0.25) { this.last = d; this.stuck = 0; } else this.stuck += dt;
      const leaderNear = Math.hypot(me.x - this.at.x, me.z - this.at.z) < this.near;
      if (d < 1.7) this.begin();
      else if (leaderNear && (this.stuck > 2.5 || this.t > 9)) { n.target = null; n.place(this.at.x, this.at.z, this.at.yaw ?? n.yaw); this.begin(); } // found another way round
      else if (!leaderNear && this.t > 20 && d > 6) { n.target = null; n.place(this.at.x, this.at.z, this.at.yaw ?? n.yaw); } // waits there for the leader
      return;
    }
    // work
    this.t += dt;
    const left = Math.max(0, this.seconds - this.t), shown = Math.ceil(left);
    if (shown !== this.shown) { this.shown = shown; if (shown > 0) g.hud.toast(`${this.pill} · ${shown}`, 1100); }
    n.target = null;
    if (n.model.pose !== 'carry') n.model.setPose('carry');
    if (left <= 0) this.finish();
  }
  begin() {
    const n = this.game.npc(this.who);
    this.phase = 'work'; this.t = 0;
    n.target = null;
    if (this.at.yaw != null) n.lookAt(n.pos.x + Math.sin(this.at.yaw) * 3, n.pos.z + Math.cos(this.at.yaw) * 3);
    this.onBegin?.();
  }
  finish() {
    const g = this.game, n = g.npc(this.who);
    this.phase = 'done';
    n.model.setPose(null);
    g.squad.release(this.who);
    g.sound?.chime?.(true);
    this.onDone?.();
  }
  cancel() { const g = this.game, n = g.npc(this.who); this.phase = 'done'; n.model.setPose(null); g.squad.release(this.who); }
}
