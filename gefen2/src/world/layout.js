// ============================================================================
//  The complex: rooms, doors, cameras, standing spots.  Units: metres.
//  x = east, z = south (the office is at the south end and looks north, -z).
//  Rooms never share a wall: neighbours are separated by a 0.3 m gap.
// ============================================================================

export const WALL = 0.3;

/** rect = [x0, z0, x1, z1] */
export const ROOMS = {
  office:   { name: 'חדר האבטחה', rect: [-3.2, -2.6, 3.2, 2.6], h: 2.9, y: 0 },
  corr:     { name: 'המסדרון הראשי', cam: 9, rect: [-1.5, -20.9, 1.5, -2.9], h: 2.9, y: 0 },
  storage:  { name: 'המחסן', cam: 5, rect: [-9.8, -11.5, -1.8, -5.5], h: 2.9, y: 0 },
  lobby:    { name: 'הכניסה', cam: 4, rect: [1.8, -12.5, 9.8, -5.5], h: 3.1, y: 0 },
  wc:       { name: 'השירותים', cam: 8, rect: [-7.8, -19.5, -1.8, -13.5], h: 2.8, y: 0 },
  elec:     { name: 'חדר החשמל', cam: 6, rect: [1.8, -19.5, 7.8, -14.0], h: 2.8, y: 0 },
  hall:     { name: 'האולם הראשי', cam: 1, rect: [-9, -35.2, 9, -21.2], h: 3.6, y: 0 },
  bar:      { name: 'הבר', cam: 2, rect: [-17.3, -31, -9.3, -23], h: 3.1, y: 0 },
  arcade:   { name: 'חדר המשחקים', cam: 7, rect: [9.3, -31, 17.3, -23], h: 3.1, y: 0 },
  vip:      { name: 'חדר VIP', cam: 3, rect: [-8, -42.5, -1, -35.5], h: 3.0, y: 0 },
  stairs:   { name: 'המדרגות', rect: [3.5, -43.5, 6.5, -35.5], h: 3.0, y: 0, ramp: { z0: -36.6, z1: -43.0, y1: -3 } },
  basement: { name: 'המרתף', cam: 12, rect: [-2, -56, 12, -43.8], h: 3.0, y: -3 },
  outside:  { name: 'בחוץ', rect: [10.1, -13, 17, -5], h: 6, y: 0, open: true },
};

/** Vent ducts (not walkable). Each is two boxes: A runs north-south, B east-west into the office. */
export const VENTS = {
  ventL: { name: 'פיר אוורור שמאלי', cam: 10, side: -1, y0: 0.45, y1: 1.25,
    a: [-9.3, -5.5, -8.4, 0.65], b: [-9.3, -0.25, -3.2, 0.65], from: 'storage' },
  ventR: { name: 'פיר אוורור ימני', cam: 11, side: 1, y0: 0.45, y1: 1.25,
    a: [8.4, -5.5, 9.3, 0.65], b: [3.2, -0.25, 9.3, 0.65], from: 'lobby' },
};

/**
 * Doors: openings in the gap between two rooms.
 * axis 'x' = the wall runs along x (rooms are north/south of each other), `c` is the x of the centre.
 * axis 'z' = the wall runs along z (rooms are west/east of each other), `c` is the z of the centre.
 * `at` is the middle of the gap on the other axis.
 */
export const DOORS = {
  front:    { a: 'office', b: 'corr', axis: 'x', at: -2.75, c: 0, w: 3.0, h: 2.5 },
  storage:  { a: 'corr', b: 'storage', axis: 'z', at: -1.65, c: -8.5, w: 1.2, h: 2.2, lock: false },
  lobby:    { a: 'corr', b: 'lobby', axis: 'z', at: 1.65, c: -9.0, w: 1.7, h: 2.3 },
  wc:       { a: 'corr', b: 'wc', axis: 'z', at: -1.65, c: -16.5, w: 1.05, h: 2.15 },
  elec:     { a: 'corr', b: 'elec', axis: 'z', at: 1.65, c: -16.75, w: 1.05, h: 2.15 },
  hall:     { a: 'corr', b: 'hall', axis: 'x', at: -21.05, c: 0, w: 2.6, h: 2.6 },
  bar:      { a: 'hall', b: 'bar', axis: 'z', at: -9.15, c: -27, w: 2.0, h: 2.4 },
  arcade:   { a: 'hall', b: 'arcade', axis: 'z', at: 9.15, c: -27, w: 2.0, h: 2.4 },
  vip:      { a: 'hall', b: 'vip', axis: 'x', at: -35.35, c: -4.5, w: 1.4, h: 2.25, lock: false },
  cellar:   { a: 'hall', b: 'stairs', axis: 'x', at: -35.35, c: 5, w: 1.2, h: 2.15, lock: true },
  basement: { a: 'stairs', b: 'basement', axis: 'x', at: -43.65, c: 5, w: 1.6, h: 2.3, y: -3 },
  entrance: { a: 'lobby', b: 'outside', axis: 'z', at: 9.95, c: -9, w: 2.0, h: 2.4, lock: true, glass: true },
};

/** Which rooms are drawn when the viewer stands in a room (hand made potential visibility set). */
export const SEES = {
  office: ['office', 'corr', 'ventL', 'ventR', 'hall'],
  corr: ['corr', 'office', 'hall', 'storage', 'lobby', 'wc', 'elec'],
  storage: ['storage', 'corr', 'lobby', 'ventL'],
  lobby: ['lobby', 'corr', 'storage', 'outside', 'ventR'],
  wc: ['wc', 'corr', 'elec'],
  elec: ['elec', 'corr', 'wc'],
  hall: ['hall', 'corr', 'bar', 'arcade', 'vip', 'stairs'],
  bar: ['bar', 'hall', 'arcade'],
  arcade: ['arcade', 'hall', 'bar'],
  vip: ['vip', 'hall'],
  stairs: ['stairs', 'hall', 'basement'],
  basement: ['basement', 'stairs'],
  outside: ['outside', 'lobby', 'corr'],
  ventL: ['ventL', 'office', 'storage'],
  ventR: ['ventR', 'office', 'lobby'],
};

/** Security cameras: id, room, eye position, look-at point, field of view. */
export const CAMS = [
  { n: 1, room: 'hall', pos: [8.3, 3.2, -21.9], look: [-2.5, 0.7, -29.5], fov: 78 },
  { n: 2, room: 'bar', pos: [-9.9, 2.8, -23.5], look: [-14.2, 0.8, -28], fov: 80 },
  { n: 3, room: 'vip', pos: [-1.5, 2.7, -36.0], look: [-5.6, 0.7, -40.2], fov: 80 },
  { n: 4, room: 'lobby', pos: [2.4, 2.8, -12.0], look: [8.2, 0.8, -8.3], fov: 80 },
  { n: 5, room: 'storage', pos: [-2.3, 2.6, -6.0], look: [-7.2, 0.7, -9.6], fov: 82 },
  { n: 6, room: 'elec', pos: [2.3, 2.5, -14.5], look: [6.2, 0.9, -18.2], fov: 82 },
  { n: 7, room: 'arcade', pos: [9.9, 2.8, -23.5], look: [14.2, 0.8, -28], fov: 80 },
  { n: 8, room: 'wc', pos: [-2.3, 2.5, -14.0], look: [-6.2, 0.7, -17.8], fov: 84 },
  { n: 9, room: 'corr', pos: [1.15, 2.6, -20.5], look: [-0.2, 0.9, -9], fov: 62 },
  { n: 10, room: 'ventL', pos: [-3.75, 0.98, 0.2], look: [-9, 0.8, 0.2], fov: 88 },
  { n: 11, room: 'ventR', pos: [3.75, 0.98, 0.2], look: [9, 0.8, 0.2], fov: 88 },
  { n: 12, room: 'basement', pos: [11.3, -0.45, -44.5], look: [4, -2.3, -51], fov: 80 },
];

/** Map drawing data for the tablet (rooms in map space are derived from ROOMS; this is the button anchor). */
export const CAM_BY_ROOM = Object.fromEntries(CAMS.map((c) => [c.room, c]));

/** Named standing spots: [x, z, facing yaw (radians, 0 = looks south/+z), room] */
export const SPOTS = {
  // Gefen
  g_hall_a: [-1.2, -29.6, 0, 'hall'],
  g_hall_b: [2.2, -25.4, 0, 'hall'],
  g_hall_c: [0.0, -22.4, 0, 'hall'],
  g_corr_far: [0.35, -18.2, 0, 'corr'],
  g_corr_mid: [-0.35, -12.4, 0, 'corr'],
  g_corr_near: [0.25, -7.0, 0, 'corr'],
  g_front: [0.0, -3.7, 0, 'corr'],
  // Dolev
  d_home: [5.9, -18.0, 0, 'elec'],
  d_door: [3.0, -16.75, 0, 'elec'],
  d_corr_far: [0.85, -15.6, 0, 'corr'],
  d_corr_mid: [0.9, -10.9, 0, 'corr'],
  d_corr_near: [0.95, -6.0, 0, 'corr'],
  d_front: [1.05, -3.8, 0, 'corr'],
  // Ido
  i_home: [14.4, -28.3, 0, 'arcade'],
  i_hall: [6.5, -26.6, 0, 'hall'],
  i_storage: [-8.6, -6.7, 0, 'storage'],
  i_lobby: [8.6, -6.6, 0, 'lobby'],
  i_ventL_far: [-8.85, -3.2, 0, 'ventL'],
  i_ventL_mid: [-7.6, 0.2, 0, 'ventL'],
  i_ventL_mouth: [-3.62, 0.2, 0, 'ventL'],
  i_ventR_far: [8.85, -3.2, 0, 'ventR'],
  i_ventR_mid: [7.6, 0.2, 0, 'ventR'],
  i_ventR_mouth: [3.62, 0.2, 0, 'ventR'],
  // allies in the office
  yahali_seat: [-2.1, 1.75, 0, 'office'],
  maayan_post: [2.35, 1.35, 0, 'office'],
  cap_post: [-2.3, -1.5, 0, 'office'],
  smiler_post: [2.4, -1.3, 0, 'office'],
  // story spots
  duo_bar_a: [-12.8, -27.6, 0, 'bar'],
  duo_bar_b: [-11.9, -26.9, 0, 'bar'],
  duo_hall_a: [-3.6, -28.2, 0, 'hall'],
  duo_hall_b: [-2.9, -27.4, 0, 'hall'],
  duo_storage_a: [-7.0, -9.6, 0, 'storage'],
  duo_storage_b: [-6.1, -10.2, 0, 'storage'],
  cap_trapped: [-8.3, -10.4, 0, 'storage'],
  smiler_trapped: [-5.2, -40.8, 0, 'vip'],
  entrance_out_a: [11.0, -9.4, 0, 'outside'],
  entrance_out_b: [11.0, -8.5, 0, 'outside'],
  lobby_in_a: [7.6, -9.4, 0, 'lobby'],
  lobby_in_b: [7.6, -8.5, 0, 'lobby'],
};

/** Player anchor points */
export const PLAYER = {
  seat: { x: 0, z: 1.35, eye: 1.22 },
  eyeStand: 1.62,
  start_hall: { x: 0.4, z: -23.6, yaw: 0 }, // opening: just inside the hall
  office_stand: { x: 0, z: -1.2 },
};

/** Interaction points used by missions: [x, z, room] */
export const POINTS = {
  breaker: [7.55, -16.6, 'elec'],
  entrance_panel: [9.55, -6.4, 'lobby'],
  entrance_door: [9.6, -9, 'lobby'],
  bar_key: [-15.6, -24.2, 'bar'],
  storage_door: [-1.4, -8.5, 'corr'],
  arcade_note: [16.6, -24.6, 'arcade'],
  vip_keypad: [-3.4, -34.9, 'hall'],
  cellar_door: [5, -34.9, 'hall'],
  generator: [-0.6, -53.6, 'basement'],
  altar: [5.5, -51.2, 'basement'],
  fuse_storage: [-9.5, -8.4, 'storage'],
  fuse_arcade: [17.0, -29.4, 'arcade'],
  fuse_wc: [-7.5, -16.6, 'wc'],
  cursed_table: [0, -28.2, 'hall'],
  ball_yellow: [-15.4, -29.6, 'bar'],
  ball_green: [15.6, -24.4, 'arcade'],
  ball_brown: [-6.4, -41.4, 'vip'],
  ball_blue: [-8.9, -6.4, 'storage'],
  ball_pink: [-6.8, -18.6, 'wc'],
  exit: [11.4, -9, 'outside'],
  office_console: [0, 0.2, 'office'],
};

export const WORLD_BOUNDS = { x0: -18.5, z0: -57, x1: 18.5, z1: 3.5 };

export function roomAt(x, z) {
  for (const id in ROOMS) {
    const r = ROOMS[id].rect;
    if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return id;
  }
  // inside a door gap: attribute to the nearer room
  for (const id in DOORS) {
    const d = DOORS[id];
    const half = d.w / 2;
    const inside = d.axis === 'x'
      ? Math.abs(x - d.c) <= half && Math.abs(z - d.at) <= WALL
      : Math.abs(z - d.c) <= half && Math.abs(x - d.at) <= WALL;
    if (inside) return d.a;
  }
  return null;
}

/** Floor height at a point (stairs ramp down to the basement). */
export function floorY(x, z) {
  const st = ROOMS.stairs;
  const r = st.rect;
  if (x >= r[0] - 0.2 && x <= r[2] + 0.2 && z <= r[3] + 0.2 && z >= r[1] - 0.4) {
    const { z0, z1, y1 } = st.ramp;
    if (z >= z0) return 0;
    if (z <= z1) return y1;
    return (y1 * (z0 - z)) / (z0 - z1);
  }
  const b = ROOMS.basement.rect;
  if (x >= b[0] - 0.2 && x <= b[2] + 0.2 && z >= b[1] - 0.2 && z <= b[3] + 0.2) return ROOMS.basement.y;
  return 0;
}
