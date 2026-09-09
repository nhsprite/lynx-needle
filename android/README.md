# lynx-needle Android SDK

Gradle library module that gives a Lynx host app everything needed to load
the `Needle` NAPI addon through Lynx AutoLink:

- `CMakeLists.txt` — builds `libNeedle.so` from `shared/nativeModule`
- `build.gradle` — source-built AutoLink Android library project
- `jniLibs/<abi>/{libNeedle.so, libnapi.so, libnapi_adapter.so}` — generated
  by the Gradle/CMake build

## Prerequisites

- Host app already integrates a Lynx runtime (`org.lynxsdk.lynx:lynx`).
  Use `4.3.0-nightly.202609080610.178.gcd26ecb7-SNAPSHOT`.
- The host Gradle project applies `org.lynxsdk.lynx.library-settings` and
  `org.lynxsdk.lynx.library-build` from the same 4.3 nightly.
- Keep `lynx.primjs.version` aligned with the Lynx AAR's POM. For this nightly
  that is `4.2.0-alpha.0-SNAPSHOT`; overriding it to `4.3.0-alpha.0-SNAPSHOT`
  causes `lynx_core.js` initialization failures on Android.
- Repo root: `npm install && npm run fetch-engine && npm run build:android`
  (builds straight into this module's jniLibs).

## Usage

```gradle
// settings.gradle
plugins {
  id 'org.lynxsdk.lynx.library-settings' version '4.3.0-nightly.202609080610.178.gcd26ecb7-SNAPSHOT'
}
maven { url 'https://central.sonatype.com/repository/maven-snapshots/' }

// app/build.gradle
plugins {
  id 'org.lynxsdk.lynx.library-build'
}
```

```java
// once, after LynxEnv.init:
LynxAutolinkGenerated.setupGlobal(this);
```

The AutoLink plugin scans the npm dependency's `lynx.lib.json`, creates the
generated registry, loads `libNeedle.so`, and registers addon name `Needle`.
There is no Java bridge module and no per-view attach call.

See `examples/android-host/` for a complete app.
