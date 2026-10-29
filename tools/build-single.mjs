// Bundles each page (code, Three.js and CSS) into one self-contained file in dist/.
// Those files open anywhere a single HTML page can, with no server and no network.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname;
const PAGES = [
  { html: 'index.html', entry: 'src/main.js', out: 'play.html' },
  { html: 'characters.html', entry: 'src/characters/viewer.js', out: 'characters.html' },
];

await mkdir(`${root}dist`, { recursive: true });
for (const page of PAGES) {
  const result = await build({
    entryPoints: [`${root}${page.entry}`],
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['es2020', 'safari15'],
    absWorkingDir: root,
    write: false,
    legalComments: 'eof',
  });
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  let html = await readFile(`${root}${page.html}`, 'utf8');
  for (const [, href] of html.matchAll(/<link rel="stylesheet" href="(src\/[^"]+\.css)">/g)) {
    const css = await readFile(`${root}${href}`, 'utf8');
    html = html.replace(`<link rel="stylesheet" href="${href}">`, () => `<style>\n${css}</style>`);
  }
  html = html
    .replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '')
    .replace(`<script type="module" src="${page.entry}"></script>`, () => `<script>\n${js}</script>`)
    .replace(/href="index.html"/g, 'href="play.html"'); // in dist/ the game page is play.html
  if (html.includes(page.entry) || html.includes('importmap') || /href="src\//.test(html)) throw new Error(`build: ${page.html} still references source files`);
  await writeFile(`${root}dist/${page.out}`, html);
  console.log(`dist/${page.out} ${(html.length / 1024).toFixed(0)} KB`);
}

// --artifact <dir>: the game as a page body for a claude.ai artifact, whose host adds the document shell
const at = process.argv.indexOf('--artifact');
if (at > 0) {
  const dir = process.argv[at + 1];
  const play = await readFile(`${root}dist/play.html`, 'utf8');
  const head = play.match(/<head>([\s\S]*?)<\/head>/)[1], body = play.match(/<body>([\s\S]*?)<\/body>/)[1];
  const keep = head.match(/<title>[\s\S]*?<\/title>|<style>[\s\S]*?<\/style>/g).join('\n');
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/index.html`, `${keep}\n<script>document.documentElement.lang = 'he'; document.documentElement.dir = 'rtl';</script>\n${body}`);
  console.log(`${dir}/index.html (artifact body)`);
}
