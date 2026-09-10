# lynx-needle workspace

This repository contains the publishable `lynx-needle` Lynx AutoLink NAPI
package plus Android, iOS, and Lynx demo hosts.

## Layout

| Path | What it is |
| --- | --- |
| `packages/lynx-needle/` | The local npm package intended for future publishing |
| `examples/android-host/` | Android host that consumes `lynx-needle` through `file:../../packages/lynx-needle` |
| `examples/ios-host/` | iOS host that consumes `lynx-needle` through `file:../../packages/lynx-needle` |
| `examples/lynx-needle-demo/` | ReactLynx BTS demo importing `loadNeedle()` from `lynx-needle` |

## Common Commands

```bash
npm install
npm run fetch-engine
npm run build
npm run build:android
npm run build:ios
```

The root scripts delegate to `packages/lynx-needle`. Run package-specific npm
publish checks from that package when needed:

```bash
cd packages/lynx-needle
npm pack --dry-run --json --silent
```

See `packages/lynx-needle/README.md` for integration details.
