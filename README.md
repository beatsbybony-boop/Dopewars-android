# Dope Wars for Android

A neon MiffCo remake of the classic trading game. Thirty days, a loan shark, six towns (Lewistown, Milroy, Reedsville, Burnham, Yeagertown and Belleville), cops, muggers and a trench coat that never has enough room.

The game itself is plain HTML, CSS and JavaScript in `www/`. [Capacitor](https://capacitorjs.com) wraps it as an Android app, and GitHub Actions builds the APK for you.

## Get the APK on your phone

1. Open the **Releases** page of this repo (right-hand side of the repo home page).
2. Download `DopeWars.apk` from the release named **Dope Wars (latest build)**.
3. Open the file on your phone. Android will ask you to allow installs from your browser or Files app. Allow it once, then tap Install.

Every push to `main` rebuilds the APK and replaces that release. You can also start a build by hand from the **Actions** tab with **Run workflow**.

## Play in a browser

Open `www/index.html`, or serve the folder with any static server.

## Layout

| Path | What it does |
| --- | --- |
| `www/engine.js` | Game rules (prices, events, cops, loan shark). No DOM, runs in Node. |
| `www/scene.js` | Animated canvas skyline for each borough. |
| `www/app.js` | Screens, trade sheets, sound. |
| `branding/` | Launcher icons. |
| `scripts/brand-android.sh` | Applies icon, dark bars and portrait lock during the build. |
| `.github/workflows/build-apk.yml` | Builds and publishes the APK. |

The APK is a debug build signed with the standard debug key. That is fine for your own phone. A Play Store release would need its own signing key.
