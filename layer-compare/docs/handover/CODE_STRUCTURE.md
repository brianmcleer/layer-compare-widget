# Code structure

| File | Purpose |
| --- | --- |
| `src/config.ts`, `config.json` | Immutable builder configuration and defaults. |
| `src/runtime/widget.tsx` | Connected-map lifecycle, controls, selections, announcements, and help wiring. |
| `src/runtime/layer-model.ts` | Pure layer catalog, stable scoped keys, visibility masks, selection rules, and filtering. Reused by settings. |
| `src/runtime/layer-copy.ts` | SDK constructors and safe display-property copies. Groups copy only needed descendants; service sublayer ids stay unchanged. |
| `src/runtime/compare-session.ts` | Copy ownership and reuse, fair concurrent preparation, asynchronous cancellation, source visibility snapshots, and cleanup. |
| `src/runtime/swipe.ts` | Native `arcgis-swipe` bridge, collections, accessible divider name, pointer behavior, and teardown. |
| `src/runtime/components/LayerPicker.tsx` | Expandable map-layer list with side checkboxes and a builder Include mode. |
| `src/setting/setting.tsx` | Builder settings. No static SDK imports. |
| `src/runtime/theme.ts`, `components/HelpPopup.tsx`, `components/FirstRunHint.tsx` | Copied family presentation files; keep byte-identical to the supplied reference. |
| `src/shared/beacon.ts` | Copied shared telemetry module. Change the master and resync rather than editing a widget's copy. |

Layer keys include the map data-source scope plus ancestor ids and terminal layer/sublayer ids. Numeric sublayer id `0` is valid. Default and excluded keys therefore remain tied to the correct map instead of matching by display name.

| Config key | Default | Purpose |
| --- | --- | --- |
| `direction` | `horizontal` | SDK direction: horizontal means Left / right, vertical means Top / bottom. |
| `initialPosition` | `50` | Starting percent occupied by the first side. |
| `keepOtherLayers` | `false` | Initial shared-context behavior. |
| `allowContextToggle` | `true` | Show the runtime shared-context switch and its help line. |
| `showHelp` | `true` | Show the guide, button, and first-run hint. |
| `startLabel`, `endLabel` | Empty | Optional names in the layer list and accessible divider name; empty uses orientation-aware labels. |
| `defaultStartKeys`, `defaultEndKeys` | Empty arrays | Optional scoped starting layer choices. |
| `excludedLayerKeys` | Empty array | Scoped terminal keys excluded by the builder. |
| `telemetry` | `true` | Shared telemetry opt-out. |
