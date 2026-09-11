# lynx-needle

A [Lynx](https://github.com/lynx-family/lynx) AutoLink NAPI addon that embeds
[Cactus Needle 2](https://github.com/cactus-compute/needle) - a 45M-parameter,
2-bit tool-calling model - into Lynx pages on Android and iOS. The whole
engine, weights included, is one roughly 14MB static library; inference needs
about 28MB RAM and no network.

```text
Lynx page JS -> AutoLink NAPI loader -> Needle addon -> libneedle.a
```

## Screenshots

Running on a real Android device with Lynx 4.3.0 nightly and no network:

| Welcome & capabilities | Tool-calling turn | Structured extraction |
| --- | --- | --- |
| ![welcome](packages/lynx-needle/docs/screenshots/demo-welcome.png) | ![tool call](packages/lynx-needle/docs/screenshots/demo-tool-call.png) | ![extraction](packages/lynx-needle/docs/screenshots/demo-extraction.png) |

## What the model does

Tool calling and structured extraction. You declare JSON-Schema tools, the
model returns structured calls (`{name, arguments}`) with a calibrated
confidence score. A byte-level grammar compiled from your schemas constrains
every output token. With more than 5 tools declared, a retrieval head renders
only the top-5 per turn. Context is a 256-token sliding window, with tools
pinned, so memory stays bounded regardless of conversation length.

## Repository layout

| Path | What it is |
| --- | --- |
| `packages/lynx-needle/` | Publishable local npm package |
| `packages/lynx-needle/src/` | Public TypeScript API: `loadNeedle()` / `createNeedle()` |
| `packages/lynx-needle/types/` | NAPI declaration consumed by `@lynx-js/autolink-codegen-canary` |
| `packages/lynx-needle/generated/` | Generated BTS facade that loads `Needle` through the Lynx NAPI module loader |
| `packages/lynx-needle/shared/nativeModule/` | Shared C++ NAPI implementation and generated registration code |
| `packages/lynx-needle/android/` | Source-built AutoLink Android library; produces `libNeedle.so` |
| `packages/lynx-needle/ios/` | AutoLink CocoaPods pod and `lynx-needle.xcframework` |
| `examples/android-host/` | Android Lynx host consuming the local package |
| `examples/ios-host/` | iOS Lynx host consuming the local package |
| `examples/lynx-needle-demo/` | ReactLynx BTS demo importing `loadNeedle()` from `lynx-needle` |

## Prerequisites

Use a Lynx 4.3 nightly built with NAPI binding. The Android example is
validated with `4.3.0-nightly.202609080610.178.gcd26ecb7-SNAPSHOT`, resolved
from the Maven Central snapshot repository:

```gradle
// settings.gradle
maven { url 'https://central.sonatype.com/repository/maven-snapshots/' }

// app/build.gradle
implementation 'org.lynxsdk.lynx:lynx:4.3.0-nightly.202609080610.178.gcd26ecb7-SNAPSHOT'
```

The iOS example is validated against
`4.3.0-nightly.202609090610.180.g5e30c9e6` from
`https://github.com/lynx-family/Specs.git`; that podspec downloads the published
zip from `artifacts-storage.tos-s3-ap-southeast-1.bytepluses.com`. On Android,
keep PrimJS on the version declared by that Lynx AAR
(`4.2.0-alpha.0-SNAPSHOT` at the time of this snapshot); forcing
`primjs:4.3.0-alpha.0-SNAPSHOT` with this Lynx build makes `lynx_core.js` fail
before the page loads.

Against a runtime without NAPI binding, the frontend API reports the addon as
unavailable (`loadNeedle()` returns `null`) by design.

The package pins these AutoLink canaries:

```text
@lynx-js/autolink-codegen-canary@0.6.0-canary-20260908-9352a903
create-lynx-library-canary@0.6.1-canary-20260908-9352a903
```

## AutoLink integration

Install `lynx-needle` in both the BTS package and the host package. The host
AutoLink plugin scans `lynx.lib.json`; application code does not register a
`LynxNodeAPI` module or attach a runtime listener manually.

### Android

Apply the Lynx library settings/build plugins from the same 4.3 nightly:

```gradle
// settings.gradle
plugins {
  id 'org.lynxsdk.lynx.library-settings' version '4.3.0-nightly.202609080610.178.gcd26ecb7-SNAPSHOT'
}

// app/build.gradle
plugins {
  id 'org.lynxsdk.lynx.library-build'
}
```

After normal Lynx initialization, run the generated global AutoLink setup:

```java
LynxEnv.inst().init(this, null, templateProvider, null);
LynxAutolinkGenerated.setupGlobal(this);
```

The generated registry loads `libNeedle.so` and registers addon name `Needle`.
No per-`LynxView` attach call is needed.

### iOS

```ruby
# Gemfile
source 'https://rubygems.org'

gem 'cocoapods', '1.14.3'
gem 'cocoapods-lynx-library', '4.3.0.pre.nightly.202609090610.180.g5e30c9e6'
```

```ruby
# Podfile
source 'https://github.com/lynx-family/Specs.git'
source 'https://cdn.cocoapods.org/'

install! 'cocoapods', :generate_multiple_pod_projects => true
plugin 'cocoapods-lynx-library'

target 'YourApp' do
  use_frameworks! :linkage => :static
  use_lynx_library!(:root => __dir__)
  pod 'Lynx', '4.3.0-nightly.202609090610.180.g5e30c9e6'
end
```

Install pods with `bundle install && bundle exec pod install` so the AutoLink
plugin is resolved from the `Gemfile`.

The CocoaPods plugin reads the npm dependency, adds the `lynx-needle` pod, and
generates `LynxGeneratedNodeAPIAddonUse.mm`. That registry includes
`addon_use.h`, initializes the PrimJS weak Node-API bridge, and invokes
`_napi_register_xx_Needle()`. Host Objective-C++ code does not include the
retention header directly.

## Frontend usage

```bash
npm install lynx-needle
# or, inside this repo:
# "lynx-needle": "file:../../packages/lynx-needle"
```

For the local `file:` form, build the package first (`npm run build` from the
repo root). The package `lib/` directory is generated by TypeScript and is not
committed.

```js
import { loadNeedle } from 'lynx-needle'

const needle = await loadNeedle()   // null when the host has no addon loader
if (!needle) { /* show setup instructions */ }

// 1. Declare tools and start a session.
needle.init('You control a smart home.', [
  {
    name: 'set_lights',
    description: "Turn a room's lights on or off and set brightness",
    parameters: {
      type: 'object',
      properties: {
        room: { type: 'string' },
        on: { type: 'boolean' },
        brightness: { type: 'integer', minimum: 0, maximum: 100 },
      },
      required: ['room', 'on'],
    },
  },
])

// 2. Agent loop: the model decides calls, your handlers execute them.
const result = await needle.run('dim the living room to 30', {
  set_lights: ({ room, on, brightness }) => ({ room, on, brightness, applied: true }),
})
// result.function_calls / result.results / result.confidence / result.peak_ram_mb

// 3. One-shot structured extraction.
const invoice = await needle.extract('Invoice from Acme Corp, $1,200.00, due 2026-09-01', {
  name: 'Invoice',
  parameters: {
    type: 'object',
    properties: { vendor: { type: 'string' }, total: { type: 'number' }, due_date: { type: 'string' } },
    required: ['vendor', 'total', 'due_date'],
  },
})
```

API summary:

- `loadNeedle(timeoutMs?) -> Promise<NeedleAgent | null>` asks the generated
  AutoLink facade for addon `Needle`; it returns `null` if the host has not
  installed the Lynx NAPI loader.
- `init(system, tools, toolIndexPath?)` restarts the session.
- `complete(input, maxNewTokens?) -> Promise<NeedleResponse>` runs raw
  inference off the JS thread.
- `run(query, handlers, {maxSteps, maxNewTokens}) -> Promise<NeedleRunResult>`
  runs the tool-calling agent loop.
- `extract(text, schema, {system, maxNewTokens})` performs one-shot extraction.
- `reset()` rewinds the conversation and keeps tools.
- `load(cactPath)` binds LoRA-tuned weights.
- `engineVersion()` returns the embedded engine version.

`response` envelope:

```json
{
  "type": "call",
  "function_calls": [{"name": "set_lights", "arguments": {"room": "living room", "on": true, "brightness": 30}}],
  "confidence": 0.92,
  "reasoning": "...",
  "prefill_tps": 668.2,
  "decode_tps": 161.6,
  "peak_ram_mb": 27.7
}
```

`type === "call"` with an empty `function_calls` means the model refused an
off-topic input; `"respond"` means the loop finished. There is no free-text
fallback by design.

## Run the demos

### Android: `examples/android-host` x `examples/lynx-needle-demo`

```bash
# 1. Repo root: build the package and Android AutoLink library
npm install && npm run fetch-engine && npm run build:android

# 2. Frontend demo dev server, which prints the bundle URL / QR
npm run build
cd examples/lynx-needle-demo && npm install && npm run dev

# 3. Host app, with JDK 17 + Android SDK
cd ../../examples/android-host
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
# Open "Needle Host" and scan the QR code from step 2.
```

The example already pins the 4.3.0 nightly snapshot with NAPI enabled, so the
full flow works out of the box. Against older release-repo Lynx versions, the
page renders but reports "addon not available".

### iOS: `examples/ios-host` x `examples/lynx-needle-demo`

```bash
# 1. Repo root: build the pod artifacts
npm run build:ios

# 2. Build once for the bundled template, or run the demo dev server
(cd examples/lynx-needle-demo && npm install && npm run build)

# 3. Host app
cd examples/ios-host
npm install
bundle install
bundle exec ruby generate-project.rb
bundle exec pod install
open NeedleHost.xcworkspace
```

The sample Podfile uses `cocoapods-lynx-library`, which generates the AutoLink
registry pod from `lynx.lib.json`. The Lynx pod comes from
`https://github.com/lynx-family/Specs.git`, not CocoaPods Trunk.

## Build the addon from source

Prerequisites: Node >= 22, CMake, Android/iOS toolchains, and `npm install`.
Engine binaries are pinned to Needle engine **2.0.3** and fetched from Hugging
Face:

```bash
npm run fetch-engine    # needle.h + libneedle.a for Android/iOS/macOS
```

Before publishing, run the package dry-run check:

```bash
npm run pack:needle
```

The package `prepack` hook rebuilds the TypeScript/codegen outputs and fails if
the required Needle engine archives or iOS xcframework artifacts are missing.

### Android

```bash
npm run build:android
# -> packages/lynx-needle/android/src/main/jniLibs/<abi>/{libNeedle,libnapi,libnapi_adapter}.so
```

`armeabi-v7a` builds compile `cpp/shim_hash_memory.cc` because the prebuilt
32-bit engine references `std::__ndk1::__hash_memory`, which modern NDKs no
longer export.

### iOS

```bash
npm run build:ios
# -> packages/lynx-needle/build/ios-{device,sim}/out/libNeedle.a
# -> packages/lynx-needle/ios/{lynx-needle.xcframework,lynx-needle.podspec,addon_use.h}
```

## How it works

- `packages/lynx-needle/types/napi-native-module.d.ts` is the AutoLink source
  declaration for the NAPI module.
- `packages/lynx-needle/src/needle.ts` is the public wrapper over generated
  `requireNeedle()`.
- `packages/lynx-needle/shared/nativeModule/Needle.cc` implements NAPI
  bindings over the engine's C ABI.
- `packages/lynx-needle/android/CMakeLists.txt` builds `libNeedle.so` from the
  shared C++ object target and links PrimJS NAPI libraries extracted by Gradle.
- `packages/lynx-needle/ios/CMakeLists.txt` builds device and simulator static
  addon slices; `scripts/package-darwin.mjs` packages the xcframework and
  podspec consumed by AutoLink.
- `packages/lynx-needle/tools/fetch-engine.sh` pins and downloads engine
  artifacts.

## Known limitations

- **Single global session.** Multiple agents share one conversation state.
- **256-token sliding window.** Long conversations drop old context; tools stay
  pinned.
- **Tuned weights are one-way.** After `load()`, the base model cannot be
  restored in-process, and `confidence` becomes uncalibrated.
- **No streaming.** The ABI returns the whole response at once.

## License

MIT. Engine binaries are distributed by Cactus Compute under the Needle
project's license; the NAPI scaffolding is from `@lynx-js/weak-node-api` and
Lynx AutoLink.
