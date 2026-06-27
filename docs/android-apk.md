# Android APK pipeline

Capacitor wraps the existing Vite `dist` output. The Phaser/Vue runtime remains the source of the playable game; Android only provides the native shell.

## Prerequisites

- Node.js `>=22.12.0` and npm.
- Android Studio with Android SDK Platform 36 and SDK build tools installed.
- JDK available to Gradle. Android Studio's bundled JDK is fine if `JAVA_HOME` points to it.
- `adb` on `PATH` for install/smoke testing.

On this workstation, Node/npm are available, but `java` and `adb` were not visible on `PATH` when this pipeline was added.

## Commands

```bash
npm run android:build:web
npm run android:sync
npm run android:open
npm run android:apk:debug
npm run android:apk:release
npm run android:aab:release
```

The debug APK is written under `android/app/build/outputs/apk/debug/`.
Release APK/AAB outputs are written under `android/app/build/outputs/apk/release/` and `android/app/build/outputs/bundle/release/`.

## Release signing

Debug builds use the normal Android debug signing setup. Release signing is read from environment variables, Gradle properties, or an ignored `android/keystore.properties` file.

Use these keys:

```properties
REACT_TD_UPLOAD_STORE_FILE=C:/absolute/path/to/react-td-upload.jks
REACT_TD_UPLOAD_STORE_PASSWORD=change-me
REACT_TD_UPLOAD_KEY_ALIAS=react-td
REACT_TD_UPLOAD_KEY_PASSWORD=change-me
```

`android/keystore.properties`, `*.jks`, and `*.keystore` files are ignored and must not be committed.

## Smoke test checklist

- Install the debug APK with `adb install`.
- Launches to the React TD title screen.
- New run starts and tap placement works.
- HUD overlays fit portrait viewport and safe areas.
- Audio starts only after a user gesture and mute persists.
- Save/resume survives app restart.
- Phaser assets and CSS image assets load from the packaged APK.
- Android Back returns demo routes to `/`; from `/`, it minimizes the app.
