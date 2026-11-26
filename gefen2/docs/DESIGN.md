# GEFEN 2 – THE DEMON RETURNS · design + build log

Working document for the sequel. Game 1 lives in the repo root and is never modified.
Game 2 is fully self contained in `gefen2/` (own engine copy, own assets, own save key).
Branch: `claude/gefen-2-demon-returns` (created from `claude/gafen-snooker-horror-game-79taqo`).

UI language: Hebrew, RTL. Code comments: English. No build step in dev (ES modules),
Three.js vendored in `gefen2/vendor/three.module.min.js`.

## 0. Status (keep this section current)

- [x] branch + folder + design doc
- [x] reference photos prepared in `gefen2/assets/source/` (ido.jpg is cropped: the
      video-call thumbnail of another person is removed and must never be used)
- [ ] Higgsfield: account has ~2497 credits (ultra plan). MCP generation calls work.
      BLOCKED: this session's network policy denies `upload.higgsfield.ai`,
      `d2ol7oe51mr4n9.cloudfront.net` (uploaded media) and `d8j0ntlcm91z4.cloudfront.net`
      (results), so reference upload + result download do not work until the user allows
      them (asked in chat). An environment named `-cv-click` already allows the three hosts
      but a running session cannot be moved to it.
      Jobs already submitted (results stay in the user's Higgsfield account):
        - image `d34ffdb1-5fec-4b9b-a994-305af7496539` menu backdrop, empty hall (2 cr)
        - audio `31b00b70-71c9-4504-a213-758debf9c655` vent thump sfx (0.75 cr)
      Upload slots that were created but NOT filled (PUT failed, never confirmed):
        a=gefen_normal b7521db4… b=gefen_scary cac8f23d… c=cap 2c6c3c54… d=smiler 48c1b8f3…
        e=yahali 05dc447d… f=maayan 06b4f767… g=ido 33373e3b… h=dolev 2f337e25…
- [ ] engine/world  - [ ] office  - [ ] first person  - [ ] enemies  - [ ] nights 1-6
- [ ] menu/save/settings  - [ ] tests  - [ ] packaging

Costs measured with the estimate tools: image 1–2 cr (gpt_image_2_6 / nano_banana_pro 2k),
video 5 s: kling3_0 std 10 cr, seedance_2_5_flash 25 cr, seedance_2_5 720p 35 cr,
music 45 s 6.5 cr, sfx 3 s 0.75 cr.

## 1. Story

A week after game 1. The player comes back to the abandoned snooker complex because Gefen
stopped answering. The demon never left: it hid in the old black ball in the basement and
is now stronger. It wants the whole group.

Characters
- Player: first person, never seen.
- Gefen: main enemy. Possessed. Red eyes.
- Yahali + Maayan: loyal allies. Arrive at the end of night 2. Yahali watches cameras and
  calls out danger, Maayan repairs systems and hands batteries.
- Cap guy ("בעל הבקבוק") + smiler ("החייכן"): human again, try to free human Gefen, hunted.
  Smiler's grin is creepy even though he means well.
- Ido Hidana + Dolev Doron: possessed friends, enemies from night 3, both can be saved.
- Nobody betrays the player willingly. Goal: save everyone, kill no one.

Lore rule used by mechanics: the mask fools those the demon controls from a distance
(Ido) but never the demon's own host (Gefen). Dolev's demon feeds on electricity.

## 2. World (one connected 3D complex, metres, x east, z south, y up)

Player desk at (0, 1.3) facing north (-z). Rooms never share walls: 0.3 m gap = wall.

| cam | id       | name (he)        | rect x0,z0,x1,z1            | notes |
|-----|----------|------------------|-----------------------------|-------|
| –   | office   | חדר האבטחה       | -3.2,-2.6, 3.2, 2.6         | front opening 3 m to corridor, vents W/E |
| 9   | corr     | המסדרון הראשי    | -1.5,-20.9, 1.5,-2.9        | 18 m |
| 5   | storage  | המחסן            | -9.8,-11.5,-1.8,-5.5        | door to corr at z=-8.5, left vent starts here |
| 4   | lobby    | הכניסה           | 1.8,-12.5, 9.8,-5.5         | door to corr at z=-9, entrance door east wall z=-9, right vent |
| 8   | wc       | השירותים         | -7.8,-19.5,-1.8,-13.5       | door to corr at z=-16.5 |
| 6   | elec     | חדר החשמל        | 1.8,-19.5, 7.8,-14          | door to corr at z=-16.75, breaker panel |
| 1   | hall     | האולם הראשי      | -9,-35.2, 9,-21.2           | 4 tables, cursed table in the middle |
| 2   | bar      | הבר              | -17.3,-31,-9.3,-23          | door to hall z=-27 |
| 7   | arcade   | חדר המשחקים      | 9.3,-31, 17.3,-23           | door to hall z=-27 |
| 3   | vip      | חדר VIP          | -8,-42.5,-1,-35.5           | door to hall x=-4.5 |
| 12  | basement | המרתף            | -2,-56, 12,-43.8 (y=-3)     | stairs x 3.5..6.5, z -43.5..-35.5 from hall door x=5 |
| 10  | ventL    | פיר אוורור שמאלי | duct storage → office west  | only Ido |
| 11  | ventR    | פיר אוורור ימני  | duct lobby → office east    | only Ido |

Collision / nav: 0.25 m grid over x -18..18, z -57..3.5. `walk` = rooms ∪ doors minus prop
footprints, inflated by agent radius. `sight` = walls + tall props for line of sight.

## 3. Modes

- Office (seated): look by drag/mouse (yaw ±80°). Tools: flashlight (hold), vent lights
  L/R, mask, tablet (cameras / audio lure / maintenance), kill switch, phone.
- First person: WASD/arrows + mouse, touch = left stick + right drag. Flashlight toggle,
  interact (hold), mask, throw ball (sound lure), sprint with stamina.
- CCTV: world rendered from fixed cameras with the cctv post preset.
- Cutscene: Higgsfield video clips through the post shader, or scripted in-engine camera.

## 4. Enemies (no two alike, every one has a warning and a counter)

| | Gefen | Ido | Dolev |
|-|-------|-----|-------|
| eyes | red | amber | electric blue |
| office route | hall → corridor far/mid/near → office front | arcade → storage/lobby → vent far/mid/mouth | elec → corridor far/mid/near → office front |
| warning | heavy steps, low laugh, eyes in the dark corridor | soft metal thumps panned to the side, cam 10/11 | electric hum, lights flicker, camera/power faults |
| counter | flashlight on him (~1.2 s) pushes him back | mask on while he is at the vent mouth | fix faults fast, audio lure pulls him back, kill switch when he is at the front |
| useless | mask | flashlight | flashlight (drains battery) and mask |
| first person | hunts by sight, light in the eyes stuns him briefly, run and break line of sight | moves only when not watched; mask makes him ignore you | drawn to noise and to your flashlight; thrown ball lures him |

Office AI = FNAF style: every tick roll 1..20, move if roll <= level. Levels per night in
`config.js`. Gefen never moves while lit. Dolev only advances while a system is broken or a
reboot is running, otherwise drifts home. Ido is fast (few stations) and quiet.

Power: 100 %, drained by tablet, vent lights, lure, reboot, plus a passive drain per night.
At 0 %: tablet/vent lights/lure dead until 6 AM, Dolev goes dormant (nothing to feed on).
Flashlight has its own battery; Maayan swaps it once per night from night 3.

## 5. Nights (clock shows 12:00 AM … 6:00 AM, 60 s per hour in office phases)

Opening (no waiting): arrive in the dark hall in first person → Gefen with his back turned →
"גפן? אחי, מה אתה עושה פה?" → he turns, eyes glow, "באמת חשבת שזה נגמר?" → lunge, grab,
struggle (mash) → break free → run down the corridor chased → office → activate security
→ clock 12:00 AM → NIGHT 1, no loading screen.

1. "הוא עדיין כאן": alone. Phone: No Signal / Call Failed / Reconnecting…. Only Gefen.
   Camera event: cap guy + smiler approach Gefen to help, he chases them. Power fault →
   first person repair in the electrical room and back before Gefen. End: PA whisper
   "אתה לא תצא מפה שוב."
2. "החברים בדרך": signal returns, call with the exact scripted lines. Messages, signal
   drops. Second chase of the duo on camera. Mission: re-activate the entrance system
   (lobby). Near the end: knocks, Yahali + Maayan on cam 4, rescue sequence to the office.
   6 AM lines: "אחי, מה זה המקום הדפוק הזה?" / "זהו, אתה לא לבד יותר."
3. "החברים שהשתנו": big difficulty jump, allies in the office. Ido + Dolev revealed on
   cameras ("רגע… זה עידו?!" / "אחי, גם דולב שם!"). Mask handed over. End: Gefen stares
   into a camera: "עכשיו גם החברים שלכם שלי."
4. "משימת החילוץ": office + exploration. Find cap guy (locked storage, key in the bar) and
   smiler (VIP, keypad code from the arcade), escort both to the office. Gefen ambush →
   chase. Scene: Ido resists, whispers "אחי… תעזור לי…", demon retakes him.
   Each ally ends `ok` or `hurt` and that changes nights 5-6.
5. "החשמל נופל": systems collapse, cameras off, red emergency light. Tasks outside:
   generator in the basement (reveals the source: the black ball), fuse boxes, Dolev's
   brief release "אל תשאירו את עידו פה… בבקשה." Office stops being safe.
6. "THE FINAL NIGHT": Gefen final form. Finish the frame on the cursed table: collect and
   pot yellow, green, brown, blue, pink, then fetch the black ball from the basement and
   pot it. Final escape to the entrance, sunrise. "זה נגמר?" … "אני מקווה." Credits.
   Post credits: basement camera, dark figure, two eyes, camera disconnects.

Deaths restart from the last checkpoint inside the night. Finished nights unlock in the menu.

## 6. Code map (`gefen2/src`)

- `main.js` boot, loop, settings, save, scene director
- `config.js` rooms, cameras, stations, AI levels · `story.js` all Hebrew text
- `engine/` gfx (post), audio (procedural + samples), voice, textures, input, assets
- `world/` layout, world builder, props, actors (billboards), nav grid
- `game/` office, firstperson, enemies, allies, phone, tablet, night runner, `nights/n1..n6`
- `scenes/` menu, opening, ending, credits · `ui/` dom helpers, hud, dialogue

Debug: `?night=3&stage=2&speed=10&god&dev`, `window.__g2` exposes the running game for tests.

## 7. Asset manifest (filled in as assets land)

See `gefen2/docs/ASSETS.md`.
