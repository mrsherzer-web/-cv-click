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
