#!/usr/bin/env bash
# Downloads the handful of public images from the current chuckanutscc.org
# (Wix) site that the demo seed expects, and uploads them to local R2 via
# Miniflare. Re-run any time to refresh local R2 state.
#
# Requires the dev server NOT to be holding wrangler's lock — easiest is to
# run this before `pnpm dev`.

set -euo pipefail

TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

declare -A SOURCES=(
  ["branding/logo.png:image/png"]="https://static.wixstatic.com/media/8bb02f_7732bf62958043a485f1a6aafbc567d9~mv2.png"
  ["hero/season-2026.jpg:image/jpeg"]="https://static.wixstatic.com/media/33a8cd_a9adbfc49da04de9ab8ca39fc68de9f9~mv2.jpg"
  ["imports/gallery-1.jpg:image/jpeg"]="https://static.wixstatic.com/media/8bb02f_74739ccea3ff49ac871ee681c6338c4e~mv2.jpg"
  ["imports/gallery-2.jpg:image/jpeg"]="https://static.wixstatic.com/media/8bb02f_ee6564ab0e0841608b1bcbab0437251f~mv2.jpg"
  ["imports/gallery-3.jpg:image/jpeg"]="https://static.wixstatic.com/media/79de41_9c56374df18a4eaaa525dbed46f61dd6~mv2.jpg"
  ["imports/gallery-4.jpg:image/jpeg"]="https://static.wixstatic.com/media/8bb02f_b2bfb327a87942e7a4b8ec1c583e0b37~mv2.jpg"
  ["about/photo-1.jpg:image/jpeg"]="https://static.wixstatic.com/media/8bb02f_2b0aa186b26e445abc901bbc4ec2fc1a~mv2.jpg"
  ["about/photo-2.jpg:image/jpeg"]="https://static.wixstatic.com/media/8bb02f_f268055e892343f09e08527c967fdcac~mv2.jpg"
  ["shop/hoodie-pullover.jpg:image/jpeg"]="https://static.wixstatic.com/media/8bb02f_f6d94937b8444aa39a30484ec8f60853~mv2.jpg"
  ["shop/hoodie-zip.jpg:image/jpeg"]="https://static.wixstatic.com/media/8bb02f_5f4c74059d0b46bd8190318dfacc09ab~mv2.jpg"
  ["shop/crew.jpg:image/jpeg"]="https://static.wixstatic.com/media/8bb02f_0a45780ec74846fa86c103abb16d2a4a~mv2.jpg"
  ["shop/tee.jpg:image/jpeg"]="https://static.wixstatic.com/media/8bb02f_b1c68962cead4491b445b36a968c9986~mv2.jpg"
)

for spec in "${!SOURCES[@]}"; do
  IFS=: read -r key ctype <<< "$spec"
  url="${SOURCES[$spec]}"
  echo "→ $key"
  curl -sf -o "$TMP/file" "$url"
  pnpm wrangler r2 object put "cscc-media/$key" --file="$TMP/file" --content-type="$ctype" --local > /dev/null
done

echo "Done. ${#SOURCES[@]} object(s) uploaded to local R2 (bucket: cscc-media)."
