// The Windows application (tools/make-windows-app.mjs): the tool is run on the game's single HTML file and what
// it made is read back.
//   1. the Windows folder, statically (a Windows .exe cannot run on this Linux machine): the .exe is a valid
//      64-bit Windows program, the icon and the version strings are inside it, resources/app holds the game and
//      the app's main process and nothing else, the readme is there, the zip lists exactly the folder.
//   2. the same app on Electron's Linux build of the same version: resources/app is identical file for file,
//      and it is run for real under a virtual display with the app's own --smoke check (the game loads, WebGL2
//      is up, the start button starts it, the game's clock runs, the keys do what they should, the page cannot
//      leave). When Electron cannot start on this machine (not Linux x64, no display and no xvfb-run, a
//      missing system library) that part is skipped, and says so.
// Electron's zips and the .exe tools come from ~/.cache/nehorai-desktop: the first run downloads about 280 MB.
// When all passes, the two unpacked folders (600 MB) are removed and the zip, the icon, build.json and the run's
// report and picture stay in the out dir; --keep leaves the folders too.
// usage: node tests/windows-app.test.mjs [game.html, default dist/play.html] [out dir, default out/windows-app-test] [--keep]
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { COMPANY, ELECTRON_VERSION, ICON_SIZES, PRODUCT, README_NAME, TITLE, ZIP_NAME, cacheDir, exeResources, loadResedit, peHeaders, peLayout, readIco, sha256, zipEntries } from '../tools/desktop-app/lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const given = process.argv.slice(2).filter((a) => a !== '--keep'), keep = process.argv.includes('--keep');
const game = path.resolve(given[0] || path.join(root, 'dist/play.html'));
const out = path.resolve(given[1] || path.join(root, 'out/windows-app-test'));
const T0 = Date.now();
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}  [${((Date.now() - T0) / 1000).toFixed(0)} s]`); return !!ok; };
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const tool = (...a) => spawnSync(process.execPath, [path.join(root, 'tools/make-windows-app.mjs'), '--game', game, ...a], { encoding: 'utf8', timeout: 900000 });
// every file under a folder, as paths with forward slashes
async function walk(dir, at = '') {
  const list = [];
  for (const e of await readdir(path.join(dir, at), { withFileTypes: true })) {
    if (e.isDirectory()) list.push(...await walk(dir, `${at}${e.name}/`)); else list.push(`${at}${e.name}`);
  }
  return list.sort();
}

if (!existsSync(game)) { console.log(`no game file at ${game}: run "npm run build" first, or pass the file`); process.exit(2); }
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// ---------- 1. the Windows folder ----------
const win = path.join(out, 'win'), folder = path.join(win, PRODUCT), app = path.join(folder, 'resources/app'), exeFile = path.join(folder, `${PRODUCT}.exe`);
const made = tool('--out', win);
check('the tool builds the Windows folder and its zip', made.status === 0, made.status === 0 ? made.stdout.trim().split('\n').pop() : (made.stderr || made.stdout || '').trim().split('\n').slice(-3).join(' | '));
if (made.status !== 0) { console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`); process.exit(1); }
const info = JSON.parse(await readFile(path.join(win, 'build.json'), 'utf8'));
check('the pinned Electron, checked against its release checksum', info.electron === ELECTRON_VERSION && /^[0-9a-f]{64}$/.test(info.electronZipSha256), `Electron ${info.electron}, zip sha256 ${info.electronZipSha256.slice(0, 12)}…`);

const pe = await peHeaders(exeFile);
check('the .exe carries the game\'s name; electron.exe is gone', existsSync(exeFile) && !existsSync(path.join(folder, 'electron.exe')));
check('the .exe is a valid 64-bit Windows program (its headers read by hand)', pe.valid && pe.machine === 'x64' && pe.pe32plus && pe.executable && !pe.dll && pe.subsystem === 'windows-gui', `${pe.machine}, ${pe.pe32plus ? 'PE32+' : 'PE32'}, ${pe.subsystem}, ${pe.sections?.length} sections, ${mb(pe.size)}`);
check('its resources sit inside the .rsrc section, and no stale signature is left on the edited file', pe.resourcesInRsrc && pe.resources.size > 0 && !pe.signed, `resources ${pe.resources.size} bytes`);

// beside Electron's own .exe (out of the release zip): the edit may have touched the resources and nothing else
const releaseZip = path.join(cacheDir(), `electron-v${ELECTRON_VERSION}`, `electron-v${ELECTRON_VERSION}-win32-x64.zip`);
const ours = peLayout(await readFile(exeFile)), theirs = peLayout(execFileSync('unzip', ['-p', releaseZip, 'electron.exe'], { maxBuffer: 1 << 30 }));
const pair = ours.sections.map((o, i) => [o, theirs.sections[i]]), at = ours.sections.findIndex((o) => o.name === '.rsrc');
check('the program itself is Electron\'s own: every section before the resources is the same bytes at the same address, and it starts at the same place',
  at > 0 && ours.sections.length === theirs.sections.length && pair.slice(0, at).every(([o, t]) => o.name === t.name && o.sha256 === t.sha256 && o.rva === t.rva && o.rawAt === t.rawAt) && ours.entry === theirs.entry,
  `${at} sections identical (${pair.slice(0, at).map(([o]) => o.name).join(' ')}), entry point 0x${ours.entry.toString(16)}`);
const rsrc = ours.sections[at], after = pair.slice(at + 1), last = ours.sections[ours.sections.length - 1];
const ordered = ours.sections.every((o, i) => i === 0 || o.rva >= ours.sections[i - 1].rva + ours.sections[i - 1].virtualSize) && ours.sections.every((o) => o.rva % ours.sectionAlign === 0);
check('only the resources differ; what follows them (the relocations) is the same bytes, moved, and the headers point at where it now is',
  rsrc.sha256 !== theirs.sections[at].sha256 && after.every(([o, t]) => o.name === t.name && o.sha256 === t.sha256) && ordered
  && ours.resources.rva === rsrc.rva && ours.relocations.rva === ours.sections.find((o) => o.name === '.reloc')?.rva && ours.relocations.size === theirs.relocations.size
  && ours.sizeOfImage >= last.rva + last.virtualSize && ours.sizeOfImage % ours.sectionAlign === 0,
  `.rsrc ${theirs.sections[at].virtualSize} -> ${rsrc.virtualSize} bytes; ${after.map(([o, t]) => `${o.name} moved by ${o.rva - t.rva}`).join(', ')}; image size ${theirs.sizeOfImage} -> ${ours.sizeOfImage}`);

const libs = await loadResedit();
const res = await exeResources(exeFile, libs), s = res.strings;
check('the version strings inside the .exe', s.ProductName === PRODUCT && s.FileDescription === TITLE && s.CompanyName === COMPANY && s.OriginalFilename === `${PRODUCT}.exe` && !('SquirrelAwareVersion' in s),
  `ProductName "${s.ProductName}", FileDescription "${s.FileDescription}", CompanyName "${s.CompanyName}", FileVersion ${s.FileVersion}`);
check('the file version is the game\'s version', res.fileVersion === `${info.appVersion}.0` && s.FileVersion === res.fileVersion && s.ProductVersion === res.fileVersion, res.fileVersion);
const ico = readIco(await readFile(path.join(win, 'icon.ico')));
check('the icon file holds the six sizes as 32-bit PNG pictures', ico.length === ICON_SIZES.length && ICON_SIZES.every((n) => ico.some((i) => i.size === n && i.png && i.width === n && i.height === n && i.bits === 32)), ico.map((i) => i.size).join('/'));
const iconIn = (n) => res.icons.find((i) => (i.width || 256) === n);
check('the same pictures are inside the .exe, byte for byte, as its only icon group', res.iconGroups.length >= 1 && String(res.iconGroups[0].sizes) === String(ICON_SIZES) && ICON_SIZES.every((n) => iconIn(n)?.data.equals(ico.find((i) => i.size === n).data)),
  `group ${res.iconGroups[0]?.id}: ${res.iconGroups[0]?.sizes.join('/')}; ${res.iconGroups.length} group(s)`);
const png256 = ico.find((i) => i.size === 256).data;
check('the large picture is not blank', png256.length > 8000, `${png256.length} bytes of PNG at 256x256`);

const appFiles = await walk(app);
check('resources/app holds package.json, main.js and game.html, and nothing else', String(appFiles) === 'game.html,main.js,package.json', appFiles.join(', '));
check('game.html is the game file given, untouched', await sha256(path.join(app, 'game.html')) === await sha256(game), mb((await stat(game)).size));
check('main.js is tools/desktop-app/main.js', await sha256(path.join(app, 'main.js')) === await sha256(path.join(root, 'tools/desktop-app/main.js')));
const pkg = JSON.parse(await readFile(path.join(app, 'package.json'), 'utf8'));
check('package.json names the app and its entry', pkg.main === 'main.js' && pkg.productName === PRODUCT && pkg.name === 'nehorai-farhi' && !pkg.type && !pkg.dependencies, `productName "${pkg.productName}" (the data folder's name), version ${pkg.version}`);
const main = await readFile(path.join(app, 'main.js'), 'utf8');
let parses = true; try { execFileSync(process.execPath, ['--check', path.join(app, 'main.js')], { stdio: 'pipe' }); } catch { parses = false; }
check('main.js parses, and asks for a page without Node, in a sandbox, with sound free to start', parses && /nodeIntegration: false/.test(main) && /contextIsolation: true/.test(main) && /sandbox: true/.test(main) && /'autoplay-policy', 'no-user-gesture-required'/.test(main) && /requestSingleInstanceLock/.test(main) && /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/.test(main));
const all = await walk(folder);
// against the release zip itself: every file of it is in the folder as it came, but for the .exe (renamed and
// edited), the default app and the other interface languages (removed)
const release = (await zipEntries(releaseZip)).filter((e) => !e.name.endsWith('/'));
const kept = release.filter((e) => !['electron.exe', 'resources/default_app.asar'].includes(e.name) && (!e.name.startsWith('locales/') || ['locales/en-US.pak', 'locales/he.pak'].includes(e.name)));
const sizeOf = Object.fromEntries(await Promise.all(all.map(async (f) => [f, (await stat(path.join(folder, f))).size])));
const lost = kept.filter((e) => sizeOf[e.name] !== e.size).map((e) => e.name);
const extra = all.filter((f) => !kept.some((e) => e.name === f) && ![`${PRODUCT}.exe`, README_NAME, ...appFiles.map((a) => `resources/app/${a}`)].includes(f));
check('Electron\'s own files are all there as released; its default app is not; nothing else was added', lost.length === 0 && extra.length === 0 && !all.includes('resources/default_app.asar') && release.some((e) => e.name === 'resources/default_app.asar'),
  `${kept.length} of the release's ${release.length} files kept${lost.length ? `, missing or changed: ${lost.join(', ')}` : ''}${extra.length ? `, unexpected: ${extra.join(', ')}` : ''}`);
const locales = all.filter((f) => f.startsWith('locales/'));
check('of the interface languages, English and Hebrew stay', String(locales) === 'locales/en-US.pak,locales/he.pak', `${locales.length} files`);

const note = await readFile(path.join(folder, README_NAME)).catch(() => null), text = note ? note.toString('utf8') : '';
check('the readme: how to start, the blue Windows box, the keys, where saves live', !!note && text.includes(`${PRODUCT}.exe`) && text.includes('Windows protected your PC') && text.includes('More info') && text.includes('Run anyway') && text.includes('F11') && text.includes('Alt+Enter') && text.includes(`%APPDATA%\\${PRODUCT}`) && text.includes(`AppData\\Roaming\\${PRODUCT}`), `"${README_NAME}", ${note?.length} bytes`);
check('the readme opens right in Notepad (the UTF-8 mark, Windows line ends)', !!note && note[0] === 0xef && note[1] === 0xbb && note[2] === 0xbf && !/[^\r]\n/.test(text) && text.includes('\r\n'));

// the zip
const zipFile = path.join(win, ZIP_NAME), zip = await zipEntries(zipFile), zipSize = (await stat(zipFile)).size;
const inZip = zip.filter((e) => !e.name.endsWith('/')), sizes = new Map(inZip.map((e) => [e.name, e.size]));
const onDisk = await Promise.all(all.map(async (f) => [`${PRODUCT}/${f}`, (await stat(path.join(folder, f))).size]));
check('the zip lists exactly the folder\'s files, with their sizes, under one top folder', inZip.length === onDisk.length && onDisk.every(([n, sz]) => sizes.get(n) === sz) && zip.every((e) => e.name.startsWith(`${PRODUCT}/`)), `${inZip.length} files in the zip, ${onDisk.length} in the folder`);
const crcOf = async (f) => crc32(await readFile(f)) >>> 0, entry = (n) => zip.find((e) => e.name === `${PRODUCT}/${n}`);
check('the .exe and the game in the zip are the ones read above (their checksums)', entry(`${PRODUCT}.exe`)?.crc === await crcOf(exeFile) && entry('resources/app/game.html')?.crc === await crcOf(path.join(app, 'game.html')));
check('the Hebrew file name is stored as UTF-8 and marked so (Windows\' own unzip reads it)', !!entry(README_NAME)?.utf8, entry(README_NAME)?.name);
let sound = true, why = ''; try { execFileSync('unzip', ['-tqq', zipFile], { stdio: 'pipe' }); } catch (e) { sound = false; why = String(e.stderr || e.message).slice(0, 200); }
check('the zip unpacks without an error (every file tested)', sound, why);
check('the zip\'s size', zipSize > 100 << 20 && zipSize === info.zip.bytes, `${mb(zipSize)} (${zipSize} bytes), ${mb(onDisk.reduce((a, [, sz]) => a + sz, 0))} unpacked`);

// ---------- 2. the same app on Linux, run for real ----------
const lin = path.join(out, 'linux'), linFolder = path.join(lin, PRODUCT), linApp = path.join(linFolder, 'resources/app'), bin = path.join(linFolder, 'nehorai-farhi');
const madeLin = tool('--out', lin, '--platform', 'linux-x64');
check('the tool builds the same app on Electron\'s Linux build', madeLin.status === 0 && existsSync(bin), madeLin.status === 0 ? `Electron ${ELECTRON_VERSION} linux-x64` : (madeLin.stderr || '').trim().split('\n').slice(-2).join(' | '));
if (madeLin.status === 0) {
  const same = String(await walk(linApp)) === String(appFiles) && (await Promise.all(appFiles.map(async (f) => await sha256(path.join(linApp, f)) === await sha256(path.join(app, f))))).every(Boolean);
  check('resources/app of the Linux folder is identical to the Windows one, file for file', same, appFiles.join(', '));

  let skip = '';
  const xvfb = spawnSync('which', ['xvfb-run']).status === 0;
  if (process.platform !== 'linux' || process.arch !== 'x64') skip = `this machine is ${process.platform} ${process.arch}, the check build is linux x64`;
  else if (!xvfb && !process.env.DISPLAY) skip = 'no display and no xvfb-run';
  else {
    const ldd = spawnSync('ldd', [bin], { encoding: 'utf8' }), missing = (ldd.stdout || '').split('\n').filter((l) => /not found/.test(l)).map((l) => l.trim().split(' ')[0]);
    if (missing.length) skip = `system libraries missing for Electron: ${missing.join(', ')}`;
  }
  if (skip) console.log(`SKIP  the Linux run of the app: ${skip}`);
  else {
    const report = path.join(out, 'smoke/report.json'), shot = path.join(out, 'smoke/shot.png'), runLog = path.join(out, 'smoke/run.log');
    await mkdir(path.dirname(report), { recursive: true });
    // software WebGL (this machine has no graphics chip), and no OS sandbox when root runs it
    const flags = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--smoke', report, shot];
    const run = xvfb ? spawnSync('xvfb-run', ['-a', bin, ...flags], { encoding: 'utf8', timeout: 420000 }) : spawnSync(bin, flags, { encoding: 'utf8', timeout: 420000 });
    await writeFile(runLog, `${run.stdout || ''}\n${run.stderr || ''}`);
    const r = existsSync(report) ? JSON.parse(await readFile(report, 'utf8')) : null;
    check('the app runs under a virtual display and its own check passes', run.status === 0 && !!r?.ok, r ? `exit ${run.status}, ${(r.ms.total / 1000).toFixed(0)} s${r.failure ? `, ${r.failure}` : ''}` : `exit ${run.status}, no report: see ${runLog}`);
    if (r) {
      check('it is the pinned Electron, and the page has no Node', r.electron === ELECTRON_VERSION && r.nodeInPage === false, `Electron ${r.electron}, Chromium ${r.chrome}`);
      check('a player\'s saves folder is named after the app (on Windows: %APPDATA%\\Nehorai Farhi, as the readme says)', r.appName === PRODUCT && path.basename(r.playerData || '') === PRODUCT, r.playerData);
      check('WebGL2 is up', r.webgl2 === true, r.renderer);
      check('the window and the page carry the game\'s title', r.title === TITLE && r.windowTitle === TITLE, r.windowTitle);
      check('the start button comes, starts the game, and the game\'s clock runs', r.started === true && r.running === true && r.state?.time > 0, `ready after ${(r.ms.ready / 1000).toFixed(1)} s, running after ${(r.ms.running / 1000).toFixed(1)} s, game time ${r.state?.time?.toFixed(1)} s at ${r.state?.fps} fps (software drawing)`);
      check('no page errors', r.errors.length === 0, r.errors.slice(0, 3).join(' | '));
      check('the page cannot leave: a pop-up and a navigation elsewhere are refused; loading itself again (a new game) passes', r.popupBlocked === true && r.navigationBlocked === true && r.reloads === true);
      check('the start screen has no dead link: the characters room, not in this build, is hidden', r.room === false && r.roomLink !== 'shown', `the link: ${r.roomLink}`);
      const k = r.keys || {};
      check('Esc is the game\'s: it pauses and resumes, in the window, in full screen and in the game\'s own full screen', k.escPauses && k.escResumes && k.escInFullScreenPauses && k.escInGameFullScreenPauses);
      check('F11 and Alt+Enter switch full screen both ways and do not reach the game', k.f11Enters && k.f11Leaves && k.altEnterEnters && k.altEnterLeaves && k.keptFromTheGame, `the game saw: ${[...new Set(k.seen || [])].join(', ')}`);
      check('the game\'s own full-screen button works, and F11 leaves it', k.gameButtonEnters && k.f11LeavesGameFullScreen && k.windowBack, `the button then reads "${k.gameButtonLabel}"`);
      const png = existsSync(shot) ? await readFile(shot) : null;
      check('a picture of the running game was saved', !!png && png.readUInt32BE(16) >= 1280 && png.readUInt32BE(20) >= 720 && png.length > 100000, png ? `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}, ${(png.length / 1024).toFixed(0)} KB: ${shot}` : 'no file');
      console.log(`      the asset layer on the page: ${r.assets ? 'yes' : 'no (the game file given has none)'}`);
      // a game file with the asset layer inside: a first start is the studio ident and then the opening film,
      // which played inside the app (its picture moving) before its button started the game
      if (r.assets) check('with the asset layer inside: the opening film played in the app before the game', r.film?.seen === true && r.film?.moved === true, JSON.stringify(r.film));
    }
  }
}

console.log('      the Windows .exe itself was not run: this machine cannot run Windows programs');
const passed = results.filter(Boolean).length;
if (passed === results.length && !keep) { await rm(folder, { recursive: true, force: true }); await rm(lin, { recursive: true, force: true }); }
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
