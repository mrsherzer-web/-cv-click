// The parts of the desktop build that the tool (tools/make-windows-app.mjs) and its test share: the cache,
// Electron's release zips (downloaded once, checked against the release's own checksums), the two small npm
// tools that edit a Windows .exe from any system, the icon (drawn here, no outside art), and readers for what
// came out (the .exe's headers and resources, the zip's list).
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// a current stable Electron (November 2026), pinned so that every build wraps the game in the same engine
export const ELECTRON_VERSION = '45.4.1';
export const PRODUCT = 'Nehorai Farhi';                 // the folder, the .exe, the data folder
export const TITLE = 'חייו של נהוראי פרחי';             // the window, the .exe's description
export const COMPANY = 'Sherzer Production';
export const ZIP_NAME = 'Nehorai-Farhi-Windows.zip';
export const README_NAME = 'קרא אותי.txt';
export const ICON_SIZES = [256, 128, 64, 48, 32, 16];
const RESEDIT = { resedit: '3.1.1', 'pe-library': '2.0.3' };

// everything downloaded or made once lives here, outside the repository
export const cacheDir = () => process.env.NEHORAI_DESKTOP_CACHE || path.join(homedir(), '.cache', 'nehorai-desktop');

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, ...opts });
const has = (cmd) => { try { run(cmd, ['--version']); return true; } catch { return false; } };

export async function sha256(file) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest('hex');
}

// a file from the network: curl when the machine has it (it follows the machine's proxy settings), else fetch
async function download(url, file) {
  await mkdir(path.dirname(file), { recursive: true });
  const part = `${file}.part`;
  await rm(part, { force: true });
  if (has('curl')) run('curl', ['-fsSL', '--retry', '3', '--connect-timeout', '30', '-o', part, url], { stdio: ['ignore', 'ignore', 'pipe'] });
  else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    await writeFile(part, res.body);
  }
  await rename(part, file);
}

// Electron's release zip for a platform ("win32-x64", "linux-x64"...), from the cache or downloaded into it,
// and always checked against SHASUMS256.txt of that release. Returns { zip, sha256, cached }.
export async function electronZip(version, platform, log = () => {}) {
  const dir = path.join(cacheDir(), `electron-v${version}`), name = `electron-v${version}-${platform}.zip`;
  const base = `https://github.com/electron/electron/releases/download/v${version}`;
  const sums = path.join(dir, 'SHASUMS256.txt');
  if (!existsSync(sums)) { log(`downloading ${base}/SHASUMS256.txt`); await download(`${base}/SHASUMS256.txt`, sums); }
  const line = (await readFile(sums, 'utf8')).split('\n').find((l) => l.trim().endsWith(`*${name}`));
  if (!line) throw new Error(`Electron ${version} has no ${name} (see ${sums})`);
  const want = line.trim().split(/\s+/)[0];
  const zip = path.join(dir, name);
  let cached = existsSync(zip);
  if (cached && await sha256(zip) !== want) { log(`${name} in the cache does not match its checksum: downloading it again`); cached = false; }
  if (!cached) {
    log(`downloading ${base}/${name}`);
    await download(`${base}/${name}`, zip);
    const got = await sha256(zip);
    if (got !== want) { await rm(zip, { force: true }); throw new Error(`${name}: checksum ${got}, the release says ${want}`); }
  }
  return { zip, sha256: want, cached };
}

// resedit and pe-library (pure JavaScript: they read and write the resources of a Windows .exe on any system),
// installed into the cache, never into the project
export async function loadResedit(log = () => {}) {
  const dir = path.join(cacheDir(), 'tools');
  const at = (pkg) => path.join(dir, 'node_modules', pkg);
  const ok = () => Object.entries(RESEDIT).every(([pkg, v]) => { try { return createRequire(import.meta.url)(path.join(at(pkg), 'package.json')).version === v; } catch { return false; } });
  if (!ok()) {
    log(`installing ${Object.entries(RESEDIT).map(([p, v]) => `${p}@${v}`).join(' and ')} into ${dir}`);
    await mkdir(dir, { recursive: true });
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--prefix', dir, '--no-audit', '--no-fund', '--no-save', '--loglevel=error', ...Object.entries(RESEDIT).map(([p, v]) => `${p}@${v}`)], { shell: process.platform === 'win32' });
    if (!ok()) throw new Error(`resedit did not install into ${dir}`);
  }
  const load = async (pkg) => {
    const meta = JSON.parse(await readFile(path.join(at(pkg), 'package.json'), 'utf8'));
    const entry = typeof meta.exports?.['.'] === 'string' ? meta.exports['.'] : meta.exports?.['.']?.import || meta.exports?.['.']?.default || meta.module || meta.main;
    return import(pathToFileURL(path.join(at(pkg), entry)).href);
  };
  return { ResEdit: await load('resedit'), PE: await load('pe-library') };
}

// ---------- the icon ----------
// An amber glossy orb with a white S on a dark rounded square (the studio's mark). The small sizes are drawn
// bolder: less margin, a larger orb, a thicker letter, so that 16 pixels still read.
export function iconSvg(size) {
  const small = size <= 32;
  const inset = small ? 2 : 10, r = small ? 60 : 56, orb = small ? 96 : 82, stroke = small ? 27 : 19, k = small ? 1.12 : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#252d3b"/><stop offset="1" stop-color="#0a0d13"/></linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0.72" stop-color="#ffb02e" stop-opacity="0.55"/><stop offset="1" stop-color="#ffb02e" stop-opacity="0"/></radialGradient>
    <radialGradient id="orb" cx="0.5" cy="0.5" r="0.5" fx="0.36" fy="0.28"><stop offset="0" stop-color="#ffe7a0"/><stop offset="0.42" stop-color="#ffb428"/><stop offset="0.82" stop-color="#e27a04"/><stop offset="1" stop-color="#9c4a00"/></radialGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <rect x="${inset}" y="${inset}" width="${256 - 2 * inset}" height="${256 - 2 * inset}" rx="${r}" fill="url(#plate)"/>
  <rect x="${inset + 1.5}" y="${inset + 1.5}" width="${253 - 2 * inset}" height="${253 - 2 * inset}" rx="${r - 1.5}" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="3"/>
  <circle cx="128" cy="128" r="${orb + 22}" fill="url(#halo)"/>
  <circle cx="128" cy="128" r="${orb}" fill="url(#orb)"/>
  <ellipse cx="128" cy="${128 - orb * 0.5}" rx="${orb * 0.62}" ry="${orb * 0.36}" fill="url(#gloss)"/>
  <g transform="translate(128 128) scale(${k}) translate(-128 -128)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M158 100 C150 84 128 79 114 86 C97 95 97 114 112 122 C123 128 138 129 148 136 C162 146 160 166 142 173 C126 179 105 173 98 156" stroke="#7a3800" stroke-opacity="0.5" stroke-width="${stroke}" transform="translate(0 5)"/>
    <path d="M158 100 C150 84 128 79 114 86 C97 95 97 114 112 122 C123 128 138 129 148 136 C162 146 160 166 142 173 C126 179 105 173 98 156" stroke="#fff" stroke-width="${stroke}"/>
  </g>
</svg>`;
}

// the pictures of an .ico, as PNG (an .ico may hold PNG images as they are): a 6-byte header, 16 bytes a picture
export function writeIco(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1); // 0 stands for 256
    head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(png.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.png)]);
}

export function readIco(buf) {
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) throw new Error('not an .ico file');
  return Array.from({ length: buf.readUInt16LE(4) }, (_, i) => {
    const e = 6 + 16 * i, len = buf.readUInt32LE(e + 8), off = buf.readUInt32LE(e + 12), data = buf.subarray(off, off + len);
    const png = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    // a PNG says its own size in its first chunk
    return { size: buf.readUInt8(e) || 256, bits: buf.readUInt16LE(e + 6), png, width: png ? data.readUInt32BE(16) : null, height: png ? data.readUInt32BE(20) : null, data };
  });
}

// the icon as an .ico file in the cache (drawn again only when the drawing above changes); the drawing is
// rendered by the browser the tests already use (Playwright's Chromium), one screenshot a size
export async function makeIcon(log = () => {}) {
  const key = createHash('sha256').update(ICON_SIZES.map(iconSvg).join('\n')).digest('hex').slice(0, 16);
  const file = path.join(cacheDir(), `icon-${key}.ico`);
  if (existsSync(file)) return file;
  log('drawing the icon');
  let chromium;
  try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { throw new Error('the icon is drawn with Playwright, which this machine does not have: install it, or pass --icon <file.ico>'); }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const images = [];
    for (const size of ICON_SIZES) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">${iconSvg(size)}</body></html>`);
      images.push({ size, png: await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }) });
    }
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, writeIco(images));
  } finally { await browser.close(); }
  return file;
}

// ---------- reading back what was made ----------
// the headers of a Windows .exe, read by hand (so the check does not lean on the library that wrote the file)
export async function peHeaders(file) {
  const size = (await stat(file)).size, fh = await open(file, 'r');
  try {
    const read = async (pos, len) => { const b = Buffer.alloc(len); await fh.read(b, 0, len, pos); return b; };
    const dos = await read(0, 64);
    if (dos.toString('latin1', 0, 2) !== 'MZ') return { valid: false, why: 'no MZ header' };
    const pe = dos.readUInt32LE(0x3c), head = await read(pe, 24);
    if (head.toString('latin1', 0, 4) !== 'PE\0\0') return { valid: false, why: 'no PE signature' };
    const machine = head.readUInt16LE(4), sections = head.readUInt16LE(6), optSize = head.readUInt16LE(20), characteristics = head.readUInt16LE(22);
    const opt = await read(pe + 24, optSize), magic = opt.readUInt16LE(0), plus = magic === 0x20b;
    const dirs = plus ? 112 : 96, count = opt.readUInt32LE(dirs - 4);
    const dir = (i) => (i < count ? { rva: opt.readUInt32LE(dirs + 8 * i), size: opt.readUInt32LE(dirs + 8 * i + 4) } : { rva: 0, size: 0 });
    const table = await read(pe + 24 + optSize, 40 * sections);
    const list = Array.from({ length: sections }, (_, i) => {
      const s = table.subarray(40 * i, 40 * i + 40);
      return { name: s.toString('latin1', 0, 8).replace(/\0+$/, ''), virtualSize: s.readUInt32LE(8), rva: s.readUInt32LE(12), rawSize: s.readUInt32LE(16), rawAt: s.readUInt32LE(20) };
    });
    const inside = list.every((s) => s.rawAt + s.rawSize <= size);
    const rsrc = list.find((s) => s.name === '.rsrc'), res = dir(2);
    return {
      valid: inside && (magic === 0x20b || magic === 0x10b), why: inside ? '' : 'a section runs past the end of the file',
      size, machine: { 0x8664: 'x64', 0x14c: 'ia32', 0xaa64: 'arm64' }[machine] || `0x${machine.toString(16)}`, pe32plus: plus,
      executable: !!(characteristics & 0x0002), dll: !!(characteristics & 0x2000), subsystem: { 2: 'windows-gui', 3: 'windows-console' }[opt.readUInt16LE(68)] || opt.readUInt16LE(68),
      sections: list.map((s) => s.name), resources: res, resourcesInRsrc: !!rsrc && res.rva >= rsrc.rva && res.rva + res.size <= rsrc.rva + Math.max(rsrc.virtualSize, rsrc.rawSize),
      signed: dir(4).size > 0,
    };
  } finally { await fh.close(); }
}

// the icon pictures and the version strings inside an .exe, read with resedit
export async function exeResources(file, { ResEdit, PE }) {
  const exe = PE.NtExecutable.from(await readFile(file), { ignoreCert: true });
  const res = PE.NtExecutableResource.from(exe);
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  // a PNG picture comes back as it was put in (a "raw" item); an old-style bitmap picture is rebuilt
  const icons = groups.length ? groups[0].getIconItemsFromEntries(res.entries).map((item) => ({ width: item.width, height: item.height, data: Buffer.from(item.isIcon() ? item.generate() : item.bin) })) : [];
  const info = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  const lang = info?.getAvailableLanguages()[0];
  return {
    iconGroups: groups.map((g) => ({ id: g.id, lang: g.lang, sizes: g.icons.map((i) => i.width || 256) })), icons,
    strings: info ? info.getStringValues(lang) : {}, lang, fileVersion: info ? [info.fixedInfo.fileVersionMS >>> 16, info.fixedInfo.fileVersionMS & 0xffff, info.fixedInfo.fileVersionLS >>> 16, info.fixedInfo.fileVersionLS & 0xffff].join('.') : null,
  };
}

// the list of a zip (name, size, whether the name is marked as UTF-8), from its central directory
export async function zipEntries(file) {
  const size = (await stat(file)).size, fh = await open(file, 'r');
  try {
    const tailLen = Math.min(size, 65557), tail = Buffer.alloc(tailLen);
    await fh.read(tail, 0, tailLen, size - tailLen);
    const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) throw new Error('not a zip file');
    const count = tail.readUInt16LE(eocd + 10), cdSize = tail.readUInt32LE(eocd + 12), cdAt = tail.readUInt32LE(eocd + 16);
    const cd = Buffer.alloc(cdSize);
    await fh.read(cd, 0, cdSize, cdAt);
    const out = [];
    for (let p = 0, i = 0; i < count; i++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error('a broken zip directory');
      const flags = cd.readUInt16LE(p + 8), n = cd.readUInt16LE(p + 28), x = cd.readUInt16LE(p + 30), c = cd.readUInt16LE(p + 32);
      out.push({ name: cd.toString('utf8', p + 46, p + 46 + n), packed: cd.readUInt32LE(p + 20), size: cd.readUInt32LE(p + 24), utf8: !!(flags & 0x800), crc: cd.readUInt32LE(p + 16) });
      p += 46 + n + x + c;
    }
    return out;
  } finally { await fh.close(); }
}

// Marks every name in a zip that is not plain ASCII as UTF-8 (bit 11 of the entry's flags, in the entry's own
// header and in the directory). The bytes already are UTF-8; the zip program leaves the mark off when the
// machine's locale is not a UTF-8 one, and without it Windows shows a Hebrew name as noise. Returns how many.
export async function markZipNamesUtf8(file) {
  const size = (await stat(file)).size, fh = await open(file, 'r+');
  try {
    const tailLen = Math.min(size, 65557), tail = Buffer.alloc(tailLen);
    await fh.read(tail, 0, tailLen, size - tailLen);
    const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) throw new Error('not a zip file');
    const count = tail.readUInt16LE(eocd + 10), cdSize = tail.readUInt32LE(eocd + 12), cdAt = tail.readUInt32LE(eocd + 16);
    const cd = Buffer.alloc(cdSize);
    await fh.read(cd, 0, cdSize, cdAt);
    let marked = 0;
    for (let p = 0, i = 0; i < count; i++) {
      const flags = cd.readUInt16LE(p + 8), n = cd.readUInt16LE(p + 28), x = cd.readUInt16LE(p + 30), c = cd.readUInt16LE(p + 32), local = cd.readUInt32LE(p + 42);
      if (!(flags & 0x800) && cd.subarray(p + 46, p + 46 + n).some((b) => b > 0x7f)) {
        const word = Buffer.alloc(2);
        word.writeUInt16LE(flags | 0x800);
        await fh.write(word, 0, 2, cdAt + p + 8);
        await fh.read(word, 0, 2, local + 6);
        word.writeUInt16LE(word.readUInt16LE(0) | 0x800);
        await fh.write(word, 0, 2, local + 6);
        marked++;
      }
      p += 46 + n + x + c;
    }
    return marked;
  } finally { await fh.close(); }
}
