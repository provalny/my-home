#!/bin/bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$TASK_ROOT"
VERSION="$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("web/src/inventory/releases.json"))[0].version)')"
APP="$TASK_ROOT/build/Мой дом.app"
test -d "$APP"
mkdir -p build/release
ZIP="$TASK_ROOT/build/release/MyHome-$VERSION.zip"
DMG="$TASK_ROOT/build/release/MyHome.dmg"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"
STAGE="$(mktemp -d "$TASK_ROOT/build/dmg-stage.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
ditto "$APP" "$STAGE/Мой дом.app"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "Мой дом" -srcfolder "$STAGE" -ov -format UDZO "$DMG"
cd "$TASK_ROOT/build/release"
shasum -a 256 "MyHome-$VERSION.zip" MyHome.dmg > SHA256SUMS
echo "Packages: $TASK_ROOT/build/release"
