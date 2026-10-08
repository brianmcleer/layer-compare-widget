# layer-compare-widget

[![License](https://img.shields.io/github/license/brianmcleer/layer-compare-widget)](LICENSE) [![Release](https://img.shields.io/github/v/release/brianmcleer/layer-compare-widget?display_name=tag)](https://github.com/brianmcleer/layer-compare-widget/releases) [![Issues](https://img.shields.io/github/issues/brianmcleer/layer-compare-widget)](https://github.com/brianmcleer/layer-compare-widget/issues)

Repository for the Layer Compare custom widget for ArcGIS Experience Builder Developer Edition 1.21 (React 19, Maps SDK 5.1).

Layer Compare puts a divider on the map and lets you pick which layers show on each side. Check layers under Left and Right (or Top and Bottom), select Start comparison, and drag the divider. Groups expand, map image services split into their sublayers, and the same service can show different sublayers on each side. Nothing is hard coded: the layer list comes from whatever map the widget is connected to. For the full feature list and install steps, see the widget README in the `layer-compare` subfolder.

Author: Brian McLeer, City of Grand Junction, CO.

## Repository layout

```
layer-compare-widget/             <- this repo
├── README.md                     <- this file (GitHub landing page)
├── LICENSE                       <- Apache-2.0
├── .gitignore                    <- ignores node_modules, .vs, dist, OS cruft
├── publish.ps1                   <- one-command publish/update script
└── layer-compare/                <- the widget (drops into your-extensions/widgets)
    ├── package.json
    ├── package-lock.json
    ├── pnpm-lock.yaml
    ├── manifest.json
    ├── config.json
    ├── icon.svg
    ├── README.md                 <- install steps, features, troubleshooting
    ├── CHANGELOG.md
    ├── LICENSE
    ├── .gitignore
    ├── .npmignore
    ├── docs/                     <- help guide text, validation notes, maintainer handover
    ├── tests/                    <- node --test suites (no Experience Builder runtime needed)
    └── src/ ...
```

The widget lives in the `layer-compare` subfolder so this repo can hold project level files without polluting the shareable widget. Only the `layer-compare` folder is dropped into an Experience Builder install.

## Install (for users)

See `layer-compare/README.md` for the full steps. In short: download `layer-compare.zip` from the latest release, place the `layer-compare` folder in `client\your-extensions\widgets\` so `manifest.json` is directly inside it (not `widgets\layer-compare\layer-compare\manifest.json`), run `pnpm install` from the `client` folder, then restart the client with `pnpm start`. The widget has no third-party dependencies.

### The release zip and the editor shims

The zip is the widget only. The Visual Studio type shims in the repo (`layer-compare/src/exb-editor-shims.d.ts`, `layer-compare/src/vendor-shims.d.ts`, `layer-compare/src/runtime/esri.d.ts`) and the `tests` folder are left out on purpose: the shims' ambient `declare module` blocks are not file-scoped and would rewrite the react, jimu and esri types for every other widget in your `your-extensions` folder.

If you clone the repository instead of using the zip, delete those three files before building; nothing else depends on them. Keep them if you want to run the developer checks (`node --test tests/*.test.cjs` and `npx tsc -p .` in the widget folder).

## Publishing updates (for the maintainer)

`publish.ps1` syncs the widget from the live Experience Builder folder into this repo's `layer-compare` subfolder (skipping `node_modules`, `.vs` and `Claude outputs`), commits, pushes to GitHub, and optionally cuts a release whose zip drops the editor shims and tests. Edit the variables at the top of the script if paths change.

- Code update only:
  ```
  powershell -ExecutionPolicy Bypass -File .\publish.ps1
  ```
- Code update plus a new downloadable version:
  ```
  powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Release v1.0.2
  ```

The release tag must match the version in `manifest.json` and `package.json` in the EB folder. Version tags must increase and never repeat. Bug fix: v1.0.3. New feature: v1.1.0. Major change: v2.0.0.

For the Esri Community post, upload the zip from the GitHub release (never a right-click zip of the repo folder, which would put the shims back).

## Esri Community

Discussion, questions and the attached download: link added after the post goes up.

## License

Apache-2.0. See the LICENSE file.
