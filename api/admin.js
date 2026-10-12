// ניהול לבעלים: סטטיסטיקה, יצירת קודי Premium, בדיקה וביטול. מוגן ב-ADMIN_TOKEN.
import { createHash, timingSafeEqual } from 'node:crypto';
import { route, json, readJson, ipHash, HttpError } from './_lib/http.js';
import { stats, mintCodes, lookupCode, revokeCode, limits, limitAttempts } from './_lib/quota.js';
import { storageKind } from './_lib/store.js';
import { model } from './_lib/claude.js';

async function authorize(request) {
  const want = process.env.ADMIN_TOKEN || '';
  if (want.length < 16) throw new HttpError('admin_disabled', 503);
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = createHash('sha256').update(got).digest();
  const b = createHash('sha256').update(want).digest();
  if (!timingSafeEqual(a, b)) {
    await limitAttempts(ipHash(request), 'adminfail', 20);
    throw new HttpError('unauthorized', 401);
  }
}

const int = (v, min, max, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

export const GET = route(async (request) => {
  await authorize(request);
  const m = model();
  return json({ ready: Boolean(process.env.ANTHROPIC_API_KEY), storage: storageKind, model: m, limits: limits(), ...(await stats(m)) });
});

export const POST = route(async (request) => {
  await authorize(request);
  const body = await readJson(request, 16 * 1024);
  switch (body?.action) {
    case 'mint':
      return json({
        codes: await mintCodes({
          count: int(body.count, 1, 200, 1),
          days: int(body.days, 1, 800, 30),
          maxDevices: int(body.maxDevices, 1, 5, 2),
          note: String(body.note || '').slice(0, 80),
        }),
      });
    case 'lookup':
      return json(await lookupCode(body.code));
    case 'revoke':
      return json(await revokeCode(body.code));
    default:
      throw new HttpError('bad_request', 400);
  }
});
