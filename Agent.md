# needle (AI Guide)

## What this project is

This repository is a CMake-based N-API addon project scaffolded by `@lynx-js/weak-node-api`.
The scaffold keeps one cross-platform CMakeLists.txt with branches for Android, iOS, HarmonyOS, and macOS. Configure a separate build directory with the appropriate CMake toolchain/generator for the platform you want to build.

## Quick start

```bash
npm install
cmake -S . -B build
cmake --build build --config Release
```

The generic command above builds the current host platform. On macOS it produces the macOS static library only; use README.md for Android/iOS/HarmonyOS cross-compilation commands.

## Output naming

- Android: `android/src/main/jniLibs/<abi>/lib<project>.so` (+ `libnapi_adapter.so`) — written directly into the AAR module, no sync step
- HarmonyOS: `build/<build-dir>/out/lib<project>.so`
- iOS: `build/ios-device/out/lib<project>.a` or `build/ios-sim/out/lib<project>.a`
- macOS: `build/macos/out/lib<project>.a`
- Darwin packaging: `ios/<project>.xcframework`, `ios/<project>.podspec`, and `ios/include/addon_use.h` after `npm run package:darwin`

## Repository layout

- `src/` — npm package source (TypeScript): `loadNeedle()` + `createNeedle()`, built with `npm run build` into `lib/`
- `cpp/` — native addon: N-API bindings over the needle engine C ABI
- `android/` — Android library module (AAR): bridge module + native loader + jniLibs
- `ios/` — iOS pod: xcframework + vendored loader module
- `cpp/` — native addon + platform-independent addon loader (`LynxNodeAPI.{h,cc}`)
- `examples/` — `android-host`, `ios-host`, `lynx-needle-demo` (frontend)

## Editing addon code

- Implement your N-API logic in `cpp/addon.cc`; keep the generated unified registration block (`LYNX_NAPI_AUTO_REGISTER_MODULE` plus the exported Node-API C entry points) and `cpp/addon_use.h` intact.
- If you enable `USE_WEAK_SUFFIX_NAPI`, follow the per-translation-unit include convention:
  - include `weak_napi_defines.h` after the last include
  - include `weak_napi_undefs.h` at the end of the file

## Platform linking strategy

- Android: the build downloads the AAR and extracts `vendor/android/libnapi_adapter.so`, then links it.
- HarmonyOS: the build downloads the HAR and extracts `vendor/harmony/libnapi_adapter.so`, then links it.
- Windows: coming soon.
- iOS/macOS: Darwin platforms emit static libraries plus a generated `addon_use.h` header. The registration code is shared across platforms: it auto-registers when loaded and also exports the standard dynamic Node-API C entry points. The host app must include `addon_use.h` from exactly one `.cc`/`.mm` translation unit to retain the addon's auto-registration symbol before `requireNodeAddon`.

## Darwin packaging

- Build the required Darwin static library slices first, then run `npm run package:darwin`.
- The packaging script creates a local-consumable podspec that points to the generated static-library xcframework via `:path => "."` and copies `addon_use.h` into `ios/include`.
- For remote publishing, replace the generated podspec source stanza with your hosted zip URL and checksum.

## Toolchains (cross compilation)

Cross-compilation is controlled by the CMake toolchain/generator you choose when configuring the build directory.
See README.md for command examples.
