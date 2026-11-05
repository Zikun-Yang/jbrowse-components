# FeatureChartTrack demo fixture

A self-contained demo of `FeatureChartTrack` + the generic track info panel. It
is served by the dev server through `products/jbrowse-web/public/test_data` (→
this directory), so it can be opened without touching `config.json`:

```
pnpm --filter jbrowse-web start
# then open
http://localhost:3000/?config=test_data/feature-chart/config.json
```

(The port is `PORT` from the environment, `3000` by default.)

## What it proves

| Track                     | Drawer                    | What it demonstrates                                                                                  |
| ------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `fc_precomputed`          | _omitted_                 | the schema default (`precomputedBoxPlot`) is a real, registered drawer                                |
| `fc_raw_box`              | `rawBoxPlot`              | raw observations aggregated at render time; `colorScheme: set2`                                       |
| `fc_violin`               | `rawViolinPlot`           | same adapter/file as `fc_raw_box`, different mark; `colorScheme: viridis`                             |
| `fc_bar`                  | `barPlot`                 | `data.bars`                                                                                           |
| `fc_histogram`            | `histogram`               | `data.values`; `formatAbout.showInfo: false` hides the Track info card for this track                 |
| `fc_broken`               | `tissueBoxPlot`           | unknown drawer → readable placeholder + available names, no track error                               |
| `fc_plugin_heatmap`       | `samplePlugin/heatmap`    | plugin drawer from `plugins/sampleChartDrawers.js`; `drawerOptions` picks the ramp/gap                |
| `fc_plugin_dots`          | `samplePlugin/dotPlot`    | same plugin, second drawer; `drawerOptions` controls radius/jitter/opacity                            |
| `fc_missing_plugin`       | `notLoadedPlugin/heatmap` | placeholder says the _plugin_ is missing and names it                                                 |
| `fc_spec_box_plain`       | `spec`                    | the same chart as `fc_precomputed` described by a spec — the two tracks must be **pixel-identical**   |
| `fc_spec_box`             | `spec`                    | the same spec plus `axes.yLabel`, which is the only thing v1 adds to what the old painters could draw |
| `fc_spec_bar`             | `spec`                    | declarative bar (`category-values`) with the palette in `spec.style.colorScheme`                      |
| `fc_spec_hist`            | `spec`                    | declarative histogram with `spec.style.bins: 16` (the legacy drawer only ever used 10)                |
| `fc_spec_broken`          | `spec`                    | illegal `kind` × `data.form` → placeholder naming the path and the allowed forms                      |
| (site-wide `formatAbout`) | —                         | root `configuration.formatAbout.info` is the default text in every About dialog                       |
| (`fc_precomputed`)        | —                         | track-level `formatAbout.info` overrides the site-wide text and uses `{{track.*}}`                    |

## Chart specs

Five of the tracks use `renderer.drawer: "spec"` instead of a drawer name: the
chart is described in the config (`kind` + `data.form` + `data.path`), which is
the whole point of WP3 — no code in the config, so a spec can travel in a shared
session. The vocabulary, the examples and the error messages are documented in
[`plugins/feature-chart/SPEC.md`](../../plugins/feature-chart/SPEC.md) and
`website/docs/developer_guides/feature_chart_specs.md`.

`fc_spec_broken` is deliberately illegal: the track must stay alive, the chart
must show a placeholder that names `spec.data.form` and the allowed forms, and
the maximize dialog must list the problem.

## The example plugin

`plugins/sampleChartDrawers.js` is a dependency-free ES module loaded by
`config.json` through `plugins[0].esmLoc.uri`. It contributes two canvas drawers
with `Core-featureChartDrawer` and is the runnable version of
`website/docs/developer_guides/feature_chart_drawers.md`.

It also sets `globalThis.__sampleChartDrawers = { context, drawers }` in
`install()`. That is the cheapest way to prove a plugin installed in _both_
contexts: read it in the page console (main thread) and in the RPC worker.
`context` is `'main thread'` in one and `'worker'` in the other.

Edit the file and reload — no build step. If the browser or the worker keeps an
old copy, add a version (`plugins/sampleChartDrawers.js?v=2`) to the `esmLoc`
URI, or set `window.__jbrowseCacheBuster = true`.

## Data

Every file is the documented TSV contract (`chrom`, `start`, `end`, `name`,
`data` JSON, `description` markdown template), bgzip-compressed and tabix
indexed with `tabix -p bed`. Values are synthetic (deterministic seed), shaped
like expression data, with four tissues and six samples per tissue.

Regenerate the archives after editing a `.tsv`:

```bash
cd test_data/feature-chart
for f in precomputed-box raw-values bars histogram; do
  bgzip -c -f "$f.tsv" > "$f.tsv.gz" && tabix -p bed -f "$f.tsv.gz"
done
```

Two caveats this fixture surfaced:

- a TSV row must stay on one physical line, so markdown descriptions cannot
  contain real newlines. Keep a description on one line, or wait for the
  adapter-level `\n` unescaping tracked in MK-19/MK-21;
- the site-wide text lives at `configuration.formatAbout.info` in `config.json`,
  not at the top level — the root config nests `formatAbout` under
  `configuration` (a track's own `formatAbout` stays at the track's top level).
