// שכבת ה-AI בצד האפליקציה.
//
// ערוצים, לפי הסדר:
// 1. השרת שלכם (api/) – בפרודקשן. המפתח של Claude נמצא רק בשרת, ולמשתמשים לא צריך שום חשבון.
// 2. claude.ai – כשהאפליקציה רצה כארטיפקט (תצוגה מקדימה), דרך החשבון של הצופה.
// אין ערוץ? שגיאה ברורה. לעולם לא מחזירים רשימה שלא זוהתה באמת.
import { DEMO_SCAN } from './data.js';
import { ingredientById } from './engine.js';
import { detectPrompt, parseLine, lineReader, recipePrompt, recipeInput, recipesFrom } from './prompts.js';

/** שגיאה עם קוד, כדי שהממשק ידע מה להציע */
export class AiError extends Error {
  constructor(code, message = '', extra = {}) {
    super(message || code);
    this.code = code;
    Object.assign(this, extra);
  }
}

// ---------- איזה ערוץ זמין ----------

let samplePromise = null;
function getSample() {
  samplePromise ||= (async () => {
    try {
      if (!window.claude?.use) return null;
      const sample = await window.claude.use('sample');
      if (!sample) return null;
      return { sample, limits: await sample.limits().catch(() => null) };
    } catch {
      return null;
    }
  })();
  return samplePromise;
}

let backendPromise = null;

/** { kind: 'server' | 'claude' | 'text' | 'none', cfg?, ... } */
export function backend() {
  backendPromise ||= (async () => {
    // בתוך claude.ai אין שרת משלנו – לא מנסים לפנות אליו
    if (!window.claude?.use) {
      try {
        const res = await fetch('api/config', { cache: 'no-store', headers: { accept: 'application/json' } });
        if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
          const cfg = await res.json();
          if (cfg?.server) return { kind: 'server', cfg };
        }
      } catch { /* אין שרת – למשל אתר סטטי */ }
    }
    const s = await getSample();
    if (s?.limits?.images) return { kind: 'claude', ...s };
    if (s) return { kind: 'text', ...s };
    return { kind: 'none' };
  })();
  return backendPromise;
}

/**
 * מצב החיבור לממשק:
 * 'server' – השרת מוכן · 'unconfigured' – יש שרת אבל חסר לו מפתח
 * 'claude' – בתוך claude.ai · 'text' – claude.ai בלי תמונות · 'none'
 */
export async function aiStatus() {
  const b = await backend();
  if (b.kind === 'server') return b.cfg.ready ? 'server' : 'unconfigured';
  return b.kind;
}

export async function serverConfig() {
  const b = await backend();
  return b.kind === 'server' ? b.cfg : null;
}

export async function imageLimit() {
  const b = await backend();
  if (b.kind === 'server') return b.cfg.maxImages || 5;
  if (b.kind === 'claude') return Math.max(1, Math.min(6, b.limits.images.maxCount || 1));
  return 0;
}

// ---------- קריאות לשרת ----------

async function serverJson(path, deviceId, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { 'content-type': 'application/json', 'x-device': deviceId },
      body: body ? JSON.stringify(body) : undefined,
      signal,
      cache: 'no-store',
    });
  } catch (e) {
    throw new AiError(signal?.aborted ? 'cancelled' : 'network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiError(data.error || 'upstream_error', '', { plan: data.plan });
  return data;
}

export const fetchPlan = (deviceId) => serverJson('api/me', deviceId);
export const redeemCode = (deviceId, code) => serverJson('api/redeem', deviceId, { method: 'POST', body: { code } });

// ---------- הכנת תמונות ----------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new AiError('image_rejected'));
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

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new AiError('image_rejected'))), 'image/jpeg', quality));
}

/** צילום אחד: blob לשליחה (1568px – הגודל המומלץ ל-Claude) + תצוגה מקדימה + תמונה ממוזערת */
async function makeShot(source, w, h) {
  return {
    blob: await canvasToBlob(drawCanvas(source, w, h, 1568), 0.82),
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
    await new Promise((res, rej) => { video.onloadeddata = res; video.onerror = () => rej(new AiError('image_rejected')); });
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

async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** מקטין תמונות אם הבקשה גדולה מדי לשרת (תקרה של כ-4MB) */
async function uploadImages(shots) {
  let images = await Promise.all(shots.map(async (s) => ({ type: 'image/jpeg', data: await blobToBase64(s.blob) })));
  const size = () => images.reduce((n, im) => n + im.data.length, 0);
  if (size() > 4_000_000) {
    images = await Promise.all(shots.map(async (s) => {
      const bmp = await createImageBitmap(s.blob);
      const small = await canvasToBlob(drawCanvas(bmp, bmp.width, bmp.height, 1100), 0.72);
      return { type: 'image/jpeg', data: await blobToBase64(small) };
    }));
  }
  if (size() > 4_300_000) throw new AiError('payload_too_large');
  return images;
}

// ---------- זיהוי מצרכים ----------

/**
 * מזהה מה יש בתמונות.
 * shots: [{blob}], onItem(item): נקרא על כל פריט ברגע שזוהה, onPlan(plan): מכסה מעודכנת.
 * זורק AiError עם code (ו-items שזוהו לפני תקלה, אם היו).
 */
export async function detectIngredients({ shots, deviceId, onItem, onPlan, signal, fresh = false }) {
  const items = [];
  const b = await backend();
  const push = (r) => { items.push(r); onItem?.(r); };
  const failWith = (code, message = '', extra = {}) => new AiError(code, message, { items: items.slice(), ...extra });

  if (b.kind === 'server') {
    if (!b.cfg.ready) throw failWith('not_configured');
    const images = await uploadImages(shots);
    let res;
    try {
      res = await fetch('api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-device': deviceId },
        body: JSON.stringify({ images }),
        signal,
      });
    } catch {
      throw failWith(signal?.aborted ? 'cancelled' : 'network');
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.plan) onPlan?.(j.plan);
      throw failWith(j.error || 'upstream_error', '', { plan: j.plan });
    }
    let error = null;
    const reader = lineReader((line) => {
      let m;
      try { m = JSON.parse(line); } catch { return; }
      if (m.t === 'item') push(m.item);
      else if (m.t === 'error') error = m;
      else if (m.t === 'done' && m.plan) onPlan?.(m.plan);
    });
    try {
      const dec = new TextDecoder();
      const body = res.body.getReader();
      for (;;) {
        const { value, done } = await body.read();
        if (done) break;
        reader.push(dec.decode(value, { stream: true }));
      }
      reader.end();
    } catch {
      throw failWith(signal?.aborted ? 'cancelled' : 'network');
    }
    if (error) throw failWith(error.code, error.message || '');
    if (!items.length) throw failWith('nothing_found');
    return items;
  }

  if (b.kind === 'claude') {
    let notFridge = '';
    const reader = lineReader((line) => {
      const r = parseLine(line);
      if (!r) return;
      if (r.error) notFridge = r.error;
      else push(r);
    });
    try {
      await b.sample(detectPrompt(shots.length), {
        images: shots.map((s) => s.blob),
        modelTier: 'default',
        effort: 'high',
        signal,
        onText: ({ delta }) => reader.push(delta),
        ...(fresh ? { cache: false } : {}),
      });
    } catch (e) {
      reader.end();
      throw failWith(e?.code || 'upstream_error');
    }
    reader.end();
    if (!items.length) throw failWith('nothing_found', notFridge);
    return items;
  }

  throw failWith(b.kind === 'text' ? 'images_unavailable' : 'no_ai');
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

// ---------- מתכונים ----------

export async function generateRecipes({ state, deviceId, onPlan, fresh = false, signal }) {
  const b = await backend();
  if (b.kind === 'server') {
    if (!b.cfg.ready) throw new AiError('not_configured');
    const data = await serverJson('api/recipes', deviceId, { method: 'POST', body: recipeInput(state), signal })
      .catch((e) => { if (e.plan) onPlan?.(e.plan); throw e; });
    if (data.plan) onPlan?.(data.plan);
    return data.recipes;
  }
  if (b.kind === 'claude' || b.kind === 'text') {
    let out;
    try {
      out = await b.sample.json(recipePrompt(state), { modelTier: 'default', signal, ...(fresh ? { cache: false } : {}) });
    } catch (e) {
      throw new AiError(e?.code || 'upstream_error');
    }
    const list = recipesFrom(out);
    if (!list.length) throw new AiError('invalid_json');
    return list;
  }
  throw new AiError('no_ai');
}

/** פתיחת חלון ההרשאות של claude.ai (כשהצופה סירב קודם) */
export async function openPermissions() {
  const p = await window.claude?.use?.('permissions');
  if (!p) throw new AiError('unavailable');
  await p.manage();
}
