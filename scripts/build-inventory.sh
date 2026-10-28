#!/bin/bash
set -euo pipefail
export CLANG_MODULE_CACHE_PATH="${CLANG_MODULE_CACHE_PATH:-/private/tmp/home-inventory-clang-cache}"
export SWIFTPM_MODULECACHE_OVERRIDE="${SWIFTPM_MODULECACHE_OVERRIDE:-/private/tmp/home-inventory-swift-cache}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/build/Life Assistant.app"
ARCH_FLAGS=(--arch "$(uname -m)")
if [ "${INVENTORY_UNIVERSAL:-0}" = 1 ]; then ARCH_FLAGS=(--arch arm64 --arch x86_64); fi
RELEASE_METADATA="$(node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const releases = JSON.parse(readFileSync(process.argv[1], "utf8"));
  if (!releases.length) throw Error("История изменений пуста");
  for (const [i, release] of releases.entries()) {
    if (!/^\d+\.\d+(?:\.\d+)?$/.test(release.version) || !Number.isSafeInteger(release.build) || release.build < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(release.date) || !release.title || !release.changes?.length || release.changes.some(text => typeof text !== "string" || !text.trim())) throw Error("Некорректная запись истории изменений");
    if (i && releases[i - 1].build <= release.build) throw Error("Новые версии должны идти первыми, номер сборки должен расти");
  }
  console.log(releases[0].version, releases[0].build);
' "$ROOT/web/src/inventory/releases.json")"
read -r APP_VERSION APP_BUILD <<< "$RELEASE_METADATA"
cd "$ROOT/web"
if [ ! -d node_modules ]; then pnpm install --frozen-lockfile; fi
pnpm build
cd "$ROOT/macos"
swift build --disable-sandbox -c release --product HomeInventory --scratch-path "$ROOT/build/swift" "${ARCH_FLAGS[@]}"
BIN="$(swift build -c release --show-bin-path --scratch-path "$ROOT/build/swift" "${ARCH_FLAGS[@]}")/HomeInventory"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/HomeInventory"
if [ -d "$APP/Contents/Resources/web" ]; then rm -r "$APP/Contents/Resources/web"; fi
cp -R "$ROOT/web/dist" "$APP/Contents/Resources/web"
cp "$ROOT/macos/Icons/aurora.icns" "$APP/Contents/Resources/AppIcon.icns"
mkdir -p "$APP/Contents/Resources/Icons"
cp "$ROOT"/macos/Icons/*.icns "$APP/Contents/Resources/Icons/"
SPARKLE_FRAMEWORK="$(find "$ROOT/build/swift/artifacts" -type d -name Sparkle.framework -path '*macos*' -print -quit)"
test -n "$SPARKLE_FRAMEWORK"
mkdir -p "$APP/Contents/Frameworks"
if [ -d "$APP/Contents/Frameworks/Sparkle.framework" ]; then rm -r "$APP/Contents/Frameworks/Sparkle.framework"; fi
ditto "$SPARKLE_FRAMEWORK" "$APP/Contents/Frameworks/Sparkle.framework"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Life Assistant</string>
<key>CFBundleDisplayName</key><string>Life Assistant</string>
<key>CFBundleIdentifier</key><string>local.myhome.inventory</string>
<key>CFBundleExecutable</key><string>HomeInventory</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>$APP_VERSION</string>
<key>CFBundleVersion</key><string>$APP_BUILD</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSHumanReadableCopyright</key><string>Based on House Control © 0xProbability. MIT License.</string>
<key>NSPrincipalClass</key><string>NSApplication</string>
<key>NSLocalNetworkUsageDescription</key><string>Life Assistant подключает телефон к вашей квартире и вещам по домашней сети Wi-Fi.</string>
<key>NSCalendarsUsageDescription</key><string>Life Assistant предлагает занятое время из выбранных календарей для подтверждения в личном опросе.</string>
<key>NSCalendarsFullAccessUsageDescription</key><string>Life Assistant читает события выбранных календарей за один день, чтобы предложить занятое время перед сохранением.</string>
</dict></plist>
PLIST
python3 "$ROOT/scripts/configure-updates.py" "$APP/Contents/Info.plist" "$ROOT/distribution.json"
codesign --force --sign - "$APP"
codesign --verify --deep --strict "$APP"
echo "Готово: $APP"
