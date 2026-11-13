# פרק 10 · המשימות, צעד אחר צעד

The script of chapter ten's thirteen missions for their builders: the steps, where the checkpoints are, what
each friend does, where the user's lines go. docs/chapter10.md has the rules and the places; the engine pieces
and the sites as they were really built are in docs/chapter10-asbuilt.md (trust that one for names and
coordinates). **Every quoted line and on-screen text is in src/missions/lines10.js (`L`, `CARDS`, `SIGNS`,
`KEEPER`), generated from the spec: import them, never retype them.** Lines not in the spec (radio chatter,
hints, a friend's remark) are yours to write: short, warm, funny, in each one's own voice, and never about
betrayal or death.

Conventions that hold for all thirteen: a goal on screen for every step and a target for the arrow; a
checkpoint (`checkpoint: true`) at every point marked **cp**, whose `restore` stages the whole scene (who is
played, the dimension and sky, doors, people, the marker's kind and whether it is held, the bandage, the
clock) because checkpoints are saved and picked up after a reload; a fail has a reason and a tip and retries
from the checkpoint; three paint marks on the player fail a fight step (reset at each checkpoint); friends'
jobs always complete; a film is called as `await game.playCutscene('c10-…', () => Promise.resolve())` right
before the in-game scene it belongs to (the scene and its lines always play; the film is an extra); every
scene can be skipped by tapping through its lines without breaking the step. (`game.playCutscene` sets
`game.cutscene = false` when a film ends: set it again after the await if your scene goes on.)

## 47 · `dawn` · השקט לפני הסוף (opens the chapter by itself)

0. Scene (film `c10-dawn`). 05:30, the sunrise preset. Nehorai on the balcony with chapter nine's bandage,
   looking east. Erez comes out: `L.dawn.erezAwake`, `cantSleep`, `today`. Ido runs in: `idoLook`. They go
   inside; the screen shows the threat map; Muller explains in his own words what he found (the Shadow has
   started a huge experimental machine that opens gates between universes and means to take the whole region
   with it), then `mullerMachine`, `notLetting`. The camera passes over every friend in turn. `everyoneHome`.
   The music swells. The card `CARDS.finalChapter`.
1. **cp** "לאסוף את הציוד" — the gear rack (a Work); everyone arms.
2. "לבחור רובה" — three markers laid out, each with a prompt and a one-line description; taking one sets the
   kind (it can be changed until the car).
3. **cp** "לדבר עם החברים (0/3)" — Erez, Ido and Muller at least (others answer too): each says what he will
   do today (Erez at your side, Ido leading the second team, Muller on the Shadow's systems).
4. "לעלות לרכב המבצע" — the Renault in the yard; the others board the two other cars. Getting in ends the
   mission and the convoy leaves (48 carries on in the car).

## 48 · `lastconvoy` · השיירה האחרונה

0. **cp** "לנסוע בראש השיירה" — the link road and the iron road, quiet; the two cars behind (a convoy); radio
   small talk.
1. On the hills road: a far blast, the sky turns red. `idoSee`, `erezClosing`. Rival cars come out of the
   side tracks: the chase is on.
2. **cp** "להתחמק ולהמשיך למצודה" — barricades with a gap, warned roadside blasts, a stretch of cars coming
   at you to dodge, pursuers behind; the friends talk on the radio (who is hit, who is clear).
3. The bridge ahead is blown in plain sight (far enough to stop). "הגשר נפל · לבחור דרך אחרת": Muller on
   the radio, `mullerRoad`; the arrow turns to the fork.
4. **cp** "בכביש השירות אל המצודה" — pursuit to the last bend; a huge blast behind closes the road on the
   pursuers; arrival at the service gate. Film `c10-citadel`, then the game's own shot of the citadel.
   Fails: the Renault is wrecked, or goes into the ravine (back to the checkpoint, repaired). A mark on the
   friends' cars never fails the mission.

## 49 · `citadel` · המלחמה הגדולה — six numbered goals, each a different kind of challenge

1. "1. להשתלט על הכניסה" — a paint fight at the service gate and its two towers; squad orders; Erez covers.
2. **cp** "2. להשבית את מערכת האזעקה" — the alarm brings a fresh pair of guards every little while until it
   is off: cut its fuse in the stores (a Work, Dolev and Avraham hold the door), then the panel in the alarm
   room.
3. **cp** "3. להפעיל את מעלית המשא" — find and throw the power switch, call the lift, ride down with the
   gang into the tunnels (Hadar and Yonati watch the shaft).
4. **cp** "4. לעזור לעידו לפתוח את השער" — through the tunnels to the inner gate: Ido at one wheel (a Job),
   the player at the other, both needed; a patrol arrives half-way — hold them off, then finish the turn.
5. **cp** "5. להגן על מולר ליד המחשב" — the control room: Muller at the computer (a bar), three approaches,
   guards from a different one each time; a marked Muller stops, wipes it off and goes on (it never fails).
6. **cp** "6. להגיע למגדל המרכזי" — across the inner compound past the energy plants (warned discharges to
   time), up and over a bridge, to the tower's door. 50 carries on. (As built: the door is the energy hall's, at +7
   on bridge A — Muller's hack opens it, the main door stays sealed from inside — and Muller stays at the computer
   from goal 5 on, the radio's other end.)

## 50 · `fall` · הנפילה של הגיבור

0. The main hall. The Shadow on the giant screen: `L.fall.shadowStop`, `iKnow`. The hall's defence wakes. (As
   built: 50 begins where 49 ends, at the energy hall's door at +7 with the seven; in through it, across the energy
   hall and down its stairs into the main hall, where the screen comes on. As the defence wakes the Order opens the
   sealed main door from the compound and the door team holds it.)
1. **cp** "לפגוע בשלושת מוקדי ההגנה (0/3)" — the first boss: wall emitters fire warned bolts, rings and a
   sweeping beam; three control nodes open in turn and must be hit; Erez and Ido call which one is open.
2. Scene (film `c10-fall`): the Shadow fires at Erez, Nehorai steps in front of him, is thrown at the wall
   (shake, blur), his marker falls (`paint.drop`), he tries to rise and drops to his knees. `idoCry`,
   `erezAnswer`. The Shadow comes in person: `shadowHero`. Erez between them: `erezStand`.
3. **cp** "לזחול אל המחסה" — hurt play (`player.crawl(true)`, the daze on): crawl behind the low cover while
   Erez keeps the Shadow busy and the others are pinned at the door. Nothing here can fail: bolts only knock
   back.
4. "להגיע לערכת העזרה הראשונה" — crawl to the box on the wall.
5. "להשתמש בערכה" — a Work of a few seconds; the bandage goes on, the blur eases.
6. "להיעזר בארז כדי לקום" — at Erez: he helps Nehorai up (`helpUp`).
7. "לאסוף את הרובה" — `paint.pickUp()` where it fell.
8. `yourProblem`, `shadowWhat`, `stopTalking`. The music comes back hard. 51 carries on.

## 51 · `rift` · הקרע במציאות (secret)

0. **cp** "לפגוע בצל יחד עם ארז" — a short duel: the Shadow throws warned energy, Erez flanks (a Job), the
   player marks him when his guard drops (a few hits).
1. Scene: the orb in his hands, growing, the air bending, the walls shaking. Muller on the radio:
   `mullerAway`, `whatMeans`, `mullerUniverse`. `shadowSee`. He throws it; it becomes a portal and grows.
2. "להחזיק בעמוד!" — the pull is real: reach a pillar and hold on (a prompt, kept pressed); Erez grabs
   Nehorai: `erezHold`. The grip gives by script. Film `c10-portal`; both are drawn in; the screen goes white;
   two seconds of silence. 52 carries on in the other dimension. (No fail here.)

## 52 · `grove` · איפה אנחנו?! (secret)

0. White to the grove (film `c10-grove`): birds, Nehorai and Erez on the ground at the landing spots, the
   dimension on. "לקום" (a prompt). `L.grove.where`, `erezParallel`, `itsTheGrove`, `erezSky`.
1. "להסתכל על השמיים" — the camera goes up (the player's own look, with a shot as help): violet, two moons,
   motes between the trees.
2. **cp** "ללכת עם ארז אל השביל" — a first walk through what is familiar and wrong (Erez remarks on the
   swings, the bulbs); they reach the first wall of energy. 53 carries on.

## 53 · `secret` · סוד החורשה (secret)

0. "לנסות את מכשיר הקשר" — static; the notice `CARDS.dimension`; `L.secret.mustReturn`, `withYou`.
1. **cp** "א. למצוא את מקור האנרגיה · סמלים (0/3)" — three symbols, each a small task and each opening the
   next part of the map: the first by the boulder (find and switch on); the second in the playground (it only
   lights while both swings move: Erez takes one — a Job — the player the other); the third by the goal with
   drifting disturbances to slip past.
2. **cp** "ב. לעבור את שביל המציאות השבורה" — timed stones, a field that stops time (use it or avoid it), a
   switch that brings a stone, the ledge where Erez needs a hand, disturbances; falling in puts you back on
   the last stone; the safe line is marked and the goal line gives hints.
3. **cp** "ג. שומר הסף" (the banner names him: `KEEPER`) — three modes: he throws warned energy to dodge; he
   makes copies (mark the real one; Erez spots the tell); his weak point opens only when the four anchor
   stones are lit (the player lights two, Erez two on the player's call, or all by the player while Erez draws
   him off) — then mark it. Twice round. He bursts into light; the crystal appears.
4. "לאסוף את הגביש" — and the radio crackles back to life. 54 carries on.

## 54 · `gateback` · פותחים את השער בחזרה

0. Scene in the citadel (the ordinary world): `L.gateback.idoTell`, `mullerWorking`, `idoFaster`; a weak
   signal; `mullerFound`. Muller: the Shadow's own machine can open a way back, if it gets power and nobody
   breaks it meanwhile.
1. **cp** "להגן על המכונה עד שמולר מסיים" — **played as Ido** (`game.playAs('ido')`): guards from three
   sides, the friends fighting beside him, a bar that fills (it stops while a guard stands at the console).
   Three marks on Ido: again from here.
2. Back in the grove as Nehorai: `mullerHear`, `getUsOut`, `mullerPoint`; the energy point is marked.
3. **cp** "לרוץ אל נקודת האנרגיה" — the run with Erez: disturbances behind, the sky cracking; whoever is
   caught by the front starts the run again.
4. The portal opens between the olive trees (film `c10-gate`): `erezNow`, `yalla`. "לרוץ ולקפוץ לתוך
   הפורטל" — a leap into it. 55 carries on.

## 55 · `return` · הגיבורים חוזרים (secret)

0. Scene in the citadel: `L.return.mullerHold`; the portal widens (film `c10-return`); they land on the
   floor. `idoCry`, `mullerBack`. They stand, facing the Shadow across the hall: `shadowImpossible`,
   `missedMe`. The music breaks out. Everyone lines up, the camera along the line: `ready`, `always`,
   `idoFinish`, `mullerPortal`. Nehorai raises his marker: `lastFight`.
1. **cp** "להוביל את החבורה אל אולם האנרגיה" — the Shadow pulls back up the tower behind his guards; the
   player leads the gang to the hall's door. 56 carries on.

## 56 · `laststand` · THE LAST STAND — four arenas

1. **cp** "אולם האנרגיה" — the big paint fight: waves with shield bearers (flank or shove), heavies, runners;
   cover; energy cells that blow when shot (warned); the squad's orders matter.
2. **cp** "גשר המגדל" — forward along the high bridge while parts fall (warned): a leap, a detour, Erez's
   hand at a broken edge, runners met with fists, emitters at the far end to shoot out.
3. **cp** "חדר המכונה" — Muller shuts the energy source down (a bar): three approaches, the friends each on
   one, the player where it is worst; twice Muller calls for a breaker only the player can throw.
4. **cp** "האולם האחרון" — the last guards at the door (a fist fight side by side with Erez and Ido against
   two heavies), then everyone walks in together and the doors shut behind them. 57 carries on.

## 57 · `endshadow` · END OF THE SHADOW

0. `L.endshadow.shadowPower`, `forgot`, `shadowWhat`, `notAlone`.
1. **cp** "שלב 1 · הצל המשוריין · מגנים (0/3)" — the suit on; warned attacks, cover; three shields, three
   different deeds (for example: shoot a generator's core while its shutters are open; work a console as
   Muller reads the order over the radio; stand so that his own bolt strikes the third).
2. **cp** "שלב 2 · הממד השבור" — rifts open, parts of the floor change, he jumps from place to place and
   makes copies; Muller says which is real; Erez and Ido flank; marks on the real one overload his system.
3. **cp** "שלב 3 · פנים אל פנים" — the suit breaks off; the last fist fight (the special attack, the timed
   openings); Erez and Ido step in for moments. He goes down.
4. He tries to rise: `shadowHow`, `separate`, `didntWork`, `badEnemies`, `over` (film `c10-shadow-down`).
   Muller kills the portal system; the Shadow is tied (Avraham and Dolev) — beaten for good. 58 carries on.

## 58 · `zerohour` · ZERO HOUR

0. The engine starts to go. `L.zerohour.mullerProblem`, `howBad`, `mullerForever`. The loudspeakers send the
   Order's people out. The clock: `CARDS.escape` (04:00, on the pill).
1. **cp** corridors that blow, parts that fall, fire and smoke; a marked way.
2. **cp** a gap to leap; a door that locks — its switch.
3. **cp** Liam is down under a fallen frame. `erezNoTime`, `iSaid`. Lift it with Erez (a Work), help him on.
4. **cp** the vehicle bay: everyone into the armoured car, the Shadow tied in the back; Muller raises its
   shield. "לנסוע! להתרחק מהמצודה" — the player drives out of the service gate and down the road.
5. The blast (film `c10-blast`, then the game's own: `citadel.destroy()`, the wave, the car thrown onto its
   side at the roadside). Black.
6. Wind. (Film `c10-alive`.) "לצאת מהרכב". `calling`; then one by one: `erezHere`, `idoSwear`, Muller and the
   rest with a word each; `allHere`, `all`, `weWon`. The Shadow sits tied by the car; Muller has sent his
   position. 59 carries on.
   Fails: the clock runs out (each checkpoint restarts with at least a fair time on it).

## 59 · `homeward` · HOMEWARD BOUND, and הגיבורים של קציר

Where: Katzir's way in is the east end of its main street "דרך הגבעה" at about (172, 30) (`places.mainRoad`,
arc length 0); the access road "כביש הגישה" climbs to it from the plain through about (304, -33) and
(254, 31). The walk starts on the access road some 250 m before the gate (after a fade, "כמה שעות אחר כך"),
heading west into the setting sun; the crowd lines both sides of the last 50 m of the access road and the
first 40 m of the main street; the last moment is on the main street just inside, about (140, 24).

0. **cp** Sunset. The road to Katzir, on foot, Nehorai in front, Erez and Ido beside him, Muller and the
   rest behind. No enemies, no markers out. "ללכת הביתה · לדבר עם החברים (0/3)": `L.homeward.idoDone`,
   `erezHome`, `mullerPortal`, `iWasThere`; everybody laughs. The others have a line each about the road they
   have come.
1. Near the way in: a noise ahead. `noise`, `erezLook`. The camera rises: the people of Katzir, clapping,
   with the signs (`SIGNS`). Film `c10-home`.
2. **cp** "ללכת בין האנשים" — through the cheering lane; `idoFamous`, `allHere`.
3. The gang stands together before the crowd: `bestThing`, `erezWhat`, `notWon`, `together`. The camera
   pulls away over Katzir and the hills; the sun goes down; black. The cards, the credits, `CARDS.thanks`,
   the button back to the main menu. The game is saved as finished (`chapter-10`, the finished mark).
