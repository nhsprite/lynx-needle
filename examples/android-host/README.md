# Needle Host (Android example)

Minimal Lynx host app showing how to integrate `android/` and load the
frontend demo bundle (`examples/lynx-needle-demo`) on a real device or
emulator.

## Build & install

```bash
# at the repo root — one-time or after addon changes
npm install                       # weak-node-api headers for the JNI glue
npm run fetch-engine              # engine static libs
npm run build:android             # -> android/src/main/jniLibs/<abi>/{libneedle,libnapi_adapter}.so

# then build the APK (JDK 17)
cd examples/android-host
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Open "Needle Host", enter the demo bundle URL
(`http://<your-ip>:3000/main.lynx.bundle` from `npm run dev` in
`examples/lynx-needle-demo`) and tap GO.

## How it works

- `HostApplication` — registers Lynx log/http services, `LynxEnv.init`, then
  `LynxNeedle.registerModule()` (from `android/`)
- `MainActivity` — builds a `LynxView`, calls `LynxNeedle.attach(lynxView)`,
  renders the URL from the editable input field
- All NAPI loader plumbing (module, JNI, native loader, jniLibs) lives in the
  `android/` library module

## Notes

- **The example pins the 4.3.0 nightly snapshot**, the first published Lynx
  build with NAPI binding (fetched from the Maven Central snapshot repository
  declared in `settings.gradle`). Older release-repo binaries compile it out —
  there the page renders but reports "addon not available"
  (`onRuntimeAttach` never fires). A source-built `liblynx.so`
  (`enable_napi_binding=true enable_lepusng_worklet=true`) also works;
  `packagingOptions.pickFirst '**/liblynx.so'` in `app/build.gradle` already
  prefers a copy dropped into `app/src/main/jniLibs/<abi>/`.
- The app ships only `arm64-v8a`; the SDK module itself builds both
  `arm64-v8a` and `armeabi-v7a`.
