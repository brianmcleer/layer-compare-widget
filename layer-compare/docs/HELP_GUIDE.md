# Layer Compare guide

Choose any supported map layers for each side, select **Start comparison**, then move the divider on the map or the **Divider position** slider. The first side is Left in left/right mode and Top in top/bottom mode.

- Use the arrow beside a group or map service to choose its children.
- Check a group to choose all its available children. A partial check means some children are selected.
- Check both side boxes for a layer to display it on both sides.
- **Swap sides** exchanges the choices. **Clear Left**, **Clear Right**, **Clear Top**, or **Clear Bottom** empties that side.
- **Center divider** moves the divider to 50%.
- **Show other visible layers on both sides** keeps the map's previously visible unselected layers as shared context.
- **Stop comparison** restores the original map and keeps the side choices.
- **Reset** also restores the builder's default selections and divider options.

Filtering the layer list does not change selected layers. A scale note means a layer may need a different zoom level. Map image sublayers can be independent; cached tiled layers are compared as a whole.

The question-mark button opens the searchable in-widget guide. The presentation is copied from the supplied Basemap Gallery example. Its content lives in `src/runtime/helpSections.ts` and `src/runtime/translations/default.ts`.
