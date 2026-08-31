# Needle Host (iOS example)

Minimal Lynx host app showing how to integrate `ios/` and load the
frontend demo bundle (`examples/lynx-needle-demo`).

## Build & run

```bash
# at the repo root — one-time or after addon changes
npm run build:ios && npm run package:darwin   # -> ios/ artifacts

# here
ruby generate-project.rb      # one-time; uses the xcodeproj gem (bundled with CocoaPods)
pod install
open NeedleHost.xcworkspace   # build & run on a device or simulator
```

Enter the demo bundle URL (`http://<your-ip>:3000/main.lynx.bundle` from
`npm run dev` in `examples/lynx-needle-demo`) and tap GO.

## How it works

- `AppDelegate.mm` — installs the PrimJS↔LynxWeakNodeAPI bridge once at
  startup and `#include "addon_use.h"` so the addon's static registration
  survives linking
- `ViewController.mm` — per page: creates a `LynxBackgroundRuntime`, attaches
  `LynxNodeAPILifecycleListener(token:)`, registers `LynxNodeAPIModule` with
  the same token, then builds the `LynxView` with
  `builder.lynxBackgroundRuntime = runtime` and loads the fetched template
- The pod (`ios/`) provides the xcframework, the loader module, and the
  lifecycle listener

## Notes

- The Podfile includes a `post_install` workaround for a real upstream
  packaging flaw: the published PrimJS and LynxWeakNodeAPI pods both ship
  public `js_native_api*.h`/`napi.h` headers, and Xcode's flattened header
  maps resolve PrimJS's own quoted includes to the wrong copy. The hook
  drops forwarding headers into PrimJS's source subdirectories.
- **Build status: blocked upstream.** With the headers fixed, compilation
  reaches the `Lynx` pod itself, whose NAPI sources
  (`core/value_wrapper/napi/value_impl_napi_primjs.*`) reference
  `third_party/napi/include/*` headers that the published Lynx pod does not
  package (they exist only in the lynx source tree). So a working iOS NAPI
  build requires building Lynx from source (as LynxExplorer does). Verified
  with Lynx pods 3.9.0 and 4.0.0.
- `generate-project.rb` only creates the Xcode project once; delete
  `NeedleHost.xcodeproj` to regenerate.
