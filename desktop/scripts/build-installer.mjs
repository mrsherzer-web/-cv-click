// Compiles installer.nsi with the makensis that electron-builder downloaded,
// so the Windows installer can be built on Linux/macOS without Wine.
// Run after `electron-builder --win --dir` has produced dist/win-unpacked.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = process.env.ELECTRON_BUILDER_CACHE || path.join(os.homedir(), '.cache', 'electron-builder');
const findDir = (prefix) => {
  const base = path.join(cache, prefix);
  if (!fs.existsSync(base)) return null;
  const sub = fs.readdirSync(base).find((d) => fs.statSync(path.join(base, d)).isDirectory());
  return sub ? path.join(base, sub) : null;
};
const nsis = findDir('nsis-3.0.4.1');
const resources = findDir('nsis-resources-3.4.1');
if (!nsis || !resources) {
  console.error('NSIS toolchain not found in', cache, '— run `npx electron-builder --win --dir` once to download it.');
  process.exit(1);
}
const makensis = path.join(nsis, process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'Bin' : 'linux', process.platform === 'win32' ? 'makensis.exe' : 'makensis');
fs.chmodSync(makensis, 0o755);
const version = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8')).version;
if (!fs.existsSync(path.join(desktop, 'dist', 'win-unpacked', 'DontWakeNoam.exe'))) {
  console.error('dist/win-unpacked is missing — run `npx electron-builder --win --dir` first.');
  process.exit(1);
}
execFileSync(makensis, ['-V2', `-DVERSION=${version}`, `-DRESOURCES_PLUGINS=${path.join(resources, 'plugins', 'x86-unicode')}`, 'installer.nsi'], {
  cwd: desktop,
  stdio: 'inherit',
  env: { ...process.env, NSISDIR: nsis },
});
console.log(`built dist/DontWakeNoam-Setup-${version}.exe`);

// portable build: the same files in one top-level folder, no installation needed
const zipName = `DontWakeNoam-Portable-${version}.zip`;
fs.rmSync(path.join(desktop, 'dist', zipName), { force: true });
const stage = path.join(desktop, 'dist', 'portable');
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
fs.cpSync(path.join(desktop, 'dist', 'win-unpacked'), path.join(stage, 'DontWakeNoam'), { recursive: true });
execFileSync('python3', ['-c', `import shutil; shutil.make_archive(${JSON.stringify(path.join(desktop, 'dist', zipName.replace(/\.zip$/, '')))}, 'zip', ${JSON.stringify(stage)}, 'DontWakeNoam')`], { stdio: 'inherit' });
fs.rmSync(stage, { recursive: true, force: true });
console.log(`built dist/${zipName}`);
