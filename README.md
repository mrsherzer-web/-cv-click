# מלך הספה · King of the Couch

An action arcade game born from a single 20-second video: two friends, a couch, a lava lamp and the munchies that come to life at 3 AM.

## Play
Open `index.html` through any static web server (for example `python3 -m http.server`) and click to begin.

- **Move:** WASD / arrow keys
- **Aim:** mouse (weapons fire automatically)
- **Smoke dash:** Space (brief invulnerability)
- **Big Laugh:** Shift / E / right click when the meter is full
- **Pause:** P / Esc
- **Mobile:** left stick moves, right stick aims, buttons for dash and Big Laugh

Survive 15 waves, collect lava drops to level up, pick upgrades, and beat three bosses: the Chip Bag Hydra, the Lava Lord and the Munchies King. After the win, endless mode unlocks.

## How it is built
- Plain HTML5 Canvas and JavaScript, no build step and no dependencies.
- The intro is the original video, and the arena background is frames taken from it.
- Every character, effect and sound is generated in code: the lo-fi music loop and all sound effects are synthesized live with the Web Audio API.
- Hebrew interface by default, with an English toggle.
