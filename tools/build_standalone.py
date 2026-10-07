#!/usr/bin/env python3
"""
Builds the whole game as ONE html file that runs by double-clicking it
(no server, no internet): code, styles, fonts, images and the video are all
embedded inside.

  python3 tools/build_standalone.py            -> dist/gefen-snooker.html
Needs: node + npx (esbuild is fetched by npx on first run)
"""
import base64
import json
import mimetypes
import os
import re
import subprocess
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
os.makedirs(DIST, exist_ok=True)
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("font/woff2", ".woff2")


def data_uri(path):
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode()


def main():
    # 1. bundle every JS module (three.js included) into one classic script
    with tempfile.TemporaryDirectory() as tmp:
        js_out = os.path.join(tmp, "game.js")
        subprocess.run(
            ["npx", "--yes", "esbuild@0.25.10", os.path.join(ROOT, "src", "main.js"), "--bundle", "--format=iife",
             "--minify", "--target=es2020", "--log-level=error", "--outfile=" + js_out],
            check=True,
        )
        js = open(js_out, encoding="utf-8").read()

    # 2. styles with the fonts embedded
    fonts = open(os.path.join(ROOT, "css", "fonts.css"), encoding="utf-8").read()
    fonts = re.sub(r"url\('\.\./(assets/fonts/[^']+)'\)", lambda m: f"url('{data_uri(os.path.join(ROOT, m.group(1)))}')", fonts)
    style = open(os.path.join(ROOT, "css", "style.css"), encoding="utf-8").read()

    # 3. every image the game loads, keyed by file name
    img_dir = os.path.join(ROOT, "assets", "img")
    embed = {f: data_uri(os.path.join(img_dir, f)) for f in sorted(os.listdir(img_dir))}

    # 4. the page
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    html = re.sub(r'\s*<link rel="stylesheet" href="css/fonts.css" />', "", html)
    html = html.replace('<link rel="stylesheet" href="css/style.css" />', f"<style>\n{fonts}\n{style}\n</style>")
    for ext in ("mp4", "webm"):
        uri = data_uri(os.path.join(ROOT, "assets", "video", "possession." + ext))
        html = html.replace(f'src="assets/video/possession.{ext}"', f'src="{uri}"')
    boot = "<script>window.__EMBED = " + json.dumps(embed) + ";</script>\n"
    js = js.replace("</script", "<\\/script")
    html = html.replace('<script type="module" src="src/main.js"></script>', boot + "<script>\n" + js + "\n</script>")
    out = os.path.join(DIST, "gefen-snooker.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print("wrote", out, f"{os.path.getsize(out) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
