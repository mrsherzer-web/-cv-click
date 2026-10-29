// People who are not the main cast, all invented for the game: the rival crew "the Porcupines"
// (הדרבנים) and passers-by made up from a seed. None of them is based on a real person.
import { rng } from '../core/math.js';

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
