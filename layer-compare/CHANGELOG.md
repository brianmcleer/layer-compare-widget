# Changelog

## 1.0.2 (2026-10-07)

### Changed

- First public release on GitHub (github.com/brianmcleer/layer-compare-widget). README install and feedback steps point to the release and issues page.
- Removed the fixed title from the panel. Help stays beside the introductory line, and the first-time hint appears immediately below it.
- Prepare both comparison sides concurrently, with up to four preparation jobs at a time.
- Keep existing copies when their selected layers are unchanged, including during a side swap.
- Avoid loading every hidden MapServer sublayer and table when preparing a comparison copy.
- Refresh retains the current selections and active divider. Empty collection events and repeated callbacks for the same map no longer reset comparison.
- Display selection totals directly from current checkbox choices, outside the shared generic count translation.

## 1.0.1 (2026-10-07)

### Changed

- Removed the Left / Right and Top / Bottom label boxes from the map.
- Removed the corresponding builder setting. Side names remain in the widget's layer list and the divider's accessible name.

## 1.0.0 (2026-10-07)

### Added

- Generic per-side layer choices with group and map-image sublayer support.
- Native Esri Swipe divider, Calcite slider, left/right and top/bottom modes.
- Swap, clear, center, reset, shared context, and original-visibility restoration.
- Builder controls for layer availability, default selections, labels, and Help.
- Shared theme, help presentation, first-run hint, and optional telemetry patterns.
- Behavior checks, development handoff, and a standardized publishing script.
- Clean install archive without editor shims, caches, dependency folders, or tests.
