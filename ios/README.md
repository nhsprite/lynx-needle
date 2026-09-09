# lynx-needle iOS SDK

CocoaPods pod that gives a Lynx host app everything needed to load the
`Needle` NAPI addon through Lynx AutoLink:

- `lynx-needle.xcframework` — the addon with the engine statically merged in
  (device + simulator slices; produced by `npm run package:darwin`)
- `addon_use.h` — generated `NAPI_USE(Needle)` retention helper consumed by
  the generated AutoLink registry pod
- `generated/NeedleNapiWrapper.cc` — generated CocoaPods compile entry that
  includes the shared implementation and registration source

## Prerequisites

- Host app integrates `pod 'Lynx',
  '4.3.0-nightly.202609090610.180.g5e30c9e6'` from
  `https://github.com/lynx-family/Specs.git`.
- Host Podfile applies `cocoapods-lynx-library` and calls `use_lynx_library!`
  so the plugin can scan the npm dependency's `lynx.lib.json`.
- Repo root: `npm run build:ios && npm run package:darwin`.

## Usage

```ruby
# Podfile
source 'https://github.com/lynx-family/Specs.git'
source 'https://cdn.cocoapods.org/'

install! 'cocoapods', :generate_multiple_pod_projects => true
plugin 'cocoapods-lynx-library'

target 'NeedleHost' do
  use_frameworks! :linkage => :static
  use_lynx_library!(:root => __dir__)
  pod 'Lynx', '4.3.0-nightly.202609090610.180.g5e30c9e6'
end
```

The plugin generates `LynxGeneratedNodeAPIAddonUse.mm`, adds the
`LynxWeakNodeAPI/primjs_bridge` and `PrimJS/napi/adapter` dependencies, includes
`<lynx-needle/addon_use.h>`, and calls `_napi_register_xx_Needle()` before the
Lynx runtime uses the addon. Host Objective-C++ code should create normal
`LynxView` instances; the old `LynxNodeAPI` module/listener is no longer part of
the integration path.

See `examples/ios-host/` for a complete app.
