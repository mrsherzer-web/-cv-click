// מכסות, תוכניות (חינם / Premium), קודי Premium ונתוני שימוש לבעלים.
import { randomInt } from 'node:crypto';
import { pipeline, get } from './store.js';
import { HttpError, envNum } from './http.js';

const DAY = 86400;
const TZ = process.env.APP_TIMEZONE || 'Asia/Jerusalem';

/** תאריך מקומי בפורמט 2026-10-12 – החודש מתאפס ב-1 לחודש לפי שעון ישראל */
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
const month = () => today().slice(0, 7);

export function limits() {
  return {
    freeScans: envNum('FREE_SCANS_PER_MONTH', 5),
    freeRecipes: envNum('FREE_RECIPES_PER_MONTH', 10),
    premiumScansPerDay: envNum('PREMIUM_SCANS_PER_DAY', 30),
    premiumRecipesPerDay: envNum('PREMIUM_RECIPES_PER_DAY', 60),
    ipScansPerDay: envNum('IP_SCANS_PER_DAY', 15),
    globalScansPerDay: envNum('GLOBAL_SCANS_PER_DAY', 500),
    globalRecipesPerDay: envNum('GLOBAL_RECIPES_PER_DAY', 1500),
  };
}

const K = {
  prem: (d) => `prem:${d}`,
  devMonth: (d, kind) => `u:${d}:${kind}:${month()}`,
  devDay: (d, kind) => `u:${d}:${kind}:d:${today()}`,
  ipDay: (ip, kind) => `ip:${ip}:${kind}:${today()}`,
  globalDay: (kind) => `g:${kind}:${today()}`,
  globalMonth: (kind) => `g:${kind}:m:${month()}`,
  tokens: (dir) => `g:tok:${dir}:${month()}`,
  lastError: () => 'g:lasterr',
  code: (c) => `code:${c}`,
};

export async function planFor(device) {
  const L = limits();
  const [prem, scans, recipes] = await pipeline([
    ['GET', K.prem(device)],
    ['GET', K.devMonth(device, 'scan')],
    ['GET', K.devMonth(device, 'rcp')],
  ]);
  const scansUsed = Number(scans || 0);
  const recipesUsed = Number(recipes || 0);
  if (Number(prem) > Date.now()) return { plan: 'premium', premiumUntil: Number(prem), scansUsed, recipesUsed };
  return {
    plan: 'free',
    scansUsed,
    scansLimit: L.freeScans,
    scansLeft: Math.max(0, L.freeScans - scansUsed),
    recipesUsed,
    recipesLimit: L.freeRecipes,
    recipesLeft: Math.max(0, L.freeRecipes - recipesUsed),
  };
}

/**
 * תופס מכסה לפעולה אחת (סריקה / מתכונים).
 * מחזיר refund(all): all=true מחזיר הכל (תקלה אצלנו), all=false רק את מכסת המכשיר.
 */
export async function take(device, ip, kind) {
  const L = limits();
  const premium = Number(await get(K.prem(device))) > Date.now();
  const deviceKeys = [[K.devMonth(device, kind), 40 * DAY], [K.devDay(device, kind), 2 * DAY]];
  const sharedKeys = [
    [K.globalDay(kind), 3 * DAY],
    [K.globalMonth(kind), 400 * DAY],
    ...(kind === 'scan' ? [[K.ipDay(ip, kind), 2 * DAY]] : []),
  ];
  const keys = [...deviceKeys, ...sharedKeys];
  const res = await pipeline(keys.flatMap(([k, ttl]) => [['INCR', k], ['EXPIRE', k, ttl]]));
  const v = Object.fromEntries(keys.map(([k], i) => [k, Number(res[i * 2])]));

  let refunded = false;
  const refund = async (all = true) => {
    if (refunded) return;
    refunded = true;
    await pipeline((all ? keys : deviceKeys).map(([k]) => ['DECR', k])).catch(() => {});
  };

  const isScan = kind === 'scan';
  if (v[K.globalDay(kind)] > (isScan ? L.globalScansPerDay : L.globalRecipesPerDay)) {
    await refund();
    throw new HttpError('server_busy', 503);
  }
  if (isScan && !premium && v[K.ipDay(ip, kind)] > L.ipScansPerDay) {
    await refund();
    throw new HttpError('daily_limit', 429);
  }
  if (premium) {
    if (v[K.devDay(device, kind)] > (isScan ? L.premiumScansPerDay : L.premiumRecipesPerDay)) {
      await refund();
      throw new HttpError('daily_limit', 429);
    }
  } else if (v[K.devMonth(device, kind)] > (isScan ? L.freeScans : L.freeRecipes)) {
    await refund();
    throw new HttpError('quota_exceeded', 402, { plan: await planFor(device) });
  }
  return { premium, refund };
}

// ---------- נתוני שימוש לבעלים ----------

// מחיר לדולר למיליון טוקנים [קלט, פלט]
const PRICES = {
  'claude-fable-5-1': [10, 50],
  'claude-opus-5-5': [4, 20],
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-sonnet-5-5': [2, 10],
  'claude-sonnet-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
};

export async function recordUsage(usage) {
  if (!usage) return;
  const input = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  await pipeline([
    ['INCRBY', K.tokens('in'), input], ['EXPIRE', K.tokens('in'), 400 * DAY],
    ['INCRBY', K.tokens('out'), usage.output_tokens || 0], ['EXPIRE', K.tokens('out'), 400 * DAY],
  ]).catch(() => {});
}

export async function recordError(code, message) {
  await pipeline([['SET', K.lastError(), JSON.stringify({ code, message: String(message || '').slice(0, 300), at: Date.now() }), 'EX', 7 * DAY]]).catch(() => {});
}

export async function stats(model) {
  const [sd, sm, rd, rm, ti, to, le] = await pipeline([
    ['GET', K.globalDay('scan')], ['GET', K.globalMonth('scan')],
    ['GET', K.globalDay('rcp')], ['GET', K.globalMonth('rcp')],
    ['GET', K.tokens('in')], ['GET', K.tokens('out')],
    ['GET', K.lastError()],
  ]);
  const tokensIn = Number(ti || 0);
  const tokensOut = Number(to || 0);
  const price = PRICES[model];
  return {
    today: { scans: Number(sd || 0), recipes: Number(rd || 0) },
    month: {
      scans: Number(sm || 0),
      recipes: Number(rm || 0),
      tokensIn,
      tokensOut,
      estCostUsd: price ? Math.round(((tokensIn * price[0] + tokensOut * price[1]) / 1e6) * 100) / 100 : null,
    },
    lastError: le ? JSON.parse(le) : null,
  };
}

// ---------- קודי Premium ----------

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // בלי 0/O ו-1/I שמתבלבלים

function newCode() {
  const part = () => Array.from({ length: 4 }, () => ALPHA[randomInt(ALPHA.length)]).join('');
  return `SP-${part()}-${part()}-${part()}`;
}

/** "sp xxxx-xxxx xxxx" → "SP-XXXX-XXXX-XXXX", או null */
export function normalizeCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^SP/, '');
  if (s.length !== 12 || [...s].some((c) => !ALPHA.includes(c))) return null;
  return `SP-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

export async function mintCodes({ count, days, maxDevices, note }) {
  const codes = [];
  while (codes.length < count) {
    const code = newCode();
    const rec = { days, maxDevices, note, created: Date.now(), devices: [], until: null };
    const [ok] = await pipeline([['SET', K.code(code), JSON.stringify(rec), 'NX', 'EX', 730 * DAY]]);
    if (ok === 'OK') codes.push(code);
  }
  return codes;
}

async function loadCode(raw) {
  const code = normalizeCode(raw);
  if (!code) throw new HttpError('invalid_code', 400);
  const rec = JSON.parse((await get(K.code(code))) || 'null');
  if (!rec) throw new HttpError('invalid_code', 404);
  return { code, rec };
}

/** מפעיל קוד על המכשיר. אותו קוד עובד על עד maxDevices מכשירים, עם אותו תאריך תפוגה */
export async function redeem(device, raw) {
  const { code, rec } = await loadCode(raw);
  if (rec.revoked) throw new HttpError('invalid_code', 404);
  if (!rec.devices.includes(device)) {
    if (rec.devices.length >= rec.maxDevices) throw new HttpError('code_used', 409);
    rec.devices.push(device);
  }
  if (!rec.until) rec.until = Date.now() + rec.days * DAY * 1000;
  if (rec.until <= Date.now()) throw new HttpError('code_expired', 410);
  const current = Number(await get(K.prem(device))) || 0;
  const until = Math.max(current, rec.until);
  await pipeline([
    ['SET', K.prem(device), String(until), 'EX', Math.ceil((until - Date.now()) / 1000)],
    ['SET', K.code(code), JSON.stringify(rec), 'EX', Math.ceil((rec.until - Date.now()) / 1000) + 30 * DAY],
  ]);
  return planFor(device);
}

export async function lookupCode(raw) {
  const { code, rec } = await loadCode(raw);
  return { code, ...rec, devices: rec.devices.map((d) => d.slice(0, 8)) };
}

export async function revokeCode(raw) {
  const { code, rec } = await loadCode(raw);
  rec.revoked = true;
  await pipeline([
    ...rec.devices.map((d) => ['DEL', K.prem(d)]),
    ['SET', K.code(code), JSON.stringify(rec), 'EX', 90 * DAY],
  ]);
  return { code, revoked: true, devices: rec.devices.length };
}

/** הגבלת ניסיונות (למשל קודים שגויים או סיסמת ניהול שגויה) */
export async function limitAttempts(ip, kind, max) {
  const key = `ip:${ip}:${kind}:${today()}`;
  const [n] = await pipeline([['INCR', key], ['EXPIRE', key, 2 * DAY]]);
  if (Number(n) > max) throw new HttpError('too_many_attempts', 429);
}
