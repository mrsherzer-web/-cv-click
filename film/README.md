# הסרט הגדול — רפאל פצצות

Edit project for the opening + talk scene + flashback transition.
Source footage and rendered video are **not** committed (personal videos; this repo is public).

## Layout expected at build time
```
film/
  compose.py      video compositor (grade, titles, shots, rewind, vintage flashback)
  mix.py          soundtrack (flute, dialog, drone in D, booms, risers, echo, rewind, record crackle)
  titles/         titles.html + render.js (Chromium/Playwright) -> PNG title layers
  inter/flute.mkv, inter/talk.mkv   denoised 16-bit intermediates (see below)
  audio/flute_clean.wav, audio/talk_clean.wav
```

## Build
```bash
./fetch_fonts.sh
(cd titles && node render.js ../titles emblem studio presents credit1 credit2 title titleglow tagR tagY past)

# intermediates (IMG_7610 = flute, IMG_7611 = talk)
ffmpeg -i IMG_7610.mov -an -vf "crop=2160:2000:0:450,format=yuv444p16le,scale=1620:1500:flags=area,hqdn3d=1:1.5:4:5,format=gbrp16le" -c:v ffv1 -level 3 -slices 16 inter/flute.mkv
ffmpeg -i IMG_7611.mov -an -vf "format=yuv444p16le,scale=2560:1440:flags=area,hqdn3d=1:1.5:4:5,format=gbrp16le" -c:v ffv1 -level 3 -slices 16 inter/talk.mkv

# audio
ffmpeg -i IMG_7610.mov -vn -ac 1 -ar 44100 audio/flute_raw.wav
ffmpeg -i IMG_7611.mov -vn -ac 2 -ar 44100 audio/talk_raw.wav
ffmpeg -i audio/flute_raw.wav -af "highpass=f=160,afftdn=nf=-50:nr=12,equalizer=f=300:t=q:w=1:g=-2,equalizer=f=2500:t=q:w=1.5:g=1.5" -ar 48000 -ac 1 audio/flute_clean.wav
ffmpeg -i audio/talk_raw.wav -af "highpass=f=90,afftdn=nf=-45:nr=10,acompressor=threshold=-30dB:ratio=4:attack=4:release=120:makeup=2,equalizer=f=200:t=q:w=1:g=-1.5,equalizer=f=3500:t=q:w=1.2:g=2.5,loudnorm=I=-18:TP=-3:LRA=7" -ar 48000 -ac 2 audio/talk_clean.wav
python3 mix.py

python3 compose.py preview prev 5.2 19.8 34.3 37.5   # stills
python3 compose.py render out.mp4                    # full film
```

## Timeline (seconds)
| time | what |
|---|---|
| 0–8.6 | black, embers, flute starts at 1.0; studio logo "רפאל פצצות" + "מציגים" (boom at 3.2) |
| 8.2–19.4 | flute montage (MCU → ECU → hands), credits "בכיכובו של רפאל" (gold, the star) / "ובכיכובם של המטומטמים" |
| 19.4–24.4 | title hit "הסרט הגדול", fade to black |
| 25.0–34.4 | Rafael & Yahli talk, name tags; push-in on Rafael from 31.6 on "מעניין איך זה היה פעם" |
| 34.4–35.4 | rewind (reverse, zoom-blur, RGB split, VHS) → white flash |
| 35.4–39.6 | old-film card "לפני כמה שנים..." with the flute as an old record, film burn into the flashback |
| 39.6–180.4 | the flashback (the real film), see below |

## Flashback (F = seconds from 39.6)
Clips: IMG_9009 (c1, leaving home + Dubi + chase start), IMG_9010 (c2, chase), IMG_9012 (c3, Dubi tired), IMG_9013 (c4, Rafael walks off).
HLG HDR sources are tone-mapped to SDR intermediates:
```bash
ffmpeg -i IMG_9009.mov -map 0:v:0 -an -vf "zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=mobius:desat=0,zscale=t=bt709:r=full,format=gbrp16le" -c:v ffv1 -level 3 -slices 16 fb/inter/c1.mkv   # same for c2..c4
ffmpeg -i IMG_9009.mov -map 0:a:0 -ac 1 -ar 48000 fb/audio/c1.wav && ffmpeg -i fb/audio/c1.wav -af "highpass=f=80,afftdn=nf=-42:nr=8" fb/audio/c1_clean.wav
```
"The French Dubi" is tracked with MediaPipe pose (`fb/track.py`, results in `fb/track_c*.json`); `fb/dubi.py` widens his belly and face along the tracked skeleton and adds flies and stink lines.

| F | what |
|---|---|
| 0–13.6 | Rafael leaves home, vapes (groove with his flute on top) |
| 13.6–16.8 | freeze-frame intro "הכירו את: הדובי הצרפתי" (dun-dun-DUNNN + accordion) |
| 16.8–30.2 | Dubi shouts, Rafael runs, chase (150 BPM) |
| 30.2–33.5 | Dubi gets tired (tape stop, sad trombone) |
| 33.5–39.8 | Rafael walks off, looks back and smiles (music fades out) |
| 39.8–47.1 | he walks to his car — no music, no subtitles: ambience, footsteps, real door foley |
| 47.1–55.5 | in the car: Yahli's message (notification card, chimes, vibration, heartbeat), real key foley |
| 55.5–58.4 | key turn → starter → engine catches over the cut; the pursuer pulls up alongside (unnamed) |
| 58.4–78.5 | car chase, cross-cut (tense score, 128 BPM) |
| 78.5–83.5 | the escape: his car comes round the junction alone, passes the camera — the chase music stops on a D-major hit |
| 83.5–91.9 | he parks and gets out (natural sound: engine, door, steps, birds; a low drone creeps in) |
| 91.9–104.5 | down the stairs to the hideout (72 BPM pulse, ticking, minor-second ostinato rising to the door) |
| 104.5–113.7 | inside: the hooded figure (sting), heartbeat |
| 113.7–140.8 | the talk outside (low bed ducked under the voices), he walks out on the last hit, fade to black |

Clips c11..c16: IMG_9022 (c11), IMG_9023 (c12), IMG_9024 (c13), IMG_9026 (c14), IMG_9025 (c15, the 29.97 fps file, converted to 30), IMG_9025 (c16).
Sound for this part: `hidesfx.py` (ambience, car, doors, room tone, heartbeat) and `fbmusic.hideout_score`.

Clips c5..c10: IMG_9014 (c5), IMG_9015 (c6), IMG_9017 (c7, c8), IMG_9018 (c9), IMG_9021 (c10); ProRes intermediates in `cc/inter/`, sync sound in `cc/audio/`.
Licence plates are blurred everywhere (`plates.py`, `cars.py`, `run_plates.py`, `refine_tracks.py`, `fix_misses.py`; boxes in `plate_data/`).

### Sound for the no-music stretch (F 39.8–58.4)
The phone recordings there sit at -50…-60 dBFS, so the stretch was nearly silent. `carsfx.py` builds it from
the clips' own sync sound (cleaned and levelled: door handle, door, sitting down, slam, keys, ignition, the voices in c7),
real recordings from ESC-50 (footsteps, birds/breeze bed, idle engine, the other car, small foley) and a few
synthesized elements (key jingle, remote chirp, door body, phone vibration, heartbeat, starter motor).
`mix.py` places it and skips the raw clip audio of those shots. Footstep timing comes from pose (`sfx/gait.py`).
The library itself (`sfx/lib/`) is not committed; `sfx_manifest.json` lists every file with its source clip and offset.

Sound credits: ESC-50 dataset (K. J. Piczak, 2015, CC BY-NC 3.0), from freesound.org sounds
155858 (footsteps), 243773 (engine idle), 18527 (the other car), 72547, 182795, 181132, 223127, 34497, 187769,
243448, 242491, 242490 (birds), 51035, 51036, 51037 (breeze), 51805, 191497, 91912 (creaks / latch), 81851 (click).

Narrative subtitles are `titles/sub1..9.png` (from `titles/fb_titles.html`, render with `PAGE=fb_titles.html node render2.js`).
