# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

JBrowse 2 is a modular genome browser built with React, TypeScript, and
mobx-state-tree. It is a pnpm monorepo producing a web app, desktop app
(Electron), CLI tools, and embeddable React components. All visualization is
client-side (static-site compatible).

## Monorepo Structure

- `packages/` — Core libraries (`@jbrowse/core`, `@jbrowse/app-core`,
  `@jbrowse/product-core`, `@jbrowse/web-core`, etc.)
- `plugins/` — Feature plugins (e.g. `plugin-alignments`,
  `plugin-linear-genome-view`, `plugin-wiggle`). This is where most feature
  development happens.
- `products/` — End-user applications (`jbrowse-web`, `jbrowse-desktop`,
  `jbrowse-cli`, `jbrowse-react-linear-genome-view`, etc.)
- `website/` — Docusaurus documentation site
- `webpack/` — Shared webpack configuration used by web products
- `docs/` — Scripts that auto-generate documentation from code comments

## Common Commands

All commands run from the repository root unless noted.

### Install

```bash
pnpm install
```

### Development Servers

```bash
# Web app
cd products/jbrowse-web && pnpm start

# Desktop app
cd products/jbrowse-desktop && pnpm start    # webpack dev server
# In another terminal:
cd products/jbrowse-desktop && pnpm electron

# Storybook (linear genome view)
cd products/jbrowse-react-linear-genome-view && pnpm storybook

# Documentation site
cd website && pnpm install && pnpm start
```

### Build

```bash
pnpm build            # Build all packages, plugins, and products
```

### Test

```bash
pnpm test             # Run all jest tests
pnpm test-ci          # CI version with increased memory limit
```

Run tests for a single workspace:

```bash
cd packages/core && pnpm test
cd plugins/alignments && pnpm test
```

Under the hood these run `jest --passWithNoTests <path>` from the repo root.

Jest is configured with three projects in `jest.config.js`:

- `integration` — root-level Node tests
- `jbrowse-img` — Node environment, no fetch mock
- `default` — jsdom environment with `jest-fetch-mock`, covers all other
  packages/products/plugins

### Lint, Typecheck, Format

```bash
pnpm lint             # ESLint. Add --fix to auto-fix.
pnpm typecheck        # tsc --noEmit across the repo
pnpm format           # Prettier --write .
pnpm check-format     # Prettier --check .
```

### Documentation Generation

```bash
pnpm autogen          # Regenerate config docs and state model docs from code comments, then format
```

## High-Level Architecture

### Plugin System

Everything is a plugin. Plugins register **pluggable element types** with the
`PluginManager`:

| Element Type            | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `ViewType`              | Top-level visualization (e.g. LinearGenomeView, CircularView) |
| `TrackType`             | Data track                                                    |
| `DisplayType`           | How a track renders within a view                             |
| `RendererType`          | Low-level rendering logic (canvas, SVG, etc.)                 |
| `AdapterType`           | Data adapter that reads file formats (BAM, CRAM, VCF, etc.)   |
| `WidgetType`            | Popup/detail panel widget                                     |
| `RpcMethodType`         | RPC method for web worker calls                               |
| `ConnectionType`        | External data source connection                               |
| `InternetAccountType`   | OAuth/authentication provider                                 |
| `TextSearchAdapterType` | Text search backend                                           |
| `AddTrackWorkflowType`  | Custom "add track" UI flow                                    |

Plugins subclass `Plugin` (`packages/core/src/Plugin.ts`) and implement:

- `install(pluginManager)` — register pluggable elements
- `configure(pluginManager)` — add menu items, finalize setup

Example: `plugins/linear-genome-view/src/index.ts`

### State Management: mobx-state-tree

JBrowse uses `@jbrowse/mobx-state-tree` (a fork of MST). State is organized as a
tree:
- **Root model** — `products/jbrowse-web/src/rootModel/rootModel.ts` (or
  equivalent per product)
- **Session model** — created by the root model, holds views, tracks, selection
- **View models** — e.g. `LinearGenomeView` state model
- **Track/Display models** — MST models composed into views

Use `getSession(model)` and `getRoot(model)` from `@jbrowse/core/util` to
traverse the tree.

### App Shell (app-core)

The web/desktop app UI lives in `packages/app-core/src/ui/App/` and is shared
by `jbrowse-web` and `jbrowse-desktop` (both render `<App session={...}/>`).

- **Routed views**: the shell switches on `session.activeView`
  (`'landing' | 'workspace' | 'recents' | 'settings'`, defined in
  `packages/web-core/src/BaseWebSession`). In jbrowse-web, `activeView` is
  two-way synced with react-router paths (`/`, `/workspace`, `/recents`,
  `/settings`) in `products/jbrowse-web/src/components/JBrowse.tsx`.
- **Left sidebar** (`LeftSidebar.tsx`) is navigation-only: Home / Recents /
  Workspace / Settings, plus conditional Bookmarks and Help entries that open
  widgets (shown only when the corresponding widget type is registered).
- **Workspace panels** are tiled with dockview (`useDockview` via
  `DockviewContext.tsx`); `WorkspaceToolbar.tsx` holds Add-view / Undo / Redo /
  Layout controls.
- **Product injection points**: `<App>` accepts optional `HeaderButtons`
  (rendered top-right, e.g. Share/Import/Export in jbrowse-web) and
  `SettingsCards` (rendered as a "Manage" section on the Settings page) so
  products can add UI without app-core depending on product code.
- **Legacy menus**: `rootModel.menus()` (File/Add/Tools/Help) and the
  `appendToMenu`/`insertInMenu` extension points in
  `packages/app-core/src/menus.ts` still exist for backward compatibility, but
  the app shell no longer renders them. Prefer the sidebar, WorkspaceToolbar,
  or Settings cards for new entries.
- **View icons**: `ViewType` accepts an optional `icon` component (see
  `packages/core/src/pluggableElementTypes/ViewType.ts`), shown in the
  Add-view dropdown. Icons are lucide-react based, exported from
  `@jbrowse/core/ui/Icons`.

### Configuration System

Configuration is declared with `ConfigurationSchema`
(`packages/core/src/configuration/configurationSchema.ts`). Schemas define typed
config slots (string, number, stringArray, frozen, etc.) that users can edit via
the UI. Config values are accessed with `readConfObject(config, 'slotName')`.

Plugins can expose:

- `configurationSchema` — namespaced under `configuration.YourPluginName`
- `configurationSchemaUnnamespaced` — under `configuration`
- `rootConfigurationSchema` — spread into root config

### RPC / Web Workers

Data fetching and rendering can run in web workers via the RPC system
(`packages/core/src/rpc/`). The `RpcManager` registers drivers
(`WebWorkerRpcDriver`, `MainThreadRpcDriver`). Renderers and adapters often have
`freeTipSlots` or RPC methods that execute in workers. `makeWorkerInstance.ts`
in each product configures the worker bundle.

### Re-Exports for Runtime Plugins

Plugins loaded at runtime (UMD/ESM) cannot bundle their own copy of React, MST,
or MUI. The `ReExports` system (`packages/core/src/ReExports/`) maps external
library names to the host app's instances so runtime plugins share the same
dependency objects.

### Data Adapters

Adapters subclass `BaseFeatureDataAdapter` or `BaseSequenceAdapter`
(`packages/core/src/data_adapters/BaseAdapter/`). They implement:

- `getFeatures(region, opts)` — returns an Observable of features
- `getRefNames()` — sequence/reference names
- `getStats(region)` — feature density statistics

Adapters are instantiated with a configuration model and optionally a
`getSubAdapter` callback for nested adapters.

### Rendering Pipeline

1. **Track** holds display references
2. **Display** (e.g. `LinearPileupDisplay`) manages the view-model state for
   rendering
3. **Renderer** (e.g. `PileupRenderer`) executes in main thread or worker to
   produce render output (SVG, canvas commands, React)

### TypeScript Conventions

- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `noUncheckedIndexedAccess: true` — array/object index access may be undefined
- `allowImportingTsExtensions: true` and `rewriteRelativeImportExtensions: true`
  — imports use `.ts`/`.tsx` extensions
- `moduleResolution: bundler`
- JSX: `react-jsx`

Packages build ESM output with `tsc -p tsconfig.build.esm.json` (excluded from
root tsconfig).

### Testing Patterns

- Unit tests are co-located with source as `*.test.ts` / `*.test.tsx`
- Image snapshot tests exist in `products/jbrowse-web/src/tests/`
- Browser tests: `pnpm test:browser` in `products/jbrowse-web`
- Tests use `@testing-library/react`, `jest-image-snapshot`, and `mobx-react`

### Build Output

- Packages/plugins publish `esm/` directories (TypeScript compiler output)
- Products like `jbrowse-web` build to `build/` via webpack
- `packages/core/package.json` exports many subpaths (e.g. `@jbrowse/core/util`,
  `@jbrowse/core/configuration`); CI checks these are up to date with
  `node packages/core/scripts/generateExports.mjs`

## Important Notes

- Use `pnpm` — not npm or yarn. The lockfile is `pnpm-lock.yaml`.
- Node 24+ is used in CI.
- Native dependency `canvas` requires system libraries (Cairo, Pango, etc.). See
  `CONTRIBUTING.md` for OS-specific install instructions. If install fails, run
  `pnpm rebuild canvas`.
- The changelog script (`scripts/generate-changelog.sh`) requires the GitHub CLI
  (`gh`) and filters merged PRs by label.
