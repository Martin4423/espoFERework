#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
VERSION="2.0.177"
OUTPUT="$ROOT/packages/ViaCRM-Frontend-$VERSION.zip"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT HUP INT TERM

VITE_BASE_PATH="/client/custom/viacrm/" npm --prefix "$ROOT/frontend" run build

mkdir -p "$STAGE/files/client/custom/viacrm"
cp -R "$ROOT/frontend/dist/." "$STAGE/files/client/custom/viacrm/"
cp "$ROOT/packages/viacrm-frontend/manifest.json" "$STAGE/manifest.json"
cp "$ROOT/packages/viacrm-frontend/README.md" "$STAGE/README.md"
cp "$ROOT/packages/viacrm-frontend/files/client/custom/viacrm/.htaccess" "$STAGE/files/client/custom/viacrm/.htaccess"
cp -R "$ROOT/packages/viacrm-frontend-bridge/files/." "$STAGE/files/"

rm -f "$OUTPUT"
(cd "$STAGE" && zip -qr "$OUTPUT" .)
printf 'Created %s\n' "$OUTPUT"
