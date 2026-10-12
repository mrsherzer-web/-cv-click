// מנוע ההתאמה: מזווה ⟵⟶ מתכונים, כולל העדפות, מצב אנרגיה ולמידה.
import { INGREDIENTS, RECIPES } from './data.js';

const DAY = 86400000;
const byId = new Map(INGREDIENTS.map((i) => [i.id, i]));

const clean = (s) => String(s || '').trim().toLowerCase().replace(/[׳'"]/g, '').replace(/\s+/g, ' ');

export function ingredientById(id) {
  return byId.get(id);
}

/** ממפה שם חופשי (מה-AI או מהמשתמש) לרכיב בקטלוג, אם אפשר */
export function matchIngredient(name) {
  const n = clean(name);
  if (!n) return null;
  let best = null;
  for (const ing of INGREDIENTS) {
    for (const alias of [ing.name, ...ing.aliases]) {
      const a = clean(alias);
      if (n === a) return ing;
      if (n.includes(a) || a.includes(n)) {
        if (!best || a.length > best.len) best = { ing, len: a.length };
      }
    }
  }
  return best && best.len >= 2 ? best.ing : null;
}

/**
 * יוצר פריט מזווה.
 * extra.match: מזהה קטלוג שה-AI בחר (null = במפורש לא בקטלוג; לא קיים = התאמה לפי שם).
 * extra.keepName: לשמור את השם הספציפי שזוהה (למשל "קוטג׳ 5%") במקום שם הקטלוג.
 */
export function toPantryItem(name, extra = {}) {
  const raw = String(name).trim();
  const ing = extra.match === null ? null : (extra.match && byId.get(extra.match)) || matchIngredient(raw);
  const now = Date.now();
  const shelf = Number.isFinite(extra.shelfDays) && extra.shelfDays > 0 ? extra.shelfDays : ing?.shelf ?? 7;
  const specific = extra.keepName && ing && clean(raw) !== clean(ing.name);
  return {
    key: ing ? (specific ? `${ing.id}:${clean(raw)}` : ing.id) : `custom:${clean(raw)}`,
    id: ing?.id ?? null,
    name: specific || !ing ? raw : ing.name,
    cat: ing?.cat ?? extra.cat ?? 'other',
    addedAt: now,
    expiresAt: now + shelf * DAY,
    note: extra.note || '',
    qty: extra.qty || '',
    confidence: extra.confidence ?? null,
  };
}

/** מאחד רשימה חדשה לתוך המזווה הקיים (ללא כפילויות) */
export function mergePantry(current, items) {
  const map = new Map(current.map((p) => [p.key, p]));
  for (const it of items) {
    const prev = map.get(it.key);
    map.set(it.key, prev ? { ...prev, ...it, addedAt: prev.addedAt, expiresAt: Math.min(prev.expiresAt, it.expiresAt) } : it);
  }
  return [...map.values()];
}

export function daysLeft(item) {
  return Math.ceil((item.expiresAt - Date.now()) / DAY);
}

export function freshness(item) {
  const d = daysLeft(item);
  if (d <= 1) return { level: 'urgent', label: d <= 0 ? 'להשתמש היום!' : 'נשאר יום' };
  if (d <= 3) return { level: 'soon', label: `עוד ${d} ימים` };
  return { level: 'ok', label: d > 60 ? 'מחזיק הרבה' : `עוד ${d} ימים` };
}

function dietOk(recipe, diets) {
  return diets.every((d) => {
    if (d === 'vegetarian') return recipe.diets.includes('vegetarian') || recipe.diets.includes('vegan');
    return recipe.diets.includes(d);
  });
}

/** מסנן ומדרג מתכונים לפי מה שיש בבית */
export function suggest(state, { limit = 4, includeAlmost = true } = {}) {
  const have = new Set(state.pantry.map((p) => p.id).filter(Boolean));
  const urgent = new Set(state.pantry.filter((p) => p.id && daysLeft(p) <= 3).map((p) => p.id));
  const { mode } = state;
  const maxTime = mode.energy === 'dead' ? 6 : mode.maxTime;
  const maxPans = mode.noDishes || mode.energy === 'dead' ? 1 : 9;
  const likesTotal = Object.values(state.likes).reduce((a, b) => a + b, 0) || 1;

  const results = [];
  for (const r of RECIPES) {
    if (!dietOk(r, state.diets)) continue;
    if (r.allergens.some((a) => state.allergens.includes(a))) continue;
    if (r.time > maxTime) continue;
    if (r.pans > maxPans) continue;
    if (mode.cuisine && r.cuisine !== mode.cuisine) continue;

    const has = (ing) => have.has(ing.id) || (ing.alt && have.has(ing.alt));
    const required = r.ingredients.filter((i) => !i.optional);
    const optional = r.ingredients.filter((i) => i.optional);
    const missing = required.filter((i) => !has(i));
    if (missing.length > (includeAlmost ? 1 : 0)) continue;
    const usedOptional = optional.filter(has);
    if (required.length === 0 && usedOptional.length === 0) continue;

    const usesUrgent = r.ingredients.filter((i) => has(i) && (urgent.has(i.id) || urgent.has(i.alt))).length;
    const like = (state.likes[r.cuisine] || 0) / likesTotal;
    const fav = state.favorites.includes(r.id) ? 1 : 0;
    const score =
      100 -
      missing.length * 45 +
      usedOptional.length * 6 +
      usesUrgent * 12 +
      like * 25 +
      fav * 10 +
      (15 - r.time) * 0.8;

    results.push({
      recipe: r,
      score,
      missing: missing.map((i) => ingredientById(i.id)?.name ?? i.id),
      usesUrgent,
      match: Math.round(((required.length - missing.length + usedOptional.length) / (required.length + optional.length)) * 100),
    });
  }
  results.sort((a, b) => b.score - a.score);
  return {
    ready: results.filter((x) => x.missing.length === 0).slice(0, limit),
    almost: results.filter((x) => x.missing.length === 1).slice(0, 3),
  };
}

export function recipeIngredientState(recipe, pantry) {
  const have = new Set(pantry.map((p) => p.id).filter(Boolean));
  return recipe.ingredients.map((i) => {
    const ing = ingredientById(i.id);
    // מתכוני AI בנויים רק ממה שיש – רכיב שלא מופה לקטלוג נחשב קיים
    const ok = !i.id || have.has(i.id) || (i.alt && have.has(i.alt));
    const altName = i.alt && !have.has(i.id) && have.has(i.alt) ? ingredientById(i.alt)?.name : null;
    return { ...i, name: i.name || ing?.name || i.id, ok, altName };
  });
}

/** הערכת חיסכון: הזמנה ממוצעת פחות עלות חומרי הגלם */
export function estimateSaving(recipe, deliveryCost) {
  const ingredientCost = 8 + recipe.ingredients.filter((i) => !i.optional).length * 4;
  return Math.max(15, Math.round(deliveryCost - ingredientCost));
}
