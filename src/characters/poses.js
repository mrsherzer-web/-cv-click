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
  aim: { // a paintball marker at the shoulder, both hands on it, the head down the sight
    'chest.ry': -0.35, 'head.ry': 0.2, 'head.rx': 0.12,
    'shR.rx': -1.35, 'shR.rz': -0.1, 'elR.rx': -1.0, 'shL.rx': -1.2, 'shL.rz': 0.5, 'elL.rx': -1.25,
  },
  carry: { // a box held in front with both hands
    'chest.rx': -0.05, 'shL.rx': -0.75, 'shL.rz': -0.12, 'elL.rx': -0.9, 'shR.rx': -0.75, 'shR.rz': 0.12, 'elR.rx': -0.9,
  },
  floored: { // knocked down for a moment: flat on the floor, up on the elbows, legs out (he gets up again)
    'hips.y': -0.8, 'chest.rx': -1.0, 'head.rx': 0.55,
    'hipL.rx': -1.45, 'hipR.rx': -1.35, 'kneeL.rx': 0.12, 'kneeR.rx': 0.4, 'ankL.rx': 0.45, 'ankR.rx': 0.3,
    'shL.rx': 0.85, 'shL.rz': 0.55, 'elL.rx': -0.9, 'shR.rx': 0.85, 'shR.rz': -0.55, 'elR.rx': -0.9,
  },

  // ---------- chapter ten: hurt, helped up, leaps and ledges ----------
  // These use only the channels the walk sets afresh every frame, so anyone can hold them (Nehorai crawling,
  // a friend lying on the grass) and nothing of them is left on the body afterwards.
  prone: { // down on the belly, up on the elbows, the legs out behind, the head up (the crawl rests here)
    'hips.y': -0.84, 'chest.rx': 1.3, 'head.rx': -0.95,
    'shL.rx': -1.83, 'shL.rz': 0.25, 'elL.rx': -1.04, 'shR.rx': -1.83, 'shR.rz': -0.25, 'elR.rx': -1.04,
    'hipL.rx': 1.5, 'hipL.rz': 0.16, 'kneeL.rx': 0.08, 'ankL.rx': 1.3, 'hipR.rx': 1.5, 'hipR.rz': -0.16, 'kneeR.rx': 0.08, 'ankR.rx': 1.3,
  },
  kneel: { // on the right knee beside someone on the floor (he is at the right), bent over him, the right arm down to him
    'hips.y': -0.4, 'chest.rx': 0.45, 'head.rx': 0.2,
    'hipR.rx': 0.15, 'kneeR.rx': 1.42, 'ankR.rx': 1.0, 'hipL.rx': -1.45, 'kneeL.rx': 1.45,
    'shR.rx': -0.8, 'shR.rz': -0.15, 'elR.rx': -0.25, 'shL.rx': -0.9, 'shL.rz': 0.05, 'elL.rx': -0.6,
  },
  helped: { // half way up with a friend's help: on both knees, the left arm up over his shoulders
    'hips.y': -0.4, 'chest.rx': 0.4, 'head.rx': 0.25,
    'hipL.rx': 0.1, 'kneeL.rx': 1.47, 'ankL.rx': 1.0, 'hipR.rx': 0.1, 'kneeR.rx': 1.47, 'ankR.rx': 1.0,
    'shL.rx': -0.25, 'shL.rz': 1.45, 'elL.rx': -0.55, 'shR.rx': -0.55, 'shR.rz': -0.1, 'elR.rx': -0.85,
  },
  halfup: { // the next moment: the left foot planted, the right knee still down, the arm still over the friend
    'hips.y': -0.37, 'chest.rx': 0.32, 'head.rx': 0.15,
    'hipL.rx': -1.4, 'kneeL.rx': 1.48, 'hipR.rx': 0.15, 'kneeR.rx': 1.42, 'ankR.rx': 1.0,
    'shL.rx': -0.25, 'shL.rz': 1.45, 'elL.rx': -0.55, 'shR.rx': -0.6, 'shR.rz': -0.1, 'elR.rx': -0.9,
  },
  lean: { // on his feet but hurt: leaning on the friend at his left, the left arm over his shoulders, the right hand on the ribs
    'hips.y': -0.03, 'chest.rx': 0.24, 'chest.rz': -0.1, 'head.rx': 0.2,
    'shL.rx': -0.2, 'shL.rz': 1.4, 'elL.rx': -0.5, 'shR.rx': -0.45, 'shR.rz': 0.3, 'elR.rx': -1.75,
    'hipL.rx': -0.08, 'kneeL.rx': 0.2, 'ankL.rx': -0.1, 'hipR.rx': -0.12, 'kneeR.rx': 0.28, 'ankR.rx': -0.14,
  },
  support: { // holding up the friend at his right: the right arm round his back, the head turned to him
    'hips.y': -0.03, 'chest.rz': 0.08, 'head.ry': -0.35, 'head.rx': 0.1,
    'shR.rx': 0.25, 'shR.rz': -1.0, 'elR.rx': -0.6, 'shL.rx': -0.3, 'elL.rx': -0.5,
    'hipL.rx': -0.1, 'kneeL.rx': 0.22, 'ankL.rx': -0.1, 'hipR.rx': -0.06, 'kneeR.rx': 0.16, 'ankR.rx': -0.08,
  },
  hang: { // both hands up on a ledge, the body hanging straight under them, looking up
    'chest.rx': -0.06, 'head.rx': -0.4,
    'shL.rx': -3.0, 'shL.rz': 0.12, 'elL.rx': -0.12, 'shR.rx': -3.0, 'shR.rz': -0.12, 'elR.rx': -0.12,
    'hipL.rx': -0.1, 'kneeL.rx': 0.25, 'ankL.rx': 0.3, 'hipR.rx': 0.05, 'kneeR.rx': 0.15, 'ankR.rx': 0.3,
  },
  mantle: { // over the edge: the arms pushing down beside the body, the chest across the ledge, the left knee coming up
    'hips.y': -0.12, 'chest.rx': 0.55, 'head.rx': -0.3,
    'shL.rx': 0.25, 'shL.rz': 0.4, 'elL.rx': -1.0, 'shR.rx': 0.25, 'shR.rz': -0.4, 'elR.rx': -1.0,
    'hipL.rx': -1.55, 'kneeL.rx': 1.7, 'hipR.rx': 0.25, 'kneeR.rx': 0.35, 'ankR.rx': 0.4,
  },
  crouch: { // gathered for a jump, and landing from one: knees deep, the arms swung back
    'hips.y': -0.31, 'chest.rx': 0.6, 'head.rx': -0.35,
    'hipL.rx': -0.95, 'kneeL.rx': 1.7, 'ankL.rx': -0.75, 'hipR.rx': -0.95, 'kneeR.rx': 1.7, 'ankR.rx': -0.75,
    'shL.rx': 0.7, 'shL.rz': 0.15, 'elL.rx': -0.35, 'shR.rx': 0.7, 'shR.rz': -0.15, 'elR.rx': -0.35,
  },
  tuck: { // in the air over a gap: the arms thrown forward and up, the front knee high, the back leg trailing
    'chest.rx': 0.3, 'head.rx': -0.2,
    'shL.rx': -2.3, 'shL.rz': 0.2, 'elL.rx': -0.45, 'shR.rx': -2.3, 'shR.rz': -0.2, 'elR.rx': -0.45,
    'hipL.rx': -1.15, 'kneeL.rx': 1.35, 'ankL.rx': 0.2, 'hipR.rx': 0.45, 'kneeR.rx': 1.2, 'ankR.rx': 0.5,
  },
  reach: { // on the right knee at an edge, bent far over it, the right hand down to someone below
    'hips.y': -0.4, 'chest.rx': 0.85, 'head.rx': -0.35,
    'hipR.rx': 0.15, 'kneeR.rx': 1.42, 'ankR.rx': 1.0, 'hipL.rx': -1.45, 'kneeL.rx': 1.45,
    'shR.rx': -1.15, 'elR.rx': -0.1, 'shL.rx': -0.6, 'shL.rz': 0.05, 'elL.rx': -0.9,
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
  // the heavy punch: the right fist drawn back with the weight on the back foot (the slow start a sharp
  // opponent can punish), then all of it through the right shoulder with a step in
  heavyload: { dur: 0.26, peak: 0.85, pose: { 'chest.ry': -0.75, 'head.ry': 0.45, 'shR.rx': 0.3, 'shR.rz': -0.4, 'elR.rx': -2.1, 'hips.y': -0.09, 'kneeL.rx': 0.3, 'kneeR.rx': 0.35, 'hipR.rx': 0.15 } },
  heavy: { dur: 0.5, peak: 0.36, hit: 0.36, pose: { 'chest.ry': 0.8, 'chest.rx': 0.18, 'head.ry': -0.35, 'shR.rx': -1.58, 'shR.rz': -0.05, 'elR.rx': -0.05, 'hipL.rx': -0.4, 'kneeL.rx': 0.45, 'hipR.rx': 0.3, 'hips.y': -0.1 } },
  // the shove: both palms into the chest, a short step in
  shove: { dur: 0.36, peak: 0.45, hit: 0.45, pose: { 'chest.rx': 0.22, 'head.rx': 0.1, 'shL.rx': -1.42, 'shL.rz': -0.12, 'elL.rx': -0.4, 'shR.rx': -1.42, 'shR.rz': 0.12, 'elR.rx': -0.4, 'hipL.rx': -0.35, 'kneeL.rx': 0.3, 'hips.y': -0.05 } },
  // staggered by a big hit: thrown back, arms out, a longer recovery than a plain 'hit'
  reel: { dur: 0.75, peak: 0.25, pose: { 'chest.rx': -0.6, 'head.rx': -0.6, 'shL.rx': 0.5, 'shL.rz': 0.75, 'shR.rx': 0.5, 'shR.rz': -0.75, 'elL.rx': -0.4, 'elR.rx': -0.4, 'hips.y': -0.06, 'hipL.rx': 0.25, 'kneeR.rx': 0.35 } },
  // a big man's wind-up (both fists over the head) and the slam that follows it
  bigwindup: { dur: 0.6, peak: 0.85, pose: { 'chest.rx': -0.28, 'head.rx': -0.15, 'shL.rx': -2.75, 'shL.rz': 0.2, 'elL.rx': -0.9, 'shR.rx': -2.75, 'shR.rz': -0.2, 'elR.rx': -0.9, 'hips.y': -0.03 } },
  slam: { dur: 0.5, peak: 0.45, hit: 0.45, pose: { 'chest.rx': 0.5, 'head.rx': 0.2, 'shL.rx': -1.15, 'shL.rz': -0.15, 'elL.rx': -0.45, 'shR.rx': -1.15, 'shR.rz': 0.15, 'elR.rx': -0.45, 'hips.y': -0.14, 'kneeL.rx': 0.4, 'kneeR.rx': 0.4 } },
  // the crawl, over the 'prone' pose: one arm reaches out ahead while the other pulls back under the chest and the
  // opposite leg draws up; the two take turns (PlayerController.crawlCycle)
  crawlL: { dur: 0.7, peak: 0.5, pose: { 'shL.rx': -2.45, 'shL.rz': 0.12, 'elL.rx': -0.4, 'shR.rx': -1.55, 'elR.rx': -1.32, 'kneeR.rx': 0.55, 'hipR.rz': -0.5, 'chest.ry': 0.15, 'chest.rz': -0.08, 'head.ry': -0.12 } },
  crawlR: { dur: 0.7, peak: 0.5, pose: { 'shR.rx': -2.45, 'shR.rz': -0.12, 'elR.rx': -0.4, 'shL.rx': -1.55, 'elL.rx': -1.32, 'kneeL.rx': 0.55, 'hipL.rz': 0.5, 'chest.ry': -0.15, 'chest.rz': 0.08, 'head.ry': 0.12 } },
};
