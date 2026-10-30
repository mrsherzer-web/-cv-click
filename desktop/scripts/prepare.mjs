// Copies the built web game into desktop/game so electron-builder can package it.
// Run `npm run build` in the repository root first (it produces build/game.js).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(desktop, '..');
const out = path.join(desktop, 'game');

if (!fs.existsSync(path.join(root, 'build', 'game.js'))) {
  console.error('build/game.js is missing — run `npm run build` in the repository root first.');
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of ['index.html', 'css', 'fonts', 'build/game.js']) {
  fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
}
fs.copyFileSync(path.join(desktop, 'resources', 'icon.ico'), path.join(desktop, 'icon.ico'));
console.log('game copied to', out);
