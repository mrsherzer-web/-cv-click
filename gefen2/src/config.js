// ============================================================================
//  GEFEN 2 – tuning constants
// ============================================================================
const q = new URLSearchParams(location.search);

export const DEV = {
  on: q.has('dev'),
  night: q.has('night') ? +q.get('night') : null,
  stage: q.has('stage') ? +q.get('stage') : 0,
  scene: q.get('scene'),
  speed: q.has('speed') ? +q.get('speed') : 1,
  god: q.has('god'),
  mute: q.has('mute'),
  bot: q.has('bot'),
  capFps: q.has('capfps') ? +q.get('capfps') : 0,
  noVideo: q.has('novideo'),
  noRender: q.has('norender'),
  quality: q.has('q') ? +q.get('q') : null,
};

export const NIGHTS = 6;
export const SAVE_KEY = 'gefen2-save-v1';

export const TIME = { secondsPerHour: 60, hours: 6 };

export const NIGHT_TITLES = [
  '',
  'הוא עדיין כאן',
  'החברים בדרך',
  'החברים שהשתנו',
  'משימת החילוץ',
  'החשמל נופל',
  'THE FINAL NIGHT',
];

/** Office AI. Index = night (1..6). */
export const AI = {
  gefen: {
    level: [0, 5, 8, 10, 12, 14, 17],
    tick: 4.8,
    lightTime: [0, 0.9, 1.0, 1.15, 1.25, 1.4, 1.7], // seconds of light needed to push him back
    frontDelay: [0, 9.5, 8.5, 7.5, 7, 6.5, 5.5], // seconds at the office front before he strikes
  },
  ido: {
    level: [0, 0, 0, 8, 10, 12, 15],
    tick: 4.4,
    mouthDelay: [0, 0, 0, 6, 5.5, 5, 4.5],
    maskHold: 1.5,
  },
  dolev: {
    level: [0, 0, 0, 7, 9, 11, 14],
    tick: 8.5, // sabotage roll
    advance: [0, 0, 0, 7.5, 6.5, 5.5, 4.8], // seconds per station while something is broken
    retreat: 9,
    frontDelay: [0, 0, 0, 8, 7.5, 7, 6],
  },
};

export const POWER = {
  passive: [0, 0.055, 0.065, 0.075, 0.085, 0.095, 0.105], // % per second
  tablet: 0.2,
  ventLight: 0.28,
  lure: 2.2, // % per use
  reboot: 0.2, // % per second while rebooting
  floor: 38, // a stage never starts with less than this
  sabotage: 3, // multiplier on passive+usage while the grid is sabotaged
  killCost: 3,
  killTime: 5,
  rebootTime: 4.5,
  maayanDelay: 4,
  maayanTime: 9,
};

export const FLASH = {
  seatDrain: 1.25, // % per second
  walkDrain: 0.62,
  dolevDrain: 4,
  angle: 0.4,
  intensity: 105,
  range: 30,
};

export const PLAYER_CFG = {
  walk: 2.7,
  sprint: 4.7,
  masked: 1.9,
  stamina: 5.5, // seconds of sprint
  staminaRegen: 0.55,
  reach: 1.7,
};

/** First person enemy speeds (m/s) */
export const FP = {
  gefen: { patrol: 1.5, chase: 3.95, see: 9, seeLit: 17, lose: 5, stun: 2.4, stunCooldown: 7, catch: 0.95 },
  gefenFinal: { patrol: 1.9, chase: 4.25, see: 11, seeLit: 20, lose: 7, stun: 1.2, stunCooldown: 9, catch: 1.0 },
  ido: { speed: 4.3, catch: 0.9, sense: 16 },
  dolev: { speed: 1.9, lunge: 3.6, catch: 0.95, hear: 11, drain: 5 },
};

export const CHAR = {
  gefen: { name: 'גפן', eye: [1.0, 0.1, 0.05] },
  ido: { name: 'עידו', eye: [1.0, 0.62, 0.08] },
  dolev: { name: 'דולב', eye: [0.25, 0.65, 1.0] },
  yahali: { name: 'יהלי' },
  maayan: { name: 'מעיין' },
  cap: { name: 'בעל הבקבוק' },
  smiler: { name: 'החייכן' },
};
