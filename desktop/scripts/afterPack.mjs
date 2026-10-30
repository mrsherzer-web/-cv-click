// electron-builder afterPack hook: embeds the game icon and Windows version info
// into the .exe using resedit (pure JavaScript, so no Wine is needed on Linux/macOS).
import fs from 'fs';
import path from 'path';
import * as ResEdit from 'resedit';

const NAME = 'אל תעירו את נועם';

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const { appOutDir, packager } = context;
  const exeName = `${packager.executableName || packager.appInfo.productFilename}.exe`;
  const exePath = path.join(appOutDir, exeName);
  const icoPath = path.join(packager.info.buildResourcesDir, 'icon.ico');
  const version = packager.appInfo.version;
  const [maj, min, pat] = version.split('.').map((n) => parseInt(n, 10) || 0);

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);

  // icon: replace the existing icon group (keeps its id/language)
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const target = groups[0] || { id: 1, lang: 1033 };
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, target.id, target.lang, ico.icons.map((i) => i.data));

  // version info shown in Explorer > Properties > Details and in Task Manager
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
  vi.setFileVersion(maj, min, pat, 0, 1033);
  vi.setProductVersion(maj, min, pat, 0, 1033);
  const strings = {
    FileDescription: NAME,
    ProductName: NAME,
    CompanyName: 'קומונת דימונה',
    LegalCopyright: '© 2026 קומונת דימונה',
    OriginalFilename: exeName,
    InternalName: 'DontWakeNoam',
    FileVersion: version,
    ProductVersion: version,
  };
  for (const lang of vi.getAllLanguagesForStringValues()) {
    vi.setStringValues(lang, strings);
    vi.removeStringValue(lang, 'SquirrelAwareVersion');
  }
  if (!vi.getAllLanguagesForStringValues().length) vi.setStringValues({ lang: 1033, codepage: 1200 }, strings);
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`  • embedded icon + version ${version} into ${exeName}`);
}
