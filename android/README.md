# lynx-needle Android SDK

Gradle library module that gives a Lynx host app everything needed to load
the `needle` NAPI addon:

- `LynxNeedle` — one-stop entry: `registerModule()` + `attach(lynxView)`
- `LynxNodeAPIModule` — the page-facing `LynxNodeAPI` bridge module
- `lynx_napi_addon_loader.so` — built from `cpp/LynxNodeAPI.{h,cc}`
  (vendored from `lynx-family/lynx` `explorer/cpp`, develop branch)
- `jniLibs/<abi>/{libneedle.so, libnapi_adapter.so}` — addon + weak-NAPI
  dispatcher (written there directly by `npm run build:android`; **not committed**)

## Prerequisites

- Host app already integrates a Lynx runtime (`org.lynxsdk.lynx:lynx`).
  The SDK declares it `compileOnly`; the host picks the version.
- **NAPI requires a source-built Lynx runtime** — the published Maven
  binaries compile out `enable_napi_binding`, so `onRuntimeAttach` never
  fires. See the repo-root README for details.
- Repo root: `npm install && npm run fetch-engine && npm run build:android`
  (builds straight into the module's jniLibs).

## Usage

```gradle
// settings.gradle
include ':lynx-needle-sdk'
project(':lynx-needle-sdk').projectDir = new File('<repo>/android')

// app/build.gradle
dependencies { implementation project(':lynx-needle-sdk') }
```

```java
// once, after LynxEnv.init:
LynxNeedle.registerModule();
// per LynxView, after LynxViewBuilder.build():
LynxNeedle.attach(lynxView);
```

See `examples/android-host/` for a complete app.
