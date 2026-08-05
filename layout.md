# JBrowse 2 UI Layout Specification

This document describes the redesigned JBrowse 2 application shell, sidebar navigation, workspace/dashboard behavior, and the implementation mapping in the codebase.

## 1. Design Philosophy

- **Premium utilitarian minimalism**: clean surfaces, generous whitespace, restrained color, and typography-driven hierarchy.
- **Warm monochrome chrome**: off-white canvas (`#F7F7F6`), white cards (`#FFFFFF`), charcoal text (`#1A1A1A`), warm gray secondary text (`#6B6B6B`), a teal accent (`#0A7A62`), and a muted sage (`#49796B`) for subtle dashed placeholders.
- **Biological semantics preserved**: base colors, codons, reading frames, and track type accent pastels remain unchanged.
- **Workspace-centric mental model**: the central area is a workspace. Users switch between a **Recents dashboard** (home) and the active genome workspace via the left sidebar.

## 2. Top-Level Layout

The app root is a CSS grid defined in `packages/app-core/src/ui/App/App.tsx`.

```
+-------------------------------------------------------------+
| sidebar touches left edge; 12px canvas padding otherwise    |
| +---------+-------------------------------------------+     |
| |sidebar  | workspaceCard (white rounded rectangle)   |     |
| |canvas   | +---------------------------------------+ |     |
| |card     | | AppBar / Header                       | |     |
| |         | +---------------------------------------+ |     |
| |         | | ViewsContainer / RecentsDashboard     | |     |
| |         | +---------------------------------------+ |     |
| +---------+-------------------------------------------+     |
+-------------------------------------------------------------+
| optional drawer on left or right                            |
+-------------------------------------------------------------+
```

### Visual layers

1. **Root canvas**: `theme.palette.background.default` (warm off-white `#F7F7F6`) fills the viewport. It has `12px` padding on the top, right, and bottom, but **no left padding**, so the sidebar card touches the left edge of the page.
2. **Sidebar card**: a rounded rectangle of the same canvas color on the left. It is **not** white; it visually belongs to the surrounding frame.
3. **Workspace card**: a white (`theme.palette.background.paper`) rounded rectangle on the right, separated from the sidebar card only by its own left border. There is no canvas gap between the two cards.
4. **Card header**: transparent AppBar with a bottom divider; carries the page title (e.g. **Recents**) and right-side actions.
5. **Card body**: the active view (Recents Dashboard or genome workspace).

### Grid columns

- Default: `[sidebar] 44px [main] 1fr`
- Expanded sidebar (Recents): `[sidebar] 180px [main] 1fr`
- With right drawer: `[sidebar] 44px [main] 1fr [drawer] ${drawerWidth}px`
- With left drawer: `[sidebar] 44px [drawer] ${drawerWidth}px [main] 1fr`

The root container animates `grid-template-columns` for smooth sidebar width changes. The sidebar and workspace cards share the same top/bottom alignment because both fill the row height.

## 3. Left Sidebar

File: `packages/app-core/src/ui/App/LeftSidebar.tsx`

### Visual design

- The sidebar is a separate rounded card on the left, **not** part of the white workspace card.
- Collapsed width: `44px`
- Expanded width: `180px`
- Background: `theme.palette.background.default` (warm off-white), identical to the root canvas so the sidebar visually merges with the surrounding frame.
- No right border on the sidebar itself. The divider is provided by the workspace card's left border.
- Rounded square nav buttons: `32px × 32px`, `border-radius: 8px`
- Active button: white background (`#fff`), teal text/icon, subtle shadow
- No active indicator dot, pill, or left strip

### Content order (top to bottom)

1. **Logo mark + wordmark** `JBrowse`
2. **Recents** — clock icon
3. **Workspace** — grid icon
4. `flex: 1` spacer
5. Dynamic **menu items** from `session.menus()` (e.g. File, View, Help)
6. **User footer** — avatar + editable session name + role

When collapsed, only the logo mark, icons, and avatar are visible. When expanded, text labels, the wordmark, and user info fade in.

### Auto-collapse behavior

The sidebar derives its collapse mode from the dashboard state:

| Mode | `session.showRecentsDashboard` | `autoCollapse` | Default width | Hover behavior |
|------|-------------------------------|----------------|---------------|----------------|
| Recents | `true` | `false` | `180px` | Already expanded; no overlay |
| Workspace | `false` / undefined | `true` | `44px` | Hover expands an internal panel to `180px` over the workspace card |

Implementation:

```ts
const autoCollapse = !session.showRecentsDashboard
```

- `autoCollapse = false`:
  - Outer sidebar container is `180px` wide and participates in the root grid.
  - Inner container is `position: relative; width: 100%; height: 100%`.
  - Buttons and labels are always expanded.
- `autoCollapse = true`:
  - Outer sidebar container stays `44px` wide.
  - Inner container is `position: absolute; width: 44px`.
  - Hovering the sidebar or the expanded inner panel grows the inner width to `180px` with a canvas background. To keep it visible against the white workspace card, a `1px` divider border appears on the top, right, and bottom edges; the left edge stays open so the panel still feels anchored to the left. The expanded panel has square top-left and bottom-left corners and rounded top-right and bottom-right corners. A very subtle shadow (`2px 2px 6px rgba(0,0,0,0.04)`) is added toward the bottom-right. No heavy shadow is used.

### Label visibility mechanics

Text elements (`logoText`, `navLabel`, `userText`) use `max-width: 0` and `margin-left: 0` when collapsed so they take no layout space and do not push icons off-center. When expanded/hovered, they animate to `max-width: 120px` and `margin-left: 10px`.

### Centering in collapsed mode

Because the sidebar now abuts the workspace card with no canvas gap, the actual `44px` width equals the visible width. All visible elements are centered within it:

- Logo mark: `22px` wide with `11px` horizontal padding.
- Nav buttons: `32px` wide with `6px` horizontal margin.
- Avatar: `28px` wide with `8px` horizontal padding in the footer.

### Active state

- **Recents** button is active when `session.showRecentsDashboard === true`.
- **Workspace** button is active when `session.showRecentsDashboard !== true`.
- Active styling is a white background + teal text; no dot, strip, or pill.

## 4. Recents Dashboard

File: `packages/app-core/src/ui/App/RecentsDashboard.tsx`

### When it appears

Rendered by `ViewsContainer` whenever `session.showRecentsDashboard` is `true`. It is displayed inside the white workspace card.

### Layout

- Full-height scrollable panel
- White card background (inherited from workspace card)
- Padding: `24px 32px`
- Grid of cards with `20px` gaps

### Title

The **Recents** title lives in the card header (`AppToolbar.tsx`) so it aligns with the top strip of the workspace card.

### Cards

All cards have `width: 240px`, `aspect-ratio: 4 / 3`, `border-radius: 12px`, white surface, and `1px solid` border.

1. **New Workspace** (dashed border in muted sage `#49796B` / `theme.palette.softTeal.main`)
   - Icon: `+`
   - Action: `session.setDefaultSession()` then exit dashboard
2. **From Template** (dashed border in muted sage `#49796B`)
   - Icon: dashboard/grid
   - Action: add a default `LinearGenomeView` then exit dashboard
3. **Saved workspace cards** (solid border)
   - Thumbnail placeholder (real workspace screenshots are a future enhancement)
   - Session name
   - Last opened date
   - Action: `session.activateSession(id)` then exit dashboard

If no saved sessions exist, a placeholder message is shown.

## 5. Workspace / Genome View

File: `packages/app-core/src/ui/App/ViewsContainer.tsx`

When `session.showRecentsDashboard` is falsy:

- If `session.views.length > 0`, render the active view container (`TiledViewsContainer` when `useWorkspaces` is true, otherwise `ClassicViewsContainer`).
- If no views exist, render `ViewLauncher` so the user can add the first view.

The active view container is unchanged; this redesign only touches the surrounding shell.

## 6. Drawer

The drawer widget panel (track selector, session manager, etc.) continues to live on the left or right of the main area. Its visibility and position come from the existing `DrawerWidgetSessionMixin`. The redesigned shell places it adjacent to the workspace card, not the sidebar.

## 7. App Bar / Card Header

File: `packages/app-core/src/ui/App/AppToolbar.tsx`

The `AppBar` is now the header strip of the white workspace card:

- Transparent background, no shadow, bottom border divider.
- **Recents mode**: left side shows the **Recents** title; right side shows `HeaderButtons` (share, help, export, avatar).
- **Workspace mode**: only right-side `HeaderButtons` are shown; the genome view supplies its own internal header (omnibox, scalebar, tracks).

## 8. State Model Additions

File: `packages/web-core/src/BaseWebSession/index.ts`

Added to `BaseWebSession`:

```ts
.volatile(() => ({
  showRecentsDashboard: false,
}))
.actions(self => ({
  setShowRecentsDashboard(show: boolean) {
    self.showRecentsDashboard = show
  },
}))
```

This volatile state is intentionally not persisted in session snapshots; reloading the app starts in workspace mode.

## 9. Navigation Flow

```
User clicks Recents in sidebar
        │
        ▼
session.setShowRecentsDashboard(true)
        │
        ▼
App.tsx updates root grid to [sidebar] 180px
LeftSidebar renders expanded (non-overlapping)
ViewsContainer renders RecentsDashboard

User clicks Workspace in sidebar
        │
        ▼
session.setShowRecentsDashboard(false)
        │
        ▼
App.tsx updates root grid to [sidebar] 44px
LeftSidebar renders collapsed (hover to expand)
ViewsContainer renders genome workspace

User clicks a saved workspace card
        │
        ▼
session.activateSession(id)
session.setShowRecentsDashboard(false)
```

## 10. Key Files and Responsibilities

| File | Responsibility |
|------|----------------|
| `packages/app-core/src/ui/App/App.tsx` | Root grid, sidebar width, drawer placement, workspace card wrapper, app bar + views container layout |
| `packages/app-core/src/ui/App/LeftSidebar.tsx` | Collapsible sidebar, logo, Recents/Workspace toggle, dynamic menus, user footer |
| `packages/app-core/src/ui/App/ViewsContainer.tsx` | Switch between RecentsDashboard and genome view containers |
| `packages/app-core/src/ui/App/RecentsDashboard.tsx` | Recents home screen card grid (no internal header) |
| `packages/app-core/src/ui/App/AppToolbar.tsx` | Card header: Recents title in dashboard mode, right-side actions |
| `packages/web-core/src/BaseWebSession/index.ts` | `showRecentsDashboard` volatile state + setter action |
| `packages/core/src/ui/theme.ts` | Warm monochrome palette, teal primary, revised component overrides |
| `jbrowse2-ui-prototype.html` | Standalone visual prototype for rapid iteration |

## 11. Future Enhancements

- **Workspace thumbnails**: capture the current DOM/canvas state when saving a session and render it inside saved workspace cards instead of the placeholder.
- **Templates**: replace the simple "add LinearGenomeView" behavior with a true template gallery (e.g., variant analysis, comparative genomics, single-cell).
- **Sidebar persistence**: optionally remember the last sidebar mode per session or in local storage.
- **Keyboard shortcuts**: `⌘/Ctrl + Shift + R` for Recents, `⌘/Ctrl + Shift + W` for Workspace.
