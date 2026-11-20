# גרסת המחשב · Windows

The game as a Windows application: a folder with `Nehorai Farhi.exe`, handed out as one zip. Nothing is installed
and no network is needed; the player unpacks the zip and double-clicks the .exe. Inside, the .exe is Electron
(Chromium with a small main process) showing the game's single HTML file. It is built on Linux (or macOS, or
Windows): nothing of Windows itself is needed to build it.

## Building

```
npm run build                                                        # or the packed file with every asset inside
node tools/make-windows-app.mjs --game dist/play.html --out out/win
```

`--game` is any single HTML file of the game: `dist/play.html` (code only), or the offline file that carries the
portraits, models, films and voices inside it. The tool copies it as it is; whatever the file holds is what the
application shows. Options:

| option | what it does |
|---|---|
| `--characters <file.html>` | the characters room (the game's second page) as one HTML file. With it the start screen's "חדר הדמויות" opens the room inside the app and the room's link returns to the game; without it the link is hidden, so the start screen has no dead button |
| `--version <x.y.z>` | another Electron than the pinned one (`ELECTRON_VERSION` in `tools/desktop-app/lib.mjs`, now 45.4.1) |
| `--icon <file.ico>` | an icon from outside instead of the one drawn in code |
| `--platform linux-x64`, `--no-zip` | the same app on another Electron build; the test uses the Linux one to run the app here |

The first run downloads Electron's release zip from github.com (158 MB for Windows x64) and two small npm tools
into `~/.cache/nehorai-desktop` (or `$NEHORAI_DESKTOP_CACHE`); later runs take about 20 seconds. Nothing is added
to the project's `package.json`. It needs `unzip`, `zip`, `npm`, and (for the icon) Playwright's Chromium, which
the tests already use.

What the tool does, in order:

1. Electron's `electron-v<version>-win32-x64.zip`, from the cache or downloaded, always checked against the
   `SHASUMS256.txt` of the same release (a cached file that does not match is downloaded again).
2. Unpacked into `<out>/Nehorai Farhi/`. Electron's default app is removed; of the 55 interface languages only
   English and Hebrew stay (the window has no menus to translate; this saves 50 MB).
3. `resources/app/` gets `package.json` (the app's name, which names the saves folder), `main.js`
   (`tools/desktop-app/main.js`) and `game.html` (the game file given).
4. `electron.exe` becomes `Nehorai Farhi.exe`. Its icon and version strings are replaced inside the file with
   `resedit` (pure JavaScript): product name "Nehorai Farhi", file description "חייו של נהוראי פרחי", company
   "Sherzer Production", the version from the project's `package.json`. The tool then reads the file back and
   stops if the strings or the icon are not in it.
5. The icon is drawn in code (`iconSvg` in `tools/desktop-app/lib.mjs`: an amber glossy orb with a white S on a
   dark rounded square), rendered by Playwright at 256, 128, 64, 48, 32 and 16 pixels (the two smallest drawn
   bolder), and written as an `.ico` of PNG pictures. A copy is left at `<out>/icon.ico`.
6. `קרא אותי.txt` is written beside the .exe (UTF-8 with the mark and line ends Notepad expects): how to start,
   the blue Windows box, the keys, where the saves live, how to remove the game.
7. The folder is zipped to `<out>/Nehorai-Farhi-Windows.zip`, and the Hebrew file name in it is marked as UTF-8
   so that Windows' own unzip shows it right. `<out>/build.json` lists what was built (versions, sizes, checksums).

## What is in the zip

One folder, `Nehorai Farhi/`, 23 files, about 313 MB unpacked and about 140 MB zipped with `dist/play.html`
(the game file is added on top: with the packed file expect the zip to grow by roughly the size of the assets).

| file | what it is |
|---|---|
| `Nehorai Farhi.exe` (250 MB) | Electron 45.4.1 (Chromium 156), with the game's icon and name |
| `קרא אותי.txt` | the note for the player |
| `resources/app/game.html`, `main.js`, `package.json` | the game, the app's main process, the app's name |
| `resources.pak`, `chrome_*.pak`, `icudtl.dat`, `*.bin`, `locales/en-US.pak`, `locales/he.pak` | Chromium's data |
| `ffmpeg.dll`, `d3dcompiler_47.dll`, `dxcompiler.dll`, `vulkan-1.dll`, `vk_swiftshader.dll` (+ `.json`), `electron_wer.dll` | Chromium's libraries (sound and film decoding, graphics) |
| `LICENSE`, `LICENSES.chromium.html`, `version` | Electron's and Chromium's licences, which must travel with the program |

It runs on Windows 10 and 11, 64-bit. The .exe must stay inside its folder.

## The application (`tools/desktop-app/main.js`)

- One window, 1280×720 or larger, opened maximized, dark (the page's own background) while the game loads, the
  title "חייו של נהוראי פרחי", no menu bar.
- F11 and Alt+Enter switch full screen and do not reach the game. Esc is not bound by the app: it reaches the
  game, which pauses. The game's own full-screen button works too; in that mode Chromium would take Esc to leave
  full screen, so the app asks for Esc to stay with the game (the Keyboard Lock API), and F11 leaves it.
- The page has no Node: context isolation and the sandbox are on, there is no preload script. It may ask for full
  screen and to hold the pointer or Esc; every other permission (camera, location...) is refused.
- Sound and films may start without a press (`autoplay-policy=no-user-gesture-required`).
- The page can go nowhere else: navigation, redirects, pop-ups and webviews are refused. It may load itself again
  (the game does, for a new game) and move between the game and the characters room when that is in the build.
- One instance: a second start brings the first window forward. Closing the window ends the app.
- A laptop with two graphics chips gives the game the strong one; a computer with no usable graphics chip still
  gets WebGL, drawn by the processor.
- Saves are the page's `localStorage`, exactly as on the web, kept in the app's data folder:
  `%APPDATA%\Nehorai Farhi`, that is `C:\Users\<name>\AppData\Roaming\Nehorai Farhi`. The game folder can be
  moved or replaced by a newer build without losing them. A save from the web page does not move over by itself.
- The keys are the game's own (`src/input/controls.js`); the readme lists them. The game reads letters by the
  character typed, so with the keyboard on Hebrew the letter keys do nothing (arrows, Shift, Space, Enter and Esc
  still work); the readme says to switch to English.

## The blue box: "Windows protected your PC"

The .exe is not signed, so the first time it is started after a download Windows SmartScreen shows a blue box
"Windows protected your PC". **More info**, then **Run anyway**, starts it; Windows asks once. This is what
Windows does with every program it has not seen much and that carries no publisher's signature, and it says
nothing about what is in the file. The readme tells the player the same.

Getting rid of the box means signing the .exe with a code-signing certificate issued to a verified publisher
(Microsoft's Trusted Signing or a certificate from a certificate authority, both paid and both needing proof of
identity). Signing can be done on Linux too (`osslsigncode`, `jsign`) as a step after this tool; none of it is
set up here. Some antivirus programs are also wary of unsigned programs nobody has seen yet.

## The check inside the app

```
"Nehorai Farhi.exe" --smoke report.json shot.png
```

loads the game with a throwaway data folder (the player's saves are not touched), waits (bounded: 240 s in all,
`NEHORAI_SMOKE_SECONDS` changes it) for `window.__game` and an enabled start button, notes WebGL2, the renderer,
whether the asset layer is on the page (`window.__hfAssets`), the title and any page error, presses the start
button, waits until the game's clock has run two seconds, saves a picture of the window, then presses the keys
for real (Esc pauses and resumes, in the window, in full screen and in the game's own full screen; F11 and
Alt+Enter), tries to leave the page (refused) and to load it again (allowed), writes the report and exits 0, or
1 with the reason in the report. On Windows, from `cmd` in the game's folder:
`start /wait "" "Nehorai Farhi.exe" --smoke report.json shot.png` and then `echo %errorlevel%`.

## What was tested here, and what was not

`node tests/windows-app.test.mjs [game.html] [out dir]` builds from `dist/play.html` into `out/windows-app-test/`
and checks (about a minute and a half with a warm cache):

- **The Windows folder, read back without running it.** The .exe's headers, read by hand: a valid 64-bit Windows
  GUI program, resources inside `.rsrc`, no stale signature. Set beside Electron's own `electron.exe` from the
  release zip: all 13 sections before the resources are the same bytes at the same addresses and the entry point
  is the same, only `.rsrc` differs, and the relocations after it are the same bytes moved, with the headers
  pointing at where they now are. The icon (six sizes, byte for byte the drawn ones) and the version strings read
  back with `resedit`. `resources/app` holds the three files and `game.html` is the file given. Every other file
  is as Electron released it. The readme's content and encoding. The zip lists exactly the folder, unpacks
  without an error, and the Hebrew name is marked UTF-8.
- **The same app, run for real on Linux.** The tool builds the same `resources/app` (checked identical, file for
  file) on Electron 45.4.1 for Linux x64, and the test runs it under `xvfb-run` with software WebGL
  (`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, and `--no-sandbox` because the
  tests run as root) with the `--smoke` check above. When Electron cannot start on the machine (not Linux x64,
  no display and no `xvfb-run`, a missing system library) this part is skipped with a line that says so.

Checked once by hand on the same Linux build, started the way a player starts it (with a window manager on the
virtual display, watched over the debugging port): the window opens maximized with the start screen, a second
start ends by itself, closing the window ends the app, and what the page stored is back after a restart. With
`--characters dist/characters.html`: the link opens the room, the room cannot go elsewhere, its link returns.

**Not tested: the Windows .exe itself has never been run.** This machine has no Windows and no Wine. So on
Windows these are still to be seen by a person: that it starts from a double-click, the icon in Explorer and on
the taskbar, the SmartScreen box and its two buttons, drawing through Direct3D on a real graphics chip and its
speed, sound, maximize and full screen, the saves folder under `%APPDATA%`, and how an antivirus takes it. The
Linux run shares the app's code and the same Chromium version, so the game, the keys and the page's walls are
the same code paths; what differs is everything below Chromium. The `--smoke` line above is a five-minute way
to check a Windows machine.

Also not tested here: a game file with the asset layer inside (the test's default is `dist/play.html`, which has
none; pass the packed file as the first argument).

## Other computers

The single HTML file opens in any current browser on any computer, which is the version for macOS and Linux
today. `--platform linux-x64` gives a working Linux folder, used for the test; it is not a release (no readme, no
zip, and a Linux desktop may need Electron's sandbox helper set up). A macOS application needs an app bundle and
Apple's signing and is not made here.
