# Chapter 5 — "הפאב בקציר" — design contract

This is the contract every chapter-5 module is built against. Everything here is fiction written for
the game; the characters are fictional versions, the venue, the villa and "Yaniv" are invented, and no
real address, business or weapon appears. The rules set at the start of the project hold: paint, not
blood; whoever is marked sits out; no reward for touching passers-by.

## The story (two missions)

**m16 `pub` — "הפאב בקציר"** (chapter 5, number 1, requires `bank`, `follows: false`, starts at the blue
marker *inside* the house, or `startAt` the living-room spot; while the player is outside, the panel
says `where: 'בבית של נהוראי'`).

0. **At home, 17:00.** Nehorai is inside his house (the new interior, `places.home.interior`), daytime
   (`daylight.set(0,0)`). After the banner (`m.t > 2.7`) the phone rings: `hud.showCall('עידו', …)` →
   `dialogue.play(CALL)` (lines below, Ido's lines flagged `'phone'`). Objective: `'עידו מתקשר. לענות'`.
1. **Four hours later.** `hud.fade('כעבור 4 שעות · 21:00', () => game.daylight.set(1, 0), 1800)`; the
   player stays inside; Katzir's lights are on (daylight lamps/emissives). Objective:
   `'21:00 · לצאת מהבית'`. Interaction at the front door inside (`places.home.interior.door`, 2.2 m):
   `{label:'לצאת החוצה', priority:5}` → `hud.fade('', …)` then `game.start(places.home.interior.outside.x, .z, .yaw)`.
2. **To the pub.** Objective `'ללכת לפאב בקציר'` (GOES verb ⇒ target `places.pub.entrance`, r 3). On
   foot or by car both allowed (`target` switches to `places.pub.parking` in a car; `say(...)`
   'לנסוע לפאב' / 'להיכנס לפאב'). Done when on foot within 3 m of the entrance.
3. **Entering (cutscene).** `game.playCutscene('pub-enter', fallback)` — see Cutscene hook. The
   fallback: `game.cutscene = true`, the crowd is placed, the music starts
   (`game.radio.ambient('pub', places.pub.center, 26)`), three `follow.shot` moves over ~7 s (the door,
   a pan across the floor, Ido and Yonati at the bar `play('wave')`), then done. Objective
   `'להיכנס לפאב'`.
4. **At the bar.** Objective `'לגשת לבר אל קאי ויהלי'` (target `places.pub.bar.player`, r 1.6). On
   arrival: `twoShot`-style framing, `dialogue.play(BAR)`; when the line index reaches Liam's first
   line, Liam (already placed at `places.pub.liamSpot`, hidden) is shown behind the player and the
   camera cuts to him; everyone turns (`lookAt`). After BAR: complete. Reward
   `{ money: 300, unlocks: ['pub-crew','liam','chapter-5a'], text: 'ליאם, קאי ויהלי בטלפון' }`.

**m17 `villa` — "הווילה של יניב"** (number 2, requires `pub`, `startAt` the pub entrance at night;
`where: 'בכניסה לפאב'`). The whole crew comes: erez, yonati, avraham, dolev, muller, hadar, ido, liam.

0. **Briefing at the pub door (night).** `daylight.set(1,0)`. Crew in a half circle, Liam's lines
   (BRIEF). Objective `'ליאם מסביר את התוכנית'`. Then `'לנסוע לווילה של יניב'`.
1. **The drive** (checkpoint). Nehorai drives the Renault (Ido and Liam's passengers are implied);
   Liam's Seat (`places.villa.cars.liam` start → a `Vehicle` with `makeHatchback({color:'#b8322a'})`,
   `name:'seat'`, driven by `Autopilot` along `roadPath`, pushed to `game.chaseCars` so traffic yields)
   follows to `places.villa.parking`. Target `places.villa.parking` r 6 in the car, else the car.
2. **Muller to the post** (cutscene 6 s): Muller runs to `places.villa.mullerPost.foot` and is placed on
   the post (`mullerPost` = the roof/balcony of the neighbouring building); line `['מולר','בעמדה. רואה את החצר ואת הגג.']`.
   `game.paint.setOverwatch({ npc: muller, post: places.villa.mullerPost })`.
3. **The yard** (checkpoint). `armUp()`: `paint.armPlayer()`, allies = every crew member present
   (not muller). Guards posted (`postGuards()`): 4 in the yard on `places.villa.patrols.yard*`, 2 on
   the roof at `places.villa.roofSpots` (static, pose 'aim', `quick:true`), 3 inside on room routes.
   Objective `'לסמן את השומרים בחצר (מולר מוריד מי שמסומן)'`; done when all yard+roof guards are marked.
   `failIf`: `paint.hits >= OUT_AT` → `'סומנת שלוש פעמים'`.
4. **Room by room** (checkpoint). Objective `'להיכנס ולנקות חדר אחרי חדר'` with `say()` naming the
   room with the next unmarked guard (`'הסלון' / 'המטבח' / 'החדר האחורי'`). Done when every guard is marked.
5. **The bags.** Two bags in `places.villa.safe` (makeMoneyBag). Interaction `'לקחת תיק'` (priority 5)
   twice; carrying = pose `'carry'`; objective `'לקחת את שני התיקים'`.
6. **Out to the cars.** Objective `'לחזור לרכבים'` target `places.villa.parking`. When Nehorai is in
   the Renault: Liam's Seat starts its autopilot back to the pub; `game.chase = new Chase(game,{cars:2})`
   (Yaniv's friends, rival cars, never police). Objective `'לברוח לפאב'` target `places.pub.parking`.
7. **Back at the pub.** Chase ends (escaped or arrived with nearest > 60 m); crew at the pub door,
   END lines; complete. Reward `{ money: 1200, unlocks: ['turbo','chapter-5'], text: 'הרנו: מנוע 120 · כולם בפאב' }`.
   `cleanup`: dispose paint/overwatch, chase, Liam's car, guards hidden, `daylight.set(0,3)` only when
   replaying from day (keep night during the chapter: after `pub` completes the night stays).

Checkpoints restore: step 1 (cars at the pub, crew in), 3 (at the villa gate, guards reset), 4 (reset
inside guards only; player at the villa door).

## Dialogue (exact text; voices are recorded from these strings)

```js
// m16 — Ido's call, 17:00
const CALL = [
  ['עידו', 'נהוראי! שמע, פתחו את הפאב בקציר!', 'phone'],
  ['נהוראי', 'פאב? בקציר?'],
  ['עידו', 'ליד התצפית. אני ויונתי הולכים לשתות שם הערב. בוא איתנו.', 'phone'],
  ['נהוראי', 'בטח שאני בא!'],
  ['עידו', 'סגור. תשע בערב, בפאב. אל תאחר.', 'phone'],
  ['נהוראי', 'בתשע אני שם.'],
];
// m16 — at the bar
const BAR = [
  ['קאי', 'נהוראי! ברוך הבא לפאב. מה שותים?'],
  ['נהוראי', 'קאי! לא ידעתי שאתה ברמן.'],
  ['קאי', 'מאתמול. יהלי, תראה מי הגיע.'],
  ['יהלי', 'יואו נהוראי! אחי, איזה כיף.'],
  ['יהלי', 'יואו, גם ליאם מגיע היום לבר.'],
  ['נהוראי', 'יואו, מתי הוא פה?'],
  ['ליאם', 'אני פה מאחוריך.'],
  ['נהוראי', 'יואו ליאםםם! מה איתך אחי?'],
  ['ליאם', 'אההה יא אחים יקריםםם! שמעו רגע... אני צריך אתכם.'],
  ['ליאם', 'יש אחד, קוראים לו יניב. ניצח אותנו בקלפים בקיץ עם חפיסה מסומנת, ולקח את כל הקופה. היא אצלו בבית, בתיקים.'],
  ['ליאם', 'הבעיה: יש לו שומרים בחצר ושניים על הגג. ואנחנו משחקים לפי החוקים שלנו. צבע. מי שמסומן, בחוץ.'],
  ['עידו', 'ומולר?'],
  ['ליאם', 'מולר תופס עמדה בבניין ממול. מי שנהוראי מסמן, מולר מוריד מהגג. בלי שמולר רואה, אין סימון.'],
  ['יונתי', 'ואנחנו נכנסים חדר-חדר. כמו במשחק.'],
  ['ליאם', 'בדיוק. יש לי את הסיאט, לנהוראי יש את הרנו. שתי מכוניות, שתי יציאות.'],
  ['נהוראי', 'הלילה?'],
  ['ליאם', 'הלילה. בשלוש.'],
];
// m17 — briefing at the pub door
const BRIEF = [
  ['ליאם', 'כולם פה? יופי. מולר, אתה בבניין ממול. כל השאר איתי ועם נהוראי.'],
  ['מולר', 'קיבלתי. תסמנו, אני מוריד.'],
  ['ליאם', 'נהוראי, אתה מוביל. אני בסיאט מאחוריך. סע.'],
];
const POST = [['מולר', 'בעמדה. רואה את החצר ואת הגג.']];
const MARKS = [['מולר', 'רואה אותו.'], ['מולר', 'ירד.'], ['מולר', 'עוד אחד למטה.'], ['מולר', 'נקי.']]; // one per overwatch shot, cycling
const NO_SIGHT = [['מולר', 'לא רואה אותו מכאן.']];
const INSIDE = [['ליאם', 'חדר-חדר. אני מאחוריך.'], ['יונתי', 'שמאל נקי!'], ['עידו', 'ימין נקי.']];
const BAGS = [['ליאם', 'הנה הקופה. שני תיקים. קח אחד, אני לוקח אחד.']];
const OUT = [['ליאם', 'לרכבים! נפגשים בפאב!'], ['עידו', 'יש לנו חברה מאחור. סע!']];
const END = [
  ['ליאם', 'יא מלכים. הקופה חזרה הביתה.'],
  ['קאי', 'הסיבוב הזה על הבית.'],
  ['נהוראי', 'ומה עם הרנו?'],
  ['ליאם', 'דיברתי עם המוסך. מחר היא נוסעת מאה ועשרים.'],
];
```

Speaking styles (fictional, written for the game): **קאי** – warm host, short sentences, asks what you
drink, calls everyone 'אחי'; **יהלי** – excited, starts with 'יואו', gym talk; **ליאם** – big
greetings ('אההה יא אחים יקריםםם'), then calm and precise plans; **יניב** – never speaks (he is away).

## New places and modules (world)

Yaw convention everywhere: forward = local +z = (sin yaw, cos yaw); `yawFacing(dx,dz) = atan2(dx,dz)`.
Heights: `world.groundHeight(x,z)` for feet. Each module exposes its places; main.js registers lamps
and emissives with `daylight` (the integrator wires `main.js`).

### `src/world/home.js` — Nehorai's house interior (module A)
`export function build(ctx)` runs after `katzir.build` (wired in world.js). Reads `ctx.places.home`
(`{s, side, house:P0, y, yaw, road}`; footprint w 11 × d 10, H 6.2, front = local +z toward the
street) and the existing bedroom `ctx.places.room` (keep it exactly as it is: m8 uses it). Builds the
rest of the ground floor **into the same group** (`places.room.group`) so visibility keeps working, and
widens `places.room.inside(x,z)` to the whole footprint. Layout (house-local, origin P0 at floor y):
entrance hall at the front door (0, d/2), living room on the right/front (X 0.4..5.2, Z −1..4.7), open
kitchen back-right (X 0.5..5.2, Z −4.7..−1.2), bedroom back-left (existing room), a short corridor
between. Furniture (procedural geometry, no external files): sofa (two-seater + armchair), coffee
table, TV on a console, dining table with four chairs, kitchen counter with sink, stove, fridge, upper
cabinets, a rug, two floor plants, framed pictures (Tex.sign with abstract fills, no real photos),
curtains, ceiling lamp pendants (emissive bulbs), a floor lamp, a bookshelf, a mirror by the door,
window frames with pale glass planes that show a sky colour by day and dark blue at night (a material
whose colour the module sets from `ctx.places.home.interior.setNight(n)` — called by `tick`).
Materials: own MeshStandardMaterials, exposed as `places.home.interior.materials =
{ floor, wall, wood, fabric, counter, tile, rug, glass }` with procedural maps (add `Tex.wood`,
`Tex.fabric`, `Tex.tiles` canvases in textures.js) so an asset layer can swap `.map`.
Colliders: `cols.addBox` for every furniture piece, at the interior floor height only
(`floorY−1 .. floorY+1.2`). Lamps for the night: `places.home.interior.lamps = [{x,y,z,inside:true}]`
(≤3) + `emissives` (bulb materials). Exposes
`places.home.interior = { group, floorY, inside(x,z), door:{x,z,y}, outside:{x,z,yaw} (the front
step), living:{x,z,yaw} (start spot by the sofa), kitchen:{x,z}, materials, lamps, emissives, setNight(n), tick(camera,dt) }`.
Entering/leaving is a teleport (the shell has no doorway); `tick` hides nothing (the shell handles it).

### `src/world/pub.js` — the pub near the lookout (module B)
`export function layout(ctx)` (nothing or a small pad for `parking`), `export function build(ctx)`.
Site: north side of the main road, `along(main, 266, +1, 15)` = (−77.41, −13.88), facade yaw −0.145
toward the road, footprint 14 × 12, one floor H 4.2, flat roof, dark warm walls ('#3a2f2a'),
`ctx.veg` filtered inside the footprint + 3 m. Bank-style walkable shell (own `Batch`, `seg` walls with
colliders) with a **doorway gap** 1.6 m in the front wall (no teleport), a roof group hidden by `tick`
when the camera is inside (like `tickBank`). Outside: neon sign 'הפאב' (`signMat`: emissive pink
'#ff4fb0' map via Tex.sign with bg '#120a10'), string lights along the eaves (small emissive bulbs),
two planters, a bench, `parking` pad for 3 cars beside the building, `entrance` {x,z,yaw} 1 m outside
the doorway, `center`, `floorY`, `inside(x,z)`. Inside: bar counter along the back wall (wood top,
bottle shelf with emissive backlight), 8 stools, 5 round tables with chairs, a dance floor 5 × 5 with
a DJ booth, two speakers, a disco ball (small mirror sphere), neon tubes on the walls (pink and blue
emissive strips — `emissives`), posters (Tex.sign, invented names), a pool table? (optional),
pendant lamps. `lamps` ≤ 4 (two pink inside, one warm over the bar, one outside) and `emissives`.
Spots: `crowd: [{x,z,yaw,pose:'dance'|'stand'|'sit'|'phone'}]` (24: 10 dance, 8 stand, 6 sit on
stools/chairs), `bar: { kai:{x,z,yaw} (behind the counter), yahli:{x,z,yaw} (on a stool),
player:{x,z,yaw}, ido:{x,z,yaw}, yonati:{x,z,yaw} }`, `liamSpot` 2.4 m behind `bar.player`,
`doorInside`. Exposes `places.pub = { x,z,y:floorY,W,D,H,yaw, toWorld(lx,lz), toLocal(x,z), inside,
roof, signMat, lamps, emissives, entrance, parking:{x,z,yaw}, center, floorY, crowd, bar, liamSpot,
doorInside, dance:{x,z,r}, tick(camera,dt) }`. Also **Katzir at night** (same module, `build`):
emissive lamp heads + a soft additive glow sprite at every main-road lamp post (positions: s = 18+32i,
side alternating, d 5.35, head height 6.0 toward local +z of the arm), pink neon strips on two
houses near the pub and on the bus stop, string lights across the plaza railing — all emissive
materials in `places.katzirNight = { emissives:[mat], lamps:[{x,y,z,color}] (≤ 4 real lights: plaza,
pub corner, two posts nearest the pub) }`.

### `src/world/villa.js` — Yaniv's villa and the overwatch building (module C)
`export function layout(ctx)`: a street 'דרך הכרמים' (Road, kind 'street', width 6) from the Rimon
turning circle edge (28, 124) curving to (80, 104) and ending at a parking pad in front of the villa
gate (pad hx 9 hz 6 at (76, 97) yaw facing the gate); a rect pad under the villa footprint (top 0.1).
`export function build(ctx)`: the villa at (95, 95), footprint 24 × 18, yaw facing west (gate toward
the parking), single storey H 3.6 with a **flat roof reachable by guards only** (two `roofSpots`),
a walled yard (stone wall 1.8 m, gate gap 3 m at the west), a small pool (water material plane) in the
south yard, olive trees, garden lamps. Interior rooms (bank-style walls with doorways): entrance hall →
salon (south) → kitchen (north) → study at the back (east) with the safe corner (`safe` {x,z}).
Low cover in the yard and rooms (planters, a car under a cover, crates, sofa) as colliders. Night
lamps inside and in the yard (`lamps` ≤ 6, `emissives`). Overwatch building: 12 × 12 two-storey
building at (95, 55) (a closed neighbour's house, no interior) with an external stair to a flat roof
with a parapet; `mullerPost = { x, y, z (roof surface), foot:{x,z} (stair bottom), look:{x,z} (the
villa centre) }`. Exposes `places.villa = { x,z,y:floorY, yaw, toWorld, toLocal, inside(x,z),
inRoom(x,z) -> 'hall'|'salon'|'kitchen'|'study'|null, gate:{x,z,yaw}, door:{x,z,yaw} (front door
inside the yard), parking:{x,z,yaw}, cars:{ nehorai:{x,z,yaw}, liam:{x,z,yaw} }, safe:{x,z,y},
bags:[{x,z,y}×2], patrols:{ yardN:[{x,z}], yardS:[...], yardE:[...], yardW:[...], hall:[...], salon:[...],
kitchen:[...], study:[...] }, roofSpots:[{x,y,z,yaw}×2], cover:[{x,z}], rooms:{salon:{x,z},
kitchen:{x,z}, study:{x,z}}, mullerPost, roof, lamps, emissives, tick(camera,dt) }`.

### Overwatch and quick guards — `src/combat/paint.js` (module D)
- `setOverwatch({ npc, post:{x,y,z} } | null)`: Muller stands at the post (placed there, `idle=null`,
  pose 'aim' when a guard is in sight), kept there by the module (not an ally). Fields: `overwatch`
  `{npc, post, cool, shots}`.
- `overwatchSees(g)`: `clear(post.x, post.y+1.5, post.z, g.npc.pos.x, g.npc.pos.y+1.2, g.npc.pos.z, npc)`
  and distance ≤ 70 m.
- `mark()`: refused unless armed, `lock` is a guard, `overwatch` set and `cool ≤ 0`. If
  `overwatchSees(lock)`: `hud.pop('מסומן למולר','counter')`, 0.6 s later a tracer from the post to the
  guard and `markGuard(g, 'overwatch')`, `cool = 4`, `onOverwatchShot?.(g)`; else
  `hud.pop('מולר לא רואה','block')` and `onNoSight?.()`. Bound to `controls.onMark` and a new button
  `#btnMark` ('סמן') inside `#gunActions` (index.html + style.css + hud.setGun shows it only when
  `overwatch` is set: `hud.setMark(on, canSee)` — the button gets class `can` when the locked guard
  is visible to the post).
- `addGuard(npc, points, color, { quick=false, still=false } = {})`: `quick` → alert threshold 0.2,
  fire interval 0.7–1.1 s, hit chances +0.1; `still` → no patrol walking (roof posts), faces `look`.
- `game.updateCombat` also calls `hud.setMark(!!paint.overwatch, paint.lock && paint.overwatchSees(paint.lock))`.
- `window.__game.state.paint` gains `overwatch:{cool, shots}`.

### Radio, music, upgrade, characters (module E)
- `src/audio/radio.js`: `class Radio { constructor(game); stations: [{id:'hiphop',name:'גלגלים FM'},{id:'mizrahi',name:'רדיו דרום'},{id:'house',name:'לילה בעיר'}]; current (index or -1 = off); setTracks({hiphop:[url], mizrahi:[url], house:[url], pub:[url]}); toggle(); next(); off(); ambient(id, center:{x,z}, radius) (the pub); stopAmbient(); update(dt, {driving, pos}); level() }`.
  Without files each station plays a **procedural loop** made with Web Audio (kick, snare, hats,
  bass line and a chord stab, a different pattern and tempo per station; the pub = the hiphop
  pattern), routed through its own GainNode into `game.sound.master` so mute and pause apply. With
  files (`HTMLAudioElement`, `loop=true`, volume 0.55 in the car, ambient volume by distance) the
  procedural loop is replaced. The car radio plays only while `game.mode === 'car'` (fades out
  within 0.5 s on exit). A HUD pill `#radio` (created by the Radio itself under `#hud`, bottom-left
  in car mode) shows the station name; tapping it cycles stations (off → 1 → 2 → 3 → off); the
  keyboard key `M`. `game.radio` is created in game.js after `sound` is set (`main.js`: `game.radio = new Radio(game)`
  right after `game.sound = sound`), `Sound.level()` calls `this.radio?.level()`.
  The HF layer sets `window.__hfMusic = { hiphop:['music/r1.mp3'], … }` before start or calls
  `game.radio.setTracks(...)` later; both work.
- `src/vehicle/upgrades.js`: `{ id: 'turbo', name: 'מנוע 120', note: '120 קמ"ש במישור', price: 900 }`;
  `applyUpgrades`: with 'turbo' `maxSpeed = 38`, `accel = 9.8` (verified to read ≥ 120 on the kmh
  display on 'דרך גן שמואל'); `Game.ownedUpgrades()` adds 'turbo' when `has('turbo')` (mission reward).
- Characters (`src/characters/roster.js`, `extras.js`): roster entries **kai** ('קאי סיפקו כהן'),
  **yahli** ('יהלי טבת ברלין'), **liam** ('ליאם') appended to `CAST_ORDER` in that order; looks are
  original descriptions in the same style as the others (Kai: curly light-brown hair, thin
  hexagonal metal glasses → add a `glasses: true` option drawn by head.js, burgundy tee, thin chain;
  Yahli: straight light-brown hair with a fringe, faint mustache, navy sports tee, grey shorts;
  Liam: short dark hair, thick brows, light stubble, taupe tee, broader build `build:{shoulders:1.12, arms:1.08}`).
  `extras.js`: `VILLA = { yaniv (never shown), vg1..vg9 }` guards built by `guard()` with a different
  tee colour ('#3b2f2f', print 'ring'); ids `vg1..vg9`, `spec.crew` false. `game.npc()` lookup gains
  `VILLA[id]`. `VOICES` in dialogue.js gains 'קאי' '#f2a365', 'יהלי' '#7fd1ff', 'ליאם' '#c9a6ff'.
  Phone `PEOPLE`: liam/kai/yahli with `needs: 'pub-crew'`; `chats.js` CHATS for the three (2 short
  chats each). `game.liamBuddy = new Companion(game,'liam')` (game.js) and `call('liam')` joins like
  ido. The character room (`viewer.js`) handles 11 cast members (portrait rows of 3, landscape one
  row of 11 fits via `fit`).
- `src/characters/poses.js`: add POSES `dance` (hips.y −0.03, shoulders raised/forward, knees bent)
  with a per-frame wobble handled by `builder.js` for the pose `dance` (sway ±0.1 rad at 2.1 Hz on
  hips.ry and shoulders), and `lean` (elbows on the bar). `Npc.idle` accepts 'dance' and 'lean'.

### Missions and the rest (module F, after A–E are merged)
`src/missions/m16-pub.js`, `src/missions/m17-villa.js` (registered in game.js after bankMission as
chapter 5), `missions.js` chapter-name arrays extended ('החמישי'), `index.html` start-screen text →
'חמישה פרקים · שבע עשרה משימות ועולם פתוח', a chapter-5 mission list, `game.playCutscene(id, fallback)`
+ `game.cutscenes = {}` in game.js, main.js wiring of `home.js`/`pub.js`/`villa.js` lamps and
emissives (+ `places.katzirNight`), world.js wiring of the three modules' layout/build/tick,
`tests/stage-l.test.mjs` (chapter 5 end to end, the crowd count, the overwatch marking, the bags,
the two cars, the turbo readout ≥ 118 on the straight, the radio pill), and the count updates in
`guidance.test.mjs` (ORDER 17, TITLES, headings, GOES), `stage-i/j/k` (rows 17, start text),
`characters.test.mjs` (12 chips, 11 visible). `docs/plan.md` gets a chapter-5 section.

## Cutscene hook (game.js)
```js
this.cutscenes = {};                       // id -> (done) => void, registered by an asset layer
playCutscene(id, fallback) { const h = this.cutscenes[id]; return h ? h() : fallback(); }   // both return a Promise
```
The fallback runs in-engine; the layer's handler plays a video overlay (like the intro) and resolves.

## Night in chapter 5
After m16 step 1 the chapter stays at night until m17 completes; `prepareReplay` of m16 sets day, of
m17 sets night. Daylight lamps: main.js registers `places.home.interior.lamps`, `places.pub.lamps`,
`places.villa.lamps`, `places.katzirNight.lamps` (PointLight colour from the entry, intensity 0, distance
14–22) and every `emissives` entry with `daylight.addEmissive(mat, 1.4)`; total real point lights at
night ≤ 14 across the map (the bank's 7 are far away but counted by the renderer: keep Katzir ≤ 7).

## Performance rules
Phones: batch everything static, ≤ 60 k new triangles for the three modules together, crowd NPCs at
`detail:'low'`, no per-frame allocations in tick, textures ≤ 512² per procedural canvas.
