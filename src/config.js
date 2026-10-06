// ============================================================================
//  הסנוקר של גפן — game configuration. Tweak numbers here.
// ============================================================================

const params = new URLSearchParams(location.search);

export const DEV = {
  enabled: params.has('dev'),
  // ?speed=20 makes time pass 20x faster (testing only)
  speed: Math.max(0.1, parseFloat(params.get('speed') || '1')),
  // ?scene=night&night=3 jumps straight into a night
  scene: params.get('scene') || null,
  night: parseInt(params.get('night') || '0', 10) || null,
  god: params.has('god'),
  // ?capfps=24 renders at most 24 frames per second (used to record the trailer)
  capFps: parseFloat(params.get('capfps') || '0') || 0,
};

export const TIME = {
  secondsPerHour: 90, // "כל שעה זה דקה וחצי"
  hours: 6, //            00:00 → 06:00
};

export const NIGHTS = 5;

// Power drain in % per second: base * usage + passive[night]
export const POWER = {
  base: 0.072,
  passive: [0, 0, 0.012, 0.02, 0.028, 0.036],
  doorBangCost: [0, 1, 2, 3, 4, 5], // Gefen banging on a closed door (× successive bangs)
};

// AI levels 0-20 (FNAF style: every tick roll 1-20, move if roll <= level)
export const AI = {
  //        night: 1   2   3   4   5
  gefen:  [0, 3,  7,  9, 12, 15],
  cap:    [0, 0,  3,  6,  9, 12],
  smiler: [0, 0,  3,  6,  9, 12],
  // extra levels gained at those hours (index = hour)
  hourBonus: { 2: 1, 3: 1, 4: 1 },
  tick: { gefen: 5.0, cap: 4.97, smiler: 4.98 },
  // seconds Gefen needs to reach a door once he left the table
  gefenRun: [0, 7, 6, 5, 4.2, 3.6],
};

export const CHARACTERS = {
  gefen: { name: 'גפן', title: 'גפן התותח' },
  cap: { name: 'בעל הבקבוק' }, //   the guy with the cap and the red bottle
  smiler: { name: 'החייכן' }, //    the smiling guy from the poster
  duo: { name: 'צמד הבקבוק האדום' },
  yahali: { name: 'יהלי' },
  maayan: { name: 'מעיין' },
};

// Cameras. x/y/w/h are positions on the map (0-100 x 0-80 box).
export const CAMS = [
  { id: 'main', label: '1', name: 'האולם הראשי', map: [30, 4, 40, 22] },
  { id: 'bar', label: '2', name: 'הבר', map: [4, 4, 24, 22] },
  { id: 'vip', label: '3', name: 'חדר VIP', map: [72, 4, 24, 22] },
  { id: 'storage', label: '4', name: 'המחסן', map: [4, 28, 20, 16] },
  { id: 'restroom', label: '5', name: 'שירותים', map: [76, 28, 20, 16] },
  { id: 'hallL', label: '6A', name: 'מסדרון שמאלי', map: [26, 28, 10, 30] },
  { id: 'cornerL', label: '6B', name: 'פינה שמאלית', map: [26, 60, 10, 12] },
  { id: 'hallR', label: '7A', name: 'מסדרון ימני', map: [64, 28, 10, 30] },
  { id: 'cornerR', label: '7B', name: 'פינה ימנית', map: [64, 60, 10, 12] },
];
export const OFFICE_MAP = [38, 60, 24, 16];

// Movement graphs for the two possessed guys
export const PATHS = {
  cap: {
    side: 'left',
    start: 'bar',
    next: {
      bar: ['storage', 'storage', 'main'],
      main: ['storage', 'hallL'],
      storage: ['hallL', 'hallL', 'cornerL'],
      hallL: ['cornerL', 'cornerL', 'storage'],
      cornerL: ['door'],
    },
    retreat: ['hallL', 'storage', 'bar'],
  },
  smiler: {
    side: 'right',
    start: 'bar',
    next: {
      bar: ['main', 'vip'],
      main: ['restroom', 'vip'],
      vip: ['restroom', 'restroom', 'hallR'],
      restroom: ['hallR', 'hallR', 'cornerR'],
      hallR: ['cornerR', 'cornerR', 'restroom'],
      cornerR: ['door'],
    },
    retreat: ['hallR', 'restroom', 'vip'],
  },
};

export const SAVE_KEY = 'gefen-snooker-save-v1';
