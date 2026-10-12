// שרת פיתוח מקומי: מגיש את האפליקציה ומריץ את פונקציות api/ בדיוק כמו ב-Vercel.
// הרצה: npm run dev  (קורא משתנים מ-.env.local או .env אם קיימים)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

for (const file of ['.env.local', '.env']) {
  const p = join(root, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
};

async function api(req, res, url) {
  const name = url.pathname.slice('/api/'.length).replace(/\/$/, '');
  const file = join(root, 'api', `${name}.js`);
  if (!/^[a-z-]+$/.test(name) || !existsSync(file)) { res.writeHead(404); return res.end(); }
  const mod = await import(pathToFileURL(file).href);
  const handler = mod[req.method];
  if (typeof handler !== 'function') { res.writeHead(405); return res.end(); }

  const ctl = new AbortController();
  res.on('close', () => { if (!res.writableFinished) ctl.abort(); });
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  headers.set('x-real-ip', req.socket.remoteAddress || '127.0.0.1');
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const request = new Request(url, {
    method: req.method, headers, signal: ctl.signal,
    ...(hasBody ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
  });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) {
    try {
      for await (const chunk of response.body) res.write(chunk);
    } catch { /* הלקוח התנתק */ }
  }
  res.end();
}

async function file(res, url) {
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const full = normalize(join(root, path));
  if (!full.startsWith(root) || full.includes(`${sep}node_modules${sep}`) || full.includes(`${sep}.`)) { res.writeHead(404); return res.end(); }
  try {
    const data = await readFile(full);
    res.writeHead(200, { 'content-type': TYPES[extname(full)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else await file(res, url);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => {
    console.log(`SmartPantry: http://localhost:${port}`);
    if (!process.env.ANTHROPIC_API_KEY) console.log('שימו לב: ANTHROPIC_API_KEY לא מוגדר – הסריקה לא תעבוד. העתיקו את .env.example ל-.env.local ומלאו.');
  });
}
