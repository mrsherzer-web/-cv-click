"""Build the Vercel entry page: index.html with a <base> pointing at jsDelivr.

The repo is public, so jsDelivr serves the CSS, JS, images and sounds straight from
GitHub, pinned to one commit. Vercel then only needs this single page.
Usage: python3 tools/build_vercel.py COMMIT_SHA OUT_PATH
"""
import pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent
sha, out = sys.argv[1], pathlib.Path(sys.argv[2])
html = (root / 'index.html').read_text(encoding='utf-8')
base = '<base href="https://cdn.jsdelivr.net/gh/mrsherzer-web/-cv-click@' + sha + '/">'
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + base, 1)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding='utf-8')
print('wrote', out, len(html), 'bytes')
