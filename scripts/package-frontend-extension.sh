#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
MANIFEST="$ROOT/packages/viacrm-frontend/manifest.json"
VERSION="$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$MANIFEST" | head -n 1)"
if [ -z "$VERSION" ]; then
  echo "Could not read extension version from $MANIFEST" >&2
  exit 1
fi
OUTPUT="$ROOT/packages/ViaCRM-Frontend-$VERSION.zip"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT HUP INT TERM

VITE_BASE_PATH="/client/custom/viacrm/" npm --prefix "$ROOT/frontend" run build

mkdir -p "$STAGE/files/client/custom/viacrm"
cp -R "$ROOT/frontend/dist/." "$STAGE/files/client/custom/viacrm/"
cp "$MANIFEST" "$STAGE/manifest.json"
cp "$ROOT/packages/viacrm-frontend/README.md" "$STAGE/README.md"
cp "$ROOT/packages/viacrm-frontend/files/client/custom/viacrm/.htaccess" "$STAGE/files/client/custom/viacrm/.htaccess"

rm -f "$OUTPUT"
(cd "$STAGE" && zip -qr "$OUTPUT" .)
printf 'Created %s\n' "$OUTPUT"
