// אחסון קטן למונים ולקודים: Upstash Redis (REST) בפרודקשן, זיכרון בפיתוח.
// Upstash מחובר דרך Vercel Marketplace ומגדיר את המשתנים לבד.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

export const storageKind = URL_ && TOKEN ? 'redis' : 'memory';

const mem = new Map(); // key -> { v, exp }

function memGet(k) {
  const e = mem.get(k);
  if (!e) return null;
  if (e.exp && e.exp < Date.now()) { mem.delete(k); return null; }
  return e.v;
}

function memCmd([cmd, key, ...args]) {
  switch (String(cmd).toUpperCase()) {
    case 'GET': return memGet(key);
    case 'SET': {
      const opts = args.slice(1).map(String);
      if (opts.includes('NX') && memGet(key) !== null) return null;
      const ex = opts.indexOf('EX');
      const px = opts.indexOf('PX');
      const exp = ex >= 0 ? Date.now() + Number(opts[ex + 1]) * 1000 : px >= 0 ? Date.now() + Number(opts[px + 1]) : 0;
      mem.set(key, { v: String(args[0]), exp });
      return 'OK';
    }
    case 'INCRBY':
    case 'INCR':
    case 'DECR': {
      const by = cmd.toUpperCase() === 'DECR' ? -1 : cmd.toUpperCase() === 'INCRBY' ? Number(args[0]) : 1;
      const cur = Number(memGet(key) || 0) + by;
      const e = mem.get(key);
      mem.set(key, { v: String(cur), exp: e?.exp || 0 });
      return cur;
    }
    case 'EXPIRE': {
      const e = mem.get(key);
      if (!e) return 0;
      e.exp = Date.now() + Number(args[0]) * 1000;
      return 1;
    }
    case 'DEL': return mem.delete(key) ? 1 : 0;
    default: throw new Error(`memory store: unsupported ${cmd}`);
  }
}

/** מריץ כמה פקודות ברצף אחד ומחזיר את התוצאות */
export async function pipeline(cmds) {
  if (storageKind === 'memory') return cmds.map(memCmd);
  const res = await fetch(`${URL_.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmds.map((c) => c.map(String))),
  });
  if (!res.ok) throw new Error(`store http ${res.status}`);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(`store: ${r.error}`);
    return r.result;
  });
}

export const get = async (key) => (await pipeline([['GET', key]]))[0];
