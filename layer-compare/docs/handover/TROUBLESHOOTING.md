# Troubleshooting

| Symptom | Check and action |
| --- | --- |
| Widget missing or duplicated | Confirm one folder and `manifest.json` directly under `widgets/layer-compare`. Remove a nested/old copy. Rebuild only the matching compiled widget folder. |
| Blank settings or null-props exception | Restore the provided automatic Emotion JSX settings. Keep static SDK imports out of the settings bundle. |
| No layer list | Connect a Map widget, open its 2D map, check source availability, and refresh layers. |
| Sublayer not visible | Check ancestors, scale, definitions, and availability. Cached tile sublayers are indivisible. |
| Comparison fails | Verify service access/sign-in and the selected layer type. No original visibility change remains after a failed preparation. |
| Map stops panning | Inspect the native Swipe host pointer rules. Only the divider stripe/handle receives pointer events; the full-map host passes them through. |
| Divider remains after closing | Check controller-state handling, session disposal, emptied Swipe collections, UI removal, and owned-copy cleanup. |
| Layers appear late after stopping | Verify request-counter checks following every asynchronous load and host creation. |
| Source filter changed during comparison | Stop and start again so the copies use the latest source definitions and layer-view filters. |
| Another comparison owns the map | Stop the other Layer Compare widget before starting this one. |
| Other widgets show hundreds of type errors | Use the install ZIP; remove the editor-only ambient shims from a repository clone placed in a shared client. |
