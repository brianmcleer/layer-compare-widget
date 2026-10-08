# State and cleanup

Builder choices live in the Experience Builder widget configuration. Runtime choices, divider position, and visibility snapshots are held in memory and are discarded when the app unloads.

The only widget-specific browser storage is the first-run hint dismissal: `layerCompare.helpHintDismissed.<widgetId>`. A blocked browser storage API does not prevent comparison or Help from working.

Source layers are never reparented or destroyed. During comparison only their top-level visibility is changed; source sublayer visibility, group visibility mode, data, filters, and the basemap are not changed. The comparison owns copies whose ids begin with `layer-compare__<widgetId>__`. Copies use `listMode: hide` and disable persistence where supported.

Stop, reset, closing, unmounting, map changes, and failed preparation remove the owned copies and the divider, then restore source visibility. A request counter discards slow work completed after a newer selection or a close. One comparison session can own a map at a time.

There is no portal item storage or data editing. The copied shared telemetry module can send fixed actions to an organization-configured destination; it has its own session cache and off switches, described in the widget README.
