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
| 8.2–19.4 | flute montage (MCU → ECU → hands), credits רפאל / יהלי |
| 19.4–24.4 | title hit "הסרט הגדול", fade to black |
| 25.0–34.4 | Rafael & Yahli talk, name tags; push-in on Rafael from 31.6 on "מעניין איך זה היה פעם" |
| 34.4–35.4 | rewind (reverse, zoom-blur, RGB split, VHS) → white flash |
| 35.4–41.0 | old-film flashback card "לפני כמה שנים..." with the flute as an old record |

Flashback footage goes after 41.0 (replace the card's tail once the old clips arrive).
