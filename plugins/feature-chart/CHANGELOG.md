# @jbrowse/plugin-feature-chart — fork changelog

This package is a **fork addition**: it does not exist in upstream
`GMOD/jbrowse-components`. Its `package.json` version tracks the upstream
release it is based on (4.2.1), so the entries below are ordered by work package
rather than by release, and describe changes to the plugin's **config surface**
— what a saved track config can contain and what it means.

`FORK.md` at the repository root records which files this plugin adds and how
likely each is to be accepted upstream.

## Configuration compatibility

| change                                                           | kind             | what happens to an existing config                                                                                                       |
| ---------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `renderer.drawer` default `tissueBoxPlot` → `precomputedBoxPlot` | breaking (fixed) | `tissueBoxPlot` was never registered, so an omitted `drawer` rendered an "unknown drawer" placeholder. It now draws `data.boxes`.        |
| `renderer.drawer: "spec"` + `renderer.spec`                      | new              | nothing to migrate; `spec` is ignored unless `drawer` is `"spec"`.                                                                       |
| `renderer.drawerOptions`                                         | new              | ignored by drawers that do not read it; unknown keys warn in dev builds.                                                                 |
| `renderer.renderCache`                                           | new              | default `true`; set `false` to force a repaint per render (only useful when debugging a drawer).                                         |
| `plotType` (Plotly renderer)                                     | deprecated       | still renders (one console warning). Wins only when `drawer` is left at its default **and** no chart model can be built for the payload. |
| `registerFeatureChartDrawer()`                                   | deprecated       | still works for in-repo code; plugins must use the `Core-featureChartDrawer` extension point or their drawer is invisible to the host.   |
| `dataShape` vocabulary (`tissues` → `grouped-values`, …)         | renamed          | an old name is treated as `any` with a development warning; the drawer keeps drawing.                                                    |

Migration guide: `website/docs/developer_guides/feature_chart_migration.md`.

## WP5 — public surface (agent SDK, docs, CI)

- `chartSpecSchema()` + `Core-featureChartSpecSchema` extension point: the v1
  spec vocabulary as a JSON-Schema-subset document, generated from the same
  constants `validateChartSpec` enforces. `SPEC.md` §11 is checked against it by
  a test, so the printed schema and the runtime document cannot drift.
- `listFeatureChartDrawerCatalog()` + `Core-featureChartDrawerCatalog` extension
  point: the drawer catalog as plain data with a `builtin` flag (`false` when a
  plugin contributed or shadowed the implementation). This is what
  `jbrowse.chartDrawers()` / `chartDrawer(name)` read in `@jbrowse/agent-sdk`.
- `installFeatureChartAgentSurface(pluginManager)` registers both extension
  points from `FeatureChartPlugin.install()` — i.e. in web, desktop and
  react-app, and in their RPC workers.
- Docs: `website/docs/config_guides/chart_spec.md` (table reference),
  `website/docs/user_guides/track_info.md` (track descriptions),
  `website/docs/developer_guides/feature_chart_migration.md` (plotType → kind,
  drawer default, extension point, `dataShape` renames), plus the agent section
  in `feature_chart_drawers.md`.
- `SPEC.md` §11: palette and data-form enum order aligned with the generator,
  and a note that the `path` pattern / `yLabel` maxLength are stricter than the
  runtime validator on purpose.

## WP4 — one model, two backends, export, render cache

- `ChartModel` is the single chart description; the five built-ins are "payload
  → model adapter + shared painter", and the Plotly renderer consumes the same
  models, so the track, the maximize dialog and the interactive view agree.
- `plotType` demoted to a deprecated alias for `spec.kind` (see the
  compatibility table above).
- `renderCache` slot: painted charts are reused between re-renders, keyed on
  data, size, device pixel ratio, theme/palette and `drawer` + `drawerOptions`.
- SVG/PNG export from the maximize dialog (`Export PNG` / `Export SVG`): the
  interactive view exports real vector SVG through Plotly, the canvas view
  exports PNG (SVG is that raster wrapped in `<image>`, which the UI says out
  loud).

## WP3 — declarative chart specs

- `renderer.spec` (v1 vocabulary, frozen): `kind` × `data.form` × `data.path`,
  optional `axes.yLabel`, `style.colorScheme`, `style.bins`.
- `validateChartSpec()` reports `path` + `allowed` + `actualKeys`; an invalid
  spec draws a placeholder and never fails the track.
- `SPEC.md` is the normative contract;
  `website/docs/developer_guides/feature_chart_specs.md` is the narrative
  version.

## WP2 — plugin-contributed drawers

- `Core-featureChartDrawer` extension point; catalog scoped per `PluginManager`
  (so the RPC worker sees the same drawers as the main thread).
- `drawerOptions` passed to drawers as `DrawerProps.options`, documented via the
  drawer's `optionsSchema` (a hint, not a validation contract).
- Failure semantics: unknown drawer / missing plugin / typo'd name each render a
  readable placeholder naming the problem and the available drawers.

## WP1 — track and plugin wiring

- `FeatureChartTrack` is a first-class track type in all three products
  (`corePlugins`), so it appears in the track selector and the Add track
  workflow.
- Generic track info (`formatAbout.info`) renders in the About dialog, with
  `showInfo`/`hideUris`/root-default inheritance. The same resolver is published
  to the agent SDK (see WP5).
