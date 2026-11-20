'use strict';
/* =====================================================================
   STARRY NIGHTS · core.js
   constants · helpers · storage · the factory map · the cast · the nights · audio
   ===================================================================== */

const T = 3;               // one map tile = 3 m
const WALL_H = 3.2;
const EYE_H = 1.62, CROUCH_EYE = 1.02;
const MW = 31, MH = 24;
let IS_TOUCH = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
const tc = t => (t + 0.5) * T;            // tile -> world centre
const toTile = w => Math.floor(w / T);
const idx = (x, y) => y * MW + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const fmt2 = n => String(n).padStart(2, '0');
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function lerpAngle(a, b, t) { return a - angDiff(a, b) * t; }
const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/* ---------------- storage (per-viewer conveniences only) ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('starry:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('starry:' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const SETTINGS = Object.assign({ volume: 0.8, sens: 1, touchSens: 1, quality: IS_TOUCH ? 'low' : 'med', difficulty: 'normal' }, store.get('settings', {}));
const PROGRESS = Object.assign({ unlocked: 1, done: [], cards: [], won: false, tape: false }, store.get('progress', {}));
const saveSettings = () => store.set('settings', SETTINGS);
const saveProgress = () => store.set('progress', PROGRESS);
const DIFFS = {
  easy:      { name: 'קל',   spd: 0.86, sense: 0.8,  hour: 96 },
  normal:    { name: 'רגיל', spd: 1.0,  sense: 1.0,  hour: 80 },
  nightmare: { name: 'סיוט', spd: 1.14, sense: 1.25, hour: 70 }
};
const diff = () => DIFFS[SETTINGS.difficulty] || DIFFS.normal;

/* ---------------- the factory ---------------- */
const ROOMS = {
  hall:      { name: 'מסדרון',        floor: 'concrete', wall: 'concrete' },
  bottling:  { name: 'אולם הבקבוק',   floor: 'tiles',    wall: 'tile',      at: [6, 2.6] },
  lab:       { name: 'מעבדת טעימות',  floor: 'lino',     wall: 'paint',     at: [15.5, 3.4] },
  warehouse: { name: 'מחסן',          floor: 'metal',    wall: 'brick',     at: [25, 3.4] },
  lockers:   { name: 'לוקרים',        floor: 'tiles',    wall: 'paint',     at: [8.5, 9] },
  party:     { name: 'חדר מנוחה',     floor: 'carpet',   wall: 'wallpaper', at: [23, 9] },
  generator: { name: 'גנרטור',        floor: 'metal',    wall: 'brick',     at: [7, 13.6] },
  cold:      { name: 'חדר קירור',     floor: 'metal',    wall: 'steel',     at: [15.5, 14.5] },
  manager:   { name: 'משרד המנהלת',   floor: 'wood',     wall: 'wallpaper', at: [25, 15.6] },
  office:    { name: 'חדר הביטחון',   floor: 'carpet',   wall: 'paint',     at: [16, 19.2] },
  dock:      { name: 'רציף טעינה',    floor: 'concrete', wall: 'brick',     at: [7, 21.6] },
  showers:   { name: 'מקלחות',        floor: 'tiles',    wall: 'tile',      at: [24.5, 21.5] }
};
const GRID = new Uint8Array(MW * MH);          // 1 = floor
const ROOM_AT = new Array(MW * MH).fill(null);
const BLOCK = new Uint8Array(MW * MH);         // tiles filled by big props (AI avoids)
function carve(x, y, w, h, room) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { GRID[idx(i, j)] = 1; ROOM_AT[idx(i, j)] = room; } }
// corridors: a ring with a spine, so every chase has a loop
carve(2, 6, 28, 1, 'hall'); carve(2, 11, 28, 1, 'hall');
carve(2, 18, 11, 1, 'hall'); carve(19, 18, 11, 1, 'hall');
carve(2, 6, 1, 13, 'hall'); carve(29, 6, 1, 13, 'hall');
carve(15, 7, 2, 4, 'hall'); carve(11, 12, 1, 6, 'hall'); carve(20, 12, 1, 6, 'hall');
// rooms (+ their doorways)
carve(2, 1, 9, 4, 'bottling'); carve(4, 5, 1, 1, 'bottling'); carve(9, 5, 1, 1, 'bottling');
carve(12, 1, 7, 4, 'lab'); carve(15, 5, 1, 1, 'lab');
carve(20, 1, 10, 4, 'warehouse'); carve(22, 5, 1, 1, 'warehouse'); carve(27, 5, 1, 1, 'warehouse');
carve(4, 8, 9, 2, 'lockers'); carve(6, 7, 1, 1, 'lockers'); carve(10, 10, 1, 1, 'lockers');
carve(18, 8, 10, 2, 'party'); carve(20, 7, 1, 1, 'party'); carve(25, 10, 1, 1, 'party');
carve(4, 13, 6, 4, 'generator'); carve(6, 12, 1, 1, 'generator'); carve(10, 15, 1, 1, 'generator');
carve(13, 13, 6, 3, 'cold'); carve(16, 12, 1, 1, 'cold');
carve(22, 13, 6, 4, 'manager'); carve(24, 12, 1, 1, 'manager'); carve(21, 15, 1, 1, 'manager');
carve(14, 17, 4, 3, 'office'); carve(13, 18, 1, 1, 'office'); carve(18, 18, 1, 1, 'office');
carve(2, 20, 9, 3, 'dock'); carve(5, 19, 1, 1, 'dock');
carve(21, 20, 7, 3, 'showers'); carve(24, 19, 1, 1, 'showers');
[[3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [10, 1], [10, 4], [2, 4],
 [13, 2], [14, 2], [16, 2], [17, 2],
 [21, 2], [21, 3], [24, 2], [24, 3], [27, 2], [27, 3],
 [5, 14], [6, 14], [5, 15], [6, 15], [18, 14], [24, 14], [25, 14],
 [14, 17], [15, 17], [16, 17], [17, 17], [2, 21], [3, 21], [2, 22], [3, 22]
].forEach(([x, y]) => BLOCK[idx(x, y)] = 1);

const OFFICE_DOORS = {
  w: { tx: 13, ty: 18, ox: 12, oy: 18, label: 'שמאל' },
  e: { tx: 18, ty: 18, ox: 19, oy: 18, label: 'ימין' }
};
const START = { x: tc(15) + 1.2, z: tc(18) + 0.4, yaw: 0 };

/* CCTV cameras: tile-space position (near a ceiling corner) and a look-at point */
const CAMS = [
  { id: 1,  name: 'אולם הבקבוק',   p: [2.15, 1.15],  l: [9, 4] },
  { id: 2,  name: 'מעבדת טעימות',  p: [18.85, 1.15], l: [12.5, 4.5] },
  { id: 3,  name: 'מחסן',          p: [20.15, 1.15], l: [29, 4.6] },
  { id: 4,  name: 'לוקרים',        p: [12.85, 8.15], l: [4, 10] },
  { id: 5,  name: 'חדר מנוחה',     p: [27.85, 8.15], l: [18, 10] },
  { id: 6,  name: 'מסדרון מערבי',  p: [2.5, 18.85],  l: [2.5, 5] },
  { id: 7,  name: 'מסדרון מזרחי',  p: [29.5, 18.85], l: [29.5, 5] },
  { id: 8,  name: 'גנרטור',        p: [9.85, 13.15], l: [4, 17] },
  { id: 9,  name: 'חדר קירור',     p: [13.15, 13.15], l: [19, 16] },
  { id: 10, name: 'משרד המנהלת',   p: [27.85, 13.15], l: [22, 17] },
  { id: 11, name: 'רציף טעינה',    p: [10.85, 20.15], l: [2, 23] },
  { id: 12, name: 'מקלחות',        p: [21.15, 20.15], l: [28, 23] }
];

/* item spots (tile coords) */
const SPOTS = {
  fuse:    [[10, 9], [18, 4], [23, 1], [27, 9], [10, 20], [13, 15], [21, 22], [27, 13]],
  bottle:  [[2, 1], [5, 1], [8, 3], [9, 1], [3, 3], [6, 4], [10, 2]],
  cambox:  [[29, 1, 'n'], [2, 13, 'w'], [18, 15, 's']],
  fuel:    [[10, 22], [27, 22], [10, 9], [12, 1]],
  note:    [[22, 22], [18, 9], [10, 9]],
  battery: [[12, 4], [29, 9], [2, 9], [8, 16], [22, 16], [19, 18], [4, 20], [13, 1]],
  card:    { host: [27, 8], counselor: [21, 20], watcher: [4, 16], brodana: [29, 4], rider: [29, 6], zero: [13, 13] }
};

/* ---------------- the cast ---------------- */
const STD_EYES = [[0.36, 0.44], [0.64, 0.44]];
const CAST = [
  { id: 'host', name: 'המארח', pos: 'CDM', ovr: 86, night: 1, behavior: 'listener',
    photo: 'assets/host.jpg', eyes: [[0.37, 0.41], [0.64, 0.48]], eyeColor: 0xffe7a8,
    shirt: 'hawaii', shirtColor: '#b3302a', pants: '#4f4637', skin: '#d4a283', hair: '#1b1410', hairStyle: 'short', acc: 'partyhat', sleeves: false,
    ability: 'שומע הכול',
    bio: 'המסיבה בחדר המנוחה אף פעם לא נגמרת. בחושך הוא כמעט עיוור, אבל כל צעד ריצה מגיע אליו. כשהמוזיקה נעצרת, הוא כבר בדרך.',
    tip: 'תלך לאט ליד חדר המנוחה. אם המוזיקה נעצרה, תתחבא בלוקר.',
    kill: 'באת בלי הזמנה, אז תישאר למסיבה.', stats: [61, 70, 90, 74, 88, 85] },
  { id: 'counselor', name: 'המדריך', pos: 'CM', ovr: 88, night: 2, behavior: 'tracker',
    photo: null, eyes: STD_EYES, eyeColor: 0xfff6d0,
    shirt: 'garin', shirtColor: '#f2c40f', pants: '#1f2a44', skin: '#c48d6c', hair: '#1a120c', hairStyle: 'curly', acc: 'curls', mustache: true, sleeves: false,
    ability: 'הולך בעקבות',
    bio: 'מאז התקרית עם החלב במקלחות הוא לא מפסיק ללכת. הוא לא מחפש אותך, הוא פשוט הולך בדיוק בעקבות שלך. ומשאיר שלוליות.',
    tip: 'הוא איטי ממך אבל לא מתעייף. כדי לאבד אותו, תתחבא בלוקר או תסגור דלת.',
    kill: 'אמרתי לך לא לשפוך חלב.', stats: [79, 72, 88, 85, 80, 83] },
  { id: 'watcher', name: 'השומר', pos: 'GK', ovr: 89, night: 3, behavior: 'statue',
    photo: 'assets/watcher.jpg', eyes: [[0.367, 0.44], [0.617, 0.434]], eyeColor: 0xd8ecff,
    shirt: 'hoodie', shirtColor: '#383b3f', pants: '#2c2d30', skin: '#e3b49c', hair: '#9a7448', hairStyle: 'short', acc: 'hood', sleeves: true,
    ability: 'קופא כשמסתכלים',
    bio: 'עומד בלי לזוז בסוף המסדרון. הוא זז רק כשאף אחד לא מסתכל עליו, ואז הוא מהיר מאוד.',
    tip: 'אל תסובב לו את הגב. גם מצלמות האבטחה מקפיאות אותו.',
    kill: 'מצמצת.', stats: [95, 50, 60, 70, 92, 78] },
  { id: 'brodana', name: 'BRODANA', pos: 'LB', ovr: 93, night: 3, behavior: 'guardian',
    photo: null, eyes: STD_EYES, eyeColor: 0xfff1a0,
    shirt: 'stripes', shirtColor: '#f3c613', pants: '#16224a', skin: '#d6a585', hair: '#2a1d14', hairStyle: 'short', acc: 'ball', sleeves: false,
    ability: 'מגן על המחסן',
    bio: 'מגן שמאלי, 93. המחסן הוא החצי שלו במגרש ואף אחד לא עובר אותו. הוא מהיר ממך, אבל לא יוצא מהאזור.',
    tip: 'תקשיב לכדור לפני שאתה נכנס למחסן. אם הוא רץ אליך, צא מהמחסן.',
    kill: 'PAC 91. לא היה לך סיכוי.', stats: [91, 60, 82, 82, 87, 89] },
  { id: 'rider', name: 'הרוכב', pos: 'RW', ovr: 90, night: 4, behavior: 'charger',
    photo: null, eyes: STD_EYES, eyeColor: 0xffffff,
    shirt: 'plain', shirtColor: '#e9e6df', pants: '#3b3a37', skin: '#caa184', hair: '#1c1612', hairStyle: 'buzz', acc: 'helmet', beard: true, sleeves: false,
    ability: 'הסתערות בקו ישר',
    bio: 'נוסע על קורקינט במסדרונות ולא עוצר. כשהוא רואה אותך בקו ישר, הוא מאיץ.',
    tip: 'כשהמנוע מתגבר, צא מהמסדרון לחדר צדדי. הוא נוסע רק ישר.',
    kill: 'פנה את הדרך בפעם הבאה.', stats: [97, 81, 70, 88, 45, 80] },
  { id: 'zero', name: 'פציינט אפס', pos: 'ST', ovr: 96, night: 5, behavior: 'hunter',
    photo: 'assets/zero.jpg', before: 'assets/zero_before.jpg', eyes: [[0.36, 0.445], [0.64, 0.445]], eyeColor: 0xff2a1a, sockets: false,
    shirt: 'emblem', shirtColor: '#1d2740', pants: '#a39377', skin: '#8f9c88', hair: '#120d0b', hairStyle: 'curly', acc: 'zombie', sleeves: false,
    ability: 'צייד',
    bio: 'הוא שתה את הבקבוק הראשון של ונדיה גוך. מאז הוא תמיד יודע בערך איפה אתה, ודלתות לא עוצרות אותו לאורך זמן.',
    tip: 'אל תעצור. דלת סגורה קונה לך כמה שניות, לא יותר.',
    kill: 'נולדת תחת לילות מכוכבים.', stats: [84, 95, 66, 90, 70, 98] }
];
const CASTDATA = store.get('cast', {});          // {id:{name, photo(dataURL)}}
const castDef = id => CAST.find(c => c.id === id);
const castName = id => { const d = CASTDATA[id]; return (d && d.name && d.name.trim()) || (castDef(id) ? castDef(id).name : id); };
const castPhoto = id => { const d = CASTDATA[id]; return (d && d.photo) || castDef(id).photo; };
const castEyes = id => { const d = CASTDATA[id]; return (d && d.photo) ? STD_EYES : castDef(id).eyes; };
function saveCast() { return store.set('cast', CASTDATA); }
function fillNames(s) { return s.replace(/\{(\w+)\}/g, (m, id) => castDef(id) ? castName(id) : m); }

/* ---------------- the nights ---------------- */
const NIGHTS = [
  { n: 1, title: 'החשמל נפל', power: false,
    story: 'משמרת ראשונה במפעל של ונדיה גוך. הנתיכים של הגנרטור נעלמו והבניין חשוך. המנהלת רוצה חשמל לפני הבוקר.',
    cast: { host: 14 },
    steps: [
      { k: 'cctv', text: 'תבדוק את מצלמות האבטחה בחדר הביטחון' },
      { k: 'collect', item: 'fuse', count: 3, text: 'תמצא נתיכים בבניין' },
      { k: 'use', obj: 'fusebox', text: 'תכניס את הנתיכים ללוח בחדר הגנרטור' },
      { k: 'clock', text: 'תחזור לחדר הביטחון ותחתים כרטיס יציאה' }],
    msgs: [
      { t: 1, from: 'boss', text: 'ברוך הבא למשמרת הלילה 🌙 הנתיכים של הגנרטור נעלמו. תמצא שלושה ותחזיר אותם ללוח לפני 06:00.' },
      { t: 7, from: 'boss', text: 'קודם תבדוק את המצלמות במחשב שעל השולחן. ואם שומעים מוזיקה מחדר המנוחה, לא נכנסים.' },
      { t: 50, from: 'host', text: 'אחי יש מסיבה בחדר המנוחה 🎉 בוא' },
      { on: 'power', from: 'boss', text: 'יש חשמל! עכשיו תחזור לחדר הביטחון ותחתים כרטיס.' },
      { t: 170, from: 'host', text: 'שמעתי אותך רץ 👂' }] },
  { n: 2, title: 'דגימות', power: true,
    story: 'קו הייצור עבד כל הלילה בלי אף אחד לידו. צריך לקחת דגימות למעבדה. וגם משהו קרה במקלחות.',
    cast: { host: 18, counselor: 32 },
    steps: [
      { k: 'collect', item: 'bottle', count: 5, text: 'תאסוף בקבוקי ונדיה מקו הייצור' },
      { k: 'use', obj: 'tasting', text: 'תביא את הבקבוקים למעבדת הטעימות' },
      { k: 'goto', room: 'showers', text: 'תבדוק מה קרה במקלחות', note: 1 },
      { k: 'clock', text: 'תחזור לחדר הביטחון ותחתים כרטיס יציאה' }],
    msgs: [
      { t: 1, from: 'boss', text: 'לילה שני. אני צריכה 5 בקבוקים מקו הייצור לבדיקת איכות במעבדה.' },
      { t: 8, from: 'boss', text: 'ומישהו דיווח על חלב על כל רצפת המקלחות 🥛 תבדוק מה קרה שם.' },
      { t: 38, from: 'counselor', text: 'מי שפך חלב במקלחות??' },
      { on: 'done:1', from: 'boss', text: 'אל תטעם מהבקבוקים. ברצינות.' },
      { t: 125, from: 'counselor', text: 'אני הולך בעקבות שלך 👣' },
      { on: 'done:3', from: 'boss', text: 'הוא עדיין בבניין. תחזור מהר ותחתים כרטיס.' }] },
  { n: 3, title: 'עיניים בחושך', power: true,
    story: 'שלוש מצלמות נפלו והגנרטור כמעט ריק. ובסוף המסדרון עומד מישהו ולא זז.',
    cast: { host: 22, counselor: 45, watcher: 26, brodana: 0 },
    steps: [
      { k: 'collect', item: 'cambox', count: 3, text: 'תאתחל מצלמות שנפלו' },
      { k: 'collect', item: 'fuel', count: 2, text: 'תמצא ג׳ריקנים של דלק' },
      { k: 'use', obj: 'genfuel', text: 'תמלא דלק בגנרטור' },
      { k: 'clock', text: 'תחזור לחדר הביטחון ותחתים כרטיס יציאה' }],
    msgs: [
      { t: 1, from: 'boss', text: 'שלוש מצלמות נפלו והגנרטור כמעט ריק. תאתחל אותן ותמלא דלק.' },
      { t: 9, from: 'boss', text: 'ואם אתה רואה מישהו עומד בלי לזוז, אל תוריד ממנו את העיניים.' },
      { t: 30, from: 'watcher', text: 'אני כאן.' },
      { t: 58, from: 'brodana', text: 'המחסן זה האזור שלי ⚽' },
      { t: 150, from: 'watcher', text: 'אל תמצמץ.' },
      { on: 'done:3', from: 'boss', text: 'הגנרטור מלא. תחזור להחתים.' }] },
  { n: 4, title: 'הנוסחה', power: true,
    story: 'המנהלת רוצה את הנוסחה המקורית מהמקפיא. הכרטיס של המקפיא בכספת, והקוד כתוב על פתק שמישהו איבד.',
    cast: { host: 22, counselor: 50, watcher: 34, brodana: 0, rider: 20 },
    steps: [
      { k: 'collect', item: 'note', count: 1, text: 'תמצא את הפתק עם הקוד של הכספת' },
      { k: 'use', obj: 'safe', text: 'תפתח את הכספת במשרד המנהלת' },
      { k: 'use', obj: 'freezer', text: 'תוציא את הנוסחה מהמקפיא בחדר הקירור' },
      { k: 'clock', text: 'תחזור לחדר הביטחון ותחתים כרטיס יציאה' }],
    msgs: [
      { t: 1, from: 'boss', text: 'אני צריכה את הנוסחה המקורית מהמקפיא. הכרטיס שפותח אותו בכספת שלי, והקוד כתוב על פתק שמישהו איבד.' },
      { t: 25, from: 'rider', text: 'פנו את המסדרון 🛵' },
      { on: 'done:1', from: 'boss', text: 'מצאת את הקוד? הכספת במשרד שלי.' },
      { on: 'done:3', from: 'zero', text: 'תחזיר את זה.' },
      { t: 200, from: 'rider', text: 'שמעתי שאתה מהיר. נראה.' }] },
  { n: 5, title: 'פציינט אפס', power: true, tape: true,
    story: 'משהו התעורר במקפיא. צריך לרוקן את המכלים של ונדיה ולברוח דרך רציף הטעינה לפני שהוא מגיע אליך.',
    cast: { host: 25, counselor: 55, watcher: 40, brodana: 0, rider: 30, zero: 12 },
    steps: [
      { k: 'collect', item: 'valve', count: 3, text: 'תפתח את השסתומים של מכלי ונדיה' },
      { k: 'goto', room: 'dock', text: 'תגיע לרציף הטעינה' },
      { k: 'use', obj: 'gate', text: 'תפתח את שער היציאה' }],
    msgs: [
      { t: 1, from: 'boss', text: 'הוא התעורר. תפתח את השסתומים של שלושת המכלים באולם הבקבוק ותברח דרך רציף הטעינה.' },
      { t: 6, from: 'zero', text: 'בוקר טוב 🧟' },
      { on: 'done:1', from: 'boss', text: 'המכלים מתרוקנים. רוץ לרציף!' },
      { on: 'done:2', from: 'boss', text: 'השער כבד. תחזיק עד שהוא נפתח, ואל תעזוב.' },
      { t: 95, from: 'zero', text: 'נולדת תחת לילות מכוכבים.' }] }
];

const LORE = [
  { at: [6.5, 8.9], title: 'לוח משמרות', text: 'משמרת לילה, מפעל ונדיה גוך\n\nשבוע 1 · {host}\nשבוע 2 · {counselor}\nשבוע 3 · {watcher}\nשבוע 4 · אתה\n\nאף אחד לא חזר לשבוע 5.' },
  { at: [14.2, 1.3], title: 'הוראות מעבדה', text: 'אסור לטעום מהקו.\nאסור לטעום מהקו.\nאסור לטעום מהקו.\n\nו.ג.' },
  { at: [26.6, 20.45], title: 'פתק על המראה', text: 'מי שפך חלב על כל המקלחות??\nזה לא מצחיק.\nזה כבר לא יורד.\n\n{counselor}' },
  { at: [25.4, 16.45], title: 'היומן של המנהלת', text: 'בקבוק 0001 הלך ל{zero}.\nהוא אמר שהטעם כמו לילה מכוכבים.\nמאז הוא לא ישן.\nגם אנחנו לא.' }
];

/* =====================================================================
   AUDIO · everything is synthesised, nothing is downloaded
   ===================================================================== */
const AU = {
  ctx: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    let ctx; try { ctx = new C(); } catch (e) { return; }
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = SETTINGS.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 0.7; this.amb.connect(this.master);
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(2.6, 2.3);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.55; this.wet.connect(this.verb); this.verb.connect(this.master);
    const len = ctx.sampleRate * 2; this.nbuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.nbuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbience();
  },
  setVolume(v) { if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); },
  now() { return this.ctx ? this.ctx.currentTime : 0; },
  dst(d) { return d && d.inp ? d.inp : (d || this.sfx); },
  impulse(sec, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  },
  env(g, t, a, v, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); },
  noise(o) {
    if (!this.ctx) return; const c = this.ctx, t = o.t != null ? o.t : c.currentTime, dur = o.dur || 0.2;
    const s = c.createBufferSource(); s.buffer = this.nbuf; s.loop = true; s.playbackRate.value = o.rate || 1;
    const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur); f.Q.value = o.q != null ? o.q : 1;
    const g = c.createGain(); this.env(g, t, o.a || 0.004, o.v != null ? o.v : 0.4, dur);
    s.connect(f); f.connect(g); g.connect(this.dst(o.dest));
    if (o.wet) { const w = c.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(this.wet); }
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  tone(o) {
    if (!this.ctx) return; const c = this.ctx, t = o.t != null ? o.t : c.currentTime, dur = o.dur || 0.2;
    const osc = c.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f || 440, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur); if (o.detune) osc.detune.value = o.detune;
    const g = c.createGain(); this.env(g, t, o.a || 0.005, o.v != null ? o.v : 0.2, dur);
    osc.connect(g); g.connect(this.dst(o.dest));
    if (o.wet) { const w = c.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(this.wet); }
    osc.start(t); osc.stop(t + dur + 0.05);
  },
  /* --- one-shots --- */
  step(surface, loud) {
    const v = loud ? 0.34 : 0.15;
    if (surface === 'metal') { this.noise({ type: 'bandpass', f: 2300, q: 3, dur: 0.09, v: v * 0.8 }); this.tone({ type: 'triangle', f: 430, f2: 380, dur: 0.12, v: v * 0.2 }); }
    else if (surface === 'tiles') { this.noise({ type: 'highpass', f: 1900, q: 0.7, dur: 0.05, v: v * 0.6 }); this.noise({ type: 'lowpass', f: 520, dur: 0.08, v: v * 0.6 }); }
    else if (surface === 'carpet') { this.noise({ type: 'lowpass', f: 360, dur: 0.1, v: v * 0.7 }); }
    else { this.noise({ type: 'lowpass', f: 700, dur: 0.09, v }); this.noise({ type: 'bandpass', f: 1500, q: 1, dur: 0.04, v: v * 0.35 }); }
  },
  thump(dest, v = 0.5) { this.tone({ type: 'sine', f: 110, f2: 42, dur: 0.18, v, dest }); this.noise({ type: 'lowpass', f: 300, dur: 0.12, v: v * 0.5, dest }); },
  heartbeat(v) { const t = this.now(); this.tone({ type: 'sine', f: 64, f2: 38, dur: 0.16, v, t }); this.tone({ type: 'sine', f: 58, f2: 36, dur: 0.2, v: v * 0.7, t: t + 0.19 }); },
  doorSlam() { this.tone({ type: 'sine', f: 95, f2: 34, dur: 0.35, v: 0.9 }); this.noise({ type: 'lowpass', f: 900, dur: 0.3, v: 0.55, wet: 0.4 }); this.tone({ type: 'triangle', f: 240, f2: 228, dur: 0.6, v: 0.1, wet: 0.5 }); },
  servo(up) { this.tone({ type: 'sawtooth', f: up ? 260 : 420, f2: up ? 420 : 260, dur: 0.55, v: 0.05 }); this.noise({ type: 'bandpass', f: 1300, q: 2, dur: 0.5, v: 0.07 }); },
  beep(f = 880, v = 0.1) { this.tone({ type: 'square', f, dur: 0.07, v }); },
  buzz() { this.tone({ type: 'square', f: 110, dur: 0.3, v: 0.1 }); },
  pickup() { const t = this.now(); this.tone({ f: 660, dur: 0.12, v: 0.16, t }); this.tone({ f: 990, dur: 0.22, v: 0.14, t: t + 0.08 }); this.tone({ f: 1320, dur: 0.3, v: 0.08, t: t + 0.16, wet: 0.4 }); },
  objective() { const t = this.now(); [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', f, dur: 0.35, v: 0.09, t: t + i * 0.09, wet: 0.3 })); },
  ding() { const t = this.now(); this.tone({ f: 1568, dur: 0.18, v: 0.1, t }); this.tone({ f: 2093, dur: 0.3, v: 0.08, t: t + 0.09 }); },
  punch() { const t = this.now(); this.noise({ type: 'bandpass', f: 1800, q: 2, dur: 0.06, v: 0.4, t }); this.tone({ f: 160, f2: 60, dur: 0.2, v: 0.6, t }); this.noise({ type: 'lowpass', f: 400, dur: 0.15, v: 0.4, t: t + 0.07 }); this.tone({ type: 'triangle', f: 1250, dur: 0.3, v: 0.07, t: t + 0.08 }); },
  staticBurst(d = 0.25, v = 0.16) { this.noise({ type: 'highpass', f: 900, q: 0.5, dur: d, v, a: 0.002 }); },
  sting() { const t = this.now(); [233, 247, 262, 277, 311].forEach(f => this.tone({ type: 'sawtooth', f, f2: f * 0.93, dur: 1.6, v: 0.06, a: 0.01, t, wet: 0.6 })); this.noise({ type: 'highpass', f: 2500, dur: 0.5, v: 0.25, wet: 0.5 }); },
  powerDown() { this.tone({ type: 'sawtooth', f: 220, f2: 30, dur: 1.6, v: 0.15 }); this.noise({ type: 'lowpass', f: 400, f2: 60, dur: 1.4, v: 0.2 }); },
  powerUp() { this.tone({ type: 'sawtooth', f: 30, f2: 120, dur: 1.8, v: 0.12 }); this.noise({ type: 'lowpass', f: 80, f2: 600, dur: 1.6, v: 0.2 }); this.tone({ type: 'square', f: 880, dur: 0.06, v: 0.06, t: this.now() + 1.7 }); },
  creak() { this.noise({ type: 'bandpass', f: 300, f2: 900, q: 12, dur: 0.5, v: 0.25 }); },
  splash() { this.noise({ type: 'bandpass', f: 1400, q: 1.2, dur: 0.25, v: 0.3 }); this.noise({ type: 'lowpass', f: 500, dur: 0.18, v: 0.25 }); },
  partyHorn(dest) { this.tone({ type: 'sawtooth', f: 470, f2: 330, dur: 0.7, v: 0.3, dest }); this.tone({ type: 'sawtooth', f: 474, f2: 333, dur: 0.7, v: 0.2, dest }); },
  whistle(dest) { const t = this.now(); this.tone({ f: 2000, f2: 2600, dur: 0.22, v: 0.25, t, dest }); this.tone({ f: 2600, f2: 1900, dur: 0.32, v: 0.25, t: t + 0.24, dest }); },
  bounce(dest, v = 0.6) { this.tone({ f: 170, f2: 70, dur: 0.12, v, dest }); this.noise({ type: 'lowpass', f: 700, dur: 0.06, v: v * 0.6, dest }); },
  pant(dest) { const t = this.now(); this.noise({ type: 'bandpass', f: 1300, q: 1.5, dur: 0.3, v: 0.2, t, dest }); this.noise({ type: 'bandpass', f: 1000, q: 1.5, dur: 0.3, v: 0.18, t: t + 0.42, dest }); },
  groan(dest, loud) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, dur = loud ? 1.6 : 1.2;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(loud ? 120 : 84, t); o.frequency.exponentialRampToValueAtTime(loud ? 70 : 56, t + dur);
    const b1 = c.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = 520; b1.Q.value = 4;
    const b2 = c.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = 1150; b2.Q.value = 6;
    const g = c.createGain(); this.env(g, t, 0.08, loud ? 0.9 : 0.55, dur);
    o.connect(b1); o.connect(b2); b1.connect(g); b2.connect(g); g.connect(this.dst(dest)); o.start(t); o.stop(t + dur + 0.05);
    this.noise({ type: 'bandpass', f: 800, q: 1, dur: dur * 0.8, v: loud ? 0.3 : 0.15, dest });
  },
  bang(dest) { this.tone({ f: 80, f2: 40, dur: 0.3, v: 0.9, dest }); this.noise({ type: 'lowpass', f: 1200, dur: 0.22, v: 0.6, dest }); this.tone({ type: 'triangle', f: 310, f2: 300, dur: 0.5, v: 0.12, dest }); },
  distCurve() { if (this._dc) return this._dc; const n = 1024, cv = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cv[i] = Math.tanh(x * 6); } return (this._dc = cv); },
  scream() {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const ws = c.createWaveShaper(); ws.curve = this.distCurve();
    const g = c.createGain(); g.gain.setValueAtTime(0.85, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6); ws.connect(g); g.connect(this.sfx);
    [180, 233, 301, 377].forEach(f => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.6, t + 0.35); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 1.5); const og = c.createGain(); og.gain.value = 0.2; o.connect(og); og.connect(ws); o.start(t); o.stop(t + 1.6); });
    this.noise({ type: 'bandpass', f: 900, f2: 3200, q: 0.8, dur: 1.3, v: 0.85, a: 0.003 }); this.tone({ f: 70, f2: 30, dur: 0.8, v: 0.9 });
  },
  /* --- positional emitters (one per monster) --- */
  emitter() {
    const c = this.ctx; if (!c) return null;
    const inp = c.createGain(), lp = c.createBiquadFilter(), p = c.createPanner();
    lp.type = 'lowpass'; lp.frequency.value = 18000;
    p.panningModel = IS_TOUCH ? 'equalpower' : 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2.2; p.rolloffFactor = 1.35; p.maxDistance = 60;
    inp.connect(lp); lp.connect(p); p.connect(this.sfx);
    const send = c.createGain(); send.gain.value = 0.22; p.connect(send); send.connect(this.wet);
    return { inp, lp, p };
  },
  place(em, x, y, z, occluded) {
    if (!em || !this.ctx) return; const t = this.ctx.currentTime, p = em.p;
    if (p.positionX) { p.positionX.setTargetAtTime(x, t, 0.03); p.positionY.setTargetAtTime(y, t, 0.03); p.positionZ.setTargetAtTime(z, t, 0.03); }
    else p.setPosition(x, y, z);
    em.lp.frequency.setTargetAtTime(occluded ? 700 : 18000, t, 0.12);
  },
  listen(x, y, z, fx, fz) {
    if (!this.ctx) return; const L = this.ctx.listener, t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(x, t, 0.02); L.positionY.setTargetAtTime(y, t, 0.02); L.positionZ.setTargetAtTime(z, t, 0.02);
      L.forwardX.setTargetAtTime(fx, t, 0.02); L.forwardY.setTargetAtTime(0, t, 0.02); L.forwardZ.setTargetAtTime(fz, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(x, y, z); L.setOrientation(fx, 0, fz, 0, 1, 0); }
  },
  /* --- loops --- */
  startAmbience() {
    const c = this.ctx, t = c.currentTime;
    const dr = c.createGain(); dr.gain.value = 0.05; dr.connect(this.amb);
    [41, 41.7, 61.5].forEach(f => { const o = c.createOscillator(); o.frequency.value = f; o.connect(dr); o.start(t); });
    const n = c.createBufferSource(); n.buffer = this.nbuf; n.loop = true; const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 170;
    const ng = c.createGain(); ng.gain.value = 0.05; n.connect(nf); nf.connect(ng); ng.connect(this.amb); n.start(t);
    const hum = c.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 120; const hf = c.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 2400; hf.Q.value = 9;
    this.humGain = c.createGain(); this.humGain.gain.value = 0; hum.connect(hf); hf.connect(this.humGain); this.humGain.connect(this.amb); hum.start(t);
    this.clankT = 6; this.whisperT = 30;
  },
  setHum(on) { if (this.humGain) this.humGain.gain.setTargetAtTime(on ? 0.012 : 0, this.ctx.currentTime, 0.4); },
  ambienceTick(dt, active) {
    if (!this.ctx || !active) return;
    this.clankT -= dt; this.whisperT -= dt;
    if (this.clankT <= 0) {
      this.clankT = rand(9, 22); const c = this.ctx;
      const sp = c.createStereoPanner ? c.createStereoPanner() : null; const g = c.createGain(); g.gain.value = 1;
      if (sp) { sp.pan.value = rand(-1, 1); g.connect(sp); sp.connect(this.amb); } else g.connect(this.amb);
      this.noise({ type: 'bandpass', f: rand(500, 2400), q: rand(4, 12), dur: rand(0.15, 0.5), v: rand(0.08, 0.2), dest: g, wet: 0.9 });
      if (Math.random() < 0.4) this.tone({ type: 'triangle', f: rand(180, 420), dur: 0.9, v: 0.03, dest: g, wet: 0.9 });
    }
    if (this.whisperT <= 0) { this.whisperT = rand(28, 55); this.noise({ type: 'bandpass', f: 1400, f2: 500, q: 7, dur: 1.4, v: 0.05, wet: 0.8, dest: this.amb }); }
  },
  /* party music for the host: a tiny step sequencer routed into his speaker */
  music: null,
  makeMusic(em) {
    if (!this.ctx || !em) return null; const c = this.ctx;
    const out = c.createGain(); out.gain.value = 0; out.connect(em.inp);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(out);
    this.music = { out, lp, next: c.currentTime + 0.1, step: 0, on: false };
    return this.music;
  },
  musicTick() {
    const m = this.music; if (!m || !this.ctx) return; const c = this.ctx, spb = 60 / 116 / 4;
    while (m.next < c.currentTime + 0.15) {
      const s = m.step % 16, bar = Math.floor(m.step / 16) % 4, t = m.next;
      if (s % 4 === 0) this.tone({ f: 120, f2: 45, dur: 0.22, v: 0.7, t, dest: m.out });
      if (s % 4 === 2) this.noise({ type: 'highpass', f: 7000, dur: 0.04, v: 0.12, t, dest: m.out });
      if (s === 4 || s === 12) this.noise({ type: 'bandpass', f: 1800, q: 0.8, dur: 0.15, v: 0.25, t, dest: m.out });
      if (s % 2 === 0) { const root = [55, 65.41, 49, 43.65][bar]; this.tone({ type: 'sawtooth', f: s % 8 === 6 ? root * 2 : root, dur: spb * 1.8, v: 0.3, t, dest: m.lp }); }
      if (s === 2 || s === 10) [220, 261.6, 329.6].forEach(f => this.tone({ type: 'square', f: f * [1, 1.19, 0.89, 0.8][bar], dur: 0.12, v: 0.03, t, dest: m.out }));
      m.next += spb; m.step++;
    }
  },
  setMusic(on) { const m = this.music; if (!m || m.on === on) return; m.on = on; m.out.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, on ? 0.6 : 0.25); },
  makeEngine(em) {
    if (!this.ctx || !em) return null; const c = this.ctx, t = c.currentTime;
    const g = c.createGain(); g.gain.value = 0; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 48; const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 97;
    const trem = c.createOscillator(); trem.frequency.value = 17; const tg = c.createGain(); tg.gain.value = 0.25; trem.connect(tg); tg.connect(g.gain);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(em.inp); o1.start(t); o2.start(t); trem.start(t);
    return { g, o1, o2, lp };
  },
  setEngine(e, level) {
    if (!e || !this.ctx) return; const t = this.ctx.currentTime, f = 40 + level * 120;
    e.o1.frequency.setTargetAtTime(f, t, 0.15); e.o2.frequency.setTargetAtTime(f * 2.02, t, 0.15);
    e.g.gain.setTargetAtTime(level <= 0 ? 0 : 0.18 + level * 0.32, t, 0.15); e.lp.frequency.setTargetAtTime(600 + level * 1800, t, 0.15);
  },
  makeHum(em) {
    if (!this.ctx || !em) return null; const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 50; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    const g = c.createGain(); g.gain.value = 0; o.connect(lp); lp.connect(g); g.connect(em.inp); o.start(c.currentTime);
    return g;
  }
};
