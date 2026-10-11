/* Katzir FC — static game data: squad, editions, rival clubs, kits, formations. */
window.KFC = window.KFC || {};

// Every asset path goes through here so a single-file build can swap in inlined data URIs.
KFC.asset = function (path) { return (window.KFC_ASSETS && window.KFC_ASSETS[path]) || path; };

KFC.DATA = (function () {
  'use strict';

  // Editions: how a card looks and how much it boosts the player.
  const EDITIONS = {
    gold:   { he: 'זהב',        en: 'GOLD',      boost: 0, rarity: 1 },
    star:   { he: 'כוכב קציר',  en: 'KATZIR STAR', boost: 0, rarity: 2 },
    vamos:  { he: 'וואמוס',      en: 'VAMOS',     boost: 0, rarity: 3 },
    legend: { he: 'אגדה',       en: 'LEGEND',    boost: 3, rarity: 4 },
    goat:   { he: 'הגואט',       en: 'GOAT',      boost: 0, rarity: 5 }
  };

  const OUTFIELD = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
  const GK_KEYS = ['div', 'han', 'kic', 'ref', 'spd', 'pos'];
  const STAT_LABELS = {
    pac: 'PAC', sho: 'SHO', pas: 'PAS', dri: 'DRI', def: 'DEF', phy: 'PHY',
    div: 'DIV', han: 'HAN', kic: 'KIC', ref: 'REF', spd: 'SPD', pos: 'POS'
  };
  const STAT_HE = {
    pac: 'מהירות', sho: 'בעיטה', pas: 'מסירה', dri: 'כדרור', def: 'הגנה', phy: 'פיזיות',
    div: 'זינוק', han: 'תפיסה', kic: 'בעיטה', ref: 'רפלקסים', spd: 'מהירות', pos: 'מיקום'
  };

  // The squad. The first seven are the real Katzir FC players from the photos;
  // stats and positions are copied from their cards exactly as they appear.
  const PLAYERS = [
    {
      id: 'liam', real: true, he: 'ליאם שבת', en: 'LIAM SHABAT', short: 'SHABAT', shortHe: 'שבת',
      nick: 'VAMOS', nickHe: 'וואמוס', pos: 'ST', num: 10, ovr: 99, edition: 'vamos', goat: true,
      stats: { pac: 99, sho: 99, pas: 99, dri: 99, def: 99, phy: 99 },
      hair: '#1d1612', skin: '#c99a7a', build: 1.08,
      bio: 'הגואט. הטוב בכל הזמנים. כשהכדור אצלו כל האצטדיון עוצר את הנשימה.',
      tags: ['הגואט', '99 בכל תכונה', 'וואמוס']
    },
    {
      id: 'yiftach', real: true, he: 'יפתח צימט', en: 'YIFTACH TZIMET', short: 'TZIMET', shortHe: 'צימט',
      pos: 'CT', num: 8, ovr: 99, edition: 'star',
      stats: { pac: 99, sho: 99, pas: 99, dri: 99, def: 99, phy: 99 },
      hair: '#17120f', skin: '#d6a98a', build: 1.0,
      bio: '99 בכל תכונה. המוח של קציר באמצע המגרש, רואה את המסירה לפני כולם.',
      tags: ['99 בכל תכונה', 'מנהל משחק']
    },
    {
      id: 'shratzer', real: true, he: 'יהונתן שרצר', en: 'YEHONATAN SHRATZER', short: 'SHRATZER', shortHe: 'שרצר',
      pos: 'CF', num: 9, ovr: 90, edition: 'star',
      stats: { pac: 90, sho: 90, pas: 90, dri: 90, def: 85, phy: 90 },
      hair: '#c9b48a', skin: '#c99878', build: 1.02,
      bio: 'בעיטה מטורפת מכל מרחק. כל נגיעה שלו בכדור היא סכנה לשער.',
      tags: ['בעיטה מטורפת', 'חלוץ מלא']
    },
    {
      id: 'erez', real: true, he: 'ארז פור', en: 'EREZ POR', short: 'POR', shortHe: 'פור',
      pos: 'CM', num: 6, ovr: 85, edition: 'star',
      stats: { pac: 85, sho: 85, pas: 85, dri: 85, def: 85, phy: 85 },
      hair: '#141010', skin: '#c08f6c', build: 1.04,
      bio: '85 בכל תכונה. השחקן הכי מאוזן בקבוצה, אי אפשר לעצור אותו.',
      tags: ['מאוזן לגמרי', 'מנוע']
    },
    {
      id: 'ido', real: true, he: 'עידו', en: 'IDO', short: 'IDO', shortHe: 'עידו',
      pos: 'LW', num: 7, ovr: 82, edition: 'star', key: true,
      stats: { pac: 95, sho: 95, pas: 95, dri: 60, def: 60, phy: 60 },
      hair: '#3a2a1e', skin: '#d4a586', build: 0.97,
      bio: 'שחקן מפתח. מהירות, בעיטה ומסירה של 95. כשהוא בורח, אף אחד לא תופס.',
      tags: ['שחקן מפתח', '95 מהירות']
    },
    {
      id: 'gefen', real: true, he: 'גפן אלמקייס', en: 'GEFEN ALMAKIAS', short: 'ALMAKIAS', shortHe: 'אלמקייס',
      pos: 'SR', num: 4, ovr: 80, edition: 'star',
      stats: { pac: 80, sho: 80, pas: 80, dri: 80, def: 80, phy: 60 },
      hair: '#b08a52', skin: '#dcae8f', build: 0.98,
      bio: 'יציב, חכם ומדויק. תמיד במקום הנכון בצד ימין של ההגנה.',
      tags: ['יציב', 'קריאת משחק']
    },
    {
      id: 'sipko', real: true, he: 'ספיקו כהן', en: 'SIPKO COHEN', short: 'COHEN', shortHe: 'כהן',
      nick: 'KAI', pos: 'CB', num: 5, ovr: 78, edition: 'star', key: true, glasses: true,
      stats: { pac: 80, sho: 70, pas: 80, dri: 70, def: 80, phy: 70 },
      hair: '#4a3020', skin: '#d8ab8c', build: 0.96,
      bio: 'שחקן מפתח. עם המשקפיים הוא רואה את כל המגרש ועוצר כל התקפה.',
      tags: ['שחקן מפתח', 'בלם']
    },
    // Squad players invented for Katzir FC (portraits generated with Figma AI / Canva).
    {
      id: 'noam', he: 'נועם "הקיר" לוי', en: 'NOAM LEVI', short: 'LEVI', shortHe: 'לוי', nick: 'THE WALL', nickHe: 'הקיר',
      pos: 'GK', num: 1, ovr: 86, edition: 'gold', gk: true,
      stats: { div: 88, han: 85, kic: 80, ref: 89, spd: 70, pos: 86 },
      hair: '#1a1410', skin: '#c79a7c', build: 1.05,
      bio: 'הקיר. שוער עם רפלקסים של חתול שלא מפחד מאף בעיטה.', tags: ['שוער', 'רפלקסים']
    },
    {
      id: 'itay', he: 'איתי "טורבו" דהן', en: 'ITAY DAHAN', short: 'DAHAN', shortHe: 'דהן', nick: 'TURBO', nickHe: 'טורבו',
      pos: 'RW', num: 11, ovr: 84, edition: 'gold',
      stats: { pac: 97, sho: 80, pas: 78, dri: 88, def: 40, phy: 70 },
      hair: '#111', skin: '#b98a68', build: 0.95,
      bio: 'טורבו. הכי מהיר בקבוצה, אחרי ליאם כמובן.', tags: ['97 מהירות', 'כנף']
    },
    {
      id: 'daniel', he: 'דניאל בן חמו', en: 'DANIEL BEN HAMO', short: 'BEN HAMO', shortHe: 'בן חמו',
      pos: 'CB', num: 3, ovr: 83, edition: 'gold',
      stats: { pac: 75, sho: 50, pas: 72, dri: 65, def: 88, phy: 87 },
      hair: '#c09272', skin: '#c09272', build: 1.12, bald: true,
      bio: 'בלם קשוח עם זקן מפחיד. חלוצים פשוט מתרחקים ממנו.', tags: ['בלם', 'קשוח']
    },
    {
      id: 'lior', he: 'ליאור "מג\'יק" חדד', en: 'LIOR HADAD', short: 'HADAD', shortHe: 'חדד', nick: 'MAGIC', nickHe: "מג'יק",
      pos: 'CAM', num: 14, ovr: 82, edition: 'gold',
      stats: { pac: 80, sho: 81, pas: 86, dri: 90, def: 45, phy: 62 },
      hair: '#4b3020', skin: '#d6aa8c', build: 0.97,
      bio: "מג'יק. הכדור נדבק לו לרגל, והמסירות שלו יוצאות משום מקום.", tags: ['כדרור 90', 'קוסם']
    },
    {
      id: 'roy', he: 'רועי אזולאי', en: 'ROY AZOULAY', short: 'AZOULAY', shortHe: 'אזולאי',
      pos: 'CDM', num: 16, ovr: 81, edition: 'gold',
      stats: { pac: 70, sho: 65, pas: 80, dri: 74, def: 84, phy: 85 },
      hair: '#5a4030', skin: '#d2a487', build: 1.04,
      bio: 'הקשר האחורי ששומר על הכל. עובד בשביל כולם.', tags: ['קשר אחורי', 'עבודה']
    },
    {
      id: 'nadav', he: 'נדב עזרא', en: 'NADAV EZRA', short: 'EZRA', shortHe: 'עזרא',
      pos: 'ST', num: 19, ovr: 80, edition: 'gold',
      stats: { pac: 84, sho: 85, pas: 68, dri: 79, def: 35, phy: 78 },
      hair: '#e6d29a', skin: '#c99a76', build: 1.0,
      bio: 'חלוץ עם שיער בלונדיני וחיוך חצוף. מריח את השער מקילומטר.', tags: ['חלוץ', 'סיומת']
    },
    {
      id: 'amit', he: 'עמית פרץ', en: 'AMIT PERETZ', short: 'PERETZ', shortHe: 'פרץ',
      pos: 'LB', num: 2, ovr: 79, edition: 'gold',
      stats: { pac: 86, sho: 55, pas: 76, dri: 75, def: 79, phy: 72 },
      hair: '#20160f', skin: '#d4a284', build: 0.98,
      bio: 'מגן שמאלי עם קוקו שעולה להתקפה בלי לשאול אף אחד.', tags: ['מגן', 'סיבולת']
    },
    {
      id: 'eyal', he: 'אייל מזרחי', en: 'EYAL MIZRAHI', short: 'MIZRAHI', shortHe: 'מזרחי',
      pos: 'CM', num: 15, ovr: 78, edition: 'gold',
      stats: { pac: 72, sho: 74, pas: 80, dri: 77, def: 70, phy: 74 },
      hair: '#120d0b', skin: '#bd8c6a', build: 1.0,
      bio: 'קשר שקט ומדויק. תמיד פנוי למסירה.', tags: ['קשר', 'מסירות']
    },
    {
      id: 'tom', he: 'תום שלו', en: 'TOM SHALEV', short: 'SHALEV', shortHe: 'שלו',
      pos: 'GK', num: 23, ovr: 76, edition: 'gold', gk: true,
      stats: { div: 77, han: 75, kic: 72, ref: 78, spd: 60, pos: 76 },
      hair: '#1b1410', skin: '#d2a487', build: 1.0,
      bio: 'השוער השני, מחכה להזדמנות שלו.', tags: ['שוער']
    }
  ];

  const byId = {};
  PLAYERS.forEach(p => { byId[p.id] = p; });

  // Special cards found in packs. GOAT Liam is the only 100 in the game.
  const SPECIALS = [
    { id: 'liam_goat', player: 'liam', edition: 'goat', ovr: 100,
      stats: { pac: 100, sho: 100, pas: 100, dri: 100, def: 100, phy: 100 } }
  ];
  PLAYERS.filter(p => p.id !== 'liam').forEach(p => {
    const boost = EDITIONS.legend.boost;
    const stats = {};
    Object.keys(p.stats).forEach(k => { stats[k] = Math.min(99, p.stats[k] + boost + (p.real ? 1 : 0)); });
    SPECIALS.push({ id: p.id + '_legend', player: p.id, edition: 'legend', ovr: Math.min(99, p.ovr + boost + (p.real ? 1 : 0)), stats });
  });
  const specialById = {};
  SPECIALS.forEach(s => { specialById[s.id] = s; });

  // Kits for Katzir FC.
  const KITS = {
    home:  { id: 'home',  he: 'בית',     shirt: '#14275f', sleeve: '#14275f', trim: '#e8c26a', shorts: '#0b1636', socks: '#14275f', num: '#e8c26a' },
    away:  { id: 'away',  he: 'חוץ',     shirt: '#f3f5fa', sleeve: '#f3f5fa', trim: '#d4a645', shorts: '#f3f5fa', socks: '#f3f5fa', num: '#14275f' },
    vamos: { id: 'vamos', he: 'וואמוס',  shirt: '#d3172b', sleeve: '#ffffff', trim: '#ffffff', shorts: '#ffffff', socks: '#d3172b', num: '#ffffff' }
  };

  // Fictional rival clubs.
  const FIRST = ['אבי', 'בן', 'גיל', 'דור', 'הראל', 'ויקטור', 'זיו', 'חן', 'טל', 'יואב', 'כפיר', 'ליאור', 'מתן', 'ניר', 'סהר', 'עדי', 'פלג', 'צח', 'קובי', 'רז', 'שגיא', 'תומר', 'אלון', 'ברק', 'גלעד', 'דניאל', 'ים', 'אריאל'];
  const LAST = ['אברהם', 'ביטון', 'גבאי', 'דוד', 'הדר', 'וקנין', 'זכאי', 'חזן', 'טוביה', 'יוסף', 'כהן', 'לנדאו', 'מלכה', 'נחום', 'סויסה', 'עמר', 'פרידמן', 'צור', 'קדוש', 'רוזן', 'שושן', 'תורג\'מן', 'אוחיון', 'בוזגלו', 'גרין', 'דיין'];

  function seeded(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  const TEAMS = [
    { id: 'barkei',   he: 'ברקי הנגב',   en: 'NEGEV BOLTS',     code: 'BRK', ovr: 74, primary: '#f2c230', secondary: '#141414', shorts: '#141414', socks: '#f2c230', icon: 'bolt',  style: { press: 0.45, pass: 0.45, shoot: 0.55 } },
    { id: 'krishim',  he: 'כרישי הים',   en: 'SEA SHARKS',      code: 'SHK', ovr: 78, primary: '#0fa3a8', secondary: '#ffffff', shorts: '#ffffff', socks: '#0fa3a8', icon: 'fin',   style: { press: 0.55, pass: 0.6, shoot: 0.5 } },
    { id: 'arayot',   he: 'אריות הצפון', en: 'NORTH LIONS',     code: 'LNS', ovr: 82, primary: '#f07a1a', secondary: '#151515', shorts: '#151515', socks: '#f07a1a', icon: 'crown', style: { press: 0.65, pass: 0.55, shoot: 0.65 } },
    { id: 'nesharim', he: 'נשרי ההר',    en: 'MOUNTAIN EAGLES', code: 'EGL', ovr: 85, primary: '#6c3bd1', secondary: '#ffffff', shorts: '#2a1660', socks: '#6c3bd1', icon: 'wing',  style: { press: 0.7, pass: 0.7, shoot: 0.6 } },
    { id: 'raam',     he: 'רעם הגליל',   en: 'GALILEE THUNDER', code: 'THN', ovr: 88, primary: '#4fb3ff', secondary: '#0b2a4a', shorts: '#0b2a4a', socks: '#4fb3ff', icon: 'storm', style: { press: 0.8, pass: 0.75, shoot: 0.7 } },
    { id: 'allstars', he: 'נבחרת העולם', en: 'WORLD XI',        code: 'WXI', ovr: 92, primary: '#f6f6f2', secondary: '#c9a24a', shorts: '#f6f6f2', socks: '#c9a24a', icon: 'star',  style: { press: 0.9, pass: 0.85, shoot: 0.8 } }
  ];

  TEAMS.forEach((t, ti) => {
    const r = seeded(97 + ti * 131);
    const pick = arr => arr[Math.floor(r() * arr.length)];
    const roles = ['GK', 'CB', 'CB', 'CB', 'CM', 'CM', 'CM', 'ST'];
    const nums = [1, 4, 5, 3, 8, 6, 10, 9];
    t.roster = roles.map((role, i) => {
      const ovr = Math.round(t.ovr + (r() * 8 - 4));
      const v = () => Math.max(40, Math.min(97, Math.round(ovr + (r() * 14 - 7))));
      const stats = role === 'GK'
        ? { div: v(), han: v(), kic: v() - 8, ref: v(), spd: v() - 15, pos: v() }
        : { pac: v(), sho: role === 'CB' ? v() - 18 : v(), pas: v(), dri: v(), def: role === 'ST' ? v() - 30 : v(), phy: v() };
      const first = pick(FIRST), last = pick(LAST);
      return { id: t.id + '_' + i, he: first + ' ' + last, shortHe: last, pos: role, num: nums[i], ovr, stats, gk: role === 'GK',
        hair: ['#151010', '#3b2a1c', '#6b4a2c', '#c9a46a', '#0d0d0d'][Math.floor(r() * 5)],
        skin: ['#e0b79a', '#c99a7a', '#a8775a', '#7a5238', '#d9a885'][Math.floor(r() * 5)],
        build: 0.95 + r() * 0.15 };
    });
  });
  const teamById = {};
  TEAMS.forEach(t => { teamById[t.id] = t; });

  // 8-a-side formations, coordinates normalised for a team attacking +x:
  // x: 0 own goal line → 1 opponent goal line; y: 0 near (camera) touchline → 1 far touchline.
  const FORMATIONS = {
    katzir: [ // 2-3-2
      { slot: 'GK',  x: 0.035, y: 0.5,  role: 'GK' },
      { slot: 'RCB', x: 0.2,   y: 0.32, role: 'DEF' },
      { slot: 'LCB', x: 0.2,   y: 0.68, role: 'DEF' },
      { slot: 'RM',  x: 0.44,  y: 0.15, role: 'MID' },
      { slot: 'CM',  x: 0.4,   y: 0.5,  role: 'MID' },
      { slot: 'LM',  x: 0.44,  y: 0.85, role: 'MID' },
      { slot: 'RS',  x: 0.68,  y: 0.38, role: 'FWD' },
      { slot: 'LS',  x: 0.66,  y: 0.64, role: 'FWD' }
    ],
    rival: [ // 3-3-1
      { slot: 'GK',  x: 0.035, y: 0.5,  role: 'GK' },
      { slot: 'RCB', x: 0.2,   y: 0.25, role: 'DEF' },
      { slot: 'CB',  x: 0.18,  y: 0.5,  role: 'DEF' },
      { slot: 'LCB', x: 0.2,   y: 0.75, role: 'DEF' },
      { slot: 'RM',  x: 0.45,  y: 0.2,  role: 'MID' },
      { slot: 'CM',  x: 0.42,  y: 0.5,  role: 'MID' },
      { slot: 'LM',  x: 0.45,  y: 0.8,  role: 'MID' },
      { slot: 'ST',  x: 0.7,   y: 0.5,  role: 'FWD' }
    ]
  };

  // Default lineup: the seven friends + Noam in goal, slot order as above.
  const DEFAULT_LINEUP = ['noam', 'gefen', 'sipko', 'erez', 'yiftach', 'ido', 'liam', 'shratzer'];

  const DIFFICULTY = {
    easy:   { he: 'קל',     ai: 0.55, react: 0.42, gk: 0.78 },
    normal: { he: 'רגיל',   ai: 0.74, react: 0.3,  gk: 0.92 },
    legend: { he: 'אגדה',   ai: 1.0,  react: 0.18, gk: 1.08 }
  };

  // Commentary lines. `audio` points to a recorded ElevenLabs clip when one exists;
  // everything else is read by the browser's Hebrew voice (if the device has one) and
  // always shown as a subtitle.
  const LINES = {
    kickoff:   { text: 'ערב טוב וברוכים הבאים לאצטדיון קציר! המשחק מתחיל!' },
    halftime:  { text: 'שריקת המחצית! איזה משחק אנחנו רואים פה הערב!' },
    win:       { text: 'שריקת הסיום! קציר אף סי מנצחת! איזה ערב בקציר!' },
    lose:      { text: 'שריקת הסיום. הפעם זה לא הלך, אבל קציר תחזור חזקה יותר.' },
    draw:      { text: 'שריקת הסיום! תיקו! משחק צמוד עד השנייה האחרונה.' },
    conceded:  { text: 'גול ליריבה. לא נורא, קציר עוד תחזור למשחק.', audio: 'assets/audio/vo_conceded.mp3' },
    save:      { text: 'איזו הצלה! השוער סוגר את השער!' },
    miss:      { text: 'כמעט! זה עבר ממש ליד הקורה!' },
    post:      { text: 'קורה! איזה מזל!' },
    liam_ball: { text: 'הכדור אצל ליאם שבת... כל האצטדיון עוצר את הנשימה!', audio: 'assets/audio/vo_liam_ball.mp3' },
    cup:       { text: 'קציר אף סי זוכה בגביע! האלופים! האלופים של קציר!' },
    goat_walkout: { text: 'ליאם שבת! הגואט! הטוב בכל הזמנים! וואמוס!', audio: 'assets/audio/vo_goat.mp3' },
    goal_liam: { text: 'גול! ליאם שבת! הגואט! הטוב בכל הזמנים! וואמוס!', audio: 'assets/audio/vo_goal_liam.mp3' },
    goal_ido:  { text: 'גול! עידו! שחקן המפתח עושה את זה שוב!', audio: 'assets/audio/vo_goal_ido.mp3' },
    goal_yiftach:  { text: 'גול! יפתח צימט! תשעים ותשע, ואתם רואים למה!' },
    goal_shratzer: { text: 'גול! יהונתן שרצר! איזו בעיטה מטורפת!' },
    goal_erez:     { text: 'גול! ארז פור! אי אפשר לעצור אותו!' },
    goal_gefen:    { text: 'גול! גפן אלמקייס! סיום מושלם!' },
    goal_sipko:    { text: 'גול! ספיקו כהן! שחקן מפתח, גול מפתח!' },
    goal_generic:  { text: 'גול! קציר אף סי מבקיעה! איזה גול!' }
  };

  return {
    EDITIONS, OUTFIELD, GK_KEYS, STAT_LABELS, STAT_HE, PLAYERS, byId, SPECIALS, specialById,
    KITS, TEAMS, teamById, FORMATIONS, DEFAULT_LINEUP, DIFFICULTY, LINES
  };
})();
