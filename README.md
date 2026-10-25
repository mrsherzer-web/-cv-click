# -cv-click

## jarvis_edit

A JARVIS-style HUD edit for two phone clips: boot intro, live HUD, face tracking, and a full facial "scan" on a freeze frame with a 3D mesh, stats panels, and a voice-over.

The pipeline works out of one work directory `$S` that holds `in/a.mov`, `in/b.mov`, `models/` (MediaPipe `face_landmarker.task`, `FSRCNN_x4.pb`), `fonts/` (Orbitron, Rajdhani, Share Tech Mono) and `voice/` (Piper `en-gb-alan-low` lines `v1..v7.wav`).

```sh
# decode (auto-rotated) frames + audio
ffmpeg -i in/a.mov -vf scale=1080:1920 -pix_fmt rgb24 -f rawvideo work/a.rgb
ffmpeg -i in/b.mov -pix_fmt rgb24 -f rawvideo work/b.rgb
ffmpeg -i in/a.mov -vn -ac 2 -ar 48000 work/a.wav
ffmpeg -i in/b.mov -vn -ac 2 -ar 48000 work/b.wav

python3 jarvis_edit/detect.py  $S b 360 480 2       # face landmarks per frame
python3 jarvis_edit/detect.py  $S a 1080 1920 0.5
python3 jarvis_edit/tracks.py  $S                   # smoothed tracks + watch tracker
python3 jarvis_edit/upscale.py $S                   # denoise + x4 upscale of clip B
python3 jarvis_edit/audio.py   $S                   # beat, SFX, voice mix, timeline.json
python3 jarvis_edit/render.py  $S part 0 626 work/video.mp4
ffmpeg -i work/video.mp4 -i work/mix.wav -c:v copy -c:a aac -b:a 256k out.mp4
```

`render.py $S preview <frame> ...` writes still frames to `$S/frames/` for checking.

Requires `opencv-contrib-python`, `mediapipe`, `scipy`, `pillow`, `piper-tts`, and ffmpeg with libx264.

## film

A ~69 s vertical story edit ("הדרך") from six phone clips and three photos, with Hebrew titles, a synthesized score and a 2010 Corvette sequence built from C6 photos (Stanford Cars dataset) cut out with `rembg`.

`spec.py` holds the beat grid, shots and all on-screen text; `audio_film.py` builds the score and mix and writes `work/film_mix.wav` + `work/rpm.npy`; `film_render.py` renders frames (`part K0 K1 out.mp4`, or `preview K ...`). Inputs live in one movie directory with `in/`, `work/` (decoded `*.rgb` frames and `*.wav`), `fonts/`, `vette_cut/` (car RGB + mask PNGs).

`person_masks.py` → `vette_audio.py` → `vette_clip.py` build the 15 s "Corvette ride" cut of the drive clip: person segmentation to blur the cabin behind the passengers, the non-Corvette shots removed, a darkened dash with a C6-style HUD, and an exterior ending with name call-outs.

### number pieces

Three short vertical pieces that take a phone number and a `tel:` URI on the command line (nothing personal is stored in the repo):

- `code_audio.py` + `code_reveal.py`: a Matrix-style decrypt that resolves into the number and a scannable QR code.
- `sculpture.py` + `shadow_audio.py` + `shadow_film.py`: one voxel sculpture whose shadow on one wall is the QR code and on the other wall is the number.
- `song_audio.py` + `song_video.py` (+ `song_parts.py` for parallel parts, `song_verify.py`): a song that *is* the number. The intro is the number's real DTMF dial tones, the hook plays each digit as a note of A minor, and the 4.5–12.5 kHz band is painted so that a linear spectrogram shows the number and then a working `tel:` QR code. `song_verify.py` reads the QR back out of any audio file.

```sh
python3 film/song_audio.py $M "<number>" "tel:<e164>"          # work/song_mix.wav + song_timeline.json
python3 film/song_verify.py $M work/song_mix.wav               # decodes the QR from the audio
python3 film/song_parts.py $M "<number>" "tel:<e164>" 0 162 work/spart0.mp4   # ... one per frame range
```
- `prime_qr.py`: finds a prime whose digits, laid out 33 per row, draw a QR code (a digit with a hole, 0 6 8 9, is a dark module; one without, 1 2 3 5 7, is a light module). Checked with BPSW plus 64 Miller–Rabin rounds.
