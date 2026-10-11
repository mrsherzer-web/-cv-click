// Single-file build of Operation Brodna: the code, three.js, the fonts and (when brodna/private/
// exists) the face scans and clips, all inlined into one HTML file that runs offline.
// With private/ inside, the output shows the friends' faces: never commit it or post it publicly.
//
//   cd brodna/tools && npm install
//   node build-single.mjs ../desktop/game/index.html                # full PC build (Electron)
//   node build-single.mjs ../pc/resources/index.html --neutralino   # light PC build (Neutralino)
//   node build-single.mjs mivtza-brodna.html --artifact             # page body for a claude.ai Artifact
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2];
// --artifact: the page body only (the Artifact host adds doctype/head/body), title first
const ARTIFACT = process.argv.includes('--artifact');
// --neutralino: the light PC build; its client library must initialise before the game boots
const NEUTRALINO = process.argv.includes('--neutralino');
// --fonts=<file>: an already inlined copy of the Google Fonts stylesheet, instead of downloading it
const FONTS = process.argv.find((a) => a.startsWith('--fonts='))?.slice(8);
if (!OUT || OUT.startsWith('--')) {
  console.error('usage: node build-single.mjs <out.html> [--neutralino | --artifact] [--fonts=<file>]');
  process.exit(1);
}

// Downloads the Google Fonts stylesheet and puts every font file inside it.
async function inlineFonts(href) {
  const get = async (url, headers) => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    return res;
  };
  // a current browser's user agent, so Google serves woff2
  const ua = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
  let css = await (await get(href, ua)).text();
  for (const url of new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)\s]+/g) || [])) {
    const data = Buffer.from(await (await get(url)).arrayBuffer()).toString('base64');
    css = css.split(url).join('data:font/woff2;base64,' + data);
  }
  return css;
}

const hasPrivate = fs.existsSync(path.join(ROOT, 'private'));
const res = await build({
  entryPoints: [path.join(ROOT, 'src/main.js')],
  bundle: true,
  format: 'esm',
  write: false,
  minify: true,
  target: 'es2022',
  legalComments: 'none',
  nodePaths: [path.join(ROOT, 'tools/node_modules')],
  // without private/ the game falls back to drawn faces
  external: hasPrivate ? [] : ['../private/*'],
  logLevel: 'warning',
});
let js = res.outputFiles[0].text;
js = js.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const swap = (re, to) => {
  if (!re.test(html)) throw new Error('missing ' + re);
  html = html.replace(re, to);
};
const fontsHref = html.match(/<link rel="stylesheet" href="(https:\/\/fonts.googleapis.com[^"]*)">/)[1].replace(/&amp;/g, '&');
const fonts = FONTS ? fs.readFileSync(FONTS, 'utf8') : await inlineFonts(fontsHref);
swap(/<link rel="preconnect" href="https:\/\/fonts.googleapis.com">\n/, '');
swap(/<link rel="preconnect" href="https:\/\/fonts.gstatic.com" crossorigin>\n/, '');
swap(/<link rel="stylesheet" href="https:\/\/fonts.googleapis.com[^>]*>\n/, () => '<style>\n' + fonts + '\n</style>\n');
swap(/<script type="importmap">[\s\S]*?<\/script>\n/, '');
swap(/<script type="module" src="src\/main.js"><\/script>/, () => (NEUTRALINO ? '<script src="js/neutralino.js"></script>\n<script>try { Neutralino.init(); } catch (e) { console.error(e); }</script>\n' : '') + '<script type="module">\n' + js + '\n</script>');
if (ARTIFACT) {
  for (const re of [/<!doctype html>\n/i, /<html[^>]*>\n/, /<head>\n/, /<meta charset="utf-8">\n/, /<meta name="viewport"[^>]*>\n/, /<\/head>\n/, /<body>\n/, /<\/body>\n/, /<\/html>\n?/]) swap(re, '');
  // the host's <html> carries no lang/dir: set them before anything renders
  swap(/<title>([^<]*)<\/title>\n/, (m) => m + '<script>document.documentElement.lang = "he"; document.documentElement.dir = "rtl";</script>\n');
  if (html.indexOf('<title>') > 200) throw new Error('title is not at the top');
}
fs.writeFileSync(OUT, html);
console.log('wrote', OUT, (html.length / 1024 / 1024).toFixed(2) + ' MB', hasPrivate ? '(with private faces and clips)' : '(no private/: drawn faces)');
