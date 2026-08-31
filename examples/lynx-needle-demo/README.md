# lynx-needle-demo

A complete ReactLynx app demonstrating the `needle` NAPI addon: on-device
tool calling and structured extraction, running entirely on the phone.

## What it shows

- **Tool calling loop** — 6 smart-home tools declared (lights, weather, music,
  thermostat, reminders, messages). Six tools also exercises the engine's
  retrieval head (only the top-5 are rendered per turn). Decided calls are
  executed by JS handlers and results fed back automatically.
- **Refusal** — the preset "tell me a joke" is off-topic; the model returns an
  empty `function_calls` refusal instead of hallucinating.
- **Confidence gating** — every turn shows the calibrated confidence badge.
- **Structured extraction** — the "extract: invoice" chip parses invoice text
  into a typed object.
- **Perf stats** — prefill/decode tokens-per-second and peak RAM per turn.

## Run it

```bash
npm run build        # one-time, at the repo ROOT: generates lib/ (tsc)
npm install          # also links the local "lynx-needle" npm package (file:../..)
npm run dev          # serves main.lynx.bundle, prints a QR code
```

Then open the printed URL in a host app with the NAPI addon loader integrated
— use `examples/android-host` or `examples/ios-host`. Note: the published
Lynx SDK binaries do NOT include NAPI binding (see the repo-root README), so
stock LynxExplorer will show the "addon not available" screen.

```
http://<your-ip>:3000/main.lynx.bundle
```

## How it uses the npm package

- `loadNeedle()` (from `lynx-needle`) asks the host's `LynxNodeAPI` module to
  load the addon and polls `globalThis.__lynx_node_addon_exports__` until the
  exports appear (the bridge call is async fire-and-forget; `NativeModules` is
  a bundle-scope identifier injected by Lynx, not a real global). Returns
  `null` when the host can't load addons — the app then shows a setup screen.
- The returned agent exposes `init / complete / reset / load / engineVersion`
  plus the `run` agent loop and one-shot `extract`.

## Layout

- `src/tools.ts` — demo tool schemas, simulated handlers, preset queries
- `src/App.tsx` — chat-style UI with confidence badges and perf stats
