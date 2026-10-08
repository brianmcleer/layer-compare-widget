# Validation

Release candidate: **1.0.2**, checked on **7 October 2026**. Target: Experience Builder Developer Edition **1.21**, Maps SDK **5.1**, and a 2D Map widget.

## Completed checks

- **26 automated tests passed**, with no failed or skipped checks. They exercise hierarchical layer keys, hidden and excluded layers, partial group selections, scale-independent selection masks, cached-layer boundaries, independent MapServer sublayers, shared context, safe deep copies, group pruning, layer-view filters, failed loads, concurrent updates, close cleanup, competing widget ownership, fair concurrent preparation, reuse of unchanged copies, side swaps, and avoiding unnecessary MapServer resource loads.
- **TypeScript 5.6.3 isolated type check passed** using the copied editor master and widget-specific editor declarations. This checks local source consistency; it does not replace compilation against Experience Builder's real Jimu definitions.
- **Real Maps SDK 5.1 browser checks passed** in headless Chromium with an actual MapView, client-side FeatureLayers, GroupLayers, MapImageLayers, native `arcgis-swipe`, and Calcite Slider/Icon components. Jimu UI and the Experience Builder Map widget connection were supplied by small test adapters because the full Experience Builder client was unavailable.
- Feature layers from a group rendered on opposite sides of the native divider. Two sublayers from one locally served MapServer rendered independently on opposite sides. Original SDK sublayer objects and visibility remained unchanged.
- Slider input and orientation changes updated the native divider without rebuilding layer copies. Panning away from the handle worked. Stop and widget close removed comparison overlays and the divider and restored original visibility.
- Clearing and changing the right selection kept the existing left SDK layer objects. Swap reused both sides' objects. Selected-layer totals updated immediately, and manual refresh preserved both counts and the native divider.
- The panel starts with the introductory guide line and Help control, with the first-time hint directly below it. The fixed panel title and on-map side label boxes are removed.
- Panels at **390, 320, and 260 pixels** had no horizontal overflow. Desktop and narrow layouts were visually inspected.
- The install archive was checked for one widget root with `manifest.json` directly inside it, matching manifest/package versions, and no dependencies, caches, test harnesses, or editor ambient shims.
- Theme helpers, shared Help/Hint components, the editor master, and the shared telemetry module retain the supplied example's source unchanged. Settings have no static `esri/*` imports.

The browser fixture used local geometries and a local mock map service, not production utility data. It reported no uncaught page errors. Two missing fixture font assets used browser font fallback.

## Dependency and lockfile provenance

The widget has **no extra runtime dependencies**. React, Jimu UI, Emotion, Calcite, and `arcgis-map-components` are provided by Experience Builder. Temporary browser-test packages were installed outside the project and are not distributed.

The empty npm and pnpm lockfiles were generated in the build workspace. They contain no third-party packages. The supplied handoff calls for lockfiles generated in the real EB environment; that environment was not available here. Regenerate them there if dependencies are added or before the first published release. Their presence is not evidence of an EB client build.

## Checks still required in the real Experience Builder client

1. Install the clean `layer-compare` folder in `client/your-extensions/widgets/`, run `pnpm install` from `client`, and confirm a successful client build. Editor shims must stay outside the shared client build.
2. Add Layer Compare, select its Map widget, save/reopen the experience, and verify the available-layer exclusions and default selections survive.
3. Test the runtime with your actual services, authentication, renderers, scale ranges, and active layer-view filters. Imagery, WMS, WMTS, vector tiles, GeoJSON, CSV, and OGC feature sources are supported by the copy adapter but were not individually exercised in this fixture.
4. Check light/dark experience themes, the Help button and guide, first-run hint dismissal, keyboard focus, and the slider's keyboard controls using real Jimu components.
5. Test Map widget active-map changes, widget-controller close/reopen, a failed service, and other widgets that change the map. Stop and restart Layer Compare after other widgets change filters or styling.
6. Test two Layer Compare widgets on one map. Only one may own its comparison at a time; the second should show the explanatory message.

No GitHub publishing, deployment, or production service changes were performed.

## Reproduce the dependency-free checks

Use the development archive and Node 24. In `layer-compare/`:

```powershell
node --test tests/*.test.cjs
npx tsc -p .
```

The Node runner may report that it reparsed TypeScript imports as ES modules. That warning does not affect the test results. Tests and editor shims are deliberately excluded from the install archive.
