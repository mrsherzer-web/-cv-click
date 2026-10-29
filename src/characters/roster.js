// The cast. Looks are drawn from the reference photos (hair, facial hair, skin tone, build, clothing style);
// prints and anything the photos don't show are original. Brand logos from the photos are not copied.
// Personalities and dialogue are written separately and are fictional.
export const ROSTER = {
  nehorai: {
    id: 'nehorai', name: 'נהוראי פרחי',
    look: 'שיער שחור קצר מאוד עם צדדים קצוצים, גבות כהות, מבנה אתלטי. טי שחורה, ג׳וגר אפור בהיר, סניקרס לבנות, שרשרת דקה.',
    skin: '#c8946e', height: 1.0, build: { shoulders: 1.06, arms: 1.1 },
    hair: { style: 'buzz', color: '#1b1512' }, brows: 1.2,
    top: { type: 'tee', color: '#17181b', print: 'sun' },
    bottom: { type: 'joggers', color: '#9aa0a7' },
    shoes: { type: 'sneakers', color: '#efede8', sole: '#2a2a2c', accent: '#f0a43a' },
    chain: true,
  },
  avraham: {
    id: 'avraham', name: 'אברהם שזגר',
    look: 'שיער כהה קצר עם פוני ופייד, זקן קצר ומסודר ושפם, גבות עבות. טי רחבה בצבע פחם, מכנסי זית, סניקרס שחורות.',
    skin: '#c08b66', height: 1.0, build: {},
    hair: { style: 'crop', color: '#16110e' }, brows: 1.35,
    facial: { beard: 'short', mustache: true, color: '#1d1511' },
    top: { type: 'oversized', color: '#3f4247', print: 'lines', printColor: '#e8e6e1' },
    bottom: { type: 'pants', color: '#5b5a45' },
    shoes: { type: 'sneakers', color: '#1e1f22', sole: '#e9e7e2', accent: '#e9e7e2' },
  },
  yonati: {
    id: 'yonati', name: 'יונתי',
    look: 'שיער חום כהה קצר עם פוני, זיפים, חיוך רחב. טי אפורה, מכנסיים קצרים בירוק מרווה, כפכפים לבנים, שעון שחור.',
    skin: '#c99a76', height: 0.98, build: {},
    hair: { style: 'crop', color: '#2a1d15' }, brows: 1.15,
    facial: { beard: 'stubble', color: '#2a1d15' },
    top: { type: 'tee', color: '#8d9096' },
    bottom: { type: 'shorts', color: '#7c8a74' },
    shoes: { type: 'slides', color: '#f1f1ee', sole: '#26272a' },
    watch: true,
  },
  erez: {
    id: 'erez', name: 'ארז פור',
    look: 'שיער כהה קצר, עור בהיר. ז׳קט פליז אפור עם רוכסן, ג׳וגר שחור, מגפוני זמש בצבע חום בהיר.',
    skin: '#d6aa86', height: 1.0, build: { shoulders: 1.02 },
    hair: { style: 'crop', color: '#1c1613' }, brows: 1.1,
    top: { type: 'zip', color: '#55595f', print: 'tag' },
    bottom: { type: 'joggers', color: '#1d1e21' },
    shoes: { type: 'boots', color: '#b08a5e', sole: '#5a4a3a' },
  },
  muller: {
    id: 'muller', name: 'מולר',
    look: 'שיער חום בינוני עם נפח ופוני, עור בהיר, גבוה ורזה. טי שחורה עם הדפס צבעוני קטן, מכנסיים קצרים שחורים, כפכפים לבנים, שעון שחור.',
    skin: '#dfb28c', height: 1.03, build: { shoulders: 0.98 },
    hair: { style: 'fluffy', color: '#5a3d27' }, brows: 1.0,
    top: { type: 'tee', color: '#16171a', print: 'dots' },
    bottom: { type: 'shorts', color: '#1f2023' },
    shoes: { type: 'slides', color: '#f2f2ef', sole: '#232427' },
    watch: true,
  },
  dolev: {
    id: 'dolev', name: 'דולב דורון',
    look: 'שיער כהה מתולתל מעל צדדים קצוצים, שפם דק וזיפים, גבות עבות, עור שזוף. טי צהובה, מכנסיים קצרים כחול כהה, שעון ספורט שחור, שרשרת כסף.',
    skin: '#b98360', height: 1.0, build: { shoulders: 1.02, arms: 1.05 },
    hair: { style: 'curly', color: '#17110d' }, brows: 1.3,
    facial: { beard: 'stubble', mustache: true, color: '#1e1610' },
    top: { type: 'tee', color: '#f2c230', print: 'ring', printColor: '#1f2d4a' },
    bottom: { type: 'shorts', color: '#1c2740' },
    shoes: { type: 'sneakers', color: '#f3f3f0', sole: '#1b1b1d', accent: '#1f2d4a' },
    watch: true, chain: true,
  },
};

export const CAST_ORDER = ['nehorai', 'avraham', 'yonati', 'erez', 'muller', 'dolev'];
