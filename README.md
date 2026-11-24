# מלך הספה · King of the Couch

A two-chapter action game born from two short videos.

## Play
Open `index.html` through any static web server (for example `python3 -m http.server`) and click to begin. Pick a chapter on the title screen.

### Chapter 1 — King of the Couch (2D arena survival)
Two friends, a couch, a lava lamp and the munchies that come to life at 3 AM.

- **Move:** WASD / arrow keys · **Aim:** mouse (weapons fire automatically)
- **Smoke dash:** Space · **Big Laugh:** Shift / E / right click when the meter is full (your couch buddy joins in)
- **Pause:** P / Esc · **Mute:** M
- **Mobile:** left stick moves, right stick aims, buttons for dash and Big Laugh

Survive 15 waves, level up, evolve weapons with treasure chests and beat three bosses. Endless mode unlocks after the win.

### Chapter 2 — The Big Score (3D open-world heist)
Built from the second video: a night heist at a neon Miami hotel, a hacker, a red vault full of cash, a red 80s supercar and a police chase to a sunrise causeway.

- **Walk / drive:** WASD or arrows · **Camera:** mouse (click to lock the pointer) or Q / R · **Run:** Shift
- **Get in or out of any car / interact:** E · **Handbrake (drift) / jump:** Space · **Horn:** H · **Pause:** Esc
- **Mobile:** left stick to move or steer, drag on the right side to turn the camera, 🚗 for action, ⛔ for handbrake

The mission: meet the hacker, crack the security mini-game, grab as much cash as you can before the silent alarm, then escape the police (wanted stars, roadblock, helicopter) across the causeway to the island hideout. Clips from the original video play as cutscenes between the gameplay beats. Afterwards the whole city is yours to roam: steal cars, cruise through the day/night cycle and hunt the 25 hidden cash bags.

## How it is built
- Plain HTML and JavaScript with no build step. Chapter 1 is Canvas 2D; chapter 2 uses three.js r128 (vendored in `vendor/`, MIT) loaded only when the chapter starts.
- The intros and cutscenes are the original videos; menus and backdrops use frames taken from them.
- All characters, cars, the city and every effect are procedural (no 3D model files): HDR bloom, wet-street planar reflections, neon, rain and a sky that goes from night to sunrise.
- All music and sound effects are synthesized live with the Web Audio API (lo-fi loop in chapter 1, synthwave, engine, sirens and stings in chapter 2).
- Hebrew interface by default, with an English toggle.

```
src/            chapter 1 (game.js, sprites.js, data.js, …) and shared code (main.js, input.js, audio.js, i18n.js)
src/heist/      chapter 2: core (map, roads, collisions), world (city), models, vehicle (physics),
                ai (traffic, police, wanted), extras (rain, pedestrians, helicopter), hhud (HUD),
                haudio (sound), hack (mini-game), mission (story, vault, free roam), heist (engine, cameras, render)
assets/         video clips and frames · vendor/  three.js
```
