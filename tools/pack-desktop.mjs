// The game as ONE file a person downloads and plays on a computer: dist/play.html with the asset layer
// (the hf/ folder: portraits, realistic models, films, music, voices) packed inside it.
//
//   npm run build
//   node tools/pack-desktop.mjs --hf <folder that contains hf/> --out <file.html>
//
// Without --hf the repository's own build is packed alone (still one valid offline file). Without --out the
// file goes to out/Nehorai-Farhi-Game.html. Nothing is written inside the repository except under out/.
//
// What goes into the file:
//   1. before the game's own script, one inert block for every file under hf/:
//        <script type="application/x-packed" data-p="<path>" data-t="<type>">...</script>
//      holding the file's bytes in base64 (the JSON models gzipped first; jpg, mp3 and mp4 as they are).
//      A browser reads such a block as text and does nothing else with it. They stand before the game's
//      script because the browser gets through them in a fraction of a second while nothing else runs; after
//      it they would be read in the gaps between the game's frames, and the asset layer would come up late.
//   2. last, before </body>, a small loader (below). It makes every way the asset script and the game ask for
//      an 'hf/...' address answer from those blocks, with no network and no file:// request:
//        fetch('hf/x')                       -> a Response over the packed bytes (gunzipped on the way out)
//        img.src, new Image()                -> a blob: address (this is THREE.TextureLoader / ImageLoader too)
//        video.src, audio.src, source.src    -> a blob: address (films, the ad after the credits)
//        new Audio('hf/x')                   -> the same (the radio and the pub's music)
//        video.poster                        -> a blob: address
//        setAttribute('src' | 'poster')      -> the same
//        url("hf/x") in a <style> element    -> rewritten when the element enters the page
//        el.style.backgroundImage = 'url("hf/x")', .background, .cssText, setProperty, setAttribute('style')
//                                            -> rewritten as it is set where the browser lets a script wrap
//                                               those properties; where it does not (Chromium), right after
//                                               the script that set it or put the element into the page,
//                                               before the browser draws with it
//      A block is decoded the first time its file is asked for, turned into a Blob and dropped from the page,
//      so nothing is decoded at start-up and each file is held once. A gzipped file can only be read with
//      fetch (it cannot be gunzipped at once for an element); an 'hf/...' address that is not in the pack
//      fails at once without touching the disk. XMLHttpRequest is not covered (nothing uses it).
//   3. the asset script (hf/hf-assets.js), run by the loader as the last script of the page. It is not
//      rewritten: it is packed like every other file, byte for byte, and the loader puts its text into a
//      <script> element at the end of the page (it contains "</script>" in a comment, which a script written
//      into the HTML could not hold). As an inline script it has no address of its own, so its base falls
//      back to 'hf/'. It runs where the published page runs it: after the game's script, before the town is built.
// The start screen's link to the characters page (a second file) is hidden.
import { gzipSync } from 'node:zlib';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const fail = (msg) => { console.error(`pack-desktop: ${msg}`); process.exit(1); };

const BLOCK = 'application/x-packed';
const TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm',
  json: 'application/json', js: 'text/javascript', css: 'text/css', txt: 'text/plain',
  glb: 'model/gltf-binary', gltf: 'model/gltf+json', bin: 'application/octet-stream',
};
// data that a script reads with fetch: worth gzipping, and never asked for by an element
const GZIP = new Set(['json', 'gltf', 'glb', 'bin', 'txt']);

/* ---------- the loader: runs in the packed page, after the game's script, and runs the asset script ---------- */
function loader(cfg) {
  'use strict';
  const base = new URL(cfg.base, document.baseURI).href; // what 'hf/' means in this page
  const files = new Map(); // path -> { type, gz, el (the block, until first use), blob, url }
  for (const el of document.querySelectorAll(`script[type="${cfg.block}"]`)) {
    files.set(el.dataset.p, { type: el.dataset.t, gz: el.dataset.z === 'gzip', el, blob: null, url: null });
  }
  const asked = new Set(), missing = new Set();
  window.__hfPack = { base: cfg.base, files: [...files.keys()], asked, missing, inert: () => [...files.values()].filter((f) => f.el).length };

  const decode = (b64) => {
    if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(b64);
    const bin = atob(b64), n = bin.length, out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  // a file's stored bytes as a Blob: decoded on first use, and its block dropped from the page
  const store = (f, bytes) => {
    f.blob = new Blob([bytes], { type: f.gz ? 'application/gzip' : f.type });
    f.el.remove();
    f.el = null;
    return f.blob;
  };
  const blobOf = (f) => f.blob || store(f, decode(f.el.textContent));

  // null: not an address under hf/; undefined: under hf/ and not in the pack; else the file
  const find = (u) => {
    if (u instanceof URL) u = u.href;
    if (typeof u !== 'string' || !u || u.startsWith('data:') || u.startsWith('blob:')) return null;
    let abs;
    try { abs = new URL(u, document.baseURI).href; } catch (e) { return null; }
    if (!abs.startsWith(base)) return null;
    let p = abs.slice(base.length).replace(/[?#].*$/, '');
    try { p = decodeURIComponent(p); } catch (e) { /* as written */ }
    const f = files.get(p);
    (f ? asked : missing).add(p);
    return f;
  };
  // the address an element or a style gets for a packed file: a blob: address, made once
  const urlOf = (u) => {
    const f = find(u);
    if (f === null) return u;
    if (!f || f.gz) { if (f) missing.add(`${u} (gzipped: fetch only)`); return 'data:,'; }
    return f.url || (f.url = URL.createObjectURL(blobOf(f)));
  };
  const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^"')\s][^)\s]*))\s*\)/g;
  const cssOf = (text) => (typeof text !== 'string' || text.indexOf('url(') < 0 ? text
    : text.replace(CSS_URL, (all, a, b, c) => { const u = a ?? b ?? c, m = urlOf(u); return m === u ? all : `url("${m}")`; }));

  // fetch
  const netFetch = window.fetch;
  window.fetch = function (input) {
    const f = find(input && typeof input === 'object' && !(input instanceof URL) ? input.url : input);
    if (f === null) return netFetch.apply(this, arguments);
    return new Promise((done) => {
      if (!f) return done(new Response(null, { status: 404, statusText: 'Not Found' }));
      const blob = blobOf(f);
      const body = f.gz ? blob.stream().pipeThrough(new DecompressionStream('gzip')) : blob;
      done(new Response(body, { status: 200, headers: { 'Content-Type': f.type } }));
    });
  };

  // elements: the src of images, films and sound, a film's poster
  const wrap = (proto, prop, map) => {
    const d = proto && Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || !d.set || !d.configurable) return false;
    Object.defineProperty(proto, prop, { get: d.get, set(v) { d.set.call(this, map(v)); }, enumerable: d.enumerable, configurable: true });
    return true;
  };
  wrap(HTMLImageElement.prototype, 'src', urlOf);
  wrap(HTMLMediaElement.prototype, 'src', urlOf);
  wrap(HTMLSourceElement.prototype, 'src', urlOf);
  wrap(HTMLVideoElement.prototype, 'poster', urlOf);
  const NetAudio = window.Audio;
  window.Audio = function Audio(src) {
    const a = new NetAudio();
    if (arguments.length) a.src = src;
    return a;
  };
  window.Audio.prototype = NetAudio.prototype;
  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (typeof name === 'string' && typeof value === 'string') {
      const n = name.toLowerCase();
      const media = (n === 'src' || n === 'poster') && (this instanceof HTMLImageElement || this instanceof HTMLMediaElement || this instanceof HTMLSourceElement);
      const mapped = n === 'style' ? cssOf(value) : media ? urlOf(value) : value;
      if (mapped !== value) return setAttribute.call(this, name, mapped);
    }
    return setAttribute.apply(this, arguments);
  };

  // styles set on an element: the properties that take a picture, rewritten as they are set where the browser
  // keeps them where a script can wrap them (Chromium does not: the watcher below does it there)
  const style = document.documentElement.style;
  const holder = (prop) => { for (let o = Object.getPrototypeOf(style); o; o = Object.getPrototypeOf(o)) if (Object.getOwnPropertyDescriptor(o, prop)) return o; return null; };
  for (const prop of ['cssText', 'background', 'backgroundImage', 'borderImage', 'borderImageSource', 'listStyleImage', 'maskImage', 'webkitMaskImage', 'content', 'cursor']) wrap(holder(prop), prop, cssOf);
  const setProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (name, value, priority) {
    const mapped = cssOf(value);
    return mapped !== value ? setProperty.call(this, name, mapped, priority || '') : setProperty.apply(this, arguments);
  };
  // the watcher: whatever enters the page or changes its style attribute is rewritten right after the script
  // that did it, before the browser draws with it. <style> elements (their rules are used only after that),
  // and elements with a picture in their style: set in the page, or set on an element that was put in later
  // (a face made first and added after), which no wrapped property saw in Chromium
  const sheet = (el) => { const t = el.textContent, m = cssOf(t); if (m !== t) el.textContent = m; };
  const styled = (el) => { const t = el.getAttribute('style'), m = cssOf(t); if (m !== t) setAttribute.call(el, 'style', m); };
  new MutationObserver((list) => {
    for (const r of list) {
      if (r.type === 'attributes') { styled(r.target); continue; }
      for (const n of r.addedNodes) {
        if (n.nodeType === 3) { if (n.parentNode && n.parentNode.nodeName === 'STYLE') sheet(n.parentNode); continue; }
        if (n.nodeType !== 1) continue;
        if (n.nodeName === 'STYLE') { sheet(n); continue; }
        styled(n);
        if (n.firstElementChild) for (const c of n.querySelectorAll('style, [style*="url("]')) (c.nodeName === 'STYLE' ? sheet : styled)(c);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });

  // the asset script, last in the page and as it was written
  const f = cfg.run && files.get(cfg.run);
  if (f) {
    const bytes = decode(f.el.textContent);
    store(f, bytes);
    const s = document.createElement('script');
    s.dataset.packed = cfg.run;
    s.textContent = new TextDecoder('utf-8').decode(bytes);
    document.body.appendChild(s);
  }
}

/* ---------- the tool ---------- */
async function walk(dir, prefix = '') {
  const out = [];
  for (const name of (await readdir(dir)).sort()) {
    if (name.startsWith('.')) continue;
    const full = `${dir}/${name}`, st = await stat(full);
    if (st.isDirectory()) out.push(...await walk(full, `${prefix}${name}/`));
    else if (st.isFile()) out.push({ path: `${prefix}${name}`, full, size: st.size });
  }
  return out;
}
const exists = (p) => stat(p).then(() => true, () => false);
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

const outFile = resolve(arg('--out') || `${root}/out/Nehorai-Farhi-Game.html`);
const inRepo = !relative(root, outFile).startsWith('..');
if (inRepo && !relative(`${root}/out`, outFile).split(sep).every((s) => s && s !== '..')) fail(`inside the repository the packed file may only go under out/ (asked for ${outFile})`);

let html;
try { html = await readFile(`${root}/dist/play.html`, 'utf8'); } catch (e) { fail('dist/play.html is missing: run npm run build first'); }

// the characters page is a second file: its link is hidden
const LINK = '<a class="secondary linkbtn" href="characters.html">';
const linkHidden = html.includes(LINK);
if (linkHidden) html = html.replace(LINK, LINK.replace('<a ', '<a hidden '));
else console.warn('pack-desktop: the link to the characters page was not found on the start screen; nothing hidden');

let hfDir = null;
const hfArg = arg('--hf');
if (hfArg) {
  const given = resolve(hfArg);
  hfDir = await exists(`${given}/hf/hf-assets.js`) ? `${given}/hf` : await exists(`${given}/hf-assets.js`) ? given : null;
  if (!hfDir) fail(`no hf/hf-assets.js under ${given}`);
}

const blocks = [];
let run = null, bytesIn = 0, bytesStored = 0, gzipped = 0;
const kinds = {};
if (hfDir) {
  for (const f of await walk(hfDir)) {
    const ext = (f.path.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
    const raw = await readFile(f.full);
    let stored = raw, gz = false;
    if (f.path === 'hf-assets.js') run = f.path;
    else if (GZIP.has(ext)) {
      const z = gzipSync(raw, { level: 9 });
      if (z.length < raw.length * 0.9) { stored = z; gz = true; gzipped++; }
    }
    bytesIn += raw.length;
    bytesStored += stored.length;
    (kinds[ext || '?'] ||= { n: 0, raw: 0, stored: 0 }).n++;
    kinds[ext || '?'].raw += raw.length;
    kinds[ext || '?'].stored += stored.length;
    const path = f.path.replace(/[&"<]/g, (c) => `&#${c.charCodeAt(0)};`);
    blocks.push(`<script type="${BLOCK}" data-p="${path}" data-t="${TYPES[ext] || 'application/octet-stream'}"${gz ? ' data-z="gzip"' : ''}>${stored.toString('base64')}</script>`);
  }
  if (!run) fail('hf/hf-assets.js was not among the files');
}

const cfg = { base: 'hf/', block: BLOCK, run };
const code = `(${loader.toString()})(${JSON.stringify(cfg)});`;
if (/<\/script|<!--/i.test(code)) fail('the loader would end its own script element');
if (blocks.length) {
  // the blocks before the first script of the body (the game's), the loader last
  const first = html.indexOf('<script', html.indexOf('<body'));
  const end = html.lastIndexOf('</body>');
  if (first < 0 || end < first) fail('dist/play.html: no script in the body, or no </body>');
  html = `${html.slice(0, first)}<!-- the asset layer, packed by tools/pack-desktop.mjs: ${blocks.length} files -->\n${blocks.join('\n')}\n${html.slice(first, end)}<script>\n${code}\n</script>\n${html.slice(end)}`;
}

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, html);
const size = Buffer.byteLength(html);
if (hfDir) {
  console.log(`packed ${blocks.length} files from ${hfDir}: ${mb(bytesIn)} -> ${mb(bytesStored)} stored (${gzipped} gzipped), base64 in the page`);
  for (const [ext, k] of Object.entries(kinds).sort((a, b) => b[1].raw - a[1].raw)) console.log(`  .${ext}  ${String(k.n).padStart(3)} files  ${mb(k.raw).padStart(8)}${k.stored !== k.raw ? ` -> ${mb(k.stored)}` : ''}`);
} else console.log('packed the repository\'s own build alone (no --hf)');
console.log(`the link to the characters page: ${linkHidden ? 'hidden' : 'NOT FOUND'}`);
console.log(`${outFile}  ${mb(size)} (${size} bytes)`);
