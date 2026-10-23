#!/bin/bash
set -euo pipefail
export CLANG_MODULE_CACHE_PATH="${CLANG_MODULE_CACHE_PATH:-/private/tmp/home-inventory-clang-cache}"
export SWIFTPM_MODULECACHE_OVERRIDE="${SWIFTPM_MODULECACHE_OVERRIDE:-/private/tmp/home-inventory-swift-cache}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/build/Мой дом.app"
cd "$ROOT/web"
if [ ! -d node_modules ]; then pnpm install --frozen-lockfile; fi
pnpm build
cd "$ROOT/macos"
swift build --disable-sandbox -c release --product HomeInventory --scratch-path "$ROOT/build/swift"
BIN="$(swift build -c release --show-bin-path --scratch-path "$ROOT/build/swift")/HomeInventory"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/HomeInventory"
if [ -d "$APP/Contents/Resources/web" ]; then rm -r "$APP/Contents/Resources/web"; fi
cp -R "$ROOT/web/dist" "$APP/Contents/Resources/web"
cp "$ROOT/macos/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Мой дом</string>
<key>CFBundleDisplayName</key><string>Мой дом</string>
<key>CFBundleIdentifier</key><string>local.myhome.inventory</string>
<key>CFBundleExecutable</key><string>HomeInventory</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSHumanReadableCopyright</key><string>Based on House Control © 0xProbability. MIT License.</string>
<key>NSPrincipalClass</key><string>NSApplication</string>
</dict></plist>
PLIST
codesign --force --sign - "$APP"
echo "Готово: $APP"
