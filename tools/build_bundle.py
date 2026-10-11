"""Build dist/katzir-fc.html: the whole game in one self-contained HTML file.

CSS and JS are inlined, and every image and sound is embedded as a data URI in
window.KFC_ASSETS, which KFC.asset() reads. Fonts still come from Google Fonts.
Usage: python3 tools/build_bundle.py [OUT_PATH]
"""
import base64, json, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'dist' / 'katzir-fc.html'
MIME = {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg'}


def data_uri(rel):
    p = root / rel
    return 'data:' + MIME[p.suffix] + ';base64,' + base64.b64encode(p.read_bytes()).decode()


assets = {str(p.relative_to(root)): data_uri(p.relative_to(root))
          for p in sorted((root / 'assets').rglob('*')) if p.suffix in MIME}

html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'css' / 'app.css').read_text(encoding='utf-8')
css = re.sub(r'url\("\.\./(assets/[^"]+)"\)', lambda m: 'url("' + assets[m.group(1)] + '")', css)
html = html.replace('<link rel="stylesheet" href="css/app.css">', '<style>\n' + css + '\n</style>')
html = html.replace('<link rel="icon" href="assets/brand/crest-sm.png">',
                    '<link rel="icon" href="' + assets['assets/brand/crest-sm.png'] + '">')


def inline_script(m):
    code = (root / m.group(1)).read_text(encoding='utf-8')
    assert '</script' not in code, m.group(1)
    return '<script>\n' + code + '\n</script>'


first = True
def scripts(m):
    global first
    tag = inline_script(m)
    if first:
        first = False
        tag = '<script>window.KFC_ASSETS = ' + json.dumps(assets) + ';</script>\n' + tag
    return tag


html = re.sub(r'<script src="(js/[^"]+)"></script>', scripts, html)
assert 'src="js/' not in html and 'href="css/' not in html
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding='utf-8')
print('wrote', out, round(out.stat().st_size / 1e6, 2), 'MB,', len(assets), 'assets')
