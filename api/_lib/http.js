// עזרי HTTP לפונקציות השרת (Web Request/Response).
import { createHash } from 'node:crypto';

export class HttpError extends Error {
  constructor(code, status, extra = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function fail(code, status, extra = {}) {
  return json({ error: code, ...extra }, status);
}

/** מריץ handler ומתרגם HttpError לתשובת JSON */
export function route(handler) {
  return async (request) => {
    try {
      return await handler(request);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.code, e.status, e.extra);
      console.error('[api]', e);
      return fail('server_error', 500);
    }
  };
}

/** קורא גוף JSON עם תקרת גודל */
export async function readJson(request, maxBytes) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new HttpError('payload_too_large', 413);
  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) throw new HttpError('payload_too_large', 413);
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    throw new HttpError('bad_request', 400);
  }
}

/** מזהה מכשיר אנונימי: 32 תווי hex שנוצרים באפליקציה */
export function deviceId(request) {
  const d = (request.headers.get('x-device') || '').trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(d)) throw new HttpError('bad_device', 400);
  return d;
}

/** כתובת IP מגובבת (לא שומרים IP גלוי) */
export function ipHash(request) {
  const ip = request.headers.get('x-real-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  return createHash('sha256').update(`${process.env.IP_SALT || 'smartpantry'}:${ip}`).digest('hex').slice(0, 24);
}

export const envNum = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};
