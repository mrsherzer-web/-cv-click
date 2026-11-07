# פרק 9 · מבצע אלמוות — מדריך בנייה

This is the build guide for chapter nine ("מבצע אלמוות", OPERATION PHOENIX – THE RISE OF NAHORAI). It follows
docs/chapter8.md (read it first: the site builder, floors, blasts, Work, Job, squad orders, paint, the mission
conventions all carry over). The user's spec is the source; this file says where things go and which code
owns what.

## Rules that are never broken

- **No traitor, ever.** Erez, Ido and every one of the gang stay loyal. No spy, no leak, no collaborator, no
  twist that reveals a friend as a traitor. Every threat comes from outside: "המסדר השחור" (the Black Order)
  and its leader "הצל" (the Shadow). How the Shadow knew about them: outside surveillance systems and data
  left in Kotzi's old bases (say exactly that in mission 44).
- Everything is fiction; the characters are game versions; paintball ("צבע, לא דם"): guns are paint markers,
  people are "marked", never killed; no blood, no wounds shown. Nehorai "נפצע" = a blast knocks him down and
  out (dazed, blurred screen, eyes closing), later a bandage on his arm/head — nothing graphic.
- Fist fights are the arcade fights of chapters 3 and 7 (src/combat/fight.js): a hit is a white flash and a
  stagger, beaten people sit down.
- No real places, brands, or people; no real hacking (puzzles stand in); no copied music, maps or UI.
- Hebrew UI, RTL; the user's quoted lines appear exactly as written.
- Nothing decorative: every prompt and button does something; every mission can be completed; every target
  can be reached; a friend never blocks a doorway; no blast hurts without a warning.

## Where things are (world coordinates)

The map is extended east again: `BOUNDS.x1 = 2000`, `PLAY.x1 = 1940` (src/world/world.js). East of the Iron
Base (x > 1240) the land is the plain at about y = -50 (`baseHeight(x, z)`). Each site flattens its own pads
in `layout()` and builds in `build()` with `makeSite` (src/world/compound.js), like src/world/hq.js. Every
new site module is already imported and called from world.js (layout, build, and `places.X?.tick?.(camera,
dt)`), and main.js wires `places.X.lamps / emissives` to the night. The five places:

| place (`ctx.places.…`) | file | centre / extent | what it must contain |
|---|---|---|---|
| `safehouse` — בית המסתור | src/world/safehouse.js | (650, -175), pad x 622..678, z -193..-157 | a one-storey house the gang rests in: a living room with a sofa, armchairs, a big TV on the wall (a screen mesh whose material can show "the Shadow" — a dark figure in a black mask — and later a map with bases: give the place a `screen` API, e.g. `screen.show('off' \| 'shadow' \| 'video' \| 'map')`, drawn with a canvas texture), a gear table (bags, the gang's paint markers on a rack: a pickup spot), a door to a yard where the Renault and two more cars of the gang wait facing the death road's start, light switches (the lights go out) |
| `deathRoad` — כביש המוות | src/world/deathroad.js | from the safe-house yard (680, -175) north-east to about (900, -425), east along z ≈ -428 to x ≈ 1500, into the port's west gate at about (1540, -350) | a fast road (registered in `ctx.net`, paved like the iron road), with: places for rival cars to come from, roadblocks, roadside blast spots, at least one tunnel (a covered gallery with lamps), ramps that launch the car (`pad.launch`, `pad.slope` as in src/world/kotziroad.js), and **a fork into at least two escape routes that rejoin** (e.g. the highway, a tunnel route, a dirt track with a jump); a stretch where a truck comes head-on in the lane (a spot for the mission's truck to start and its lane); a list of points for each route (for the autopilot in tests and for rivals) |
| `port` — הנמל השחור | src/world/port.js | a water basin x 1600..1800, z -420..-320 (dig the terrain with a low pad, put a water plane in it), quays around it, the yard x 1540..1830, z -440..-250 | night and rain: containers in rows (cover, lanes), two docked ships (hulls on the water, a gangway), warehouses, two or three gantry cranes, security floodlights (and search lights that sweep: a cone the mission can use for stealth), a gate on the west side where the death road arrives, **the control tower** (stairs up, the alarm panel on top), a place where **an access card** lies (a guard post / office), **a secret passage** (a hatch or a container with a false back) that leads to **the industrial elevator** (a big cage the whole gang fits in, with doors that close) at the south-east corner |
| `facility` — המתקן התת-קרקעי | src/world/facility.js | an enclosed complex (no windows, roofed everywhere: it plays as underground) x 1420..1620, z -200..-40 | the elevator's arrival hall; **holding cells** (a row of cells, one big cell where the gang wakes, doors that open by script); **the iron corridor** (a long steel corridor with side bays, for fist fights); **the machine room** (presses/steam vents/conveyors as obstacles a mission can switch, catwalks); **the detention arena** (a caged pit for the mini-boss "הפטיש"); **the armory** (a locked door with a card reader and a short puzzle — e.g. a code on a clipboard — and inside **a wall of the gang's weapons**: a rack mesh with the markers that a mission can empty as they are picked up); **tunnels** and **storage halls** (crates, forklifts, red emergency lamps); **the giant hangar** (about 60 × 45, high roof, vehicles that can blow up, cover, a damaged door that can trap someone behind it, a safe room with a heavy security door, a first-aid kit spot); an exit (a big door / ramp) from the hangar up to the surface at the tower's plaza |
| `tower` — המגדל השחור | src/world/tower.js | footprint about (1780, -120), 40 × 40; its plaza x 1660..1880, z -100..-20 | **an entrance plaza with vehicles** (cover, a gate), **a big lobby** on the ground floor, then floors connected by stairs (and an elevator that works as a fade): **security rooms**, **corridors**, **server rooms**, **storage**, **the command room** at the top with a huge window and the Shadow's desk/computer, an **emergency elevator** the Shadow escapes in, and **a huge roof**; spots for the variety of goals (a gate to open, an alarm to disable, a door Ido breaches while you cover him, a card, the elevator, a teammate trapped in a room). For the escape: a marked route down, an emergency gate, a spot where a friend falls, an exit switch, and **the getaway vehicle** at the plaza. The tower looks much taller than its playable floors (upper floors are facade only) |

Keep every site inside its box; the Iron Base (chapter 8) reaches x 1170, z -330..-250; the iron road's branch
ends at (1112, -214). Do not overlap them.

## Engine pieces (workflow A builds these; missions use them)

- **Fist combat (src/combat/fight.js, fighter.js, the HUD)**: existing: jab/cross, block (hold), dodge,
  stamina, health, opponents with wind-up rings, allies, `maxAttackers`, beaten opponents sit down. New:
  - a **heavy punch** (its own button `#btnHeavy`, "מכה חזקה"): slower, more stamina, more damage, breaks a
    block, staggers longer;
  - a **three-hit combo**: punches landed in quick succession chain jab → cross → a finisher that knocks the
    opponent back (and down if he is low); the HUD shows the combo count;
  - a **shove** (`#btnShove`, "דחיפה"): pushes the nearest opponent back, interrupts his wind-up, opens his
    guard briefly; short range, small stamina cost;
  - **knockdown**: a big hit can put an opponent on the floor for a moment; he gets up unless he is out;
  - **boss opponents**: `{ boss: true, hp, power, windup, armor, phases }` — e.g. "הפטיש": strong and slow,
    blocks light punches (armor), only a heavy punch or a combo finisher staggers him; a boss bar on the HUD;
  - opponents' health shown (a bar over the one you face, or a list); allies really hit and take hits;
  - `game.fists(true)`/state: the fight buttons are on screen whenever a Fight runs; with no gun the fire
    button is hidden.
  Chapters 3, 7 and 8 fights must keep working as they do (tests stage-j, stage-n, stage-p use `#btnPunch`).
- **Weapons taken and given back (src/combat/paint.js, src/save/progress.js)**: `paint.stash()` remembers who
  carried what (the player's marker and colour, each ally's) and disarms everyone; while stashed the fire and
  reload buttons are hidden and a fire press says "אין נשק"; `paint.unstash()` gives every one of them back
  their own marker (player and allies) and fire works again. The stash is saved in the progress
  (`progress.stash`), so a reload in the middle of chapter nine keeps them unarmed until the armory.
- **The cast (src/characters/extras.js, builder.js/head.js)**: `shadow` "הצל" — a tall figure in black with a
  **black mask** (the builder needs a mask option: a dark balaclava over the head with an eye slit); `hammer`
  "הפטיש" — a huge guard (height ~1.15, wide shoulders); the Order's guards `og1`..`og16` (black tactical
  clothes with a dark red band; varied skin, builds, heights). All invented.
- **Atmosphere (src/fx/fx.js, src/audio/sound.js, src/world/daylight.js, src/player/controller.js, a new
  src/ui/overlay.js)**: `fx.rain(on, { strength })` (streaks around the camera, splashes, darker light, the
  sound of rain); `redAlert(on)` (red emergency light in an area: a flashing red light and the HUD tinted);
  `sound.music('action' | 'calm' | null)` (an original, synthesized loop: drums and bass for action, a soft pad
  for the quiet moments; never copied); sleeping-gas hiss; a muffled heartbeat; `game.player.speedScale`
  (0.4..1, for Nehorai walking slowly after the comeback); `overlay.daze(0..1)` (blur and dark vignette for the
  injury and the gas), `overlay.mapHidden(on, text)` (the minimap says "מתחת לאדמה" in the facility).

## Missions (workflow B) — chapter 9, ids and files

| # | id | file | title | notes |
|---|---|---|---|---|
| 34 (1) | `phoenix` | src/missions/m34-phoenix.js | הלילה שבו הכול התחיל | at the safe house; lines; lights out; the Shadow on the TV; the video of the compound; gear, talk to Ido and Erez, to the car |
| 35 (2) | `deathroad` | src/missions/m35-deathroad.js | מרדף בכביש המוות | real driving (the Renault, Ido and Erez inside, the gang in two more cars), rivals, blasts, roadblocks, tunnels, jumps, radio, several routes, the truck lines, ends at the port |
| 36 (3) | `blackport` | src/missions/m36-blackport.js | הנמל השחור | rain, stealth and fights: the control tower, the alarm, the access card, the passage, gather the friends at the entrance, the elevator, it stops, "ברוכים הבאים לשלב הבא.", gas, black |
| 37 (4) | `stolen` | src/missions/m37-stolen.js | גנבו לנו את כל הרובים! | wake in the cells, the lines, weapons gone (`paint.stash()`), the cell doors open, the first fist fight |
| 38 (5) | `barehands` | src/missions/m38-barehands.js | הבריחה בלי הנשקים | the iron corridor, the machine room, the arena and "הפטיש"; Erez and Ido help; the access card to the armory |
| 39 (6) | `armory` | src/missions/m39-armory.js | מחזירים את הרובים! | short puzzles, locked doors, guards; the wall of weapons; the lines; `paint.unstash()`; everyone armed |
| 40 (7) | `portwar` | src/missions/m40-portwar.js | מלחמת הנמל | the alarm, the facility's security in waves, cars that blow, cover, red light, smoke and fire, action music, events that change the fight; tunnels, stores, the hangar |
| 41 (8) | `wounded` | src/missions/m41-wounded.js | נהוראי נפצע! | Nehorai frees Erez from the damaged door, the blast, the injury sequence (no Game Over), **play as Ido**: SAVE NAHORAI, reach him, defend him, the first-aid kit, treat him, carry him with Erez to the safe room, the security door, defend until the treatment ends, the quiet scene |
| 42 (9) | `comeback` | src/missions/m42-comeback.js | הקאמבק של נהוראי | black screen, the lines, he wakes, "איפה הרובה שלי?", Ido gives it, he stands, back to Nehorai, slow then normal, out to the surface |
| 43 (10) | `blacktower` | src/missions/m43-blacktower.js | ההסתערות על המגדל השחור | floor by floor with different goals each (not identical rooms) |
| 44 (11) | `shadow` | src/missions/m44-shadow.js | הבוס הגדול: הצל | three phases (guns and defences, fists with the Shadow, Erez and Ido join), he escapes in the emergency elevator, the computer with the data; how he knew (outside surveillance, Kotzi's old bases) |
| 45 (12) | `meltdown` | src/missions/m45-meltdown.js | בריחה מהתופת | 05:00 – ESCAPE!, the tower comes apart, a marked route, the emergency gate, a fallen friend, the exit switch, the getaway vehicle, the huge blast seen from afar |
| 46 (13) | `together` | src/missions/m46-together.js | סוף השלב | back at the safe house, the bandage, the lines, the Shadow on the screen, the map of bases, the last lines, "STAGE 9 COMPLETE – OPERATION PHOENIX" and "STAGE 10 – THE FINAL HUNT"; unlocks `chapter-9` |

`requires` the one before (34 requires `inferno`); `follows: true` where one carries straight on; `secret: true`
on 41, 42 and 44 (their titles are masked until reached). Every mission: `setup`, `prepareReplay` (stages its
start on a fresh page: chapter-9 checkpoints and starts are saved and resumed after a reload through
`start(id, { from })` = prepareReplay, setup, restore, enterStep — see src/missions/missions.js), `restore`
that stages a **whole** playable scene for each checkpoint (light, rain, doors, people, the car, armed or
not), `cleanup`, `failIf` with a reason and a tip. All thirteen are registered through
src/missions/chapter9.js (already wired into game.js). Shared helpers for chapter nine go in
src/missions/phoenix.js (re-exports chapter eight's helpers from firestorm.js and adds chapter nine's).

## Tests

Each mission group writes an end-to-end Playwright test in the style of tests/stage-o.test.mjs and
tests/stage-p.test.mjs: tests/stage-q.test.mjs (34–36), stage-r (37–39), stage-s (40–42), stage-t (43–46). Each
checks the quoted lines, every step's goal, the real interactions (press the prompts), a fail and a retry, and
that the next mission begins. The fights are won with the real buttons (`#btnPunch`, `#btnHeavy`,
`#btnShove`, `#btnBlock`, `#btnDodge`), not by setting health. tests/walk.test.mjs gets the new sites
(every target reachable on its floor). tests/resume.test.mjs covers chapters 8 and 9.
