// שכבת ה-AI: זיהוי רכיבים מתמונה ויצירת מתכונים עם Claude.
// בלי מפתח API האפליקציה עובדת במצב הדגמה עם מנוע המתכונים המקומי.
import { DEMO_SCAN, STAPLES, CUISINES } from './data.js';
import { ingredientById, matchIngredient } from './engine.js';

const MODEL = 'claude-opus-5-5';
const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk@0.129.0';

let clientPromise = null;
let clientKey = null;

async function getClient(apiKey) {
  if (!clientPromise || clientKey !== apiKey) {
    clientKey = apiKey;
    clientPromise = import(SDK_URL).then(({ default: Anthropic }) =>
      // המפתח נשמר רק במכשיר של המשתמש; בגרסת פרודקשן יש להעביר את הקריאה לשרת.
      new Anthropic({ apiKey, dangerouslyAllowBrowser: true }),
    );
  }
  return clientPromise;
}

async function callJson(apiKey, { system, content, schema, maxTokens = 4000 }) {
  const client = await getClient(apiKey);
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') {
    throw new Error('הבקשה נדחתה על ידי מודל ה-AI. נסו תמונה אחרת.');
  }
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('לא התקבלה תשובה מה-AI');
  return JSON.parse(text);
}

// ---------- עיבוד תמונה / וידאו ----------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawToJpeg(source, w, h, max = 1280) {
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

/** ממיר קובץ תמונה ל-dataURL מוקטן */
export async function imageFileToDataUrl(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return drawToJpeg(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** שולף 3 פריימים מסרטון קצר (סריקת מדפים) */
export async function videoFileToFrames(file, count = 3) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  try {
    await new Promise((res, rej) => { video.onloadeddata = res; video.onerror = rej; });
    const frames = [];
    const dur = Number.isFinite(video.duration) ? video.duration : 3;
    for (let i = 0; i < count; i++) {
      video.currentTime = Math.min(dur - 0.05, (dur * (i + 0.5)) / count);
      await new Promise((res) => { video.onseeked = res; });
      frames.push(drawToJpeg(video, video.videoWidth, video.videoHeight, 1024));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- זיהוי רכיבים ----------

const DETECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'confidence', 'category', 'note', 'shelf_days'],
        properties: {
          name: { type: 'string', description: 'שם הרכיב בעברית, קצר' },
          confidence: { type: 'number' },
          category: { type: 'string', enum: ['dairy', 'protein', 'veg', 'fruit', 'carbs', 'sauces', 'other'] },
          note: { type: 'string', description: 'הערה קצרה (מצב, כמות, "פתוח", "נראה עייף") או מחרוזת ריקה' },
          shelf_days: { type: 'integer', description: 'הערכה כמה ימים נשארו עד שיתקלקל' },
        },
      },
    },
  },
};

export async function detectIngredients({ apiKey, images }) {
  if (!apiKey) {
    await new Promise((r) => setTimeout(r, 1800));
    return DEMO_SCAN.map((d) => ({
      name: ingredientById(d.id).name,
      confidence: d.confidence,
      note: d.note || '',
      category: ingredientById(d.id).cat,
      demo: true,
    }));
  }
  const content = images.map((dataUrl) => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: dataUrl.split(',')[1] },
  }));
  content.push({
    type: 'text',
    text:
      'אלה תמונות של מקרר/מזווה (אולי כמה פריימים מאותו סרטון). זהה כל מצרך מזון שנראה, כולל קופסאות פתוחות, ירקות ושאריות. ' +
      'אל תכפיל פריטים שמופיעים בכמה פריימים. אל תכלול מוצרים שאינם מזון. אם משהו לא ודאי – תן confidence נמוך.',
  });
  const out = await callJson(apiKey, {
    system: 'אתה מערכת ראייה ממוחשבת לזיהוי מצרכי מזון במקרר עבור אפליקציית בישול ישראלית. החזר שמות בעברית.',
    content,
    schema: DETECT_SCHEMA,
  });
  return out.items;
}

// ---------- יצירת מתכונים ----------

const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recipes'],
  properties: {
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'emoji', 'cuisine', 'time', 'pans', 'calories', 'protein', 'why', 'ingredients', 'steps'],
        properties: {
          title: { type: 'string' },
          emoji: { type: 'string' },
          cuisine: { type: 'string', enum: Object.keys(CUISINES) },
          time: { type: 'integer' },
          pans: { type: 'integer' },
          calories: { type: 'integer' },
          protein: { type: 'integer' },
          why: { type: 'string', description: 'משפט אחד למה זה מתאים עכשיו' },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'qty', 'optional'],
              properties: { name: { type: 'string' }, qty: { type: 'string' }, optional: { type: 'boolean' } },
            },
          },
          steps: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

export async function generateRecipes({ apiKey, state }) {
  const pantry = state.pantry.map((p) => `${p.name}${p.note ? ` (${p.note})` : ''}`).join(', ');
  const { mode } = state;
  const constraints = [
    `זמן מקסימלי: ${mode.energy === 'dead' ? 6 : mode.maxTime} דקות`,
    mode.noDishes || mode.energy === 'dead' ? 'מקסימום כלי אחד לשטוף' : null,
    mode.cuisine ? `סגנון: ${CUISINES[mode.cuisine]}` : null,
    state.diets.length ? `תזונה: ${state.diets.join(', ')}` : null,
    state.allergens.length ? `אלרגיות – אסור בהחלט: ${state.allergens.join(', ')}` : null,
  ].filter(Boolean).join('\n');
  const liked = Object.entries(state.likes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => CUISINES[c]).join(', ');

  const out = await callJson(apiKey, {
    system: 'אתה שף ישראלי שמציע מתכונים מהירים, טעימים ומדויקים בעברית, רק ממה שיש בבית.',
    content: [{
      type: 'text',
      text:
        `מה יש בבית: ${pantry}\n` +
        `מוצרי יסוד שתמיד יש: ${STAPLES.join(', ')}\n${constraints}\n` +
        (liked ? `המשתמש נוטה לאהוב: ${liked}\n` : '') +
        'הצע 3 מתכונים שמשתמשים אך ורק במה שיש בבית ובמוצרי היסוד – בלי "לקפוץ לסופר". ' +
        'העדף רכיבים שעומדים להתקלקל. צעדים קצרים וברורים.',
    }],
    schema: RECIPE_SCHEMA,
    maxTokens: 6000,
  });

  return out.recipes.map((r, i) => ({
    ...r,
    id: `ai:${Date.now()}:${i}`,
    ai: true,
    diets: [],
    allergens: [],
    ingredients: r.ingredients.map((ing) => ({ id: matchIngredient(ing.name)?.id ?? null, name: ing.name, qty: ing.qty, optional: ing.optional })),
  }));
}
