// Bundles the game (code, Three.js and CSS) into one self-contained file: dist/play.html.
// That file opens anywhere a single HTML page can, with no server and no network.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname;
const result = await build({
  entryPoints: [`${root}src/main.js`],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2020', 'safari15'],
  absWorkingDir: root,
  write: false,
  legalComments: 'eof',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await readFile(`${root}src/ui/style.css`, 'utf8');
let html = await readFile(`${root}index.html`, 'utf8');
html = html
  .replace(/<link rel="stylesheet" href="src\/ui\/style.css">/, () => `<style>\n${css}</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '')
  .replace(/<script type="module" src="src\/main.js"><\/script>/, () => `<script>\n${js}</script>`);
if (html.includes('src/main.js') || html.includes('importmap')) throw new Error('build: entry tags were not replaced');
await mkdir(`${root}dist`, { recursive: true });
await writeFile(`${root}dist/play.html`, html);
console.log(`dist/play.html ${(html.length / 1024).toFixed(0)} KB`);
