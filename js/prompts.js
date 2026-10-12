// פרומפטים ופענוח תשובות – משותף לדפדפן ולשרת (api/), כדי שהכללים יהיו זהים בשניהם.
import { STAPLES, CUISINES, INGREDIENTS, ALLERGENS, DIETS } from './data.js';
import { ingredientById, matchIngredient } from './engine.js';

export const CATS = ['dairy', 'protein', 'veg', 'fruit', 'carbs', 'sauces', 'other'];
const CATALOG = INGREDIENTS.map((i) => `${i.id}=${i.name}`).join(', ');

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

// ---------- זיהוי מצרכים ----------

export function detectPrompt(n) {
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

/** שורה אחת מהתשובה → פריט מאומת, {error}, או null */
export function parseLine(line) {
  const s = String(line).trim().replace(/,$/, '');
  if (!s.startsWith('{') || !s.endsWith('}')) return null;
  try {
    const o = JSON.parse(s);
    if (o && typeof o.error === 'string') return { error: o.error.slice(0, 200) };
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
export function lineReader(onLine) {
  let pending = '';
  return {
    push(delta) {
      const lines = (pending + delta).split('\n');
      pending = lines.pop();
      lines.forEach(onLine);
    },
    end() {
      if (pending.trim()) onLine(pending);
      pending = '';
    },
  };
}

// ---------- מתכונים ----------

/** קלט מתכונים מינימלי ומנוקה (מה שהדפדפן שולח לשרת) */
export function recipeInput(state) {
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const mode = state?.mode || {};
  return {
    pantry: (Array.isArray(state?.pantry) ? state.pantry : []).slice(0, 80)
      .map((p) => ({ name: str(p?.name, 60), qty: str(p?.qty, 40), note: str(p?.note, 120) }))
      .filter((p) => p.name),
    mode: {
      energy: ['full', 'ok', 'dead'].includes(mode.energy) ? mode.energy : 'ok',
      maxTime: mode.maxTime === 5 ? 5 : 15,
      noDishes: mode.noDishes === true,
      cuisine: CUISINES[mode.cuisine] ? mode.cuisine : null,
    },
    diets: (Array.isArray(state?.diets) ? state.diets : []).filter((d) => DIETS.some((x) => x.id === d)),
    allergens: (Array.isArray(state?.allergens) ? state.allergens : []).filter((a) => ALLERGENS.some((x) => x.id === a)),
    likes: Object.fromEntries(Object.entries(state?.likes || {})
      .filter(([c, n]) => CUISINES[c] && Number.isFinite(Number(n)))
      .map(([c, n]) => [c, Math.max(0, Math.min(999, Math.round(Number(n))))])),
  };
}

export function recipePrompt(input) {
  const { pantry, mode, diets, allergens, likes } = recipeInput(input);
  const pantryText = pantry.map((p) => `${p.name}${p.qty ? ` (${p.qty})` : ''}${p.note ? ` – ${p.note}` : ''}`).join('\n');
  const lines = [
    `זמן הכנה מקסימלי: ${mode.energy === 'dead' ? 6 : mode.maxTime} דקות`,
    mode.noDishes || mode.energy === 'dead' ? 'מקסימום כלי אחד לשטוף' : '',
    mode.cuisine ? `סגנון מטבח: ${CUISINES[mode.cuisine]}` : '',
    diets.length ? `תזונה: ${diets.map((d) => DIETS.find((x) => x.id === d)?.label || d).join(', ')}` : '',
    allergens.length ? `אלרגיות, אסור בהחלט: ${allergens.map((a) => ALLERGENS.find((x) => x.id === a)?.label || a).join(', ')}` : '',
  ].filter(Boolean);
  const liked = Object.entries(likes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => CUISINES[c]).join(', ');
  return [
    'אתה שף ישראלי. הצע 3 מתכונים מהירים וטעימים שמשתמשים אך ורק במה שיש בבית ובמוצרי היסוד, בלי לקנות שום דבר.',
    'העדף מצרכים שעומדים להתקלקל. צעדים קצרים וברורים בעברית.',
    '',
    `מה יש בבית:\n${pantryText}`,
    `מוצרי יסוד שתמיד יש: ${STAPLES.join(', ')}`,
    ...lines,
    liked ? `המשתמש נוטה לאהוב: ${liked}` : '',
    '',
    'ענה רק ב-JSON בצורה הזו:',
    `{"recipes": [{"title": string, "cuisine": one of ${Object.keys(CUISINES).map((c) => `"${c}"`).join(',')}, "time": minutes, "pans": number of pans or pots to wash, "calories": number, "protein": grams, "why": one sentence on why it fits now, "ingredients": [{"name": string, "qty": string, "optional": boolean}], "steps": [string]}]}`,
  ].filter((l) => l !== '').join('\n');
}

export const RECIPE_SCHEMA = {
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
export function cleanRecipe(r, i) {
  if (!r || typeof r.title !== 'string' || !Array.isArray(r.steps) || !Array.isArray(r.ingredients)) return null;
  const steps = r.steps.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, 400)).slice(0, 12);
  const ingredients = r.ingredients
    .filter((g) => g && typeof g.name === 'string' && g.name.trim())
    .slice(0, 20)
    .map((g) => ({ id: matchIngredient(g.name)?.id ?? null, name: g.name.trim().slice(0, 60), qty: typeof g.qty === 'string' ? g.qty.slice(0, 40) : '', optional: g.optional === true }));
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

/** מחלץ את רשימת המתכונים מכל צורה סבירה של תשובה */
export function recipesFrom(out) {
  const list = Array.isArray(out?.recipes) ? out.recipes : Array.isArray(out) ? out : [];
  return list.map(cleanRecipe).filter(Boolean).slice(0, 5);
}
