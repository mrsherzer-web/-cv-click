# פרק 10 · מה שנבנה בפועל (as built)

What chapter ten's engine pieces and sites really offer, from their builders' reports, for the missions'
builders. Trust this file over docs/chapter10.md for names, signatures and coordinates.

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

**Left simple or untested (moves):**

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
