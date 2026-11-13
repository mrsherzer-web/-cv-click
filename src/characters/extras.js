// People who are not the main cast, all invented for the game: the rival crew "the Porcupines"
// (הדרבנים), the guards of each chapter, the Black Order of chapter nine (its leader "הצל", its huge
// guard "הפטיש" and og1..og18, chapter ten's shield bearers, heavies, runners and the Keeper, all found by
// game.npc(id) through GUARDS) and passers-by made up from a
// seed. None of them is based on a real person.
import { rng } from '../core/math.js';
import { KEEPER as KEEPER_NAME } from '../missions/lines10.js'; // the user's name for him, as written

const crew = (id, name, o) => ({
  id, name, crew: true,
  top: { type: 'tee', color: '#2f4a3a', print: 'spikes', printColor: '#e9d27a' },
  shoes: { type: 'sneakers', color: '#232427', sole: '#d9d6cf', accent: '#e9d27a' },
  height: 1.0, build: {}, brows: 1.2, ...o,
});

// the Porcupines: dark green tees with a row of quills on the chest
export const RIVALS = {
  kotzi: crew('kotzi', 'קוצי', {
    skin: '#c4916b', height: 1.02, build: { shoulders: 1.08, arms: 1.08 },
    hair: { style: 'buzz', color: '#14100d' }, facial: { beard: 'short', color: '#14100d' },
    top: { type: 'zip', color: '#2f4a3a', print: 'spikes', printColor: '#e9d27a' },
    bottom: { type: 'joggers', color: '#26292d' }, chain: true,
  }),
  shpitz: crew('shpitz', 'שפיץ', {
    skin: '#d8ab86', hair: { style: 'fluffy', color: '#7a5434' },
    bottom: { type: 'shorts', color: '#3d4046' },
  }),
  roller: crew('roller', 'רולר', {
    skin: '#a8754f', height: 0.97, build: { shoulders: 1.04 },
    hair: { style: 'curly', color: '#120d0a' }, facial: { beard: 'stubble', color: '#120d0a' },
    bottom: { type: 'pants', color: '#43402f' },
  }),
  tosti: crew('tosti', 'טוסטי', {
    skin: '#d2a07a', height: 1.04, build: { shoulders: 1.0 },
    hair: { style: 'crop', color: '#3a2a1d' },
    bottom: { type: 'joggers', color: '#1d1f22' }, watch: true,
  }),
  // chapter two: their heavyweight, away in chapter one
  bulldozer: crew('bulldozer', 'בולדוזר', {
    skin: '#b98962', height: 1.08, build: { shoulders: 1.2, arms: 1.18, legs: 1.1 },
    hair: { style: 'buzz', color: '#100c0a' }, facial: { beard: 'short', mustache: true, color: '#100c0a' },
    top: { type: 'tank', color: '#2f4a3a' },
    bottom: { type: 'shorts', color: '#26292d' },
  }),
};

const shark = (id, name, o) => ({
  id, name, crew: true,
  top: { type: 'tee', color: '#7fb3cf', print: 'fin', printColor: '#1d3b52' },
  shoes: { type: 'slides', color: '#f1f1ee', sole: '#26272a' },
  height: 1.0, build: {}, brows: 1.15, ...o,
});

// the Sharks: pale blue tees with a fin on the chest; they hang around the beach car park
// "the Cipher" (chapter six): sold half of Katzir fake tickets; a hood, a dark tee, pale and sharp
export const CIPHER = {
  id: 'cipher', name: 'הצופן', crew: true,
  skin: '#e6c9ad', height: 1.02, build: { shoulders: 0.98, arms: 0.96 }, brows: 1.3, eyes: '#3b4a5a',
  hair: { style: 'buzz', color: '#1a1410' }, facial: { beard: 'stubble', color: '#1a1410' },
  top: { type: 'tee', color: '#1c1f26', print: 'ring', printColor: '#59c7ff' },
  bottom: { type: 'pants', color: '#15171c' },
  shoes: { type: 'sneakers', color: '#1b1b1e', sole: '#59c7ff', accent: '#2a2d33' },
};

export const SHARKS = {
  gali: shark('gali', 'גלי', {
    skin: '#b98360', height: 1.03, build: { shoulders: 1.06, arms: 1.05 },
    hair: { style: 'curly', color: '#2a1d15' }, facial: { beard: 'short', color: '#2a1d15' },
    bottom: { type: 'shorts', color: '#2f3a46' }, chain: true,
  }),
  snapir: shark('snapir', 'סנפיר', {
    skin: '#d6a882', hair: { style: 'crop', color: '#4a3322' },
    bottom: { type: 'shorts', color: '#c9b48a' },
  }),
  shen: shark('shen', 'שן', {
    skin: '#a8754f', build: { shoulders: 1.04 }, hair: { style: 'buzz', color: '#14100d' },
    bottom: { type: 'joggers', color: '#2a2b2f' }, shoes: { type: 'sneakers', color: '#f1f1ee', sole: '#26272a', accent: '#7fb3cf' },
  }),
  zanav: shark('zanav', 'זנב', {
    skin: '#e3b994', height: 0.97, hair: { style: 'fluffy', color: '#9b7b55' },
    bottom: { type: 'shorts', color: '#3d4046' },
  }),
};

// chapter nine: "המסדר השחור" (the Black Order), invented for the game. Its people wear black tactical
// clothes with a dark red band on the upper arm; nobody in it is based on a real person or group.
const RED = '#6e1a1e';
const order = (id, name, o) => ({
  id, name, crew: true,
  top: { type: 'zip', color: '#15161a' },
  bottom: { type: 'cargo', color: '#18191d' },
  shoes: { type: 'boots', color: '#121315', sole: '#0b0b0c' },
  band: { color: RED, arm: 'left' },
  height: 1.0, build: {}, brows: 1.15, ...o,
});
// [skin, height, build, hair, facial, extra]: eighteen different people, no two alike
const OG = [
  ['#e8c3a4', 1.02, { shoulders: 1.06, arms: 1.04 }, { style: 'crop', color: '#3a2a1d' }, { beard: 'stubble', color: '#3a2a1d' }, { vest: { color: '#1d1f24' } }],
  ['#c8956f', 0.98, { shoulders: 1.0 }, { style: 'buzz', color: '#14100d' }, { beard: 'short', color: '#14100d' }, {}],
  ['#8d5f3e', 1.06, { shoulders: 1.14, arms: 1.12, legs: 1.04 }, { style: 'shaved' }, { beard: 'stubble', color: '#120d0a' }, { vest: { color: '#1d1f24' }, gloves: { color: '#141416' } }],
  ['#dcb08b', 1.0, { shoulders: 0.98, arms: 0.98 }, { style: 'fringe', color: '#4a3322' }, null, { top: { type: 'tee', color: '#141518' } }],
  ['#a86b4a', 1.03, { shoulders: 1.08, arms: 1.06 }, { style: 'curly', color: '#120d0a' }, { beard: 'short', mustache: true, color: '#120d0a' }, { vest: { color: '#22252a' } }],
  ['#e3b994', 0.96, { shoulders: 0.97, legs: 0.98 }, { style: 'messy', color: '#9b7b55' }, { beard: 'stubble', color: '#7a5434' }, {}],
  ['#6e4a31', 1.07, { shoulders: 1.12, arms: 1.1 }, { style: 'buzz', color: '#0f0b09' }, { beard: 'short', color: '#0f0b09' }, { gloves: { color: '#141416' } }],
  ['#d4a07c', 1.01, { shoulders: 1.03 }, { style: 'textured', color: '#2a1d15' }, null, { vest: { color: '#1d1f24' }, band: { color: RED, arm: 'both' } }],
  ['#b98a67', 0.99, { shoulders: 1.02, arms: 1.0 }, { style: 'crop', color: '#8e8a85' }, { beard: 'short', color: '#8e8a85' }, { top: { type: 'tee', color: '#141518' } }],
  ['#5c3d29', 1.04, { shoulders: 1.1, arms: 1.08, legs: 1.03 }, { style: 'curly', color: '#0d0a08' }, { beard: 'stubble', color: '#0d0a08' }, { vest: { color: '#22252a' } }],
  ['#cfa27e', 0.97, { shoulders: 0.99 }, { style: 'fluffy', color: '#6b4a30' }, null, { gloves: { color: '#141416' } }],
  ['#9d6a48', 1.05, { shoulders: 1.16, arms: 1.14 }, { style: 'shaved' }, { beard: 'short', mustache: true, color: '#14100d' }, { top: { type: 'tank', color: '#141518' } }],
  ['#e0b89a', 1.0, { shoulders: 1.02 }, { style: 'buzz', color: '#5a3f2a' }, { mustache: true, color: '#5a3f2a' }, { vest: { color: '#1d1f24' } }],
  ['#7a5236', 0.98, { shoulders: 1.0, arms: 1.02 }, { style: 'fringe', color: '#120d0a' }, { beard: 'stubble', color: '#120d0a' }, { bottom: { type: 'pants', color: '#1b1c20' } }],
  ['#d9ab86', 1.08, { shoulders: 1.1, arms: 1.06, legs: 1.06 }, { style: 'crop', color: '#1a1410' }, { beard: 'short', color: '#1a1410' }, { vest: { color: '#22252a' }, gloves: { color: '#141416' } }],
  ['#bb8a64', 0.95, { shoulders: 0.96, arms: 0.96, legs: 0.97 }, { style: 'messy', color: '#2a1d15' }, null, { bottom: { type: 'pants', color: '#1b1c20' } }],
  // two more for the armory and the waves after it: a tall lean one with a full head of hair, a short broad one with red-brown hair
  ['#c49272', 1.06, { shoulders: 0.97, arms: 0.98, legs: 1.05 }, { style: 'fluffy', color: '#1c1511' }, { beard: 'short', mustache: true, color: '#1c1511' }, { top: { type: 'tee', color: '#141518' }, gloves: { color: '#141416' } }],
  ['#eec9ad', 0.96, { shoulders: 1.1, arms: 1.08, legs: 0.97 }, { style: 'textured', color: '#7a3f22' }, { beard: 'stubble', color: '#7a3f22' }, { vest: { color: '#22252a' }, bottom: { type: 'pants', color: '#1b1c20' } }],
];
export const ORDER_GUARDS = OG.map((_, i) => `og${i + 1}`);
// Chapter ten: the Order's special people for the last stand (all invented), found by game.npc(id) like the
// rest. Paint (combat/paint.js addGuard reads the spec) and fists (pass FIGHT_AS[kind] to the Fight):
//   shield bearers sh1..sh3 "נושא מגן": a riot shield; pellets from in front splash on it, so flank him (he
//     turns slowly) or let a friend mark him from the side; in a fist fight he covers up (shove, then hit)
//   heavies hv1..hv2 "לוחם כבד": big and padded; three marks put him out (two from the 'long' marker); in
//     a fist fight light punches hardly move him, a heavy punch or a combination's end does
//   runners rn1..rn4 "רץ": no marker; he sprints to arm's reach and shoves (a mark) after a short wind-up
export const ORDER_SPECIAL = { shieldman: ['sh1', 'sh2', 'sh3'], heavy: ['hv1', 'hv2'], runner: ['rn1', 'rn2', 'rn3', 'rn4'] };
export const FIGHT_AS = {
  shieldman: { hp: 80, guard: 0.85, power: 1 },
  heavy: { hp: 150, power: 1.25, windup: 0.95, open: 1.0, armor: 0.7, knockdownAt: 0.5, moves: ['slam', 'swing'] },
  runner: { hp: 50, power: 0.8, aggression: 1.5, windup: 0.45, open: 0.9 },
};
const SHIELD = { color: '#30343c', stripe: '#a3262b' }, PADS = { color: '#1e2026', glow: null, helmet: false };
const special = (kind, id, name, o) => order(id, name, { special: kind, ...o });
// "שומר הסף" (the Threshold Keeper), chapter ten's guardian of the other dimension: not a person, a tall
// being of violet-blue light (characters/builder.js makeEnergyBeing). About 3.2 m to the ring over its head
export const KEEPER = { id: 'keeper', name: KEEPER_NAME, energy: { color: '#5a48ff', rim: '#b7a6ff', core: '#e4f6ff' }, height: 1 };
export const ORDER = {
  keeper: KEEPER,
  sh1: special('shieldman', 'sh1', 'נושא מגן', { skin: '#c99a76', height: 1.04, build: { shoulders: 1.12, arms: 1.1 }, hair: { style: 'buzz', color: '#14100d' }, facial: { beard: 'short', color: '#14100d' }, vest: { color: '#1d1f24' }, gloves: { color: '#141416' }, shield: SHIELD }),
  sh2: special('shieldman', 'sh2', 'נושא מגן', { skin: '#e0b894', height: 1.02, build: { shoulders: 1.1, arms: 1.08 }, hair: { style: 'shaved' }, facial: { beard: 'stubble', color: '#3a2a1d' }, vest: { color: '#22252a' }, gloves: { color: '#141416' }, shield: SHIELD }),
  sh3: special('shieldman', 'sh3', 'נושא מגן', { skin: '#8d5f3e', height: 1.06, build: { shoulders: 1.14, arms: 1.1, legs: 1.03 }, hair: { style: 'crop', color: '#0f0b09' }, vest: { color: '#1d1f24' }, gloves: { color: '#141416' }, band: { color: RED, arm: 'both' }, shield: SHIELD }),
  hv1: special('heavy', 'hv1', 'לוחם כבד', { skin: '#b98a67', height: 1.16, build: { shoulders: 1.36, arms: 1.3, legs: 1.14 }, brows: 1.35, hair: { style: 'shaved' }, facial: { beard: 'short', color: '#16110d' }, top: { type: 'tee', color: '#141518' }, gloves: { color: '#141416' }, band: { color: RED, arm: 'both' }, armor: PADS, marks: 3 }),
  hv2: special('heavy', 'hv2', 'לוחם כבד', { skin: '#6e4a31', height: 1.14, build: { shoulders: 1.38, arms: 1.32, legs: 1.12 }, brows: 1.3, hair: { style: 'buzz', color: '#0d0a08' }, facial: { beard: 'stubble', color: '#0d0a08' }, top: { type: 'tee', color: '#141518' }, gloves: { color: '#141416' }, band: { color: RED, arm: 'both' }, armor: PADS, marks: 3 }),
  ...Object.fromEntries([['#dcb08b', 1.0, '#101013'], ['#a86b4a', 0.98, '#131316'], ['#e8c3a4', 1.03, '#101013'], ['#7a5236', 1.01, '#131316']].map(([skin, height, mask], i) => {
    const id = `rn${i + 1}`;
    return [id, special('runner', id, 'רץ', { skin, height, build: { shoulders: 0.96, arms: 0.98, legs: 1.04 }, hair: { style: 'buzz', color: '#14100d' }, mask: { color: mask }, top: { type: 'tank', color: '#141518' }, bottom: { type: 'joggers', color: '#1b1c20' }, shoes: { type: 'sneakers', color: '#17181b', sole: '#2b2c30', accent: RED }, band: { color: RED, arm: 'both' }, rush: true })];
  })),
  // "הצל" (the Shadow): the Order's leader. Tall and lean, all in black, a black mask with a slit for the eyes
  shadow: order('shadow', 'הצל', {
    skin: '#d2a682', height: 1.08, build: { shoulders: 1.04, arms: 1.0, legs: 1.05 }, eyes: '#4c5560', brows: 1.1,
    hair: { style: 'crop', color: '#0d0d0f' },
    mask: { color: '#0e0e11' }, gloves: { color: '#0e0e10' },
    top: { type: 'zip', color: '#0c0c0e' }, bottom: { type: 'pants', color: '#0e0f11' },
    shoes: { type: 'boots', color: '#0b0b0c', sole: '#060606' },
    band: null,
    // chapter ten: his energy suit, off until model.setArmor(true) (dark plates with strips of violet light,
    // a helmet with a lit visor); it comes off again for the last fist fight
    armor: { color: '#14151b', glow: '#8f6dff', visor: '#a6dcff', on: false },
  }),
  // "הפטיש" (the Hammer): the Order's huge guard, the arena's mini-boss. A shaved head, wide shoulders and arms
  hammer: order('hammer', 'הפטיש', {
    skin: '#b07a55', height: 1.15, build: { shoulders: 1.34, arms: 1.32, legs: 1.14 }, brows: 1.4, eyes: '#2e1d12',
    hair: { style: 'shaved' }, facial: { beard: 'stubble', color: '#16110d' },
    top: { type: 'tank', color: '#121316' }, bottom: { type: 'cargo', color: '#1a1b1f' },
    band: { color: RED, arm: 'both' },
  }),
  ...Object.fromEntries(OG.map(([skin, height, build, hair, facial, extra], i) => {
    const id = `og${i + 1}`;
    return [id, order(id, 'שומר', { skin, height, build, hair, ...(facial ? { facial } : {}), ...extra })];
  })),
};

// chapter four: the guards of "Kotzi's bank" (invented for the game), in dark polo shirts with a
// shield on the chest; passers-by who took a night job, no more than that
const guard = (id, name, o) => ({
  id, name, crew: true,
  top: { type: 'tee', color: '#1f2733', print: 'shield', printColor: '#c9d2dd' },
  bottom: { type: 'pants', color: '#15181d' },
  shoes: { type: 'sneakers', color: '#1e1f22', sole: '#2b2c30', accent: '#3a3c42' },
  height: 1.0, build: {}, brows: 1.15, ...o,
});
export const GUARDS = {
  guard1: guard('guard1', 'שומר', { skin: '#c8956f', height: 1.03, build: { shoulders: 1.08, arms: 1.06 }, hair: { style: 'buzz', color: '#1a1410' }, facial: { beard: 'short', color: '#1a1410' } }),
  guard2: guard('guard2', 'שומר', { skin: '#dcb08b', height: 0.99, hair: { style: 'crop', color: '#4a3322' }, facial: { beard: 'stubble', color: '#4a3322' } }),
  guard3: guard('guard3', 'שומר', { skin: '#b17d58', height: 1.05, build: { shoulders: 1.12, arms: 1.1 }, hair: { style: 'buzz', color: '#100c0a' }, facial: { beard: 'short', mustache: true, color: '#100c0a' } }),
  // Yaniv's people at the villa (chapter five): grey tees, same marker rules
  vg1: guard('vg1', 'שומר', { skin: '#c8956f', height: 1.02, hair: { style: 'buzz', color: '#1a1410' }, facial: { beard: 'short', color: '#1a1410' }, top: { type: 'tee', color: '#3a3d44' } }),
  vg2: guard('vg2', 'שומר', { skin: '#dcb08b', height: 1.0, hair: { style: 'crop', color: '#4a3322' }, top: { type: 'tee', color: '#3a3d44' } }),
  vg3: guard('vg3', 'שומר', { skin: '#b17d58', height: 1.05, build: { shoulders: 1.1, arms: 1.08 }, hair: { style: 'buzz', color: '#100c0a' }, facial: { beard: 'stubble', color: '#100c0a' }, top: { type: 'tee', color: '#3a3d44' } }),
  vg4: guard('vg4', 'שומר', { skin: '#e0b894', height: 0.98, hair: { style: 'fluffy', color: '#6b4a30' }, top: { type: 'tee', color: '#3a3d44' } }),
  vg5: guard('vg5', 'צלף', { skin: '#c49a74', height: 1.03, hair: { style: 'crop', color: '#1a1410' }, top: { type: 'tee', color: '#2b2e35' } }),
  vg6: guard('vg6', 'צלף', { skin: '#d2a67f', height: 1.01, hair: { style: 'buzz', color: '#2a1d14' }, facial: { beard: 'short', color: '#2a1d14' }, top: { type: 'tee', color: '#2b2e35' } }),
  vg7: guard('vg7', 'שומר', { skin: '#bf8c66', height: 1.04, build: { shoulders: 1.06 }, hair: { style: 'crop', color: '#15100d' }, top: { type: 'tee', color: '#3a3d44' } }),
  vg8: guard('vg8', 'שומר', { skin: '#e4c09e', height: 0.99, hair: { style: 'messy', color: '#5a3f2a' }, top: { type: 'tee', color: '#3a3d44' } }),
  vg9: guard('vg9', 'שומר', { skin: '#caa07a', height: 1.02, hair: { style: 'buzz', color: '#1c1613' }, facial: { beard: 'stubble', mustache: true, color: '#1c1613' }, top: { type: 'tee', color: '#3a3d44' } }),
  // Kotzi's people (chapter seven): the Porcupines' green
  kg1: guard('kg1', 'שומר', { skin: '#c8956f', height: 1.03, hair: { style: 'buzz', color: '#1a1410' }, facial: { beard: 'short', color: '#1a1410' }, top: { type: 'tee', color: '#2f4a3a', print: 'spikes', printColor: '#e9d27a' } }),
  kg2: guard('kg2', 'שומר', { skin: '#dcb08b', height: 0.99, hair: { style: 'crop', color: '#4a3322' }, top: { type: 'tee', color: '#2f4a3a', print: 'spikes', printColor: '#e9d27a' } }),
  kg3: guard('kg3', 'שומר', { skin: '#b17d58', height: 1.05, hair: { style: 'buzz', color: '#100c0a' }, facial: { beard: 'stubble', color: '#100c0a' }, top: { type: 'tee', color: '#2f4a3a', print: 'spikes', printColor: '#e9d27a' } }),
  kg4: guard('kg4', 'שומר', { skin: '#e0b894', height: 0.98, hair: { style: 'fluffy', color: '#6b4a30' }, top: { type: 'tee', color: '#2f4a3a', print: 'spikes', printColor: '#e9d27a' } }),
  kg5: guard('kg5', 'שומר', { skin: '#caa07a', height: 1.02, hair: { style: 'messy', color: '#5a3f2a' }, facial: { beard: 'short', mustache: true, color: '#5a3f2a' }, top: { type: 'tee', color: '#2f4a3a', print: 'spikes', printColor: '#e9d27a' } }),
  kg6: guard('kg6', 'שומר', { skin: '#bf8c66', height: 1.04, hair: { style: 'crop', color: '#15100d' }, top: { type: 'tee', color: '#2f4a3a', print: 'spikes', printColor: '#e9d27a' } }),
  kg7: guard('kg7', 'שומר', { skin: '#e4c09e', height: 1.0, hair: { style: 'buzz', color: '#2a1d14' }, top: { type: 'tee', color: '#2f4a3a', print: 'spikes', printColor: '#e9d27a' } }),
  kg8: guard('kg8', 'שומר', { skin: '#c49a74', height: 1.03, hair: { style: 'crop', color: '#1a1410' }, facial: { beard: 'stubble', color: '#1a1410' }, top: { type: 'tee', color: '#2f4a3a', print: 'spikes', printColor: '#e9d27a' } }),
  guard4: guard('guard4', 'שומר', { skin: '#e0b894', height: 0.98, hair: { style: 'fluffy', color: '#6b4a30' } }),
  // chapter eight: the people of the Iron Base, the bridge and the headquarters
  fg1: guard('fg1', 'שומר', { skin: '#c8956f', height: 0.99, hair: { style: 'buzz', color: '#1a1410' }, facial: { beard: 'stubble', color: '#1a1410' } }),
  fg2: guard('fg2', 'שומר', { skin: '#dcb08b', height: 1.01, hair: { style: 'crop', color: '#1a1410' }, facial: { beard: null, color: '#1a1410' } }),
  fg3: guard('fg3', 'שומר', { skin: '#b17d58', height: 1.03, hair: { style: 'buzz', color: '#1a1410' }, facial: { beard: 'short', color: '#1a1410' } }),
  fg4: guard('fg4', 'שומר', { skin: '#e0b89a', height: 1.05, hair: { style: 'crop', color: '#1a1410' }, facial: { beard: 'stubble', color: '#1a1410' } }),
  fg5: guard('fg5', 'שומר', { skin: '#a86b4a', height: 0.97, hair: { style: 'buzz', color: '#1a1410' }, facial: { beard: null, color: '#1a1410' } }),
  fg6: guard('fg6', 'שומר', { skin: '#d4a07c', height: 0.99, hair: { style: 'crop', color: '#1a1410' }, facial: { beard: 'short', color: '#1a1410' } }),
  fg7: guard('fg7', 'שומר', { skin: '#c08a63', height: 1.01, hair: { style: 'buzz', color: '#1a1410' }, facial: { beard: 'stubble', color: '#1a1410' } }),
  fg8: guard('fg8', 'שומר', { skin: '#e8c3a4', height: 1.03, hair: { style: 'crop', color: '#1a1410' }, facial: { beard: null, color: '#1a1410' } }),
  fg9: guard('fg9', 'שומר', { skin: '#9d6a48', height: 1.05, hair: { style: 'buzz', color: '#1a1410' }, facial: { beard: 'short', color: '#1a1410' } }),
  fg10: guard('fg10', 'שומר', { skin: '#d9ab86', height: 0.97, hair: { style: 'crop', color: '#1a1410' }, facial: { beard: 'stubble', color: '#1a1410' } }),
  fg11: guard('fg11', 'שומר', { skin: '#b98a67', height: 0.99, hair: { style: 'buzz', color: '#1a1410' }, facial: { beard: null, color: '#1a1410' } }),
  fg12: guard('fg12', 'שומר', { skin: '#cfa27e', height: 1.01, hair: { style: 'crop', color: '#1a1410' }, facial: { beard: 'short', color: '#1a1410' } }),
  ...ORDER,
};

// Dolev's cousin, who runs a falafel truck by the beach (invented for the game)
export const COUSIN = {
  id: 'nissim', name: 'ניסים', skin: '#c08b66', height: 0.99, build: { shoulders: 1.04 },
  hair: { style: 'buzz', color: '#3a2a1d' }, brows: 1.2, facial: { beard: 'short', mustache: true, color: '#2a1d15' },
  top: { type: 'tee', color: '#f2f0ea', print: 'lines', printColor: '#c8352d' },
  bottom: { type: 'pants', color: '#3b4d6b' }, shoes: { type: 'sneakers', color: '#1e1f22', sole: '#d9d6cf', accent: '#c8352d' },
};

const SKIN = ['#e3b994', '#d6a882', '#c99a76', '#bb8a64', '#a8754f', '#8d5f3e', '#6e4a31'];
const HAIR = ['#14100d', '#2a1d15', '#4a3322', '#7a5434', '#9b7b55', '#8e8a85', '#cfccc6'];
const STYLES = ['buzz', 'crop', 'crop', 'fluffy', 'curly'];
const COLORS = ['#f2f0ea', '#16171a', '#8d9096', '#2f5e8f', '#a33a32', '#d9a441', '#567a52', '#b7c4d6', '#6b4f7a', '#e6d3b3'];
const BOTTOMS = [['jeans', 'pants', '#3b4d6b'], ['pants', 'pants', '#5b5a45'], ['joggers', 'joggers', '#2a2b2f'], ['shorts', 'shorts', '#7c8a74'], ['shorts', 'shorts', '#c9b48a'], ['pants', 'pants', '#2a2c31']];
const pick = (r, list) => list[Math.floor(r() * list.length)];

// someone on the street: the same seed always gives the same person
export function passerBy(seed) {
  const r = rng(seed * 7919 + 17);
  const old = r() < 0.2, [, type, bottomColor] = pick(r, BOTTOMS), top = pick(r, ['tee', 'tee', 'oversized', 'zip']);
  const facial = r() < 0.35 ? { beard: pick(r, ['stubble', 'short']), mustache: r() < 0.3, color: pick(r, HAIR.slice(0, 4)) } : undefined;
  return {
    id: `passer-${seed}`, name: 'עובר אורח', passerBy: true,
    skin: pick(r, SKIN), height: 0.94 + r() * 0.1, build: { shoulders: 0.95 + r() * 0.12 },
    hair: { style: pick(r, STYLES), color: old ? pick(r, HAIR.slice(5)) : pick(r, HAIR.slice(0, 5)) },
    brows: 0.9 + r() * 0.4, facial,
    top: { type: top, color: pick(r, COLORS), print: r() < 0.3 ? pick(r, ['lines', 'dots', 'ring', 'tag']) : undefined, printColor: '#f2efe8' },
    bottom: { type, color: bottomColor },
    shoes: { type: type === 'shorts' && r() < 0.5 ? 'slides' : 'sneakers', color: pick(r, ['#f1f1ee', '#1e1f22', '#8a7a66']), sole: '#d9d6cf', accent: '#26272a' },
    watch: r() < 0.3,
  };
}
