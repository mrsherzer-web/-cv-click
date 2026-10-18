#!/usr/bin/env bash
# Downloads the Google Fonts used by titles/titles.html into titles/ and writes titles/local.css
set -euo pipefail
cd "$(dirname "$0")/titles"
curl -s -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@300;500;900&family=Heebo:wght@200;300;500;800;900&family=Suez+One&family=Secular+One&family=David+Libre:wght@400;700&family=Amatic+SC:wght@700&display=block" -o fonts.css
grep -oE "https://fonts.gstatic.com[^)]+" fonts.css | sort -u | while read -r u; do
  curl -s -o "$(echo "$u" | sed 's#https://fonts.gstatic.com/s/##; s#/#_#g')" "$u"
done
python3 -c "
import re
css=open('fonts.css').read()
css=re.sub(r'url\(https://fonts.gstatic.com/s/([^)]+)\)', lambda m: 'url('+m.group(1).replace('/','_')+')', css)
open('local.css','w').write(css)"
