// Poses as joint angles in radians, layered over walking and running. Channels: 'hips.y' (meters, added
// to the hip height) and '<joint>.<rx|ry|rz>' for chest, head, shL, elL, shR, elR, hipL, kneeL, ankL,
// hipR, kneeR, ankR. L is the character's left (+x), R the right. Shoulder rx < 0 raises the arm forward,
// elbow rx < 0 bends it, hip rx < 0 swings the leg forward, knee rx > 0 bends it, chest ry < 0 turns the
// left shoulder forward.

// held poses: stay until replaced or cleared
export const POSES = {
  guard: { // elbows in, fists up by the chin, left shoulder leading
    'hips.y': -0.04, 'chest.rx': 0.1, 'chest.ry': -0.3, 'head.ry': 0.25, 'head.rx': 0.05,
    'shL.rx': -0.6, 'shL.rz': -0.06, 'elL.rx': -2.15, 'shR.rx': -0.45, 'shR.rz': 0.08, 'elR.rx': -2.35,
  },
  block: { // forearms up in front of the face, chin down
    'hips.y': -0.07, 'chest.rx': 0.2, 'head.rx': 0.25,
    'shL.rx': -0.85, 'shL.rz': -0.3, 'elL.rx': -2.25, 'shR.rx': -0.85, 'shR.rz': 0.3, 'elR.rx': -2.25,
    'hipL.rx': -0.25, 'kneeL.rx': 0.35, 'hipR.rx': -0.1, 'kneeR.rx': 0.3,
  },
  sit: { // on a bench or a seat
    'hips.y': -0.47, 'chest.rx': -0.05, 'hipL.rx': -1.5, 'hipR.rx': -1.5, 'kneeL.rx': 1.5, 'kneeR.rx': 1.5,
    'shL.rx': -0.45, 'elL.rx': -0.7, 'shR.rx': -0.45, 'elR.rx': -0.7,
  },
  down: { // out of the fight: sitting on the ground, leaning back on the hands
    'hips.y': -0.66, 'chest.rx': -0.45, 'head.rx': 0.35,
    'hipL.rx': -1.35, 'hipR.rx': -1.2, 'kneeL.rx': 0.35, 'kneeR.rx': 0.95, 'ankL.rx': 0.3, 'ankR.rx': 0,
    'shL.rx': 0.6, 'shL.rz': 0.35, 'elL.rx': -0.3, 'shR.rx': 0.6, 'shR.rz': -0.35, 'elR.rx': -0.3,
  },
  phone: { // right hand at the ear
    'shR.rx': -0.65, 'shR.rz': -0.38, 'elR.rx': -2.65, 'head.rz': -0.12,
  },
  cheer: { 'chest.rx': -0.15, 'head.rx': -0.25, 'shL.rx': -2.9, 'shL.rz': 0.35, 'elL.rx': -0.3, 'shR.rx': -2.9, 'shR.rz': -0.35, 'elR.rx': -0.3 },
  arms_crossed: { 'shL.rx': -0.55, 'shL.rz': -0.25, 'elL.rx': -1.75, 'shR.rx': -0.6, 'shR.rz': 0.25, 'elR.rx': -1.7, 'head.rx': -0.05 },
  carry: { // a box held in front with both hands
    'chest.rx': -0.05, 'shL.rx': -0.75, 'shL.rz': -0.12, 'elL.rx': -0.9, 'shR.rx': -0.75, 'shR.rz': 0.12, 'elR.rx': -0.9,
  },
};

// one-shot actions: the pose is reached at `peak` (a fraction of `dur`) and released by the end.
// `hit` marks the moment a punch lands; `wobble` adds a swing: [channel, amplitude, speed].
export const ACTIONS = {
  jab: { dur: 0.32, peak: 0.42, hit: 0.42, pose: { 'chest.ry': -0.55, 'head.ry': 0.4, 'shL.rx': -1.52, 'shL.rz': 0.04, 'elL.rx': -0.12 } },
  cross: { dur: 0.4, peak: 0.45, hit: 0.45, pose: { 'chest.ry': 0.45, 'head.ry': -0.3, 'shR.rx': -1.52, 'shR.rz': -0.04, 'elR.rx': -0.1, 'hipR.rx': 0.18 } },
  hook: { dur: 0.48, peak: 0.5, hit: 0.5, pose: { 'chest.ry': 0.55, 'head.ry': -0.35, 'shL.rx': -1.05, 'shL.rz': 1.25, 'elL.rx': -1.5, 'hips.y': -0.05 } },
  uppercut: { dur: 0.5, peak: 0.5, hit: 0.5, pose: { 'chest.rx': -0.12, 'chest.ry': 0.35, 'shR.rx': -1.1, 'shR.rz': -0.2, 'elR.rx': -2.05, 'hips.y': -0.08, 'kneeL.rx': 0.4, 'kneeR.rx': 0.4 } },
  windup: { dur: 0.6, peak: 0.8, pose: { 'chest.ry': -0.6, 'head.ry': 0.45, 'shR.rx': 0.4, 'shR.rz': -0.45, 'elR.rx': -2.0, 'hips.y': -0.06 } },
  swing: { dur: 0.42, peak: 0.45, hit: 0.45, pose: { 'chest.ry': 0.6, 'head.ry': -0.3, 'shR.rx': -1.4, 'shR.rz': -0.9, 'elR.rx': -0.9 } },
  hit: { dur: 0.42, peak: 0.25, pose: { 'chest.rx': -0.4, 'head.rx': -0.5, 'shL.rx': 0.35, 'shL.rz': 0.4, 'shR.rx': 0.35, 'shR.rz': -0.4, 'elL.rx': -0.6, 'elR.rx': -0.6, 'hips.y': -0.04 } },
  dodge: { dur: 0.42, peak: 0.35, pose: { 'chest.rx': 0.35, 'chest.rz': 0.3, 'hips.y': -0.15, 'hipL.rx': -0.35, 'hipR.rx': -0.3, 'kneeL.rx': 0.55, 'kneeR.rx': 0.55 } },
  getup: { dur: 1.0, peak: 0, pose: { 'hips.y': -0.66, 'chest.rx': -0.2, 'hipL.rx': -1.35, 'hipR.rx': -1.2, 'kneeL.rx': 0.9, 'kneeR.rx': 1.2, 'shL.rx': 0.4, 'shR.rx': 0.4 } },
  wave: { dur: 1.6, peak: 0.2, pose: { 'shR.rx': -0.35, 'shR.rz': -2.3, 'elR.rx': -0.45 }, wobble: ['elR.rz', 0.35, 11] },
  nod: { dur: 0.7, peak: 0.3, pose: { 'head.rx': 0.25 }, wobble: ['head.rx', 0.12, 14] },
  shrug: { dur: 0.9, peak: 0.4, pose: { 'shL.rz': 0.35, 'shR.rz': -0.35, 'elL.rx': -1.4, 'elR.rx': -1.4, 'shL.rx': -0.3, 'shR.rx': -0.3, 'head.rz': 0.12 } },
  bag: { dur: 0.3, peak: 0.45, hit: 0.45, pose: { 'chest.ry': -0.5, 'shL.rx': -1.45, 'elL.rx': -0.2 } },
};
