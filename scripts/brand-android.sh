#!/usr/bin/env bash
# Runs in CI after `npx cap add android`: swaps in the Dope Wars icon, dark system bars and portrait lock.
set -euo pipefail

RES=android/app/src/main/res
MANIFEST=android/app/src/main/AndroidManifest.xml

# Launcher icons (legacy square icons plus adaptive foreground)
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  mkdir -p "$RES/mipmap-$d"
  cp "branding/$d/ic_launcher.png" "$RES/mipmap-$d/ic_launcher.png"
  cp "branding/$d/ic_launcher.png" "$RES/mipmap-$d/ic_launcher_round.png"
  cp "branding/$d/ic_launcher_foreground.png" "$RES/mipmap-$d/ic_launcher_foreground.png"
done

mkdir -p "$RES/values" "$RES/mipmap-anydpi-v26"
cat > "$RES/values/ic_launcher_background.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#08060F</color>
</resources>
XML

for name in ic_launcher ic_launcher_round; do
cat > "$RES/mipmap-anydpi-v26/$name.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
XML
done

# Dark status and navigation bars (best effort: skipped if the template changes)
if grep -q 'name="AppTheme.NoActionBar"' "$RES/values/styles.xml"; then
  sed -i '/<style name="AppTheme.NoActionBar"/a\        <item name="android:statusBarColor">#08060F</item>\n        <item name="android:navigationBarColor">#08060F</item>' "$RES/values/styles.xml"
fi

# Lock to portrait
if ! grep -q 'screenOrientation' "$MANIFEST"; then
  sed -i '0,/<activity/s//<activity android:screenOrientation="portrait"/' "$MANIFEST"
fi

echo "Branding applied."
