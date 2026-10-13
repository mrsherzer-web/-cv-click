// ─────────────────────────────────────────────────────────────
//  כל התוכן של האתר במקום אחד.
//  לפני העלייה לאוויר: לעדכן טלפון, אינסטגרם, מייל ומחירים.
// ─────────────────────────────────────────────────────────────

export const contact = {
  // מספר וואטסאפ בפורמט בינלאומי, בלי + ובלי 0 בהתחלה (050-1234567 → 972501234567)
  whatsapp: "972549486896",
  instagram: "https://instagram.com/",
  youtube: "https://youtube.com/",
  email: "hello@example.com",
};

export type License = {
  id: string;
  name: string;
  short: string;
  price: number | null; // null = בהצעה
  files: string;
  perks: string[];
  featured?: boolean;
};

export const licenses: License[] = [
  {
    id: "mp3",
    name: "MP3 Lease",
    short: "MP3",
    price: 149,
    files: "MP3 · 320kbps",
    perks: ["עד 10,000 השמעות בסטרימינג", "הופעות לא מסחריות", "קרדיט חובה: prod. Gal Shemesh"],
  },
  {
    id: "wav",
    name: "WAV Lease",
    short: "WAV",
    price: 249,
    files: "WAV + MP3",
    perks: ["עד 100,000 השמעות", "קליפ אחד ביוטיוב", "הופעות בתשלום", "קרדיט חובה"],
    featured: true,
  },
  {
    id: "stems",
    name: "Trackout",
    short: "STEMS",
    price: 499,
    files: "כל הסטמים ב-WAV",
    perks: ["עד 500,000 השמעות", "שליטה מלאה במיקס", "קליפים ללא הגבלה", "קרדיט חובה"],
  },
  {
    id: "exclusive",
    name: "Exclusive",
    short: "EXCL",
    price: null,
    files: "סטמים + קובץ פרויקט FL",
    perks: ["בעלות בלעדית על הביט", "השמעות ללא הגבלה", "הביט יורד מהחנות", "חוזה מסודר"],
  },
];

export type Beat = {
  id: string;
  title: string;
  genre: string;
  mood: string;
  bpm: number;
  key: string;
  tags: string[];
  isNew?: boolean;
  // קובץ אודיו אמיתי של הביט (MP3 עם תג). כשהשדה ריק, האתר מנגן
  // סקיצה שמסונתזת בדפדפן לפי הנתונים ב-pattern.
  audio?: string;
  pattern: BeatPattern;
};

export type Instrument = "bell" | "pluck" | "pad" | "keys";

export type BeatPattern = {
  root: number; // MIDI note של הטוניקה (באוקטבה של ה-808)
  chords: number[][]; // אקורד לכל תיבה, במרווחים מהטוניקה
  kick: string; // 16 צעדים לכל תיבה: x = מכה, . = שקט
  clap: string;
  hat: string; // r = רול של שלישיות, o = היי-האט פתוח
  bass: string; // x = 808 על שורש האקורד, h = אוקטבה למעלה, g = גלייד
  arp: string; // אינדקס בתוך האקורד (0-3), . = שקט, - = המשך
  lead: Instrument;
  swing?: number;
  pad?: boolean;
};

export const beats: Beat[] = [
  {
    id: "red-line",
    title: "Red Line",
    genre: "Trap",
    mood: "חשוך",
    bpm: 142,
    key: "C#m",
    tags: ["Trap", "Dark", "Bells"],
    isNew: true,
    pattern: {
      root: 37,
      chords: [[0, 3, 7, 12], [-4, 0, 3, 8], [-2, 2, 5, 10], [-5, -2, 2, 7]],
      kick: "x.....x...x.....",
      clap: "........x.......",
      hat: "x.x.x.x.x.xrx.x.",
      bass: "x.....x...g.....",
      arp: "0.2.1.3.2.1.0...",
      lead: "bell",
    },
  },
  {
    id: "blue-hour",
    title: "Blue Hour",
    genre: "R&B",
    mood: "רומנטי",
    bpm: 92,
    key: "Fm",
    tags: ["R&B", "Smooth", "Keys"],
    pattern: {
      root: 41,
      chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -3, 0, 5], [-2, 2, 5, 9]],
      kick: "x......x..x.....",
      clap: "....x.......x...",
      hat: "x.x.x.x.x.x.x.xx",
      bass: "x......x..x.....",
      arp: "0-1-2-3-2-1-....",
      lead: "keys",
      swing: 0.16,
      pad: true,
    },
  },
  {
    id: "platform-2",
    title: "Platform 2",
    genre: "Drill",
    mood: "אגרסיבי",
    bpm: 144,
    key: "Gm",
    tags: ["UK Drill", "Slides", "Choir"],
    isNew: true,
    pattern: {
      root: 43,
      chords: [[0, 3, 7, 12], [1, 5, 8, 13], [0, 3, 7, 12], [-2, 2, 5, 10]],
      kick: "x.........x.....",
      clap: "....x.......x...",
      hat: "x..x..x.x..xrx..",
      bass: "x..g......x..h..",
      arp: "0---1---2---1---",
      lead: "pad",
      swing: 0.08,
    },
  },
  {
    id: "sunburn",
    title: "Sunburn",
    genre: "Afrobeat",
    mood: "קיצי",
    bpm: 104,
    key: "Am",
    tags: ["Afro", "Bouncy", "Pluck"],
    pattern: {
      root: 45,
      chords: [[0, 3, 7, 10], [-4, 0, 3, 8], [-9, -5, -2, 3], [-2, 2, 5, 10]],
      kick: "x..x..x...x..x..",
      clap: "....x..x....x...",
      hat: "..x...x...x...x.",
      bass: "x..x......x..x..",
      arp: "0.1.2.0..2.1.3..",
      lead: "pluck",
      swing: 0.12,
    },
  },
  {
    id: "no-signal",
    title: "No Signal",
    genre: "Trap",
    mood: "מאיים",
    bpm: 150,
    key: "Em",
    tags: ["Dark Trap", "808", "Pad"],
    pattern: {
      root: 40,
      chords: [[0, 3, 7, 11], [1, 4, 8, 13], [0, 3, 7, 11], [-1, 3, 6, 11]],
      kick: "x.......x.x.....",
      clap: "........x.......",
      hat: "x.xrx.x.x.x.xrxr",
      bass: "x.......g.x.....",
      arp: "0.......2...1...",
      lead: "bell",
      pad: true,
    },
  },
  {
    id: "last-train",
    title: "Last Train",
    genre: "Boom Bap",
    mood: "נוסטלגי",
    bpm: 86,
    key: "Dm",
    tags: ["Boom Bap", "Lo-Fi", "Keys"],
    pattern: {
      root: 38,
      chords: [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 2, 5, 9], [-5, -2, 2, 5]],
      kick: "x.....x.x.......",
      clap: "....x.......x...",
      hat: "x.x.x.x.x.x.x.x.",
      bass: "x.....x.x.......",
      arp: "0-2-1-3-..2-1-..",
      lead: "keys",
      swing: 0.22,
    },
  },
  {
    id: "mazal",
    title: "Mazal",
    genre: "Mizrahi Trap",
    mood: "מזרחי",
    bpm: 128,
    key: "Bm",
    tags: ["Mizrahi", "Hijaz", "Dancehall"],
    pattern: {
      root: 35,
      chords: [[0, 4, 7, 13], [1, 5, 8, 13], [0, 4, 7, 12], [-2, 1, 5, 10]],
      kick: "x..x...x..x.....",
      clap: "...x..x....x..x.",
      hat: "x.x.x.x.x.x.x.x.",
      bass: "x..x...x..x.....",
      arp: "0.1.2.1.3.2.1.0.",
      lead: "pluck",
    },
  },
  {
    id: "night-shift",
    title: "Night Shift",
    genre: "Melodic Trap",
    mood: "מלנכולי",
    bpm: 136,
    key: "F#m",
    tags: ["Melodic", "Emotional", "Pad"],
    pattern: {
      root: 42,
      chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-9, -5, -2, 3], [-7, -4, 0, 5]],
      kick: "x.........x..x..",
      clap: "........x.......",
      hat: "x.x.x.xrx.x.x.x.",
      bass: "x.........x..g..",
      arp: "0-1-2-3-2-1-0-1-",
      lead: "bell",
      pad: true,
    },
  },
];

// הפטרן של ה-Channel Rack בראש העמוד (אפשר לשנות בלחיצה)
export const heroPattern = {
  bpm: 140,
  rows: [
    { id: "kick", label: "Kick", steps: "x.....x...x....." },
    { id: "clap", label: "Clap", steps: "........x......." },
    { id: "hat", label: "Hat", steps: "x.x.x.x.x.xxx.x." },
    { id: "bass", label: "808", steps: "x.....x...x....." },
  ],
};

export type LessonPlan = {
  id: string;
  name: string;
  sessions: string;
  price: number;
  per?: string;
  blurb: string;
  includes: string[];
  featured?: boolean;
};

export const lessonPlans: LessonPlan[] = [
  {
    id: "single",
    name: "שיעור בודד",
    sessions: "60 דקות",
    price: 200,
    blurb: "נתקעת על משהו ספציפי? 808 שלא יושב, מיקס עכור, ביט שלא נגמר. מגיעים עם פרויקט ויוצאים עם פתרון.",
    includes: ["שיעור אחד בזום או פרונטלי", "הקלטה של השיעור", "עבודה על הפרויקט שלך"],
  },
  {
    id: "pack",
    name: "חבילת 4 שיעורים",
    sessions: "4 × 60 דקות",
    price: 720,
    per: "₪180 לשיעור",
    blurb: "מבסיס עד ביט ראשון שלם. בונים יחד ביט מאפס, צעד אחרי צעד, ואתה יוצא עם שיטת עבודה.",
    includes: ["4 שיעורים אישיים", "הקלטות של כל השיעורים", "קיט סאונדים למתחילים", "ליווי בוואטסאפ בין השיעורים"],
    featured: true,
  },
  {
    id: "full",
    name: "מסלול מלא",
    sessions: "8 × 75 דקות",
    price: 1280,
    per: "₪160 לשיעור",
    blurb: "כל התהליך: מהקליק הראשון ב-FL ועד ביט מוכסס שמוכן לשליחה לאמן. כולל משימות בין המפגשים.",
    includes: ["8 שיעורים אישיים", "קבצי הפרויקט של גל", "קיט סאונדים מלא", "פידבק על 3 ביטים שלך", "ליווי צמוד בוואטסאפ"],
  },
];

export const curriculum = [
  { n: "01", title: "היכרות עם FL Studio", body: "Channel Rack, Playlist ו-Piano Roll. שיטת עבודה מהירה וקיצורי מקלדת שחוסכים שעות." },
  { n: "02", title: "תופים שמחזיקים ביט", body: "בניית גרוב, היי-האטים עם רולים, velocity ו-swing. איך לגרום ללופ של תיבה אחת להרגיש חי." },
  { n: "03", title: "808 וסאב", body: "טיונינג, גלייד, דיסטורשן. ואיך לגרום ל-808 להישמע טוב גם ברמקול של טלפון." },
  { n: "04", title: "מלודיות ואקורדים", body: "סולמות, מהלכי אקורדים ותיאוריה בדיוק כמה שצריך. בלי לדעת לנגן." },
  { n: "05", title: "סאונד דיזיין וסמפלים", body: "Serum, Vital ו-Sytrus. צ'ופים, סמפלים מהקלטות ובניית סאונד משלך." },
  { n: "06", title: "עיבוד ומבנה", body: "מלופ של 8 תיבות לביט שלם: פתיח, בית, פזמון, מעברים וכל מה שמחזיק את האמן בפנים." },
  { n: "07", title: "מיקס ומאסטר", body: "ראוטינג במיקסר, EQ, קומפרסיה, סייד-צ'יין ולאודנס. שהביט יעמוד ליד מה שמתנגן ברדיו." },
  { n: "08", title: "מהביט לאמן", body: "ייצוא סטמים, תיוג, שליחת ביטים לאמנים, BeatStars ותמחור. הצד העסקי של ההפקה." },
];

export const faq = [
  {
    q: "איך קונים ביט ומתי מקבלים את הקבצים?",
    a: "בוחרים ביט ורישיון, מוסיפים לעגלה ושולחים הזמנה. ההזמנה נפתחת בוואטסאפ, גל חוזר אליך עם קישור לתשלום (ביט, פייבוקס או כרטיס אשראי) והקבצים נשלחים אליך מיד אחרי התשלום, בלי תג קולי.",
  },
  {
    q: "מה ההבדל בין Lease ל-Exclusive?",
    a: "ב-Lease אתה מקבל זכות להשתמש בביט בשיר שלך, עם תקרת השמעות. הביט נשאר בחנות ואמנים אחרים יכולים לקנות אותו גם. ב-Exclusive הביט שלך בלבד: הוא יורד מהחנות, אין תקרה, ומקבלים את כל קבצי הפרויקט.",
  },
  {
    q: "אפשר להזמין ביט בהתאמה אישית?",
    a: "כן. שולחים רפרנסים, טמפו וכיוון, ובונים ביט מאפס בשבילך. אפשר גם לשבת יחד באולפן או בזום ולהפיק את זה ביחד.",
  },
  {
    q: "אני מתחיל מאפס. השיעורים מתאימים לי?",
    a: "בדיוק בשבילך. לא צריך לדעת לנגן ולא צריך רקע בתיאוריה. מתחילים מההתקנה וממה שאתה כבר שומע בראש, ובונים משם.",
  },
  {
    q: "איזו גרסה של FL Studio צריך?",
    a: "כל גרסה מ-FL Studio 20 ומעלה. לשיעור הראשון מספיקה גם גרסת הניסיון החינמית, ונעבור יחד על מה שבאמת שווה לקנות.",
  },
  {
    q: "השיעורים בזום או פרונטליים?",
    a: "שניהם. בזום עובדים עם שיתוף מסך ואודיו באיכות גבוהה, ופרונטלית עובדים יחד על אותו מחשב. כל שיעור מוקלט ונשלח אליך.",
  },
];

export const formatPrice = (n: number | null) => (n === null ? "בהצעה" : `₪${n.toLocaleString("he-IL")}`);

export const waLink = (text: string) => `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(text)}`;

// טבלת ההשוואה בין הרישיונות (עמודות לפי הסדר של licenses)
export const licenseMatrix: { label: string; values: (string | boolean)[] }[] = [
  { label: "קבצים", values: ["MP3", "WAV + MP3", "סטמים ב-WAV", "סטמים + פרויקט FL"] },
  { label: "השמעות בסטרימינג", values: ["10K", "100K", "500K", "ללא הגבלה"] },
  { label: "קליפים ביוטיוב", values: [false, "1", "ללא הגבלה", "ללא הגבלה"] },
  { label: "הופעות בתשלום", values: [false, true, true, true] },
  { label: "שליטה מלאה במיקס", values: [false, false, true, true] },
  { label: "הביט יורד מהחנות", values: [false, false, false, true] },
];
