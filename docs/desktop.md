# The game as one file for a computer

`tools/pack-desktop.mjs` makes one HTML file that holds the whole game: the page, its code, and the asset
layer (the portraits, the realistic models, the films, the music and the voices). A person downloads that
file, double-clicks it, and plays in the browser that opens: no installation, no server, no network.
It works on Windows, macOS and Linux alike, because it is only a page.

(A separate piece wraps the same file as a Windows app. This document is about the file itself.)

## Making it

```
npm run build
npm run desktop -- --hf <folder that contains hf/> --out <file.html>
```

- `--hf` is the folder that holds the asset layer's `hf/` folder (the one with `hf/hf-assets.js`). That folder
  is not in this repository and is never committed. Without `--hf` the repository's own build is packed
  alone: still one valid offline file, with the game as it looks without the asset layer.
- `--out` is the file to write. Without it: `out/Nehorai-Farhi-Game.html`. Inside the repository the tool
  writes only under `out/` (ignored by git); anywhere outside it is free.
- The tool reads `dist/play.html`, so run `npm run build` first. It prints what it packed and the size.

With the asset layer of November 2026 (122 files, 52 MB) the file is about 67 MB.

## What is inside

The packed file is `dist/play.html` with three additions:

1. **The asset layer's files**, each as an inert block before the game's script:
   `<script type="application/x-packed" data-p="p/erez.jpg" data-t="image/jpeg">…base64…</script>`.
   A browser reads such a block as text and does nothing with it. The JSON models are gzipped before they are
   encoded (12 MB become 7 MB); pictures, films and sound are already compressed and go in as they are.
   The blocks stand before the game's script on purpose: the browser gets through all of them in a fraction
   of a second while nothing else is running, so the asset layer is up before the town is built, as on the
   published page. (After the game's script they would be read in the gaps between the game's frames.)
2. **A small loader**, the last thing in the page. Every way the asset script and the game ask for an
   `hf/...` address is answered from the blocks, with no network and no `file://` request:

   | asked for with | answered with |
   | --- | --- |
   | `fetch('hf/x')` (the models, the car, the voices) | a `Response` over the packed bytes, gunzipped on the way out |
   | `img.src`, `new Image()`, `THREE.TextureLoader` | a `blob:` address |
   | `video.src`, `audio.src`, `new Audio('hf/x')`, `video.poster` | a `blob:` address |
   | `url("hf/x")` in a `<style>` element or in an element's style | the same text with a `blob:` address |

   A block is decoded the first time its file is asked for, turned into a Blob and removed from the page, so
   nothing is decoded at start-up and every file is held once.
3. **The asset script** (`hf/hf-assets.js`), run by the loader as the last script of the page. It is packed
   like every other file, byte for byte, and never rewritten, so a new version of it needs nothing here.

**The characters room** (the game's second page, `dist/characters.html`) is inside the same file: gzipped in a
block of its own (about 0.2 MB). The start screen's "חדר הדמויות" opens it over the game in a frame
(`<iframe srcdoc>`, so the browser treats it as the same page); the loader runs in that frame too and asks the game
page for the packed files, so the people's models and portraits are stored once. The room's "למשחק", or Escape,
closes the frame, and the game under it is not drawn while it is open. In a pack made without `--hf` there is no
loader in the page, so the link is hidden (a second file would not be there).

Limits worth knowing:
- A gzipped file (JSON) can only be read with `fetch`. An `hf/...` address that is not in the pack fails at
  once, without touching the disk. `XMLHttpRequest` is not covered (nothing uses it).
- The loader needs `DecompressionStream`: Chrome or Edge 80, Firefox 113, Safari 16.4, or newer. In an older
  browser the game still runs, with the models it draws itself.
- The films are H.264 with AAC sound: a browser without those codecs shows the game's own scenes instead.

## Where saves live

The game saves into the browser's `localStorage`, under the keys `nehorai-game:save:v1` and
`nehorai-game:settings:v1`. Nothing is written beside the file. So a save belongs to **the browser and its
profile**, not to the file:

- **Chrome and Edge** keep one storage for all pages opened from the disk. Moving or renaming the file, or
  replacing it with a newer build, keeps the save. (Any other local page that used the same keys would share
  it; none does.)
- **Firefox** keeps storage for each file by its full path. Moving or renaming the file starts without the
  save; putting the file back where it was brings the save back. To keep a save across a new build, give the
  new file the old name in the old place.
- A different browser, a different profile or a private window starts fresh. Clearing the browser's site
  data ("cookies and other site data") erases the save.

The Chrome behaviour was seen in the test below (a save, the file loaded again, "להמשיך" offered). The
Firefox and Safari behaviour is from how those browsers are documented to work, not from a run here.

## Playing on a computer

Where the page is used with a mouse (`(pointer: fine) and (hover: hover)`), `src/ui/desktop.js` changes the
start screen: the how-to lists the keys below, there is a full-screen button, and Enter starts the game.
The pause menu has its own full-screen button, right under "המשך". On a phone or a tablet nothing changes.

| | |
| --- | --- |
| Move | W A S D or the arrow keys |
| Look | drag with the mouse, anywhere on the view |
| Run | hold Shift |
| Act (a door, the car, a person) | E or Enter, when the action button shows |
| Driving | the same keys for gas, brake and steering; Space for the handbrake; F to leave the car |
| Fists | J punch, K block (hold), L or Space dodge; in chapter nine's fights U heavy punch and I shove; in the last fight O the special |
| Paintball | J fire, R reload, K mark |
| Pause | Esc or P (in full screen Esc leaves full screen first: use P) |
| Phone, sound, radio and the other buttons | click them |

Full screen is asked for only from its own buttons, because a browser gives it only to a press; a browser
that refuses leaves the window as it is.

## Checking it

```
node tests/desktop-pack.test.mjs --hf <folder that contains hf/>
node tests/desktop-pack.test.mjs
```

The test packs to `out/test/`, opens the file from `file://` in Chromium as a desktop (1280x720, a mouse) and
as a touch phone, and prints the file's size and the time to the enabled start button beside the plain
build's. With `--hf` it also checks that not one request leaves the file, that the asset layer works from the
pack (the start picture, the opening film, the realistic models, a chapter-ten film, the ad after the
credits, the radio, a voiced line, a portrait) and that every packed file reads back equal to the folder's.
