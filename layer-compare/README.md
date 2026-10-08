# Layer Compare

Compare any supported operational layers in a connected 2D map. Choose layers for each side and move an Esri map divider to see the difference. There are no application-specific layer names, service URLs, or predefined comparison subjects.

## Features

- Integrated map layer list with independent checkboxes for each side. Choose one layer, several layers, or groups. The same layer can appear on both sides.
- Left / right and top / bottom comparison, a draggable native Esri divider, and a Calcite slider with keyboard controls.
- Expandable group layers and independent MapImageLayer sublayers, including two selections from the same map service.
- Swap sides, clear either side, center the divider, and reset to the configured defaults.
- Optional shared context: keep other previously visible layers on both sides.
- Builder controls for available layers, default selections, optional side names in the layer list, initial direction and position, and Help.
- Experience theme colors, a searchable help guide, a dismissible first-run hint, accessible input names, and a scrollable narrow-screen layer list.
- Both sides prepare together, and unchanged selections reuse their existing copies. Temporary copies retain supported layer display properties and compatible layer-view filters. Stop, reset, close, map changes, and failed preparation clean up the copies and restore original visibility.

## Requirements

ArcGIS Experience Builder Developer Edition **1.21**, a Map widget connected to a **2D map**, and access to the layers selected for comparison. This release targets Maps SDK 5.1 and the shared `arcgis-map-components` bundle supplied by Experience Builder. Earlier Experience Builder versions are not verified.

Experience Builder supplies React, Jimu UI, Calcite, and the Maps SDK. This widget declares no additional runtime dependencies.

## Install

1. Stop the Experience Builder client if it is running.
2. Download `layer-compare.zip` from the [latest release](https://github.com/brianmcleer/layer-compare-widget/releases/latest). Extract it and place its `layer-compare` folder in `client/your-extensions/widgets/`.
3. Confirm the manifest is at **`client/your-extensions/widgets/layer-compare/manifest.json`**. There must not be another `layer-compare` folder inside that folder.
4. In the **client** folder, run (Command Prompt, regular; in PowerShell use `pnpm.cmd` if script execution is blocked):

   ```
   pnpm install
   pnpm start
   ```

5. Add Layer Compare to an experience and choose its Map widget in the widget settings. Open that map in the builder if its layer list is still loading.
6. Optionally choose available layers and starting selections. Comparison stays off until a user selects **Start comparison**.

The install ZIP is the widget only. The Visual Studio type shims (`src/exb-editor-shims.d.ts`, `src/vendor-shims.d.ts`, `src/runtime/esri.d.ts`) and the `tests` folder are left out on purpose: the shims' ambient `declare module` blocks are not file-scoped and would rewrite the react, jimu and esri types for every other widget in your `your-extensions` folder. If you clone the [GitHub repository](https://github.com/brianmcleer/layer-compare-widget) instead of using the zip, delete those three files before building; nothing else depends on them.

## Use

Check the desired layers under each side, select **Start comparison**, then drag the map divider or use **Divider position**. Check both columns to display a layer on both sides. A side can be empty to compare a selection with the basemap and any shared layers. The basemap and map extent remain unchanged.

**Stop comparison** restores the map and keeps your choices ready for another comparison. **Reset** also restores the configured selections, direction, position, and shared-layer option. Changes to the choices while comparison is on rebuild only copies whose selection changed. Swap reuses existing copies; moving the slider does not reload the layers.

## Layer behavior

| Layer | Comparison behavior |
| --- | --- |
| Feature layer | Independently selectable; client-side source graphics are copied. |
| Group layer | Expand to choose children, or select all available descendants. Group copies use independent visibility. |
| Map image service | Expand to choose individual or nested sublayers. Separate service copies isolate each side's selection. |
| Cached tile or vector tile layer | Compare the whole layer; individual features baked into tiles cannot be separated. |
| Subtype group layer | Compare the whole subtype group. |
| Imagery, web tile, WMS, WMTS, GeoJSON, CSV, OGC feature | Included by the copy adapter; verify the specific source and display settings in your app. |
| 3D or unrecognized layer type | Disabled in the list. |

Available-layer choices apply to this widget. Web-map `listMode: hide` is respected. Scale ranges, definition expressions, supported renderers, labels, popup templates, and opacity are copied. Selections activate their copied branches even if the original layer was off. Unselected branches are excluded or hidden in the copies.

The default hides other operational layers during comparison. **Show other visible layers on both sides** keeps their original visibility. Within a compared service or group, its previously visible unselected leaves are included in both side copies. A previously hidden layer is not automatically enabled as shared context.

Use Layer Compare's checkboxes during an active comparison. Filter or style changes made by other widgets require stopping and restarting comparison. Adding, removing, or reordering source layers stops comparison and refreshes the list. Closing the panel removes only Layer Compare's own overlays. It does not clear view graphics, change the basemap, or write edits to source layers.

## Troubleshooting

**`layer-compare is duplicated`:** search for a nested `widgets/layer-compare/layer-compare` folder, a second copy or old renamed folder, and stale compiled output at `client/dist/widgets/layer-compare`. Keep one correctly placed source folder. To force a rebuild, stop the client and remove only the matching compiled widget folder. Do not delete the entire `client/dist` folder.

**Widget does not appear:** verify the manifest placement above and restart the client. **Blank settings panel:** confirm `tsconfig.json` retains `jsx: react-jsx` and `jsxImportSource: @emotion/react`. Settings import no static `esri/*` modules.

**Selected layer is missing:** check its scale range, filter, source availability, and sign-in. Cached tile sublayers are not independently selectable. Check Help for more guidance.

## Validation

See [docs/VALIDATION.md](docs/VALIDATION.md) for local checks and the Experience Builder installation checks still required. Unit checks use Node 24 and built-in type stripping:

```powershell
node --test tests/*.test.cjs
npx tsc -p .
```

Use the development source for these checks. Tests and editor shims are omitted from the install ZIP.

## Usage telemetry

The widget uses the same shared `beacon.ts` module as the other custom widgets. It discovers a destination in the app's own portal only when configured by that organization. No destination means no events are sent. Events contain fixed action names and scrubbed errors, not layer selections, attributes, addresses, coordinates, or user-entered side names. Turn off **Enable the shared usage telemetry** in settings, use browser Do Not Track, or set `window.__exbBeaconDisabled = true` to disable it. The builder is skipped.

## References and feedback

- [Esri Jimu UI guidance](https://developers.arcgis.com/experience-builder/api-reference/jimu-ui/)
- [Calcite Design System](https://developers.arcgis.com/calcite-design-system/)
- [Native Swipe component API](https://developers.arcgis.com/javascript/latest/references/map-components/components/arcgis-swipe/)
- [MapImageLayer API](https://developers.arcgis.com/javascript/latest/references/core/layers/MapImageLayer/)

Bugs and requests are welcome on [GitHub issues](https://github.com/brianmcleer/layer-compare-widget/issues) or on the Esri Community post. Include the widget version, the Experience Builder version, the layer type, the steps to reproduce, and the first error in the browser console.

Apache-2.0. Copyright City of Grand Junction, CO.
