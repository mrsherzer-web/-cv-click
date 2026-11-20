# פרק 10 · סוף העולם — מדריך בנייה

The build guide for chapter ten ("סוף העולם", THE FINAL CHAPTER – OPERATION INFINITY), the last chapter of the
game. It follows docs/chapter8.md and docs/chapter9.md (read both first, and docs/chapter9-asbuilt.md for what
the engine really offers: fists, the stash, playing as someone else, the squad, blasts, floors, Work, Job,
guards, convoys, the mission conventions and the tests). The user's spec is the source; this file says where
things go and which code owns what. There is no chapter eleven: every thread ends here.

## Rules that are never broken

- **The player is Nehorai** for the whole chapter. The one exception the spec allows: a short defence at the
  machine played as Ido (mission 54), because playing as someone else exists and works (`game.playAs`).
- **Nobody of the gang betrays, ever. Nobody of the gang dies.** Erez, Ido, Muller and every friend take a real
  part: jobs, lines, fights, rescues. No friend stands in the background doing nothing, and no friend blocks a
  doorway or holds a mission up (jobs always complete; marked friends get up again).
- Nehorai **is hurt and comes back** (mission 50): a scripted event, never a Game Over. Nehorai and Erez are
  **thrown into a parallel universe built on the olive grove** of the user's two videos (missions 51–54);
  **Muller and the gang open the way back**. **The Shadow is beaten for good.** A huge blast at the end;
  **everyone survives**; they walk home to **Katzir, where the people cheer them**.
- Everything is fiction; the characters are game versions. Paintball still: guns are paint markers, people are
  "marked" and sit down, never killed; no blood, no wounds shown. "נפצע" = an energy blast throws Nehorai
  against a wall, he is dazed (blur, shake), crawls, is treated with a kit and stands up with a bandage.
  The Black Order's people are never shown dying either: when the citadel goes, the loudspeakers have already
  sent them out ("כל הכוחות, לפנות את המצודה"), and the Shadow, beaten and tied, is taken along in the armoured
  car (he sits by it after the blast; Muller: "שלחתי את המיקום שלו. יבואו לאסוף אותו.").
- No real hacking (puzzles stand in), no real brands, addresses or people; no copied music, maps or UI. The
  grove follows the user's videos as a place (trees, paths, benches, playground), not anybody's home.
- Hebrew UI, RTL. **The user's quoted lines and on-screen texts appear exactly as written** in the spec
  (`spec10.md`, given to every builder): same words, punctuation, speaker and moment.
- Nothing decorative: every prompt and button does something; every mission can be completed, has a start, a
  clear goal on screen, real things to do, a real completion, a checkpoint, a hand-over to the next one, and a
  way back from a failure; every target can be reached; no blast hurts without a warning.
- Films (Higgsfield) are extra: the game plays the same without them. A mission calls
  `game.playCutscene(id, fallback)`; with no film the fallback (the mission's own scene) runs. The lines are
  always the game's own captions, never baked into a film.

## Where things are (world coordinates)

The map keeps its bounds (`BOUNDS.x1 = 2000`, `PLAY.x1 = 1940`, `PLAY.z1 = 320`). The south-east is free, flat
plain at about y = -50: nothing stands in x 1150..1940, z 0..300 (the tower's plaza ends at z = -15, the
facility at z = -48, Kotzi's industry road runs at x ≈ 1097, the old ravine is x 998..1042). Each site flattens
its own pads in `layout()`, pushes a `keepOut`, and builds in `build()` with `makeSite` (src/world/compound.js),
like src/world/tower.js and src/world/facility.js. The new modules are already imported and called from
world.js (layout, build, `places.X?.tick?.(camera, dt)`) and main.js wires `lamps` / `emissives` to the night.

| place (`ctx.places.…`) | file | where | what it must hold |
|---|---|---|---|
| `safehouse` (exists) | src/world/safehouse.js | (650, -175) | **add a balcony** (מרפסת): a roofed porch with a railing on the east side looking at the hills where the sun comes up, reachable from the living room; `balcony: { x, z, yaw, y }` and a spot beside it for Erez; the house's screen gets a `'threat'` picture (a map of the region with several red areas and the citadel marked) next to the pictures it has; the operation's vehicles park in the yard (the Renault and two more) |
| `lastRoad` — הדרך לגיהינום | src/world/lastroad.js | from the safe house to the citadel | **a link** from the safe-house yard (about (700, -160)) south-east to the iron road near (860, -58); the convoy then takes the iron road to its end at (1000, -24), where the truck stood in chapter eight; from there the new **hills road** ("דרך הגבעות") runs east at z ≈ -10..40 between low hills (raised mounds either side, no trees on the road) to **a bridge over a new ravine** (x 1300..1340, z -60..140, about 16 m deep) at about (1320, 50) and on to the citadel's main gate at (1440, 95). **The bridge is blown** in mission 48 (`bridge.blow()`: the middle of the deck goes, colliders and the walking surface with it, fire on the stumps) so nobody can cross. **The service road** ("כביש השירות למצודה") leaves the hills road at about (1230, 20), goes south-east round the ravine's south end (through about (1290, 150), (1335, 178), (1390, 215)) to the citadel's service gate at (1440, 235). Along the way: spots for roadside blasts, side tracks rival cars come out of, places for barricades with a gap, a stretch for dodging, checkpoints; `routes.main`, `routes.service` (point lists for autopilots), `blasts[]`, `sideRoads[]`, `barricades[]`; and on the service road, 300 m out of the gate, **the roadside spot where the armoured car ends on its side** after the last blast (`rollover: { x, z, yaw }`, a shallow bank) |
| `citadel` — המצודה של הצל | src/world/citadel.js | box x 1440..1780, z 30..280 (340 × 250 m), centre (1610, 155) | the biggest site of the game, see below |
| `grove` — חורשת הזיתים | src/world/grove.js | box x 1150..1262, z 180..276, centre (1206, 228) | the olive grove of the user's videos, and its parallel-universe layer, see below |
| Katzir (exists) | src/world/katzir.js | the plateau round (40, 5) | the walk home ends at the way into the village; the crowd stands there. No new site: mission 59 picks the stretch of road and the spot from the existing roads and `world.places` |

Keep every site inside its box. Lamps and emissives: push to `S.lamps` / `S.emissives`, expose `lamps`,
`emissives` on the place (main.js wires them).

### The citadel (src/world/citadel.js)

It has to read as a fortress: a wall all round with towers, two gates in the west wall, an industrial yard,
and a central tower that holds the Shadow's machine. Build the central tower (and what stands on it) as **its
own group**, not in the world batch, so that the end can really bring it down: `citadel.destroy()` sinks and
breaks that group under smoke and leaves a ruin (rubble mounds, stumps, fires) — "המצודה קורסת לתוך עצמה".
What the missions need (names are a proposal; say in the as-built report what you called things):

- **West wall**: the main gate at (1440, 95) (a great sliding metal gate, a tower either side) and the service
  gate at (1440, 235). `gates.main`, `gates.service` with `open()`, `shut()`, `locked`.
- **The industrial yard** (west third): containers, tanks, parked trucks and cars that can blow (`vehicles[]`
  with a blast spot each), cranes, cover in lanes. Guard posts and patrol routes (`patrols`).
- **Four watch towers** with a real way up (stairs on floors), a guard post on each.
- **Stores** (מחסני ציוד) along the south wall; one holds the alarm's fuse room.
- **The alarm room** (חדר בקרה א): the alarm panel (`alarm.panel`, a Work), sirens and red light all over the
  yard until it is off (`alarm.on(bool)`).
- **A freight elevator** (מעלית משא) between the yard and the tunnels below: a platform that really moves with
  whoever stands on it if the engine allows (else a fade), `lift.call()`, `lift.go('down' | 'up')`, needs its
  power switched on first (`lift.power`, a switch in the stores).
- **The tunnels** (מנהרות תת-קרקעיות), a lower level about 6 m down: pipes, low light, two ways, they come up
  inside the inner compound behind the inner gate.
- **The inner gate** between the yard and the inner compound: opened by two wheels at once (Ido at one — a Job
  — the player at the other, or the player holding the guards off while Ido works): `innerGate`.
- **The control room** (חדר בקרה ב) with the main computer (`computer`): Muller works at it while the others
  hold three doors/approaches (clear lines for a defence).
- **Energy plants** (מתקני אנרגיה): pylons and reactors with glowing cores (props that can be shot, switches).
- **Bridges between buildings** at about +7 m, and **the tower bridge** (גשר המגדל): a long high walkway to the
  central tower's upper door, in segments that can fall (`towerBridge.drop(i)` with a warning; the way stays
  passable by a marked detour or a leap spot).
- **The central tower** (המגדל המרכזי), several storeys, each a real floor:
  - **the main hall** (האולם המרכזי) on the ground: a giant screen (`screen.show('shadow' | 'off' | …)`), the
    hall's defence system (emitters on the walls/ceiling that fire warned energy bolts; three control nodes the
    player can hit), pillars to hold on to, low cover to crawl behind, a first-aid box on a wall (`medkit`),
    the spot where Nehorai's marker lands;
  - **the energy hall** (אולם האנרגיה): a big arena with cover and things that blow;
  - **the machine room** (חדר המכונה): the energy source and Muller's console, three approaches to defend;
  - **the last hall** (האולם האחרון): the biggest room of the game, the portal engine (מנוע הפורטלים) at its far
    end, three shield generators placed so that each needs a different action (one to shoot, one switched off
    at a console by Muller's instructions, one overloaded by luring an energy bolt into it — or the like),
    cover, spots where rifts open, the place of the last fist fight, a portal anchor (`portalAt`) where the
    way to the grove opens and where Nehorai and Erez land when they return.
- **The way out** (mission 58): from the last hall down through corridors that blow, a gap to leap, two doors
  that lock and need a switch, the spot where a friend is down, the vehicle bay by the service gate with **the
  armoured car** (רכב מילוט משוריין; `armoured`: a spot and the vehicle's model builder) and the road out.
- `citadel.destroy()` as said; `places.citadel` also gives `y`, `toWorld`, `patrols`, the floors' heights.

### The olive grove (src/world/grove.js)

**Use the user's two videos as the reference** (frames are in the scratch folder named in your brief; look at
them before building). What they show, and what the place must therefore have:

- an asphalt **parking lot** with a small **roundabout island** (red-and-white kerb), parked cars, two green
  bins and a purple one, tall trees behind; a **sign on two metal poles** and a **big white limestone boulder**
  at the dirt corner where the path into the grove begins;
- a **path of grey interlocking pavers** with kerb stones, curving through **lawn** (patches of bare earth);
- **old olive trees**: thick, twisted, furrowed trunks that lean and fork low, silver-green crowns — about
  forty of them, spaced like an orchard turned park. They are the place: do not use the game's generic trees;
- **strings of coloured bulbs** (red, yellow, green, blue) hung from tree to tree;
- **the playground** on dark gravel: a **green A-frame swing set** with two swings, a round **spring spinner**
  with a hooped frame, a **blue fish-shaped seesaw**, a small **rocket-shaped slide** (white, blue, yellow);
- **wooden benches with black iron frames** (several, facing the playground and along the path), a brown bin;
- a **metal football goal** frame on the lawn by the path;
- round the edge: a **white utility shed**, a **tall floodlight mast**, a **mesh fence with a gate**, a thicket
  of reeds, a **low white building** behind the trees, and the **arched frame of a covered court** beyond.
  (The buildings are generic neighbours of a park; nothing identifies a home.)

Keep the relative layout: lot and boulder at one end, the path curving in past the goal and the benches, the
playground among the trees on one side, the shed/fence/court at the far end.

Over this real base, **the parallel-universe layer**, on only while `grove.dimension(true)` (engine piece
below): a violet sky, two moons on the horizon, drifting energy motes between the trees, the bulbs glowing
oddly, and the set pieces of missions 52–54:

- **landing spots** for Nehorai and Erez on the lawn (`landing.nehorai`, `landing.erez`);
- **three glowing symbols** (סמלים) on low stones at three places (`symbols[0..2]`: by the boulder, in the
  playground, by the goal), each inside an area that is sealed by an energy wall until the one before is
  switched on (`seals[i].open()`): each symbol opens a new part of the map;
- **the broken-reality path** (שביל המציאות השבורה): a stretch where the paved path hangs in pieces over a
  rift: platforms that fade out and back on a rhythm, stasis fields where time stops for a few seconds,
  switches, a ledge Erez needs a hand over, drifting energy disturbances to dodge, a safe line that is marked
  (`brokenPath`: its platforms, fields, switches, the ledge, the start and the end);
- **the Keeper's clearing**: open lawn among the olives with four anchor stones (the mechanism that exposes his
  weak point) and room to dodge (`arena`);
- **the energy point** where the way back opens (`portalAt`), at the far end between two great olive trees,
  with a run-up from the clearing.

In the ordinary world (no dimension) the grove is simply a park by the service road; the layer is hidden.

## Engine pieces (workflow A builds these; the missions use them)

Check what exists first (docs/chapter9-asbuilt.md, src/fx/fx.js, src/ui/overlay.js, src/world/sky.js,
src/world/daylight.js, src/combat/*.js, src/player/*.js, src/friends/*.js). Build only what is missing; keep
chapters 1–9 exactly as they play (their tests must stay green). Every piece gets a small test of its own.

1. **Portals and the other dimension** (src/fx/portal.js, sky/daylight, overlay, sound):
   - `new Portal(game, { at, r, color })`: a swirling violet-blue gate (a ring of turning arms, a dark core, blue
     lightning, motes drawn in, a light, a hum) with `open(seconds)`, `grow(r)`, `close()`, `update(dt)`,
     `dispose()`; `portal.pull(body, strength)` drags the player or an NPC toward it (the player can resist for
     a moment by holding on at a pillar: a prompt), and `portal.contains(pos)`;
   - the black-violet **energy orb** in the Shadow's hands (grows, spins, bends the air: a small distortion or a
     shimmer of rings), thrown, then becomes a portal;
   - `game.dimension(name | null)`: the other dimension's look and rules — sky dome violet, **two moons**, motes
     in the air, fog that hides everything past about 80 m, the sun/ambient tinted, the minimap replaced by
     "ממד לא ידוע", the radio dead (static) until told otherwise; `null` restores the day exactly as it was;
     it is saved state for restores (a reload in the grove comes back in the grove's dimension);
   - the crossing itself: `crossing(game, { to, also: [npc…], onArrive })` — the white-out, both bodies moved,
     the dimension switched, the squad/marker/inventory/progress kept, a safe landing (on the ground, not in a
     tree), control given back; and the same back again;
   - overlay cards: a centred system message (`overlay.notice('DIMENSION UNKNOWN – CONNECTION LOST')`), a
     white-out (`overlay.white(0..1)`), big title cards on black (as chapter nine's end cards);
   - sky presets: **05:30 sunrise** over the hills, the **red sky** of mission 48 after the far blast, **sunset**
     for the walk home (golden hour);
   - sound: portal hum and thunder-crack, energy bolt, static, a crowd cheering and clapping, and two more
     original synthesized music loops: `'epic'` (the return and the last stand) and `'home'` (warm, for the walk
     and the ending). Never copied.
2. **Moves** (src/player/controller.js, src/characters/poses.js, a mission-side helper file):
   - **crawling** when hurt: `game.player.crawl(true)` — prone pose and animation, slow, low camera; standing
     is refused until allowed; **helped up** by a friend (an animation for two), a **bandage** (exists);
   - the **dropped marker**: `paint.drop(at)` puts Nehorai's own marker on the floor as a pickup,
     `paint.pickUp()` gives it back (ammo and colour kept); no firing meanwhile;
   - **leap** and **climb**: where the way has a gap or a ledge, a prompt ("לקפוץ", "לטפס") moves the player
     across/up in an arc with an animation; a friend follows by himself; a missed timing puts the player back
     at the edge, never down a hole for good; **giving a friend a hand** over a ledge ("לתת יד לארז");
   - the **reality-path kit**: `PhasePlatform` (solid on a rhythm, fades with a warning tint, the walking
     surface and collider follow), `StasisField` (pulses; whoever is inside when it fires is held for a few
     seconds — the player, a friend, a drifting hazard), `Disturbance` (a drifting energy ball that knocks back
     and marks once, telegraphed), switches; falling in the rift puts the player back on the last solid stone
     (no fail), with the friend beside him.
3. **Energy fights and the cast** (src/combat/*, src/characters/*):
   - **marker kinds** to choose from at the rack in mission 47 (at least three that play differently: quick /
     balanced / long and precise), shown on the HUD, kept through restores and reloads;
   - an **energy foe kit** for things that are not ordinary guards: telegraphed attacks (a ring on the floor,
     a beam line that sweeps, bolts that fly slowly enough to dodge — each with a clear warning and a way
     out), **teleporting** (fade out, a shimmer where he will appear, fade in), **temporary copies** (decoys
     that pop when marked; the real one tells itself subtly), **shields fed by generators**, a **weak point**
     that opens after a mechanism is worked, a boss bar; a hit on the player is a mark (three marks = retry
     from the checkpoint) or a knock-back, never an instant fail;
   - **"שומר הסף"** (the Threshold Keeper): a large figure of energy, not human, with the three modes of the
     spec; **the Shadow in his energy suit** (the armoured look over the masked figure; it breaks off for the
     fist fight); two or three **special enemies** of the Order for the last stand (for example: a shield
     bearer who must be flanked or shoved, a heavy who only goes down to a strong punch or several marks, a
     runner who rushes) — all paintball/fists as before;
   - the **last fist fight**: chapter nine's system with better reactions: a **special attack** that charges
     with landed hits (its own button, a short cinematic hit), **timed openings** (a prompt when the boss
     staggers: press in time for a counter), stronger hit reactions, camera shake and a brief slow motion.
4. **The finale** (src/ui/*, src/friends/*, main.js, save):
   - a **crowd**: at least thirty people who cheer, clap and wave, some holding signs with the three texts of
     the spec ("תודה שהצלתם אותנו!", "הגיבורים של קציר!", "נהוראי והחבורה!"), cheap enough for a phone;
   - the **ending cards** on black: "NAHORAI FARHI", "THE END", "LEGENDS NEVER FIGHT ALONE"; then **the
     credits**: a roll over short moments from all ten chapters (live shots of each chapter's place with its
     name and a line — the friendship, the fights, Nehorai's rescue, the olive grove, the last victory), then
     "THANK YOU FOR PLAYING." and a button back to the main menu; skippable without breaking anything;
   - **the game is finished**: saved for good (`chapter-10` unlocked and a `finished` mark in the progress);
     the start screen says all ten chapters are done and still opens the free roam.
5. **Films**: nothing new in the repository beyond the calls. The ids the missions call (the asset layer
   registers the ones that exist): `c10-dawn`, `c10-citadel`, `c10-fall`, `c10-portal`, `c10-grove`,
   `c10-gate`, `c10-return`, `c10-shadow-down`, `c10-blast`, `c10-alive`, `c10-home`, `c10-end`.

## Missions (workflow B) — chapter 10, ids and files

`chapter: 10`, numbers 1–13, each `requires` the one before (the first requires `together`), `follows: true`
from the second on, the first `opens: true` (it begins by itself, as chapter nine's does). Shared helpers go in
src/missions/infinity.js (it re-exports phoenix.js) and one helper file per group.

| # | id | file | title | what happens (the spec has the lines) |
|---|---|---|---|---|
| 47 | `dawn` | m47-dawn.js | השקט לפני הסוף | 05:30, the balcony, the bandage still on; the lines; inside: the map on the screen, Muller on the machine; the camera over every friend; "היום אנחנו מסיימים את זה. כולם חוזרים הביתה."; the card NAHORAI FARHI – THE FINAL CHAPTER. Then play: collect the gear, talk to the friends, choose a marker, board the operation's car |
| 48 | `lastconvoy` | m48-lastconvoy.js | השיירה האחרונה | the convoy on the quiet road; the far blast, the red sky; rivals' cars; the chase (barricades, roadside blasts, dodging, radio); the bridge is hit; Muller's line; the service road; a huge blast behind them; checkpoints along the way |
| 49 | `citadel` | m49-citadel.js | המלחמה הגדולה | the six goals, each a different challenge: take the entrance; switch the alarm off; run the freight elevator; help Ido open the gate; protect Muller at the computer; reach the central tower. Roles as in the spec |
| 50 | `fall` | m50-fall.js | הנפילה של הגיבור | the main hall, the Shadow on the screen, the lines; the hall's defence as a first boss; the energy attack as Nehorai shields Erez; thrown at the wall, the marker falls; the lines; Erez between them; **play hurt**: crawl to cover, reach the kit, use it, be helped up by Erez, pick the marker up; the lines; back into the fight |
| 51 | `rift` | m51-rift.js | הקרע במציאות | Nehorai and Erez hit the Shadow; the orb; Muller on the radio, the lines; the throw, the portal grows; holding the pillar; Erez's line; both pulled in; white; silence |
| 52 | `grove` | m52-grove.js | איפה אנחנו?! | birds; Nehorai and Erez on the ground in the grove; the lines; "תסתכל על השמיים": violet, two moons, the motes; then a first look round on foot |
| 53 | `secret` | m53-secret.js | סוד החורשה | the radio is static; DIMENSION UNKNOWN – CONNECTION LOST; the lines; **a** three symbols, each opening more of the map; **b** the broken-reality path; **c** the Threshold Keeper in three modes; the crystal; the radio comes back |
| 54 | `gateback` | m54-gateback.js | פותחים את השער בחזרה | the citadel: the lines of Ido and Muller, "מצאתי אותם!"; **the defence at the machine played as Ido** while Muller runs the counter-portal (hold till the bar fills); the grove: the radio lines; the marked energy point; the run with the sky breaking behind them; the portal opens; the lines; run and jump in |
| 55 | `return` | m55-return.js | הגיבורים חוזרים | the citadel: Muller can hardly hold it; the portal widens; they land; the lines; "התגעגעת?"; everyone lines up; the lines; "יאללה חבר’ה. הקרב האחרון." (playable hand-over: the first move of the last stand is the player's) |
| 56 | `laststand` | m56-laststand.js | THE LAST STAND | four arenas: the energy hall (a big paint fight with cover and blasts); the tower bridge (advance as parts fall); the machine room (protect Muller as he shuts the source down); the last hall (everyone arrives). Paint fights, fists up close, dodging, runs, scripted blasts, friends helping, things to work, the special enemies |
| 57 | `endshadow` | m57-endshadow.js | END OF THE SHADOW | the lines; phase 1 the armoured Shadow: three shields, each its own action; phase 2 the broken dimension: rifts, the arena changes, he appears in places, Muller on the radio, Erez and Ido help; phase 3 face to face: the last fist fight; he falls; the lines; beaten for good, the portal system dead |
| 58 | `zerohour` | m58-zerohour.js | ZERO HOUR | the engine goes; the lines; "04:00 – FINAL ESCAPE"; the way out (blasts, falling parts, fire, smoke, locking doors, leaps, a friend to help); the friend who fell and the lines; the armoured car; Muller's shield; driving away; the blast; the car on its side; black. After: wind; Nehorai gets out; the lines one by one; everyone alive; "אז ניצחנו." |
| 59 | `homeward` | m59-homeward.js | HOMEWARD BOUND | sunset; the walk toward Katzir with the gang, no enemies; talking to each friend (the lines); the noise ahead; the crowd and the signs; walking through; the lines; the last moment; the camera pulls away; black; NAHORAI FARHI / THE END / LEGENDS NEVER FIGHT ALONE; the credits; THANK YOU FOR PLAYING.; back to the main menu; the game saved as finished |

`secret: true` on 51, 52, 53, 55 (their names give the turn away). The last rewards `unlocks: ['chapter-10']`.
Every checkpoint's `restore` stages the whole scene (who is played, the dimension, the sky, doors, people,
markers taken or held, the bandage, the clock), because checkpoints are saved and picked up after a reload.

## Tests

End-to-end Playwright tests in the style of tests/stage-q…t: tests/stage-u.test.mjs (47–49), stage-v (50–53),
stage-w (54–56), stage-x (57–59). Each checks the quoted lines word for word, every step's goal, the real
interactions, a fail and a retry, a reload in the middle, and that the next mission begins. Fights are won
with the real buttons. Walk tests for the new sites (tests/walk-citadel, walk-grove, walk-lastroad: every
target reachable on its floor, the routes drivable). tests/resume.test.mjs covers chapter 10 as well. A test
per engine piece (portal/dimension, moves, energy foes, finale). `npm run test:ch10` runs them.
