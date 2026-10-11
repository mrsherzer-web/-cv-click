"""Build the claude.ai artifact variant of index.html.

The artifact host wraps the page in its own <!doctype>/<head>/<body>, so this keeps
the title, stylesheet links and the body content, and drops the outer document tags.
Usage: python3 tools/build_artifact.py OUT_PATH
"""
import re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'index.html').read_text(encoding='utf-8')
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
keep = []
for line in head.strip().splitlines():
    line = line.strip()
    if line.startswith('<meta charset') or line.startswith('<meta name="viewport"') or 'rel="icon"' in line:
        continue
    keep.append(line)
out = '\n'.join(keep) + '\n' + body.strip() + '\n'
pathlib.Path(sys.argv[1]).write_text(out, encoding='utf-8')
print('wrote', sys.argv[1], len(out), 'bytes')
