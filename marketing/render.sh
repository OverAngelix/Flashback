#!/bin/sh
# Rend chaque pub HTML en PNG avec Chrome sans interface (CHROME_PATH si le chemin n'est pas standard).
# Polices lues dans client/node_modules : faire npm install dans client/ d'abord.
set -e
cd "$(dirname "$0")"
CHROME="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
for spec in instagram:1080,1350 story:1080,1920 twitter:1600,900; do
  name=${spec%%:*}
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --allow-file-access-from-files --virtual-time-budget=4000 --window-size="${spec#*:}" \
    --screenshot="$PWD/flashback-$name.png" "file://$PWD/$name.html" 2>/dev/null
  echo "flashback-$name.png"
done
