# פרק 8 · מבצע סופת אש — מדריך בנייה

This is the build guide for chapter eight ("מבצע סופת אש", OPERATION FIRESTORM). Nehorai is back at the
controls; Erez, Ido and the whole gang are his squad. Everything is fiction; paint, never blood; blasts
are stylised fire and smoke and never hurt without a warning. Hebrew UI, RTL. No real places, no brands.

## Where things are (world coordinates)

The map was extended east: `BOUNDS.x1 = 1300`, `PLAY.x1 = 1240` (src/world/world.js). East of Kotzi's fort
(x > 480) the land is the coastal plain at about y = -50. Every site flattens its own pad in `layout()`
(`net.addPad({ x, z, hx, hz, yaw: 0, h, top: 0.05, blend: 10, name })`, `h = baseHeight(cx, cz)`), pushes a
`keepOut` rectangle so no trees stand in it, and builds in `build()` with `makeSite` from
src/world/compound.js, exactly like src/world/fort.js and src/world/depot.js. Sites and their centres:

| site | file | centre | size | notes |
|---|---|---|---|---|
| the hideout (מחסן המסתור) | src/world/hideout.js | (640, -60) | 44 × 28 hall | the opening and the fire escape; the Renault waits in the yard east of it at about (672, -56) facing east |
| the iron road (כביש הברזל), chase 1 | src/world/ironroad.js | from (660, -40) east | a highway | roadside blast spots, a fork at about (950, -20): straight on is blocked by Kotzi's truck at about (1010, -5); the left branch bends north-east to an old covered tunnel from about (1060, -120) to (1110, -150); it ends about (1170, -200) |
| the Iron Base (בסיס הברזל) | src/world/ironbase.js | (1120, -280) | 110 × 90 yard | three floors in the main building, towers, stores, control room on the top floor, hidden areas; gate on the south side |
| the bridge (הגשר) | src/world/bridge.js | deck centre (1020, 150) | deck 80 × 16 | a ravine 40 m wide running north–south at x 1000..1040 (a pad 18 m lower, blend 12); the deck is a `level()` at the plain's height; parapets, abandoned cars as cover; east end about (1070, 150) |
| Kotzi's road (chase 2) | src/world/kotziroad.js | from (1070, 150) | industrial strip, highway, ruins | south along x ≈ 1095 (containers and sheds either side, z 190..280), west along z ≈ 300 (a wide highway with two ramps), the abandoned compound at (820, 270), then north to the headquarters' gate at (790, 190) |
| the headquarters (המפקדה) | src/world/hq.js | (760, 120) | 160 × 130 | the biggest map: an outer yard with towers, a garage, a server hall, control rooms, security (cameras, breakers), a hidden passage, the command room at the north end; gate on the south side at x = 790 |

Keep each site inside its box; the fort's pad reaches x = 474 and z 151..249, the hideout's z -74..-46, the
headquarters' z 55..185: they must not overlap. Lamps and emissives: push to `S.lamps` / `S.emissives`
and expose `lamps`, `emissives` on the place object (main.js wires them to the night).

## Engine pieces you can use (all already in the repo)

- **Blasts, fire, smoke** — `game.fx` (src/fx/fx.js): `fx.explode(x, y, z, { size, fire, light, shake, sound, debris })`
  (size 1 ≈ a car, 2.5 ≈ a building front; `fire` = seconds of flames afterwards), `fx.burn(x, y, z, { r, strength, seconds })`
  → handle with `.stop()`, `fx.smokeColumn(...)`, `fx.sparks(x, y, z, n)`, `fx.dust(x, y, z, size)`, `fx.ring(x, y, z, r)`
  (a red warning ring mesh; remove it with `.removeFromParent()`). Shake happens on its own by distance.
- **Sound** — `game.sound?.boom(strength)`, `game.sound?.siren(seconds)` → stop function, `game.sound?.beep(times, pitch)`,
  plus the old `hit('crash', k)`, `chime(true)`, `splat()`.
- **A blast that warns first** — `new Blast(game, { at, size, warn, radius, fire, onBoom, hurts })` from src/missions/firestorm.js:
  a ring and beeps for `warn` seconds, then the explosion; Nehorai inside `radius` takes a mark (`paint.strike`). Tick it with
  `b.update(dt)` from the step's `update(m, game, dt)`; `b.done` when over; `b.cancel()`.
- **Work** — `new Work(game, { at, seconds, label, pill, near, onDone })`: something the player operates for a few seconds;
  return `work.interaction(game)` from the step's `interaction()`, tick `work.update(dt)`.
- **A friend's job** — `new Job(game, { who, at, seconds, pill, near, onDone })` (src/missions/rescue.js): Ido at a lock, a
  friend at a valve; it always completes (a watchdog places him). Tick `m.job?.update(dt)`; cancel in restore/cleanup.
- **A falling beam** — `dropBeam(game, { from, to, len, yaw, seconds, onLand })`: falls, dust, then blocks. Tick `.update(dt)`;
  `.remove()` clears it. **A friend pinned** — `pin(game, id, at, { onFree })` → a Work to free him.
- **Floors** — in a site: `S.level(lx, lz, hx, hz, floor)` makes a storey `floor` metres up (a walking surface, a floor
  for lines of sight, a slab); walls on it: `wall(..., { h, floor })`, doors: `door(lx, lz, yaw, w, { floor, locked })`;
  `S.stairs(lx, lz, yaw, { rise, run, width, steps, floor })` is the only way up (returns `{ bottom, top }`); `S.ramp(...)`
  for rubble to climb. The ground follows the walker's own height: `world.groundHeight(x, z, yRef)`; place people on a
  floor with `npc.place(x, z, yaw, y)` and the player with `game.player.place(x, z, yaw, y)`; give targets on a floor an
  explicit `y`. A point on floor k is `{ ...S.toWorld(lx, lz), y: S.y + floorHeight }`.
- **Squad orders** — `game.squad.command('follow' | 'hold' | 'cover' | 'advance')`, `squad.cycle()`; the player has a
  button (`#btnSquad`) that cycles them; `squad.mode` tells the mission which order stands. Form the gang with
  `crew(game, at, yaw)` / `arriveCrew(game, at)` and arm with `armCrew(game)` (src/missions/firestorm.js); `TEAM` is the
  eight friends; `endCrew(game)` at the chapter's end. Erez and Ido must do real things: `Job`s, `squad.send`, lines.
  What the orders do in play (src/combat/paint.js `updateAlly`, src/friends/squad.js): 'hold' — they stay and shoot at
  whoever is on them; 'cover' — they stay, markers up toward the leader's way, and shoot at the guard nearest the leader
  (one on him first), faster, so guards they shoot take longer to aim at him; 'advance' — they go to posts ahead of him
  in plain line. Following, a friend goes to his place beside the leader only if it is on the leader's floor in plain
  line from him, else to the leader's own footsteps; one who makes no progress toward his own goal, or is left on another
  floor, is put back on the leader's trail. `squad.form()` starts a fresh trail. Call-outs never cut a story line.
  Guards with a fixed floor never step off it (npc.js `onFloor`); a standing guard turns and aims, he does not chase.
- **Things to shoot that are not people** — `game.paint.addProp({ x, y, z, r, hits, onHit, label })` (a sensor, a lock,
  a lamp): the player's pellets count; `prop.done` when all hits landed; `paint.removeProp`, `paint.clearProps()`.
- **Guards** — `postGuards(game, place, [[id, routeKey, opts]])` / `hideGuards(game, ids)` / `left(game, ids)` as in chapter
  seven; `place.patrols[routeKey]` is a list of points (`{x, z, yaw?, y?}`); a single point = standing still. Guard ids:
  guard1–4, vg1–9, kg1–8, fg1–12 (33 people). For waves, `paint.revive(gd)` puts a marked guard back up; `paint.setRoute`.
  Kotzi is `game.npc('kotzi')`; his crew: shpitz, roller, tosti, bulldozer.
- **Helicopters** — `const h = new game.Heli(game); h.orbit(x, z, { r, h, speed })` or `h.shadow(() => ({ x, z, yaw, y }), { ahead, h })`
  or `h.pass(from, to, { h, seconds })`; push to `game.helis`; `h.dispose()` and remove from `game.helis` in cleanup.
- **Chases** — `new Pursuit(game, { grace, cars, gap, lines })` (src/missions/pursuit.js) for rivals behind the Renault;
  tick `m.pursuit.update(dt)`; `m.pursuit.escaped`. A car driven by the game: `new Vehicle(world, makeHatchback({ color }), { name, maxSpeed })`,
  `game.scene.add(car.model)`, `car.place(x, z, yaw, y)`, drive it with `new Autopilot(points, { cruise })` → `car.update(dt, auto.drive(car))`
  (see m19-taken.js for the van). Road points: `road.at(s)` gives `{ x, z, h, tx, tz, nx, nz }`; `roadPath(road, s0, s1, lane)`.
  Blocks across a road: `cols.addBox(...)` plus a drawn truck (a hatchback scaled, or boxes).
- **The clock on the pill** — `clock(game, seconds)` / `clock(game, null)`; `fmt(seconds)` → "1:32".
- **Radio lines** — `radio(game, 'עידו', 'text')`. Dialogue: `game.dialogue.play([[name, text, 'phone'?], ...])` → Promise.
- **Fist fight** (the boss's last phase) — `new Fight(game, { opponents: [{ npc, hp, power, aggression, moves }], allies, onWin, onLose })`
  from src/combat/fight.js, as m12-fightnight.js does; `m.fight.dispose()` after.
- **Keypad / hack** — `game.keypad.open(code, hint)` → Promise(ok); `game.hack.open(...)` (see m18-cipher.js) for a short puzzle.

## Mission conventions

A mission file exports a def like src/missions/m23-fort.js: `id, chapter: 8, number, title, requires, follows: true,
secret, where, startAt, reward, setup, prepareReplay, failIf, restore(m, game, checkpoint), cleanup, steps[]`.
Each step: `objective`, `checkpoint: true` where a retry (and a reload) should resume, `enter`, `update(m, game, dt)` returning `'next'`,
`target`, `interaction`, `exit`. Objective text in Hebrew, short, says what to do and where; the target gives the marker.
Rules that caught us before: every door the route needs opens before it is needed and is not re-locked by an earlier
cleanup; retry from every checkpoint must be winnable (reset paint with `game.paint.reset()`, re-post guards, cancel jobs,
repair the car); chapter eight's checkpoints, and each mission's start, are saved (`progress.resume`) and picked up after
a reload through `start(id, { from })` = `prepareReplay`, `setup`, `restore`, `enterStep(from)` on a fresh page, so
`restore` must stage the whole scene the step needs (light, doors, people, the car), not only undo the attempt;
tests/resume.test.mjs walks every one; a step must complete from where the player can actually stand; counts must be reachable (use
`nearestGuard` from missions.js for the arrow); people never block doorways (marked ones do not collide). Nothing
decorative: every button and prompt does something.

Chapter eight's missions and ids: m26 `firestorm` (1, השקט שלפני הסערה), m27 `ironroad` (2, המרדף הגדול), m28 `ironbase`
(3, בסיס הברזל), m29 `blackout` (4, הבגידה הגדולה), m30 `bridge` (5, הקרב על הגשר), m31 `kotzichase` (6, המרדף אחרי קוצי),
m32 `lastwar` (7, המלחמה האחרונה), m33 `inferno` (8, הבריחה מהפיצוץ). `requires` the one before; `follows: true` from the
second on; `secret: true` on 4, 7 and 8. The first begins at the lookout in Katzir (`places.plaza`, as m19 does) with a
fade to the hideout. The last rewards `unlocks: ['chapter-8']` and ends on "STAGE 8 COMPLETE – OPERATION FIRESTORM" then
"TO BE CONTINUED IN STAGE 9…".

## Testing

`npm run build` bundles to dist/. Probes and tests drive the page with Playwright on swiftshader: see
tests/stage-n.test.mjs (the harness: `until`, `talkThrough`, `press`, `tp`, `markAll`; the save for a chapter) and
tests/walk.test.mjs (a flood fill of a site with the player's own collision test, from each start to each target).
`window.__game` offers `teleport(x, z, y?)`, `startMission(id)`, `state`, `debug.{game, world, THREE}`. Rendering is 1–2
fps: wait with polls, never fixed sleeps. Add your site to tests/walk.test.mjs and a stage test for your missions.
