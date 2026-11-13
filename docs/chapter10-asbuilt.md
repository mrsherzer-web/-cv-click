# פרק 10 · מה שנבנה בפועל (as built)

What chapter ten's engine pieces and sites really offer, from their builders' reports, for the missions'
builders. Trust this file over docs/chapter10.md for names, signatures and coordinates.

## Moves (src/missions/moves.js, the controller, poses)

### moves (as built)

Everything is in `src/missions/moves.js` (import from it, or use `game.moves.X`: the same module). Crawling is on the controller. Nothing here is saved: a restore stages it, a cleanup clears it. Points are `{ x, z, y }` in world metres; always give `y` (the floor of that spot). Times are seconds.

**How updates and prompts work**
- Every piece has `update(dt)` and `dispose()`. Call `update` once a frame from the step's `update`; a second call in the same frame does nothing.
- Whatever holds a body (a leap in the air, a friend crossing, someone frozen, a knock back) also drives itself to its end from `game.activities`, so a step that changes in the middle cannot leave the player locked.
- Prompts are not automatic: forward `interaction(game)` from the step's `interaction()`.
- `new Kit()` is a bag: `kit.add(...things)` (returns the first), `kit.remove(thing)` (disposes it), `kit.update(dt)`, `kit.interaction(game)` (highest priority wins), `kit.dispose()`.

**(a) Crawling — `game.player` (src/player/controller.js)**
- `crawl(on = true, { speed } = {})` returns the state. `crawling` is the flag. `crawlSpeed` is 0.9 m/s at full stick, multiplied by `speedScale` (held to 0.4..1).
- While crawling: the held pose is `'prone'` with the one-shot actions `'crawlL'` / `'crawlR'` alternating at the pace actually made; turning is slower; `running` is always false, and game.js releases the run button every frame so it never lights.
- Standing is refused: the controller puts `'prone'` back every frame whatever else sets a pose, until `crawl(false)`.
- `height` is 0.7 crawling, 1.8 standing; the body's collision circle uses it.
- The follow camera eases (rate 5/s) to look 0.6 m above the feet from 2.5 m back (standing: 1.55 m and 3.9 m, unchanged). `game.follow.low` is 0..1.
- Also new on the controller:
  - `take(owner)` / `release(owner, y)`: a scripted move owns the body; no stick, no ground snap.
  - `busy`: true while taken or frozen.
  - `freeze(seconds)` / `frozen`: the stick is ignored; looking around still works.
  - `gravity` (default false): when true, a drop deeper than 0.7 m is fallen at 22 m/s² instead of snapped. `falling` is the flag.
  - `place()` now also lets go of any hold, freeze or fall.
- `crawl` is not cleared by `fx.resetAtmosphere()` or by the mission framework: call `game.player.crawl(false)` in cleanup.

**New poses (src/characters/poses.js)**
- POSES: `prone`, `kneel`, `helped`, `halfup`, `lean`, `support`, `hang`, `mantle`, `crouch`, `tuck`, `reach`. ACTIONS: `crawlL`, `crawlR`.
- They use only channels the walk resets each frame, so `model.setPose('prone')` works on any character (a friend lying on the grass) and leaves nothing behind.
- `layPose(model, a, b = a, k = 0, w = 1, mirror = false)` lays a body between two poses by hand. Call it after the body's own animate, i.e. from a mission update.

**(b) Helped up**
- `helpUp(game, friendNpc, { onDone, side })` starts at once and returns the move (`active`, `done`, `cancel()`, `dispose()`).
  - The friend runs to the player's side (0.56 m; left, or right if a wall is there; `side: 1 | -1` forces it). He is put there if he is more than 9 m away or takes over 1.8 s.
  - Then: kneel 0.45 s, lift onto the knees 0.9 s, a foot under 0.5 s, both rise 0.85 s, hold 0.45 s, release 0.4 s. About 3.6 s after he arrives.
  - `crawl(false)` is called as the lift begins (so the camera rises with him). Control returns at the end, then `onDone(move)`.
- `liftUp(game, friendNpc, { onDone, side })` is the same scene reversed: the friend is on the floor in whatever pose he holds (`'down'`, `'floored'`, `'prone'`), the player steps to his side, kneels and lifts him. The friend's pose is cleared; the player's body is taken for the duration. Made for mission 58's fallen friend.
- If the scene cannot play (friend hidden, body in another move), both end at once in the same final state and still call `onDone`.

**(c) Leap, Climb, giveHand**
- `new Leap(game, { from, to, label = 'לקפוץ', near = 1.6, arc, seconds, ready, onto, twoWay = false, backLabel, friendsFollow = [], friendSpots, onStart, onLand, onMiss, priority = 6 })`
  - The prompt shows within `near` of `from` on its floor (not while crawling or busy). `to` may be a function for a far side that moves.
  - Defaults: `seconds` = 0.42 + 0.085·distance (held to 0.5..1.0); `arc` = 0.55 + 0.14·distance (0.7..1.6 m); plus 0.16 s wind-up and 0.22 s landing.
  - Timing: with `onto` (a PhasePlatform or anything with `.solid`) or `ready()`, the far side must be there when he comes down. If not: 0.34 s of falling, a short fade, back at the spot he jumped from, held 0.3 s, a toast, `onMiss(n)`. Never a fail.
  - The prompt's `tone` is `'red'` while a leap begun now would miss.
  - `twoWay` offers the leap back from `to`.
  - `friendsFollow: [npc]`: held while the player is in the air; after he lands each runs to `from` (put there after 2.4 s), waits until the far side will hold him (12 s at most), leaps, and lands 0.6 m beside `to` (or at `friendSpots[i]`), 0.5 s apart. Squad members are taken out of the formation meanwhile and given back.
  - Fields: `active`, `holding`, `open`, `leaps`, `misses`, `enabled`.
- `new Climb(game, { bottom, top, label = 'לטפס', near = 1.5, seconds, down = 'לרדת', friendsFollow, friendSpots, onTop, onDown, priority = 6 })`
  - `bottom` is at the foot, about 0.4 m from the face; `top` is the standing spot.
  - Up: reach 0.28 s, pull 0.4 + 0.32·height s (0.55..1.6), over 0.45 s. `down` (a label, or null) offers a step off and drop from the top.
  - `friendsFollow` climb after him. Fields: `climbs`, `active`, `enabled`.
- `giveHand(game, friendNpc, { from, to, at, label = 'לתת יד לארז', near = 2.2, seconds, onDone, priority = 7 })` returns the move (`interaction`, `update`, `dispose`, `done`, `parked`, `active`).
  - `from` is the friend's spot at the foot, `to` his spot on top.
  - Once the friend is within 4 m of `from` or the player is on top by `to`, the friend is kept at `from` looking up (the squad would otherwise bring him round by itself); he is put there after 4 s.
  - The prompt shows to the player on top within `near` of `to`. The player kneels at the edge beside where the friend comes up (`at` overrides the spot), reaches down, the friend is hauled up and over to `to`, then `onDone`.
  - If the friend is already up there, it finishes quietly with `onDone`.

**(d) The reality-path kit**
- `new PhasePlatform(game, { x, z, hx = 1.2, hz = 1.2, y, period = 6, on = 3.5, offset = 0, thick = 0.3, warn, yaw = 0, color, onChange })`
  - `y` is the top surface. It is solid for `on` seconds of each `period`. The last `warn` seconds (default min(1.2, 0.4·on)) it blinks warm; the one the player stands on beeps. Gone, a faint ghost stays and brightens 0.5 s before it returns.
  - How the surface comes and goes: one walk-only pad is added to `world.net` at construction and its `covered` flag is switched (`padAt` skips a pad that is not covered: O(1), no allocation). One floor object is pushed to `world.cols.floors` and its `y` set to -Infinity while gone (the camera and lines of sight). Both are taken out on dispose.
  - Fields: `solid`, `phase`, `left` (seconds to the next change), `solidFor(s)`, `lock(true | false | null)` (held there / held away / back on rhythm), `contains(x, z, margin)`.
  - Platforms made together stay in step (each has its own clock from creation plus `offset`).
- `new StasisField(game, { x, z, r = 2.5, y, period = 7, hold = 2.5, warn = 1.4, offset = 0, height = 2.6, onFire })`
  - A translucent cyan column with a ring. It fires at `period − hold` into each cycle. For `warn` seconds before, it brightens and pulses faster, the ring closes from 1.9× to the edge, and beeps rise.
  - At the firing moment whoever is inside is held for `hold` seconds: the player on foot (`player.freeze`, a statue with a blue tint, frost at the screen edges, the pop "הזמן נעצר"); any visible NPC (kept in place, tinted, his walk target given back afterwards); any Disturbance (stops, pales, harmless).
  - Walking in after it fired is safe. The fire, reload and punch buttons are not blocked while frozen.
  - Fields: `firesIn`, `winding`, `frozen`, `fired`, `inside(pos, margin)`, `onFire(caught)`.
- `new Disturbance(game, { path: [{ x, z, y }...], speed = 2.2, r = 0.9, height = 1.0, loop = false, marks = true, knock = 2.4, color, label = 'הפרעה!', onTouch })`
  - A glowing ball going there and back along the path (round and round with `loop`). The path is drawn as a ribbon on the ground and a spark runs about a second ahead.
  - A touch (within r + 0.35 m) knocks the player `knock` metres away over 0.2 s (walls stop it) and calls `game.paint.strike(label, color)`: one mark, at most one per second across all balls. `marks: false` knocks only. Three marks failing is the mission's own rule.
  - Fields: `pos`, `touches`, `frozen`, `freeze(s)`.
- `new Switch(game, { at: { x, z, y, yaw }, label = 'להפעיל', onUse(on, sw), near = 2.0, once = true, visual = true })`
  - A stone post with a light (red, green once thrown) 0.7 m ahead of `at` along `at.yaw`, with a small collider. `visual: false` when the site draws its own.
  - Fields: `on`, `used`, `use()`, `reset()`, `enabled`.
- `riftGuard(game, { minY, safe, friends = [], where, onFall, hint })`
  - While any guard lives, `player.gravity` is on. When the player is below `minY` (and `where(pos)` holds, if given): a short violet fade, he is placed on `safe()` → `{ x, z, y, yaw }`, held 0.35 s, a toast, `friends` put beside him, `onFall(n)`. No fail, no mark.
  - Without `safe` the guard remembers the last firm ground he stood on that was not a PhasePlatform.
  - A friend who falls alone is put beside the player. Fields: `falls`, `brought`.
- `pathKit(game, data, { friends, onSwitch, onFall })` builds a Kit from site data; every part optional:
  - `data.platforms[]`, `data.fields[]`, `data.disturbances[]`: the constructors' options.
  - `data.switches[]`: `{ at, label, steadies: [platform index] }` (thrown, it locks those platforms solid).
  - `data.leaps[]`: `{ from, to, onto: platform index, twoWay, label }` (friends follow).
  - `data.ledge`: `{ bottom, top, from, to, label, hand }` (a Climb, plus a giveHand for `friends[0]`).
  - `data.minY`, `data.inside(pos)`, `data.safe()`: the riftGuard.
  - Result: `kit.platforms`, `.fields`, `.disturbances`, `.switches`, `.leaps`, `.climb`, `.hand`, `.guard`.

**For the site builder (the grove's broken path)**
- The rift only has to be lower ground under the stones, with `minY` between the stones' height and its floor.
- Platforms should overlap the banks by a few centimetres.
- A ledge needs a collider under it, so nobody walks in below.

**game.js**
- `game.moves` is the module. One more line releases the run button while crawling.

**Left simple or untested:**

- **The dropped marker** (`paint.drop` / `pickUp`) is not built here; it belongs to the energy builder, as briefed.
- **Prone is approximated.** The pelvis stays upright while the chest and legs go horizontal (see needed_elsewhere 5). It reads well from the side and behind, with a slight kink at the waist. The crawl's legs curl and splay; they do not do a true knee-draw.
- **The two-person scenes do not really connect.** Arms are posed toward the other body, not solved to touch: readable from the game camera, not exact up close. In giveHand the hands roughly meet for a 1.6 m ledge; other heights were not looked at.
- **Scripted moves ignore colliders and ceilings.** A leap's arc or a climb through something solid is the mission's and site's design to avoid.
- **Being frozen blocks only the stick** (and my own prompts); fire, reload and punch buttons still work.
- **Friends are not real platformers.** Friends who follow leave when the far side will hold for the flight, and after 12 s regardless. NPCs have no gravity: a friend on a platform that goes snaps down and the riftGuard puts him beside the player. Friends do not time platforms themselves when walking.
- **PhasePlatforms do not move.** A Leap's `to` may be a function, but a moving far side was not tested.
- **Not tested:** a StasisField catching a paint guard, `playAs` together with crawl or the moves, Climb's `friendsFollow`, a Leap's `ready()` function (only `onto`), `twoWay` back with friends, and a platform with `yaw` ≠ 0.
- **Only seen in daylight on a grey test rig.** Nothing was checked in the violet dimension, in the grove or citadel, or on a real phone; no frame times were measured, only draw calls.
- **Self-driving leaves one small entry in `game.activities` for good** once any move has run.
- **Camera during crawl** was checked on open ground only, not against walls or under low cover.


## The citadel (src/world/citadel.js, citadel-tower.js, citadel-kit.js)

THE CITADEL — `world.places.citadel` (below: Z). Files: src/world/citadel.js (the site), src/world/citadel-tower.js (the central tower, its own group), src/world/citadel-kit.js (shared tools, the recorder that takes a building out of the world, screens, the armoured car's model).

Coordinates: world x 1440..1780, z 30..280, centre (1610, 155). `Z.x, Z.z` = the centre, `Z.y` = ground level (about -49.17), `Z.toWorld(lx, lz)` from site-local (+x east, +z south), `Z.box`. Every spot below is `{ x, z, y, yaw? }` in world coordinates with its own floor's y.
Heights: `Z.F = { tunnels: -6, yard: 0, bridges: 7, watch: 9, towerBridge: 14, tower: [0, 7, 14, 21], towerRoof: 36 }` (metres above Z.y); `Z.floorY(k)` with k = 'tunnels' | 'yard' | 'bridges' | 'watch' | 'towerBridge' or 0..3 for the tower's storeys; `Z.floors` = [{ name (Hebrew), y, tower? }]. Helpers: `Z.near(a, b, r)` (same floor), `Z.inside(x, z)`, `Z.inYard(x, z)`, `Z.inInner(x, z)`, `Z.inTower(x, z)`, `Z.inTunnels(pos)`.

AS THE SITE LEAVES IT: both gates, the inner gate, the service door and every way into the tower (main door, energy-hall door, upper door, emergency door) LOCKED; the stores, the alarm room and control room B open; the lift up, without power; the alarm off; tower standing.

WEST WALL (8 m high, merlons, lamps on top): `Z.gates.main` at (1440, 95), 10 m wide, two gate towers; `Z.gates.service` at (1440, 235), 8 m wide. Each gate: `open()` (unlocks and opens), `shut()`, `lock()`, `unlock()`, `locked` (get/set), `isOpen`, `door` (the leaf: site-builder door API pos/yaw/w/locked/open/setOpen/unlock/lock/body), `at`, `outside` (7 m out), `inside` (10 m in), `approach` (22 m out), `w`.

YARD (x 1440..1552): `Z.yard = { centre, mainLane[2], spine[2], serviceLane[2], containers, tanks, crane }`. Containers in five blocks, two standing and two lying tanks, a gantry crane, a tower crane, pipe racks, low barriers, crates; `Z.cover` = [{ x, z, y, w, d }]. `Z.vehicles` (8: `Z.cars` 5, `Z.lorries` 3): `{ kind: 'car' | 'lorry', x, z, y, yaw, blows: true, wrecked, wreck(), reset(), at (the blast spot, with y), near (a standing spot beside it), body }`. `Z.floodlights` (10 spots).
`Z.towers[0..3]` (NW, SW, NE, SE; bastions 12 × 12 m at the corners, the post at +9 m, two real flights of 4.5 m along the wall with a landing): `{ name, foot, landing, top, post, look, y, stairs }`.
`Z.alarm` (חדר בקרה א, world x 1460..1476, z 131..147, its door east): `{ active, on(bool), room, door, doorAt, panel (the panel itself, with y), panelAt (where one stands to work it), fuse, fuseAt (the fuse box in store 3), lamp, fuseLamp, sirens[] (positions), lights[] (points at +9 m over the red pools, for fx.redAlert) }`. `on(true)`: seven siren lamps flash and red pools lie on the yard's ground until `on(false)`.
`Z.stores` (four rooms along the south wall, x 1486..1550, z 265..279): `{ doors[4], rooms[4], fronts[4], power: 0, fuse: 2 }` — store 1 holds the lift's power switch, store 3 the alarm's fuses.
`Z.lift` (מעלית משא, platform 6 × 6 m at (1508, 240), yard ↔ tunnels 5.88 m below): `power` (boolean; `setPower(on)` also sets the lamp), `go('down' | 'up')` (false without power or when it is there already), `call(where = 'top' | 'bottom' | a position)`, `set('top' | 'bottom')` (at once, for restores), `state` ('top' | 'bottom' | 'moving'), `level`, `has(pos)`, `onArrive` (callback(state)), `topAt` / `bottomAt` (in front of its gate on each level), `onTop` / `onBottom` (on the platform), `switch` (with y) / `switchAt` (in store 1), `gates.top` / `gates.bottom`, `speed` (1.5 m/s). The platform REALLY moves with whoever stands on it: its walking surface (a pad whose height changes every tick), its floor for lines of sight and its mesh travel together; the gate of the level it has left is shut while it is away.
`Z.armoured` (the vehicle bay, x 1458..1482, z 253..277, open to the north by the service gate): `{ spot (1470, 265, yaw π: facing north), model (call it: a new THREE.Group, a six-wheeled armoured carrier 7.7 × 3 m, userData { wheels, body, tailMat, headMat, paint, color, halfExtents { x: 1.5, z: 3.85 }, wheelRadius: 0.62, seats: 8 } — `new Vehicle(game.world, Z.armoured.model(), { ... })`, then set car.box.hx / hz from halfExtents; dispose it when done), bay, door, boardAt, halfExtents, route[6] (out of the bay and the service gate), outside }`.

TUNNELS (מנהרות, floor at Z.y - 6, world x 1500..1588, z 216..264, 4.2 m high, pipes, dim amber strips): `Z.tunnels = { y, lobby, liftFront, north[3] (centre line z 219.5), south[3] (z 260.5), cross, exits: { north: { stairs, foot, top }, south: { stairs, foot, top } } }` — two flights of 18 steps come up inside the inner compound at about (1589.5, 219.5) and (1589.5, 260.5).

INNER WALL at x 1552 (7 m high). `Z.innerGate` at (1552, 155), 8 m wide, a shutter that lifts: the gate API above plus `wheelA`, `wheelB` (the wheels, with y, on the inner side at z 148 and 162), `wheelAAt`, `wheelBAt`, `wheels[2]` (meshes), `spin(i, angle)`, `outside` (yard side), `inside`, `cover[2]`, `threats[3]`.

INNER COMPOUND: `Z.control` (חדר בקרה ב, x 1566..1598, z 111..139, one tall room, roof at +7): `{ room, roof, doors[3], computer, approaches[3] = { name: 'west' | 'south' | 'east', door, inside, outside, post (the defender's spot behind a desk), from (where attackers come from) } }`; `Z.computer` = `{ at (where Muller stands), pos (with y), screen (show(mode, opts)) }`.
`Z.plant` (the plant house, x 1558..1582, z 183..207, stairs inside to its roof at +7): `{ room, roof, stairs, westDoor, eastDoor }`.
`Z.energy = { reactors[5], pylons[8], field, forecourt }` — reactor: `{ i, x, y, z (the glowing band, +4 m), r, base, at, live, set(live), lamp }` at world (1604, 217), (1624, 237), (1604, 255), (1750, 85), (1750, 225); pylon: `{ i, x, y, z (its tip, +10.4 m), base, r, live, set(live), lamp }` along the forecourt (x 1570, 1590, 1610, 1630; z 146 and 164). Props only: a mission makes them shootable and calls set(false).
`Z.bridges` (+7 m, 3 m wide, railed): `{ y, a[2] (control roof → the energy hall's door), b[2] (the fire stairs' foot → plant roof, with the gap), c[2] (control roof → plant roof, over the forecourt), controlRoof, plantRoof }`.
`Z.towerBridge` (גשר המגדל, +14 m, from the bridgehead on control room B's roof at x 1598 to the ledge at the upper door at x 1639, centre line z 123, 3 m wide, eight segments of 5.125 m): `segments[i] = { i, x0, x1, centre, from (the leap spot before it), to (after it), dropped, bar (a collider that keeps walkers out of the hole while it is down) }`, `drop(i, instant = false)` (the segment falls: its walking surface, floor and deck go; true if it fell), `restore(i?)` (one or all), `dropped()` (indices), `segmentAt(pos)`, `head = { foot, stairs, top, platform }`, `start`, `end`, `detour = { catwalk[2], links[7] }` — a service catwalk 1.2 m wide, marked in yellow, runs beside the whole bridge at z 118.1 with a link at every joint and never falls; `n`, `length`, `y`.

THE CENTRAL TOWER (world x 1642..1722, z 119..191; its own group `Z.tower.group`; storeys at +0, +7, +14, +21, roof +36, spire and red beacon above): `Z.tower = { group, ruin, state, doors, stairs[2], box, F, ROOF, names, mainHall, energyHall, machine, lastHall, fireStairs, patrols }`; the halls are also on Z directly.
`Z.mainHall` (האולם המרכזי, 79 × 71 m): `door` (west face at (1642, 155), 6 × 4.5 m), `outside`, `inside`, `centre`, `screen` (`show('shadow' | 'off' | 'alert' | 'map' | 'data' | 'portal' | 'engine' | 'static' | 'text', { progress, title, sub, color })`, 30 × 6 m on the east wall), `screenAt`, `shadowAt`, `erezAt`, `portalAt`, `pillars[8] = { x, z, y, holdAt }`, `cover[14] = { x, z, y, behind }` (0.9 m high), `defence = { emitters[7] = { x, y, z, kind: 'ceiling' | 'wall', set(colour) }, nodes[3] = { i, x, y, z, at, live, set(live) } }`, `medkit` (the box on the south wall, with y), `medkitAt`, `markerAt`, `thrownAt`, `stairsAt`. Also `Z.screen` and `Z.medkit`.
`Z.energyHall` (+7): `door` (west face, onto bridge A), `doorInside`, `doorOutside`, `centre`, `stairsTop`, `conduit`, `cells[8] = { i, x, z, y, at, blown, blow(), reset() }`, `cover`.
`Z.machine` (+14, a chamber 40 × 40 m with three doorways, a corridor round it; NO stairs between the energy hall and this floor — the way in is the tower bridge): `upperDoor` (west face at (1642, 123)), `doorInside`, `doorOutside`, `source` (with y), `sourceAt`, `console`, `consoleAt` (Muller), `centre`, `portalAt`, `approaches[3] = { name: 'west' | 'north' | 'south', door, outside, post, from }`, `stairsAt`.
`Z.lastHall` (+21, 79 × 71 × 15 m, `size`): `entry`, `centre`, `engine` (`{ x, y, z, r, mode, set('off' | 'idle' | 'on' | 'overload' | 'dead') }`, the ring at the east end), `engineAt`, `generators[3]` = `{ i, kind, x, y, z, at, live, set(live) }` with kind 'shoot' (in the open, plus `from`), 'console' (caged on the north wall, plus `console`, `consoleAt`), 'overload' (inside four conductor rods, plus `lureAt`, `rods[4]`); `cover[12]`, `rifts[6]`, `duel` + `duelR`, `portalAt` (also `Z.portalAt`), `landing.nehorai`, `landing.erez`, `shadowAt`, `friends[5]`, `exit = { door, lamp, switch, switchAt, inside, outside }`.
`Z.fireStairs = { gallery (+21), flights[2], landing2 (+14), landing1 (+7), foot }` on the south face.

THE WAY OUT: `Z.wayOut = { route[21] (last hall → fire stairs → bridge B → the gap → plant roof → plant stairs → the service door → the yard → the armoured car), leapIndex (7: route[7] → route[8] is the leap), mark(on) (green chevrons), marked, routeIndex(pos), doors[2] = { door, lamp, switch, switchAt, before, after } ([0] the last hall's emergency door, [1] the service door in the inner wall at (1552, 195), its switch on the plant house), throwSwitch(i, on = true), leap = { from, to, gap: 4.2, bars, guard(on) } (bridge B is broken between x 1616 and 1620; bars keep walkers out of the hole), fallen, fallenAt (inside the plant house), blasts[13], armoured }`.

THE END: `Z.destroy({ instant = false } = {})` — the tower's colliders, floors and walking surfaces leave the world at once, the group sinks 82 m and leans over 10 s under smoke, the ruin (`Z.ruin`: wall stumps, the four corners, rubble mounds, beams, the spire's top, fires, smoke; its own colliders) stays, every tower-bridge segment drops and the bridges' ends are barred; returns false if already destroyed. `Z.restore()` puts all of it back exactly. `Z.destroyed`, `Z.falling`.

`Z.doors` (all 20 doors and gates), `Z.patrols` (55 named routes: two points for a walk, one for a post, every point with its floor's y, no leg through a lockable door — the yard, gates, rooms, the four tower posts, tunnels, inner compound, roofs and bridges, every storey of the tower), `Z.lamps` (33), `Z.emissives`, `Z.tick(camera, dt)`.

**Notes for mission authors:**

1. src/world/lastroad.js: the hills road and the service road must meet the gates at `places.citadel.gates.main.outside` (1433, 95) and `gates.service.outside` (1433, 235) at height `places.citadel.y` (about -49.17). The citadel flattens x 1440..1780, z 30..280 with an 8 m blend outside the wall; `armoured.route` ends at (1424, 235) and should continue onto `routes.service`.
2. package.json: add tests/walk-citadel.test.mjs to `npm run test:ch10`.
3. src/vehicle/vehicle.js (cosmetic): wheel spin assumes a 0.31 m wheel; the armoured car's are 0.62 m (`model.userData.wheelRadius`), so they turn twice too fast unless vehicle.js reads that field. The mission that makes the Vehicle should set `car.box.hx = 1.5; car.box.hz = 3.85` (`armoured.halfExtents`), as the lorry code in phoenix-a.js does.
4. Missions: `alarm.on(true)` gives sirens and red pools on the ground only; for real red light add `game.fx.redAlert(true, { points: citadel.alarm.lights, id: 'citadel' })`. Every checkpoint restore should set the site's state itself: `citadel.restore()`, `towerBridge.restore()`, `lift.setPower()` / `lift.set()`, `wayOut.throwSwitch(i, ...)`, the gates, the tower's three doors (they start locked), `alarm.on()`, `screen.show()`.
5. Missions using the leap move: if it moves the player with collisions on, call `wayOut.leap.guard(false)` for the leap over bridge B and set `towerBridge.segments[i].bar.enabled = false` for a leap over a dropped segment, then put them back.
6. src/main.js: no change needed. For information: citadel.tick pulls `camera.far` in to 190 m while the camera is in the tunnels or inside the tower and puts the previous value back on leaving; a value set by someone else meanwhile (a quality change) is kept.
7. docs: the as-built guide should take the API text above; docs/chapter10.md's "nothing stands in x 1150..1940, z 0..300" should note that chapter nine's getaway drive runs at x 1810..1820 up to z 160, 30 m east of the citadel's east wall (untouched by this work).

**Left simple or untested:**

- The lift's ride was checked with the player's controller only; not with friends following or a car on the platform.
- The armoured car was checked as a model only (the userData contract and a screenshot in the bay); it was not driven as a Vehicle.
- The fall's smoke (26 pooled dark puffs) and the ruin's fires (instanced cones) are the site's own simple effects, because a world module has no access to the game's fx; sound, shake and blasts are the mission's. The puffs read as dark blobs rather than real smoke.
- "Red light over the yard" is red pools on the ground plus flashing siren lamps, not lights (see needed_elsewhere 4).
- Emitters, control nodes, shield generators, energy cells, reactors and pylons are props with positions and state lamps; nothing here makes them shootable or fires bolts.
- The leap is only spots, a real gap and bars; the detour on the tower bridge is a real catwalk, so a dropped segment never has to be leapt.
- With the far plane at 190 m inside the tower and the tunnels, what shows through an opening (the lift shaft, the stair holes, an open tower door) beyond 190 m, sky included, is cut off; I did not look at a screenshot of that.
- From the yard looking west the frame costs 310 draw calls at the game's far plane; I did not measure how much of that is the citadel and how much the older sites in view, and did nothing about it.
- Interiors are not shadowed (as elsewhere in the game): ceilings are dark, and by day the tunnels are brighter than "low light" suggests.
- The perimeter wall is plain (merlons, lamps, gate towers, plates); the yard, though filled, is large and still has open stretches.
- Patrol legs are straight lines checked clear; no path-finding was added.
- I ran tests/walk-citadel.test.mjs and tests/walk-tower.test.mjs only; no stage test, no resume test, not the whole suite.
- Lamps: 33 are registered; the engine lights the nearest 12, so a far night view shows windows, beacons and wall lamps but not the floodlights' pools.
- docs/chapter10-asbuilt was not written (not one of my files).


## Energy fights, marker kinds, the dropped marker, the cast (src/combat/energy.js and friends)

ENERGY (as built). Three commits on 5cf5a04. roster.js and head.js are unchanged.

(A) MARKER KINDS (game.paint, src/combat/paint.js; looks in gunModel.js)
- export KINDS = { quick, balanced, long }, KIND_IDS = ['quick','balanced','long'].
  - quick "מהיר": 6 pellets, reload 0.7 s, range 14 m, 0.1 s between pellets, keeps firing while #btnFire (or J) is held, spread 0.14 (at 13 m about half land), power 1. Short barrel, small hopper, yellow band.
  - balanced "מאוזן": chapters 4-9's marker to the number: 8 pellets (CLIP), reload 1.3 s (RELOAD), range 18 m (RANGE), no pause, one pellet a press, no spread, power 1. Same model as before.
  - long "ארוך ומדויק": 5 pellets, reload 1.6 s, range 30 m (locks on to 30 m), 0.8 s between pellets, no spread, power 2 (a pellet counts double on props, shield generators, a weak point, a heavy). Long barrel, sight, foregrip, blue band and muzzle.
- paint.setKind(kind) -> true | false (unknown kind). Writes game.progress.marker, saves, and swaps the marker in hand at once with a full hopper of its size.
- paint.kind -> 'quick' | 'balanced' | 'long' ('balanced' until one is chosen).
- progress.marker is null until setKind is called. The HUD label (#markerKind, over the ammo pips) shows the Hebrew name only once a kind has been chosen, so chapters 4-9 look as they did.
- paint.player now also has { kind, clip, cool }. armPlayer(color, { kind, ammo }) takes the two optional extras.
- pellet(from, to, shooter, { color, targets, spread, range = RANGE }).

(B) THE DROPPED MARKER
- paint.drop(at = null) -> the record. at: { x, z, y?, yaw? }; by default 0.9 m in front of Nehorai. Puts his own marker on the floor on its side with a pulsing ring in his colour, and disarms him (no fire/reload buttons, fire() false). Called with nothing in hand it returns what already lies there.
- paint.dropped -> { x, y, z, pos, kind, color, ammo } or null.
- paint.nearDropped(r = 1.8) -> boolean, for the mission's own prompt.
- paint.pickUp() -> true when taken: armed again with the same kind, colour and ammo. false when nothing lies there.
- With the stash: stash() takes a marker lying on the floor into the stash (player colour) and unstash() gives it back. armPlayer()/armCrew while one lies on the floor removes the one on the floor. paint.dispose() removes it; paint.reset() leaves it.
- It is not saved: a restore must stage it again (armCrew(game), then paint.drop(spot)).

(C) THINGS PELLETS LAND ON (used by the kit; missions may use it)
- paint.addTarget({ pos, r = 0.5, lo = 0.2, hi = 1.9, lock = true, on = true, onHit(point, power, by) }) -> target. pos is a live { x, y, z }; a cylinder from pos.y+lo to pos.y+hi. The marker locks on to it like a guard. target.on = false leaves it out. paint.removeTarget(t).
- Props (paint.addProp) now lose `power` hits per pellet.

(D) THE ENERGY KIT: game.energy (same object as game.paint.energy; src/combat/energy.js exports Energy, EnergyFoe, ENERGY_COLOR = '#8a6bff'). It is updated from paint.update, so nothing has to be called per frame.
Common options: color, hit: 'mark' (default: paint.strike, one mark; missions keep checking paint.hits >= OUT_AT) | 'knock' (thrown back, no mark) | 'both' | 'call' (only onHit), label (HUD word), knock (metres; default 2.4 for knock/both), onHit('player', attack). After a hit nothing else hits for 1.0 s. Only Nehorai on foot and out of a cutscene is hit; friends never.
- energy.ringAttack({ at: { x, z, y? }, r = 4, warn = 1.4, onBurst }) -> { done, struck, cancel() }. A ring outline with a disc filling from the middle, blinking faster; at `warn` it bursts and hits him if he is inside.
- energy.beamSweep({ from: { x, z, y? }, angle0, angle1, len = 14, warn = 1.2, seconds = 2.4, width = 0.9, height = 1.0, onDone }). Angles are yaw (0 = +z, PI/2 = +x). During warn: a blinking line along angle0 and a faint fan over the arc. Then the lit beam turns from angle0 to angle1. It stops at the first solid thing, and hits him only with a clear line from `from` (ray to 1.0 m, or 0.4 m when game.player.crawling/prone/low).
- energy.bolt({ from: { x, y?, z }, to: { x, y?, z } | target: 'player' | npc, speed = 7, r = 0.45, warn = 0.5, homing = 0 (rad/s), life = 6, onStop(attack, point) }). Gathers at `from` with a thin lane on the floor (following a target), then flies straight. Colliders and the ground stop it; attack.stopped is where.
- energy.addCatcher({ x, y, z, r = 1, onBolt }) / removeCatcher(c): something a bolt can be lured into.
- energy.clear(): every attack put away (paint.dispose() calls it). energy.active: count. energy.struck: hits on Nehorai so far. energy.sparks(x, y, z, color, n, speed). energy.dispose().
- energy.foe(opts) = new EnergyFoe(game, opts).

(E) EnergyFoe(game, { npc | model, hp = 6, at: { x, z, yaw?, y? }, name, color, r, height, bar = true, vulnerable = false, hint, tag, downPose = 'down', onHurt(foe, n), onDown(foe), onBody(foe, power), onFound(foe), onCopy(foe, left), onShield(foe, i, left), onWeak(foe, on) })
- npc: e.g. game.npc('keeper') or game.npc('shadow'); or model: a bare makeCharacter model the foe places, animates and frees. Size defaults: person r 0.5 / height 1.85, energy being r 0.75 / height 3.0 (times spec.height).
- Pellets on the body do nothing (HUD hint, onBody) unless foe.vulnerable = true; then each takes the marker's power off hp.
- foe.teleport(to: { x, z, yaw?, y? }, { out = 0.4, wait = 0.7, into = 0.4, onArrive }) -> false if already going or down. Fades out, a column of light and a ring stand at the destination for the whole time, fades in. foe.teleporting, foe.teleports.
- foe.spawnCopies(n, spots: [{ x, z, yaw? }], { seconds = 0 }) -> number made. With more spots than copies the real one teleports to a leftover spot chosen at random. A pellet on a copy pops it (onCopy); a pellet on the real one pops them all (onFound). The tell: copies cast no shadow and flicker for 0.12 s every 2-4 s. foe.copies, foe.clearCopies().
- foe.addShield({ generator: { x, y, z } | paint prop, kind: 'shoot' | 'overload' | 'switch', hits = 3, r = 0.6 }) -> index. While any is up pellets splash on a bubble round the foe and the marker does not lock on the foe. 'shoot' at a point: a target the marker locks on to, taking `hits` (power counts). 'overload': a bolt reaching within r+0.5 brings it down. 'switch': the mission calls foe.shieldDown(i). A line of light runs from each generator to the foe. foe.shielded, foe.shieldsUp, foe.shields[i].up.
- foe.exposeWeak(seconds = 5) / hideWeak(): a glowing ball at its core the marker locks on to; pellets on it take power off hp. foe.exposed.
- foe.hurt(n = 1), foe.hp, foe.maxHp, foe.down (at 0: onDown, off the boss bar, downPose).
- foe.ring(opts), foe.sweep({ arc = 1.6, ...opts }), foe.shoot(opts): the kit's attacks from where it stands, aimed at Nehorai by default.
- foe.breakArmor() -> true once: sparks and model.setArmor(false).
- foe.place(x, z, yaw, y), show(on), fade(0..1), update(dt) (the kit calls it; a second call in a frame does nothing), dispose() (removes targets, generators, copies, bubble; an Npc is left standing, a bare model is freed). paint.dispose() does not dispose foes.
- Boss bar: chapter nine's #bossBar with the name and hp; tag line: "מגן · N מחוללים", "נקודת התורפה חשופה!", "מי האמיתי?", else opts.tag or "לחשוף את נקודת התורפה" / "לסמן אותו!". Hidden while a fist Fight runs. hud.setBoss now accepts b.tag.

(F) THE CAST (src/characters/extras.js, builder.js), all invented, all via game.npc(id)
- 'keeper' "שומר הסף" (export KEEPER): spec { energy: { color, rim, core } }. makeCharacter returns its own model: a tall translucent violet-blue body tapering to a wisp, a faceless head with a ring over it, a bright core, two floating blades, circling shards; about 3.2 m; 5 draw calls. Same handles as a person's model (setPose('aim'|'guard' blades forward, 'down' collapsed), play(name, { onHit, onDone }), flash, setOpacity).
- The Shadow's energy suit: game.npc('shadow').model.setArmor(true | false); model.armor tells. Dark plates, violet strips, a chest core, a helmet with a lit visor; two extra skinned meshes, built hidden (chapter nine's Shadow is unchanged). There is no separate 'shadowArmor' id.
- New spec options: armor: { color, glow, visor, helmet, on }, shield: { color, stripe } (model.setShield(on), model.shield), energy: {...}. All models: setOpacity(a), opacity, setShadow(on).
- export ORDER_SPECIAL = { shieldman: ['sh1','sh2','sh3'], heavy: ['hv1','hv2'], runner: ['rn1','rn2','rn3','rn4'] }; og1..og18 as before.
  - sh1-3 "נושא מגן": paint.addGuard reads spec.shield: a pellet from within 0.9 rad of his facing splashes (HUD "המגן בולם · לאגף אותו", paint.onShield(guard, by)); he turns slowly (rate 1.2), so circling him or a friend at his side marks him.
  - hv1-2 "לוחם כבד": spec.marks = 3: three marks (two from the long marker); fires 1.6x slower.
  - rn1-4 "רץ": spec.rush: no marker; once alerted he runs in, winds up 0.6 s within 1.5 m, then shoves: paint.strike('נדחפת!'), a 1.4 m push, paint.onPlayerHit; a friend is marked. One pellet marks him.
  - addGuard(npc, points, color, { quick, still, shield, tough, rush }) overrides the spec.
- export FIGHT_AS = { shieldman: { hp 80, guard 0.85 }, heavy: { hp 150, power 1.25, windup 0.95, open 1.0, armor 0.7, knockdownAt 0.5, moves ['slam','swing'] }, runner: { hp 50, power 0.8, aggression 1.5, windup 0.45, open 0.9 } }. Use: { npc: game.npc('hv1'), ...FIGHT_AS.heavy }.

(G) THE LAST FIST FIGHT (src/combat/fight.js, fighter.js)
- new Fight(game, { ..., special, openings, impact, finale }); finale: true turns the three on. All default false. fight.opts tells.
- special: fight.charge 0..1 fills with landed hits (light 0.1, on armor 0.06, finisher 0.22, heavy 0.2, shove 0.05, counter 0.3). #btnSpecial "מכה מיוחדת" (key O) shows only in such a fight, dim with a meter, lit at full. fight.special(): camera pushes in (fov x0.7), heavyload then an uppercut (MOVES.special: 46 x 1.25 x power, through block and armor), slow motion 0.2 for 0.55 s on impact, a flash, he is thrown back 1.9 m (half with armor) and floored 2.2 s. Nehorai cannot be hit for 1.1 s. Pressed early: "עוד לא טעון". If the target is gone, 0.6 of the charge is kept. fight.specials counts.
- openings: after a heavy punch or finisher lands as 'hit'/'broken', a shove stops a wind-up, or his swing is dodged, "עכשיו!" shows for OPENING = 0.85 s. #btnPunch in that time is fight.counter(): MOVES.counter (15, big, counted double), a step in of up to 1.5 m. Late, it is an ordinary punch. fight.counters, fight.openingsShown, fight.opening.
- impact: on Nehorai's hits a longer flash, pale sparks, a stronger shake, and 0.14 s of slow motion on big hits.
- game.slowmo(scale = 0.3, seconds = 0.5) (also export slowmo(game, scale, seconds) from fight.js): the whole game at `scale` for `seconds` of real time, easing out over the last 0.1 s; game.slowScale is the factor now.
- HUD: hud.setSpecial(frac | null), hud.setOpening(frac | null), hud.setMarker(name | null, accent). controls.onSpecial; controls.hold.fire.

**Notes for mission authors:**

1. src/game.js: own slowmo(scale, seconds) and this.energy. Today paint.js's constructor hangs game.energy and game.slowmo on the game, and slowmo (in fight.js) wraps the instance's update while it lasts. A time scale applied inside update would be cleaner. Also progressForChapter(n) could return marker: null so a try-out start drops an old choice.
2. src/main.js: pass special: document.getElementById('btnSpecial') to Controls (controls.js finds it by itself for now); add 'btnSpecial' to state.buttons and { kind, dropped } to state.paint for the stage tests.
3. package.json: add tests/energy.test.mjs to test:ch10.
4. src/ui/style.css: the styles for .marker-kind, .act-special and .opening are injected by hud.js (STYLE10); they can move into the stylesheet.
5. src/player/controller.js (moves part): energy.js reads game.player.crawling (or .prone / .low) to aim beams and bolts low at a crawling player, so low cover protects him. If the crawl flag has another name, expose one of these.
6. src/characters/poses.js (moves part): the special attack reuses 'heavyload' then 'uppercut' (MOVES.special.anim). A dedicated action could replace it by changing that one field.
7. src/audio/sound.js (portal part): the kit plays the existing beep / hit('crash') / shot / splat. When the energy-bolt and thunder sounds exist, call them in energy.js (ringAttack, beamSweep, stepBolt, burstBolt).
8. src/friends/npc.js: a per-npc walking speed scale, if the heavy should also walk slower (today he is slow only with his marker and in fists).
9. Mission authors: m47's rack calls game.paint.setKind(kind). m50 calls paint.drop(spot) and, on its own prompt while paint.nearDropped(), paint.pickUp(); between the two do not call armCrew (it would remove the marker on the floor). Every cleanup and restore: foe.dispose() for each EnergyFoe, then paint.dispose() (which also clears energy attacks). For a generator the player must shoot, pass a point to addShield so the marker locks on to it.

**Left simple or untested:**

- No separate 'shadowArmor' spec: the suit is model.setArmor(true|false) on the existing 'shadow'.
- The heavy does not walk slower (npc.js is not mine); he only fires slower and takes three marks.
- The dropped marker is not saved in the progress; after a reload the mission's restore has to drop it again.
- Energy attacks only ever hit Nehorai. A bolt aimed at an npc flies to him and passes; friends are never marked or pushed by the kit.
- The crawl check relies on a flag name I could not confirm (player.crawling / prone / low); until the moves part sets one, a crawling player is treated as standing.
- "Stronger hit reactions" are flash, sparks, shake and a blink of slow motion; no new animations (poses.js is not mine). The special reuses the heavy load and uppercut actions.
- No dedicated energy sounds; existing ones are used.
- The Keeper's material ignores scene fog (a custom shader), so it does not fade at the other dimension's 80 m fog line; arenas are far smaller than that. I only looked at it under the default daylight with a manual render (no sky drawn in those shots), not under the violet-sky dimension, which is another part.
- Slow motion is a wrap round game.update installed from fight.js, not a real time scale in game.js; it worked in every check but is described under needed_elsewhere.
- The quick marker's spread is random, so its 13 m result varies between runs (5 and 7 of 12 seen); the test only asserts it is under 12.
- The shield bearer keeps his shield in front of his chest when he sits down marked; I left it.
- Not checked on a real phone or at real frame rates: everything was stepped at 30 fps under software rendering. Stage tests for chapters 4-9 were not run (only fists and stash, both green).


## The other dimension, portals, the orb, sky looks, sounds (src/fx/portal.js, sky, daylight, overlay, minimap, sound)

The earlier builder had already finished and committed this whole part on ch10/dimension (8 commits, b407c7b..ef463d1). In this session I merged claude/nehorai-stage-a into it (citadel, energy kit and moves). The merge was clean, with an auto-merge in src/game.js. Commit f5cc092 is that merge, amended to carry the required trailer. I changed no code: after the merge everything passed, so there was nothing to fix.

=== game (src/game.js, a small edit) ===
- `game.rift`: a Rift made in the constructor (`this.rift = new Rift(this)`). It ticks every live portal and orb, plus a crossing in flight.
- `game.dimension(name | null, { seconds = 0, moonYaw = null })` returns the dimension's name (or null). It is the same as `game.rift.dimension(...)`.
- `game.dimensionName` (getter) is the name, or null in the normal world.
- `game.update` now:
  - skips `radio.update()` while a dimension is on;
  - calls `rift.update(dt)` after `fx.update`.
- `game.call(id)` returns early (and shows a toast "אין קליטה · ממד לא ידוע") while in a dimension. This only applies after the active mission's own `step.call` and the "wanted call" have been handled.

=== src/fx/portal.js: exports `Portal`, `makeOrb`, `Rift`, `crossing` ===

**`new Portal(game, opts)`**
Options, all optional:
- `at {x, z, y}`: the spot it stands over. `y` is that spot's floor; without it, the ground there is used. Without `at`, it stands at the player.
- `r = 2.4`: radius in metres (minimum 0.3).
- `yaw`: the direction its face looks. Defaults to toward the player.
- `tilt = 0`: leaned back; π/2 lies it flat, face up.
- `height = null`: its middle this many metres over the floor. Without it, the lower edge is 0.3 m over the floor, so the middle is at floor + r + 0.3.
- `color = '#8a4dff'`, `color2 = '#3f9dff'`.
- `light = true`: one point light, no shadows.
- `sound = true`: the hum, and the crack when it opens.
- `rumble = 1`: camera shake when it opens; 0 for none.
- `auto = true`: `game.rift` ticks it. With `auto: false` the owner calls `update(dt)`.

It is made closed and is not in the scene. It costs three draw calls (disc shader, drawn-in motes as shader points, lightning quads) plus one PointLight. Sparks come from `game.fx`.

Methods and properties:
- `open(seconds = 1.2)` → Promise that resolves when fully open. From closed it also plays the crack: `sound.thunder` scaled by distance, a camera shake, a white-blue `overlay.flash` when within 30 m, and a ring and sparks. `seconds` 0 means open at once.
- `grow(r, seconds = 1)` → Promise that resolves at the new radius.
- `close(seconds = 0.8)` → Promise that resolves when shut. The portal leaves the scene; `open()` brings it back.
- `update(dt)`: a manual tick. While you call it, the automatic tick pauses.
- `dispose()`: frees everything (geometries, materials, light, hum) and settles any pending promises.
- `contains(pos)` → boolean. `pos` is a body's feet; its middle is taken 0.9 m up. With no `y`, the gate's own height is used. True means within 0.92 × r across the face and about 1 m through it. Always false while closed, closing, or less than half open.
- `pull(body, strength = 3, dt)` → true once the body is inside. Call it every frame.
  - `body` is `game.player` (only on foot) or any NPC.
  - It drags the body along the ground toward the middle at `strength` m/s × openness × (1 − grip).
  - Walls still stop the player (it uses `player.push`). NPCs are moved with `cols.resolve` and the ground height.
- `hold(body, grip = 1)`: holding on. 1 resists the whole pull, 0.5 halves it, 0 lets go. The mission weakens it over time and shows its own prompt at the pillar.
- `holding(body)` → the current grip.
- Properties:
  - `isOpen`
  - `state` (`'closed'`, `'opening'`, `'open'` or `'closing'`)
  - `pos` (THREE.Vector3, the gate's middle)
  - `r`, `k` (openness 0..1)
  - `facing` `{x, z}`
  - `place(at, yaw)`
- Also reachable as `new game.rift.Portal(game, {...})`.

**`makeOrb(game, opts)`** (also `game.rift.makeOrb(opts)`)
Options:
- `at {x, z, y}`: without `y`, ground + 1.2.
- `r = 0.35`.
- `hold = { npc, forward, up, side }`.
- `color = '#7a3cff'`, `color2 = '#4fa8ff'`.
- `light = true`, `sound = true` (a higher, thinner hum), `auto = true`.

It is a black-violet sphere shader, with blue lightning and a camera-facing ring quad that bends the air. It is in the scene at once.

Methods and properties:
- `setSize(r, seconds = 0.6)` returns the orb.
- `holdBy(npc, { forward = 0.45, up = 1.25, side = 0 })`: follows `npc.pos` and `npc.yaw`; `null` lets it hang where it is.
- `throwTo(target {x, z, y}, seconds = 1.1, { arc = 1.6 })` → Promise that resolves on arrival. Without `y` it arrives 1.2 m over the ground. It plays `sound.zap`, then stays crackling where it lands.
- `toPortal({ seconds = 1.4, ...portalOpts })` → the new Portal, standing over the ground under the orb and already opening. The orb is disposed.
- `update(dt)`, `dispose()`.
- Properties: `flying`, `pos`, `r`.

**`game.rift` (class Rift)**
- `dimension(name, { seconds, moonYaw })` going in:
  - the sky goes violet with two moons, low in the sky (the great one about 6.6° up, the small one about 8.6°, about 25° apart);
  - shader motes drift around the camera (one draw call);
  - fog runs 5..80 m and the far plane drops to 96 m;
  - the hemisphere and sun light are tinted violet, with the light coming from the great moon;
  - the minimap is covered with "ממד לא ידוע";
  - the car radio and the phone go silent, and `rift.static = true`;
  - then it calls `world.places[name]?.dimension?.(true)`.
  - `moonYaw` sets where the great moon hangs: 0 is +z, π/2 is +x, default 1.9. Without it, `world.places[name].moonYaw` is used when the place has one.
- `dimension(null)` coming out: calls `places[old].dimension(false)` and restores the sky, fog, light, far plane, minimap, radio and the hour of day (night, target, rate) exactly as they were. Calling it twice is safe.
- `static`: the walkie-talkie flag. A mission may clear it when the radio comes back.
- `noSignal()`.
- `moons(yaw)` → the two unit vectors toward the moons.
- `moonPoint(i = 0, dist = 300)` → `{x, y, z}` toward moon i, for a camera to look at.
- `crack(k = 1, seconds = 2)`: cracks of light across the sky, 0..1.
- `crossingNow`.
- `clear()`: disposes every live portal and orb and drops a crossing in flight. It does not leave the dimension.
- `dispose()`.

**`crossing(game, opts)`** (also `game.rift.crossing(opts)`) → Promise: true on arrival, false if dropped. The promise also has `.cancel()`.
Options:
- `to {x, z, yaw, y}`: where the player lands.
- `also [{ npc: Npc | id, at: {x, z, yaw, y} }]`: who comes along and where each lands.
- `dimension`: a name, `null` for back to the world, or left out to stay as it is.
- `seconds = 2.4`: about a third going white, a third all white, a third coming back.
- `onMid(game)`: runs under the white, after everyone is moved and the dimension switched; stage the scene here.
- `onArrive(game)`: runs when the white is gone.
- `cutscene = false`: true keeps the scripted moment going after arrival.

What happens:
- `game.cutscene` is held through it.
- If the player is in the car, he leaves it.
- The player is placed and pushed out of anything solid, so the landing is safe. NPCs get the same treatment and are shown.
- The camera snaps behind the player, and the level of detail and the lamps are refreshed the same frame.
- Health, marker and ammo, money, progress, the squad and `playingAs` are untouched.
- A crossing is dropped if its mission stops being active, or by `fx.resetAtmosphere()`, unless that cleanup comes from inside its own `onMid`.

=== src/world/daylight.js ===
- `game.daylight.preset(name | null, { seconds = 3, toward = null })`. Names:
  - `'sunrise'`: 05:30, sun direction (0.955, 0.15, 0.26), i.e. low in the east, pink-orange horizon, long shadows;
  - `'redSky'`: red sky and light, eased in;
  - `'sunset'`: golden hour, sun direction (−0.94, 0.17, 0.30), low in the west.
- How looks combine:
  - one look at a time; a new one cross-fades from the old;
  - a look blends over the hour, rain and night, so `preset(null)` gives back exactly what those make;
  - `fx.redAlert`'s red still goes on top.
- `toward {x, z}` aims the glow (and the look's sun) at a world point as seen from the player.
- `presetName` (getter).
- `otherworld(on, { seconds, moonYaw })` is the dimension's layer, used by `rift.dimension`.
- `moons(yaw)`, `crack(k, seconds)`.
- `fx.resetAtmosphere()` (a mission cleanup) drops a look at once.
- With nothing laid, the afternoon draws exactly as before.

=== src/ui/overlay.js ===
- `overlay.white(k 0..1)`: the white, at once. At 0.6 and above the HUD is hidden except captions.
- `overlay.whiteOut(seconds = 1)` and `overlay.whiteIn(seconds = 1)` → Promises, in game time. `whiteTo(k, seconds)` is the general form.
- `overlay.notice(text | null, seconds = 4)` → Promise that resolves when it goes.
  - A centred monospace "signal lost" card: dir=ltr, unicode-bidi isolate, takes no touches.
  - `\n` breaks the line. Shown for `seconds` of game time; `seconds` ≤ 0 means until `notice(null)`.
  - The text "DIMENSION UNKNOWN – CONNECTION LOST" is in `lines10.js` as `dimension`.
- `overlay.card(text | null, seconds = 3, { then = null, stay = false })` → Promise.
  - Big title text on the HUD's own black, the same one `hud.fade` uses (chapter nine's end cards), so nothing is duplicated.
  - Real time, as `hud.fade` is.
  - `then` runs under the black. `stay: true` keeps the black for the next card; `card(null)` lifts it.
  - English text runs left to right and Hebrew right to left.
- `overlay.clear()` also removes the white and the notice. `overlay.onClear` is a hook the Rift uses.

=== src/ui/minimap.js ===
- `minimap.cover(text | null)`: the text over a violet static field instead of the map. The mission target is still marked. Rift calls it.

=== src/audio/sound.js ===
- `sound.portalHum({ level = 0.15, pitch = 1 })` → handle `{ set(k, pitch), stop(seconds) }`.
- `sound.thunder(strength = 1)`: the crack and roll.
- `sound.zap(strength = 1, pitch = 1)`: an energy bolt.
- `sound.radioStatic(on = true, { level = 0.12, seconds = 0.25 })`; `false` fades it out.
- `sound.crowd(on = true, { intensity = 0.7, seconds = 1.5 })`: cheering and clapping. Calling it again with `on = true` changes the intensity; `false` fades it out.
- `sound.music('epic' | 'home' | 'action' | 'calm' | null, { fade = 1.6 })`:
  - `'epic'`: drums, galloping bass, strings, a climbing brass theme;
  - `'home'`: a breathing pad, a second voice on the off-beats, a plucked tune with an echo;
  - both are original; `'action'` and `'calm'` are unchanged.
- `sound.quiet()` now also stops the static and the crowd.

**Notes for mission authors:**

1. src/combat/energy.js (the energy kit): play the new sounds in ringAttack, beamSweep, stepBolt and burstBolt. Use `game.sound.zap?.(strength, pitch)` for a bolt and `game.sound.thunder?.(strength)` for a big burst, instead of the beep/crash/shot stand-ins. The as-built guide (docs/chapter10-asbuilt.md line 262) already asks for this.
2. Chapter ten missions, and saving: the dimension is not written to the save by itself. A mission that plays in the grove must call `game.dimension('grove')` in its `restore(m, game, from)` and `prepareReplay`, so a reload comes back in the dimension. Every path out of the mission (done, fail, abandon) must call `game.dimension(null)` unless it hands over to a following mission still in the dimension, and must call `game.rift.clear()` for portals and orbs it left behind. `fx.resetAtmosphere()` drops a crossing in flight and a sky look, but leaves the dimension and live portals on purpose.
3. world/places (grove, citadel): a place that wants its own dimension layer implements `dimension(on)`, and may set `moonYaw` to choose where the great moon hangs.
4. docs/chapter10-asbuilt.md: add the API text from this report (I may not edit docs).

**Left simple or untested:**

- No code changes this session. The earlier builder's work was complete; I merged the main branch, re-ran the checks and amended the merge commit to carry the trailer.
- The 8 earlier commits carry a different model name in their Co-Authored-By trailer. I left them as they were, because the brief says not to reset or recreate the branch.
- Only checked in headless SwiftShader at 844×390. Not checked on a real phone or GPU, and no real-device frame rate.
- The dimension was not seen inside the grove or citadel's own layers, because `places[name].dimension` belongs to another part. It was seen over the open city and desert ground.
- The hold-on pillar prompt is the mission's to show. The engine gives only `portal.hold(body, grip)`.
- The music loops and sounds were checked as signals (they play, stop, never clip). Their quality was not judged by ear.
- Not pushed.


## The last road, the bridge, the safe house's balcony (src/world/lastroad.js, safehouse.js)

The earlier builder's lastroad.js already held most of the road. I fixed where the routes end, made the hills denser, documented the API and wrote the test. Everything else in the safe house (the balcony, the 'threat' picture, `parking`) is new.

== ctx.places.lastRoad (src/world/lastroad.js; the full field list is also in the file's header) ==
World coordinates in metres. A pose is { x, z, y, yaw, s? }: yaw = atan2(dx, dz) is the way a car on it heads; s is metres along its road. Lane = 2 m right of a road's centreline (LANE = 2).

**roads**: { link, hills, east, service, t1, t2, t3, iron } (Road objects: at(s), nearest(x, z), length). The names are unique in the net. world.js paves places.lastRoads = [link, hills, east, service].
- link 'דרך בית המסתור', 225 m: starts on the death road just outside the yard gate (680, -175) and runs south-east onto the iron road at about (868, -56), just past its barricade.
- iron: chapter eight's 'כביש הברזל', which ends at (1000, -24).
- hills 'דרך הגבעות', 306 m: (1000, -24) to the bridge's west end (1294, 50).
- east 'הגישה למצודה', 114 m: (1347, 50) to (1446, 95).
- service 'כביש השירות למצודה', 331 m: from the fork (1230, 20) round the ravine's south end through about (1290, 158), (1335, 178), (1390, 215) to (1446, 235).
- t1 'שביל הרועים', t2 'שביל הבאר', t3 'שביל הוואדי': earth side tracks, drawn by lastroad.js.
- Heights match the citadel: at the citadel's gates.main.outside the surface is y -49.14 and at gates.service.outside y -49.16 (citadel.y is -49.17).

**routes**: point lists [{ x, z }] about 3 m apart, for `game.drivePath([['points', pts]], cruise)` / Autopilot. Lengths in m: link 242, iron 116, main 460, service 553, escape 274, direct 820, convoy 913.
- link: the yard gate to the iron road.
- iron: on to the iron road's end.
- main: the hills road, over the bridge deck, to the main gate's outside (1433, 97).
- service: the hills road to the fork, then the service road to the service gate's outside (1433, 237).
- escape: starts 16 m out of the service gate, where places.citadel.armoured.route ends (escape[0] is 4.3 m from (1424, 235); use pathFrom), and runs back along the service road to the rollover bank.
- direct = link + iron + main; convoy = link + iron + service.
- Routes stop at the gates' outside because the citadel's gates are shut.
- Every route threads the barricades' gaps, whether the barricades are up or down.
- Also: `lengths` (the same numbers) and `lanes` { right: 2, left: -2 }.

**Poses along the way**:
- start: (685.1, -172.2), yaw 1.22.
- join: (868.1, -55.5) on the iron road.
- ironEnd: (999.0, -24.1).

**truck**: Kotzi's chapter-eight truck and its two barrier lines still close the iron road's end at (972, -27). Missions must call `truck.clear()` before a convoy drives routes.iron. `truck.restore()` puts it back. Fields: found (true), cleared.

**fork**: pose (1230.0, 20.0, s 234).
- fork.before: 40 m earlier, (1190.7, 12.3).
- fork.choices: [{ route: 'main', label: 'המצודה', at: (1253.3, 30.6) }, { route: 'service', label: 'כביש השירות', at: (1245.9, 39.2) }]. Each `at` is 26 m along its way.

**bridge**: at (1320, 50), deck y -50.78, yaw π/2, x0 1292 to x1 1348, width 10, length 56.
- Approach poses: west (1277.2, 47.8, on the hills road), east (1360.2, 52.4, on the east road).
- On the deck: westDeck (1298, 52), eastDeck (1342, 52), mid, edge.west (1304.6, 50), edge.east (1335.4, 50).
- gap { x0: 1308, x1: 1332 }; floorY -66.78 (the ravine floor, 16 m down).
- `blow({ fx = null, boom = true } = {})`: the span's meshes, parapet colliders and walking/driving pad go. The wreck shows: hanging broken ends, rubble on both stumps, pieces on the ravine floor, animated flames. A rubble collider across each stump stops whoever comes. **A car is stopped; it does not fall.** Nobody crosses on foot. With fx = game.fx it also runs fx.explode (unless boom: false) and four fx.burn fires. The warning before the blast is the mission's job.
- `restore()`: everything back.
- Also: blown, span, wreck (groups), fires [{ x, y, z }] ×4, burns, onDeck(x, z), overGap(x, z).

**ravine**: { x0 1293.5, x1 1346.5, z0 -68.5, z1 142.5, floorY, rimY, contains(x, z) }. The floor is x 1302..1338, z -60..134, with an 8 m slope. A stone rim wall collides all round; the only openings are the bridge ends.

**gates**:
- main: { x 1440, z 95, y -49.17, yaw π/2, s 108, road 'east', outside (1432.9, 97.0), stop (1423.5, 95.5), far (1399.4, 78.3), inside (1445, 97) }.
- service: { x 1440, z 235, s 325, road 'service', outside (1432.7, 236.6), stop (1423.6, 234.6), far (1397.1, 222.0), inside (1445, 237) }.
- outside is 7 m out of the wall and matches the citadel's gates.*.outside; stop is 16 m out; far is 45 m out; inside is 5 m in and is drivable only once the citadel opens its gate.

**blasts**: 12 items [{ x, y, z, s, road, route, side, kind: 'drum'|'shed'|'wreck'|'tank', size }]. Each stands 12 m off the road, something solid is there, and it is at least 7 m from every route and side-track path.
- link: drum (746, -121), wreck (818, -113).
- hills, route 'common': drum (1031, -33), shed (1050, -6), wreck (1129, -16), drum (1145, 12), tank (1178, -5).
- hills, route 'main' (past the fork): drum (1262, 20).
- service: drum (1270, 70), shed (1255, 113), wreck (1373, 186), drum (1393, 231).

**sideRoads**: [{ name, road, x, z, y, yaw (where a rival car waits), onto, route, s (where it joins), side, path (from the wait spot down the track and on along the route) }]
- t1: waits at (1078.3, -55.8), yaw 0.54; joins hills/common at s 110.
- t2: waits at (1158.0, 47.3), yaw 2.23; joins hills/common at s 206; its path goes on along the service route.
- t3: waits at (1230.7, 142.9), yaw 1.12; joins service at s 156.

**barricades**: [{ name, road, route, s, x, z, y, yaw, gap: [o0, o1] (the open lane in metres right of the centreline), width, up, group, before (pose 45 m earlier), raise(), lower() }]. All are down after the build; raise() adds colliders and shows the blocks.
- 'hills 1': (1071.4, -14.8), gap [-2.5, 2.5].
- 'hills 2': (1215.6, 18.2), gap [-0.5, 4.5].
- 'service': (1342.2, 181.4), gap [-2.5, 2.5].

**dodge**: hills road, s 116..188 (72 m), from (1114.1, -4.1) to (1184.5, 10.8). Marked with posts on both edges. Fields: { road, route, s0, s1, length, start, end, lanes, right, left } (right and left are point lists).

**checkpoints**: car poses on the lane, [{ name, road, route, x, z, y, yaw, s }]
- link (710.6, -150.7)
- iron (899.6, -42.8)
- hills (1011.8, -20.9)
- fork (1182.5, 10.3), on the common route before the fork
- service (1241.0, 31.0)
- bend (1303.8, 169.3)

**rollover**: (1241.8, 48.5), y -51.63, yaw 4.01 (the car's heading as it lies), s 33.
- A shallow hollow 9.5 m off the service road's line, 0.74 m below it, 292 m along the road from the service gate. That puts it near the fork, because the service road is only 331 m long.
- Fields: side 1, lean 1, road (the pose on the road beside it), out (1244.4, 48.8; where Nehorai gets out, facing the citadel), gather (8 spots on the verge facing the citadel), citadel (the yaw toward it, 1.29).

**hills**: 17 mounds [{ x, z, r, blend, y }], on both sides of the hills road and round the service road. They may merge into ridges. Trees stand on them; none by the road.

**Functions and other fields**:
- routeAt(x, z) → { route: 'link'|'iron'|'common'|'main'|'service', road, s } or null. The bridge deck counts as 'main'.
- pathFrom(route, x, z): the route's points from the nearest one on.
- remaining(route, x, z): metres left to the route's end.
- reset(): bridge whole, barricades down, truck back.
- lamps (4 on the bridge), emissives, group.
- tick(camera, dt): animates the stumps' flames only when the bridge is blown and the camera is within 260 m; no allocations.

== ctx.places.safehouse: additions (nothing chapter nine uses was moved or renamed) ==

**balcony**: { x 648.6, z -184.0, y -50.04, yaw π/2, look }. Where Nehorai stands at the east rail looking east over the yard's low wall at the open land and the hills. `look` is a point 300 m east at eye height (949.5, -48.44, -184.0), for a camera.
- The balcony is an L of decking round the house's north-east corner, roofed and railed all round. Local frame (origin (650, -175)): north arm x -16..-0.55, z -13.35..-10.15; east arm x -3.85..-0.55, z -10.15..-5.4.
- Furnished with two chairs, a small table and a cup.
- The roof is a camera ceiling (cols.addFloor) at y + 2.72.

**balconySide**: Erez's spot beside him, (648.6, -185.2), 1.2 m north, yaw π/2.

**balconyDoor**: a makeSite door (setOpen, lock, unlock, open, locked, pos, yaw 0, w 1.0) in the living room's north wall at (635.6, -185.0). It is open after the build and is the only way onto the balcony.
- balconyDoor.inside: (635.6, -184.0), yaw π, in the living room facing the door.
- balconyDoor.outside: (635.6, -186.3), yaw π/2, on the balcony facing east along it.
- reset() now also unlocks and opens it.

**screen.show('threat', opts?)**: a canvas map of the region, schematic and invented, laid out from world coordinates.
- Shows the game's places: Katzir and the safe house in blue; the Iron Base, the Black Port, the facility, the tower and the grove in red.
- Red glowing hatched areas, the largest round the citadel. The citadel is in a white target, labelled 'המצודה'.
- Title 'אזורים בסכנה', a legend, and roads.
- Glow colour #ff4a32.
- opts: { title, caption, places: [{ label, x, z, home }], areas: [{ x, z, r }], citadel: { label, x, z } }.

**parking**: [car, cars[0], cars[1]], the same objects as chapter nine's three bays, for the operation's three vehicles: (671.2, -166.1) yaw 2.36, (665.1, -167.8) yaw 2.02, (673.4, -161.0) yaw 2.70. `cars` itself is unchanged (still two spots).

**Notes for mission authors:**

Nothing outside my files had to change. For the mission authors (m47/m48/m58):
- Call `places.lastRoad.truck.clear()` before the convoy drives routes.iron. Chapter eight's truck still closes the iron road's end, and `reset()` puts it back.
- The routes end at the citadel's gates' outside. To drive into the citadel, open the citadel's gate first, then use gates.*.inside or the citadel's own paths.
- For the armoured car's run, continue with `pathFrom('escape', x, z)` after places.citadel.armoured.route.
- The warning before bridge.blow() and before each blast spot is the mission's job. bridge.blow({ fx: game.fx }) adds the game's own explosion and fires.

docs/chapter10-asbuilt (or wherever the as-built guide lives) should take the API text above.

**Left simple or untested:**

- **Stage tests not run**: I did not run tests/stage-q or tests/stage-t (m34, m46), which are the long stage tests. Every safe-house field those missions use is unchanged (living, seats, screen, lights, gear, outside, car, cars, breaker, tv, sofa, reset), and walk-safehouse passes 179/179. But m34 and m46 themselves were not re-run.
- **Balcony layout**: the house's living room touches no east wall, so the balcony is an L round the north-east corner. Its door is in the living room's north wall; its east arm (in front of the gear room's east wall, north of the front door) is where Nehorai looks east. The terrace's pergola and a gate pillar stand in the view east beyond ±4°.
- **Ravine size**: about 36 × 194 m (floor x 1302..1338, z -60..134) with 8 m slopes, instead of exactly x 1300..1340, z -60..140.
- **Rollover position**: it is 292 m along the road from the service gate, which puts it near the fork (1242, 48), because the service road is only 331 m long.
- **parking**: added as a new list rather than changing `cars`, which keeps its two chapter-nine entries.
- **Sunrise**: not checked here. The balcony faces +x (east), but the 05:30 sun direction belongs to the engine's sky preset.
- **Draw calls at the link view (685)**: not addressed. Probing shows the last road adds 1 call there; the rest is the world already in view.


## The olive grove and its parallel-universe layer (src/world/grove.js, grove-layer.js, olive.js)

ctx.places.grove (src/world/grove.js builds it; the parallel-universe layer is in src/world/grove-layer.js; the olive trees are in src/world/olive.js). World coordinates, metres, y up. Site-local coordinates have their origin at C = (1206, 228), with +x east and +z south. The box is x 1150..1262, z 180..276. Ground height y = -50.77 (Q.y).

GENERAL
- x 1206, z 228, y -50.77; toWorld (makeSite's); box {x0,x1,z0,z1}.
- lamps (6): the 4 low warm lamps under the bulb strings, the island lamp, and the floodlight mast.
- emissives (2): the bulb material, with userData.night 2.6, and the site's lamp material.
- tick(camera, dt): world.js already calls it. It hides the site past 360 m and runs the layer.
- group (the site), ground (the lawn, path and lid meshes, always shown), layer (the dimension group), materials.bulb.

THE ORDINARY PARK
- lot {x0 1226, x1 1262, z0 180, z1 214}:
  - centre (1244, 204)
  - entrance (1260, 198, yaw -π/2)
  - island (1243, 197): a long rounded island 5 × 11.2 m, red-and-white kerb, lamp post in its middle
  - park[3]: car spots (1238, 182.8, yaw 0), (1243.5, 182.8, yaw 0), (1251.4, 211.3, yaw π)
  - 9 parked traffic cars, two green bins and a purple one at x ≈ 1227.5, a hedge and tall trees at x 1224.5.
- sign (1225.2, 216.2, yaw 2.36): "חורשת הזיתים" on two metal poles.
- boulder {x 1222.9, z 217.7, r 1.5}: the white limestone block, solid.
- pathStart (1224.5, 211.7, yaw -π/2), pathEnd (1155.6, 210.6), path[]: 33 points along the paver path's centre line, 3.2 m wide, kerbs both sides.
- gate (1154, 208.5): the open gate in the mesh fence at x 1154.
- lawn (1230, 234).
- goal (1188, 225.6, yaw 0): a metal goal, its mouth facing south. goal.front (1188, 228.6).
- playground {centre (1194, 258), x0 1180, x1 1208, z0 248, z1 268}, dark gravel. Each spot below is in front of its piece:
  - swings (1189, 257)
  - spinner (1198, 255.3)
  - seesaw (1200.5, 263.6)
  - slide (1190, 262.5)
- benches[6]: each {x, z, y, yaw, sit, front}; yaw is the direction the bench faces.
- shed (1156, 189.2): in front of the white shed. hall (1190, 270): by the low white building.
- trees[46]: {x, z, r, great}; the two great olives are at (1216.5, 188.6) and (1216.5, 198.4).
- Also built: 4 strings of coloured bulbs (12 strings in all), the floodlight mast at (1152, 197), reeds, a conifer, the arched court frame at x 1151..1158, z 232..272, and a row of tall trees behind the hall.
- Colliders: every trunk, bench, playground piece, the boulder, the cars, the bins, the shed, the hall, the fence and the hedge.

THE PARALLEL UNIVERSE (the layer is hidden until dimension(true))
- dimension(on): shows or hides the layer and turns on or off every wall, stone and pad of the layer. On: the lid over the rift goes, the bulbs cycle colours oddly, and the trunk veins, adrift pavers and local motes show. Off: the park is whole again and no wall stands. The seals keep whatever state they had. Returns on.
- isDimension(); reset(): every seal shut, symbols, anchors and portal dark, the bridge down. Call reset() from a checkpoint restore.
- landing: nehorai (1230, 230, yaw -π/2), erez (1232.2, 231.8, yaw -π/2). Both on the lawn, at least 2 m from any trunk.
- symbols[0..2]: each {x, z, y, at {x, z, y, yaw π} (the spot 1.35 m south of the stone), lit, light(on), index, group}. A low stone with a glyph and a column of light: dim violet when off, cyan and turning when lit.
  - 0 by the boulder: (1221.2, 219.7)
  - 1 in the playground: (1194, 259)
  - 2 by the goal: (1191.8, 229.2)
- seals[0..2]: each {open(instant = false), shut(), isOpen, panels [{a, b}], mesh}. A translucent violet wall, one collider for each panel. open() takes the collider away at once and fades the wall in 0.8 s; open(true) is instant. Seal i is the wall that lit symbols[i] should open:
  - seals[0]: x ≈ 1214 from z 242 to 275.5. It closes the playground (area 1) off from the landing lawn (area 0: the landing, the lot side and the boulder).
  - seals[1]: x ≈ 1214 from z 205.8 to 242, plus the row of trunks at z ≈ 242 from x 1214 to 1160. It closes off the goal lawn and the path's east bank (area 2) from both earlier areas.
  - seals[2]: two panels across the path, at x 1208 and x 1162, z 211.7..216.3.
  - A fixed edge wall (it never opens) bounds the pocket: the box all round, a stub at z ≈ 205.7 from x 1207.6 to 1223.4, the fence gate, and z 222 from x 1160 to 1162. The far lawn (the clearing and the energy point) is reached over the broken path only.
- brokenPath (the rift box x 1162..1208, z 206..222, dug 9 m deep with a violet glow; covered by lawn and paving when the dimension is off):
  - start (1209.8, 214, yaw -π/2) and end (1160.2, 214), both on the banks. length 46; floorY -59.77; minY -53.77 (below it the player has fallen in); rect.
  - inside(pos): true when pos is over the rift.
  - stones[18], in order along the path: {name, kind 'bank'|'platform'|'stone'|'step'|'bridge', u0, u1 (metres from the east bank), x, z, y, hx, hz, platform?}. The site builds these always-there stones:
    - island A1 (u 10.95..16.6)
    - island A2 (18.8..23.6)
    - ledge foot (29.05..32.2)
    - ledge top (32.2..37, y + 1.6)
    - three steps down (1.2, 0.8, 0.4)
    - landing (38.47..40.3)
  - platforms[7]: {x, z, y, hx 1.4, hz 1.6, period, on, offset, fixed?}, data for the engine's kit. 0 and 6 are fixed (on = period).
    - 1-3 (period 6, on 3.6, offsets 0 / 4.8 / 3.6): a forward wave, each next pair solid together for 2.4 s.
    - 4-5 (period 2.4, on 0.9, offsets 0 / 1.2): never solid together; switch 0 holds them.
  - fields[2]: {x, z, y, r 1.9 / 1.7, period 7, hold 2.5, offset 0 / 3.5}, on islands A1 and A2.
  - switches[2]: each {x, z, y, at, label, opens, steadies}.
    - 0 'לייצב את האבנים' on A2 (1185.1, 217.5): opens [4, 5], steadies [4, 5].
    - 1 'להרים את הגשר' on the ledge top (1172.1, 216.4, y -49.17): opens ['bridge'].
  - leaps[1]: from (1191.75, 216.69) to (1188.85, 216.9), label 'לקפוץ', the 2.2 m gap between A1 and A2.
  - ledge {bottom (1176.2, 215.87, y -50.77), top (1175.05, 215.73, y -49.17), from, to (Erez's hand), height 1.6, label 'לטפס', hand 'לתת יד לארז'}.
  - disturbances[2]: {path [points], speed 2 / 2.4, r 0.7}.
  - safe[18]: the points of the marked cyan line, each on a stone.
  - bridge {x 1166.25, z 214.86, hx 1.5, hz 1.5, on, k, set(on = true, instant = false), group}: three slabs that rise out of the rift in 0.9 s and carry.
  - thrown(i, on): the bridge part of a thrown switch.
  - USE: kit = game.moves.pathKit(game, grove.brokenPath.kit, { friends: [erez], onSwitch: (i, on) => grove.brokenPath.thrown(i, on) }). Pass brokenPath.kit, not brokenPath: brokenPath.safe is an array of points, and pathKit's riftGuard would call it as safe(). kit has none, so the guard falls back to the last firm stone.
- arena {x, z, centre (1182, 193.5), radius 11 (also r), anchors, spots, cover, entry (1162, 203.5)}:
  - anchors[0..3]: {x, z, y, at {x, z, y, yaw} (1.1 m inside the stone, facing it), lit, light(on), index}. Standing stones 1.7 m tall with a glyph and a light column, at (1175.6, 187.1), (1188.4, 187.1), (1175.6, 199.9), (1188.4, 199.9).
  - spots[7]: the centre plus 6 points on a 7 m circle.
  - cover[6]: the trunks within 17 m, {x, z, r}.
  - A faint ring of light marks the edge.
- portalAt {x 1216.5, z 193.5, y, yaw -π/2, lit, mark(on)}: between the two great olives. Rings on the ground and a 7 m column, bright cyan when marked.
- runUp[5]: (1182 → 1191 → 1200 → 1209 → 1216.5, z 193.5), clear and level from the arena centre to portalAt.
- crystalAt (1182, 193.5, y -49.57).

**Notes for mission authors:**

1. The portal/dimension engine (src/fx/portal.js, wherever game.dimension lives; not on this branch):
   - game.dimension('grove') must call world.places.grove.dimension(true), and game.dimension(null) must call dimension(false).
   - A checkpoint restore in the grove should call grove.reset() and then open the seals and light the symbols that its saved state says are done. The site saves nothing itself.
2. The missions (m52-m54): no change in my files is needed, but:
   - When symbols[i] is lit, open seals[i].
   - Build the path with pathKit(game, grove.brokenPath.kit, { friends, onSwitch: (i, on) => grove.brokenPath.thrown(i, on) }). Without that, switch 1 does not raise the bridge.
   - Dispose the kit on cleanup.
3. Nothing else needs changing outside my files: world.js already calls places.grove.tick, and main.js already wires lamps and emissives.

**Left simple or untested:**

- The crowns are stylised: alpha-cut, round-normalled leaf clumps (36-triangle clumps). Up close they look like leafy cushions rather than fine olive foliage. A person who knows the place should recognise the trunks, the silver-green colour, the layout and the props, but the canopy is an approximation.
- Leaf alpha at a distance: crowns are about 65% covered, so far away they turn solid under mipmaps. I did not test this on a real phone.
- The engine's violet sky, moons and fog are not on this branch. The dimension screenshots therefore show the layer under the ordinary sky; the look under the engine's sky is not checked.
- Not real coordinates: the videos show no overhead view, so the layout follows the relative layout from the brief and the frames (lot and boulder east, path curving west past the goal and benches, playground south, shed/fence/court west).
- About 1.8 m of the crowns of the six tall trees behind the hall overhang the box's south edge (z 276); their trunks stand at z 275.4. Nothing else is there.
- The olive count is 46: "about forty", with three of them on the playground gravel as in the videos.
- 79k triangles of the grove's own (58k of them olives) is on the heavy side for a phone. Its own draw calls are low. Not measured on a device.
- Not run: the long stage tests and other sites' walk tests. Only grove files were touched.
- Only the two contact-sheet pages of video b were looked at, plus video a's sheet; I did not open the individual f01..f06 stills, to save budget.


## The finale: the crowd, the ending cards, the credits, the finished game (src/friends/crowd.js, src/ui/ending.js)

THE FINALE (engine piece 4) — as built. Units are metres and seconds. Yaw follows the game's rule: forward is (sin yaw, cos yaw).

== src/friends/crowd.js ==
import { Crowd, SIGNS } from '../friends/crowd.js';
SIGNS = ['תודה שהצלתם אותנו!', 'הגיבורים של קציר!', 'נהוראי והחבורה!'] (the spec's exact texts).

new Crowd(game, { along, at, count = 36, signs = SIGNS, lane = 3.2, depth = 2, length = 60, walkers = [game.player.pos], seed = 0 })
- along: [{x,z}, ...] (at least 2 points) is the walking lane's centre line. People stand on both sides of it, in families and groups of 2-4 (children in the front row, adults and sign holders behind), spread along the whole path. Nobody stands closer than lane+0.6 m to the centre line; normally they stand lane+0.75 to about lane+2.5 m out. If more people are given than the path holds, the extras stand 1.7 m further back. Each spot sits on world.groundHeight. A spot that is blocked by a collider, or that lies more than 1.2 m off the road's level, is moved further out.
- along can instead be an area {x0,x1,z0,z1}. The crowd fills it in rows, everyone facing `at`, and there is no lane.
- at: {x,z,yaw} with no `along`: the lane is a straight line through `at` in direction yaw, `length` m long.
- lane: half-width of the clear walking lane. depth: rows per side. seed: changes who stands where (the crowd is deterministic).
- Katzir's way in: the access road 'כביש הגישה' STARTS at the village (s=0 is (172,30)), and the main street 'דרך הגבעה' also starts there.
  - Test lane: access road s=25→0, then main street s=0→20, every 5 m. That is 45 m for 36 people.
  - For the doc's full stretch (access road s=50→0 plus main street 0→40, 90 m), use about count 70 for a lined look. It is still one draw call.
- crowd.cheer(level 0..1) eases in over about 1 s:
  - 0: standing, arms down, swaying
  - about 0.3: everyone claps in front of the chest
  - 0.45 to 0.85: wavers wave one arm high, cheerers raise both arms
  - above 0.7: children and some adults hop (up to 0.2 m)
  - Sign holders always hold the board up over their heads and pump it harder as the level rises.
  - Sound: calls game.sound.crowd(true, { intensity: level }), or crowd(false, { seconds: 1.2 }) at 0. This is the ch10/dimension sound API and is called only if the function exists.
  - Returns the crowd.
- crowd.lookAt(point | null): everyone turns, each 0-0.5 s late at 2.6 rad/s, but never more than ±1.25 rad from facing the road. A live position (game.player.pos, npc.pos) is followed as it moves. null turns them back to the road. Returns the crowd.
- Making room: anyone in crowd.walkers (default [game.player.pos]; you can push npc.pos into it) who comes within about 1 m of a person makes that person step back from the road, then return.
- The crowd animates by itself: it is in game.activities. update(dt) exists only for stepping a held game by hand. When the camera is more than 320 m away it skips the work and hides.
- crowd.dispose(): removes the mesh from the scene and the crowd from game.activities, frees the geometry, both materials and the texture, and turns the crowd sound off.
- Properties:
  - people[]: per person x, z, y, h (scale; children 0.56-0.7), style 'clap'|'wave'|'cheer'|'sign', sign (row 0-2), child, push, yaw, face
  - size; signs (texts); canvas (canvas.dataset.signs = JSON of the texts as painted); texture; mesh (an InstancedMesh named 'crowd'); depthMaterial; walkers; level/target; center; laneDistance(x,z)
- Default 36: 8 children, 8 skin tones, 12 shirt colours, long hair, skirts, caps, 9 sign holders, each side holding all three texts in turn.
- No colliders at all.
- Design: one InstancedMesh with one merged low-detail figure (about 790 triangles). The vertex shader swings the arms about the shoulders, folds away parts a person does not wear, and picks per-instance colours. Signs are part of the same figure and sample one 640×960 canvas (three rows of RTL text, two lines when long). CPU work is a little trigonometry per person per frame plus a small buffer upload.

== src/ui/ending.js (makes its own DOM and <style>, inserted just before #failMenu so the pause menu stays above it) ==
import { endingCards, credits, closeEnding, skipEnding, endingOpen, creditMoments, CARDS, THANKS, MOMENTS, ENDING, MENU_LABEL, SKIP_LABEL, CAST_TITLE } from '../ui/ending.js';
- CARDS = ['NAHORAI FARHI','THE END','LEGENDS NEVER FIGHT ALONE']; THANKS = 'THANK YOU FOR PLAYING.'; MENU_LABEL 'חזרה לתפריט הראשי'; SKIP_LABEL 'דלג'; CAST_TITLE 'דמויות בדיוניות'.
- endingCards(game, { speed = 1, onClose }) → Promise<{skipped, closed?}>
  - Black fades in over 1.5 s. Then the world is held (game.hold = true, cutscene = true), the HUD is hidden, the controls are off, and sound.music('home') plays.
  - Each card is left-to-right and isolated, one line, large: fade in 1.1 s, about 3.2 s up, fade out 0.9 s, gap 0.2 s. About 14 s in all.
- credits(game, { moments = MOMENTS, speed = 1, momentSeconds = 6.5, onClose }) → Promise<{skipped, closed?}>
  - Resolves when THANK YOU FOR PLAYING. is on screen. The button appears 1.4 s later and stays until it is pressed.
  - Live moments:
    - Black cuts, letterbox bars, then for each chapter the game's own camera arcs slowly round the place. game.follow.override is set each frame, game.hold = false, cutscene = true, and the world's LOD is forced at each cut.
    - The chapter title and its line show bottom-right.
    - MOMENTS: [{chapter, title, line, shots:[{at:'placeKey'|{x,z}, r, h, up, a0, sweep}]}]. A place that is missing is dropped; a chapter left with no places is skipped. Places: plaza+gymLot, kiosk+hadera, courtRing+court, bank, pub+villa, yard, fort, ironBase+hq, port+tower, citadel+grove.
  - Then the cast roll over Katzir: 'דמויות בדיוניות', the ROSTER names of CAST_ORDER, and 'כל הדמויות, המקומות והאירועים במשחק בדיוניים.' Runs about 4 + 1.15 s per name.
  - Then the thanks over a dimmed, slow orbit of Katzir's way in (the first point of places.mainRoad).
  - Total is about 90 s.
- 'דלג' (or skipEnding()) at any moment jumps straight to the thanks. Pending waits wake, endingCards resolves {skipped:true}, and a later credits() resolves at once.
- The button closes the overlay, then calls game.mainMenu() (main.js), or else saves and reloads.
- onClose callbacks run once when the overlay goes. Use one to dispose the crowd so it is still there under the thanks.
- closeEnding(game, { restore = true }): removes the overlay; hold=false, cutscene=false, override cleared, camera behind Nehorai; with restore, the HUD and controls go back to how they were. After it, any endingCards/credits call within 1.5 s (the rest of a chain) opens nothing and resolves {closed:true}.
- The ending also closes itself if the mission active when it began is no longer active before the thanks (for example, the pause menu's way home).
- The ending's clock runs on its own rAF, capped at 0.1 s per frame, and stops while #pauseMenu is visible.
- ENDING = { speed (test multiplier; 0 freezes), phase 'open'|'cards'|'cards-done'|'credits'|'cast'|'thanks'|'closed'|'menu', log [card texts, 'moment:<ch>', 'cast', THANKS], skipped, moment (the chapter whose shot is on screen, else null) }.
- endingOpen() → bool. creditMoments(game, moments) → the moments with resolved positions.

== src/save/progress.js ==
- newProgress().finished = false.
- loadProgress keeps finished === true.
- markFinished(game): sets game.progress.finished = true and saves now (game.save()). Returns true when saved.
- The mission's reward unlocks 'chapter-10'.
- A new game clears the mark: newProgress, or clearProgress plus a reload.

== src/main.js ==
- Start screen: when the save has finished, a line '★ המשחק הושלם · עשרה פרקים' (#finishedLine) appears under the game's name. Its own <style id="finishedStyle"> is injected once.
- 'להמשיך' opens the free roam as before.
- game.mainMenu(): no reload.
  - It saves, sets started=false, turns off the controls, hold and cutscene, hides the HUD and shows #startScreen. It replaces #startBtn/#newGameBtn with fresh clones (old listeners dropped) and shows the finished line.
  - 'להמשיך' goes back to the game: music(null), HUD, controls, showNext.
  - 'משחק חדש' clears progress and reloads cleanly.
- Test handle: window.__game.finale = { Crowd, SIGNS, markFinished, ...ending exports }.

== For m59 (recommended) ==
Last step:
enter(m, game) { markFinished(game); endingCards(game, { onClose: () => crowd.dispose() }).then(() => credits(game)).then(() => { m.s.fin = true; }); }
update(m) { return m.s.fin ? 'next' : null; }
- Keep the mission active until credits() resolves. The mission then completes behind the thanks screen, and its banner stays hidden with the HUD.
- In cleanup: if (!m.done) closeEnding(game).
- reward: { unlocks: ['chapter-10'] }.

**Notes for mission authors:**

1. src/missions/m59-homeward.js (mission builder):
   - Use Crowd / endingCards / credits / markFinished / closeEnding as described in api. Set reward.unlocks ['chapter-10'].
   - Keep the mission active until credits() resolves. If it completes earlier, the ending closes itself as 'mission left'.
   - Build the crowd's `along` from 'כביש הגישה' s=50→0 then 'דרך הגבעה' s=0→40 with count about 70, or a shorter stretch with 36.
   - Dispose the crowd in the ending's onClose so the thanks shot over Katzir's way in still shows it.
2. package.json: add `node tests/finale.test.mjs` to the "test:ch10" script (not my file). The test takes about 20 min here.
3. docs/chapter10-asbuilt.md: add the finale section (the api text above).
4. Sound: crowd.js calls game.sound.crowd(on, { intensity, seconds }), and ending.js calls game.sound.music('home'). Both exist on the ch10/dimension branch. On this base music('home') falls through to silence and crowd() does not exist, which is harmless.
5. Optional, main.js: during credits the sun's shadow box still follows Nehorai (sky.follow focus), so far-away credit shots have no sun shadows. The fix is to let `focus()` follow game.follow.override.look while an ending is open; I left it out of main.js because it is outside the start screen and the menu.

**Left simple or untested:**

- Approximations:
  - Credit shots far from Nehorai have no sun shadows (see needed_elsewhere 5).
  - Moments are camera fly-overs of the places as they stand now. They are not replays of the chapters' events, and no characters are staged there.
  - The olive grove shot is skipped on this base because places.grove is not there yet; it shows after the grove branch is merged, but I did not see it.
  - The crowd is low-detail and stylised: no knees or elbows, a fixed smile, the sign held in both hands with no stick.
- Not verified:
  - A real m59 flow end to end (the mission is still a stub here).
  - The crowd's and the ending's sound on the dimension branch's sound.js.
  - The 1.4 s button delay and the CSS fades in real time on a phone. The test runs at ENDING.speed 4-5, and the screenshots are frozen frames.
- Not done:
  - Other stage tests and resume.test were not run (not asked).
  - The as-built doc was not edited (not my file).


## After the merge (what the integration changed)

- The energy kit plays the dimension's sounds where they exist: `sound.thunder` for a ring's burst, `sound.zap` for a
  bolt and a beam going live (the old stand-ins otherwise).
- `window.__game.state.buttons` lists `btnSpecial`; `state.paint` carries `kind`, and `{ dropped: true, kind }` while
  the player's marker lies on the floor.
- A crawl ends with its mission (`missions.stop()` and `complete()` unless the next mission carries the scene on).
- Wheels spin by `model.userData.wheelRadius` (the armoured car's are 0.62 m).
- `npm run test:ch10` runs the chapter's engine and site tests.
