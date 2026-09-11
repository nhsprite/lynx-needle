# Needle Host (Android example)

Minimal Lynx host app showing how to integrate `packages/lynx-needle/android/` and load the
frontend demo bundle (`examples/lynx-needle-demo`) on a real device or
emulator.

## Build & install

```bash
# at the repo root — one-time or after addon changes
npm install                       # AutoLink codegen + weak-node-api headers
npm run fetch-engine              # engine static libs
npm run build                     # BTS facade + registration sources
npm run build:android             # -> packages/lynx-needle/android/src/main/jniLibs/<abi>/libNeedle.so

# then build the APK (JDK 17)
cd examples/android-host
JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Open "Needle Host" and scan the QR code printed by `npm run dev` in
`examples/lynx-needle-demo`. To reload, tap "↻ scan" in the top bar.
(Automation hook: `am start -n com.lynxneedle.host/.MainActivity --es url
http://<your-ip>:3000/main.lynx.bundle` loads a bundle without scanning.)

## How it works

- `HostApplication` — registers Lynx log/http services, `LynxEnv.init`, then
  `LynxAutolinkGenerated.setupGlobal(this)`
- `MainActivity` — scans the dev-server QR code (zxing), builds a `LynxView`,
  and renders the scanned bundle URL
- The Lynx library plugins scan the `lynx-needle` npm dependency, include its
  Android library project, generate the registry, load `libNeedle.so`, and
  register addon name `Needle`

## Notes

- The example pins
  `4.3.0-nightly.202609080610.178.gcd26ecb7-SNAPSHOT` and resolves it from the
  Maven Central snapshot repository declared in `settings.gradle`.
- `lynx.primjs.version` is pinned to `4.2.0-alpha.0-SNAPSHOT`, matching the
  PrimJS dependency declared by that Lynx nightly. Do not override it to
  `4.3.0-alpha.0-SNAPSHOT` for this SDK snapshot; the page fails while
  evaluating `lynx_core.js`.
- The app ships only `arm64-v8a`; the SDK module itself builds both
  `arm64-v8a` and `armeabi-v7a`.
