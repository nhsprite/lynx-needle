# lynx-needle iOS SDK

CocoaPods pod that gives a Lynx host app everything needed to load the
`needle` NAPI addon:

- `needle.xcframework` — the addon with the engine statically merged in
  (device + simulator slices; produced by `npm run package:darwin`)
- `include/addon_use.h` — `NAPI_USE(needle)` retention helper; `#include` it
  from exactly one host `.mm`/`.cc` translation unit so the static
  registration symbol survives dead-stripping
- `Loader/` — the page-facing `LynxNodeAPI` module + runtime-lifecycle
  listener (vendored from `lynx-family/lynx` `explorer/darwin/ios`, develop
  branch) and the platform-independent loader (`LynxNodeAPI.{h,cc}`, synced
  from `cpp/` by `npm run package:darwin` — edit there, not here)

## Prerequisites

- Host app integrates the Lynx runtime (`pod 'Lynx'`) and
  `pod 'LynxWeakNodeAPI', :subspecs => ['core', 'primjs_bridge']`.
- **NAPI requires a Lynx runtime with `enable_napi_binding`** — see the
  repo-root README. As shipped by the published pods, the addon loader hooks
  exist but the runtime must also deliver `onRuntimeAttach`.
- Repo root: `npm run build:ios && npm run package:darwin`.

## Usage

```ruby
# Podfile
pod 'LynxWeakNodeAPI', :subspecs => ['core', 'primjs_bridge']
pod 'needle', :path => '<repo>/ios'
```

```objc
// AppDelegate.mm
#include "addon_use.h"
// + install the PrimJS<->LynxWeakNodeAPI bridge once at startup
//   (see examples/ios-host/NeedleHost/AppDelegate.mm)

// Per LynxView (one background runtime; module + listener share a token):
self.moduleToken = [NSObject new];
self.runtime = [[LynxBackgroundRuntime alloc] initWithOptions:options];
[self.runtime addRuntimeLifecycleListener:
    [[LynxNodeAPILifecycleListener alloc] initWithToken:self.moduleToken]];
[self.runtime registerModule:[LynxNodeAPIModule class] param:self.moduleToken];
// then: builder.lynxBackgroundRuntime = self.runtime;
```

See `examples/ios-host/` for a complete app.
