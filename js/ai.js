// שכבת ה-AI: זיהוי אמיתי של מה שיש בתמונה, ויצירת מתכונים.
//
// שני ערוצים אפשריים, לפי הסדר:
// 1. בתוך claude.ai – יכולת ה-sample של הארטיפקט: Claude מקבל את התמונה דרך החשבון של הצופה. בלי מפתח.
// 2. באתר עצמאי – מפתח Claude API שהמשתמש הדביק בפרופיל.
// אין ערוץ? מחזירים שגיאה ברורה. לעולם לא מחזירים רשימת הדגמה במקום תמונה אמיתית.
import { DEMO_SCAN, STAPLES, CUISINES, INGREDIENTS, ALLERGENS, DIETS } from './data.js';
import { ingredientById, matchIngredient } from './engine.js';

const MODEL = 'claude-opus-5-5';
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.126.0/+esm';
const CATS = ['dairy', 'protein', 'veg', 'fruit', 'carbs', 'sauces', 'other'];

/** שגיאה עם קוד, כדי שהממשק ידע מה להציע */
export class AiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// ---------- איזה ערוץ זמין ----------

let samplePromise = null;

/** יכולת ה-sample של claude.ai, או null מחוץ ל-claude.ai */
function getSample() {
  if (!samplePromise) {
    samplePromise = (async () => {
      try {
        if (!window.claude?.use) return null;
        const sample = await window.claude.use('sample');
        if (!sample) return null;
        const limits = await sample.limits().catch(() => null);
        return { sample, limits };
      } catch {
        return null;
      }
    })();
  }
  return samplePromise;
}

/**
 * מצב החיבור ל-AI:
 * 'claude' – בתוך claude.ai, אפשר לשלוח תמונות
 * 'key'    – מפתח API אישי
 * 'text'   – בתוך claude.ai בלי תמונות (מתכונים כן, סריקה לא)
 * 'none'   – אין חיבור
 */
export async function aiStatus(apiKey) {
  const s = await getSample();
  if (s?.limits?.images) return 'claude';
  if (apiKey) return 'key';
  if (s) return 'text';
  return 'none';
}

export async function imageLimit(apiKey) {
  const s = await getSample();
  if (s?.limits?.images) return Math.max(1, Math.min(6, s.limits.images.maxCount || 1));
  return apiKey ? 6 : 0;
}

// ---------- ערוץ מפתח API (אתר עצמאי) ----------

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

async function callApi(apiKey, { content, effort = 'medium', maxTokens = 8000, schema, signal }) {
  const client = await getClient(apiKey);
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: schema ? { effort, format: { type: 'json_schema', schema } } : { effort },
    messages: [{ role: 'user', content }],
  }, { signal });
  if (response.stop_reason === 'refusal') throw new AiError('refused', 'ה-AI סירב לעבד את הבקשה.');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (!text.trim()) throw new AiError('empty_completion', 'לא התקבלה תשובה מה-AI.');
  return text;
}

async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

// ---------- הכנת תמונות ----------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new AiError('image_rejected', 'לא הצלחתי לפתוח את התמונה.'));
    img.src = src;
  });
}

function drawCanvas(source, w, h, max) {
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(canvas, quality = 0.88) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new AiError('image_rejected', 'לא הצלחתי להכין את התמונה.'))), 'image/jpeg', quality));
}

/** צילום אחד: blob לשליחה (עד 1600px) + תצוגה מקדימה + תמונה ממוזערת */
async function makeShot(source, w, h) {
  const big = drawCanvas(source, w, h, 1600);
  return {
    blob: await canvasToBlob(big),
    preview: drawCanvas(source, w, h, 900).toDataURL('image/jpeg', 0.8),
    thumb: drawCanvas(source, w, h, 220).toDataURL('image/jpeg', 0.75),
  };
}

export async function imageFileToShot(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return await makeShot(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** סרטון קצר על המדפים → כמה פריימים */
export async function videoFileToShots(file, count = 4) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise((res, rej) => { video.onloadeddata = res; video.onerror = () => rej(new AiError('image_rejected', 'לא הצלחתי לפתוח את הסרטון.')); });
    const shots = [];
    const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 3;
    for (let i = 0; i < count; i++) {
      video.currentTime = Math.min(dur - 0.05, (dur * (i + 0.5)) / count);
      await new Promise((res) => { video.onseeked = res; });
      shots.push(await makeShot(video, video.videoWidth, video.videoHeight));
    }
    return shots;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- זיהוי מצרכים ----------

const CATALOG = INGREDIENTS.map((i) => `${i.id}=${i.name}`).join(', ');

function detectPrompt(n) {
  return [
    `You are the vision system of SmartPantry, an Israeli home-cooking app. The ${n > 1 ? `${n} attached photos show` : 'attached photo shows'} the inside of the user's fridge, freezer or pantry${n > 1 ? ' (different shelves, the door, drawers, or frames of one video)' : ''}.`,
    '',
    'Scan systematically: shelf by shelf from top to bottom, then the door shelves, then the drawers. Look at every container, jar, bottle, carton, bag, box and loose produce, including items that are partly hidden, at the back, or seen from the side. Read visible labels and brand text (Hebrew or English) to identify packaged products; for example a white tub labeled קוטג׳ is cottage cheese, a carton labeled שוקו is chocolate milk. For leftovers in containers, name the food you can see inside.',
    '',
    'Rules:',
    '- List only food and drink that is actually visible in the photos. Never add items that fridges usually have but that you cannot see.',
    '- When unsure what something is, give your best guess with confidence below 0.6 and say what you saw in "note".',
    '- An item visible in several photos is listed once. Identical units are one entry with a quantity ("6 ביצים", "2 עגבניות").',
    '- Names in Hebrew, short and specific, as written on the product when readable ("קוטג׳ 5%", "חלב 3%", "עגבניות שרי").',
    '',
    'Output JSON Lines: one JSON object per line and nothing else (no prose, no code fences, no array brackets). Each object:',
    '{"name": string, "match": catalog id or null, "category": one of "dairy","protein","veg","fruit","carbs","sauces","other", "qty": string, "confidence": number from 0 to 1, "shelf_days": whole number of days until it spoils judging by how it looks, "note": string, "" when nothing to add (mention if it looks old, wilted, opened or almost empty)}',
    '',
    `"match" is the id from this catalog when the item is that ingredient or a direct variant of it, otherwise null: ${CATALOG}`,
    '',
    'If the photos do not show the inside of a fridge, freezer or pantry, or no food is visible, output exactly one line: {"error": "short explanation in Hebrew"}',
  ].join('\n');
}

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** שורה אחת מהתשובה → פריט, {error}, או null */
function parseLine(line) {
  let s = line.trim().replace(/,$/, '');
  if (!s.startsWith('{') || !s.endsWith('}')) return null;
  try {
    const o = JSON.parse(s);
    if (o && typeof o.error === 'string') return { error: o.error };
    const name = typeof o?.name === 'string' ? o.name.trim() : '';
    if (!name) return null;
    const match = typeof o.match === 'string' && ingredientById(o.match) ? o.match : null;
    return {
      name: name.slice(0, 60),
      match,
      category: CATS.includes(o.category) ? o.category : (match ? ingredientById(match).cat : 'other'),
      qty: typeof o.qty === 'string' ? o.qty.slice(0, 40) : '',
      confidence: Math.min(1, Math.max(0, num(o.confidence, 0.8))),
      shelf_days: Math.round(Math.min(365, Math.max(0, num(o.shelf_days, 0)))) || undefined,
      note: typeof o.note === 'string' ? o.note.slice(0, 120) : '',
    };
  } catch {
    return null;
  }
}

/** מפרק טקסט זורם לשורות; קורא ל-onLine על כל שורה שלמה */
function lineReader(onLine) {
  let pending = '';
  return {
    push(delta) {
      const lines = (pending + delta).split('\n');
      pending = lines.pop();
      lines.forEach(onLine);
    },
    end() { if (pending.trim()) onLine(pending); pending = ''; },
  };
}

/**
 * מזהה מה יש בתמונות.
 * shots: [{blob}], onItem(item): נקרא על כל פריט ברגע שזוהה, signal: לעצירה.
 * מחזיר מערך פריטים. זורק AiError עם code.
 */
export async function detectIngredients({ apiKey, shots, onItem, signal, fresh = false }) {
  const items = [];
  let errorText = null;
  const reader = lineReader((line) => {
    const r = parseLine(line);
    if (!r) return;
    if (r.error) { errorText = r.error; return; }
    items.push(r);
    onItem?.(r);
  });

  const status = await aiStatus(apiKey);
  const prompt = detectPrompt(shots.length);

  if (status === 'claude') {
    const { sample } = await getSample();
    try {
      await sample(prompt, {
        images: shots.map((s) => s.blob),
        modelTier: 'default',
        effort: 'high',
        signal,
        onText: ({ delta }) => reader.push(delta),
        ...(fresh ? { cache: false } : {}),
      });
    } catch (e) {
      reader.end();
      const err = new AiError(e?.code || 'upstream_error', e?.message || 'scan failed');
      err.items = items; // מה שכבר זוהה לפני התקלה
      throw err;
    }
  } else if (status === 'key') {
    const content = await Promise.all(shots.map(async (s) => ({
      type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await blobToBase64(s.blob) },
    })));
    content.push({ type: 'text', text: prompt });
    let text;
    try {
      text = await callApi(apiKey, { content, effort: 'high', signal });
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (e?.name === 'AbortError' || signal?.aborted) throw new AiError('cancelled', 'cancelled');
      throw new AiError('upstream_error', e?.message || String(e));
    }
    reader.push(text);
  } else {
    throw new AiError(status === 'text' ? 'images_unavailable' : 'no_ai', 'no vision backend');
  }

  reader.end();
  if (!items.length) throw new AiError('nothing_found', errorText || '');
  return items;
}

/** מקרר לדוגמה – רק כשהמשתמש ביקש במפורש, ומסומן ככזה */
export async function demoIngredients({ onItem } = {}) {
  const items = [];
  for (const d of DEMO_SCAN) {
    await new Promise((r) => setTimeout(r, 140));
    const ing = ingredientById(d.id);
    const it = { name: ing.name, match: d.id, category: ing.cat, qty: '', confidence: d.confidence, note: d.note || '', demo: true };
    items.push(it);
    onItem?.(it);
  }
  return items;
}

// ---------- יצירת מתכונים ----------

function recipePrompt(state) {
  const pantry = state.pantry.map((p) => `${p.name}${p.qty ? ` (${p.qty})` : ''}${p.note ? ` – ${p.note}` : ''}`).join('\n');
  const { mode } = state;
  const lines = [
    `זמן הכנה מקסימלי: ${mode.energy === 'dead' ? 6 : mode.maxTime} דקות`,
    mode.noDishes || mode.energy === 'dead' ? 'מקסימום כלי אחד לשטוף' : '',
    mode.cuisine ? `סגנון מטבח: ${CUISINES[mode.cuisine]}` : '',
    state.diets.length ? `תזונה: ${state.diets.map((d) => DIETS.find((x) => x.id === d)?.label || d).join(', ')}` : '',
    state.allergens.length ? `אלרגיות, אסור בהחלט: ${state.allergens.map((a) => ALLERGENS.find((x) => x.id === a)?.label || a).join(', ')}` : '',
  ].filter(Boolean);
  const liked = Object.entries(state.likes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => CUISINES[c]).join(', ');
  return [
    'אתה שף ישראלי. הצע 3 מתכונים מהירים וטעימים שמשתמשים אך ורק במה שיש בבית ובמוצרי היסוד, בלי לקנות שום דבר.',
    'העדף מצרכים שעומדים להתקלקל. צעדים קצרים וברורים בעברית.',
    '',
    `מה יש בבית:\n${pantry}`,
    `מוצרי יסוד שתמיד יש: ${STAPLES.join(', ')}`,
    ...lines,
    liked ? `המשתמש נוטה לאהוב: ${liked}` : '',
    '',
    'ענה רק ב-JSON בצורה הזו:',
    `{"recipes": [{"title": string, "cuisine": one of ${Object.keys(CUISINES).map((c) => `"${c}"`).join(',')}, "time": minutes, "pans": number of pans or pots to wash, "calories": number, "protein": grams, "why": one sentence on why it fits now, "ingredients": [{"name": string, "qty": string, "optional": boolean}], "steps": [string]}]}`,
  ].filter((l) => l !== '').join('\n');
}

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
        required: ['title', 'cuisine', 'time', 'pans', 'calories', 'protein', 'why', 'ingredients', 'steps'],
        properties: {
          title: { type: 'string' },
          cuisine: { type: 'string', enum: Object.keys(CUISINES) },
          time: { type: 'integer' },
          pans: { type: 'integer' },
          calories: { type: 'integer' },
          protein: { type: 'integer' },
          why: { type: 'string' },
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

/** מנקה ומאמת מתכון שהגיע מה-AI */
function cleanRecipe(r, i) {
  if (!r || typeof r.title !== 'string' || !Array.isArray(r.steps) || !Array.isArray(r.ingredients)) return null;
  const steps = r.steps.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
  const ingredients = r.ingredients
    .filter((g) => g && typeof g.name === 'string' && g.name.trim())
    .map((g) => ({ id: matchIngredient(g.name)?.id ?? null, name: g.name.trim(), qty: typeof g.qty === 'string' ? g.qty : '', optional: g.optional === true }));
  if (!steps.length || !ingredients.length) return null;
  return {
    id: `ai:${Date.now()}:${i}`,
    ai: true,
    title: r.title.trim().slice(0, 80),
    cuisine: CUISINES[r.cuisine] ? r.cuisine : 'comfort',
    time: Math.round(Math.min(90, Math.max(1, num(r.time, 15)))),
    pans: Math.round(Math.min(4, Math.max(0, num(r.pans, 1)))),
    calories: Math.round(Math.max(0, num(r.calories, 0))),
    protein: Math.round(Math.max(0, num(r.protein, 0))),
    why: typeof r.why === 'string' ? r.why.trim().slice(0, 140) : '',
    diets: [],
    allergens: [],
    ingredients,
    steps,
  };
}

export async function generateRecipes({ apiKey, state, fresh = false, signal }) {
  const status = await aiStatus(apiKey);
  const prompt = recipePrompt(state);
  let out;
  if (status === 'claude' || status === 'text') {
    const { sample } = await getSample();
    try {
      out = await sample.json(prompt, { modelTier: 'default', signal, ...(fresh ? { cache: false } : {}) });
    } catch (e) {
      throw new AiError(e?.code || 'upstream_error', e?.message || 'recipes failed');
    }
  } else if (status === 'key') {
    try {
      out = JSON.parse(await callApi(apiKey, { content: [{ type: 'text', text: prompt }], effort: 'low', schema: RECIPE_SCHEMA, signal }));
    } catch (e) {
      if (e instanceof AiError) throw e;
      throw new AiError('upstream_error', e?.message || String(e));
    }
  } else {
    throw new AiError('no_ai', 'no AI backend');
  }
  const list = (Array.isArray(out?.recipes) ? out.recipes : Array.isArray(out) ? out : []).map(cleanRecipe).filter(Boolean);
  if (!list.length) throw new AiError('invalid_json', 'no recipes');
  return list;
}

/** פתיחת חלון ההרשאות של claude.ai (כשהצופה סירב קודם) */
export async function openPermissions() {
  const p = await window.claude?.use?.('permissions');
  if (!p) throw new AiError('unavailable', 'no permissions panel');
  await p.manage();
}
