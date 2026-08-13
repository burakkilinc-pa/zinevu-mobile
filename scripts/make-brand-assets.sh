#!/usr/bin/env bash
#
# Regenerates every launcher/splash bitmap from the brand SVG in assets/brand.
# Run it whenever the logo changes:  ./scripts/make-brand-assets.sh
#
# Needs ImageMagick (brew install imagemagick).
set -euo pipefail

cd "$(dirname "$0")/.."

LIME="#E7FFA4"   # brand accent — the logo tile's ground

SRC=assets/brand/primary-icon.svg
OUT=assets/images
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# The brand mark is a rounded lime tile with the Z knocked out of it. The
# adaptive icon needs those two apart: a flat lime plate underneath and the Z
# alone on top, so Android can parallax and mask them independently. So pull the
# glyph path out of the source SVG and re-render it on transparency.
sed -e 's|<rect[^/]*/>||' "$SRC" > "$TMP/glyph.svg"

# Android's adaptive foreground must sit inside the inner ~66% safe zone, or the
# launcher's own mask clips the mark: render at 600px and pad out to 1024.
magick -background none "$TMP/glyph.svg" -resize 600x600 \
  -background none -gravity center -extent 1024x1024 \
  PNG32:"$OUT/android-icon-foreground.png"
magick -size 1024x1024 "xc:$LIME" "$OUT/android-icon-background.png"

# Themed ("monochrome") icons are tinted by the launcher from the alpha channel
# alone, so the glyph must be a solid fill carrying its own shape as opacity.
magick -background none "$TMP/glyph.svg" -resize 600x600 \
  -background none -gravity center -extent 1024x1024 \
  \( +clone -alpha extract \) -alpha off -fill white -colorize 100 \
  -compose CopyOpacity -composite \
  PNG32:"$OUT/android-icon-monochrome.png"

# The full tile, for the iOS icon, the splash and the in-app logo.
magick -background none "$SRC" -resize 1024x1024 PNG32:"$OUT/icon.png"
magick -background none "$SRC" -resize 1024x1024 PNG32:"$OUT/splash-icon.png"
magick -background none "$SRC" -resize 1024x1024 PNG32:"$OUT/splash-icon-dark.png"
magick -background none "$SRC" -resize 192x192 PNG32:"$OUT/favicon.png"

echo "Regenerated brand assets in $OUT"
