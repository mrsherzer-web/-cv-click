// Wraps the game's single HTML file as a Windows application: a folder with "Nehorai Farhi.exe" (Electron with
// the game inside), zipped. It runs on Linux, macOS or Windows; nothing of Windows itself is needed to build.
//
//   node tools/make-windows-app.mjs --game <file.html> --out <dir>
//        [--version <electron version>]   the engine to wrap with (default: the pinned one in desktop-app/lib.mjs)
//        [--icon <file.ico>]              an icon from outside instead of the one drawn here
//        [--characters <file.html>]       the characters room (the game's second page), also as one HTML file:
//                                         with it the start screen's link opens it, without it the link is hidden
//        [--platform linux-x64] [--no-zip]   the same app on another Electron build: used by the test, which
//                                            runs the Linux one here because a Windows .exe cannot run on Linux
//
// What it makes in <dir>:
//   Nehorai Farhi/                 the application folder (Electron, with resources/app/{package.json, main.js, game.html})
//   Nehorai-Farhi-Windows.zip      that folder, zipped: the file to hand out
//   icon.ico, build.json           the icon that went into the .exe, and what was built (versions, sizes, checksums)
//
// Electron's zip and the two npm tools that edit the .exe are downloaded once into ~/.cache/nehorai-desktop
// (or $NEHORAI_DESKTOP_CACHE); see desktop-app/lib.mjs. docs/desktop-windows.md tells the whole story.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPANY, ELECTRON_VERSION, PRODUCT, README_NAME, TITLE, ZIP_NAME, electronZip, exeResources, loadResedit, makeIcon, markZipNamesUtf8, peHeaders, sha256 } from './desktop-app/lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const game = opt('--game'), out = opt('--out');
if (!game || !out) { console.log('usage: node tools/make-windows-app.mjs --game <file.html> --out <dir> [--characters <file.html>] [--version <electron version>] [--icon <file.ico>]'); process.exit(2); }
if (!existsSync(game)) { console.error(`no such game file: ${game}`); process.exit(2); }
const version = opt('--version') || ELECTRON_VERSION, platform = opt('--platform') || 'win32-x64', windows = platform.startsWith('win32');
const log = (line) => console.log(line);
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const sh = (cmd, a, cwd) => execFileSync(cmd, a, { cwd, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });

const outDir = path.resolve(out), appDir = path.join(outDir, PRODUCT), zipFile = path.join(outDir, ZIP_NAME);
const meta = JSON.parse(await readFile(path.join(here, '..', 'package.json'), 'utf8'));
const appVersion = meta.version || '1.0.0';

// ---------- Electron, unpacked ----------
const electron = await electronZip(version, platform, log);
log(`Electron ${version} ${platform}: ${electron.cached ? 'from the cache' : 'downloaded'}, checksum as the release says`);
await rm(appDir, { recursive: true, force: true });
await rm(zipFile, { force: true });
await mkdir(appDir, { recursive: true });
sh('unzip', ['-q', '-o', electron.zip, '-d', appDir]);

// the app in place of Electron's own start page; of the interface languages only English and Hebrew stay
// (the window has no menus to translate, and the rest is 40 MB)
const resources = path.join(appDir, 'resources'), app = path.join(resources, 'app');
await rm(path.join(resources, 'default_app.asar'), { force: true });
for (const f of await readdir(path.join(appDir, 'locales')).catch(() => [])) if (!['en-US.pak', 'he.pak'].includes(f)) await rm(path.join(appDir, 'locales', f));
await mkdir(app, { recursive: true });
await writeFile(path.join(app, 'package.json'), `${JSON.stringify({ name: 'nehorai-farhi', productName: PRODUCT, version: appVersion, description: TITLE, author: COMPANY, main: 'main.js', private: true }, null, 2)}\n`);
await copyFile(path.join(here, 'desktop-app', 'main.js'), path.join(app, 'main.js'));
await copyFile(game, path.join(app, 'game.html'));
if (opt('--characters')) await copyFile(opt('--characters'), path.join(app, 'characters.html'));

const build = { product: PRODUCT, platform, electron: version, electronZipSha256: electron.sha256, appVersion, game: { file: path.resolve(game), bytes: (await stat(game)).size, sha256: await sha256(game) }, folder: appDir };

if (windows) {
  // ---------- the .exe: its name, its icon, what Windows says about it ----------
  const exeFile = path.join(appDir, `${PRODUCT}.exe`);
  await rename(path.join(appDir, 'electron.exe'), exeFile);
  const icon = opt('--icon') ? path.resolve(opt('--icon')) : await makeIcon(log);
  await copyFile(icon, path.join(outDir, 'icon.ico'));
  const libs = await loadResedit(log), { ResEdit, PE } = libs;
  const exe = PE.NtExecutable.from(await readFile(exeFile), { ignoreCert: true }); // a signature would not outlive the edit anyway
  const res = PE.NtExecutableResource.from(exe);
  const group = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)[0];
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, group?.id ?? 1, group?.lang ?? 1033, ResEdit.Data.IconFile.from(await readFile(icon)).icons.map((i) => i.data));
  const info = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  const lang = info.getAvailableLanguages()[0] || { lang: 1033, codepage: 1200 };
  info.setFileVersion(`${appVersion}.0`, lang.lang);
  info.setProductVersion(`${appVersion}.0`, lang.lang);
  info.setStringValues(lang, {
    ProductName: PRODUCT, FileDescription: TITLE, CompanyName: COMPANY, InternalName: PRODUCT, OriginalFilename: `${PRODUCT}.exe`,
    LegalCopyright: `© ${new Date().getFullYear()} ${COMPANY}. Built with Electron ${version} (MIT licence: see LICENSE).`,
  });
  info.removeStringValue(lang, 'SquirrelAwareVersion'); // Electron's note to an installer this folder does not use
  info.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  await writeFile(exeFile, Buffer.from(exe.generate()));

  // read back from the file on disk, the way Windows will: a tool that says it is done has looked
  const pe = await peHeaders(exeFile), back = await exeResources(exeFile, libs);
  if (!pe.valid || !pe.executable || pe.dll) throw new Error(`the edited .exe is not a valid program (${pe.why || 'wrong kind'})`);
  if (back.strings.ProductName !== PRODUCT || back.strings.FileDescription !== TITLE || back.strings.CompanyName !== COMPANY) throw new Error('the version strings did not reach the .exe');
  if (!back.icons.length) throw new Error('the icon did not reach the .exe');
  log(`${PRODUCT}.exe: ${pe.machine}, ${mb(pe.size)}, icon ${back.iconGroups[0].sizes.join('/')}, "${back.strings.ProductName}" by ${back.strings.CompanyName}`);
  Object.assign(build, { exe: { file: exeFile, bytes: pe.size, machine: pe.machine, sha256: await sha256(exeFile), icon: back.iconGroups[0].sizes, strings: back.strings, fileVersion: back.fileVersion } });

  // ---------- the note beside the .exe (Notepad's line ends, and the mark that tells old Notepads it is UTF-8) ----------
  await writeFile(path.join(appDir, README_NAME), `\ufeff${readme().replace(/\n/g, '\r\n')}`);
} else {
  await rename(path.join(appDir, 'electron'), path.join(appDir, 'nehorai-farhi'));
}

// ---------- the zip ----------
if (windows && !args.includes('--no-zip')) {
  // -X: no Unix owner and time notes. The readme's Hebrew name is then marked as UTF-8, which is what
  // Windows' own unzip reads (the zip program marks it only on a machine whose locale is UTF-8)
  sh('zip', ['-r', '-q', '-X', zipFile, PRODUCT], outDir);
  await markZipNamesUtf8(zipFile);
  build.zip = { file: zipFile, bytes: (await stat(zipFile)).size, sha256: await sha256(zipFile) };
  log(`${zipFile}  ${mb(build.zip.bytes)}`);
}
if (windows) await writeFile(path.join(outDir, 'build.json'), `${JSON.stringify(build, null, 2)}\n`);
log(`${appDir}  (Electron ${version} ${platform}, game ${mb(build.game.bytes)})`);

function readme() {
  return `${TITLE}
גרסת המחשב ל-Windows  ·  ${COMPANY}

איך מפעילים
-----------
1. מחלצים את כל התיקייה מתוך קובץ ה-ZIP: לחיצה ימנית על הקובץ, "חלץ הכול" (Extract All).
   לא מפעילים את המשחק מתוך ה-ZIP עצמו.
2. נכנסים לתיקייה "${PRODUCT}" ולוחצים פעמיים על "${PRODUCT}.exe".

אין התקנה ואין צורך באינטרנט. הקובץ exe חייב להישאר בתוך התיקייה, יחד עם שאר הקבצים שבה.
צריך Windows 10 או Windows 11 (64 ביט).

אם מופיע חלון כחול: "Windows protected your PC" ("Windows הגן על המחשב שלך")
---------------------------------------------------------------------------
Windows מציג את החלון הזה לכל תוכנה שאין לה חתימה דיגיטלית בתשלום. למשחק אין חתימה כזאת.
לוחצים על "More info" ("מידע נוסף") ואז על "Run anyway" ("הפעל בכל זאת").
צריך לעשות את זה רק בפעם הראשונה.

מקשים
-----
המקלדת צריכה להיות על אנגלית (מחליפים שפה עם Alt+Shift): בעברית מקשי האותיות לא מגיבים.

  W A S D או החצים     הליכה ונהיגה
  Shift                ריצה
  E או Enter           פעולה: לדבר, להיכנס לרכב, לקחת
  F                    לצאת מהרכב
  רווח                 בלם יד בנהיגה, התחמקות בקרב
  J                    אגרוף, ירי במרקר הפיינטבול
  K                    הגנה (להחזיק)
  L                    התחמקות
  U                    מכה חזקה
  I                    דחיפה
  O                    מכה מיוחדת
  R                    טעינה
  עכבר                 גוררים על המסך כדי לסובב את המצלמה; על כל כפתור שעל המסך אפשר ללחוץ
  Esc או P             עצירה
  F11 או Alt+Enter     מסך מלא, ולחיצה נוספת יוצאת ממנו

שמירות
------
המשחק שומר לבד. השמירה נמצאת במחשב, בתיקייה:
  %APPDATA%\\${PRODUCT}
  (כלומר C:\\Users\\שם-המשתמש\\AppData\\Roaming\\${PRODUCT})
אפשר להעביר או למחוק את תיקיית המשחק בלי לאבד את השמירה. מחיקת התיקייה שלמעלה מוחקת את השמירה.

הסרה
----
מוחקים את תיקיית המשחק. אם רוצים למחוק גם את השמירה, מוחקים גם את התיקייה שלמעלה.

כל הדמויות והאירועים במשחק בדיוניים.
המשחק רץ על Electron (רישיון MIT). הרישיונות נמצאים בקבצים LICENSE ו-LICENSES.chromium.html.
`;
}
