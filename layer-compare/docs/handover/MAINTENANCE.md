# Maintenance

Run the tests and isolated type check from the development copy after changing layer masks, copying, or lifecycle code. Then exercise the actual EB client as listed in `docs/VALIDATION.md`.

Keep `jsx: react-jsx` and `jsxImportSource: @emotion/react`. Never import a runtime SDK service into settings. Shared pure catalog helpers are safe in both bundles.

For a new supported layer type, add it to the model's type list and the copy adapter's constructor/property allowlist. Verify a real instance in the target SDK. Layer cloning is not a universal method; MapImageLayer must be reconstructed with separately copied Sublayers. Copy Collection members individually before cloning Accessors.

For a new UI option, add the default and type, builder control, runtime behavior, translated text, and relevant help gating. Runtime side names and layer selections must stay generic.

Prepare both sides with fair, bounded concurrency. Reuse a copy only when its source object and effective leaf mask still match. Load the copied layer and its required group children; do not call MapImageLayer.loadAll just to display a comparison, because that loads hidden sublayers and tables too. Keep prepared copies in original drawing order even if their loading completes out of order.

Source collection listeners compare the actual original layer/sublayer order after filtering comparison overlays. CollectionFlattener can report original layers as moved when only a temporary copy was removed; that event must not stop comparison or clear counts. A manual refresh preserves current choices and the active divider. An actual source structure change still stops comparison for review.

Do not change copied theme/help/beacon files independently. Refresh them from the shared master or agreed reference. Keep editor-only ambient module declarations out of release ZIPs.

Bump manifest and package versions together in the EB source folder. Refresh lockfiles there with the normal client installer. Run the project-root `publish.ps1` only when ready to publish; it mirrors the EB source and can create a public GitHub repository. Inspect the staged ZIP for the single widget root, cache exclusions, and missing editor shims before sharing it.
