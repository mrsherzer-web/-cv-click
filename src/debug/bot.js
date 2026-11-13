// For automated tests only: plays Nehorai's side of a fight through the same calls the buttons make
// (punch, holding block, dodge) with a reliable sense of timing, which a test driving a headless
// browser at a few frames a second cannot have. Never active in normal play.
export function fightBot(game, { block = false, dodge = false, punch = false, approach = false } = {}) {
  return (input, dt) => {
    const fight = game.fight;
    if (!fight || fight.over || game.mode !== 'foot') return input;
    const out = { ...input, move: { ...input.move } }, me = game.player.pos, f = game.fighter;
    const foe = game.foe(8);
    const th = fight.threat; // someone winding up
    const striking = fight.opponents.find((o) => o.mode === 'strike');
    if (block) out.block = !!(th || striking);
    // the punch lands 0.2 to 0.3 s after the wind-up ends and a dodge is safe for 0.45 s: step out
    // in the last 0.15 s of the wind-up (needs frames of 0.1 s or shorter, so tests fight at real speed)
    if (dodge && th && th.t < 0.15 && f.canAct()) game.dodge();
    if (foe) {
      const dx = foe.npc.pos.x - me.x, dz = foe.npc.pos.z - me.z, d = Math.hypot(dx, dz);
      if (approach && d > 1.35 && !th && f.state !== 'block') {
        const cy = game.follow.yaw, fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
        out.move.y = (dx * fx + dz * fz) / d;
        out.move.x = (dx * rx + dz * rz) / d;
      }
      if (punch && !th && d < 1.75 && f.state !== 'block' && f.stamina > 20 && (foe.fighter.counter > 0 || foe.mode !== 'strike')) game.punch();
    }
    return out;
  };
}
