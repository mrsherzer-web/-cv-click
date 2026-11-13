# פרק 10 · הסרטים

The twelve films of chapter ten, made with Higgsfield on 13 November 2026. They are not in this repository: like the
earlier chapters' films, portraits and realistic models they live in the published page's `hf/` folder
(`hf/c10/<id>.mp4`, 1280×716, H.264, no sound, about 10 s each, 24 MB in all), and `hf/hf-assets.js` registers
them as `game.cutscenes['c10-<id>']`. A mission calls `game.playCutscene('c10-<id>', fallback)`; the film plays
over the game, a tap skips it, and the mission's own scene and captions follow either way. With no film (this
repository's own build, or a film that cannot play) only the scene plays.

How they were made: a start frame for each with GPT Image 2.6 (quality high, 16:9), from the characters'
existing portraits (Nehorai, Erez, Ido, Muller) as references and, for the olive grove, three frames of the
user's own videos of the real grove; then each frame animated for 10 s with Kling 3.0 (standard, no sound).
About 200 credits in all. The lines are never in the films: they are the game's captions.

| id | mission | what it shows |
|---|---|---|
| c10-dawn | 47 | sunrise over the hills; Nehorai with the bandage at the balcony rail, Erez comes out to him |
| c10-citadel | 48 | the convoy of three cars, the white hatchback first, racing toward the dark fortress under a red sky |
| c10-fall | 50 | the violet energy wave throws Nehorai against the wall as he shields Erez; the marker flies; no blood |
| c10-portal | 51 | the Shadow's orb becomes the vortex; Nehorai holds the pillar, Erez his arm; both pulled in |
| c10-grove | 52 | the olive grove of the videos under a violet sky with two moons; the two wake up on the grass |
| c10-gate | 54 | Muller at the console, the machine's blue ring opening, the friends holding the door with paint markers |
| c10-return | 55 | the portal widens and the two land in the hall; the friends cheer |
| c10-shadow-down | 57 | the Shadow on one knee in broken armour, the engine dying; the friends stand together |
| c10-blast | 58 | the fortress collapses in a violet-white blast, the shockwave over the plain, the armoured car racing away |
| c10-alive | 58 | the armoured car on its side; the friends climb out dusty, laughing and hugging |
| c10-home | 59 | the walk into Katzir at golden hour between cheering villagers |
| c10-end | 59 | the camera rises over the gang before the crowd, the village and the hills at sunset |
