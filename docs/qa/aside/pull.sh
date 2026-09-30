#!/bin/sh
# Moves the screenshots Aside just saved into docs/qa/, without their "tht-" prefix.
# A desktop capture is 2x. It is saved at 1440 px wide, which is enough to read.
dir="$(cd "$(dirname "$0")/.." && pwd)"
find ~/.aside/u/0/sessions -name 'tht-*.png' -mmin -30 | while read -r f; do
  n=$(basename "$f" | sed 's/^tht-//')
  w=$(sips -g pixelWidth "$f" | awk '/pixelWidth/ { print $2 }')
  if [ "$w" -gt 1440 ]; then sips --resampleWidth 1440 "$f" --out "$dir/$n" >/dev/null; else cp "$f" "$dir/$n"; fi
  rm "$f"
done
ls "$dir"/*.png
