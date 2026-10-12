// סריקת מקרר: מקבל תמונות, מחזיר מצרכים בזרם NDJSON (שורה לכל מצרך, ברגע שזוהה).
import { route, readJson, deviceId, ipHash, envNum, HttpError } from './_lib/http.js';
import { take, planFor, recordUsage, recordError } from './_lib/quota.js';
import { scan, mapError } from './_lib/claude.js';
import { parseLine, lineReader } from '../js/prompts.js';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const MAX_BODY = 4.4 * 1024 * 1024; // מתחת לתקרת 4.5MB של Vercel

export const POST = route(async (request) => {
  const device = deviceId(request);
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError('not_configured', 503);

  const body = await readJson(request, MAX_BODY);
  const max = Math.min(6, Math.max(1, envNum('MAX_IMAGES', 5)));
  const images = Array.isArray(body?.images) ? body.images : [];
  if (!images.length || images.length > max) throw new HttpError('bad_request', 400, { reason: 'images' });
  for (const im of images) {
    const ok = im && TYPES.includes(im.type) && typeof im.data === 'string' && im.data.length > 100 && BASE64.test(im.data);
    if (!ok) throw new HttpError('bad_request', 400, { reason: 'image' });
  }

  const { refund } = await take(device, ipHash(request), 'scan');
  const ctl = new AbortController();
  request.signal?.addEventListener?.('abort', () => ctl.abort());
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try { controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`)); } catch { /* הלקוח התנתק */ }
      };
      let count = 0;
      let notFridge = '';
      const reader = lineReader((line) => {
        const r = parseLine(line);
        if (!r) return;
        if (r.error) { notFridge = r.error; return; }
        count += 1;
        send({ t: 'item', item: r });
      });
      try {
        const final = await scan({ images, signal: ctl.signal, onText: (d) => reader.push(d) });
        reader.end();
        await recordUsage(final.usage);
        if (count) {
          send({ t: 'done', count, plan: await planFor(device) });
        } else {
          await refund(false); // לא נספר למשתמש, אבל נספר במגבלות הכלליות
          send({ t: 'error', code: 'nothing_found', message: notFridge });
        }
      } catch (e) {
        reader.end();
        const err = mapError(e);
        if (err.code !== 'cancelled') {
          await recordError(err.code, e?.message);
          if (!count) await refund(true);
        }
        send({ t: 'error', code: err.code });
      } finally {
        try { controller.close(); } catch { /* כבר נסגר */ }
      }
    },
    cancel() {
      ctl.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
});
