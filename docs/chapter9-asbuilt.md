# פרק 9 · מה נבנה — the engine pieces and places as built

Written from each builder's own report (workflow A). Read with docs/chapter9.md; the code is the final word.

### fists (as built)

Make a fight (as m32 does, or as game.Fight in a test):
  m.fight = new Fight(game, { opponents, allies, onWin, onLose, onPhase, maxAttackers = 1, safe = false })
  // or new game.Fight(game, {...}). Fight is imported from src/combat/fight.js; game.Fight is the same class.
  // m.fight.dispose() afterwards, as before. A new Fight now disposes the one before it first.

Each opponent: { npc, hp, power, aggression, windup, open, moves, name, drill,
                 guard = 0, boss = false, armor, phases, knockdownAt }
  guard: 0..1, the share of Nehorai's punches he blocks. A light punch hits the block; a heavy punch breaks through it.
  boss: true gives these defaults: hp 200, windup 1.05, open 1.1, moves ['slam','swing','slam','cross'],
        armor 0.8, phases [0.6, 0.3]. He gets a wider ring, a boss bar with his name, and the HUD hint "רק מכה חזקה או סיום קומבו".
  armor: 0..1, the share of a light punch he shrugs off. A light punch never staggers him and never stops his wind-up,
         and the HUD shows "לא מזיז לו · מכה חזקה". His health can only go to 0 from a big hit (a heavy punch or a combo finisher).
  phases: health shares, e.g. [0.6, 0.3], or objects [{ at, aggression, windup, moves, power, armor, pop }]. At each one
          he goes down for 1.4 s and gets up angrier (default: aggression x1.15, windup x0.88).
          onPhase(opponent, phaseNumber, def) fires when he passes one.
  knockdownAt: the health share under which a big hit puts him on the floor (default 0.4; 0 for a boss).
  Example 'הפטיש': { npc: game.npc('hammer'), boss: true, name: 'הפטיש', hp: 240, power: 1.2, windup: 1.1, armor: 0.8, phases: [0.6, 0.3] }
Allies: [{ npc, hp, power }] as before. They cover up only when the wind-up is aimed at them, otherwise they keep punching.

New moves in MOVES (src/combat/fighter.js):
  heavy: cost 26, damage 21, slow start (a load action; a hit during it cancels the punch)
  shove: cost 8, reach 1.3
  slam: an opponent's big overhead swing; breaks a block

Nehorai's buttons:
  #btnPunch: game.punch(). In a fight this calls fight.punch(): jab, then cross, then the finisher. Each punch must land
             within COMBO_WINDOW = 1.1 s of the last, and the finisher needs the 'combo' unlock. The finisher is an uppercut
             once 'uppercut' is known (a hook before that), costs 14, hits 1.25x, knocks him back 1.3 m and floors him if he is
             low. A miss, a block or a hit taken resets the count. Away from fights, the bag chain works exactly as before.
  #btnHeavy 'מכה חזקה': game.heavy() calls fight.heavy(). It breaks a block, staggers 0.8 s (0.65 s on armor), and floors him
             if he is low or caught open.
  #btnShove 'דחיפה': game.shove() calls fight.shove(). It pushes him back 1.15 m (0.55 m for armor), stops his wind-up, opens
             his guard for 0.8 s (yellow ring, the next hit counts double), and he waits longer before the next wind-up.
             A man with armor braces for 3.5 s after a shove; a second shove in that time only rocks him ('braced').
  #btnBlock and #btnDodge: as before. A big hit (heavy or slam) breaks a held block: 60% of it lands, and the HUD shows "ההגנה נשברה".
  Punches, heavy punches and shoves now take a short step in (up to 0.6 / 0.7 / 0.3 m).
  Keyboard: U is the heavy punch and I is the shove (in a fight).
  #btnHeavy and #btnShove show only while a Fight runs, through hud.setFists(on). In a running fight the fists win over the
  marker's buttons.
  game.fists(on?) forces the fist buttons on screen on foot (true/false) and returns { up, combat, fighting, heavy }.

Knockdown: Fighter.floor(seconds = 1.5) sets state 'floored' with the 'floored' pose, then 'rising' (the getup action,
  0.8 s and invulnerable), then 'idle'. fighter.floored covers both states. Nobody can hit a floored man. He is not out:
  fight.standing still counts him.
Opponents now step in to 1.35 m during their wind-up, so a man who stands his ground is hit. A swing lands on the one it was
  aimed at (opponent.against) if he is still in reach.

Fight fields for missions and tests: fight.combos, fight.heavies, fight.interrupts, fight.chain, fight.boss, fight.opponentOf(fighter).
Opponent fields: o.against, o.phase, o.interrupted, o.winding, o.mode.
Fighter fields: floors, shoves, breaks, shrugged, braced, thrown, armor, floorable.
Fighter.takeHit(from, damage, move, { heavy, finisher, shove }) returns 'hit' | 'broken' | 'armor' | 'floored' | 'down' |
  'shoved' | 'braced' | 'blocked' | 'dodged' | 'none'.

HUD (src/ui/hud.js), all driven by Fight.update; Fight.end and Fight.dispose clear them:
  setCombo(n, finished): #combo with pips and '×n'
  setFoe({ name, frac, open, floored } | null): #foeBar, the one he faces; hidden while the bout board is up
  setBoss({ name, frac, phase, marks, open, floored } | null): #bossBar, with a mark at each phase
  Landscape: top centre. Portrait: in the top-left column, under the map.

New poses (src/characters/poses.js): POSES.floored; ACTIONS heavyload, heavy, shove, reel, bigwindup, slam.

Notes from its builder for others:

- tests/stage-j.test.mjs line 188: rows.length === 33 should become 46 (or count only chapters 1-3). This failure comes from the chapter-nine scaffolding, not from the fists work.
- src/main.js window.__game.state, outside my controls block: add 'btnHeavy' and 'btnShove' to state.buttons, and floored, boss, phase and winding to state.fight.opponents, so stage-r and stage-t can read them.
- src/game.js playAs(id) is outside the fight wiring: also set this.fighter.body.model = model. Otherwise, in a fist fight played as someone else (say Ido in m41), the punches never land, because the old model's actions are never animated. This bug is already in the base code.
- src/debug/bot.js fightBot could learn { shove, heavy } for the mission tests (shove a wind-up while t > 0.3 and d < 1.8; heavy when the opponent is open). Optional: stage tests can press the buttons as tests/fists.test.mjs does.
- src/characters/extras.js (cast part): the 'hammer' npc for 'הפטיש'. Missions pass { npc: game.npc('hammer'), boss: true, name: 'הפטיש', ... }.
- docs/chapter9.md could record the final API above, including fists(), the 'braced' rule and that the last blow on a boss must be a big hit.
- Behaviour changes that reach chapters 3, 7 and 8 (the stage-j fights pass with them; stage-n and stage-p were not run, as instructed):
  - opponents close in while winding up, so their punches land on a player who stands still
  - punches take a short step in
  - in a fight, the third punch landed in a row is the finisher, not the third thrown
  - heavy and shove appear in every Fight, including m2's drills and m12's ring
  - a running fight hides the marker's buttons
  - allies cover up only when the wind-up is aimed at them

### weapons-cast (as built)

The branch is four commits on top of 7e0067a. roster.js is unchanged because nothing new had to be declared there.

(A) WEAPONS TAKEN AND GIVEN BACK (game.paint, src/combat/paint.js)
- paint.stash({ player = false, allies = [] } = {}) -> returns a copy of the stash.
  - It records who carried what: the player's colour, each armed ally as { id, color }, and the overwatch if one is set ({ id, post, range }).
  - It disarms them all. Their guns come out of their hands; marked or aiming allies stand up again; the overwatch is cleared. The player, the allies and the overwatch can no longer fire or reload, and #gunActions (fire, reload, mark, and #btnSquad, which sits in the same block) is hidden.
  - The guards keep their markers and their place on the board.
  - The record is written to game.progress.stash and saved straight away (game.save()).
  - It is idempotent. Calling it again while stashed merges in anyone armed since and loses nothing.
  - On a fresh page where nobody is armed yet, you can name who should be in the stash anyway: stash({ player: true, allies: ['erez', { id: 'ido', color: '#00e08a' }] }). A colour left out comes from COLORS[id].
- paint.unstash(who = null) -> true if something was given back.
  - It gives each person exactly his own marker in his own colour (the player via armPlayer(colour), each ally via addAlly(game.npc(id), colour)), puts the overwatch back at his post, and saves.
  - who: one id or a list ('player' or the playing-as id means the player's marker). Only those are given back; the rest stay in the stash, so a wall of weapons can be emptied one marker at a time.
  - It is idempotent: with nothing stashed it returns false and changes nothing.
- paint.stashed (boolean) is the same as !!progress.stash, so it is true again after a page reload.
- paint.stashContents is a copy of { player: { color } | null, allies: [{ id, color }], overwatch } or null. Use it to draw the rack of markers.
- paint.removeAlly(npc) is new: it takes one friend's marker away.
- While stashed nobody holds a marker: the fire, reload and mark buttons are hidden and fire(), reload() and mark() do nothing (the 'אין נשק' toast was removed: no player could reach it).
- Explicit arming wins over the stash. armPlayer, addAlly or setOverwatch on someone whose marker is in the stash removes that entry, and the stash is cleared once it is empty. So a replay of an earlier armed mission (armCrew) never leaves a stale stash behind.
- paint.dispose() and paint.reset() never touch the stash.
- Recipe for a mission's restore: before the weapons are taken, call paint.unstash() then armCrew(game); after they are taken, call paint.stash(), or stash({ player: true, allies: TEAM }) on a fresh page.
- Also changed in paint.js: guns that are put down (disarm, removeAlly, removeGuard, dispose), the cones of removed guards and wiped splats now free their geometry and materials. The materials all markers share are kept.

(B) THE SAVE (src/save/progress.js)
- newProgress() now has stash: null.
- loadProgress() runs the saved stash through the new exported cleanStash(s), which returns { player, allies, overwatch } or null.

(C) THE CAST (src/characters/extras.js, builder.js, head.js)
- New spec options, usable by any spec:
  - mask: { color } draws a balaclava over the head and neck. It is a knit layer with a real eye slit (eyes and brows show) and a rolled hem; the nose and ears show through it as shapes in the knit; no lips are drawn.
  - hair: { style: 'shaved' } (or no hair at all) gives a smooth scalp with a darker stubble shade.
  - gloves: { color }.
  - band: { color, arm: 'left' | 'right' | 'both' } is a band on the upper arm, over the sleeve or the bare arm.
  - vest: { color } is a tactical vest with three pouches and shoulder straps.
  - All of these are baked into the same single skinned mesh, so each person is still one draw call.
- New exports: ORDER (the people below) and ORDER_GUARDS = ['og1' … 'og16']. ORDER is spread into GUARDS, so game.npc(id) finds them with no change to game.js.
  - 'shadow' (הצל): height 1.08, all black (zip top, pants, boots), black gloves and a black mask with an eye slit.
  - 'hammer' (הפטיש): height 1.15, shoulders 1.34, arms 1.32; shaved head with stubble, black tank top, dark red bands on both arms, cargo pants, boots.
  - 'og1'…'og16' are named 'שומר' and all have crew: true. They wear black tactical clothes (mostly a black zip top, cargo pants or pants, boots) with a dark red band (#6e1a1e). Some wear vests, gloves, a tee or a tank top. Skin tones, heights (0.95–1.08), builds, hair styles and colours (shaved heads included) and facial hair all vary.
  - Everyone in ORDER is invented.

Notes from its builder for others:

1. src/game.js progressForChapter(n): add stash: null to the object it returns. main.js beginAt does Object.assign(game.progress, progressForChapter(n)) onto the loaded progress, so an old stash would carry into a try-out start. A new game is fine, because newProgress() already has stash: null.
2. index.html / src/ui/hud.js: #btnSquad sits inside #gunActions, so while the gang is stashed the squad-order button is hidden too (confirmed in the stashed screenshot). If missions 37–39 need squad orders without markers, the button has to move out of #gunActions or be shown by itself.
3. src/input/controls.js: the J and R keys only reach onFire/onReload while #btnFire is visible. While stashed the fire button is hidden (as specified), so on touch the 'אין נשק' toast only comes from a direct press or call. For a keyboard player to see it, J/R would also have to call onFire/onReload when neither the fists nor the fire button are on screen.
4. Optional, src/main.js: window.__game.state.paint is null whenever the player is unarmed. Adding stashed: game.paint.stashed to the state would make it easier for mission tests to check.
5. Mission authors (m37, m39): call paint.stash() when the weapons are taken and paint.unstash() at the wall of weapons (or unstash(ids) as each marker is picked up). In every restore, call one of them, since both are idempotent. The armory rack can be drawn from paint.stashContents. Guards of the Order: postGuards(game, place, [['og1', route], …]); the bosses are game.npc('hammer') and game.npc('shadow').

### atmosphere (as built)

Everything below is already on the game today: game.fx, game.sound, game.daylight, game.player and game.overlay (the Fx constructor makes game.overlay).

RAIN: game.fx.rain(on = true, { strength = 1, wind = {x: 1.2, z: 0.6}, under, seconds = 1.5 })
- strength is 0.05..1.5. At 1 it draws 2600 drops in a 28 x 18 x 28 m box that follows the camera (the drop count, streak length and loudness follow strength). The streaks are drawn by one indexed mesh whose shader places the drops, plus a pool of 220 splash sprites on the ground near the player: 2 draw calls in all. While it rains the light goes darker and bluer (game.daylight.setWeather) and you hear rain (game.sound.rain).
- under(x, z, y) returns true where there is a roof: there the streaks fade out and the rain sounds muffled overhead. Use it for the port's warehouses and the death road's tunnel.
- seconds is how long it takes to come in or go out. rain(false, { seconds: 0 }) stops it at once.
- When rain is off, the mesh is taken out of the scene and the sound graph is let go.
- Getters: fx.raining, fx.rainLevel.
- fx.lightning({ delay = 1.4, strength = 0.5 }) gives a pale screen flash, then thunder.

RED ALERT: game.fx.redAlert(on = true, { at: {x, z, y?}, r = 26, id = 'alert', points: [{x, z, y?}], mats: [material], color = '#ff2414', rate = 1.2, intensity = 70, height = 3.2 })
- Two pooled red PointLights in total, shared by every area: each frame they go to the two beacons nearest the player.
- By default an area has two beacons, at the centre ±0.3 r and `height` m up, flashing in turn. `points` hangs them yourself; give y on a floor.
- `mats` are lamp materials whose emissiveIntensity flashes with the lamps; it is put back when the alert ends.
- While the player is inside r, the ambient light goes a dim red (game.daylight.setAlert) and the screen edges pulse red (game.overlay.alert). Both are eased and clear again outside the area.
- The call returns the area. Another call with the same id replaces it.
- redAlert(false) ends every area; redAlert(false, { id }) ends one. The lamps leave the scene when no area is left. Getter: fx.redAlertOn.
- Without at, the area centres on the player. Pass at.y inside roofed sites.

BIG BLASTS: fx.explode(x, y, z, { ...as before, flash: true | '#colour' }) also flashes the screen when the player is close. It is off by default, so chapter eight's blasts look as they did.

RESET: game.fx.resetAtmosphere() turns off, at once, the rain, red alert, the overlay (daze, eyes, map cover, red edges), the music, the rain sound, the heartbeat, and sets player.speedScale back to 1. Use it for cleanup and before a restore stages a scene.

SOUND (game.sound):
- music('action' | 'calm' | null, { fade = 1.6 }) crossfades. 'action' is an original loop at 126 bpm in D minor (Dm, Bb, Gm, A): kick, snare with a fill, hats, a plucked saw bass, a pad and a high square figure. The first two bars are drums and bass only. 'calm' is slow Dm9, Bbmaj7, Gm9, A7sus4 pads, a soft low note under each and an occasional bell.
  - Notes are scheduled 0.25 s ahead by a 50 ms timer. The timer runs only while music or the heartbeat plays; it skips ahead after a stall and never bursts.
  - Each note's nodes are disconnected when it ends.
  - It plays through its own bus at musicVolume (0.32) into the master, so the mute and pause buttons cover it. setMusicVolume(v) changes it.
  - Called before sound has started, it is remembered and starts with the first tap. sound.musicMode is the mode last asked for.
- rain(k, { muffled }) is called by fx.rain; you need not call it yourself.
- gas(seconds = 5, level = 0.12) plays a hiss that swells, holds and fades. It returns a function that stops it early.
- heartbeat(on = true, { bpm = 62, level = 0.5 }) is a muffled lub-dub through a 140 Hz lowpass. Calling it again with on changes the pace; false fades it out.
- quiet() turns off the music, the rain and the heartbeat.
- sound.voices counts the atmosphere sources still running. sound.atmosphere is { music, rain, heartbeat, voices, timer }.

DAYLIGHT (game.fx drives these; a mission may call them too): daylight.setWeather(k 0..1, seconds = 2.5) and daylight.setAlert(k 0..1). They lay over the hour without changing it. With both at 0 the light is exactly as before.

WALKING PACE: game.player.speedScale, default 1, held to 0.4..1. It scales only the stick's walk and run target speed, and the walk animation slows with it. Shoves, dodges, the car and the camera are untouched. It is not saved: restore must set it. The controller stays the same when you play as Ido, so set it back to 1.

OVERLAY (game.overlay, src/ui/overlay.js; export class Overlay, export function install(game)):
- daze(amount 0..1, seconds = 0.8): blur up to 7 px with lower saturation (backdrop-filter; on browsers without it, a filter on the canvas), a dark vignette, and a slight sway of the 3D canvas (scale, rotate, translate; none when the device asks for reduced motion). The HUD stays sharp because the layer sits between the canvas and #hud.
- eyes(closed 0..1, seconds = 0.8): eyelids close from the top and bottom.
- mapHidden(on = true, text = 'מתחת לאדמה'): a round label (#mapCover) takes the minimap's place. It is hidden in cinematic mode. off brings the map back.
- flash(color = '#ffffff', ms = 420, strength = 0.85): a full-screen flash that fades by itself.
- alert(k): the red edges (fx.redAlert sets them).
- clear(), dispose(), and the state getter { daze, dazeTarget, eyes, mapHidden, mapText, alert }.
- update(dt) is called from fx.update each frame, so easing and sway follow game time.
- Every layer has pointer-events: none, so the joystick works while dazed (tested).

Notes from its builder for others:

1. game.js (optional; today nothing breaks without it). Add `import { install as installOverlay } from './ui/overlay.js';` and call `installOverlay(this);` right after `this.fx = new Fx(this);` in the Game constructor. The Fx constructor already calls install(game) and install only builds once, so game.overlay exists now; the line in game.js just shows where it comes from.
2. Chapter-9 missions (workflow B) should call `game.fx.resetAtmosphere()` in each cleanup, and at the start of each restore before staging rain, alert, daze or speedScale again. The mission framework resets none of these, and speedScale stays on the controller when playing as Ido. A suggestion: src/missions/missions.js stop() could call game.fx?.resetAtmosphere?.() for chapter 9, or src/missions/phoenix.js could wrap it.
3. Site builders: port.js and deathroad.js could expose a roof/tunnel test, e.g. `place.under(x, z, y)`, to pass as fx.rain({ under }). facility.js could expose its red emergency lamp materials, to pass as fx.redAlert({ mats }), and its lamp points as `points`. Do not also register those materials as night emissives, because daylight.apply would then set their glow too.
4. main.js (optional, for stage tests): add to __game.state `atmosphere: { rain: game.fx.rainLevel, redAlert: game.fx.redAlertOn, music: game.sound?.musicMode, overlay: game.overlay?.state, speedScale: game.player.speedScale }`.
5. radio.js (optional): duck or stop mission music while the car radio's procedural station plays, since they overlap if a mission leaves music on in the car.
6. dist/play.html is tracked in git. I rebuilt it to test, then put it back to HEAD; nothing in dist/ is committed.

### safehouse (as built)

I built ctx.places.safehouse (בית המסתור) in src/world/safehouse.js. The header comment at the top of the file lists every field of the place object. A "spot" is { x, z, yaw, y } in world coordinates, and y is the floor height (the house floor and the yard are level).

Where things are:
- The pad is x 622..678, z -193..-157, flattened in layout() with a keepOut so no trees stand in it.
- The house is x 626..646, z -185..-166, one storey, 3 m high, with a flat roof that also acts as a ceiling for the camera.
- A low wall runs round the property. There is a 12 m gate (no leaf) in the east wall at x 678, z -181..-169, which opens onto the death road's start (680, -175).

Fields:
- x, z, y, toWorld, toLocal, group.
- bounds (the pad) and house (the footprint), each { x0, z0, x1, z1 }.
- inside(x, z): true inside the house.
- Standing spots: living, kitchen, hallway, gearRoom, bunkRoom, tvFront, doorAt (just inside the front door), outside (the porch), yard, gate, gateOutside (681, -175), behind (the strip west of the house), terrace (the pergola and picnic table).
- roadStart: { x: 680, z: -175 }.
- tv: { x, z, y, yaw } of the screen's centre. The screen is 2.6 m wide on the west wall and faces east.
- screen.show(mode, opts?) → returns screen. mode is 'off' | 'shadow' | 'video' | 'map'. It draws on one 1024x576 canvas texture and only redraws when the mode or opts change.
  - 'shadow': a hooded figure in a black balaclava with an eye slit, on red and black, with a "שידור חי" tag.
  - 'video': a still of a huge industrial compound at night (halls, tanks, chimneys, a tall tower, cranes, floodlights, a fence). The default caption is 'הנמל השחור · מצלמה 3'; opts { caption, time } change it.
  - 'map': five red-ringed bases on an invented coast under the title 'הבסיסים של המסדר השחור'; opts { title, bases: [{ label, x, y }] } (x, y in 0..1).
  - opts.caption works for every mode.
  - screen.mode, screen.on, screen.mesh, screen.material, screen.texture.
- seats: nine spots in this order: 0 nehorai, 1 erez, 2 ido, 3 yonati, 4 avraham, 5 muller, 6 dolev, 7 hadar, 8 liam. So seats[i + 1] is TEAM[i] in firestorm.js.
  - Nehorai sits on the main sofa between Erez and Ido. The main sofa has four seats, the side sofa three, plus two armchairs, all turned to the TV.
  - Each seat is { x, z, yaw, y, k, who, on: 'sofa' | 'side' | 'armchair', stand }. stand is the spot 0.75 m in front of it: walk there, then sit.
  - To seat a friend: n.idle = null; n.posed = false; n.place(s.x, s.z, s.yaw, s.y); n.model.setPose('sit').
  - Every seat is clear of colliders, so the player can sit in any of them with game.player.place(s.x, s.z, s.yaw, s.y) and game.nehorai.setPose('sit') and will not be pushed.
- seatFor(id) → a seat, or null for anyone outside the gang.
- kitchenSeats: four chairs at the kitchen table, each { x, z, yaw, y, on: 'kitchen', stand }.
- sofa and coffeeTable: their centres { x, z, y }.
- gear: the spot in the gear room facing the rack, { x, z, yaw, y }, plus:
  - gear.mesh: the nine markers on the wall rack, each hopper in its owner's COLORS colour, with names under them. Hide it when taken.
  - gear.bags: the bags, masks and paint box on the table.
  - gear.rack, gear.table ({ x, z, y }) and gear.slots.<id> (each marker's { x, y, z }).
  - gear.taken, gear.take({ bags = true }), gear.reset().
- lights(on) → bool. false turns off every lamp of the place (rooms, porch, gate), their bulbs and the window glow, and also turns the TV off. true brings them back and leaves the TV as it is. lightsOn is a getter.
  - The TV's glow is a lamp in front of it: red for 'shadow', blue for 'video' and 'map'. It follows the screen, not the power. So lights(false) then screen.show('shadow') leaves the room lit only by the TV, and the windows glow faint red from outside.
- switch: the light switch in the living room by the hallway opening. breaker: the fuse box in the hallway. Each is { x, z, y, mesh, at }, where at is the spot to stand.
- door: the front door, a makeSite door with setOpen, lock, unlock, open, locked and pos. It is open after the build.
- car: the Renault's spot { x, z, yaw, y }. cars: [spot, spot] for the gang's other two cars. All three sit in painted bays, face north-east (yaw about 2.0–2.7), and point straight through the gate at (680, -175).
- kit: a first-aid kit (white box, green cross) in the bunk room, { x, z, y, mesh, at }.
- lamps: 8 entries, each { x, y, z, inside, range, intensity, color?, kind: 'house' | 'porch' | 'gate' | 'screen', k, light }. emissives: [a probe material]. main.js wires both to the night.
- materials: { bulb, window, screen }.
- reset(): lights on, TV off, gear and kit back, door unlocked and open.
- tick(camera, dt): world.js already calls it.

How the lights switch: the place reads the night level from the probe material that the daylight drives. It finds the PointLights main.js made from its lamps in the scene and puts a switch (lamp.k) inside each one's intensity, so the daylight's values and dimNear still apply. If main.js ever sets lamp.light itself, that is used instead.

Cost: 23 meshes and 8.4k triangles for the whole site, 8 lamps, no shadows. The only canvases are the screen (1024x576), a rug (256), the floor and yard textures (256) and the names strip. There are no prompts: missions add them.

Notes from its builder for others:

- src/friends/npc.js: behave() drops a pose set from outside on the next frame if the friend had a standing habit before (posed is true), so 'sit' does not stick. I documented the workaround in the safehouse header: set n.idle = null and n.posed = false before setPose('sit'). m26 seats friends without this. A lasting fix would be for npc.js to clear posed when idle is cleared or when a pose is set from outside.
- src/main.js lampsOf (optional): setting `l.light = pl` on each lamp entry would let places switch their own lights without searching the scene. safehouse.js already uses lamp.light when it is set.
- src/world/deathroad.js: start the road at (680, -175) heading north-east. The yard's gate is the opening at x 678, z -181..-169, and the three car spots' lines all pass through (680, -175). Keep props and roadblocks out of the gate and the first few metres, and keep its pad clear of the safehouse pad (x 622..678, z -193..-157, blend 10).
- src/combat/paint.js: safehouse.js imports COLORS from it (each rack marker's hopper is in its owner's colour). The weapons-cast part should keep that export.
- tests/walk.test.mjs: the guide says the new sites go into this file. My cases are in tests/walk-safehouse.test.mjs; integration can fold them in or run both.
- Missions (m34, m46): call place.reset() in restore and cleanup, then set the scene (lights, screen, door, gear) from it. gear.take() is all that hides the markers; arming people is the mission's job.

### deathroad (as built)

The death road is built as `ctx.places.deathRoad` (called P below). It is laid out like ironroad.js and kotziroad.js.

Roads in ctx.net, held in P.roads:
- main 'כביש המוות': 10 m wide, about 1028 m long. It starts at (676,-175) inside the safe-house yard pad and takes its height from that pad. It runs north-east along a straight of s 62..302 and bends east along z ≈ -429. It ends at (1546,-350.5), just inside the port's west gate.
- tunnel 'דרך המנהרות': 8 m wide. It leaves main at the fork (1000,-430) and runs along z ≈ -452. It rejoins main at about x 1442.
- dirt 'דרך העפר': 6 m wide, drawn as earth. It leaves at the same fork, runs along z ≈ -385 and rejoins main at about x 1466.
- Five side roads, j1..j5. Each has an open shed at its far end where a rival waits.
- world.js paves the roads in `places.deathRoads` (main, tunnel, j1..j4). The dirt track and j5 are drawn as earth here.

Layout data in `ctx.deathRoad` (read by layout code):
- `{ roads, ramps, ditch, s: {fork, tunnelOut, dirtOut, j1..j5, gate, end}, startH, endH, gate: {x,z,y} }`

What P holds:
- `P.routes = { main, tunnel, dirt }`: ordered `{x,z}` points about 3 m apart, from the yard (s 4) to P.end. Each stays in its right-hand lane. They move around the barricade at s 105, the parked truck and the tunnel barricade, and keep off the highway ramps. The dirt route goes over its ramp. To drive one: `window.__game.drivePath([['points', P.routes.dirt]], cruise)`, or `new Autopilot(P.routes.x)`.
- `P.lengths = { main, tunnel, dirt }` (metres). `P.lanes = { main: 2.4, tunnel: 2, dirt: 1, spur: 1.5 }` (metres right of the centreline).
- `P.yard {x,z,y}`, `P.start {x,z,y,yaw,s}` (main s 6, right lane).
- `P.end {x,z,y,yaw,s,r:9}` is about 5 m before the gate, at (1535,-354). `P.gate {x,z,y,s,yaw}` is where the road crosses x 1540.
- `P.fork {x,z,y,yaw,s, choices:[{route,label,side,at}]}`. The three choices are main, tunnel and dirt. A sign gantry stands 48 m before the fork with 'המנהרות ←', 'כביש המוות ↑' and 'דרך העפר →'.
- `P.rejoins {tunnel, dirt}`. `P.rejoin` is the first point on main after both have joined.
- `P.checkpoints = [{name:'start'|'fork'|'rejoin', road:'main', x,z,y,yaw,s}]`.
- Tunnel: `P.tunnels[0]` (also `P.gallery`) = `{road:'tunnel', route, s0, s1, halfWidth:7.3, height:5.6, start, mid, end, lamps}`.
  - It is a covered gallery about 186 m long, x 1112..1298. There is a solid wall on the hill side, and columns and a parapet on the other side.
  - 12 ceiling lamps are in `P.lamps`. The tunnel bulbs glow day and night.
  - The roof is registered with `cols.addFloor`, so the camera stays inside.
- `P.ramps = [{road:'main'|'dirt', route, s, run, rise, lane, hx, x,z,y,yaw, end:{x,z,y}, path}]`.
  - The pads use `launch = true` and `slope = rise/run`, exactly as kotziroad.js does.
  - Two highway ramps sit in the left lane, at x ≈ 1050 and x ≈ 1325.
  - One full-width ramp on the dirt track ends at the ditch's near lip.
  - `path` is a 110 m run over the ramp. To count jumps, use `car.launches` as m31 does.
- `P.ditch = {road:'dirt', route, s, x,z, y (floor), top (road), half:4, across:26, yaw, near, far, ramp}`.
  - A dug pad 2.4 m deep with broken abutments either side.
  - The abutments are solid up to road −0.5 m. A car that falls short stays in the ditch and has to climb out across the banks beside the track.
- `P.roadblocks`, in order:
  1. `{kind:'barriers', road:'main', route:'common', s:105, gap:[-2.7,2.7]}`
  2. `{kind:'barriers', road:'tunnel', ...}`
  3. `{kind:'truck', road:'main', route:'main', s, x,z, yaw, gap:[-5,2]}`: a lorry parked in the right lane at x 1122.
  4. `P.closure`.
- `P.closure = {kind:'closure', road:'main', s, x,z,y,yaw, closed, before:{x,z,y,yaw,s}, close(), open()}`.
  - `close()` puts a lorry across the highway at x 1182, with barriers out to the gallery parapet and to the dirt track's shoulder.
  - It starts open. `open()` removes the colliders.
- `P.blasts`: 18 spots, each `{x,y,z,s, road:'main'|'tunnel'|'dirt', route:'common'|'main'|'tunnel'|'dirt', side, kind:'drum'|'shed'|'wreck'|'tank', size}`.
  - Each has a prop and a collider, about 10–13 m off the centreline.
  - The mission sets them off with `new Blast(game, { at: b, size: b.size, warn, ... })` when `|road s − b.s|` is small.
- `P.joins`: 5 entries `{name:'j1'..'j5', road (name), x,z,y,yaw (the waiting spot inside the shed), onto:'main'|'dirt', route, s (merge s), path}`.
  - `path` runs from the waiting spot, down the slip road, onto the route, for about 140–160 m or to the end.
  - To use one: `car.place(j.x, j.z, j.yaw)`, then `new Autopilot(j.path)`, and after that `P.pathFrom(route, x, z)`.
- `P.truckRun` (= `P.truckRuns[0]`, on the common NE straight, s 292→128) and `P.truckRuns[1]` (main, x 1430→1215). Each is `{road:'main', route, s0, s1, lane:2.4, dir:-1, dodge:-2.4, start:{x,z,y,yaw}, end:{x,z,y}, path}`. The lorry starts at `start`, faces against the traffic, and drives `path` in the gang's own lane. `dodge` is the free lane.
- Functions:
  - `P.routeAt(x, z)` returns `{route:'common'|'main'|'tunnel'|'dirt', road, s}` or null.
  - `P.pathFrom(route, x, z)` returns that route's points from the nearest one onward.
  - `P.remaining(route, x, z)` returns the metres left to P.end.
- `P.lamps` (about 30: road lights at night, plus the tunnel lamps), `P.emissives`, `P.group`. There is no tick.

Notes from its builder for others:

- src/world/port.js: its layout runs after mine, so it can read `ctx.deathRoad.gate` ({x≈1540.6, z≈-351, y}) and `ctx.deathRoad.endH`. The road ends at `endH = baseHeight(1685,-345)` (≈ -50.26), on the guess that the port's yard pad uses that height. The west gate opening should be centred on z ≈ -351, and nothing solid should stand in it while it is open. The road ends 6 m inside x 1540, so the port's yard surface wins there.
- src/world/safehouse.js: the road starts at (676,-175) and takes its height from whatever non-walk-only pad covers (676,-175) (fallback baseHeight(650,-175)). The yard needs an open exit at x ≈ 678, z ≈ -175. The gang's cars should face east toward P.start (682,-173). Side road j1's shed is at about (751,-161), well clear of the house.
- src/missions/m35-deathroad.js: everything above is ready for it. The mission still has to do these things:
  - set off P.blasts with a warning (Blast);
  - spawn rivals at P.joins;
  - drive the lorry along `P.truckRun.path`;
  - optionally call `P.closure.close()` at the fork and `open()` in restore and cleanup;
  - count jumps with `car.launches`;
  - use `P.checkpoints` for restore.
- src/world/world.js (seen, not caused by this part): the paint lines pave() draws (lift 0.035) never show on the chapter 8/9 highways, the iron road included. The asphalt ribbon's polygonOffset (-2/-2) draws over them. Giving the paint a polygon offset too, or more lift, would fix it.

### port (as built)

I built ctx.places.port, הנמל השחור. It is all in src/world/port.js; world.js is untouched.

**Coordinates and floors**
- The yard is x 1540..1830, z -440..-250.
- The basin is x 1600..1800, z -420..-320. It is a lowered pad (covered: false, floor 9 m down) with a water plane 2.2 m below the quay. The four quay pads around it slightly overlap each other.
- Quay level is `port.y` = baseHeight at the gate + 0.05 = -50.706.
- Ship decks are at `port.y + DECK` (DECK = 2.4). The tower room floor is at `port.y + 12`.
- Every point below is `{ x, z, y, yaw? }`, with y on its own floor.

**The gate**
- `gate`: a makeSite door at world (1540, -350). It is locked and closed at build.
- `gateOutside` (1535, -350) and `gateInside` (1545, -350).
- `gateSpots[10]`: places for the gang outside the gate.
- `parking[3]`: `{ x, z, yaw }` car spots outside the gate, facing east, no y.
- `posts { gate, east }`: two guard booths.

**The control tower** (site-local (-100, 45), stairs wrapping its core)
- `tower`:
  - `foot`
  - `stairs[4]`: each `{ bottom, top, yaw, rise, run }`
  - `landings[4]`
  - `top` (the top landing), `door` and `doorAt`
  - `room`, `alarmAt`, `view`
  - `floor` (the room's height)
  - `inRoom(x, z, y)`
- `alarmAt` (also on the place itself): stand here to work the panel.
- `alarm { on, at, setOn(on) }`: the panel and its lamp show red while on, green when off.

**The access card** (in the west warehouse's office)
- `card { x, z, y, mesh, taken, take(), put() }`: `take()` hides it, `put()` puts it back.
- `cardOffice { door, doorAt, inside, desk }`: the door is open at build.

**Warehouses, ships, cranes, basin**
- `warehouses[2]`: each `{ x0, x1, z0, z1, opening, side, inside }`.
- `ships[2]`: north quay, then south quay. Each has:
  - `deck`, `fore`, `stern`
  - `gangway { bottom, top }`
  - `cabin { door, doorAt, inside }`: the door is open at build.
  - `hull { x0, x1, z0, z1 }`, `deckLevel`
- `cranes[3]`: each `{ x, z, legs[4], tip, cab }`.
- `basin { x0, x1, z0, z1, water, mesh }`.
- `inBasin(x, z)`, `inside(x, z)`.

**Search lights**
- `searchLights[2]`: each `{ pos, target, radius, on, setOn(on) }`. One is on the tower roof, one on a mast over the storage rows.
- `searchSees(x, z, y = port.y)`: true while the point is inside a beam's spot with a clear line from the lamp. A container in between hides you.
- `setSearch(on)`: turns both on or off.
- The beams are only visible at night. `place.tick` sweeps them; world.js already calls it.

**The passage and the elevator**
- `passage { door, front, mouth, inside, back, out, container }`: `door` is the false back of one container in the stacked wall. It is locked at build.
- `entrance`: where the gang gathers, inside the corner.
- `entranceSpots[10]`.
- `inCorner(x, z)`.
- `elevator`:
  - `door`: a 3 m makeSite door, open at build. `lock()` closes and locks it.
  - `doorAt`, `inside`
  - `spots[10]`: all inside the cage.
  - `contains(x, z)`
  - `cage { x0, x1, z0, z1 }`, `headframe`
  - `setLamp(ok)`: green or red.

**For the mission**
- `patrols`: 12 routes for `postGuards(game, port, [[id, key]])`. A single point means a guard standing still.
  - Standing: `gate`, `towerFoot`, `towerTop` (y = floor 12), `office`.
  - Walking: `gateLane`, `westRows`, `westQuay`, `northQuay`, `shipA` (y = deck), `southQuay`, `storage`, `eastQuay`.
- `cover` (159 entries), `coverSpots[13]`.
- `route[16]`: the quiet way from the gate through the office to the passage front.
- `lamps` (about 45) and `emissives` (bulbs, windows, screens, the alarm panel, the card). main.js already hooks these to the night.
- `tick(camera, dt)`: sweeps the search lights. It hides the whole port when the camera is more than 650 m away.

Notes from its builder for others:

- **src/world/deathroad.js (the death road's owner):** end the road at `port.gateOutside` = world (1535, -350), heading east into the gate. Its surface there should be at about `port.y` (-50.706, which is baseHeight(1540, -350) + 0.05). My west quay pad reaches x 1534 and blends 10 m further west, so a road much lower than that would have terrain showing through its asphalt near the gate. The parking spots at about x 1522..1530 sit by the road's end.
- **Minimap (src/ui/minimap.js, not mine):** it draws every non-walkOnly pad as paving, so the basin shows on the map as paved ground. If wanted, it could skip pads with `covered === false`, or draw them in a water colour.

### facility (as built)

ctx.places.facility (src/world/facility.js; also exports ARMORY_CODE = '4719'). Every spot is {x, z, y} in world coordinates, with yaw where it matters. Pass the spot's y to npc.place / player.place / postGuards: there are floors (catwalk, stands, ramp) above some of the ground.

HOW IT IS BUILT
The complex is dug 6 m into the plain. Its floor y is about -55.17.
- Inside, the complex runs from x 1428 to 1612 and from z -192 to -48. A ceiling covers every room.
- From above you see a fenced concrete lid (top `lidY` about -49.07) with nine air shafts, the hangar's bunker roof (14 m), and the ramp's cutting.
- The inside group (`interior`) is drawn only while the camera is under the lid, or on the ramp with the exit open. The lid, hangar walls, ramp and fence are in `shell` and always drawn.
- Free-walk default: every door is unlocked and open. Missions stage their own state.

PLACE FIELDS
- `x, z, y, toWorld(lx, lz)`, `lidY`, `surfaceY` (the exit's ground height, about -48.06), `interior`, `shell`
- `inside(x, z)` → under the ground (use it for the minimap)
- `zoneAt(x, z)` → 'arrival' | 'cells' | 'corridor' | 'guardRooms' | 'machines' | 'arena' | 'armory' | 'tunnels' | 'stores' | 'trap' | 'saferoom' | 'hangar' | 'exit' | null; `zones`
- `cover` (the place's cover boxes), `redLamps` (37 × {x, y, z, zone}), `lamps` (82, 79 of them inside), `emissives`
- `alarm(on)` flashes the red emergency lamps; `alarmOn`
- `reset()` puts doors, rack, kit, vehicles, machines, clipboard and lights back to the free-walk state
- `tick(camera, dt)` animates doors and machines

DOORS
- `doors[name]`, `doorList` (27 doors). Names: arrivalDoor, carGate, guardDoor, bigCell, cell1, cell2, cell3, shutter, guardRoom1, guardRoom1Back, guardRoom2, guardRoom2Back, machA, machB, arena, cage, armory, rackGate, t1Corridor, t1Stores, t2Stores, hangarW, t2Hangar, t1Hangar, trap, saferoom, exit.
- Each door works like compound.js's doors: `setOpen(o)`, `unlock()`, `lock()`, `open`, `locked`, `body`, `pos`, `yaw`, `w`, `h`, `kind`, plus `snap()` (jump straight to the end state, for restore).
- The leaf animates over 0.7 s; the collider changes at once. The lamp is green or red.
- `setDoors({ name: true | false | 'locked' })`, `openAll()`, `closeAll()`, `snapDoors()`

ARRIVAL HALL
`arrival` = `{ car: {x, z, y, w, d}, gate (carGate, rises), inCar[10], spots[10], centre, door (arrivalDoor), doorAt, doorOut }`

HOLDING CELLS
`cells` = `{ door, hall, wake[10], guardDoor, guardIn, guardOut, guardEntrance, big: { door (bigCell), inside, doorIn, doorAt }, row[3]: { door (cell1..3), inside, doorAt }, doors[4], openAll(), closeAll() }`
- Each `wake` spot is `{x, z, y, yaw, pose: 'sit' | 'down'}`. The 'sit' spots are on the bench.
- Cell doors are barred and slide open.

IRON CORRIDOR
`corridor` = `{ start, end, points[10], bays[13] ({x, z, y, side: 'n' | 's'}), fights[5], shutter, shutterAt: { west, east }, guardRooms[2]: { door, back, inside, out, backOut }, from[4], redLamps }`
- `shutter` is a steel door across the corridor at x 1486 that rises. With it down, the way east is through the machine room.
- `from` lists where guards come in.

MACHINE ROOM
`machines` = `{ doorA, doorB, outA, inA, outB, inB, west, east, walkway[6], safe[2], hazards[5], presses[3], vents[2], setAll(on), hits(x, z, y?), reset(), panel: { x, y, z, at, light(on) }, catwalk: { y, west, north, east, points[5] }, stairs: { west, east } }`
- `machines.hits(x, z, y?)` returns the hazard catching that point, or null.
- `safe` are the two pockets between the presses.
- Each hazard is `{ kind: 'press' | 'steam', x, z, y, hx, hz, on, phase, warning, active, set(on), hits(x, z, y?), reset(), update(dt) }`.
- `phase` is idle | warn | slam | down | rise for a press, idle | warn | burst for a vent, and off when switched off.
- A hazard always warns first: an amber flashing lamp for 0.8 s (press) or 0.6 s (vent). `hits` is true only while the press is down or the steam bursts. `set(false)` makes it safe.
- The catwalk is 3 m up (`catwalk.y`), reached by `stairs.west` / `stairs.east` ({ bottom, top }).

ARENA
`arena` = `{ door, doorAt, entry, gate (cage), gateOut, gateIn, centre, hammer, player, allies[2], rail[11], stands: { y, west, east, north }, stairs: { west, east }, cage: {x0, z0, x1, z1}, inCage(x, z), from[3] }`
- `rail` spots are on the 2.2 m stands, facing the cage.

ARMORY
`armory` = `{ door (heavy, locked), doorAt, inside, code, reader, keypad, clipboard, desk, gate (rackGate, barred, locked), gateAt, behind, rack, spots[10] }`
- `reader` and `keypad`: `{ x, y, z, at, mesh, light(ok) }`
- `clipboard`: `{ x, y, z, at, mesh, setText(lines), reset() }`. By default it shows "קוד השער: 4719".
- `rack`: `{ markers[10], owners, take(i), all(), reset(), left(), of(id), at }`
  - Each marker is `{ i, owner, color, x, y, z, at, taken }`.
  - Default owners: nehorai, erez, ido, yonati, avraham, muller, dolev, hadar, liam, kai; hopper colours from paint.js COLORS.
  - `take(i)` hides one marker, `all()` hides them all, `reset()` puts them back.

TUNNELS
`tunnels` = `{ t1[3], t1Branch[2], t2[3], points[7], doors: { corridor, stores, hangar, storesSouth, hangarWest }, mouths, redLamps }`

STORES
`stores` = `{ a, b, inside, halls[2], forklifts[3], lanes[5], redLamps, cover }`

HANGAR (56 × 48 m)
`hangar` = `{ centre, inside, doors: { west, sw, north, trap, saferoom, exit }, doorAt: { west, sw, north }, vehicles[4], cover, trap, from[3], redLamps, blast }`
- Each vehicle (truck, two jeeps, tanker) is `{ kind, x, z, y, yaw, w, l, h, mesh, blown, centre, blow(), reset() }`. `blow()` only turns it into a black wreck; the mission sets off its own warned blast at `v.centre`.
- `trap` = `{ door (damaged, locked), at, behind, room, open(), close() }`
- `blast` is a suggested blast spot by the damaged door.

SAFE ROOM, KIT, EXIT
- `saferoom` = `{ door (heavy), doorAt, doorIn, inside, wheel, bed: { x, z, y (top of the cot), yaw, side }, spots[6] }`
- `medkit` = `{ x, y, z, at, mesh, taken, take(), reset() }`
- `exit` = `{ door (7 × 5 m, rises), panel: { x, y, z, at, light(ok) }, inside, rampBottom, rampMid, rampTop, outside }`. `outside` is at (1641, -90, y = surfaceY), facing east toward the tower's plaza.

PATROLS
16 routes in `patrols`: arrival, cells, corrW, corrE, machW, machE, catwalk, stands, pit, armory, t1, t2, stores, hangarN, hangarS, exit.
- Every point carries its floor's y.
- The catwalk, stands, t1, t2 and stores routes ping-pong (A, B, C, D, C, B), so every leg, including the last back to the first, stays on its floor.

Notes from its builder for others:

1. Performance (src/world/world.js or main.js). From inside the facility, looking west, the whole map beyond the walls is still drawn, because buildings and roads are kept until the fog. The total climbs to 300–450 draw calls, of which the facility's own are ≤ 38. Suggestion: while `places.facility.interior.visible` is true (the camera is under the lid), hide the rest of the world group, or shorten `camera.far` to about 200 m.
2. Missions in the facility should call `game.daylight.set(1)`. The lamps and emissives glow only at night; by day, with shadows off, the hemisphere and sun light would light the halls like outdoors. They should also call `overlay.mapHidden(true, 'מתחת לאדמה')` while `places.facility.inside(x, z)` is true.
3. `fx.redAlert` (engine) can put its flashing red lights at `places.facility.redLamps` (each has a zone). `place.alarm(on)` only flashes the lamps' own glow.
4. There is no 'lie' pose. The wake spots use 'sit' (on the bench) and 'down'. If the engine adds a lying pose, missions can switch the 'down' spots to it.
5. The port's industrial elevator should arrive by a fade to `arrival.inCar` (10 spots). `arrival.gate` (carGate) rises to let them out.

### tower (as built)

ctx.places.tower (המגדל השחור). Exports from src/world/tower.js: FLOORS = [0, 6.0, 10.4, 14.8, 19.2], ROOF = 23.6, FLOOR_NAMES (Hebrew, k 0..5: הלובי, קומת האבטחה, קומת השרתים, קומת המחסנים, חדר הפיקוד, הגג).

Where it is: tower centre (1780,-120), 40x40, with +z pointing south at the plaza. The plaza is world x 1660..1880, z -100..-20, inside a fence. One flat pad covers x 1655..1885, z -145..-15.

Spots and floor y: every spot is {x, z, y, yaw?} with y = that floor's height, so missions should always pass it on: player.place(x, z, yaw, y), teleport(x, z, y), npc.place(..., y).

Helpers:
- x, z, y, F, ROOF, floorNames
- floors[k] = {k, name, y, centre} for k 0..5
- floorY(k), floorOf(y) -> k
- near(a, b, r): distance in x/z plus same floor
- inTower(x, z), onPlaza(x, z), inCommand(x, z, y), onRoof(x, z, y)
- tick(camera, dt) (already called by world.js)

Doors: every door is d = {pos{x,y,z}, yaw, w, h, locked, open, label, floor (metres), k (floor index), body, lamp}. Methods: setOpen(o), lock(), unlock(), setVisible(v). The leaves are instances of one shared mesh, so d.leaf is a transform, not a Mesh. doors[] lists them all.

Plaza:
- gate: west fence, a sliding gate, locked and shut. Spots gateOutside, gateInside, approach (where the way up from the facility arrives, about (1651,-60)).
- exitGate: south vehicle gate, locked and shut.
- plaza: {x0..z1, centre, entrance, booth, boothDoor}
- vehicles[]: {kind car|van|truck, x, y, z, yaw, blows, at}
- cars[]: the 6 that can blow, each with wrecked, wreck(), reset(). The mission's Blast gives the warning, e.g. new Blast(game, {at: v.at, onBoom: () => v.wreck()}).
- floodlights[], cover[]

Lobby: lobby = {door (a lift shutter, open), outside, inside, centre, desk, reception, waiting, pillars[]}.

Stairs: stairs[k] for k 0..4 is flight k, floor k up to k+1. Fields: side 'east'|'west', bottom (floor k), top (floor k+1), foot (aisle spot), hall (floor above). Flights alternate east/west and each climbs north.

Elevator: elevator = {doors[5] (sliding, shut), front[5], inside[5], open(k), close(k), closeAll()}. Missions do the fade and place people at inside/front.

Floor 1:
- security = {hall, monitorRoom, monitorDoor, monitorsAt, screen, alarmRoom, alarmDoor, lockers, office}. screen is the camera wall.
- alarm = {at, on, set(on)}: blinks red while armed, green when off.
- alarmAt: where the player stands at the alarm panel.
- card = {at, pickAt, floor: 1, mesh, taken, take(), reset()}

Floor 2:
- servers = {hall, corridor, rooms {A, B, C, D}}
- breach = {door (server room C, locked), at (Ido's spot beside it), aside, cover (where the player covers him), inside, threats[]}
- escape.gate: the emergency gate across this floor's hall, open by default.

Floor 3:
- storage = {hall, aisle, west, east, office}
- trapped = {door (locked), at (outside the door), inside (the friend's spot), floor: 3}

Floor 4: command = {door (locked, card reader), doorAt, reader {at, ok, set(ok)}, readerAt, anteroom, hall, inside, desk, deskAt, computer, shadowAt, screen, window {glass, body, at}, arena, escapeDoor (emergency elevator, locked), escapeAt, escapeInside, cover[6], guardPost, archive}.
- screen.show(mode, opts) with mode 'off' | 'cams' | 'alarm' | 'shadow' | 'data' | 'map' (the default). 'data' takes {progress: 0..1}. security.screen takes the same modes.

Roof: roof = {at (out of the stair hut), deck, helipad (y = ROOF+0.15), padR, edge[3], hut}.

Escape (mission 45): escape = {
- route[]: 29 ordered points with floor y, from the command room down every flight to the plaza
- mark(on): shows or hides green chevrons along the route; marked
- gate, gateAt
- fallen, fallenAt
- switch, switchPanel, switchLamp
- throwSwitch(on): opens or shuts the lobby shutter and the vehicle gate together
- car (the getaway spot), exitGate, exitOutside
- drive[] (out of the gate and south), afar (a far viewpoint looking back at the tower)
- blasts[]: spots, each with its floor y
- routeIndex(p): index of the nearest route point on p's floor }

patrols: keys gate, booth, plazaW, plazaMid, plazaE, cars, entrance, southFence, lobbyDesk, lobbyW, lobbyE, lobbyStairs, f1hall, f1monitor, f1alarm, f1office, f1lockers, f2hall, f2east, f2corr, f2A, f2B, f2C, f2D, f3hall, f3aisle, f3west, f3east, f3trap, f4hall, f4ante, f4guard, f4archive, f4cmdW, f4cmdE, f4desk, roofE, roofW, roofPad, roofDeck. Every point has y; a key with one point is a guard standing still.

lamps (21) and emissives (the lit windows glow at night).

Default door states: both plaza gates locked and shut; the lobby open; the emergency gate open; the monitor and alarm room doors open; the breach, store room, command and emergency-elevator doors locked; the elevators shut.

Notes from its builder for others:

1. src/player/controller.js: respawn() calls place(safe.x, safe.z, yaw) and drops the height. With no height given, groundHeight picks the highest surface, so a respawn inside the tower would land the player on the roof or helipad. Store safe.y and pass it on. The same goes for __game.teleport(x, z) with no y: missions must always pass the spot's y.
2. src/world/daylight.js cull(): it keeps the 12 lamps nearest by horizontal distance only, so lamps on the floors above and below compete with the player's own floor. I worked round it with exactly two lamps per storey, all at the same two points. A ranking that counts height too (penalise more than one storey up or down) would allow more lamps per floor in the tower and in the Iron Base.
3. src/world/compound.js stairs(): neighbouring step surfaces meet exactly, so a point right on a step boundary finds no step and drops to the floor below. That is rare in play but certain on a test grid; the tower uses its own flights with a 0.02 overlap, and the same overlap in stairs() would harden every other site. Separately, compound's door() lamp shows green for a door locked later with lock(), because it reads the initial locked flag.
4. src/world/facility.js: its exit to the surface should arrive west of the plaza's west gate, at places.tower.approach (about world (1651,-60)) or gateOutside (1656,-60). It must not lay a pad inside x 1645..1895, z -155..-5 (my pad plus its blend).
5. package.json / the suite: add node tests/walk-tower.test.mjs if it should run with the others; docs/chapter9.md says the new sites go into tests/walk.test.mjs, and this part has its own file instead.
6. Missions 43-45: the elevator is a fade, done by the mission (close the doors, place everyone at inside[k] or front[k] with y, open doors[k]). escape.mark(true) shows the route.

## After the reviews (what changed from the reports above)

- **Fights**: chapter nine's moves (heavy punch, shove, the jab-cross-finisher chain) belong to chapter nine's fights: `new Fight(game, { moveset })` is 'full' when the running mission's chapter is 9 or more (or no mission runs) and 'classic' otherwise, so chapters 1-8 fight as they always did. A floored man gets up when a fight is disposed and is not faced while down. `game.fists(false)` with the mission's end.
- **Weapons**: `paint.stash({ player: true, allies: TEAM })` in every setup/restore after the weapons are taken (a bare `stash()` with nobody armed records nothing and returns null); `paint.stashed` is true only while someone is owed a marker; a marker handed out while stashed leaves the record whole, and `unstash()` swaps it for his own; the squad button stays on screen while the gang is unarmed.
- **Atmosphere**: a red-alert area given `at.y` is that floor only; one saved glow per material across areas; rain's `seconds` reaches the light and the sound; the car radio is silent while `sound.music` plays; `respawn()` keeps the floor's height; the night's twelve lamps are ranked by height too.
- **Shared**: `squad.leaderName()` follows who is played; hit and banter call-outs have a set for when Nehorai leads; `Job`'s fallback keeps the spot's `y`; `postGuards(..., { reset: false })` posts guards mid-step without wiping the board; debris lands at its own height; `playAs` frees the body it replaces; `og17`, `og18`; the watch label names the Black Order from chapter nine; no follow-on start after a replay; under the facility's lid the far plane is short.


## The thirteen missions as built (from their builders' reports)


### Missions 34–36

Setup: checked out ch9m/a, merged claude/nehorai-stage-a with --no-ff (715bbb2), linked node_modules. The earlier builder left m34 committed and m35 as WIP. I kept both, fixed them, finished m35 and wrote m36. The build succeeds; dist/ is not committed (dist/play.html is put back to HEAD).

m34 "הלילה שבו הכול התחיל" (kept from the earlier builder, small fixes). It opens chapter nine: opens:true starts it from a save at the end of chapter 8, and in-session it begins at the plaza marker like m26. Step 0 is a cutscene: the gang on the sofas, the exact lines "סוף סוף קצת שקט." and "אחי, אצלך שקט מחזיק שלוש דקות.", the lights out, the Shadow on the TV ("נהוראי פרחי. אתה ניצחת את קוצי, אבל קוצי היה רק ההתחלה."), the video of the compound, then "זה ברור שזו מלכודת." and "אז בואו נראה מה הוא הכין לנו.". Steps 1-4 are checkpoints:
1. the fuse box (prompt "להרים את המפסקים"),
2. the gear rack (prompt "לקחת את הציוד"; everyone gets his own marker through armGang = unstash + armPlayer + addAlly),
3. talking to Ido at the frozen video and to Erez by the cars,
4. everyone walks to his own car and Nehorai gets into the Renault.
Fixes: it leaves the scene for the next mission only when that mission really is deathroad (handsTo), the squad's chapter-7 chatter is kept quiet, and the "הצל" banner is shorter so it does not cover the masked face.

m35 "מרדף בכביש המוות" (finished from the WIP). Real driving: the Renault with Erez and Ido inside, the other two cars following on the Renault's own trail and moved forward when out of sight (Convoy). Steps: 0 the yard and the long straight (checkpoint), 1 the fork (checkpoint), 2 the chosen way, 3 the last stretch in the rain to the gate (checkpoint).
- The lorry drives head-on in their lane with the three exact lines. Driving into it fails with "נסעת ישר לתוך המשאית…" and a tip to change lanes; dodging it plays "עברנו בסנטימטרים".
- Roadblocks: the barriers with a gap in the middle, the tunnel road's barricade, the parked lorry.
- Order cars come out of the side roads and cut in, and a Pursuit chases behind.
- Roadside things blow up as they pass, and charges on the road warn first.
- Jumps are counted from car.launches (one per ramp), radio lines run between the cars, and there are three ways from the fork that rejoin.
- The chasers stop short of the port, and it hands over at the port gate with the gang's cars parked.
Fixes: the gang is armed on a fresh page, the j2 car still comes out if the lorry is met late, the alert meter is kept below the level where its label says "אנשי קוצי מחפשים", and a line plays in the new underpass.

deathroad.js (an addition in my zone): a short covered underpass on the highway between the sign gantry and the fork, with walls, columns, a roof for the camera and 2 lamps, at P.tunnels[1] / P.underpass. Every route now goes through a tunnel. P.tunnels[0] and the other fields are unchanged.

m36 "הנמל השחור" (new): night and heavy rain (fx.rain with roofs over the warehouses, the tower room, the passage container and the cage) and lightning. Steps 1-6 are checkpoints:
0. Out of the Renault at the gate; everyone gets out.
1. Ido opens the locked gate (a Job) while the plan lines play: three go in, the six wait by the wall south of the gate. Goal "1. להגיע למגדל הבקרה".
   - Stealth: about one second in a search light's circle (port.searchSees) raises the alarm.
   - A guard who spots Nehorai calls it in after 3 seconds unless he is marked first (a countdown on the pill).
   - The alarm brings the siren, a red alert that follows him, and two guards who come running from out of sight.
2. "2. להשבית את האזעקה": a 4-second Work at the panel, only on the tower's top floor. It turns off the alarm, the siren, the red light and the tower's search light.
3. "3. להשיג כרטיס גישה" in warehouse 3's office. A warned charge goes off on the way (two possible spots). When the card is taken, two guards run in through the north opening (a short chase).
4. "4. לפתוח את המעבר למתקן התת-קרקעי": the card at a reader on the blue container's false back (prompt "להעביר את כרטיס הגישה"). A second warned charge on the quay. When the back opens: a siren and red alert in the corner, plus a cinematic blast.
5. "5. לאסוף את החברים בכניסה (n/8)": the six run the length of the south quay, two guards come after them from the east quay, and Nehorai covers them. A friend who is marked wipes the paint off and gets up again.
6. The elevator: all nine walk in, the door shuts and locks, the shaft walls scroll up past the fence (the descent), a jolt and it stops, "הדלתות ננעלו", the Shadow on the speakers says "ברוכים הבאים לשלב הבא.", the sleeping gas (sound.gas, mist, daze), the friends sink down asleep, the eyes close, black.
It ends black and hands over to "stolen". Rain, alarms and music are stopped; the overlay's eyes and daze are left on; the gang keeps its markers; the guards are put away and the port's doors are reset. failIf has two reasons, each with a tip: three marks, or leaving the port. restore stages a whole scene for each checkpoint. Everything it creates is disposed, and async callbacks are guarded with attempt().

phoenix-a.js additions: armGang, reinforce (guards added mid-step without the reset postGuards does, which would stand marked guards back up), hunt/hurryHunters, dropGuards, Walk({hurry}) plus inView, handsTo, hush, calm.


Approximated or left simple:

- The elevator's descent is staged, not real motion: the cage is part of the port's static mesh, so concrete shaft walls scroll up outside the fence while the camera shakes, then stop with a jolt. Nothing actually moves down.
- In m35, which tunnels you drive through depends on the route: the long gallery is only on the tunnel road, and every route passes the new short underpass. The highway ramps are in its left lane and optional; the dirt route's ditch jump is the one that cannot be avoided. I did not use P.closure.
- The six friends' run in m36 step 5 takes about 30-40 s. When nobody can see them they are moved forward along the route, point by point.
- Chapter 7/8 squad call-outs are silenced in 34-36 rather than rewritten (see needed_elsewhere).
- tests/resume.test.mjs and the whole suite were not run in full, only the probe limited to my three missions.
- On this branch m37 is still the placeholder, so the test only checks that mission 37 begins under the black screen. Group b's m37 expects exactly that state (it sets eyes(1,0) and daze(1,0) and stashes the weapons).


### Missions 37–39

Missions 37-39 now play through end to end: real prompts, fist fights won with the buttons, and the stash taking and giving back the markers.

Setup: checked out ch9m/b and merged claude/nehorai-stage-a (bcb6442). I then picked up the earlier builder's WIP commits (f7cf4de, d1cab7b, 622b6b5).

Weapons recipe:
- Every setup and every restore before the wall calls paint.stash({ player: true, allies: TEAM }), through unarmed() and disarmAll().
- The wall gives each marker back with paint.unstash(id) and paint.unstash('player'). A missing entry now arms only that one person (addAlly or armPlayer). The old fallback, armCrew, armed the whole squad at once.
- At the end: unstash(), then armCrew, then paint.reset(). The stash is null and saved that way.
- A new replayDone() unstashes in the cleanups of 37 and 38 when a replay runs after the armory is done.
- On a hand-over to the next mission, the cleanups keep the map covered ('מתחת לאדמה').

37 stolen:
- Steps: 0 waking (eyes open, daze, Erez's line, heartbeat, banner), 1 wake the four on the floor with the button (checkpoint), 2 the guns cutscene, 3 cell doors open and the guards come in (checkpoint), 4 lines after the fight.
- The quoted lines play exactly as written. Nehorai looks at his hands, then raises his fists.
- The cell fight: og1-og4 against Nehorai, with Erez, Ido, Muller and Liam fighting too. FIST COMBAT banner and button tips.
- Firing is impossible: the fire button is hidden and a press says 'אין נשק'.
- The guards' door locks behind them.

38 barehands:
- Steps: 0 take the chief guard's keys and open the guards' door, 1 corridor fight with two from the guard room (cp), 2 three at the shutter, one covering up so it takes a heavy punch (cp), 3 machine room group fight (cp), 4 cross the room, either stopping the machines at the panel (a 3 s Work) or passing them in time (cp), 5 to the arena (cp), 6 the Hammer (cp), 7 the access card.
- Machine room: now four on four, and the guards' power is a little lower. The presses and steam warn first, then hit whoever stands in them, guards and friends included.
- The Hammer is a boss with armor 0.8, two phases with lines, Erez and Ido in the cage, and the cage locked. A retry now skips his speech: one look at him and one line from Ido.

39 armory:
- Steps: 0 out of the arena, 1 two men in the corridor (cp), 2 swipe the card at the reader, then the two from inside (cp), 3 read the clipboard (code written back to front) and enter 4719 at the keypad (cp), 4 the wall-reveal shot with Ido's and Erez's exact lines, 5 take your own marker ('עכשיו מתחילה המסיבה.'), then each friend walks to his own and takes it (cp).
- The wall empties as each marker is taken. Mission 40 then starts with the gang armed.

facility.js, armory zone only (additions):
- Beside each marker, its owner's pistol and mask, which go with the marker.
- Hoppers, paint pods and boxes on the shelf, a strip light, one lamp, and the sign 'ציוד מוחרם · החבורה של נהוראי'.
- The banner now shows before the reveal shot instead of over the wall.
- During a fight there is no target beam over the man Nehorai is facing.


Approximated or left simple:

- og3 appears twice (beaten in the cell in 37, then inside the armory in 39). The fix needs more guards; see needed_elsewhere 2.
- Looking at his hands uses the 'carry' pose; there is no dedicated pose for it.
- The waking shot is very dark by design (daze, vignette, a dim cell).
- The masks on the wall read as small coloured blocks rather than detailed masks.
- The guards beaten in 38's earlier zones are left where they fell; 39 does not restage them.
- The test bot fights well (well-timed blocks, dodges, shoves). Whether it is easy enough for a person on a phone was judged by the tuning, not tested with a person.
- Banners and toasts run on real time, so in the held, stepped test they outlive their moment in screenshots. In normal play they don't.


### Missions 40–42

I built missions 40, 41 and 42 on branch ch9m/c (7 commits on top of 2ef2e28, which contains 1d41d42). The placeholders are fully replaced, with the same id, chapter, number, title, requires, follows and secret. Shared helpers are in src/missions/phoenix-c.js. I made no changes to the site files or the engine files.

**M40 portwar (6 steps; checkpoints 1–4; the start is saved too).**
- Step 0, the alarm: a short scene in the armory. Red light over every hall through fx.redAlert using the facility's red lamps, facility.alarm(true), the siren, sound.music('action'), and a speaker line plus the Shadow ordering every security force out. If the gang arrives straight from m39 (armed, in the armory) it keeps its places; on a fresh page or a replay it is staged there.
- Step 1, the iron corridor: the Order comes from both ends. og5–og7 come out of the tunnel mouth (og5 and og6 head straight for the player); og8–og9 come out of guard room 2 to their posts. The side bays are the cover, a toast teaches the squad button, and the objective counts marks (k/5).
- Step 2, the tunnel: a warned charge at the far end locks the hangar's north door (t1Hangar) in fire and smoke, and the lights fail for a moment (black blinks and sparks). The way changes west to the stores, with og10–og12 waiting.
- Step 3, the stores: men among the racks plus two coming from store A. A ceiling beam comes down across the east lane after a warning (ring and beeps) and blocks it. A stack of drums goes up after a warning. There are two ways into the hangar:
  - the west door, which the Order has sealed: Ido opens it with a Job while the gang covers him;
  - or the longer south tunnel (T2).
- Step 4, the hangar: the user's lines “נהוראי! יש עוד מלא אויבים!” / “יופי, שלא יהיה משעמם!”.
  - Every vehicle has a red fuel tank on each side. Three paint hits set it off: a warned blast, vehicle.blow(), and anyone of the Order nearby is marked.
  - A second wave: the great exit door rises (the lights dip), men come down the ramp and out of the side room, then the door shuts again.
  - The Order's own warned charge blows the tanker, and the crane's truss falls after a warning and splits the hangar.
  - Far booms shake the halls throughout.
- Step 5: Erez checks the side room; a warned charge buckles its door with him inside, and his radio line follows.
- Fail rule: marked three times in steps 1–4 fails, with a reason and a tip. Each checkpoint's restore stages the whole scene.
- Guard use: og1–og16 are reused wave after wave with revive/setRoute. At most about 6–8 are standing at once.

**M41 wounded (11 steps; checkpoints 1 and 3–9).**
- Step 0: Erez trapped (lines).
- Step 1: a 4-second Work at hangar.trap.at to free him, under fire.
- Step 2, the injury scene, which can never fail (failIf ignores every mark from here, and the test sets 3 marks during it):
  - a warning ring and beeps; Nehorai shoves Erez clear;
  - the big blast with a flash and shake; he is thrown to the floor ('floored' pose), dazed; the music cuts and only a muffled heartbeat is heard;
  - he tries to sit up and falls back;
  - the exact lines “נהוראיייי!!!” / “אחי, תסתכל עליי! אל תעצום עיניים!” / “תוציאו… את כולם…”;
  - his eyes close to black. Under the black, play switches to Ido (game.playAs) with Ido's own paint colour, and Nehorai becomes an NPC lying on the floor with no collision.
  - The banner reads 'SAVE NAHORAI – הצילו את נהוראי!'.
- Steps 3–9, the seven goals, each played for real:
  1. Reach him.
  2. Defend him against a wave that heads for where he lies.
  3. The first-aid kit at facility.medkit (a prompt).
  4. The treatment, a 4-second Work; a white bandage appears on his head.
  5. Carry him with Erez. The prompt 'להרים את נהוראי עם ארז' starts it: Erez walks two metres ahead facing Ido, Nehorai is held between them each frame, and the player walks it at speedScale 0.55. The rest of the gang goes ahead to secure the safe room.
  6. Turn the security door's wheel (a Work).
  7. Hold the doorway on a 35-second treatment clock. The clock stops while anyone of the Order is within 10 m of the door. When it ends everyone goes in and the heavy door seals.
- Fail rule: Ido marked three times fails, with a retry as Ido.
- Step 10, the quiet scene: Erez on a stool by the cot, the exact lines, sound.music('calm') then null, and about 5.5 seconds of nothing.

**M42 comeback (6 steps; checkpoints 1, 3, 4 and 5).**
- Step 0: black screen; “נהוראי… נו כבר אחי, תקום.”; his eyes open slowly with a view from just over his face looking up at Ido and Erez; all the user's lines word for word. He sits up on the cot edge and looks around.
- Step 1: the player (still Ido) presses 'לתת לנהוראי את הרובה', which puts Nehorai's own marker in his hands.
- Step 2: he stands slowly while the music rises to action and the camera swings round him; then “יאללה חבר’ה. בואו נסיים את זה.”. Control goes back to Nehorai with full health, a full hopper, zero marks and the bandage on.
- Step 3: open the security door at the wheel; speedScale rises from 0.5 to 1 over the first 30 m walked.
- Step 4: three of the Order at the great door, then its panel (a Work) raises it.
- Step 5: up the ramp to facility.exit.outside. The map comes back on the surface, and m43 begins there with Nehorai armed and the gang formed around him.

**How restores and resumes work.** Every retry or resume stages who is being played (become() swaps the body and frees the old one), Nehorai's state (on the floor, carried, on the cot, sitting, or standing), the bandage, the doors, the wrecks, the fire, the red light, the music and the waves. Each mission hands its scene over only to the mission that follows it (handsTo).


Approximated or left simple:

- **Lights failing:** done as short full-screen black blinks with sparks, not real lamps switching off; the facility has no lamp switch API.
- **Erez sitting by him:** the 'sit' pose on a small steel stool the mission adds; the stool is removed at cleanup.
- **Nehorai on the floor:** shown with the 'floored' pose (lying, up on his elbows) rather than 'down', and the same pose on the cot.
- **Carry with Erez:** the three bodies are placed each frame without collision; Erez can clip into a wall at tight turns, though a raycast pulls him closer.
- **Continuity with group b:** the men group b left beaten in the armory and corridor stay where they sit until a later wave reuses them out of the player's sight.
- **Truss carry-over:** the fallen truss from m40 does not carry into m41; it is removed at the hand-over.
- **Difficulty:** tuned by reading the guard numbers and not playtested on a phone. The corridor's first wave can still land 2–3 marks on a player who stands in the open.


### Missions 43–46

I built all four missions (43–46), my helper module and the stage-t test. The branch is on claude/nehorai-stage-a at 2ef2e28 (after 1d41d42). The four placeholders are fully replaced, keeping their id, chapter, number, title, requires, follows and secret. I made no change to any engine or site file.

**Shared helpers (src/missions/phoenix-d.js)**
- Tower points by floor (T, floorOf). `hush` quiets the chapter-7 squad chatter and the alert label.
- `armed`: unstash() first, then the player's and every friend's own marker. `gangAt`, `freshMarks`, and `wipeOff` (a marked friend gets up after 5 s).
- `post`: puts the Order's guards on a floor and revives men marked earlier without standing everyone else up.
- `offBoard`, `standing`, `nearestOf`.
- TBlast: a warned blast with no debris indoors; it marks Order guards inside its radius and flashes the screen.
- Jerrycans on cars (2 hits, then a warned blast).
- Turret: a paint turret. It sweeps, tracks the player once its line touches him, fires paint after 1.3 s and can miss. Its sensor takes 2 hits. It comes online after a delay.
- `towerRed` (red alert for one floor), `beats` (scenes on game time), `later`/`talkOn`.
- A head bandage that reuses phoenix-c's node name 'bandage', so it is never added twice, plus an arm wrap.
- `assaulted`/`towerReset` door states, and the escape clock "mm:ss – ESCAPE!" kept left to right in the Hebrew UI.
- `clearAll`, with a keep option for hand-overs.

**M43 blacktower (13 steps, checkpoints 1–12; each floor has a different goal)**
- 0: Arrival at facility.exit.outside. The gang is re-formed and armed (it also works if 42 handed nobody over). A shot of the tower and the lines.
- 1, open the gate: Erez sets a charge on the gate (a Job of 4 s, with the player covering). Then "כולם אחורה", a 3.2 s ring, and the blast blows the gate out (hidden, open).
- 2, defeat enemies: the plaza with vehicles. 8 guards behind the cars, 3 jerrycans that blow their cars and mark guards nearby, and the Order's own warned charges.
- 3, fist fight: Dolev runs in after a guard and is taken. The lobby shutter drops (lockdown, red light, an announcement). Four Order men with no markers; "by the rules no paint on a man without a marker". FIST COMBAT with Erez and Ido as allies while the gang cheers at the door. Losing fails with a tip.
- 4, disable the alarm: the security floor in red light with the siren. Every 16 s while it rings, one more guard comes down the stairs. A 3 s Work at the panel turns it off and lifts the lobby lockdown.
- 5, find a card: the monitors scene, a camera cut to Dolev shut in on floor 3. Then the office guard and "לקחת את הכרטיס".
- 6, protect Ido while he breaches a door: the server floor's emergency gate is locked. Ido's Job on server room C takes 14 s while 2 waves come up the corridor. When Ido is marked he wipes it off and his job pauses; 3 marks on Ido fail the mission.
- 7: the terminal inside room C (a Work) opens the gate. Then up the east stairs.
- 8, free a trapped teammate: 5 guards, a warned charge on a shelf, a 4 s Work to force the store room door. Dolev comes out: "למה זה תמיד אני?!".
- 9, reach the elevator: the stairs to floor 4 go up in a filmed blast and stay blocked (fire plus a collider). A 3 s Work calls the elevator; two guards are inside. Then a fade up to the command floor.
- 10: the corridors (4 guards). "להעביר את הכרטיס": the reader turns green, but the door stays shut. The Shadow speaks over the speaker and his helicopter arrives.
- 11: the roof (4 guards). The helicopter comes in to hover. Shooting out the 4 landing lights makes it turn away. That is why he later escapes by the lift.
- 12: back down to the command door. It opens by itself ("אז בוא, נהוראי. אני מחכה לך.") and mission 44 follows.

**M44 shadow (6 steps, checkpoints 1–5)**
- 0: The door locks behind Nehorai while the gang works on it from the anteroom. The Shadow stands at the window. The user's two lines appear exactly.
- 1: Phase 1 – gunfight. 2 guards, 3 turrets each with a blind side, and the red shield around the Shadow. It drops when all three are down. 3 marks fail.
- 2: Phase 2 – fists. The marker is put down. Boss fight alone: hp 240, armor 0.75, slam/swing moves, the boss bar. It ends at half his health.
- 3: Phase 3. The door gives, Erez and Ido come in, and two bodyguards step out of his lift. The last fight: the boss at hp 125 with an angrier phase, plus the two bodyguards, with Erez and Ido as allies. Because of the armor rule, the last blow on the Shadow can only be one of Nehorai's big hits.
- 4: The Shadow on the floor, his lines. The emergency elevator (escapeDoor) opens, he gets in, it locks and he is gone.
- 5: "לבדוק את המחשב". Ido copies the data (a 7 s Job; the 'data' screen shows progress). The lines say how he knew: outside surveillance cameras and the backups left in Kotzi's old bases. "אין בוגדים בחבורה", five more facilities. Liam runs to the port for the Renault.

**M45 meltdown (8 steps, checkpoints 1–6)**
- 0: The self-destruct over the speakers. The banner "05:00 – ESCAPE!" and the pill counting down. The green route (escape.mark) is shown, red light on every floor, the siren and action music.
- Throughout: warned blasts, using only spots clear of the marked way, with fire, smoke, tremors and dust; the elevator is dead.
- Floor 4: down the west stairs.
- Floor 3: a warned beam falls across the hall; a detour through the shelves is marked in green (the corridor changes).
- Floor 2: the emergency gate slams shut; "לפתוח את שער החירום" is a 4 s Work.
- Floor 1: a beam falls on Avraham (pin plus a 3 s Work).
- Lobby: the shutter is locked; "להפעיל את מתג היציאה" (throwSwitch) opens it and the vehicle gate. Two Order guards are there.
- Plaza: the Renault with Liam beside it, and two cars blowing with warnings. "לעלות לרנו · כולם בפנים", then drive out of the vehicle gate for 150 m.
- 7: The gang gets out on the road. A high camera from about 75 m shows blasts climbing the south face and the shaft, a huge one at the roof, fire and smoke. Then back to the gang watching, and the lines.
- Fails: the timer runs out, or 3 marks. Each checkpoint restarts with a minimum time on the clock (250/210/170/130/95 s) or the time saved there, whichever is more.

**M46 together (4 steps, checkpoints 0 and 2)**
- 0: A fade, "כמה שעות אחר כך · בית המסתור". The gang is seated in their seats. Nehorai has a head bandage and an arm wrap, walks in and presses "לשבת עם החבורה".
- 1: The three exact lines (Erez, Nehorai, Ido), "כולם צוחקים" with laughing animations. The computer comes on by itself (screen.show('shadow')): the Shadow's exact line, the map of bases (screen.show('map')), then his last exact line.
- 2: "לקום מהספה" (pushing the stick also counts). Nehorai stands, Erez and Ido walk to his sides, the whole gang gathers behind, and his exact last line. The screen goes dark.
- 3: On black, 'STAGE 9 COMPLETE – OPERATION PHOENIX' for about 5 s, then 'STAGE 10 – THE FINAL HUNT' for about 5.8 s (real time). Only after that does the mission complete. The reward unlocks 'chapter-9' (2,500 ₪).


Approximated or left simple:

These parts are approximated or simplified:
- **The tower going up:** nothing collapses, because the tower is batched geometry. The destruction is shown as blasts climbing its south face and the shaft, a huge blast at the roof, fires left burning in the windows and smoke, filmed from about 75 m and then from the road 150 m away.
- **The monitors:** the camera wall draws generic feeds. Dolev is shown by cutting the camera to the store room, not on the screen itself.
- **The Shadow's escape lift:** he walks in and the sliding door locks behind him. There is no lift animation.
- **The helicopter:** I animate its approach and departure by hand. It hovers over the pad but never lands.
- **Liam and the Renault:** Liam fetching the Renault from the port happens off screen; only the lines tell it.
- **The ending map:** mission 46 uses the safe house screen's default 'map' (five bases).
- **Test shortcuts:** in gunfights the test marks guards directly, except for one real shot per floor; the props and turrets are shot with real paint. It also zeroes the player's paint hits while it shoots the props from set spots.
- **Real-time fades and cards:** with the loop held and stepped faster than real time, some screenshots catch a fade still on (arrival on floor 4, the safe house). In play, game time and real time match.
- **Tests not run:** I did not run the other groups' tests or the chapter-wide resume test across all 13 missions, because missions 34–42 are placeholders on this branch.
